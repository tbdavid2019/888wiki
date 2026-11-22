import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const schemaSource = readFileSync(new URL('../schema/note_annotations.sql', import.meta.url), 'utf8')

test('annotation schema keeps source anchors independent from mutable note content', () => {
    assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS annotation_threads/)
    assert.match(schemaSource, /quote_exact TEXT NOT NULL/)
    assert.match(schemaSource, /quote_prefix TEXT NOT NULL/)
    assert.match(schemaSource, /quote_suffix TEXT NOT NULL/)
    assert.match(schemaSource, /source_revision TEXT NOT NULL/)
    assert.match(schemaSource, /CREATE TABLE IF NOT EXISTS annotation_messages/)
    assert.doesNotMatch(schemaSource, /REFERENCES\s+notes/i)
})

test('share annotation read API hides retained threads while the author setting is off', () => {
    assert.match(indexSource, /router\.get\('\/api\/shares\/:shareId\/annotations'/)
    assert.match(indexSource, /if \(!resolveAnnotationsEnabled\(metadata\)\)/)
    assert.match(indexSource, /enabled:\s*false,\s*sourceRevision:\s*null,\s*threads:\s*\[\]/s)
    assert.match(indexSource, /computeSourceRevision\(value\)/)
    assert.match(indexSource, /listAnnotationThreads/)
})

test('share annotation read API preserves view-password access control', () => {
    assert.match(indexSource, /if \(metadata\.vpw\) \{[\s\S]*Cookies\.parse\(request\.headers\.get\('Cookie'\)[\s\S]*checkAuth\(cookie, path[\s\S]*Share password required/)
    assert.match(indexSource, /'Cache-Control': 'no-store'/)
})
