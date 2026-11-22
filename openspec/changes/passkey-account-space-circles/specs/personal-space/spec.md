# Personal Space Specification

## Purpose

Provides a private, zero-privilege cross-device personal workspace (`/_space`) aggregating notes created, browser-edited, manually bookmarked, and account-annotated across Markdown, Block, Canvas, and Whiteboard formats while enforcing strict edit-capability isolation, fail-closed `note_uid` binding, anti-oracle uniform masking, and local-only browser draft boundaries.

## ADDED Requirements

### Requirement: Zero-privilege cross-format personal index
The system SHALL provide an authenticated private space at `/_space` (`Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, strict CSP) listing the user's indexed items across `markdown`, `block`, `canvas`, and `whiteboard` formats without altering note-level `pw`, `vpw`, or `cn_author_*` authorization rules.

#### Scenario: Viewing personal space with anti-oracle uniform masking
- **WHEN** an authenticated user opens `/_space`
- **THEN** the system renders a paginated list (`<= 50` items per page) without executing `SELECT content`
- **AND** `edit` items display `titleSummary`, format badges, activity facets, and protection/Seal/burn-warning badges; `share_only` items that are currently publicly readable display `titleSummary` and format badges; and ANY `share_only` item that later becomes `vpw`-locked, sealed, unshared, burned, expired, missing, or UID-mismatched renders a uniform masked placeholder (`{ masked: true, itemKey: '<opaque-key>', accessLevel: 'share_only', title: 'Unavailable or Protected Note', editorFormat: null, protectionBadge: null, actions: ['remove'] }`) using an opaque non-path `itemKey` for deletion without distinguishing failure or lock states

#### Scenario: Isolating note ownership and Seal bypass privileges
- **WHEN** an authenticated user opens a note from `/_space` on a second device that lacks `cn_author_*` or note password cookies
- **THEN** existing `vpw`/`pw`/Seal/Burn-After-Reading gates remain enforced and `/_space` displays a warning badge on `edit` Burn-After-Reading items

### Requirement: Strict edit-path vs. share-only capability separation and fail-closed `noteUid` binding
When account D1 storage is active, the system SHALL require a non-null immutable CSPRNG `note_uid` on every indexed item, SHALL enforce `access_level` (`edit` vs `share_only`), SHALL bind `auth` and `cn_author_*` cookies strictly to `noteUid` across all note/share/R2 auth checks (invalidating legacy cookies lacking `noteUid`), and SHALL NEVER derive or expose an internal `note_path` edit URL from a `shareId`, for `share_only` items, or when `note_uid` is missing or mismatched.

#### Scenario: Bookmarking or annotating another user's shared note
- **WHEN** an authenticated user manually bookmarks or posts a signed annotation on another user's `/share/:shareId` page
- **THEN** the system indexes the item with `access_level = 'share_only'`, omits `note_path` and edit URLs from `/_space` APIs and HTML, and outputs only a `/share/:shareId` link

#### Scenario: Preventing 4-character slug reuse hijacking across space items, history, and cookies
- **WHEN** a previously indexed note lacks `noteUid`, has a permanent `(path, deleted_note_uid)` deletion tombstone, or its slug is later reallocated to a new note with a different `note_uid`
- **THEN** `/_space` fails closed on `note_uid` mismatch/absence, `note_history_meta` isolates history throttle/count/list/read/restore/prune/cleanup by `(path, note_uid)` when `isNotesRegistryEnabled()` is true (keeping pre-cutover untagged `note_history` rows hidden from normal note UI routes, governed only by optional `SCN_LEGACY_HISTORY_RETENTION_DAYS`), Admin single/bulk deletes carry selected `noteUid`, `auth` and `cn_author_*` cookies ALWAYS mint current `note.metadata.noteUid` across all storage modes when present and fail closed whenever EITHER `cookie.noteUid` OR `note.metadata.noteUid` differs or is missing on the other side, and `/_space` offers removal via opaque `itemKey`

### Requirement: Unpublished browser-edited drafts remain strictly local
The system SHALL NOT upload browser-edited unpublished draft contents (`share !== true`) via autosave or index unpublished local draft paths into cloud `/_space` storage, preserving existing `save_policy.mjs` behavior and avoiding unnecessary cloud/R2 writes while leaving existing direct-creation endpoints (`/new/:format?text=...`, `/api/new-note`) unchanged.

#### Scenario: Editing an unpublished draft while logged in
- **WHEN** an authenticated user creates or edits an unpublished note in the browser whose `share` flag is not `true`
- **THEN** the system keeps browser draft content in local `offlineStore` only (displayed locally on the same device with a device-local label) and does not create a cloud `account_space_items` record until the note is published

### Requirement: Confirmation-based guest history import with anti-oracle rules
The system SHALL present a categorized confirmation preview before importing `cf-notepad:share-history` records, deduplicating per account, enforcing live visibility verification at preview and single-DB commit (or staged pending verification, deferred facet updates, and read-after-write rollback across split D1 databases), and preventing protected-note existence leaks.

#### Scenario: Importing guest history upon registration or cross-browser login
- **WHEN** a user previews or confirms importing local share history
- **THEN** the UI displays a selectable preview modal (never silently auto-importing `viewed` links or unpublished drafts), and legacy `localStorage` `created` records lacking verifiable edit capability import as `share_only`
- **AND** BOTH preview and confirm (`POST /api/space/import`) normalize same-origin `/present` and `/book` URLs (rejecting cross-origin URLs and query credentials) and resolve `shareId` via metadata-only `resolveAuthoritativeShareMetadata` (claiming valid legacy opaque slugs as needed, rejecting `/share/:path`, `/share/:md5(path)`, and path-bearing fallbacks)
- **AND** on single-DB (`accountDb === notesDb`), confirm validates exact submitted `share_token_registry.share_id` mapping AND live note visibility and inserts/updates atomically in one transaction; on split-DB (`accountDb !== notesDb`), confirm reclaims ONLY unlocked expired reservations (`status = 'pending_import' AND pending_import_commit_id IS NULL AND created_at < now - 120`), stages only new `share_only` rows as hidden `status = 'pending_import'`, defers all `'active'` mutations until post-stage `notesDb` exact-`shareId` re-verification succeeds, acquires per-item `pending_import_commit_id` ONLY when `pending_import_commit_id IS NULL` (and `import_batch_id = ?` for staged rows, keeping `user_facets` and `verified_import_facets` strictly separate from provisional `pending_import_facets` so overlapping imports skip locked rows cleanly, re-imports preserve prior `verified_import_facets`, and concurrent explicit user bookmarks/edits update `user_facets` without clobbering), records `pending_import_finalizations`, and performs atomic Stage 4 / Cron finalization (deleting `pending_import_finalizations` ONLY after verified `notesDb` check; merging `pending_import_facets` into `verified_import_facets` on success; deleting ONLY rows where `user_facets IS NULL AND verified_import_facets IS NULL` or restoring `facets = union(user_facets, verified_import_facets)` on failure; retaining `pending_import_finalizations` for retry if `notesDb` is unreachable)

#### Scenario: Low-overhead creation and editing index updates
- **WHEN** an authenticated user transitions a note to `share: true` via `POST /:path/setting` (with or without autosave enabled), saves a pre-shared creation in the browser (`POST /api/new-note` or `POST /:path` with `share: true`), or triggers 10-second autosave on a published note in the browser
- **THEN** committed first-publish transitions and autosave hooks idempotently record `'created'`/`'edited'` with current `noteUid` (ALWAYS persisting when an existing `share_only` / imported item upgrades to `edit` or acquires a missing facet, skipping D1 writes ONLY when `(account_id, note_path, note_uid)` already records that exact `access_level` and facet), and anonymous requests incur zero extra D1 queries

#### Scenario: Granting edit capability only with non-derived path and current-generation proof
- **WHEN** an import or edit-tracking request provides an un-derived edit `path`
- **THEN** the server grants `edit` access ONLY when the caller holds current-generation edit proof (`auth` edit cookie or `cn_author_*` whose `noteUid` matches current `metadata.noteUid`, or an unpassworded note whose current `note_uid` is verified) without resolving `shareId -> path`
