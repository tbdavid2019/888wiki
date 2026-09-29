# 888wiki

**A Markdown-first knowledge workspace you can run in your own Cloudflare account.** Start with plain Markdown, capture voice, files, and web pages into it, then use Block, Canvas, or Whiteboard when the work calls for another shape.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/888wiki)

[Live site](https://wiki.david888.com) · [API](https://wiki.david888.com/api) · [Agent Skill](https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md)

## Capture voice, files, or web pages in one menu

The **+ New** menu moves content from wherever it starts into a note:

- **Live recording:** Save a local recording and player in IndexedDB, transcribe it when online, then upload it to the 888box attachment service when you publish or sync.
- **Import audio (Transcript):** Get a faithful transcript with timestamps.
- **Import audio (Smart format):** Turn speech into organized sections with AI.
- **Import file:** Convert Markdown, Office documents, PDFs, spreadsheets, and more into a note. Supported document conversion runs in the browser; drag and drop also offers attachment upload when you want to keep the original file.
- **Import website:** Extract supported public pages into Markdown; insert or replace content in the current note, or create the note from an empty editor.

The same import choices can create Markdown notes or convert content into editable Block documents.

## Choose the right workspace for the idea

| Mode | Best for | What you get |
| --- | --- | --- |
| **Markdown** | Articles, research, and technical notes | Live preview, math, diagrams, citations, imports, search and replace, and flexible layouts. |
| **Block** | Structured pages and mixed media | Rich editable blocks, slash commands, drag-to-reorder, editable embeds, and direct exports. |
| **Canvas** | Maps, plans, and connected ideas | Eight kinds of thought cards, labeled relationships, media cards, undo/redo, and `.canvas` / PNG / SVG export. |
| **Whiteboard** | Sketches and visual explanations | Excalidraw drawing tools, read-only sharing, and PNG / SVG export. |

## Seal: publish on a schedule, or let a rule decide

Seal separates content passwords from release timing. Set a scheduled unlock, burn a public share after a chosen number of views, release it after a missed check-in, or expire a link on a deadline. Ten presets cover single-view credential sharing (including the One-Time Password preset; 1-hour expiry), Shared Secrets (1-day expiry), Crypto Inheritance, Emergency Backup, Whistleblower disclosures, Product Launches, Birthday Gifts, Legal Holds, Scavenger Hunts, and Course Content. The One-Time Password preset controls a share; it does not generate or verify OTP codes. Presets never change the note body, and burning a share leaves the author's original note intact.

## Your writing and publishing workspace

- **AI writing:** Format, rewrite, and translate drafts; transcribe recordings with Groq as the primary provider and Workers AI as fallback.
- **Publish and present:** Share public or password-protected notes in a responsive reader featuring a left-side outline spine rail (dashes `-` for major headings, dots `·` for subheadings) and a slide-out TOC drawer, section-aware reading progress, one-tap dedicated print and vector PDF export, front-row import/export controls, Fitts's Law-optimized high-frequency visual controls (theme, dark mode, and preview width positioned right beside publish and save), unified security & access protection (edit lock, view lock, and Seal controls consolidated into the share dropdown for a streamlined bottom toolbar), developer & agent info consolidated into a single popover dropdown and auto-hidden on mobile RWD, mobile quick tools dropdown, restore D1 history, discuss selected passages, and present content as books or slides.
- **Work offline & Smart Sync:** Keep browser drafts in IndexedDB, monitor live sync status with a compact cloud icon state capsule (`[ ☁️🟢 | ▾ ]`, eliminating bulky text and layout shifts), toggle idle autosave, and sync pending changes or restore D1 cloud history on demand.
- **Keep control of the stack:** One-click deploy the Worker, KV/D1 note storage, and R2 image storage to your Cloudflare account. Core notes and images stay in your account; published audio and large-file attachments use the external 888box service.

## A Markdown workspace with room to shape the page

Markdown is the starting point: write portable plain text, preview it live, and use math, diagrams, citations, footnotes, alerts, and extended Markdown syntax. Enjoy clean, standardized Lucide and Tabler vector iconography with pixel-perfect vertical and horizontal centering across all toolbars, menus, and modals. Editor toolbars feature Fitts's Law-optimized visual controls and a compact cloud save capsule, using a consistent warm palette in light and dark UI modes with restrained active states and square-corner controls. Receive inspiration from bilingual editor tips and Tagore's Stray Birds poetry upon opening a new note. Choose from 20 colorful light and dark themes, fonts, preview widths, and split layouts. The same Markdown can become a book or slide presentation.

## Built for agents and automation

Connect compatible agents and LLM clients through the native `/mcp` endpoint, browser WebMCP tools, the REST API and OpenAPI description, or the published [Agent Skill](https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md). These interfaces let agents read, create, and publish wiki content using documented formats and permissions.

## Get started

- [Deploy and configure 888wiki](docs/INSTALLATION.md) · [繁體中文安裝指南](docs/INSTALLATION.zh-TW.md)
- [How to capture, write, publish, and use Seal](docs/USAGE.md) · [繁體中文使用指南](docs/USAGE.zh-TW.md)
- [Complete feature guide](docs/FEATURES.md) · [繁體中文功能詳情](docs/FEATURES.zh-TW.md)
- [繁體中文專案首頁](README.zh-TW.md) · [Changelog](CHANGELOG.md)

The installation guide lists required secrets, every optional parameter, and the defaults included in the deployment configuration.

## Project

- [Source code](https://github.com/tbdavid2019/888wiki)
- [Report an issue](https://github.com/tbdavid2019/888wiki/issues)
- License: AGPL-3.0
