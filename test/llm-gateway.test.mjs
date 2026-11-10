import test from 'node:test'
import assert from 'node:assert/strict'
import {
    executeLlmWithFallback,
    resetCircuitBreakers,
    getCircuitBreakerStatus,
    extractAiText,
    DEFAULT_AIURL_MODEL,
    DEFAULT_GROQ_MODEL,
    DEFAULT_CF_MODEL,
} from '../src/llm_gateway.mjs'

test('extractAiText extracts content from multiple formats correctly', () => {
    // Workers AI format
    assert.equal(extractAiText({ response: '  Hello Workers AI  ' }), 'Hello Workers AI')
    // OpenAI / Groq / aiurl format
    assert.equal(extractAiText({ choices: [{ message: { content: 'Hello OpenAI' } }] }), 'Hello OpenAI')
    // Choice with text fallback
    assert.equal(extractAiText({ choices: [{ text: 'Hello Text' }] }), 'Hello Text')
    // Direct result or string
    assert.equal(extractAiText({ result: 'Hello Result' }), 'Hello Result')
    assert.equal(extractAiText('Direct String'), 'Direct String')
    // Empty
    assert.equal(extractAiText(null), '')
    assert.equal(extractAiText({}), '')
})

test('executeLlmWithFallback falls back from Tier 1 to Tier 3 when Tier 1 fails', async () => {
    resetCircuitBreakers()

    let workersAiCalled = false
    const fakeAi = {
        run: async (model, opts) => {
            workersAiCalled = true
            assert.equal(model, DEFAULT_CF_MODEL)
            return { response: 'Output from Workers AI Tier 3' }
        }
    }

    // Pass an invalid URL for Tier 1 to force it to fail and test fallback
    const env = {
        SCN_AIURL_LLM_BASE_URL: 'https://invalid-non-existent-domain-12345.aiurl.tw',
        SCN_AIURL_LLM_API_KEY: 'test-key',
        AI: fakeAi,
    }

    const res = await executeLlmWithFallback({
        messages: [{ role: 'user', content: 'test fallback' }],
        mode: 'ask',
        env,
        timeoutMs: 1500, // Short timeout for test
    })

    assert.equal(res.text, 'Output from Workers AI Tier 3')
    assert.equal(res.tierUsed, 'workers-ai')
    assert.equal(workersAiCalled, true)

    // Check circuit breaker status: aiurl should now have recorded a failure and tripped
    const status = getCircuitBreakerStatus()
    assert.equal(status.aiurl.failures, 1)
    assert.equal(status.aiurl.state, 'OPEN')
})

test('executeLlmWithFallback bypasses tripped tier without waiting', async () => {
    // aiurl is in OPEN state from previous test
    let workersAiCalled = false
    const fakeAi = {
        run: async () => {
            workersAiCalled = true
            return { response: 'Immediate Tier 3 response' }
        }
    }

    const env = {
        SCN_AIURL_LLM_BASE_URL: 'https://invalid-non-existent-domain-12345.aiurl.tw',
        SCN_AIURL_LLM_API_KEY: 'test-key',
        AI: fakeAi,
    }

    const startTime = Date.now()
    const res = await executeLlmWithFallback({
        messages: [{ role: 'user', content: 'test bypass' }],
        mode: 'ask',
        env,
        timeoutMs: 5000,
    })
    const elapsed = Date.now() - startTime

    // Because aiurl circuit is OPEN, it should bypass aiurl immediately (< 100ms) rather than waiting for 5s timeout
    assert.ok(elapsed < 500, `Expected elapsed time < 500ms, got ${elapsed}ms`)
    assert.equal(res.text, 'Immediate Tier 3 response')
    assert.equal(res.tierUsed, 'workers-ai')
    assert.equal(workersAiCalled, true)
})

test('Single-flight coalesces identical concurrent in-flight requests', async () => {
    resetCircuitBreakers()

    let callCount = 0
    const fakeAi = {
        run: async () => {
            callCount += 1
            // Simulate 50ms delay
            await new Promise(r => setTimeout(r, 50))
            return { response: 'Coalesced Result' }
        }
    }

    const env = { AI: fakeAi }

    // Fire 3 identical requests at the same instant
    const p1 = executeLlmWithFallback({ messages: [{ role: 'user', content: 'same prompt' }], mode: 'ask', env })
    const p2 = executeLlmWithFallback({ messages: [{ role: 'user', content: 'same prompt' }], mode: 'ask', env })
    const p3 = executeLlmWithFallback({ messages: [{ role: 'user', content: 'same prompt' }], mode: 'ask', env })

    const [r1, r2, r3] = await Promise.all([p1, p2, p3])

    assert.equal(r1.text, 'Coalesced Result')
    assert.equal(r2.text, 'Coalesced Result')
    assert.equal(r3.text, 'Coalesced Result')

    // Single-flight ensures only 1 underlying LLM invocation was made
    assert.equal(callCount, 1)
})

test('Single-flight immediately cleans up failed requests so retries are not poisoned', async () => {
    resetCircuitBreakers()

    let attempts = 0
    const fakeAi = {
        run: async () => {
            attempts += 1
            if (attempts === 1) {
                throw new Error('Temporary failure on first attempt')
            }
            return { response: 'Success on retry attempt' }
        }
    }

    const env = { AI: fakeAi }

    // First call fails
    await assert.rejects(
        () => executeLlmWithFallback({ messages: [{ role: 'user', content: 'retry prompt' }], mode: 'ask', env }),
        /Temporary failure on first attempt/
    )

    // Immediate second call should NOT return the rejected promise; it must re-attempt
    const retryRes = await executeLlmWithFallback({ messages: [{ role: 'user', content: 'retry prompt' }], mode: 'ask', env })
    assert.equal(retryRes.text, 'Success on retry attempt')
    assert.equal(attempts, 2)
})

test('smart-format mode routes to dedicated format model', async () => {
    resetCircuitBreakers()

    let capturedModel = null
    const fakeAi = {
        run: async (model) => {
            capturedModel = model
            return { response: 'Formatted transcript' }
        }
    }

    const env = { AI: fakeAi }
    const res = await executeLlmWithFallback({
        messages: [{ role: 'user', content: 'audio transcript text' }],
        mode: 'smart-format',
        env,
    })

    assert.equal(res.text, 'Formatted transcript')
    assert.equal(capturedModel, '@cf/openai/gpt-oss-20b')
})

