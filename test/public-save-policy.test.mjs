import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
    AUTOSAVE_IDLE_MS,
    canPersistNoteContent,
    getSaveBlockedMessage,
} from '../src/save_policy.mjs'

const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const commonTemplateSource = readFileSync(new URL('../src/templates/common.js', import.meta.url), 'utf8')
const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')

test('private notes cannot persist content while published notes can', () => {
    assert.equal(canPersistNoteContent({ share: false }), false)
    assert.equal(canPersistNoteContent({ share: true }), true)
    assert.equal(canPersistNoteContent({}), false)
})

test('autosave waits ten seconds and explains that publishing is required', () => {
    assert.equal(AUTOSAVE_IDLE_MS, 10000)
    assert.match(getSaveBlockedMessage('zh-TW'), /發布.*閱讀鎖/)
    assert.match(getSaveBlockedMessage('en-US'), /publish.*read lock/i)
})

test('editor exposes opt-in autosave and manual save controls', () => {
    assert.match(commonTemplateSource, /id="save-note-btn"/)
    assert.match(commonTemplateSource, /id="autosave-toggle"/)
    assert.match(commonTemplateSource, /app-dialog-modal/)
    assert.match(commonTemplateSource, /readLockTitle/)
    assert.match(baseTemplateSource, /AUTOSAVE_IDLE_MS/)
    assert.match(baseTemplateSource, /window\.showAppDialog/)
    assert.doesNotMatch(baseTemplateSource, /\$textarea\.oninput\s*=\s*throttle/)
    assert.match(baseTemplateSource, /beforeunload/)
})

test('editor resizer applies horizontal width to panes and vertical height to panes', () => {
    assert.match(baseTemplateSource, /const \$editorPane = document\.querySelector\('\.editor-pane'\)/)
    assert.match(baseTemplateSource, /\$editorPane\?\.style\.removeProperty\('flex'\)/)
    assert.match(baseTemplateSource, /firstPaneSize = isVertical \? \$editorPane\.getBoundingClientRect\(\)\.height : \$editorPane\.getBoundingClientRect\(\)\.width/)
    assert.match(baseTemplateSource, /\$editorPane\.style\.flex =/)
})

test('unpublished publish prompt waits for input inactivity and saves while publishing', () => {
    assert.match(baseTemplateSource, /schedulePublishNudge[\s\S]*setTimeout\([\s\S]*AUTOSAVE_IDLE_MS/)
    assert.match(baseTemplateSource, /\$textarea\.addEventListener\('input', \(\) => \{[\s\S]*schedulePublishNudge\(\)/)
    assert.doesNotMatch(baseTemplateSource, /setTimeout\([^\n]*180000/)
    assert.match(baseTemplateSource, /publishPreferencePublish/)
    assert.match(baseTemplateSource, /publishPreferenceAutosave/)
    assert.match(baseTemplateSource, /publishPreferencePublicIndex/)
    assert.match(baseTemplateSource, /body: JSON\.stringify\(\{[\s\S]*share: true,[\s\S]*autosave: preferences\.autosave,[\s\S]*publicIndex: preferences\.publicIndex/)
})

test('publishing remembers one unified set of choices and applies it atomically', () => {
    assert.match(baseTemplateSource, /PUBLISH_PREFERENCES_KEY = 'cf-notepad:publish-preferences'/)
    assert.match(baseTemplateSource, /const defaultPublishPreferences = Object\.freeze\(\{ publish: true, autosave: true, publicIndex: true \}\)/)
    assert.match(baseTemplateSource, /window\.localStorage\.getItem\(PUBLISH_PREFERENCES_KEY\)/)
    assert.match(baseTemplateSource, /window\.localStorage\.setItem\(PUBLISH_PREFERENCES_KEY, JSON\.stringify\(preferences\)\)/)
    assert.match(baseTemplateSource, /const openPublishOptions = \(\) =>/)
    assert.match(baseTemplateSource, /publishCurrentNote\(preferences\)/)
    assert.match(baseTemplateSource, /setRailSwitchState\(\$autosaveToggle, APP_STATE\.autosave === true && isPublished\)/)
    assert.doesNotMatch(baseTemplateSource, /const promptEnableAutosave = async/)
    assert.doesNotMatch(baseTemplateSource, /if \(!wasPublished\) await promptEnableAutosave\(\)/)
    assert.doesNotMatch(baseTemplateSource, /APP_STATE\.isEdit && APP_STATE\.isPublished[\s\S]*cf-notepad-from-share/)
    assert.match(indexSource, /const \{ share, theme, (?:title, )?width, shareFont, publicIndex, content, autosave, annotationsEnabled \}/)
    assert.match(indexSource, /autosave !== undefined && \{ autosave: autosave === true \}/)
})

test('markdown export prefers the note title for the downloaded filename', () => {
    assert.match(baseTemplateSource, /const source = (title \|\| )?APP_STATE\.title \|\| APP_STATE\.path \|\| 'note'/)
})

test('publishing can persist the current editor content in the same request', () => {
    assert.match(baseTemplateSource, /body: JSON\.stringify\(\{[\s\S]*share: true,[\s\S]*content:/)
    assert.match(indexSource, /const \{ share, theme, (?:title, )?width, shareFont, publicIndex, content, autosave, annotationsEnabled \}/)
    assert.match(indexSource, /typeof content === 'string'/)
})

test('ordinary content saves are guarded by the published state', () => {
    assert.match(indexSource, /canPersistNoteContent\(metadata\)/)
    assert.match(indexSource, /return returnJSON\(10005, getSaveBlockedMessage\(getI18n\(request\)\)\)/)
})

test('manual sync or save on unpublished notes opens publish options instead of dead-end rejection', () => {
    assert.match(baseTemplateSource, /if \(!APP_STATE\.isPublished\) \{\s*if \(showBlocked\) \{\s*if \(typeof openPublishOptions === 'function'\) \{\s*openPublishOptions\(\)/)
})

