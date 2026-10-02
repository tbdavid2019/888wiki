const TOOLBAR_TEXT = {
    'zh-TW': {
        bold: '粗體文字', italic: '斜體文字', strike: '刪除線文字', inlineCode: '程式碼',
        highlight: '螢光筆重點',
        link: '連結文字', codeBlock: '程式碼', table: '| 欄位 1 | 欄位 2 | 欄位 3 |\n| --- | --- | --- |\n| 文字 | 文字 | 文字 |', imageAlt: '圖片說明',
        twoColumns: '### 第一欄\n\n內容\n\n### 第二欄\n\n內容',
        threeColumns: '### 第一欄\n\n內容\n\n### 第二欄\n\n內容\n\n### 第三欄\n\n內容',
    },
    'en-US': {
        bold: 'bold text', italic: 'italic text', strike: 'strikethrough text', inlineCode: 'code',
        highlight: 'highlighted text',
        link: 'link text', codeBlock: 'code', table: '| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Text | Text | Text |', imageAlt: 'image description',
        twoColumns: '### Column 1\n\nContent\n\n### Column 2\n\nContent',
        threeColumns: '### Column 1\n\nContent\n\n### Column 2\n\nContent\n\n### Column 3\n\nContent',
    },
}

const getToolbarText = lang => TOOLBAR_TEXT[lang] || TOOLBAR_TEXT['zh-TW']

const INLINE_COMMANDS = {
    bold: { prefix: '**', suffix: '**' },
    italic: { prefix: '*', suffix: '*' },
    strike: { prefix: '~~', suffix: '~~' },
    inlineCode: { prefix: '`', suffix: '`' },
    highlight: { prefix: '==', suffix: '==' },
}

const LIST_MARKER = /^\s*(?:[-*+] |\d+\. )(?:\[[ xX]\] )?/

const replaceInline = (text, start, end, command, labels) => {
    const definition = INLINE_COMMANDS[command]
    const selected = text.slice(start, end)
    const value = selected || labels[command]
    const replacement = definition.prefix + value + definition.suffix
    const replacementStart = start + definition.prefix.length

    return {
        text: text.slice(0, start) + replacement + text.slice(end),
        selectionStart: replacementStart,
        selectionEnd: replacementStart + value.length,
    }
}

const replaceLink = (text, start, end, labels) => {
    const label = text.slice(start, end) || labels.link
    const url = 'https://example.com'
    const replacement = `[${label}](${url})`
    const urlStart = start + label.length + 3

    return {
        text: text.slice(0, start) + replacement + text.slice(end),
        selectionStart: urlStart,
        selectionEnd: urlStart + url.length,
    }
}

const selectedLineRange = (text, start, end) => {
    const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
    const nextLineBreak = text.indexOf('\n', end)
    const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak
    return { lineStart, lineEnd }
}

const replaceBlockLines = (text, start, end, transform) => {
    const { lineStart, lineEnd } = selectedLineRange(text, start, end)
    const selectedLines = text.slice(lineStart, lineEnd).split('\n')
    const replacement = selectedLines.map(transform).join('\n')

    return {
        text: text.slice(0, lineStart) + replacement + text.slice(lineEnd),
        selectionStart: lineStart,
        selectionEnd: lineStart + replacement.length,
    }
}

const replaceBlockWrapper = (text, start, end, placeholder) => {
    const { lineStart, lineEnd } = selectedLineRange(text, start, end)
    const selected = text.slice(lineStart, lineEnd) || placeholder
    const replacement = '```\n' + selected + '\n```'

    return {
        text: text.slice(0, lineStart) + replacement + text.slice(lineEnd),
        selectionStart: lineStart + 4,
        selectionEnd: lineStart + 4 + selected.length,
    }
}

const replaceSnippet = (text, start, end, snippet, selectionStart, selectionEnd) => ({
    text: text.slice(0, start) + snippet + text.slice(end),
    selectionStart: start + selectionStart,
    selectionEnd: start + selectionEnd,
})

const replaceColumnLayout = (text, start, end, columns, placeholder) => {
    const selected = text.slice(start, end)
    const content = selected || placeholder
    const className = columns === 3 ? 'three-column-layout' : 'two-column-layout'
    const leadingBreak = start > 0 && text[start - 1] !== '\n' ? '\n\n' : ''
    const trailingBreak = end < text.length && text[end] !== '\n' ? '\n\n' : ''
    const opening = `${leadingBreak}<div class="${className}">\n\n`
    const closing = `\n\n</div>${trailingBreak}`
    const replacement = opening + content + closing

    return {
        text: text.slice(0, start) + replacement + text.slice(end),
        selectionStart: start + opening.length,
        selectionEnd: start + opening.length + content.length,
    }
}

export const createLineNumbers = text => String(text || '').split('\n')
    .map((_, index) => String(index + 1))
    .join('\n')

export const createLineNumbersHtml = (text, lineHeights = []) => {
    const lines = String(text || '').split('\n')
    return lines.map((_, index) => {
        const height = lineHeights[index]
        const heightStyle = Number.isFinite(height) && height > 0 ? ` style="height:${height}px"` : ''
        return `<div class="editor-line-number"${heightStyle}>${index + 1}</div>`
    }).join('')
}

export const getEditorCursorStatus = (text, selectionStart = 0, lang = 'zh-TW') => {
    const source = String(text || '')
    const cursor = Math.max(0, Math.min(Number(selectionStart) || 0, source.length))
    const line = source.slice(0, cursor).split('\n').length
    const column = cursor - source.lastIndexOf('\n', Math.max(0, cursor - 1))

    if (lang === 'zh-TW') return `第 ${line} 行・第 ${column} 欄・總長度 ${source.length}`
    return `Line ${line}, Column ${column}, Length ${source.length}`
}

export const applyMarkdownCommand = (text, start, end, command, lang = 'zh-TW') => {
    const source = String(text || '')
    const safeStart = Math.max(0, Math.min(Number(start) || 0, source.length))
    const safeEnd = Math.max(safeStart, Math.min(Number(end) || safeStart, source.length))
    const labels = getToolbarText(lang)

    if (INLINE_COMMANDS[command]) return replaceInline(source, safeStart, safeEnd, command, labels)
    if (command === 'link') return replaceLink(source, safeStart, safeEnd, labels)
    if (command === 'heading1' || command === 'heading2' || command === 'heading3') {
        const level = Number(command.slice(-1))
        return replaceBlockLines(source, safeStart, safeEnd, line => `${'#'.repeat(level)} ${line.replace(/^\s{0,3}#{1,6}\s*/, '')}`)
    }
    if (command === 'quote') {
        return replaceBlockLines(source, safeStart, safeEnd, line => `> ${line.replace(/^>\s?/, '')}`)
    }
    if (command === 'bullet' || command === 'ordered' || command === 'task') {
        return replaceBlockLines(source, safeStart, safeEnd, (line, index) => {
            const content = line.replace(LIST_MARKER, '')
            if (command === 'ordered') return `${index + 1}. ${content}`
            if (command === 'task') return `- [ ] ${content}`
            return `- ${content}`
        })
    }
    if (command === 'codeBlock') return replaceBlockWrapper(source, safeStart, safeEnd, labels.codeBlock)
    if (command === 'rule') {
        return replaceSnippet(source, safeStart, safeEnd, '---', 0, 3)
    }
    if (command === 'table') {
        return replaceSnippet(source, safeStart, safeEnd, labels.table, 2, 4)
    }
    if (command === 'toc') {
        const prefix = safeStart > 0 && source[safeStart - 1] !== '\n' ? '\n' : ''
        const suffix = safeEnd < source.length && source[safeEnd] !== '\n' ? '\n' : ''
        const toc = prefix + '[TOC]' + suffix
        return replaceSnippet(source, safeStart, safeEnd, toc, prefix.length, prefix.length + 5)
    }
    if (command === 'image') {
        const snippet = `![${labels.imageAlt}](https://example.com/image.png)`
        const urlStart = 8
        return replaceSnippet(source, safeStart, safeEnd, snippet, urlStart, urlStart + 29)
    }
    if (command === 'highlight') {
        return replaceInline(source, safeStart, safeEnd, command, labels)
    }
    if (command === 'color') {
        const selected = source.slice(safeStart, safeEnd)
        const value = selected || (labels.colorText || (lang === 'zh-TW' ? '文字' : 'text'))
        const snippet = `[color=red]${value}[/color]`
        return replaceSnippet(source, safeStart, safeEnd, snippet, 7, 10)
    }
    if (command === 'alert') {
        const selected = source.slice(safeStart, safeEnd)
        const content = selected || (labels.alert || '提示內容')
        const snippet = `> [!NOTE]\n> ${content}`
        return replaceSnippet(source, safeStart, safeEnd, snippet, 11, 11 + content.length)
    }
    if (command === 'footnote') {
        const selected = source.slice(safeStart, safeEnd)
        const noteText = selected || (labels.footnote || '註腳內容')
        const fnMatches = source.match(/\[\^(\d+)\]/g) || []
        let nextNum = 1
        fnMatches.forEach(m => {
            const num = parseInt(m.slice(2, -1), 10)
            if (num >= nextNum) nextNum = num + 1
        })
        const ref = `[^${nextNum}]`
        const def = `\n\n[^${nextNum}]: ${noteText}`
        const newText = source.slice(0, safeStart) + ref + source.slice(safeEnd) + def
        return {
            text: newText,
            selectionStart: safeStart + ref.length,
            selectionEnd: safeStart + ref.length
        }
    }
    if (command === 'search') {
        if (typeof window !== 'undefined' && window.toggleEditorSearchReplace) {
            window.toggleEditorSearchReplace()
        }
        return { text: source, selectionStart: safeStart, selectionEnd: safeEnd }
    }
    if (command === 'twoColumns') {
        return replaceColumnLayout(source, safeStart, safeEnd, 2, labels.twoColumns)
    }
    if (command === 'threeColumns') {
        return replaceColumnLayout(source, safeStart, safeEnd, 3, labels.threeColumns)
    }

    return { text: source, selectionStart: safeStart, selectionEnd: safeEnd }
}

const SHORTCUTS = {
    b: 'bold',
    i: 'italic',
    k: 'link',
}

const BOX_UPLOAD_ENDPOINTS = [
    'https://box.david888.com/api.php?action=upload',
    'https://box.aiurl.tw/api.php?action=upload',
    'https://box.glsoft.ai/api.php?action=upload',
]

const normalizeEditorState = state => ({
    value: String(state?.value || ''),
    selectionStart: Math.max(0, Number(state?.selectionStart) || 0),
    selectionEnd: Math.max(0, Number(state?.selectionEnd) || 0),
})

const sameEditorState = (left, right) => left.value === right.value
    && left.selectionStart === right.selectionStart
    && left.selectionEnd === right.selectionEnd

export const createEditorHistory = initialState => {
    let entries = [normalizeEditorState(initialState)]
    let cursor = 0

    const move = direction => {
        const nextCursor = cursor + direction
        if (nextCursor < 0 || nextCursor >= entries.length) return null
        cursor = nextCursor
        return { ...entries[cursor] }
    }

    return {
        record(state) {
            const next = normalizeEditorState(state)
            if (sameEditorState(entries[cursor], next)) return
            entries = entries.slice(0, cursor + 1)
            entries.push(next)
            cursor = entries.length - 1
        },
        undo: () => move(-1),
        redo: () => move(1),
        canUndo: () => cursor > 0,
        canRedo: () => cursor < entries.length - 1,
    }
}

export const getImageAltText = filename => String(filename || 'image')
    .replace(/\.[^.]+$/, '')
    .replace(/[\[\]\(\)\{\}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'image'

const getAssetLabel = filename => String(filename || 'attachment')
    .replace(/\.[^.]+$/, '')
    .replace(/[\[\]\(\)\{\}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'attachment'

const escapeAttribute = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export const createUploadedAssetMarkdown = (url, filename, mimeType = '') => {
    const safeUrl = String(url || '').trim()
    const type = String(mimeType || '').toLowerCase()
    if (type.startsWith('video/')) return `<video controls src="${escapeAttribute(safeUrl)}"></video>`
    if (type.startsWith('audio/')) return `<audio controls src="${escapeAttribute(safeUrl)}"></audio>`
    return `[${getAssetLabel(filename)}](${safeUrl})`
}

export const initRecordingController = (root = document, { lang = 'zh-TW', toolbar = null, textarea = null } = {}) => {
    const recordButton = toolbar?.querySelector('[data-command="record"]')
    let mediaRecorder = null
    let recordingStream = null
    let recordingChunks = []
    let recordingSelection = null
    let startingRecording = false
    let isRecordingCanceled = false
    let recordingSeconds = 0
    let recordingTimer = null
    let recordingHud = null

    const PAUSE_ICON_SVG = '<svg class="hud-svg" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"></rect><rect x="14" y="4" width="4" height="16" rx="1.5"></rect></svg>'
    const RESUME_ICON_SVG = '<svg class="hud-svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>'
    const DONE_ICON_SVG = '<svg class="hud-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    const CANCEL_ICON_SVG = '<svg class="hud-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'

    const formatHudTime = sec => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0')
        const s = (sec % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    const ensureRecordingHud = () => {
        if (recordingHud && document.body.contains(recordingHud)) return recordingHud
        const existing = document.getElementById('editor-recording-hud')
        if (existing) {
            recordingHud = existing
            return recordingHud
        }
        const hud = document.createElement('div')
        hud.className = 'editor-recording-hud'
        hud.id = 'editor-recording-hud'
        hud.setAttribute('role', 'region')
        hud.setAttribute('aria-label', lang === 'zh-TW' ? '錄音控制列' : 'Recording controls')

        const isZh = lang === 'zh-TW'
        hud.innerHTML = `
            <div class="recording-hud-live-pill">
                <span class="recording-hud-dot"></span>
                <div class="recording-hud-waves" aria-hidden="true">
                    <span></span><span></span><span></span><span></span>
                </div>
                <span class="recording-hud-status">${isZh ? '錄音中' : 'Recording'}</span>
                <span class="recording-hud-timer">00:00</span>
            </div>
            <div class="recording-hud-actions">
                <button type="button" class="recording-hud-icon-btn hud-btn-pause" data-recording-action="toggle-pause" title="${isZh ? '暫停錄音 (Pause)' : 'Pause'}" aria-label="${isZh ? '暫停錄音' : 'Pause'}">
                    ${PAUSE_ICON_SVG}
                </button>
                <button type="button" class="recording-hud-pill-btn hud-btn-stop" data-recording-action="stop" title="${isZh ? '完成並插入逐字稿 (Done & Insert)' : 'Done & Insert'}" aria-label="${isZh ? '完成' : 'Done'}">
                    ${DONE_ICON_SVG}
                    <span>${isZh ? '完成' : 'Done'}</span>
                </button>
                <button type="button" class="recording-hud-icon-btn hud-btn-cancel" data-recording-action="cancel" title="${isZh ? '放棄錄音 (Cancel & Discard)' : 'Cancel'}" aria-label="${isZh ? '取消' : 'Cancel'}">
                    ${CANCEL_ICON_SVG}
                </button>
            </div>
        `

        hud.querySelector('[data-recording-action="toggle-pause"]')?.addEventListener('click', e => {
            e.preventDefault()
            e.stopPropagation()
            togglePauseRecording()
        })
        hud.querySelector('[data-recording-action="stop"]')?.addEventListener('click', e => {
            e.preventDefault()
            e.stopPropagation()
            stopRecording()
        })
        hud.querySelector('[data-recording-action="cancel"]')?.addEventListener('click', e => {
            e.preventDefault()
            e.stopPropagation()
            cancelRecording()
        })

        document.body.appendChild(hud)
        recordingHud = hud
        return recordingHud
    }

    const updateHudTimerDisplay = () => {
        if (!recordingHud) return
        const timerEl = recordingHud.querySelector('.recording-hud-timer')
        if (timerEl) timerEl.textContent = formatHudTime(recordingSeconds)
    }

    const startHudTimer = () => {
        if (recordingTimer) clearInterval(recordingTimer)
        recordingTimer = setInterval(() => {
            recordingSeconds += 1
            updateHudTimerDisplay()
        }, 1000)
    }

    const pauseHudTimer = () => {
        if (recordingTimer) {
            clearInterval(recordingTimer)
            recordingTimer = null
        }
    }

    const removeRecordingHud = () => {
        pauseHudTimer()
        recordingSeconds = 0
        if (recordingHud) {
            recordingHud.classList.add('is-leaving')
            setTimeout(() => {
                recordingHud?.remove()
                recordingHud = null
            }, 220)
        }
    }

    const setRecordingUi = state => {
        const recording = state === 'recording'
        const paused = state === 'paused'
        const active = recording || paused
        const isZh = lang === 'zh-TW'

        if (active) {
            const hud = ensureRecordingHud()
            hud.classList.toggle('is-paused', paused)
            const statusEl = hud.querySelector('.recording-hud-status')
            const pauseBtn = hud.querySelector('.hud-btn-pause')
            if (statusEl) {
                statusEl.textContent = paused
                    ? (isZh ? '已暫停' : 'Paused')
                    : (isZh ? '錄音中' : 'Recording')
            }
            if (pauseBtn) {
                pauseBtn.innerHTML = paused ? RESUME_ICON_SVG : PAUSE_ICON_SVG
                pauseBtn.title = paused ? (isZh ? '繼續錄音 (Resume)' : 'Resume') : (isZh ? '暫停錄音 (Pause)' : 'Pause')
                pauseBtn.setAttribute('aria-label', pauseBtn.title)
            }
        } else {
            removeRecordingHud()
        }

        if (recordButton) {
            recordButton.classList.toggle('is-recording', active)
            recordButton.setAttribute('aria-pressed', active ? 'true' : 'false')
            const label = active ? (isZh ? '停止並插入錄音' : 'Stop and insert recording') : (isZh ? '開始錄音' : 'Start recording')
            recordButton.setAttribute('aria-label', label)
            recordButton.setAttribute('title', label)
            recordButton.dataset.tooltip = label
        }
    }

    const stopRecordingTracks = () => {
        recordingStream?.getTracks().forEach(track => track.stop())
        recordingStream = null
    }

    const stopRecording = () => {
        if (!mediaRecorder) return
        if (mediaRecorder.state === 'paused') {
            try { mediaRecorder.resume() } catch (e) {}
        }
        if (mediaRecorder.state === 'recording') {
            try { mediaRecorder.requestData() } catch (e) {}
            try { mediaRecorder.stop() } catch (e) {}
        }
    }

    const togglePauseRecording = () => {
        if (!mediaRecorder) return
        if (mediaRecorder.state === 'recording') {
            try { mediaRecorder.requestData() } catch (e) {}
            mediaRecorder.pause()
            pauseHudTimer()
            setRecordingUi('paused')
        } else if (mediaRecorder.state === 'paused') {
            mediaRecorder.resume()
            startHudTimer()
            setRecordingUi('recording')
        }
    }

    const cancelRecording = () => {
        isRecordingCanceled = true
        stopRecordingTracks()
        if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) {
            try { mediaRecorder.stop() } catch (e) {}
        }
        mediaRecorder = null
        recordingChunks = []
        setRecordingUi('idle')
        window.showToast?.(lang === 'zh-TW' ? '🗑️ 已取消錄音' : '🗑️ Recording canceled')
    }

    const startRecording = async () => {
        if (mediaRecorder?.state === 'recording' || mediaRecorder?.state === 'paused') {
            stopRecording()
            return
        }
        if (startingRecording) return
        startingRecording = true
        isRecordingCanceled = false
        const recordingConsent = lang === 'zh-TW'
            ? '請確認所有參與者已同意錄音與轉錄。要開始錄音嗎？'
            : 'Confirm that all participants consent to recording and transcription. Start recording?'
        const confirmed = typeof window.showAppDialog === 'function'
            ? await window.showAppDialog({
                title: lang === 'zh-TW' ? '錄音與轉錄確認' : 'Recording Consent',
                message: recordingConsent,
                kind: 'confirm',
                confirm: true
            })
            : window.confirm(recordingConsent)
        if (!confirmed) {
            startingRecording = false
            return
        }
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            window.showToast?.(lang === 'zh-TW' ? '此瀏覽器不支援麥克風錄音。' : 'This browser does not support microphone recording.')
            startingRecording = false
            return
        }
        try {
            const currentTextarea = textarea || document.querySelector('#contents')
            recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mimeType = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : (MediaRecorder.isTypeSupported?.('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported?.('audio/mp4') ? 'audio/mp4' : ''))
            mediaRecorder = mimeType ? new MediaRecorder(recordingStream, { mimeType }) : new MediaRecorder(recordingStream)
            recordingChunks = []
            recordingSeconds = 0
            recordingSelection = {
                start: typeof currentTextarea?.selectionStart === 'number' ? currentTextarea.selectionStart : 0,
                end: typeof currentTextarea?.selectionEnd === 'number' ? currentTextarea.selectionEnd : 0
            }

            mediaRecorder.ondataavailable = event => {
                if (event.data && event.data.size > 0) {
                    recordingChunks.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                if (isRecordingCanceled) {
                    isRecordingCanceled = false
                    stopRecordingTracks()
                    mediaRecorder = null
                    recordingChunks = []
                    setRecordingUi('idle')
                    return
                }
                const audioType = mediaRecorder?.mimeType || 'audio/webm'
                const audioBlob = new Blob(recordingChunks, { type: audioType })
                stopRecordingTracks()
                mediaRecorder = null
                recordingChunks = []
                setRecordingUi('idle')

                if (!audioBlob || audioBlob.size === 0) {
                    window.showToast?.(lang === 'zh-TW' ? '⚠️ 未錄到有效音訊' : '⚠️ No audio captured')
                    return
                }

                const ext = audioType.includes('mp4') || audioType.includes('aac') ? 'mp4' : 'webm'
                const audioFile = new File([audioBlob], `recording-${Date.now()}.${ext}`, { type: audioType })

                if (audioFile.size > 25 * 1024 * 1024) {
                    window.showToast?.(lang === 'zh-TW' ? '錄音超過 25 MB，請縮短後再試。' : 'Recording exceeds the 25 MB transcription limit.')
                    return
                }
                document.dispatchEvent(new CustomEvent('cf-notepad-recorded-audio', {
                    detail: { file: audioFile, ...recordingSelection },
                }))
            }

            mediaRecorder.start(250)
            startingRecording = false
            setRecordingUi('recording')
            startHudTimer()
        } catch (error) {
            stopRecordingTracks()
            mediaRecorder = null
            startingRecording = false
            setRecordingUi('idle')
            window.showToast?.(error?.message || (lang === 'zh-TW' ? '無法取得麥克風權限。' : 'Unable to access the microphone.'))
        }
    }

    if (!window.__recordingControllerListenersAttached) {
        window.__recordingControllerListenersAttached = true
        window.addEventListener('cf-notepad-start-record', () => {
            startRecording()
        })
        window.addEventListener('cf-notepad-stop-record', () => stopRecording())
        window.addEventListener('cf-notepad-toggle-record', () => togglePauseRecording())
        window.addEventListener('cf-notepad-cancel-record', () => cancelRecording())
        window.addEventListener('keydown', event => {
            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'r') {
                event.preventDefault()
                startRecording()
            }
        })
    }

    setRecordingUi('idle')

    return {
        startRecording,
        stopRecording,
        togglePauseRecording,
        cancelRecording,
    }
}

export const ASR_HEALTH_URL = 'https://asr.5gao.ai/health'
export const ASR_WS_URL = 'wss://asr.5gao.ai/asr_stream_api_v1'
export const ASR_SECRET_KEY = 'test0102'

export const resampleAndConvertToInt16 = (audioBuffer, inputSampleRate, targetSampleRate = 16000) => {
    const ratio = inputSampleRate / targetSampleRate
    const newLength = Math.round(audioBuffer.length / ratio)
    const result = new Int16Array(newLength)
    for (let i = 0; i < newLength; i++) {
        const origIndex = i * ratio
        const indexFloor = Math.floor(origIndex)
        const indexCeil = Math.min(audioBuffer.length - 1, indexFloor + 1)
        const fraction = origIndex - indexFloor
        const sample = (audioBuffer[indexFloor] * (1 - fraction) + audioBuffer[indexCeil] * fraction)
        const clamped = Math.max(-1, Math.min(1, sample))
        result[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF
    }
    return result
}

export const checkAsrHealth = async ({ timeout = 2500, url = ASR_HEALTH_URL } = {}) => {
    if (typeof fetch === 'undefined') return false
    try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
        const timer = controller ? setTimeout(() => controller.abort(), timeout) : null
        const res = await fetch(url, {
            method: 'GET',
            signal: controller?.signal,
            cache: 'no-cache',
            mode: 'cors'
        })
        if (timer) clearTimeout(timer)
        if (!res.ok) return false
        const data = await res.json()
        return Boolean(data && data.status === 'healthy' && data.model_loaded === true)
    } catch {
        return false
    }
}

export const initDictationController = (root = document, { lang = 'zh-TW', toolbar = null, textarea = null } = {}) => {
    const dictateButton = toolbar?.querySelector('[data-command="dictate"]')
    let ws = null
    let mediaStream = null
    let audioCtx = null
    let audioProcessor = null
    let isDictating = false
    let startingDictation = false
    let isAsrOnline = false
    let dictationHud = null
    let dictationStartPos = 0
    let dictationInsertedText = ''
    const isZh = lang === 'zh-TW'

    const generateUUID = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0
            const v = c === 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
        })
    }

    const STOP_SVG = '<svg class="hud-svg" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>'
    const CANCEL_SVG = '<svg class="hud-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'

    if (dictateButton) {
        dictateButton.style.display = 'none'
    }

    const ensureDictationHud = () => {
        if (dictationHud && document.body.contains(dictationHud)) return dictationHud
        const existing = document.getElementById('editor-dictation-hud')
        if (existing) {
            dictationHud = existing
            return dictationHud
        }
        const hud = document.createElement('div')
        hud.className = 'editor-dictation-hud'
        hud.id = 'editor-dictation-hud'
        hud.setAttribute('role', 'region')
        hud.setAttribute('aria-label', isZh ? '即時聽打控制列' : 'Voice dictation controls')

        hud.innerHTML = `
            <div class="dictation-hud-live-pill">
                <span class="dictation-hud-dot"></span>
                <div class="dictation-hud-waves" aria-hidden="true">
                    <span></span><span></span><span></span><span></span><span></span>
                </div>
                <span class="dictation-hud-status">${isZh ? '⚡ 連線中...' : '⚡ Connecting...'}</span>
            </div>
            <div class="dictation-hud-actions">
                <button type="button" class="dictation-hud-pill-btn hud-btn-stop" data-dictation-action="stop" title="${isZh ? '結束聽打 (隨說隨打，點擊停止或按 Esc)' : 'Stop dictation (Click to stop or Esc)'}" aria-label="${isZh ? '結束聽打' : 'Stop dictation'}">
                    ${STOP_SVG}
                    <span>${isZh ? '結束' : 'Stop'}</span>
                </button>
                <button type="button" class="recording-hud-icon-btn hud-btn-cancel" data-dictation-action="cancel" title="${isZh ? '放棄並撤銷剛剛說入的文字' : 'Discard dictation'}" aria-label="${isZh ? '取消' : 'Cancel'}">
                    ${CANCEL_SVG}
                </button>
            </div>
        `

        hud.querySelector('[data-dictation-action="stop"]')?.addEventListener('click', e => {
            e.preventDefault()
            e.stopPropagation()
            stopDictating()
        })
        hud.querySelector('[data-dictation-action="cancel"]')?.addEventListener('click', e => {
            e.preventDefault()
            e.stopPropagation()
            cancelDictating()
        })

        document.body.appendChild(hud)
        dictationHud = hud
        return dictationHud
    }

    const removeDictationHud = () => {
        const hud = dictationHud || document.getElementById('editor-dictation-hud')
        if (!hud) return
        hud.classList.add('is-leaving')
        setTimeout(() => {
            if (hud.parentElement) hud.parentElement.removeChild(hud)
            if (dictationHud === hud) dictationHud = null
        }, 220)
    }

    const setDictatingUi = (active, connecting = false) => {
        if (dictateButton) {
            dictateButton.classList.toggle('is-dictating', active)
            dictateButton.setAttribute('aria-pressed', active ? 'true' : 'false')
            const label = active
                ? (isZh ? '停止即時聽打' : 'Stop live voice dictation')
                : (isZh ? '即時聽打 (Live Voice Typing)' : 'Live voice dictation')
            dictateButton.setAttribute('aria-label', label)
            dictateButton.setAttribute('title', label)
            dictateButton.dataset.tooltip = label
        }

        if (active) {
            const hud = ensureDictationHud()
            const statusEl = hud.querySelector('.dictation-hud-status')
            if (statusEl) {
                statusEl.textContent = connecting
                    ? (isZh ? '⚡ 正在連線語音伺服器...' : '⚡ Connecting...')
                    : (isZh ? '⚡ 聆聽中 · 隨說隨打' : '⚡ Listening · live typing...')
            }
        } else {
            removeDictationHud()
        }
    }

    const onIncomingText = (newText, isReset) => {
        if (!newText) return
        const currentTextarea = textarea || root.querySelector('#contents')
        if (!currentTextarea) return

        const val = currentTextarea.value || ''
        const insertPos = dictationStartPos + dictationInsertedText.length
        const safePos = Math.max(0, Math.min(insertPos, val.length))

        currentTextarea.value = val.slice(0, safePos) + newText + val.slice(safePos)
        dictationInsertedText += newText
        const nextPos = safePos + newText.length
        currentTextarea.setSelectionRange(nextPos, nextPos)
        currentTextarea.dispatchEvent(new Event('input', { bubbles: true }))

        if (dictationHud) {
            const statusEl = dictationHud.querySelector('.dictation-hud-status')
            if (statusEl) {
                statusEl.textContent = isZh ? '⚡ 即時輸入中...' : '⚡ Live typing...'
            }
        }
    }

    const stopDictating = ({ canceled = false } = {}) => {
        if (!isDictating && !ws) {
            setDictatingUi(false)
            return
        }
        isDictating = false
        startingDictation = false

        if (ws) {
            const socketToClose = ws
            ws = null
            socketToClose.onopen = null
            socketToClose.onmessage = null
            socketToClose.onerror = null
            socketToClose.onclose = null

            if (socketToClose.readyState === WebSocket.OPEN) {
                try { socketToClose.send('YOUDAO_ONETIME_ASR_STREAM_EOS') } catch (e) {}
                setTimeout(() => {
                    try { socketToClose.close() } catch (e) {}
                }, 200)
            } else if (socketToClose.readyState === WebSocket.CONNECTING) {
                socketToClose.onopen = () => {
                    try { socketToClose.close() } catch (e) {}
                }
                setTimeout(() => {
                    try { socketToClose.close() } catch (e) {}
                }, 300)
            } else {
                try { socketToClose.close() } catch (e) {}
            }
        }

        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop())
            mediaStream = null
        }
        if (audioProcessor) {
            try { audioProcessor.disconnect() } catch (e) {}
            audioProcessor = null
        }
        if (audioCtx && audioCtx.state !== 'closed') {
            try { audioCtx.close() } catch (e) {}
            audioCtx = null
        }

        setDictatingUi(false)
        if (!canceled && dictationInsertedText.trim()) {
            window.showToast?.(isZh ? '⚡ 聽打完成' : '⚡ Voice dictation completed')
        }
        dictationInsertedText = ''
    }

    const cancelDictating = () => {
        if (dictationInsertedText.length > 0) {
            const currentTextarea = textarea || root.querySelector('#contents')
            if (currentTextarea) {
                const val = currentTextarea.value || ''
                const start = dictationStartPos
                const end = start + dictationInsertedText.length
                if (val.slice(start, end) === dictationInsertedText) {
                    currentTextarea.value = val.slice(0, start) + val.slice(end)
                    currentTextarea.setSelectionRange(start, start)
                    currentTextarea.dispatchEvent(new Event('input', { bubbles: true }))
                }
            }
        }
        stopDictating({ canceled: true })
        window.showToast?.(isZh ? '🗑️ 已取消聽打' : '🗑️ Voice dictation canceled')
    }

    const startDictating = async () => {
        if (isDictating) {
            stopDictating()
            return
        }
        if (startingDictation) return
        startingDictation = true

        if (!isAsrOnline) {
            const online = await checkAsrHealth({ timeout: 1500 })
            if (!online) {
                if (dictateButton) dictateButton.style.display = 'none'
                startingDictation = false
                window.showToast?.(isZh ? '⚠️ 聽打伺服器目前離線或未就緒（asr.5gao.ai 尚未回應）' : '⚠️ Voice dictation service is currently offline.')
                return
            }
            isAsrOnline = true
            if (dictateButton) dictateButton.style.display = ''
        }

        const currentTextarea = textarea || root.querySelector('#contents')
        dictationStartPos = typeof currentTextarea?.selectionStart === 'number'
            ? currentTextarea.selectionStart
            : (currentTextarea?.value?.length || 0)
        dictationInsertedText = ''

        if (!navigator.mediaDevices?.getUserMedia || (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined')) {
            window.showToast?.(isZh ? '此瀏覽器不支援麥克風收音或 Web Audio。' : 'This browser does not support microphone input or Web Audio.')
            startingDictation = false
            return
        }

        setDictatingUi(true, true)

        try {
            ws = new WebSocket(ASR_WS_URL)
            ws.binaryType = 'arraybuffer'

            await new Promise((resolve, reject) => {
                let isResolved = false
                const connTimer = setTimeout(() => {
                    if (isResolved) return
                    isResolved = true
                    reject(new Error(isZh ? '聽打伺服器連線逾時（asr.5gao.ai 無回應）' : 'Connection timeout'))
                }, 5000)

                ws.onopen = () => {
                    if (isResolved) return
                    isResolved = true
                    clearTimeout(connTimer)
                    const reqId = generateUUID()
                    const header = {
                        channels: 1,
                        sample_rate: 16000,
                        requestId: reqId,
                        language: 'zhen',
                        output_script: 'traditional',
                        use_vad: true,
                        secret_key: ASR_SECRET_KEY,
                        mode: 'slow',
                        system_prompt: ''
                    }
                    try {
                        ws.send(JSON.stringify(header))
                    } catch (e) {
                        reject(e)
                        return
                    }
                    resolve()
                }

                ws.onerror = err => {
                    if (isResolved) return
                    isResolved = true
                    clearTimeout(connTimer)
                    reject(err || new Error('WebSocket connection error'))
                }

                ws.onclose = () => {
                    if (isResolved) return
                    isResolved = true
                    clearTimeout(connTimer)
                    reject(new Error(isZh ? '聽打伺服器連線中斷' : 'WebSocket connection closed'))
                }
            })

            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            })

            const AudioCtxClass = window.AudioContext || window.webkitAudioContext
            audioCtx = new AudioCtxClass()
            const source = audioCtx.createMediaStreamSource(mediaStream)
            const TARGET_CHUNK_SAMPLES = 2560
            const inputSampleRate = audioCtx.sampleRate

            audioProcessor = audioCtx.createScriptProcessor(4096, 1, 1)
            let pcmBufferAccumulator = []

            audioProcessor.onaudioprocess = e => {
                if (!isDictating || !ws || ws.readyState !== WebSocket.OPEN) return
                const channelData = e.inputBuffer.getChannelData(0)
                const int16Data = resampleAndConvertToInt16(channelData, inputSampleRate, 16000)
                for (let i = 0; i < int16Data.length; i++) {
                    pcmBufferAccumulator.push(int16Data[i])
                }
                while (pcmBufferAccumulator.length >= TARGET_CHUNK_SAMPLES) {
                    const chunk = new Int16Array(pcmBufferAccumulator.slice(0, TARGET_CHUNK_SAMPLES))
                    pcmBufferAccumulator = pcmBufferAccumulator.slice(TARGET_CHUNK_SAMPLES)
                    ws.send(chunk.buffer)
                }
            }

            source.connect(audioProcessor)
            audioProcessor.connect(audioCtx.destination)

            ws.onmessage = event => {
                try {
                    const data = JSON.parse(event.data)
                    if (data.status === 'connected') return
                    if (data.status === 'success' && data.msg) {
                        const text = data.msg.text || ''
                        const reset = Boolean(data.msg.reset)
                        if (text) onIncomingText(text, reset)
                    } else if (data.status === 'error') {
                        window.showToast?.((isZh ? '辨識錯誤: ' : 'Error: ') + (data.msg || 'Unknown'))
                    }
                } catch {}
            }

            ws.onerror = () => {
                window.showToast?.(isZh ? '⚠️ 聽打連線發生異常' : '⚠️ Voice dictation connection error')
                stopDictating()
            }

            ws.onclose = () => {
                if (isDictating) {
                    stopDictating()
                }
            }

            isDictating = true
            startingDictation = false
            setDictatingUi(true, false)
        } catch (err) {
            startingDictation = false
            stopDictating({ canceled: true })
            window.showToast?.(err?.message || (isZh ? '無法啟動即時聽打。' : 'Unable to start voice dictation.'))
        }
    }

    const toggleDictating = () => {
        if (isDictating) {
            stopDictating()
        } else {
            startDictating()
        }
    }

    const updateVisibility = async () => {
        isAsrOnline = await checkAsrHealth()
        if (dictateButton) {
            dictateButton.style.display = isAsrOnline ? '' : 'none'
        }
        if (!isAsrOnline && isDictating) {
            stopDictating()
            window.showToast?.(isZh ? '⚠️ 聽打伺服器已離線' : '⚠️ Voice dictation service is offline')
        }
        return isAsrOnline
    }

    updateVisibility()

    const healthInterval = setInterval(updateVisibility, 60000)
    if (typeof healthInterval?.unref === 'function') {
        healthInterval.unref()
    }

    const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            updateVisibility()
        }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', updateVisibility)
    window.addEventListener('offline', updateVisibility)

    if (!window.__dictationControllerListenersAttached) {
        window.__dictationControllerListenersAttached = true
        window.addEventListener('cf-notepad-start-dictate', () => startDictating())
        window.addEventListener('cf-notepad-stop-dictate', () => stopDictating())
        window.addEventListener('cf-notepad-toggle-dictate', () => toggleDictating())
        window.addEventListener('keydown', event => {
            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
                event.preventDefault()
                toggleDictating()
            } else if (event.key === 'Escape' && isDictating) {
                event.preventDefault()
                stopDictating()
            }
        })
    }

    return {
        startDictating,
        stopDictating,
        toggleDictating,
        cancelDictating,
        checkAsrHealth,
        updateVisibility,
        isDictating: () => isDictating,
    }
}

export const initMarkdownToolbar = (root = document) => {
    const toolbar = root.querySelector('[data-markdown-toolbar]')
    const textarea = root.querySelector('#contents')
    const lang = toolbar?.dataset.language || document.documentElement.lang || 'zh-TW'

    const imageInput = root.querySelector('#markdown-toolbar-image-input')
    const assetInput = root.querySelector('#markdown-toolbar-asset-input')
    const lineNumbers = root.querySelector('#editor-line-numbers')
    const editorStatus = root.querySelector('#editor-status')
    if (!toolbar || !textarea) return false
    const history = createEditorHistory({
        value: textarea.value,
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
    })
    let isRestoringHistory = false

    let mirrorElement = null
    const getMirror = () => {
        if (mirrorElement && mirrorElement.isConnected) return mirrorElement
        const shell = lineNumbers?.closest('.editor-code-shell')
        mirrorElement = root.querySelector('#editor-line-mirror')
        if (!mirrorElement) {
            mirrorElement = (root.ownerDocument || document).createElement('div')
            mirrorElement.id = 'editor-line-mirror'
            mirrorElement.className = 'editor-line-mirror'
            mirrorElement.setAttribute('aria-hidden', 'true')
            if (shell) {
                shell.appendChild(mirrorElement)
            } else if (textarea.parentElement) {
                textarea.parentElement.appendChild(mirrorElement)
            } else {
                (root.ownerDocument || document).body?.appendChild(mirrorElement)
            }
        }
        return mirrorElement
    }

    const escapeForMirror = (str) => {
        if (!str) return '&#8203;'
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    const syncLineNumbers = () => {
        if (lineNumbers && textarea) lineNumbers.scrollTop = textarea.scrollTop
    }

    let lineNumbersRaf = null
    const renderLineNumbers = () => {
        if (!lineNumbers || !textarea) return
        const val = textarea.value
        const lines = String(val || '').split('\n')
        const lineCount = lines.length
        const digits = Math.max(2, String(lineCount).length)
        const shell = lineNumbers.closest('.editor-code-shell')
        if (shell) {
            shell.style.setProperty('--editor-gutter-digits', String(digits))
        }

        const computed = (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function')
            ? window.getComputedStyle(textarea)
            : null

        const paddingLeft = computed ? (parseFloat(computed.paddingLeft) || 0) : 0
        const paddingRight = computed ? (parseFloat(computed.paddingRight) || 0) : 0
        const contentWidth = textarea.clientWidth ? (textarea.clientWidth - paddingLeft - paddingRight) : 0

        if (!computed || contentWidth <= 0) {
            lineNumbers.innerHTML = createLineNumbersHtml(val)
            syncLineNumbers()
            return
        }

        const mirror = getMirror()
        if (!mirror) {
            lineNumbers.innerHTML = createLineNumbersHtml(val)
            syncLineNumbers()
            return
        }

        mirror.style.width = `${contentWidth}px`
        mirror.style.fontFamily = computed.fontFamily
        mirror.style.fontSize = computed.fontSize
        mirror.style.fontWeight = computed.fontWeight
        mirror.style.fontStyle = computed.fontStyle
        mirror.style.letterSpacing = computed.letterSpacing
        mirror.style.wordSpacing = computed.wordSpacing
        mirror.style.lineHeight = computed.lineHeight
        mirror.style.tabSize = computed.tabSize
        mirror.style.wordBreak = computed.wordBreak || 'normal'
        mirror.style.overflowWrap = computed.overflowWrap || 'break-word'

        let mirrorHtml = ''
        for (let i = 0; i < lineCount; i++) {
            mirrorHtml += `<div class="editor-line-mirror-row">${escapeForMirror(lines[i])}</div>`
        }
        mirror.innerHTML = mirrorHtml

        const children = mirror.children
        const lineHeights = new Array(lineCount)
        for (let i = 0; i < lineCount; i++) {
            lineHeights[i] = children[i] ? children[i].getBoundingClientRect().height : 0
        }

        lineNumbers.innerHTML = createLineNumbersHtml(val, lineHeights)
        syncLineNumbers()
    }

    const updateLineNumbers = (immediate = false) => {
        if (!lineNumbers || !textarea) return
        if (!immediate && typeof requestAnimationFrame === 'function') {
            if (lineNumbersRaf) cancelAnimationFrame(lineNumbersRaf)
            lineNumbersRaf = requestAnimationFrame(() => {
                lineNumbersRaf = null
                renderLineNumbers()
            })
        } else {
            renderLineNumbers()
        }
    }

    const updateEditorStatus = () => {
        if (editorStatus) editorStatus.textContent = getEditorCursorStatus(textarea.value, textarea.selectionStart, lang)
    }

    const getEditorState = () => ({
        value: textarea.value,
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
    })

    const updateHistoryButtons = () => {
        const undoButton = toolbar.querySelector('[data-command="undo"]')
        const redoButton = toolbar.querySelector('[data-command="redo"]')
        if (undoButton) undoButton.disabled = !history.canUndo()
        if (redoButton) redoButton.disabled = !history.canRedo()
    }

    const restoreHistory = command => {
        const state = command === 'undo' ? history.undo() : history.redo()
        if (!state) return
        isRestoringHistory = true
        textarea.value = state.value
        textarea.focus()
        textarea.setSelectionRange(state.selectionStart, state.selectionEnd)
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
        isRestoringHistory = false
        updateHistoryButtons()
    }

    textarea.addEventListener('input', () => {
        if (!isRestoringHistory) history.record(getEditorState())
        updateLineNumbers()
        updateEditorStatus()
        updateHistoryButtons()
    })
    textarea.addEventListener('scroll', syncLineNumbers, { passive: true })
    ;['click', 'focus', 'keyup', 'select'].forEach(eventName => textarea.addEventListener(eventName, updateEditorStatus))

    if (typeof window !== 'undefined') {
        window.addEventListener('resize', () => updateLineNumbers(), { passive: true })
        window.updateEditorLineNumbers = () => updateLineNumbers(true)
        if (typeof ResizeObserver !== 'undefined') {
            const resizeObserver = new ResizeObserver(() => updateLineNumbers())
            resizeObserver.observe(textarea)
        }
        if (document?.fonts?.ready) {
            document.fonts.ready.then(() => updateLineNumbers(true))
        }
    }

    updateLineNumbers(true)
    updateEditorStatus()

    const runCommand = command => {
        const result = applyMarkdownCommand(textarea.value, textarea.selectionStart, textarea.selectionEnd, command, lang)
        textarea.value = result.text
        textarea.focus()
        textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }

    const insertUploadedImage = (url, filename, start, end) => {
        const alt = getImageAltText(filename)
        const replacement = `![${alt}](${url})`
        textarea.value = textarea.value.slice(0, start) + replacement + textarea.value.slice(end)
        textarea.focus()
        textarea.setSelectionRange(start + replacement.length, start + replacement.length)
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }

    const uploadImage = async (file, start, end) => {
        const formData = new FormData()
        formData.append('image', file)
        const response = await fetch('/upload', { method: 'POST', body: formData })
        const payload = await response.json()
        if (!response.ok || payload.err !== 0 || !payload.data) {
            throw new Error(payload.msg || 'Image upload failed')
        }
        insertUploadedImage(payload.data, file.name, start, end)
    }

    const insertUploadedAsset = (url, file, start, end) => {
        const replacement = createUploadedAssetMarkdown(url, file.name, file.type)
        textarea.value = textarea.value.slice(0, start) + replacement + textarea.value.slice(end)
        textarea.focus()
        textarea.setSelectionRange(start + replacement.length, start + replacement.length)
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }

    const uploadAsset = async (file, start, end) => {
        if (file.type?.startsWith('image/')) {
            throw new Error('Images still use the R2 image uploader')
        }
        let lastError
        for (const endpoint of BOX_UPLOAD_ENDPOINTS) {
            try {
                const formData = new FormData()
                formData.append('file', file)
                formData.append('title', file.name || 'attachment')
                const response = await fetch(endpoint, { method: 'POST', body: formData })
                const payload = await response.json()
                const url = payload?.data?.url
                if (response.ok && payload?.result === 'success' && url) {
                    insertUploadedAsset(url, file, start, end)
                    return
                }
                lastError = new Error(payload?.message || 'Attachment upload failed')
            } catch (error) {
                lastError = error
            }
        }
        throw lastError || new Error('Attachment upload failed')
    }

    const toggleFullscreen = () => {
        const pane = textarea.closest('.editor-pane')
        if (!pane) return
        if (document.fullscreenElement) {
            document.exitFullscreen?.()
        } else if (pane.requestFullscreen) {
            pane.requestFullscreen().catch(() => pane.classList.toggle('toolbar-fullscreen'))
        } else {
            pane.classList.toggle('toolbar-fullscreen')
        }
    }

    const PAUSE_SVG = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`
    const PLAY_SVG = `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`

    const { startRecording, stopRecording } = initRecordingController(root, { lang, toolbar, textarea })
    const { startDictating, stopDictating, toggleDictating } = initDictationController(root, { lang, toolbar, textarea })

    toolbar.querySelectorAll('button[data-command]').forEach(button => {
        button.addEventListener('mousedown', event => event.preventDefault())
        button.addEventListener('click', () => {
            const command = button.dataset.command
            if (command === 'undo' || command === 'redo') {
                restoreHistory(command)
                return
            }
            if (command === 'fullscreen') {
                toggleFullscreen()
                return
            }
            if (command === 'record') {
                startRecording()
                return
            }
            if (command === 'dictate') {
                toggleDictating()
                return
            }
            if (command === 'image' && imageInput) {
                imageInput.value = ''
                imageInput.dataset.selectionStart = String(textarea.selectionStart)
                imageInput.dataset.selectionEnd = String(textarea.selectionEnd)
                imageInput.click()
                return
            }
            if (command === 'asset' && assetInput) {
                assetInput.value = ''
                assetInput.dataset.selectionStart = String(textarea.selectionStart)
                assetInput.dataset.selectionEnd = String(textarea.selectionEnd)
                assetInput.click()
                return
            }
            runCommand(command)
        })
    })

    imageInput?.addEventListener('change', async () => {
        const file = imageInput.files?.[0]
        if (!file) return
        const start = Number(imageInput.dataset.selectionStart || textarea.selectionStart)
        const end = Number(imageInput.dataset.selectionEnd || textarea.selectionEnd)
        if (!window.ENABLE_R2) {
            runCommand('image')
            return
        }
        try {
            await uploadImage(file, start, end)
        } catch (error) {
            window.showToast?.(error.message || 'Image upload failed')
            if (!window.showToast) alert(error.message || 'Image upload failed')
        }
    })

    assetInput?.addEventListener('change', async () => {
        const file = assetInput.files?.[0]
        if (!file) return
        const start = Number(assetInput.dataset.selectionStart || textarea.selectionStart)
        const end = Number(assetInput.dataset.selectionEnd || textarea.selectionEnd)
        try {
            await uploadAsset(file, start, end)
        } catch (error) {
            window.showToast?.(error.message || 'Attachment upload failed')
            if (!window.showToast) alert(error.message || 'Attachment upload failed')
        }
    })

    textarea.addEventListener('keydown', event => {
        if (!(event.metaKey || event.ctrlKey) || event.altKey) return
        const key = event.key.toLowerCase()
        if (key === 'z') {
            event.preventDefault()
            restoreHistory(event.shiftKey ? 'redo' : 'undo')
            return
        }
        if (key === 'y') {
            event.preventDefault()
            restoreHistory('redo')
            return
        }
        const command = SHORTCUTS[key]
        if (!command) return
        event.preventDefault()
        runCommand(command)
    })

    updateHistoryButtons()
    return true
}

if (typeof document !== 'undefined') {
    const initialize = () => initMarkdownToolbar(document)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true })
    } else {
        initialize()
    }
}
