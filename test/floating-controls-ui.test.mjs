import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { JSDOM } from 'jsdom'

import { FOOTER, COMMAND_PALETTE_MODAL, SVG_ICONS } from '../src/templates/common.js'
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
    const paletteDoc = new JSDOM(COMMAND_PALETTE_MODAL('zh-TW', { editorFormat: 'block' })).window.document

    assert.match(document.querySelector('#dropdown-import-doc-btn')?.textContent || '', /轉成 Block/)
    assert.match(document.querySelector('#dropdown-import-url-btn')?.textContent || '', /轉成 Block/)
    assert.ok(document.querySelector('#import-md-input'))
    assert.ok(document.querySelector('#new-block-note-link'))
    assert.equal(paletteDoc.querySelector('[data-cp-action="math-format"]'), null)
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

test('share mode keeps dedicated print button while edit mode exposes print inside Export menu without Command Palette duplication', () => {
    const editDoc = renderFooter({ isEdit: true, mode: 'md' })
    assert.ok(editDoc.querySelector('#export-dropdown #print-preview-btn'), 'Edit mode Export menu must expose #print-preview-btn')
    const paletteDoc = new JSDOM(COMMAND_PALETTE_MODAL('zh-TW')).window.document
    assert.equal(paletteDoc.querySelector('[data-cp-action="print"]'), null, 'Command Palette should not duplicate Export menu print button')

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
    assert.ok(SVG_ICONS.bot, 'bot icon must exist')
})

test('share dev-info dropdown and edit Command Palette expose GitHub, Agent Skill, API docs, /docs, and PWA install', () => {
    const shareDoc = renderFooter({ isEdit: false, path: 'my-note', sharePath: 'share/id' })
    const devInfoDropdown = shareDoc.querySelector('#dev-info-dropdown')
    assert.ok(devInfoDropdown, '#dev-info-dropdown container must exist in share mode')
    assert.ok(devInfoDropdown.classList.contains('dropdown-container'))

    const trigger = devInfoDropdown.querySelector('#dev-info-menu-btn')
    assert.ok(trigger, '#dev-info-menu-btn must exist inside #dev-info-dropdown')
    assert.ok(trigger.classList.contains('dropdown-trigger'))
    assert.match(trigger.dataset.tooltip || '', /開發|Agent/)

    const menu = devInfoDropdown.querySelector('.dev-info-dropdown-menu')
    assert.ok(menu, '.dev-info-dropdown-menu must exist')
    assert.ok(menu.querySelector('a[href="https://github.com/tbdavid2019/888wiki"]'), 'GitHub link must exist')
    assert.ok(menu.querySelector('a[href="/.well-known/agent-skills/david888-wiki-publisher/SKILL.md"]'), 'Agent skill link must exist')
    assert.ok(menu.querySelector('a[href="/docs/api"]'), 'API docs link must exist')
    assert.ok(menu.querySelector('#pwa-install-manual-btn'), '#pwa-install-manual-btn must exist in dev-info menu')

    // Edit mode Command Palette exposes docs, API, skill, GitHub, and PWA install directly
    const paletteDoc = new JSDOM(COMMAND_PALETTE_MODAL('zh-TW', {})).window.document
    assert.ok(paletteDoc.querySelector('a[href="/docs"]'), 'Docs guide link must exist in Command Palette')
    assert.ok(paletteDoc.querySelector('a[href="/docs/api"]'), 'API docs link must exist in Command Palette')
    assert.ok(paletteDoc.querySelector('a[href="/.well-known/agent-skills/david888-wiki-publisher/SKILL.md"]'), 'Agent skill link must exist in Command Palette')
    assert.ok(paletteDoc.querySelector('a[href="https://github.com/tbdavid2019/888wiki"]'), 'GitHub link must exist in Command Palette')
    assert.ok(paletteDoc.querySelector('#pwa-install-manual-btn'), '#pwa-install-manual-btn must exist in Command Palette')

    // Mobile more dropdown also exposes doc & dev links for mobile users
    const editDoc = renderFooter({ isEdit: true })
    const moreMenu = editDoc.querySelector('.more-dropdown-menu')
    assert.ok(moreMenu.querySelector('a[href="/docs"]'), 'Docs guide link must exist in more menu')
    assert.ok(moreMenu.querySelector('a[href="/docs/api"]'), 'API docs link must exist in more menu')
    assert.ok(moreMenu.querySelector('a[href="/.well-known/agent-skills/david888-wiki-publisher/SKILL.md"]'), 'Agent skill link must exist in more menu')
    assert.ok(moreMenu.querySelector('a[href="https://github.com/tbdavid2019/888wiki"]'), 'GitHub link must exist in more menu')

    // Base CSS responsive hide & styling assertions
    assert.match(baseCssSource, /\.dev-info-dropdown\s*\.dropdown-menu/)
    assert.match(baseCssSource, /\.footer-section-info\s*\{\s*display:\s*none\s*!important;/)
})

test('Option A IDE edit footer places quick public URL action beside publish capsule and moves secondary tools to Command Palette', () => {
    const editDoc = renderFooter({ isEdit: true, mode: 'md', share: false, shareId: '' })
    const syncBadge = editDoc.querySelector('#sync-status-badge')
    assert.ok(syncBadge, '#sync-status-badge must exist')
    assert.ok(syncBadge.querySelector('.sync-status-icon'), '.sync-status-icon must exist')
    assert.ok(syncBadge.querySelector('.sync-icon-draft'), '.sync-icon-draft must exist for Draft state')
    assert.ok(syncBadge.querySelector('.sync-icon-live'), '.sync-icon-live must exist for Live state')
    assert.ok(syncBadge.querySelector('.sync-status-dot'), '.sync-status-dot must exist')
    assert.ok(syncBadge.querySelector('.sync-status-text.sr-only'), '.sync-status-text must be visually hidden with sr-only')
    assert.match(baseCssSource, /\.share-menu-trigger\s+\.sync-status-dot\s*\{\s*display:\s*none\s*!important;/)
    assert.match(baseCssSource, /\.cp-item\s*\{[^}]*justify-content:\s*flex-start\s*!important;[^}]*text-align:\s*left\s*!important;/s)
    assert.match(baseCssSource, /\.cp-item-copy\s+strong\s*\{\s*font-size:\s*14px;/)
    assert.match(baseCssSource, /\.cp-item-copy\s+small\s*\{\s*font-size:\s*12\.5px;/)

    const editSection = editDoc.querySelector('.footer-section-edit')
    assert.ok(editSection, '.footer-section-edit must exist')
    assert.ok(editSection.querySelector('#share-dropdown'), '#share-dropdown must be in edit section')
    assert.ok(editSection.querySelector('#save-dropdown'), '#save-dropdown must be in edit section')
    const quickShareBtn = editSection.querySelector('#quick-share-url-btn')
    assert.ok(quickShareBtn, '#quick-share-url-btn must be right beside publish capsule')
    assert.match(quickShareBtn.textContent, /發布並複製連結/)
    assert.ok(editSection.querySelector('#ide-cursor-status'), '#ide-cursor-status must exist in edit section')

    const liveEditDoc = renderFooter({ isEdit: true, mode: 'md', share: true, shareId: 'live-123' })
    assert.match(liveEditDoc.querySelector('#quick-share-url-btn').textContent, /複製連結/)

    const appearanceSection = editDoc.querySelector('.footer-section-appearance')
    assert.ok(appearanceSection.querySelector('#theme-dropdown'), '#theme-dropdown must be standalone in IDE bottom bar')
    assert.ok(appearanceSection.querySelector('#command-palette-btn'), '#command-palette-btn must exist in IDE bar')
    assert.ok(appearanceSection.querySelector('#language-selector'), '#language-selector must remain directly accessible on IDE bottom bar')
    assert.ok(appearanceSection.querySelector('#export-dropdown'), '#export-dropdown must exist in IDE bar')
    assert.ok(appearanceSection.querySelector('#copy-dropdown'), '#copy-dropdown must exist in IDE bar')
})

test('publish and sync controls are unified into a joint capsule with dynamic draft/published labels', () => {
    // Draft / unpublished note
    const draftDoc = renderFooter({ isEdit: true, mode: 'md', share: false, shareId: '' })
    const capsuleGroup = draftDoc.querySelector('.publish-sync-capsule-group')
    assert.ok(capsuleGroup, '.publish-sync-capsule-group container must exist')
    assert.ok(capsuleGroup.querySelector('#share-dropdown'), '#share-dropdown must be inside capsule group')
    assert.ok(capsuleGroup.querySelector('#save-dropdown'), '#save-dropdown must be inside capsule group')

    // Draft labels & tooltips
    const draftSaveBtnTitle = draftDoc.querySelector('#save-note-btn-title')
    assert.ok(draftSaveBtnTitle, '#save-note-btn-title must exist')
    assert.match(draftSaveBtnTitle.textContent, /發布並同步/)
    const draftBadge = draftDoc.querySelector('#sync-status-badge')
    assert.match(draftBadge?.dataset.tooltip || '', /點擊發布並同步/)

    // Published note
    const liveDoc = renderFooter({ isEdit: true, mode: 'md', share: true, shareId: 'live-id' })
    const liveSaveBtnTitle = liveDoc.querySelector('#save-note-btn-title')
    assert.match(liveSaveBtnTitle.textContent, /立即同步至雲端/)
    const liveBadge = liveDoc.querySelector('#sync-status-badge')
    assert.match(liveBadge?.dataset.tooltip || '', /雲端已同步/)

    // CSS integration assertions
    assert.match(baseCssSource, /\.publish-sync-capsule-group\s*\{/)
    assert.match(baseCssSource, /\.publish-sync-capsule-group\s*\.share-dropdown/)
    assert.match(baseCssSource, /\.publish-sync-capsule-group\s*\.save-dropdown/)
})

test('autosave switch in draft mode allows pointer interaction and base.js synchronizes save button attributes', () => {
    // Draft / unpublished note
    const draftDoc = renderFooter({ isEdit: true, mode: 'md', share: false, shareId: '' })
    const autosaveToggle = draftDoc.querySelector('#autosave-toggle')
    assert.ok(autosaveToggle, '#autosave-toggle must exist')
    assert.equal(autosaveToggle.classList.contains('is-disabled'), true, 'draft autosave switch should have is-disabled class')
    assert.equal(autosaveToggle.disabled, false, 'draft autosave switch must not be HTML disabled so clicks can bubble')

    // CSS must allow pointer events
    assert.match(baseCssSource, /\.autosave-rail-switch\[disabled\],\s*\.autosave-rail-switch\.is-disabled\s*\{[\s\S]*?pointer-events:\s*auto;/)

    // Template synchronization updates save-note-btn attributes and status dataset
    assert.match(baseTemplateSource, /saveBtn\.title\s*=\s*saveLabel/)
    assert.match(baseTemplateSource, /saveBtn\.dataset\.tooltip\s*=\s*saveLabel/)
    assert.match(baseTemplateSource, /saveBtn\.setAttribute\('aria-label',\s*saveLabel\)/)
    assert.match(baseTemplateSource, /\$syncStatusBadge\.dataset\.status\s*=\s*isPublished\s*\?\s*'cloud-synced'\s*:\s*'local'/)
})

test('share-dropdown container is not hidden by save-dropdown style rules', () => {
    const editDoc = renderFooter({ isEdit: true, mode: 'md' })
    const shareDropdown = editDoc.querySelector('#share-dropdown')
    assert.ok(shareDropdown, '#share-dropdown must exist')
    assert.equal(shareDropdown.classList.contains('share-dropdown'), true)
    assert.equal(shareDropdown.classList.contains('save-dropdown'), false, '#share-dropdown must not have save-dropdown class to avoid display:none collision')
    assert.equal(shareDropdown.classList.contains('publish-sync-dropdown'), true)
    const saveDropdown = editDoc.querySelector('#save-dropdown')
    assert.ok(saveDropdown, '#save-dropdown must exist')
    assert.equal(saveDropdown.classList.contains('save-dropdown'), true)
    assert.match(baseCssSource, /\.publish-sync-capsule-group\s*\.save-dropdown:not\(\.share-dropdown\)/)
})

test('share-menu-trigger has auto width and minimum width to prevent square button clamping and caret overflow', () => {
    const editDoc = renderFooter({ isEdit: true, mode: 'md' })
    const shareBtn = editDoc.querySelector('#share-menu-btn')
    assert.ok(shareBtn, '#share-menu-btn must exist in edit mode footer')
    assert.ok(shareBtn.querySelector('.sync-status-badge-inline'), 'inline badge must be inside #share-menu-btn')
    assert.ok(shareBtn.querySelector('.toolbar-button-caret'), 'caret must be inside #share-menu-btn')

    // CSS rules must override square toolbar-icon-button (28px) with width: auto !important and min-width: 38px !important
    assert.match(baseCssSource, /\.publish-sync-dropdown\s*\.share-menu-trigger[\s\S]*?width:\s*auto\s*!important/)
    assert.match(baseCssSource, /\.publish-sync-dropdown\s*\.share-menu-trigger[\s\S]*?min-width:\s*38px\s*!important/)
    assert.match(baseCssSource, /\.publish-sync-dropdown\s*\.toolbar-button-caret[\s\S]*?font-size:\s*9px\s*!important/)
})

