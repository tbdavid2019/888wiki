/**
 * static/js/account-circle-picker.mjs
 * Reusable Private-First Bookmark & Share Circle Picker modal.
 * Always saves to private /_space first; public Share Circles are unchecked opt-in only.
 */
import { accountFetch, AccountApiError } from './account-auth.mjs'

const STYLE_ID = 'cf-circle-picker-style'
const MODAL_ID = 'cf-circle-picker-modal'

function ensurePickerStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
#${MODAL_ID} {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(15, 23, 42, 0.54);
    backdrop-filter: blur(4px);
}
#${MODAL_ID}[hidden] { display: none !important; }
#${MODAL_ID} .cp-dialog {
    width: min(480px, 100%);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    border-radius: 14px;
    padding: 20px;
    background: var(--modal-bg, var(--sp-surface, #ffffff));
    color: var(--modal-text, var(--sp-text, #1f2937));
    border: 1px solid var(--modal-border, var(--sp-border, #d1d5db));
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
    font-family: inherit;
}
#${MODAL_ID} .cp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
}
#${MODAL_ID} .cp-title { margin: 0; font-size: 17px; font-weight: 700; }
#${MODAL_ID} .cp-close {
    border: 1px solid var(--modal-border, var(--sp-border, #d1d5db));
    background: transparent;
    color: inherit;
    border-radius: 8px;
    width: 30px;
    height: 30px;
    cursor: pointer;
    font-size: 16px;
}
#${MODAL_ID} .cp-banner {
    padding: 10px 12px;
    border-radius: 9px;
    font-size: 13px;
    margin-bottom: 12px;
    border: 1px solid var(--modal-border, var(--sp-border, #d1d5db));
    background: var(--modal-surface, var(--sp-surface-muted, #f3f4f6));
}
#${MODAL_ID} .cp-banner.is-success {
    border-color: rgba(34, 197, 94, 0.45);
    background: rgba(34, 197, 94, 0.12);
}
#${MODAL_ID} .cp-banner.is-warn {
    border-color: rgba(245, 158, 11, 0.45);
    background: rgba(245, 158, 11, 0.14);
}
#${MODAL_ID} .cp-banner.is-error {
    border-color: rgba(239, 68, 68, 0.45);
    background: rgba(239, 68, 68, 0.12);
}
#${MODAL_ID} .cp-list {
    display: grid;
    gap: 8px;
    margin: 12px 0;
}
#${MODAL_ID} .cp-circle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 9px;
    border: 1px solid var(--modal-border, var(--sp-border, #d1d5db));
    cursor: pointer;
}
#${MODAL_ID} .cp-circle-left {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    flex: 1;
}
#${MODAL_ID} .cp-circle-name {
    font-weight: 600;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
#${MODAL_ID} .cp-pill {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid var(--modal-border, var(--sp-border, #d1d5db));
}
#${MODAL_ID} .cp-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 14px;
    flex-wrap: wrap;
}
#${MODAL_ID} .cp-btn {
    min-height: 34px;
    padding: 0 13px;
    border-radius: 8px;
    border: 1px solid var(--modal-border, var(--sp-border, #d1d5db));
    background: var(--modal-surface, var(--sp-surface-muted, #f3f4f6));
    color: inherit;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
}
#${MODAL_ID} .cp-btn-primary {
    background: var(--toolbar-accent, var(--sp-accent, #c8654b));
    border-color: var(--toolbar-accent, var(--sp-accent, #c8654b));
    color: var(--sp-accent-text, #ffffff);
}
#${MODAL_ID} .cp-btn:disabled { opacity: 0.52; cursor: not-allowed; }
`
    document.head.appendChild(style)
}

export async function bookmarkToPrivateSpace({
    shareId = '',
    notePath = '',
    noteUid = '',
    editorFormat = 'markdown',
    titleSummary = '',
} = {}) {
    return accountFetch('/api/space/bookmark', {
        method: 'POST',
        body: {
            ...(shareId ? { shareId: String(shareId) } : {}),
            ...(notePath ? { notePath: String(notePath) } : {}),
            ...(noteUid ? { noteUid: String(noteUid) } : {}),
            editorFormat: String(editorFormat || 'markdown'),
            titleSummary: String(titleSummary || ''),
        },
    })
}

export async function listUserCircles() {
    return accountFetch('/api/circles', { method: 'GET' })
}

export async function addItemToCircle(circleId, { itemKey = '', spaceItemId = '', shareId = '', notePath = '', noteUid = '' } = {}) {
    return accountFetch(`/api/circles/${encodeURIComponent(String(circleId))}/items`, {
        method: 'POST',
        body: {
            ...(itemKey ? { itemKey: String(itemKey) } : {}),
            ...(spaceItemId ? { spaceItemId: String(spaceItemId) } : {}),
            ...(shareId ? { shareId: String(shareId) } : {}),
            ...(notePath ? { notePath: String(notePath) } : {}),
            ...(noteUid ? { noteUid: String(noteUid) } : {}),
        },
    })
}

function getTexts(lang) {
    const isZh = lang !== 'en-US'
    return {
        isZh,
        title: isZh ? '收藏至私人空間與分享圈' : 'Bookmark to My Space & Circles',
        close: isZh ? '關閉' : 'Close',
        loading: isZh ? '正在檢查帳號與私人收藏...' : 'Checking account & saving private bookmark...',
        signInTitle: isZh ? '登入或建立 Passkey 帳號' : 'Sign in with Passkey',
        signInDesc: isZh ? '登入後即可將此筆記私密收藏至跨裝置「我的空間」，並可選擇性加入公開分享圈。' : 'Sign in to bookmark notes into your cross-device private Space and optionally share via Circles.',
        goToSpace: isZh ? '前往 /_space 登入' : 'Open /_space',
        disabledDesc: isZh ? '此部署目前未啟用帳號功能（純 KV 模式）。' : 'Passkey accounts are disabled in this deployment.',
        savedPrivate: isZh ? '已優先私密收藏至「我的空間」(/_space)。分享圈皆預設不勾選：' : 'Saved privately to My Space (/_space) first. Share Circles are unchecked by default:',
        noCircles: isZh ? '您尚未建立任何分享圈，可前往 /_space 建立。' : 'You have not created any Share Circles yet. Create one in /_space.',
        onLabel: 'ON',
        offLabel: 'OFF',
        addSelected: isZh ? '加入選取的分享圈' : 'Add to Selected Circles',
        adding: isZh ? '加入中...' : 'Adding...',
        done: isZh ? '完成' : 'Done',
        legacyIneligible: isZh ? '此筆記已私密收藏至 /_space，但無法加入公開分享圈（僅新版 CSPRNG 且未設閱讀鎖/封印/焚毀的公開分享可加入分享圈）。' : 'Saved privately to /_space, but ineligible for public Share Circles (requires a live public CSPRNG share without vpw/Seal/burn).',
        addedSuccess: count => isZh ? `已成功加入 ${count} 個分享圈。` : `Added to ${count} Share Circle(s).`,
        selectCirclePrompt: isZh ? '請先勾選至少一個分享圈，或直接點擊「完成」。' : 'Check at least one Share Circle, or click Done.',
    }
}

export function closeCirclePicker() {
    if (typeof document === 'undefined') return
    const modal = document.getElementById(MODAL_ID)
    if (modal) {
        modal.hidden = true
        modal.setAttribute('aria-hidden', 'true')
        modal.innerHTML = ''
    }
}

export async function openCirclePicker(options = {}) {
    if (typeof document === 'undefined') return null
    ensurePickerStyles()
    const lang = options.lang === 'en-US' ? 'en-US' : (document.documentElement.lang?.startsWith('en') ? 'en-US' : 'zh-TW')
    const t = getTexts(lang)

    let modal = document.getElementById(MODAL_ID)
    if (!modal) {
        modal = document.createElement('div')
        modal.id = MODAL_ID
        modal.setAttribute('role', 'dialog')
        modal.setAttribute('aria-modal', 'true')
        document.body.appendChild(modal)
    }

    const dialog = document.createElement('div')
    dialog.className = 'cp-dialog'

    const header = document.createElement('div')
    header.className = 'cp-header'
    const h2 = document.createElement('h2')
    h2.className = 'cp-title'
    h2.textContent = t.title
    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'cp-close'
    closeBtn.setAttribute('aria-label', t.close)
    closeBtn.textContent = '✕'
    header.append(h2, closeBtn)

    const body = document.createElement('div')
    const statusBox = document.createElement('div')
    statusBox.className = 'cp-banner'
    statusBox.textContent = t.loading
    body.appendChild(statusBox)

    dialog.append(header, body)
    modal.innerHTML = ''
    modal.appendChild(dialog)
    modal.hidden = false
    modal.setAttribute('aria-hidden', 'false')

    const onKeyDown = event => {
        if (event.key === 'Escape') {
            cleanup()
        }
    }
    const onBackdropClick = event => {
        if (event.target === modal) cleanup()
    }
    const cleanup = () => {
        document.removeEventListener('keydown', onKeyDown)
        modal.removeEventListener('click', onBackdropClick)
        closeCirclePicker()
        if (options.triggerEl && typeof options.triggerEl.focus === 'function') {
            options.triggerEl.focus()
        }
    }
    closeBtn.addEventListener('click', cleanup)
    document.addEventListener('keydown', onKeyDown)
    modal.addEventListener('click', onBackdropClick)

    try {
        const me = await accountFetch('/api/account/me', { method: 'GET' })
        if (!me || me.authenticated !== true) {
            statusBox.className = 'cp-banner is-warn'
            statusBox.textContent = t.signInDesc
            const actions = document.createElement('div')
            actions.className = 'cp-actions'
            const link = document.createElement('a')
            link.href = '/_space'
            link.className = 'cp-btn cp-btn-primary'
            link.textContent = t.goToSpace
            const cancel = document.createElement('button')
            cancel.type = 'button'
            cancel.className = 'cp-btn'
            cancel.textContent = t.close
            cancel.addEventListener('click', cleanup)
            actions.append(cancel, link)
            body.appendChild(actions)
            return { authenticated: false }
        }

        let spaceItem = options.spaceItem || null
        if (!options.skipAutoBookmark || !spaceItem?.itemKey) {
            const bookmarkRes = await bookmarkToPrivateSpace({
                shareId: options.shareId,
                notePath: options.notePath,
                noteUid: options.noteUid,
                editorFormat: options.editorFormat,
                titleSummary: options.titleSummary,
            })
            spaceItem = bookmarkRes?.item || bookmarkRes
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cf-notepad:space-bookmarked', {
                detail: {
                    itemKey: spaceItem?.itemKey || '',
                    shareId: spaceItem?.shareId || options.shareId || '',
                    accessLevel: spaceItem?.accessLevel || 'share_only',
                },
            }))
        }
        if (typeof options.onBookmarked === 'function') {
            options.onBookmarked(spaceItem)
        }

        statusBox.className = 'cp-banner is-success'
        statusBox.textContent = t.savedPrivate

        const circlesRes = await listUserCircles()
        const circles = Array.isArray(circlesRes?.circles) ? circlesRes.circles : (Array.isArray(circlesRes) ? circlesRes : [])

        const feedbackBox = document.createElement('div')
        feedbackBox.className = 'cp-banner'
        feedbackBox.hidden = true

        const listEl = document.createElement('div')
        listEl.className = 'cp-list'

        const checkboxes = []
        if (circles.length === 0) {
            const empty = document.createElement('p')
            empty.textContent = t.noCircles
            listEl.appendChild(empty)
        } else {
            for (const circle of circles) {
                const row = document.createElement('label')
                row.className = 'cp-circle-row'

                const left = document.createElement('span')
                left.className = 'cp-circle-left'

                const input = document.createElement('input')
                input.type = 'checkbox'
                input.value = String(circle.id)
                input.checked = false
                checkboxes.push(input)

                const nameSpan = document.createElement('span')
                nameSpan.className = 'cp-circle-name'
                nameSpan.textContent = String(circle.name || '')

                left.append(input, nameSpan)

                const right = document.createElement('span')
                right.style.display = 'inline-flex'
                right.style.gap = '6px'
                right.style.alignItems = 'center'

                const statusPill = document.createElement('span')
                statusPill.className = 'cp-pill'
                statusPill.textContent = circle.isEnabled ? t.onLabel : t.offLabel

                const countPill = document.createElement('span')
                countPill.className = 'cp-pill'
                countPill.textContent = `${Number(circle.itemCount || 0)}/200`

                right.append(statusPill, countPill)
                row.append(left, right)
                listEl.appendChild(row)
            }
        }

        const actions = document.createElement('div')
        actions.className = 'cp-actions'

        const doneBtn = document.createElement('button')
        doneBtn.type = 'button'
        doneBtn.className = 'cp-btn'
        doneBtn.textContent = t.done
        doneBtn.addEventListener('click', cleanup)
        actions.appendChild(doneBtn)

        if (circles.length > 0) {
            const addBtn = document.createElement('button')
            addBtn.type = 'button'
            addBtn.className = 'cp-btn cp-btn-primary'
            addBtn.textContent = t.addSelected
            addBtn.addEventListener('click', async () => {
                const selectedIds = checkboxes.filter(cb => cb.checked).map(cb => cb.value)
                if (selectedIds.length === 0) {
                    feedbackBox.className = 'cp-banner is-warn'
                    feedbackBox.textContent = t.selectCirclePrompt
                    feedbackBox.hidden = false
                    return
                }
                addBtn.disabled = true
                addBtn.textContent = t.adding
                let addedCount = 0
                let ineligibleError = null
                let otherError = null
                for (const cid of selectedIds) {
                    try {
                        await addItemToCircle(cid, {
                            itemKey: spaceItem?.itemKey || '',
                            spaceItemId: spaceItem?.id || '',
                            shareId: spaceItem?.shareId || options.shareId || '',
                            notePath: spaceItem?.accessLevel === 'edit' ? (spaceItem.notePath || options.notePath || '') : '',
                            noteUid: spaceItem?.accessLevel === 'edit' ? (spaceItem.noteUid || options.noteUid || '') : '',
                        })
                        addedCount += 1
                    } catch (err) {
                        if (err instanceof AccountApiError && (err.code === 'LEGACY_TOKEN_INELIGIBLE' || err.code === 'INELIGIBLE_NOTE' || err.status === 422)) {
                            ineligibleError = err
                        } else if (err instanceof AccountApiError && err.code === 'ALREADY_IN_CIRCLE') {
                            addedCount += 1
                        } else {
                            otherError = err
                        }
                    }
                }
                addBtn.disabled = false
                addBtn.textContent = t.addSelected

                if (ineligibleError) {
                    feedbackBox.className = 'cp-banner is-warn'
                    feedbackBox.textContent = t.legacyIneligible
                    feedbackBox.hidden = false
                } else if (otherError) {
                    feedbackBox.className = 'cp-banner is-error'
                    feedbackBox.textContent = otherError.message || 'Failed to add to circle.'
                    feedbackBox.hidden = false
                } else {
                    feedbackBox.className = 'cp-banner is-success'
                    feedbackBox.textContent = t.addedSuccess(addedCount)
                    feedbackBox.hidden = false
                    if (typeof options.onAddedToCircles === 'function') {
                        options.onAddedToCircles(selectedIds)
                    }
                }
            })
            actions.appendChild(addBtn)
        }

        body.append(listEl, feedbackBox, actions)
        return { authenticated: true, spaceItem }
    } catch (err) {
        if (err instanceof AccountApiError && (err.status === 401 || err.code === 'UNAUTHORIZED')) {
            statusBox.className = 'cp-banner is-warn'
            statusBox.textContent = t.signInDesc
            const actions = document.createElement('div')
            actions.className = 'cp-actions'
            const link = document.createElement('a')
            link.href = '/_space'
            link.className = 'cp-btn cp-btn-primary'
            link.textContent = t.goToSpace
            const cancel = document.createElement('button')
            cancel.type = 'button'
            cancel.className = 'cp-btn'
            cancel.textContent = t.close
            cancel.addEventListener('click', cleanup)
            actions.append(cancel, link)
            body.appendChild(actions)
            return { authenticated: false }
        }
        statusBox.className = 'cp-banner is-error'
        statusBox.textContent = (err instanceof AccountApiError && err.code === 'ACCOUNT_DISABLED')
            ? t.disabledDesc
            : (err?.message || 'Unable to bookmark note right now.')
        return { error: err }
    }
}
