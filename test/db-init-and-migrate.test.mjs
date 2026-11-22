import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import {
    parseWranglerToml,
    planDbInitTargets,
    runDbInit,
} from '../scripts/db-init.mjs'
import {
    SECURITY_SHARE_FIELDS,
    migrateLegacyNotes,
} from '../scripts/migrate-legacy-notes.mjs'

function createSqliteD1Adapter(sqliteDb) {
    function makeStatement(sql, bound = []) {
        return {
            sql,
            params: bound,
            bind(...params) {
                return makeStatement(sql, params)
            },
            async all() {
                const stmt = sqliteDb.prepare(sql)
                const results = stmt.all(...bound)
                return { results, meta: {} }
            },
            async first() {
                const stmt = sqliteDb.prepare(sql)
                const row = stmt.get(...bound)
                return row || null
            },
            async run() {
                const stmt = sqliteDb.prepare(sql)
                const info = stmt.run(...bound)
                return {
                    results: [],
                    meta: {
                        changes: Number(info?.changes ?? 0),
                        last_row_id: Number(info?.lastInsertRowid ?? 0),
                    },
                }
            },
        }
    }

    return {
        prepare(sql) {
            return makeStatement(sql, [])
        },
        async batch(statements = []) {
            sqliteDb.exec('BEGIN IMMEDIATE')
            try {
                const results = []
                for (const s of statements) {
                    const stmt = sqliteDb.prepare(s.sql)
                    const info = stmt.run(...(s.params || []))
                    results.push({
                        results: [],
                        meta: {
                            changes: Number(info?.changes ?? 0),
                            last_row_id: Number(info?.lastInsertRowid ?? 0),
                        },
                    })
                }
                sqliteDb.exec('COMMIT')
                return results
            } catch (err) {
                try { sqliteDb.exec('ROLLBACK') } catch {}
                throw err
            }
        },
    }
}

function initNotesSchemaOnSqlite(sqliteDb) {
    sqliteDb.exec(readFileSync(new URL('../schema/notes_d1.sql', import.meta.url), 'utf8'))
    sqliteDb.exec(readFileSync(new URL('../schema/notes_registry.sql', import.meta.url), 'utf8'))
}

/**
 * Create a mock Cloudflare v4 KV REST fetch implementation.
 * Supports multi-page cursor pagination, per-pass state snapshots, truncation, and HTTP errors.
 */
function createMockKvFetch({
    accountId = 'acc-test',
    notesNsId = 'ns-notes',
    shareNsId = 'ns-share',
    getStateForPass,
    pageSize = 100,
    forceTruncatedCursor = false,
    forceStuckCursor = false,
    forceValueHttpStatus = null,
    forceMetadataHttpStatus = null,
    forceListHttpStatus = null,
} = {}) {
    const listCallCountByNs = new Map()
    const calls = []

    const fetchImpl = async (urlStr, init = {}) => {
        const url = new URL(urlStr)
        calls.push({ url: urlStr, method: init.method || 'GET', auth: init.headers?.Authorization || '' })
        const pathname = url.pathname

        const prefix = `/client/v4/accounts/${accountId}/storage/kv/namespaces/`
        if (!pathname.startsWith(prefix)) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: 'not found' }] }), { status: 404 })
        }

        const rest = pathname.slice(prefix.length)
        const parts = rest.split('/')
        const nsId = decodeURIComponent(parts[0])
        const op = parts[1]

        // Track pass index per namespace based on root /keys calls (without cursor)
        let passIndex = listCallCountByNs.get(nsId) || 0
        if (op === 'keys' && !url.searchParams.get('cursor')) {
            passIndex += 1
            listCallCountByNs.set(nsId, passIndex)
        }
        const state = getStateForPass(Math.max(1, passIndex))
        const nsMap = nsId === notesNsId ? state.notes : (nsId === shareNsId ? state.share : null)
        if (!nsMap) {
            return new Response(JSON.stringify({ success: false, errors: [{ message: 'unknown namespace' }] }), { status: 404 })
        }

        if (op === 'keys') {
            if (forceListHttpStatus) {
                return new Response('upstream error', { status: forceListHttpStatus })
            }
            const allEntries = Array.from(nsMap.entries())
            const cursorParam = url.searchParams.get('cursor') || ''
            const offset = cursorParam ? Number(cursorParam.replace('cursor:', '')) : 0
            const slice = allEntries.slice(offset, offset + pageSize)
            const hasMore = offset + pageSize < allEntries.length
            let nextCursor = hasMore ? `cursor:${offset + pageSize}` : ''
            if (forceTruncatedCursor) {
                nextCursor = 'cursor:stuck-truncated'
            } else if (forceStuckCursor && cursorParam) {
                nextCursor = cursorParam
            }
            const result = forceTruncatedCursor && cursorParam
                ? []
                : slice.map(([name, item]) => ({
                    name,
                    metadata: item.metadata ?? null,
                }))

            return new Response(
                JSON.stringify({
                    success: true,
                    errors: [],
                    messages: [],
                    result,
                    result_info: {
                        count: result.length,
                        cursor: nextCursor,
                    },
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        const key = decodeURIComponent(parts.slice(2).join('/'))
        if (op === 'values') {
            if (forceValueHttpStatus) {
                return new Response('value error', { status: forceValueHttpStatus })
            }
            if (!nsMap.has(key)) {
                return new Response('missing key', { status: 404 })
            }
            return new Response(String(nsMap.get(key).value ?? ''), { status: 200 })
        }

        if (op === 'metadata') {
            if (forceMetadataHttpStatus) {
                return new Response('meta error', { status: forceMetadataHttpStatus })
            }
            if (!nsMap.has(key)) {
                return new Response(JSON.stringify({ success: false }), { status: 404 })
            }
            return new Response(
                JSON.stringify({
                    success: true,
                    result: nsMap.get(key).metadata ?? {},
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        return new Response('bad route', { status: 404 })
    }

    fetchImpl.calls = calls
    return fetchImpl
}

function makeMigrationConfig() {
    return {
        account_id: 'acc-test',
        kv_namespaces: [
            { binding: 'NOTES', id: 'ns-notes' },
            { binding: 'SHARE', id: 'ns-share' },
        ],
        d1_databases: [
            { binding: 'NOTE_HISTORY_DB', database_name: 'notes-db', database_id: 'd1-notes' },
        ],
        vars: {
            SCN_STORAGE_DRIVER: 'auto',
        },
    }
}

test('package.json wires db:init, db:init:owner, db:migrate-legacy, deploy, deploy:owner, and publish', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    assert.equal(pkg.scripts['db:init'], 'node scripts/db-init.mjs')
    assert.equal(pkg.scripts['db:init:owner'], 'node scripts/db-init.mjs --config wrangler.owner.toml')
    assert.equal(pkg.scripts['db:migrate-legacy'], 'node scripts/migrate-legacy-notes.mjs')
    assert.equal(pkg.scripts.deploy, 'npm run db:init && wrangler deploy')
    assert.equal(pkg.scripts['deploy:owner'], 'npm run predeploy && npm run db:init:owner && wrangler deploy --config wrangler.owner.toml')
    assert.equal(pkg.scripts.publish, 'npm run db:init && wrangler deploy')
    assert.match(pkg.scripts.predeploy, /build:block-editor/)
})

test('planDbInitTargets handles single-D1 setup (NOTE_HISTORY_DB)', () => {
    const config = parseWranglerToml(readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8'))
    const plan = planDbInitTargets(config)

    assert.equal(plan.storageDriver, 'auto')
    assert.deepEqual(plan.roles, {
        notesDb: 'NOTE_HISTORY_DB',
        historyDb: 'NOTE_HISTORY_DB',
        accountDb: 'NOTE_HISTORY_DB',
        annotationDb: 'NOTE_HISTORY_DB',
    })
    assert.equal(plan.targets.length, 1)
    assert.equal(plan.targets[0].binding, 'NOTE_HISTORY_DB')
    assert.deepEqual(plan.targets[0].files, [
        'schema/notes_d1.sql',
        'schema/notes_registry.sql',
        'schema/note_history.sql',
        'schema/note_history_meta.sql',
        'schema/note_stats.sql',
        'schema/note_annotations.sql',
        'schema/accounts.sql',
    ])
})

test('staging plans use only environment vars and D1 databases', () => {
    const rootConfig = `
[vars]
SCN_STORAGE_DRIVER = "d1"
SCN_NOTES_DB_BINDING = "PRODUCTION_DB"
SCN_ENABLE_NOTE_HISTORY = "0"
[[d1_databases]]
binding = "PRODUCTION_DB"
database_id = "production-id"
`
    const noStagingBindings = parseWranglerToml(`${rootConfig}\n[env.staging.vars]\nSCN_STORAGE_DRIVER = "auto"\n`, { env: 'staging' })
    assert.deepEqual(noStagingBindings.vars, { SCN_STORAGE_DRIVER: 'auto' })
    assert.deepEqual(noStagingBindings.d1_databases, [])
    assert.deepEqual(planDbInitTargets(noStagingBindings).targets, [])

    const stagingConfig = parseWranglerToml(`${rootConfig}\n[[env.staging.d1_databases]]\nbinding = "NOTE_HISTORY_DB"\ndatabase_id = "staging-id"\n`, { env: 'staging' })
    assert.deepEqual(stagingConfig.vars, {})
    const stagingPlan = planDbInitTargets(stagingConfig)
    assert.equal(stagingPlan.storageDriver, 'auto')
    assert.equal(stagingPlan.targets.length, 1)
    assert.equal(stagingPlan.targets[0].databaseId, 'staging-id')
    assert.ok(stagingPlan.targets[0].files.includes('schema/note_history.sql'))

    const missingEnvironment = parseWranglerToml(rootConfig, { env: 'staging' })
    assert.deepEqual(missingEnvironment.vars, {})
    assert.deepEqual(planDbInitTargets(missingEnvironment).targets, [])
})

test('named environments never inherit root KV, R2, D1, or vars', () => {
    const config = `
[vars]
ENVIRONMENT = "production"
[[kv_namespaces]]
binding = "NOTES"
id = "production-kv"
[[r2_buckets]]
binding = "IMAGES"
bucket_name = "production-images"
[[d1_databases]]
binding = "DB"
database_id = "production-db"
`
    for (const suffix of ['', '\n[env.staging.vars]\nENVIRONMENT = "staging"\n']) {
        const staging = parseWranglerToml(config + suffix, { env: 'staging' })
        assert.deepEqual(staging.kv_namespaces, [])
        assert.deepEqual(staging.r2_buckets, [])
        assert.deepEqual(staging.d1_databases, [])
        assert.deepEqual(staging.vars, suffix ? { ENVIRONMENT: 'staging' } : {})
    }
    const staging = parseWranglerToml(`${config}
[[env.staging.kv_namespaces]]
binding = "NOTES"
id = "staging-kv"
[[env.staging.r2_buckets]]
binding = "IMAGES"
bucket_name = "staging-images"
[[env.staging.d1_databases]]
binding = "DB"
database_id = "staging-db"
`, { env: 'staging' })
    assert.deepEqual(staging.kv_namespaces, [{ binding: 'NOTES', id: 'staging-kv' }])
    assert.deepEqual(staging.r2_buckets, [{ binding: 'IMAGES', bucket_name: 'staging-images' }])
    assert.deepEqual(staging.d1_databases, [{ binding: 'DB', database_id: 'staging-db' }])
})

test('planDbInitTargets handles split-binding setup (APP_DB / NOTES_DB / NOTE_HISTORY_DB / DB) and physical ID deduplication', () => {
    const splitConfig = {
        vars: { SCN_STORAGE_DRIVER: 'auto', SCN_ENABLE_NOTE_HISTORY: '1' },
        d1_databases: [
            { binding: 'APP_DB', database_name: 'app-db', database_id: 'id-app' },
            { binding: 'NOTES_DB', database_name: 'notes-db', database_id: 'id-notes' },
            { binding: 'NOTE_HISTORY_DB', database_name: 'history-db', database_id: 'id-history' },
            { binding: 'DB', database_name: 'legacy-db', database_id: 'id-legacy' },
        ],
    }

    const plan = planDbInitTargets(splitConfig)
    assert.deepEqual(plan.roles, {
        notesDb: 'NOTES_DB',
        historyDb: 'NOTE_HISTORY_DB',
        accountDb: 'APP_DB',
        annotationDb: 'APP_DB',
    })

    const byBinding = new Map(plan.targets.map((t) => [t.binding, t.files]))
    assert.deepEqual(byBinding.get('NOTES_DB'), ['schema/notes_d1.sql', 'schema/notes_registry.sql'])
    assert.deepEqual(byBinding.get('NOTE_HISTORY_DB'), ['schema/note_history.sql', 'schema/note_history_meta.sql'])
    assert.deepEqual(byBinding.get('APP_DB'), ['schema/note_stats.sql', 'schema/note_annotations.sql', 'schema/accounts.sql'])
    assert.equal(byBinding.has('DB'), false)

    // Pinned SCN_NOTES_DB_BINDING=DB targets DB strictly without fallback
    const pinnedPlan = planDbInitTargets(splitConfig, { SCN_NOTES_DB_BINDING: 'DB' })
    assert.equal(pinnedPlan.roles.notesDb, 'DB')
    const pinnedByBinding = new Map(pinnedPlan.targets.map((t) => [t.binding, t.files]))
    assert.deepEqual(pinnedByBinding.get('DB'), ['schema/notes_d1.sql', 'schema/notes_registry.sql'])
    assert.equal(pinnedByBinding.has('NOTES_DB'), false)

    // Physical DB deduplication: APP_DB and NOTE_HISTORY_DB share same database_id
    const sharedPhysicalPlan = planDbInitTargets({
        vars: { SCN_STORAGE_DRIVER: 'auto' },
        d1_databases: [
            { binding: 'NOTES_DB', database_name: 'notes-db', database_id: 'id-notes' },
            { binding: 'APP_DB', database_name: 'shared-db', database_id: 'id-shared' },
            { binding: 'NOTE_HISTORY_DB', database_name: 'shared-db', database_id: 'id-shared' },
        ],
    })
    assert.equal(sharedPhysicalPlan.targets.length, 2)
    const sharedTarget = sharedPhysicalPlan.targets.find((t) => t.physicalKey === 'id:id-shared')
    assert.ok(sharedTarget)
    assert.deepEqual(sharedTarget.files, [
        'schema/note_history.sql',
        'schema/note_history_meta.sql',
        'schema/note_stats.sql',
        'schema/note_annotations.sql',
        'schema/accounts.sql',
    ])

    // Fail-closed when pinned SCN_NOTES_DB_BINDING is missing in D1/auto mode
    assert.throws(
        () => planDbInitTargets(
            { d1_databases: [{ binding: 'NOTE_HISTORY_DB', database_id: 'id-h' }] },
            { SCN_NOTES_DB_BINDING: 'NOTES_DB' }
        ),
        /missing from D1 bindings/i
    )
})

test('planDbInitTargets handles pure-KV mode with and without NOTE_HISTORY_DB annotations', () => {
    const pureKvNoD1 = planDbInitTargets({
        vars: { SCN_STORAGE_DRIVER: 'kv' },
        d1_databases: [],
    })
    assert.equal(pureKvNoD1.targets.length, 0)
    assert.equal(pureKvNoD1.steps.length, 0)

    const pureKvWithHistoryAndAnnotations = planDbInitTargets({
        vars: { SCN_STORAGE_DRIVER: 'kv', SCN_ENABLE_NOTE_HISTORY: '1', SCN_ENABLE_ANNOTATIONS: '1' },
        d1_databases: [{ binding: 'NOTE_HISTORY_DB', database_name: 'hist', database_id: 'id-h' }],
    })
    assert.equal(pureKvWithHistoryAndAnnotations.targets.length, 1)
    assert.deepEqual(pureKvWithHistoryAndAnnotations.targets[0].files, [
        'schema/note_history.sql',
        'schema/note_stats.sql',
        'schema/note_annotations.sql',
    ])

    const pureKvAnnotationsDisabled = planDbInitTargets({
        vars: { SCN_STORAGE_DRIVER: 'kv', SCN_ENABLE_NOTE_HISTORY: '0', SCN_ENABLE_ANNOTATIONS: '0' },
        d1_databases: [{ binding: 'NOTE_HISTORY_DB', database_name: 'hist', database_id: 'id-h' }],
    })
    assert.deepEqual(pureKvAnnotationsDisabled.targets[0].files, ['schema/note_stats.sql'])
})

test('account schema includes annotations when the annotation feature is disabled', async () => {
    const config = {
        vars: { SCN_STORAGE_DRIVER: 'auto', SCN_ENABLE_ANNOTATIONS: '0' },
        d1_databases: [
            { binding: 'APP_DB', database_id: 'app' },
            { binding: 'NOTES_DB', database_id: 'notes' },
        ],
    }
    const plan = planDbInitTargets(config)
    const appTarget = plan.targets.find((target) => target.binding === 'APP_DB')
    assert.deepEqual(appTarget.files, ['schema/note_stats.sql', 'schema/note_annotations.sql', 'schema/accounts.sql'])
    assert.equal(plan.skipped.some((entry) => entry.file === 'schema/note_annotations.sql'), false)

    const databases = new Map()
    try {
        await runDbInit({
            config,
            env: {},
            execSqlFile(binding, file) {
                if (!databases.has(binding)) databases.set(binding, new DatabaseSync(':memory:'))
                databases.get(binding).exec(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'))
            },
        })
        const names = databases.get('APP_DB').prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
        assert.ok(names.includes('annotation_messages'))
        assert.ok(names.includes('accounts'))
    } finally {
        for (const db of databases.values()) db.close()
    }
})

test('db init forwards the selected Wrangler environment to each execution', () => {
    const dir = mkdtempSync(join(tmpdir(), 'db-init-env-'))
    try {
        const capture = join(dir, 'args')
        const configPath = join(dir, 'wrangler.toml')
        writeFileSync(join(dir, 'npx'), '#!/bin/sh\nprintf "%s\\n" "$@" >> "$DB_INIT_CAPTURE"\nprintf "%s\\n" "---" >> "$DB_INIT_CAPTURE"\n', { mode: 0o755 })
        writeFileSync(configPath, `[vars]\nSCN_STORAGE_DRIVER = "kv"\n[env.staging.vars]\nSCN_STORAGE_DRIVER = "kv"\n[[env.staging.d1_databases]]\nbinding = "APP_DB"\ndatabase_id = "staging-id"\n`)
        const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/db-init.mjs', import.meta.url)), '--config', configPath, '--env', 'staging'], {
            encoding: 'utf8',
            env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, DB_INIT_CAPTURE: capture },
        })
        assert.equal(result.status, 0, result.stderr)
        const calls = readFileSync(capture, 'utf8').trim().split('\n---').filter((call) => call.trim()).map((call) => call.trim().split('\n'))
        assert.ok(calls.length > 0)
        for (const args of calls) {
            assert.deepEqual(args.slice(0, 4), ['wrangler', 'd1', 'execute', 'APP_DB'])
            assert.equal(args[args.indexOf('--env') + 1], 'staging')
            assert.equal(args[args.indexOf('--config') + 1], configPath)
        }
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})

test('runDbInit executes schemas for wrangler.owner.toml and applies all SQL files cleanly to SQLite', async () => {
    const ownerTomlPath = new URL('../wrangler.owner.toml', import.meta.url)
    const ownerToml = existsSync(ownerTomlPath)
        ? readFileSync(ownerTomlPath, 'utf8')
        : `
name = "cloud-notepad"
[vars]
SCN_STORAGE_DRIVER = "auto"
SCN_ENABLE_NOTE_HISTORY = "1"
[[d1_databases]]
binding = "NOTE_HISTORY_DB"
database_name = "cloud-notepad-history"
database_id = "owner-db-id"
`
    const ownerConfig = parseWranglerToml(ownerToml)
    const sqliteDb = new DatabaseSync(':memory:')

    const executed = []
    const res = await runDbInit({
        config: ownerConfig,
        execSqlFile(binding, file) {
            executed.push({ binding, file })
            const sql = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
            sqliteDb.exec(sql)
        },
    })

    assert.equal(res.dryRun, false)
    assert.equal(executed.length, 7)
    assert.ok(executed.every((step) => step.binding === 'NOTE_HISTORY_DB'))

    const tables = sqliteDb
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all()
        .map((r) => r.name)
    for (const expectedTable of [
        'notes',
        'shares',
        'note_tombstones',
        'share_token_registry',
        'note_history',
        'note_history_meta',
        'note_stats',
        'note_stats_uid',
        'note_view_devices_uid',
        'annotation_threads',
        'annotation_messages',
        'annotation_thread_meta',
        'accounts',
        'account_passkeys',
        'account_space_items',
        'share_circles',
        'share_circle_items',
    ]) {
        assert.ok(tables.includes(expectedTable), `Expected table ${expectedTable} to be created`)
    }

    // Dry run must not invoke execSqlFile
    let dryCalls = 0
    const dryRes = await runDbInit({
        config: ownerConfig,
        dryRun: true,
        execSqlFile() {
            dryCalls += 1
        },
    })
    assert.equal(dryRes.dryRun, true)
    assert.equal(dryCalls, 0)
    assert.equal(dryRes.plan.steps.length, 7)
})

test('migrateLegacyNotes requires --audit or --confirm-quiesced-snapshot and aborts on truncated/error KV REST responses', async () => {
    const sqliteDb = new DatabaseSync(':memory:')
    initNotesSchemaOnSqlite(sqliteDb)
    const db = createSqliteD1Adapter(sqliteDb)

    await assert.rejects(
        () => migrateLegacyNotes({
            config: makeMigrationConfig(),
            db,
            apiToken: 'tok',
            fetch: createMockKvFetch({ getStateForPass: () => ({ notes: new Map(), share: new Map() }) }),
        }),
        /CONFIRM_QUIESCED_SNAPSHOT_REQUIRED/
    )

    // Truncated cursor abort
    await assert.rejects(
        () => migrateLegacyNotes({
            config: makeMigrationConfig(),
            db,
            apiToken: 'tok',
            audit: true,
            fetch: createMockKvFetch({
                pageSize: 1,
                forceTruncatedCursor: true,
                getStateForPass: () => ({
                    notes: new Map([['n1', { value: 'hello', metadata: {} }], ['n2', { value: 'world', metadata: {} }]]),
                    share: new Map(),
                }),
            }),
        }),
        /KV_LIST_TRUNCATED/
    )

    // Stuck cursor abort
    await assert.rejects(
        () => migrateLegacyNotes({
            config: makeMigrationConfig(),
            db,
            apiToken: 'tok',
            audit: true,
            fetch: createMockKvFetch({
                pageSize: 1,
                forceStuckCursor: true,
                getStateForPass: () => ({
                    notes: new Map([['n1', { value: 'hello', metadata: {} }], ['n2', { value: 'world', metadata: {} }]]),
                    share: new Map(),
                }),
            }),
        }),
        /KV_LIST_CURSOR_STUCK/
    )

    // Non-200 HTTP error on /values/:key abort
    await assert.rejects(
        () => migrateLegacyNotes({
            config: makeMigrationConfig(),
            db,
            apiToken: 'tok',
            confirmQuiescedSnapshot: true,
            fetch: createMockKvFetch({
                forceValueHttpStatus: 503,
                getStateForPass: () => ({
                    notes: new Map([['n1', { value: 'hello', metadata: {} }]]),
                    share: new Map(),
                }),
            }),
        }),
        /KV_API_ERROR: getValue\(n1\) HTTP 503/
    )
})

test('migrateLegacyNotes --audit detects unstable pass-1 vs pass-2 snapshots and reports clean pass without mutating D1', async () => {
    const sqliteDb = new DatabaseSync(':memory:')
    initNotesSchemaOnSqlite(sqliteDb)
    sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('d1-note', 'v1', JSON.stringify({ updateAt: 100 }), 100, 100)
    const db = createSqliteD1Adapter(sqliteDb)

    // Unstable pass 2
    await assert.rejects(
        () => migrateLegacyNotes({
            config: makeMigrationConfig(),
            db,
            apiToken: 'tok',
            audit: true,
            fetch: createMockKvFetch({
                getStateForPass: (pass) => ({
                    notes: new Map([
                        ['kv-only', { value: pass === 1 ? 'a' : 'b', metadata: { updateAt: 100 } }],
                    ]),
                    share: new Map(),
                }),
            }),
        }),
        /SNAPSHOT_UNSTABLE/
    )

    // Clean stable 2-pass audit across paginated pages (>1 page)
    const cleanFetch = createMockKvFetch({
        pageSize: 1,
        getStateForPass: () => ({
            notes: new Map([
                ['kv-only', { value: 'kv body', metadata: { updateAt: 200, share: true, shareSlug: 'Abc123' } }],
                ['d1-note', { value: 'v1', metadata: { updateAt: 100 } }],
            ]),
            share: new Map([
                ['Abc123', { value: 'kv-only' }],
            ]),
        }),
    })

    const auditReport = await migrateLegacyNotes({
        config: makeMigrationConfig(),
        db,
        apiToken: 'tok',
        audit: true,
        fetch: cleanFetch,
    })

    assert.equal(auditReport.ok, true)
    assert.equal(auditReport.mode, 'audit')
    assert.equal(auditReport.stable, true)
    assert.equal(auditReport.summary.kvOnlyPromoted, 1)
    assert.equal(auditReport.summary.d1LegacyClaimed, 1)
    assert.equal(auditReport.conflicts.length, 0)
    // Verify D1 was NOT mutated during --audit
    assert.equal(sqliteDb.prepare('SELECT COUNT(*) AS cnt FROM notes').get().cnt, 1)
    assert.equal(sqliteDb.prepare('SELECT COUNT(*) AS cnt FROM note_tombstones').get().cnt, 0)
    // Verify central KV REST URLs were called
    assert.ok(cleanFetch.calls.some((c) => c.url.includes('/accounts/acc-test/storage/kv/namespaces/ns-notes/keys')))
    assert.ok(cleanFetch.calls.some((c) => c.url.includes('/accounts/acc-test/storage/kv/namespaces/ns-notes/values/')))
    assert.ok(cleanFetch.calls.some((c) => c.url.includes('/accounts/acc-test/storage/kv/namespaces/ns-notes/metadata/')))
})

test('migrateLegacyNotes promotes KV-only notes, newer KV content, claims legacy D1 notes, and verifies parity', async () => {
    const sqliteDb = new DatabaseSync(':memory:')
    initNotesSchemaOnSqlite(sqliteDb)
    const nowUnix = 1_700_000_000

    // D1 note with older content (security matches KV)
    sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('shared-note', 'old d1 content', JSON.stringify({ updateAt: 100, share: true, shareSlug: 'Tok111' }), 100, 100)
    sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
        .run('Tok111', 'shared-note', 100)

    // D1-only burned legacy note with stale shares row that must be cleaned up
    sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('burned-d1', 'secret', JSON.stringify({ updateAt: 100, share: true, shareSlug: 'Burn99', burned: true }), 100, 100)
    sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
        .run('Burn99', 'burned-d1', 100)

    // D1-only expired legacy note with share: true
    sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('expired-d1', 'old', JSON.stringify({ updateAt: 100, share: true, shareSlug: 'Exp123', shareExpiresAt: nowUnix - 10 }), 100, 100)
    sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
        .run('Exp123', 'expired-d1', 100)

    // Already-tombstoned legacy path must NOT be resurrected from KV
    sqliteDb.prepare('INSERT INTO note_tombstones (path, deleted_note_uid, deleted_at, delete_nonce) VALUES (?, ?, ?, ?)')
        .run('deleted-note', '__legacy__', nowUnix - 50, 'del-1')

    const db = createSqliteD1Adapter(sqliteDb)
    const kvNotes = new Map([
        ['kv-only-active', { value: 'brand new kv', metadata: { createdAt: 500, updateAt: 600, share: true, shareSlug: 'KvTok1' } }],
        ['kv-only-burned', { value: 'burned kv', metadata: { updateAt: 500, share: true, shareSlug: 'KvBurn', shareBurned: true } }],
        ['shared-note', { value: 'newer kv content', metadata: { updateAt: 250, share: true, shareSlug: 'Tok111' } }],
        ['deleted-note', { value: 'zombie kv copy', metadata: { updateAt: 50 } }],
    ])
    const kvShare = new Map([
        ['KvTok1', { value: 'kv-only-active' }],
        ['Tok111', { value: 'shared-note' }],
        ['SHARE_STATUS:Orph01', { value: JSON.stringify({ status: 'burned', updatedAt: nowUnix - 5 }) }],
    ])

    const res = await migrateLegacyNotes({
        config: makeMigrationConfig(),
        db,
        apiToken: 'tok',
        confirmQuiescedSnapshot: true,
        nowUnix,
        fetch: createMockKvFetch({ getStateForPass: () => ({ notes: kvNotes, share: kvShare }) }),
    })

    assert.equal(res.ok, true)
    assert.equal(res.summary.kvOnlyPromoted, 2)
    assert.equal(res.summary.kvContentPromoted, 1)
    assert.equal(res.summary.d1LegacyClaimed, 2)
    assert.equal(res.summary.tombstonedSkipped, 1)
    assert.equal(res.summary.terminalStatusPinned, 1)

    // Verify promoted & claimed notes
    assert.equal(sqliteDb.prepare('SELECT content FROM notes WHERE path = ?').get('shared-note').content, 'newer kv content')
    assert.equal(sqliteDb.prepare('SELECT content FROM notes WHERE path = ?').get('kv-only-active').content, 'brand new kv')
    assert.equal(sqliteDb.prepare('SELECT path FROM notes WHERE path = ?').get('deleted-note'), undefined)

    // Verify burned & expired D1 notes revoked & shares cleaned
    const burnReg = sqliteDb.prepare('SELECT revoked_reason, is_csprng_v1 FROM share_token_registry WHERE share_id = ?').get('Burn99')
    assert.equal(burnReg.revoked_reason, 'burned')
    assert.equal(burnReg.is_csprng_v1, 0)
    const expReg = sqliteDb.prepare('SELECT revoked_reason FROM share_token_registry WHERE share_id = ?').get('Exp123')
    assert.equal(expReg.revoked_reason, 'expired')
    const orphanReg = sqliteDb.prepare('SELECT target_path, note_uid, revoked_reason FROM share_token_registry WHERE share_id = ?').get('Orph01')
    assert.equal(orphanReg.target_path, '__legacy_terminal__')
    assert.equal(orphanReg.note_uid, '__legacy_terminal__')
    assert.equal(orphanReg.revoked_reason, 'burned')

    assert.equal(sqliteDb.prepare('SELECT path FROM shares WHERE share_id = ?').get('Burn99'), undefined)
    assert.equal(sqliteDb.prepare('SELECT path FROM shares WHERE share_id = ?').get('Exp123'), undefined)

    // Parity verification
    assert.equal(res.parity.notesCount, 5)
    assert.equal(res.parity.unclaimedNotesCount, 0)
    assert.equal(res.parity.sharesCount, 2)
    assert.equal(res.parity.activeRegistryCount, 2)
    assert.equal(res.parity.orphanSharesCount, 0)
    assert.equal(res.parity.missingSharesCount, 0)
    assert.equal(res.parity.revokedInSharesCount, 0)
})

test('migrateLegacyNotes aborts on ANY security/share field divergence (even with unchanged updateAt) and on SHARE/shares or equal-timestamp content divergence', async () => {
    const baseMeta = {
        updateAt: 1000,
        share: true,
        shareSlug: 'Same01',
        shareMode: 'timelock',
        shareUnlockAt: 2000,
        shareViewCount: 0,
        shareMaxViews: 5,
    }

    const divergentCases = [
        ['shareUnlockAt', { ...baseMeta, shareUnlockAt: 9999 }],
        ['shareViewCount', { ...baseMeta, shareViewCount: 1 }],
        ['shareMaxViews', { ...baseMeta, shareMaxViews: 2 }],
        ['burned', { ...baseMeta, burned: true }],
        ['shareBurned', { ...baseMeta, shareBurned: true }],
        ['shareSlug', { ...baseMeta, shareSlug: 'Other1' }],
        ['shareId', { ...baseMeta, shareId: 'Legacy2' }],
        ['pw', { ...baseMeta, pw: 'hash-kv' }],
        ['vpw', { ...baseMeta, vpw: 'vhash-kv' }],
        ['share', { ...baseMeta, share: false }],
    ]

    for (const [fieldName, kvMeta] of divergentCases) {
        const sqliteDb = new DatabaseSync(':memory:')
        initNotesSchemaOnSqlite(sqliteDb)
        sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run('div-note', 'same content', JSON.stringify(baseMeta), 1000, 1000)
        sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
            .run('Same01', 'div-note', 1000)

        const db = createSqliteD1Adapter(sqliteDb)
        await assert.rejects(
            () => migrateLegacyNotes({
                config: makeMigrationConfig(),
                db,
                apiToken: 'tok',
                confirmQuiescedSnapshot: true,
                fetch: createMockKvFetch({
                    getStateForPass: () => ({
                        notes: new Map([['div-note', { value: 'same content', metadata: kvMeta }]]),
                        share: new Map([['Same01', { value: 'div-note' }]]),
                    }),
                }),
            }),
            /MIGRATION_ABORTED_CONFLICTS/,
            `Expected cutover abort for divergent field ${fieldName}`
        )
        // Confirm D1 was NOT mutated on abort
        assert.equal(sqliteDb.prepare('SELECT COUNT(*) AS cnt FROM note_tombstones').get().cnt, 0)
    }

    // SHARE vs shares mapping mismatch abort
    {
        const sqliteDb = new DatabaseSync(':memory:')
        initNotesSchemaOnSqlite(sqliteDb)
        sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run('map-note', 'same', JSON.stringify({ updateAt: 1000, share: true, shareSlug: 'TokD1A' }), 1000, 1000)
        sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
            .run('TokD1A', 'map-note', 1000)
        const db = createSqliteD1Adapter(sqliteDb)

        await assert.rejects(
            () => migrateLegacyNotes({
                config: makeMigrationConfig(),
                db,
                apiToken: 'tok',
                confirmQuiescedSnapshot: true,
                fetch: createMockKvFetch({
                    getStateForPass: () => ({
                        notes: new Map([['map-note', { value: 'same', metadata: { updateAt: 1000, share: true, shareSlug: 'TokD1A' } }]]),
                        share: new Map([['TokKvB', { value: 'map-note' }]]),
                    }),
                }),
            }),
            /share_mapping_divergence/
        )
    }

    // Equal-timestamp content divergence abort
    {
        const sqliteDb = new DatabaseSync(':memory:')
        initNotesSchemaOnSqlite(sqliteDb)
        sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run('eq-note', 'd1 body', JSON.stringify({ updateAt: 1000 }), 1000, 1000)
        const db = createSqliteD1Adapter(sqliteDb)

        await assert.rejects(
            () => migrateLegacyNotes({
                config: makeMigrationConfig(),
                db,
                apiToken: 'tok',
                confirmQuiescedSnapshot: true,
                fetch: createMockKvFetch({
                    getStateForPass: () => ({
                        notes: new Map([['eq-note', { value: 'kv body', metadata: { updateAt: 1000 } }]]),
                        share: new Map(),
                    }),
                }),
            }),
            /equal_timestamp_content_divergence/
        )
    }
})

test('migrateLegacyNotes resolves conflicts via --prefer=kv, --prefer=d1, and --resolve-stricter', async () => {
    const nowUnix = 1_700_000_000

    // 1. --prefer=kv
    {
        const sqliteDb = new DatabaseSync(':memory:')
        initNotesSchemaOnSqlite(sqliteDb)
        sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run('p-kv', 'd1 old', JSON.stringify({ updateAt: 1000, share: true, shareSlug: 'OldTok' }), 1000, 1000)
        sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
            .run('OldTok', 'p-kv', 1000)
        const db = createSqliteD1Adapter(sqliteDb)

        const res = await migrateLegacyNotes({
            config: makeMigrationConfig(),
            db,
            apiToken: 'tok',
            confirmQuiescedSnapshot: true,
            prefer: 'kv',
            nowUnix,
            fetch: createMockKvFetch({
                getStateForPass: () => ({
                    notes: new Map([['p-kv', { value: 'kv winner', metadata: { updateAt: 1000, share: true, shareSlug: 'NewTok', vpw: 'secret' } }]]),
                    share: new Map([['NewTok', { value: 'p-kv' }]]),
                }),
            }),
        })
        assert.equal(res.summary.resolvedByPreferKv, 1)
        const row = sqliteDb.prepare('SELECT content, metadata FROM notes WHERE path = ?').get('p-kv')
        assert.equal(row.content, 'kv winner')
        assert.equal(JSON.parse(row.metadata).shareSlug, 'NewTok')
        assert.equal(sqliteDb.prepare('SELECT share_id FROM shares WHERE path = ?').get('p-kv').share_id, 'NewTok')
        assert.equal(sqliteDb.prepare('SELECT revoked_reason FROM share_token_registry WHERE share_id = ?').get('OldTok').revoked_reason, 'rotated')
    }

    // 2. --prefer=d1
    {
        const sqliteDb = new DatabaseSync(':memory:')
        initNotesSchemaOnSqlite(sqliteDb)
        sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run('p-d1', 'd1 winner', JSON.stringify({ updateAt: 1000, share: true, shareSlug: 'D1Tok1' }), 1000, 1000)
        sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
            .run('D1Tok1', 'p-d1', 1000)
        const db = createSqliteD1Adapter(sqliteDb)

        const res = await migrateLegacyNotes({
            config: makeMigrationConfig(),
            db,
            apiToken: 'tok',
            confirmQuiescedSnapshot: true,
            prefer: 'd1',
            nowUnix,
            fetch: createMockKvFetch({
                getStateForPass: () => ({
                    notes: new Map([['p-d1', { value: 'kv loser', metadata: { updateAt: 1000, share: false } }]]),
                    share: new Map(),
                }),
            }),
        })
        assert.equal(res.summary.resolvedByPreferD1, 1)
        const row = sqliteDb.prepare('SELECT content, metadata FROM notes WHERE path = ?').get('p-d1')
        assert.equal(row.content, 'd1 winner')
        assert.ok(JSON.parse(row.metadata).noteUid)
        assert.equal(sqliteDb.prepare('SELECT share_id FROM shares WHERE path = ?').get('p-d1').share_id, 'D1Tok1')
    }

    // 3. --resolve-stricter: chooses share:false, password-protected, burned, earlier expiration, stricter timelock
    {
        const sqliteDb = new DatabaseSync(':memory:')
        initNotesSchemaOnSqlite(sqliteDb)
        // Note A: D1 share:true vs KV share:false -> chooses share:false
        sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run('s-unshare', 'same', JSON.stringify({ updateAt: 1000, share: true, shareSlug: 'Unsh01' }), 1000, 1000)
        sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
            .run('Unsh01', 's-unshare', 1000)

        // Note B: D1 unburned vs KV burned -> chooses burned & clears shares
        sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run('s-burn', 'same', JSON.stringify({ updateAt: 1000, share: true, shareSlug: 'Burn01' }), 1000, 1000)
        sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
            .run('Burn01', 's-burn', 1000)

        // Note C: D1 passwordless vs KV password-protected + earlier expiry + timelock
        sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run('s-lock', 'old', JSON.stringify({ updateAt: 1000, share: true, shareSlug: 'Lock01', shareExpiresAt: nowUnix + 5000 }), 1000, 1000)
        sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
            .run('Lock01', 's-lock', 1000)

        const db = createSqliteD1Adapter(sqliteDb)
        const res = await migrateLegacyNotes({
            config: makeMigrationConfig(),
            db,
            apiToken: 'tok',
            confirmQuiescedSnapshot: true,
            resolveStricter: true,
            nowUnix,
            fetch: createMockKvFetch({
                getStateForPass: () => ({
                    notes: new Map([
                        ['s-unshare', { value: 'same', metadata: { updateAt: 1000, share: false } }],
                        ['s-burn', { value: 'same', metadata: { updateAt: 1000, share: true, shareSlug: 'Burn01', shareBurned: true } }],
                        ['s-lock', { value: 'newer', metadata: { updateAt: 1200, share: true, shareSlug: 'Lock01', vpw: 'vpwhash', shareExpiresAt: nowUnix + 600, shareMode: 'timelock', shareUnlockAt: nowUnix + 300 } }],
                    ]),
                    share: new Map([
                        ['Lock01', { value: 's-lock' }],
                    ]),
                }),
            }),
        })

        assert.equal(res.summary.resolvedByStricter, 3)

        const unshareMeta = JSON.parse(sqliteDb.prepare('SELECT metadata FROM notes WHERE path = ?').get('s-unshare').metadata)
        assert.equal(unshareMeta.share, false)
        assert.equal(sqliteDb.prepare('SELECT path FROM shares WHERE path = ?').get('s-unshare'), undefined)

        const burnMeta = JSON.parse(sqliteDb.prepare('SELECT metadata FROM notes WHERE path = ?').get('s-burn').metadata)
        assert.equal(burnMeta.shareBurned, true)
        assert.equal(sqliteDb.prepare('SELECT revoked_reason FROM share_token_registry WHERE share_id = ?').get('Burn01').revoked_reason, 'burned')
        assert.equal(sqliteDb.prepare('SELECT path FROM shares WHERE path = ?').get('s-burn'), undefined)

        const lockRow = sqliteDb.prepare('SELECT content, metadata FROM notes WHERE path = ?').get('s-lock')
        const lockMeta = JSON.parse(lockRow.metadata)
        assert.equal(lockRow.content, 'newer')
        assert.equal(lockMeta.vpw, 'vpwhash')
        assert.equal(lockMeta.shareExpiresAt, nowUnix + 600)
        assert.equal(lockMeta.shareUnlockAt, nowUnix + 300)
        assert.equal(sqliteDb.prepare('SELECT share_id FROM shares WHERE path = ?').get('s-lock').share_id, 'Lock01')
    }

    // 4. --resolve-stricter still aborts on equal-timestamp content divergence
    {
        const sqliteDb = new DatabaseSync(':memory:')
        initNotesSchemaOnSqlite(sqliteDb)
        sqliteDb.prepare('INSERT INTO notes (path, content, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
            .run('s-eq-content', 'd1 body', JSON.stringify({ updateAt: 1000, share: true, shareSlug: 'EqTok1' }), 1000, 1000)
        sqliteDb.prepare('INSERT INTO shares (share_id, path, created_at) VALUES (?, ?, ?)')
            .run('EqTok1', 's-eq-content', 1000)
        const db = createSqliteD1Adapter(sqliteDb)

        await assert.rejects(
            () => migrateLegacyNotes({
                config: makeMigrationConfig(),
                db,
                apiToken: 'tok',
                confirmQuiescedSnapshot: true,
                resolveStricter: true,
                fetch: createMockKvFetch({
                    getStateForPass: () => ({
                        notes: new Map([['s-eq-content', { value: 'kv body', metadata: { updateAt: 1000, share: false } }]]),
                        share: new Map(),
                    }),
                }),
            }),
            /equal_timestamp_content_divergence/
        )
    }

    assert.equal(SECURITY_SHARE_FIELDS.length, 16)
})
