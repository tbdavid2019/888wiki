import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import {
    DEFAULT_SHARE_FONT,
    SHARE_FONTS,
    SHARE_FONT_IDS,
    SHARE_FONT_MAP,
    isValidShareFont,
    normalizeShareFont,
} from '../src/font_data.js'
import { FOOTER, THEME_DROPDOWN_MENU } from '../src/templates/common.js'
import { HTML } from '../src/templates/base.js'

const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')

test('font registry includes 2 local fonts and 9 Google Fonts CDN fonts without self-hosted additions or commercial fonts', () => {
    assert.equal(DEFAULT_SHARE_FONT, 'jetbrains')
    assert.equal(SHARE_FONTS.length, 11)

    const localFonts = SHARE_FONTS.filter(font => font.source === 'local')
    const googleFonts = SHARE_FONTS.filter(font => font.source === 'google-fonts')

    assert.deepEqual(localFonts.map(font => font.id), ['jetbrains', 'maple'])
    assert.deepEqual(googleFonts.map(font => font.id), [
        'fira-code',
        'google-sans-code',
        'geist-mono',
        'source-code-pro',
        'intel-one-mono',
        'lilex',
        'atkinson-hyperlegible-mono',
        'atkinson-hyperlegible',
        'anonymous-pro',
    ])

    for (const font of googleFonts) {
        assert.match(font.googleFontsUrl, /^https:\/\/fonts\.googleapis\.com\/css2\?family=/)
        assert.match(font.familyCss, /^"GenJyuu Gothic CJK",/)
    }

    assert.equal(SHARE_FONT_MAP.monolisa, undefined)
    assert.equal(SHARE_FONT_MAP['ioskeley-mono'], undefined)
    assert.equal(SHARE_FONT_MAP['departure-mono'], undefined)
})

test('normalizeShareFont and isValidShareFont handle legacy values and invalid inputs safely', () => {
    assert.equal(normalizeShareFont(undefined), 'jetbrains')
    assert.equal(normalizeShareFont(''), 'jetbrains')
    assert.equal(normalizeShareFont('true'), 'maple')
    assert.equal(normalizeShareFont(true), 'maple')
    assert.equal(normalizeShareFont('fira-code'), 'fira-code')
    assert.equal(normalizeShareFont('unknown-font'), 'jetbrains')

    assert.equal(isValidShareFont('jetbrains'), true)
    assert.equal(isValidShareFont('google-sans-code'), true)
    assert.equal(isValidShareFont('true'), true)
    assert.equal(isValidShareFont('monolisa'), false)
    assert.equal(isValidShareFont(''), false)
})

test('Google Fonts stylesheet links are omitted for local fonts and injected on demand for Google Fonts', () => {
    const localHtml = HTML({
        lang: 'zh-TW',
        title: 'Local Font Test',
        content: '# Hello',
        isEdit: false,
        shareId: 's1',
        path: 'p1',
        ext: { shareFont: 'jetbrains', sharePath: '/share/s1' },
    })
    assert.doesNotMatch(localHtml, /<link[^>]+fonts\.googleapis\.com\/css2/)
    assert.doesNotMatch(localHtml, /<link[^>]+data-share-font-cdn/)
    assert.match(localHtml, /<body data-share-font="jetbrains"/)

    const cdnHtml = HTML({
        lang: 'zh-TW',
        title: 'Google Font Test',
        content: '# Hello',
        isEdit: false,
        shareId: 's2',
        path: 'p2',
        ext: { shareFont: 'fira-code', sharePath: '/share/s2' },
    })
    assert.match(cdnHtml, /data-share-font-cdn="fira-code"/)
    assert.match(cdnHtml, /https:\/\/fonts\.googleapis\.com\/css2\?family=Fira\+Code/)
    assert.match(cdnHtml, /<body data-share-font="fira-code"/)
    assert.match(cdnHtml, /--share-font-fira-code-family:/)
})

test('theme dropdown and share footer expose all 11 font options', () => {
    const themeHtml = THEME_DROPDOWN_MENU('zh-TW', 'claude-canvas', name => name)
    const themeDom = new JSDOM(themeHtml)
    const cpFontIds = [...themeDom.window.document.querySelectorAll('#theme-dropdown [data-cp-font]')]
        .map(btn => btn.getAttribute('data-cp-font'))
    assert.deepEqual(cpFontIds, SHARE_FONT_IDS)

    const shareFooterHtml = FOOTER({
        lang: 'zh-TW',
        isEdit: false,
        path: 'my-note',
        sharePath: '/share/xyz',
        shareId: 'xyz',
        shareFont: 'geist-mono',
    })
    const shareDom = new JSDOM(shareFooterHtml)
    const shareLabel = shareDom.window.document.querySelector('#share-font-menu-btn .share-font-current-label')
    assert.equal(shareLabel?.textContent, 'Geist Mono')

    const shareFontIds = [...shareDom.window.document.querySelectorAll('#share-font-selector .share-font-item')]
        .map(btn => btn.getAttribute('data-cp-font'))
    assert.deepEqual(shareFontIds, SHARE_FONT_IDS)
    assert.ok(shareDom.window.document.querySelector('#share-font-selector .share-font-item.is-active[data-cp-font="geist-mono"]'))
})

test('setting endpoint validates shareFont against font registry', () => {
    assert.match(indexSource, /isValidShareFont/)
    assert.match(indexSource, /if \(shareFont !== undefined && shareFont !== '' && !isValidShareFont\(shareFont\)\)/)
})
