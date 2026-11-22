-- Authoritative Note Tombstones & Canonical Share Token Registry (notesDb)

CREATE TABLE IF NOT EXISTS note_tombstones (
    path TEXT NOT NULL,
    deleted_note_uid TEXT NOT NULL,
    deleted_at INTEGER NOT NULL,
    delete_nonce TEXT NOT NULL,
    PRIMARY KEY (path, deleted_note_uid)
);

CREATE TABLE IF NOT EXISTS share_token_registry (
    share_id TEXT PRIMARY KEY,
    target_path TEXT NOT NULL,
    note_uid TEXT NOT NULL,
    is_csprng_v1 INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER,
    revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_share_token_registry_target_uid_revoked
ON share_token_registry (target_path, note_uid, revoked_at);

CREATE INDEX IF NOT EXISTS idx_note_tombstones_deleted_at
ON note_tombstones (deleted_at);
