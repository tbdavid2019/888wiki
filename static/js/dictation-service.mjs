export const ASR_HEALTH_URL = 'https://asr.5gao.ai/health'
export const ASR_WS_URL = 'wss://asr.5gao.ai/asr_stream_api_v1'
export const ASR_SECRET_KEY = 'test0102'

export const generateUUID = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

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

export const initDictationController = (root = document, {
    lang = 'zh-TW',
    toolbar = null,
    textarea = null,
    onStart = null,
    onText = null,
    onCancel = null,
} = {}) => {
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
        if (typeof onText === 'function') {
            onText(newText, isReset)
            dictationInsertedText += newText
            if (dictationHud) {
                const statusEl = dictationHud.querySelector('.dictation-hud-status')
                if (statusEl) {
                    statusEl.textContent = isZh ? '⚡ 即時輸入中...' : '⚡ Live typing...'
                }
            }
            return
        }

        const currentTextarea = textarea || root.querySelector?.('#contents')
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
        if (typeof onCancel === 'function') {
            try { onCancel() } catch (err) { console.warn('onCancel error:', err) }
        } else if (dictationInsertedText.length > 0) {
            const currentTextarea = textarea || root.querySelector?.('#contents')
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

        const currentTextarea = textarea || root.querySelector?.('#contents')
        dictationStartPos = typeof currentTextarea?.selectionStart === 'number'
            ? currentTextarea.selectionStart
            : (currentTextarea?.value?.length || 0)
        dictationInsertedText = ''

        if (!navigator.mediaDevices?.getUserMedia || (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined')) {
            window.showToast?.(isZh ? '此瀏覽器不支援麥克風收音或 Web Audio。' : 'This browser does not support microphone input or Web Audio.')
            startingDictation = false
            return
        }

        if (typeof onStart === 'function') {
            try { onStart() } catch (err) { console.warn('onStart error:', err) }
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
        root.querySelectorAll?.('.is-dictate-dropdown-item, #dropdown-dictate-audio-btn').forEach(btn => {
            btn.style.display = isAsrOnline ? '' : 'none'
        })
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

    const controller = {
        startDictating,
        stopDictating,
        toggleDictating,
        cancelDictating,
        checkHealth: updateVisibility,
        isDictating: () => isDictating,
        destroy: () => {
            stopDictating({ canceled: true })
            if (window.__activeDictationController === controller) {
                window.__activeDictationController = null
            }
            if (healthInterval) clearInterval(healthInterval)
            document.removeEventListener('visibilitychange', onVisibilityChange)
            window.removeEventListener('online', updateVisibility)
            window.removeEventListener('offline', updateVisibility)
        }
    }

    window.__activeDictationController = controller

    if (!window.__dictationControllerListenersAttached) {
        window.__dictationControllerListenersAttached = true
        window.addEventListener('cf-notepad-start-dictate', () => {
            window.__activeDictationController?.startDictating?.()
        })
        window.addEventListener('cf-notepad-stop-dictate', () => {
            window.__activeDictationController?.stopDictating?.()
        })
        window.addEventListener('cf-notepad-toggle-dictate', () => {
            window.__activeDictationController?.toggleDictating?.()
        })
        window.addEventListener('keydown', event => {
            if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
                event.preventDefault()
                window.__activeDictationController?.toggleDictating?.()
            } else if (event.key === 'Escape' && window.__activeDictationController?.isDictating?.()) {
                event.preventDefault()
                window.__activeDictationController?.stopDictating?.()
            }
        })
    }

    return controller
}
