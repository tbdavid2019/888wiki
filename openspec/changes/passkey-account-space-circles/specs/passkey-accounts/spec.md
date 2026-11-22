# Passkey Accounts Specification

## Purpose

Provides lightweight, zero-password account registration, Discoverable Passkey authentication, step-up re-authenticated multi-device Passkey management, session revocation, anti-abuse protection, and a single display nickname for cross-device personal indexing without altering anonymous note access.

## ADDED Requirements

### Requirement: Passkey-only user account creation and login
The system SHALL allow users to create a new account and authenticate using WebAuthn Discoverable Credentials (`residentKey: required`, `userVerification: required`) without requiring a username, email, or phone number, while leaving anonymous zero-login note access and editing unaffected.

#### Scenario: Creating a new account with a Passkey
- **WHEN** an unauthenticated user submits a valid nickname (`1` to `40` characters after trimming control, zero-width, and BiDi characters) within `<= 32 KB` payload and encoded-field bounds and completes WebAuthn registration against a single-use server challenge
- **THEN** the system executes one atomic nonce-locked D1 transaction validating the unconsumed challenge, server-issued `user_handle`, credential uniqueness, and strict Turnstile `used_turnstile_tokens` claim before inserting `accounts`, `account_passkeys`, and `account_sessions`, consuming the challenge cleanly (or performing zero mutations if any constraint fails)
- **AND** ONLY after commit sets an `HttpOnly; SameSite=Lax; Path=/` revocable `cn_account_session` cookie (`Secure` on HTTPS, 30-day TTL) and returns the authenticated account profile

#### Scenario: Authenticating with an existing Passkey
- **WHEN** a user initiates Passkey login with empty `allowCredentials` and completes WebAuthn assertion with a credential present in `account_passkeys`
- **THEN** the system verifies the signature, `UP` and `UV` flags, explicit `origin`/`rpId` allowlist, `crossOrigin !== true`, immutable `BE` parity with the stored credential, and `userHandle` consistency, and executes one atomic D1 transaction gating challenge consumption, `sign_count` CAS (`backup_eligible = 0`), credential existence, and `account_sessions` creation together
- **AND** if counter CAS or credential existence fails concurrently, zero sessions are created and the challenge is not consumed

#### Scenario: Rejecting an Admin FIDO credential on account login
- **WHEN** a user selects an Admin FIDO credential from the browser Passkey picker during user account login
- **THEN** the system rejects the assertion because the credential is absent from `account_passkeys` and returns a distinct, actionable error without granting admin or account access

### Requirement: Hardened WebAuthn verification and strict anti-abuse gates
The system SHALL enforce bounded CBOR/DER parsing (shared across user Passkey and Admin FIDO verification), explicit `rpId` and `origin` allowlist checks, `crossOrigin !== true`, `UP` and `UV` flags on user Passkey ceremonies, atomic multi-field D1 challenge consumption on user Passkey ceremonies, and strict Turnstile plus atomic IP-hash rate limiting before D1 writes.

#### Scenario: Rejecting malformed CBOR, invalid ceremony type/rpIdHash, or replayed user challenges
- **WHEN** a client submits a deeply nested (`depth > 8`) or out-of-bounds CBOR `attestationObject`, malformed DER signature, wrong `clientData.type` (`'webauthn.create'` vs `'webauthn.get'`), mismatched `authData.rpIdHash` (`!== SHA-256(expectedRpId)`), or reuses an already consumed, unbound, or expired user challenge
- **THEN** the system rejects the request (and rejects malformed CBOR/DER on Admin FIDO endpoints while preserving Admin's legacy KV challenge/`UV: preferred` compatibility) before excessive memory or CPU allocation with HTTP `400` and a structured non-PII diagnostic code

#### Scenario: Enforcing Turnstile tri-state precedence and rate limits on auth endpoints
- **WHEN** Turnstile policy is evaluated in strict precedence: (1) explicit off (`SCN_ENABLE_TURNSTILE` is `'0'` or `'false'`) -> `disabled`; (2) unrecognized non-empty `SCN_ENABLE_TURNSTILE` (not `'1'`) or missing either `SCN_TURNSTILE_SITE_KEY`/`TURNSTILE_SITE_KEY` or `SCN_TURNSTILE_SECRET`/`TURNSTILE_SECRET` when enabled/partially set -> `misconfigured`; (3) both keys set (and not explicitly off) -> `enabled`; (4) unset flag and both keys empty -> `disabled`
- **THEN** `disabled` deployments skip Turnstile cleanly, `misconfigured` deployments fail closed (`503`), `enabled` deployments strictly verify a fresh single-use Siteverify check (`hostname`, `action`, no fail-open, no clearance cookie reuse) bound to registration completion, and BOTH registration and login challenge issuance enforce atomic IP-hash rate limits and pending-challenge caps before writing D1

#### Scenario: Enforcing immutable `BE` parity and stored-attribute `signCount` policy
- **WHEN** a credential authenticates with `BE`/`BS` flags and `signCount`
- **THEN** invalid `BE = 0, BS = 1` combinations and any `BE` mismatch against the stored `account_passkeys.backup_eligible` value are rejected
- **AND** counter rules follow the stored `backup_eligible` attribute: `backup_eligible = 1` allows `0` or non-monotonic counters, while `backup_eligible = 0` rejects `0 < current <= previous` or positive-to-zero regressions

### Requirement: Step-up single-use grant multi-device Passkey management and explicit non-recovery
The system SHALL require a single-use `stepup_grants` authorization derived deterministically from distinct step-up challenge purposes before adding or removing any Passkey, SHALL consume challenges and grants ONLY when the Passkey mutation succeeds inside one nonce-locked D1 transaction, SHALL forbid removing the last remaining Passkey, and SHALL keep email/phone/SSO recovery out of scope in v1.

#### Scenario: Issuing and scoping step-up grants cleanly
- **WHEN** an authenticated user completes a `UV` assertion for `'passkey_add_stepup'` or `'passkey_remove_stepup'`
- **THEN** the server deterministically derives `action = 'add'` or `'remove'` exclusively from the locked challenge's `purpose` and atomically inserts `stepup_grants` ONLY when the credential belongs to the challenge's `account_id`, the `sign_count` CAS matches, and the bound `account_sessions` row is unrevoked and unexpired (`expires_at > now`) (an assertion from another account updates zero rows)

#### Scenario: Linking a second device Passkey with step-up grant
- **WHEN** an authenticated user completes a `'passkey_add_stepup'` `UV` assertion (`action = 'add'`) and submits a registration challenge bound to that `grant_id`
- **THEN** the system atomically validates active session + unconsumed `stepup_grants` + `auth_challenges` inside one nonce-locked transaction, inserting the credential and consuming challenge/grant together (or performing zero mutations and preserving challenge/grant if any precondition fails)

#### Scenario: Blocking last-Passkey removal and atomically revoking sessions only on real removal
- **WHEN** an authenticated user submits a `'passkey_remove_stepup'` removal (`action = 'remove'`) with a valid `grant_id`
- **THEN** removing the sole remaining Passkey or a non-existent credential makes zero mutations (leaving sessions and grant untouched)
- **AND** removing an existing secondary Passkey atomically locks the grant, revokes other active `account_sessions`, deletes the credential (`COUNT > 1`), and deletes the grant in the same transaction

### Requirement: Single 40-character nickname with non-retroactive updates
The system SHALL store a single trimmed nickname (`1`–`40` characters, sanitized of control/zero-width/BiDi characters) per account and SHALL allow renaming without rewriting previously posted annotation snapshots.

#### Scenario: Updating account nickname
- **WHEN** an authenticated user updates their nickname to a valid `1`–`40` character string
- **THEN** future account-signed annotations use the new nickname while existing historical annotations retain the nickname recorded at posting time

### Requirement: Session revocation, CSRF protection, and unified D1 readiness disabling
The system SHALL reject cross-origin or non-JSON state-changing account requests (including pre-login auth endpoints), revoke sessions immediately on sign-out, fail closed if `SCN_SECRET` is missing, and hide/disable all account features unless required D1 bindings are available and `SCN_STORAGE_DRIVER !== "kv"`, while keeping pure KV anonymous note/share/auth behavior unaffected.

#### Scenario: Signing out revokes the server session
- **WHEN** an authenticated user invokes sign-out
- **THEN** the system invalidates the server-side session record, clears `cn_account_session`, and rejects any subsequent requests replaying the old cookie

#### Scenario: Pure KV deployment, explicit authority loss, partial DB binding, or missing schema
- **WHEN** the Worker runs intentionally in pure KV mode (`SCN_STORAGE_DRIVER="kv"`, or fresh `auto` with no D1 bindings and `SCN_NOTES_DB_BINDING` / `SCN_REQUIRE_NOTES_REGISTRY` unset), OR when explicit D1 authority (`SCN_STORAGE_DRIVER="d1"` or `SCN_NOTES_DB_BINDING` / `SCN_REQUIRE_NOTES_REGISTRY="1"`) loses its pinned `notesDb` binding, OR when `notesDb` is active without `accountDb` or lacks required tables
- **THEN** intentional pure KV omits account controls and keeps anonymous KV notes/shares and optional D1 history/stats/anonymous annotations working without requiring `noteUid`; explicit pinned `notesDb` loss ALWAYS fails closed (`503 STORAGE_UNAVAILABLE`, never falling back to KV or another DB binding); missing-`accountDb` with healthy `notesDb` disables ONLY account APIs (`503 ACCOUNT_DISABLED`) while keeping `notesDb` integrity active; and unmigrated D1 schemas report `D1_SCHEMA_MISSING` (`503`) cleanly
