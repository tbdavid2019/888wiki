import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

import { HTML, resolveInitialPreviewDevice, resolvePageTheme } from '../src/templates/base.js'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')

const themes = {
    alpha: 'alpha css',
    beta: 'beta css',
    gamma: 'gamma css',
}

test('only a homepage-created new note chooses a random theme', () => {
    assert.equal(resolvePageTheme({ randomize: true, storedTheme: 'beta', themes, random: () => 0 }), 'alpha')
    assert.equal(resolvePageTheme({ randomize: true, storedTheme: 'beta', themes, random: () => 0.999999 }), 'gamma')
})

test('existing edit and share pages retain the persisted article theme', () => {
    assert.equal(resolvePageTheme({ randomize: false, storedTheme: 'beta', themes }), 'beta')
    assert.equal(resolvePageTheme({ randomize: false, storedTheme: 'missing', themes }), 'alpha')
})

test('the initial random theme is published to server metadata', () => {
    assert.match(baseTemplateSource, /randomize: isEdit && ext\.isNewEntry === true/)
    assert.match(baseTemplateSource, /THEMES\[pageTheme\]/)
    assert.match(baseTemplateSource, /FOOTER\(\{[\s\S]*theme: pageTheme/)
    assert.match(
        baseTemplateSource,
        /APP_STATE\.isNewEntry[\s\S]*persistSetting\(\{ theme: APP_STATE\.theme \}\)/,
    )
    assert.match(baseTemplateSource, /JSON\.stringify\(\{[\s\S]*share: true,[\s\S]*content:[\s\S]*theme: currentTheme/)
    assert.match(baseTemplateSource, /history\.replaceState/)
})

test('initial preview device defaults to desktop and honors storedDevice', () => {
    assert.equal(resolveInitialPreviewDevice({ isNewEntry: true, storedDevice: '' }), 'desktop')
    assert.equal(resolveInitialPreviewDevice({ isNewEntry: true, storedDevice: 'mobile' }), 'mobile')
    assert.equal(resolveInitialPreviewDevice({ isNewEntry: false, storedDevice: 'mobile' }), 'mobile')
    assert.equal(resolveInitialPreviewDevice({ isNewEntry: false, storedDevice: 'missing' }), 'desktop')
})

function runHeadThemeScript(pageHtml, { localStore = {}, sessionStore = {}, prefersDark = false } = {}) {
    const match = pageHtml.match(/<head>\s*<script>([\s\S]*?)<\/script>/)
    assert.ok(match, 'expected head inline theme script')
    const attrs = {}
    const makeStorage = backing => ({
        getItem: key => (Object.prototype.hasOwnProperty.call(backing, key) ? backing[key] : null),
        setItem: (key, val) => { backing[key] = String(val) },
        removeItem: key => { delete backing[key] },
    })
    const sandbox = {
        window: { matchMedia: () => ({ matches: prefersDark }) },
        document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v }, getAttribute: k => attrs[k] } },
        localStorage: makeStorage(localStore),
        sessionStorage: makeStorage(sessionStore),
    }
    sandbox.window.window = sandbox.window
    vm.runInNewContext(match[1], sandbox)
    return { attrs, localStore, sessionStore }
}

test('initial dark preview theme syncs editor UI to dark without polluting shared localStorage, honors per-tab manual override, and survives storage errors', () => {
    const darkHtml = HTML({
        lang: 'zh-TW',
        title: 'Dark random test',
        content: '# Hello',
        ext: { theme: 'tokyo-night', isNewEntry: false },
        isEdit: true,
        path: 'dark-note',
    })
    const localStore = { 'cf-notepad-ui-theme': 'light' }
    const darkRes = runHeadThemeScript(darkHtml, { localStore })
    assert.equal(darkRes.attrs['data-preview-theme'], 'tokyo-night')
    assert.equal(darkRes.attrs['data-ui-theme'], 'dark')
    assert.equal(darkRes.localStore['cf-notepad-ui-theme'], 'light')

    const autoRes = runHeadThemeScript(darkHtml, { localStore: { 'cf-notepad-ui-theme': 'auto' } })
    assert.equal(autoRes.attrs['data-ui-theme'], 'dark')

    const shareHtml = HTML({
        lang: 'zh-TW',
        title: 'Dark share test',
        content: '# Hello',
        ext: { theme: 'tokyo-night', isAuthor: false },
        isEdit: false,
        path: 'dark-share',
        shareId: 'dark-share',
    })
    const shareStore = { 'cf-notepad-ui-theme': 'light' }
    const shareRes = runHeadThemeScript(shareHtml, { localStore: shareStore })
    assert.equal(shareRes.attrs['data-ui-theme'], 'dark')
    assert.equal(shareRes.localStore['cf-notepad-ui-theme'], 'light')

    const lightHtml = HTML({
        lang: 'zh-TW',
        title: 'Light random test',
        content: '# Hello',
        ext: { theme: 'claude-canvas', isNewEntry: false },
        isEdit: true,
        path: 'light-note',
    })
    const legacyStore = {
        'cf-notepad-ui-theme': 'dark',
        'cf-notepad-ui-theme-sync': '1',
        'cf-notepad-ui-theme-prev': 'light',
    }
    const lightRes = runHeadThemeScript(lightHtml, { localStore: legacyStore })
    assert.equal(lightRes.attrs['data-preview-theme'], 'claude-canvas')
    assert.equal(lightRes.attrs['data-ui-theme'], 'light')
    assert.equal(lightRes.localStore['cf-notepad-ui-theme'], 'light')
    assert.equal(lightRes.localStore['cf-notepad-ui-theme-sync'], undefined)

    const overrideRes = runHeadThemeScript(darkHtml, {
        localStore: { 'cf-notepad-ui-theme': 'light' },
        sessionStore: { 'cf-notepad-ui-theme-manual-override': 'tokyo-night' },
    })
    assert.equal(overrideRes.attrs['data-ui-theme'], 'light')

    const headMatch = darkHtml.match(/<head>\s*<script>([\s\S]*?)<\/script>/)
    const attrs = {}
    const throwingStorage = {
        getItem: () => { throw new Error('SecurityError') },
        setItem: () => { throw new Error('QuotaExceededError') },
        removeItem: () => {},
    }
    vm.runInNewContext(headMatch[1], {
        window: { matchMedia: () => ({ matches: false }) },
        document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v }, getAttribute: k => attrs[k] } },
        localStorage: throwingStorage,
        sessionStorage: throwingStorage,
    })
    assert.equal(attrs['data-preview-theme'], 'tokyo-night')
    assert.equal(attrs['data-ui-theme'], 'dark')
})
