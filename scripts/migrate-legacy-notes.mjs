import crypto from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadWranglerConfig, planDbInitTargets } from './db-init.mjs'

export const SECURITY_SHARE_FIELDS = [
    'share',
    'shareSlug',
    'shareId',
    'pw',
    'vpw',
    'shareMode',
    'shareBurnAfterReading',
    'burned',
    'shareBurned',
    'shareBurnedAt',
    'shareViewCount',
    'shareMaxViews',
    'sealMaxViews',
    'shareExpiresAt',
    'sharePulseDueAt',
    'shareUnlockAt',
]

export const IS_LEGACY_BURNED_SQL = `(
    json_extract(metadata, '$.burned') = 1
    OR json_extract(metadata, '$.shareBurned') = 1
    OR COALESCE(CAST(json_extract(metadata, '$.shareBurnedAt') AS INTEGER), 0) > 0
    OR (
        (json_extract(metadata, '$.shareBurnAfterReading') = 1 OR json_extract(metadata, '$.shareMode') IN ('burn', 'burn_after_reading'))
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

const BOOLEAN_SECURITY_FIELDS = new Set(['share', 'shareBurnAfterReading', 'burned', 'shareBurned'])
const STRING_SECURITY_FIELDS = new Set(['shareSlug', 'shareId', 'pw', 'vpw', 'shareMode'])
const NUMERIC_SECURITY_FIELDS = new Set([
    'shareBurnedAt',
    'shareViewCount',
    'shareMaxViews',
    'sealMaxViews',
    'shareExpiresAt',
    'sharePulseDueAt',
    'shareUnlockAt',
])

export function md5Hex(input = '') {
    return crypto.createHash('md5').update(String(input || '')).digest('hex')
}

export function sha256Hex(input = '') {
    return crypto.createHash('sha256').update(String(input || '')).digest('hex')
}

export function generateOpaqueId(byteLength = 16) {
    return crypto.randomBytes(byteLength).toString('base64url')
}

function sortObjectKeys(value) {
    if (Array.isArray(value)) return value.map(sortObjectKeys)
    if (value && typeof value === 'object') {
        const sorted = {}
        for (const key of Object.keys(value).sort()) {
            if (value[key] !== undefined) {
                sorted[key] = sortObjectKeys(value[key])
            }
        }
        return sorted
    }
    return value
}

export function canonicalJsonHash(obj) {
    return sha256Hex(JSON.stringify(sortObjectKeys(obj || {})))
}

export function resolveLegacyToken(meta = {}) {
    if (!meta || typeof meta !== 'object') return ''
    if (meta.shareSlug && meta.shareId && meta.shareSlug !== meta.shareId) {
        return null
    }
    return meta.shareSlug || meta.shareId || ''
}

export function isLegacyCutoverEligibleToken(token, path, md5Path = md5Hex(path)) {
    if (typeof token !== 'string' || !token) return false
    const matchesFormat = /^[A-Za-z0-9]{6}$/.test(token) || /^[A-Za-z0-9_-]{22,}$/.test(token)
    if (!matchesFormat) return false
    if (token === path || token === md5Path || token.startsWith(`${path}-`)) return false
    return true
}

export function isBurnProtected(metadata = {}) {
    return Boolean(
        metadata
        && (
            metadata.shareMode === 'burn'
            || metadata.shareMode === 'burn_after_reading'
            || metadata.shareBurnAfterReading === true
            || metadata.shareBurnAfterReading === 1
        )
    )
}

export function isShareBurned(metadata = {}) {
    if (!metadata || typeof metadata !== 'object') return false
    if (metadata.burned === true || metadata.burned === 1) return true
    if (metadata.shareBurned === true || metadata.shareBurned === 1) return true
    const burnedAt = Number(metadata.shareBurnedAt)
    if (Number.isFinite(burnedAt) && burnedAt > 0) return true
    const maxViews = Math.max(1, parseInt(metadata.shareMaxViews || metadata.sealMaxViews, 10) || 1)
    if (
        isBurnProtected(metadata)
        && metadata.shareViewCount !== undefined
        && metadata.shareViewCount !== null
        && Number(metadata.shareViewCount) >= maxViews
    ) {
        return true
    }
    return false
}

export function isShareExpired(metadata = {}, nowUnix = Math.floor(Date.now() / 1000)) {
    const expiresAt = Number(metadata?.shareExpiresAt)
    return Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= nowUnix
}

export function normalizeSecurityField(field, meta = {}) {
    const raw = meta ? meta[field] : undefined
    if (BOOLEAN_SECURITY_FIELDS.has(field)) {
        return raw === true || raw === 1 || raw === '1'
    }
    if (STRING_SECURITY_FIELDS.has(field)) {
        if (raw === undefined || raw === null || raw === '') return null
        return String(raw)
    }
    if (NUMERIC_SECURITY_FIELDS.has(field)) {
        if (raw === undefined || raw === null || raw === '') return null
        const n = Number(raw)
        return Number.isFinite(n) ? n : String(raw)
    }
    return raw ?? null
}

export function diffEffectiveSecurityFields(d1Meta = {}, kvMeta = {}) {
    const diffs = []
    for (const field of SECURITY_SHARE_FIELDS) {
        const d1Val = normalizeSecurityField(field, d1Meta)
        const kvVal = normalizeSecurityField(field, kvMeta)
        if (d1Val !== kvVal) {
            diffs.push({ field, d1: d1Val, kv: kvVal })
        }
    }
    return diffs
}

function minPositiveNumber(a, b) {
    const nums = [a, b].map((v) => (v === null || v === undefined ? NaN : Number(v))).filter((n) => Number.isFinite(n) && n > 0)
    if (nums.length === 0) return null
    return Math.min(...nums)
}

function maxPositiveNumber(a, b) {
    const nums = [a, b].map((v) => (v === null || v === undefined ? NaN : Number(v))).filter((n) => Number.isFinite(n) && n > 0)
    if (nums.length === 0) return null
    return Math.max(...nums)
}

function maxNullableNumber(a, b) {
    const nums = [a, b].map((v) => (v === null || v === undefined ? NaN : Number(v))).filter((n) => Number.isFinite(n))
    if (nums.length === 0) return null
    return Math.max(...nums)
}

function sortedUnique(arr) {
    return Array.from(new Set(arr)).sort()
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false
    }
    return true
}

function parseJsonMeta(raw) {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try {
        const parsed = JSON.parse(String(raw))
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
        return {}
    }
}

/**
 * Resolve divergent security/share states by choosing the stricter / fail-closed state.
 */
export function resolveStricterSecurityState({
    path,
    d1Meta = {},
    kvMeta = {},
    d1ShareTokens = [],
    kvShareTokens = [],
    nowUnix = Math.floor(Date.now() / 1000),
}) {
    const d1Share = normalizeSecurityField('share', d1Meta)
    const kvShare = normalizeSecurityField('share', kvMeta)
    let strictShare = d1Share && kvShare

    const d1Pw = normalizeSecurityField('pw', d1Meta)
    const kvPw = normalizeSecurityField('pw', kvMeta)
    if (d1Pw && kvPw && d1Pw !== kvPw) {
        return { ambiguousConflict: true, reason: 'conflicting_edit_passwords' }
    }
    const strictPw = d1Pw || kvPw || undefined

    const d1Vpw = normalizeSecurityField('vpw', d1Meta)
    const kvVpw = normalizeSecurityField('vpw', kvMeta)
    let strictVpw = d1Vpw || kvVpw || undefined
    if (d1Vpw && kvVpw && d1Vpw !== kvVpw) {
        // Cannot verify which view password was authoritative; fail closed by unsharing
        strictShare = false
        strictVpw = d1Vpw
    }

    const d1Burned = isShareBurned(d1Meta)
    const kvBurned = isShareBurned(kvMeta)
    const strictBurned = d1Burned || kvBurned

    const strictShareBurnAfterReading =
        normalizeSecurityField('shareBurnAfterReading', d1Meta)
        || normalizeSecurityField('shareBurnAfterReading', kvMeta)

    const d1Mode = normalizeSecurityField('shareMode', d1Meta)
    const kvMode = normalizeSecurityField('shareMode', kvMeta)
    let strictMode = undefined
    if (d1Mode === 'burn' || d1Mode === 'burn_after_reading' || kvMode === 'burn' || kvMode === 'burn_after_reading') {
        strictMode = (d1Mode === 'burn_after_reading' || kvMode === 'burn_after_reading') ? 'burn_after_reading' : 'burn'
    } else if (d1Mode && kvMode && d1Mode !== kvMode) {
        strictShare = false
        strictMode = d1Mode
    } else {
        strictMode = d1Mode || kvMode || undefined
    }

    const strictViewCount = maxNullableNumber(
        normalizeSecurityField('shareViewCount', d1Meta),
        normalizeSecurityField('shareViewCount', kvMeta)
    )
    const strictMaxViews = minPositiveNumber(
        normalizeSecurityField('shareMaxViews', d1Meta),
        normalizeSecurityField('shareMaxViews', kvMeta)
    )
    const strictSealMaxViews = minPositiveNumber(
        normalizeSecurityField('sealMaxViews', d1Meta),
        normalizeSecurityField('sealMaxViews', kvMeta)
    )
    const strictBurnedAt = minPositiveNumber(
        normalizeSecurityField('shareBurnedAt', d1Meta),
        normalizeSecurityField('shareBurnedAt', kvMeta)
    )
    const strictExpiresAt = minPositiveNumber(
        normalizeSecurityField('shareExpiresAt', d1Meta),
        normalizeSecurityField('shareExpiresAt', kvMeta)
    )
    const strictUnlockAt = maxPositiveNumber(
        normalizeSecurityField('shareUnlockAt', d1Meta),
        normalizeSecurityField('shareUnlockAt', kvMeta)
    )
    const strictPulseDueAt = maxPositiveNumber(
        normalizeSecurityField('sharePulseDueAt', d1Meta),
        normalizeSecurityField('sharePulseDueAt', kvMeta)
    )

    // Determine shareSlug / shareId strictly
    const d1Token = resolveLegacyToken(d1Meta)
    const kvToken = resolveLegacyToken(kvMeta)
    let strictSlug = d1Meta.shareSlug || kvMeta.shareSlug || undefined
    let strictShareId = d1Meta.shareId || kvMeta.shareId || undefined

    const tokensMismatch =
        (d1Token && kvToken && d1Token !== kvToken)
        || (d1Token === null || kvToken === null)
        || (!arraysEqual(sortedUnique(d1ShareTokens), sortedUnique(kvShareTokens)) && (d1ShareTokens.length > 0 || kvShareTokens.length > 0))

    if (tokensMismatch && strictShare && !strictBurned && !(strictExpiresAt && strictExpiresAt <= nowUnix)) {
        // Conflicting active share tokens with both sides active: fail closed to unshared
        strictShare = false
    }

    const patch = {
        share: strictShare,
    }
    if (strictPw !== undefined) patch.pw = strictPw
    if (strictVpw !== undefined) patch.vpw = strictVpw
    if (strictMode !== undefined) patch.shareMode = strictMode
    if (strictShareBurnAfterReading) patch.shareBurnAfterReading = true
    if (d1Meta.burned || kvMeta.burned || strictBurned) {
        patch.burned = Boolean(d1Meta.burned || kvMeta.burned || strictBurned)
    }
    if (d1Meta.shareBurned || kvMeta.shareBurned || strictBurned) {
        patch.shareBurned = Boolean(d1Meta.shareBurned || kvMeta.shareBurned || strictBurned)
    }
    if (strictBurnedAt !== null) patch.shareBurnedAt = strictBurnedAt
    if (strictViewCount !== null) patch.shareViewCount = strictViewCount
    if (strictMaxViews !== null) patch.shareMaxViews = strictMaxViews
    if (strictSealMaxViews !== null) patch.sealMaxViews = strictSealMaxViews
    if (strictExpiresAt !== null) patch.shareExpiresAt = strictExpiresAt
    if (strictUnlockAt !== null) patch.shareUnlockAt = strictUnlockAt
    if (strictPulseDueAt !== null) patch.sharePulseDueAt = strictPulseDueAt
    if (strictSlug !== undefined) patch.shareSlug = strictSlug
    if (strictShareId !== undefined) patch.shareId = strictShareId

    const mergedMeta = {
        ...d1Meta,
        ...kvMeta,
        ...patch,
    }
    if (!strictPw) delete mergedMeta.pw
    if (!strictVpw) delete mergedMeta.vpw
    if (!strictMode) delete mergedMeta.shareMode
    if (!strictShareBurnAfterReading) delete mergedMeta.shareBurnAfterReading
    if (strictExpiresAt === null) delete mergedMeta.shareExpiresAt
    if (strictUnlockAt === null) delete mergedMeta.shareUnlockAt
    if (strictPulseDueAt === null) delete mergedMeta.sharePulseDueAt
    if (strictMaxViews === null) delete mergedMeta.shareMaxViews
    if (strictSealMaxViews === null) delete mergedMeta.sealMaxViews
    if (strictViewCount === null) delete mergedMeta.shareViewCount
    if (strictBurnedAt === null) delete mergedMeta.shareBurnedAt

    return {
        ambiguousConflict: false,
        mergedMeta,
    }
}

/**
 * Create a Cloudflare central KV v4 REST API client.
 * Never touches Worker edge-POP caches and fails closed on any non-200 or truncated listing.
 */
export function createCentralKvRestClient({
    accountId,
    apiToken,
    fetch: fetchImpl = globalThis.fetch,
    apiBaseUrl = 'https://api.cloudflare.com/client/v4',
    maxPages = 10000,
} = {}) {
    if (!accountId) throw new Error('Missing Cloudflare accountId for central KV REST API')
    if (!apiToken) throw new Error('Missing Cloudflare API token (CLOUDFLARE_API_TOKEN / CF_API_TOKEN)')
    if (typeof fetchImpl !== 'function') throw new Error('Missing fetch implementation for KV REST API')

    const baseUrl = apiBaseUrl.replace(/\/+$/, '')
    const headers = {
        Authorization: `Bearer ${apiToken}`,
    }

    async function listKeys(namespaceId) {
        if (!namespaceId) throw new Error('Missing KV namespaceId for listKeys')
        const keys = []
        const seenCursors = new Set()
        let cursor = ''
        let pages = 0

        while (true) {
            pages += 1
            if (pages > maxPages) {
                throw new Error(`KV_LIST_TRUNCATED: exceeded maxPages (${maxPages}) for namespace ${namespaceId}`)
            }
            const qs = new URLSearchParams({ limit: '1000' })
            if (cursor) qs.set('cursor', cursor)
            const url = `${baseUrl}/accounts/${encodeURIComponent(accountId)}/storage/kv/namespaces/${encodeURIComponent(namespaceId)}/keys?${qs.toString()}`
            const res = await fetchImpl(url, { method: 'GET', headers })
            if (!res || res.status !== 200 || !res.ok) {
                const bodyText = res ? await res.text().catch(() => '') : 'no response'
                throw new Error(`KV_API_ERROR: listKeys HTTP ${res?.status ?? 'ERR'} on ${namespaceId}: ${bodyText}`)
            }
            const payload = await res.json()
            if (!payload || payload.success !== true || !Array.isArray(payload.result)) {
                throw new Error(`KV_API_ERROR: listKeys failed on ${namespaceId}: ${JSON.stringify(payload?.errors || payload)}`)
            }
            if (payload.result_info?.truncated === true || payload.truncated === true) {
                throw new Error(`KV_LIST_TRUNCATED: central KV listing marked truncated for ${namespaceId}`)
            }
            if (payload.result_info?.count !== undefined && Number(payload.result_info.count) !== payload.result.length) {
                throw new Error(`KV_LIST_COUNT_MISMATCH: expected ${payload.result_info.count}, got ${payload.result.length}`)
            }

            for (const item of payload.result) {
                if (item && typeof item.name === 'string') {
                    keys.push(item)
                }
            }

            const nextCursor = typeof payload.result_info?.cursor === 'string' ? payload.result_info.cursor.trim() : ''
            if (nextCursor) {
                if (payload.result.length === 0) {
                    throw new Error(`KV_LIST_TRUNCATED: empty result page returned with non-empty cursor for ${namespaceId}`)
                }
                if (seenCursors.has(nextCursor)) {
                    throw new Error(`KV_LIST_CURSOR_STUCK: repeated cursor "${nextCursor}" for ${namespaceId}`)
                }
                seenCursors.add(nextCursor)
                cursor = nextCursor
                continue
            }
            if (payload.result_info?.list_complete === false) {
                throw new Error(`KV_LIST_TRUNCATED: list_complete=false without continuation cursor for ${namespaceId}`)
            }
            break
        }

        return keys
    }

    async function getValue(namespaceId, key) {
        const url = `${baseUrl}/accounts/${encodeURIComponent(accountId)}/storage/kv/namespaces/${encodeURIComponent(namespaceId)}/values/${encodeURIComponent(key)}`
        const res = await fetchImpl(url, { method: 'GET', headers })
        if (!res || res.status !== 200 || !res.ok) {
            const bodyText = res ? await res.text().catch(() => '') : 'no response'
            throw new Error(`KV_API_ERROR: getValue(${key}) HTTP ${res?.status ?? 'ERR'}: ${bodyText}`)
        }
        return await res.text()
    }

    async function getMetadata(namespaceId, key) {
        const url = `${baseUrl}/accounts/${encodeURIComponent(accountId)}/storage/kv/namespaces/${encodeURIComponent(namespaceId)}/metadata/${encodeURIComponent(key)}`
        const res = await fetchImpl(url, { method: 'GET', headers })
        if (!res || res.status !== 200 || !res.ok) {
            const bodyText = res ? await res.text().catch(() => '') : 'no response'
            throw new Error(`KV_API_ERROR: getMetadata(${key}) HTTP ${res?.status ?? 'ERR'}: ${bodyText}`)
        }
        const payload = await res.json()
        if (!payload || payload.success !== true) {
            throw new Error(`KV_API_ERROR: getMetadata(${key}) returned success=false`)
        }
        return payload.result && typeof payload.result === 'object' ? payload.result : {}
    }

    async function snapshotNamespace(namespaceId, { fetchMetadata = true } = {}) {
        const entries = new Map()
        if (!namespaceId) return entries
        const keyList = await listKeys(namespaceId)
        for (const item of keyList) {
            const name = item.name
            const value = await getValue(namespaceId, name)
            const metadata = fetchMetadata ? await getMetadata(namespaceId, name) : {}
            entries.set(name, {
                name,
                value,
                metadata,
                valueHash: sha256Hex(value),
                metadataHash: canonicalJsonHash(metadata),
            })
        }
        return entries
    }

    return {
        listKeys,
        getValue,
        getMetadata,
        snapshotNamespace,
    }
}

/**
 * Create a D1-compatible client over Cloudflare v4 D1 REST API for CLI execution.
 */
export function createCloudflareD1Client({
    accountId,
    databaseId,
    apiToken,
    fetch: fetchImpl = globalThis.fetch,
    apiBaseUrl = 'https://api.cloudflare.com/client/v4',
} = {}) {
    if (!accountId || !databaseId || !apiToken) {
        throw new Error('Missing accountId, databaseId, or apiToken for Cloudflare D1 REST client')
    }
    const baseUrl = apiBaseUrl.replace(/\/+$/, '')
    const queryUrl = `${baseUrl}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`

    async function executeOne(sql, params = []) {
        const res = await fetchImpl(queryUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql, params }),
        })
        if (!res || res.status !== 200 || !res.ok) {
            const bodyText = res ? await res.text().catch(() => '') : 'no response'
            throw new Error(`D1_API_ERROR: HTTP ${res?.status ?? 'ERR'}: ${bodyText}`)
        }
        const payload = await res.json()
        if (!payload || payload.success !== true || !Array.isArray(payload.result) || !payload.result[0]) {
            throw new Error(`D1_API_ERROR: query failed: ${JSON.stringify(payload?.errors || payload)}`)
        }
        return payload.result[0]
    }

    function prepare(sql) {
        let bound = []
        const stmt = {
            sql,
            params: bound,
            bind(...params) {
                bound = params
                stmt.params = bound
                return stmt
            },
            async all() {
                const res = await executeOne(sql, bound)
                return { results: res.results || [], meta: res.meta || {} }
            },
            async first() {
                const res = await executeOne(sql, bound)
                return (res.results && res.results[0]) || null
            },
            async run() {
                const res = await executeOne(sql, bound)
                return { results: res.results || [], meta: res.meta || {} }
            },
        }
        return stmt
    }

    async function batch(statements = []) {
        if (!statements.length) return []
        const res = await fetchImpl(queryUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(statements.map((s) => ({ sql: s.sql, params: s.params || [] }))),
        })
        if (!res || res.status !== 200 || !res.ok) {
            const bodyText = res ? await res.text().catch(() => '') : 'no response'
            throw new Error(`D1_API_ERROR: batch HTTP ${res?.status ?? 'ERR'}: ${bodyText}`)
        }
        const payload = await res.json()
        if (!payload || payload.success !== true || !Array.isArray(payload.result)) {
            throw new Error(`D1_API_ERROR: batch failed: ${JSON.stringify(payload?.errors || payload)}`)
        }
        return payload.result
    }

    return { prepare, batch }
}

/**
 * Compare two consecutive central KV snapshot passes for stability.
 */
export function compareSnapshotPasses(pass1, pass2) {
    const diffs = []

    const compareMaps = (namespace, map1, map2, checkMetadata) => {
        for (const [key, item1] of map1.entries()) {
            const item2 = map2.get(key)
            if (!item2) {
                diffs.push({ namespace, key, reason: 'removed_in_pass2' })
                continue
            }
            if (item1.valueHash !== item2.valueHash) {
                diffs.push({ namespace, key, reason: 'value_hash_changed' })
            }
            if (checkMetadata && item1.metadataHash !== item2.metadataHash) {
                diffs.push({ namespace, key, reason: 'metadata_hash_changed' })
            }
        }
        for (const key of map2.keys()) {
            if (!map1.has(key)) {
                diffs.push({ namespace, key, reason: 'added_in_pass2' })
            }
        }
    }

    compareMaps('NOTES', pass1.notes, pass2.notes, true)
    compareMaps('SHARE', pass1.share, pass2.share, false)

    return {
        stable: diffs.length === 0,
        diffs,
    }
}

/**
 * Build the exact atomic claimNonce D1 batch for an untagged legacy D1 row.
 */
export function buildClaimLegacyStatements(db, {
    path,
    noteUid,
    claimNonce,
    nowUnix,
    legacyToken,
    isEligibleToken,
}) {
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
              AND NOT EXISTS (SELECT 1 FROM note_tombstones WHERE path = ? AND deleted_note_uid = '__legacy__')
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

    if (isEligibleToken && legacyToken) {
        stmts.push(
            db.prepare(`
                INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at, revoked_at, revoked_reason)
                SELECT
                    ?, ?, ?, 0, ?,
                    CASE
                        WHEN ${IS_LEGACY_BURNED_SQL}
                          OR (json_extract(metadata, '$.shareExpiresAt') IS NOT NULL AND CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) <= ?)
                        THEN ?
                        ELSE NULL
                    END,
                    CASE
                        WHEN ${IS_LEGACY_BURNED_SQL} THEN 'burned'
                        WHEN (json_extract(metadata, '$.shareExpiresAt') IS NOT NULL AND CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) <= ?) THEN 'expired'
                        ELSE NULL
                    END
                FROM notes
                WHERE path = ?
                  AND json_extract(metadata, '$.noteUid') = ?
                  AND json_extract(metadata, '$.claimNonce') = ?
                  AND (
                      json_extract(metadata, '$.share') = 1
                      OR ${IS_LEGACY_BURNED_SQL}
                      OR (json_extract(metadata, '$.shareExpiresAt') IS NOT NULL AND CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) <= ?)
                  )
                  AND NOT EXISTS (SELECT 1 FROM share_token_registry WHERE share_id = ?)
                  AND NOT EXISTS (SELECT 1 FROM shares WHERE share_id = ? AND path != ?)
            `).bind(
                legacyToken,
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
                legacyToken,
                legacyToken,
                path
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
                        AND NOT ${IS_LEGACY_BURNED_SQL}
                        AND (json_extract(metadata, '$.shareExpiresAt') IS NULL OR CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) > ?)
                  )
            `).bind(legacyToken, path, nowUnix, legacyToken, path, path, noteUid, claimNonce, nowUnix),

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
                            OR ${IS_LEGACY_BURNED_SQL}
                            OR (json_extract(metadata, '$.shareExpiresAt') IS NOT NULL AND CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) <= ?)
                        )
                  )
            `).bind(path, path, noteUid, claimNonce, nowUnix)
        )
    } else {
        stmts.push(
            db.prepare(`
                DELETE FROM shares
                WHERE path = ?
                  AND EXISTS (
                      SELECT 1 FROM notes
                      WHERE path = ?
                        AND json_extract(metadata, '$.noteUid') = ?
                        AND json_extract(metadata, '$.claimNonce') = ?
                  )
                  AND share_id NOT IN (
                      SELECT share_id FROM share_token_registry WHERE target_path = ? AND revoked_at IS NULL
                  )
            `).bind(path, path, noteUid, claimNonce, path)
        )
    }

    return stmts
}

function buildUpdateAndSyncStatements(db, {
    path,
    content,
    nextMetadata,
    noteUid,
    claimNonce,
    previousMetaVersion,
    isExistingNote,
    createdAt,
    updatedAt,
    nowUnix,
    syncTokens,
    priorLegacyTokens = [],
}) {
    const metaJson = JSON.stringify(nextMetadata)
    const stmts = []

    if (isExistingNote) {
        stmts.push(
            db.prepare(`
                UPDATE notes
                SET content = ?,
                    metadata = ?,
                    updated_at = ?
                WHERE path = ?
                  AND COALESCE(CAST(json_extract(metadata, '$.metaVersion') AS INTEGER), 0) = ?
            `).bind(content, metaJson, updatedAt, path, previousMetaVersion)
        )
    } else {
        stmts.push(
            db.prepare(`
                INSERT INTO notes (path, content, metadata, created_at, updated_at)
                SELECT ?, ?, ?, ?, ?
                WHERE NOT EXISTS (SELECT 1 FROM notes WHERE path = ?)
                  AND NOT EXISTS (SELECT 1 FROM note_tombstones WHERE path = ? AND deleted_note_uid = '__legacy__')
            `).bind(path, content, metaJson, createdAt, updatedAt, path, path)
        )
    }

    stmts.push(
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
        `).bind(path, nowUnix, claimNonce, path, noteUid, claimNonce)
    )

    if (syncTokens) {
        const md5Path = md5Hex(path)
        const token = resolveLegacyToken(nextMetadata)
        const eligible = isLegacyCutoverEligibleToken(token, path, md5Path)
        const burned = isShareBurned(nextMetadata)
        const expired = isShareExpired(nextMetadata, nowUnix)
        const activeShare = nextMetadata.share === true && !burned && !expired

        const revokeReasonForReplaced = !activeShare
            ? (burned ? 'burned' : (expired ? 'expired' : 'unshared'))
            : 'rotated'
        for (const priorTok of priorLegacyTokens) {
            if (!priorTok || (activeShare && eligible && priorTok === token)) continue
            if (!isLegacyCutoverEligibleToken(priorTok, path, md5Path)) continue
            stmts.push(
                db.prepare(`
                    INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at, revoked_at, revoked_reason)
                    SELECT ?, ?, ?, 0, ?, ?, ?
                    WHERE EXISTS (
                        SELECT 1 FROM notes
                        WHERE path = ? AND json_extract(metadata, '$.noteUid') = ? AND json_extract(metadata, '$.claimNonce') = ?
                    )
                    AND NOT EXISTS (SELECT 1 FROM share_token_registry WHERE share_id = ?)
                    AND NOT EXISTS (SELECT 1 FROM shares WHERE share_id = ? AND path != ?)
                `).bind(priorTok, path, noteUid, nowUnix, nowUnix, revokeReasonForReplaced, path, noteUid, claimNonce, priorTok, priorTok, path)
            )
        }

        if (!activeShare) {
            const revokeReason = burned ? 'burned' : (expired ? 'expired' : 'unshared')
            stmts.push(
                db.prepare(`
                    UPDATE share_token_registry
                    SET revoked_at = ?, revoked_reason = ?
                    WHERE target_path = ? AND note_uid = ? AND revoked_at IS NULL
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ? AND json_extract(metadata, '$.noteUid') = ? AND json_extract(metadata, '$.claimNonce') = ?
                      )
                `).bind(nowUnix, revokeReason, path, noteUid, path, noteUid, claimNonce),

                db.prepare(`
                    DELETE FROM shares
                    WHERE path = ?
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ? AND json_extract(metadata, '$.noteUid') = ? AND json_extract(metadata, '$.claimNonce') = ?
                      )
                `).bind(path, path, noteUid, claimNonce)
            )

            if (eligible && token && (burned || expired)) {
                stmts.push(
                    db.prepare(`
                        INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at, revoked_at, revoked_reason)
                        SELECT ?, ?, ?, 0, ?, ?, ?
                        WHERE EXISTS (
                            SELECT 1 FROM notes
                            WHERE path = ? AND json_extract(metadata, '$.noteUid') = ? AND json_extract(metadata, '$.claimNonce') = ?
                        )
                        AND NOT EXISTS (SELECT 1 FROM share_token_registry WHERE share_id = ?)
                        AND NOT EXISTS (SELECT 1 FROM shares WHERE share_id = ? AND path != ?)
                    `).bind(token, path, noteUid, nowUnix, nowUnix, revokeReason, path, noteUid, claimNonce, token, token, path)
                )
            }
        } else if (eligible && token) {
            stmts.push(
                db.prepare(`
                    UPDATE share_token_registry
                    SET revoked_at = ?, revoked_reason = 'rotated'
                    WHERE target_path = ? AND note_uid = ? AND share_id != ? AND revoked_at IS NULL
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ? AND json_extract(metadata, '$.noteUid') = ? AND json_extract(metadata, '$.claimNonce') = ?
                      )
                `).bind(nowUnix, path, noteUid, token, path, noteUid, claimNonce),

                db.prepare(`
                    DELETE FROM shares
                    WHERE path = ? AND share_id != ?
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ? AND json_extract(metadata, '$.noteUid') = ? AND json_extract(metadata, '$.claimNonce') = ?
                      )
                `).bind(path, token, path, noteUid, claimNonce),

                db.prepare(`
                    INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at, revoked_at, revoked_reason)
                    SELECT ?, ?, ?, 0, ?, NULL, NULL
                    WHERE EXISTS (
                        SELECT 1 FROM notes
                        WHERE path = ? AND json_extract(metadata, '$.noteUid') = ? AND json_extract(metadata, '$.claimNonce') = ?
                    )
                    AND NOT EXISTS (SELECT 1 FROM share_token_registry WHERE share_id = ?)
                    AND NOT EXISTS (SELECT 1 FROM shares WHERE share_id = ? AND path != ?)
                `).bind(token, path, noteUid, nowUnix, path, noteUid, claimNonce, token, token, path),

                db.prepare(`
                    INSERT INTO shares (share_id, path, created_at)
                    SELECT ?, ?, ?
                    WHERE NOT EXISTS (SELECT 1 FROM shares WHERE share_id = ? AND path = ?)
                      AND EXISTS (
                          SELECT 1 FROM share_token_registry
                          WHERE share_id = ? AND target_path = ? AND note_uid = ? AND revoked_at IS NULL
                      )
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ? AND json_extract(metadata, '$.noteUid') = ? AND json_extract(metadata, '$.claimNonce') = ?
                      )
                `).bind(token, path, nowUnix, token, path, token, path, noteUid, path, noteUid, claimNonce)
            )
        } else {
            // Active share without eligible legacy token: clean non-registry stale shares
            stmts.push(
                db.prepare(`
                    DELETE FROM shares
                    WHERE path = ?
                      AND share_id NOT IN (
                          SELECT share_id FROM share_token_registry WHERE target_path = ? AND revoked_at IS NULL
                      )
                      AND EXISTS (
                          SELECT 1 FROM notes
                          WHERE path = ? AND json_extract(metadata, '$.noteUid') = ? AND json_extract(metadata, '$.claimNonce') = ?
                      )
                `).bind(path, path, path, noteUid, claimNonce)
            )
        }
    }

    return stmts
}

/**
 * Authoritative quiesced cutover & reconciliation between central Cloudflare KV REST API and D1.
 */
export async function migrateLegacyNotes(options = {}) {
    const audit = Boolean(options.audit)
    const confirmQuiescedSnapshot = Boolean(options.confirmQuiescedSnapshot)
    const prefer = options.prefer ? String(options.prefer).trim().toLowerCase() : ''
    const resolveStricter = Boolean(options.resolveStricter)
    const nowUnix = Number.isFinite(Number(options.nowUnix))
        ? Math.floor(Number(options.nowUnix))
        : Math.floor(Date.now() / 1000)

    if (prefer && !['kv', 'd1'].includes(prefer)) {
        throw new Error(`Invalid --prefer value "${prefer}"; expected "kv" or "d1"`)
    }
    if (!audit && !confirmQuiescedSnapshot) {
        throw new Error('CONFIRM_QUIESCED_SNAPSHOT_REQUIRED: pass --audit for read-only verification or --confirm-quiesced-snapshot after draining traffic to execute cutover')
    }

    const cwd = options.cwd || process.cwd()
    const env = options.env || process.env
    const config = options.config || loadWranglerConfig(options.configPath || 'wrangler.toml', { cwd, env: options.envName })

    const accountId = options.accountId || env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID || config.account_id || ''
    const apiToken = options.apiToken || env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN || ''

    const kvNamespaces = Array.isArray(config.kv_namespaces) ? config.kv_namespaces : []
    const findKvId = (binding) => kvNamespaces.find((ns) => ns && ns.binding === binding)?.id || ''
    const notesNamespaceId = options.notesNamespaceId || findKvId('NOTES')
    const shareNamespaceId = options.shareNamespaceId !== undefined ? options.shareNamespaceId : findKvId('SHARE')

    if (!notesNamespaceId) {
        throw new Error('Missing NOTES KV namespace ID in wrangler config or options')
    }

    const kvClient = options.kvClient || createCentralKvRestClient({
        accountId,
        apiToken,
        fetch: options.fetch || globalThis.fetch,
        apiBaseUrl: options.apiBaseUrl,
        maxPages: options.maxPages,
    })

    let db = options.db
    if (!db) {
        const plan = planDbInitTargets(config, {
            SCN_STORAGE_DRIVER: env.SCN_STORAGE_DRIVER,
            SCN_NOTES_DB_BINDING: env.SCN_NOTES_DB_BINDING,
        })
        const notesBindingName = plan.roles.notesDb
        if (!notesBindingName) {
            throw new Error('No notesDb D1 binding configured for migration')
        }
        const notesDbEntry = (config.d1_databases || []).find((d) => d && d.binding === notesBindingName)
        if (!notesDbEntry?.database_id) {
            throw new Error(`Missing database_id for notesDb binding "${notesBindingName}"`)
        }
        db = createCloudflareD1Client({
            accountId,
            databaseId: notesDbEntry.database_id,
            apiToken,
            fetch: options.fetch || globalThis.fetch,
            apiBaseUrl: options.apiBaseUrl,
        })
    }

    // Snapshot Pass 1 from central Cloudflare KV REST API
    const pass1 = {
        notes: await kvClient.snapshotNamespace(notesNamespaceId, { fetchMetadata: true }),
        share: await kvClient.snapshotNamespace(shareNamespaceId, { fetchMetadata: false }),
    }

    let stability = { stable: true, diffs: [] }
    if (audit) {
        const pass2 = {
            notes: await kvClient.snapshotNamespace(notesNamespaceId, { fetchMetadata: true }),
            share: await kvClient.snapshotNamespace(shareNamespaceId, { fetchMetadata: false }),
        }
        stability = compareSnapshotPasses(pass1, pass2)
        if (!stability.stable) {
            const err = new Error(`SNAPSHOT_UNSTABLE: central KV changed between audit passes (${stability.diffs.length} difference(s))`)
            err.code = 'SNAPSHOT_UNSTABLE'
            err.stability = stability
            throw err
        }
    }

    // Load current D1 state
    const d1NotesRes = await db.prepare('SELECT path, content, metadata, created_at, updated_at FROM notes').all()
    const d1SharesRes = await db.prepare('SELECT share_id, path, created_at FROM shares').all()
    const d1TombstonesRes = await db.prepare('SELECT path, deleted_note_uid FROM note_tombstones').all()
    const d1RegistryRes = await db.prepare('SELECT share_id, target_path, note_uid, is_csprng_v1, revoked_at, revoked_reason FROM share_token_registry').all()

    const d1ByPath = new Map()
    for (const row of (d1NotesRes?.results || [])) {
        if (!row?.path) continue
        d1ByPath.set(row.path, {
            ...row,
            parsedMeta: parseJsonMeta(row.metadata),
        })
    }

    const d1SharesByPath = new Map()
    const d1ShareById = new Map()
    for (const row of (d1SharesRes?.results || [])) {
        if (!row?.share_id || !row?.path) continue
        d1ShareById.set(row.share_id, row)
        if (!d1SharesByPath.has(row.path)) d1SharesByPath.set(row.path, [])
        d1SharesByPath.get(row.path).push(row.share_id)
    }

    const tombstonesSet = new Set()
    for (const row of (d1TombstonesRes?.results || [])) {
        if (row?.path && row?.deleted_note_uid) {
            tombstonesSet.add(`${row.path}\0${row.deleted_note_uid}`)
        }
    }

    const registryById = new Map()
    for (const row of (d1RegistryRes?.results || [])) {
        if (row?.share_id) registryById.set(row.share_id, row)
    }

    // Index SHARE KV tokens by target path and collect SHARE_STATUS:* entries
    const kvShareTokensByPath = new Map()
    const kvShareStatusEntries = []
    for (const [key, entry] of pass1.share.entries()) {
        if (key.startsWith('SHARE_STATUS:')) {
            const shareId = key.slice('SHARE_STATUS:'.length)
            const parsed = parseJsonMeta(entry.value)
            if (shareId && (parsed.status === 'burned' || parsed.status === 'expired')) {
                kvShareStatusEntries.push({
                    shareId,
                    status: parsed.status,
                    updatedAt: Number(parsed.updatedAt) || nowUnix,
                })
            }
            continue
        }
        const targetPath = String(entry.value || '').trim()
        if (!targetPath) continue
        if (!kvShareTokensByPath.has(targetPath)) kvShareTokensByPath.set(targetPath, [])
        kvShareTokensByPath.get(targetPath).push(key)
    }

    const allPaths = sortedUnique([
        ...Array.from(d1ByPath.keys()),
        ...Array.from(pass1.notes.keys()),
    ])

    const operations = []
    const conflicts = []
    const summary = {
        kvOnlyPromoted: 0,
        kvContentPromoted: 0,
        d1LegacyClaimed: 0,
        alreadyMigrated: 0,
        tombstonedSkipped: 0,
        resolvedByPreferKv: 0,
        resolvedByPreferD1: 0,
        resolvedByStricter: 0,
        terminalStatusPinned: 0,
        conflictsCount: 0,
    }

    for (const path of allPaths) {
        const d1Row = d1ByPath.get(path) || null
        const kvEntry = pass1.notes.get(path) || null
        const hasLegacyTombstone = tombstonesSet.has(`${path}\0__legacy__`)
        const d1ShareTokens = sortedUnique(d1SharesByPath.get(path) || [])
        const kvShareTokens = sortedUnique(kvShareTokensByPath.get(path) || [])
        const md5Path = md5Hex(path)

        // 1. Tombstoned legacy KV copy with no active D1 row: suppress resurrection
        if (!d1Row && kvEntry) {
            if (hasLegacyTombstone) {
                summary.tombstonedSkipped += 1
                operations.push({ action: 'tombstoned_skipped', path })
                continue
            }

            const kvMeta = kvEntry.metadata || {}
            const noteUid = kvMeta.noteUid || generateOpaqueId(16)
            const claimNonce = generateOpaqueId(16)
            const nextMeta = {
                ...kvMeta,
                noteUid,
                claimNonce,
                metaVersion: Math.max(1, Number(kvMeta.metaVersion || 0) || 1),
            }
            const createdAt = Math.floor(Number(kvMeta.createdAt || kvMeta.updateAt || nowUnix)) || nowUnix
            const updatedAt = Math.floor(Number(kvMeta.updateAt || kvMeta.createdAt || nowUnix)) || nowUnix

            summary.kvOnlyPromoted += 1
            operations.push({
                action: 'promote_kv_only',
                path,
                noteUid,
                buildStatements: () => buildUpdateAndSyncStatements(db, {
                    path,
                    content: kvEntry.value ?? '',
                    nextMetadata: nextMeta,
                    noteUid,
                    claimNonce,
                    previousMetaVersion: 0,
                    isExistingNote: false,
                    createdAt,
                    updatedAt,
                    nowUnix,
                    syncTokens: true,
                }),
            })
            continue
        }

        // 2. D1-only note (no KV entry)
        if (d1Row && !kvEntry) {
            if (kvShareTokens.length > 0 && !arraysEqual(kvShareTokens, d1ShareTokens)) {
                if (prefer === 'd1') {
                    summary.resolvedByPreferD1 += 1
                } else if (resolveStricter) {
                    summary.resolvedByStricter += 1
                } else {
                    conflicts.push({
                        path,
                        reason: 'share_mapping_divergence',
                        d1ShareTokens,
                        kvShareTokens,
                    })
                    continue
                }
            }

            const d1Meta = d1Row.parsedMeta
            if (!d1Meta.noteUid) {
                const noteUid = generateOpaqueId(16)
                const claimNonce = generateOpaqueId(16)
                const legacyToken = resolveLegacyToken(d1Meta)
                const isEligibleToken = isLegacyCutoverEligibleToken(legacyToken, path, md5Path)
                summary.d1LegacyClaimed += 1
                operations.push({
                    action: 'claim_d1_legacy',
                    path,
                    noteUid,
                    buildStatements: () => buildClaimLegacyStatements(db, {
                        path,
                        noteUid,
                        claimNonce,
                        nowUnix,
                        legacyToken,
                        isEligibleToken,
                    }),
                })
            } else {
                summary.alreadyMigrated += 1
                operations.push({ action: 'already_migrated', path, noteUid: d1Meta.noteUid })
            }
            continue
        }

        // 3. Both D1 and KV have this path
        const d1Meta = d1Row.parsedMeta
        const kvMeta = kvEntry.metadata || {}
        const securityDiffs = diffEffectiveSecurityFields(d1Meta, kvMeta)
        const shareMappingDiffers = !arraysEqual(kvShareTokens, d1ShareTokens)

        const kvTs = Math.max(Number(kvMeta.updateAt || 0), Number(kvMeta.createdAt || 0))
        const d1Ts = Math.max(Number(d1Row.updated_at || 0), Number(d1Meta.updateAt || 0))
        const contentDiffers = (kvEntry.value ?? '') !== (d1Row.content ?? '')

        if (securityDiffs.length > 0 || shareMappingDiffers) {
            if (!prefer && !resolveStricter) {
                conflicts.push({
                    path,
                    reason: securityDiffs.length > 0 ? 'security_metadata_divergence' : 'share_mapping_divergence',
                    securityDiffs,
                    d1ShareTokens,
                    kvShareTokens,
                    d1Ts,
                    kvTs,
                    contentDiffers,
                })
                continue
            }

            if (prefer === 'kv') {
                const noteUid = d1Meta.noteUid || kvMeta.noteUid || generateOpaqueId(16)
                const claimNonce = generateOpaqueId(16)
                const prevVersion = Number(d1Meta.metaVersion || 0)
                const nextMeta = {
                    ...kvMeta,
                    noteUid,
                    claimNonce,
                    metaVersion: prevVersion + 1,
                }
                const priorLegacyTokens = sortedUnique([
                    ...d1ShareTokens,
                    ...(resolveLegacyToken(d1Meta) ? [resolveLegacyToken(d1Meta)] : []),
                ])
                summary.resolvedByPreferKv += 1
                operations.push({
                    action: 'resolve_prefer_kv',
                    path,
                    noteUid,
                    buildStatements: () => buildUpdateAndSyncStatements(db, {
                        path,
                        content: kvEntry.value ?? '',
                        nextMetadata: nextMeta,
                        noteUid,
                        claimNonce,
                        previousMetaVersion: prevVersion,
                        isExistingNote: true,
                        createdAt: Number(d1Row.created_at || nowUnix),
                        updatedAt: kvTs || Number(d1Row.updated_at || nowUnix),
                        nowUnix,
                        syncTokens: true,
                        priorLegacyTokens,
                    }),
                })
                continue
            }

            if (prefer === 'd1') {
                summary.resolvedByPreferD1 += 1
                if (!d1Meta.noteUid) {
                    const noteUid = generateOpaqueId(16)
                    const claimNonce = generateOpaqueId(16)
                    const legacyToken = resolveLegacyToken(d1Meta)
                    const isEligibleToken = isLegacyCutoverEligibleToken(legacyToken, path, md5Path)
                    summary.d1LegacyClaimed += 1
                    operations.push({
                        action: 'resolve_prefer_d1_claim',
                        path,
                        noteUid,
                        buildStatements: () => buildClaimLegacyStatements(db, {
                            path,
                            noteUid,
                            claimNonce,
                            nowUnix,
                            legacyToken,
                            isEligibleToken,
                        }),
                    })
                } else {
                    operations.push({ action: 'resolve_prefer_d1_keep', path, noteUid: d1Meta.noteUid })
                }
                continue
            }

            // resolveStricter
            if (kvTs === d1Ts && contentDiffers) {
                conflicts.push({
                    path,
                    reason: 'equal_timestamp_content_divergence',
                    securityDiffs,
                    d1Ts,
                    kvTs,
                    contentDiffers,
                })
                continue
            }

            const stricter = resolveStricterSecurityState({
                path,
                d1Meta,
                kvMeta,
                d1ShareTokens,
                kvShareTokens,
                nowUnix,
            })
            if (stricter.ambiguousConflict) {
                conflicts.push({
                    path,
                    reason: stricter.reason || 'ambiguous_security_conflict',
                    securityDiffs,
                    d1Ts,
                    kvTs,
                })
                continue
            }

            const takeKvContent = kvTs > d1Ts
            const winningContent = takeKvContent ? (kvEntry.value ?? '') : (d1Row.content ?? '')
            const noteUid = d1Meta.noteUid || kvMeta.noteUid || generateOpaqueId(16)
            const claimNonce = generateOpaqueId(16)
            const prevVersion = Number(d1Meta.metaVersion || 0)
            const nextMeta = {
                ...(takeKvContent ? kvMeta : d1Meta),
                ...stricter.mergedMeta,
                noteUid,
                claimNonce,
                metaVersion: prevVersion + 1,
            }
            const nextUpdatedAt = takeKvContent
                ? (kvTs || Number(d1Row.updated_at || nowUnix))
                : Number(d1Row.updated_at || nowUnix)

            const priorLegacyTokens = sortedUnique([
                ...d1ShareTokens,
                ...(resolveLegacyToken(d1Meta) ? [resolveLegacyToken(d1Meta)] : []),
                ...(resolveLegacyToken(kvMeta) ? [resolveLegacyToken(kvMeta)] : []),
            ])
            summary.resolvedByStricter += 1
            operations.push({
                action: 'resolve_stricter',
                path,
                noteUid,
                buildStatements: () => buildUpdateAndSyncStatements(db, {
                    path,
                    content: winningContent,
                    nextMetadata: nextMeta,
                    noteUid,
                    claimNonce,
                    previousMetaVersion: prevVersion,
                    isExistingNote: true,
                    createdAt: Number(d1Row.created_at || nowUnix),
                    updatedAt: nextUpdatedAt,
                    nowUnix,
                    syncTokens: true,
                    priorLegacyTokens,
                }),
            })
            continue
        }

        // Security metadata and SHARE/shares mappings match
        if (kvTs > d1Ts) {
            const noteUid = d1Meta.noteUid || kvMeta.noteUid || generateOpaqueId(16)
            const claimNonce = generateOpaqueId(16)
            const prevVersion = Number(d1Meta.metaVersion || 0)
            const nextMeta = {
                ...kvMeta,
                noteUid,
                claimNonce,
                metaVersion: prevVersion + 1,
            }
            summary.kvContentPromoted += 1
            operations.push({
                action: 'promote_kv_content',
                path,
                noteUid,
                buildStatements: () => buildUpdateAndSyncStatements(db, {
                    path,
                    content: kvEntry.value ?? '',
                    nextMetadata: nextMeta,
                    noteUid,
                    claimNonce,
                    previousMetaVersion: prevVersion,
                    isExistingNote: true,
                    createdAt: Number(d1Row.created_at || nowUnix),
                    updatedAt: kvTs,
                    nowUnix,
                    syncTokens: !d1Meta.noteUid,
                }),
            })
            continue
        }

        if (kvTs === d1Ts && contentDiffers) {
            if (prefer === 'kv') {
                const noteUid = d1Meta.noteUid || kvMeta.noteUid || generateOpaqueId(16)
                const claimNonce = generateOpaqueId(16)
                const prevVersion = Number(d1Meta.metaVersion || 0)
                const nextMeta = {
                    ...kvMeta,
                    noteUid,
                    claimNonce,
                    metaVersion: prevVersion + 1,
                }
                summary.resolvedByPreferKv += 1
                operations.push({
                    action: 'resolve_prefer_kv_content',
                    path,
                    noteUid,
                    buildStatements: () => buildUpdateAndSyncStatements(db, {
                        path,
                        content: kvEntry.value ?? '',
                        nextMetadata: nextMeta,
                        noteUid,
                        claimNonce,
                        previousMetaVersion: prevVersion,
                        isExistingNote: true,
                        createdAt: Number(d1Row.created_at || nowUnix),
                        updatedAt: kvTs || Number(d1Row.updated_at || nowUnix),
                        nowUnix,
                        syncTokens: !d1Meta.noteUid,
                    }),
                })
                continue
            }
            if (prefer === 'd1') {
                summary.resolvedByPreferD1 += 1
                if (!d1Meta.noteUid) {
                    const noteUid = generateOpaqueId(16)
                    const claimNonce = generateOpaqueId(16)
                    const legacyToken = resolveLegacyToken(d1Meta)
                    const isEligibleToken = isLegacyCutoverEligibleToken(legacyToken, path, md5Path)
                    summary.d1LegacyClaimed += 1
                    operations.push({
                        action: 'resolve_prefer_d1_claim',
                        path,
                        noteUid,
                        buildStatements: () => buildClaimLegacyStatements(db, {
                            path,
                            noteUid,
                            claimNonce,
                            nowUnix,
                            legacyToken,
                            isEligibleToken,
                        }),
                    })
                } else {
                    operations.push({ action: 'resolve_prefer_d1_keep', path, noteUid: d1Meta.noteUid })
                }
                continue
            }

            conflicts.push({
                path,
                reason: 'equal_timestamp_content_divergence',
                d1Ts,
                kvTs,
                contentDiffers: true,
            })
            continue
        }

        // D1 is strictly newer or identical
        if (!d1Meta.noteUid) {
            const noteUid = generateOpaqueId(16)
            const claimNonce = generateOpaqueId(16)
            const legacyToken = resolveLegacyToken(d1Meta)
            const isEligibleToken = isLegacyCutoverEligibleToken(legacyToken, path, md5Path)
            summary.d1LegacyClaimed += 1
            operations.push({
                action: 'claim_d1_legacy',
                path,
                noteUid,
                buildStatements: () => buildClaimLegacyStatements(db, {
                    path,
                    noteUid,
                    claimNonce,
                    nowUnix,
                    legacyToken,
                    isEligibleToken,
                }),
            })
        } else {
            summary.alreadyMigrated += 1
            operations.push({ action: 'already_migrated', path, noteUid: d1Meta.noteUid })
        }
    }

    summary.conflictsCount = conflicts.length

    if (audit) {
        return {
            ok: true,
            mode: 'audit',
            stable: stability.stable,
            stability,
            snapshot: {
                notesKvCount: pass1.notes.size,
                shareKvCount: pass1.share.size,
                d1NotesCount: d1ByPath.size,
                d1SharesCount: d1ShareById.size,
                d1TombstonesCount: tombstonesSet.size,
                d1RegistryCount: registryById.size,
            },
            summary,
            conflicts,
            operations: operations.map(({ buildStatements, ...rest }) => rest),
        }
    }

    // Mutation mode: fail closed before ANY D1 mutation if unresolved conflicts exist
    if (conflicts.length > 0) {
        const err = new Error(
            `MIGRATION_ABORTED_CONFLICTS: ${conflicts.length} conflict(s) detected (${conflicts.map((c) => `${c.path}:${c.reason}`).join(', ')}); pass --prefer=kv|d1 or --resolve-stricter to resolve`
        )
        err.code = 'MIGRATION_ABORTED_CONFLICTS'
        err.conflicts = conflicts
        err.summary = summary
        throw err
    }

    for (const op of operations) {
        if (typeof op.buildStatements !== 'function') continue
        const stmts = op.buildStatements()
        if (!stmts.length) continue
        const results = await db.batch(stmts)
        const firstChanges = Number(results?.[0]?.meta?.changes ?? 0)
        if (firstChanges !== 1) {
            throw new Error(`MIGRATION_CAS_FAILED: operation ${op.action} on "${op.path}" affected ${firstChanges} rows (expected 1)`)
        }
    }

    // Pin orphaned terminal SHARE_STATUS:* KV entries (7-day TTL) into share_token_registry
    for (const entry of kvShareStatusEntries) {
        if (!isLegacyCutoverEligibleToken(entry.shareId, '', '')) continue
        const res = await db.prepare(`
            INSERT INTO share_token_registry (share_id, target_path, note_uid, is_csprng_v1, created_at, revoked_at, revoked_reason)
            SELECT ?, '__legacy_terminal__', '__legacy_terminal__', 0, ?, ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM share_token_registry WHERE share_id = ?)
              AND NOT EXISTS (SELECT 1 FROM shares WHERE share_id = ?)
        `).bind(
            entry.shareId,
            entry.updatedAt,
            entry.updatedAt,
            entry.status,
            entry.shareId,
            entry.shareId
        ).run()
        if (Number(res?.meta?.changes ?? 0) === 1) {
            summary.terminalStatusPinned += 1
        }
    }

    // Completion parity verification
    const expectedNotesCount = allPaths.filter((p) => d1ByPath.has(p) || !tombstonesSet.has(`${p}\0__legacy__`)).length
    const notesCountRow = await db.prepare('SELECT COUNT(*) AS cnt FROM notes').first()
    const unclaimedRow = await db.prepare("SELECT COUNT(*) AS cnt FROM notes WHERE json_extract(metadata, '$.noteUid') IS NULL").first()
    const sharesCountRow = await db.prepare('SELECT COUNT(*) AS cnt FROM shares').first()
    const activeRegistryRow = await db.prepare('SELECT COUNT(*) AS cnt FROM share_token_registry WHERE revoked_at IS NULL').first()
    const terminalRegistryRow = await db.prepare('SELECT COUNT(*) AS cnt FROM share_token_registry WHERE revoked_at IS NOT NULL').first()
    const orphanSharesRow = await db.prepare(`
        SELECT COUNT(*) AS cnt FROM shares s
        WHERE NOT EXISTS (
            SELECT 1 FROM share_token_registry r
            WHERE r.share_id = s.share_id AND r.target_path = s.path AND r.revoked_at IS NULL
        )
    `).first()
    const missingSharesRow = await db.prepare(`
        SELECT COUNT(*) AS cnt FROM share_token_registry r
        WHERE r.revoked_at IS NULL AND (
            NOT EXISTS (SELECT 1 FROM shares s WHERE s.share_id = r.share_id AND s.path = r.target_path)
            OR NOT EXISTS (SELECT 1 FROM notes n WHERE n.path = r.target_path AND json_extract(n.metadata, '$.noteUid') = r.note_uid)
        )
    `).first()
    const revokedInSharesRow = await db.prepare(`
        SELECT COUNT(*) AS cnt FROM shares s
        WHERE EXISTS (
            SELECT 1 FROM share_token_registry r
            WHERE r.share_id = s.share_id AND r.revoked_at IS NOT NULL
        )
    `).first()

    const parity = {
        expectedNotesCount,
        notesCount: Number(notesCountRow?.cnt ?? 0),
        unclaimedNotesCount: Number(unclaimedRow?.cnt ?? 0),
        sharesCount: Number(sharesCountRow?.cnt ?? 0),
        activeRegistryCount: Number(activeRegistryRow?.cnt ?? 0),
        terminalRegistryCount: Number(terminalRegistryRow?.cnt ?? 0),
        orphanSharesCount: Number(orphanSharesRow?.cnt ?? 0),
        missingSharesCount: Number(missingSharesRow?.cnt ?? 0),
        revokedInSharesCount: Number(revokedInSharesRow?.cnt ?? 0),
    }

    const parityOk =
        parity.notesCount === parity.expectedNotesCount
        && parity.unclaimedNotesCount === 0
        && parity.sharesCount === parity.activeRegistryCount
        && parity.orphanSharesCount === 0
        && parity.missingSharesCount === 0
        && parity.revokedInSharesCount === 0

    if (!parityOk) {
        const err = new Error(`PARITY_CHECK_FAILED: ${JSON.stringify(parity)}`)
        err.code = 'PARITY_CHECK_FAILED'
        err.parity = parity
        throw err
    }

    return {
        ok: true,
        mode: 'cutover',
        summary,
        parity,
        operations: operations.map(({ buildStatements, ...rest }) => rest),
    }
}

function parseCliArgs(argv) {
    const parsed = {
        configPath: 'wrangler.toml',
        envName: '',
        audit: false,
        confirmQuiescedSnapshot: false,
        prefer: '',
        resolveStricter: false,
        accountId: '',
        notesNamespaceId: '',
        shareNamespaceId: undefined,
        nowUnix: undefined,
    }
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i]
        if (arg === '--audit') {
            parsed.audit = true
        } else if (arg === '--confirm-quiesced-snapshot') {
            parsed.confirmQuiescedSnapshot = true
        } else if (arg === '--resolve-stricter') {
            parsed.resolveStricter = true
        } else if (arg === '--prefer' && argv[i + 1]) {
            parsed.prefer = argv[++i]
        } else if (arg.startsWith('--prefer=')) {
            parsed.prefer = arg.slice('--prefer='.length)
        } else if (arg === '--config' && argv[i + 1]) {
            parsed.configPath = argv[++i]
        } else if (arg.startsWith('--config=')) {
            parsed.configPath = arg.slice('--config='.length)
        } else if (arg === '--env' && argv[i + 1]) {
            parsed.envName = argv[++i]
        } else if (arg.startsWith('--env=')) {
            parsed.envName = arg.slice('--env='.length)
        } else if (arg === '--account-id' && argv[i + 1]) {
            parsed.accountId = argv[++i]
        } else if (arg.startsWith('--account-id=')) {
            parsed.accountId = arg.slice('--account-id='.length)
        } else if (arg === '--notes-namespace-id' && argv[i + 1]) {
            parsed.notesNamespaceId = argv[++i]
        } else if (arg.startsWith('--notes-namespace-id=')) {
            parsed.notesNamespaceId = arg.slice('--notes-namespace-id='.length)
        } else if (arg === '--share-namespace-id' && argv[i + 1]) {
            parsed.shareNamespaceId = argv[++i]
        } else if (arg.startsWith('--share-namespace-id=')) {
            parsed.shareNamespaceId = arg.slice('--share-namespace-id='.length)
        } else if (arg === '--now' && argv[i + 1]) {
            parsed.nowUnix = Number(argv[++i])
        } else if (arg.startsWith('--now=')) {
            parsed.nowUnix = Number(arg.slice('--now='.length))
        }
    }
    return parsed
}

async function main() {
    const cli = parseCliArgs(process.argv.slice(2))
    const result = await migrateLegacyNotes({
        configPath: cli.configPath,
        envName: cli.envName,
        audit: cli.audit,
        confirmQuiescedSnapshot: cli.confirmQuiescedSnapshot,
        prefer: cli.prefer,
        resolveStricter: cli.resolveStricter,
        accountId: cli.accountId || undefined,
        notesNamespaceId: cli.notesNamespaceId || undefined,
        shareNamespaceId: cli.shareNamespaceId,
        nowUnix: cli.nowUnix,
    })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirectExecution) {
    main().catch((err) => {
        process.stderr.write(`db:migrate-legacy error: ${err?.message || err}\n`)
        if (err?.conflicts) {
            process.stderr.write(`${JSON.stringify({ conflicts: err.conflicts }, null, 2)}\n`)
        }
        process.exit(1)
    })
}
