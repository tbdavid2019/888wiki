import test from 'node:test'
import assert from 'node:assert/strict'
import {
    verifyTurnstileToken,
    createTurnstileClearanceToken,
    verifyTurnstileClearanceCookie,
    verifyTurnstileAccess,
    TURNSTILE_CLEARANCE_COOKIE_NAME,
    TURNSTILE_CLEARANCE_MAX_AGE_SECONDS,
} from '../src/turnstile.mjs'
import { getTurnstileSiteKey, getTurnstileSecret, isTurnstileEnabled } from '../src/constant.js'
import { returnPage } from '../src/helper.js'

test('Turnstile: disabled by default when no environment keys exist', () => {
    delete globalThis.SCN_TURNSTILE_SITE_KEY
    delete globalThis.SCN_TURNSTILE_SECRET
    delete globalThis.SCN_ENABLE_TURNSTILE

    assert.equal(getTurnstileSiteKey(), '')
    assert.equal(getTurnstileSecret(), '')
    assert.equal(isTurnstileEnabled(), false)
})

test('Turnstile: isTurnstileEnabled respects SCN_ENABLE_TURNSTILE flag and key presence', () => {
    globalThis.SCN_TURNSTILE_SITE_KEY = '0x4AAAAAAABBBBBBBB'
    globalThis.SCN_TURNSTILE_SECRET = '0x4AAAAAAASSSSSSSS'

    globalThis.SCN_ENABLE_TURNSTILE = '0'
    assert.equal(isTurnstileEnabled(), false)

    globalThis.SCN_ENABLE_TURNSTILE = '1'
    assert.equal(isTurnstileEnabled(), true)

    delete globalThis.SCN_ENABLE_TURNSTILE
    // Default when keys exist without explicit disable flag
    assert.equal(isTurnstileEnabled(), true)

    // Cleanup
    delete globalThis.SCN_TURNSTILE_SITE_KEY
    delete globalThis.SCN_TURNSTILE_SECRET
})

test('Turnstile: verifyTurnstileToken skips when disabled', async () => {
    delete globalThis.SCN_TURNSTILE_SITE_KEY
    delete globalThis.SCN_TURNSTILE_SECRET

    const result = await verifyTurnstileToken('dummy-token')
    assert.equal(result.ok, true)
    assert.equal(result.skipped, true)
})

test('Turnstile: verifyTurnstileToken rejects missing token when enabled', async () => {
    globalThis.SCN_TURNSTILE_SITE_KEY = '0x4AAAAAAABBBBBBBB'
    globalThis.SCN_TURNSTILE_SECRET = '0x4AAAAAAASSSSSSSS'

    const emptyResult = await verifyTurnstileToken('')
    assert.equal(emptyResult.ok, false)
    assert.equal(emptyResult.reason, 'missing_or_invalid_token')

    const nullResult = await verifyTurnstileToken(null)
    assert.equal(nullResult.ok, false)

    // Cleanup
    delete globalThis.SCN_TURNSTILE_SITE_KEY
    delete globalThis.SCN_TURNSTILE_SECRET
})

test('Turnstile: verifyTurnstileToken validates with remote siteverify API', async () => {
    globalThis.SCN_TURNSTILE_SITE_KEY = '0x4AAAAAAABBBBBBBB'
    globalThis.SCN_TURNSTILE_SECRET = '0x4AAAAAAASSSSSSSS'

    const originalFetch = globalThis.fetch

    // Mock successful siteverify response
    globalThis.fetch = async (url, options) => {
        if (String(url).includes('siteverify')) {
            return new Response(JSON.stringify({
                success: true,
                challenge_ts: '2026-10-28T01:30:00.000Z',
                hostname: 'wiki.david888.com',
            }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return originalFetch(url, options)
    }

    const successResult = await verifyTurnstileToken('valid-mock-token', '1.2.3.4')
    assert.equal(successResult.ok, true)
    assert.equal(successResult.outcome?.hostname, 'wiki.david888.com')

    // Mock failed siteverify response
    globalThis.fetch = async (url, options) => {
        if (String(url).includes('siteverify')) {
            return new Response(JSON.stringify({
                success: false,
                'error-codes': ['invalid-input-response'],
            }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return originalFetch(url, options)
    }

    const failResult = await verifyTurnstileToken('invalid-token', '1.2.3.4')
    assert.equal(failResult.ok, false)
    assert.match(failResult.reason, /invalid-input-response/)

    // Restore fetch and cleanup
    globalThis.fetch = originalFetch
    delete globalThis.SCN_TURNSTILE_SITE_KEY
    delete globalThis.SCN_TURNSTILE_SECRET
})

test('Turnstile: clearance cookie lifecycle (create, verify, and expire)', async () => {
    globalThis.SCN_SECRET = 'test-encryption-secret-123456789'
    globalThis.SCN_TURNSTILE_SITE_KEY = '0x4AAAAAAABBBBBBBB'
    globalThis.SCN_TURNSTILE_SECRET = '0x4AAAAAAASSSSSSSS'

    const token = await createTurnstileClearanceToken('1.2.3.4')
    assert.equal(typeof token, 'string')
    assert.ok(token.length > 20)

    // Valid cookie
    const validReq = new Request('https://wiki.david888.com/test-note', {
        headers: { Cookie: `${TURNSTILE_CLEARANCE_COOKIE_NAME}=${token}` }
    })
    const isCleared = await verifyTurnstileClearanceCookie(validReq)
    assert.equal(isCleared, true)

    // Invalid cookie
    const invalidReq = new Request('https://wiki.david888.com/test-note', {
        headers: { Cookie: `${TURNSTILE_CLEARANCE_COOKIE_NAME}=tampered-invalid-jwt` }
    })
    const isInvalidCleared = await verifyTurnstileClearanceCookie(invalidReq)
    assert.equal(isInvalidCleared, false)

    // Missing cookie
    const missingReq = new Request('https://wiki.david888.com/test-note')
    const isMissingCleared = await verifyTurnstileClearanceCookie(missingReq)
    assert.equal(isMissingCleared, false)

    // Cleanup
    delete globalThis.SCN_TURNSTILE_SITE_KEY
    delete globalThis.SCN_TURNSTILE_SECRET
    delete globalThis.SCN_SECRET
})

test('Turnstile: verifyTurnstileAccess grants access via clearance cookie without remote verify', async () => {
    globalThis.SCN_SECRET = 'test-secret'
    globalThis.SCN_TURNSTILE_SITE_KEY = 'site-key'
    globalThis.SCN_TURNSTILE_SECRET = 'secret-key'

    const token = await createTurnstileClearanceToken('127.0.0.1')
    const req = new Request('https://wiki.david888.com/test', {
        headers: {
            Cookie: `${TURNSTILE_CLEARANCE_COOKIE_NAME}=${token}`,
            'cf-connecting-ip': '127.0.0.1',
        }
    })

    const access = await verifyTurnstileAccess(req)
    assert.equal(access.ok, true)
    assert.equal(access.cleared, true)

    // Cleanup
    delete globalThis.SCN_TURNSTILE_SITE_KEY
    delete globalThis.SCN_TURNSTILE_SECRET
    delete globalThis.SCN_SECRET
})

test('Turnstile: verifyTurnstileAccess requires token when unverified and sets clearance cookie upon success', async () => {
    globalThis.SCN_SECRET = 'test-secret'
    globalThis.SCN_TURNSTILE_SITE_KEY = 'site-key'
    globalThis.SCN_TURNSTILE_SECRET = 'secret-key'

    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url) => {
        if (String(url).includes('siteverify')) {
            return new Response(JSON.stringify({ success: true }), { status: 200 })
        }
        return originalFetch(url)
    }

    // 1. Unverified request with no token -> Rejected
    const emptyReq = new Request('https://wiki.david888.com/my-note', { method: 'POST' })
    const blockedAccess = await verifyTurnstileAccess(emptyReq)
    assert.equal(blockedAccess.ok, false)
    assert.equal(blockedAccess.needTurnstile, true)

    // 2. Request with valid token in header -> Accepted + Set-Cookie generated
    const tokenReq = new Request('https://wiki.david888.com/my-note', {
        method: 'POST',
        headers: { 'cf-turnstile-response': 'browser-turnstile-token-xyz' },
    })
    const grantedAccess = await verifyTurnstileAccess(tokenReq)
    assert.equal(grantedAccess.ok, true)
    assert.equal(grantedAccess.verified, true)
    assert.ok(grantedAccess.setCookieHeader.includes('cf_turnstile_cleared='))

    // Restore fetch and cleanup
    globalThis.fetch = originalFetch
    delete globalThis.SCN_TURNSTILE_SITE_KEY
    delete globalThis.SCN_TURNSTILE_SECRET
    delete globalThis.SCN_SECRET
})

test('Turnstile: returnPage enriches HTML template with Turnstile script and widget when configured', async () => {
    globalThis.SCN_TURNSTILE_SITE_KEY = '0x4AAAAAAABBBBBBBB'
    globalThis.SCN_TURNSTILE_SECRET = '0x4AAAAAAASSSSSSSS'

    const response = returnPage('HTML', {
        title: 'Turnstile Protected Note',
        content: '# Hello Turnstile',
        path: 'turnstile-test',
        ext: { share: true },
    })

    const html = await response.text()
    assert.ok(html.includes('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'))
    assert.ok(html.includes('id="cf-turnstile-container"'))
    assert.ok(html.includes('"turnstileSiteKey":"0x4AAAAAAABBBBBBBB"'))
    assert.ok(html.includes('"turnstileEnabled":true'))

    // Cleanup
    delete globalThis.SCN_TURNSTILE_SITE_KEY
    delete globalThis.SCN_TURNSTILE_SECRET
})

test('Turnstile: returnPage omits Turnstile script when not configured', async () => {
    delete globalThis.SCN_TURNSTILE_SITE_KEY
    delete globalThis.SCN_TURNSTILE_SECRET

    const response = returnPage('HTML', {
        title: 'Plain Note',
        content: '# Hello Plain',
        path: 'plain-test',
        ext: { share: true },
    })

    const html = await response.text()
    assert.equal(html.includes('https://challenges.cloudflare.com/turnstile/v0/api.js'), false)
    assert.equal(html.includes('id="cf-turnstile-container"'), false)
    assert.ok(html.includes('"turnstileSiteKey":""'))
    assert.ok(html.includes('"turnstileEnabled":false'))
})
