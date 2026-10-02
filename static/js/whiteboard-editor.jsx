/**
 * Excalidraw Whiteboard Editor entry point
 * 100% turnkey Excalidraw React component with standard JSON persistence.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import '@excalidraw/excalidraw/index.css'
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw'

if (typeof window !== 'undefined' && !window.EXCALIDRAW_ASSET_PATH) {
    window.EXCALIDRAW_ASSET_PATH = 'https://unpkg.com/@excalidraw/excalidraw@0.18.1/dist/prod/'
}

function getInitialTheme() {
    if (typeof document === 'undefined') return 'light'
    const attr = document.documentElement.getAttribute('data-ui-theme')
    if (attr === 'dark') return 'dark'
    if (attr === 'light') return 'light'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function parseInitialData(rawText) {
    if (!rawText || typeof rawText !== 'string') return null
    try {
        const parsed = JSON.parse(rawText)
        if (parsed && (parsed.type === 'excalidraw' || Array.isArray(parsed.elements))) {
            const elements = convertToExcalidrawElements(parsed.elements || [], { regenerateIds: false })
            return {
                elements,
                appState: parsed.appState || {},
                files: parsed.files || {},
                libraryItems: parsed.libraryItems || [],
            }
        }
    } catch {}
    return null
}

export function WhiteboardApp({ contentsEl, isEdit }) {
    const initialDataRef = useRef(null)
    if (!initialDataRef.current) {
        initialDataRef.current = parseInitialData(contentsEl.value)
    }

    const [theme, setTheme] = useState(getInitialTheme)
    const saveTimerRef = useRef(null)
    const libraryItemsRef = useRef(initialDataRef.current?.libraryItems || [])

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setTheme(getInitialTheme())
        })
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ui-theme'] })
        return () => observer.disconnect()
    }, [])

    const handleChange = useCallback((elements, appState, files) => {
        if (!isEdit) return
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

        saveTimerRef.current = setTimeout(() => {
            const safeAppState = {
                viewBackgroundColor: appState.viewBackgroundColor,
                gridSize: appState.gridSize,
            }
            const payload = {
                type: 'excalidraw',
                version: 2,
                source: 'https://wiki.david888.com',
                elements,
                appState: safeAppState,
                files: files || {},
                libraryItems: libraryItemsRef.current,
            }
            contentsEl.value = JSON.stringify(payload, null, 2)
            contentsEl.dispatchEvent(new Event('input', { bubbles: true }))
        }, 300)
    }, [contentsEl, isEdit])

    const handleLibraryChange = useCallback((libraryItems) => {
        libraryItemsRef.current = Array.isArray(libraryItems) ? libraryItems : []
        if (!isEdit) return
        try {
            const current = JSON.parse(contentsEl.value || '{}')
            contentsEl.value = JSON.stringify({
                ...current,
                libraryItems: libraryItemsRef.current,
            }, null, 2)
            contentsEl.dispatchEvent(new Event('input', { bubbles: true }))
        } catch (error) {
            console.warn('[whiteboard] library persistence skipped:', error)
        }
    }, [contentsEl, isEdit])

    const isZh = () => {
        if (typeof document === 'undefined') return true
        const lang = document.documentElement.getAttribute('lang') || document.body.getAttribute('data-lang')
        return lang && lang.startsWith('zh')
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <Excalidraw
                initialData={initialDataRef.current}
                onChange={handleChange}
                viewModeEnabled={!isEdit}
                zenModeEnabled={false}
                gridModeEnabled={false}
                theme={theme}
                langCode={isZh() ? 'zh-TW' : 'en'}
                libraryReturnUrl={typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined}
                onLibraryChange={handleLibraryChange}
                UIOptions={{
                    canvasActions: {
                        loadScene: isEdit,
                        saveAsImage: true,
                        export: isEdit ? { saveFileToDisk: true } : false,
                    },
                }}
            />
        </div>
    )
}

export class WhiteboardErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('[whiteboard] runtime error caught by boundary:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            const isZh = typeof document !== 'undefined' && document.documentElement?.getAttribute('lang')?.startsWith('zh')
            return (
                <div className="whiteboard-error-fallback" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-color, #333)', height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                        {isZh ? '白板編輯器遇到暫時性錯誤' : 'Whiteboard encountered a temporary error'}
                    </h3>
                    <p style={{ color: 'var(--text-muted, #888)', fontSize: '14px', maxWidth: '480px', margin: '0 auto 16px', wordBreak: 'break-word' }}>
                        {this.state.error?.message || (isZh ? '請點擊下方按鈕重新載入或重整網頁。' : 'Please click below to retry or refresh the page.')}
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
                        {isZh ? '重試載入' : 'Retry'}
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

export function mountWhiteboardEditor(rootEl, contentsEl, options = {}) {
    const isEdit = options.isEdit === true
    const reactRoot = createRoot(rootEl)
    reactRoot.render(
        <WhiteboardErrorBoundary>
            <WhiteboardApp contentsEl={contentsEl} isEdit={isEdit} />
        </WhiteboardErrorBoundary>
    )
    return reactRoot
}

const root = document.querySelector('#whiteboard-editor')
const source = document.querySelector('#contents')

if (root && source) {
    const isEditableMode = root.getAttribute('data-editable') === 'true' || window.APP_STATE?.isEdit === true
    mountWhiteboardEditor(root, source, { isEdit: isEditableMode })
}
