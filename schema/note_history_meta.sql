-- Generation-Scoped Note History Metadata Sidecar (historyDb)

CREATE TABLE IF NOT EXISTS note_history_meta (
    history_id INTEGER PRIMARY KEY,
    path TEXT NOT NULL,
    note_uid TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_history_meta_path_uid_created
ON note_history_meta (path, note_uid, created_at DESC);
