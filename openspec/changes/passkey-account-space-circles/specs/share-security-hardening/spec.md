# Share Security Hardening Specification

## Purpose

Eliminates prerequisite share edit-path leaks, client history pollution, same-origin XSS surfaces, third-party script leaks, response status/caching defects, share-alias repointing, and route-namespace collisions before issuing site-wide account session cookies.

## ADDED Requirements

### Requirement: Eliminate share-page, title-fallback, PDF, Seal, reveal, and alias-repointing leaks
The system SHALL omit internal `path` values, `path` title fallbacks, `/${path}` edit links, and secret metadata from all non-author share outputs (HTML, Markdown, PDF, Seal status, and `/reveal`), and SHALL forbid reassigning existing `shares` mappings across all write and self-heal paths.

#### Scenario: Non-author loads a share page, Markdown export, PDF export, Seal status, or burn reveal
- **WHEN** a non-author requests `/share/:shareId` (HTML, `Accept: text/markdown`, pre-reveal burn interstitial, `POST /share/:shareId/reveal`, `POST /share/:shareId/present/reveal`, `POST /share/:shareId/book/reveal`, `GET`/`HEAD` with or without `?reveal=1`, or PDF export), direct note endpoints (`GET /api/:path`, `GET`/`HEAD /:path`, direct `/:path` PDF export), `/api/:path/history*`, Seal status page, posts to `/api/shares/:shareId/reveal`, invokes non-author MCP content readers (`read_note`, `read_canvas`, `read_whiteboard`, `generate_canvas_from_wikilinks`) or share annotations (`/api/shares/:shareId/annotations*`) on an `isBurnProtected(meta)` note, or authenticates via `POST /share/:shareId/auth`
- **THEN** the footer edit link, `note_path` frontmatter, untitled `path` title fallbacks, PDF `path` metadata fallback/filename, Seal status `path` identifier, pre-reveal burn `content`-derived title/social/`<meta>` descriptions, and reveal JSON `path` / secret metadata fields are omitted; ordinary `GET`/`HEAD` (with or without `?reveal=1`) NEVER release burn content; `/api/:path/history*` requires positive edit proof on `isBurnProtected(meta)` notes (even if passwordless); un-backfilled burn shares fail closed (`409` HTTP or MCP JSON-RPC `isError: true` conflict envelope for single/batched calls) across ALL non-author release, direct, history, annotation, and MCP content routes without falling back to non-atomic KV burn counters; and `POST /share/:shareId/auth` issues a path-free view credential `{ shareId, role: 'view', noteUid, exp }` (never encoding `path` into `auth` cookies for `role === 'view'`)

### Requirement: Fix `share-history:created` recording on read-only share pages
The system SHALL record `cf-notepad:share-history:created` only when `APP_STATE.isEdit` is true or when the author explicitly publishes a note, preventing viewed share pages from polluting `created` history.

#### Scenario: Viewing another user's shared note
- **WHEN** a user visits `/share/:shareId` in read-only mode (`APP_STATE.isEdit === false`)
- **THEN** the browser records the visit only in `cf-notepad:share-history:viewed` and does NOT write to `cf-notepad:share-history:created`

### Requirement: Eliminate same-origin XSS surfaces, enforce `SCN_ENABLE_WEBTALK`, and isolate account/circle CSP
The system SHALL sanitize all diagram SVG outputs (failing closed when `DOMPurify` is absent), sanitize book-export HTML and escape titles, render error messages safely as text, gate `webtalk.js` strictly on `SCN_ENABLE_WEBTALK === '1'`, and enforce strict CSP + `Referrer-Policy: no-referrer` on `/_space` and `/c/:publicToken`.

#### Scenario: Rendering untrusted Markdown, persisted themes, or missing sanitizer across view modes
- **WHEN** a note containing crafted Mermaid/Pele/Graphviz payloads, invalid Markdown raising render errors, malicious chapter HTML/titles, or an unvalidated/crafted persisted `theme` string is opened across Markdown, Block, Canvas, Whiteboard, Presentation, or Book views, OR `DOMPurify` fails to load
- **THEN** `theme` is validated against `ALL_PREVIEW_THEMES` on write and allowlisted on render (using safe `safeJsonForInlineScript` serialization instead of raw `'${pageTheme}'` or unescaped `JSON.stringify` in `<script>` contexts), executable HTML/script payloads are stripped or rendered as plain text before DOM insertion, and diagram renderers fail closed without raw SVG `innerHTML` fallback

#### Scenario: Tombstone-aware listing and canonical registry Sitemap projections
- **WHEN** `driverListNotes` enumerates KV fallback entries or `/sitemap.xml` emits share URLs under `isNotesRegistryEnabled()`
- **THEN** tombstoned KV entries (including `'__legacy__'` for untagged copies) are suppressed cleanly and Sitemap uses authoritative `share_token_registry` tokens without `MD5(path)` fallbacks

#### Scenario: Disabling WebTalk and isolating `/_space` and `/c/:publicToken`
- **WHEN** `SCN_ENABLE_WEBTALK` is `"0"` or unset on share pages, OR a user loads `/_space` or `/c/:publicToken`
- **THEN** share pages omit `webtalk.js`, and `/_space` / `/c/:publicToken` omit third-party analytics/WebTalk scripts and send strict CSP and `Referrer-Policy: no-referrer`

### Requirement: Route namespace isolation, `returnPage`/`Page404` HTTP status parity, SW cache bypass, and crawler policy
The system SHALL register `/_space`, `/c/:publicToken`, and multi-segment `/api/{auth,account,space,circles}/*` routes before wildcard `/:path` and `/api/:path` handlers, enforce `RESERVED_SLUGS` across random allocators and custom-path write APIs/MCP (plus health checks on dynamic `SCN_ADMIN_PATH`), ensure `returnPage` and `Page404` honor explicit HTTP status codes for both `GET` and `HEAD`, exclude protected routes from Service Worker caches, and disallow crawler indexing.

#### Scenario: Disabled/missing circle or unmatched route returns true HTTP 404 on GET and HEAD
- **WHEN** a client sends `GET` or `HEAD` to a disabled/non-existent `/c/:publicToken` or an unmatched 404 fallback route
- **THEN** the response status is HTTP `404` with `Cache-Control: no-store` (not HTTP `200`)

#### Scenario: Service Worker and crawlers bypass `/_space`, `/c/`, and account APIs
- **WHEN** a browser with an active Service Worker requests `/_space`, `/c/:publicToken`, or `/api/{auth,account,space,circles}/*`, or a crawler fetches `/robots.txt`
- **THEN** the Service Worker bypasses Cache Storage before image/static rules, and `/robots.txt` disallows `/_space`, `/c/`, `/api/auth/`, `/api/account/`, `/api/space/`, and `/api/circles/`
