import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const baseSource = readFileSync(new URL('../src/templates/base.js', import.meta.url), 'utf8')
const indexSource = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const helperSource = readFileSync(new URL('../src/helper.js', import.meta.url), 'utf8')
const storageSource = readFileSync(new URL('../src/storage_driver.mjs', import.meta.url), 'utf8')
const mcpSource = readFileSync(new URL('../src/mcp_server.mjs', import.meta.url), 'utf8')
const pdfSource = readFileSync(new URL('../src/pdf_service.mjs', import.meta.url), 'utf8')
const fidoSource = readFileSync(new URL('../src/fido_auth.mjs', import.meta.url), 'utf8')
const mcpPySource = readFileSync(new URL('../mcp/server.py', import.meta.url), 'utf8')

test('VULN-01: base.js escapes content in bot-accessible-content and textarea', () => {
    assert.match(baseSource, /const accessibleContent = (?:isBurnInterstitial\s*\?\s*''\s*:\s*\(?)?isBlockDocument[\s\S]*?\? escapeHtml\(ext\.canvasMarkdown \|\| ''\)[\s\S]*?: escapeHtml\(content\)/)
    assert.match(baseSource, /id="bot-accessible-content">\$\{accessibleContent\}<\/article>/)
    assert.match(baseSource, /const textareaContent = (?:isBurnInterstitial\s*\?\s*''\s*:\s*)?escapeHtml\(content\)/)
    assert.match(baseSource, /placeholder="\$\{SUPPORTED_LANG\[lang\]\.emptyPH\}">\$\{escapeHtml\(content\)\}<\/textarea>/)
    assert.match(baseSource, /APP_STATE = \$\{safeJsonForInlineScript\(/)
})

test('VULN-02: base.js initializes Mermaid strictly and sanitizes diagram SVGs with DOMPurify', () => {
    assert.match(baseSource, /securityLevel:\s*'strict'/)
    assert.match(baseSource, /DOMPurify\.sanitize\(rawSvg, \{ USE_PROFILES: \{ svg: true, svgFilters: true \} \}\)/)
    assert.match(baseSource, /DOMPurify\.sanitize\(graphvizSvg, \{ USE_PROFILES: \{ svg: true, svgFilters: true \} \}\)/)
    assert.doesNotMatch(baseSource, /:\s*svg;/)
    assert.doesNotMatch(baseSource, /:\s*graphvizSvg;/)
})

test('VULN-03: password_policy returns view role for vpw match even if pw is unset', async () => {
    const { resolvePasswordRole } = await import('../src/password_policy.mjs')
    const matches = async (password, storedHash) => password === storedHash

    assert.equal(await resolvePasswordRole('view-pw', { vpw: 'view-pw' }, matches), 'view')
    assert.equal(await resolvePasswordRole('edit-pw', { pw: 'edit-pw', vpw: 'view-pw' }, matches), 'edit')
    assert.equal(await resolvePasswordRole('view-pw', { pw: 'edit-pw', vpw: 'view-pw' }, matches), 'view')
})

test('VULN-04: mcp/server.py restricts image uploads to allowed extensions and size limit', () => {
    assert.match(mcpPySource, /ALLOWED_IMAGE_EXTENSIONS = \{".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".avif"\}/)
    assert.match(mcpPySource, /MAX_IMAGE_SIZE_BYTES = 10 \* 1024 \* 1024/)
    assert.match(mcpPySource, /if ext not in ALLOWED_IMAGE_EXTENSIONS:/)
    assert.match(mcpPySource, /if file_size > MAX_IMAGE_SIZE_BYTES:/)
})

test('VULN-06: index.js creates signed admin session token and verifies cryptographically', () => {
    assert.match(indexSource, /async function verifyAdminSession\(cookie, adminPassword\)/)
    assert.match(indexSource, /async function createAdminSessionCookie\(adminPath, adminPassword\)/)
    assert.match(indexSource, /jwt\.sign\(\{ role: 'admin', exp \}, secret\)/)
    assert.match(indexSource, /secure: true/)
    assert.match(indexSource, /sameSite: 'Strict'/)
})

test('VULN-07: storage_driver.mjs uses path column instead of name in share lookup', () => {
    assert.match(storageSource, /SELECT path.*FROM notes/)
    assert.doesNotMatch(storageSource, /SELECT name FROM notes/)
    assert.match(storageSource, /if \(row && row\.path\)/)
})

test('VULN-08: helper.js deleteEmptyPages uses driverDeleteNote and leaves non-empty/locked notes intact', () => {
    assert.match(helperSource, /await driverDeleteNote\(note\.name\)/)
    assert.match(helperSource, /const hasPassword = Boolean\(metadata\?\.pw \|\| metadata\?\.vpw\)/)
    assert.match(helperSource, /if \(isContentEmpty && !hasPassword\)/)
})

test('VULN-09: helper.js uses constant-time comparison for password checking', async () => {
    const { passwordMatches } = await import('../src/helper.js')
    assert.equal(await passwordMatches('wrong', 'invalid-hash'), false)
    assert.match(helperSource, /constantTimeStringCompare/)
})

test('VULN-10: index.js sets exp claim on JWT auth cookies', () => {
    assert.match(indexSource, /const exp = Math\.floor\(Date\.now\(\) \/ 1000\) \+ 7 \* 86400/)
    assert.match(indexSource, /const payload = \{ path, role, \.\.\.\(noteUid \? \{ noteUid \} : \{\}\), exp \}/)
    assert.match(indexSource, /jwt\.sign\(payload, getSecret\(\)\)/)
})

test('VULN-11: index.js validates upload MIME types and size limits', () => {
    assert.match(indexSource, /const ALLOWED_IMAGE_MIME_MAP = \{/)
    assert.match(indexSource, /'image\/jpeg': 'jpg'/)
    assert.match(indexSource, /'image\/png': 'png'/)
    assert.match(indexSource, /if \(!ext\) \{\s*return returnJSON\(400, 'Invalid or unsupported image MIME type'\)/)
    assert.match(indexSource, /if \(image\.size && image\.size > 10 \* 1024 \* 1024\) \{\s*return returnJSON\(413, 'File size exceeds 10MB limit'\)/)
})

test('VULN-12: helper.js uses CSPRNG for random string generation', async () => {
    const { genRandomStr } = await import('../src/helper.js')
    const str = genRandomStr(16)
    assert.equal(typeof str, 'string')
    assert.equal(str.length, 16)
    assert.match(helperSource, /crypto\.getRandomValues/)
})

test('VULN-13: index.js retains draft content on unpublish and supports explicit API unpublish', () => {
    assert.match(indexSource, /const textToSave = typeof content === 'string' \? content : value/)
    assert.match(indexSource, /if \(reqBody\.share === false \|\| reqBody\.public === false\)/)
})

test('VULN-14: mcp_server limits batch requests to 20', () => {
    assert.match(mcpSource, /if \(isBatch && rpc\.length > 20\)/)
    assert.match(mcpSource, /Batch size exceeds limit of 20/)
})

test('VULN-15: pdf_service escapes metadata and strips CRLF/quotes from filenames', () => {
    assert.match(pdfSource, /const safeTitle = title \? String\(title\)\.replace\(/)
    assert.match(pdfSource, /const safeSiteUrl = String\(siteUrl \|\| ''\)\.replace\(/)
    assert.match(pdfSource, /replace\(\/\["\\r\\n;\\\\\]\/g, '_'\)/)
})

test('Hardening: fido_auth fails closed when KV namespace is missing', async () => {
    const { verifyAndConsumeFidoChallenge } = await import('../src/fido_auth.mjs')
    assert.equal(await verifyAndConsumeFidoChallenge(null, 'test-challenge'), false)
})
