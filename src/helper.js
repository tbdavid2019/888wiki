import jwt from '@tsndr/cloudflare-worker-jwt'
import { Cookies } from './cookie_compat.mjs'
import * as TEMPL from './template.js'
import { SUPPORTED_LANG, getGaMeasurementId, getSalt, getSecret, getTurnstileSiteKey, isTurnstileEnabled } from './constant.js'
import { resolvePasswordRole } from './password_policy.mjs'
import { getNoteHistoryConfig, deleteNoteHistoryVersions } from './note_history.mjs'
import { driverQueryNote, driverDeleteNote } from './storage_driver.mjs'

const getNotesNamespace = () => globalThis.NOTES
const getShareNamespace = () => globalThis.SHARE

// generate random string using CSPRNG when available
export const genRandomStr = (n = 4) => {
    // remove char that confuse user
    const charset = '2345679abcdefghjkmnpqrstwxyz'
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const randomBytes = new Uint8Array(n)
        crypto.getRandomValues(randomBytes)
        let res = ''
        for (let i = 0; i < n; i++) {
            res += charset.charAt(randomBytes[i] % charset.length)
        }
        return res
    }
    return Array(n)
        .join()
        .split(',')
        .map(() => charset.charAt(Math.floor(Math.random() * charset.length)))
        .join('')
}

export function returnPage(type, data, headers = {}) {
    const ext = {
        ...(data?.ext || {}),
        gaMeasurementId: data?.ext?.gaMeasurementId ?? getGaMeasurementId(),
        noteHistoryEnabled: data?.ext?.noteHistoryEnabled ?? getNoteHistoryConfig().enabled,
        turnstileSiteKey: data?.ext?.turnstileSiteKey ?? getTurnstileSiteKey(),
        turnstileEnabled: data?.ext?.turnstileEnabled ?? isTurnstileEnabled(),
    }

    return new Response(TEMPL[type]({ ...data, ext }), {
        headers: {
            'content-type': 'text/html;charset=UTF-8',
            'Cache-Control': 'no-store',
            ...headers,
        },
    });
}

export function returnJSON(code, data, headers = {}) {
    const { status: requestedStatus, ...responseHeaders } = headers
    const successTempl = {
        err: 0,
        msg: 'ok',
        ...data && { data },
    }
    const errTempl = {
        err: code,
        msg: JSON.stringify(data),
    }
    const ret = code ? errTempl : successTempl
    let fallbackStatus = 400
    if (code === 0) fallbackStatus = 200
    else if (code >= 400 && code < 600) fallbackStatus = code
    else if (code >= 50000) fallbackStatus = 500
    const responseStatus = Number.isInteger(requestedStatus) && requestedStatus >= 200 && requestedStatus <= 599
        ? requestedStatus
        : fallbackStatus
    return new Response(JSON.stringify(ret), {
        status: responseStatus,
        headers: {
            'content-type': 'application/json;charset=UTF-8',
            ...responseHeaders,
        },
    })
}

export async function MD5(str) {
    if (typeof str !== 'string') {
        console.warn('MD5: Input is not a string, converting', str)
        str = String(str || '')
    }
    try {
        const msgUint8 = new TextEncoder().encode(str)
        const hashBuffer = await crypto.subtle.digest('MD5', msgUint8)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (e) {
        try {
            const nodeCrypto = await import('node:crypto')
            if (nodeCrypto?.createHash) {
                return nodeCrypto.createHash('md5').update(str).digest('hex')
            }
        } catch (_) {}
        console.error('MD5 Error:', e)
        throw new Error(`MD5 Hashing failed: ${e.message}`)
    }
}

export async function saltPw(password) {
    const hashPw = await MD5(password)
    return await MD5(`${hashPw}+${getSalt() || ''}`)
}

async function legacySaltPw(password) {
    const hashPw = await MD5(password)
    return await MD5(`${hashPw}+undefined`)
}

function constantTimeStringCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    return diff === 0
}

export async function passwordMatches(password, storedHash) {
    if (!storedHash || typeof password !== 'string') return false
    const currentHash = await saltPw(password)
    if (constantTimeStringCompare(storedHash, currentHash)) return true

    const legacyHash = await legacySaltPw(password)
    return constantTimeStringCompare(storedHash, legacyHash)
}

// Keep password policy identical for direct notes and share links.
// An edit password always grants edit access. If there is no separate edit
// password, the view password is the sole owner credential and grants edit.
export async function getPasswordRole(password, metadata = {}) {
    return resolvePasswordRole(password, metadata, passwordMatches)
}

export async function checkAuth(cookie, path) {
    if (cookie.auth) {
        try {
            const secret = getSecret()
            if (typeof secret !== 'string' || !secret) {
                return { valid: false, role: null }
            }

            const valid = await jwt.verify(cookie.auth, secret)
            if (valid) {
                const payload = jwt.decode(cookie.auth)
                // Backward compatibility: if no role, assume 'edit' (old tokens)
                const role = payload.role || 'edit'
                if (payload.path === path) {
                    return { valid: true, role }
                }
            }
        } catch (error) {
            console.warn('Auth verification failed:', error?.message || error)
        }
    }
    return { valid: false, role: null }
}

export async function queryNote(key) {
    return await driverQueryNote(key)
}

export async function deleteNoteHistoryForPath(path) {
    const { enabled, db } = getNoteHistoryConfig()
    if (!enabled || !db || !path) return
    await deleteNoteHistoryVersions(db, path)
}

export function getI18n(request) {
    const DEFAULT_LANG = 'zh-TW'
    const FALLBACK_LANG = 'en-US'
    const normalizeLang = (rawLang = '') => {
        const lang = rawLang.trim().toLowerCase()
        if (!lang) return ''
        if (lang.startsWith('zh')) return DEFAULT_LANG
        if (lang === 'en' || lang.startsWith('en-')) return FALLBACK_LANG
        return FALLBACK_LANG
    }

    const cookie = Cookies.parse(request.headers.get('Cookie') || '')
    const cookieLang = normalizeLang(cookie.lang || '')
    if (cookieLang && SUPPORTED_LANG[cookieLang]) return cookieLang

    const al = request.headers.get('Accept-Language') || ''
    const acceptList = al.split(',').map(lang => lang.split(';')[0].trim()).filter(Boolean)
    const detectedLang = acceptList.map(normalizeLang).find(lang => SUPPORTED_LANG[lang])

    return detectedLang || DEFAULT_LANG
}

/**
 * Delete all truly empty pages (content length === 0 and no passwords attached)
 * @returns {Promise<{deleted: number, errors: string[]}>}
 */
export async function deleteEmptyPages() {
    const deleted = []
    const errors = []
    const kv = getNotesNamespace()
    if (!kv) return { deleted: 0, errors: ['Notes KV namespace is not configured'] }

    try {
        let cursor = undefined
        let listComplete = false

        while (!listComplete) {
            const list = await kv.list({ cursor, limit: 1000 })
            cursor = list.cursor
            listComplete = list.list_complete

            for (const note of list.keys) {
                try {
                    const { value, metadata } = await driverQueryNote(note.name)

                    // Only delete truly empty pages (length 0) with no passwords attached
                    const isContentEmpty = !value || String(value).trim().length === 0
                    const hasPassword = Boolean(metadata?.pw || metadata?.vpw)

                    if (isContentEmpty && !hasPassword) {
                        await driverDeleteNote(note.name)
                        const md5 = await MD5(note.name)
                        const shareKv = getShareNamespace()
                        if (shareKv) await shareKv.delete(md5)
                        await deleteNoteHistoryForPath(note.name)
                        deleted.push(note.name)
                    }
                } catch (e) {
                    errors.push(`Failed to process ${note.name}: ${e.message}`)
                }
            }

            if (!cursor) break
        }
    } catch (e) {
        errors.push(`Failed to list notes: ${e.message}`)
    }

    return { deleted: deleted.length, errors }
}
