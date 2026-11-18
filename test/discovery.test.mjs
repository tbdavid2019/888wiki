import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import {
    AGENT_SKILL_MARKDOWN,
    API_DOCS_MARKDOWN,
    AUTH_MD_MARKDOWN,
    applyDiscoveryHeaders,
    buildLlmsTxt,
    buildLlmsFullTxt,
    buildMarkdownDocument,
    buildAgentSkillsIndex,
    buildApiCatalog,
    buildRobotsTxt,
    buildSitemapXml,
    buildOpenApiDocument,
    requestAcceptsMarkdown,
} from '../src/discovery.mjs'

const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const skillSource = readFileSync(new URL('../skills/SKILL.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const apiDocsSource = readFileSync(new URL('../LLM_API_DOCS.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('robots.txt publishes explicit crawler rules for discovery and AI agents', () => {
    const robots = buildRobotsTxt('https://example.com')

    assert.match(robots, /User-agent: \*/)
    assert.match(robots, /Sitemap: https:\/\/example\.com\/sitemap\.xml/)
    assert.match(robots, /Allow: \/\.well-known\/api-catalog/)
    assert.match(robots, /Allow: \/\.well-known\/agent-skills\//)
    assert.match(robots, /Allow: \/llms\.txt/)
    assert.match(robots, /Content-Signal: ai-train=no, search=yes, ai-input=no/)
    assert.match(robots, /Disallow: \/api\//)
    assert.match(robots, /User-agent: GPTBot/)
    assert.match(robots, /User-agent: OAI-SearchBot/)
    assert.match(robots, /User-agent: Claude-Web/)
    assert.match(robots, /User-agent: Google-Extended/)
})

test('llms.txt is a concise canonical index of public agent resources following llmstxt.org standard', () => {
    const llms = buildLlmsTxt('https://wiki.david888.com')

    assert.match(llms, /^# DAVID888 WIKI/m)
    assert.match(llms, /## 核心服務與頁面 \(Core Services & Pages\)/)
    assert.match(llms, /## AI Agent & API Discovery/)
    assert.match(llms, /## 研發團隊與維護資訊 \(Development & Maintenance\)/)
    assert.match(llms, /## Extended Documentation/)
    assert.match(llms, /https:\/\/wiki\.david888\.com\/\.well-known\/agent-skills\/david888-wiki-publisher\/SKILL\.md/)
    assert.match(llms, /https:\/\/wiki\.david888\.com\/docs\/api/)
    assert.match(llms, /https:\/\/wiki\.david888\.com\/openapi\.json/)
    assert.match(llms, /https:\/\/wiki\.david888\.com\/\.well-known\/api-catalog/)
    assert.match(llms, /https:\/\/wiki\.david888\.com\/llms-full\.txt/)
    assert.match(llms, /Image OCR & Table Reconstruction/)
    assert.match(llms, /PP-OCRv6/)
    assert.match(llms, /Visual Tools for LLMs: How to Call Canvas & Excalidraw Whiteboard/)
    assert.match(llms, /write_canvas[\s\S]*generate_canvas_from_wikilinks/)
    assert.match(llms, /write_whiteboard/)
    assert.doesNotMatch(llms, /admin333|SCN_ADMIN|password=/i)
})

test('llms-full.txt provides extended system documentation, API schemas, and architecture breakdown', () => {
    const llmsFull = buildLlmsFullTxt('https://wiki.david888.com')

    assert.match(llmsFull, /^# DAVID888 WIKI \(Serverless Cloud Notepad\) - Comprehensive Specification & System Guide/m)
    assert.match(llmsFull, /## 1\. Overview & Architecture/)
    assert.match(llmsFull, /## 2\. Core Routes & Services/)
    assert.match(llmsFull, /\/new\/canvas/)
    assert.match(llmsFull, /\/new\/whiteboard/)
    assert.match(llmsFull, /Calling Canvas \(JSON Canvas 1\.0\) & Excalidraw Whiteboard/)
    assert.match(llmsFull, /tools\/call[\s\S]*write_canvas[\s\S]*write_whiteboard/)
    assert.match(llmsFull, /## 3\. Agent Integration & Machine APIs/)
    assert.equal(existsSync(new URL('../static/llms.txt', import.meta.url)), false, 'static/llms.txt must not shadow Worker /llms.txt route')
    assert.equal(existsSync(new URL('../static/llms-full.txt', import.meta.url)), false, 'static/llms-full.txt must not shadow Worker /llms-full.txt route')
    assert.match(llmsFull, /## 4\. Security & Access Control Model/)
    assert.match(llmsFull, /## 5\. Development & Maintenance Team Credits/)
    assert.match(llmsFull, /https:\/\/wiki\.david888\.com\/api\/{path}/)
    assert.match(llmsFull, /Browser OCR/)
    assert.match(llmsFull, /WebGPU-first with WASM fallback/)
})

test('sitemap xml includes canonical share URLs and optional lastmod dates', () => {
    const xml = buildSitemapXml([
        {
            loc: 'https://example.com/share/abc123',
            lastmod: '2026-07-08',
        },
        {
            loc: 'https://example.com/share/def456?x=1&y=2',
        },
    ])

    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
    assert.match(xml, /<loc>https:\/\/example\.com\/share\/abc123<\/loc>/)
    assert.match(xml, /<lastmod>2026-07-08<\/lastmod>/)
    assert.match(xml, /<loc>https:\/\/example\.com\/share\/def456\?x=1&amp;y=2<\/loc>/)
})

test('api catalog includes required API discovery relations', () => {
    const catalog = buildApiCatalog('https://example.com')
    const entry = catalog.linkset[0]

    assert.equal(entry.anchor, 'https://example.com/api')
    assert.equal(entry['service-desc'][0].href, 'https://example.com/openapi.json')
    assert.equal(entry['service-doc'][0].href, 'https://example.com/docs/api')
    assert.equal(entry.status[0].href, 'https://example.com/api/health')
})

test('OpenAPI describes the complete note write contract', () => {
    const document = buildOpenApiDocument('https://example.com')
    const operation = document.paths['/api/{path}'].post
    const schema = document.components.schemas.NoteWriteRequest

    assert.equal(operation.requestBody.required, true)
    assert.ok(operation.requestBody.content['application/json'])
    assert.ok(operation.requestBody.content['text/markdown'])
    assert.ok(operation.requestBody.content['multipart/form-data'])
    assert.equal(schema.properties.width.enum.includes('1200px'), true)
    assert.equal(schema.properties.publicIndex.type, 'boolean')
    assert.equal(schema.properties.vpw.type, 'string')
})

test('agent skills index uses v0.2.0 schema and sha256 digests', async () => {
    const index = await buildAgentSkillsIndex()
    const skill = index.skills[0]

    assert.equal(index.$schema, 'https://schemas.agentskills.io/discovery/0.2.0/schema.json')
    assert.equal(skill.name, 'david888-wiki-publisher')
    assert.equal(skill.type, 'skill-md')
    assert.equal(skill.url, '/.well-known/agent-skills/david888-wiki-publisher/SKILL.md')
    assert.match(skill.digest, /^sha256:[0-9a-f]{64}$/)
    assert.match(AGENT_SKILL_MARKDOWN, /^---\nname: david888-wiki-publisher\n/m)
})

test('generated skill markdown stays identical to skills/SKILL.md', () => {
    assert.equal(AGENT_SKILL_MARKDOWN, skillSource)
})

test('generated api docs stay identical to LLM_API_DOCS.md', () => {
    assert.equal(API_DOCS_MARKDOWN, apiDocsSource)
})

test('auth.md is published as markdown guidance for agents', () => {
    assert.match(AUTH_MD_MARKDOWN, /^# Auth/m)
    assert.match(AUTH_MD_MARKDOWN, /Protected note reads support/)
    assert.match(AUTH_MD_MARKDOWN, /does not currently offer OAuth client registration/i)
})

test('markdown negotiation helper only activates on text/markdown requests', () => {
    assert.equal(requestAcceptsMarkdown(new Request('https://example.com', {
        headers: { Accept: 'text/markdown, text/html;q=0.8' },
    })), true)

    assert.equal(requestAcceptsMarkdown(new Request('https://example.com', {
        headers: { Accept: 'text/html,application/xhtml+xml' },
    })), false)

    const markdown = buildMarkdownDocument('# Title', {
        title: 'Doc',
        canonical_url: 'https://example.com/doc',
    })

    assert.match(markdown, /^---\ntitle: "Doc"\ncanonical_url: "https:\/\/example.com\/doc"\n---\n\n# Title$/)
})

test('discovery headers expose llms-txt, api catalog, and API docs links', () => {
    const headers = applyDiscoveryHeaders(new Headers())
    const values = headers.get('Link')

    assert.ok(values)
    assert.match(values, /rel="llms-txt"/)
    assert.match(values, /rel="api-catalog"/)
    assert.match(values, /rel="service-doc"/)
    assert.match(values, /rel="service-desc"/)
})

test('worker registers discovery routes before dynamic note routes', () => {
    assert.match(indexSource, /router\.get\('\/robots\.txt'/)
    assert.match(indexSource, /router\.head\('\/robots\.txt'/)
    assert.match(indexSource, /router\.get\(LLMS_TXT_PATH/)
    assert.match(indexSource, /router\.head\(LLMS_TXT_PATH/)
    assert.match(indexSource, /router\.get\(LLMS_FULL_TXT_PATH/)
    assert.match(indexSource, /router\.head\(LLMS_FULL_TXT_PATH/)
    assert.match(indexSource, /router\.get\('\/sitemap\.xml'/)
    assert.match(indexSource, /router\.head\('\/sitemap\.xml'/)
    assert.match(indexSource, /router\.get\(API_CATALOG_PATH/)
    assert.match(indexSource, /router\.head\(API_CATALOG_PATH/)
    assert.match(indexSource, /router\.get\(API_DOCS_PATH/)
    assert.match(indexSource, /router\.head\(API_DOCS_PATH/)
    assert.match(indexSource, /router\.get\(AUTH_MD_PATH/)
    assert.match(indexSource, /router\.head\(AUTH_MD_PATH/)
    assert.match(indexSource, /router\.get\(OPENAPI_PATH/)
    assert.match(indexSource, /router\.head\(OPENAPI_PATH/)
    assert.match(indexSource, /router\.get\(API_HEALTH_PATH/)
    assert.match(indexSource, /router\.head\(API_HEALTH_PATH/)
    assert.match(indexSource, /router\.get\(AGENT_SKILLS_INDEX_PATH/)
    assert.match(indexSource, /router\.head\(AGENT_SKILLS_INDEX_PATH/)
    assert.match(indexSource, /router\.get\(AGENT_SKILL_PATH/)
    assert.match(indexSource, /router\.head\(AGENT_SKILL_PATH/)
    assert.match(indexSource, /router\.get\('\/\.well-known\/agent-skills\/:asset'/)
    assert.match(indexSource, /router\.get\('\/\.well-known\/agent-skills\/:skillName\/:fileName'/)
    assert.match(indexSource, /const headers = new Headers\(response\.headers\)/)
    assert.match(indexSource, /applyDiscoveryHeaders\(headers\)/)
    assert.match(indexSource, /requestAcceptsMarkdown\(request\)/)
})

test('base template registers a guarded WebMCP context', () => {
    assert.match(baseTemplateSource, /const initWebMcp = \(\) => \{/)
    assert.match(baseTemplateSource, /document\.modelContext/)
    assert.match(baseTemplateSource, /navigator\.modelContext/)
    assert.match(baseTemplateSource, /name: 'read-current-markdown'/)
    assert.match(baseTemplateSource, /name: 'copy-share-link'/)
    assert.match(baseTemplateSource, /name: 'open-presentation'/)
    assert.match(baseTemplateSource, /mc\.registerTool\(tool\)/)
    assert.match(baseTemplateSource, /mc\.provideContext\.call\(mc, \{ tools \}\)/)
})
