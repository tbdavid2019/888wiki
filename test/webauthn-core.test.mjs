import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'

import {
    WebAuthnError,
    base64UrlToBytes,
    bytesToBase64Url,
    generateChallenge,
    computeBindingHash,
    resolveExpectedOriginAndRpId,
    decodeCborSafe,
    derToP1363Strict,
    checkSignCountPolicy,
    verifyRegistrationResponse,
    verifyAuthenticationResponse,
    COSE_ALG_ES256,
    COSE_ALG_RS256,
} from '../src/webauthn_core.mjs'

import {
    verifyFidoRegistration,
    verifyFidoAssertion,
    derToP1363,
    decodeCbor,
} from '../src/fido_auth.mjs'

const crypto = webcrypto
const encoder = new TextEncoder()

function encodeDerInt(bytes) {
    let start = 0
    while (start < bytes.length - 1 && bytes[start] === 0x00) start++
    const trimmed = bytes.slice(start)
    if (trimmed[0] & 0x80) {
        return new Uint8Array([0x02, trimmed.length + 1, 0x00, ...trimmed])
    }
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
    if (len <= 0xffff) return new Uint8Array([prefix | 25, len >> 8, len & 0xff])
    return new Uint8Array([prefix | 26, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff])
}

function cborInt(n) {
    if (n >= 0) return cborUintHeader(0, n)
    return cborUintHeader(1, -1 - n)
}

function cborBytes(bytes) {
    const h = cborUintHeader(2, bytes.length)
    const out = new Uint8Array(h.length + bytes.length)
    out.set(h, 0)
    out.set(bytes, h.length)
    return out
}

function cborText(str) {
    const bytes = encoder.encode(str)
    const h = cborUintHeader(3, bytes.length)
    const out = new Uint8Array(h.length + bytes.length)
    out.set(h, 0)
    out.set(bytes, h.length)
    return out
}

function concatBytes(...arrays) {
    const total = arrays.reduce((acc, a) => acc + a.length, 0)
    const out = new Uint8Array(total)
    let offset = 0
    for (const a of arrays) {
        out.set(a, offset)
        offset += a.length
    }
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

function buildEs256CoseKey(rawPubBytes) {
    const x = rawPubBytes.slice(1, 33)
    const y = rawPubBytes.slice(33, 65)
    return cborMap([
        [1, cborInt(2)],
        [3, cborInt(-7)],
        [-1, cborInt(1)],
        [-2, cborBytes(x)],
        [-3, cborBytes(y)],
    ])
}

function buildRs256CoseKey(jwk) {
    const n = base64UrlToBytes(jwk.n)
    const e = base64UrlToBytes(jwk.e)
    return cborMap([
        [1, cborInt(3)],
        [3, cborInt(-257)],
        [-1, cborBytes(n)],
        [-2, cborBytes(e)],
    ])
}

async function buildAttestationObject({ rpId, flags, signCount, credentialIdBytes, coseKeyBytes }) {
    const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(rpId)))
    const header = new Uint8Array(37 + 16 + 2)
    header.set(rpIdHash, 0)
    header[32] = flags
    header[33] = (signCount >>> 24) & 0xff
    header[34] = (signCount >>> 16) & 0xff
    header[35] = (signCount >>> 8) & 0xff
    header[36] = signCount & 0xff
    // 16 bytes aaguid (zeros)
    header[53] = (credentialIdBytes.length >> 8) & 0xff
    header[54] = credentialIdBytes.length & 0xff

    const authData = concatBytes(header, credentialIdBytes, coseKeyBytes)
    return cborMap([
        ['fmt', cborText('none')],
        ['attStmt', cborMap([])],
        ['authData', cborBytes(authData)],
    ])
}

async function buildAssertionAuthData({ rpId, flags, signCount }) {
    const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(rpId)))
    const authData = new Uint8Array(37)
    authData.set(rpIdHash, 0)
    authData[32] = flags
    authData[33] = (signCount >>> 24) & 0xff
    authData[34] = (signCount >>> 16) & 0xff
    authData[35] = (signCount >>> 8) & 0xff
    authData[36] = signCount & 0xff
    return authData
}

test('decodeCborSafe enforces depth <= 8, bounds, indefinite rejection, and rejects trailing bytes', () => {
    // Depth 8 nested array (allowed): 8 x 0x81 followed by 0x01
    const depth8 = new Uint8Array([...new Array(8).fill(0x81), 0x01])
    assert.ok(Array.isArray(decodeCborSafe(depth8)))

    // Depth 9 nested array (rejected): 9 x 0x81 followed by 0x01
    const depth9 = new Uint8Array([...new Array(9).fill(0x81), 0x01])
    assert.throws(() => decodeCborSafe(depth9), err => err instanceof WebAuthnError && err.code === 'WEBAUTHN_CBOR_ERROR')

    // Indefinite array 0x9f ... 0xff
    assert.throws(() => decodeCborSafe(new Uint8Array([0x9f, 0x01, 0xff])), /Indefinite-length/)

    // Truncated byte string
    assert.throws(() => decodeCborSafe(new Uint8Array([0x45, 0x01, 0x02])), /Truncated CBOR byte string/)

    // Truncated map
    assert.throws(() => decodeCborSafe(new Uint8Array([0xa2, 0x01, 0x02])), /Truncated CBOR map/)

    // 64-bit huge length overflow attempt
    assert.throws(() => decodeCborSafe(new Uint8Array([0x5b, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])), /exceeds safety bounds/)

    // Trailing garbage
    assert.throws(() => decodeCborSafe(new Uint8Array([0x01, 0x02])), /Trailing bytes/)

    // Single container length > maxItems (256)
    const bigArr = concatBytes(cborUintHeader(4, 257), new Uint8Array(257).fill(0x01))
    assert.throws(() => decodeCborSafe(bigArr), /exceeds safety bounds/)

    // Total item count across nested containers > maxItems (256): 20 arrays of 15 items = 321 items
    const inner15 = concatBytes(cborUintHeader(4, 15), new Uint8Array(15).fill(0x01))
    const outer20 = concatBytes(cborUintHeader(4, 20), ...new Array(20).fill(inner15))
    assert.throws(() => decodeCborSafe(outer20), /item count exceeds limit/)

    // Duplicate map key
    assert.throws(() => decodeCborSafe(new Uint8Array([0xa2, 0x01, 0x02, 0x01, 0x03])), /Duplicate key/)
})

test('derToP1363Strict rejects raw 64-byte signatures and malformed DER encodings', () => {
    // Raw 64-byte signature must be rejected (no bypass)
    const raw64 = new Uint8Array(64).fill(0x11)
    assert.throws(() => derToP1363Strict(raw64), /missing SEQUENCE/)
    assert.throws(() => derToP1363(raw64), /missing SEQUENCE/)

    // Non-minimal zero padding (leading 0x00 when next byte < 0x80)
    const nonMinimal = new Uint8Array([
        0x30, 0x45,
        0x02, 0x21, 0x00, ...new Uint8Array(32).fill(0x11),
        0x02, 0x20, ...new Uint8Array(32).fill(0x22),
    ])
    assert.throws(() => derToP1363Strict(nonMinimal), /non-minimal zero padding/)

    // Negative integer (MSB set without leading 0x00)
    const negativeInt = new Uint8Array([
        0x30, 0x44,
        0x02, 0x20, ...new Uint8Array(32).fill(0x80),
        0x02, 0x20, ...new Uint8Array(32).fill(0x22),
    ])
    assert.throws(() => derToP1363Strict(negativeInt), /negative INTEGER/)

    // Valid 33-byte r with leading 0x00 before MSB >= 0x80
    const rHigh = new Uint8Array(32).fill(0x90)
    const sLow = new Uint8Array(32).fill(0x22)
    const validDer = new Uint8Array([
        0x30, 0x45,
        0x02, 0x21, 0x00, ...rHigh,
        0x02, 0x20, ...sLow,
    ])
    const parsed = derToP1363Strict(validDer)
    assert.deepEqual(parsed.slice(0, 32), rHigh)
    assert.deepEqual(parsed.slice(32, 64), sLow)

    // Trailing byte outside sequence
    assert.throws(() => derToP1363Strict(new Uint8Array([...validDer, 0x00])), /length mismatch/)
})

test('resolveExpectedOriginAndRpId handles single-origin, localhost HTTP/HTTPS, allowlists, and multi-origin fail-closed', () => {
    const prod = resolveExpectedOriginAndRpId(new Request('https://wiki.david888.com/api/auth/passkey/login/options'), {})
    assert.equal(prod.origin, 'https://wiki.david888.com')
    assert.equal(prod.rpId, 'wiki.david888.com')

    const localHttp = resolveExpectedOriginAndRpId(new Request('http://localhost:8787/api/auth/passkey/register/options'), {})
    assert.equal(localHttp.origin, 'http://localhost:8787')
    assert.equal(localHttp.rpId, 'localhost')

    const localHttps = resolveExpectedOriginAndRpId(new Request('https://localhost:8787/api/auth/passkey/register/options'), {})
    assert.equal(localHttps.origin, 'https://localhost:8787')
    assert.equal(localHttps.rpId, 'localhost')

    // Non-localhost HTTP must fail closed
    assert.throws(
        () => resolveExpectedOriginAndRpId(new Request('http://wiki.david888.com/api/auth/passkey/login/options'), {}),
        /Insecure origin scheme/
    )

    // Multi-subdomain allowlist with shared RP ID
    const multi = resolveExpectedOriginAndRpId(
        new Request('https://notes.david888.com/api/auth/passkey/login/options'),
        {
            SCN_PASSKEY_ORIGINS: 'https://wiki.david888.com, https://notes.david888.com',
            SCN_PASSKEY_RP_ID: 'david888.com',
        }
    )
    assert.equal(multi.origin, 'https://notes.david888.com')
    assert.equal(multi.rpId, 'david888.com')

    // Multi-origin mismatch: request origin not in allowlist
    assert.throws(
        () => resolveExpectedOriginAndRpId(
            new Request('https://evil.example.com/api/auth/passkey/login/options'),
            {
                SCN_PASSKEY_ORIGINS: 'https://wiki.david888.com,https://notes.david888.com',
                SCN_PASSKEY_RP_ID: 'david888.com',
            }
        ),
        /not in SCN_PASSKEY_ORIGINS/
    )

    // Multi-origin mismatch: allowlist contains origin outside RP ID
    assert.throws(
        () => resolveExpectedOriginAndRpId(
            new Request('https://wiki.david888.com/api/auth/passkey/login/options'),
            {
                SCN_PASSKEY_ORIGINS: 'https://wiki.david888.com,https://other-domain.com',
                SCN_PASSKEY_RP_ID: 'david888.com',
            }
        ),
        /does not match expected RP ID/
    )

    // Cross-origin Header mismatch
    assert.throws(
        () => resolveExpectedOriginAndRpId(
            new Request('https://wiki.david888.com/api/auth/passkey/login/options', {
                headers: { Origin: 'https://attacker.example' },
            }),
            {}
        ),
        /Cross-origin request rejected/
    )
})

test('computeBindingHash produces deterministic SHA-256 base64url bound to origin, rpId, purpose, and sessionId', async () => {
    const h1 = await computeBindingHash({
        origin: 'https://wiki.david888.com',
        rpId: 'wiki.david888.com',
        purpose: 'passkey_add_stepup',
        sessionId: 'sess-123',
    })
    const h2 = await computeBindingHash({
        origin: 'https://wiki.david888.com',
        rpId: 'wiki.david888.com',
        purpose: 'passkey_add_stepup',
        sessionId: 'sess-123',
    })
    const h3 = await computeBindingHash({
        origin: 'https://wiki.david888.com',
        rpId: 'wiki.david888.com',
        purpose: 'passkey_remove_stepup',
        sessionId: 'sess-123',
    })
    const h4 = await computeBindingHash({
        origin: 'https://wiki.david888.com',
        rpId: 'wiki.david888.com',
        purpose: 'register',
    })

    assert.equal(h1, h2)
    assert.equal(base64UrlToBytes(h1, { strict: true }).length, 32)
    assert.notEqual(h1, h3)
    assert.notEqual(h1, h4)
})

test('verifyRegistrationResponse and verifyAuthenticationResponse enforce WebAuthn invariants for ES256', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
    const coseKeyBytes = buildEs256CoseKey(rawPub)
    const credentialIdBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    const rawIdBase64 = bytesToBase64Url(credentialIdBytes)
    const userHandle = bytesToBase64Url(encoder.encode('user-handle-001'))
    const origin = 'https://wiki.david888.com'
    const rpId = 'wiki.david888.com'

    const regChallenge = generateChallenge()
    const regClientDataB64 = bytesToBase64Url(encoder.encode(JSON.stringify({
        type: 'webauthn.create',
        challenge: regChallenge,
        origin,
        crossOrigin: false,
    })))

    // UP=1 (0x01) | UV=1 (0x04) | AT=1 (0x40) => 0x45 (BE=0, BS=0)
    const attObj = await buildAttestationObject({
        rpId,
        flags: 0x45,
        signCount: 1,
        credentialIdBytes,
        coseKeyBytes,
    })

    const regResult = await verifyRegistrationResponse({
        attestationObjectBase64: bytesToBase64Url(attObj),
        clientDataJsonBase64: regClientDataB64,
        rawIdBase64,
        expectedChallenge: regChallenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    })

    assert.equal(regResult.credentialId, rawIdBase64)
    assert.equal(regResult.algorithm, COSE_ALG_ES256)
    assert.equal(regResult.backupEligible, false)
    assert.ok(regResult.publicKeySpki.length > 20)

    // Helper to sign an assertion
    async function signAssertion({ flags = 0x05, signCount = 2, type = 'webauthn.get', crossOrigin = false, assertRpId = rpId, challenge = generateChallenge() }) {
        const clientDataBytes = encoder.encode(JSON.stringify({
            type,
            challenge,
            origin,
            crossOrigin,
        }))
        const authDataBytes = await buildAssertionAuthData({ rpId: assertRpId, flags, signCount })
        const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))
        const sigBase = concatBytes(authDataBytes, clientDataHash)
        const p1363Sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, sigBase))
        const derSig = p1363ToDer(p1363Sig)
        return {
            challenge,
            authenticatorDataBase64: bytesToBase64Url(authDataBytes),
            clientDataJsonBase64: bytesToBase64Url(clientDataBytes),
            signatureBase64: bytesToBase64Url(derSig),
            rawIdBase64,
        }
    }

    const storedNonSynced = {
        credential_id: rawIdBase64,
        public_key_spki: regResult.publicKeySpki,
        algorithm: COSE_ALG_ES256,
        sign_count: 5,
        backup_eligible: 0,
    }

    // Valid assertion (signCount 6 > 5, BE=0 matches stored 0)
    const validAssert = await signAssertion({ flags: 0x05, signCount: 6 })
    const authRes = await verifyAuthenticationResponse({
        ...validAssert,
        userHandleBase64: userHandle,
        storedCredential: storedNonSynced,
        expectedChallenge: validAssert.challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
        expectedUserHandle: userHandle,
    })
    assert.equal(authRes.verified, true)
    assert.equal(authRes.signCount, 6)

    // Wrong rpIdHash
    const badRp = await signAssertion({ assertRpId: 'evil.com', signCount: 6 })
    await assert.rejects(() => verifyAuthenticationResponse({
        ...badRp,
        storedCredential: storedNonSynced,
        expectedChallenge: badRp.challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    }), err => err.code === 'WEBAUTHN_RPID_MISMATCH')

    // Wrong clientData.type
    const badType = await signAssertion({ type: 'webauthn.create', signCount: 6 })
    await assert.rejects(() => verifyAuthenticationResponse({
        ...badType,
        storedCredential: storedNonSynced,
        expectedChallenge: badType.challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    }), err => err.code === 'WEBAUTHN_TYPE_MISMATCH')

    // crossOrigin: true rejected
    const badCross = await signAssertion({ crossOrigin: true, signCount: 6 })
    await assert.rejects(() => verifyAuthenticationResponse({
        ...badCross,
        storedCredential: storedNonSynced,
        expectedChallenge: badCross.challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    }), err => err.code === 'WEBAUTHN_CROSS_ORIGIN')

    // Missing UV rejected for user Passkeys
    const noUv = await signAssertion({ flags: 0x01, signCount: 6 })
    await assert.rejects(() => verifyAuthenticationResponse({
        ...noUv,
        storedCredential: storedNonSynced,
        expectedChallenge: noUv.challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    }), err => err.code === 'WEBAUTHN_UV_REQUIRED')

    // BE=0 && BS=1 rejected (flags = 0x01 | 0x04 | 0x10 = 0x15)
    const invalidBeBs = await signAssertion({ flags: 0x15, signCount: 6 })
    await assert.rejects(() => verifyAuthenticationResponse({
        ...invalidBeBs,
        storedCredential: storedNonSynced,
        expectedChallenge: invalidBeBs.challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    }), err => err.code === 'WEBAUTHN_INVALID_BACKUP_STATE')

    // BE parity mismatch direction 1: stored BE=0, asserted BE=1 (flags = 0x01 | 0x04 | 0x08 = 0x0d)
    const beMismatch0to1 = await signAssertion({ flags: 0x0d, signCount: 6 })
    await assert.rejects(() => verifyAuthenticationResponse({
        ...beMismatch0to1,
        storedCredential: storedNonSynced,
        expectedChallenge: beMismatch0to1.challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    }), err => err.code === 'WEBAUTHN_BACKUP_ELIGIBLE_MISMATCH')

    // BE parity mismatch direction 2: stored BE=1, asserted BE=0
    const storedSynced = { ...storedNonSynced, backup_eligible: 1 }
    const beMismatch1to0 = await signAssertion({ flags: 0x05, signCount: 6 })
    await assert.rejects(() => verifyAuthenticationResponse({
        ...beMismatch1to0,
        storedCredential: storedSynced,
        expectedChallenge: beMismatch1to0.challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    }), err => err.code === 'WEBAUTHN_BACKUP_ELIGIBLE_MISMATCH')

    // Counter regression rejected when BE=0 (5 -> 5, 5 -> 3, 5 -> 0)
    for (const badCount of [5, 3, 0]) {
        const regAssert = await signAssertion({ flags: 0x05, signCount: badCount })
        await assert.rejects(() => verifyAuthenticationResponse({
            ...regAssert,
            storedCredential: storedNonSynced,
            expectedChallenge: regAssert.challenge,
            expectedOrigin: origin,
            expectedRpId: rpId,
        }), err => err.code === 'WEBAUTHN_SIGN_COUNT_REGRESSION')
    }

    // Synced BE=1 allows signCount=0 and non-monotonic counters
    for (const syncedCount of [0, 3, 5]) {
        const syncedAssert = await signAssertion({ flags: 0x0d, signCount: syncedCount })
        const ok = await verifyAuthenticationResponse({
            ...syncedAssert,
            storedCredential: storedSynced,
            expectedChallenge: syncedAssert.challenge,
            expectedOrigin: origin,
            expectedRpId: rpId,
        })
        assert.equal(ok.verified, true)
    }

    // userHandle mismatch rejected
    const wrongHandle = bytesToBase64Url(encoder.encode('other-user-handle'))
    await assert.rejects(() => verifyAuthenticationResponse({
        ...validAssert,
        userHandleBase64: wrongHandle,
        storedCredential: storedNonSynced,
        expectedChallenge: validAssert.challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
        expectedUserHandle: userHandle,
    }), err => err.code === 'WEBAUTHN_USER_HANDLE_MISMATCH')

    // checkSignCountPolicy standalone boundaries
    assert.equal(checkSignCountPolicy({ storedBackupEligible: false, storedSignCount: 0, assertedSignCount: 0 }).ok, true)
    assert.equal(checkSignCountPolicy({ storedBackupEligible: false, storedSignCount: 1, assertedSignCount: 1 }).ok, false)
    assert.equal(checkSignCountPolicy({ storedBackupEligible: true, storedSignCount: 10, assertedSignCount: 0 }).ok, true)
})

test('RS256 registration and authentication verification', async () => {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
    )
    const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
    const coseKeyBytes = buildRs256CoseKey(jwk)
    const credentialIdBytes = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1])
    const rawIdBase64 = bytesToBase64Url(credentialIdBytes)
    const origin = 'https://wiki.david888.com'
    const rpId = 'wiki.david888.com'

    const regChallenge = generateChallenge()
    const regClientDataB64 = bytesToBase64Url(encoder.encode(JSON.stringify({
        type: 'webauthn.create',
        challenge: regChallenge,
        origin,
    })))

    // UP | UV | BE | AT => 0x01 | 0x04 | 0x08 | 0x40 = 0x4d
    const attObj = await buildAttestationObject({
        rpId,
        flags: 0x4d,
        signCount: 0,
        credentialIdBytes,
        coseKeyBytes,
    })

    const reg = await verifyRegistrationResponse({
        attestationObjectBase64: bytesToBase64Url(attObj),
        clientDataJsonBase64: regClientDataB64,
        rawIdBase64,
        expectedChallenge: regChallenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    })

    assert.equal(reg.algorithm, COSE_ALG_RS256)
    assert.equal(reg.backupEligible, true)
    assert.equal(reg.publicKeyRaw, null)
    assert.ok(reg.publicKeySpki.length > 100)

    const loginChallenge = generateChallenge()
    const clientDataBytes = encoder.encode(JSON.stringify({
        type: 'webauthn.get',
        challenge: loginChallenge,
        origin,
    }))
    const authDataBytes = await buildAssertionAuthData({ rpId, flags: 0x0d, signCount: 0 })
    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))
    const sigBase = concatBytes(authDataBytes, clientDataHash)
    const sig = new Uint8Array(await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, keyPair.privateKey, sigBase))

    const auth = await verifyAuthenticationResponse({
        authenticatorDataBase64: bytesToBase64Url(authDataBytes),
        clientDataJsonBase64: bytesToBase64Url(clientDataBytes),
        signatureBase64: bytesToBase64Url(sig),
        rawIdBase64,
        storedCredential: {
            credential_id: rawIdBase64,
            public_key_spki: reg.publicKeySpki,
            algorithm: COSE_ALG_RS256,
            sign_count: 0,
            backup_eligible: 1,
        },
        expectedChallenge: loginChallenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    })
    assert.equal(auth.verified, true)
})

test('Admin FIDO (fido_auth.mjs) inherits hardened CBOR/DER/rpId/type checks while allowing UV=0 when UP=1', async () => {
    const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const rawPub = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
    const origin = 'https://wiki.david888.com'
    const rpId = 'wiki.david888.com'

    // Admin registration with UP=1, UV=0 (flags = 0x41) succeeds
    const regChallenge = generateChallenge()
    const attObj = await buildAttestationObject({
        rpId,
        flags: 0x41,
        signCount: 0,
        credentialIdBytes: new Uint8Array([1, 2, 3, 4]),
        coseKeyBytes: buildEs256CoseKey(rawPub),
    })
    const reg = await verifyFidoRegistration({
        attestationObjectBase64: bytesToBase64Url(attObj),
        clientDataJsonBase64: bytesToBase64Url(encoder.encode(JSON.stringify({
            type: 'webauthn.create',
            challenge: regChallenge,
            origin,
        }))),
        expectedChallenge: regChallenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    })
    assert.equal(reg.up, true)
    assert.equal(reg.uv, false)

    // Admin FIDO rejects malformed deep CBOR
    const depth9 = new Uint8Array([...new Array(9).fill(0x81), 0x01])
    assert.throws(() => decodeCbor(depth9), /depth exceeds limit/)

    // Admin FIDO assertion allows UP=1, UV=0 and enforces strict DER
    const loginChallenge = generateChallenge()
    const clientDataBytes = encoder.encode(JSON.stringify({
        type: 'webauthn.get',
        challenge: loginChallenge,
        origin,
    }))
    const authDataBytes = await buildAssertionAuthData({ rpId, flags: 0x01, signCount: 1 })
    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))
    const p1363Sig = new Uint8Array(await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        concatBytes(authDataBytes, clientDataHash)
    ))

    // Raw 64-byte signature rejected on Admin FIDO too
    await assert.rejects(() => verifyFidoAssertion({
        publicKeyRawBase64: bytesToBase64Url(rawPub),
        authenticatorDataBase64: bytesToBase64Url(authDataBytes),
        clientDataJsonBase64: bytesToBase64Url(clientDataBytes),
        signatureBase64: bytesToBase64Url(p1363Sig),
        expectedChallenge: loginChallenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    }), /missing SEQUENCE/)

    // Canonical DER signature succeeds with UV=0
    const ok = await verifyFidoAssertion({
        publicKeyRawBase64: bytesToBase64Url(rawPub),
        authenticatorDataBase64: bytesToBase64Url(authDataBytes),
        clientDataJsonBase64: bytesToBase64Url(clientDataBytes),
        signatureBase64: bytesToBase64Url(p1363ToDer(p1363Sig)),
        expectedChallenge: loginChallenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    })
    assert.equal(ok, true)
})
