import { isNotesRegistryEnabled } from './storage_driver.mjs'

export function getNoteStatsDb(env = globalThis) {
    const source = env ?? globalThis
    return source?.APP_DB || source?.NOTE_HISTORY_DB || null
}

const VIEW_DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VIEW_DEVICE_HASH_PATTERN = /^[0-9a-f]{64}$/i

export function resolveViewDeviceId(cookieValue, createDeviceId = () => crypto.randomUUID()) {
    if (typeof cookieValue === 'string' && VIEW_DEVICE_ID_PATTERN.test(cookieValue)) {
        return {
            deviceId: cookieValue,
            isNew: false,
        }
    }

    const deviceId = createDeviceId()
    if (typeof deviceId !== 'string' || !VIEW_DEVICE_ID_PATTERN.test(deviceId)) {
        throw new Error('Unable to create a valid view device id')
    }

    return {
        deviceId,
        isNew: true,
    }
}

export async function hashViewDeviceId(deviceId) {
    if (typeof deviceId !== 'string' || !VIEW_DEVICE_ID_PATTERN.test(deviceId)) return null

    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(deviceId),
    )

    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('')
}

export function shouldCountShareView({
    method,
    presentationMode,
    embedMode,
    acceptsMarkdown,
}) {
    return method === 'GET'
        && presentationMode !== true
        && embedMode !== true
        && acceptsMarkdown !== true
}

export async function getNoteViewCount(db, path, options = {}) {
    if (!db || typeof path !== 'string' || !path) return null

    const opts = typeof options === 'string' ? { noteUid: options } : (options || {})
    const noteUid = typeof opts.noteUid === 'string' ? opts.noteUid : ''
    const registryActive = opts.useUid !== undefined
        ? Boolean(opts.useUid)
        : isNotesRegistryEnabled(opts.env ?? globalThis)

    if (registryActive) {
        if (!noteUid) return 0
        const row = await db.prepare(`
            SELECT views AS view_count
            FROM note_stats_uid
            WHERE path = ? AND note_uid = ?
            LIMIT 1
        `).bind(path, noteUid).first()
        const count = Number(row?.view_count ?? 0)
        return Number.isSafeInteger(count) && count >= 0 ? count : 0
    }

    const row = await db.prepare(`
        SELECT view_count
        FROM note_stats
        WHERE path = ?
        LIMIT 1
    `).bind(path).first()
    const count = Number(row?.view_count ?? 0)

    return Number.isSafeInteger(count) && count >= 0 ? count : 0
}

export async function recordUniqueNoteView(
    db,
    path,
    deviceHash,
    nowSecondsOrOptions = Math.floor(Date.now() / 1000),
    maybeOptions = {},
) {
    const opts = typeof nowSecondsOrOptions === 'object' && nowSecondsOrOptions !== null
        ? nowSecondsOrOptions
        : (maybeOptions || {})
    const nowSeconds = typeof nowSecondsOrOptions === 'number'
        ? nowSecondsOrOptions
        : (opts.nowSeconds ?? Math.floor(Date.now() / 1000))
    const noteUid = typeof opts.noteUid === 'string' ? opts.noteUid : ''
    const registryActive = opts.useUid !== undefined
        ? Boolean(opts.useUid)
        : isNotesRegistryEnabled(opts.env ?? globalThis)

    if (
        !db
        || typeof db.batch !== 'function'
        || typeof path !== 'string'
        || !path
        || typeof deviceHash !== 'string'
        || !VIEW_DEVICE_HASH_PATTERN.test(deviceHash)
    ) {
        return {
            viewCount: null,
            isUnique: false,
        }
    }

    if (registryActive) {
        if (!noteUid) {
            return {
                viewCount: null,
                isUnique: false,
            }
        }
        const results = await db.batch([
            db.prepare(`
                INSERT OR IGNORE INTO note_view_devices_uid (path, note_uid, device_hash, first_viewed_at)
                VALUES (?, ?, ?, ?)
            `).bind(path, noteUid, deviceHash, nowSeconds),
            db.prepare(`
                INSERT INTO note_stats_uid (path, note_uid, views, updated_at)
                SELECT ?, ?, 1, ?
                WHERE changes() = 1
                ON CONFLICT (path, note_uid) DO UPDATE SET
                    views = note_stats_uid.views + 1,
                    updated_at = excluded.updated_at
            `).bind(path, noteUid, nowSeconds),
            db.prepare(`
                SELECT views AS view_count
                FROM note_stats_uid
                WHERE path = ? AND note_uid = ?
                LIMIT 1
            `).bind(path, noteUid),
        ])

        const insertionChanges = Number(results?.[0]?.meta?.changes ?? 0)
        const count = Number(results?.[2]?.results?.[0]?.view_count ?? 0)

        return {
            viewCount: Number.isSafeInteger(count) && count >= 0 ? count : 0,
            isUnique: insertionChanges === 1,
        }
    }

    const results = await db.batch([
        db.prepare(`
            INSERT OR IGNORE INTO note_view_devices (path, device_hash, first_viewed_at)
            VALUES (?, ?, ?)
        `).bind(path, deviceHash, nowSeconds),
        db.prepare(`
            INSERT INTO note_stats (path, view_count, last_viewed_at)
            SELECT ?, 1, ?
            WHERE changes() = 1
            ON CONFLICT (path) DO UPDATE SET
                view_count = note_stats.view_count + 1,
                last_viewed_at = excluded.last_viewed_at
        `).bind(path, nowSeconds),
        db.prepare(`
            SELECT view_count
            FROM note_stats
            WHERE path = ?
            LIMIT 1
        `).bind(path),
    ])

    const insertionChanges = Number(results?.[0]?.meta?.changes ?? 0)
    const count = Number(results?.[2]?.results?.[0]?.view_count ?? 0)

    return {
        viewCount: Number.isSafeInteger(count) && count >= 0 ? count : 0,
        isUnique: insertionChanges === 1,
    }
}
