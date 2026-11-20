/**
 * Unified Markdown Processor for CF-Notepad / David888 Wiki
 * Provides stateless render, parse, extract, and lint utilities.
 */

import { THEMES } from './theme_data.js'
import { protectCurrencyDollarSigns } from '../static/js/markdown-extensions.mjs'

/**
 * Escapes HTML characters
 */
function escapeHtml(str) {
    if (!str) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/**
 * Renders Markdown text to HTML string
 * @param {string} markdown - Input markdown string
 * @param {object} options - Optional rendering options (theme, fullHtml, title)
 * @returns {string} HTML string
 */
export function renderMarkdownToHtml(markdown = '', options = {}) {
    if (typeof markdown !== 'string') markdown = String(markdown || '')
    markdown = protectCurrencyDollarSigns(markdown)
    const { theme = 'claude-canvas', fullHtml = false, title = 'Document' } = options

    const lines = markdown.split(/\r?\n/)
    const htmlParts = []
    let inCodeBlock = false
    let codeLanguage = ''
    let codeBuffer = []
    let inList = false
    let listType = 'ul'
    let inTable = false
    let tableBuffer = []

    function flushCode() {
        if (!inCodeBlock) return
        const escaped = escapeHtml(codeBuffer.join('\n'))
        const langClass = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : ''
        htmlParts.push(`<pre><code${langClass}>${escaped}</code></pre>`)
        inCodeBlock = false
        codeLanguage = ''
        codeBuffer = []
    }

    function flushList() {
        if (!inList) return
        htmlParts.push(`</${listType}>`)
        inList = false
    }

    function flushTable() {
        if (!inTable) return
        if (tableBuffer.length > 0) {
            let tableHtml = '<table>'
            let isHeader = true
            for (let i = 0; i < tableBuffer.length; i++) {
                const row = tableBuffer[i].trim()
                if (/^\|?[\s-:]+\|[\s-:|]*$/.test(row)) {
                    isHeader = false
                    continue
                }
                const cells = row.replace(/^\|/, '').replace(/\|$/, '').split('|')
                const tag = isHeader ? 'th' : 'td'
                tableHtml += '<tr>' + cells.map(c => `<${tag}>${renderInline(c.trim())}</${tag}>`).join('') + '</tr>'
                if (isHeader) isHeader = false
            }
            tableHtml += '</table>'
            htmlParts.push(tableHtml)
        }
        inTable = false
        tableBuffer = []
    }

    function renderInline(text) {
        if (!text) return ''
        let res = escapeHtml(text)

        // Inline code: `code`
        res = res.replace(/`([^`]+)`/g, '<code>$1</code>')

        // Bold: **text** or __text__
        res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        res = res.replace(/__([^_]+)__/g, '<strong>$1</strong>')

        // Italic: *text* or _text_
        res = res.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
        res = res.replace(/(^|[^_])_([^_]+)_(?!_)/g, '$1<em>$2</em>')

        // Strikethrough: ~~text~~
        res = res.replace(/~~([^~]+)~~/g, '<del>$1</del>')

        // Math inline: $...$
        res = res.replace(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g, '<span class="math-inline">$1</span>')

        // Highlight: ==text==
        res = res.replace(/==([^=\n]+)==/g, '<mark class="markdown-highlight">$1</mark>')

        const sanitizeCssColor = (val) => {
            const s = String(val || '').trim()
            if (/^#[0-9a-f]{3,8}$/i.test(s)) return s
            if (/^[a-z]{1,24}$/i.test(s)) return s
            if (/^(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s]+\)$/i.test(s)) return s
            return ''
        }

        const sanitizeSafeUrl = (rawUrl, allowImageData = false) => {
            const trimmed = String(rawUrl || '').trim()
            if (!trimmed) return ''
            const unescaped = trimmed.replace(/&amp;/gi, '&')
            if (/^(?:#|\/(?!\/)|\.\/|\.\.\/)/.test(unescaped)) return trimmed
            if (allowImageData && /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(unescaped)) {
                return trimmed
            }
            try {
                const parsed = new URL(unescaped)
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
                    return trimmed
                }
            } catch {
                // Relative path without leading slash (e.g. "docs/guide.md")
                if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(unescaped.replace(/[\x00-\x20]/g, ''))) {
                    return trimmed
                }
            }
            return ''
        }

        // Custom Color: [color=red]...[/color] or [color=red bg=yellow]...[/color]
        res = res.replace(/\[color=([#a-zA-Z0-9_().,% -]+)(?:\s+bg=([#a-zA-Z0-9_().,% -]+))?\]([\s\S]*?)\[\/color\]/gi, (m, color, bg, content) => {
            const safeColor = sanitizeCssColor(color)
            const safeBg = sanitizeCssColor(bg)
            const styles = [safeColor ? `color: ${safeColor}` : '', safeBg ? `background-color: ${safeBg}` : ''].filter(Boolean).join('; ')
            return styles ? `<span style="${styles}">${content}</span>` : content
        })
        res = res.replace(/\[bg=([#a-zA-Z0-9_().,% -]+)\]([\s\S]*?)\[\/bg\]/gi, (m, bg, content) => {
            const safeBg = sanitizeCssColor(bg)
            return safeBg ? `<span style="background-color: ${safeBg}">${content}</span>` : content
        })

        // Pandoc Citation: [@key] or [@key, locator]
        res = res.replace(/\[@([a-zA-Z0-9_\-]+)(?:,\s*([^\]]+))?\]/g, (m, key, loc) => {
            const locAttr = loc ? ` data-locator="${loc}"` : ''
            const locText = loc ? `, ${loc}` : ''
            return `<cite class="pandoc-citation"><a href="#fn-${key}" class="citation-ref" data-citation-key="${key}"${locAttr}>[@${key}${locText}]</a></cite>`
        })

        // Footnote references: [^key]
        res = res.replace(/\[\^([a-zA-Z0-9_\-]+)\]/g, '<sup class="footnote-ref"><a href="#fn-$1" id="fnref-$1" data-footnote-ref>$1</a></sup>')

        // Images: ![alt](url)
        res = res.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, rawUrl) => {
            const safeSrc = sanitizeSafeUrl(rawUrl, true)
            return safeSrc ? `<img src="${safeSrc}" alt="${alt}" loading="lazy" />` : escapeHtml(alt)
        })

        // Links: [text](url)
        res = res.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, rawUrl) => {
            const safeHref = sanitizeSafeUrl(rawUrl, false)
            return safeHref ? `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>` : label
        })

        // Unescape literal dollar signs that were escaped for currency protection
        res = res.replace(/\\(\$)/g, '$1')

        return res
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()

        // Code fence
        if (/^```/.test(trimmed)) {
            if (inCodeBlock) {
                flushCode()
            } else {
                flushList()
                flushTable()
                inCodeBlock = true
                codeLanguage = trimmed.slice(3).trim()
            }
            continue
        }

        if (inCodeBlock) {
            codeBuffer.push(line)
            continue
        }

        // Horizontal rule
        if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
            flushList()
            flushTable()
            htmlParts.push('<hr />')
            continue
        }

        // Table row
        if (/^\|.+\|$/.test(trimmed) || (trimmed.startsWith('|') && trimmed.endsWith('|'))) {
            flushList()
            inTable = true
            tableBuffer.push(trimmed)
            continue
        } else if (inTable) {
            flushTable()
        }

        // Headings
        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
        if (headingMatch) {
            flushList()
            const level = headingMatch[1].length
            const headingText = headingMatch[2].trim()
            const headingId = headingText.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '')
            htmlParts.push(`<h${level} id="${escapeHtml(headingId)}">${renderInline(headingText)}</h${level}>`)
            continue
        }

        // Blockquotes & Callouts
        if (line.startsWith('>')) {
            flushList()
            const quoteContent = line.replace(/^>\s?/, '')
            const calloutMatch = quoteContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s+(.*))?$/i)
            if (calloutMatch) {
                const calloutType = calloutMatch[1].toLowerCase()
                const inlineBody = calloutMatch[2] ? `<p>${renderInline(calloutMatch[2])}</p>` : ''
                htmlParts.push(`<div class="markdown-alert markdown-alert-${calloutType}"><strong>${calloutType.toUpperCase()}</strong>${inlineBody}</div>`)
            } else {
                htmlParts.push(`<blockquote><p>${renderInline(quoteContent)}</p></blockquote>`)
            }
            continue
        }

        // Task list / Unordered list
        const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/)
        if (taskMatch) {
            if (!inList || listType !== 'ul') {
                flushList()
                inList = true
                listType = 'ul'
                htmlParts.push('<ul class="task-list">')
            }
            const checked = taskMatch[2].toLowerCase() === 'x'
            htmlParts.push(`<li class="task-list-item"><input type="checkbox" ${checked ? 'checked' : ''} disabled /> ${renderInline(taskMatch[3])}</li>`)
            continue
        }

        const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/)
        if (ulMatch) {
            if (!inList || listType !== 'ul') {
                flushList()
                inList = true
                listType = 'ul'
                htmlParts.push('<ul>')
            }
            htmlParts.push(`<li>${renderInline(ulMatch[2])}</li>`)
            continue
        }

        // Ordered list
        const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/)
        if (olMatch) {
            if (!inList || listType !== 'ol') {
                flushList()
                inList = true
                listType = 'ol'
                htmlParts.push('<ol>')
            }
            htmlParts.push(`<li>${renderInline(olMatch[2])}</li>`)
            continue
        }

        flushList()

        // Empty line
        if (!trimmed) {
            continue
        }

        // Normal paragraph
        htmlParts.push(`<p>${renderInline(trimmed)}</p>`)
    }

    flushCode()
    flushList()
    flushTable()

    const bodyHtml = `<div class="markdown-body">\n${htmlParts.join('\n')}\n</div>`

    if (!fullHtml) return bodyHtml

    const themeCss = THEMES[theme] || THEMES['claude-canvas'] || ''
    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body { margin: 0; padding: 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
.markdown-body { max-width: 900px; margin: 0 auto; line-height: 1.6; }
${themeCss}
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}

/**
 * Parses HTML or webpage content into clean Markdown
 * @param {string} html - HTML string to convert
 * @returns {string} Markdown string
 */
export function parseHtmlToMarkdown(html = '') {
    if (typeof html !== 'string') html = String(html || '')
    if (!html.trim()) return ''

    let md = html

    // Remove script, style, and svg contents
    md = md.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    md = md.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    md = md.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')

    // Headings
    md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
    md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')

    // Code blocks & inline code
    md = md.replace(/<pre><code(?:\s+class="language-([a-zA-Z0-9_-]+)")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, lang, code) => {
        const decoded = code.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        return `\n\`\`\`${lang || ''}\n${decoded.trim()}\n\`\`\`\n`
    })
    md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')

    // Bold, Italic, Strikethrough
    md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
    md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    md = md.replace(/<(?:del|s|strike)[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, '~~$1~~')

    // Links & Images
    md = md.replace(/<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
    md = md.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]+)"[^>]*>/gi, '![$1]($2)')
    md = md.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')

    // Blockquotes
    md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (m, content) => {
        return '\n' + content.trim().split('\n').map(l => `> ${l.trim()}`).join('\n') + '\n'
    })

    // List items
    md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    md = md.replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n')

    // Paragraphs & breaks
    md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    md = md.replace(/<br\s*\/?>/gi, '\n')
    md = md.replace(/<hr\s*\/?>/gi, '\n---\n')

    // Strip remaining HTML tags
    md = md.replace(/<[^>]+>/g, '')

    // Decode HTML entities
    md = md.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')

    // Normalize newlines
    md = md.replace(/\n{3,}/g, '\n\n').trim()

    return md
}

/**
 * Extracts plain text, structure, and statistics from Markdown
 * @param {string} markdown - Input markdown string
 * @returns {object} Extracted data
 */
export function extractMarkdownData(markdown = '') {
    if (typeof markdown !== 'string') markdown = String(markdown || '')

    const lines = markdown.split(/\r?\n/)
    const headings = []
    const links = []
    const images = []

    let inCode = false

    for (const line of lines) {
        const trimmed = line.trim()
        if (/^```/.test(trimmed)) {
            inCode = !inCode
            continue
        }
        if (inCode) continue

        // Headings
        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
        if (headingMatch) {
            headings.push({
                level: headingMatch[1].length,
                text: headingMatch[2].trim(),
            })
        }

        // Links (excluding images)
        const linkMatches = [...line.matchAll(/(?<!\!)\[([^\]]+)\]\(([^)]+)\)/g)]
        for (const m of linkMatches) {
            links.push({ text: m[1], url: m[2] })
        }

        // Images
        const imgMatches = [...line.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)]
        for (const m of imgMatches) {
            images.push({ alt: m[1], url: m[2] })
        }
    }

    // Strip Markdown syntax to compute clean plain text
    let plainText = markdown
        .replace(/```[\s\S]*?```/g, '') // remove code blocks
        .replace(/`([^`]+)`/g, '$1') // inline code
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // images
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // link text
        .replace(/^#{1,6}\s+/gm, '') // heading hashes
        .replace(/^>\s?/gm, '') // quotes
        .replace(/^[-*+]\s+/gm, '') // lists
        .replace(/^\d+\.\s+/gm, '') // numbered lists
        .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
        .replace(/\*([^*]+)\*/g, '$1') // italic
        .replace(/~~([^~]+)~~/g, '$1') // strike
        .replace(/<[^>]+>/g, '') // html tags
        .replace(/\n{2,}/g, '\n')
        .trim()

    // Title: first H1 or first non-empty heading, or first line
    const title = headings.find(h => h.level === 1)?.text || headings[0]?.text || lines.find(l => l.trim()) || 'Untitled'

    // Word and character counts
    const charCount = plainText.replace(/\s+/g, '').length
    const words = plainText.trim().split(/\s+/).filter(Boolean)
    const wordCount = words.length

    // Estimated reading time (~300 CJK chars/min or 200 words/min)
    const readingTimeMinutes = Math.max(1, Math.ceil(charCount > 0 ? charCount / 300 : wordCount / 200))

    return {
        title,
        text: plainText,
        headings,
        links,
        images,
        stats: {
            characters: charCount,
            words: wordCount,
            lines: lines.length,
            readingTimeMinutes,
        },
    }
}

/**
 * Lints Markdown for common syntax errors and provides automated fixes
 * @param {string} markdown - Input markdown string
 * @returns {object} Lint results and fixed markdown
 */
export function lintMarkdownText(markdown = '') {
    if (typeof markdown !== 'string') markdown = String(markdown || '')

    const issues = []
    const lines = markdown.split(/\r?\n/)
    const fixedLines = []

    let inCode = false
    let codeFenceChar = ''
    let codeLang = ''
    let codeStartLine = 0

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i]
        const lineNum = i + 1
        const trimmed = line.trim()

        // Check code fence
        const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/)
        if (fenceMatch) {
            if (!inCode) {
                inCode = true
                codeFenceChar = fenceMatch[2][0]
                codeLang = String(fenceMatch[3] || '').trim().split(/\s+/)[0].toLowerCase()
                codeStartLine = lineNum
            } else if (fenceMatch[2][0] === codeFenceChar && !String(fenceMatch[3] || '').trim()) {
                inCode = false
                codeFenceChar = ''
                codeLang = ''
            }
            fixedLines.push(line)
            continue
        }

        if (inCode) {
            // Check Mermaid node syntax issues strictly inside mermaid code blocks
            if (codeLang === 'mermaid' && (line.includes('-->') || line.includes('---'))) {
                // Ensure node text with slash or brackets is quoted
                const badMermaid = line.match(/([A-Za-z0-9_-]+)\[([^"\]]+)\]/g)
                if (badMermaid) {
                    for (const m of badMermaid) {
                        const inner = m.match(/\[([^\]]+)\]/)?.[1]
                        if (inner && (inner.includes('/') || inner.includes('(') || inner.includes(')') || inner.includes(':'))) {
                            issues.push({
                                line: lineNum,
                                type: 'mermaid-unquoted-node',
                                message: `Mermaid node [${inner}] contains special characters without double quotes.`,
                            })
                            const quoted = m.replace(/\[(.*)\]/, '["$1"]')
                            line = line.replace(m, quoted)
                        }
                    }
                }
            }
            fixedLines.push(line)
            continue
        }

        // Check Heading space: e.g. #Heading -> # Heading
        const badHeadingMatch = line.match(/^(#{1,6})([^#\s].*)$/)
        if (badHeadingMatch) {
            issues.push({
                line: lineNum,
                type: 'heading-missing-space',
                message: `Heading hashes '#{1,6}' should be followed by a space.`,
            })
            line = `${badHeadingMatch[1]} ${badHeadingMatch[2]}`
        }

        // Check empty link text or URL: [](url) or [text]()
        if (/\[\s*\]\([^)]+\)/.test(line)) {
            issues.push({
                line: lineNum,
                type: 'empty-link-text',
                message: 'Link contains empty anchor text.',
            })
        }
        if (/\[[^\]]+\]\(\s*\)/.test(line)) {
            issues.push({
                line: lineNum,
                type: 'empty-link-url',
                message: 'Link contains empty destination URL.',
            })
        }

        // Check trailing whitespace
        if (/\s+$/.test(line) && line.trim().length > 0) {
            line = line.trimEnd()
        }

        fixedLines.push(line)
    }

    if (inCode) {
        issues.push({
            line: codeStartLine,
            type: 'unclosed-code-fence',
            message: `Unclosed code fence starting at line ${codeStartLine}.`,
        })
        fixedLines.push(codeFenceChar.repeat(3))
    }

    return {
        valid: issues.length === 0,
        issues,
        fixedMarkdown: fixedLines.join('\n'),
    }
}
