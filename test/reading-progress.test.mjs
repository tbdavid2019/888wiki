import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

import { getReadingProgress, initReadingProgress } from '../static/js/reading-progress.mjs'

const baseTemplate = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const baseCss = readFileSync(new URL('../src/styles/base.css.js', import.meta.url), 'utf8')

test('calculates reading progress from a scroll container', () => {
    assert.deepEqual(getReadingProgress({ scrollTop: 125, scrollHeight: 1000, clientHeight: 500 }), {
        percent: 25,
        maxScroll: 500,
        isScrollable: true,
    })
    assert.deepEqual(getReadingProgress({ scrollTop: 0, scrollHeight: 400, clientHeight: 500 }), {
        percent: 0,
        maxScroll: 0,
        isScrollable: false,
    })
})

test('loads a reading progress widget for rendered Markdown pages', () => {
    assert.match(baseTemplate, /src="\/js\/reading-progress\.mjs"/)
    assert.match(baseCss, /\.reading-progress/)
    assert.match(baseCss, /\.reading-progress-track/)
})

test('centers the reading progress control on the left side of share and edit previews', () => {
    assert.match(
        baseCss,
        /body\.share-view \.reading-progress\s*\{[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\);/,
    )
    assert.match(
        baseCss,
        /body:not\(\.share-view\) \.preview-pane \.reading-progress\s*\{[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\);/,
    )
})

test('uses GenJyuu Gothic for Chinese while preserving the existing Latin font stack', () => {
    assert.match(baseCss, /font-family: "GenJyuu Gothic CJK"/)
    assert.match(baseCss, /GenJyuuGothic-Medium\.woff2/)
    assert.match(baseCss, /unicode-range:/)
    assert.match(baseCss, /--editor-font-family: "GenJyuu Gothic CJK", "Maple Mono"/)
})

test('keeps the editor preview on the CJK-aware font stack after a theme is applied', () => {
    assert.match(baseTemplate, /body:not\(\.share-view\) #preview-md\.markdown-body,[\s\S]*font-family: var\(--editor-font-family\);/)
    assert.match(baseTemplate, /body:not\(\.share-view\) #preview-md\.markdown-body :is\([\s\S]*font-family: var\(--editor-font-family\);/)
})

test('updates the rendered reading progress widget as the preview scrolls', () => {
    const dom = new JSDOM('<html lang="zh-Hant-TW"><body><div class="preview-pane"><div id="preview-md"></div></div></body></html>')
    const preview = dom.window.document.querySelector('#preview-md')
    Object.defineProperties(preview, {
        clientHeight: { value: 500 },
        scrollHeight: { value: 1000 },
    })

    assert.equal(initReadingProgress(dom.window.document), true)
    assert.equal(dom.window.document.querySelector('.reading-progress-value').textContent, '0%')

    preview.scrollTop = 250
    preview.dispatchEvent(new dom.window.Event('scroll'))
    assert.equal(dom.window.document.querySelector('.reading-progress-value').textContent, '50%')
})

test('uses IntersectionObserver to show the active Markdown section', () => {
    const dom = new JSDOM('<html lang="zh-Hant-TW"><body><div class="preview-pane"><div id="preview-md"><h2 id="intro">前言</h2><h2 id="chapter">第二章</h2></div></div></body></html>')
    const preview = dom.window.document.querySelector('#preview-md')
    const observers = []
    class MockIntersectionObserver {
        constructor(callback, options) {
            this.callback = callback
            this.options = options
            this.targets = []
            observers.push(this)
        }
        observe(target) { this.targets.push(target) }
        disconnect() {}
    }
    dom.window.IntersectionObserver = MockIntersectionObserver
    Object.defineProperties(preview, {
        clientHeight: { value: 500 },
        scrollHeight: { value: 1000 },
    })

    initReadingProgress(dom.window.document)
    assert.equal(observers[0].options.root, preview)
    assert.equal(observers[0].targets.length, 2)
    assert.equal(dom.window.document.querySelectorAll('.reading-progress-marker').length, 2)

    observers[0].callback([{
        target: preview.querySelector('#chapter'),
        isIntersecting: true,
        boundingClientRect: { top: 90 },
    }])
    const track = dom.window.document.querySelector('.reading-progress-track')
    assert.equal(dom.window.document.querySelector('.reading-progress-value').textContent, '0% · 2/2')
    assert.match(track.getAttribute('aria-label'), /第 2 \/ 2 節：第二章/)
    assert.equal(dom.window.document.querySelectorAll('.reading-progress-marker.is-active').length, 1)
})
