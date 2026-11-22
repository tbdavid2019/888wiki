import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import worker from '../src/index.js'
import { computeSourceRevision } from '../src/annotation_data.mjs'

function harness() {
    const sqlite = new DatabaseSync(':memory:')
    for (const name of ['notes_d1.sql', 'notes_registry.sql', 'note_history.sql', 'note_history_meta.sql', 'note_stats.sql', 'note_annotations.sql', 'accounts.sql']) {
        sqlite.exec(readFileSync(new URL(`../schema/${name}`, import.meta.url), 'utf8'))
    }
    const statement = (sql, args = []) => ({
        sql, args,
        bind(...values) { return statement(sql, values) },
        async first() { return sqlite.prepare(sql).get(...args) ?? null },
        async all() { return { results: sqlite.prepare(sql).all(...args) } },
        async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } } },
    })
    const db = {
        prepare: sql => statement(sql),
        async batch(statements) {
            sqlite.exec('BEGIN')
            try {
                const results = statements.map(s => ({ meta: { changes: Number(sqlite.prepare(s.sql).run(...s.args).changes) } }))
                sqlite.exec('COMMIT')
                return results
            } catch (error) {
                sqlite.exec('ROLLBACK')
                throw error
            }
        },
    }
    const kv = new Map()
    const namespace = {
        async get(key) { return kv.get(key)?.value ?? null },
        async getWithMetadata(key) { return kv.get(key) ?? { value: null, metadata: null } },
        async put(key, value, options = {}) { kv.set(key, { value, metadata: options.metadata || {} }) },
        async delete(key) { kv.delete(key) },
        async list() { return { keys: [], list_complete: true } },
    }
    const env = { SCN_STORAGE_DRIVER: 'd1', SCN_SECRET: 'integration-secret', SCN_SALT: 'integration-salt', SCN_ENABLE_TURNSTILE: '0', NOTES_DB: db, NOTE_HISTORY_DB: db, APP_DB: db, NOTES: namespace, SHARE: namespace }
    sqlite.exec("INSERT INTO accounts VALUES ('alice','handle','Alice',1,1); INSERT INTO account_sessions VALUES ('session123456789012345','alice',1,4102444800,NULL)")
    const request = (path, { method = 'GET', body, cookie = '', origin = 'https://wiki.example', site = 'same-origin' } = {}) => worker.fetch(new Request(`https://wiki.example${path}`, {
        method,
        headers: { ...(cookie && { Cookie: cookie }), ...(origin && { Origin: origin }), ...(site && { 'Sec-Fetch-Site': site }), ...(body !== undefined && { 'Content-Type': 'application/json' }) },
        ...(body !== undefined && { body: JSON.stringify(body) }),
    }), env, { waitUntil() {} })
    return { sqlite, env, request, cookie: 'cn_account_session=session123456789012345' }
}

test('account and circle namespaces take precedence over note routes', async () => {
    const h = harness()
    for (const method of ['GET', 'HEAD']) {
        const response = await h.request('/c/nonexistent', { method })
        assert.equal(response.status, 404)
        assert.match(response.headers.get('cache-control'), /no-store/)
    }
    const space = await h.request('/_space')
    assert.equal(space.status, 200)
    assert.match(space.headers.get('content-security-policy'), /script-src/)
    const me = await h.request('/api/account/me')
    assert.equal(me.status, 200)
    assert.equal((await me.json()).authenticated, false)
    const crossSite = await h.request('/api/auth/passkey/login/options', { method: 'POST', body: {}, origin: 'https://evil.example', site: 'cross-site' })
    assert.equal(crossSite.status, 403)
})

test('signed and anonymous annotation HTTP routes enforce session, CSRF, attribution and ownership', async () => {
    const h = harness()
    const path = 'private-note'
    const token = 'abcdefghijklmnopqrstuv'
    const uid = 'uid-123'
    const content = 'selected paragraph'
    const meta = { noteUid: uid, metaVersion: 1, share: true, shareSlug: token, annotationsEnabled: true }
    h.sqlite.prepare('INSERT INTO notes(path,content,metadata,updated_at) VALUES(?,?,?,unixepoch())').run(path, content, JSON.stringify(meta))
    h.sqlite.prepare('INSERT INTO share_token_registry(share_id,target_path,note_uid,is_csprng_v1,created_at) VALUES(?,?,?,1,unixepoch())').run(token, path, uid)
    h.sqlite.prepare('INSERT INTO shares(share_id,path,created_at) VALUES(?,?,unixepoch())').run(token, path)
    const endpoint = `/api/shares/${token}/annotations`
    const draft = { mode: 'signed', authorName: 'Spoofed', body: 'hello', anchor: { exact: content, prefix: '', suffix: '', startOffset: 0, endOffset: content.length, sourceRevision: await computeSourceRevision(content) } }
    assert.equal((await h.request(endpoint, { method: 'POST', body: draft })).status, 401)
    assert.equal((await h.request(endpoint, { method: 'POST', body: draft, cookie: h.cookie, site: 'cross-site' })).status, 403)
    const created = await h.request(endpoint, { method: 'POST', body: draft, cookie: h.cookie })
    assert.equal(created.status, 201, await created.clone().text())
    const thread = (await created.json()).data.thread
    assert.equal(thread.messages[0].authorName, 'Alice')
    assert.equal(thread.messages[0].deleteToken, undefined)
    const anonymous = await h.request(`${endpoint}/${thread.id}/messages`, { method: 'POST', body: { mode: 'anonymous', authorName: 'Guest', body: 'reply' }, cookie: h.cookie })
    assert.equal(anonymous.status, 201, await anonymous.clone().text())
    const guest = (await anonymous.json()).data.message
    assert.ok(guest.deleteToken)
    const viewed = await h.request(endpoint, { cookie: h.cookie })
    const listed = (await viewed.json()).data.threads[0].messages
    assert.equal(listed.find(message => message.id === thread.messages[0].id).canDelete, true)
    assert.equal(listed.find(message => message.id === guest.id).canDelete, false)
    assert.doesNotMatch(JSON.stringify(listed), /accountId|account_id/)
    const deleted = await h.request(`${endpoint}/${thread.id}/messages/${thread.messages[0].id}`, { method: 'DELETE', cookie: h.cookie, body: {} })
    assert.equal(deleted.status, 200, await deleted.clone().text())
    assert.equal(h.sqlite.prepare('SELECT COUNT(*) AS n FROM account_annotation_links').get().n, 0)
})

test('publishing settings and pre-shared creation index committed notes in Space', async () => {
    const h = harness()
    h.sqlite.prepare('INSERT INTO notes(path,content,metadata,updated_at) VALUES(?,?,?,unixepoch())').run('draft', '# Draft', JSON.stringify({ noteUid: 'draft-uid', metaVersion: 1, share: false }))
    for (const autosave of [false, true]) {
        const response = await h.request('/draft/setting', { method: 'POST', cookie: h.cookie, body: { share: true, autosave } })
        assert.equal((await response.json()).err, 0)
    }
    const saved = h.sqlite.prepare("SELECT access_level, facets FROM account_space_items WHERE note_path = 'draft'").get()
    assert.equal(saved.access_level, 'edit')
    assert.ok(JSON.parse(saved.facets).includes('created'))
    const response = await h.request('/api/new-note', { method: 'POST', cookie: h.cookie, body: { content: '# Shared', share: true } })
    const result = await response.json()
    assert.equal(result.err, 0)
    const entry = h.sqlite.prepare('SELECT facets FROM account_space_items WHERE note_path = ?').get(result.data.path)
    assert.ok(JSON.parse(entry.facets).includes('created'))
})
