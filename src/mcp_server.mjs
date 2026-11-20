import dayjs from 'dayjs'
import { driverQueryNote, driverPutNote, driverQueryShare, driverPutShare, driverDeleteShare, driverSetShareStatus } from './storage_driver.mjs'
import { renderMarkdownToHtml, extractMarkdownData, lintMarkdownText } from './markdown-processor.mjs'
import { renderMarkdownToPdf } from './pdf_service.mjs'
import { getNoteStatsDb, getNoteViewCount } from './note_stats.mjs'
import { resolvePasswordRole } from './password_policy.mjs'
import { DEFAULT_PREVIEW_WIDTH, normalizePreviewWidth } from './constant.js'
import { canPersistNoteContent } from './save_policy.mjs'
import { getNoteHistoryConfig, saveNoteHistoryVersionIfNeeded } from './note_history.mjs'
import { AGENT_SKILL_MARKDOWN } from './generated/agent-skill.generated.mjs'
import { parseCanvasDocument, validateCanvasDocument } from './canvas_document.mjs'
import { parseWhiteboardDocument, validateWhiteboardDocument, whiteboardToMarkdown } from './whiteboard_document.mjs'
import { buildWikiLinkCanvas } from '../static/js/canvas-v2/model/wikiGraphGenerator.mjs'
import { parseExpirationSeconds, formatShareRemainingTime } from './note_meta.js'

export const MCP_SERVER_INFO = {
    name: 'david888-wiki',
    version: '1.0.0',
    protocolVersion: '2024-11-05',
    description: 'David888 Wiki native MCP Server. Supports Markdown, JSON Canvas diagrams, Excalidraw whiteboards, 2D slide decks (---/--), dual-pane Book Mode (/book), and rich formatting. Use write_canvas for structured card graphs, or write_whiteboard for freeform hand-drawn sketches.',
}

export const MCP_TOOLS_DEFINITIONS = [
    {
        name: 'get_authoring_skill_guide',
        description: 'Retrieve the complete David888 Wiki authoring guide and multi-article Book Orchestration SOP (Markdown formatting, 2D slide decks, Book Mode /book, KaTeX, citations, themes) from SKILL.md.',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: 'read_note',
        description: 'Retrieve the markdown content and metadata of a note from David888 Wiki / Cloud Notepad.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The unique slug/path of the note (e.g. "my-project-note" or "meeting-summary").',
                },
                password: {
                    type: 'string',
                    description: 'Optional View Lock or Edit Lock password if the note is password-protected.',
                },
            },
            required: ['path'],
        },
    },
    {
        name: 'write_note',
        description: 'Create or overwrite a markdown note on David888 Wiki / Cloud Notepad. Returns both the edit URL and the public Share URL. Supports 2D slide presentations ("---"/"--") and Book Mode ("/book"). For the multi-chapter Book Orchestration SOP, call "get_authoring_skill_guide".',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The unique slug/path for the note (kebab-case recommended).',
                },
                text: {
                    type: 'string',
                    description: 'The complete markdown content to write.',
                },
                password: {
                    type: 'string',
                    description: 'Optional Edit Lock password. Required if the note already has an edit password.',
                },
                view_password: {
                    type: 'string',
                    description: 'Optional View Lock password to restrict reader access.',
                },
                make_private: {
                    type: 'boolean',
                    description: 'Set to true to disable public sharing (default: false / public).',
                },
                theme: {
                    type: 'string',
                    description: 'Optional visual theme (e.g., "claude-canvas", "retro", "notion-clean", "terminal").',
                },
                width: {
                    type: 'string',
                    description: 'Optional layout width: "100%", "960px", "1200px", or "1440px" (default: "1200px").',
                },
                share_mode: {
                    type: 'string',
                    enum: ['standard', 'burn_after_reading', 'timelock', 'deadman'],
                    description: 'Vault security mode: "standard" (normal public/expiring share), "burn_after_reading" (single-use self-destructing note), "timelock" (sealed until unlock_in time), or "deadman" (sealed while author pulses; auto-releases if pulse expires).',
                },
                expires_in: {
                    type: 'string',
                    description: 'Expiration duration for standard share (e.g. "10m", "1h", "1d", "7d", "30d", or seconds).',
                },
                burn_after_reading: {
                    type: 'boolean',
                    description: 'Shorthand for share_mode="burn_after_reading". Destroys note on first visitor read.',
                },
                unlock_in: {
                    type: 'string',
                    description: 'Sealed duration for timelock capsule (e.g. "1h", "1d", "7d", "30d"). Note becomes visible after this duration.',
                },
                pulse_interval: {
                    type: 'string',
                    description: 'Author pulse check-in interval for deadman switch (e.g. "3d", "7d", "14d", "30d"). If author fails to check in, the note auto-releases.',
                },
            },
            required: ['path', 'text'],
        },
    },
    {
        name: 'write_canvas',
        description: 'Create or overwrite a JSON Canvas 1.0 document with nodes and relationship edges. Use this when the user asks for a visual map, concept diagram, architecture canvas, or connected card graph. Returns the edit URL and public Share URL.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Unique note path.' },
                document: { type: 'object', description: 'Complete JSON Canvas document with nodes and edges.' },
                password: { type: 'string', description: 'Optional edit password.' },
                view_password: { type: 'string', description: 'Optional view password.' },
                make_private: { type: 'boolean', description: 'Keep the Canvas private when true.' },
                theme: { type: 'string', description: 'Optional Canvas theme.' },
                width: { type: 'string', enum: ['100%', '960px', '1200px', '1440px'], description: 'Optional published layout width.' },
                share_mode: { type: 'string', enum: ['standard', 'burn_after_reading', 'timelock', 'deadman'], description: 'Vault security mode.' },
                expires_in: { type: 'string', description: 'Expiration duration (e.g. "10m", "1h", "1d", "7d", "30d").' },
                burn_after_reading: { type: 'boolean', description: 'Single-use burn-after-reading switch.' },
                unlock_in: { type: 'string', description: 'Time-locked capsule duration.' },
                pulse_interval: { type: 'string', description: 'Dead man switch pulse interval.' },
            },
            required: ['path', 'document'],
        },
    },
    {
        name: 'read_canvas',
        description: 'Read a JSON Canvas document, including its nodes, edges, metadata, and Share URL. Use this to inspect whether a relationship edge exists.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Canvas note path.' },
                password: { type: 'string', description: 'Optional view or edit password.' },
            },
            required: ['path'],
        },
    },
    {
        name: 'validate_canvas',
        description: 'Validate a JSON Canvas document before publishing. Returns node and edge counts plus validation errors.',
        inputSchema: {
            type: 'object',
            properties: {
                document: { type: 'object', description: 'Complete JSON Canvas document.' },
            },
            required: ['document'],
        },
    },
    {
        name: 'generate_canvas_from_wikilinks',
        description: 'Read a Markdown note, parse [[WikiLink]] references, create a JSON Canvas relationship graph, and publish it as a new Canvas note.',
        inputSchema: {
            type: 'object',
            properties: {
                source_path: { type: 'string', description: 'Markdown note path containing [[WikiLink]] references.' },
                canvas_path: { type: 'string', description: 'Target Canvas path. Defaults to <source_path>-graph.' },
                password: { type: 'string', description: 'Optional password for the source note and target edit lock.' },
                make_private: { type: 'boolean', description: 'Keep the generated Canvas private when true.' },
                theme: { type: 'string', description: 'Optional Canvas theme.' },
            },
            required: ['source_path'],
        },
    },
    {
        name: 'write_whiteboard',
        description: 'Create or overwrite an Excalidraw whiteboard document with hand-drawn elements (rectangles, arrows, sticky notes, text). Use this when the user asks for a freeform sketch, wireframe, brainstorming board, or hand-drawn flowchart. Returns the edit URL and public Share URL.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Unique note path.' },
                document: { type: 'object', description: 'Complete Excalidraw document with elements array.' },
                password: { type: 'string', description: 'Optional edit password.' },
                view_password: { type: 'string', description: 'Optional view password.' },
                make_private: { type: 'boolean', description: 'Keep the whiteboard private when true.' },
                theme: { type: 'string', description: 'Optional theme.' },
                width: { type: 'string', enum: ['100%', '960px', '1200px', '1440px'], description: 'Optional published layout width.' },
                share_mode: { type: 'string', enum: ['standard', 'burn_after_reading', 'timelock', 'deadman'], description: 'Vault security mode.' },
                expires_in: { type: 'string', description: 'Expiration duration (e.g. "10m", "1h", "1d", "7d", "30d").' },
                burn_after_reading: { type: 'boolean', description: 'Single-use burn-after-reading switch.' },
                unlock_in: { type: 'string', description: 'Time-locked capsule duration.' },
                pulse_interval: { type: 'string', description: 'Dead man switch pulse interval.' },
            },
            required: ['path', 'document'],
        },
    },
    {
        name: 'read_whiteboard',
        description: 'Read an Excalidraw whiteboard document, including its elements, text labels, metadata, and Share URL.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Whiteboard note path.' },
                password: { type: 'string', description: 'Optional view or edit password.' },
            },
            required: ['path'],
        },
    },
    {
        name: 'validate_whiteboard',
        description: 'Validate an Excalidraw whiteboard document before publishing. Returns element counts and text summary.',
        inputSchema: {
            type: 'object',
            properties: {
                document: { type: 'object', description: 'Complete Excalidraw document.' },
            },
            required: ['document'],
        },
    },
    {
        name: 'append_note',
        description: 'Append markdown content to the bottom of an existing note on David888 Wiki / Cloud Notepad.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The slug/path of the note.',
                },
                text: {
                    type: 'string',
                    description: 'New markdown text to append to the bottom of the article.',
                },
                password: {
                    type: 'string',
                    description: 'Optional Edit Lock credential if the note is protected.',
                },
            },
            required: ['path', 'text'],
        },
    },
    {
        name: 'render_markdown',
        description: 'Render raw markdown text into styled HTML with custom typography and themes.',
        inputSchema: {
            type: 'object',
            properties: {
                markdown: {
                    type: 'string',
                    description: 'The raw markdown content to render.',
                },
                theme: {
                    type: 'string',
                    description: 'Optional theme name (default: "claude-canvas").',
                },
                title: {
                    type: 'string',
                    description: 'Optional document title.',
                },
            },
            required: ['markdown'],
        },
    },
    {
        name: 'lint_markdown',
        description: 'Validate and auto-fix markdown syntax issues such as unclosed code fences, missing spaces after headings, and broken diagram syntax.',
        inputSchema: {
            type: 'object',
            properties: {
                markdown: {
                    type: 'string',
                    description: 'The markdown text to validate and fix.',
                },
            },
            required: ['markdown'],
        },
    },
    {
        name: 'extract_markdown_meta',
        description: 'Extract document title, heading hierarchy, links, plain text, and word count / reading time statistics from markdown.',
        inputSchema: {
            type: 'object',
            properties: {
                markdown: {
                    type: 'string',
                    description: 'The markdown content to analyze.',
                },
            },
            required: ['markdown'],
        },
    },
    {
        name: 'get_view_stats',
        description: 'Retrieve unique visitor count and statistics for a published note path on David888 Wiki.',
        inputSchema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'The note path/slug.',
                },
            },
            required: ['path'],
        },
    },
    {
        name: 'export_pdf',
        description: 'Render Markdown text into a downloadable paged vector PDF via Takumi-PDF without Chromium. Returns document metadata and download endpoint.',
        inputSchema: {
            type: 'object',
            properties: {
                markdown: {
                    type: 'string',
                    description: 'The markdown content to render into PDF.',
                },
                title: {
                    type: 'string',
                    description: 'Optional document title for headers and metadata.',
                },
                size: {
                    type: 'string',
                    enum: ['a4', 'letter', 'a5', 'b5'],
                    description: 'Page size (default: "a4").',
                },
                landscape: {
                    type: 'boolean',
                    description: 'Whether to render in landscape mode (default: false).',
                },
                theme: {
                    type: 'string',
                    description: 'Optional visual theme (e.g. "claude-canvas", "retro", "professional").',
                },
            },
            required: ['markdown'],
        },
    },
    {
        name: 'get_api_catalog',
        description: 'Retrieve machine-readable API catalog, skill specifications, and discovery endpoints for David888 Wiki.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
]

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
    'Access-Control-Max-Age': '86400',
}

export const genRandomStr = (n = 4) => {
    const charset = '2345679abcdefghjkmnpqrstwxyz'
    const len = charset.length
    let out = ''
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(n)
        crypto.getRandomValues(bytes)
        for (let i = 0; i < n; i++) {
            out += charset.charAt(bytes[i] % len)
        }
        return out
    }
    for (let i = 0; i < n; i++) {
        out += charset.charAt(Math.floor(Math.random() * len))
    }
    return out
}

async function md5Hex(str) {
    const input = String(str || '')
    try {
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const msgUint8 = new TextEncoder().encode(input)
            const hashBuffer = await crypto.subtle.digest('MD5', msgUint8)
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        }
    } catch (_) {}
    try {
        const mod = 'node:' + 'crypto'
        const nodeCrypto = await import(/* webpackIgnore: true */ mod)
        return nodeCrypto.createHash('md5').update(input).digest('hex')
    } catch (_) {}
    return ''
}

async function saltPassword(password) {
    const salt = globalThis.SCN_SALT || ''
    const hashPw = await md5Hex(password)
    return await md5Hex(`${hashPw}+${salt}`)
}

async function checkPasswordMatch(password, storedHash) {
    if (!storedHash) return false
    const current = await saltPassword(password)
    if (storedHash === current) return true
    const legacy = await md5Hex(`${await md5Hex(password)}+undefined`)
    return storedHash === legacy
}

async function checkPasswordRole(password, metadata) {
    return resolvePasswordRole(password, metadata, checkPasswordMatch)
}

function createJsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Cache-Control': 'no-store',
            ...CORS_HEADERS,
        },
    })
}

async function ensureMcpShareMetadata(path, metadata = {}) {
    if (metadata?.share !== true) return { ...metadata }
    const existingSlug = metadata?.shareSlug || metadata?.shareId
    if (existingSlug) {
        return {
            ...metadata,
            shareSlug: existingSlug,
            shareId: existingSlug,
        }
    }
    let attempts = 0
    let candidate = ''
    while (attempts < 8) {
        const gen = genRandomStr(6)
        const existing = await driverQueryShare(gen)
        if (!existing || existing === path) {
            candidate = gen
            break
        }
        attempts += 1
    }
    if (!candidate) {
        candidate = `${path}-${Date.now().toString(36).slice(-4)}`
    }
    return {
        ...metadata,
        shareSlug: candidate,
        shareId: candidate,
    }
}

function applyVaultMetadata(nextMetadata, args, nowUnix = dayjs().unix()) {
    if (args.share_mode || args.burn_after_reading || args.expires_in || args.unlock_in || args.pulse_interval) {
        const mode = args.share_mode || (args.burn_after_reading ? 'burn_after_reading' : 'standard')
        const isBurnMode = mode === 'burn_after_reading' || mode === 'burn' || args.burn_after_reading === true
        nextMetadata.shareMode = mode
        if (isBurnMode) {
            nextMetadata.shareBurnAfterReading = true
            nextMetadata.shareMaxViews = 1
        }
        if (args.expires_in) {
            const expSec = parseExpirationSeconds(args.expires_in)
            if (expSec > 0) {
                nextMetadata.shareExpiresIn = args.expires_in
                nextMetadata.shareExpiresAt = nowUnix + expSec
            }
        }
        if (mode === 'timelock' && args.unlock_in) {
            const unlockSec = parseExpirationSeconds(args.unlock_in)
            if (unlockSec > 0) {
                nextMetadata.shareUnlockIn = args.unlock_in
                nextMetadata.shareUnlockAt = nowUnix + unlockSec
            }
        }
        if (mode === 'deadman' && args.pulse_interval) {
            const pulseSec = parseExpirationSeconds(args.pulse_interval)
            if (pulseSec > 0) {
                nextMetadata.sharePulseInterval = pulseSec
                nextMetadata.sharePulseDueAt = nowUnix + pulseSec
                if (!nextMetadata.sharePulseToken) {
                    nextMetadata.sharePulseToken = genRandomStr(24)
                }
            }
        }
    }
    return nextMetadata
}

async function persistMcpNote({ path, content, metadata, previousContent }) {
    await driverPutNote(path, content, metadata)

    const legacyShareId = await md5Hex(path)
    const shareKeys = [...new Set([legacyShareId, metadata.shareSlug, metadata.shareId].filter(Boolean))]
    if (metadata.share === true) {
        const shareOpts = metadata.shareExpiresAt ? { expiration: metadata.shareExpiresAt } : undefined
        for (const key of shareKeys) {
            await driverPutShare(key, path, shareOpts)
            if (!metadata.shareBurnedAt && !metadata.shareExpiredAt) {
                await driverSetShareStatus(key, null)
            }
        }
    } else if (metadata.share === false) {
        for (const key of shareKeys) {
            await driverDeleteShare(key)
            if (!metadata.shareBurnedAt && !metadata.shareExpiredAt) {
                await driverSetShareStatus(key, null)
            }
        }
    }

    const historyConfig = getNoteHistoryConfig()
    if (historyConfig.enabled && historyConfig.db) {
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
        } catch (err) {
            console.error(`[MCP] Note history save failed for ${path}:`, err?.message || err)
        }
    }
}

async function executeMcpTool(name, args = {}, requestUrl) {
    const origin = requestUrl ? `${requestUrl.protocol}//${requestUrl.host}` : 'https://wiki.david888.com'

    switch (name) {
        case 'get_authoring_skill_guide': {
            return {
                isError: false,
                text: AGENT_SKILL_MARKDOWN,
            }
        }

        case 'read_note': {
            const path = String(args.path || '').trim()
            if (!path) {
                return { isError: true, text: 'Error: "path" parameter is required.' }
            }
            const { value, metadata } = await driverQueryNote(path)
            if (!value && (!metadata || Object.keys(metadata).length === 0)) {
                return { isError: true, text: `Error: Note "${path}" not found.` }
            }

            // Check passwords if protected
            if (metadata.pw || metadata.vpw) {
                const password = args.password || ''
                let authorized = false
                if (metadata.pw && await checkPasswordMatch(password, metadata.pw)) authorized = true
                if (metadata.vpw && await checkPasswordMatch(password, metadata.vpw)) authorized = true

                if (!authorized) {
                    return {
                        isError: true,
                        text: `Error: Password required to access protected note "${path}". Please provide the "password" argument.`,
                    }
                }
            }

            const shareSlug = metadata.share && (metadata.shareSlug || metadata.shareId)
            const shareUrl = shareSlug ? `${origin}/share/${shareSlug}` : null
            let responseText = value || ''
            if (shareUrl) {
                responseText += `\n\n---\n*Share URL:* ${shareUrl}`
            }
            return { isError: false, text: responseText }
        }

        case 'validate_canvas': {
            try {
                const document = args.document && typeof args.document === 'object' ? args.document : null
                const validated = validateCanvasDocument(parseCanvasDocument(JSON.stringify(document), { allowFallback: false }))
                return {
                    isError: false,
                    text: JSON.stringify({
                        valid: true,
                        nodeCount: validated.nodes.length,
                        edgeCount: validated.edges.length,
                        document: validated,
                    }, null, 2),
                }
            } catch (error) {
                return { isError: true, text: `Invalid Canvas document: ${error.message}` }
            }
        }

        case 'generate_canvas_from_wikilinks': {
            const sourcePath = String(args.source_path || '').trim()
            if (!sourcePath) return { isError: true, text: 'Error: "source_path" parameter is required.' }
            const { value: markdown, metadata } = await driverQueryNote(sourcePath)
            if (!markdown && (!metadata || Object.keys(metadata).length === 0)) {
                return { isError: true, text: 'Error: Markdown note "' + sourcePath + '" not found.' }
            }
            if (metadata.pw || metadata.vpw) {
                const role = await checkPasswordRole(args.password || '', metadata)
                if (!role) return { isError: true, text: 'Error: Password required for Markdown note "' + sourcePath + '".' }
            }
            const document = buildWikiLinkCanvas({ sourcePath, markdown: markdown || '' })
            const targetPath = String(args.canvas_path || (sourcePath + '-graph')).trim()
            return executeMcpTool('write_canvas', {
                path: targetPath,
                document,
                password: args.password,
                make_private: args.make_private,
                theme: args.theme,
            }, requestUrl)
        }

        case 'write_canvas': {
            const path = String(args.path || '').trim()
            const document = args.document && typeof args.document === 'object' ? args.document : null
            if (!path) return { isError: true, text: 'Error: "path" parameter is required.' }

            let validated
            try {
                validated = validateCanvasDocument(parseCanvasDocument(JSON.stringify(document), { allowFallback: false }))
            } catch (error) {
                return { isError: true, text: `Invalid Canvas document: ${error.message}` }
            }

            const { value: previousContent, metadata: previousMetadata } = await driverQueryNote(path)
            const metadata = previousMetadata || {}
            if (metadata.pw || metadata.vpw) {
                const role = await checkPasswordRole(args.password || '', metadata)
                if (role !== 'edit') return { isError: true, text: `Error: Edit password required for Canvas "${path}".` }
            }

            let nextMetadata = {
                ...metadata,
                editorFormat: 'canvas',
                updateAt: dayjs().unix(),
                share: args.make_private !== true,
                theme: args.theme || metadata.theme || 'claude-canvas',
                width: normalizePreviewWidth(args.width, metadata.width || DEFAULT_PREVIEW_WIDTH) || DEFAULT_PREVIEW_WIDTH,
            }

            if (args.password) nextMetadata.pw = await saltPassword(args.password)
            if (args.view_password) nextMetadata.vpw = await saltPassword(args.view_password)
            if (nextMetadata.share === true && metadata.share !== true) nextMetadata.annotationsEnabled = true
            if (nextMetadata.share === false) {
                nextMetadata.publicIndex = false
                nextMetadata.annotationsEnabled = false
            }
            if (!canPersistNoteContent(nextMetadata)) {
                return { isError: true, text: 'Error: Canvas saving is currently blocked by server policy.' }
            }
            nextMetadata = applyVaultMetadata(nextMetadata, args)
            nextMetadata = await ensureMcpShareMetadata(path, nextMetadata)
            const content = JSON.stringify(validated, null, 2)
            await persistMcpNote({ path, content, metadata: nextMetadata, previousContent })

            const editUrl = `${origin}/${path}`
            const shareSlug = nextMetadata.share && (nextMetadata.shareSlug || nextMetadata.shareId)
            const shareUrl = shareSlug ? `${origin}/share/${shareSlug}` : null
            return {
                isError: false,
                text: JSON.stringify({
                    message: 'Canvas saved successfully',
                    path,
                    editUrl,
                    shareUrl,
                    vaultMode: nextMetadata.shareMode || 'standard',
                    expiresAt: nextMetadata.shareExpiresAt ? dayjs.unix(nextMetadata.shareExpiresAt).toISOString() : undefined,
                    unlockAt: nextMetadata.shareUnlockAt ? dayjs.unix(nextMetadata.shareUnlockAt).toISOString() : undefined,
                    pulseDueAt: nextMetadata.sharePulseDueAt ? dayjs.unix(nextMetadata.sharePulseDueAt).toISOString() : undefined,
                    pulseWebhookUrl: (nextMetadata.shareMode === 'deadman' && shareSlug && nextMetadata.sharePulseToken)
                        ? `${origin}/api/shares/${shareSlug}/pulse?token=${nextMetadata.sharePulseToken}`
                        : undefined,
                    nodeCount: validated.nodes.length,
                    edgeCount: validated.edges.length,
                    document: validated,
                }, null, 2),
            }
        }

        case 'read_canvas': {
            const path = String(args.path || '').trim()
            if (!path) return { isError: true, text: 'Error: "path" parameter is required.' }
            const { value, metadata } = await driverQueryNote(path)
            if (!value && (!metadata || Object.keys(metadata).length === 0)) return { isError: true, text: `Error: Canvas "${path}" not found.` }
            if (metadata.pw || metadata.vpw) {
                const role = await checkPasswordRole(args.password || '', metadata)
                if (!role) return { isError: true, text: `Error: Password required for Canvas "${path}".` }
            }
            try {
                const document = validateCanvasDocument(parseCanvasDocument(value, { allowFallback: false }))
                const shareSlug = metadata.share && (metadata.shareSlug || metadata.shareId)
                const shareUrl = shareSlug ? `${origin}/share/${shareSlug}` : null
                return {
                    isError: false,
                    text: JSON.stringify({ path, shareUrl, nodeCount: document.nodes.length, edgeCount: document.edges.length, document }, null, 2),
                }
            } catch (error) {
                return { isError: true, text: `Stored note is not valid Canvas JSON: ${error.message}` }
            }
        }

        case 'validate_whiteboard': {
            try {
                const document = args.document && typeof args.document === 'object' ? args.document : null
                const parsed = parseWhiteboardDocument(JSON.stringify(document))
                validateWhiteboardDocument(parsed)
                return {
                    isError: false,
                    text: JSON.stringify({
                        valid: true,
                        elementCount: (parsed.elements || []).length,
                        markdownSummary: whiteboardToMarkdown(parsed),
                    }, null, 2),
                }
            } catch (error) {
                return { isError: true, text: `Invalid Whiteboard document: ${error.message}` }
            }
        }

        case 'write_whiteboard': {
            const path = String(args.path || '').trim()
            const document = args.document && typeof args.document === 'object' ? args.document : null
            if (!path) return { isError: true, text: 'Error: "path" parameter is required.' }

            let validated
            try {
                const parsed = parseWhiteboardDocument(JSON.stringify(document))
                validateWhiteboardDocument(parsed)
                validated = parsed
            } catch (error) {
                return { isError: true, text: `Invalid Whiteboard document: ${error.message}` }
            }

            const { value: previousContent, metadata: previousMetadata } = await driverQueryNote(path)
            const metadata = previousMetadata || {}
            if (metadata.pw || metadata.vpw) {
                const role = await checkPasswordRole(args.password || '', metadata)
                if (role !== 'edit') return { isError: true, text: `Error: Edit password required for Whiteboard "${path}".` }
            }

            let nextMetadata = {
                ...metadata,
                editorFormat: 'whiteboard',
                updateAt: dayjs().unix(),
                share: args.make_private !== true,
                theme: args.theme || metadata.theme || 'claude-canvas',
                width: normalizePreviewWidth(args.width, metadata.width || DEFAULT_PREVIEW_WIDTH) || DEFAULT_PREVIEW_WIDTH,
            }

            if (args.password) nextMetadata.pw = await saltPassword(args.password)
            if (args.view_password) nextMetadata.vpw = await saltPassword(args.view_password)
            if (nextMetadata.share === true && metadata.share !== true) nextMetadata.annotationsEnabled = true
            if (nextMetadata.share === false) {
                nextMetadata.publicIndex = false
                nextMetadata.annotationsEnabled = false
            }
            if (!canPersistNoteContent(nextMetadata)) {
                return { isError: true, text: 'Error: Whiteboard saving is currently blocked by server policy.' }
            }
            nextMetadata = applyVaultMetadata(nextMetadata, args)
            nextMetadata = await ensureMcpShareMetadata(path, nextMetadata)
            const content = JSON.stringify(validated, null, 2)
            await persistMcpNote({ path, content, metadata: nextMetadata, previousContent })

            const editUrl = `${origin}/${path}`
            const shareSlug = nextMetadata.share && (nextMetadata.shareSlug || nextMetadata.shareId)
            const shareUrl = shareSlug ? `${origin}/share/${shareSlug}` : null
            return {
                isError: false,
                text: JSON.stringify({
                    message: 'Whiteboard saved successfully',
                    path,
                    editUrl,
                    shareUrl,
                    vaultMode: nextMetadata.shareMode || 'standard',
                    expiresAt: nextMetadata.shareExpiresAt ? dayjs.unix(nextMetadata.shareExpiresAt).toISOString() : undefined,
                    unlockAt: nextMetadata.shareUnlockAt ? dayjs.unix(nextMetadata.shareUnlockAt).toISOString() : undefined,
                    pulseDueAt: nextMetadata.sharePulseDueAt ? dayjs.unix(nextMetadata.sharePulseDueAt).toISOString() : undefined,
                    pulseWebhookUrl: (nextMetadata.shareMode === 'deadman' && shareSlug && nextMetadata.sharePulseToken)
                        ? `${origin}/api/shares/${shareSlug}/pulse?token=${nextMetadata.sharePulseToken}`
                        : undefined,
                    elementCount: (validated.elements || []).length,
                }, null, 2),
            }
        }

        case 'read_whiteboard': {
            const path = String(args.path || '').trim()
            if (!path) return { isError: true, text: 'Error: "path" parameter is required.' }
            const { value, metadata } = await driverQueryNote(path)
            if (!value && (!metadata || Object.keys(metadata).length === 0)) {
                return { isError: true, text: `Error: Whiteboard "${path}" not found.` }
            }
            if (metadata.pw || metadata.vpw) {
                const role = await checkPasswordRole(args.password || '', metadata)
                if (!role) return { isError: true, text: `Error: Password required to access protected Whiteboard "${path}".` }
            }
            let parsedDoc
            try {
                parsedDoc = parseWhiteboardDocument(value)
            } catch (e) {
                parsedDoc = { elements: [] }
            }
            const shareSlug = metadata.share && (metadata.shareSlug || metadata.shareId)
            const shareUrl = shareSlug ? `${origin}/share/${shareSlug}` : null
            return {
                isError: false,
                text: JSON.stringify({
                    path,
                    shareUrl,
                    elementCount: (parsedDoc.elements || []).length,
                    markdownSummary: whiteboardToMarkdown(parsedDoc),
                    document: parsedDoc,
                }, null, 2),
            }
        }

        case 'write_note': {
            const path = String(args.path || '').trim()
            const text = typeof args.text === 'string' ? args.text : ''
            if (!path) {
                return { isError: true, text: 'Error: "path" parameter is required.' }
            }

            const { value: prevValue, metadata: prevMeta } = await driverQueryNote(path)
            const metadata = prevMeta || {}

            // Check edit permission if note has an existing lock
            if (metadata.pw || metadata.vpw) {
                const password = args.password || ''
                const role = await checkPasswordRole(password, metadata)
                if (role !== 'edit') {
                    return {
                        isError: true,
                        text: `Error: Edit password required to modify note "${path}". Please provide a valid "password" argument.`,
                    }
                }
            }

            let nextMetadata = {
                ...metadata,
                updateAt: dayjs().unix(),
                share: args.make_private !== true,
                theme: args.theme || metadata.theme || 'claude-canvas',
                width: normalizePreviewWidth(args.width, metadata.width || DEFAULT_PREVIEW_WIDTH) || DEFAULT_PREVIEW_WIDTH,
            }

            if (args.password) {
                nextMetadata.pw = await saltPassword(args.password)
            }
            if (args.view_password) {
                nextMetadata.vpw = await saltPassword(args.view_password)
            }

            if (nextMetadata.share === true && metadata.share !== true) {
                nextMetadata.annotationsEnabled = true
            }
            if (nextMetadata.share === false) {
                nextMetadata.publicIndex = false
                nextMetadata.annotationsEnabled = false
            }

            nextMetadata = applyVaultMetadata(nextMetadata, args)
            nextMetadata = await ensureMcpShareMetadata(path, nextMetadata)

            if (!canPersistNoteContent(nextMetadata)) {
                return { isError: true, text: 'Error: Note saving is currently blocked by server policy.' }
            }

            await persistMcpNote({
                path,
                content: text,
                metadata: nextMetadata,
                previousContent: prevValue,
            })

            const editUrl = `${origin}/${path}`
            const shareSlug = nextMetadata.share && (nextMetadata.shareSlug || nextMetadata.shareId)
            const shareUrl = shareSlug ? `${origin}/share/${shareSlug}` : null
            const hasSlideDividers = /(?:^|\n)(?:---|--)\s*(?:\n|$)/.test(text)
            const hasChapterLinks = /(?:^|\n)\s*(?:[-*+]|\d+\.)\s*\[.+?\]\((?:https?:\/\/|\/|\w).+?\)/.test(text)

            let resText = `Successfully saved note "${path}"!\n`
            if (shareUrl) {
                resText += `Public Share URL: ${shareUrl} (Give this link to readers)\n`
                if (nextMetadata.shareMode === 'burn_after_reading' || nextMetadata.shareBurnAfterReading) {
                    resText += `Vault Mode: 🔥 Burn-After-Reading (Single-use ephemeral link)\n`
                } else if (nextMetadata.shareMode === 'timelock' && nextMetadata.shareUnlockAt) {
                    resText += `Vault Mode: ⏳ Time-Locked Capsule (Locked until ${dayjs.unix(nextMetadata.shareUnlockAt).toISOString()})\n`
                } else if (nextMetadata.shareMode === 'deadman' && nextMetadata.sharePulseDueAt) {
                    resText += `Vault Mode: 💓 Dead Man's Switch (Pulse due before ${dayjs.unix(nextMetadata.sharePulseDueAt).toISOString()})\n`
                    if (nextMetadata.sharePulseToken) {
                        resText += `Pulse Webhook URL: ${origin}/api/shares/${shareSlug}/pulse?token=${nextMetadata.sharePulseToken}\n`
                    }
                } else if (nextMetadata.shareExpiresAt) {
                    resText += `Vault Expiration: ⏱️ Expires at ${dayjs.unix(nextMetadata.shareExpiresAt).toISOString()}\n`
                }
                if (hasChapterLinks) {
                    resText += `Book Mode: ${shareUrl}/book (Dual-pane TOC eBook)\n`
                }
                if (hasSlideDividers) {
                    resText += `Presentation Mode: ${shareUrl}/present (2D Slide Deck)\n`
                }
            }
            resText += `Edit URL: ${editUrl}`

            return { isError: false, text: resText }
        }

        case 'append_note': {
            const path = String(args.path || '').trim()
            const text = typeof args.text === 'string' ? args.text : ''
            if (!path) {
                return { isError: true, text: 'Error: "path" parameter is required.' }
            }
            if (!text) {
                return { isError: true, text: 'Error: "text" parameter is required.' }
            }

            const { value: prevValue, metadata: prevMeta } = await driverQueryNote(path)
            const metadata = prevMeta || {}

            if (metadata.pw || metadata.vpw) {
                const password = args.password || ''
                const role = await checkPasswordRole(password, metadata)
                if (role !== 'edit') {
                    return {
                        isError: true,
                        text: `Error: Edit password required to append to note "${path}".`,
                    }
                }
            }

            const newContent = prevValue ? `${prevValue}\n\n${text}` : text
            let nextMetadata = {
                ...metadata,
                updateAt: dayjs().unix(),
                share: metadata.share === undefined ? true : Boolean(metadata.share),
            }
            nextMetadata = await ensureMcpShareMetadata(path, nextMetadata)

            if (!canPersistNoteContent(nextMetadata)) {
                return { isError: true, text: 'Error: Note saving is currently blocked by server policy.' }
            }

            await persistMcpNote({
                path,
                content: newContent,
                metadata: nextMetadata,
                previousContent: prevValue,
            })

            const shareSlug = nextMetadata.share && (nextMetadata.shareSlug || nextMetadata.shareId)
            const shareUrl = shareSlug ? `${origin}/share/${shareSlug}` : null
            let resText = `Successfully appended to note "${path}".\n`
            if (shareUrl) {
                resText += `Share URL: ${shareUrl}`
            }
            return { isError: false, text: resText }
        }

        case 'render_markdown': {
            const markdown = typeof args.markdown === 'string' ? args.markdown : ''
            const theme = args.theme || 'claude-canvas'
            const title = args.title || 'Document'
            const rendered = renderMarkdownToHtml(markdown, { theme, title, fullHtml: false })
            const html = typeof rendered === 'string' ? rendered : (rendered?.html || '')
            return { isError: false, text: html }
        }

        case 'lint_markdown': {
            const markdown = typeof args.markdown === 'string' ? args.markdown : ''
            const result = lintMarkdownText(markdown)
            return { isError: false, text: JSON.stringify(result, null, 2) }
        }

        case 'extract_markdown_meta': {
            const markdown = typeof args.markdown === 'string' ? args.markdown : ''
            const data = extractMarkdownData(markdown)
            return { isError: false, text: JSON.stringify(data, null, 2) }
        }

        case 'get_view_stats': {
            const path = String(args.path || '').trim()
            if (!path) {
                return { isError: true, text: 'Error: "path" parameter is required.' }
            }
            const db = getNoteStatsDb()
            const viewCount = await getNoteViewCount(db, path)
            return {
                isError: false,
                text: JSON.stringify({ path, uniqueViews: viewCount }, null, 2),
            }
        }

        case 'export_pdf': {
            const markdown = typeof args.markdown === 'string' ? args.markdown : ''
            if (!markdown) {
                return { isError: true, text: 'Error: "markdown" parameter is required.' }
            }
            const title = args.title || 'Document'
            const size = args.size || 'a4'
            const landscape = Boolean(args.landscape)
            const theme = args.theme || 'claude-canvas'

            const pdfBytes = await renderMarkdownToPdf(markdown, {
                title,
                size,
                landscape,
                theme,
                siteUrl: origin,
            })

            const renderEndpoint = `${origin}/api/pdf/export`
            return {
                isError: false,
                text: JSON.stringify({
                    success: true,
                    title,
                    size,
                    landscape,
                    byteLength: pdfBytes.length,
                    renderEndpoint,
                    renderMethod: 'POST',
                    message: 'Vector PDF rendered successfully with Takumi-PDF engine. POST markdown/html JSON to renderEndpoint to stream PDF bytes.',
                }, null, 2),
            }
        }

        case 'get_api_catalog': {
            const catalog = {
                name: 'David888 Wiki (Cloud Notepad)',
                mcpEndpoint: `${origin}/mcp`,
                skillDoc: `${origin}/.well-known/agent-skills/david888-wiki-publisher/SKILL.md`,
                llmsTxt: `${origin}/llms.txt`,
                llmsFullTxt: `${origin}/llms-full.txt`,
                apiDocs: `${origin}/api-docs.md`,
                rfc9727Catalog: `${origin}/.well-known/api-catalog`,
                openapi: `${origin}/openapi.json`,
            }
            return { isError: false, text: JSON.stringify(catalog, null, 2) }
        }

        default:
            return { isError: true, text: `Unknown tool: "${name}"` }
    }
}

/**
 * Handle MCP Request over HTTP (JSON-RPC 2.0)
 * Supports:
 *  - OPTIONS: CORS Preflight
 *  - GET / HEAD: Server Metadata and Tools info
 *  - POST: JSON-RPC 2.0 (initialize, tools/list, tools/call, ping, etc.)
 */
export async function handleMcpRequest(request) {
    const method = request.method.toUpperCase()

    if (method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: CORS_HEADERS,
        })
    }

    const requestUrl = new URL(request.url)

    if (method === 'GET' || method === 'HEAD') {
        const info = {
            ...MCP_SERVER_INFO,
            endpoints: {
                mcp: `${requestUrl.origin}/mcp`,
                api: `${requestUrl.origin}/api`,
                skill: `${requestUrl.origin}/.well-known/agent-skills/david888-wiki-publisher/SKILL.md`,
                llms: `${requestUrl.origin}/llms.txt`,
            },
            tools: MCP_TOOLS_DEFINITIONS,
        }
        return createJsonResponse(info)
    }

    if (method !== 'POST') {
        return createJsonResponse({ error: 'Method Not Allowed' }, 405)
    }

    let rpc
    try {
        rpc = await request.json()
    } catch {
        return createJsonResponse({
            jsonrpc: '2.0',
            id: null,
            error: {
                code: -32700,
                message: 'Parse error: Invalid JSON payload.',
            },
        }, 400)
    }

    const isBatch = Array.isArray(rpc)
    if (isBatch && rpc.length > 20) {
        return createJsonResponse({
            jsonrpc: '2.0',
            id: null,
            error: {
                code: -32600,
                message: 'Invalid Request: Batch size exceeds limit of 20.',
            },
        }, 400)
    }
    const requests = isBatch ? rpc : [rpc]

    const responses = await Promise.all(requests.map(async (req) => {
        if (!req || typeof req !== 'object') {
            return {
                jsonrpc: '2.0',
                id: null,
                error: { code: -32600, message: 'Invalid Request' },
            }
        }

        const id = req.id !== undefined ? req.id : null
        const rpcMethod = req.method

        if (typeof rpcMethod !== 'string') {
            return {
                jsonrpc: '2.0',
                id,
                error: { code: -32600, message: 'Invalid Request: "method" must be a string.' },
            }
        }

        switch (rpcMethod) {
            case 'initialize': {
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        protocolVersion: MCP_SERVER_INFO.protocolVersion,
                        capabilities: {
                            tools: {
                                listChanged: false,
                            },
                            prompts: {},
                            resources: {},
                            logging: {},
                        },
                        serverInfo: {
                            name: MCP_SERVER_INFO.name,
                            version: MCP_SERVER_INFO.version,
                        },
                    },
                }
            }

            case 'notifications/initialized':
            case 'initialized': {
                return id !== null ? { jsonrpc: '2.0', id, result: {} } : null
            }

            case 'ping': {
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {},
                }
            }

            case 'tools/list': {
                return {
                    jsonrpc: '2.0',
                    id,
                    result: {
                        tools: MCP_TOOLS_DEFINITIONS,
                    },
                }
            }

            case 'tools/call': {
                const params = req.params || {}
                const toolName = params.name
                const toolArgs = params.arguments || {}

                if (!toolName) {
                    return {
                        jsonrpc: '2.0',
                        id,
                        error: {
                            code: -32602,
                            message: 'Invalid params: "name" is required for tools/call.',
                        },
                    }
                }

                try {
                    const result = await executeMcpTool(toolName, toolArgs, requestUrl)
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [
                                {
                                    type: 'text',
                                    text: result.text,
                                },
                            ],
                            isError: result.isError === true,
                        },
                    }
                } catch (err) {
                    return {
                        jsonrpc: '2.0',
                        id,
                        result: {
                            content: [
                                {
                                    type: 'text',
                                    text: `Execution error: ${err?.message || err}`,
                                },
                            ],
                            isError: true,
                        },
                    }
                }
            }

            default: {
                return {
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32601,
                        message: `Method not found: "${rpcMethod}"`,
                    },
                }
            }
        }
    }))

    const validResponses = responses.filter(Boolean)
    if (validResponses.length === 0) {
        return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    return createJsonResponse(isBatch ? validResponses : validResponses[0])
}
