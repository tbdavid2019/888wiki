import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import jwt from '@tsndr/cloudflare-worker-jwt'

import worker, { runScheduledCleanup } from '../src/index.js'
import { handleMcpRequest } from '../src/mcp_server.mjs'
import { MD5, deleteEmptyPages } from '../src/helper.js'
import {
    claimLegacyD1NoteUid,
    commitAuthoritativeNoteWrite,
    driverDeleteNote,
    driverListNotes,
    driverQueryNote,
    getAccountDb,
    getStorageDb,
    isAccountFeatureEnabled,
    isAuthorityModeRequired,
    isCanonicalShareToken,
    isNotesRegistryEnabled,
    resolveAuthoritativeShare,
    resolveAuthoritativeShareMetadata,
    resolveLegacyToken,
} from '../src/storage_driver.mjs'

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

function createKvMap() {
    const map = new Map()
    const deletedKeys = []
    return {
        map,
        deletedKeys,
        async get(k) {
            const v = map.get(k)
            return v === undefined ? null : (typeof v === 'string' ? v : v.value)
        },
        async getWithMetadata(k) {
            return map.get(k) || { value: null, metadata: null }
        },
        async put(k, value, opts = {}) {
            if (opts && Object.prototype.hasOwnProperty.call(opts, 'metadata')) {
                map.set(k, { value, metadata: opts.metadata || {} })
            } else {
                map.set(k, value)
            }
        },
        async delete(k) {
            deletedKeys.push(k)
            map.delete(k)
        },
        async list() {
            return {
                keys: Array.from(map.entries()).map(([name, item]) => ({
                    name,
                    metadata: typeof item === 'object' && item !== null ? (item.metadata || {}) : {},
                })),
                list_complete: true,
            }
        },
    }
}

function decodeJwtPayload(token) {
    const decoded = jwt.decode(token)
    return decoded?.payload || decoded
}

function extractCookieValue(setCookieHeader, name) {
    if (!setCookieHeader) return null
    const match = String(setCookieHeader).match(new RegExp(`(?:^|,)\\s*${name}=([^;]+)`))
    return match ? decodeURIComponent(match[1]) : null
}

const ALL_ENV_KEYS = [
    'SCN_STORAGE_DRIVER',
    'SCN_NOTES_DB_BINDING',
    'SCN_REQUIRE_NOTES_REGISTRY',
    'SCN_MAINTENANCE_MODE',
    'SCN_SECRET',
    'SCN_SALT',
    'SCN_ADMIN_PW',
    'SCN_ADMIN_PATH',
    'SCN_ENABLE_NOTE_HISTORY',
    'SCN_LEGACY_HISTORY_RETENTION_DAYS',
    'SCN_ENABLE_TURNSTILE',
    'SCN_TURNSTILE_SITE_KEY',
    'SCN_TURNSTILE_SECRET',
    'SCN_ENABLE_R2',
    'NOTES',
    'SHARE',
    'IMAGES',
    'NOTES_DB',
    'NOTE_HISTORY_DB',
    'DB',
    'APP_DB',
]

function cleanupGlobals() {
    for (const k of ALL_ENV_KEYS) delete globalThis[k]
}

test('Task 2.2: binding helpers honor pinned SCN_NOTES_DB_BINDING, decoupled account readiness, fail-closed authority, and one-way cutover', async () => {
    const notesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
    const historyDb = createSqliteD1(['note_history.sql', 'note_history_meta.sql'])
    const appDb = createSqliteD1(['accounts.sql', 'note_annotations.sql', 'note_stats.sql'])

    try {
        // 1. Pinned SCN_NOTES_DB_BINDING has zero cross-DB fallback when missing
        const envMissingPinned = {
            SCN_NOTES_DB_BINDING: 'NOTES_DB',
            NOTE_HISTORY_DB: historyDb,
            DB: notesDb,
        }
        assert.equal(getStorageDb(envMissingPinned), null)
        assert.equal(isAuthorityModeRequired(envMissingPinned), true)
        assert.equal(isNotesRegistryEnabled(envMissingPinned), false)

        // Worker fails closed 503 STORAGE_UNAVAILABLE when pinned binding is missing even if NOTE_HISTORY_DB / DB / NOTES KV exist
        const notesKv = createKvMap()
        await notesKv.put('kv-note', '# KV fallback should not be served', { metadata: { share: true } })
        const resMissingPinned = await worker.fetch(new Request('https://wiki.david888.com/kv-note'), {
            ...envMissingPinned,
            SCN_STORAGE_DRIVER: 'auto',
            NOTES: notesKv,
        }, { waitUntil: () => {} })
        assert.equal(resMissingPinned.status, 503)
        const missingPinnedJson = await resMissingPinned.json()
        assert.equal(missingPinnedJson.code, 'STORAGE_UNAVAILABLE')
        cleanupGlobals()

        // Invalid SCN_NOTES_DB_BINDING name fails closed
        assert.equal(getStorageDb({ SCN_NOTES_DB_BINDING: 'APP_DB', APP_DB: appDb, NOTES_DB: notesDb }), null)

        // 2. Missing accountDb disables ONLY account feature, leaving isNotesRegistryEnabled ON
        const envNoAccount = {
            SCN_STORAGE_DRIVER: 'auto',
            SCN_NOTES_DB_BINDING: 'NOTES_DB',
            NOTES_DB: notesDb,
        }
        assert.equal(getAccountDb(envNoAccount), null)
        assert.equal(isNotesRegistryEnabled(envNoAccount), true)
        assert.equal(isAccountFeatureEnabled(envNoAccount), false)

        // With APP_DB matching annotationDb, account feature is enabled
        const envWithAccount = {
            ...envNoAccount,
            APP_DB: appDb,
        }
        assert.equal(getAccountDb(envWithAccount), appDb)
        assert.equal(isAccountFeatureEnabled(envWithAccount), true)

        // 3. Missing registry schema on notesDb fails closed 503 D1_SCHEMA_MISSING (never falls back to KV)
        const emptyDb = createSqliteD1([])
        const resMissingSchema = await worker.fetch(new Request('https://wiki.david888.com/kv-note'), {
            SCN_STORAGE_DRIVER: 'auto',
            SCN_NOTES_DB_BINDING: 'NOTES_DB',
            NOTES_DB: emptyDb,
            NOTES: notesKv,
        }, { waitUntil: () => {} })
        assert.equal(resMissingSchema.status, 503)
        const schemaJson = await resMissingSchema.json()
        assert.equal(schemaJson.code, 'D1_SCHEMA_MISSING')
        cleanupGlobals()

        // 4. One-way cutover: SCN_REQUIRE_NOTES_REGISTRY=1 with SCN_STORAGE_DRIVER=kv fails closed 503 STORAGE_UNAVAILABLE
        const resDowngrade = await worker.fetch(new Request('https://wiki.david888.com/kv-note'), {
            SCN_STORAGE_DRIVER: 'kv',
            SCN_REQUIRE_NOTES_REGISTRY: '1',
            NOTES: notesKv,
        }, { waitUntil: () => {} })
        assert.equal(resDowngrade.status, 503)
        const downgradeJson = await resDowngrade.json()
        assert.equal(downgradeJson.code, 'STORAGE_UNAVAILABLE')
        cleanupGlobals()

        // 5. Runtime D1 error fails closed 503 (never falls back to KV when isNotesRegistryEnabled is true)
        const brokenNotesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
        brokenNotesDb.sqlite.exec('DROP TABLE notes')
        const validSchemaHeaderCheck = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
        // Force table-check bypass by dropping after first check
        await driverQueryNote('warmup', { SCN_STORAGE_DRIVER: 'auto', NOTES_DB: validSchemaHeaderCheck, NOTES: notesKv })
        validSchemaHeaderCheck.sqlite.exec('DROP TABLE notes')
        await assert.rejects(
            () => driverQueryNote('kv-note', { SCN_STORAGE_DRIVER: 'auto', NOTES_DB: validSchemaHeaderCheck, NOTES: notesKv }),
            err => err.status === 503 && err.code === 'STORAGE_UNAVAILABLE',
        )
        cleanupGlobals()

        // 6. driverDeleteNote respects SCN_STORAGE_DRIVER === 'kv' and never touches D1
        const untouchedD1 = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
        untouchedD1.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
            'keep-d1',
            'Keep me',
            JSON.stringify({ noteUid: 'uid-keep' }),
            1000,
        )
        await notesKv.put('keep-d1', 'KV copy', { metadata: {} })
        await driverDeleteNote('keep-d1', {
            env: { SCN_STORAGE_DRIVER: 'kv', NOTES_DB: untouchedD1, NOTES: notesKv },
        })
        assert.equal(notesKv.map.has('keep-d1'), false)
        assert.ok(untouchedD1.sqlite.prepare("SELECT path FROM notes WHERE path = 'keep-d1'").get())
    } finally {
        cleanupGlobals()
    }
})

test('Task 2.2: alias retirement & canonical token validation across both pure-KV and D1-registry modes', async () => {
    for (const mode of ['kv', 'd1']) {
        const notesKv = createKvMap()
        const shareKv = createKvMap()
        const notesDb = mode === 'd1' ? createSqliteD1(['notes_d1.sql', 'notes_registry.sql']) : undefined
        const env = {
            SCN_STORAGE_DRIVER: mode,
            SCN_SECRET: 'alias-test-secret',
            NOTES: notesKv,
            SHARE: shareKv,
            ...(notesDb ? { NOTES_DB: notesDb } : {}),
        }
        const ctx = { waitUntil: () => {} }

        try {
            // 1. Seed pre-existing legacy SHARE KV aliases (path, MD5(path), ${path}-123, 8-char non-canonical)
            const targetPath = 'abcdef' // 6-char path matching /^[A-Za-z0-9]{6}$/!
            const md5Alias = await MD5(targetPath)
            await notesKv.put(targetPath, '# Secret Note', { metadata: { share: true, shareSlug: 'Valid6' } })
            await shareKv.put(targetPath, targetPath) // path alias
            await shareKv.put(md5Alias, targetPath) // MD5(path) alias
            await shareKv.put(`${targetPath}-1234`, targetPath) // path-* alias
            await shareKv.put('noncan88', targetPath) // 8-char non-canonical token
            await shareKv.put('Valid6', targetPath)

            if (notesDb) {
                notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
                    targetPath,
                    '# Secret Note',
                    JSON.stringify({ share: true, shareSlug: 'Valid6', shareId: 'Valid6', noteUid: 'uid-v6', metaVersion: 1 }),
                    1000,
                )
                notesDb.sqlite.prepare('INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at) VALUES (?, ?, ?, 0, ?)').run(
                    'Valid6',
                    targetPath,
                    'uid-v6',
                    1000,
                )
                notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run('Valid6', targetPath, 1000)
                notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run(targetPath, targetPath, 1000)
                notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run(md5Alias, targetPath, 1000)
            }

            // Path and non-canonical aliases MUST 404 across share routes & ai-assistant; MD5(path) stays backwards-compatible by default
            for (const badToken of [targetPath, `${targetPath}-1234`, 'noncan88']) {
                const resShare = await worker.fetch(new Request(`https://wiki.david888.com/share/${badToken}`), env, ctx)
                assert.equal(resShare.status, 404, `[${mode}] /share/${badToken} must 404`)

                const resAi = await worker.fetch(new Request(`https://wiki.david888.com/api/shares/${badToken}/ai-assistant`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: 'hi', mode: 'ask' }),
                }), env, ctx)
                assert.equal(resAi.status, 404, `[${mode}] /api/shares/${badToken}/ai-assistant must 404`)
            }

            const resMd5Compat = await worker.fetch(new Request(`https://wiki.david888.com/share/${md5Alias}`), env, ctx)
            assert.equal(resMd5Compat.status, 200, `[${mode}] /share/${md5Alias} should remain backwards-compatible by default`)

            // Valid 6-char canonical token resolves
            const resOk = await worker.fetch(new Request('https://wiki.david888.com/share/Valid6'), env, ctx)
            assert.equal(resOk.status, 200)

            // 2. Publishing a new note via POST /api/:path writes ONLY 22-char CSPRNG token (zero path/MD5 aliases)
            const pubRes = await worker.fetch(new Request('https://wiki.david888.com/api/fresh-pub-note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '# Fresh Pub', share: true }),
            }), env, ctx)
            assert.equal(pubRes.status, 200)
            const pubJson = await pubRes.json()
            const mintedSlug = pubJson.data.shareUrl.split('/share/')[1]
            assert.match(mintedSlug, /^[A-Za-z0-9_-]{22}$/)

            const freshMd5 = await MD5('fresh-pub-note')
            assert.equal(shareKv.map.has('fresh-pub-note'), false)
            assert.equal(shareKv.map.has(freshMd5), false)
            assert.equal(shareKv.map.get(mintedSlug), 'fresh-pub-note')

            // 3. MCP write_note writes ONLY canonical 22-char token
            const mcpRes = await handleMcpRequest(new Request('https://wiki.david888.com/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/call',
                    params: { name: 'write_note', arguments: { path: 'mcp-alias-check', text: '# MCP Alias' } },
                }),
            }))
            const mcpJson = await mcpRes.json()
            assert.equal(mcpJson.result.isError, false)
            const mcpMd5 = await MD5('mcp-alias-check')
            assert.equal(shareKv.map.has('mcp-alias-check'), false)
            assert.equal(shareKv.map.has(mcpMd5), false)
        } finally {
            cleanupGlobals()
        }
    }
})

test('Task 2.2: bidirectional noteUid validation on auth, cn_author_*, and R2 /upload across D1 and KV modes', async () => {
    const { saltPw } = await import('../src/helper.js')

    for (const mode of ['d1', 'kv']) {
        const notesKv = createKvMap()
        const shareKv = createKvMap()
        const notesDb = mode === 'd1' ? createSqliteD1(['notes_d1.sql', 'notes_registry.sql']) : undefined
        const images = { async put() {} }
        const env = {
            SCN_STORAGE_DRIVER: mode,
            SCN_SECRET: 'uid-cookie-secret',
            SCN_SALT: 'uid-cookie-salt',
            SCN_ENABLE_R2: '1',
            NOTES: notesKv,
            SHARE: shareKv,
            IMAGES: images,
            ...(notesDb ? { NOTES_DB: notesDb } : {}),
        }
        const ctx = { waitUntil: () => {} }

        try {
            globalThis.SCN_SALT = env.SCN_SALT
            const editHash = await saltPw('edit-123')
            const viewHash = await saltPw('view-123')
            const shareTok = 'TokUidCookie1234567890'

            const meta1 = { share: true, shareSlug: shareTok, shareId: shareTok, noteUid: 'uid-gen-1', metaVersion: 1, pw: editHash, vpw: viewHash }
            if (notesDb) {
                notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run('aba-note', '# Gen 1', JSON.stringify(meta1), 1000)
                notesDb.sqlite.prepare('INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at) VALUES (?, ?, ?, 1, ?)').run(shareTok, 'aba-note', 'uid-gen-1', 1000)
                notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run(shareTok, 'aba-note', 1000)
            } else {
                await notesKv.put('aba-note', '# Gen 1', { metadata: meta1 })
                await shareKv.put(shareTok, 'aba-note')
            }

            // 1. Direct /:path/auth mints noteUid in auth JWT
            const directAuthRes = await worker.fetch(new Request('https://wiki.david888.com/aba-note/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passwd: 'edit-123' }),
            }), env, ctx)
            assert.equal(directAuthRes.status, 200)
            const editToken = extractCookieValue(directAuthRes.headers.get('Set-Cookie'), 'auth')
            const editPayload = decodeJwtPayload(editToken)
            assert.equal(editPayload.noteUid, 'uid-gen-1')
            assert.equal(editPayload.path, 'aba-note')

            // 2. GET /:path with valid edit JWT mints noteUid in cn_author_* cookie
            const directGetOk = await worker.fetch(new Request('https://wiki.david888.com/aba-note', {
                headers: { Cookie: `auth=${editToken}` },
            }), env, ctx)
            assert.equal(directGetOk.status, 200)
            const authorCookieName = 'cn_author_' + (await MD5('aba-note')).substring(0, 16)
            const authorToken = extractCookieValue(directGetOk.headers.get('Set-Cookie'), authorCookieName)
            assert.equal(decodeJwtPayload(authorToken).noteUid, 'uid-gen-1')

            // 3. R2 /upload accepts valid edit auth cookie
            const form1 = new FormData()
            form1.append('image', new Blob(['pngdata'], { type: 'image/png' }), 'pic.png')
            const uploadOk = await worker.fetch(new Request('https://wiki.david888.com/upload', {
                method: 'POST',
                headers: { Cookie: `auth=${editToken}` },
                body: form1,
            }), env, ctx)
            assert.equal(uploadOk.status, 200)

            // 4. Legacy UID-less JWT is rejected against UID-bearing note
            const legacyNoUidJwt = await jwt.sign({ path: 'aba-note', role: 'edit', exp: Math.floor(Date.now() / 1000) + 3600 }, env.SCN_SECRET)
            const resLegacyCookie = await worker.fetch(new Request('https://wiki.david888.com/aba-note', {
                headers: { Cookie: `auth=${legacyNoUidJwt}` },
            }), env, ctx)
            const legacyHtml = await resLegacyCookie.text()
            assert.doesNotMatch(legacyHtml, /"isEdit":true/)
            assert.match(legacyHtml, /passwd/i)

            // 5. Simulate delete + recreate (new UID in D1, or UID-less replacement in KV) -> stale UID cookie rejected everywhere!
            if (notesDb) {
                notesDb.sqlite.prepare('UPDATE notes SET metadata = ? WHERE path = ?').run(
                    JSON.stringify({ ...meta1, noteUid: 'uid-gen-2', metaVersion: 2 }),
                    'aba-note',
                )
            } else {
                // UID-less KV replacement note
                await notesKv.put('aba-note', '# Replacement UID-less', { metadata: { share: true, shareSlug: shareTok, pw: editHash, vpw: viewHash } })
            }

            // Stale editToken fails on direct /:path
            const resStaleEdit = await worker.fetch(new Request('https://wiki.david888.com/aba-note', {
                headers: { Cookie: `auth=${editToken}` },
            }), env, ctx)
            const staleEditHtml = await resStaleEdit.text()
            assert.doesNotMatch(staleEditHtml, /"isEdit":true/)
            assert.match(staleEditHtml, /passwd/i)

            // Stale cn_author_* fails isNoteAuthor on /share/:shareId (does not leak note_path in markdown)
            const shareTok2 = notesDb ? 'TokUidCookieGen2_123456' : shareTok
            if (notesDb) {
                notesDb.sqlite.prepare('UPDATE notes SET metadata = ? WHERE path = ?').run(
                    JSON.stringify({ ...meta1, shareSlug: shareTok2, shareId: shareTok2, noteUid: 'uid-gen-2', metaVersion: 2 }),
                    'aba-note',
                )
                notesDb.sqlite.prepare('INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at) VALUES (?, ?, ?, 1, ?)').run(
                    shareTok2, 'aba-note', 'uid-gen-2', 2000,
                )
                notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run(shareTok2, 'aba-note', 2000)
                // Old shareTok from deleted uid-gen-1 fails closed 404 on uid-gen-2
                const resOldShare = await worker.fetch(new Request(`https://wiki.david888.com/share/${shareTok}`), env, ctx)
                assert.equal(resOldShare.status, 404)
            }
            const resStaleAuthor = await worker.fetch(new Request(`https://wiki.david888.com/share/${shareTok2}`, {
                headers: {
                    Accept: 'text/markdown',
                    Cookie: `${authorCookieName}=${authorToken}`,
                },
            }), env, ctx)
            assert.equal(resStaleAuthor.status, 200)
            assert.doesNotMatch(await resStaleAuthor.text(), /note_path:/)

            // Stale editToken fails on R2 /upload when Turnstile enabled
            env.SCN_ENABLE_TURNSTILE = '1'
            env.SCN_TURNSTILE_SITE_KEY = 'site-k'
            env.SCN_TURNSTILE_SECRET = 'sec-k'
            const form2 = new FormData()
            form2.append('image', new Blob(['pngdata'], { type: 'image/png' }), 'pic.png')
            const uploadStale = await worker.fetch(new Request('https://wiki.david888.com/upload', {
                method: 'POST',
                headers: { Cookie: `auth=${editToken}` },
                body: form2,
            }), env, ctx)
            assert.equal(uploadStale.status, 403)
        } finally {
            cleanupGlobals()
        }
    }
})

test('Task 2.2: pure-KV mode with D1 annotation sidecar excludes annotation_thread_meta.note_uid IS NOT NULL threads', async () => {
    const notesKv = createKvMap()
    const shareKv = createKvMap()
    const annotationDb = createSqliteD1(['note_annotations.sql'])
    const env = {
        SCN_STORAGE_DRIVER: 'kv',
        SCN_SECRET: 'kv-ann-secret',
        NOTES: notesKv,
        SHARE: shareKv,
        APP_DB: annotationDb,
    }
    const ctx = { waitUntil: () => {} }

    try {
        await notesKv.put('kv-ann-note', 'Hello annotation world', { metadata: { share: true, shareSlug: 'KvAnn1' } })
        await shareKv.put('KvAnn1', 'kv-ann-note')

        const { computeSourceRevision } = await import('../src/annotation_data.mjs')
        const rev = await computeSourceRevision('Hello annotation world')

        // Seed 1 D1-UID-tagged thread (should be hidden in pure KV mode) and 1 untagged KV thread (should be visible)
        annotationDb.sqlite.prepare(`
            INSERT INTO annotation_threads (id, path, quote_exact, start_offset, end_offset, source_revision, created_at, updated_at)
            VALUES (?, ?, ?, 0, 5, ?, 100, 100)
        `).run('thread-uid', 'kv-ann-note', 'Hello', rev)
        annotationDb.sqlite.prepare(`
            INSERT INTO annotation_messages (id, thread_id, author_name, body, created_at)
            VALUES (?, ?, ?, ?, 100)
        `).run('msg-uid', 'thread-uid', 'D1User', 'Old UID thread')
        annotationDb.sqlite.prepare(`
            INSERT INTO annotation_thread_meta (thread_id, path, root_message_id, note_uid, created_at)
            VALUES (?, ?, ?, ?, 100)
        `).run('thread-uid', 'kv-ann-note', 'msg-uid', 'uid-d1-99')

        annotationDb.sqlite.prepare(`
            INSERT INTO annotation_threads (id, path, quote_exact, start_offset, end_offset, source_revision, created_at, updated_at)
            VALUES (?, ?, ?, 0, 5, ?, 200, 200)
        `).run('thread-kv', 'kv-ann-note', 'Hello', rev)
        annotationDb.sqlite.prepare(`
            INSERT INTO annotation_messages (id, thread_id, author_name, body, created_at)
            VALUES (?, ?, ?, ?, 200)
        `).run('msg-kv', 'thread-kv', 'KvUser', 'Pure KV thread')

        const listRes = await worker.fetch(new Request('https://wiki.david888.com/api/shares/KvAnn1/annotations'), env, ctx)
        assert.equal(listRes.status, 200)
        const listJson = await listRes.json()
        assert.equal(listJson.data.threads.length, 1)
        assert.equal(listJson.data.threads[0].id, 'thread-kv')

        // Replying to UID-tagged thread in pure-KV mode fails 404
        const replyTaggedRes = await worker.fetch(new Request('https://wiki.david888.com/api/shares/KvAnn1/annotations/thread-uid/messages', {
            method: 'POST',
            headers: { Origin: 'https://wiki.david888.com', 'Content-Type': 'application/json' },
            body: JSON.stringify({ authorName: 'Bob', body: 'Should fail' }),
        }), env, ctx)
        assert.equal(replyTaggedRes.status, 404)
    } finally {
        cleanupGlobals()
    }
})

test('Task 2.2: SCN_MAINTENANCE_MODE=1 fails closed 503 on all write routes & MCP mutating tools, and /api/health reports readiness', async () => {
    const notesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
    const historyDb = createSqliteD1(['note_history.sql', 'note_history_meta.sql'])
    const appDb = createSqliteD1(['accounts.sql', 'note_annotations.sql', 'note_stats.sql'])
    const notesKv = createKvMap()
    const shareKv = createKvMap()

    const env = {
        SCN_STORAGE_DRIVER: 'd1',
        SCN_NOTES_DB_BINDING: 'NOTES_DB',
        SCN_REQUIRE_NOTES_REGISTRY: '1',
        SCN_MAINTENANCE_MODE: '1',
        SCN_SECRET: 'health-secret',
        SCN_ENABLE_NOTE_HISTORY: '1',
        SCN_ENABLE_R2: '1',
        SCN_ADMIN_PATH: '/ops-panel',
        NOTES_DB: notesDb,
        NOTE_HISTORY_DB: historyDb,
        APP_DB: appDb,
        NOTES: notesKv,
        SHARE: shareKv,
    }
    const ctx = { waitUntil: () => {} }

    try {
        // Seed an empty note and a burn note
        notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
            'empty-1',
            '',
            JSON.stringify({ noteUid: 'uid-e1', metaVersion: 1 }),
            1000,
        )
        const burnTok = 'BurnMaintTok1234567890'
        notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
            'burn-maint',
            'Secret',
            JSON.stringify({ share: true, shareSlug: burnTok, shareId: burnTok, shareMode: 'burn', noteUid: 'uid-bm', metaVersion: 1 }),
            1000,
        )
        notesDb.sqlite.prepare('INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at) VALUES (?, ?, ?, 1, ?)').run(
            burnTok, 'burn-maint', 'uid-bm', 1000,
        )
        notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run(burnTok, 'burn-maint', 1000)

        // 1. /api/health passes (200) during healthy maintenance mode so cutover verification succeeds before unblocking
        const healthOk = await worker.fetch(new Request('https://wiki.david888.com/api/health'), env, ctx)
        assert.equal(healthOk.status, 200)
        const healthJson = await healthOk.json()
        assert.equal(healthJson.ok, true)
        assert.equal(healthJson.status, 'maintenance')
        assert.equal(healthJson.maintenanceMode, true)
        assert.equal(healthJson.notesRegistryEnabled, true)
        assert.equal(healthJson.accountEnabled, true)
        assert.equal(healthJson.turnstile, 'disabled')
        const healthHead = await worker.fetch(new Request('https://wiki.david888.com/api/health', { method: 'HEAD' }), env, ctx)
        assert.equal(healthHead.status, 200)
        assert.equal(await healthHead.text(), '')
        assert.equal((await worker.fetch(new Request('https://wiki.david888.com/icon.svg'), env, ctx)).status, 200)

        // 2. /api/health flags Turnstile misconfiguration & SCN_ADMIN_PATH collision & missing schema with 503
        const healthMisconf = await worker.fetch(new Request('https://wiki.david888.com/api/health'), {
            ...env,
            SCN_ENABLE_TURNSTILE: '1',
            SCN_TURNSTILE_SITE_KEY: 'only-site-key',
        }, ctx)
        assert.equal(healthMisconf.status, 503)
        const misconfJson = await healthMisconf.json()
        assert.equal(misconfJson.turnstile, 'misconfigured')
        assert.equal(misconfJson.ok, false)

        const healthCollision = await worker.fetch(new Request('https://wiki.david888.com/api/health'), {
            ...env,
            SCN_ADMIN_PATH: '/_space',
        }, ctx)
        assert.equal(healthCollision.status, 503)
        assert.equal((await healthCollision.json()).adminPath.collision, true)

        // 3. ALL HTTP/API write routes fail closed 503 MAINTENANCE_MODE
        const form = new FormData()
        form.append('t', 'Blocked write')
        const writeRequests = [
            new Request('https://wiki.david888.com/new/markdown'),
            new Request('https://wiki.david888.com/api/new-note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
            new Request('https://wiki.david888.com/api/test-maint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'hi' }) }),
            new Request('https://wiki.david888.com/test-maint', { method: 'POST', body: form }),
            new Request('https://wiki.david888.com/test-maint/setting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ share: true }) }),
            new Request('https://wiki.david888.com/test-maint/pw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passwd: 'x' }) }),
            new Request('https://wiki.david888.com/upload', { method: 'POST' }),
            new Request(`https://wiki.david888.com/share/${burnTok}/reveal`, { method: 'POST' }),
            new Request(`https://wiki.david888.com/api/shares/${burnTok}/reveal`, { method: 'POST' }),
            new Request(`https://wiki.david888.com/api/shares/${burnTok}/pulse`, { method: 'GET' }),
            new Request(`https://wiki.david888.com/api/shares/${burnTok}/annotations`, { method: 'POST', headers: { Origin: 'https://wiki.david888.com', 'Content-Type': 'application/json' }, body: '{}' }),
            new Request('https://wiki.david888.com/api/burn-maint/history/1/restore', { method: 'POST' }),
        ]

        for (const req of writeRequests) {
            const res = await worker.fetch(req, env, ctx)
            assert.equal(res.status, 503, `Expected 503 during maintenance for ${req.method} ${new URL(req.url).pathname}`)
            const body = await res.json()
            assert.equal(body.code, 'MAINTENANCE_MODE')
        }

        const readPaths = [
            `/share/${burnTok}`, `/share/${burnTok}/present`, `/share/${burnTok}/book`,
            `/share/${burnTok}/export/pdf`, `/api/shares/${burnTok}/pdf`,
            `/api/shares/${burnTok}/annotations`, '/burn-maint', '/api/burn-maint',
            '/burn-maint/export/pdf', '/api/burn-maint/pdf', '/api/burn-maint/history',
            '/api/burn-maint/history/1', '/c/public-token', '/_space', '/api/space/items', '/sitemap.xml',
        ]
        for (const path of readPaths) {
            for (const method of ['GET', 'HEAD']) {
                const res = await worker.fetch(new Request(`https://wiki.david888.com${path}`, { method }), env, ctx)
                assert.equal(res.status, 503, `${method} ${path}`)
                if (method === 'GET') assert.equal((await res.json()).code, 'MAINTENANCE_MODE')
                else assert.equal(await res.text(), '')
            }
        }
        for (const path of ['/burn-maint/auth', '/burn-maint/transcribe', '/burn-maint/ai-format']) {
            const res = await worker.fetch(new Request(`https://wiki.david888.com${path}`, { method: 'POST' }), env, ctx)
            assert.equal(res.status, 503, path)
            assert.equal((await res.json()).code, 'MAINTENANCE_MODE')
        }

        // 4. MCP mutating tools return JSON-RPC isError: true maintenance envelope
        for (const toolName of ['write_note', 'append_note', 'write_canvas', 'write_whiteboard', 'generate_canvas_from_wikilinks', 'read_note', 'read_canvas', 'read_whiteboard', 'get_view_stats']) {
            const mcpRes = await handleMcpRequest(new Request('https://wiki.david888.com/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/call',
                    params: { name: toolName, arguments: { path: 'x', text: 'y' } },
                }),
            }))
            const mcpJson = await mcpRes.json()
            assert.equal(mcpJson.result.isError, true)
            assert.match(mcpJson.result.content[0].text, /MAINTENANCE_MODE/)
        }

        // 5. deleteEmptyPages() and scheduled() skip mutations cleanly
        const delRes = await deleteEmptyPages()
        assert.equal(delRes.skipped, true)
        assert.equal(delRes.deleted, 0)
        const schedRes = await runScheduledCleanup(env)
        assert.equal(schedRes.skipped, true)
        assert.ok(notesDb.sqlite.prepare("SELECT path FROM notes WHERE path = 'empty-1'").get())
    } finally {
        cleanupGlobals()
    }
})

test('maintenance reads leave legacy notes and share registries untouched', async () => {
    const notesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
    const notesKv = createKvMap()
    const shareKv = createKvMap()
    const env = { SCN_STORAGE_DRIVER: 'auto', SCN_MAINTENANCE_MODE: '1', NOTES_DB: notesDb, NOTES: notesKv, SHARE: shareKv }
    const metadata = { share: true, shareSlug: 'Maint1' }
    notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
        'legacy-maintenance', 'legacy content', JSON.stringify(metadata), 1000,
    )
    notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run('Maint1', 'legacy-maintenance', 1000)
    await notesKv.put('legacy-kv-terminal', 'secret', { metadata: { share: true, shareSlug: 'Maint2', burned: true } })
    await shareKv.put('Maint2', 'legacy-kv-terminal')
    await shareKv.put('SHARE_STATUS:Maint3', JSON.stringify({ status: 'expired' }))

    const originalBatch = notesDb.batch
    notesDb.batch = async () => { throw new Error('maintenance read attempted a batch write') }
    const before = notesDb.sqlite.prepare('SELECT * FROM notes').all()
    const changesBefore = notesDb.sqlite.prepare('SELECT total_changes() AS count').get().count
    const ctx = { waitUntil: () => {} }
    for (const path of ['/legacy-maintenance', '/api/legacy-maintenance', '/share/Maint1', '/api/shares/Maint1/annotations']) {
        const response = await worker.fetch(new Request(`https://wiki.david888.com${path}`), env, ctx)
        assert.equal(response.status, 503, path)
        assert.equal((await response.json()).code, 'MAINTENANCE_MODE')
    }
    assert.equal((await worker.fetch(new Request('https://wiki.david888.com/api/health'), env, ctx)).status, 200)
    assert.deepEqual(await driverQueryNote('legacy-maintenance', env), { value: 'legacy content', metadata })
    assert.equal((await resolveAuthoritativeShare('Maint1', { env })).value, 'legacy content')
    assert.equal((await resolveAuthoritativeShareMetadata('Maint1', { env })).status, 'active')
    assert.equal((await resolveAuthoritativeShare('Maint2', { env })).status, 'burned')
    assert.equal((await resolveAuthoritativeShare('Maint3', { env })).status, 'expired')
    assert.deepEqual(notesDb.sqlite.prepare('SELECT * FROM notes').all(), before)
    assert.equal(notesDb.sqlite.prepare('SELECT COUNT(*) AS count FROM note_tombstones').get().count, 0)
    assert.equal(notesDb.sqlite.prepare('SELECT COUNT(*) AS count FROM share_token_registry').get().count, 0)
    assert.equal(notesDb.sqlite.prepare('SELECT COUNT(*) AS count FROM shares').get().count, 1)
    assert.equal(notesDb.sqlite.prepare('SELECT total_changes() AS count').get().count, changesBefore)

    notesDb.batch = originalBatch
    const claimed = await driverQueryNote('legacy-maintenance', { ...env, SCN_MAINTENANCE_MODE: '0' })
    assert.ok(claimed.metadata.noteUid)
    assert.equal(notesDb.sqlite.prepare('SELECT COUNT(*) AS count FROM share_token_registry').get().count, 1)
})

test('pure KV share mappings require the current unambiguous metadata token', async () => {
    const notesKv = createKvMap()
    const shareKv = createKvMap()
    const env = { SCN_STORAGE_DRIVER: 'kv', NOTES: notesKv, SHARE: shareKv }
    await shareKv.put('OldTok', 'shared-note')
    await shareKv.put('NewTok', 'shared-note')

    for (const metadata of [
        { share: true, shareSlug: 'NewTok' },
        { share: true, shareSlug: 'OldTok', shareId: 'NewTok' },
        { share: true },
        { share: true, shareSlug: 'NewTok', burned: true },
        { share: true, shareSlug: 'NewTok', shareExpiresAt: 100 },
    ]) {
        await notesKv.put('shared-note', 'secret', { metadata })
        assert.equal((await resolveAuthoritativeShare('OldTok', { env, nowUnix: 1000 })).status, 'not_found')
        assert.equal((await resolveAuthoritativeShareMetadata('OldTok', { env, nowUnix: 1000 })).status, 'not_found')
    }

    for (const [metadata, status] of [
        [{ share: true, shareSlug: 'NewTok' }, 'active'],
        [{ share: true, shareId: 'NewTok', burned: true }, 'burned'],
        [{ share: true, shareSlug: 'NewTok', shareExpiresAt: 100 }, 'expired'],
    ]) {
        await notesKv.put('shared-note', 'secret', { metadata })
        assert.equal((await resolveAuthoritativeShare('NewTok', { env, nowUnix: 1000 })).status, status)
    }
})

test('Task 2.3: CSPRNG share token minting, PK collision rollback & 3x retry, re-publish rotation, and (noteUid, metaVersion) write CAS', async () => {
    const notesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
    const notesKv = createKvMap()
    const shareKv = createKvMap()
    const env = {
        SCN_STORAGE_DRIVER: 'auto',
        SCN_SECRET: 'cas-secret',
        NOTES_DB: notesDb,
        NOTES: notesKv,
        SHARE: shareKv,
    }
    const ctx = { waitUntil: () => {} }

    try {
        // 1. Create and publish note via API -> mints 22-char CSPRNG token with is_csprng_v1 = 1
        const res1 = await worker.fetch(new Request('https://wiki.david888.com/api/cas-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '# First Pub', share: true }),
        }), env, ctx)
        assert.equal(res1.status, 200)
        const tok1 = (await res1.json()).data.shareUrl.split('/share/')[1]
        assert.match(tok1, /^[A-Za-z0-9_-]{22}$/)

        const reg1 = notesDb.sqlite.prepare('SELECT * FROM share_token_registry WHERE share_id = ?').get(tok1)
        assert.equal(reg1.is_csprng_v1, 1)
        assert.equal(reg1.revoked_at, null)

        const noteRow1 = await driverQueryNote('cas-note', env)
        assert.equal(noteRow1.metadata.metaVersion, 1)
        assert.equal(noteRow1.metadata.titleSummary, 'First Pub')

        // 2. Updating active share settings (theme) preserves tok1 without rotating token
        const setThemeRes = await worker.fetch(new Request('https://wiki.david888.com/cas-note/setting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: 'tokyo-night', share: true }),
        }), env, ctx)
        assert.equal(setThemeRes.status, 200)
        assert.equal((await setThemeRes.json()).data, tok1)

        // 3. Unsharing revokes tok1 ('unshared') & clears SHARE KV; re-publishing mints a fresh token & keeps tok1 revoked
        const unshareRes = await worker.fetch(new Request('https://wiki.david888.com/cas-note/setting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ share: false }),
        }), env, ctx)
        assert.equal(unshareRes.status, 200)
        assert.equal(shareKv.map.has(tok1), false)
        assert.equal(notesDb.sqlite.prepare('SELECT revoked_reason FROM share_token_registry WHERE share_id = ?').get(tok1).revoked_reason, 'unshared')

        const repubRes = await worker.fetch(new Request('https://wiki.david888.com/cas-note/setting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ share: true }),
        }), env, ctx)
        assert.equal(repubRes.status, 200)
        const tok2 = (await repubRes.json()).data
        assert.notEqual(tok2, tok1)
        assert.match(tok2, /^[A-Za-z0-9_-]{22}$/)

        // 4. Stale metaVersion CAS rejects concurrent write with 409 without mutating SHARE KV
        const current = await driverQueryNote('cas-note', env)
        await assert.rejects(
            () => commitAuthoritativeNoteWrite({
                path: 'cas-note',
                content: 'Stale overwrite',
                nextMetadata: { ...current.metadata, share: false },
                previousMetadata: current.metadata,
                expectedNoteUid: current.metadata.noteUid,
                expectedMetaVersion: current.metadata.metaVersion - 1,
                env,
            }),
            err => err.status === 409 && err.code === 'WRITE_CONFLICT',
        )
        assert.equal(shareKv.map.get(tok2), 'cas-note')

        // 5. PK collision on share_token_registry rolls back batch and retries up to 3x with a fresh token
        let injectedCollisions = 0
        const origBatch = notesDb.batch.bind(notesDb)
        notesDb.batch = async (stmts) => {
            if (injectedCollisions < 2 && stmts.some(s => s._sql.includes('INSERT INTO share_token_registry'))) {
                injectedCollisions += 1
                // Simulate SQLite PK collision rolling back the batch
                throw new Error('UNIQUE constraint failed: share_token_registry.share_id')
            }
            return await origBatch(stmts)
        }
        const retryRes = await commitAuthoritativeNoteWrite({
            path: 'cas-note',
            content: 'After collision retry',
            nextMetadata: { ...current.metadata, share: true },
            previousMetadata: current.metadata,
            expectedNoteUid: current.metadata.noteUid,
            expectedMetaVersion: current.metadata.metaVersion,
            shareAction: 'republish',
            env,
        })
        assert.equal(injectedCollisions, 2)
        assert.equal(retryRes.committed, true)
        assert.notEqual(retryRes.shareId, tok2)
        assert.equal(notesDb.sqlite.prepare('SELECT revoked_reason FROM share_token_registry WHERE share_id = ?').get(tok2).revoked_reason, 'republished')
    } finally {
        cleanupGlobals()
    }
})

test('Task 2.3: legacy claim batch handles concurrent race, active/mapping-less/terminal cleanup (0 shares), and cleared-mapping 410 recovery', async () => {
    const notesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
    const notesKv = createKvMap()
    const shareKv = createKvMap()
    const env = {
        SCN_STORAGE_DRIVER: 'auto',
        NOTES_DB: notesDb,
        NOTES: notesKv,
        SHARE: shareKv,
    }

    try {
        // 1. Concurrent claim race on mapping-less untagged D1 row -> winner claims, loser does 0 writes
        notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
            'legacy-active',
            '# Legacy Body',
            JSON.stringify({ share: true, shareSlug: 'LegAct' }),
            1000,
        )
        const winner = await claimLegacyD1NoteUid(notesDb, 'legacy-active', 1700000000)
        assert.equal(winner.claimed, true)
        assert.ok(winner.noteUid)
        const loser = await claimLegacyD1NoteUid(notesDb, 'legacy-active', 1700000001)
        assert.equal(loser.claimed, false)

        // '__legacy__' tombstone was inserted & shares row created & registry is_csprng_v1 = 0
        assert.ok(notesDb.sqlite.prepare("SELECT * FROM note_tombstones WHERE path = 'legacy-active' AND deleted_note_uid = '__legacy__'").get())
        assert.equal(notesDb.sqlite.prepare("SELECT path FROM shares WHERE share_id = 'LegAct'").get()?.path, 'legacy-active')
        assert.equal(notesDb.sqlite.prepare("SELECT is_csprng_v1, revoked_at FROM share_token_registry WHERE share_id = 'LegAct'").get()?.is_csprng_v1, 0)

        // 2. Terminal legacy claim variants with pre-existing stale shares rows -> 0 remaining shares rows & revoked registry!
        const terminalCases = [
            { path: 'term-exp', token: 'TrmExp', meta: { share: true, shareSlug: 'TrmExp', shareExpiresAt: 100 }, reason: 'expired' },
            { path: 'term-burned1', token: 'TrmBn1', meta: { share: true, shareSlug: 'TrmBn1', burned: true }, reason: 'burned' },
            { path: 'term-burned2', token: 'TrmBn2', meta: { share: true, shareSlug: 'TrmBn2', shareBurned: true }, reason: 'burned' },
            { path: 'term-maxviews', token: 'TrmMax', meta: { share: true, shareId: 'TrmMax', shareMode: 'burn', shareViewCount: 2, shareMaxViews: 2 }, reason: 'burned' },
            { path: 'term-noshare', token: 'TrmNoS', meta: { shareSlug: 'TrmNoS' }, reason: null }, // missing $.share!
        ]
        for (const tc of terminalCases) {
            notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
                tc.path,
                'Secret',
                JSON.stringify(tc.meta),
                1000,
            )
            notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run(tc.token, tc.path, 1000)

            const res = await claimLegacyD1NoteUid(notesDb, tc.path, 1700000000)
            assert.equal(res.claimed, true)
            assert.equal(notesDb.sqlite.prepare('SELECT COUNT(*) AS c FROM shares WHERE path = ?').get(tc.path).c, 0, `${tc.path} must have 0 remaining shares`)
            if (tc.reason) {
                const reg = notesDb.sqlite.prepare('SELECT revoked_reason, is_csprng_v1 FROM share_token_registry WHERE share_id = ?').get(tc.token)
                assert.equal(reg.revoked_reason, tc.reason)
                assert.equal(reg.is_csprng_v1, 0)
            }
        }

        // 3. Cleared-mapping pre-burned SHARE_STATUS:<shareId> recovers 410 and persists past 7-day KV TTL via '__legacy_terminal__'
        await shareKv.put('SHARE_STATUS:OldBrn', JSON.stringify({ status: 'burned', path: 'gone-note', updatedAt: 1000 }))
        const r410 = await resolveAuthoritativeShare('OldBrn', { env })
        assert.equal(r410.status, 'burned')
        // Delete KV SHARE_STATUS: to simulate 7-day TTL expiry -> D1 still returns 410!
        await shareKv.delete('SHARE_STATUS:OldBrn')
        const r410AfterTtl = await resolveAuthoritativeShare('OldBrn', { env })
        assert.equal(r410AfterTtl.status, 'burned')
        assert.equal(notesDb.sqlite.prepare("SELECT note_uid FROM share_token_registry WHERE share_id = 'OldBrn'").get()?.note_uid, '__legacy_terminal__')

        // 4. Un-backfilled KV-only non-burn note resolves transiently WITHOUT writing a D1 stub
        await notesKv.put('kv-only-pub', '# KV Pub', { metadata: { share: true, shareSlug: 'KvPub6' } })
        await shareKv.put('KvPub6', 'kv-only-pub')
        const kvRes = await resolveAuthoritativeShare('KvPub6', { env })
        assert.equal(kvRes.status, 'active')
        assert.equal(kvRes.unbackfilled, true)
        assert.equal(notesDb.sqlite.prepare("SELECT path FROM notes WHERE path = 'kv-only-pub'").get(), undefined)
    } finally {
        cleanupGlobals()
    }
})

test('Task 2.3: delete_nonce-locked D1 vs KV-only vs losing-CAS delete, zero NOTES.delete in D1 mode, tombstone-filtered list/query, and authoritative Sitemap', async () => {
    const notesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
    const notesKv = createKvMap()
    const shareKv = createKvMap()
    const env = {
        SCN_STORAGE_DRIVER: 'auto',
        SCN_SECRET: 'del-secret',
        SCN_ADMIN_PW: 'admin-pw',
        NOTES_DB: notesDb,
        NOTES: notesKv,
        SHARE: shareKv,
    }
    const ctx = { waitUntil: () => {} }

    try {
        // 1. Create D1 note + KV mirror, then delete -> zero NOTES.delete(path), tombstone created, KV suppressed
        const writeRes = await commitAuthoritativeNoteWrite({
            path: 'del-d1',
            content: '# Delete Me',
            nextMetadata: { share: true, publicIndex: true },
            previousMetadata: {},
            isNewNote: true,
            env,
        })
        assert.ok(notesKv.map.has('del-d1'))

        // Losing D1 CAS delete (mismatched noteUid) creates ZERO tombstones and leaves note intact
        const losingDel = await driverDeleteNote('del-d1', {
            noteUid: 'wrong-uid',
            expectedD1Row: true,
            env,
        })
        assert.equal(losingDel.deleted, false)
        assert.equal(losingDel.conflict, true)
        assert.equal(notesDb.sqlite.prepare("SELECT COUNT(*) AS c FROM note_tombstones WHERE path = 'del-d1'").get().c, 1) // only __legacy__ from create

        // Winning D1 delete -> removes D1 row, revokes registry, creates tombstone, NEVER calls NOTES.delete('del-d1')
        const winningDel = await driverDeleteNote('del-d1', {
            noteUid: writeRes.noteUid,
            metaVersion: writeRes.metaVersion,
            expectedD1Row: true,
            env,
        })
        assert.equal(winningDel.deleted, true)
        assert.equal(notesKv.deletedKeys.includes('del-d1'), false, 'D1 mode must NEVER call NOTES.delete(path)')
        assert.equal((await driverQueryNote('del-d1', env)).value, '')

        // 2. KV-only delete branch inserts '__legacy__' tombstone and suppresses un-UID'd KV copy without NOTES.delete(path)
        await notesKv.put('kv-only-del', 'KV Stale', { metadata: { share: true, publicIndex: true, shareSlug: 'KvDel6' } })
        const kvDel = await driverDeleteNote('kv-only-del', { expectedD1Row: false, env })
        assert.equal(kvDel.deleted, true)
        assert.equal(notesKv.deletedKeys.includes('kv-only-del'), false)
        assert.equal((await driverQueryNote('kv-only-del', env)).value, '')

        // 3. Tombstone-filtered driverListNotes suppresses deleted KV entries while keeping active ones
        await notesKv.put('kv-live', 'KV Live', { metadata: { share: true, publicIndex: true, shareSlug: 'KvLiv6' } })
        await shareKv.put('KvLiv6', 'kv-live')
        const activeD1 = await commitAuthoritativeNoteWrite({
            path: 'd1-live',
            content: '# D1 Live',
            nextMetadata: { share: true, publicIndex: true },
            previousMetadata: {},
            isNewNote: true,
            env,
        })

        const listed = await driverListNotes({ env })
        const listedPaths = listed.map(n => n.name)
        assert.equal(listedPaths.includes('del-d1'), false)
        assert.equal(listedPaths.includes('kv-only-del'), false)
        assert.equal(listedPaths.includes('kv-live'), true)
        assert.equal(listedPaths.includes('d1-live'), true)

        // 4. Sitemap uses authoritative share_token_registry without MD5(path) fallback
        const sitemapRes = await worker.fetch(new Request('https://wiki.david888.com/sitemap.xml'), env, ctx)
        assert.equal(sitemapRes.status, 200)
        const xml = await sitemapRes.text()
        assert.match(xml, new RegExp(`/share/${activeD1.shareId}`))
        assert.doesNotMatch(xml, new RegExp(await MD5('d1-live')))

        // 5. Admin batch-delete with stale noteUid returns 409 and preserves replacement generation
        const adminCookie = `admin_session=${await jwt.sign({ role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }, env.SCN_SECRET)}`
        const adminConflictRes = await worker.fetch(new Request('https://wiki.david888.com/admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
            body: JSON.stringify({
                action: 'batch-delete',
                items: [{ path: 'd1-live', noteUid: 'stale-uid-000' }],
            }),
        }), env, ctx)
        assert.equal(adminConflictRes.status, 409)
        assert.ok(notesDb.sqlite.prepare("SELECT path FROM notes WHERE path = 'd1-live'").get())
    } finally {
        cleanupGlobals()
    }
})

test('Task 3.3: deleteEmptyPages() and scheduled() lifecycle cleanup & abandoned split-DB pending_import_finalizations reconciliation', async () => {
    const notesDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])
    const accountDb = createSqliteD1(['accounts.sql', 'note_annotations.sql', 'note_stats.sql'])
    const historyDb = createSqliteD1(['note_history.sql', 'note_history_meta.sql'])
    const notesKv = createKvMap()
    const shareKv = createKvMap()

    const now = 1700000000
    const env = {
        SCN_STORAGE_DRIVER: 'auto',
        SCN_SECRET: 'sched-secret',
        SCN_ENABLE_NOTE_HISTORY: '1',
        NOTES_DB: notesDb,
        APP_DB: accountDb,
        NOTE_HISTORY_DB: historyDb,
        NOTES: notesKv,
        SHARE: shareKv,
    }
    globalThis.SCN_STORAGE_DRIVER = env.SCN_STORAGE_DRIVER
    globalThis.SCN_ENABLE_NOTE_HISTORY = env.SCN_ENABLE_NOTE_HISTORY
    globalThis.NOTES_DB = notesDb
    globalThis.APP_DB = accountDb
    globalThis.NOTE_HISTORY_DB = historyDb
    globalThis.NOTES = notesKv
    globalThis.SHARE = shareKv

    try {
        // Seed empty unprotected note, empty password-protected note, and active public note
        notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
            'empty-del', '', JSON.stringify({ noteUid: 'uid-ed', metaVersion: 1 }), now - 100,
        )
        notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
            'empty-pw', '', JSON.stringify({ noteUid: 'uid-ep', metaVersion: 1, pw: 'locked' }), now - 100,
        )
        const pubTok = 'PubImportTok1234567890'
        notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
            'pub-note', '# Public', JSON.stringify({ share: true, shareSlug: pubTok, shareId: pubTok, noteUid: 'uid-pub', metaVersion: 1 }), now - 100,
        )
        notesDb.sqlite.prepare('INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at) VALUES (?, ?, ?, 1, ?)').run(
            pubTok, 'pub-note', 'uid-pub', now - 100,
        )
        notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run(pubTok, 'pub-note', now - 100)

        // Seed expired auth_challenges, stepup_grants, used_turnstile_tokens, auth_rate_limits, account_sessions
        accountDb.sqlite.prepare('INSERT INTO auth_challenges (challenge, purpose, binding_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run('c-exp', 'login', 'h', now - 10, now - 100)
        accountDb.sqlite.prepare('INSERT INTO auth_challenges (challenge, purpose, binding_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run('c-live', 'login', 'h', now + 100, now)
        accountDb.sqlite.prepare('INSERT INTO stepup_grants (id, account_id, session_id, action, binding_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run('g-exp', 'acc-1', 's-1', 'passkey_add_stepup', 'h', now - 10)
        accountDb.sqlite.prepare('INSERT INTO used_turnstile_tokens (token_hash, expires_at, created_at) VALUES (?, ?, ?)').run('t-exp', now - 10, now - 100)
        accountDb.sqlite.prepare('INSERT INTO auth_rate_limits (bucket_key, count, reset_at) VALUES (?, ?, ?)').run('rl-exp', 5, now - 10)
        accountDb.sqlite.prepare('INSERT INTO account_sessions (id, account_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?)').run('sess-exp', 'acc-1', now - 200, now - 10, null)
        accountDb.sqlite.prepare('INSERT INTO account_sessions (id, account_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?)').run('sess-rev', 'acc-1', now - 200, now + 1000, now - 5)
        accountDb.sqlite.prepare('INSERT INTO account_sessions (id, account_id, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?)').run('sess-ok', 'acc-1', now - 50, now + 1000, null)

        // Seed unlocked stale pending_import (> 120s) AND locked pending_import AND abandoned finalization candidates
        accountDb.sqlite.prepare(`
            INSERT INTO account_space_items (id, item_key, account_id, note_path, note_uid, access_level, status, last_activity_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'share_only', 'pending_import', ?, ?, ?)
        `).run('sp-stale', 'k-stale', 'acc-1', 'p1', 'u1', now - 200, now - 200, now - 200)

        // Locked item 1: valid surviving share_only import + concurrent user_facets ['bookmarked']
        accountDb.sqlite.prepare(`
            INSERT INTO account_space_items (id, item_key, account_id, note_path, note_uid, access_level, facets, user_facets, verified_import_facets, status, pending_import_commit_id, pending_import_facets, last_activity_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'share_only', '["bookmarked"]', '["bookmarked"]', NULL, 'active', 'commit-1', '["viewed"]', ?, ?, ?)
        `).run('sp-win', 'k-win', 'acc-1', 'pub-note', 'uid-pub', now - 300, now - 300, now - 300)

        // Locked item 2: revoked/failed brand-new first import (user_facets IS NULL, verified_import_facets IS NULL) -> should be DELETED
        accountDb.sqlite.prepare(`
            INSERT INTO account_space_items (id, item_key, account_id, note_path, note_uid, access_level, facets, user_facets, verified_import_facets, status, pending_import_commit_id, pending_import_facets, last_activity_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'share_only', '[]', NULL, NULL, 'pending_import', 'commit-1', '["viewed"]', ?, ?, ?)
        `).run('sp-fail-new', 'k-fail-new', 'acc-1', 'revoked-note', 'uid-rev', now - 300, now - 300, now - 300)

        // Locked item 3: failed re-import on pre-existing verified item -> should restore facets & clear lock!
        accountDb.sqlite.prepare(`
            INSERT INTO account_space_items (id, item_key, account_id, note_path, note_uid, access_level, facets, user_facets, verified_import_facets, status, pending_import_commit_id, pending_import_facets, last_activity_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'share_only', '["created"]', NULL, '["created"]', 'active', 'commit-1', '["viewed"]', ?, ?, ?)
        `).run('sp-fail-exist', 'k-fail-exist', 'acc-1', 'revoked-note-2', 'uid-rev2', now - 300, now - 300, now - 300)

        accountDb.sqlite.prepare(`
            INSERT INTO pending_import_finalizations (commit_id, account_id, candidates_json, created_at)
            VALUES (?, ?, ?, ?)
        `).run('commit-1', 'acc-1', JSON.stringify([
            { itemKey: 'k-win', notePath: 'pub-note', noteUid: 'uid-pub', shareId: pubTok },
            { itemKey: 'k-fail-new', notePath: 'revoked-note', noteUid: 'uid-rev', shareId: 'RevokedTok123456789012' },
            { itemKey: 'k-fail-exist', notePath: 'revoked-note-2', noteUid: 'uid-rev2', shareId: 'RevokedTok223456789012' },
        ]), now - 300)

        const res = await runScheduledCleanup(env, { nowSeconds: now })
        assert.equal(res.skipped, false)
        assert.equal(res.deletedEmpty, 1)

        // empty-del deleted without NOTES.delete, empty-pw preserved, tombstone retained permanently
        assert.equal(notesDb.sqlite.prepare("SELECT path FROM notes WHERE path = 'empty-del'").get(), undefined)
        assert.ok(notesDb.sqlite.prepare("SELECT path FROM notes WHERE path = 'empty-pw'").get())
        assert.ok(notesDb.sqlite.prepare("SELECT * FROM note_tombstones WHERE path = 'empty-del' AND deleted_note_uid = 'uid-ed'").get())
        assert.equal(notesKv.deletedKeys.includes('empty-del'), false)

        // Expired rows cleaned, live rows kept
        assert.equal(accountDb.sqlite.prepare("SELECT * FROM auth_challenges WHERE challenge = 'c-exp'").get(), undefined)
        assert.ok(accountDb.sqlite.prepare("SELECT * FROM auth_challenges WHERE challenge = 'c-live'").get())
        assert.equal(accountDb.sqlite.prepare("SELECT * FROM stepup_grants").get(), undefined)
        assert.equal(accountDb.sqlite.prepare("SELECT * FROM used_turnstile_tokens").get(), undefined)
        assert.equal(accountDb.sqlite.prepare("SELECT * FROM auth_rate_limits").get(), undefined)
        assert.equal(accountDb.sqlite.prepare("SELECT COUNT(*) AS c FROM account_sessions").get().c, 1)
        assert.equal(accountDb.sqlite.prepare("SELECT * FROM account_space_items WHERE item_key = 'k-stale'").get(), undefined)

        // Abandoned finalization reconciled atomically
        assert.equal(accountDb.sqlite.prepare("SELECT * FROM pending_import_finalizations WHERE commit_id = 'commit-1'").get(), undefined)
        const winRow = accountDb.sqlite.prepare("SELECT * FROM account_space_items WHERE item_key = 'k-win'").get()
        assert.equal(winRow.pending_import_commit_id, null)
        assert.deepEqual(JSON.parse(winRow.verified_import_facets), ['viewed'])
        assert.deepEqual(JSON.parse(winRow.facets), ['bookmarked', 'viewed'])

        assert.equal(accountDb.sqlite.prepare("SELECT * FROM account_space_items WHERE item_key = 'k-fail-new'").get(), undefined)

        const failExistRow = accountDb.sqlite.prepare("SELECT * FROM account_space_items WHERE item_key = 'k-fail-exist'").get()
        assert.equal(failExistRow.pending_import_commit_id, null)
        assert.deepEqual(JSON.parse(failExistRow.facets), ['created'])

        // Verify pending_import_finalizations & locks are preserved if notesDb throws during scheduled()
        accountDb.sqlite.prepare(`
            INSERT INTO account_space_items (id, item_key, account_id, note_path, note_uid, access_level, status, pending_import_commit_id, pending_import_facets, last_activity_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'share_only', 'pending_import', 'commit-err', '["viewed"]', ?, ?, ?)
        `).run('sp-err', 'k-err', 'acc-1', 'pub-note-err', 'uid-pub-err', now, now, now)
        accountDb.sqlite.prepare(`
            INSERT INTO pending_import_finalizations (commit_id, account_id, candidates_json, created_at)
            VALUES (?, ?, ?, ?)
        `).run('commit-err', 'acc-1', JSON.stringify([{ itemKey: 'k-err', notePath: 'pub-note-err', noteUid: 'uid-pub-err', shareId: pubTok }]), now)

        const brokenNotesDb = {
            prepare() {
                return {
                    bind() {
                        return {
                            async first() { throw new Error('Simulated notesDb outage') },
                            async all() { throw new Error('Simulated notesDb outage') },
                        }
                    },
                    async all() { throw new Error('Simulated notesDb outage') },
                }
            },
        }
        const errRes = await runScheduledCleanup({
            ...env,
            NOTES_DB: brokenNotesDb,
        }, { nowSeconds: now + 10 })
        assert.ok(errRes.errors.length > 0)
        assert.ok(accountDb.sqlite.prepare("SELECT * FROM pending_import_finalizations WHERE commit_id = 'commit-err'").get())
        assert.equal(accountDb.sqlite.prepare("SELECT pending_import_commit_id FROM account_space_items WHERE item_key = 'k-err'").get()?.pending_import_commit_id, 'commit-err')
    } finally {
        cleanupGlobals()
    }
})
test('KV note deletion rejects required or pinned registry before touching notes or shares', async () => {
    for (const authority of [
        { SCN_REQUIRE_NOTES_REGISTRY: '1' },
        { SCN_NOTES_DB_BINDING: 'NOTES_DB' },
    ]) {
        const operations = []
        const notes = {
            async getWithMetadata(key) {
                operations.push(['getWithMetadata', key])
                return { value: 'note', metadata: { shareSlug: 'slug', shareId: 'id' } }
            },
            async delete(key) { operations.push(['delete note', key]) },
        }
        const share = { async delete(key) { operations.push(['delete share', key]) } }
        const env = { SCN_STORAGE_DRIVER: 'kv', ...authority, NOTES: notes, SHARE: share }

        await assert.rejects(
            () => driverDeleteNote('note', { env }),
            err => err.status === 503 && err.code === 'STORAGE_UNAVAILABLE',
        )
        assert.deepEqual(operations, [])
    }
})

test('unrestricted KV note deletion removes the note and its share keys', async () => {
    const operations = []
    const notes = {
        async getWithMetadata(key) {
            operations.push(['getWithMetadata', key])
            return { value: 'note', metadata: { shareSlug: 'slug', shareId: 'id' } }
        },
        async delete(key) { operations.push(['delete note', key]) },
    }
    const share = { async delete(key) { operations.push(['delete share', key]) } }
    const db = { prepare() { throw new Error('KV mode must not access D1') } }

    const result = await driverDeleteNote('note', {
        env: { SCN_STORAGE_DRIVER: 'kv', NOTES_DB: db, NOTES: notes, SHARE: share },
    })

    assert.deepEqual(result, { deleted: true, source: 'kv' })
    assert.deepEqual(operations, [
        ['getWithMetadata', 'note'],
        ['delete note', 'note'],
        ['delete share', 'slug'],
        ['delete share', 'id'],
    ])
})

test('legacy MD5(path) share URLs resolve by default across kv and auto/d1 (including notes scan fallback without shares/SHARE mapping) without minting new MD5 aliases', async () => {
    for (const mode of ['kv', 'auto']) {
        const notesKv = createKvMap()
        const shareKv = createKvMap()
        const notesDb = mode === 'auto' ? createSqliteD1(['notes_d1.sql', 'notes_registry.sql']) : undefined
        const env = {
            SCN_STORAGE_DRIVER: mode,
            SCN_SECRET: 'md5-compat-secret',
            NOTES: notesKv,
            SHARE: shareKv,
            ...(notesDb ? { NOTES_DB: notesDb } : {}),
        }
        const ctx = { waitUntil: () => {} }

        try {
            const legacyPath = 'legacy-md5-note'
            const md5Token = await MD5(legacyPath)
            await notesKv.put(legacyPath, '# Legacy MD5 Note', {
                metadata: { share: true, shareSlug: 'Leg6Id' },
            })
            await shareKv.put(md5Token, legacyPath)
            await shareKv.put('Leg6Id', legacyPath)

            if (notesDb) {
                notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
                    legacyPath,
                    '# Legacy MD5 Note',
                    JSON.stringify({ share: true, shareSlug: 'Leg6Id', noteUid: 'uid-md5-1', metaVersion: 1 }),
                    1000,
                )
                notesDb.sqlite.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)').run(md5Token, legacyPath, 1000)
            }

            const resMd5 = await worker.fetch(new Request(`https://wiki.david888.com/share/${md5Token}`), env, ctx)
            assert.equal(resMd5.status, 200, `[${mode}] /share/${md5Token} should resolve by default`)

            // Mapping-less fallback: even after shares/SHARE MD5 mapping is removed, notes/NOTES scan still resolves MD5(path)
            const unmappedPath = 'legacy-md5-unmapped'
            const unmappedMd5 = await MD5(unmappedPath)
            await notesKv.put(unmappedPath, '# Legacy Unmapped MD5 Note', {
                metadata: { share: true, shareSlug: 'Unmap6' },
            })
            if (notesDb) {
                notesDb.sqlite.prepare('INSERT INTO notes (path, content, metadata, updated_at) VALUES (?, ?, ?, ?)').run(
                    unmappedPath,
                    '# Legacy Unmapped MD5 Note',
                    JSON.stringify({ share: true, shareSlug: 'Unmap6', noteUid: 'uid-md5-2', metaVersion: 1 }),
                    1000,
                )
            }
            const resUnmapped = await worker.fetch(new Request(`https://wiki.david888.com/share/${unmappedMd5}`), env, ctx)
            assert.equal(resUnmapped.status, 200, `[${mode}] unmapped /share/${unmappedMd5} should resolve via scan fallback`)

            // Explicit opt-out SCN_ALLOW_LEGACY_MD5_SHARE=0 blocks MD5(path)
            const resOptOut = await worker.fetch(new Request(`https://wiki.david888.com/share/${md5Token}`), {
                ...env,
                SCN_ALLOW_LEGACY_MD5_SHARE: '0',
            }, ctx)
            assert.equal(resOptOut.status, 404, `[${mode}] SCN_ALLOW_LEGACY_MD5_SHARE=0 should block MD5(path)`)

            // Path alias and arbitrary non-canonical tokens still 404
            const resPath = await worker.fetch(new Request(`https://wiki.david888.com/share/${legacyPath}`), env, ctx)
            assert.equal(resPath.status, 404, `[${mode}] /share/${legacyPath} must still 404`)

            // Newly published note does NOT mint MD5 alias
            const pubRes = await worker.fetch(new Request('https://wiki.david888.com/api/new-after-md5-compat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '# New Note', share: true }),
            }), env, ctx)
            assert.equal(pubRes.status, 200)
            const newMd5 = await MD5('new-after-md5-compat')
            assert.equal(shareKv.map.has(newMd5), false, `[${mode}] new publish must not write MD5 alias`)
        } finally {
            cleanupGlobals()
        }
    }
})
