-- Account, Passkey, Auth Session, Personal Space & Share Circle Schema (accountDb)

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_handle TEXT NOT NULL UNIQUE,
    nickname TEXT NOT NULL CHECK (length(trim(nickname)) BETWEEN 1 AND 40),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account_passkeys (
    credential_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    public_key_spki TEXT NOT NULL,
    algorithm INTEGER NOT NULL,
    sign_count INTEGER NOT NULL DEFAULT 0,
    backup_eligible INTEGER NOT NULL DEFAULT 0,
    backup_state INTEGER NOT NULL DEFAULT 0,
    transports_json TEXT,
    device_label TEXT,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS auth_challenges (
    challenge TEXT PRIMARY KEY,
    purpose TEXT NOT NULL,
    binding_hash TEXT NOT NULL,
    user_handle TEXT,
    account_id TEXT,
    session_id TEXT,
    stepup_grant_id TEXT,
    consumed_nonce TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stepup_grants (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    action TEXT NOT NULL,
    binding_hash TEXT NOT NULL,
    consumed_nonce TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS used_turnstile_tokens (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
    bucket_key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account_sessions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS account_space_items (
    id TEXT PRIMARY KEY,
    item_key TEXT NOT NULL UNIQUE,
    account_id TEXT NOT NULL,
    note_path TEXT NOT NULL,
    note_uid TEXT NOT NULL,
    access_level TEXT NOT NULL CHECK (access_level IN ('edit', 'share_only')),
    facets TEXT NOT NULL DEFAULT '[]',
    user_facets TEXT,
    verified_import_facets TEXT,
    editor_format TEXT NOT NULL DEFAULT 'markdown',
    title_summary TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_import')),
    import_batch_id TEXT,
    pending_import_commit_id TEXT,
    pending_import_facets TEXT,
    last_activity_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (account_id, note_path, note_uid)
);

CREATE TABLE IF NOT EXISTS pending_import_finalizations (
    commit_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    candidates_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS share_circles (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    public_token TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS share_circle_items (
    circle_id TEXT NOT NULL,
    space_item_id TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (circle_id, space_item_id)
);

CREATE TABLE IF NOT EXISTS account_annotation_links (
    message_id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    note_path TEXT NOT NULL,
    note_uid TEXT NOT NULL,
    share_id TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_passkeys_account_id
ON account_passkeys (account_id);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires_at
ON auth_challenges (expires_at);

CREATE INDEX IF NOT EXISTS idx_stepup_grants_account_expires
ON stepup_grants (account_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_used_turnstile_tokens_expires_at
ON used_turnstile_tokens (expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_reset_at
ON auth_rate_limits (reset_at);

CREATE INDEX IF NOT EXISTS idx_account_sessions_account_revoked_expires
ON account_sessions (account_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_account_space_items_account_status_activity
ON account_space_items (account_id, status, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_space_items_pending_commit
ON account_space_items (pending_import_commit_id);

CREATE INDEX IF NOT EXISTS idx_pending_import_finalizations_account_created
ON pending_import_finalizations (account_id, created_at);

CREATE INDEX IF NOT EXISTS idx_share_circles_account_id
ON share_circles (account_id);

CREATE INDEX IF NOT EXISTS idx_share_circle_items_space_item_id
ON share_circle_items (space_item_id);

CREATE INDEX IF NOT EXISTS idx_account_annotation_links_account_note
ON account_annotation_links (account_id, note_path, note_uid);

CREATE INDEX IF NOT EXISTS idx_account_annotation_links_thread_id
ON account_annotation_links (thread_id);
