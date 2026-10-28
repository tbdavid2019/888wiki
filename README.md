# 888wiki

**A Markdown-first knowledge workspace you can run in your own Cloudflare account.** Start with plain Markdown, capture voice, files, and web pages into it, then use Block, Canvas, or Whiteboard when the work calls for another shape.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/888wiki)

[Live site](https://wiki.david888.com) · [API](https://wiki.david888.com/api) · [Agent Skill](https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md)

## Capture voice, files, or web pages in one menu

The **+ New** menu moves content from wherever it starts into a note:

- **Live voice dictation:** Stream speech directly into the editor cursor position with sub-200ms latency and append-only non-flickering typing powered by Confucius4-R2T2 ASR (`asr.5gao.ai`). Fully supported in both Markdown and Block editors; the Markdown toolbar button sits at the far left for quick access (alongside Slash command `/dictate` and `Cmd/Ctrl + Shift + D`). Smart background liveness detection reveals the button when online and hides it when offline.
- **Live recording:** Save a local recording and player in IndexedDB, transcribe it when online, then upload it to the 888box attachment service when you publish or sync.
- **Import audio (Transcript):** Get a faithful transcript with timestamps.
- **Import audio (Smart format):** Turn speech into organized sections with AI.
- **Import file:** Convert Markdown, Office documents, PDFs, spreadsheets, and more into a note. Supported document conversion runs in the browser; drag and drop also offers attachment upload when you want to keep the original file.
- **Import website:** Extract supported public pages into Markdown; insert or replace content in the current note, or create the note from an empty editor.

The same import choices can create Markdown notes or convert content into editable Block documents.

## Choose the right workspace for the idea

| Mode | Best for | What you get |
| --- | --- | --- |
| **Markdown** | Articles, research, and technical notes | Live preview, live voice dictation, math, ultra-fast Pele/Mermaid diagrams (sub-millisecond rendering with theme-aware PNG/SVG export), citations, imports, search and replace, and flexible layouts. |
| **Block** | Structured pages and mixed media | Rich editable blocks, live voice dictation (`/dictate`), slash commands, floating formatting toolbar, drag-to-reorder, editable embeds, and direct exports. |
| **Canvas** | Maps, plans, and connected ideas | Eight kinds of thought cards, labeled relationships, media cards, undo/redo, and `.canvas` / PNG / SVG export. |
| **Whiteboard** | Sketches and visual explanations | Excalidraw drawing tools, read-only sharing, and PNG / SVG export. |

## Seal: publish on a schedule, or let a rule decide

Seal separates content passwords from release timing. Set a scheduled unlock, burn a public share after a chosen number of views, release it after a missed check-in, or expire a link on a deadline. Ten presets cover single-view credential sharing (including the One-Time Password preset; 1-hour expiry), Shared Secrets (1-day expiry), Crypto Inheritance, Emergency Backup, Whistleblower disclosures, Product Launches, Birthday Gifts, Legal Holds, Scavenger Hunts, and Course Content. The One-Time Password preset controls a share; it does not generate or verify OTP codes. Presets never change the note body, and burning a share leaves the author's original note intact.

## Your writing and publishing workspace

- **AI writing:** Format, rewrite, and translate drafts; transcribe recordings with Groq as the primary provider and Workers AI as fallback.
- **Publish and present:** Share public or password-protected notes in a responsive reader featuring a far-left direct share open button on the editor publication bar (with a lively periodic nudge shake animation and one-tap new tab navigation), clutter-free hiding of human-meaningless raw URL strings with an instant copy button, an elegant Hierarchical Milestone Dots System for reading outline navigation (expansively adapting to document headings with subtle hierarchical dots sized 7px to 3px across H1~H6 headings, completely eliminating dense bar grating and visual clutter; featuring low-opacity unobtrusive markers, active reading section pulse highlights with accent halo glow, smooth floating title tooltips on hover, and click-to-scroll navigation), a redesigned bottom-left edit split action capsule with generous layout and crisp 24x24 standard vector pencil icon (or reconstructed 17px/20px editLock icon, eliminating all microscopic squeeze distortions), a 64px non-overlapping left safety gutter, clean bullet-free modern outline indentation, and an interactive slide-out TOC drawer aligned with footer theme palettes featuring fluid desktop "Push on Pin" full-height seamless responsive sidebar layout (gliding the article rightward to ensure zero text occlusion and eliminating all vertical gaps when pinned, with high-contrast text in dark mode; plus bidirectional URL routing sync `?toc=1` preserving pinned TOC state and heading anchors across shares with in-drawer quick copy button); one-tap dedicated print and vector PDF export, front-row import/export controls, Fitts's Law-optimized high-frequency visual controls (theme, dark mode, and preview width positioned right beside publish and save), unified security & access protection (edit lock, view lock, and Seal controls consolidated into the share dropdown for a streamlined bottom toolbar), developer & agent info consolidated into a single popover dropdown and auto-hidden on mobile RWD, mobile quick tools dropdown, privacy-preserving Flow traffic analytics tracking (`flow.aiurl.tw`), restore D1 history, discuss selected passages, and present content as books or slides.
- **Work offline & Smart Sync:** Keep browser drafts in IndexedDB, monitor live sync status with a compact cloud icon state capsule (`[ ☁️🟢 | ▾ ]`, eliminating bulky text and layout shifts), toggle idle autosave, and sync pending changes or inspect and restore D1 cloud history on demand (accessible from both the Save & Sync menu and the publication status version count).
- **Bot protection & billing guard:** Optional Cloudflare Turnstile integration shields note saves, uploads, and AI endpoints against bot abuse and billing spikes with seamless clearance session cookies, while keeping REST and MCP APIs open for automation.
- **Keep control of the stack:** One-click deploy the Worker, KV/D1 note storage, and R2 image storage to your Cloudflare account. Core notes and images stay in your account; published audio and large-file attachments use the external 888box service.

## A Markdown workspace with room to shape the page

Markdown is the starting point: write portable plain text, preview it live, and use math, diagrams (powered by Obsidian's high-performance Pele engine with sub-millisecond rendering, CSS theme adaptation, and native Mermaid fallback), citations, footnotes, alerts, and extended Markdown syntax. Enjoy clean, standardized Lucide and Tabler vector iconography with pixel-perfect vertical and horizontal centering across all toolbars, menus, and modals. The entire editor shell (App Shell, toolbars, status bar, footer, and modals) is designed around the `2md.aiurl.tw` flagship color system (Saffron Warm Cream `#fff9e8` with terracotta accents for light mode, and Saffron Midnight `#131b24` with golden amber accents for dark mode, fully compliant with WCAG AA/AAA contrast standards). Editor toolbars feature Fitts's Law-optimized visual controls, a compact cloud save capsule, restrained active states, and square-corner controls. Receive inspiration from bilingual editor tips and Tagore's Stray Birds poetry upon opening a new note. Choose from 20 colorful light and dark themes (fully recalibrated to WCAG 2.1 AA standards with >= 4.5:1 text/link contrast and >= 3.0:1 boundary contrast, including a crisp Win95 document window for Retro), fonts, preview widths, and split layouts. Dynamic diagram and chart theming matches both Mermaid and ECharts seamlessly to dark or light reading environments. The same Markdown can become a book or slide presentation.

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
