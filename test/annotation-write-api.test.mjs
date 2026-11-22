import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { enforceAccountCsrf } from '../src/account_data.mjs'

const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')

test('annotation write routes create threads and replies with same-origin protection', () => {
    assert.match(indexSource, /router\.post\('\/api\/shares\/:shareId\/annotations'/)
    assert.match(indexSource, /router\.post\('\/api\/shares\/:shareId\/annotations\/:threadId\/messages'/)
    assert.match(indexSource, /router\.post\('\/api\/shares\/:shareId\/annotations', async request => \{\s*const context = await getWritableAnnotationContext\(request\)/)
    assert.match(indexSource, /router\.post\('\/api\/shares\/:shareId\/annotations\/:threadId\/messages', async request => \{\s*const context = await getWritableAnnotationContext\(request\)/)
    assert.match(indexSource, /async function getWritableAnnotationContext\(request\)\s*\{[\s\S]*?enforceAccountCsrf\(request\)/)
    for (const origin of [undefined, 'https://other.example', 'invalid']) {
        const headers = origin ? { Origin: origin } : {}
        assert.throws(() => enforceAccountCsrf(new Request('https://wiki.example/api/shares/id/annotations', { method: 'POST', headers })), { status: 403 })
    }
    assert.doesNotThrow(() => enforceAccountCsrf(new Request('https://wiki.example/api/shares/id/annotations', { method: 'POST', headers: { Origin: 'https://wiki.example', 'Sec-Fetch-Site': 'same-origin' } })))
    assert.throws(() => enforceAccountCsrf(new Request('https://wiki.example/api/shares/id/annotations', { method: 'POST', headers: { Origin: 'https://wiki.example', 'Sec-Fetch-Site': 'cross-site' } })), { status: 403 })
    assert.match(indexSource, /validateAnnotationDraft/)
    assert.match(indexSource, /createAnnotationThread/)
    assert.match(indexSource, /addAnnotationMessage/)
})

test('annotation writes require an enabled shared note and preserve view-password access', () => {
    assert.match(indexSource, /metadata\.share !== true/)
    assert.match(indexSource, /!resolveAnnotationsEnabled\(metadata\)/)
    assert.match(indexSource, /checkAuth\(cookie, path/)
    assert.match(indexSource, /Share password required/)
})

test('new threads reject a stale source revision', () => {
    assert.match(indexSource, /computeSourceRevision\(value\)/)
    assert.match(indexSource, /Source revision changed/)
    assert.match(indexSource, /status:\s*409/)
})

test('annotation delete routes support deleting messages and threads with permission checks', () => {
    assert.match(indexSource, /router\.delete\('\/api\/shares\/:shareId\/annotations\/:threadId\/messages\/:messageId'/)
    assert.match(indexSource, /router\.delete\('\/api\/shares\/:shareId\/annotations\/:threadId'/)
    assert.match(indexSource, /verifyAnnotationDeleteToken/)
    assert.match(indexSource, /deleteAnnotationMessage/)
    assert.match(indexSource, /deleteAnnotationThread/)
    assert.match(indexSource, /Permission denied to delete annotation/)
})
