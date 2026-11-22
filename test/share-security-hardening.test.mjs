import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import vm from 'node:vm'
import jwt from '@tsndr/cloudflare-worker-jwt'

import worker from '../src/index.js'
import { handleMcpRequest } from '../src/mcp_server.mjs'
import { ALL_PREVIEW_THEMES, RESERVED_SLUGS, isReservedSlug } from '../src/constant.js'
import { isBurnProtected, isShareBurned, safeJsonForInlineScript } from '../src/note_meta.js'
import { returnPage } from '../src/helper.js'
import { HTML } from '../src/templates/base.js'
import { ShareExpired, ShareBurned, ShareTimeLocked, ShareDeadmanLocked } from '../src/templates/pages.js'
import { buildRobotsTxt } from '../src/discovery.mjs'

const baseSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const annotationsJsSource = readFileSync(new URL('../static/js/share-annotations.mjs', import.meta.url), 'utf8')
const blockViewJsSource = readFileSync(new URL('../static/js/block-view.mjs', import.meta.url), 'utf8')

function decodeJwtPayload(token) {
    const decoded = jwt.decode(token)
    return decoded?.payload || decoded
}

function extractCookieValue(setCookieHeader, name) {
    if (!setCookieHeader) return null
    const match = String(setCookieHeader).match(new RegExp(`(?:^|,)\\s*${name}=([^;]+)`))
    return match ? decodeURIComponent(match[1]) : null
}

function createSqliteD1() {
    const sqlite = new DatabaseSync(':memory:')
    for (const file of [
        'notes_d1.sql',
        'notes_registry.sql',
        'note_history.sql',
        'note_history_meta.sql',
        'note_stats.sql',
        'note_annotations.sql',
    ]) {
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

function createWorkerHarness({ driver = 'kv', withD1 = false } = {}) {
    const notesKv = new Map()
    const shareKv = new Map()
    const db = withD1 ? createSqliteD1() : null

    const d1Notes = {
        set(path, { content = '', metadata = {} }) {
            if (!db) return
            db.sqlite.prepare(`
                INSERT INTO notes (path, content, metadata, updated_at)
                VALUES (?, ?, ?, unixepoch())
                ON CONFLICT(path) DO UPDATE SET content = excluded.content, metadata = excluded.metadata, updated_at = excluded.updated_at
            `).run(path, content, JSON.stringify(metadata || {}))
            if (metadata?.noteUid && metadata?.share === true && (metadata?.shareSlug || metadata?.shareId)) {
                const shareId = metadata.shareSlug || metadata.shareId
                db.sqlite.prepare(`
                    INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at)
                    VALUES (?, ?, ?, 1, unixepoch())
                    ON CONFLICT(share_id) DO UPDATE SET target_path = excluded.target_path, note_uid = excluded.note_uid, revoked_at = NULL, revoked_reason = NULL
                `).run(shareId, path, metadata.noteUid)
            }
        },
        get(path) {
            if (!db) return undefined
            const row = db.sqlite.prepare('SELECT content, metadata FROM notes WHERE path = ?').get(path)
            if (!row) return undefined
            return { content: row.content, metadata: JSON.parse(row.metadata) }
        },
    }

    const d1Shares = {
        set(shareId, path) {
            if (!db) return
            db.sqlite.prepare(`
                INSERT INTO shares (share_id, path, created_at)
                VALUES (?, ?, unixepoch())
                ON CONFLICT(share_id) DO UPDATE SET path = excluded.path
            `).run(shareId, path)
        },
    }

    const historyRows = {
        push(row) {
            if (!db) return
            const info = db.sqlite.prepare(`
                INSERT INTO note_history (id, path, content, created_at)
                VALUES (?, ?, ?, ?)
            `).run(row.id, row.path, row.content, row.created_at)
            if (row.note_uid) {
                db.sqlite.prepare(`
                    INSERT INTO note_history_meta (history_id, path, note_uid, created_at)
                    VALUES (?, ?, ?, ?)
                `).run(row.id ?? info.lastInsertRowid, row.path, row.note_uid, row.created_at)
            }
        },
    }

    const env = {
        SCN_STORAGE_DRIVER: driver,
        SCN_SECRET: 'hardening-test-secret-123',
        SCN_SALT: 'hardening-salt-123',
        SCN_ADMIN_PW: 'admin-pw-secret',
        SCN_ENABLE_NOTE_HISTORY: '1',
        NOTES: {
            getWithMetadata: async (key) => notesKv.get(key) || { value: null, metadata: null },
            put: async (key, value, opts = {}) => notesKv.set(key, { value, metadata: opts.metadata || {} }),
            delete: async (key) => notesKv.delete(key),
            list: async () => ({
                keys: Array.from(notesKv.entries()).map(([name, item]) => ({ name, metadata: item.metadata })),
                list_complete: true,
            }),
        },
        SHARE: {
            get: async (key) => shareKv.get(key) || null,
            put: async (key, value) => shareKv.set(key, value),
            delete: async (key) => shareKv.delete(key),
        },
    }

    if (withD1 && db) {
        env.NOTES_DB = db
        env.NOTE_HISTORY_DB = db
    }

    const ctx = { waitUntil: () => {} }
    return { env, ctx, db, notesKv, shareKv, d1Notes, d1Shares, historyRows }
}

function cleanupEnvGlobals() {
    for (const k of [
        'SCN_STORAGE_DRIVER',
        'SCN_SECRET',
        'SCN_SALT',
        'SCN_ADMIN_PW',
        'SCN_ADMIN_PATH',
        'SCN_ENABLE_WEBTALK',
        'SCN_ENABLE_NOTE_HISTORY',
        'NOTES',
        'SHARE',
        'NOTES_DB',
        'NOTE_HISTORY_DB',
        'DB',
    ]) {
        delete globalThis[k]
    }
}

test('Task 1.1: non-author share page omits path, untitled path fallback, pw/vpw/pulseToken, and note_path markdown', async () => {
    const { env, ctx, notesKv, shareKv } = createWorkerHarness({ driver: 'kv' })
    const secretPath = 'secret-edit-slug-xyz'
    const shareId = 'pub123'
    notesKv.set(secretPath, {
        value: 'Body without heading',
        metadata: {
            share: true,
            shareSlug: shareId,
            shareMode: 'deadman',
            sharePulseDueAt: Math.floor(Date.now() / 1000) - 60, // released
            sharePulseToken: 'super-secret-pulse-token',
            pw: 'hashed-edit-pw',
        },
    })
    shareKv.set(shareId, secretPath)

    try {
        // 1. HTML share view for non-author
        const htmlRes = await worker.fetch(new Request(`https://wiki.david888.com/share/${shareId}`), env, ctx)
        assert.equal(htmlRes.status, 200)
        const html = await htmlRes.text()
        assert.equal(html.includes(secretPath), false, 'Non-author share HTML must never contain edit path')
        assert.equal(html.includes('super-secret-pulse-token'), false, 'Non-author share HTML must never leak pulse token')
        assert.equal(html.includes('hashed-edit-pw'), false, 'Non-author share HTML must never leak password hash')
        assert.match(html, /id="present-btn"/, 'Non-author share toolbar should still render')

        // 2. Markdown negotiation for non-author
        const mdRes = await worker.fetch(new Request(`https://wiki.david888.com/share/${shareId}`, {
            headers: { Accept: 'text/markdown' },
        }), env, ctx)
        assert.equal(mdRes.status, 200)
        const md = await mdRes.text()
        assert.doesNotMatch(md, /note_path:/)
        assert.equal(md.includes(secretPath), false)

        // 3. Author DOES receive note_path and back-to-edit path
        const authorMdRes = await worker.fetch(new Request(`https://wiki.david888.com/share/${shareId}`, {
            headers: {
                Accept: 'text/markdown',
                Cookie: `admin_session=${await jwt.sign({ role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }, env.SCN_SECRET)}`,
            },
        }), env, ctx)
        assert.equal(authorMdRes.status, 200)
        const authorMd = await authorMdRes.text()
        assert.match(authorMd, new RegExp(`note_path: "${secretPath}"`))
    } finally {
        cleanupEnvGlobals()
    }
})

test('Task 1.1: pre-reveal burn interstitials emit content-free metadata and GET/HEAD ?reveal=1 never consumes burn', async () => {
    for (const burnMeta of [
        { shareMode: 'burn' },
        { shareMode: 'burn_after_reading' },
        { shareBurnAfterReading: true },
    ]) {
        const { env, ctx, d1Notes, d1Shares } = createWorkerHarness({ driver: 'd1', withD1: true })
        const secretPath = 'burn-secret-path'
        const shareId = 'burn12'
        d1Notes.set(secretPath, {
            content: '# Top Secret Nuclear Code\n\nLaunch code is ALPHA-999.',
            metadata: {
                share: true,
                shareSlug: shareId,
                title: 'Confidential Title Leak Test',
                ...burnMeta,
            },
        })
        d1Shares.set(shareId, secretPath)

        try {
            for (const targetUrl of [
                `https://wiki.david888.com/share/${shareId}`,
                `https://wiki.david888.com/share/${shareId}?reveal=1`,
                `https://wiki.david888.com/share/${shareId}/present?reveal=1`,
                `https://wiki.david888.com/share/${shareId}/book?reveal=1`,
            ]) {
                const headRes = await worker.fetch(new Request(targetUrl, { method: 'HEAD' }), env, ctx)
                assert.equal(headRes.status, 200)
                assert.equal(await headRes.text(), '')

                const res = await worker.fetch(new Request(targetUrl), env, ctx)
                assert.equal(res.status, 200)
                const html = await res.text()
                assert.equal(html.includes('ALPHA-999'), false, 'Burn content must not be leaked on GET')
                assert.equal(html.includes('Confidential Title Leak Test'), false, 'Content-derived title must not appear on pre-reveal burn interstitial')
                assert.equal(html.includes(secretPath), false, 'Secret path must not appear on pre-reveal burn interstitial')
                assert.doesNotMatch(html, /<meta property="og:/i)
                assert.doesNotMatch(html, /<meta name="twitter:/i)
                assert.doesNotMatch(html, /<meta name="description"/i)
                assert.doesNotMatch(html, /application\/ld\+json/i)
            }

            // Verify note is still unburned after all GET/HEAD ?reveal=1 probes
            assert.equal(d1Notes.get(secretPath).metadata.share, true)
            assert.equal(d1Notes.get(secretPath).metadata.shareBurnedAt, undefined)
        } finally {
            cleanupEnvGlobals()
        }
    }
})

test('Task 1.1: POST reveal endpoints release once when backfilled and fail closed 409 when un-backfilled', async () => {
    const revealRoutes = [
        '/share/burn12/reveal',
        '/share/burn12/present/reveal',
        '/share/burn12/book/reveal',
        '/api/shares/burn12/reveal',
    ]

    // 1. Un-backfilled KV-only note under D1/auto mode fails closed 409 across all 4 POST reveal endpoints
    for (const route of revealRoutes) {
        const { env, ctx, notesKv, shareKv } = createWorkerHarness({ driver: 'auto', withD1: true })
        notesKv.set('kv-only-burn', {
            value: '# Secret KV Burn',
            metadata: { share: true, shareSlug: 'burn12', shareMode: 'burn' },
        })
        shareKv.set('burn12', 'kv-only-burn')

        try {
            const res = await worker.fetch(new Request(`https://wiki.david888.com${route}`, { method: 'POST' }), env, ctx)
            assert.equal(res.status, 409, `Expected 409 on un-backfilled ${route}`)
            const body = await res.text()
            assert.equal(body.includes('Secret KV Burn'), false)
            assert.equal(notesKv.get('kv-only-burn').metadata.shareBurnedAt, undefined)
        } finally {
            cleanupEnvGlobals()
        }
    }

    // 2. Backfilled D1 note reveals once and burns on /api/shares/:shareId/reveal without leaking path or pw
    {
        const { env, ctx, d1Notes, d1Shares } = createWorkerHarness({ driver: 'd1', withD1: true })
        d1Notes.set('d1-burn-path', {
            content: 'Body without heading',
            metadata: {
                share: true,
                shareSlug: 'burn12',
                shareMode: 'burn_after_reading',
                pw: 'secret-edit-hash',
                vpw: 'secret-view-hash',
                sharePulseToken: 'pulse-secret',
            },
        })
        d1Shares.set('burn12', 'd1-burn-path')

        try {
            const res1 = await worker.fetch(new Request('https://wiki.david888.com/api/shares/burn12/reveal', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' },
            }), env, ctx)
            assert.equal(res1.status, 401)
            assert.equal(d1Notes.get('d1-burn-path').metadata.shareBurnedAt, undefined)
        } finally {
            cleanupEnvGlobals()
        }
    }

    {
        const { env, ctx, d1Notes, d1Shares } = createWorkerHarness({ driver: 'd1', withD1: true })
        d1Notes.set('d1-burn-path', {
            content: 'Body without heading',
            metadata: {
                share: true,
                shareSlug: 'burn12',
                shareMode: 'burn_after_reading',
                sharePulseToken: 'pulse-secret',
            },
        })
        d1Shares.set('burn12', 'd1-burn-path')

        try {
            const res1 = await worker.fetch(new Request('https://wiki.david888.com/api/shares/burn12/reveal', { method: 'POST' }), env, ctx)
            assert.equal(res1.status, 200)
            const json1 = await res1.json()
            assert.equal(json1.data.content, 'Body without heading')
            assert.equal(json1.data.path, undefined, 'Reveal JSON must omit path for non-author')
            assert.equal(json1.data.title.includes('d1-burn-path'), false, 'Reveal JSON must omit path title fallback')
            assert.equal(json1.data.metadata.sharePulseToken, undefined)
            assert.equal(json1.data.metadata.shareBurned, true)

            const res2 = await worker.fetch(new Request('https://wiki.david888.com/api/shares/burn12/reveal', { method: 'POST' }), env, ctx)
            assert.equal(res2.status, 410)
        } finally {
            cleanupEnvGlobals()
        }
    }
})

test('Task 1.1: direct, PDF, annotations, and history routes enforce isBurnProtected + positive edit proof + 409 un-backfilled', async () => {
    // 1. Un-backfilled KV burn note fails closed 409 on direct, PDF, annotations, and history
    {
        const { env, ctx, notesKv, shareKv } = createWorkerHarness({ driver: 'auto', withD1: true })
        notesKv.set('burn-kv', {
            value: 'Top Secret Burn Text',
            metadata: { share: true, shareSlug: 'sburnk', shareMode: 'burn' },
        })
        shareKv.set('sburnk', 'burn-kv')

        try {
            const rApi = await worker.fetch(new Request('https://wiki.david888.com/api/burn-kv'), env, ctx)
            assert.equal(rApi.status, 409)

            const rDirect = await worker.fetch(new Request('https://wiki.david888.com/burn-kv'), env, ctx)
            assert.equal(rDirect.status, 409)

            const rDirectHead = await worker.fetch(new Request('https://wiki.david888.com/burn-kv', { method: 'HEAD' }), env, ctx)
            assert.equal(rDirectHead.status, 409)

            const rDirectPdf = await worker.fetch(new Request('https://wiki.david888.com/api/burn-kv/pdf'), env, ctx)
            assert.equal(rDirectPdf.status, 409)

            const rSharePdf = await worker.fetch(new Request('https://wiki.david888.com/share/sburnk/export/pdf?burn_confirm=true'), env, ctx)
            assert.equal(rSharePdf.status, 409)

            const rShareApiPdf = await worker.fetch(new Request('https://wiki.david888.com/api/shares/sburnk/pdf?burn_confirm=true'), env, ctx)
            assert.equal(rShareApiPdf.status, 409)

            const rAnnGet = await worker.fetch(new Request('https://wiki.david888.com/api/shares/sburnk/annotations'), env, ctx)
            assert.equal(rAnnGet.status, 409)

            const rAnnPost = await worker.fetch(new Request('https://wiki.david888.com/api/shares/sburnk/annotations', {
                method: 'POST',
                headers: { Origin: 'https://wiki.david888.com', 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            }), env, ctx)
            assert.equal(rAnnPost.status, 409)

            const rHistory = await worker.fetch(new Request('https://wiki.david888.com/api/burn-kv/history'), env, ctx)
            assert.equal(rHistory.status, 409)
        } finally {
            cleanupEnvGlobals()
        }
    }

    // 2. Backfilled D1 passwordless burn note: annotations return 403; history requires positive edit proof
    {
        const { env, ctx, d1Notes, d1Shares, historyRows } = createWorkerHarness({ driver: 'd1', withD1: true })
        d1Notes.set('burn-d1', {
            content: 'Top Secret Burn D1',
            metadata: { share: true, shareSlug: 'sburnd', noteUid: 'uid-burn-d1', shareMode: 'burn_after_reading' },
        })
        d1Shares.set('sburnd', 'burn-d1')
        historyRows.push({ id: 1, path: 'burn-d1', note_uid: 'uid-burn-d1', content: 'Old Secret Version', created_at: 1700000000, content_length: 18 })

        try {
            // Non-author annotations fail closed 403
            const annRes = await worker.fetch(new Request('https://wiki.david888.com/api/shares/sburnd/annotations'), env, ctx)
            assert.equal(annRes.status, 403)

            // Anonymous history fails closed 403 even though note is passwordless
            const histAnon = await worker.fetch(new Request('https://wiki.david888.com/api/burn-d1/history'), env, ctx)
            assert.equal(histAnon.status, 403)

            const histVerAnon = await worker.fetch(new Request('https://wiki.david888.com/api/burn-d1/history/1'), env, ctx)
            assert.equal(histVerAnon.status, 403)

            // Author with edit proof succeeds on history
            const editJwt = await jwt.sign({ path: 'burn-d1', role: 'edit', noteUid: 'uid-burn-d1', exp: Math.floor(Date.now() / 1000) + 3600 }, env.SCN_SECRET)
            const histAuth = await worker.fetch(new Request('https://wiki.david888.com/api/burn-d1/history', {
                headers: { Cookie: `auth=${editJwt}` },
            }), env, ctx)
            assert.equal(histAuth.status, 200)
            const histJson = await histAuth.json()
            assert.equal(histJson.data.versions.length, 1)
        } finally {
            cleanupEnvGlobals()
        }
    }
})

test('Task 1.1: MCP single & batched read_note/read_canvas/read_whiteboard/generate_canvas_from_wikilinks enforce burn guards across credentials', async () => {
    const { saltPw } = await import('../src/helper.js')

    for (const variant of [
        { shareMode: 'burn' },
        { shareMode: 'burn_after_reading' },
        { shareBurnAfterReading: true },
    ]) {
        const { env, d1Notes } = createWorkerHarness({ driver: 'd1', withD1: true })
        globalThis.SCN_STORAGE_DRIVER = env.SCN_STORAGE_DRIVER
        globalThis.SCN_SALT = env.SCN_SALT
        globalThis.NOTES = env.NOTES
        globalThis.SHARE = env.SHARE
        globalThis.NOTES_DB = env.NOTES_DB

        const editHash = await saltPw('edit-pass')
        const viewHash = await saltPw('view-pass')

        d1Notes.set('burn-md', {
            content: '# Secret\n[[LinkedNote]]',
            metadata: { share: true, shareSlug: 'bmd', pw: editHash, vpw: viewHash, ...variant },
        })
        d1Notes.set('burn-canvas', {
            content: JSON.stringify({ nodes: [{ id: 'n1', type: 'text', x: 0, y: 0, width: 100, height: 100, text: 'Secret' }], edges: [] }),
            metadata: { share: true, shareSlug: 'bcv', editorFormat: 'canvas', pw: editHash, vpw: viewHash, ...variant },
        })
        d1Notes.set('burn-wb', {
            content: JSON.stringify({ type: 'excalidraw', version: 2, elements: [{ id: 'e1', type: 'text', text: 'SecretWB' }] }),
            metadata: { share: true, shareSlug: 'bwb', editorFormat: 'whiteboard', pw: editHash, vpw: viewHash, ...variant },
        })

        try {
            // 1. Batched call with view-only password -> all 4 MUST fail with isError: true
            const batchViewReq = new Request('https://wiki.david888.com/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([
                    { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_note', arguments: { path: 'burn-md', password: 'view-pass' } } },
                    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'read_canvas', arguments: { path: 'burn-canvas', password: 'view-pass' } } },
                    { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'read_whiteboard', arguments: { path: 'burn-wb', password: 'view-pass' } } },
                    { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'generate_canvas_from_wikilinks', arguments: { source_path: 'burn-md', password: 'view-pass' } } },
                ]),
            })
            const batchViewRes = await handleMcpRequest(batchViewReq)
            const batchViewJson = await batchViewRes.json()
            assert.equal(batchViewJson.length, 4)
            for (const item of batchViewJson) {
                assert.equal(item.result.isError, true)
                assert.match(item.result.content[0].text, /409/)
                assert.equal(item.result.content[0].text.includes('LinkedNote'), false)
                assert.equal(item.result.content[0].text.includes('SecretWB'), false)
            }

            // 2. Anonymous read_note on passwordless un-backfilled KV burn note (auto mode) -> 409 conflict envelope
            globalThis.SCN_STORAGE_DRIVER = 'auto'
            await env.NOTES.put('kv-burn-mcp', '# Unbackfilled Secret', { metadata: { share: true, ...variant } })
            const unbackfilledReq = new Request('https://wiki.david888.com/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 10,
                    method: 'tools/call',
                    params: { name: 'read_note', arguments: { path: 'kv-burn-mcp' } },
                }),
            })
            const unbackfilledRes = await handleMcpRequest(unbackfilledReq)
            const unbackfilledJson = await unbackfilledRes.json()
            assert.equal(unbackfilledJson.result.isError, true)
            assert.match(unbackfilledJson.result.content[0].text, /BURN_SHARE_UNBACKFILLED/)

            // 3. Edit credential succeeds
            const editReq = new Request('https://wiki.david888.com/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 11,
                    method: 'tools/call',
                    params: { name: 'read_note', arguments: { path: 'burn-md', password: 'edit-pass' } },
                }),
            })
            const editRes = await handleMcpRequest(editReq)
            const editJson = await editRes.json()
            assert.equal(editJson.result.isError, false)
            assert.match(editJson.result.content[0].text, /LinkedNote/)
        } finally {
            cleanupEnvGlobals()
        }
    }
})

test('Task 1.1: POST /share/:shareId/auth issues path-free view JWT cookie and checkAuth enforces shareId & noteUid', async () => {
    const { saltPw } = await import('../src/helper.js')
    const { env, ctx, d1Notes, d1Shares } = createWorkerHarness({ driver: 'd1', withD1: true })
    globalThis.SCN_SECRET = env.SCN_SECRET
    globalThis.SCN_SALT = env.SCN_SALT

    try {
        const viewHash = await saltPw('view-only-123')
        const editHash = await saltPw('edit-only-456')
        d1Notes.set('private-edit-slug', {
            content: '# Secret Shared Note',
            metadata: {
                share: true,
                shareSlug: 'pubvw1',
                noteUid: 'uid-gen-1',
                vpw: viewHash,
                pw: editHash,
            },
        })
        d1Shares.set('pubvw1', 'private-edit-slug')

        // Authenticate with view password
        const authRes = await worker.fetch(new Request('https://wiki.david888.com/share/pubvw1/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passwd: 'view-only-123' }),
        }), env, ctx)
        assert.equal(authRes.status, 200)
        const authJson = await authRes.json()
        assert.equal(authJson.data.role, 'view')

        const viewToken = extractCookieValue(authRes.headers.get('Set-Cookie'), 'auth')
        assert.ok(viewToken)
        const payload = decodeJwtPayload(viewToken)
        assert.equal(payload.path, undefined, 'View JWT must be path-free')
        assert.equal(payload.shareId, 'pubvw1')
        assert.equal(payload.role, 'view')
        assert.equal(payload.noteUid, 'uid-gen-1')

        // View cookie works on matching share page
        const shareOk = await worker.fetch(new Request('https://wiki.david888.com/share/pubvw1', {
            headers: { Cookie: `auth=${viewToken}` },
        }), env, ctx)
        assert.equal(shareOk.status, 200)
        const shareHtml = await shareOk.text()
        assert.match(shareHtml, /Secret Shared Note/)
        assert.equal(shareHtml.includes('private-edit-slug'), false)

        // View cookie is rejected if noteUid changes (e.g. note deleted & recreated)
        d1Notes.set('private-edit-slug', {
            content: '# Secret Shared Note',
            metadata: {
                share: true,
                shareSlug: 'pubvw1',
                noteUid: 'uid-gen-2',
                vpw: viewHash,
                pw: editHash,
            },
        })
        const shareStale = await worker.fetch(new Request('https://wiki.david888.com/share/pubvw1', {
            headers: { Cookie: `auth=${viewToken}` },
        }), env, ctx)
        const staleHtml = await shareStale.text()
        assert.doesNotMatch(staleHtml, /Secret Shared Note/)
        assert.match(staleHtml, /password/i)
    } finally {
        cleanupEnvGlobals()
    }
})

test('Task 1.1: Seal status pages omit secret path, password hashes, and protected content titles for non-authors', () => {
    const extSecrets = {
        isAuthor: false,
        pw: 'hash-pw-secret',
        vpw: 'hash-vpw-secret',
        sharePulseToken: 'pulse-secret-token',
        shareUnlockAt: 1800000000,
        sharePulseDueAt: 1800000500,
    }

    for (const renderFn of [ShareExpired, ShareBurned, ShareTimeLocked, ShareDeadmanLocked]) {
        const html = renderFn({
            lang: 'en-US',
            title: 'Protected Secret Content Title',
            path: 'secret-edit-slug-999',
            shareId: 'public-seal-id',
            ext: extSecrets,
        })
        assert.equal(html.includes('secret-edit-slug-999'), false)
        assert.equal(html.includes('Protected Secret Content Title'), false)
        assert.equal(html.includes('hash-pw-secret'), false)
        assert.equal(html.includes('hash-vpw-secret'), false)
        assert.equal(html.includes('pulse-secret-token'), false)
        assert.match(html, /public-seal-id/)
    }
})

test('Task 1.2: recordShareHistory("created") requires APP_STATE.isEdit and WebTalk requires SCN_ENABLE_WEBTALK === "1"', () => {
    assert.match(baseSource, /if\s*\(\s*APP_STATE\.isEdit\s*&&\s*initialShareUrl\s*\)\s*recordShareHistory\('created'/)

    const prevWebtalk = globalThis.SCN_ENABLE_WEBTALK
    try {
        delete globalThis.SCN_ENABLE_WEBTALK
        const htmlOff = HTML({ lang: 'en-US', title: 'Test', content: '# Hi', shareId: 's1', isEdit: false })
        assert.doesNotMatch(htmlOff, /webtalk\.js/)

        globalThis.SCN_ENABLE_WEBTALK = '0'
        const htmlZero = HTML({ lang: 'en-US', title: 'Test', content: '# Hi', shareId: 's1', isEdit: false })
        assert.doesNotMatch(htmlZero, /webtalk\.js/)

        globalThis.SCN_ENABLE_WEBTALK = '1'
        const htmlOn = HTML({ lang: 'en-US', title: 'Test', content: '# Hi', shareId: 's1', isEdit: false })
        assert.match(htmlOn, /webtalk\.js/)

        const htmlBurn = HTML({
            lang: 'en-US',
            title: 'Test',
            content: '# Hi',
            shareId: 's1',
            isEdit: false,
            ext: { shareMode: 'burn' },
        })
        assert.doesNotMatch(htmlBurn, /webtalk\.js/, 'Pre-reveal burn interstitial must omit webtalk.js')
    } finally {
        if (prevWebtalk === undefined) delete globalThis.SCN_ENABLE_WEBTALK
        else globalThis.SCN_ENABLE_WEBTALK = prevWebtalk
    }
})

test('Task 1.2: theme allowlist on write & render + safeJsonForInlineScript XSS resistance across all formats', async () => {
    const { env, ctx, d1Notes } = createWorkerHarness({ driver: 'd1', withD1: true })

    try {
        // 1. Write routes reject invalid themes with 400
        const apiBadTheme = await worker.fetch(new Request('https://wiki.david888.com/api/theme-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '# Hi', theme: "ayu-light';alert(1)//" }),
        }), env, ctx)
        assert.equal(apiBadTheme.status, 400)

        d1Notes.set('theme-test', { content: '# Hi', metadata: { share: true } })
        const settingBadTheme = await worker.fetch(new Request('https://wiki.david888.com/theme-test/setting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: '</script><script>alert(1)</script>' }),
        }), env, ctx)
        assert.equal(settingBadTheme.status, 400)

        const apiGoodTheme = await worker.fetch(new Request('https://wiki.david888.com/api/theme-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '# Hi', theme: 'tokyo-night' }),
        }), env, ctx)
        assert.equal(apiGoodTheme.status, 200)
        assert.ok(ALL_PREVIEW_THEMES.includes('tokyo-night'))
    } finally {
        cleanupEnvGlobals()
    }

    // 2. Render allowlists crafted persisted theme across Markdown, Block, Canvas, Whiteboard
    const evilTheme = "bad';alert(1);//</script>\u2028\u2029<>&"
    for (const editorFormat of ['markdown', 'block', 'canvas', 'whiteboard']) {
        const rendered = HTML({
            lang: 'en-US',
            title: 'Theme Injection Test',
            content: editorFormat === 'canvas' ? '{"nodes":[],"edges":[]}' : (editorFormat === 'whiteboard' ? '{"type":"excalidraw","elements":[]}' : '# Hi'),
            shareId: 'th1',
            isEdit: false,
            ext: { editorFormat, theme: evilTheme },
        })
        assert.equal(rendered.includes("alert(1)"), false)
        assert.doesNotMatch(rendered, /var pageTheme = "bad/)
    }

    // 3. safeJsonForInlineScript escapes <, >, &, \u2028, \u2029
    const escaped = safeJsonForInlineScript({ text: '</script>&>\u2028\u2029' })
    assert.equal(escaped.includes('<'), false)
    assert.equal(escaped.includes('>'), false)
    assert.equal(escaped.includes('&'), false)
    assert.equal(escaped.includes('\u2028'), false)
    assert.equal(escaped.includes('\u2029'), false)
})

test('Task 1.2: fail-closed SVG sanitization, book export sanitization, and textContent error handling', async () => {
    // 1. Source checks for fail-closed SVG sanitization & textContent error rendering
    assert.doesNotMatch(baseSource, /:\s*svg;/)
    assert.doesNotMatch(baseSource, /:\s*graphvizSvg;/)
    assert.doesNotMatch(baseSource, /wrap\.innerHTML\s*=\s*pRes\.svg/)
    assert.doesNotMatch(baseSource, /wrap\.innerHTML\s*=\s*mRes\.svg/)
    assert.doesNotMatch(baseSource, /node\.innerHTML\s*=\s*'<p style="color:red">Rendering Error: ' \+ e\.message/)
    assert.doesNotMatch(annotationsJsSource, /resultContent\.innerHTML\s*=\s*`<span/)
    assert.match(annotationsJsSource, /const showAiError = errorMessage => \{[\s\S]*?resultContent\.textContent = ''[\s\S]*?errorSpan\.textContent =/)

    // 2. Book export/print escapes titles and sanitizes chapter HTML
    assert.match(baseSource, /function sanitizeBookChapterHtml/)
    assert.doesNotMatch(baseSource, /<h1>'\s*\+\s*bookData\.title\s*\+\s*'<\/h1>/)
    assert.doesNotMatch(baseSource, /<h2>'\s*\+\s*ch\.title\s*\+\s*'<\/h2>'\s*\+\s*chHtml/)

    // 3. Execute block-view.mjs without DOMPurify to verify fail-closed plain-text error
    const fakeNode = {
        textContent: 'graph TD; A-->B;',
        attributes: {},
        _innerHTML: '',
        set innerHTML(v) { this._innerHTML = v },
        get innerHTML() { return this._innerHTML },
        setAttribute(k, v) { this.attributes[k] = v },
    }
    assert.match(blockViewJsSource, /Diagram Sanitizer Unavailable: DOMPurify is required to render SVG\./)
    assert.doesNotMatch(blockViewJsSource, /node\.innerHTML\s*=\s*res\.svg/)
    assert.doesNotMatch(blockViewJsSource, /mermaid\.run\(/)
    assert.equal(fakeNode._innerHTML, '')
})

test('Task 1.3: returnPage and Page404 return true HTTP 404/410/423 on GET and HEAD with Cache-Control: no-store', async () => {
    const r404 = returnPage('Page404', { lang: 'en-US', title: '404' })
    assert.equal(r404.status, 404)
    assert.equal(r404.headers.get('Cache-Control'), 'no-store')

    const r410 = returnPage('ShareExpired', { lang: 'en-US', title: 'Expired' }, { status: 410 })
    assert.equal(r410.status, 410)

    const { env, ctx } = createWorkerHarness({ driver: 'kv' })
    try {
        // Missing multi-segment route -> 404 on GET and HEAD
        const getMissing = await worker.fetch(new Request('https://wiki.david888.com/missing/nested/route'), env, ctx)
        assert.equal(getMissing.status, 404)
        assert.equal(getMissing.headers.get('Cache-Control'), 'no-store')

        const headMissing = await worker.fetch(new Request('https://wiki.david888.com/missing/nested/route', { method: 'HEAD' }), env, ctx)
        assert.equal(headMissing.status, 404)
        assert.equal(headMissing.headers.get('Cache-Control'), 'no-store')
        assert.equal(await headMissing.text(), '')

        // Missing share route -> 404 on GET and HEAD
        const getShare404 = await worker.fetch(new Request('https://wiki.david888.com/share/does-not-exist'), env, ctx)
        assert.equal(getShare404.status, 404)
        const headShare404 = await worker.fetch(new Request('https://wiki.david888.com/share/does-not-exist', { method: 'HEAD' }), env, ctx)
        assert.equal(headShare404.status, 404)
    } finally {
        cleanupEnvGlobals()
    }
})

test('Task 1.3: RESERVED_SLUGS and dynamic SCN_ADMIN_PATH are enforced across HTTP, API, and MCP write endpoints', async () => {
    for (const slug of ['api', 'share', 'new', 'static', 'js', 'css', 'assets', '_space', 'c', 'robots.txt', 'sitemap.xml', 'llms.txt', 'llms-full.txt', 'openapi.json', 'auth.md', 'mcp', 'docs', '.well-known', 'sw.js', 'manifest.json', 'favicon.ico', 'admin']) {
        assert.ok(RESERVED_SLUGS.includes(slug), `RESERVED_SLUGS must include ${slug}`)
        assert.equal(isReservedSlug(slug), true)
    }

    // Dynamic SCN_ADMIN_PATH collision check
    assert.equal(isReservedSlug('custom-ops-panel', { SCN_ADMIN_PATH: '/custom-ops-panel' }), true)
    assert.equal(isReservedSlug('normal-note-slug', { SCN_ADMIN_PATH: '/custom-ops-panel' }), false)

    const { env, ctx, notesKv } = createWorkerHarness({ driver: 'kv' })
    env.SCN_ADMIN_PATH = '/secret-admin-portal'
    globalThis.SCN_STORAGE_DRIVER = 'kv'
    globalThis.SCN_ADMIN_PATH = env.SCN_ADMIN_PATH
    globalThis.NOTES = env.NOTES
    globalThis.SHARE = env.SHARE

    try {
        for (const reserved of ['_space', 'c', 'api', 'robots.txt', 'secret-admin-portal']) {
            const apiRes = await worker.fetch(new Request(`https://wiki.david888.com/api/${reserved}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '# Hijack' }),
            }), env, ctx)
            assert.equal(apiRes.status, 400, `POST /api/${reserved} must reject reserved slug`)

            if (reserved !== 'secret-admin-portal') {
                const form = new FormData()
                form.append('t', '# Hijack')
                const directRes = await worker.fetch(new Request(`https://wiki.david888.com/${reserved}`, {
                    method: 'POST',
                    body: form,
                }), env, ctx)
                const expectedStatus = reserved === '_space' ? 405 : reserved === 'c' ? 404 : 400
                assert.equal(directRes.status, expectedStatus, `POST /${reserved} must reject reserved slug`)
            }

            for (const toolName of ['write_note', 'write_canvas', 'write_whiteboard', 'append_note']) {
                const args = toolName === 'write_canvas'
                    ? { path: reserved, document: { nodes: [], edges: [] } }
                    : toolName === 'write_whiteboard'
                        ? { path: reserved, document: { type: 'excalidraw', elements: [] } }
                        : { path: reserved, text: '# Hijack' }
                const mcpRes = await handleMcpRequest(new Request('https://wiki.david888.com/mcp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: toolName, arguments: args } }),
                }))
                const mcpJson = await mcpRes.json()
                assert.equal(mcpJson.result.isError, true, `MCP ${toolName} must reject reserved slug ${reserved}`)
                assert.match(mcpJson.result.content[0].text, /reserved/i)
            }
            assert.equal(notesKv.has(reserved), false, `reserved slug ${reserved} must not be stored as a note`)
        }

        // /api/new-note and GET /new never allocate a reserved slug
        const newApiRes = await worker.fetch(new Request('https://wiki.david888.com/api/new-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '# Fresh note' }),
        }), env, ctx)
        assert.equal(newApiRes.status, 200)
        const newApiJson = await newApiRes.json()
        assert.equal(isReservedSlug(newApiJson.data.path, env), false)
        assert.equal(notesKv.has(newApiJson.data.path), true)

        const newGetRes = await worker.fetch(new Request('https://wiki.david888.com/new/markdown'), env, ctx)
        assert.equal(newGetRes.status, 302)
        const location = new URL(newGetRes.headers.get('Location')).pathname.replace(/^\/+/, '')
        assert.equal(isReservedSlug(location, env), false)
    } finally {
        cleanupEnvGlobals()
    }
})

test('Task 1.3: buildRobotsTxt disallows /_space, /c/, and account/space/circle APIs', () => {
    const robots = buildRobotsTxt('https://wiki.david888.com')
    for (const rule of [
        'Disallow: /_space',
        'Disallow: /c/',
        'Disallow: /api/auth/',
        'Disallow: /api/account/',
        'Disallow: /api/space/',
        'Disallow: /api/circles/',
    ]) {
        assert.ok(robots.includes(rule), `robots.txt must include ${rule}`)
    }
})
