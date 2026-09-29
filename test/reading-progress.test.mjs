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

test('distinguishes major headings (#, ##) and minor subheadings (###+) with dash and dot markers', () => {
    const dom = new JSDOM(`
        <html lang="zh-Hant-TW">
        <body>
            <div class="preview-pane">
                <div id="preview-md">
                    <h1 id="h1">第一篇</h1>
                    <h2 id="h2">大章節</h2>
                    <h3 id="h3">子小節</h3>
                    <h4 id="h4">細節段落</h4>
                </div>
            </div>
        </body>
        </html>
    `)
    const preview = dom.window.document.querySelector('#preview-md')
    Object.defineProperties(preview, {
        clientHeight: { value: 500 },
        scrollHeight: { value: 1200 },
    })

    assert.equal(initReadingProgress(dom.window.document), true)
    const markers = dom.window.document.querySelectorAll('.reading-progress-marker')
    assert.equal(markers.length, 4)

    // H1 and H2 are major (dash)
    assert.equal(markers[0].classList.contains('is-heading-major'), true)
    assert.equal(markers[1].classList.contains('is-heading-major'), true)

    // H3 and H4 are minor (dot)
    assert.equal(markers[2].classList.contains('is-heading-minor'), true)
    assert.equal(markers[3].classList.contains('is-heading-minor'), true)
})

test('renders slide-out TOC drawer and interactive outline controls on share view', () => {
    const dom = new JSDOM(`
        <html lang="zh-Hant-TW">
        <body class="share-view">
            <div id="preview-md">
                <h1 id="intro">系統介紹</h1>
                <h2 id="install">安裝步驟</h2>
                <h3 id="config">設定參數</h3>
            </div>
        </body>
        </html>
    `)
    const preview = dom.window.document.querySelector('#preview-md')
    let scrolledTo = null
    preview.scrollTo = options => { scrolledTo = options }
    Object.defineProperties(preview, {
        clientHeight: { value: 600 },
        scrollHeight: { value: 1800 },
    })

    assert.equal(initReadingProgress(dom.window.document), true)
    const widget = dom.window.document.querySelector('.reading-progress')
    assert.equal(widget.classList.contains('has-drawer'), true)

    // Toggle button and TOC drawer exist
    const toggleBtn = dom.window.document.querySelector('.reading-progress-toggle-btn')
    const drawer = dom.window.document.querySelector('.reading-toc-drawer')
    assert.ok(toggleBtn)
    assert.ok(drawer)

    // TOC items
    const tocItems = drawer.querySelectorAll('.reading-toc-item')
    assert.equal(tocItems.length, 3)
    assert.equal(tocItems[0].querySelector('.reading-toc-item-text').textContent, '系統介紹')
    assert.equal(tocItems[0].classList.contains('is-level-major'), true)
    assert.equal(tocItems[2].querySelector('.reading-toc-item-text').textContent, '設定參數')
    assert.equal(tocItems[2].classList.contains('is-level-minor'), true)

    // Toggle button opens and pins drawer
    toggleBtn.dispatchEvent(new dom.window.Event('click'))
    assert.equal(widget.classList.contains('is-drawer-open'), true)
    assert.equal(widget.classList.contains('is-pinned'), true)

    // Pin button toggles pin state
    const pinBtn = drawer.querySelector('.reading-toc-pin-btn')
    assert.ok(pinBtn)
    pinBtn.dispatchEvent(new dom.window.Event('click'))
    assert.equal(widget.classList.contains('is-pinned'), false)

    // Clicking a TOC item scrolls to heading
    tocItems[1].dispatchEvent(new dom.window.Event('click'))
    assert.ok(scrolledTo)
    assert.equal(scrolledTo.behavior, 'smooth')

    // Close button closes drawer
    const closeBtn = drawer.querySelector('.reading-toc-close-btn')
    assert.ok(closeBtn)
    closeBtn.dispatchEvent(new dom.window.Event('click'))
    assert.equal(widget.classList.contains('is-drawer-open'), false)

    // Escape closes even when drawer is pinned
    toggleBtn.dispatchEvent(new dom.window.Event('click'))
    assert.equal(widget.classList.contains('is-pinned'), true)
    assert.equal(widget.classList.contains('is-drawer-open'), true)
    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }))
    assert.equal(widget.classList.contains('is-drawer-open'), false)
    assert.equal(widget.classList.contains('is-pinned'), false)
})

