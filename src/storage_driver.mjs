/**
 * Pluggable Storage Driver for CF-Notepad (david888 wiki)
 * Supports:
 *  - 'kv': Cloudflare Workers KV (Default, zero D1 requirements)
 *  - 'd1': Cloudflare D1 Database (SQLite)
 *  - 'auto' / 'dual': Hybrid Migration Driver.
 *     Reads: Tries D1 first -> falls back to KV if not yet in D1.
 *     Writes: Writes to both D1 (if available) and KV to guarantee zero data loss.
 */

function readRuntimeVar(name) {
    return globalThis?.[name]
}

export function getStorageDriverName() {
    const driver = String(readRuntimeVar('SCN_STORAGE_DRIVER') || 'auto').trim().toLowerCase()
    if (['kv', 'd1', 'auto', 'dual'].includes(driver)) {
        return driver === 'dual' ? 'auto' : driver
    }
    return 'auto'
}

export function getStorageDb() {
    return readRuntimeVar('NOTES_DB') || readRuntimeVar('NOTE_HISTORY_DB') || readRuntimeVar('DB') || null
}

export function getNotesKv() {
    return readRuntimeVar('NOTES') || null
}

export function getShareKv() {
    return readRuntimeVar('SHARE') || null
}

/**
 * Query note content and metadata
 * @param {string} path - Note path
 * @returns {Promise<{ value: string, metadata: object }>}
 */
export async function driverQueryNote(path) {
    const driver = getStorageDriverName()
    const db = getStorageDb()
    const kv = getNotesKv()

    // Try D1 if driver is 'd1' or 'auto'
    if ((driver === 'd1' || driver === 'auto') && db) {
        try {
            const row = await db.prepare('SELECT content, metadata FROM notes WHERE path = ?').bind(path).first()
            if (row) {
                let parsedMeta = {}
                try {
                    parsedMeta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {})
                } catch {
                    parsedMeta = {}
                }
                return {
                    value: row.content || '',
                    metadata: parsedMeta,
                }
            }
        } catch (err) {
            // If table doesn't exist yet or DB error in auto mode, proceed to fallback
            if (driver === 'd1') {
                console.error('D1 Query Error:', err)
            }
        }
    }

    // Fallback to KV if driver is 'kv' or 'auto'
    if (kv) {
        const result = await kv.getWithMetadata(path)
        return {
            value: result?.value || '',
            metadata: result?.metadata || {},
        }
    }

    return { value: '', metadata: {} }
}

/**
 * Write note content and metadata
 * @param {string} path - Note path
 * @param {string} content - Markdown or block note content
 * @param {object} metadata - Note metadata
 */
export async function driverPutNote(path, content = '', metadata = {}) {
    const driver = getStorageDriverName()
    const db = getStorageDb()
    const kv = getNotesKv()

    const metaString = JSON.stringify(metadata || {})

    // Write to D1 if driver is 'd1' or 'auto'
    if ((driver === 'd1' || driver === 'auto') && db) {
        try {
            await db.prepare(`
                INSERT INTO notes (path, content, metadata, updated_at)
                VALUES (?, ?, ?, unixepoch())
                ON CONFLICT(path) DO UPDATE SET
                    content = excluded.content,
                    metadata = excluded.metadata,
                    updated_at = unixepoch()
            `).bind(path, content, metaString).run()
        } catch (err) {
            if (driver === 'd1') {
                console.error('D1 Put Note Error:', err)
                throw err
            }
        }
    }

    // Write to KV if driver is 'kv' or 'auto'
    if (kv) {
        await kv.put(path, content, { metadata })
    }
}

/**
 * Delete a note from storage
 * @param {string} path - Note path
 */
export async function driverDeleteNote(path) {
    const db = getStorageDb()
    const kv = getNotesKv()

    if (db) {
        try {
            await db.prepare('DELETE FROM notes WHERE path = ?').bind(path).run()
        } catch (err) {
            console.warn('D1 Delete Note Error:', err)
        }
    }

    if (kv) {
        await kv.delete(path)
    }
}

/**
 * List notes across active storage backends (D1 and/or KV).
 * Returns [{ name, metadata, content? }] deduplicated by path.
 */
export async function driverListNotes({ includeContent = false } = {}) {
    const driver = getStorageDriverName()
    const db = getStorageDb()
    const kv = getNotesKv()
    const byPath = new Map()

    if ((driver === 'd1' || driver === 'auto') && db) {
        try {
            const cols = includeContent ? 'path, content, metadata' : 'path, metadata'
            const res = await db.prepare(`SELECT ${cols} FROM notes`).all()
            for (const row of (res?.results || [])) {
                if (!row?.path) continue
                let parsedMeta = {}
                try {
                    parsedMeta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {})
                } catch {
                    parsedMeta = {}
                }
                byPath.set(row.path, {
                    name: row.path,
                    metadata: parsedMeta,
                    ...(includeContent ? { content: row.content || '', hasContent: true } : {}),
                })
            }
        } catch (err) {
            if (driver === 'd1') {
                console.error('D1 List Notes Error:', err)
            }
        }
    }

    if ((driver === 'kv' || driver === 'auto') && kv && typeof kv.list === 'function') {
        let cursor
        do {
            const page = await kv.list(cursor ? { cursor } : undefined)
            for (const item of (page?.keys || [])) {
                if (item?.name && !byPath.has(item.name)) {
                    byPath.set(item.name, item)
                }
            }
            cursor = page?.list_complete ? undefined : page?.cursor
        } while (cursor)
    }

    return Array.from(byPath.values())
}

/**
 * Query a share mapping (shareId -> path)
 * @param {string} shareId - Share ID or slug
 * @returns {Promise<string|null>} Target note path
 */
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

export async function driverQueryShare(shareId) {
    const driver = getStorageDriverName()
    const db = getStorageDb()
    const kv = getShareKv()

    if ((driver === 'd1' || driver === 'auto') && db) {
        try {
            const row = await db.prepare('SELECT path FROM shares WHERE share_id = ?').bind(shareId).first()
            if (row && row.path) return row.path

            // Fallback for D1: check if share_id matches shareSlug, shareId, or note path with share=1
            const noteRow = await db.prepare(`
                SELECT path FROM notes 
                WHERE (
                    json_extract(metadata, '$.shareSlug') = ? 
                    OR json_extract(metadata, '$.shareId') = ?
                    OR path = ?
                )
                AND (json_extract(metadata, '$.share') = 1 OR json_extract(metadata, '$.share') = true)
                LIMIT 1
            `).bind(shareId, shareId, shareId).first()
            if (noteRow && noteRow.path) {
                // Self-heal the share mapping in shares table
                db.prepare(`
                    INSERT INTO shares (share_id, path)
                    VALUES (?, ?)
                    ON CONFLICT(share_id) DO UPDATE SET path = excluded.path
                `).bind(shareId, noteRow.path).run().catch(() => {})
                return noteRow.path
            }

            // Fallback for D1: if shareId is a 32-char hex string, check if it matches MD5(path)
            if (/^[a-f0-9]{32}$/i.test(shareId)) {
                const candidates = await db.prepare(`
                    SELECT path FROM notes 
                    WHERE (json_extract(metadata, '$.share') = 1 OR json_extract(metadata, '$.share') = true)
                `).all()
                if (candidates && candidates.results) {
                    for (const candidate of candidates.results) {
                        const hash = await md5Hex(candidate.path)
                        if (hash.toLowerCase() === shareId.toLowerCase()) {
                            db.prepare(`
                                INSERT INTO shares (share_id, path)
                                VALUES (?, ?)
                                ON CONFLICT(share_id) DO UPDATE SET path = excluded.path
                            `).bind(shareId, candidate.path).run().catch(() => {})
                            return candidate.path
                        }
                    }
                }
            }
        } catch (err) {
            if (driver === 'd1') console.error('D1 Query Share Error:', err)
        }
    }

    if (kv) {
        return await kv.get(shareId)
    }

    return null
}

/**
 * Put a share mapping (shareId -> path)
 * @param {string} shareId - Share ID
 * @param {string} path - Target note path
 */
export async function driverPutShare(shareId, path, options = {}) {
    const driver = getStorageDriverName()
    const db = getStorageDb()
    const kv = getShareKv()

    if ((driver === 'd1' || driver === 'auto') && db) {
        try {
            await db.prepare(`
                INSERT INTO shares (share_id, path)
                VALUES (?, ?)
                ON CONFLICT(share_id) DO UPDATE SET path = excluded.path
            `).bind(shareId, path).run()
        } catch (err) {
            if (driver === 'd1') {
                console.error('D1 Put Share Error:', err)
                throw err
            }
        }
    }

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
export async function driverDeleteShare(shareId) {
    const db = getStorageDb()
    const kv = getShareKv()

    if (db) {
        try {
            await db.prepare('DELETE FROM shares WHERE share_id = ?').bind(shareId).run()
        } catch (err) {
            console.warn('D1 Delete Share Error:', err)
        }
    }

    if (kv) {
        await kv.delete(shareId)
    }
}

/**
 * Record share status (e.g. burned, expired) in tombstone cache
 * @param {string} shareId
 * @param {'burned' | 'expired' | 'unshared'} status
 * @param {object} details
 */
export async function driverSetShareStatus(shareId, status, details = {}) {
    if (!shareId) return
    const kv = getShareKv()
    if (!kv) return
    if (!status) {
        try {
            await kv.delete(`SHARE_STATUS:${shareId}`)
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
export async function driverGetShareStatus(shareId) {
    if (!shareId) return null
    const kv = getShareKv()
    if (kv) {
        try {
            const raw = await kv.get(`SHARE_STATUS:${shareId}`)
            if (raw) return JSON.parse(raw)
        } catch {}
    }
    return null
}

/**
 * Find note metadata and content by shareSlug, shareId, or path in D1
 * @param {string} shareId
 */
export async function driverFindNoteByShareId(shareId) {
    const db = getStorageDb()
    if (!db || !shareId) return null
    try {
        const row = await db.prepare(`
            SELECT path, metadata, content FROM notes
            WHERE (
                json_extract(metadata, '$.shareSlug') = ?
                OR json_extract(metadata, '$.shareId') = ?
                OR path = ?
            )
            LIMIT 1
        `).bind(shareId, shareId, shareId).first()
        if (row) {
            let metadata = {}
            try {
                metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {})
            } catch {}
            return { path: row.path, metadata, value: row.content || '' }
        }
    } catch (err) {
        console.warn('driverFindNoteByShareId error:', err)
    }
    return null
}

const IN_FLIGHT_CLAIMS = new Map()

function generateClaimNonce(now) {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(12)
        crypto.getRandomValues(bytes)
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
        return `${now}-${hex}`
    }
    return `${now}-${Date.now().toString(36)}`
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
export async function driverRecordBurnView(shareId, path, maxViews = 1, now = Math.floor(Date.now() / 1000)) {
    if (!shareId || !path) return { claimed: false, burned: false, viewCount: 0 }
    const targetMaxViews = Math.max(1, Number(maxViews) || 1)
    const db = getStorageDb()
    const kv = getShareKv()
    const notesKv = getNotesKv()
    const driver = getStorageDriverName()

    // Fast-path in-memory lock on current isolate to block concurrent promises
    if (IN_FLIGHT_CLAIMS.has(shareId)) {
        return { claimed: false, burned: false, viewCount: 0 }
    }
    IN_FLIGHT_CLAIMS.set(shareId, now)

    try {
        // 1. Check KV tombstone first
        const tombstone = await driverGetShareStatus(shareId)
        if (tombstone?.status === 'burned') {
            return { claimed: false, burned: true, viewCount: targetMaxViews }
        }

        let burnedNow = targetMaxViews <= 1
        let nextViewCount = 1

        // 2. If D1 is available, atomic check-and-set via UPDATE
        if (db && (driver === 'd1' || driver === 'auto')) {
            try {
                if (targetMaxViews <= 1) {
                    const res = await db.prepare(`
                        UPDATE notes
                        SET metadata = json_set(metadata, '$.share', json('false'), '$.shareBurnedAt', ?, '$.shareViewCount', COALESCE(CAST(json_extract(metadata, '$.shareViewCount') AS INTEGER), 0) + 1)
                        WHERE path = ?
                          AND (
                              json_extract(metadata, '$.share') = 1
                              OR json_extract(metadata, '$.share') = true
                          )
                          AND json_extract(metadata, '$.shareBurnedAt') IS NULL
                    `).bind(now, path).run()
                    if (res && typeof res.meta?.changes === 'number' && res.meta.changes === 0) {
                        return { claimed: false, burned: true, viewCount: targetMaxViews }
                    }
                    burnedNow = true
                } else {
                    const res = await db.prepare(`
                        UPDATE notes
                        SET metadata = CASE
                            WHEN COALESCE(CAST(json_extract(metadata, '$.shareViewCount') AS INTEGER), 0) + 1 >= ?
                            THEN json_set(metadata, '$.share', json('false'), '$.shareBurnedAt', ?, '$.shareViewCount', COALESCE(CAST(json_extract(metadata, '$.shareViewCount') AS INTEGER), 0) + 1)
                            ELSE json_set(metadata, '$.shareViewCount', COALESCE(CAST(json_extract(metadata, '$.shareViewCount') AS INTEGER), 0) + 1)
                        END
                        WHERE path = ?
                          AND (
                              json_extract(metadata, '$.share') = 1
                              OR json_extract(metadata, '$.share') = true
                          )
                          AND json_extract(metadata, '$.shareBurnedAt') IS NULL
                          AND COALESCE(CAST(json_extract(metadata, '$.shareViewCount') AS INTEGER), 0) < ?
                    `).bind(targetMaxViews, now, path, targetMaxViews).run()
                    if (res && typeof res.meta?.changes === 'number' && res.meta.changes === 0) {
                        return { claimed: false, burned: true, viewCount: targetMaxViews }
                    }
                    const updatedRow = await db.prepare("SELECT json_extract(metadata, '$.shareViewCount') AS vc, json_extract(metadata, '$.shareBurnedAt') AS burnedAt FROM notes WHERE path = ?").bind(path).first()
                    nextViewCount = Number(updatedRow?.vc || 1)
                    burnedNow = Boolean(updatedRow?.burnedAt) || nextViewCount >= targetMaxViews
                }
            } catch (err) {
                console.warn('D1 Claim Burn Share Error:', err)
                if (driver === 'd1') {
                    return { claimed: false, burned: false, viewCount: 0 }
                }
            }
        }

        // 3. In KV-only mode (or parallel KV storage), perform two-phase claim check for single-view burn
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

        // 4. Update KV note metadata as well
        if (notesKv) {
            try {
                const current = await notesKv.getWithMetadata(path)
                if (current?.metadata) {
                    const currentViews = Number(current.metadata.shareViewCount || 0)
                    if (current.metadata.shareBurnedAt || currentViews >= targetMaxViews) {
                        return { claimed: false, burned: true, viewCount: currentViews }
                    }
                    nextViewCount = Math.max(nextViewCount, currentViews + 1)
                    burnedNow = burnedNow || nextViewCount >= targetMaxViews
                    const nextMeta = burnedNow
                        ? { ...current.metadata, share: false, shareBurnedAt: now, shareViewCount: nextViewCount }
                        : { ...current.metadata, shareViewCount: nextViewCount }
                    await notesKv.put(path, current.value || '', { metadata: nextMeta })
                }
            } catch {}
        }

        // 5. Mark tombstone in SHARE kv once burned
        if (burnedNow) {
            await driverSetShareStatus(shareId, 'burned', { burnedAt: now, path })
        }

        return { claimed: true, burned: burnedNow, viewCount: nextViewCount }
    } finally {
        IN_FLIGHT_CLAIMS.delete(shareId)
    }
}
