const HACKMD_IMAGE_SIZE = /!\[([^\]\n]*)\]\(([^)\s]+)\s+=(\d{0,5})x(\d{0,5})\)/g
const COLUMN_LAYOUT_SELECTOR = '.two-column-layout, .three-column-layout'

const escapeAttribute = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const validDimension = value => {
    if (!value) return ''
    const number = Number(value)
    return Number.isInteger(number) && number > 0 && number <= 10000
        ? String(number)
        : ''
}

const expandImageSizesOnLine = line => line.replace(
    HACKMD_IMAGE_SIZE,
    (match, alt, url, rawWidth, rawHeight) => {
        const width = validDimension(rawWidth)
        const height = validDimension(rawHeight)
        if ((!width && rawWidth) || (!height && rawHeight) || (!width && !height)) return match

        const attributes = [
            `src="${escapeAttribute(url)}"`,
            `alt="${escapeAttribute(alt)}"`,
            width ? `width="${width}"` : '',
            height ? `height="${height}"` : '',
        ].filter(Boolean)
        return `<img ${attributes.join(' ')}>`
    },
)

const expandImageSizesOutsideInlineCode = line => {
    const codeSpan = /(`+)(.*?)\1/g
    let cursor = 0
    let output = ''
    let match

    while ((match = codeSpan.exec(line)) !== null) {
        output += expandImageSizesOnLine(line.slice(cursor, match.index))
        output += match[0]
        cursor = match.index + match[0].length
    }
    return output + expandImageSizesOnLine(line.slice(cursor))
}

export function expandHackmdImageSizes(markdown = '') {
    let fence = ''
    return String(markdown).split('\n').map(line => {
        const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
        if (fenceMatch) {
            const marker = fenceMatch[1][0]
            if (!fence) fence = marker
            else if (fence === marker) fence = ''
            return line
        }
        return fence ? line : expandImageSizesOutsideInlineCode(line)
    }).join('\n')
}

const isHeading = node => node?.nodeType === 1 && /^H[1-6]$/.test(node.tagName)
const hasMeaningfulContent = node => node?.nodeType === 1 || String(node?.textContent || '').trim()

export function decorateColumnLayouts(root) {
    if (!root?.querySelectorAll) return 0
    let decorated = 0

    root.querySelectorAll(COLUMN_LAYOUT_SELECTOR).forEach(layout => {
        if (layout.dataset.columnLayoutReady === 'true') return

        const nodes = Array.from(layout.childNodes)
        const headingLevels = nodes
            .filter(isHeading)
            .map(node => Number(node.tagName.slice(1)))
        const sectionHeadingLevel = headingLevels.length ? Math.min(...headingLevels) : null
        const sections = []
        let section = null
        const startSection = () => {
            section = layout.ownerDocument.createElement('section')
            section.className = 'column-layout-item'
            sections.push(section)
        }

        nodes.forEach(node => {
            if (
                isHeading(node)
                && Number(node.tagName.slice(1)) === sectionHeadingLevel
                && section
                && Array.from(section.childNodes).some(hasMeaningfulContent)
            ) {
                startSection()
            } else if (!section) {
                startSection()
            }
            section.append(node)
        })

        layout.replaceChildren(...sections.filter(item =>
            Array.from(item.childNodes).some(hasMeaningfulContent)
        ))
        layout.dataset.columnLayoutReady = 'true'
        decorated += 1
    })

    return decorated
}

const PANDOC_CITATION_REGEX = /\[((?:-?@[a-zA-Z0-9_\-]+(?:\s*,\s*[^;\]]+)?)(?:\s*;\s*-?@[a-zA-Z0-9_\-]+(?:\s*,\s*[^;\]]+)?)*)\]/g

const renderPandocCitationItem = rawItem => {
    const trimmed = String(rawItem || '').trim()
    const match = trimmed.match(/^(-)?@([a-zA-Z0-9_\-]+)(?:,\s*(.+))?$/)
    if (!match) return escapeAttribute(trimmed)
    const suppressAuthor = match[1] === '-'
    const key = match[2]
    const locator = match[3] ? match[3].trim() : ''
    const displayText = (suppressAuthor ? '-@' : '@') + key + (locator ? (', ' + locator) : '')
    const locatorAttr = locator ? ` data-locator="${escapeAttribute(locator)}"` : ''
    const suppressAttr = suppressAuthor ? ' data-suppress-author="true"' : ''
    return `<a href="#fn-${escapeAttribute(key)}" class="citation-ref" data-citation-key="${escapeAttribute(key)}"${locatorAttr}${suppressAttr} title="Citation: ${escapeAttribute(displayText)}">${escapeAttribute(displayText)}</a>`
}

const expandPandocCitationsOnLine = line => {
    let result = line.replace(PANDOC_CITATION_REGEX, (match, inner) => {
        const items = inner.split(/\s*;\s*/)
        if (items.length === 1) {
            const itemHtml = renderPandocCitationItem(items[0])
            return `<cite class="pandoc-citation">[${itemHtml}]</cite>`
        }
        const itemsHtml = items.map(renderPandocCitationItem).join('; ')
        return `<cite class="pandoc-citation">[${itemsHtml}]</cite>`
    })

    // In-text citation: @key [p. 42]
    result = result.replace(/(^|[\s([{\'"«“‘])@([a-zA-Z0-9_\-]+)\s*\[([^\]]+)\]/g, (match, prefix, key, locator) => {
        const displayText = '@' + key
        const locatorText = locator.trim()
        const link = `<a href="#fn-${escapeAttribute(key)}" class="citation-ref" data-citation-key="${escapeAttribute(key)}" data-locator="${escapeAttribute(locatorText)}" title="Citation: @${escapeAttribute(key)} [${escapeAttribute(locatorText)}]">${escapeAttribute(displayText)}</a>`
        return `${prefix}<cite class="pandoc-citation in-text">${link} [${escapeAttribute(locatorText)}]</cite>`
    })

    return result
}

const expandPandocCitationsOutsideInlineCode = line => {
    const codeSpan = /(`+)(.*?)\1/g
    let cursor = 0
    let output = ''
    let match

    while ((match = codeSpan.exec(line)) !== null) {
        output += expandPandocCitationsOnLine(line.slice(cursor, match.index))
        output += match[0]
        cursor = match.index + match[0].length
    }
    return output + expandPandocCitationsOnLine(line.slice(cursor))
}

export function expandPandocCitations(markdown = '') {
    let fence = ''
    return String(markdown).split('\n').map(line => {
        const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
        if (fenceMatch) {
            const marker = fenceMatch[1][0]
            if (!fence) fence = marker
            else if (fence === marker) fence = ''
            return line
        }
        return fence ? line : expandPandocCitationsOutsideInlineCode(line)
    }).join('\n')
}

const HIGHLIGHT_REGEX = /==([^=\n\r]+)==/g

const expandTextHighlightsOnLine = line => line.replace(
    HIGHLIGHT_REGEX,
    (match, text) => `<mark class="markdown-highlight">${escapeAttribute(text)}</mark>`
)

const expandTextHighlightsOutsideInlineCode = line => {
    const codeSpan = /(`+)(.*?)\1/g
    let cursor = 0
    let output = ''
    let match

    while ((match = codeSpan.exec(line)) !== null) {
        output += expandTextHighlightsOnLine(line.slice(cursor, match.index))
        output += match[0]
        cursor = match.index + match[0].length
    }
    return output + expandTextHighlightsOnLine(line.slice(cursor))
}

export function expandTextHighlights(markdown = '') {
    let fence = ''
    return String(markdown).split('\n').map(line => {
        const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
        if (fenceMatch) {
            const marker = fenceMatch[1][0]
            if (!fence) fence = marker
            else if (fence === marker) fence = ''
            return line
        }
        return fence ? line : expandTextHighlightsOutsideInlineCode(line)
    }).join('\n')
}

const sanitizeColor = val => {
    const trimmed = String(val || '').trim()
    if (/^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([^)]+\)|hsla?\([^)]+\))$/.test(trimmed)) {
        return trimmed
    }
    return ''
}

const CUSTOM_COLOR_REGEX = /\[color=([#a-zA-Z0-9_().,% -]+)(?:\s+bg=([#a-zA-Z0-9_().,% -]+))?\]([\s\S]*?)\[\/color\]/gi
const CUSTOM_BG_REGEX = /\[bg=([#a-zA-Z0-9_().,% -]+)\]([\s\S]*?)\[\/bg\]/gi

const expandCustomColorsOnText = text => {
    let res = text.replace(CUSTOM_COLOR_REGEX, (m, color, bg, content) => {
        const safeColor = sanitizeColor(color)
        const safeBg = sanitizeColor(bg)
        const styles = [
            safeColor ? `color: ${safeColor}` : '',
            safeBg ? `background-color: ${safeBg}` : ''
        ].filter(Boolean).join('; ')
        if (!styles) return content
        return `<span style="${styles}">${content}</span>`
    })
    res = res.replace(CUSTOM_BG_REGEX, (m, bg, content) => {
        const safeBg = sanitizeColor(bg)
        if (!safeBg) return content
        return `<span style="background-color: ${safeBg}">${content}</span>`
    })
    return res
}

export function expandCustomColors(markdown = '') {
    let fence = ''
    return String(markdown).split('\n').map(line => {
        const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
        if (fenceMatch) {
            const marker = fenceMatch[1][0]
            if (!fence) fence = marker
            else if (fence === marker) fence = ''
            return line
        }
        return fence ? line : expandCustomColorsOnText(line)
    }).join('\n')
}

const CURRENCY_DOLLAR_REGEX = /(^|[^\$\\])\$([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?(?:[kKmMbBtT]|万|億)?(?:\/[a-zA-Z\u4e00-\u9fa5]+)?)(?!\$)(?=[^a-zA-Z0-9.]|(?:\.(?!\d))|$)/g

const protectCurrencyOnLine = line => line.replace(
    CURRENCY_DOLLAR_REGEX,
    (match, prefix, amount, offset, fullStr) => {
        const rest = fullStr.slice(offset + match.length)
        const mathEndMatch = rest.match(/^([^$\n]*?)\$/)
        if (mathEndMatch) {
            const formulaBody = mathEndMatch[1]
            const hasCjk = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(formulaBody)
            const hasMarkdown = /\*\*|__|\*|_|~~|\[/.test(formulaBody)
            const closingPrecededBySpace = /\s$/.test(formulaBody)
            const afterClosing = rest.slice(mathEndMatch[0].length)
            const closingFollowedByDigit = /^\d/.test(afterClosing)
            if (hasCjk || hasMarkdown || closingPrecededBySpace || closingFollowedByDigit) {
                return prefix + '\\$' + amount
            }
            if (/^\s*[\+\-\*\/\=<>^_~\\a-zA-Z]/.test(formulaBody)) {
                return match
            }
        }
        return prefix + '\\$' + amount
    },
)

const protectCurrencyOutsideInlineCode = line => {
    const codeSpan = /(`+)(.*?)\1/g
    let cursor = 0
    let output = ''
    let match

    while ((match = codeSpan.exec(line)) !== null) {
        output += protectCurrencyOnLine(line.slice(cursor, match.index))
        output += match[0]
        cursor = match.index + match[0].length
    }
    return output + protectCurrencyOnLine(line.slice(cursor))
}

export function protectCurrencyDollarSigns(markdown = '') {
    let fence = ''
    return String(markdown).split('\n').map(line => {
        const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
        if (fenceMatch) {
            const marker = fenceMatch[1][0]
            if (!fence) fence = marker
            else if (fence === marker) fence = ''
            return line
        }
        return fence ? line : protectCurrencyOutsideInlineCode(line)
    }).join('\n')
}

export function expandMarkdownExtensions(markdown = '') {
    return expandInlineFootnotes(expandCustomColors(expandTextHighlights(expandPandocCitations(expandHackmdImageSizes(protectCurrencyDollarSigns(markdown))))))
}

export function decorateCodeBlocks(rootNode) {
    if (!rootNode?.querySelectorAll) return 0
    const codeBlocks = Array.from(rootNode.querySelectorAll('pre > code'))
    let count = 0

    codeBlocks.forEach(codeEl => {
        const pre = codeEl.parentElement
        if (!pre || pre.dataset.codeDecorated === 'true') return
        pre.dataset.codeDecorated = 'true'
        count++

        const className = codeEl.className || ''
        const match = className.match(/language-([a-zA-Z0-9_-]+)(?:=([0-9]*))?(?:\s*\[([^\]]+)\])?/)
        let lang = match ? match[1] : ''
        let lineStart = match && match[2] !== undefined ? (parseInt(match[2], 10) || 1) : null
        let filename = match && match[3] ? match[3].trim() : ''

        if (!filename && pre.getAttribute('data-filename')) filename = pre.getAttribute('data-filename')
        if (lineStart === null && pre.getAttribute('data-line-numbers')) {
            lineStart = parseInt(pre.getAttribute('data-line-start') || '1', 10)
        }

        let wrapper = pre.parentElement
        if (!wrapper || !wrapper.classList.contains('code-block-wrapper')) {
            wrapper = pre.ownerDocument.createElement('div')
            wrapper.className = 'code-block-wrapper'
            pre.parentNode.insertBefore(wrapper, pre)
            wrapper.appendChild(pre)
        }

        const header = pre.ownerDocument.createElement('div')
        header.className = 'code-block-header'

        const langBadge = pre.ownerDocument.createElement('span')
        langBadge.className = 'code-block-title'
        if (filename) {
            langBadge.innerHTML = `<span class="code-file-icon">📄</span> <span class="code-filename">${escapeAttribute(filename)}</span>`
        } else if (lang) {
            langBadge.textContent = lang.toUpperCase()
        } else {
            langBadge.textContent = 'CODE'
        }

        const copyBtn = pre.ownerDocument.createElement('button')
        copyBtn.type = 'button'
        copyBtn.className = 'code-copy-btn'
        copyBtn.setAttribute('aria-label', 'Copy code to clipboard')
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> <span class="copy-text">Copy</span>`

        copyBtn.addEventListener('click', async () => {
            const rawCode = codeEl.textContent || ''
            try {
                if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(rawCode)
                } else if (typeof document !== 'undefined') {
                    const ta = document.createElement('textarea')
                    ta.value = rawCode
                    document.body.appendChild(ta)
                    ta.select()
                    document.execCommand('copy')
                    ta.remove()
                }
                copyBtn.classList.add('copied')
                copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> <span class="copy-text">Copied!</span>`
                setTimeout(() => {
                    copyBtn.classList.remove('copied')
                    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> <span class="copy-text">Copy</span>`
                }, 2000)
            } catch (err) {
                console.error('Failed to copy code:', err)
            }
        })

        header.appendChild(langBadge)
        header.appendChild(copyBtn)
        wrapper.insertBefore(header, pre)

        if (lineStart !== null) {
            pre.classList.add('has-line-numbers')
            const lines = (codeEl.textContent || '').split('\n')
            if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()

            const lineNumbersGutter = pre.ownerDocument.createElement('div')
            lineNumbersGutter.className = 'code-line-numbers'
            lineNumbersGutter.setAttribute('aria-hidden', 'true')

            let gutterHtml = ''
            for (let i = 0; i < lines.length; i++) {
                gutterHtml += `<span class="line-number">${lineStart + i}</span>\n`
            }
            lineNumbersGutter.innerHTML = gutterHtml
            pre.insertBefore(lineNumbersGutter, codeEl)
        }
    })

    return count
}

function findFootnoteContent(anchor, rootNode) {
    const href = anchor.getAttribute('href') || ''
    const rawTargetId = href.startsWith('#') ? href.slice(1) : ''
    const citationKey = anchor.getAttribute('data-citation-key') || ''
    const doc = rootNode?.ownerDocument || (typeof document !== 'undefined' ? document : null)
    if (!doc) return null

    const possibleIds = [
        rawTargetId,
        rawTargetId ? `user-content-${rawTargetId}` : '',
        rawTargetId ? rawTargetId.replace(/^user-content-/, '') : '',
        citationKey ? `fn-${citationKey}` : '',
        citationKey ? `user-content-fn-${citationKey}` : '',
        citationKey ? `ref-${citationKey}` : '',
        citationKey ? `user-content-ref-${citationKey}` : '',
    ].filter(Boolean)

    for (const id of possibleIds) {
        const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"')
        const el = doc.getElementById(id) || rootNode?.querySelector?.(`[id="${escapedId}"]`)
        if (el) {
            const clone = el.cloneNode(true)
            clone.querySelectorAll('.data-footnote-backref, .footnote-backref, a[href*="fnref"]').forEach(b => b.remove())
            return {
                title: anchor.textContent.trim() || `Footnote ${id}`,
                html: clone.innerHTML.trim() || clone.textContent.trim()
            }
        }
    }

    if (citationKey) {
        const escapedCitationKey = String(citationKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const codeBlocks = doc.querySelectorAll('pre code, .diagram-source')
        for (const block of codeBlocks) {
            const text = block.textContent || ''
            const bibRegex = new RegExp(`@([a-zA-Z]+)\\s*\\{\\s*${escapedCitationKey}\\s*,([\\s\\S]*?)\\n\\}`, 'i')
            const bibMatch = text.match(bibRegex)
            if (bibMatch) {
                const fieldsRaw = bibMatch[2]
                const getField = (name) => {
                    const m = fieldsRaw.match(new RegExp(`${name}\\s*=\\s*[{"]([^}"]+)[}"]`, 'i'))
                    return m ? m[1].trim() : ''
                }
                const author = getField('author')
                const title = getField('title')
                const year = getField('year')
                const journal = getField('journal') || getField('booktitle') || getField('publisher')
                const howpublished = getField('howpublished') || getField('url')
                const parts = [
                    author ? `<strong>${escapeAttribute(author)}</strong>` : '',
                    year ? `(${escapeAttribute(year)})` : '',
                    title ? `<em>${escapeAttribute(title)}</em>` : '',
                    journal ? `${escapeAttribute(journal)}.` : '',
                    howpublished ? `<span class="footnote-url">${escapeAttribute(howpublished.replace(/^\\url\{|\}$/g, ''))}</span>` : ''
                ].filter(Boolean)
                return {
                    title: `Citation: @${citationKey}`,
                    html: `<p>${parts.join(' ')}</p>`
                }
            }
        }

        const locator = anchor.getAttribute('data-locator')
        return {
            title: `Citation: @${citationKey}`,
            html: `<p class="footnote-placeholder">Academic Citation: <code>@${escapeAttribute(citationKey)}</code>${locator ? ` (${escapeAttribute(locator)})` : ''}</p>`
        }
    }

    return null
}

let activeHideTimer = null
let activeShowTimer = null

function ensureFootnotePopoverElement(doc) {
    let popover = doc.getElementById('footnote-popover')
    if (!popover) {
        popover = doc.createElement('div')
        popover.id = 'footnote-popover'
        popover.className = 'footnote-popover'
        popover.setAttribute('role', 'tooltip')
        popover.setAttribute('aria-hidden', 'true')
        popover.innerHTML = `
            <div class="footnote-popover-header">
                <span class="footnote-popover-badge">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path>
                        <path d="M6 6h10"></path>
                        <path d="M6 10h10"></path>
                    </svg>
                    <span class="footnote-popover-title">Footnote</span>
                </span>
                <button type="button" class="footnote-popover-close" aria-label="Close">×</button>
            </div>
            <div class="footnote-popover-body"></div>
        `
        doc.body?.appendChild(popover)

        popover.addEventListener('mouseenter', () => {
            if (activeHideTimer) {
                clearTimeout(activeHideTimer)
                activeHideTimer = null
            }
        })
        popover.addEventListener('mouseleave', () => {
            hideFootnotePopover(popover)
        })
        popover.querySelector('.footnote-popover-close')?.addEventListener('click', (e) => {
            e.stopPropagation()
            hideFootnotePopover(popover, 0)
        })
    }
    return popover
}

function hideFootnotePopover(popover, delay = 220) {
    if (!popover) return
    if (activeHideTimer) clearTimeout(activeHideTimer)
    activeHideTimer = setTimeout(() => {
        popover.classList.remove('visible')
        popover.setAttribute('aria-hidden', 'true')
        activeHideTimer = null
    }, delay)
}

function showFootnotePopover(popover, anchor, rootNode) {
    if (!popover || !anchor) return
    if (activeHideTimer) {
        clearTimeout(activeHideTimer)
        activeHideTimer = null
    }

    const content = findFootnoteContent(anchor, rootNode)
    if (!content || !content.html) return

    const titleEl = popover.querySelector('.footnote-popover-title')
    const bodyEl = popover.querySelector('.footnote-popover-body')
    if (titleEl) titleEl.textContent = content.title || 'Footnote'
    if (bodyEl) bodyEl.innerHTML = content.html

    popover.style.display = 'block'
    popover.classList.add('visible')
    popover.removeAttribute('aria-hidden')

    if (typeof window !== 'undefined' && anchor.getBoundingClientRect) {
        const rect = anchor.getBoundingClientRect()
        const viewportWidth = window.innerWidth || 1024
        const viewportHeight = window.innerHeight || 768
        const popoverWidth = Math.min(380, viewportWidth - 32)
        popover.style.width = `${popoverWidth}px`

        const popoverRect = popover.getBoundingClientRect()
        const spaceAbove = rect.top
        const spaceBelow = viewportHeight - rect.bottom
        const showAbove = spaceAbove >= popoverRect.height + 12 || spaceAbove > spaceBelow

        const top = showAbove
            ? rect.top - popoverRect.height - 8
            : rect.bottom + 8

        let left = rect.left + rect.width / 2 - popoverWidth / 2
        left = Math.max(16, Math.min(left, viewportWidth - popoverWidth - 16))

        popover.style.top = `${Math.round(top)}px`
        popover.style.left = `${Math.round(left)}px`
    }
}

function findFootnoteTargetElement(linkEl, rootNode) {
    if (!linkEl) return null
    const href = linkEl.getAttribute('href') || ''
    if (href.startsWith('#')) {
        const id = href.slice(1)
        const doc = rootNode.ownerDocument || (typeof document !== 'undefined' ? document : null)
        if (!doc) return null
        let el = doc.getElementById(id)
        if (!el) el = doc.getElementById(`user-content-${id}`)
        if (!el && id.startsWith('user-content-')) el = doc.getElementById(id.replace('user-content-', ''))
        if (!el && rootNode.querySelector) {
            try {
                const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
                    ? CSS.escape
                    : v => String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
                el = rootNode.querySelector(`#${esc(id)}`) || rootNode.querySelector(`#${esc(`user-content-${id}`)}`)
            } catch (e) {}
        }
        if (!el && (id === 'footnotes' || id === 'footnote-label')) {
            el = doc.querySelector?.('.footnotes, [data-footnotes]') || rootNode.querySelector?.('.footnotes, [data-footnotes]')
        }
        if (el && (el.classList.contains('sr-only') || el.classList.contains('visually-hidden') || el.getAttribute('aria-hidden') === 'true')) {
            el = el.closest('.footnotes, [data-footnotes]') || el.parentElement || el
        }
        return el
    }
    return null
}

export function decorateFootnoteAndCitationPopovers(rootNode) {
    if (!rootNode?.querySelectorAll) return 0
    const doc = rootNode.ownerDocument || (typeof document !== 'undefined' ? document : null)
    if (!doc) return 0

    const footnoteSections = rootNode.querySelectorAll?.('.footnotes, [data-footnotes]') || []
    footnoteSections.forEach(section => {
        if (!section.id) section.id = 'footnotes'
    })

    const popover = ensureFootnotePopoverElement(doc)
    const refSelector = '.footnote-ref a, [data-footnote-ref], .citation-ref, a[href^="#fn-"], a[href^="#user-content-fn-"]'
    const anchors = Array.from(rootNode.querySelectorAll(refSelector))
    let count = 0

    anchors.forEach(anchor => {
        if (anchor.dataset.popoverReady === 'true') return
        anchor.dataset.popoverReady = 'true'
        count++

        anchor.addEventListener('mouseenter', () => {
            if (activeShowTimer) clearTimeout(activeShowTimer)
            activeShowTimer = setTimeout(() => {
                showFootnotePopover(popover, anchor, rootNode)
                activeShowTimer = null
            }, 120)
        })

        anchor.addEventListener('mouseleave', () => {
            if (activeShowTimer) {
                clearTimeout(activeShowTimer)
                activeShowTimer = null
            }
            hideFootnotePopover(popover)
        })

        anchor.addEventListener('click', (e) => {
            hideFootnotePopover(popover, 0)
            const targetEl = findFootnoteTargetElement(anchor, rootNode)
            if (targetEl) {
                e.preventDefault()
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                targetEl.classList.remove('footnote-target-highlight')
                void targetEl.offsetWidth
                targetEl.classList.add('footnote-target-highlight')
                setTimeout(() => targetEl.classList.remove('footnote-target-highlight'), 2000)
            }
        })
    })

    const backrefSelector = '.data-footnote-backref, [data-footnote-backref], a.footnote-backref, a[href^="#fnref-"], a[href^="#user-content-fnref-"]'
    const backrefs = Array.from(rootNode.querySelectorAll(backrefSelector))
    backrefs.forEach(backref => {
        if (backref.dataset.backrefReady === 'true') return
        backref.dataset.backrefReady = 'true'

        backref.addEventListener('click', (e) => {
            const targetEl = findFootnoteTargetElement(backref, rootNode)
            if (targetEl) {
                e.preventDefault()
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
                targetEl.classList.remove('footnote-target-highlight')
                void targetEl.offsetWidth
                targetEl.classList.add('footnote-target-highlight')
                setTimeout(() => targetEl.classList.remove('footnote-target-highlight'), 2000)
            }
        })
    })

    return count
}

export function expandInlineFootnotes(source = '') {
    if (!source || typeof source !== 'string') return ''
    let count = 0
    const definitions = []
    let fence = ''

    const lines = String(source).split('\n').map(line => {
        const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
        if (fenceMatch) {
            const marker = fenceMatch[1][0]
            if (!fence) fence = marker
            else if (fence === marker) fence = ''
            return line
        }
        if (fence) return line

        return line.replace(/\^\[([\s\S]*?)\]/g, (match, noteContent) => {
            count++
            const fnId = `inline_fn_${count}`
            definitions.push(`[^${fnId}]: ${noteContent.trim()}`)
            return `[^${fnId}]`
        })
    })

    const transformed = lines.join('\n')
    if (definitions.length === 0) return transformed
    return `${transformed}\n\n${definitions.join('\n\n')}`
}

export function htmlOrTsvToMarkdownTable(html, plainText) {
    if (html && html.includes('<table')) {
        try {
            const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi)
            if (rowMatches && rowMatches.length > 0) {
                const grid = []
                rowMatches.forEach(trHtml => {
                    const cellMatches = [...trHtml.matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)]
                    const cells = cellMatches.map(m => {
                        return m[1].replace(/<[^>]+>/g, '').trim().replace(/\|/g, '\\|').replace(/\s+/g, ' ')
                    })
                    if (cells.length > 0) grid.push(cells)
                })
                if (grid.length > 0) {
                    const maxCols = Math.max(...grid.map(r => r.length))
                    const normalized = grid.map(r => {
                        const row = [...r]
                        while (row.length < maxCols) row.push('')
                        return row
                    })
                    const header = normalized[0]
                    const separator = new Array(maxCols).fill('---')
                    const body = normalized.slice(1)
                    const lines = [
                        `| ${header.join(' | ')} |`,
                        `| ${separator.join(' | ')} |`,
                        ...body.map(r => `| ${r.join(' | ')} |`)
                    ]
                    return lines.join('\n')
                }
            }
        } catch (e) {}
    }

    if (plainText && plainText.includes('\t') && plainText.includes('\n')) {
        const rawLines = plainText.trim().split(/\r?\n/)
        const grid = rawLines.map(line => line.split('\t').map(c => c.trim().replace(/\|/g, '\\|')))
        if (grid.length > 0 && grid[0].length > 1) {
            const maxCols = Math.max(...grid.map(r => r.length))
            const normalized = grid.map(r => {
                const row = [...r]
                while (row.length < maxCols) row.push('')
                return row
            })
            const header = normalized[0]
            const separator = new Array(maxCols).fill('---')
            const body = normalized.slice(1)
            const lines = [
                `| ${header.join(' | ')} |`,
                `| ${separator.join(' | ')} |`,
                ...body.map(r => `| ${r.join(' | ')} |`)
            ]
            return lines.join('\n')
        }
    }

    return null
}

export function parseBookToc(source) {
    if (!source || typeof source !== 'string') {
        return { title: 'Book', chapters: [], sections: [] }
    }

    const lines = source.split(/\r?\n/)
    let bookTitle = ''
    let currentSection = ''
    const chapters = []
    const sections = []

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const h1Match = line.match(/^#\s+(.+)$/)
        if (h1Match && !bookTitle) {
            bookTitle = h1Match[1].replace(/\[.*?\]\(.*?\)/g, '').trim()
            continue
        }

        const h2Match = line.match(/^##\s+(.+)$/)
        if (h2Match) {
            currentSection = h2Match[1].trim()
            sections.push({ title: currentSection, line: i })
            continue
        }

        const linkMatch = line.match(/^[*-]\s*\[([^\]]+)\]\(([^)]+)\)/)
        if (linkMatch) {
            const title = linkMatch[1].trim()
            const url = linkMatch[2].trim()
            const indentMatch = lines[i].match(/^(\s*)/)
            const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0

            chapters.push({
                index: chapters.length,
                title,
                url,
                section: currentSection || bookTitle || '章節清單',
                level: indentLevel,
                isExternal: /^https?:\/\//i.test(url) && !url.includes('wiki.david888.com')
            })
        }
    }

    return {
        title: bookTitle || '書本目錄',
        chapters,
        sections
    }
}

export function slugifyHeading(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/['"“”‘’]/g, '')
        .replace(/[()[\]{}<>《》「」『』【】（）]/g, ' ')
        .replace(/[!#$%&*+,./:;=?@\\^|~，。！？、：；]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

export function slugifyCompactHeading(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/['"“”‘’]/g, '')
        .replace(/[【】「」『』《》]/g, '')
        .replace(/[()[\]{}<>（）]/g, ' ')
        .replace(/[!#$%&*+,./:;=?@\\^|~，。！？、：；]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

export function getHeadingSlugAliases(text) {
    const aliases = [slugifyCompactHeading(text), slugifyHeading(text)]
    return aliases.filter((alias, index) => alias && aliases.indexOf(alias) === index)
}

export function decorateHeadingAnchors(rootNode) {
    if (!rootNode?.querySelectorAll) return 0
    const doc = rootNode.ownerDocument || (typeof document !== 'undefined' ? document : null)
    const seen = new Map()
    let countAnchored = 0

    rootNode.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
        if (heading.classList.contains('sr-only') || heading.classList.contains('visually-hidden') || heading.getAttribute('aria-hidden') === 'true') return
        if (heading.closest?.('.footnotes, [data-footnotes]')) return
        const aliases = getHeadingSlugAliases(heading.textContent)
        const baseId = aliases[0]
        if (!baseId) return
        const count = seen.get(baseId) || 0
        seen.set(baseId, count + 1)
        const headingId = count ? `${baseId}-${count}` : baseId
        heading.id = headingId
        heading.style.scrollMarginTop = '18px'
        countAnchored++

        aliases.slice(1).forEach(alias => {
            const aliasId = count ? `${alias}-${count}` : alias
            if (!aliasId || aliasId === headingId || (doc && doc.getElementById(aliasId))) return
            if (!doc || !heading.parentNode) return
            const anchor = doc.createElement('span')
            anchor.id = aliasId
            anchor.className = 'heading-anchor-alias'
            anchor.setAttribute('aria-hidden', 'true')
            heading.parentNode.insertBefore(anchor, heading)
        })
    })
    return countAnchored
}

/**
 * Extracts line indices of [toc] markers and ATX headings from Markdown source
 * (skipping YAML frontmatter and fenced code blocks) for anchor-mapped scroll sync.
 * @param {string} source
 * @returns {Array<{ kind: 'toc' | 'heading', line: number }>}
 */
export function extractEditorScrollTokens(source = '') {
    if (!source || typeof source !== 'string') return []
    const lines = source.split(/\r?\n/)
    const tokens = []
    let startLine = 0

    // Skip optional YAML frontmatter at top of document
    if (lines[0] && lines[0].trim() === '---') {
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                const yamlBody = lines.slice(1, i).join('\n')
                if (/^[a-zA-Z0-9_-]+\s*:\s*.+/m.test(yamlBody) && !yamlBody.trim().startsWith('#')) {
                    startLine = i + 1
                }
                break
            }
        }
    }

    let fence = ''
    for (let i = startLine; i < lines.length; i++) {
        const trimmed = lines[i].trim()
        const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/)
        if (fenceMatch) {
            const marker = fenceMatch[1][0]
            if (!fence) fence = marker
            else if (fence === marker) fence = ''
            continue
        }
        if (fence) continue

        if (/^\[toc\]$/i.test(trimmed) || /^\{:toc\}$/i.test(trimmed)) {
            tokens.push({ kind: 'toc', line: i })
            continue
        }
        if (/^#{1,6}\s+.+/.test(trimmed)) {
            tokens.push({ kind: 'heading', line: i })
        }
    }
    return tokens
}

/**
 * Piecewise linear scroll position interpolation across monotonic { src, dst } anchor pairs.
 * Prevents large preview blocks like [toc] from desynchronizing editor and preview scroll positions.
 * @param {number} scrollTop
 * @param {Array<{ src: number, dst: number }>} anchors
 * @param {'forward' | 'reverse'} [direction]
 * @returns {number}
 */
export function computeAnchorMappedScrollTop(scrollTop, anchors = [], direction = 'forward') {
    if (!Array.isArray(anchors) || anchors.length < 2) return 0
    const isReverse = direction === 'reverse'
    const getFrom = a => (isReverse ? a.dst : a.src)
    const getTo = a => (isReverse ? a.src : a.dst)

    const clean = []
    let lastFrom = -1
    let lastTo = -1
    for (const item of anchors) {
        const from = Math.max(0, Number(getFrom(item)) || 0)
        const to = Math.max(0, Number(getTo(item)) || 0)
        if (from >= lastFrom && to >= lastTo) {
            if (clean.length > 0 && from === lastFrom && to === lastTo) continue
            clean.push({ from, to })
            lastFrom = from
            lastTo = to
        }
    }
    if (clean.length === 0) return 0
    if (clean.length === 1) return clean[0].to

    const pos = Math.max(0, Number(scrollTop) || 0)
    if (pos <= clean[0].from) return clean[0].to
    const last = clean[clean.length - 1]
    if (pos >= last.from) return last.to

    for (let i = 0; i < clean.length - 1; i++) {
        const a = clean[i]
        const b = clean[i + 1]
        if (pos >= a.from && pos <= b.from) {
            const span = b.from - a.from
            if (span <= 0) return b.to
            const ratio = (pos - a.from) / span
            return a.to + ratio * (b.to - a.to)
        }
    }
    return last.to
}



