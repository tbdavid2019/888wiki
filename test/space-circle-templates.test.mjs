import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

import { ALL_PREVIEW_THEMES, DARK_PREVIEW_THEMES } from '../src/constant.js'
import { Space, SPACE_CSP, SPACE_TURNSTILE_CSP, SPACE_SECURITY_HEADERS, buildSpacesCirclesCsp } from '../src/templates/space.js'
import { Circle, CIRCLE_CSP, CIRCLE_SECURITY_HEADERS } from '../src/templates/circle.js'

import {
    base64UrlToUint8Array,
    base64UrlToArrayBuffer,
    arrayBufferToBase64Url,
    isEmbeddedWebView,
} from '../static/js/account-auth.mjs'
import {
    normalizeGuestShareUrl,
    collectGuestShareHistoryCandidates,
    readLocalDeviceDrafts,
} from '../static/js/account-space.mjs'
import { openCirclePicker } from '../static/js/account-circle-picker.mjs'

function extractBootstrapJson(html, id) {
    const dom = new JSDOM(html)
    const el = dom.window.document.getElementById(id)
    assert.ok(el, `Expected JSON bootstrap tag #${id}`)
    assert.equal(el.getAttribute('type'), 'application/json')
    return JSON.parse(el.textContent)
}

function assertNoInlineExecutableScriptsAndNoTrackers(html, label) {
    assert.doesNotMatch(html, /webtalk\.js/i, `${label}: must not include webtalk.js`)
    assert.doesNotMatch(html, /googletagmanager\.com/i, `${label}: must not include GA`)
    assert.doesNotMatch(html, /flow\.aiurl\.tw/i, `${label}: must not include flow tracker`)
    assert.match(html, /<meta name="robots" content="noindex, nofollow" \/>/, `${label}: must include noindex, nofollow`)
    assert.match(html, /<meta name="referrer" content="no-referrer" \/>/, `${label}: must include no-referrer`)

    const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || []
    for (const s of scripts) {
        if (/type=["']application\/json["']/i.test(s)) continue
        const tagOpen = s.match(/<script[^>]*>/i)?.[0] || ''
        const code = s.replace(/<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim()
        if (/\bsrc=/.test(tagOpen)) {
            assert.equal(code, '', `${label}: external script tag should have no inline code`)
            continue
        }
        // Should have zero inline executable scripts for strict CSP
        assert.equal(code, '', `${label}: must not emit inline executable JS for strict CSP`)
        if (code) {
            new Function(code)
        }
    }
}

test('Space template renders securely across all 20 light/dark themes with strict CSP and no leaks', () => {
    for (const theme of ALL_PREVIEW_THEMES) {
        const html = Space({
            lang: 'zh-TW',
            theme,
            authenticated: true,
            account: { nickname: 'Alice<script>alert(1)</script>' },
            passkeys: [{ credentialId: 'cred-1', deviceLabel: 'MacBook<img onerror=alert(1)>', backupEligible: true, createdAt: 1700000000 }],
            items: [
                {
                    itemKey: 'k-edit',
                    accessLevel: 'edit',
                    notePath: 'my-secret-edit-path',
                    noteUid: 'uid-1',
                    editorFormat: 'markdown',
                    titleSummary: 'My Editable Note',
                    facets: ['created', 'edited'],
                    isBurnProtected: true,
                    shareId: 'csprngShare123456789012',
                },
                {
                    itemKey: 'k-share-only',
                    accessLevel: 'share_only',
                    notePath: 'LEAKED_INTERNAL_PATH_SHOULD_BE_STRIPPED',
                    noteUid: 'LEAKED_UID_SHOULD_BE_STRIPPED',
                    accountId: 'acc_secret_123',
                    editorFormat: 'block',
                    titleSummary: 'Shared Reading Note',
                    facets: ['bookmarked'],
                    shareId: 'csprngShareOther987654',
                },
                {
                    itemKey: 'k-masked',
                    masked: true,
                    notePath: 'MASKED_PATH_MUST_NOT_LEAK',
                    editorFormat: 'canvas',
                    protectionBadge: 'vpw',
                    titleSummary: 'Secret Title Must Not Leak',
                },
            ],
            circles: [{ id: 'c1', name: 'AI Circle', publicToken: 'pubTok123', isEnabled: true, itemCount: 2 }],
        })

        assertNoInlineExecutableScriptsAndNoTrackers(html, `Space(${theme})`)

        const expectedUiTheme = DARK_PREVIEW_THEMES.includes(theme) ? 'dark' : 'auto'
        assert.match(html, new RegExp(`data-preview-theme="${theme}"`))
        assert.match(html, new RegExp(`data-ui-theme="${expectedUiTheme}"`))
        assert.doesNotMatch(html, /LEAKED_INTERNAL_PATH_SHOULD_BE_STRIPPED/)
        assert.doesNotMatch(html, /LEAKED_UID_SHOULD_BE_STRIPPED/)
        assert.doesNotMatch(html, /acc_secret_123/)
        assert.doesNotMatch(html, /MASKED_PATH_MUST_NOT_LEAK/)
        assert.doesNotMatch(html, /Secret Title Must Not Leak/)
        assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
        assert.doesNotMatch(html, /<img onerror=alert\(1\)>/)

        const bootstrap = extractBootstrapJson(html, 'space-bootstrap')
        assert.equal(bootstrap.items.length, 3)
        assert.equal(bootstrap.items[0].notePath, 'my-secret-edit-path')
        assert.equal(bootstrap.items[1].notePath, undefined)
        assert.equal(bootstrap.items[1].noteUid, undefined)
        assert.equal(bootstrap.items[1].accountId, undefined)
        assert.deepEqual(bootstrap.items[2], {
            masked: true,
            itemKey: 'k-masked',
            accessLevel: 'share_only',
            title: 'Unavailable or Protected Note',
            editorFormat: null,
            protectionBadge: null,
            actions: ['remove'],
        })
    }
})

test('Space template renders unauthenticated Passkey warning, Turnstile mount, filters, local-draft notice, and pure-KV disabled state', () => {
    const unauthHtml = Space({
        lang: 'en-US',
        authenticated: false,
        turnstileEnabled: true,
        turnstileSiteKey: '0x4AAAAAAATestKey',
    })
    assertNoInlineExecutableScriptsAndNoTrackers(unauthHtml, 'Space(unauth)')
    assert.match(unauthHtml, /Important: No Account Recovery in v1/)
    assert.match(unauthHtml, /id="webview-warning-banner"/)
    assert.match(unauthHtml, /id="space-turnstile-container"/)
    assert.match(unauthHtml, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/)
    assert.match(unauthHtml, /Device-local only, not synced to cloud/)
    assert.match(unauthHtml, /id="guest-import-modal"/)
    assert.match(unauthHtml, /data-facet="created"/)
    assert.match(unauthHtml, /data-facet="annotated"/)
    assert.match(unauthHtml, /data-format="whiteboard"/)

    const disabledHtml = Space({ lang: 'zh-TW', accountEnabled: false })
    assert.match(disabledHtml, /id="space-disabled-notice"/)
    assert.doesNotMatch(disabledHtml, /id="space-auth-section"/)
})

test('CSP helpers enforce strict non-inline script-src and frame/object/base-uri guards', () => {
    assert.equal(SPACE_SECURITY_HEADERS['Cache-Control'], 'no-store')
    assert.equal(SPACE_SECURITY_HEADERS['X-Robots-Tag'], 'noindex, nofollow')
    assert.equal(SPACE_SECURITY_HEADERS['Referrer-Policy'], 'no-referrer')
    assert.equal(CIRCLE_SECURITY_HEADERS['Cache-Control'], 'no-store')

    assert.match(SPACE_CSP, /script-src 'self'/)
    assert.doesNotMatch(SPACE_CSP, /unsafe-inline.*script-src|script-src[^;]*unsafe-inline/)
    assert.doesNotMatch(SPACE_CSP, /unsafe-eval/)
    assert.match(SPACE_CSP, /object-src 'none'/)
    assert.match(SPACE_CSP, /base-uri 'none'/)
    assert.match(SPACE_CSP, /frame-ancestors 'none'/)

    assert.match(SPACE_TURNSTILE_CSP, /script-src 'self' https:\/\/challenges\.cloudflare\.com/)
    assert.match(CIRCLE_CSP, /script-src 'self';/)
    assert.equal(buildSpacesCirclesCsp({ allowTurnstile: false }), CIRCLE_CSP)
})

test('Circle template renders public canonical share links with zero account_id/note_path leaks and clean empty/owner preview states', () => {
    const html = Circle({
        lang: 'en-US',
        theme: 'tokyo-night',
        isOwnerPreview: true,
        circle: { name: 'Curated<script>x</script>', publicToken: 'pub123456', isEnabled: false, accountId: 'acc_secret_999' },
        items: [
            { shareId: 'validToken123456789012', titleSummary: 'Good Note', editorFormat: 'canvas', notePath: 'secret-path', noteUid: 'uid-999', accountId: 'acc_secret_999', updatedAt: 1700000000 },
            { shareId: '../bad/path', titleSummary: 'Bad Path Item', editorFormat: 'markdown' },
        ],
    })

    assertNoInlineExecutableScriptsAndNoTrackers(html, 'Circle(ownerPreview)')
    assert.match(html, /data-preview-theme="tokyo-night"/)
    assert.match(html, /data-ui-theme="dark"/)
    assert.match(html, /Owner Preview:/)
    assert.match(html, /href="\/share\/validToken123456789012"/)
    assert.doesNotMatch(html, /acc_secret_999/)
    assert.doesNotMatch(html, /secret-path/)
    assert.doesNotMatch(html, /uid-999/)
    assert.doesNotMatch(html, /Bad Path Item/)
    assert.doesNotMatch(html, /<script>x<\/script>/)

    const emptyHtml = Circle({
        lang: 'zh-TW',
        circle: { name: 'Empty Circle', publicToken: 'pubEmpty', isEnabled: true },
        items: [],
    })
    assertNoInlineExecutableScriptsAndNoTrackers(emptyHtml, 'Circle(empty)')
    assert.match(emptyHtml, /此分享圈目前沒有公開內容/)
})

test('static/sw.js bumps CACHE_NAME to v9 and bypasses Cache Storage before image/navigate/static branches', async () => {
    const swSource = readFileSync(new URL('../static/sw.js', import.meta.url), 'utf8')
    assert.match(swSource, /const CACHE_NAME = 'david888-wiki-shell-v9'/)

    const listeners = {}
    const cacheCalls = []
    const fetchCalls = []
    const selfMock = {
        location: { origin: 'https://wiki.david888.com' },
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]) },
        addEventListener: (type, fn) => { listeners[type] = fn },
    }
    const cachesMock = {
        open: async name => {
            cacheCalls.push(['open', name])
            return {
                match: async req => { cacheCalls.push(['match', req.url]); return null },
                put: async () => {},
                addAll: async () => {},
                keys: async () => [],
            }
        },
        match: async req => { cacheCalls.push(['caches.match', req.url || req]); return null },
        keys: async () => [],
        delete: async () => true,
    }

    const sandbox = {
        self: selfMock,
        caches: cachesMock,
        fetch: async req => {
            fetchCalls.push(req.url)
            return new Response('ok', { status: 200 })
        },
        URL,
        Response,
        Promise,
    }
    vm.runInNewContext(swSource, sandbox)
    assert.equal(typeof listeners.fetch, 'function')

    const bypassUrls = [
        { url: 'https://wiki.david888.com/_space', mode: 'navigate', destination: 'document' },
        { url: 'https://wiki.david888.com/_space/avatar.png?v=1', mode: 'no-cors', destination: 'image' },
        { url: 'https://wiki.david888.com/c', mode: 'navigate', destination: 'document' },
        { url: 'https://wiki.david888.com/c/token123', mode: 'navigate', destination: 'document' },
        { url: 'https://wiki.david888.com/c/token123/banner.png', mode: 'no-cors', destination: 'image' },
        { url: 'https://wiki.david888.com/api/auth/passkey/login/options', mode: 'cors', destination: '' },
        { url: 'https://wiki.david888.com/api/account/me', mode: 'cors', destination: '' },
        { url: 'https://wiki.david888.com/api/space/items', mode: 'cors', destination: '' },
        { url: 'https://wiki.david888.com/api/circles/abc/cover.jpg', mode: 'no-cors', destination: 'image' },
    ]

    for (const item of bypassUrls) {
        cacheCalls.length = 0
        fetchCalls.length = 0
        let responded = false
        listeners.fetch({
            request: { method: 'GET', url: item.url, mode: item.mode, destination: item.destination },
            respondWith: () => { responded = true },
        })
        assert.equal(responded, false, `Expected SW to bypass respondWith for ${item.url}`)
        assert.equal(cacheCalls.length, 0, `Expected zero cache calls for ${item.url}`)
    }

    // Verify normal static asset still hits SW handler
    let staticResponded = false
    listeners.fetch({
        request: { method: 'GET', url: 'https://wiki.david888.com/js/account-space.mjs', mode: 'cors', destination: 'script' },
        respondWith: p => { staticResponded = true; Promise.resolve(p).catch(() => {}) },
    })
    assert.equal(staticResponded, true, 'Normal static asset should still be handled by SW')
})

test('account-auth.mjs base64url helpers and WebView detection work accurately', () => {
    const sample = new Uint8Array([0, 1, 255, 128, 63, 42])
    const b64u = arrayBufferToBase64Url(sample)
    assert.doesNotMatch(b64u, /[+/=]/)
    assert.deepEqual(base64UrlToUint8Array(b64u), sample)
    assert.deepEqual(new Uint8Array(base64UrlToArrayBuffer(b64u)), sample)

    assert.equal(isEmbeddedWebView('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.0.0'), true)
    assert.equal(isEmbeddedWebView('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Instagram 310.0.0'), true)
    assert.equal(isEmbeddedWebView('Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UQ1A; wv) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'), true)
    assert.equal(isEmbeddedWebView('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'), false)
    assert.equal(isEmbeddedWebView('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'), false)
})

test('account-space.mjs guest share history normalizer enforces same-origin, strips present/book, rejects query credentials, and caps at 50', () => {
    const origin = 'https://wiki.david888.com'
    assert.deepEqual(
        normalizeGuestShareUrl('https://wiki.david888.com/share/abcDEF123456/present#slide=2', origin),
        { shareId: 'abcDEF123456', normalizedUrl: 'https://wiki.david888.com/share/abcDEF123456' },
    )
    assert.deepEqual(
        normalizeGuestShareUrl('/share/xyz987/book', origin),
        { shareId: 'xyz987', normalizedUrl: 'https://wiki.david888.com/share/xyz987' },
    )
    assert.equal(normalizeGuestShareUrl('https://evil.example.com/share/abc123', origin), null)
    assert.equal(normalizeGuestShareUrl('https://wiki.david888.com/share/abc123?pw=secret', origin), null)
    assert.equal(normalizeGuestShareUrl('https://user:pass@wiki.david888.com/share/abc123', origin), null)

    const createdList = Array.from({ length: 35 }, (_, i) => ({
        url: `${origin}/share/created${i}`,
        title: `Created ${i}`,
        savedAt: 2000 + i,
    }))
    const viewedList = Array.from({ length: 30 }, (_, i) => ({
        url: `${origin}/share/viewed${i}/present`,
        title: `Viewed ${i}`,
        savedAt: 1000 + i,
    }))
    const mockStorage = {
        getItem(k) {
            if (k === 'cf-notepad:share-history:created') return JSON.stringify(createdList)
            if (k === 'cf-notepad:share-history:viewed') return JSON.stringify(viewedList)
            return null
        },
    }
    const candidates = collectGuestShareHistoryCandidates({ origin, storage: mockStorage })
    assert.equal(candidates.length, 50)
    assert.equal(candidates[0].source, 'created')

    const drafts = readLocalDeviceDrafts({ getAllNotesMetadata: () => [{ path: 'draft-1', title: 'Local' }] })
    assert.equal(drafts.length, 1)
    assert.equal(drafts[0].path, 'draft-1')
})

test('account-circle-picker.mjs saves private bookmark first, leaves circles unchecked, and handles LEGACY_TOKEN_INELIGIBLE', async () => {
    const dom = new JSDOM('<!DOCTYPE html><html lang="zh-TW"><body></body></html>', { url: 'https://wiki.david888.com/share/legacy1' })
    const prevWindow = globalThis.window
    const prevDocument = globalThis.document
    const prevFetch = globalThis.fetch
    const prevCustomEvent = globalThis.CustomEvent

    globalThis.window = dom.window
    globalThis.document = dom.window.document
    globalThis.CustomEvent = dom.window.CustomEvent

    const calls = []
    globalThis.fetch = async (url, init = {}) => {
        calls.push({ url, method: init.method || 'GET', body: init.body })
        if (url === '/api/account/me') {
            return new Response(JSON.stringify({ authenticated: true, account: { nickname: 'Tester' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        if (url === '/api/space/bookmark') {
            return new Response(JSON.stringify({ item: { itemKey: 'ik_1', shareId: 'legacy1', accessLevel: 'share_only' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        if (url === '/api/circles') {
            return new Response(JSON.stringify({ circles: [{ id: 'c1', name: 'Public Notes', isEnabled: true, itemCount: 3 }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        if (url === '/api/circles/c1/items') {
            return new Response(JSON.stringify({ code: 'LEGACY_TOKEN_INELIGIBLE', error: 'Legacy token cannot be added to public circles' }), { status: 422, headers: { 'Content-Type': 'application/json' } })
        }
        return new Response('{}', { status: 404 })
    }

    try {
        const res = await openCirclePicker({ shareId: 'legacy1', titleSummary: 'Legacy Share' })
        assert.equal(res.authenticated, true)
        assert.deepEqual(calls.map(c => c.url), ['/api/account/me', '/api/space/bookmark', '/api/circles'])

        const checkboxes = dom.window.document.querySelectorAll('#cf-circle-picker-modal input[type="checkbox"]')
        assert.equal(checkboxes.length, 1)
        assert.equal(checkboxes[0].checked, false, 'Circles MUST be unchecked by default')

        checkboxes[0].checked = true
        const addBtn = Array.from(dom.window.document.querySelectorAll('#cf-circle-picker-modal button')).find(b => b.textContent.includes('加入'))
        assert.ok(addBtn)
        addBtn.click()
        await new Promise(r => setTimeout(r, 30))

        assert.ok(calls.some(c => c.url === '/api/circles/c1/items'))
        const modalText = dom.window.document.getElementById('cf-circle-picker-modal').textContent
        assert.match(modalText, /已私密收藏至 \/_space/)
    } finally {
        globalThis.window = prevWindow
        globalThis.document = prevDocument
        globalThis.fetch = prevFetch
        globalThis.CustomEvent = prevCustomEvent
    }
})
