import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import {
    resolveTurnstilePolicy,
    verifyTurnstileTokenStrict,
} from '../src/turnstile.mjs'
import { bytesToBase64Url } from '../src/webauthn_core.mjs'

const crypto = webcrypto

test('resolveTurnstilePolicy enforces tri-state precedence across flag and keys', () => {
    // 1. Explicit disabled ('0' or 'false') overrides any keys
    assert.equal(resolveTurnstilePolicy({
        SCN_ENABLE_TURNSTILE: '0',
        SCN_TURNSTILE_SITE_KEY: '0x4SITE',
        SCN_TURNSTILE_SECRET: '0x4SECRET',
    }), 'disabled')
    assert.equal(resolveTurnstilePolicy({
        SCN_ENABLE_TURNSTILE: 'false',
        SCN_TURNSTILE_SITE_KEY: '0x4SITE',
    }), 'disabled')

    // 2. Unrecognized non-empty flag -> misconfigured
    assert.equal(resolveTurnstilePolicy({
        SCN_ENABLE_TURNSTILE: 'true',
        SCN_TURNSTILE_SITE_KEY: '0x4SITE',
        SCN_TURNSTILE_SECRET: '0x4SECRET',
    }), 'misconfigured')
    assert.equal(resolveTurnstilePolicy({
        SCN_ENABLE_TURNSTILE: 'yes',
    }), 'misconfigured')

    // 3. Explicit '1' requires BOTH keys
    assert.equal(resolveTurnstilePolicy({
        SCN_ENABLE_TURNSTILE: '1',
        SCN_TURNSTILE_SITE_KEY: '0x4SITE',
        SCN_TURNSTILE_SECRET: '0x4SECRET',
    }), 'enabled')
    assert.equal(resolveTurnstilePolicy({
        SCN_ENABLE_TURNSTILE: '1',
        SCN_TURNSTILE_SITE_KEY: '0x4SITE',
    }), 'misconfigured')
    assert.equal(resolveTurnstilePolicy({
        SCN_ENABLE_TURNSTILE: '1',
        SCN_TURNSTILE_SECRET: '0x4SECRET',
    }), 'misconfigured')
    assert.equal(resolveTurnstilePolicy({
        SCN_ENABLE_TURNSTILE: '1',
    }), 'misconfigured')

    // 4. Empty/unset flag: both -> enabled, partial -> misconfigured, neither -> disabled
    assert.equal(resolveTurnstilePolicy({
        SCN_TURNSTILE_SITE_KEY: '0x4SITE',
        SCN_TURNSTILE_SECRET: '0x4SECRET',
    }), 'enabled')
    assert.equal(resolveTurnstilePolicy({
        TURNSTILE_SITE_KEY: '0x4SITE',
        TURNSTILE_SECRET: '0x4SECRET',
    }), 'enabled')
    assert.equal(resolveTurnstilePolicy({
        SCN_TURNSTILE_SITE_KEY: '0x4SITE',
    }), 'misconfigured')
    assert.equal(resolveTurnstilePolicy({
        TURNSTILE_SECRET: '0x4SECRET',
    }), 'misconfigured')
    assert.equal(resolveTurnstilePolicy({}), 'disabled')
})

test('verifyTurnstileTokenStrict handles disabled, misconfigured, and fail-closed verification', async () => {
    const originalFetch = globalThis.fetch

    try {
        let fetchCalled = false
        globalThis.fetch = async () => {
            fetchCalled = true
            throw new Error('fetch should not be called')
        }

        // Misconfigured returns misconfigured: true without calling siteverify
        const misconf = await verifyTurnstileTokenStrict('tok', '1.2.3.4', {
            expectedHostname: 'wiki.david888.com',
            expectedAction: 'passkey_register',
            env: { SCN_ENABLE_TURNSTILE: '1', SCN_TURNSTILE_SITE_KEY: '0x4SITE' },
        })
        assert.equal(misconf.ok, false)
        assert.equal(misconf.misconfigured, true)
        assert.equal(misconf.reason, 'turnstile_misconfigured')
        assert.equal(fetchCalled, false)

        // Disabled returns skipped: true without calling siteverify
        const disabled = await verifyTurnstileTokenStrict('', '1.2.3.4', {
            expectedHostname: 'wiki.david888.com',
            expectedAction: 'passkey_register',
            env: { SCN_ENABLE_TURNSTILE: '0', SCN_TURNSTILE_SITE_KEY: '0x4SITE', SCN_TURNSTILE_SECRET: '0x4SECRET' },
        })
        assert.equal(disabled.ok, true)
        assert.equal(disabled.skipped, true)
        assert.equal(fetchCalled, false)

        const enabledEnv = {
            SCN_ENABLE_TURNSTILE: '1',
            SCN_TURNSTILE_SITE_KEY: '0x4SITE',
            SCN_TURNSTILE_SECRET: '0x4SECRET',
            SCN_TURNSTILE_FAIL_OPEN: '1',
        }

        // Missing token fails closed
        const missing = await verifyTurnstileTokenStrict('   ', '1.2.3.4', {
            expectedHostname: 'wiki.david888.com',
            expectedAction: 'passkey_register',
            env: enabledEnv,
        })
        assert.equal(missing.ok, false)
        assert.equal(missing.reason, 'missing_or_invalid_token')

        // Upstream 5xx fails closed EVEN WHEN SCN_TURNSTILE_FAIL_OPEN='1'
        globalThis.SCN_TURNSTILE_FAIL_OPEN = '1'
        globalThis.fetch = async () => new Response('Bad Gateway', { status: 502 })
        const upstream502 = await verifyTurnstileTokenStrict('token-abc', '1.2.3.4', {
            expectedHostname: 'wiki.david888.com',
            expectedAction: 'passkey_register',
            env: enabledEnv,
        })
        assert.equal(upstream502.ok, false)
        assert.equal(upstream502.reason, 'siteverify_http_502')

        // Network error fails closed EVEN WHEN SCN_TURNSTILE_FAIL_OPEN='1'
        globalThis.fetch = async () => {
            throw new Error('network timeout')
        }
        const netErr = await verifyTurnstileTokenStrict('token-abc', '1.2.3.4', {
            expectedHostname: 'wiki.david888.com',
            expectedAction: 'passkey_register',
            env: enabledEnv,
        })
        assert.equal(netErr.ok, false)
        assert.equal(netErr.reason, 'network timeout')

        // outcome.success === false fails closed
        globalThis.fetch = async () => new Response(JSON.stringify({
            success: false,
            'error-codes': ['timeout-or-duplicate'],
        }), { status: 200 })
        const failedOutcome = await verifyTurnstileTokenStrict('token-abc', '1.2.3.4', {
            expectedHostname: 'wiki.david888.com',
            expectedAction: 'passkey_register',
            env: enabledEnv,
        })
        assert.equal(failedOutcome.ok, false)
        assert.equal(failedOutcome.reason, 'timeout-or-duplicate')

        // Hostname mismatch fails closed
        globalThis.fetch = async () => new Response(JSON.stringify({
            success: true,
            hostname: 'evil.example.com',
            action: 'passkey_register',
        }), { status: 200 })
        const badHost = await verifyTurnstileTokenStrict('token-abc', '1.2.3.4', {
            expectedHostname: 'wiki.david888.com',
            expectedAction: 'passkey_register',
            env: enabledEnv,
        })
        assert.equal(badHost.ok, false)
        assert.equal(badHost.reason, 'hostname_mismatch')

        // Action mismatch fails closed
        globalThis.fetch = async () => new Response(JSON.stringify({
            success: true,
            hostname: 'wiki.david888.com',
            action: 'other_action',
        }), { status: 200 })
        const badAction = await verifyTurnstileTokenStrict('token-abc', '1.2.3.4', {
            expectedHostname: 'wiki.david888.com',
            expectedAction: 'passkey_register',
            env: enabledEnv,
        })
        assert.equal(badAction.ok, false)
        assert.equal(badAction.reason, 'action_mismatch')

        // Valid response returns ok: true and deterministic tokenHash
        globalThis.fetch = async () => new Response(JSON.stringify({
            success: true,
            hostname: 'WIKI.DAVID888.COM',
            action: 'passkey_register',
        }), { status: 200 })
        const okRes = await verifyTurnstileTokenStrict('  token-abc  ', '1.2.3.4', {
            expectedHostname: 'wiki.david888.com',
            expectedAction: 'passkey_register',
            env: enabledEnv,
        })
        assert.equal(okRes.ok, true)
        const expectedHash = bytesToBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('token-abc'))))
        assert.equal(okRes.tokenHash, expectedHash)
    } finally {
        globalThis.fetch = originalFetch
        delete globalThis.SCN_TURNSTILE_FAIL_OPEN
    }
})
