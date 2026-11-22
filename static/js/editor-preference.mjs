export const EDITOR_PREFERENCE_STORAGE_KEY = 'cf-notepad:editor-preference'
export const EDITOR_SESSION_PREFERENCE_KEY = 'cf-notepad:editor-session-preference'
export const DEFAULT_EDITOR_FORMAT = 'markdown'

export const I18N_STRINGS = {
    'zh-TW': {
        title: '選擇你的編輯方式',
        description: '這會決定新筆記的預設方式，隨時可於底欄設定中切換。',
        markdownTitle: 'Markdown 編輯器',
        markdownBadge: '推薦預設',
        markdownDescription: '純文字高效寫作，支援即時雙向預覽、數學公式與快捷語法。',
        markdownAction: '以 Markdown 開始',
        blockTitle: '視覺化區塊 (Block)',
        blockBadge: 'Notion 風格',
        blockDescription: '所見即所得排版、拖拉區塊與 Slash 斜線指令。',
        blockAction: '以 Block 開始',
        canvasTitle: 'Canvas 畫布',
        canvasBadge: '結構化圖譜',
        canvasDescription: '邏輯關聯圖、知識圖譜與可連線卡片。',
        canvasAction: '以 Canvas 開始',
        whiteboardTitle: 'Whiteboard 白板',
        whiteboardBadge: '自由手繪',
        whiteboardDescription: '自由畫筆、箭頭、便籤與 Excalidraw 相容白板。',
        whiteboardAction: '以 Whiteboard 開始',
        remember: '記住我的選擇',
        cancel: '取消',
        confirm: '確定',
    },
    'en-US': {
        title: 'Choose your editor',
        description: 'This sets your default for new notes. You can change it anytime in settings.',
        markdownTitle: 'Markdown editor',
        markdownBadge: 'Recommended',
        markdownDescription: 'Fast plain-text writing with live side-by-side preview and math formulas.',
        markdownAction: 'Start with Markdown',
        blockTitle: 'Visual Block editor',
        blockBadge: 'Notion style',
        blockDescription: 'What-you-see-is-what-you-get, drag handles, and slash commands.',
        blockAction: 'Start with Block',
        canvasTitle: 'Canvas workspace',
        canvasBadge: 'Structured graph',
        canvasDescription: 'Connected cards for logic maps, knowledge graphs, and architecture diagrams.',
        canvasAction: 'Start with Canvas',
        whiteboardTitle: 'Whiteboard',
        whiteboardBadge: 'Freeform drawing',
        whiteboardDescription: 'Freehand drawing, arrows, sticky notes, and Excalidraw compatibility.',
        whiteboardAction: 'Start with Whiteboard',
        remember: 'Remember my choice',
        cancel: 'Cancel',
        confirm: 'Save',
    }
}

const isEditorFormat = value => ['block', 'markdown', 'canvas', 'whiteboard'].includes(value)

const storageGet = (storage, key) => {
    try { return storage?.getItem(key) || '' } catch { return '' }
}

const storageSet = (storage, key, value) => {
    try { storage?.setItem(key, value) } catch {}
}

const storageRemove = (storage, key) => {
    try { storage?.removeItem(key) } catch {}
}

export function hasEditorPreference(windowRef = window) {
    const remembered = storageGet(windowRef.localStorage, EDITOR_PREFERENCE_STORAGE_KEY)
    return isEditorFormat(remembered)
}

export function getEditorPreference(windowRef = window) {
    const remembered = storageGet(windowRef.localStorage, EDITOR_PREFERENCE_STORAGE_KEY)
    if (isEditorFormat(remembered)) return { format: remembered, remembered: true }

    return { format: DEFAULT_EDITOR_FORMAT, remembered: false }
}

export function saveEditorPreference(format, { remember = false, windowRef = window } = {}) {
    if (!isEditorFormat(format)) throw new TypeError('Invalid editor format')
    if (remember) storageSet(windowRef.localStorage, EDITOR_PREFERENCE_STORAGE_KEY, format)
    else storageRemove(windowRef.localStorage, EDITOR_PREFERENCE_STORAGE_KEY)
    return { format, remembered: remember }
}

const getFocusable = modal => [...modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hidden && !element.closest('[hidden]'))

export function initializeEditorPreference(documentRef = document, windowRef = window, { navigate } = {}) {
    const modal = documentRef.querySelector('[data-editor-preference-dialog]')
    const primaryLinks = [...documentRef.querySelectorAll('#new-note-link')]
    const settingsButtons = [...documentRef.querySelectorAll('#editor-preference-btn')]
    const goToNewNote = navigate || (format => windowRef.location.assign(`/new/${format}`))

    const applyPrimaryLink = format => {
        primaryLinks.forEach(link => link.setAttribute('href', `/new/${format}`))
    }
    const requirePrimaryChoice = () => {
        primaryLinks.forEach(link => {
            link.setAttribute('href', '#choose-editor')
            link.dataset.editorPreferenceRequired = 'true'
        })
    }

    const currentPreference = () => getEditorPreference(windowRef)
    if (hasEditorPreference(windowRef)) applyPrimaryLink(currentPreference().format)
    else requirePrimaryChoice()
    if (!modal) return { open: () => {}, close: () => {}, getPreference: currentPreference }

    const form = modal.querySelector('[data-editor-preference-form]')
    const rememberInput = modal.querySelector('[data-editor-preference-remember]')
    const closeButtons = [...modal.querySelectorAll('[data-editor-preference-close]')]
    const options = [...modal.querySelectorAll('input[name="editor-format"]')]
    const cardActions = [...modal.querySelectorAll('[data-editor-format-choice]')]
    const langButtons = [...modal.querySelectorAll('[data-editor-pref-lang]')]
    const autoOpen = modal.dataset.editorPreferenceAutoOpen === 'true'
    let trigger = null
    let keyHandler = null
    let pendingNewNote = false

    const updateModalLanguage = (newLang) => {
        const dict = I18N_STRINGS[newLang] || I18N_STRINGS['zh-TW']
        modal.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.dataset.i18nKey
            if (dict[key]) el.textContent = dict[key]
        })
        langButtons.forEach(btn => {
            const isActive = btn.dataset.editorPrefLang === newLang
            btn.classList.toggle('is-active', isActive)
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false')
        })
        storageSet(windowRef.localStorage, 'cf-notepad:lang', newLang)
        if (windowRef.APP_STATE) windowRef.APP_STATE.lang = newLang
    }
    langButtons.forEach(btn => {
        btn.addEventListener('click', event => {
            event.preventDefault()
            const newLang = btn.dataset.editorPrefLang || 'zh-TW'
            updateModalLanguage(newLang)
        })
    })

    const selectedFormat = () => options.find(option => option.checked)?.value || DEFAULT_EDITOR_FORMAT
    const syncOptionState = () => options.forEach(option => {
        option.closest('.editor-preference-option')?.classList.toggle('is-selected', option.checked)
    })
    const fill = preference => {
        const option = options.find(item => item.value === preference.format) || options.find(item => item.value === DEFAULT_EDITOR_FORMAT)
        if (option) option.checked = true
        if (rememberInput) rememberInput.checked = preference.remembered
        syncOptionState()
    }
    const close = ({ restoreFocus = true } = {}) => {
        if (autoOpen) return
        modal.style.display = 'none'
        modal.setAttribute('aria-hidden', 'true')
        if (keyHandler) modal.removeEventListener('keydown', keyHandler)
        keyHandler = null
        pendingNewNote = false
        if (restoreFocus && trigger?.isConnected) trigger.focus()
        trigger = null
    }
    const open = ({ opener = documentRef.activeElement, startNewNote = false } = {}) => {
        trigger = opener
        pendingNewNote = startNewNote
        fill(currentPreference())
        modal.style.display = 'block'
        modal.setAttribute('aria-hidden', 'false')
        keyHandler = event => {
            if (event.key === 'Escape' && !autoOpen) {
                event.preventDefault()
                close()
                return
            }
            if (event.key !== 'Tab') return
            const focusable = getFocusable(modal)
            if (!focusable.length) return
            const first = focusable[0]
            const last = focusable.at(-1)
            if (event.shiftKey && documentRef.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && documentRef.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }
        modal.addEventListener('keydown', keyHandler)
        windowRef.setTimeout(() => (modal.querySelector('[data-editor-preference-confirm]') || getFocusable(modal)[0])?.focus(), 0)
    }

    options.forEach(option => option.addEventListener('change', syncOptionState))
    cardActions.forEach(button => button.addEventListener('click', event => {
        event.preventDefault()
        const format = button.dataset.editorFormatChoice || DEFAULT_EDITOR_FORMAT
        const option = options.find(item => item.value === format)
        if (option) option.checked = true
        syncOptionState()
        const preference = saveEditorPreference(format, {
            remember: rememberInput?.checked === true,
            windowRef,
        })
        applyPrimaryLink(preference.format)
        if (autoOpen || pendingNewNote) {
            pendingNewNote = false
            goToNewNote(preference.format)
        } else {
            close()
        }
    }))
    primaryLinks.forEach(link => link.addEventListener('click', event => {
        if (hasEditorPreference(windowRef)) return
        event.preventDefault()
        open({ opener: link, startNewNote: true })
    }))
    settingsButtons.forEach(button => button.addEventListener('click', event => {
        event.preventDefault()
        open({ opener: button })
    }))
    closeButtons.forEach(button => button.addEventListener('click', () => close()))
    form?.addEventListener('submit', event => {
        event.preventDefault()
        const preference = saveEditorPreference(selectedFormat(), {
            remember: rememberInput?.checked === true,
            windowRef,
        })
        applyPrimaryLink(preference.format)
        if (autoOpen || pendingNewNote) {
            pendingNewNote = false
            goToNewNote(preference.format)
        }
        else close()
    })

    if (autoOpen) {
        const preference = currentPreference()
        if (preference.remembered) goToNewNote(preference.format)
        else open({ opener: null })
    }

    return { open, close, getPreference: currentPreference }
}

if (typeof document !== 'undefined') {
    const start = () => initializeEditorPreference()
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true })
    else start()
}
