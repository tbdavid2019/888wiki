import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import {
    deleteNoteHistoryVersions,
    getLatestNoteHistoryVersion,
    getNoteHistoryCounts,
    getNoteHistoryVersionById,
    insertNoteHistoryVersion,
    listNoteHistoryVersions,
    pruneNoteHistoryVersions,
    saveNoteHistoryVersionIfNeeded,
} from '../src/note_history.mjs'
import { runScheduledCleanup } from '../src/index.js'

function createSqliteD1(schemaFiles = []) {
    const sqlite = new DatabaseSync(':memory:')
    for (const file of schemaFiles) {
        sqlite.exec(readFileSync(new URL(`../schema/${file}`, import.meta.url), 'utf8'))
    }
    const wrapStmt = (sql, boundArgs = []) => ({
        _sql: sql,
        _args: boundArgs,
        bind(...args) {
            return wrapStmt(sql, args)
        },
        async first() {
            const row = sqlite.prepare(sql).get(...boundArgs)
            return row ?? null
        },
        async all() {
            const results = sqlite.prepare(sql).all(...boundArgs)
            return { results }
        },
        async run() {
            const info = sqlite.prepare(sql).run(...boundArgs)
            return { success: true, meta: { changes: Number(info?.changes ?? 0) } }
        },
    })
    return {
        sqlite,
        prepare(sql) {
            return wrapStmt(sql)
        },
        async batch(statements) {
            sqlite.exec('BEGIN IMMEDIATE')
            try {
                const out = []
                for (const stmt of statements) {
                    const info = sqlite.prepare(stmt._sql).run(...stmt._args)
                    out.push({ success: true, meta: { changes: Number(info?.changes ?? 0) }, results: [] })
                }
                sqlite.exec('COMMIT')
                return out
            } catch (err) {
                sqlite.exec('ROLLBACK')
                throw err
            }
        },
    }
}

const ENV_KEYS = [
    'SCN_STORAGE_DRIVER',
    'SCN_ENABLE_NOTE_HISTORY',
    'SCN_LEGACY_HISTORY_RETENTION_DAYS',
    'NOTES_DB',
    'NOTE_HISTORY_DB',
    'NOTES',
    'SHARE',
]

function cleanupGlobals() {
    for (const k of ENV_KEYS) delete globalThis[k]
}

test('history UID isolation: hides untagged legacy rows and isolates ABA slug reuse across all functions', async () => {
    const notesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
    const historyDb = createSqliteD1(['note_history.sql', 'note_history_meta.sql'])

    globalThis.SCN_STORAGE_DRIVER = 'd1'
    globalThis.SCN_ENABLE_NOTE_HISTORY = '1'
    globalThis.NOTES_DB = notesDb
    globalThis.NOTE_HISTORY_DB = historyDb

    try {
        // Seed pre-cutover untagged note_history row (no note_history_meta entry)
        historyDb.sqlite.prepare(
            'INSERT INTO note_history (path, content, created_at) VALUES (?, ?, ?)'
        ).run('slug-aba', 'Pre-cutover secret', 1000)

        // Generation A saves two versions
        const saveA1 = await saveNoteHistoryVersionIfNeeded({
            db: historyDb,
            enabled: true,
            limit: 10,
            minIntervalSeconds: 60,
            path: 'slug-aba',
            noteUid: 'uid-gen-A',
            previousContent: 'Gen A v1',
            nextContent: 'Gen A v2',
            nowSeconds: 2000,
        })
        assert.equal(saveA1.saved, true)

        const saveA2 = await saveNoteHistoryVersionIfNeeded({
            db: historyDb,
            enabled: true,
            limit: 10,
            minIntervalSeconds: 60,
            path: 'slug-aba',
            noteUid: 'uid-gen-A',
            previousContent: 'Gen A v2',
            nextContent: 'Gen A v3',
            nowSeconds: 2100,
        })
        assert.equal(saveA2.saved, true)

        // Generation A sees ONLY its 2 versions (untagged row stays hidden)
        const listA = await listNoteHistoryVersions(historyDb, 'slug-aba', 10, { noteUid: 'uid-gen-A' })
        assert.equal(listA.length, 2)
        assert.deepEqual(listA.map(v => v.content), ['Gen A v2', 'Gen A v1'])

        const countsA = await getNoteHistoryCounts(historyDb, [{ path: 'slug-aba', noteUid: 'uid-gen-A' }])
        assert.equal(countsA.get('slug-aba'), 2)

        // Generation B reuses the same slug 'slug-aba'
        const latestB = await getLatestNoteHistoryVersion(historyDb, 'slug-aba', { noteUid: 'uid-gen-B' })
        assert.equal(latestB, null)
        assert.deepEqual(await listNoteHistoryVersions(historyDb, 'slug-aba', 10, { noteUid: 'uid-gen-B' }), [])
        assert.equal((await getNoteHistoryCounts(historyDb, [{ path: 'slug-aba', noteUid: 'uid-gen-B' }])).get('slug-aba') || 0, 0)
        assert.equal(await getNoteHistoryVersionById(historyDb, 'slug-aba', listA[0].id, { noteUid: 'uid-gen-B' }), null)

        // Save 3 versions for Generation B with limit = 2 -> prune affects ONLY uid-gen-B
        await saveNoteHistoryVersionIfNeeded({
            db: historyDb,
            enabled: true,
            limit: 2,
            minIntervalSeconds: 10,
            path: 'slug-aba',
            noteUid: 'uid-gen-B',
            previousContent: 'Gen B v1',
            nextContent: 'Gen B v2',
            nowSeconds: 3000,
        })
        await saveNoteHistoryVersionIfNeeded({
            db: historyDb,
            enabled: true,
            limit: 2,
            minIntervalSeconds: 10,
            path: 'slug-aba',
            noteUid: 'uid-gen-B',
            previousContent: 'Gen B v2',
            nextContent: 'Gen B v3',
            nowSeconds: 3100,
        })
        await saveNoteHistoryVersionIfNeeded({
            db: historyDb,
            enabled: true,
            limit: 2,
            minIntervalSeconds: 10,
            path: 'slug-aba',
            noteUid: 'uid-gen-B',
            previousContent: 'Gen B v3',
            nextContent: 'Gen B v4',
            nowSeconds: 3200,
        })

        const listB = await listNoteHistoryVersions(historyDb, 'slug-aba', 10, { noteUid: 'uid-gen-B' })
        assert.equal(listB.length, 2)
        assert.deepEqual(listB.map(v => v.content), ['Gen B v3', 'Gen B v2'])

        // Generation A and untagged row were NOT pruned
        assert.equal((await listNoteHistoryVersions(historyDb, 'slug-aba', 10, { noteUid: 'uid-gen-A' })).length, 2)
        const untaggedRow = historyDb.sqlite.prepare("SELECT content FROM note_history WHERE content = 'Pre-cutover secret'").get()
        assert.ok(untaggedRow)

        // Delete Generation B history -> leaves Generation A and untagged row untouched
        await deleteNoteHistoryVersions(historyDb, 'slug-aba', { noteUid: 'uid-gen-B' })
        assert.equal((await listNoteHistoryVersions(historyDb, 'slug-aba', 10, { noteUid: 'uid-gen-B' })).length, 0)
        assert.equal((await listNoteHistoryVersions(historyDb, 'slug-aba', 10, { noteUid: 'uid-gen-A' })).length, 2)
        assert.ok(historyDb.sqlite.prepare("SELECT content FROM note_history WHERE content = 'Pre-cutover secret'").get())

        // Missing noteUid fails closed in registry mode
        assert.equal(await getLatestNoteHistoryVersion(historyDb, 'slug-aba', { noteUid: '' }), null)
        assert.deepEqual(await listNoteHistoryVersions(historyDb, 'slug-aba', 10, { noteUid: '' }), [])
        const skippedMissingUid = await saveNoteHistoryVersionIfNeeded({
            db: historyDb,
            enabled: true,
            limit: 10,
            minIntervalSeconds: 10,
            path: 'slug-aba',
            noteUid: '',
            previousContent: 'a',
            nextContent: 'b',
            nowSeconds: 4000,
        })
        assert.equal(skippedMissingUid.saved, false)
        assert.equal(skippedMissingUid.reason, 'missing_note_uid')
    } finally {
        cleanupGlobals()
    }
})

test('pure-KV mode with D1 history sidecar excludes note_history_meta-tagged rows and never deletes pure-KV history on retention cleanup', async () => {
    const historyDb = createSqliteD1(['note_history.sql', 'note_history_meta.sql'])

    globalThis.SCN_STORAGE_DRIVER = 'kv'
    globalThis.SCN_ENABLE_NOTE_HISTORY = '1'
    globalThis.SCN_LEGACY_HISTORY_RETENTION_DAYS = '1'
    globalThis.NOTE_HISTORY_DB = historyDb

    try {
        // Seed a D1-registry tagged row (e.g. from another era) and a pure-KV untagged row
        const taggedInfo = historyDb.sqlite.prepare(
            'INSERT INTO note_history (path, content, created_at) VALUES (?, ?, ?)'
        ).run('shared-slug', 'D1 UID Tagged Secret', 100)
        historyDb.sqlite.prepare(
            'INSERT INTO note_history_meta (history_id, path, note_uid, created_at) VALUES (?, ?, ?, ?)'
        ).run(taggedInfo.lastInsertRowid, 'shared-slug', 'uid-d1-only', 100)

        await insertNoteHistoryVersion(historyDb, {
            path: 'shared-slug',
            content: 'Pure KV Version',
            createdAt: 200,
        })

        // Pure-KV reads/counts/prune exclude tagged D1 rows
        const latest = await getLatestNoteHistoryVersion(historyDb, 'shared-slug')
        assert.equal(latest?.content, 'Pure KV Version')

        const list = await listNoteHistoryVersions(historyDb, 'shared-slug', 10)
        assert.equal(list.length, 1)
        assert.equal(list[0].content, 'Pure KV Version')

        const counts = await getNoteHistoryCounts(historyDb, ['shared-slug'])
        assert.equal(counts.get('shared-slug'), 1)

        assert.equal(await getNoteHistoryVersionById(historyDb, 'shared-slug', Number(taggedInfo.lastInsertRowid)), null)

        await pruneNoteHistoryVersions(historyDb, 'shared-slug', 0)
        assert.equal((await listNoteHistoryVersions(historyDb, 'shared-slug', 10)).length, 0)
        // Tagged D1 row still intact
        assert.ok(historyDb.sqlite.prepare('SELECT id FROM note_history WHERE id = ?').get(Number(taggedInfo.lastInsertRowid)))

        // Re-insert pure-KV row and run scheduled() with retention=1 -> MUST NOT delete pure-KV history!
        await insertNoteHistoryVersion(historyDb, {
            path: 'kv-old',
            content: 'Old Pure KV History',
            createdAt: 100,
        })
        await runScheduledCleanup({
            SCN_STORAGE_DRIVER: 'kv',
            SCN_ENABLE_NOTE_HISTORY: '1',
            SCN_LEGACY_HISTORY_RETENTION_DAYS: '1',
            NOTE_HISTORY_DB: historyDb,
        }, { nowSeconds: 100 + 30 * 86400 })

        const stillThere = await listNoteHistoryVersions(historyDb, 'kv-old', 10)
        assert.equal(stillThere.length, 1)
        assert.equal(stillThere[0].content, 'Old Pure KV History')
    } finally {
        cleanupGlobals()
    }
})

test('scheduled() reconciles delayed cross-DB note_history against note_tombstones and enforces SCN_LEGACY_HISTORY_RETENTION_DAYS in registry mode', async () => {
    const notesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
    const historyDb = createSqliteD1(['note_history.sql', 'note_history_meta.sql'])

    globalThis.SCN_STORAGE_DRIVER = 'd1'
    globalThis.SCN_ENABLE_NOTE_HISTORY = '1'
    globalThis.NOTES_DB = notesDb
    globalThis.NOTE_HISTORY_DB = historyDb

    try {
        const now = 1700000000
        // Tombstone for uid-deleted on 'slug-x'
        notesDb.sqlite.prepare(
            'INSERT INTO note_tombstones (path, deleted_note_uid, deleted_at, delete_nonce) VALUES (?, ?, ?, ?)'
        ).run('slug-x', 'uid-deleted', now - 10, 'nonce-1')

        // Active note uid-active on 'slug-x'
        notesDb.sqlite.prepare(
            'INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)'
        ).run('slug-x', 'Active body', JSON.stringify({ noteUid: 'uid-active', metaVersion: 1 }), now)

        // Delayed cross-DB history row for deleted generation + active generation history + old untagged row + recent untagged row
        await insertNoteHistoryVersion(historyDb, { path: 'slug-x', noteUid: 'uid-deleted', content: 'Delayed deleted', createdAt: now - 5 })
        await insertNoteHistoryVersion(historyDb, { path: 'slug-x', noteUid: 'uid-active', content: 'Active snapshot', createdAt: now - 5 })
        historyDb.sqlite.prepare('INSERT INTO note_history (path, content, created_at) VALUES (?, ?, ?)').run('old-note', 'Ancient untagged', now - 10 * 86400)
        historyDb.sqlite.prepare('INSERT INTO note_history (path, content, created_at) VALUES (?, ?, ?)').run('recent-note', 'Recent untagged', now - 2 * 86400)

        // 1. Default retention = 0 -> retains untagged rows, cleans tombstoned delayed history
        await runScheduledCleanup({
            SCN_STORAGE_DRIVER: 'd1',
            SCN_ENABLE_NOTE_HISTORY: '1',
            SCN_LEGACY_HISTORY_RETENTION_DAYS: '0',
            NOTES_DB: notesDb,
            NOTE_HISTORY_DB: historyDb,
        }, { nowSeconds: now })

        assert.equal((await listNoteHistoryVersions(historyDb, 'slug-x', 10, { noteUid: 'uid-deleted' })).length, 0)
        assert.equal((await listNoteHistoryVersions(historyDb, 'slug-x', 10, { noteUid: 'uid-active' })).length, 1)
        assert.ok(historyDb.sqlite.prepare("SELECT id FROM note_history WHERE path = 'old-note'").get())

        // 2. Retention = 7 days -> cleans untagged rows older than 7 days, keeps recent untagged and active tagged rows
        await runScheduledCleanup({
            SCN_STORAGE_DRIVER: 'd1',
            SCN_ENABLE_NOTE_HISTORY: '1',
            SCN_LEGACY_HISTORY_RETENTION_DAYS: '7',
            NOTES_DB: notesDb,
            NOTE_HISTORY_DB: historyDb,
        }, { nowSeconds: now })

        assert.equal(historyDb.sqlite.prepare("SELECT id FROM note_history WHERE path = 'old-note'").get(), undefined)
        assert.ok(historyDb.sqlite.prepare("SELECT id FROM note_history WHERE path = 'recent-note'").get())
        assert.equal((await listNoteHistoryVersions(historyDb, 'slug-x', 10, { noteUid: 'uid-active' })).length, 1)
    } finally {
        cleanupGlobals()
    }
})
