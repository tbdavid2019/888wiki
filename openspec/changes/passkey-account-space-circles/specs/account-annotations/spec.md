# Account Annotations Specification

## Purpose

Integrates built-in Line-Anchored Annotations (`annotation_messages`) with Passkey accounts via atomic additive sidecar tables (`account_annotation_links` and `annotation_thread_meta`), enabling explicit signed-nickname vs. unlinked anonymous posting, strict `note_uid` thread isolation across slug reuse, single-message cross-device self-deletion without exposing `account_id`, and DB-verified anonymous root-message thread deletion.

## ADDED Requirements

### Requirement: Explicit signed vs. anonymous annotation posting with atomic attribution and slug-reuse isolation
The system SHALL persist `root_message_id` and `note_uid` in `annotation_thread_meta` on thread creation to isolate threads across slug reuse, SHALL allow signed-nickname or unlinked anonymous posting with atomic `db.batch` writes, and SHALL enforce strict `Origin` + `Sec-Fetch-Site` checks on signed writes.

#### Scenario: Posting a signed annotation or reply while logged in
- **WHEN** an authenticated user posts an annotation or reply with signed account mode selected
- **THEN** the server ignores any client-supplied `authorName`, snapshots `accounts.nickname` into `annotation_messages.author_name`, atomically writes `annotation_messages`, `annotation_thread_meta` (for new threads), and conditional `account_annotation_links` (including `note_uid` and canonical `share_id`, inserting zero link rows if a resolved thread prevents message insertion and without issuing an anonymous `deleteToken` for signed roots) in one D1 `batch`
- **AND** signed annotations are listed in `/_space` from `account_annotation_links` independently of bookmark quota limits, while external WebTalk widgets remain excluded

#### Scenario: Blocking annotation reads and writes on unburned burn shares
- **WHEN** a non-author requests `GET`, `POST`, `PATCH`, or `DELETE` on `/api/shares/:shareId/annotations*` for a burn/burn-after-reading note (`isBurnProtected(meta)` checking `shareMode === 'burn' || shareMode === 'burn_after_reading' || shareBurnAfterReading === true`) before an authoritative burn release
- **THEN** the server fails closed (`403`/`409`) without returning `quote_exact` or annotation bodies, preventing repeated pre-burn extraction of protected note content

#### Scenario: Isolating threads across 4-character slug reuse without reopening deleted threads
- **WHEN** any annotation list, reply, or delete operation runs on a note
- **THEN** `annotation_thread_meta` is provisioned in `schema/note_annotations.sql` for all D1-annotation deployments (`note_uid` nullable ONLY in pure-KV mode); when `isNotesRegistryEnabled()` is true the system enforces `annotation_thread_meta.note_uid === currentNote.metadata.noteUid`, hiding and rejecting legacy threads lacking verifiable `annotation_thread_meta` generation evidence regardless of timestamp granularity or prior tombstone state; AND in intentional pure-KV mode (`SCN_STORAGE_DRIVER="kv"` with D1 annotation bindings retained) reads/mutations continue excluding any UID-tagged threads (`annotation_thread_meta.note_uid IS NOT NULL`) so UID-generation annotations never bleed into path-scoped pure-KV notes
- **AND** `addAnnotationMessage` atomically requires `t.is_resolved = 0` AND `EXISTS (SELECT 1 FROM annotation_messages m WHERE m.thread_id = t.id AND m.deleted_at IS NULL)` so soft-deleted threads cannot be reopened by late replies

#### Scenario: Posting an unlinked anonymous annotation while logged in
- **WHEN** an authenticated user switches to anonymous mode in the annotation form
- **THEN** the UI clears any pre-filled account nickname from the name field, and the server writes NO `account_annotation_links` record (`deleteToken` works as before)

#### Scenario: Preventing silent downgrade on expired session
- **WHEN** a user submits a signed-mode annotation after their session cookie has expired
- **THEN** the server returns HTTP `401` and the client preserves the draft text while prompting to re-authenticate with Passkey or explicitly switch to anonymous submission

### Requirement: Single-message cross-device self-deletion and DB-verified anonymous root thread deletion
The system SHALL allow an authenticated user to soft-delete ONLY their own individual `message_id` linked via `account_annotation_links` across any device (never deleting replies by other users via thread-wide deletion), SHALL preserve note-edit-password and anonymous-root `deleteToken` thread deletion paths, SHALL verify persisted `annotation_thread_meta.root_message_id` + `note_uid` on anonymous thread deletion, and SHALL NOT expose `account_id` in public annotation responses.

#### Scenario: Deleting own signed message or root message across devices without removing others' replies
- **WHEN** an authenticated user sends `DELETE /api/shares/:shareId/annotations/:threadId/messages/:messageId` (on a live share) OR `DELETE /api/account/annotations/:messageId` (from `/_space` or when a share link rotated, unshared, or locked) without a browser `deleteToken`
- **THEN** the system verifies `(message_id, account_id)` ownership via `account_annotation_links` (plus `thread_id` + `note_uid` on the share route) and atomically soft-deletes ONLY that individual message and clears its link row (keeping other participants' replies intact even for same-second replies, and preventing thread re-opening when zero active messages remain; unlinked/unowned IDs return `404`)

#### Scenario: Verifying persisted anonymous root message identity on thread deletion
- **WHEN** a client requests `DELETE /api/shares/:shareId/annotations/:threadId` with `rootMessageId` and `deleteToken` (without note edit auth)
- **THEN** when `isNotesRegistryEnabled()` is true (or `annotation_thread_meta` exists for `threadId`), the server verifies against `annotation_thread_meta.root_message_id`, matching `note_uid` (when registry-enabled), and absence of `account_annotation_links` for that root message (failing closed in registry mode if `annotation_thread_meta` is missing; pure-KV legacy roots lacking sidecar metadata preserve pre-existing earliest-message root fallback cleanly) before permitting thread-wide deletion

#### Scenario: Public annotation feed hides stable account identifiers and uses canonical share links
- **WHEN** any client fetches `GET /api/shares/:shareId/annotations`
- **THEN** the response includes only `isSignedAccount` (boolean) and session-scoped `canDelete` (boolean) flags, never raw `account_id` or hashed user identifiers, and `/_space` links user annotations via canonical `/share/:shareId` rather than `annotation_threads.path`
