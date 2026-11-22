# Public Share Circles Specification

## Purpose

Allows authenticated accounts to create multiple named, toggleable topic collections (`/c/:publicToken`) with rotatable non-enumerable URLs, private-first creation and bookmarking defaults, canonical high-entropy non-path share outputs, and strict authoritative live public eligibility filtering.

## ADDED Requirements

### Requirement: Multiple toggleable Share Circles with rotatable non-enumerable URLs
The system SHALL allow an authenticated user to create up to 20 named Share Circles (name `<= 80` characters, defaulting `is_enabled` to OFF on creation unless explicitly enabled by the user), toggle visibility on or off immediately, rotate the circle's CSPRNG `public_token` (`>= 16` bytes) without losing curated circle items, and publish enabled circles at `/c/:publicToken` with `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, and strict CSP.

#### Scenario: Toggling a Share Circle off takes immediate effect
- **WHEN** the owner switches a Share Circle to OFF
- **THEN** subsequent `GET` and `HEAD` requests to `/c/:publicToken` immediately return HTTP `404` without exposing circle metadata or cached items

#### Scenario: Rotating a Share Circle URL invalidates the old link while preserving items
- **WHEN** the owner rotates a Share Circle's public link
- **THEN** the system atomically updates `public_token` on the circle record so the previous `/c/:oldToken` URL returns HTTP `404` while all curated items remain intact under `/c/:newToken`

### Requirement: Private-by-default manual bookmarking
The system SHALL default manual bookmarking actions to saving into the user's private `/_space` only, requiring explicit opt-in selection to add a note into any Share Circle, and atomically enforcing per-circle item quotas (`<= 200`) while blocking ineligible notes from being added.

#### Scenario: Bookmarking a note defaults to private My Space
- **WHEN** an authenticated user clicks bookmark/collect on a note or share page
- **THEN** no public Share Circle is pre-checked by default, and eligible circles are shown with clear ON/OFF status badges for explicit opt-in

#### Scenario: Attempting to add an ineligible note or missing-UID note to a Share Circle
- **WHEN** an authenticated user attempts to add an unpublished, `vpw`-protected, weak/legacy `path`/`MD5(path)`-only, expired, burned, Seal (`burn`/`timelock`/`deadman`), or non-existent/unreconcilable note to a Share Circle
- **THEN** if the note exists, reconciles a verifiable `note_uid` in D1, and is either `edit`-owned or currently publicly readable, it may be saved to private `/_space` only; otherwise indexing fails closed (keeping `account_space_items.note_uid` strictly non-null) and adding to any public Share Circle is rejected

### Requirement: Authoritative live public eligibility filtering and canonical share tokens
When D1 `notesDb` is active (`isNotesRegistryEnabled()`), the system SHALL issue non-reusable `>= 16`-byte CSPRNG non-path `shareSlug` tokens, SHALL enforce atomic `(noteUid, metaVersion)` CAS writes, deletions, and `(path, deleted_note_uid)` tombstones, and SHALL evaluate live metadata and `note_uid` on every read of `/c/:publicToken`.

#### Scenario: Enforcing non-path canonical links, atomic share batches, and live eligibility rules
- **WHEN** any share endpoint resolves `/share/:shareId` in D1-registry deployments or the system renders `/c/:publicToken`
- **THEN** all share writes, revocations, burns, and expiries gate `share_token_registry` and `shares` mutations on `shareOpNonce` matching the committed `notes` CAS update (with `INSERT INTO share_token_registry` rolling back on PK conflict for CSPRNG retry, recording `is_csprng_v1` provenance and `revoked_reason`, and mirroring `SHARE` KV only after committed `changes === 1`)
- **AND** all share entrypoints obey one authoritative `share_token_registry` + `shares` + `note_uid` resolver (using metadata-only `resolveAuthoritativeShareMetadata` for Circles, Space, and Sitemap projections without reading `content`, never bypassing to `path` probing, excluding `path`/`MD5(path)`/path-bearing aliases and `path` title fallbacks, and permitting on `/c/:publicToken` ONLY items whose active registry entry satisfies `is_csprng_v1 === 1`, `share === true`, `!vpw`, matching `note_uid`, non-revoked registry entry, no deletion tombstone, and no Seal/expiry/burn, while preserving HTTP `410` for `'burned'`/`'expired'` revoked links)

#### Scenario: Safely claiming legacy opaque 6-character shares and pre-burned/expired terminal status
- **WHEN** a pre-cutover active or pre-burned/expired published note (using non-conflicting legacy `metadata.shareSlug || metadata.shareId`, including mapping-less active D1 rows before initial `noteUid` claim and pre-burned/expired notes located via `SHARE_STATUS:<shareId>` KV or metadata-only D1 `notes` lookup without exposing content) has a strictly opaque `/^[A-Za-z0-9]{6}$/` or `/^[A-Za-z0-9_-]{22,}$/` non-path/non-MD5 token absent from `share_token_registry`
- **THEN** un-backfilled KV-only notes are promoted to authoritative D1 ONLY by quiesced cutover backfill or authenticated author writes (read-only `/share/:shareId` / metadata callers read untombstoned KV directly without promoting a potentially stale KV replica into D1, while un-backfilled `isBurnProtected(meta)` burn/burn-after-reading shares emit ONLY a content-free burn interstitial omitting content-derived title/description metadata and fail closed `409` across ALL non-author burn read & release routes—`POST /share/:shareId/reveal`, `POST /share/:shareId/present/reveal`, `POST /share/:shareId/book/reveal`, `POST /api/shares/:shareId/reveal`, `GET`/`HEAD` keeping `?reveal=1` non-consuming, confirmed PDF export, direct `/api/:path`, `/:path`, direct PDF export, `/api/shares/:shareId/annotations*`, `/api/:path/history*`, and non-author MCP `read_note`/`read_canvas`/`read_whiteboard`/`generate_canvas_from_wikilinks` returning JSON-RPC `isError: true` conflict envelope), while D1 legacy claim uses metadata-only reads and a single `claimNonce` batch where `share_token_registry` pinning and `INSERT INTO shares (share_id, path, created_at) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM shares WHERE share_id = ? AND path = ?) AND EXISTS (SELECT 1 FROM notes WHERE path = ? AND json_extract(metadata, '$.noteUid') = ? AND json_extract(metadata, '$.claimNonce') = ? AND json_extract(metadata, '$.share') = 1 AND json_extract(metadata, '$.shareBurnedAt') IS NULL AND (json_extract(metadata, '$.shareExpiresAt') IS NULL OR CAST(json_extract(metadata, '$.shareExpiresAt') AS INTEGER) > ?))` run ONLY if that batch actually won the `noteUid` claim (preserving existing same-path `shares` rows, inserting missing rows, aborting atomically on cross-path PK conflicts, and deleting any pre-existing `shares` rows on terminal/burned/expired claims so terminal `share: true` + expired claims leave revoked `share_token_registry` AND zero `shares` rows) (pinning terminal `shareBurnedAt`/`shareExpiresAt` tokens before republish/delete using D1 precedence over `SHARE_STATUS:` or `'__legacy_terminal__'` sentinels when `SHARE_STATUS:` survives a deleted/KV-only note so `410` persists after 7-day KV TTL; if both `SHARE_STATUS:` TTL and D1 evidence expired pre-cutover, `/share/:shareId` returns `404`), keeping legacy `/share/:shareId` links functional while blocking Circles (`is_csprng_v1 = 1` required) until re-published and permanently retiring `/share/:path`, `/share/:md5(path)`, `${path}-*` (`getShareIdForPath`, `syncShareMappings`, `persistMcpNote`, `driverQueryShare`, `renderSharePage`, `driverFindNoteByShareId`, `/api/ai-assistant`, rejecting even pre-existing persisted `SHARE` KV aliases), and GET `ensureShareMetadata` (`404`) across ALL modes; once D1 registry is enabled (`SCN_REQUIRE_NOTES_REGISTRY=1`), reverting to unverified path-only KV mode is strictly prohibited

#### Scenario: Note becomes `vpw`-locked, unshared, or sealed and is later re-published
- **WHEN** a note previously added to a Share Circle is later unshared (revoking its prior `shareSlug` inside the same CAS transaction), given a `vpw` view lock, sealed, expired, or deleted
- **THEN** public `/c/:publicToken` responses omit that item immediately (fail-closed, without loading full note `content`), while the owner's `/_space` management view retains the `(note_path, note_uid)` entry with an exact reason badge ONLY if the owner has `edit` capability (otherwise displaying a uniform `"Hidden (currently unavailable)"` label)
- **AND** when the author re-publishes that same `note_uid` note, a fresh high-entropy canonical `shareSlug` is minted atomically with `notes` + `share_token_registry` + `shares` and `/c/:publicToken` automatically resolves and restores visibility under the new active token

#### Scenario: Preventing cross-page deanonymization and edit-path leaks on public Share Circles
- **WHEN** a visitor loads `/c/:publicToken` or its public JSON representation
- **THEN** the response omits `account_id`, any stable cross-circle user identifier, internal `note_path` values, and `path`/`MD5(path)` share aliases
