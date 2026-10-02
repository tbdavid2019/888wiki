import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
    parseCanvasDocument,
    validateCanvasDocument,
    canvasToMarkdown,
    DEFAULT_CANVAS_NODES,
    DEFAULT_CANVAS_EDGES,
} from '../src/canvas_document.mjs'
import {
    resolveEditorFormat,
    resolveLockedEditorFormat,
    extractNoteTitle,
    extractNoteDescription,
} from '../src/note_meta.js'
import { HTML } from '../src/templates/base.js'
import { FOOTER, SVG_ICONS } from '../src/templates/common.js'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const canvasEditorSource = readFileSync(new URL('../static/js/canvas-editor.jsx', import.meta.url), 'utf8')
const editorCssSource = readFileSync(new URL('../src/styles/editor.css.js', import.meta.url), 'utf8')
const canvasV2DiagramSource = readFileSync(new URL('../static/js/canvas-v2/components/Diagram/Diagram.jsx', import.meta.url), 'utf8')
const canvasV2FlowNodeSource = readFileSync(new URL('../static/js/canvas-v2/components/Node/FlowNode.jsx', import.meta.url), 'utf8')
const canvasV2NodeHandleSource = readFileSync(new URL('../static/js/canvas-v2/components/Node/NodeHandle.jsx', import.meta.url), 'utf8')
const canvasV2NodeToolbarSource = readFileSync(new URL('../static/js/canvas-v2/components/Node/NodeToolbar.jsx', import.meta.url), 'utf8')
const canvasV2EdgeSource = readFileSync(new URL('../static/js/canvas-v2/components/Edge/CanvasEdge.jsx', import.meta.url), 'utf8')
const canvasV2EdgeToolbarSource = readFileSync(new URL('../static/js/canvas-v2/components/Edge/EdgeToolbar.jsx', import.meta.url), 'utf8')
const canvasV2MainToolbarSource = readFileSync(new URL('../static/js/canvas-v2/components/Toolbar/MainToolbar.jsx', import.meta.url), 'utf8')
const canvasV2TypesSource = readFileSync(new URL('../static/js/canvas-v2/model/canvasTypes.mjs', import.meta.url), 'utf8')
const canvasV2CssSource = readFileSync(new URL('../static/js/canvas-v2/canvas-v2.css', import.meta.url), 'utf8')
const canvasV2TokensSource = readFileSync(new URL('../static/js/canvas-v2/tokens.css', import.meta.url), 'utf8')
const canvasV2PersistenceSource = readFileSync(new URL('../static/js/canvas-v2/store/persistence.mjs', import.meta.url), 'utf8')

test('parseCanvasDocument returns empty canvas when input is empty or invalid', () => {
    const emptyDoc = parseCanvasDocument('')
    assert.deepEqual(emptyDoc, { nodes: [], edges: [] })

    const invalidDoc = parseCanvasDocument('not a json')
    assert.deepEqual(invalidDoc, { nodes: [], edges: [] })
})

test('parseCanvasDocument preserves an explicitly empty canvas instead of restoring welcome cards', () => {
    const emptyCanvas = parseCanvasDocument(JSON.stringify({ nodes: [], edges: [] }))

    assert.deepEqual(emptyCanvas, { nodes: [], edges: [] })
})

test('parseCanvasDocument and validateCanvasDocument handle valid JSON Canvas documents', () => {
    const validJson = JSON.stringify({
        nodes: [
            { id: '1', type: 'text', x: 10, y: 20, width: 200, height: 100, text: 'Card 1' },
            { id: '2', type: 'sticky', x: 250, y: 20, width: 200, height: 100, text: 'Sticky note', color: '#fff9c4' },
        ],
        edges: [
            { id: 'e1', fromNode: '1', toNode: '2', label: 'relates to' },
        ],
    })

    const parsed = parseCanvasDocument(validJson)
    assert.equal(parsed.nodes.length, 2)
    assert.equal(parsed.edges.length, 1)
    assert.equal(parsed.nodes[0].text, 'Card 1')
    assert.equal(parsed.edges[0].label, 'relates to')
    assert.doesNotThrow(() => validateCanvasDocument(parsed))

    assert.throws(() => validateCanvasDocument(null), /Canvas document must be an object/)
    assert.throws(() => validateCanvasDocument({ nodes: 'invalid', edges: [] }), /nodes must be an array/)
    assert.throws(() => validateCanvasDocument({ nodes: [], edges: 'invalid' }), /edges must be an array/)
})

test('canvas documents preserve standard JSON Canvas link and group nodes and migrate legacy sticky cards', () => {
    const doc = parseCanvasDocument(JSON.stringify({
        nodes: [
            { id: 'link-1', type: 'link', x: 10, y: 20, width: 200, height: 100, url: 'https://example.com' },
            { id: 'group-1', type: 'group', x: 240, y: 20, width: 300, height: 200, label: 'Research' },
            { id: 'sticky-legacy', type: 'sticky', x: 10, y: 140, width: 200, height: 100, text: 'Legacy note' },
        ],
        edges: [],
    }))

    assert.equal(doc.nodes[0].type, 'link')
    assert.equal(doc.nodes[0].url, 'https://example.com')
    assert.equal(doc.nodes[1].type, 'group')
    assert.equal(doc.nodes[1].label, 'Research')
    assert.equal(doc.nodes[2].type, 'text')
    assert.equal(doc.nodes[2].david888.cardType, 'sticky')
    assert.doesNotThrow(() => validateCanvasDocument(doc))
})

test('canvas allows newly inserted empty link and file cards until their value is entered', () => {
    assert.doesNotThrow(() => validateCanvasDocument({
        nodes: [
            { id: 'file-empty', type: 'file', x: 0, y: 0, width: 220, height: 120, file: '' },
            { id: 'link-empty', type: 'link', x: 260, y: 0, width: 220, height: 120, url: '' },
        ],
        edges: [],
    }))
})

test('validateCanvasDocument rejects malformed nodes and dangling edges', () => {
    assert.throws(() => validateCanvasDocument({
        nodes: [{ id: 'text-1', type: 'text', x: 0, y: 0, width: 100, height: 100 }],
        edges: [],
    }), /text node text must be a string/)

    assert.throws(() => validateCanvasDocument({
        nodes: [{ id: 'text-1', type: 'text', x: 0, y: 0, width: 100, height: 100, text: 'Valid' }],
        edges: [{ id: 'edge-1', fromNode: 'text-1', toNode: 'missing' }],
    }), /references an unknown node/)
})

test('canvasToMarkdown extracts readable markdown representation from canvas nodes', () => {
    const doc = {
        nodes: [
            { id: '1', type: 'text', text: '## First Section\nSome content' },
            { id: '2', type: 'file', file: 'my-other-note', text: 'Related reading' },
        ],
        edges: [],
    }

    const md = canvasToMarkdown(doc)
    assert.match(md, /## First Section/)
    assert.match(md, /Some content/)
    assert.match(md, /\[Note: my-other-note\]/)
})

test('note_meta resolves canvas format and enforces format immutability', () => {
    assert.equal(resolveEditorFormat({ editorFormat: 'canvas' }), 'canvas')
    assert.equal(resolveLockedEditorFormat({}, 'canvas'), 'canvas')
    assert.equal(resolveLockedEditorFormat({ editorFormat: 'canvas' }, 'canvas'), 'canvas')
    assert.throws(() => resolveLockedEditorFormat({ editorFormat: 'canvas' }, 'markdown'), /immutable/)
    assert.throws(() => resolveLockedEditorFormat({ editorFormat: 'markdown' }, 'canvas'), /immutable/)
    assert.throws(() => resolveLockedEditorFormat({ editorFormat: 'block' }, 'canvas'), /immutable/)
})

test('extractNoteTitle and extractNoteDescription extract content from JSON Canvas', () => {
    const canvasJson = JSON.stringify({
        nodes: [
            { id: 'n1', type: 'text', text: '# 系統架構總覽\n這是詳細的架構說明...' },
            { id: 'n2', type: 'sticky', text: '臨時提醒事項' },
        ],
        edges: [],
    })

    const title = extractNoteTitle(canvasJson)
    assert.equal(title, '系統架構總覽')

    const desc = extractNoteDescription(canvasJson)
    assert.match(desc, /系統架構總覽/)
    assert.match(desc, /這是詳細的架構說明/)
})

test('FOOTER renders new canvas note link and canvas SVG icon', () => {
    const footerHtml = FOOTER({ lang: 'zh-TW', isEdit: true, editorFormat: 'canvas' })
    assert.match(footerHtml, /id="new-canvas-note-link"/)
    assert.match(footerHtml, /href="\/new\/canvas"/)
    assert.match(footerHtml, /Canvas 畫布/)
    assert.ok(SVG_ICONS.canvas)
})

test('canvas footer keeps the general document import menu available', () => {
    const footerHtml = FOOTER({ lang: 'zh-TW', isEdit: true, editorFormat: 'canvas' })

    assert.match(footerHtml, /dropdown-import-doc-btn/)
    assert.match(footerHtml, /dropdown-import-audio-btn/)
    assert.match(footerHtml, /匯入內容/)
    assert.doesNotMatch(footerHtml, /匯入內容（Markdown）/)
})

test('index.js registers /new/canvas route and canvas page ext', () => {
    assert.match(indexSource, /router\.get\('\/new\/canvas',/)
    assert.match(indexSource, /editorFormat === 'canvas'/)
})

test('base template renders canvas editor container and loads bundle when editorFormat is canvas', () => {
    const html = HTML({
        lang: 'zh-TW',
        title: 'Canvas Test',
        content: JSON.stringify({ nodes: [{ id: 'card-1', type: 'text', x: 0, y: 0, width: 200, height: 100, text: '# Canvas Test' }], edges: [] }),
        ext: { editorFormat: 'canvas', canvasMarkdown: '# Canvas Test' },
        isEdit: true,
        path: 'test-canvas-note',
    })

    assert.match(html, /id="canvas-editor"/)
    assert.match(html, /class="editor-pane canvas-editor-pane"/)
    assert.match(html, /href="\/js\/canvas-editor\.bundle\.css(?:\?[^"]*)?"/)
    assert.match(html, /src="\/js\/canvas-editor\.bundle\.mjs(?:\?[^"]*)?"/)
    assert.match(html, /data-editable="true"/)
    assert.match(html, /window\.APP_STATE = APP_STATE/)
    assert.match(baseTemplateSource, /isEdit && !isBlockDocument && !isCanvasDocument(?: && !isWhiteboardDocument)? \? EDITOR_TOOLBAR\(lang\)/)
    assert.match(html, /id="bot-accessible-content">\s*# Canvas Test/)
})

test('base template renders read-only canvas editor container when not in edit mode', () => {
    const html = HTML({
        lang: 'zh-TW',
        title: 'Canvas View',
        content: JSON.stringify({ nodes: [], edges: [] }),
        ext: { editorFormat: 'canvas' },
        isEdit: false,
        path: 'test-canvas-note',
    })

    assert.match(html, /id="canvas-editor"/)
    assert.match(html, /data-editable="false"/)
    assert.match(html, /src="\/js\/canvas-editor\.bundle\.mjs(?:\?[^"]*)?"/)
})

test('canvas editor uses clear, loose, four-sided handles and records JSON Canvas extensions', () => {
    assert.match(canvasEditorSource, /mountCanvasEditor/)
    assert.match(canvasV2DiagramSource, /ConnectionMode/)
    assert.match(canvasV2DiagramSource, /connectionMode=\{ConnectionMode\.Loose\}/)
    assert.match(canvasV2NodeHandleSource, /Position\.Top/)
    assert.match(canvasV2NodeHandleSource, /Position\.Right/)
    assert.match(canvasV2NodeHandleSource, /Position\.Bottom/)
    assert.match(canvasV2NodeHandleSource, /Position\.Left/)
    assert.match(canvasV2CssSource, /\.canvas-handle/)
    assert.match(canvasV2CssSource, /\.canvas-handle \{[\s\S]*pointer-events:\s*all\s*!important;/)
    assert.match(editorCssSource, /\.canvas-editor-pane \{[\s\S]*flex:\s*1 1 auto;[\s\S]*height:\s*100%;[\s\S]*min-height:\s*0;/)
    assert.doesNotMatch(editorCssSource, /\.canvas-editor-pane \{[\s\S]*height:\s*calc\(/)
})

test('canvas editor provides NodeToolbar, EdgeToolbar, color palettes, and interactive arrow/style controls', () => {
    assert.match(canvasV2FlowNodeSource, /FlowNode/)
    assert.match(canvasV2NodeToolbarSource, /FlowNodeToolbar/)
    assert.match(canvasV2EdgeToolbarSource, /EdgeToolbar/)
    assert.match(canvasV2EdgeSource, /EdgeLabelRenderer/)
    assert.match(canvasV2EdgeSource, /BaseEdge/)
    assert.match(canvasV2EdgeSource, /CanvasEdge/)
    assert.match(canvasV2TypesSource, /CANVAS_COLOR_PRESETS/)
    assert.match(canvasV2TypesSource, /STICKY_PALETTE/)
    assert.match(canvasV2TypesSource, /EDGE_COLORS/)
    assert.match(canvasV2TypesSource, /EDGE_ARROW_OPTIONS/)
    assert.match(canvasV2TypesSource, /EDGE_LINE_OPTIONS/)
    assert.match(canvasV2TypesSource, /EDGE_WIDTH_OPTIONS/)
    assert.match(canvasV2EdgeSource, /strokeDasharray/)
    assert.match(canvasV2EdgeSource, /onChangeEdgeLabel/)
    assert.match(canvasV2FlowNodeSource, /onDuplicate/)
    assert.match(canvasV2NodeToolbarSource, /type="color"/)
    assert.match(canvasV2EdgeToolbarSource, /canvas-edge-toolbar/)
    assert.match(canvasV2PersistenceSource, /createPersistenceBridge/)
    assert.match(canvasV2MainToolbarSource, /Undo2|↶/)
    assert.match(canvasV2MainToolbarSource, /Redo2|↷/)
    assert.match(canvasV2CssSource, /\.canvas-node-toolbar/)
    assert.match(canvasV2CssSource, /\.canvas-edge-toolbar/)
    assert.match(canvasV2CssSource, /\.canvas-edge-label-badge/)
    assert.match(canvasV2TokensSource, /--canvas-bg/)
    assert.match(canvasV2EdgeSource, /markerEnd=\{markerEnd\}/)
    assert.doesNotMatch(canvasV2EdgeSource, /markerEnd=\{effectiveMarkerEnd\}/)
    assert.match(canvasV2PersistenceSource, /fitView\(/)
})

test('canvas publishing validates JSON Canvas content at the setting boundary', () => {
    assert.match(indexSource, /resolvedFormat === 'canvas'/)
    assert.match(indexSource, /validateCanvasDocument\(parseCanvasDocument\(content, \{ allowFallback: false \}\)\)/)
})

test('validateCanvasDocument accepts edge david888 extension and custom arrow directions', () => {
    const doc = {
        nodes: [
            { id: 'n1', type: 'text', x: 0, y: 0, width: 200, height: 100, text: 'Card 1', color: '4' },
            { id: 'n2', type: 'text', x: 250, y: 0, width: 200, height: 100, text: 'Card 2', color: '#fff9c4' },
        ],
        edges: [
            {
                id: 'e1',
                fromNode: 'n1',
                toNode: 'n2',
                fromEnd: 'arrow',
                toEnd: 'arrow',
                color: '#ef4444',
                label: '雙向關聯',
                david888: {
                    lineStyle: 'dashed',
                    strokeWidth: 4,
                },
            },
            {
                id: 'e2',
                fromNode: 'n2',
                toNode: 'n1',
                fromEnd: 'none',
                toEnd: 'none',
                david888: {
                    lineStyle: 'dotted',
                },
            },
        ],
    }

    assert.doesNotThrow(() => validateCanvasDocument(doc))
    assert.equal(doc.edges[0].fromEnd, 'arrow')
    assert.equal(doc.edges[0].toEnd, 'arrow')
    assert.equal(doc.edges[0].david888.lineStyle, 'dashed')
    assert.equal(doc.edges[1].fromEnd, 'none')
    assert.equal(doc.edges[1].toEnd, 'none')
})

test('validateCanvasDocument rejects unsupported edge presentation extensions', () => {
    const doc = {
        nodes: [
            { id: 'n1', type: 'text', x: 0, y: 0, width: 200, height: 100, text: 'Card 1' },
            { id: 'n2', type: 'text', x: 250, y: 0, width: 200, height: 100, text: 'Card 2' },
        ],
        edges: [{ id: 'e1', fromNode: 'n1', toNode: 'n2', david888: { lineStyle: 'wavy' } }],
    }

    assert.throws(() => validateCanvasDocument(doc), /lineStyle is invalid/)
})

test('canvas editor uses FlowNode anatomy, isolated stylesheet, and scoped typography', () => {
    assert.match(canvasV2FlowNodeSource, /canvas-node-shell/)
    assert.match(canvasV2FlowNodeSource, /NodeResizer/)
    assert.match(canvasV2CssSource, /\.canvas-node-markdown/)
    assert.match(canvasV2CssSource, /\.canvas-btn-icon/)
    assert.match(editorCssSource, /\.canvas-editor-pane/)
    assert.match(editorCssSource, /\.canvas-editor/)
})

test('canvas editor provides CanvasErrorBoundary protection against runtime crashes', () => {
    const canvasV2IndexSource = readFileSync(new URL('../static/js/canvas-v2/index.jsx', import.meta.url), 'utf8')
    assert.match(canvasV2IndexSource, /CanvasErrorBoundary/)
    assert.match(canvasV2IndexSource, /getDerivedStateFromError/)
    assert.match(canvasV2IndexSource, /canvas-error-fallback/)
})

