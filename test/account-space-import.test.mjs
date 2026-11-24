import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import jwt from '@tsndr/cloudflare-worker-jwt'

import { handleAccountRoutes } from '../src/account_routes.mjs'
import {
    MAX_SPACE_ITEMS_PER_ACCOUNT,
    SESSION_COOKIE_NAME,
    bookmarkNoteToSpace,
    commitGuestHistoryImport,
    deleteAccountAnnotationMessage,
    deleteSpaceItem,
    finalizePendingImportCommit,
    listSpaceItems,
    previewGuestHistoryImport,
    reconcilePendingImportFinalizations,
    upsertSpaceActivity,
} from '../src/account_data.mjs'
import { commitAuthoritativeNoteWrite, driverDeleteNote, generateNoteUid } from '../src/storage_driver.mjs'

const ORIGIN = 'https://wiki.example.com'
const SECRET = 'test-scn-secret-space-123456'

function createSqliteD1(schemaFiles = [], { onPrepare } = {}) {
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
            if (onPrepare) onPrepare(sql)
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

function makeSpaceEnv({ splitDb = false, onNotesPrepare } = {}) {
    if (!splitDb) {
        const db = createSqliteD1([
            'notes_d1.sql',
            'notes_registry.sql',
            'note_annotations.sql',
            'note_stats.sql',
            'accounts.sql',
        ], { onPrepare: onNotesPrepare })
        return {
            accountDb: db,
            notesDb: db,
            env: {
                SCN_STORAGE_DRIVER: 'd1',
                SCN_NOTES_DB_BINDING: 'NOTES_DB',
                SCN_REQUIRE_NOTES_REGISTRY: '1',
                SCN_SECRET: SECRET,
                SCN_ENABLE_TURNSTILE: '0',
                NOTES_DB: db,
                APP_DB: db,
            },
        }
    }

    const notesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'], { onPrepare: onNotesPrepare })
    const accountDb = createSqliteD1(['note_annotations.sql', 'note_stats.sql', 'accounts.sql'])
    return {
        accountDb,
        notesDb,
        env: {
            SCN_STORAGE_DRIVER: 'd1',
            SCN_NOTES_DB_BINDING: 'NOTES_DB',
            SCN_REQUIRE_NOTES_REGISTRY: '1',
            SCN_SECRET: SECRET,
            SCN_ENABLE_TURNSTILE: '0',
            NOTES_DB: notesDb,
            APP_DB: accountDb,
        },
    }
}

function seedAccountAndSession(accountDb, { accountId = 'acc-1', nickname = 'Alice', sessionId = 'sess-token-1234567890' } = {}) {
    const now = Math.floor(Date.now() / 1000)
    accountDb.sqlite.prepare(
        'INSERT INTO accounts (id, user_handle, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(accountId, `uh-${accountId}`, nickname, now, now)
    accountDb.sqlite.prepare(
        'INSERT INTO account_sessions (id, account_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, NULL)'
    ).run(sessionId, accountId, now, now + 86400)
    return { accountId, sessionId, cookie: `${SESSION_COOKIE_NAME}=${sessionId}` }
}

function req(path, { method = 'GET', body, cookie = '' } = {}) {
    const headers = new Headers({
        Origin: ORIGIN,
        'Sec-Fetch-Site': 'same-origin',
    })
    if (method !== 'GET' && method !== 'HEAD') headers.set('Content-Type', 'application/json')
    if (cookie) headers.set('Cookie', cookie)
    return new Request(`${ORIGIN}${path}`, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body ?? {}),
    })
}

test('2,000 atomic space quota, zero-D1-write skip, and share_only -> edit upgrade', async () => {
    const { accountDb, env } = makeSpaceEnv()
    const { accountId } = seedAccountAndSession(accountDb)

    // Pre-seed 1,999 rows in account_space_items
    const now = Math.floor(Date.now() / 1000)
    const stmt = accountDb.sqlite.prepare(`
        INSERT INTO account_space_items (
            id, item_key, account_id, note_path, note_uid, access_level,
            facets, user_facets, verified_import_facets, editor_format, title_summary,
            status, last_activity_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'edit', '["created"]', '["created"]', NULL, 'markdown', 'Bulk', 'active', ?, ?, ?)
    `)
    for (let i = 0; i < MAX_SPACE_ITEMS_PER_ACCOUNT - 1; i++) {
        stmt.run(`id-${i}`, `key-${i}`, accountId, `bulk-${i}`, `uid-${i}`, now, now, now)
    }

    // 2,000th item succeeds as share_only
    const r2000 = await upsertSpaceActivity({
        env,
        accountId,
        notePath: 'target-note',
        noteUid: 'uid-target',
        editorFormat: 'block',
        titleSummary: 'Target',
        accessLevel: 'share_only',
        facet: 'bookmarked',
    })
    assert.equal(r2000.skipped, false)
    assert.equal(r2000.accessLevel, 'share_only')

    // 2,001st item fails atomically with 409 QUOTA_EXCEEDED
    await assert.rejects(
        () => upsertSpaceActivity({
            env,
            accountId,
            notePath: 'over-quota',
            noteUid: 'uid-over',
            accessLevel: 'edit',
            facet: 'created',
        }),
        { status: 409, code: 'QUOTA_EXCEEDED' },
    )

    // Identical (active, share_only, bookmarked) skips D1 write
    const origBatch = accountDb.prepare.bind(accountDb)
    let updateCalls = 0
    accountDb.prepare = (sql) => {
        if (/^\s*UPDATE\s+account_space_items/i.test(sql)) updateCalls += 1
        return origBatch(sql)
    }
    const skipRes = await upsertSpaceActivity({
        env,
        accountId,
        notePath: 'target-note',
        noteUid: 'uid-target',
        editorFormat: 'block',
        titleSummary: 'Target',
        accessLevel: 'share_only',
        facet: 'bookmarked',
    })
    assert.equal(skipRes.skipped, true)
    assert.equal(updateCalls, 0)

    // Upgrading share_only -> edit ALWAYS persists even if facet 'bookmarked' or 'edited'
    const upgradeRes = await upsertSpaceActivity({
        env,
        accountId,
        notePath: 'target-note',
        noteUid: 'uid-target',
        editorFormat: 'block',
        titleSummary: 'Target Upgraded',
        accessLevel: 'edit',
        facet: 'edited',
    })
    assert.equal(upgradeRes.skipped, false)
    assert.equal(upgradeRes.accessLevel, 'edit')
    assert.equal(updateCalls, 1)
    assert.deepEqual(upgradeRes.facets.sort(), ['bookmarked', 'edited'])
})

test('anti-oracle uniform masking, zero SELECT content, note_uid stale cookie, and slug reuse isolation', async () => {
    const executedSql = []
    const { accountDb, env } = makeSpaceEnv({
        onNotesPrepare: (sql) => executedSql.push(sql),
    })
    const { accountId, cookie } = seedAccountAndSession(accountDb)

    // Publish 3 notes in notesDb
    const pub1 = await commitAuthoritativeNoteWrite({
        path: 'pub-open',
        content: 'SECRET_CONTENT_SHOULD_NEVER_BE_SELECTED',
        nextMetadata: { share: true, editorFormat: 'markdown', title: 'Open Note' },
        isNewNote: true,
        env,
    })
    const pub2 = await commitAuthoritativeNoteWrite({
        path: 'pub-vpw',
        content: 'SECRET_VPW_CONTENT',
        nextMetadata: { share: true, editorFormat: 'canvas', title: 'Secret VPW Title' },
        isNewNote: true,
        env,
    })
    const pub3 = await commitAuthoritativeNoteWrite({
        path: 'pub-slug-reuse',
        content: 'Gen 1 content',
        nextMetadata: { share: true, editorFormat: 'markdown', title: 'Gen 1' },
        isNewNote: true,
        env,
    })

    // Bookmark pub1 and pub2 as share_only, and index pub3 (gen 1)
    const bm1 = await bookmarkNoteToSpace({ env, accountId, shareId: pub1.shareId })
    assert.equal(bm1.item.notePath, undefined)
    assert.equal(bm1.item.noteUid, undefined)
    assert.equal(bm1.circleEligible, true)

    await bookmarkNoteToSpace({ env, accountId, shareId: pub2.shareId })
    await bookmarkNoteToSpace({ env, accountId, shareId: pub3.shareId })

    // Now lock pub2 with vpw, and delete + recreate pub3 with new noteUid
    await commitAuthoritativeNoteWrite({
        path: 'pub-vpw',
        content: 'SECRET_VPW_CONTENT',
        nextMetadata: { ...pub2.metadata, vpw: 'hashed-vpw' },
        expectedNoteUid: pub2.noteUid,
        expectedMetaVersion: pub2.metaVersion,
        env,
    })
    await driverDeleteNote('pub-slug-reuse', { env, noteUid: pub3.noteUid, metaVersion: pub3.metaVersion })
    await commitAuthoritativeNoteWrite({
        path: 'pub-slug-reuse',
        content: 'Gen 2 content',
        nextMetadata: { share: true, title: 'Gen 2 Replacement' },
        isNewNote: true,
        env,
    })

    executedSql.length = 0
    const listRes = await handleAccountRoutes(req('/api/space/items', { method: 'GET', cookie }), env)
    assert.equal(listRes.status, 200)
    const listJson = await listRes.json()

    // Assert zero `SELECT content` or `SELECT path, content` executed!
    for (const sql of executedSql) {
        assert.doesNotMatch(sql, /\bSELECT\b[\s\S]*\bcontent\b/i, `Must never SELECT content: ${sql}`)
    }

    assert.equal(listJson.items.length, 3)
    const openItem = listJson.items.find(i => i.shareId === pub1.shareId)
    assert.ok(openItem)
    assert.equal(openItem.masked, false)
    assert.equal(openItem.notePath, undefined)

    const maskedItems = listJson.items.filter(i => i.masked === true)
    assert.equal(maskedItems.length, 2)
    for (const m of maskedItems) {
        assert.deepEqual(Object.keys(m).sort(), ['accessLevel', 'actions', 'editorFormat', 'itemKey', 'masked', 'protectionBadge', 'title'])
        assert.equal(m.title, 'Unavailable or Protected Note')
        assert.equal(m.editorFormat, null)
        assert.equal(m.protectionBadge, null)
        assert.deepEqual(m.actions, ['remove'])
    }

    // Stale noteUid edit cookie cannot bookmark replacement note with accessLevel='edit'
    const staleJwt = await jwt.sign({ path: 'pub-slug-reuse', role: 'edit', noteUid: pub3.noteUid, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET)
    const staleRes = await handleAccountRoutes(req('/api/space/bookmark', {
        method: 'POST',
        cookie: `${cookie}; auth=${staleJwt}`,
        body: { notePath: 'pub-slug-reuse' },
    }), env)
    assert.equal(staleRes.status, 403)

    // Remove masked item via opaque itemKey
    const delRes = await handleAccountRoutes(req(`/api/space/items/${encodeURIComponent(maskedItems[0].itemKey)}`, {
        method: 'DELETE',
        cookie,
        body: {},
    }), env)
    assert.equal(delRes.status, 200)
    const afterList = await listSpaceItems({ env, accountId })
    assert.equal(afterList.items.length, 2)
})

test('View Lock alone prevents bookmark edit upgrades and keeps the item masked', async () => {
    const { accountDb, env } = makeSpaceEnv()
    const { accountId, cookie } = seedAccountAndSession(accountDb)
    const note = await commitAuthoritativeNoteWrite({
        path: 'view-locked',
        content: 'private content',
        nextMetadata: { share: true, title: 'Private title', vpw: 'view-password-hash', pw: '' },
        isNewNote: true,
        env,
    })
    await upsertSpaceActivity({
        env, accountId, notePath: 'view-locked', noteUid: note.noteUid,
        accessLevel: 'share_only', facet: 'bookmarked',
    })
    const viewerJwt = await jwt.sign({ path: 'view-locked', role: 'view', noteUid: note.noteUid, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET)
    for (const authCookie of ['', `; auth=${viewerJwt}`]) {
        const res = await handleAccountRoutes(req('/api/space/bookmark', {
            method: 'POST',
            cookie: cookie + authCookie,
            body: { notePath: 'view-locked', noteUid: note.noteUid },
        }), env)
        assert.equal(res.status, 403)
        const listed = await listSpaceItems({ env, accountId })
        assert.equal(listed.items.length, 1)
        assert.equal(listed.items[0].accessLevel, 'share_only')
        assert.equal(listed.items[0].masked, true)
        assert.equal(listed.items[0].title, 'Unavailable or Protected Note')
        assert.deepEqual(listed.items[0].actions, ['remove'])
    }
})

test('stale edit items never link to missing, tombstoned, or replacement notes', async () => {
    const { accountDb, env } = makeSpaceEnv()
    const { accountId, cookie } = seedAccountAndSession(accountDb)
    const tombstoned = await commitAuthoritativeNoteWrite({
        path: 'edit-tombstoned', content: 'Old note', nextMetadata: { title: 'Old' }, isNewNote: true, env,
    })
    const replacement = await commitAuthoritativeNoteWrite({
        path: 'edit-reused', content: 'Replacement', nextMetadata: { title: 'New' }, isNewNote: true, env,
    })
    const live = await commitAuthoritativeNoteWrite({
        path: 'edit-live', content: 'Live note', nextMetadata: { title: 'Live' }, isNewNote: true, env,
    })
    const cases = [
        ['edit-missing', 'missing-uid'],
        ['edit-tombstoned', tombstoned.noteUid],
        ['edit-reused', 'previous-uid'],
    ]
    const keys = []
    for (const [notePath, noteUid] of cases) {
        const item = await upsertSpaceActivity({ env, accountId, notePath, noteUid, accessLevel: 'edit', facet: 'edited' })
        keys.push(item.itemKey)
    }
    const liveItem = await upsertSpaceActivity({
        env, accountId, notePath: 'edit-live', noteUid: live.noteUid, accessLevel: 'edit', facet: 'edited',
    })
    const now = Math.floor(Date.now() / 1000)
    accountDb.sqlite.prepare('INSERT INTO note_tombstones (path, deleted_note_uid, deleted_at, delete_nonce) VALUES (?, ?, ?, ?)')
        .run('edit-tombstoned', tombstoned.noteUid, now, 'nonce')

    const response = await handleAccountRoutes(req('/api/space/items', { cookie }), env)
    assert.equal(response.status, 200)
    const { items } = await response.json()
    assert.equal(items.length, 4)
    for (const key of keys) {
        const item = items.find(i => i.itemKey === key)
        assert.ok(item)
        assert.equal(item.notePath, null)
        assert.equal(item.editUrl, null)
        assert.equal(item.status, 'unavailable')
        assert.equal(item.stale, true)
        assert.deepEqual(item.actions, ['remove'])
        assert.equal(item.shareId, '')
    }
    assert.equal(items.find(i => i.itemKey === liveItem.itemKey).notePath, 'edit-live')
    assert.notEqual(replacement.noteUid, 'previous-uid')

    for (const key of keys) {
        const deleted = await handleAccountRoutes(req(`/api/space/items/${encodeURIComponent(key)}`, { method: 'DELETE', cookie }), env)
        assert.equal(deleted.status, 200)
    }
    const remaining = await listSpaceItems({ env, accountId })
    assert.deepEqual(remaining.items.map(i => i.itemKey), [liveItem.itemKey])
})

test('removing a synthetic annotation item removes only that account and note generation links', async () => {
    const { accountDb, env } = makeSpaceEnv()
    const { accountId: aliceId, cookie: aliceCookie } = seedAccountAndSession(accountDb, { accountId: 'alice', sessionId: 'alice-session-1234567890' })
    const { accountId: bobId } = seedAccountAndSession(accountDb, { accountId: 'bob', sessionId: 'bob-session-1234567890' })
    const note = await commitAuthoritativeNoteWrite({
        path: 'synthetic-note', content: 'Annotated', nextMetadata: { share: true }, isNewNote: true, env,
    })
    const now = Math.floor(Date.now() / 1000)
    accountDb.sqlite.prepare(`
        INSERT INTO annotation_threads (id, path, quote_exact, quote_prefix, quote_suffix, start_offset, end_offset, source_revision, is_resolved, created_at, updated_at)
        VALUES ('synthetic-thread', 'synthetic-note', 'Annotated', '', '', 0, 9, 'rev', 0, ?, ?)
    `).run(now, now)
    const insertMessage = accountDb.sqlite.prepare(`
        INSERT INTO annotation_messages (id, thread_id, author_name, body, created_at, deleted_at)
        VALUES (?, 'synthetic-thread', 'Author', 'Comment', ?, ?)
    `)
    const insertLink = accountDb.sqlite.prepare(`
        INSERT INTO account_annotation_links (message_id, thread_id, account_id, note_path, note_uid, share_id, created_at)
        VALUES (?, 'synthetic-thread', ?, 'synthetic-note', ?, ?, ?)
    `)
    for (const [id, owner, uid, deletedAt] of [
        ['alice-one', aliceId, note.noteUid, null],
        ['alice-two', aliceId, note.noteUid, null],
        ['alice-deleted', aliceId, note.noteUid, now],
        ['alice-old-generation', aliceId, 'old-uid', null],
        ['bob-one', bobId, note.noteUid, null],
    ]) {
        insertMessage.run(id, now, deletedAt)
        insertLink.run(id, owner, uid, note.shareId, now)
    }

    const aliceItems = (await listSpaceItems({ env, accountId: aliceId })).items
    assert.equal(aliceItems.length, 2)
    const current = aliceItems.find(i => i.shareId === note.shareId)
    const old = aliceItems.find(i => i.masked)
    assert.ok(current.itemKey.startsWith('ann_'))
    assert.ok(old.itemKey.startsWith('ann_'))
    assert.notEqual(current.itemKey, old.itemKey)
    assert.equal((await listSpaceItems({ env, accountId: bobId })).items[0].itemKey, current.itemKey)

    const response = await handleAccountRoutes(req(`/api/space/items/${encodeURIComponent(current.itemKey)}`, {
        method: 'DELETE', cookie: aliceCookie,
    }), env)
    assert.equal(response.status, 200)
    assert.deepEqual((await listSpaceItems({ env, accountId: aliceId })).items.map(i => i.itemKey), [old.itemKey])
    assert.equal((await listSpaceItems({ env, accountId: bobId })).items[0].itemKey, current.itemKey)
    assert.deepEqual(
        accountDb.sqlite.prepare('SELECT message_id FROM account_annotation_links ORDER BY message_id').all().map(row => row.message_id),
        ['alice-old-generation', 'bob-one'],
    )
    assert.equal(accountDb.sqlite.prepare('SELECT COUNT(*) AS count FROM annotation_messages').get().count, 5)
    await assert.rejects(() => deleteSpaceItem({ env, accountId: aliceId, itemKey: current.itemKey }),
        { status: 404, code: 'SPACE_ITEM_NOT_FOUND' })
    const maskedResponse = await handleAccountRoutes(req(`/api/space/items/${encodeURIComponent(old.itemKey)}`, {
        method: 'DELETE', cookie: aliceCookie,
    }), env)
    assert.equal(maskedResponse.status, 200)
    assert.equal((await listSpaceItems({ env, accountId: aliceId })).items.length, 0)
    assert.equal((await listSpaceItems({ env, accountId: bobId })).items[0].itemKey, current.itemKey)
})

test('single-DB guest import enforces URL normalization, legacy->share_only, and atomic live visibility', async () => {
    const { accountDb, env } = makeSpaceEnv({ splitDb: false })
    const { accountId, cookie } = seedAccountAndSession(accountDb)

    const open = await commitAuthoritativeNoteWrite({
        path: 'imp-open',
        content: 'Open body',
        nextMetadata: { share: true, editorFormat: 'block', title: 'Importable Note' },
        isNewNote: true,
        env,
    })
    const locked = await commitAuthoritativeNoteWrite({
        path: 'imp-locked',
        content: 'Secret',
        nextMetadata: { share: true, vpw: 'secret', title: 'Locked' },
        isNewNote: true,
        env,
    })

    // Preview normalizes /present & /book, rejects cross-origin, /c/, query creds, and hides locked/missing uniformly
    const previewRes = await handleAccountRoutes(req('/api/space/import/preview', {
        method: 'POST',
        cookie,
        body: {
            items: [
                { url: `${ORIGIN}/share/${open.shareId}/present`, source: 'created' },
                { url: `${ORIGIN}/share/${locked.shareId}/book`, source: 'viewed' },
                { url: `https://evil.example/share/${open.shareId}`, source: 'viewed' },
                { url: `${ORIGIN}/share/${open.shareId}?pw=secret`, source: 'viewed' },
                { url: `${ORIGIN}/c/someCircleToken12345`, source: 'viewed' },
                { url: `${ORIGIN}/share/imp-open`, source: 'viewed' },
            ],
        },
    }), env)
    assert.equal(previewRes.status, 200)
    const preview = await previewRes.json()
    assert.equal(preview.items[0].eligible, true)
    assert.equal(preview.items[0].status, 'eligible')
    // All invalid / locked / cross-origin / /c/ / path-alias candidates report uniform unavailable
    for (let i = 1; i < preview.items.length; i++) {
        assert.equal(preview.items[i].eligible, false)
        assert.equal(preview.items[i].status, 'unavailable')
        assert.equal(preview.items[i].title, 'Unavailable or Protected Note')
    }

    // Commit legacy 'created' URL -> imports as share_only!
    const commitRes = await handleAccountRoutes(req('/api/space/import', {
        method: 'POST',
        cookie,
        body: {
            items: [{ url: `${ORIGIN}/share/${open.shareId}/book`, source: 'created' }],
        },
    }), env)
    assert.equal(commitRes.status, 200)
    const commitJson = await commitRes.json()
    assert.equal(commitJson.importedCount, 1)

    const spaceList = await listSpaceItems({ env, accountId })
    assert.equal(spaceList.items.length, 1)
    assert.equal(spaceList.items[0].accessLevel, 'share_only')
    assert.equal(spaceList.items[0].notePath, undefined)

    // Unshare + republish same UID right before single-DB batch commits: simulate old token failing EXISTS check
    const oldShareId = open.shareId
    await commitAuthoritativeNoteWrite({
        path: 'imp-open',
        content: 'Open body',
        nextMetadata: { ...open.metadata, share: true },
        expectedNoteUid: open.noteUid,
        expectedMetaVersion: open.metaVersion,
        shareAction: 'republish',
        env,
    })
    const staleImportRes = await commitGuestHistoryImport(req('/api/space/import', { method: 'POST', cookie }), env, accountId, {
        items: [{ url: `${ORIGIN}/share/${oldShareId}`, source: 'viewed' }],
    })
    assert.equal(staleImportRes.importedCount, 0)
    assert.equal(staleImportRes.unavailableCount, 1)
})

test('split-DB 4-stage import: crash recovery, Cron reconcile, concurrent bookmark preservation, and overlapping imports', async () => {
    const { accountDb, notesDb, env } = makeSpaceEnv({ splitDb: true })
    const { accountId } = seedAccountAndSession(accountDb)

    const noteA = await commitAuthoritativeNoteWrite({
        path: 'split-a',
        content: 'A',
        nextMetadata: { share: true, title: 'Split A' },
        isNewNote: true,
        env,
    })
    const noteB = await commitAuthoritativeNoteWrite({
        path: 'split-b',
        content: 'B',
        nextMetadata: { share: true, title: 'Split B' },
        isNewNote: true,
        env,
    })

    // 1. Seed a crashed Stage 3 commit in accountDb (with one surviving noteA and one revoked noteB)
    const now = Math.floor(Date.now() / 1000)
    const crashCommitId = 'crash-commit-1'
    accountDb.sqlite.prepare(`
        INSERT INTO account_space_items (
            id, item_key, account_id, note_path, note_uid, access_level,
            facets, user_facets, verified_import_facets, editor_format, title_summary,
            status, import_batch_id, pending_import_commit_id, pending_import_facets,
            last_activity_at, created_at, updated_at
        ) VALUES
        ('sp-a', 'ik-a', ?, 'split-a', ?, 'share_only', '[]', NULL, NULL, 'markdown', 'Split A', 'pending_import', 'b1', ?, '["created"]', ?, ?, ?),
        ('sp-b', 'ik-b', ?, 'split-b', ?, 'share_only', '["bookmarked"]', '["bookmarked"]', '["created"]', 'markdown', 'Split B', 'active', NULL, ?, '["bookmarked"]', ?, ?, ?)
    `).run(
        accountId, noteA.noteUid, crashCommitId, now, now, now,
        accountId, noteB.noteUid, crashCommitId, now, now, now,
    )
    const candidates = [
        { shareId: noteA.shareId, notePath: 'split-a', noteUid: noteA.noteUid, accessLevel: 'share_only', importFacet: 'created', editorFormat: 'markdown', titleSummary: 'Split A' },
        { shareId: noteB.shareId, notePath: 'split-b', noteUid: noteB.noteUid, accessLevel: 'share_only', importFacet: 'bookmarked', editorFormat: 'markdown', titleSummary: 'Split B' },
    ]
    accountDb.sqlite.prepare(
        'INSERT INTO pending_import_finalizations (commit_id, account_id, candidates_json, created_at) VALUES (?, ?, ?, ?)'
    ).run(crashCommitId, accountId, JSON.stringify(candidates), now)

    // Unshare noteB before Cron reconcile runs
    await commitAuthoritativeNoteWrite({
        path: 'split-b',
        content: 'B',
        nextMetadata: { ...noteB.metadata, share: false },
        expectedNoteUid: noteB.noteUid,
        expectedMetaVersion: noteB.metaVersion,
        env,
    })

    // 1a. If notesDb is unreachable during Cron reconcile, pending_import_finalizations stays intact for retry
    const brokenEnv = { ...env, NOTES_DB: { prepare() { throw new Error('D1 down') } } }
    const deferredRes = await reconcilePendingImportFinalizations(brokenEnv)
    assert.equal(deferredRes.deferred, 1)
    assert.equal(accountDb.sqlite.prepare('SELECT COUNT(*) AS c FROM pending_import_finalizations').get().c, 1)

    // 1b. When notesDb recovers, Cron reconcile promotes noteA, preserves noteB's prior user_facets & verified_import_facets, and deletes journal
    const okRes = await reconcilePendingImportFinalizations(env)
    assert.equal(okRes.reconciled, 1)
    assert.equal(accountDb.sqlite.prepare('SELECT COUNT(*) AS c FROM pending_import_finalizations').get().c, 0)

    const rowA = accountDb.sqlite.prepare('SELECT status, verified_import_facets, facets, pending_import_commit_id FROM account_space_items WHERE id = ?').get('sp-a')
    assert.equal(rowA.status, 'active')
    assert.equal(rowA.pending_import_commit_id, null)
    assert.deepEqual(JSON.parse(rowA.facets), ['created'])

    const rowB = accountDb.sqlite.prepare('SELECT status, user_facets, verified_import_facets, facets, pending_import_commit_id FROM account_space_items WHERE id = ?').get('sp-b')
    assert.equal(rowB.status, 'active')
    assert.equal(rowB.pending_import_commit_id, null)
    assert.deepEqual(JSON.parse(rowB.user_facets), ['bookmarked'])
    assert.deepEqual(JSON.parse(rowB.verified_import_facets), ['created'])
    assert.deepEqual(JSON.parse(rowB.facets).sort(), ['bookmarked', 'created'])

    // 2. Pure failed first-import (user_facets IS NULL AND verified_import_facets IS NULL) is deleted cleanly by Stage 4
    const failCommitId = 'fail-commit-2'
    accountDb.sqlite.prepare('DELETE FROM account_space_items WHERE id = ?').run('sp-b')
    accountDb.sqlite.prepare(`
        INSERT INTO account_space_items (
            id, item_key, account_id, note_path, note_uid, access_level,
            facets, user_facets, verified_import_facets, editor_format, title_summary,
            status, import_batch_id, pending_import_commit_id, pending_import_facets,
            last_activity_at, created_at, updated_at
        ) VALUES ('sp-fail', 'ik-fail', ?, 'split-b', ?, 'share_only', '[]', NULL, NULL, 'markdown', 'Split B', 'pending_import', 'b2', ?, '["bookmarked"]', ?, ?, ?)
    `).run(accountId, noteB.noteUid, failCommitId, now, now, now)
    accountDb.sqlite.prepare(
        'INSERT INTO pending_import_finalizations (commit_id, account_id, candidates_json, created_at) VALUES (?, ?, ?, ?)'
    ).run(failCommitId, accountId, JSON.stringify([candidates[1]]), now)

    await finalizePendingImportCommit(env, { commitId: failCommitId, accountId, candidates: [candidates[1]] })
    assert.equal(accountDb.sqlite.prepare('SELECT COUNT(*) AS c FROM account_space_items WHERE id = ?').get('sp-fail').c, 0)

    // 3. Concurrent explicit bookmark during Stage 3 lock preserves user_facets without altering pending_import_commit_id
    accountDb.sqlite.prepare("UPDATE account_space_items SET pending_import_commit_id = 'inflight-3', pending_import_facets = '[\"edited\"]' WHERE id = 'sp-a'").run()
    await upsertSpaceActivity({
        env,
        accountId,
        notePath: 'split-a',
        noteUid: noteA.noteUid,
        accessLevel: 'edit',
        facet: 'bookmarked',
    })
    const duringLock = accountDb.sqlite.prepare('SELECT pending_import_commit_id, user_facets, facets FROM account_space_items WHERE id = ?').get('sp-a')
    assert.equal(duringLock.pending_import_commit_id, 'inflight-3')
    assert.deepEqual(JSON.parse(duringLock.user_facets), ['bookmarked'])
    assert.deepEqual(JSON.parse(duringLock.facets).sort(), ['bookmarked', 'created'])

    // 4. Overlapping import against locked row skips locked row cleanly
    const overlapRes = await commitGuestHistoryImport(req('/api/space/import', { method: 'POST' }), env, accountId, {
        items: [{ url: `${ORIGIN}/share/${noteA.shareId}`, source: 'viewed' }],
    })
    assert.equal(overlapRes.importedCount, 0)
    assert.equal(overlapRes.unavailableCount, 1)

    // 5. Full end-to-end split-DB commitGuestHistoryImport + stale unlocked pending_import reclamation
    const noteC = await commitAuthoritativeNoteWrite({
        path: 'split-c',
        content: 'C',
        nextMetadata: { share: true, title: 'Split C' },
        isNewNote: true,
        env,
    })
    accountDb.sqlite.prepare(`
        INSERT INTO account_space_items (
            id, item_key, account_id, note_path, note_uid, access_level,
            facets, user_facets, verified_import_facets, editor_format, title_summary,
            status, import_batch_id, pending_import_commit_id, pending_import_facets,
            last_activity_at, created_at, updated_at
        ) VALUES ('sp-stale', 'ik-stale', ?, 'stale-p', 'stale-u', 'share_only', '[]', NULL, NULL, 'markdown', 'Stale', 'pending_import', 'old-b', NULL, NULL, ?, ?, ?)
    `).run(accountId, now - 300, now - 300, now - 300)

    const e2eRes = await commitGuestHistoryImport(req('/api/space/import', { method: 'POST' }), env, accountId, {
        items: [{ url: `${ORIGIN}/share/${noteC.shareId}`, source: 'created' }],
    })
    assert.equal(e2eRes.importedCount, 1)
    assert.equal(accountDb.sqlite.prepare("SELECT COUNT(*) AS c FROM account_space_items WHERE id = 'sp-stale'").get().c, 0)
    const rowC = accountDb.sqlite.prepare("SELECT status, access_level, verified_import_facets FROM account_space_items WHERE note_path = 'split-c'").get()
    assert.equal(rowC.status, 'active')
    assert.equal(rowC.access_level, 'share_only')
    assert.deepEqual(JSON.parse(rowC.verified_import_facets), ['created'])
})

test('DELETE /api/account/annotations/:messageId self-deletes owned message only and rejects unowned with 404', async () => {
    const { accountDb, env } = makeSpaceEnv()
    const { accountId: aliceId, cookie: aliceCookie } = seedAccountAndSession(accountDb, { accountId: 'acc-alice', sessionId: 'sess-alice-1234567890' })
    const { accountId: bobId, cookie: bobCookie } = seedAccountAndSession(accountDb, { accountId: 'acc-bob', nickname: 'Bob', sessionId: 'sess-bob-1234567890' })

    const note = await commitAuthoritativeNoteWrite({
        path: 'ann-note',
        content: 'Paragraph text',
        nextMetadata: { share: true, title: 'Annotated Note' },
        isNewNote: true,
        env,
    })

    const now = Math.floor(Date.now() / 1000)
    accountDb.sqlite.prepare(`
        INSERT INTO annotation_threads (id, path, quote_exact, quote_prefix, quote_suffix, start_offset, end_offset, source_revision, is_resolved, created_at, updated_at)
        VALUES ('thr-1', 'ann-note', 'Paragraph', '', '', 0, 9, 'rev1', 0, ?, ?)
    `).run(now, now)
    accountDb.sqlite.prepare(`
        INSERT INTO annotation_messages (id, thread_id, author_name, body, created_at, deleted_at)
        VALUES
        ('msg-alice', 'thr-1', 'Alice', 'Root comment', ?, NULL),
        ('msg-bob-reply', 'thr-1', 'Bob', 'Reply comment', ?, NULL)
    `).run(now, now + 1)
    accountDb.sqlite.prepare(`
        INSERT INTO account_annotation_links (message_id, thread_id, account_id, note_path, note_uid, share_id, created_at)
        VALUES
        ('msg-alice', 'thr-1', ?, 'ann-note', ?, ?, ?),
        ('msg-bob-reply', 'thr-1', ?, 'ann-note', ?, ?, ?)
    `).run(aliceId, note.noteUid, note.shareId, now, bobId, note.noteUid, note.shareId, now + 1)

    // Bob cannot delete Alice's message -> 404
    const forbiddenDel = await handleAccountRoutes(req('/api/account/annotations/msg-alice', {
        method: 'DELETE',
        cookie: bobCookie,
        body: {},
    }), env)
    assert.equal(forbiddenDel.status, 404)

    // Alice lists her annotations via GET /api/account/annotations (without note_path leak)
    const listAnn = await (await handleAccountRoutes(req('/api/account/annotations', { method: 'GET', cookie: aliceCookie }), env)).json()
    assert.equal(listAnn.annotations.length, 1)
    assert.equal(listAnn.annotations[0].messageId, 'msg-alice')
    assert.equal(listAnn.annotations[0].notePath, undefined)
    assert.equal(listAnn.annotations[0].shareId, note.shareId)

    // Alice deletes her own message -> Bob's reply remains intact!
    const okDel = await handleAccountRoutes(req('/api/account/annotations/msg-alice', {
        method: 'DELETE',
        cookie: aliceCookie,
        body: {},
    }), env)
    assert.equal(okDel.status, 200)

    const aliceMsg = accountDb.sqlite.prepare('SELECT deleted_at FROM annotation_messages WHERE id = ?').get('msg-alice')
    assert.ok(aliceMsg.deleted_at > 0)
    const bobReply = accountDb.sqlite.prepare('SELECT deleted_at FROM annotation_messages WHERE id = ?').get('msg-bob-reply')
    assert.equal(bobReply.deleted_at, null)
})

test('user-owned note_path / manual URL import restores edit access with cookie or unpassworded proof and masks protected notes', async () => {
    const { accountDb, env } = makeSpaceEnv({ splitDb: false })
    const { accountId, cookie } = seedAccountAndSession(accountDb)
    const { MD5 } = await import('../src/helper.js')

    const ownedLocked = await commitAuthoritativeNoteWrite({
        path: 'owned-pw-note',
        content: 'Owner Secret',
        nextMetadata: { share: true, pw: 'edit-hash', vpw: 'view-hash', title: 'Owned Locked' },
        isNewNote: true,
        env,
    })
    const openNote = await commitAuthoritativeNoteWrite({
        path: 'open-slug-note',
        content: 'Open Slug',
        nextMetadata: { share: true, title: 'Open Slug Note' },
        isNewNote: true,
        env,
    })
    const draftNote = await commitAuthoritativeNoteWrite({
        path: 'unpublished-draft',
        content: 'Draft',
        nextMetadata: { share: false, title: 'Draft Title' },
        isNewNote: true,
        env,
    })

    const ownedAuthorJwt = await jwt.sign({ path: 'owned-pw-note', role: 'author', noteUid: ownedLocked.noteUid, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET)
    const draftAuthorJwt = await jwt.sign({ path: 'unpublished-draft', role: 'author', noteUid: draftNote.noteUid, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET)
    const ownedCookieName = 'cn_author_' + (await MD5('owned-pw-note')).substring(0, 16)
    const draftCookieName = 'cn_author_' + (await MD5('unpublished-draft')).substring(0, 16)
    const authorCookies = `${cookie}; ${ownedCookieName}=${ownedAuthorJwt}; ${draftCookieName}=${draftAuthorJwt}`

    const strangerPreview = await (await handleAccountRoutes(req('/api/space/import/preview', {
        method: 'POST',
        cookie,
        body: {
            items: [
                { url: `${ORIGIN}/owned-pw-note`, source: 'created' },
                { path: 'unpublished-draft', source: 'created' },
                { path: '_space', source: 'created' },
            ],
        },
    }), env)).json()
    for (const item of strangerPreview.items) {
        assert.equal(item.eligible, false)
        assert.equal(item.status, 'unavailable')
        assert.equal(item.title, 'Unavailable or Protected Note')
    }

    const ownerPreview = await (await handleAccountRoutes(req('/api/space/import/preview', {
        method: 'POST',
        cookie: authorCookies,
        body: {
            items: [
                { url: `${ORIGIN}/owned-pw-note`, source: 'created' },
                { path: 'open-slug-note', source: 'created' },
                { path: 'unpublished-draft', source: 'created' },
            ],
        },
    }), env)).json()
    assert.equal(ownerPreview.items[0].eligible, true)
    assert.equal(ownerPreview.items[0].accessLevel, 'edit')
    assert.equal(ownerPreview.items[1].eligible, true)
    assert.equal(ownerPreview.items[1].accessLevel, 'edit')
    assert.equal(ownerPreview.items[2].eligible, false)
    assert.equal(ownerPreview.items[2].status, 'unpublished')

    const commitJson = await (await handleAccountRoutes(req('/api/space/import', {
        method: 'POST',
        cookie: authorCookies,
        body: {
            items: [
                { url: `${ORIGIN}/owned-pw-note`, source: 'created' },
                { path: 'open-slug-note', source: 'created' },
                { path: 'unpublished-draft', source: 'created' },
            ],
        },
    }), env)).json()
    assert.equal(commitJson.importedCount, 2)
    assert.equal(commitJson.unavailableCount, 1)

    const listed = await listSpaceItems({ env, accountId })
    assert.equal(listed.items.length, 2)
    assert.ok(listed.items.every(i => i.accessLevel === 'edit'))
    assert.deepEqual(listed.items.map(i => i.notePath).sort(), ['open-slug-note', 'owned-pw-note'])
})

test('legacy notes lacking metadata.titleSummary extract heading title from content during preview, import, and bookmark without breaking list zero-content rule', async () => {
    const { accountDb, notesDb, env } = makeSpaceEnv({ splitDb: false })
    const { accountId, cookie } = seedAccountAndSession(accountDb)
    const now = Math.floor(Date.now() / 1000)
    const legacyUid = 'uid-legacy-no-title-meta'
    const legacyShareId = 'legacyTitleTok123456789'

    notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('legacy-md', '# 📊 Legacy Markdown Heading\n\nBody text', JSON.stringify({ noteUid: legacyUid, metaVersion: 1, share: true, shareId: legacyShareId, shareSlug: legacyShareId }), now, now)
    notesDb.sqlite.prepare('INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at) VALUES (?, ?, ?, 1, ?)')
        .run(legacyShareId, 'legacy-md', legacyUid, now)
    notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
        .run(legacyShareId, 'legacy-md', now)

    const previewRes = await (await handleAccountRoutes(req('/api/space/import/preview', {
        method: 'POST',
        cookie,
        body: { items: [{ url: `${ORIGIN}/share/${legacyShareId}`, source: 'created' }] },
    }), env)).json()
    assert.equal(previewRes.items[0].eligible, true)
    assert.equal(previewRes.items[0].titleSummary, '📊 Legacy Markdown Heading')

    const commitRes = await (await handleAccountRoutes(req('/api/space/import', {
        method: 'POST',
        cookie,
        body: { items: [{ url: `${ORIGIN}/share/${legacyShareId}`, source: 'created' }] },
    }), env)).json()
    assert.equal(commitRes.importedCount, 1)

    const listed = await listSpaceItems({ env, accountId })
    assert.equal(listed.items.length, 1)
    assert.equal(listed.items[0].titleSummary, '📊 Legacy Markdown Heading')

    const bm = await bookmarkNoteToSpace({ env, accountId, shareId: legacyShareId })
    assert.equal(bm.item.titleSummary, '📊 Legacy Markdown Heading')
})
