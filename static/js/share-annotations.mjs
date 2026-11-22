import { loginWithPasskey } from './account-auth.mjs'

const MAX_QUOTE_LENGTH = 1000
const CONTEXT_LENGTH = 160
const AUTHOR_STORAGE_KEY = 'cf-notepad:annotation-author'
const RAIL_POSITION_STORAGE_PREFIX = 'cf-notepad:annotation-rail-position:'
const RAIL_VIEWPORT_PADDING = 8

const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum))

const getRailDimensions = rail => {
    const rect = rail.getBoundingClientRect()
    return {
        width: rect.width || rail.offsetWidth || 42,
        height: rect.height || rail.offsetHeight || 42,
    }
}

const getViewportDimensions = windowRef => ({
    width: windowRef.innerWidth || windowRef.document?.documentElement?.clientWidth || 0,
    height: windowRef.innerHeight || windowRef.document?.documentElement?.clientHeight || 0,
})

const applyRailPosition = (rail, left, top) => {
    rail.style.left = `${Math.round(left)}px`
    rail.style.top = `${Math.round(top)}px`
    rail.style.right = 'auto'
    rail.style.bottom = 'auto'
    rail.style.transform = 'none'
}

const readRailPosition = (storageKey, windowRef) => {
    try {
        const value = JSON.parse(windowRef.localStorage.getItem(storageKey) || 'null')
        if (
            Number.isFinite(value?.leftRatio)
            && Number.isFinite(value?.topRatio)
            && value.leftRatio >= 0 && value.leftRatio <= 1
            && value.topRatio >= 0 && value.topRatio <= 1
        ) return value
    } catch {}
    return null
}

const saveRailPosition = (storageKey, left, top, rail, windowRef) => {
    const viewport = getViewportDimensions(windowRef)
    const dimensions = getRailDimensions(rail)
    const maxLeft = Math.max(0, viewport.width - dimensions.width)
    const maxTop = Math.max(0, viewport.height - dimensions.height)
    try {
        windowRef.localStorage.setItem(storageKey, JSON.stringify({
            leftRatio: maxLeft ? left / maxLeft : 0,
            topRatio: maxTop ? top / maxTop : 0,
        }))
    } catch {}
}

export function setupAnnotationRailDragging(rail, {
    storageKey,
    windowRef = window,
} = {}) {
    if (!rail || !storageKey || !windowRef) return () => {}

    const savedPosition = readRailPosition(storageKey, windowRef)
    if (savedPosition) {
        const viewport = getViewportDimensions(windowRef)
        const dimensions = getRailDimensions(rail)
        applyRailPosition(
            rail,
            savedPosition.leftRatio * Math.max(0, viewport.width - dimensions.width),
            savedPosition.topRatio * Math.max(0, viewport.height - dimensions.height),
        )
    }

    let activePointer = null
    let suppressNextClick = false

    const move = event => {
        if (!activePointer || event.pointerId !== activePointer.id) return
        const viewport = getViewportDimensions(windowRef)
        const dimensions = getRailDimensions(rail)
        const left = clamp(
            event.clientX - activePointer.offsetX,
            RAIL_VIEWPORT_PADDING,
            viewport.width - dimensions.width - RAIL_VIEWPORT_PADDING,
        )
        const top = clamp(
            event.clientY - activePointer.offsetY,
            RAIL_VIEWPORT_PADDING,
            viewport.height - dimensions.height - RAIL_VIEWPORT_PADDING,
        )
        if (Math.abs(left - activePointer.initialLeft) > 4 || Math.abs(top - activePointer.initialTop) > 4) {
            activePointer.moved = true
        }
        applyRailPosition(rail, left, top)
    }

    const stop = event => {
        if (!activePointer || event.pointerId !== activePointer.id) return
        const { moved } = activePointer
        activePointer = null
        rail.classList.remove('is-dragging')
        rail.releasePointerCapture?.(event.pointerId)
        if (!moved) return

        const left = Number.parseFloat(rail.style.left) || 0
        const top = Number.parseFloat(rail.style.top) || 0
        saveRailPosition(storageKey, left, top, rail, windowRef)
        suppressNextClick = true
    }

    const start = event => {
        if (event.button !== 0) return
        const rect = rail.getBoundingClientRect()
        activePointer = {
            id: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            initialLeft: rect.left,
            initialTop: rect.top,
            moved: false,
        }
        rail.setPointerCapture?.(event.pointerId)
        rail.classList.add('is-dragging')
    }

    const blockDraggedClick = event => {
        if (!suppressNextClick) return
        suppressNextClick = false
        event.preventDefault()
        event.stopImmediatePropagation()
    }

    rail.addEventListener('pointerdown', start)
    rail.addEventListener('click', blockDraggedClick, true)
    windowRef.addEventListener('pointermove', move)
    windowRef.addEventListener('pointerup', stop)
    windowRef.addEventListener('pointercancel', stop)

    return () => {
        rail.removeEventListener('pointerdown', start)
        rail.removeEventListener('click', blockDraggedClick, true)
        windowRef.removeEventListener('pointermove', move)
        windowRef.removeEventListener('pointerup', stop)
        windowRef.removeEventListener('pointercancel', stop)
    }
}

export function createAnnotationThreadUrl(locationRef, threadId) {
    const url = new URL(typeof locationRef === 'string' ? locationRef : locationRef?.href)
    const normalizedThreadId = typeof threadId === 'string' ? threadId.trim() : ''
    if (!normalizedThreadId) return url.toString()

    url.searchParams.delete('pw')
    url.searchParams.delete('vpw')
    url.searchParams.delete('password')
    url.hash = `annotation=${encodeURIComponent(normalizedThreadId)}`
    return url.toString()
}

export function getAnnotationThreadIdFromHash(hash) {
    const match = /^#annotation=([^&]+)$/.exec(typeof hash === 'string' ? hash : '')
    if (!match) return null
    try {
        const threadId = decodeURIComponent(match[1]).trim()
        return threadId || null
    } catch {
        return null
    }
}

async function copyTextToClipboard(text, documentRef = document) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text)
            return
        } catch {}
    }

    const field = documentRef.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    documentRef.body.append(field)
    field.select()
    const copied = documentRef.execCommand?.('copy') === true
    field.remove()
    if (!copied) throw new DOMException('The request is not allowed', 'NotAllowedError')
}

function getTextNodes(root) {
    if (!root?.ownerDocument) return []

    const view = root.ownerDocument.defaultView
    const walker = root.ownerDocument.createTreeWalker(
        root,
        view.NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                return node.parentElement?.closest('script, style, [aria-hidden="true"]')
                    ? view.NodeFilter.FILTER_REJECT
                    : view.NodeFilter.FILTER_ACCEPT
            },
        },
    )
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    return nodes
}

function createRangeFromOffsets(root, startOffset, endOffset) {
    if (
        !root?.ownerDocument
        || !Number.isSafeInteger(startOffset)
        || !Number.isSafeInteger(endOffset)
        || startOffset < 0
        || endOffset <= startOffset
    ) {
        return null
    }

    const range = root.ownerDocument.createRange()
    let traversed = 0
    let startBoundary = null
    let endBoundary = null

    for (const node of getTextNodes(root)) {
        const next = traversed + node.data.length
        if (!startBoundary && startOffset >= traversed && startOffset <= next) {
            startBoundary = { node, offset: startOffset - traversed }
        }
        if (!endBoundary && endOffset >= traversed && endOffset <= next) {
            endBoundary = { node, offset: endOffset - traversed }
        }
        traversed = next
        if (startBoundary && endBoundary) break
    }

    if (!startBoundary || !endBoundary) return null
    range.setStart(startBoundary.node, startBoundary.offset)
    range.setEnd(endBoundary.node, endBoundary.offset)
    return range
}

function getRangeStartOffset(root, range) {
    const before = root.ownerDocument.createRange()
    before.selectNodeContents(root)
    before.setEnd(range.startContainer, range.startOffset)
    return before.toString().length
}

function commonPrefixLength(left, right) {
    const max = Math.min(left.length, right.length)
    let index = 0
    while (index < max && left[index] === right[index]) index += 1
    return index
}

function commonSuffixLength(left, right) {
    const max = Math.min(left.length, right.length)
    let count = 0
    while (
        count < max
        && left[left.length - 1 - count] === right[right.length - 1 - count]
    ) {
        count += 1
    }
    return count
}

export function buildSelectionAnchor(root, range, sourceRevision) {
    if (
        !root
        || !range
        || typeof sourceRevision !== 'string'
        || !/^[a-f0-9]{64}$/.test(sourceRevision)
        || !root.contains(range.commonAncestorContainer)
    ) {
        return null
    }

    const exact = range.toString()
    if (!exact.trim() || exact.length > MAX_QUOTE_LENGTH) return null

    const fullText = root.textContent || ''
    const startOffset = getRangeStartOffset(root, range)
    const endOffset = startOffset + exact.length

    return {
        exact,
        prefix: fullText.slice(Math.max(0, startOffset - CONTEXT_LENGTH), startOffset),
        suffix: fullText.slice(endOffset, endOffset + CONTEXT_LENGTH),
        startOffset,
        endOffset,
        sourceRevision,
    }
}

export function locateAnchorRange(root, anchor, currentRevision) {
    if (!root || !anchor || typeof anchor.exact !== 'string' || !anchor.exact) return null

    if (anchor.sourceRevision === currentRevision) {
        const directRange = createRangeFromOffsets(root, anchor.startOffset, anchor.endOffset)
        if (directRange?.toString() === anchor.exact) return directRange
    }

    const fullText = root.textContent || ''
    const candidates = []
    let index = fullText.indexOf(anchor.exact)
    while (index !== -1) {
        const before = fullText.slice(Math.max(0, index - CONTEXT_LENGTH), index)
        const after = fullText.slice(
            index + anchor.exact.length,
            index + anchor.exact.length + CONTEXT_LENGTH,
        )
        candidates.push({
            index,
            score: commonSuffixLength(before, anchor.prefix || '')
                + commonPrefixLength(after, anchor.suffix || ''),
        })
        index = fullText.indexOf(anchor.exact, index + 1)
    }

    if (candidates.length === 0) return null
    candidates.sort((left, right) => right.score - left.score || left.index - right.index)
    const best = candidates[0]
    if ((anchor.prefix || anchor.suffix) && best.score === 0) return null
    return createRangeFromOffsets(root, best.index, best.index + anchor.exact.length)
}

export function scrollRangeIntoView(range, scrollRoot, { behavior = 'smooth' } = {}) {
    if (!range || !scrollRoot || typeof range.getBoundingClientRect !== 'function') return false

    const rangeRect = range.getBoundingClientRect()
    const rootRect = typeof scrollRoot.getBoundingClientRect === 'function'
        ? scrollRoot.getBoundingClientRect()
        : { top: 0, height: Number(scrollRoot.clientHeight) || 0 }
    const viewportHeight = Number(scrollRoot.clientHeight) || Number(rootRect.height) || 0
    const rangeHeight = Number(rangeRect.height) || 0
    const centerOffset = Math.max(16, (viewportHeight - rangeHeight) / 2)
    const top = Math.max(
        0,
        (Number(scrollRoot.scrollTop) || 0)
            + (Number(rangeRect.top) || 0)
            - (Number(rootRect.top) || 0)
            - centerOffset,
    )

    if (typeof scrollRoot.scrollTo === 'function') {
        scrollRoot.scrollTo({ top, behavior })
    } else {
        scrollRoot.scrollTop = top
    }
    return true
}

export function isPointInAnnotationRange(range, x, y, buffer = 3) {
    if (!range) return false
    let rects = typeof range.getClientRects === 'function' ? range.getClientRects() : []
    if ((!rects || rects.length === 0) && typeof range.getBoundingClientRect === 'function') {
        const bbox = range.getBoundingClientRect()
        if (bbox && (bbox.width > 0 || bbox.height > 0)) {
            rects = [bbox]
        }
    }
    if (!rects || rects.length === 0) return false
    for (let i = 0; i < rects.length; i++) {
        const r = rects[i]
        if (
            x >= r.left - buffer
            && x <= r.right + buffer
            && y >= r.top - buffer
            && y <= r.bottom + buffer
        ) {
            return true
        }
    }
    return false
}

export const DELETE_TOKENS_STORAGE_KEY = 'cf-notepad:annotation-delete-tokens'

const getLocalStorage = () => {
    try {
        if (typeof window !== 'undefined' && window?.localStorage) return window.localStorage
        if (typeof globalThis !== 'undefined' && globalThis?.localStorage) return globalThis.localStorage
    } catch {}
    return null
}

export function getStoredDeleteTokens() {
    try {
        const storage = getLocalStorage()
        const raw = storage?.getItem(DELETE_TOKENS_STORAGE_KEY)
        return raw ? JSON.parse(raw) : {}
    } catch {
        return {}
    }
}

export function getStoredDeleteToken(messageId) {
    if (!messageId) return ''
    const tokens = getStoredDeleteTokens()
    return typeof tokens[messageId] === 'string' ? tokens[messageId] : ''
}

export function storeDeleteToken(messageId, token) {
    if (!messageId || !token) return
    try {
        const storage = getLocalStorage()
        const tokens = getStoredDeleteTokens()
        tokens[messageId] = token
        storage?.setItem(DELETE_TOKENS_STORAGE_KEY, JSON.stringify(tokens))
    } catch {}
}

export function removeStoredDeleteToken(messageId) {
    if (!messageId) return
    try {
        const storage = getLocalStorage()
        const tokens = getStoredDeleteTokens()
        delete tokens[messageId]
        storage?.setItem(DELETE_TOKENS_STORAGE_KEY, JSON.stringify(tokens))
    } catch {}
}

function createElement(document, tagName, className, text) {
    const element = document.createElement(tagName)
    if (className) element.className = className
    if (text !== undefined) element.textContent = text
    return element
}

function readApiError(payload, fallback) {
    const raw = typeof payload?.msg === 'string'
        ? payload.msg
        : (typeof payload?.message === 'string' ? payload.message : null)
    if (typeof raw !== 'string') return fallback
    try {
        const parsed = JSON.parse(raw)
        return typeof parsed === 'string' ? parsed : fallback
    } catch {
        return raw || fallback
    }
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || payload?.err !== 0) {
        const error = new Error(readApiError(payload, `Request failed (${response.status})`))
        error.status = response.status
        error.payload = payload
        throw error
    }
    return payload?.data
}

function formatRelativeTime(timestampSeconds, lang) {
    const nowSeconds = Math.floor(Date.now() / 1000)
    const diff = Math.max(0, nowSeconds - timestampSeconds)
    const isZh = (lang || '').toLowerCase().startsWith('zh')

    if (diff < 60) return isZh ? '剛剛' : 'just now'
    if (diff < 3600) {
        const m = Math.floor(diff / 60)
        return isZh ? `${m} 分鐘前` : `${m}m ago`
    }
    if (diff < 86400) {
        const h = Math.floor(diff / 3600)
        return isZh ? `${h} 小時前` : `${h}h ago`
    }
    const d = Math.floor(diff / 86400)
    if (d < 30) return isZh ? `${d} 天前` : `${d}d ago`
    return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(timestampSeconds * 1000))
}

export function initShareAnnotations(options = {}) {
    if (typeof document === 'undefined') return null

    const isEvent = Boolean(options && (typeof options.preventDefault === 'function' || options.target || options.type))
    const config = isEvent || typeof options !== 'object' || !options ? {} : options

    const appRoot = config.appRoot || document.querySelector('#share-annotation-root')
    const articleRoot = config.articleRoot || document.querySelector('#preview-md, #preview-plain')
    if (!appRoot || !articleRoot) return null

    const shareId = config.shareId || appRoot.dataset?.shareId || window.APP_STATE?.shareId || ''
    const lang = config.lang || (appRoot.dataset?.lang === 'zh-TW' ? 'zh-TW' : (window.APP_STATE?.lang === 'zh-TW' ? 'zh-TW' : 'en'))
    if (!shareId) return null

    const isZh = (lang || '').toLowerCase().startsWith('zh')
    const copy = isZh
        ? {
            title: '段落劃線討論',
            open: '開啟段落討論',
            move: '拖曳以調整按鈕位置',
            copyLink: '🔗 複製連結',
            linkCopied: '已複製註解連結。',
            copyError: '無法複製連結，請手動複製網址。',
            close: '關閉',
            annotate: '註解',
            copy: '複製',
            translate: '翻譯',
            askAi: '詢問 AI',
            textCopied: '已複製選取文字',
            translationCopied: '已複製翻譯結果',
            answerCopied: '已複製回答',
            aiThinking: 'AI 思考中…',
            aiError: 'AI 回覆失敗，請稍後再試。',
            askPlaceholder: '輸入問題，例如：這段話是什麼意思？',
            sendAsk: '發送',
            chipExplain: '🔍 解釋概念',
            chipSummary: '💡 重點摘要',
            chipDerivation: '📐 公式推導',
            chipCode: '💻 程式碼解析',
            selectionHint: '在內文選取文字即可發起新的段落註解。',
            empty: '目前尚無任何段落討論。選取內文文字即可發起第一個討論。',
            name: '你的稱呼',
            comment: '留言內容',
            send: '送出註解',
            cancel: '取消',
            reply: '回覆',
            sendReply: '送出回覆',
            detached: '⚠️ 原文已移除',
            locate: '🎯 定位原文',
            loading: '正在載入註解…',
            loadError: '註解載入失敗，請重新整理後再試。',
            saveError: '留言送出失敗，內容已保留，請再試一次。',
            stale: '文章內容已更新，請重新圈選文字。',
            quoted: '📌 圈選原文',
            discussion: '💬 討論留言',
            messages: '則留言',
            viewDiscussion: '查看完整討論 ➔',
            latestComment: '最新留言',
            deleteComment: '刪除註解',
            confirmDelete: '確定要刪除這則註解嗎？此動作無法復原。',
            commentDeleted: '已成功刪除註解。',
            deleteError: '刪除失敗，可能無此權限。',
            postAsAccount: nickname => `以帳號暱稱「${nickname}」留言`,
            postAnonymously: '匿名自行填寫',
            signedBadge: '已驗證帳號',
            sessionExpired: 'Passkey 登入已過期，您的草稿已保留。請重新驗證 Passkey，或切換為匿名留言。',
            reauthPasskey: '重新驗證 Passkey',
            openSpaceLink: '前往空間重新登入',
            switchToAnonymous: '切換為匿名留言',
        }
        : {
            title: 'Paragraph annotations',
            open: 'Open paragraph annotations',
            move: 'Drag to move the annotation button',
            copyLink: '🔗 Copy link',
            linkCopied: 'Annotation link copied.',
            copyError: 'The annotation link could not be copied. Try again.',
            close: 'Close',
            annotate: 'Annotate',
            copy: 'Copy',
            translate: 'Translate',
            askAi: 'Ask AI',
            textCopied: 'Selected text copied',
            translationCopied: 'Translation copied',
            answerCopied: 'Answer copied',
            aiThinking: 'AI thinking…',
            aiError: 'AI request failed. Please try again.',
            askPlaceholder: 'Ask, e.g. What does this mean?',
            sendAsk: 'Send',
            chipExplain: '🔍 Explain',
            chipSummary: '💡 Summary',
            chipDerivation: '📐 Math derivation',
            chipCode: '💻 Code analysis',
            selectionHint: 'Select article text to start an annotation.',
            empty: 'No annotations yet. Select text to start the first discussion.',
            name: 'Your name',
            comment: 'Comment',
            send: 'Post annotation',
            cancel: 'Cancel',
            reply: 'Reply',
            sendReply: 'Post reply',
            detached: '⚠️ Removed',
            locate: '🎯 Locate',
            loading: 'Loading annotations…',
            loadError: 'Failed to load annotations. Refresh and try again.',
            saveError: 'Failed to post comment. Your text was preserved.',
            stale: 'Article updated. Please reselect text.',
            quoted: '📌 Quoted passage',
            discussion: '💬 Discussion',
            messages: 'comments',
            viewDiscussion: 'View discussion ➔',
            latestComment: 'Latest comment',
            deleteComment: 'Delete comment',
            confirmDelete: 'Are you sure you want to delete this comment? This cannot be undone.',
            commentDeleted: 'Comment deleted successfully.',
            deleteError: 'Failed to delete comment. Permission denied.',
            postAsAccount: nickname => `Post as "${nickname}"`,
            postAnonymously: 'Post anonymously',
            signedBadge: 'Signed account',
            sessionExpired: 'Your Passkey session expired. Your draft has been preserved. Re-authenticate with Passkey or switch to anonymous.',
            reauthPasskey: 'Re-authenticate Passkey',
            openSpaceLink: 'Sign in on Space',
            switchToAnonymous: 'Switch to anonymous',
        }

    const resolveInitialAccount = () => {
        const candidate = config.account !== undefined
            ? config.account
            : (window.APP_STATE?.account || null)
        if (candidate && typeof candidate.nickname === 'string' && candidate.nickname.trim()) {
            return { id: candidate.id || '', nickname: candidate.nickname.trim() }
        }
        return null
    }

    const state = {
        currentRevision: '',
        pendingAnchor: null,
        threads: [],
        located: new Map(),
        activeMiniThreadId: null,
        account: resolveInitialAccount(),
    }

    let identityGroupSeq = 0
    const identityControllers = new Set()

    const getStoredAuthorName = () => {
        try {
            return window.localStorage.getItem(AUTHOR_STORAGE_KEY) || ''
        } catch {
            return ''
        }
    }

    const persistAnonymousAuthorName = name => {
        const clean = typeof name === 'string' ? name.trim() : ''
        if (!clean) return
        if (state.account?.nickname && clean === state.account.nickname) return
        try {
            window.localStorage.setItem(AUTHOR_STORAGE_KEY, clean)
        } catch {}
    }

    const loadAccountSession = async ({ forceFetch = false } = {}) => {
        if (!forceFetch && config.account !== undefined) {
            state.account = resolveInitialAccount()
            return state.account
        }
        if (!forceFetch && window.APP_STATE?.accountEnabled === false) {
            state.account = null
            return null
        }
        try {
            const response = await fetch('/api/account/me', {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            })
            if (!response.ok) {
                state.account = null
                return null
            }
            const raw = await response.json().catch(() => null)
            const data = raw?.err === 0 && raw?.data ? raw.data : raw
            if (data?.authenticated === true && typeof data?.account?.nickname === 'string' && data.account.nickname.trim()) {
                state.account = {
                    id: data.account.id || '',
                    nickname: data.account.nickname.trim(),
                }
            } else {
                state.account = null
            }
        } catch {
            state.account = null
        }
        return state.account
    }

    const createIdentityModeController = ({ authorInput, bodyInput, errorEl, recoveryEl }) => {
        identityGroupSeq += 1
        const groupName = `annotation-identity-mode-${identityGroupSeq}`

        const modeGroup = createElement(document, 'div', 'annotation-identity-mode')
        modeGroup.setAttribute('role', 'radiogroup')
        modeGroup.hidden = !state.account

        const signedOption = createElement(document, 'label', 'annotation-identity-option')
        const signedRadio = createElement(document, 'input')
        signedRadio.type = 'radio'
        signedRadio.name = groupName
        signedRadio.value = 'signed'
        const signedLabel = createElement(document, 'span', 'annotation-identity-label')
        signedOption.append(signedRadio, signedLabel)

        const anonOption = createElement(document, 'label', 'annotation-identity-option')
        const anonRadio = createElement(document, 'input')
        anonRadio.type = 'radio'
        anonRadio.name = groupName
        anonRadio.value = 'anonymous'
        const anonLabel = createElement(document, 'span', 'annotation-identity-label', copy.postAnonymously)
        anonOption.append(anonRadio, anonLabel)

        modeGroup.append(signedOption, anonOption)

        let mode = state.account ? 'signed' : 'anonymous'
        let userTouchedMode = false

        const clearRecovery = () => {
            recoveryEl.hidden = true
            recoveryEl.replaceChildren()
        }

        const applyModeToInputs = ({ clearAuthorOnAnon = false } = {}) => {
            if (state.account) {
                signedLabel.textContent = copy.postAsAccount(state.account.nickname)
                modeGroup.hidden = false
            } else {
                modeGroup.hidden = true
            }

            signedRadio.checked = mode === 'signed'
            anonRadio.checked = mode === 'anonymous'

            if (mode === 'signed' && state.account) {
                authorInput.value = state.account.nickname
                authorInput.readOnly = true
                authorInput.required = true
                authorInput.classList.add('is-signed-locked')
            } else {
                authorInput.readOnly = false
                authorInput.required = true
                authorInput.classList.remove('is-signed-locked')
                if (clearAuthorOnAnon) {
                    authorInput.value = ''
                }
            }
        }

        const switchToAnonymous = ({ focusAuthor = false } = {}) => {
            userTouchedMode = true
            mode = 'anonymous'
            clearRecovery()
            errorEl.textContent = ''
            applyModeToInputs({ clearAuthorOnAnon: true })
            if (focusAuthor) authorInput.focus()
        }

        const switchToSigned = () => {
            if (!state.account) return
            userTouchedMode = true
            mode = 'signed'
            clearRecovery()
            errorEl.textContent = ''
            applyModeToInputs()
        }

        signedRadio.addEventListener('change', () => {
            if (signedRadio.checked) switchToSigned()
        })
        anonRadio.addEventListener('change', () => {
            if (anonRadio.checked) switchToAnonymous({ focusAuthor: true })
        })

        const syncWithAccount = () => {
            if (state.account && !userTouchedMode) {
                mode = 'signed'
            } else if (!state.account && !userTouchedMode) {
                mode = 'anonymous'
            }
            applyModeToInputs({ clearAuthorOnAnon: false })
        }

        const showSessionExpiredPrompt = () => {
            errorEl.textContent = ''
            recoveryEl.replaceChildren()
            recoveryEl.hidden = false

            const msg = createElement(document, 'p', 'annotation-session-expired-text', copy.sessionExpired)
            const actionsRow = createElement(document, 'div', 'annotation-session-expired-actions')

            const reauthBtn = createElement(document, 'button', 'annotation-secondary-button annotation-reauth-btn', copy.reauthPasskey)
            reauthBtn.type = 'button'
            reauthBtn.addEventListener('click', async () => {
                reauthBtn.disabled = true
                errorEl.textContent = ''
                const reauthFn = typeof config.loginWithPasskey === 'function' ? config.loginWithPasskey : loginWithPasskey
                try {
                    await reauthFn()
                    await loadAccountSession({ forceFetch: true })
                    if (state.account) {
                        mode = 'signed'
                        clearRecovery()
                        for (const ctrl of identityControllers) ctrl.syncWithAccount()
                    } else {
                        errorEl.textContent = copy.saveError
                    }
                } catch (err) {
                    if (err?.code === 'WEBAUTHN_UNSUPPORTED' || err?.code === 'WEBVIEW_UNSUPPORTED') {
                        window.open?.('/_space', '_blank', 'noopener')
                    }
                    errorEl.textContent = err?.message || copy.saveError
                } finally {
                    reauthBtn.disabled = false
                }
            })

            const spaceLink = createElement(document, 'a', 'annotation-space-reauth-link', copy.openSpaceLink)
            spaceLink.href = '/_space'
            spaceLink.target = '_blank'
            spaceLink.rel = 'noopener noreferrer'

            const switchAnonBtn = createElement(document, 'button', 'annotation-secondary-button annotation-switch-anon-btn', copy.switchToAnonymous)
            switchAnonBtn.type = 'button'
            switchAnonBtn.addEventListener('click', () => {
                switchToAnonymous({ focusAuthor: true })
            })

            actionsRow.append(reauthBtn, switchAnonBtn, spaceLink)
            recoveryEl.append(msg, actionsRow)
        }

        const controller = {
            element: modeGroup,
            getMode: () => mode,
            buildPayload: (extra = {}) => (
                mode === 'signed'
                    ? { ...extra, mode: 'signed', body: bodyInput.value }
                    : { ...extra, mode: 'anonymous', authorName: authorInput.value, body: bodyInput.value }
            ),
            clearRecovery,
            showSessionExpiredPrompt,
            syncWithAccount,
            setDisabled: disabled => {
                signedRadio.disabled = disabled
                anonRadio.disabled = disabled
            },
            persistIfAnonymous: () => {
                if (mode === 'anonymous') {
                    persistAnonymousAuthorName(authorInput.value)
                }
            },
        }
        identityControllers.add(controller)
        applyModeToInputs()
        return controller
    }

    const panel = createElement(document, 'aside', 'annotation-sidebar')
    panel.id = 'annotation-sidebar'
    panel.setAttribute('aria-label', copy.title)
    panel.setAttribute('aria-hidden', 'true')

    const header = createElement(document, 'header', 'annotation-sidebar-header')
    const heading = createElement(document, 'h2', '', copy.title)
    heading.tabIndex = -1
    const closeButton = createElement(document, 'button', 'annotation-icon-button', '×')
    closeButton.type = 'button'
    closeButton.setAttribute('aria-label', copy.close)
    header.append(heading, closeButton)

    const intro = createElement(document, 'p', 'annotation-sidebar-intro', copy.selectionHint)
    const status = createElement(document, 'div', 'annotation-status')
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')

    const composer = createElement(document, 'form', 'annotation-composer')
    composer.hidden = true
    const composerQuoteBox = createElement(document, 'div', 'annotation-quote-box')
    const composerQuoteHeader = createElement(document, 'div', 'annotation-quote-header')
    const composerLabel = createElement(document, 'span', 'annotation-quote-badge', copy.quoted)
    composerQuoteHeader.append(composerLabel)
    const composerQuote = createElement(document, 'blockquote', 'annotation-composer-quote')
    composerQuoteBox.append(composerQuoteHeader, composerQuote)
    const authorInput = createElement(document, 'input', 'annotation-input')
    authorInput.name = 'authorName'
    authorInput.required = true
    authorInput.maxLength = 40
    authorInput.autocomplete = 'name'
    authorInput.placeholder = copy.name
    const bodyInput = createElement(document, 'textarea', 'annotation-textarea')
    bodyInput.name = 'body'
    bodyInput.required = true
    bodyInput.maxLength = 2000
    bodyInput.rows = 4
    bodyInput.placeholder = copy.comment
    const composerError = createElement(document, 'p', 'annotation-inline-error')
    composerError.setAttribute('aria-live', 'polite')
    const composerRecovery = createElement(document, 'div', 'annotation-session-expired-prompt')
    composerRecovery.setAttribute('role', 'alert')
    composerRecovery.hidden = true
    const composerActions = createElement(document, 'div', 'annotation-form-actions')
    const cancelButton = createElement(document, 'button', 'annotation-secondary-button', copy.cancel)
    cancelButton.type = 'button'
    const submitButton = createElement(document, 'button', 'annotation-primary-button', copy.send)
    submitButton.type = 'submit'
    composerActions.append(cancelButton, submitButton)
    authorInput.value = getStoredAuthorName()
    const composerIdentity = createIdentityModeController({
        authorInput,
        bodyInput,
        errorEl: composerError,
        recoveryEl: composerRecovery,
    })
    composer.append(
        composerQuoteBox,
        composerIdentity.element,
        authorInput,
        bodyInput,
        composerError,
        composerRecovery,
        composerActions,
    )

    const threadList = createElement(document, 'div', 'annotation-thread-list')
    const railButton = createElement(document, 'button', 'annotation-rail-button')
    railButton.id = 'annotation-rail-button'
    railButton.type = 'button'
    railButton.setAttribute('aria-label', copy.open)
    railButton.title = copy.move
    railButton.setAttribute('aria-controls', panel.id)
    railButton.setAttribute('aria-expanded', 'false')
    const railIcon = createElement(document, 'span', 'annotation-rail-icon', '◰')
    railIcon.setAttribute('aria-hidden', 'true')
    const railCount = createElement(document, 'span', 'annotation-rail-count', '0')
    railButton.append(railIcon, railCount)

    const selectionToolbar = createElement(document, 'div', 'selection-action-toolbar')
    selectionToolbar.hidden = true

    const copyBtn = createElement(document, 'button', 'selection-action-btn selection-action-copy')
    copyBtn.type = 'button'
    copyBtn.innerHTML = `<span class="selection-action-icon" aria-hidden="true">📋</span><span>${copy.copy}</span>`
    copyBtn.title = copy.copy

    const translateBtn = createElement(document, 'button', 'selection-action-btn selection-action-translate')
    translateBtn.type = 'button'
    translateBtn.innerHTML = `<span class="selection-action-icon" aria-hidden="true">🌐</span><span>${copy.translate}</span>`
    translateBtn.title = copy.translate

    const askAiBtn = createElement(document, 'button', 'selection-action-btn selection-action-ask-ai')
    askAiBtn.type = 'button'
    askAiBtn.innerHTML = `<span class="selection-action-icon" aria-hidden="true">✨</span><span>${copy.askAi}</span>`
    askAiBtn.title = copy.askAi

    const selectionButton = createElement(document, 'button', 'annotation-selection-button selection-action-btn selection-action-annotate')
    selectionButton.type = 'button'
    selectionButton.innerHTML = `<span class="selection-action-icon" aria-hidden="true">💬</span><span>${copy.annotate}</span>`
    selectionButton.title = copy.annotate

    selectionToolbar.append(copyBtn, translateBtn, askAiBtn, selectionButton)

    const aiPopover = createElement(document, 'div', 'selection-ai-popover')
    aiPopover.hidden = true
    aiPopover.innerHTML = `
        <div class="selection-ai-popover-header">
            <div class="selection-ai-popover-title">
                <span class="selection-ai-title-icon" aria-hidden="true">✨</span>
                <span class="selection-ai-title-text">AI 助手</span>
            </div>
            <button type="button" class="selection-ai-close-btn" aria-label="${copy.close}">✕</button>
        </div>
        <div class="selection-ai-popover-body">
            <div class="selection-ai-quote-preview">
                <span class="selection-ai-quote-icon" aria-hidden="true">📌</span>
                <span class="selection-ai-quote-text"></span>
            </div>
            <div class="selection-ai-loading" style="display:none;">
                <div class="selection-ai-spinner"></div>
                <span class="selection-ai-loading-text">${copy.aiThinking}</span>
            </div>
            <div class="selection-ai-result-view" style="display:none;">
                <div class="selection-ai-result-content"></div>
                <div class="selection-ai-result-actions">
                    <button type="button" class="selection-ai-action-btn selection-ai-copy-result-btn">📋 ${copy.copy}</button>
                </div>
            </div>
            <div class="selection-ai-ask-view" style="display:none;">
                <div class="selection-ai-presets">
                    <button type="button" class="selection-ai-chip" data-prompt="請用通俗易懂的語言詳細解釋這段內容的核心概念與背景">${copy.chipExplain}</button>
                    <button type="button" class="selection-ai-chip" data-prompt="請提煉這段內容的核心要點摘要">${copy.chipSummary}</button>
                    <button type="button" class="selection-ai-chip" data-prompt="請詳細推導並說明其中的公式與數學邏輯">${copy.chipDerivation}</button>
                    <button type="button" class="selection-ai-chip" data-prompt="請詳細解釋這段程式碼的邏輯、運作機制與潛在邊界情況">${copy.chipCode}</button>
                </div>
                <form class="selection-ai-ask-form">
                    <input type="text" class="selection-ai-ask-input" placeholder="${copy.askPlaceholder}" required />
                    <button type="submit" class="selection-ai-ask-submit">${copy.sendAsk}</button>
                </form>
            </div>
        </div>
    `

    const miniPopover = createElement(document, 'div', 'annotation-mini-popover')
    miniPopover.hidden = true
    miniPopover.innerHTML = `
        <div class="annotation-mini-header">
            <span class="annotation-mini-badge">💬 ${copy.title}</span>
            <span class="annotation-mini-count"></span>
            <button type="button" class="annotation-mini-close" aria-label="${copy.close}">×</button>
        </div>
        <div class="annotation-mini-author-time">
            <strong class="annotation-mini-author"></strong>
            <time class="annotation-mini-time"></time>
        </div>
        <div class="annotation-mini-body"></div>
        <div class="annotation-mini-footer">
            <span class="annotation-mini-action-text">${copy.viewDiscussion}</span>
        </div>
    `

    panel.append(header, intro, composer, status, threadList)
    appRoot.append(railButton, selectionToolbar, aiPopover, miniPopover, panel)

    setupAnnotationRailDragging(railButton, {
        storageKey: `${RAIL_POSITION_STORAGE_PREFIX}${shareId}`,
    })

    const setPanelOpen = open => {
        document.body.classList.toggle('annotation-sidebar-open', open)
        panel.setAttribute('aria-hidden', open ? 'false' : 'true')
        railButton.setAttribute('aria-expanded', open ? 'true' : 'false')
        if (open) heading.focus?.()
    }

    const showComposer = anchor => {
        state.pendingAnchor = anchor
        composerQuote.textContent = anchor.exact
        composerError.textContent = ''
        composerIdentity.clearRecovery()
        composerIdentity.syncWithAccount()
        composer.hidden = false
        setPanelOpen(true)
        if (typeof composer.scrollIntoView === 'function') {
            composer.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
        window.setTimeout(() => (authorInput.readOnly || authorInput.value ? bodyInput : authorInput).focus(), 0)
    }

    const hideComposer = () => {
        state.pendingAnchor = null
        composer.hidden = true
        composerError.textContent = ''
        composerIdentity.clearRecovery()
    }

    const setSaving = saving => {
        submitButton.disabled = saving
        cancelButton.disabled = saving
        authorInput.disabled = saving
        bodyInput.disabled = saving
        composerIdentity.setDisabled(saving)
    }

    const updateHighlight = () => {
        const located = new Map()
        const ranges = []
        for (const thread of state.threads) {
            const range = locateAnchorRange(articleRoot, thread.anchor, state.currentRevision)
            located.set(thread.id, range)
            if (range) ranges.push(range)
        }

        if (globalThis.CSS?.highlights && globalThis.Highlight) {
            if (ranges.length) CSS.highlights.set('share-annotations', new Highlight(...ranges))
            else CSS.highlights.delete('share-annotations')
        }
        state.located = located
        return located
    }

    const makeReplyForm = thread => {
        const form = createElement(document, 'form', 'annotation-reply-form')
        form.hidden = true
        const replyAuthor = createElement(document, 'input', 'annotation-input')
        replyAuthor.name = 'authorName'
        replyAuthor.required = true
        replyAuthor.maxLength = 40
        replyAuthor.placeholder = copy.name
        replyAuthor.value = state.account ? '' : (authorInput.value || getStoredAuthorName())
        const replyBody = createElement(document, 'textarea', 'annotation-textarea')
        replyBody.name = 'body'
        replyBody.required = true
        replyBody.maxLength = 2000
        replyBody.rows = 3
        replyBody.placeholder = copy.comment
        const replyError = createElement(document, 'p', 'annotation-inline-error')
        replyError.setAttribute('aria-live', 'polite')
        const replyRecovery = createElement(document, 'div', 'annotation-session-expired-prompt')
        replyRecovery.setAttribute('role', 'alert')
        replyRecovery.hidden = true
        const replySubmit = createElement(document, 'button', 'annotation-primary-button', copy.sendReply)
        replySubmit.type = 'submit'

        const replyIdentity = createIdentityModeController({
            authorInput: replyAuthor,
            bodyInput: replyBody,
            errorEl: replyError,
            recoveryEl: replyRecovery,
        })

        form.append(replyIdentity.element, replyAuthor, replyBody, replyError, replyRecovery, replySubmit)

        form.addEventListener('submit', async event => {
            event.preventDefault()
            replyError.textContent = ''
            replyIdentity.clearRecovery()
            replySubmit.disabled = true
            replyAuthor.disabled = true
            replyBody.disabled = true
            replyIdentity.setDisabled(true)
            const submittedMode = replyIdentity.getMode()
            try {
                const data = await requestJson(
                    `/api/shares/${encodeURIComponent(shareId)}/annotations/${encodeURIComponent(thread.id)}/messages`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(replyIdentity.buildPayload()),
                    },
                )
                if (data.message?.deleteToken) {
                    storeDeleteToken(data.message.id, data.message.deleteToken)
                }
                thread.messages.push(data.message)
                thread.messageCount += 1
                thread.updatedAt = data.message.createdAt
                replyIdentity.persistIfAnonymous()
                renderThreads()
            } catch (error) {
                if (submittedMode === 'signed' && error?.status === 401) {
                    replyIdentity.showSessionExpiredPrompt()
                } else {
                    replyError.textContent = error.message || copy.saveError
                }
            } finally {
                replySubmit.disabled = false
                replyAuthor.disabled = false
                replyBody.disabled = false
                replyIdentity.setDisabled(false)
            }
        })

        return form
    }

    const renderThreads = () => {
        threadList.replaceChildren()
        railCount.textContent = String(state.threads.length)

        if (state.threads.length === 0) {
            threadList.append(createElement(document, 'p', 'annotation-empty-state', copy.empty))
            updateHighlight()
            return
        }

        const located = updateHighlight()
        for (const thread of state.threads) {
            const card = createElement(document, 'article', 'annotation-thread')
            card.dataset.threadId = thread.id

            // 1. Quoted Source Header & Passage
            const quoteBox = createElement(document, 'div', 'annotation-quote-box')
            const quoteHeader = createElement(document, 'div', 'annotation-quote-header')
            const quoteBadge = createElement(document, 'span', 'annotation-quote-badge', copy.quoted)
            const quoteActions = createElement(document, 'div', 'annotation-quote-actions')

            const location = located.get(thread.id)
            const locationButton = createElement(
                document,
                'button',
                location ? 'annotation-locate-button' : 'annotation-detached-label',
                location ? copy.locate : copy.detached,
            )
            locationButton.type = 'button'
            locationButton.disabled = !location
            if (location) {
                locationButton.addEventListener('click', () => {
                    const target = location.startContainer.parentElement
                    const scrollRoot = articleRoot.closest('.contents')
                        || document.scrollingElement
                        || document.documentElement
                    scrollRangeIntoView(location, scrollRoot)
                    target?.classList.add('annotation-source-flash')
                    window.setTimeout(() => target?.classList.remove('annotation-source-flash'), 1400)
                })
            }
            const copyLinkButton = createElement(document, 'button', 'annotation-copy-link-button', copy.copyLink)
            copyLinkButton.type = 'button'
            copyLinkButton.addEventListener('click', async () => {
                try {
                    await copyTextToClipboard(createAnnotationThreadUrl(window.location, thread.id))
                    status.textContent = copy.linkCopied
                } catch {
                    status.textContent = copy.copyError
                }
            })
            quoteActions.append(locationButton, copyLinkButton)
            quoteHeader.append(quoteBadge, quoteActions)
            const quote = createElement(document, 'blockquote', 'annotation-thread-quote', thread.anchor.exact)
            quoteBox.append(quoteHeader, quote)

            // 2. Discussion Comments Section
            const discussionSection = createElement(document, 'div', 'annotation-discussion-section')
            const discussionHeader = createElement(document, 'div', 'annotation-discussion-header')
            const divLineLeft = createElement(document, 'span', 'annotation-discussion-divider-line')
            const messageCount = thread.messageCount || thread.messages?.length || 0
            const discussionLabel = createElement(document, 'span', 'annotation-discussion-label', `${copy.discussion} (${messageCount})`)
            const divLineRight = createElement(document, 'span', 'annotation-discussion-divider-line')
            discussionHeader.append(divLineLeft, discussionLabel, divLineRight)
            discussionSection.append(discussionHeader)

            const messages = createElement(document, 'div', 'annotation-messages')
            for (const message of thread.messages) {
                const item = createElement(document, 'div', 'annotation-message')
                item.dataset.messageId = message.id
                const meta = createElement(document, 'div', 'annotation-message-meta')
                
                const authorGroup = createElement(document, 'div', 'annotation-author-group')
                const avatar = createElement(document, 'span', 'annotation-author-avatar', (message.authorName || 'U').trim().charAt(0).toUpperCase())
                const author = createElement(document, 'strong', 'annotation-author-name', message.authorName)
                authorGroup.append(avatar, author)
                if (message.isSignedAccount) {
                    const signedBadge = createElement(document, 'span', 'annotation-signed-badge', copy.signedBadge)
                    authorGroup.append(signedBadge)
                }

                const actions = createElement(document, 'div', 'annotation-message-meta-actions')
                const date = createElement(
                    document,
                    'time',
                    'annotation-message-time',
                    new Intl.DateTimeFormat(lang, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                    }).format(new Date(message.createdAt * 1000)),
                )
                actions.append(date)

                const deleteToken = getStoredDeleteToken(message.id)
                const isEditor = Boolean(window.APP_STATE?.isEdit || window.APP_STATE?.role === 'edit')
                const canDelete = Boolean(message.canDelete || deleteToken || isEditor)
                if (canDelete) {
                    const deleteButton = createElement(document, 'button', 'annotation-delete-message-btn', '🗑️')
                    deleteButton.type = 'button'
                    deleteButton.title = copy.deleteComment
                    deleteButton.setAttribute('aria-label', copy.deleteComment)
                    deleteButton.addEventListener('click', async event => {
                        event.stopPropagation()
                        const confirmed = typeof window.showAppDialog === 'function'
                            ? await window.showAppDialog({
                                title: copy.deleteComment || (lang === 'zh-TW' ? '刪除留言' : 'Delete Comment'),
                                message: copy.confirmDelete,
                                kind: 'confirm',
                                confirm: true
                            })
                            : window.confirm(copy.confirmDelete)
                        if (!confirmed) return
                        deleteButton.disabled = true
                        try {
                            await requestJson(
                                `/api/shares/${encodeURIComponent(shareId)}/annotations/${encodeURIComponent(thread.id)}/messages/${encodeURIComponent(message.id)}`,
                                {
                                    method: 'DELETE',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        ...(deleteToken ? { 'X-Annotation-Delete-Token': deleteToken } : {}),
                                    },
                                    body: JSON.stringify(deleteToken ? { deleteToken } : {}),
                                },
                            )
                            removeStoredDeleteToken(message.id)
                            thread.messages = thread.messages.filter(m => m.id !== message.id)
                            thread.messageCount = Math.max(0, thread.messageCount - 1)
                            if (thread.messages.length === 0) {
                                state.threads = state.threads.filter(t => t.id !== thread.id)
                                if (state.activeMiniThreadId === thread.id) {
                                    hideMiniPopover()
                                }
                            }
                            status.textContent = copy.commentDeleted
                            renderThreads()
                        } catch (error) {
                            status.textContent = error.message || copy.deleteError
                            deleteButton.disabled = false
                        }
                    })
                    actions.append(deleteButton)
                }

                meta.append(authorGroup, actions)
                item.append(meta, createElement(document, 'p', 'annotation-message-body', message.body))
                messages.append(item)
            }
            discussionSection.append(messages)

            // 3. Footer with Action Buttons
            const footer = createElement(document, 'div', 'annotation-thread-footer')
            const count = createElement(
                document,
                'span',
                'annotation-message-count',
                `${thread.messageCount} ${copy.messages}`,
            )
            const replyButton = createElement(document, 'button', 'annotation-secondary-button annotation-reply-btn', `↩ ${copy.reply}`)
            replyButton.type = 'button'
            const replyForm = makeReplyForm(thread)
            replyButton.addEventListener('click', () => {
                replyForm.hidden = !replyForm.hidden
                if (!replyForm.hidden) replyForm.querySelector('textarea')?.focus()
            })
            footer.append(count, replyButton)
            card.append(quoteBox, discussionSection, footer, replyForm)
            threadList.append(card)
        }
    }

    const locateThreadFromLocation = () => {
        const threadId = getAnnotationThreadIdFromHash(window.location.hash)
        if (!threadId) return
        const thread = state.threads.find(item => item.id === threadId)
        if (!thread) return

        setPanelOpen(true)
        const range = locateAnchorRange(articleRoot, thread.anchor, state.currentRevision)
        if (!range) return
        const scrollRoot = articleRoot.closest('.contents')
            || document.scrollingElement
            || document.documentElement
        scrollRangeIntoView(range, scrollRoot)
        const target = range.startContainer.parentElement
        target?.classList.add('annotation-source-flash')
        window.setTimeout(() => target?.classList.remove('annotation-source-flash'), 1400)
    }

    const loadThreads = async () => {
        status.textContent = copy.loading
        try {
            const [, data] = await Promise.all([
                loadAccountSession(),
                requestJson(`/api/shares/${encodeURIComponent(shareId)}/annotations?limit=25`),
            ])
            for (const ctrl of identityControllers) ctrl.syncWithAccount()
            state.currentRevision = data.sourceRevision || ''
            state.threads = Array.isArray(data.threads) ? data.threads : []
            status.textContent = ''
            renderThreads()
            locateThreadFromLocation()
        } catch {
            status.textContent = copy.loadError
        }
    }

    const findThreadAtPoint = (x, y) => {
        if (!state.located || state.threads.length === 0) return null
        for (const thread of state.threads) {
            const range = state.located.get(thread.id)
            if (range && isPointInAnnotationRange(range, x, y)) {
                return { thread, range }
            }
        }
        return null
    }

    const positionMiniPopover = (range, pointX) => {
        if (!range || typeof range.getBoundingClientRect !== 'function') return
        let targetRect = range.getBoundingClientRect()
        if (typeof range.getClientRects === 'function') {
            const rects = range.getClientRects()
            if (rects && rects.length > 0 && typeof pointX === 'number') {
                for (let i = 0; i < rects.length; i++) {
                    const r = rects[i]
                    if (pointX >= r.left - 6 && pointX <= r.right + 6) {
                        targetRect = r
                        break
                    }
                }
            }
        }

        const popoverWidth = Math.min(320, window.innerWidth - 24)
        const centerX = targetRect.left + targetRect.width / 2
        const left = clamp(
            centerX,
            popoverWidth / 2 + 12,
            window.innerWidth - popoverWidth / 2 - 12,
        )
        miniPopover.style.left = `${Math.round(left)}px`

        const popoverHeight = miniPopover.offsetHeight || 130
        const spaceAbove = targetRect.top
        const spaceBelow = window.innerHeight - targetRect.bottom

        if (spaceAbove >= popoverHeight + 14 || spaceAbove > spaceBelow) {
            const top = Math.max(8, targetRect.top - popoverHeight - 8)
            miniPopover.style.top = `${Math.round(top)}px`
            miniPopover.dataset.placement = 'top'
        } else {
            const top = Math.min(window.innerHeight - popoverHeight - 8, targetRect.bottom + 8)
            miniPopover.style.top = `${Math.round(top)}px`
            miniPopover.dataset.placement = 'bottom'
        }
    }

    let miniHideTimer = null
    const scheduleHideMiniPopover = (delay = 220) => {
        window.clearTimeout(miniHideTimer)
        miniHideTimer = window.setTimeout(() => {
            hideMiniPopover()
        }, delay)
    }

    const showMiniPopover = (thread, range, pointX) => {
        window.clearTimeout(miniHideTimer)
        state.activeMiniThreadId = thread.id
        const messages = thread.messages || []
        const latestMsg = messages[messages.length - 1] || {}
        const authorName = latestMsg.authorName || copy.name
        const commentBody = latestMsg.body || ''
        const count = thread.messageCount || messages.length || 1

        const countEl = miniPopover.querySelector('.annotation-mini-count')
        const authorEl = miniPopover.querySelector('.annotation-mini-author')
        const timeEl = miniPopover.querySelector('.annotation-mini-time')
        const bodyEl = miniPopover.querySelector('.annotation-mini-body')

        if (countEl) countEl.textContent = `${count} ${copy.messages}`
        if (authorEl) authorEl.textContent = authorName
        if (timeEl && (latestMsg.createdAt || thread.createdAt)) {
            const timestamp = (latestMsg.createdAt || thread.createdAt) * 1000
            try {
                timeEl.textContent = new Intl.DateTimeFormat(lang, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                }).format(new Date(timestamp))
            } catch {
                timeEl.textContent = ''
            }
        } else if (timeEl) {
            timeEl.textContent = ''
        }
        if (bodyEl) bodyEl.textContent = commentBody

        selectionToolbar.hidden = true
        miniPopover.hidden = false
        positionMiniPopover(range, pointX)
    }

    const hideMiniPopover = () => {
        window.clearTimeout(miniHideTimer)
        state.activeMiniThreadId = null
        miniPopover.hidden = true
        if (articleRoot) articleRoot.style.cursor = ''
    }

    const focusThreadInSidebar = threadId => {
        setPanelOpen(true)
        window.setTimeout(() => {
            const threadCard = threadList.querySelector(`[data-thread-id="${threadId}"]`)
            if (threadCard) {
                threadCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
                threadCard.classList.add('annotation-thread-flash')
                window.setTimeout(() => threadCard.classList.remove('annotation-thread-flash'), 1600)
            }
        }, 60)
    }

    const positionAiPopover = () => {
        if (!state.lastSelectionRect) return
        const rect = state.lastSelectionRect
        const popoverWidth = Math.min(400, window.innerWidth - 24)
        const left = Math.min(window.innerWidth - popoverWidth / 2 - 12, Math.max(popoverWidth / 2 + 12, rect.left + rect.width / 2))
        aiPopover.style.left = `${left}px`

        const spaceBelow = window.innerHeight - rect.bottom
        if (spaceBelow > 280 || rect.top < 280) {
            aiPopover.style.top = `${Math.min(window.innerHeight - 320, rect.bottom + 10)}px`
            aiPopover.style.bottom = 'auto'
        } else {
            aiPopover.style.top = `${Math.max(10, rect.top - 300)}px`
            aiPopover.style.bottom = 'auto'
        }
    }

    const openAiPopover = ({ title, showLoading = false, showAskView = false }) => {
        const titleEl = aiPopover.querySelector('.selection-ai-title-text')
        const loading = aiPopover.querySelector('.selection-ai-loading')
        const resultView = aiPopover.querySelector('.selection-ai-result-view')
        const askView = aiPopover.querySelector('.selection-ai-ask-view')
        const quoteTextEl = aiPopover.querySelector('.selection-ai-quote-text')

        if (titleEl && title) titleEl.textContent = title
        if (quoteTextEl && state.pendingAnchor?.exact) {
            quoteTextEl.textContent = state.pendingAnchor.exact
        }
        loading.style.display = showLoading ? 'flex' : 'none'
        resultView.style.display = 'none'
        askView.style.display = showAskView ? 'block' : 'none'

        selectionToolbar.hidden = true
        aiPopover.hidden = false
        positionAiPopover()

        if (showAskView) {
            const input = aiPopover.querySelector('.selection-ai-ask-input')
            if (input) {
                input.value = ''
                window.setTimeout(() => input.focus(), 50)
            }
        }
    }

    const formatAiResult = text => {
        if (!text) return ''
        if (typeof window.renderMarkdown === 'function') {
            try {
                const rendered = window.renderMarkdown(text)
                if (typeof rendered === 'string') return rendered
            } catch {}
        }
        if (typeof window.marked?.parse === 'function') {
            try {
                const rendered = window.marked.parse(text, { async: false })
                if (typeof rendered === 'string') return rendered
            } catch {}
        }
        const div = document.createElement('div')
        div.textContent = text
        let html = div.innerHTML
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:3px;font-family:monospace;">$1</code>')
        html = html.replace(/\n/g, '<br>')
        return html
    }

    const showAiResult = (text, copySuccessMsg) => {
        const loading = aiPopover.querySelector('.selection-ai-loading')
        const resultView = aiPopover.querySelector('.selection-ai-result-view')
        const resultContent = aiPopover.querySelector('.selection-ai-result-content')
        const copyResultBtn = aiPopover.querySelector('.selection-ai-copy-result-btn')
        const askView = aiPopover.querySelector('.selection-ai-ask-view')

        loading.style.display = 'none'
        askView.style.display = 'none'
        resultView.style.display = 'block'
        resultContent.innerHTML = formatAiResult(text)

        if (typeof window.renderMathInElement === 'function') {
            try {
                window.renderMathInElement(resultContent, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                    ],
                    throwOnError: false,
                })
            } catch {}
        }

        positionAiPopover()

        copyResultBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(text)
                if (typeof window.showToast === 'function') {
                    window.showToast(copySuccessMsg || copy.answerCopied)
                }
            } catch {}
        }
    }

    const showAiError = errorMessage => {
        const loading = aiPopover.querySelector('.selection-ai-loading')
        const resultView = aiPopover.querySelector('.selection-ai-result-view')
        const resultContent = aiPopover.querySelector('.selection-ai-result-content')
        const askView = aiPopover.querySelector('.selection-ai-ask-view')

        loading.style.display = 'none'
        askView.style.display = 'none'
        resultView.style.display = 'block'
        resultContent.textContent = ''
        const errorSpan = document.createElement('span')
        errorSpan.style.color = '#d9534f'
        errorSpan.style.fontWeight = '600'
        errorSpan.textContent = `⚠️ ${errorMessage}`
        resultContent.appendChild(errorSpan)
        positionAiPopover()
    }

    const closeAiPopover = () => {
        aiPopover.hidden = true
    }

    const executeAiRequest = async ({ mode, instruction, targetLanguage, copySuccessMsg }) => {
        if (!state.pendingAnchor?.exact) return
        const text = state.pendingAnchor.exact
        try {
            const data = await requestJson(
                `/api/shares/${encodeURIComponent(shareId)}/ai-assistant`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        mode,
                        instruction,
                        targetLanguage,
                    }),
                },
            )
            if (data?.result) {
                showAiResult(data.result, copySuccessMsg)
            } else {
                showAiError(data?.message || copy.aiError)
            }
        } catch (err) {
            showAiError(err.message || copy.aiError)
        }
    }

    const captureSelection = () => {
        const win = articleRoot?.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null)
        if (!win || typeof win.getSelection !== 'function') return
        const selection = win.getSelection()
        if (!selection || selection.rangeCount !== 1 || selection.isCollapsed || !state.currentRevision) {
            selectionToolbar.hidden = true
            return
        }

        const range = selection.getRangeAt(0)
        const anchor = buildSelectionAnchor(articleRoot, range, state.currentRevision)
        if (!anchor) {
            selectionToolbar.hidden = true
            return
        }

        state.pendingAnchor = anchor
        const rect = range.getBoundingClientRect()
        state.lastSelectionRect = rect

        const toolbarWidth = 260
        const left = Math.min(window.innerWidth - toolbarWidth / 2 - 12, Math.max(toolbarWidth / 2 + 12, rect.left + rect.width / 2))
        selectionToolbar.style.left = `${left}px`

        if (rect.top > 54) {
            selectionToolbar.style.top = `${Math.max(8, rect.top - 46)}px`
        } else {
            selectionToolbar.style.top = `${Math.min(window.innerHeight - 48, rect.bottom + 8)}px`
        }
        selectionButton.hidden = false
        selectionToolbar.hidden = false
    }

    copyBtn.addEventListener('click', async () => {
        if (!state.pendingAnchor?.exact) return
        try {
            await navigator.clipboard.writeText(state.pendingAnchor.exact)
            if (typeof window.showToast === 'function') {
                window.showToast(copy.textCopied)
            }
        } catch {}
        selectionToolbar.hidden = true
    })

    translateBtn.addEventListener('click', () => {
        if (!state.pendingAnchor?.exact) return
        const text = state.pendingAnchor.exact
        const hasChinese = /[\u3400-\u9fff]/.test(text)
        const targetLanguage = hasChinese ? 'English' : 'Traditional Chinese'
        const title = `${copy.translate} (${hasChinese ? '➔ English' : '➔ 繁體中文'})`
        openAiPopover({ title, showLoading: true })
        executeAiRequest({
            mode: 'translate',
            targetLanguage,
            copySuccessMsg: copy.translationCopied,
        })
    })

    askAiBtn.addEventListener('click', () => {
        if (!state.pendingAnchor?.exact) return
        openAiPopover({ title: copy.askAi, showAskView: true })
    })

    const closeAiBtn = aiPopover.querySelector('.selection-ai-close-btn')
    if (closeAiBtn) closeAiBtn.addEventListener('click', closeAiPopover)

    const presetChips = aiPopover.querySelectorAll('.selection-ai-chip')
    for (const chip of presetChips) {
        chip.addEventListener('click', () => {
            const prompt = chip.dataset.prompt
            const chipTitle = chip.textContent.trim()
            openAiPopover({ title: `${copy.askAi} · ${chipTitle}`, showLoading: true })
            executeAiRequest({
                mode: 'ask',
                instruction: prompt,
                copySuccessMsg: copy.answerCopied,
            })
        })
    }

    const askForm = aiPopover.querySelector('.selection-ai-ask-form')
    const askInput = aiPopover.querySelector('.selection-ai-ask-input')
    if (askForm && askInput) {
        askForm.addEventListener('submit', event => {
            event.preventDefault()
            const question = askInput.value.trim()
            if (!question) return
            openAiPopover({ title: `${copy.askAi} · ${question.slice(0, 16)}...`, showLoading: true })
            executeAiRequest({
                mode: 'ask',
                instruction: question,
                copySuccessMsg: copy.answerCopied,
            })
        })
    }

    railButton.addEventListener('click', () => {
        setPanelOpen(panel.getAttribute('aria-hidden') === 'true')
    })
    closeButton.addEventListener('click', () => setPanelOpen(false))
    cancelButton.addEventListener('click', hideComposer)
    selectionButton.addEventListener('pointerdown', event => event.preventDefault())
    selectionButton.addEventListener('click', () => {
        if (state.pendingAnchor) {
            hideMiniPopover()
            showComposer(state.pendingAnchor)
            selectionToolbar.hidden = true
            aiPopover.hidden = true
        }
    })

    miniPopover.addEventListener('pointerenter', () => window.clearTimeout(miniHideTimer))
    miniPopover.addEventListener('pointerleave', () => scheduleHideMiniPopover(220))
    miniPopover.addEventListener('click', event => {
        if (event.target.closest('.annotation-mini-close')) {
            event.stopPropagation()
            hideMiniPopover()
            return
        }
        if (state.activeMiniThreadId) {
            const threadId = state.activeMiniThreadId
            hideMiniPopover()
            focusThreadInSidebar(threadId)
        }
    })

    let pointerMoveThrottle = null
    articleRoot.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch') return
        const win = articleRoot?.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null)
        const selection = win?.getSelection?.()
        if (selection && !selection.isCollapsed) return
        if (!aiPopover.hidden || !composer.hidden) return

        if (pointerMoveThrottle) return
        pointerMoveThrottle = window.setTimeout(() => {
            pointerMoveThrottle = null
            const hit = findThreadAtPoint(event.clientX, event.clientY)
            if (hit) {
                articleRoot.style.cursor = 'pointer'
                if (state.activeMiniThreadId !== hit.thread.id || miniPopover.hidden) {
                    showMiniPopover(hit.thread, hit.range, event.clientX)
                }
            } else {
                articleRoot.style.cursor = ''
                if (!miniPopover.hidden) {
                    scheduleHideMiniPopover(200)
                }
            }
        }, 30)
    })

    articleRoot.addEventListener('click', event => {
        if (event.button !== 0) return
        const win = articleRoot?.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null)
        const selection = win?.getSelection?.()
        if (selection && !selection.isCollapsed) return
        const hit = findThreadAtPoint(event.clientX, event.clientY)
        if (hit) {
            if (window.innerWidth <= 720 || event.pointerType === 'touch') {
                if (state.activeMiniThreadId === hit.thread.id && !miniPopover.hidden) {
                    hideMiniPopover()
                    focusThreadInSidebar(hit.thread.id)
                } else {
                    showMiniPopover(hit.thread, hit.range, event.clientX)
                }
            } else {
                hideMiniPopover()
                focusThreadInSidebar(hit.thread.id)
            }
        }
    })

    composer.addEventListener('submit', async event => {
        event.preventDefault()
        if (!state.pendingAnchor) return

        composerError.textContent = ''
        composerIdentity.clearRecovery()
        setSaving(true)
        const submittedMode = composerIdentity.getMode()
        try {
            const data = await requestJson(
                `/api/shares/${encodeURIComponent(shareId)}/annotations`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(composerIdentity.buildPayload({
                        anchor: state.pendingAnchor,
                    })),
                },
            )
            if (data.thread?.messages?.[0]?.deleteToken) {
                storeDeleteToken(data.thread.messages[0].id, data.thread.messages[0].deleteToken)
            }
            state.threads.unshift(data.thread)
            composerIdentity.persistIfAnonymous()
            bodyInput.value = ''
            hideComposer()
            const win = articleRoot?.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : null)
            win?.getSelection?.()?.removeAllRanges()
            renderThreads()
        } catch (error) {
            if (submittedMode === 'signed' && error?.status === 401) {
                composerIdentity.showSessionExpiredPrompt()
            } else {
                composerError.textContent = error.status === 409 ? copy.stale : (error.message || copy.saveError)
            }
        } finally {
            setSaving(false)
        }
    })

    const timerApi = articleRoot?.ownerDocument?.defaultView || (typeof window !== 'undefined' ? window : globalThis)
    let selectionTimer = null
    document.addEventListener('selectionchange', () => {
        timerApi.clearTimeout(selectionTimer)
        selectionTimer = timerApi.setTimeout(captureSelection, 80)
    })
    articleRoot.addEventListener('pointerup', () => timerApi.setTimeout(captureSelection, 0))
    articleRoot.addEventListener('keyup', captureSelection)
    window.addEventListener('hashchange', locateThreadFromLocation)

    let highlightTimer = null
    const observer = new MutationObserver(() => {
        timerApi.clearTimeout(highlightTimer)
        highlightTimer = timerApi.setTimeout(() => {
            if (state.currentRevision) renderThreads()
        }, 120)
    })
    observer.observe(articleRoot, { childList: true, subtree: true })

    document.addEventListener('pointerdown', event => {
        if (event.button !== 0) return
        if (selectionToolbar.hidden && aiPopover.hidden && miniPopover.hidden) return
        if (
            selectionToolbar.contains(event.target)
            || aiPopover.contains(event.target)
            || miniPopover.contains(event.target)
            || panel.contains(event.target)
        ) {
            return
        }
        const hit = findThreadAtPoint(event.clientX, event.clientY)
        if (hit && hit.thread.id === state.activeMiniThreadId) return

        selectionToolbar.hidden = true
        aiPopover.hidden = true
        hideMiniPopover()
    })

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            if (!miniPopover.hidden) {
                hideMiniPopover()
            }
            if (!aiPopover.hidden) {
                aiPopover.hidden = true
            }
            if (!selectionToolbar.hidden) {
                selectionToolbar.hidden = true
            }
        }
    })

    loadThreads()
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initShareAnnotations(), { once: true })
    } else {
        initShareAnnotations()
    }
}
