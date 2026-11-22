import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
    MOTION_LOOP_PERIOD_MS,
    MOTION_LOOP_PRESETS,
    SLIDE_TRANSITIONS,
    normalizeMotionPreset,
    normalizeSlideTransition,
    getMotionLoopLabel,
    getTransitionLabel,
    createPresentationMotionController,
} from '../static/js/presentation-motion.mjs'

import {
    parseMarkdownToSlides,
    createZipUint8Array,
    buildPptxBuffer,
} from '../static/js/pptx-export.mjs'

import {
    PAPER_TEMPLATES,
    getPaperTemplate,
} from '../static/js/paper-templates.mjs'

import {
    extractEditorScrollTokens,
    computeAnchorMappedScrollTop,
} from '../static/js/markdown-extensions.mjs'

test('presentation-motion normalizes presets and transitions with bilingual labels', () => {
    assert.equal(MOTION_LOOP_PERIOD_MS, 12000)
    assert.deepEqual(MOTION_LOOP_PRESETS, ['off', 'aurora', 'mesh', 'orbits'])
    assert.deepEqual(SLIDE_TRANSITIONS, ['fade', 'slide', 'convex', 'zoom', 'none'])

    assert.equal(normalizeMotionPreset('AURORA'), 'aurora')
    assert.equal(normalizeMotionPreset('invalid'), 'off')
    assert.equal(normalizeSlideTransition('CONVEX'), 'convex')
    assert.equal(normalizeSlideTransition('unknown'), 'fade')

    assert.equal(getMotionLoopLabel('aurora', 'zh-TW'), '極光循環')
    assert.equal(getMotionLoopLabel('orbits', 'en-US'), 'Orbits')
    assert.equal(getTransitionLabel('zoom', 'zh-TW'), '縮放')
    assert.equal(getTransitionLabel('slide', 'en-US'), 'Slide')
})

test('presentation-motion controller starts and stops animation safely', () => {
    const originalWindow = globalThis.window
    let nextRafId = 1
    const cancelledIds = []
    const listeners = {}

    globalThis.window = {
        devicePixelRatio: 1,
        innerWidth: 1280,
        innerHeight: 720,
        requestAnimationFrame: () => nextRafId++,
        cancelAnimationFrame: (id) => cancelledIds.push(id),
        addEventListener: (ev, fn) => { listeners[ev] = fn },
        removeEventListener: (ev) => { delete listeners[ev] },
    }

    const classes = new Set()
    const canvas = {
        width: 0,
        height: 0,
        classList: {
            add: (c) => classes.add(c),
            remove: (c) => classes.delete(c),
        },
        getBoundingClientRect: () => ({ width: 1280, height: 720 }),
        getContext: () => ({
            clearRect: () => {},
            setTransform: () => {},
            createRadialGradient: () => ({ addColorStop: () => {} }),
            beginPath: () => {},
            arc: () => {},
            fill: () => {},
            stroke: () => {},
            save: () => {},
            restore: () => {},
            setLineDash: () => {},
        }),
    }

    try {
        const ctrl = createPresentationMotionController(canvas, { preset: 'aurora' })
        assert.equal(ctrl.getPreset(), 'aurora')
        assert.equal(classes.has('active'), true)

        ctrl.setPreset('off')
        assert.equal(ctrl.getPreset(), 'off')
        assert.equal(classes.has('active'), false)
        assert.ok(cancelledIds.length >= 1)

        ctrl.setPreset('orbits')
        assert.equal(classes.has('active'), true)
        ctrl.destroy()
        assert.equal(classes.has('active'), false)
        assert.equal(listeners.resize, undefined)
    } finally {
        globalThis.window = originalWindow
    }
})

test('pptx-export parses Markdown slides, strips YAML frontmatter, and builds valid ZIP/OOXML', () => {
    const md = `---
theme: tokyo-night
transition: slide
motionLoop: aurora
title: Demo Deck
---

<!-- layout: cover -->
# Demo Presentation
## Architecture Overview

---

## Key Highlights

- Fast **edge** rendering {v-click}
- Editable \`pptx\` export & 100% <secure> XML

\`\`\`js
console.log('hello')
\`\`\`

--

## Vertical Detail

> [!NOTE] Important takeaway
`

    const slides = parseMarkdownToSlides(md)
    assert.equal(slides.length, 3)
    assert.equal(slides[0].isCover, true)
    assert.equal(slides[0].title, 'Demo Presentation')
    assert.equal(slides[0].subtitle, 'Architecture Overview')

    assert.equal(slides[1].isCover, false)
    assert.equal(slides[1].title, 'Key Highlights')
    assert.ok(slides[1].blocks.some(b => b.kind === 'bullet' && b.text.includes('Fast edge rendering')))
    assert.ok(slides[1].blocks.some(b => b.kind === 'code' && b.text.includes("console.log('hello')")))

    assert.equal(slides[2].title, 'Vertical Detail')
    assert.ok(slides[2].blocks.some(b => b.kind === 'quote' && b.text.includes('Important takeaway')))

    const pptx = buildPptxBuffer(md, { title: 'Demo Deck', theme: 'tokyo-night', dark: true })
    assert.ok(pptx instanceof Uint8Array)
    assert.ok(pptx.length > 1500)
    // PKZIP local file header signature PK\x03\x04
    assert.equal(pptx[0], 0x50)
    assert.equal(pptx[1], 0x4b)
    assert.equal(pptx[2], 0x03)
    assert.equal(pptx[3], 0x04)

    const text = new TextDecoder().decode(pptx)
    assert.match(text, /\[Content_Types\]\.xml/)
    assert.match(text, /ppt\/presentation\.xml/)
    assert.match(text, /ppt\/slides\/slide1\.xml/)
    assert.match(text, /ppt\/slides\/slide3\.xml/)
    assert.match(text, /&lt;secure&gt;/)
})

test('createZipUint8Array produces valid empty/single-entry archive structure', () => {
    const zip = createZipUint8Array([{ name: 'hello.txt', data: 'world' }])
    assert.equal(zip[0], 0x50)
    assert.equal(zip[1], 0x4b)
    const eocdOffset = zip.length - 22
    assert.equal(zip[eocdOffset], 0x50)
    assert.equal(zip[eocdOffset + 1], 0x4b)
    assert.equal(zip[eocdOffset + 2], 0x05)
    assert.equal(zip[eocdOffset + 3], 0x06)
})

test('paper-templates provides bilingual templates for one-pager, whitepaper, resume, and slides', () => {
    for (const key of Object.keys(PAPER_TEMPLATES)) {
        const zh = getPaperTemplate(key, 'zh-TW')
        const en = getPaperTemplate(key, 'en-US')
        assert.ok(zh.length > 50, `Expected zh-TW template for ${key}`)
        assert.ok(en.length > 50, `Expected en-US template for ${key}`)
    }
    assert.equal(getPaperTemplate('nonexistent', 'zh-TW'), '')
})

test('editor top padding is tightened consistently across gutter and textarea', () => {
    const editorCss = readFileSync(new URL('../src/styles/editor.css.js', import.meta.url), 'utf8')
    assert.match(editorCss, /\.editor-code-shell > textarea\.contents\s*\{[\s\S]*padding:\s*8px 24px 20px 14px/)
    assert.match(editorCss, /\.editor-line-numbers\s*\{[\s\S]*padding:\s*8px 6px 20px 4px/)
})

test('templates and CSS expose motion loops, pptx export, and Kami print rules', () => {
    const common = readFileSync(new URL('../src/templates/common.js', import.meta.url), 'utf8')
    const base = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
    const baseCss = readFileSync(new URL('../src/styles/base.css.js', import.meta.url), 'utf8')

    assert.match(common, /id="export-pptx-btn"/)
    assert.match(common, /data-cp-template="one-pager"/)
    assert.match(common, /data-cp-template="whitepaper"/)
    assert.match(common, /data-cp-template="resume"/)
    assert.match(common, /data-cp-template="meeting"/)
    assert.match(common, /data-cp-template="slides"/)

    assert.match(base, /id="ptb-transition"/)
    assert.match(base, /id="ptb-motion"/)
    assert.match(base, /id="ptb-export-pptx"/)
    assert.match(base, /presentation-motion-canvas/)
    assert.match(base, /extractEditorScrollTokens/)
    assert.match(base, /computeAnchorMappedScrollTop/)

    assert.match(baseCss, /#presentation-motion-canvas/)
    assert.match(baseCss, /prefers-reduced-motion: reduce/)
    assert.match(baseCss, /\.page-break\s*\{[\s\S]*break-before:\s*page/)
    assert.match(baseCss, /@bottom-right\s*\{[\s\S]*counter\(page\)/)

    const pdfSvc = readFileSync(new URL('../src/pdf_service.mjs', import.meta.url), 'utf8')
    assert.match(pdfSvc, /break-after:\s*avoid/)
    assert.match(pdfSvc, /\.github-alert,\s*\.markdown-alert,\s*\.column-layout/)

    const skillDoc = readFileSync(new URL('../skills/SKILL.md', import.meta.url), 'utf8')
    assert.match(skillDoc, /### H\.4 Print-Ready Layouts/)
    assert.match(skillDoc, /page-break/)
})

test('extractEditorScrollTokens and computeAnchorMappedScrollTop keep [toc] and headings aligned', () => {
    const md = `---
title: Test
---

# Title

[toc]

\`\`\`md
# Not a real heading
[toc]
\`\`\`

## Section One

Paragraph

## Section Two`

    const tokens = extractEditorScrollTokens(md)
    assert.deepEqual(tokens, [
        { kind: 'heading', line: 4 },
        { kind: 'toc', line: 6 },
        { kind: 'heading', line: 13 },
        { kind: 'heading', line: 17 },
    ])

    // Simulate a 1-line [toc] (y=120..145) expanding to 500px (y=100..600) in preview
    const anchors = [
        { src: 0, dst: 0 },
        { src: 120, dst: 100 },
        { src: 145, dst: 600 },
        { src: 300, dst: 800 },
        { src: 1000, dst: 2000 },
    ]
    assert.equal(computeAnchorMappedScrollTop(120, anchors, 'forward'), 100)
    assert.equal(computeAnchorMappedScrollTop(145, anchors, 'forward'), 600)
    assert.equal(computeAnchorMappedScrollTop(300, anchors, 'forward'), 800)
    assert.equal(computeAnchorMappedScrollTop(800, anchors, 'reverse'), 300)
    assert.equal(computeAnchorMappedScrollTop(600, anchors, 'reverse'), 145)
    assert.equal(computeAnchorMappedScrollTop(-10, anchors, 'forward'), 0)
})
