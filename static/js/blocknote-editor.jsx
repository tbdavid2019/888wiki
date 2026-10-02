import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BlockNoteSchema } from '@blocknote/core'
import { en, zhTW } from '@blocknote/core/locales'
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions'
import { SuggestionMenuController, createReactBlockSpec, getDefaultReactSlashMenuItems, useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { blockNoteToTiptapDocument, tiptapToBlockNoteDocument } from '../../src/blocknote_document.mjs'
import { checkAsrHealth, initDictationController } from './dictation-service.mjs'

const root = document.querySelector('#block-editor')
const source = document.querySelector('#contents')
if (!root || !source) throw new Error('BlockNote editor requires #block-editor and #contents')

const resolveBlockNoteTheme = () => {
    const selectedTheme = document.documentElement.getAttribute('data-ui-theme')
    if (selectedTheme === 'dark') return 'dark'
    if (selectedTheme === 'light') return 'light'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function useBlockNoteTheme() {
    const [theme, setTheme] = useState(resolveBlockNoteTheme)

    useEffect(() => {
        const syncTheme = () => setTheme(resolveBlockNoteTheme())
        const rootThemeObserver = new MutationObserver(syncTheme)
        const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
        rootThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui-theme'] })
        mediaQuery?.addEventListener?.('change', syncTheme)
        window.addEventListener('cf-notepad-ui-theme-change', syncTheme)
        return () => {
            rootThemeObserver.disconnect()
            mediaQuery?.removeEventListener?.('change', syncTheme)
            window.removeEventListener('cf-notepad-ui-theme-change', syncTheme)
        }
    }, [])

    return theme
}

const resolveBlockNoteLang = () => {
    const htmlLang = document.documentElement.getAttribute('lang')
    if (htmlLang && htmlLang.startsWith('zh')) return 'zh-TW'
    if (typeof window !== 'undefined' && window.APP_STATE?.lang) {
        return window.APP_STATE.lang
    }
    return 'en-US'
}

function useBlockNoteLang() {
    const [lang, setLang] = useState(resolveBlockNoteLang)

    useEffect(() => {
        const syncLang = () => setLang(resolveBlockNoteLang())
        const observer = new MutationObserver(syncLang)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
        window.addEventListener('cf-notepad-lang-change', syncLang)
        return () => {
            observer.disconnect()
            window.removeEventListener('cf-notepad-lang-change', syncLang)
        }
    }, [])

    return lang
}

const ZH_TW_DICTIONARY = {
    generic: {
        ctrl_shortcut: 'Ctrl',
    },
    slash_menu: {
        heading: {
            title: '一級標題 (Heading 1)',
            subtext: '主要大標題',
            aliases: ['h1', 'heading1', '標題1', '一級標題', '大標題', 'h'],
            group: '標題',
        },
        heading_2: {
            title: '二級標題 (Heading 2)',
            subtext: '章節段落標題',
            aliases: ['h2', 'heading2', '標題2', '二級標題', '中標題'],
            group: '標題',
        },
        heading_3: {
            title: '三級標題 (Heading 3)',
            subtext: '次分組子標題',
            aliases: ['h3', 'heading3', '標題3', '三級標題', '小標題'],
            group: '標題',
        },
        heading_4: {
            title: '四級標題 (Heading 4)',
            subtext: '四級子標題',
            aliases: ['h4', 'heading4', '標題4'],
            group: '次標題',
        },
        heading_5: {
            title: '五級標題 (Heading 5)',
            subtext: '五級子標題',
            aliases: ['h5', 'heading5', '標題5'],
            group: '次標題',
        },
        heading_6: {
            title: '六級標題 (Heading 6)',
            subtext: '六級小標題',
            aliases: ['h6', 'heading6', '標題6'],
            group: '次標題',
        },
        toggle_heading: {
            title: '摺疊一級標題',
            subtext: '可收合子內容的一級大標題',
            aliases: ['h1', 'toggleheading', '摺疊標題'],
            group: '次標題',
        },
        toggle_heading_2: {
            title: '摺疊二級標題',
            subtext: '可收合子內容的二級中標題',
            aliases: ['h2', 'toggleheading2', '摺疊標題2'],
            group: '次標題',
        },
        toggle_heading_3: {
            title: '摺疊三級標題',
            subtext: '可收合子內容的三級小標題',
            aliases: ['h3', 'toggleheading3', '摺疊標題3'],
            group: '次標題',
        },
        quote: {
            title: '引用 (Quote)',
            subtext: '重點引文或金句摘錄',
            aliases: ['quote', 'blockquote', 'bq', '引用', '摘錄', '金句'],
            group: '基本區塊',
        },
        toggle_list: {
            title: '摺疊清單 (Toggle List)',
            subtext: '可展開或隱藏子項目的清單',
            aliases: ['toggle', 'togglelist', '摺疊', '折疊', '收合', '展開', '清單'],
            group: '基本區塊',
        },
        numbered_list: {
            title: '編號清單 (Numbered List)',
            subtext: '自動編號的順序清單',
            aliases: ['number', 'numbered', 'ol', '數字清單', '有序清單', '編號'],
            group: '基本區塊',
        },
        bullet_list: {
            title: '項目清單 (Bullet List)',
            subtext: '無序圓點大綱清單，支援 Tab 縮排',
            aliases: ['bullet', 'list', 'ul', '項目清單', '圓點清單', '圓點', '大綱'],
            group: '基本區塊',
        },
        check_list: {
            title: '待辦清單 (Checklist)',
            subtext: '可勾選、支援 Tab 縮排與階層的待辦事項',
            aliases: ['todo', 'task', 'checklist', 'check', '待辦', '待辦清單', '清單', '核取方塊', '勾選', 'tasks'],
            group: '基本區塊',
        },
        paragraph: {
            title: '段落內文 (Paragraph)',
            subtext: '一般文章文字段落',
            aliases: ['p', 'paragraph', 'text', '段落', '內文', '文字'],
            group: '基本區塊',
        },
        code_block: {
            title: '程式碼區塊 (Code Block)',
            subtext: '帶語法高亮的程式碼區塊',
            aliases: ['code', 'codeblock', 'pre', '程式碼', '代碼', '區塊代碼'],
            group: '基本區塊',
        },
        divider: {
            title: '分隔線 (Divider)',
            subtext: '水平視覺分隔線條',
            aliases: ['divider', 'hr', 'line', '分隔線', '水平線'],
            group: '基本區塊',
        },
        table: {
            title: '表格 (Table)',
            subtext: '結構化多欄多列表格',
            aliases: ['table', 'grid', '表格', '表單'],
            group: '進階區塊',
        },
        image: {
            title: '圖片 (Image)',
            subtext: '可縮放圖片與圖說',
            aliases: ['image', 'img', 'picture', '圖片', '照片', '上傳圖片'],
            group: '多媒體',
        },
        video: {
            title: '影片 (Video)',
            subtext: '嵌入或上傳影片',
            aliases: ['video', 'mp4', '影片', '視頻'],
            group: '多媒體',
        },
        audio: {
            title: '音訊 (Audio)',
            subtext: '嵌入或上傳音訊檔案',
            aliases: ['audio', 'sound', 'mp3', '音訊', '音樂'],
            group: '多媒體',
        },
        file: {
            title: '檔案附件 (File)',
            subtext: '嵌入可下載檔案連結',
            aliases: ['file', 'attachment', '檔案', '附件'],
            group: '多媒體',
        },
        emoji: {
            title: '表情符號 (Emoji)',
            subtext: '搜尋並插入 Emoji 表情',
            aliases: ['emoji', '表情', '符號'],
            group: '其他',
        },
    },
    placeholders: {
        default: "輸入文字，或輸入 '/' 呼叫指令...",
        heading: '標題',
        toggleListItem: '摺疊項目',
        bulletListItem: '清單項目',
        numberedListItem: '清單項目',
        checkListItem: '待辦事項',
        new_comment: '撰寫留言...',
        edit_comment: '編輯留言...',
        comment_reply: '回覆留言...',
    },
    side_menu: {
        add_block_label: '新增區塊',
        drag_handle_label: '開啟區塊選單 / 拖曳排序',
    },
    drag_handle: {
        delete_menuitem: '刪除區塊',
        colors_menuitem: '色彩設定',
        header_row_menuitem: '設定為標頭列',
        header_column_menuitem: '設定為標頭欄',
    },
    table_handle: {
        delete_column_menuitem: '刪除此欄',
        delete_row_menuitem: '刪除此列',
        add_left_menuitem: '向左插入欄',
        add_right_menuitem: '向右插入欄',
        add_above_menuitem: '向上插入列',
        add_below_menuitem: '向下插入列',
        split_cell_menuitem: '分割儲存格',
        merge_cells_menuitem: '合併儲存格',
        background_color_menuitem: '背景顏色',
    },
    suggestion_menu: {
        no_items_title: '找不到相符項目',
    },
    color_picker: {
        text_title: '文字顏色',
        background_title: '背景顏色',
        colors: {
            default: '預設',
            gray: '灰色',
            brown: '棕色',
            red: '紅色',
            orange: '橘色',
            yellow: '黃色',
            green: '綠色',
            blue: '藍色',
            purple: '紫色',
            pink: '粉紅',
        },
    },
    formatting_toolbar: {
        bold: { tooltip: '粗體', secondary_tooltip: 'Mod+B' },
        italic: { tooltip: '斜體', secondary_tooltip: 'Mod+I' },
        underline: { tooltip: '底線', secondary_tooltip: 'Mod+U' },
        strike: { tooltip: '刪除線', secondary_tooltip: 'Mod+Shift+S' },
        code: { tooltip: '行內程式碼', secondary_tooltip: '' },
        colors: { tooltip: '文字與背景顏色' },
        link: { tooltip: '插入超連結', secondary_tooltip: 'Mod+K' },
        nest: { tooltip: '向內縮排 (降級)', secondary_tooltip: 'Tab' },
        unnest: { tooltip: '向外縮排 (升級)', secondary_tooltip: 'Shift+Tab' },
        align_left: { tooltip: '靠左對齊' },
        align_center: { tooltip: '置中對齊' },
        align_right: { tooltip: '靠右對齊' },
        align_justify: { tooltip: '左右對齊' },
        table_cell_merge: { tooltip: '合併儲存格' },
        comment: { tooltip: '新增註解' },
    },
    link_toolbar: {
        delete: { tooltip: '移除連結' },
        edit: { text: '編輯連結', tooltip: '編輯' },
        open: { tooltip: '在新分頁開啟' },
        form: { title_placeholder: '編輯標題', url_placeholder: '編輯網址' },
    },
    file_panel: {
        upload: { title: '上傳', upload_error: '錯誤：上傳失敗' },
        embed: { title: '嵌入網址', url_placeholder: '輸入網址...' },
    },
}

function deepMergeDictionary(target, override) {
    if (!override) return target
    const result = { ...target }
    for (const key of Object.keys(override)) {
        if (
            override[key] &&
            typeof override[key] === 'object' &&
            !Array.isArray(override[key])
        ) {
            result[key] = deepMergeDictionary(target?.[key] || {}, override[key])
        } else if (override[key] !== undefined) {
            result[key] = override[key]
        }
    }
    return result
}

const RESOLVED_ZH_TW_DICTIONARY = deepMergeDictionary(
    deepMergeDictionary(en, zhTW),
    ZH_TW_DICTIONARY,
)

const getEmbedKinds = isZh => ({
    youtube: { title: 'YouTube', detail: isZh ? '嵌入 YouTube 影片' : 'Embed YouTube video', icon: '▶' },
    pdf: { title: isZh ? 'PDF 文件' : 'PDF', detail: isZh ? '嵌入 PDF 文件閱覽器' : 'Embed PDF document viewer', icon: 'PDF' },
    file: { title: isZh ? '附件連結' : 'File Attachment', detail: isZh ? '插入檔案或多媒體網址' : 'Insert downloadable file URL', icon: '↗' },
    audio: { title: isZh ? '音訊播放器' : 'Audio Player', detail: isZh ? '播放錄音或音訊檔案' : 'Play audio or voice recording', icon: '🎙️' },
    mermaid: { title: isZh ? 'Mermaid 流程圖' : 'Mermaid Diagram', detail: isZh ? '繪製架構圖與流程圖' : 'Render flowcharts and diagrams', icon: '◇' },
    echarts: { title: isZh ? 'ECharts 互動圖表' : 'ECharts Chart', detail: isZh ? '插入 JSON 互動圖表' : 'Render interactive JSON chart', icon: '▥' },
    raw: { title: isZh ? 'HTML 原始碼' : 'Raw HTML', detail: isZh ? '以安全文字保留 HTML' : 'Preserve raw HTML safely', icon: '</>' },
    slideBreak: { title: isZh ? '簡報換頁' : 'Slide Break', detail: isZh ? '開始下一張投影片 (---)' : 'Start next presentation slide (---)', icon: '—' },
})

const EMBED_PROP_SCHEMA = {
    kind: { default: 'file', values: ['image', 'file', 'youtube', 'pdf', 'mermaid', 'echarts', 'raw', 'slideBreak', 'audio'] },
    url: { default: '' }, title: { default: '' }, name: { default: '' }, alt: { default: '' }, src: { default: '' },
    source: { default: '' }, optionJson: { default: '' }, content: { default: '' }, mimeType: { default: '' }, width: { default: '' }, audioId: { default: '' },
}

const DavidEmbed = createReactBlockSpec({
    type: 'davidEmbed',
    propSchema: EMBED_PROP_SCHEMA,
    content: 'none',
}, {
    render: ({ block }) => {
        const props = block.props
        const kind = props.kind || 'file'
        const isZh = resolveBlockNoteLang() === 'zh-TW'
        const embedKinds = getEmbedKinds(isZh)
        const label = embedKinds[kind]?.title || (kind === 'image' ? (isZh ? '圖片' : 'Image') : (isZh ? '嵌入內容' : 'Embedded content'))
        const preview = kind === 'image' && props.src
            ? <img src={props.src} alt={props.alt || ''} />
            : (kind === 'audio' || (kind === 'file' && (props.mimeType?.startsWith('audio/') || props.url?.match(/\.(mp3|wav|ogg|m4a|webm|aac|flac)$/i))))
                ? <div className="david-blocknote-audio-wrap">
                    <audio controls src={props.url || props.src} style={{ width: '100%', maxWidth: '100%', marginTop: '6px' }} />
                    {props.name && <div style={{ fontSize: '12px', color: 'var(--text-muted, #888)', marginTop: '4px' }}>🎙️ {props.name}</div>}
                  </div>
                : kind === 'youtube' && props.url
                    ? <span>{props.title || props.url}</span>
                    : kind === 'pdf' && props.url
                        ? <span>{props.title || props.url}</span>
                        : kind === 'mermaid'
                            ? <pre>{props.source}</pre>
                            : kind === 'echarts'
                                ? <pre>{props.optionJson}</pre>
                                : kind === 'raw'
                                    ? <pre>{props.content}</pre>
                                    : <span>{props.title || props.name || props.url || (isZh ? '尚未設定內容' : 'No content configured')}</span>
        return <section className="david-blocknote-embed" data-kind={kind} contentEditable={false}>
            <header><strong>{label}</strong><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('david-blocknote-edit', { detail: { block } }))}>{isZh ? '編輯' : 'Edit'}</button></header>
            <div className="david-blocknote-embed-preview">{preview}</div>
        </section>
    },
})

const schema = BlockNoteSchema.create().extend({ blockSpecs: { davidEmbed: DavidEmbed() } })

const inlineContentToText = content => {
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return ''
    return content.map(item => {
        if (typeof item === 'string') return item
        if (item?.type === 'link') return inlineContentToText(item.content)
        return typeof item?.text === 'string' ? item.text : ''
    }).join('')
}

const normalizeImportedBlocks = blocks => blocks.flatMap(block => {
    if (block?.type === 'audio') {
        return [{ type: 'davidEmbed', props: { kind: 'audio', url: block.props?.url, name: block.props?.name } }]
    }
    if (block?.type !== 'codeBlock') return [block]

    const language = String(block.props?.language || '').trim().toLowerCase()
    if (!['mermaid', 'echarts', 'html'].includes(language)) return [block]

    const sourceText = inlineContentToText(block.content)
    if (language === 'mermaid') return [{ type: 'davidEmbed', props: { kind: 'mermaid', source: sourceText } }]
    if (language === 'echarts') return [{ type: 'davidEmbed', props: { kind: 'echarts', optionJson: sourceText } }]
    if (language === 'html') {
        const audioMatch = sourceText.match(/<audio[^>]*src="([^"]+)"[^>]*>/i)
        if (audioMatch) {
            const idMatch = sourceText.match(/data-offline-audio-id="([^"]+)"/i)
            return [{ type: 'davidEmbed', props: { kind: 'audio', url: audioMatch[1], audioId: idMatch ? idMatch[1] : '' } }]
        }
    }
    return [{ type: 'davidEmbed', props: { kind: 'raw', content: sourceText } }]
})

const safeHttpUrl = value => {
    try {
        const url = new URL(String(value || '').trim())
        return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
        return false
    }
}

async function uploadFile(file) {
    const isZh = resolveBlockNoteLang() === 'zh-TW'
    if (file.type.startsWith('image/')) {
        const form = new FormData()
        form.append('image', file)
        const response = await fetch('/upload', { method: 'POST', body: form })
        const payload = await response.json()
        if (!response.ok || payload?.err !== 0 || !payload?.data) throw new Error(payload?.msg || (isZh ? '圖片上傳失敗' : 'Image upload failed'))
        return payload.data
    }
    let lastError
    for (const endpoint of ['https://box.david888.com/api.php?action=upload', 'https://box.aiurl.tw/api.php?action=upload', 'https://box.glsoft.ai/api.php?action=upload']) {
        try {
            const form = new FormData()
            form.append('file', file)
            const response = await fetch(endpoint, { method: 'POST', body: form })
            const payload = await response.json()
            const url = payload?.url || payload?.data?.url
            if (!response.ok || payload?.result !== 'success' || !url) throw new Error(payload?.message || (isZh ? '附件上傳失敗' : 'Attachment upload failed'))
            return url
        } catch (error) {
            lastError = error
        }
    }
    throw lastError || new Error(isZh ? '附件上傳失敗' : 'Attachment upload failed')
}

function EmbedDialog({ state, editor, onClose, isZh = true }) {
    const [error, setError] = useState('')
    const [draft, setDraft] = useState(() => ({ ...state.block?.props, kind: state.kind }))
    const cardRef = useRef(null)
    const kind = state.kind
    const embedKinds = getEmbedKinds(isZh)
    const label = embedKinds[kind]?.title || kind
    const isCode = ['mermaid', 'echarts', 'raw'].includes(kind)

    useEffect(() => {
        const card = cardRef.current
        const previousFocus = document.activeElement
        const focusable = () => [...card?.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled])') || []]
        const first = focusable()[0]
        first?.focus()
        const onKeyDown = event => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
            if (event.key !== 'Tab') return
            const items = focusable()
            if (!items.length) return
            if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus() }
            else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus() }
        }
        card?.addEventListener('keydown', onKeyDown)
        return () => {
            card?.removeEventListener('keydown', onKeyDown)
            if (previousFocus?.isConnected) previousFocus.focus()
        }
    }, [onClose])

    const submit = event => {
        event.preventDefault()
        const value = isCode ? String(draft.source || draft.optionJson || draft.content || '').trim() : String(draft.url || '').trim()
        if (!isCode && kind !== 'slideBreak' && !safeHttpUrl(value)) return setError(isZh ? '請輸入有效的 http 或 https 網址。' : 'Please enter a valid http or https URL.')
        if (kind === 'mermaid' && !String(draft.source || '').trim()) return setError(isZh ? 'Mermaid 語法不可空白。' : 'Mermaid source code cannot be empty.')
        if (kind === 'raw' && !String(draft.content || '').trim()) return setError(isZh ? 'HTML 原始碼不可空白。' : 'Raw HTML content cannot be empty.')
        if (kind === 'echarts') {
            try {
                const option = JSON.parse(draft.optionJson || '')
                if (!option || Array.isArray(option) || typeof option !== 'object') throw new Error('invalid')
            } catch { return setError(isZh ? '請輸入有效的 ECharts option JSON 物件。' : 'Please enter a valid ECharts option JSON object.') }
        }
        editor.updateBlock(state.block, { props: { ...state.block.props, ...draft, kind } })
        onClose()
    }

    return <div className="david-blocknote-dialog" role="dialog" aria-modal="true" aria-labelledby="david-blocknote-dialog-title">
        <div className="david-blocknote-dialog-backdrop" onClick={onClose} />
        <form ref={cardRef} className="david-blocknote-dialog-card" onSubmit={submit}>
            <header><h2 id="david-blocknote-dialog-title">{isZh ? ('設定 ' + label) : ('Configure ' + label)}</h2><button type="button" onClick={onClose} aria-label={isZh ? '關閉' : 'Close'}>×</button></header>
            {isCode ? <label>
                <span>{kind === 'mermaid' ? (isZh ? 'Mermaid 語法' : 'Mermaid Syntax') : kind === 'echarts' ? (isZh ? 'ECharts option JSON' : 'ECharts option JSON') : (isZh ? 'HTML 原始碼' : 'Raw HTML')}</span>
                <textarea value={kind === 'mermaid' ? draft.source : kind === 'echarts' ? draft.optionJson : draft.content} onChange={event => setDraft(current => ({ ...current, [kind === 'mermaid' ? 'source' : kind === 'echarts' ? 'optionJson' : 'content']: event.target.value }))} rows="10" />
            </label> : <>
                {kind !== 'slideBreak' && <label><span>{isZh ? '網址' : 'URL'}</span><input type="url" inputMode="url" value={draft.url || ''} onChange={event => setDraft(current => ({ ...current, url: event.target.value }))} placeholder="https://" /></label>}
                {kind !== 'slideBreak' && <label><span>{isZh ? '標題（可留空）' : 'Title (optional)'}</span><input value={draft.title || ''} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></label>}
            </>}
            <p className="david-blocknote-dialog-error" aria-live="polite">{error}</p>
            <footer><button type="button" onClick={onClose}>{isZh ? '取消' : 'Cancel'}</button><button type="submit">{isZh ? '儲存' : 'Save'}</button></footer>
        </form>
    </div>
}

class BlockNoteErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('BlockNote editor runtime error caught:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="david-blocknote-error-fallback" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-color, #333)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                        {this.props.isZh ? '區塊編輯器遇到暫時性錯誤' : 'Block Editor encountered a temporary error'}
                    </h3>
                    <p style={{ color: 'var(--text-muted, #888)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 16px', wordBreak: 'break-word' }}>
                        {this.state.error?.message || (this.props.isZh ? '請點擊下方按鈕重新載入或重整網頁。' : 'Please click below to retry or refresh the page.')}
                    </p>
                    <button
                        type="button"
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            padding: '8px 18px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color, #ccc)',
                            background: 'var(--bg-secondary, #eee)',
                            color: 'inherit',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        {this.props.isZh ? '重試載入' : 'Retry'}
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

function BlockNoteEditorApp() {
    const initialContent = useMemo(() => {
        try { return tiptapToBlockNoteDocument(JSON.parse(source.value || '{}')) } catch { return [{ type: 'paragraph' }] }
    }, [])
    const [dialog, setDialog] = useState(null)
    const blockNoteTheme = useBlockNoteTheme()
    const blockNoteLang = useBlockNoteLang()
    const isZh = blockNoteLang === 'zh-TW'
    const dictionary = useMemo(() => isZh ? RESOLVED_ZH_TW_DICTIONARY : en, [isZh])
    const editor = useCreateBlockNote({
        schema,
        initialContent,
        uploadFile,
        dictionary,
        tables: { headers: true, splitCells: true, cellBackgroundColor: true, cellTextColor: true },
    })

    const save = () => {
        source.value = JSON.stringify(blockNoteToTiptapDocument(editor.document))
        source.dispatchEvent(new Event('input', { bubbles: true }))
    }

    const [isAsrOnline, setIsAsrOnline] = useState(false)

    useEffect(() => {
        let unmounted = false
        const probe = async () => {
            const online = await checkAsrHealth({ timeout: 2000 })
            if (!unmounted) setIsAsrOnline(online)
        }
        probe()
        const timer = setInterval(probe, 60000)
        const onVisibility = () => {
            if (document.visibilityState === 'visible') probe()
        }
        document.addEventListener('visibilitychange', onVisibility)
        window.addEventListener('online', probe)
        window.addEventListener('offline', () => {
            if (!unmounted) setIsAsrOnline(false)
        })
        return () => {
            unmounted = true
            clearInterval(timer)
            document.removeEventListener('visibilitychange', onVisibility)
            window.removeEventListener('online', probe)
            window.removeEventListener('offline', () => setIsAsrOnline(false))
        }
    }, [])

    useEffect(() => {
        let docSnapshot = null
        const controller = initDictationController(document, {
            lang: isZh ? 'zh-TW' : 'en-US',
            onStart: () => {
                docSnapshot = JSON.stringify(editor.document)
                if (typeof editor.focus === 'function') {
                    try { editor.focus() } catch {}
                }
                const cursor = editor.getTextCursorPosition?.()
                if (!cursor?.block) {
                    const lastBlock = editor.document.at(-1)
                    if (lastBlock) {
                        try { editor.setTextCursorPosition(lastBlock, 'end') } catch {}
                    }
                }
            },
            onText: (text) => {
                if (!text) return
                try {
                    editor.insertInlineContent(text)
                    save()
                } catch (err) {
                    console.error('BlockNote dictation insert error:', err)
                }
            },
            onCancel: () => {
                if (docSnapshot) {
                    try {
                        const parsed = JSON.parse(docSnapshot)
                        editor.replaceBlocks(editor.document, parsed)
                        save()
                    } catch (err) {
                        console.error('BlockNote dictation restore error:', err)
                    }
                    docSnapshot = null
                }
            },
        })

        return () => {
            controller?.destroy?.()
        }
    }, [editor, isZh])

    useEffect(() => {
        if (editor) {
            editor.dictionary = dictionary
        }
    }, [editor, dictionary])

    useEffect(() => {
        const open = event => {
            const block = event.detail?.block
            if (block?.type === 'davidEmbed') setDialog({ kind: block.props.kind, block })
        }
        window.addEventListener('david-blocknote-edit', open)
        return () => window.removeEventListener('david-blocknote-edit', open)
    }, [])

    useEffect(() => {
        window.__insertBlockEditorMarkdown = markdown => {
            window.dispatchEvent(new CustomEvent('cf-notepad-block-import', {
                detail: { markdown, mode: 'insert' }
            }))
        }
        window.__insertBlockEditorImage = image => {
            const src = String(image?.url || '').trim()
            if (!src) return
            const imageBlock = {
                type: 'davidEmbed',
                props: {
                    kind: 'image',
                    src,
                    alt: String(image?.name || ''),
                },
            }
            try {
                const reference = editor.getTextCursorPosition()?.block || editor.document.at(-1)
                if (reference) editor.insertBlocks([imageBlock], reference.id, 'after')
                save()
            } catch (error) {
                window.showAppDialog?.({
                    title: resolveBlockNoteLang() === 'zh-TW' ? '圖片插入失敗' : 'Image insertion failed',
                    message: resolveBlockNoteLang() === 'zh-TW' ? '無法將圖片插入目前區塊。' : 'The image could not be inserted into the current block.',
                    kind: 'error',
                })
            }
        }
        const blockRoot = document.querySelector('#block-editor')
        const handleImagePaste = event => {
            const imageItem = [...(event.clipboardData?.items || [])].find(item => item.kind === 'file' && item.type.startsWith('image/'))
            if (!imageItem || typeof window.__handleImageInput !== 'function') return
            const file = imageItem.getAsFile()
            if (!file) return
            event.preventDefault()
            event.stopPropagation()
            window.__handleImageInput(file, { block: true }).catch(error => {
                window.showAppDialog?.({
                    title: resolveBlockNoteLang() === 'zh-TW' ? '圖片處理失敗' : 'Image processing failed',
                    message: error?.message || (resolveBlockNoteLang() === 'zh-TW' ? '無法處理圖片。' : 'The image could not be processed.'),
                    kind: 'error',
                })
            })
        }
        blockRoot?.addEventListener('paste', handleImagePaste, true)
        const handleInsertAudio = event => {
            const detail = event.detail || {}
            const audioUrl = detail.url || detail.audioUrl
            if (!audioUrl) return
            const audioBlock = {
                type: 'davidEmbed',
                props: {
                    kind: 'audio',
                    url: audioUrl,
                    name: detail.name || 'recording.webm',
                    audioId: detail.audioId || '',
                }
            }
            try {
                const cursorBlock = editor.getTextCursorPosition()?.block
                const reference = cursorBlock || editor.document.at(-1)
                if (reference) {
                    editor.insertBlocks([audioBlock], reference.id, 'after')
                } else {
                    editor.insertBlocks([audioBlock], editor.document[0]?.id, 'after')
                }
                save()
            } catch (err) {
                console.error('Failed to insert audio block into BlockNote:', err)
            }
        }
        window.addEventListener('cf-notepad-block-insert-audio', handleInsertAudio)
        return () => {
            delete window.__insertBlockEditorMarkdown
            delete window.__insertBlockEditorImage
            blockRoot?.removeEventListener('paste', handleImagePaste, true)
            window.removeEventListener('cf-notepad-block-insert-audio', handleInsertAudio)
        }
    }, [editor])

    useEffect(() => {
        const importMarkdown = event => {
            const markdown = typeof event.detail?.markdown === 'string' ? event.detail.markdown : ''
            if (!markdown.trim()) return

            try {
                const parsedBlocks = normalizeImportedBlocks(editor.tryParseMarkdownToBlocks(markdown))
                if (!parsedBlocks.length) throw new Error('匯入內容沒有可用的區塊。')

                if (event.detail?.mode === 'insert') {
                    const reference = editor.getTextCursorPosition()?.block || editor.document.at(-1)
                    if (!reference) throw new Error('找不到目前區塊。')
                    editor.insertBlocks(parsedBlocks, reference.id, 'after')
                } else {
                    editor.replaceBlocks(editor.document, parsedBlocks)
                }
                save()
            } catch (error) {
                console.error('Block Markdown import failed:', error)
                window.showAppDialog?.({
                    title: '匯入失敗',
                    message: error?.message || '無法將內容轉換成 Block 區塊。',
                    kind: 'error',
                })
            }
        }

        window.addEventListener('cf-notepad-block-import', importMarkdown)
        return () => window.removeEventListener('cf-notepad-block-import', importMarkdown)
    }, [editor])

    const items = useMemo(() => {
        const embedKinds = getEmbedKinds(isZh)
        return [
            ...(isAsrOnline ? [{
                title: isZh ? '即時聽打' : 'Live Voice Dictation',
                subtext: isZh ? '透過 ASR 即時語音串流，隨說隨打直接輸入文字至目前區塊' : 'Real-time ASR voice typing directly into current block',
                aliases: isZh ? ['dictate', 'typing', 'asr', '聽打', '語音輸入', '即時聽打'] : ['dictate', 'typing', 'asr', 'voice typing', 'voice input'],
                group: isZh ? 'DAVID888 語音與嵌入' : 'DAVID888 Voice & Embeds',
                icon: <span className="david-blocknote-menu-icon">⚡</span>,
                onItemClick: () => {
                    window.dispatchEvent(new CustomEvent('cf-notepad-start-dictate'))
                },
            }] : []),
            {
                title: isZh ? '即時錄音' : 'Live Voice Recording',
                subtext: isZh ? '啟動麥克風即時錄音並由 Whisper AI 自動轉錄為區塊內容' : 'Record voice with microphone and transcribe to blocks with Whisper AI',
                aliases: isZh ? ['record', 'voice', 'audio', 'mic', '錄音', '語音', '即時錄音'] : ['record', 'voice', 'audio', 'mic'],
                group: isZh ? 'DAVID888 語音與嵌入' : 'DAVID888 Voice & Embeds',
                icon: <span className="david-blocknote-menu-icon">🎙️</span>,
                onItemClick: () => {
                    window.dispatchEvent(new CustomEvent('cf-notepad-start-record'))
                },
            },
            ...getDefaultReactSlashMenuItems(editor),
            ...Object.entries(embedKinds).map(([kind, definition]) => ({
                title: definition.title,
                subtext: definition.detail,
                aliases: [kind, definition.title.toLowerCase()],
                group: isZh ? 'DAVID888 語音與嵌入' : 'DAVID888 Voice & Embeds',
                icon: <span className="david-blocknote-menu-icon">{definition.icon}</span>,
                onItemClick: () => {
                    const block = insertOrUpdateBlockForSlashMenu(editor, { type: 'davidEmbed', props: { kind } })
                    if (kind === 'slideBreak') return
                    setDialog({ kind, block })
                },
            })),
        ]
    }, [editor, isZh, isAsrOnline])

    return (
        <BlockNoteErrorBoundary isZh={isZh}>
            <div className="david-blocknote-app" data-blocknote-theme={blockNoteTheme}>
                <BlockNoteView editor={editor} theme={blockNoteTheme} slashMenu={false} onChange={save} className="david-blocknote-view">
                    <SuggestionMenuController triggerCharacter="/" getItems={async query => filterSuggestionItems(items, query)} />
                </BlockNoteView>
                {dialog && <EmbedDialog state={dialog} editor={editor} onClose={() => setDialog(null)} isZh={isZh} />}
            </div>
        </BlockNoteErrorBoundary>
    )
}

const reactRoot = createRoot(root)
reactRoot.render(<BlockNoteEditorApp />)
