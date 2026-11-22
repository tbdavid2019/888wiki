const TITLE_MAX_LENGTH = 70

function isIgnoredTitleLine(trimmed = '') {
    if (!trimmed) return true
    if (/^\[toc\]$/i.test(trimmed) || /^\{:toc\}$/i.test(trimmed)) return true
    if (/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(trimmed)) return true
    if (/^<!--[\s\S]*-->$/.test(trimmed)) return true
    if (/^[-*_]{3,}$/.test(trimmed)) return true
    if (/^\[(color|bg)=[^\]]+\]$/i.test(trimmed) || /^\[\/(color|bg)\]$/i.test(trimmed)) return true
    if (/^(好的[，,：:]|這是為您|以下是|Certainly[!,：:]|Here is|Below is|Sure[!,：:]|Okay[!,：:])/i.test(trimmed) && trimmed.length < 40) return true
    return false
}

function normalizeTitleCandidate(value = '') {
    const trimmed = String(value || '').trim()
    if (!trimmed || isIgnoredTitleLine(trimmed)) return ''
    return trimmed
        .replace(/^#{1,6}\s*/, '')
        .replace(/^>\s*/, '')
        .replace(/^\s*[-*+]\s+/, '')
        .replace(/^\s*\d+\.\s+/, '')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[*_~`]/g, '')
        .replace(/\s+/g, ' ')
        .substring(0, TITLE_MAX_LENGTH)
        .trim()
}

function isWeakTitleCandidate(value = '') {
    return /^[a-z0-9][a-z0-9_-]{0,7}$/i.test(value.trim())
}

function tiptapNodeText(node) {
    if (!node || typeof node !== 'object') return ''
    if (typeof node.text === 'string') return node.text
    return Array.isArray(node.content) ? node.content.map(tiptapNodeText).join('') : ''
}

function getTiptapDocument(value = '') {
    const trimmed = String(value || '').trim()
    if (!trimmed.startsWith('{') || !trimmed.includes('"type":"doc"')) return null
    try {
        const parsed = JSON.parse(trimmed)
        return parsed?.type === 'doc' && Array.isArray(parsed.content) ? parsed : null
    } catch {
        return null
    }
}

function extractContentTitle(value = '') {
    const trimmedVal = String(value || '').trim()
    const tiptapDocument = getTiptapDocument(trimmedVal)
    if (tiptapDocument) {
        for (const node of tiptapDocument.content) {
            if (node?.type === 'heading') {
                const candidate = normalizeTitleCandidate(tiptapNodeText(node))
                if (candidate && !isIgnoredTitleLine(candidate)) return candidate
            }
        }
        for (const node of tiptapDocument.content) {
            if (node?.type === 'paragraph') {
                const candidate = normalizeTitleCandidate(tiptapNodeText(node))
                if (candidate && !isIgnoredTitleLine(candidate)) return candidate
            }
        }
        return ''
    }
    if (isWhiteboardContent(trimmedVal)) {
        try {
            const parsed = JSON.parse(trimmedVal)
            for (const element of parsed.elements || []) {
                if (element?.isDeleted || element?.type !== 'text' || typeof element.text !== 'string') continue
                if (element.id === 'wb-welcome-text') continue
                const candidate = normalizeTitleCandidate(element.text.split('\n')[0])
                if (candidate && !isIgnoredTitleLine(candidate)) return candidate
            }
        } catch (e) {}
        return ''
    }
    if (trimmedVal.startsWith('{') && (trimmedVal.includes('"nodes"') || trimmedVal.includes('"edges"'))) {
        try {
            const parsed = JSON.parse(trimmedVal)
            if (parsed && Array.isArray(parsed.nodes)) {
                for (const n of parsed.nodes) {
                    if (n && typeof n.text === 'string' && n.text.trim()) {
                        const candidate = normalizeTitleCandidate(n.text.split('\n')[0])
                        if (candidate && !isIgnoredTitleLine(candidate)) return candidate
                    }
                    if (n && typeof n.label === 'string' && n.label.trim()) {
                        const candidate = normalizeTitleCandidate(n.label)
                        if (candidate && !isIgnoredTitleLine(candidate)) return candidate
                    }
                }
                return ''
            }
        } catch (e) {}
    }
    if (trimmedVal.startsWith('{') && trimmedVal.includes('"blocks"')) {
        try {
            const parsed = JSON.parse(trimmedVal)
            if (parsed && Array.isArray(parsed.blocks)) {
                for (const b of parsed.blocks) {
                    if (b && b.type === 'heading' && b.props && typeof b.props.text === 'string' && b.props.text.trim()) {
                        const candidate = normalizeTitleCandidate(b.props.text)
                        if (candidate && !isIgnoredTitleLine(candidate)) return candidate
                    }
                }
                for (const b of parsed.blocks) {
                    if (b && b.type === 'paragraph' && b.props && typeof b.props.text === 'string' && b.props.text.trim()) {
                        const candidate = normalizeTitleCandidate(b.props.text)
                        if (candidate && !isIgnoredTitleLine(candidate)) return candidate
                    }
                }
                return ''
            }
        } catch (e) {}
    }

    const lines = String(value || '').split('\n').slice(0, 50)
    let inFence = false
    let inFrontmatter = false
    let sawContent = false

    const h1Candidates = []
    const h2Candidates = []
    const paragraphCandidates = []

    for (const line of lines) {
        const trimmed = line.trim()

        if (!trimmed) continue

        if (!sawContent && trimmed === '---') {
            inFrontmatter = true
            sawContent = true
            continue
        }

        if (inFrontmatter) {
            if (trimmed === '---' || trimmed === '...') inFrontmatter = false
            continue
        }

        if (/^(```|~~~)/.test(trimmed)) {
            inFence = !inFence
            sawContent = true
            continue
        }

        if (inFence || isIgnoredTitleLine(trimmed)) {
            sawContent = true
            continue
        }

        if (/^#\s+/.test(trimmed)) {
            const candidate = normalizeTitleCandidate(trimmed)
            if (candidate) h1Candidates.push(candidate)
        } else if (/^##\s+/.test(trimmed)) {
            const candidate = normalizeTitleCandidate(trimmed)
            if (candidate) h2Candidates.push(candidate)
        } else {
            const candidate = normalizeTitleCandidate(trimmed)
            if (candidate) paragraphCandidates.push(candidate)
        }
        sawContent = true
    }

    if (h1Candidates.length > 0) {
        const strongH1 = h1Candidates.find(c => !isWeakTitleCandidate(c)) || h1Candidates[0]
        if (strongH1) return strongH1
    }

    if (h2Candidates.length > 0) {
        const strongH2 = h2Candidates.find(c => !isWeakTitleCandidate(c)) || h2Candidates[0]
        if (strongH2) return strongH2
    }

    const strongParagraph = paragraphCandidates.find(c => !isWeakTitleCandidate(c)) || paragraphCandidates[0]
    return strongParagraph || ''
}

export function extractNoteTitle(value = '', metadataTitle = '', fallback = '') {
    const metadataCandidate = normalizeTitleCandidate(metadataTitle)
    const contentTitle = extractContentTitle(value)

    if (metadataCandidate) return metadataCandidate

    return contentTitle || metadataCandidate || normalizeTitleCandidate(fallback)
}

export function extractNoteDescription(value = '', fallbackTitle = '') {
    let str = value
    const trimmedVal = String(value || '').trim()
    const tiptapDocument = getTiptapDocument(trimmedVal)
    if (tiptapDocument) {
        str = tiptapDocument.content.map(tiptapNodeText).filter(Boolean).join(' ')
    } else if (isWhiteboardContent(trimmedVal)) {
        try {
            const parsed = JSON.parse(trimmedVal)
            str = (parsed.elements || [])
                .filter(element => element && !element.isDeleted && element.type === 'text' && typeof element.text === 'string')
                .map(element => element.text)
                .join(' ')
        } catch (e) {}
    } else if (trimmedVal.startsWith('{') && (trimmedVal.includes('"nodes"') || trimmedVal.includes('"edges"'))) {
        try {
            const parsed = JSON.parse(trimmedVal)
            if (parsed && Array.isArray(parsed.nodes)) {
                str = parsed.nodes.map(n => (n && (n.text || n.label)) || '').filter(Boolean).join(' ')
            }
        } catch (e) {}
    } else if (trimmedVal.startsWith('{') && trimmedVal.includes('"blocks"')) {
        try {
            const parsed = JSON.parse(trimmedVal)
            if (parsed && Array.isArray(parsed.blocks)) {
                str = parsed.blocks.map(b => (b && b.props && b.props.text) || '').filter(Boolean).join(' ')
            }
        } catch (e) {}
    }

    const plain = str
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]*`/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/[>*_~|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    return (plain || fallbackTitle || 'Shared note on david888 wiki').substring(0, 180)
}

export function resolveAnnotationsEnabled(metadata = {}) {
    return metadata.share === true && metadata.annotationsEnabled !== false
}

export function isNewNoteEntry(requestUrl, value = '', metadata = {}) {
    let url
    try {
        url = requestUrl instanceof URL ? requestUrl : new URL(requestUrl)
    } catch {
        return false
    }

    const metadataKeys = Object.keys(metadata || {}).filter(key => metadata[key] !== undefined)
    const isCreationMetadata = metadataKeys.every(key => key === 'editorFormat' || key === 'blockDocumentVersion')

    return url.searchParams.get('new') === '1'
        && !String(value || '').trim()
        && isCreationMetadata
}

export function formatNewNoteTitle(lang = 'zh-TW', random = Math.random) {
    const openingPrompts = lang === 'en-US'
        ? [
            'Prologue / Where Every Story Begins',
            'The Art of Creation / Build Your Personal Knowledge Universe',
            'From Small Signs / Let Your Ideas Take Root and Grow',
        ]
        : [
            '序章 / 一切故事的開始',
            '天工開物 / 建立你的個人知識宇宙',
            '見微知著 / 這裡慢慢萌芽長大',
        ]
    const index = Math.min(openingPrompts.length - 1, Math.max(0, Math.floor(random() * openingPrompts.length)))
    return openingPrompts[index]
}

export function isCanvasContent(content) {
    if (!content) return false
    if (typeof content === 'object') {
        return Array.isArray(content.nodes)
    }
    if (typeof content === 'string') {
        const trimmed = content.trim()
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed)
                return Boolean(parsed && typeof parsed === 'object' && Array.isArray(parsed.nodes))
            } catch (_) {
                return false
            }
        }
    }
    return false
}

export function isWhiteboardContent(content) {
    if (typeof content === 'string') {
        const trimmed = content.trim()
        if (trimmed.startsWith('{') && (trimmed.includes('"type":"excalidraw"') || trimmed.includes('"type": "excalidraw"') || trimmed.includes('"elements"'))) {
            try {
                const parsed = JSON.parse(trimmed)
                return Boolean(parsed && typeof parsed === 'object' && (parsed.type === 'excalidraw' || Array.isArray(parsed.elements)))
            } catch (_) {
                return false
            }
        }
    }
    return false
}

export function resolveEditorFormat(metadata = {}, content = '') {
    if (metadata && metadata.editorFormat === 'whiteboard') return 'whiteboard'
    if (metadata && metadata.editorFormat === 'canvas') return 'canvas'
    if (metadata && metadata.editorFormat === 'block') return 'block'
    if (isWhiteboardContent(content)) return 'whiteboard'
    if (isCanvasContent(content)) return 'canvas'
    return 'markdown'
}

export function resolveLockedEditorFormat(metadata = {}, requestedFormat = undefined) {
    const existing = metadata?.editorFormat
    const validFormats = ['block', 'markdown', 'canvas', 'whiteboard']
    if (existing !== undefined && !validFormats.includes(existing)) {
        throw new TypeError('Invalid stored editor format')
    }
    if (requestedFormat !== undefined && !validFormats.includes(requestedFormat)) {
        throw new TypeError('Invalid editor format')
    }
    if (existing && requestedFormat && existing !== requestedFormat) {
        throw new TypeError('editorFormat is immutable after note creation')
    }
    return existing || requestedFormat || 'markdown'
}

export function parseExpirationSeconds(value) {
    if (value === null || value === undefined || value === '' || value === 'none' || value === 'never' || value === 0 || value === '0') {
        return null
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 0 ? Math.floor(value) : null
    }
    if (typeof value !== 'string') return null
    const str = value.trim().toLowerCase()
    if (!str || str === 'none' || str === 'never') return null

    const match = str.match(/^(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days|w|wk|week|weeks|mo|month|months|y|yr|year|years)?$/)
    if (!match) return null

    const count = parseInt(match[1], 10)
    if (!Number.isFinite(count) || count <= 0) return null

    const unit = match[2] || 's'
    if (unit.startsWith('s')) return count
    if (unit.startsWith('m') && !unit.startsWith('mo')) return count * 60
    if (unit.startsWith('h')) return count * 3600
    if (unit.startsWith('d')) return count * 86400
    if (unit.startsWith('w')) return count * 604800
    if (unit.startsWith('mo')) return count * 2592000
    if (unit.startsWith('y')) return count * 31536000

    return count
}

export function safeJsonForInlineScript(value) {
    return JSON.stringify(value === undefined ? null : value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029')
}

export function isBurnProtected(metadata = {}) {
    return Boolean(
        metadata
        && (
            metadata.shareMode === 'burn'
            || metadata.shareMode === 'burn_after_reading'
            || metadata.shareBurnAfterReading === true
        )
    )
}

export function isShareExpired(metadata = {}, nowUnix = Math.floor(Date.now() / 1000)) {
    const expiresAt = Number(metadata?.shareExpiresAt)
    return Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= nowUnix
}

export function isShareBurned(metadata = {}) {
    if (metadata?.burned === true || metadata?.shareBurned === true) return true
    const burnedAt = Number(metadata?.shareBurnedAt)
    if (Number.isFinite(burnedAt) && burnedAt > 0) return true
    const maxViews = Math.max(1, parseInt(metadata?.shareMaxViews || metadata?.sealMaxViews, 10) || 1)
    if (isBurnProtected(metadata) && metadata?.shareViewCount !== undefined && metadata?.shareViewCount !== null && Number(metadata?.shareViewCount) >= maxViews) return true
    return false
}

export function isShareTimeLocked(metadata = {}, nowUnix = Math.floor(Date.now() / 1000)) {
    if (metadata?.shareMode !== 'timelock') return false
    const unlockAt = Number(metadata?.shareUnlockAt)
    return Number.isFinite(unlockAt) && unlockAt > nowUnix
}

export function isShareDeadmanLocked(metadata = {}, nowUnix = Math.floor(Date.now() / 1000)) {
    if (metadata?.shareMode !== 'deadman') return false
    const pulseDueAt = Number(metadata?.sharePulseDueAt)
    return Number.isFinite(pulseDueAt) && pulseDueAt > nowUnix
}

export function formatShareRemainingTime(expiresAt, param2 = Math.floor(Date.now() / 1000), param3 = 'zh-TW') {
    const nowUnix = typeof param2 === 'number' ? param2 : Math.floor(Date.now() / 1000)
    const lang = typeof param2 === 'string' ? param2 : (param3 || 'zh-TW')
    const expiresNum = Number(expiresAt)
    if (!Number.isFinite(expiresNum) || expiresNum <= 0) return ''
    const diff = expiresNum - nowUnix
    if (diff <= 0) return lang === 'zh-TW' ? '已過期' : 'Expired'
    if (diff < 60) return lang === 'zh-TW' ? `${diff} 秒` : `${diff}s`
    if (diff < 3600) {
        const mins = Math.ceil(diff / 60)
        return lang === 'zh-TW' ? `${mins} 分鐘` : `${mins} min`
    }
    if (diff < 86400) {
        const hrs = Math.floor(diff / 3600)
        const mins = Math.ceil((diff % 3600) / 60)
        return lang === 'zh-TW' ? `${hrs} 小時 ${mins} 分` : `${hrs}h ${mins}m`
    }
    const days = Math.floor(diff / 86400)
    const hrs = Math.floor((diff % 86400) / 3600)
    return lang === 'zh-TW' ? `${days} 天 ${hrs} 小時` : `${days}d ${hrs}h`
}
