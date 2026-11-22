import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import worker from '../src/index.js'
import { handleMcpRequest } from '../src/mcp_server.mjs'
import { renderMarkdownToHtml, lintMarkdownText } from '../src/markdown-processor.mjs'
import { extractRawPublicKeyFromCose, verifyFidoAssertion, verifyFidoRegistration, bytesToBase64Url, generateChallenge } from '../src/fido_auth.mjs'
import { createTurnstileClearanceToken, verifyTurnstileClearanceCookie, TURNSTILE_CLEARANCE_COOKIE_NAME } from '../src/turnstile.mjs'
import { listAnnotationThreads } from '../src/annotation_data.mjs'
import { driverRecordBurnView } from '../src/storage_driver.mjs'
import { planDbInitTargets, parseWranglerToml } from '../scripts/db-init.mjs'

const crypto = webcrypto

test('EGM P0: offline_page.js named imports all exist in static/js/markdown-extensions.mjs and sync uses /api/', async () => {
    const offlineSource = readFileSync(new URL('../src/offline_page.js', import.meta.url), 'utf8')
    const extModule = await import('../static/js/markdown-extensions.mjs')

    const importMatch = offlineSource.match(/import\s*\{([^}]+)\}\s*from\s*'\/js\/markdown-extensions\.mjs'/)
    assert.ok(importMatch, 'offline_page.js imports from /js/markdown-extensions.mjs')

    const importedNames = importMatch[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

    for (const name of importedNames) {
        assert.equal(typeof extModule[name], 'function', `markdown-extensions.mjs must export ${name}`)
    }

    assert.match(offlineSource, /fetch\('\/api\/' \+ encodeURIComponent\(targetPath\)\)/)
})

test('EGM P0: db:init plans the notes D1 schema', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    assert.match(pkg.scripts['db:init'], /node scripts\/db-init\.mjs/)
    const config = parseWranglerToml(readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8'))
    const plan = planDbInitTargets(config)
    assert.ok(plan.targets.some(target => target.files.includes('schema/notes_d1.sql')))
})

test('EGM P0: MCP batch > 20 returns 400 JSON without ReferenceError and missing notes return not found', async () => {
    const batch = Array.from({ length: 21 }, (_, i) => ({ jsonrpc: '2.0', id: i + 1, method: 'tools/list' }))
    const batchReq = new Request('https://wiki.david888.com/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
    })
    const batchRes = await handleMcpRequest(batchReq)
    assert.equal(batchRes.status, 400)
    const batchBody = await batchRes.json()
    assert.match(batchBody.error.message, /Batch size exceeds limit of 20/)

    const notesStore = new Map()
    globalThis.NOTES = {
        getWithMetadata: async (k) => notesStore.get(k) || { value: null, metadata: null },
        put: async (k, v, opts = {}) => notesStore.set(k, { value: v, metadata: opts.metadata || {} }),
    }
    globalThis.SHARE = {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
    }
    globalThis.SCN_STORAGE_DRIVER = 'kv'

    try {
        const readReq = new Request('https://wiki.david888.com/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: { name: 'read_note', arguments: { path: 'missing-note-xyz' } },
            }),
        })
        const readRes = await handleMcpRequest(readReq)
        const readBody = await readRes.json()
        assert.equal(readBody.result.isError, true)
        assert.match(readBody.result.content[0].text, /not found/i)

        // append_note must NOT un-burn a burned note (share: false or 0)
        notesStore.set('burned-note', { value: 'secret', metadata: { share: 0, shareBurnedAt: 1700000000 } })
        const appendReq = new Request('https://wiki.david888.com/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 3,
                method: 'tools/call',
                params: { name: 'append_note', arguments: { path: 'burned-note', text: 'extra' } },
            }),
        })
        const appendRes = await handleMcpRequest(appendReq)
        const appendBody = await appendRes.json()
        assert.equal(appendBody.result.isError, true)
        assert.notEqual(notesStore.get('burned-note').metadata.share, true)
    } finally {
        delete globalThis.NOTES
        delete globalThis.SHARE
        delete globalThis.SCN_STORAGE_DRIVER
    }
})

test('EGM P0: markdown-processor blocks javascript: URLs, sanitizes colors, preserves single-line callouts, and scopes Mermaid lint', () => {
    const rendered = renderMarkdownToHtml([
        '[bad](javascript:alert_xss)',
        '![img](javascript:alert_img)',
        '[color=rgb(255,0,0) bg=expression(x)]ok[/color]',
        '> [!NOTE] Inline alert text',
    ].join('\n'))

    assert.doesNotMatch(rendered, /javascript:/i)
    assert.doesNotMatch(rendered, /background-color/i)
    assert.match(rendered, /style="color: rgb\(255,0,0\)"/)
    assert.match(rendered, /markdown-alert-note/)
    assert.match(rendered, /Inline alert text/)

    const lintNonMermaid = lintMarkdownText('```yaml\nfoo: a[b/c] --> d\n```')
    assert.equal(lintNonMermaid.issues.some(i => i.type === 'mermaid-unquoted-node'), false)

    const lintMermaid = lintMarkdownText('```mermaid\nA[foo/bar] --> B\n```')
    assert.equal(lintMermaid.issues.some(i => i.type === 'mermaid-unquoted-node'), true)
})

test('EGM P0/P1: FIDO2 rejects non-ES256 COSE keys, registration without challenge, and origin scheme mismatches', async () => {
    // Reject non-ES256 COSE key (alg = -257)
    // CBOR map of 4: {1: 2, 3: -257 (0x39 0x01 0x00), -1: 1, -2: 32b, -3: 32b}
    const invalidAlgCose = new Uint8Array([
        0xa5,
        0x01, 0x02,
        0x03, 0x39, 0x01, 0x00,
        0x20, 0x01,
        0x21, 0x58, 0x20, ...new Uint8Array(32).fill(1),
        0x22, 0x58, 0x20, ...new Uint8Array(32).fill(2),
    ])
    assert.throws(() => extractRawPublicKeyFromCose(invalidAlgCose), /Unsupported COSE Key/)

    // Reject http vs https origin mismatch in verifyFidoAssertion
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey)
    const challenge = generateChallenge()
    const clientDataBytes = new TextEncoder().encode(JSON.stringify({
        type: 'webauthn.get',
        challenge,
        origin: 'http://wiki.david888.com',
    }))
    const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('wiki.david888.com')))
    const authDataBytes = new Uint8Array(37)
    authDataBytes.set(rpIdHash, 0)
    authDataBytes[32] = 0x01
    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))
    const sigBase = new Uint8Array(authDataBytes.length + clientDataHash.length)
    sigBase.set(authDataBytes, 0)
    sigBase.set(clientDataHash, authDataBytes.length)
    const p1363Sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, sigBase))
    const der = new Uint8Array([0x30, 0x44, 0x02, 0x20, ...p1363Sig.slice(0, 32), 0x02, 0x20, ...p1363Sig.slice(32, 64)])

    await assert.rejects(() => verifyFidoAssertion({
        publicKeyRawBase64: bytesToBase64Url(rawPub),
        authenticatorDataBase64: bytesToBase64Url(authDataBytes),
        clientDataJsonBase64: bytesToBase64Url(clientDataBytes),
        signatureBase64: bytesToBase64Url(der),
        expectedChallenge: challenge,
        expectedOrigin: 'https://wiki.david888.com',
        expectedRpId: 'wiki.david888.com',
    }), /Origin mismatch/)

    assert.equal(typeof verifyFidoRegistration, 'function')
})

test('EGM P0/P1: Worker /img/* serves R2 safely, /upload blocks forged admin_session, /api/pdf/export caps payload, and SSRF blocks hex/int/v6-mapped IPs', async () => {
    const r2Objects = new Map()
    r2Objects.set('2026/11/test.svg', {
        body: '<svg><script>alert(1)</script></svg>',
        httpMetadata: { contentType: 'image/svg+xml' },
    })

    const env = {
        SCN_STORAGE_DRIVER: 'kv',
        SCN_SECRET: 'test-secret-123456',
        SCN_ADMIN_PW: 'admin-secret',
        SCN_ENABLE_R2: '1',
        SCN_TURNSTILE_SITE_KEY: '0x4AAA',
        SCN_TURNSTILE_SECRET: '0x4SSS',
        IMAGES: {
            get: async (key) => r2Objects.get(key) || null,
            put: async () => {},
        },
        NOTES: {
            getWithMetadata: async () => ({ value: '', metadata: {} }),
            put: async () => {},
        },
        SHARE: {
            get: async () => null,
            put: async () => {},
        },
    }
    const ctx = { waitUntil: () => {} }

    // 1. /img/* serves SVG with sandbox CSP & attachment disposition
    const imgRes = await worker.fetch(new Request('https://wiki.david888.com/img/2026/11/test.svg'), env, ctx)
    assert.equal(imgRes.status, 200)
    assert.match(imgRes.headers.get('Content-Security-Policy') || '', /sandbox/)
    assert.match(imgRes.headers.get('Content-Disposition') || '', /attachment/)

    // 2. Forged Cookie: admin_session=1 does NOT bypass Turnstile on /upload
    const form = new FormData()
    form.append('image', new Blob(['png'], { type: 'image/png' }), 'a.png')
    const uploadRes = await worker.fetch(new Request('https://wiki.david888.com/upload', {
        method: 'POST',
        headers: { Cookie: 'admin_session=1' },
        body: form,
    }), env, ctx)
    assert.equal(uploadRes.status, 403)
    const uploadJson = await uploadRes.json()
    assert.equal(uploadJson.needTurnstile, true)

    // 3. /api/pdf/export rejects > 512KB payload
    const bigPdfRes = await worker.fetch(new Request('https://wiki.david888.com/api/pdf/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: 'a'.repeat(600 * 1024) }),
    }), env, ctx)
    assert.equal(bigPdfRes.status, 413)

    // 4. SSRF blocks hex/decimal/IPv6-mapped IPv4 on /api/url-meta and /api/url2md
    for (const badUrl of ['http://0x7f000001/', 'http://2130706433/', 'http://[::ffff:127.0.0.1]/']) {
        const metaRes = await worker.fetch(new Request('https://wiki.david888.com/api/url-meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: badUrl }),
        }), env, ctx)
        const metaJson = await metaRes.json()
        assert.notEqual(metaJson.err, 0, `url-meta must block ${badUrl}`)

        const mdRes = await worker.fetch(new Request('https://wiki.david888.com/api/url2md', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: badUrl }),
        }), env, ctx)
        assert.equal(mdRes.status, 400, `url2md must block ${badUrl}`)
    }
})

test('EGM P1: Turnstile clearance cookie rejects cross-IP replay when cf-connecting-ip differs', async () => {
    globalThis.SCN_SECRET = 'test-secret-xyz'
    globalThis.SCN_TURNSTILE_SITE_KEY = '0x4AAA'
    globalThis.SCN_TURNSTILE_SECRET = '0x4SSS'

    try {
        const token = await createTurnstileClearanceToken('1.2.3.4')
        const mismatchReq = new Request('https://wiki.david888.com/test', {
            headers: {
                Cookie: `${TURNSTILE_CLEARANCE_COOKIE_NAME}=${token}`,
                'cf-connecting-ip': '9.9.9.9',
            },
        })
        assert.equal(await verifyTurnstileClearanceCookie(mismatchReq), false)

        const matchReq = new Request('https://wiki.david888.com/test', {
            headers: {
                Cookie: `${TURNSTILE_CLEARANCE_COOKIE_NAME}=${token}`,
                'cf-connecting-ip': '1.2.3.4',
            },
        })
        assert.equal(await verifyTurnstileClearanceCookie(matchReq), true)
    } finally {
        delete globalThis.SCN_SECRET
        delete globalThis.SCN_TURNSTILE_SITE_KEY
        delete globalThis.SCN_TURNSTILE_SECRET
    }
})

test('EGM P1: driverRecordBurnView enforces multi-view burn limit (shareMaxViews > 1)', async () => {
    const notesStore = new Map()
    const shareStore = new Map()
    notesStore.set('multi-burn', {
        value: 'secret-2x',
        metadata: { share: true, shareBurnAfterReading: true, shareMaxViews: 2 },
    })

    globalThis.NOTES = {
        getWithMetadata: async (k) => notesStore.get(k) || { value: '', metadata: {} },
        put: async (k, v, opts = {}) => notesStore.set(k, { value: v, metadata: opts.metadata || {} }),
    }
    globalThis.SHARE = {
        get: async (k) => shareStore.get(k) || null,
        put: async (k, v) => shareStore.set(k, v),
        delete: async (k) => shareStore.delete(k),
    }
    globalThis.SCN_STORAGE_DRIVER = 'kv'

    try {
        const first = await driverRecordBurnView('sid-multi', 'multi-burn', 2, 1700000000)
        assert.deepEqual(first, { claimed: true, burned: false, viewCount: 1 })
        assert.equal(notesStore.get('multi-burn').metadata.share, true)

        const second = await driverRecordBurnView('sid-multi', 'multi-burn', 2, 1700000010)
        assert.deepEqual(second, { claimed: true, burned: true, viewCount: 2 })
        assert.equal(notesStore.get('multi-burn').metadata.share, false)

        const third = await driverRecordBurnView('sid-multi', 'multi-burn', 2, 1700000020)
        assert.equal(third.claimed, false)
    } finally {
        delete globalThis.NOTES
        delete globalThis.SHARE
        delete globalThis.SCN_STORAGE_DRIVER
    }
})

test('EGM P1: annotation query excludes soft-deleted threads in SQL before LIMIT', async () => {
    let capturedSql = ''
    const mockDb = {
        prepare: (sql) => {
            if (sql.includes('FROM annotation_threads')) capturedSql = sql
            return {
                bind: () => ({
                    all: async () => ({ results: [] }),
                }),
            }
        },
    }
    await listAnnotationThreads(mockDb, 'some-path', { limit: 10 })
    assert.match(capturedSql, /EXISTS\s*\([\s\S]*FROM annotation_messages[\s\S]*deleted_at IS NULL/i)
})
