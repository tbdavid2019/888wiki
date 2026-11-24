/**
 * src/account_data.mjs
 * Passkey account authentication, session management, step-up grants,
 * Personal Space indexing & crash-safe guest import, and Public Share Circles.
 */

import { getAdminPassword, getSecret, getTurnstileSiteKey, isReservedSlug } from './constant.js'
import { Cookies } from './cookie_compat.mjs'
import { MD5, checkAuth, verifyJwtPayload } from './helper.js'
import {
    isBurnProtected,
    isShareBurned,
    isShareDeadmanLocked,
    isShareExpired,
    isShareTimeLocked,
    resolveEditorFormat,
} from './note_meta.js'
import {
    IS_LEGACY_BURNED_SQL,
    StorageAuthorityError,
    assertNotesAuthorityReady,
    checkD1Tables,
    computeTitleSummary,
    generateNonce,
    generateShareToken,
    getAccountDb,
    getStorageDb,
    isAccountFeatureEnabled,
    isCanonicalShareToken,
    isMaintenanceMode,
    isNotesRegistryEnabled,
    resolveAuthoritativeShareMetadata,
} from './storage_driver.mjs'
import { resolveTurnstilePolicy, verifyTurnstileTokenStrict } from './turnstile.mjs'
import {
    COSE_ALG_ES256,
    COSE_ALG_RS256,
    WebAuthnError,
    bytesToBase64Url,
    computeBindingHash,
    generateChallenge,
    isValidBase64Url,
    resolveExpectedOriginAndRpId,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from './webauthn_core.mjs'

export const SESSION_COOKIE_NAME = 'cn_account_session'
export const SESSION_TTL_SECONDS = 30 * 86400
export const CHALLENGE_TTL_SECONDS = 300
export const STEPUP_TTL_SECONDS = 300
export const MAX_ACCOUNT_BODY_BYTES = 32768
export const MAX_SPACE_ITEMS_PER_ACCOUNT = 2000
export const MAX_CIRCLES_PER_ACCOUNT = 20
export const MAX_ITEMS_PER_CIRCLE = 200
export const MAX_IMPORT_CANDIDATES = 50
export const MAX_PENDING_CHALLENGES_PER_BUCKET = 16

export const REQUIRED_ACCOUNT_TABLES = Object.freeze([
    'accounts',
    'account_passkeys',
    'auth_challenges',
    'stepup_grants',
    'used_turnstile_tokens',
    'auth_rate_limits',
    'account_sessions',
    'account_space_items',
    'pending_import_finalizations',
    'share_circles',
    'share_circle_items',
    'account_annotation_links',
])

const VALID_EDITOR_FORMATS = new Set(['markdown', 'block', 'canvas', 'whiteboard'])
const VALID_SPACE_FACETS = new Set(['created', 'edited', 'bookmarked', 'annotated'])
const VERIFIED_ACCOUNT_DBS = new WeakSet()
const TEXT_ENCODER = new TextEncoder()

// Strip ASCII control chars, DEL/C1 controls, zero-width chars, and BiDi overrides
const UNSAFE_TEXT_CHARS_RE = /[\u0000-\u001F\u007F-\u009F\u061C\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g

export class AccountServiceError extends Error {
    constructor(status, code, message, extra = {}) {
        super(message)
        this.name = 'AccountServiceError'
        this.status = status
        this.code = code
        this.extra = extra
    }
}

function nowSec(override) {
    return Number.isFinite(override) ? Math.floor(override) : Math.floor(Date.now() / 1000)
}

function getRuntimeSecret(env = globalThis) {
    return env?.SCN_SECRET ?? getSecret() ?? ''
}

function isUniqueConstraintError(err) {
    const msg = String(err?.message || err || '')
    return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY|constraint failed/i.test(msg)
}

function parseJsonArraySafe(raw) {
    if (Array.isArray(raw)) return raw.filter(v => typeof v === 'string' && v)
    if (typeof raw !== 'string' || !raw) return []
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string' && v) : []
    } catch {
        return []
    }
}

function parseMetaSafe(raw) {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try {
        return JSON.parse(raw) || {}
    } catch {
        return {}
    }
}

function unionStringArrays(...lists) {
    const out = []
    const seen = new Set()
    for (const list of lists) {
        if (!Array.isArray(list)) continue
        for (const item of list) {
            if (typeof item === 'string' && item && !seen.has(item)) {
                seen.add(item)
                out.push(item)
            }
        }
    }
    return out
}

function normalizeEditorFormat(value) {
    const fmt = String(value || 'markdown').trim().toLowerCase()
    return VALID_EDITOR_FORMATS.has(fmt) ? fmt : 'markdown'
}

export function sanitizeNickname(value) {
    if (typeof value !== 'string') return null
    const cleaned = value.replace(UNSAFE_TEXT_CHARS_RE, '').replace(/\s+/g, ' ').trim()
    if (cleaned.length < 1 || cleaned.length > 40) return null
    return cleaned
}

export function sanitizeDeviceLabel(value) {
    if (value === undefined || value === null) return null
    const cleaned = String(value).replace(UNSAFE_TEXT_CHARS_RE, '').replace(/\s+/g, ' ').trim()
    if (!cleaned) return null
    return cleaned.slice(0, 40)
}

export function sanitizeCircleName(value) {
    if (typeof value !== 'string') return null
    const cleaned = value.replace(UNSAFE_TEXT_CHARS_RE, '').replace(/\s+/g, ' ').trim()
    if (cleaned.length < 1 || cleaned.length > 80) return null
    return cleaned
}

/**
 * Verify account feature readiness, maintenance lock, SCN_SECRET, and all 12 accounts.sql tables.
 */
export async function assertAccountFeatureReady(env = globalThis, { write = false } = {}) {
    if (write && isMaintenanceMode(env)) {
        throw new AccountServiceError(503, 'MAINTENANCE_MODE', 'Service is temporarily in maintenance mode')
    }

    if (!isAccountFeatureEnabled(env)) {
        throw new AccountServiceError(503, 'ACCOUNT_DISABLED', 'Passkey accounts are disabled in this deployment')
    }

    const secret = getRuntimeSecret(env)
    if (typeof secret !== 'string' || !secret.trim()) {
        throw new AccountServiceError(503, 'STORAGE_UNAVAILABLE', 'Server secret (SCN_SECRET) is required for account operations')
    }

    let notesDb
    try {
        notesDb = await assertNotesAuthorityReady(env)
    } catch (err) {
        if (err instanceof StorageAuthorityError || err?.name === 'StorageAuthorityError') {
            throw new AccountServiceError(503, err.code || 'STORAGE_UNAVAILABLE', err.message)
        }
        throw err
    }

    const accountDb = getAccountDb(env)
    if (!accountDb || typeof accountDb.prepare !== 'function') {
        throw new AccountServiceError(503, 'ACCOUNT_DISABLED', 'Account D1 database binding is unavailable')
    }

    if (!VERIFIED_ACCOUNT_DBS.has(accountDb)) {
        const tableCheck = await checkD1Tables(accountDb, REQUIRED_ACCOUNT_TABLES)
        if (!tableCheck.ok) {
            const code = tableCheck.code === 'D1_SCHEMA_MISSING' ? 'D1_SCHEMA_MISSING' : 'STORAGE_UNAVAILABLE'
            const message = code === 'D1_SCHEMA_MISSING'
                ? `Missing required account D1 tables: ${tableCheck.missingTables.join(', ')}`
                : `Account D1 database unavailable: ${tableCheck.error || 'unknown error'}`
            throw new AccountServiceError(503, code, message)
        }
        VERIFIED_ACCOUNT_DBS.add(accountDb)
    }

    return { accountDb, notesDb }
}

/**
 * Read and parse a bounded JSON request body (<= maxBytes before JSON.parse).
 */
export async function readBoundedJsonBody(request, maxBytes = MAX_ACCOUNT_BODY_BYTES, { allowEmpty = false } = {}) {
    const contentLenHeader = request?.headers?.get?.('content-length')
    if (contentLenHeader !== null && contentLenHeader !== undefined && contentLenHeader !== '') {
        const declared = Number(contentLenHeader)
        if (Number.isFinite(declared) && declared > maxBytes) {
            throw new AccountServiceError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds ${maxBytes} byte limit`)
        }
    }

    let text = ''
    if (request?.body && typeof request.body.getReader === 'function') {
        const reader = request.body.getReader()
        const chunks = []
        let total = 0
        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                if (value) {
                    total += value.byteLength
                    if (total > maxBytes) {
                        await reader.cancel().catch(() => {})
                        throw new AccountServiceError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds ${maxBytes} byte limit`)
                    }
                    chunks.push(value)
                }
            }
        } catch (err) {
            if (err instanceof AccountServiceError) throw err
            throw new AccountServiceError(400, 'INVALID_JSON', 'Failed to read request body')
        }
        const combined = new Uint8Array(total)
        let offset = 0
        for (const c of chunks) {
            combined.set(c, offset)
            offset += c.byteLength
        }
        try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(combined)
        } catch {
            throw new AccountServiceError(400, 'INVALID_JSON', 'Invalid UTF-8 in request body')
        }
    } else if (typeof request?.text === 'function') {
        text = await request.text()
        if (TEXT_ENCODER.encode(text).byteLength > maxBytes) {
            throw new AccountServiceError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds ${maxBytes} byte limit`)
        }
    }

    if (!text || !text.trim()) {
        if (allowEmpty) return {}
        throw new AccountServiceError(400, 'INVALID_JSON', 'Empty JSON request body')
    }

    let parsed
    try {
        parsed = JSON.parse(text)
    } catch {
        throw new AccountServiceError(400, 'INVALID_JSON', 'Malformed JSON request body')
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new AccountServiceError(400, 'INVALID_JSON', 'JSON request body must be an object')
    }
    return parsed
}

/**
 * Enforce strict Origin allowlist and Sec-Fetch-Site checks on state-changing requests.
 */
export function enforceAccountCsrf(request, env = globalThis) {
    let reqUrl
    try {
        reqUrl = new URL(request.url)
    } catch {
        throw new AccountServiceError(400, 'INVALID_REQUEST_URL', 'Invalid request URL')
    }

    const originHeader = request?.headers?.get?.('Origin')
    if (!originHeader) {
        throw new AccountServiceError(403, 'CSRF_ORIGIN_REQUIRED', 'Origin header is required')
    }

    let parsedOrigin
    try {
        parsedOrigin = new URL(originHeader).origin
    } catch {
        throw new AccountServiceError(403, 'CSRF_ORIGIN_INVALID', 'Malformed Origin header')
    }

    if (parsedOrigin !== reqUrl.origin) {
        throw new AccountServiceError(403, 'CSRF_ORIGIN_MISMATCH', 'Cross-origin request rejected')
    }

    const configuredOriginsRaw = String(env?.SCN_PASSKEY_ORIGINS ?? globalThis?.SCN_PASSKEY_ORIGINS ?? '').trim()
    if (configuredOriginsRaw) {
        const allowlist = configuredOriginsRaw.split(',').map(s => {
            try {
                return new URL(s.trim()).origin
            } catch {
                return ''
            }
        }).filter(Boolean)
        if (!allowlist.includes(parsedOrigin)) {
            throw new AccountServiceError(403, 'CSRF_ORIGIN_MISMATCH', 'Origin is not in configured allowlist')
        }
    }

    const secFetchSite = request?.headers?.get?.('Sec-Fetch-Site')
    if (secFetchSite !== null && secFetchSite !== undefined && secFetchSite !== '') {
        const normalized = String(secFetchSite).trim().toLowerCase()
        if (normalized !== 'same-origin' && normalized !== 'none') {
            throw new AccountServiceError(403, 'CSRF_FETCH_SITE_REJECTED', 'Cross-site fetch metadata rejected')
        }
    }
}

/**
 * Enforce JSON Content-Type on state-changing JSON API requests.
 */
export function enforceJsonContentType(request) {
    const contentType = request?.headers?.get?.('Content-Type') || ''
    const mimeType = contentType.split(';')[0].trim().toLowerCase()
    if (mimeType !== 'application/json') {
        throw new AccountServiceError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json')
    }
}

export function parseSessionCookie(request) {
    const rawCookie = request?.headers?.get?.('Cookie') || ''
    if (!rawCookie) return null
    const parsed = Cookies.parse(rawCookie)
    const token = parsed?.[SESSION_COOKIE_NAME]
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
        return null
    }
    return token
}

export function buildSessionCookie(sessionId, request, { clear = false } = {}) {
    let isHttps = false
    try {
        const url = new URL(request.url)
        isHttps = url.protocol === 'https:' || request?.headers?.get?.('x-forwarded-proto') === 'https'
    } catch {
        isHttps = false
    }
    return Cookies.serialize(SESSION_COOKIE_NAME, clear ? '' : String(sessionId || ''), {
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        maxAge: clear ? 0 : SESSION_TTL_SECONDS,
        ...(isHttps ? { secure: true } : {}),
    })
}

export async function resolveAccountSession(request, env = globalThis, { nowUnix } = {}) {
    if (!isAccountFeatureEnabled(env)) return null
    const accountDb = getAccountDb(env)
    if (!accountDb || typeof accountDb.prepare !== 'function') return null

    const sessionId = parseSessionCookie(request)
    if (!sessionId) return null

    const now = nowSec(nowUnix)
    try {
        const row = await accountDb.prepare(`
            SELECT s.id AS session_id,
                   s.account_id,
                   s.created_at AS session_created_at,
                   s.expires_at AS session_expires_at,
                   a.user_handle,
                   a.nickname,
                   a.created_at AS account_created_at,
                   a.updated_at AS account_updated_at
            FROM account_sessions s
            JOIN accounts a ON a.id = s.account_id
            WHERE s.id = ?
              AND s.revoked_at IS NULL
              AND s.expires_at > ?
            LIMIT 1
        `).bind(sessionId, now).first()
        return row || null
    } catch {
        return null
    }
}

function getClientIp(request) {
    return (
        request?.headers?.get?.('cf-connecting-ip')
        || request?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim()
        || '127.0.0.1'
    )
}

async function getClientIpHash(request, env = globalThis) {
    const ip = getClientIp(request)
    const secret = getRuntimeSecret(env) || 'cf-notepad-rate-limit'
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(`${secret}\n${ip}`)))
    return bytesToBase64Url(digest)
}

/**
 * Atomic SQL upsert rate-limiter in auth_rate_limits.
 */
export async function enforceAuthRateLimit(accountDb, { bucketKey, limit, windowSeconds, now = nowSec() }) {
    if (!accountDb || typeof accountDb.prepare !== 'function' || !bucketKey) return
    const nextResetAt = now + Math.max(1, Number(windowSeconds) || 60)
    const row = await accountDb.prepare(`
        INSERT INTO auth_rate_limits (bucket_key, count, reset_at)
        VALUES (?, 1, ?)
        ON CONFLICT(bucket_key) DO UPDATE SET
            count = CASE WHEN auth_rate_limits.reset_at <= ? THEN 1 ELSE auth_rate_limits.count + 1 END,
            reset_at = CASE WHEN auth_rate_limits.reset_at <= ? THEN ? ELSE auth_rate_limits.reset_at END
        RETURNING count, reset_at
    `).bind(bucketKey, nextResetAt, now, now, nextResetAt).first()

    const count = Number(row?.count ?? 0)
    const resetAt = Number(row?.reset_at ?? nextResetAt)
    if (count > limit) {
        const retryAfter = Math.max(1, resetAt - now)
        throw new AccountServiceError(429, 'RATE_LIMITED', 'Too many authentication attempts; please wait and try again.', {
            retryAfter,
        })
    }
}

async function enforcePendingChallengeCap(accountDb, { accountId, now = nowSec(), cap = MAX_PENDING_CHALLENGES_PER_BUCKET }) {
    const row = await accountDb.prepare(`
        SELECT COUNT(*) AS cnt
        FROM auth_challenges
        WHERE account_id = ?
          AND consumed_nonce IS NULL
          AND expires_at > ?
    `).bind(accountId, now).first()

    if (Number(row?.cnt ?? 0) >= cap) {
        throw new AccountServiceError(429, 'TOO_MANY_PENDING_CHALLENGES', 'Too many pending authentication challenges; please wait.')
    }
}

async function reserveAnonymousChallenge(accountDb, { purpose, ipHash, now }) {
    // Keep the whole bucket until the most recently issued challenge expires.
    // This conservatively bounds live challenges without storing client data on them.
    const resetAt = now + CHALLENGE_TTL_SECONDS
    const row = await accountDb.prepare(`
        INSERT INTO auth_rate_limits (bucket_key, count, reset_at)
        VALUES (?, 1, ?)
        ON CONFLICT(bucket_key) DO UPDATE SET
            count = CASE WHEN auth_rate_limits.reset_at <= ? THEN 1 ELSE auth_rate_limits.count + 1 END,
            reset_at = MAX(auth_rate_limits.reset_at, ?)
        WHERE auth_rate_limits.reset_at <= ? OR auth_rate_limits.count < ?
        RETURNING count
    `).bind(`pending:${purpose}:${ipHash}`, resetAt, now, resetAt, now, MAX_PENDING_CHALLENGES_PER_BUCKET).first()
    if (!row) {
        throw new AccountServiceError(429, 'TOO_MANY_PENDING_CHALLENGES', 'Too many pending authentication challenges; please wait.')
    }
}

function validateCredentialRegistrationFields(body) {
    const challenge = body?.challenge
    const cred = body?.credential
    if (!isValidBase64Url(challenge, { maxLength: 128 })) {
        throw new AccountServiceError(400, 'INVALID_CHALLENGE', 'Invalid challenge format')
    }
    if (!cred || typeof cred !== 'object' || !cred.response || typeof cred.response !== 'object') {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Malformed WebAuthn credential payload')
    }
    if (cred.id !== undefined && !isValidBase64Url(cred.id, { maxLength: 1400 })) {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Invalid credential id')
    }
    if (!isValidBase64Url(cred.rawId, { maxLength: 1400 })) {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Invalid credential rawId')
    }
    if (!isValidBase64Url(cred.response.clientDataJSON, { maxLength: 4096 })) {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Invalid clientDataJSON')
    }
    if (!isValidBase64Url(cred.response.attestationObject, { maxLength: 16384 })) {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Invalid attestationObject')
    }
    let transports = []
    if (Array.isArray(cred.response.transports)) {
        transports = cred.response.transports
            .filter(t => typeof t === 'string' && t.trim().length > 0 && t.trim().length <= 32)
            .slice(0, 10)
            .map(t => t.trim())
    }
    return { challenge, cred, transports }
}

function validateCredentialAssertionFields(body) {
    const challenge = body?.challenge
    const cred = body?.credential
    if (!isValidBase64Url(challenge, { maxLength: 128 })) {
        throw new AccountServiceError(400, 'INVALID_CHALLENGE', 'Invalid challenge format')
    }
    if (!cred || typeof cred !== 'object' || !cred.response || typeof cred.response !== 'object') {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Malformed WebAuthn assertion payload')
    }
    if (cred.id !== undefined && !isValidBase64Url(cred.id, { maxLength: 1400 })) {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Invalid credential id')
    }
    if (!isValidBase64Url(cred.rawId, { maxLength: 1400 })) {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Invalid credential rawId')
    }
    if (!isValidBase64Url(cred.response.clientDataJSON, { maxLength: 4096 })) {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Invalid clientDataJSON')
    }
    if (!isValidBase64Url(cred.response.authenticatorData, { maxLength: 4096 })) {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Invalid authenticatorData')
    }
    if (!isValidBase64Url(cred.response.signature, { maxLength: 1024 })) {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Invalid signature')
    }
    if (cred.response.userHandle !== undefined && cred.response.userHandle !== null && cred.response.userHandle !== '') {
        if (!isValidBase64Url(cred.response.userHandle, { maxLength: 256 })) {
            throw new AccountServiceError(400, 'INVALID_CREDENTIAL', 'Invalid userHandle')
        }
    }
    const credentialId = cred.id || cred.rawId
    return { challenge, cred, credentialId }
}

function getSafeRpOrigin(request, env) {
    try {
        return resolveExpectedOriginAndRpId(request, env)
    } catch (err) {
        if (err instanceof WebAuthnError) {
            throw new AccountServiceError(400, err.code, err.message)
        }
        throw err
    }
}

/**
 * Step 1 of Passkey account registration: validate Turnstile readiness, rate limits, and issue challenge.
 */
export async function registerPasskeyStart(request, env = globalThis, body = {}, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const nickname = sanitizeNickname(body?.nickname)
    if (!nickname) {
        throw new AccountServiceError(400, 'INVALID_NICKNAME', 'Nickname must be 1 to 40 characters')
    }

    const turnstilePolicy = resolveTurnstilePolicy(env)
    if (turnstilePolicy === 'misconfigured') {
        throw new AccountServiceError(503, 'TURNSTILE_MISCONFIGURED', 'Turnstile is misconfigured on this server')
    }

    const { origin, rpId } = getSafeRpOrigin(request, env)
    const now = nowSec(nowUnix)
    const ipHash = await getClientIpHash(request, env)
    const rateLimit = Number(env?.SCN_AUTH_RATE_LIMIT || 30)
    await enforceAuthRateLimit(accountDb, {
        bucketKey: `reg_opts:${ipHash}`,
        limit: rateLimit,
        windowSeconds: 60,
        now,
    })
    await reserveAnonymousChallenge(accountDb, { purpose: 'register', ipHash, now })

    const bindingHash = await computeBindingHash({ origin, rpId, purpose: 'register', sessionId: '' })

    const challenge = generateChallenge()
    const userHandleBytes = new Uint8Array(32)
    crypto.getRandomValues(userHandleBytes)
    const userHandle = bytesToBase64Url(userHandleBytes)
    const expiresAt = now + CHALLENGE_TTL_SECONDS

    await accountDb.prepare(`
        INSERT INTO auth_challenges (challenge, purpose, binding_hash, user_handle, expires_at, created_at)
        VALUES (?, 'register', ?, ?, ?, ?)
    `).bind(challenge, bindingHash, userHandle, expiresAt, now).run()

    const rpName = String(env?.SCN_APP_NAME || globalThis?.SCN_APP_NAME || 'david888 wiki').trim() || 'david888 wiki'
    return {
        challenge,
        userHandle,
        publicKey: {
            rp: { name: rpName, id: rpId },
            user: { id: userHandle, name: nickname, displayName: nickname },
            challenge,
            pubKeyCredParams: [
                { type: 'public-key', alg: COSE_ALG_ES256 },
                { type: 'public-key', alg: COSE_ALG_RS256 },
            ],
            timeout: 60000,
            attestation: 'none',
            authenticatorSelection: {
                residentKey: 'required',
                requireResidentKey: true,
                userVerification: 'required',
            },
            excludeCredentials: [],
        },
    }
}

/**
 * Step 2 of Passkey account registration: verify Turnstile, WebAuthn attestation, and execute 6-stmt atomic batch.
 */
export async function registerPasskeyFinish(request, env = globalThis, body = {}, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const nickname = sanitizeNickname(body?.nickname)
    if (!nickname) {
        throw new AccountServiceError(400, 'INVALID_NICKNAME', 'Nickname must be 1 to 40 characters')
    }

    const { challenge, cred, transports } = validateCredentialRegistrationFields(body)
    const deviceLabel = sanitizeDeviceLabel(body?.deviceLabel)
    const { origin, rpId } = getSafeRpOrigin(request, env)
    const now = nowSec(nowUnix)
    const ipHash = await getClientIpHash(request, env)
    const rateLimit = Number(env?.SCN_AUTH_RATE_LIMIT || 30)
    await enforceAuthRateLimit(accountDb, {
        bucketKey: `reg_verify:${ipHash}`,
        limit: rateLimit,
        windowSeconds: 60,
        now,
    })

    const turnstilePolicy = resolveTurnstilePolicy(env)
    if (turnstilePolicy === 'misconfigured') {
        throw new AccountServiceError(503, 'TURNSTILE_MISCONFIGURED', 'Turnstile is misconfigured on this server')
    }

    let tokenHash = null
    if (turnstilePolicy === 'enabled') {
        const tsRes = await verifyTurnstileTokenStrict(body?.turnstileToken, getClientIp(request), {
            expectedHostname: new URL(origin).hostname,
            expectedAction: 'passkey_register',
            env,
        })
        if (tsRes.misconfigured) {
            throw new AccountServiceError(503, 'TURNSTILE_MISCONFIGURED', 'Turnstile is misconfigured on this server')
        }
        if (!tsRes.ok) {
            throw new AccountServiceError(403, 'TURNSTILE_FAILED', `Turnstile verification failed: ${tsRes.reason || 'invalid'}`)
        }
        tokenHash = tsRes.tokenHash
    }

    const bindingHash = await computeBindingHash({ origin, rpId, purpose: 'register', sessionId: '' })
    const challengeRow = await accountDb.prepare(`
        SELECT challenge, user_handle, consumed_nonce, expires_at
        FROM auth_challenges
        WHERE challenge = ?
          AND purpose = 'register'
          AND binding_hash = ?
        LIMIT 1
    `).bind(challenge, bindingHash).first()

    if (!challengeRow || challengeRow.consumed_nonce !== null || Number(challengeRow.expires_at) <= now || !challengeRow.user_handle) {
        throw new AccountServiceError(400, 'INVALID_OR_EXPIRED_CHALLENGE', 'Registration challenge is invalid or expired')
    }

    let verified
    try {
        verified = await verifyRegistrationResponse({
            attestationObjectBase64: cred.response.attestationObject,
            clientDataJsonBase64: cred.response.clientDataJSON,
            rawIdBase64: cred.rawId,
            expectedChallenge: challenge,
            expectedOrigin: origin,
            expectedRpId: rpId,
            requireUserVerification: true,
        })
    } catch (err) {
        if (err instanceof WebAuthnError) {
            throw new AccountServiceError(400, err.code, err.message)
        }
        throw err
    }

    if (cred.id && cred.id !== verified.credentialId) {
        throw new AccountServiceError(400, 'WEBAUTHN_CREDENTIAL_ID_MISMATCH', 'Credential id does not match attested credentialId')
    }

    const commitNonce = generateNonce()
    const accountId = generateNonce()
    const sessionBytes = new Uint8Array(32)
    crypto.getRandomValues(sessionBytes)
    const sessionId = bytesToBase64Url(sessionBytes)
    const sessionExpiresAt = now + SESSION_TTL_SECONDS
    const transportsJson = transports.length > 0 ? JSON.stringify(transports) : null

    const stmts = []
    if (turnstilePolicy === 'enabled' && tokenHash) {
        stmts.push(
            accountDb.prepare(`
                UPDATE auth_challenges
                SET consumed_nonce = ?
                WHERE challenge = ?
                  AND purpose = 'register'
                  AND binding_hash = ?
                  AND user_handle = ?
                  AND consumed_nonce IS NULL
                  AND expires_at > ?
                  AND NOT EXISTS (SELECT 1 FROM account_passkeys WHERE credential_id = ?)
                  AND NOT EXISTS (SELECT 1 FROM used_turnstile_tokens WHERE token_hash = ?)
            `).bind(commitNonce, challenge, bindingHash, challengeRow.user_handle, now, verified.credentialId, tokenHash),
            accountDb.prepare(`
                INSERT INTO used_turnstile_tokens (token_hash, expires_at, created_at)
                SELECT ?, ?, ?
                WHERE EXISTS (SELECT 1 FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?)
            `).bind(tokenHash, now + 600, now, challenge, commitNonce),
        )
    } else {
        stmts.push(
            accountDb.prepare(`
                UPDATE auth_challenges
                SET consumed_nonce = ?
                WHERE challenge = ?
                  AND purpose = 'register'
                  AND binding_hash = ?
                  AND user_handle = ?
                  AND consumed_nonce IS NULL
                  AND expires_at > ?
                  AND NOT EXISTS (SELECT 1 FROM account_passkeys WHERE credential_id = ?)
            `).bind(commitNonce, challenge, bindingHash, challengeRow.user_handle, now, verified.credentialId),
        )
    }

    stmts.push(
        accountDb.prepare(`
            INSERT INTO accounts (id, user_handle, nickname, created_at, updated_at)
            SELECT ?, ?, ?, ?, ?
            WHERE EXISTS (SELECT 1 FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?)
        `).bind(accountId, challengeRow.user_handle, nickname, now, now, challenge, commitNonce),
        accountDb.prepare(`
            INSERT INTO account_passkeys (
                credential_id, account_id, public_key_spki, algorithm,
                sign_count, backup_eligible, backup_state, transports_json,
                device_label, created_at, last_used_at
            )
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL
            WHERE EXISTS (SELECT 1 FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?)
        `).bind(
            verified.credentialId,
            accountId,
            verified.publicKeySpki,
            verified.algorithm,
            verified.signCount,
            verified.be ? 1 : 0,
            verified.bs ? 1 : 0,
            transportsJson,
            deviceLabel,
            now,
            challenge,
            commitNonce,
        ),
    )

    const sessionStmtIndex = stmts.length
    stmts.push(
        accountDb.prepare(`
            INSERT INTO account_sessions (id, account_id, created_at, expires_at, revoked_at)
            SELECT ?, ?, ?, ?, NULL
            WHERE EXISTS (SELECT 1 FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?)
        `).bind(sessionId, accountId, now, sessionExpiresAt, challenge, commitNonce),
        accountDb.prepare(`
            DELETE FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?
        `).bind(challenge, commitNonce),
    )

    const results = await accountDb.batch(stmts)
    if (Number(results?.[0]?.meta?.changes ?? 0) !== 1 || Number(results?.[sessionStmtIndex]?.meta?.changes ?? 0) !== 1) {
        throw new AccountServiceError(409, 'REGISTRATION_CONFLICT', 'Registration could not be completed (challenge, Turnstile token, or credential conflict)')
    }

    return {
        sessionId,
        credentialId: verified.credentialId,
        account: {
            nickname,
            createdAt: now,
            updatedAt: now,
        },
    }
}

/**
 * Step 1 of Passkey login: issue discoverable credential assertion challenge.
 */
export async function loginPasskeyStart(request, env = globalThis, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const { origin, rpId } = getSafeRpOrigin(request, env)
    const now = nowSec(nowUnix)
    const ipHash = await getClientIpHash(request, env)
    const rateLimit = Number(env?.SCN_AUTH_RATE_LIMIT || 30)
    await enforceAuthRateLimit(accountDb, {
        bucketKey: `login_opts:${ipHash}`,
        limit: rateLimit,
        windowSeconds: 60,
        now,
    })
    await reserveAnonymousChallenge(accountDb, { purpose: 'login', ipHash, now })

    const bindingHash = await computeBindingHash({ origin, rpId, purpose: 'login', sessionId: '' })

    const challenge = generateChallenge()
    const expiresAt = now + CHALLENGE_TTL_SECONDS
    await accountDb.prepare(`
        INSERT INTO auth_challenges (challenge, purpose, binding_hash, expires_at, created_at)
        VALUES (?, 'login', ?, ?, ?)
    `).bind(challenge, bindingHash, expiresAt, now).run()

    return {
        challenge,
        publicKey: {
            challenge,
            rpId,
            timeout: 60000,
            userVerification: 'required',
            allowCredentials: [],
        },
    }
}

/**
 * Step 2 of Passkey login: Step 0 lookup, WebAuthn + BE parity + monotonicity check, and 4-stmt CAS batch.
 */
export async function loginPasskeyFinish(request, env = globalThis, body = {}, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const { challenge, cred, credentialId } = validateCredentialAssertionFields(body)
    const { origin, rpId } = getSafeRpOrigin(request, env)
    const now = nowSec(nowUnix)
    const ipHash = await getClientIpHash(request, env)
    const rateLimit = Number(env?.SCN_AUTH_RATE_LIMIT || 30)
    await enforceAuthRateLimit(accountDb, {
        bucketKey: `login_verify:${ipHash}`,
        limit: rateLimit,
        windowSeconds: 60,
        now,
    })

    // Step 0: Pre-CAS credential & account lookup
    const credRow = await accountDb.prepare(`
        SELECT p.credential_id, p.account_id, p.public_key_spki, p.algorithm,
               p.sign_count, p.backup_eligible, a.user_handle, a.nickname,
               a.created_at AS account_created_at, a.updated_at AS account_updated_at
        FROM account_passkeys p
        JOIN accounts a ON a.id = p.account_id
        WHERE p.credential_id = ?
        LIMIT 1
    `).bind(credentialId).first()

    if (!credRow) {
        throw new AccountServiceError(
            401,
            'UNKNOWN_PASSKEY_CREDENTIAL',
            'This Passkey is not registered to any user account. Note: Admin FIDO keys cannot sign in to user accounts.',
        )
    }

    let verified
    try {
        verified = await verifyAuthenticationResponse({
            authenticatorDataBase64: cred.response.authenticatorData,
            clientDataJsonBase64: cred.response.clientDataJSON,
            signatureBase64: cred.response.signature,
            rawIdBase64: cred.rawId,
            userHandleBase64: cred.response.userHandle,
            storedCredential: credRow,
            expectedChallenge: challenge,
            expectedOrigin: origin,
            expectedRpId: rpId,
            expectedUserHandle: credRow.user_handle,
            requireUserVerification: true,
            enforceBackupEligibleParity: true,
        })
    } catch (err) {
        if (err instanceof WebAuthnError) {
            throw new AccountServiceError(400, err.code, err.message)
        }
        throw err
    }

    const storedCount = Number(credRow.sign_count || 0)
    const assertedCount = Number(verified.signCount || 0)
    const backupStateInt = verified.bs ? 1 : 0
    const storedBeInt = credRow.backup_eligible ? 1 : 0
    const bindingHash = await computeBindingHash({ origin, rpId, purpose: 'login', sessionId: '' })
    const commitNonce = generateNonce()
    const sessionBytes = new Uint8Array(32)
    crypto.getRandomValues(sessionBytes)
    const sessionId = bytesToBase64Url(sessionBytes)
    const sessionExpiresAt = now + SESSION_TTL_SECONDS

    // Exact 4-statement consumed_nonce-locked batch
    const results = await accountDb.batch([
        accountDb.prepare(`
            UPDATE auth_challenges AS c
            SET consumed_nonce = ?
            WHERE c.challenge = ?
              AND c.purpose = 'login'
              AND c.binding_hash = ?
              AND COALESCE(c.account_id, '') = ''
              AND COALESCE(c.session_id, '') = ''
              AND c.consumed_nonce IS NULL
              AND c.expires_at > ?
              AND EXISTS (
                  SELECT 1
                  FROM account_passkeys p
                  JOIN accounts a ON a.id = p.account_id
                  WHERE p.credential_id = ?
                    AND p.account_id = ?
                    AND a.user_handle = ?
                    AND p.backup_eligible = ?
                    AND (p.backup_eligible = 1 OR p.sign_count = ?)
              )
        `).bind(
            commitNonce,
            challenge,
            bindingHash,
            now,
            credRow.credential_id,
            credRow.account_id,
            credRow.user_handle,
            storedBeInt,
            storedCount,
        ),
        accountDb.prepare(`
            UPDATE account_passkeys
            SET sign_count = ?,
                backup_state = ?,
                last_used_at = ?
            WHERE credential_id = ?
              AND account_id = ?
              AND (backup_eligible = 1 OR sign_count = ?)
              AND EXISTS (SELECT 1 FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?)
        `).bind(
            assertedCount,
            backupStateInt,
            now,
            credRow.credential_id,
            credRow.account_id,
            storedCount,
            challenge,
            commitNonce,
        ),
        accountDb.prepare(`
            INSERT INTO account_sessions (id, account_id, created_at, expires_at, revoked_at)
            SELECT ?, ?, ?, ?, NULL
            WHERE EXISTS (SELECT 1 FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?)
              AND EXISTS (
                  SELECT 1 FROM account_passkeys
                  WHERE credential_id = ?
                    AND account_id = ?
                    AND (backup_eligible = 1 OR sign_count = ?)
              )
        `).bind(
            sessionId,
            credRow.account_id,
            now,
            sessionExpiresAt,
            challenge,
            commitNonce,
            credRow.credential_id,
            credRow.account_id,
            assertedCount,
        ),
        accountDb.prepare(`
            DELETE FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?
        `).bind(challenge, commitNonce),
    ])

    if (
        Number(results?.[0]?.meta?.changes ?? 0) !== 1
        || Number(results?.[1]?.meta?.changes ?? 0) !== 1
        || Number(results?.[2]?.meta?.changes ?? 0) !== 1
    ) {
        throw new AccountServiceError(409, 'LOGIN_CONFLICT', 'Concurrent sign-in or challenge expired; please try again.')
    }

    return {
        sessionId,
        account: {
            nickname: credRow.nickname,
            createdAt: Number(credRow.account_created_at || 0),
            updatedAt: Number(credRow.account_updated_at || 0),
        },
    }
}

/**
 * Step 1 of Passkey step-up authorization ('passkey_add_stepup' or 'passkey_remove_stepup').
 */
export async function stepupStart(request, env = globalThis, session, body = {}, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const purpose = String(body?.purpose || '').trim()
    if (purpose !== 'passkey_add_stepup' && purpose !== 'passkey_remove_stepup') {
        throw new AccountServiceError(400, 'INVALID_STEPUP_PURPOSE', 'Invalid step-up purpose')
    }

    const { origin, rpId } = getSafeRpOrigin(request, env)
    const now = nowSec(nowUnix)
    await enforceAuthRateLimit(accountDb, {
        bucketKey: `stepup_opts:${session.account_id}`,
        limit: Number(env?.SCN_AUTH_RATE_LIMIT || 30),
        windowSeconds: 60,
        now,
    })
    await enforcePendingChallengeCap(accountDb, {
        purpose,
        bindingHash: '',
        accountId: session.account_id,
        now,
    })

    const passkeyRows = await accountDb.prepare(`
        SELECT credential_id, transports_json
        FROM account_passkeys
        WHERE account_id = ?
    `).bind(session.account_id).all()

    const allowCredentials = (passkeyRows?.results || []).map(row => {
        const transports = parseJsonArraySafe(row.transports_json)
        return {
            type: 'public-key',
            id: row.credential_id,
            ...(transports.length ? { transports } : {}),
        }
    })

    const challenge = generateChallenge()
    const bindingHash = await computeBindingHash({
        origin,
        rpId,
        purpose,
        sessionId: session.session_id,
    })
    const expiresAt = now + CHALLENGE_TTL_SECONDS

    await accountDb.prepare(`
        INSERT INTO auth_challenges (
            challenge, purpose, binding_hash, user_handle, account_id, session_id, expires_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(challenge, purpose, bindingHash, session.user_handle, session.account_id, session.session_id, expiresAt, now).run()

    return {
        challenge,
        purpose,
        publicKey: {
            challenge,
            rpId,
            timeout: 60000,
            userVerification: 'required',
            allowCredentials,
        },
    }
}

/**
 * Step 2 of Passkey step-up authorization: issues single-use stepup_grants derived from locked challenge.purpose.
 */
export async function stepupFinish(request, env = globalThis, session, body = {}, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const { challenge, cred, credentialId } = validateCredentialAssertionFields(body)
    const { origin, rpId } = getSafeRpOrigin(request, env)
    const now = nowSec(nowUnix)

    const challengeRow = await accountDb.prepare(`
        SELECT challenge, purpose, binding_hash, user_handle, account_id, session_id, consumed_nonce, expires_at
        FROM auth_challenges
        WHERE challenge = ?
          AND account_id = ?
          AND session_id = ?
          AND purpose IN ('passkey_add_stepup', 'passkey_remove_stepup')
        LIMIT 1
    `).bind(challenge, session.account_id, session.session_id).first()

    if (!challengeRow || challengeRow.consumed_nonce !== null || Number(challengeRow.expires_at) <= now) {
        throw new AccountServiceError(400, 'INVALID_OR_EXPIRED_CHALLENGE', 'Step-up challenge is invalid or expired')
    }

    const expectedBindingHash = await computeBindingHash({
        origin,
        rpId,
        purpose: challengeRow.purpose,
        sessionId: session.session_id,
    })
    if (challengeRow.binding_hash !== expectedBindingHash) {
        throw new AccountServiceError(403, 'CHALLENGE_BINDING_MISMATCH', 'Step-up challenge binding mismatch')
    }

    // Step 0 scoped strictly to session.account_id
    const credRow = await accountDb.prepare(`
        SELECT p.credential_id, p.account_id, p.public_key_spki, p.algorithm,
               p.sign_count, p.backup_eligible, a.user_handle
        FROM account_passkeys p
        JOIN accounts a ON a.id = p.account_id
        WHERE p.credential_id = ?
          AND p.account_id = ?
        LIMIT 1
    `).bind(credentialId, session.account_id).first()

    if (!credRow) {
        throw new AccountServiceError(403, 'CREDENTIAL_ACCOUNT_MISMATCH', 'Credential does not belong to the authenticated account')
    }

    let verified
    try {
        verified = await verifyAuthenticationResponse({
            authenticatorDataBase64: cred.response.authenticatorData,
            clientDataJsonBase64: cred.response.clientDataJSON,
            signatureBase64: cred.response.signature,
            rawIdBase64: cred.rawId,
            userHandleBase64: cred.response.userHandle,
            storedCredential: credRow,
            expectedChallenge: challenge,
            expectedOrigin: origin,
            expectedRpId: rpId,
            expectedUserHandle: session.user_handle,
            requireUserVerification: true,
            enforceBackupEligibleParity: true,
        })
    } catch (err) {
        if (err instanceof WebAuthnError) {
            throw new AccountServiceError(400, err.code, err.message)
        }
        throw err
    }

    const storedCount = Number(credRow.sign_count || 0)
    const assertedCount = Number(verified.signCount || 0)
    const backupStateInt = verified.bs ? 1 : 0
    const storedBeInt = credRow.backup_eligible ? 1 : 0
    const commitNonce = generateNonce()
    const grantId = generateNonce()
    const grantExpiresAt = now + STEPUP_TTL_SECONDS

    const results = await accountDb.batch([
        accountDb.prepare(`
            UPDATE auth_challenges AS c
            SET consumed_nonce = ?
            WHERE c.challenge = ?
              AND c.purpose = ?
              AND c.binding_hash = ?
              AND COALESCE(c.account_id, '') = ?
              AND COALESCE(c.session_id, '') = ?
              AND c.consumed_nonce IS NULL
              AND c.expires_at > ?
              AND EXISTS (
                  SELECT 1
                  FROM account_passkeys p
                  JOIN accounts a ON a.id = p.account_id
                  WHERE p.credential_id = ?
                    AND p.account_id = ?
                    AND a.user_handle = ?
                    AND p.backup_eligible = ?
                    AND (p.backup_eligible = 1 OR p.sign_count = ?)
                    AND p.account_id = c.account_id
              )
              AND EXISTS (
                  SELECT 1
                  FROM account_sessions s
                  WHERE s.id = c.session_id
                    AND s.account_id = c.account_id
                    AND s.revoked_at IS NULL
                    AND s.expires_at > ?
              )
        `).bind(
            commitNonce,
            challenge,
            challengeRow.purpose,
            expectedBindingHash,
            session.account_id,
            session.session_id,
            now,
            credRow.credential_id,
            session.account_id,
            session.user_handle,
            storedBeInt,
            storedCount,
            now,
        ),
        accountDb.prepare(`
            UPDATE account_passkeys
            SET sign_count = ?,
                backup_state = ?,
                last_used_at = ?
            WHERE credential_id = ?
              AND account_id = ?
              AND (backup_eligible = 1 OR sign_count = ?)
              AND EXISTS (SELECT 1 FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?)
        `).bind(
            assertedCount,
            backupStateInt,
            now,
            credRow.credential_id,
            session.account_id,
            storedCount,
            challenge,
            commitNonce,
        ),
        accountDb.prepare(`
            INSERT INTO stepup_grants (id, account_id, session_id, action, binding_hash, expires_at, created_at)
            SELECT ?, c.account_id, c.session_id,
                   CASE c.purpose WHEN 'passkey_add_stepup' THEN 'add' ELSE 'remove' END,
                   c.binding_hash, ?, ?
            FROM auth_challenges c
            WHERE c.challenge = ?
              AND c.consumed_nonce = ?
              AND EXISTS (
                  SELECT 1 FROM account_passkeys
                  WHERE credential_id = ? AND account_id = ? AND (backup_eligible = 1 OR sign_count = ?)
              )
        `).bind(
            grantId,
            grantExpiresAt,
            now,
            challenge,
            commitNonce,
            credRow.credential_id,
            session.account_id,
            assertedCount,
        ),
        accountDb.prepare(`
            DELETE FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?
        `).bind(challenge, commitNonce),
    ])

    if (
        Number(results?.[0]?.meta?.changes ?? 0) !== 1
        || Number(results?.[1]?.meta?.changes ?? 0) !== 1
        || Number(results?.[2]?.meta?.changes ?? 0) !== 1
    ) {
        throw new AccountServiceError(409, 'STEPUP_CONFLICT', 'Step-up verification conflict; please try again.')
    }

    return {
        grantId,
        action: challengeRow.purpose === 'passkey_add_stepup' ? 'add' : 'remove',
        expiresAt: grantExpiresAt,
    }
}

/**
 * Step 1 of adding a secondary Passkey (requires valid 'add' step-up grant).
 */
export async function addPasskeyStart(request, env = globalThis, session, body = {}, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const grantId = String(body?.grantId || '').trim()
    if (!grantId || grantId.length > 128) {
        throw new AccountServiceError(400, 'INVALID_STEPUP_GRANT', 'Step-up grantId is required')
    }

    const { origin, rpId } = getSafeRpOrigin(request, env)
    const now = nowSec(nowUnix)
    const grantBindingHash = await computeBindingHash({
        origin,
        rpId,
        purpose: 'passkey_add_stepup',
        sessionId: session.session_id,
    })

    const grantRow = await accountDb.prepare(`
        SELECT id
        FROM stepup_grants
        WHERE id = ?
          AND action = 'add'
          AND account_id = ?
          AND session_id = ?
          AND binding_hash = ?
          AND consumed_nonce IS NULL
          AND expires_at > ?
        LIMIT 1
    `).bind(grantId, session.account_id, session.session_id, grantBindingHash, now).first()

    if (!grantRow) {
        throw new AccountServiceError(403, 'INVALID_STEPUP_GRANT', 'Valid step-up authorization is required before adding a Passkey')
    }

    await enforcePendingChallengeCap(accountDb, {
        purpose: 'register_add',
        bindingHash: '',
        accountId: session.account_id,
        now,
    })

    const existingRows = await accountDb.prepare(`
        SELECT credential_id, transports_json
        FROM account_passkeys
        WHERE account_id = ?
    `).bind(session.account_id).all()

    const excludeCredentials = (existingRows?.results || []).map(row => {
        const transports = parseJsonArraySafe(row.transports_json)
        return {
            type: 'public-key',
            id: row.credential_id,
            ...(transports.length ? { transports } : {}),
        }
    })

    const challenge = generateChallenge()
    const challengeBindingHash = await computeBindingHash({
        origin,
        rpId,
        purpose: 'register_add',
        sessionId: session.session_id,
    })
    const expiresAt = now + CHALLENGE_TTL_SECONDS

    await accountDb.prepare(`
        INSERT INTO auth_challenges (
            challenge, purpose, binding_hash, user_handle, account_id, session_id, stepup_grant_id, expires_at, created_at
        )
        VALUES (?, 'register_add', ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        challenge,
        challengeBindingHash,
        session.user_handle,
        session.account_id,
        session.session_id,
        grantId,
        expiresAt,
        now,
    ).run()

    const rpName = String(env?.SCN_APP_NAME || globalThis?.SCN_APP_NAME || 'david888 wiki').trim() || 'david888 wiki'
    return {
        challenge,
        publicKey: {
            rp: { name: rpName, id: rpId },
            user: { id: session.user_handle, name: session.nickname, displayName: session.nickname },
            challenge,
            pubKeyCredParams: [
                { type: 'public-key', alg: COSE_ALG_ES256 },
                { type: 'public-key', alg: COSE_ALG_RS256 },
            ],
            timeout: 60000,
            attestation: 'none',
            authenticatorSelection: {
                residentKey: 'required',
                requireResidentKey: true,
                userVerification: 'required',
            },
            excludeCredentials,
        },
    }
}

/**
 * Step 2 of adding a secondary Passkey: binds two distinct binding hashes ('register_add' vs 'passkey_add_stepup').
 */
export async function addPasskeyFinish(request, env = globalThis, session, body = {}, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const grantId = String(body?.grantId || '').trim()
    if (!grantId || grantId.length > 128) {
        throw new AccountServiceError(400, 'INVALID_STEPUP_GRANT', 'Step-up grantId is required')
    }

    const { challenge, cred, transports } = validateCredentialRegistrationFields(body)
    const deviceLabel = sanitizeDeviceLabel(body?.deviceLabel)
    const { origin, rpId } = getSafeRpOrigin(request, env)
    const now = nowSec(nowUnix)

    let verified
    try {
        verified = await verifyRegistrationResponse({
            attestationObjectBase64: cred.response.attestationObject,
            clientDataJsonBase64: cred.response.clientDataJSON,
            rawIdBase64: cred.rawId,
            expectedChallenge: challenge,
            expectedOrigin: origin,
            expectedRpId: rpId,
            requireUserVerification: true,
        })
    } catch (err) {
        if (err instanceof WebAuthnError) {
            throw new AccountServiceError(400, err.code, err.message)
        }
        throw err
    }

    if (cred.id && cred.id !== verified.credentialId) {
        throw new AccountServiceError(400, 'WEBAUTHN_CREDENTIAL_ID_MISMATCH', 'Credential id does not match attested credentialId')
    }

    const challengeBindingHash = await computeBindingHash({
        origin,
        rpId,
        purpose: 'register_add',
        sessionId: session.session_id,
    })
    const grantBindingHash = await computeBindingHash({
        origin,
        rpId,
        purpose: 'passkey_add_stepup',
        sessionId: session.session_id,
    })

    const commitNonce = generateNonce()
    const transportsJson = transports.length > 0 ? JSON.stringify(transports) : null

    const results = await accountDb.batch([
        accountDb.prepare(`
            UPDATE auth_challenges
            SET consumed_nonce = ?
            WHERE challenge = ?
              AND purpose = 'register_add'
              AND stepup_grant_id = ?
              AND binding_hash = ?
              AND account_id = ?
              AND session_id = ?
              AND consumed_nonce IS NULL
              AND expires_at > ?
              AND EXISTS (
                  SELECT 1 FROM stepup_grants g
                  WHERE g.id = ?
                    AND g.action = 'add'
                    AND g.consumed_nonce IS NULL
                    AND g.account_id = ?
                    AND g.session_id = ?
                    AND g.binding_hash = ?
                    AND g.expires_at > ?
              )
              AND EXISTS (
                  SELECT 1 FROM account_sessions s
                  WHERE s.id = ?
                    AND s.account_id = ?
                    AND s.revoked_at IS NULL
                    AND s.expires_at > ?
              )
              AND NOT EXISTS (SELECT 1 FROM account_passkeys WHERE credential_id = ?)
        `).bind(
            commitNonce,
            challenge,
            grantId,
            challengeBindingHash,
            session.account_id,
            session.session_id,
            now,
            grantId,
            session.account_id,
            session.session_id,
            grantBindingHash,
            now,
            session.session_id,
            session.account_id,
            now,
            verified.credentialId,
        ),
        accountDb.prepare(`
            UPDATE stepup_grants
            SET consumed_nonce = ?
            WHERE id = ?
              AND consumed_nonce IS NULL
              AND EXISTS (SELECT 1 FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?)
        `).bind(commitNonce, grantId, challenge, commitNonce),
        accountDb.prepare(`
            INSERT INTO account_passkeys (
                credential_id, account_id, public_key_spki, algorithm,
                sign_count, backup_eligible, backup_state, transports_json,
                device_label, created_at, last_used_at
            )
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL
            WHERE EXISTS (SELECT 1 FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?)
              AND EXISTS (SELECT 1 FROM stepup_grants WHERE id = ? AND consumed_nonce = ?)
        `).bind(
            verified.credentialId,
            session.account_id,
            verified.publicKeySpki,
            verified.algorithm,
            verified.signCount,
            verified.be ? 1 : 0,
            verified.bs ? 1 : 0,
            transportsJson,
            deviceLabel,
            now,
            challenge,
            commitNonce,
            grantId,
            commitNonce,
        ),
        accountDb.prepare(`DELETE FROM auth_challenges WHERE challenge = ? AND consumed_nonce = ?`).bind(challenge, commitNonce),
        accountDb.prepare(`DELETE FROM stepup_grants WHERE id = ? AND consumed_nonce = ?`).bind(grantId, commitNonce),
    ])

    if (Number(results?.[0]?.meta?.changes ?? 0) !== 1 || Number(results?.[2]?.meta?.changes ?? 0) !== 1) {
        throw new AccountServiceError(409, 'ADD_PASSKEY_CONFLICT', 'Failed to add Passkey (invalid grant, challenge, or duplicate credential)')
    }

    return {
        passkey: {
            credentialId: verified.credentialId,
            deviceLabel: deviceLabel || '',
            backupEligible: Boolean(verified.be),
            backupState: Boolean(verified.bs),
            createdAt: now,
            lastUsedAt: null,
        },
    }
}

/**
 * Remove a secondary Passkey using a valid 'remove' step-up grant, revoking all other active sessions.
 */
export async function removePasskey(request, env = globalThis, session, { grantId, credentialId } = {}, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const cleanGrantId = String(grantId || '').trim()
    const cleanCredId = String(credentialId || '').trim()
    if (!cleanGrantId || cleanGrantId.length > 128) {
        throw new AccountServiceError(400, 'INVALID_STEPUP_GRANT', 'Step-up grantId is required')
    }
    if (!isValidBase64Url(cleanCredId, { maxLength: 1400 })) {
        throw new AccountServiceError(400, 'INVALID_CREDENTIAL_ID', 'Invalid credentialId')
    }

    const { origin, rpId } = getSafeRpOrigin(request, env)
    const now = nowSec(nowUnix)
    const grantBindingHash = await computeBindingHash({
        origin,
        rpId,
        purpose: 'passkey_remove_stepup',
        sessionId: session.session_id,
    })
    const commitNonce = generateNonce()

    const results = await accountDb.batch([
        accountDb.prepare(`
            UPDATE stepup_grants
            SET consumed_nonce = ?
            WHERE id = ?
              AND action = 'remove'
              AND consumed_nonce IS NULL
              AND account_id = ?
              AND session_id = ?
              AND binding_hash = ?
              AND expires_at > ?
              AND EXISTS (
                  SELECT 1 FROM account_sessions s
                  WHERE s.id = ?
                    AND s.account_id = ?
                    AND s.revoked_at IS NULL
                    AND s.expires_at > ?
              )
              AND EXISTS (
                  SELECT 1 FROM account_passkeys p
                  WHERE p.credential_id = ? AND p.account_id = ?
              )
              AND (SELECT COUNT(*) FROM account_passkeys WHERE account_id = ?) > 1
        `).bind(
            commitNonce,
            cleanGrantId,
            session.account_id,
            session.session_id,
            grantBindingHash,
            now,
            session.session_id,
            session.account_id,
            now,
            cleanCredId,
            session.account_id,
            session.account_id,
        ),
        accountDb.prepare(`
            UPDATE account_sessions
            SET revoked_at = ?
            WHERE account_id = ?
              AND id != ?
              AND revoked_at IS NULL
              AND EXISTS (SELECT 1 FROM stepup_grants WHERE id = ? AND consumed_nonce = ?)
        `).bind(now, session.account_id, session.session_id, cleanGrantId, commitNonce),
        accountDb.prepare(`
            DELETE FROM account_passkeys
            WHERE credential_id = ?
              AND account_id = ?
              AND (SELECT COUNT(*) FROM account_passkeys WHERE account_id = ?) > 1
              AND EXISTS (SELECT 1 FROM stepup_grants WHERE id = ? AND consumed_nonce = ?)
        `).bind(cleanCredId, session.account_id, session.account_id, cleanGrantId, commitNonce),
        accountDb.prepare(`
            DELETE FROM stepup_grants WHERE id = ? AND consumed_nonce = ?
        `).bind(cleanGrantId, commitNonce),
    ])

    if (Number(results?.[0]?.meta?.changes ?? 0) !== 1 || Number(results?.[2]?.meta?.changes ?? 0) !== 1) {
        const countRow = await accountDb.prepare(
            'SELECT COUNT(*) AS cnt FROM account_passkeys WHERE account_id = ?'
        ).bind(session.account_id).first()
        if (Number(countRow?.cnt ?? 0) <= 1) {
            throw new AccountServiceError(409, 'LAST_PASSKEY_FORBIDDEN', 'Cannot remove the last remaining Passkey')
        }
        throw new AccountServiceError(409, 'REMOVE_PASSKEY_CONFLICT', 'Could not remove Passkey (invalid grant or credential)')
    }

    return { removed: true, credentialId: cleanCredId }
}

export async function logoutSession(env = globalThis, sessionId, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    if (!sessionId) return { revoked: false }
    const now = nowSec(nowUnix)
    const res = await accountDb.prepare(`
        UPDATE account_sessions
        SET revoked_at = ?
        WHERE id = ? AND revoked_at IS NULL
    `).bind(now, sessionId).run()
    return { revoked: Number(res?.meta?.changes ?? 0) > 0 }
}

export async function updateAccountNickname(env = globalThis, accountId, rawNickname, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const nickname = sanitizeNickname(rawNickname)
    if (!nickname) {
        throw new AccountServiceError(400, 'INVALID_NICKNAME', 'Nickname must be 1 to 40 characters')
    }
    const now = nowSec(nowUnix)
    await accountDb.prepare(`
        UPDATE accounts
        SET nickname = ?, updated_at = ?
        WHERE id = ?
    `).bind(nickname, now, accountId).run()

    const row = await accountDb.prepare(`
        SELECT nickname, created_at, updated_at
        FROM accounts
        WHERE id = ?
        LIMIT 1
    `).bind(accountId).first()
    if (!row) {
        throw new AccountServiceError(404, 'ACCOUNT_NOT_FOUND', 'Account not found')
    }
    return {
        nickname: row.nickname,
        createdAt: Number(row.created_at || 0),
        updatedAt: Number(row.updated_at || 0),
    }
}

export async function listAccountPasskeys(env = globalThis, accountId) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: false })
    const res = await accountDb.prepare(`
        SELECT credential_id, device_label, backup_eligible, backup_state, created_at, last_used_at
        FROM account_passkeys
        WHERE account_id = ?
        ORDER BY created_at ASC
    `).bind(accountId).all()

    return (res?.results || []).map(row => ({
        credentialId: row.credential_id,
        deviceLabel: row.device_label || '',
        backupEligible: Boolean(row.backup_eligible),
        backupState: Boolean(row.backup_state),
        createdAt: Number(row.created_at || 0),
        lastUsedAt: row.last_used_at !== null && row.last_used_at !== undefined ? Number(row.last_used_at) : null,
    }))
}

export async function listAccountAnnotations(env = globalThis, accountId, { limit = 50, nowUnix } = {}) {
    const { accountDb, notesDb } = await assertAccountFeatureReady(env, { write: false })
    const cappedLimit = Math.min(50, Math.max(1, Number(limit) || 50))
    const now = nowSec(nowUnix)

    const res = await accountDb.prepare(`
        SELECT l.message_id, l.thread_id, l.note_path, l.note_uid, l.share_id, l.created_at,
               m.author_name, m.body, t.quote_exact
        FROM account_annotation_links l
        JOIN annotation_messages m ON m.id = l.message_id
        JOIN annotation_threads t ON t.id = l.thread_id
        WHERE l.account_id = ?
          AND m.deleted_at IS NULL
        ORDER BY l.created_at DESC
        LIMIT ?
    `).bind(accountId, cappedLimit).all()

    const rows = res?.results || []
    if (!rows.length) return []

    const liveMap = await batchLoadNotesMetadataMap(notesDb, rows.map(r => r.note_path), now)

    return rows.map(row => {
        const live = liveMap.get(row.note_path)
        const noteValid = Boolean(
            live
            && live.metadata?.noteUid === row.note_uid
            && !live.tombstones.has(row.note_uid)
            && live.metadata?.share === true
            && !live.metadata?.vpw
            && !isBurnProtected(live.metadata)
            && !isShareBurned(live.metadata)
            && !isShareExpired(live.metadata, now)
            && !isShareTimeLocked(live.metadata, now)
            && !isShareDeadmanLocked(live.metadata, now)
        )
        const activeReg = noteValid
            ? live.activeTokens.find(tok => tok.note_uid === row.note_uid)
            : null
        const isAvailable = Boolean(noteValid && activeReg?.share_id)
        return {
            messageId: row.message_id,
            threadId: row.thread_id,
            shareId: isAvailable ? activeReg.share_id : '',
            authorName: row.author_name || '',
            body: row.body || '',
            quoteExact: row.quote_exact || '',
            createdAt: Number(row.created_at || 0),
            isAvailable,
        }
    })
}

/**
 * Self-delete ONLY a single owned annotation message without touching replies.
 */
export async function deleteAccountAnnotationMessage(env = globalThis, accountId, messageId, { nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    const cleanId = String(messageId || '').trim()
    if (!cleanId) {
        throw new AccountServiceError(400, 'INVALID_MESSAGE_ID', 'Annotation messageId is required')
    }
    const now = nowSec(nowUnix)

    const results = await accountDb.batch([
        accountDb.prepare(`
            UPDATE annotation_messages
            SET deleted_at = ?
            WHERE id = ?
              AND deleted_at IS NULL
              AND EXISTS (
                  SELECT 1 FROM account_annotation_links
                  WHERE message_id = ? AND account_id = ?
              )
        `).bind(now, cleanId, cleanId, accountId),
        accountDb.prepare(`
            DELETE FROM account_annotation_links
            WHERE message_id = ? AND account_id = ?
        `).bind(cleanId, accountId),
    ])

    if (Number(results?.[0]?.meta?.changes ?? 0) === 0 && Number(results?.[1]?.meta?.changes ?? 0) === 0) {
        throw new AccountServiceError(404, 'ANNOTATION_NOT_FOUND', 'Annotation message not found or not owned by this account')
    }

    return { deleted: true, messageId: cleanId }
}

// ============================================================================
// Personal Space & Confirmation Guest History Import
// ============================================================================

async function batchLoadNotesMetadataMap(notesDb, notePaths = [], now = nowSec()) {
    const uniquePaths = Array.from(new Set(notePaths.filter(p => typeof p === 'string' && p.length > 0)))
    const map = new Map()
    if (!notesDb || !uniquePaths.length) return map

    for (let i = 0; i < uniquePaths.length; i += 40) {
        const chunk = uniquePaths.slice(i, i + 40)
        const placeholders = chunk.map(() => '?').join(', ')

        const [noteRes, tombRes, regRes] = await Promise.all([
            notesDb.prepare(`SELECT path, metadata FROM notes WHERE path IN (${placeholders})`).bind(...chunk).all(),
            notesDb.prepare(`SELECT path, deleted_note_uid FROM note_tombstones WHERE path IN (${placeholders})`).bind(...chunk).all(),
            notesDb.prepare(`
                SELECT share_id, target_path, note_uid, is_csprng_v1, created_at
                FROM share_token_registry
                WHERE target_path IN (${placeholders})
                  AND revoked_at IS NULL
                ORDER BY is_csprng_v1 DESC, created_at DESC
            `).bind(...chunk).all(),
        ])

        for (const p of chunk) {
            map.set(p, { exists: false, metadata: {}, tombstones: new Set(), activeTokens: [] })
        }
        for (const row of (noteRes?.results || [])) {
            const entry = map.get(row.path)
            if (entry) {
                entry.exists = true
                entry.metadata = parseMetaSafe(row.metadata)
            }
        }
        for (const row of (tombRes?.results || [])) {
            const entry = map.get(row.path)
            if (entry && row.deleted_note_uid) {
                entry.tombstones.add(row.deleted_note_uid)
            }
        }
        for (const row of (regRes?.results || [])) {
            const entry = map.get(row.target_path)
            if (entry) {
                entry.activeTokens.push(row)
            }
        }
    }
    void now
    return map
}

function getEditProtectionBadge(meta = {}, now = nowSec()) {
    if (isBurnProtected(meta)) return isShareBurned(meta) ? 'burned' : 'burn'
    if (isShareBurned(meta)) return 'burned'
    if (isShareExpired(meta, now)) return 'expired'
    if (isShareTimeLocked(meta, now)) return 'timelock'
    if (isShareDeadmanLocked(meta, now)) return 'deadman'
    if (meta.vpw) return 'vpw'
    if (meta.pw) return 'pw'
    return null
}

function isLiveSharePubliclyReadable(liveEntry, noteUid, now = nowSec()) {
    if (!liveEntry || !liveEntry.exists) return { ok: false, reason: 'deleted' }
    const meta = liveEntry.metadata || {}
    if (!meta.noteUid || meta.noteUid !== noteUid) return { ok: false, reason: 'uid_mismatch' }
    if (liveEntry.tombstones.has(noteUid)) return { ok: false, reason: 'deleted' }
    if (meta.share !== true) return { ok: false, reason: 'unshared' }
    if (meta.vpw) return { ok: false, reason: 'vpw' }
    if (isShareBurned(meta)) return { ok: false, reason: 'burned' }
    if (isBurnProtected(meta)) return { ok: false, reason: 'burn' }
    if (isShareExpired(meta, now)) return { ok: false, reason: 'expired' }
    if (isShareTimeLocked(meta, now)) return { ok: false, reason: 'timelock' }
    if (isShareDeadmanLocked(meta, now)) return { ok: false, reason: 'deadman' }

    const activeToken = liveEntry.activeTokens.find(t => t.note_uid === noteUid)
    if (!activeToken?.share_id) return { ok: false, reason: 'revoked' }
    return { ok: true, activeToken }
}

async function checkCookieNoteEditProof(request, notePath, metadata = {}, env = globalThis) {
    if (!notePath || !metadata || !metadata.noteUid) {
        return { matched: false, sawStalePathCookie: false }
    }

    const rawCookie = request?.headers?.get?.('Cookie') || ''
    const cookies = Cookies.parse(rawCookie)

    // 1. Admin session
    const adminPassword = env?.SCN_ADMIN_PW ?? getAdminPassword()
    if (adminPassword && cookies.admin_session) {
        try {
            const adminPayload = await verifyJwtPayload(cookies.admin_session, adminPassword)
            if (adminPayload?.role === 'admin') {
                return { matched: true, sawStalePathCookie: false }
            }
        } catch {}
    }

    // 2. Edit JWT cookie (`auth`) bound to exact noteUid
    let sawStalePathCookie = false
    const secret = getRuntimeSecret(env) || ''
    if (cookies.auth && secret) {
        try {
            const authPayload = await verifyJwtPayload(cookies.auth, secret)
            if (authPayload?.path === notePath && (authPayload.role || 'edit') === 'edit') {
                if ((authPayload.noteUid || '') === metadata.noteUid) {
                    return { matched: true, sawStalePathCookie: false }
                }
                sawStalePathCookie = true
            }
        } catch {}
    }

    // 3. Author cookie (`cn_author_*`) bound to exact noteUid
    const authorSecret = secret || adminPassword || ''
    if (authorSecret) {
        const authorCookieKey = 'cn_author_' + (await MD5(notePath)).substring(0, 16)
        if (cookies[authorCookieKey]) {
            try {
                const payload = await verifyJwtPayload(cookies[authorCookieKey], authorSecret)
                if (payload?.path === notePath) {
                    if ((payload.noteUid || '') === metadata.noteUid) {
                        return { matched: true, sawStalePathCookie: false }
                    }
                    sawStalePathCookie = true
                }
            } catch {}
        }
    }

    return { matched: false, sawStalePathCookie }
}

/**
 * Verify whether the request carries valid current-generation edit proof for `notePath`.
 */
export async function verifyNoteEditProof(request, notePath, metadata = {}, providedNoteUid = '', env = globalThis) {
    if (!notePath || !metadata || !metadata.noteUid) return false
    if (providedNoteUid && providedNoteUid !== metadata.noteUid) return false

    const cookieProof = await checkCookieNoteEditProof(request, notePath, metadata, env)
    if (cookieProof.matched) return true

    // 4. Unpassworded note whose current noteUid is explicitly verified by caller (no stale cookie for path)
    if (!metadata.pw && !metadata.vpw && !cookieProof.sawStalePathCookie && providedNoteUid && providedNoteUid === metadata.noteUid) {
        return true
    }

    return false
}

/**
 * Verify whether the request has view clearance for a protected share link.
 */
export async function verifyShareViewClearance(request, shareId, notePath, metadata = {}) {
    if (!shareId || !metadata?.noteUid) return false
    const rawCookie = request?.headers?.get?.('Cookie') || ''
    const cookies = Cookies.parse(rawCookie)
    const authRes = await checkAuth(cookies, notePath, { shareId, noteUid: metadata.noteUid })
    return Boolean(authRes.valid && (authRes.role === 'view' || authRes.role === 'edit'))
}

/**
 * Idempotent Personal Space index upsert with low-overhead no-op skip and 2,000 atomic quota.
 * Never mutates pending_import_commit_id or pending_import_facets.
 */
export async function upsertSpaceActivity({
    env = globalThis,
    accountId,
    notePath,
    noteUid,
    editorFormat = 'markdown',
    titleSummary = '',
    accessLevel = 'edit',
    facet = 'edited',
    nowUnix,
} = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')
    if (!notePath || typeof notePath !== 'string') {
        throw new AccountServiceError(400, 'INVALID_NOTE_PATH', 'Note path is required')
    }
    if (!noteUid || typeof noteUid !== 'string') {
        throw new AccountServiceError(400, 'NOTE_UID_REQUIRED', 'Immutable note_uid is required for Personal Space indexing')
    }
    if (accessLevel !== 'edit' && accessLevel !== 'share_only') {
        throw new AccountServiceError(400, 'INVALID_ACCESS_LEVEL', 'Invalid accessLevel')
    }
    if (!VALID_SPACE_FACETS.has(facet)) {
        throw new AccountServiceError(400, 'INVALID_FACET', 'Invalid space activity facet')
    }

    const cleanFormat = normalizeEditorFormat(editorFormat)
    const cleanTitle = String(titleSummary || '').slice(0, 70).trim()
    const now = nowSec(nowUnix)

    const existing = await accountDb.prepare(`
        SELECT id, item_key, access_level, facets, user_facets, verified_import_facets,
               editor_format, title_summary, status
        FROM account_space_items
        WHERE account_id = ? AND note_path = ? AND note_uid = ?
        LIMIT 1
    `).bind(accountId, notePath, noteUid).first()

    if (existing) {
        const existingUserFacets = parseJsonArraySafe(existing.user_facets)
        const existingVerifiedImportFacets = parseJsonArraySafe(existing.verified_import_facets)
        const existingFacets = parseJsonArraySafe(existing.facets)

        const exactAccessMatch = existing.access_level === accessLevel
            || (existing.access_level === 'edit' && accessLevel === 'share_only')
        const facetAlreadyRecorded = existingUserFacets.includes(facet) && existingFacets.includes(facet)

        if (existing.status === 'active' && exactAccessMatch && facetAlreadyRecorded) {
            return {
                skipped: true,
                id: existing.id,
                itemKey: existing.item_key,
                accessLevel: existing.access_level,
                facets: existingFacets,
                editorFormat: existing.editor_format,
                titleSummary: existing.title_summary,
                notePath,
                noteUid,
                lastActivityAt: now,
            }
        }

        const nextAccessLevel = (existing.access_level === 'edit' || accessLevel === 'edit') ? 'edit' : 'share_only'
        const nextUserFacets = unionStringArrays(existingUserFacets, [facet])
        const nextUserFacetsJson = JSON.stringify(nextUserFacets)

        // Update user_facets and compute union(user_facets, verified_import_facets) in SQL
        // without touching pending_import_commit_id, pending_import_facets, or verified_import_facets.
        await accountDb.prepare(`
            UPDATE account_space_items
            SET access_level = CASE WHEN access_level = 'edit' OR ? = 'edit' THEN 'edit' ELSE 'share_only' END,
                user_facets = COALESCE((SELECT json_group_array(val) FROM (
                    SELECT value AS val FROM json_each(COALESCE(user_facets, '[]'))
                    UNION SELECT ? AS val
                )), '[]'),
                facets = COALESCE((
                    SELECT json_group_array(val)
                    FROM (
                        SELECT value AS val FROM json_each(COALESCE(user_facets, '[]'))
                        UNION SELECT ? AS val
                        UNION
                        SELECT value AS val FROM json_each(COALESCE(verified_import_facets, '[]'))
                    )
                ), '[]'),
                editor_format = ?,
                title_summary = CASE WHEN ? != '' THEN ? ELSE title_summary END,
                status = 'active',
                last_activity_at = ?,
                updated_at = ?
            WHERE id = ? AND account_id = ?
        `).bind(
            accessLevel,
            facet,
            facet,
            cleanFormat,
            cleanTitle,
            cleanTitle,
            now,
            now,
            existing.id,
            accountId,
        ).run()

        const nextFacets = unionStringArrays(nextUserFacets, existingVerifiedImportFacets)
        return {
            skipped: false,
            id: existing.id,
            itemKey: existing.item_key,
            accessLevel: nextAccessLevel,
            facets: nextFacets,
            editorFormat: cleanFormat,
            titleSummary: cleanTitle || existing.title_summary,
            notePath,
            noteUid,
            lastActivityAt: now,
        }
    }

    const id = generateNonce()
    const itemKey = generateNonce()
    const facetsJson = JSON.stringify([facet])

    let insertRes
    try {
        insertRes = await accountDb.prepare(`
        INSERT INTO account_space_items (
            id, item_key, account_id, note_path, note_uid, access_level,
            facets, user_facets, verified_import_facets, editor_format, title_summary,
            status, last_activity_at, created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'active', ?, ?, ?
        WHERE (
            SELECT COUNT(*) FROM account_space_items
            WHERE account_id = ? AND status IN ('active', 'pending_import')
        ) < ?
    `).bind(
        id,
        itemKey,
        accountId,
        notePath,
        noteUid,
        accessLevel,
        facetsJson,
        facetsJson,
        cleanFormat,
        cleanTitle,
        now,
        now,
        now,
        accountId,
        MAX_SPACE_ITEMS_PER_ACCOUNT,
        ).run()
    } catch (error) {
        if (!isUniqueConstraintError(error)) throw error
        const concurrent = await accountDb.prepare('SELECT id FROM account_space_items WHERE account_id = ? AND note_path = ? AND note_uid = ?')
            .bind(accountId, notePath, noteUid).first()
        if (!concurrent) throw error
        return upsertSpaceActivity({ env, accountId, notePath, noteUid, editorFormat, titleSummary, accessLevel, facet, nowUnix })
    }

    if (Number(insertRes?.meta?.changes ?? 0) !== 1) {
        const concurrent = await accountDb.prepare('SELECT id FROM account_space_items WHERE account_id = ? AND note_path = ? AND note_uid = ?')
            .bind(accountId, notePath, noteUid).first()
        if (concurrent) return upsertSpaceActivity({ env, accountId, notePath, noteUid, editorFormat, titleSummary, accessLevel, facet, nowUnix })
        throw new AccountServiceError(409, 'QUOTA_EXCEEDED', `Personal Space item quota (${MAX_SPACE_ITEMS_PER_ACCOUNT}) exceeded`)
    }

    return {
        skipped: false,
        id,
        itemKey,
        accessLevel,
        facets: [facet],
        editorFormat: cleanFormat,
        titleSummary: cleanTitle,
        notePath,
        noteUid,
        lastActivityAt: now,
    }
}

/**
 * Private-first manual bookmarking onto /_space.
 */
export async function bookmarkNoteToSpace({
    env = globalThis,
    accountId,
    shareId = '',
    notePath = '',
    noteUid = '',
    editorFormat = 'markdown',
    titleSummary = '',
    authContext = {},
    request = null,
    nowUnix,
} = {}) {
    const { notesDb } = await assertAccountFeatureReady(env, { write: true })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')
    const now = nowSec(nowUnix)

    const cleanShareId = String(shareId || '').trim()
    const cleanNotePath = String(notePath || '').trim()
    const cleanNoteUid = String(noteUid || '').trim()

    if (cleanShareId) {
        const resolved = await resolveAuthoritativeShareMetadata(cleanShareId, { env, nowUnix: now })
        if (!resolved || resolved.status !== 'active' || !resolved.path || !resolved.noteUid) {
            throw new AccountServiceError(404, 'NOTE_UNAVAILABLE', 'Note is unavailable or cannot be indexed without a verifiable noteUid')
        }

        const meta = resolved.metadata || {}
        const isProtected = Boolean(
            meta.vpw
            || isBurnProtected(meta)
            || isShareBurned(meta)
            || isShareExpired(meta, now)
            || isShareTimeLocked(meta, now)
            || isShareDeadmanLocked(meta, now)
        )

        let hasEditProof = Boolean(authContext?.hasEditProof)
        let hasViewClearance = Boolean(authContext?.hasViewClearance)
        if (request && !hasEditProof) {
            hasEditProof = await verifyNoteEditProof(request, resolved.path, meta, cleanNoteUid, env)
        }
        if (request && !hasViewClearance) {
            hasViewClearance = await verifyShareViewClearance(request, cleanShareId, resolved.path, meta)
        }

        if (isProtected && !hasEditProof && !hasViewClearance) {
            throw new AccountServiceError(404, 'NOTE_UNAVAILABLE', 'Protected or unavailable notes cannot be bookmarked without clearance')
        }

        // Only grant 'edit' if caller explicitly provided the un-derived edit path AND holds edit proof
        const explicitEditAccess = Boolean(cleanNotePath && cleanNotePath === resolved.path && hasEditProof)
        const resolvedTitle = await resolveAuthoritativeTitleSummary(notesDb, resolved.path, meta, titleSummary)
        const resolvedFormat = resolveEditorFormat(meta) || normalizeEditorFormat(editorFormat)

        const upserted = await upsertSpaceActivity({
            env,
            accountId,
            notePath: resolved.path,
            noteUid: resolved.noteUid,
            editorFormat: resolvedFormat,
            titleSummary: resolvedTitle,
            accessLevel: explicitEditAccess ? 'edit' : 'share_only',
            facet: 'bookmarked',
            nowUnix: now,
        })

        const circleEligible = Boolean(
            resolved.isCsprngV1
            && meta.share === true
            && !meta.vpw
            && !isBurnProtected(meta)
            && !isShareBurned(meta)
            && !isShareExpired(meta, now)
            && !isShareTimeLocked(meta, now)
            && !isShareDeadmanLocked(meta, now)
        )

        const item = upserted.accessLevel === 'edit'
            ? {
                id: upserted.id,
                itemKey: upserted.itemKey,
                accessLevel: 'edit',
                notePath: upserted.notePath,
                noteUid: upserted.noteUid,
                editorFormat: upserted.editorFormat,
                titleSummary: upserted.titleSummary,
                facets: upserted.facets,
                shareId: resolved.shareId,
                lastActivityAt: upserted.lastActivityAt,
            }
            : {
                itemKey: upserted.itemKey,
                accessLevel: 'share_only',
                editorFormat: upserted.editorFormat,
                titleSummary: upserted.titleSummary,
                facets: upserted.facets,
                shareId: resolved.shareId,
                lastActivityAt: upserted.lastActivityAt,
            }

        return { item, circleEligible }
    }

    if (!cleanNotePath) {
        throw new AccountServiceError(400, 'SHARE_OR_PATH_REQUIRED', 'shareId or notePath is required')
    }

    const row = await notesDb.prepare('SELECT metadata FROM notes WHERE path = ? LIMIT 1').bind(cleanNotePath).first()
    if (!row) {
        throw new AccountServiceError(404, 'NOTE_NOT_FOUND', 'Note not found')
    }
    const meta = parseMetaSafe(row.metadata)
    if (!meta.noteUid) {
        throw new AccountServiceError(409, 'NOTE_UID_REQUIRED', 'Note lacks an authoritative noteUid')
    }
    if (cleanNoteUid && cleanNoteUid !== meta.noteUid) {
        throw new AccountServiceError(409, 'NOTE_UID_MISMATCH', 'Note UID does not match current note generation')
    }

    let hasEditProof = Boolean(authContext?.hasEditProof)
    if (!hasEditProof && request) {
        hasEditProof = await verifyNoteEditProof(request, cleanNotePath, meta, cleanNoteUid, env)
    }
    if (!hasEditProof) {
        throw new AccountServiceError(403, 'EDIT_PROOF_REQUIRED', 'Current-generation edit proof is required to bookmark an edit path')
    }

    const resolvedTitle = await resolveAuthoritativeTitleSummary(notesDb, cleanNotePath, meta, titleSummary)
    const resolvedFormat = resolveEditorFormat(meta) || normalizeEditorFormat(editorFormat)

    const upserted = await upsertSpaceActivity({
        env,
        accountId,
        notePath: cleanNotePath,
        noteUid: meta.noteUid,
        editorFormat: resolvedFormat,
        titleSummary: resolvedTitle,
        accessLevel: 'edit',
        facet: 'bookmarked',
        nowUnix: now,
    })

    const regRow = await notesDb.prepare(`
        SELECT share_id, is_csprng_v1
        FROM share_token_registry
        WHERE target_path = ? AND note_uid = ? AND revoked_at IS NULL
        ORDER BY is_csprng_v1 DESC, created_at DESC
        LIMIT 1
    `).bind(cleanNotePath, meta.noteUid).first()

    const activeShareId = meta.share === true && regRow?.share_id ? regRow.share_id : ''
    const circleEligible = Boolean(
        activeShareId
        && regRow?.is_csprng_v1 === 1
        && !meta.vpw
        && !isBurnProtected(meta)
        && !isShareBurned(meta)
        && !isShareExpired(meta, now)
        && !isShareTimeLocked(meta, now)
        && !isShareDeadmanLocked(meta, now)
    )

    return {
        item: {
            id: upserted.id,
            itemKey: upserted.itemKey,
            accessLevel: 'edit',
            notePath: cleanNotePath,
            noteUid: meta.noteUid,
            editorFormat: upserted.editorFormat,
            titleSummary: upserted.titleSummary,
            facets: upserted.facets,
            shareId: activeShareId,
            lastActivityAt: upserted.lastActivityAt,
        },
        circleEligible,
    }
}

function makeMaskedSpacePlaceholder(itemKey) {
    return {
        masked: true,
        itemKey: String(itemKey || ''),
        accessLevel: 'share_only',
        title: 'Unavailable or Protected Note',
        editorFormat: null,
        protectionBadge: null,
        actions: ['remove'],
    }
}

async function computeSyntheticAnnKey(notePath, noteUid) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(`${notePath}\n${noteUid}`)))
    return `ann_${bytesToBase64Url(digest).slice(0, 22)}`
}

/**
 * List paginated Personal Space items (<= 50/page) with annotation link merges,
 * zero content SQL reads, and uniform anti-oracle masking for share_only items.
 */
export async function listSpaceItems({
    env = globalThis,
    accountId,
    facet = 'all',
    format = 'all',
    page = 1,
    pageSize = 50,
    cursor = null,
    limit = undefined,
    nowUnix,
} = {}) {
    const { accountDb, notesDb } = await assertAccountFeatureReady(env, { write: false })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')
    const now = nowSec(nowUnix)

    const effectiveLimit = Math.min(50, Math.max(1, Number(limit ?? pageSize) || 50))
    const cleanFacet = VALID_SPACE_FACETS.has(facet) ? facet : 'all'
    const cleanFormat = VALID_EDITOR_FORMATS.has(format) ? format : 'all'

    const spaceRes = await accountDb.prepare(`
        SELECT id, item_key, note_path, note_uid, access_level, facets,
               editor_format, title_summary, last_activity_at, created_at, updated_at
        FROM account_space_items
        WHERE account_id = ?
          AND status = 'active'
        ORDER BY last_activity_at DESC, id DESC
    `).bind(accountId).all()

    let annRows = []
    try {
        const annRes = await accountDb.prepare(`
            SELECT l.note_path, l.note_uid, COUNT(*) AS ann_count, MAX(l.created_at) AS last_ann_at
            FROM account_annotation_links l
            JOIN annotation_messages m ON m.id = l.message_id
            WHERE l.account_id = ?
              AND m.deleted_at IS NULL
            GROUP BY l.note_path, l.note_uid
        `).bind(accountId).all()
        annRows = annRes?.results || []
    } catch {
        annRows = []
    }

    const annMap = new Map()
    for (const a of annRows) {
        if (a?.note_path && a?.note_uid) {
            annMap.set(`${a.note_path}\n${a.note_uid}`, {
                count: Number(a.ann_count || 0),
                lastAnnAt: Number(a.last_ann_at || 0),
            })
        }
    }

    const merged = []
    const seenPairs = new Set()

    for (const row of (spaceRes?.results || [])) {
        const pairKey = `${row.note_path}\n${row.note_uid}`
        seenPairs.add(pairKey)
        const annInfo = annMap.get(pairKey)
        const rowFacets = parseJsonArraySafe(row.facets)
        const facets = annInfo ? unionStringArrays(rowFacets, ['annotated']) : rowFacets
        const lastActivityAt = Math.max(Number(row.last_activity_at || 0), annInfo?.lastAnnAt || 0)

        merged.push({
            id: row.id,
            itemKey: row.item_key,
            notePath: row.note_path,
            noteUid: row.note_uid,
            accessLevel: row.access_level,
            facets,
            annotationCount: annInfo?.count || 0,
            editorFormat: row.editor_format || 'markdown',
            titleSummary: row.title_summary || '',
            lastActivityAt,
            syntheticAnnotationOnly: false,
        })
    }

    // Merge unindexed annotated notes when viewing 'all' or 'annotated'
    if (cleanFacet === 'all' || cleanFacet === 'annotated') {
        for (const a of annRows) {
            if (!a?.note_path || !a?.note_uid) continue
            const pairKey = `${a.note_path}\n${a.note_uid}`
            if (seenPairs.has(pairKey)) continue
            merged.push({
                id: null,
                itemKey: await computeSyntheticAnnKey(a.note_path, a.note_uid),
                notePath: a.note_path,
                noteUid: a.note_uid,
                accessLevel: 'share_only',
                facets: ['annotated'],
                annotationCount: Number(a.ann_count || 0),
                editorFormat: 'markdown',
                titleSummary: '',
                lastActivityAt: Number(a.last_ann_at || 0),
                syntheticAnnotationOnly: true,
            })
        }
    }

    // For synthetic annotation-only items when format filter is active, resolve their format via metadata-only lookup
    let syntheticFormatMap = null
    if (cleanFormat !== 'all' && merged.some(m => m.syntheticAnnotationOnly)) {
        const synPaths = merged.filter(m => m.syntheticAnnotationOnly).map(m => m.notePath)
        syntheticFormatMap = await batchLoadNotesMetadataMap(notesDb, synPaths, now)
    }

    const filtered = merged.filter(item => {
        if (cleanFacet !== 'all' && !item.facets.includes(cleanFacet)) return false
        if (cleanFormat !== 'all') {
            let fmt = item.editorFormat
            if (item.syntheticAnnotationOnly && syntheticFormatMap) {
                const live = syntheticFormatMap.get(item.notePath)
                fmt = live?.exists ? resolveEditorFormat(live.metadata) : 'markdown'
            }
            if (fmt !== cleanFormat) return false
        }
        return true
    })

    filtered.sort((a, b) => (b.lastActivityAt - a.lastActivityAt) || String(b.itemKey).localeCompare(String(a.itemKey)))

    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / effectiveLimit))
    let startOffset = 0
    let currentPage = Math.max(1, Number(page) || 1)
    if (cursor && typeof cursor === 'string') {
        const parsedOffset = Number(cursor)
        if (Number.isInteger(parsedOffset) && parsedOffset >= 0) {
            startOffset = parsedOffset
            currentPage = Math.floor(startOffset / effectiveLimit) + 1
        }
    } else {
        currentPage = Math.min(currentPage, totalPages)
        startOffset = (currentPage - 1) * effectiveLimit
    }

    const pageRows = filtered.slice(startOffset, startOffset + effectiveLimit)
    const liveMap = await batchLoadNotesMetadataMap(notesDb, pageRows.map(r => r.notePath), now)

    const items = pageRows.map(item => {
        const live = liveMap.get(item.notePath)
        if (item.accessLevel === 'edit') {
            const validGeneration = Boolean(
                live?.exists
                && live.metadata?.noteUid === item.noteUid
                && !live.tombstones.has(item.noteUid)
            )
            if (!validGeneration) {
                return {
                    masked: false,
                    itemKey: item.itemKey,
                    accessLevel: 'edit',
                    notePath: null,
                    editUrl: null,
                    status: 'unavailable',
                    stale: true,
                    actions: ['remove'],
                    noteUid: item.noteUid,
                    editorFormat: item.editorFormat,
                    titleSummary: item.titleSummary || 'Unavailable or Deleted Note',
                    facets: item.facets,
                    annotationCount: item.annotationCount,
                    lastActivityAt: item.lastActivityAt,
                    shareId: '',
                    protectionBadge: 'deleted',
                    isBurnProtected: false,
                    id: item.id,
                }
            }
            const meta = live.metadata || {}
            const activeReg = meta.share === true
                ? live.activeTokens.find(t => t.note_uid === item.noteUid)
                : null
            return {
                masked: false,
                itemKey: item.itemKey,
                accessLevel: 'edit',
                notePath: item.notePath,
                noteUid: item.noteUid,
                editorFormat: resolveEditorFormat(meta) || item.editorFormat,
                titleSummary: meta.titleSummary || item.titleSummary || 'Untitled Note',
                facets: item.facets,
                annotationCount: item.annotationCount,
                lastActivityAt: item.lastActivityAt,
                shareId: activeReg?.share_id || '',
                protectionBadge: getEditProtectionBadge(meta, now),
                isBurnProtected: isBurnProtected(meta),
                id: item.id,
            }
        }

        // Strict anti-oracle uniform masking for share_only items
        const vis = isLiveSharePubliclyReadable(live, item.noteUid, now)
        if (!vis.ok) {
            return makeMaskedSpacePlaceholder(item.itemKey)
        }
        const meta = live.metadata || {}
        return {
            masked: false,
            itemKey: item.itemKey,
            accessLevel: 'share_only',
            editorFormat: resolveEditorFormat(meta) || item.editorFormat,
            titleSummary: meta.titleSummary || item.titleSummary || 'Untitled Share',
            facets: item.facets,
            annotationCount: item.annotationCount,
            lastActivityAt: item.lastActivityAt,
            shareId: vis.activeToken.share_id,
            protectionBadge: null,
            isBurnProtected: false,
        }
    })

    const nextOffset = startOffset + pageRows.length
    return {
        items,
        pagination: {
            page: currentPage,
            pageSize: effectiveLimit,
            total,
            totalPages,
        },
        nextCursor: nextOffset < total ? String(nextOffset) : null,
    }
}

export async function deleteSpaceItem({ env = globalThis, accountId, itemKey } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')
    const cleanKey = String(itemKey || '').trim()
    if (!cleanKey) throw new AccountServiceError(400, 'INVALID_ITEM_KEY', 'itemKey is required')

    const results = await accountDb.batch([
        accountDb.prepare(`
            DELETE FROM share_circle_items
            WHERE space_item_id IN (
                SELECT id FROM account_space_items WHERE account_id = ? AND item_key = ?
            )
        `).bind(accountId, cleanKey),
        accountDb.prepare(`
            DELETE FROM account_space_items
            WHERE account_id = ? AND item_key = ?
        `).bind(accountId, cleanKey),
    ])

    if (Number(results?.[1]?.meta?.changes ?? 0) === 0) {
        if (cleanKey.startsWith('ann_')) {
            const pairs = await accountDb.prepare(`
                SELECT DISTINCT l.note_path, l.note_uid
                FROM account_annotation_links l
                JOIN annotation_messages m ON m.id = l.message_id
                WHERE l.account_id = ? AND m.deleted_at IS NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM account_space_items s
                      WHERE s.account_id = l.account_id AND s.note_path = l.note_path
                        AND s.note_uid = l.note_uid AND s.status = 'active'
                  )
            `).bind(accountId).all()
            for (const pair of (pairs?.results || [])) {
                if (await computeSyntheticAnnKey(pair.note_path, pair.note_uid) !== cleanKey) continue
                const deleted = await accountDb.prepare(`
                    DELETE FROM account_annotation_links
                    WHERE account_id = ? AND note_path = ? AND note_uid = ?
                      AND NOT EXISTS (
                          SELECT 1 FROM account_space_items s
                          WHERE s.account_id = ? AND s.note_path = ?
                            AND s.note_uid = ? AND s.status = 'active'
                      )
                `).bind(accountId, pair.note_path, pair.note_uid, accountId, pair.note_path, pair.note_uid).run()
                if (Number(deleted?.meta?.changes ?? 0) > 0) return { deleted: true, itemKey: cleanKey }
                break
            }
        }
        throw new AccountServiceError(404, 'SPACE_ITEM_NOT_FOUND', 'Space item not found')
    }
    return { deleted: true, itemKey: cleanKey }
}

/**
 * Normalize a guest history candidate entry against the current request origin.
 * Rejects cross-origin URLs, embedded credentials, query credential parameters, /c/ circle URLs, and non-share paths.
 */
async function resolveAuthoritativeTitleSummary(notesDb, notePath, meta = {}, fallbackTitle = '') {
    const fromMeta = String(meta?.titleSummary || computeTitleSummary('', meta) || '').slice(0, 70).trim()
    if (fromMeta) return fromMeta
    if (notesDb && notePath && typeof notesDb.prepare === 'function') {
        try {
            const row = await notesDb.prepare('SELECT content FROM notes WHERE path = ? LIMIT 1').bind(notePath).first()
            const fromContent = String(computeTitleSummary(row?.content || '', meta) || '').slice(0, 70).trim()
            if (fromContent) return fromContent
        } catch {}
    }
    return String(fallbackTitle || '')
        .replace(UNSAFE_TEXT_CHARS_RE, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 70)
}

function normalizeSingleSegmentNotePath(rawPath, env = globalThis) {
    const trimmed = String(rawPath || '').trim()
    if (!trimmed || trimmed.length > 128) return null
    if (trimmed.startsWith('local/') || trimmed.includes('/') || trimmed.includes('..') || trimmed.includes('?') || trimmed.includes('#')) {
        return null
    }
    if (isReservedSlug(trimmed, env)) return null
    return trimmed
}

/**
 * Normalize a guest history or local/manual note candidate entry against the current request origin.
 * Rejects cross-origin URLs, embedded credentials, query credential parameters, /c/ circle URLs, and invalid paths.
 */
function normalizeGuestHistoryEntry(rawEntry, requestOrigin, env = globalThis) {
    if (!rawEntry || typeof rawEntry !== 'object') return null

    let shareId = ''
    let notePath = ''
    let normalizedUrl = ''

    if (typeof rawEntry.url === 'string' && rawEntry.url.trim()) {
        const rawUrl = rawEntry.url.trim()
        // Reject scheme-relative or cross-origin absolute URLs
        if (rawUrl.startsWith('//')) return null
        let parsed
        try {
            parsed = new URL(rawUrl, requestOrigin)
        } catch {
            return null
        }
        if (parsed.origin !== requestOrigin) return null
        if (parsed.username || parsed.password) return null
        if (parsed.search && /[?&](pw|vpw|token|auth|password|secret)=/i.test(parsed.search)) {
            return null
        }
        const shareMatch = parsed.pathname.match(/^\/share\/([^/]+?)(?:\/(present|book))?\/?$/i)
        if (shareMatch) {
            try {
                shareId = decodeURIComponent(shareMatch[1])
            } catch {
                return null
            }
            if (!shareId || shareId.includes('/') || shareId.includes('..')) return null
            normalizedUrl = `${requestOrigin}/share/${encodeURIComponent(shareId)}`
        } else {
            const pathMatch = parsed.pathname.match(/^\/([^/]+)\/?$/)
            if (!pathMatch) return null
            let decodedSeg = ''
            try {
                decodedSeg = decodeURIComponent(pathMatch[1])
            } catch {
                return null
            }
            notePath = normalizeSingleSegmentNotePath(decodedSeg, env) || ''
            if (!notePath) return null
            normalizedUrl = `${requestOrigin}/${encodeURIComponent(notePath)}`
        }
    } else if (typeof rawEntry.shareId === 'string' && rawEntry.shareId.trim()) {
        shareId = rawEntry.shareId.trim()
        if (shareId.includes('/') || shareId.includes('..') || shareId.includes('?') || shareId.includes('#')) {
            return null
        }
        normalizedUrl = `${requestOrigin}/share/${encodeURIComponent(shareId)}`
    } else if (typeof rawEntry.path === 'string' && rawEntry.path.trim()) {
        notePath = normalizeSingleSegmentNotePath(rawEntry.path, env) || ''
        if (!notePath) return null
        normalizedUrl = `${requestOrigin}/${encodeURIComponent(notePath)}`
    } else {
        return null
    }

    if (shareId) {
        if (!isCanonicalShareToken(shareId)) {
            return null
        }
        const rawSource = rawEntry.source === 'created' || rawEntry.facet === 'created' ? 'created' : 'viewed'
        const facet = VALID_SPACE_FACETS.has(rawEntry.facet)
            ? rawEntry.facet
            : (rawSource === 'created' ? 'created' : 'bookmarked')

        const rawFallbackTitle = typeof rawEntry.titleSummary === 'string' && rawEntry.titleSummary.trim()
            ? rawEntry.titleSummary
            : (typeof rawEntry.title === 'string' ? rawEntry.title : '')
        return {
            kind: 'share',
            shareId,
            notePath: '',
            url: normalizedUrl,
            source: rawSource,
            facet,
            explicitPath: typeof rawEntry.path === 'string' ? rawEntry.path.trim() : '',
            fallbackTitle: rawFallbackTitle,
            timestamp: Number(rawEntry.timestamp || rawEntry.savedAt || 0) || 0,
        }
    }

    const rawFallbackTitle = typeof rawEntry.titleSummary === 'string' && rawEntry.titleSummary.trim()
        ? rawEntry.titleSummary
        : (typeof rawEntry.title === 'string' ? rawEntry.title : '')
    return {
        kind: 'note_path',
        shareId: '',
        notePath,
        url: normalizedUrl,
        source: 'created',
        facet: 'created',
        explicitPath: notePath,
        fallbackTitle: rawFallbackTitle,
        timestamp: Number(rawEntry.timestamp || rawEntry.savedAt || 0) || 0,
    }
}

function isResolvedShareImportable(resolved, now = nowSec()) {
    if (!resolved || resolved.status !== 'active') return false
    if (!resolved.path || !resolved.noteUid) return false
    const meta = resolved.metadata || {}
    if (meta.share !== true) return false
    if (meta.vpw) return false
    if (isBurnProtected(meta) || isShareBurned(meta)) return false
    if (isShareExpired(meta, now) || isShareTimeLocked(meta, now) || isShareDeadmanLocked(meta, now)) return false
    return true
}

function buildMaskedPreviewCandidate(rawEntry = {}, override = {}) {
    return {
        shareId: override.shareId ?? (typeof rawEntry?.shareId === 'string' ? rawEntry.shareId : ''),
        ...(override.path ? { path: override.path } : {}),
        url: override.url ?? (typeof rawEntry?.url === 'string' ? rawEntry.url : ''),
        source: override.source ?? (rawEntry?.source === 'created' ? 'created' : 'viewed'),
        title: 'Unavailable or Protected Note',
        titleSummary: 'Unavailable or Protected Note',
        editorFormat: null,
        eligible: false,
        alreadyIndexed: false,
        status: 'unavailable',
    }
}

/**
 * Preview guest share-history & local/manual note candidates without leaking existence or lock reasons of protected/unshared notes.
 */
export async function previewGuestHistoryImport(request, env = globalThis, accountId, body = {}, { nowUnix } = {}) {
    const { accountDb, notesDb } = await assertAccountFeatureReady(env, { write: false })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')

    const rawItems = Array.isArray(body?.items) ? body.items : null
    if (!rawItems) {
        throw new AccountServiceError(400, 'INVALID_IMPORT_ITEMS', 'items array is required')
    }
    if (rawItems.length > MAX_IMPORT_CANDIDATES) {
        throw new AccountServiceError(400, 'TOO_MANY_IMPORT_ITEMS', `At most ${MAX_IMPORT_CANDIDATES} import candidates allowed per request`)
    }

    const requestOrigin = new URL(request.url).origin
    const now = nowSec(nowUnix)
    const seenShareIds = new Set()
    const seenNotePaths = new Set()
    const normalizedEntries = []

    for (const rawEntry of rawItems) {
        const normalized = normalizeGuestHistoryEntry(rawEntry, requestOrigin, env)
        if (!normalized) {
            normalizedEntries.push({ rawEntry, normalized: null })
            continue
        }
        if (normalized.kind === 'share') {
            if (seenShareIds.has(normalized.shareId)) continue
            seenShareIds.add(normalized.shareId)
        } else {
            if (seenNotePaths.has(normalized.notePath)) continue
            seenNotePaths.add(normalized.notePath)
        }
        normalizedEntries.push({ rawEntry, normalized })
    }

    const notePathCandidates = normalizedEntries
        .filter(e => e.normalized?.kind === 'note_path')
        .map(e => e.normalized.notePath)
    const notePathMetaMap = notePathCandidates.length > 0
        ? await batchLoadNotesMetadataMap(notesDb, notePathCandidates, now)
        : new Map()

    const results = []

    for (const { rawEntry, normalized } of normalizedEntries) {
        if (!normalized) {
            results.push(buildMaskedPreviewCandidate(rawEntry))
            continue
        }

        if (normalized.kind === 'note_path') {
            const live = notePathMetaMap.get(normalized.notePath)
            const meta = live?.metadata || {}
            const noteUid = meta.noteUid || ''
            if (!live?.exists || !noteUid || live.tombstones.has(noteUid)) {
                results.push(buildMaskedPreviewCandidate(rawEntry, {
                    shareId: '',
                    path: normalized.notePath,
                    url: normalized.url,
                    source: 'created',
                }))
                continue
            }

            const cookieProof = await checkCookieNoteEditProof(request, normalized.notePath, meta, env)
            if (meta.share !== true) {
                if (cookieProof.matched) {
                    const titleSummary = meta.titleSummary || computeTitleSummary('', meta) || normalized.notePath
                    results.push({
                        shareId: '',
                        path: normalized.notePath,
                        url: normalized.url,
                        source: 'created',
                        title: titleSummary,
                        titleSummary,
                        editorFormat: resolveEditorFormat(meta),
                        eligible: false,
                        alreadyIndexed: false,
                        status: 'unpublished',
                    })
                } else {
                    results.push(buildMaskedPreviewCandidate(rawEntry, {
                        shareId: '',
                        path: normalized.notePath,
                        url: normalized.url,
                        source: 'created',
                    }))
                }
                continue
            }

            const activeToken = live.activeTokens.find(t => t.note_uid === noteUid)?.share_id || ''
            const isProtectedOrSealed = Boolean(
                meta.vpw
                || isBurnProtected(meta)
                || isShareBurned(meta)
                || isShareExpired(meta, now)
                || isShareTimeLocked(meta, now)
                || isShareDeadmanLocked(meta, now)
            )
            const canClaimEdit = cookieProof.matched || (!meta.pw && !isProtectedOrSealed && !cookieProof.sawStalePathCookie)
            const canBookmarkShareOnly = !canClaimEdit && !meta.vpw && !isProtectedOrSealed && Boolean(activeToken)

            if (!canClaimEdit && !canBookmarkShareOnly) {
                results.push(buildMaskedPreviewCandidate(rawEntry, {
                    shareId: '',
                    path: normalized.notePath,
                    url: normalized.url,
                    source: 'created',
                }))
                continue
            }

            const existingRow = await accountDb.prepare(`
                SELECT status, access_level
                FROM account_space_items
                WHERE account_id = ? AND note_path = ? AND note_uid = ?
                LIMIT 1
            `).bind(accountId, normalized.notePath, noteUid).first()

            const accessLevel = canClaimEdit ? 'edit' : 'share_only'
            const alreadyIndexed = Boolean(
                existingRow
                && existingRow.status === 'active'
                && (existingRow.access_level === 'edit' || accessLevel === 'share_only')
            )
            const titleSummary = (await resolveAuthoritativeTitleSummary(notesDb, normalized.notePath, meta, normalized.fallbackTitle)) || normalized.notePath
            const editorFormat = resolveEditorFormat(meta)

            results.push({
                shareId: activeToken,
                path: normalized.notePath,
                url: normalized.url,
                source: 'created',
                accessLevel,
                title: titleSummary,
                titleSummary,
                editorFormat,
                eligible: true,
                alreadyIndexed,
                status: alreadyIndexed ? 'already_indexed' : 'eligible',
            })
            continue
        }

        const resolved = await resolveAuthoritativeShareMetadata(normalized.shareId, { env, nowUnix: now })
        if (!isResolvedShareImportable(resolved, now)) {
            results.push(buildMaskedPreviewCandidate(rawEntry, {
                shareId: normalized.shareId,
                url: normalized.url,
                source: normalized.source,
            }))
            continue
        }

        const meta = resolved.metadata || {}
        const hasEditProof = Boolean(
            normalized.explicitPath
            && normalized.explicitPath === resolved.path
            && await verifyNoteEditProof(request, resolved.path, meta, resolved.noteUid, env)
        )
        const accessLevel = hasEditProof ? 'edit' : 'share_only'

        const existingRow = await accountDb.prepare(`
            SELECT status, access_level
            FROM account_space_items
            WHERE account_id = ? AND note_path = ? AND note_uid = ?
            LIMIT 1
        `).bind(accountId, resolved.path, resolved.noteUid).first()

        const alreadyIndexed = Boolean(
            existingRow
            && existingRow.status === 'active'
            && (existingRow.access_level === 'edit' || accessLevel === 'share_only')
        )
        const titleSummary = (await resolveAuthoritativeTitleSummary(notesDb, resolved.path, meta, normalized.fallbackTitle)) || 'Untitled Share'
        const editorFormat = resolveEditorFormat(meta)

        results.push({
            shareId: resolved.shareId,
            ...(hasEditProof ? { path: resolved.path } : {}),
            url: normalized.url,
            source: normalized.source,
            accessLevel,
            title: titleSummary,
            titleSummary,
            editorFormat,
            eligible: true,
            alreadyIndexed,
            status: alreadyIndexed ? 'already_indexed' : 'eligible',
        })
    }

    return { items: results }
}

const LIVE_IMPORT_VISIBILITY_EXISTS_SQL = `EXISTS (
    SELECT 1
    FROM share_token_registry r
    JOIN notes n ON n.path = r.target_path
    WHERE r.share_id = ?
      AND r.target_path = ?
      AND r.note_uid = ?
      AND r.revoked_at IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM note_tombstones t
          WHERE t.path = r.target_path AND t.deleted_note_uid = r.note_uid
      )
      AND json_extract(n.metadata, '$.noteUid') = r.note_uid
      AND json_extract(n.metadata, '$.share') = 1
      AND json_extract(n.metadata, '$.vpw') IS NULL
      AND NOT (${IS_LEGACY_BURNED_SQL})
      AND COALESCE(json_extract(n.metadata, '$.shareBurnAfterReading'), 0) != 1
      AND COALESCE(json_extract(n.metadata, '$.shareMode'), '') NOT IN ('burn', 'burn_after_reading')
      AND (json_extract(n.metadata, '$.shareExpiresAt') IS NULL OR CAST(json_extract(n.metadata, '$.shareExpiresAt') AS INTEGER) > ?)
      AND (COALESCE(json_extract(n.metadata, '$.shareMode'), '') != 'timelock' OR COALESCE(CAST(json_extract(n.metadata, '$.shareUnlockAt') AS INTEGER), 0) <= ?)
      AND (COALESCE(json_extract(n.metadata, '$.shareMode'), '') != 'deadman' OR COALESCE(CAST(json_extract(n.metadata, '$.sharePulseDueAt') AS INTEGER), 0) <= ?)
)`

/**
 * Stage 4 (and Cron reconciliation) finalization against notesDb for split-DB guest imports.
 * Preserves pending_import_finalizations on notesDb failure so Cron retries safely.
 */
export async function finalizePendingImportCommit(env = globalThis, { commitId, accountId, candidates, nowUnix } = {}) {
    const accountDb = getAccountDb(env)
    const notesDb = getStorageDb(env)
    if (!accountDb || !notesDb) {
        throw new AccountServiceError(503, 'STORAGE_UNAVAILABLE', 'Database bindings unavailable for import finalization')
    }
    const now = nowSec(nowUnix)
    const list = Array.isArray(candidates) ? candidates : []

    // Final notesDb verification; abort without touching journal if notesDb errors/unreachable
    const verifiedFlags = []
    try {
        for (const c of list) {
            const resolved = await resolveAuthoritativeShareMetadata(c.shareId, { env, nowUnix: now })
            const ok = Boolean(
                isResolvedShareImportable(resolved, now)
                && resolved.path === c.notePath
                && resolved.noteUid === c.noteUid
            )
            verifiedFlags.push({ candidate: c, ok })
        }
    } catch (err) {
        throw new AccountServiceError(503, 'STORAGE_UNAVAILABLE', `notesDb unavailable during import finalization: ${err?.message || err}`)
    }

    const stmts = []
    for (const { candidate: c, ok } of verifiedFlags) {
        if (ok) {
            const importFacetJson = JSON.stringify([c.importFacet || 'bookmarked'])
            stmts.push(
                accountDb.prepare(`
                    UPDATE account_space_items
                    SET status = 'active',
                        access_level = CASE WHEN ? = 'edit' THEN 'edit' ELSE access_level END,
                        verified_import_facets = COALESCE((
                            SELECT json_group_array(val)
                            FROM (
                                SELECT value AS val FROM json_each(COALESCE(verified_import_facets, '[]'))
                                UNION
                                SELECT value AS val FROM json_each(COALESCE(pending_import_facets, ?))
                            )
                        ), ?),
                        facets = COALESCE((
                            SELECT json_group_array(val)
                            FROM (
                                SELECT value AS val FROM json_each(COALESCE(user_facets, '[]'))
                                UNION
                                SELECT value AS val FROM json_each(COALESCE(verified_import_facets, '[]'))
                                UNION
                                SELECT value AS val FROM json_each(COALESCE(pending_import_facets, ?))
                            )
                        ), '[]'),
                        pending_import_commit_id = NULL,
                        pending_import_facets = NULL,
                        import_batch_id = NULL,
                        last_activity_at = MAX(last_activity_at, ?),
                        updated_at = ?
                    WHERE account_id = ?
                      AND note_path = ?
                      AND note_uid = ?
                      AND pending_import_commit_id = ?
                `).bind(
                    c.accessLevel || 'share_only',
                    importFacetJson,
                    importFacetJson,
                    importFacetJson,
                    now,
                    now,
                    accountId,
                    c.notePath,
                    c.noteUid,
                    commitId,
                ),
            )
        } else {
            stmts.push(
                accountDb.prepare(`
                    DELETE FROM account_space_items
                    WHERE account_id = ?
                      AND note_path = ?
                      AND note_uid = ?
                      AND pending_import_commit_id = ?
                      AND user_facets IS NULL
                      AND verified_import_facets IS NULL
                `).bind(accountId, c.notePath, c.noteUid, commitId),
                accountDb.prepare(`
                    UPDATE account_space_items
                    SET status = 'active',
                        facets = COALESCE((
                            SELECT json_group_array(val)
                            FROM (
                                SELECT value AS val FROM json_each(COALESCE(user_facets, '[]'))
                                UNION
                                SELECT value AS val FROM json_each(COALESCE(verified_import_facets, '[]'))
                            )
                        ), '[]'),
                        pending_import_commit_id = NULL,
                        pending_import_facets = NULL,
                        import_batch_id = NULL,
                        updated_at = ?
                    WHERE account_id = ?
                      AND note_path = ?
                      AND note_uid = ?
                      AND pending_import_commit_id = ?
                      AND (user_facets IS NOT NULL OR verified_import_facets IS NOT NULL)
                `).bind(now, accountId, c.notePath, c.noteUid, commitId),
            )
        }
    }

    stmts.push(
        accountDb.prepare('DELETE FROM pending_import_finalizations WHERE commit_id = ?').bind(commitId),
    )

    await accountDb.batch(stmts)
    return {
        verifiedCount: verifiedFlags.filter(v => v.ok).length,
        failedCount: verifiedFlags.filter(v => !v.ok).length,
        verifiedShareIds: new Set(verifiedFlags.filter(v => v.ok).map(v => v.candidate.shareId)),
    }
}

/**
 * Reconcile abandoned split-DB pending_import_finalizations rows (for scheduled() Cron cleanup).
 */
export async function reconcilePendingImportFinalizations(env = globalThis, { maxBatches = 20, nowUnix } = {}) {
    const accountDb = getAccountDb(env)
    if (!accountDb || typeof accountDb.prepare !== 'function') {
        return { processed: 0, reconciled: 0, deferred: 0 }
    }
    const now = nowSec(nowUnix)
    const rows = await accountDb.prepare(`
        SELECT commit_id, account_id, candidates_json
        FROM pending_import_finalizations
        ORDER BY created_at ASC
        LIMIT ?
    `).bind(maxBatches).all()

    let processed = 0
    let reconciled = 0
    let deferred = 0

    for (const row of (rows?.results || [])) {
        processed += 1
        let candidates = []
        try {
            candidates = JSON.parse(row.candidates_json || '[]')
        } catch {
            candidates = []
        }
        try {
            await finalizePendingImportCommit(env, {
                commitId: row.commit_id,
                accountId: row.account_id,
                candidates,
                nowUnix: now,
            })
            reconciled += 1
        } catch {
            deferred += 1
        }
    }

    return { processed, reconciled, deferred }
}

/**
 * Commit confirmed guest share history into account_space_items.
 * Uses single-DB atomic EXISTS batch when accountDb === notesDb,
 * and the 4-stage split-DB protocol when accountDb !== notesDb.
 */
export async function commitGuestHistoryImport(request, env = globalThis, accountId, body = {}, { nowUnix } = {}) {
    const { accountDb, notesDb } = await assertAccountFeatureReady(env, { write: true })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')

    const rawItems = Array.isArray(body?.items) ? body.items : null
    if (!rawItems) {
        throw new AccountServiceError(400, 'INVALID_IMPORT_ITEMS', 'items array is required')
    }
    if (rawItems.length > MAX_IMPORT_CANDIDATES) {
        throw new AccountServiceError(400, 'TOO_MANY_IMPORT_ITEMS', `At most ${MAX_IMPORT_CANDIDATES} import items allowed per request`)
    }

    const requestOrigin = new URL(request.url).origin
    const now = nowSec(nowUnix)
    const seenShareIds = new Set()
    const seenNotePaths = new Set()
    const normalizedCandidates = []
    const resultEntries = []

    for (const rawEntry of rawItems) {
        const normalized = normalizeGuestHistoryEntry(rawEntry, requestOrigin, env)
        if (!normalized) {
            resultEntries.push({
                shareId: typeof rawEntry?.shareId === 'string' ? rawEntry.shareId : '',
                ...(typeof rawEntry?.path === 'string' && rawEntry.path.trim() ? { path: rawEntry.path.trim() } : {}),
                status: 'unavailable',
            })
            continue
        }
        if (normalized.kind === 'share') {
            if (seenShareIds.has(normalized.shareId)) continue
            seenShareIds.add(normalized.shareId)
        } else {
            if (seenNotePaths.has(normalized.notePath)) continue
            seenNotePaths.add(normalized.notePath)
        }
        normalizedCandidates.push(normalized)
    }

    const notePathCandidates = normalizedCandidates
        .filter(c => c.kind === 'note_path')
        .map(c => c.notePath)
    const notePathMetaMap = notePathCandidates.length > 0
        ? await batchLoadNotesMetadataMap(notesDb, notePathCandidates, now)
        : new Map()

    const editClaimItems = []
    const preVerified = []
    for (const candidate of normalizedCandidates) {
        if (candidate.kind === 'note_path') {
            const live = notePathMetaMap.get(candidate.notePath)
            const meta = live?.metadata || {}
            const noteUid = meta.noteUid || ''
            if (!live?.exists || !noteUid || live.tombstones.has(noteUid) || meta.share !== true) {
                resultEntries.push({ path: candidate.notePath, shareId: '', status: 'unavailable' })
                continue
            }

            const cookieProof = await checkCookieNoteEditProof(request, candidate.notePath, meta, env)
            const activeToken = live.activeTokens.find(t => t.note_uid === noteUid)?.share_id || ''
            const isProtectedOrSealed = Boolean(
                meta.vpw
                || isBurnProtected(meta)
                || isShareBurned(meta)
                || isShareExpired(meta, now)
                || isShareTimeLocked(meta, now)
                || isShareDeadmanLocked(meta, now)
            )
            const canClaimEdit = cookieProof.matched || (!meta.pw && !isProtectedOrSealed && !cookieProof.sawStalePathCookie)
            const canBookmarkShareOnly = !canClaimEdit && !meta.vpw && !isProtectedOrSealed && Boolean(activeToken)

            if (!canClaimEdit && !canBookmarkShareOnly) {
                resultEntries.push({ path: candidate.notePath, shareId: '', status: 'unavailable' })
                continue
            }

            const activityAt = candidate.timestamp > 0
                ? Math.min(now, Math.floor(candidate.timestamp > 1e12 ? candidate.timestamp / 1000 : candidate.timestamp))
                : now

            const resolvedTitle = await resolveAuthoritativeTitleSummary(notesDb, candidate.notePath, meta, candidate.fallbackTitle)
            if (canClaimEdit) {
                editClaimItems.push({
                    shareId: activeToken,
                    notePath: candidate.notePath,
                    noteUid,
                    editorFormat: resolveEditorFormat(meta),
                    titleSummary: resolvedTitle,
                    activityAt,
                })
            } else {
                preVerified.push({
                    shareId: activeToken,
                    notePath: candidate.notePath,
                    noteUid,
                    accessLevel: 'share_only',
                    importFacet: 'bookmarked',
                    editorFormat: resolveEditorFormat(meta),
                    titleSummary: resolvedTitle,
                    activityAt,
                })
            }
            continue
        }

        const resolved = await resolveAuthoritativeShareMetadata(candidate.shareId, { env, nowUnix: now })
        if (!isResolvedShareImportable(resolved, now)) {
            resultEntries.push({ shareId: candidate.shareId, status: 'unavailable' })
            continue
        }

        const meta = resolved.metadata || {}
        let accessLevel = 'share_only'
        if (candidate.explicitPath && candidate.explicitPath === resolved.path) {
            const hasEditProof = await verifyNoteEditProof(request, resolved.path, meta, resolved.noteUid, env)
            if (hasEditProof) {
                accessLevel = 'edit'
            }
        }

        const resolvedTitle = await resolveAuthoritativeTitleSummary(notesDb, resolved.path, meta, candidate.fallbackTitle)
        preVerified.push({
            shareId: resolved.shareId,
            notePath: resolved.path,
            noteUid: resolved.noteUid,
            accessLevel,
            importFacet: candidate.facet,
            editorFormat: resolveEditorFormat(meta),
            titleSummary: resolvedTitle,
            activityAt: candidate.timestamp > 0 ? Math.min(now, Math.floor(candidate.timestamp > 1e12 ? candidate.timestamp / 1000 : candidate.timestamp)) : now,
        })
    }

    let importedCount = 0
    let unavailableCount = resultEntries.length

    for (const claim of editClaimItems) {
        await upsertSpaceActivity({
            env,
            accountId,
            notePath: claim.notePath,
            noteUid: claim.noteUid,
            editorFormat: claim.editorFormat,
            titleSummary: claim.titleSummary,
            accessLevel: 'edit',
            facet: 'created',
            nowUnix: claim.activityAt,
        })
        importedCount += 1
        resultEntries.push({ path: claim.notePath, shareId: claim.shareId, status: 'imported', accessLevel: 'edit' })
    }

    if (preVerified.length === 0) {
        return {
            importedCount,
            unavailableCount,
            results: resultEntries,
        }
    }

    // Single-DB atomic path (accountDb === notesDb)
    if (accountDb === notesDb) {
        const stmts = []
        const pairTracking = []

        for (const item of preVerified) {
            const id = generateNonce()
            const itemKey = generateNonce()
            const facetJson = JSON.stringify([item.importFacet])
            const visBinds = [item.shareId, item.notePath, item.noteUid, now, now, now]

            const updateIdx = stmts.length
            stmts.push(
                accountDb.prepare(`
                    UPDATE account_space_items
                    SET status = 'active',
                        access_level = CASE WHEN ? = 'edit' THEN 'edit' ELSE access_level END,
                        verified_import_facets = COALESCE((
                            SELECT json_group_array(val)
                            FROM (
                                SELECT value AS val FROM json_each(COALESCE(verified_import_facets, '[]'))
                                UNION
                                SELECT ? AS val
                            )
                        ), ?),
                        facets = COALESCE((
                            SELECT json_group_array(val)
                            FROM (
                                SELECT value AS val FROM json_each(COALESCE(user_facets, '[]'))
                                UNION
                                SELECT value AS val FROM json_each(COALESCE(verified_import_facets, '[]'))
                                UNION
                                SELECT ? AS val
                            )
                        ), '[]'),
                        editor_format = ?,
                        title_summary = CASE WHEN ? != '' THEN ? ELSE title_summary END,
                        last_activity_at = MAX(last_activity_at, ?),
                        updated_at = ?
                    WHERE account_id = ?
                      AND note_path = ?
                      AND note_uid = ?
                      AND ${LIVE_IMPORT_VISIBILITY_EXISTS_SQL}
                `).bind(
                    item.accessLevel,
                    item.importFacet,
                    facetJson,
                    item.importFacet,
                    item.editorFormat,
                    item.titleSummary,
                    item.titleSummary,
                    item.activityAt,
                    now,
                    accountId,
                    item.notePath,
                    item.noteUid,
                    ...visBinds,
                ),
            )

            const insertIdx = stmts.length
            stmts.push(
                accountDb.prepare(`
                    INSERT INTO account_space_items (
                        id, item_key, account_id, note_path, note_uid, access_level,
                        facets, user_facets, verified_import_facets, editor_format, title_summary,
                        status, last_activity_at, created_at, updated_at
                    )
                    SELECT ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'active', ?, ?, ?
                    WHERE NOT EXISTS (
                        SELECT 1 FROM account_space_items
                        WHERE account_id = ? AND note_path = ? AND note_uid = ?
                    )
                    AND (
                        SELECT COUNT(*) FROM account_space_items
                        WHERE account_id = ? AND status IN ('active', 'pending_import')
                    ) < ?
                    AND ${LIVE_IMPORT_VISIBILITY_EXISTS_SQL}
                `).bind(
                    id,
                    itemKey,
                    accountId,
                    item.notePath,
                    item.noteUid,
                    item.accessLevel,
                    facetJson,
                    facetJson,
                    item.editorFormat,
                    item.titleSummary,
                    item.activityAt,
                    now,
                    now,
                    accountId,
                    item.notePath,
                    item.noteUid,
                    accountId,
                    MAX_SPACE_ITEMS_PER_ACCOUNT,
                    ...visBinds,
                ),
            )

            pairTracking.push({ item, updateIdx, insertIdx })
        }

        const batchResults = await accountDb.batch(stmts)
        for (const { item, updateIdx, insertIdx } of pairTracking) {
            const changed = Number(batchResults?.[updateIdx]?.meta?.changes ?? 0) + Number(batchResults?.[insertIdx]?.meta?.changes ?? 0)
            if (changed >= 1) {
                importedCount += 1
                resultEntries.push({ shareId: item.shareId, status: 'imported' })
            } else {
                unavailableCount += 1
                resultEntries.push({ shareId: item.shareId, status: 'unavailable' })
            }
        }

        return {
            importedCount,
            unavailableCount,
            results: resultEntries,
        }
    }

    // Split-DB 4-stage protocol (accountDb !== notesDb)
    const batchId = generateNonce()
    const stage1Stmts = [
        accountDb.prepare(`
            DELETE FROM account_space_items
            WHERE status = 'pending_import'
              AND pending_import_commit_id IS NULL
              AND created_at < ?
        `).bind(now - 120),
    ]

    for (const item of preVerified) {
        const id = generateNonce()
        const itemKey = generateNonce()
        stage1Stmts.push(
            accountDb.prepare(`
                INSERT INTO account_space_items (
                    id, item_key, account_id, note_path, note_uid, access_level,
                    facets, user_facets, verified_import_facets, editor_format, title_summary,
                    status, import_batch_id, pending_import_commit_id, pending_import_facets,
                    last_activity_at, created_at, updated_at
                )
                SELECT ?, ?, ?, ?, ?, ?, '[]', NULL, NULL, ?, ?, 'pending_import', ?, NULL, NULL, ?, ?, ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM account_space_items
                    WHERE account_id = ? AND note_path = ? AND note_uid = ?
                )
                AND (
                    SELECT COUNT(*) FROM account_space_items
                    WHERE account_id = ? AND status IN ('active', 'pending_import')
                ) < ?
            `).bind(
                id,
                itemKey,
                accountId,
                item.notePath,
                item.noteUid,
                item.accessLevel,
                item.editorFormat,
                item.titleSummary,
                batchId,
                item.activityAt,
                now,
                now,
                accountId,
                item.notePath,
                item.noteUid,
                accountId,
                MAX_SPACE_ITEMS_PER_ACCOUNT,
            ),
        )
    }
    await accountDb.batch(stage1Stmts)

    // Stage 2: Re-verify exact submitted shareId + live visibility on notesDb
    const stage2Verified = []
    for (const item of preVerified) {
        const resolved = await resolveAuthoritativeShareMetadata(item.shareId, { env, nowUnix: now })
        if (
            isResolvedShareImportable(resolved, now)
            && resolved.path === item.notePath
            && resolved.noteUid === item.noteUid
        ) {
            stage2Verified.push(item)
        } else {
            unavailableCount += 1
            resultEntries.push({ shareId: item.shareId, status: 'unavailable' })
        }
    }

    // Stage 3: Acquire per-item lock ONLY WHERE pending_import_commit_id IS NULL AND (status = 'active' OR import_batch_id = batchId)
    const commitId = generateNonce()
    const stage3Stmts = []
    for (const item of stage2Verified) {
        const pendingFacetsJson = JSON.stringify([item.importFacet])
        stage3Stmts.push(
            accountDb.prepare(`
                UPDATE account_space_items
                SET pending_import_commit_id = ?,
                    pending_import_facets = ?,
                    editor_format = CASE WHEN status = 'pending_import' THEN ? ELSE editor_format END,
                    title_summary = CASE WHEN status = 'pending_import' AND ? != '' THEN ? ELSE title_summary END,
                    updated_at = ?
                WHERE account_id = ?
                  AND note_path = ?
                  AND note_uid = ?
                  AND pending_import_commit_id IS NULL
                  AND (status = 'active' OR import_batch_id = ?)
            `).bind(
                commitId,
                pendingFacetsJson,
                item.editorFormat,
                item.titleSummary,
                item.titleSummary,
                now,
                accountId,
                item.notePath,
                item.noteUid,
                batchId,
            ),
        )
    }

    stage3Stmts.push(
        accountDb.prepare(`
            DELETE FROM account_space_items
            WHERE account_id = ?
              AND status = 'pending_import'
              AND import_batch_id = ?
              AND pending_import_commit_id IS NULL
        `).bind(accountId, batchId),
    )

    // Journal the full candidate set atomically with the locks. Finalization
    // only changes rows bearing this commit ID, including after a crash.
    stage3Stmts.push(accountDb.prepare(`
        INSERT INTO pending_import_finalizations (commit_id, account_id, candidates_json, created_at)
        SELECT ?, ?, ?, ? WHERE EXISTS (
            SELECT 1 FROM account_space_items WHERE account_id = ? AND pending_import_commit_id = ?
        )
    `).bind(commitId, accountId, JSON.stringify(stage2Verified), now, accountId, commitId))

    const stage3LockResults = await accountDb.batch(stage3Stmts)
    const lockedCandidates = []
    for (let i = 0; i < stage2Verified.length; i += 1) {
        if (Number(stage3LockResults?.[i]?.meta?.changes ?? 0) === 1) {
            lockedCandidates.push(stage2Verified[i])
        } else {
            unavailableCount += 1
            resultEntries.push({ shareId: stage2Verified[i].shareId, status: 'unavailable' })
        }
    }

    if (lockedCandidates.length === 0) {
        return {
            importedCount: 0,
            unavailableCount,
            results: resultEntries,
        }
    }


    // Stage 4: Final notesDb verification + atomic accountDb finalize/undo + journal deletion
    const fin = await finalizePendingImportCommit(env, {
        commitId,
        accountId,
        candidates: lockedCandidates,
        nowUnix: now,
    })

    for (const c of lockedCandidates) {
        if (fin.verifiedShareIds.has(c.shareId)) {
            importedCount += 1
            resultEntries.push({ shareId: c.shareId, status: 'imported' })
        } else {
            unavailableCount += 1
            resultEntries.push({ shareId: c.shareId, status: 'unavailable' })
        }
    }

    return {
        importedCount,
        unavailableCount,
        results: resultEntries,
    }
}

// ============================================================================
// Public Share Circles (4.2)
// ============================================================================

/**
 * Evaluate live public Share Circle eligibility for a note without reading note content.
 * Enforces share_token_registry.is_csprng_v1 = 1, revoked_at IS NULL, no tombstone,
 * matching noteUid, share = true, no vpw, no Seal, and no burn/expiry.
 */
export async function isPublicCircleNoteEligible(
    notesDb,
    { shareId = '', targetPath = '', noteUid = '', nowUnix } = {},
) {
    if (!notesDb || typeof notesDb.prepare !== 'function' || !targetPath || !noteUid) {
        return { eligible: false, reason: 'missing_identity' }
    }
    const now = nowSec(nowUnix)

    const tomb = await notesDb.prepare(`
        SELECT 1 AS ok FROM note_tombstones WHERE path = ? AND deleted_note_uid = ? LIMIT 1
    `).bind(targetPath, noteUid).first()
    if (tomb) return { eligible: false, reason: 'deleted' }

    const noteRow = await notesDb.prepare(`
        SELECT metadata FROM notes WHERE path = ? LIMIT 1
    `).bind(targetPath).first()
    if (!noteRow) return { eligible: false, reason: 'deleted' }

    const metadata = parseMetaSafe(noteRow.metadata)
    if (!metadata.noteUid || metadata.noteUid !== noteUid) {
        return { eligible: false, reason: 'uid_mismatch' }
    }
    if (metadata.share !== true) return { eligible: false, reason: 'unshared' }
    if (metadata.vpw) return { eligible: false, reason: 'vpw' }
    if (isShareBurned(metadata)) return { eligible: false, reason: 'burned' }
    if (isBurnProtected(metadata)) return { eligible: false, reason: 'burn' }
    if (isShareExpired(metadata, now)) return { eligible: false, reason: 'expired' }
    if (metadata.shareMode === 'timelock') return { eligible: false, reason: 'timelock' }
    if (metadata.shareMode === 'deadman') return { eligible: false, reason: 'deadman' }

    const regRow = shareId
        ? await notesDb.prepare(`
            SELECT share_id, is_csprng_v1, revoked_at
            FROM share_token_registry
            WHERE share_id = ? AND target_path = ? AND note_uid = ?
            LIMIT 1
        `).bind(shareId, targetPath, noteUid).first()
        : await notesDb.prepare(`
            SELECT share_id, is_csprng_v1, revoked_at
            FROM share_token_registry
            WHERE target_path = ? AND note_uid = ? AND revoked_at IS NULL
            ORDER BY is_csprng_v1 DESC, created_at DESC
            LIMIT 1
        `).bind(targetPath, noteUid).first()

    if (!regRow || (regRow.revoked_at !== null && regRow.revoked_at !== undefined)) {
        return { eligible: false, reason: 'revoked' }
    }
    if (regRow.is_csprng_v1 !== 1) {
        return { eligible: false, reason: 'legacy_token' }
    }

    return {
        eligible: true,
        shareId: regRow.share_id,
        metadata,
    }
}

function presentCircleRow(row) {
    return {
        id: row.id,
        name: row.name,
        publicToken: row.public_token,
        isEnabled: Boolean(row.is_enabled),
        itemCount: Number(row.item_count ?? 0),
        createdAt: Number(row.created_at || 0),
        updatedAt: Number(row.updated_at || 0),
    }
}

export async function createCircle({ env = globalThis, accountId, name, isEnabled = false, nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')

    const cleanName = sanitizeCircleName(name)
    if (!cleanName) {
        throw new AccountServiceError(400, 'INVALID_CIRCLE_NAME', 'Circle name must be 1 to 80 characters')
    }
    const enabledInt = isEnabled === true ? 1 : 0
    const now = nowSec(nowUnix)
    const circleId = generateNonce()

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const publicToken = generateShareToken()
        try {
            const res = await accountDb.prepare(`
                INSERT INTO share_circles (id, account_id, public_token, name, is_enabled, created_at, updated_at)
                SELECT ?, ?, ?, ?, ?, ?, ?
                WHERE (SELECT COUNT(*) FROM share_circles WHERE account_id = ?) < ?
            `).bind(circleId, accountId, publicToken, cleanName, enabledInt, now, now, accountId, MAX_CIRCLES_PER_ACCOUNT).run()

            if (Number(res?.meta?.changes ?? 0) !== 1) {
                throw new AccountServiceError(409, 'QUOTA_EXCEEDED', `Share Circle quota (${MAX_CIRCLES_PER_ACCOUNT}) exceeded`)
            }
            return {
                id: circleId,
                name: cleanName,
                publicToken,
                isEnabled: Boolean(enabledInt),
                itemCount: 0,
                createdAt: now,
                updatedAt: now,
            }
        } catch (err) {
            if (isUniqueConstraintError(err) && attempt < 2) continue
            throw err
        }
    }

    throw new AccountServiceError(409, 'CIRCLE_TOKEN_CONFLICT', 'Failed to allocate unique circle public token')
}

export async function listCircles({ env = globalThis, accountId } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: false })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')

    const res = await accountDb.prepare(`
        SELECT c.id, c.public_token, c.name, c.is_enabled, c.created_at, c.updated_at,
               COUNT(ci.space_item_id) AS item_count
        FROM share_circles c
        LEFT JOIN share_circle_items ci ON ci.circle_id = c.id
        WHERE c.account_id = ?
        GROUP BY c.id
        ORDER BY c.created_at DESC, c.id DESC
    `).bind(accountId).all()

    return (res?.results || []).map(presentCircleRow)
}

export async function getCircleOwnerDetail({ env = globalThis, accountId, circleId, nowUnix } = {}) {
    const { accountDb, notesDb } = await assertAccountFeatureReady(env, { write: false })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')
    const now = nowSec(nowUnix)

    const circleRow = await accountDb.prepare(`
        SELECT c.id, c.public_token, c.name, c.is_enabled, c.created_at, c.updated_at,
               COUNT(ci.space_item_id) AS item_count
        FROM share_circles c
        LEFT JOIN share_circle_items ci ON ci.circle_id = c.id
        WHERE c.id = ? AND c.account_id = ?
        GROUP BY c.id
        LIMIT 1
    `).bind(circleId, accountId).first()

    if (!circleRow) {
        throw new AccountServiceError(404, 'CIRCLE_NOT_FOUND', 'Share Circle not found')
    }

    const itemRes = await accountDb.prepare(`
        SELECT ci.space_item_id, ci.added_at,
               s.item_key, s.note_path, s.note_uid, s.access_level, s.editor_format, s.title_summary
        FROM share_circle_items ci
        JOIN account_space_items s ON s.id = ci.space_item_id
        WHERE ci.circle_id = ?
          AND s.account_id = ?
        ORDER BY ci.added_at DESC
    `).bind(circleId, accountId).all()

    const rows = itemRes?.results || []
    const items = []
    for (const row of rows) {
        const elig = await isPublicCircleNoteEligible(notesDb, {
            targetPath: row.note_path,
            noteUid: row.note_uid,
            nowUnix: now,
        })
        if (elig.eligible) {
            const meta = elig.metadata || {}
            items.push({
                itemKey: row.item_key,
                spaceItemId: row.space_item_id,
                shareId: elig.shareId,
                titleSummary: meta.titleSummary || row.title_summary || 'Untitled Share',
                editorFormat: resolveEditorFormat(meta) || row.editor_format || 'markdown',
                available: true,
                masked: false,
                reasonBadge: null,
                addedAt: Number(row.added_at || 0),
            })
        } else if (row.access_level === 'edit') {
            items.push({
                itemKey: row.item_key,
                spaceItemId: row.space_item_id,
                shareId: null,
                titleSummary: row.title_summary || 'Unavailable Note',
                editorFormat: row.editor_format || 'markdown',
                available: false,
                masked: false,
                reasonBadge: elig.reason,
                addedAt: Number(row.added_at || 0),
            })
        } else {
            items.push({
                itemKey: row.item_key,
                spaceItemId: row.space_item_id,
                shareId: null,
                titleSummary: 'Hidden (currently unavailable)',
                editorFormat: null,
                available: false,
                masked: true,
                reasonBadge: 'Hidden (currently unavailable)',
                addedAt: Number(row.added_at || 0),
            })
        }
    }

    return {
        circle: presentCircleRow(circleRow),
        items,
    }
}

export async function updateCircle({ env = globalThis, accountId, circleId, name, isEnabled, nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')

    const updates = []
    const binds = []
    if (name !== undefined) {
        const cleanName = sanitizeCircleName(name)
        if (!cleanName) {
            throw new AccountServiceError(400, 'INVALID_CIRCLE_NAME', 'Circle name must be 1 to 80 characters')
        }
        updates.push('name = ?')
        binds.push(cleanName)
    }
    if (isEnabled !== undefined) {
        if (typeof isEnabled !== 'boolean' && isEnabled !== 0 && isEnabled !== 1) {
            throw new AccountServiceError(400, 'INVALID_CIRCLE_STATE', 'isEnabled must be a boolean')
        }
        updates.push('is_enabled = ?')
        binds.push(isEnabled ? 1 : 0)
    }
    if (updates.length === 0) {
        throw new AccountServiceError(400, 'NO_UPDATES_PROVIDED', 'name or isEnabled must be provided')
    }

    const now = nowSec(nowUnix)
    updates.push('updated_at = ?')
    binds.push(now, circleId, accountId)

    const res = await accountDb.prepare(`
        UPDATE share_circles
        SET ${updates.join(', ')}
        WHERE id = ? AND account_id = ?
    `).bind(...binds).run()

    if (Number(res?.meta?.changes ?? 0) === 0) {
        throw new AccountServiceError(404, 'CIRCLE_NOT_FOUND', 'Share Circle not found')
    }

    const row = await accountDb.prepare(`
        SELECT c.id, c.public_token, c.name, c.is_enabled, c.created_at, c.updated_at,
               COUNT(ci.space_item_id) AS item_count
        FROM share_circles c
        LEFT JOIN share_circle_items ci ON ci.circle_id = c.id
        WHERE c.id = ? AND c.account_id = ?
        GROUP BY c.id
        LIMIT 1
    `).bind(circleId, accountId).first()

    return presentCircleRow(row)
}

export async function rotateCircleToken({ env = globalThis, accountId, circleId, nowUnix } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')
    const now = nowSec(nowUnix)

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const nextToken = generateShareToken()
        try {
            const res = await accountDb.prepare(`
                UPDATE share_circles
                SET public_token = ?, updated_at = ?
                WHERE id = ? AND account_id = ?
            `).bind(nextToken, now, circleId, accountId).run()

            if (Number(res?.meta?.changes ?? 0) === 0) {
                throw new AccountServiceError(404, 'CIRCLE_NOT_FOUND', 'Share Circle not found')
            }

            const row = await accountDb.prepare(`
                SELECT c.id, c.public_token, c.name, c.is_enabled, c.created_at, c.updated_at,
                       COUNT(ci.space_item_id) AS item_count
                FROM share_circles c
                LEFT JOIN share_circle_items ci ON ci.circle_id = c.id
                WHERE c.id = ? AND c.account_id = ?
                GROUP BY c.id
                LIMIT 1
            `).bind(circleId, accountId).first()

            return presentCircleRow(row)
        } catch (err) {
            if (isUniqueConstraintError(err) && attempt < 2) continue
            throw err
        }
    }

    throw new AccountServiceError(409, 'CIRCLE_TOKEN_CONFLICT', 'Failed to rotate circle public token')
}

export async function deleteCircle({ env = globalThis, accountId, circleId } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')

    const results = await accountDb.batch([
        accountDb.prepare(`
            DELETE FROM share_circle_items
            WHERE circle_id = ?
              AND EXISTS (SELECT 1 FROM share_circles WHERE id = ? AND account_id = ?)
        `).bind(circleId, circleId, accountId),
        accountDb.prepare(`
            DELETE FROM share_circles
            WHERE id = ? AND account_id = ?
        `).bind(circleId, accountId),
    ])

    if (Number(results?.[1]?.meta?.changes ?? 0) === 0) {
        throw new AccountServiceError(404, 'CIRCLE_NOT_FOUND', 'Share Circle not found')
    }
    return { deleted: true, circleId }
}

/**
 * Add an eligible CSPRNG public share note to a Share Circle (enforcing <= 200 quota and 409 ALREADY_IN_CIRCLE).
 */
export async function addCircleItem({
    env = globalThis,
    accountId,
    circleId,
    itemKey = '',
    spaceItemId = '',
    shareId = '',
    notePath = '',
    noteUid = '',
    request = null,
    nowUnix,
} = {}) {
    const { accountDb, notesDb } = await assertAccountFeatureReady(env, { write: true })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')
    const now = nowSec(nowUnix)

    const circleRow = await accountDb.prepare(`
        SELECT id FROM share_circles WHERE id = ? AND account_id = ? LIMIT 1
    `).bind(circleId, accountId).first()
    if (!circleRow) {
        throw new AccountServiceError(404, 'CIRCLE_NOT_FOUND', 'Share Circle not found')
    }

    let targetSpaceItem = null
    if (itemKey || spaceItemId) {
        targetSpaceItem = itemKey
            ? await accountDb.prepare(`
                SELECT id, item_key, note_path, note_uid, status
                FROM account_space_items
                WHERE account_id = ? AND item_key = ? AND status = 'active'
                LIMIT 1
            `).bind(accountId, String(itemKey)).first()
            : await accountDb.prepare(`
                SELECT id, item_key, note_path, note_uid, status
                FROM account_space_items
                WHERE account_id = ? AND id = ? AND status = 'active'
                LIMIT 1
            `).bind(accountId, String(spaceItemId)).first()
        if (!targetSpaceItem) {
            throw new AccountServiceError(404, 'SPACE_ITEM_NOT_FOUND', 'Personal Space item not found')
        }
    } else if (shareId) {
        const resolved = await resolveAuthoritativeShareMetadata(String(shareId), { env, nowUnix: now })
        if (!resolved || resolved.status !== 'active' || !resolved.path || !resolved.noteUid) {
            throw new AccountServiceError(400, 'INELIGIBLE_NOTE', 'Note is unavailable or ineligible for Share Circles')
        }
        if (!resolved.isCsprngV1) {
            throw new AccountServiceError(400, 'LEGACY_TOKEN_INELIGIBLE', 'Legacy share tokens are not eligible for Share Circles; re-publish to issue a canonical CSPRNG token')
        }
        const bm = await bookmarkNoteToSpace({
            env,
            accountId,
            shareId: resolved.shareId,
            notePath: notePath || '',
            noteUid: noteUid || '',
            request,
            nowUnix: now,
        })
        targetSpaceItem = await accountDb.prepare(`
            SELECT id, item_key, note_path, note_uid, status
            FROM account_space_items
            WHERE account_id = ? AND item_key = ?
            LIMIT 1
        `).bind(accountId, bm.item.itemKey).first()
    } else if (notePath && noteUid) {
        const existing = await accountDb.prepare(`
            SELECT id, item_key, note_path, note_uid, status
            FROM account_space_items
            WHERE account_id = ? AND note_path = ? AND note_uid = ? AND status = 'active'
            LIMIT 1
        `).bind(accountId, String(notePath), String(noteUid)).first()
        if (!existing) {
            throw new AccountServiceError(404, 'SPACE_ITEM_NOT_FOUND', 'Note must be indexed in Personal Space first')
        }
        targetSpaceItem = existing
    } else {
        throw new AccountServiceError(400, 'INVALID_CIRCLE_ITEM_INPUT', 'itemKey, spaceItemId, or shareId is required')
    }

    const elig = await isPublicCircleNoteEligible(notesDb, {
        shareId: shareId ? String(shareId) : '',
        targetPath: targetSpaceItem.note_path,
        noteUid: targetSpaceItem.note_uid,
        nowUnix: now,
    })

    if (!elig.eligible) {
        if (elig.reason === 'legacy_token') {
            throw new AccountServiceError(
                400,
                'LEGACY_TOKEN_INELIGIBLE',
                'Legacy share tokens (is_csprng_v1 = 0) cannot be added to Share Circles; re-publish the note first.',
            )
        }
        throw new AccountServiceError(
            400,
            'INELIGIBLE_NOTE',
            `Note is not eligible for public Share Circles (${elig.reason})`,
        )
    }

    const existingMembership = await accountDb.prepare(`
        SELECT 1 AS ok
        FROM share_circle_items
        WHERE circle_id = ? AND space_item_id = ?
        LIMIT 1
    `).bind(circleId, targetSpaceItem.id).first()
    if (existingMembership) {
        throw new AccountServiceError(409, 'ALREADY_IN_CIRCLE', 'Note is already in this Share Circle')
    }

    let insertRes
    try {
        insertRes = await accountDb.prepare(`
            INSERT INTO share_circle_items (circle_id, space_item_id, added_at)
            SELECT ?, ?, ?
            WHERE (SELECT COUNT(*) FROM share_circle_items WHERE circle_id = ?) < ?
              AND EXISTS (
                  SELECT 1
                  FROM share_circles c
                  JOIN account_space_items s ON s.id = ? AND s.account_id = c.account_id
                  WHERE c.id = ? AND c.account_id = ? AND s.status = 'active'
              )
        `).bind(
            circleId,
            targetSpaceItem.id,
            now,
            circleId,
            MAX_ITEMS_PER_CIRCLE,
            targetSpaceItem.id,
            circleId,
            accountId,
        ).run()
    } catch (err) {
        if (isUniqueConstraintError(err)) {
            throw new AccountServiceError(409, 'ALREADY_IN_CIRCLE', 'Note is already in this Share Circle')
        }
        throw err
    }

    if (Number(insertRes?.meta?.changes ?? 0) !== 1) {
        throw new AccountServiceError(409, 'QUOTA_EXCEEDED', `Share Circle item quota (${MAX_ITEMS_PER_CIRCLE}) exceeded`)
    }

    return {
        added: true,
        circleId,
        itemKey: targetSpaceItem.item_key,
        spaceItemId: targetSpaceItem.id,
        shareId: elig.shareId,
    }
}

export async function removeCircleItem({ env = globalThis, accountId, circleId, itemKey } = {}) {
    const { accountDb } = await assertAccountFeatureReady(env, { write: true })
    if (!accountId) throw new AccountServiceError(401, 'UNAUTHORIZED', 'Authentication required')
    const cleanKey = String(itemKey || '').trim()
    if (!cleanKey) throw new AccountServiceError(400, 'INVALID_ITEM_KEY', 'itemKey is required')

    const res = await accountDb.prepare(`
        DELETE FROM share_circle_items
        WHERE circle_id = ?
          AND EXISTS (SELECT 1 FROM share_circles WHERE id = ? AND account_id = ?)
          AND space_item_id IN (
              SELECT id FROM account_space_items
              WHERE account_id = ? AND (item_key = ? OR id = ?)
          )
    `).bind(circleId, circleId, accountId, accountId, cleanKey, cleanKey).run()

    if (Number(res?.meta?.changes ?? 0) === 0) {
        throw new AccountServiceError(404, 'CIRCLE_ITEM_NOT_FOUND', 'Circle item not found')
    }
    return { removed: true, circleId, itemKey: cleanKey }
}

/**
 * Load live-verified public Share Circle view for /c/:publicToken without exposing account_id or note_path.
 */
export async function loadPublicCircleView({
    env = globalThis,
    publicToken,
    viewerSession = null,
    preview = false,
    nowUnix,
} = {}) {
    const cleanToken = String(publicToken || '').trim()
    if (!cleanToken || !/^[A-Za-z0-9_-]{16,128}$/.test(cleanToken)) {
        return { found: false }
    }

    const { accountDb, notesDb } = await assertAccountFeatureReady(env, { write: false })
    const now = nowSec(nowUnix)

    const circleRow = await accountDb.prepare(`
        SELECT id, account_id, public_token, name, is_enabled, created_at, updated_at
        FROM share_circles
        WHERE public_token = ?
        LIMIT 1
    `).bind(cleanToken).first()

    if (!circleRow) return { found: false }

    const isOwner = Boolean(viewerSession && viewerSession.account_id === circleRow.account_id)
    const isOwnerPreview = Boolean(preview && isOwner)

    if (circleRow.is_enabled !== 1 && !isOwnerPreview) {
        return { found: false }
    }

    const itemsRes = await accountDb.prepare(`
        SELECT ci.added_at, s.note_path, s.note_uid, s.editor_format, s.title_summary
        FROM share_circle_items ci
        JOIN account_space_items s ON s.id = ci.space_item_id
        WHERE ci.circle_id = ?
          AND s.status = 'active'
        ORDER BY ci.added_at DESC
        LIMIT ?
    `).bind(circleRow.id, MAX_ITEMS_PER_CIRCLE).all()

    const publicItems = []
    for (const row of (itemsRes?.results || [])) {
        const elig = await isPublicCircleNoteEligible(notesDb, {
            targetPath: row.note_path,
            noteUid: row.note_uid,
            nowUnix: now,
        })
        if (!elig.eligible) continue

        const meta = elig.metadata || {}
        const updatedAt = Number(meta.updateAt || meta.updatedAt || meta.createdAt || row.added_at || 0)
        publicItems.push({
            shareId: elig.shareId,
            titleSummary: meta.titleSummary || row.title_summary || 'Untitled Share',
            editorFormat: resolveEditorFormat(meta) || row.editor_format || 'markdown',
            updatedAt: updatedAt > 1e12 ? Math.floor(updatedAt / 1000) : updatedAt,
        })
    }

    return {
        found: true,
        isOwnerPreview,
        circle: {
            name: circleRow.name,
            isEnabled: circleRow.is_enabled === 1,
        },
        items: publicItems,
    }
}

export function getTurnstileBootstrapConfig(env = globalThis) {
    const policy = resolveTurnstilePolicy(env)
    const siteKey = policy === 'enabled'
        ? String(env?.SCN_TURNSTILE_SITE_KEY || env?.TURNSTILE_SITE_KEY || getTurnstileSiteKey() || '').trim()
        : ''
    return {
        policy,
        turnstileEnabled: policy === 'enabled' && Boolean(siteKey),
        turnstileSiteKey: siteKey,
    }
}
