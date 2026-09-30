import test from 'node:test'
import assert from 'node:assert/strict'
import { MODAL, CITE_MODAL, URL_IMPORT_MODAL, MATH_FORMAT_MODAL, VAULT_PRESETS_MODAL } from '../src/templates/common.js'
import { getBaseCss } from '../src/styles/base.css.js'
import { HTML } from '../src/templates/base.js'

test('MODAL renders standardized close buttons and data-modal-close attributes', () => {
    const zhHtml = MODAL('zh-TW', { noteHistoryEnabled: true })
    const enHtml = MODAL('en-US', { noteHistoryEnabled: true })

    // Check data-modal-close on masks
    assert.match(zhHtml, /class="modal-mask" data-modal-close/)
    // Check standardized close buttons with multiplication sign × and aria-label
    assert.match(zhHtml, /class="close-btn share-modal-close" data-modal-close aria-label="關閉">×<\/button>/)
    assert.match(zhHtml, /class="close-btn share-history-close" data-modal-close aria-label="關閉">×<\/button>/)
    assert.match(zhHtml, /class="close-btn embed-modal-close" data-modal-close aria-label="關閉">×<\/button>/)
    assert.match(zhHtml, /class="close-btn password-modal-close" data-modal-close aria-label="取消">×<\/button>/)
    assert.match(zhHtml, /class="close-btn note-history-close" data-modal-close aria-label="關閉">×<\/button>/)

    assert.match(enHtml, /class="close-btn share-modal-close" data-modal-close aria-label="Close">×<\/button>/)
    assert.match(enHtml, /class="close-btn share-history-close" data-modal-close aria-label="Close">×<\/button>/)
    assert.match(enHtml, /class="close-btn embed-modal-close" data-modal-close aria-label="Close">×<\/button>/)
    assert.match(enHtml, /class="close-btn password-modal-close" data-modal-close aria-label="Cancel">×<\/button>/)
    assert.match(enHtml, /class="close-btn note-history-close" data-modal-close aria-label="Close">×<\/button>/)
})

test('CITE_MODAL, URL_IMPORT_MODAL, MATH_FORMAT_MODAL, and VAULT_PRESETS_MODAL render data-modal-close attributes', () => {
    const citeZh = CITE_MODAL('zh-TW')
    const urlZh = URL_IMPORT_MODAL('zh-TW')
    const mathZh = MATH_FORMAT_MODAL('zh-TW')
    const vaultZh = VAULT_PRESETS_MODAL('zh-TW')

    assert.match(citeZh, /id="cite-modal-mask" data-modal-close/)
    assert.match(citeZh, /id="cite-modal-close-btn" data-modal-close/)
    assert.match(citeZh, /id="cite-modal-cancel-btn" data-modal-close/)

    assert.match(urlZh, /id="url-import-mask" data-modal-close/)
    assert.match(urlZh, /id="url-import-close-btn" data-modal-close/)
    assert.match(urlZh, /id="url-import-cancel-btn" data-modal-close/)

    assert.match(mathZh, /id="math-format-mask" data-modal-close/)
    assert.match(mathZh, /id="math-format-close-btn" data-modal-close/)
    assert.match(mathZh, /id="math-format-cancel-btn" data-modal-close/)

    assert.match(vaultZh, /id="vault-presets-mask" data-modal-close/)
    assert.match(vaultZh, /id="vault-presets-close-btn" data-modal-close/)
    assert.match(vaultZh, /id="vault-presets-cancel-btn" data-modal-close/)
})

test('BASE_CSS defines standard modal variables and cards across light and dark themes', () => {
    const css = getBaseCss()

    // Light Theme variables
    assert.match(css, /--modal-bg:\s*#ffffff;/)
    assert.match(css, /--modal-border:\s*#d0d7de;/)
    assert.match(css, /--modal-text:\s*#24292f;/)
    assert.match(css, /--modal-surface:\s*#f6f8fa;/)

    // Dark Theme variables
    assert.match(css, /html\[data-ui-theme="dark"\][\s\S]*--modal-bg:\s*#1e293b;/)
    assert.match(css, /html\[data-ui-theme="dark"\][\s\S]*--modal-border:\s*#334155;/)
    assert.match(css, /html\[data-ui-theme="dark"\][\s\S]*--modal-text:\s*#f1f5f9;/)
    assert.match(css, /html\[data-ui-theme="dark"\][\s\S]*--modal-surface:\s*#0f172a;/)
    assert.match(css, /html\[data-ui-theme="dark"\][\s\S]*--modal-accent:\s*#38bdf8;/)

    // Standardized modal cards using CSS variables
    assert.match(css, /\.modal-content\s*\{[\s\S]*background:\s*var\(--modal-bg/)
    assert.match(css, /\.embed-modal-content\s*\{[\s\S]*background:\s*var\(--modal-bg/)
    assert.match(css, /\.url-import-modal-content\s*\{[\s\S]*background:\s*var\(--modal-bg/)
    assert.match(css, /\.cite-modal-content\s*\{[\s\S]*background:\s*var\(--modal-bg/)
    assert.match(css, /\.editor-preference-content\s*\{[\s\S]*background:\s*var\(--modal-bg/)
    assert.match(css, /\.publish-nudge-content\s*\{[\s\S]*background:\s*var\(--modal-bg/)
    assert.match(css, /\.password-modal-content\s*\{[\s\S]*background:\s*var\(--modal-bg/)
    assert.match(css, /\.app-dialog-content\s*\{[\s\S]*background:\s*var\(--modal-bg/)
    assert.match(css, /\.modal \.close-btn/)
})

test('HTML base template openModal supports Escape, Tab focus trap, and data-modal-close delegation', () => {
    const template = HTML({
        title: 'Modal System Test',
        body: '',
        path: 'modal-system-test',
        isPublished: true,
    })

    assert.match(template, /const openModal = \(modal/)
    assert.match(template, /event\.key === 'Escape'/)
    assert.match(template, /event\.target\.matches\('\[data-modal-close\], \.modal-mask, \.close-btn'\)/)
    assert.match(template, /closeModal\(modal\)/)
    assert.match(template, /window\.showAppPrompt = openPasswordModal/)
    assert.match(template, /window\.showAppDialog = openAppDialog/)
})

test('all modal dialogs and openers are properly wired in HTML base template', () => {
    const template = HTML({
        title: 'Modal Wiring Test',
        body: '',
        path: 'modal-wiring-test',
        isPublished: true,
    })

    // Verify modal trigger and lifecycle functions exist
    assert.match(template, /const setupShareHistory =/)
    assert.match(template, /const setupNoteHistory =/)
    assert.match(template, /(?:const|function)\s+openUrlImportModal/)
    assert.match(template, /(?:const|function)\s+openCiteModal/)
    assert.match(template, /(?:const|function)\s+openMathFormatModal/)
    assert.match(template, /const openPasswordModal =/)
    assert.match(template, /const openAppDialog =/)

    // Verify safe parsing with new Function
    const scriptMatches = [...template.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    for (const match of scriptMatches) {
        const code = match[1].trim()
        if (code && !match[0].includes('src=') && !match[0].includes('type="module"')) {
            assert.doesNotThrow(() => {
                new Function(code)
            }, 'Client inline script must parse without syntax error')
        }
    }
})

test('setupNoteHistory properly binds triggers and does not reference undefined openBtn', () => {
    const template = HTML({
        lang: 'zh-TW',
        title: 'Note History Wiring Test',
        body: '',
        path: 'note-history-test',
        isEdit: true,
        ext: { noteHistoryEnabled: true, share: true },
    })

    assert.doesNotMatch(template, /\bopenBtn\b/, 'Must not contain undeclared openBtn variable in script')
    assert.match(template, /const open = \(e\) =>/)
    assert.match(template, /openBtns\.forEach\(btn => btn\.setAttribute\('aria-expanded', 'true'\)\)/)
    assert.match(template, /openBtns\.forEach\(btn => btn\.setAttribute\('aria-expanded', 'false'\)\)/)
    assert.match(template, /class="note-history-trigger"[^>]*title="[^"]*"[^>]*>.*?id="publication-version-count"/)
})

