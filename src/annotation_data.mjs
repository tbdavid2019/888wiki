const DEFAULT_ANNOTATION_PAGE_SIZE = 20
const MAX_ANNOTATION_PAGE_SIZE = 25
const MAX_ANNOTATION_MESSAGES_PER_THREAD = 50
const MAX_ANNOTATION_AUTHOR_LENGTH = 40
const MAX_ANNOTATION_BODY_LENGTH = 2000
const MAX_ANNOTATION_QUOTE_LENGTH = 1000
const MAX_ANNOTATION_CONTEXT_LENGTH = 160

export function getAnnotationDb(env = globalThis) {
    const source = env ?? globalThis
    return source?.APP_DB || source?.NOTE_HISTORY_DB || null
}

const ANNOTATION_THREAD_META_VERIFIED = new WeakSet()
const ACCOUNT_ANNOTATION_LINKS_VERIFIED = new WeakSet()

async function hasTable(db, cacheSet, tableName) {
    if (!db || typeof db.prepare !== 'function') return false
    if (cacheSet.has(db)) return true
    try {
        const row = await db.prepare(
            'SELECT name FROM sqlite_master WHERE type = \'table\' AND name = ? LIMIT 1'
        ).bind(tableName).first()
        if (row?.name === tableName) {
            cacheSet.add(db)
            return true
        }
    } catch {}
    return false
}

async function hasAnnotationThreadMetaTable(db) {
    return hasTable(db, ANNOTATION_THREAD_META_VERIFIED, 'annotation_thread_meta')
}

async function hasAccountAnnotationLinksTable(db) {
    return hasTable(db, ACCOUNT_ANNOTATION_LINKS_VERIFIED, 'account_annotation_links')
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

function normalizeSignedAccount(signedAccount) {
    if (!signedAccount || typeof signedAccount !== 'object') return null
    const accountId = typeof signedAccount.accountId === 'string' ? signedAccount.accountId.trim() : ''
    const nickname = typeof signedAccount.nickname === 'string' ? signedAccount.nickname.trim() : ''
    if (!accountId || nickname.length < 1 || nickname.length > MAX_ANNOTATION_AUTHOR_LENGTH) {
        return null
    }
    return { accountId, nickname }
}

function normalizeNoteUid(noteUid) {
    return typeof noteUid === 'string' && noteUid.trim() ? noteUid.trim() : null
}

function presentMessage(row, { viewerAccountId = null, isAuthor = false } = {}) {
    const linkedAccountId = typeof row.account_id === 'string' && row.account_id ? row.account_id : null
    const isSignedAccount = Boolean(row.is_signed_account ?? row.isSignedAccount ?? linkedAccountId)
    const canDelete = Boolean(
        isAuthor
        || row.canDelete
        || (viewerAccountId && linkedAccountId && linkedAccountId === viewerAccountId)
    )
    return {
        id: row.id,
        authorName: row.author_name ?? row.authorName,
        body: row.body,
        createdAt: Number(row.created_at ?? row.createdAt ?? 0),
        isSignedAccount,
        canDelete,
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

function normalizeAnnotationMessageInput(input, { signedAccount = null } = {}) {
    let authorName = typeof input?.authorName === 'string' ? input.authorName.trim() : ''
    if (signedAccount != null) {
        const account = normalizeSignedAccount(signedAccount)
        if (!account) return null
        authorName = account.nickname
    }
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

export function validateAnnotationMessage(input, options = {}) {
    return normalizeAnnotationMessageInput(input, options)
}

export function validateAnnotationDraft(input, options = {}) {
    const message = normalizeAnnotationMessageInput(input, options)
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

async function resolveMetaIsolation(db, path, { noteUid = null, requireNoteUid = false, excludeUidTagged = false } = {}) {
    const normalizedNoteUid = normalizeNoteUid(noteUid)
    if (requireNoteUid && !normalizedNoteUid) {
        return { ok: false, metaClause: '', extraBindings: [], hasMeta: false }
    }
    if (!requireNoteUid && !normalizedNoteUid && !excludeUidTagged) {
        return { ok: true, metaClause: '', extraBindings: [], hasMeta: null }
    }

    const hasMeta = await hasAnnotationThreadMetaTable(db)
    if (requireNoteUid || normalizedNoteUid) {
        if (!hasMeta) {
            return { ok: false, metaClause: '', extraBindings: [], hasMeta: false }
        }
        return {
            ok: true,
            hasMeta: true,
            metaClause: `
              AND EXISTS (
                  SELECT 1 FROM annotation_thread_meta tm
                  WHERE tm.thread_id = annotation_threads.id
                    AND tm.path = ?
                    AND tm.note_uid = ?
              )`,
            extraBindings: [path, normalizedNoteUid],
        }
    }

    if (excludeUidTagged && hasMeta) {
        return {
            ok: true,
            hasMeta: true,
            metaClause: `
              AND NOT EXISTS (
                  SELECT 1 FROM annotation_thread_meta tm
                  WHERE tm.thread_id = annotation_threads.id
                    AND tm.note_uid IS NOT NULL
              )`,
            extraBindings: [],
        }
    }

    return { ok: true, metaClause: '', extraBindings: [], hasMeta }
}

export async function createAnnotationThread(db, path, draft, {
    nowSeconds = Math.floor(Date.now() / 1000),
    createId = () => crypto.randomUUID(),
    secret = null,
    noteUid = null,
    shareId = null,
    requireNoteUid = false,
    signedAccount = null,
} = {}) {
    if (!db || typeof db.batch !== 'function' || typeof path !== 'string' || !path || !draft?.anchor) return null

    const normalizedNoteUid = normalizeNoteUid(noteUid)
    const normalizedShareId = typeof shareId === 'string' && shareId.trim() ? shareId.trim() : null
    const body = typeof draft.body === 'string' ? draft.body.trim() : ''
    if (body.length < 1 || body.length > MAX_ANNOTATION_BODY_LENGTH) return null

    let account = null
    let authorName = ''
    if (signedAccount != null) {
        account = normalizeSignedAccount(signedAccount)
        if (!account || !normalizedNoteUid) return null
        authorName = account.nickname
    } else {
        authorName = typeof draft.authorName === 'string' ? draft.authorName.trim() : ''
        if (authorName.length < 1 || authorName.length > MAX_ANNOTATION_AUTHOR_LENGTH) return null
        if (requireNoteUid && !normalizedNoteUid) return null
    }

    const hasMeta = account ? true : await hasAnnotationThreadMetaTable(db)
    if ((requireNoteUid || normalizedNoteUid) && !hasMeta) return null

    const threadId = createId()
    const messageId = createId()
    const { anchor } = draft

    const statements = [
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
    ]

    if (hasMeta) {
        statements.push(
            db.prepare(`
                INSERT OR IGNORE INTO annotation_thread_meta (
                    thread_id, path, root_message_id, note_uid, created_at
                )
                VALUES (?, ?, ?, ?, ?)
            `).bind(threadId, path, messageId, normalizedNoteUid, nowSeconds),
        )
    }

    if (account) {
        statements.push(
            db.prepare(`
                INSERT INTO account_annotation_links (
                    message_id, thread_id, account_id, note_path, note_uid, share_id, created_at
                )
                SELECT ?, ?, ?, ?, ?, ?, ?
                WHERE EXISTS (
                    SELECT 1 FROM annotation_messages
                    WHERE id = ?
                      AND thread_id = ?
                      AND deleted_at IS NULL
                )
            `).bind(
                messageId,
                threadId,
                account.accountId,
                path,
                normalizedNoteUid,
                normalizedShareId,
                nowSeconds,
                messageId,
                threadId,
            ),
        )
    }

    const results = await db.batch(statements)
    if (Number(results?.[0]?.meta?.changes ?? 0) !== 1 || Number(results?.[1]?.meta?.changes ?? 0) !== 1) {
        return null
    }
    if (account && Number(results?.[3]?.meta?.changes ?? 0) !== 1) {
        return null
    }

    const deleteToken = !account && secret ? await createAnnotationDeleteToken(messageId, secret) : ''
    const message = {
        ...presentMessage({
            id: messageId,
            author_name: authorName,
            body,
            created_at: nowSeconds,
            account_id: account ? account.accountId : null,
        }, {
            viewerAccountId: account ? account.accountId : null,
        }),
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
    noteUid = null,
    shareId = null,
    requireNoteUid = false,
    excludeUidTagged = false,
    signedAccount = null,
} = {}) {
    if (signedAccount != null && !normalizeNoteUid(noteUid)) {
        return null
    }
    const message = normalizeAnnotationMessageInput(input, { signedAccount })
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

    const account = signedAccount != null ? normalizeSignedAccount(signedAccount) : null
    if (signedAccount != null && !account) return null

    const normalizedNoteUid = normalizeNoteUid(noteUid)
    const normalizedShareId = typeof shareId === 'string' && shareId.trim() ? shareId.trim() : null
    const isolation = await resolveMetaIsolation(db, path, {
        noteUid: normalizedNoteUid,
        requireNoteUid: requireNoteUid || Boolean(account),
        excludeUidTagged,
    })
    if (!isolation.ok) return null

    const messageId = createId()
    const statements = [
        db.prepare(`
            INSERT INTO annotation_messages (id, thread_id, author_name, body, created_at)
            SELECT ?, id, ?, ?, ?
            FROM annotation_threads
            WHERE id = ?
              AND path = ?
              AND is_resolved = 0
              AND EXISTS (
                  SELECT 1 FROM annotation_messages m
                  WHERE m.thread_id = annotation_threads.id
                    AND m.deleted_at IS NULL
              )
              ${isolation.metaClause}
        `).bind(
            messageId,
            message.authorName,
            message.body,
            nowSeconds,
            threadId,
            path,
            ...isolation.extraBindings,
        ),
        db.prepare(`
            UPDATE annotation_threads
            SET updated_at = ?
            WHERE id = ?
              AND path = ?
              AND changes() = 1
        `).bind(nowSeconds, threadId, path),
    ]

    if (account) {
        statements.push(
            db.prepare(`
                INSERT INTO account_annotation_links (
                    message_id, thread_id, account_id, note_path, note_uid, share_id, created_at
                )
                SELECT ?, ?, ?, ?, ?, ?, ?
                WHERE EXISTS (
                    SELECT 1 FROM annotation_messages m
                    JOIN annotation_threads t ON t.id = m.thread_id
                    WHERE m.id = ?
                      AND m.thread_id = ?
                      AND t.path = ?
                      AND t.is_resolved = 0
                      AND m.deleted_at IS NULL
                )
            `).bind(
                messageId,
                threadId,
                account.accountId,
                path,
                normalizedNoteUid,
                normalizedShareId,
                nowSeconds,
                messageId,
                threadId,
                path,
            ),
        )
    }

    const results = await db.batch(statements)
    if (Number(results?.[0]?.meta?.changes ?? 0) !== 1) return null
    if (account && Number(results?.[2]?.meta?.changes ?? 0) !== 1) return null

    const deleteToken = !account && secret ? await createAnnotationDeleteToken(messageId, secret) : ''
    return {
        ...presentMessage({
            id: messageId,
            author_name: message.authorName,
            body: message.body,
            created_at: nowSeconds,
            account_id: account ? account.accountId : null,
        }, {
            viewerAccountId: account ? account.accountId : null,
        }),
        ...(deleteToken ? { deleteToken } : {}),
    }
}

export async function deleteAnnotationMessage(db, path, threadId, messageId, {
    nowSeconds = Math.floor(Date.now() / 1000),
    noteUid = null,
    requireNoteUid = false,
    excludeUidTagged = false,
    signedAccountId = null,
    isAuthor = false,
    hasDeleteToken = false,
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

    if (signedAccountId != null && (typeof signedAccountId !== 'string' || !signedAccountId.trim())) {
        return null
    }
    const normalizedSignedAccountId = typeof signedAccountId === 'string' ? signedAccountId.trim() : null
    const useSignedOwnership = Boolean(normalizedSignedAccountId && !isAuthor && !hasDeleteToken)

    const normalizedNoteUid = normalizeNoteUid(noteUid)
    const isolation = await resolveMetaIsolation(db, path, {
        noteUid: normalizedNoteUid,
        requireNoteUid,
        excludeUidTagged,
    })
    if (!isolation.ok) return null

    const hasLinks = useSignedOwnership ? await hasAccountAnnotationLinksTable(db) : await hasAccountAnnotationLinksTable(db)
    if (useSignedOwnership && !hasLinks) return null

    let signedOwnershipClause = ''
    const ownershipBindings = []
    if (useSignedOwnership) {
        signedOwnershipClause = `
              AND EXISTS (
                  SELECT 1 FROM account_annotation_links l
                  WHERE l.message_id = annotation_messages.id
                    AND l.thread_id = annotation_messages.thread_id
                    AND l.account_id = ?
                    ${normalizedNoteUid ? 'AND l.note_uid = ?' : ''}
              )`
        ownershipBindings.push(normalizedSignedAccountId)
        if (normalizedNoteUid) ownershipBindings.push(normalizedNoteUid)
    }

    const statements = [
        db.prepare(`
            UPDATE annotation_messages
            SET deleted_at = ?
            WHERE id = ?
              AND thread_id = ?
              AND deleted_at IS NULL
              AND EXISTS (
                  SELECT 1 FROM annotation_threads
                  WHERE id = ? AND path = ?
                  ${isolation.metaClause}
              )
              ${signedOwnershipClause}
        `).bind(nowSeconds, messageId, threadId, threadId, path, ...isolation.extraBindings, ...ownershipBindings),
        db.prepare(`
            SELECT COUNT(*) AS active_count
            FROM annotation_messages
            WHERE thread_id = ?
              AND deleted_at IS NULL
        `).bind(threadId),
    ]

    if (hasLinks) {
        statements.push(
            db.prepare(`
                DELETE FROM account_annotation_links
                WHERE message_id = ?
                  AND thread_id = ?
                  ${useSignedOwnership ? 'AND account_id = ?' : ''}
                  AND EXISTS (
                      SELECT 1 FROM annotation_messages m
                      WHERE m.id = account_annotation_links.message_id
                        AND m.thread_id = account_annotation_links.thread_id
                        AND m.deleted_at = ?
                  )
            `).bind(
                messageId,
                threadId,
                ...(useSignedOwnership ? [normalizedSignedAccountId] : []),
                nowSeconds,
            ),
        )
    }

    const results = await db.batch(statements)
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

export async function deleteAccountAnnotationMessageByAccount(db, accountId, messageId, {
    nowSeconds = Math.floor(Date.now() / 1000),
} = {}) {
    const normalizedAccountId = typeof accountId === 'string' ? accountId.trim() : ''
    const normalizedMessageId = typeof messageId === 'string' ? messageId.trim() : ''
    if (!db || typeof db.batch !== 'function' || !normalizedAccountId || !normalizedMessageId) {
        return { deleted: false }
    }

    const hasLinks = await hasAccountAnnotationLinksTable(db)
    if (!hasLinks) return { deleted: false }

    const results = await db.batch([
        db.prepare(`
            UPDATE annotation_messages
            SET deleted_at = ?
            WHERE id = ?
              AND deleted_at IS NULL
              AND EXISTS (
                  SELECT 1 FROM account_annotation_links l
                  WHERE l.message_id = annotation_messages.id
                    AND l.thread_id = annotation_messages.thread_id
                    AND l.account_id = ?
              )
        `).bind(nowSeconds, normalizedMessageId, normalizedAccountId),
        db.prepare(`
            DELETE FROM account_annotation_links
            WHERE message_id = ?
              AND account_id = ?
              AND EXISTS (
                  SELECT 1 FROM annotation_messages m
                  WHERE m.id = account_annotation_links.message_id
                    AND m.thread_id = account_annotation_links.thread_id
                    AND m.deleted_at = ?
              )
        `).bind(normalizedMessageId, normalizedAccountId, nowSeconds),
    ])

    if (Number(results?.[0]?.meta?.changes ?? 0) !== 1) {
        return { deleted: false }
    }
    return {
        deleted: true,
        messageId: normalizedMessageId,
    }
}

export async function deleteAnnotationThread(db, path, threadId, {
    nowSeconds = Math.floor(Date.now() / 1000),
    noteUid = null,
    requireNoteUid = false,
    excludeUidTagged = false,
    isAuthor = undefined,
    deleteToken = undefined,
    rootMessageId = undefined,
    secret = null,
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

    const normalizedNoteUid = normalizeNoteUid(noteUid)
    const isolation = await resolveMetaIsolation(db, path, {
        noteUid: normalizedNoteUid,
        requireNoteUid,
        excludeUidTagged,
    })
    if (!isolation.ok) return null

    const hasLinks = await hasAccountAnnotationLinksTable(db)
    const isLegacyInternalCall = isAuthor === undefined
        && rootMessageId === undefined
        && deleteToken === undefined
        && !requireNoteUid

    let anonymousGuardClause = ''
    const anonymousBindings = []

    if (isAuthor !== true && !isLegacyInternalCall) {
        const normalizedRootId = typeof rootMessageId === 'string' ? rootMessageId.trim() : ''
        if (!normalizedRootId) return null

        if (secret && (!deleteToken || !(await verifyAnnotationDeleteToken(normalizedRootId, deleteToken, secret)))) {
            return null
        }

        const hasMeta = isolation.hasMeta !== null
            ? Boolean(isolation.hasMeta)
            : await hasAnnotationThreadMetaTable(db)

        if (requireNoteUid && !hasMeta) return null

        let metaRow = null
        if (hasMeta && typeof db.prepare === 'function') {
            try {
                metaRow = await db.prepare(`
                    SELECT root_message_id, note_uid
                    FROM annotation_thread_meta
                    WHERE thread_id = ? AND path = ?
                    LIMIT 1
                `).bind(threadId, path).first()
            } catch {
                if (requireNoteUid) return null
            }
        }

        if (metaRow) {
            if (metaRow.root_message_id !== normalizedRootId) return null
            if (requireNoteUid && metaRow.note_uid !== normalizedNoteUid) return null
            if (normalizedNoteUid && metaRow.note_uid !== normalizedNoteUid) return null
            if (excludeUidTagged && metaRow.note_uid !== null) return null

            anonymousGuardClause = `
              AND EXISTS (
                  SELECT 1 FROM annotation_thread_meta tm
                  WHERE tm.thread_id = annotation_messages.thread_id
                    AND tm.path = ?
                    AND tm.root_message_id = ?
                    ${requireNoteUid || normalizedNoteUid ? 'AND tm.note_uid = ?' : ''}
              )`
            anonymousBindings.push(path, normalizedRootId)
            if (requireNoteUid || normalizedNoteUid) anonymousBindings.push(normalizedNoteUid)
        } else {
            if (requireNoteUid) return null
            if (hasMeta) {
                anonymousGuardClause += `
              AND NOT EXISTS (
                  SELECT 1 FROM annotation_thread_meta tm
                  WHERE tm.thread_id = annotation_messages.thread_id
              )`
            }
            anonymousGuardClause += `
              AND EXISTS (
                  SELECT 1 FROM (
                      SELECT id FROM annotation_messages m_root
                      WHERE m_root.thread_id = ?
                        AND m_root.deleted_at IS NULL
                      ORDER BY m_root.created_at ASC, m_root.id ASC
                      LIMIT 1
                  ) root
                  WHERE root.id = ?
              )`
            anonymousBindings.push(threadId, normalizedRootId)
        }

        if (hasLinks) {
            anonymousGuardClause += `
              AND NOT EXISTS (
                  SELECT 1 FROM account_annotation_links l
                  WHERE l.message_id = ?
              )`
            anonymousBindings.push(normalizedRootId)
        }
    }

    const statements = [
        db.prepare(`
            UPDATE annotation_messages
            SET deleted_at = ?
            WHERE thread_id = ?
              AND deleted_at IS NULL
              AND EXISTS (
                  SELECT 1 FROM annotation_threads
                  WHERE id = ? AND path = ?
                  ${isolation.metaClause}
              )
              ${anonymousGuardClause}
        `).bind(nowSeconds, threadId, threadId, path, ...isolation.extraBindings, ...anonymousBindings),
    ]

    if (hasLinks) {
        statements.push(
            db.prepare(`
                DELETE FROM account_annotation_links
                WHERE thread_id = ?
                  AND EXISTS (
                      SELECT 1 FROM annotation_messages m
                      WHERE m.thread_id = account_annotation_links.thread_id
                        AND m.id = account_annotation_links.message_id
                        AND m.deleted_at = ?
                  )
            `).bind(threadId, nowSeconds),
        )
    }

    const results = await db.batch(statements)
    const changes = Number(results?.[0]?.meta?.changes ?? 0)
    if (changes < 1) return null

    return {
        deleted: true,
        threadId,
        threadDeleted: true,
    }
}

export async function listAnnotationThreads(db, path, {
    cursor = null,
    limit,
    noteUid = null,
    requireNoteUid = false,
    excludeUidTagged = false,
    viewerAccountId = null,
    isAuthor = false,
} = {}) {
    if (!db || typeof path !== 'string' || !path) {
        return { threads: [], nextCursor: null }
    }

    const isolation = await resolveMetaIsolation(db, path, {
        noteUid,
        requireNoteUid,
        excludeUidTagged,
    })
    if (!isolation.ok) {
        return { threads: [], nextCursor: null }
    }

    const normalizedViewerAccountId = typeof viewerAccountId === 'string' && viewerAccountId.trim()
        ? viewerAccountId.trim()
        : null
    const hasLinks = await hasAccountAnnotationLinksTable(db)
    if (normalizedViewerAccountId && !hasLinks) {
        throw new Error('account_annotation_links table is missing')
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
          ${isolation.metaClause}
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
        ? [path, ...isolation.extraBindings, decodedCursor.updatedAt, decodedCursor.updatedAt, decodedCursor.id, pageSize + 1]
        : [path, ...isolation.extraBindings, pageSize + 1]
    const threadRows = getResults(await threadStatement.bind(...threadBindings).all())
    const pageRows = threadRows.slice(0, pageSize)

    if (pageRows.length === 0) {
        return { threads: [], nextCursor: null }
    }

    const placeholders = pageRows.map(() => '?').join(', ')
    const messageSql = hasLinks
        ? `
            SELECT
                m.id,
                m.thread_id,
                m.author_name,
                m.body,
                m.created_at,
                m.total_count,
                l.account_id
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
            ) m
            LEFT JOIN account_annotation_links l
              ON l.message_id = m.id
             AND l.thread_id = m.thread_id
            WHERE m.message_rank <= ${MAX_ANNOTATION_MESSAGES_PER_THREAD}
            ORDER BY m.thread_id ASC, m.created_at ASC, m.id ASC
        `
        : `
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
        `
    const messageRows = getResults(await db.prepare(messageSql).bind(...pageRows.map(row => row.id)).all())
    const messagesByThread = new Map(pageRows.map(row => [row.id, []]))
    const messageCountsByThread = new Map(pageRows.map(row => [row.id, 0]))

    for (const message of messageRows) {
        messagesByThread.get(message.thread_id)?.push(presentMessage(message, {
            viewerAccountId: normalizedViewerAccountId,
            isAuthor,
        }))
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
