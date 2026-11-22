/**
 * Zero-dependency hardened WebAuthn parser & verification core for Cloudflare Workers.
 * Shared by user Passkey accounts and Admin FIDO authentication.
 */

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER_STRICT = new TextDecoder('utf-8', { fatal: true })

export const COSE_ALG_ES256 = -7
export const COSE_ALG_RS256 = -257

export const WEBAUTHN_FLAGS = Object.freeze({
    UP: 0x01,
    UV: 0x04,
    BE: 0x08,
    BS: 0x10,
    AT: 0x40,
    ED: 0x80,
})

export const DEFAULT_CBOR_LIMITS = Object.freeze({
    maxDepth: 8,
    maxItems: 256,
    maxBytes: 32768,
})

export const MAX_CREDENTIAL_ID_BYTES = 1024
export const MAX_SPKI_BYTES = 1024

export class WebAuthnError extends Error {
    constructor(code, message) {
        super(message)
        this.name = 'WebAuthnError'
        this.code = code
    }
}

function toUint8Array(input, errorCode = 'WEBAUTHN_INVALID_INPUT') {
    if (input instanceof Uint8Array) return input
    if (input instanceof ArrayBuffer) return new Uint8Array(input)
    if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
    throw new WebAuthnError(errorCode, 'Expected binary buffer')
}

function constantTimeEqualBytes(a, b) {
    if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) {
        return false
    }
    let diff = 0
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i]
    }
    return diff === 0
}

function constantTimeEqualStrings(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false
    return constantTimeEqualBytes(TEXT_ENCODER.encode(a), TEXT_ENCODER.encode(b))
}

/**
 * Validate an unpadded base64url string.
 */
export function isValidBase64Url(value, { maxLength = Infinity } = {}) {
    if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
        return false
    }
    if (value.length % 4 === 1) return false
    return /^[A-Za-z0-9\-_]+$/.test(value)
}

/**
 * Decode a base64url string into a Uint8Array.
 * When `strict` is true, rejects padded, empty, or malformed base64url inputs.
 */
export function base64UrlToBytes(base64url, { strict = false, maxLength = Infinity } = {}) {
    if (strict) {
        if (!isValidBase64Url(base64url, { maxLength })) {
            throw new WebAuthnError('WEBAUTHN_INVALID_BASE64URL', 'Invalid unpadded base64url input')
        }
    } else if (typeof base64url !== 'string') {
        return new Uint8Array(0)
    }

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

/**
 * Encode binary bytes into an unpadded base64url string.
 */
export function bytesToBase64Url(bytes) {
    if (!bytes) return ''
    const uint8 = bytes instanceof Uint8Array
        ? bytes
        : ArrayBuffer.isView(bytes)
            ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
            : new Uint8Array(bytes)
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
 * Compute deterministic SHA-256 base64url binding hash for WebAuthn challenges and step-up grants.
 */
export async function computeBindingHash({ origin, rpId, purpose, sessionId = '' }) {
    if (typeof origin !== 'string' || !origin || typeof rpId !== 'string' || !rpId || typeof purpose !== 'string' || !purpose) {
        throw new WebAuthnError('WEBAUTHN_INVALID_INPUT', 'origin, rpId, and purpose are required for binding hash')
    }
    const payload = `${origin}\n${rpId}\n${purpose}\n${sessionId || ''}`
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(payload)))
    return bytesToBase64Url(digest)
}

function isLoopbackHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
}

function isOriginAllowedScheme(urlObj) {
    if (urlObj.protocol === 'https:') return true
    if (urlObj.protocol === 'http:' && isLoopbackHost(urlObj.hostname.toLowerCase())) return true
    return false
}

function isHostnameValidForRpId(hostname, rpId) {
    if (!hostname || !rpId) return false
    const host = hostname.toLowerCase()
    const rp = rpId.toLowerCase()
    if (host === rp) return true
    // IP addresses cannot be parent-domain matched
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return false
    return host.endsWith(`.${rp}`)
}

/**
 * Resolve and validate expected WebAuthn origin(s) and rpId from Request and environment allowlists.
 * Fails closed on invalid/cross-origin requests, non-HTTPS non-localhost schemes, or multi-origin RP mismatches.
 */
export function resolveExpectedOriginAndRpId(request, env = globalThis) {
    let reqUrl
    try {
        reqUrl = new URL(typeof request === 'string' ? request : request?.url)
    } catch {
        throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', 'Invalid request URL')
    }

    if (!isOriginAllowedScheme(reqUrl)) {
        throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', 'Insecure origin scheme is not permitted for WebAuthn')
    }

    const requestOrigin = reqUrl.origin
    const requestHostname = reqUrl.hostname.toLowerCase()

    // If an HTTP Origin header is present, fail closed unless it strictly matches the request origin
    const headerOrigin = request?.headers?.get?.('Origin')
    if (headerOrigin !== undefined && headerOrigin !== null) {
        let parsedHeaderOrigin
        try {
            parsedHeaderOrigin = new URL(headerOrigin).origin
        } catch {
            throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', 'Malformed Origin header')
        }
        if (parsedHeaderOrigin !== requestOrigin) {
            throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', 'Cross-origin request rejected')
        }
    }

    const readEnv = name => {
        const val = env?.[name] ?? globalThis?.[name]
        return val === undefined || val === null ? '' : String(val).trim()
    }

    const configuredOriginsRaw = readEnv('SCN_PASSKEY_ORIGINS')
    const configuredRpIdRaw = readEnv('SCN_PASSKEY_RP_ID').toLowerCase()

    let allowedOrigins
    if (configuredOriginsRaw) {
        const entries = configuredOriginsRaw.split(',').map(s => s.trim()).filter(Boolean)
        if (entries.length === 0) {
            throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', 'Empty SCN_PASSKEY_ORIGINS configuration')
        }
        const normalized = []
        for (const entry of entries) {
            let parsed
            try {
                parsed = new URL(entry)
            } catch {
                throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', 'Invalid origin in SCN_PASSKEY_ORIGINS')
            }
            if (!isOriginAllowedScheme(parsed) || parsed.origin !== entry.replace(/\/+$/, '')) {
                throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', 'Invalid origin entry in SCN_PASSKEY_ORIGINS')
            }
            if (!normalized.includes(parsed.origin)) {
                normalized.push(parsed.origin)
            }
        }
        if (!normalized.includes(requestOrigin)) {
            throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', 'Request origin is not in SCN_PASSKEY_ORIGINS allowlist')
        }
        allowedOrigins = normalized
    } else {
        allowedOrigins = [requestOrigin]
    }

    const rpId = configuredRpIdRaw || requestHostname
    if (!rpId || rpId.includes('://') || rpId.includes('/') || rpId.includes(':')) {
        throw new WebAuthnError('WEBAUTHN_RPID_MISMATCH', 'Invalid SCN_PASSKEY_RP_ID configuration')
    }

    for (const allowedOrigin of allowedOrigins) {
        const allowedHost = new URL(allowedOrigin).hostname.toLowerCase()
        if (!isHostnameValidForRpId(allowedHost, rpId)) {
            throw new WebAuthnError('WEBAUTHN_RPID_MISMATCH', 'Configured origin does not match expected RP ID')
        }
    }

    return {
        origin: requestOrigin,
        expectedOrigin: requestOrigin,
        rpId,
        expectedRpId: rpId,
        allowedOrigins,
    }
}

/**
 * Bounded CBOR prefix decoder returning `{ value, bytesRead }`.
 * Rejects indefinite lengths, depth > maxDepth, excessive item/byte counts,
 * duplicate map keys, negative/overflow lengths, and truncated buffers.
 */
export function decodeCborPrefixSafe(bytes, options = {}) {
    const maxDepth = options.maxDepth ?? DEFAULT_CBOR_LIMITS.maxDepth
    const maxItems = options.maxItems ?? DEFAULT_CBOR_LIMITS.maxItems
    const maxBytes = options.maxBytes ?? DEFAULT_CBOR_LIMITS.maxBytes

    const data = toUint8Array(bytes, 'WEBAUTHN_CBOR_ERROR')
    if (data.length === 0) {
        throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Empty CBOR payload')
    }
    if (data.length > maxBytes) {
        throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'CBOR payload exceeds byte limit')
    }

    let offset = 0
    let itemCount = 0

    function readUint(additionalInfo) {
        if (additionalInfo < 24) {
            return BigInt(additionalInfo)
        }
        if (additionalInfo === 24) {
            if (offset + 1 > data.length) throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Truncated CBOR 8-bit integer')
            return BigInt(data[offset++])
        }
        if (additionalInfo === 25) {
            if (offset + 2 > data.length) throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Truncated CBOR 16-bit integer')
            const val = (data[offset] << 8) | data[offset + 1]
            offset += 2
            return BigInt(val)
        }
        if (additionalInfo === 26) {
            if (offset + 4 > data.length) throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Truncated CBOR 32-bit integer')
            const val = ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0
            offset += 4
            return BigInt(val)
        }
        if (additionalInfo === 27) {
            if (offset + 8 > data.length) throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Truncated CBOR 64-bit integer')
            const hi = ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0
            const lo = ((data[offset + 4] << 24) | (data[offset + 5] << 16) | (data[offset + 6] << 8) | data[offset + 7]) >>> 0
            offset += 8
            return (BigInt(hi) << 32n) | BigInt(lo)
        }
        if (additionalInfo === 31) {
            throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Indefinite-length CBOR is not supported')
        }
        throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', `Unsupported CBOR additional info: ${additionalInfo}`)
    }

    function readBoundedLength(additionalInfo, limit) {
        const bigLen = readUint(additionalInfo)
        if (bigLen < 0n || bigLen > BigInt(limit)) {
            throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'CBOR length exceeds safety bounds')
        }
        return Number(bigLen)
    }

    function parseItem(depth) {
        if (++itemCount > maxItems) {
            throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'CBOR item count exceeds limit')
        }
        if (offset >= data.length) {
            throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Unexpected end of CBOR data')
        }

        const initialByte = data[offset++]
        const majorType = initialByte >> 5
        const additionalInfo = initialByte & 0x1f

        switch (majorType) {
            case 0: {
                const val = readUint(additionalInfo)
                if (val > BigInt(Number.MAX_SAFE_INTEGER)) {
                    throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'CBOR integer exceeds safe range')
                }
                return Number(val)
            }
            case 1: {
                const val = readUint(additionalInfo)
                if (val > BigInt(Number.MAX_SAFE_INTEGER) - 1n) {
                    throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'CBOR negative integer exceeds safe range')
                }
                return -1 - Number(val)
            }
            case 2: {
                const length = readBoundedLength(additionalInfo, maxBytes)
                if (length > data.length - offset) {
                    throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Truncated CBOR byte string')
                }
                const bytesVal = data.slice(offset, offset + length)
                offset += length
                return bytesVal
            }
            case 3: {
                const length = readBoundedLength(additionalInfo, maxBytes)
                if (length > data.length - offset) {
                    throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Truncated CBOR text string')
                }
                const textBytes = data.slice(offset, offset + length)
                offset += length
                try {
                    return TEXT_DECODER_STRICT.decode(textBytes)
                } catch {
                    throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Invalid UTF-8 in CBOR text string')
                }
            }
            case 4: {
                if (depth + 1 > maxDepth) {
                    throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'CBOR nesting depth exceeds limit')
                }
                const length = readBoundedLength(additionalInfo, maxItems)
                if (length > data.length - offset) {
                    throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Truncated CBOR array')
                }
                const arr = []
                for (let i = 0; i < length; i++) {
                    arr.push(parseItem(depth + 1))
                }
                return arr
            }
            case 5: {
                if (depth + 1 > maxDepth) {
                    throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'CBOR nesting depth exceeds limit')
                }
                const length = readBoundedLength(additionalInfo, maxItems)
                if (length * 2 > data.length - offset) {
                    throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Truncated CBOR map')
                }
                const map = new Map()
                for (let i = 0; i < length; i++) {
                    const key = parseItem(depth + 1)
                    if (map.has(key)) {
                        throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Duplicate key in CBOR map')
                    }
                    const val = parseItem(depth + 1)
                    map.set(key, val)
                }
                return map
            }
            case 7:
                if (additionalInfo === 20) return false
                if (additionalInfo === 21) return true
                if (additionalInfo === 22) return null
                if (additionalInfo === 23) return undefined
                throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', `Unsupported CBOR simple value: ${additionalInfo}`)
            default:
                throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', `Unsupported CBOR major type: ${majorType}`)
        }
    }

    const value = parseItem(0)
    return { value, bytesRead: offset }
}

/**
 * Strict bounded CBOR decoder that rejects trailing garbage after the root item.
 */
export function decodeCborSafe(bytes, options = {}) {
    const data = toUint8Array(bytes, 'WEBAUTHN_CBOR_ERROR')
    const { value, bytesRead } = decodeCborPrefixSafe(data, options)
    if (bytesRead !== data.length) {
        throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Trailing bytes in CBOR payload')
    }
    return value
}

/**
 * Strictly parse an ASN.1 DER ECDSA P-256 signature into 64-byte IEEE P1363 (r || s).
 * Rejects raw 64-byte signatures, non-canonical lengths, negative integers,
 * excessive leading zero padding, and trailing bytes.
 */
export function derToP1363Strict(derBytes) {
    const bytes = toUint8Array(derBytes, 'WEBAUTHN_DER_ERROR')
    if (bytes.length < 8 || bytes.length > 72) {
        throw new WebAuthnError('WEBAUTHN_DER_ERROR', 'Invalid DER signature length')
    }

    let offset = 0
    if (bytes[offset++] !== 0x30) {
        throw new WebAuthnError('WEBAUTHN_DER_ERROR', 'Invalid DER signature: missing SEQUENCE')
    }

    const seqLen = bytes[offset++]
    if (seqLen & 0x80) {
        throw new WebAuthnError('WEBAUTHN_DER_ERROR', 'Invalid DER signature: non-canonical SEQUENCE length')
    }
    if (offset + seqLen !== bytes.length) {
        throw new WebAuthnError('WEBAUTHN_DER_ERROR', 'Invalid DER signature: SEQUENCE length mismatch')
    }

    function readInteger(label) {
        if (offset >= bytes.length || bytes[offset++] !== 0x02) {
            throw new WebAuthnError('WEBAUTHN_DER_ERROR', `Invalid DER signature: missing INTEGER ${label}`)
        }
        if (offset >= bytes.length) {
            throw new WebAuthnError('WEBAUTHN_DER_ERROR', `Invalid DER signature: truncated INTEGER ${label}`)
        }
        const intLen = bytes[offset++]
        if (intLen < 1 || intLen > 33 || (intLen & 0x80)) {
            throw new WebAuthnError('WEBAUTHN_DER_ERROR', `Invalid DER signature: out-of-bounds INTEGER ${label}`)
        }
        if (offset + intLen > bytes.length) {
            throw new WebAuthnError('WEBAUTHN_DER_ERROR', `Invalid DER signature: truncated INTEGER ${label} value`)
        }
        const rawInt = bytes.slice(offset, offset + intLen)
        offset += intLen

        if (rawInt[0] & 0x80) {
            throw new WebAuthnError('WEBAUTHN_DER_ERROR', `Invalid DER signature: negative INTEGER ${label}`)
        }
        if (rawInt.length > 1 && rawInt[0] === 0x00 && (rawInt[1] & 0x80) === 0) {
            throw new WebAuthnError('WEBAUTHN_DER_ERROR', `Invalid DER signature: non-minimal zero padding on ${label}`)
        }

        const stripped = rawInt[0] === 0x00 && rawInt.length > 1 ? rawInt.slice(1) : rawInt
        if (stripped.length > 32) {
            throw new WebAuthnError('WEBAUTHN_DER_ERROR', `Invalid DER signature: ${label} exceeds 32 bytes`)
        }

        let allZero = true
        for (let i = 0; i < stripped.length; i++) {
            if (stripped[i] !== 0) {
                allZero = false
                break
            }
        }
        if (allZero) {
            throw new WebAuthnError('WEBAUTHN_DER_ERROR', `Invalid DER signature: ${label} cannot be zero`)
        }

        return stripped
    }

    const r = readInteger('r')
    const s = readInteger('s')
    if (offset !== bytes.length) {
        throw new WebAuthnError('WEBAUTHN_DER_ERROR', 'Invalid DER signature: trailing bytes')
    }

    const p1363 = new Uint8Array(64)
    p1363.set(r, 32 - r.length)
    p1363.set(s, 64 - s.length)
    return p1363
}

/**
 * Synchronously extract raw uncompressed P-256 public key (65 bytes) from an ES256 COSE Key.
 */
export function extractRawPublicKeyFromCose(coseKeyMapOrBytes) {
    let map = coseKeyMapOrBytes
    if (coseKeyMapOrBytes instanceof Uint8Array) {
        map = decodeCborSafe(coseKeyMapOrBytes)
    }
    if (!(map instanceof Map)) {
        throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', 'Invalid COSE Key: expected Map')
    }

    const kty = map.get(1)
    const alg = map.get(3)
    const crv = map.get(-1)
    const x = map.get(-2)
    const y = map.get(-3)

    if (
        kty !== 2 ||
        alg !== COSE_ALG_ES256 ||
        crv !== 1 ||
        !(x instanceof Uint8Array) ||
        !(y instanceof Uint8Array) ||
        x.length !== 32 ||
        y.length !== 32
    ) {
        throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', `Unsupported COSE Key: kty=${kty}, alg=${alg}, crv=${crv}`)
    }

    const raw = new Uint8Array(65)
    raw[0] = 0x04
    raw.set(x, 1)
    raw.set(y, 33)
    return raw
}

/**
 * Import a COSE key (ES256 -7 or RS256 -257) via Web Crypto and export canonical SPKI base64url.
 */
export async function extractPublicKeyFromCose(coseKeyMapOrBytes, { allowedAlgorithms = [COSE_ALG_ES256, COSE_ALG_RS256] } = {}) {
    let map = coseKeyMapOrBytes
    if (coseKeyMapOrBytes instanceof Uint8Array) {
        map = decodeCborSafe(coseKeyMapOrBytes)
    }
    if (!(map instanceof Map)) {
        throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', 'Invalid COSE Key: expected Map')
    }

    const kty = map.get(1)
    const alg = map.get(3)
    if (!allowedAlgorithms.includes(alg)) {
        throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', `Unsupported COSE Key: kty=${kty}, alg=${alg}`)
    }

    if (alg === COSE_ALG_ES256) {
        const rawBytes = extractRawPublicKeyFromCose(map)
        let cryptoKey
        try {
            cryptoKey = await crypto.subtle.importKey(
                'raw',
                rawBytes,
                { name: 'ECDSA', namedCurve: 'P-256' },
                true,
                ['verify']
            )
        } catch {
            throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', 'Invalid ECDSA P-256 COSE public key')
        }
        const spkiBytes = new Uint8Array(await crypto.subtle.exportKey('spki', cryptoKey))
        if (spkiBytes.length === 0 || spkiBytes.length > MAX_SPKI_BYTES) {
            throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', 'SPKI public key exceeds bounds')
        }
        return {
            algorithm: COSE_ALG_ES256,
            publicKeySpki: bytesToBase64Url(spkiBytes),
            publicKeyRaw: bytesToBase64Url(rawBytes),
        }
    }

    if (alg === COSE_ALG_RS256) {
        const n = map.get(-1)
        const e = map.get(-2)
        if (
            kty !== 3 ||
            !(n instanceof Uint8Array) ||
            !(e instanceof Uint8Array) ||
            n.length < 256 ||
            n.length > 512 ||
            n[0] === 0x00 ||
            e.length < 1 ||
            e.length > 8
        ) {
            throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', `Unsupported COSE Key: kty=${kty}, alg=${alg}`)
        }
        // Strip leading zero bytes for JWK unsigned big-endian encoding and enforce e >= 3 and odd
        let eStart = 0
        while (eStart < e.length - 1 && e[eStart] === 0x00) eStart++
        const eNorm = e.slice(eStart)
        if ((eNorm[eNorm.length - 1] & 0x01) === 0 || (eNorm.length === 1 && eNorm[0] < 3)) {
            throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', 'Invalid RSA public exponent in COSE Key')
        }

        let cryptoKey
        try {
            cryptoKey = await crypto.subtle.importKey(
                'jwk',
                {
                    kty: 'RSA',
                    alg: 'RS256',
                    n: bytesToBase64Url(n),
                    e: bytesToBase64Url(eNorm),
                    ext: true,
                },
                { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
                true,
                ['verify']
            )
        } catch {
            throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', 'Invalid RSA RS256 COSE public key')
        }
        const spkiBytes = new Uint8Array(await crypto.subtle.exportKey('spki', cryptoKey))
        if (spkiBytes.length === 0 || spkiBytes.length > MAX_SPKI_BYTES) {
            throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', 'SPKI public key exceeds bounds')
        }
        return {
            algorithm: COSE_ALG_RS256,
            publicKeySpki: bytesToBase64Url(spkiBytes),
            publicKeyRaw: null,
        }
    }

    throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', `Unsupported COSE Key: kty=${kty}, alg=${alg}`)
}

/**
 * Parse and validate WebAuthn authenticatorData bytes (>= 37 bytes).
 */
export function parseAuthenticatorData(authDataBytes, { requireAttestedCredentialData = false } = {}) {
    const authData = toUint8Array(authDataBytes, 'WEBAUTHN_INVALID_AUTH_DATA')
    if (authData.length < 37 || authData.length > DEFAULT_CBOR_LIMITS.maxBytes) {
        throw new WebAuthnError('WEBAUTHN_INVALID_AUTH_DATA', 'authenticatorData length out of bounds')
    }

    const rpIdHash = authData.slice(0, 32)
    const flags = authData[32]
    const signCount = ((authData[33] << 24) | (authData[34] << 16) | (authData[35] << 8) | authData[36]) >>> 0

    const up = Boolean(flags & WEBAUTHN_FLAGS.UP)
    const uv = Boolean(flags & WEBAUTHN_FLAGS.UV)
    const be = Boolean(flags & WEBAUTHN_FLAGS.BE)
    const bs = Boolean(flags & WEBAUTHN_FLAGS.BS)
    const at = Boolean(flags & WEBAUTHN_FLAGS.AT)
    const ed = Boolean(flags & WEBAUTHN_FLAGS.ED)

    if (!be && bs) {
        throw new WebAuthnError('WEBAUTHN_INVALID_BACKUP_STATE', 'Invalid WebAuthn backup state: BS=1 requires BE=1')
    }

    if (!requireAttestedCredentialData) {
        if (!at && ed) {
            const extensions = decodeCborSafe(authData.slice(37))
            if (!(extensions instanceof Map)) {
                throw new WebAuthnError('WEBAUTHN_INVALID_AUTH_DATA', 'Invalid authenticatorData extensions CBOR')
            }
        }
        return {
            rpIdHash,
            flags,
            signCount,
            up,
            uv,
            be,
            bs,
            at,
            ed,
        }
    }

    if (!at) {
        throw new WebAuthnError('WEBAUTHN_INVALID_AUTH_DATA', 'authData does not contain attested credential data')
    }
    if (authData.length < 55) {
        throw new WebAuthnError('WEBAUTHN_INVALID_AUTH_DATA', 'Truncated attested credential data')
    }

    let offset = 37
    const aaguid = authData.slice(offset, offset + 16)
    offset += 16

    const credIdLen = (authData[offset] << 8) | authData[offset + 1]
    offset += 2
    if (credIdLen < 1 || credIdLen > MAX_CREDENTIAL_ID_BYTES || offset + credIdLen >= authData.length) {
        throw new WebAuthnError('WEBAUTHN_INVALID_AUTH_DATA', 'Invalid credentialId length in authData')
    }

    const credentialIdBytes = authData.slice(offset, offset + credIdLen)
    offset += credIdLen

    const remaining = authData.slice(offset)
    const { value: coseKeyMap, bytesRead } = decodeCborPrefixSafe(remaining)
    if (!(coseKeyMap instanceof Map)) {
        throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', 'Invalid COSE Key: expected Map')
    }

    const trailingBytes = remaining.slice(bytesRead)
    if (ed) {
        if (trailingBytes.length === 0) {
            throw new WebAuthnError('WEBAUTHN_INVALID_AUTH_DATA', 'Missing authenticatorData extensions CBOR')
        }
        const extensions = decodeCborSafe(trailingBytes)
        if (!(extensions instanceof Map)) {
            throw new WebAuthnError('WEBAUTHN_INVALID_AUTH_DATA', 'Invalid authenticatorData extensions CBOR')
        }
    } else if (trailingBytes.length !== 0) {
        throw new WebAuthnError('WEBAUTHN_INVALID_AUTH_DATA', 'Unexpected trailing bytes after COSE public key')
    }

    return {
        rpIdHash,
        flags,
        signCount,
        up,
        uv,
        be,
        bs,
        at,
        ed,
        aaguid,
        credentialIdBytes,
        credentialId: bytesToBase64Url(credentialIdBytes),
        coseKeyMap,
    }
}

/**
 * Parse attestationObject CBOR and extract attested credential fields (ES256 raw compatible).
 */
export function parseAttestationObject(attestationObjectBytes) {
    const cbor = decodeCborSafe(attestationObjectBytes)
    if (!(cbor instanceof Map)) {
        throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Invalid attestationObject CBOR')
    }
    const authData = cbor.get('authData')
    if (!(authData instanceof Uint8Array)) {
        throw new WebAuthnError('WEBAUTHN_INVALID_AUTH_DATA', 'Missing authData in attestationObject')
    }

    const parsedAuthData = parseAuthenticatorData(authData, { requireAttestedCredentialData: true })
    const publicKeyRaw = extractRawPublicKeyFromCose(parsedAuthData.coseKeyMap)

    return {
        rpIdHash: parsedAuthData.rpIdHash,
        flags: parsedAuthData.flags,
        signCount: parsedAuthData.signCount,
        up: parsedAuthData.up,
        uv: parsedAuthData.uv,
        be: parsedAuthData.be,
        bs: parsedAuthData.bs,
        aaguid: parsedAuthData.aaguid,
        credentialId: parsedAuthData.credentialId,
        publicKeyRaw: bytesToBase64Url(publicKeyRaw),
    }
}

function parseAndVerifyClientData(clientDataBytes, { expectedType, expectedChallenge, expectedOrigin, expectedOrigins }) {
    let clientDataText
    try {
        clientDataText = TEXT_DECODER_STRICT.decode(clientDataBytes)
    } catch {
        throw new WebAuthnError('WEBAUTHN_INVALID_INPUT', 'Invalid UTF-8 in clientDataJSON')
    }

    let clientData
    try {
        clientData = JSON.parse(clientDataText)
    } catch {
        throw new WebAuthnError('WEBAUTHN_INVALID_INPUT', 'Malformed JSON in clientDataJSON')
    }

    if (!clientData || typeof clientData !== 'object' || Array.isArray(clientData)) {
        throw new WebAuthnError('WEBAUTHN_INVALID_INPUT', 'Invalid clientDataJSON structure')
    }

    if (clientData.type !== expectedType) {
        throw new WebAuthnError('WEBAUTHN_TYPE_MISMATCH', `Invalid clientData type: ${clientData.type}`)
    }

    if (clientData.crossOrigin === true) {
        throw new WebAuthnError('WEBAUTHN_CROSS_ORIGIN', 'Cross-origin WebAuthn ceremonies are forbidden')
    }

    if (expectedChallenge !== undefined && expectedChallenge !== null) {
        if (typeof clientData.challenge !== 'string' || !constantTimeEqualStrings(clientData.challenge, String(expectedChallenge))) {
            throw new WebAuthnError('WEBAUTHN_CHALLENGE_MISMATCH', 'Challenge mismatch or expired')
        }
    }

    const allowedList = Array.isArray(expectedOrigins) && expectedOrigins.length > 0
        ? expectedOrigins
        : expectedOrigin
            ? [expectedOrigin]
            : []

    if (allowedList.length > 0) {
        if (typeof clientData.origin !== 'string' || !clientData.origin) {
            throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', 'Origin mismatch: missing origin in clientDataJSON')
        }
        let actualNormOrigin
        try {
            actualNormOrigin = new URL(clientData.origin).origin
        } catch {
            throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', 'Origin mismatch: invalid origin in clientDataJSON')
        }

        const normalizedAllowed = allowedList.map(o => new URL(o).origin)
        if (!normalizedAllowed.includes(actualNormOrigin)) {
            throw new WebAuthnError('WEBAUTHN_ORIGIN_MISMATCH', `Origin mismatch: expected ${normalizedAllowed.join(', ')}, got ${actualNormOrigin}`)
        }
    }

    return clientData
}

async function verifyRpIdHash(actualRpIdHash, expectedRpId) {
    if (!expectedRpId) return
    const expectedRpIdHash = new Uint8Array(await crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(expectedRpId)))
    if (!constantTimeEqualBytes(expectedRpIdHash, actualRpIdHash)) {
        throw new WebAuthnError('WEBAUTHN_RPID_MISMATCH', 'RP ID hash mismatch')
    }
}

/**
 * Enforce stored-backup_eligible-based signCount monotonicity rules.
 * - storedBackupEligible === true: allows 0 or non-monotonic counters.
 * - storedBackupEligible === false: allows >= 0 when storedSignCount === 0; requires assertedSignCount > storedSignCount when storedSignCount > 0.
 */
export function checkSignCountPolicy({ storedBackupEligible, storedSignCount = 0, assertedSignCount = 0 }) {
    const isSynced = Boolean(storedBackupEligible)
    const prev = Number(storedSignCount) || 0
    const curr = Number(assertedSignCount) >>> 0

    if (isSynced) {
        return { ok: true }
    }
    if (prev > 0 && curr <= prev) {
        return { ok: false, reason: 'sign_count_regression' }
    }
    return { ok: true }
}

/**
 * Verify a WebAuthn registration response (attestationObject + clientDataJSON + optional rawId).
 */
export async function verifyRegistrationResponse({
    attestationObjectBase64,
    clientDataJsonBase64,
    rawIdBase64,
    expectedChallenge,
    expectedOrigin,
    expectedOrigins,
    expectedRpId,
    requireUserVerification = true,
    allowedAlgorithms = [COSE_ALG_ES256, COSE_ALG_RS256],
}) {
    const clientDataBytes = base64UrlToBytes(clientDataJsonBase64, { strict: true, maxLength: 4096 })
    const attestationBytes = base64UrlToBytes(attestationObjectBase64, { strict: true, maxLength: 16384 })

    const clientData = parseAndVerifyClientData(clientDataBytes, {
        expectedType: 'webauthn.create',
        expectedChallenge,
        expectedOrigin,
        expectedOrigins,
    })

    const cbor = decodeCborSafe(attestationBytes)
    if (!(cbor instanceof Map)) {
        throw new WebAuthnError('WEBAUTHN_CBOR_ERROR', 'Invalid attestationObject CBOR')
    }
    const authData = cbor.get('authData')
    if (!(authData instanceof Uint8Array)) {
        throw new WebAuthnError('WEBAUTHN_INVALID_AUTH_DATA', 'Missing authData in attestationObject')
    }

    const parsed = parseAuthenticatorData(authData, { requireAttestedCredentialData: true })

    if (!parsed.up) {
        throw new WebAuthnError('WEBAUTHN_UP_REQUIRED', 'User presence flag (UP) not set during registration')
    }
    if (requireUserVerification && !parsed.uv) {
        throw new WebAuthnError('WEBAUTHN_UV_REQUIRED', 'User verification flag (UV) not set during registration')
    }

    await verifyRpIdHash(parsed.rpIdHash, expectedRpId)

    if (rawIdBase64 !== undefined && rawIdBase64 !== null) {
        const rawIdBytes = base64UrlToBytes(rawIdBase64, { strict: true, maxLength: 1400 })
        if (!constantTimeEqualBytes(rawIdBytes, parsed.credentialIdBytes)) {
            throw new WebAuthnError('WEBAUTHN_CREDENTIAL_ID_MISMATCH', 'rawId does not match attested credentialId')
        }
    }

    const keyInfo = await extractPublicKeyFromCose(parsed.coseKeyMap, { allowedAlgorithms })

    return {
        credentialId: parsed.credentialId,
        publicKeySpki: keyInfo.publicKeySpki,
        publicKeyRaw: keyInfo.publicKeyRaw,
        algorithm: keyInfo.algorithm,
        signCount: parsed.signCount,
        backupEligible: parsed.be,
        backupState: parsed.bs,
        be: parsed.be,
        bs: parsed.bs,
        up: parsed.up,
        uv: parsed.uv,
        flags: parsed.flags,
        aaguid: parsed.aaguid,
        rpIdHash: parsed.rpIdHash,
        clientData,
    }
}

/**
 * Verify a WebAuthn authentication assertion response.
 */
export async function verifyAuthenticationResponse({
    authenticatorDataBase64,
    clientDataJsonBase64,
    signatureBase64,
    rawIdBase64,
    userHandleBase64,
    storedCredential,
    publicKeySpkiBase64,
    publicKeyRawBase64,
    algorithm,
    previousSignCount,
    expectedChallenge,
    expectedOrigin,
    expectedOrigins,
    expectedRpId,
    expectedUserHandle,
    requireUserVerification = true,
    enforceBackupEligibleParity = true,
}) {
    const clientDataBytes = base64UrlToBytes(clientDataJsonBase64, { strict: true, maxLength: 4096 })
    const authDataBytes = base64UrlToBytes(authenticatorDataBase64, { strict: true, maxLength: 4096 })
    const signatureBytes = base64UrlToBytes(signatureBase64, { strict: true, maxLength: 1024 })

    const clientData = parseAndVerifyClientData(clientDataBytes, {
        expectedType: 'webauthn.get',
        expectedChallenge,
        expectedOrigin,
        expectedOrigins,
    })

    const parsedAuthData = parseAuthenticatorData(authDataBytes, { requireAttestedCredentialData: false })

    if (!parsedAuthData.up) {
        throw new WebAuthnError('WEBAUTHN_UP_REQUIRED', 'User presence flag (UP) not set')
    }
    if (requireUserVerification && !parsedAuthData.uv) {
        throw new WebAuthnError('WEBAUTHN_UV_REQUIRED', 'User verification flag (UV) not set')
    }

    await verifyRpIdHash(parsedAuthData.rpIdHash, expectedRpId)

    const credId = storedCredential?.credential_id ?? storedCredential?.credentialId ?? null
    if (rawIdBase64 !== undefined && rawIdBase64 !== null) {
        const rawIdBytes = base64UrlToBytes(rawIdBase64, { strict: true, maxLength: 1400 })
        if (credId && !constantTimeEqualStrings(bytesToBase64Url(rawIdBytes), String(credId))) {
            throw new WebAuthnError('WEBAUTHN_CREDENTIAL_ID_MISMATCH', 'rawId does not match stored credentialId')
        }
    }

    if (userHandleBase64 !== undefined && userHandleBase64 !== null) {
        const userHandleBytes = base64UrlToBytes(userHandleBase64, { strict: true, maxLength: 256 })
        const normalizedUserHandle = bytesToBase64Url(userHandleBytes)
        if (expectedUserHandle !== undefined && expectedUserHandle !== null && !constantTimeEqualStrings(normalizedUserHandle, String(expectedUserHandle))) {
            throw new WebAuthnError('WEBAUTHN_USER_HANDLE_MISMATCH', 'Assertion userHandle does not match expected account user_handle')
        }
    }

    const hasStoredBe = storedCredential && (storedCredential.backup_eligible !== undefined || storedCredential.backupEligible !== undefined)
    const storedBe = hasStoredBe
        ? Boolean(storedCredential.backup_eligible ?? storedCredential.backupEligible)
        : false

    if (enforceBackupEligibleParity && hasStoredBe && Boolean(parsedAuthData.be) !== storedBe) {
        throw new WebAuthnError('WEBAUTHN_BACKUP_ELIGIBLE_MISMATCH', 'Assertion BE flag does not match stored backup_eligible state')
    }

    const storedSignCount = storedCredential
        ? Number(storedCredential.sign_count ?? storedCredential.signCount ?? 0)
        : Number(previousSignCount ?? 0)

    const signCountCheck = checkSignCountPolicy({
        storedBackupEligible: storedBe,
        storedSignCount,
        assertedSignCount: parsedAuthData.signCount,
    })
    if (!signCountCheck.ok) {
        throw new WebAuthnError('WEBAUTHN_SIGN_COUNT_REGRESSION', 'Authenticator signCount did not advance (possible cloned authenticator)')
    }

    const spkiB64 = storedCredential?.public_key_spki ?? storedCredential?.publicKeySpki ?? publicKeySpkiBase64
    const rawB64 = storedCredential?.public_key_raw ?? storedCredential?.publicKeyRaw ?? publicKeyRawBase64
    const resolvedAlg = Number(storedCredential?.algorithm ?? algorithm ?? COSE_ALG_ES256)

    const clientDataHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataBytes))
    const signatureBase = new Uint8Array(authDataBytes.length + clientDataHash.length)
    signatureBase.set(authDataBytes, 0)
    signatureBase.set(clientDataHash, authDataBytes.length)

    let verified = false
    if (resolvedAlg === COSE_ALG_ES256) {
        const p1363SigBytes = derToP1363Strict(signatureBytes)
        let cryptoKey
        if (spkiB64) {
            const spkiBytes = base64UrlToBytes(spkiB64, { strict: true, maxLength: 1400 })
            cryptoKey = await crypto.subtle.importKey(
                'spki',
                spkiBytes,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['verify']
            )
        } else if (rawB64) {
            const rawBytes = base64UrlToBytes(rawB64, { strict: true, maxLength: 256 })
            cryptoKey = await crypto.subtle.importKey(
                'raw',
                rawBytes,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['verify']
            )
        } else {
            throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', 'Missing ES256 public key')
        }
        verified = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            cryptoKey,
            p1363SigBytes,
            signatureBase
        )
    } else if (resolvedAlg === COSE_ALG_RS256) {
        if (!spkiB64) {
            throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', 'Missing RS256 SPKI public key')
        }
        if (signatureBytes.length < 256 || signatureBytes.length > 512) {
            throw new WebAuthnError('WEBAUTHN_SIGNATURE_INVALID', 'Invalid RS256 signature length')
        }
        const spkiBytes = base64UrlToBytes(spkiB64, { strict: true, maxLength: 1400 })
        const cryptoKey = await crypto.subtle.importKey(
            'spki',
            spkiBytes,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['verify']
        )
        verified = await crypto.subtle.verify(
            { name: 'RSASSA-PKCS1-v1_5' },
            cryptoKey,
            signatureBytes,
            signatureBase
        )
    } else {
        throw new WebAuthnError('WEBAUTHN_UNSUPPORTED_COSE_KEY', `Unsupported WebAuthn algorithm: ${resolvedAlg}`)
    }

    if (!verified) {
        throw new WebAuthnError('WEBAUTHN_SIGNATURE_INVALID', 'WebAuthn cryptographic signature verification failed')
    }

    return {
        verified: true,
        signCount: parsedAuthData.signCount,
        flags: parsedAuthData.flags,
        up: parsedAuthData.up,
        uv: parsedAuthData.uv,
        be: parsedAuthData.be,
        bs: parsedAuthData.bs,
        backupEligible: parsedAuthData.be,
        backupState: parsedAuthData.bs,
        clientData,
    }
}
