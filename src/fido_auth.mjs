/**
 * Zero-dependency WebAuthn / FIDO2 Authentication Helper for Cloudflare Workers.
 * Implements Admin FIDO2 Passkey / Touch ID / Face ID registration and assertion verification
 * using the shared hardened WebAuthn core (`src/webauthn_core.mjs`) and KV storage.
 */

import {
    base64UrlToBytes as coreBase64UrlToBytes,
    bytesToBase64Url,
    generateChallenge,
    derToP1363Strict,
    decodeCborSafe,
    extractRawPublicKeyFromCose,
    parseAttestationObject,
    verifyRegistrationResponse,
    verifyAuthenticationResponse,
    COSE_ALG_ES256,
} from './webauthn_core.mjs'

export {
    bytesToBase64Url,
    generateChallenge,
    extractRawPublicKeyFromCose,
    parseAttestationObject,
}

export function base64UrlToBytes(base64url) {
    return coreBase64UrlToBytes(base64url, { strict: false })
}

/**
 * Converts an ASN.1 DER formatted ECDSA signature to IEEE P1363 (64 bytes: 32 bytes r + 32 bytes s).
 * Strictly enforces ASN.1 DER structure via `derToP1363Strict`.
 */
export function derToP1363(derBytes) {
    return derToP1363Strict(derBytes)
}

/**
 * Bounded CBOR decoder delegating to `decodeCborSafe`.
 */
export function decodeCbor(bytes) {
    return decodeCborSafe(bytes)
}

export function extractFidoSignCount(authenticatorDataBase64) {
    const authDataBytes = base64UrlToBytes(authenticatorDataBase64)
    if (authDataBytes.length < 37) return 0
    return ((authDataBytes[33] << 24) | (authDataBytes[34] << 16) | (authDataBytes[35] << 8) | authDataBytes[36]) >>> 0
}

export async function verifyFidoRegistration({
    attestationObjectBase64,
    clientDataJsonBase64,
    expectedChallenge,
    expectedOrigin,
    expectedRpId,
}) {
    return verifyRegistrationResponse({
        attestationObjectBase64,
        clientDataJsonBase64,
        expectedChallenge,
        expectedOrigin,
        expectedRpId,
        requireUserVerification: false,
        allowedAlgorithms: [COSE_ALG_ES256],
    })
}

/**
 * Verifies WebAuthn Assertion (Login) signature using standard Web Crypto API.
 * Preserves Admin FIDO's `UP`-only (`requireUserVerification: false`) and KV credential compatibility.
 */
export async function verifyFidoAssertion({
    publicKeyRawBase64,
    authenticatorDataBase64,
    clientDataJsonBase64,
    signatureBase64,
    expectedChallenge,
    expectedOrigin,
    expectedRpId,
    previousSignCount = 0,
}) {
    await verifyAuthenticationResponse({
        publicKeyRawBase64,
        authenticatorDataBase64,
        clientDataJsonBase64,
        signatureBase64,
        expectedChallenge,
        expectedOrigin,
        expectedRpId,
        previousSignCount,
        algorithm: COSE_ALG_ES256,
        requireUserVerification: false,
        enforceBackupEligibleParity: false,
    })
    return true
}

const FIDO_CREDENTIALS_KEY = 'admin:fido:credentials'
const FIDO_CHALLENGE_PREFIX = 'admin:fido:challenge:'

/**
 * Storage helpers for KV
 */
export async function getFidoCredentials(kv) {
    if (!kv) return []
    try {
        const json = await kv.get(FIDO_CREDENTIALS_KEY)
        if (!json) return []
        const parsed = JSON.parse(json)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

export async function saveFidoCredential(kv, { id, publicKeyRaw, name = 'Touch ID Device', createdAt = Date.now(), signCount = 0 }) {
    if (!kv) throw new Error('KV namespace not available')
    const list = await getFidoCredentials(kv)
    const existingIndex = list.findIndex(c => c.id === id)
    const record = { id, publicKeyRaw, name, createdAt, signCount: Number(signCount) || 0 }
    if (existingIndex >= 0) {
        list[existingIndex] = record
    } else {
        list.push(record)
    }
    await kv.put(FIDO_CREDENTIALS_KEY, JSON.stringify(list))
    return list
}

export async function updateFidoCredentialSignCount(kv, credentialId, signCount) {
    if (!kv || !credentialId) return
    const nextCount = Number(signCount) || 0
    if (nextCount <= 0) return
    const list = await getFidoCredentials(kv)
    const idx = list.findIndex(c => c.id === credentialId)
    if (idx >= 0 && nextCount > (Number(list[idx].signCount) || 0)) {
        list[idx] = { ...list[idx], signCount: nextCount }
        await kv.put(FIDO_CREDENTIALS_KEY, JSON.stringify(list))
    }
}

export async function deleteFidoCredential(kv, credentialId) {
    if (!kv) return []
    const list = await getFidoCredentials(kv)
    const filtered = list.filter(c => c.id !== credentialId)
    await kv.put(FIDO_CREDENTIALS_KEY, JSON.stringify(filtered))
    return filtered
}

export async function storeFidoChallenge(kv, challenge, type = 'login', ttlSeconds = 120) {
    if (!kv) return
    const key = `${FIDO_CHALLENGE_PREFIX}${type}:${challenge}`
    await kv.put(key, JSON.stringify({ challenge, type, createdAt: Date.now() }), {
        expirationTtl: ttlSeconds,
    })
}

export async function verifyAndConsumeFidoChallenge(kv, challenge, type = 'login') {
    if (!kv || !challenge) return false
    const key = `${FIDO_CHALLENGE_PREFIX}${type}:${challenge}`
    const stored = await kv.get(key)
    if (!stored) return false
    await kv.delete(key)
    return true
}
