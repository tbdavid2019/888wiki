import { StorageAuthorityError, isNotesRegistryEnabled } from './storage_driver.mjs'

const DEFAULT_NOTE_HISTORY_LIMIT = 10
const DEFAULT_NOTE_HISTORY_MIN_INTERVAL_SECONDS = 300
const VERIFIED_HISTORY_META_DBS = new WeakSet()

function readRuntimeVar(name, env = globalThis) {
    const source = env ?? globalThis
    return source?.[name]
}

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10)
    return Number.isFinite(parsed) ? parsed : fallback
}

function parseNonNegativeInteger(value, fallback) {
    const parsed = parseInteger(value, fallback)
    return parsed >= 0 ? parsed : fallback
}

export function getNoteHistoryDb(env = globalThis) {
    return readRuntimeVar('NOTE_HISTORY_DB', env) || null
}

export function getNoteHistoryLimit(env = globalThis) {
    return parseNonNegativeInteger(readRuntimeVar('SCN_NOTE_HISTORY_LIMIT', env), DEFAULT_NOTE_HISTORY_LIMIT)
}

export function getNoteHistoryMinIntervalSeconds(env = globalThis) {
    return parseNonNegativeInteger(
        readRuntimeVar('SCN_NOTE_HISTORY_MIN_INTERVAL_SECONDS', env),
        DEFAULT_NOTE_HISTORY_MIN_INTERVAL_SECONDS,
    )
}

export function getLegacyHistoryRetentionDays(env = globalThis) {
    return parseNonNegativeInteger(readRuntimeVar('SCN_LEGACY_HISTORY_RETENTION_DAYS', env), 0)
}

export function isNoteHistoryConfigured(env = globalThis) {
    return String(readRuntimeVar('SCN_ENABLE_NOTE_HISTORY', env) || '0').trim() === '1'
}

export function getNoteHistoryConfig(env = globalThis) {
    const enabled = isNoteHistoryConfigured(env)
    return {
        enabled,
        limit: getNoteHistoryLimit(env),
        minIntervalSeconds: getNoteHistoryMinIntervalSeconds(env),
        db: enabled ? getNoteHistoryDb(env) : null,
    }
}

export async function hasNoteHistoryMetaTable(db) {
    if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') {
        return false
    }
    if (VERIFIED_HISTORY_META_DBS.has(db)) {
        return true
    }
    try {
        const row = await db.prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'note_history_meta' LIMIT 1"
        ).first()
        if (row?.name === 'note_history_meta') {
            VERIFIED_HISTORY_META_DBS.add(db)
            return true
        }
    } catch {}
    return false
}

async function resolveHistoryMode(db, options = {}) {
    const env = options?.env ?? globalThis
    const registryEnabled = options?.useUid !== undefined
        ? Boolean(options.useUid)
        : isNotesRegistryEnabled(env)
    const noteUid = typeof options?.noteUid === 'string' ? options.noteUid : ''
    const hasMeta = await hasNoteHistoryMetaTable(db)

    if (registryEnabled && !hasMeta) {
        throw new StorageAuthorityError('D1_SCHEMA_MISSING', 'Missing required note_history_meta table on historyDb')
    }

    return { registryEnabled, noteUid, hasMeta }
}

export function shouldSaveNoteHistory({
    enabled,
    limit,
    previousContent,
    nextContent,
    latestVersion = null,
    nowSeconds,
    minIntervalSeconds,
    force = false,
}) {
    if (!enabled || limit <= 0) return false

    const before = typeof previousContent === 'string' ? previousContent : String(previousContent || '')
    const after = typeof nextContent === 'string' ? nextContent : String(nextContent || '')

    if (before === after) return false
    if (!before && !latestVersion) return false

    if (latestVersion?.content === before) return false

    if (!force && latestVersion?.created_at) {
        const lastSavedAt = Number(latestVersion.created_at)
        if (Number.isFinite(lastSavedAt) && nowSeconds - lastSavedAt < minIntervalSeconds) {
            return false
        }
    }

    return true
}

async function getFirstResult(statement) {
    if (!statement) return null
    if (typeof statement.first === 'function') return await statement.first()
    const result = await statement.all()
    if (Array.isArray(result?.results)) return result.results[0] || null
    return null
}

async function getAllResults(statement) {
    if (!statement) return []
    const result = await statement.all()
    return Array.isArray(result?.results) ? result.results : []
}

export async function getLatestNoteHistoryVersion(db, path, options = {}) {
    if (!db || typeof path !== 'string' || !path) return null
    const opts = typeof options === 'string' ? { noteUid: options } : (options || {})
    const { registryEnabled, noteUid, hasMeta } = await resolveHistoryMode(db, opts)

    if (registryEnabled) {
        if (!noteUid) return null
        return await getFirstResult(
            db.prepare(`
                SELECT h.id, h.path, h.content, h.created_at
                FROM note_history h
                INNER JOIN note_history_meta m ON m.history_id = h.id
                WHERE h.path = ?
                  AND m.path = ?
                  AND m.note_uid = ?
                ORDER BY h.created_at DESC, h.id DESC
                LIMIT 1
            `).bind(path, path, noteUid)
        )
    }

    const excludeTaggedClause = hasMeta
        ? 'AND NOT EXISTS (SELECT 1 FROM note_history_meta m WHERE m.history_id = note_history.id)'
        : ''
    return await getFirstResult(
        db.prepare(`
            SELECT id, path, content, created_at
            FROM note_history
            WHERE path = ?
              ${excludeTaggedClause}
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        `).bind(path)
    )
}

export async function listNoteHistoryVersions(db, path, limit, options = {}) {
    if (!db || typeof path !== 'string' || !path || limit <= 0) return []
    const opts = typeof options === 'string' ? { noteUid: options } : (options || {})
    const { registryEnabled, noteUid, hasMeta } = await resolveHistoryMode(db, opts)

    if (registryEnabled) {
        if (!noteUid) return []
        return await getAllResults(
            db.prepare(`
                SELECT h.id, h.path, h.content, h.created_at, length(h.content) AS content_length
                FROM note_history h
                INNER JOIN note_history_meta m ON m.history_id = h.id
                WHERE h.path = ?
                  AND m.path = ?
                  AND m.note_uid = ?
                ORDER BY h.created_at DESC, h.id DESC
                LIMIT ?
            `).bind(path, path, noteUid, limit)
        )
    }

    const excludeTaggedClause = hasMeta
        ? 'AND NOT EXISTS (SELECT 1 FROM note_history_meta m WHERE m.history_id = note_history.id)'
        : ''
    return await getAllResults(
        db.prepare(`
            SELECT id, path, content, created_at, length(content) AS content_length
            FROM note_history
            WHERE path = ?
              ${excludeTaggedClause}
            ORDER BY created_at DESC, id DESC
            LIMIT ?
        `).bind(path, limit)
    )
}

export async function getNoteHistoryCounts(db, pathsOrItems = [], options = {}) {
    if (!db || !Array.isArray(pathsOrItems) || pathsOrItems.length === 0) return new Map()
    const { registryEnabled, hasMeta } = await resolveHistoryMode(db, options)

    const counts = new Map()

    if (registryEnabled) {
        const pairs = []
        const seen = new Set()
        for (const item of pathsOrItems) {
            const path = typeof item === 'string' ? item : item?.path
            const noteUid = typeof item === 'object' && item !== null ? (item.noteUid || '') : ''
            if (typeof path !== 'string' || !path) continue
            if (!noteUid) {
                counts.set(path, 0)
                continue
            }
            const key = `${path}\0${noteUid}`
            if (!seen.has(key)) {
                seen.add(key)
                pairs.push({ path, noteUid })
            }
        }

        for (let index = 0; index < pairs.length; index += 40) {
            const chunk = pairs.slice(index, index + 40)
            const conditions = chunk.map(() => '(m.path = ? AND m.note_uid = ?)').join(' OR ')
            const bindings = chunk.flatMap(p => [p.path, p.noteUid])
            const result = await db.prepare(`
                SELECT m.path, COUNT(*) AS version_count
                FROM note_history h
                INNER JOIN note_history_meta m ON m.history_id = h.id
                WHERE (${conditions})
                GROUP BY m.path, m.note_uid
            `).bind(...bindings).all()

            for (const row of result?.results || []) {
                counts.set(row.path, Number(row.version_count || 0))
            }
        }
        return counts
    }

    const uniquePaths = [...new Set(
        pathsOrItems
            .map(item => (typeof item === 'string' ? item : item?.path))
            .filter(path => typeof path === 'string' && path)
    )]
    if (uniquePaths.length === 0) return new Map()

    const excludeTaggedClause = hasMeta
        ? 'AND NOT EXISTS (SELECT 1 FROM note_history_meta m WHERE m.history_id = note_history.id)'
        : ''

    // Keep each statement comfortably below SQLite/D1 bound-variable limits.
    for (let index = 0; index < uniquePaths.length; index += 100) {
        const chunk = uniquePaths.slice(index, index + 100)
        const placeholders = chunk.map(() => '?').join(', ')
        const result = await db.prepare(`
            SELECT path, COUNT(*) AS version_count
            FROM note_history
            WHERE path IN (${placeholders})
              ${excludeTaggedClause}
            GROUP BY path
        `).bind(...chunk).all()

        for (const row of result?.results || []) {
            counts.set(row.path, Number(row.version_count || 0))
        }
    }

    return counts
}

export async function getNoteHistoryVersionById(db, path, id, options = {}) {
    if (!db || typeof path !== 'string' || !path) return null
    const opts = typeof options === 'string' ? { noteUid: options } : (options || {})
    const { registryEnabled, noteUid, hasMeta } = await resolveHistoryMode(db, opts)

    if (registryEnabled) {
        if (!noteUid) return null
        return await getFirstResult(
            db.prepare(`
                SELECT h.id, h.path, h.content, h.created_at
                FROM note_history h
                INNER JOIN note_history_meta m ON m.history_id = h.id
                WHERE h.path = ?
                  AND h.id = ?
                  AND m.path = ?
                  AND m.note_uid = ?
                LIMIT 1
            `).bind(path, id, path, noteUid)
        )
    }

    const excludeTaggedClause = hasMeta
        ? 'AND NOT EXISTS (SELECT 1 FROM note_history_meta m WHERE m.history_id = note_history.id)'
        : ''
    return await getFirstResult(
        db.prepare(`
            SELECT id, path, content, created_at
            FROM note_history
            WHERE path = ? AND id = ?
              ${excludeTaggedClause}
            LIMIT 1
        `).bind(path, id)
    )
}

export async function insertNoteHistoryVersion(db, { path, noteUid = '', content, createdAt, useUid, env } = {}) {
    if (!db || typeof path !== 'string' || !path) return null
    const { registryEnabled } = await resolveHistoryMode(db, { noteUid, useUid, env })

    if (registryEnabled) {
        if (!noteUid) return null
        return await db.batch([
            db.prepare(`
                INSERT INTO note_history (path, content, created_at)
                VALUES (?, ?, ?)
            `).bind(path, content, createdAt),
            db.prepare(`
                INSERT INTO note_history_meta (history_id, path, note_uid, created_at)
                VALUES (last_insert_rowid(), ?, ?, ?)
            `).bind(path, noteUid, createdAt),
        ])
    }

    return await db.prepare(`
        INSERT INTO note_history (path, content, created_at)
        VALUES (?, ?, ?)
    `).bind(path, content, createdAt).run()
}

export async function pruneNoteHistoryVersions(db, path, limit, options = {}) {
    if (!db || typeof path !== 'string' || !path) return null
    const opts = typeof options === 'string' ? { noteUid: options } : (options || {})
    const { registryEnabled, noteUid, hasMeta } = await resolveHistoryMode(db, opts)

    if (registryEnabled) {
        if (!noteUid) return null
        if (limit <= 0) {
            return await db.batch([
                db.prepare(`
                    DELETE FROM note_history
                    WHERE id IN (
                        SELECT history_id FROM note_history_meta
                        WHERE path = ? AND note_uid = ?
                    )
                `).bind(path, noteUid),
                db.prepare(`
                    DELETE FROM note_history_meta
                    WHERE path = ? AND note_uid = ?
                `).bind(path, noteUid),
            ])
        }

        return await db.batch([
            db.prepare(`
                DELETE FROM note_history
                WHERE id IN (
                    SELECT m.history_id
                    FROM note_history_meta m
                    WHERE m.path = ? AND m.note_uid = ?
                      AND m.history_id NOT IN (
                          SELECT m2.history_id
                          FROM note_history_meta m2
                          INNER JOIN note_history h2 ON h2.id = m2.history_id
                          WHERE m2.path = ? AND m2.note_uid = ?
                          ORDER BY h2.created_at DESC, h2.id DESC
                          LIMIT ?
                      )
                )
            `).bind(path, noteUid, path, noteUid, limit),
            db.prepare(`
                DELETE FROM note_history_meta
                WHERE path = ? AND note_uid = ?
                  AND history_id NOT IN (SELECT id FROM note_history WHERE path = ?)
            `).bind(path, noteUid, path),
        ])
    }

    const excludeTaggedClause = hasMeta
        ? 'AND NOT EXISTS (SELECT 1 FROM note_history_meta m WHERE m.history_id = note_history.id)'
        : ''

    if (limit <= 0) {
        return await db.prepare(`
            DELETE FROM note_history
            WHERE path = ?
              ${excludeTaggedClause}
        `).bind(path).run()
    }

    return await db.prepare(`
        DELETE FROM note_history
        WHERE path = ?
          ${excludeTaggedClause}
          AND id NOT IN (
              SELECT id
              FROM note_history
              WHERE path = ?
                ${excludeTaggedClause}
              ORDER BY created_at DESC, id DESC
              LIMIT ?
          )
    `).bind(path, path, limit).run()
}

export async function deleteNoteHistoryVersions(db, path, options = {}) {
    if (!db || typeof path !== 'string' || !path) return null
    const opts = typeof options === 'string' ? { noteUid: options } : (options || {})
    const { registryEnabled, noteUid, hasMeta } = await resolveHistoryMode(db, opts)

    if (registryEnabled) {
        if (!noteUid || noteUid === '__legacy__') return null
        return await db.batch([
            db.prepare(`
                DELETE FROM note_history
                WHERE id IN (
                    SELECT history_id FROM note_history_meta
                    WHERE path = ? AND note_uid = ?
                )
            `).bind(path, noteUid),
            db.prepare(`
                DELETE FROM note_history_meta
                WHERE path = ? AND note_uid = ?
            `).bind(path, noteUid),
        ])
    }

    const excludeTaggedClause = hasMeta
        ? 'AND NOT EXISTS (SELECT 1 FROM note_history_meta m WHERE m.history_id = note_history.id)'
        : ''
    return await db.prepare(`
        DELETE FROM note_history
        WHERE path = ?
          ${excludeTaggedClause}
    `).bind(path).run()
}

export async function saveNoteHistoryVersionIfNeeded({
    db,
    enabled,
    limit,
    minIntervalSeconds,
    path,
    noteUid = '',
    previousContent,
    nextContent,
    nowSeconds = Math.floor(Date.now() / 1000),
    force = false,
    useUid,
    env = globalThis,
}) {
    if (!db) return { saved: false, reason: 'db_unavailable' }
    const { registryEnabled } = await resolveHistoryMode(db, { noteUid, useUid, env })

    if (registryEnabled && !noteUid) {
        return { saved: false, reason: 'missing_note_uid' }
    }

    const latestVersion = await getLatestNoteHistoryVersion(db, path, { noteUid, useUid, env })
    const shouldSave = shouldSaveNoteHistory({
        enabled,
        limit,
        previousContent,
        nextContent,
        latestVersion,
        nowSeconds,
        minIntervalSeconds,
        force,
    })

    if (!shouldSave) {
        return { saved: false, reason: 'skipped', latestVersion }
    }

    const contentToSave = typeof previousContent === 'string' ? previousContent : String(previousContent || '')
    if (registryEnabled) {
        await db.batch([
            db.prepare(`
                INSERT INTO note_history (path, content, created_at)
                VALUES (?, ?, ?)
            `).bind(path, contentToSave, nowSeconds),
            db.prepare(`
                INSERT INTO note_history_meta (history_id, path, note_uid, created_at)
                VALUES (last_insert_rowid(), ?, ?, ?)
            `).bind(path, noteUid, nowSeconds),
            db.prepare(`
                DELETE FROM note_history
                WHERE id IN (
                    SELECT m.history_id
                    FROM note_history_meta m
                    WHERE m.path = ? AND m.note_uid = ?
                      AND m.history_id NOT IN (
                          SELECT m2.history_id
                          FROM note_history_meta m2
                          INNER JOIN note_history h2 ON h2.id = m2.history_id
                          WHERE m2.path = ? AND m2.note_uid = ?
                          ORDER BY h2.created_at DESC, h2.id DESC
                          LIMIT ?
                      )
                )
            `).bind(path, noteUid, path, noteUid, limit),
            db.prepare(`
                DELETE FROM note_history_meta
                WHERE path = ? AND note_uid = ?
                  AND history_id NOT IN (SELECT id FROM note_history WHERE path = ?)
            `).bind(path, noteUid, path),
        ])
        return { saved: true, latestVersion }
    }

    await insertNoteHistoryVersion(db, {
        path,
        noteUid,
        content: contentToSave,
        createdAt: nowSeconds,
        useUid,
        env,
    })
    await pruneNoteHistoryVersions(db, path, limit, { noteUid, useUid, env })

    return { saved: true, latestVersion }
}

export {
    DEFAULT_NOTE_HISTORY_LIMIT,
    DEFAULT_NOTE_HISTORY_MIN_INTERVAL_SECONDS,
}
