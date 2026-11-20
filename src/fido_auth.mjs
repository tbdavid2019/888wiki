/**
 * Zero-dependency WebAuthn / FIDO2 Authentication Helper for Cloudflare Workers.
 * Implements FIDO2 Passkey / Touch ID / Face ID registration and assertion verification
 * using standard Web Crypto API (crypto.subtle).
 */

// Base64URL encode and decode helpers
export function base64UrlToBytes(base64url) {
    if (typeof base64url !== 'string') return new Uint8Array(0)
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(base64 + pad, 'base64'))
    }
    const binary = atob(base64 + pad)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

export function bytesToBase64Url(bytes) {
    if (!bytes) return ''
    const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(uint8).toString('base64url')
    }
    let binary = ''
    for (let i = 0; i < uint8.byteLength; i++) {
        binary += String.fromCharCode(uint8[i])
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Generate a cryptographically secure random 32-byte challenge string in base64url format.
 */
export function generateChallenge() {
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    return bytesToBase64Url(randomBytes)
}

/**
 * Converts an ASN.1 DER formatted ECDSA signature to IEEE P1363 (64 bytes: 32 bytes r + 32 bytes s).
 * WebAuthn authenticators return signatures in ASN.1 DER, whereas WebCrypto verify expects P1363.
 */
export function derToP1363(derBytes) {
    const bytes = derBytes instanceof Uint8Array ? derBytes : new Uint8Array(derBytes)
    if (bytes.length === 64) return bytes

    let offset = 0
    if (bytes[offset++] !== 0x30) throw new Error('Invalid DER signature: missing SEQUENCE')
    let seqLen = bytes[offset++]
    if (seqLen & 0x80) {
        const lenBytes = seqLen & 0x7f
        offset += lenBytes
    }

    if (bytes[offset++] !== 0x02) throw new Error('Invalid DER signature: missing INTEGER r')
    let rLen = bytes[offset++]
    let r = bytes.slice(offset, offset + rLen)
    offset += rLen

    if (bytes[offset++] !== 0x02) throw new Error('Invalid DER signature: missing INTEGER s')
    let sLen = bytes[offset++]
    let s = bytes.slice(offset, offset + sLen)

    // Strip leading 0x00 padding if > 32, or pad to 32
    while (r.length > 32 && r[0] === 0x00) r = r.slice(1)
    while (s.length > 32 && s[0] === 0x00) s = s.slice(1)

    const p1363 = new Uint8Array(64)
    p1363.set(r, 32 - r.length)
    p1363.set(s, 64 - s.length)
    return p1363
}

/**
 * Minimalist CBOR decoder specifically designed to decode WebAuthn attestationObject & COSE keys.
 */
export function decodeCbor(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    let offset = 0

    function parseItem() {
        if (offset >= data.length) throw new Error('Unexpected end of CBOR data')
        const initialByte = data[offset++]
        const majorType = initialByte >> 5
        const additionalInfo = initialByte & 0x1f

        let length
        if (additionalInfo < 24) {
            length = additionalInfo
        } else if (additionalInfo === 24) {
            length = data[offset++]
        } else if (additionalInfo === 25) {
            length = (data[offset++] << 8) | data[offset++]
        } else if (additionalInfo === 26) {
            length = ((data[offset++] << 24) | (data[offset++] << 16) | (data[offset++] << 8) | data[offset++]) >>> 0
        } else if (additionalInfo === 27) {
            // 64-bit int (use lower 32 bits for our purpose)
            offset += 4
            length = ((data[offset++] << 24) | (data[offset++] << 16) | (data[offset++] << 8) | data[offset++]) >>> 0
        } else {
            throw new Error(`Unsupported CBOR additional info: ${additionalInfo}`)
        }

        switch (majorType) {
            case 0: // Unsigned integer
                return length
            case 1: // Negative integer
                return -1 - length
            case 2: { // Byte string
                const bytesVal = data.slice(offset, offset + length)
                offset += length
                return bytesVal
            }
            case 3: { // Text string
                const textBytes = data.slice(offset, offset + length)
                offset += length
                return new TextDecoder('utf-8').decode(textBytes)
            }
            case 4: { // Array
                const arr = []
                for (let i = 0; i < length; i++) {
                    arr.push(parseItem())
                }
                return arr
            }
            case 5: { // Map
                const map = new Map()
                for (let i = 0; i < length; i++) {
                    const key = parseItem()
                    const val = parseItem()
                    map.set(key, val)
                }
                return map
            }
            case 7: // Simple / Float
                if (additionalInfo === 20) return false
                if (additionalInfo === 21) return true
                if (additionalInfo === 22) return null
                return undefined
            default:
                throw new Error(`Unsupported CBOR major type: ${majorType}`)
        }
    }

    return parseItem()
}

/**
 * Extracts raw uncompressed ECDSA P-256 public key (65 bytes: 0x04 || x || y) from COSE Key Map or raw bytes.
 */
export function extractRawPublicKeyFromCose(coseKeyMapOrBytes) {
    let map = coseKeyMapOrBytes
    if (coseKeyMapOrBytes instanceof Uint8Array) {
        map = decodeCbor(coseKeyMapOrBytes)
    }
    if (!(map instanceof Map)) {
        throw new Error('Invalid COSE Key: expected Map')
    }

    // COSE EC2 parameters:
    // 1 (kty): 2 (EC2)
    // 3 (alg): -7 (ES256)
    // -1 (crv): 1 (P-256)
    // -2 (x): Uint8Array (32 bytes)
    // -3 (y): Uint8Array (32 bytes)
    const kty = map.get(1)
    const alg = map.get(3)
    const crv = map.get(-1)
    const x = map.get(-2)
    const y = map.get(-3)

    if (kty !== 2 || alg !== -7 || crv !== 1 || !(x instanceof Uint8Array) || !(y instanceof Uint8Array) || x.length !== 32 || y.length !== 32) {
        throw new Error(`Unsupported COSE Key: kty=${kty}, alg=${alg}, crv=${crv}`)
    }

    const raw = new Uint8Array(65)
    raw[0] = 0x04 // Uncompressed point indicator
    raw.set(x, 1)
    raw.set(y, 33)
    return raw
}

/**
 * Parses attestationObject from WebAuthn registration.
 * Extracts credentialId, authData, and uncompressed raw public key bytes.
 */
export function parseAttestationObject(attestationObjectBytes) {
    const cbor = decodeCbor(attestationObjectBytes)
    if (!(cbor instanceof Map)) throw new Error('Invalid attestationObject CBOR')

    const authData = cbor.get('authData')
    if (!authData || !(authData instanceof Uint8Array)) throw new Error('Missing authData in attestationObject')

    let offset = 0
    // 32 bytes rpIdHash
    const rpIdHash = authData.slice(offset, offset + 32)
    offset += 32
    // 1 byte flags
    const flags = authData[offset++]
    // 4 bytes signCount
    const signCount = (authData[offset++] << 24) | (authData[offset++] << 16) | (authData[offset++] << 8) | authData[offset++]

    const hasAttestedCredData = Boolean(flags & 0x40)
    if (!hasAttestedCredData) {
        throw new Error('authData does not contain attested credential data')
    }

    // 16 bytes aaguid
    const aaguid = authData.slice(offset, offset + 16)
    offset += 16

    // 2 bytes credentialIdLength
    const credIdLen = (authData[offset++] << 8) | authData[offset++]
    // credentialId
    const credentialId = authData.slice(offset, offset + credIdLen)
    offset += credIdLen

    // Remaining bytes are COSE encoded credentialPublicKey
    const coseBytes = authData.slice(offset)
    const publicKeyRaw = extractRawPublicKeyFromCose(coseBytes)

    return {
        rpIdHash,
        flags,
        signCount: signCount >>> 0,
        aaguid,
        credentialId: bytesToBase64Url(credentialId),
        publicKeyRaw: bytesToBase64Url(publicKeyRaw),
    }
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
    const clientDataBytes = base64UrlToBytes(clientDataJsonBase64)
    const clientData = JSON.parse(new TextDecoder('utf-8').decode(clientDataBytes))

    if (clientData.type !== 'webauthn.create') {
        throw new Error(`Invalid registration clientData type: ${clientData.type}`)
    }
    if (expectedChallenge && clientData.challenge !== expectedChallenge) {
        throw new Error('Registration challenge mismatch')
    }
    if (expectedOrigin) {
        const expectedNormOrigin = new URL(expectedOrigin).origin
        const actualNormOrigin = new URL(clientData.origin).origin
        if (expectedNormOrigin !== actualNormOrigin) {
            throw new Error(`Origin mismatch: expected ${expectedNormOrigin}, got ${actualNormOrigin}`)
        }
    }

    const parsed = parseAttestationObject(base64UrlToBytes(attestationObjectBase64))
    if (!(parsed.flags & 0x01)) {
        throw new Error('User presence flag (UP) not set during registration')
    }

    if (expectedRpId) {
        const expectedRpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedRpId)))
        for (let i = 0; i < 32; i++) {
            if (expectedRpIdHash[i] !== parsed.rpIdHash[i]) {
                throw new Error('RP ID hash mismatch during registration')
            }
        }
    }

    return parsed
}

/**
 * Verifies WebAuthn Assertion (Login) signature using standard Web Crypto API.
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
    const clientDataBytes = base64UrlToBytes(clientDataJsonBase64)
    const clientDataText = new TextDecoder('utf-8').decode(clientDataBytes)
    const clientData = JSON.parse(clientDataText)

    if (clientData.type !== 'webauthn.get') {
        throw new Error(`Invalid clientData type: ${clientData.type}`)
    }

    if (expectedChallenge && clientData.challenge !== expectedChallenge) {
        throw new Error('Challenge mismatch or expired')
    }

    if (expectedOrigin && clientData.origin !== expectedOrigin) {
        const expectedNormOrigin = new URL(expectedOrigin).origin
        const actualNormOrigin = new URL(clientData.origin).origin
        if (expectedNormOrigin !== actualNormOrigin) {
            throw new Error(`Origin mismatch: expected ${expectedNormOrigin}, got ${actualNormOrigin}`)
        }
    }

    const authDataBytes = base64UrlToBytes(authenticatorDataBase64)

    // Check user presence flag (bit 0)
    const flags = authDataBytes[32]
    if (!(flags & 0x01)) {
        throw new Error('User presence flag (UP) not set')
    }

    const currentSignCount = extractFidoSignCount(authenticatorDataBase64)
    if (previousSignCount > 0 && currentSignCount <= previousSignCount) {
        throw new Error('Authenticator signCount did not advance (possible cloned authenticator)')
    }

    // Verify rpIdHash matches SHA-256 of expectedRpId
    if (expectedRpId) {
        const expectedRpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedRpId)))
        const actualRpIdHash = authDataBytes.slice(0, 32)
        for (let i = 0; i < 32; i++) {
            if (expectedRpIdHash[i] !== actualRpIdHash[i]) {
                throw new Error('RP ID hash mismatch')
            }
        }
    }

    // Hash clientDataJSON
    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))

    // Construct signature base = authData || clientDataHash
    const signatureBase = new Uint8Array(authDataBytes.length + clientDataHash.length)
    signatureBase.set(authDataBytes, 0)
    signatureBase.set(clientDataHash, authDataBytes.length)

    // Import public key into Web Crypto
    const rawPubBytes = base64UrlToBytes(publicKeyRawBase64)
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        rawPubBytes,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
    )

    // Convert signature from DER to IEEE P1363
    const derSigBytes = base64UrlToBytes(signatureBase64)
    const p1363SigBytes = derToP1363(derSigBytes)

    // Verify with Web Crypto
    const verified = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        p1363SigBytes,
        signatureBase
    )

    if (!verified) {
        throw new Error('WebAuthn cryptographic signature verification failed')
    }

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
