import { ocrItemsToText, reconstructTableFromOcrBoxes } from './ocr-utils.mjs'

// Official browser SDK: https://github.com/PaddlePaddle/PaddleOCR/tree/main/paddleocr-js
// WebGPU provider fallback: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024
export const TABLE_OCR_ENDPOINTS = Object.freeze([
    'https://2md.aiurl.tw/api/ocr?mode=table',
    'https://create360.ai/api/ocr?mode=table',
    'https://2md.glsoft.ai/api/ocr?mode=table',
])
export const OCR_MODEL_PRESETS = Object.freeze({
    tiny: Object.freeze({
        tier: 'tiny',
        textDetectionModelName: 'PP-OCRv6_tiny_det',
        textRecognitionModelName: 'PP-OCRv6_tiny_rec',
    }),
    small: Object.freeze({
        tier: 'small',
        textDetectionModelName: 'PP-OCRv6_small_det',
        textRecognitionModelName: 'PP-OCRv6_small_rec',
    }),
})

export const OCR_AUTO_STORAGE_KEY = 'cf-notepad:ocr-auto'
export const OCR_ENHANCED_STORAGE_KEY = 'cf-notepad:ocr-enhanced'

let ocrInstancePromise = null
let paddleOcrRuntimePromise = null
let ocrReady = false
let activeModelTier = null
let configuredModelTier = null
let ocrQueueTail = Promise.resolve()
let ocrBusyCount = 0

const readStoredModelTier = () => {
    if (configuredModelTier === 'tiny' || configuredModelTier === 'small') return configuredModelTier
    try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(OCR_ENHANCED_STORAGE_KEY) === '1') {
            return 'small'
        }
    } catch {}
    return 'tiny'
}

export const getOcrModelTier = () => readStoredModelTier()

export const setOcrModelTier = async tier => {
    const normalized = tier === 'small' ? 'small' : 'tiny'
    configuredModelTier = normalized
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(OCR_ENHANCED_STORAGE_KEY, normalized === 'small' ? '1' : '0')
        }
    } catch {}
    await runWithOcrMutex(async () => {
        if (activeModelTier && activeModelTier !== normalized) {
            await disposeOcr()
        }
    })
    return normalized
}

export const runWithOcrMutex = task => {
    const run = async () => {
        ocrBusyCount += 1
        try {
            return await task()
        } finally {
            ocrBusyCount = Math.max(0, ocrBusyCount - 1)
        }
    }
    const chained = ocrQueueTail.then(run, run)
    ocrQueueTail = chained.catch(() => {})
    return chained
}

const loadPaddleOcrRuntime = async () => {
    if (!paddleOcrRuntimePromise) {
        paddleOcrRuntimePromise = import('./paddleocr-runtime.bundle.mjs').catch(error => {
            paddleOcrRuntimePromise = null
            throw error
        })
    }
    return paddleOcrRuntimePromise
}

const validateImage = file => {
    if (!file || typeof file.arrayBuffer !== 'function') {
        throw new Error('Please choose a readable image file.')
    }
    if (file.type && !file.type.toLowerCase().startsWith('image/')) {
        throw new Error('Only image files can be sent to OCR.')
    }
    if (Number(file.size) > MAX_OCR_IMAGE_BYTES) {
        throw new Error('Image exceeds the 10MB OCR limit.')
    }
}

const isGfmTableRow = line => /^\s*\|.*\|\s*$/.test(line)
const isGfmTableSeparator = line => /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line)

const firstGfmTable = markdown => {
    const lines = String(markdown || '').replace(/\r\n?/g, '\n').trim().split('\n')
    for (let start = 0; start < lines.length - 1; start += 1) {
        if (!isGfmTableRow(lines[start]) || !isGfmTableSeparator(lines[start + 1])) continue
        let end = start + 2
        while (end < lines.length && isGfmTableRow(lines[end])) end += 1
        const rows = lines.slice(start, end)
        if (rows.length >= 3) {
            return rows.map(row => row.replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n').trim()
        }
    }
    return ''
}

export const extractTableMarkdown = payload => {
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload
    const candidates = [data?.tableMarkdown, data?.markdown]
    for (const candidate of candidates) {
        const table = firstGfmTable(candidate)
        if (table) return table
    }
    return ''
}

export const toUserFacingOcrError = error => {
    const message = String(error?.message || '').toLowerCase()
    if (message.includes('worker') || message.includes('offscreen')) {
        return 'OCR Worker 載入失敗，請重新整理頁面後再試。'
    }
    if (message.includes('webgpu') || message.includes('adapter') || message.includes('execution provider')) {
        return '此瀏覽器的 WebGPU 不可用，請改用最新版 Chrome 或 Edge。'
    }
    if (message.includes('download') || message.includes('http') || message.includes('fetch') || message.includes('model asset')) {
        return 'OCR 模型下載失敗，請確認網路連線後再試。'
    }
    return 'OCR 無法處理這張圖片，請換一張較清晰的圖片或重新整理頁面。'
}

const getOcrInstance = async () => {
    const desiredTier = readStoredModelTier()
    if (ocrInstancePromise && activeModelTier && activeModelTier !== desiredTier) {
        await disposeOcr()
    }
    if (!ocrInstancePromise) {
        const preset = OCR_MODEL_PRESETS[desiredTier] || OCR_MODEL_PRESETS.tiny
        activeModelTier = preset.tier
        ocrInstancePromise = loadPaddleOcrRuntime().then(({ PaddleOCR }) => PaddleOCR.create({
            lang: 'ch',
            ocrVersion: 'PP-OCRv6',
            textDetectionModelName: preset.textDetectionModelName,
            textRecognitionModelName: preset.textRecognitionModelName,
            worker: true,
            ortOptions: {
                backend: 'auto',
                disableWasmProxy: true,
            },
        })).then(instance => {
            ocrReady = true
            return instance
        }).catch(error => {
            ocrInstancePromise = null
            activeModelTier = null
            throw error
        })
    }
    return ocrInstancePromise
}

export const recognizeImage = async file => {
    validateImage(file)
    return runWithOcrMutex(async () => {
        try {
            const ocr = await getOcrInstance()
            const [result] = await ocr.predict(file)
            const text = ocrItemsToText(result?.items || [])
            if (!text) throw new Error('No readable text was found in the image.')
            return {
                text,
                items: result.items,
                metrics: result.metrics || null,
                runtime: result.runtime || null,
                modelTier: activeModelTier || getOcrModelTier(),
            }
        } catch (error) {
            if (error?.message === 'No readable text was found in the image.') throw error
            throw new Error(toUserFacingOcrError(error))
        }
    })
}

export const recognizeRemoteTableImage = async file => {
    validateImage(file)
    let lastError = null
    for (const endpoint of TABLE_OCR_ENDPOINTS) {
        try {
            const formData = new FormData()
            formData.append('file', file, file.name || 'table.png')
            formData.append('lang', 'chinese_cht')
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 60000)
            let response
            try {
                response = await fetch(endpoint, {
                    method: 'POST',
                    mode: 'cors',
                    credentials: 'omit',
                    headers: { Accept: 'application/json' },
                    body: formData,
                    signal: controller.signal,
                })
            } finally {
                clearTimeout(timeout)
            }
            const raw = await response.text()
            let payload = null
            try { payload = raw ? JSON.parse(raw) : null } catch { payload = null }
            if (!response.ok) throw new Error(`Table OCR request returned HTTP ${response.status}.`)
            const markdown = extractTableMarkdown(payload)
            if (!markdown) throw new Error('No table was detected in the image.')
            return {
                markdown,
                isLocal: false,
                lines: Array.isArray(payload?.data?.lines) ? payload.data.lines : [],
                tables: Array.isArray(payload?.data?.tables) ? payload.data.tables : [],
                durationMs: payload?.data?.durationMs ?? null,
            }
        } catch (error) {
            lastError = error?.name === 'AbortError' ? new Error('Table OCR service timed out.') : error
        }
    }
    throw new Error(lastError?.message || 'Table OCR service is unavailable. Try again later.')
}

export const recognizeTableImage = async (file, options = {}) => {
    validateImage(file)

    // 1. 純前端本地優先 (WebGPU PP-OCRv6 + 二維幾何重構演算法，經互斥鎖串行排隊)
    try {
        const localTable = await runWithOcrMutex(async () => {
            const ocr = await getOcrInstance()
            const [result] = await ocr.predict(file)
            const table = reconstructTableFromOcrBoxes(result?.items || [], options)
            if (table.isTable && table.markdown) {
                return {
                    markdown: table.markdown,
                    isLocal: true,
                    rowCount: table.rowCount,
                    colCount: table.colCount,
                    grid: table.grid,
                    items: result?.items || [],
                    metrics: result?.metrics || null,
                    runtime: result?.runtime || null,
                    modelTier: activeModelTier || getOcrModelTier(),
                }
            }
            return null
        })
        if (localTable) return localTable
    } catch (localError) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[Table OCR] Local geometric table reconstruction unavailable or failed, falling back to remote endpoints:', localError)
        }
    }

    // 2. 後端 Fallback 遠端表格 OCR 端點（手機或弱設備兜底）
    return recognizeRemoteTableImage(file)
}

export const disposeOcr = async () => {
    const instance = await ocrInstancePromise?.catch(() => null)
    if (instance?.dispose) await instance.dispose()
    ocrInstancePromise = null
    activeModelTier = null
    ocrReady = false
}

export const getStatus = () => ({
    ready: ocrReady,
    modelTier: activeModelTier || getOcrModelTier(),
    busy: ocrBusyCount > 0,
})

if (typeof window !== 'undefined') {
    window.cfNotepadOcr = {
        recognizeImage,
        recognizeTableImage,
        recognizeRemoteTableImage,
        reconstructTableFromOcrBoxes,
        setOcrModelTier,
        getOcrModelTier,
        runWithOcrMutex,
        disposeOcr,
        getStatus,
    }
}
