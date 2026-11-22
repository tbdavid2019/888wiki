import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import { getNoteViewCount, recordUniqueNoteView } from '../src/note_stats.mjs'
import worker, { runScheduledCleanup } from '../src/index.js'
import { handleMcpRequest } from '../src/mcp_server.mjs'

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

function createSplitOrUnifiedStatsD1() {
    // Support SELECT inside batch (3rd statement of recordUniqueNoteView)
    const sqlite = new DatabaseSync(':memory:')
    for (const file of ['notes_d1.sql', 'notes_registry.sql', 'note_stats.sql', 'note_annotations.sql']) {
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
                    const trimmed = stmt._sql.trim().toUpperCase()
                    if (trimmed.startsWith('SELECT')) {
                        const results = sqlite.prepare(stmt._sql).all(...stmt._args)
                        out.push({ success: true, meta: { changes: 0 }, results })
                    } else {
                        const info = sqlite.prepare(stmt._sql).run(...stmt._args)
                        out.push({ success: true, meta: { changes: Number(info?.changes ?? 0) }, results: [] })
                    }
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

function cleanupGlobals() {
    for (const k of [
        'SCN_STORAGE_DRIVER',
        'SCN_SECRET',
        'NOTES_DB',
        'APP_DB',
        'NOTE_HISTORY_DB',
        'NOTES',
        'SHARE',
    ]) {
        delete globalThis[k]
    }
}

test('generation-scoped note_stats_uid isolates views across slug reuse and deduplicates repeat devices per generation', async () => {
    const db = createSplitOrUnifiedStatsD1()
    globalThis.SCN_STORAGE_DRIVER = 'd1'
    globalThis.NOTES_DB = db
    globalThis.APP_DB = db

    const deviceA = 'a'.repeat(64)
    const deviceB = 'b'.repeat(64)

    try {
        // Generation 1 views
        const r1 = await recordUniqueNoteView(db, 'slug-1', deviceA, 1000, { noteUid: 'uid-1' })
        assert.deepEqual(r1, { viewCount: 1, isUnique: true })

        // Repeat device on same generation does NOT increment
        const r1Dup = await recordUniqueNoteView(db, 'slug-1', deviceA, 1005, { noteUid: 'uid-1' })
        assert.deepEqual(r1Dup, { viewCount: 1, isUnique: false })

        const r2 = await recordUniqueNoteView(db, 'slug-1', deviceB, 1010, { noteUid: 'uid-1' })
        assert.deepEqual(r2, { viewCount: 2, isUnique: true })
        assert.equal(await getNoteViewCount(db, 'slug-1', { noteUid: 'uid-1' }), 2)

        // Generation 2 reuses 'slug-1' -> starts at 0 and same deviceA counts fresh for uid-2
        assert.equal(await getNoteViewCount(db, 'slug-1', { noteUid: 'uid-2' }), 0)
        const gen2View = await recordUniqueNoteView(db, 'slug-1', deviceA, 2000, { noteUid: 'uid-2' })
        assert.deepEqual(gen2View, { viewCount: 1, isUnique: true })
        assert.equal(await getNoteViewCount(db, 'slug-1', { noteUid: 'uid-1' }), 2)
        assert.equal(await getNoteViewCount(db, 'slug-1', { noteUid: 'uid-2' }), 1)

        // Missing noteUid in registry mode fails closed
        assert.equal(await getNoteViewCount(db, 'slug-1', { noteUid: '' }), 0)
        assert.deepEqual(await recordUniqueNoteView(db, 'slug-1', deviceA, 2000, { noteUid: '' }), { viewCount: null, isUnique: false })
    } finally {
        cleanupGlobals()
    }
})

test('SSR share HTML, editor HTML, and MCP get_view_stats all scope views by (path, note_uid)', async () => {
    const db = createSplitOrUnifiedStatsD1()
    const env = {
        SCN_STORAGE_DRIVER: 'd1',
        SCN_SECRET: 'stats-test-secret',
        NOTES_DB: db,
        APP_DB: db,
    }
    const ctx = { waitUntil: () => {} }

    try {
        // Seed old legacy note_stats and old uid-old stats on same path 'page-one'
        db.sqlite.prepare('INSERT INTO note_stats (path, view_count, last_viewed_at) VALUES (?, ?, ?)').run('page-one', 999, 1000)
        db.sqlite.prepare('INSERT INTO note_stats_uid (path, note_uid, views, updated_at) VALUES (?, ?, ?, ?)').run('page-one', 'uid-old', 50, 1000)
        db.sqlite.prepare('INSERT INTO note_tombstones (path, deleted_note_uid, deleted_at, delete_nonce) VALUES (?, ?, ?, ?)').run('page-one', 'uid-old', 1500, 'del-1')

        // Active generation uid-new with 0 views initially
        const shareToken = 'ShareTok1234567890ABCD'
        db.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
            'page-one',
            '# New Gen',
            JSON.stringify({ share: true, shareSlug: shareToken, shareId: shareToken, noteUid: 'uid-new', metaVersion: 1 }),
            2000,
        )
        db.sqlite.prepare('INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at) VALUES (?, ?, ?, 1, ?)').run(
            shareToken,
            'page-one',
            'uid-new',
            2000,
        )
        db.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run(shareToken, 'page-one', 2000)

        // 1. First visitor view on SSR share HTML -> counts 1 for uid-new (NOT 50 or 999)
        const deviceUuid = '20fb5a34-2f56-43f2-8d3f-c3dd2cd8fbbb'
        const shareRes1 = await worker.fetch(new Request(`https://wiki.david888.com/share/${shareToken}`, {
            headers: { Cookie: `cn_device=${deviceUuid}` },
        }), env, ctx)
        assert.equal(shareRes1.status, 200)
        const html1 = await shareRes1.text()
        assert.match(html1, /"viewCount":1/)

        // Repeat view with same device -> stays 1
        const shareRes2 = await worker.fetch(new Request(`https://wiki.david888.com/share/${shareToken}`, {
            headers: { Cookie: `cn_device=${deviceUuid}` },
        }), env, ctx)
        assert.equal(shareRes2.status, 200)
        const html2 = await shareRes2.text()
        assert.match(html2, /"viewCount":1/)

        // 2. Editor HTML reflects uid-new viewCount = 1
        const editRes = await worker.fetch(new Request('https://wiki.david888.com/page-one'), env, ctx)
        assert.equal(editRes.status, 200)
        const editHtml = await editRes.text()
        assert.match(editHtml, /"viewCount":1/)

        // 3. MCP get_view_stats reflects uid-new uniqueViews = 1
        const mcpRes = await handleMcpRequest(new Request('https://wiki.david888.com/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: { name: 'get_view_stats', arguments: { path: 'page-one' } },
            }),
        }))
        const mcpJson = await mcpRes.json()
        const parsedStats = JSON.parse(mcpJson.result.content[0].text)
        assert.equal(parsedStats.uniqueViews, 1)

        // 4. scheduled() sweeps orphaned uid-old stats while preserving uid-new stats
        await runScheduledCleanup(env, { nowSeconds: 3000 })
        const oldStatRow = db.sqlite.prepare("SELECT * FROM note_stats_uid WHERE path = 'page-one' AND note_uid = 'uid-old'").get()
        const newStatRow = db.sqlite.prepare("SELECT * FROM note_stats_uid WHERE path = 'page-one' AND note_uid = 'uid-new'").get()
        assert.equal(oldStatRow, undefined)
        assert.equal(newStatRow?.views, 1)
    } finally {
        cleanupGlobals()
    }
})
