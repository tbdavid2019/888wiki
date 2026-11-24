/**
 * static/js/account-space.mjs
 * Personal Space (/_space) hydration, filters, local-only drafts view,
 * categorized guest share-history confirmation import, Share Circles CRUD,
 * and Passkey/nickname management.
 */
import {
    AccountApiError,
    accountFetch,
    addPasskeyWithStepUp,
    copyCurrentUrlToClipboard,
    isEmbeddedWebView,
    listPasskeys,
    loginWithPasskey,
    logoutAccount,
    registerPasskey,
    removePasskeyWithStepUp,
    updateNickname,
} from './account-auth.mjs'
import { openCirclePicker } from './account-circle-picker.mjs'
import { offlineStore } from './offline-store.mjs'

const SHARE_HISTORY_CREATED_KEY = 'cf-notepad:share-history:created'
const SHARE_HISTORY_VIEWED_KEY = 'cf-notepad:share-history:viewed'
const SPACE_IMPORT_PROMPTED_KEY = 'cf-notepad:space-import-prompted'
const MAX_IMPORT_CANDIDATES = 50
const SPACE_PAGE_SIZE = 50

const VALID_FACETS = new Set(['all', 'created', 'edited', 'bookmarked', 'annotated'])
const VALID_FORMATS = new Set(['all', 'markdown', 'block', 'canvas', 'whiteboard'])
const VALID_PUBLISH_THEMES = new Set([
    'ayu-light', 'claude-canvas', 'catppuccin-latte', 'botanical', 'shopify-mint',
    'newsprint', 'notion-clean', 'retro', 'organic', 'green-simple', 'professional',
    'bauhaus', 'neo-brutalism', 'playful-geometric', 'sketch', 'tokyo-night',
    'catppuccin-macchiato', 'terminal', 'kanagawa', 'x-ai',
])

export function normalizeGuestShareUrl(rawUrl, currentOrigin) {
    if (!rawUrl || typeof rawUrl !== 'string') return null
    let parsed
    try {
        parsed = new URL(rawUrl.trim(), currentOrigin)
    } catch {
        return null
    }
    if (parsed.origin !== currentOrigin) return null
    if (parsed.username || parsed.password) return null
    // Reject query credentials or unexpected query params on share URLs
    if (parsed.search && /[?&](pw|vpw|token|auth|password|secret)=/i.test(parsed.search)) {
        return null
    }
    const match = parsed.pathname.match(/^\/share\/([^/]+?)(?:\/(present|book))?\/?$/i)
    if (!match) return null
    let shareId = match[1]
    try {
        shareId = decodeURIComponent(shareId)
    } catch {
        return null
    }
    if (!shareId || shareId.includes('/') || shareId.includes('..')) return null
    return {
        shareId,
        normalizedUrl: `${currentOrigin}/share/${encodeURIComponent(shareId)}`,
    }
}

export function collectGuestShareHistoryCandidates({
    origin = typeof window !== 'undefined' ? window.location.origin : 'https://wiki.david888.com',
    storage = typeof window !== 'undefined' ? window.localStorage : null,
} = {}) {
    if (!storage) return []
    const readBucket = (key, sourceType) => {
        try {
            const raw = storage.getItem(key)
            const list = raw ? JSON.parse(raw) : []
            if (!Array.isArray(list)) return []
            return list.map(entry => ({
                source: sourceType,
                url: String(entry?.url || ''),
                title: String(entry?.title || '').trim(),
                savedAt: Number(entry?.savedAt || 0),
            }))
        } catch {
            return []
        }
    }

    const combined = [
        ...readBucket(SHARE_HISTORY_CREATED_KEY, 'created'),
        ...readBucket(SHARE_HISTORY_VIEWED_KEY, 'viewed'),
    ].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))

    const seenShareIds = new Map()
    for (const entry of combined) {
        const normalized = normalizeGuestShareUrl(entry.url, origin)
        if (!normalized) continue
        if (!seenShareIds.has(normalized.shareId)) {
            seenShareIds.set(normalized.shareId, {
                shareId: normalized.shareId,
                url: normalized.normalizedUrl,
                source: entry.source,
                title: entry.title || normalized.shareId,
                savedAt: entry.savedAt || 0,
            })
        }
        if (seenShareIds.size >= MAX_IMPORT_CANDIDATES) break
    }
    return Array.from(seenShareIds.values())
}

export function collectLocalSpaceImportCandidates({
    origin = typeof window !== 'undefined' ? window.location.origin : 'https://wiki.david888.com',
    storage = typeof window !== 'undefined' ? window.localStorage : null,
    store = offlineStore,
} = {}) {
    const shareCandidates = collectGuestShareHistoryCandidates({ origin, storage })
    const drafts = readLocalDeviceDrafts(store)
    const combined = []
    const seenPaths = new Set()
    const seenShareIds = new Set()

    for (const draft of drafts) {
        const notePath = String(draft?.path || '').trim()
        if (!notePath || notePath.startsWith('local/') || notePath.includes('/') || draft?.syncStatus === 'draft') continue
        if (seenPaths.has(notePath)) continue
        seenPaths.add(notePath)
        combined.push({
            path: notePath,
            url: `${origin}/${encodeURIComponent(notePath)}`,
            source: 'created',
            title: String(draft?.title || notePath).trim() || notePath,
            savedAt: Number(draft?.updatedAt || 0),
        })
        if (combined.length >= MAX_IMPORT_CANDIDATES) return combined
    }

    for (const entry of shareCandidates) {
        if (seenShareIds.has(entry.shareId)) continue
        seenShareIds.add(entry.shareId)
        combined.push(entry)
        if (combined.length >= MAX_IMPORT_CANDIDATES) break
    }
    return combined
}

export function parseManualImportInputs(
    rawText,
    currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://wiki.david888.com',
) {
    if (!rawText || typeof rawText !== 'string') return []
    const tokens = rawText
        .split(/[\r\n,\s]+/)
        .map(t => t.trim())
        .filter(Boolean)

    const out = []
    const seen = new Set()
    for (const token of tokens) {
        if (out.length >= MAX_IMPORT_CANDIDATES) break
        const shareNorm = normalizeGuestShareUrl(token, currentOrigin)
        if (shareNorm) {
            const key = `share:${shareNorm.shareId}`
            if (!seen.has(key)) {
                seen.add(key)
                out.push({
                    shareId: shareNorm.shareId,
                    url: shareNorm.normalizedUrl,
                    source: 'created',
                    title: shareNorm.shareId,
                    savedAt: 0,
                })
            }
            continue
        }

        if (/^https?:\/\//i.test(token) || token.startsWith('/')) {
            if (token.startsWith('//')) continue
            let parsed
            try {
                parsed = new URL(token, currentOrigin)
            } catch {
                continue
            }
            if (parsed.origin !== currentOrigin || parsed.username || parsed.password) continue
            if (parsed.search && /[?&](pw|vpw|token|auth|password|secret)=/i.test(parsed.search)) continue
            const pathMatch = parsed.pathname.match(/^\/([^/]+)\/?$/)
            if (!pathMatch) continue
            let decoded = ''
            try {
                decoded = decodeURIComponent(pathMatch[1])
            } catch {
                continue
            }
            if (!decoded || decoded.includes('/') || decoded.includes('..')) continue
            const key = `path:${decoded}`
            if (!seen.has(key)) {
                seen.add(key)
                out.push({
                    path: decoded,
                    url: `${currentOrigin}/${encodeURIComponent(decoded)}`,
                    source: 'created',
                    title: decoded,
                    savedAt: 0,
                })
            }
            continue
        }

        if (!token.includes('/') && !token.includes('..') && !token.includes('?') && !token.includes('#')) {
            const key = `path:${token}`
            if (!seen.has(key)) {
                seen.add(key)
                out.push({
                    path: token,
                    url: `${currentOrigin}/${encodeURIComponent(token)}`,
                    source: 'created',
                    title: token,
                    savedAt: 0,
                })
            }
        }
    }
    return out
}

export function readLocalDeviceDrafts(store = offlineStore) {
    try {
        const list = store?.getAllNotesMetadata ? store.getAllNotesMetadata() : []
        return Array.isArray(list) ? list : []
    } catch {
        return []
    }
}

function readBootstrapState() {
    if (typeof document === 'undefined') return {}
    const el = document.getElementById('space-bootstrap')
    if (!el) return {}
    try {
        return JSON.parse(el.textContent || '{}') || {}
    } catch {
        return {}
    }
}

function formatDate(unixOrMs) {
    const num = Number(unixOrMs || 0)
    if (!Number.isFinite(num) || num <= 0) return '—'
    const ms = num > 1e12 ? num : num * 1000
    try {
        return new Date(ms).toLocaleString()
    } catch {
        return '—'
    }
}

function getSpaceLabels(lang) {
    const isZh = lang !== 'en-US'
    return {
        isZh,
        maskedTitle: 'Unavailable or Protected Note',
        remove: isZh ? '移除' : 'Remove',
        edit: isZh ? '編輯' : 'Edit',
        openShare: isZh ? '開啟分享' : 'Open Share',
        addToCircle: isZh ? '加入分享圈' : 'Add to Circle',
        emptyItems: isZh ? '目前沒有符合條件的筆記項目。' : 'No matching notes in your Space yet.',
        emptyTitle: isZh ? '您的私人空間目前是空的' : 'Your Personal Space is empty',
        emptyHint: isZh ? '登入前的匿名筆記與本機瀏覽紀錄不會在背景自動上傳；您可以立即匯入此瀏覽器曾編輯／分享的筆記、貼上既有筆記網址認領，或前往「本機草稿」發布同步。' : 'Existing browser history and anonymous notes are never uploaded silently. You can import notes edited or shared in this browser, paste existing URLs to claim them, or publish local drafts.',
        emptyImportBtn: isZh ? '匯入本機筆記與紀錄' : 'Import Local Notes & URLs',
        emptyPasteBtn: isZh ? '貼上筆記網址認領' : 'Paste URLs to Claim',
        emptyDraftsBtn: isZh ? '前往本機草稿發布' : 'Open Local Drafts',
        emptyAnnotations: isZh ? '目前沒有具名批註紀錄。' : 'No signed annotations yet.',
        emptyDrafts: isZh ? '目前沒有本機未同步草稿。' : 'No device-local drafts found.',
        emptyCircles: isZh ? '尚未建立分享圈。' : 'No Share Circles created yet.',
        localOnlyBadge: isZh ? '僅存本機未發布' : 'Device-local draft (unpublished)',
        localCachedBadge: isZh ? '本機快取（曾發布）' : 'Device-local cache (published)',
        publishAndSync: isZh ? '發布並同步至空間' : 'Publish & Sync',
        syncToSpace: isZh ? '同步至空間' : 'Sync to Space',
        publishing: isZh ? '發布中...' : 'Publishing...',
        syncing: isZh ? '同步中...' : 'Syncing...',
        draftPublishSuccess: isZh ? '已發布並同步至私人空間！' : 'Published and synced to My Space!',
        draftPublishTurnstile: isZh ? '此筆記需要完成安全驗證後才能發布，請點「編輯」於編輯器中發布。' : 'Turnstile verification is required to publish this note. Click Edit to publish in the editor.',
        draftPublishAuthErr: isZh ? '此筆記受密碼保護或無編輯權限，請點「編輯」驗證後再發布。' : 'Password or edit auth required. Click Edit to unlock and publish.',
        draftSyncNone: isZh ? '此筆記目前在雲端尚未發布或無法同步，請先點「編輯」發布。' : 'This note is not published on the server yet. Click Edit to publish it first.',
        burnWarning: isZh ? '閱後即焚' : 'Burn After Read',
        circleHiddenItem: 'Hidden (currently unavailable)',
        circleOn: 'ON',
        circleOff: 'OFF',
        copyLink: isZh ? '複製連結' : 'Copy Link',
        copied: isZh ? '已複製' : 'Copied',
        rotateLink: isZh ? '輪替連結' : 'Rotate URL',
        deleteCircle: isZh ? '刪除' : 'Delete',
        manageItems: isZh ? '管理內容' : 'Manage Items',
        minOnePasskey: isZh ? '至少須保留 1 組 Passkey' : 'At least 1 Passkey required',
        syncedPasskey: isZh ? '可同步 Passkey' : 'Synced Passkey',
        deviceBoundPasskey: isZh ? '裝置限定 Passkey' : 'Device-bound',
        importChecking: isZh ? '正在檢查本機筆記與分享紀錄的可見狀態...' : 'Checking live availability of local notes & share history...',
        importNoneFound: isZh ? '未偵測到此瀏覽器的本機分享紀錄或已編輯筆記；您可在上方手動貼上既有筆記網址或路徑檢查認領。' : 'No local share history or edited notes found in this browser. You can paste note/share URLs above to claim them.',
        importEligibleEdit: isZh ? '可匯入 (edit 編輯權限)' : 'Eligible (edit)',
        importEligible: isZh ? '可匯入 (share_only)' : 'Eligible (share_only)',
        importAlready: isZh ? '已在空間中' : 'Already in Space',
        importUnpublished: isZh ? '尚未發布（請先至本機草稿發布）' : 'Unpublished (publish from Local Drafts)',
        importUnavailable: isZh ? '已失效 / 受保護' : 'Unavailable / Protected',
        importSourceEditPath: isZh ? '本機已編輯筆記 (/:path)' : 'Local Edited Note (/:path)',
        importSourceCreated: isZh ? '曾分享 (Created → 唯讀匯入)' : 'Created (imports as share_only)',
        importSourceViewed: isZh ? '曾瀏覽 (Viewed → 唯讀匯入)' : 'Viewed (imports as share_only)',
        importManualEmpty: isZh ? '請輸入至少一個有效的同網域網址或筆記路徑（例如 wfat 或 https://wiki.david888.com/wfat）。' : 'Enter at least one valid same-origin URL or note slug.',
        importSuccess: count => isZh ? `已成功匯入 ${count} 筆紀錄至私人空間。` : `Imported ${count} item(s) to My Space.`,
    }
}

export function initSpaceApp() {
    if (typeof document === 'undefined') return null
    const bootstrap = readBootstrapState()
    const state = {
        lang: bootstrap.lang === 'en-US' ? 'en-US' : 'zh-TW',
        pageTheme: bootstrap.pageTheme || 'claude-canvas',
        accountEnabled: bootstrap.accountEnabled !== false,
        authenticated: Boolean(bootstrap.authenticated),
        account: bootstrap.account || null,
        passkeys: Array.isArray(bootstrap.passkeys) ? bootstrap.passkeys : [],
        items: Array.isArray(bootstrap.items) ? bootstrap.items : [],
        pagination: bootstrap.pagination || { page: 1, pageSize: SPACE_PAGE_SIZE, total: 0, totalPages: 1 },
        circles: Array.isArray(bootstrap.circles) ? bootstrap.circles : [],
        annotations: [],
        facet: 'all',
        format: 'all',
        page: 1,
        turnstileToken: '',
        turnstileWidgetId: null,
        importCandidates: [],
    }

    const $ = id => document.getElementById(id)

    const setStatus = (message, kind = 'info') => {
        const box = $('space-auth-status')
        if (!box) return
        if (!message) {
            box.hidden = true
            box.textContent = ''
            return
        }
        box.className = `sp-alert ${kind === 'error' ? 'sp-alert-danger' : kind === 'success' ? 'sp-alert-success' : kind === 'warn' ? 'sp-alert-warn' : ''}`
        box.textContent = message
        box.hidden = false
    }

    // Apply WebView guidance
    const webviewBanner = $('webview-warning-banner')
    if (webviewBanner && isEmbeddedWebView()) {
        webviewBanner.hidden = false
    }
    $('webview-copy-url-btn')?.addEventListener('click', async () => {
        const ok = await copyCurrentUrlToClipboard()
        setStatus(ok ? (state.lang === 'zh-TW' ? '已複製網址，請在 Safari / Chrome 開啟。' : 'URL copied. Open it in Safari or Chrome.') : 'Copy failed', ok ? 'success' : 'error')
    })

    // Theme & language controls
    const previewSelect = $('space-preview-theme-select')
    try {
        const savedUi = localStorage.getItem('cf-notepad-ui-theme')
        if (savedUi === 'dark' || savedUi === 'light' || savedUi === 'auto') {
            document.documentElement.setAttribute('data-ui-theme', savedUi)
        }
        const savedSpaceTheme = localStorage.getItem('cf-notepad-space-theme')
        if (savedSpaceTheme && previewSelect) {
            previewSelect.value = savedSpaceTheme
            document.documentElement.setAttribute('data-preview-theme', savedSpaceTheme)
        }
    } catch {}

    previewSelect?.addEventListener('change', () => {
        const nextTheme = previewSelect.value
        document.documentElement.setAttribute('data-preview-theme', nextTheme)
        try { localStorage.setItem('cf-notepad-space-theme', nextTheme) } catch {}
    })

    $('space-ui-theme-btn')?.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-ui-theme') || 'auto'
        const next = cur === 'dark' ? 'light' : 'dark'
        document.documentElement.setAttribute('data-ui-theme', next)
        try { localStorage.setItem('cf-notepad-ui-theme', next) } catch {}
    })

    $('space-lang-btn')?.addEventListener('click', () => {
        const nextLang = state.lang === 'zh-TW' ? 'en-US' : 'zh-TW'
        const url = new URL(window.location.href)
        url.searchParams.set('lang', nextLang)
        window.location.href = url.toString()
    })

    // Turnstile mount for registration
    const mountTurnstile = () => {
        const container = $('space-turnstile-container')
        if (!container || !bootstrap.turnstileEnabled || !bootstrap.turnstileSiteKey) return
        const tryRender = () => {
            if (typeof window.turnstile?.render === 'function' && state.turnstileWidgetId === null) {
                state.turnstileWidgetId = window.turnstile.render(container, {
                    sitekey: bootstrap.turnstileSiteKey,
                    action: 'passkey_register',
                    callback: token => { state.turnstileToken = String(token || '') },
                    'expired-callback': () => { state.turnstileToken = '' },
                    'error-callback': () => { state.turnstileToken = '' },
                })
                return true
            }
            return false
        }
        if (!tryRender()) {
            const timer = setInterval(() => {
                if (tryRender()) clearInterval(timer)
            }, 250)
            setTimeout(() => clearInterval(timer), 10000)
        }
    }
    mountTurnstile()

    const renderAuthVisibility = () => {
        const authSec = $('space-auth-section')
        const workspace = $('space-workspace')
        const logoutBtn = $('space-logout-btn')
        const accountBadge = $('space-account-badge')
        if (authSec) authSec.hidden = state.authenticated
        if (workspace) workspace.hidden = !state.authenticated
        if (logoutBtn) logoutBtn.hidden = !state.authenticated
        if (accountBadge) {
            accountBadge.hidden = !state.authenticated
            accountBadge.textContent = state.account?.nickname || ''
        }
        const nicknameInput = $('account-nickname')
        if (nicknameInput && state.account?.nickname) {
            nicknameInput.value = state.account.nickname
        }
    }

    const renderSpaceItems = () => {
        const listEl = $('space-items-list')
        const paginationEl = $('space-pagination')
        const pageInfo = $('space-page-info')
        const prevBtn = $('space-prev-page')
        const nextBtn = $('space-next-page')
        if (!listEl) return
        const t = getSpaceLabels(state.lang)
        listEl.innerHTML = ''

        if (!state.items.length) {
            if (state.facet === 'all' && state.format === 'all') {
                const emptyBox = document.createElement('div')
                emptyBox.className = 'sp-item-card'
                emptyBox.style.flexDirection = 'column'
                emptyBox.style.alignItems = 'flex-start'

                const heading = document.createElement('h3')
                heading.className = 'sp-item-title'
                heading.textContent = t.emptyTitle

                const desc = document.createElement('p')
                desc.className = 'sp-muted'
                desc.style.margin = '0 0 8px'
                desc.textContent = t.emptyHint

                const btnRow = document.createElement('div')
                btnRow.className = 'sp-item-actions'

                const importBtn = document.createElement('button')
                importBtn.type = 'button'
                importBtn.className = 'sp-btn sp-btn-primary'
                importBtn.textContent = t.emptyImportBtn
                importBtn.addEventListener('click', () => openImportModal({ focusManual: false }))

                const pasteBtn = document.createElement('button')
                pasteBtn.type = 'button'
                pasteBtn.className = 'sp-btn'
                pasteBtn.textContent = t.emptyPasteBtn
                pasteBtn.addEventListener('click', () => openImportModal({ focusManual: true }))

                btnRow.append(importBtn, pasteBtn)

                if (readLocalDeviceDrafts().length > 0) {
                    const draftsBtn = document.createElement('button')
                    draftsBtn.type = 'button'
                    draftsBtn.className = 'sp-btn'
                    draftsBtn.textContent = t.emptyDraftsBtn
                    draftsBtn.addEventListener('click', () => switchSpaceTab('drafts'))
                    btnRow.appendChild(draftsBtn)
                }

                emptyBox.append(heading, desc, btnRow)
                listEl.appendChild(emptyBox)
            } else {
                const empty = document.createElement('p')
                empty.className = 'sp-muted'
                empty.textContent = t.emptyItems
                listEl.appendChild(empty)
            }
        } else {
            for (const item of state.items) {
                const card = document.createElement('article')
                card.className = `sp-item-card${item.masked ? ' is-masked' : ''}`

                const main = document.createElement('div')
                main.className = 'sp-item-main'

                const title = document.createElement('h3')
                title.className = 'sp-item-title'
                if (item.masked) {
                    title.textContent = item.title || t.maskedTitle
                } else {
                    title.textContent = item.titleSummary || item.title || item.notePath || item.shareId || 'Untitled'
                }

                const meta = document.createElement('div')
                meta.className = 'sp-item-meta'

                if (!item.masked) {
                    const fmtBadge = document.createElement('span')
                    fmtBadge.className = 'sp-badge'
                    fmtBadge.textContent = String(item.editorFormat || 'markdown')
                    meta.appendChild(fmtBadge)

                    const levelBadge = document.createElement('span')
                    levelBadge.className = `sp-badge ${item.accessLevel === 'edit' ? 'sp-badge-accent' : ''}`
                    levelBadge.textContent = item.accessLevel === 'edit' ? 'edit' : 'share_only'
                    meta.appendChild(levelBadge)

                    if (Array.isArray(item.facets)) {
                        for (const facet of item.facets) {
                            const fBadge = document.createElement('span')
                            fBadge.className = 'sp-badge'
                            fBadge.textContent = String(facet)
                            meta.appendChild(fBadge)
                        }
                    }

                    if (item.accessLevel === 'edit' && (item.isBurnProtected || item.protectionBadge === 'burn')) {
                        const warnBadge = document.createElement('span')
                        warnBadge.className = 'sp-badge sp-badge-danger'
                        warnBadge.textContent = t.burnWarning
                        meta.appendChild(warnBadge)
                    } else if (item.protectionBadge) {
                        const protBadge = document.createElement('span')
                        protBadge.className = 'sp-badge sp-badge-warn'
                        protBadge.textContent = String(item.protectionBadge)
                        meta.appendChild(protBadge)
                    }

                    if (item.lastActivityAt) {
                        const timeSpan = document.createElement('span')
                        timeSpan.textContent = formatDate(item.lastActivityAt)
                        meta.appendChild(timeSpan)
                    }
                }

                main.append(title, meta)

                const actions = document.createElement('div')
                actions.className = 'sp-item-actions'

                if (!item.masked && !item.stale) {
                    if (item.accessLevel === 'edit' && item.notePath) {
                        const editLink = document.createElement('a')
                        editLink.className = 'sp-btn sp-btn-sm sp-btn-primary'
                        editLink.href = `/${encodeURIComponent(item.notePath)}`
                        editLink.textContent = t.edit
                        actions.appendChild(editLink)
                    }
                    if (item.shareId) {
                        const shareLink = document.createElement('a')
                        shareLink.className = 'sp-btn sp-btn-sm'
                        shareLink.href = `/share/${encodeURIComponent(item.shareId)}`
                        shareLink.textContent = t.openShare
                        actions.appendChild(shareLink)
                    }
                    const circleBtn = document.createElement('button')
                    circleBtn.type = 'button'
                    circleBtn.className = 'sp-btn sp-btn-sm'
                    circleBtn.textContent = t.addToCircle
                    circleBtn.addEventListener('click', () => {
                        openCirclePicker({
                            lang: state.lang,
                            skipAutoBookmark: true,
                            spaceItem: item,
                            shareId: item.shareId || '',
                            notePath: item.accessLevel === 'edit' ? (item.notePath || '') : '',
                            noteUid: item.accessLevel === 'edit' ? (item.noteUid || '') : '',
                            editorFormat: item.editorFormat || 'markdown',
                            titleSummary: item.titleSummary || '',
                            triggerEl: circleBtn,
                            onAddedToCircles: () => loadCircles(),
                        })
                    })
                    actions.appendChild(circleBtn)
                }

                const removeBtn = document.createElement('button')
                removeBtn.type = 'button'
                removeBtn.className = 'sp-btn sp-btn-sm sp-btn-danger'
                removeBtn.textContent = t.remove
                removeBtn.addEventListener('click', async () => {
                    removeBtn.disabled = true
                    try {
                        await accountFetch(`/api/space/items/${encodeURIComponent(item.itemKey)}`, { method: 'DELETE' })
                        await loadSpaceItems()
                    } catch (err) {
                        setStatus(err?.message || 'Failed to remove item.', 'error')
                        removeBtn.disabled = false
                    }
                })
                actions.appendChild(removeBtn)

                card.append(main, actions)
                listEl.appendChild(card)
            }
        }

        if (paginationEl && pageInfo && prevBtn && nextBtn) {
            const totalPages = Math.max(1, Number(state.pagination?.totalPages || 1))
            const curPage = Math.max(1, Number(state.pagination?.page || state.page || 1))
            paginationEl.hidden = totalPages <= 1
            pageInfo.textContent = `${curPage} / ${totalPages}`
            prevBtn.disabled = curPage <= 1
            nextBtn.disabled = curPage >= totalPages
        }
    }

    const renderPasskeys = () => {
        const listEl = $('passkey-list')
        if (!listEl) return
        const t = getSpaceLabels(state.lang)
        listEl.innerHTML = ''
        const canRemove = state.passkeys.length > 1

        for (const pk of state.passkeys) {
            const card = document.createElement('div')
            card.className = 'sp-item-card'

            const main = document.createElement('div')
            main.className = 'sp-item-main'

            const title = document.createElement('div')
            title.className = 'sp-item-title'
            title.textContent = pk.deviceLabel || `Passkey (${String(pk.credentialId || '').slice(0, 10)}...)`

            const meta = document.createElement('div')
            meta.className = 'sp-item-meta'

            const syncBadge = document.createElement('span')
            syncBadge.className = `sp-badge ${pk.backupEligible ? 'sp-badge-success' : ''}`
            syncBadge.textContent = pk.backupEligible ? t.syncedPasskey : t.deviceBoundPasskey
            meta.appendChild(syncBadge)

            if (pk.createdAt) {
                const created = document.createElement('span')
                created.textContent = formatDate(pk.createdAt)
                meta.appendChild(created)
            }
            main.append(title, meta)

            const actions = document.createElement('div')
            actions.className = 'sp-item-actions'
            const removeBtn = document.createElement('button')
            removeBtn.type = 'button'
            removeBtn.className = 'sp-btn sp-btn-sm sp-btn-danger'
            removeBtn.textContent = t.remove
            removeBtn.disabled = !canRemove
            if (!canRemove) {
                removeBtn.title = t.minOnePasskey
            }
            removeBtn.addEventListener('click', async () => {
                if (!canRemove) return
                removeBtn.disabled = true
                try {
                    await removePasskeyWithStepUp(pk.credentialId)
                    setStatus(state.lang === 'zh-TW' ? '已移除 Passkey 並撤銷其他裝置工作階段。' : 'Passkey removed and other sessions revoked.', 'success')
                    await loadPasskeys()
                } catch (err) {
                    setStatus(err?.message || 'Failed to remove Passkey.', 'error')
                    removeBtn.disabled = false
                }
            })
            actions.appendChild(removeBtn)

            card.append(main, actions)
            listEl.appendChild(card)
        }
    }

    const renderAnnotations = () => {
        const listEl = $('space-annotations-list')
        if (!listEl) return
        const t = getSpaceLabels(state.lang)
        listEl.innerHTML = ''
        if (!state.annotations.length) {
            const empty = document.createElement('p')
            empty.className = 'sp-muted'
            empty.textContent = t.emptyAnnotations
            listEl.appendChild(empty)
            return
        }
        for (const ann of state.annotations) {
            const card = document.createElement('article')
            card.className = 'sp-item-card'

            const main = document.createElement('div')
            main.className = 'sp-item-main'

            const title = document.createElement('div')
            title.className = 'sp-item-title'
            title.textContent = ann.body || ann.quoteExact || '(Annotation)'

            const meta = document.createElement('div')
            meta.className = 'sp-item-meta'
            if (ann.authorName) {
                const author = document.createElement('span')
                author.className = 'sp-badge'
                author.textContent = ann.authorName
                meta.appendChild(author)
            }
            if (ann.createdAt) {
                const time = document.createElement('span')
                time.textContent = formatDate(ann.createdAt)
                meta.appendChild(time)
            }
            main.append(title, meta)

            const actions = document.createElement('div')
            actions.className = 'sp-item-actions'
            if (ann.shareId && ann.isAvailable !== false) {
                const link = document.createElement('a')
                link.className = 'sp-btn sp-btn-sm'
                link.href = `/share/${encodeURIComponent(ann.shareId)}`
                link.textContent = t.openShare
                actions.appendChild(link)
            }
            const delBtn = document.createElement('button')
            delBtn.type = 'button'
            delBtn.className = 'sp-btn sp-btn-sm sp-btn-danger'
            delBtn.textContent = t.remove
            delBtn.addEventListener('click', async () => {
                delBtn.disabled = true
                try {
                    await accountFetch(`/api/account/annotations/${encodeURIComponent(ann.messageId)}`, { method: 'DELETE' })
                    await loadAnnotations()
                } catch (err) {
                    setStatus(err?.message || 'Failed to delete annotation.', 'error')
                    delBtn.disabled = false
                }
            })
            actions.appendChild(delBtn)

            card.append(main, actions)
            listEl.appendChild(card)
        }
    }

    const publishAndSyncSingleDraft = async (draft, { silent = false } = {}) => {
        const t = getSpaceLabels(state.lang)
        const notePath = String(draft?.path || '').trim()
        if (!notePath) return { ok: false, reason: 'invalid' }
        const fullNote = await offlineStore.getNote(notePath).catch(() => null)
        const content = typeof fullNote?.content === 'string' ? fullNote.content : ''
        const format = draft?.format || fullNote?.format || 'markdown'
        const rawTheme = draft?.theme || fullNote?.theme || ''
        const validTheme = VALID_PUBLISH_THEMES.has(rawTheme) ? rawTheme : undefined

        if (notePath.startsWith('local/')) {
            const res = await fetch('/api/new-note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, editorFormat: format, share: true }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || data?.err !== 0 || !data?.data?.path) {
                if (!silent) setStatus(data?.msg || data?.error || 'Publish failed', 'error')
                return { ok: false, reason: 'failed' }
            }
            const nextPath = String(data.data.path)
            await offlineStore.deleteNote(notePath).catch(() => {})
            await offlineStore.saveNote(nextPath, {
                title: draft?.title || nextPath,
                content,
                theme: validTheme || 'claude-canvas',
                format,
                syncStatus: 'synced',
            }).catch(() => {})
            if (!silent) setStatus(t.draftPublishSuccess, 'success')
            return { ok: true, path: nextPath }
        }

        const res = await fetch(`/${encodeURIComponent(notePath)}/setting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                share: true,
                content,
                ...(validTheme ? { theme: validTheme } : {}),
            }),
        })
        const data = await res.json().catch(() => ({}))
        if (data?.needTurnstile) {
            if (!silent) setStatus(t.draftPublishTurnstile, 'warn')
            return { ok: false, reason: 'turnstile' }
        }
        if (data?.err === 10002 || res.status === 401 || res.status === 403) {
            if (!silent) setStatus(t.draftPublishAuthErr, 'warn')
            return { ok: false, reason: 'auth' }
        }
        if (!res.ok || data?.err !== 0) {
            if (!silent) setStatus(data?.msg || data?.error || 'Publish failed', 'error')
            return { ok: false, reason: 'failed' }
        }
        await offlineStore.updateSyncStatus(notePath, 'synced').catch(() => {})
        if (!silent) setStatus(t.draftPublishSuccess, 'success')
        return { ok: true, path: notePath }
    }

    const renderLocalDrafts = () => {
        const listEl = $('space-local-drafts-list')
        const syncPublishedBtn = $('drafts-sync-published-btn')
        const publishAllBtn = $('drafts-publish-all-btn')
        if (!listEl) return
        const t = getSpaceLabels(state.lang)
        const drafts = readLocalDeviceDrafts()
        const unpublishedDrafts = drafts.filter(d => d?.syncStatus === 'draft')
        const cachedPublished = drafts.filter(d => d?.syncStatus !== 'draft' && d?.path && !String(d.path).startsWith('local/'))

        if (syncPublishedBtn) {
            syncPublishedBtn.hidden = cachedPublished.length === 0
        }
        if (publishAllBtn) {
            publishAllBtn.hidden = unpublishedDrafts.length === 0
        }

        listEl.innerHTML = ''
        if (!drafts.length) {
            const empty = document.createElement('p')
            empty.className = 'sp-muted'
            empty.textContent = t.emptyDrafts
            listEl.appendChild(empty)
            return
        }
        for (const draft of drafts) {
            const isUnpublished = draft.syncStatus === 'draft'
            const card = document.createElement('article')
            card.className = 'sp-item-card'

            const main = document.createElement('div')
            main.className = 'sp-item-main'

            const title = document.createElement('div')
            title.className = 'sp-item-title'
            title.textContent = draft.title || draft.path || 'Local Draft'

            const meta = document.createElement('div')
            meta.className = 'sp-item-meta'

            const localBadge = document.createElement('span')
            localBadge.className = `sp-badge ${isUnpublished ? 'sp-badge-warn' : ''}`
            localBadge.textContent = isUnpublished ? t.localOnlyBadge : t.localCachedBadge
            meta.appendChild(localBadge)

            if (draft.format) {
                const fmt = document.createElement('span')
                fmt.className = 'sp-badge'
                fmt.textContent = String(draft.format)
                meta.appendChild(fmt)
            }
            if (draft.updatedAt) {
                const time = document.createElement('span')
                time.textContent = formatDate(draft.updatedAt)
                meta.appendChild(time)
            }
            main.append(title, meta)

            const actions = document.createElement('div')
            actions.className = 'sp-item-actions'

            if (draft.path && !String(draft.path).startsWith('local/')) {
                const openLink = document.createElement('a')
                openLink.className = 'sp-btn sp-btn-sm'
                openLink.href = `/${encodeURIComponent(draft.path)}`
                openLink.textContent = t.edit
                actions.appendChild(openLink)
            }

            if (isUnpublished) {
                const pubBtn = document.createElement('button')
                pubBtn.type = 'button'
                pubBtn.className = 'sp-btn sp-btn-sm sp-btn-primary'
                pubBtn.textContent = t.publishAndSync
                pubBtn.addEventListener('click', async () => {
                    pubBtn.disabled = true
                    pubBtn.textContent = t.publishing
                    try {
                        const res = await publishAndSyncSingleDraft(draft)
                        if (res.ok) {
                            renderLocalDrafts()
                            await loadSpaceItems()
                        } else {
                            pubBtn.disabled = false
                            pubBtn.textContent = t.publishAndSync
                        }
                    } catch (err) {
                        setStatus(err?.message || 'Publish failed.', 'error')
                        pubBtn.disabled = false
                        pubBtn.textContent = t.publishAndSync
                    }
                })
                actions.appendChild(pubBtn)
            } else if (draft.path && !String(draft.path).startsWith('local/')) {
                const syncBtn = document.createElement('button')
                syncBtn.type = 'button'
                syncBtn.className = 'sp-btn sp-btn-sm sp-btn-primary'
                syncBtn.textContent = t.syncToSpace
                syncBtn.addEventListener('click', async () => {
                    syncBtn.disabled = true
                    syncBtn.textContent = t.syncing
                    try {
                        const res = await accountFetch('/api/space/import', {
                            method: 'POST',
                            body: { items: [{ path: draft.path, source: 'created', savedAt: draft.updatedAt || 0 }] },
                        })
                        if (Number(res?.importedCount || 0) > 0) {
                            setStatus(t.importSuccess(res.importedCount), 'success')
                            await loadSpaceItems()
                        } else {
                            setStatus(t.draftSyncNone, 'warn')
                        }
                    } catch (err) {
                        setStatus(err?.message || 'Sync failed.', 'error')
                    } finally {
                        syncBtn.disabled = false
                        syncBtn.textContent = t.syncToSpace
                    }
                })
                actions.appendChild(syncBtn)
            }

            card.append(main, actions)
            listEl.appendChild(card)
        }
    }

    const renderCircles = () => {
        const listEl = $('space-circles-list')
        const quotaEl = $('space-circles-quota')
        if (!listEl) return
        const t = getSpaceLabels(state.lang)
        if (quotaEl) {
            quotaEl.textContent = `${state.circles.length} / 20`
        }
        listEl.innerHTML = ''
        if (!state.circles.length) {
            const empty = document.createElement('p')
            empty.className = 'sp-muted'
            empty.textContent = t.emptyCircles
            listEl.appendChild(empty)
            return
        }

        for (const circle of state.circles) {
            const card = document.createElement('article')
            card.className = 'sp-item-card'

            const main = document.createElement('div')
            main.className = 'sp-item-main'

            const title = document.createElement('h3')
            title.className = 'sp-item-title'
            title.textContent = circle.name || 'Untitled Circle'

            const meta = document.createElement('div')
            meta.className = 'sp-item-meta'

            const stateBadge = document.createElement('span')
            stateBadge.className = `sp-badge ${circle.isEnabled ? 'sp-badge-success' : ''}`
            stateBadge.textContent = circle.isEnabled ? t.circleOn : t.circleOff
            meta.appendChild(stateBadge)

            const countBadge = document.createElement('span')
            countBadge.className = 'sp-badge'
            countBadge.textContent = `${Number(circle.itemCount || 0)} / 200`
            meta.appendChild(countBadge)

            const circlePath = `/c/${encodeURIComponent(circle.publicToken || '')}`
            if (circle.publicToken) {
                const urlLink = document.createElement('a')
                urlLink.href = circlePath
                urlLink.textContent = circlePath
                meta.appendChild(urlLink)
            }

            main.append(title, meta)

            const actions = document.createElement('div')
            actions.className = 'sp-item-actions'

            const toggleBtn = document.createElement('button')
            toggleBtn.type = 'button'
            toggleBtn.className = `sp-btn sp-btn-sm ${circle.isEnabled ? 'sp-btn-primary' : ''}`
            toggleBtn.textContent = circle.isEnabled ? 'ON' : 'OFF'
            toggleBtn.addEventListener('click', async () => {
                toggleBtn.disabled = true
                try {
                    await accountFetch(`/api/circles/${encodeURIComponent(circle.id)}`, {
                        method: 'PATCH',
                        body: { isEnabled: !circle.isEnabled },
                    })
                    await loadCircles()
                } catch (err) {
                    setStatus(err?.message || 'Failed to toggle circle.', 'error')
                    toggleBtn.disabled = false
                }
            })

            const copyBtn = document.createElement('button')
            copyBtn.type = 'button'
            copyBtn.className = 'sp-btn sp-btn-sm'
            copyBtn.textContent = t.copyLink
            copyBtn.addEventListener('click', async () => {
                const fullUrl = `${window.location.origin}${circlePath}`
                const ok = await copyCurrentUrlToClipboard(fullUrl)
                if (ok) {
                    copyBtn.textContent = t.copied
                    setTimeout(() => { copyBtn.textContent = t.copyLink }, 1200)
                }
            })

            const rotateBtn = document.createElement('button')
            rotateBtn.type = 'button'
            rotateBtn.className = 'sp-btn sp-btn-sm'
            rotateBtn.textContent = t.rotateLink
            rotateBtn.addEventListener('click', async () => {
                rotateBtn.disabled = true
                try {
                    await accountFetch(`/api/circles/${encodeURIComponent(circle.id)}/rotate`, { method: 'POST', body: {} })
                    await loadCircles()
                } catch (err) {
                    setStatus(err?.message || 'Failed to rotate circle link.', 'error')
                    rotateBtn.disabled = false
                }
            })

            const drawer = document.createElement('div')
            drawer.className = 'sp-circle-items-drawer'
            drawer.hidden = true

            const manageBtn = document.createElement('button')
            manageBtn.type = 'button'
            manageBtn.className = 'sp-btn sp-btn-sm'
            manageBtn.textContent = t.manageItems
            manageBtn.addEventListener('click', async () => {
                if (!drawer.hidden) {
                    drawer.hidden = true
                    return
                }
                drawer.hidden = false
                drawer.textContent = state.lang === 'zh-TW' ? '載入中...' : 'Loading...'
                try {
                    const detail = await accountFetch(`/api/circles/${encodeURIComponent(circle.id)}`, { method: 'GET' })
                    const items = Array.isArray(detail?.items) ? detail.items : []
                    drawer.innerHTML = ''
                    if (!items.length) {
                        const empty = document.createElement('p')
                        empty.className = 'sp-muted'
                        empty.textContent = state.lang === 'zh-TW' ? '此分享圈目前沒有項目。' : 'No items in this circle yet.'
                        drawer.appendChild(empty)
                        return
                    }
                    for (const ci of items) {
                        const row = document.createElement('div')
                        row.style.display = 'flex'
                        row.style.justifyContent = 'space-between'
                        row.style.alignItems = 'center'
                        row.style.gap = '8px'
                        row.style.padding = '6px 0'

                        const label = document.createElement('span')
                        if (ci.available === false || ci.masked) {
                            label.textContent = ci.reasonBadge || t.circleHiddenItem
                            label.className = 'sp-muted'
                        } else {
                            label.textContent = ci.titleSummary || ci.title || ci.shareId || 'Item'
                        }

                        const rmBtn = document.createElement('button')
                        rmBtn.type = 'button'
                        rmBtn.className = 'sp-btn sp-btn-sm sp-btn-danger'
                        rmBtn.textContent = t.remove
                        rmBtn.addEventListener('click', async () => {
                            rmBtn.disabled = true
                            const targetKey = ci.itemKey || ci.spaceItemId || ci.id
                            await accountFetch(`/api/circles/${encodeURIComponent(circle.id)}/items/${encodeURIComponent(targetKey)}`, { method: 'DELETE' })
                            await loadCircles()
                        })
                        row.append(label, rmBtn)
                        drawer.appendChild(row)
                    }
                } catch (err) {
                    drawer.textContent = err?.message || 'Failed to load circle items.'
                }
            })

            const delBtn = document.createElement('button')
            delBtn.type = 'button'
            delBtn.className = 'sp-btn sp-btn-sm sp-btn-danger'
            delBtn.textContent = t.deleteCircle
            delBtn.addEventListener('click', async () => {
                delBtn.disabled = true
                try {
                    await accountFetch(`/api/circles/${encodeURIComponent(circle.id)}`, { method: 'DELETE' })
                    await loadCircles()
                } catch (err) {
                    setStatus(err?.message || 'Failed to delete circle.', 'error')
                    delBtn.disabled = false
                }
            })

            actions.append(toggleBtn, copyBtn, rotateBtn, manageBtn, delBtn)
            card.append(main, actions, drawer)
            listEl.appendChild(card)
        }
    }

    async function loadSpaceItems() {
        if (!state.authenticated) return
        const params = new URLSearchParams()
        if (state.facet && state.facet !== 'all') params.set('facet', state.facet)
        if (state.format && state.format !== 'all') params.set('format', state.format)
        params.set('page', String(state.page))
        params.set('pageSize', String(SPACE_PAGE_SIZE))
        const res = await accountFetch(`/api/space/items?${params.toString()}`, { method: 'GET' })
        state.items = Array.isArray(res?.items) ? res.items : []
        state.pagination = res?.pagination || { page: state.page, pageSize: SPACE_PAGE_SIZE, total: state.items.length, totalPages: 1 }
        renderSpaceItems()
    }

    async function loadPasskeys() {
        if (!state.authenticated) return
        const res = await listPasskeys()
        state.passkeys = Array.isArray(res?.passkeys) ? res.passkeys : (Array.isArray(res) ? res : [])
        renderPasskeys()
    }

    async function loadAnnotations() {
        if (!state.authenticated) return
        try {
            const res = await accountFetch('/api/account/annotations', { method: 'GET' })
            state.annotations = Array.isArray(res?.annotations) ? res.annotations : (Array.isArray(res) ? res : [])
        } catch {
            state.annotations = []
        }
        renderAnnotations()
    }

    async function loadCircles() {
        if (!state.authenticated) return
        const res = await accountFetch('/api/circles', { method: 'GET' })
        state.circles = Array.isArray(res?.circles) ? res.circles : (Array.isArray(res) ? res : [])
        renderCircles()
    }

    const switchSpaceTab = target => {
        if (!target) return
        document.querySelectorAll('[data-space-tab]').forEach(other => {
            const active = other.getAttribute('data-space-tab') === target
            other.classList.toggle('is-active', active)
            other.setAttribute('aria-selected', active ? 'true' : 'false')
        })
        document.querySelectorAll('[data-space-panel]').forEach(panel => {
            panel.hidden = panel.getAttribute('data-space-panel') !== target
        })
        if (target === 'drafts') renderLocalDrafts()
    }

    async function hydrateAuthenticatedWorkspace({ fromAuthAction = false } = {}) {
        const me = await accountFetch('/api/account/me', { method: 'GET' })
        if (!me?.authenticated) {
            state.authenticated = false
            state.account = null
            renderAuthVisibility()
            return
        }
        state.authenticated = true
        state.account = me.account || null
        renderAuthVisibility()
        renderLocalDrafts()
        await Promise.all([loadSpaceItems(), loadPasskeys(), loadAnnotations(), loadCircles()])
        maybeAutoPromptLocalImport({ forceCheck: fromAuthAction }).catch(() => {})
    }

    // Tabs
    document.querySelectorAll('[data-space-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            switchSpaceTab(btn.getAttribute('data-space-tab'))
        })
    })

    // Facet & Format filters
    document.querySelectorAll('#space-facet-filters [data-facet]').forEach(btn => {
        btn.addEventListener('click', () => {
            const facet = btn.getAttribute('data-facet') || 'all'
            if (!VALID_FACETS.has(facet)) return
            state.facet = facet
            state.page = 1
            document.querySelectorAll('#space-facet-filters [data-facet]').forEach(b => b.classList.toggle('is-active', b === btn))
            loadSpaceItems().catch(err => setStatus(err?.message || 'Filter failed', 'error'))
        })
    })
    document.querySelectorAll('#space-format-filters [data-format]').forEach(btn => {
        btn.addEventListener('click', () => {
            const fmt = btn.getAttribute('data-format') || 'all'
            if (!VALID_FORMATS.has(fmt)) return
            state.format = fmt
            state.page = 1
            document.querySelectorAll('#space-format-filters [data-format]').forEach(b => b.classList.toggle('is-active', b === btn))
            loadSpaceItems().catch(err => setStatus(err?.message || 'Filter failed', 'error'))
        })
    })

    $('space-prev-page')?.addEventListener('click', () => {
        if (state.page > 1) {
            state.page -= 1
            loadSpaceItems().catch(() => {})
        }
    })
    $('space-next-page')?.addEventListener('click', () => {
        const totalPages = Number(state.pagination?.totalPages || 1)
        if (state.page < totalPages) {
            state.page += 1
            loadSpaceItems().catch(() => {})
        }
    })

    // Auth forms
    $('passkey-login-btn')?.addEventListener('click', async () => {
        setStatus('')
        try {
            await loginWithPasskey()
            await hydrateAuthenticatedWorkspace({ fromAuthAction: true })
        } catch (err) {
            setStatus(err?.message || 'Passkey sign-in failed.', 'error')
        }
    })

    $('passkey-register-form')?.addEventListener('submit', async event => {
        event.preventDefault()
        setStatus('')
        const nickname = $('register-nickname')?.value || ''
        const deviceLabel = $('register-device-label')?.value || ''
        try {
            await registerPasskey({
                nickname,
                deviceLabel,
                turnstileToken: state.turnstileToken,
            })
            await hydrateAuthenticatedWorkspace({ fromAuthAction: true })
        } catch (err) {
            setStatus(err?.message || 'Passkey registration failed.', 'error')
            if (state.turnstileWidgetId !== null && typeof window.turnstile?.reset === 'function') {
                window.turnstile.reset(state.turnstileWidgetId)
                state.turnstileToken = ''
            }
        }
    })

    $('space-logout-btn')?.addEventListener('click', async () => {
        try {
            await logoutAccount()
        } catch {}
        state.authenticated = false
        state.account = null
        state.items = []
        state.passkeys = []
        state.circles = []
        state.annotations = []
        renderAuthVisibility()
    })

    $('nickname-form')?.addEventListener('submit', async event => {
        event.preventDefault()
        const nickname = $('account-nickname')?.value || ''
        try {
            const res = await updateNickname(nickname)
            state.account = res?.account || { ...(state.account || {}), nickname: nickname.trim() }
            renderAuthVisibility()
            setStatus(state.lang === 'zh-TW' ? '暱稱已更新（僅套用於未來新批註）。' : 'Nickname updated for future annotations.', 'success')
        } catch (err) {
            setStatus(err?.message || 'Failed to update nickname.', 'error')
        }
    })

    $('add-passkey-form')?.addEventListener('submit', async event => {
        event.preventDefault()
        const deviceLabel = $('add-passkey-label')?.value || ''
        try {
            await addPasskeyWithStepUp({ deviceLabel })
            if ($('add-passkey-label')) $('add-passkey-label').value = ''
            setStatus(state.lang === 'zh-TW' ? '已新增 Passkey 裝置！' : 'New Passkey added.', 'success')
            await loadPasskeys()
        } catch (err) {
            setStatus(err?.message || 'Failed to add Passkey.', 'error')
        }
    })

    $('create-circle-form')?.addEventListener('submit', async event => {
        event.preventDefault()
        const nameInput = $('create-circle-name')
        const enabledInput = $('create-circle-enabled')
        const name = nameInput?.value?.trim() || ''
        if (!name) return
        try {
            await accountFetch('/api/circles', {
                method: 'POST',
                body: { name, isEnabled: Boolean(enabledInput?.checked) },
            })
            if (nameInput) nameInput.value = ''
            if (enabledInput) enabledInput.checked = false
            await loadCircles()
        } catch (err) {
            setStatus(err?.message || 'Failed to create circle.', 'error')
        }
    })

    // Guest History & Local Notes Confirmation Import Modal
    const importModal = $('guest-import-modal')
    const closeImportModal = () => {
        if (!importModal) return
        importModal.hidden = true
        importModal.setAttribute('aria-hidden', 'true')
    }

    const getImportCandidateKey = entry => {
        if (entry?.path) return `path:${entry.path}`
        if (entry?.shareId) return `share:${entry.shareId}`
        return `url:${entry?.url || ''}`
    }

    const renderImportPreviewItems = (previewItems, { append = false } = {}) => {
        const t = getSpaceLabels(state.lang)
        const listEl = $('guest-import-preview-list')
        const statusEl = $('guest-import-status')
        const confirmBtn = $('guest-import-confirm')
        if (!listEl) return

        const merged = append ? [...state.importCandidates] : []
        const seenKeys = new Set(merged.map(getImportCandidateKey))
        for (const item of previewItems) {
            const key = getImportCandidateKey(item)
            if (seenKeys.has(key)) {
                const idx = merged.findIndex(existing => getImportCandidateKey(existing) === key)
                if (idx >= 0) merged[idx] = item
            } else {
                seenKeys.add(key)
                merged.unshift(item)
            }
        }
        state.importCandidates = merged.slice(0, MAX_IMPORT_CANDIDATES)

        if (statusEl) statusEl.hidden = true
        listEl.innerHTML = ''

        let hasEligible = false
        for (const entry of state.importCandidates) {
            const key = getImportCandidateKey(entry)
            const row = document.createElement('label')
            row.className = 'sp-item-card'
            row.style.cursor = entry.eligible ? 'pointer' : 'default'

            const left = document.createElement('div')
            left.className = 'sp-item-main'

            const header = document.createElement('div')
            header.style.display = 'flex'
            header.style.alignItems = 'center'
            header.style.gap = '8px'

            const checkbox = document.createElement('input')
            checkbox.type = 'checkbox'
            checkbox.value = key
            checkbox.checked = Boolean(entry.eligible && !entry.alreadyIndexed)
            checkbox.disabled = !entry.eligible
            checkbox.dataset.importCandidateKey = key
            if (entry.shareId) checkbox.dataset.importShareId = entry.shareId
            if (entry.eligible) hasEligible = true

            const title = document.createElement('span')
            title.className = 'sp-item-title'
            title.style.margin = '0'
            title.textContent = entry.titleSummary || entry.title || entry.path || entry.shareId
            header.append(checkbox, title)

            const meta = document.createElement('div')
            meta.className = 'sp-item-meta'
            const srcBadge = document.createElement('span')
            srcBadge.className = 'sp-badge'
            srcBadge.textContent = entry.path
                ? t.importSourceEditPath
                : (entry.source === 'created' ? t.importSourceCreated : t.importSourceViewed)

            const statusBadge = document.createElement('span')
            statusBadge.className = `sp-badge ${entry.eligible ? 'sp-badge-success' : ''}`
            if (entry.alreadyIndexed) {
                statusBadge.textContent = t.importAlready
            } else if (entry.eligible) {
                statusBadge.textContent = entry.accessLevel === 'edit' ? t.importEligibleEdit : t.importEligible
            } else if (entry.status === 'unpublished') {
                statusBadge.textContent = t.importUnpublished
            } else {
                statusBadge.textContent = t.importUnavailable
            }
            meta.append(srcBadge, statusBadge)

            left.append(header, meta)
            row.appendChild(left)
            listEl.appendChild(row)
        }
        if (confirmBtn) confirmBtn.disabled = !hasEligible
    }

    const openImportModal = async ({ focusManual = false, preloadedPreview = null, customCandidates = null } = {}) => {
        if (!importModal) return
        const t = getSpaceLabels(state.lang)
        const listEl = $('guest-import-preview-list')
        const statusEl = $('guest-import-status')
        const confirmBtn = $('guest-import-confirm')
        const manualInput = $('manual-import-input')
        importModal.hidden = false
        importModal.setAttribute('aria-hidden', 'false')
        if (listEl) listEl.innerHTML = ''
        if (confirmBtn) confirmBtn.disabled = true
        if (focusManual && manualInput) {
            setTimeout(() => manualInput.focus(), 20)
        }

        if (Array.isArray(preloadedPreview)) {
            renderImportPreviewItems(preloadedPreview, { append: false })
            return
        }

        const localCandidates = Array.isArray(customCandidates) ? customCandidates : collectLocalSpaceImportCandidates()
        if (!localCandidates.length) {
            state.importCandidates = []
            if (statusEl) {
                statusEl.className = 'sp-alert'
                statusEl.textContent = t.importNoneFound
                statusEl.hidden = false
            }
            return
        }

        if (statusEl) {
            statusEl.className = 'sp-alert'
            statusEl.textContent = t.importChecking
            statusEl.hidden = false
        }

        try {
            const previewRes = await accountFetch('/api/space/import/preview', {
                method: 'POST',
                body: { items: localCandidates },
            })
            const previewItems = Array.isArray(previewRes?.items) ? previewRes.items : []
            renderImportPreviewItems(previewItems, { append: false })
        } catch (err) {
            if (statusEl) {
                statusEl.className = 'sp-alert sp-alert-danger'
                statusEl.textContent = err?.message || 'Failed to preview guest history.'
                statusEl.hidden = false
            }
        }
    }

    async function maybeAutoPromptLocalImport({ forceCheck = false } = {}) {
        if (!state.authenticated) return
        if (!forceCheck) {
            try {
                if (localStorage.getItem(SPACE_IMPORT_PROMPTED_KEY) === '1') return
            } catch {}
            if (state.items.length > 0) return
        }
        const localCandidates = collectLocalSpaceImportCandidates()
        if (!localCandidates.length) return
        try {
            const previewRes = await accountFetch('/api/space/import/preview', {
                method: 'POST',
                body: { items: localCandidates },
            })
            try { localStorage.setItem(SPACE_IMPORT_PROMPTED_KEY, '1') } catch {}
            const previewItems = Array.isArray(previewRes?.items) ? previewRes.items : []
            const hasImportable = previewItems.some(item => item.eligible && !item.alreadyIndexed)
            if (hasImportable) {
                await openImportModal({ preloadedPreview: previewItems })
            }
        } catch {}
    }

    $('open-guest-import-btn')?.addEventListener('click', () => {
        openImportModal({ focusManual: false }).catch(() => {})
    })

    $('manual-import-add-btn')?.addEventListener('click', async () => {
        const t = getSpaceLabels(state.lang)
        const manualInput = $('manual-import-input')
        const statusEl = $('guest-import-status')
        const parsed = parseManualImportInputs(manualInput?.value || '')
        if (!parsed.length) {
            if (statusEl) {
                statusEl.className = 'sp-alert sp-alert-warn'
                statusEl.textContent = t.importManualEmpty
                statusEl.hidden = false
            }
            return
        }
        const addBtn = $('manual-import-add-btn')
        if (addBtn) addBtn.disabled = true
        if (statusEl) {
            statusEl.className = 'sp-alert'
            statusEl.textContent = t.importChecking
            statusEl.hidden = false
        }
        try {
            const previewRes = await accountFetch('/api/space/import/preview', {
                method: 'POST',
                body: { items: parsed },
            })
            const previewItems = Array.isArray(previewRes?.items) ? previewRes.items : []
            renderImportPreviewItems(previewItems, { append: true })
            if (manualInput) manualInput.value = ''
        } catch (err) {
            if (statusEl) {
                statusEl.className = 'sp-alert sp-alert-danger'
                statusEl.textContent = err?.message || 'Failed to check URLs.'
                statusEl.hidden = false
            }
        } finally {
            if (addBtn) addBtn.disabled = false
        }
    })

    $('drafts-sync-published-btn')?.addEventListener('click', () => {
        const drafts = readLocalDeviceDrafts()
            .filter(d => d?.syncStatus !== 'draft' && d?.path && !String(d.path).startsWith('local/'))
            .slice(0, MAX_IMPORT_CANDIDATES)
            .map(d => ({
                path: d.path,
                url: `${window.location.origin}/${encodeURIComponent(d.path)}`,
                source: 'created',
                title: d.title || d.path,
                savedAt: Number(d.updatedAt || 0),
            }))
        openImportModal({ customCandidates: drafts }).catch(() => {})
    })

    $('drafts-publish-all-btn')?.addEventListener('click', async () => {
        const t = getSpaceLabels(state.lang)
        const btn = $('drafts-publish-all-btn')
        const unpublished = readLocalDeviceDrafts().filter(d => d?.syncStatus === 'draft')
        if (!unpublished.length) return
        if (btn) {
            btn.disabled = true
            btn.textContent = t.publishing
        }
        let publishedCount = 0
        let blocked = false
        for (const draft of unpublished) {
            const res = await publishAndSyncSingleDraft(draft, { silent: false }).catch(() => ({ ok: false }))
            if (res.ok) {
                publishedCount += 1
            } else {
                blocked = true
                if (res.reason === 'turnstile') break
            }
        }
        renderLocalDrafts()
        if (publishedCount > 0) {
            await loadSpaceItems().catch(() => {})
            if (!blocked) setStatus(t.importSuccess(publishedCount), 'success')
        }
        if (btn) {
            btn.disabled = false
            btn.textContent = state.lang === 'zh-TW' ? '一鍵發布並同步全部草稿' : 'Publish & Sync All Drafts'
        }
    })

    $('guest-import-close')?.addEventListener('click', closeImportModal)
    $('guest-import-cancel')?.addEventListener('click', closeImportModal)
    $('guest-import-select-all')?.addEventListener('click', () => {
        document.querySelectorAll('#guest-import-preview-list input[type="checkbox"]:not(:disabled)').forEach(cb => {
            cb.checked = true
        })
    })

    $('guest-import-confirm')?.addEventListener('click', async () => {
        const t = getSpaceLabels(state.lang)
        const selectedKeys = new Set(
            Array.from(document.querySelectorAll('#guest-import-preview-list input[type="checkbox"]:checked'))
                .map(cb => cb.value),
        )
        const selectedItems = state.importCandidates
            .filter(item => selectedKeys.has(getImportCandidateKey(item)))
            .slice(0, MAX_IMPORT_CANDIDATES)
        if (!selectedItems.length) return
        const btn = $('guest-import-confirm')
        if (btn) btn.disabled = true
        try {
            const res = await accountFetch('/api/space/import', {
                method: 'POST',
                body: { items: selectedItems },
            })
            const importedCount = Number(res?.importedCount ?? selectedItems.length)
            try { localStorage.setItem(SPACE_IMPORT_PROMPTED_KEY, '1') } catch {}
            closeImportModal()
            setStatus(t.importSuccess(importedCount), 'success')
            await loadSpaceItems()
        } catch (err) {
            const statusEl = $('guest-import-status')
            if (statusEl) {
                statusEl.className = 'sp-alert sp-alert-danger'
                statusEl.textContent = err?.message || 'Import failed.'
                statusEl.hidden = false
            }
            if (btn) btn.disabled = false
        }
    })

    // Initial render
    renderAuthVisibility()
    if (state.authenticated) {
        renderSpaceItems()
        renderPasskeys()
        renderCircles()
        renderLocalDrafts()
        loadAnnotations().catch(() => {})
        maybeAutoPromptLocalImport({ forceCheck: false }).catch(() => {})
    }

    return { state, loadSpaceItems, loadCircles, loadPasskeys, loadAnnotations, openImportModal }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initSpaceApp())
    } else {
        initSpaceApp()
    }
}
