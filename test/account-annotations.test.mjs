import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { JSDOM } from 'jsdom'

import {
    addAnnotationMessage,
    computeSourceRevision,
    createAnnotationDeleteToken,
    createAnnotationThread,
    deleteAccountAnnotationMessageByAccount,
    deleteAnnotationMessage,
    deleteAnnotationThread,
    listAnnotationThreads,
    validateAnnotationDraft,
    validateAnnotationMessage,
} from '../src/annotation_data.mjs'
import { initShareAnnotations } from '../static/js/share-annotations.mjs'

function createSqliteDb({ includeAccounts = true } = {}) {
    const sqlite = new DatabaseSync(':memory:')
    sqlite.exec(readFileSync(new URL('../schema/note_annotations.sql', import.meta.url), 'utf8'))
    if (includeAccounts) {
        sqlite.exec(readFileSync(new URL('../schema/accounts.sql', import.meta.url), 'utf8'))
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
                    if (/^\s*SELECT\b/i.test(stmt._sql)) {
                        const results = sqlite.prepare(stmt._sql).all(...stmt._args)
                        out.push({ success: true, meta: { changes: 0 }, results })
                    } else {
                        const info = sqlite.prepare(stmt._sql).run(...stmt._args)
                        out.push({ success: true, meta: { changes: Number(info?.changes ?? 0) }, results: [] })
                    }
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

function makeAnchor(revision) {
    return {
        exact: 'selected paragraph',
        prefix: 'before ',
        suffix: ' after',
        startOffset: 7,
        endOffset: 25,
        sourceRevision: revision,
    }
}

function makeIds(...ids) {
    const queue = [...ids]
    return () => {
        if (queue.length === 0) throw new Error('Out of deterministic IDs')
        return queue.shift()
    }
}

test('createAnnotationThread & addAnnotationMessage atomically persist signed attribution, meta, and share_id without deleteToken', async () => {
    const db = createSqliteDb()
    const rev = await computeSourceRevision('before selected paragraph after')
    const draft = validateAnnotationDraft({
        anchor: makeAnchor(rev),
        body: '  Signed root comment  ',
    }, {
        signedAccount: { accountId: 'acc-1', nickname: 'AliceSigned' },
    })
    assert.ok(draft, 'validateAnnotationDraft should allow omitted authorName when signedAccount is provided')

    // Pass a spoofed draft.authorName to verify createAnnotationThread ignores client authorName
    const thread = await createAnnotationThread(db, 'note-1', {
        ...draft,
        authorName: 'SpoofedClientName',
    }, {
        nowSeconds: 1000,
        createId: makeIds('thr-1', 'msg-1'),
        secret: 'top-secret-hmac',
        noteUid: 'uid-1',
        shareId: 'shareToken123456789012',
        signedAccount: { accountId: 'acc-1', nickname: 'AliceSigned' },
    })

    assert.equal(thread.id, 'thr-1')
    assert.equal(thread.messages.length, 1)
    assert.deepEqual(thread.messages[0], {
        id: 'msg-1',
        authorName: 'AliceSigned',
        body: 'Signed root comment',
        createdAt: 1000,
        isSignedAccount: true,
        canDelete: true,
    })
    assert.equal('deleteToken' in thread.messages[0], false)

    const metaRow = db.sqlite.prepare('SELECT * FROM annotation_thread_meta WHERE thread_id = ?').get('thr-1')
    assert.equal(metaRow.root_message_id, 'msg-1')
    assert.equal(metaRow.note_uid, 'uid-1')
    assert.equal(metaRow.path, 'note-1')

    const linkRow = db.sqlite.prepare('SELECT * FROM account_annotation_links WHERE message_id = ?').get('msg-1')
    assert.equal(linkRow.thread_id, 'thr-1')
    assert.equal(linkRow.account_id, 'acc-1')
    assert.equal(linkRow.note_path, 'note-1')
    assert.equal(linkRow.note_uid, 'uid-1')
    assert.equal(linkRow.share_id, 'shareToken123456789012')

    // Signed reply ignores client authorName and writes link atomically
    const replyInput = validateAnnotationMessage({ body: '  Signed reply  ' }, {
        signedAccount: { accountId: 'acc-2', nickname: 'BobSigned' },
    })
    assert.ok(replyInput)
    const reply = await addAnnotationMessage(db, 'note-1', 'thr-1', {
        ...replyInput,
        authorName: 'SpoofedBob',
    }, {
        nowSeconds: 1000, // same-second reply
        createId: makeIds('msg-2'),
        secret: 'top-secret-hmac',
        noteUid: 'uid-1',
        shareId: 'shareToken123456789012',
        signedAccount: { accountId: 'acc-2', nickname: 'BobSigned' },
    })
    assert.deepEqual(reply, {
        id: 'msg-2',
        authorName: 'BobSigned',
        body: 'Signed reply',
        createdAt: 1000,
        isSignedAccount: true,
        canDelete: true,
    })
    assert.equal('deleteToken' in reply, false)

    const linkRow2 = db.sqlite.prepare('SELECT * FROM account_annotation_links WHERE message_id = ?').get('msg-2')
    assert.equal(linkRow2.account_id, 'acc-2')
    assert.equal(linkRow2.share_id, 'shareToken123456789012')

    // Resolved thread prevents message insertion AND inserts zero account_annotation_links rows
    db.sqlite.prepare('UPDATE annotation_threads SET is_resolved = 1 WHERE id = ?').run('thr-1')
    const blocked = await addAnnotationMessage(db, 'note-1', 'thr-1', { body: 'Should not insert' }, {
        nowSeconds: 1005,
        createId: makeIds('msg-blocked'),
        noteUid: 'uid-1',
        shareId: 'shareToken123456789012',
        signedAccount: { accountId: 'acc-2', nickname: 'BobSigned' },
    })
    assert.equal(blocked, null)
    assert.equal(db.sqlite.prepare('SELECT * FROM annotation_messages WHERE id = ?').get('msg-blocked'), undefined)
    assert.equal(db.sqlite.prepare('SELECT * FROM account_annotation_links WHERE message_id = ?').get('msg-blocked'), undefined)
})

test('soft-deleted threads cannot be reopened by late replies', async () => {
    const db = createSqliteDb()
    const rev = await computeSourceRevision('before selected paragraph after')
    await createAnnotationThread(db, 'note-1', {
        anchor: makeAnchor(rev),
        authorName: 'Anon',
        body: 'Root message',
    }, {
        nowSeconds: 1000,
        createId: makeIds('thr-del', 'msg-del-1'),
        secret: 'secret-1',
        noteUid: 'uid-del',
        requireNoteUid: true,
    })

    const delRes = await deleteAnnotationMessage(db, 'note-1', 'thr-del', 'msg-del-1', {
        nowSeconds: 1010,
        noteUid: 'uid-del',
        requireNoteUid: true,
        isAuthor: true,
    })
    assert.equal(delRes.threadDeleted, true)

    // Even though annotation_threads.is_resolved is still 0, zero active messages exist -> reject reply
    const lateAnonReply = await addAnnotationMessage(db, 'note-1', 'thr-del', {
        authorName: 'LateAnon',
        body: 'Reopen attempt',
    }, {
        nowSeconds: 1020,
        createId: makeIds('msg-late-1'),
        noteUid: 'uid-del',
        requireNoteUid: true,
    })
    assert.equal(lateAnonReply, null)

    const lateSignedReply = await addAnnotationMessage(db, 'note-1', 'thr-del', {
        body: 'Signed reopen attempt',
    }, {
        nowSeconds: 1020,
        createId: makeIds('msg-late-2'),
        noteUid: 'uid-del',
        requireNoteUid: true,
        signedAccount: { accountId: 'acc-1', nickname: 'Alice' },
    })
    assert.equal(lateSignedReply, null)
    assert.equal(db.sqlite.prepare('SELECT * FROM account_annotation_links WHERE message_id = ?').get('msg-late-2'), undefined)
})

test('cross-device single-message self-deletion keeps same-second replies intact and works from /_space after share rotation', async () => {
    const db = createSqliteDb()
    const rev = await computeSourceRevision('before selected paragraph after')
    await createAnnotationThread(db, 'note-1', {
        anchor: makeAnchor(rev),
        body: 'Alice root',
    }, {
        nowSeconds: 2000,
        createId: makeIds('thr-1', 'msg-alice'),
        noteUid: 'uid-1',
        shareId: 'shareOld12345678901234',
        signedAccount: { accountId: 'acc-alice', nickname: 'Alice' },
    })

    await addAnnotationMessage(db, 'note-1', 'thr-1', {
        body: 'Bob same-second reply',
    }, {
        nowSeconds: 2000, // exact same second
        createId: makeIds('msg-bob'),
        noteUid: 'uid-1',
        shareId: 'shareOld12345678901234',
        signedAccount: { accountId: 'acc-bob', nickname: 'Bob' },
    })

    // Bob cannot delete Alice's message
    const bobTriesAlice = await deleteAnnotationMessage(db, 'note-1', 'thr-1', 'msg-alice', {
        nowSeconds: 2005,
        noteUid: 'uid-1',
        requireNoteUid: true,
        signedAccountId: 'acc-bob',
    })
    assert.equal(bobTriesAlice, null)

    // Wrong noteUid fails closed
    const wrongUid = await deleteAnnotationMessage(db, 'note-1', 'thr-1', 'msg-alice', {
        nowSeconds: 2005,
        noteUid: 'uid-other',
        requireNoteUid: true,
        signedAccountId: 'acc-alice',
    })
    assert.equal(wrongUid, null)

    // Alice deletes ONLY her own root message across devices without deleteToken
    const aliceDel = await deleteAnnotationMessage(db, 'note-1', 'thr-1', 'msg-alice', {
        nowSeconds: 2005,
        noteUid: 'uid-1',
        requireNoteUid: true,
        signedAccountId: 'acc-alice',
    })
    assert.deepEqual(aliceDel, {
        deleted: true,
        messageId: 'msg-alice',
        threadId: 'thr-1',
        activeMessageCount: 1,
        threadDeleted: false,
    })
    assert.equal(db.sqlite.prepare('SELECT * FROM account_annotation_links WHERE message_id = ?').get('msg-alice'), undefined)

    // Bob's same-second reply remains active and linked
    const listed = await listAnnotationThreads(db, 'note-1', {
        noteUid: 'uid-1',
        requireNoteUid: true,
        viewerAccountId: 'acc-bob',
    })
    assert.equal(listed.threads.length, 1)
    assert.equal(listed.threads[0].messages.length, 1)
    assert.equal(listed.threads[0].messages[0].id, 'msg-bob')
    assert.equal(listed.threads[0].messages[0].canDelete, true)

    // After share rotation/lock, /_space account-scoped delete fails 404 for wrong user
    const unownedSpaceDel = await deleteAccountAnnotationMessageByAccount(db, 'acc-alice', 'msg-bob', { nowSeconds: 2010 })
    assert.deepEqual(unownedSpaceDel, { deleted: false })

    // Owner deletes from /_space via deleteAccountAnnotationMessageByAccount
    const bobSpaceDel = await deleteAccountAnnotationMessageByAccount(db, 'acc-bob', 'msg-bob', { nowSeconds: 2010 })
    assert.deepEqual(bobSpaceDel, { deleted: true, messageId: 'msg-bob' })
    assert.equal(db.sqlite.prepare('SELECT * FROM account_annotation_links WHERE message_id = ?').get('msg-bob'), undefined)

    // Repeating returns { deleted: false } (404)
    const repeatDel = await deleteAccountAnnotationMessageByAccount(db, 'acc-bob', 'msg-bob', { nowSeconds: 2011 })
    assert.deepEqual(repeatDel, { deleted: false })
})

test('deleteAnnotationThread verifies root_message_id, note_uid, non-signed root, and preserves pure-KV legacy fallback', async () => {
    const db = createSqliteDb()
    const rev = await computeSourceRevision('before selected paragraph after')
    const secret = 'thread-delete-secret'

    // 1. Anonymous thread with UID metadata + anonymous reply
    const anonThread = await createAnnotationThread(db, 'note-1', {
        anchor: makeAnchor(rev),
        authorName: 'AnonRoot',
        body: 'Root',
    }, {
        nowSeconds: 3000,
        createId: makeIds('thr-anon', 'msg-root'),
        secret,
        noteUid: 'uid-1',
        requireNoteUid: true,
    })
    const rootToken = anonThread.messages[0].deleteToken
    const anonReply = await addAnnotationMessage(db, 'note-1', 'thr-anon', {
        authorName: 'AnonReply',
        body: 'Reply',
    }, {
        nowSeconds: 3001,
        createId: makeIds('msg-reply'),
        secret,
        noteUid: 'uid-1',
        requireNoteUid: true,
    })

    // Reply token CANNOT delete the whole thread
    const replyAttempt = await deleteAnnotationThread(db, 'note-1', 'thr-anon', {
        nowSeconds: 3002,
        isAuthor: false,
        rootMessageId: 'msg-reply',
        deleteToken: anonReply.deleteToken,
        secret,
        noteUid: 'uid-1',
        requireNoteUid: true,
    })
    assert.equal(replyAttempt, null)

    // Even if msg-root is individually soft-deleted, msg-reply STILL cannot claim root!
    await deleteAnnotationMessage(db, 'note-1', 'thr-anon', 'msg-root', {
        nowSeconds: 3002,
        noteUid: 'uid-1',
        requireNoteUid: true,
    })
    const hijackAttempt = await deleteAnnotationThread(db, 'note-1', 'thr-anon', {
        nowSeconds: 3003,
        isAuthor: false,
        rootMessageId: 'msg-reply',
        deleteToken: anonReply.deleteToken,
        secret,
        noteUid: 'uid-1',
        requireNoteUid: true,
    })
    assert.equal(hijackAttempt, null)

    // Wrong noteUid fails closed
    const wrongUidThreadDel = await deleteAnnotationThread(db, 'note-1', 'thr-anon', {
        nowSeconds: 3003,
        isAuthor: false,
        rootMessageId: 'msg-root',
        deleteToken: rootToken,
        secret,
        noteUid: 'uid-wrong',
        requireNoteUid: true,
    })
    assert.equal(wrongUidThreadDel, null)

    // Valid root token + matching noteUid succeeds
    const validAnonDel = await deleteAnnotationThread(db, 'note-1', 'thr-anon', {
        nowSeconds: 3004,
        isAuthor: false,
        rootMessageId: 'msg-root',
        deleteToken: rootToken,
        secret,
        noteUid: 'uid-1',
        requireNoteUid: true,
    })
    assert.deepEqual(validAnonDel, { deleted: true, threadId: 'thr-anon', threadDeleted: true })

    // 2. Signed-root thread cannot be deleted via anonymous thread-delete route
    await createAnnotationThread(db, 'note-1', {
        anchor: makeAnchor(rev),
        body: 'Signed root',
    }, {
        nowSeconds: 3010,
        createId: makeIds('thr-signed', 'msg-signed-root'),
        noteUid: 'uid-1',
        shareId: 'share123',
        signedAccount: { accountId: 'acc-1', nickname: 'Alice' },
    })
    const forgedTokenForSigned = await createAnnotationDeleteToken('msg-signed-root', secret)
    const signedViaAnon = await deleteAnnotationThread(db, 'note-1', 'thr-signed', {
        nowSeconds: 3011,
        isAuthor: false,
        rootMessageId: 'msg-signed-root',
        deleteToken: forgedTokenForSigned,
        secret,
        noteUid: 'uid-1',
        requireNoteUid: true,
    })
    assert.equal(signedViaAnon, null)

    // Note author bypasses root-token checks and cleans up account_annotation_links
    const authorDel = await deleteAnnotationThread(db, 'note-1', 'thr-signed', {
        nowSeconds: 3012,
        isAuthor: true,
        noteUid: 'uid-1',
        requireNoteUid: true,
    })
    assert.deepEqual(authorDel, { deleted: true, threadId: 'thr-signed', threadDeleted: true })
    assert.equal(db.sqlite.prepare('SELECT * FROM account_annotation_links WHERE message_id = ?').get('msg-signed-root'), undefined)

    // 3. Pre-sidecar thread (no annotation_thread_meta row):
    //    - fails closed when requireNoteUid is true
    //    - preserves earliest-message root fallback when !requireNoteUid (pure-KV mode)
    db.sqlite.prepare(`
        INSERT INTO annotation_threads (id, path, quote_exact, start_offset, end_offset, source_revision, created_at, updated_at)
        VALUES ('thr-kv', 'note-kv', 'selected paragraph', 7, 25, ?, 4000, 4001)
    `).run(rev)
    db.sqlite.prepare(`
        INSERT INTO annotation_messages (id, thread_id, author_name, body, created_at)
        VALUES ('msg-kv-1', 'thr-kv', 'KV1', 'First', 4000), ('msg-kv-2', 'thr-kv', 'KV2', 'Second', 4001)
    `).run()

    const kvToken1 = await createAnnotationDeleteToken('msg-kv-1', secret)
    const kvToken2 = await createAnnotationDeleteToken('msg-kv-2', secret)

    // Registry mode fails closed on untagged thread
    assert.equal(await deleteAnnotationThread(db, 'note-kv', 'thr-kv', {
        nowSeconds: 4010,
        isAuthor: false,
        rootMessageId: 'msg-kv-1',
        deleteToken: kvToken1,
        secret,
        noteUid: 'uid-new',
        requireNoteUid: true,
    }), null)

    // Pure-KV rejects non-earliest message
    assert.equal(await deleteAnnotationThread(db, 'note-kv', 'thr-kv', {
        nowSeconds: 4010,
        isAuthor: false,
        rootMessageId: 'msg-kv-2',
        deleteToken: kvToken2,
        secret,
        requireNoteUid: false,
    }), null)

    // Pure-KV accepts earliest message
    assert.deepEqual(await deleteAnnotationThread(db, 'note-kv', 'thr-kv', {
        nowSeconds: 4011,
        isAuthor: false,
        rootMessageId: 'msg-kv-1',
        deleteToken: kvToken1,
        secret,
        requireNoteUid: false,
    }), { deleted: true, threadId: 'thr-kv', threadDeleted: true })
})

test('slug-reuse isolation hides old UID & untagged threads in registry mode and excludes UID-tagged threads in pure-KV mode', async () => {
    const db = createSqliteDb()
    const rev = await computeSourceRevision('before selected paragraph after')

    // Generation 1 (uid-old)
    await createAnnotationThread(db, 'slug-a', {
        anchor: makeAnchor(rev),
        body: 'Old gen comment',
    }, {
        nowSeconds: 5000,
        createId: makeIds('thr-old', 'msg-old'),
        noteUid: 'uid-old',
        shareId: 'shareOld',
        signedAccount: { accountId: 'acc-1', nickname: 'Alice' },
    })

    // Generation 2 (uid-new) on same slug
    await createAnnotationThread(db, 'slug-a', {
        anchor: makeAnchor(rev),
        authorName: 'NewVisitor',
        body: 'New gen comment',
    }, {
        nowSeconds: 5001,
        createId: makeIds('thr-new', 'msg-new'),
        noteUid: 'uid-new',
        requireNoteUid: true,
    })

    // Untagged pure-KV thread on same slug
    await createAnnotationThread(db, 'slug-a', {
        anchor: makeAnchor(rev),
        authorName: 'KvVisitor',
        body: 'Pure KV comment',
    }, {
        nowSeconds: 5002,
        createId: makeIds('thr-purekv', 'msg-purekv'),
        noteUid: null,
    })

    // Registry mode for uid-new sees ONLY thr-new
    const newGenList = await listAnnotationThreads(db, 'slug-a', {
        noteUid: 'uid-new',
        requireNoteUid: true,
    })
    assert.deepEqual(newGenList.threads.map(t => t.id), ['thr-new'])

    // Pure-KV mode (excludeUidTagged: true) sees ONLY thr-purekv
    const kvList = await listAnnotationThreads(db, 'slug-a', {
        excludeUidTagged: true,
    })
    assert.deepEqual(kvList.threads.map(t => t.id), ['thr-purekv'])
})

test('listAnnotationThreads strips account_id, projects isSignedAccount + canDelete, and handles missing account_annotation_links gracefully only when viewerAccountId is absent', async () => {
    const dbWithAccounts = createSqliteDb({ includeAccounts: true })
    const rev = await computeSourceRevision('before selected paragraph after')

    await createAnnotationThread(dbWithAccounts, 'note-x', {
        anchor: makeAnchor(rev),
        body: 'Signed comment',
    }, {
        nowSeconds: 6000,
        createId: makeIds('thr-s', 'msg-s'),
        noteUid: 'uid-x',
        shareId: 'shareX',
        signedAccount: { accountId: 'acc-owner', nickname: 'Owner' },
    })
    await addAnnotationMessage(dbWithAccounts, 'note-x', 'thr-s', {
        authorName: 'AnonGuest',
        body: 'Anon comment',
    }, {
        nowSeconds: 6001,
        createId: makeIds('msg-a'),
        noteUid: 'uid-x',
        requireNoteUid: true,
    })

    // Other signed viewer: sees isSignedAccount: true, canDelete: false, NO account_id
    const otherViewer = await listAnnotationThreads(dbWithAccounts, 'note-x', {
        noteUid: 'uid-x',
        requireNoteUid: true,
        viewerAccountId: 'acc-other',
    })
    const [m1, m2] = otherViewer.threads[0].messages
    assert.equal('account_id' in m1, false)
    assert.equal('accountId' in m1, false)
    assert.equal(m1.isSignedAccount, true)
    assert.equal(m1.canDelete, false)
    assert.equal(m2.isSignedAccount, false)
    assert.equal(m2.canDelete, false)

    // Same signed viewer: canDelete: true on own message
    const selfViewer = await listAnnotationThreads(dbWithAccounts, 'note-x', {
        noteUid: 'uid-x',
        requireNoteUid: true,
        viewerAccountId: 'acc-owner',
    })
    assert.equal(selfViewer.threads[0].messages[0].canDelete, true)
    assert.equal(selfViewer.threads[0].messages[1].canDelete, false)

    // Note author: canDelete: true on all messages
    const authorViewer = await listAnnotationThreads(dbWithAccounts, 'note-x', {
        noteUid: 'uid-x',
        requireNoteUid: true,
        isAuthor: true,
    })
    assert.equal(authorViewer.threads[0].messages[0].canDelete, true)
    assert.equal(authorViewer.threads[0].messages[1].canDelete, true)

    // Partial DB without account_annotation_links
    const partialDb = createSqliteDb({ includeAccounts: false })
    await createAnnotationThread(partialDb, 'note-p', {
        anchor: makeAnchor(rev),
        authorName: 'AnonP',
        body: 'Partial DB comment',
    }, {
        nowSeconds: 6100,
        createId: makeIds('thr-p', 'msg-p'),
        noteUid: 'uid-p',
        requireNoteUid: true,
    })
    const partialRes = await listAnnotationThreads(partialDb, 'note-p', {
        noteUid: 'uid-p',
        requireNoteUid: true,
    })
    assert.equal(partialRes.threads[0].messages[0].isSignedAccount, false)
    assert.equal(partialRes.threads[0].messages[0].canDelete, false)

    await assert.rejects(
        () => listAnnotationThreads(partialDb, 'note-p', {
            noteUid: 'uid-p',
            requireNoteUid: true,
            viewerAccountId: 'acc-1',
        }),
        /account_annotation_links/,
    )
})

test('frontend share-annotations.mjs: signed vs anonymous toggle, clearing nickname on anonymous switch, 401 draft preservation, and canDelete rendering', async () => {
    const revision = 'e'.repeat(64)
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <html>
        <body>
            <div id="preview-md" class="contents markdown-body">
                <p id="p1">Alpha selected paragraph for testing annotations.</p>
            </div>
            <div id="share-annotation-root" data-share-id="share-fe-1" data-lang="en-US"></div>
        </body>
        </html>
    `, { url: 'https://wiki.david888.com/share/share-fe-1' })

    const originalDocument = globalThis.document
    const originalWindow = globalThis.window
    const originalFetch = globalThis.fetch
    const originalMutationObserver = globalThis.MutationObserver
    const originalConfirm = dom.window.confirm

    try {
        globalThis.document = dom.window.document
        globalThis.window = dom.window
        globalThis.window.APP_STATE = { shareId: 'share-fe-1', lang: 'en-US' }
        dom.window.confirm = () => true

        const postedBodies = []
        const deleteCalls = []
        let failNextCreateWith401 = false
        let reauthCalled = 0
        let sessionActive = true

        const initialThreads = [
            {
                id: 'thr-existing',
                anchor: {
                    exact: 'Alpha',
                    prefix: '',
                    suffix: ' selected',
                    startOffset: 0,
                    endOffset: 5,
                    sourceRevision: revision,
                },
                isResolved: false,
                createdAt: 1000,
                updatedAt: 1000,
                messageCount: 2,
                hasMoreMessages: false,
                messages: [
                    {
                        id: 'msg-own-signed',
                        authorName: 'AlicePasskey',
                        body: 'Cross-device own comment',
                        createdAt: 1000,
                        isSignedAccount: true,
                        canDelete: true,
                    },
                    {
                        id: 'msg-other-signed',
                        authorName: 'BobPasskey',
                        body: 'Other user comment',
                        createdAt: 1001,
                        isSignedAccount: true,
                        canDelete: false,
                    },
                ],
            },
        ]

        globalThis.fetch = async (url, options = {}) => {
            const u = String(url)
            if (u === '/api/account/me') {
                if (!sessionActive) {
                    return { ok: true, status: 200, json: async () => ({ authenticated: false, account: null }) }
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        authenticated: true,
                        account: { id: 'acc-alice', nickname: 'AlicePasskey' },
                    }),
                }
            }
            if (u.includes('/annotations') && (!options.method || options.method === 'GET')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        err: 0,
                        data: {
                            enabled: true,
                            sourceRevision: revision,
                            threads: initialThreads,
                        },
                    }),
                }
            }
            if (options.method === 'POST' && u.endsWith('/annotations')) {
                const payload = JSON.parse(options.body)
                postedBodies.push({ endpoint: 'create', payload })
                if (failNextCreateWith401) {
                    failNextCreateWith401 = false
                    return {
                        ok: false,
                        status: 401,
                        json: async () => ({ err: 401, msg: 'Session expired' }),
                    }
                }
                return {
                    ok: true,
                    status: 201,
                    json: async () => ({
                        err: 0,
                        data: {
                            thread: {
                                id: `thr-created-${postedBodies.length}`,
                                anchor: payload.anchor,
                                messageCount: 1,
                                messages: [{
                                    id: `msg-created-${postedBodies.length}`,
                                    authorName: payload.mode === 'signed' ? 'AlicePasskey' : payload.authorName,
                                    body: payload.body,
                                    createdAt: 2000,
                                    isSignedAccount: payload.mode === 'signed',
                                    canDelete: payload.mode === 'signed',
                                }],
                            },
                        },
                    }),
                }
            }
            if (options.method === 'DELETE') {
                deleteCalls.push({ url: u, headers: options.headers, body: options.body })
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ err: 0, data: { deleted: true } }),
                }
            }
            return { ok: false, status: 404, json: async () => ({}) }
        }
        globalThis.MutationObserver = class {
            observe() {}
            disconnect() {}
        }

        initShareAnnotations({
            loginWithPasskey: async () => {
                reauthCalled += 1
                sessionActive = true
            },
        })

        await new Promise(r => setTimeout(r, 60))

        const appRoot = dom.window.document.querySelector('#share-annotation-root')
        const composer = appRoot.querySelector('.annotation-composer')
        const composerSignedRadio = composer.querySelector('input[type="radio"][value="signed"]')
        const composerAnonRadio = composer.querySelector('input[type="radio"][value="anonymous"]')
        const authorInput = composer.querySelector('input[name="authorName"]')
        const bodyInput = composer.querySelector('textarea[name="body"]')

        // 1. Composer shows signed vs anonymous toggle and locks nickname in signed mode
        assert.equal(composer.querySelector('.annotation-identity-mode').hidden, false)
        assert.equal(composerSignedRadio.checked, true)
        assert.equal(authorInput.value, 'AlicePasskey')
        assert.equal(authorInput.readOnly, true)

        // Reply form also has toggle & clears nickname on anonymous switch
        const replyForm = appRoot.querySelector('.annotation-reply-form')
        const replySignedRadio = replyForm.querySelector('input[type="radio"][value="signed"]')
        const replyAnonRadio = replyForm.querySelector('input[type="radio"][value="anonymous"]')
        const replyAuthor = replyForm.querySelector('input[name="authorName"]')
        assert.equal(replySignedRadio.checked, true)
        assert.equal(replyAuthor.value, 'AlicePasskey')

        replyAnonRadio.checked = true
        replyAnonRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
        assert.equal(replyAuthor.value, '', 'Switching reply form to anonymous must clear account nickname')
        assert.equal(replyAuthor.readOnly, false)

        // 2. Delete button renders via message.canDelete without local deleteToken
        const ownMsgEl = appRoot.querySelector('[data-message-id="msg-own-signed"]')
        const otherMsgEl = appRoot.querySelector('[data-message-id="msg-other-signed"]')
        const ownDeleteBtn = ownMsgEl.querySelector('.annotation-delete-message-btn')
        assert.ok(ownDeleteBtn, 'Own signed message with canDelete=true must render delete button cross-device')
        assert.equal(otherMsgEl.querySelector('.annotation-delete-message-btn'), null, 'Other user signed message must not render delete button')

        ownDeleteBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, 40))
        assert.equal(deleteCalls.length, 1)
        assert.match(deleteCalls[0].url, /\/msg-own-signed$/)
        assert.equal(deleteCalls[0].headers['X-Annotation-Delete-Token'], undefined)
        assert.equal(appRoot.querySelector('[data-message-id="msg-own-signed"]'), null)

        // 3. Select text and trigger 401 expired session while in signed mode -> preserves draft & anchor, prompts recovery
        const p1 = dom.window.document.querySelector('#p1').firstChild
        const range = dom.window.document.createRange()
        range.setStart(p1, 6)
        range.setEnd(p1, 14) // "selected"
        range.getBoundingClientRect = () => ({ left: 100, top: 100, width: 80, height: 20 })
        const selection = dom.window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        dom.window.document.dispatchEvent(new dom.window.Event('selectionchange'))
        await new Promise(r => setTimeout(r, 100))

        appRoot.querySelector('.annotation-selection-button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        assert.equal(composer.hidden, false)

        failNextCreateWith401 = true
        sessionActive = false
        bodyInput.value = 'My valuable unsaved draft'
        composer.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
        await new Promise(r => setTimeout(r, 50))

        // Must NOT silently downgrade to anonymous, must preserve draft and composer open
        assert.equal(postedBodies.length, 1)
        assert.equal(postedBodies[0].payload.mode, 'signed')
        assert.equal(postedBodies[0].payload.authorName, undefined)
        assert.equal(composer.hidden, false, 'Composer must stay open after 401')
        assert.equal(bodyInput.value, 'My valuable unsaved draft', 'Draft text must be preserved on 401')
        const recoveryPrompt = composer.querySelector('.annotation-session-expired-prompt')
        assert.equal(recoveryPrompt.hidden, false)
        const reauthBtn = recoveryPrompt.querySelector('.annotation-reauth-btn')
        const switchAnonBtn = recoveryPrompt.querySelector('.annotation-switch-anon-btn')
        assert.ok(reauthBtn && switchAnonBtn)

        // Click re-authenticate -> calls loginWithPasskey & refreshes session while keeping draft
        reauthBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        await new Promise(r => setTimeout(r, 50))
        assert.equal(reauthCalled, 1)
        assert.equal(bodyInput.value, 'My valuable unsaved draft')
        assert.equal(recoveryPrompt.hidden, true)

        // Submit now succeeds in signed mode without writing account nickname to localStorage
        composer.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
        await new Promise(r => setTimeout(r, 50))
        assert.equal(postedBodies.length, 2)
        assert.equal(postedBodies[1].payload.mode, 'signed')
        assert.equal(dom.window.localStorage.getItem('cf-notepad:annotation-author'), null)

        // 4. Switch composer to anonymous mode -> explicitly clears nickname & never auto-fills account nickname
        selection.removeAllRanges()
        selection.addRange(range)
        dom.window.document.dispatchEvent(new dom.window.Event('selectionchange'))
        await new Promise(r => setTimeout(r, 100))
        appRoot.querySelector('.annotation-selection-button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

        composerAnonRadio.checked = true
        composerAnonRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
        assert.equal(authorInput.value, '', 'Switching to anonymous must clear account nickname')
        assert.equal(authorInput.readOnly, false)

        // 5. Switch back to signed, hit 401, then click "Switch to anonymous" -> preserves draft, clears nickname, no auto-submit
        composerSignedRadio.checked = true
        composerSignedRadio.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
        assert.equal(authorInput.value, 'AlicePasskey')
        failNextCreateWith401 = true
        bodyInput.value = 'Draft preserved across anon switch'
        composer.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }))
        await new Promise(r => setTimeout(r, 50))
        assert.equal(recoveryPrompt.hidden, false)
        recoveryPrompt.querySelector('.annotation-switch-anon-btn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
        assert.equal(composerAnonRadio.checked, true)
        assert.equal(authorInput.value, '')
        assert.equal(bodyInput.value, 'Draft preserved across anon switch')
        assert.equal(postedBodies.length, 3, 'Must not auto-submit when switching to anonymous')
        selection.removeAllRanges()
    } finally {
        dom.window.confirm = originalConfirm
        globalThis.document = originalDocument
        globalThis.window = originalWindow
        globalThis.fetch = originalFetch
        globalThis.MutationObserver = originalMutationObserver
    }
})
