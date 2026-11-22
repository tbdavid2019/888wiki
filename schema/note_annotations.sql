CREATE TABLE IF NOT EXISTS annotation_threads (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    quote_exact TEXT NOT NULL,
    quote_prefix TEXT NOT NULL DEFAULT '',
    quote_suffix TEXT NOT NULL DEFAULT '',
    start_offset INTEGER NOT NULL CHECK (start_offset >= 0),
    end_offset INTEGER NOT NULL CHECK (end_offset > start_offset),
    source_revision TEXT NOT NULL,
    is_resolved INTEGER NOT NULL DEFAULT 0 CHECK (is_resolved IN (0, 1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_annotation_threads_path_updated
ON annotation_threads (path, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS annotation_messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER,
    FOREIGN KEY (thread_id) REFERENCES annotation_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_annotation_messages_thread_created
ON annotation_messages (thread_id, created_at ASC, id ASC);

CREATE TABLE IF NOT EXISTS annotation_thread_meta (
    thread_id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    root_message_id TEXT NOT NULL,
    note_uid TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_annotation_thread_meta_path_uid
ON annotation_thread_meta (path, note_uid);
