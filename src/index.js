import dayjs from 'dayjs'
import { Router } from 'itty-router'
import { Cookies } from './cookie_compat.mjs'
import jwt from '@tsndr/cloudflare-worker-jwt'
import { queryNote, MD5, checkAuth, genRandomStr, returnPage, returnJSON, saltPw, passwordMatches, getPasswordRole, getI18n, deleteEmptyPages, deleteNoteHistoryForPath } from './helper.js'
import { APP_NAME, getSlugLength, getAdminPath, getAdminPassword, getEnableR2, getR2Domain, getGaMeasurementId, getWebtalkConfig, getSecret, DEFAULT_PREVIEW_WIDTH, normalizePreviewWidth, isTurnstileEnabled } from './constant.js'
import { verifyTurnstileAccess } from './turnstile.mjs'
import { NOTEPAD_ICON_SVG } from './icon.js'
import { NOTEPAD_FAVICON_ICO, NOTEPAD_ICON_PNG, NOTEPAD_OG_IMAGE_PNG } from './icon_assets.js'
import { handleMcpRequest } from './mcp_server.mjs'
import {
    generateChallenge,
    base64UrlToBytes,
    bytesToBase64Url,
    parseAttestationObject,
    verifyFidoAssertion,
    getFidoCredentials,
    saveFidoCredential,
    deleteFidoCredential,
    storeFidoChallenge,
    verifyAndConsumeFidoChallenge,
} from './fido_auth.mjs'
import { createOfflinePageResponse } from './offline_page.js'
import {
    extractNoteDescription,
    extractNoteTitle,
    formatNewNoteTitle,
    isNewNoteEntry,
    resolveAnnotationsEnabled,
    resolveEditorFormat,
    resolveLockedEditorFormat,
    parseExpirationSeconds,
    isShareExpired,
    isShareBurned,
    isShareTimeLocked,
    isShareDeadmanLocked,
    formatShareRemainingTime,
} from './note_meta.js'
import { renderBlockToHtml, blockToMarkdown, parseBlockDocument, validateBlockDocument } from './block_renderer.mjs'
import { canvasToMarkdown, validateCanvasDocument, parseCanvasDocument } from './canvas_document.mjs'
import { whiteboardToMarkdown, validateWhiteboardDocument, parseWhiteboardDocument, DEFAULT_WHITEBOARD_DOCUMENT } from './whiteboard_document.mjs'
import { renderMarkdownToHtml, parseHtmlToMarkdown, extractMarkdownData, lintMarkdownText } from './markdown-processor.mjs'
import { driverQueryNote, driverPutNote, driverDeleteNote, driverQueryShare, driverPutShare, driverDeleteShare, driverSetShareStatus, driverGetShareStatus, driverFindNoteByShareId, driverClaimBurnShare } from './storage_driver.mjs'
import { summarizeHistoryContent } from './note_history_presenter.js'
import {
    AGENT_SKILL_MARKDOWN,
    AUTH_MD_MARKDOWN,
    API_DOCS_MARKDOWN,
    applyDiscoveryHeaders,
    buildMarkdownDocument,
    buildAgentSkillsIndex,
    buildApiCatalog,
    buildOpenApiDocument,
    buildLlmsTxt,
    buildLlmsFullTxt,
    buildRobotsTxt,
    buildSitemapXml,
    createMarkdownResponse,
    createDiscoveryResponse,
    getDiscoveryConstants,
    requestAcceptsMarkdown,
} from './discovery.mjs'
import {
    getNoteHistoryConfig,
    getNoteHistoryCounts,
    getNoteHistoryVersionById,
    listNoteHistoryVersions,
    saveNoteHistoryVersionIfNeeded,
} from './note_history.mjs'
import { filterAdminNotes, normalizeAdminQuery, paginateAdminNotes, sortAdminNotes, summarizeAdminNotes } from './admin_data.mjs'
import { canPersistNoteContent, getSaveBlockedMessage } from './save_policy.mjs'
import {
    parseVttTimestamp,
    formatSecondsToTimestamp,
    parseVttToSegments,
    normalizeTranscriptionSegments,
    formatTranscriptSegments,
} from './audio_transcribe.mjs'
import { renderMarkdownToPdf, renderHtmlToPdf, createPdfResponse } from './pdf_service.mjs'
import { getNoteStatsDb, getNoteViewCount, hashViewDeviceId, recordUniqueNoteView, resolveViewDeviceId, shouldCountShareView } from './note_stats.mjs'
import {
    addAnnotationMessage,
    computeSourceRevision,
    createAnnotationDeleteToken,
    createAnnotationThread,
    decodeAnnotationCursor,
    deleteAnnotationMessage,
    deleteAnnotationThread,
    getAnnotationDb,
    listAnnotationThreads,
    validateAnnotationDraft,
    validateAnnotationMessage,
    verifyAnnotationDeleteToken,
} from './annotation_data.mjs'
import {
    AI_FORMAT_SYSTEM_PROMPT,
    AUDIO_SMART_FORMAT_SYSTEM_PROMPT,
    buildAudioSmartFormatPrompt,
    buildAiUserPrompt,
    buildTranslationSystemPrompt,
    normalizeTranslationTargetLanguage,
    preservesFormatLanguage,
} from './ai_assistant_policy.mjs'

// init
const router = Router()
const getNotesNamespace = () => globalThis.NOTES
const getShareNamespace = () => globalThis.SHARE
const getImagesBucket = () => globalThis.IMAGES
const SHARE_SLUG_LENGTH = 6
const OG_IMAGE_VERSION = '2026-07-14-david888-wiki'
const getOgImageUrl = origin => new URL(`/og-image.png?v=${OG_IMAGE_VERSION}`, origin).href
const {
    AGENT_SKILL_PATH,
    AGENT_SKILLS_INDEX_PATH,
    API_CATALOG_PATH,
    API_CATALOG_PROFILE,
    API_DOCS_PATH,
    AUTH_MD_PATH,
    LLMS_TXT_PATH,
    LLMS_FULL_TXT_PATH,
    API_HEALTH_PATH,
    OPENAPI_PATH,
} = getDiscoveryConstants()

const iconSvgResponse = () => new Response(NOTEPAD_ICON_SVG, {
    headers: {
        'Content-Type': 'image/svg+xml; charset=UTF-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
    }
})

const iconPngResponse = () => new Response(NOTEPAD_ICON_PNG, {
    headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
    }
})

const ogImageResponse = () => new Response(NOTEPAD_OG_IMAGE_PNG, {
    headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
    }
})

const faviconResponse = () => new Response(NOTEPAD_FAVICON_ICO, {
    headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=31536000, immutable',
    }
})

function parseBooleanValue(value) {
    if (typeof value === 'boolean') return value
    if (typeof value !== 'string') return undefined

    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false

    return undefined
}

function readStringField(value) {
    return typeof value === 'string' ? value : undefined
}

async function readMultipartTextField(value) {
    if (typeof value === 'string') return value
    if (value && typeof value.text === 'function') return await value.text()
    return undefined
}

function readApiPassword(request, bodyPassword) {
    const url = new URL(request.url)
    const queryPw = url.searchParams.get('pw')
    const authHeader = request.headers.get('Authorization')
    const headerPw = authHeader ? authHeader.replace('Bearer ', '').trim() : null
    return queryPw || headerPw || bodyPassword || null
}

function normalizeAiText(value) {
    if (typeof value !== 'string') return ''
    return value.replace(/\u0000/g, '').trim()
}

function extractAiText(payload) {
    if (!payload) return ''
    if (typeof payload === 'string') return normalizeAiText(payload)

    const directCandidates = [
        payload.response,
        payload.output_text,
        payload.text,
        payload.content,
        payload.answer,
        payload.result?.response,
        payload.result?.output_text,
        payload.result?.text,
        payload.result?.content,
        payload.choices?.[0]?.message?.content,
        payload.choices?.[0]?.text,
    ]

    for (const candidate of directCandidates) {
        if (typeof candidate === 'string') {
            const normalized = normalizeAiText(candidate)
            if (normalized) return normalized
        }

        if (Array.isArray(candidate)) {
            const joined = candidate
                .map(item => {
                    if (typeof item === 'string') return item
                    if (typeof item?.text === 'string') return item.text
                    if (typeof item?.content === 'string') return item.content
                    return ''
                })
                .filter(Boolean)
                .join('\n')
            const normalized = normalizeAiText(joined)
            if (normalized) return normalized
        }
    }

    const outputCandidates = [
        payload.output,
        payload.result?.output,
        payload.response?.output,
    ]

    for (const output of outputCandidates) {
        if (!Array.isArray(output)) continue

        const text = output
            .flatMap(item => {
                if (typeof item?.text === 'string') return [item.text]
                if (!Array.isArray(item?.content)) return []
                return item.content
                    .map(part => {
                        if (typeof part?.text === 'string') return part.text
                        if (typeof part?.output_text === 'string') return part.output_text
                        return ''
                    })
                    .filter(Boolean)
            })
            .join('\n')

        const normalized = normalizeAiText(text)
        if (normalized) return normalized
    }

    return ''
}

function resolveAiBinding(env) {
    if (env && env.AI) {
        return env.AI
    }
    const groqKey = env && env.GROQ_API_KEY
    if (groqKey) {
        return {
            async run(model, payload) {
                const groqModel = (typeof model === 'string' && model.includes('120b'))
                    ? 'openai/gpt-oss-120b'
                    : 'openai/gpt-oss-20b'
                const messages = Array.isArray(payload && payload.messages)
                    ? payload.messages
                    : (payload && payload.prompt ? [{ role: 'user', content: payload.prompt }] : [])

                const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${groqKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: groqModel,
                        messages,
                        temperature: 0.2,
                        max_tokens: (payload && (payload.max_tokens || payload.max_completion_tokens)) || 8192,
                    })
                })
                if (!res.ok) {
                    const errText = await res.text()
                    throw new Error(`Groq AI fallback failed (${res.status}): ${errText}`)
                }
                return await res.json()
            }
        }
    }
    return null
}

async function runAiWithTimeout(aiBinding, model, payload, timeoutMs = 120000) {
    let timeoutId
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`AI request timed out after ${timeoutMs}ms`))
        }, timeoutMs)
    })

    try {
        return await Promise.race([
            aiBinding.run(model, payload),
            timeoutPromise,
        ])
    } finally {
        clearTimeout(timeoutId)
    }
}

async function transcribeWithGroq(groqApiKey, audioBytes, model = 'whisper-large-v3', filename = 'audio.mp3', timeoutMs = 60000) {
    if (!groqApiKey) {
        throw new Error('Groq API key not provided')
    }

    const extMatch = (filename || '').match(/\.([a-zA-Z0-9]+)$/)
    const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3'
    const mimeTypes = {
        mp3: 'audio/mpeg',
        m4a: 'audio/m4a',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        aac: 'audio/aac',
        flac: 'audio/flac',
        webm: 'audio/webm',
        opus: 'audio/opus',
        mp4: 'video/mp4',
    }
    const mimeType = mimeTypes[ext] || 'audio/mpeg'
    const safeFilename = filename && filename.includes('.') ? filename : `audio.${ext}`

    const formData = new FormData()
    formData.append('file', new Blob([audioBytes], { type: mimeType }), safeFilename)
    formData.append('model', model)
    formData.append('response_format', 'verbose_json')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
            },
            body: formData,
            signal: controller.signal,
        })

        if (!res.ok) {
            const errText = await res.text().catch(() => '')
            throw new Error(`Groq STT (${model}) failed with HTTP ${res.status}: ${errText}`)
        }

        const data = await res.json()
        if (!data || (typeof data.text !== 'string' && !Array.isArray(data.segments))) {
            throw new Error(`Groq STT (${model}) returned invalid JSON structure`)
        }
        return {
            text: (data.text || '').trim(),
            segments: Array.isArray(data.segments) ? data.segments : [],
            duration: data.duration,
        }
    } finally {
        clearTimeout(timer)
    }
}

async function generateUniqueShareSlug() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = genRandomStr(SHARE_SLUG_LENGTH)
        const existing = await driverQueryShare(candidate)
        if (!existing) return candidate
    }
    throw new Error('Failed to generate unique share slug')
}

async function getShareIdForPath(path, metadata = {}) {
    if (metadata.share !== true) return null
    return metadata.shareSlug || metadata.shareId || await MD5(path)
}

async function ensureShareMetadata(path, metadata = {}) {
    if (metadata.share !== true) return { ...metadata }
    if (metadata.shareSlug) return { ...metadata }
    if (metadata.shareId) {
        return {
            ...metadata,
            shareSlug: metadata.shareId,
        }
    }
    return {
        ...metadata,
        shareSlug: await generateUniqueShareSlug(),
    }
}

let EPHEMERAL_AUTHOR_SECRET = null
function getAuthorSecretFallback() {
    if (!EPHEMERAL_AUTHOR_SECRET) {
        EPHEMERAL_AUTHOR_SECRET = crypto.randomUUID()
    }
    return EPHEMERAL_AUTHOR_SECRET
}

async function isNoteAuthor(request, path, cookie = {}) {
    if (!path) return false
    const adminPassword = getAdminPassword()
    if (adminPassword && await verifyAdminSession(cookie, adminPassword)) {
        return true
    }
    const { valid, role } = await checkAuth(cookie, path)
    if (valid && role === 'edit') {
        return true
    }
    const secret = getSecret() || adminPassword || getAuthorSecretFallback()
    const authorCookieKey = 'cn_author_' + (await MD5(path)).substring(0, 16)
    if (cookie && cookie[authorCookieKey]) {
        try {
            const validAuthor = await jwt.verify(cookie[authorCookieKey], secret)
            if (validAuthor) {
                const payload = jwt.decode(cookie[authorCookieKey])
                if (payload?.path === path) return true
            }
        } catch {}
    }
    return false
}

async function createAuthorCookie(path) {
    const secret = getSecret() || getAdminPassword() || getAuthorSecretFallback()
    const exp = Math.floor(Date.now() / 1000) + 30 * 86400
    const token = await jwt.sign({ path, role: 'author', exp }, secret)
    const authorCookieKey = 'cn_author_' + (await MD5(path)).substring(0, 16)
    return Cookies.serialize(authorCookieKey, token, {
        path: '/',
        maxAge: 30 * 86400,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
    })
}

async function syncShareMappings(path, metadata = {}, previousMetadata = {}) {
    const legacyShareId = await MD5(path)

    if (metadata.share === true) {
        const options = metadata.shareExpiresAt ? { expiration: metadata.shareExpiresAt } : undefined
        if (options) {
            if (legacyShareId) await driverPutShare(legacyShareId, path, options)
            if (metadata.shareSlug) {
                await driverPutShare(metadata.shareSlug, path, options)
            }
            if (metadata.shareId && metadata.shareId !== metadata.shareSlug) {
                await driverPutShare(metadata.shareId, path, options)
            }
            await driverPutShare(path, path, options)
        } else {
            if (legacyShareId) await driverPutShare(legacyShareId, path)
            if (metadata.shareSlug) {
                await driverPutShare(metadata.shareSlug, path)
            }
            if (metadata.shareId && metadata.shareId !== metadata.shareSlug) {
                await driverPutShare(metadata.shareId, path)
            }
            // Also map direct note path as share alias
            await driverPutShare(path, path)
        }
    } else {
        if (legacyShareId) await driverDeleteShare(legacyShareId)
        if (previousMetadata.shareSlug) {
            await driverDeleteShare(previousMetadata.shareSlug)
        }
        if (previousMetadata.shareId) {
            await driverDeleteShare(previousMetadata.shareId)
        }
        if (metadata.shareSlug && metadata.shareSlug !== previousMetadata.shareSlug) {
            await driverDeleteShare(metadata.shareSlug)
        }
        if (metadata.shareId && metadata.shareId !== previousMetadata.shareId) {
            await driverDeleteShare(metadata.shareId)
        }
        await driverDeleteShare(path)
    }
}

function formatSitemapLastmod(updateAt) {
    const unixSeconds = Number(updateAt)
    if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return undefined
    return dayjs.unix(unixSeconds).format('YYYY-MM-DD')
}

async function buildSitemapEntries(origin) {
    const keys = []
    let cursor

    do {
        const page = await getNotesNamespace().list(cursor ? { cursor } : undefined)
        keys.push(...page.keys)
        cursor = page.list_complete ? undefined : page.cursor
    } while (cursor)

    const publicKeys = keys.filter(note =>
        note?.metadata?.share === true && note?.metadata?.publicIndex === true
    )

    return Promise.all(publicKeys.map(async note => ({
        loc: `${origin}/share/${await getShareIdForPath(note.name, note.metadata || {})}`,
        lastmod: formatSitemapLastmod(note.metadata?.updateAt),
    })))
}

async function requireApiEditAccess(request, metadata, bodyPassword) {
    if (!metadata?.pw && !metadata?.vpw) {
        return { ok: true }
    }

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const { valid, role } = await checkAuth(cookie, request.params?.path)
    if (valid && role === 'edit') {
        return { ok: true }
    }

    const providedPw = readApiPassword(request, bodyPassword)
    if (!providedPw) {
        return { ok: false, response: returnJSON(401, 'Unauthorized: Password required to edit', { status: 401 }) }
    }

    if ((await getPasswordRole(providedPw, metadata)) !== 'edit') {
        return { ok: false, response: returnJSON(403, 'Forbidden: Incorrect edit password', { status: 403 }) }
    }

    return { ok: true }
}

async function persistNoteContent({
    path,
    content,
    metadata,
    previousContent,
}) {
    await driverPutNote(path, content, metadata)

    const historyConfig = getNoteHistoryConfig()
    if (!historyConfig.enabled || !historyConfig.db) {
        return
    }

    try {
        await saveNoteHistoryVersionIfNeeded({
            db: historyConfig.db,
            enabled: historyConfig.enabled,
            limit: historyConfig.limit,
            minIntervalSeconds: historyConfig.minIntervalSeconds,
            path,
            previousContent,
            nextContent: content,
            nowSeconds: dayjs().unix(),
        })
    } catch (error) {
        console.error(`Note history save failed for ${path}:`, error)
    }
}

function getBlockPageExt(value, metadata = {}) {
    const editorFormat = resolveEditorFormat(metadata, value)
    if (editorFormat === 'block') {
        return { editorFormat, blockHtml: renderBlockToHtml(value), blockMarkdown: blockToMarkdown(value) }
    }
    if (editorFormat === 'canvas') {
        return { editorFormat, canvasMarkdown: canvasToMarkdown(parseCanvasDocument(value)) }
    }
    if (editorFormat === 'whiteboard') {
        return { editorFormat, whiteboardMarkdown: whiteboardToMarkdown(parseWhiteboardDocument(value)) }
    }
    return { editorFormat }
}

function getMarkdownExportContent(value, metadata = {}) {
    const format = resolveEditorFormat(metadata, value)
    if (format === 'block') return blockToMarkdown(value)
    if (format === 'canvas') return canvasToMarkdown(parseCanvasDocument(value))
    if (format === 'whiteboard') return whiteboardToMarkdown(parseWhiteboardDocument(value))
    return value
}

async function backupCurrentNoteBeforeRestore({
    path,
    currentContent,
    restoredContent,
}) {
    const historyConfig = getNoteHistoryConfig()
    if (!historyConfig.enabled || !historyConfig.db) {
        return
    }

    await saveNoteHistoryVersionIfNeeded({
        db: historyConfig.db,
        enabled: historyConfig.enabled,
        limit: historyConfig.limit,
        minIntervalSeconds: historyConfig.minIntervalSeconds,
        path,
        previousContent: currentContent,
        nextContent: restoredContent,
        nowSeconds: dayjs().unix(),
        force: true,
    })
}

async function getEditorPublicationStats(path, metadata = {}) {
    if (metadata.share !== true) {
        return { versionCount: 0, viewCount: 0 }
    }

    const historyConfig = getNoteHistoryConfig()
    const historyPromise = historyConfig.enabled && historyConfig.db
        ? getNoteHistoryCounts(historyConfig.db, [path])
            .then(counts => counts.get(path) || 0)
            .catch(error => {
                console.warn(`Editor history count failed for ${path}:`, error?.message || error)
                return null
            })
        : Promise.resolve(null)
    const statsDb = getNoteStatsDb()
    const viewsPromise = statsDb
        ? getNoteViewCount(statsDb, path).catch(error => {
            console.warn(`Editor view count failed for ${path}:`, error?.message || error)
            return null
        })
        : Promise.resolve(null)
    const [versionCount, viewCount] = await Promise.all([historyPromise, viewsPromise])

    return { versionCount, viewCount }
}

const homePage = request => {
    const originUrl = new URL(request.url)
    const canonicalUrl = new URL('/', originUrl)
    const ogImageUrl = getOgImageUrl(originUrl)

    return returnPage('Home', {
        lang: getI18n(request),
        canonicalUrl: canonicalUrl.href,
        ogImageUrl,
    })
}

router.get('/', homePage)
router.head('/', homePage)

async function createNewNote(request, editorFormat) {
    const originUrl = new URL(request.url)
    const lang = getI18n(request)
    const shareTitle = originUrl.searchParams.get('title')
    const shareText = originUrl.searchParams.get('text')
    const shareLink = originUrl.searchParams.get('url')
    let initialContent = ''

    if (editorFormat === 'whiteboard') {
        initialContent = JSON.stringify(DEFAULT_WHITEBOARD_DOCUMENT, null, 2)
    } else if (editorFormat === 'canvas') {
        if (shareTitle || shareText || shareLink) {
            const parts = []
            if (shareTitle) parts.push(`# ${shareTitle}`)
            if (shareText) parts.push(shareText)
            if (shareLink) parts.push(shareLink)
            initialContent = JSON.stringify({
                nodes: [
                    {
                        id: 'node-1',
                        type: 'text',
                        x: 100,
                        y: 100,
                        width: 280,
                        height: 120,
                        text: parts.join('\n\n'),
                    },
                ],
                edges: [],
            }, null, 2)
        } else {
            initialContent = JSON.stringify({
                nodes: [],
                edges: [],
            }, null, 2)
        }
    } else if (shareTitle || shareText || shareLink) {
        const parts = []
        if (shareTitle) parts.push(`# ${shareTitle}`)
        if (shareText) parts.push(shareText)
        if (shareLink) parts.push(shareLink)
        initialContent = parts.join('\n\n')
    }

    for (let attempt = 0; attempt < 12; attempt += 1) {
        const path = genRandomStr(getSlugLength())
        const existing = await driverQueryNote(path)
        if (existing.value || Object.keys(existing.metadata || {}).length > 0) continue

        await driverPutNote(path, initialContent, {
            editorFormat,
            theme: editorFormat === 'block' ? 'ayu-light' : (editorFormat === 'whiteboard' ? 'claude-canvas' : undefined),
            title: shareTitle || undefined,
            blockDocumentVersion: editorFormat === 'block' ? 2 : undefined
        })
        const nextUrl = new URL(`/${path}`, originUrl)
        nextUrl.searchParams.set('new', '1')
        return Response.redirect(nextUrl.href, 302)
    }
    return returnJSON(503, 'Could not allocate a new note path', { status: 503 })
}

router.get('/new/whiteboard', request => createNewNote(request, 'whiteboard'))
router.get('/new/canvas', request => createNewNote(request, 'canvas'))
router.get('/new/block', request => createNewNote(request, 'block'))
router.get('/new/markdown', request => createNewNote(request, 'markdown'))
router.get('/_pwa-offline', () => createOfflinePageResponse())
router.get('/app.webmanifest', () => {
    const name = APP_NAME || 'david888 wiki'
    return new Response(JSON.stringify({
        id: '/',
        name: name,
        short_name: name,
        description: `${name} - A fast, private Markdown notepad.`,
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        background_color: '#f9f6f0',
        theme_color: '#0f172a',
        categories: ['productivity', 'utilities'],
        icons: [
            {
                src: '/notepad-icon-192.png',
                sizes: '192x192',
                type: 'image/png'
            },
            {
                src: '/notepad-icon.png',
                sizes: '512x512',
                type: 'image/png'
            }
        ],
        share_target: {
            action: '/new/markdown',
            method: 'GET',
            params: {
                title: 'title',
                text: 'text',
                url: 'url'
            }
        },
        file_handlers: [
            {
                action: '/',
                name: 'Markdown Document',
                icons: [
                    {
                        src: '/notepad-icon-192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    }
                ],
                accept: {
                    'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'],
                    'text/x-markdown': ['.md', '.markdown'],
                    'text/plain': ['.txt']
                }
            }
        ],
        shortcuts: [
            {
                name: 'New Markdown Note',
                short_name: 'New Note',
                description: 'Create a new note',
                url: '/new/markdown',
                icons: [{ src: '/notepad-icon-192.png', sizes: '192x192' }]
            },
            {
                name: 'Offline Workspace',
                short_name: 'Offline',
                description: 'Open offline workspace with local notes',
                url: '/_pwa-offline',
                icons: [{ src: '/notepad-icon-192.png', sizes: '192x192' }]
            }
        ]
    }), {
        headers: {
            'content-type': 'application/manifest+json; charset=utf-8',
            'cache-control': 'public, max-age=3600'
        }
    })
})

async function verifyAdminSession(cookie, adminPassword) {
    if (!cookie || !cookie.admin_session || !adminPassword) return false
    if (cookie.admin_session === adminPassword) return true
    try {
        const secret = getSecret() || adminPassword
        const valid = await jwt.verify(cookie.admin_session, secret)
        if (valid) {
            const payload = jwt.decode(cookie.admin_session)
            return payload?.role === 'admin'
        }
    } catch (_) {}
    return false
}

async function createAdminSessionCookie(adminPath, adminPassword) {
    const secret = getSecret() || adminPassword
    const exp = Math.floor(Date.now() / 1000) + 86400
    const token = await jwt.sign({ role: 'admin', exp }, secret)
    return Cookies.serialize('admin_session', token, {
        path: adminPath,
        expires: dayjs().add(1, 'day').toDate(),
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
    })
}

const handleAdminGet = async (request) => {
    const lang = getI18n(request)
    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const adminPath = getAdminPath()
    const adminPassword = getAdminPassword()
    const kv = getNotesNamespace()
    const fidoCredentials = await getFidoCredentials(kv)

    // Check if logged in
    if (await verifyAdminSession(cookie, adminPassword)) {
        // Logged in, list notes
        try {
            const adminData = await buildAdminData(request)
            return returnPage('Admin', { lang, adminPath, fidoCredentials, ...adminData })
        } catch (e) {
            return returnPage('Admin', { lang, adminPath, fidoCredentials, error: 'Failed to retrieve notes: ' + e.message })
        }
    }

    return returnPage('Admin', { lang, adminPath, fidoCredentials, fidoCredentialsCount: fidoCredentials.length })
}

async function listAllAdminNotes() {
    const notes = []
    let cursor

    do {
        const page = await getNotesNamespace().list(cursor ? { cursor } : undefined)
        notes.push(...(page.keys || []))
        cursor = page.list_complete ? undefined : page.cursor
    } while (cursor)

    return notes
}

async function mapWithConcurrency(items, worker, concurrency = 20) {
    const results = new Array(items.length)
    let nextIndex = 0

    async function consume() {
        while (nextIndex < items.length) {
            const index = nextIndex++
            results[index] = await worker(items[index], index)
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, consume))
    return results
}

function isValidAdminNotePath(path) {
    return typeof path === 'string'
        && path.length > 0
        && path.length <= 512
        && !path.includes('\0')
}

async function buildAdminData(request) {
    const query = normalizeAdminQuery(new URL(request.url).searchParams)
    const listedNotes = await listAllAdminNotes()
    const historyConfig = getNoteHistoryConfig()
    const versionCounts = historyConfig.enabled && historyConfig.db
        ? await getNoteHistoryCounts(historyConfig.db, listedNotes.map(note => note.name))
        : new Map()
    const needsContentScan = Boolean(query.title || query.text || query.sort === 'title')

    const records = await mapWithConcurrency(listedNotes, async note => {
        const metadata = note.metadata || {}
        let content = ''
        let title = metadata.title || ''

        if (needsContentScan) {
            try {
                content = await getNotesNamespace().get(note.name) || ''
                title = extractNoteTitle(content, title, decodeURIComponent(note.name))
            } catch (error) {
                console.warn(`Admin note read failed for ${note.name}:`, error?.message || error)
            }
        }

        return {
            path: note.name,
            title: title || decodeURIComponent(note.name),
            content,
            updatedAt: Number.isFinite(Number(metadata.updateAt)) ? Number(metadata.updateAt) : 0,
            views: Number.isFinite(Number(metadata.views)) ? Number(metadata.views) : 0,
            versionCount: versionCounts.get(note.name) || 0,
            shared: metadata.share === true,
            indexed: metadata.share === true && metadata.publicIndex === true,
            protected: Boolean(metadata.pw || metadata.vpw),
            hasEditLock: Boolean(metadata.pw),
            hasViewLock: Boolean(metadata.vpw),
        }
    })

    const filtered = filterAdminNotes(records, query)
    const sorted = sortAdminNotes(filtered, query)
    const pagination = paginateAdminNotes(sorted, query.page, query.pageSize)

    if (!needsContentScan) {
        pagination.items = await mapWithConcurrency(pagination.items, async note => {
            try {
                const content = await getNotesNamespace().get(note.path) || ''
                return {
                    ...note,
                    title: extractNoteTitle(content, note.title, decodeURIComponent(note.path)),
                }
            } catch (error) {
                return note
            }
        })
    }

    return {
        notes: pagination.items,
        stats: summarizeAdminNotes(records),
        pagination: {
            ...pagination,
            filteredItems: filtered.length,
        },
        filters: query,
        historyEnabled: Boolean(historyConfig.enabled && historyConfig.db),
        contentScanned: needsContentScan,
    }
}

const handleAdminPost = async (request) => {
    const lang = getI18n(request)
    const adminPath = getAdminPath()
    const adminPassword = getAdminPassword()
    try {
        const cookie = Cookies.parse(request.headers.get('Cookie') || '')

        // Check if it's JSON request (batch delete)
            const contentType = request.headers.get('Content-Type') || '';
            if (contentType.includes('application/json')) {
                if (await verifyAdminSession(cookie, adminPassword)) {
                    const body = await request.json();
                    const { action, paths } = body;

                    if (action === 'batch-delete' && (!Array.isArray(paths) || paths.length > 100 || paths.some(path => !isValidAdminNotePath(path)))) {
                        return new Response(JSON.stringify({ success: false, message: 'Invalid note selection' }), {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' },
                        })
                    }

                    if (action === 'batch-delete' && Array.isArray(paths)) {
                    try {
                        // Delete all selected notes
                        await Promise.all(paths.map(async (path) => {
                            const { metadata } = await queryNote(path)
                            await driverDeleteNote(path)
                            await syncShareMappings(path, { share: false }, metadata || {})
                            await deleteNoteHistoryForPath(path)
                        }))

                        return new Response(JSON.stringify({ success: true }), {
                            headers: { 'Content-Type': 'application/json' }
                        })
                    } catch (e) {
                        return new Response(JSON.stringify({ success: false, message: e.message }), {
                            headers: { 'Content-Type': 'application/json' }
                        })
                    }
                }

                // Delete all empty pages
                if (action === 'delete-empty') {
                    try {
                        const result = await deleteEmptyPages()
                        return new Response(JSON.stringify({
                            success: true,
                            deleted: result.deleted,
                            errors: result.errors
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        })
                    } catch (e) {
                        return new Response(JSON.stringify({ success: false, message: e.message }), {
                            headers: { 'Content-Type': 'application/json' }
                        })
                    }
                }
            }
            return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), {
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Original formData logic
        const formData = await request.formData()
        const password = formData.get('password')
        const action = formData.get('action')

        // Login Logic
        if (password === adminPassword && adminPassword) {
            return new Response(null, {
                status: 302,
                headers: {
                    'Location': adminPath,
                    'Set-Cookie': await createAdminSessionCookie(adminPath, adminPassword)
                }
            })
        }

        // Action Logic (Delete)
        // Check session for actions
        if (await verifyAdminSession(cookie, adminPassword)) {
            if (action === 'delete') {
                const path = formData.get('path')
                if (isValidAdminNotePath(path)) {
                    const { metadata } = await queryNote(path)
                    await driverDeleteNote(path)
                    await syncShareMappings(path, { share: false }, metadata || {})
                    await deleteNoteHistoryForPath(path)
                } else {
                    return returnPage('Admin', { lang, adminPath, error: 'Invalid note path' })
                }
                return Response.redirect(new URL(adminPath, request.url).href, 302)
            }

            // Handle delete-empty action
            if (action === 'delete-empty') {
                const result = await deleteEmptyPages()
                // Redirect back to admin page (the page will reload and show updated list)
                return Response.redirect(new URL(adminPath, request.url).href, 302)
            }
        }

    } catch (e) {
        console.error('Admin Error:', e)
        return returnPage('Admin', { lang, error: `Exception: ${e.message}` })
    }

    return returnPage('Admin', { lang, error: 'Authentication Failed. Please check your credentials.' })
}

const handleAdminFido = async (request, adminPath) => {
    try {
        const url = new URL(request.url)
        const subPath = url.pathname.slice(adminPath.length)
        const adminPassword = getAdminPassword()
        const cookie = Cookies.parse(request.headers.get('Cookie') || '')
        const isAuthed = await verifyAdminSession(cookie, adminPassword)
        const kv = getNotesNamespace()

        if (subPath === '/fido/login-challenge' && request.method === 'POST') {
            const credentials = await getFidoCredentials(kv)
            if (!credentials.length) {
                return new Response(JSON.stringify({
                    success: false,
                    message: '尚未綁定任何 Touch ID / FIDO 裝置，請先使用密碼登入後至後台綁定。'
                }), { headers: { 'Content-Type': 'application/json' }, status: 400 })
            }
            const challenge = generateChallenge()
            await storeFidoChallenge(kv, challenge, 'login', 120)
            return new Response(JSON.stringify({
                success: true,
                challenge,
                rpId: url.hostname,
                allowCredentials: credentials.map(c => ({ id: c.id, type: 'public-key' })),
            }), { headers: { 'Content-Type': 'application/json' } })
        }

        if (subPath === '/fido/login' && request.method === 'POST') {
            try {
                const body = await request.json()
                const { id, authenticatorData, clientDataJSON, signature } = body || {}
                if (!id || !authenticatorData || !clientDataJSON || !signature) {
                    return new Response(JSON.stringify({ success: false, message: '無效的 FIDO 認證資料' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
                }

                const clientData = JSON.parse(new TextDecoder('utf-8').decode(base64UrlToBytes(clientDataJSON)))
                const challengeValid = await verifyAndConsumeFidoChallenge(kv, clientData.challenge, 'login')
                if (!challengeValid) {
                    return new Response(JSON.stringify({ success: false, message: 'Challenge 驗證失敗或已逾期，請重試' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
                }

                const credentials = await getFidoCredentials(kv)
                const matchedCred = credentials.find(c => c.id === id)
                if (!matchedCred) {
                    return new Response(JSON.stringify({ success: false, message: '未找到此裝置的註冊紀錄' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
                }

                await verifyFidoAssertion({
                    publicKeyRawBase64: matchedCred.publicKeyRaw,
                    authenticatorDataBase64: authenticatorData,
                    clientDataJsonBase64: clientDataJSON,
                    signatureBase64: signature,
                    expectedChallenge: clientData.challenge,
                    expectedOrigin: url.origin,
                    expectedRpId: url.hostname,
                })

                // Login successful! Set cookie
                return new Response(JSON.stringify({ success: true, redirect: adminPath }), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Set-Cookie': await createAdminSessionCookie(adminPath, adminPassword)
                    }
                })
            } catch (err) {
                return new Response(JSON.stringify({ success: false, message: err?.message || '指紋認證失敗' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
            }
        }

        // Following endpoints require admin session
        if (!isAuthed) {
            return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
        }

        if (subPath === '/fido/register-challenge' && request.method === 'POST') {
            const challenge = generateChallenge()
            await storeFidoChallenge(kv, challenge, 'register', 120)
            const appName = (typeof globalThis.SCN_APP_NAME !== 'undefined' ? globalThis.SCN_APP_NAME : APP_NAME) || 'David888 Wiki Admin'
            return new Response(JSON.stringify({
                success: true,
                challenge,
                rp: {
                    name: appName,
                    id: url.hostname,
                },
                user: {
                    id: bytesToBase64Url(new TextEncoder().encode('admin')),
                    name: 'admin',
                    displayName: 'Administrator',
                },
            }), { headers: { 'Content-Type': 'application/json' } })
        }

        if (subPath === '/fido/register' && request.method === 'POST') {
            try {
                const body = await request.json()
                const { credential, name } = body || {}
                if (!credential || !credential.id) {
                    return new Response(JSON.stringify({ success: false, message: '缺少憑證資訊' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
                }

                let publicKeyRaw = credential.publicKeyRaw
                if (!publicKeyRaw && credential.response?.attestationObject) {
                    const attestationBytes = base64UrlToBytes(credential.response.attestationObject)
                    const parsed = parseAttestationObject(attestationBytes)
                    publicKeyRaw = parsed.publicKeyRaw
                }

                if (!publicKeyRaw) {
                    return new Response(JSON.stringify({ success: false, message: '無法解析公鑰資訊' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
                }

                if (credential.response?.clientDataJSON) {
                    const clientData = JSON.parse(new TextDecoder('utf-8').decode(base64UrlToBytes(credential.response.clientDataJSON)))
                    await verifyAndConsumeFidoChallenge(kv, clientData.challenge, 'register')
                }

                const updatedList = await saveFidoCredential(kv, {
                    id: credential.id,
                    publicKeyRaw,
                    name: name || 'Touch ID 裝置',
                    createdAt: Date.now(),
                })

                return new Response(JSON.stringify({ success: true, message: '裝置綁定成功！', credentials: updatedList }), { headers: { 'Content-Type': 'application/json' } })
            } catch (err) {
                return new Response(JSON.stringify({ success: false, message: err?.message || '註冊失敗' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
            }
        }

        if (subPath === '/fido/credentials' && request.method === 'GET') {
            const list = await getFidoCredentials(kv)
            return new Response(JSON.stringify({ success: true, credentials: list.map(c => ({ id: c.id, name: c.name, createdAt: c.createdAt })) }), { headers: { 'Content-Type': 'application/json' } })
        }

        if (subPath === '/fido/credentials/delete' && request.method === 'POST') {
            const { credentialId } = await request.json()
            const updatedList = await deleteFidoCredential(kv, credentialId)
            return new Response(JSON.stringify({ success: true, credentials: updatedList.map(c => ({ id: c.id, name: c.name, createdAt: c.createdAt })) }), { headers: { 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({ success: false, message: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    } catch (e) {
        console.error('FIDO Backend Error:', e)
        return new Response(JSON.stringify({ success: false, message: '伺服器內部錯誤：' + e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
}

const ALLOWED_IMAGE_MIME_MAP = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
}

router.post('/upload', async (request) => {
    if (!getEnableR2()) return returnJSON(403, 'R2 Upload Disabled')

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const { valid, role } = await checkAuth(cookie, '')

    let turnstileSetCookie = null
    if (isTurnstileEnabled() && !(valid && role === 'edit')) {
        const formDataClone = await request.clone().formData().catch(() => null)
        const bodyToken = formDataClone?.get('cf-turnstile-response') || null
        const bodyFallback = formDataClone?.get('cf_turnstile_fallback') === '1'
        const turnstileCheck = await verifyTurnstileAccess(request, bodyToken, { fallback: bodyFallback })
        if (!turnstileCheck.ok) {
            return returnJSON(403, 'Turnstile verification required', {
                status: 403,
                needTurnstile: true,
                reason: turnstileCheck.reason,
            })
        }
        if (turnstileCheck.setCookieHeader) {
            turnstileSetCookie = turnstileCheck.setCookieHeader
        }
    }

    try {
        const formData = await request.formData()
        const image = formData.get('image')
        if (!image) return returnJSON(400, 'No image found')

        const rawType = String(image.type || '').split(';')[0].trim().toLowerCase()
        const ext = ALLOWED_IMAGE_MIME_MAP[rawType]
        if (!ext) {
            return returnJSON(400, 'Invalid or unsupported image MIME type')
        }

        if (image.size && image.size > 10 * 1024 * 1024) {
            return returnJSON(413, 'File size exceeds 10MB limit')
        }

        const filename = `${dayjs().format('YYYY/MM')}/${genRandomStr(16)}.${ext}`

        await getImagesBucket().put(filename, image, {
            httpMetadata: { contentType: rawType }
        })
        const url = getR2Domain() ? `${getR2Domain()}/${filename}` : `/img/${filename}`

        const responseHeaders = turnstileSetCookie ? { 'Set-Cookie': turnstileSetCookie } : {}
        return returnJSON(0, url, responseHeaders)
    } catch (e) {
        return returnJSON(500, e.message)
    }
})

// URL to Markdown Conversion (Primary: 2md.aiurl.tw, Backup 1: 2md.glsoft.ai, Backup 2: create360.ai)
async function processUrlToMarkdown(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') {
        return returnJSON(400, '請提供有效的 URL 網址')
    }
    let cleanUrl = targetUrl.trim()
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl
    }

    try {
        new URL(cleanUrl)
    } catch (_) {
        return returnJSON(400, '網址格式無效')
    }

    const services = [
        { name: '2md.aiurl.tw', url: `https://2md.aiurl.tw/${cleanUrl}` },
        { name: '2md.glsoft.ai', url: `https://2md.glsoft.ai/${cleanUrl}` },
        { name: 'create360.ai', url: `https://create360.ai/${cleanUrl}` }
    ]

    const fetchFromService = async (serviceUrl, timeoutMs = 6000) => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), timeoutMs)
        try {
            const res = await fetch(serviceUrl, {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'User-Agent': 'Mozilla/5.0 (CF-Notepad-Bot)'
                },
                signal: controller.signal
            })
            clearTimeout(timeout)
            if (!res.ok) return null

            const contentType = res.headers.get('content-type') || ''
            if (contentType.includes('application/json')) {
                const data = await res.json().catch(() => null)
                if (data) {
                    const item = Array.isArray(data.data) ? data.data[0] : (data.data || data)
                    if (item && (item.content || item.markdown)) {
                        return {
                            title: item.title || '',
                            content: item.content || item.markdown || ''
                        }
                    }
                }
            }

            const rawText = await res.text().catch(() => '')
            if (rawText && rawText.trim().length > 0) {
                let title = ''
                let content = rawText

                const titleMatch = rawText.match(/^Title:\s*(.+)$/m)
                if (titleMatch && titleMatch[1]) {
                    title = titleMatch[1].trim()
                }

                if (!title) {
                    const h1Match = rawText.match(/^#\s+(.+)$/m)
                    if (h1Match && h1Match[1]) {
                        title = h1Match[1].trim()
                    }
                }

                const markdownContentIndex = rawText.indexOf('Markdown Content:')
                if (markdownContentIndex !== -1) {
                    content = rawText.substring(markdownContentIndex + 'Markdown Content:'.length).trim()
                } else {
                    content = rawText
                        .replace(/^Title:\s*.+$/m, '')
                        .replace(/^URL Source:\s*.+$/m, '')
                        .trim()
                }

                return { title, content }
            }
            return null
        } catch (e) {
            clearTimeout(timeout)
            return null
        }
    }

    let result = null
    let serviceUsed = ''

    for (const service of services) {
        result = await fetchFromService(service.url, 6000)
        if (result && result.content) {
            serviceUsed = service.name
            break
        }
    }

    if (!result || !result.content) {
        return returnJSON(502, '無法擷取網頁內容，請確認該網址是否公開可存取')
    }

    return returnJSON(0, {
        title: result.title || '',
        content: result.content,
        sourceUrl: cleanUrl,
        service: serviceUsed
    })
}

function getGroqApiKey(env = {}) {
    return env?.GROQ_API_KEY || ''
}

async function handleAudioTranscription(request, context = {}) {
    const env = context.env || globalThis
    try {
        let audioBytes = null
        let filename = 'audio.mp3'
        const contentType = (request.headers.get('content-type') || '').toLowerCase()

        if (contentType.includes('multipart/form-data')) {
            try {
                const formData = await request.formData()
                const file = formData.get('file') || formData.get('audio')
                if (!file) {
                    return returnJSON(40001, 'No audio file found in form data (use "file" or "audio")', { status: 400 })
                }
                filename = file.name || 'audio.mp3'
                const buffer = await file.arrayBuffer()
                audioBytes = new Uint8Array(buffer)
            } catch (err) {
                return returnJSON(40002, `Failed to parse form data: ${err.message}`, { status: 400 })
            }
        } else if (contentType.includes('application/json')) {
            try {
                const body = await request.json()
                if (Array.isArray(body.audio)) {
                    audioBytes = new Uint8Array(body.audio)
                } else if (typeof body.audio === 'string') {
                    const binaryStr = atob(body.audio)
                    audioBytes = new Uint8Array(binaryStr.length)
                    for (let i = 0; i < binaryStr.length; i++) {
                        audioBytes[i] = binaryStr.charCodeAt(i)
                    }
                } else {
                    return returnJSON(40003, 'Invalid JSON body: "audio" field as number array or base64 string is required', { status: 400 })
                }
                if (body.filename) filename = body.filename
            } catch (err) {
                return returnJSON(40004, `Failed to parse JSON body: ${err.message}`, { status: 400 })
            }
        } else {
            try {
                const buffer = await request.arrayBuffer()
                audioBytes = new Uint8Array(buffer)
            } catch (err) {
                return returnJSON(40005, `Failed to read audio stream: ${err.message}`, { status: 400 })
            }
        }

        if (!audioBytes || audioBytes.length === 0) {
            return returnJSON(40006, 'Audio data is empty', { status: 400 })
        }

        const MAX_AUDIO_BYTES = 25 * 1024 * 1024
        if (audioBytes.length > MAX_AUDIO_BYTES) {
            return returnJSON(40007, `Audio file is too large (${(audioBytes.length / (1024 * 1024)).toFixed(1)}MB). Max size is 25MB.`, { status: 413 })
        }

        const groqApiKey = getGroqApiKey(env)
        let rawTranscribedText = ''
        let transcribedSegments = []
        let modelUsed = ''
        let lastError = null

        // 1. Primary: Groq whisper-large-v3
        if (groqApiKey) {
            try {
                console.log('[STT] Attempting primary model: Groq whisper-large-v3...')
                const groqRes = await transcribeWithGroq(groqApiKey, audioBytes, 'whisper-large-v3', filename, 60000)
                if (groqRes && (groqRes.text || (groqRes.segments && groqRes.segments.length > 0))) {
                    rawTranscribedText = (groqRes.text || '').trim()
                    transcribedSegments = normalizeTranscriptionSegments(groqRes.segments)
                    if (!rawTranscribedText && transcribedSegments.length > 0) {
                        rawTranscribedText = transcribedSegments.map(s => s.text).join(' ')
                    }
                    modelUsed = 'groq/whisper-large-v3'
                }
            } catch (err) {
                console.warn('[STT] Primary Groq whisper-large-v3 failed:', err?.message)
                lastError = err
            }
        }

        // 2. Fallback 1: Groq whisper-large-v3-turbo
        if (!rawTranscribedText && groqApiKey) {
            try {
                console.log('[STT] Attempting fallback 1: Groq whisper-large-v3-turbo...')
                const groqRes = await transcribeWithGroq(groqApiKey, audioBytes, 'whisper-large-v3-turbo', filename, 60000)
                if (groqRes && (groqRes.text || (groqRes.segments && groqRes.segments.length > 0))) {
                    rawTranscribedText = (groqRes.text || '').trim()
                    transcribedSegments = normalizeTranscriptionSegments(groqRes.segments)
                    if (!rawTranscribedText && transcribedSegments.length > 0) {
                        rawTranscribedText = transcribedSegments.map(s => s.text).join(' ')
                    }
                    modelUsed = 'groq/whisper-large-v3-turbo'
                }
            } catch (err) {
                console.warn('[STT] Fallback 1 Groq whisper-large-v3-turbo failed:', err?.message)
                lastError = err
            }
        }

        // 3. Fallback 2: Cloudflare Workers AI (@cf/openai/whisper-large-v3-turbo, then @cf/openai/whisper)
        if (!rawTranscribedText && transcribedSegments.length === 0 && env.AI) {
            const cfModels = [
                '@cf/openai/whisper-large-v3-turbo',
                '@cf/openai/whisper'
            ]
            for (const cfModel of cfModels) {
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        console.log(`[STT] Attempting Workers AI ${cfModel} (attempt ${attempt + 1})...`)
                        const aiResponse = await runAiWithTimeout(env.AI, cfModel, { audio: audioBytes }, 45000)
                        if (aiResponse) {
                            const vttSegments = aiResponse.vtt ? parseVttToSegments(aiResponse.vtt) : []
                            const text = (aiResponse.text || '').trim()
                            if (text || vttSegments.length > 0) {
                                rawTranscribedText = text || vttSegments.map(s => s.text).join(' ')
                                transcribedSegments = normalizeTranscriptionSegments(vttSegments)
                                modelUsed = cfModel
                                break
                            }
                        }
                    } catch (err) {
                        console.warn(`[STT] Workers AI ${cfModel} failed:`, err?.message)
                        lastError = err
                        if (attempt === 0) await new Promise(r => setTimeout(r, 600))
                    }
                }
                if (rawTranscribedText || transcribedSegments.length > 0) break

                try {
                    const aiResponse = await runAiWithTimeout(env.AI, cfModel, audioBytes, 45000)
                    if (aiResponse) {
                        const vttSegments = aiResponse.vtt ? parseVttToSegments(aiResponse.vtt) : []
                        const text = (aiResponse.text || '').trim()
                        if (text || vttSegments.length > 0) {
                            rawTranscribedText = text || vttSegments.map(s => s.text).join(' ')
                            transcribedSegments = normalizeTranscriptionSegments(vttSegments)
                            modelUsed = cfModel
                            break
                        }
                    }
                } catch (errRaw) {
                    lastError = errRaw
                }
                if (rawTranscribedText || transcribedSegments.length > 0) break
            }
        }

        if (!rawTranscribedText && transcribedSegments.length === 0) {
            const errMsg = lastError ? lastError.message : 'All audio transcription providers and fallback models failed'
            console.error('[STT] All transcribe attempts failed:', errMsg)
            return returnJSON(50003, `Audio transcription failed: ${errMsg}`)
        }

        // Format timestamped transcript
        const timestampedMarkdown = formatTranscriptSegments(transcribedSegments, rawTranscribedText)
        let formattedMarkdown = timestampedMarkdown

        // Smart format is opt-in: Whisper always produces the source transcript first.
        const requestUrl = new URL(request.url)
        const smartFormatParam = requestUrl.searchParams.get('format')
        const shouldSmartFormat = smartFormatParam === 'smart' || smartFormatParam === '1' || smartFormatParam === 'true'

        if (shouldSmartFormat) {
            try {
                const aiBinding = resolveAiBinding(env)
                formattedMarkdown = await formatAudioSmartMarkdown(aiBinding, timestampedMarkdown)
            } catch (formatErr) {
                console.warn('[AI] Audio smart formatting failed, falling back to raw transcript:', formatErr?.message)
                formattedMarkdown = timestampedMarkdown
            }
        }

        return returnJSON(0, {
            text: rawTranscribedText,
            markdown: formattedMarkdown,
            segments: transcribedSegments,
            smartFormatted: shouldSmartFormat && formattedMarkdown !== timestampedMarkdown,
            wordCount: rawTranscribedText.match(/\S+/g)?.length || 0,
            modelUsed: modelUsed,
            filename: filename,
        })
    } catch (globalErr) {
        console.error('[STT] Unhandled error in handleAudioTranscription:', globalErr)
        return returnJSON(50000, `Internal transcription error: ${globalErr.message}`)
    }
}

async function formatAudioSmartMarkdown(aiBinding, rawText) {
    if (!rawText || rawText.trim().length < 30 || !aiBinding) {
        return rawText
    }

    const userPrompt = buildAudioSmartFormatPrompt(rawText)
    const messages = [
        { role: 'system', content: AUDIO_SMART_FORMAT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
    ]

    const modelsToTry = [
        '@cf/openai/gpt-oss-120b',
        '@cf/openai/gpt-oss-20b'
    ]

    for (const model of modelsToTry) {
        try {
            console.log(`[AI] Running audio smart formatting with LLM ${model}...`)
            const response = await runAiWithTimeout(aiBinding, model, {
                messages,
                max_tokens: 8192,
            }, 40000)

            const formatted = extractAiText(response)
            if (formatted && formatted.trim().length > 0) {
                return formatted.trim()
            }
        } catch (err) {
            console.warn(`[AI] LLM ${model} audio smart formatting failed:`, err?.message)
        }
    }

    return rawText
}

router.post('/api/audio/transcribe', async (request, context = {}) => handleAudioTranscription(request, context))

function isBlockedMetadataHost(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/\.$/, '')
    if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return true
    const octets = host.split('.').map(Number)
    if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false
    const [a, b] = octets
    return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168
}

function normalizeMetadataUrl(value) {
    const raw = String(value || '').trim()
    if (!raw || raw.length > 2_048) throw new Error('URL is required and must be at most 2048 characters')
    const parsed = new URL(raw)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port) {
        throw new Error('Only public HTTP(S) URLs are supported')
    }
    if (isBlockedMetadataHost(parsed.hostname)) throw new Error('Private or local hosts are not supported')
    return parsed
}

function decodeMetadataText(value) {
    return String(value || '')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim()
}

function extractOpenGraphMetadata(html, finalUrl) {
    const meta = new Map()
    for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) || []) {
        const attrs = {}
        for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)) {
            attrs[match[1].toLowerCase()] = decodeMetadataText(match[3])
        }
        const key = attrs.property || attrs.name
        if (key && attrs.content) meta.set(key.toLowerCase(), attrs.content)
    }

    const title = decodeMetadataText(meta.get('og:title') || meta.get('twitter:title') || String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    const description = decodeMetadataText(meta.get('og:description') || meta.get('twitter:description') || meta.get('description') || '')
    const imageValue = meta.get('og:image') || meta.get('twitter:image') || ''
    let image = ''
    try {
        if (imageValue) image = new URL(imageValue, finalUrl).href
    } catch {}

    let canonicalUrl = finalUrl
    const canonicalMatch = String(html || '').match(/<link\b[^>]*rel\s*=\s*["'][^"']*canonical[^"']*["'][^>]*>/i)
    const canonicalHref = canonicalMatch?.[0]?.match(/href\s*=\s*["'](.*?)["']/i)?.[1]
    try {
        if (canonicalHref) canonicalUrl = new URL(canonicalHref, finalUrl).href
    } catch {}

    return {
        title,
        description,
        image,
        siteName: decodeMetadataText(meta.get('og:site_name') || new URL(finalUrl).hostname),
        canonicalUrl,
    }
}

router.post('/api/url-meta', async request => {
    try {
        const body = await request.json()
        let currentUrl = normalizeMetadataUrl(body?.url)
        let response

        for (let attempt = 0; attempt < 4; attempt += 1) {
            response = await fetch(currentUrl.href, {
                redirect: 'manual',
                headers: {
                    Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5',
                    'User-Agent': 'Mozilla/5.0 (compatible; David888WikiPreview/1.0)',
                },
            })
            if (![301, 302, 303, 307, 308].includes(response.status)) break
            const location = response.headers.get('Location')
            if (!location) break
            currentUrl = normalizeMetadataUrl(new URL(location, currentUrl).href)
        }

        if (!response?.ok) return returnJSON(502, `Metadata request failed with HTTP ${response?.status || 0}`, { status: 502 })
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml') && !contentType.includes('text/plain')) {
            return returnJSON(415, 'Target does not provide an HTML document', { status: 415 })
        }
        const html = (await response.text()).slice(0, 1_048_576)
        return returnJSON(0, {
            url: String(body.url),
            finalUrl: currentUrl.href,
            ...extractOpenGraphMetadata(html, currentUrl.href),
        })
    } catch (error) {
        return returnJSON(422, error.message || 'Invalid metadata URL', { status: 422 })
    }
})

router.post('/api/url2md', async (request) => {
    try {
        let url = ''
        const contentType = request.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
            const body = await request.json().catch(() => ({}))
            url = body.url || ''
        } else {
            const formData = await request.formData().catch(() => null)
            url = formData ? (formData.get('url') || '') : ''
        }
        return await processUrlToMarkdown(url)
    } catch (e) {
        return returnJSON(500, e.message)
    }
})

router.get('/api/url2md', async (request) => {
    try {
        const requestUrl = new URL(request.url)
        const url = requestUrl.searchParams.get('url') || ''
        return await processUrlToMarkdown(url)
    } catch (e) {
        return returnJSON(500, e.message)
    }
})

// Markdown utility endpoints
router.post('/api/markdown/render', async (request) => {
    try {
        let markdown = ''
        let options = {}
        const contentType = (request.headers.get('content-type') || '').toLowerCase()
        if (contentType.includes('application/json')) {
            const body = await request.json().catch(() => ({}))
            markdown = body.markdown ?? body.text ?? ''
            options = {
                theme: body.theme || 'claude-canvas',
                fullHtml: body.fullHtml === true,
                title: body.title || 'Document',
            }
        } else if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
            markdown = await request.text().catch(() => '')
            const url = new URL(request.url)
            options = {
                theme: url.searchParams.get('theme') || 'claude-canvas',
                fullHtml: url.searchParams.get('fullHtml') === 'true',
                title: url.searchParams.get('title') || 'Document',
            }
        } else {
            const formData = await request.formData().catch(() => null)
            if (formData) {
                markdown = (formData.get('markdown') || formData.get('text') || '')
                options = {
                    theme: formData.get('theme') || 'claude-canvas',
                    fullHtml: formData.get('fullHtml') === 'true',
                    title: formData.get('title') || 'Document',
                }
            }
        }

        const html = renderMarkdownToHtml(markdown, options)
        return returnJSON(0, { html, theme: options.theme, fullHtml: options.fullHtml })
    } catch (e) {
        return returnJSON(500, e.message)
    }
})

router.post('/api/markdown/parse', async (request) => {
    try {
        const contentType = (request.headers.get('content-type') || '').toLowerCase()
        if (contentType.includes('application/json')) {
            const body = await request.json().catch(() => ({}))
            if (body.url) {
                return await processUrlToMarkdown(body.url)
            }
            const html = body.html || body.text || ''
            const markdown = parseHtmlToMarkdown(html)
            return returnJSON(0, { markdown })
        } else if (contentType.includes('text/html')) {
            const html = await request.text().catch(() => '')
            const markdown = parseHtmlToMarkdown(html)
            return returnJSON(0, { markdown })
        } else {
            const formData = await request.formData().catch(() => null)
            const url = formData ? formData.get('url') : ''
            if (url) {
                return await processUrlToMarkdown(url)
            }
            const html = formData ? (formData.get('html') || formData.get('text') || '') : ''
            const markdown = parseHtmlToMarkdown(html)
            return returnJSON(0, { markdown })
        }
    } catch (e) {
        return returnJSON(500, e.message)
    }
})

router.post('/api/markdown/extract', async (request) => {
    try {
        let markdown = ''
        const contentType = (request.headers.get('content-type') || '').toLowerCase()
        if (contentType.includes('application/json')) {
            const body = await request.json().catch(() => ({}))
            markdown = body.markdown ?? body.text ?? ''
        } else if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
            markdown = await request.text().catch(() => '')
        } else {
            const formData = await request.formData().catch(() => null)
            markdown = formData ? (formData.get('markdown') || formData.get('text') || '') : ''
        }

        const data = extractMarkdownData(markdown)
        return returnJSON(0, data)
    } catch (e) {
        return returnJSON(500, e.message)
    }
})

router.post('/api/markdown/lint', async (request) => {
    try {
        let markdown = ''
        const contentType = (request.headers.get('content-type') || '').toLowerCase()
        if (contentType.includes('application/json')) {
            const body = await request.json().catch(() => ({}))
            markdown = body.markdown ?? body.text ?? ''
        } else if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
            markdown = await request.text().catch(() => '')
        } else {
            const formData = await request.formData().catch(() => null)
            markdown = formData ? (formData.get('markdown') || formData.get('text') || '') : ''
        }

        const result = lintMarkdownText(markdown)
        return returnJSON(0, result)
    } catch (e) {
        return returnJSON(500, e.message)
    }
})

// Direct PDF Generation Endpoints
async function handleDirectPdfExport(request) {
    try {
        let markdown = ''
        let html = ''
        let title = 'Document'
        let size = 'a4'
        let landscape = false
        let theme = 'claude-canvas'

        const url = new URL(request.url)
        if (url.searchParams.get('title')) title = url.searchParams.get('title')
        if (url.searchParams.get('size')) size = url.searchParams.get('size')
        if (url.searchParams.get('landscape') === 'true' || url.searchParams.get('landscape') === '1') landscape = true
        if (url.searchParams.get('theme')) theme = url.searchParams.get('theme')

        const contentType = (request.headers.get('content-type') || '').toLowerCase()
        if (contentType.includes('application/json')) {
            const body = await request.json().catch(() => ({}))
            markdown = body.markdown ?? body.text ?? body.content ?? ''
            html = body.html ?? ''
            if (body.title) title = body.title
            if (body.size) size = body.size
            if (body.landscape !== undefined) landscape = Boolean(body.landscape)
            if (body.theme) theme = body.theme
        } else if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
            markdown = await request.text().catch(() => '')
        } else if (contentType.includes('text/html')) {
            html = await request.text().catch(() => '')
        } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await request.formData().catch(() => null)
            if (formData) {
                markdown = formData.get('markdown') || formData.get('text') || formData.get('content') || ''
                html = formData.get('html') || ''
                if (formData.get('title')) title = formData.get('title')
                if (formData.get('size')) size = formData.get('size')
                if (formData.get('landscape')) landscape = formData.get('landscape') === 'true'
                if (formData.get('theme')) theme = formData.get('theme')
            }
        }

        if (!markdown && !html && url.searchParams.get('text')) {
            markdown = url.searchParams.get('text')
        }

        if (!title || title === 'Document') {
            title = extractNoteTitle(markdown || html, 'Document')
        }

        const siteUrl = `${url.protocol}//${url.host}`
        const pdfBytes = html
            ? await renderHtmlToPdf(html, {
                title,
                size,
                landscape,
                theme,
                siteUrl,
            })
            : await renderMarkdownToPdf(markdown, {
                title,
                size,
                landscape,
                theme,
                siteUrl,
            })

        const filename = `${title.replace(/[\/\\:*?"<>|]/g, '_') || 'document'}.pdf`
        return createPdfResponse(pdfBytes, filename)
    } catch (e) {
        console.error('PDF Export Error:', e)
        return returnJSON(500, `PDF Generation Error: ${e.message}`)
    }
}

router.post('/api/pdf/export', async (request) => handleDirectPdfExport(request))
router.post('/api/markdown/pdf', async (request) => handleDirectPdfExport(request))
router.get('/api/pdf/export', async (request) => handleDirectPdfExport(request))

router.post('/api/new-note', async (request) => {
    try {
        const body = await request.json().catch(() => ({}))
        const content = body.content || ''
        const editorFormat = body.editorFormat || 'markdown'
        const originUrl = new URL(request.url)

        for (let attempt = 0; attempt < 12; attempt += 1) {
            const path = genRandomStr(getSlugLength())
            const existing = await driverQueryNote(path)
            if (existing.value || Object.keys(existing.metadata || {}).length > 0) continue

            await driverPutNote(path, content, {
                editorFormat,
                blockDocumentVersion: editorFormat === 'block' ? 2 : undefined
            })

            const nextUrl = new URL(`/${path}`, originUrl)
            nextUrl.searchParams.set('new', '1')
            return returnJSON(0, { path, url: nextUrl.pathname + nextUrl.search })
        }
        return returnJSON(533, 'Could not allocate a new note path')
    } catch (e) {
        return returnJSON(500, e.message)
    }
})



router.post('/share/:shareId/auth', async request => {
    const { shareId } = request.params
    const path = await driverQueryShare(shareId)

    if (!!path) {
        if (request.headers.get('Content-Type') === 'application/json') {
            const { passwd } = await request.json()
            const { metadata } = await queryNote(path)

            const role = await getPasswordRole(passwd, metadata)
            if (role) {
                const exp = Math.floor(Date.now() / 1000) + 7 * 86400
                const token = await jwt.sign({ path, role, exp }, getSecret())
                return returnJSON(0, {
                    refresh: true,
                    role,
                }, {
                    'Set-Cookie': Cookies.serialize('auth', token, {
                        path: role === 'edit' ? `/${path}` : `/share/${shareId}`,
                        expires: dayjs().add(7, 'day').toDate(),
                        httpOnly: true,
                        secure: true,
                        sameSite: 'Lax',
                    })
                })
            }
        }
        return returnJSON(10002, 'Password auth failed!')
    }
    return returnJSON(404, 'Share not found')
})

async function renderSharePage(request, presentationMode = false, execution = {}, bookMode = false, options = {}) {
    const lang = getI18n(request)
    const { shareId } = request.params
    const embedMode = new URL(request.url).searchParams.get('embed') === '1'
    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const now = Math.floor(Date.now() / 1000)
    let path = await driverQueryShare(shareId)

    // Fallback: If not found in shares mapping, check if shareId is directly a note path
    if (!path) {
        const directNote = await queryNote(shareId)
        if (directNote && (directNote.value !== null || Object.keys(directNote.metadata || {}).length > 0)) {
            if (directNote.metadata?.share === true) {
                path = shareId
                syncShareMappings(shareId, directNote.metadata).catch(() => {})
            }
        }
    }

    if (!path) {
        const tombstone = await driverGetShareStatus(shareId)
        if (tombstone?.status === 'burned') {
            return returnPage('ShareBurned', { lang, title: 'Share Destroyed', shareId, ext: tombstone }, { status: 410 })
        }
        if (tombstone?.status === 'expired') {
            return returnPage('ShareExpired', { lang, title: 'Share Expired', shareId, ext: tombstone }, { status: 410 })
        }
        const found = await driverFindNoteByShareId(shareId)
        if (found) {
            const isAuthor = await isNoteAuthor(request, found.path, cookie)
            if (found.metadata?.shareBurnedAt) {
                return returnPage('ShareBurned', { lang, title: 'Share Destroyed', shareId, path: found.path, ext: { ...(found.metadata || {}), isAuthor } }, { status: 410 })
            }
            if (found.metadata?.shareExpiresAt && found.metadata.shareExpiresAt <= now) {
                return returnPage('ShareExpired', { lang, title: 'Share Expired', shareId, path: found.path, ext: { ...(found.metadata || {}), isAuthor } }, { status: 410 })
            }
        }
        return returnPage('Page404', { lang, title: '404' })
    }

    const sharePath = `/share/${shareId}`
    const presentationPath = `${sharePath}/present`
    const bookPath = `${sharePath}/book`
    const authPath = `${sharePath}/auth`
    const gaMeasurementId = getGaMeasurementId()

    const { value, metadata } = await queryNote(path)
    const origin = new URL(request.url).origin
    const isAuthor = await isNoteAuthor(request, path, cookie)

    if (metadata.share !== true) {
        if (metadata.shareBurnedAt) {
            return returnPage('ShareBurned', { lang, title: 'Share Destroyed', shareId, path, ext: { ...metadata, isAuthor } }, { status: 410 })
        }
        if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
            return returnPage('ShareExpired', { lang, title: 'Share Expired', shareId, path, ext: { ...metadata, isAuthor } }, { status: 410 })
        }
        return returnPage('Page404', { lang, title: '404' })
    }

    // Check expiration
    if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
        metadata.share = false
        metadata.shareExpiredAt = now
        await syncShareMappings(path, { share: false }, metadata)
        await driverPutNote(path, value, metadata)
        await driverSetShareStatus(shareId, 'expired', { expiredAt: now, path })
        return returnPage('ShareExpired', { lang, title: 'Share Expired', shareId, path, ext: { ...metadata, isAuthor } }, { status: 410 })
    }

    // Check if View Password is set
    if (metadata.vpw) {
        const { valid } = await checkAuth(cookie, path)

        if (!valid) {
            return returnPage('NeedPasswd', {
                lang,
                title: 'Password Protected',
                shareId,
                path,
                ext: {
                    authPath,
                    sharePath,
                    presentationPath,
                    gaMeasurementId,
                    webtalk: getWebtalkConfig(),
                    presentationEntry: presentationMode,
                    autoPresent: false,
                },
            })
        }
    }

    // Check timelock
    if (isShareTimeLocked(metadata, now)) {
        if (!isAuthor) {
            if (requestAcceptsMarkdown(request)) {
                return new Response('This note is time-locked and cannot be viewed yet.', { status: 423 })
            }
            return returnPage('ShareTimeLocked', { lang, title: 'Time-Locked Note', shareId, path, ext: { ...metadata, isAuthor } }, { status: 423 })
        }
    }

    // Check dead man's switch
    let deadmanReleased = false
    if (metadata.shareMode === 'deadman') {
        if (isAuthor) {
            // Author visits: auto-pulse check-in
            const pulseInterval = metadata.sharePulseInterval || 7 * 86400
            metadata.sharePulseDueAt = now + pulseInterval
            metadata.shareLastPulseAt = now
            await driverPutNote(path, value, metadata)
        } else {
            if (metadata.sharePulseDueAt && metadata.sharePulseDueAt > now) {
                // Author active: sealed
                if (requestAcceptsMarkdown(request)) {
                    return new Response("Dead Man's Switch is active. Vault is sealed until check-in expires.", { status: 423 })
                }
                return returnPage('ShareDeadmanLocked', { lang, title: "Dead Man's Switch Active", shareId, path, ext: { ...metadata, isAuthor } }, { status: 423 })
            } else {
                deadmanReleased = true
            }
        }
    }

    let burnUnlocked = options?.burnUnlocked === true
    let burnActiveNotice = false

    if (metadata.shareBurnAfterReading === true && !isAuthor) {
        if (burnUnlocked) {
            const claimed = await driverClaimBurnShare(shareId, path, now)
            if (!claimed) {
                return returnPage('ShareBurned', { lang, title: 'Share Destroyed', shareId, path, ext: { ...metadata, isAuthor: false } }, { status: 410 })
            }
            metadata.share = false
            metadata.shareBurnedAt = now
            await syncShareMappings(path, { share: false }, metadata)
            burnActiveNotice = true
        }
    }

    const title = extractNoteTitle(value, metadata?.title, decodeURIComponent(path))
    const description = extractNoteDescription(value, title)
    const blockPageExt = getBlockPageExt(value, metadata)
    const markdownExportContent = getMarkdownExportContent(value, metadata)
    const canonicalPath = presentationMode ? presentationPath : sharePath
    const canonicalUrl = `${origin}${canonicalPath}`

    const acceptsMarkdown = requestAcceptsMarkdown(request)
    if (acceptsMarkdown) {
        if (isShareTimeLocked(metadata, now) && !isAuthor) {
            return new Response('This note is time-locked and cannot be viewed yet.', { status: 423 })
        }
        if (metadata.shareMode === 'deadman' && metadata.sharePulseDueAt && metadata.sharePulseDueAt > now && !isAuthor) {
            return new Response("Dead Man's Switch is active. Vault is sealed until check-in expires.", { status: 423 })
        }
        if (metadata.shareBurnAfterReading === true && !isAuthor && !burnUnlocked) {
            return new Response('Burn-after-reading share requires user confirmation before access.', { status: 403 })
        }
        return createMarkdownResponse(
            buildMarkdownDocument(markdownExportContent, {
                title,
                description,
                canonical_url: canonicalUrl,
                share_url: `${origin}${sharePath}`,
                presentation_url: presentationMode ? canonicalUrl : `${origin}${presentationPath}`,
                note_path: path,
            }),
        )
    }

    let viewCount = null
    let viewDeviceCookie = null
    const isBurnInterstitial = metadata.shareBurnAfterReading === true && !isAuthor && !burnUnlocked
    if (!isAuthor && !isBurnInterstitial && shouldCountShareView({
        method: request.method,
        presentationMode,
        embedMode,
        acceptsMarkdown,
    })) {
        const statsDb = getNoteStatsDb()
        if (statsDb) {
            try {
                const { deviceId, isNew } = resolveViewDeviceId(cookie.cn_device)
                const deviceHash = await hashViewDeviceId(deviceId)
                const recordedView = await recordUniqueNoteView(statsDb, path, deviceHash)
                viewCount = recordedView.viewCount

                if (isNew) {
                    viewDeviceCookie = Cookies.serialize('cn_device', deviceId, {
                        path: '/',
                        maxAge: 365 * 24 * 60 * 60,
                        httpOnly: true,
                        secure: true,
                        sameSite: 'lax',
                    })
                }
            } catch (error) {
                console.error('Share view count failed:', error)
                viewCount = null
            }
        }
    }

    const shareReqUrl = new URL(request.url)
    const tocParam = (shareReqUrl.searchParams.get('toc') || '').toLowerCase()
    const autoToc = tocParam === '1' || tocParam === 'true' || tocParam === 'pinned' || shareReqUrl.searchParams.has('toc')

    return returnPage('Share', {
        lang,
        title,
        content: value,
        shareId,
        ext: {
            ...metadata,
            ...blockPageExt,
            ...(metadata.pw || metadata.vpw ? { authPath } : {}),
            sharePath,
            presentationPath,
            bookPath,
            autoToc,
            gaMeasurementId,
            webtalk: getWebtalkConfig(),
            presentationEntry: presentationMode && !embedMode,
            autoPresent: presentationMode && !embedMode,
            bookMode: bookMode && !embedMode,
            autoBook: bookMode && !embedMode,
            embed: embedMode,
            viewCount,
            isAuthor,
            burnUnlocked,
            burnActiveNotice,
            deadmanReleased,
            meta: {
                canonicalUrl,
                description,
                ogImageUrl: getOgImageUrl(origin),
                ogType: 'article',
                robots: (metadata.shareBurnAfterReading || metadata.shareExpiresAt) ? 'noindex,nofollow' : 'index,follow',
                siteName: 'DAVID888 WIKI',
                twitterCard: 'summary_large_image',
            },
        },
        path,
    }, viewDeviceCookie ? { 'Set-Cookie': viewDeviceCookie } : {})
}

router.get('/share/:shareId', async (request, execution) => {
    return renderSharePage(request, false, execution)
})

router.head('/share/:shareId', async (request, execution) => {
    return renderSharePage(request, false, execution)
})

router.post('/share/:shareId/reveal', async (request, execution) => {
    return renderSharePage(request, false, execution, false, { burnUnlocked: true })
})

router.get('/share/:shareId/present', async (request, execution) => {
    return renderSharePage(request, true, execution)
})

router.head('/share/:shareId/present', async (request, execution) => {
    return renderSharePage(request, true, execution)
})

router.post('/share/:shareId/present/reveal', async (request, execution) => {
    return renderSharePage(request, true, execution, false, { burnUnlocked: true })
})

router.get('/share/:shareId/book', async (request, execution) => {
    return renderSharePage(request, false, execution, true)
})

router.head('/share/:shareId/book', async (request, execution) => {
    return renderSharePage(request, false, execution, true)
})

router.post('/share/:shareId/book/reveal', async (request, execution) => {
    return renderSharePage(request, false, execution, true, { burnUnlocked: true })
})

async function handlePulseRequest(request) {
    const lang = getI18n(request)
    const { shareId } = request.params
    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    let path = await driverQueryShare(shareId)
    if (!path) {
        const found = await driverFindNoteByShareId(shareId)
        if (found) path = found.path
    }
    if (!path) return returnJSON(404, 'Share not found', { status: 404 })

    const { value, metadata } = await queryNote(path)
    const isAuthor = await isNoteAuthor(request, path, cookie)
    const url = new URL(request.url)
    const queryToken = url.searchParams.get('token')
    const authHeader = request.headers.get('Authorization')
    const bearerToken = authHeader ? authHeader.replace('Bearer ', '').trim() : null
    const token = queryToken || bearerToken

    const tokenMatches = token && metadata.sharePulseToken && token === metadata.sharePulseToken
    if (!isAuthor && !tokenMatches) {
        return returnJSON(403, 'Permission denied: invalid pulse token or author session', { status: 403 })
    }

    const now = Math.floor(Date.now() / 1000)
    const rawInterval = metadata.sharePulseInterval
    const interval = (typeof rawInterval === 'number' && rawInterval > 0)
        ? rawInterval
        : (parseExpirationSeconds(rawInterval) || 7 * 86400)
    const nextDueAt = now + interval
    metadata.sharePulseDueAt = nextDueAt
    metadata.shareLastPulseAt = now
    if (!metadata.sharePulseToken) {
        metadata.sharePulseToken = (await MD5(path + now + 'pulse')).substring(0, 24)
    }
    await driverPutNote(path, value, metadata)
    await driverSetShareStatus(shareId, null)

    const acceptsHtml = request.headers.get('Accept')?.includes('text/html') && request.method === 'GET'
    if (acceptsHtml) {
        return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Heartbeat Confirmed</title><style>body{font-family:sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f8f7f3;color:#2c2a29;}.card{background:#fff;padding:32px;border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,0.08);text-align:center;max-width:400px;}</style></head><body><div class="card"><div style="font-size:48px;margin-bottom:12px;">💓</div><h2>${lang === 'zh-TW' ? '保活簽到成功！' : 'Heartbeat Confirmed!'}</h2><p>${lang === 'zh-TW' ? '下次心跳截止時間：' : 'Next check-in deadline:'}<br><strong>${new Date(nextDueAt * 1000).toLocaleString()}</strong></p><p><a href="/share/${encodeURIComponent(shareId)}" style="color:#c8654b;">${lang === 'zh-TW' ? '前往分享頁面' : 'View Share Page'}</a></p></div></body></html>`, {
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        })
    }

    return returnJSON(0, {
        success: true,
        message: 'Pulse check-in successful',
        pulseDueAt: nextDueAt,
        remaining: formatShareRemainingTime(nextDueAt, now, lang),
    })
}

router.get('/api/shares/:shareId/pulse', async request => handlePulseRequest(request))
router.post('/api/shares/:shareId/pulse', async request => handlePulseRequest(request))

router.post('/api/shares/:shareId/reveal', async request => {
    const { shareId } = request.params
    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const now = Math.floor(Date.now() / 1000)
    let path = await driverQueryShare(shareId)

    if (!path) {
        const tombstone = await driverGetShareStatus(shareId)
        if (tombstone?.status === 'burned') {
            return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
        }
        if (tombstone?.status === 'expired') {
            return returnJSON(410, 'Share has expired', { status: 410 })
        }
        const found = await driverFindNoteByShareId(shareId)
        if (found?.metadata?.shareBurnedAt) {
            return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
        }
        if (found?.metadata?.shareExpiresAt && found.metadata.shareExpiresAt <= now) {
            return returnJSON(410, 'Share has expired', { status: 410 })
        }
        return returnJSON(404, 'Share not found', { status: 404 })
    }

    const { value, metadata } = await queryNote(path)
    const isAuthor = await isNoteAuthor(request, path, cookie)

    if (metadata.share !== true) {
        if (metadata.shareBurnedAt) {
            return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
        }
        return returnJSON(404, 'Share not found', { status: 404 })
    }

    if (metadata.shareBurnAfterReading !== true && !isAuthor) {
        return returnJSON(400, 'Reveal endpoint is only applicable to burn-after-reading shares', { status: 400 })
    }

    if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
        metadata.share = false
        metadata.shareExpiredAt = now
        await syncShareMappings(path, { share: false }, metadata)
        await driverPutNote(path, value, metadata)
        await driverSetShareStatus(shareId, 'expired', { expiredAt: now, path })
        return returnJSON(410, 'Share has expired', { status: 410 })
    }

    if (isShareTimeLocked(metadata, now) && !isAuthor) {
        return returnJSON(423, 'Share is time-locked and cannot be viewed yet', { status: 423 })
    }
    if (metadata.shareMode === 'deadman' && metadata.sharePulseDueAt && metadata.sharePulseDueAt > now && !isAuthor) {
        return returnJSON(423, "Dead Man's Switch is active. Vault is sealed until check-in expires.", { status: 423 })
    }

    const url = new URL(request.url)
    const queryPw = url.searchParams.get('pw')
    const authHeader = request.headers.get('Authorization')
    const headerPw = authHeader ? authHeader.replace('Bearer ', '').trim() : null
    let bodyPw = null
    try {
        const body = await request.clone().json().catch(() => ({}))
        bodyPw = body?.pw || null
    } catch {}
    const providedPw = queryPw || headerPw || bodyPw

    if (metadata.vpw || metadata.pw) {
        const { valid } = await checkAuth(cookie, path)
        const hasAccess = valid || isAuthor || (providedPw && (
            (metadata.vpw && await passwordMatches(providedPw, metadata.vpw)) ||
            (metadata.pw && await passwordMatches(providedPw, metadata.pw))
        ))
        if (!hasAccess) {
            return returnJSON(401, 'Password required to reveal this note', { status: 401 })
        }
    }

    if (metadata.shareBurnAfterReading === true && !isAuthor) {
        const claimed = await driverClaimBurnShare(shareId, path, now)
        if (!claimed) {
            return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
        }
        metadata.share = false
        metadata.shareBurnedAt = now
        await syncShareMappings(path, { share: false }, metadata)
    }

    const title = extractNoteTitle(value, metadata?.title, decodeURIComponent(path))
    const blockPageExt = getBlockPageExt(value, metadata)

    return returnJSON(0, {
        path,
        title,
        content: value,
        ...blockPageExt,
        metadata: {
            ...metadata,
            shareBurned: !isAuthor && metadata.shareBurnAfterReading === true,
        },
    })
})

async function handleSharePdfExport(request) {
    try {
        const { shareId } = request.params
        const path = await driverQueryShare(shareId)
        if (!path) return returnJSON(404, 'Share not found', { status: 404 })

        const { value, metadata } = await queryNote(path)
        if (metadata.share !== true) return returnJSON(404, 'Share not found', { status: 404 })

        const now = Math.floor(Date.now() / 1000)
        if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
            return returnJSON(410, 'Share has expired', { status: 410 })
        }
        if (metadata.shareBurnedAt) {
            return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
        }

        const cookie = Cookies.parse(request.headers.get('Cookie') || '')
        const isAuthor = await isNoteAuthor(request, path, cookie)
        if (isShareTimeLocked(metadata, now) && !isAuthor) {
            return returnJSON(423, 'Share is time-locked and cannot be exported', { status: 423 })
        }
        if (metadata.shareMode === 'deadman' && metadata.sharePulseDueAt && metadata.sharePulseDueAt > now && !isAuthor) {
            return returnJSON(423, "Dead Man's Switch is active. Vault is sealed until check-in expires.", { status: 423 })
        }

        const url = new URL(request.url)

        if (metadata.vpw || metadata.pw) {
            const queryPw = url.searchParams.get('pw')
            const authHeader = request.headers.get('Authorization')
            const headerPw = authHeader ? authHeader.replace('Bearer ', '').trim() : null
            const { valid } = await checkAuth(cookie, path)

            const providedPw = queryPw || headerPw
            const hasViewAccess = valid || isAuthor || (providedPw && (
                (metadata.vpw && await passwordMatches(providedPw, metadata.vpw)) ||
                (metadata.pw && await passwordMatches(providedPw, metadata.pw))
            ))
            if (!hasViewAccess) {
                return returnJSON(401, 'Unauthorized: Share view password required', { status: 401 })
            }
        }

        if (metadata.shareBurnAfterReading === true && !isAuthor) {
            const confirm = url.searchParams.get('burn_confirm') === 'true' || url.searchParams.get('burn_confirm') === '1'
            if (!confirm) {
                return returnJSON(400, 'PDF export will permanently destroy this burn-after-reading share. Pass burn_confirm=true to confirm.', { status: 400 })
            }
            const tombstone = await driverGetShareStatus(shareId)
            if (tombstone?.status === 'burned') {
                return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
            }
        }

        let markdown = value || ''
        const format = resolveEditorFormat(metadata, value)
        if (format === 'block') {
            const doc = parseBlockDocument(value)
            markdown = blockToMarkdown(doc)
        } else if (format === 'canvas') {
            markdown = canvasToMarkdown(parseCanvasDocument(value))
        } else if (format === 'whiteboard') {
            markdown = whiteboardToMarkdown(parseWhiteboardDocument(value))
        }

        const title = extractNoteTitle(markdown, path)
        const size = url.searchParams.get('size') || 'a4'
        const landscape = url.searchParams.get('landscape') === 'true' || url.searchParams.get('landscape') === '1'
        const theme = metadata.theme || (format === 'block' ? 'ayu-light' : 'claude-canvas')
        const siteUrl = `${url.protocol}//${url.host}`

        const pdfBytes = await renderMarkdownToPdf(markdown, {
            title,
            size,
            landscape,
            theme,
            siteUrl,
        })

        // Claim and burn share only after PDF generation succeeds
        if (metadata.shareBurnAfterReading === true && !isAuthor) {
            const claimed = await driverClaimBurnShare(shareId, path, now)
            if (!claimed) {
                return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
            }
            metadata.share = false
            metadata.shareBurnedAt = now
            await syncShareMappings(path, { share: false }, metadata)
        }

        const filename = `${title.replace(/[\/\\:*?"<>|]/g, '_') || shareId}.pdf`
        return createPdfResponse(pdfBytes, filename)
    } catch (e) {
        console.error('Share PDF Export Error:', e)
        return returnJSON(500, `Share PDF Export Error: ${e.message}`)
    }
}

router.get('/share/:shareId/export/pdf', async (request) => handleSharePdfExport(request))
router.get('/share/:shareId/export.pdf', async (request) => handleSharePdfExport(request))
router.get('/api/shares/:shareId/pdf', async (request) => handleSharePdfExport(request))

router.get('/api/shares/:shareId/annotations', async request => {
    const { shareId } = request.params
    const path = await driverQueryShare(shareId)
    if (!path) return returnJSON(404, 'Share not found', { status: 404 })

    const { value, metadata } = await queryNote(path)
    if (metadata.share !== true) return returnJSON(404, 'Share not found', { status: 404 })

    const now = Math.floor(Date.now() / 1000)
    if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
        return returnJSON(410, 'Share has expired', { status: 410 })
    }
    if (metadata.shareBurnedAt) {
        return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
    }

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const isAuthor = await isNoteAuthor(request, path, cookie)
    if (isShareTimeLocked(metadata, now) && !isAuthor) {
        return returnJSON(423, 'Share is time-locked', { status: 423 })
    }
    if (metadata.shareMode === 'deadman' && metadata.sharePulseDueAt && metadata.sharePulseDueAt > now && !isAuthor) {
        return returnJSON(423, "Dead Man's Switch is active. Vault is sealed until check-in expires.", { status: 423 })
    }

    if (metadata.vpw) {
        const { valid } = await checkAuth(cookie, path)
        if (!valid) return returnJSON(401, 'Share password required', { status: 401 })
    }

    if (!resolveAnnotationsEnabled(metadata)) {
        return returnJSON(0, {
            enabled: false,
            sourceRevision: null,
            threads: [],
            nextCursor: null,
        }, { 'Cache-Control': 'no-store' })
    }

    const db = getAnnotationDb()
    if (!db) return returnJSON(503, 'Annotations are temporarily unavailable', { status: 503 })

    const url = new URL(request.url)
    const cursor = url.searchParams.get('cursor')
    if (cursor && !decodeAnnotationCursor(cursor)) {
        return returnJSON(400, 'Invalid annotation cursor', { status: 400 })
    }

    const requestedLimit = url.searchParams.get('limit')
    if (requestedLimit !== null && (!/^\d+$/.test(requestedLimit) || Number(requestedLimit) < 1)) {
        return returnJSON(400, 'Invalid annotation limit', { status: 400 })
    }

    try {
        const sourceRevision = await computeSourceRevision(value)
        const result = await listAnnotationThreads(db, path, {
            cursor,
            limit: requestedLimit,
        })
        return returnJSON(0, {
            enabled: true,
            sourceRevision,
            ...result,
        }, { 'Cache-Control': 'no-store' })
    } catch (error) {
        console.error('Annotation List Error:', error)
        return returnJSON(503, 'Annotations are temporarily unavailable', { status: 503 })
    }
})

async function getWritableAnnotationContext(request) {
    const requestOrigin = new URL(request.url).origin
    if (request.headers.get('Origin') !== requestOrigin) {
        return {
            response: returnJSON(403, 'Annotation write origin rejected', { status: 403 }),
        }
    }

    const { shareId } = request.params
    const path = await driverQueryShare(shareId)
    if (!path) {
        return {
            response: returnJSON(404, 'Share not found', { status: 404 }),
        }
    }

    const { value, metadata } = await queryNote(path)
    if (metadata.share !== true) {
        return {
            response: returnJSON(404, 'Share not found', { status: 404 }),
        }
    }

    const now = Math.floor(Date.now() / 1000)
    if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
        return {
            response: returnJSON(410, 'Share has expired', { status: 410 }),
        }
    }
    if (metadata.shareBurnedAt) {
        return {
            response: returnJSON(410, 'Share has been burned and destroyed', { status: 410 }),
        }
    }

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const isAuthor = await isNoteAuthor(request, path, cookie)
    if (isShareTimeLocked(metadata, now) && !isAuthor) {
        return {
            response: returnJSON(423, 'Share is time-locked and cannot be annotated yet', { status: 423 }),
        }
    }
    if (metadata.shareMode === 'deadman' && metadata.sharePulseDueAt && metadata.sharePulseDueAt > now && !isAuthor) {
        return {
            response: returnJSON(423, "Dead Man's Switch is active. Annotations sealed until check-in expires.", { status: 423 }),
        }
    }

    if (metadata.vpw) {
        const { valid } = await checkAuth(cookie, path)
        if (!valid) {
            return {
                response: returnJSON(401, 'Share password required', { status: 401 }),
            }
        }
    }

    if (!resolveAnnotationsEnabled(metadata)) {
        return {
            response: returnJSON(403, 'Annotations are closed', { status: 403 }),
        }
    }

    const db = getAnnotationDb()
    if (!db) {
        return {
            response: returnJSON(503, 'Annotations are temporarily unavailable', { status: 503 }),
        }
    }

    return { db, metadata, path, value }
}

async function readAnnotationJson(request) {
    const contentType = request.headers.get('Content-Type') || ''
    if (!contentType.toLowerCase().startsWith('application/json')) return null

    try {
        return await request.json()
    } catch {
        return null
    }
}

router.post('/api/shares/:shareId/annotations', async request => {
    const context = await getWritableAnnotationContext(request)
    if (context.response) return context.response

    const input = await readAnnotationJson(request)
    const draft = validateAnnotationDraft(input)
    if (!draft) return returnJSON(400, 'Invalid annotation', { status: 400 })

    const currentRevision = await computeSourceRevision(context.value)
    if (draft.anchor.sourceRevision !== currentRevision) {
        return returnJSON(409, 'Source revision changed', { status: 409 })
    }

    try {
        const secret = getSecret()
        const thread = await createAnnotationThread(context.db, context.path, draft, { secret })
        if (!thread) return returnJSON(400, 'Invalid annotation', { status: 400 })

        return returnJSON(0, { thread }, {
            status: 201,
            'Cache-Control': 'no-store',
        })
    } catch (error) {
        console.error('Annotation Create Error:', error)
        return returnJSON(503, 'Annotations are temporarily unavailable', { status: 503 })
    }
})

router.post('/api/shares/:shareId/annotations/:threadId/messages', async request => {
    const context = await getWritableAnnotationContext(request)
    if (context.response) return context.response

    const input = await readAnnotationJson(request)
    const reply = validateAnnotationMessage(input)
    if (!reply) return returnJSON(400, 'Invalid annotation reply', { status: 400 })

    try {
        const secret = getSecret()
        const message = await addAnnotationMessage(
            context.db,
            context.path,
            request.params.threadId,
            reply,
            { secret },
        )
        if (!message) return returnJSON(404, 'Annotation thread not found', { status: 404 })

        return returnJSON(0, {
            threadId: request.params.threadId,
            message,
        }, {
            status: 201,
            'Cache-Control': 'no-store',
        })
    } catch (error) {
        console.error('Annotation Reply Error:', error)
        return returnJSON(503, 'Annotations are temporarily unavailable', { status: 503 })
    }
})

router.delete('/api/shares/:shareId/annotations/:threadId/messages/:messageId', async request => {
    const context = await getWritableAnnotationContext(request)
    if (context.response) return context.response

    const { threadId, messageId } = request.params
    const secret = getSecret()

    let authorized = false
    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const { valid, role } = await checkAuth(cookie, context.path)
    if (valid && role === 'edit') {
        authorized = true
    }

    if (!authorized) {
        const tokenFromHeader = request.headers.get('X-Annotation-Delete-Token') || request.headers.get('X-Delete-Token')
        const url = new URL(request.url)
        const tokenFromQuery = url.searchParams.get('deleteToken')
        let tokenFromBody = null
        if (!tokenFromHeader && !tokenFromQuery) {
            const body = await readAnnotationJson(request)
            tokenFromBody = body?.deleteToken
        }
        const deleteToken = tokenFromHeader || tokenFromQuery || tokenFromBody
        if (deleteToken && await verifyAnnotationDeleteToken(messageId, deleteToken, secret)) {
            authorized = true
        }
    }

    if (!authorized) {
        return returnJSON(403, 'Permission denied to delete annotation', { status: 403 })
    }

    try {
        const result = await deleteAnnotationMessage(context.db, context.path, threadId, messageId)
        if (!result) return returnJSON(404, 'Annotation message not found', { status: 404 })

        return returnJSON(0, result, { 'Cache-Control': 'no-store' })
    } catch (error) {
        console.error('Annotation Delete Error:', error)
        return returnJSON(503, 'Annotations are temporarily unavailable', { status: 503 })
    }
})

router.delete('/api/shares/:shareId/annotations/:threadId', async request => {
    const context = await getWritableAnnotationContext(request)
    if (context.response) return context.response

    const { threadId } = request.params
    const secret = getSecret()

    let authorized = false
    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const { valid, role } = await checkAuth(cookie, context.path)
    if (valid && role === 'edit') {
        authorized = true
    }

    if (!authorized) {
        const tokenFromHeader = request.headers.get('X-Annotation-Delete-Token') || request.headers.get('X-Delete-Token')
        const url = new URL(request.url)
        const rootMessageId = url.searchParams.get('rootMessageId')
        const tokenFromQuery = url.searchParams.get('deleteToken')
        let tokenFromBody = null
        if (!tokenFromHeader && !tokenFromQuery) {
            const body = await readAnnotationJson(request)
            tokenFromBody = body?.deleteToken
        }
        const deleteToken = tokenFromHeader || tokenFromQuery || tokenFromBody
        if (rootMessageId && deleteToken && await verifyAnnotationDeleteToken(rootMessageId, deleteToken, secret)) {
            authorized = true
        }
    }

    if (!authorized) {
        return returnJSON(403, 'Permission denied to delete annotation thread', { status: 403 })
    }

    try {
        const result = await deleteAnnotationThread(context.db, context.path, threadId)
        if (!result) return returnJSON(404, 'Annotation thread not found', { status: 404 })

        return returnJSON(0, result, { 'Cache-Control': 'no-store' })
    } catch (error) {
        console.error('Annotation Thread Delete Error:', error)
        return returnJSON(503, 'Annotations are temporarily unavailable', { status: 503 })
    }
})

router.post('/api/shares/:shareId/ai-assistant', async (request, context = {}) => {
    const ai = resolveAiBinding(context?.env) || context?.env?.AI || globalThis.AI
    const shareKv = context?.env?.SHARE || getShareNamespace()
    const shareId = decodeURIComponent(request.params.shareId)
    let path = shareKv ? await shareKv.get(shareId) : null
    if (!path) {
        const directNote = await queryNote(shareId)
        if (directNote?.metadata?.share === true) {
            path = shareId
        }
    }
    if (!path) {
        return returnJSON(404, 'Share not found', { status: 404 })
    }
    const { metadata } = await queryNote(path)
    if (!metadata || metadata.share !== true) {
        return returnJSON(404, 'Share not found or expired', { status: 404 })
    }
    const now = Math.floor(Date.now() / 1000)
    if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
        return returnJSON(410, 'Share has expired', { status: 410 })
    }
    if (metadata.shareBurnedAt) {
        return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
    }

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const isAuthor = await isNoteAuthor(request, path, cookie)
    if (isShareTimeLocked(metadata, now) && !isAuthor) {
        return returnJSON(423, 'Share is time-locked', { status: 423 })
    }
    if (metadata.shareMode === 'deadman' && metadata.sharePulseDueAt && metadata.sharePulseDueAt > now && !isAuthor) {
        return returnJSON(423, "Dead Man's Switch is active. Vault is sealed until check-in expires.", { status: 423 })
    }

    if (metadata.vpw) {
        const { valid, role } = await checkAuth(cookie, path)
        if (!valid || (role !== 'view' && role !== 'edit')) {
            return returnJSON(10002, 'Password authentication required', { status: 401 })
        }
    }

    if (!ai) {
        return returnJSON(50001, 'Cloudflare Workers AI or Groq AI service is not configured on this Worker.', { status: 500 })
    }

    let json
    try {
        json = await request.json()
    } catch (e) {
        return returnJSON(40001, 'Invalid JSON body', { status: 400 })
    }

    const { text, mode, instruction, targetLanguage } = json
    if (!text || typeof text !== 'string') {
        return returnJSON(40002, 'Text content is required', { status: 400 })
    }

    const normalizedText = text.replace(/\u0000/g, '').trim().slice(0, 4000)
    const userInstruction = typeof instruction === 'string' ? instruction.replace(/\u0000/g, '').trim().slice(0, 500) : ''

    if (mode === 'translate') {
        const translationTargetLanguage = normalizeTranslationTargetLanguage(targetLanguage) || 'Traditional Chinese'
        const model = '@cf/openai/gpt-oss-120b'
        const messages = [
            {
                role: 'system',
                content: `You are a professional, highly accurate translator. Translate the provided text into ${translationTargetLanguage}. Output ONLY the direct translated text. Do not add explanations, conversational comments, or surrounding quotes.`
            },
            {
                role: 'user',
                content: normalizedText
            }
        ]
        try {
            const aiResponse = await runAiWithTimeout(ai, model, {
                messages,
                reasoning_effort: 'low',
                max_completion_tokens: 4096,
            }, 60000)
            const resultText = extractAiText(aiResponse)
            if (resultText) {
                return returnJSON(0, { result: resultText, mode: 'translate', modelUsed: model })
            }
            return returnJSON(50003, 'Workers AI returned an empty response')
        } catch (error) {
            console.error('Reader AI Translate Error:', error)
            return returnJSON(50003, `Translation failed: ${error.message}`)
        }
    } else if (mode === 'ask' || mode === 'explain') {
        const model = '@cf/openai/gpt-oss-120b'
        const systemPrompt = 'You are a knowledgeable, helpful, and concise AI assistant for a Wiki and knowledge base system. Answer the reader clearly in Traditional Chinese (繁體中文) based on their question and the selected text snippet. Use clean Markdown (headings, bullet points, bold text, code blocks) and format math equations using KaTeX ($...$ or $$...$$).'
        const prompt = userInstruction
            ? `【讀者提問】：\n${userInstruction}\n\n【讀者選取的內文片段】：\n"""\n${normalizedText}\n"""\n\n請直接且詳細地回答讀者的提問。`
            : `【讀者選取的內文片段】：\n"""\n${normalizedText}\n"""\n\n請為讀者詳細解釋這段內容或公式的核心意義、邏輯與背景概念。`
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ]
        try {
            const aiResponse = await runAiWithTimeout(ai, model, {
                messages,
                reasoning_effort: 'low',
                max_completion_tokens: 4096,
            }, 60000)
            const resultText = extractAiText(aiResponse)
            if (resultText) {
                return returnJSON(0, { result: resultText, mode: 'ask', modelUsed: model })
            }
            return returnJSON(50003, 'Workers AI returned an empty response')
        } catch (error) {
            console.error('Reader AI Ask Error:', error)
            return returnJSON(50003, `AI question failed: ${error.message}`)
        }
    } else {
        return returnJSON(40003, 'Unsupported mode for reader AI assistant', { status: 400 })
    }
})

router.get('/icon.svg', iconSvgResponse)
router.head('/icon.svg', iconSvgResponse)

router.get('/icon.png', iconPngResponse)
router.head('/icon.png', iconPngResponse)

router.get('/og-image.png', ogImageResponse)
router.head('/og-image.png', ogImageResponse)

router.get('/favicon.ico', faviconResponse)
router.head('/favicon.ico', faviconResponse)

router.get('/robots.txt', (request) => createDiscoveryResponse(
    buildRobotsTxt(new URL(request.url).origin),
    'text/plain; charset=UTF-8',
))

router.head('/robots.txt', (request) => createDiscoveryResponse(
    buildRobotsTxt(new URL(request.url).origin),
    'text/plain; charset=UTF-8',
))

router.get(LLMS_TXT_PATH, (request) => createDiscoveryResponse(
    buildLlmsTxt(new URL(request.url).origin),
    'text/markdown; charset=UTF-8',
))

router.head(LLMS_TXT_PATH, (request) => createDiscoveryResponse(
    buildLlmsTxt(new URL(request.url).origin),
    'text/markdown; charset=UTF-8',
))

router.get(LLMS_FULL_TXT_PATH, (request) => createDiscoveryResponse(
    buildLlmsFullTxt(new URL(request.url).origin),
    'text/markdown; charset=UTF-8',
))

router.head(LLMS_FULL_TXT_PATH, (request) => createDiscoveryResponse(
    buildLlmsFullTxt(new URL(request.url).origin),
    'text/markdown; charset=UTF-8',
))

router.get('/sitemap.xml', async (request) => {
    const origin = new URL(request.url).origin
    return createDiscoveryResponse(
        buildSitemapXml(await buildSitemapEntries(origin)),
        'application/xml; charset=UTF-8',
    )
})

router.head('/sitemap.xml', async (request) => {
    const origin = new URL(request.url).origin
    return createDiscoveryResponse(
        buildSitemapXml(await buildSitemapEntries(origin)),
        'application/xml; charset=UTF-8',
    )
})

router.get(API_CATALOG_PATH, async (request) => {
    const origin = new URL(request.url).origin
    return createDiscoveryResponse(
        JSON.stringify(buildApiCatalog(origin), null, 2),
        `application/linkset+json; charset=UTF-8; profile="${API_CATALOG_PROFILE}"`,
    )
})

router.head(API_CATALOG_PATH, async (request) => {
    const origin = new URL(request.url).origin
    return createDiscoveryResponse(
        JSON.stringify(buildApiCatalog(origin), null, 2),
        `application/linkset+json; charset=UTF-8; profile="${API_CATALOG_PROFILE}"`,
    )
})

router.get(API_DOCS_PATH, () => createDiscoveryResponse(
    API_DOCS_MARKDOWN,
    'text/markdown; charset=UTF-8',
))

router.head(API_DOCS_PATH, () => createDiscoveryResponse(
    API_DOCS_MARKDOWN,
    'text/markdown; charset=UTF-8',
))

router.get(AUTH_MD_PATH, () => createDiscoveryResponse(
    AUTH_MD_MARKDOWN,
    'text/markdown; charset=UTF-8',
))

router.head(AUTH_MD_PATH, () => createDiscoveryResponse(
    AUTH_MD_MARKDOWN,
    'text/markdown; charset=UTF-8',
))

router.get(OPENAPI_PATH, async (request) => {
    const origin = new URL(request.url).origin
    return createDiscoveryResponse(
        JSON.stringify(buildOpenApiDocument(origin), null, 2),
        'application/openapi+json; charset=UTF-8',
    )
})

router.head(OPENAPI_PATH, async (request) => {
    const origin = new URL(request.url).origin
    return createDiscoveryResponse(
        JSON.stringify(buildOpenApiDocument(origin), null, 2),
        'application/openapi+json; charset=UTF-8',
    )
})

router.get(API_HEALTH_PATH, () => createDiscoveryResponse(
    JSON.stringify({
        status: 'ok',
    }),
    'application/json; charset=UTF-8',
))

router.head(API_HEALTH_PATH, () => createDiscoveryResponse(
    JSON.stringify({
        status: 'ok',
    }),
    'application/json; charset=UTF-8',
))

// MCP (Model Context Protocol) Endpoints for WebMCP and Agent Tools
router.options('/mcp', handleMcpRequest)
router.get('/mcp', handleMcpRequest)
router.head('/mcp', handleMcpRequest)
router.post('/mcp', handleMcpRequest)

router.get(AGENT_SKILLS_INDEX_PATH, async () => createDiscoveryResponse(
    JSON.stringify(await buildAgentSkillsIndex(), null, 2),
    'application/json; charset=UTF-8',
))

router.head(AGENT_SKILLS_INDEX_PATH, async () => createDiscoveryResponse(
    JSON.stringify(await buildAgentSkillsIndex(), null, 2),
    'application/json; charset=UTF-8',
))

router.get(AGENT_SKILL_PATH, () => createDiscoveryResponse(
    AGENT_SKILL_MARKDOWN,
    'text/markdown; charset=UTF-8',
))

router.head(AGENT_SKILL_PATH, () => createDiscoveryResponse(
    AGENT_SKILL_MARKDOWN,
    'text/markdown; charset=UTF-8',
))

router.get('/.well-known/agent-skills/:asset', async (request) => {
    if (request.params.asset !== 'index.json') {
        const lang = getI18n(request)
        return returnPage('Page404', { lang, title: '404' })
    }

    return createDiscoveryResponse(
        JSON.stringify(await buildAgentSkillsIndex(), null, 2),
        'application/json; charset=UTF-8',
    )
})

router.head('/.well-known/agent-skills/:asset', async (request) => {
    if (request.params.asset !== 'index.json') {
        const lang = getI18n(request)
        return returnPage('Page404', { lang, title: '404' })
    }

    return createDiscoveryResponse(
        JSON.stringify(await buildAgentSkillsIndex(), null, 2),
        'application/json; charset=UTF-8',
    )
})

router.get('/.well-known/agent-skills/:skillName/:fileName', (request) => {
    if (request.params.skillName !== 'david888-wiki-publisher' || request.params.fileName !== 'SKILL.md') {
        const lang = getI18n(request)
        return returnPage('Page404', { lang, title: '404' })
    }

    return createDiscoveryResponse(
        AGENT_SKILL_MARKDOWN,
        'text/markdown; charset=UTF-8',
    )
})

router.head('/.well-known/agent-skills/:skillName/:fileName', (request) => {
    if (request.params.skillName !== 'david888-wiki-publisher' || request.params.fileName !== 'SKILL.md') {
        const lang = getI18n(request)
        return returnPage('Page404', { lang, title: '404' })
    }

    return createDiscoveryResponse(
        AGENT_SKILL_MARKDOWN,
        'text/markdown; charset=UTF-8',
    )
})

router.get('/api/:path/history', async (request) => {
    const { path } = request.params
    const { metadata } = await queryNote(path)
    const auth = await requireApiEditAccess(request, metadata)
    if (!auth.ok) return auth.response

    const historyConfig = getNoteHistoryConfig()
    if (!historyConfig.enabled) {
        return returnJSON(404, 'Note history is disabled')
    }
    if (!historyConfig.db) {
        return returnJSON(500, 'Note history database is not configured')
    }

    try {
        const versions = await listNoteHistoryVersions(historyConfig.db, path, historyConfig.limit)
        return returnJSON(0, {
            enabled: true,
            limit: historyConfig.limit,
            minIntervalSeconds: historyConfig.minIntervalSeconds,
            versions: versions.map(version => ({
                id: version.id,
                createdAt: Number(version.created_at || 0),
                contentLength: Number(version.content_length || 0),
                ...summarizeHistoryContent(version.content || ''),
            })),
        })
    } catch (error) {
        console.error('History List Error:', error)
        return returnJSON(500, `History List Error: ${error.message}`)
    }
})

router.get('/api/:path/history/:versionId', async (request) => {
    const { path, versionId } = request.params
    const { metadata } = await queryNote(path)
    const auth = await requireApiEditAccess(request, metadata)
    if (!auth.ok) return auth.response

    const historyConfig = getNoteHistoryConfig()
    if (!historyConfig.enabled) {
        return returnJSON(404, 'Note history is disabled')
    }
    if (!historyConfig.db) {
        return returnJSON(500, 'Note history database is not configured')
    }

    try {
        const version = await getNoteHistoryVersionById(historyConfig.db, path, Number(versionId))
        if (!version) {
            return returnJSON(404, 'History version not found')
        }

        return returnJSON(0, {
            id: version.id,
            createdAt: Number(version.created_at || 0),
            content: version.content || '',
        })
    } catch (error) {
        console.error('History Get Error:', error)
        return returnJSON(500, `History Get Error: ${error.message}`)
    }
})

router.post('/api/:path/history/:versionId/restore', async (request) => {
    const { path, versionId } = request.params
    const { value, metadata } = await queryNote(path)
    const auth = await requireApiEditAccess(request, metadata)
    if (!auth.ok) return auth.response

    const historyConfig = getNoteHistoryConfig()
    if (!historyConfig.enabled) {
        return returnJSON(404, 'Note history is disabled')
    }
    if (!historyConfig.db) {
        return returnJSON(500, 'Note history database is not configured')
    }

    try {
        const version = await getNoteHistoryVersionById(historyConfig.db, path, Number(versionId))
        if (!version) {
            return returnJSON(404, 'History version not found')
        }

        const restoredContent = version.content || ''
        await backupCurrentNoteBeforeRestore({
            path,
            currentContent: value,
            restoredContent,
        })

        const nextMetadata = {
            ...metadata,
            updateAt: dayjs().unix(),
        }

        await driverPutNote(path, restoredContent, nextMetadata)

        const fullUrl = new URL(request.url)
        const responseData = {
            msg: 'Restored successfully',
            url: `${fullUrl.protocol}//${fullUrl.host}/${path}`,
        }

        if (nextMetadata.share) {
            responseData.shareUrl = `${fullUrl.protocol}//${fullUrl.host}/share/${await getShareIdForPath(path, nextMetadata)}`
        }

        return returnJSON(0, responseData)
    } catch (error) {
        console.error('History Restore Error:', error)
        return returnJSON(500, `History Restore Error: ${error.message}`)
    }
})

router.get('/api/:path', async (request) => {
    const { path } = request.params
    const { value, metadata } = await queryNote(path)
    const url = new URL(request.url)
    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const isAuthor = await isNoteAuthor(request, path, cookie)
    const now = Math.floor(Date.now() / 1000)

    if (!isAuthor) {
        if (metadata.shareBurnedAt) {
            return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
        }
        if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
            return returnJSON(410, 'Share has expired', { status: 410 })
        }
        if (isShareTimeLocked(metadata, now)) {
            return returnJSON(423, 'Share is time-locked and cannot be viewed yet', { status: 423 })
        }
        if (metadata.shareMode === 'deadman' && metadata.sharePulseDueAt && metadata.sharePulseDueAt > now) {
            return returnJSON(423, "Dead Man's Switch is active. Vault is sealed until check-in expires.", { status: 423 })
        }
        if (metadata.shareBurnAfterReading === true) {
            return returnJSON(400, 'Burn-after-reading shares must be revealed via /share/:shareId or /api/shares/:shareId/reveal', { status: 400 })
        }
    }

    if (metadata.pw || metadata.vpw) {
        const queryPw = url.searchParams.get('pw')
        const authHeader = request.headers.get('Authorization')
        const headerPw = authHeader ? authHeader.replace('Bearer ', '').trim() : null

        const providedPw = queryPw || headerPw;
        if (!providedPw) return returnJSON(401, 'Unauthorized: Password required')

        const hasViewAccess = (metadata.vpw && await passwordMatches(providedPw, metadata.vpw)) ||
            (metadata.pw && await passwordMatches(providedPw, metadata.pw))

        if (!hasViewAccess) return returnJSON(403, 'Forbidden: Incorrect password')
    }

    if (url.searchParams.get('format') === 'json') {
        const displayMetadata = { ...metadata }
        delete displayMetadata.pw
        delete displayMetadata.vpw
        return returnJSON(0, { content: value, metadata: displayMetadata })
    }

    return new Response(value || '', {
        headers: {
            'Content-Type': ['block', 'canvas', 'whiteboard'].includes(resolveEditorFormat(metadata, value))
                ? 'application/json;charset=UTF-8'
                : 'text/markdown;charset=UTF-8',
            'Access-Control-Allow-Origin': '*'
        }
    })
})

async function handleNotePdfExport(request) {
    try {
        const { path } = request.params
        const { value, metadata } = await queryNote(path)
        if (!value && Object.keys(metadata || {}).length === 0) {
            return returnJSON(404, 'Note not found', { status: 404 })
        }

        const cookie = Cookies.parse(request.headers.get('Cookie') || '')
        const isAuthor = await isNoteAuthor(request, path, cookie)
        const now = Math.floor(Date.now() / 1000)

        if (!isAuthor) {
            if (metadata.shareBurnedAt) {
                return returnJSON(410, 'Share has been burned and destroyed', { status: 410 })
            }
            if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
                return returnJSON(410, 'Share has expired', { status: 410 })
            }
            if (isShareTimeLocked(metadata, now)) {
                return returnJSON(423, 'Share is time-locked and cannot be exported', { status: 423 })
            }
            if (metadata.shareMode === 'deadman' && metadata.sharePulseDueAt && metadata.sharePulseDueAt > now) {
                return returnJSON(423, "Dead Man's Switch is active. Vault is sealed until check-in expires.", { status: 423 })
            }
            if (metadata.shareBurnAfterReading === true) {
                return returnJSON(400, 'Burn-after-reading shares cannot be exported directly via path', { status: 400 })
            }
        }

        const url = new URL(request.url)
        if (metadata.pw || metadata.vpw) {
            const queryPw = url.searchParams.get('pw')
            const authHeader = request.headers.get('Authorization')
            const headerPw = authHeader ? authHeader.replace('Bearer ', '').trim() : null
            const { valid } = await checkAuth(cookie, path)

            const providedPw = queryPw || headerPw
            const hasViewAccess = valid || (providedPw && (
                (metadata.vpw && await passwordMatches(providedPw, metadata.vpw)) ||
                (metadata.pw && await passwordMatches(providedPw, metadata.pw))
            ))

            if (!hasViewAccess) {
                return returnJSON(401, 'Unauthorized: Password required to export PDF', { status: 401 })
            }
        }

        let markdown = value || ''
        const format = resolveEditorFormat(metadata, value)
        if (format === 'block') {
            const doc = parseBlockDocument(value)
            markdown = blockToMarkdown(doc)
        } else if (format === 'canvas') {
            markdown = canvasToMarkdown(parseCanvasDocument(value))
        } else if (format === 'whiteboard') {
            markdown = whiteboardToMarkdown(parseWhiteboardDocument(value))
        }

        const title = extractNoteTitle(markdown, path)
        const size = url.searchParams.get('size') || 'a4'
        const landscape = url.searchParams.get('landscape') === 'true' || url.searchParams.get('landscape') === '1'
        const theme = metadata.theme || (format === 'block' ? 'ayu-light' : 'claude-canvas')
        const siteUrl = `${url.protocol}//${url.host}`

        const pdfBytes = await renderMarkdownToPdf(markdown, {
            title,
            size,
            landscape,
            theme,
            siteUrl,
        })

        const filename = `${title.replace(/[\/\\:*?"<>|]/g, '_') || path}.pdf`
        return createPdfResponse(pdfBytes, filename)
    } catch (e) {
        console.error('Note PDF Export Error:', e)
        return returnJSON(500, `Note PDF Export Error: ${e.message}`)
    }
}

router.get('/:path/export/pdf', async (request) => handleNotePdfExport(request))
router.get('/api/:path/pdf', async (request) => handleNotePdfExport(request))

router.post('/api/upload', async (request) => {
    if (!getEnableR2()) return returnJSON(403, 'R2 Upload Disabled')
    try {
        const formData = await request.formData()
        const image = formData.get('image') || formData.get('file')
        if (!image) return returnJSON(400, 'No image/file found in form data')

        const rawType = String(image.type || '').split(';')[0].trim().toLowerCase()
        const ext = ALLOWED_IMAGE_MIME_MAP[rawType]
        if (!ext) {
            return returnJSON(400, 'Invalid or unsupported image MIME type')
        }

        if (image.size && image.size > 10 * 1024 * 1024) {
            return returnJSON(413, 'File size exceeds 10MB limit')
        }

        const filename = `${dayjs().format('YYYY/MM')}/${genRandomStr(16)}.${ext}`

        await getImagesBucket().put(filename, image, {
            httpMetadata: { contentType: rawType }
        })
        const url = getR2Domain() ? `${getR2Domain()}/${filename}` : `/img/${filename}`

        return returnJSON(0, url)
    } catch (e) {
        return returnJSON(500, e.message)
    }
})

router.post('/api/:path', async (request) => {
    const { path } = request.params
    const { value, metadata } = await queryNote(path)
    const url = new URL(request.url)

    let reqBody = {}
    const contentType = request.headers.get('Content-Type') || ''
    if (contentType.includes('application/json')) {
        try {
            reqBody = await request.json()
        } catch (e) {
            return returnJSON(400, 'Invalid JSON body')
        }
    } else if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
        reqBody = {
            text: await request.text(),
        }

        const append = parseBooleanValue(url.searchParams.get('append'))
        if (append !== undefined) reqBody.append = append

        const share = parseBooleanValue(url.searchParams.get('share'))
        if (share !== undefined) reqBody.share = share

        const publicValue = parseBooleanValue(url.searchParams.get('public'))
        if (publicValue !== undefined) reqBody.public = publicValue

        const publicIndex = parseBooleanValue(url.searchParams.get('publicIndex'))
        if (publicIndex !== undefined) reqBody.publicIndex = publicIndex

        const theme = url.searchParams.get('theme')
        if (theme !== null) reqBody.theme = theme

        const widthParam = url.searchParams.get('width')
        if (widthParam !== null) reqBody.width = widthParam

        const bodyPw = url.searchParams.get('pw')
        if (bodyPw !== null) reqBody.pw = bodyPw

        const vpw = url.searchParams.get('vpw')
        if (vpw !== null) reqBody.vpw = vpw
    } else if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData()
        const multipartText = await readMultipartTextField(
            formData.get('file') || formData.get('markdown') || formData.get('text')
        )

        if (multipartText === undefined) {
            return returnJSON(400, 'No markdown file/text found in form data')
        }

        reqBody = {
            text: multipartText,
        }

        const append = parseBooleanValue(readStringField(formData.get('append')))
        if (append !== undefined) reqBody.append = append

        const share = parseBooleanValue(readStringField(formData.get('share')))
        if (share !== undefined) reqBody.share = share

        const publicValue = parseBooleanValue(readStringField(formData.get('public')))
        if (publicValue !== undefined) reqBody.public = publicValue

        const publicIndex = parseBooleanValue(readStringField(formData.get('publicIndex')))
        if (publicIndex !== undefined) reqBody.publicIndex = publicIndex

        const theme = readStringField(formData.get('theme'))
        if (theme !== undefined) reqBody.theme = theme

        const widthField = readStringField(formData.get('width'))
        if (widthField !== undefined) reqBody.width = widthField

        const pwField = readStringField(formData.get('pw'))
        if (pwField !== undefined) reqBody.pw = pwField

        const vpwField = readStringField(formData.get('vpw'))
        if (vpwField !== undefined) reqBody.vpw = vpwField
    } else {
        return returnJSON(400, 'Content-Type must be application/json, text/markdown, text/plain, or multipart/form-data')
    }

    const auth = await requireApiEditAccess(request, metadata, reqBody.pw || null)
    if (!auth.ok) return auth.response

    // Support "content" as a fallback in case LLM sends the wrong json key.
    const text = typeof reqBody.text === 'string'
        ? reqBody.text
        : (typeof reqBody.content === 'string' ? reqBody.content : '')
    const append = reqBody.append === true

    const requestedEditorFormat = reqBody.editorFormat ?? url.searchParams.get('editor') ?? undefined
    let editorFormat
    try {
        editorFormat = resolveLockedEditorFormat(metadata, requestedEditorFormat)
    } catch (error) {
        const status = /immutable/.test(error.message) ? 409 : 400
        return returnJSON(status, error.message, { status })
    }

    if (editorFormat === 'block') {
        if (append) return returnJSON(400, 'Block documents do not support append', { status: 400 })
        try {
            validateBlockDocument(parseBlockDocument(text, { allowTextFallback: false }))
        } catch (error) {
            return returnJSON(422, `Invalid block document: ${error.message}`, { status: 422 })
        }
    } else if (editorFormat === 'canvas') {
        if (append) return returnJSON(400, 'Canvas documents do not support append', { status: 400 })
        try {
            validateCanvasDocument(parseCanvasDocument(text, { allowFallback: false }))
        } catch (error) {
            return returnJSON(422, `Invalid canvas document: ${error.message}`, { status: 422 })
        }
    } else if (editorFormat === 'whiteboard') {
        if (append) return returnJSON(400, 'Whiteboard documents do not support append', { status: 400 })
        try {
            validateWhiteboardDocument(parseWhiteboardDocument(text))
        } catch (error) {
            return returnJSON(422, `Invalid whiteboard document: ${error.message}`, { status: 422 })
        }
    }

    const newContent = append ? (value ? value + '\n\n' + text : text) : text

    let updateMetadata = {
        ...metadata,
        updateAt: dayjs().unix(),
    }

    updateMetadata.editorFormat = editorFormat

    if (reqBody.pw !== undefined) updateMetadata.pw = reqBody.pw ? await saltPw(reqBody.pw) : undefined
    if (reqBody.vpw !== undefined) updateMetadata.vpw = reqBody.vpw ? await saltPw(reqBody.vpw) : undefined

    if (reqBody.share !== undefined) {
        updateMetadata.share = reqBody.share === true
    } else if (reqBody.public !== undefined) {
        // Alias public to share
        updateMetadata.share = reqBody.public === true
    } else if (updateMetadata.share === undefined) {
        // Unconditionally default to sharing for notes created via API
        updateMetadata.share = true
    }

    if (reqBody.theme !== undefined) {
        updateMetadata.theme = reqBody.theme
    }

    const normalizedWidth = normalizePreviewWidth(reqBody.width, updateMetadata.width || DEFAULT_PREVIEW_WIDTH)
    if (normalizedWidth === null) return returnJSON(400, 'Invalid width: use 100%, 960px, 1200px, or 1440px')
    updateMetadata.width = normalizedWidth

    if (reqBody.publicIndex !== undefined) {
        updateMetadata.publicIndex = reqBody.publicIndex === true
    }

    const rawExpiresIn = reqBody.expires_in !== undefined ? reqBody.expires_in : reqBody.shareExpiresIn
    if (rawExpiresIn !== undefined) {
        if (rawExpiresIn === null || rawExpiresIn === 'never' || rawExpiresIn === '') {
            updateMetadata.shareExpiresIn = null
            delete updateMetadata.shareExpiresAt
            delete updateMetadata.shareExpiredAt
        } else {
            const expSec = parseExpirationSeconds(rawExpiresIn)
            if (expSec) {
                updateMetadata.shareExpiresIn = rawExpiresIn
                updateMetadata.shareExpiresAt = dayjs().unix() + expSec
                delete updateMetadata.shareExpiredAt
            } else {
                updateMetadata.shareExpiresIn = null
                delete updateMetadata.shareExpiresAt
            }
        }
    }

    const rawMode = reqBody.shareMode || reqBody.mode
    if (rawMode !== undefined) {
        updateMetadata.shareMode = rawMode
        if (rawMode === 'burn') {
            updateMetadata.shareBurnAfterReading = true
        } else {
            updateMetadata.shareBurnAfterReading = false
            delete updateMetadata.shareBurnedAt
            if (rawMode === 'standard') {
                delete updateMetadata.shareUnlockAt
                delete updateMetadata.shareUnlockIn
                delete updateMetadata.sharePulseDueAt
                delete updateMetadata.sharePulseInterval
            }
        }
    }

    const rawBurn = reqBody.burn_after_reading !== undefined ? reqBody.burn_after_reading : reqBody.shareBurnAfterReading
    if (rawBurn !== undefined) {
        updateMetadata.shareBurnAfterReading = rawBurn === true
    }

    if (rawMode === 'timelock' || reqBody.shareUnlockIn !== undefined) {
        const unlockIn = reqBody.shareUnlockIn || updateMetadata.shareUnlockIn || '1d'
        const unlockSec = parseExpirationSeconds(unlockIn) || 86400
        updateMetadata.shareUnlockIn = unlockIn
        updateMetadata.shareUnlockAt = dayjs().unix() + unlockSec
    }

    if (rawMode === 'deadman' || reqBody.sharePulseInterval !== undefined) {
        const pulseIn = reqBody.sharePulseInterval || updateMetadata.sharePulseInterval || '7d'
        const pulseSec = parseExpirationSeconds(pulseIn) || 7 * 86400
        updateMetadata.sharePulseInterval = pulseSec
        updateMetadata.sharePulseDueAt = dayjs().unix() + pulseSec
        updateMetadata.shareLastPulseAt = dayjs().unix()
        if (!updateMetadata.sharePulseToken) {
            updateMetadata.sharePulseToken = (await MD5(path + dayjs().unix() + 'pulse')).substring(0, 24)
        }
    }

    if (updateMetadata.share === true) {
        if (metadata.shareBurnedAt) {
            delete updateMetadata.shareSlug
            delete updateMetadata.shareId
        }
        delete updateMetadata.shareBurnedAt
        delete updateMetadata.shareExpiredAt
    }

    if (updateMetadata.share === true && metadata.share !== true) {
        updateMetadata.annotationsEnabled = true
    }

    if (updateMetadata.share === false) {
        updateMetadata.publicIndex = false
        updateMetadata.annotationsEnabled = false
    }
    updateMetadata = await ensureShareMetadata(path, updateMetadata)

    if (!canPersistNoteContent(updateMetadata)) {
        if (reqBody.share === false || reqBody.public === false) {
            await driverPutNote(path, newContent, updateMetadata)
            await syncShareMappings(path, updateMetadata, metadata)
            const authorCookie = await createAuthorCookie(path)
            const fullUrl = new URL(request.url)
            return returnJSON(0, {
                msg: 'Unpublished successfully',
                url: `${fullUrl.protocol}//${fullUrl.host}/${path}`,
                shareUrl: null,
            }, { 'Set-Cookie': authorCookie })
        }
        return returnJSON(10005, getSaveBlockedMessage(getI18n(request)))
    }

    try {
        await persistNoteContent({
            path,
            content: newContent,
            metadata: updateMetadata,
            previousContent: value,
        })

        await syncShareMappings(path, updateMetadata, metadata)

        const fullUrl = new URL(request.url)
        const responseData = {
            msg: 'Saved successfully',
            url: `${fullUrl.protocol}//${fullUrl.host}/${path}`
        }
        
        // Always provide the share URL if it's shared, so the LLM can give a safe link to the human
        if (updateMetadata.share) {
            const shareId = await getShareIdForPath(path, updateMetadata)
            if (shareId) {
                await driverSetShareStatus(shareId, null)
            }
            responseData.shareUrl = `${fullUrl.protocol}//${fullUrl.host}/share/${shareId}`
            if (updateMetadata.shareExpiresAt) {
                responseData.shareExpiresAt = updateMetadata.shareExpiresAt
                responseData.shareExpiresIn = updateMetadata.shareExpiresIn
            }
            if (updateMetadata.shareBurnAfterReading) {
                responseData.shareBurnAfterReading = true
            }
        }

        const authorCookie = await createAuthorCookie(path)
        return returnJSON(0, responseData, { 'Set-Cookie': authorCookie })
    } catch (error) {
        console.error('API Error:', error)
        return returnJSON(500, `API Internal Error: ${error.message}${error.stack ? '\n' + error.stack : ''}`)
    }
})

// Cloudflare bindings are populated in fetch() after this module is loaded.
// Resolve the configured admin path per request so SCN_ADMIN_PATH is not
// frozen to the local fallback during module evaluation.
router.all('*', async (request) => {
    const adminPath = getAdminPath()
    const requestPath = new URL(request.url).pathname

    if (requestPath.startsWith(adminPath + '/fido/')) {
        return handleAdminFido(request, adminPath)
    }

    if (requestPath !== adminPath) return

    if (request.method === 'GET' || request.method === 'HEAD') {
        return handleAdminGet(request)
    }

    if (request.method === 'POST') {
        return handleAdminPost(request)
    }

    return new Response('Method Not Allowed', { status: 405 })
})

router.get('/:path', async (request) => {
    const lang = getI18n(request)

    const { path } = request.params

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const { value, metadata } = await queryNote(path)
    const blockPageExt = getBlockPageExt(value, metadata)
    const markdownExportContent = getMarkdownExportContent(value, metadata)

    const newEntry = isNewNoteEntry(request.url, value, metadata)
    const title = !String(value || '').trim() && !metadata?.title
        ? formatNewNoteTitle(lang)
        : extractNoteTitle(value, metadata?.title, decodeURIComponent(path))
    const pageMetadata = newEntry ? { ...metadata, isNewEntry: true } : metadata

    // Calculate shareId and auto-heal share mappings if note is published
    let activeMetadata = metadata
    if (metadata.share === true) {
        const nextMeta = await ensureShareMetadata(path, metadata)
        if (nextMeta.shareSlug !== metadata.shareSlug) {
            activeMetadata = nextMeta
            await driverPutNote(path, value, nextMeta).catch(() => {})
        }
        await syncShareMappings(path, activeMetadata, metadata).catch(() => {})
    }
    const shareId = await getShareIdForPath(path, activeMetadata)

    const isAuthor = await isNoteAuthor(request, path, cookie)
    const now = Math.floor(Date.now() / 1000)

    if (!isAuthor && (metadata.share === true || metadata.shareMode || metadata.shareBurnAfterReading || metadata.shareBurnedAt || metadata.shareExpiresAt)) {
        if (metadata.shareBurnedAt) {
            if (requestAcceptsMarkdown(request)) {
                return new Response('Share has been burned and destroyed', { status: 410, headers: { 'content-type': 'text/plain; charset=UTF-8' } })
            }
            return returnPage('Page404', { lang, title: 'Burned', message: 'This share was configured to burn after reading and has already been destroyed.' }, { status: 410 })
        }
        if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
            if (requestAcceptsMarkdown(request)) {
                return new Response('Share has expired', { status: 410, headers: { 'content-type': 'text/plain; charset=UTF-8' } })
            }
            return returnPage('Page404', { lang, title: 'Expired', message: 'This shared note has expired and is no longer available.' }, { status: 410 })
        }
        if (isShareTimeLocked(metadata, now)) {
            if (requestAcceptsMarkdown(request)) {
                return new Response('Share is time-locked and cannot be viewed yet', { status: 423, headers: { 'content-type': 'text/plain; charset=UTF-8' } })
            }
            return returnPage('ShareTimeLocked', { lang, title: 'Time-Locked Note', shareId, path, ext: { ...pageMetadata, ...blockPageExt, isAuthor: false } }, { status: 423 })
        }
        if (metadata.shareMode === 'deadman' && metadata.sharePulseDueAt && metadata.sharePulseDueAt > now) {
            if (requestAcceptsMarkdown(request)) {
                return new Response("Dead Man's Switch is active. Vault is sealed until check-in expires.", { status: 423, headers: { 'content-type': 'text/plain; charset=UTF-8' } })
            }
            return returnPage('ShareDeadmanLocked', { lang, title: "Dead Man's Switch Active", shareId, path, ext: { ...pageMetadata, ...blockPageExt, isAuthor: false } }, { status: 423 })
        }
        if (metadata.shareBurnAfterReading === true) {
            return Response.redirect(`${new URL(request.url).origin}/share/${shareId}`, 302)
        }
    }

    const embedMode = new URL(request.url).searchParams.get('embed') === '1'

    if (!metadata.pw && !metadata.vpw) {
        if (embedMode) {
            return returnPage('Share', {
                lang,
                title,
                content: value,
                shareId,
                path,
                ext: {
                    ...pageMetadata,
                    ...blockPageExt,
                    embed: true,
                    autoBook: false,
                    autoPresent: false,
                },
            })
        }
        if (requestAcceptsMarkdown(request)) {
            return createMarkdownResponse(
                buildMarkdownDocument(markdownExportContent, {
                    title,
                    note_path: path,
                    edit_url: `${new URL(request.url).origin}/${path}`,
                    share_url: shareId ? `${new URL(request.url).origin}/share/${shareId}` : '',
                }),
            )
        }

        return returnPage('Edit', {
            lang,
            title,
            content: value,
            ext: { ...pageMetadata, ...blockPageExt, enableR2: getEnableR2(), ...await getEditorPublicationStats(path, metadata) },
            shareId,
            path,
        })
    }

    const { valid, role } = await checkAuth(cookie, path)

    if (valid && role === 'edit') {
        if (requestAcceptsMarkdown(request)) {
            return createMarkdownResponse(
                buildMarkdownDocument(markdownExportContent, {
                    title,
                    note_path: path,
                    edit_url: `${new URL(request.url).origin}/${path}`,
                    share_url: shareId ? `${new URL(request.url).origin}/share/${shareId}` : '',
                }),
            )
        }

        const authorCookie = await createAuthorCookie(path)
        return returnPage('Edit', {
            lang,
            title,
            content: value,
            ext: { ...pageMetadata, ...blockPageExt, enableR2: getEnableR2(), ...await getEditorPublicationStats(path, metadata) },
            shareId,
            path,
        }, { 'Set-Cookie': authorCookie })
    }

    if (valid && role === 'view') {
        return returnPage('Share', {
            lang,
            title,
            content: value,
            ext: { ...pageMetadata, ...blockPageExt, enableR2: getEnableR2(), authPath: `/${path}/auth` },
            shareId,
            path,
        })
    }

    if (metadata.vpw) return returnPage('NeedPasswd', { lang, title, path, ext: { authPath: `/${path}/auth` } })

    return returnPage('Share', {
        lang,
        title,
        content: value,
        ext: { ...pageMetadata, ...blockPageExt, enableR2: getEnableR2(), authPath: `/${path}/auth` },
        shareId,
        path,
    })
})

router.head('/:path', async (request) => {
    const { path } = request.params

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const { value, metadata } = await queryNote(path)
    const blockPageExt = getBlockPageExt(value, metadata)
    const markdownExportContent = getMarkdownExportContent(value, metadata)
    const lang = getI18n(request)
    const newEntry = isNewNoteEntry(request.url, value, metadata)
    const title = !String(value || '').trim() && !metadata?.title
        ? formatNewNoteTitle(lang)
        : extractNoteTitle(value, metadata?.title, decodeURIComponent(path))
    const pageMetadata = newEntry ? { ...metadata, isNewEntry: true } : metadata
    const shareId = await getShareIdForPath(path, metadata)

    const isAuthor = await isNoteAuthor(request, path, cookie)
    const now = Math.floor(Date.now() / 1000)

    if (!isAuthor && (metadata.share === true || metadata.shareMode || metadata.shareBurnAfterReading || metadata.shareBurnedAt || metadata.shareExpiresAt)) {
        if (metadata.shareBurnedAt) {
            return new Response(null, { status: 410, headers: { 'content-type': 'text/html; charset=UTF-8' } })
        }
        if (metadata.shareExpiresAt && metadata.shareExpiresAt <= now) {
            return new Response(null, { status: 410, headers: { 'content-type': 'text/html; charset=UTF-8' } })
        }
        if (isShareTimeLocked(metadata, now) || (metadata.shareMode === 'deadman' && metadata.sharePulseDueAt && metadata.sharePulseDueAt > now)) {
            return new Response(null, { status: 423, headers: { 'content-type': 'text/html; charset=UTF-8' } })
        }
        if (metadata.shareBurnAfterReading === true) {
            return new Response(null, { status: 302, headers: { Location: `${new URL(request.url).origin}/share/${shareId}` } })
        }
    }

    if (!metadata.pw && !metadata.vpw) {
        if (requestAcceptsMarkdown(request)) {
            return createMarkdownResponse(
                buildMarkdownDocument(markdownExportContent, {
                    title,
                    note_path: path,
                    edit_url: `${new URL(request.url).origin}/${path}`,
                    share_url: shareId ? `${new URL(request.url).origin}/share/${shareId}` : '',
                }),
            )
        }

        return returnPage('Edit', {
            lang,
            title,
            content: value,
            ext: { ...pageMetadata, ...blockPageExt, enableR2: getEnableR2(), ...await getEditorPublicationStats(path, metadata) },
            shareId,
            path,
        })
    }

    const { valid, role } = await checkAuth(cookie, path)

    if (valid && role === 'edit') {
        if (requestAcceptsMarkdown(request)) {
            return createMarkdownResponse(
                buildMarkdownDocument(markdownExportContent, {
                    title,
                    note_path: path,
                    edit_url: `${new URL(request.url).origin}/${path}`,
                    share_url: shareId ? `${new URL(request.url).origin}/share/${shareId}` : '',
                }),
            )
        }

        return returnPage('Edit', {
            lang,
            title,
            content: value,
            ext: { ...pageMetadata, ...blockPageExt, enableR2: getEnableR2(), ...await getEditorPublicationStats(path, metadata) },
            shareId,
            path,
        })
    }

    if (valid && role === 'view') {
        return returnPage('Share', {
            lang,
            title,
            content: value,
            ext: { ...pageMetadata, ...blockPageExt, enableR2: getEnableR2(), authPath: `/${path}/auth` },
            shareId,
            path,
        })
    }

    if (metadata.vpw) return returnPage('NeedPasswd', { lang, title, path, ext: { authPath: `/${path}/auth` } })

    return returnPage('Share', {
        lang,
        title,
        content: value,
        ext: { ...pageMetadata, ...blockPageExt, enableR2: getEnableR2(), authPath: `/${path}/auth` },
        shareId,
        path,
    })
})

router.post('/:path/auth', async request => {
    const { path } = request.params
    if (request.headers.get('Content-Type') === 'application/json') {
        const { passwd } = await request.json()

        const { metadata } = await queryNote(path)

        const role = await getPasswordRole(passwd, metadata)
        if (role) {
            const exp = Math.floor(Date.now() / 1000) + 7 * 86400
            const token = await jwt.sign({ path, role, exp }, getSecret())
            return returnJSON(0, {
                refresh: true,
                role,
            }, {
                'Set-Cookie': Cookies.serialize('auth', token, {
                    path: `/${path}`,
                    expires: dayjs().add(7, 'day').toDate(),
                    httpOnly: true,
                    secure: true,
                    sameSite: 'Lax',
                })
            })
        }
    }

    return returnJSON(10002, 'Password auth failed!')
})

router.post('/:path/pw', async request => {
    const { path } = request.params
    try {
        if (request.headers.get('Content-Type') === 'application/json') {
            const cookie = Cookies.parse(request.headers.get('Cookie') || '')
            const { passwd, type } = await request.json()

            const { value, metadata } = await queryNote(path)
            const { valid, role } = await checkAuth(cookie, path)

            if ((!metadata.pw && !metadata.vpw) || (valid && role === 'edit')) {
                const pwField = type === 'view' ? 'vpw' : 'pw'
                const pw = passwd ? await saltPw(passwd) : undefined
                try {
                    await driverPutNote(path, value, {
                        ...metadata,
                        [pwField]: pw,
                    })

                    return returnJSON(0, null, {
                        'Set-Cookie': Cookies.serialize('auth', '', {
                            path: `/${path}`,
                            expires: dayjs().subtract(100, 'day').toDate(),
                            httpOnly: true,
                        })
                    })
                } catch (error) {
                    console.error(error)
                    throw error
                }
            }

            return returnJSON(10003, 'Password setting failed!')
        }
    } catch (error) {
        console.error('PW Error:', error)
        return returnJSON(500, `PW Internal Error: ${error.message}`)
    }
})

router.post('/:path/setting', async request => {
    const { path } = request.params
    try {
        if (request.headers.get('Content-Type') === 'application/json') {
            const cookie = Cookies.parse(request.headers.get('Cookie') || '')
            const {
                mode, shareMode, shareExpiresIn, shareBurnAfterReading,
                shareUnlockIn, shareUnlockAt, sharePulseInterval, sharePulseMinutes,
                shareMaxViews, removeSeal, sealMode, sealUnlockAt, sealMaxViews, sealPulseMinutes,
            } = await request.clone().json().catch(() => ({}))
            const { share, theme, title, width, shareFont, publicIndex, content, autosave, annotationsEnabled } = await request.json()

            const { value, metadata } = await queryNote(path)
            const { valid, role } = await checkAuth(cookie, path)

            if ((!metadata.pw && !metadata.vpw) || (valid && role === 'edit')) {
                try {
                    const resolvedFormat = resolveEditorFormat(metadata, content)
                    if (typeof content === 'string' && resolvedFormat === 'block') {
                        try {
                            validateBlockDocument(parseBlockDocument(content, { allowTextFallback: false }))
                        } catch (error) {
                            return returnJSON(422, `Invalid block document: ${error.message}`, { status: 422 })
                        }
                    }
                    if (typeof content === 'string' && resolvedFormat === 'canvas') {
                        try {
                            validateCanvasDocument(parseCanvasDocument(content, { allowFallback: false }))
                        } catch (error) {
                            return returnJSON(422, `Invalid canvas document: ${error.message}`, { status: 422 })
                        }
                    }
                    if (typeof content === 'string' && resolvedFormat === 'whiteboard') {
                        try {
                            validateWhiteboardDocument(parseWhiteboardDocument(content))
                        } catch (error) {
                            return returnJSON(422, `Invalid whiteboard document: ${error.message}`, { status: 422 })
                        }
                    }
                    const normalizedWidth = width === undefined
                        ? undefined
                        : normalizePreviewWidth(width, metadata.width || DEFAULT_PREVIEW_WIDTH)
                    if (width !== undefined && normalizedWidth === null) {
                        return returnJSON(400, 'Invalid width: use 100%, 960px, 1200px, or 1440px')
                    }
                    if (title !== undefined && (typeof title !== 'string' || title.trim().length > 200)) {
                        return returnJSON(400, 'Invalid title: use a text value up to 200 characters')
                    }
                    let nextMetadata = {
                        ...metadata,
                        ...share !== undefined && { share },
                        ...theme !== undefined && { theme },
                        ...title !== undefined && { title: title.trim() },
                        ...normalizedWidth !== undefined && { width: normalizedWidth },
                        ...shareFont !== undefined && { shareFont },
                        ...publicIndex !== undefined && { publicIndex: publicIndex === true },
                        ...autosave !== undefined && { autosave: autosave === true },
                        ...annotationsEnabled !== undefined && { annotationsEnabled: annotationsEnabled === true },
                        ...mode !== undefined && { mode },
                    }

                    const effectiveMode = sealMode !== undefined ? sealMode : shareMode
                    if (removeSeal === true || effectiveMode === 'none') {
                        nextMetadata.shareMode = 'standard'
                        nextMetadata.shareBurnAfterReading = false
                        delete nextMetadata.shareBurnedAt
                        delete nextMetadata.shareUnlockAt
                        delete nextMetadata.shareUnlockIn
                        delete nextMetadata.sharePulseDueAt
                        delete nextMetadata.sharePulseInterval
                        delete nextMetadata.shareMaxViews
                    } else if (effectiveMode !== undefined) {
                        nextMetadata.shareMode = effectiveMode
                        if (effectiveMode === 'burn') {
                            nextMetadata.shareBurnAfterReading = true
                        } else {
                            nextMetadata.shareBurnAfterReading = false
                            delete nextMetadata.shareBurnedAt
                            if (effectiveMode === 'standard') {
                                delete nextMetadata.shareUnlockAt
                                delete nextMetadata.shareUnlockIn
                                delete nextMetadata.sharePulseDueAt
                                delete nextMetadata.sharePulseInterval
                            }
                        }
                    }

                    if (shareExpiresIn !== undefined) {
                        if (shareExpiresIn === null || shareExpiresIn === 'never' || shareExpiresIn === '') {
                            nextMetadata.shareExpiresIn = null
                            delete nextMetadata.shareExpiresAt
                            delete nextMetadata.shareExpiredAt
                        } else {
                            const expSec = parseExpirationSeconds(shareExpiresIn)
                            if (expSec) {
                                nextMetadata.shareExpiresIn = shareExpiresIn
                                nextMetadata.shareExpiresAt = dayjs().unix() + expSec
                                delete nextMetadata.shareExpiredAt
                            } else {
                                nextMetadata.shareExpiresIn = null
                                delete nextMetadata.shareExpiresAt
                            }
                        }
                    }

                    if (shareBurnAfterReading !== undefined) {
                        nextMetadata.shareBurnAfterReading = shareBurnAfterReading === true
                    }

                    const effectiveUnlockAt = sealUnlockAt !== undefined ? sealUnlockAt : shareUnlockAt
                    if (effectiveUnlockAt !== undefined && effectiveUnlockAt !== null && effectiveUnlockAt !== '') {
                        let targetSec = 0
                        if (typeof effectiveUnlockAt === 'number' && effectiveUnlockAt > 0) {
                            targetSec = effectiveUnlockAt > 1e11 ? Math.floor(effectiveUnlockAt / 1000) : effectiveUnlockAt
                        } else if (typeof effectiveUnlockAt === 'string' && effectiveUnlockAt.trim()) {
                            const parsed = dayjs(effectiveUnlockAt)
                            if (parsed.isValid()) targetSec = parsed.unix()
                        }
                        if (targetSec > 0) {
                            nextMetadata.shareUnlockAt = targetSec
                            nextMetadata.shareUnlockIn = `${Math.max(1, Math.round((targetSec - dayjs().unix()) / 60))}m`
                        }
                    } else if (shareUnlockIn !== undefined || (nextMetadata.shareMode === 'timelock' && !nextMetadata.shareUnlockAt)) {
                        const effectiveUnlockIn = shareUnlockIn || nextMetadata.shareUnlockIn || '1d'
                        const unlockSec = parseExpirationSeconds(effectiveUnlockIn) || 86400
                        nextMetadata.shareUnlockIn = effectiveUnlockIn
                        nextMetadata.shareUnlockAt = dayjs().unix() + unlockSec
                    }

                    const effectivePulseMins = sealPulseMinutes !== undefined ? sealPulseMinutes : sharePulseMinutes
                    if (effectivePulseMins !== undefined && effectivePulseMins !== null && effectivePulseMins !== '') {
                        const mins = parseInt(effectivePulseMins, 10)
                        if (Number.isFinite(mins) && mins > 0) {
                            const pulseSec = mins * 60
                            nextMetadata.sharePulseInterval = pulseSec
                            nextMetadata.sharePulseDueAt = dayjs().unix() + pulseSec
                            nextMetadata.shareLastPulseAt = dayjs().unix()
                            if (!nextMetadata.sharePulseToken) {
                                nextMetadata.sharePulseToken = (await MD5(path + dayjs().unix() + 'pulse')).substring(0, 24)
                            }
                        }
                    } else if (sharePulseInterval !== undefined || (nextMetadata.shareMode === 'deadman' && !nextMetadata.sharePulseDueAt)) {
                        const effectivePulse = sharePulseInterval || nextMetadata.sharePulseInterval || '7d'
                        const pulseSec = parseExpirationSeconds(effectivePulse) || 7 * 86400
                        nextMetadata.sharePulseInterval = pulseSec
                        nextMetadata.sharePulseDueAt = dayjs().unix() + pulseSec
                        nextMetadata.shareLastPulseAt = dayjs().unix()
                        if (!nextMetadata.sharePulseToken) {
                            nextMetadata.sharePulseToken = (await MD5(path + dayjs().unix() + 'pulse')).substring(0, 24)
                        }
                    }

                    const effectiveMaxViews = sealMaxViews !== undefined ? sealMaxViews : shareMaxViews
                    if (effectiveMaxViews !== undefined) {
                        const maxV = parseInt(effectiveMaxViews, 10)
                        if (Number.isFinite(maxV) && maxV > 0) nextMetadata.shareMaxViews = maxV
                    }

                    if (share === true) {
                        if (metadata.shareBurnedAt) {
                            delete nextMetadata.shareSlug
                            delete nextMetadata.shareId
                        }
                        delete nextMetadata.shareBurnedAt
                        delete nextMetadata.shareExpiredAt
                    }

                    if (share === true && metadata.share !== true && annotationsEnabled === undefined) {
                        nextMetadata.annotationsEnabled = true
                    }
                    if (share === false) {
                        nextMetadata.publicIndex = false
                        nextMetadata.annotationsEnabled = false
                    }
                    if (nextMetadata.share !== true) {
                        nextMetadata.autosave = false
                    }
                    if (typeof content === 'string') {
                        nextMetadata.updateAt = dayjs().unix()
                    }
                    nextMetadata = await ensureShareMetadata(path, nextMetadata)

                    const textToSave = typeof content === 'string' ? content : value
                    if (share === true) {
                        await persistNoteContent({
                            path,
                            content: textToSave,
                            metadata: nextMetadata,
                            previousContent: value,
                        })
                    } else {
                        await driverPutNote(path, textToSave, nextMetadata)
                    }

                    const authorCookie = await createAuthorCookie(path)
                    if (nextMetadata.share === true) {
                        await syncShareMappings(path, nextMetadata, metadata)
                        const shareId = await getShareIdForPath(path, nextMetadata)
                        if (shareId && (shareExpiresIn !== undefined || share === true)) {
                            await driverSetShareStatus(shareId, null)
                        }
                        return returnJSON(0, shareId, { 'Set-Cookie': authorCookie })
                    }
                    if (share === false) {
                        await syncShareMappings(path, nextMetadata, metadata)
                    }

                    return returnJSON(0, null, { 'Set-Cookie': authorCookie })
                } catch (error) {
                    console.error(error)
                    throw error
                }
            }

            return returnJSON(10004, 'Update Setting failed!')
        }
    } catch (error) {
        console.error('Setting Error:', error)
        return returnJSON(500, `Setting Internal Error: ${error.message}`)
    }
})

router.post('/:path/transcribe', async (request, context = {}) => {
    const path = decodeURIComponent(request.params.path)

    const { metadata } = await queryNote(path)
    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const { valid, role } = await checkAuth(cookie, path)

    if (metadata && (metadata.pw || metadata.vpw) && (!valid || role !== 'edit')) {
        return returnJSON(10002, 'Password auth failed!', { status: 401 })
    }

    if (isTurnstileEnabled() && !(valid && role === 'edit')) {
        const turnstileCheck = await verifyTurnstileAccess(request)
        if (!turnstileCheck.ok) {
            return returnJSON(403, 'Turnstile verification required', {
                status: 403,
                needTurnstile: true,
                reason: turnstileCheck.reason,
            })
        }
    }

    return handleAudioTranscription(request, context)
})

router.post('/:path/ai-format', async (request, { env }) => {
    const path = decodeURIComponent(request.params.path)

    const { metadata } = await queryNote(path)
    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const { valid, role } = await checkAuth(cookie, path)

    if (metadata && (metadata.pw || metadata.vpw) && (!valid || role !== 'edit')) {
        return returnJSON(10002, 'Password auth failed!', { status: 401 })
    }

    if (isTurnstileEnabled() && !(valid && role === 'edit')) {
        const turnstileCheck = await verifyTurnstileAccess(request)
        if (!turnstileCheck.ok) {
            return returnJSON(403, 'Turnstile verification required', {
                status: 403,
                needTurnstile: true,
                reason: turnstileCheck.reason,
            })
        }
    }

    const aiBinding = resolveAiBinding(env)
    if (!aiBinding) {
        return returnJSON(50001, 'Cloudflare Workers AI or Groq AI service is not configured on this Worker.', { status: 500 })
    }

    let json
    try {
        json = await request.json()
    } catch (e) {
        return returnJSON(40001, 'Invalid JSON body', { status: 400 })
    }

    const { text, mode, instruction, selectionStart, selectionEnd, targetLanguage, bilingual } = json
    if (!text || typeof text !== 'string') {
        return returnJSON(40002, 'Text content is required', { status: 400 })
    }

    const normalizedText = typeof text === 'string' ? text.replace(/\u0000/g, '') : ''
    const userInstruction = typeof instruction === 'string' ? instruction.replace(/\u0000/g, '').trim() : ''

    if (mode !== 'format' && mode !== 'edit' && mode !== 'translate') {
        return returnJSON(40003, 'Unsupported AI mode', { status: 400 })
    }

    if (mode === 'edit' && !userInstruction) {
        return returnJSON(40004, 'Editing instructions are required', { status: 400 })
    }

    const translationTargetLanguage = normalizeTranslationTargetLanguage(targetLanguage)
    if (mode === 'translate' && !translationTargetLanguage) {
        return returnJSON(40005, 'A target language is required for translation', { status: 400 })
    }

    const hasSelection = (mode === 'format' || mode === 'edit' || mode === 'translate')
        && Number.isInteger(selectionStart)
        && Number.isInteger(selectionEnd)
        && selectionStart >= 0
        && selectionEnd > selectionStart
        && selectionEnd <= normalizedText.length
    const model = mode === 'format' ? '@cf/openai/gpt-oss-20b' : '@cf/openai/gpt-oss-120b'
    const messages = [
        {
            role: 'system',
            content: hasSelection
                ? mode === 'format'
                    ? `${AI_FORMAT_SYSTEM_PROMPT} Apply it only to the selected text. Return only the replacement text, with no markers, explanations, quotes, or unchanged surrounding text.`
                    : mode === 'translate'
                    ? buildTranslationSystemPrompt({ targetLanguage: translationTargetLanguage, bilingual: bilingual === true, selectionOnly: true })
                    : 'You are a careful Markdown editing assistant. Rewrite only the selected text according to the user requirements. Use the surrounding text only as context. Return only the replacement text for the selection, with no markers, explanations, quotes, or unchanged surrounding text.'
                : mode === 'edit'
                ? 'You are a careful Markdown editing assistant. Apply the user requirements precisely, whether they request inserting a passage, editing part of the note, or refining the full note. Preserve all untouched content, facts, links, Markdown structure, and the original language unless explicitly asked otherwise. Return the complete edited note, not a summary or patch. Output only the final Markdown with no explanations.'
                : mode === 'translate'
                ? buildTranslationSystemPrompt({ targetLanguage: translationTargetLanguage, bilingual: bilingual === true })
                : AI_FORMAT_SYSTEM_PROMPT
        },
        {
            role: 'user',
            content: buildAiUserPrompt({
                mode,
                text: normalizedText,
                instruction: userInstruction,
                selectionStart,
                selectionEnd,
                hasSelection,
                targetLanguage: translationTargetLanguage,
                bilingual: bilingual === true,
            })
        }
    ]

    try {
        const aiResponse = await runAiWithTimeout(aiBinding, model, {
            messages,
            reasoning_effort: 'low',
            max_completion_tokens: 8192,
        }, 120000)
        const resultText = extractAiText(aiResponse)
        if (resultText) {
            const formatSource = hasSelection ? normalizedText.slice(selectionStart, selectionEnd) : normalizedText
            if (mode === 'format' && !preservesFormatLanguage(formatSource, resultText)) {
                return returnJSON(40006, 'AI formatting changed the document language. The original content was kept unchanged.', { status: 422 })
            }
            return returnJSON(0, { result: resultText, scope: hasSelection ? 'selection' : 'document', modelUsed: model })
        }
        return returnJSON(50003, `AI service returned an empty response for model ${model}`)
    } catch (error) {
        console.error(`[AI] AI model ${model} failed:`, error)
        console.error(`[AI] Error name:`, error.name)
        console.error(`[AI] Error message:`, error.message)
        console.error(`[AI] Error stack:`, error.stack)
        return returnJSON(50003, `AI model ${model} failed: ${error.message}`)
    }
})

router.post('/:path', async request => {
    const { path } = request.params
    const { value, metadata } = await queryNote(path)

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const { valid, role } = await checkAuth(cookie, path)

    if ((!metadata.pw && !metadata.vpw) || (valid && role === 'edit')) {
        // OK
    } else {
        return returnJSON(10002, 'Password auth failed! Try refreshing this page if you had just set a password.')
    }

    if (!canPersistNoteContent(metadata)) {
        return returnJSON(10005, getSaveBlockedMessage(getI18n(request)))
    }

    const formData = await request.formData();
    const content = formData.get('t')

    let turnstileSetCookie = null
    if (isTurnstileEnabled() && !(valid && role === 'edit')) {
        const bodyToken = formData.get('cf-turnstile-response') || null
        const bodyFallback = formData.get('cf_turnstile_fallback') === '1'
        const turnstileCheck = await verifyTurnstileAccess(request, bodyToken, { fallback: bodyFallback })
        if (!turnstileCheck.ok) {
            return returnJSON(403, 'Turnstile verification required', {
                status: 403,
                needTurnstile: true,
                reason: turnstileCheck.reason,
            })
        }
        if (turnstileCheck.setCookieHeader) {
            turnstileSetCookie = turnstileCheck.setCookieHeader
        }
    }

    const editorFormat = resolveEditorFormat(metadata, content)
    if (editorFormat === 'block') {
        try {
            validateBlockDocument(parseBlockDocument(content, { allowTextFallback: false }))
        } catch (error) {
            return returnJSON(422, `Invalid block document: ${error.message}`, { status: 422 })
        }
    } else if (editorFormat === 'canvas') {
        try {
            validateCanvasDocument(parseCanvasDocument(content, { allowFallback: false }))
        } catch (error) {
            return returnJSON(422, `Invalid canvas document: ${error.message}`, { status: 422 })
        }
    } else if (editorFormat === 'whiteboard') {
        try {
            validateWhiteboardDocument(parseWhiteboardDocument(content))
        } catch (error) {
            return returnJSON(422, `Invalid whiteboard document: ${error.message}`, { status: 422 })
        }
    }

    try {
        const nextMeta = {
            ...metadata,
            ...(editorFormat !== 'markdown' && !metadata.editorFormat ? { editorFormat } : {}),
            updateAt: dayjs().unix(),
        }
        if (metadata.shareMode === 'deadman') {
            const pulseInterval = metadata.sharePulseInterval || 7 * 86400
            nextMeta.sharePulseDueAt = dayjs().unix() + pulseInterval
            nextMeta.shareLastPulseAt = dayjs().unix()
        }
        await persistNoteContent({
            path,
            content,
            metadata: nextMeta,
            previousContent: value,
        })
        if (nextMeta.share === true) {
            await syncShareMappings(path, nextMeta, metadata).catch(() => {})
        }

        const responseHeaders = turnstileSetCookie ? { 'Set-Cookie': turnstileSetCookie } : {}
        return returnJSON(0, null, responseHeaders)
    } catch (error) {
        console.error('Save Error:', error)
        return returnJSON(10001, `KV insert fail: ${error.message}`)
    }
})

router.all('*', (request) => {
    const lang = getI18n(request)
    return returnPage('Page404', { lang, title: '404' })
})

function bindRuntimeEnv(env = {}) {
    Object.assign(globalThis, env)
}

export default {
    async fetch(request, env, ctx) {
        bindRuntimeEnv(env)

        try {
            const response = await router.handle(request, {
                request,
                env,
                waitUntil: promise => ctx.waitUntil(promise),
            })
            const requestPath = new URL(request.url).pathname
            let finalResponse = response

            if (requestPath === '/') {
                const headers = new Headers(response.headers)
                applyDiscoveryHeaders(headers)
                finalResponse = new Response(response.body, {
                    headers,
                    status: response.status,
                    statusText: response.statusText,
                })
            }

            if (request.method === 'HEAD') {
                return new Response(null, {
                    headers: finalResponse.headers,
                    status: finalResponse.status,
                    statusText: finalResponse.statusText,
                })
            }

            return finalResponse
        } catch (err) {
            console.error('Fetch Event Error:', err)
            return new Response(`Worker Error: ${err.message}`, { status: 500 })
        }
    },

    // Cron job: Delete empty pages daily at 9 AM Taiwan time (1 AM UTC)
    async scheduled(event, env) {
        bindRuntimeEnv(env)
        console.log('Cron triggered at:', new Date().toISOString())

        try {
            const result = await deleteEmptyPages()
            console.log(`Cron cleanup completed: ${result.deleted} pages deleted`)

            if (result.errors.length > 0) {
                console.error('Cron cleanup errors:', result.errors)
            }
        } catch (e) {
            console.error('Cron cleanup failed:', e)
        }
    },
}
