const DEFAULT_ANNOTATION_PAGE_SIZE = 20
const MAX_ANNOTATION_PAGE_SIZE = 25
const MAX_ANNOTATION_MESSAGES_PER_THREAD = 50
const MAX_ANNOTATION_AUTHOR_LENGTH = 40
const MAX_ANNOTATION_BODY_LENGTH = 2000
const MAX_ANNOTATION_QUOTE_LENGTH = 1000
const MAX_ANNOTATION_CONTEXT_LENGTH = 160

export function getAnnotationDb() {
    return globalThis?.APP_DB || globalThis?.NOTE_HISTORY_DB || null
}

export async function computeSourceRevision(content) {
    const bytes = new TextEncoder().encode(typeof content === 'string' ? content : String(content || ''))
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function encodeAnnotationCursor({ updatedAt, id }) {
    if (!Number.isSafeInteger(updatedAt) || updatedAt < 0 || typeof id !== 'string' || !id) return null
    return btoa(`${updatedAt}:${id}`)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '')
}

export function decodeAnnotationCursor(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(value)) return null

    try {
        const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
        const decoded = atob(padded)
        const separator = decoded.indexOf(':')
        if (separator <= 0) return null

        const updatedAt = Number(decoded.slice(0, separator))
        const id = decoded.slice(separator + 1)
        if (!Number.isSafeInteger(updatedAt) || updatedAt < 0 || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) return null

        return { updatedAt, id }
    } catch {
        return null
    }
}

function getResults(result) {
    return Array.isArray(result?.results) ? result.results : []
}

function normalizeLimit(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10)
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ANNOTATION_PAGE_SIZE
    return Math.min(parsed, MAX_ANNOTATION_PAGE_SIZE)
}

function presentMessage(row) {
    return {
        id: row.id,
        authorName: row.author_name,
        body: row.body,
        createdAt: Number(row.created_at || 0),
    }
}

function presentThread(row, messages, messageCount) {
    return {
        id: row.id,
        anchor: {
            exact: row.quote_exact,
            prefix: row.quote_prefix,
            suffix: row.quote_suffix,
            startOffset: Number(row.start_offset),
            endOffset: Number(row.end_offset),
            sourceRevision: row.source_revision,
        },
        isResolved: row.is_resolved === 1,
        createdAt: Number(row.created_at || 0),
        updatedAt: Number(row.updated_at || 0),
        messageCount,
        hasMoreMessages: messageCount > messages.length,
        messages,
    }
}

function normalizeAnnotationMessageInput(input) {
    const authorName = typeof input?.authorName === 'string' ? input.authorName.trim() : ''
    const body = typeof input?.body === 'string' ? input.body.trim() : ''

    if (
        authorName.length < 1
        || authorName.length > MAX_ANNOTATION_AUTHOR_LENGTH
        || body.length < 1
        || body.length > MAX_ANNOTATION_BODY_LENGTH
    ) {
        return null
    }

    return { authorName, body }
}

export function validateAnnotationMessage(input) {
    return normalizeAnnotationMessageInput(input)
}

export function validateAnnotationDraft(input) {
    const message = normalizeAnnotationMessageInput(input)
    const anchor = input?.anchor
    if (!message || !anchor) return null

    const exact = typeof anchor.exact === 'string' ? anchor.exact : ''
    const prefix = typeof anchor.prefix === 'string' ? anchor.prefix : ''
    const suffix = typeof anchor.suffix === 'string' ? anchor.suffix : ''
    const startOffset = anchor.startOffset
    const endOffset = anchor.endOffset
    const sourceRevision = typeof anchor.sourceRevision === 'string' ? anchor.sourceRevision : ''

    if (
        exact.trim().length < 1
        || exact.length > MAX_ANNOTATION_QUOTE_LENGTH
        || prefix.length > MAX_ANNOTATION_CONTEXT_LENGTH
        || suffix.length > MAX_ANNOTATION_CONTEXT_LENGTH
        || !Number.isSafeInteger(startOffset)
        || !Number.isSafeInteger(endOffset)
        || startOffset < 0
        || endOffset <= startOffset
        || endOffset - startOffset !== exact.length
        || !/^[a-f0-9]{64}$/.test(sourceRevision)
    ) {
        return null
    }

    return {
        anchor: {
            exact,
            prefix,
            suffix,
            startOffset,
            endOffset,
            sourceRevision,
        },
        ...message,
    }
}

export async function createAnnotationDeleteToken(messageId, secret) {
    if (typeof messageId !== 'string' || !messageId) return ''
    const secretKey = typeof secret === 'string' && secret ? secret : 'cf-notepad-annotation-delete-salt'
    const keyBytes = new TextEncoder().encode(secretKey)
    const dataBytes = new TextEncoder().encode(`annotation-delete:${messageId}`)
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes)
    return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')
}

function constantTimeTokenCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return diff === 0
}

export async function verifyAnnotationDeleteToken(messageId, token, secret) {
    if (typeof messageId !== 'string' || !messageId || typeof token !== 'string' || !token) return false
    const expected = await createAnnotationDeleteToken(messageId, secret)
    return constantTimeTokenCompare(expected, token)
}

export async function createAnnotationThread(db, path, draft, {
    nowSeconds = Math.floor(Date.now() / 1000),
    createId = () => crypto.randomUUID(),
    secret = null,
} = {}) {
    if (!db || typeof db.batch !== 'function' || typeof path !== 'string' || !path || !draft?.anchor) return null

    const threadId = createId()
    const messageId = createId()
    const { anchor, authorName, body } = draft
    await db.batch([
        db.prepare(`
            INSERT INTO annotation_threads (
                id,
                path,
                quote_exact,
                quote_prefix,
                quote_suffix,
                start_offset,
                end_offset,
                source_revision,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            threadId,
            path,
            anchor.exact,
            anchor.prefix,
            anchor.suffix,
            anchor.startOffset,
            anchor.endOffset,
            anchor.sourceRevision,
            nowSeconds,
            nowSeconds,
        ),
        db.prepare(`
            INSERT INTO annotation_messages (id, thread_id, author_name, body, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).bind(messageId, threadId, authorName, body, nowSeconds),
    ])

    const deleteToken = secret ? await createAnnotationDeleteToken(messageId, secret) : ''
    const message = {
        id: messageId,
        authorName,
        body,
        createdAt: nowSeconds,
        ...(deleteToken ? { deleteToken } : {}),
    }

    return {
        id: threadId,
        anchor,
        isResolved: false,
        createdAt: nowSeconds,
        updatedAt: nowSeconds,
        messageCount: 1,
        hasMoreMessages: false,
        messages: [message],
    }
}

export async function addAnnotationMessage(db, path, threadId, input, {
    nowSeconds = Math.floor(Date.now() / 1000),
    createId = () => crypto.randomUUID(),
    secret = null,
} = {}) {
    const message = normalizeAnnotationMessageInput(input)
    if (
        !db
        || typeof db.batch !== 'function'
        || typeof path !== 'string'
        || !path
        || typeof threadId !== 'string'
        || !/^[A-Za-z0-9_-]{1,80}$/.test(threadId)
        || !message
    ) {
        return null
    }

    const messageId = createId()
    const results = await db.batch([
        db.prepare(`
            INSERT INTO annotation_messages (id, thread_id, author_name, body, created_at)
            SELECT ?, id, ?, ?, ?
            FROM annotation_threads
            WHERE id = ?
              AND path = ?
              AND is_resolved = 0
        `).bind(
            messageId,
            message.authorName,
            message.body,
            nowSeconds,
            threadId,
            path,
        ),
        db.prepare(`
            UPDATE annotation_threads
            SET updated_at = ?
            WHERE id = ?
              AND path = ?
              AND changes() = 1
        `).bind(nowSeconds, threadId, path),
    ])

    if (Number(results?.[0]?.meta?.changes ?? 0) !== 1) return null

    const deleteToken = secret ? await createAnnotationDeleteToken(messageId, secret) : ''
    return {
        id: messageId,
        authorName: message.authorName,
        body: message.body,
        createdAt: nowSeconds,
        ...(deleteToken ? { deleteToken } : {}),
    }
}

export async function deleteAnnotationMessage(db, path, threadId, messageId, {
    nowSeconds = Math.floor(Date.now() / 1000),
} = {}) {
    if (
        !db
        || typeof db.batch !== 'function'
        || typeof path !== 'string'
        || !path
        || typeof threadId !== 'string'
        || !threadId
        || typeof messageId !== 'string'
        || !messageId
    ) {
        return null
    }

    const results = await db.batch([
        db.prepare(`
            UPDATE annotation_messages
            SET deleted_at = ?
            WHERE id = ?
              AND thread_id = ?
              AND deleted_at IS NULL
              AND EXISTS (
                  SELECT 1 FROM annotation_threads
                  WHERE id = ? AND path = ?
              )
        `).bind(nowSeconds, messageId, threadId, threadId, path),
        db.prepare(`
            SELECT COUNT(*) AS active_count
            FROM annotation_messages
            WHERE thread_id = ?
              AND deleted_at IS NULL
        `).bind(threadId),
    ])

    const changes = Number(results?.[0]?.meta?.changes ?? 0)
    if (changes !== 1) return null

    const activeCount = Number(results?.[1]?.results?.[0]?.active_count ?? 0)
    return {
        deleted: true,
        messageId,
        threadId,
        activeMessageCount: activeCount,
        threadDeleted: activeCount === 0,
    }
}

export async function deleteAnnotationThread(db, path, threadId, {
    nowSeconds = Math.floor(Date.now() / 1000),
} = {}) {
    if (
        !db
        || typeof db.batch !== 'function'
        || typeof path !== 'string'
        || !path
        || typeof threadId !== 'string'
        || !threadId
    ) {
        return null
    }

    const results = await db.batch([
        db.prepare(`
            UPDATE annotation_messages
            SET deleted_at = ?
            WHERE thread_id = ?
              AND deleted_at IS NULL
              AND EXISTS (
                  SELECT 1 FROM annotation_threads
                  WHERE id = ? AND path = ?
              )
        `).bind(nowSeconds, threadId, threadId, path),
    ])

    const changes = Number(results?.[0]?.meta?.changes ?? 0)
    if (changes < 1) return null

    return {
        deleted: true,
        threadId,
        threadDeleted: true,
    }
}

export async function listAnnotationThreads(db, path, { cursor = null, limit } = {}) {
    if (!db || typeof path !== 'string' || !path) {
        return { threads: [], nextCursor: null }
    }

    const pageSize = normalizeLimit(limit)
    const decodedCursor = cursor ? decodeAnnotationCursor(cursor) : null
    if (cursor && !decodedCursor) throw new Error('Invalid annotation cursor')

    const cursorClause = decodedCursor
        ? 'AND (updated_at < ? OR (updated_at = ? AND id < ?))'
        : ''
    const threadStatement = db.prepare(`
        SELECT
            id,
            quote_exact,
            quote_prefix,
            quote_suffix,
            start_offset,
            end_offset,
            source_revision,
            is_resolved,
            created_at,
            updated_at
        FROM annotation_threads
        WHERE path = ?
          AND EXISTS (
              SELECT 1
              FROM annotation_messages m
              WHERE m.thread_id = annotation_threads.id
                AND m.deleted_at IS NULL
          )
        ${cursorClause}
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
    `)
    const threadBindings = decodedCursor
        ? [path, decodedCursor.updatedAt, decodedCursor.updatedAt, decodedCursor.id, pageSize + 1]
        : [path, pageSize + 1]
    const threadRows = getResults(await threadStatement.bind(...threadBindings).all())
    const pageRows = threadRows.slice(0, pageSize)

    if (pageRows.length === 0) {
        return { threads: [], nextCursor: null }
    }

    const placeholders = pageRows.map(() => '?').join(', ')
    const messageRows = getResults(await db.prepare(`
        SELECT id, thread_id, author_name, body, created_at, total_count
        FROM (
            SELECT
                id,
                thread_id,
                author_name,
                body,
                created_at,
                ROW_NUMBER() OVER (
                    PARTITION BY thread_id
                    ORDER BY created_at ASC, id ASC
                ) AS message_rank,
                COUNT(*) OVER (PARTITION BY thread_id) AS total_count
            FROM annotation_messages
            WHERE thread_id IN (${placeholders})
              AND deleted_at IS NULL
        )
        WHERE message_rank <= ${MAX_ANNOTATION_MESSAGES_PER_THREAD}
        ORDER BY thread_id ASC, created_at ASC, id ASC
    `).bind(...pageRows.map(row => row.id)).all())
    const messagesByThread = new Map(pageRows.map(row => [row.id, []]))
    const messageCountsByThread = new Map(pageRows.map(row => [row.id, 0]))

    for (const message of messageRows) {
        messagesByThread.get(message.thread_id)?.push(presentMessage(message))
        messageCountsByThread.set(message.thread_id, Number(message.total_count || 0))
    }

    const hasMore = threadRows.length > pageSize
    const lastRow = pageRows[pageRows.length - 1]

    const activePageRows = pageRows.filter(row => (messageCountsByThread.get(row.id) || 0) > 0)

    return {
        threads: activePageRows.map(row => {
            const messages = messagesByThread.get(row.id) || []
            const messageCount = messageCountsByThread.get(row.id) || messages.length
            return presentThread(row, messages, messageCount)
        }),
        nextCursor: hasMore
            ? encodeAnnotationCursor({ updatedAt: Number(lastRow.updated_at || 0), id: lastRow.id })
            : null,
    }
}

export {
    DEFAULT_ANNOTATION_PAGE_SIZE,
    MAX_ANNOTATION_AUTHOR_LENGTH,
    MAX_ANNOTATION_BODY_LENGTH,
    MAX_ANNOTATION_CONTEXT_LENGTH,
    MAX_ANNOTATION_MESSAGES_PER_THREAD,
    MAX_ANNOTATION_PAGE_SIZE,
    MAX_ANNOTATION_QUOTE_LENGTH,
}
