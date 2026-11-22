CREATE TABLE IF NOT EXISTS note_stats (
    path TEXT PRIMARY KEY,
    view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    last_viewed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS note_view_devices (
    path TEXT NOT NULL,
    device_hash TEXT NOT NULL,
    first_viewed_at INTEGER NOT NULL,
    PRIMARY KEY (path, device_hash)
);

CREATE TABLE IF NOT EXISTS note_stats_uid (
    path TEXT NOT NULL,
    note_uid TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (path, note_uid)
);

CREATE TABLE IF NOT EXISTS note_view_devices_uid (
    path TEXT NOT NULL,
    note_uid TEXT NOT NULL,
    device_hash TEXT NOT NULL,
    first_viewed_at INTEGER NOT NULL,
    PRIMARY KEY (path, note_uid, device_hash)
);
