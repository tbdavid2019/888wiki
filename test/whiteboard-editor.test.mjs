import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
    DEFAULT_WHITEBOARD_DOCUMENT,
    isWhiteboardContent,
    parseWhiteboardDocument,
    validateWhiteboardDocument,
    whiteboardToMarkdown,
} from '../src/whiteboard_document.mjs'
import { extractNoteTitle, resolveEditorFormat, resolveLockedEditorFormat } from '../src/note_meta.js'
import { HTML } from '../src/templates/base.js'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')

test('isWhiteboardContent identifies valid Excalidraw documents and rejects non-whiteboard content', () => {
    assert.equal(isWhiteboardContent(''), false)
    assert.equal(isWhiteboardContent('# Just a note'), false)
    assert.equal(isWhiteboardContent('{"nodes":[],"edges":[]}'), false)
    assert.equal(isWhiteboardContent('{"type":"excalidraw","elements":[]}'), true)
    assert.equal(isWhiteboardContent('{"elements":[],"appState":{}}'), true)
    assert.equal(isWhiteboardContent(JSON.stringify(DEFAULT_WHITEBOARD_DOCUMENT)), true)
})

test('parseWhiteboardDocument parses valid inputs and falls back to default document safely', () => {
    assert.deepEqual(parseWhiteboardDocument(DEFAULT_WHITEBOARD_DOCUMENT), DEFAULT_WHITEBOARD_DOCUMENT)
    assert.deepEqual(parseWhiteboardDocument(''), DEFAULT_WHITEBOARD_DOCUMENT)
    assert.deepEqual(parseWhiteboardDocument('not valid json'), DEFAULT_WHITEBOARD_DOCUMENT)

    const customDoc = {
        type: 'excalidraw',
        elements: [{ id: '1', type: 'rectangle', x: 10, y: 10, width: 100, height: 100 }],
        appState: {},
    }
    assert.deepEqual(parseWhiteboardDocument(JSON.stringify(customDoc)), customDoc)
})

test('validateWhiteboardDocument enforces Excalidraw structural requirements', () => {
    assert.equal(validateWhiteboardDocument(DEFAULT_WHITEBOARD_DOCUMENT), true)

    assert.throws(() => validateWhiteboardDocument(null), /must be an object/)
    assert.throws(() => validateWhiteboardDocument('string'), /must be an object/)
    assert.throws(() => validateWhiteboardDocument({}), /must contain an "elements" array/)
    assert.throws(() => validateWhiteboardDocument({ elements: ['invalid-element'] }), /must have a valid type/)
    assert.throws(() => validateWhiteboardDocument({ elements: [{ id: '1' }] }), /must have a valid type/)

    const validCustom = {
        elements: [{ id: 'el-1', type: 'line' }],
        appState: {},
    }
    assert.equal(validateWhiteboardDocument(validCustom), true)
})

test('whiteboardToMarkdown extracts readable text elements for search and headless reading', () => {
    const markdown = whiteboardToMarkdown(DEFAULT_WHITEBOARD_DOCUMENT)
    assert.match(markdown, /# 🎨 Excalidraw Whiteboard/)
    assert.match(markdown, /Excalidraw 手繪白板/)

    const emptyMarkdown = whiteboardToMarkdown({ elements: [{ id: '1', type: 'rectangle' }] })
    assert.match(emptyMarkdown, /Empty whiteboard or non-text sketch elements/)

    const docWithDeleted = {
        elements: [
            { id: '1', type: 'text', text: 'Live Text', isDeleted: false },
            { id: '2', type: 'text', text: 'Deleted Text', isDeleted: true },
        ],
    }
    const filteredMarkdown = whiteboardToMarkdown(docWithDeleted)
    assert.match(filteredMarkdown, /Live Text/)
    assert.doesNotMatch(filteredMarkdown, /Deleted Text/)
})

test('resolveEditorFormat recognizes whiteboard metadata and document structures', () => {
    assert.equal(resolveEditorFormat({ editorFormat: 'whiteboard' }, ''), 'whiteboard')
    assert.equal(resolveEditorFormat({}, JSON.stringify(DEFAULT_WHITEBOARD_DOCUMENT)), 'whiteboard')
    assert.equal(resolveLockedEditorFormat({ editorFormat: 'whiteboard' }), 'whiteboard')
})

test('extractNoteTitle uses a readable fallback for raw whiteboard JSON', () => {
    const whiteboardJson = JSON.stringify(DEFAULT_WHITEBOARD_DOCUMENT)
    assert.equal(extractNoteTitle(whiteboardJson, '', 'test-excalidraw-wb'), 'test-excalidraw-wb')

    const titledWhiteboard = {
        ...DEFAULT_WHITEBOARD_DOCUMENT,
        elements: [{ id: 'text-1', type: 'text', text: 'Brainstorm title' }],
    }
    assert.equal(extractNoteTitle(JSON.stringify(titledWhiteboard), '', 'fallback'), 'Brainstorm title')
})

test('base template renders whiteboard editor container and assets when editorFormat is whiteboard', () => {
    const html = HTML({
        lang: 'zh-TW',
        title: 'Whiteboard Test',
        content: JSON.stringify(DEFAULT_WHITEBOARD_DOCUMENT),
        ext: { editorFormat: 'whiteboard' },
        isEdit: true,
        path: 'test-whiteboard-note',
    })

    assert.match(html, /id="whiteboard-editor"/)
    assert.match(html, /class="whiteboard-editor"/)
    assert.match(html, /data-editable="true"/)
    assert.match(html, /href="\/js\/whiteboard-editor\.bundle\.css(?:\?[^"]*)?"/)
    assert.match(html, /src="\/js\/whiteboard-editor\.bundle\.mjs(?:\?[^"]*)?"/)
    assert.match(html, /"editorFormat":"whiteboard"/)
    assert.match(html, /"isWhiteboard":true/)
})

test('base template renders read-only whiteboard container when viewing shared whiteboard note', () => {
    const html = HTML({
        lang: 'en-US',
        title: 'Whiteboard Share',
        content: JSON.stringify(DEFAULT_WHITEBOARD_DOCUMENT),
        ext: { editorFormat: 'whiteboard', share: true },
        isEdit: false,
        path: 'shared-wb',
        shareId: 'wb-share-123',
    })

    assert.match(html, /id="whiteboard-editor"/)
    assert.match(html, /data-editable="false"/)
    assert.match(html, /src="\/js\/whiteboard-editor\.bundle\.mjs(?:\?[^"]*)?"/)
})

test('all script tags in whiteboard HTML render without syntax errors', () => {
    const html = HTML({
        lang: 'zh-TW',
        title: 'Whiteboard Syntax Test',
        content: JSON.stringify(DEFAULT_WHITEBOARD_DOCUMENT),
        ext: { editorFormat: 'whiteboard', share: true },
        isEdit: true,
        path: 'syntax-wb',
    })

    const scripts = html.match(/<script[\s\S]*?<\/script>/g) || []
    for (const s of scripts) {
        if (s.includes('text/template') || s.includes('application/ld+json')) continue
        const code = s.replace(/<script[^>]*>/i, '').replace(/<\/script>$/i, '')
        if (!code.trim()) continue
        if (s.includes('type="module"')) {
            const sanitizedModuleCode = code
                .replace(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];?/g, (match, imports) => {
                    const cleanImports = imports.replace(/[{}]/g, '').split(',').map(x => x.trim()).filter(Boolean)
                    return cleanImports.length > 0 ? `var ${cleanImports.join(', ')};` : ''
                })
                .replace(/export\s+function\s+/g, 'function ')
                .replace(/export\s+const\s+/g, 'const ')
            assert.doesNotThrow(() => {
                new Function(sanitizedModuleCode)
            }, `Module script failed to compile: ${sanitizedModuleCode.slice(0, 100)}...`)
            continue
        }
        assert.doesNotThrow(() => {
            new Function(code)
        }, `Script failed to compile: ${code.slice(0, 100)}...`)
    }
})

test('index.js registers whiteboard routes and export handlers', () => {
    assert.match(indexSource, /router\.get\('\/new\/whiteboard'/)
    assert.match(indexSource, /validateWhiteboardDocument/)
    assert.match(indexSource, /whiteboardToMarkdown/)
})

test('whiteboard editor provides WhiteboardErrorBoundary protection against runtime crashes', () => {
    const whiteboardSource = readFileSync(new URL('../static/js/whiteboard-editor.jsx', import.meta.url), 'utf8')
    assert.match(whiteboardSource, /WhiteboardErrorBoundary/)
    assert.match(whiteboardSource, /getDerivedStateFromError/)
    assert.match(whiteboardSource, /whiteboard-error-fallback/)
})

