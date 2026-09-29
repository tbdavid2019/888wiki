import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const commonTemplate = readFileSync(new URL('../src/templates/common.js', import.meta.url), 'utf8')
const baseCss = readFileSync(new URL('../src/styles/base.css.js', import.meta.url), 'utf8')

test('note history UI uses a separate modal from recent shares', () => {
    assert.match(commonTemplate, /class="modal note-history-modal"/)
    assert.match(commonTemplate, /data-note-history-list/)
    assert.match(commonTemplate, /data-note-history-restore/)
    assert.doesNotMatch(commonTemplate, /data-share-history-tab="history"/)
})

test('footer keeps recent shares and adds a separate history button only on edit pages', () => {
    assert.match(commonTemplate, /id="share-history-btn"/)
    assert.match(commonTemplate, /id="note-history-btn"/)
    assert.match(commonTemplate, /const showNoteHistory = noteHistoryEnabled === true && isEdit/)
})

test('note history and recent shares modals support full dark mode theme variables and styles', () => {
    assert.match(baseCss, /--modal-bg:\s*#1e293b;/)
    assert.match(baseCss, /--modal-border:\s*#334155;/)
    assert.match(baseCss, /--toolbar-fg:\s*#e8ddd8;/)
    assert.match(baseCss, /\.share-history-content\s*\{[\s\S]*background:\s*var\(--modal-bg/)
    assert.match(baseCss, /\.note-history-content\s*\{[\s\S]*background:\s*var\(--modal-bg/)
    assert.match(baseCss, /\.sync-status-badge\s*\{[\s\S]*color:\s*var\(--toolbar-fg/)
    assert.match(baseCss, /\[data-ui-theme="dark"\] \.note-history-body\.markdown-body/)
})
