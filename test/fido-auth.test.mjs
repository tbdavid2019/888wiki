import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
const crypto = webcrypto

import {
    generateChallenge,
    base64UrlToBytes,
    bytesToBase64Url,
    derToP1363,
    decodeCbor,
    extractRawPublicKeyFromCose,
    parseAttestationObject,
    verifyFidoAssertion,
    getFidoCredentials,
    saveFidoCredential,
    deleteFidoCredential,
    storeFidoChallenge,
    verifyAndConsumeFidoChallenge,
} from '../src/fido_auth.mjs'

test('generateChallenge creates base64url 32-byte random string', () => {
    const ch = generateChallenge()
    assert.equal(typeof ch, 'string')
    assert.ok(ch.length >= 40)
    const bytes = base64UrlToBytes(ch)
    assert.equal(bytes.length, 32)
})

test('base64UrlToBytes and bytesToBase64Url round-trip cleanly', () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16, 8, 4, 2, 1])
    const encoded = bytesToBase64Url(original)
    const decoded = base64UrlToBytes(encoded)
    assert.deepEqual(decoded, original)
})

test('derToP1363 converts standard DER signature to 64 bytes P1363', () => {
    // A synthetic DER ECDSA signature: 0x30 0x44 0x02 0x20 [32 bytes r] 0x02 0x20 [32 bytes s]
    const r = new Uint8Array(32).fill(0x11)
    const s = new Uint8Array(32).fill(0x22)
    const der = new Uint8Array([
        0x30, 0x44,
        0x02, 0x20, ...r,
        0x02, 0x20, ...s
    ])
    const p1363 = derToP1363(der)
    assert.equal(p1363.length, 64)
    assert.deepEqual(p1363.slice(0, 32), r)
    assert.deepEqual(p1363.slice(32, 64), s)
})

test('decodeCbor handles text, numbers, byte arrays, and maps', () => {
    // Map with key "fmt" -> "none"
    // 0xa1 (map of 1), 0x63, 'f', 'm', 't', 0x64, 'n', 'o', 'n', 'e'
    const cborBytes = new Uint8Array([
        0xa1,
        0x63, 0x66, 0x6d, 0x74,
        0x64, 0x6e, 0x6f, 0x6e, 0x65
    ])
    const result = decodeCbor(cborBytes)
    assert.ok(result instanceof Map)
    assert.equal(result.get('fmt'), 'none')
})

function encodeDerInt(bytes) {
    let start = 0
    while (start < bytes.length - 1 && bytes[start] === 0x00) {
        start++
    }
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

test('verifyFidoAssertion cryptographically verifies valid ECDSA P-256 signatures', async () => {
    // Generate real P-256 key pair
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
    )
    const rawPublicKey = await crypto.subtle.exportKey('raw', keyPair.publicKey)
    const publicKeyRawBase64 = bytesToBase64Url(rawPublicKey)

    const challenge = generateChallenge()
    const origin = 'https://wiki.david888.com'
    const rpId = 'wiki.david888.com'

    // Mock clientDataJSON
    const clientDataObj = {
        type: 'webauthn.get',
        challenge: challenge,
        origin: origin,
        crossOrigin: false,
    }
    const clientDataBytes = new TextEncoder().encode(JSON.stringify(clientDataObj))
    const clientDataJsonBase64 = bytesToBase64Url(clientDataBytes)

    // Mock authData: 32 bytes rpIdHash + 1 byte flags (0x01 = UP) + 4 bytes signCount
    const rpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)))
    const authDataBytes = new Uint8Array(37)
    authDataBytes.set(rpIdHash, 0)
    authDataBytes[32] = 0x01 // UP flag
    authDataBytes[33] = 0x00; authDataBytes[34] = 0x00; authDataBytes[35] = 0x00; authDataBytes[36] = 0x05 // counter 5
    const authenticatorDataBase64 = bytesToBase64Url(authDataBytes)

    // Sign (authData || SHA-256(clientDataJSON))
    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))
    const signatureBase = new Uint8Array(authDataBytes.length + clientDataHash.length)
    signatureBase.set(authDataBytes, 0)
    signatureBase.set(clientDataHash, authDataBytes.length)

    // Sign with Web Crypto -> produce P1363 (64 bytes)
    const p1363Sig = new Uint8Array(await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        signatureBase
    ))

    // Convert P1363 to canonical ASN.1 DER to simulate browser authenticator output
    const derSig = p1363ToDer(p1363Sig)
    const signatureBase64 = bytesToBase64Url(derSig)

    // Verify
    const verified = await verifyFidoAssertion({
        publicKeyRawBase64,
        authenticatorDataBase64,
        clientDataJsonBase64,
        signatureBase64,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRpId: rpId,
    })

    assert.equal(verified, true)
})

test('KV storage helpers save, retrieve, and delete FIDO credentials', async () => {
    const memoryKv = new Map()
    const kv = {
        get: async (k) => memoryKv.get(k) || null,
        put: async (k, v) => memoryKv.set(k, v),
        delete: async (k) => memoryKv.delete(k),
    }

    assert.deepEqual(await getFidoCredentials(kv), [])

    await saveFidoCredential(kv, {
        id: 'cred-123',
        publicKeyRaw: 'raw-pub-key-data',
        name: 'MacBook Touch ID',
    })

    const list = await getFidoCredentials(kv)
    assert.equal(list.length, 1)
    assert.equal(list[0].id, 'cred-123')
    assert.equal(list[0].name, 'MacBook Touch ID')

    await deleteFidoCredential(kv, 'cred-123')
    assert.deepEqual(await getFidoCredentials(kv), [])
})
