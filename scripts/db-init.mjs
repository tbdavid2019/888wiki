import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const SCHEMA_EXECUTION_ORDER = [
    'schema/notes_d1.sql',
    'schema/notes_registry.sql',
    'schema/note_history.sql',
    'schema/note_history_meta.sql',
    'schema/note_stats.sql',
    'schema/note_annotations.sql',
    'schema/accounts.sql',
]

/**
 * Strip TOML line comments outside quoted strings.
 */
function stripTomlComment(line) {
    let quote = null
    let escaped = false
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]
        if (escaped) {
            escaped = false
            continue
        }
        if (quote === '"' && ch === '\\') {
            escaped = true
            continue
        }
        if (ch === '"' || ch === "'") {
            if (quote === ch) {
                quote = null
            } else if (!quote) {
                quote = ch
            }
            continue
        }
        if (!quote && ch === '#') {
            return line.slice(0, i)
        }
    }
    return line
}

/**
 * Split a comma-separated TOML array/inline-table body respecting nested delimiters and quotes.
 */
function splitTomlTopLevel(text, delimiter = ',') {
    const parts = []
    let current = ''
    let quote = null
    let escaped = false
    let depthBrace = 0
    let depthBracket = 0

    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i]
        if (escaped) {
            current += ch
            escaped = false
            continue
        }
        if (quote === '"' && ch === '\\') {
            current += ch
            escaped = true
            continue
        }
        if (ch === '"' || ch === "'") {
            if (quote === ch) quote = null
            else if (!quote) quote = ch
            current += ch
            continue
        }
        if (!quote) {
            if (ch === '{') depthBrace += 1
            else if (ch === '}') depthBrace -= 1
            else if (ch === '[') depthBracket += 1
            else if (ch === ']') depthBracket -= 1
            else if (ch === delimiter && depthBrace === 0 && depthBracket === 0) {
                if (current.trim()) parts.push(current.trim())
                current = ''
                continue
            }
        }
        current += ch
    }
    if (current.trim()) parts.push(current.trim())
    return parts
}

/**
 * Parse a TOML scalar, inline table, or array value.
 */
function parseTomlValue(rawValue) {
    const val = rawValue.trim()
    if (!val) return ''
    if (val.startsWith('"') && val.endsWith('"')) {
        return val
            .slice(1, -1)
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
    }
    if (val.startsWith("'") && val.endsWith("'")) {
        return val.slice(1, -1)
    }
    if (val === 'true') return true
    if (val === 'false') return false
    if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val)
    if (val.startsWith('[') && val.endsWith(']')) {
        const inner = val.slice(1, -1).trim()
        if (!inner) return []
        return splitTomlTopLevel(inner, ',').map((item) => parseTomlValue(item))
    }
    if (val.startsWith('{') && val.endsWith('}')) {
        const inner = val.slice(1, -1).trim()
        const obj = {}
        if (!inner) return obj
        for (const pair of splitTomlTopLevel(inner, ',')) {
            const eqIdx = pair.indexOf('=')
            if (eqIdx === -1) continue
            const k = pair.slice(0, eqIdx).trim().replace(/^["']|["']$/g, '')
            const v = pair.slice(eqIdx + 1)
            obj[k] = parseTomlValue(v)
        }
        return obj
    }
    return val
}

function setNestedPath(root, pathParts, value) {
    let cur = root
    for (let i = 0; i < pathParts.length - 1; i += 1) {
        const key = pathParts[i]
        if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
            cur[key] = {}
        }
        cur = cur[key]
    }
    cur[pathParts[pathParts.length - 1]] = value
}

function getOrCreateTable(root, pathParts) {
    let cur = root
    for (const key of pathParts) {
        if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
            cur[key] = {}
        }
        cur = cur[key]
    }
    return cur
}

function appendArrayTable(root, pathParts) {
    let cur = root
    for (let i = 0; i < pathParts.length - 1; i += 1) {
        const key = pathParts[i]
        if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {}
        cur = cur[key]
    }
    const leaf = pathParts[pathParts.length - 1]
    if (!Array.isArray(cur[leaf])) cur[leaf] = []
    const item = {}
    cur[leaf].push(item)
    return item
}

function countDelimitersOutsideQuotes(text) {
    let quote = null
    let escaped = false
    let brackets = 0
    let braces = 0
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i]
        if (escaped) {
            escaped = false
            continue
        }
        if (quote === '"' && ch === '\\') {
            escaped = true
            continue
        }
        if (ch === '"' || ch === "'") {
            if (quote === ch) quote = null
            else if (!quote) quote = ch
            continue
        }
        if (!quote) {
            if (ch === '[') brackets += 1
            else if (ch === ']') brackets -= 1
            else if (ch === '{') braces += 1
            else if (ch === '}') braces -= 1
        }
    }
    return { brackets, braces }
}

/**
 * Parse a wrangler.toml configuration string into a structured JS object.
 * Supports top-level keys, [tables], [[array_of_tables]], multiline arrays, and [env.<name>].
 */
export function parseWranglerToml(tomlText = '', { env: envName = '' } = {}) {
    const root = {}
    let currentTarget = root
    const lines = String(tomlText || '').split(/\r?\n/)

    let pendingKey = null
    let pendingRaw = ''
    let pendingBrackets = 0
    let pendingBraces = 0

    for (const rawLine of lines) {
        const cleanLine = stripTomlComment(rawLine).trim()
        if (!cleanLine && !pendingKey) continue

        if (pendingKey) {
            pendingRaw += (pendingRaw ? '\n' : '') + cleanLine
            const counts = countDelimitersOutsideQuotes(cleanLine)
            pendingBrackets += counts.brackets
            pendingBraces += counts.braces
            if (pendingBrackets <= 0 && pendingBraces <= 0) {
                setNestedPath(currentTarget, pendingKey, parseTomlValue(pendingRaw))
                pendingKey = null
                pendingRaw = ''
                pendingBrackets = 0
                pendingBraces = 0
            }
            continue
        }

        if (cleanLine.startsWith('[[') && cleanLine.endsWith(']]')) {
            const pathParts = cleanLine.slice(2, -2).trim().split('.').map((s) => s.trim().replace(/^["']|["']$/g, ''))
            currentTarget = appendArrayTable(root, pathParts)
            continue
        }

        if (cleanLine.startsWith('[') && cleanLine.endsWith(']')) {
            const pathParts = cleanLine.slice(1, -1).trim().split('.').map((s) => s.trim().replace(/^["']|["']$/g, ''))
            currentTarget = getOrCreateTable(root, pathParts)
            continue
        }

        const eqIdx = cleanLine.indexOf('=')
        if (eqIdx === -1) continue
        const keyParts = cleanLine
            .slice(0, eqIdx)
            .trim()
            .split('.')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        const rhs = cleanLine.slice(eqIdx + 1).trim()
        const counts = countDelimitersOutsideQuotes(rhs)
        if (counts.brackets > 0 || counts.braces > 0) {
            pendingKey = keyParts
            pendingRaw = rhs
            pendingBrackets = counts.brackets
            pendingBraces = counts.braces
        } else {
            setNestedPath(currentTarget, keyParts, parseTomlValue(rhs))
        }
    }

    if (envName) {
        const envCfg = root.env?.[envName] || {}
        return {
            ...root,
            ...envCfg,
            vars: envCfg.vars || {},
            d1_databases: Array.isArray(envCfg.d1_databases) ? envCfg.d1_databases : [],
            kv_namespaces: Array.isArray(envCfg.kv_namespaces) ? envCfg.kv_namespaces : [],
            r2_buckets: Array.isArray(envCfg.r2_buckets) ? envCfg.r2_buckets : [],
        }
    }

    return root
}

/**
 * Load and parse a wrangler TOML file from disk.
 */
export function loadWranglerConfig(configPath = 'wrangler.toml', options = {}) {
    const absPath = resolve(options.cwd || process.cwd(), configPath)
    const content = readFileSync(absPath, 'utf8')
    return parseWranglerToml(content, options)
}

function parseBoolFlag(value, defaultValue = true) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return defaultValue
    }
    const normalized = String(value).trim().toLowerCase()
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    return defaultValue
}

function normalizeStorageDriver(value) {
    const normalized = String(value || 'auto').trim().toLowerCase()
    if (normalized === 'dual') return 'auto'
    if (['kv', 'd1', 'auto'].includes(normalized)) return normalized
    return 'auto'
}

function normalizeD1Bindings(config = {}) {
    const rawList = Array.isArray(config.d1Databases)
        ? config.d1Databases
        : (Array.isArray(config.d1_databases) ? config.d1_databases : [])

    const bindings = new Map()
    const pushBinding = (entry) => {
        if (!entry || typeof entry !== 'object') return
        const binding = String(entry.binding || '').trim()
        if (!binding) return
        const databaseName = String(entry.database_name || entry.databaseName || '').trim()
        const databaseId = String(entry.database_id || entry.databaseId || '').trim()
        const physicalKey = (databaseId && databaseId !== 'demo')
            ? `id:${databaseId}`
            : (databaseName ? `name:${databaseName}` : `binding:${binding}`)
        bindings.set(binding, {
            binding,
            databaseName,
            databaseId,
            physicalKey,
        })
    }

    for (const item of rawList) {
        pushBinding(item)
    }

    if (config.bindings && typeof config.bindings === 'object' && !Array.isArray(config.bindings)) {
        for (const [binding, meta] of Object.entries(config.bindings)) {
            if (!meta) continue
            if (typeof meta === 'object') {
                pushBinding({ binding, ...meta })
            } else if (typeof meta === 'string') {
                pushBinding({ binding, database_id: meta })
            }
        }
    }

    return bindings
}

const KNOWN_VAR_KEYS = [
    'SCN_STORAGE_DRIVER',
    'SCN_NOTES_DB_BINDING',
    'SCN_ENABLE_NOTE_HISTORY',
    'SCN_REQUIRE_NOTES_REGISTRY',
    'SCN_ENABLE_ANNOTATIONS',
]

/**
 * Plan D1 schema initialization targets and files per physical database binding.
 * Pure planning function suitable for both CLI execution and unit tests.
 */
export function planDbInitTargets(config = {}, overrides = {}) {
    const vars = {
        ...(config.vars && typeof config.vars === 'object' ? config.vars : {}),
    }
    for (const key of KNOWN_VAR_KEYS) {
        if (config[key] !== undefined) vars[key] = config[key]
        if (overrides[key] !== undefined) vars[key] = overrides[key]
    }
    if (overrides.vars && typeof overrides.vars === 'object') {
        Object.assign(vars, overrides.vars)
    }

    const storageDriver = normalizeStorageDriver(vars.SCN_STORAGE_DRIVER)
    const pinnedNotesBinding = String(vars.SCN_NOTES_DB_BINDING || '').trim()
    const requireNotesRegistry = String(vars.SCN_REQUIRE_NOTES_REGISTRY || '').trim() === '1'
    const enableNoteHistory = parseBoolFlag(vars.SCN_ENABLE_NOTE_HISTORY, true)
    const enableAnnotations = parseBoolFlag(vars.SCN_ENABLE_ANNOTATIONS, true)
    const includeNotesSchema = Boolean(overrides.includeNotesSchema ?? config.includeNotesSchema)

    const bindings = normalizeD1Bindings(config)

    const notesDb = pinnedNotesBinding
        ? (bindings.get(pinnedNotesBinding) || null)
        : (bindings.get('NOTES_DB') || bindings.get('NOTE_HISTORY_DB') || bindings.get('DB') || null)

    if (
        storageDriver !== 'kv'
        && (storageDriver === 'd1' || requireNotesRegistry || Boolean(pinnedNotesBinding))
        && !notesDb
    ) {
        const expected = pinnedNotesBinding || 'NOTES_DB | NOTE_HISTORY_DB | DB'
        throw new Error(`Configured notesDb binding (${expected}) is missing from D1 bindings`)
    }

    const historyDb = bindings.get('NOTE_HISTORY_DB') || null
    const accountDb = bindings.get('APP_DB') || bindings.get('NOTE_HISTORY_DB') || null
    const annotationDb = bindings.get('APP_DB') || bindings.get('NOTE_HISTORY_DB') || null
    const sameAccountAndAnnotationDb = Boolean(
        accountDb && annotationDb && accountDb.physicalKey === annotationDb.physicalKey
    )
    const includeAccountsSchema = Boolean(accountDb && storageDriver !== 'kv' && notesDb && sameAccountAndAnnotationDb)

    const targetMap = new Map()
    const skipped = []

    const addFile = (bindingObj, role, file) => {
        if (!bindingObj) return
        let target = targetMap.get(bindingObj.physicalKey)
        if (!target) {
            target = {
                binding: bindingObj.binding,
                aliases: [bindingObj.binding],
                databaseName: bindingObj.databaseName,
                databaseId: bindingObj.databaseId,
                physicalKey: bindingObj.physicalKey,
                roles: [],
                fileSet: new Set(),
            }
            targetMap.set(bindingObj.physicalKey, target)
        } else if (!target.aliases.includes(bindingObj.binding)) {
            target.aliases.push(bindingObj.binding)
        }
        if (!target.roles.includes(role)) {
            target.roles.push(role)
        }
        target.fileSet.add(file)
    }

    // 1. notesDb
    if (notesDb) {
        if (storageDriver !== 'kv' || includeNotesSchema) {
            addFile(notesDb, 'notesDb', 'schema/notes_d1.sql')
            addFile(notesDb, 'notesDb', 'schema/notes_registry.sql')
        } else {
            skipped.push({ binding: notesDb.binding, file: 'schema/notes_d1.sql', reason: 'pure-kv-mode' })
            skipped.push({ binding: notesDb.binding, file: 'schema/notes_registry.sql', reason: 'pure-kv-mode' })
        }
    }

    // 2. historyDb (NOTE_HISTORY_DB)
    if (historyDb) {
        if (enableNoteHistory) {
            addFile(historyDb, 'historyDb', 'schema/note_history.sql')
            if (storageDriver !== 'kv' || includeNotesSchema) {
                addFile(historyDb, 'historyDb', 'schema/note_history_meta.sql')
            } else {
                skipped.push({ binding: historyDb.binding, file: 'schema/note_history_meta.sql', reason: 'pure-kv-mode' })
            }
        } else {
            skipped.push({ binding: historyDb.binding, file: 'schema/note_history.sql', reason: 'note-history-disabled' })
            skipped.push({ binding: historyDb.binding, file: 'schema/note_history_meta.sql', reason: 'note-history-disabled' })
        }
    }

    // 3. annotationDb & accountDb (APP_DB || NOTE_HISTORY_DB)
    if (annotationDb) {
        if (enableAnnotations || includeAccountsSchema) {
            addFile(annotationDb, 'annotationDb', 'schema/note_annotations.sql')
        } else {
            skipped.push({ binding: annotationDb.binding, file: 'schema/note_annotations.sql', reason: 'annotations-disabled' })
        }
    }
    if (accountDb) {
        addFile(accountDb, 'accountDb', 'schema/note_stats.sql')
        if (includeAccountsSchema) {
            addFile(accountDb, 'accountDb', 'schema/accounts.sql')
        } else {
            const reason = storageDriver === 'kv'
                ? 'pure-kv-mode'
                : (!notesDb ? 'missing-notes-db' : 'account-annotation-db-mismatch')
            skipped.push({ binding: accountDb.binding, file: 'schema/accounts.sql', reason })
        }
    }

    const targets = []
    const steps = []
    for (const entry of targetMap.values()) {
        const files = SCHEMA_EXECUTION_ORDER.filter((file) => entry.fileSet.has(file))
        if (files.length === 0) continue
        targets.push({
            binding: entry.binding,
            aliases: entry.aliases,
            databaseName: entry.databaseName,
            databaseId: entry.databaseId,
            physicalKey: entry.physicalKey,
            roles: entry.roles,
            files,
        })
        for (const file of files) {
            steps.push({
                binding: entry.binding,
                file,
                roles: entry.roles,
                physicalKey: entry.physicalKey,
            })
        }
    }

    return {
        storageDriver,
        pinnedNotesBinding: pinnedNotesBinding || null,
        requireNotesRegistry,
        enableNoteHistory,
        enableAnnotations,
        roles: {
            notesDb: notesDb ? notesDb.binding : null,
            historyDb: historyDb ? historyDb.binding : null,
            accountDb: accountDb ? accountDb.binding : null,
            annotationDb: annotationDb ? annotationDb.binding : null,
        },
        targets,
        steps,
        skipped,
    }
}

function defaultExecSqlFile({ configPath, cwd, envName }) {
    return (bindingName, filePath) => {
        const args = ['wrangler', 'd1', 'execute', bindingName, '--remote', '-y']
        if (configPath) {
            args.push('--config', configPath)
        }
        if (envName) {
            args.push('--env', envName)
        }
        args.push(`--file=${filePath}`)
        const result = spawnSync('npx', args, {
            cwd: cwd || process.cwd(),
            stdio: 'inherit',
            shell: false,
        })
        if (result.error) throw result.error
        if (result.status !== 0) {
            throw new Error(`wrangler d1 execute failed for ${bindingName} (${filePath}) with exit code ${result.status}`)
        }
    }
}

/**
 * Execute D1 schema initialization for a wrangler config (or pre-parsed config).
 */
export async function runDbInit(options = {}) {
    const cwd = options.cwd || process.cwd()
    const configPath = options.configPath || 'wrangler.toml'
    const config = options.config || loadWranglerConfig(configPath, { cwd, env: options.envName })

    const envOverrides = {}
    const sourceEnv = options.env || process.env
    for (const key of KNOWN_VAR_KEYS) {
        if (sourceEnv && sourceEnv[key] !== undefined && sourceEnv[key] !== '') {
            envOverrides[key] = sourceEnv[key]
        }
    }
    const mergedOverrides = {
        ...envOverrides,
        ...(options.overrides || {}),
    }

    const plan = planDbInitTargets(config, mergedOverrides)
    const dryRun = Boolean(options.dryRun)
    const execSqlFile = options.execSqlFile || defaultExecSqlFile({ configPath, cwd, envName: options.envName })

    const executed = []
    if (!dryRun) {
        for (const step of plan.steps) {
            await execSqlFile(step.binding, step.file, step)
            executed.push({ binding: step.binding, file: step.file })
        }
    }

    return {
        configPath: options.config ? null : configPath,
        dryRun,
        plan,
        executed,
    }
}

function parseCliArgs(argv) {
    const parsed = {
        configPath: 'wrangler.toml',
        dryRun: false,
        envName: '',
        json: false,
        overrides: {},
    }
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i]
        if (arg === '--dry-run') {
            parsed.dryRun = true
        } else if (arg === '--json') {
            parsed.json = true
        } else if (arg === '--include-notes-schema') {
            parsed.overrides.includeNotesSchema = true
        } else if (arg === '--config' && argv[i + 1]) {
            parsed.configPath = argv[++i]
        } else if (arg.startsWith('--config=')) {
            parsed.configPath = arg.slice('--config='.length)
        } else if (arg === '--env' && argv[i + 1]) {
            parsed.envName = argv[++i]
        } else if (arg.startsWith('--env=')) {
            parsed.envName = arg.slice('--env='.length)
        } else if (arg === '--storage-driver' && argv[i + 1]) {
            parsed.overrides.SCN_STORAGE_DRIVER = argv[++i]
        } else if (arg.startsWith('--storage-driver=')) {
            parsed.overrides.SCN_STORAGE_DRIVER = arg.slice('--storage-driver='.length)
        } else if (arg === '--notes-db-binding' && argv[i + 1]) {
            parsed.overrides.SCN_NOTES_DB_BINDING = argv[++i]
        } else if (arg.startsWith('--notes-db-binding=')) {
            parsed.overrides.SCN_NOTES_DB_BINDING = arg.slice('--notes-db-binding='.length)
        } else if (arg === '--enable-note-history' && argv[i + 1]) {
            parsed.overrides.SCN_ENABLE_NOTE_HISTORY = argv[++i]
        } else if (arg.startsWith('--enable-note-history=')) {
            parsed.overrides.SCN_ENABLE_NOTE_HISTORY = arg.slice('--enable-note-history='.length)
        } else if (arg === '--require-notes-registry' && argv[i + 1]) {
            parsed.overrides.SCN_REQUIRE_NOTES_REGISTRY = argv[++i]
        } else if (arg.startsWith('--require-notes-registry=')) {
            parsed.overrides.SCN_REQUIRE_NOTES_REGISTRY = arg.slice('--require-notes-registry='.length)
        } else if (arg === '--enable-annotations' && argv[i + 1]) {
            parsed.overrides.SCN_ENABLE_ANNOTATIONS = argv[++i]
        } else if (arg.startsWith('--enable-annotations=')) {
            parsed.overrides.SCN_ENABLE_ANNOTATIONS = arg.slice('--enable-annotations='.length)
        }
    }
    return parsed
}

async function main() {
    const cli = parseCliArgs(process.argv.slice(2))
    const result = await runDbInit({
        configPath: cli.configPath,
        dryRun: cli.dryRun,
        envName: cli.envName,
        overrides: cli.overrides,
    })

    if (cli.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
        return
    }

    const modeLabel = result.dryRun ? '[dry-run] ' : ''
    if (result.plan.steps.length === 0) {
        process.stdout.write(`${modeLabel}No D1 schema targets selected (driver=${result.plan.storageDriver}).\n`)
        return
    }
    for (const step of result.plan.steps) {
        process.stdout.write(`${modeLabel}${step.binding} <- ${step.file}\n`)
    }
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirectExecution) {
    main().catch((err) => {
        process.stderr.write(`db:init error: ${err?.message || err}\n`)
        process.exit(1)
    })
}
