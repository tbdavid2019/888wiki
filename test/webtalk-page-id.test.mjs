import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HTML } from '../src/templates/base.js'

const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const helperSource = readFileSync(new URL('../src/helper.js', import.meta.url), 'utf8')

test('share pages expose the WebTalk page ID when SCN_ENABLE_WEBTALK is enabled without changing editor pages', () => {
    assert.match(indexSource, /return returnPage\('NeedPasswd', \{[\s\S]*shareId,/)
    assert.match(baseTemplateSource, /const isSharePage = Boolean\(shareId && !isEdit\)/)
    assert.match(baseTemplateSource, /const webtalk = ext\.webtalk \?\? getWebtalkConfig\(\)/)
    assert.match(baseTemplateSource, /<meta name="webtalk-page-id" content="\$\{escapeHtml\(shareId\)\}" \/>/)
    assert.match(baseTemplateSource, /src="\$\{escapeHtml\(webtalk\.scriptUrl\)\}"/)
    assert.match(baseTemplateSource, /data-webtalk-scope=/)
    assert.match(baseTemplateSource, /data-webtalk-ai-endpoint=/)
    assert.match(baseTemplateSource, /\$\{webtalkScript\}/)
})

test('path-based share rendering keeps WebTalk metadata and script only when SCN_ENABLE_WEBTALK === "1"', () => {
    const prevEnable = globalThis.SCN_ENABLE_WEBTALK
    try {
        delete globalThis.SCN_ENABLE_WEBTALK
        const disabledHtml = HTML({
            lang: 'zh-TW',
            title: 'Shared note',
            content: '# Shared note',
            shareId: 'abc123',
            isEdit: false,
        })
        assert.doesNotMatch(disabledHtml, /webtalk\.david888\.com\/webtalk\.js/)
        assert.doesNotMatch(disabledHtml, /meta name="webtalk-page-id"/)

        globalThis.SCN_ENABLE_WEBTALK = '1'
        const shareHtml = HTML({
            lang: 'zh-TW',
            title: 'Shared note',
            content: '# Shared note',
            shareId: 'abc123',
            isEdit: false,
        })
        const editHtml = HTML({
            lang: 'zh-TW',
            title: 'Editor note',
            content: '# Editor note',
            shareId: 'abc123',
            isEdit: true,
        })

        assert.match(shareHtml, /<meta name="webtalk-page-id" content="abc123" \/>/)
        assert.match(shareHtml, /<script\n\s+defer\n\s+src="https:\/\/webtalk\.david888\.com\/webtalk\.js"/)
        assert.doesNotMatch(editHtml, /meta name="webtalk-page-id"/)
        assert.doesNotMatch(editHtml, /webtalk\.david888\.com\/webtalk\.js/)
    } finally {
        if (prevEnable === undefined) delete globalThis.SCN_ENABLE_WEBTALK
        else globalThis.SCN_ENABLE_WEBTALK = prevEnable
    }
})

test('defers WebTalk auto-mount until the share document body has been parsed', () => {
    const prevEnable = globalThis.SCN_ENABLE_WEBTALK
    globalThis.SCN_ENABLE_WEBTALK = '1'
    try {
        const shareHtml = HTML({
            lang: 'zh-TW',
            title: 'Shared note',
            content: '# Shared note',
            shareId: 'abc123',
            isEdit: false,
        })

        assert.match(shareHtml, /<script\n\s+defer\n\s+src="https:\/\/webtalk\.david888\.com\/webtalk\.js"/)
        assert.doesNotMatch(shareHtml, /<script\n\s+async\n\s+src="https:\/\/webtalk\.david888\.com\/webtalk\.js"/)
    } finally {
        if (prevEnable === undefined) delete globalThis.SCN_ENABLE_WEBTALK
        else globalThis.SCN_ENABLE_WEBTALK = prevEnable
    }
})

test('dynamic HTML responses are not cached across deployments', () => {
    assert.match(helperSource, /'Cache-Control': 'no-store'/)
})
