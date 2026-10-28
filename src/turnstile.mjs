import jwt from '@tsndr/cloudflare-worker-jwt'
import { Cookies } from './cookie_compat.mjs'
import { getTurnstileSecret, isTurnstileEnabled, isTurnstileFailOpen, getSecret } from './constant.js'

export const TURNSTILE_CLEARANCE_COOKIE_NAME = 'cf_turnstile_cleared'
export const TURNSTILE_CLEARANCE_MAX_AGE_SECONDS = 7200 // 2 hours

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
        const isValid = await jwt.verify(clearanceToken, secret)
        if (!isValid) return false

        const payload = jwt.decode(clearanceToken)
        if (payload?.type !== 'turnstile_clearance') return false

        const now = Math.floor(Date.now() / 1000)
        if (payload.exp && payload.exp < now) return false

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

    // 2. Check if client explicitly signaled degraded fallback
    const clientFallback = Boolean(
        options?.fallback === true ||
        request.headers.get('x-turnstile-fallback') === '1' ||
        request.headers.get('x-turnstile-degraded') === '1' ||
        explicitToken === '__fallback__'
    )

    if (clientFallback && isTurnstileFailOpen()) {
        console.warn('[Turnstile Fallback] Client requested graceful fallback from IP:', clientIp)
        const clearanceToken = await createTurnstileClearanceToken(clientIp)
        let setCookieHeader = null
        if (clearanceToken) {
            setCookieHeader = `${TURNSTILE_CLEARANCE_COOKIE_NAME}=${clearanceToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TURNSTILE_CLEARANCE_MAX_AGE_SECONDS}`
        }
        return {
            ok: true,
            fallback: true,
            verified: true,
            setCookieHeader,
        }
    }

    // 3. Extract token from header or parameter
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

    // 4. Verify token with Cloudflare siteverify
    const result = await verifyTurnstileToken(token, clientIp)
    if (!result.ok) {
        return {
            ok: false,
            reason: result.reason || 'Turnstile verification failed',
            needTurnstile: true,
        }
    }

    // 5. Generate new clearance cookie
    const clearanceToken = await createTurnstileClearanceToken(clientIp)
    let setCookieHeader = null
    if (clearanceToken) {
        setCookieHeader = `${TURNSTILE_CLEARANCE_COOKIE_NAME}=${clearanceToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TURNSTILE_CLEARANCE_MAX_AGE_SECONDS}`
    }

    return {
        ok: true,
        verified: true,
        fallback: result.fallback || false,
        setCookieHeader,
    }
}
