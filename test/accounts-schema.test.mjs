import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

function loadSchema(filename) {
    return readFileSync(new URL(`../schema/${filename}`, import.meta.url), 'utf8')
}

const SCHEMAS = {
    notesD1: loadSchema('notes_d1.sql'),
    notesRegistry: loadSchema('notes_registry.sql'),
    noteHistory: loadSchema('note_history.sql'),
    noteHistoryMeta: loadSchema('note_history_meta.sql'),
    noteStats: loadSchema('note_stats.sql'),
    noteAnnotations: loadSchema('note_annotations.sql'),
    accounts: loadSchema('accounts.sql'),
}

function getTables(db) {
    const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all()
    return rows.map((row) => row.name)
}

function getIndexes(db) {
    const rows = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all()
    return rows.map((row) => row.name)
}

function getColumns(db, tableName) {
    return db.prepare(`PRAGMA table_info(${tableName})`).all()
}

test('all schema files execute idempotently on a single consolidated D1 database', () => {
    const db = new DatabaseSync(':memory:')
    const ordered = [
        SCHEMAS.notesD1,
        SCHEMAS.notesRegistry,
        SCHEMAS.noteHistory,
        SCHEMAS.noteHistoryMeta,
        SCHEMAS.noteStats,
        SCHEMAS.noteAnnotations,
        SCHEMAS.accounts,
    ]

    for (let pass = 0; pass < 2; pass++) {
        for (const sql of ordered) {
            db.exec(sql)
        }
    }

    const tables = getTables(db)
    const expectedTables = [
        'account_annotation_links',
        'account_passkeys',
        'account_sessions',
        'account_space_items',
        'accounts',
        'annotation_messages',
        'annotation_thread_meta',
        'annotation_threads',
        'auth_challenges',
        'auth_rate_limits',
        'note_history',
        'note_history_meta',
        'note_stats',
        'note_stats_uid',
        'note_tombstones',
        'note_view_devices',
        'note_view_devices_uid',
        'notes',
        'pending_import_finalizations',
        'share_circle_items',
        'share_circles',
        'share_token_registry',
        'shares',
        'stepup_grants',
        'used_turnstile_tokens',
    ]

    for (const table of expectedTables) {
        assert.ok(tables.includes(table), `Missing table ${table} in single-DB mode`)
    }
})

test('split-DB bindings execute their respective schemas idempotently without cross-DB table dependencies', () => {
    const accountDb = new DatabaseSync(':memory:')
    const notesDb = new DatabaseSync(':memory:')
    const historyDb = new DatabaseSync(':memory:')

    for (let pass = 0; pass < 2; pass++) {
        accountDb.exec(SCHEMAS.accounts)
        accountDb.exec(SCHEMAS.noteAnnotations)
        accountDb.exec(SCHEMAS.noteStats)

        notesDb.exec(SCHEMAS.notesD1)
        notesDb.exec(SCHEMAS.notesRegistry)

        historyDb.exec(SCHEMAS.noteHistory)
        historyDb.exec(SCHEMAS.noteHistoryMeta)
    }

    assert.deepEqual(getTables(accountDb), [
        'account_annotation_links',
        'account_passkeys',
        'account_sessions',
        'account_space_items',
        'accounts',
        'annotation_messages',
        'annotation_thread_meta',
        'annotation_threads',
        'auth_challenges',
        'auth_rate_limits',
        'note_stats',
        'note_stats_uid',
        'note_view_devices',
        'note_view_devices_uid',
        'pending_import_finalizations',
        'share_circle_items',
        'share_circles',
        'stepup_grants',
        'used_turnstile_tokens',
    ])

    assert.deepEqual(getTables(notesDb), [
        'note_tombstones',
        'notes',
        'share_token_registry',
        'shares',
    ])

    assert.deepEqual(getTables(historyDb), [
        'note_history',
        'note_history_meta',
    ])
})

test('accounts.sql defines all 12 tables with exact columns and indexes', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(SCHEMAS.accounts)

    const expectedColumns = {
        accounts: ['id', 'user_handle', 'nickname', 'created_at', 'updated_at'],
        account_passkeys: [
            'credential_id', 'account_id', 'public_key_spki', 'algorithm',
            'sign_count', 'backup_eligible', 'backup_state', 'transports_json',
            'device_label', 'created_at', 'last_used_at',
        ],
        auth_challenges: [
            'challenge', 'purpose', 'binding_hash', 'user_handle', 'account_id',
            'session_id', 'stepup_grant_id', 'consumed_nonce', 'expires_at', 'created_at',
        ],
        stepup_grants: [
            'id', 'account_id', 'session_id', 'action', 'binding_hash',
            'consumed_nonce', 'expires_at', 'created_at',
        ],
        used_turnstile_tokens: ['token_hash', 'expires_at', 'created_at'],
        auth_rate_limits: ['bucket_key', 'count', 'reset_at'],
        account_sessions: ['id', 'account_id', 'created_at', 'expires_at', 'revoked_at'],
        account_space_items: [
            'id', 'item_key', 'account_id', 'note_path', 'note_uid', 'access_level',
            'facets', 'user_facets', 'verified_import_facets', 'editor_format',
            'title_summary', 'status', 'import_batch_id', 'pending_import_commit_id',
            'pending_import_facets', 'last_activity_at', 'created_at', 'updated_at',
        ],
        pending_import_finalizations: ['commit_id', 'account_id', 'candidates_json', 'created_at'],
        share_circles: ['id', 'account_id', 'public_token', 'name', 'is_enabled', 'created_at', 'updated_at'],
        share_circle_items: ['circle_id', 'space_item_id', 'added_at'],
        account_annotation_links: [
            'message_id', 'thread_id', 'account_id', 'note_path', 'note_uid', 'share_id', 'created_at',
        ],
    }

    assert.equal(Object.keys(expectedColumns).length, 12)
    assert.deepEqual(getTables(db).sort(), Object.keys(expectedColumns).sort())

    for (const [table, cols] of Object.entries(expectedColumns)) {
        const actual = getColumns(db, table).map((c) => c.name)
        assert.deepEqual(actual, cols, `Column mismatch in ${table}`)
    }

    const indexes = getIndexes(db)
    for (const idx of [
        'idx_account_passkeys_account_id',
        'idx_auth_challenges_expires_at',
        'idx_stepup_grants_account_expires',
        'idx_account_sessions_account_revoked_expires',
        'idx_account_space_items_account_status_activity',
        'idx_share_circles_account_id',
        'idx_account_annotation_links_account_note',
    ]) {
        assert.ok(indexes.includes(idx), `Missing index ${idx}`)
    }
})

test('accounts.sql CHECK, PK, and UNIQUE constraints enforce data invariants', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(SCHEMAS.accounts)

    const insertAccount = db.prepare(
        'INSERT INTO accounts (id, user_handle, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
    insertAccount.run('acc-1', 'handle-1', 'A', 100, 100)
    insertAccount.run('acc-2', 'handle-2', 'x'.repeat(40), 100, 100)

    // Nickname CHECK (length(trim(nickname)) BETWEEN 1 AND 40)
    assert.throws(() => insertAccount.run('acc-bad-1', 'h-b1', '', 100, 100), /CHECK constraint failed/)
    assert.throws(() => insertAccount.run('acc-bad-2', 'h-b2', '   ', 100, 100), /CHECK constraint failed/)
    assert.throws(() => insertAccount.run('acc-bad-3', 'h-b3', 'x'.repeat(41), 100, 100), /CHECK constraint failed/)

    // UNIQUE user_handle and PK id
    assert.throws(() => insertAccount.run('acc-1', 'handle-new', 'Valid', 100, 100), /UNIQUE constraint failed/)
    assert.throws(() => insertAccount.run('acc-3', 'handle-1', 'Valid', 100, 100), /UNIQUE constraint failed/)

    // stepup_grants default unixepoch() created_at and PK
    db.prepare(
        'INSERT INTO stepup_grants (id, account_id, session_id, action, binding_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('grant-1', 'acc-1', 'sess-1', 'passkey_add_stepup', 'hash-1', 9999999999)
    const grant = db.prepare('SELECT created_at FROM stepup_grants WHERE id = ?').get('grant-1')
    assert.equal(typeof grant.created_at, 'number')
    assert.ok(grant.created_at > 0)

    // account_passkeys PK
    const insertPasskey = db.prepare(
        'INSERT INTO account_passkeys (credential_id, account_id, public_key_spki, algorithm, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    insertPasskey.run('cred-1', 'acc-1', 'spki', -7, 100)
    assert.throws(() => insertPasskey.run('cred-1', 'acc-1', 'spki', -7, 100), /UNIQUE constraint failed/)

    // account_space_items CHECK + UNIQUE constraints
    const insertSpaceItem = db.prepare(
        `INSERT INTO account_space_items (
            id, item_key, account_id, note_path, note_uid, access_level, status, last_activity_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    insertSpaceItem.run('sp-1', 'ik-1', 'acc-1', 'slug-a', 'uid-1', 'edit', 'active', 100, 100, 100)
    insertSpaceItem.run('sp-2', 'ik-2', 'acc-1', 'slug-a', 'uid-2', 'share_only', 'pending_import', 101, 101, 101)

    const sp1 = db.prepare('SELECT facets, editor_format, title_summary FROM account_space_items WHERE id = ?').get('sp-1')
    assert.equal(sp1.facets, '[]')
    assert.equal(sp1.editor_format, 'markdown')
    assert.equal(sp1.title_summary, '')

    // Invalid access_level and status
    assert.throws(
        () => insertSpaceItem.run('sp-bad-1', 'ik-b1', 'acc-1', 'slug-b', 'uid-1', 'admin', 'active', 100, 100, 100),
        /CHECK constraint failed/
    )
    assert.throws(
        () => insertSpaceItem.run('sp-bad-2', 'ik-b2', 'acc-1', 'slug-b', 'uid-1', 'edit', 'deleted', 100, 100, 100),
        /CHECK constraint failed/
    )

    // Duplicate item_key
    assert.throws(
        () => insertSpaceItem.run('sp-dup-ik', 'ik-1', 'acc-1', 'slug-c', 'uid-1', 'edit', 'active', 100, 100, 100),
        /UNIQUE constraint failed/
    )

    // Duplicate (account_id, note_path, note_uid)
    assert.throws(
        () => insertSpaceItem.run('sp-dup-triplet', 'ik-3', 'acc-1', 'slug-a', 'uid-1', 'share_only', 'active', 100, 100, 100),
        /UNIQUE constraint failed/
    )

    // share_circles UNIQUE public_token + default is_enabled = 0
    const insertCircle = db.prepare(
        'INSERT INTO share_circles (id, account_id, public_token, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    insertCircle.run('cir-1', 'acc-1', 'tok-1', 'Reading List', 100, 100)
    const cir = db.prepare('SELECT is_enabled FROM share_circles WHERE id = ?').get('cir-1')
    assert.equal(cir.is_enabled, 0)
    assert.throws(() => insertCircle.run('cir-2', 'acc-1', 'tok-1', 'Other', 100, 100), /UNIQUE constraint failed/)

    // share_circle_items composite PK (circle_id, space_item_id)
    const insertCircleItem = db.prepare('INSERT INTO share_circle_items (circle_id, space_item_id, added_at) VALUES (?, ?, ?)')
    insertCircleItem.run('cir-1', 'sp-1', 100)
    assert.throws(() => insertCircleItem.run('cir-1', 'sp-1', 101), /UNIQUE constraint failed/)
})

test('notes_registry.sql, note_history_meta.sql, note_annotations.sql, and note_stats.sql schemas enforce expected keys and columns', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(SCHEMAS.notesD1)
    db.exec(SCHEMAS.notesRegistry)
    db.exec(SCHEMAS.noteHistory)
    db.exec(SCHEMAS.noteHistoryMeta)
    db.exec(SCHEMAS.noteAnnotations)
    db.exec(SCHEMAS.noteStats)

    // note_tombstones composite PK (path, deleted_note_uid)
    const insertTombstone = db.prepare(
        'INSERT INTO note_tombstones (path, deleted_note_uid, deleted_at, delete_nonce) VALUES (?, ?, ?, ?)'
    )
    insertTombstone.run('slug-a', 'uid-1', 100, 'nonce-1')
    insertTombstone.run('slug-a', '__legacy__', 100, 'nonce-2')
    assert.throws(() => insertTombstone.run('slug-a', 'uid-1', 101, 'nonce-3'), /UNIQUE constraint failed/)

    // share_token_registry PK + default is_csprng_v1 = 0
    const insertShareReg = db.prepare(
        'INSERT INTO share_token_registry (share_id, target_path, note_uid, created_at) VALUES (?, ?, ?, ?)'
    )
    insertShareReg.run('tok-abc', 'slug-a', 'uid-1', 100)
    const regRow = db.prepare('SELECT is_csprng_v1, revoked_at, revoked_reason FROM share_token_registry WHERE share_id = ?').get('tok-abc')
    assert.equal(regRow.is_csprng_v1, 0)
    assert.equal(regRow.revoked_at, null)
    assert.equal(regRow.revoked_reason, null)
    assert.throws(() => insertShareReg.run('tok-abc', 'slug-b', 'uid-2', 101), /UNIQUE constraint failed/)

    // note_history_meta PK
    const insertHistMeta = db.prepare(
        'INSERT INTO note_history_meta (history_id, path, note_uid, created_at) VALUES (?, ?, ?, ?)'
    )
    insertHistMeta.run(1, 'slug-a', 'uid-1', 100)
    assert.throws(() => insertHistMeta.run(1, 'slug-a', 'uid-2', 101), /UNIQUE constraint failed/)

    // annotation_thread_meta allows nullable note_uid (pure-KV mode) and enforces PK thread_id
    const insertThreadMeta = db.prepare(
        'INSERT INTO annotation_thread_meta (thread_id, path, root_message_id, note_uid, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    insertThreadMeta.run('thr-1', 'slug-a', 'msg-1', null, 100)
    insertThreadMeta.run('thr-2', 'slug-a', 'msg-2', 'uid-1', 101)
    assert.throws(() => insertThreadMeta.run('thr-1', 'slug-a', 'msg-3', 'uid-1', 102), /UNIQUE constraint failed/)

    // note_stats_uid composite PK + default views = 0
    const insertStatsUid = db.prepare(
        'INSERT INTO note_stats_uid (path, note_uid, updated_at) VALUES (?, ?, ?)'
    )
    insertStatsUid.run('slug-a', 'uid-1', 100)
    const statsRow = db.prepare('SELECT views FROM note_stats_uid WHERE path = ? AND note_uid = ?').get('slug-a', 'uid-1')
    assert.equal(statsRow.views, 0)
    assert.throws(() => insertStatsUid.run('slug-a', 'uid-1', 101), /UNIQUE constraint failed/)

    // note_view_devices_uid composite PK
    const insertDeviceUid = db.prepare(
        'INSERT INTO note_view_devices_uid (path, note_uid, device_hash, first_viewed_at) VALUES (?, ?, ?, ?)'
    )
    insertDeviceUid.run('slug-a', 'uid-1', 'dev-hash-1', 100)
    insertDeviceUid.run('slug-a', 'uid-2', 'dev-hash-1', 101)
    assert.throws(() => insertDeviceUid.run('slug-a', 'uid-1', 'dev-hash-1', 102), /UNIQUE constraint failed/)
})
