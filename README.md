# 888wiki

**A Markdown-first knowledge workspace you can run in your own Cloudflare account.** Start with plain Markdown, capture voice, files, and web pages into it, then use Block, Canvas, or Whiteboard when the work calls for another shape.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/888wiki)

[Live site](https://wiki.david888.com) · [API](https://wiki.david888.com/api) · [Agent Skill](https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md)

## Passkeys, My Space, and Share Circles

With D1 configured, create a Passkey account to organize published notes across Markdown, Block, Canvas, and Whiteboard in private My Space (`/_space`). Upon registering or signing in, `/_space` prompts you to review and import locally cached published notes (restoring `edit` access when browser author cookies match) and browser guest share history, or paste existing note/share URLs to claim them; unpublished browser drafts stay local until you publish & sync them from the Local Drafts tab. Account sign-in does not grant edit access or bypass note passwords or Seal. Annotations can be signed with your nickname or posted anonymously.

Bookmarks are private by default. Explicitly add eligible public notes to a Share Circle; circles start off, can be disabled immediately, and their public links can be rotated. Add a second Passkey while you still have access: there is no email or phone recovery. Passkeys are bound to the site's domain, and admin FIDO credentials are separate from user accounts.

Space marks deleted or replaced notes unavailable and lets you remove stale entries, including annotation-only entries. A View Lock alone prevents a bookmark from being upgraded to edit access without edit proof; protected bookmarks remain masked. Share Circles exclude all Seal modes, even after a time lock or dead man's switch has elapsed.

Accounts, Space, and Circles require D1 and disable gracefully in intentional pure KV mode. Operators must initialize the correct bindings, set `SCN_SECRET`, and follow the [installation guide](docs/INSTALLATION.md) for the mandatory one-way legacy cutover, pinned D1 fail-closed settings, optional paired Turnstile keys, and secret hygiene.

During `SCN_MAINTENANCE_MODE=1`, note and share reads, exports, annotations, Space and Circle access, and MCP note tools return maintenance errors; static assets and `/api/health` remain available. Required or pinned note registries also protect KV deletion if D1 is unavailable. For `db:init --env` and legacy migration with `--env`, configure vars and KV, R2, and D1 bindings explicitly in that named environment; root values are not inherited.

## Capture voice, files, or web pages in one menu

The **+ New** menu moves content from wherever it starts into a note:

- **Live voice dictation:** Stream speech directly into the editor cursor position with sub-200ms latency and append-only non-flickering typing powered by Confucius4-R2T2 ASR (`asr.5gao.ai`). Fully supported in both Markdown and Block editors; the Markdown toolbar button sits at the far left for quick access (alongside Slash command `/dictate` and `Cmd/Ctrl + Shift + D`). Smart background liveness detection reveals the button when online and hides it when offline.
- **Live recording:** Save a local recording and player in IndexedDB, transcribe it when online, then upload it to the 888box attachment service when you publish or sync.
- **Import audio (Transcript):** Get a faithful transcript with timestamps.
- **Import audio (Smart format):** Turn speech into organized sections with AI.
- **Import file:** Convert Markdown, Office documents, PDFs, spreadsheets, and more into a note. Supported document conversion runs in the browser; drag and drop also offers attachment upload when you want to keep the original file. Images support pure local PaddleOCR.js Web Worker recognition (toggleable **Auto-OCR on Image Import** and **Enhanced `PP-OCRv6 small` (~30 MB) vs lightweight `PP-OCRv6 tiny`** in the Tools Palette, loaded on demand with serial mutex queuing).
- **Import website:** Extract supported public pages into Markdown; insert or replace content in the current note, or create the note from an empty editor.

The same import choices can create Markdown notes or convert content into editable Block documents.

## For AI agents & LLMs

Install or update the official **David888 Wiki** agent skill (covering Markdown, Block, JSON Canvas 1.0, Excalidraw whiteboards, Share Vault modes, and `/mcp`) across Claude Code, Codex, Antigravity, Gemini, Cursor, and OpenCode.

> **Tip:** Since wiki syntax and MCP tools evolve frequently, run the `update` command before starting an AI workflow so your agent always holds the newest capabilities:

```bash
# Install or update globally to the latest live SKILL.md (recommended before every use)
npx --yes 888wiki-skill update --global -y

# Or install via Vercel Agent Skills CLI from GitHub
npx --yes skills add tbdavid2019/888wiki -g -y
```

## Choose the right workspace for the idea

| Mode | Best for | What you get |
| --- | --- | --- |
| **Markdown** | Articles, research, and technical notes | Live preview, live voice dictation, math, ultra-fast Pele/Mermaid diagrams (sub-millisecond rendering with theme-aware PNG/SVG export), citations, imports, search and replace, and flexible layouts. |
| **Block** | Structured pages and mixed media | Rich editable blocks with native Light/Dark mode, `--preview-max-width` columns, 20-theme palette styling, live voice dictation (`/dictate`), slash commands, floating formatting toolbar, drag-to-reorder, editable embeds, and direct exports. |
| **Canvas** | Maps, plans, and connected ideas | Eight kinds of thought cards, labeled relationships, media cards, undo/redo, and `.canvas` / PNG / SVG export. |
| **Whiteboard** | Sketches and visual explanations | Excalidraw drawing tools, read-only sharing, and PNG / SVG export. |

## Seal: publish on a schedule, or let a rule decide

Seal separates content passwords from release timing. Set a scheduled unlock, burn a public share after a chosen number of views, release it after a missed check-in, or expire a link on a deadline. Ten presets cover single-view credential sharing (including the One-Time Password preset; 1-hour expiry), Shared Secrets (1-day expiry), Crypto Inheritance, Emergency Backup, Whistleblower disclosures, Product Launches, Birthday Gifts, Legal Holds, Scavenger Hunts, and Course Content. The One-Time Password preset controls a share; it does not generate or verify OTP codes. Presets never change the note body, and burning a share leaves the author's original note intact.

## Your writing and publishing workspace

- **AI writing & assistance:** Format, rewrite, and translate drafts; answer reader questions with Ask AI; transcribe recordings with a 3-tier resilient gateway (Tier 1 `llm.aiurl.tw` with `group/talk` in Fast priority mode, Tier 2 Groq `openai/gpt-oss-120b`, and Tier 3 Workers AI) equipped with anti-thundering herd circuit breakers, jittered backoffs, and single-flight request coalescing.
- **Publish and present:** Share public or password-protected notes in a responsive reader featuring a **single-layer IDE bottom bar** in edit mode (`[ + New ▾ ]`, `[ 📄 Draft / 🌐 Live ▾ ]`, 1-click **`[ Share URL / Copy URL ]`** to publish or background-sync and copy the public link mid-edit without interrupting typing, inline cursor status, flat segmented view toggles, a standalone unified **`[ 🎨 Theme ▾ ]`** popover combining Light/Dark/Auto UI polarity, live `JetBrains Mono / Maple Mono` preview fonts, preview widths, and all 20 typography themes with `🌙` dark-theme badges and automatic dark editor sync, Copy/Export menus including **editable 16:9 `.pptx` PowerPoint export**, a focused **`Cmd/Ctrl + Shift + P` Tools Palette** for writing stats, citations, math copy format, **print-ready document & slide templates** (`One-Pager`, `Whitepaper`, `Resume/CV`, `Meeting Minutes`, `Slides`), and docs/PWA, plus a top-level **`[ 文A 中 / EN ]`** language switch), alongside an elegant Hierarchical Milestone Dots outline navigation and slide-out TOC drawer (`?toc=1` sync), privacy-preserving Flow analytics (`flow.aiurl.tw`), D1 history restore, inline annotations, Book mode, and **Presentation Mode** with live slide transition switching (`fade`/`slide`/`convex`/`zoom`/`none`), **12-second seamless Canvas Motion Loop backdrops** (`aurora`/`mesh`/`orbits`, respecting `prefers-reduced-motion` on auto-play while allowing manual toggle override, and also powering the `wiki.david888.com` homepage loading/landing stage), and `.pptx`/PDF/PNG slide export.
- **Work offline & Smart Sync:** Keep browser drafts in IndexedDB, monitor live sync status with the single button (`[ ☁️🟢 Live ▾ ]` when live vs `[ ☁️⚪ Publish ▾ ]` in draft, eliminating bulky text and layout shifts), with dynamic labels ("Publish & Sync to Cloud" in draft vs "Sync to Cloud Now" when live), toggle idle autosave, and sync pending changes or inspect and restore D1 cloud history on demand (accessible from both the Save & Sync menu and the publication status version count).
- **Bot protection & billing guard:** Cloudflare Turnstile integration shields note saves, uploads, publishing, and AI operations against bot abuse and billing spikes. Features a dedicated interactive security verification modal (`#turnstile-modal`) with automatic action retry upon completion, non-intrusive autosave status hints, comprehensive **graceful degradation (fail-open fallback)** to prevent blocking saves during upstream outages or ad-blocker script blocks, alongside IP-bound clearance session cookies, strict FIDO2/Passkey attestation & sign-count verification, SSRF/XSS/SVG-sandbox hardening, and full exemptions for REST/MCP automation APIs.
- **Keep control of the stack:** One-click deploy the Worker, KV/D1 note storage, and R2 image storage to your Cloudflare account (with native `/img/*` R2 serving fallback when `SCN_R2_DOMAIN` is unset). Core notes and images stay in your account; published audio and large-file attachments use the external 888box service.

## A Markdown workspace with room to shape the page

Markdown is the starting point: write portable plain text, preview it live, and use math, diagrams (powered by Obsidian's high-performance Pele engine with sub-millisecond rendering, CSS theme adaptation, and native Mermaid fallback), citations, footnotes, alerts, and extended Markdown syntax. Enjoy clean, standardized Lucide and Tabler vector iconography with pixel-perfect vertical and horizontal centering across all toolbars, menus, and modals. The entire editor shell (App Shell, toolbars, status bar, footer, and modals) is designed around the `2md.aiurl.tw` flagship color system (Saffron Warm Cream `#fff9e8` with terracotta accents for light mode, and Saffron Midnight `#131b24` with golden amber accents for dark mode, fully compliant with WCAG AA/AAA contrast standards). Editor toolbars feature Fitts's Law-optimized visual controls, a compact cloud save capsule, restrained active states, and square-corner controls. Receive inspiration from bilingual editor tips and Tagore's Stray Birds poetry upon opening a new note. Choose from 20 colorful light and dark themes (fully recalibrated with CSS cascade testing to WCAG 2.1 AA standards across prose, headings, inline code, blockquotes, tables, and GitHub Alerts, with `:where()` base table/alert isolation, `overflow-x: auto` scrollable tables, `16px` baseline readability, and Traditional Chinese CJK font fallbacks, including a crisp Win95 document window for Retro), fonts, preview widths, and split layouts. Dynamic diagram and chart theming matches both Mermaid and ECharts seamlessly to dark or light reading environments. The same Markdown can become a book or slide presentation.

## Built for agents and automation

Connect compatible agents and LLM clients through the native `/mcp` endpoint, browser WebMCP tools, the REST API and OpenAPI description, `/llms.txt`, or the published [Agent Skill](https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md) (keep local copies fresh anytime with `npx --yes 888wiki-skill update --global -y`). These interfaces let agents read, create, and publish Markdown, Block, Canvas, and Excalidraw wiki content using documented formats and permissions.

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
