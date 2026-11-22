import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import {
    getStorageDriverName,
    driverQueryNote,
    driverPutNote,
    driverDeleteNote,
    driverQueryShare,
    driverPutShare,
    driverDeleteShare,
} from '../src/storage_driver.mjs'

function createSqliteD1(schemaFiles = ['notes_d1.sql', 'notes_registry.sql']) {
    const sqlite = new DatabaseSync(':memory:')
    for (const file of schemaFiles) {
        sqlite.exec(readFileSync(new URL(`../schema/${file}`, import.meta.url), 'utf8'))
    }
    const wrapStmt = (sql, boundArgs = []) => ({
        _sql: sql,
        _args: boundArgs,
        bind(...args) {
            return wrapStmt(sql, args)
        },
        async first() {
            const row = sqlite.prepare(sql).get(...boundArgs)
            return row ?? null
        },
        async all() {
            const results = sqlite.prepare(sql).all(...boundArgs)
            return { results }
        },
        async run() {
            const info = sqlite.prepare(sql).run(...boundArgs)
            return { success: true, meta: { changes: Number(info?.changes ?? 0) } }
        },
    })
    return {
        sqlite,
        prepare(sql) {
            return wrapStmt(sql)
        },
        async batch(statements) {
            sqlite.exec('BEGIN IMMEDIATE')
            try {
                const out = []
                for (const stmt of statements) {
                    const info = sqlite.prepare(stmt._sql).run(...stmt._args)
                    out.push({ success: true, meta: { changes: Number(info?.changes ?? 0) }, results: [] })
                }
                sqlite.exec('COMMIT')
                return out
            } catch (err) {
                sqlite.exec('ROLLBACK')
                throw err
            }
        },
    }
}

test('storage driver defaults to auto mode', () => {
    delete globalThis.SCN_STORAGE_DRIVER
    assert.equal(getStorageDriverName(), 'auto')
})

test('storage driver honors SCN_STORAGE_DRIVER configuration', () => {
    globalThis.SCN_STORAGE_DRIVER = 'kv'
    assert.equal(getStorageDriverName(), 'kv')
    globalThis.SCN_STORAGE_DRIVER = 'd1'
    assert.equal(getStorageDriverName(), 'd1')
    globalThis.SCN_STORAGE_DRIVER = 'dual'
    assert.equal(getStorageDriverName(), 'auto')
    delete globalThis.SCN_STORAGE_DRIVER
})

test('storage driver query and put note with KV backend', async () => {
    const kvStore = new Map()
    globalThis.SCN_STORAGE_DRIVER = 'kv'
    globalThis.NOTES = {
        getWithMetadata: async (key) => kvStore.get(key) || { value: null, metadata: null },
        put: async (key, value, { metadata }) => kvStore.set(key, { value, metadata }),
        delete: async (key) => kvStore.delete(key),
    }

    await driverPutNote('test-note-1', '# Hello KV', { share: true })
    const result = await driverQueryNote('test-note-1')
    assert.equal(result.value, '# Hello KV')
    assert.equal(result.metadata.share, true)

    await driverDeleteNote('test-note-1')
    const deletedResult = await driverQueryNote('test-note-1')
    assert.equal(deletedResult.value, '')

    delete globalThis.NOTES
    delete globalThis.SCN_STORAGE_DRIVER
})

test('storage driver query and put note with D1 backend and fallback in auto mode', async () => {
    const kvNotes = new Map()
    const d1 = createSqliteD1(['notes_d1.sql', 'notes_registry.sql'])

    globalThis.SCN_STORAGE_DRIVER = 'auto'
    globalThis.NOTES = {
        getWithMetadata: async (key) => kvNotes.get(key) || { value: null, metadata: null },
        put: async (key, value, { metadata }) => kvNotes.set(key, { value, metadata }),
        delete: async (key) => kvNotes.delete(key),
    }
    globalThis.NOTES_DB = d1

    // 1. Existing note in KV should be read via fallback
    kvNotes.set('legacy-kv-note', { value: '# Legacy Note', metadata: { share: true } })
    const fallbackResult = await driverQueryNote('legacy-kv-note')
    assert.equal(fallbackResult.value, '# Legacy Note')
    assert.equal(fallbackResult.metadata.share, true)

    // 2. Writing note in auto mode writes to D1 and updates KV
    await driverPutNote('new-auto-note', '# Dual Note', { theme: 'serif' })
    const d1Result = await driverQueryNote('new-auto-note')
    assert.equal(d1Result.value, '# Dual Note')
    assert.equal(d1Result.metadata.theme, 'serif')
    assert.ok(d1Result.metadata.noteUid)
    assert.ok(kvNotes.has('new-auto-note'))

    delete globalThis.NOTES
    delete globalThis.NOTES_DB
    delete globalThis.SCN_STORAGE_DRIVER
})
