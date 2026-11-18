import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { FOOTER, EXPORT_DROPDOWN_MENU, COPY_DROPDOWN_MENU, THEME_DROPDOWN_MENU, WIDTH_DROPDOWN_MENU, MATH_FORMAT_MODAL, COMMAND_PALETTE_MODAL } from '../src/templates/common.js'
import { THEMES } from '../src/theme_data.js'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const commonTemplateSource = readFileSync(new URL('../src/templates/common.js', import.meta.url), 'utf8')
const baseCssSource = readFileSync(new URL('../src/styles/base.css.js', import.meta.url), 'utf8')

test('EXPORT_DROPDOWN_MENU renders file export items', () => {
    const htmlZh = EXPORT_DROPDOWN_MENU('zh-TW')
    const domZh = new JSDOM(htmlZh)
    const docZh = domZh.window.document

    assert.ok(docZh.querySelector('#export-dropdown'))
    assert.ok(docZh.querySelector('#export-menu-btn'))
    assert.ok(docZh.querySelector('#export-image-btn'))
    assert.ok(docZh.querySelector('#export-md-btn'))
    assert.ok(docZh.querySelector('#export-html-btn'))
    assert.ok(docZh.querySelector('#export-pdf-btn'))
    assert.ok(docZh.querySelector('#print-preview-btn'))

    assert.match(docZh.querySelector('#export-image-btn').textContent, /長圖/)
    assert.match(docZh.querySelector('#export-html-btn').textContent, /HTML/)

    const htmlEn = EXPORT_DROPDOWN_MENU('en-US')
    const domEn = new JSDOM(htmlEn)
    const docEn = domEn.window.document

    assert.match(docEn.querySelector('#export-image-btn').textContent, /Export Image/)
})

test('COPY_DROPDOWN_MENU renders complete clipboard copy matrix', () => {
    const htmlZh = COPY_DROPDOWN_MENU('zh-TW')
    const domZh = new JSDOM(htmlZh)
    const docZh = domZh.window.document

    assert.ok(docZh.querySelector('#copy-dropdown'))
    assert.ok(docZh.querySelector('#copy-menu-btn'))
    assert.ok(docZh.querySelector('#copy-all-richtext-btn'))
    assert.ok(docZh.querySelector('#copy-all-md-btn'))
    assert.ok(docZh.querySelector('#copy-all-notion-btn'))
    assert.ok(docZh.querySelector('#copy-all-jira-btn'))
    assert.ok(docZh.querySelector('#copy-all-feishu-btn'))
    assert.ok(docZh.querySelector('#copy-image-btn'))

    assert.match(docZh.querySelector('#copy-image-btn').textContent, /複製長圖/)
    assert.match(docZh.querySelector('#copy-all-jira-btn').textContent, /Jira/)
    assert.match(docZh.querySelector('#copy-all-feishu-btn').textContent, /飛書/)

    const htmlEn = COPY_DROPDOWN_MENU('en-US')
    const domEn = new JSDOM(htmlEn)
    const docEn = domEn.window.document

    assert.match(docEn.querySelector('#copy-image-btn').textContent, /Copy Long Image/)
    assert.match(docEn.querySelector('#copy-all-jira-btn').textContent, /Jira/)
})

test('published share copy actions keep titles and avoid repeating the copy verb in subtitles', () => {
    const html = FOOTER({
        lang: 'zh-TW',
        isEdit: true,
        share: true,
        shareId: 'abc123',
    })
    const doc = new JSDOM(html).window.document

    assert.equal(doc.querySelector('#copy-share-btn strong').textContent, '複製分享連結')
    assert.equal(doc.querySelector('#copy-share-btn small').textContent, '閱讀頁面網址')
    assert.equal(doc.querySelector('#copy-present-share-btn strong').textContent, '複製簡報連結')
    assert.equal(doc.querySelector('#copy-present-share-btn small').textContent, '簡報播放網址')
    assert.equal(doc.querySelector('#copy-book-share-btn strong').textContent, '複製書本連結')
    assert.equal(doc.querySelector('#copy-book-share-btn small').textContent, '書本閱讀網址')

    const englishDoc = new JSDOM(FOOTER({
        lang: 'en-US',
        isEdit: true,
        share: true,
        shareId: 'abc123',
    })).window.document
    assert.equal(englishDoc.querySelector('#copy-share-btn small').textContent, 'Copy share URL')
})

test('MATH_FORMAT_MODAL renders all 7 formula copy formats', () => {
    const htmlZh = MATH_FORMAT_MODAL('zh-TW')
    const domZh = new JSDOM(htmlZh)
    const docZh = domZh.window.document

    const options = Array.from(docZh.querySelectorAll('input[name="math-copy-format"]')).map(el => el.value)
    assert.deepEqual(options, ['auto', 'latex', 'latex-plain', 'notion', 'mathml', 'png', 'svg'])
})

test('WIDTH_DROPDOWN_MENU renders all width options with active checkmark', () => {
    const html = WIDTH_DROPDOWN_MENU('zh-TW', '960px')
    const dom = new JSDOM(html)
    const doc = dom.window.document

    const widthItems = doc.querySelectorAll('.width-item')
    assert.equal(widthItems.length, 4)

    const activeItem = doc.querySelector('.width-item.is-active')
    assert.ok(activeItem)
    assert.equal(activeItem.dataset.widthValue, '960px')
    assert.match(activeItem.querySelector('.width-item-check').textContent, /✓/)
})

test('THEME_DROPDOWN_MENU renders all 20 themes with active checkmark', () => {
    const getThemeLabel = (name) => name
    const html = THEME_DROPDOWN_MENU('zh-TW', 'tokyo-night', getThemeLabel)
    const dom = new JSDOM(html)
    const doc = dom.window.document

    const themeItems = doc.querySelectorAll('.theme-item')
    assert.equal(themeItems.length, Object.keys(THEMES).length)

    const activeItem = doc.querySelector('.theme-item.is-active')
    assert.ok(activeItem)
    assert.equal(activeItem.dataset.themeName, 'tokyo-night')
    assert.match(activeItem.querySelector('.theme-item-check').textContent, /✓/)
})

test('Option A footer keeps export & copy on IDE bar while theme & width live in Command Palette for edit mode and footer for share mode', () => {
    const editFooterHtml = FOOTER({
        lang: 'zh-TW',
        isEdit: true,
        mode: 'md',
        theme: 'claude-canvas',
        width: '100%',
    })
    const editDom = new JSDOM(editFooterHtml)
    assert.ok(editDom.window.document.querySelector('#export-dropdown'))
    assert.ok(editDom.window.document.querySelector('#copy-dropdown'))
    assert.ok(editDom.window.document.querySelector('#quick-share-url-btn'))
    assert.ok(editDom.window.document.querySelector('#command-palette-btn'))

    const paletteHtml = COMMAND_PALETTE_MODAL('zh-TW', { theme: 'claude-canvas', width: '100%' })
    const paletteDom = new JSDOM(paletteHtml)
    assert.equal(paletteDom.window.document.querySelectorAll('.width-item').length, 4)
    assert.equal(paletteDom.window.document.querySelectorAll('.theme-item').length, Object.keys(THEMES).length)

    const shareFooterHtml = FOOTER({
        lang: 'zh-TW',
        isEdit: false,
        path: 'my-note',
        sharePath: 'share/xyz',
        theme: 'claude-canvas',
        width: '100%',
    })
    const shareDom = new JSDOM(shareFooterHtml)
    assert.ok(shareDom.window.document.querySelector('#export-dropdown'))
    assert.ok(shareDom.window.document.querySelector('#copy-dropdown'))
    assert.ok(shareDom.window.document.querySelector('#width-dropdown'))
    assert.ok(shareDom.window.document.querySelector('#theme-dropdown'))
})

test('block edit footer keeps visual and print exports without Markdown export', () => {
    const blockFooterHtml = FOOTER({
        lang: 'zh-TW',
        isEdit: true,
        editorFormat: 'block',
        mode: 'md',
        theme: 'claude-canvas',
        width: '100%',
    })
    const doc = new JSDOM(blockFooterHtml).window.document

    assert.ok(doc.querySelector('#export-dropdown'))
    assert.ok(doc.querySelector('#export-image-btn'))
    assert.equal(doc.querySelector('#export-md-btn'), null)
    assert.ok(doc.querySelector('#export-html-btn'))
    assert.ok(doc.querySelector('#export-pdf-btn'))
    assert.ok(doc.querySelector('#print-preview-btn'))
    assert.equal(doc.querySelector('#copy-dropdown'), null)
})

test('base template contains dynamic html2canvas loader and offline html export logic', () => {
    assert.match(baseTemplateSource, /function initExportAndThemeControls/)
    assert.match(baseTemplateSource, /html2canvas@1\.4\.1/)
    assert.match(baseTemplateSource, /scale:\s*2/)
    assert.match(baseTemplateSource, /exportHtmlBtn\.addEventListener\('click'/)
    assert.match(baseTemplateSource, /exportImageBtn\.addEventListener\('click'/)
    assert.match(baseTemplateSource, /APP_STATE\.editorFormat === 'block'[\s\S]*?\.david-blocknote-view, \.bn-editor, \.tiptap, \.ProseMirror/)
    assert.match(baseTemplateSource, /print-export-content/)
    assert.match(baseTemplateSource, /copyImageBtn\.addEventListener\('click'/)
    assert.match(baseTemplateSource, /copyAllJiraBtn\.addEventListener\('click'/)
    assert.match(baseTemplateSource, /copyAllFeishuBtn\.addEventListener\('click'/)
    assert.match(baseTemplateSource, /copyAllNotionBtn\.addEventListener\('click'/)
    assert.match(baseCssSource, /\.export-dropdown/)
    assert.match(baseCssSource, /\.copy-dropdown/)
    assert.match(baseCssSource, /\.theme-dropdown/)
    assert.match(baseCssSource, /\.width-dropdown/)
})

test('theme and width selectors use document event delegation for floating portal dropdown menus', () => {
    assert.match(baseTemplateSource, /item\.dataset\.widthValue/)
    assert.match(baseTemplateSource, /item\.dataset\.themeName/)
    assert.match(baseTemplateSource, /document\.addEventListener\('click',\s*\(e\)\s*=>\s*\{[\s\S]*closest\('\.theme-item'\)/)
    assert.match(baseTemplateSource, /document\.addEventListener\('click',\s*\(e\)\s*=>\s*\{[\s\S]*closest\('\.width-item'\)/)
})

test('all dropdown surfaces share breathable spacing and aligned hover/focus states', () => {
    assert.match(baseCssSource, /\.dropdown-menu \{[\s\S]*?padding: 10px 8px;/)
    assert.match(baseCssSource, /\.dropdown-menu > \*,\s*\.dropdown-group-card > \* \{[\s\S]*?flex: 0 0 auto;/)
    assert.match(baseCssSource, /\.dropdown-group-card \{[\s\S]*?padding: 0;[\s\S]*?gap: 0;[\s\S]*?overflow: hidden;/)
    assert.match(baseCssSource, /\.dropdown-item-rich \{[\s\S]*?padding: 9px 10px;/)
    assert.match(baseCssSource, /\.dropdown-item \{[^}]*height: auto;/)
    assert.match(baseCssSource, /\.dropdown-item-rich \.dropdown-item-copy \{[\s\S]*?gap: 4px;/)
    assert.match(baseCssSource, /\.dropdown-menu > \.dropdown-item-rich,\s*\.dropdown-group-card > \.dropdown-item-rich \{[\s\S]*?width: 100%;[\s\S]*?margin: 0;/)
    assert.doesNotMatch(baseCssSource, /width: calc\(100% \+ 8px\)/)
    assert.match(baseCssSource, /\.dropdown-item:hover,\s*\.dropdown-item:focus-visible \{[\s\S]*?background: var\(--toolbar-bg-hover/)
    assert.match(baseCssSource, /\.theme-item:hover,\s*\.theme-item:focus-visible,\s*\.width-item:hover,\s*\.width-item:focus-visible \{[\s\S]*?background: var\(--toolbar-bg-hover/)
})
