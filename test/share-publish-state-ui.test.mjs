import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { HTML } from '../src/templates/base.js'

const commonTemplateSource = readFileSync(new URL('../src/templates/common.js', import.meta.url), 'utf8')
const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')

test('share menu renders both states so publishing can update it without reload', () => {
    assert.match(commonTemplateSource, /class="share-menu-published"/)
    assert.match(commonTemplateSource, /class="share-menu-unpublished"/)
    assert.match(commonTemplateSource, /share-menu-published" \$\{share && shareId \? '' : 'hidden'\}/)
    assert.match(commonTemplateSource, /share-menu-unpublished" \$\{share && shareId \? 'hidden' : ''\}/)
})

test('publishing synchronizes the live share id and menu state', () => {
    assert.match(baseTemplateSource, /const nextShareId = typeof res\.data === 'string' \? res\.data\.trim\(\) : ''/)
    assert.match(baseTemplateSource, /APP_STATE\.shareId = nextShareId/)
    assert.match(baseTemplateSource, /function syncShareMenuUI\(\)/)
    assert.match(baseTemplateSource, /syncShareMenuUI\(\)/)
    assert.match(baseTemplateSource, /share-menu-published.*hidden/s)
    assert.match(baseTemplateSource, /share-menu-unpublished.*hidden/s)
})

test('share actions derive URLs from the current share id instead of a stale page-load link', () => {
    assert.match(baseTemplateSource, /function getCurrentShareUrl\(\)/)
    assert.match(baseTemplateSource, /if \(!APP_STATE\.shareId\) return ''/)
    assert.match(baseTemplateSource, /encodeURIComponent\(APP_STATE\.shareId\)/)
    assert.match(baseTemplateSource, /const shareUrl = getCurrentShareUrl\(\)/)
    assert.match(baseTemplateSource, /const presentationUrl = getCurrentShareUrl\(\)/)
    assert.doesNotMatch(baseTemplateSource, /const shareUrl = new URL\(\$shareOpenLink\.getAttribute/)
    assert.doesNotMatch(commonTemplateSource, /href="\/share\/\$\{shareId\}"/)
})

test('share URL helper is hoisted before initial UI synchronization and Markdown rendering', () => {
    const helperIndex = baseTemplateSource.indexOf('function getCurrentShareUrl()')
    const startupSyncIndex = baseTemplateSource.indexOf('setupShareHistory()\n        syncShareStateUI()')

    assert.notEqual(helperIndex, -1)
    assert.notEqual(startupSyncIndex, -1)
    assert.ok(helperIndex < startupSyncIndex)
})

test('publishing normalizes setting path, retries transient network fetch errors, and formats offline/network errors cleanly', async () => {
    assert.match(baseTemplateSource, /const getNormalizedPathname = \(\) =>/)
    assert.match(baseTemplateSource, /const getSettingPath = \(\) => APP_STATE\.settingPath \|\| \(getNormalizedPathname\(\) \+ '\/setting'\)/)
    assert.match(baseTemplateSource, /return fetchJson\(getSettingPath\(\), \{[\s\S]*?\}, 30000, \{ retries: 1 \}\)/)
    assert.match(baseTemplateSource, /let publishInFlight = null/)
    assert.match(baseTemplateSource, /\$publishNudgePublish\.addEventListener\('click', async \(\) => \{[\s\S]*?await publishCurrentNote\(preferences\)/)

    const html = HTML({
        lang: 'zh-TW',
        title: 'Publish test',
        content: '# Hello',
        ext: {},
        isEdit: true,
        path: 'pub-test',
    })
    const editorScript = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
        .find(match => match[2].includes('const fetchJson ='))
    assert.ok(editorScript)

    const sliceStart = editorScript[2].indexOf('const isTransportNetworkError =')
    const sliceEnd = editorScript[2].indexOf('const initWebMcp =')
    assert.ok(sliceStart !== -1 && sliceEnd > sliceStart)
    const helperSnippet = editorScript[2].slice(sliceStart, sliceEnd)

    let fetchCalls = 0
    let online = true
    let mockFetchImpl = async () => ({ text: async () => '{"err":0,"data":"ok"}' })
    const sandbox = {
        APP_STATE: { lang: 'zh-TW' },
        AbortController,
        navigator: { get onLine() { return online } },
        window: {
            fetch: (...args) => {
                fetchCalls += 1
                return mockFetchImpl(...args)
            },
            setTimeout,
            clearTimeout,
        },
        getI18n: key => key,
    }
    const exportsObj = vm.runInNewContext(
        helperSnippet + '\n;({ isTransportNetworkError, isGatewayOrTimeoutError, formatPublishNetworkError, summarizeErrorText, parseJsonResponse, fetchJson })',
        sandbox,
    )

    assert.equal(exportsObj.summarizeErrorText('a   \n  b'), 'a b')

    // 1. Retries once on transient TypeError when online and succeeds
    fetchCalls = 0
    online = true
    mockFetchImpl = async () => {
        if (fetchCalls === 1) throw new TypeError('Failed to fetch')
        return { status: 200, text: async () => '{"err":0,"data":"abc"}' }
    }
    const retriedRes = await exportsObj.fetchJson('/pub-test/setting', { method: 'POST' }, 5000, { retries: 1, retryDelayMs: 1 })
    assert.equal(fetchCalls, 2)
    assert.equal(retriedRes.data, 'abc')

    // 2. Does not retry when offline
    fetchCalls = 0
    online = false
    mockFetchImpl = async () => { throw new TypeError('Failed to fetch') }
    await assert.rejects(
        () => exportsObj.fetchJson('/pub-test/setting', { method: 'POST' }, 5000, { retries: 1, retryDelayMs: 1 }),
        /Failed to fetch/,
    )
    assert.equal(fetchCalls, 1)

    // 3. Does not retry when HTTP response was already received (e.g. 502 HTML)
    fetchCalls = 0
    online = true
    mockFetchImpl = async () => ({ status: 502, text: async () => '<html>Bad Gateway</html>' })
    await assert.rejects(
        () => exportsObj.fetchJson('/pub-test/setting', { method: 'POST' }, 5000, { retries: 1, retryDelayMs: 1 }),
        /HTTP 502/,
    )
    assert.equal(fetchCalls, 1)

    // 4. Does not retry on request timeout
    fetchCalls = 0
    mockFetchImpl = (_url, init) => new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason))
    })
    await assert.rejects(
        () => exportsObj.fetchJson('/pub-test/setting', { method: 'POST' }, 15, { retries: 1, retryDelayMs: 1 }),
        /Request timeout/,
    )
    assert.equal(fetchCalls, 1)

    // 5. Formats network / gateway / offline errors cleanly while passing through normal errors
    online = false
    assert.match(exportsObj.formatPublishNetworkError(new TypeError('Failed to fetch'), { localSaved: true }), /本機離線草稿/)
    online = true
    assert.match(exportsObj.formatPublishNetworkError(new TypeError('Failed to fetch'), { localSaved: false }), /目前編輯器中/)
    assert.match(exportsObj.formatPublishNetworkError(new Error('HTTP 502 - Bad Gateway'), { localSaved: true }), /無法連線至伺服器/)
    const authErr = new Error('Forbidden')
    assert.equal(exportsObj.formatPublishNetworkError(authErr, { localSaved: true }), authErr)
})
