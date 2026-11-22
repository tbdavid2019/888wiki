/**
 * Pluggable Storage Driver for CF-Notepad (david888 wiki)
 * Supports:
 *  - 'kv': Cloudflare Workers KV (zero D1 requirements for notes)
 *  - 'd1': Cloudflare D1 Database (SQLite authoritative notes registry)
 *  - 'auto' / 'dual': Hybrid Migration Driver.
 *     Reads: Authoritative D1 first -> tombstone-filtered KV fallback if not yet in D1.
 *     Writes: Authoritative D1 CAS batch first -> mirrors to KV only after committed D1 changes.
 */

import { extractNoteTitle, isBurnProtected, isShareBurned, isShareExpired } from './note_meta.js'
import { getAnnotationDb } from './annotation_data.mjs'

export const ALLOWED_NOTES_DB_BINDINGS = Object.freeze(['NOTES_DB', 'NOTE_HISTORY_DB', 'DB'])
const REQUIRED_NOTES_REGISTRY_TABLES = Object.freeze(['notes', 'shares', 'note_tombstones', 'share_token_registry'])
const VERIFIED_NOTES_DBS = new WeakSet()

export class StorageAuthorityError extends Error {
    constructor(code, message) {
        super(message)
        this.name = 'StorageAuthorityError'
        this.code = code
        this.status = 503
    }
}

export class StorageConflictError extends Error {
    constructor(message = 'Concurrent note modification conflict') {
        super(message)
        this.name = 'StorageConflictError'
        this.code = 'WRITE_CONFLICT'
        this.status = 409
    }
}

function readEnv(env, name) {
    const source = env ?? globalThis
    return source?.[name]
}

export function getStorageDriverName(env = globalThis) {
    const driver = String(readEnv(env, 'SCN_STORAGE_DRIVER') || 'auto').trim().toLowerCase()
    if (['kv', 'd1', 'auto', 'dual'].includes(driver)) {
        return driver === 'dual' ? 'auto' : driver
    }
    return 'auto'
}

export function getStorageDb(env = globalThis) {
    const pinned = String(readEnv(env, 'SCN_NOTES_DB_BINDING') || '').trim()
    if (pinned) {
        if (!ALLOWED_NOTES_DB_BINDINGS.includes(pinned)) {
            return null
        }
        return readEnv(env, pinned) || null
    }
    return readEnv(env, 'NOTES_DB') || readEnv(env, 'NOTE_HISTORY_DB') || readEnv(env, 'DB') || null
}

export function getAccountDb(env = globalThis) {
    return readEnv(env, 'APP_DB') || readEnv(env, 'NOTE_HISTORY_DB') || null
}

export function getNotesKv(env = globalThis) {
    return readEnv(env, 'NOTES') || null
}

export function getShareKv(env = globalThis) {
    return readEnv(env, 'SHARE') || null
}

export function isAuthorityModeRequired(env = globalThis) {
    const driver = getStorageDriverName(env)
    const requireRegistry = String(readEnv(env, 'SCN_REQUIRE_NOTES_REGISTRY') || '').trim() === '1'
    const pinnedBinding = String(readEnv(env, 'SCN_NOTES_DB_BINDING') || '').trim()
    return driver === 'd1' || requireRegistry || Boolean(pinnedBinding)
}

export function isNotesRegistryEnabled(env = globalThis) {
    return getStorageDriverName(env) !== 'kv' && Boolean(getStorageDb(env))
}

export function isAccountFeatureEnabled(env = globalThis) {
    const accountDb = getAccountDb(env)
    const annotationDb = getAnnotationDb(env)
    return isNotesRegistryEnabled(env) && Boolean(accountDb) && accountDb === annotationDb
}

export function isMaintenanceMode(env = globalThis) {
    return String(readEnv(env, 'SCN_MAINTENANCE_MODE') || '').trim() === '1'
}

function randomBase64Url(byteLength = 16) {
    const bytes = new Uint8Array(byteLength)
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        crypto.getRandomValues(bytes)
    } else {
        for (let i = 0; i < byteLength; i += 1) {
            bytes[i] = Math.floor(Math.random() * 256)
        }
    }
    let bin = ''
    for (let i = 0; i < bytes.length; i += 1) {
        bin += String.fromCharCode(bytes[i])
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function generateNoteUid() {
    return randomBase64Url(16)
}

export function generateShareToken() {
    return randomBase64Url(16)
}

export function generateNonce() {
    return randomBase64Url(16)
}

export function resolveLegacyToken(meta = {}) {
    if (!meta || typeof meta !== 'object') return ''
    if (meta.shareSlug && meta.shareId && meta.shareSlug !== meta.shareId) {
        return null
    }
    return meta.shareSlug || meta.shareId || ''
}

export function isCanonicalShareToken(token, path = '', md5Path = '') {
    if (typeof token !== 'string' || !token) return false
    if (path && (token === path || token.startsWith(`${path}-`))) return false
    if (md5Path && token.toLowerCase() === md5Path.toLowerCase()) return false
    return /^[A-Za-z0-9]{6}$/.test(token) || /^[A-Za-z0-9_-]{22,}$/.test(token)
}

export const isLegacyCutoverEligibleToken = isCanonicalShareToken

export function computeTitleSummary(content = '', metadata = {}) {
    return extractNoteTitle(content || '', metadata?.title || '', '').slice(0, 70).trim()
}

export const IS_LEGACY_BURNED_SQL = `(
    COALESCE(json_extract(metadata, '$.burned'), 0) = 1
    OR COALESCE(json_extract(metadata, '$.shareBurned'), 0) = 1
    OR COALESCE(CAST(json_extract(metadata, '$.shareBurnedAt') AS INTEGER), 0) > 0
    OR (
        (
            COALESCE(json_extract(metadata, '$.shareBurnAfterReading'), 0) = 1
            OR COALESCE(json_extract(metadata, '$.shareMode'), '') IN ('burn', 'burn_after_reading')
        )
        AND json_extract(metadata, '$.shareViewCount') IS NOT NULL
        AND CAST(json_extract(metadata, '$.shareViewCount') AS INTEGER) >= MAX(
            1,
            COALESCE(
                NULLIF(CAST(json_extract(metadata, '$.shareMaxViews') AS INTEGER), 0),
                NULLIF(CAST(json_extract(metadata, '$.sealMaxViews') AS INTEGER), 0),
                1
            )
        )
    )
)`

export async function checkD1Tables(db, requiredTables = []) {
    if (!db || typeof db.prepare !== 'function') {
        return { ok: false, code: 'STORAGE_UNAVAILABLE', missingTables: [...requiredTables], presentTables: [] }
    }
    if (!requiredTables.length) {
        return { ok: true, code: null, missingTables: [], presentTables: [] }
    }
    try {
        const placeholders = requiredTables.map(() => '?').join(', ')
        const res = await db.prepare(
            `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`
        ).bind(...requiredTables).all()
        const present = new Set((res?.results || []).map(r => r?.name).filter(Boolean))
        const missing = requiredTables.filter(t => !present.has(t))
        if (missing.length > 0) {
            return { ok: false, code: 'D1_SCHEMA_MISSING', missingTables: missing, presentTables: Array.from(present) }
        }
        return { ok: true, code: null, missingTables: [], presentTables: Array.from(present) }
    } catch (err) {
        return {
            ok: false,
            code: 'STORAGE_UNAVAILABLE',
            error: err?.message || String(err),
            missingTables: [...requiredTables],
            presentTables: [],
        }
    }
}

export async function checkNotesRegistryHealth(env = globalThis) {
    const driver = getStorageDriverName(env)
    const requireRegistry = String(readEnv(env, 'SCN_REQUIRE_NOTES_REGISTRY') || '').trim() === '1'
    const pinnedBinding = String(readEnv(env, 'SCN_NOTES_DB_BINDING') || '').trim()

    if (driver === 'kv') {
        if (requireRegistry) {
            return {
                ok: false,
                code: 'STORAGE_UNAVAILABLE',
                error: 'One-way cutover violation: SCN_REQUIRE_NOTES_REGISTRY=1 prohibits kv mode',
                driver,
            }
        }
        if (pinnedBinding) {
            return {
                ok: false,
                code: 'STORAGE_UNAVAILABLE',
                error: 'Configured SCN_NOTES_DB_BINDING cannot be used with SCN_STORAGE_DRIVER=kv',
                driver,
            }
        }
        return { ok: true, mode: 'kv', driver }
    }

    const db = getStorageDb(env)
    if (!db) {
        if (isAuthorityModeRequired(env)) {
            return {
                ok: false,
                code: 'STORAGE_UNAVAILABLE',
                error: pinnedBinding
                    ? `Pinned notesDb binding "${pinnedBinding}" is missing or invalid`
                    : 'Authoritative notesDb binding is missing',
                driver,
            }
        }
        return { ok: true, mode: 'kv', driver }
    }

    const tableCheck = await checkD1Tables(db, REQUIRED_NOTES_REGISTRY_TABLES)
    if (!tableCheck.ok) {
        return { ...tableCheck, driver }
    }
    return { ok: true, mode: 'd1_registry', driver, tables: tableCheck.presentTables }
}

export async function assertNotesAuthorityReady(env = globalThis) {
    const driver = getStorageDriverName(env)
    const requireRegistry = String(readEnv(env, 'SCN_REQUIRE_NOTES_REGISTRY') || '').trim() === '1'
    const pinnedBinding = String(readEnv(env, 'SCN_NOTES_DB_BINDING') || '').trim()

    if (driver === 'kv') {
        if (requireRegistry) {
            throw new StorageAuthorityError(
                'STORAGE_UNAVAILABLE',
                'One-way cutover violation: SCN_REQUIRE_NOTES_REGISTRY=1 cannot revert to KV mode',
            )
        }
        if (pinnedBinding) {
            throw new StorageAuthorityError(
                'STORAGE_UNAVAILABLE',
                'Configured SCN_NOTES_DB_BINDING cannot run in KV mode',
            )
        }
        return null
    }

    const db = getStorageDb(env)
    if (!db) {
        if (isAuthorityModeRequired(env)) {
            throw new StorageAuthorityError(
                'STORAGE_UNAVAILABLE',
                pinnedBinding
                    ? `Pinned notesDb binding "${pinnedBinding}" is missing or invalid`
                    : 'Authoritative notesDb binding is unavailable',
            )
        }
        return null
    }

    if (VERIFIED_NOTES_DBS.has(db)) {
        return db
    }

    const tableCheck = await checkD1Tables(db, REQUIRED_NOTES_REGISTRY_TABLES)
    if (!tableCheck.ok) {
        throw new StorageAuthorityError(
            tableCheck.code || 'D1_SCHEMA_MISSING',
            tableCheck.code === 'D1_SCHEMA_MISSING'
                ? `Missing required notes registry tables: ${tableCheck.missingTables.join(', ')}`
                : `Notes D1 database unavailable: ${tableCheck.error || 'unknown error'}`,
        )
    }

    VERIFIED_NOTES_DBS.add(db)
    return db
}

function attachNoteSource(result, source) {
    Object.defineProperty(result, '_source', {
        value: source,
        enumerable: false,
        configurable: true,
    })
    return result
}

export function isUnbackfilledBurnNote(noteResult) {
    if (!noteResult || !isBurnProtected(noteResult.metadata)) return false
    const driver = getStorageDriverName()
    const db = getStorageDb()
    if (driver === 'kv' || !db) return false
    return noteResult._source !== 'd1'
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

function parseMetaSafe(raw) {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try {
        return JSON.parse(raw) || {}
    } catch {
        return {}
    }
}

function isUniqueConstraintError(err) {
    const msg = String(err?.message || err || '')
    return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT_PRIMARYKEY|constraint failed/i.test(msg)
}

/**
 * One-time legacy noteUid claim inside notesDb.batch using claimNonce.
 */
export async function claimLegacyD1NoteUid(db, path, nowUnix = Math.floor(Date.now() / 1000)) {
    if (!db || typeof db.batch !== 'function' || !path) {
        return { claimed: false }
    }

    let row
    try {
        row = await db.prepare('SELECT path, metadata FROM notes WHERE path = ? LIMIT 1').bind(path).first()
    } catch (err) {
        throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `Failed to read legacy D1 note: ${err?.message || err}`)
    }
    if (!row) return { claimed: false, missing: true }

    const meta = parseMetaSafe(row.metadata)
    if (meta.noteUid) {
        return { claimed: false, alreadyClaimed: true, noteUid: meta.noteUid, metadata: meta }
    }

    const noteUid = generateNoteUid()
    const claimNonce = generateNonce()
    const md5Path = await md5Hex(path)
    const rawLegacy = resolveLegacyToken(meta)
    const eligibleLegacyToken = rawLegacy && isLegacyCutoverEligibleToken(rawLegacy, path, md5Path)
        ? rawLegacy
        : null

    const stmts = [
        db.prepare(`
            UPDATE notes
            SET metadata = json_set(
                metadata,
                '$.noteUid', ?,
                '$.claimNonce', ?,
                '$.metaVersion', COALESCE(CAST(json_extract(metadata, '$.metaVersion') AS INTEGER), 0) + 1
            )
            WHERE path = ?
              AND json_extract(metadata, '$.noteUid') IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM note_tombstones WHERE path = ? AND deleted_note_uid = '__legacy__'
              )
        `).bind(noteUid, claimNonce, path, path),
        db.prepare(`
            INSERT INTO note_tombstones (path, deleted_note_uid, deleted_at, delete_nonce)
            SELECT ?, '__legacy__', ?, ?
            WHERE EXISTS (
                SELECT 1 FROM notes
                WHERE path = ?
                  AND json_extract(metadata, '$.noteUid') = ?
                  AND json_extract(metadata, '$.claimNonce') = ?
            )
            ON CONFLICT(path, deleted_note_uid) DO NOTHING
        `).bind(path, nowUnix, claimNonce, path, noteUid, claimNonce),
    ]

    if (eligibleLegacyToken) {
        stmts.push(
            db.prepare(`
                INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at, revoked_at, revoked_reason)
                SELECT
                    ?,
                    ?,
                    ?,
                    0,
                    ?,
                    CASE
                        WHEN (${IS_LEGACY_BURNED_SQL})
                          OR (json_extract(metadata, '$.shareExpiresAt') IS NOT NULL AND CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) <= ?)
                        THEN ?
                        ELSE NULL
                    END,
                    CASE
                        WHEN (${IS_LEGACY_BURNED_SQL}) THEN 'burned'
                        WHEN (json_extract(metadata, '$.shareExpiresAt') IS NOT NULL AND CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) <= ?) THEN 'expired'
                        ELSE NULL
                    END
                FROM notes
                WHERE path = ?
                  AND json_extract(metadata, '$.noteUid') = ?
                  AND json_extract(metadata, '$.claimNonce') = ?
                  AND (
                      json_extract(metadata, '$.share') = 1
                      OR (${IS_LEGACY_BURNED_SQL})
                      OR (json_extract(metadata, '$.shareExpiresAt') IS NOT NULL AND CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) <= ?)
                  )
                  AND NOT EXISTS (SELECT 1 FROM share_token_registry WHERE share_id = ?)
                  AND NOT EXISTS (SELECT 1 FROM shares WHERE share_id = ? AND path != ?)
            `).bind(
                eligibleLegacyToken,
                path,
                noteUid,
                nowUnix,
                nowUnix,
                nowUnix,
                nowUnix,
                path,
                noteUid,
                claimNonce,
                nowUnix,
                eligibleLegacyToken,
                eligibleLegacyToken,
                path,
            ),
            db.prepare(`
                INSERT INTO shares (share_id, path, created_at)
                SELECT ?, ?, ?
                WHERE NOT EXISTS (SELECT 1 FROM shares WHERE share_id = ? AND path = ?)
                  AND EXISTS (
                      SELECT 1 FROM notes
                      WHERE path = ?
                        AND json_extract(metadata, '$.noteUid') = ?
                        AND json_extract(metadata, '$.claimNonce') = ?
                        AND json_extract(metadata, '$.share') = 1
                        AND NOT (${IS_LEGACY_BURNED_SQL})
                        AND (json_extract(metadata, '$.shareExpiresAt') IS NULL OR CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) > ?)
                  )
                  AND EXISTS (
                      SELECT 1 FROM share_token_registry
                      WHERE share_id = ? AND target_path = ? AND note_uid = ? AND revoked_at IS NULL
                  )
            `).bind(
                eligibleLegacyToken,
                path,
                nowUnix,
                eligibleLegacyToken,
                path,
                path,
                noteUid,
                claimNonce,
                nowUnix,
                eligibleLegacyToken,
                path,
                noteUid,
            ),
        )
    }

    // Step 5: Always clean stale shares rows for terminal/unshared/missing-share legacy notes
    stmts.push(
        db.prepare(`
            DELETE FROM shares
            WHERE path = ?
              AND EXISTS (
                  SELECT 1 FROM notes
                  WHERE path = ?
                    AND json_extract(metadata, '$.noteUid') = ?
                    AND json_extract(metadata, '$.claimNonce') = ?
                    AND (
                        json_extract(metadata, '$.share') IS NOT 1
                        OR (${IS_LEGACY_BURNED_SQL})
                        OR (json_extract(metadata, '$.shareExpiresAt') IS NOT NULL AND CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) <= ?)
                    )
              )
        `).bind(path, path, noteUid, claimNonce, nowUnix),
    )

    let results
    try {
        results = await db.batch(stmts)
    } catch (err) {
        throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `Legacy noteUid claim failed: ${err?.message || err}`)
    }

    const wonClaim = Number(results?.[0]?.meta?.changes ?? 0) === 1
    if (!wonClaim) {
        return { claimed: false, lostRace: true }
    }

    return {
        claimed: true,
        noteUid,
        claimNonce,
        legacyToken: eligibleLegacyToken,
    }
}

/**
 * Query note content and metadata
 * @param {string} path - Note path
 * @returns {Promise<{ value: string, metadata: object }>}
 */
export async function driverQueryNote(path, env = globalThis) {
    const driver = getStorageDriverName(env)
    const kv = getNotesKv(env)
    const db = await assertNotesAuthorityReady(env)

    if (isNotesRegistryEnabled(env) && db) {
        let row
        try {
            row = await db.prepare('SELECT content, metadata FROM notes WHERE path = ?').bind(path).first()
        } catch (err) {
            throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 note query failed: ${err?.message || err}`)
        }

        if (row) {
            let parsedMeta = parseMetaSafe(row.metadata)
            if (!parsedMeta.noteUid && !isMaintenanceMode(env)) {
                const claimRes = await claimLegacyD1NoteUid(db, path)
                if (claimRes.claimed || claimRes.lostRace) {
                    const refreshed = await db.prepare('SELECT content, metadata FROM notes WHERE path = ?').bind(path).first()
                    if (refreshed) {
                        row = refreshed
                        parsedMeta = parseMetaSafe(refreshed.metadata)
                    }
                }
            }
            return attachNoteSource({
                value: row.content || '',
                metadata: parsedMeta,
            }, 'd1')
        }

        if (driver === 'auto' && kv) {
            const result = await kv.getWithMetadata(path)
            const hasKvRecord = Boolean(
                (result?.value !== null && result?.value !== undefined && result?.value !== '')
                || (result?.metadata && Object.keys(result.metadata).length > 0)
            )
            if (hasKvRecord) {
                const kvMeta = result?.metadata || {}
                const kvUid = typeof kvMeta.noteUid === 'string' ? kvMeta.noteUid : ''
                let tombRow
                try {
                    tombRow = await db.prepare(`
                        SELECT 1 AS tombstoned
                        FROM note_tombstones
                        WHERE path = ?
                          AND (
                              deleted_note_uid = ?
                              OR (deleted_note_uid = '__legacy__' AND ? = '')
                          )
                        LIMIT 1
                    `).bind(path, kvUid || '__none__', kvUid).first()
                } catch (err) {
                    throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 tombstone lookup failed: ${err?.message || err}`)
                }
                if (tombRow) {
                    return attachNoteSource({ value: '', metadata: {} }, 'none')
                }
                return attachNoteSource({
                    value: result?.value || '',
                    metadata: kvMeta,
                }, 'kv')
            }
        }

        return attachNoteSource({ value: '', metadata: {} }, 'none')
    }

    if (kv) {
        const result = await kv.getWithMetadata(path)
        const hasKvRecord = Boolean(
            (result?.value !== null && result?.value !== undefined && result?.value !== '')
            || (result?.metadata && Object.keys(result.metadata).length > 0)
        )
        return attachNoteSource({
            value: result?.value || '',
            metadata: result?.metadata || {},
        }, hasKvRecord ? 'kv' : 'none')
    }

    return attachNoteSource({ value: '', metadata: {} }, 'none')
}

async function mirrorShareKvAfterCommit(path, nextMetadata, previousMetadata = {}, env = globalThis) {
    const shareKv = getShareKv(env)
    if (!shareKv) return

    const md5Path = await md5Hex(path)
    const prevTokens = new Set([previousMetadata?.shareSlug, previousMetadata?.shareId].filter(Boolean))
    const nextToken = resolveLegacyToken(nextMetadata)
    const nextTokenValid = Boolean(nextToken && isCanonicalShareToken(nextToken, path, md5Path))

    for (const oldToken of prevTokens) {
        if (oldToken !== nextToken || nextMetadata?.share !== true) {
            if (typeof shareKv.delete === 'function') {
                await shareKv.delete(oldToken).catch(() => {})
            }
        }
    }

    if (nextMetadata?.share === true && nextTokenValid) {
        const kvOptions = {}
        const now = Math.floor(Date.now() / 1000)
        if (nextMetadata.shareExpiresAt && Number(nextMetadata.shareExpiresAt) > now + 60) {
            kvOptions.expiration = Number(nextMetadata.shareExpiresAt)
        }
        await shareKv.put(nextToken, path, kvOptions)
        await driverSetShareStatus(nextToken, null, {}, env)
    } else if (nextMetadata?.share !== true) {
        const terminalToken = (nextTokenValid ? nextToken : null)
            || [previousMetadata?.shareSlug, previousMetadata?.shareId].find(t => isCanonicalShareToken(t, path, md5Path))
        if (terminalToken) {
            if (isShareBurned(nextMetadata)) {
                await driverSetShareStatus(terminalToken, 'burned', { burnedAt: nextMetadata.shareBurnedAt || Math.floor(Date.now() / 1000), path }, env)
            } else if (nextMetadata?.shareExpiredAt || isShareExpired(nextMetadata)) {
                await driverSetShareStatus(terminalToken, 'expired', { expiredAt: nextMetadata.shareExpiredAt || Math.floor(Date.now() / 1000), path }, env)
            } else {
                await driverSetShareStatus(terminalToken, null, {}, env)
            }
        }
    }
}

/**
 * Atomically commit a note write with (noteUid, metaVersion) CAS, shareOpNonce-gated
 * share_token_registry & shares updates, PK collision retry (3x), and post-commit KV mirror.
 */
export async function commitAuthoritativeNoteWrite({
    path,
    content = '',
    nextMetadata = {},
    previousMetadata = undefined,
    expectedNoteUid = undefined,
    expectedMetaVersion = undefined,
    isNewNote = false,
    shareAction = 'auto', // 'auto' | 'republish'
    nowUnix = Math.floor(Date.now() / 1000),
    env = globalThis,
} = {}) {
    if (!path) throw new Error('Note path is required')

    const driver = getStorageDriverName(env)
    const notesKv = getNotesKv(env)
    const db = await assertNotesAuthorityReady(env)
    const md5Path = await md5Hex(path)

    // Pure KV mode
    if (!isNotesRegistryEnabled(env) || !db) {
        const prevMeta = previousMetadata || {}
        const prevToken = resolveLegacyToken(prevMeta)
        const prevActiveShare = prevMeta.share === true && !isShareBurned(prevMeta) && !isShareExpired(prevMeta, nowUnix)
        const prevTokenValid = Boolean(prevToken && isCanonicalShareToken(prevToken, path, md5Path))

        const committedMeta = {
            ...nextMetadata,
            ...(prevMeta.noteUid && !nextMetadata.noteUid ? { noteUid: prevMeta.noteUid } : {}),
            titleSummary: computeTitleSummary(content, nextMetadata),
        }

        if (committedMeta.share === true) {
            if (prevActiveShare && prevTokenValid && shareAction !== 'republish') {
                committedMeta.shareSlug = prevToken
                committedMeta.shareId = prevToken
            } else {
                const reqToken = resolveLegacyToken(committedMeta)
                const keepExplicitNew = !prevActiveShare && reqToken && reqToken !== prevToken && isCanonicalShareToken(reqToken, path, md5Path)
                const freshToken = keepExplicitNew ? reqToken : generateShareToken()
                committedMeta.shareSlug = freshToken
                committedMeta.shareId = freshToken
            }
        }

        if (notesKv) {
            await notesKv.put(path, content, { metadata: committedMeta })
        }
        await mirrorShareKvAfterCommit(path, committedMeta, prevMeta, env)
        return {
            committed: true,
            noteUid: committedMeta.noteUid || null,
            metaVersion: Number(committedMeta.metaVersion || 0),
            metadata: committedMeta,
            shareId: committedMeta.share === true ? (committedMeta.shareSlug || committedMeta.shareId || null) : null,
            source: 'kv',
        }
    }

    // D1 Registry mode
    let currentD1Row = null
    if (expectedNoteUid === undefined || expectedMetaVersion === undefined || previousMetadata === undefined) {
        try {
            currentD1Row = await db.prepare('SELECT path, metadata FROM notes WHERE path = ? LIMIT 1').bind(path).first()
        } catch (err) {
            throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 pre-write lookup failed: ${err?.message || err}`)
        }
        if (currentD1Row) {
            let d1Meta = parseMetaSafe(currentD1Row.metadata)
            if (!d1Meta.noteUid) {
                const claimRes = await claimLegacyD1NoteUid(db, path, nowUnix)
                if (claimRes.claimed || claimRes.lostRace) {
                    const refreshed = await db.prepare('SELECT path, metadata FROM notes WHERE path = ? LIMIT 1').bind(path).first()
                    if (refreshed) {
                        currentD1Row = refreshed
                        d1Meta = parseMetaSafe(refreshed.metadata)
                    }
                }
            }
            if (expectedNoteUid === undefined) expectedNoteUid = d1Meta.noteUid || null
            if (expectedMetaVersion === undefined) expectedMetaVersion = Number(d1Meta.metaVersion || 0)
            if (previousMetadata === undefined) previousMetadata = d1Meta
        } else {
            if (expectedNoteUid === undefined) expectedNoteUid = null
            if (expectedMetaVersion === undefined) expectedMetaVersion = 0
            if (previousMetadata === undefined) previousMetadata = {}
        }
    }

    const prevMeta = previousMetadata || {}
    const isCreate = isNewNote || !expectedNoteUid
    const targetNoteUid = expectedNoteUid || nextMetadata.noteUid || generateNoteUid()
    const baseVersion = isCreate ? 0 : Number(expectedMetaVersion || 0)
    const nextMetaVersion = baseVersion + 1

    const prevToken = resolveLegacyToken(prevMeta)
    const prevTokenValid = Boolean(prevToken && isCanonicalShareToken(prevToken, path, md5Path))
    const prevActiveShare = prevMeta.share === true && !isShareBurned(prevMeta) && !isShareExpired(prevMeta, nowUnix)
    const wantsShare = nextMetadata.share === true
    const titleSummary = computeTitleSummary(content, nextMetadata)

    // Determine if previous D1 row had a terminal legacy token not yet in share_token_registry
    let prevD1TerminalToken = null
    let prevD1TerminalReason = null
    if (!isCreate && prevTokenValid && (isShareBurned(prevMeta) || isShareExpired(prevMeta, nowUnix))) {
        prevD1TerminalToken = prevToken
        prevD1TerminalReason = isShareBurned(prevMeta) ? 'burned' : 'expired'
    }

    // Determine share token strategy
    let preserveExistingActiveToken = false
    let existingActiveToken = null
    if (wantsShare && prevActiveShare && prevTokenValid && shareAction !== 'republish' && !isCreate) {
        try {
            const regRow = await db.prepare(`
                SELECT share_id FROM share_token_registry
                WHERE share_id = ? AND target_path = ? AND note_uid = ? AND revoked_at IS NULL
                LIMIT 1
            `).bind(prevToken, path, targetNoteUid).first()
            if (regRow?.share_id) {
                preserveExistingActiveToken = true
                existingActiveToken = regRow.share_id
            }
        } catch (err) {
            throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 share registry lookup failed: ${err?.message || err}`)
        }
    }

    const maxRetries = (wantsShare && !preserveExistingActiveToken) ? 3 : 1
    let lastError = null

    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
        const opNonce = generateNonce()
        const mintedToken = (wantsShare && !preserveExistingActiveToken)
            ? generateShareToken()
            : null

        const committedMeta = {
            ...nextMetadata,
            noteUid: targetNoteUid,
            metaVersion: nextMetaVersion,
            shareOpNonce: opNonce,
            titleSummary,
        }
        delete committedMeta.claimNonce

        if (wantsShare) {
            const activeToken = preserveExistingActiveToken ? existingActiveToken : mintedToken
            committedMeta.shareSlug = activeToken
            committedMeta.shareId = activeToken
        }

        const metaJson = JSON.stringify(committedMeta)
        const stmts = []

        if (isCreate) {
            stmts.push(
                db.prepare(`
                    INSERT INTO notes (path, content, metadata, updated_at)
                    SELECT ?, ?, ?, ?
                    WHERE NOT EXISTS (SELECT 1 FROM notes WHERE path = ?)
                `).bind(path, content, metaJson, nowUnix, path)
            )
            // Suppress any un-UID'd KV remnant from before creation
            stmts.push(
                db.prepare(`
                    INSERT INTO note_tombstones (path, deleted_note_uid, deleted_at, delete_nonce)
                    SELECT ?, '__legacy__', ?, ?
                    WHERE EXISTS (
                        SELECT 1 FROM notes
                        WHERE path = ?
                          AND json_extract(metadata, '$.noteUid') = ?
                          AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                          AND json_extract(metadata, '$.shareOpNonce') = ?
                    )
                    ON CONFLICT(path, deleted_note_uid) DO NOTHING
                `).bind(path, nowUnix, opNonce, path, targetNoteUid, nextMetaVersion, opNonce)
            )
        } else {
            stmts.push(
                db.prepare(`
                    UPDATE notes
                    SET content = ?,
                        metadata = ?,
                        updated_at = ?
                    WHERE path = ?
                      AND json_extract(metadata, '$.noteUid') = ?
                      AND COALESCE(CAST(json_extract(metadata, '$.metaVersion') AS INTEGER), 0) = ?
                `).bind(content, metaJson, nowUnix, path, targetNoteUid, baseVersion)
            )
        }

        // Pin pre-existing D1-verified terminal legacy token before mutating metadata
        if (prevD1TerminalToken) {
            stmts.push(
                db.prepare(`
                    INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at, revoked_at, revoked_reason)
                    SELECT ?, ?, ?, 0, ?, ?, ?
                    WHERE EXISTS (
                        SELECT 1 FROM notes
                        WHERE path = ?
                          AND json_extract(metadata, '$.noteUid') = ?
                          AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                          AND json_extract(metadata, '$.shareOpNonce') = ?
                    )
                    AND NOT EXISTS (SELECT 1 FROM share_token_registry WHERE share_id = ?)
                `).bind(
                    prevD1TerminalToken,
                    path,
                    targetNoteUid,
                    nowUnix,
                    nowUnix,
                    prevD1TerminalReason,
                    path,
                    targetNoteUid,
                    nextMetaVersion,
                    opNonce,
                    prevD1TerminalToken,
                )
            )
        }

        if (wantsShare && preserveExistingActiveToken) {
            // Ensure active shares row exists for preserved token
            stmts.push(
                db.prepare(`
                    INSERT INTO shares (share_id, path, created_at)
                    SELECT ?, ?, ?
                    WHERE NOT EXISTS (SELECT 1 FROM shares WHERE share_id = ? AND path = ?)
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ?
                            AND json_extract(metadata, '$.noteUid') = ?
                            AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                            AND json_extract(metadata, '$.shareOpNonce') = ?
                      )
                `).bind(
                    existingActiveToken,
                    path,
                    nowUnix,
                    existingActiveToken,
                    path,
                    path,
                    targetNoteUid,
                    nextMetaVersion,
                    opNonce,
                )
            )
        } else if (wantsShare && mintedToken) {
            // Revoke prior active share tokens for this note generation
            stmts.push(
                db.prepare(`
                    UPDATE share_token_registry
                    SET revoked_at = ?,
                        revoked_reason = 'republished'
                    WHERE target_path = ?
                      AND note_uid = ?
                      AND revoked_at IS NULL
                      AND share_id != ?
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ?
                            AND json_extract(metadata, '$.noteUid') = ?
                            AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                            AND json_extract(metadata, '$.shareOpNonce') = ?
                      )
                `).bind(nowUnix, path, targetNoteUid, mintedToken, path, targetNoteUid, nextMetaVersion, opNonce),
                db.prepare(`
                    DELETE FROM shares
                    WHERE path = ?
                      AND share_id != ?
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ?
                            AND json_extract(metadata, '$.noteUid') = ?
                            AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                            AND json_extract(metadata, '$.shareOpNonce') = ?
                      )
                `).bind(path, mintedToken, path, targetNoteUid, nextMetaVersion, opNonce),
                // Insert new CSPRNG token WITHOUT ON CONFLICT DO NOTHING so PK collision rolls back batch
                db.prepare(`
                    INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at)
                    SELECT ?, ?, ?, 1, ?
                    WHERE EXISTS (
                        SELECT 1 FROM notes
                        WHERE path = ?
                          AND json_extract(metadata, '$.noteUid') = ?
                          AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                          AND json_extract(metadata, '$.shareOpNonce') = ?
                    )
                `).bind(mintedToken, path, targetNoteUid, nowUnix, path, targetNoteUid, nextMetaVersion, opNonce),
                db.prepare(`
                    INSERT INTO shares (share_id, path, created_at)
                    SELECT ?, ?, ?
                    WHERE EXISTS (
                        SELECT 1 FROM notes
                        WHERE path = ?
                          AND json_extract(metadata, '$.noteUid') = ?
                          AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                          AND json_extract(metadata, '$.shareOpNonce') = ?
                    )
                `).bind(mintedToken, path, nowUnix, path, targetNoteUid, nextMetaVersion, opNonce),
            )
        } else {
            // Unsharing / burning / expiring: revoke active tokens and clean shares
            const revokeReason = isShareBurned(committedMeta)
                ? 'burned'
                : (committedMeta.shareExpiredAt || isShareExpired(committedMeta, nowUnix) ? 'expired' : 'unshared')

            if ((revokeReason === 'burned' || revokeReason === 'expired') && prevTokenValid && !prevD1TerminalToken) {
                stmts.push(
                    db.prepare(`
                        INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at, revoked_at, revoked_reason)
                        SELECT ?, ?, ?, 0, ?, ?, ?
                        WHERE EXISTS (
                            SELECT 1 FROM notes
                            WHERE path = ?
                              AND json_extract(metadata, '$.noteUid') = ?
                              AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                              AND json_extract(metadata, '$.shareOpNonce') = ?
                        )
                        AND NOT EXISTS (SELECT 1 FROM share_token_registry WHERE share_id = ?)
                    `).bind(
                        prevToken,
                        path,
                        targetNoteUid,
                        nowUnix,
                        nowUnix,
                        revokeReason,
                        path,
                        targetNoteUid,
                        nextMetaVersion,
                        opNonce,
                        prevToken,
                    )
                )
            }

            stmts.push(
                db.prepare(`
                    UPDATE share_token_registry
                    SET revoked_at = ?,
                        revoked_reason = ?
                    WHERE target_path = ?
                      AND note_uid = ?
                      AND revoked_at IS NULL
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ?
                            AND json_extract(metadata, '$.noteUid') = ?
                            AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                            AND json_extract(metadata, '$.shareOpNonce') = ?
                      )
                `).bind(nowUnix, revokeReason, path, targetNoteUid, path, targetNoteUid, nextMetaVersion, opNonce),
                db.prepare(`
                    DELETE FROM shares
                    WHERE path = ?
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ?
                            AND json_extract(metadata, '$.noteUid') = ?
                            AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                            AND json_extract(metadata, '$.shareOpNonce') = ?
                      )
                `).bind(path, path, targetNoteUid, nextMetaVersion, opNonce),
            )
        }

        let results
        try {
            results = await db.batch(stmts)
        } catch (err) {
            if (isUniqueConstraintError(err) && wantsShare && !preserveExistingActiveToken && attempt + 1 < maxRetries) {
                lastError = err
                continue
            }
            if (isUniqueConstraintError(err)) {
                throw new StorageConflictError(`Share token or note conflict: ${err?.message || err}`)
            }
            throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 write batch failed: ${err?.message || err}`)
        }

        if (Number(results?.[0]?.meta?.changes ?? 0) !== 1) {
            throw new StorageConflictError(`Concurrent modification conflict for note "${path}"`)
        }

        // Mirror to KV ONLY after verifying results[0].meta.changes === 1
        if (driver === 'auto' && notesKv) {
            await notesKv.put(path, content, { metadata: committedMeta })
        }
        await mirrorShareKvAfterCommit(path, committedMeta, prevMeta, env)

        return {
            committed: true,
            noteUid: targetNoteUid,
            metaVersion: nextMetaVersion,
            metadata: committedMeta,
            shareId: committedMeta.share === true ? (committedMeta.shareSlug || committedMeta.shareId || null) : null,
            source: 'd1',
        }
    }

    throw new StorageConflictError(`Share token collision persisted after retries: ${lastError?.message || 'collision'}`)
}

/**
 * Write note content and metadata
 * @param {string} path - Note path
 * @param {string} content - Markdown or block note content
 * @param {object} metadata - Note metadata
 */
export async function driverPutNote(path, content = '', metadata = {}, options = {}) {
    return await commitAuthoritativeNoteWrite({
        path,
        content,
        nextMetadata: metadata,
        ...options,
    })
}

/**
 * Delete a note from storage with delete_nonce tombstone and zero shared-key KV wipe in D1 mode.
 * @param {string} path - Note path
 * @param {object} options
 */
export async function driverDeleteNote(path, options = {}) {
    const env = options?.env ?? globalThis
    const driver = getStorageDriverName(env)
    const kv = getNotesKv(env)
    const db = await assertNotesAuthorityReady(env)

    // Pure KV mode: never touch D1
    if (driver === 'kv') {
        if (kv) {
            const current = await kv.getWithMetadata(path).catch(() => null)
            const prevMeta = current?.metadata || {}
            await kv.delete(path)
            const shareKv = getShareKv(env)
            if (shareKv && typeof shareKv.delete === 'function') {
                for (const tok of [prevMeta.shareSlug, prevMeta.shareId].filter(Boolean)) {
                    await shareKv.delete(tok).catch(() => {})
                }
            }
        }
        return { deleted: true, source: 'kv' }
    }

    if (!isNotesRegistryEnabled(env) || !db) {
        if (kv) {
            await kv.delete(path)
        }
        return { deleted: true, source: 'kv' }
    }

    const now = options?.nowUnix ?? Math.floor(Date.now() / 1000)
    const requireEmpty = options?.requireEmpty === true
    const requestedNoteUid = options?.noteUid
    const requestedMetaVersion = options?.metaVersion

    let d1Row
    try {
        d1Row = await db.prepare('SELECT path, content, metadata FROM notes WHERE path = ? LIMIT 1').bind(path).first()
    } catch (err) {
        throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 delete lookup failed: ${err?.message || err}`)
    }

    let expectedD1Row = options?.expectedD1Row !== undefined ? Boolean(options.expectedD1Row) : Boolean(d1Row)
    let targetNoteUid = ''
    let targetMetaVersion = 0
    let targetMeta = {}

    if (d1Row) {
        if (options?.expectedD1Row === false) {
            return { deleted: false, conflict: true, reason: 'unexpected_d1_row' }
        }
        targetMeta = parseMetaSafe(d1Row.metadata)
        const actualNoteUid = targetMeta.noteUid || '__legacy__'
        const actualMetaVersion = Number(targetMeta.metaVersion || 0)

        if (requestedNoteUid !== undefined && requestedNoteUid !== actualNoteUid) {
            return { deleted: false, conflict: true, reason: 'note_uid_mismatch' }
        }
        if (requestedMetaVersion !== undefined && Number(requestedMetaVersion) !== actualMetaVersion) {
            return { deleted: false, conflict: true, reason: 'meta_version_mismatch' }
        }
        if (requireEmpty && String(d1Row.content || '').trim().length > 0) {
            return { deleted: false, conflict: true, reason: 'note_not_empty' }
        }

        expectedD1Row = true
        targetNoteUid = actualNoteUid
        targetMetaVersion = actualMetaVersion
    } else {
        if (options?.expectedD1Row === true) {
            return { deleted: false, conflict: true, reason: 'd1_row_missing' }
        }
        expectedD1Row = false
        const kvRes = kv ? await kv.getWithMetadata(path).catch(() => null) : null
        targetMeta = kvRes?.metadata || {}
        const kvUid = typeof targetMeta.noteUid === 'string' ? targetMeta.noteUid : ''
        if (requestedNoteUid !== undefined && requestedNoteUid !== '__legacy__' && requestedNoteUid !== kvUid) {
            return { deleted: false, conflict: true, reason: 'note_uid_mismatch' }
        }
        targetNoteUid = kvUid
    }

    const deleteNonce = generateNonce()
    const effectiveTombstoneUid = expectedD1Row ? targetNoteUid : '__legacy__'
    const md5Path = await md5Hex(path)
    const legacyToken = resolveLegacyToken(targetMeta)
    const terminalLegacyToken = expectedD1Row
        && legacyToken
        && isLegacyCutoverEligibleToken(legacyToken, path, md5Path)
        && (isShareBurned(targetMeta) || isShareExpired(targetMeta, now))
        ? legacyToken
        : null
    const terminalReason = isShareBurned(targetMeta) ? 'burned' : 'expired'

    const stmts = [
        // 1. D1-row tombstone insert
        db.prepare(`
            INSERT INTO note_tombstones (path, deleted_note_uid, deleted_at, delete_nonce)
            SELECT path, COALESCE(json_extract(metadata, '$.noteUid'), '__legacy__'), ?, ?
            FROM notes
            WHERE path = ?
              AND COALESCE(json_extract(metadata, '$.noteUid'), '__legacy__') = ?
              AND COALESCE(CAST(json_extract(metadata, '$.metaVersion') AS INTEGER), 0) = ?
              ${requireEmpty ? 'AND length(trim(content)) = 0' : ''}
            ON CONFLICT(path, deleted_note_uid) DO NOTHING
        `).bind(now, deleteNonce, path, targetNoteUid, targetMetaVersion),
        // 2. KV-only tombstone insert (gated strictly on !expectedD1Row via ? = 0)
        db.prepare(`
            INSERT INTO note_tombstones (path, deleted_note_uid, deleted_at, delete_nonce)
            SELECT ?, deleted_uid, ?, ?
            FROM (
                SELECT '__legacy__' AS deleted_uid
                UNION ALL
                SELECT ? AS deleted_uid WHERE ? != ''
            )
            WHERE ? = 0
              AND NOT EXISTS (SELECT 1 FROM notes WHERE path = ?)
            ON CONFLICT(path, deleted_note_uid) DO NOTHING
        `).bind(path, now, deleteNonce, targetNoteUid, targetNoteUid, expectedD1Row ? 1 : 0, path),
    ]

    if (terminalLegacyToken) {
        stmts.push(
            db.prepare(`
                INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at, revoked_at, revoked_reason)
                SELECT ?, ?, ?, 0, ?, ?, ?
                WHERE EXISTS (
                    SELECT 1 FROM note_tombstones
                    WHERE path = ? AND deleted_note_uid = ? AND delete_nonce = ?
                )
                AND NOT EXISTS (SELECT 1 FROM share_token_registry WHERE share_id = ?)
            `).bind(
                terminalLegacyToken,
                path,
                targetNoteUid,
                now,
                now,
                terminalReason,
                path,
                effectiveTombstoneUid,
                deleteNonce,
                terminalLegacyToken,
            )
        )
    }

    // 3. Revoke active share_token_registry entries
    stmts.push(
        db.prepare(`
            UPDATE share_token_registry
            SET revoked_at = ?,
                revoked_reason = 'deleted'
            WHERE target_path = ?
              AND note_uid = ?
              AND revoked_at IS NULL
              AND EXISTS (
                  SELECT 1 FROM note_tombstones
                  WHERE path = ? AND deleted_note_uid = ? AND delete_nonce = ?
              )
        `).bind(now, path, effectiveTombstoneUid, path, effectiveTombstoneUid, deleteNonce),
    )

    // 4. Delete shares mappings gated on delete_nonce
    stmts.push(
        db.prepare(`
            DELETE FROM shares
            WHERE (
                share_id IN (
                    SELECT share_id FROM share_token_registry WHERE target_path = ? AND note_uid = ?
                )
                OR path = ?
            )
            AND EXISTS (
                SELECT 1 FROM note_tombstones
                WHERE path = ? AND deleted_note_uid = ? AND delete_nonce = ?
            )
        `).bind(path, effectiveTombstoneUid, path, path, effectiveTombstoneUid, deleteNonce),
    )

    // 5. Delete notes row gated on delete_nonce
    const deleteNoteStmtIndex = stmts.length
    stmts.push(
        db.prepare(`
            DELETE FROM notes
            WHERE path = ?
              AND COALESCE(json_extract(metadata, '$.noteUid'), '__legacy__') = ?
              AND COALESCE(CAST(json_extract(metadata, '$.metaVersion') AS INTEGER), 0) = ?
              ${requireEmpty ? 'AND length(trim(content)) = 0' : ''}
              AND EXISTS (
                  SELECT 1 FROM note_tombstones
                  WHERE path = ? AND deleted_note_uid = ? AND delete_nonce = ?
              )
        `).bind(path, targetNoteUid, targetMetaVersion, path, effectiveTombstoneUid, deleteNonce),
    )

    let results
    try {
        results = await db.batch(stmts)
    } catch (err) {
        throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 delete batch failed: ${err?.message || err}`)
    }

    const committed = expectedD1Row
        ? (Number(results?.[0]?.meta?.changes ?? 0) === 1 && Number(results?.[deleteNoteStmtIndex]?.meta?.changes ?? 0) === 1)
        : (Number(results?.[1]?.meta?.changes ?? 0) >= 1)

    if (!committed) {
        return { deleted: false, conflict: true, reason: 'delete_cas_lost' }
    }

    // NEVER call NOTES.delete(path) in D1-registry mode!
    // Clean up SHARE KV token entries for deleted share tokens
    const shareKv = getShareKv(env)
    if (shareKv) {
        for (const tok of [targetMeta?.shareSlug, targetMeta?.shareId].filter(Boolean)) {
            if (isCanonicalShareToken(tok, path, md5Path) && typeof shareKv.delete === 'function') {
                await shareKv.delete(tok).catch(() => {})
            }
        }
        if (terminalLegacyToken) {
            await driverSetShareStatus(terminalLegacyToken, terminalReason, { path }, env)
        }
    }

    return {
        deleted: true,
        noteUid: effectiveTombstoneUid,
        source: expectedD1Row ? 'd1' : 'kv',
    }
}

/**
 * List notes across active storage backends (D1 and/or tombstone-filtered KV).
 * Returns [{ name, metadata, content? }] deduplicated by path.
 */
export async function driverListNotes({ includeContent = false, env = globalThis } = {}) {
    const driver = getStorageDriverName(env)
    const kv = getNotesKv(env)
    const db = await assertNotesAuthorityReady(env)
    const byPath = new Map()
    const tombstonesByPath = new Map()

    if (isNotesRegistryEnabled(env) && db) {
        try {
            const cols = includeContent ? 'path, content, metadata' : 'path, metadata'
            const res = await db.prepare(`SELECT ${cols} FROM notes`).all()
            for (const row of (res?.results || [])) {
                if (!row?.path) continue
                const parsedMeta = parseMetaSafe(row.metadata)
                byPath.set(row.path, {
                    name: row.path,
                    metadata: parsedMeta,
                    ...(includeContent ? { content: row.content || '', hasContent: true } : {}),
                })
            }

            if (driver === 'auto' && kv) {
                const tombRes = await db.prepare('SELECT path, deleted_note_uid FROM note_tombstones').all()
                for (const t of (tombRes?.results || [])) {
                    if (!t?.path || !t?.deleted_note_uid) continue
                    let set = tombstonesByPath.get(t.path)
                    if (!set) {
                        set = new Set()
                        tombstonesByPath.set(t.path, set)
                    }
                    set.add(t.deleted_note_uid)
                }
            }
        } catch (err) {
            throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 list notes failed: ${err?.message || err}`)
        }
    }

    if ((driver === 'kv' || driver === 'auto') && kv && typeof kv.list === 'function') {
        let cursor
        do {
            const page = await kv.list(cursor ? { cursor } : undefined)
            for (const item of (page?.keys || [])) {
                if (!item?.name || byPath.has(item.name)) continue
                const kvUid = typeof item?.metadata?.noteUid === 'string' ? item.metadata.noteUid : ''
                const tombSet = tombstonesByPath.get(item.name)
                if (tombSet && ((kvUid && tombSet.has(kvUid)) || (!kvUid && tombSet.has('__legacy__')))) {
                    continue
                }
                byPath.set(item.name, item)
            }
            cursor = page?.list_complete ? undefined : page?.cursor
        } while (cursor)
    }

    return Array.from(byPath.values())
}

async function pinLegacyTerminalRegistryEntry(db, shareId, targetPath, noteUid, reason, nowUnix) {
    if (!db || !shareId || (reason !== 'burned' && reason !== 'expired')) return
    try {
        await db.prepare(`
            INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at, revoked_at, revoked_reason)
            VALUES (?, ?, ?, 0, ?, ?, ?)
            ON CONFLICT(share_id) DO NOTHING
        `).bind(shareId, targetPath || '__legacy_terminal__', noteUid || '__legacy_terminal__', nowUnix, nowUnix, reason).run()
    } catch {}
}

/**
 * Authoritative share resolver across ALL share, Circle, Space, and Sitemap entrypoints.
 * When includeContent is false (resolveAuthoritativeShareMetadata), NEVER selects `notes.content`.
 */
export async function resolveAuthoritativeShare(shareId, {
    includeContent = true,
    nowUnix = Math.floor(Date.now() / 1000),
    env = globalThis,
} = {}) {
    if (typeof shareId !== 'string' || !shareId || shareId.length > 128) {
        return { status: 'not_found' }
    }

    const db = await assertNotesAuthorityReady(env)
    const shareKv = getShareKv(env)
    const notesKv = getNotesKv(env)
    const driver = getStorageDriverName(env)

    // Pure KV mode
    if (!isNotesRegistryEnabled(env) || !db) {
        if (!isCanonicalShareToken(shareId)) {
            return { status: 'not_found' }
        }
        const targetPath = shareKv ? await shareKv.get(shareId) : null
        if (targetPath) {
            const md5Path = await md5Hex(targetPath)
            if (!isCanonicalShareToken(shareId, targetPath, md5Path)) {
                return { status: 'not_found' }
            }
            const noteResult = await driverQueryNote(targetPath, env)
            const metadata = noteResult?.metadata || {}
            if (resolveLegacyToken(metadata) !== shareId) {
                return { status: 'not_found' }
            }
            if (isShareBurned(metadata)) {
                return { status: 'burned', shareId, path: targetPath, metadata, isCsprngV1: false, source: 'kv' }
            }
            if (isShareExpired(metadata, nowUnix)) {
                return { status: 'expired', shareId, path: targetPath, metadata, isCsprngV1: false, source: 'kv' }
            }
            if (metadata.share !== true) {
                return { status: 'not_found' }
            }
            return {
                status: 'active',
                shareId,
                path: targetPath,
                noteUid: metadata.noteUid || '',
                metadata,
                ...(includeContent ? { value: noteResult.value || '' } : {}),
                isCsprngV1: false,
                source: 'kv',
            }
        }

        const tombstone = await driverGetShareStatus(shareId, env)
        if (tombstone?.status === 'burned' || tombstone?.status === 'expired') {
            return { status: tombstone.status, shareId, isCsprngV1: false }
        }
        return { status: 'not_found' }
    }

    // D1 Registry mode
    const loadFromRegistryRow = async (reg) => {
        if (!reg) return null
        if (reg.revoked_at !== null && reg.revoked_at !== undefined) {
            if (reg.revoked_reason === 'burned') {
                return { status: 'burned', shareId, isCsprngV1: reg.is_csprng_v1 === 1 }
            }
            if (reg.revoked_reason === 'expired') {
                return { status: 'expired', shareId, isCsprngV1: reg.is_csprng_v1 === 1 }
            }
            return { status: 'not_found', shareId, revokedReason: reg.revoked_reason || 'revoked' }
        }

        const tomb = await db.prepare(
            'SELECT 1 AS ok FROM note_tombstones WHERE path = ? AND deleted_note_uid = ? LIMIT 1'
        ).bind(reg.target_path, reg.note_uid).first()
        if (tomb) return { status: 'not_found' }

        const sharesRow = await db.prepare('SELECT path FROM shares WHERE share_id = ? LIMIT 1').bind(shareId).first()
        if (sharesRow && sharesRow.path !== reg.target_path) {
            return { status: 'not_found' }
        }

        const cols = includeContent ? 'content, metadata' : 'metadata'
        const noteRow = await db.prepare(`SELECT ${cols} FROM notes WHERE path = ? LIMIT 1`).bind(reg.target_path).first()
        if (!noteRow) return { status: 'not_found' }

        const metadata = parseMetaSafe(noteRow.metadata)
        if (!metadata.noteUid || metadata.noteUid !== reg.note_uid) {
            return { status: 'not_found' }
        }
        if (isShareBurned(metadata)) {
            return {
                status: 'burned',
                shareId,
                path: reg.target_path,
                noteUid: reg.note_uid,
                metadata,
                ...(includeContent ? { value: noteRow.content || '' } : {}),
                isCsprngV1: reg.is_csprng_v1 === 1,
                source: 'd1',
            }
        }
        if (isShareExpired(metadata, nowUnix)) {
            return {
                status: 'expired',
                shareId,
                path: reg.target_path,
                noteUid: reg.note_uid,
                metadata,
                ...(includeContent ? { value: noteRow.content || '' } : {}),
                isCsprngV1: reg.is_csprng_v1 === 1,
                source: 'd1',
            }
        }
        if (metadata.share !== true) {
            return { status: 'not_found' }
        }

        return {
            status: 'active',
            shareId,
            path: reg.target_path,
            noteUid: reg.note_uid,
            metadata,
            ...(includeContent ? { value: noteRow.content || '' } : {}),
            isCsprngV1: reg.is_csprng_v1 === 1,
            source: 'd1',
        }
    }

    let regRow
    try {
        regRow = await db.prepare(`
            SELECT share_id, target_path, note_uid, is_csprng_v1, revoked_at, revoked_reason
            FROM share_token_registry
            WHERE share_id = ?
            LIMIT 1
        `).bind(shareId).first()
    } catch (err) {
        throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 share registry query failed: ${err?.message || err}`)
    }

    if (regRow) {
        return await loadFromRegistryRow(regRow)
    }

    // Legacy cutover resolution path (only for strictly opaque canonical token formats)
    if (!isCanonicalShareToken(shareId)) {
        return { status: 'not_found' }
    }

    try {
        // 1. Check shares mapping for untagged D1 row
        const sharesRow = await db.prepare('SELECT path FROM shares WHERE share_id = ? LIMIT 1').bind(shareId).first()
        if (sharesRow?.path) {
            const md5Path = await md5Hex(sharesRow.path)
            if (isLegacyCutoverEligibleToken(shareId, sharesRow.path, md5Path)) {
                const noteRow = await db.prepare('SELECT path, metadata FROM notes WHERE path = ? LIMIT 1').bind(sharesRow.path).first()
                if (noteRow) {
                    const meta = parseMetaSafe(noteRow.metadata)
                    if (!meta.noteUid && resolveLegacyToken(meta) === shareId) {
                        if (!isMaintenanceMode(env)) {
                            await claimLegacyD1NoteUid(db, sharesRow.path, nowUnix)
                            const claimedReg = await db.prepare(`
                                SELECT share_id, target_path, note_uid, is_csprng_v1, revoked_at, revoked_reason
                                FROM share_token_registry WHERE share_id = ? LIMIT 1
                            `).bind(shareId).first()
                            if (claimedReg) return await loadFromRegistryRow(claimedReg)
                        } else {
                            // Maintenance mode: read-only without mutating D1
                            const fullRow = includeContent
                                ? await db.prepare('SELECT content, metadata FROM notes WHERE path = ? LIMIT 1').bind(sharesRow.path).first()
                                : noteRow
                            if (isShareBurned(meta)) return { status: 'burned', shareId, isCsprngV1: false }
                            if (isShareExpired(meta, nowUnix)) return { status: 'expired', shareId, isCsprngV1: false }
                            if (meta.share === true) {
                                return {
                                    status: 'active',
                                    shareId,
                                    path: sharesRow.path,
                                    noteUid: '',
                                    metadata: meta,
                                    ...(includeContent ? { value: fullRow?.content || '' } : {}),
                                    isCsprngV1: false,
                                    source: 'd1',
                                }
                            }
                        }
                    }
                    return { status: 'not_found' }
                }
            }
        }

        // 2. Metadata-only untagged D1 notes lookup (mapping-less active or pre-burned/expired rows)
        const untaggedRows = await db.prepare(`
            SELECT path, metadata FROM notes
            WHERE json_extract(metadata, '$.noteUid') IS NULL
              AND (
                  json_extract(metadata, '$.shareSlug') = ?
                  OR json_extract(metadata, '$.shareId') = ?
              )
            LIMIT 2
        `).bind(shareId, shareId).all()
        const matches = untaggedRows?.results || []
        if (matches.length === 1) {
            const candidate = matches[0]
            const meta = parseMetaSafe(candidate.metadata)
            const md5Path = await md5Hex(candidate.path)
            if (resolveLegacyToken(meta) === shareId && isLegacyCutoverEligibleToken(shareId, candidate.path, md5Path)) {
                if (!isMaintenanceMode(env)) {
                    await claimLegacyD1NoteUid(db, candidate.path, nowUnix)
                    const claimedReg = await db.prepare(`
                        SELECT share_id, target_path, note_uid, is_csprng_v1, revoked_at, revoked_reason
                        FROM share_token_registry WHERE share_id = ? LIMIT 1
                    `).bind(shareId).first()
                    if (claimedReg) return await loadFromRegistryRow(claimedReg)
                } else {
                    if (isShareBurned(meta)) return { status: 'burned', shareId, isCsprngV1: false }
                    if (isShareExpired(meta, nowUnix)) return { status: 'expired', shareId, isCsprngV1: false }
                    if (meta.share === true) {
                        const fullRow = includeContent
                            ? await db.prepare('SELECT content FROM notes WHERE path = ? LIMIT 1').bind(candidate.path).first()
                            : null
                        return {
                            status: 'active',
                            shareId,
                            path: candidate.path,
                            noteUid: '',
                            metadata: meta,
                            ...(includeContent ? { value: fullRow?.content || '' } : {}),
                            isCsprngV1: false,
                            source: 'd1',
                        }
                    }
                }
            }
        }

        // 3. Transient KV-only read (auto mode) without writing D1 stubs
        if (driver === 'auto' && shareKv && notesKv) {
            const kvPath = await shareKv.get(shareId)
            if (kvPath) {
                const md5Path = await md5Hex(kvPath)
                if (isLegacyCutoverEligibleToken(shareId, kvPath, md5Path)) {
                    const existingD1 = await db.prepare('SELECT 1 AS ok FROM notes WHERE path = ? LIMIT 1').bind(kvPath).first()
                    const tomb = await db.prepare("SELECT 1 AS ok FROM note_tombstones WHERE path = ? AND deleted_note_uid = '__legacy__' LIMIT 1").bind(kvPath).first()
                    if (!existingD1 && !tomb) {
                        const kvNote = await notesKv.getWithMetadata(kvPath)
                        const kvMeta = kvNote?.metadata || {}
                        if (resolveLegacyToken(kvMeta) === shareId) {
                            if (isShareBurned(kvMeta)) {
                                if (!isMaintenanceMode(env)) {
                                    await pinLegacyTerminalRegistryEntry(db, shareId, '__legacy_terminal__', '__legacy_terminal__', 'burned', nowUnix)
                                }
                                return { status: 'burned', shareId, isCsprngV1: false }
                            }
                            if (isShareExpired(kvMeta, nowUnix)) {
                                if (!isMaintenanceMode(env)) {
                                    await pinLegacyTerminalRegistryEntry(db, shareId, '__legacy_terminal__', '__legacy_terminal__', 'expired', nowUnix)
                                }
                                return { status: 'expired', shareId, isCsprngV1: false }
                            }
                            if (kvMeta.share === true) {
                                return {
                                    status: 'active',
                                    shareId,
                                    path: kvPath,
                                    noteUid: '',
                                    metadata: kvMeta,
                                    ...(includeContent ? { value: kvNote?.value || '' } : {}),
                                    isCsprngV1: false,
                                    source: 'kv',
                                    unbackfilled: true,
                                }
                            }
                        }
                    }
                }
            }
        }

        // 4. Terminal 410 recovery from SHARE_STATUS:<shareId>
        const tombstone = await driverGetShareStatus(shareId, env)
        if (tombstone?.status === 'burned' || tombstone?.status === 'expired') {
            if (!isMaintenanceMode(env)) {
                let pinPath = '__legacy_terminal__'
                let pinUid = '__legacy_terminal__'
                if (tombstone.path) {
                    const ownerRow = await db.prepare('SELECT path, metadata FROM notes WHERE path = ? LIMIT 1').bind(tombstone.path).first()
                    if (ownerRow) {
                        const ownerMeta = parseMetaSafe(ownerRow.metadata)
                        if (ownerMeta.noteUid && resolveLegacyToken(ownerMeta) === shareId) {
                            pinPath = ownerRow.path
                            pinUid = ownerMeta.noteUid
                        }
                    }
                }
                await pinLegacyTerminalRegistryEntry(db, shareId, pinPath, pinUid, tombstone.status, nowUnix)
            }
            return { status: tombstone.status, shareId, isCsprngV1: false }
        }
    } catch (err) {
        if (err instanceof StorageAuthorityError) throw err
        throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 share resolution failed: ${err?.message || err}`)
    }

    return { status: 'not_found' }
}

export async function resolveAuthoritativeShareMetadata(shareId, options = {}) {
    return await resolveAuthoritativeShare(shareId, { ...options, includeContent: false })
}

/**
 * Query a share mapping (shareId -> path) without path/MD5 alias fallbacks.
 * @param {string} shareId - Share ID or slug
 * @returns {Promise<string|null>} Target note path
 */
export async function driverQueryShare(shareId, env = globalThis) {
    const resolved = await resolveAuthoritativeShareMetadata(shareId, { env })
    return resolved?.status === 'active' ? (resolved.path || null) : null
}

/**
 * Put a share mapping in pure-KV mode (or non-registry helper).
 * Never executes ON CONFLICT DO UPDATE in D1.
 */
export async function driverPutShare(shareId, path, options = {}, env = globalThis) {
    if (!shareId || !path) return
    const md5Path = await md5Hex(path)
    if (!isCanonicalShareToken(shareId, path, md5Path)) return

    const kv = getShareKv(env)
    if (kv) {
        const kvOptions = {}
        const now = Math.floor(Date.now() / 1000)
        if (options?.expiration && Number(options.expiration) > now + 60) {
            kvOptions.expiration = Number(options.expiration)
        } else if (options?.expirationTtl && Number(options.expirationTtl) >= 60) {
            kvOptions.expirationTtl = Number(options.expirationTtl)
        }
        await kv.put(shareId, path, kvOptions)
    }
}

/**
 * Delete a share mapping
 * @param {string} shareId - Share ID
 */
export async function driverDeleteShare(shareId, env = globalThis) {
    if (!shareId) return
    const db = isNotesRegistryEnabled(env) ? getStorageDb(env) : null
    const kv = getShareKv(env)

    if (db) {
        try {
            await db.prepare('DELETE FROM shares WHERE share_id = ?').bind(shareId).run()
        } catch (err) {
            throw new StorageAuthorityError('STORAGE_UNAVAILABLE', `D1 delete share failed: ${err?.message || err}`)
        }
    }

    if (kv && typeof kv.delete === 'function') {
        await kv.delete(shareId)
    }
}

/**
 * Record share status (e.g. burned, expired) in tombstone cache
 * @param {string} shareId
 * @param {'burned' | 'expired' | 'unshared'} status
 * @param {object} details
 */
export async function driverSetShareStatus(shareId, status, details = {}, env = globalThis) {
    if (!shareId) return
    const kv = getShareKv(env)
    if (!kv) return
    if (!status) {
        try {
            if (typeof kv.delete === 'function') {
                await kv.delete(`SHARE_STATUS:${shareId}`)
            }
        } catch (err) {
            console.warn('KV Delete Share Status Error:', err)
        }
        return
    }
    try {
        await kv.put(`SHARE_STATUS:${shareId}`, JSON.stringify({
            status,
            ...details,
            updatedAt: Math.floor(Date.now() / 1000),
        }), { expirationTtl: 7 * 86400 })
    } catch (err) {
        console.warn('KV Set Share Status Error:', err)
    }
}

/**
 * Retrieve recorded share status from tombstone cache
 * @param {string} shareId
 */
export async function driverGetShareStatus(shareId, env = globalThis) {
    if (!shareId) return null
    const kv = getShareKv(env)
    if (kv) {
        try {
            const raw = await kv.get(`SHARE_STATUS:${shareId}`)
            if (raw) return JSON.parse(raw)
        } catch {}
    }
    return null
}

/**
 * Legacy helper retained only for explicit canonical shareSlug/shareId D1 lookup without path probing.
 * @param {string} shareId
 */
export async function driverFindNoteByShareId(shareId, env = globalThis) {
    const db = getStorageDb(env)
    if (!db || !shareId || !isCanonicalShareToken(shareId)) return null
    try {
        const row = await db.prepare(`
            SELECT path, metadata, content FROM notes
            WHERE (
                json_extract(metadata, '$.shareSlug') = ?
                OR json_extract(metadata, '$.shareId') = ?
            )
            LIMIT 1
        `).bind(shareId, shareId).first()
        if (row && row.path) {
            const md5Path = await md5Hex(row.path)
            if (!isCanonicalShareToken(shareId, row.path, md5Path)) return null
            const metadata = parseMetaSafe(row.metadata)
            return { path: row.path, metadata, value: row.content || '' }
        }
    } catch (err) {
        console.warn('driverFindNoteByShareId error:', err)
    }
    return null
}

const IN_FLIGHT_CLAIMS = new Map()

function generateClaimNonce(now) {
    return `${now}-${generateNonce()}`
}

/**
 * Atomically claim a burn-after-reading note to prevent concurrent double-read
 * @param {string} shareId
 * @param {string} path
 * @param {number} now
 * @returns {Promise<boolean>} true if successfully claimed, false if already burned
 */
export async function driverClaimBurnShare(shareId, path, now = Math.floor(Date.now() / 1000)) {
    const result = await driverRecordBurnView(shareId, path, 1, now)
    return result.claimed
}

/**
 * Atomically records a view against a burn-after-reading / max-views share.
 * Burns the share when viewCount reaches maxViews (default 1).
 * @returns {Promise<{ claimed: boolean, burned: boolean, viewCount: number }>}
 */
export async function driverRecordBurnView(shareId, path, maxViews = 1, now = Math.floor(Date.now() / 1000), env = globalThis) {
    if (!shareId || !path) return { claimed: false, burned: false, viewCount: 0 }
    const targetMaxViews = Math.max(1, Number(maxViews) || 1)
    const kv = getShareKv(env)
    const notesKv = getNotesKv(env)
    const driver = getStorageDriverName(env)
    const db = isNotesRegistryEnabled(env) ? await assertNotesAuthorityReady(env) : null

    if (IN_FLIGHT_CLAIMS.has(shareId)) {
        return { claimed: false, burned: false, viewCount: 0 }
    }
    IN_FLIGHT_CLAIMS.set(shareId, now)

    try {
        // Check registry / KV tombstone first
        if (db) {
            const reg = await db.prepare('SELECT revoked_at, revoked_reason FROM share_token_registry WHERE share_id = ? LIMIT 1').bind(shareId).first()
            if (reg && reg.revoked_at !== null) {
                return { claimed: false, burned: reg.revoked_reason === 'burned', viewCount: targetMaxViews }
            }
        }
        const tombstone = await driverGetShareStatus(shareId, env)
        if (tombstone?.status === 'burned') {
            return { claimed: false, burned: true, viewCount: targetMaxViews }
        }

        let burnedNow = targetMaxViews <= 1
        let nextViewCount = 1

        if (db && (driver === 'd1' || driver === 'auto')) {
            for (let attempt = 0; attempt < 3; attempt += 1) {
                let row = await db.prepare('SELECT metadata FROM notes WHERE path = ? LIMIT 1').bind(path).first()
                if (!row) {
                    return { claimed: false, burned: false, conflict: true, viewCount: 0 }
                }
                let meta = parseMetaSafe(row.metadata)
                if (!meta.noteUid) {
                    await claimLegacyD1NoteUid(db, path, now)
                    row = await db.prepare('SELECT metadata FROM notes WHERE path = ? LIMIT 1').bind(path).first()
                    if (!row) return { claimed: false, burned: false, conflict: true, viewCount: 0 }
                    meta = parseMetaSafe(row.metadata)
                }

                if (meta.share !== true || isShareBurned(meta)) {
                    return { claimed: false, burned: true, viewCount: targetMaxViews }
                }
                const currentVc = Number(meta.shareViewCount || 0)
                if (currentVc >= targetMaxViews) {
                    return { claimed: false, burned: true, viewCount: currentVc }
                }

                const noteUid = meta.noteUid
                const baseVersion = Number(meta.metaVersion || 0)
                const nextMetaVersion = baseVersion + 1
                const opNonce = generateNonce()

                nextViewCount = currentVc + 1
                burnedNow = nextViewCount >= targetMaxViews

                const nextMeta = {
                    ...meta,
                    metaVersion: nextMetaVersion,
                    shareOpNonce: opNonce,
                    shareViewCount: nextViewCount,
                    ...(burnedNow ? { share: false, shareBurnedAt: now } : {}),
                }
                const nextMetaJson = JSON.stringify(nextMeta)

                const stmts = [
                    db.prepare(`
                        UPDATE notes
                        SET metadata = ?
                        WHERE path = ?
                          AND json_extract(metadata, '$.noteUid') = ?
                          AND COALESCE(CAST(json_extract(metadata, '$.metaVersion') AS INTEGER), 0) = ?
                          AND json_extract(metadata, '$.share') = 1
                          AND NOT (${IS_LEGACY_BURNED_SQL})
                          AND COALESCE(CAST(json_extract(metadata, '$.shareViewCount') AS INTEGER), 0) < ?
                    `).bind(nextMetaJson, path, noteUid, baseVersion, targetMaxViews),
                ]

                if (burnedNow) {
                    stmts.push(
                        db.prepare(`
                            UPDATE share_token_registry
                            SET revoked_at = ?,
                                revoked_reason = 'burned'
                            WHERE target_path = ?
                              AND note_uid = ?
                              AND revoked_at IS NULL
                              AND EXISTS (
                                  SELECT 1 FROM notes
                                  WHERE path = ?
                                    AND json_extract(metadata, '$.noteUid') = ?
                                    AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                                    AND json_extract(metadata, '$.shareOpNonce') = ?
                              )
                        `).bind(now, path, noteUid, path, noteUid, nextMetaVersion, opNonce),
                        db.prepare(`
                            DELETE FROM shares
                            WHERE path = ?
                              AND EXISTS (
                                  SELECT 1 FROM notes
                                  WHERE path = ?
                                    AND json_extract(metadata, '$.noteUid') = ?
                                    AND CAST(json_extract(metadata, '$.metaVersion') AS INTEGER) = ?
                                    AND json_extract(metadata, '$.shareOpNonce') = ?
                              )
                        `).bind(path, path, noteUid, nextMetaVersion, opNonce),
                    )
                }

                const results = await db.batch(stmts)
                if (Number(results?.[0]?.meta?.changes ?? 0) === 1) {
                    if (driver === 'auto' && notesKv) {
                        const kvCurrent = await notesKv.getWithMetadata(path).catch(() => null)
                        if (kvCurrent !== null) {
                            await notesKv.put(path, kvCurrent.value || '', { metadata: nextMeta }).catch(() => {})
                        }
                    }
                    if (burnedNow) {
                        if (kv && typeof kv.delete === 'function') {
                            await kv.delete(shareId).catch(() => {})
                        }
                        await driverSetShareStatus(shareId, 'burned', { burnedAt: now, path }, env)
                    }
                    return { claimed: true, burned: burnedNow, viewCount: nextViewCount }
                }

                // Re-check whether burned vs benign metaVersion conflict
                const afterRow = await db.prepare('SELECT metadata FROM notes WHERE path = ? LIMIT 1').bind(path).first()
                if (!afterRow) return { claimed: false, burned: false, conflict: true, viewCount: 0 }
                const afterMeta = parseMetaSafe(afterRow.metadata)
                if (afterMeta.share !== true || isShareBurned(afterMeta) || Number(afterMeta.shareViewCount || 0) >= targetMaxViews) {
                    return { claimed: false, burned: true, viewCount: targetMaxViews }
                }
            }
            return { claimed: false, burned: false, conflict: true, viewCount: 0 }
        }

        // Pure KV mode
        if (kv && targetMaxViews <= 1) {
            try {
                const claimKey = `SHARE_CLAIM:${shareId}`
                const claimNonce = generateClaimNonce(now)
                await kv.put(claimKey, claimNonce, { expirationTtl: 300 })
                const registeredNonce = await kv.get(claimKey)
                if (registeredNonce && registeredNonce !== claimNonce) {
                    return { claimed: false, burned: true, viewCount: targetMaxViews }
                }
            } catch (err) {
                console.warn('KV Claim Nonce Error:', err)
            }
        }

        if (notesKv) {
            const current = await notesKv.getWithMetadata(path)
            if (current?.metadata) {
                const currentViews = Number(current.metadata.shareViewCount || 0)
                if (isShareBurned(current.metadata) || currentViews >= targetMaxViews) {
                    return { claimed: false, burned: true, viewCount: currentViews }
                }
                nextViewCount = Math.max(nextViewCount, currentViews + 1)
                burnedNow = burnedNow || nextViewCount >= targetMaxViews
                const nextMeta = burnedNow
                    ? { ...current.metadata, share: false, shareBurnedAt: now, shareViewCount: nextViewCount }
                    : { ...current.metadata, shareViewCount: nextViewCount }
                await notesKv.put(path, current.value || '', { metadata: nextMeta })
            }
        }

        if (burnedNow) {
            if (kv && typeof kv.delete === 'function') {
                await kv.delete(shareId).catch(() => {})
            }
            await driverSetShareStatus(shareId, 'burned', { burnedAt: now, path }, env)
        }

        return { claimed: true, burned: burnedNow, viewCount: nextViewCount }
    } finally {
        IN_FLIGHT_CLAIMS.delete(shareId)
    }
}
