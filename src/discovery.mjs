import { AGENT_SKILL_MARKDOWN } from './generated/agent-skill.generated.mjs'
import { API_DOCS_MARKDOWN } from './generated/api-docs.generated.mjs'

export { AGENT_SKILL_MARKDOWN }
export { API_DOCS_MARKDOWN }

const AGENT_SKILL_NAME = 'david888-wiki-publisher'
const AGENT_SKILL_PATH = `/.well-known/agent-skills/${AGENT_SKILL_NAME}/SKILL.md`
const API_CATALOG_PATH = '/.well-known/api-catalog'
const MCP_PATH = '/mcp'
const API_DOCS_PATH = '/docs/api'
const AUTH_MD_PATH = '/auth.md'
const LLMS_TXT_PATH = '/llms.txt'
const LLMS_FULL_TXT_PATH = '/llms-full.txt'
const OPENAPI_PATH = '/openapi.json'
const API_HEALTH_PATH = '/api/health'
const AGENT_SKILLS_INDEX_PATH = '/.well-known/agent-skills/index.json'
const SITEMAP_PATH = '/sitemap.xml'
const AGENT_SKILLS_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json'
const API_CATALOG_PROFILE = 'https://www.rfc-editor.org/info/rfc9727'

export const AUTH_MD_MARKDOWN = `# Auth

This service exposes note publishing and reading APIs for agents.

## Supported Access Modes

- Public note APIs can be used without OAuth when the target note is not password-protected.
- Protected note reads support \`Authorization: Bearer <password>\` or \`?pw=<password>\`.
- Protected note edits use the same note-level password model.

## Current Limitations

- This domain does not currently offer OAuth client registration for agents.
- This domain does not currently publish OpenID Connect or OAuth authorization server metadata for agent login flows.
- Access control is note-scoped and password-based rather than tenant-wide OAuth.

## Discovery Links

- API catalog: \`/.well-known/api-catalog\`
- API docs: \`/docs/api\`
- OpenAPI description: \`/openapi.json\`
- Agent skill: \`/.well-known/agent-skills/david888-wiki-publisher/SKILL.md\`
- LLM entry point: \`/llms.txt\`

## Practical Guidance

- Use public share URLs for human-facing read-only access.
- Use the REST API for agent writes and reads.
- If a protected note returns \`401\` or \`403\`, request the note password from the user.
`

export function buildLlmsTxt(origin = 'https://wiki.david888.com') {
    const siteOrigin = String(origin || 'https://wiki.david888.com').replace(/\/$/, '')
    return `# DAVID888 WIKI

> DAVID888 WIKI (Serverless Cloud Notepad) is a private-first serverless wiki and notepad built on Cloudflare Workers, KV, R2, and D1, providing high-performance Markdown and BlockNote editing, real-time collaboration, and agent publishing interfaces.

## 核心服務與頁面 (Core Services & Pages)

- [Home / Editor](${siteOrigin}/): Main note workspace and editor with custom themes and real-time autosave.
- [Block Note Editor](${siteOrigin}/new/block): Instantiate a new rich BlockNote document.
- [Markdown Note Editor](${siteOrigin}/new/markdown): Instantiate a new standard Markdown document.
- [Canvas](${siteOrigin}/new/canvas): Instantiate a JSON Canvas 1.0 workspace with relationship edges, four-sided handles, resize controls, local draft recovery, and image/file/audio/video resource nodes. Agents may use Canvas for visual relationship maps when a diagram communicates structure more clearly than linear Markdown.
- [Whiteboard](${siteOrigin}/new/whiteboard): Instantiate an Excalidraw freeform whiteboard workspace for hand-drawn sketches, flowcharts, UI wireframes, and sticky notes. 100% compatible with Obsidian Excalidraw and exportable to PNG/SVG.
- [Share Vault & Temporal Secrets](${siteOrigin}/): Cryptographic and temporal lifecycle protection featuring 4 vault modes: Standard Expiring, Burn-After-Reading (single-view self-destructing secret), Time-Locked Capsule (sealed until future timestamp), and Dead Man's Switch (heartbeat check-in webhook with author pulse tokens). Includes 10 one-click scenario presets (OTP, Crypto Inheritance, Whistleblower, Product Launch, Birthday Gift, Legal Hold, Scavenger Hunt, Course Content, Emergency Backup, Shared Secret).
- [Image OCR & Table Reconstruction](${siteOrigin}/new/markdown): Paste or drop an image to choose R2 upload, local PP-OCRv6 text recognition, or server table reconstruction via \`/api/ocr?mode=table\`; local OCR keeps the image on the device and table mode returns clean GFM through \`data.tableMarkdown\`.

## AI Agent & API Discovery

- [Agent Skill](${siteOrigin}${AGENT_SKILL_PATH}): Canonical skill for Markdown, Block, JSON Canvas, and Excalidraw publishing. **Run \`npx --yes 888wiki-skill update --global -y\` before use** to keep installed global skills synced with the latest features.
- [Agent Skills Index](${siteOrigin}${AGENT_SKILLS_INDEX_PATH}): Index of machine-readable agent skills (v0.2.0 schema).
- [Model Context Protocol (MCP)](${siteOrigin}${MCP_PATH}): Native MCP JSON-RPC 2.0 endpoint for WebMCP and AI agent tools.
- [Canvas MCP Tools](${siteOrigin}${MCP_PATH}): Use \`validate_canvas\`, \`write_canvas\`, and \`read_canvas\` for JSON Canvas validation, publishing, and edge inspection. Canvas notes can be linked as read-only chapters in Book Mode.
- [Whiteboard MCP Tools](${siteOrigin}${MCP_PATH}): Use \`validate_whiteboard\`, \`write_whiteboard\`, and \`read_whiteboard\` for Excalidraw whiteboard validation, hand-drawn sketch generation, and text inspection.
- [Vault & Secret MCP Tools](${siteOrigin}${MCP_PATH}): Native MCP tools for configuring vault modes (\`standard\`, \`burn_after_reading\`/\`burn\`, \`timelock\`, \`deadman\`), setting expiration/unlock timers, and obtaining Dead Man's Switch pulse webhook URLs (\`POST ${siteOrigin}/api/shares/<shareId>/pulse?token=<token>\`).

## Visual Tools for LLMs: How to Call Canvas & Excalidraw Whiteboard

- **JSON Canvas 1.0 (Node/Edge Diagrams)**:
  - **MCP** (\`POST ${siteOrigin}${MCP_PATH}\`, method \`tools/call\`): call \`write_canvas\` with \`{"path":"<slug>","document":{"nodes":[...],"edges":[...]}}\`, \`read_canvas\`, \`validate_canvas\`, or \`generate_canvas_from_wikilinks\` (\`{"source_path":"<md-slug>"}\`).
  - **REST** (\`POST ${siteOrigin}/api/<slug>\`): send \`{"editorFormat":"canvas","share":true,"text": JSON.stringify({ nodes, edges })}\`.
- **Excalidraw Whiteboard (Hand-drawn Sketches & Wireframes)**:
  - **MCP** (\`POST ${siteOrigin}${MCP_PATH}\`, method \`tools/call\`): call \`write_whiteboard\` with \`{"path":"<slug>","document":{"type":"excalidraw","version":2,"elements":[...],"appState":{}}}\`, \`read_whiteboard\`, or \`validate_whiteboard\`.
  - **REST** (\`POST ${siteOrigin}/api/<slug>\`): send \`{"editorFormat":"whiteboard","share":true,"text": JSON.stringify({ type: "excalidraw", version: 2, elements, appState })}\`.
- Both REST & MCP return \`shareUrl\` (plus \`editUrl\`) that humans can open directly in the browser.
- [API Catalog](${siteOrigin}${API_CATALOG_PATH}): RFC 9727 Linkset catalog for API discovery.
- [API Documentation](${siteOrigin}${API_DOCS_PATH}): Concise Markdown reference for the REST API.
- [OpenAPI Specification](${siteOrigin}${OPENAPI_PATH}): Machine-readable OpenAPI 3.1.0 contract.
- [Authentication Guidance](${siteOrigin}${AUTH_MD_PATH}): Note-level password access control model details.
- [Robots Policy](${siteOrigin}/robots.txt): Machine access controls and AI content signals.
- [Public Sitemap](${siteOrigin}${SITEMAP_PATH}): Publicly indexed share pages only.

## 研發團隊與維護資訊 (Development & Maintenance)

> 本站點與 AI Agent 服務由 DAVID888 (tbdavid2019) 傾力設計、開發與持續維護。

- [GitHub Repository](https://github.com/tbdavid2019/888wiki): Official project repository.
- [DAVID888 (tbdavid2019)](https://github.com/tbdavid2019): Lead Architecture & Core Developer.
- [Agent Skills Direct Endpoint](${siteOrigin}/.well-known/skills/index.json): Standardized Agent Skills list.

## 變更紀錄與更新摘要 (Changelog & Updates)

- **2026-09-21**: Release Share Vault & Temporal Secrets: 4 lifecycle modes (Standard Expiring, Burn-After-Reading, Time-Locked Vault, Dead Man's Switch) with 10 scenario quick presets and heartbeat webhook API.
- **2026-09-18**: Release Whiteboard editor powered by Excalidraw with MCP tools and full JSON persistence; Canvas resource nodes and Book Mode integration.
- **2026-09-17**: Complete rewrite of Infinite Canvas with Ameliorate architecture.
- **2026-04-18**: WebTalk comments integration across shared notes.
- **2026-04-15**: Native MCP Server endpoint at \`/mcp\` for in-browser AI and Claude Desktop.
- **2026-04-14**: Slide presentation engine upgrade with Reveal.js and Slidev-Lite.

## Extended Documentation

- [LLMs Full Documentation](${siteOrigin}${LLMS_FULL_TXT_PATH}): Full site architecture, API schemas, and extended agent guidance.
`
}

export function buildLlmsFullTxt(origin = 'https://wiki.david888.com') {
    const siteOrigin = String(origin || 'https://wiki.david888.com').replace(/\/$/, '')
    return `# DAVID888 WIKI (Serverless Cloud Notepad) - Comprehensive Specification & System Guide

> DAVID888 WIKI is a high-performance, private-first serverless wiki and notepad built for Cloudflare Workers. It supports bi-directional Markdown and BlockNote WYSIWYG editing, real-time autosave, ECharts/Mermaid/Graphviz diagram rendering, WebMCP local context tools, and machine-first REST APIs for AI Agents.

---

## 1. Overview & Architecture

- **Platform**: Cloudflare Workers + KV + R2 + D1 (SQLite)
- **Primary Domain**: \`${siteOrigin}\`
- **Frontend Stack**: Vanilla JS + CSS, React 19 + Mantine (for BlockNote editor), Mermaid.js, ECharts, MathJax
- **Browser OCR**: Official PaddleOCR.js PP-OCRv6 Chinese text detection and recognition, ONNX Runtime WebGPU-first with WASM fallback; OCR runtime is lazy-loaded on image action.
- **Server Table OCR**: Image table reconstruction is available through the external \`/api/ocr?mode=table\` service, with \`data.tableMarkdown\` and \`data.tables\` outputs for Markdown or BlockNote insertion.
- **Backend Stack**: \`itty-router\` on Cloudflare Worker runtime
- **Data Persistence**:
  - \`NOTES\` KV Namespace: Note content & metadata storage
  - \`SHARE\` KV Namespace: Public share slug mapping
  - \`IMAGES\` R2 Bucket: Image & asset upload storage (\`s3.wiki.david888.com\`)
  - \`NOTE_HISTORY_DB\` D1 Database: Revision history snapshots (up to 10 versions per note)

---

## 2. Core Routes & Services (完整頁面路線)

- **Editor / Homepage**: \`${siteOrigin}/\`
  Main note workspace. Automatically redirects or opens an existing/new note slug.
- **New Block Note**: \`${siteOrigin}/new/block\`
  Allocates a random short slug (4 chars) and initializes a BlockNote rich document.
- **New Markdown Note**: \`${siteOrigin}/new/markdown\`
  Allocates a random short slug and initializes a raw Markdown document.
- **New JSON Canvas**: \`${siteOrigin}/new/canvas\`
  Allocates a random short slug and initializes a JSON Canvas 1.0 2D card-and-edge graph workspace.
- **New Excalidraw Whiteboard**: \`${siteOrigin}/new/whiteboard\`
  Allocates a random short slug and initializes an Excalidraw freeform sketching whiteboard workspace.
- **Read & Edit Note**: \`${siteOrigin}/{slug}\`
  View or edit a note at \`/{slug}\`. Supports passcodes for view-locking (\`vpw\`) and edit-locking (\`pw\`).
- **Public Share View**: \`${siteOrigin}/share/{shareSlug}\`
  Clean, read-only public presentation view for shared notes with custom theme and reading progress.

---

## 3. Agent Integration & Machine APIs (AI & REST 介面說明)

### REST API Endpoints
- **Read Note**: \`GET ${siteOrigin}/api/{path}\`
  Returns raw note Markdown or JSON metadata. Non-author requests enforce vault state (410 when expired/burned, 423 when timelocked/deadman).
- **Write / Append Note**: \`POST ${siteOrigin}/api/{path}\`
  Accepts \`application/json\`, \`text/markdown\`, or \`multipart/form-data\`.
  Payload fields: \`text\` / \`content\`, \`append\` (boolean), \`share\` (boolean), \`publicIndex\` (boolean), \`pw\`, \`vpw\`, \`theme\`, \`width\`, \`shareMode\` (\`standard\`, \`burn\`, \`timelock\`, \`deadman\`), \`shareExpiresIn\`, \`shareBurnAfterReading\`, \`shareUnlockIn\`, \`sharePulseInterval\`.
  For Canvas, send the complete JSON Canvas document as a JSON-stringified \`text\` value with \`editorFormat: \"canvas\"\`; use \`GET /api/{path}\` to read it back.
  For Whiteboard, send the complete Excalidraw JSON document as a JSON-stringified \`text\` value with \`editorFormat: \"whiteboard\"\`; use \`GET /api/{path}\` to read it back.

### Calling Canvas (JSON Canvas 1.0) & Excalidraw Whiteboard (MCP & REST)

- **Native MCP JSON-RPC Endpoint**: \`POST ${siteOrigin}${MCP_PATH}\`
  - **JSON Canvas Tools**:
    - \`write_canvas\`: \`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"write_canvas","arguments":{"path":"arch-map","document":{"nodes":[{"id":"n1","type":"text","x":80,"y":80,"width":280,"height":140,"text":"# Service A"}],"edges":[]}}}}\`
    - \`read_canvas\`: \`{"path":"arch-map"}\`
    - \`validate_canvas\`: \`{"document":{"nodes":[...],"edges":[...]}}\`
    - \`generate_canvas_from_wikilinks\`: \`{"source_path":"my-md-note","canvas_path":"my-md-note-graph"}\`
  - **Excalidraw Whiteboard Tools**:
    - \`write_whiteboard\`: \`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"write_whiteboard","arguments":{"path":"sketch-1","document":{"type":"excalidraw","version":2,"elements":[{"id":"r1","type":"rectangle","x":100,"y":80,"width":260,"height":120,"strokeColor":"#1e1e1e"}],"appState":{"viewBackgroundColor":"#ffffff"}}}}}\`
    - \`read_whiteboard\`: \`{"path":"sketch-1"}\`
    - \`validate_whiteboard\`: \`{"document":{"type":"excalidraw","version":2,"elements":[...]}}\`
- **REST Write Example (Excalidraw / Canvas)**:
  - \`POST ${siteOrigin}/api/{path}\` with JSON body \`{"editorFormat":"whiteboard","share":true,"text":"{\\"type\\":\\"excalidraw\\",\\"version\\":2,\\"elements\\":[...]}"}\` (or \`"editorFormat":"canvas"\` with \`nodes\` / \`edges\`). Both return \`url\` / \`shareUrl\`.
- **Upload Image**: \`POST ${siteOrigin}/api/upload\`
  Uploads an image file to R2 storage and returns the image CDN URL.
- **Share Vault & Temporal Lifecycle Endpoints**:
  - Pulse Heartbeat: \`POST ${siteOrigin}/api/shares/{shareId}/pulse?token={pulseToken}\` (resets Dead Man's Switch timer)
  - Reveal Burn Secret: \`POST ${siteOrigin}/api/shares/{shareId}/reveal\` (atomically claims and destroys single-use secrets)
  - Vault PDF Export: \`GET ${siteOrigin}/share/{shareId}/export.pdf\` (requires \`burn_confirm=true\` for burn shares)
- **Markdown Utilities (Stateless)**:
  - Render to HTML: \`POST ${siteOrigin}/api/markdown/render\`
  - Parse HTML/URL: \`POST ${siteOrigin}/api/markdown/parse\`
  - Extract Structure: \`POST ${siteOrigin}/api/markdown/extract\`
  - Lint & Fix: \`POST ${siteOrigin}/api/markdown/lint\`
- **Line-Anchored Annotations**:
  - List annotations: \`GET ${siteOrigin}/api/shares/{shareId}/annotations\`
  - Create thread: \`POST ${siteOrigin}/api/shares/{shareId}/annotations\`
  - Reply to thread: \`POST ${siteOrigin}/api/shares/{shareId}/annotations/{threadId}/messages\`
  - Ask AI Assistant: \`POST ${siteOrigin}/api/shares/{shareId}/ai-assistant\`
- **Note Revision History**:
  - List versions: \`GET ${siteOrigin}/api/{path}/history\`
  - Read version: \`GET ${siteOrigin}/api/{path}/history/{versionId}\`
  - Restore version: \`POST ${siteOrigin}/api/{path}/history/{versionId}/restore\`
- **Health Check**: \`GET ${siteOrigin}${API_HEALTH_PATH}\`

### Agent Discovery & Protocols
- **Agent Skill File**: \`${siteOrigin}${AGENT_SKILL_PATH}\`
- **Agent Skills Index**: \`${siteOrigin}${AGENT_SKILLS_INDEX_PATH}\`
- **RFC 9727 API Catalog**: \`${siteOrigin}${API_CATALOG_PATH}\`
- **OpenAPI 3.1.0 Contract**: \`${siteOrigin}${OPENAPI_PATH}\`
- **API Documentation**: \`${siteOrigin}${API_DOCS_PATH}\`
- **Auth Guidance**: \`${siteOrigin}${AUTH_MD_PATH}\`
- **LLM Entry Index**: \`${siteOrigin}${LLMS_TXT_PATH}\`

---

## 4. Security & Access Control Model

- **Public Access**: Notes without \`pw\` or \`vpw\` are readable by anyone with the link.
- **View Lock (\`vpw\`)**: Password required to view or read the note content.
- **Edit Lock (\`pw\`)**: Password required to modify, overwrite, or delete the note.
- **Agent Password Auth**: Passwords can be supplied via \`Authorization: Bearer <pw>\` header, \`?pw=<pw>\` query parameter, or JSON body.
- **Share Vault Lifecycle Modes**:
  1. \`standard\`: Expiring share with countdown duration (\`shareExpiresIn\`: 10m, 1h, 1d, 7d, 30d, never). Returns 410 Gone when expired.
  2. \`burn\`: Single-use URL with interactive countdown and interstitial confirmation. Atomically destroyed on reveal. Author reads exempt.
  3. \`timelock\`: Completely sealed until future unlock timestamp (\`shareUnlockIn\`). Content withheld from DOM and API (returns 423 Locked).
  4. \`deadman\`: Dead Man's Switch sealed until author fails to check in via heartbeat webhook (\`sharePulseInterval\`). Automated cron-friendly reset.
- **10 Quick-Start Scenarios**: One-click presets for OTP, Crypto Inheritance, Whistleblower, Product Launch, Birthday Gift, Legal Hold, Scavenger Hunt, Course Content, Emergency Backup, and Shared Secret.

---

## 5. Development & Maintenance Team Credits

> 本專案由 DAVID888 (tbdavid2019) 傾力設計、開發與維護。

- **Repository**: [github.com/tbdavid2019/888wiki](https://github.com/tbdavid2019/888wiki)
- **Maintainer**: [DAVID888 (tbdavid2019)](https://github.com/tbdavid2019) - Lead Architecture & Developer
`
}

export function getDiscoveryLinks() {
    return [
        { href: LLMS_TXT_PATH, rel: 'llms-txt', type: 'text/markdown' },
        { href: API_CATALOG_PATH, rel: 'api-catalog' },
        { href: API_DOCS_PATH, rel: 'service-doc', type: 'text/markdown' },
        { href: OPENAPI_PATH, rel: 'service-desc', type: 'application/openapi+json' },
    ]
}

export function applyDiscoveryHeaders(headers) {
    for (const link of getDiscoveryLinks()) {
        const params = [`<${link.href}>`, `rel="${link.rel}"`]
        if (link.type) params.push(`type="${link.type}"`)
        headers.append('Link', params.join('; '))
    }
    return headers
}

function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;')
}

export function buildSitemapXml(entries = []) {
    const urls = entries.map(({ loc, lastmod }) => [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : null,
        '  </url>',
    ].filter(Boolean).join('\n')).join('\n')

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        urls,
        '</urlset>',
    ].filter(Boolean).join('\n')
}

export function buildRobotsTxt(origin = '') {
    const sitemapUrl = origin ? `${origin}${SITEMAP_PATH}` : SITEMAP_PATH

    return [
        `Sitemap: ${sitemapUrl}`,
        'User-agent: *',
        'Content-Signal: ai-train=no, search=yes, ai-input=no',
        'Allow: /.well-known/api-catalog',
        'Allow: /.well-known/agent-skills/',
        'Allow: /llms.txt',
        'Allow: /llms-full.txt',
        'Allow: /auth.md',
        'Allow: /docs/api',
        'Allow: /openapi.json',
        'Allow: /api/health',
        'Allow: /sitemap.xml',
        'Allow: /share/',
        'Disallow: /api/',
        'Disallow: /upload',
        '',
        'User-agent: GPTBot',
        'Content-Signal: ai-train=no, search=yes, ai-input=no',
        'Allow: /share/',
        'Allow: /.well-known/api-catalog',
        'Allow: /.well-known/agent-skills/',
        'Allow: /llms.txt',
        'Allow: /llms-full.txt',
        'Allow: /auth.md',
        'Allow: /docs/api',
        'Allow: /openapi.json',
        'Allow: /api/health',
        'Allow: /sitemap.xml',
        'Disallow: /api/',
        'Disallow: /',
        '',
        'User-agent: OAI-SearchBot',
        'Content-Signal: ai-train=no, search=yes, ai-input=no',
        'Allow: /share/',
        'Allow: /.well-known/api-catalog',
        'Allow: /llms.txt',
        'Allow: /llms-full.txt',
        'Allow: /auth.md',
        'Allow: /docs/api',
        'Allow: /openapi.json',
        'Allow: /api/health',
        'Allow: /sitemap.xml',
        'Disallow: /api/',
        'Disallow: /',
        '',
        'User-agent: Claude-Web',
        'Content-Signal: ai-train=no, search=yes, ai-input=no',
        'Allow: /share/',
        'Allow: /.well-known/api-catalog',
        'Allow: /.well-known/agent-skills/',
        'Allow: /llms.txt',
        'Allow: /llms-full.txt',
        'Allow: /auth.md',
        'Allow: /docs/api',
        'Allow: /openapi.json',
        'Allow: /api/health',
        'Allow: /sitemap.xml',
        'Disallow: /api/',
        'Disallow: /',
        '',
        'User-agent: Google-Extended',
        'Content-Signal: ai-train=no, search=yes, ai-input=no',
        'Allow: /share/',
        'Allow: /.well-known/api-catalog',
        'Allow: /llms.txt',
        'Allow: /llms-full.txt',
        'Allow: /auth.md',
        'Allow: /docs/api',
        'Allow: /openapi.json',
        'Allow: /api/health',
        'Allow: /sitemap.xml',
        'Disallow: /api/',
        'Disallow: /',
        '',
    ].join('\n')
}

export function buildOpenApiDocument(origin) {
    return {
        openapi: '3.1.0',
        info: {
            title: 'CF Notepad API',
            version: '1.0.0',
            description: 'Markdown note publishing API for reading, writing, uploads, and optional note history.',
        },
        servers: [
            { url: origin },
        ],
        components: {
            schemas: {
                NoteWriteRequest: {
                    type: 'object',
                    description: 'JSON body for creating, overwriting, or appending a markdown note.',
                    properties: {
                        text: { type: 'string', description: 'Markdown content to write.' },
                        content: { type: 'string', description: 'Alias for text.' },
                        append: { type: 'boolean', default: false },
                        share: { type: 'boolean', description: 'Whether the note has a public share link.' },
                        public: { type: 'boolean', description: 'Alias for share.' },
                        publicIndex: { type: 'boolean', description: 'Whether the share appears in sitemap.xml.' },
                        theme: { type: 'string' },
                        width: { type: 'string', enum: ['100%', '960px', '1200px', '1440px'], default: '1200px' },
                        pw: { type: 'string', description: 'Edit password or existing edit password.' },
                        vpw: { type: 'string', description: 'View password.' },
                        editorFormat: { type: 'string', enum: ['markdown', 'block', 'canvas', 'whiteboard'], description: 'Set to canvas for JSON Canvas or whiteboard for Excalidraw documents.' },
                        shareMode: { type: 'string', enum: ['standard', 'burn', 'timelock', 'deadman'], description: 'Security vault lifecycle mode.' },
                        shareExpiresIn: { type: 'string', description: 'Expiration duration (e.g. 10m, 1h, 1d, 7d, 30d, never).' },
                        shareBurnAfterReading: { type: 'boolean', description: 'Single-view self-destructing secret toggle.' },
                        shareUnlockIn: { type: 'string', description: 'Time-locked vault delay duration (e.g. 1h, 1d, 7d, 30d).' },
                        sharePulseInterval: { type: 'string', description: 'Dead Man Switch check-in interval (e.g. 1d, 7d, 30d).' },
                    },
                },
                CanvasDocument: {
                    type: 'object',
                    required: ['nodes', 'edges'],
                    properties: {
                        nodes: { type: 'array', description: 'JSON Canvas nodes.' },
                        edges: { type: 'array', description: 'JSON Canvas relationship edges.' },
                    },
                    description: 'Complete JSON Canvas 1.0 document. Canvas nodes support text, file, link, and group types; DAVID888 extensions live under david888.',
                },
                CanvasWriteRequest: {
                    type: 'object',
                    required: ['text', 'editorFormat'],
                    properties: {
                        text: { type: 'string', description: 'JSON.stringify(CanvasDocument). The REST API stores the complete document.' },
                        editorFormat: { type: 'string', const: 'canvas' },
                        share: { type: 'boolean', default: true },
                        public: { type: 'boolean', description: 'Alias for share.' },
                        publicIndex: { type: 'boolean' },
                        theme: { type: 'string' },
                        width: { type: 'string', enum: ['100%', '960px', '1200px', '1440px'], default: '1200px' },
                        pw: { type: 'string' },
                        vpw: { type: 'string' },
                    },
                },
                WhiteboardDocument: {
                    type: 'object',
                    required: ['elements'],
                    properties: {
                        type: { type: 'string', const: 'excalidraw' },
                        version: { type: 'number' },
                        elements: { type: 'array', description: 'Excalidraw elements (rectangles, arrows, text, etc.).' },
                        appState: { type: 'object', description: 'Optional Excalidraw canvas state.' },
                    },
                    description: 'Complete Excalidraw whiteboard document.',
                },
                WhiteboardWriteRequest: {
                    type: 'object',
                    required: ['text', 'editorFormat'],
                    properties: {
                        text: { type: 'string', description: 'JSON.stringify(WhiteboardDocument). The REST API stores the complete document.' },
                        editorFormat: { type: 'string', const: 'whiteboard' },
                        share: { type: 'boolean', default: true },
                        public: { type: 'boolean', description: 'Alias for share.' },
                        publicIndex: { type: 'boolean' },
                        theme: { type: 'string' },
                        width: { type: 'string', enum: ['100%', '960px', '1200px', '1440px'], default: '1200px' },
                        pw: { type: 'string' },
                        vpw: { type: 'string' },
                    },
                },
                NoteWriteData: {
                    type: 'object',
                    properties: {
                        msg: { type: 'string' },
                        url: { type: 'string', format: 'uri' },
                        shareUrl: { type: 'string', format: 'uri' },
                    },
                },
                NoteWriteResponse: {
                    type: 'object',
                    properties: {
                        err: { type: 'integer', const: 0 },
                        msg: { type: 'string' },
                        data: { $ref: '#/components/schemas/NoteWriteData' },
                    },
                },
            },
        },
        paths: {
            '/api/{path}': {
                get: {
                    summary: 'Read a note',
                    parameters: [
                        {
                            name: 'path',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' },
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'Note content or JSON metadata.',
                        },
                    },
                },
                post: {
                    summary: 'Create, overwrite, or append a note',
                    parameters: [
                        {
                            name: 'path',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' },
                        },
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            'application/json': {
                                schema: {
                                    oneOf: [
                                        { $ref: '#/components/schemas/NoteWriteRequest' },
                                        { $ref: '#/components/schemas/CanvasWriteRequest' },
                                        { $ref: '#/components/schemas/WhiteboardWriteRequest' },
                                    ],
                                },
                            },
                            'text/markdown': {
                                schema: { type: 'string', format: 'binary' },
                            },
                            'text/plain': {
                                schema: { type: 'string' },
                            },
                            'multipart/form-data': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        file: { type: 'string', format: 'binary' },
                                        markdown: { type: 'string', format: 'binary' },
                                        text: { type: 'string' },
                                        append: { type: 'string' },
                                        share: { type: 'string' },
                                        public: { type: 'string' },
                                        publicIndex: { type: 'string' },
                                        theme: { type: 'string' },
                                        width: { type: 'string', enum: ['100%', '960px', '1200px', '1440px'] },
                                        pw: { type: 'string' },
                                        vpw: { type: 'string' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': {
                            description: 'Save result with edit and share URLs.',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/NoteWriteResponse' },
                                },
                            },
                        },
                    },
                },
            },
            '/api/upload': {
                post: {
                    summary: 'Upload an image when R2 uploads are enabled',
                    responses: {
                        '200': {
                            description: 'Uploaded image URL.',
                        },
                    },
                },
            },
            '/api/{path}/history': {
                get: {
                    summary: 'List saved note history versions',
                    parameters: [
                        {
                            name: 'path',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' },
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'History version summaries.',
                        },
                    },
                },
            },
            '/api/{path}/history/{versionId}': {
                get: {
                    summary: 'Read one saved history version',
                    parameters: [
                        {
                            name: 'path',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' },
                        },
                        {
                            name: 'versionId',
                            in: 'path',
                            required: true,
                            schema: { type: 'integer' },
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'Historical note content.',
                        },
                    },
                },
            },
            '/api/{path}/history/{versionId}/restore': {
                post: {
                    summary: 'Restore one saved history version',
                    parameters: [
                        {
                            name: 'path',
                            in: 'path',
                            required: true,
                            schema: { type: 'string' },
                        },
                        {
                            name: 'versionId',
                            in: 'path',
                            required: true,
                            schema: { type: 'integer' },
                        },
                    ],
                    responses: {
                        '200': {
                            description: 'Restore result.',
                        },
                    },
                },
            },
            '/api/markdown/render': {
                post: {
                    summary: 'Render Markdown text into styled HTML',
                    responses: {
                        '200': {
                            description: 'Rendered HTML output.',
                        },
                    },
                },
            },
            '/api/markdown/parse': {
                post: {
                    summary: 'Convert HTML or webpage URL into Markdown',
                    responses: {
                        '200': {
                            description: 'Converted Markdown text.',
                        },
                    },
                },
            },
            '/api/markdown/extract': {
                post: {
                    summary: 'Extract plain text, headings, links, and word count stats from Markdown',
                    responses: {
                        '200': {
                            description: 'Extracted structured data.',
                        },
                    },
                },
            },
            '/api/markdown/lint': {
                post: {
                    summary: 'Validate and auto-fix Markdown syntax issues',
                    responses: {
                        '200': {
                            description: 'Lint results with issues and fixed markdown.',
                        },
                    },
                },
            },
            '/api/shares/{shareId}/annotations': {
                get: {
                    summary: 'List line-anchored annotations for a shared note',
                    responses: {
                        '200': {
                            description: 'Annotation thread list.',
                        },
                    },
                },
                post: {
                    summary: 'Create a new line-anchored annotation thread',
                    responses: {
                        '201': {
                            description: 'Created annotation thread.',
                        },
                    },
                },
            },
            '/api/shares/{shareId}/pulse': {
                post: {
                    summary: 'Send heartbeat check-in to reset Dead Man Switch timer',
                    parameters: [
                        { name: 'shareId', in: 'path', required: true, schema: { type: 'string' } },
                        { name: 'token', in: 'query', required: true, schema: { type: 'string' } },
                    ],
                    responses: {
                        '200': { description: 'Pulse received and timer reset.' },
                        '401': { description: 'Invalid pulse token.' },
                    },
                },
                get: {
                    summary: 'Send webhook heartbeat check-in via GET',
                    parameters: [
                        { name: 'shareId', in: 'path', required: true, schema: { type: 'string' } },
                        { name: 'token', in: 'query', required: true, schema: { type: 'string' } },
                    ],
                    responses: {
                        '200': { description: 'Pulse received and timer reset.' },
                        '401': { description: 'Invalid pulse token.' },
                    },
                },
            },
            '/api/shares/{shareId}/reveal': {
                post: {
                    summary: 'Reveal and atomically claim a burn-after-reading note',
                    parameters: [
                        { name: 'shareId', in: 'path', required: true, schema: { type: 'string' } },
                    ],
                    requestBody: {
                        required: false,
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        pw: { type: 'string', description: 'View or edit password if note is protected.' },
                                    },
                                },
                            },
                        },
                    },
                    responses: {
                        '200': { description: 'Note content revealed (destroyed for subsequent visits).' },
                        '410': { description: 'Note has already been burned and destroyed.' },
                        '423': { description: 'Note is time-locked or dead man switch is active.' },
                    },
                },
            },
            [API_HEALTH_PATH]: {
                get: {
                    summary: 'Health check',
                    responses: {
                        '200': {
                            description: 'Worker health response.',
                        },
                    },
                },
            },
        },
    }
}

export function requestAcceptsMarkdown(request) {
    const accept = String(request.headers.get('Accept') || '').toLowerCase()
    return accept.includes('text/markdown')
}

function yamlScalar(value) {
    return JSON.stringify(String(value || ''))
}

export function buildMarkdownDocument(markdown, metadata = {}) {
    const fields = Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== '')
    if (fields.length === 0) return String(markdown || '')

    const frontmatter = fields
        .map(([key, value]) => `${key}: ${yamlScalar(value)}`)
        .join('\n')

    return `---\n${frontmatter}\n---\n\n${String(markdown || '')}`
}

export function createMarkdownResponse(markdown, extraHeaders = {}) {
    return createDiscoveryResponse(
        markdown,
        'text/markdown; charset=UTF-8',
        extraHeaders,
    )
}

export function buildApiCatalog(origin) {
    return {
        linkset: [
            {
                anchor: `${origin}/api`,
                item: [
                    {
                        href: `${origin}/api/{path}`,
                    },
                    {
                        href: `${origin}/api/markdown/render`,
                    },
                    {
                        href: `${origin}/api/markdown/parse`,
                    },
                    {
                        href: `${origin}/api/markdown/extract`,
                    },
                    {
                        href: `${origin}/api/markdown/lint`,
                    },
                    {
                        href: `${origin}/api/shares/{shareId}/annotations`,
                    },
                ],
                'service-desc': [
                    {
                        href: `${origin}${OPENAPI_PATH}`,
                        type: 'application/openapi+json',
                    },
                ],
                'service-doc': [
                    {
                        href: `${origin}${API_DOCS_PATH}`,
                        type: 'text/markdown',
                    },
                ],
                status: [
                    {
                        href: `${origin}${API_HEALTH_PATH}`,
                        type: 'application/json',
                    },
                ],
            },
        ],
    }
}

async function sha256Hex(input) {
    const bytes = new TextEncoder().encode(input)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function buildAgentSkillsIndex() {
    return {
        $schema: AGENT_SKILLS_SCHEMA,
        skills: [
            {
                name: AGENT_SKILL_NAME,
                type: 'skill-md',
                description: 'Publish, read, and append Markdown, Block notes, JSON Canvas 1.0 diagrams, and Excalidraw whiteboards to David888 Wiki via REST API or /mcp.',
                url: AGENT_SKILL_PATH,
                digest: `sha256:${await sha256Hex(AGENT_SKILL_MARKDOWN)}`,
            },
        ],
    }
}

export function createDiscoveryResponse(body, contentType, extraHeaders = {}) {
    const headers = new Headers({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        ...extraHeaders,
    })
    applyDiscoveryHeaders(headers)
    return new Response(body, { headers })
}

export function getDiscoveryConstants() {
    return {
        AGENT_SKILL_PATH,
        AGENT_SKILLS_INDEX_PATH,
        API_CATALOG_PATH,
        API_CATALOG_PROFILE,
        MCP_PATH,
        API_DOCS_PATH,
        AUTH_MD_PATH,
        LLMS_TXT_PATH,
        LLMS_FULL_TXT_PATH,
        API_HEALTH_PATH,
        OPENAPI_PATH,
        SITEMAP_PATH,
    }
}
