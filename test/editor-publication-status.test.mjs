import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const baseCssSource = readFileSync(new URL('../src/styles/base.css.js', import.meta.url), 'utf8')
const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const constantSource = readFileSync(new URL('../src/constant.js', import.meta.url), 'utf8')

test('edit preview renders a publication status strip at the bottom of preview pane', () => {
    assert.match(baseTemplateSource, /class="editor-publication-status"/)
    assert.match(baseTemplateSource, /id="publication-share-url"/)
    assert.match(baseTemplateSource, /id="publication-copy-url"/)
    assert.match(baseTemplateSource, /id="publication-public-index"/)
    assert.match(baseTemplateSource, /id="publication-version-count"/)
    assert.match(baseTemplateSource, /id="publication-view-count"/)
    assert.match(baseTemplateSource, /class="contents markdown-body"><\/div>\$\{EDITOR_PUBLICATION_STATUS/)
})

test('publication status uses existing D1 history and unique-view metrics', () => {
    assert.match(indexSource, /getNoteViewCount/)
    assert.match(indexSource, /getNoteHistoryCounts/)
    assert.match(indexSource, /versionCount/)
    assert.match(indexSource, /viewCount/)
    assert.match(baseTemplateSource, /versionCount: Number\.isSafeInteger/)
    assert.match(baseTemplateSource, /viewCount: Number\.isSafeInteger/)
})

test('publication status stays outside the scrolling article and adapts to mobile preview', () => {
    assert.match(baseCssSource, /\.preview-pane \{[\s\S]*flex-direction: column;/)
    assert.match(baseCssSource, /\.editor-publication-status \{[\s\S]*flex: 0 0 auto;/)
    assert.match(baseCssSource, /body\.preview-device-mobile:not\(\.share-view\) \.editor-publication-status/)
    assert.match(baseCssSource, /@media \(max-width: 640px\)[\s\S]*\.editor-publication-status/)
    assert.match(baseCssSource, /\.editor-publication-status \{[\s\S]*height: 32px;[\s\S]*min-height: 32px;/)
    assert.match(baseCssSource, /\.editor-publication-status \{[\s\S]*white-space: nowrap;/)
})

test('dark UI theme gives the publication strip and footer a consistent warm charcoal palette', () => {
    assert.match(baseCssSource, /html\[data-ui-theme="dark"\][\s\S]*--footer-bg: #2d2826;/)
    assert.match(baseCssSource, /html\[data-ui-theme="dark"\][\s\S]*--status-bg: #342e2c;/)
    assert.match(baseCssSource, /\.editor-publication-status \{[\s\S]*background: var\(--status-bg\);[\s\S]*color: var\(--status-text\);/)
    assert.match(baseCssSource, /\.publication-state\.is-published \{[\s\S]*background: var\(--status-success-bg\);[\s\S]*color: var\(--status-success-text\);/)
    assert.match(baseCssSource, /\.footer :is\(button, a, label\) \{[\s\S]*font-weight: 700;/)
})

test('light and dark toolbars share restrained active states and reserve solid fills for primary actions', () => {
    assert.match(baseCssSource, /:root \{[\s\S]*--toolbar-bg-active: color-mix\(in srgb, #ffb89a 26%, #fff9f5\);[\s\S]*--toolbar-active-bg: var\(--toolbar-bg-active\);[\s\S]*--toolbar-active-text: #a9442e;[\s\S]*--toolbar-active-border: #b65036;/)
    assert.match(baseCssSource, /html\[data-ui-theme="dark"\][\s\S]*--toolbar-bg-active: color-mix\(in srgb, #9b7e93 28%, #2d2826\);[\s\S]*--toolbar-active-bg: var\(--toolbar-bg-active\);[\s\S]*--toolbar-active-text: #d4a5a5;[\s\S]*--toolbar-active-border: #9b7e93;/)
    assert.match(baseCssSource, /@media \(prefers-color-scheme: dark\)[\s\S]*--toolbar-bg-active: color-mix\(in srgb, #9b7e93 28%, #2d2826\);[\s\S]*--toolbar-active-border: #9b7e93;/)
    assert.match(baseCssSource, /\.footer-rail-switch \.btn-flip-back \{[\s\S]*background: var\(--rail-checked-bg, var\(--toolbar-active-bg\)\);[\s\S]*color: var\(--rail-checked-text, var\(--toolbar-active-text\)\);/)
    assert.match(baseCssSource, /\.footer-rail-switch\.is-checked \{[\s\S]*border-color: var\(--toolbar-active-border\);/)
    assert.match(baseCssSource, /\.segmented-toggle-btn\.active \{[\s\S]*background: var\(--toolbar-active-bg\);[\s\S]*color: var\(--toolbar-active-text\);[\s\S]*box-shadow: inset 0 -2px 0 var\(--toolbar-active-border\);/)
    assert.match(baseCssSource, /\.toolbar-active-button \{[\s\S]*background: var\(--toolbar-primary-bg\);[\s\S]*color: var\(--toolbar-primary-text\);/)
    assert.match(baseCssSource, /\.share-menu-trigger\.is-published/)
    assert.match(baseCssSource, /#share-font-selector \.footer-rail-switch \{[\s\S]*--rail-checked-bg: var\(--toolbar-active-bg\);/)
    assert.match(baseCssSource, /#language-selector \.footer-rail-switch \{[\s\S]*--rail-checked-bg: var\(--toolbar-active-bg\);/)
})

test('publication status labels are localized', () => {
    assert.match(constantSource, /publicationDraft: 'Draft'/)
    assert.match(constantSource, /publicationVersions: 'Retained versions'/)
    assert.match(constantSource, /publicationViews: 'Unique views'/)
    assert.match(constantSource, /publicationDraft: '尚未發布'/)
    assert.match(constantSource, /publicationVersions: '保留版本'/)
    assert.match(constantSource, /publicationViews: '不重複瀏覽'/)
})

test('publication bar provides far-left direct share open button with shake reminder and hides raw URL text', () => {
    assert.match(baseTemplateSource, /id="editor-share-page-btn" class="publication-share-page-btn toolbar-icon-button"/)
    assert.match(baseTemplateSource, /const \$editorSharePageBtn = document\.querySelector\('#editor-share-page-btn'\)/)
    assert.match(baseCssSource, /@keyframes share-btn-nudge-shake/)
    assert.match(baseCssSource, /\.publication-share-page-btn \{[\s\S]*animation: share-btn-nudge-shake 3\.5s ease-in-out infinite;/)
    assert.match(baseCssSource, /\.publication-label,\s*#publication-share-url \{\s*display: none !important;\s*\}/)
})
