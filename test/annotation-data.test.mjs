import test from 'node:test'
import assert from 'node:assert/strict'

import {
    addAnnotationMessage,
    computeSourceRevision,
    createAnnotationDeleteToken,
    createAnnotationThread,
    decodeAnnotationCursor,
    deleteAnnotationMessage,
    deleteAnnotationThread,
    encodeAnnotationCursor,
    listAnnotationThreads,
    validateAnnotationDraft,
    validateAnnotationMessage,
    verifyAnnotationDeleteToken,
} from '../src/annotation_data.mjs'

test('source revisions are stable SHA-256 fingerprints', async () => {
    const first = await computeSourceRevision('# Same article')
    const second = await computeSourceRevision('# Same article')
    const changed = await computeSourceRevision('# Changed article')

    assert.match(first, /^[a-f0-9]{64}$/)
    assert.equal(first, second)
    assert.notEqual(first, changed)
})

test('annotation cursors round-trip and reject malformed values', () => {
    const encoded = encodeAnnotationCursor({ updatedAt: 123456, id: 'thread-123' })

    assert.deepEqual(decodeAnnotationCursor(encoded), {
        updatedAt: 123456,
        id: 'thread-123',
    })
    assert.equal(decodeAnnotationCursor('not-valid!'), null)
})

test('annotation threads include immutable quote anchors and ordered messages', async () => {
    const calls = []
    let queryCount = 0
    const db = {
        prepare(sql) {
            const isIntrospection = /sqlite_master/i.test(sql)
            const call = { sql }
            if (!isIntrospection) calls.push(call)
            return {
                bind(...values) {
                    call.values = values
                    return {
                        async first() {
                            return null
                        },
                        async all() {
                            queryCount += 1
                            if (queryCount === 1) {
                                return {
                                    results: [{
                                        id: 'thread-1',
                                        quote_exact: 'selected paragraph',
                                        quote_prefix: 'before ',
                                        quote_suffix: ' after',
                                        start_offset: 7,
                                        end_offset: 25,
                                        source_revision: 'a'.repeat(64),
                                        is_resolved: 0,
                                        created_at: 100,
                                        updated_at: 110,
                                    }],
                                }
                            }
                            return {
                                results: [
                                    { id: 'message-1', thread_id: 'thread-1', author_name: 'Alice', body: 'First', created_at: 100, total_count: 2 },
                                    { id: 'message-2', thread_id: 'thread-1', author_name: 'Bob', body: 'Second', created_at: 110, total_count: 2 },
                                ],
                            }
                        },
                    }
                },
            }
        },
    }

    const result = await listAnnotationThreads(db, 'article-one', { limit: 20 })

    assert.equal(result.nextCursor, null)
    assert.deepEqual(result.threads, [{
        id: 'thread-1',
        anchor: {
            exact: 'selected paragraph',
            prefix: 'before ',
            suffix: ' after',
            startOffset: 7,
            endOffset: 25,
            sourceRevision: 'a'.repeat(64),
        },
        isResolved: false,
        createdAt: 100,
        updatedAt: 110,
        messageCount: 2,
        hasMoreMessages: false,
        messages: [
            { id: 'message-1', authorName: 'Alice', body: 'First', createdAt: 100, isSignedAccount: false, canDelete: false },
            { id: 'message-2', authorName: 'Bob', body: 'Second', createdAt: 110, isSignedAccount: false, canDelete: false },
        ],
    }])
    assert.match(calls[0].sql, /WHERE path = \?/)
    assert.deepEqual(calls[0].values, ['article-one', 21])
    assert.match(calls[1].sql, /thread_id IN \(\?\)/)
    assert.match(calls[1].sql, /ROW_NUMBER\(\) OVER/)
    assert.match(calls[1].sql, /message_rank <= 50/)
    assert.deepEqual(calls[1].values, ['thread-1'])
})

test('annotation drafts enforce bounded names, comments, and text anchors', () => {
    const valid = validateAnnotationDraft({
        anchor: {
            exact: 'selected paragraph',
            prefix: 'before ',
            suffix: ' after',
            startOffset: 7,
            endOffset: 25,
            sourceRevision: 'a'.repeat(64),
        },
        authorName: '  David  ',
        body: '  This needs a source.  ',
    })

    assert.deepEqual(valid, {
        anchor: {
            exact: 'selected paragraph',
            prefix: 'before ',
            suffix: ' after',
            startOffset: 7,
            endOffset: 25,
            sourceRevision: 'a'.repeat(64),
        },
        authorName: 'David',
        body: 'This needs a source.',
    })
    assert.equal(validateAnnotationDraft({
        ...valid,
        body: 'x'.repeat(2001),
    }), null)
    assert.equal(validateAnnotationDraft({
        ...valid,
        anchor: { ...valid.anchor, endOffset: 26 },
    }), null)
})

test('annotation replies trim valid text and reject oversized bodies', () => {
    assert.deepEqual(validateAnnotationMessage({
        authorName: '  Alice ',
        body: '  Agreed. ',
    }), {
        authorName: 'Alice',
        body: 'Agreed.',
    })
    assert.equal(validateAnnotationMessage({
        authorName: 'Alice',
        body: 'x'.repeat(2001),
    }), null)
})

test('createAnnotationThread stores its first message and thread meta in one D1 batch', async () => {
    const calls = []
    const db = {
        prepare(sql) {
            const isIntrospection = /sqlite_master/i.test(sql)
            const call = { sql }
            if (!isIntrospection) calls.push(call)
            return {
                bind(...values) {
                    call.values = values
                    if (isIntrospection) {
                        return {
                            async first() {
                                return values[0] === 'annotation_thread_meta' ? { name: 'annotation_thread_meta' } : null
                            },
                        }
                    }
                    return call
                },
            }
        },
        async batch(statements) {
            assert.equal(statements.length, 3)
            return statements.map(() => ({ success: true, meta: { changes: 1 } }))
        },
    }
    const draft = validateAnnotationDraft({
        anchor: {
            exact: 'selected paragraph',
            prefix: 'before ',
            suffix: ' after',
            startOffset: 7,
            endOffset: 25,
            sourceRevision: 'a'.repeat(64),
        },
        authorName: 'David',
        body: 'This needs a source.',
    })

    const thread = await createAnnotationThread(db, 'article-one', draft, {
        nowSeconds: 123456,
        createId: (() => {
            const ids = ['thread-1', 'message-1']
            return () => ids.shift()
        })(),
    })

    assert.equal(thread.id, 'thread-1')
    assert.equal(thread.messages[0].id, 'message-1')
    assert.equal(thread.messages[0].isSignedAccount, false)
    assert.equal(thread.messages[0].canDelete, false)
    assert.match(calls[0].sql, /INSERT INTO annotation_threads/)
    assert.deepEqual(calls[0].values, [
        'thread-1',
        'article-one',
        'selected paragraph',
        'before ',
        ' after',
        7,
        25,
        'a'.repeat(64),
        123456,
        123456,
    ])
    assert.match(calls[1].sql, /INSERT INTO annotation_messages/)
    assert.match(calls[2].sql, /INSERT OR IGNORE INTO annotation_thread_meta/)
    assert.deepEqual(calls[2].values, ['thread-1', 'article-one', 'message-1', null, 123456])
})

test('addAnnotationMessage only replies to a thread belonging to the same article', async () => {
    const calls = []
    const db = {
        prepare(sql) {
            const call = { sql }
            calls.push(call)
            return {
                bind(...values) {
                    call.values = values
                    return call
                },
            }
        },
        async batch(statements) {
            assert.equal(statements.length, 2)
            return [
                { success: true, meta: { changes: 1 } },
                { success: true, meta: { changes: 1 } },
            ]
        },
    }

    const message = await addAnnotationMessage(db, 'article-one', 'thread-1', {
        authorName: 'Alice',
        body: 'Agreed.',
    }, {
        nowSeconds: 123457,
        createId: () => 'message-2',
    })

    assert.deepEqual(message, {
        id: 'message-2',
        authorName: 'Alice',
        body: 'Agreed.',
        createdAt: 123457,
        isSignedAccount: false,
        canDelete: false,
    })
    assert.match(calls[0].sql, /SELECT \?, id, \?, \?, \?[\s\S]*WHERE id = \?[\s\S]*AND path = \?/)
    assert.deepEqual(calls[0].values, [
        'message-2',
        'Alice',
        'Agreed.',
        123457,
        'thread-1',
        'article-one',
    ])
    assert.match(calls[1].sql, /WHERE id = \?[\s\S]*AND path = \?[\s\S]*AND changes\(\) = 1/)
})

test('annotation delete tokens are verifiable HMAC signatures', async () => {
    const token = await createAnnotationDeleteToken('msg-123', 'test-secret')
    assert.match(token, /^[a-f0-9]{64}$/)
    assert.equal(await verifyAnnotationDeleteToken('msg-123', token, 'test-secret'), true)
    assert.equal(await verifyAnnotationDeleteToken('msg-123', 'wrong-token', 'test-secret'), false)
    assert.equal(await verifyAnnotationDeleteToken('msg-456', token, 'test-secret'), false)
    assert.equal(await verifyAnnotationDeleteToken('msg-123', token, 'different-secret'), false)
    assert.equal(await verifyAnnotationDeleteToken('', token, 'test-secret'), false)
    assert.equal(await verifyAnnotationDeleteToken('msg-123', '', 'test-secret'), false)
})

test('deleteAnnotationMessage soft-deletes a message and reports active message count', async () => {
    const calls = []
    const db = {
        prepare(sql) {
            const isIntrospection = /sqlite_master/i.test(sql)
            const call = { sql }
            if (!isIntrospection) calls.push(call)
            return {
                bind(...values) {
                    call.values = values
                    if (isIntrospection) {
                        return { async first() { return null } }
                    }
                    return call
                },
            }
        },
        async batch(statements) {
            assert.equal(statements.length, 2)
            return [
                { success: true, meta: { changes: 1 } },
                { success: true, meta: { changes: 0 }, results: [{ active_count: 0 }] },
            ]
        },
    }

    const result = await deleteAnnotationMessage(db, 'article-one', 'thread-1', 'message-1', {
        nowSeconds: 123499,
    })

    assert.deepEqual(result, {
        deleted: true,
        messageId: 'message-1',
        threadId: 'thread-1',
        activeMessageCount: 0,
        threadDeleted: true,
    })
    assert.match(calls[0].sql, /UPDATE annotation_messages[\s\S]*SET deleted_at = \?/)
    assert.deepEqual(calls[0].values, [123499, 'message-1', 'thread-1', 'thread-1', 'article-one'])
    assert.match(calls[1].sql, /SELECT COUNT\(\*\) AS active_count[\s\S]*WHERE thread_id = \?/)
    assert.deepEqual(calls[1].values, ['thread-1'])
})

test('deleteAnnotationThread soft-deletes all messages of a thread', async () => {
    const calls = []
    const db = {
        prepare(sql) {
            const isIntrospection = /sqlite_master/i.test(sql)
            const call = { sql }
            if (!isIntrospection) calls.push(call)
            return {
                bind(...values) {
                    call.values = values
                    if (isIntrospection) {
                        return { async first() { return null } }
                    }
                    return call
                },
            }
        },
        async batch(statements) {
            assert.equal(statements.length, 1)
            return [
                { success: true, meta: { changes: 3 } },
            ]
        },
    }

    const result = await deleteAnnotationThread(db, 'article-one', 'thread-1', {
        nowSeconds: 123500,
    })

    assert.deepEqual(result, {
        deleted: true,
        threadId: 'thread-1',
        threadDeleted: true,
    })
    assert.match(calls[0].sql, /UPDATE annotation_messages[\s\S]*SET deleted_at = \?[\s\S]*WHERE thread_id = \?/)
    assert.deepEqual(calls[0].values, [123500, 'thread-1', 'thread-1', 'article-one'])
})
