import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
    parseExpirationSeconds,
    isShareExpired,
    isShareBurned,
    isShareTimeLocked,
    isShareDeadmanLocked,
    formatShareRemainingTime,
} from '../src/note_meta.js'
import {
    VAULT_MODES,
    VAULT_MODE_INFO,
    VAULT_QUICK_PRESETS,
    EXPIRATION_OPTIONS,
    PULSE_INTERVAL_OPTIONS,
    SUPPORTED_LANG,
} from '../src/constant.js'
import {
    ShareExpired,
    ShareBurned,
    ShareTimeLocked,
    ShareDeadmanLocked,
} from '../src/templates/pages.js'
import * as TEMPL from '../src/template.js'
import { handleMcpRequest } from '../src/mcp_server.mjs'

const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const baseTemplateSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const commonTemplateSource = readFileSync(new URL('../src/templates/common.js', import.meta.url), 'utf8')
const baseCssSource = readFileSync(new URL('../src/styles/base.css.js', import.meta.url), 'utf8')

test('note_meta: parseExpirationSeconds parses standard shorthand durations and numbers', () => {
    assert.equal(parseExpirationSeconds('10m'), 600)
    assert.equal(parseExpirationSeconds('1h'), 3600)
    assert.equal(parseExpirationSeconds('1d'), 86400)
    assert.equal(parseExpirationSeconds('7d'), 604800)
    assert.equal(parseExpirationSeconds('30d'), 2592000)
    assert.equal(parseExpirationSeconds('3600'), 3600)
    assert.equal(parseExpirationSeconds(7200), 7200)
    assert.equal(parseExpirationSeconds('never'), null)
    assert.equal(parseExpirationSeconds(''), null)
    assert.equal(parseExpirationSeconds(null), null)
    assert.equal(parseExpirationSeconds('invalid'), null)
})

test('note_meta: isShareExpired detects expired shares correctly', () => {
    const now = 1700000000
    assert.equal(isShareExpired({ shareExpiresAt: now - 10 }, now), true)
    assert.equal(isShareExpired({ shareExpiresAt: now }, now), true)
    assert.equal(isShareExpired({ shareExpiresAt: now + 60 }, now), false)
    assert.equal(isShareExpired({}, now), false)
    assert.equal(isShareExpired(null, now), false)
})

test('note_meta: isShareBurned identifies burned status', () => {
    assert.equal(isShareBurned({ burned: true }), true)
    assert.equal(isShareBurned({ shareBurned: true }), true)
    assert.equal(isShareBurned({ shareBurnAfterReading: true, shareViewCount: 1 }), true)
    assert.equal(isShareBurned({ shareBurnAfterReading: true, shareViewCount: 0 }), false)
    assert.equal(isShareBurned({ shareMode: 'standard' }), false)
    assert.equal(isShareBurned({}), false)
})

test('note_meta: isShareTimeLocked identifies sealed time-locked capsules', () => {
    const now = 1700000000
    // Locked when unlock timestamp is in future
    assert.equal(isShareTimeLocked({ shareMode: 'timelock', shareUnlockAt: now + 100 }, now), true)
    // Unlocked once unlock timestamp has passed
    assert.equal(isShareTimeLocked({ shareMode: 'timelock', shareUnlockAt: now - 1 }, now), false)
    // Standard mode is never timelocked
    assert.equal(isShareTimeLocked({ shareMode: 'standard', shareUnlockAt: now + 100 }, now), false)
})

test('note_meta: isShareDeadmanLocked identifies active pulse heartbeat vs overdue release', () => {
    const now = 1700000000
    // Pulse is healthy -> deadman locked (sealed)
    assert.equal(isShareDeadmanLocked({ shareMode: 'deadman', sharePulseDueAt: now + 100 }, now), true)
    // Pulse overdue -> released to visitor (not locked)
    assert.equal(isShareDeadmanLocked({ shareMode: 'deadman', sharePulseDueAt: now - 1 }, now), false)
    // Other modes are never deadman locked
    assert.equal(isShareDeadmanLocked({ shareMode: 'standard', sharePulseDueAt: now + 100 }, now), false)
})

test('note_meta: formatShareRemainingTime formats human-readable durations in zh-TW and en-US', () => {
    const now = 1700000000
    const target = now + 86400 * 2 + 3600 * 3 + 120 // 2 days 3 hours 2 minutes
    const zh = formatShareRemainingTime(target, now, 'zh-TW')
    const en = formatShareRemainingTime(target, now, 'en-US')
    assert.match(zh, /2\s*天/)
    assert.match(zh, /3\s*小時/)
    assert.match(en, /2\s*d/)
    assert.match(en, /3\s*h/)

    assert.equal(formatShareRemainingTime(now - 10, now, 'zh-TW'), '已過期')
    assert.equal(formatShareRemainingTime(now - 10, now, 'en-US'), 'Expired')
})

test('constant: contains complete bilingual vault mode configurations and options', () => {
    assert.deepEqual(VAULT_MODES, ['standard', 'burn_after_reading', 'timelock', 'deadman'])
    assert.ok(VAULT_MODE_INFO.standard['zh-TW'])
    assert.ok(VAULT_MODE_INFO.burn_after_reading['zh-TW'])
    assert.ok(VAULT_MODE_INFO.timelock['zh-TW'])
    assert.ok(VAULT_MODE_INFO.deadman['zh-TW'])
    assert.ok(VAULT_MODE_INFO.standard['en-US'])
    assert.ok(VAULT_MODE_INFO.burn_after_reading['en-US'])
    assert.ok(VAULT_MODE_INFO.timelock['en-US'])
    assert.ok(VAULT_MODE_INFO.deadman['en-US'])
    assert.ok(SUPPORTED_LANG['zh-TW'].burnRevealWarning)
    assert.ok(SUPPORTED_LANG['en-US'].burnRevealWarning)
    assert.ok(EXPIRATION_OPTIONS.some(o => o.value === '1d'))
    assert.ok(PULSE_INTERVAL_OPTIONS.some(o => o.value === '7d'))
})

test('constant: Seal presets provide the advertised release rules', () => {
    const byId = Object.fromEntries(VAULT_QUICK_PRESETS.map(preset => [preset.id, preset]))
    assert.equal(VAULT_QUICK_PRESETS.length, 10)
    assert.deepEqual(
        ['otp', 'crypto', 'whistleblower', 'launch', 'birthday', 'legal', 'scavenger', 'course', 'backup', 'secret'],
        VAULT_QUICK_PRESETS.map(preset => preset.id),
    )
    assert.equal(byId.otp.mode, 'burn')
    assert.equal(byId.otp.expiresIn, '1h')
    assert.equal(byId.secret.mode, 'burn')
    assert.equal(byId.secret.expiresIn, '1d')
    assert.equal(byId.legal.expiresIn, '30d')
})

function validateScriptsInHtml(html, contextName) {
    const scripts = html.match(/<script[\s\S]*?<\/script>/g) || []
    assert.ok(scripts.length > 0, `${contextName} should contain script tags`)
    for (const s of scripts) {
        if (s.includes('text/template')) continue
        const code = s.replace(/<script[^>]*>/i, '').replace(/<\/script>$/i, '')
        if (!code.trim()) continue
        if (s.includes('type="module"')) {
            const sanitizedModuleCode = code
                .replace(/import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];?/g, (match, imports) => {
                    const cleanImports = imports.replace(/[{}]/g, '').split(',').map(x => x.trim()).filter(Boolean)
                    return cleanImports.length > 0 ? `var ${cleanImports.join(', ')};` : ''
                })
                .replace(/export\s+function\s+/g, 'function ')
                .replace(/export\s+const\s+/g, 'const ')
            try {
                new Function(sanitizedModuleCode)
            } catch (err) {
                assert.fail(`Syntax error in module script for ${contextName}: ${err.message}\nCode:\n${sanitizedModuleCode}`)
            }
            continue
        }
        try {
            new Function(code)
        } catch (err) {
            assert.fail(`Syntax error in script tag for ${contextName}: ${err.message}\nCode:\n${code}`)
        }
    }
}

test('templates/pages: ShareExpired and ShareBurned render tombstone status pages', () => {
    const expiredZh = ShareExpired({ lang: 'zh-TW', title: '過期筆記' })
    assert.match(expiredZh, /分享已過期/)
    assert.match(expiredZh, /此分享連結的有效期限已截止/)
    assert.match(expiredZh, /class="share-status-page share-expired-page"/)

    const burnedEn = ShareBurned({ lang: 'en-US', title: 'Burned Note' })
    assert.match(burnedEn, /Share Destroyed/)
    assert.match(burnedEn, /This share was set to burn after reading/)
    assert.match(burnedEn, /class="share-status-page share-burned-page"/)
})

test('templates/pages: ShareTimeLocked and ShareDeadmanLocked render live countdowns with valid script syntax', () => {
    const timeLockedHtml = ShareTimeLocked({
        lang: 'zh-TW',
        title: '機密時間膠囊',
        ext: {
            shareUnlockAt: 1750000000,
        },
    })
    assert.match(timeLockedHtml, /時間膠囊封印中/)
    assert.match(timeLockedHtml, /share-countdown-wrapper/)
    assert.match(timeLockedHtml, /data-target-timestamp="1750000000"/)
    validateScriptsInHtml(timeLockedHtml, 'ShareTimeLocked')

    const deadmanLockedHtml = ShareDeadmanLocked({
        lang: 'en-US',
        title: 'Protected Will',
        ext: {
            sharePulseDueAt: 1750000000,
        },
    })
    assert.match(deadmanLockedHtml, /Dead Man's Switch Active/)
    assert.match(deadmanLockedHtml, /data-target-timestamp="1750000000"/)
    validateScriptsInHtml(deadmanLockedHtml, 'ShareDeadmanLocked')
})

test('styles/base.css.js: contains required vault countdown, interstitial, and banner rules', () => {
    assert.match(baseCssSource, /\.share-status-page/)
    assert.match(baseCssSource, /\.share-countdown-wrapper/)
    assert.match(baseCssSource, /\.countdown-card/)
    assert.match(baseCssSource, /\.share-author-preview-banner/)
    assert.match(baseCssSource, /\.share-deadman-released-banner/)
    assert.match(baseCssSource, /\.share-burn-interstitial/)
    assert.match(baseCssSource, /\.burn-interstitial-card/)
    assert.match(baseCssSource, /\.vault-presets-toolbar-btn/)
    assert.match(baseCssSource, /\.vault-presets-modal-content/)
    assert.match(baseCssSource, /\.vault-preset-card/)
    assert.match(baseCssSource, /html\[data-ui-theme="dark"\]\s+\.vault-presets-modal-content/)
    assert.match(baseCssSource, /html\[data-ui-theme="dark"\]\s+\.vault-preset-card/)
    assert.match(baseCssSource, /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*?\.vault-presets-modal-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr/)
    assert.match(baseCssSource, /\.preset-card-title\s*\{[^}]*display:\s*block/)
    assert.match(baseCssSource, /\.preset-card-desc\s*\{[^}]*display:\s*block/)
})

test('templates/common.js: renders Seal access control modal, toolbar trigger, and cleans obsolete dropdowns', () => {
    // Obsolete vault dropdowns must NOT exist in common template (share menu is clean and unified)
    assert.doesNotMatch(commonTemplateSource, /id="share-vault-mode-select"/)
    assert.doesNotMatch(commonTemplateSource, /id="share-expires-select"/)
    assert.doesNotMatch(commonTemplateSource, /id="burn-after-reading-btn"/)
    assert.doesNotMatch(commonTemplateSource, /id="share-unlock-select"/)
    assert.doesNotMatch(commonTemplateSource, /id="share-pulse-select"/)

    // Seal access control controls unified in Seal modal and menu trigger
    assert.match(commonTemplateSource, /id="seal-mode-select"/)
    assert.match(commonTemplateSource, /id="seal-unlock-at"/)
    assert.match(commonTemplateSource, /id="seal-max-views"/)
    assert.match(commonTemplateSource, /id="seal-pulse-minutes"/)
    assert.match(commonTemplateSource, /id="seal-expires-select"/)
    assert.match(commonTemplateSource, /id="seal-modal-pulse-btn"/)
    assert.match(commonTemplateSource, /id="seal-modal-pulse-copy-btn"/)
    assert.match(commonTemplateSource, /open-vault-presets-modal-btn/)
    assert.match(commonTemplateSource, /id="vault-presets-modal"/)

    assert.doesNotMatch(commonTemplateSource, /<button[^>]*class="[^"]*toolbar-icon-button[^"]*seal-toolbar-btn/)
    assert.doesNotMatch(commonTemplateSource, /<button[^>]*class="[^"]*toolbar-icon-button[^"]*opt-pw/)
    assert.match(commonTemplateSource, /share-dropdown-menu[\s\S]*?SECURITY_CONTROLS_RENDER/)

    // Verify Bug 2: modal cards inside button do not contain invalid nested div block elements
    assert.match(commonTemplateSource, /<span class="preset-card-top">/)
    assert.match(commonTemplateSource, /<span class="preset-card-title">/)
    assert.match(commonTemplateSource, /<span class="preset-card-desc">/)
    assert.doesNotMatch(commonTemplateSource, /<button[^>]*class="[^"]*vault-preset-card[^"]*"[^>]*>(?:(?!<\/button>)[\s\S])*?<div/i)
})

test('templates/base.js: renders author preview banner, deadman released banner, and wires vault events', () => {
    assert.match(baseTemplateSource, /share-author-preview-banner/)
    assert.match(baseTemplateSource, /share-deadman-released-banner/)
    assert.match(baseTemplateSource, /APP_STATE\.shareMode/)
    assert.match(baseTemplateSource, /syncVaultModeUI/)
    assert.match(baseTemplateSource, /action="\/share\/\$\{escapeHtml\(shareId\)\}/)
    assert.match(baseTemplateSource, /\/api\/shares\/'\s*\+\s*encodeURIComponent\(APP_STATE\.shareId\)\s*\+\s*'\/pulse/)
    assert.match(baseTemplateSource, /vault-presets-modal/)
    assert.match(baseTemplateSource, /vault-presets-toolbar-btn/)
})

test('index.js: contains vault security endpoints and protections', () => {
    // Pulse API
    assert.match(indexSource, /router\.(?:get|post)\('\/api\/shares\/:shareId\/pulse'/)
    // Reveal API
    assert.match(indexSource, /router\.post\('\/api\/shares\/:shareId\/reveal'/)
    // Author recognition
    assert.match(indexSource, /isNoteAuthor/)
    // Setting endpoint handles vault mode fields
    assert.match(indexSource, /shareMode/)
    assert.match(indexSource, /shareExpiresIn/)
    assert.match(indexSource, /shareBurnAfterReading/)
    assert.match(indexSource, /shareUnlockIn/)
    assert.match(indexSource, /sharePulseInterval/)
})

test('mcp_server: write_note supports vault modes (burn_after_reading, timelock, deadman, expiration)', async () => {
    const notesStore = new Map()
    const shareStore = new Map()

    globalThis.NOTES = {
        getWithMetadata: async (key) => {
            const item = notesStore.get(key)
            if (!item) return { value: null, metadata: null }
            return { value: item.value, metadata: item.metadata }
        },
        put: async (key, value, options = {}) => {
            notesStore.set(key, { value, metadata: options.metadata || {} })
        },
    }
    globalThis.SHARE = {
        get: async (key) => shareStore.get(key) || null,
        put: async (key, value) => {
            shareStore.set(key, value)
        },
    }
    globalThis.SCN_STORAGE_DRIVER = 'kv'
    globalThis.SCN_SALT = 'test-salt'

    // 1. Burn-after-reading note via MCP
    const burnReq = new Request('https://wiki.david888.com/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'write_note',
                arguments: {
                    path: 'secret-burn-note',
                    text: '# Self-Destruct Note',
                    share_mode: 'burn_after_reading',
                },
            },
        }),
    })
    const burnRes = await handleMcpRequest(burnReq)
    assert.equal(burnRes.status, 200)
    const burnBody = await burnRes.json()
    assert.match(burnBody.result.content[0].text, /Burn-After-Reading/)
    const burnSaved = notesStore.get('secret-burn-note')
    assert.equal(burnSaved.metadata.shareMode, 'burn_after_reading')
    assert.equal(burnSaved.metadata.shareBurnAfterReading, true)

    // 2. Timelocked capsule via MCP
    const timelockReq = new Request('https://wiki.david888.com/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'write_note',
                arguments: {
                    path: 'future-capsule',
                    text: '# Time Capsule',
                    share_mode: 'timelock',
                    unlock_in: '7d',
                },
            },
        }),
    })
    const timelockRes = await handleMcpRequest(timelockReq)
    assert.equal(timelockRes.status, 200)
    const timelockBody = await timelockRes.json()
    assert.match(timelockBody.result.content[0].text, /Time-Locked Capsule/)
    const timelockSaved = notesStore.get('future-capsule')
    assert.equal(timelockSaved.metadata.shareMode, 'timelock')
    assert.ok(timelockSaved.metadata.shareUnlockAt > 0)

    // 3. Dead man's switch via MCP
    const deadmanReq = new Request('https://wiki.david888.com/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'write_note',
                arguments: {
                    path: 'deadman-will',
                    text: '# Final Instructions',
                    share_mode: 'deadman',
                    pulse_interval: '14d',
                },
            },
        }),
    })
    const deadmanRes = await handleMcpRequest(deadmanReq)
    assert.equal(deadmanRes.status, 200)
    const deadmanBody = await deadmanRes.json()
    assert.match(deadmanBody.result.content[0].text, /Dead Man's Switch/)
    assert.match(deadmanBody.result.content[0].text, /Pulse Webhook URL/)
    const deadmanSaved = notesStore.get('deadman-will')
    assert.equal(deadmanSaved.metadata.shareMode, 'deadman')
    assert.ok(deadmanSaved.metadata.sharePulseDueAt > 0)
    assert.ok(deadmanSaved.metadata.sharePulseToken.length >= 16)
})

test('constant: VAULT_QUICK_PRESETS contains all 10 Quick Start Presets with templates', async () => {
    const { VAULT_QUICK_PRESETS } = await import('../src/constant.js')
    assert.equal(VAULT_QUICK_PRESETS.length, 10)
    const expectedIds = ['otp', 'crypto', 'whistleblower', 'launch', 'birthday', 'legal', 'scavenger', 'course', 'backup', 'secret']
    assert.deepEqual(VAULT_QUICK_PRESETS.map(p => p.id), expectedIds)

    for (const preset of VAULT_QUICK_PRESETS) {
        assert.ok(preset.icon, `Preset ${preset.id} missing icon`)
        assert.ok(preset.iconName, `Preset ${preset.id} missing iconName`)
        assert.ok(preset.labelZh, `Preset ${preset.id} missing labelZh`)
        assert.ok(preset.labelEn, `Preset ${preset.id} missing labelEn`)
        assert.ok(preset.mode, `Preset ${preset.id} missing mode`)
        assert.ok(['burn', 'deadman', 'timelock', 'standard'].includes(preset.mode), `Invalid mode for ${preset.id}`)
        assert.ok(preset.template.length > 10, `Preset ${preset.id} missing template`)
    }
})

test('storage_driver: driverSetShareStatus clears tombstone when status is null', async () => {
    const kvStore = new Map()
    globalThis.SHARE = {
        async put(k, v) { kvStore.set(k, v) },
        async get(k) { return kvStore.get(k) || null },
        async delete(k) { kvStore.delete(k) },
    }
    const { driverSetShareStatus, driverGetShareStatus } = await import('../src/storage_driver.mjs')

    await driverSetShareStatus('test-share-123', 'burned', { burnedAt: 12345 })
    let status = await driverGetShareStatus('test-share-123')
    assert.equal(status?.status, 'burned')

    // Passing null status deletes the tombstone
    await driverSetShareStatus('test-share-123', null)
    status = await driverGetShareStatus('test-share-123')
    assert.equal(status, null)
})

test('index.js: security hardening patterns are implemented', () => {
    // 1. Author cookie fallback uses ephemeral UUID
    assert.match(indexSource, /EPHEMERAL_AUTHOR_SECRET = crypto\.randomUUID\(\)/)
    assert.doesNotMatch(indexSource, /'author-secret'/)

    // 2. Reveal endpoint verifies password and restricts to burn mode
    assert.match(indexSource, /metadata\.shareBurnAfterReading !== true && !isAuthor/)
    assert.match(indexSource, /Password required to reveal this note/)

    // 3. PDF export requires confirmation for burn shares
    assert.match(indexSource, /PDF export will permanently destroy this burn-after-reading share/)

    // 4. Quick preset handler wired in base.js
    assert.match(baseTemplateSource, /\.vault-preset-btn/)
    assert.match(baseTemplateSource, /quickPresetApplied/)

    // 5. Password verified before burn destruction on PDF export
    const pdfPasswordIdx = indexSource.indexOf('hasViewAccess = valid || isAuthor || (providedPw')
    const pdfBurnClaimIdx = indexSource.indexOf('PDF export will permanently destroy this burn-after-reading share')
    assert.ok(pdfPasswordIdx > 0 && pdfBurnClaimIdx > 0 && pdfPasswordIdx < pdfBurnClaimIdx, 'Password verification must run before burn destruction in handleSharePdfExport')

    // 6. Path-based API enforces vault modes for non-authors
    assert.match(indexSource, /Burn-after-reading shares must be revealed via \/share\/:shareId or \/api\/shares\/:shareId\/reveal/)
    assert.match(indexSource, /Share is time-locked and cannot be viewed yet/)

    // 7. Draft preset selects use draft IDs when unpublished
    assert.match(baseTemplateSource, /document\.querySelector\('#share-unlock-select-draft'\)/)
    assert.match(baseTemplateSource, /document\.querySelector\('#share-pulse-select-draft'\)/)
})

test('storage_driver: driverFindNoteByShareId queries content column and maps to value', async () => {
    let capturedSql = ''
    globalThis.NOTES_DB = {
        prepare(sql) {
            capturedSql = sql
            return {
                bind() {
                    return {
                        async first() {
                            return { path: 'secret-test', metadata: JSON.stringify({ shareSlug: 'abc12345' }), content: 'Top Secret Body' }
                        }
                    }
                }
            }
        }
    }
    const { driverFindNoteByShareId } = await import('../src/storage_driver.mjs')
    const res = await driverFindNoteByShareId('abc12345')
    assert.match(capturedSql, /SELECT path, metadata, content FROM notes/i)
    assert.equal(res?.path, 'secret-test')
    assert.equal(res?.value, 'Top Secret Body')
})

test('storage_driver: driverClaimBurnShare atomically claims and returns false on duplicate claim', async () => {
    const kvStore = new Map()
    globalThis.SHARE = {
        async put(k, v) { kvStore.set(k, v) },
        async get(k) { return kvStore.get(k) || null },
        async delete(k) { kvStore.delete(k) },
    }
    globalThis.NOTES = {
        async getWithMetadata(p) { return { value: 'Secret', metadata: { share: true } } },
        async put(p, v, opts) {},
    }
    let updateCount = 0
    globalThis.NOTES_DB = {
        prepare(sql) {
            return {
                bind() {
                    return {
                        async run() {
                            updateCount++
                            return { meta: { changes: updateCount === 1 ? 1 : 0 } }
                        }
                    }
                }
            }
        }
    }
    const { driverClaimBurnShare } = await import('../src/storage_driver.mjs')

    // First claim succeeds
    const firstClaim = await driverClaimBurnShare('burn-share-1', 'secret-path', 1700000000)
    assert.equal(firstClaim, true)

    // Second claim fails (already burned)
    const secondClaim = await driverClaimBurnShare('burn-share-1', 'secret-path', 1700000000)
    assert.equal(secondClaim, false)
})

test('discovery: buildLlmsTxt, buildLlmsFullTxt and buildOpenApiDocument document Share Vault', async () => {
    const { buildLlmsTxt, buildLlmsFullTxt, buildOpenApiDocument } = await import('../src/discovery.mjs')

    const llmsTxt = buildLlmsTxt('https://wiki.david888.com')
    assert.match(llmsTxt, /Share Vault & Temporal Secrets/)
    assert.match(llmsTxt, /Vault & Secret MCP Tools/)

    const llmsFullTxt = buildLlmsFullTxt('https://wiki.david888.com')
    assert.match(llmsFullTxt, /Pulse Heartbeat/)
    assert.match(llmsFullTxt, /Reveal Burn Secret/)
    assert.match(llmsFullTxt, /Vault PDF Export/)
    assert.match(llmsFullTxt, /Share Vault Lifecycle Modes/)
    assert.match(llmsFullTxt, /10 Quick-Start Scenarios/)

    const openApi = buildOpenApiDocument('https://wiki.david888.com')
    const reqProps = openApi.components.schemas.NoteWriteRequest.properties
    assert.ok(reqProps.shareMode, 'OpenAPI NoteWriteRequest must include shareMode')
    assert.ok(reqProps.shareExpiresIn, 'OpenAPI NoteWriteRequest must include shareExpiresIn')
    assert.ok(reqProps.shareBurnAfterReading, 'OpenAPI NoteWriteRequest must include shareBurnAfterReading')
    assert.ok(reqProps.shareUnlockIn, 'OpenAPI NoteWriteRequest must include shareUnlockIn')
    assert.ok(reqProps.sharePulseInterval, 'OpenAPI NoteWriteRequest must include sharePulseInterval')

    assert.ok(openApi.paths['/api/shares/{shareId}/pulse'], 'OpenAPI must document pulse endpoint')
    assert.ok(openApi.paths['/api/shares/{shareId}/reveal'], 'OpenAPI must document reveal endpoint')
})

test('index.js and base.js: direct path vault enforcement and batched preset updates', async () => {
    const fs = await import('fs')
    const indexSource = fs.readFileSync('src/index.js', 'utf-8')
    const baseSource = fs.readFileSync('src/templates/base.js', 'utf-8')

    // Direct path GET /:path and HEAD /:path check isAuthor and vault status
    const getPathBlock = indexSource.substring(indexSource.indexOf("router.get('/:path'"), indexSource.indexOf("router.head('/:path'"))
    assert.match(getPathBlock, /isAuthor = await isNoteAuthor\(request, path, cookie\)/)
    assert.match(getPathBlock, /metadata\.shareBurnedAt/)
    assert.match(getPathBlock, /Response\.redirect\(`\$\{new URL\(request\.url\)\.origin\}\/share\/\$\{shareId\}`/)

    const headPathBlock = indexSource.substring(indexSource.indexOf("router.head('/:path'"))
    assert.match(headPathBlock, /isAuthor = await isNoteAuthor\(request, path, cookie\)/)
    assert.match(headPathBlock, /metadata\.shareBurnedAt/)

    // Preset button click handler batches settings updates into a single persistSetting call
    const presetClickBlock = baseSource.substring(baseSource.indexOf('const presetBtn = e.target.closest'), baseSource.indexOf('const unpublishBtn'))
    assert.match(presetClickBlock, /await persistSetting\(settingPayload\)/)
    assert.ok(!presetClickBlock.includes("modeSelect.dispatchEvent(new Event('change'))"), 'Must not dispatch separate change events that cause racing requests')
    assert.ok(!presetClickBlock.includes('editArea.value'), 'Presets must never overwrite or modify note content')
    assert.match(presetClickBlock, /#seal-mode-select/, 'Must update seal mode select')
    assert.match(presetClickBlock, /mode === 'expires' \|\| mode === 'burn'[\s\S]*?settingPayload\.shareExpiresIn = expires/, 'Burn presets must persist their configured expiration')

    const saveSealBlock = baseSource.substring(baseSource.indexOf("const saveSealBtn = e.target.closest('#seal-save-btn')"), baseSource.indexOf("const removeSealBtn = e.target.closest('#seal-remove-btn')"))
    assert.match(saveSealBlock, /mode === 'burn'[\s\S]*?presetExpires[\s\S]*?settingPayload\.shareExpiresIn = presetExpires/, 'Saving a burn preset must keep its expiration rule')
})

test('index.js: direct-path Seal locks dispatch to exported visitor templates', () => {
    const directPathBlock = indexSource.substring(
        indexSource.indexOf("router.get('/:path'"),
        indexSource.indexOf("router.head('/:path'"),
    )

    assert.match(directPathBlock, /returnPage\('ShareTimeLocked'/)
    assert.match(directPathBlock, /returnPage\('ShareDeadmanLocked'/)
    assert.doesNotMatch(directPathBlock, /returnPage\('ShareLocked'/)
    assert.equal(typeof TEMPL.ShareTimeLocked, 'function')
    assert.equal(typeof TEMPL.ShareDeadmanLocked, 'function')
})

test('templates/common.js & base.js: VAULT_PRESETS_MODAL provides bilingual toggle and preserves note text', async () => {
    const { VAULT_PRESETS_MODAL } = await import('../src/templates/common.js')
    const zhModal = VAULT_PRESETS_MODAL('zh-TW')
    const enModal = VAULT_PRESETS_MODAL('en-US')

    // 1. Language switcher buttons rendered in header
    assert.match(zhModal, /class="vault-pref-lang-btn\s+is-active"\s+data-vault-lang="zh-TW"/)
    assert.match(zhModal, /data-vault-lang="en-US"/)
    assert.match(enModal, /class="vault-pref-lang-btn\s+is-active"\s+data-vault-lang="en-US"/)

    // 2. Bilingual data attributes on cards
    assert.match(zhModal, /data-title-zh="一次性密碼"/)
    assert.match(zhModal, /data-title-en="One-Time Password"/)
    assert.match(zhModal, /data-badge-zh="🔥 閱後即焚"/)
    assert.match(zhModal, /data-badge-en="🔥 Burn After Read"/)

    // 3. Subtitle & tip clarify that note text is never modified
    assert.match(zhModal, /不會影響現有筆記內容/)
    assert.match(enModal, /without affecting existing note content/)

    // 4. base.js provides updateVaultModalLanguage client-side switcher
    const fs = await import('fs')
    const baseSource = fs.readFileSync('src/templates/base.js', 'utf-8')
    assert.match(baseSource, /updateVaultModalLanguage/)
    assert.match(baseSource, /vault-pref-lang-btn/)
})

test('templates/common.js & base.js & index.js: Seal Access Control integrates orthogonal asset release controls', async () => {
    const { VAULT_PRESETS_MODAL } = await import('../src/templates/common.js')
    const zhModal = VAULT_PRESETS_MODAL('zh-TW')
    const enModal = VAULT_PRESETS_MODAL('en-US')

    // 1. Philosophy subtitle matches 888box definition
    assert.match(zhModal, /Seal 與密碼同屬資產存取控制：密碼保護內容，Seal 控制何時或如何釋出/)
    assert.match(enModal, /Seal and password are asset access controls: password protects content, Seal controls when and how it is released/)

    // 2. Seal form elements
    assert.match(zhModal, /id="seal-mode-select"/)
    assert.match(zhModal, /id="seal-unlock-at"/)
    assert.match(zhModal, /id="seal-max-views"/)
    assert.match(zhModal, /id="seal-pulse-minutes"/)
    assert.match(zhModal, /id="seal-status-badge"/)
    assert.match(zhModal, /id="seal-save-btn"/)
    assert.match(zhModal, /id="seal-remove-btn"/)

    // 3. Quick chips for time and pulse
    assert.match(zhModal, /data-time-add="1h"/)
    assert.match(zhModal, /data-time-add="7d"/)
    assert.match(zhModal, /data-pulse-mins="10080"/)

    // 4. Setting endpoint handles seal attributes and removeSeal
    const fs = await import('fs')
    const indexSource = fs.readFileSync('src/index.js', 'utf-8')
    assert.match(indexSource, /removeSeal/)
    assert.match(indexSource, /sealMode/)
    assert.match(indexSource, /sealUnlockAt/)
    assert.match(indexSource, /sealMaxViews/)
    assert.match(indexSource, /sealPulseMinutes/)

    // 5. Visitor page renders Seal branding
    const { ShareTimeLocked, ShareDeadmanLocked } = await import('../src/templates/pages.js')
    const lockedPage = ShareTimeLocked({ lang: 'zh-TW', title: 'Test Note', ext: { shareUnlockAt: 1800000000 } })
    assert.match(lockedPage, /David888 Wiki \/ Seal/)
    assert.match(lockedPage, /Seal 尚未解鎖/)
    assert.match(lockedPage, /class="seal-visitor-info-box"/)

    const deadmanPage = ShareDeadmanLocked({ lang: 'zh-TW', title: 'Test Note', ext: { sharePulseDueAt: 1800000000 } })
    assert.match(deadmanPage, /David888 Wiki \/ Seal/)
    assert.match(deadmanPage, /Dead Man/)
})
