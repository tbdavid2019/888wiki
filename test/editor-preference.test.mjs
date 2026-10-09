import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

import { EDITOR_PREFERENCE_MODAL, FOOTER, SVG_ICONS } from '../src/templates/common.js'
import { getBaseCss } from '../src/styles/base.css.js'
import {
    DEFAULT_EDITOR_FORMAT,
    EDITOR_PREFERENCE_STORAGE_KEY,
    EDITOR_SESSION_PREFERENCE_KEY,
    getEditorPreference,
    hasEditorPreference,
    initializeEditorPreference,
    saveEditorPreference,
} from '../static/js/editor-preference.mjs'

const createWindow = html => new JSDOM(html, { url: 'https://wiki.david888.com/' }).window

test('editor preference defaults to Markdown and supports persistent choices in localStorage', () => {
    const window = createWindow('')

    assert.equal(DEFAULT_EDITOR_FORMAT, 'markdown')
    assert.deepEqual(getEditorPreference(window), { format: 'markdown', remembered: false })
    assert.equal(hasEditorPreference(window), false)

    saveEditorPreference('block', { remember: false, windowRef: window })
    assert.deepEqual(getEditorPreference(window), { format: 'markdown', remembered: false })
    assert.equal(hasEditorPreference(window), false)
    assert.equal(window.localStorage.getItem(EDITOR_PREFERENCE_STORAGE_KEY), null)

    saveEditorPreference('block', { remember: true, windowRef: window })
    assert.deepEqual(getEditorPreference(window), { format: 'block', remembered: true })
    assert.equal(hasEditorPreference(window), true)
    assert.equal(window.localStorage.getItem(EDITOR_PREFERENCE_STORAGE_KEY), 'block')

    saveEditorPreference('markdown', { remember: true, windowRef: window })
    assert.deepEqual(getEditorPreference(window), { format: 'markdown', remembered: true })
    assert.equal(window.localStorage.getItem(EDITOR_PREFERENCE_STORAGE_KEY), 'markdown')
    assert.throws(() => saveEditorPreference('html', { windowRef: window }), /Invalid editor format/)
})

test('primary new-note action asks for a format when no preference exists and supports one-click card action', () => {
    const window = createWindow(`${FOOTER({ lang: 'zh-TW', isEdit: true, mode: 'md', editorFormat: 'markdown' })}${EDITOR_PREFERENCE_MODAL('zh-TW')}`)
    const navigations = []
    const controller = initializeEditorPreference(window.document, window, { navigate: format => navigations.push(format) })

    const dialog = window.document.querySelector('[data-editor-preference-dialog]')
    controller.open({ startNewNote: true })
    assert.equal(dialog.getAttribute('aria-hidden'), 'false')

    // Click direct card button for markdown
    const mdButton = window.document.querySelector('[data-editor-format-choice="markdown"]')
    assert.ok(mdButton)
    mdButton.click()
    assert.deepEqual(navigations, ['markdown'])
})

test('footer setting changes the default new-note format preference', () => {
    const window = createWindow(`${FOOTER({ lang: 'zh-TW', isEdit: true, mode: 'md', editorFormat: 'markdown' })}${EDITOR_PREFERENCE_MODAL('zh-TW')}`)
    const { document } = window
    initializeEditorPreference(document, window, { navigate: () => assert.fail('settings should not navigate') })

    const settings = document.querySelector('#editor-preference-btn')
    settings.click()
    assert.equal(document.querySelector('[data-editor-preference-dialog]').getAttribute('aria-hidden'), 'false')

    document.querySelector('input[value="markdown"]').click()
    document.querySelector('[data-editor-preference-remember]').checked = true
    document.querySelector('[data-editor-preference-form]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))

    assert.equal(window.localStorage.getItem(EDITOR_PREFERENCE_STORAGE_KEY), 'markdown')
    assert.equal(document.querySelector('[data-editor-preference-dialog]').getAttribute('aria-hidden'), 'true')
    assert.equal(document.activeElement, settings)
})

test('homepage asks until it has a remembered editor choice', () => {
    const firstWindow = createWindow(EDITOR_PREFERENCE_MODAL('zh-TW', { autoOpen: true }))
    const firstNavigations = []
    initializeEditorPreference(firstWindow.document, firstWindow, { navigate: format => firstNavigations.push(format) })

    const dialog = firstWindow.document.querySelector('[data-editor-preference-dialog]')
    assert.equal(dialog.getAttribute('aria-hidden'), 'false')
    assert.equal(firstNavigations.length, 0)

    firstWindow.document.querySelector('input[value="markdown"]').click()
    firstWindow.document.querySelector('[data-editor-preference-remember]').checked = true
    firstWindow.document.querySelector('[data-editor-preference-form]').dispatchEvent(new firstWindow.Event('submit', { bubbles: true, cancelable: true }))
    assert.deepEqual(firstNavigations, ['markdown'])
    assert.equal(firstWindow.localStorage.getItem(EDITOR_PREFERENCE_STORAGE_KEY), 'markdown')

    const secondNavigations = []
    initializeEditorPreference(firstWindow.document, firstWindow, { navigate: format => secondNavigations.push(format) })
    assert.deepEqual(secondNavigations, ['markdown'])
})

test('editor preference modal provides interactive language switch buttons for foreign visitors', () => {
    const window = createWindow(EDITOR_PREFERENCE_MODAL('zh-TW', { autoOpen: true }))
    const { document } = window
    initializeEditorPreference(document, window)

    const zhBtn = document.querySelector('[data-editor-pref-lang="zh-TW"]')
    const enBtn = document.querySelector('[data-editor-pref-lang="en-US"]')
    assert.ok(zhBtn, 'zh-TW button should exist')
    assert.ok(enBtn, 'en-US button should exist')
    assert.ok(zhBtn.classList.contains('is-active'))

    const titleEl = document.querySelector('#editor-preference-title')
    assert.equal(titleEl.textContent, '選擇你的編輯方式')

    // Click English switch button
    enBtn.click()
    assert.equal(titleEl.textContent, 'Choose your editor')
    assert.equal(document.querySelector('#editor-preference-description').textContent, 'This sets your default for new notes. You can change it anytime in settings.')
    assert.ok(enBtn.classList.contains('is-active'))
    assert.equal(window.localStorage.getItem('cf-notepad:lang'), 'en-US')

    // Click Traditional Chinese switch button
    zhBtn.click()
    assert.equal(titleEl.textContent, '選擇你的編輯方式')
    assert.ok(zhBtn.classList.contains('is-active'))
    assert.equal(window.localStorage.getItem('cf-notepad:lang'), 'zh-TW')
})

test('share mode combines edit note link and new note menu into a split action capsule', () => {
    assert.ok(SVG_ICONS.edit.includes('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>'))
    assert.ok(SVG_ICONS.editLock.includes('lock-combo-icon'))

    const shareFooter = FOOTER({
        lang: 'zh-TW',
        isEdit: false,
        path: 'note123',
        sharePath: '/share/note123',
    })

    assert.match(shareFooter, /class="split-action-group"/)
    assert.match(shareFooter, /class="toolbar-icon-button split-action-main readonly-edit-link"/)
    assert.match(shareFooter, /class="toolbar-icon-button dropdown-trigger new-note-menu-trigger split-action-dropdown"/)
    assert.match(shareFooter, /<strong>編輯目前這篇筆記<\/strong>/)
    // Non-password note uses standard edit pencil icon, not lock-combo-icon
    assert.ok(shareFooter.includes(SVG_ICONS.edit))
    assert.ok(!shareFooter.includes('readonly-edit-link" data-tooltip="返回編輯" title="返回編輯" aria-label="返回編輯"><svg class="svg-icon lock-combo-icon"'))
})

test('share mode uses editLock icon when authPath is present', () => {
    const protectedFooter = FOOTER({
        lang: 'zh-TW',
        isEdit: false,
        path: 'note123',
        authPath: '/auth/note123',
        sharePath: '/share/note123',
    })

    assert.match(protectedFooter, /id="readonly-edit-btn"/)
    assert.ok(protectedFooter.includes('id="readonly-edit-btn" class="toolbar-icon-button split-action-main"'))
    assert.ok(protectedFooter.includes(SVG_ICONS.editLock))
})

test('split action group styles provide legible icon sizing and min-width', () => {
    const css = getBaseCss()
    assert.match(css, /\.split-action-group \.split-action-main\s*\{[^}]*min-width:\s*32px/)
    assert.match(css, /\.split-action-group \.split-action-main \.svg-icon,\s*\.split-action-group \.split-action-main \.lock-combo-icon\s*\{[^}]*width:\s*17px !important/)
    assert.match(css, /\.split-action-group \.split-action-dropdown \.new-note-plus\s*\{[^}]*font-size:\s*14px/)
})

