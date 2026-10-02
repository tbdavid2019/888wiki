import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HTML } from '../src/templates/base.js'

test('block edit pages use a WYSIWYG block canvas instead of the Markdown split preview', () => {
    const page = HTML({
        lang: 'zh-TW',
        title: 'Block note',
        content: '{"version":1,"blocks":[]}',
        isEdit: true,
        ext: { editorFormat: 'block', blockHtml: '<p></p>' },
        path: 'block-note',
    })

    assert.match(page, /id="block-editor"/)
    assert.match(page, /id="contents" class="contents hide"/)
    assert.doesNotMatch(page, /data-markdown-toolbar/)
    assert.doesNotMatch(page, /class="divide-line"/)
    assert.match(page, /id="import-md-btn"/)
    assert.match(page, /id="import-md-input"/)
    assert.match(page, /id="export-dropdown"/)
    assert.match(page, /id="export-image-btn"/)
    assert.doesNotMatch(page, /id="export-md-btn"/)
    assert.match(page, /id="export-html-btn"/)
    assert.match(page, /id="export-pdf-btn"/)
    assert.match(page, /id="print-preview-btn"/)
    assert.doesNotMatch(page, /data-rail-checked-value="md"/)
    assert.match(page, /\/js\/block-editor\.bundle\.mjs/)
    assert.match(page, /\/js\/block-editor\.bundle\.css/)
    assert.doesNotMatch(page, /\/js\/block-view\.mjs/)
})

test('BlockNote editor exposes structural blocks and both existing upload paths', () => {
    const source = readFileSync(new URL('../static/js/blocknote-editor.jsx', import.meta.url), 'utf8')
    assert.match(source, /slideBreak/)
    assert.match(source, /mermaid/)
    assert.match(source, /echarts/)
    assert.match(source, /\/upload/)
    assert.match(source, /box\.david888\.com\/api\.php\?action=upload/)
})

test('BlockNote editor uses the ready-made side menu, slash menu, and formatting toolbar', () => {
    const source = readFileSync(new URL('../static/js/blocknote-editor.jsx', import.meta.url), 'utf8')

    assert.match(source, /@blocknote\/mantine/)
    assert.match(source, /BlockNoteView/)
    assert.match(source, /SuggestionMenuController/)
    assert.match(source, /getDefaultReactSlashMenuItems/)
    assert.match(source, /davidEmbed/)
    assert.match(source, /tryParseMarkdownToBlocks/)
    assert.match(source, /cf-notepad-block-import/)
    assert.match(source, /tables: \{ headers: true, splitCells: true/)
    assert.doesNotMatch(source, /flattenImportedTable/)
})

test('BlockNote follows the application dark-mode setting instead of being fixed to light', () => {
    const source = readFileSync(new URL('../static/js/blocknote-editor.jsx', import.meta.url), 'utf8')

    assert.match(source, /resolveBlockNoteTheme/)
    assert.match(source, /MutationObserver/)
    assert.match(source, /prefers-color-scheme: dark/)
    assert.match(source, /theme=\{blockNoteTheme\}/)
    assert.doesNotMatch(source, /theme="light"/)
})

test('BlockNote editor provides editable embed cards and does not use browser prompt dialogs', () => {
    const source = readFileSync(new URL('../static/js/blocknote-editor.jsx', import.meta.url), 'utf8')

    assert.match(source, /david-blocknote-dialog/)
    assert.match(source, /david-blocknote-edit/)
    assert.match(source, /safeHttpUrl/)
    assert.doesNotMatch(source, /window\.prompt/)
})

test('shared block pages load dedicated Mermaid and ECharts enhancement only when needed', () => {
    const page = HTML({
        lang: 'zh-TW',
        title: 'Block share',
        content: '{"version":1,"blocks":[]}',
        isEdit: false,
        ext: { editorFormat: 'block', blockHtml: '<p>Shared block</p>' },
        shareId: 'share-id',
    })
    const source = readFileSync(new URL('../static/js/block-view.mjs', import.meta.url), 'utf8')
    assert.match(page, /<div id="preview-md" class="contents markdown-body"><p>Shared block<\/p><\/div>/)
    assert.match(page, /\/js\/block-view\.mjs/)
    assert.match(source, /mermaid@11/)
    assert.match(source, /renderEchartsChart/)
})

test('BlockNote editor supports real-time voice recording and audio embed blocks', () => {
    const source = readFileSync(new URL('../static/js/blocknote-editor.jsx', import.meta.url), 'utf8')
    assert.match(source, /即時錄音/)
    assert.match(source, /cf-notepad-start-record/)
    assert.match(source, /cf-notepad-block-insert-audio/)
    assert.match(source, /david-blocknote-audio-wrap/)
    assert.match(source, /audio/)

    const page = HTML({
        lang: 'zh-TW',
        title: 'Block note edit',
        content: '{"version":1,"blocks":[]}',
        isEdit: true,
        ext: { editorFormat: 'block', blockHtml: '<p></p>' },
        path: 'block-note-edit',
    })
    assert.match(page, /id="dropdown-record-audio-btn"/)
})

test('BlockNote editor supports live voice dictation with dynamic ASR liveness and dropdown entry', () => {
    const source = readFileSync(new URL('../static/js/blocknote-editor.jsx', import.meta.url), 'utf8')
    assert.match(source, /checkAsrHealth/)
    assert.match(source, /initDictationController/)
    assert.match(source, /isAsrOnline/)
    assert.match(source, /即時聽打/)
    assert.match(source, /Live Voice Dictation/)
    assert.match(source, /cf-notepad-start-dictate/)
    assert.match(source, /insertInlineContent/)

    const bundle = readFileSync(new URL('../static/js/block-editor.bundle.mjs', import.meta.url), 'utf8')
    assert.match(bundle, /即時聽打/)
    assert.match(bundle, /cf-notepad-start-dictate/)

    const page = HTML({
        lang: 'zh-TW',
        title: 'Block note edit',
        content: '{"version":1,"blocks":[]}',
        isEdit: true,
        ext: { editorFormat: 'block', blockHtml: '<p></p>' },
        path: 'block-note-edit',
    })
    assert.match(page, /is-dictate-dropdown-item/)
    assert.match(page, /style="display: none;"/)
})

test('BlockNote editor provides complete dictionary with generic.ctrl_shortcut and ErrorBoundary protection', async () => {
    const source = readFileSync(new URL('../static/js/blocknote-editor.jsx', import.meta.url), 'utf8')
    assert.match(source, /import\s+\{\s*en,\s*zhTW\s*\}\s+from\s+'@blocknote\/core\/locales'/)
    assert.match(source, /ctrl_shortcut:\s*'Ctrl'/)
    assert.match(source, /BlockNoteErrorBoundary/)
    assert.match(source, /deepMergeDictionary/)
    assert.match(source, /RESOLVED_ZH_TW_DICTIONARY/)

    const bundle = readFileSync(new URL('../static/js/block-editor.bundle.mjs', import.meta.url), 'utf8')
    assert.match(bundle, /ctrl_shortcut/)

    const { formatKeyboardShortcut } = await import('@blocknote/core')
    const { en, zhTW } = await import('@blocknote/core/locales')

    function deepMergeDictionary(target, override) {
        if (!override) return target
        const result = { ...target }
        for (const key of Object.keys(override)) {
            if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
                result[key] = deepMergeDictionary(target?.[key] || {}, override[key])
            } else if (override[key] !== undefined) {
                result[key] = override[key]
            }
        }
        return result
    }

    const resolvedZh = deepMergeDictionary(deepMergeDictionary(en, zhTW), {
        generic: { ctrl_shortcut: 'Ctrl' },
        formatting_toolbar: {
            bold: { tooltip: '粗體', secondary_tooltip: 'Mod+B' },
            code: { tooltip: '行內程式碼', secondary_tooltip: '' },
        },
    })

    assert.equal(resolvedZh.generic.ctrl_shortcut, 'Ctrl')
    for (const style of ['bold', 'italic', 'underline', 'strike', 'code']) {
        const item = resolvedZh.formatting_toolbar[style]
        assert.ok(item && typeof item.tooltip === 'string')
        assert.doesNotThrow(() => {
            formatKeyboardShortcut(item.secondary_tooltip, resolvedZh.generic.ctrl_shortcut)
        })
    }
})
