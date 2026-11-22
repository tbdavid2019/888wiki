import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { webcrypto } from 'node:crypto'

import { handleAccountRoutes } from '../src/account_routes.mjs'
import {
    MAX_ACCOUNT_BODY_BYTES,
    SESSION_COOKIE_NAME,
    MAX_PENDING_CHALLENGES_PER_BUCKET,
    CHALLENGE_TTL_SECONDS,
    assertAccountFeatureReady,
    registerPasskeyStart,
    registerPasskeyFinish,
    loginPasskeyStart,
    loginPasskeyFinish,
    stepupStart,
    stepupFinish,
    addPasskeyStart,
    addPasskeyFinish,
    removePasskey,
    sanitizeNickname,
} from '../src/account_data.mjs'
import { bytesToBase64Url, base64UrlToBytes } from '../src/webauthn_core.mjs'

const crypto = webcrypto
const encoder = new TextEncoder()
const ORIGIN = 'https://wiki.example.com'
const RP_ID = 'wiki.example.com'

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

function makeAccountEnv({ turnstileFlag = '0', turnstileSiteKey = '', turnstileSecret = '', maintenance = '0', secret = 'test-scn-secret-123456' } = {}) {
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
            SCN_SECRET: secret,
            SCN_MAINTENANCE_MODE: maintenance,
            SCN_ENABLE_TURNSTILE: turnstileFlag,
            SCN_TURNSTILE_SITE_KEY: turnstileSiteKey,
            SCN_TURNSTILE_SECRET: turnstileSecret,
            NOTES_DB: db,
            APP_DB: db,
        },
    }
}

// CBOR & WebAuthn test builders
function encodeDerInt(bytes) {
    let start = 0
    while (start < bytes.length - 1 && bytes[start] === 0x00) start++
    const trimmed = bytes.slice(start)
    if (trimmed[0] & 0x80) return new Uint8Array([0x02, trimmed.length + 1, 0x00, ...trimmed])
    return new Uint8Array([0x02, trimmed.length, ...trimmed])
}
function p1363ToDer(p1363Sig) {
    const rDer = encodeDerInt(p1363Sig.slice(0, 32))
    const sDer = encodeDerInt(p1363Sig.slice(32, 64))
    return new Uint8Array([0x30, rDer.length + sDer.length, ...rDer, ...sDer])
}
function cborUintHeader(majorType, len) {
    const prefix = majorType << 5
    if (len < 24) return new Uint8Array([prefix | len])
    if (len <= 0xff) return new Uint8Array([prefix | 24, len])
    return new Uint8Array([prefix | 25, len >> 8, len & 0xff])
}
function cborInt(n) {
    return n >= 0 ? cborUintHeader(0, n) : cborUintHeader(1, -1 - n)
}
function cborBytes(bytes) {
    const h = cborUintHeader(2, bytes.length)
    return new Uint8Array([...h, ...bytes])
}
function cborText(str) {
    const b = encoder.encode(str)
    const h = cborUintHeader(3, b.length)
    return new Uint8Array([...h, ...b])
}
function concatBytes(...arrays) {
    const total = arrays.reduce((a, b) => a + b.length, 0)
    const out = new Uint8Array(total)
    let off = 0
    for (const a of arrays) { out.set(a, off); off += a.length }
    return out
}
function cborMap(entries) {
    const parts = [cborUintHeader(5, entries.length)]
    for (const [k, v] of entries) {
        parts.push(typeof k === 'number' ? cborInt(k) : cborText(k))
        parts.push(v)
    }
    return concatBytes(...parts)
}

async function generatePasskeyFixture({ be = false, bs = false } = {}) {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
    const credIdBytes = crypto.getRandomValues(new Uint8Array(16))
    const credentialId = bytesToBase64Url(credIdBytes)
    const coseKey = cborMap([
        [1, cborInt(2)],
        [3, cborInt(-7)],
        [-1, cborInt(1)],
        [-2, cborBytes(rawPub.slice(1, 33))],
        [-3, cborBytes(rawPub.slice(33, 65))],
    ])
    return { keyPair, credIdBytes, credentialId, coseKey, be, bs }
}

async function buildRegistrationPayload(fixture, { challenge, origin = ORIGIN, rpId = RP_ID, signCount = 0, up = true, uv = true } = {}) {
    const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(rpId)))
    const flags = (up ? 0x01 : 0) | (uv ? 0x04 : 0) | (fixture.be ? 0x08 : 0) | (fixture.bs ? 0x10 : 0) | 0x40
    const header = new Uint8Array(37 + 16 + 2)
    header.set(rpIdHash, 0)
    header[32] = flags
    header[33] = (signCount >>> 24) & 0xff
    header[34] = (signCount >>> 16) & 0xff
    header[35] = (signCount >>> 8) & 0xff
    header[36] = signCount & 0xff
    header[53] = (fixture.credIdBytes.length >> 8) & 0xff
    header[54] = fixture.credIdBytes.length & 0xff
    const authData = concatBytes(header, fixture.credIdBytes, fixture.coseKey)
    const attestationObject = cborMap([
        ['fmt', cborText('none')],
        ['attStmt', cborMap([])],
        ['authData', cborBytes(authData)],
    ])
    const clientDataJSON = encoder.encode(JSON.stringify({
        type: 'webauthn.create',
        challenge,
        origin,
        crossOrigin: false,
    }))
    return {
        id: fixture.credentialId,
        rawId: fixture.credentialId,
        type: 'public-key',
        response: {
            clientDataJSON: bytesToBase64Url(clientDataJSON),
            attestationObject: bytesToBase64Url(attestationObject),
            transports: ['internal'],
        },
    }
}

async function buildAssertionPayload(fixture, { challenge, origin = ORIGIN, rpId = RP_ID, signCount = 1, up = true, uv = true, be = fixture.be, bs = fixture.bs, userHandle = null } = {}) {
    const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(rpId)))
    const authData = new Uint8Array(37)
    authData.set(rpIdHash, 0)
    authData[32] = (up ? 0x01 : 0) | (uv ? 0x04 : 0) | (be ? 0x08 : 0) | (bs ? 0x10 : 0)
    authData[33] = (signCount >>> 24) & 0xff
    authData[34] = (signCount >>> 16) & 0xff
    authData[35] = (signCount >>> 8) & 0xff
    authData[36] = signCount & 0xff
    const clientDataBytes = encoder.encode(JSON.stringify({
        type: 'webauthn.get',
        challenge,
        origin,
        crossOrigin: false,
    }))
    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))
    const sigBase = concatBytes(authData, clientDataHash)
    const p1363Sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, fixture.keyPair.privateKey, sigBase))
    const derSig = p1363ToDer(p1363Sig)
    return {
        id: fixture.credentialId,
        rawId: fixture.credentialId,
        type: 'public-key',
        response: {
            clientDataJSON: bytesToBase64Url(clientDataBytes),
            authenticatorData: bytesToBase64Url(authData),
            signature: bytesToBase64Url(derSig),
            userHandle,
        },
    }
}

function apiRequest(path, { method = 'POST', body, cookie = '', origin = ORIGIN, secFetchSite = 'same-origin', contentType = 'application/json', rawBody } = {}) {
    const headers = new Headers()
    if (origin !== null) headers.set('Origin', origin)
    if (secFetchSite !== null) headers.set('Sec-Fetch-Site', secFetchSite)
    if (contentType !== null && method !== 'GET' && method !== 'HEAD') headers.set('Content-Type', contentType)
    if (cookie) headers.set('Cookie', cookie)
    return new Request(`${ORIGIN}${path}`, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : (rawBody !== undefined ? rawBody : JSON.stringify(body ?? {})),
    })
}

function extractSessionCookie(res) {
    const setCookie = res.headers.get('Set-Cookie') || ''
    const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
    return match ? `${SESSION_COOKIE_NAME}=${match[1]}` : ''
}

test('anonymous challenge caps are atomic and isolated by client and purpose', async () => {
    const { env, db } = makeAccountEnv()
    env.SCN_AUTH_RATE_LIMIT = '1000'
    const now = 1700000000
    const request = ip => new Request(ORIGIN, { headers: { 'CF-Connecting-IP': ip } })
    const clientA = request('192.0.2.1')
    const clientB = request('192.0.2.2')

    for (const [purpose, start] of [
        ['register', (req, time) => registerPasskeyStart(req, env, { nickname: 'Alice' }, { nowUnix: time })],
        ['login', (req, time) => loginPasskeyStart(req, env, { nowUnix: time })],
    ]) {
        const first = await start(clientA, now)
        const attempts = await Promise.allSettled(Array.from({ length: MAX_PENDING_CHALLENGES_PER_BUCKET + 3 }, () => start(clientA, now + 1)))
        assert.equal(attempts.filter(result => result.status === 'fulfilled').length, MAX_PENDING_CHALLENGES_PER_BUCKET - 1)
        for (const result of attempts.filter(result => result.status === 'rejected')) {
            assert.equal(result.reason.code, 'TOO_MANY_PENDING_CHALLENGES')
        }
        await start(clientB, now + 1)
        const rows = db.sqlite.prepare('SELECT challenge FROM auth_challenges WHERE purpose = ?').all(purpose)
        assert.equal(rows.length, MAX_PENDING_CHALLENGES_PER_BUCKET + 1)
        db.sqlite.prepare('UPDATE auth_challenges SET consumed_nonce = ? WHERE challenge = ?').run('used', first.challenge)
        await assert.rejects(start(clientA, now + CHALLENGE_TTL_SECONDS), { code: 'TOO_MANY_PENDING_CHALLENGES' })
        await start(clientA, now + CHALLENGE_TTL_SECONDS + 1)
    }
})

test('registration Turnstile tri-state (disabled / misconfigured / enabled) and single-use token replay rejection', async () => {
    // 1. Misconfigured Turnstile fails closed with 503
    {
        const { env } = makeAccountEnv({ turnstileFlag: '1', turnstileSiteKey: 'site-only', turnstileSecret: '' })
        const res = await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { body: { nickname: 'Alice' } }), env)
        assert.equal(res.status, 503)
        const json = await res.json()
        assert.equal(json.code, 'TURNSTILE_MISCONFIGURED')
    }

    // 2. Enabled Turnstile enforces siteverify & single-use used_turnstile_tokens
    const origFetch = globalThis.fetch
    let siteverifyCalls = 0
    globalThis.fetch = async (url) => {
        if (String(url).includes('siteverify')) {
            siteverifyCalls += 1
            return new Response(JSON.stringify({
                success: true,
                hostname: RP_ID,
                action: 'passkey_register',
            }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        throw new Error('Unexpected fetch')
    }

    try {
        const { env, db } = makeAccountEnv({
            turnstileFlag: '1',
            turnstileSiteKey: 'site-key-1',
            turnstileSecret: 'secret-key-1',
        })
        const fixture1 = await generatePasskeyFixture()
        const optsRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { body: { nickname: 'Alice' } }), env)
        assert.equal(optsRes.status, 200)
        const opts = await optsRes.json()

        const cred1 = await buildRegistrationPayload(fixture1, { challenge: opts.challenge })
        const verifyRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/register/verify', {
            body: { challenge: opts.challenge, nickname: 'Alice', turnstileToken: 'ts-tok-unique', credential: cred1 },
        }), env)
        assert.equal(verifyRes.status, 200)
        assert.equal(siteverifyCalls, 1)
        const cookie = extractSessionCookie(verifyRes)
        assert.ok(cookie.startsWith(`${SESSION_COOKIE_NAME}=`))
        assert.match(verifyRes.headers.get('Set-Cookie'), /HttpOnly/i)
        assert.match(verifyRes.headers.get('Set-Cookie'), /SameSite=Lax/i)
        assert.match(verifyRes.headers.get('Set-Cookie'), /Secure/i)

        // Replay the same Turnstile token for a second registration -> atomic batch fails with zero mutations!
        const fixture2 = await generatePasskeyFixture()
        const optsRes2 = await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { body: { nickname: 'Bob' } }), env)
        const opts2 = await optsRes2.json()
        const cred2 = await buildRegistrationPayload(fixture2, { challenge: opts2.challenge })
        const replayRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/register/verify', {
            body: { challenge: opts2.challenge, nickname: 'Bob', turnstileToken: 'ts-tok-unique', credential: cred2 },
        }), env)
        assert.equal(replayRes.status, 409)
        assert.equal(replayRes.headers.get('Set-Cookie'), null)
        const acctCount = db.sqlite.prepare('SELECT COUNT(*) AS c FROM accounts').get()
        assert.equal(acctCount.c, 1)
        const cred2Count = db.sqlite.prepare('SELECT COUNT(*) AS c FROM account_passkeys WHERE credential_id = ?').get(fixture2.credentialId)
        assert.equal(cred2Count.c, 0)
    } finally {
        globalThis.fetch = origFetch
    }
})

test('register/verify atomic rollback on duplicate credential leaves zero mutations and no session cookie', async () => {
    const { env, db } = makeAccountEnv()
    const fixture = await generatePasskeyFixture()

    const opts1 = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { body: { nickname: 'Alice' } }), env)).json()
    const cred1 = await buildRegistrationPayload(fixture, { challenge: opts1.challenge })
    const res1 = await handleAccountRoutes(apiRequest('/api/auth/passkey/register/verify', {
        body: { challenge: opts1.challenge, nickname: 'Alice', credential: cred1 },
    }), env)
    assert.equal(res1.status, 200)

    // Attempt second account registration with same credentialId
    const opts2 = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { body: { nickname: 'Clone' } }), env)).json()
    const cred2 = await buildRegistrationPayload(fixture, { challenge: opts2.challenge })
    const res2 = await handleAccountRoutes(apiRequest('/api/auth/passkey/register/verify', {
        body: { challenge: opts2.challenge, nickname: 'Clone', credential: cred2 },
    }), env)
    assert.equal(res2.status, 409)
    assert.equal(res2.headers.get('Set-Cookie'), null)
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS c FROM accounts').get().c, 1)
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS c FROM account_sessions').get().c, 1)
    // Failed batch keeps challenge unconsumed (not mutated)
    const chRow = db.sqlite.prepare('SELECT consumed_nonce FROM auth_challenges WHERE challenge = ?').get(opts2.challenge)
    assert.equal(chRow.consumed_nonce, null)
})

test('login/verify enforces Step 0, BE parity, monotonicity, and counter-CAS race (0 sessions on CAS loss)', async () => {
    const { env, db } = makeAccountEnv()
    const deviceBound = await generatePasskeyFixture({ be: false, bs: false })

    // Register with signCount = 5
    const regOpts = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { body: { nickname: 'Alice' } }), env)).json()
    const regCred = await buildRegistrationPayload(deviceBound, { challenge: regOpts.challenge, signCount: 5 })
    const regRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/register/verify', {
        body: { challenge: regOpts.challenge, nickname: 'Alice', credential: regCred },
    }), env)
    assert.equal(regRes.status, 200)

    // Unknown / Admin FIDO credential rejected clearly
    const unknownFixture = await generatePasskeyFixture()
    const lOpts0 = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { body: {} }), env)).json()
    const unknownAssert = await buildAssertionPayload(unknownFixture, { challenge: lOpts0.challenge, signCount: 1 })
    const unknownRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/login/verify', {
        body: { challenge: lOpts0.challenge, credential: unknownAssert },
    }), env)
    assert.equal(unknownRes.status, 401)
    assert.equal((await unknownRes.json()).code, 'UNKNOWN_PASSKEY_CREDENTIAL')

    // BE parity mismatch (stored be=false, asserted be=true) rejected
    const lOpts1 = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { body: {} }), env)).json()
    const beMismatchAssert = await buildAssertionPayload(deviceBound, { challenge: lOpts1.challenge, signCount: 6, be: true, bs: false })
    const beMismatchRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/login/verify', {
        body: { challenge: lOpts1.challenge, credential: beMismatchAssert },
    }), env)
    assert.equal(beMismatchRes.status, 400)
    assert.equal((await beMismatchRes.json()).code, 'WEBAUTHN_BACKUP_ELIGIBLE_MISMATCH')

    // Counter regression (stored=5, asserted=5) rejected
    const regressedAssert = await buildAssertionPayload(deviceBound, { challenge: lOpts1.challenge, signCount: 5 })
    const regressedRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/login/verify', {
        body: { challenge: lOpts1.challenge, credential: regressedAssert },
    }), env)
    assert.equal(regressedRes.status, 400)
    assert.equal((await regressedRes.json()).code, 'WEBAUTHN_SIGN_COUNT_REGRESSION')

    // Counter CAS race: two distinct login challenges verified concurrently against stored sign_count=5
    const lOptsA = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { body: {} }), env)).json()
    const lOptsB = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { body: {} }), env)).json()
    const assertA = await buildAssertionPayload(deviceBound, { challenge: lOptsA.challenge, signCount: 6 })
    const assertB = await buildAssertionPayload(deviceBound, { challenge: lOptsB.challenge, signCount: 7 })

    const sessionsBefore = db.sqlite.prepare('SELECT COUNT(*) AS c FROM account_sessions').get().c
    const [resA, resB] = await Promise.all([
        handleAccountRoutes(apiRequest('/api/auth/passkey/login/verify', { body: { challenge: lOptsA.challenge, credential: assertA } }), env),
        handleAccountRoutes(apiRequest('/api/auth/passkey/login/verify', { body: { challenge: lOptsB.challenge, credential: assertB } }), env),
    ])
    const statuses = [resA.status, resB.status].sort()
    assert.deepEqual(statuses, [200, 409])
    const sessionsAfter = db.sqlite.prepare('SELECT COUNT(*) AS c FROM account_sessions').get().c
    assert.equal(sessionsAfter, sessionsBefore + 1)

    // Synced passkey (BE=1) allows signCount=0 repeatedly and rejects BE=1 -> BE=0 mismatch
    const synced = await generatePasskeyFixture({ be: true, bs: true })
    const sRegOpts = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { body: { nickname: 'SyncedUser' } }), env)).json()
    const sRegCred = await buildRegistrationPayload(synced, { challenge: sRegOpts.challenge, signCount: 0 })
    assert.equal((await handleAccountRoutes(apiRequest('/api/auth/passkey/register/verify', {
        body: { challenge: sRegOpts.challenge, nickname: 'SyncedUser', credential: sRegCred },
    }), env)).status, 200)

    const sLoginOpts = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { body: {} }), env)).json()
    const sZeroAssert = await buildAssertionPayload(synced, { challenge: sLoginOpts.challenge, signCount: 0, be: true, bs: true })
    assert.equal((await handleAccountRoutes(apiRequest('/api/auth/passkey/login/verify', {
        body: { challenge: sLoginOpts.challenge, credential: sZeroAssert },
    }), env)).status, 200)

    const sLoginOpts2 = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { body: {} }), env)).json()
    const sBeDropAssert = await buildAssertionPayload(synced, { challenge: sLoginOpts2.challenge, signCount: 0, be: false, bs: false })
    const sBeDropRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/login/verify', {
        body: { challenge: sLoginOpts2.challenge, credential: sBeDropAssert },
    }), env)
    assert.equal(sBeDropRes.status, 400)
    assert.equal((await sBeDropRes.json()).code, 'WEBAUTHN_BACKUP_ELIGIBLE_MISMATCH')
})

test('step-up cross-account rejection, add distinct binding hashes, concurrent removal (>1 invariant) & session revocation', async () => {
    const { env, db } = makeAccountEnv()
    const alicePasskey1 = await generatePasskeyFixture({ be: true, bs: true })
    const alicePasskey2 = await generatePasskeyFixture({ be: true, bs: true })
    const bobPasskey = await generatePasskeyFixture({ be: true, bs: true })

    // Register Alice
    const aOpts = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { body: { nickname: 'Alice' } }), env)).json()
    const aCred = await buildRegistrationPayload(alicePasskey1, { challenge: aOpts.challenge })
    const aRegRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/register/verify', {
        body: { challenge: aOpts.challenge, nickname: 'Alice', credential: aCred },
    }), env)
    const aliceCookie1 = extractSessionCookie(aRegRes)

    // Register Bob
    const bOpts = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { body: { nickname: 'Bob' } }), env)).json()
    const bCred = await buildRegistrationPayload(bobPasskey, { challenge: bOpts.challenge })
    await handleAccountRoutes(apiRequest('/api/auth/passkey/register/verify', {
        body: { challenge: bOpts.challenge, nickname: 'Bob', credential: bCred },
    }), env)

    // Cross-account step-up rejection: Bob's passkey answering Alice's stepup challenge
    const stepAddOpts = await (await handleAccountRoutes(apiRequest('/api/account/passkeys/stepup/options', {
        cookie: aliceCookie1,
        body: { purpose: 'passkey_add_stepup' },
    }), env)).json()
    const bobCrossAssert = await buildAssertionPayload(bobPasskey, { challenge: stepAddOpts.challenge })
    const crossRes = await handleAccountRoutes(apiRequest('/api/account/passkeys/stepup/verify', {
        cookie: aliceCookie1,
        body: { challenge: stepAddOpts.challenge, credential: bobCrossAssert },
    }), env)
    assert.equal(crossRes.status, 403)
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS c FROM stepup_grants').get().c, 0)

    // Alice completes valid step-up for 'passkey_add_stepup'
    const aliceAssert = await buildAssertionPayload(alicePasskey1, { challenge: stepAddOpts.challenge })
    const grantAddRes = await handleAccountRoutes(apiRequest('/api/account/passkeys/stepup/verify', {
        cookie: aliceCookie1,
        body: { challenge: stepAddOpts.challenge, credential: aliceAssert },
    }), env)
    assert.equal(grantAddRes.status, 200)
    const { grantId: addGrantId, action } = await grantAddRes.json()
    assert.equal(action, 'add')

    // Alice adds second passkey (distinct binding_hash: 'register_add' vs 'passkey_add_stepup')
    const addOpts = await (await handleAccountRoutes(apiRequest('/api/account/passkeys/add/options', {
        cookie: aliceCookie1,
        body: { grantId: addGrantId },
    }), env)).json()
    const addCred2 = await buildRegistrationPayload(alicePasskey2, { challenge: addOpts.challenge })
    const addVerifyRes = await handleAccountRoutes(apiRequest('/api/account/passkeys/add/verify', {
        cookie: aliceCookie1,
        body: { challenge: addOpts.challenge, grantId: addGrantId, deviceLabel: 'iPhone', credential: addCred2 },
    }), env)
    assert.equal(addVerifyRes.status, 200)

    // Create a second active session for Alice via login
    const lOpts = await (await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { body: {} }), env)).json()
    const lAssert = await buildAssertionPayload(alicePasskey1, { challenge: lOpts.challenge })
    const loginRes2 = await handleAccountRoutes(apiRequest('/api/auth/passkey/login/verify', {
        body: { challenge: lOpts.challenge, credential: lAssert },
    }), env)
    const aliceCookie2 = extractSessionCookie(loginRes2)

    // Remove step-up grant on session 1, then concurrently remove passkey1 and passkey2
    const stepRmOpts1 = await (await handleAccountRoutes(apiRequest('/api/account/passkeys/stepup/options', {
        cookie: aliceCookie1,
        body: { purpose: 'passkey_remove_stepup' },
    }), env)).json()
    const stepRmOpts2 = await (await handleAccountRoutes(apiRequest('/api/account/passkeys/stepup/options', {
        cookie: aliceCookie1,
        body: { purpose: 'passkey_remove_stepup' },
    }), env)).json()
    const rmGrant1 = (await (await handleAccountRoutes(apiRequest('/api/account/passkeys/stepup/verify', {
        cookie: aliceCookie1,
        body: { challenge: stepRmOpts1.challenge, credential: await buildAssertionPayload(alicePasskey1, { challenge: stepRmOpts1.challenge }) },
    }), env)).json()).grantId
    const rmGrant2 = (await (await handleAccountRoutes(apiRequest('/api/account/passkeys/stepup/verify', {
        cookie: aliceCookie1,
        body: { challenge: stepRmOpts2.challenge, credential: await buildAssertionPayload(alicePasskey1, { challenge: stepRmOpts2.challenge }) },
    }), env)).json()).grantId

    // Cannot use a 'remove' grant for 'add/options'
    const mismatchGrantRes = await handleAccountRoutes(apiRequest('/api/account/passkeys/add/options', {
        cookie: aliceCookie1,
        body: { grantId: rmGrant1 },
    }), env)
    assert.equal(mismatchGrantRes.status, 403)

    // Concurrent removal of both passkeys: ONLY ONE succeeds, leaving >= 1 passkey intact!
    const [rmResA, rmResB] = await Promise.all([
        handleAccountRoutes(apiRequest(`/api/account/passkeys/${encodeURIComponent(alicePasskey2.credentialId)}`, {
            method: 'DELETE',
            cookie: aliceCookie1,
            body: { grantId: rmGrant1 },
        }), env),
        handleAccountRoutes(apiRequest(`/api/account/passkeys/${encodeURIComponent(alicePasskey1.credentialId)}`, {
            method: 'DELETE',
            cookie: aliceCookie1,
            body: { grantId: rmGrant2 },
        }), env),
    ])
    assert.deepEqual([rmResA.status, rmResB.status].sort(), [200, 409])
    const aliceId = db.sqlite.prepare("SELECT id FROM accounts WHERE nickname = 'Alice'").get().id
    const remainingKeys = db.sqlite.prepare('SELECT COUNT(*) AS c FROM account_passkeys WHERE account_id = ?').get(aliceId).c
    assert.equal(remainingKeys, 1)

    // Session 2 was revoked by passkey removal while Session 1 remains valid
    const me2 = await (await handleAccountRoutes(apiRequest('/api/account/me', { method: 'GET', cookie: aliceCookie2, origin: null, secFetchSite: null }), env)).json()
    assert.equal(me2.authenticated, false)
    const me1 = await (await handleAccountRoutes(apiRequest('/api/account/me', { method: 'GET', cookie: aliceCookie1, origin: null, secFetchSite: null }), env)).json()
    assert.equal(me1.authenticated, true)

    // Logout revokes Session 1 and clears cookie
    const logoutRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/logout', { cookie: aliceCookie1, body: {} }), env)
    assert.equal(logoutRes.status, 200)
    assert.match(logoutRes.headers.get('Set-Cookie'), /Max-Age=0/i)
    const afterLogoutMe = await (await handleAccountRoutes(apiRequest('/api/account/me', { method: 'GET', cookie: aliceCookie1, origin: null, secFetchSite: null }), env)).json()
    assert.equal(afterLogoutMe.authenticated, false)
})

test('CSRF (Origin + Sec-Fetch-Site + JSON), body > 32 KB, nickname sanitization, SCN_SECRET missing 503, and /_space headers', async () => {
    const { env } = makeAccountEnv()

    // Missing Origin
    assert.equal((await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { origin: null, body: {} }), env)).status, 403)
    // Cross-origin Origin
    assert.equal((await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { origin: 'https://evil.example', body: {} }), env)).status, 403)
    // Sec-Fetch-Site: cross-site
    assert.equal((await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { secFetchSite: 'cross-site', body: {} }), env)).status, 403)
    // Non-JSON Content-Type
    assert.equal((await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { contentType: 'text/plain', rawBody: '{}' }), env)).status, 415)
    // Body > 32 KB rejected 413 before JSON.parse
    const hugeBody = JSON.stringify({ nickname: 'a', pad: 'x'.repeat(MAX_ACCOUNT_BODY_BYTES + 100) })
    assert.equal((await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { rawBody: hugeBody }), env)).status, 413)
    // Invalid JSON rejected 400
    assert.equal((await handleAccountRoutes(apiRequest('/api/auth/passkey/register/options', { rawBody: '{bad json' }), env)).status, 400)

    // Nickname sanitization strips control/BiDi/zero-width chars
    assert.equal(sanitizeNickname('  \u200B\u202EAlice\u0007  '), 'Alice')
    assert.equal(sanitizeNickname('\u200B\u0000'), null)
    assert.equal(sanitizeNickname('a'.repeat(41)), null)

    // Missing SCN_SECRET fails closed 503
    const { env: noSecretEnv } = makeAccountEnv({ secret: '' })
    const noSecRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { body: {} }), noSecretEnv)
    assert.equal(noSecRes.status, 503)
    assert.equal((await noSecRes.json()).code, 'STORAGE_UNAVAILABLE')

    // Maintenance mode blocks writes with 503 MAINTENANCE_MODE
    const { env: maintEnv } = makeAccountEnv({ maintenance: '1' })
    const maintRes = await handleAccountRoutes(apiRequest('/api/auth/passkey/login/options', { body: {} }), maintEnv)
    assert.equal(maintRes.status, 503)
    assert.equal((await maintRes.json()).code, 'MAINTENANCE_MODE')

    // Missing accounts.sql tables fails closed 503 D1_SCHEMA_MISSING
    const partialDb = createSqliteD1(['notes_d1.sql', 'notes_registry.sql', 'note_annotations.sql'])
    const partialEnv = { ...env, NOTES_DB: partialDb, APP_DB: partialDb }
    await assert.rejects(() => assertAccountFeatureReady(partialEnv), { code: 'D1_SCHEMA_MISSING', status: 503 })

    // GET & HEAD /_space security headers & CSP
    const spaceRes = await handleAccountRoutes(new Request(`${ORIGIN}/_space`, { method: 'GET' }), env)
    assert.equal(spaceRes.status, 200)
    assert.equal(spaceRes.headers.get('Cache-Control'), 'no-store')
    assert.equal(spaceRes.headers.get('X-Robots-Tag'), 'noindex, nofollow')
    assert.equal(spaceRes.headers.get('Referrer-Policy'), 'no-referrer')
    assert.match(spaceRes.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/)

    const headSpace = await handleAccountRoutes(new Request(`${ORIGIN}/_space`, { method: 'HEAD' }), env)
    assert.equal(headSpace.status, 200)
    assert.equal(await headSpace.text(), '')
})
