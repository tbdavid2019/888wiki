import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
    DEFAULT_FLOW_TRACKER_URL,
    getFlowTrackerUrl,
    getFlowTrackerScript
} from '../src/constant.js'
import { HTML } from '../src/templates/base.js'
import { Home } from '../src/templates/pages.js'
import { Admin } from '../src/templates/admin.js'
import { createOfflinePageResponse } from '../src/offline_page.js'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const pagesTemplateSource = readFileSync(new URL('../src/templates/pages.js', import.meta.url), 'utf8')
const adminTemplateSource = readFileSync(new URL('../src/templates/admin.js', import.meta.url), 'utf8')
const offlinePageSource = readFileSync(new URL('../src/offline_page.js', import.meta.url), 'utf8')

test('Flow tracker constants and helpers default to user configured tracking script', () => {
    assert.equal(DEFAULT_FLOW_TRACKER_URL, 'https://flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2')
    assert.equal(getFlowTrackerUrl(), 'https://flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2')
    assert.equal(
        getFlowTrackerScript(),
        '<script defer src="https://flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2"></script>'
    )
})

test('Flow tracker can be disabled or overridden via SCN_FLOW_TRACKER_URL', () => {
    const originalVar = globalThis.SCN_FLOW_TRACKER_URL
    try {
        globalThis.SCN_FLOW_TRACKER_URL = '0'
        assert.equal(getFlowTrackerUrl(), '')
        assert.equal(getFlowTrackerScript(), '')

        globalThis.SCN_FLOW_TRACKER_URL = 'none'
        assert.equal(getFlowTrackerUrl(), '')
        assert.equal(getFlowTrackerScript(), '')

        globalThis.SCN_FLOW_TRACKER_URL = 'https://custom.tracker.com/script.js?siteId=xyz'
        assert.equal(getFlowTrackerUrl(), 'https://custom.tracker.com/script.js?siteId=xyz')
        assert.equal(
            getFlowTrackerScript(),
            '<script defer src="https://custom.tracker.com/script.js?siteId=xyz"></script>'
        )
    } finally {
        if (originalVar !== undefined) {
            globalThis.SCN_FLOW_TRACKER_URL = originalVar
        } else {
            delete globalThis.SCN_FLOW_TRACKER_URL
        }
    }
})

test('HTML base template injects Flow tracker script inside head before closing head tag', () => {
    assert.match(baseTemplateSource, /getFlowTrackerScript/)
    assert.match(baseTemplateSource, /\$\{flowTrackerScript\}/)
    assert.match(baseTemplateSource, /<head>/)

    const rendered = HTML({
        title: 'Test Note',
        content: '# Test Note',
        isEdit: true
    })

    assert.ok(rendered.includes('<script defer src="https://flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2"></script>'))
    
    // Ensure it is placed inside <head> ... </head>
    const headSection = rendered.slice(rendered.indexOf('<head>'), rendered.indexOf('</head>'))
    assert.ok(headSection.includes('src="https://flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2"'))

    // Allows ext override
    const customized = HTML({
        title: 'Custom Note',
        content: '# Custom Note',
        ext: { flowTrackerScript: '<script defer src="https://override.domain/script.js"></script>' }
    })
    assert.ok(customized.includes('https://override.domain/script.js'))
})

test('Home template injects Flow tracker script inside head', () => {
    assert.match(pagesTemplateSource, /getFlowTrackerScript/)

    const renderedHome = Home({
        lang: 'zh-TW',
        canonicalUrl: 'https://wiki.david888.com',
        ogImageUrl: 'https://wiki.david888.com/icon.png'
    })

    assert.ok(renderedHome.includes('<script defer src="https://flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2"></script>'))
    const headSection = renderedHome.slice(renderedHome.indexOf('<head>'), renderedHome.indexOf('</head>'))
    assert.ok(headSection.includes('flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2'))
})

test('Admin template injects Flow tracker script inside head', () => {
    assert.match(adminTemplateSource, /getFlowTrackerScript/)

    const renderedAdmin = Admin({
        lang: 'zh-TW',
        stats: { total: 10, shared: 5, protected: 2, indexed: 3, views: 100 }
    })

    assert.ok(renderedAdmin.includes('<script defer src="https://flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2"></script>'))
    const headSection = renderedAdmin.slice(renderedAdmin.indexOf('<head>'), renderedAdmin.indexOf('</head>'))
    assert.ok(headSection.includes('flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2'))
})

test('Offline page response injects Flow tracker script inside head', async () => {
    assert.match(offlinePageSource, /getFlowTrackerScript/)

    const response = createOfflinePageResponse()
    const html = await response.text()

    assert.ok(html.includes('<script defer src="https://flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2"></script>'))
    const headSection = html.slice(html.indexOf('<head>'), html.indexOf('</head>'))
    assert.ok(headSection.includes('flow.aiurl.tw/script.js?siteId=35d0ab7f-85c0-4460-ab85-76241f8ea9e2'))
})
