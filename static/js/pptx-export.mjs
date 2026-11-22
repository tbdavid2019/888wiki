/**
 * Pure ES-Module Editable PowerPoint (.pptx) Exporter for 888wiki.
 * Generates standards-compliant OpenXML PresentationML (16:9 widescreen)
 * directly in the browser or Node without external dependencies.
 */

const SLIDE_WIDTH_EMU = 12192000 // 13.333 in (16:9)
const SLIDE_HEIGHT_EMU = 6858000 // 7.5 in (16:9)

const DARK_THEME_NAMES = new Set([
    'catppuccin-macchiato',
    'kanagawa',
    'terminal',
    'tokyo-night',
    'x-ai',
])

const CRC_TABLE = (() => {
    const table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
        let c = i
        for (let k = 0; k < 8; k++) {
            c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
        }
        table[i] = c >>> 0
    }
    return table
})()

function crc32(bytes) {
    let crc = 0xffffffff
    for (let i = 0; i < bytes.length; i++) {
        crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
    }
    return (crc ^ 0xffffffff) >>> 0
}

function escapeXml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        // Strip ASCII control chars illegal in XML 1.0
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

function stripInlineMarkdown(line) {
    return String(line || '')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/==([^=]+)==/g, '$1')
        .replace(/\{v-click\}/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .trim()
}

/**
 * Parses Markdown (including YAML frontmatter and --- / -- slide separators)
 * into structured slide objects ready for OOXML rendering.
 * @param {string} markdown
 * @param {{ title?: string }} [options]
 */
export function parseMarkdownToSlides(markdown, options = {}) {
    let source = String(markdown || '').replace(/\r\n/g, '\n')
    let docTitle = String(options.title || '').trim()

    // Strip YAML frontmatter if present
    const yamlMatch = source.match(/^---\n([\s\S]*?)\n---\n?/)
    if (yamlMatch) {
        const yamlBody = yamlMatch[1]
        if (/^[a-zA-Z0-9_-]+\s*:\s*.+/m.test(yamlBody) && !yamlBody.trim().startsWith('#')) {
            const titleMatch = yamlBody.match(/^title\s*:\s*(.+)$/m)
            if (titleMatch && !docTitle) {
                docTitle = titleMatch[1].trim().replace(/^['"]|['"]$/g, '')
            }
            source = source.slice(yamlMatch[0].length)
        }
    }
    source = source.replace(/^\s*---\s*\n/, '')

    // Split into horizontal and vertical chunks
    const rawChunks = []
    const hChunks = source.split(/\n\s*---\s*\n/)
    for (const h of hChunks) {
        const vChunks = h.split(/\n\s*--\s*\n/)
        for (const v of vChunks) {
            if (v.trim()) rawChunks.push(v.trim())
        }
    }

    if (rawChunks.length === 0) {
        return [{
            title: docTitle || 'Untitled Presentation',
            subtitle: '',
            blocks: [],
            isCover: true,
        }]
    }

    return rawChunks.map((chunk, index) => {
        const isExplicitCover = /<!--\s*(?:layout:\s*cover|cover)\s*-->/i.test(chunk)
        const cleaned = chunk
            .replace(/::left::|::center::|::middle::|::right::/g, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .trim()

        const lines = cleaned.split('\n')
        let title = ''
        let subtitle = ''
        const blocks = []
        let inCode = false
        let codeLines = []

        for (const rawLine of lines) {
            const trimmed = rawLine.trim()
            if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
                if (!inCode) {
                    inCode = true
                    codeLines = []
                } else {
                    inCode = false
                    if (codeLines.length > 0) {
                        blocks.push({ kind: 'code', text: codeLines.join('\n') })
                    }
                }
                continue
            }
            if (inCode) {
                codeLines.push(rawLine)
                continue
            }
            if (!trimmed) continue

            const h1Match = trimmed.match(/^#\s+(.+)$/)
            const h2Match = trimmed.match(/^##\s+(.+)$/)
            const h3Match = trimmed.match(/^###+\s+(.+)$/)

            if (h1Match && !title) {
                title = stripInlineMarkdown(h1Match[1])
                continue
            }
            if (h2Match && !title) {
                title = stripInlineMarkdown(h2Match[1])
                continue
            }
            if (h2Match && title && !subtitle && blocks.length === 0 && (isExplicitCover || index === 0)) {
                subtitle = stripInlineMarkdown(h2Match[1])
                continue
            }
            if (h2Match || h3Match) {
                const headingText = stripInlineMarkdown((h2Match || h3Match)[1])
                if (headingText) blocks.push({ kind: 'subheading', text: headingText })
                continue
            }

            const bulletMatch = trimmed.match(/^[-*+]\s+(?:\[[ xX]\]\s+)?(.+)$/)
            const orderedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
            const quoteMatch = trimmed.match(/^>\s*(?:\[![A-Z]+\]\s*)?(.*)$/)

            if (bulletMatch) {
                const txt = stripInlineMarkdown(bulletMatch[1])
                if (txt) blocks.push({ kind: 'bullet', text: txt })
            } else if (orderedMatch) {
                const txt = stripInlineMarkdown(orderedMatch[1])
                if (txt) blocks.push({ kind: 'bullet', text: txt })
            } else if (quoteMatch) {
                const txt = stripInlineMarkdown(quoteMatch[1])
                if (txt) blocks.push({ kind: 'quote', text: txt })
            } else if (/^\|.*\|$/.test(trimmed)) {
                if (!/^\|[\s:-]+\|$/.test(trimmed)) {
                    const cells = trimmed.slice(1, -1).split('|').map(c => stripInlineMarkdown(c)).filter(Boolean)
                    if (cells.length > 0) blocks.push({ kind: 'paragraph', text: cells.join('  |  ') })
                }
            } else {
                const txt = stripInlineMarkdown(trimmed)
                if (txt) blocks.push({ kind: 'paragraph', text: txt })
            }
        }

        if (inCode && codeLines.length > 0) {
            blocks.push({ kind: 'code', text: codeLines.join('\n') })
        }

        const isCover = isExplicitCover || (index === 0 && Boolean(title) && blocks.length <= 2 && !blocks.some(b => b.kind === 'bullet' || b.kind === 'code'))
        return {
            title: title || (index === 0 && docTitle ? docTitle : `Slide ${index + 1}`),
            subtitle,
            blocks,
            isCover,
        }
    })
}

/**
 * Packages an array of `{ name: string, data: string | Uint8Array }`
 * into a standard uncompressed (Store) PKZIP Uint8Array.
 * @param {Array<{ name: string, data: string | Uint8Array }>} entries
 * @returns {Uint8Array}
 */
export function createZipUint8Array(entries) {
    const encoder = new TextEncoder()
    const localParts = []
    const centralParts = []
    let offset = 0

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name)
        const dataBytes = entry.data instanceof Uint8Array ? entry.data : encoder.encode(String(entry.data || ''))
        const crc = crc32(dataBytes)

        // Local file header (30 bytes + filename)
        const localHeader = new Uint8Array(30 + nameBytes.length)
        const lv = new DataView(localHeader.buffer)
        lv.setUint32(0, 0x04034b50, true)
        lv.setUint16(4, 20, true) // version needed
        lv.setUint16(6, 0x0800, true) // UTF-8 flag
        lv.setUint16(8, 0, true) // method 0 = store
        lv.setUint16(10, 0, true) // mod time
        lv.setUint16(12, 0x5421, true) // mod date
        lv.setUint32(14, crc, true)
        lv.setUint32(18, dataBytes.length, true)
        lv.setUint32(22, dataBytes.length, true)
        lv.setUint16(26, nameBytes.length, true)
        lv.setUint16(28, 0, true)
        localHeader.set(nameBytes, 30)

        localParts.push(localHeader, dataBytes)

        // Central directory header (46 bytes + filename)
        const centralHeader = new Uint8Array(46 + nameBytes.length)
        const cv = new DataView(centralHeader.buffer)
        cv.setUint32(0, 0x02014b50, true)
        cv.setUint16(4, 20, true)
        cv.setUint16(6, 20, true)
        cv.setUint16(8, 0x0800, true)
        cv.setUint16(10, 0, true)
        cv.setUint16(12, 0, true)
        cv.setUint16(14, 0x5421, true)
        cv.setUint32(16, crc, true)
        cv.setUint32(20, dataBytes.length, true)
        cv.setUint32(24, dataBytes.length, true)
        cv.setUint16(28, nameBytes.length, true)
        cv.setUint16(30, 0, true)
        cv.setUint16(32, 0, true)
        cv.setUint16(34, 0, true)
        cv.setUint16(36, 0, true)
        cv.setUint32(38, 0, true)
        cv.setUint32(42, offset, true)
        centralHeader.set(nameBytes, 46)

        centralParts.push(centralHeader)
        offset += localHeader.length + dataBytes.length
    }

    const centralOffset = offset
    let centralSize = 0
    for (const part of centralParts) centralSize += part.length

    const eocd = new Uint8Array(22)
    const ev = new DataView(eocd.buffer)
    ev.setUint32(0, 0x06054b50, true)
    ev.setUint16(4, 0, true)
    ev.setUint16(6, 0, true)
    ev.setUint16(8, entries.length, true)
    ev.setUint16(10, entries.length, true)
    ev.setUint32(12, centralSize, true)
    ev.setUint32(16, centralOffset, true)
    ev.setUint16(20, 0, true)

    const totalLength = centralOffset + centralSize + eocd.length
    const out = new Uint8Array(totalLength)
    let cursor = 0
    for (const part of localParts) {
        out.set(part, cursor)
        cursor += part.length
    }
    for (const part of centralParts) {
        out.set(part, cursor)
        cursor += part.length
    }
    out.set(eocd, cursor)
    return out
}

function buildTextParagraphXml(text, opts = {}) {
    const {
        fontSizePt = 20,
        bold = false,
        italic = false,
        color = '1E293B',
        align = 'l',
        fontFace = 'Noto Sans TC',
        spaceAfterPt = 8,
        bullet = false,
    } = opts
    const sz = Math.round(fontSizePt * 100)
    const spcAfter = Math.round(spaceAfterPt * 100)
    const lines = String(text || '').split('\n')

    return lines.map((line, idx) => {
        const prefix = (bullet && idx === 0) ? '•  ' : ''
        return `<a:p>
            <a:pPr algn="${align}" marL="${bullet ? '228600' : '0'}" indent="${bullet ? '-228600' : '0'}">
                <a:spcAft><a:spcPts val="${spcAfter}"/></a:spcAft>
            </a:pPr>
            <a:r>
                <a:rPr lang="zh-TW" sz="${sz}" b="${bold ? '1' : '0'}" i="${italic ? '1' : '0'}" dirty="0">
                    <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
                    <a:latin typeface="${escapeXml(fontFace)}"/>
                    <a:ea typeface="${escapeXml(fontFace)}"/>
                </a:rPr>
                <a:t>${escapeXml(prefix + line)}</a:t>
            </a:r>
        </a:p>`
    }).join('')
}

function buildSlideXml(slide, slideIndex, palette) {
    const { bg, titleColor, bodyColor, mutedColor, accentColor } = palette
    const shapes = []
    let nextId = 2

    if (slide.isCover) {
        shapes.push(`<p:sp>
            <p:nvSpPr><p:cNvPr id="${nextId++}" name="CoverTitle"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="914400" y="2100000"/><a:ext cx="10363200" cy="1800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
            <p:txBody><a:bodyPr wrap="square" anchor="ctr"/><a:lstStyle/>
                ${buildTextParagraphXml(slide.title, { fontSizePt: 40, bold: true, color: titleColor, align: 'ctr', spaceAfterPt: 14 })}
                ${slide.subtitle ? buildTextParagraphXml(slide.subtitle, { fontSizePt: 20, color: mutedColor, align: 'ctr', spaceAfterPt: 8 }) : ''}
            </p:txBody>
        </p:sp>`)

        if (slide.blocks.length > 0) {
            const subParagraphs = slide.blocks.map(b =>
                buildTextParagraphXml(b.text, { fontSizePt: 18, color: mutedColor, align: 'ctr', spaceAfterPt: 6 })
            ).join('')
            shapes.push(`<p:sp>
                <p:nvSpPr><p:cNvPr id="${nextId++}" name="CoverBody"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
                <p:spPr><a:xfrm><a:off x="1371600" y="4050000"/><a:ext cx="9448800" cy="1800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
                <p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>${subParagraphs}</p:txBody>
            </p:sp>`)
        }
    } else {
        // Accent rule under header
        shapes.push(`<p:sp>
            <p:nvSpPr><p:cNvPr id="${nextId++}" name="HeaderRule"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="762000" y="1380000"/><a:ext cx="10668000" cy="24000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${accentColor}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>
        </p:sp>`)

        // Title box
        shapes.push(`<p:sp>
            <p:nvSpPr><p:cNvPr id="${nextId++}" name="SlideTitle"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="762000" y="457200"/><a:ext cx="10668000" cy="880000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
            <p:txBody><a:bodyPr wrap="square" anchor="b"/><a:lstStyle/>
                ${buildTextParagraphXml(slide.title, { fontSizePt: 28, bold: true, color: titleColor, align: 'l', spaceAfterPt: 4 })}
            </p:txBody>
        </p:sp>`)

        // Body box
        const bodyXml = slide.blocks.length > 0
            ? slide.blocks.map(b => {
                if (b.kind === 'subheading') {
                    return buildTextParagraphXml(b.text, { fontSizePt: 20, bold: true, color: accentColor, spaceAfterPt: 8 })
                }
                if (b.kind === 'bullet') {
                    return buildTextParagraphXml(b.text, { fontSizePt: 18, color: bodyColor, bullet: true, spaceAfterPt: 8 })
                }
                if (b.kind === 'quote') {
                    return buildTextParagraphXml(`“${b.text}”`, { fontSizePt: 17, italic: true, color: mutedColor, spaceAfterPt: 10 })
                }
                if (b.kind === 'code') {
                    return buildTextParagraphXml(b.text, { fontSizePt: 13, color: mutedColor, fontFace: 'JetBrains Mono', spaceAfterPt: 10 })
                }
                return buildTextParagraphXml(b.text, { fontSizePt: 18, color: bodyColor, spaceAfterPt: 8 })
            }).join('')
            : buildTextParagraphXml('', { fontSizePt: 18, color: bodyColor })

        shapes.push(`<p:sp>
            <p:nvSpPr><p:cNvPr id="${nextId++}" name="SlideBody"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
            <p:spPr><a:xfrm><a:off x="762000" y="1600000"/><a:ext cx="10668000" cy="4650000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
            <p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>${bodyXml}</p:txBody>
        </p:sp>`)
    }

    // Slide number footer
    shapes.push(`<p:sp>
        <p:nvSpPr><p:cNvPr id="${nextId++}" name="SlideNumber"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="10800000" y="6380000"/><a:ext cx="700000" cy="300000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
        <p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>
            ${buildTextParagraphXml(String(slideIndex + 1), { fontSizePt: 11, color: mutedColor, align: 'r', spaceAfterPt: 0 })}
        </p:txBody>
    </p:sp>`)

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${bg}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${shapes.join('\n      ')}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`
}

/**
 * Generates an editable .pptx binary buffer from Markdown content.
 * @param {string} markdown
 * @param {{ title?: string, theme?: string, dark?: boolean }} [options]
 * @returns {Uint8Array}
 */
export function buildPptxBuffer(markdown, options = {}) {
    const slides = parseMarkdownToSlides(markdown, options)
    const isDark = options.dark === true || DARK_THEME_NAMES.has(String(options.theme || '').toLowerCase())

    const palette = isDark
        ? { bg: '111A2C', titleColor: 'F8FAFC', bodyColor: 'E2E8F0', mutedColor: '94A3B8', accentColor: '38BDF8' }
        : { bg: 'FDFBF7', titleColor: '18181B', bodyColor: '27272A', mutedColor: '64748B', accentColor: 'C26D4A' }

    const slideContentTypes = slides
        .map((_, idx) => `<Override PartName="/ppt/slides/slide${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
        .join('\n  ')

    const slideRels = slides
        .map((_, idx) => `<Relationship Id="rId${idx + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${idx + 1}.xml"/>`)
        .join('\n  ')

    const slideIdList = slides
        .map((_, idx) => `<p:sldId id="${256 + idx}" r:id="rId${idx + 2}"/>`)
        .join('')

    const entries = [
        {
            name: '[Content_Types].xml',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${slideContentTypes}
</Types>`,
        },
        {
            name: '_rels/.rels',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
        },
        {
            name: 'ppt/presentation.xml',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${slideIdList}</p:sldIdLst>
  <p:sldSz cx="${SLIDE_WIDTH_EMU}" cy="${SLIDE_HEIGHT_EMU}"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`,
        },
        {
            name: 'ppt/_rels/presentation.xml.rels',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRels}
</Relationships>`,
        },
        {
            name: 'ppt/slideMasters/slideMaster1.xml',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`,
        },
        {
            name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
        },
        {
            name: 'ppt/slideLayouts/slideLayout1.xml',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`,
        },
        {
            name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
        },
        {
            name: 'ppt/theme/theme1.xml',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="888wiki">
  <a:themeElements>
    <a:clrScheme name="888wiki">
      <a:dk1><a:srgbClr val="18181B"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="27272A"/></a:dk2><a:lt2><a:srgbClr val="F4F4F5"/></a:lt2>
      <a:accent1><a:srgbClr val="38BDF8"/></a:accent1><a:accent2><a:srgbClr val="C26D4A"/></a:accent2>
      <a:accent3><a:srgbClr val="10B981"/></a:accent3><a:accent4><a:srgbClr val="8B5CF6"/></a:accent4>
      <a:accent5><a:srgbClr val="F59E0B"/></a:accent5><a:accent6><a:srgbClr val="EC4899"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="888wiki">
      <a:majorFont><a:latin typeface="Noto Sans TC"/><a:ea typeface="Noto Sans TC"/><a:cs typeface="Noto Sans TC"/></a:majorFont>
      <a:minorFont><a:latin typeface="Noto Sans TC"/><a:ea typeface="Noto Sans TC"/><a:cs typeface="Noto Sans TC"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="888wiki"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
</a:theme>`,
        },
    ]

    slides.forEach((slide, idx) => {
        entries.push({
            name: `ppt/slides/slide${idx + 1}.xml`,
            data: buildSlideXml(slide, idx, palette),
        })
        entries.push({
            name: `ppt/slides/_rels/slide${idx + 1}.xml.rels`,
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`,
        })
    })

    return createZipUint8Array(entries)
}

/**
 * Generates a downloadable Blob for an editable .pptx file.
 * @param {string} markdown
 * @param {{ title?: string, theme?: string, dark?: boolean }} [options]
 * @returns {Blob}
 */
export function buildPptxBlob(markdown, options = {}) {
    const buffer = buildPptxBuffer(markdown, options)
    return new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
}
