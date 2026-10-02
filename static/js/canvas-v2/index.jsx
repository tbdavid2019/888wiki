import React from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './canvas-v2.css'
import { CanvasEditorApp } from './CanvasEditorApp.jsx'
import { parseCanvasDocument, validateCanvasDocument } from '../../../src/canvas_document.mjs'

export class CanvasErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error }
    }

    componentDidCatch(error, errorInfo) {
        console.error('[canvas-v2] runtime error caught by boundary:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            const isZh = typeof document !== 'undefined' && document.documentElement?.getAttribute('lang')?.startsWith('zh')
            return (
                <div className="canvas-error-fallback" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-color, #333)', height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                        {isZh ? 'Canvas 畫布遇到暫時性錯誤' : 'Canvas encountered a temporary error'}
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

export function mountCanvasEditor(rootElement, contentsElement, { isEdit = true } = {}) {
    if (!rootElement || !contentsElement) {
        throw new Error('Canvas editor requires both rootElement and contentsElement')
    }

    let initialDoc
    try {
        const raw = contentsElement.value || ''
        const parsed = parseCanvasDocument(raw, { allowFallback: isEdit })
        initialDoc = validateCanvasDocument(parsed)
    } catch (err) {
        console.warn('[canvas-v2] initial document validation warning, using default:', err)
        initialDoc = parseCanvasDocument('', { allowFallback: true })
    }

    const root = createRoot(rootElement)
    root.render(
        <CanvasErrorBoundary>
            <CanvasEditorApp
                initialDoc={initialDoc}
                isEdit={isEdit}
                contentsElement={contentsElement}
            />
        </CanvasErrorBoundary>
    )

    return () => {
        root.unmount()
    }
}

export { CanvasEditorApp }
