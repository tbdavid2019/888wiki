import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import { handleCircleRoutes } from '../src/circle_routes.mjs'
import {
    MAX_CIRCLES_PER_ACCOUNT,
    MAX_ITEMS_PER_CIRCLE,
    SESSION_COOKIE_NAME,
    isPublicCircleNoteEligible,
    bookmarkNoteToSpace,
    upsertSpaceActivity,
} from '../src/account_data.mjs'
import { CIRCLE_CSP } from '../src/templates/circle.js'
import { commitAuthoritativeNoteWrite } from '../src/storage_driver.mjs'

const ORIGIN = 'https://wiki.example.com'
const SECRET = 'test-scn-secret-circle-123456'

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

function makeCircleEnv() {
    const db = createSqliteD1([
        'notes_d1.sql',
        'notes_registry.sql',
        'note_annotations.sql',
        'note_stats.sql',
        'accounts.sql',
    ])
    return {
        db,
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

function seedAccountAndSession(db, { accountId = 'acc-1', sessionId = 'sess-circle-1234567890' } = {}) {
    const now = Math.floor(Date.now() / 1000)
    db.sqlite.prepare('INSERT INTO accounts (id, user_handle, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(accountId, `uh-${accountId}`, 'Curator', now, now)
    db.sqlite.prepare('INSERT INTO account_sessions (id, account_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, NULL)').run(sessionId, accountId, now, now + 86400)
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

test('public circles reject Seal modes even after their lock timestamps pass', async () => {
    const { db } = makeCircleEnv()
    const now = 1700000000
    const path = 'sealed-note'
    const noteUid = 'sealed-note-uid'
    const shareId = 'sealed-note-token-123456'
    db.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)')
        .run(path, '', JSON.stringify({ noteUid, share: true }), now)
    db.sqlite.prepare('INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at) VALUES (?, ?, ?, 1, ?)')
        .run(shareId, path, noteUid, now)
    const check = () => isPublicCircleNoteEligible(db, { shareId, targetPath: path, noteUid, nowUnix: now })
    assert.equal((await check()).eligible, true)
    for (const [mode, field] of [['timelock', 'shareUnlockAt'], ['deadman', 'sharePulseDueAt']]) {
        for (const timestamp of [now - 1, now + 1]) {
            db.sqlite.prepare('UPDATE notes SET metadata = ? WHERE path = ?')
                .run(JSON.stringify({ noteUid, share: true, shareMode: mode, [field]: timestamp }), path)
            assert.deepEqual(await check(), { eligible: false, reason: mode })
        }
    }
    db.sqlite.prepare('UPDATE notes SET metadata = ? WHERE path = ?')
        .run(JSON.stringify({ noteUid, share: true, shareMode: 'burn' }), path)
    assert.deepEqual(await check(), { eligible: false, reason: 'burn' })
})

test('20 circles and 200 items atomic quotas + 409 ALREADY_IN_CIRCLE duplicate add', async () => {
    const { db, env } = makeCircleEnv()
    const { accountId, cookie } = seedAccountAndSession(db)

    // Create 20 circles (default OFF)
    let firstCircle = null
    for (let i = 0; i < MAX_CIRCLES_PER_ACCOUNT; i++) {
        const res = await handleCircleRoutes(req('/api/circles', {
            method: 'POST',
            cookie,
            body: { name: `Circle ${i}` },
        }), env)
        assert.equal(res.status, 201)
        const json = await res.json()
        assert.equal(json.circle.isEnabled, false)
        if (!firstCircle) firstCircle = json.circle
    }

    // 21st circle hits atomic quota
    const overCircleRes = await handleCircleRoutes(req('/api/circles', {
        method: 'POST',
        cookie,
        body: { name: 'Circle 21' },
    }), env)
    assert.equal(overCircleRes.status, 409)
    assert.equal((await overCircleRes.json()).code, 'QUOTA_EXCEEDED')

    // Pre-seed 199 items in firstCircle
    const now = Math.floor(Date.now() / 1000)
    const spaceStmt = db.sqlite.prepare(`
        INSERT INTO account_space_items (
            id, item_key, account_id, note_path, note_uid, access_level,
            facets, user_facets, verified_import_facets, editor_format, title_summary,
            status, last_activity_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'edit', '["created"]', '["created"]', NULL, 'markdown', 'Bulk', 'active', ?, ?, ?)
    `)
    const ciStmt = db.sqlite.prepare('INSERT INTO share_circle_items (circle_id, space_item_id, added_at) VALUES (?, ?, ?)')
    for (let i = 0; i < MAX_ITEMS_PER_CIRCLE - 1; i++) {
        spaceStmt.run(`sp-${i}`, `ik-${i}`, accountId, `p-${i}`, `u-${i}`, now, now, now)
        ciStmt.run(firstCircle.id, `sp-${i}`, now)
    }

    // Create 2 eligible CSPRNG notes
    const note200 = await commitAuthoritativeNoteWrite({
        path: 'note-200',
        content: '200th',
        nextMetadata: { share: true, title: 'Note 200' },
        isNewNote: true,
        env,
    })
    const note201 = await commitAuthoritativeNoteWrite({
        path: 'note-201',
        content: '201st',
        nextMetadata: { share: true, title: 'Note 201' },
        isNewNote: true,
        env,
    })

    const bm200 = await bookmarkNoteToSpace({ env, accountId, shareId: note200.shareId })
    const bm201 = await bookmarkNoteToSpace({ env, accountId, shareId: note201.shareId })

    // Add 200th item -> 201
    const add200 = await handleCircleRoutes(req(`/api/circles/${firstCircle.id}/items`, {
        method: 'POST',
        cookie,
        body: { itemKey: bm200.item.itemKey },
    }), env)
    assert.equal(add200.status, 201)

    // Re-adding 200th item -> 409 ALREADY_IN_CIRCLE (not 500 or 200-quota!)
    const dupAdd = await handleCircleRoutes(req(`/api/circles/${firstCircle.id}/items`, {
        method: 'POST',
        cookie,
        body: { itemKey: bm200.item.itemKey },
    }), env)
    assert.equal(dupAdd.status, 409)
    assert.equal((await dupAdd.json()).code, 'ALREADY_IN_CIRCLE')

    // Adding 201st distinct item -> 409 QUOTA_EXCEEDED
    const add201 = await handleCircleRoutes(req(`/api/circles/${firstCircle.id}/items`, {
        method: 'POST',
        cookie,
        body: { itemKey: bm201.item.itemKey },
    }), env)
    assert.equal(add201.status, 409)
    assert.equal((await add201.json()).code, 'QUOTA_EXCEEDED')
})

test('strict is_csprng_v1 = 1 rejection of legacy tokens (including 22-char pre-cutover tokens) on add & live read', async () => {
    const { db, env } = makeCircleEnv()
    const { accountId, cookie } = seedAccountAndSession(db)

    // Create an enabled circle
    const cRes = await handleCircleRoutes(req('/api/circles', {
        method: 'POST',
        cookie,
        body: { name: 'CSPRNG Only', isEnabled: true },
    }), env)
    const circle = (await cRes.json()).circle

    // Seed a 22-char legacy pre-cutover token (is_csprng_v1 = 0)
    const legacy22Token = 'LegacyPreCutover22Char'
    const now = Math.floor(Date.now() / 1000)
    const legacyUid = 'uid-legacy-22'
    db.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
        'legacy-22-path',
        'Legacy content',
        JSON.stringify({ noteUid: legacyUid, metaVersion: 1, share: true, shareSlug: legacy22Token, shareId: legacy22Token, titleSummary: 'Legacy 22' }),
        now,
    )
    db.sqlite.prepare(
        'INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at) VALUES (?, ?, ?, 0, ?)'
    ).run(legacy22Token, 'legacy-22-path', legacyUid, now)

    const spaceItem = await upsertSpaceActivity({
        env,
        accountId,
        notePath: 'legacy-22-path',
        noteUid: legacyUid,
        accessLevel: 'share_only',
        facet: 'bookmarked',
        titleSummary: 'Legacy 22',
    })

    // Reject on addCircleItem via itemKey AND via shareId
    const rej1 = await handleCircleRoutes(req(`/api/circles/${circle.id}/items`, {
        method: 'POST',
        cookie,
        body: { itemKey: spaceItem.itemKey },
    }), env)
    assert.equal(rej1.status, 400)
    assert.equal((await rej1.json()).code, 'LEGACY_TOKEN_INELIGIBLE')

    const rej2 = await handleCircleRoutes(req(`/api/circles/${circle.id}/items`, {
        method: 'POST',
        cookie,
        body: { shareId: legacy22Token },
    }), env)
    assert.equal(rej2.status, 400)
    assert.equal((await rej2.json()).code, 'LEGACY_TOKEN_INELIGIBLE')

    // Even if a legacy row were ever present in share_circle_items, live /c/:publicToken omits it
    db.sqlite.prepare('INSERT INTO share_circle_items (circle_id, space_item_id, added_at) VALUES (?, ?, ?)').run(circle.id, spaceItem.id, now)
    const pubJsonRes = await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}?format=json`), env)
    assert.equal(pubJsonRes.status, 200)
    const pubJson = await pubJsonRes.json()
    assert.equal(pubJson.items.length, 0)
})

test('instant ON/OFF 404 on GET/HEAD, token rotation, unshare/re-publish tracking, owner vs visitor view, and security headers', async () => {
    const { db, env } = makeCircleEnv()
    const { accountId, cookie } = seedAccountAndSession(db, { accountId: 'acc-secret-id' })
    const { cookie: otherCookie } = seedAccountAndSession(db, { accountId: 'acc-other', sessionId: 'sess-other-1234567890' })

    const noteEdit = await commitAuthoritativeNoteWrite({
        path: 'secret-edit-path',
        content: 'Edit body',
        nextMetadata: { share: true, title: 'Editable Circle Note' },
        isNewNote: true,
        env,
    })
    const noteShareOnly = await commitAuthoritativeNoteWrite({
        path: 'secret-other-author-path',
        content: 'Other body',
        nextMetadata: { share: true, title: 'Shared Circle Note' },
        isNewNote: true,
        env,
    })

    const spEdit = await upsertSpaceActivity({
        env,
        accountId,
        notePath: 'secret-edit-path',
        noteUid: noteEdit.noteUid,
        accessLevel: 'edit',
        facet: 'created',
        titleSummary: 'Editable Circle Note',
    })
    const bmShareOnly = await bookmarkNoteToSpace({ env, accountId, shareId: noteShareOnly.shareId })

    // Create circle (starts OFF)
    const cRes = await handleCircleRoutes(req('/api/circles', {
        method: 'POST',
        cookie,
        body: { name: 'Reading List' },
    }), env)
    const circle = (await cRes.json()).circle

    await handleCircleRoutes(req(`/api/circles/${circle.id}/items`, { method: 'POST', cookie, body: { itemKey: spEdit.itemKey } }), env)
    await handleCircleRoutes(req(`/api/circles/${circle.id}/items`, { method: 'POST', cookie, body: { itemKey: bmShareOnly.item.itemKey } }), env)

    // When OFF: GET & HEAD /c/:publicToken return 404 for anonymous AND even normal owner request without ?preview=1
    assert.equal((await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}`, { method: 'GET' }), env)).status, 404)
    const headOff = await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}`, { method: 'HEAD' }), env)
    assert.equal(headOff.status, 404)
    assert.equal(await headOff.text(), '')
    assert.equal((await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}`, { method: 'GET', headers: { Cookie: cookie } }), env)).status, 404)

    // Owner preview (?preview=1 with owner session) returns 200 while non-owner ?preview=1 gets 404
    const ownerPrev = await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}?preview=1`, { headers: { Cookie: cookie } }), env)
    assert.equal(ownerPrev.status, 200)
    assert.equal((await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}?preview=1`, { headers: { Cookie: otherCookie } }), env)).status, 404)

    // Toggle ON -> immediate 200 with strict headers & zero account_id / note_path leaks
    await handleCircleRoutes(req(`/api/circles/${circle.id}`, { method: 'PATCH', cookie, body: { isEnabled: true } }), env)
    const pubHtmlRes = await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}`, { method: 'GET' }), env)
    assert.equal(pubHtmlRes.status, 200)
    assert.equal(pubHtmlRes.headers.get('Cache-Control'), 'no-store')
    assert.equal(pubHtmlRes.headers.get('X-Robots-Tag'), 'noindex, nofollow')
    assert.equal(pubHtmlRes.headers.get('Referrer-Policy'), 'no-referrer')
    assert.equal(pubHtmlRes.headers.get('Content-Security-Policy'), CIRCLE_CSP)
    const html = await pubHtmlRes.text()
    assert.doesNotMatch(html, /acc-secret-id/)
    assert.doesNotMatch(html, /secret-edit-path/)
    assert.doesNotMatch(html, /secret-other-author-path/)
    assert.match(html, new RegExp(noteEdit.shareId))
    assert.match(html, new RegExp(noteShareOnly.shareId))

    const headOn = await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}`, { method: 'HEAD' }), env)
    assert.equal(headOn.status, 200)
    assert.equal(await headOn.text(), '')

    // Lock noteShareOnly with vpw and unshare noteEdit -> public view omits both, owner view shows uniform hidden label for share_only vs exact reason for edit
    const vpwUpdate = await commitAuthoritativeNoteWrite({
        path: 'secret-other-author-path',
        content: 'Other body',
        nextMetadata: { ...noteShareOnly.metadata, vpw: 'secret-view' },
        expectedNoteUid: noteShareOnly.noteUid,
        expectedMetaVersion: noteShareOnly.metaVersion,
        env,
    })
    const unshareUpdate = await commitAuthoritativeNoteWrite({
        path: 'secret-edit-path',
        content: 'Edit body',
        nextMetadata: { ...noteEdit.metadata, share: false },
        expectedNoteUid: noteEdit.noteUid,
        expectedMetaVersion: noteEdit.metaVersion,
        env,
    })

    const pubAfterHide = await (await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}?format=json`), env)).json()
    assert.equal(pubAfterHide.items.length, 0)

    const ownerDetail = await (await handleCircleRoutes(req(`/api/circles/${circle.id}`, { method: 'GET', cookie }), env)).json()
    const editDetail = ownerDetail.items.find(i => i.itemKey === spEdit.itemKey)
    const shareOnlyDetail = ownerDetail.items.find(i => i.itemKey === bmShareOnly.item.itemKey)
    assert.equal(editDetail.available, false)
    assert.equal(editDetail.reasonBadge, 'unshared')
    assert.equal(shareOnlyDetail.available, false)
    assert.equal(shareOnlyDetail.masked, true)
    assert.equal(shareOnlyDetail.reasonBadge, 'Hidden (currently unavailable)')

    // Re-publish noteEdit (same noteUid, fresh CSPRNG share token) -> public circle automatically restores visibility under new token!
    const republish = await commitAuthoritativeNoteWrite({
        path: 'secret-edit-path',
        content: 'Edit body',
        nextMetadata: { ...unshareUpdate.metadata, share: true },
        expectedNoteUid: unshareUpdate.noteUid,
        expectedMetaVersion: unshareUpdate.metaVersion,
        shareAction: 'republish',
        env,
    })
    assert.notEqual(republish.shareId, noteEdit.shareId)
    void vpwUpdate

    const pubAfterRepublish = await (await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}?format=json`), env)).json()
    assert.equal(pubAfterRepublish.items.length, 1)
    assert.equal(pubAfterRepublish.items[0].shareId, republish.shareId)
    assert.equal(pubAfterRepublish.circle.account_id, undefined)

    // Rotate circle public_token -> old token 404, new token preserves items!
    const rotRes = await handleCircleRoutes(req(`/api/circles/${circle.id}/rotate`, { method: 'POST', cookie, body: {} }), env)
    assert.equal(rotRes.status, 200)
    const rotated = (await rotRes.json()).circle
    assert.notEqual(rotated.publicToken, circle.publicToken)

    assert.equal((await handleCircleRoutes(new Request(`${ORIGIN}/c/${circle.publicToken}`), env)).status, 404)
    const newCircleRes = await (await handleCircleRoutes(new Request(`${ORIGIN}/c/${rotated.publicToken}?format=json`), env)).json()
    assert.equal(newCircleRes.items.length, 1)
    assert.equal(newCircleRes.items[0].shareId, republish.shareId)
})
