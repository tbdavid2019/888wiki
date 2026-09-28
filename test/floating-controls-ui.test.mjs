import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { JSDOM } from 'jsdom'

import { FOOTER, SVG_ICONS } from '../src/templates/common.js'
import { setupDropdownMenus, setupFloatingTooltips } from '../static/js/floating-controls.mjs'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const baseCssSource = readFileSync(new URL('../src/styles/base.css.js', import.meta.url), 'utf8')
const editorCssSource = readFileSync(new URL('../src/styles/editor.css.js', import.meta.url), 'utf8')

const renderFooter = overrides => new JSDOM(FOOTER({
    lang: 'zh-TW',
    isEdit: false,
    mode: 'md',
    share: true,
    shareId: 'share-id',
    path: 'note-path',
    sharePath: 'share/share-id',
    theme: 'claude-canvas',
    width: '100%',
    ...overrides,
})).window.document

test('share desktop and mobile actions all expose localized floating tooltip text', () => {
    const document = renderFooter()
    const selectors = [
        '.readonly-edit-link',
        '#export-menu-btn',
        '#copy-menu-btn',
        '#copy-embed-code-btn',
        '#mobile-more-btn',
    ]

    for (const selector of selectors) {
        const control = document.querySelector(selector)
        assert.ok(control, `${selector} should be rendered`)
        assert.match(control.dataset.tooltip || '', /[\u3400-\u9fff]/, `${selector} should have a Chinese tooltip`)
    }
})

test('edit share options trigger exposes the same localized tooltip contract', () => {
    const document = renderFooter({ isEdit: true })
    assert.match(document.querySelector('#share-menu-btn')?.dataset.tooltip || '', /發布|分享/)
})

test('footer provides a primary new-note action, explicit format choices, and a default-editor setting', () => {
    const document = renderFooter({ isEdit: true })
    const firstSection = document.querySelector('.footer-sections > .footer-section:first-child')
    const trigger = document.querySelector('#new-note-menu-btn')

    assert.equal(firstSection?.classList.contains('footer-section-create'), true)
    assert.equal(trigger?.classList.contains('dropdown-trigger'), true)
    assert.equal(trigger?.querySelector('.new-note-plus')?.textContent.trim(), '＋')
    assert.equal(trigger?.querySelector('.toolbar-button-label')?.textContent.trim(), '新增')
    assert.equal(document.querySelector('#new-markdown-note-link')?.getAttribute('href'), '/new/markdown')
    assert.equal(document.querySelector('#new-block-note-link')?.getAttribute('href'), '/new/block')
    assert.match(document.querySelector('#editor-preference-btn')?.textContent || '', /預設編輯器/)
})

test('Block note menus expose imports that convert content into blocks', () => {
    const document = renderFooter({ isEdit: true, editorFormat: 'block' })

    assert.match(document.querySelector('#dropdown-import-doc-btn')?.textContent || '', /轉成 Block/)
    assert.match(document.querySelector('#dropdown-import-url-btn')?.textContent || '', /轉成 Block/)
    assert.ok(document.querySelector('#import-md-input'))
    assert.ok(document.querySelector('#import-md-btn'))
    assert.ok(document.querySelector('#new-block-note-link'))
})

test('scrolling toolbars delegate unclipped tooltips and dropdowns to a body-level floating layer', () => {
    assert.match(baseTemplateSource, /\/js\/floating-controls\.mjs/)
    assert.match(baseCssSource, /\.footer\s*\{[\s\S]*overflow-x:\s*auto;/)
    assert.match(editorCssSource, /\.markdown-editor-toolbar\s*\{[\s\S]*overflow-x:\s*auto;/)
    assert.match(baseCssSource, /\.floating-tooltip\s*\{/)
    assert.match(baseCssSource, /\.dropdown-menu\.floating-menu-open\s*\{/)
})

test('mobile edit share menu is portaled outside the filtered scrolling footer', () => {
    const dom = new JSDOM(`
        <footer class="footer">
            <div class="dropdown-container">
                <button class="dropdown-trigger" aria-expanded="false">...</button>
                <div class="dropdown-menu"><button class="dropdown-item">開啟</button></div>
            </div>
        </footer>
    `)
    const { document } = dom.window
    const trigger = document.querySelector('.dropdown-trigger')
    const menu = document.querySelector('.dropdown-menu')
    trigger.getBoundingClientRect = () => ({ left: 330, right: 362, top: 700, bottom: 732, width: 32, height: 32 })
    menu.getBoundingClientRect = () => ({ left: 0, right: 220, top: 0, bottom: 200, width: 220, height: 200 })
    Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 390 })
    Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 844 })

    setupDropdownMenus(document, dom.window)
    trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    assert.equal(menu.parentElement, document.body)
    assert.equal(menu.classList.contains('floating-menu-open'), true)
    assert.equal(trigger.getAttribute('aria-expanded'), 'true')
    assert.equal(menu.style.position, 'fixed')
    assert.equal(menu.style.left, '162px')
    assert.equal(menu.style.top, '492px')

    document.body.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    assert.equal(menu.closest('.dropdown-container')?.classList.contains('show'), false)
    assert.equal(trigger.getAttribute('aria-expanded'), 'false')
})

test('toolbar tooltip is rendered below its control in a body-level layer', () => {
    const dom = new JSDOM('<div class="markdown-editor-toolbar"><button data-tooltip="粗體">B</button></div>')
    const { document } = dom.window
    const button = document.querySelector('button')
    button.getBoundingClientRect = () => ({ left: 20, right: 44, top: 10, bottom: 34, width: 24, height: 24 })
    Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 390 })
    Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 844 })

    const { tooltip } = setupFloatingTooltips(document, dom.window)
    tooltip.getBoundingClientRect = () => ({ left: 0, right: 60, top: 0, bottom: 24, width: 60, height: 24 })
    button.dispatchEvent(new dom.window.MouseEvent('pointerover', { bubbles: true }))

    assert.equal(tooltip.parentElement, document.body)
    assert.equal(tooltip.hidden, false)
    assert.equal(tooltip.textContent, '粗體')
    assert.equal(tooltip.classList.contains('floating-placement-below'), true)
    assert.equal(tooltip.style.top, '42px')
})

test('clicking select elements, labels, or toggles inside dropdown does not close the dropdown menu', () => {
    const dom = new JSDOM(`
        <footer class="footer">
            <div class="dropdown-container share-dropdown">
                <button class="dropdown-trigger" id="share-menu-btn" aria-expanded="false">Share</button>
                <div class="dropdown-menu share-dropdown-menu">
                    <div class="dropdown-item-control">
                        <label for="share-vault-mode-select">Seal 存取控制</label>
                        <select id="share-vault-mode-select" class="opt-select share-vault-mode-select">
                            <option value="standard" selected>標準發布</option>
                            <option value="burn">閱後即焚</option>
                            <option value="timelock">定時解鎖</option>
                            <option value="deadman">亡者開關</option>
                        </select>
                    </div>
                    <div class="dropdown-item-toggle">
                        <button type="button" id="public-index-btn">公開索引</button>
                    </div>
                    <button class="dropdown-item share-publish-menu-btn">發布此筆記</button>
                </div>
            </div>
        </footer>
    `)
    const { document } = dom.window
    const trigger = document.querySelector('#share-menu-btn')
    const menu = document.querySelector('.dropdown-menu')
    const select = document.querySelector('#share-vault-mode-select')
    const label = document.querySelector('label[for="share-vault-mode-select"]')
    const toggle = document.querySelector('#public-index-btn')
    const container = document.querySelector('.dropdown-container')

    trigger.getBoundingClientRect = () => ({ left: 100, right: 140, top: 700, bottom: 732, width: 40, height: 32 })
    menu.getBoundingClientRect = () => ({ left: 0, right: 260, top: 0, bottom: 300, width: 260, height: 300 })
    Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 800 })
    Object.defineProperty(dom.window, 'innerHeight', { configurable: true, value: 900 })

    setupDropdownMenus(document, dom.window)

    // Open dropdown
    trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    assert.equal(container.classList.contains('show'), true)
    assert.equal(menu.classList.contains('floating-menu-open'), true)

    // Click select element: MUST NOT close dropdown!
    select.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    assert.equal(container.classList.contains('show'), true, 'Clicking select must not close dropdown')
    assert.equal(menu.classList.contains('floating-menu-open'), true)

    // Click label: MUST NOT close dropdown!
    label.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    assert.equal(container.classList.contains('show'), true, 'Clicking label must not close dropdown')

    // Click toggle button: MUST NOT close dropdown!
    let delegatedClicked = false
    document.addEventListener('click', e => {
        if (e.target.closest('#public-index-btn')) delegatedClicked = true
    })
    toggle.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    assert.equal(container.classList.contains('show'), true, 'Clicking toggle button must not close dropdown')
    assert.equal(delegatedClicked, true, 'Click event on controls inside dropdown menu must bubble to document')

    // Arrow down on select: MUST NOT be intercepted by menu navigation
    const arrowDownEvent = new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    select.dispatchEvent(arrowDownEvent)
    assert.equal(arrowDownEvent.defaultPrevented, false, 'Arrow down on select must not be defaultPrevented')

    // Click outside: MUST close dropdown
    document.body.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    assert.equal(container.classList.contains('show'), false, 'Clicking outside must close dropdown')
    assert.equal(menu.classList.contains('floating-menu-open'), false)
})

test('dedicated toolbar print button is rendered in edit and share modes with printer icon', () => {
    const editDoc = renderFooter({ isEdit: true })
    const printEditBtn = editDoc.querySelector('#toolbar-print-btn')
    assert.ok(printEditBtn, 'Edit mode must have #toolbar-print-btn')
    assert.match(printEditBtn.dataset.tooltip || '', /列印/)
    assert.match(printEditBtn.innerHTML, /<svg class="svg-icon"/)

    const shareDoc = renderFooter({ isEdit: false, path: 'my-note', sharePath: 'share/id' })
    const printShareBtn = shareDoc.querySelector('#toolbar-print-btn')
    assert.ok(printShareBtn, 'Share mode must have #toolbar-print-btn')
    assert.match(printShareBtn.dataset.tooltip || '', /列印/)
    assert.match(printShareBtn.innerHTML, /<svg class="svg-icon"/)
})

test('mobile more button is a dropdown trigger with quick tools and appearance options', () => {
    const editDoc = renderFooter({ isEdit: true })
    const moreDropdown = editDoc.querySelector('#more-dropdown')
    assert.ok(moreDropdown, '#more-dropdown container must exist')
    assert.ok(moreDropdown.classList.contains('dropdown-container'))

    const trigger = moreDropdown.querySelector('#mobile-more-btn')
    assert.ok(trigger, '#mobile-more-btn must exist inside #more-dropdown')
    assert.ok(trigger.classList.contains('dropdown-trigger'))

    const menu = moreDropdown.querySelector('.more-dropdown-menu')
    assert.ok(menu, '.more-dropdown-menu must exist')
    assert.ok(menu.querySelector('#more-menu-print-btn'), '#more-menu-print-btn must exist')
    assert.ok(menu.querySelector('#more-menu-stats-btn'), '#more-menu-stats-btn must exist')
    assert.ok(menu.querySelector('#more-menu-theme-btn'), '#more-menu-theme-btn must exist')
    assert.ok(menu.querySelector('#more-menu-font-btn'), '#more-menu-font-btn must exist')
    assert.ok(menu.querySelector('#more-menu-ui-theme-btn'), '#more-menu-ui-theme-btn must exist')
    assert.ok(menu.querySelector('#more-editor-preference-btn'), '#more-editor-preference-btn must exist in edit mode')
    assert.ok(menu.querySelector('a[href="/docs"]'), 'Docs guide link must exist')
})

test('SVG_ICONS: import has upload icon (arrow up) and export has download icon (arrow down), printer exists', () => {
    assert.ok(SVG_ICONS.printer, 'printer icon must exist')
    assert.match(SVG_ICONS.import, /17 8 12 3 7 8/, 'import icon must point up (upload)')
    assert.match(SVG_ICONS.export, /7 10 12 15 17 10/, 'export icon must point down (download)')
})

