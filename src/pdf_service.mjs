/**
 * Takumi-PDF Rendering Service for CF-Notepad / David888 Wiki
 * Generates paged, selectable-text vector PDF documents from Markdown/HTML without Chromium.
 */

import * as takumi from 'takumi-pdf'
import { fromHtml } from '@takumi-rs/helpers/html'
import { googleFonts } from '@takumi-rs/helpers'
import { extractEmojis } from '@takumi-rs/helpers/emoji'
import { renderMarkdownToHtml } from './markdown-processor.mjs'

// In-memory cache for loaded font subsets to eliminate repeated Google Font network round-trips
let cachedFonts = null
let fontFetchPromise = null

const PDF_FONT_CACHE_URL = 'https://wiki.internal/takumi-pdf-fonts/v1.json'

/**
 * Ensures Google Fonts (Noto Sans TC, JetBrains Mono, Inter) are loaded
 * Uses isolate memory + Cloudflare edge Cache API (when available) to prevent cold-start font fetch overhead.
 * @returns {Promise<Array>} Loaded font subsets
 */
export async function getPdfFonts() {
    if (cachedFonts) return cachedFonts
    if (fontFetchPromise) return fontFetchPromise

    fontFetchPromise = (async () => {
        try {
            const edgeCache = (typeof caches !== 'undefined' && caches?.default) ? caches.default : null
            if (edgeCache) {
                try {
                    const cachedResp = await edgeCache.match(PDF_FONT_CACHE_URL)
                    if (cachedResp) {
                        const parsed = await cachedResp.json()
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const restored = parsed.map(item => ({
                                ...item,
                                data: item?.dataB64 ? Uint8Array.from(atob(item.dataB64), c => c.charCodeAt(0)).buffer : item?.data,
                            }))
                            cachedFonts = restored
                            return restored
                        }
                    }
                } catch {}
            }

            const fonts = await googleFonts(['Noto Sans TC', 'JetBrains Mono', 'Inter'])
            cachedFonts = fonts

            if (edgeCache && Array.isArray(fonts) && fonts.length > 0) {
                try {
                    const serializable = fonts.map(f => {
                        if (f?.data instanceof ArrayBuffer || ArrayBuffer.isView(f?.data)) {
                            const bytes = f.data instanceof ArrayBuffer ? new Uint8Array(f.data) : new Uint8Array(f.data.buffer, f.data.byteOffset, f.data.byteLength)
                            let binary = ''
                            for (let i = 0; i < bytes.length; i += 0x8000) {
                                binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
                            }
                            const { data, ...rest } = f
                            return { ...rest, dataB64: btoa(binary) }
                        }
                        return f
                    })
                    await edgeCache.put(
                        PDF_FONT_CACHE_URL,
                        new Response(JSON.stringify(serializable), {
                            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=604800' },
                        })
                    )
                } catch {}
            }

            return fonts
        } catch (err) {
            console.warn('[takumi-pdf] Failed to fetch Google Fonts:', err)
            return []
        } finally {
            fontFetchPromise = null
        }
    })()

    return fontFetchPromise
}

/**
 * Builds base typography CSS styles for PDF rendering
 * @returns {string} Inlined CSS styles
 */
export function getPdfBaseStyles() {
    return `
        font-family: 'Noto Sans TC', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #1f2937;
        line-height: 1.65;
        font-size: 13px;
        padding: 0;
        margin: 0;
    `
}

/**
 * Formats Markdown or HTML into a styled container for Takumi-PDF
 * @param {string} rawHtml - HTML content
 * @param {object} meta - Document metadata
 * @returns {string} Fully styled HTML string
 */
export function buildPdfDocumentHtml(rawHtml, meta = {}) {
    const { title = '' } = meta
    const safeTitle = title ? String(title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''
    const titleHeader = safeTitle ? `<h1 style="font-size: 24px; font-weight: 700; color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; margin-top: 0;">${safeTitle}</h1>` : ''

    return `
        <div style="${getPdfBaseStyles()}">
            <style>
                h1, h2, h3, h4, h5, h6 { color: #111827; font-weight: 700; line-height: 1.3; margin-top: 20px; margin-bottom: 10px; }
                h1 { font-size: 22px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
                h2 { font-size: 17px; border-bottom: 1px solid #f3f4f6; padding-bottom: 6px; }
                h3 { font-size: 15px; }
                h4 { font-size: 13px; }
                p { margin-top: 0; margin-bottom: 12px; orphans: 3; widows: 3; }
                li { orphans: 3; widows: 3; }
                .page-break { display: block; height: 0; margin: 0; padding: 0; border: 0; page-break-before: always; break-before: page; }
                strong { font-weight: 700; color: #111827; }
                em { font-style: italic; }
                a { color: #2563eb; text-decoration: none; }
                blockquote {
                    margin: 14px 0;
                    padding: 8px 14px;
                    border-left: 4px solid #3b82f6;
                    background-color: #f8fafc;
                    color: #4b5563;
                    border-radius: 0 6px 6px 0;
                }
                pre {
                    background-color: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 12px 14px;
                    margin: 14px 0;
                    overflow: hidden;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 11.5px;
                    line-height: 1.5;
                    color: #0f172a;
                    break-inside: avoid;
                }
                code {
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 11.5px;
                    background-color: #f1f5f9;
                    padding: 2px 5px;
                    border-radius: 4px;
                    color: #0f172a;
                }
                pre code {
                    background-color: transparent;
                    padding: 0;
                    border-radius: 0;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 16px 0;
                    font-size: 12px;
                    break-inside: avoid;
                }
                th, td {
                    border: 1px solid #e5e7eb;
                    padding: 7px 10px;
                    text-align: left;
                }
                th {
                    background-color: #f9fafb;
                    font-weight: 600;
                    color: #374151;
                }
                tr:nth-child(even) td {
                    background-color: #fcfdfd;
                }
                ul, ol {
                    margin-top: 0;
                    margin-bottom: 12px;
                    padding-left: 20px;
                }
                li {
                    margin-bottom: 4px;
                }
                hr {
                    border: 0;
                    border-top: 1px solid #e5e7eb;
                    margin: 20px 0;
                }
                img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 6px;
                    margin: 12px 0;
                }
                mark, .markdown-highlight {
                    background-color: #fef08a;
                    color: #854d0e;
                    padding: 1px 3px;
                    border-radius: 3px;
                }
                .github-alert {
                    margin: 14px 0;
                    padding: 10px 14px;
                    border-radius: 6px;
                    border-left: 4px solid #3b82f6;
                    background-color: #eff6ff;
                    color: #1e40af;
                }
            </style>
            ${titleHeader}
            ${rawHtml}
        </div>
    `
}

const MAX_PDF_MERMAID_BLOCKS = 20

function sanitizeMermaidSvg(svg) {
    return String(svg || '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '')
        .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/(href|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi, '$1="#"')
}

/**
 * Automatically converts Mermaid code blocks in HTML to vector SVG elements
 * @param {string} html - HTML string
 * @returns {Promise<string>} HTML with embedded vector SVG diagrams
 */
export async function convertMermaidBlocksToSvg(html) {
    if (!html || !html.includes('mermaid')) return html

    let renderedCount = 0

    // 1. Match <pre><code class="language-mermaid">...</code></pre>
    const codeRegex = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi
    const codeMatches = [...html.matchAll(codeRegex)]

    let resultHtml = html
    for (const match of codeMatches) {
        if (renderedCount >= MAX_PDF_MERMAID_BLOCKS) break
        const fullMatch = match[0]
        const rawCode = match[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim()

        if (!rawCode) continue

        try {
            renderedCount += 1
            const obj = { code: rawCode, mermaid: { theme: 'default' } }
            const b64 = Buffer.from(JSON.stringify(obj)).toString('base64')
            const resp = await fetch(`https://mermaid.ink/svg/${b64}`, { signal: AbortSignal.timeout(4000) })
            if (resp.ok) {
                const svg = sanitizeMermaidSvg(await resp.text())
                if (svg && svg.includes('<svg')) {
                    const wrappedSvg = `<div class="diagram-mermaid-render" style="display: flex; justify-content: center; margin: 18px 0; break-inside: avoid;">${svg}</div>`
                    resultHtml = resultHtml.replace(fullMatch, wrappedSvg)
                }
            }
        } catch (e) {
            console.warn('[pdf_service] Mermaid diagram rendering failed:', e.message)
        }
    }

    // 2. Match un-rendered diagram-mermaid-wrapper / diagram-source
    const wrapperRegex = /<div class="diagram-block-wrapper diagram-mermaid-wrapper">[\s\S]*?<div class="diagram-mermaid-container diagram-source"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div class="diagram-mermaid-render"[^>]*><\/div><\/div>/gi
    const wrapperMatches = [...resultHtml.matchAll(wrapperRegex)]
    for (const match of wrapperMatches) {
        if (renderedCount >= MAX_PDF_MERMAID_BLOCKS) break
        const fullMatch = match[0]
        const rawCode = match[1]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim()

        if (!rawCode) continue

        try {
            renderedCount += 1
            const obj = { code: rawCode, mermaid: { theme: 'default' } }
            const b64 = Buffer.from(JSON.stringify(obj)).toString('base64')
            const resp = await fetch(`https://mermaid.ink/svg/${b64}`, { signal: AbortSignal.timeout(4000) })
            if (resp.ok) {
                const svg = sanitizeMermaidSvg(await resp.text())
                if (svg && svg.includes('<svg')) {
                    const wrappedSvg = `<div class="diagram-mermaid-render" style="display: flex; justify-content: center; margin: 18px 0; break-inside: avoid;">${svg}</div>`
                    resultHtml = resultHtml.replace(fullMatch, wrappedSvg)
                }
            }
        } catch (e) {
            console.warn('[pdf_service] Mermaid wrapper diagram rendering failed:', e.message)
        }
    }

    return resultHtml
}

/**
 * Normalizes all SVG elements in HTML with explicit, readable print dimensions
 * preventing them from being shrunk to tiny thumbnails in Takumi-PDF layout.
 * @param {string} html - Input HTML
 * @param {number} maxContentWidth - Maximum content width in px (default 520 for A4 portrait, 740 for landscape)
 * @returns {string} HTML with scaled and dimensioned SVGs
 */
export function normalizeAllSvgsInHtml(html, maxContentWidth = 520) {
    if (!html || !html.includes('<svg')) return html

    return html.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, (svgMatch) => {
        const viewBoxMatch = svgMatch.match(/viewBox=["']\s*([-\d.]+)\s+([-\d.]+)\s+([\d.]+)\s+([\d.]+)\s*["']/i)

        let vbWidth = 0
        let vbHeight = 0
        if (viewBoxMatch) {
            vbWidth = parseFloat(viewBoxMatch[3])
            vbHeight = parseFloat(viewBoxMatch[4])
        } else {
            const widthMatch = svgMatch.match(/\bwidth=["']([\d.]+)p?x?["']/i)
            const heightMatch = svgMatch.match(/\bheight=["']([\d.]+)p?x?["']/i)
            if (widthMatch) vbWidth = parseFloat(widthMatch[1])
            if (heightMatch) vbHeight = parseFloat(heightMatch[1])
        }

        if (vbWidth > 0 && vbHeight > 0) {
            let targetWidth = vbWidth
            let targetHeight = vbHeight

            // If diagram is small or narrow (< 380px), scale it up for clear readability on A4
            if (vbWidth < 380) {
                const scale = Math.min(380 / vbWidth, 540 / vbHeight)
                if (scale > 1) {
                    targetWidth = Math.round(vbWidth * scale)
                    targetHeight = Math.round(vbHeight * scale)
                }
            }

            // If diagram is wider than printable page width, scale down proportionally
            if (targetWidth > maxContentWidth) {
                const scale = maxContentWidth / targetWidth
                targetWidth = Math.round(targetWidth * scale)
                targetHeight = Math.round(targetHeight * scale)
            }

            // Clean existing width, height, and style attributes from opening <svg> tag
            const openTagMatch = svgMatch.match(/<svg\b[^>]*>/i)
            if (!openTagMatch) return svgMatch

            let cleanOpenTag = openTagMatch[0]
                .replace(/\sstyle=["'][^"']*["']/i, '')
                .replace(/\swidth=["'][^"']*["']/i, '')
                .replace(/\sheight=["'][^"']*["']/i, '')

            cleanOpenTag = cleanOpenTag.replace(
                /<svg/i,
                `<svg width="${targetWidth}" height="${targetHeight}" style="width: ${targetWidth}px; height: ${targetHeight}px; max-width: 100%; display: block; margin: 0 auto;"`
            )

            return svgMatch.replace(openTagMatch[0], cleanOpenTag)
        }
        return svgMatch
    })
}

/**
 * Renders HTML content directly to a PDF binary buffer (Uint8Array)
 * @param {string} rawHtml - Input HTML content
 * @param {object} options - PDF rendering options
 * @returns {Promise<Uint8Array>} PDF binary bytes
 */
export async function renderHtmlToPdf(rawHtml = '', options = {}) {
    const {
        title = 'Document',
        author = 'David888 Wiki',
        size = 'a4',
        margin = { top: 40, right: 36, bottom: 40, left: 36 },
        landscape = false,
        siteUrl = 'https://wiki.david888.com',
    } = options

    // 1. Convert any unrendered Mermaid diagrams to vector SVG
    let processedHtml = await convertMermaidBlocksToSvg(rawHtml)

    // 2. Normalize and scale all SVG dimensions for high-resolution A4 readability
    const maxContentWidth = landscape ? 740 : 520
    processedHtml = normalizeAllSvgsInHtml(processedHtml, maxContentWidth)

    // 3. Wrap with styled layout
    const documentHtml = buildPdfDocumentHtml(processedHtml, { title })

    // 3. Parse to Takumi node tree and extract Emojis
    const { node } = fromHtml(documentHtml)
    const processedNode = extractEmojis(node, 'twemoji')

    // 4. Build Header & Footer nodes with page counters
    const safeTitle = (title || 'David888 Wiki').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 8.5px; color: #9ca3af; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; font-family: 'Noto Sans TC', 'Inter', sans-serif;">
            <span style="font-weight: 600; color: #6b7280;">David888 Wiki</span>
            <span style="color: #9ca3af; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;">${safeTitle}</span>
        </div>
    `
    const safeSiteUrl = String(siteUrl || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const footerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 8.5px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 5px; font-family: 'Noto Sans TC', 'Inter', sans-serif;">
            <span style="color: #9ca3af;">${safeSiteUrl}</span>
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>
    `

    const headerNode = extractEmojis(fromHtml(headerHtml).node, 'twemoji')
    const footerNode = extractEmojis(fromHtml(footerHtml).node, 'twemoji')

    // 5. Fetch / reuse Google Fonts (Noto Sans TC, JetBrains Mono, Inter)
    const fonts = await getPdfFonts()

    // 6. Execute Takumi-PDF vector rendering
    const pdfBytes = await takumi.render(processedNode, {
        size,
        landscape,
        margin,
        header: headerNode,
        footer: footerNode,
        fonts,
        metadata: {
            title,
            authors: [author],
            creator: 'David888 Wiki',
            creationDate: new Date().toISOString().split('.')[0] + 'Z',
        },
    })

    return pdfBytes
}

/**
 * Renders Markdown text to a PDF binary buffer (Uint8Array)
 * @param {string} markdown - Input Markdown content
 * @param {object} options - PDF rendering options
 * @returns {Promise<Uint8Array>} PDF binary bytes
 */
export async function renderMarkdownToPdf(markdown = '', options = {}) {
    const { theme = 'claude-canvas', title = 'Document' } = options
    const rawHtml = renderMarkdownToHtml(markdown, { theme, fullHtml: false, title })
    return renderHtmlToPdf(rawHtml, options)
}

/**
 * Creates a standard downloadable PDF Response
 * @param {Uint8Array} pdfBytes - PDF binary data
 * @param {string} filename - Download file name
 * @returns {Response} HTTP response with application/pdf headers
 */
export function createPdfResponse(pdfBytes, filename = 'document.pdf') {
    const safeFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
    const asciiFilename = safeFilename.replace(/["\r\n;\\]/g, '_').replace(/[^\x20-\x7E]/g, '_') || 'document.pdf'
    const encodedFilename = encodeURIComponent(safeFilename)

    return new Response(pdfBytes, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
            'Content-Length': String(pdfBytes.length),
            'Cache-Control': 'public, max-age=60, s-maxage=300',
        },
    })
}
