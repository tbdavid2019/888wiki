import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const commonTemplateSource = readFileSync(new URL('../src/templates/common.js', import.meta.url), 'utf8')

test('share renderer enables embed mode from the embed query parameter', () => {
    assert.match(indexSource, /searchParams\.get\('embed'\) === '1'/)
    assert.match(indexSource, /content:\s*(?:isBurnInterstitial\s*\?\s*''\s*:\s*)?value,\n\s+shareId,\n\s+ext: \{/)
    assert.match(indexSource, /embed: embedMode/)
})

test('embed pages hide the share footer and expose iframe height updates', () => {
    assert.match(baseTemplateSource, /share-embed/)
    assert.match(baseTemplateSource, /isEmbed \? '' : FOOTER/)
    assert.match(baseTemplateSource, /cf-notepad:embed-resize/)
    assert.match(baseTemplateSource, /ResizeObserver/)
})

test('published share controls provide an embed guide and copy action', () => {
    assert.match(commonTemplateSource, /id="copy-embed-code-btn"/)
    assert.match(commonTemplateSource, /sharePath && shareId \? `?[\s\S]*copy-embed-code-btn/)
    assert.match(commonTemplateSource, /class="modal embed-modal"/)
    assert.match(baseTemplateSource, /copy-embed-code-btn/)
    assert.match(baseTemplateSource, /embed-modal-copy-btn/)
    assert.equal(baseTemplateSource.includes("'</script>'"), false)
    assert.equal(baseTemplateSource.includes('"</script>"'), false)
})
