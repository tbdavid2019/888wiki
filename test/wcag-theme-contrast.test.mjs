import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { THEMES } from '../src/theme_data.js'
import { getMarkdownCss } from '../src/styles/markdown.css.js'
import { DARK_PREVIEW_THEMES } from '../src/constant.js'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const baseCssSource = readFileSync(new URL('../src/styles/base.css.js', import.meta.url), 'utf8')
const markdownCssSource = getMarkdownCss()

function parseColor(str) {
    if (!str) return null
    const s = str.trim().toLowerCase()
    if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
    if (['inherit', 'initial', 'unset', 'currentcolor'].includes(s)) return { keyword: s }
    if (s === 'white') return { r: 255, g: 255, b: 255, a: 1 }
    if (s === 'black') return { r: 0, g: 0, b: 0, a: 1 }
    let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
    if (m) {
        let h = m[1]
        if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('')
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
            a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
        }
    }
    m = s.match(/^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)(?:\s*[,/]\s*([\d.%]+))?\s*\)$/)
    if (m) {
        let a = 1
        if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
        return { r: +m[1], g: +m[2], b: +m[3], a }
    }
    return null
}

function splitTopCommas(s) {
    const parts = []
    let depth = 0
    let start = 0
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '(') depth++
        else if (s[i] === ')') depth--
        else if (s[i] === ',' && depth === 0) {
            parts.push(s.slice(start, i).trim())
            start = i + 1
        }
    }
    parts.push(s.slice(start).trim())
    return parts
}

function blend(fg, bg) {
    const a = fg.a ?? 1
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }
}

function luminance({ r, g, b }) {
    const [rs, gs, bs] = [r, g, b].map(v => {
        const n = v / 255
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrast(c1, c2) {
    const l1 = luminance(c1)
    const l2 = luminance(c2)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function worstContrast(fg, bgOrList) {
    const bgs = Array.isArray(bgOrList) ? bgOrList : [bgOrList]
    let min = Infinity
    for (const b of bgs) {
        const f = fg.a < 1 ? blend(fg, b) : fg
        min = Math.min(min, contrast(f, b))
    }
    return min
}

function resolveLayeredBg(bgProp, bgColorProp, parentBg) {
    let base = Array.isArray(parentBg) ? parentBg[0] : parentBg
    if (bgColorProp) {
        const c = parseColor(bgColorProp)
        if (c && !c.keyword) base = c.a === 0 ? base : (c.a < 1 ? blend(c, base) : c)
    }
    if (!bgProp || /^(none|transparent)$/i.test(bgProp.trim())) return base
    const direct = parseColor(bgProp.trim().split(/\s+/)[0])
    if (direct && !bgProp.includes('gradient(')) {
        if (direct.keyword) return base
        return direct.a === 0 ? base : (direct.a < 1 ? blend(direct, base) : direct)
    }
    const layers = splitTopCommas(bgProp).reverse()
    let curBgs = [base]
    for (const layer of layers) {
        const grads = [...layer.matchAll(/(#[0-9a-f]{3,8}|rgba?\([^)]+\)|transparent)/gi)].map(m => parseColor(m[1])).filter(Boolean)
        if (grads.length === 0) continue
        const opaque = grads.filter(c => c.a === 1)
        const semi = grads.filter(c => c.a > 0 && c.a < 1)
        if (layer.includes('linear-gradient')) {
            if (opaque.length > 0) curBgs = opaque
            else if (semi.length > 0) curBgs = curBgs.flatMap(b => [b, ...semi.map(s => blend(s, b))])
        } else if (layer.includes('radial-gradient')) {
            if (semi.length > 0) curBgs = curBgs.flatMap(b => [b, ...semi.map(s => blend(s, b))])
        } else {
            const c = grads[0]
            if (c.a === 1) curBgs = [c]
            else if (c.a > 0) curBgs = curBgs.map(b => blend(c, b))
        }
    }
    return curBgs.length === 1 ? curBgs[0] : curBgs
}

function specificity(sel) {
    const noWhere = sel.includes(':where(') ? sel.replace(/:where\([^)]*\)/g, ' ') : sel
    const clean = noWhere.replace(/:not\(([^)]*)\)/g, ' $1 ')
    const ids = (clean.match(/#[a-z0-9_-]+/gi) || []).length
    const classes = (clean.match(/\.[a-z0-9_-]+|\[[^\]]+\]|:(?!:)[a-z-]+(?:\([^)]*\))?/gi) || []).length
    const pseudoEls = (clean.match(/::[a-z-]+/gi) || []).length
    const stripped = clean.replace(/#[a-z0-9_-]+|\.[a-z0-9_-]+|\[[^\]]+\]|::?[a-z-]+(?:\([^)]*\))?/gi, ' ')
    const types = (stripped.match(/\b[a-z][a-z0-9]*\b/gi) || []).length
    return ids * 10000 + classes * 100 + (types + pseudoEls)
}

function parseCss(css, sourceOrderStart = 0) {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{([\s\S]*?\})\s*\}/g, '')
    const rules = []
    const re = /([^{}]+)\{([^{}]*)\}/g
    let m
    let idx = sourceOrderStart
    while ((m = re.exec(clean)) !== null) {
        const decls = {}
        for (const part of m[2].split(';')) {
            const i = part.indexOf(':')
            if (i === -1) continue
            decls[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim()
        }
        for (const rawSel of m[1].split(',')) {
            const sel = rawSel.trim().replace(/\s+/g, ' ')
            if (!sel) continue
            rules.push({ sel, spec: specificity(sel), order: idx++, decls })
        }
    }
    return rules
}

function evalSelectors(allRules, matchingSelectors) {
    const matched = allRules.filter(r => matchingSelectors.includes(r.sel))
    matched.sort((a, b) => a.spec - b.spec || a.order - b.order)
    const out = {}
    for (const r of matched) Object.assign(out, r.decls)
    return out
}

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

test('markdown.css.js uses low-specificity :where() fallbacks for tables and alerts', () => {
    assert.match(markdownCssSource, /:where\(\.markdown-body\)\s+table\s*\{/)
    assert.match(markdownCssSource, /:where\(\.markdown-body\s+table\)\s+th,\s*:where\(\.markdown-body\s+table\)\s+td\s*\{/)
    assert.match(markdownCssSource, /:where\(\.markdown-alert\)\s*\{/)
    assert.match(markdownCssSource, /:where\(\.markdown-alert-note\)::before\s*\{/)
})

test('all 20 themes declare explicit backgrounds, >= 16px body size, scrollable tables, and WCAG AA cascade contrast', () => {
    const baseRules = parseCss(markdownCssSource, 0)
    const darkSet = new Set(DARK_PREVIEW_THEMES)
    const themeNames = Object.keys(THEMES)
    assert.equal(themeNames.length, 20, 'exactly 20 bundled themes should exist')

    for (const name of themeNames) {
        const rules = [...baseRules, ...parseCss(THEMES[name], 10000)]
        const root = evalSelectors(rules, ['.markdown-body'])
        assert.ok(root['background-color'] || root['background'], `${name}: .markdown-body must declare explicit background`)
        assert.equal(root['font-size'] || '16px', '16px', `${name}: desktop base font-size should be 16px`)

        const fallbackBg = darkSet.has(name) ? { r: 19, g: 27, b: 36, a: 1 } : { r: 255, g: 255, b: 255, a: 1 }
        const rootBg = resolveLayeredBg(root['background'], root['background-color'], fallbackBg)
        const rootBg1 = Array.isArray(rootBg) ? rootBg[0] : rootBg
        const rootColor = parseColor(root['color']) || { r: 36, g: 41, b: 47, a: 1 }

        // Tables must not disable horizontal overflow scrolling
        const tbl = evalSelectors(rules, [':where(.markdown-body) table', '.markdown-body table'])
        assert.notEqual(tbl['overflow'], 'hidden', `${name}: .markdown-body table must not use overflow: hidden`)

        // Table headers, cells, and zebra rows >= 4.5:1
        const thead = evalSelectors(rules, ['.markdown-body thead', '.markdown-body table thead'])
        const thInThead = evalSelectors(rules, [':where(.markdown-body table) th', '.markdown-body th', '.markdown-body table th', '.markdown-body thead th', '.markdown-body table thead th'])
        const td = evalSelectors(rules, [':where(.markdown-body table) td', '.markdown-body td', '.markdown-body table td', '.markdown-body tbody td'])
        const trEven = evalSelectors(rules, ['.markdown-body tr:nth-child(even)', '.markdown-body tbody tr:nth-child(even)'])

        const tblBg = resolveLayeredBg(tbl['background'], tbl['background-color'], rootBg1)
        const theadBg = resolveLayeredBg(thead['background'], thead['background-color'], Array.isArray(tblBg) ? tblBg[0] : tblBg)
        const thBg = resolveLayeredBg(thInThead['background'], thInThead['background-color'], Array.isArray(theadBg) ? theadBg[0] : theadBg)
        const thColor = parseColor(thInThead['color'] || thead['color']) || rootColor
        const tdBg = resolveLayeredBg(td['background'], td['background-color'], Array.isArray(tblBg) ? tblBg[0] : tblBg)
        const tdColor = parseColor(td['color']) || rootColor
        const evenBg = resolveLayeredBg(trEven['background'], trEven['background-color'], Array.isArray(tdBg) ? tdBg[0] : tdBg)
        const evenColor = parseColor(td['color'] || trEven['color']) || tdColor

        assert.ok(worstContrast(thColor, thBg) >= 4.5, `${name}: thead th contrast < 4.5`)
        assert.ok(worstContrast(tdColor, tdBg) >= 4.5, `${name}: td contrast < 4.5`)
        assert.ok(worstContrast(evenColor, evenBg) >= 4.5, `${name}: even tr contrast < 4.5`)

        // Blockquotes >= 4.5:1 (both blockquote and blockquote p)
        const bq = evalSelectors(rules, ['.markdown-body blockquote'])
        const bqP = evalSelectors(rules, ['.markdown-body blockquote p'])
        const bqBg = resolveLayeredBg(bq['background'], bq['background-color'], rootBg1)
        const bqCol = parseColor(bq['color'] || '#6a737d')
        const bqPCol = parseColor(bqP['color']) || bqCol
        assert.ok(worstContrast(bqCol, bqBg) >= 4.5, `${name}: blockquote contrast < 4.5`)
        assert.ok(worstContrast(bqPCol, bqBg) >= 4.5, `${name}: blockquote p contrast < 4.5`)

        // Prose & inline elements
        for (const el of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'strong', 'em', 'del', 'small', 'kbd', 'mark', 'code']) {
            const p = evalSelectors(rules, [`:where(.markdown-body) ${el}`, `.markdown-body ${el}`])
            const bg = resolveLayeredBg(p['background'], p['background-color'], rootBg1)
            const parsedCol = parseColor(p['color'] || (el === 'a' ? '#0366d6' : null))
            const col = (!parsedCol || parsedCol.keyword) ? rootColor : parsedCol
            const req = (el === 'h1' || el === 'h2' || el === 'h3') ? 3.0 : 4.5
            assert.ok(worstContrast(col, bg) >= req, `${name}: ${el} contrast < ${req}`)
        }

        // GitHub Alerts body + ::before title >= 4.5:1
        for (const an of ['note', 'tip', 'important', 'warning', 'caution']) {
            const box = evalSelectors(rules, [
                ':where(.markdown-alert)', '.markdown-alert', '.markdown-body .markdown-alert',
                `:where(.markdown-alert-${an})`, `.markdown-alert-${an}`, `.markdown-body .markdown-alert-${an}`,
            ])
            const before = evalSelectors(rules, [
                `:where(.markdown-alert-${an})::before`, `.markdown-alert-${an}::before`, `.markdown-body .markdown-alert-${an}::before`,
            ])
            const boxBg = resolveLayeredBg(box['background'], box['background-color'], rootBg1)
            const boxCol = parseColor(box['color']) || rootColor
            const befCol = parseColor(before['color']) || boxCol
            assert.ok(worstContrast(boxCol, boxBg) >= 4.5, `${name}: alert-${an} body contrast < 4.5`)
            assert.ok(worstContrast(befCol, boxBg) >= 4.5, `${name}: alert-${an} ::before title contrast < 4.5`)
        }
    }
})
