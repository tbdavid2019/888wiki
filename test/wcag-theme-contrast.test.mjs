import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { THEMES } from '../src/theme_data.js'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const baseCssSource = readFileSync(new URL('../src/styles/base.css.js', import.meta.url), 'utf8')

test('ayu-light theme meets WCAG AA contrast requirements', () => {
    const css = THEMES['ayu-light']
    assert.ok(css, 'ayu-light theme exists')
    // Links recalibrated to #a05600 (>= 4.5:1 on white)
    assert.match(css, /\.markdown-body a\s*\{[\s\S]*?color:\s*#a05600/i)
    // Inline code recalibrated to #b83232 (>= 4.5:1)
    assert.match(css, /\.markdown-body code\s*\{[\s\S]*?color:\s*#b83232/i)
    // Secondary text / headings recalibrated to #505c6d (>= 4.5:1)
    assert.match(css, /\.markdown-body h4\s*\{[\s\S]*?color:\s*#505c6d/i)
    // Alerts recalibrated
    assert.match(css, /\.markdown-alert-note\s*\{[\s\S]*?border-left-color:\s*#1b7a99/i)
    assert.match(css, /\.markdown-alert-tip\s*\{[\s\S]*?border-left-color:\s*#2b7a1e/i)
    assert.match(css, /\.markdown-alert-warning\s*\{[\s\S]*?border-left-color:\s*#945700/i)
    assert.match(css, /\.markdown-alert-caution\s*\{[\s\S]*?border-left-color:\s*#b83232/i)
    assert.match(css, /\.markdown-alert-important\s*\{[\s\S]*?border-left-color:\s*#7448a3/i)
})

test('retro theme provides Win95 document window with high contrast body and borders', () => {
    const css = THEMES['retro']
    assert.ok(css, 'retro theme exists')
    // Document window body on white with sunken bevel
    assert.match(css, /\.markdown-body\s*\{[\s\S]*?background-color:\s*#ffffff/i)
    assert.match(css, /\.markdown-body\s*\{[\s\S]*?color:\s*#111111/i)
    assert.match(css, /\.markdown-body\s*\{[\s\S]*?border-color:\s*#808080 #ffffff #ffffff #808080/i)
    assert.match(css, /\.markdown-body\s*\{[\s\S]*?box-shadow:\s*inset 1px 1px 0 #000, 1px 1px 0 #fff/i)
    // Links classic blue #0000cc
    assert.match(css, /\.markdown-body a\s*\{[\s\S]*?color:\s*#0000cc/i)
    // Red bold #cc0000
    assert.match(css, /\.markdown-body strong,\s*\.markdown-body b\s*\{[\s\S]*?color:\s*#cc0000/i)
    // Secondary text #555555
    assert.match(css, /\.markdown-body small\s*\{[\s\S]*?color:\s*#555555/i)
})

test('green-simple theme recalibrates green links/bold and muted text', () => {
    const css = THEMES['green-simple']
    assert.ok(css, 'green-simple theme exists')
    assert.match(css, /\.markdown-body a\s*\{[\s\S]*?color:\s*#13795b/i)
    assert.match(css, /\.markdown-body strong,\s*\.markdown-body b\s*\{[\s\S]*?color:\s*#13795b/i)
    assert.match(css, /\.markdown-body del,\s*\.markdown-body s,\s*\.markdown-body strike\s*\{[\s\S]*?color:\s*#595959/i)
})

test('organic theme recalibrates terracotta accents and secondary text', () => {
    const css = THEMES['organic']
    assert.ok(css, 'organic theme exists')
    assert.match(css, /\.markdown-body a\s*\{[\s\S]*?color:\s*#9e4414/i)
    assert.match(css, /\.markdown-body small\s*\{[\s\S]*?color:\s*#5c554e/i)
})

test('playful-geometric theme recalibrates pink and purple accents', () => {
    const css = THEMES['playful-geometric']
    assert.ok(css, 'playful-geometric theme exists')
    assert.match(css, /#be185d/i)
    assert.match(css, /#6d28d9/i)
    assert.doesNotMatch(css, /#f472b6/i)
    assert.doesNotMatch(css, /#8b5cf6/i)
})

test('sketch, claude-canvas, notion-clean, and professional recalibrate accent contrasts', () => {
    assert.match(THEMES['sketch'], /#b91c1c/i)
    assert.doesNotMatch(THEMES['sketch'], /#ff4d4d/i)

    assert.match(THEMES['claude-canvas'], /#9e472a/i)
    assert.doesNotMatch(THEMES['claude-canvas'], /#cc785c/i)

    assert.match(THEMES['notion-clean'], /\.markdown-body code\s*\{[\s\S]*?color:\s*#b92525/i)

    assert.match(THEMES['professional'], /\.markdown-body a\s*\{[\s\S]*?color:\s*#855a00/i)
})

test('Pele variables meet WCAG 1.4.11 boundary contrast guidelines', () => {
    assert.match(baseCssSource, /--pele-border:\s*color-mix\(in srgb, currentColor 45%, transparent\);/)
    assert.match(baseCssSource, /--pele-surface:\s*color-mix\(in srgb, currentColor 8%, transparent\);/)
    assert.match(baseCssSource, /--pele-muted:\s*color-mix\(in srgb, currentColor 78%, transparent\);/)
})

test('base template initializes diagrams with dynamic dark/light context matching', () => {
    assert.match(baseTemplateSource, /const isDarkContext =/)
    assert.match(baseTemplateSource, /theme:\s*isDark \? 'dark' : 'neutral'/)
    assert.match(baseTemplateSource, /renderEchartsChart\(el, source, window\.echarts, chartTheme\)/)
})
