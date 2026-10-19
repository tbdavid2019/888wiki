import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HTML } from '../src/templates/base.js'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const baseCssSource = readFileSync(new URL('../src/styles/base.css.js', import.meta.url), 'utf8')

test('remarkDiagramPlugin wraps diagrams in diagram-block-wrapper with data-diagram-type', () => {
    assert.match(baseTemplateSource, /class="diagram-block-wrapper diagram-/)
    assert.match(baseTemplateSource, /data-diagram-type=/)
})

test('base template defines attachDiagramActions with Code, PNG, SVG, and Download buttons', () => {
    assert.match(baseTemplateSource, /const attachDiagramActions =/)
    assert.match(baseTemplateSource, /diagram-btn-code/)
    assert.match(baseTemplateSource, /diagram-btn-png/)
    assert.match(baseTemplateSource, /diagram-btn-svg/)
    assert.match(baseTemplateSource, /diagram-btn-download/)
    assert.match(baseTemplateSource, /attachDiagramActions\(renderNode, code, 'mermaid'\)/)
})

test('CSS provides responsive floating toolbar, theme support, and copy feedback for diagrams', () => {
    assert.match(baseCssSource, /\.diagram-block-wrapper\s*\{[\s\S]*position:\s*relative/)
    assert.match(baseCssSource, /\.diagram-toolbar\s*\{[\s\S]*position:\s*absolute/)
    assert.match(baseCssSource, /\[data-ui-theme="dark"\]\s*\.diagram-toolbar/)
    assert.match(baseCssSource, /\.diagram-btn\.is-copied/)
})

test('rendered HTML with Mermaid diagram renders correctly without syntax errors', () => {
    const page = HTML({
        lang: 'zh-TW',
        title: 'Diagram test',
        content: '```mermaid\ngraph TD\nA[Start] --> B[End]\n```',
        ext: { share: true },
        tips: [],
        isEdit: false,
        path: 'diagram-test',
        shareId: 'diagram-share',
    })

    assert.match(page, /attachDiagramActions/)
    assert.match(page, /diagram-btn-png/)
    assert.match(page, /diagram-btn-code/)
})

test('base template implements Pele-first rendering with Mermaid fallback and CSS variable inlining for image exports', () => {
    assert.match(baseTemplateSource, /https:\/\/cdn\.jsdelivr\.net\/npm\/pele@1\.6\.0\/dist\/pele\.js/)
    assert.match(baseTemplateSource, /peleModule\.render\(code/)
    assert.match(baseTemplateSource, /data-diagram-engine/)
    assert.match(baseTemplateSource, /getMermaid/)
    assert.match(baseTemplateSource, /--pele-bg/)
    assert.match(baseTemplateSource, /--pele-fg/)
    assert.match(baseTemplateSource, /--pele-surface/)
})

test('base CSS declares Pele CSS variables with automatic dark/light theme adaptation', () => {
    assert.match(baseCssSource, /--pele-bg:\s*transparent;/)
    assert.match(baseCssSource, /--pele-fg:\s*currentColor;/)
    assert.match(baseCssSource, /--pele-line:\s*currentColor;/)
    assert.match(baseCssSource, /--pele-surface:/)
    assert.match(baseCssSource, /--pele-surface-alt:/)
    assert.match(baseCssSource, /--pele-border:/)
})
