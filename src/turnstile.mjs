import jwt from '@tsndr/cloudflare-worker-jwt'
import { Cookies } from './cookie_compat.mjs'
import { getTurnstileSecret, isTurnstileEnabled, isTurnstileFailOpen, getSecret } from './constant.js'
import { verifyJwtPayload } from './helper.js'
import { bytesToBase64Url } from './webauthn_core.mjs'

export const TURNSTILE_CLEARANCE_COOKIE_NAME = 'cf_turnstile_cleared'
export const TURNSTILE_CLEARANCE_MAX_AGE_SECONDS = 7200 // 2 hours

const TEXT_ENCODER = new TextEncoder()

const readTurnstileEnvVar = (env, name) => {
    const val = env?.[name] ?? globalThis?.[name]
    return val === undefined || val === null ? '' : String(val).trim()
}

const getTurnstileCredentials = (env = globalThis) => ({
    flag: readTurnstileEnvVar(env, 'SCN_ENABLE_TURNSTILE'),
    siteKey: readTurnstileEnvVar(env, 'SCN_TURNSTILE_SITE_KEY') || readTurnstileEnvVar(env, 'TURNSTILE_SITE_KEY'),
    secret: readTurnstileEnvVar(env, 'SCN_TURNSTILE_SECRET') || readTurnstileEnvVar(env, 'TURNSTILE_SECRET'),
})

/**
 * Resolve Turnstile tri-state policy (`disabled` | `misconfigured` | `enabled`) with strict precedence.
 */
export function resolveTurnstilePolicy(env = globalThis) {
    const { flag, siteKey, secret } = getTurnstileCredentials(env)
    if (flag === '0' || flag === 'false') {
        return 'disabled'
    }
    if (flag !== '' && flag !== '1') {
        return 'misconfigured'
    }
    if (flag === '1') {
        return siteKey && secret ? 'enabled' : 'misconfigured'
    }
    if (siteKey && secret) {
        return 'enabled'
    }
    if (siteKey || secret) {
        return 'misconfigured'
    }
    return 'disabled'
}

/**
 * Strictly verify a Turnstile token for high-assurance auth endpoints.
 * Ignores fail-open flags and clearance cookies; validates policy, hostname, action, and returns `tokenHash`.
 */
export async function verifyTurnstileTokenStrict(
    token,
    remoteip = '',
    { expectedHostname, expectedAction, env = globalThis } = {}
) {
    const policy = resolveTurnstilePolicy(env)
    if (policy === 'misconfigured') {
        return { ok: false, misconfigured: true, reason: 'turnstile_misconfigured' }
    }
    if (policy === 'disabled') {
        return { ok: true, skipped: true }
    }

    if (!token || typeof token !== 'string' || token.trim().length === 0 || token.length > 4096) {
        return { ok: false, reason: 'missing_or_invalid_token' }
    }

    const trimmedToken = token.trim()
    const tokenDigest = new Uint8Array(await crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(trimmedToken)))
    const tokenHash = bytesToBase64Url(tokenDigest)
    const { secret } = getTurnstileCredentials(env)

    try {
        const body = new URLSearchParams()
        body.append('secret', secret)
        body.append('response', trimmedToken)
        if (remoteip && typeof remoteip === 'string') {
            body.append('remoteip', remoteip)
        }

        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
            signal: AbortSignal.timeout(5000),
        })

        if (!res.ok) {
            return { ok: false, reason: `siteverify_http_${res.status}` }
        }

        const outcome = await res.json()
        if (outcome?.success !== true) {
            return {
                ok: false,
                reason: Array.isArray(outcome?.['error-codes']) && outcome['error-codes'].length
                    ? outcome['error-codes'].join(', ')
                    : 'token_verification_failed',
                outcome,
            }
        }

        if (expectedHostname !== undefined && expectedHostname !== null) {
            const expectedHost = String(expectedHostname).trim().toLowerCase()
            const actualHost = String(outcome?.hostname || '').trim().toLowerCase()
            if (!expectedHost || actualHost !== expectedHost) {
                return { ok: false, reason: 'hostname_mismatch', outcome }
            }
        }

        if (expectedAction !== undefined && expectedAction !== null) {
            const expAction = String(expectedAction).trim()
            const actAction = String(outcome?.action || '').trim()
            if (!expAction || actAction !== expAction) {
                return { ok: false, reason: 'action_mismatch', outcome }
            }
        }

        return { ok: true, outcome, tokenHash }
    } catch (err) {
        return { ok: false, reason: err?.message || 'siteverify_network_error' }
    }
}

/**
 * Verify Cloudflare Turnstile token via siteverify API
 * @param {string} token - The cf-turnstile-response token from client
 * @param {string} [remoteip] - Client IP from cf-connecting-ip
 * @returns {Promise<{ ok: boolean, reason?: string, outcome?: object, skipped?: boolean, fallback?: boolean }>}
 */
export async function verifyTurnstileToken(token, remoteip = '') {
    if (!isTurnstileEnabled()) {
        return { ok: true, skipped: true }
    }

    const secret = getTurnstileSecret()
    if (!secret) {
        return { ok: true, skipped: true }
    }

    if (!token || typeof token !== 'string' || token.trim().length === 0 || token.length > 4096) {
        return { ok: false, reason: 'missing_or_invalid_token' }
    }

    try {
        const body = new URLSearchParams()
        body.append('secret', secret)
        body.append('response', token.trim())
        if (remoteip && typeof remoteip === 'string') {
            body.append('remoteip', remoteip)
        }

        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
            signal: AbortSignal.timeout(5000),
        })

        if (!res.ok) {
            // Upstream outage / 5xx error: fail-open if configured so note saving is never blocked
            if (res.status >= 500 && isTurnstileFailOpen()) {
                console.warn(`[Turnstile Fallback] siteverify upstream HTTP ${res.status}, failing open`)
                return { ok: true, fallback: true, reason: `upstream_http_${res.status}` }
            }
            return { ok: false, reason: `siteverify_http_${res.status}` }
        }

        const outcome = await res.json()
        if (outcome.success === true) {
            return { ok: true, outcome }
        }

        return {
            ok: false,
            reason: Array.isArray(outcome['error-codes']) ? outcome['error-codes'].join(', ') : 'token_verification_failed',
            outcome
        }
    } catch (err) {
        console.warn('Turnstile siteverify error:', err?.message || err)
        // Upstream network error or timeout: fail-open if configured
        if (isTurnstileFailOpen()) {
            console.warn('[Turnstile Fallback] siteverify network error / timeout, failing open:', err?.message || err)
            return { ok: true, fallback: true, reason: err?.message || 'siteverify_network_error' }
        }
        return { ok: false, reason: err?.message || 'siteverify_network_error' }
    }
}

/**
 * Create a signed clearance token valid for TURNSTILE_CLEARANCE_MAX_AGE_SECONDS
 * @param {string} [clientIp]
 * @returns {Promise<string|null>}
 */
export async function createTurnstileClearanceToken(clientIp = '') {
    const secret = getSecret() || getTurnstileSecret()
    if (!secret) return null

    try {
        const now = Math.floor(Date.now() / 1000)
        const token = await jwt.sign(
            {
                type: 'turnstile_clearance',
                ip: clientIp || '',
                exp: now + TURNSTILE_CLEARANCE_MAX_AGE_SECONDS,
                iat: now,
            },
            secret
        )
        return token
    } catch (err) {
        console.warn('Failed to create turnstile clearance token:', err)
        return null
    }
}

/**
 * Verify if the request contains a valid clearance cookie
 * @param {Request} request
 * @returns {Promise<boolean>}
 */
export async function verifyTurnstileClearanceCookie(request) {
    if (!isTurnstileEnabled()) return true

    const secret = getSecret() || getTurnstileSecret()
    if (!secret) return true

    const cookieHeader = request.headers.get('Cookie') || ''
    const cookies = Cookies.parse(cookieHeader)
    const clearanceToken = cookies[TURNSTILE_CLEARANCE_COOKIE_NAME]
    if (!clearanceToken) return false

    try {
        const payload = await verifyJwtPayload(clearanceToken, secret)
        if (!payload || payload.type !== 'turnstile_clearance') return false

        const now = Math.floor(Date.now() / 1000)
        if (payload.exp && payload.exp < now) return false

        const currentIp = request.headers.get('cf-connecting-ip') || ''
        if (payload.ip && currentIp && payload.ip !== currentIp) return false

        return true
    } catch (err) {
        return false
    }
}

/**
 * Unified verification for incoming requests (checks cookie clearance first, then token header/body)
 * @param {Request} request
 * @param {string} [explicitToken]
 * @param {{ fallback?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, reason?: string, setCookieHeader?: string, skipped?: boolean, cleared?: boolean, verified?: boolean, fallback?: boolean, needTurnstile?: boolean }>}
 */
export async function verifyTurnstileAccess(request, explicitToken = null, options = {}) {
    if (!isTurnstileEnabled()) {
        return { ok: true, skipped: true }
    }

    // 1. Check existing clearance cookie
    const hasClearance = await verifyTurnstileClearanceCookie(request)
    if (hasClearance) {
        return { ok: true, cleared: true }
    }

    const clientIp = request.headers.get('cf-connecting-ip') || ''

    // 2. Extract token from header or parameter
    const token = explicitToken ||
        request.headers.get('cf-turnstile-response') ||
        request.headers.get('x-turnstile-token') ||
        ''

    if (!token) {
        return {
            ok: false,
            reason: 'Turnstile verification token required',
            needTurnstile: true,
        }
    }

    // 3. Verify token with Cloudflare siteverify (fails open on upstream 5xx or timeout if isTurnstileFailOpen())
    const result = await verifyTurnstileToken(token, clientIp)
    if (!result.ok) {
        return {
            ok: false,
            reason: result.reason || 'Turnstile verification failed',
            needTurnstile: true,
        }
    }

    // 4. Generate new clearance cookie
    const clearanceToken = await createTurnstileClearanceToken(clientIp)
    let setCookieHeader = null
    if (clearanceToken) {
        setCookieHeader = `${TURNSTILE_CLEARANCE_COOKIE_NAME}=${clearanceToken}; Path=/; SameSite=Lax; Max-Age=${TURNSTILE_CLEARANCE_MAX_AGE_SECONDS}; Secure`
    }

    return {
        ok: true,
        verified: true,
        fallback: result.fallback || false,
        setCookieHeader,
    }
}
