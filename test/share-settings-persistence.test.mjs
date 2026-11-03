import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
    DEFAULT_PREVIEW_WIDTH,
    normalizePreviewWidth,
} from '../src/constant.js'

const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')

test('preview width uses the editor default and rejects unsupported values', () => {
    assert.equal(DEFAULT_PREVIEW_WIDTH, '1200px')
    assert.equal(normalizePreviewWidth(undefined), '1200px')
    assert.equal(normalizePreviewWidth('1440px'), '1440px')
    assert.equal(normalizePreviewWidth('1200'), null)
})

test('API writes persist a validated width and default it when omitted', () => {
    assert.match(indexSource, /normalizePreviewWidth\(reqBody\.width, updateMetadata\.width \|\| DEFAULT_PREVIEW_WIDTH\)/)
    assert.match(indexSource, /if \(normalizedWidth === null\) return returnJSON\(400, 'Invalid width:/)
    assert.match(indexSource, /updateMetadata\.width = normalizedWidth/)
})

test('setting route persists share, theme, width, share font, publicIndex, autosave, and annotation metadata', () => {
    assert.match(indexSource, /const\s*\{\s*[\s\S]*?share,\s*theme,\s*(?:title,\s*)?width,\s*shareFont,\s*publicIndex,\s*content,\s*autosave,\s*annotationsEnabled[\s\S]*?\}\s*=\s*(?:body|await request\.json\(\))/)
    assert.match(indexSource, /\.\.\.normalizedWidth !== undefined && \{ width: normalizedWidth \}/)
    assert.match(indexSource, /\.\.\.shareFont !== undefined && \{ shareFont \}/)
    assert.match(indexSource, /\.\.\.autosave !== undefined && \{ autosave: autosave === true \}/)
    assert.match(indexSource, /\.\.\.annotationsEnabled !== undefined && \{ annotationsEnabled: annotationsEnabled === true \}/)
    assert.doesNotMatch(indexSource, /\.\.\.splitDirection !== undefined/)
    assert.doesNotMatch(indexSource, /\.\.\.previewDevice !== undefined/)
})

test('base template initializes reader appearance from metadata and local editor preferences from localStorage', () => {
    assert.match(baseTemplateSource, /const DEFAULT_PREVIEW_WIDTH = \$\{JSON\.stringify\(DEFAULT_PREVIEW_WIDTH\)\}/)
    assert.match(baseTemplateSource, /const initialPreviewWidth = APP_STATE\.noteSettings\.width \|\| savedPreviewWidth \|\| DEFAULT_PREVIEW_WIDTH/)
    assert.match(baseTemplateSource, /const initialPreviewDevice = APP_STATE\.noteSettings\.previewDevice \|\| savedPreviewDevice \|\| 'desktop'/)
    assert.match(baseTemplateSource, /const initialSplitDirection = savedSplitDirection === 'vertical' \? 'vertical' : 'horizontal'/)
    assert.match(baseTemplateSource, /const savedShareFont = canPersistSettings \? window\.localStorage\.getItem\(SHARE_FONT_STORAGE_KEY\) : '';/)
    assert.match(baseTemplateSource, /const initialShareFont = APP_STATE\.noteSettings\.shareFont/)
    assert.match(baseTemplateSource, /savedShareFont === 'maple' \|\| savedShareFont === 'true'/)
})

test('share appearance changes stay local and only edit pages persist settings', () => {
    assert.match(baseTemplateSource, /const canPersistSettings = APP_STATE\.isEdit === true/)
    assert.match(baseTemplateSource, /if \(!canPersistSettings\) return null/)
    assert.match(baseTemplateSource, /if \(canPersistSettings\) \{\s*window\.localStorage\.setItem\(PREVIEW_WIDTH_STORAGE_KEY/s)
    assert.match(baseTemplateSource, /if \(canPersistSettings\) \{\s*window\.localStorage\.setItem\(SHARE_FONT_STORAGE_KEY/s)
    assert.match(baseTemplateSource, /if \(canPersistSettings\) persistSetting\(\{ theme \}\)/)
})

test('editor persists default preview width to APP_STATE and server when publishing or changing selector', () => {
    assert.match(baseTemplateSource, /APP_STATE\.noteSettings\.width = initialPreviewWidth/)
    assert.match(baseTemplateSource, /publishCurrentNote[\s\S]*width:\s*currentWidth/)
    assert.match(baseTemplateSource, /item\.dataset\.widthValue/)
    assert.match(baseTemplateSource, /function initUiTheme/)
    assert.match(baseTemplateSource, /document\.getElementById\('ui-theme-toggle-btn'\)/)
})
