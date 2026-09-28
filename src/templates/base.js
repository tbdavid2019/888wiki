/**
 * src/templates/base.js
 * HTML wrapper function (base page structure for editor/share pages)
 */
import { CDN_PREFIX, SUPPORTED_LANG, APP_NAME, DEFAULT_PREVIEW_WIDTH } from '../constant.js'
import { THEMES } from '../theme_data.js'
import { EDITOR_TOOLBAR, FOOTER, MODAL, EDITOR_PREFERENCE_MODAL, MATH_FORMAT_MODAL, URL_IMPORT_MODAL, CITE_MODAL, VAULT_PRESETS_MODAL, SVG_ICONS } from './common.js'
import { getBaseCss } from '../styles/base.css.js'
import { getEditorCss } from '../styles/editor.css.js'
import { getMarkdownCss } from '../styles/markdown.css.js'
import { AUTOSAVE_IDLE_MS } from '../save_policy.mjs'
import { resolveAnnotationsEnabled, resolveEditorFormat, isCanvasContent, formatShareRemainingTime } from '../note_meta.js'

const PUBLIC_ICON_SVG_URL = '/icon.svg'
const PUBLIC_ICON_PNG_URL = '/icon.png'
const DEFAULT_OG_SITE_NAME = 'DAVID888 WIKI'
const WEB_AWESOME_VERSION = '3.10.0'

const escapeHtml = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const getLangText = lang => SUPPORTED_LANG[lang] || SUPPORTED_LANG['en-US']

export const resolvePageTheme = ({
    randomize = false,
    storedTheme = '',
    themes = THEMES,
    random = Math.random,
} = {}) => {
    const themeNames = Object.keys(themes)
    const fallbackTheme = Object.prototype.hasOwnProperty.call(themes, 'claude-canvas')
        ? 'claude-canvas'
        : (themeNames[0] || '')

    if (!randomize) {
        return Object.prototype.hasOwnProperty.call(themes, storedTheme)
            ? storedTheme
            : fallbackTheme
    }

    const randomValue = Number(random())
    const randomIndex = Number.isFinite(randomValue)
        ? Math.min(themeNames.length - 1, Math.max(0, Math.floor(randomValue * themeNames.length)))
        : 0
    return themeNames[randomIndex] || fallbackTheme
}

export const resolveInitialPreviewDevice = ({
    isNewEntry = false,
    storedDevice = '',
    random = Math.random,
} = {}) => {
    return storedDevice === 'mobile' ? 'mobile' : 'desktop'
}

const PUBLISH_NUDGE_MODAL = lang => {
    const t = getLangText(lang)
    return `
    <div class="modal publish-nudge-modal" role="dialog" aria-modal="true" aria-labelledby="publish-nudge-title" aria-hidden="true">
        <div class="modal-mask"></div>
        <div class="publish-nudge-content">
            <button type="button" class="close-btn publish-nudge-close" aria-label="${escapeHtml(t.later)}">x</button>
            <h2 id="publish-nudge-title">${escapeHtml(t.publishNudgeTitle)}</h2>
            <p>${escapeHtml(t.publishNudgeText)}</p>
            <fieldset class="publish-preferences">
                <legend class="sr-only">${escapeHtml(t.publishNudgeTitle)}</legend>
                <label class="publish-preference-row">
                    <input type="checkbox" class="publish-preference-input" data-publish-preference="publish" checked>
                    <span><strong>${escapeHtml(t.publishPreferencePublish)}</strong><small>${escapeHtml(t.publishPreferencePublishHelp)}</small></span>
                </label>
                <label class="publish-preference-row">
                    <input type="checkbox" class="publish-preference-input" data-publish-preference="autosave" checked>
                    <span><strong>${escapeHtml(t.publishPreferenceAutosave)}</strong><small>${escapeHtml(t.publishPreferenceAutosaveHelp)}</small></span>
                </label>
                <label class="publish-preference-row">
                    <input type="checkbox" class="publish-preference-input" data-publish-preference="publicIndex" checked>
                    <span><strong>${escapeHtml(t.publishPreferencePublicIndex)}</strong><small>${escapeHtml(t.publishPreferencePublicIndexHelp)}</small></span>
                </label>
            </fieldset>
            <p class="publish-preferences-note">${escapeHtml(t.publishPreferencesRemembered)}</p>
            <div class="publish-nudge-actions">
                <button type="button" class="opt-button publish-nudge-later">${escapeHtml(t.later)}</button>
                <button type="button" class="opt-button publish-nudge-publish">${escapeHtml(t.publishApplyChoices)}</button>
            </div>
        </div>
    </div>
    `
}

const EDITOR_PUBLICATION_STATUS = ({ lang, ext = {}, shareId = '' }) => {
    const t = getLangText(lang)
    const published = ext.share === true && Boolean(shareId)
    const safeVersionCount = Number.isSafeInteger(ext.versionCount) && ext.versionCount >= 0 ? ext.versionCount : null
    const safeViewCount = Number.isSafeInteger(ext.viewCount) && ext.viewCount >= 0 ? ext.viewCount : null
    const sharePath = published ? `/share/${encodeURIComponent(shareId)}` : ''

    return `<aside class="editor-publication-status" data-published="${published ? 'true' : 'false'}" aria-live="polite">
        <div class="publication-status-main">
            <button type="button" id="present-btn" class="publication-present-btn toolbar-icon-button" data-tooltip="${escapeHtml(t.presentTitle)}" title="${escapeHtml(t.presentTitle)}" aria-label="${escapeHtml(t.presentTitle)}">
                ${SVG_ICONS.play}
                <span class="toolbar-button-label">${escapeHtml(t.present)}</span>
            </button>
            <button type="button" id="editor-book-btn" class="publication-book-btn toolbar-icon-button" data-tooltip="${lang === 'zh-TW' ? '打開書本模式' : 'Open Book Mode'}" title="${lang === 'zh-TW' ? '打開書本模式' : 'Open Book Mode'}" aria-label="${lang === 'zh-TW' ? '打開書本模式' : 'Open Book Mode'}">
                ${SVG_ICONS.book}
                <span class="toolbar-button-label">${lang === 'zh-TW' ? '書本' : 'Book'}</span>
            </button>
            <span id="publication-state" class="publication-state ${published ? 'is-published' : 'is-draft'}">${escapeHtml(published ? t.publicationPublished : t.publicationDraft)}</span>
            <div class="publication-share-details" ${published ? '' : 'hidden'}>
                <span class="publication-label">${escapeHtml(t.publicationUrl)}</span>
                <a id="publication-share-url" href="${escapeHtml(sharePath || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(sharePath)}</a>
                <button type="button" id="publication-copy-url" class="publication-icon-button" aria-label="${escapeHtml(t.copy)}" title="${escapeHtml(t.copy)}">${SVG_ICONS.copy}</button>
                <button type="button" id="publication-public-index" class="publication-index-button ${ext.publicIndex === true ? 'is-indexed' : ''}" aria-pressed="${ext.publicIndex === true ? 'true' : 'false'}">${escapeHtml(ext.publicIndex === true ? t.publicIndexOn : t.publicIndexOff)}</button>
            </div>
        </div>
        <div class="publication-metrics" ${published ? '' : 'hidden'}>
            <span title="${escapeHtml(t.publicationVersions)}">${escapeHtml(t.publicationVersions)} <strong id="publication-version-count">${safeVersionCount ?? '—'}</strong></span>
            <span title="${escapeHtml(t.publicationViews)}">${escapeHtml(t.publicationViews)} <strong id="publication-view-count">${safeViewCount ?? '—'}</strong></span>
            <span title="${escapeHtml(t.publicationUpdated)}">${escapeHtml(t.publicationUpdated)} <time id="publication-updated-at" datetime="${escapeHtml(ext.updateAt || '')}">—</time></span>
        </div>
        <span class="publication-pending-hint" ${published ? 'hidden' : ''}>${escapeHtml(t.publicationPendingHint)}</span>
    </aside>`
}

export const HTML = ({ lang, title, content = '', ext = {}, tips, isEdit, showPwPrompt, path, shareId }) => {
    const gaMeasurementId = ext.gaMeasurementId ? String(ext.gaMeasurementId).trim() : ''
    const initialShareFont = ext.shareFont === 'maple' ? 'maple' : 'jetbrains'
    const isEmbed = ext.embed === true
    const htmlLang = lang === 'zh-TW' ? 'zh-Hant-TW' : 'en'
    const ogLocale = lang === 'zh-TW' ? 'zh_TW' : 'en_US'
    const isSharePage = Boolean(shareId && !isEdit)
    const isBurnInterstitial = isSharePage && ext.shareBurnAfterReading === true && !ext.isAuthor && !ext.burnUnlocked
    const effectiveEditorFormat = resolveEditorFormat(ext, content)
    const isBlockDocument = effectiveEditorFormat === 'block'
    const isCanvasDocument = effectiveEditorFormat === 'canvas'
    const isWhiteboardDocument = effectiveEditorFormat === 'whiteboard'
    const blockHtml = isBlockDocument ? String(ext.blockHtml || '<p></p>') : ''
    const accessibleContent = isBurnInterstitial
        ? ''
        : (isBlockDocument
            ? blockHtml
            : isCanvasDocument
                ? escapeHtml(ext.canvasMarkdown || '')
                : isWhiteboardDocument
                    ? escapeHtml(ext.whiteboardMarkdown || '')
                    : escapeHtml(content))
    const textareaContent = isBurnInterstitial ? '' : escapeHtml(content)
    const pageTheme = (isBlockDocument || isCanvasDocument || isWhiteboardDocument)
        ? (ext.theme || (isWhiteboardDocument ? 'claude-canvas' : 'ayu-light'))
        : resolvePageTheme({
            randomize: isEdit && ext.isNewEntry === true,
            storedTheme: ext.theme,
        })
    const initialEditorPreviewDevice = isEdit && ext.isNewEntry === true
        ? resolveInitialPreviewDevice({ isNewEntry: true, storedDevice: ext.previewDevice })
        : ''
    const annotationsEnabled = resolveAnnotationsEnabled(ext)
    const annotationsUiEnabled = isSharePage && !isEmbed && annotationsEnabled
    const pageDescription = ext.meta?.description || tips || title || APP_NAME
    const ogSiteNameMeta = ext.meta?.siteName === false
        ? ''
        : `<meta property="og:site_name" content="${escapeHtml(ext.meta?.siteName || DEFAULT_OG_SITE_NAME)}" />`
    const structuredData = ext.meta?.canonicalUrl
        ? JSON.stringify({
            '@context': 'https://schema.org',
            '@type': ext.meta?.ogType === 'article' ? 'Article' : 'WebPage',
            name: title || APP_NAME,
            description: pageDescription,
            url: ext.meta.canonicalUrl,
            ...(ext.meta?.ogImageUrl ? { image: ext.meta.ogImageUrl } : {}),
        }).replace(/</g, '\\u003c')
        : ''
    const gaScript = gaMeasurementId ? `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(gaMeasurementId)}"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', ${JSON.stringify(gaMeasurementId)});
    </script>` : ''
    const webtalkScript = isSharePage ? `
    <script
        defer
        src="https://webtalk-nine.vercel.app/webtalk.js"
        data-webtalk-scope="origin"
        data-webtalk-ai-endpoint="https://webtalk-nine.vercel.app/api/webtalk/ai">
    </script>` : ''

    return `
<!DOCTYPE html>
<html lang="${htmlLang}">
    <script>
        (function() {
            try {
                var t = localStorage.getItem('cf-notepad-ui-theme') || 'auto';
                if (t === 'dark' || (t === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.setAttribute('data-ui-theme', 'dark');
                } else if (t === 'light') {
                    document.documentElement.setAttribute('data-ui-theme', 'light');
                } else {
                    document.documentElement.setAttribute('data-ui-theme', 'auto');
                }
            } catch(e) {}
        })();
    </script>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} - ${escapeHtml(APP_NAME)}</title>
    <meta name="description" content="${escapeHtml(pageDescription)}" />
    <meta name="robots" content="${escapeHtml(ext.meta?.robots || 'noindex,nofollow')}" />
    <meta name="theme-color" content="#0f172a" />
    <link rel="manifest" href="/app.webmanifest" />
    <script>window.__deferredPwaPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__deferredPwaPrompt=e;if(typeof window.__onPwaPromptReady==='function'){window.__onPwaPromptReady(e);}});</script>
    ${isSharePage ? `<meta name="webtalk-page-id" content="${escapeHtml(shareId)}" />` : ''}
    ${webtalkScript}
    ${ogSiteNameMeta}
    ${ext.meta?.canonicalUrl ? `<meta property="og:locale" content="${ogLocale}" />` : ''}
    <meta property="og:type" content="${escapeHtml(ext.meta?.ogType || 'website')}" />
    <meta property="og:title" content="${escapeHtml(title || APP_NAME)}" />
    <meta property="og:description" content="${escapeHtml(pageDescription)}" />
    <meta name="twitter:card" content="${escapeHtml(ext.meta?.twitterCard || 'summary')}" />
    <meta name="twitter:title" content="${escapeHtml(title || APP_NAME)}" />
    <meta name="twitter:description" content="${escapeHtml(pageDescription)}" />
    <link rel="stylesheet" href="https://ka-f.webawesome.com/webawesome@${WEB_AWESOME_VERSION}/styles/webawesome.css" />
    ${annotationsUiEnabled ? '<link rel="stylesheet" href="/css/share-annotations.css" />' : ''}
    ${isEdit && isBlockDocument ? '<link rel="stylesheet" href="/js/block-editor.bundle.css" />' : ''}
    ${isCanvasDocument ? '<link rel="stylesheet" href="/js/canvas-editor.bundle.css?v=3.9" />' : ''}
    ${isWhiteboardDocument ? '<link rel="stylesheet" href="/js/whiteboard-editor.bundle.css?v=1.2" />' : ''}
    <script type="module" src="https://ka-f.webawesome.com/webawesome@${WEB_AWESOME_VERSION}/webawesome.loader.js"></script>
    ${ext.meta?.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(ext.meta.canonicalUrl)}" />` : ''}
    ${ext.meta?.canonicalUrl ? `<meta property="og:url" content="${escapeHtml(ext.meta.canonicalUrl)}" />` : ''}
    ${ext.meta?.ogImageUrl ? `<meta property="og:image" content="${escapeHtml(ext.meta.ogImageUrl)}" />` : ''}
    ${ext.meta?.ogImageUrl ? `<meta property="og:image:secure_url" content="${escapeHtml(ext.meta.ogImageUrl)}" />` : ''}
    ${ext.meta?.ogImageUrl ? '<meta property="og:image:type" content="image/png" />' : ''}
    ${ext.meta?.ogImageUrl ? '<meta property="og:image:width" content="1200" />' : ''}
    ${ext.meta?.ogImageUrl ? '<meta property="og:image:height" content="630" />' : ''}
    ${ext.meta?.ogImageUrl ? `<meta property="og:image:alt" content="${escapeHtml(ext.meta?.ogImageAlt || title || APP_NAME)}" />` : ''}
    ${ext.meta?.ogImageUrl ? `<meta name="twitter:image" content="${escapeHtml(ext.meta.ogImageUrl)}" />` : ''}
    ${ext.meta?.ogImageUrl ? `<meta name="twitter:image:alt" content="${escapeHtml(ext.meta?.ogImageAlt || title || APP_NAME)}" />` : ''}
    ${structuredData ? `<script type="application/ld+json">${structuredData}</script>` : ''}
    <style>
${getBaseCss()}
${getEditorCss()}
${getMarkdownCss()}
    </style>
    <style id="theme-style">${THEMES[pageTheme] || ''}</style>
    <style>
        #preview-md.markdown-body,
        #preview-plain.markdown-body {
            max-width: var(--preview-max-width);
            margin-left: auto;
            margin-right: auto;
            width: 100%;
        }

        /* Themes may set their own font-family.  In the edit preview, keep the
           same CJK-aware stack as the Markdown editor after the theme loads. */
        body:not(.share-view) #preview-md.markdown-body,
        body:not(.share-view) #preview-plain.markdown-body,
        body:not(.share-view) #preview-md.markdown-body :is(
            p, li, dd, dt, blockquote, strong, b, em, i, del, s, strike, mark, small,
            span, a, figcaption, summary, table, thead, tbody, tfoot, tr, th, td,
            ul, ol, dl, h1, h2, h3, h4, h5, h6, code, pre
        ),
        body:not(.share-view) #preview-plain.markdown-body :is(
            p, li, dd, dt, blockquote, strong, b, em, i, del, s, strike, mark, small,
            span, a, figcaption, summary, table, thead, tbody, tfoot, tr, th, td,
            ul, ol, dl, h1, h2, h3, h4, h5, h6, code, pre
        ) {
            font-family: var(--editor-font-family);
        }

        body.share-view #preview-md.markdown-body,
        body.share-view #preview-plain.markdown-body {
            font-size: 16px;
            line-height: 1.8;
        }

        body.share-view #preview-md.markdown-body h1,
        body.share-view #preview-plain.markdown-body h1 {
            font-size: 2em;
        }

        body.share-view #preview-md.markdown-body h2,
        body.share-view #preview-plain.markdown-body h2 {
            font-size: 1.55em;
        }

        body.share-view #preview-md.markdown-body h3,
        body.share-view #preview-plain.markdown-body h3 {
            font-size: 1.28em;
        }

        body.share-view #preview-md.markdown-body h4,
        body.share-view #preview-plain.markdown-body h4,
        body.share-view #preview-md.markdown-body h5,
        body.share-view #preview-plain.markdown-body h5,
        body.share-view #preview-md.markdown-body h6,
        body.share-view #preview-plain.markdown-body h6 {
            font-size: 1em;
        }

        body.share-view #preview-md.markdown-body code,
        body.share-view #preview-plain.markdown-body code {
            font-size: 0.92em;
        }

        body.share-view #preview-md.markdown-body pre code,
        body.share-view #preview-plain.markdown-body pre code {
            font-size: 0.92em;
        }

        body.share-view.share-font-jetbrains {
            --share-font-family: var(--share-font-jetbrains-family);
        }

        body.share-view.share-font-maple {
            --share-font-family: var(--share-font-maple-family);
        }

        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-md,
        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-plain,
        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-md.markdown-body,
        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-plain.markdown-body,
        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-md.markdown-body :is(
            p, li, dd, dt, blockquote, strong, b, em, i, del, s, strike, mark, small,
            span, a, figcaption, summary, table, thead, tbody, tfoot, tr, th, td,
            ul, ol, dl, h1, h2, h3, h4, h5, h6
        ),
        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-md.markdown-body code,
        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-md.markdown-body pre,
        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-md.markdown-body pre code,
        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-plain.markdown-body code {
            font-family: var(--share-font-family);
        }

        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-plain.markdown-body :is(
            p, li, dd, dt, blockquote, strong, b, em, i, del, s, strike, mark, small,
            span, a, figcaption, summary, table, thead, tbody, tfoot, tr, th, td,
            ul, ol, dl, h1, h2, h3, h4, h5, h6
        ),
        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-plain.markdown-body pre,
        body.share-view:is(.share-font-jetbrains, .share-font-maple) #preview-plain.markdown-body pre code {
            font-family: var(--share-font-family);
        }

        #preview-md.markdown-body thead th,
        #preview-plain.markdown-body thead th {
            font-weight: 800;
            letter-spacing: 0.035em;
            box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.12);
        }
    </style>
    <link rel="icon" href="${PUBLIC_ICON_SVG_URL}" type="image/svg+xml" />
    <link rel="alternate icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="apple-touch-icon" href="${PUBLIC_ICON_PNG_URL}" />
    ${gaScript}
</head>
<body class="${ext.sharePath && !isEdit ? `share-view share-font-${initialShareFont}${isEmbed ? ' share-embed' : ''}` : ''}">
    <div class="note-container">
        <div class="stack">
            <div class="layer_1">
                <div class="layer_2">
                    ${isEdit && !isBlockDocument && !isCanvasDocument && !isWhiteboardDocument ? EDITOR_TOOLBAR(lang) : ''}
                    <div class="layer_3">
                        ${tips ? `<div class="tips">${tips}</div>` : ''}
                        ${ext.sharePath && !isEdit ? `<h1 class="sr-only">${escapeHtml(title || APP_NAME)}</h1>` : ''}
                        ${isSharePage && ext.isAuthor ? `
                            <div class="share-author-preview-banner">
                                <span class="author-banner-badge">👑 ${escapeHtml(
                                    ext.shareMode === 'timelock'
                                        ? (SUPPORTED_LANG[lang].authorTimeLockPreview || 'Time-Locked Capsule Preview: unlocks at {time}').replace('{time}', ext.shareUnlockAt ? new Date(ext.shareUnlockAt * 1000).toLocaleString() : '')
                                        : ext.shareMode === 'deadman'
                                        ? (SUPPORTED_LANG[lang].authorDeadmanPreview || "Dead Man's Switch Preview: next pulse due {time}").replace('{time}', ext.sharePulseDueAt ? new Date(ext.sharePulseDueAt * 1000).toLocaleString() : '')
                                        : (SUPPORTED_LANG[lang].authorPreviewNotice || 'Author Preview')
                                )}</span>
                                ${ext.shareExpiresAt ? `<span class="author-banner-time">⏳ ${formatShareRemainingTime(ext.shareExpiresAt, lang)}</span>` : ''}
                                ${ext.shareMode === 'deadman' ? `<button type="button" class="opt-button opt-button-accent author-pulse-btn" style="height:26px;font-size:12px;padding:0 8px;margin-left:8px;" onclick="fetch('/api/shares/' + encodeURIComponent('${escapeHtml(shareId)}') + '/pulse', {method:'POST'}).then(function() { window.location.reload(); })">${escapeHtml(SUPPORTED_LANG[lang].pulseNowBtn || 'Pulse Now')}</button>` : ''}
                                ${path ? `<a href="/${escapeHtml(path)}" class="author-banner-edit">✏️ ${lang === 'zh-TW' ? '返回編輯' : 'Back to Editor'}</a>` : ''}
                            </div>
                        ` : ''}
                        ${isSharePage && ext.deadmanReleased ? `
                            <div class="share-deadman-released-banner">
                                <span>⚠️ ${lang === 'zh-TW' ? '亡者開關已觸發解鎖：作者超期未簽到保活，筆記已自動解除 Seal 並向公眾公開。' : 'Dead Man\'s Switch Triggered: The author missed the check-in deadline. Note unsealed and released to public.'}</span>
                            </div>
                        ` : ''}
                        ${isSharePage && ext.burnActiveNotice ? `
                            <div class="share-burn-active-banner">
                                <span>🔥 ${escapeHtml(SUPPORTED_LANG[lang].burnActiveNotice || 'This note has self-destructed and cannot be re-opened.')}</span>
                            </div>
                        ` : ''}
                        ${isBurnInterstitial ? `
                            <div class="share-burn-interstitial">
                                <div class="burn-interstitial-card">
                                    <div class="burn-card-icon">🔥</div>
                                    <h2 class="burn-card-title">${escapeHtml(SUPPORTED_LANG[lang].burnRevealTitle || 'Burn After Reading')}</h2>
                                    <p class="burn-card-desc">${escapeHtml(SUPPORTED_LANG[lang].burnRevealDesc || 'This secret note will self-destruct permanently after being read once.')}</p>
                                    <form method="POST" action="/share/${escapeHtml(shareId)}${ext.presentationEntry ? '/present' : (ext.bookMode ? '/book' : '')}/reveal">
                                        <button type="submit" class="burn-reveal-btn" id="burn-reveal-btn">
                                            <span>🔓</span>
                                            <span>${escapeHtml(SUPPORTED_LANG[lang].burnRevealBtn || 'Click to Reveal Note')}</span>
                                        </button>
                                    </form>
                                    <p class="burn-card-warning">${escapeHtml(SUPPORTED_LANG[lang].burnRevealWarning || 'Warning: Once revealed, the share link becomes invalid immediately.')}</p>
                                </div>
                            </div>
                        ` : ''}
                        <article style="display:none;" id="bot-accessible-content">${accessibleContent}</article>
                        ${isBurnInterstitial ? '' : (isWhiteboardDocument ? `<div class="editor-pane whiteboard-editor-pane">
                            <div id="whiteboard-editor" class="whiteboard-editor" aria-label="Whiteboard" data-editable="${isEdit}"></div>
                            <textarea id="contents" class="contents hide" spellcheck="false" aria-hidden="true">${textareaContent}</textarea>
                        </div>` : (isCanvasDocument ? `<div class="editor-pane canvas-editor-pane">
                            <div id="canvas-editor" class="canvas-editor" aria-label="Canvas" data-editable="${isEdit}"></div>
                            <textarea id="contents" class="contents hide" spellcheck="false" aria-hidden="true">${textareaContent}</textarea>
                        </div>` : (isEdit ? (isBlockDocument ? `<div class="editor-pane block-editor-pane">
                            <div id="block-editor" class="block-editor" aria-label="Block editor"></div>
                            <textarea id="contents" class="contents hide" spellcheck="false" aria-hidden="true">${textareaContent}</textarea>
                        </div>` : `<div class="editor-pane">
                            <div id="editor-search-bar" class="editor-search-bar hide" role="search" aria-label="${lang === 'zh-TW' ? '搜尋與取代' : 'Search and Replace'}">
                                <div class="editor-search-row">
                                    <div class="editor-search-input-wrap">
                                        <span class="search-icon">${SVG_ICONS.search}</span>
                                        <input type="text" id="editor-search-input" class="editor-search-field" placeholder="${lang === 'zh-TW' ? '搜尋 (Enter 往下，Shift+Enter 往上)' : 'Find (Enter next, Shift+Enter prev)'}" autocomplete="off" />
                                        <span id="editor-search-count" class="editor-search-count">0 / 0</span>
                                    </div>
                                    <div class="editor-search-options">
                                        <button type="button" id="editor-search-case" class="search-opt-btn" title="${lang === 'zh-TW' ? '區分大小寫 (Aa)' : 'Match Case (Aa)'}" aria-label="Match Case">Aa</button>
                                        <button type="button" id="editor-search-word" class="search-opt-btn" title="${lang === 'zh-TW' ? '全字匹配 (\\b)' : 'Match Whole Word (\\b)'}" aria-label="Match Whole Word">\\b</button>
                                        <button type="button" id="editor-search-regex" class="search-opt-btn" title="${lang === 'zh-TW' ? '正規表達式 (.*)' : 'Use Regex (.*)'}" aria-label="Use Regex">.*</button>
                                    </div>
                                    <div class="editor-search-nav">
                                        <button type="button" id="editor-search-prev" class="search-nav-btn" title="${lang === 'zh-TW' ? '上一個 (Shift+Enter)' : 'Previous match'}" aria-label="Previous">▲</button>
                                        <button type="button" id="editor-search-next" class="search-nav-btn" title="${lang === 'zh-TW' ? '下一個 (Enter)' : 'Next match'}" aria-label="Next">▼</button>
                                        <button type="button" id="editor-search-toggle-replace" class="search-nav-btn" title="${lang === 'zh-TW' ? '切換取代面板' : 'Toggle Replace'}" aria-label="Toggle Replace">⇄</button>
                                        <button type="button" id="editor-search-close" class="search-close-btn" title="${lang === 'zh-TW' ? '關閉 (Esc)' : 'Close'}" aria-label="Close">✕</button>
                                    </div>
                                </div>
                                <div id="editor-replace-row" class="editor-replace-row hide">
                                    <input type="text" id="editor-replace-input" class="editor-search-field" placeholder="${lang === 'zh-TW' ? '取代為...' : 'Replace with...'}" autocomplete="off" />
                                    <div class="editor-replace-actions">
                                        <button type="button" id="editor-replace-btn" class="search-action-btn">${lang === 'zh-TW' ? '取代' : 'Replace'}</button>
                                        <button type="button" id="editor-replace-all-btn" class="search-action-btn">${lang === 'zh-TW' ? '全部取代' : 'Replace All'}</button>
                                    </div>
                                </div>
                            </div>
                            <div class="editor-code-shell">
                                <div id="editor-alert-autocomplete" class="editor-alert-autocomplete hide" role="listbox" aria-label="GitHub Alert types">
                                    <div class="alert-option" data-alert-type="NOTE">
                                        <span class="alert-badge note">ℹ️ NOTE</span> <span class="alert-desc">${lang === 'zh-TW' ? '重點資訊與備註' : 'Useful information'}</span>
                                    </div>
                                    <div class="alert-option" data-alert-type="TIP">
                                        <span class="alert-badge tip">💡 TIP</span> <span class="alert-desc">${lang === 'zh-TW' ? '實用技巧與建議' : 'Helpful advice'}</span>
                                    </div>
                                    <div class="alert-option" data-alert-type="IMPORTANT">
                                        <span class="alert-badge important">💬 IMPORTANT</span> <span class="alert-desc">${lang === 'zh-TW' ? '關鍵要求與步驟' : 'Crucial information'}</span>
                                    </div>
                                    <div class="alert-option" data-alert-type="WARNING">
                                        <span class="alert-badge warning">⚠️ WARNING</span> <span class="alert-desc">${lang === 'zh-TW' ? '警示與注意事項' : 'Urgent notice'}</span>
                                    </div>
                                    <div class="alert-option" data-alert-type="CAUTION">
                                        <span class="alert-badge caution">🛑 CAUTION</span> <span class="alert-desc">${lang === 'zh-TW' ? '危險與潛在風險' : 'Negative consequences'}</span>
                                    </div>
                                </div>
                                <div id="editor-line-mirror" class="editor-line-mirror" aria-hidden="true"></div>
                                <div id="editor-line-numbers" class="editor-line-numbers" aria-hidden="true"></div>
                                <textarea id="contents" class="contents" spellcheck="false" placeholder="${SUPPORTED_LANG[lang].emptyPH}">${escapeHtml(content)}</textarea>
                                ${isEdit && !isBlockDocument ? '<div id="editor-welcome" class="editor-welcome" aria-hidden="true" hidden></div>' : ''}
                            </div>
                            <div id="editor-status" class="editor-status" aria-live="polite"></div>
                        </div>`) : '<textarea id="contents" class="contents hide" spellcheck="false">' + textareaContent + '</textarea>')))}
                        ${!isBurnInterstitial && ((isEdit && !isBlockDocument && !isCanvasDocument && !isWhiteboardDocument && (ext.mode || 'md') === 'md') ? '<div class="divide-line"></div>' : '')}
                        ${isBurnInterstitial || isCanvasDocument || isWhiteboardDocument || tips || (isEdit && (isBlockDocument || (ext.mode || 'md') !== 'md')) ? '' : (
                            isEdit
                                ? `<div class="preview-pane">${!isBlockDocument ? '<div id="preview-welcome" class="editor-welcome preview-welcome" aria-hidden="true" hidden></div>' : ''}<div id="preview-${(ext.mode || 'md') === 'md' ? 'md' : 'plain'}" class="contents markdown-body"></div>${EDITOR_PUBLICATION_STATUS({ lang, ext, shareId })}</div>`
                                : `<div id="preview-${(ext.mode || 'md') === 'md' ? 'md' : 'plain'}" class="contents markdown-body">${isBlockDocument ? blockHtml : ''}</div>`
                        )}
                    </div>
                </div>
            </div>
        </div>
        ${isEmbed ? '' : FOOTER({ ...ext, mode: ext.mode || 'md', isEdit, lang, path, shareId, sharePath: ext.sharePath, autosave: ext.autosave === true, annotationsEnabled, theme: pageTheme, editorFormat: isWhiteboardDocument ? 'whiteboard' : (isCanvasDocument ? 'canvas' : (isBlockDocument ? 'block' : 'markdown')) })}
    </div>
    ${annotationsUiEnabled ? `<div id="share-annotation-root" data-share-id="${escapeHtml(shareId)}" data-lang="${escapeHtml(lang)}"></div>` : ''}
    ${ext.sharePath && !isEdit && !isEmbed ? '<button type="button" id="share-back-to-top" class="share-back-to-top" aria-label="Back to top">＾</button>' : ''}
    <div id="loading"></div>
    ${isEmbed ? `
    <script>
        (() => {
            const sendEmbedHeight = () => {
                const height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
                window.parent.postMessage({ type: 'cf-notepad:embed-resize', height }, '*');
            };
            if (window.ResizeObserver) new ResizeObserver(sendEmbedHeight).observe(document.body);
            window.addEventListener('load', sendEmbedHeight);
            window.addEventListener('resize', sendEmbedHeight);
            sendEmbedHeight();
        })();
    \u003c/script\u003e
    ` : ''}
    ${MODAL(lang, { noteHistoryEnabled: ext.noteHistoryEnabled === true && isEdit })}
    ${isEmbed ? '' : EDITOR_PREFERENCE_MODAL(lang)}
    ${URL_IMPORT_MODAL(lang)}
    ${MATH_FORMAT_MODAL(lang)}
    ${CITE_MODAL(lang)}
    ${isEdit ? VAULT_PRESETS_MODAL(lang) : ''}
    ${isEdit ? PUBLISH_NUDGE_MODAL(lang) : ''}
    ${((ext.mode || 'md') === 'md' || ext.share || !isEdit) ? `
    <script src="${CDN_PREFIX}/dompurify@3.0.6/dist/purify.min.js"></script>
    <script src="/js/marked.min.js"></script>
    ` : ''}
    
    <!-- KaTeX CSS -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    
    <!-- Remark / Unified Ecosystem -->
    ${!isBlockDocument && ((ext.mode || 'md') === 'md' || !isEdit) ? `
    <script type="module">
        import { unified } from 'https://esm.sh/unified@11.0.4?bundle';
        import remarkParse from 'https://esm.sh/remark-parse@11.0.0?bundle';
        import remarkGfm from 'https://esm.sh/remark-gfm@4.0.0?bundle';
        import remarkMath from 'https://esm.sh/remark-math@6.0.0?bundle';
        import remarkRehype from 'https://esm.sh/remark-rehype@11.1.0?bundle';
        import rehypeKatex from 'https://esm.sh/rehype-katex@7.0.0?bundle';
        import rehypeStringify from 'https://esm.sh/rehype-stringify@10.0.0?bundle';
        import remarkBreaks from 'https://esm.sh/remark-breaks@4.0.0?bundle';
        import { decorateColumnLayouts, expandHackmdImageSizes, expandPandocCitations, expandTextHighlights, expandCustomColors, expandMarkdownExtensions, decorateFootnoteAndCitationPopovers, decorateCodeBlocks, parseBookToc, htmlOrTsvToMarkdownTable, expandInlineFootnotes, protectCurrencyDollarSigns } from '/js/markdown-extensions.mjs';
        import { visit } from 'https://esm.sh/unist-util-visit@5.0.0?bundle';
        import { decorateMediaPreviews } from '/js/media-preview.mjs';

        // GitHub Alerts Plugin
        function remarkGithubAlerts() {
            return (tree) => {
                visit(tree, 'blockquote', (node) => {
                    const paragraph = node.children[0];
                    if (paragraph && paragraph.type === 'paragraph' && paragraph.children[0] && paragraph.children[0].type === 'text') {
                        const text = paragraph.children[0].value;
                        const match = text.match(new RegExp('^\\\\x5B!([A-Z]+)\\\\x5D'));
                        if (match) {
                            const alertType = match[1];
                            const typeLower = alertType.toLowerCase();
                            
                            node.data = node.data || {};
                            node.data.hProperties = node.data.hProperties || {};
                            node.data.hProperties.className = ['markdown-alert', 'markdown-alert-' + typeLower];
                            
                            const markerLength = match[0].length;
                            let newText = text.slice(markerLength);
                            
                            if (!newText.trim()) {
                                paragraph.children.shift();
                            } else {
                                paragraph.children[0].value = newText;
                            }
                        }
                    }
                });
            };
        }

        // Diagram Detection Plugin
        function remarkDiagramPlugin() {
            return (tree) => {
                visit(tree, 'code', (node, index, parent) => {
                    const lang = node.lang;
                    if (!lang) return;
                    
                    let type = null;
                    if (lang === 'mermaid') type = 'mermaid';
                    else if (lang === 'sequence') type = 'sequence';
                    else if (lang === 'flow') type = 'flow';
                    else if (lang === 'graphviz') type = 'graphviz';
                    else if (lang === 'abc') type = 'abc';
                    else if (lang === 'echarts') type = 'echarts';
                    
                    if (type) {
                        const safeValue = node.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                        parent.children[index] = {
                            type: 'html',
                            value: \`<div class="diagram-block-wrapper diagram-\${type}-wrapper"><div class="diagram-\${type}-container diagram-source" style="display:none">\${safeValue}</div><div class="diagram-\${type}-render" data-diagram-type="\${type}"></div></div>\`
                        };
                    }
                });
            };
        }

        const processor = unified()
            .use(remarkParse)
            .use(remarkGithubAlerts)
            .use(remarkDiagramPlugin)
            .use(remarkGfm)
            .use(remarkMath)
            .use(remarkBreaks)
            .use(remarkRehype, { allowDangerousHtml: true })
            .use(rehypeKatex)
            .use(rehypeStringify, { allowDangerousHtml: true });

        const slugifyHeading = value => String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .replace(/['"“”‘’]/g, '')
            .replace(/[()[\\]{}<>《》「」『』【】（）]/g, ' ')
            .replace(/[!#$%&*+,./:;=?@\\\\^|~，。！？、：；]/g, '')
            .replace(/\\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const slugifyCompactHeading = value => String(value || '')
            .trim()
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .replace(/['"“”‘’]/g, '')
            .replace(/[【】「」『』《》]/g, '')
            .replace(/[()[\\]{}<>（）]/g, ' ')
            .replace(/[!#$%&*+,./:;=?@\\\\^|~，。！？、：；]/g, '')
            .replace(/\\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        const getHeadingSlugAliases = text => {
            const aliases = [slugifyCompactHeading(text), slugifyHeading(text)];
            return aliases.filter((alias, index) => alias && aliases.indexOf(alias) === index);
        };

        const decorateHeadingAnchors = node => {
            if (!node) return;
            const seen = new Map();
            node.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
                if (heading.classList.contains('sr-only') || heading.classList.contains('visually-hidden') || heading.getAttribute('aria-hidden') === 'true') return;
                if (heading.closest('.footnotes, [data-footnotes]')) return;
                const aliases = getHeadingSlugAliases(heading.textContent);
                const baseId = aliases[0];
                if (!baseId) return;
                const count = seen.get(baseId) || 0;
                seen.set(baseId, count + 1);
                const headingId = count ? baseId + '-' + count : baseId;
                heading.id = headingId;
                heading.style.scrollMarginTop = '18px';
                aliases.slice(1).forEach(alias => {
                    const aliasId = count ? alias + '-' + count : alias;
                    if (!aliasId || aliasId === headingId || document.getElementById(aliasId)) return;
                    const anchor = document.createElement('span');
                    anchor.id = aliasId;
                    anchor.className = 'heading-anchor-alias';
                    anchor.setAttribute('aria-hidden', 'true');
                    heading.parentNode.insertBefore(anchor, heading);
                });
            });
        };

        const renderTableOfContents = node => {
            if (!node) return;
            const placeholders = Array.from(node.querySelectorAll('p')).filter(paragraph =>
                paragraph.textContent.trim().toUpperCase() === '[TOC]'
            );
            if (!placeholders.length) return;

            const headings = Array.from(node.querySelectorAll('h1, h2, h3, h4, h5, h6'))
                .filter(heading => {
                    if (!heading.id) return false;
                    if (heading.classList.contains('sr-only') || heading.classList.contains('visually-hidden') || heading.getAttribute('aria-hidden') === 'true') return false;
                    if (heading.closest('.footnotes, [data-footnotes]')) return false;
                    return true;
                });
            if (!headings.length) return;

            placeholders.forEach(paragraph => {
                const toc = document.createElement('nav');
                toc.className = 'markdown-toc';
                toc.setAttribute('aria-label', 'Table of contents');

                const rootList = document.createElement('ol');
                rootList.className = 'markdown-toc-list';
                toc.append(rootList);

                const baseLevel = Math.min(...headings.map(heading => Number(heading.tagName.slice(1))));
                const stack = [{ level: baseLevel, list: rootList, lastItem: null }];

                headings.forEach(heading => {
                    const level = Number(heading.tagName.slice(1));
                    while (stack.length > 1 && level < stack[stack.length - 1].level) stack.pop();

                    const current = stack[stack.length - 1];
                    if (level > current.level && current.lastItem) {
                        const nestedList = document.createElement('ol');
                        nestedList.className = 'markdown-toc-list';
                        current.lastItem.append(nestedList);
                        stack.push({ level, list: nestedList, lastItem: null });
                    }

                    const target = stack[stack.length - 1];
                    const item = document.createElement('li');
                    const anchor = document.createElement('a');
                    anchor.className = 'markdown-toc-link';
                    anchor.href = '#' + heading.id;
                    anchor.textContent = heading.textContent;
                    item.append(anchor);
                    target.list.append(item);
                    target.lastItem = item;
                });

                paragraph.replaceWith(toc);
            });
        };

        const openShareContentLinksInNewTab = node => {
            if (!node || !document.body.classList.contains('share-view')) return;
            node.querySelectorAll('a[href]').forEach(anchor => {
                const href = anchor.getAttribute('href') || '';
                if (!href || href.startsWith('#') || /^javascript:/i.test(href)) return;
                anchor.setAttribute('target', '_blank');
                anchor.setAttribute('rel', 'noopener noreferrer');
            });
        };

        const scrollToLocationHash = () => {
            if (!location.hash) return;
            let targetId = '';
            try {
                targetId = decodeURIComponent(location.hash.slice(1));
            } catch (e) {
                targetId = location.hash.slice(1);
            }
            if (!targetId) return;
            const escapedId = window.CSS && CSS.escape ? CSS.escape(targetId) : targetId.replace(/"/g, '\\\\"');
            let target = document.getElementById(targetId) || document.querySelector('[name="' + escapedId + '"]');
            if (!target && !targetId.startsWith('user-content-')) {
                target = document.getElementById('user-content-' + targetId);
            }
            if (!target && targetId.startsWith('user-content-')) {
                target = document.getElementById(targetId.replace('user-content-', ''));
            }
            if (!target && (targetId === 'footnotes' || targetId === 'footnote-label')) {
                target = document.querySelector('.footnotes, [data-footnotes]');
            }
            if (!target) return;

            if (target.classList.contains('sr-only') || target.classList.contains('visually-hidden') || target.getAttribute('aria-hidden') === 'true') {
                target = target.closest('.footnotes, [data-footnotes]') || target.parentElement || target;
            }

            const scrollParent = target.closest('.contents') || document.scrollingElement || document.documentElement;
            if (scrollParent === document.scrollingElement || scrollParent === document.documentElement || scrollParent === document.body) {
                const top = target.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0) - 18;
                window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            } else {
                const parentRect = scrollParent.getBoundingClientRect();
                const targetRect = target.getBoundingClientRect();
                const top = targetRect.top - parentRect.top + scrollParent.scrollTop - 18;
                scrollParent.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
            }
        };

        const scheduleHashScroll = () => {
            [0, 100, 350, 900].forEach(delay => window.setTimeout(scrollToLocationHash, delay));
        };

        const loadScript = (src) => new Promise((resolve, reject) => {
            if (document.querySelector(\`script[src = "\${src}"]\`)) return resolve();
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });

        const attachDiagramActions = (renderNode, rawCode, type) => {
            if (!renderNode) return;
            const wrapper = renderNode.closest('.diagram-block-wrapper') || renderNode.parentElement;
            if (!wrapper || wrapper.querySelector('.diagram-toolbar')) return;

            const zh = APP_STATE.lang === 'zh-TW';
            const toolbar = document.createElement('div');
            toolbar.className = 'diagram-toolbar';
            toolbar.setAttribute('role', 'toolbar');
            toolbar.setAttribute('aria-label', zh ? '圖表操作工具列' : 'Diagram action toolbar');

            const btnCode = document.createElement('button');
            btnCode.type = 'button';
            btnCode.className = 'diagram-btn diagram-btn-code';
            btnCode.title = zh ? '複製原始碼' : 'Copy Source Code';
            btnCode.setAttribute('aria-label', zh ? '複製原始碼' : 'Copy Source Code');
            btnCode.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><span>' + (zh ? '代碼' : 'Code') + '</span>';
            btnCode.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(rawCode);
                    } else {
                        const ta = document.createElement('textarea');
                        ta.value = rawCode;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        ta.remove();
                    }
                    btnCode.classList.add('is-copied');
                    const origHtml = btnCode.innerHTML;
                    btnCode.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span>' + (zh ? '已複製！' : 'Copied!') + '</span>';
                    setTimeout(() => {
                        btnCode.classList.remove('is-copied');
                        btnCode.innerHTML = origHtml;
                    }, 2000);
                    if (typeof window.showToast === 'function') {
                        window.showToast(zh ? '已複製圖表原始碼' : 'Diagram code copied');
                    }
                } catch (err) {
                    console.error('Failed to copy diagram code:', err);
                    if (typeof window.showToast === 'function') {
                        window.showToast(zh ? '複製失敗' : 'Copy failed');
                    }
                }
            });
            toolbar.appendChild(btnCode);

            const getPngBlob = async () => {
                const svgEl = renderNode.querySelector('svg');
                const canvasEl = renderNode.querySelector('canvas');
                if (canvasEl) {
                    return new Promise((resolve, reject) => {
                        canvasEl.toBlob((blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error('Canvas toBlob failed'));
                        }, 'image/png');
                    });
                }
                if (svgEl) {
                    try {
                        const svgClone = svgEl.cloneNode(true);
                        if (!svgClone.getAttribute('xmlns')) {
                            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                        }
                        const rect = svgEl.getBoundingClientRect();
                        let width = rect.width;
                        let height = rect.height;
                        if (!width || !height) {
                            const viewBox = svgEl.viewBox && svgEl.viewBox.baseVal;
                            if (viewBox && viewBox.width && viewBox.height) {
                                width = viewBox.width;
                                height = viewBox.height;
                            } else {
                                width = parseFloat(svgEl.getAttribute('width')) || 800;
                                height = parseFloat(svgEl.getAttribute('height')) || 600;
                            }
                        }
                        svgClone.setAttribute('width', width);
                        svgClone.setAttribute('height', height);
                        const svgData = new XMLSerializer().serializeToString(svgClone);
                        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                        const url = URL.createObjectURL(svgBlob);
                        return await new Promise((resolve, reject) => {
                            const img = new Image();
                            img.crossOrigin = 'anonymous';
                            img.onload = () => {
                                try {
                                    const scale = 2;
                                    const canvas = document.createElement('canvas');
                                    canvas.width = Math.ceil(width * scale);
                                    canvas.height = Math.ceil(height * scale);
                                    const ctx = canvas.getContext('2d');
                                    ctx.imageSmoothingEnabled = true;
                                    ctx.imageSmoothingQuality = 'high';
                                    ctx.scale(scale, scale);
                                    ctx.drawImage(img, 0, 0, width, height);
                                    URL.revokeObjectURL(url);
                                    canvas.toBlob((blob) => {
                                        if (blob) resolve(blob);
                                        else reject(new Error('Canvas toBlob failed'));
                                    }, 'image/png');
                                } catch (e) {
                                    URL.revokeObjectURL(url);
                                    reject(e);
                                }
                            };
                            img.onerror = () => {
                                URL.revokeObjectURL(url);
                                reject(new Error('SVG Image load failed'));
                            };
                            img.src = url;
                        });
                    } catch (directErr) {
                        console.warn('Native SVG to PNG failed, falling back to html2canvas:', directErr);
                        if (!window.html2canvas) {
                            await new Promise((resolve, reject) => {
                                const script = document.createElement('script');
                                script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                                script.onload = resolve;
                                script.onerror = () => reject(new Error('Failed to load html2canvas'));
                                document.head.appendChild(script);
                            });
                        }
                        const canvas = await window.html2canvas(renderNode, {
                            scale: 2,
                            backgroundColor: null,
                            logging: false,
                            useCORS: true,
                        });
                        return new Promise((resolve, reject) => {
                            canvas.toBlob((blob) => {
                                if (blob) resolve(blob);
                                else reject(new Error('html2canvas toBlob failed'));
                            }, 'image/png');
                        });
                    }
                }
                throw new Error('No SVG or Canvas element found');
            };

            const btnPng = document.createElement('button');
            btnPng.type = 'button';
            btnPng.className = 'diagram-btn diagram-btn-png';
            btnPng.title = zh ? '複製 PNG 圖片到剪貼簿' : 'Copy PNG image to clipboard';
            btnPng.setAttribute('aria-label', zh ? '複製 PNG 圖片' : 'Copy PNG image');
            btnPng.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>PNG</span>';
            btnPng.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const blob = await getPngBlob();
                    if (blob && navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        btnPng.classList.add('is-copied');
                        const origHtml = btnPng.innerHTML;
                        btnPng.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span>' + (zh ? '已複製！' : 'Copied!') + '</span>';
                        setTimeout(() => {
                            btnPng.classList.remove('is-copied');
                            btnPng.innerHTML = origHtml;
                        }, 2000);
                        if (typeof window.showToast === 'function') {
                            window.showToast(zh ? '已複製圖表 PNG 圖片' : 'Diagram PNG copied to clipboard');
                        }
                    } else if (blob) {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = (type || 'diagram') + '.png';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        if (typeof window.showToast === 'function') {
                            window.showToast(zh ? '剪貼簿不支援圖片寫入，已自動下載 PNG' : 'Clipboard image not supported, downloaded PNG');
                        }
                    }
                } catch (err) {
                    console.error('Failed to copy diagram PNG:', err);
                    if (typeof window.showToast === 'function') {
                        window.showToast(zh ? '複製 PNG 失敗' : 'Failed to copy PNG');
                    }
                }
            });
            toolbar.appendChild(btnPng);

            if (renderNode.querySelector('svg')) {
                const btnSvg = document.createElement('button');
                btnSvg.type = 'button';
                btnSvg.className = 'diagram-btn diagram-btn-svg';
                btnSvg.title = zh ? '複製 SVG 向量代碼' : 'Copy SVG vector code';
                btnSvg.setAttribute('aria-label', zh ? '複製 SVG' : 'Copy SVG');
                btnSvg.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg><span>SVG</span>';
                btnSvg.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        const svgEl = renderNode.querySelector('svg');
                        if (!svgEl) return;
                        const svgText = new XMLSerializer().serializeToString(svgEl);
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(svgText);
                        } else {
                            const ta = document.createElement('textarea');
                            ta.value = svgText;
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            ta.remove();
                        }
                        btnSvg.classList.add('is-copied');
                        const origHtml = btnSvg.innerHTML;
                        btnSvg.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg><span>' + (zh ? '已複製！' : 'Copied!') + '</span>';
                        setTimeout(() => {
                            btnSvg.classList.remove('is-copied');
                            btnSvg.innerHTML = origHtml;
                        }, 2000);
                        if (typeof window.showToast === 'function') {
                            window.showToast(zh ? '已複製 SVG 向量代碼' : 'Diagram SVG copied');
                        }
                    } catch (err) {
                        console.error('Failed to copy diagram SVG:', err);
                        if (typeof window.showToast === 'function') {
                            window.showToast(zh ? '複製 SVG 失敗' : 'Failed to copy SVG');
                        }
                    }
                });
                toolbar.appendChild(btnSvg);
            }

            const btnDownload = document.createElement('button');
            btnDownload.type = 'button';
            btnDownload.className = 'diagram-btn diagram-btn-download';
            btnDownload.title = zh ? '下載 PNG 圖片' : 'Download PNG Image';
            btnDownload.setAttribute('aria-label', zh ? '下載 PNG' : 'Download PNG');
            btnDownload.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
            btnDownload.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const blob = await getPngBlob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = (type || 'diagram') + '-' + Date.now() + '.png';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                    if (typeof window.showToast === 'function') {
                        window.showToast(zh ? '已開始下載 PNG 圖片' : 'Downloading PNG image');
                    }
                } catch (err) {
                    console.error('Failed to download PNG:', err);
                    if (typeof window.showToast === 'function') {
                        window.showToast(zh ? '下載失敗' : 'Download failed');
                    }
                }
            });
            toolbar.appendChild(btnDownload);

            wrapper.appendChild(toolbar);
        };

        const initDiagrams = async () => {
            const mermaidNodes = document.querySelectorAll('.diagram-mermaid-render');
            if (mermaidNodes.length > 0) {
                 const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
                 const mermaidFontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "PingFang SC", "Hiragino Sans GB", "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans CJK TC", "Noto Sans CJK SC", "Source Han Sans TC", "Source Han Sans SC", Helvetica, Arial, sans-serif';
                 if (document.fonts?.ready) {
                     try {
                         await document.fonts.ready;
                     } catch (e) {
                         console.warn('Font readiness check failed before Mermaid render', e);
                     }
                 }
                 mermaid.initialize({
                     startOnLoad: false,
                     securityLevel: 'strict',
                     fontFamily: mermaidFontFamily,
                     themeVariables: {
                         fontFamily: mermaidFontFamily
                     },
                     flowchart: {
                         htmlLabels: false,
                         useMaxWidth: true
                     }
                 });
                 for (let i = 0; i < mermaidNodes.length; i++) {
                     const renderNode = mermaidNodes[i];
                     const container = renderNode.previousElementSibling;
                     if (container && !renderNode.hasAttribute('data-processed')) {
                         try {
                              const code = container.textContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                              const id = \`mermaid-svg-\${Date.now()}-\${i}\`;
                              const { svg } = await mermaid.render(id, code);
                              renderNode.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } }) : svg;
                              renderNode.setAttribute('data-processed', 'true');
                              attachDiagramActions(renderNode, code, 'mermaid');
                         } catch (e) {
                              console.error('Mermaid render error', e);
                              const errMsg = String(e?.message || e || 'Unknown error').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                              renderNode.innerHTML = \`<pre style="color:red; background:#fee; padding:10px; border:1px solid red;">Mermaid Render Error: \${errMsg}</pre>\`;
                         }
                     }
                 }
            }
            
            if (document.querySelectorAll('.diagram-flow-render').length > 0) {
                 try {
                     await loadScript('https://cdnjs.cloudflare.com/ajax/libs/raphael/2.3.0/raphael.min.js');
                     await loadScript('https://cdnjs.cloudflare.com/ajax/libs/flowchart/1.17.1/flowchart.min.js');
                     document.querySelectorAll('.diagram-flow-render').forEach(el => {
                         if (el.hasAttribute('data-processed')) return;
                         const code = el.previousElementSibling.textContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                         el.innerHTML = '';
                         const chart = flowchart.parse(code);
                         chart.drawSVG(el);
                         el.setAttribute('data-processed', 'true');
                         attachDiagramActions(el, code, 'flow');
                     });
                 } catch(e) { console.error('Flowchart load failed', e); }
            }
            
           if (document.querySelectorAll('.diagram-sequence-render').length > 0) {
                 try {
                     await loadScript('https://cdnjs.cloudflare.com/ajax/libs/raphael/2.3.0/raphael.min.js');
                     await loadScript('https://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.13.6/underscore-min.js');
                     await loadScript('https://cdnjs.cloudflare.com/ajax/libs/js-sequence-diagrams/1.0.6/sequence-diagram-min.js');
                     document.querySelectorAll('.diagram-sequence-render').forEach(el => {
                         if (el.hasAttribute('data-processed')) return;
                         const code = el.previousElementSibling.textContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                         el.innerHTML = '';
                         const diagram = Diagram.parse(code);
                         diagram.drawSVG(el, {theme: 'simple'});
                         el.setAttribute('data-processed', 'true');
                         attachDiagramActions(el, code, 'sequence');
                     });
                 } catch(e) { console.error('Sequence load failed', e); }
            }
            
            if (document.querySelectorAll('.diagram-graphviz-render').length > 0) {
                 try {
                     const { Graphviz } = await import('https://cdn.jsdelivr.net/npm/@hpcc-js/wasm/dist/index.js');
                     const graphviz = await Graphviz.load();
                     document.querySelectorAll('.diagram-graphviz-render').forEach(el => {
                         if (el.hasAttribute('data-processed')) return;
                         const code = el.previousElementSibling.textContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                         const graphvizSvg = graphviz.layout(code, "svg", "dot");
                         el.innerHTML = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(graphvizSvg, { USE_PROFILES: { svg: true, svgFilters: true } }) : graphvizSvg;
                         el.setAttribute('data-processed', 'true');
                         attachDiagramActions(el, code, 'graphviz');
                     });
                 } catch(e) { console.error('Graphviz load failed', e); }
            }
             
             if (document.querySelectorAll('.diagram-abc-render').length > 0) {
                 try {
                     await loadScript('https://cdn.jsdelivr.net/npm/abcjs@6.2.2/dist/abcjs-basic-min.js');
                     document.querySelectorAll('.diagram-abc-render').forEach(el => {
                         if (el.hasAttribute('data-processed')) return;
                         const code = el.previousElementSibling.textContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                         ABCJS.renderAbc(el, code);
                         el.setAttribute('data-processed', 'true');
                         attachDiagramActions(el, code, 'abc');
                     });
                 } catch(e) { console.error('ABC load failed', e); }
            }

            const echartsNodes = document.querySelectorAll('.diagram-echarts-render');
            if (echartsNodes.length > 0) {
                const showEchartsError = (node, error) => {
                    node.textContent = 'ECharts Render Error: ' + (error?.message || error || 'Unknown error');
                    node.classList.add('diagram-render-error');
                };
                try {
                    await loadScript('https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js');
                    const { renderEchartsChart } = await import('/js/echarts-renderer.mjs');
                    document.querySelectorAll('.diagram-echarts-render').forEach(el => {
                        if (el.hasAttribute('data-processed') || !el.isConnected) return;
                        const source = el.previousElementSibling?.textContent || '';
                        try {
                            renderEchartsChart(el, source, window.echarts);
                            el.setAttribute('data-processed', 'true');
                            attachDiagramActions(el, source, 'echarts');
                        } catch (error) {
                            console.error('ECharts render error', error);
                            showEchartsError(el, error);
                        }
                    });
                } catch (error) {
                    console.error('ECharts load failed', error);
                    document.querySelectorAll('.diagram-echarts-render').forEach(el => showEchartsError(el, error));
                }
            }
        }

        window.renderMarkdown = async (node, text) => {
            if (!node) return;
            try {
                const expanded = expandMarkdownExtensions(text);
                let rawHtml = '';
                if (typeof processor !== 'undefined' && processor && typeof processor.process === 'function') {
                    try {
                        const file = await processor.process(expanded);
                        rawHtml = String(file);
                    } catch (procErr) {
                        console.warn('Unified processor failed, falling back to marked:', procErr);
                        rawHtml = (window.marked && typeof window.marked.parse === 'function') ? window.marked.parse(expanded) : '';
                    }
                } else if (window.marked && typeof window.marked.parse === 'function') {
                    rawHtml = window.marked.parse(expanded);
                }
                const clean = DOMPurify.sanitize(rawHtml, {
                    ADD_TAGS: ['cite', 'mark', 'math', 'annotation', 'semantics', 'mtext', 'mn', 'mo', 'mi', 'sup', 'sub', 'mrow', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'input', 'div', 'svg', 'path', 'circle', 'rect', 'line', 'text', 'g', 'polygon', 'ellipse'],
                    ADD_ATTR: ['class', 'style', 'aria-hidden', 'aria-label', 'role', 'viewBox', 'd', 'xmlns', 'type', 'checked', 'disabled', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'transform', 'font-family', 'font-size', 'text-anchor', 'id', 'data-processed', 'data-diagram-type', 'data-citation-key', 'data-locator', 'data-suppress-author', 'data-footnote-ref', 'data-footnote-backref', 'data-line-numbers', 'data-line-start', 'data-filename', 'title', 'data-offline-audio-id'],
                    WHOLE_DOCUMENT: false,
                    FORCE_BODY: true
                });
                window.disposeEchartsCharts?.();
                node.innerHTML = clean;
                if (typeof window.syncRealtimeDocumentTitle === 'function') {
                    window.syncRealtimeDocumentTitle(text);
                }
                decorateColumnLayouts(node);
                decorateHeadingAnchors(node);
                renderTableOfContents(node);
                node.dataset.copyHtml = node.innerHTML;
                decorateFootnoteAndCitationPopovers(node);
                decorateCodeBlocks(node);
                decorateMediaPreviews(node);
                openShareContentLinksInNewTab(node);
                initDiagrams();
                scheduleHashScroll();
            } catch (e) {
                console.error('Markdown rendering error:', e);
                node.innerHTML = '<p style="color:red">Rendering Error: ' + e.message + '</p>';
            }
        };

        window.parseBookToc = parseBookToc;
        window.htmlOrTsvToMarkdownTable = htmlOrTsvToMarkdownTable;
        window.expandInlineFootnotes = expandInlineFootnotes;
        window.expandMarkdownExtensions = expandMarkdownExtensions;
        window.protectCurrencyDollarSigns = protectCurrencyDollarSigns;
        window.addEventListener('hashchange', scheduleHashScroll);
        window.dispatchEvent(new Event('markdown-ready'));

    </script>
    ` : ''}

<script>
    function makeError(){return new DOMException("The request is not allowed","NotAllowedError")}async function copyClipboardApi(e){if(!navigator.clipboard)throw makeError();return navigator.clipboard.writeText(e)}async function copyExecCommand(e){const o=document.createElement("span");o.textContent=e,o.style.whiteSpace="pre",o.style.webkitUserSelect="auto",o.style.userSelect="all",document.body.appendChild(o);const t=window.getSelection(),n=window.document.createRange();t.removeAllRanges(),n.selectNode(o),t.addRange(n);let r=!1;try{r = window.document.execCommand("copy")}finally{t.removeAllRanges(), window.document.body.removeChild(o)}if(!r)throw makeError()}async function clipboardCopy(e){try{await copyClipboardApi(e)}catch(o){try{await copyExecCommand(e)}catch(e){throw e||o||makeError()}}}async function copyRichClipboard(markdown, html){try{if(navigator.clipboard?.write && window.ClipboardItem){const item=new ClipboardItem({'text/html':new Blob([html||''],{type:'text/html'}),'text/plain':new Blob([markdown||''],{type:'text/plain'})});await navigator.clipboard.write([item]);return}}catch(e){}await clipboardCopy(markdown||'')}

    const APP_STATE = ${JSON.stringify({
        authPath: ext.authPath || '',
        sharePath: ext.sharePath || '',
        embed: isEmbed,
        presentationPath: ext.presentationPath || '',
        bookPath: ext.bookPath || '',
        settingPath: (ext.isAuthor || !isSharePage) ? (ext.settingPath || (path ? '/' + path + '/setting' : '')) : '',
        path: (ext.isAuthor || !isSharePage) ? (path || '') : '',
        shareId: shareId || '',
        presentationEntry: ext.presentationEntry === true,
        autoPresent: ext.autoPresent === true,
        autoBook: ext.autoBook === true,
        isEdit: isEdit === true,
        editorFormat: isWhiteboardDocument ? 'whiteboard' : (isCanvasDocument ? 'canvas' : (isBlockDocument ? 'block' : 'markdown')),
        isBlock: isBlockDocument,
        isCanvas: isCanvasDocument,
        isWhiteboard: isWhiteboardDocument,
        blockMarkdown: isBurnInterstitial ? '' : (ext.blockMarkdown || ''),
        isNewEntry: isEdit === true && ext.isNewEntry === true,
        theme: pageTheme,
        isPublished: ext.share === true,
        autosave: ext.autosave !== false && ext.share === true,
        noteHistoryEnabled: ext.noteHistoryEnabled === true,
        publicIndex: ext.publicIndex === true,
        versionCount: Number.isSafeInteger(ext.versionCount) && ext.versionCount >= 0 ? ext.versionCount : null,
        viewCount: Number.isSafeInteger(ext.viewCount) && ext.viewCount >= 0 ? ext.viewCount : null,
        updateAt: Number.isFinite(Number(ext.updateAt)) ? Number(ext.updateAt) : null,
        shareExpiresAt: Number.isFinite(Number(ext.shareExpiresAt)) ? Number(ext.shareExpiresAt) : null,
        shareExpiresIn: ext.shareExpiresIn || 'none',
        shareBurnAfterReading: ext.shareBurnAfterReading === true,
        shareMode: ext.shareMode || (ext.shareBurnAfterReading === true ? 'burn' : 'standard'),
        shareUnlockIn: ext.shareUnlockIn || '1d',
        shareUnlockAt: Number.isFinite(Number(ext.shareUnlockAt)) ? Number(ext.shareUnlockAt) : null,
        sharePulseInterval: Number.isFinite(Number(ext.sharePulseInterval)) ? Number(ext.sharePulseInterval) : 604800,
        sharePulseDueAt: Number.isFinite(Number(ext.sharePulseDueAt)) ? Number(ext.sharePulseDueAt) : null,
        sharePulseToken: ext.isAuthor === true ? (ext.sharePulseToken || '') : '',
        deadmanReleased: ext.deadmanReleased === true,
        isAuthor: ext.isAuthor === true,
        burnUnlocked: ext.burnUnlocked === true,
        burnActiveNotice: ext.burnActiveNotice === true,
        annotationsEnabled: resolveAnnotationsEnabled(ext),
        noteSettings: {
            width: ext.width || '',
            shareFont: ext.shareFont || '',
            previewDevice: initialEditorPreviewDevice || ext.previewDevice || '',
            splitDirection: ext.splitDirection || '',
        },
        appName: APP_NAME,
        lang,
        title: title || '',
        i18n: getLangText(lang),
    }).replace(/</g, '\\u003c')}
    window.APP_STATE = APP_STATE

    const syncRealtimeDocumentTitle = (text) => {
        if (typeof text !== 'string') return
        const lines = text.split('\\n').slice(0, 50)
        let inFence = false
        let inFrontmatter = false
        let sawContent = false
        let h1Title = ''
        let h2Title = ''
        let firstParagraph = ''

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            if (!sawContent && trimmed === '---') {
                inFrontmatter = true
                sawContent = true
                continue
            }
            if (inFrontmatter) {
                if (trimmed === '---' || trimmed === '...') inFrontmatter = false
                continue
            }
            const backtickFence = String.fromCharCode(96, 96, 96)
            if (trimmed.startsWith(backtickFence) || trimmed.startsWith('~~~')) {
                inFence = !inFence
                sawContent = true
                continue
            }
            if (inFence) continue
            if (/^\\[toc\\]$/i.test(trimmed) || /^\\{:toc\\}$/i.test(trimmed) || /^>\\s*\\[!/i.test(trimmed) || /^<!--/.test(trimmed) || /^[-*_]{3,}$/.test(trimmed)) continue
            if (/^(好的[，,：:]|這是為您|以下是|Certainly[!,：:]|Here is|Below is|Sure[!,：:]|Okay[!,：:])/i.test(trimmed) && trimmed.length < 40) continue

            const cleanHeading = str => str.split(String.fromCharCode(96)).join('').replace(/[*_~]/g, '').trim().substring(0, 70)
            if (/^#\\s+/.test(trimmed) && !h1Title) {
                h1Title = cleanHeading(trimmed.replace(/^#\\s+/, ''))
                break
            } else if (/^##\\s+/.test(trimmed) && !h2Title) {
                h2Title = cleanHeading(trimmed.replace(/^##\\s+/, ''))
            } else if (!firstParagraph) {
                firstParagraph = cleanHeading(trimmed.replace(/^#{1,6}\\s*/, ''))
            }
            sawContent = true
        }

        const candidate = h1Title || h2Title || firstParagraph
        if (candidate && candidate !== APP_STATE.title) {
            APP_STATE.title = candidate
            const appName = APP_STATE.appName || 'david888 wiki'
            document.title = candidate + ' - ' + appName
        }
    }
    window.syncRealtimeDocumentTitle = syncRealtimeDocumentTitle
    const PENDING_PRESENTATION_KEY = 'cf-notepad:pending-presentation-destination'
    const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
    const NEW_ENTRY_WELCOME_STORAGE_KEY = 'cf-notepad:new-entry-welcome:' + APP_STATE.path

    const hasPendingNewEntryWelcome = () => {
        try {
            return window.sessionStorage.getItem(NEW_ENTRY_WELCOME_STORAGE_KEY) === '1'
        } catch (error) {
            return false
        }
    }

    if (APP_STATE.isNewEntry) {
        try {
            window.sessionStorage.setItem(NEW_ENTRY_WELCOME_STORAGE_KEY, '1')
        } catch (error) {}
    }

    if (APP_STATE.isNewEntry && window.history?.replaceState) {
        const cleanUrl = new URL(window.location.href)
        cleanUrl.searchParams.delete('new')
        window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash)
    }

    const getI18n = key => {
        return (APP_STATE.i18n && APP_STATE.i18n[key]) || key
    }

    const modalFocusState = new WeakMap()
    const getModalFocusableElements = modal => [...modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hidden && !element.closest('[hidden]'))
    const openModal = (modal, { initialFocus = null, trigger = document.activeElement, onEscape = null } = {}) => {
        if (!modal) return
        const previousState = modalFocusState.get(modal)
        if (previousState?.onKeyDown) modal.removeEventListener('keydown', previousState.onKeyDown)
        if (previousState?.onMaskClick) modal.removeEventListener('click', previousState.onMaskClick)
        if (previousState?.focusTimer) window.clearTimeout(previousState.focusTimer)
        const onKeyDown = event => {
            if (event.key === 'Escape' && !modal.hasAttribute('data-prevent-escape-close')) {
                event.preventDefault()
                if (typeof onEscape === 'function') onEscape()
                else closeModal(modal)
                return
            }
            if (event.key !== 'Tab') return
            const focusable = getModalFocusableElements(modal)
            if (!focusable.length) return
            const first = focusable[0]
            const last = focusable.at(-1)
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }
        const onMaskClick = event => {
            if (event.target.matches('[data-modal-close], .modal-mask, .close-btn') && !modal.hasAttribute('data-prevent-mask-close')) {
                closeModal(modal)
            }
        }
        const state = { trigger, onKeyDown, onMaskClick, focusTimer: null }
        modalFocusState.set(modal, state)
        modal.style.display = 'block'
        modal.setAttribute('aria-hidden', 'false')
        modal.addEventListener('keydown', onKeyDown)
        modal.addEventListener('click', onMaskClick)
        state.focusTimer = window.setTimeout(() => {
            if (modalFocusState.get(modal) === state) (initialFocus || getModalFocusableElements(modal)[0])?.focus()
        }, 0)
    }
    const closeModal = (modal, { restoreFocus = true } = {}) => {
        if (!modal) return
        const state = modalFocusState.get(modal)
        if (state?.onKeyDown) modal.removeEventListener('keydown', state.onKeyDown)
        if (state?.onMaskClick) modal.removeEventListener('click', state.onMaskClick)
        if (state?.focusTimer) window.clearTimeout(state.focusTimer)
        modalFocusState.delete(modal)
        modal.style.display = 'none'
        modal.setAttribute('aria-hidden', 'true')
        if (restoreFocus && state?.trigger?.isConnected) state.trigger.focus()
    }

    const openAppDialog = ({ title = getI18n('err'), message = '', kind = 'info', confirm = false, cancelText, confirmText } = {}) => new Promise(resolve => {
        const modal = document.querySelector('.app-dialog-modal')
        const content = modal?.querySelector('.app-dialog-content')
        const icon = modal?.querySelector('.app-dialog-icon')
        const titleNode = modal?.querySelector('#app-dialog-title')
        const messageNode = modal?.querySelector('#app-dialog-message')
        const confirmBtn = modal?.querySelector('.app-dialog-confirm')
        const cancelBtn = modal?.querySelector('.app-dialog-cancel')
        const mask = modal?.querySelector('.modal-mask')

        if (!modal || !content || !icon || !titleNode || !messageNode || !confirmBtn || !cancelBtn || !mask) {
            if (confirm) resolve(window.confirm(message))
            else { window.alert(message); resolve(true) }
            return
        }

        let settled = false
        const cleanup = result => {
            if (settled) return
            settled = true
            closeModal(modal)
            confirmBtn.removeEventListener('click', onConfirm)
            cancelBtn.removeEventListener('click', onCancel)
            mask.removeEventListener('click', onCancel)
            modal.removeEventListener('keydown', onKeyDown)
            resolve(result)
        }
        const onConfirm = () => cleanup(true)
        const onCancel = () => cleanup(false)
        const onKeyDown = event => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onCancel()
            }
            if (event.key === 'Enter') {
                event.preventDefault()
                onConfirm()
            }
        }

        content.dataset.dialogKind = kind
        icon.textContent = kind === 'error' ? '!' : kind === 'confirm' ? '?' : 'i'
        titleNode.textContent = title
        messageNode.textContent = message
        cancelBtn.style.display = confirm ? '' : 'none'
        cancelBtn.textContent = cancelText || getI18n('passwordCancel')
        confirmBtn.textContent = confirmText || getI18n('passwordConfirm')
        openModal(modal, { initialFocus: confirm ? cancelBtn : confirmBtn })
        confirmBtn.addEventListener('click', onConfirm)
        cancelBtn.addEventListener('click', onCancel)
        mask.addEventListener('click', onCancel)
        modal.addEventListener('keydown', onKeyDown)
    })
    window.showAppDialog = openAppDialog

    const setLanguage = lang => {
        document.cookie = 'lang=' + encodeURIComponent(lang) + '; path=/; max-age=' + LANG_COOKIE_MAX_AGE + '; SameSite=Lax'
        window.location.reload()
    }

    const errHandle = (err) => { window.showAppDialog({ title: getI18n('err'), message: String(err), kind: 'error' }) }

    const summarizeErrorText = text => {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim()
        if (!normalized) return 'Empty response'
        return normalized.length > 240 ? normalized.slice(0, 237) + '...' : normalized
    }

    const parseJsonResponse = async response => {
        const rawText = await response.text()
        let payload = null
        try {
            payload = rawText ? JSON.parse(rawText) : null
        } catch (error) {
            const statusText = response.status ? 'HTTP ' + response.status : 'Unknown status'
            throw new Error(statusText + ' - ' + summarizeErrorText(rawText || error.message || 'Invalid JSON response'))
        }

        if (!payload || typeof payload !== 'object') {
            throw new Error('Invalid API response payload')
        }

        return payload
    }

    const fetchJson = async (input, init, timeoutMs = 30000) => {
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(new Error('Request timeout')), timeoutMs)
        try {
            const response = await window.fetch(input, {
                ...init,
                signal: controller.signal,
            })
            return parseJsonResponse(response)
        } finally {
            window.clearTimeout(timeoutId)
        }
    }

    const initWebMcp = () => {
        const contexts = []
        if (typeof document !== 'undefined' && document.modelContext) contexts.push(document.modelContext)
        if (typeof navigator !== 'undefined' && navigator.modelContext && !contexts.includes(navigator.modelContext)) contexts.push(navigator.modelContext)
        if (typeof window !== 'undefined' && window.modelContext && !contexts.includes(window.modelContext)) contexts.push(window.modelContext)

        const getCurrentMarkdown = () => {
            const textarea = document.getElementById('contents')
            if (textarea && !textarea.classList.contains('hide')) return textarea.value || ''

            const article = document.getElementById('bot-accessible-content')
            return article ? (article.textContent || '') : ''
        }

        const tools = [
            {
                name: 'read-current-markdown',
                description: 'Return the current note or share page markdown content.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    additionalProperties: false,
                },
                execute: async () => ({
                    markdown: getCurrentMarkdown(),
                    title: APP_STATE.title || document.title || '',
                    path: APP_STATE.path || '',
                    sharePath: APP_STATE.sharePath || '',
                }),
            },
        ]

        if (APP_STATE.sharePath) {
            tools.push({
                name: 'copy-share-link',
                description: 'Copy the current note share URL to the clipboard and return it.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    additionalProperties: false,
                },
                execute: async () => {
                    const shareUrl = window.location.origin + APP_STATE.sharePath
                    await clipboardCopy(shareUrl)
                    return { shareUrl }
                },
            })
        }

        if (APP_STATE.presentationPath) {
            tools.push({
                name: 'open-presentation',
                description: 'Open the current shared note in presentation mode.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    additionalProperties: false,
                },
                execute: async () => {
                    const presentationUrl = window.location.origin + APP_STATE.presentationPath
                    window.location.href = presentationUrl
                    return { presentationUrl }
                },
            })
        }

        if (APP_STATE.sharePath) {
            tools.push({
                name: 'open-book',
                description: 'Open the current note in dual-pane Book Mode.',
                inputSchema: {
                    type: 'object',
                    properties: {},
                    additionalProperties: false,
                },
                execute: async () => {
                    const bookUrl = window.location.origin + APP_STATE.sharePath + '/book'
                    window.location.href = bookUrl
                    return { bookUrl }
                },
            })
        }

        tools.push({
            name: 'get-authoring-skill-guide',
            description: 'Get the canonical URL and instructions for David888 Wiki authoring and multi-article Book orchestration.',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false,
            },
            execute: async () => ({
                skillUrl: 'https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md',
                docsUrl: 'https://wiki.david888.com/api/docs',
                instructions: 'Fetch SKILL.md for the 4-step Book Orchestration SOP, 2D presentation slides (---/--), KaTeX, and extended formatting syntaxes.',
            }),
        })

        // Register tools on all available WebMCP contexts
        for (const mc of contexts) {
            if (typeof mc.registerTool === 'function') {
                for (const tool of tools) {
                    Promise.resolve(mc.registerTool(tool)).catch(error => {
                        console.warn('WebMCP registerTool failed for ' + tool.name + ':', error)
                    })
                }
            } else if (typeof mc.provideContext === 'function') {
                Promise.resolve(mc.provideContext.call(mc, { tools })).catch(error => {
                    console.warn('WebMCP provideContext failed:', error)
                })
            }
        }

        // Expose debug inspection helper
        window.__checkWebMcp = async () => {
            const hasDoc = !!(typeof document !== 'undefined' && document.modelContext)
            const hasNav = !!(typeof navigator !== 'undefined' && navigator.modelContext)
            let tools = []
            if (hasDoc && typeof document.modelContext.getTools === 'function') {
                try { tools = await document.modelContext.getTools() } catch (e) { tools = e.message }
            }
            return { hasDoc, hasNav, registeredContexts: contexts.length, tools }
        }
    }

        const getAuthPath = () => APP_STATE.authPath || (location.pathname + '/auth')
        const getSettingPath = () => APP_STATE.settingPath || (location.pathname + '/setting')
        const canPersistSettings = APP_STATE.isEdit === true
        const persistSetting = async nextSettings => {
            if (!canPersistSettings) return null
            const payload = await fetchJson(getSettingPath(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextSettings),
            })
            if (payload.err !== 0) throw new Error(payload.msg || 'setting update failed')
            APP_STATE.noteSettings = { ...APP_STATE.noteSettings, ...nextSettings }
            if (Object.prototype.hasOwnProperty.call(nextSettings, 'autosave')) {
                APP_STATE.autosave = nextSettings.autosave === true && APP_STATE.isPublished === true
            }
            if (Object.prototype.hasOwnProperty.call(nextSettings, 'annotationsEnabled')) {
                APP_STATE.annotationsEnabled = nextSettings.annotationsEnabled === true
            }
            if (Object.prototype.hasOwnProperty.call(nextSettings, 'theme')) {
                APP_STATE.theme = nextSettings.theme
            }
            return payload
        }

    const rememberPresentationDestination = () => {
        if (!APP_STATE.presentationEntry) return ''
        const destination = location.pathname + location.hash
        try { sessionStorage.setItem(PENDING_PRESENTATION_KEY, destination) } catch (e) {}
        return destination
    }

    const consumePresentationDestination = () => {
        try {
            const destination = sessionStorage.getItem(PENDING_PRESENTATION_KEY)
            sessionStorage.removeItem(PENDING_PRESENTATION_KEY)
            return destination
        } catch (e) {
            return ''
        }
    }

    const openPasswordModal = (options = {}) => new Promise(resolve => {
        const modal = document.querySelector('.password-modal')
        const form = modal ? modal.querySelector('.password-modal-form') : null
        const input = modal ? modal.querySelector('.password-modal-input') : null
        const titleNode = modal ? modal.querySelector('#password-modal-title') : null
        const messageNode = modal ? modal.querySelector('.password-modal-message') : null
        const confirmBtn = modal ? modal.querySelector('.password-modal-confirm') : null
        const cancelBtn = modal ? modal.querySelector('.password-modal-cancel') : null
        const closeBtn = modal ? modal.querySelector('.password-modal-close') : null
        const mask = modal ? modal.querySelector('.modal-mask') : null

        const {
            title = '',
            initialValue = '',
            allowEmpty = false,
            message: customMessage = '',
            inputType = 'password',
            placeholder = '',
            confirmText: customConfirmText = '',
            cancelText: customCancelText = '',
        } = typeof options === 'string' ? { title: options } : (options || {})

        const prevConfirmText = confirmBtn ? confirmBtn.textContent : ''
        const prevCancelText = cancelBtn ? cancelBtn.textContent : ''

        if (!modal || !form || !input || !titleNode || !confirmBtn || !cancelBtn || !closeBtn || !mask) {
            resolve(window.prompt(title || getI18n('pepw'), initialValue))
            return
        }

        let settled = false
        const cleanup = result => {
            if (settled) return
            settled = true
            closeModal(modal)
            input.value = ''
            input.type = 'password'
            input.placeholder = ''
            if (confirmBtn && prevConfirmText) confirmBtn.textContent = prevConfirmText
            if (cancelBtn && prevCancelText) cancelBtn.textContent = prevCancelText
            input.removeEventListener('keydown', onKeyDown)
            form.removeEventListener('submit', onSubmit)
            cancelBtn.removeEventListener('click', onCancel)
            closeBtn.removeEventListener('click', onCancel)
            mask.removeEventListener('click', onCancel)
            resolve(result)
        }

        const onConfirm = () => {
            const value = input.value
            if (!allowEmpty && !value.trim()) {
                const errMsg = inputType === 'password'
                    ? getI18n('pwcnbe')
                    : (APP_STATE.lang === 'zh-TW' ? '輸入內容不能為空！' : 'Input cannot be empty!')
                window.showAppDialog({ title: getI18n('err'), message: errMsg, kind: 'error' })
                input.focus()
                return
            }
            cleanup(value)
        }

        const onCancel = () => cleanup(null)
        const onSubmit = event => {
            event.preventDefault()
            onConfirm()
        }
        const onKeyDown = event => {
            if (event.key === 'Enter') {
                event.preventDefault()
                onConfirm()
            }
            if (event.key === 'Escape') {
                event.preventDefault()
                onCancel()
            }
        }

        titleNode.textContent = title || getI18n('pepw')
        if (messageNode) {
            if (customMessage) {
                messageNode.textContent = customMessage
            } else {
                messageNode.textContent = allowEmpty ? getI18n('enpw') : getI18n('pepw')
            }
        }
        input.type = inputType
        input.placeholder = placeholder
        input.value = initialValue
        if (customConfirmText && confirmBtn) confirmBtn.textContent = customConfirmText
        if (customCancelText && cancelBtn) cancelBtn.textContent = customCancelText
        openModal(modal, { initialFocus: input })
        input.addEventListener('keydown', onKeyDown)
        form.addEventListener('submit', onSubmit)
        cancelBtn.addEventListener('click', onCancel)
        closeBtn.addEventListener('click', onCancel)
        mask.addEventListener('click', onCancel)
    })
    window.showAppPrompt = openPasswordModal

    const passwdPrompt = async () => {
        const passwd = await openPasswordModal({ title: getI18n('pepw') })
        if (passwd == null) return;
        const normalizedPasswd = passwd.trim()
        if (!normalizedPasswd) { window.showAppDialog({ title: getI18n('err'), message: getI18n('pwcnbe'), kind: 'error' }); return; }
        const destination = rememberPresentationDestination() || (location.pathname + location.hash)
        fetchJson(getAuthPath(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passwd: normalizedPasswd }) })
            .then(res => {
                if (res.err !== 0) { return errHandle(res.msg) }
                if (res.data.refresh) {
                    if (res.data.role === 'edit' && APP_STATE.sharePath && APP_STATE.path) {
                        window.location.href = '/' + APP_STATE.path
                        return
                    }
                    if (APP_STATE.presentationEntry) {
                        consumePresentationDestination()
                        window.location.reload()
                        return;
                    }
                    window.location.reload()
                }
            })
            .catch(err => errHandle(err))
    }

    const renderPlain = (node, text) => { if (node) { node.innerHTML = DOMPurify.sanitize(text) } }

    const triggerRender = (node, text) => {
        if (!node) return;
        syncRealtimeDocumentTitle(text);
        if (window.renderMarkdown) {
            window.renderMarkdown(node, text);
            return;
        }
        const done = () => {
            if (window.renderMarkdown) window.renderMarkdown(node, text);
        };
        window.addEventListener('markdown-ready', done, { once: true });
        const interval = setInterval(() => {
            if (window.renderMarkdown) {
                clearInterval(interval);
                window.removeEventListener('markdown-ready', done);
                window.renderMarkdown(node, text);
            }
        }, 50);
        setTimeout(() => clearInterval(interval), 5000);
    }

    const SHARE_HISTORY_LIMIT = 20
    const SHARE_HISTORY_STORAGE_KEYS = {
        created: 'cf-notepad:share-history:created',
        viewed: 'cf-notepad:share-history:viewed',
    }

    const readShareHistory = type => {
        try {
            const key = SHARE_HISTORY_STORAGE_KEYS[type]
            const items = JSON.parse(window.localStorage.getItem(key) || '[]')
            return Array.isArray(items) ? items : []
        } catch (e) {
            return []
        }
    }

    const writeShareHistory = (type, items) => {
        try {
            window.localStorage.setItem(SHARE_HISTORY_STORAGE_KEYS[type], JSON.stringify(items.slice(0, SHARE_HISTORY_LIMIT)))
        } catch (e) {}
    }

    const recordShareHistory = (type, url, title) => {
        if (!SHARE_HISTORY_STORAGE_KEYS[type] || !url) return;
        const normalizedUrl = String(url).split('#')[0]
        const items = readShareHistory(type).filter(item => String(item.url || '').split('#')[0] !== normalizedUrl)
        items.unshift({
            url: String(url),
            title: String(title || APP_STATE.title || document.title || 'Share').replace(/\\s+-\\s+[^-]+$/, '').trim(),
            savedAt: Date.now(),
        })
        writeShareHistory(type, items)
    }

    const formatShareHistoryTime = savedAt => {
        const diffSeconds = Math.max(0, Math.floor((Date.now() - Number(savedAt || 0)) / 1000))
        const zh = APP_STATE.lang === 'zh-TW'
        if (diffSeconds < 60) return zh ? '剛剛' : 'now'
        const minutes = Math.floor(diffSeconds / 60)
        if (minutes < 60) return zh ? minutes + ' 分前' : minutes + 'm ago'
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return zh ? hours + ' 小時前' : hours + 'h ago'
        return new Date(Number(savedAt || Date.now())).toLocaleDateString(zh ? 'zh-TW' : 'en-US')
    }

    const setupShareHistory = () => {
        const modal = document.querySelector('.share-history-modal')
        const openBtns = document.querySelectorAll('#share-history-btn, .share-history-trigger')
        const closeBtn = document.querySelector('.share-history-close')
        const mask = modal ? modal.querySelector('.modal-mask') : null
        const list = modal ? modal.querySelector('[data-share-history-list]') : null
        const tabs = modal ? modal.querySelectorAll('[data-share-history-tab]') : []
        if (!modal || !openBtns.length || !list) return;

        let activeType = 'created'
        const render = () => {
            const items = readShareHistory(activeType)
            if (!items.length) {
                list.innerHTML = '<p class="share-history-empty">' + (APP_STATE.lang === 'zh-TW' ? '目前沒有紀錄。分享或開啟 share URL 後會自動出現在這裡。' : 'No links yet. Created and viewed share URLs will appear here automatically.') + '</p>'
                return
            }

            list.innerHTML = ''
            items.forEach(item => {
                const row = document.createElement('div')
                row.className = 'share-history-item'

                const link = document.createElement('a')
                link.className = 'share-history-link'
                link.href = item.url
                link.textContent = item.title || item.url
                link.title = item.url

                const copy = document.createElement('button')
                copy.type = 'button'
                copy.className = 'share-history-copy'
                copy.textContent = getI18n('copy')
                copy.addEventListener('click', async () => {
                    try {
                        await clipboardCopy(item.url)
                        const original = copy.textContent
                        copy.textContent = getI18n('copied')
                        setTimeout(() => { copy.textContent = original }, 1200)
                    } catch (e) {
                        window.showAppDialog({ title: getI18n('err'), message: getI18n('copyFailed'), kind: 'error' })
                    }
                })

                const meta = document.createElement('div')
                meta.className = 'share-history-meta'
                meta.textContent = formatShareHistoryTime(item.savedAt) + ' · ' + item.url

                row.appendChild(link)
                row.appendChild(copy)
                row.appendChild(meta)
                list.appendChild(row)
            })
        }

        const open = (e) => {
            const trigger = e ? e.currentTarget : openBtns[0]
            if (document.body.classList.contains('share-view') && !readShareHistory('created').length && readShareHistory('viewed').length) {
                activeType = 'viewed'
                tabs.forEach(t => {
                    const isViewed = t.getAttribute('data-share-history-tab') === 'viewed'
                    t.classList.toggle('active', isViewed)
                    t.setAttribute('aria-selected', isViewed ? 'true' : 'false')
                })
            }
            openModal(modal, { initialFocus: closeBtn || tabs[0] || trigger, trigger })
            openBtns.forEach(btn => btn.setAttribute('aria-expanded', 'true'))
            render()
        }
        const close = () => {
            closeModal(modal)
            openBtns.forEach(btn => btn.setAttribute('aria-expanded', 'false'))
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                activeType = this.getAttribute('data-share-history-tab') === 'viewed' ? 'viewed' : 'created'
                tabs.forEach(other => {
                    const active = other === this
                    other.classList.toggle('active', active)
                    other.setAttribute('aria-selected', active ? 'true' : 'false')
                })
                render()
            })
        })

        openBtns.forEach(btn => btn.addEventListener('click', open))
        if (closeBtn) closeBtn.addEventListener('click', close)
        if (mask) mask.addEventListener('click', close)
        modal.addEventListener('keydown', e => {
            if (e.key === 'Escape') close()
        })

        if (document.body.classList.contains('share-view') && !APP_STATE.isEdit) {
            recordShareHistory('viewed', window.location.origin + window.location.pathname + window.location.hash, APP_STATE.title)
        }
    }

    const setupNoteHistory = ({ textarea = null, previewMarkdownNode = null, previewPlainNode = null } = {}) => {
        if (!APP_STATE.noteHistoryEnabled || !APP_STATE.isEdit) return;

        const modal = document.querySelector('.note-history-modal')
        const openBtn = document.querySelector('#note-history-btn')
        const closeBtn = modal ? modal.querySelector('.note-history-close') : null
        const mask = modal ? modal.querySelector('.modal-mask') : null
        const list = modal ? modal.querySelector('[data-note-history-list]') : null
        const titleNode = modal ? modal.querySelector('[data-note-history-title]') : null
        const metaNode = modal ? modal.querySelector('[data-note-history-meta]') : null
        const bodyNode = modal ? modal.querySelector('[data-note-history-body]') : null
        const refreshBtn = modal ? modal.querySelector('[data-note-history-refresh]') : null
        const copyBtn = modal ? modal.querySelector('[data-note-history-copy]') : null
        const restoreBtn = modal ? modal.querySelector('[data-note-history-restore]') : null
        const renderModeButtons = modal ? modal.querySelectorAll('[data-note-history-render-mode]') : []
        if (!modal || !openBtn || !list || !bodyNode) return;

        let versions = []
        let selectedVersion = null
        let selectedVersionId = null
        let renderMode = 'preview'
        let loaded = false
        let loading = false

        const apiBase = () => '/api' + window.location.pathname + '/history'
        const getCurrentContent = () => textarea ? textarea.value || '' : ''
        const setActionsDisabled = () => {
            const disabled = !selectedVersion
            if (copyBtn) copyBtn.disabled = disabled
            if (restoreBtn) restoreBtn.disabled = disabled
        }
        const formatHistoryTime = value => formatShareHistoryTime(Number(value || 0) * 1000)
        const formatHistorySize = value => String(Number(value || 0)) + ' ' + getI18n('historyChars')

        const renderStatus = (message, error = false) => {
            if (titleNode) titleNode.textContent = message
            if (metaNode) metaNode.textContent = ''
            bodyNode.className = 'note-history-body note-history-status' + (error ? ' error' : '')
            bodyNode.textContent = message
            setActionsDisabled()
        }

        const renderVersionBody = () => {
            if (!selectedVersion) {
                renderStatus(getI18n('historyNoSelection'))
                return
            }

            bodyNode.className = renderMode === 'preview'
                ? 'note-history-body markdown-body'
                : 'note-history-body'

            const content = selectedVersion.content || ''
            if (renderMode === 'preview' && window.renderMarkdown) {
                triggerRender(bodyNode, content)
            } else {
                bodyNode.textContent = content
            }
        }

        const renderSelectedVersion = () => {
            if (!selectedVersion) {
                renderStatus(getI18n('historyNoSelection'))
                return
            }
            if (titleNode) titleNode.textContent = selectedVersion.title || getI18n('historySelectedVersion')
            if (metaNode) {
                metaNode.textContent = formatHistoryTime(selectedVersion.createdAt) + ' · ' + formatHistorySize(selectedVersion.contentLength || selectedVersion.content?.length)
            }
            renderVersionBody()
            setActionsDisabled()
        }

        const renderList = () => {
            if (loading) {
                list.innerHTML = '<p class="share-history-empty">' + getI18n('historyLoading') + '</p>'
                return
            }
            if (!versions.length) {
                list.innerHTML = '<p class="share-history-empty">' + getI18n('historyEmpty') + '</p>'
                renderSelectedVersion()
                return
            }

            list.innerHTML = ''
            versions.forEach(version => {
                const button = document.createElement('button')
                button.type = 'button'
                button.className = 'note-history-entry' + (selectedVersionId === version.id ? ' active' : '')
                button.setAttribute('data-note-history-version-id', String(version.id))

                const title = document.createElement('div')
                title.className = 'note-history-entry-title'
                title.textContent = version.title || getI18n('history')

                const preview = document.createElement('div')
                preview.className = 'note-history-entry-preview'
                preview.textContent = version.preview || ''

                const meta = document.createElement('div')
                meta.className = 'note-history-entry-meta'
                meta.textContent = formatHistoryTime(version.createdAt) + ' · ' + formatHistorySize(version.contentLength)

                button.appendChild(title)
                if (version.preview) button.appendChild(preview)
                button.appendChild(meta)
                button.addEventListener('click', () => selectVersion(version.id))
                list.appendChild(button)
            })
        }

        const fetchVersion = async versionId => {
            const payload = await fetchJson(apiBase() + '/' + encodeURIComponent(versionId))
            if (payload.err !== 0) throw new Error(payload.msg || 'history fetch failed')
            return payload.data
        }

        const selectVersion = async versionId => {
            selectedVersionId = versionId
            selectedVersion = null
            renderList()
            renderStatus(getI18n('historyLoading'))

            try {
                const details = await fetchVersion(versionId)
                const summary = versions.find(item => item.id === versionId) || {}
                selectedVersion = { ...summary, ...details }
                renderList()
                renderSelectedVersion()
            } catch (error) {
                selectedVersion = null
                renderStatus(String(error.message || error), true)
            }
        }

        const refreshHistory = async ({ force = false } = {}) => {
            if (loading) return
            if (loaded && !force) {
                renderList()
                renderSelectedVersion()
                return
            }

            let refreshError = null
            loading = true
            renderList()
            renderStatus(getI18n('historyLoading'))

            try {
                const payload = await fetchJson(apiBase())
                if (payload.err !== 0) throw new Error(payload.msg || 'history list failed')

                versions = Array.isArray(payload.data?.versions) ? payload.data.versions : []
                loaded = true
                if (!versions.some(item => item.id === selectedVersionId)) {
                    selectedVersionId = versions[0]?.id || null
                    selectedVersion = null
                }
            } catch (error) {
                versions = []
                loaded = false
                selectedVersionId = null
                selectedVersion = null
                refreshError = error
            } finally {
                loading = false
                renderList()
                if (refreshError) {
                    renderStatus(String(refreshError.message || refreshError), true)
                } else if (selectedVersionId && !selectedVersion) {
                    selectVersion(selectedVersionId)
                } else {
                    renderSelectedVersion()
                }
            }
        }

        const open = () => {
            openModal(modal, { initialFocus: closeBtn || refreshBtn || openBtn, trigger: openBtn })
            openBtn.setAttribute('aria-expanded', 'true')
            refreshHistory()
        }
        const close = () => {
            closeModal(modal)
            openBtn.setAttribute('aria-expanded', 'false')
        }

        renderModeButtons.forEach(button => {
            button.addEventListener('click', function() {
                renderMode = this.getAttribute('data-note-history-render-mode') === 'raw' ? 'raw' : 'preview'
                renderModeButtons.forEach(other => {
                    const active = other === this
                    other.classList.toggle('active', active)
                    other.setAttribute('aria-pressed', active ? 'true' : 'false')
                })
                renderVersionBody()
            })
        })

        if (refreshBtn) refreshBtn.addEventListener('click', () => refreshHistory({ force: true }))
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                if (!selectedVersion) return
                try {
                    await clipboardCopy(selectedVersion.content || '')
                    window.showToast(getI18n('historyCopiedContent'))
                } catch (e) {
                    window.showAppDialog({ title: getI18n('err'), message: getI18n('copyFailed'), kind: 'error' })
                }
            })
        }
        if (restoreBtn) {
            restoreBtn.addEventListener('click', async () => {
                if (!selectedVersion) return
                if (!await window.showAppDialog({ title: getI18n('history'), message: getI18n('historyRestoreConfirm'), kind: 'confirm', confirm: true })) return
                try {
                    const payload = await fetchJson(apiBase() + '/' + encodeURIComponent(selectedVersion.id) + '/restore', { method: 'POST' })
                    if (payload.err !== 0) throw new Error(payload.msg || 'history restore failed')
                    if (textarea) {
                        textarea.value = selectedVersion.content || ''
                        if (previewMarkdownNode) triggerRender(previewMarkdownNode, textarea.value)
                        if (previewPlainNode) {
                            if (window.DOMPurify) {
                                renderPlain(previewPlainNode, textarea.value)
                            } else {
                                previewPlainNode.textContent = textarea.value
                            }
                        }
                    }
                    loaded = false
                    selectedVersion = null
                    await refreshHistory({ force: true })
                    window.showToast(getI18n('historyRestoreDone'))
                } catch (error) {
                    errHandle(error.message || error)
                }
            })
        }

        openBtn.addEventListener('click', open)
        if (closeBtn) closeBtn.addEventListener('click', close)
        if (mask) mask.addEventListener('click', close)
        modal.addEventListener('keydown', e => {
            if (e.key === 'Escape') close()
        })

        renderStatus(getI18n('historyNoSelection'))
    }

    const setupShareBackToTop = scrollTarget => {
        const button = document.querySelector('#share-back-to-top')
        if (!button || !scrollTarget || !document.body.classList.contains('share-view')) return;

        const updateVisibility = () => {
            button.classList.toggle('visible', scrollTarget.scrollTop > 600)
        }

        button.addEventListener('click', () => {
            scrollTarget.scrollTo({ top: 0, behavior: 'smooth' })
        })
        scrollTarget.addEventListener('scroll', updateVisibility, { passive: true })
        updateVisibility()
    }

    window.addEventListener('DOMContentLoaded', function () {
        const $textarea = document.querySelector('#contents')
        const $loading = document.querySelector('#loading')
        const $modeBtn = document.querySelector('.opt-mode')
        const $shareBtn = document.querySelector('.opt-share')
        const $previewPlain = document.querySelector('#preview-plain')
        const $previewMd = document.querySelector('#preview-md')
        const $shareModal = document.querySelector('.share-modal')
        const $closeBtn = document.querySelector('.share-modal .close-btn')
        const $copyBtn = document.querySelector('.share-modal-copy-btn')
        const $shareInput = document.querySelector('.share-modal input')
        const $languageSelector = document.querySelector('#language-selector')
        const $publishNudgeModal = document.querySelector('.publish-nudge-modal')
        const $publishNudgePublish = document.querySelector('.publish-nudge-publish')
        const $publishNudgeLater = document.querySelector('.publish-nudge-later')
        const $publishNudgeClose = document.querySelector('.publish-nudge-close')
        const $publishPreferenceInputs = [...document.querySelectorAll('.publish-preference-input')]
        const $publicationStatus = document.querySelector('.editor-publication-status')
        const $publicationShareUrl = document.querySelector('#publication-share-url')
        const $publicationCopyUrl = document.querySelector('#publication-copy-url')
        const $publicationPublicIndex = document.querySelector('#publication-public-index')
        const $importMdBtn = document.querySelector('#import-md-btn')
        const $importMdInput = document.querySelector('#import-md-input')
        const $exportMdBtn = document.querySelector('#export-md-btn')
        const $copyMdBtn = document.querySelector('#copy-md-btn')
        const $exportPdfBtn = document.querySelector('#export-pdf-btn')
        const $saveNoteBtn = document.querySelector('#save-note-btn')
        const $autosaveToggle = document.querySelector('#autosave-toggle')
        if (APP_STATE.isNewEntry && APP_STATE.theme) {
            persistSetting({ theme: APP_STATE.theme }).catch(error => {
                console.warn('Initial theme persistence failed:', error?.message || error)
            })
        }
        if ($autosaveToggle) {
            setRailSwitchState($autosaveToggle, APP_STATE.autosave === true && APP_STATE.isPublished)
        }

        const AUTOSAVE_IDLE_MS = ${AUTOSAVE_IDLE_MS}
        const PUBLISH_PREFERENCES_KEY = 'cf-notepad:publish-preferences'
        const defaultPublishPreferences = Object.freeze({ publish: true, autosave: true, publicIndex: true })
        const loadPublishPreferences = () => {
            try {
                const stored = JSON.parse(window.localStorage.getItem(PUBLISH_PREFERENCES_KEY) || 'null')
                if (!stored || typeof stored !== 'object') return { ...defaultPublishPreferences }
                return {
                    publish: stored.publish !== false,
                    autosave: stored.autosave !== false,
                    publicIndex: stored.publicIndex !== false,
                }
            } catch (error) {
                return { ...defaultPublishPreferences }
            }
        }
        const savePublishPreferences = preferences => {
            try { window.localStorage.setItem(PUBLISH_PREFERENCES_KEY, JSON.stringify(preferences)) } catch (error) {}
        }
        let savedContent = $textarea ? $textarea.value : ''
        let autosaveTimer = null
        let saveInFlight = null
        let saveQueued = false
        let allowUnload = false
        const hasUnsavedChanges = () => Boolean($textarea && $textarea.value !== savedContent)
        const $syncStatusBadge = document.querySelector('#sync-status-badge')
        const $syncStatusText = $syncStatusBadge?.querySelector('.sync-status-text')

        const showSaveStatus = (message, isError = false, statusType = 'local') => {
            if ($loading) {
                $loading.setAttribute('aria-label', message)
                $loading.dataset.saveStatus = isError ? 'error' : 'saved'
            }
            if ($syncStatusBadge && $syncStatusText) {
                $syncStatusText.textContent = message
                $syncStatusBadge.dataset.status = isError ? 'error' : statusType
                $syncStatusBadge.title = message + (APP_STATE.lang === 'zh-TW' ? ' (點擊立即同步至雲端)' : ' (Click to sync to cloud)')
            }
        }

        if ($syncStatusBadge) {
            $syncStatusBadge.addEventListener('click', () => {
                saveCurrentNote()
            })
        }

        const getSaveBlockedMessage = () => APP_STATE.lang === 'zh-TW'
            ? '文章尚未發布，請先發布後再儲存；若不想公開閱讀，可以啟用閱讀鎖。'
            : 'Publish this note before saving. If you do not want public reading, enable the read lock.'

        const clearAutosaveTimer = () => {
            if (autosaveTimer) {
                window.clearTimeout(autosaveTimer)
                autosaveTimer = null
            }
        }

        let uploadPendingAudiosToCloud = async () => false;

        const saveCurrentNote = async ({ showBlocked = true } = {}) => {
            window.canvasBridge?.flush?.()
            if (!$textarea) return false
            if (!APP_STATE.isPublished) {
                if (showBlocked) window.showToast?.(getSaveBlockedMessage())
                return false
            }
            try {
                await uploadPendingAudiosToCloud()
            } catch (e) {
                console.warn('Upload pending audios error:', e)
            }
            if (!hasUnsavedChanges()) {
                showSaveStatus(APP_STATE.lang === 'zh-TW' ? '內容已是最新' : 'Content is already saved', false, 'cloud-synced')
                return true
            }
            if (saveInFlight) {
                saveQueued = true
                return saveInFlight
            }

            const content = $textarea.value
            clearAutosaveTimer()
            $loading.style.display = 'inline-block'
            showSaveStatus(APP_STATE.lang === 'zh-TW' ? '雲端同步中...' : 'Syncing...', false, 'syncing')
            window.dispatchEvent(new CustomEvent('canvas:syncing'))
            saveInFlight = fetchJson('', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ t: content }),
            })
                .then(res => {
                    if (res.err !== 0) throw new Error(res.msg || 'save failed')
                    if ($textarea.value === content) savedContent = content
                    APP_STATE.updateAt = Math.floor(Date.now() / 1000)
                    syncPublicationStatus()
                    refreshPublicationVersionCount()
                    const syncTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    showSaveStatus((APP_STATE.lang === 'zh-TW' ? '☁️ 雲端已同步 ' : '☁️ Cloud synced ') + syncTime, false, 'cloud-synced')
                    window.showToast?.(APP_STATE.lang === 'zh-TW' ? '文章已同步至雲端' : 'Note synced to cloud')
                    window.dispatchEvent(new CustomEvent('canvas:synced'))
                    if (window.offlineStore) {
                        const title = String(content || '').split(new RegExp('[\\\\r\\\\n]+'))[0]?.replace(new RegExp('^#*\\\\s*'), '').trim() || APP_STATE.path
                        window.offlineStore.saveNote(APP_STATE.path, {
                            title,
                            content,
                            theme: APP_STATE.theme,
                            format: APP_STATE.editorFormat,
                            syncStatus: 'synced'
                        })
                    }
                    return true
                })
                .catch(error => {
                    showSaveStatus(error.message || 'save failed', true, 'error')
                    if (window.offlineStore) {
                        const title = String(content || '').split(new RegExp('[\\\\r\\\\n]+'))[0]?.replace(new RegExp('^#*\\\\s*'), '').trim() || APP_STATE.path
                        window.offlineStore.saveNote(APP_STATE.path, {
                            title,
                            content,
                            theme: APP_STATE.theme,
                            format: APP_STATE.editorFormat,
                            syncStatus: 'pending'
                        })
                    }
                    errHandle(error.message || error)
                    return false
                })
                .finally(() => {
                    saveInFlight = null
                    $loading.style.display = 'none'
                    if (saveQueued) {
                        saveQueued = false
                        if (hasUnsavedChanges() && APP_STATE.isPublished) {
                            window.setTimeout(() => saveCurrentNote({ showBlocked: false }), 0)
                        }
                    }
                })
            return saveInFlight
        }

        let localSaveTimer = null
        const saveToLocalIndexedDB = () => {
            if (localSaveTimer) clearTimeout(localSaveTimer)
            localSaveTimer = setTimeout(() => {
                if (!$textarea || !window.offlineStore) return
                const draftContent = $textarea.value
                const draftTitle = String(draftContent || '').split(new RegExp('[\\\\r\\\\n]+'))[0]?.replace(new RegExp('^#*\\\\s*'), '').trim() || APP_STATE.path
                window.offlineStore.saveNote(APP_STATE.path, {
                    title: draftTitle,
                    content: draftContent,
                    theme: APP_STATE.theme,
                    format: APP_STATE.editorFormat,
                    syncStatus: hasUnsavedChanges() ? (APP_STATE.isPublished ? 'pending' : 'draft') : 'synced'
                })
                if (hasUnsavedChanges()) {
                    showSaveStatus(APP_STATE.lang === 'zh-TW' ? '🟢 本機已存' : '🟢 Saved locally', false, 'local')
                }
            }, 300)
        }

        const scheduleAutosave = () => {
            clearAutosaveTimer()
            saveToLocalIndexedDB()
            if (!$textarea || !APP_STATE.isPublished || APP_STATE.autosave !== true || !hasUnsavedChanges()) return
            autosaveTimer = window.setTimeout(() => {
                autosaveTimer = null
                saveCurrentNote({ showBlocked: false })
            }, AUTOSAVE_IDLE_MS)
        }

        // Local-First: Flush pending cloud changes on page unload or visibility hide
        const flushPendingCloudSync = () => {
            if (!$textarea || !APP_STATE.isPublished || !hasUnsavedChanges()) return
            const content = $textarea.value
            try {
                const body = new URLSearchParams({ t: content })
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(window.location.pathname, body)
                } else {
                    fetch(window.location.pathname, { method: 'POST', body, keepalive: true })
                }
                savedContent = content
                window.offlineStore?.updateSyncStatus?.(APP_STATE.path, 'synced')
            } catch(e) {}
        }
        window.addEventListener('pagehide', flushPendingCloudSync)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') flushPendingCloudSync()
        })
        window.addEventListener('online', () => {
            if (hasUnsavedChanges() && APP_STATE.isPublished) {
                saveCurrentNote({ showBlocked: false })
            }
        })

        function getCurrentShareUrl() {
            if (!APP_STATE.shareId) return ''
            return new URL('/share/' + encodeURIComponent(APP_STATE.shareId), window.location.origin).toString()
        }

        setupShareHistory()
        syncShareStateUI()
        setupNoteHistory({
            textarea: $textarea,
            previewMarkdownNode: $previewMd,
            previewPlainNode: $previewPlain,
        })
        if (!APP_STATE.isBlock) {
            renderPlain($previewPlain, $textarea ? $textarea.value : '')
            triggerRender($previewMd, $textarea ? $textarea.value : '')
        }
        setupShareBackToTop($previewMd || $previewPlain)

        // New notes pair a random Tagore poem with one focused writing tip.
        // This is an overlay rather than a textarea placeholder so each part
        // can keep its own rhythm and disappear as soon as writing begins.
        const $welcome = document.querySelector('#editor-welcome')
        const $previewWelcome = document.querySelector('#preview-welcome')
        if (APP_STATE.isEdit && (APP_STATE.isNewEntry || hasPendingNewEntryWelcome()) && $textarea && ($welcome || $previewWelcome)) {
            const poemPromise = fetch('https://answerbook.david888.com/StrayBirds')
                .then(res => res.json())
                .catch(err => {
                    console.error('Failed to fetch StrayBirds poem:', err);
                    return null;
                });
            const tipsPromise = fetch('/data/editor-tips.json')
                .then(res => res.json())
                .catch(err => {
                    console.error('Failed to fetch editor tips:', err);
                    return null;
                });

            Promise.all([poemPromise, tipsPromise]).then(async ([poemData, tipsData]) => {
                const poem = poemData && poemData.poem;
                const tips = tipsData && Array.isArray(tipsData.tips) ? tipsData.tips : [];
                const randomTip = tips.length ? tips[Math.floor(Math.random() * tips.length)] : null;
                if (!poem && !randomTip) return;

                const isZh = APP_STATE.lang === 'zh-TW';

                const typeText = (element, text, speed = 22) => new Promise(resolve => {
                    let index = 0;
                    element.textContent = '';
                    element.classList.add('is-typing');
                    const timer = setInterval(() => {
                        if ($textarea.value) {
                            clearInterval(timer);
                            element.classList.remove('is-typing');
                            element.textContent = text;
                            resolve();
                            return;
                        }
                        if (index < text.length) {
                            element.textContent += text.charAt(index);
                            index++;
                        } else {
                            clearInterval(timer);
                            element.classList.remove('is-typing');
                            resolve();
                        }
                    }, speed);
                });

                const addWelcomeSection = async (kind, label, text, targetEl) => {
                    if (!targetEl) return;
                    const lines = String(text || '').split('\\n').map(line => line.trim()).filter(Boolean);
                    if (!lines.length) return;

                    const section = document.createElement('section');
                    section.className = 'editor-welcome__section editor-welcome__section--' + kind;
                    const heading = document.createElement('p');
                    heading.className = 'editor-welcome__label';
                    heading.textContent = label;
                    const copy = document.createElement('div');
                    copy.className = 'editor-welcome__copy';
                    section.append(heading, copy);
                    targetEl.appendChild(section);
                    targetEl.hidden = false;

                    for (const line of lines) {
                        if ($textarea.value) {
                            const paragraph = document.createElement('p');
                            paragraph.textContent = line;
                            copy.appendChild(paragraph);
                            continue;
                        }
                        const paragraph = document.createElement('p');
                        copy.appendChild(paragraph);
                        await typeText(paragraph, line, 22);
                    }
                };

                const poemTask = (poem && $welcome) ? addWelcomeSection(
                    'poem',
                    '📖 ' + (isZh ? (poem.title || '《飛鳥集》') : ('Stray Birds — No. ' + (poem.num || ''))),
                    isZh ? poem.chinese : poem.english,
                    $welcome,
                ) : Promise.resolve();

                let tipTask = Promise.resolve();
                if (randomTip) {
                    const tip = isZh ? randomTip['zh-TW'] : randomTip['en-US'];
                    const tipBody = String(tip || '').replace(/^(?:小訣竅|Tip)\s*[:：]\s*/, '');
                    const tipTarget = $previewWelcome || $welcome;
                    tipTask = addWelcomeSection('tip', isZh ? '💡 小訣竅' : '💡 A small tip', tipBody, tipTarget);
                }

                await Promise.all([poemTask, tipTask]);

                const syncWelcomeVisibility = () => {
                    const hasContent = Boolean($textarea.value);
                    if (hasContent) {
                        try {
                            window.sessionStorage.removeItem(NEW_ENTRY_WELCOME_STORAGE_KEY);
                        } catch (error) {}
                    }
                    if ($welcome) $welcome.hidden = hasContent || !$welcome.childElementCount;
                    if ($previewWelcome) $previewWelcome.hidden = hasContent || !$previewWelcome.childElementCount;
                };
                syncWelcomeVisibility();
                $textarea.addEventListener('input', syncWelcomeVisibility);
            });
        }

        const getCurrentMarkdownForExport = () => {
            if ($textarea) return $textarea.value || ''
            const article = document.querySelector('#bot-accessible-content')
            return article ? (article.textContent || '') : ''
        }

        const getCurrentHtmlForCopy = () => {
            const preview = $previewMd || $previewPlain
            return preview ? preview.dataset.copyHtml || preview.innerHTML || '' : ''
        }

        let copyResetTimer = null
        const showCopySuccess = () => {
            if (!$copyMdBtn) return
            window.clearTimeout(copyResetTimer)
            const label = $copyMdBtn.querySelector('.toolbar-button-label')
            const originalLabel = $copyMdBtn.dataset.originalLabel || label?.textContent || ''
            $copyMdBtn.dataset.originalLabel = originalLabel
            $copyMdBtn.classList.add('copy-success')
            $copyMdBtn.title = getI18n('copied') || 'Copied!'
            $copyMdBtn.setAttribute('aria-label', getI18n('copied') || 'Copied!')
            if (label) label.textContent = getI18n('copied') || 'Copied!'
            copyResetTimer = window.setTimeout(() => {
                $copyMdBtn.classList.remove('copy-success')
                $copyMdBtn.title = APP_STATE.lang === 'zh-TW' ? '複製內容' : 'Copy content'
                $copyMdBtn.setAttribute('aria-label', APP_STATE.lang === 'zh-TW' ? '複製內容' : 'Copy content')
                if (label) label.textContent = originalLabel
            }, 1600)
        }

        if ($copyMdBtn) {
            $copyMdBtn.addEventListener('click', async () => {
                try {
                    await copyRichClipboard(getCurrentMarkdownForExport(), getCurrentHtmlForCopy())
                    showCopySuccess()
                    window.showToast(getI18n('copied') || 'Copied!')
                } catch (error) {
                    console.error('Copy content failed:', error)
                    window.showToast(getI18n('copyFailed') || 'Copy failed')
                }
            })
        }

        window.getCurrentMarkdownForExport = getCurrentMarkdownForExport

        const $editorAiFormatBtn = document.querySelector('#editor-ai-format-btn')
        const $editorAiEditBtn = document.querySelector('#editor-ai-edit-btn')
        const $editorAiTranslateBtn = document.querySelector('#editor-ai-translate-btn')

        const runAiAssistant = async (mode, selectionRange = null) => {
            if (!$textarea) return;

            const rawText = $textarea.value || ''
            if (!rawText.trim()) {
                window.showToast(APP_STATE.lang === 'zh-TW' ? '請先輸入內容' : 'Please input content first')
                return;
            }

            const isEdit = mode === 'edit'
            const isTranslate = mode === 'translate'
            const supportsSelection = mode === 'edit' || mode === 'format' || mode === 'translate'
            const hasSavedSelection = supportsSelection
                && Number.isInteger(selectionRange?.start)
                && Number.isInteger(selectionRange?.end)
                && selectionRange.start >= 0
                && selectionRange.end > selectionRange.start
                && selectionRange.end <= rawText.length
            const selectionStart = supportsSelection
                ? (hasSavedSelection ? selectionRange.start : $textarea.selectionStart)
                : 0
            const selectionEnd = supportsSelection
                ? (hasSavedSelection ? selectionRange.end : $textarea.selectionEnd)
                : 0
            const hasSelection = supportsSelection && selectionEnd > selectionStart
            let targetLanguage = ''
            let bilingual = false
            if (isTranslate) {
                const textToAnalyze = hasSelection ? rawText.slice(selectionStart, selectionEnd) : rawText
                const isChinese = /\\p{Script=Han}/u.test(textToAnalyze)
                const defaultTargetLang = isChinese
                    ? (APP_STATE.lang === 'zh-TW' ? '英文' : 'English')
                    : (APP_STATE.lang === 'zh-TW' ? '繁體中文' : 'Traditional Chinese')
                const targetPrompt = APP_STATE.lang === 'zh-TW'
                    ? '請輸入目標語言，例如：英文、繁體中文、日文'
                    : 'Enter the target language, for example: English, Traditional Chinese, or Japanese'
                targetLanguage = typeof window.showAppPrompt === 'function'
                    ? await window.showAppPrompt({
                        title: APP_STATE.lang === 'zh-TW' ? '設定翻譯目標語言' : 'Set Target Language',
                        message: targetPrompt,
                        initialValue: defaultTargetLang,
                        inputType: 'text',
                        allowEmpty: false
                    })
                    : window.prompt(targetPrompt, defaultTargetLang)
                if (targetLanguage === null || !targetLanguage.trim()) return;
                bilingual = typeof window.showAppDialog === 'function'
                    ? await window.showAppDialog({
                        title: APP_STATE.lang === 'zh-TW' ? '雙語對照模式' : 'Bilingual Mode',
                        message: APP_STATE.lang === 'zh-TW'
                            ? '要保留原文並產生雙語版本嗎？\\n選擇「雙語對照」將在譯文下方保留原文段落。'
                            : 'Keep the original text to create a bilingual parallel version?',
                        kind: 'confirm',
                        confirm: true,
                        confirmText: APP_STATE.lang === 'zh-TW' ? '雙語對照' : 'Bilingual',
                        cancelText: APP_STATE.lang === 'zh-TW' ? '僅翻譯' : 'Translate Only'
                    })
                    : window.confirm(APP_STATE.lang === 'zh-TW'
                        ? '要保留原文並產生雙語版本嗎？\\n選擇「確定」＝雙語；「取消」＝只翻譯。'
                        : 'Keep the original and create a bilingual version?\\nOK = bilingual; Cancel = translation only.')
            }
            const instructionPrompt = isEdit
                ? (APP_STATE.lang === 'zh-TW'
                    ? (hasSelection
                        ? '請輸入圈選文字的修改要求，例如：精簡、改寫語氣、修正文句'
                        : '請輸入編輯要求，例如：在第二段後插入一段說明，或全文微調但保留原意')
                    : (hasSelection
                        ? 'Enter instructions for the selected text, for example: shorten it, change its tone, or improve the wording'
                        : 'Enter editing instructions, for example: insert a paragraph after section two, or refine the full note while preserving its meaning'))
                : (APP_STATE.lang === 'zh-TW'
                    ? '請輸入排版需求，例如：補標題、整理段落、改成條列重點'
                    : 'Enter formatting instructions, for example: add headings, clean paragraphs, and turn key points into bullets')
            const instruction = isTranslate
                ? ''
                : (typeof window.showAppPrompt === 'function'
                    ? await window.showAppPrompt({
                        title: isEdit ? (APP_STATE.lang === 'zh-TW' ? 'AI 編輯要求' : 'AI Edit Instructions') : (APP_STATE.lang === 'zh-TW' ? 'AI 排版需求' : 'AI Format Instructions'),
                        message: instructionPrompt,
                        initialValue: '',
                        inputType: 'text',
                        allowEmpty: !isEdit
                    })
                    : window.prompt(instructionPrompt, ''))
            if (instruction === null) return;
            if (isEdit && !instruction.trim()) {
                window.showToast(APP_STATE.lang === 'zh-TW' ? '請輸入編輯要求' : 'Please enter editing instructions')
                return;
            }

            const loadingMsg = APP_STATE.lang === 'zh-TW' ? 'AI 正在處理中，請稍候...' : 'AI processing, please wait...'
            window.showToast(loadingMsg)

            if ($editorAiFormatBtn) $editorAiFormatBtn.disabled = true
            if ($editorAiEditBtn) $editorAiEditBtn.disabled = true
            if ($editorAiTranslateBtn) $editorAiTranslateBtn.disabled = true

            try {
                const res = await fetchJson('/' + encodeURIComponent(APP_STATE.path || '') + '/ai-format', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: rawText, mode, instruction, selectionStart, selectionEnd, targetLanguage, bilingual })
                }, 130000)

                if (res.err === 0 && res.data?.result) {
                    if (res.data.scope === 'selection' && hasSelection) {
                        $textarea.value = rawText.slice(0, selectionStart) + res.data.result + rawText.slice(selectionEnd)
                        const nextCursor = selectionStart + res.data.result.length
                        $textarea.setSelectionRange(selectionStart, nextCursor)
                    } else {
                        $textarea.value = res.data.result
                    }
                    renderPlain($previewPlain, $textarea.value)
                    triggerRender($previewMd, $textarea.value)
                    $textarea.dispatchEvent(new Event('input', { bubbles: true }))
                    window.showToast(APP_STATE.lang === 'zh-TW' ? 'AI 輔助完成' : 'AI completed')
                    return;
                }

                window.showAppDialog({ title: getI18n('err'), message: (APP_STATE.lang === 'zh-TW' ? 'AI 處理失敗：' : 'AI processing failed: ') + (res.msg || 'Unknown error'), kind: 'error' })
            } catch (err) {
                console.error('AI assistant error:', err)
                const message = err && err.name === 'AbortError'
                    ? (APP_STATE.lang === 'zh-TW' ? 'AI 處理逾時，請再試一次' : 'AI request timed out, please try again')
                    : ((APP_STATE.lang === 'zh-TW' ? 'AI 處理錯誤：' : 'AI processing error: ') + err.message)
                window.showAppDialog({ title: getI18n('err'), message, kind: 'error' })
            } finally {
                if ($editorAiFormatBtn) $editorAiFormatBtn.disabled = false
                if ($editorAiEditBtn) $editorAiEditBtn.disabled = false
                if ($editorAiTranslateBtn) $editorAiTranslateBtn.disabled = false
            }
        }

        if ($editorAiFormatBtn) {
            $editorAiFormatBtn.addEventListener('click', () => runAiAssistant('format'))
        }
        if ($editorAiEditBtn) {
            $editorAiEditBtn.addEventListener('click', () => runAiAssistant('edit'))
        }
        if ($editorAiTranslateBtn) {
            $editorAiTranslateBtn.addEventListener('click', () => runAiAssistant('translate'))
        }

        if ($textarea) {
            let selectionAiRange = null
            const selectionAiActions = [
                {
                    mode: 'format',
                    label: APP_STATE.lang === 'zh-TW' ? '排版' : 'Format',
                    ariaLabel: APP_STATE.lang === 'zh-TW' ? '使用 AI 排版圈選文字' : 'Format selected text with AI',
                },
                {
                    mode: 'edit',
                    label: APP_STATE.lang === 'zh-TW' ? 'AI 編輯' : 'AI Edit',
                    ariaLabel: APP_STATE.lang === 'zh-TW' ? '使用 AI 編輯圈選文字' : 'Edit selected text with AI',
                },
                {
                    mode: 'translate',
                    label: APP_STATE.lang === 'zh-TW' ? '翻譯' : 'Translate',
                    ariaLabel: APP_STATE.lang === 'zh-TW' ? '使用 AI 翻譯圈選文字' : 'Translate selected text with AI',
                },
            ]
            const selectionAiMenu = document.createElement('div')
            selectionAiMenu.className = 'selection-ai-menu'
            selectionAiMenu.setAttribute('role', 'toolbar')
            selectionAiMenu.setAttribute('aria-label', APP_STATE.lang === 'zh-TW' ? '圈選文字 AI 工具' : 'Selected text AI tools')
            selectionAiActions.forEach(({ mode, label, ariaLabel }) => {
                const button = document.createElement('button')
                button.type = 'button'
                button.className = 'selection-ai-button'
                button.textContent = label
                button.setAttribute('aria-label', ariaLabel)
                button.addEventListener('pointerdown', event => event.preventDefault())
                button.addEventListener('mousedown', event => event.preventDefault())
                button.addEventListener('click', () => {
                    const selectedRange = selectionAiRange
                    hideSelectionAiMenu()
                    runAiAssistant(mode, selectedRange)
                })
                selectionAiMenu.appendChild(button)
            })
            document.body.appendChild(selectionAiMenu)

            const hideSelectionAiMenu = () => selectionAiMenu.classList.remove('visible')
            const showSelectionAiMenu = event => {
                if ($textarea.selectionEnd <= $textarea.selectionStart) {
                    selectionAiRange = null
                    hideSelectionAiMenu()
                    return
                }
                selectionAiRange = {
                    start: $textarea.selectionStart,
                    end: $textarea.selectionEnd,
                }
                const editorRect = $textarea.getBoundingClientRect()
                const left = event?.clientX || editorRect.right - 180
                const top = event?.clientY || editorRect.top + 16
                selectionAiMenu.style.left = Math.min(window.innerWidth - 210, Math.max(8, left + 10)) + 'px'
                selectionAiMenu.style.top = Math.min(window.innerHeight - 48, Math.max(8, top - 42)) + 'px'
                selectionAiMenu.classList.add('visible')
            }

            $textarea.addEventListener('mouseup', showSelectionAiMenu)
            $textarea.addEventListener('keyup', event => {
                if (event.shiftKey) showSelectionAiMenu()
            })
            $textarea.addEventListener('input', () => {
                selectionAiRange = null
                hideSelectionAiMenu()
            })
            $textarea.addEventListener('scroll', hideSelectionAiMenu, { passive: true })
            window.addEventListener('resize', hideSelectionAiMenu)

            initEditorSearchReplace();
            initAlertAutocomplete();
        }

        function initEditorSearchReplace() {
            const bar = document.getElementById('editor-search-bar');
            const searchInput = document.getElementById('editor-search-input');
            const replaceInput = document.getElementById('editor-replace-input');
            const replaceRow = document.getElementById('editor-replace-row');
            const searchCount = document.getElementById('editor-search-count');
            const caseBtn = document.getElementById('editor-search-case');
            const wordBtn = document.getElementById('editor-search-word');
            const regexBtn = document.getElementById('editor-search-regex');
            const prevBtn = document.getElementById('editor-search-prev');
            const nextBtn = document.getElementById('editor-search-next');
            const toggleReplaceBtn = document.getElementById('editor-search-toggle-replace');
            const closeBtn = document.getElementById('editor-search-close');
            const replaceBtn = document.getElementById('editor-replace-btn');
            const replaceAllBtn = document.getElementById('editor-replace-all-btn');
            const textarea = document.getElementById('contents');

            if (!bar || !searchInput || !textarea) return;

            let matches = [];
            let currentMatchIndex = -1;
            let matchCase = false;
            let matchWord = false;
            let useRegex = false;

            const updateSearchCount = () => {
                if (!searchCount) return;
                if (!searchInput.value || matches.length === 0) {
                    searchCount.textContent = '0 / 0';
                } else {
                    searchCount.textContent = (currentMatchIndex + 1) + ' / ' + matches.length;
                }
            };

            const findMatches = () => {
                const query = searchInput.value;
                matches = [];
                currentMatchIndex = -1;
                if (!query || !textarea.value) {
                    updateSearchCount();
                    return;
                }

                try {
                    let pattern;
                    if (useRegex) {
                        pattern = new RegExp(query, matchCase ? 'g' : 'gi');
                    } else {
                        const escaped = query.replace(/[\^$.*+?()[\]{}|\\]/g, '\\\\$&');
                        const wordPattern = matchWord ? ('\\\\b' + escaped + '\\\\b') : escaped;
                        pattern = new RegExp(wordPattern, matchCase ? 'g' : 'gi');
                    }

                    const text = textarea.value;
                    let m;
                    while ((m = pattern.exec(text)) !== null) {
                        matches.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
                        if (m.index === pattern.lastIndex) pattern.lastIndex++;
                    }
                } catch (e) {
                    matches = [];
                }

                if (matches.length > 0) {
                    const selStart = textarea.selectionStart;
                    const nextIdx = matches.findIndex(match => match.start >= selStart);
                    currentMatchIndex = nextIdx !== -1 ? nextIdx : 0;
                    highlightMatch(currentMatchIndex, false);
                }
                updateSearchCount();
            };

            const highlightMatch = (index, doFocus = true) => {
                if (index < 0 || index >= matches.length) return;
                const match = matches[index];
                textarea.setSelectionRange(match.start, match.end);
                if (doFocus) textarea.focus();
                updateSearchCount();
            };

            window.toggleEditorSearchReplace = (showReplace = false) => {
                if (bar.classList.contains('hide')) {
                    bar.classList.remove('hide');
                    if (showReplace && replaceRow) replaceRow.classList.remove('hide');
                    const sel = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
                    if (sel && sel.indexOf('\\n') === -1) {
                        searchInput.value = sel;
                    }
                    findMatches();
                    if (showReplace && replaceInput) {
                        replaceInput.focus();
                    } else {
                        searchInput.focus();
                        searchInput.select();
                    }
                } else if (showReplace && replaceRow && replaceRow.classList.contains('hide')) {
                    replaceRow.classList.remove('hide');
                    replaceInput?.focus();
                } else {
                    bar.classList.add('hide');
                    textarea.focus();
                }
            };

            searchInput.addEventListener('input', findMatches);

            if (caseBtn) caseBtn.addEventListener('click', () => {
                matchCase = !matchCase;
                caseBtn.classList.toggle('is-active', matchCase);
                findMatches();
            });

            if (wordBtn) wordBtn.addEventListener('click', () => {
                matchWord = !matchWord;
                wordBtn.classList.toggle('is-active', matchWord);
                findMatches();
            });

            if (regexBtn) regexBtn.addEventListener('click', () => {
                useRegex = !useRegex;
                regexBtn.classList.toggle('is-active', useRegex);
                findMatches();
            });

            const gotoNext = () => {
                if (matches.length === 0) return;
                currentMatchIndex = (currentMatchIndex + 1) % matches.length;
                highlightMatch(currentMatchIndex);
            };

            const gotoPrev = () => {
                if (matches.length === 0) return;
                currentMatchIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
                highlightMatch(currentMatchIndex);
            };

            if (nextBtn) nextBtn.addEventListener('click', gotoNext);
            if (prevBtn) prevBtn.addEventListener('click', gotoPrev);

            if (toggleReplaceBtn) toggleReplaceBtn.addEventListener('click', () => {
                if (replaceRow) {
                    replaceRow.classList.toggle('hide');
                    if (!replaceRow.classList.contains('hide')) replaceInput?.focus();
                }
            });

            if (closeBtn) closeBtn.addEventListener('click', () => {
                bar.classList.add('hide');
                textarea.focus();
            });

            const replaceCurrent = () => {
                if (matches.length === 0 || currentMatchIndex < 0) return;
                const match = matches[currentMatchIndex];
                const repVal = replaceInput ? replaceInput.value : '';
                const before = textarea.value.slice(0, match.start);
                const after = textarea.value.slice(match.end);
                textarea.value = before + repVal + after;
                textarea.dispatchEvent(new Event('input'));
                findMatches();
            };

            const replaceAll = () => {
                if (matches.length === 0) return;
                const count = matches.length;
                const repVal = replaceInput ? replaceInput.value : '';
                let query = searchInput.value;
                let pattern;
                if (useRegex) {
                    pattern = new RegExp(query, matchCase ? 'g' : 'gi');
                } else {
                    const escaped = query.replace(/[\^$.*+?()[\]{}|\\]/g, '\\\\$&');
                    const wordPattern = matchWord ? ('\\\\b' + escaped + '\\\\b') : escaped;
                    pattern = new RegExp(wordPattern, matchCase ? 'g' : 'gi');
                }
                textarea.value = textarea.value.replace(pattern, repVal);
                textarea.dispatchEvent(new Event('input'));
                findMatches();
                if (window.showToast) {
                    window.showToast(APP_STATE.lang === 'zh-TW' ? ('已取代 ' + count + ' 處內容') : ('Replaced ' + count + ' occurrences'));
                }
            };

            if (replaceBtn) replaceBtn.addEventListener('click', replaceCurrent);
            if (replaceAllBtn) replaceAllBtn.addEventListener('click', replaceAll);

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) gotoPrev();
                    else gotoNext();
                } else if (e.key === 'Escape') {
                    bar.classList.add('hide');
                    textarea.focus();
                }
            });

            if (replaceInput) replaceInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.altKey) replaceAll();
                    else replaceCurrent();
                } else if (e.key === 'Escape') {
                    bar.classList.add('hide');
                    textarea.focus();
                }
            });

            document.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F') && !e.shiftKey && !e.altKey) {
                    if (document.activeElement === textarea || bar.contains(document.activeElement)) {
                        e.preventDefault();
                        window.toggleEditorSearchReplace(false);
                    }
                } else if ((e.metaKey || e.ctrlKey) && (e.key === 'h' || e.key === 'H' || (e.altKey && (e.key === 'f' || e.key === 'F')))) {
                    if (document.activeElement === textarea || bar.contains(document.activeElement)) {
                        e.preventDefault();
                        window.toggleEditorSearchReplace(true);
                    }
                }
            });
        }

        function initAlertAutocomplete() {
            const popup = document.getElementById('editor-alert-autocomplete');
            const textarea = document.getElementById('contents');
            if (!popup || !textarea) return;

            let selectedIndex = 0;
            const options = Array.from(popup.querySelectorAll('.alert-option'));

            const hideAlertPopup = () => {
                popup.classList.add('hide');
            };

            const selectOptionIndex = (idx) => {
                selectedIndex = (idx + options.length) % options.length;
                options.forEach((opt, i) => opt.classList.toggle('is-selected', i === selectedIndex));
            };

            const insertAlert = (type) => {
                const text = textarea.value;
                const pos = textarea.selectionStart;
                const lineStart = text.lastIndexOf('\\n', pos - 1) + 1;
                const lineBeforeCursor = text.slice(lineStart, pos);
                const prefixMatch = lineBeforeCursor.match(new RegExp('>\\\\\\\\s*\\\\[!?([a-zA-Z]*)$'));
                if (!prefixMatch) return;

                const replaceStart = lineStart + prefixMatch.index;
                const replacement = '> [!' + type + ']\\n> ';
                const before = text.slice(0, replaceStart);
                const after = text.slice(pos);

                textarea.value = before + replacement + after;
                const newPos = before.length + replacement.length;
                textarea.setSelectionRange(newPos, newPos);
                textarea.focus();
                textarea.dispatchEvent(new Event('input'));
                hideAlertPopup();
            };

            options.forEach((opt, i) => {
                opt.addEventListener('click', () => {
                    const type = opt.getAttribute('data-alert-type');
                    insertAlert(type);
                });
                opt.addEventListener('mouseenter', () => selectOptionIndex(i));
            });

            textarea.addEventListener('keyup', (e) => {
                if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key) && !popup.classList.contains('hide')) {
                    return;
                }
                const pos = textarea.selectionStart;
                const text = textarea.value;
                const lineStart = text.lastIndexOf('\\n', pos - 1) + 1;
                const line = text.slice(lineStart, pos);

                if (new RegExp('>\\\\\\\\s*\\\\[!?[a-zA-Z]*$').test(line)) {
                    popup.classList.remove('hide');
                    selectOptionIndex(0);
                } else {
                    hideAlertPopup();
                }
            });

            textarea.addEventListener('keydown', (e) => {
                if (popup.classList.contains('hide')) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectOptionIndex(selectedIndex + 1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectOptionIndex(selectedIndex - 1);
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    const type = options[selectedIndex]?.getAttribute('data-alert-type') || 'NOTE';
                    insertAlert(type);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    hideAlertPopup();
                }
            });

            document.addEventListener('click', (e) => {
                if (!popup.contains(e.target) && e.target !== textarea) {
                    hideAlertPopup();
                }
            });
        }

        const showImportOptionDialog = ({ block = false } = {}) => new Promise(resolve => {
            const modal = document.querySelector('.import-options-modal')
            if (!modal) {
                resolve('replace')
                return
            }
            const cancelBtn = modal.querySelector('.import-action-cancel')
            const insertBtn = modal.querySelector('.import-action-insert')
            const replaceBtn = modal.querySelector('.import-action-replace')
            const mask = modal.querySelector('.modal-mask')
            const message = modal.querySelector('#import-options-message')

            if (!cancelBtn || !insertBtn || !replaceBtn || !mask) {
                resolve('replace')
                return
            }

            const originalMessage = message?.textContent || ''
            const originalInsertLabel = insertBtn.textContent || ''
            if (block) {
                if (message) message.textContent = getI18n('importBlockMessage')
                insertBtn.textContent = getI18n('importActionInsertBlock')
            }

            let settled = false
            const cleanup = (choice) => {
                if (settled) return
                settled = true
                closeModal(modal)
                cancelBtn.removeEventListener('click', onCancel)
                insertBtn.removeEventListener('click', onInsert)
                replaceBtn.removeEventListener('click', onReplace)
                mask.removeEventListener('click', onCancel)
                modal.removeEventListener('keydown', onKeyDown)
                if (message) message.textContent = originalMessage
                insertBtn.textContent = originalInsertLabel
                resolve(choice)
            }

            const onCancel = () => cleanup('cancel')
            const onInsert = () => cleanup('insert')
            const onReplace = () => cleanup('replace')
            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault()
                    onCancel()
                }
            }

            openModal(modal, { initialFocus: replaceBtn })
            cancelBtn.addEventListener('click', onCancel)
            insertBtn.addEventListener('click', onInsert)
            replaceBtn.addEventListener('click', onReplace)
            mask.addEventListener('click', onCancel)
            modal.addEventListener('keydown', onKeyDown)
        })

        const $dropdownImportDocBtn = document.querySelector('#dropdown-import-doc-btn')
        const $dropdownRecordAudioBtn = document.querySelector('#dropdown-record-audio-btn')
        const $dropdownImportAudioBtn = document.querySelector('#dropdown-import-audio-btn')
        const $dropdownImportAudioSmartFormatBtn = document.querySelector('#dropdown-import-audio-smart-format-btn')
        const $importAudioInput = document.querySelector('#import-audio-input')
        const $importAudioSmartFormatInput = document.querySelector('#import-audio-smart-format-input')
        if ($dropdownImportDocBtn && $importMdInput) {
            $dropdownImportDocBtn.addEventListener('click', () => {
                $importMdInput.click()
            })
        }
        if ($dropdownRecordAudioBtn) {
            $dropdownRecordAudioBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('cf-notepad-start-record'))
            })
        }
        if ($dropdownImportAudioBtn && $importAudioInput) {
            $dropdownImportAudioBtn.addEventListener('click', () => {
                $importAudioInput.click()
            })
        }
        if ($dropdownImportAudioSmartFormatBtn && $importAudioSmartFormatInput) {
            $dropdownImportAudioSmartFormatBtn.addEventListener('click', () => {
                $importAudioSmartFormatInput.click()
            })
        }

        const isCurrentMarkdownEditor = () => APP_STATE.isEdit === true && APP_STATE.editorFormat === 'markdown' && Boolean($textarea)
        const isCurrentBlockEditor = () => APP_STATE.isEdit === true && APP_STATE.editorFormat === 'block'
        const blockNodeHasContent = node => {
            if (!node || typeof node !== 'object') return false
            if (typeof node.text === 'string' && node.text.trim()) return true
            if (node.type && node.type !== 'doc' && node.type !== 'paragraph') return true
            return Array.isArray(node.content) && node.content.some(blockNodeHasContent)
        }
        const blockEditorHasContent = () => {
            if (!$textarea) return false
            try {
                const document = JSON.parse($textarea.value || '{}')
                return Array.isArray(document.content) && document.content.some(blockNodeHasContent)
            } catch {
                return Boolean($textarea.value && $textarea.value.trim())
            }
        }
        const processAudioTranscription = async (file, { smartFormat = false, insertAtCursor = false, targetAudioUrl = '', targetAudioId = '' } = {}) => {
            let insertMode = insertAtCursor ? 'insert' : 'replace'
            if (!insertAtCursor && !targetAudioUrl && !targetAudioId && isCurrentMarkdownEditor() && $textarea.value && $textarea.value.trim().length > 0) {
                insertMode = await showImportOptionDialog()
            }
            if (insertMode === 'cancel') return

            try {
                const toastMsg = smartFormat
                    ? (getI18n('transcribingAudioSmartFormat') || '正在轉錄音訊並使用 AI 智慧整理排版...')
                    : (getI18n('transcribingAudio') || '正在使用 AI (Whisper) 轉錄音訊為純逐字稿...')
                if (typeof window.showToast === 'function') {
                    window.showToast(toastMsg)
                }

                const formData = new FormData()
                formData.append('file', file)
                const transcribeUrl = smartFormat ? '/api/audio/transcribe?format=smart' : '/api/audio/transcribe'
                const response = await fetch(transcribeUrl, {
                    method: 'POST',
                    body: formData
                })
                const responseText = await response.text()
                let resJson = null
                try {
                    resJson = JSON.parse(responseText)
                } catch (parseErr) {
                    if (responseText && responseText.length < 300 && !responseText.includes('<')) {
                        throw new Error(responseText)
                    }
                    if (!response.ok) {
                        throw new Error('轉錄伺服器回應異常 (HTTP ' + response.status + ')')
                    }
                    throw new Error('伺服器未回傳有效 JSON 格式')
                }
                if (resJson.err !== 0) {
                    let errMsg = resJson.msg || getI18n('audioTranscribeFailed') || '音訊轉錄失敗'
                    try {
                        const unquoted = JSON.parse(errMsg)
                        if (typeof unquoted === 'string') errMsg = unquoted
                    } catch {}
                    throw new Error(errMsg)
                }
                const transcript = resJson.data?.markdown || resJson.data?.text || ''
                if (!transcript) {
                    throw new Error('未取得有效逐字稿內容')
                }

                if (isCurrentBlockEditor()) {
                    await importIntoBlockEditor(transcript)
                } else if (isCurrentMarkdownEditor()) {
                    const targetKey = targetAudioId || targetAudioUrl
                    if (targetKey && $textarea.value && $textarea.value.includes(targetKey)) {
                        const curVal = $textarea.value
                        const idx = curVal.indexOf(targetKey)
                        const tagEndIdx = curVal.indexOf('</audio>', idx)
                        if (tagEndIdx !== -1) {
                            const insertPos = tagEndIdx + '</audio>'.length
                            const insertion = '\\n\\n' + transcript + '\\n\\n'
                            $textarea.value = curVal.substring(0, insertPos) + insertion + curVal.substring(insertPos)
                        } else {
                            $textarea.value = curVal + '\\n\\n' + transcript + '\\n\\n'
                        }
                        renderPlain($previewPlain, $textarea.value)
                        triggerRender($previewMd, $textarea.value)
                        $textarea.dispatchEvent(new Event('input', { bubbles: true }))
                    } else if (insertMode === 'insert') {
                        const startPos = typeof $textarea.selectionStart === 'number' ? $textarea.selectionStart : $textarea.value.length
                        const endPos = typeof $textarea.selectionEnd === 'number' ? $textarea.selectionEnd : $textarea.value.length
                        const curVal = $textarea.value
                        const prefix = startPos > 0 && !curVal.substring(0, startPos).endsWith('\\n') ? '\\n\\n' : ''
                        const suffix = endPos < curVal.length && !curVal.substring(endPos).startsWith('\\n') ? '\\n\\n' : ''
                        const insertion = prefix + transcript + suffix
                        $textarea.value = curVal.substring(0, startPos) + insertion + curVal.substring(endPos)
                        $textarea.setSelectionRange(startPos + insertion.length, startPos + insertion.length)
                        renderPlain($previewPlain, $textarea.value)
                        triggerRender($previewMd, $textarea.value)
                        $textarea.dispatchEvent(new Event('input', { bubbles: true }))
                    } else {
                        $textarea.value = transcript
                        renderPlain($previewPlain, $textarea.value)
                        triggerRender($previewMd, $textarea.value)
                        $textarea.dispatchEvent(new Event('input', { bubbles: true }))
                    }
                } else {
                    await createMarkdownNoteFromImport(transcript)
                }

                if (typeof window.showToast === 'function') {
                    window.showToast(smartFormat
                        ? (getI18n('audioSmartFormatted') || '音訊逐字稿已成功智慧整理排版！')
                        : (getI18n('audioTranscribed') || '音訊已成功轉錄為逐字稿！'))
                }
            } catch (err) {
                console.error('Audio transcription failed:', err)
                const msg = (err && err.message) ? err.message : (getI18n('audioTranscribeFailed') || '音訊轉錄失敗')
                window.showAppDialog({ title: getI18n('err'), message: msg, kind: 'error' })
            }
        }

        const createMarkdownNoteFromImport = async importedText => {
            if (typeof window.showToast === 'function') window.showToast(getI18n('creatingMarkdownNote') || 'Creating Markdown note...')
            const createRes = await fetch('/api/new-note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: importedText, editorFormat: 'markdown' })
            })
            const createData = await createRes.json().catch(() => ({}))
            if (createData && createData.data && createData.data.url) {
                window.location.href = createData.data.url
            } else {
                window.location.href = '/new/markdown'
            }
        }
        const importIntoBlockEditor = async (importedText, importedTitle = '') => {
            let insertMode = 'replace'
            if (blockEditorHasContent()) insertMode = await showImportOptionDialog({ block: true })
            if (insertMode === 'cancel') return false

            window.dispatchEvent(new CustomEvent('cf-notepad-block-import', {
                detail: { markdown: importedText, mode: insertMode },
            }))
            if (typeof window.showToast === 'function') {
                window.showToast(importedTitle
                    ? '已成功匯入「' + importedTitle + '」，並轉換為 Block 區塊。'
                    : '內容已成功轉換為 Block 區塊。')
            }
            return true
        }

        // URL to Markdown Import Modal Handler
        const $dropdownImportUrlBtn = document.querySelector('#dropdown-import-url-btn')
        const $urlImportModal = document.querySelector('#url-import-modal')
        const $urlImportMask = document.querySelector('#url-import-mask')
        const $urlImportCloseBtn = document.querySelector('#url-import-close-btn')
        const $urlImportCancelBtn = document.querySelector('#url-import-cancel-btn')
        const $urlImportForm = document.querySelector('#url-import-form')
        const $urlImportInput = document.querySelector('#url-import-input')
        const $urlImportStatus = document.querySelector('#url-import-status')
        const $urlImportSubmitBtn = document.querySelector('#url-import-submit-btn')

        const openUrlImportModal = () => {
            if (!$urlImportModal) return
            openModal($urlImportModal, { initialFocus: $urlImportInput, trigger: $dropdownImportUrlBtn })
            if ($urlImportInput) {
                $urlImportInput.value = ''
                $urlImportInput.focus()
            }
            if ($urlImportStatus) {
                $urlImportStatus.style.display = 'none'
                $urlImportStatus.textContent = ''
            }
            if ($urlImportSubmitBtn) $urlImportSubmitBtn.disabled = false
        }

        const closeUrlImportModal = () => {
            if (!$urlImportModal) return
            closeModal($urlImportModal)
        }

        if ($dropdownImportUrlBtn) {
            $dropdownImportUrlBtn.addEventListener('click', openUrlImportModal)
        }
        if ($urlImportMask) $urlImportMask.addEventListener('click', closeUrlImportModal)
        if ($urlImportCloseBtn) $urlImportCloseBtn.addEventListener('click', closeUrlImportModal)
        if ($urlImportCancelBtn) $urlImportCancelBtn.addEventListener('click', closeUrlImportModal)

        if ($urlImportForm && $urlImportInput && $urlImportStatus && $urlImportSubmitBtn) {
            $urlImportForm.addEventListener('submit', async (e) => {
                e.preventDefault()
                const targetUrl = $urlImportInput.value ? $urlImportInput.value.trim() : ''
                if (!targetUrl) return

                $urlImportSubmitBtn.disabled = true
                $urlImportStatus.style.display = 'block'
                $urlImportStatus.style.background = 'rgba(59, 130, 246, 0.1)'
                $urlImportStatus.style.color = 'var(--text-color, #2563eb)'
                $urlImportStatus.textContent = '⏳ 正在從網頁擷取並轉換 Markdown，請稍候...'

                try {
                    const res = await fetch('/api/url2md', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: targetUrl })
                    })
                    const data = await res.json().catch(() => ({}))

                    if (!res.ok || data.err !== 0 || !data.data || !data.data.content) {
                        const errMsg = (data && data.msg) ? data.msg : '網址解析失敗，請確認網址可公開存取';
                        $urlImportStatus.style.background = 'rgba(239, 68, 68, 0.1)'
                        $urlImportStatus.style.color = '#dc2626'
                        $urlImportStatus.textContent = '❌ ' + errMsg
                        $urlImportSubmitBtn.disabled = false
                        return
                    }

                    const importedContent = data.data.content || ''
                    const importedTitle = data.data.title || ''

                    closeUrlImportModal()

                    if (isCurrentBlockEditor()) {
                        await importIntoBlockEditor(importedContent, importedTitle)
                    } else if (isCurrentMarkdownEditor()) {
                        let insertMode = 'replace'
                        if ($textarea.value && $textarea.value.trim().length > 0) {
                            insertMode = await showImportOptionDialog()
                        }
                        if (insertMode === 'cancel') return

                        if (insertMode === 'insert') {
                            const startPos = typeof $textarea.selectionStart === 'number' ? $textarea.selectionStart : $textarea.value.length
                            const curVal = $textarea.value
                            $textarea.value = curVal.substring(0, startPos) + importedContent + curVal.substring(startPos)
                        } else {
                            $textarea.value = importedContent
                        }

                        renderPlain($previewPlain, $textarea.value)
                        triggerRender($previewMd, $textarea.value)
                        $textarea.dispatchEvent(new Event('input', { bubbles: true }))
                        if (typeof window.showToast === 'function') {
                            window.showToast(importedTitle ? ('已成功匯入「' + importedTitle + '」') : '網頁已成功轉為 Markdown 匯入！')
                        }
                    } else {
                        await createMarkdownNoteFromImport(importedContent)
                    }
                } catch (err) {
                    $urlImportStatus.style.background = 'rgba(239, 68, 68, 0.1)'
                    $urlImportStatus.style.color = '#dc2626'
                    $urlImportStatus.textContent = '❌ 連線發生錯誤：' + (err ? err.message : '')
                    $urlImportSubmitBtn.disabled = false
                }
            })
        }

        if ($importMdInput) {
            if ($importMdBtn) $importMdBtn.addEventListener('click', () => {
                $importMdInput.click()
            })
            $importMdInput.addEventListener('change', async () => {
                const file = $importMdInput.files && $importMdInput.files[0]
                if (!file) return;

                let insertMode = 'replace';
                if (isCurrentMarkdownEditor() && $textarea.value && $textarea.value.trim().length > 0) {
                    insertMode = await showImportOptionDialog();
                }

                if (insertMode === 'cancel') {
                    $importMdInput.value = '';
                    return;
                }

                const fileName = file.name || '';
                const ext = (fileName.includes('.') ? fileName.split('.').pop() : '').toLowerCase();
                const isPlainMd = ['md', 'markdown', 'txt'].includes(ext) || file.type === 'text/markdown' || file.type === 'text/plain';
                const isAudio = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm', 'flac', 'mp4', 'm4v', 'opus'].includes(ext) || file.type.startsWith('audio/') || file.type === 'video/mp4';

                const applyImportedContent = async (importedText, isDoc = false) => {
                    if (isCurrentBlockEditor()) {
                        await importIntoBlockEditor(importedText)
                        $importMdInput.value = ''
                        return
                    }
                    if (!isCurrentMarkdownEditor()) {
                        await createMarkdownNoteFromImport(importedText)
                        return
                    }

                    if (insertMode === 'insert') {
                        const startPos = typeof $textarea.selectionStart === 'number' ? $textarea.selectionStart : $textarea.value.length;
                        const endPos = typeof $textarea.selectionEnd === 'number' ? $textarea.selectionEnd : $textarea.value.length;
                        const curVal = $textarea.value;
                        $textarea.value = curVal.substring(0, startPos) + importedText + curVal.substring(endPos);
                        const nextPos = startPos + importedText.length;
                        if (typeof $textarea.setSelectionRange === 'function') {
                            $textarea.setSelectionRange(nextPos, nextPos);
                        }
                    } else {
                        $textarea.value = importedText;
                    }

                    renderPlain($previewPlain, $textarea.value)
                    triggerRender($previewMd, $textarea.value)
                    $textarea.dispatchEvent(new Event('input', { bubbles: true }))
                    window.showToast(isDoc ? (getI18n('documentImported') || 'Document imported.') : getI18n('markdownImported'))
                    $importMdInput.value = ''
                }

                const handleImportError = (errorDetail) => {
                    const msg = (errorDetail && errorDetail.message) ? errorDetail.message : getI18n('markdownImportFailed');
                    window.showAppDialog({ title: getI18n('err'), message: msg, kind: 'error' })
                    $importMdInput.value = ''
                }

                if (isPlainMd) {
                    const reader = new FileReader()
                    reader.onload = () => applyImportedContent(typeof reader.result === 'string' ? reader.result : '', false).catch(handleImportError)
                    reader.onerror = () => handleImportError()
                    reader.readAsText(file, 'utf-8')
                } else if (isAudio) {
                    await processAudioTranscription(file, { smartFormat: false })
                } else {
                    try {
                        if (typeof window.showToast === 'function') {
                            window.showToast(getI18n('convertingDocument') || 'Converting document to Markdown...')
                        }
                        let anydocModule
                        try {
                            anydocModule = await import('/wasm/anydoc_wasm.js')
                        } catch (localErr) {
                            console.warn('Local WASM load failed, falling back to CDN:', localErr)
                            anydocModule = await import('https://esm.sh/@firecrawl/anydoc-wasm@0.1.6')
                        }

                        const initWasm = anydocModule.default || anydocModule.init
                        const { toMarkdownBytes, formatFromExtension } = anydocModule

                        if (typeof initWasm === 'function') {
                            await initWasm()
                        }

                        const arrayBuffer = await file.arrayBuffer()
                        const uint8Array = new Uint8Array(arrayBuffer)
                        const fmt = typeof formatFromExtension === 'function' ? formatFromExtension(ext) : null
                        const markdown = toMarkdownBytes(uint8Array, fmt)

                        if (typeof markdown !== 'string') {
                            throw new Error('Failed to convert document: Empty or invalid output.')
                        }

                        await applyImportedContent(markdown, true)
                    } catch (err) {
                        console.error('Anydoc WASM conversion failed:', err)
                        handleImportError(err)
                    }
                }
            })
        }

        if ($importAudioInput) {
            $importAudioInput.addEventListener('change', async () => {
                const file = $importAudioInput.files && $importAudioInput.files[0]
                if (!file) return
                try {
                    await processAudioTranscription(file, { smartFormat: false })
                } finally {
                    $importAudioInput.value = ''
                }
            })
        }

        if ($importAudioSmartFormatInput) {
            $importAudioSmartFormatInput.addEventListener('change', async () => {
                const file = $importAudioSmartFormatInput.files && $importAudioSmartFormatInput.files[0]
                if (!file) return
                try {
                    await processAudioTranscription(file, { smartFormat: true })
                } finally {
                    $importAudioSmartFormatInput.value = ''
                }
            })
        }

        const setPublicIndex = async enabled => {
            const payload = await fetchJson(window.location.pathname + '/setting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ publicIndex: enabled })
            })
            if (payload.err !== 0) throw new Error(payload.msg || 'public index update failed')
            APP_STATE.publicIndex = enabled === true
            return payload
        }

        function syncPublicIndexButton() {
            const button = document.querySelector('#public-index-btn')
            const enabled = APP_STATE.publicIndex === true
            const label = enabled ? getI18n('publicIndexDisable') : getI18n('publicIndexEnable')
            if (button) {
                button.dataset.publicIndex = enabled ? 'true' : 'false'
                button.textContent = enabled ? getI18n('publicIndexOn') : getI18n('publicIndexOff')
                button.classList.toggle('opt-button-accent', enabled)
                button.title = label
                button.setAttribute('aria-label', label)
            }
            if ($publicationPublicIndex) {
                $publicationPublicIndex.textContent = getI18n(enabled ? 'publicIndexOn' : 'publicIndexOff')
                $publicationPublicIndex.classList.toggle('is-indexed', enabled)
                $publicationPublicIndex.setAttribute('aria-pressed', enabled ? 'true' : 'false')
                $publicationPublicIndex.title = label
            }
        }

        function formatPublicationUpdatedAt(timestamp) {
            const value = Number(timestamp)
            if (!Number.isFinite(value) || value <= 0) return '—'
            return new Date(value * 1000).toLocaleString(APP_STATE.lang === 'zh-TW' ? 'zh-TW' : 'en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })
        }

        function syncPublicationStatus() {
            if (!$publicationStatus) return
            const published = APP_STATE.isPublished === true && Boolean(APP_STATE.shareId)
            const state = document.querySelector('#publication-state')
            const details = $publicationStatus.querySelector('.publication-share-details')
            const metrics = $publicationStatus.querySelector('.publication-metrics')
            const pendingHint = $publicationStatus.querySelector('.publication-pending-hint')
            const versionCount = document.querySelector('#publication-version-count')
            const viewCount = document.querySelector('#publication-view-count')
            const updatedAt = document.querySelector('#publication-updated-at')
            const shareUrl = getCurrentShareUrl()

            $publicationStatus.dataset.published = published ? 'true' : 'false'
            if (state) {
                state.textContent = getI18n(published ? 'publicationPublished' : 'publicationDraft')
                state.classList.toggle('is-published', published)
                state.classList.toggle('is-draft', !published)
            }
            if (details) details.hidden = !published
            if (metrics) metrics.hidden = !published
            if (pendingHint) pendingHint.hidden = published
            if ($publicationShareUrl) {
                $publicationShareUrl.href = shareUrl || '#'
                $publicationShareUrl.textContent = shareUrl
            }
            if (versionCount) versionCount.textContent = Number.isSafeInteger(APP_STATE.versionCount) ? String(APP_STATE.versionCount) : '—'
            if (viewCount) viewCount.textContent = Number.isSafeInteger(APP_STATE.viewCount) ? String(APP_STATE.viewCount) : '—'
            if (updatedAt) {
                updatedAt.dateTime = APP_STATE.updateAt ? String(APP_STATE.updateAt) : ''
                updatedAt.textContent = formatPublicationUpdatedAt(APP_STATE.updateAt)
            }
            syncPublicIndexButton()
        }

        async function refreshPublicationVersionCount() {
            if (!APP_STATE.noteHistoryEnabled || !APP_STATE.isPublished) return
            try {
                const payload = await fetchJson('/api' + window.location.pathname + '/history')
                if (payload.err !== 0) return
                APP_STATE.versionCount = Array.isArray(payload.data?.versions) ? payload.data.versions.length : APP_STATE.versionCount
                syncPublicationStatus()
            } catch (error) {}
        }

        const syncAnnotationsEnabledButton = () => {
            const button = document.querySelector('#annotations-enabled-btn')
            if (!button) return
            const enabled = APP_STATE.annotationsEnabled === true
            button.dataset.annotationsEnabled = enabled ? 'true' : 'false'
            button.textContent = getI18n(enabled ? 'annotationsOn' : 'annotationsOff')
            button.classList.toggle('opt-button-accent', enabled)
            button.setAttribute('aria-pressed', enabled ? 'true' : 'false')
            const label = getI18n(enabled ? 'annotationsDisable' : 'annotationsEnable')
            button.title = label
            button.setAttribute('aria-label', label)
        }

        function syncShareMenuUI() {
            const publishedMenu = document.querySelector('.share-menu-published')
            const unpublishedMenu = document.querySelector('.share-menu-unpublished')
            const isPublished = APP_STATE.isPublished === true && Boolean(APP_STATE.shareId)

            if (publishedMenu) publishedMenu.hidden = !isPublished
            if (unpublishedMenu) unpublishedMenu.hidden = isPublished

            const shareOpenLink = document.querySelector('#share-open-link')
            if (shareOpenLink) {
                shareOpenLink.href = getCurrentShareUrl() || '#'
            }
            const sharePresentOpenLink = document.querySelector('#share-present-open-link')
            if (sharePresentOpenLink) {
                const currentShare = getCurrentShareUrl()
                sharePresentOpenLink.href = currentShare ? currentShare + '/present' : '#'
            }
        }

        function syncShareStateUI() {
            const isPublished = APP_STATE.isPublished === true && Boolean(APP_STATE.shareId)
            const switcher = document.querySelector('.share-state-switcher')
            if (switcher) {
                switcher.classList.toggle('is-checked', isPublished)
                switcher.classList.toggle('share-published', isPublished)
                switcher.setAttribute('aria-pressed', isPublished ? 'true' : 'false')
            }
            const shareBtn = document.getElementById('share-menu-btn')
            const shareBtnLabel = document.getElementById('share-btn-label')
            const isZh = APP_STATE.lang === 'zh-TW'
            if (shareBtn) {
                shareBtn.classList.toggle('is-published', isPublished)
            }
            if (shareBtnLabel) {
                shareBtnLabel.textContent = isPublished
                    ? (isZh ? '已發布' : 'Live')
                    : (isZh ? '發布' : 'Publish')
            }
            syncShareMenuUI()
            if ($autosaveToggle) {
                $autosaveToggle.disabled = !isPublished
                $autosaveToggle.classList.toggle('is-disabled', !isPublished)
                setRailSwitchState($autosaveToggle, APP_STATE.autosave === true && isPublished)
            }
            syncPublicationStatus()
        }

        const publishCurrentNote = async (preferences = defaultPublishPreferences) => {
            window.canvasBridge?.flush?.()
            try {
                await uploadPendingAudiosToCloud()
            } catch (e) {
                console.warn('Upload pending audios error before publish:', e)
            }
            const wasPublished = APP_STATE.isPublished === true
            const currentWidth = APP_STATE.noteSettings.width || (APP_STATE.isEdit ? '1200px' : '100%')
            const currentTheme = APP_STATE.theme || 'claude-canvas'
            const draftModeSelect = document.querySelector('#share-vault-mode-select-draft')
            const draftExpiresSelect = document.querySelector('#share-expires-select-draft')
            const draftBurnBtn = document.querySelector('#burn-after-reading-btn-draft')
            const draftUnlockSelect = document.querySelector('#share-unlock-select-draft')
            const draftPulseSelect = document.querySelector('#share-pulse-select-draft')
            const shareMode = draftModeSelect ? draftModeSelect.value : (APP_STATE.shareMode || 'standard')
            const shareExpiresIn = draftExpiresSelect ? draftExpiresSelect.value : (APP_STATE.shareExpiresIn || 'none')
            const shareBurnAfterReading = draftBurnBtn ? draftBurnBtn.getAttribute('data-burn-after-reading') === 'true' : (APP_STATE.shareBurnAfterReading === true || shareMode === 'burn')
            const shareUnlockIn = draftUnlockSelect ? draftUnlockSelect.value : (APP_STATE.shareUnlockIn || '1d')
            const sharePulseInterval = draftPulseSelect ? draftPulseSelect.value : (APP_STATE.sharePulseInterval || '7d')
            return fetchJson(window.location.pathname + '/setting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    share: true,
                    content: $textarea ? $textarea.value : '',
                    width: currentWidth,
                    theme: currentTheme,
                    autosave: preferences.autosave,
                    publicIndex: preferences.publicIndex,
                    shareMode,
                    shareExpiresIn,
                    shareBurnAfterReading,
                    shareUnlockIn,
                    sharePulseInterval,
                })
            })
                .then(res => {
                    if (res.err !== 0) {
                        if ($shareBtn) {
                            $shareBtn.classList.remove('is-checked')
                            $shareBtn.setAttribute('aria-pressed', 'false')
                        }
                        errHandle(res.msg);
                        return false;
                    }
                    const nextShareId = typeof res.data === 'string' ? res.data.trim() : ''
                    if (!nextShareId) {
                        errHandle(APP_STATE.lang === 'zh-TW' ? '發布失敗：伺服器未回傳分享連結' : 'Publish failed: the server did not return a share link')
                        return false
                    }
                    APP_STATE.isPublished = true;
                    APP_STATE.shareId = nextShareId;
                    APP_STATE.shareMode = shareMode;
                    APP_STATE.shareExpiresIn = shareExpiresIn;
                    APP_STATE.shareBurnAfterReading = shareBurnAfterReading;
                    APP_STATE.shareUnlockIn = shareUnlockIn;
                    APP_STATE.sharePulseInterval = sharePulseInterval;
                    const liveModeSelect = document.querySelector('#share-vault-mode-select')
                    if (liveModeSelect && shareMode) {
                        liveModeSelect.value = shareMode
                        if (typeof syncVaultModeUI === 'function') syncVaultModeUI(shareMode, false)
                    }
                    const liveExpiresSelect = document.querySelector('#share-expires-select')
                    if (liveExpiresSelect && shareExpiresIn) liveExpiresSelect.value = shareExpiresIn
                    const liveBurnBtn = document.querySelector('#burn-after-reading-btn')
                    if (liveBurnBtn) {
                        liveBurnBtn.classList.toggle('opt-button-accent', shareBurnAfterReading)
                        liveBurnBtn.setAttribute('data-burn-after-reading', String(shareBurnAfterReading))
                        liveBurnBtn.setAttribute('aria-pressed', String(shareBurnAfterReading))
                        liveBurnBtn.textContent = shareBurnAfterReading ? (getI18n('burnAfterReadingOn') || 'On') : (getI18n('burnAfterReadingOff') || 'Off')
                    }
                    const liveUnlockSelect = document.querySelector('#share-unlock-select')
                    if (liveUnlockSelect && shareUnlockIn) liveUnlockSelect.value = shareUnlockIn
                    const livePulseSelect = document.querySelector('#share-pulse-select')
                    if (livePulseSelect && sharePulseInterval) livePulseSelect.value = sharePulseInterval
                    if (!wasPublished) APP_STATE.annotationsEnabled = true;
                    APP_STATE.autosave = preferences.autosave === true;
                    APP_STATE.publicIndex = preferences.publicIndex === true;
                    APP_STATE.updateAt = Math.floor(Date.now() / 1000);
                    savedContent = $textarea ? $textarea.value : savedContent;
                    clearAutosaveTimer();
                    if ($shareBtn) {
                        $shareBtn.classList.add('is-checked')
                        $shareBtn.setAttribute('aria-pressed', 'true')
                    }
                    syncShareStateUI();
                    recordShareHistory('created', getCurrentShareUrl(), APP_STATE.title);
                    syncPublicIndexButton();
                    syncAnnotationsEnabledButton();
                    refreshPublicationVersionCount();
                    window.showToast?.(getI18n('publicationPublished'));
                    return true;
                })
                .catch(err => {
                    if ($shareBtn) {
                        $shareBtn.classList.remove('is-checked')
                        $shareBtn.setAttribute('aria-pressed', 'false')
                    }
                    errHandle(err);
                    return false;
                })
        }

        const confirmUnpublish = async () => {
            if (hasUnsavedChanges()) {
                return window.showAppDialog({
                    title: APP_STATE.lang === 'zh-TW' ? '尚未儲存的修改' : 'Unsaved changes',
                    message: APP_STATE.lang === 'zh-TW'
                        ? '取消發布後這些修改不會被儲存。仍要取消發布嗎？'
                        : 'These changes will not be saved after unpublishing. Continue?',
                    kind: 'confirm',
                    confirm: true,
                })
            }
            return window.showAppDialog({ title: getI18n('share'), message: getI18n('unpublishConfirm'), kind: 'confirm', confirm: true })
        }

        const closePublishNudge = () => {
            if ($publishNudgeModal) closeModal($publishNudgeModal);
        }

        const syncPublishPreferenceDependencies = () => {
            const publishInput = $publishPreferenceInputs.find(input => input.dataset.publishPreference === 'publish')
            const publishEnabled = publishInput?.checked !== false
            $publishPreferenceInputs.forEach(input => {
                if (input === publishInput) return
                input.disabled = !publishEnabled
                input.closest('.publish-preference-row')?.classList.toggle('is-dependent-disabled', !publishEnabled)
            })
        }

        const openPublishOptions = () => {
            if (!$publishNudgeModal || APP_STATE.isPublished || !APP_STATE.isEdit) return;
            if (!$textarea || !$textarea.value.trim()) return;
            const preferences = loadPublishPreferences()
            $publishPreferenceInputs.forEach(input => {
                input.checked = preferences[input.dataset.publishPreference] !== false
            })
            syncPublishPreferenceDependencies()
            openModal($publishNudgeModal, { initialFocus: $publishNudgePublish });
        }

        const readPublishPreferencesFromDialog = () => {
            return $publishPreferenceInputs.reduce((preferences, input) => {
                preferences[input.dataset.publishPreference] = input.checked === true
                return preferences
            }, { ...defaultPublishPreferences })
        }

        if ($languageSelector) {
            const languageSwitch = $languageSelector.querySelector('.footer-rail-switch')
            if (languageSwitch) languageSwitch.addEventListener('click', function() {
                const checked = this.getAttribute('aria-pressed') === 'true'
                const nextLang = checked
                    ? this.getAttribute('data-rail-unchecked-value')
                    : this.getAttribute('data-rail-checked-value')
                if (nextLang && nextLang !== APP_STATE.lang) setLanguage(nextLang)
            })
        }

        if ($publishNudgePublish) {
            $publishNudgePublish.addEventListener('click', () => {
                const preferences = readPublishPreferencesFromDialog()
                savePublishPreferences(preferences)
                closePublishNudge();
                if (preferences.publish) publishCurrentNote(preferences);
            });
        }
        $publishPreferenceInputs.forEach(input => {
            input.addEventListener('change', syncPublishPreferenceDependencies)
        })
        if ($publishNudgeLater) $publishNudgeLater.addEventListener('click', closePublishNudge);
        if ($publishNudgeClose) $publishNudgeClose.addEventListener('click', closePublishNudge);
        if ($publishNudgeModal) {
            $publishNudgeModal.addEventListener('keydown', e => {
                if (e.key === 'Escape') closePublishNudge();
            });
        }

        // Scroll Sync
        let isSyncingLeft = false, isSyncingRight = false, syncTimeout = null;
        const syncScroll = (source, target) => {
            const percentage = source.scrollTop / (source.scrollHeight - source.clientHeight);
            target.scrollTop = percentage * (target.scrollHeight - target.clientHeight);
        }
        if ($textarea && ($previewMd || $previewPlain)) {
            const $preview = $previewMd || $previewPlain;
            $textarea.addEventListener('scroll', () => {
                if (isSyncingLeft) return; isSyncingRight = true; syncScroll($textarea, $preview);
                clearTimeout(syncTimeout); syncTimeout = setTimeout(() => isSyncingRight = false, 50);
            });
            $preview.addEventListener('scroll', () => {
                if (isSyncingRight) return; isSyncingLeft = true; syncScroll($preview, $textarea);
                clearTimeout(syncTimeout); syncTimeout = setTimeout(() => isSyncingLeft = false, 50);
            });
        }

        // Resizable Split Pane
        const $resizer = document.querySelector('.divide-line');
        if ($resizer && $textarea && ($previewMd || $previewPlain)) {
            const $preview = $previewMd || $previewPlain;
            const $editorPane = document.querySelector('.editor-pane');
            const $previewPane = document.querySelector('.preview-pane') || $preview;
            const resetSplitPane = function() {
                $textarea.style.removeProperty('flex');
                $editorPane?.style.removeProperty('flex');
                $previewPane.style.removeProperty('flex');
            };
            window.resetEditorSplitPane = resetSplitPane;
            let startPosition = 0, firstPaneSize = 0, parentSize = 0, isVertical = false;
            const mouseDownHandler = function(e) {
                if (!$editorPane) return;
                isVertical = document.body.classList.contains('preview-split-vertical') || window.matchMedia('(max-width: 960px)').matches;
                startPosition = isVertical ? e.clientY : e.clientX;
                firstPaneSize = isVertical ? $editorPane.getBoundingClientRect().height : $editorPane.getBoundingClientRect().width;
                const parentRect = $resizer.parentNode.getBoundingClientRect();
                parentSize = isVertical ? parentRect.height : parentRect.width;
                document.addEventListener('mousemove', mouseMoveHandler); document.addEventListener('mouseup', mouseUpHandler);
                document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize';
                $textarea.style.pointerEvents = 'none'; $preview.style.pointerEvents = 'none';
            };
            const mouseMoveHandler = function(e) {
                const currentPosition = isVertical ? e.clientY : e.clientX;
                const newFirstPercent = ((firstPaneSize + currentPosition - startPosition) * 100) / parentSize;
                if (newFirstPercent < 10 || newFirstPercent > 90) return;
                $editorPane.style.flex = \`0 0 \${newFirstPercent}%\`;
                $previewPane.style.flex = \`0 0 calc(\${100 - newFirstPercent}% - 8px)\`;
            };
            const mouseUpHandler = function() {
                document.removeEventListener('mousemove', mouseMoveHandler); document.removeEventListener('mouseup', mouseUpHandler);
                document.body.style.cursor = null;
                $textarea.style.removeProperty('pointer-events'); $preview.style.removeProperty('pointer-events');
            };
            $resizer.addEventListener('mousedown', mouseDownHandler);
            $resizer.addEventListener('dblclick', resetSplitPane);
        }

        const BOX_UPLOAD_ENDPOINTS = [
            'https://box.david888.com/api.php?action=upload',
            'https://box.aiurl.tw/api.php?action=upload',
            'https://box.glsoft.ai/api.php?action=upload',
        ];

        const uploadTo888Box = async (file) => {
            let lastError;
            if (typeof window.showToast === 'function') {
                window.showToast(getI18n('uploading') || '正在上傳至 888box...');
            }
            for (const endpoint of BOX_UPLOAD_ENDPOINTS) {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('title', file.name || 'attachment');
                    const response = await fetch(endpoint, { method: 'POST', body: formData });
                    const payload = await response.json();
                    const url = payload?.data?.url || payload?.url;
                    if (response.ok && (payload?.result === 'success' || url) && url) {
                        return url;
                    }
                    lastError = new Error(payload?.message || 'Upload failed');
                } catch (err) {
                    lastError = err;
                }
            }
            throw lastError || new Error('Upload to 888box failed');
        };
        window.uploadTo888Box = uploadTo888Box;

        const insertLocalRecordedAudio = (audioId, blobUrl, start, end) => {
            const snippet = '<audio controls data-offline-audio-id="' + audioId + '" src="' + blobUrl + '"></audio>'
            if (isCurrentBlockEditor()) {
                window.dispatchEvent(new CustomEvent('cf-notepad-block-insert-audio', {
                    detail: { url: blobUrl, audioId, name: 'recording.webm' }
                }))
                return
            }
            if (!$textarea) return
            const source = $textarea.value || ''
            const safeStart = typeof start === 'number' ? Math.max(0, Math.min(start, source.length)) : source.length
            const safeEnd = typeof end === 'number' ? Math.max(safeStart, Math.min(end, source.length)) : safeStart
            const prefix = safeStart > 0 && !source.substring(0, safeStart).endsWith('\\n') ? '\\n\\n' : ''
            const suffix = safeEnd < source.length && !source.substring(safeEnd).startsWith('\\n') ? '\\n\\n' : ''
            const insertion = prefix + snippet + suffix
            $textarea.value = source.substring(0, safeStart) + insertion + source.substring(safeEnd)
            const next = safeStart + insertion.length
            $textarea.setSelectionRange(next, next)
            renderPlain($previewPlain, $textarea.value)
            triggerRender($previewMd, $textarea.value)
            $textarea.dispatchEvent(new Event('input', { bubbles: true }))
        }

        const transcribePendingAudio = async (audioId, audioFile, { notify = true } = {}) => {
            if (!navigator.onLine) {
                showSaveStatus(APP_STATE.lang === 'zh-TW' ? '🟢 本機已存（音訊待辨識）' : '🟢 Saved locally (Audio pending ASR)', false, 'local')
                return false
            }
            try {
                if (notify && typeof window.showToast === 'function') {
                    window.showToast(APP_STATE.lang === 'zh-TW' ? '🎙️ 正在進行語音轉錄 (Whisper ASR)...' : '🎙️ Transcribing audio (Whisper ASR)...')
                }
                await processAudioTranscription(audioFile, { targetAudioId: audioId, insertAtCursor: isCurrentBlockEditor() })
                if (window.offlineStore) {
                    await window.offlineStore.updateOfflineAudioStatus(audioId, 'transcribed')
                }
                showSaveStatus(APP_STATE.lang === 'zh-TW' ? '🟢 本機已存（已產生逐字稿）' : '🟢 Saved locally (Transcribed)', false, 'local')
                return true
            } catch (err) {
                console.error('Audio transcribe error:', err)
                showSaveStatus(APP_STATE.lang === 'zh-TW' ? '🟢 本機已存（轉錄失敗，可稍後重試）' : '🟢 Saved locally (ASR failed)', false, 'local')
                return false
            }
        }

        uploadPendingAudiosToCloud = async () => {
            if (!$textarea || !window.offlineStore) return false
            const curVal = $textarea.value
            if (!curVal || (!curVal.includes('data-offline-audio-id') && !curVal.includes('rec_'))) return false

            const matches = [...curVal.matchAll(/(?:data-offline-audio-id="?|audioId[":\s]+"?)(rec_[a-zA-Z0-9_-]+)"?/g)]
            if (!matches.length) return false

            let modified = false
            let updatedText = $textarea.value

            for (const match of matches) {
                const audioId = match[1]
                try {
                    const record = await window.offlineStore.getOfflineAudio(audioId)
                    if (record && record.blob && record.syncStatus !== 'synced') {
                        if (typeof window.showToast === 'function') {
                            window.showToast(APP_STATE.lang === 'zh-TW' ? '正在上傳錄音至 888box 附件服務...' : 'Uploading recording to the 888box attachment service...')
                        }
                        const audioFile = new File([record.blob], record.name || 'recording.webm', { type: record.type || 'audio/webm' })
                        const url = await uploadTo888Box(audioFile)
                        if (url) {
                            const regex = new RegExp('<audio[^>]*data-offline-audio-id="?' + audioId + '"?[^>]*><\\/audio>', 'g')
                            const newTag = '<audio controls src="' + url.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></audio>'
                            if (regex.test(updatedText)) {
                                updatedText = updatedText.replace(regex, newTag)
                                modified = true
                            }
                            if (updatedText.includes(audioId)) {
                                updatedText = updatedText.replace(new RegExp('(?:blob:https?:\\\\/\\\\/[^\\\\s"]+|"url":"blob:[^"]+")', 'g'), function(m) {
                                    return m.indexOf('"url"') === 0 ? ('"url":"' + url + '"') : url;
                                });
                                modified = true;
                            }
                            await window.offlineStore.updateOfflineAudioStatus(audioId, 'synced', url)
                        }
                    }
                } catch (err) {
                    console.warn('Failed to upload audio ' + audioId + ' to 888box:', err)
                }
            }

            if (modified) {
                $textarea.value = updatedText
                triggerRender($previewMd, $textarea.value)
                $textarea.dispatchEvent(new Event('input', { bubbles: true }))
            }
            return modified
        }

        const transcribeAllPendingAudios = async () => {
            if (!navigator.onLine || !window.offlineStore || !$textarea) return
            try {
                const pendingList = await window.offlineStore.getPendingOfflineAudios(APP_STATE.path, 'pending')
                if (!pendingList || !pendingList.length) return
                for (const item of pendingList) {
                    if (item.blob && $textarea.value.includes(item.id)) {
                        const audioFile = new File([item.blob], item.name || 'recording.webm', { type: item.type || 'audio/webm' })
                        await transcribePendingAudio(item.id, audioFile, { notify: false })
                    }
                }
            } catch (e) {
                console.warn('Transcribe pending audios error:', e)
            }
        }

        const restoreLocalAudioBlobs = async () => {
            if (!$textarea || !window.offlineStore) return
            const curVal = $textarea.value
            if (!curVal || !curVal.includes('data-offline-audio-id')) return
            const matches = [...curVal.matchAll(/data-offline-audio-id="?([a-zA-Z0-9_-]+)"?/g)]
            let modified = false
            let updatedText = curVal
            for (const match of matches) {
                const audioId = match[1]
                try {
                    const record = await window.offlineStore.getOfflineAudio(audioId)
                    if (record && record.blob && record.syncStatus !== 'synced') {
                        const freshBlobUrl = URL.createObjectURL(record.blob)
                        const regex = new RegExp('(<audio[^>]*data-offline-audio-id="?' + audioId + '"?[^>]*src=")[^"]*(")', 'g')
                        if (regex.test(updatedText)) {
                            updatedText = updatedText.replace(regex, '$1' + freshBlobUrl + '$2')
                            modified = true
                        }
                    }
                } catch (e) {}
            }
            if (modified) {
                $textarea.value = updatedText
                triggerRender($previewMd, $textarea.value)
            }
        }

        window.addEventListener('online', () => {
            transcribeAllPendingAudios()
        })
        if (navigator.onLine) {
            setTimeout(() => {
                restoreLocalAudioBlobs()
                transcribeAllPendingAudios()
            }, 1000)
        }

        document.addEventListener('cf-notepad-recorded-audio', async event => {
            const detail = event.detail || {}
            const audioFile = detail.file
            if (!audioFile || typeof audioFile.size !== 'number') return
            if (audioFile.size > 25 * 1024 * 1024) {
                window.showAppDialog({ title: getI18n('err'), message: APP_STATE.lang === 'zh-TW' ? '錄音超過 25 MB，請縮短後再試。' : 'Recording exceeds the 25 MB transcription limit.', kind: 'error' })
                return
            }

            const audioId = 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
            const localBlobUrl = URL.createObjectURL(audioFile)

            if (window.offlineStore) {
                try {
                    await window.offlineStore.saveOfflineAudio(audioId, {
                        blob: audioFile,
                        name: audioFile.name,
                        type: audioFile.type,
                        notePath: APP_STATE.path,
                        syncStatus: 'pending'
                    })
                } catch (storeErr) {
                    console.warn('Failed to store offline audio:', storeErr)
                }
            }

            insertLocalRecordedAudio(audioId, localBlobUrl, detail.start, detail.end)

            if (navigator.onLine) {
                await transcribePendingAudio(audioId, audioFile, { notify: true })
            } else {
                showSaveStatus(APP_STATE.lang === 'zh-TW' ? '🟢 本機已存（音訊待辨識）' : '🟢 Saved locally (Audio pending ASR)', false, 'local')
                if (typeof window.showToast === 'function') {
                    window.showToast(APP_STATE.lang === 'zh-TW' ? '🎙️ 錄音已暫存於本機 (IndexedDB)，連線後將自動產生逐字稿；發布／同步時會上傳至 888box 附件服務。' : '🎙️ Recording saved locally (IndexedDB). It will be transcribed when online and uploaded to 888box when published or synced.')
                }
            }
        })

        const showFileDropChoiceDialog = (file, kind) => new Promise(resolve => {
            const modal = document.querySelector('.file-drop-modal');
            if (!modal) {
                resolve('convert');
                return;
            }
            const titleEl = modal.querySelector('#file-drop-title');
            const msgEl = modal.querySelector('#file-drop-message');
            const primaryBtn = modal.querySelector('#file-drop-action-primary');
            const tertiaryBtn = modal.querySelector('#file-drop-action-tertiary');
            const secondaryBtn = modal.querySelector('#file-drop-action-secondary');
            const cancelBtn = modal.querySelector('#file-drop-action-cancel');
            const mask = modal.querySelector('.modal-mask');
            const iconEl = modal.querySelector('.file-drop-icon');

            const zh = APP_STATE.lang === 'zh-TW';
            const fileName = file.name || '';

            if (kind === 'pdf') {
                if (iconEl) iconEl.textContent = '📄';
                if (titleEl) titleEl.textContent = zh ? '處理 PDF 文件：「' + fileName + '」' : 'Process PDF Document: "' + fileName + '"';
                if (msgEl) msgEl.textContent = zh ? '請選擇您希望如何處理此 PDF 文件：' : 'Please select how you would like to handle this PDF file:';
                if (primaryBtn) primaryBtn.textContent = '📑 ' + (zh ? '解析為 Markdown 內文 (AnyDocs 轉檔)' : 'Convert to Markdown Text (AnyDocs)');
                if (tertiaryBtn) tertiaryBtn.style.display = 'none';
                if (secondaryBtn) secondaryBtn.textContent = '☁️ ' + (zh ? '上傳至 888box 作為附件連結' : 'Upload to 888box as Attachment');
            } else if (kind === 'audio') {
                if (iconEl) iconEl.textContent = '🎙️';
                if (titleEl) titleEl.textContent = zh ? '處理音訊檔案：「' + fileName + '」' : 'Process Audio File: "' + fileName + '"';
                if (msgEl) msgEl.textContent = zh ? '請選擇您希望如何處理此音訊檔案：' : 'Please select how you would like to handle this audio file:';
                if (primaryBtn) primaryBtn.textContent = '🎙️ ' + (zh ? '匯入音訊（逐字稿）' : 'Import audio (Transcript)');
                if (tertiaryBtn) {
                    tertiaryBtn.style.display = '';
                    tertiaryBtn.textContent = '✨ ' + (zh ? '匯入音訊（智慧排版）' : 'Import audio (Smart format)');
                }
                if (secondaryBtn) secondaryBtn.textContent = '☁️ ' + (zh ? '上傳至 888box 嵌入播放器' : 'Upload to 888box as Audio Player');
            } else {
                if (iconEl) iconEl.textContent = '📑';
                if (titleEl) titleEl.textContent = zh ? '處理文件：「' + fileName + '」' : 'Process Document: "' + fileName + '"';
                if (msgEl) msgEl.textContent = zh ? '請選擇您希望如何處理此文件：' : 'Please select how you would like to handle this document:';
                if (primaryBtn) primaryBtn.textContent = '📑 ' + (zh ? '解析為 Markdown 內文 (AnyDocs 轉檔)' : 'Convert to Markdown Text (AnyDocs)');
                if (tertiaryBtn) tertiaryBtn.style.display = 'none';
                if (secondaryBtn) secondaryBtn.textContent = '☁️ ' + (zh ? '上傳至 888box 作為附件連結' : 'Upload to 888box as Attachment');
            }

            let settled = false;
            const cleanup = (choice) => {
                if (settled) return;
                settled = true;
                closeModal(modal);
                primaryBtn?.removeEventListener('click', onPrimary);
                tertiaryBtn?.removeEventListener('click', onTertiary);
                secondaryBtn?.removeEventListener('click', onSecondary);
                cancelBtn?.removeEventListener('click', onCancel);
                mask?.removeEventListener('click', onCancel);
                modal?.removeEventListener('keydown', onKeyDown);
                resolve(choice);
            };

            const onPrimary = () => cleanup(kind === 'audio' ? 'transcribe' : 'convert');
            const onTertiary = () => cleanup('smart');
            const onSecondary = () => cleanup('upload');
            const onCancel = () => cleanup('cancel');
            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                }
            };

            openModal(modal, { initialFocus: primaryBtn });
            primaryBtn?.addEventListener('click', onPrimary);
            tertiaryBtn?.addEventListener('click', onTertiary);
            secondaryBtn?.addEventListener('click', onSecondary);
            cancelBtn?.addEventListener('click', onCancel);
            mask?.addEventListener('click', onCancel);
            modal?.addEventListener('keydown', onKeyDown);
        });

        const showImageActionDialog = (file) => new Promise(resolve => {
            const modal = document.querySelector('.image-ocr-modal');
            if (!modal) {
                resolve(window.ENABLE_R2 ? 'upload' : 'cancel');
                return;
            }
            const titleEl = modal.querySelector('#image-ocr-title');
            const messageEl = modal.querySelector('#image-ocr-message');
            const uploadBtn = modal.querySelector('#image-ocr-action-upload');
            const ocrBtn = modal.querySelector('#image-ocr-action-ocr');
            const tableBtn = modal.querySelector('#image-ocr-action-table');
            const cancelBtn = modal.querySelector('#image-ocr-action-cancel');
            const mask = modal.querySelector('.modal-mask');
            const fileName = file?.name || (APP_STATE.lang === 'zh-TW' ? '貼上的圖片' : 'Pasted image');
            const zh = APP_STATE.lang === 'zh-TW';
            if (!titleEl || !messageEl || !uploadBtn || !ocrBtn || !tableBtn || !cancelBtn || !mask) {
                resolve(window.ENABLE_R2 ? 'upload' : 'cancel');
                return;
            }

            titleEl.textContent = zh ? '處理圖片：「' + fileName + '」' : 'Process Image: "' + fileName + '"';
            messageEl.textContent = zh ? '選擇上傳圖片，或只在本機辨識文字。' : 'Choose image upload or local text recognition.';
            uploadBtn.disabled = !window.ENABLE_R2;
            uploadBtn.title = window.ENABLE_R2 ? '' : (zh ? '尚未啟用 R2 圖片上傳' : 'R2 image upload is disabled');
            uploadBtn.setAttribute('aria-disabled', window.ENABLE_R2 ? 'false' : 'true');

            let settled = false;
            const cleanup = choice => {
                if (settled) return;
                settled = true;
                closeModal(modal);
                uploadBtn.removeEventListener('click', onUpload);
                ocrBtn.removeEventListener('click', onOcr);
                tableBtn.removeEventListener('click', onTable);
                cancelBtn.removeEventListener('click', onCancel);
                mask.removeEventListener('click', onCancel);
                modal.removeEventListener('keydown', onKeyDown);
                resolve(choice);
            };
            const onUpload = () => cleanup('upload');
            const onOcr = () => cleanup('ocr');
            const onTable = () => cleanup('table');
            const onCancel = () => cleanup('cancel');
            const onKeyDown = event => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancel();
                }
            };

            openModal(modal, { initialFocus: ocrBtn });
            uploadBtn.addEventListener('click', onUpload);
            ocrBtn.addEventListener('click', onOcr);
            tableBtn.addEventListener('click', onTable);
            cancelBtn.addEventListener('click', onCancel);
            mask.addEventListener('click', onCancel);
            modal.addEventListener('keydown', onKeyDown);
        });

        const insertOcrText = (text, start, end) => {
            const value = String($textarea?.value || '');
            const safeStart = Math.max(0, Math.min(value.length, Number.isFinite(Number(start)) ? Number(start) : value.length));
            const safeEnd = Math.max(safeStart, Math.min(value.length, Number.isFinite(Number(end)) ? Number(end) : safeStart));
            const before = value.substring(0, safeStart);
            const after = value.substring(safeEnd);
            const prefix = before && !before.endsWith('\\n\\n') ? (before.endsWith('\\n') ? '\\n' : '\\n\\n') : '';
            const suffix = after && !after.startsWith('\\n\\n') ? (after.startsWith('\\n') ? '\\n' : '\\n\\n') : '';
            const insertion = prefix + text + suffix;
            $textarea.value = before + insertion + after;
            $textarea.selectionStart = $textarea.selectionEnd = before.length + insertion.length;
            triggerRender($previewMd, $textarea.value);
            $textarea.dispatchEvent(new Event('input', { bubbles: true }));
        };

        const setOcrStatus = message => {
            const status = document.querySelector('#ocr-status');
            const text = document.querySelector('#ocr-status-text');
            if (!status || !text) return;
            const value = String(message || '');
            text.textContent = value;
            status.hidden = !value;
        };

        const uploadImageToR2 = async file => {
            if (!window.ENABLE_R2) throw new Error(APP_STATE.lang === 'zh-TW' ? '圖片上傳目前未啟用。' : 'Image upload is currently disabled.');
            const formData = new FormData();
            formData.append('image', file);
            const response = await fetchJson('/upload', { method: 'POST', body: formData });
            if (response?.err !== 0 || !response?.data) throw new Error(response?.msg || (APP_STATE.lang === 'zh-TW' ? '圖片上傳失敗。' : 'Image upload failed.'));
            return response.data;
        };
        window.uploadImageToR2 = uploadImageToR2;

        const ensureOcrClient = async () => {
            if (window.cfNotepadOcr?.recognizeImage && window.cfNotepadOcr?.recognizeTableImage) {
                return window.cfNotepadOcr;
            }
            try {
                const mod = await import('/js/ocr-client.mjs');
                if (window.cfNotepadOcr?.recognizeImage) return window.cfNotepadOcr;
                if (mod && (mod.recognizeImage || mod.recognizeTableImage)) {
                    window.cfNotepadOcr = Object.assign(window.cfNotepadOcr || {}, mod);
                    return window.cfNotepadOcr;
                }
            } catch (err) {
                console.warn('[OCR] Dynamic import of /js/ocr-client.mjs failed:', err);
            }
            return window.cfNotepadOcr;
        };

        const processImageInput = async (file, { start, end, block = false } = {}) => {
            const choice = await showImageActionDialog(file);
            if (choice === 'cancel') return;
            if (choice === 'ocr') {
                await ensureOcrClient();
                if (!window.cfNotepadOcr?.recognizeImage) throw new Error(APP_STATE.lang === 'zh-TW' ? 'OCR 模組載入失敗，請確認網路連線或重新整理頁面後再試。' : 'The OCR module failed to load. Check your network or refresh.');
                const isReady = window.cfNotepadOcr.getStatus?.().ready === true;
                setOcrStatus(isReady
                    ? (APP_STATE.lang === 'zh-TW' ? '正在本機辨識圖片…' : 'Recognizing image locally…')
                    : (APP_STATE.lang === 'zh-TW' ? '正在下載 OCR 模型與執行元件（首次使用）…' : 'Downloading the OCR model and runtime (first use)…'));
                try {
                    const result = await window.cfNotepadOcr.recognizeImage(file);
                    if (block) {
                        if (typeof window.__insertBlockEditorMarkdown !== 'function') throw new Error(APP_STATE.lang === 'zh-TW' ? 'Block 編輯器尚未準備完成。' : 'The block editor is not ready.');
                        window.__insertBlockEditorMarkdown(result.text);
                    } else {
                        insertOcrText(result.text, start, end);
                    }
                    window.showToast?.(APP_STATE.lang === 'zh-TW' ? 'OCR 完成，文字已插入。' : 'OCR complete. Text inserted.');
                } finally {
                    setOcrStatus('');
                }
                return;
            }
            if (choice === 'table') {
                await ensureOcrClient();
                if (!window.cfNotepadOcr?.recognizeTableImage) throw new Error(APP_STATE.lang === 'zh-TW' ? '表格 OCR 模組載入失敗，請確認網路連線或重新整理頁面後再試。' : 'The table OCR module failed to load. Check your network or refresh.');
                const isReady = window.cfNotepadOcr.getStatus?.().ready === true;
                setOcrStatus(isReady
                    ? (APP_STATE.lang === 'zh-TW' ? '正在辨識表格（本地優先，必要時後端容錯）…' : 'Recognizing table (local-first with fallback)…')
                    : (APP_STATE.lang === 'zh-TW' ? '正在準備表格 OCR 引擎（本地優先，必要時後端容錯）…' : 'Preparing table OCR engine (local-first with fallback)…'));
                try {
                    const result = await window.cfNotepadOcr.recognizeTableImage(file);
                    if (block) {
                        if (typeof window.__insertBlockEditorMarkdown !== 'function') throw new Error(APP_STATE.lang === 'zh-TW' ? 'Block 編輯器尚未準備完成。' : 'The block editor is not ready.');
                        window.__insertBlockEditorMarkdown(result.markdown);
                    } else {
                        insertOcrText(result.markdown, start, end);
                    }
                    const toastMsg = result?.isLocal
                        ? (APP_STATE.lang === 'zh-TW' ? '表格 OCR 完成（本地二維幾何重構），表格已插入。' : 'Table OCR complete (local 2D reconstruction). Table inserted.')
                        : (APP_STATE.lang === 'zh-TW' ? '表格 OCR 完成，表格已插入。' : 'Table OCR complete. Table inserted.');
                    window.showToast?.(toastMsg);
                } finally {
                    setOcrStatus('');
                }
                return;
            }
            const url = await uploadImageToR2(file);
            const fileName = file?.name || (APP_STATE.lang === 'zh-TW' ? '圖片' : 'image');
            if (block) {
                if (typeof window.__insertBlockEditorImage !== 'function') throw new Error(APP_STATE.lang === 'zh-TW' ? 'Block 編輯器尚未準備完成。' : 'The block editor is not ready.');
                window.__insertBlockEditorImage({ url, name: fileName });
            } else {
                const alt = fileName.replace(/\\.[^.]+$/, '').replace(/[\\[\\](){}<>]/g, ' ').trim() || 'image';
                insertOcrText('![' + alt + '](' + url + ')', start, end);
            }
            window.showToast?.(APP_STATE.lang === 'zh-TW' ? '圖片已上傳並插入。' : 'Image uploaded and inserted.');
        };

        window.__handleImageInput = processImageInput;

        const handleDroppedFile = async (file) => {
            if (!file) return;
            const fileName = file.name || '';
            const ext = (fileName.includes('.') ? fileName.split('.').pop() : '').toLowerCase();
            const isImage = file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
            const isAudio = file.type.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm', 'flac', 'opus'].includes(ext);
            const isPdf = ext === 'pdf' || file.type === 'application/pdf';
            const isPlainMd = ['md', 'markdown', 'txt'].includes(ext) || file.type === 'text/markdown' || file.type === 'text/plain';
            const isDoc = ['docx', 'pptx', 'xlsx', 'epub', 'csv', 'html'].includes(ext);

            // 1. Image -> choose local OCR or direct upload to R2
            if (isImage) {
                const start = typeof $textarea.selectionStart === 'number' ? $textarea.selectionStart : $textarea.value.length;
                const end = typeof $textarea.selectionEnd === 'number' ? $textarea.selectionEnd : $textarea.value.length;
                try {
                    await processImageInput(file, { start, end });
                } catch (err) {
                    const isOcr = err?.message && (err.message.includes('OCR') || err.message.includes('辨識'));
                    const title = isOcr ? (APP_STATE.lang === 'zh-TW' ? '辨識失敗' : 'Recognition Failed') : getI18n('uploadFailed');
                    window.showAppDialog({ title, message: err?.message || title, kind: 'error' });
                }
                return;
            }

            // 2. Plain Markdown / Text file -> import text directly
            if (isPlainMd) {
                let insertMode = 'replace';
                if (isCurrentMarkdownEditor() && $textarea.value && $textarea.value.trim().length > 0) {
                    insertMode = await showImportOptionDialog();
                }
                if (insertMode === 'cancel') return;
                const reader = new FileReader();
                reader.onload = async () => {
                    const text = typeof reader.result === 'string' ? reader.result : '';
                    if (insertMode === 'insert') {
                        const startPos = typeof $textarea.selectionStart === 'number' ? $textarea.selectionStart : $textarea.value.length;
                        const endPos = typeof $textarea.selectionEnd === 'number' ? $textarea.selectionEnd : $textarea.value.length;
                        $textarea.value = $textarea.value.substring(0, startPos) + text + $textarea.value.substring(endPos);
                    } else {
                        $textarea.value = text;
                    }
                    renderPlain($previewPlain, $textarea.value);
                    triggerRender($previewMd, $textarea.value);
                    $textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    window.showToast(getI18n('markdownImported'));
                };
                reader.readAsText(file, 'utf-8');
                return;
            }

            // Helper to insert markdown link or tag
            const insertSnippet = (snippet) => {
                const startPos = typeof $textarea.selectionStart === 'number' ? $textarea.selectionStart : $textarea.value.length;
                const endPos = typeof $textarea.selectionEnd === 'number' ? $textarea.selectionEnd : $textarea.value.length;
                const curVal = $textarea.value;
                const prefix = (startPos > 0 && !curVal.substring(0, startPos).endsWith('\\n')) ? '\\n' : '';
                const suffix = (endPos < curVal.length && !curVal.substring(endPos).startsWith('\\n')) ? '\\n' : '';
                const insertion = prefix + snippet + suffix;
                $textarea.value = curVal.substring(0, startPos) + insertion + curVal.substring(endPos);
                const nextPos = startPos + insertion.length;
                if (typeof $textarea.setSelectionRange === 'function') {
                    $textarea.setSelectionRange(nextPos, nextPos);
                }
                triggerRender($previewMd, $textarea.value);
                $textarea.dispatchEvent(new Event('input', { bubbles: true }));
            };

            // 3. PDF file -> prompt AnyDocs convert vs 888box upload
            if (isPdf) {
                const choice = await showFileDropChoiceDialog(file, 'pdf');
                if (choice === 'cancel') return;
                if (choice === 'upload') {
                    try {
                        const url = await uploadTo888Box(file);
                        const label = fileName.replace(/\\.[^.]+$/, '').trim() || 'PDF Document';
                        insertSnippet('[' + label + '](' + url + ')');
                        window.showToast(APP_STATE.lang === 'zh-TW' ? 'PDF 已成功上傳至 888box 並插入連結！' : 'PDF uploaded to 888box.');
                    } catch (err) {
                        window.showAppDialog({ title: getI18n('err'), message: err.message || '上傳失敗', kind: 'error' });
                    }
                    return;
                }
                // choice === 'convert' -> AnyDocs WASM
                try {
                    if (typeof window.showToast === 'function') {
                        window.showToast(getI18n('convertingDocument') || 'Converting document to Markdown...');
                    }
                    let anydocModule;
                    try {
                        anydocModule = await import('/wasm/anydoc_wasm.js');
                    } catch (localErr) {
                        anydocModule = await import('https://esm.sh/@firecrawl/anydoc-wasm@0.1.6');
                    }
                    const initWasm = anydocModule.default || anydocModule.init;
                    const { toMarkdownBytes, formatFromExtension } = anydocModule;
                    if (typeof initWasm === 'function') await initWasm();
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    const fmt = typeof formatFromExtension === 'function' ? formatFromExtension(ext) : null;
                    const markdown = toMarkdownBytes(uint8Array, fmt);
                    if (typeof markdown !== 'string') throw new Error('Conversion output empty');

                    let insertMode = 'replace';
                    if ($textarea.value && $textarea.value.trim().length > 0) {
                        insertMode = await showImportOptionDialog();
                    }
                    if (insertMode === 'cancel') return;
                    if (insertMode === 'insert') {
                        insertSnippet(markdown);
                    } else {
                        $textarea.value = markdown;
                        triggerRender($previewMd, $textarea.value);
                        $textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    window.showToast(getI18n('documentImported') || 'Document imported.');
                } catch (err) {
                    console.error('AnyDocs PDF conversion error:', err);
                    window.showAppDialog({ title: getI18n('err'), message: err.message || 'PDF 解析失敗', kind: 'error' });
                }
                return;
            }

            // 4. Audio file -> prompt Whisper AI transcription vs 888box upload
            if (isAudio) {
                const choice = await showFileDropChoiceDialog(file, 'audio');
                if (choice === 'cancel') return;
                if (choice === 'upload') {
                    try {
                        const url = await uploadTo888Box(file);
                        insertSnippet('<audio controls src="' + url + '"></audio>');
                        window.showToast(APP_STATE.lang === 'zh-TW' ? '音訊已成功上傳至 888box 並插入播放器！' : 'Audio uploaded to 888box.');
                    } catch (err) {
                        window.showAppDialog({ title: getI18n('err'), message: err.message || '上傳失敗', kind: 'error' });
                    }
                    return;
                }
                if (choice === 'smart') {
                    await processAudioTranscription(file, { smartFormat: true });
                    return;
                }
                // choice === 'transcribe' (default) -> plain verbatim transcript with timestamps
                await processAudioTranscription(file, { smartFormat: false });
                return;
            }

            // 5. Office docs (docx, pptx, xlsx, epub, csv) -> prompt AnyDocs convert vs 888box upload
            if (isDoc) {
                const choice = await showFileDropChoiceDialog(file, 'doc');
                if (choice === 'cancel') return;
                if (choice === 'upload') {
                    try {
                        const url = await uploadTo888Box(file);
                        const label = fileName.replace(/\\.[^.]+$/, '').trim() || 'Document';
                        insertSnippet('[' + label + '](' + url + ')');
                        window.showToast(APP_STATE.lang === 'zh-TW' ? '文件已成功上傳至 888box 並插入連結！' : 'Document uploaded to 888box.');
                    } catch (err) {
                        window.showAppDialog({ title: getI18n('err'), message: err.message || '上傳失敗', kind: 'error' });
                    }
                    return;
                }
                // choice === 'convert'
                try {
                    if (typeof window.showToast === 'function') {
                        window.showToast(getI18n('convertingDocument') || 'Converting document to Markdown...');
                    }
                    let anydocModule;
                    try {
                        anydocModule = await import('/wasm/anydoc_wasm.js');
                    } catch (localErr) {
                        anydocModule = await import('https://esm.sh/@firecrawl/anydoc-wasm@0.1.6');
                    }
                    const initWasm = anydocModule.default || anydocModule.init;
                    const { toMarkdownBytes, formatFromExtension } = anydocModule;
                    if (typeof initWasm === 'function') await initWasm();
                    const arrayBuffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    const fmt = typeof formatFromExtension === 'function' ? formatFromExtension(ext) : null;
                    const markdown = toMarkdownBytes(uint8Array, fmt);
                    if (typeof markdown !== 'string') throw new Error('Conversion output empty');

                    let insertMode = 'replace';
                    if ($textarea.value && $textarea.value.trim().length > 0) {
                        insertMode = await showImportOptionDialog();
                    }
                    if (insertMode === 'cancel') return;
                    if (insertMode === 'insert') {
                        insertSnippet(markdown);
                    } else {
                        $textarea.value = markdown;
                        triggerRender($previewMd, $textarea.value);
                        $textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    window.showToast(getI18n('documentImported') || 'Document imported.');
                } catch (err) {
                    window.showAppDialog({ title: getI18n('err'), message: err.message || '文件解析失敗', kind: 'error' });
                }
                return;
            }

            // 6. Any other generic file -> upload to 888box
            try {
                const url = await uploadTo888Box(file);
                const label = fileName.replace(/\\.[^.]+$/, '').trim() || 'File';
                insertSnippet('[' + label + '](' + url + ')');
                window.showToast(APP_STATE.lang === 'zh-TW' ? '檔案已成功上傳至 888box 並插入連結！' : 'File uploaded to 888box.');
            } catch (err) {
                window.showAppDialog({ title: getI18n('err'), message: err.message || '上傳失敗', kind: 'error' });
            }
        };

        if ($textarea) {
            // Drag and drop handler for Markdown editor shell
            const $editorShell = $textarea.closest('.editor-code-shell') || $textarea;
            let dragCounter = 0;

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                $editorShell.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            $editorShell.addEventListener('dragenter', () => {
                dragCounter++;
                $editorShell.classList.add('is-dragover');
            });

            $editorShell.addEventListener('dragleave', () => {
                dragCounter--;
                if (dragCounter <= 0) {
                    dragCounter = 0;
                    $editorShell.classList.remove('is-dragover');
                }
            });

            $editorShell.addEventListener('drop', async (e) => {
                dragCounter = 0;
                $editorShell.classList.remove('is-dragover');
                const dt = e.dataTransfer;
                const files = dt && dt.files;
                if (!files || files.length === 0) return;
                await handleDroppedFile(files[0]);
            });

            // Paste Handler (Images & Excel/Sheets Table Auto-Conversion)
            $textarea.addEventListener('paste', function (e) {
                const clip = e.clipboardData || (e.originalEvent && e.originalEvent.clipboardData);
                if (!clip) return;

                // 1. Check Image files and offer local OCR or upload
                if (clip.items) {
                    for (let index in clip.items) {
                        const item = clip.items[index];
                        if (item.kind === 'file' && item.type.startsWith('image/')) {
                            e.preventDefault();
                            const blob = item.getAsFile();
                            const start = $textarea.selectionStart;
                            const end = $textarea.selectionEnd;
                            processImageInput(blob, { start, end }).catch(error => {
                                window.showAppDialog({ title: getI18n('uploadFailed'), message: error?.message || getI18n('uploadFailed'), kind: 'error' });
                            });
                            return;
                        }
                    }
                }

                // 2. Check Table / TSV paste (Excel, Google Sheets, web tables)
                var htmlData = clip.getData('text/html');
                var textData = clip.getData('text/plain');
                var tableFn = window.htmlOrTsvToMarkdownTable || (typeof htmlOrTsvToMarkdownTable === 'function' ? htmlOrTsvToMarkdownTable : null);
                if (tableFn) {
                    var convertedTable = tableFn(htmlData, textData);
                    if (convertedTable) {
                        e.preventDefault();
                        var startPos = $textarea.selectionStart;
                        var endPos = $textarea.selectionEnd;
                        var before = $textarea.value.substring(0, startPos);
                        var after = $textarea.value.substring(endPos);
                        var prefixNewline = (before.length > 0 && !before.endsWith('\\n\\n')) ? (before.endsWith('\\n') ? '\\n' : '\\n\\n') : '';
                        var suffixNewline = (after.length > 0 && !after.startsWith('\\n\\n')) ? (after.startsWith('\\n') ? '\\n' : '\\n\\n') : '';
                        var insertion = prefixNewline + convertedTable + suffixNewline;
                        $textarea.value = before + insertion + after;
                        $textarea.selectionStart = $textarea.selectionEnd = startPos + insertion.length;
                        triggerRender($previewMd, $textarea.value);
                        $textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        return;
                    }
                }
            });

            let publishNudgeTimer = null;
            let publishNudgeShown = false;
            const clearPublishNudgeTimer = () => {
                if (publishNudgeTimer) {
                    clearTimeout(publishNudgeTimer);
                    publishNudgeTimer = null;
                }
            }
            const schedulePublishNudge = () => {
                clearPublishNudgeTimer();
                if (publishNudgeShown || APP_STATE.isPublished || !$textarea.value.trim()) return;
                publishNudgeTimer = setTimeout(() => {
                    publishNudgeShown = true;
                    openPublishOptions();
                }, AUTOSAVE_IDLE_MS);
            }

            $textarea.addEventListener('input', () => {
                schedulePublishNudge()
                if (!APP_STATE.isBlock) triggerRender($previewMd, $textarea.value)
            })
        }

        // Password buttons
        const bindPwHandler = (btnSelector, type) => {
            const btn = document.querySelector(btnSelector);
            if (btn) { btn.onclick = async function () {
                const passwd = await openPasswordModal({ title: getI18n('enpw'), allowEmpty: true })
                if (passwd == null) return;
                fetchJson(window.location.pathname + '/pw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passwd: passwd.trim(), type }) })
                    .then(res => { if (res.err !== 0) { return errHandle(res.msg) } window.showToast(passwd ? getI18n('pwss') : getI18n('pwrs')); location.reload() })
                    .catch(err => errHandle(err))
            }}
        }
        bindPwHandler('.opt-pw', 'edit');
        bindPwHandler('.opt-pw-view', 'view');

        if ($modeBtn) {
            $modeBtn.onclick = function (e) {
                const previousIsMd = this.getAttribute('aria-pressed') === 'true'
                const isMd = !previousIsMd
                this.classList.toggle('is-checked', isMd)
                this.setAttribute('aria-pressed', isMd ? 'true' : 'false')
                fetchJson(window.location.pathname + '/setting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: isMd ? 'md' : 'plain' }) })
                    .then(res => {
                        if (res.err !== 0) {
                            this.classList.toggle('is-checked', previousIsMd)
                            this.setAttribute('aria-pressed', previousIsMd ? 'true' : 'false')
                            return errHandle(res.msg)
                        }
                        window.location.reload()
                    })
                    .catch(err => {
                        this.classList.toggle('is-checked', previousIsMd)
                        this.setAttribute('aria-pressed', previousIsMd ? 'true' : 'false')
                        errHandle(err)
                    })
            }
        }

        // Published share URL
        const $shareOpenLink = document.querySelector('#share-open-link');
        const $shareCopyBtn = document.querySelector('#copy-share-btn');
        const $copyPresentShareBtn = document.querySelector('#copy-present-share-btn');
        const $copyEmbedCodeBtn = document.querySelector('#copy-embed-code-btn');
        const $embedModal = document.querySelector('.embed-modal');
        const $embedModalCode = $embedModal?.querySelector('.embed-modal-code');
        const $embedModalCopyBtn = $embedModal?.querySelector('.embed-modal-copy-btn');
        const $embedModalCloseBtn = $embedModal?.querySelector('.embed-modal-close');
        const $publicIndexBtn = document.querySelector('#public-index-btn');
        const $annotationsEnabledBtn = document.querySelector('#annotations-enabled-btn');
        const $unpublishBtn = document.querySelector('.unpublish-btn');
        const $sharePublishMenuBtn = document.querySelector('.share-publish-menu-btn');
        const $readonlyEditBtn = document.querySelector('#readonly-edit-btn');
        const initialShareUrl = getCurrentShareUrl()
        if ($shareOpenLink) {
            $shareOpenLink.href = initialShareUrl || '#'
            $shareOpenLink.addEventListener('click', event => {
                const shareUrl = getCurrentShareUrl()
                if (!shareUrl) {
                    event.preventDefault()
                    errHandle(APP_STATE.lang === 'zh-TW' ? '請先發布文章' : 'Publish this note first')
                    return
                }
                $shareOpenLink.href = shareUrl
            })
        }
        const $sharePresentOpenLink = document.querySelector('#share-present-open-link');
        if ($sharePresentOpenLink) {
            $sharePresentOpenLink.href = initialShareUrl ? initialShareUrl + '/present' : '#'
            $sharePresentOpenLink.addEventListener('click', event => {
                const shareUrl = getCurrentShareUrl()
                if (!shareUrl) {
                    event.preventDefault()
                    errHandle(APP_STATE.lang === 'zh-TW' ? '請先發布文章' : 'Publish this note first')
                    return
                }
                $sharePresentOpenLink.href = shareUrl + '/present'
            })
        }
        const $shareBookOpenLink = document.querySelector('#share-book-open-link');
        if ($shareBookOpenLink) {
            $shareBookOpenLink.href = initialShareUrl ? initialShareUrl + '/book' : '#'
            $shareBookOpenLink.addEventListener('click', event => {
                const shareUrl = getCurrentShareUrl()
                if (!shareUrl) {
                    event.preventDefault()
                    errHandle(APP_STATE.lang === 'zh-TW' ? '請先發布文章' : 'Publish this note first')
                    return
                }
                $shareBookOpenLink.href = shareUrl + '/book'
            })
        }
        const $copyBookShareBtn = document.querySelector('#copy-book-share-btn');
        if (initialShareUrl) recordShareHistory('created', initialShareUrl, APP_STATE.title);
        if ($shareCopyBtn) {
            $shareCopyBtn.addEventListener('click', async () => {
                const shareUrl = getCurrentShareUrl()
                if (!shareUrl) {
                    errHandle(APP_STATE.lang === 'zh-TW' ? '請先發布文章' : 'Publish this note first')
                    return
                }
                try { 
                    await clipboardCopy(shareUrl); 
                    window.showToast(getI18n('copied') || 'Copied!'); 
                } catch (e) { 
                    window.showAppDialog({ title: getI18n('err'), message: getI18n('copyFailed'), kind: 'error' });
                }
            });
        }
        if ($copyPresentShareBtn) {
            $copyPresentShareBtn.addEventListener('click', async () => {
                const presentationUrl = getCurrentShareUrl()
                if (!presentationUrl) {
                    errHandle(APP_STATE.lang === 'zh-TW' ? '請先發布文章' : 'Publish this note first')
                    return
                }
                try { 
                    await clipboardCopy(presentationUrl + '/present'); 
                    window.showToast(getI18n('copied') || 'Copied!'); 
                } catch (e) { 
                    window.showAppDialog({ title: getI18n('err'), message: getI18n('copyFailed'), kind: 'error' });
                }
            });
        }
        if ($copyBookShareBtn) {
            $copyBookShareBtn.addEventListener('click', async () => {
                const bookUrl = getCurrentShareUrl()
                if (!bookUrl) {
                    errHandle(APP_STATE.lang === 'zh-TW' ? '請先發布文章' : 'Publish this note first')
                    return
                }
                try { 
                    await clipboardCopy(bookUrl + '/book'); 
                    window.showToast(getI18n('copied') || 'Copied!'); 
                } catch (e) { 
                    window.showAppDialog({ title: getI18n('err'), message: getI18n('copyFailed'), kind: 'error' });
                }
            });
        }
        if ($copyEmbedCodeBtn && $embedModal && $embedModalCode) {
            const getEmbedCode = () => {
                const embedUrl = new URL(window.location.href);
                embedUrl.searchParams.set('embed', '1');
                embedUrl.hash = '';
                return '<iframe src="' + embedUrl.toString() + '" title="' + (APP_STATE.title || 'Shared note') + '" width="100%" height="600" frameborder="0" loading="lazy"></iframe>';
            };
            const closeEmbedModal = () => { closeModal($embedModal); };
            $copyEmbedCodeBtn.addEventListener('click', () => {
                $embedModalCode.value = getEmbedCode();
                openModal($embedModal, { initialFocus: $embedModalCode, trigger: $copyEmbedCodeBtn });
                $embedModalCode.select();
            });
            $embedModalCopyBtn?.addEventListener('click', async () => {
                try {
                    await clipboardCopy($embedModalCode.value);
                    window.showToast(getI18n('copied') || 'Copied!');
                } catch (e) {
                    window.showAppDialog({ title: getI18n('err'), message: getI18n('copyFailed'), kind: 'error' });
                }
            });
            $embedModalCloseBtn?.addEventListener('click', closeEmbedModal);
            $embedModal.querySelector('.modal-mask')?.addEventListener('click', closeEmbedModal);
        }
        if ($publicIndexBtn) {
            syncPublicIndexButton();
            $publicIndexBtn.addEventListener('click', async () => {
                const nextValue = APP_STATE.publicIndex !== true
                try {
                    await setPublicIndex(nextValue)
                    syncPublicIndexButton()
                    window.showToast(getI18n(nextValue ? 'publicIndexUpdatedOn' : 'publicIndexUpdatedOff'))
                } catch (error) {
                    errHandle(error.message || error)
                }
            })
        }
        if ($publicationCopyUrl) {
            $publicationCopyUrl.addEventListener('click', async () => {
                const shareUrl = getCurrentShareUrl()
                if (!shareUrl) return
                try {
                    await clipboardCopy(shareUrl)
                    window.showToast(getI18n('copied'))
                } catch (error) {
                    errHandle(getI18n('copyFailed'))
                }
            })
        }
        if ($publicationPublicIndex) {
            $publicationPublicIndex.addEventListener('click', async () => {
                if (!APP_STATE.isPublished) return
                const nextValue = APP_STATE.publicIndex !== true
                $publicationPublicIndex.disabled = true
                try {
                    await setPublicIndex(nextValue)
                    syncPublicIndexButton()
                    window.showToast(getI18n(nextValue ? 'publicIndexUpdatedOn' : 'publicIndexUpdatedOff'))
                } catch (error) {
                    errHandle(error.message || error)
                } finally {
                    $publicationPublicIndex.disabled = false
                }
            })
        }
        if ($annotationsEnabledBtn) {
            syncAnnotationsEnabledButton()
            $annotationsEnabledBtn.addEventListener('click', async () => {
                const nextValue = APP_STATE.annotationsEnabled !== true
                $annotationsEnabledBtn.disabled = true
                try {
                    await persistSetting({ annotationsEnabled: nextValue })
                    syncAnnotationsEnabledButton()
                    window.showToast(getI18n(nextValue ? 'annotationsUpdatedOn' : 'annotationsUpdatedOff'))
                } catch (error) {
                    errHandle(error.message || error)
                } finally {
                    $annotationsEnabledBtn.disabled = false
                }
            })
        }
        const $shareExpiresSelect = document.querySelector('#share-expires-select')
        if ($shareExpiresSelect) {
            $shareExpiresSelect.addEventListener('change', async () => {
                const val = $shareExpiresSelect.value
                try {
                    await persistSetting({ shareExpiresIn: val })
                    APP_STATE.shareExpiresIn = val
                    window.showToast?.(getI18n('saved') || 'Saved')
                } catch (err) {
                    errHandle(err)
                }
            })
        }
        const $burnAfterReadingBtn = document.querySelector('#burn-after-reading-btn')
        if ($burnAfterReadingBtn) {
            $burnAfterReadingBtn.addEventListener('click', async () => {
                const current = APP_STATE.shareBurnAfterReading === true
                const nextVal = !current
                try {
                    await persistSetting({ shareBurnAfterReading: nextVal })
                    APP_STATE.shareBurnAfterReading = nextVal
                    $burnAfterReadingBtn.classList.toggle('opt-button-accent', nextVal)
                    $burnAfterReadingBtn.setAttribute('data-burn-after-reading', String(nextVal))
                    $burnAfterReadingBtn.setAttribute('aria-pressed', String(nextVal))
                    $burnAfterReadingBtn.textContent = nextVal ? (getI18n('burnAfterReadingOn') || 'On') : (getI18n('burnAfterReadingOff') || 'Off')
                    window.showToast?.(getI18n('saved') || 'Saved')
                } catch (err) {
                    errHandle(err)
                }
            })
        }
        const $burnAfterReadingBtnDraft = document.querySelector('#burn-after-reading-btn-draft')
        if ($burnAfterReadingBtnDraft) {
            $burnAfterReadingBtnDraft.addEventListener('click', () => {
                const current = $burnAfterReadingBtnDraft.getAttribute('data-burn-after-reading') === 'true'
                const nextVal = !current
                $burnAfterReadingBtnDraft.classList.toggle('opt-button-accent', nextVal)
                $burnAfterReadingBtnDraft.setAttribute('data-burn-after-reading', String(nextVal))
                $burnAfterReadingBtnDraft.setAttribute('aria-pressed', String(nextVal))
                $burnAfterReadingBtnDraft.textContent = nextVal ? (getI18n('burnAfterReadingOn') || 'On') : (getI18n('burnAfterReadingOff') || 'Off')
            })
        }
        const syncVaultModeUI = (mode, isDraft) => {
            const suffix = isDraft ? '-draft' : ''
            const pExpires = document.getElementById('vault-panel-expires' + suffix)
            const pBurn = document.getElementById('vault-panel-burn' + suffix)
            const pTimelock = document.getElementById('vault-panel-timelock' + suffix)
            const pDeadman = document.getElementById('vault-panel-deadman' + suffix)
            if (pExpires) pExpires.style.display = (mode === 'standard' || mode === 'burn') ? '' : 'none'
            if (pBurn) pBurn.style.display = (mode === 'burn') ? '' : 'none'
            if (pTimelock) pTimelock.style.display = (mode === 'timelock') ? '' : 'none'
            if (pDeadman) pDeadman.style.display = (mode === 'deadman') ? '' : 'none'
        }
        const $shareVaultModeSelect = document.querySelector('#share-vault-mode-select')
        if ($shareVaultModeSelect) {
            $shareVaultModeSelect.addEventListener('change', async () => {
                const mode = $shareVaultModeSelect.value
                syncVaultModeUI(mode, false)
                try {
                    await persistSetting({ shareMode: mode, shareBurnAfterReading: mode === 'burn' })
                    APP_STATE.shareMode = mode
                    APP_STATE.shareBurnAfterReading = mode === 'burn'
                    window.showToast?.(getI18n('saved') || 'Saved')
                } catch (err) {
                    errHandle(err)
                }
            })
        }
        const $shareVaultModeSelectDraft = document.querySelector('#share-vault-mode-select-draft')
        if ($shareVaultModeSelectDraft) {
            $shareVaultModeSelectDraft.addEventListener('change', () => {
                syncVaultModeUI($shareVaultModeSelectDraft.value, true)
            })
        }
        document.addEventListener('change', async (e) => {
            const vaultModeSel = e.target.closest('#share-vault-mode-select');
            if (vaultModeSel && vaultModeSel !== $shareVaultModeSelect) {
                const mode = vaultModeSel.value;
                syncVaultModeUI(mode, false);
                try {
                    await persistSetting({ shareMode: mode, shareBurnAfterReading: mode === 'burn' });
                    APP_STATE.shareMode = mode;
                    APP_STATE.shareBurnAfterReading = mode === 'burn';
                    window.showToast?.(getI18n('saved') || 'Saved');
                } catch (err) {
                    errHandle(err);
                }
                return;
            }
            const vaultModeDraftSel = e.target.closest('#share-vault-mode-select-draft');
            if (vaultModeDraftSel && vaultModeDraftSel !== $shareVaultModeSelectDraft) {
                syncVaultModeUI(vaultModeDraftSel.value, true);
                return;
            }
        });
        const $shareUnlockSelect = document.querySelector('#share-unlock-select')
        if ($shareUnlockSelect) {
            $shareUnlockSelect.addEventListener('change', async () => {
                const val = $shareUnlockSelect.value
                try {
                    await persistSetting({ shareUnlockIn: val })
                    APP_STATE.shareUnlockIn = val
                    window.showToast?.(getI18n('saved') || 'Saved')
                } catch (err) {
                    errHandle(err)
                }
            })
        }
        const $sharePulseSelect = document.querySelector('#share-pulse-select')
        if ($sharePulseSelect) {
            $sharePulseSelect.addEventListener('change', async () => {
                const val = $sharePulseSelect.value
                try {
                    await persistSetting({ sharePulseInterval: val })
                    APP_STATE.sharePulseInterval = val
                    window.showToast?.(getI18n('saved') || 'Saved')
                } catch (err) {
                    errHandle(err)
                }
            })
        }
        const $sharePulseNowBtn = document.querySelector('#share-pulse-now-btn')
        if ($sharePulseNowBtn) {
            $sharePulseNowBtn.addEventListener('click', async () => {
                $sharePulseNowBtn.disabled = true
                try {
                    const res = await fetch('/api/shares/' + encodeURIComponent(APP_STATE.shareId) + '/pulse', { method: 'POST' })
                    const data = await res.json()
                    if (data.err === 0) {
                        window.showToast?.(getI18n('pulseSuccess') || 'Pulse successful!')
                    } else {
                        errHandle(data.msg)
                    }
                } catch (err) {
                    errHandle(err)
                } finally {
                    $sharePulseNowBtn.disabled = false
                }
            })
        }
        const $sharePulseCopyBtn = document.querySelector('#share-pulse-copy-btn')
        if ($sharePulseCopyBtn) {
            $sharePulseCopyBtn.addEventListener('click', async () => {
                const token = $sharePulseCopyBtn.getAttribute('data-pulse-token') || APP_STATE.sharePulseToken
                const pulseUrl = window.location.origin + '/api/shares/' + encodeURIComponent(APP_STATE.shareId) + '/pulse?token=' + encodeURIComponent(token)
                try {
                    await navigator.clipboard.writeText(pulseUrl)
                    window.showToast?.(getI18n('pulseCopied') || 'Pulse link copied!')
                } catch (err) {
                    window.prompt(getI18n('pulseCopyLink') || 'Copy link:', pulseUrl)
                }
            })
        }
        // Share Actions (Delegated on document to support floating portal menus)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const presetBtn = e.target.closest?.('.vault-preset-btn');
                if (presetBtn && e.target === presetBtn) {
                    e.preventDefault();
                    presetBtn.click();
                }
            }
        });
        const toLocalDatetimeValue = (dateObj) => {
            if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) return '';
            const pad = (n) => String(n).padStart(2, '0');
            const y = dateObj.getFullYear();
            const m = pad(dateObj.getMonth() + 1);
            const d = pad(dateObj.getDate());
            const h = pad(dateObj.getHours());
            const min = pad(dateObj.getMinutes());
            const s = pad(dateObj.getSeconds());
            return y + '-' + m + '-' + d + 'T' + h + ':' + min + ':' + s;
        };

        const updateVaultModalLanguage = (targetLang) => {
            const isZh = targetLang === 'zh-TW';
            const modal = document.getElementById('vault-presets-modal');
            if (!modal) return;
            const titleSpan = modal.querySelector('.vault-presets-title [data-i18n-key="title"]');
            if (titleSpan) titleSpan.textContent = isZh ? 'Seal 存取控制' : 'Seal Access Control';
            const subtitle = modal.querySelector('.vault-presets-subtitle');
            if (subtitle) subtitle.textContent = isZh ? 'Seal 與密碼同屬資產存取控制：密碼保護內容，Seal 控制何時或如何釋出。Seal 建立或解除會立即生效。' : 'Seal and password are asset access controls: password protects content, Seal controls when and how it is released. Changes take effect immediately.';
            const tip = modal.querySelector('.vault-presets-tip');
            if (tip) tip.textContent = isZh ? '💡 點選任一情境範本僅會自動填入 Seal 參數，不會影響現有筆記內容。' : '💡 Presets auto-fill Seal parameters only without affecting existing note content.';
            const cancelBtn = modal.querySelector('#vault-presets-cancel-btn');
            if (cancelBtn) cancelBtn.textContent = isZh ? '取消' : 'Cancel';
            const modeLabel = modal.querySelector('[data-i18n-key="modeLabel"]');
            if (modeLabel) modeLabel.textContent = isZh ? '模式' : 'Mode';
            const unlockTimeLabel = modal.querySelector('[data-i18n-key="unlockTimeLabel"]');
            if (unlockTimeLabel) unlockTimeLabel.textContent = isZh ? '解鎖時間' : 'Unlock Time';
            const maxViewsLabel = modal.querySelector('[data-i18n-key="maxViewsLabel"]');
            if (maxViewsLabel) maxViewsLabel.textContent = isZh ? '最大瀏覽次數' : 'Max Views';
            const pulseIntervalLabel = modal.querySelector('[data-i18n-key="pulseIntervalLabel"]');
            if (pulseIntervalLabel) pulseIntervalLabel.textContent = isZh ? 'Pulse 間隔 (分鐘)' : 'Pulse Interval (Minutes)';
            const expirationLabel = modal.querySelector('[data-i18n-key="expirationLabel"]');
            if (expirationLabel) expirationLabel.textContent = isZh ? '保留期限' : 'Expiration';
            const viewsUnit = modal.querySelector('[data-i18n-key="viewsUnit"]');
            if (viewsUnit) viewsUnit.textContent = isZh ? '次 (預設 1 次)' : 'views (Default 1)';
            const timelockHint = modal.querySelector('[data-i18n-key="timelockHint"]');
            if (timelockHint) timelockHint.textContent = isZh ? '解鎖時間到達前訪客只能查看倒數封印頁面，時間到達時自動公開內容。' : 'Visitors see a countdown lock page until unlock time arrives, then note is released.';
            const burnHint = modal.querySelector('[data-i18n-key="burnHint"]');
            if (burnHint) burnHint.textContent = isZh ? '分享連結達到瀏覽上限後會永久銷毀；作者原始筆記仍保留。' : 'The share is permanently destroyed at the view limit; the author’s original note remains in the wiki.';
            const deadmanHint = modal.querySelector('[data-i18n-key="deadmanHint"]');
            if (deadmanHint) deadmanHint.textContent = isZh ? '作者定時簽到保活；若失聯逾期未發送心跳，筆記將自動解鎖釋出。' : 'Author must check in regularly; if pulse heartbeat lapses, note is released.';
            const expirationHint = modal.querySelector('[data-i18n-key="expirationHint"]');
            if (expirationHint) expirationHint.textContent = isZh ? '超過保留期限後分享連結將自動過期下架並顯示 410 墓碑頁面。' : 'Share link automatically expires with a friendly 410 tombstone after the retention period.';
            const presetsSectionTitle = modal.querySelector('[data-i18n-key="presetsSectionTitle"]');
            if (presetsSectionTitle) presetsSectionTitle.textContent = isZh ? '⚡ 快速情境範本 (點選自動填入 Seal 參數)' : '⚡ Quick Scenario Presets (Auto-fills parameters)';
            const removeBtn = modal.querySelector('#seal-remove-btn');
            if (removeBtn) removeBtn.textContent = isZh ? '解除 Seal' : 'Remove Seal';

            modal.querySelectorAll('.vault-pref-lang-btn').forEach(btn => {
                const active = btn.getAttribute('data-vault-lang') === targetLang;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            modal.querySelectorAll('.vault-preset-card').forEach(card => {
                const title = card.querySelector('.preset-card-title');
                const desc = card.querySelector('.preset-card-desc');
                const badge = card.querySelector('.preset-card-badge');
                if (title) title.textContent = (isZh ? card.getAttribute('data-title-zh') : card.getAttribute('data-title-en')) || title.textContent;
                if (desc) desc.textContent = (isZh ? card.getAttribute('data-desc-zh') : card.getAttribute('data-desc-en')) || desc.textContent;
                if (badge) badge.textContent = (isZh ? card.getAttribute('data-badge-zh') : card.getAttribute('data-badge-en')) || badge.textContent;
            });
            syncSealModalState();
        };

        const syncSealModalState = () => {
            const modal = document.getElementById('vault-presets-modal');
            const isZh = (modal?.querySelector('.vault-pref-lang-btn.is-active')?.getAttribute('data-vault-lang') || APP_STATE.lang) === 'zh-TW';
            const modeSelect = modal ? modal.querySelector('#seal-mode-select') : document.getElementById('seal-mode-select');
            const badge = modal ? modal.querySelector('#seal-status-badge') : document.getElementById('seal-status-badge');
            const removeBtn = modal ? modal.querySelector('#seal-remove-btn') : document.getElementById('seal-remove-btn');
            const saveBtn = modal ? modal.querySelector('#seal-save-btn') : document.getElementById('seal-save-btn');
            const dotIndicator = document.getElementById('seal-dot-indicator');
            const dotIndicatorBlock = document.getElementById('seal-dot-indicator-block');
            const menuStatusPill = document.getElementById('share-menu-seal-status');

            const currentMode = APP_STATE.sealMode || (APP_STATE.shareBurnAfterReading ? 'burn' : (APP_STATE.shareUnlockAt ? 'timelock' : (APP_STATE.sharePulseDueAt ? 'deadman' : (APP_STATE.shareExpiresIn && APP_STATE.shareExpiresIn !== 'none' ? 'expires' : (APP_STATE.shareMode !== 'standard' ? APP_STATE.shareMode : 'none'))))) || 'none';
            const isSealed = currentMode && currentMode !== 'none' && currentMode !== 'standard';

            if (dotIndicator) dotIndicator.style.display = isSealed ? 'block' : 'none';
            if (dotIndicatorBlock) dotIndicatorBlock.style.display = isSealed ? 'block' : 'none';
            if (menuStatusPill) {
                menuStatusPill.classList.toggle('is-sealed', isSealed);
                if (!isSealed) {
                    menuStatusPill.textContent = isZh ? '未設定 ➔' : 'Unsealed ➔';
                } else if (currentMode === 'timelock') {
                    menuStatusPill.textContent = isZh ? '定時解鎖 ➔' : 'Time Lock ➔';
                } else if (currentMode === 'burn') {
                    menuStatusPill.textContent = isZh ? '閱後即焚 ➔' : 'Burn ➔';
                } else if (currentMode === 'deadman') {
                    menuStatusPill.textContent = isZh ? '亡者開關 ➔' : 'Dead Man ➔';
                } else if (currentMode === 'expires') {
                    menuStatusPill.textContent = isZh ? '保留期限 ➔' : 'Expiration ➔';
                } else {
                    menuStatusPill.textContent = isZh ? '已封印 ➔' : 'Sealed ➔';
                }
            }

            if (!modal) return;

            if (modeSelect && (!modeSelect.value || modeSelect.value === 'none' || modeSelect.value === currentMode)) {
                modeSelect.value = isSealed ? currentMode : 'none';
            }

            const activeMode = modeSelect ? modeSelect.value : currentMode;

            // Panel visibility
            const panelTimelock = modal.querySelector('#seal-param-panel-timelock');
            const panelBurn = modal.querySelector('#seal-param-panel-burn');
            const panelDeadman = modal.querySelector('#seal-param-panel-deadman');
            const panelExpires = modal.querySelector('#seal-param-panel-expires');
            if (panelTimelock) panelTimelock.style.display = activeMode === 'timelock' ? 'block' : 'none';
            if (panelBurn) panelBurn.style.display = activeMode === 'burn' ? 'block' : 'none';
            if (panelDeadman) panelDeadman.style.display = activeMode === 'deadman' ? 'block' : 'none';
            if (panelExpires) panelExpires.style.display = activeMode === 'expires' ? 'block' : 'none';

            // Status badge text
            if (badge) {
                badge.classList.remove('badge-unsealed', 'badge-sealed');
                if (isSealed) {
                    badge.classList.add('badge-sealed');
                    let modeText = isZh ? '已封印' : 'Sealed';
                    if (currentMode === 'timelock') modeText += isZh ? ' (定時解鎖)' : ' (Time Lock)';
                    else if (currentMode === 'burn') modeText += isZh ? ' (閱後即焚)' : ' (Burn After Read)';
                    else if (currentMode === 'deadman') modeText += isZh ? " (Dead Man's Switch)" : " (Dead Man's Switch)";
                    else if (currentMode === 'expires') modeText += isZh ? " (保留期限)" : " (Expiration)";
                    badge.textContent = modeText;
                } else {
                    badge.classList.add('badge-unsealed');
                    badge.textContent = isZh ? '未設定' : 'Unsealed';
                }
            }

            if (removeBtn) {
                removeBtn.style.display = isSealed ? 'inline-flex' : 'none';
            }
            if (saveBtn) {
                saveBtn.textContent = isSealed ? (isZh ? '更新 Seal' : 'Update Seal') : (isZh ? '建立 Seal' : 'Create Seal');
            }

            // Populate form values if empty
            if (activeMode === 'timelock') {
                const unlockInput = modal.querySelector('#seal-unlock-at');
                if (unlockInput && !unlockInput.value) {
                    if (APP_STATE.shareUnlockAt) {
                        unlockInput.value = toLocalDatetimeValue(new Date(APP_STATE.shareUnlockAt * 1000));
                    } else {
                        unlockInput.value = toLocalDatetimeValue(new Date(Date.now() + 86400 * 1000));
                    }
                }
            } else if (activeMode === 'burn') {
                const maxViewsInput = modal.querySelector('#seal-max-views');
                if (maxViewsInput && !maxViewsInput.value) {
                    maxViewsInput.value = APP_STATE.shareMaxViews || 1;
                }
            } else if (activeMode === 'deadman') {
                const pulseInput = modal.querySelector('#seal-pulse-minutes');
                if (pulseInput && (!pulseInput.value || pulseInput.value === '10080')) {
                    const mins = Math.round((APP_STATE.sharePulseInterval || 604800) / 60);
                    pulseInput.value = mins || 10080;
                }
                const liveBox = modal.querySelector('#seal-deadman-live-box');
                const liveText = modal.querySelector('#seal-deadman-live-text');
                if (liveBox && liveText) {
                    if (APP_STATE.sharePulseDueAt) {
                        liveBox.style.display = 'flex';
                        const diffSec = Math.max(0, APP_STATE.sharePulseDueAt - Math.floor(Date.now() / 1000));
                        const d = Math.floor(diffSec / 86400);
                        const h = Math.floor((diffSec % 86400) / 3600);
                        const m = Math.floor((diffSec % 3600) / 60);
                        liveText.textContent = isZh
                            ? ('保活有效中：剩餘 ' + d + ' 天 ' + h + ' 小時 ' + m + ' 分')
                            : ('Active heartbeat: ' + d + 'd ' + h + 'h ' + m + 'm remaining');
                    } else {
                        liveBox.style.display = 'none';
                    }
                }
            } else if (activeMode === 'expires') {
                const expiresInput = modal.querySelector('#seal-expires-select');
                if (expiresInput && APP_STATE.shareExpiresIn && APP_STATE.shareExpiresIn !== 'none') {
                    expiresInput.value = APP_STATE.shareExpiresIn;
                }
            }
        };

        setTimeout(syncSealModalState, 50);

        document.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'seal-mode-select') {
                syncSealModalState();
            }
        });

        document.addEventListener('click', async (e) => {
            const vaultLangBtn = e.target.closest('.vault-pref-lang-btn');
            if (vaultLangBtn) {
                e.preventDefault();
                const targetLang = vaultLangBtn.getAttribute('data-vault-lang') || 'zh-TW';
                updateVaultModalLanguage(targetLang);
                return;
            }
            const timeChip = e.target.closest('[data-time-add]');
            if (timeChip) {
                e.preventDefault();
                const addStr = timeChip.getAttribute('data-time-add');
                let addMs = 3600 * 1000;
                if (addStr === '1h') addMs = 3600 * 1000;
                else if (addStr === '1d') addMs = 86400 * 1000;
                else if (addStr === '3d') addMs = 3 * 86400 * 1000;
                else if (addStr === '7d') addMs = 7 * 86400 * 1000;
                else if (addStr === '30d') addMs = 30 * 86400 * 1000;
                const targetDate = new Date(Date.now() + addMs);
                const input = document.getElementById('seal-unlock-at');
                if (input) input.value = toLocalDatetimeValue(targetDate);
                return;
            }
            const pulseChip = e.target.closest('[data-pulse-mins]');
            if (pulseChip) {
                e.preventDefault();
                const mins = pulseChip.getAttribute('data-pulse-mins');
                const input = document.getElementById('seal-pulse-minutes');
                if (input && mins) input.value = mins;
                return;
            }
            const expireChip = e.target.closest('[data-expire-val]');
            if (expireChip) {
                e.preventDefault();
                const exp = expireChip.getAttribute('data-expire-val');
                const input = document.getElementById('seal-expires-select');
                if (input && exp) input.value = exp;
                return;
            }
            const modalPulseBtn = e.target.closest('#seal-modal-pulse-btn');
            if (modalPulseBtn) {
                e.preventDefault();
                const isZh = APP_STATE.lang === 'zh-TW';
                if (!APP_STATE.shareId) {
                    window.showToast?.(isZh ? '筆記尚未發布，無法發送心跳' : 'Note not yet published');
                    return;
                }
                try {
                    modalPulseBtn.disabled = true;
                    await fetchJson('/api/shares/' + encodeURIComponent(APP_STATE.shareId) + '/pulse', { method: 'POST' });
                    APP_STATE.sharePulseDueAt = Math.floor(Date.now() / 1000) + (APP_STATE.sharePulseInterval || 604800);
                    syncSealModalState();
                    window.showToast?.(isZh ? '❤️ Pulse 心跳發送成功！' : '❤️ Pulse heartbeat sent!');
                } catch (err) {
                    errHandle(err);
                } finally {
                    modalPulseBtn.disabled = false;
                }
                return;
            }
            const modalPulseCopyBtn = e.target.closest('#seal-modal-pulse-copy-btn');
            if (modalPulseCopyBtn) {
                e.preventDefault();
                const isZh = APP_STATE.lang === 'zh-TW';
                if (!APP_STATE.shareId) {
                    window.showToast?.(isZh ? '筆記尚未發布，無法取得心跳連結' : 'Note not yet published');
                    return;
                }
                const token = APP_STATE.sharePulseToken || '';
                const pulseUrl = window.location.origin + '/api/shares/' + encodeURIComponent(APP_STATE.shareId) + '/pulse?token=' + encodeURIComponent(token);
                try {
                    await navigator.clipboard.writeText(pulseUrl);
                    window.showToast?.(isZh ? '📋 心跳 Webhook 連結已複製！' : '📋 Pulse Webhook URL copied!');
                } catch (err) {
                    window.prompt(isZh ? '請複製心跳連結：' : 'Copy pulse link:', pulseUrl);
                }
                return;
            }
            const saveSealBtn = e.target.closest('#seal-save-btn');
            if (saveSealBtn) {
                e.preventDefault();
                const modal = document.getElementById('vault-presets-modal');
                const mode = document.getElementById('seal-mode-select')?.value || 'none';
                const presetExpires = modal?.dataset.presetExpires || '';
                const isZh = (modal?.querySelector('.vault-pref-lang-btn.is-active')?.getAttribute('data-vault-lang') || APP_STATE.lang) === 'zh-TW';

                const settingPayload = {};
                if (mode === 'none') {
                    settingPayload.removeSeal = true;
                    settingPayload.sealMode = 'none';
                    settingPayload.shareMode = 'standard';
                    settingPayload.shareExpiresIn = 'none';
                } else if (mode === 'timelock') {
                    const unlockVal = document.getElementById('seal-unlock-at')?.value;
                    if (!unlockVal) {
                        window.showToast?.(isZh ? '請選擇解鎖時間' : 'Please specify an unlock time');
                        return;
                    }
                    settingPayload.sealMode = 'timelock';
                    settingPayload.shareMode = 'timelock';
                    settingPayload.sealUnlockAt = unlockVal;
                } else if (mode === 'burn') {
                    const views = parseInt(document.getElementById('seal-max-views')?.value, 10) || 1;
                    settingPayload.sealMode = 'burn';
                    settingPayload.shareMode = 'burn';
                    settingPayload.sealMaxViews = views;
                    settingPayload.shareBurnAfterReading = true;
                    if (presetExpires) settingPayload.shareExpiresIn = presetExpires;
                } else if (mode === 'deadman') {
                    const mins = parseInt(document.getElementById('seal-pulse-minutes')?.value, 10) || 10080;
                    settingPayload.sealMode = 'deadman';
                    settingPayload.shareMode = 'deadman';
                    settingPayload.sealPulseMinutes = mins;
                } else if (mode === 'expires') {
                    const expVal = document.getElementById('seal-expires-select')?.value || '30d';
                    settingPayload.sealMode = 'expires';
                    settingPayload.shareMode = 'standard';
                    settingPayload.shareExpiresIn = expVal;
                }

                try {
                    saveSealBtn.disabled = true;
                    await persistSetting(settingPayload);
                    if (mode === 'none') {
                        APP_STATE.sealMode = 'none';
                        APP_STATE.shareMode = 'standard';
                        APP_STATE.shareBurnAfterReading = false;
                        APP_STATE.shareUnlockAt = null;
                        APP_STATE.sharePulseDueAt = null;
                        APP_STATE.shareExpiresIn = 'none';
                        delete APP_STATE.shareMaxViews;
                    } else if (mode === 'timelock') {
                        APP_STATE.sealMode = 'timelock';
                        APP_STATE.shareMode = 'timelock';
                        APP_STATE.shareBurnAfterReading = false;
                        const parsedSec = Math.floor(new Date(document.getElementById('seal-unlock-at')?.value).getTime() / 1000);
                        if (parsedSec > 0) APP_STATE.shareUnlockAt = parsedSec;
                    } else if (mode === 'burn') {
                        APP_STATE.sealMode = 'burn';
                        APP_STATE.shareMode = 'burn';
                        APP_STATE.shareBurnAfterReading = true;
                        APP_STATE.shareMaxViews = settingPayload.sealMaxViews;
                        if (settingPayload.shareExpiresIn !== undefined) {
                            APP_STATE.shareExpiresIn = settingPayload.shareExpiresIn;
                        }
                    } else if (mode === 'deadman') {
                        APP_STATE.sealMode = 'deadman';
                        APP_STATE.shareMode = 'deadman';
                        APP_STATE.shareBurnAfterReading = false;
                        APP_STATE.sharePulseInterval = (settingPayload.sealPulseMinutes || 10080) * 60;
                        APP_STATE.sharePulseDueAt = Math.floor(Date.now() / 1000) + APP_STATE.sharePulseInterval;
                    } else if (mode === 'expires') {
                        APP_STATE.sealMode = 'expires';
                        APP_STATE.shareMode = 'standard';
                        APP_STATE.shareBurnAfterReading = false;
                        APP_STATE.shareUnlockAt = null;
                        APP_STATE.sharePulseDueAt = null;
                        APP_STATE.shareExpiresIn = settingPayload.shareExpiresIn;
                    }
                    syncSealModalState();
                    if (modal) closeModal(modal);
                    window.showToast?.(isZh ? '已成功儲存 Seal 存取控制！' : 'Seal access control saved successfully!');
                } catch (err) {
                    errHandle(err);
                } finally {
                    saveSealBtn.disabled = false;
                }
                return;
            }
            const removeSealBtn = e.target.closest('#seal-remove-btn');
            if (removeSealBtn) {
                e.preventDefault();
                const modal = document.getElementById('vault-presets-modal');
                const isZh = (modal?.querySelector('.vault-pref-lang-btn.is-active')?.getAttribute('data-vault-lang') || APP_STATE.lang) === 'zh-TW';
                try {
                    removeSealBtn.disabled = true;
                    await persistSetting({ removeSeal: true, sealMode: 'none', shareMode: 'standard', shareExpiresIn: 'none' });
                    APP_STATE.sealMode = 'none';
                    APP_STATE.shareMode = 'standard';
                    APP_STATE.shareBurnAfterReading = false;
                    APP_STATE.shareUnlockAt = null;
                    APP_STATE.sharePulseDueAt = null;
                    APP_STATE.shareExpiresIn = 'none';
                    delete APP_STATE.shareMaxViews;
                    syncSealModalState();
                    if (modal) closeModal(modal);
                    window.showToast?.(isZh ? '已解除 Seal 存取控制' : 'Seal access control removed');
                } catch (err) {
                    errHandle(err);
                } finally {
                    removeSealBtn.disabled = false;
                }
                return;
            }
            const openPresetsBtn = e.target.closest('#vault-presets-toolbar-btn, .vault-presets-toolbar-btn, #open-vault-presets-modal-btn, .open-vault-presets-modal-btn');
            if (openPresetsBtn) {
                e.preventDefault();
                const modal = document.getElementById('vault-presets-modal');
                if (modal) {
                    if (typeof updateVaultModalLanguage === 'function') {
                        updateVaultModalLanguage(APP_STATE.lang || 'zh-TW');
                    }
                    syncSealModalState();
                    const firstOption = modal.querySelector('.seal-mode-select') || modal.querySelector('.vault-preset-btn');
                    openModal(modal, { initialFocus: firstOption || openPresetsBtn, trigger: openPresetsBtn });
                }
                return;
            }
            const presetBtn = e.target.closest('.vault-preset-btn');
            if (presetBtn) {
                e.preventDefault();
                const presetId = presetBtn.getAttribute('data-preset-id');
                let mode = presetBtn.getAttribute('data-mode') || 'standard';
                const expires = presetBtn.getAttribute('data-expires') || '';
                const unlock = presetBtn.getAttribute('data-unlock') || '';
                const pulse = presetBtn.getAttribute('data-pulse') || '';
                const sealModal = document.getElementById('vault-presets-modal');
                if (sealModal) sealModal.dataset.presetExpires = expires;

                if (mode === 'standard' && expires) {
                    mode = 'expires';
                }

                document.querySelectorAll('.vault-preset-btn').forEach(b => b.classList.remove('active'));
                presetBtn.classList.add('active');

                const modeSelect = document.getElementById('seal-mode-select');
                if (modeSelect) {
                    modeSelect.value = (mode === 'standard' ? 'none' : mode);
                }

                if (mode === 'timelock') {
                    let unlockMs = 86400 * 1000;
                    if (unlock === '1h') unlockMs = 3600 * 1000;
                    else if (unlock === '1d') unlockMs = 86400 * 1000;
                    else if (unlock === '3d') unlockMs = 3 * 86400 * 1000;
                    else if (unlock === '7d') unlockMs = 7 * 86400 * 1000;
                    else if (unlock === '30d') unlockMs = 30 * 86400 * 1000;
                    const unlockInput = document.getElementById('seal-unlock-at');
                    if (unlockInput) unlockInput.value = toLocalDatetimeValue(new Date(Date.now() + unlockMs));
                } else if (mode === 'burn') {
                    const maxViewsInput = document.getElementById('seal-max-views');
                    if (maxViewsInput) maxViewsInput.value = 1;
                    if (expires) {
                        const expiresInput = document.getElementById('seal-expires-select');
                        if (expiresInput) expiresInput.value = expires;
                    }
                } else if (mode === 'deadman') {
                    let mins = 10080;
                    if (pulse === '3d') mins = 4320;
                    else if (pulse === '7d') mins = 10080;
                    else if (pulse === '14d') mins = 20160;
                    else if (pulse === '30d') mins = 43200;
                    const pulseInput = document.getElementById('seal-pulse-minutes');
                    if (pulseInput) pulseInput.value = mins;
                } else if (mode === 'expires') {
                    const expiresInput = document.getElementById('seal-expires-select');
                    if (expiresInput && expires) expiresInput.value = expires;
                }

                // Update seal modal UI
                syncSealModalState();

                // If note is already published, persist settings to server immediately
                const isPublished = APP_STATE.isPublished === true && Boolean(APP_STATE.shareId);
                if (isPublished) {
                    const isBurn = mode === 'burn';
                    const settingPayload = {
                        sealMode: mode === 'expires' ? 'expires' : (mode === 'standard' ? 'none' : mode),
                        shareMode: (mode === 'expires' || mode === 'standard') ? 'standard' : mode,
                        shareBurnAfterReading: isBurn,
                    };
                    if ((mode === 'expires' || mode === 'burn') && expires) settingPayload.shareExpiresIn = expires;
                    if (unlock) settingPayload.shareUnlockIn = unlock;
                    if (pulse) settingPayload.sharePulseInterval = pulse;
                    try {
                        await persistSetting(settingPayload);
                        if (settingPayload.shareExpiresIn !== undefined) {
                            APP_STATE.shareExpiresIn = settingPayload.shareExpiresIn;
                        }
                    } catch (err) {
                        errHandle(err);
                    }
                }

                // Bilingual Toast Feedback - parameter filled without modifying note content
                const modal = document.getElementById('vault-presets-modal');
                const isZh = (modal?.querySelector('.vault-pref-lang-btn.is-active')?.getAttribute('data-vault-lang') || APP_STATE.lang) === 'zh-TW';
                const label = (isZh ? presetBtn.getAttribute('data-title-zh') : presetBtn.getAttribute('data-title-en'))
                    || presetBtn.querySelector('.preset-card-title')?.textContent?.trim()
                    || presetBtn.querySelector('.preset-label')?.textContent?.trim()
                    || presetId;
                const toastPrefix = getI18n('quickPresetApplied') || (isZh ? '已帶入情境範本參數：' : 'Preset parameters loaded: ');
                window.showToast?.(toastPrefix + label);
                return;
            }
            const unpublishBtn = e.target.closest('.unpublish-btn');
            if (unpublishBtn) {
                e.preventDefault();
                if (!await confirmUnpublish()) return;
                fetchJson(window.location.pathname + '/setting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ share: false }) })
                    .then(res => { if (res.err !== 0) { return errHandle(res.msg); } allowUnload = true; window.location.reload(); }).catch(err => errHandle(err));
                return;
            }
            const publishMenuBtn = e.target.closest('.share-publish-menu-btn');
            if (publishMenuBtn) {
                e.preventDefault();
                openPublishOptions();
                return;
            }
        });

        if ($saveNoteBtn) {
            $saveNoteBtn.addEventListener('click', () => saveCurrentNote())
        }

        if ($autosaveToggle) {
            const handleAutosaveToggle = async () => {
                if (!APP_STATE.isPublished) {
                    window.showToast?.(getSaveBlockedMessage())
                    return
                }
                const previousValue = APP_STATE.autosave === true
                const nextValue = !previousValue
                try {
                    await persistSetting({ autosave: nextValue })
                    syncShareStateUI()
                    if (APP_STATE.autosave) scheduleAutosave()
                    else clearAutosaveTimer()
                    try { window.localStorage.setItem('cf-notepad-autosave', APP_STATE.autosave ? 'true' : 'false') } catch(e) {}
                } catch (error) {
                    APP_STATE.autosave = previousValue
                    syncShareStateUI()
                    errHandle(error.message || error)
                }
            }
            $autosaveToggle.addEventListener('click', handleAutosaveToggle)
            $autosaveToggle.addEventListener('change', handleAutosaveToggle)
        }

        if ($textarea) {
            $textarea.addEventListener('input', () => {
                if (hasUnsavedChanges()) {
                    showSaveStatus(APP_STATE.lang === 'zh-TW' ? '尚未儲存' : 'Unsaved changes')
                    scheduleAutosave()
                } else {
                    clearAutosaveTimer()
                }
            })
            window.addEventListener('beforeunload', event => {
                if (allowUnload || !hasUnsavedChanges()) return
                event.preventDefault()
                event.returnValue = ''
            })
        }

        if ($shareModal) {
            $closeBtn.onclick = function () { closeModal($shareModal) }
            $copyBtn.onclick = function () {
                clipboardCopy($shareInput.value)
                const originText = $copyBtn.innerHTML; const originColor = $copyBtn.style.background;
                $copyBtn.innerHTML = getI18n('copied'); $copyBtn.style.background = 'orange';
                window.setTimeout(() => { closeModal($shareModal); $copyBtn.innerHTML = originText; $copyBtn.style.background = originColor; }, 1500)
            }
        }

        if ($readonlyEditBtn) {
            $readonlyEditBtn.addEventListener('click', () => passwdPrompt())
        }
        const setupMobileShareFooter = () => {
            const footer = document.querySelector('.footer');
            const scrollTarget = $previewMd || $previewPlain;
            if (!document.body.classList.contains('share-view') || !footer || !scrollTarget) return;
            const media = window.matchMedia('(max-width: 960px)');
            let lastScrollTop = scrollTarget.scrollTop;

            const showFooter = () => footer.classList.remove('footer-hidden');
            const hideFooter = () => {
                if (media.matches) footer.classList.add('footer-hidden');
            }
            const handleScroll = () => {
                if (!media.matches) {
                    showFooter();
                    return;
                }

                const currentScrollTop = scrollTarget.scrollTop;
                
                // Near top or near bottom triggers forced show for better accessibility
                const isNearTop = currentScrollTop <= 15;
                const isNearBottom = scrollTarget.scrollHeight - scrollTarget.scrollTop <= scrollTarget.clientHeight + 15;

                if (isNearTop || isNearBottom || currentScrollTop < lastScrollTop) {
                    showFooter();
                } else {
                    hideFooter();
                }
                lastScrollTop = Math.max(currentScrollTop, 0);
            }

            scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
            if (media.addEventListener) {
                media.addEventListener('change', showFooter);
            } else if (media.addListener) {
                media.addListener(showFooter);
            }
        }
        setupMobileShareFooter();

        // --- Scroll Indicators Setup ---
        const setupScrollIndicators = () => {
            const createIndicator = (container, isFooter) => {
                const indicator = document.createElement('div');
                indicator.className = 'scroll-indicator-arrow';
                indicator.innerHTML = '<div class="scroll-indicator-arrow-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></div>';
                
                if (isFooter) {
                    document.body.appendChild(indicator);
                    const updatePos = () => {
                        const rect = container.getBoundingClientRect();
                        indicator.style.position = 'fixed';
                        indicator.style.left = (rect.right - 32) + 'px';
                        indicator.style.top = (rect.top + (rect.height - 24) / 2) + 'px';
                        indicator.style.zIndex = '130';
                    };
                    updatePos();
                    window.addEventListener('resize', updatePos);
                    window.addEventListener('scroll', updatePos);
                } else {
                    const wrap = container.parentElement;
                    if (wrap) {
                        wrap.style.position = 'relative';
                        wrap.appendChild(indicator);
                        indicator.style.position = 'absolute';
                        indicator.style.right = '8px';
                        indicator.style.top = '50%';
                        indicator.style.transform = 'translateY(-50%)';
                        indicator.style.zIndex = '10';
                    }
                }

                const checkScroll = () => {
                    const isScrollable = container.scrollWidth > container.clientWidth;
                    const isScrolledToEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 12;
                    if (isScrollable && !isScrolledToEnd) {
                        indicator.classList.add('show');
                    } else {
                        indicator.classList.remove('show');
                    }
                };

                container.addEventListener('scroll', () => {
                    indicator.classList.add('user-scrolled');
                }, { passive: true });

                setTimeout(checkScroll, 300);
                window.addEventListener('resize', checkScroll);
                const observer = new MutationObserver(checkScroll);
                observer.observe(container, { childList: true, subtree: true });
            };

            const toolbar = document.querySelector('.markdown-editor-toolbar');
            if (toolbar) createIndicator(toolbar, false);

            const footer = document.querySelector('.footer');
            if (footer) createIndicator(footer, true);
        };
        setupScrollIndicators();


        // --- Keyboard Viewport Adjuster for Mobile Input ---
        const setupKeyboardViewport = () => {
            if (window.visualViewport) {
                const initialHeight = window.innerHeight;
                window.visualViewport.addEventListener('resize', () => {
                    const currentHeight = window.visualViewport.height;
                    // If height shrinks by more than 150px, keyboard is likely open
                    if (initialHeight - currentHeight > 150) {
                        document.body.classList.add('keyboard-open');
                    } else {
                        document.body.classList.remove('keyboard-open');
                    }
                });
            }
        }
        setupKeyboardViewport();

        // --- Toast Notification Utility ---
        window.showToast = (message) => {
            let container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                document.body.appendChild(container);
            }
            
            const toast = document.createElement('div');
            toast.className = 'toast';
            const icon = document.createElement('span');
            icon.className = 'toast-check';
            icon.textContent = '✓';
            const text = document.createElement('span');
            text.textContent = String(message ?? '');
            toast.append(icon, text);
            container.appendChild(toast);
            
            // Fade-in trigger
            setTimeout(() => toast.classList.add('show'), 15);
            
            // Auto fade-out & remove
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 250);
            }, 3500);
        };

        // --- PWA Manual Install Handler ---
        window.__handlePwaInstall = async function(btn) {
            const isZh = (document.documentElement.lang || APP_STATE.lang || '').toLowerCase().startsWith('zh');
            const ua = navigator.userAgent || '';
            const platform = navigator.platform || '';
            const maxTouch = navigator.maxTouchPoints || 0;
            const isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouch > 1);
            const isMacSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Brave/.test(ua);
            const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

            const promptEvent = window.__deferredPwaPrompt;

            if (promptEvent) {
                if (btn) btn.disabled = true;
                try {
                    await promptEvent.prompt();
                    const choice = await promptEvent.userChoice;
                    if (choice && choice.outcome === 'accepted') {
                        window.__deferredPwaPrompt = null;
                        window.showToast(isZh ? '🎉 正在安裝 DAVID888 WIKI App...' : '🎉 Installing App...');
                    }
                } catch (e) {
                    console.warn('Install prompt error:', e);
                } finally {
                    if (btn) btn.disabled = false;
                }
                return;
            }

            let message = '';
            if (isStandalone) {
                message = isZh ? '✅ 目前已在 App 獨立視窗中運行' : '✅ Already running in standalone app mode';
            } else if (isIOS) {
                message = isZh ? '📱 iOS 請點擊 Safari 底部的「分享」按鈕 ➔ 選擇「加入主畫面」' : '📱 iOS: Tap Share in Safari ➔ Add to Home Screen';
            } else if (isMacSafari) {
                message = isZh ? '🖥️ macOS Safari：請至上方選單「檔案」➔「加入 Dock」或使用 Chrome 瀏覽器' : '🖥️ macOS Safari: Go to File ➔ Add to Dock, or use Chrome';
            } else {
                message = isZh ? '💡 請點擊瀏覽器網址列右側的「⊕ 安裝」圖示，或在選單中選擇「安裝應用程式」' : '💡 Click the install icon in address bar or select "Install" in browser menu';
            }

            window.showToast(message);
        };

        // --- PWA File Handling & Local File Opener ---
        window.__openLocalFileContent = async function({ name, text }) {
            if (APP_STATE.editorFormat === 'canvas') {
                await createMarkdownNoteFromImport(text)
                return
            }
            if ($textarea) {
                $textarea.value = text;
                if (APP_STATE.isBlock && typeof window.__setBlockEditorMarkdown === 'function') {
                    window.__setBlockEditorMarkdown(text);
                }
                if (!APP_STATE.isBlock && $previewMd) {
                    triggerRender($previewMd, text);
                }
                if (window.offlineStore) {
                    const title = name.replace(/\.md$/i, '');
                    window.offlineStore.saveNote(APP_STATE.path || ('local/' + name), {
                        title,
                        content: text,
                        theme: APP_STATE.theme,
                        syncStatus: 'draft'
                    });
                }
                window.showToast?.((APP_STATE.lang === 'zh-TW' ? '📂 已開啟本地檔案：' : '📂 Opened local file: ') + name);
            }
        };
        if (window.__pendingLaunchFile) {
            const pending = window.__pendingLaunchFile;
            window.__pendingLaunchFile = null;
            window.__openLocalFileContent(pending);
        }

        // --- Global Shortcuts: Cmd/Ctrl + S (Save/Export), Cmd/Ctrl + O (Open Local) ---
        document.addEventListener('keydown', async function(e) {
            const isMac = (navigator.platform || '').toUpperCase().indexOf('MAC') >= 0;
            const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
            if (!cmdOrCtrl) return;

            const key = e.key ? e.key.toLowerCase() : '';
            if (key === 's') {
                e.preventDefault();
                if (APP_STATE.isEdit && $textarea) {
                    const content = $textarea.value;
                    const title = String(content || '').split(new RegExp('[\\\\r\\\\n]+'))[0]?.replace(new RegExp('^#*\\\\s*'), '').trim() || APP_STATE.path;
                    if (window.offlineStore) {
                        window.offlineStore.saveNote(APP_STATE.path, {
                            title,
                            content,
                            theme: APP_STATE.theme,
                            format: APP_STATE.editorFormat,
                            syncStatus: APP_STATE.isPublished ? 'synced' : 'draft'
                        });
                    }
                    if (APP_STATE.isPublished) {
                        saveCurrentNote({ showBlocked: false });
                    } else {
                        window.showToast?.(APP_STATE.lang === 'zh-TW' ? '💾 已儲存至本地快取 (IndexedDB)' : '💾 Saved to local cache (IndexedDB)');
                    }
                } else {
                    const $exportMd = document.getElementById('export-md-btn') || document.getElementById('share-export-md');
                    if ($exportMd) {
                        $exportMd.click();
                    } else if (window.exportMarkdownFile) {
                        const title = document.title || 'note';
                        const content = document.getElementById('contents')?.value || document.getElementById('bot-accessible-content')?.textContent || '';
                        window.exportMarkdownFile(title + '.md', content);
                        window.showToast?.(APP_STATE.lang === 'zh-TW' ? '📄 已匯出 Markdown 檔案' : '📄 Exported Markdown file');
                    }
                }
            } else if (key === 'o' && APP_STATE.isEdit && APP_STATE.editorFormat === 'markdown') {
                e.preventDefault();
                if (window.openLocalMarkdownFile) {
                    const file = await window.openLocalMarkdownFile();
                    if (file) window.__openLocalFileContent(file);
                }
            }
        });

        // --- Online & Offline Network State Listeners ---
        window.addEventListener('online', () => {
            window.showToast?.(APP_STATE.lang === 'zh-TW' ? '🟢 網路已恢復連線' : '🟢 Network reconnected');
            if (APP_STATE.isEdit && APP_STATE.isPublished && typeof hasUnsavedChanges === 'function' && hasUnsavedChanges()) {
                saveCurrentNote({ showBlocked: false });
            }
        });
        window.addEventListener('offline', () => {
            window.showToast?.(APP_STATE.lang === 'zh-TW' ? '⚡ 已切換為離線模式，修改將自動保存在本機' : '⚡ Offline mode: Changes are saved locally');
        });
    })
</script>
    ${ext.enableR2 ? '<script>window.ENABLE_R2=true</script>' : ''}
    ${showPwPrompt ? '<script>passwdPrompt()</script>' : ''}
    <script type="module" src="/js/offline-store.mjs"></script>
    ${isEdit && !isBlockDocument && !isCanvasDocument && !isWhiteboardDocument ? '<script type="module" src="/js/markdown-toolbar.mjs"></script>' : ''}
    ${isEdit && !isWhiteboardDocument ? '<script type="module" src="/js/ocr-client.mjs"></script>' : ''}
    ${isEdit && isBlockDocument ? '<script type="module" src="/js/block-editor.bundle.mjs"></script>' : ''}
    ${isBlockDocument && !isEdit ? '<script type="module" src="/js/block-view.mjs"></script>' : ''}
    ${isCanvasDocument ? '<script type="module" src="/js/canvas-editor.bundle.mjs?v=3.9"></script>' : ''}
    ${isWhiteboardDocument ? '<script type="module" src="/js/whiteboard-editor.bundle.mjs?v=1.2"></script>' : ''}
    <script type="module" src="/js/pwa-install.mjs"></script>
    <script type="module" src="/js/reading-progress.mjs"></script>
    <script type="module" src="/js/floating-controls.mjs"></script>
    ${isEmbed ? '' : '<script type="module" src="/js/editor-preference.mjs"></script>'}
    ${annotationsUiEnabled ? '<script type="module" src="/js/share-annotations.mjs"></script>' : ''}
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(error => {
                    console.warn('Service worker registration failed', error)
                })
            })
        }
    </script>

    <script>
        const THEMES = ${JSON.stringify(THEMES)};
        const DEFAULT_PREVIEW_WIDTH = ${JSON.stringify(DEFAULT_PREVIEW_WIDTH)};
        const PREVIEW_WIDTH_STORAGE_KEY = 'cf-notepad-preview-width';
        const PREVIEW_DEVICE_STORAGE_KEY = 'cf-notepad-preview-device';
        const PREVIEW_SPLIT_STORAGE_KEY = 'cf-notepad-split-direction';
        const SHARE_FONT_STORAGE_KEY = 'cf-notepad-share-font';
        const themeStyleNode = document.getElementById('theme-style');
        const themeSelector = document.getElementById('theme-selector');
        const previewWidthSelector = document.getElementById('preview-width-selector');
        const previewDeviceSelector = document.getElementById('preview-device-selector');
        const splitDirectionSelector = document.getElementById('split-direction-selector');
        const languageSelector = document.getElementById('language-selector');
        const previewWidthRoot = document.documentElement;
        const shareFontSelector = document.getElementById('share-font-selector');
        const shareViewBody = document.body;

        function applyPreviewWidth(value) {
            const width = value || DEFAULT_PREVIEW_WIDTH;
            previewWidthRoot.style.setProperty('--preview-max-width', width);
            const widthDropdown = document.getElementById('width-dropdown');
            if (widthDropdown) {
                widthDropdown.querySelectorAll('.width-item').forEach(el => {
                    const active = el.dataset.widthValue === width;
                    el.classList.toggle('is-active', active);
                    let check = el.querySelector('.width-item-check');
                    if (active && !check) {
                        const checkEl = document.createElement('span');
                        checkEl.className = 'width-item-check';
                        checkEl.setAttribute('aria-hidden', 'true');
                        checkEl.textContent = '✓';
                        el.appendChild(checkEl);
                    } else if (!active && check) {
                        check.remove();
                    }
                });
            }
        }

        function syncThemeSelectorTitle() {
            if (!themeSelector) return;
            const theme = themeSelector.value || themeSelector.getAttribute('value') || 'claude-canvas';
            const option = Array.from(themeSelector.querySelectorAll('wa-option'))
                .find(item => item.value === theme);
            themeSelector.title = option?.textContent?.trim() || theme;
        }

        function setSegmentedActive(selector, dataAttribute, activeValue) {
            if (!selector) return;
            selector.querySelectorAll('button').forEach(button => {
                const active = button.getAttribute(dataAttribute) === activeValue;
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        }

        function getRailSwitch(selector) {
            if (!selector) return null;
            return selector.matches('.footer-rail-switch') ? selector : selector.querySelector('.footer-rail-switch');
        }

        function setRailSwitchState(selector, checked) {
            const switcher = getRailSwitch(selector);
            if (!switcher) return;
            switcher.classList.toggle('is-checked', checked === true);
            switcher.setAttribute('aria-pressed', checked === true ? 'true' : 'false');
            try { switcher.checked = checked === true; } catch(e) {}
        }

        function applyPreviewDevice(value) {
            const device = value === 'mobile' ? 'mobile' : 'desktop';
            if (typeof window.resetEditorSplitPane === 'function') {
                window.resetEditorSplitPane();
            }
            document.body.classList.toggle('preview-device-mobile', device === 'mobile');
            document.body.classList.toggle('preview-device-desktop', device === 'desktop');
            setRailSwitchState(previewDeviceSelector, device === 'desktop');
            if (previewWidthSelector) {
                previewWidthSelector.disabled = device === 'mobile';
            }
        }

        function applySplitDirection(value) {
            const direction = value === 'vertical' ? 'vertical' : 'horizontal';
            if (typeof window.resetEditorSplitPane === 'function') {
                window.resetEditorSplitPane();
            }
            document.body.classList.toggle('preview-split-vertical', direction === 'vertical');
            document.body.classList.toggle('preview-split-horizontal', direction === 'horizontal');
            setRailSwitchState(splitDirectionSelector, direction === 'horizontal');
        }

        function applyShareFont(value) {
            const shareFont = value === 'maple' ? 'maple' : 'jetbrains';
            if (shareViewBody.classList.contains('share-view')) {
                shareViewBody.classList.toggle('share-font-jetbrains', shareFont === 'jetbrains');
                shareViewBody.classList.toggle('share-font-maple', shareFont === 'maple');
            }
            setRailSwitchState(shareFontSelector, shareFont === 'jetbrains');
        }

        const savedPreviewWidth = canPersistSettings ? window.localStorage.getItem(PREVIEW_WIDTH_STORAGE_KEY) : '';
        const initialPreviewWidth = APP_STATE.noteSettings.width || savedPreviewWidth || DEFAULT_PREVIEW_WIDTH;
        APP_STATE.noteSettings.width = initialPreviewWidth;
        applyPreviewWidth(initialPreviewWidth);

        if (previewDeviceSelector) {
            const savedPreviewDevice = window.localStorage.getItem(PREVIEW_DEVICE_STORAGE_KEY);
            const initialPreviewDevice = APP_STATE.noteSettings.previewDevice || savedPreviewDevice || 'desktop';
            applyPreviewDevice(initialPreviewDevice);
            const previewDeviceSwitch = getRailSwitch(previewDeviceSelector)
            if (previewDeviceSwitch) previewDeviceSwitch.addEventListener('click', function() {
                const current = this.getAttribute('aria-pressed') === 'true' ? 'desktop' : 'mobile';
                const device = current === 'desktop' ? 'mobile' : 'desktop';
                applyPreviewDevice(device);
                try { window.localStorage.setItem(PREVIEW_DEVICE_STORAGE_KEY, device); } catch(e) {}
            });
        }

        if (splitDirectionSelector) {
            const savedSplitDirection = window.localStorage.getItem(PREVIEW_SPLIT_STORAGE_KEY);
            const initialSplitDirection = savedSplitDirection === 'vertical' ? 'vertical' : 'horizontal';
            applySplitDirection(initialSplitDirection);
            const splitDirectionSwitch = getRailSwitch(splitDirectionSelector)
            if (splitDirectionSwitch) splitDirectionSwitch.addEventListener('click', function() {
                const current = this.getAttribute('aria-pressed') === 'true' ? 'horizontal' : 'vertical';
                const direction = current === 'horizontal' ? 'vertical' : 'horizontal';
                applySplitDirection(direction);
                try { window.localStorage.setItem(PREVIEW_SPLIT_STORAGE_KEY, direction); } catch(e) {}
            });
        }

        if (shareViewBody.classList.contains('share-view') || shareFontSelector) {
            const savedShareFont = canPersistSettings ? window.localStorage.getItem(SHARE_FONT_STORAGE_KEY) : '';
            const initialShareFont = APP_STATE.noteSettings.shareFont
                || (savedShareFont === 'maple' || savedShareFont === 'true'
                ? 'maple'
                : 'jetbrains');
            applyShareFont(initialShareFont);
        }

        // Width Selector Dropdown (Delegated on document to support floating portal menus)
        document.addEventListener('click', (e) => {
            const item = e.target.closest('.width-item');
            if (!item) return;
            const width = item.dataset.widthValue;
            if (!width) return;
            APP_STATE.noteSettings.width = width;
            applyPreviewWidth(width);
            if (canPersistSettings) {
                window.localStorage.setItem(PREVIEW_WIDTH_STORAGE_KEY, width);
                persistSetting({ width }).catch(err => errHandle(err?.message || err));
            }
            if (typeof window.showToast === 'function') {
                const widthLabel = item.querySelector('.width-item-name')?.textContent || width;
                const isZh = APP_STATE.lang === 'zh-TW';
                window.showToast(isZh ? ('已套用寬度：' + widthLabel) : ('Applied width: ' + widthLabel));
            }
        });

        if (languageSelector) {
            setRailSwitchState(languageSelector, APP_STATE.lang === 'zh-TW');
        }

        if (shareFontSelector) {
            const shareFontSwitch = getRailSwitch(shareFontSelector)
            if (shareFontSwitch) shareFontSwitch.addEventListener('click', function() {
                const current = this.getAttribute('aria-pressed') === 'true' ? 'jetbrains' : 'maple';
                const shareFont = current === 'jetbrains' ? 'maple' : 'jetbrains';
                applyShareFont(shareFont);
                if (canPersistSettings) {
                    window.localStorage.setItem(SHARE_FONT_STORAGE_KEY, shareFont);
                    persistSetting({ shareFont }).catch(err => errHandle(err.message || err));
                }
            });
        }

        function initExportAndThemeControls() {
            const isZh = APP_STATE.lang === 'zh-TW';

            // 1. Theme Dropdown Logic (Delegated on document to support floating portal menus)
            document.addEventListener('click', (e) => {
                const item = e.target.closest('.theme-item');
                if (!item) return;
                const theme = item.dataset.themeName;
                if (!theme || !THEMES[theme]) return;

                APP_STATE.theme = theme;
                if (themeStyleNode) themeStyleNode.textContent = THEMES[theme];

                document.querySelectorAll('.theme-item').forEach(el => {
                    const active = el.dataset.themeName === theme;
                    el.classList.toggle('is-active', active);
                    let check = el.querySelector('.theme-item-check');
                    if (active && !check) {
                        const checkEl = document.createElement('span');
                        checkEl.className = 'theme-item-check';
                        checkEl.setAttribute('aria-hidden', 'true');
                        checkEl.textContent = '✓';
                        el.appendChild(checkEl);
                    } else if (!active && check) {
                        check.remove();
                    }
                });

                if (canPersistSettings) persistSetting({ theme }).catch(err => console.warn('Theme persist failed:', err?.message || err));
                if (typeof window.showToast === 'function') {
                    const themeLabel = item.querySelector('.theme-item-name')?.textContent || theme;
                    window.showToast(isZh ? ('已套用樣式：' + themeLabel) : ('Applied theme: ' + themeLabel));
                }
            });

            // 2. Export Helper & Filename
            const triggerDownload = (blobOrDataUrl, filename) => {
                const link = document.createElement('a');
                let url = '';
                let isObjectUrl = false;
                if (typeof blobOrDataUrl === 'string') {
                    url = blobOrDataUrl;
                } else if (blobOrDataUrl instanceof Blob) {
                    url = URL.createObjectURL(blobOrDataUrl);
                    isObjectUrl = true;
                }
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    link.remove();
                    if (isObjectUrl) URL.revokeObjectURL(url);
                }, 1000);
            };

            const getExportFilename = (ext = 'md') => {
                let title = '';
                if (APP_STATE.editorFormat === 'block' && typeof window.blockEditor?.getText === 'function') {
                    const text = window.blockEditor.getText() || '';
                    title = text.split(/[\\r\\n]+/)[0]?.trim() || '';
                } else if (typeof $textarea !== 'undefined' && $textarea) {
                    title = $textarea.value.split(/[\\r\\n]+/)[0]?.trim() || '';
                } else {
                    const heading = document.querySelector('#preview-md h1, #preview-plain h1, .markdown-body h1');
                    if (heading) title = heading.textContent.trim();
                }
                title = title.replace(/^#+\\s*/, '').trim();
                const source = title || APP_STATE.title || APP_STATE.path || 'note';
                const sanitized = String(source)
                    .trim()
                    .replace(/[\\\\/:*?"<>|]+/g, '-')
                    .replace(/\\s+/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '')
                    .slice(0, 60);
                return (sanitized || 'note') + '.' + ext;
            };

            // 3. Export Markdown Content Helper
            const getExportMarkdown = () => {
                if (typeof window.getCurrentMarkdownForExport === 'function') {
                    return window.getCurrentMarkdownForExport();
                }
                if (typeof $textarea !== 'undefined' && $textarea) {
                    return $textarea.value || '';
                }
                const rawEl = document.querySelector('#raw-markdown-content, #source-content, pre#contents');
                if (rawEl) return rawEl.textContent || '';
                return document.querySelector('.markdown-body, #preview-md')?.innerText || '';
            };

            const getExportHtmlContent = () => {
                if (APP_STATE.editorFormat === 'block') {
                    const blockEditorEl = document.querySelector('.bn-editor, .tiptap, .ProseMirror');
                    if (blockEditorEl) return blockEditorEl.innerHTML;
                }
                const previewEl = document.querySelector('#preview-md, #preview-plain, .markdown-body');
                return previewEl ? previewEl.innerHTML : '';
            };

            // 4. Export Markdown (.md)
            const exportMdBtn = document.getElementById('export-md-btn');
            if (exportMdBtn) {
                exportMdBtn.addEventListener('click', () => {
                    const content = getExportMarkdown();
                    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
                    triggerDownload(blob, getExportFilename('md'));
                    if (typeof window.showToast === 'function') {
                        window.showToast(isZh ? '已下載 Markdown 檔案' : 'Markdown file downloaded');
                    }
                });
            }

            // 5. Export HTML (.html)
            const exportHtmlBtn = document.getElementById('export-html-btn');
            if (exportHtmlBtn) {
                exportHtmlBtn.addEventListener('click', () => {
                    const currentThemeName = APP_STATE.theme || 'claude-canvas';
                    const themeCss = (typeof THEMES !== 'undefined' && THEMES[currentThemeName]) ? THEMES[currentThemeName] : '';
                    const bodyHtml = getExportHtmlContent();
                    const filename = getExportFilename('html');
                    const title = filename.replace(/\\.html$/, '');

                    const standaloneHtml = '<!DOCTYPE html>\\n' +
'<html lang="' + (APP_STATE.lang || 'zh-TW') + '">\\n' +
'<head>\\n' +
'<meta charset="UTF-8">\\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\\n' +
'<title>' + title + '</title>\\n' +
'<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">\\n' +
'<style>\\n' +
'* { box-sizing: border-box; }\\n' +
'body {\\n' +
'    margin: 0;\\n' +
'    padding: 40px 20px;\\n' +
'    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;\\n' +
'    background: #fdfdfd;\\n' +
'    color: #1f2328;\\n' +
'    display: flex;\\n' +
'    justify-content: center;\\n' +
'    min-height: 100vh;\\n' +
'}\\n' +
'.export-container {\\n' +
'    width: 100%;\\n' +
'    max-width: 860px;\\n' +
'    margin: 0 auto;\\n' +
'}\\n' +
'.markdown-body {\\n' +
'    line-height: 1.65;\\n' +
'    word-wrap: break-word;\\n' +
'}\\n' +
themeCss + '\\n' +
'</style>\\n' +
'</head>\\n' +
'<body>\\n' +
'<div class="export-container">\\n' +
'    <article class="markdown-body">\\n' +
'        ' + bodyHtml + '\\n' +
'    </article>\\n' +
'</div>\\n' +
'</body>\\n' +
'</html>';

                    const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8' });
                    triggerDownload(blob, filename);
                    if (typeof window.showToast === 'function') {
                        window.showToast(isZh ? '已下載獨立 HTML 網頁' : 'HTML webpage downloaded');
                    }
                });
            }

            // 6. Direct Vector PDF Export & Browser Print Preview
            const exportPdfBtn = document.getElementById('export-pdf-btn');
            const printPreviewBtn = document.getElementById('print-preview-btn');

            const handleDirectPdfDownload = async () => {
                if (typeof window.showToast === 'function') {
                    window.showToast(isZh ? '🚀 正在產生 PDF 檔案...' : '🚀 Generating PDF file...');
                }
                try {
                    const mdContent = getExportMarkdown();
                    const exportHtml = getExportHtmlContent();
                    const filename = getExportFilename('pdf');
                    const title = filename.replace(/\\.pdf$/, '') || 'Document';

                    const resp = await fetch('/api/pdf/export', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            markdown: mdContent,
                            html: exportHtml,
                            title: title,
                            theme: (window.APP_STATE && window.APP_STATE.theme) || 'claude-canvas'
                        })
                    });

                    if (!resp.ok) {
                        const errJson = await resp.json().catch(() => ({}));
                        throw new Error(errJson.msg || ('HTTP ' + resp.status));
                    }

                    const pdfBlob = await resp.blob();
                    triggerDownload(pdfBlob, filename);
                    if (typeof window.showToast === 'function') {
                        window.showToast(isZh ? '✅ PDF 已成功下載！' : '✅ PDF downloaded successfully!');
                    }
                } catch (err) {
                    console.error('Direct PDF export failed, opening print dialog fallback:', err);
                    if (typeof window.showToast === 'function') {
                        window.showToast(isZh ? '⚠️ 雲端轉換未完成，切換至列印預覽...' : '⚠️ Online conversion unavailable, opening print dialog...');
                    }
                    handlePrint();
                }
            };

            const handlePrint = () => {
                const printContent = document.createElement('div');
                printContent.className = 'print-export-content markdown-body';
                printContent.setAttribute('aria-hidden', 'true');
                printContent.innerHTML = getExportHtmlContent();
                printContent.style.display = 'none';
                document.body.appendChild(printContent);
                document.body.classList.add('print-export-active');

                const cleanup = () => {
                    printContent.remove();
                    document.body.classList.remove('print-export-active');
                    window.removeEventListener('afterprint', cleanup);
                };
                window.addEventListener('afterprint', cleanup, { once: true });
                window.print();
            };

            if (exportPdfBtn) exportPdfBtn.addEventListener('click', handleDirectPdfDownload);
            if (printPreviewBtn) printPreviewBtn.addEventListener('click', handlePrint);

            const toolbarPrintBtn = document.getElementById('toolbar-print-btn');
            if (toolbarPrintBtn) toolbarPrintBtn.addEventListener('click', handlePrint);

            const moreMenuPrintBtn = document.getElementById('more-menu-print-btn');
            if (moreMenuPrintBtn) moreMenuPrintBtn.addEventListener('click', handlePrint);

            const moreMenuStatsBtn = document.getElementById('more-menu-stats-btn');
            if (moreMenuStatsBtn) {
                moreMenuStatsBtn.addEventListener('click', () => {
                    const text = (window.editorInstance && typeof window.editorInstance.value === 'function')
                        ? window.editorInstance.value()
                        : (document.getElementById('content')?.value || document.querySelector('.markdown-body')?.innerText || '');
                    const chars = text.length;
                    const words = (text.match(/[\\w\\d]+/g) || []).length + (text.match(/[\\u4e00-\\u9fa5]/g) || []).length;
                    const paras = text.split(/\\n\\s*\\n/).filter(p => p.trim()).length || (text.trim() ? 1 : 0);
                    const readMin = Math.max(1, Math.ceil(words / 300));
                    const msg = isZh
                        ? '📊 筆記統計：共 ' + chars + ' 字元 · ' + words + ' 字詞 · ' + paras + ' 段落 · 約需 ' + readMin + ' 分鐘閱讀'
                        : '📊 Statistics: ' + chars + ' chars · ' + words + ' words · ' + paras + ' paragraphs · ~' + readMin + ' min read';
                    if (typeof window.showToast === 'function') {
                        window.showToast(msg, 4500);
                    } else {
                        alert(msg);
                    }
                });
            }

            const moreMenuThemeBtn = document.getElementById('more-menu-theme-btn');
            if (moreMenuThemeBtn) {
                moreMenuThemeBtn.addEventListener('click', () => {
                    const themeBtn = document.getElementById('theme-menu-btn');
                    if (themeBtn) {
                        themeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                        setTimeout(() => themeBtn.click(), 100);
                    } else if (typeof window.showToast === 'function') {
                        window.showToast(isZh ? '可在閱讀模式或開啟預覽時調整排版主題' : 'Theme style is available in reader or preview mode');
                    }
                });
            }

            const moreMenuFontBtn = document.getElementById('more-menu-font-btn');
            if (moreMenuFontBtn) {
                moreMenuFontBtn.addEventListener('click', () => {
                    const fontBtn = document.getElementById('share-font-selector')?.querySelector('.footer-rail-switch') || document.querySelector('.share-font-switch');
                    if (fontBtn) {
                        fontBtn.click();
                    }
                });
            }

            const moreMenuUiThemeBtn = document.getElementById('more-menu-ui-theme-btn');
            if (moreMenuUiThemeBtn) {
                moreMenuUiThemeBtn.addEventListener('click', () => {
                    const uiBtn = document.getElementById('ui-theme-toggle-btn');
                    if (uiBtn) uiBtn.click();
                });
            }

            const moreEditorPrefBtn = document.getElementById('more-editor-preference-btn');
            if (moreEditorPrefBtn) {
                moreEditorPrefBtn.addEventListener('click', () => {
                    const prefBtn = document.getElementById('editor-preference-btn');
                    if (prefBtn) {
                        prefBtn.click();
                    } else {
                        const dialog = document.querySelector('[data-editor-preference-dialog]');
                        if (dialog) dialog.hidden = false;
                    }
                });
            }

            // 7. Image Export & Copy Image (html2canvas with offscreen sandbox)
            const exportImageBtn = document.getElementById('export-image-btn');
            const copyImageBtn = document.getElementById('copy-image-btn');

            async function generateImage({ copyToClipboard = false }) {
                try {
                    if (typeof window.showToast === 'function') {
                        window.showToast(isZh ? '正在產生 2x 高解析度長圖...' : 'Generating 2x high-res image...');
                    }

                    if (!window.html2canvas) {
                        await new Promise((resolve, reject) => {
                            const script = document.createElement('script');
                            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                            script.onload = resolve;
                            script.onerror = () => reject(new Error('Failed to load html2canvas library'));
                            document.head.appendChild(script);
                        });
                    }

                    const sourceEl = document.querySelector(APP_STATE.editorFormat === 'block'
                        ? '.david-blocknote-view, .bn-editor, .tiptap, .ProseMirror'
                        : '#preview-md, #preview-plain, .markdown-body');
                    if (!sourceEl) throw new Error('Content element not found');

                    const currentThemeName = APP_STATE.theme || (APP_STATE.editorFormat === 'block' ? 'ayu-light' : 'claude-canvas');
                    const themeCss = (typeof THEMES !== 'undefined' && THEMES[currentThemeName]) ? THEMES[currentThemeName] : '';

                    // Create an isolated sandbox element at document root with non-negative coordinates
                    const sandbox = document.createElement('div');
                    sandbox.className = 'export-image-sandbox';
                    sandbox.style.cssText = 'position: absolute; top: 0; left: 0; width: 840px; margin: 0; padding: 48px 40px; background: #ffffff; box-sizing: border-box; z-index: -9999; opacity: 0.001; pointer-events: none; overflow: visible;';

                    const styleEl = document.createElement('style');
                    styleEl.textContent = '.export-image-sandbox { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1f2328; background: #ffffff; } ' +
                        '.export-image-sandbox .markdown-body, .export-image-sandbox .david-blocknote-view, .export-image-sandbox .bn-editor, .export-image-sandbox .tiptap, .export-image-sandbox .ProseMirror { width: 100% !important; max-width: 100% !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: transparent !important; color: #1f2328 !important; } ' +
                        themeCss;
                    sandbox.appendChild(styleEl);

                    const cloneEl = sourceEl.cloneNode(true);
                    cloneEl.id = 'export-image-render-target';
                    cloneEl.style.overflow = 'visible';
                    cloneEl.style.maxHeight = 'none';
                    cloneEl.style.height = 'auto';
                    sandbox.appendChild(cloneEl);

                    document.body.appendChild(sandbox);

                    if (document.fonts && document.fonts.ready) {
                        await document.fonts.ready;
                    }

                    const canvas = await window.html2canvas(sandbox, {
                        scale: 2,
                        useCORS: true,
                        allowTaint: false,
                        logging: false,
                        backgroundColor: '#ffffff',
                        scrollX: 0,
                        scrollY: 0,
                    });

                    sandbox.remove();

                    if (copyToClipboard) {
                        if (canvas.toBlob && navigator.clipboard?.write && window.ClipboardItem) {
                            canvas.toBlob(async (blob) => {
                                if (blob) {
                                    try {
                                        await navigator.clipboard.write([
                                            new ClipboardItem({ 'image/png': blob })
                                        ]);
                                        if (typeof window.showToast === 'function') {
                                            window.showToast(isZh ? '長圖已成功複製至剪貼簿！' : 'Image copied to clipboard!');
                                        }
                                        return;
                                    } catch (e) {
                                        console.warn('Clipboard write failed, fallback to download:', e);
                                    }
                                }
                                const dataUrl = canvas.toDataURL('image/png');
                                triggerDownload(dataUrl, getExportFilename('png'));
                                if (typeof window.showToast === 'function') {
                                    window.showToast(isZh ? '剪貼簿不支援直接寫入，已自動下載長圖' : 'Clipboard not supported, image downloaded');
                                }
                            }, 'image/png');
                        } else {
                            const dataUrl = canvas.toDataURL('image/png');
                            triggerDownload(dataUrl, getExportFilename('png'));
                        }
                    } else {
                        const dataUrl = canvas.toDataURL('image/png');
                        triggerDownload(dataUrl, getExportFilename('png'));
                        if (typeof window.showToast === 'function') {
                            window.showToast(isZh ? '長圖已成功下載！' : 'Image downloaded successfully!');
                        }
                    }
                } catch (err) {
                    console.error('Image export failed:', err);
                    if (typeof window.showToast === 'function') {
                        window.showToast(isZh ? ('圖片產生失敗：' + (err.message || err)) : ('Failed to generate image: ' + (err.message || err)));
                    }
                }
            }

            if (exportImageBtn) {
                exportImageBtn.addEventListener('click', () => generateImage({ copyToClipboard: false }));
            }
            if (copyImageBtn) {
                copyImageBtn.addEventListener('click', () => generateImage({ copyToClipboard: true }));
            }

            // 8. Copy Entire Document to Targets
            const copyAllRichtextBtn = document.getElementById('copy-all-richtext-btn');
            if (copyAllRichtextBtn) {
                copyAllRichtextBtn.addEventListener('click', async () => {
                    const bodyHtml = getExportHtmlContent();
                    const currentThemeName = APP_STATE.theme || 'claude-canvas';
                    const themeCss = (typeof THEMES !== 'undefined' && THEMES[currentThemeName]) ? THEMES[currentThemeName] : '';
                    const styledHtml = '<div class="markdown-body" style="line-height:1.65;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">' +
                        '<style>' + themeCss + '</style>' + bodyHtml + '</div>';
                    const plainText = getExportMarkdown();
                    try {
                        if (window.ClipboardItem && navigator.clipboard?.write) {
                            const htmlBlob = new Blob([styledHtml], { type: 'text/html' });
                            const textBlob = new Blob([plainText], { type: 'text/plain' });
                            await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
                        } else if (navigator.clipboard?.writeText) {
                            await navigator.clipboard.writeText(plainText);
                        }
                        if (typeof window.showToast === 'function') {
                            window.showToast(isZh ? '已複製一般富文字 (含排版樣式)' : 'Rich text copied to clipboard');
                        }
                    } catch (e) {
                        console.error('Failed to copy rich text:', e);
                    }
                });
            }

            const copyAllMdBtn = document.getElementById('copy-all-md-btn');
            if (copyAllMdBtn) {
                copyAllMdBtn.addEventListener('click', async () => {
                    const md = getExportMarkdown();
                    try {
                        await navigator.clipboard.writeText(md);
                        if (typeof window.showToast === 'function') {
                            window.showToast(isZh ? '已複製純 Markdown' : 'Plain Markdown copied');
                        }
                    } catch (e) {
                        console.error('Failed to copy markdown:', e);
                    }
                });
            }

            const copyAllNotionBtn = document.getElementById('copy-all-notion-btn');
            if (copyAllNotionBtn) {
                copyAllNotionBtn.addEventListener('click', async () => {
                    const md = getExportMarkdown();
                    const notionMd = md.replace(/\\$([^\\$\\r\\n]+)\\$/g, '$$$$' + '$1' + '$$$$');
                    const bodyHtml = getExportHtmlContent();
                    try {
                        if (window.ClipboardItem && navigator.clipboard?.write) {
                            const htmlBlob = new Blob(['<div class="markdown-body">' + bodyHtml + '</div>'], { type: 'text/html' });
                            const textBlob = new Blob([notionMd], { type: 'text/plain' });
                            await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
                        } else if (navigator.clipboard?.writeText) {
                            await navigator.clipboard.writeText(notionMd);
                        }
                        if (typeof window.showToast === 'function') {
                            window.showToast(isZh ? '已複製 Notion 相容格式' : 'Notion format copied');
                        }
                    } catch (e) {
                        console.error('Failed to copy Notion format:', e);
                    }
                });
            }

            const copyAllJiraBtn = document.getElementById('copy-all-jira-btn');
            if (copyAllJiraBtn) {
                copyAllJiraBtn.addEventListener('click', async () => {
                    const md = getExportMarkdown();
                    let jira = md;
                    jira = jira.replace(/\`\`\`([^\\r\\n]*)[\\r\\n]+([\\s\\S]*?)\`\`\`/g, (m, lang, code) => {
                        return (lang ? ('{code:' + lang.trim() + '}\\n') : '{code}\\n') + code.trim() + '\\n{code}';
                    });
                    jira = jira.replace(/\`([^\`]+)\`/g, '{{' + '$1' + '}}');
                    jira = jira.replace(/^######\\s+(.*)$/gm, 'h6. ' + '$1');
                    jira = jira.replace(/^#####\\s+(.*)$/gm, 'h5. ' + '$1');
                    jira = jira.replace(/^####\\s+(.*)$/gm, 'h4. ' + '$1');
                    jira = jira.replace(/^###\\s+(.*)$/gm, 'h3. ' + '$1');
                    jira = jira.replace(/^##\\s+(.*)$/gm, 'h2. ' + '$1');
                    jira = jira.replace(/^#\\s+(.*)$/gm, 'h1. ' + '$1');
                    jira = jira.replace(/^>\\s+(.*)$/gm, '{quote}' + '$1' + '{quote}');
                    jira = jira.replace(/\\*\\*([\\s\\S]*?)\\*\\*/g, '*' + '$1' + '*');
                    jira = jira.replace(/__([\\s\\S]*?)__/g, '*' + '$1' + '*');
                    jira = jira.replace(/~~(.*?)~~/g, '-' + '$1' + '-');
                    jira = jira.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '[' + '$1' + '|' + '$2' + ']');
                    jira = jira.replace(/^(\\*{3,}|-{3,}|_{3,})$/gm, '----');
                    try {
                        await navigator.clipboard.writeText(jira);
                        if (typeof window.showToast === 'function') {
                            window.showToast(isZh ? '已複製 Jira / Confluence 標記格式' : 'Jira / Confluence markup copied');
                        }
                    } catch (e) {
                        console.error('Failed to copy Jira markup:', e);
                    }
                });
            }

            const copyAllFeishuBtn = document.getElementById('copy-all-feishu-btn');
            if (copyAllFeishuBtn) {
                copyAllFeishuBtn.addEventListener('click', async () => {
                    const bodyHtml = getExportHtmlContent();
                    const plainText = getExportMarkdown();
                    const feishuHtml = '<div style="font-size:16px;line-height:1.75;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">' + bodyHtml + '</div>';
                    try {
                        if (window.ClipboardItem && navigator.clipboard?.write) {
                            const htmlBlob = new Blob([feishuHtml], { type: 'text/html' });
                            const textBlob = new Blob([plainText], { type: 'text/plain' });
                            await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
                        } else if (navigator.clipboard?.writeText) {
                            await navigator.clipboard.writeText(plainText);
                        }
                        if (typeof window.showToast === 'function') {
                            window.showToast(isZh ? '已複製飛書 / Lark 相容格式' : 'Feishu / Lark format copied');
                        }
                    } catch (e) {
                        console.error('Failed to copy Feishu format:', e);
                    }
                });
            }

            // Cite (Academic / Technical Citations)
            const citeModal = document.getElementById('cite-modal');
            const citeModalMask = document.getElementById('cite-modal-mask');
            const citeModalCloseBtn = document.getElementById('cite-modal-close-btn');
            const citeModalCancelBtn = document.getElementById('cite-modal-cancel-btn');
            const citeModalCopyBtn = document.getElementById('cite-modal-copy-btn');
            const citePreviewText = document.getElementById('cite-preview-text');
            const citeTabs = document.querySelectorAll('.cite-tab-btn');
            const citeNoteBtn = document.getElementById('cite-note-btn');
            const citeShareBtn = document.getElementById('cite-share-btn');

            let currentCitationMap = {};
            let currentCiteFormat = 'apa';

            function buildCitationsForCurrentDoc() {
                const heading1 = document.querySelector('#rendered-content h1, .markdown-body h1, #content h1, .bn-editor h1');
                const rawTitle = (heading1 ? heading1.textContent : '') || (document.title ? document.title.split(' - ')[0] : '') || 'Untitled Note';
                const title = rawTitle.replace(/^#+\\s*/, '').trim() || 'Untitled Note';
                const author = 'DAVID888';
                const siteName = 'David888 Wiki';
                const canonicalUrl = window.location.href.split('?')[0].split('#')[0];

                const now = new Date();
                const year = now.getFullYear();
                const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const monthShortEn = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
                const monthEn = monthNamesEn[now.getMonth()] || 'August';
                const monthShort = monthShortEn[now.getMonth()] || 'Aug.';
                const day = now.getDate();
                const isoDate = now.toISOString().slice(0, 10);

                const cleanUrl = canonicalUrl;
                const urlNoProto = cleanUrl.replace(/^https?:\\/\\//, '');
                const slugMatch = cleanUrl.match(/\\/share\\/([a-zA-Z0-9_-]+)/) || cleanUrl.match(/\\/([a-zA-Z0-9_-]+)$/);
                const bibKey = slugMatch ? ('david888wiki_' + slugMatch[1]) : 'david888wiki_note';

                return {
                    apa: author + '. (' + year + ', ' + monthEn + ' ' + day + '). ' + title + '. ' + siteName + '. ' + cleanUrl,
                    ieee: '[1] ' + author + ', "' + title + '," ' + siteName + ', ' + monthShort + ' ' + day + ', ' + year + '. [Online]. Available: ' + cleanUrl + '. [Accessed: ' + monthShort + ' ' + day + ', ' + year + '].',
                    bibtex: [
                        '@misc{' + bibKey + ',',
                        '  author = {' + author + '},',
                        '  title = {' + title + '},',
                        '  howpublished = {\\\\url{' + cleanUrl + '}},',
                        '  year = {' + year + '},',
                        '  note = {Accessed: ' + isoDate + '}',
                        '}'
                    ].join('\\n'),
                    mla: author + '. "' + title + '." ' + siteName + ', ' + day + ' ' + monthShort.replace('.', '') + ' ' + year + ', ' + urlNoProto + '. Accessed ' + day + ' ' + monthShort.replace('.', '') + ' ' + year + '.',
                    markdown: '[' + title + ' - ' + siteName + '](' + cleanUrl + ')',
                    chicago: author + '. "' + title + '." ' + siteName + '. Last modified ' + monthEn + ' ' + day + ', ' + year + '. ' + cleanUrl + '.'
                };
            }

            function updateCitePreview(format) {
                currentCiteFormat = format || currentCiteFormat || 'apa';
                if (citePreviewText) {
                    citePreviewText.value = currentCitationMap[currentCiteFormat] || '';
                }
                citeTabs.forEach(tab => {
                    const isActive = tab.getAttribute('data-cite-format') === currentCiteFormat;
                    tab.classList.toggle('active', isActive);
                    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
                });
            }

            function openCiteModal(triggerBtn) {
                if (!citeModal) return;
                currentCitationMap = buildCitationsForCurrentDoc();
                updateCitePreview(currentCiteFormat);
                openModal(citeModal, { initialFocus: citePreviewText, trigger: triggerBtn || document.activeElement });
                if (citePreviewText) {
                    citePreviewText.focus();
                    citePreviewText.select();
                }
            }

            function closeCiteModal() {
                if (!citeModal) return;
                closeModal(citeModal);
            }

            document.addEventListener('click', (e) => {
                const trigger = e.target.closest('#cite-share-btn, #cite-edit-btn, #cite-note-btn, .cite-share-btn, .cite-edit-btn');
                if (trigger) {
                    e.preventDefault();
                    openCiteModal(trigger);
                }
            });
            if (citeModalMask) citeModalMask.addEventListener('click', closeCiteModal);
            if (citeModalCloseBtn) citeModalCloseBtn.addEventListener('click', closeCiteModal);
            if (citeModalCancelBtn) citeModalCancelBtn.addEventListener('click', closeCiteModal);

            citeTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const format = tab.getAttribute('data-cite-format');
                    updateCitePreview(format);
                });
            });

            if (citePreviewText) {
                citePreviewText.addEventListener('click', () => {
                    citePreviewText.select();
                });
            }

            if (citeModalCopyBtn && citePreviewText) {
                citeModalCopyBtn.addEventListener('click', async () => {
                    const text = citePreviewText.value;
                    if (!text) return;
                    try {
                        await navigator.clipboard.writeText(text);
                        if (typeof window.showToast === 'function') {
                            window.showToast(isZh ? (currentCiteFormat.toUpperCase() + ' 引用格式已複製！') : (currentCiteFormat.toUpperCase() + ' citation copied!'));
                        }
                        closeCiteModal();
                    } catch (e) {
                        citePreviewText.select();
                        document.execCommand('copy');
                        if (typeof window.showToast === 'function') {
                            window.showToast(isZh ? (currentCiteFormat.toUpperCase() + ' 引用格式已複製！') : (currentCiteFormat.toUpperCase() + ' citation copied!'));
                        }
                        closeCiteModal();
                    }
                });
            }
        }

        const UI_THEME_STORAGE_KEY = 'cf-notepad-ui-theme';
        function initUiTheme() {
            const $themeBtn = document.getElementById('ui-theme-toggle-btn');
            const root = document.documentElement;
            const mediaQuery = typeof window.matchMedia === 'function'
                ? window.matchMedia('(prefers-color-scheme: dark)')
                : { matches: false, addEventListener: () => {} };

            function getSavedTheme() {
                try { return localStorage.getItem(UI_THEME_STORAGE_KEY) || 'auto'; } catch(e) { return 'auto'; }
            }

            function applyTheme(theme) {
                if (theme === 'dark') {
                    root.setAttribute('data-ui-theme', 'dark');
                } else if (theme === 'light') {
                    root.setAttribute('data-ui-theme', 'light');
                } else {
                    root.setAttribute('data-ui-theme', 'auto');
                }
                updateIcon(theme);
                if (typeof window.updateEditorLineNumbers === 'function') {
                    window.updateEditorLineNumbers();
                }
            }

            function updateIcon(theme) {
                if (!$themeBtn) return;
                const isDark = theme === 'dark' || (theme === 'auto' && mediaQuery.matches);
                $themeBtn.classList.toggle('is-dark', isDark);
                root.classList.toggle('wa-theme-dark', isDark);
                const titleText = isDark
                    ? (APP_STATE.lang === 'zh-TW' ? '當前：深色介面 (點擊切換淺色)' : 'Current: Dark UI (Click for Light)')
                    : (APP_STATE.lang === 'zh-TW' ? '當前：淺色介面 (點擊切換深色)' : 'Current: Light UI (Click for Dark)');
                $themeBtn.title = titleText;
                $themeBtn.setAttribute('aria-label', titleText);
                const textSpan = $themeBtn.querySelector('.toolbar-button-label');
                if (textSpan) textSpan.textContent = APP_STATE.lang === 'zh-TW' ? '深淺' : 'Theme';
            }

            const currentTheme = getSavedTheme();
            applyTheme(currentTheme);

            if ($themeBtn) {
                $themeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const nowIsDark = root.getAttribute('data-ui-theme') === 'dark' ||
                        (root.getAttribute('data-ui-theme') === 'auto' && mediaQuery.matches);
                    const nextTheme = nowIsDark ? 'light' : 'dark';
                    try { localStorage.setItem(UI_THEME_STORAGE_KEY, nextTheme); } catch(e) {}
                    applyTheme(nextTheme);
                    if (typeof window.showToast === 'function') {
                        const msg = nextTheme === 'dark'
                            ? (APP_STATE.lang === 'zh-TW' ? '已切換為深色介面' : 'Switched to Dark UI')
                            : (APP_STATE.lang === 'zh-TW' ? '已切換為淺色介面' : 'Switched to Light UI');
                        window.showToast(msg);
                    }
                });
            }

            if (typeof mediaQuery.addEventListener === 'function') {
                mediaQuery.addEventListener('change', () => {
                    if (getSavedTheme() === 'auto') {
                        updateIcon('auto');
                    }
                });
            }
        }

        function initMathCopy() {
            const MATH_FORMAT_STORAGE_KEY = 'cf-notepad:math-copy-format';
            const getSavedMathFormat = () => {
                try {
                    return localStorage.getItem(MATH_FORMAT_STORAGE_KEY) || 'auto';
                } catch (e) {
                    return 'auto';
                }
            };

            const $mathFormatModal = document.querySelector('#math-format-modal');
            const $mathFormatMask = document.querySelector('#math-format-mask');
            const $mathFormatCloseBtn = document.querySelector('#math-format-close-btn');
            const $mathFormatCancelBtn = document.querySelector('#math-format-cancel-btn');
            const $mathFormatForm = document.querySelector('#math-format-form');
            const $mathFormatTriggers = document.querySelectorAll('.math-format-trigger, #math-format-btn');

            function syncModalOptions(format) {
                if (!$mathFormatForm) return;
                const radios = $mathFormatForm.querySelectorAll('input[name="math-copy-format"]');
                radios.forEach(radio => {
                    radio.checked = radio.value === format;
                    const optionLabel = radio.closest('.editor-preference-option');
                    if (optionLabel) optionLabel.classList.toggle('is-selected', radio.checked);
                });
            }

            function openMathFormatModal(e) {
                if (!$mathFormatModal) return;
                const currentFormat = getSavedMathFormat();
                syncModalOptions(currentFormat);
                const checkedRadio = $mathFormatForm?.querySelector('input[name="math-copy-format"]:checked');
                const trigger = (e && e.currentTarget) || document.activeElement;
                openModal($mathFormatModal, { initialFocus: checkedRadio, trigger });
            }

            function closeMathFormatModal() {
                if (!$mathFormatModal) return;
                closeModal($mathFormatModal);
            }

            $mathFormatTriggers.forEach(btn => btn.addEventListener('click', openMathFormatModal));
            if ($mathFormatMask) $mathFormatMask.addEventListener('click', closeMathFormatModal);
            if ($mathFormatCloseBtn) $mathFormatCloseBtn.addEventListener('click', closeMathFormatModal);
            if ($mathFormatCancelBtn) $mathFormatCancelBtn.addEventListener('click', closeMathFormatModal);

            if ($mathFormatForm) {
                const radios = $mathFormatForm.querySelectorAll('input[name="math-copy-format"]');
                radios.forEach(radio => {
                    radio.addEventListener('change', () => {
                        radios.forEach(r => {
                            r.closest('.editor-preference-option')?.classList.toggle('is-selected', r.checked);
                        });
                    });
                });

                $mathFormatForm.addEventListener('submit', e => {
                    e.preventDefault();
                    const selected = $mathFormatForm.querySelector('input[name="math-copy-format"]:checked')?.value || 'auto';
                    try {
                        localStorage.setItem(MATH_FORMAT_STORAGE_KEY, selected);
                    } catch (err) {}
                    closeMathFormatModal();
                    if (typeof window.showToast === 'function') {
                        const msg = APP_STATE.lang === 'zh-TW' ? '已更新公式複製格式' : 'Formula copy format updated';
                        window.showToast(msg);
                    }
                });
            }

            async function copyMath(tex, mathMl, isDisplay, katexElem) {
                const format = getSavedMathFormat();
                const zh = APP_STATE.lang === 'zh-TW';
                let textToCopy = '';
                let label = '';
                let isHtml = false;

                if (format === 'auto') {
                    textToCopy = isDisplay ? ('$$' + tex + '$$') : ('$' + tex + '$');
                    label = zh ? '自動判斷' : 'Auto';
                } else if (format === 'latex') {
                    textToCopy = isDisplay ? ('$$' + tex + '$$') : ('$' + tex + '$');
                    label = 'LaTeX';
                } else if (format === 'latex-plain') {
                    textToCopy = tex;
                    label = zh ? 'LaTeX 純文字' : 'LaTeX Plain';
                } else if (format === 'mathml') {
                    textToCopy = mathMl || ('<math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><annotation encoding="application/x-tex">' + tex + '</annotation></semantics></math>');
                    label = zh ? 'MathML (Word)' : 'MathML (Word)';
                    isHtml = true;
                } else if (format === 'png') {
                    if (katexElem) {
                        try {
                            if (!window.html2canvas) {
                                await new Promise((resolve, reject) => {
                                    const script = document.createElement('script');
                                    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                                    script.onload = resolve;
                                    script.onerror = () => reject(new Error('Failed to load html2canvas'));
                                    document.head.appendChild(script);
                                });
                            }
                            const canvas = await window.html2canvas(katexElem, {
                                scale: 2,
                                backgroundColor: null,
                                logging: false,
                                useCORS: true,
                            });
                            if (canvas.toBlob && navigator.clipboard?.write && window.ClipboardItem) {
                                canvas.toBlob(async (blob) => {
                                    if (blob) {
                                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                                        if (typeof window.showToast === 'function') {
                                            window.showToast(zh ? '已複製公式 PNG 圖片' : 'Formula PNG copied');
                                        }
                                    }
                                }, 'image/png');
                                return;
                            }
                        } catch (pngErr) {
                            console.error('PNG formula export failed:', pngErr);
                        }
                    }
                    textToCopy = isDisplay ? ('$$' + tex + '$$') : ('$' + tex + '$');
                    label = 'LaTeX (PNG fallback)';
                } else if (format === 'svg') {
                    const svgNode = katexElem?.querySelector('svg');
                    if (svgNode) {
                        textToCopy = svgNode.outerHTML;
                    } else {
                        textToCopy = '<svg xmlns="http://www.w3.org/2000/svg"><text y="20">' + tex + '</text></svg>';
                    }
                    label = zh ? 'SVG 向量' : 'SVG Vector';
                } else {
                    textToCopy = '$$' + tex + '$$';
                    label = zh ? 'Notion (雙 $)' : 'Notion ($$)';
                }

                try {
                    if (isHtml && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
                        const htmlBlob = new Blob([textToCopy], { type: 'text/html' });
                        const textBlob = new Blob([textToCopy], { type: 'text/plain' });
                        await navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })]);
                    } else if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(textToCopy);
                    } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = textToCopy;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                    }
                    if (typeof window.showToast === 'function') {
                        window.showToast(zh ? ('已複製公式 (' + label + ')') : ('Formula copied (' + label + ')'));
                    }
                } catch (err) {
                    console.error('Failed to copy math formula:', err);
                    if (typeof window.showToast === 'function') {
                        window.showToast(zh ? '複製公式失敗' : 'Failed to copy formula');
                    }
                }
            }

            document.addEventListener('click', event => {
                const selection = window.getSelection();
                if (selection && !selection.isCollapsed && selection.toString().trim()) return;

                if (event.target.closest('.modal, .markdown-editor-toolbar, .footer, button, a, input, textarea, select')) return;

                const katexElem = event.target.closest('.katex');
                if (!katexElem) return;

                const isDisplay = !!katexElem.closest('.katex-display') || katexElem.classList.contains('katex-display');
                const annotation = katexElem.querySelector('annotation[encoding="application/x-tex"]');
                const tex = annotation ? annotation.textContent.trim() : katexElem.textContent.trim();
                const mathMlElem = katexElem.querySelector('.katex-mathml math');
                const mathMl = mathMlElem ? mathMlElem.outerHTML : '';

                if (!tex) return;

                event.preventDefault();
                event.stopPropagation();

                copyMath(tex, mathMl, isDisplay, katexElem);

                katexElem.classList.add('katex-copied');
                setTimeout(() => katexElem.classList.remove('katex-copied'), 600);
            });
        }

        initExportAndThemeControls();
        initUiTheme();
        initMathCopy();
        initWebMcp();
    </script>
    <div id="presentation-container"></div>
    \u003cscript\u003e
    // --- Presentation Mode Engine (Upgraded Slidev-Lite & Multi-Tool Engine) ---
    (function() {
        var _loaded = false;
        var _reveal = null;
        var _autoStarted = false;
        var _tableResizeHandler = null;
        var _echartsInstances = [];

        function loadAssets() {
            return new Promise(function(resolve, reject) {
                if (_loaded) return resolve();
                var cssLinks = ['reveal.css', 'theme/black.css'];
                cssLinks.forEach(function(p) {
                    var l = document.createElement('link');
                    l.rel = 'stylesheet';
                    l.href = 'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/' + p;
                    document.head.appendChild(l);
                });
                var highlightCss = document.createElement('link');
                highlightCss.rel = 'stylesheet';
                highlightCss.href = 'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/monokai.css';
                document.head.appendChild(highlightCss);

                var s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js';
                s.onload = function() {
                    var m = document.createElement('script');
                    m.src = 'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/markdown/markdown.js';
                    m.onload = function() {
                        var h = document.createElement('script');
                        h.src = 'https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/highlight.js';
                        h.onload = function() { _loaded = true; resolve(); };
                        h.onerror = function() { _loaded = true; resolve(); };
                        document.head.appendChild(h);
                    };
                    m.onerror = reject;
                    document.head.appendChild(m);
                };
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        function preparePresentationTables(container) {
            container.querySelectorAll('.reveal section table').forEach(function(table) {
                if (table.closest('.presentation-table-fit')) return;
                var wrapper = document.createElement('div');
                wrapper.className = 'presentation-table-fit';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            });
        }

        function fitPresentationTables(container) {
            var reveal = container.querySelector('.reveal');
            if (!reveal) return;

            preparePresentationTables(container);

            reveal.querySelectorAll('.presentation-table-fit').forEach(function(wrapper) {
                var table = wrapper.querySelector('table');
                var section = wrapper.closest('section');
                if (!table || !section) return;

                table.style.transform = '';
                wrapper.style.width = '';
                wrapper.style.height = '';
                wrapper.classList.remove('presentation-table-overflow');

                var sectionWidth = section.clientWidth || 1000;
                var sectionHeight = section.clientHeight || 700;
                var sectionStyle = window.getComputedStyle(section);
                var paddingLeft = parseFloat(sectionStyle.paddingLeft) || 0;
                var paddingRight = parseFloat(sectionStyle.paddingRight) || 0;
                var paddingBottom = parseFloat(sectionStyle.paddingBottom) || 0;
                var availableWidth = Math.max(240, sectionWidth - paddingLeft - paddingRight);
                var availableHeight = Math.max(140, sectionHeight - wrapper.offsetTop - paddingBottom);
                var tableWidth = table.scrollWidth || table.offsetWidth;
                var tableHeight = table.scrollHeight || table.offsetHeight;

                if (!tableWidth || !tableHeight) return;

                var scale = Math.min(1, availableWidth / tableWidth, availableHeight / tableHeight);
                if (!Number.isFinite(scale) || scale <= 0) scale = 1;
                var requiresReadableOverflow = scale < 0.55;

                if (requiresReadableOverflow) {
                    wrapper.style.width = availableWidth + 'px';
                    wrapper.style.height = tableHeight + 'px';
                    wrapper.classList.add('presentation-table-overflow');
                    wrapper.classList.add('presentation-table-scaled');
                    return;
                }

                table.style.transform = 'scale(' + scale + ')';
                wrapper.style.width = (tableWidth * scale) + 'px';
                wrapper.style.height = (tableHeight * scale) + 'px';
                wrapper.classList.toggle('presentation-table-scaled', scale < 0.999);
            });
        }

        async function renderPresentationComponents(container) {
            // 1. Math formulas (KaTeX)
            if (typeof window.renderMathInElement === 'function') {
                try {
                    window.renderMathInElement(container.querySelector('.reveal .slides'), {
                        delimiters: [
                            { left: '$$', right: '$$', display: true },
                            { left: '$', right: '$', display: false }
                        ],
                        throwOnError: false
                    });
                } catch (e) {
                    console.warn('Presentation KaTeX Render Error:', e);
                }
            }

            // 2. Mermaid Diagrams
            var mermaidBlocks = container.querySelectorAll('.reveal pre code.language-mermaid, .reveal code.language-mermaid');
            if (mermaidBlocks.length > 0) {
                try {
                    var mermaidModule = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
                    var mermaid = mermaidModule.default || mermaidModule;
                    var isDarkTheme = APP_STATE.uiTheme === 'dark' || APP_STATE.theme === 'tokyo-night' || APP_STATE.theme === 'ayu-dark' || APP_STATE.theme === 'terminal';
                    mermaid.initialize({
                        startOnLoad: false,
                        theme: isDarkTheme ? 'dark' : 'default',
                        securityLevel: 'loose',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                    });
                    for (var i = 0; i < mermaidBlocks.length; i++) {
                        var codeEl = mermaidBlocks[i];
                        var preEl = codeEl.closest('pre') || codeEl;
                        var code = (codeEl.textContent || '').trim();
                        if (!code) continue;
                        var mid = 'pres-mermaid-' + Date.now() + '-' + i;
                        try {
                            var mRes = await mermaid.render(mid, code);
                            var wrap = document.createElement('div');
                            wrap.className = 'presentation-diagram-fit';
                            wrap.innerHTML = mRes.svg;
                            preEl.parentNode.replaceChild(wrap, preEl);
                        } catch (err) {
                            console.warn('Mermaid render error:', err);
                        }
                    }
                } catch (err) {
                    console.warn('Mermaid loader error:', err);
                }
            }

            // 3. ECharts Diagrams
            var echartsBlocks = container.querySelectorAll('.reveal pre code.language-echarts, .reveal code.language-echarts');
            if (echartsBlocks.length > 0) {
                try {
                    if (!window.echarts) {
                        await new Promise(function(resolve, reject) {
                            var es = document.createElement('script');
                            es.src = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
                            es.onload = resolve;
                            es.onerror = reject;
                            document.head.appendChild(es);
                        });
                    }
                    for (var j = 0; j < echartsBlocks.length; j++) {
                        var eCodeEl = echartsBlocks[j];
                        var ePreEl = eCodeEl.closest('pre') || eCodeEl;
                        var jsonStr = (eCodeEl.textContent || '').trim();
                        if (!jsonStr) continue;
                        try {
                            var chartConfig = JSON.parse(jsonStr);
                            var chartDiv = document.createElement('div');
                            chartDiv.className = 'presentation-echarts-chart';
                            ePreEl.parentNode.replaceChild(chartDiv, ePreEl);
                            var isDarkTheme = APP_STATE.uiTheme === 'dark' || APP_STATE.theme === 'tokyo-night';
                            var chartInst = window.echarts.init(chartDiv, isDarkTheme ? 'dark' : null);
                            chartInst.setOption(chartConfig);
                            _echartsInstances.push(chartInst);
                        } catch (err) {
                            console.warn('ECharts parse error:', err);
                        }
                    }
                } catch (err) {
                    console.warn('ECharts loader error:', err);
                }
            }
        }

        function fitPresentationSlides(container) {
            var reveal = container.querySelector('.reveal');
            if (!reveal) return;

            var baseFontSize = 30;
            var minimumFontSize = 22;
            var overflowLabel = APP_STATE.lang === 'zh-TW'
                ? '內容過多，建議拆頁'
                : 'Too much content — split this slide';

            reveal.querySelectorAll('.slides section').forEach(function(section) {
                section.style.fontSize = baseFontSize + 'px';
                section.classList.remove('presentation-slide-scaled', 'presentation-slide-overflow');
                section.setAttribute('data-overflow-label', overflowLabel);
            });

            fitPresentationTables(container);

            reveal.querySelectorAll('.slides section').forEach(function(section) {
                var fittedFontSize = baseFontSize;
                var isOverflowing = function() {
                    return section.scrollHeight > section.clientHeight + 1 ||
                        section.scrollWidth > section.clientWidth + 1;
                };

                while (fittedFontSize > minimumFontSize && isOverflowing()) {
                    fittedFontSize -= 1;
                    section.style.fontSize = fittedFontSize + 'px';
                }

                section.style.fontSize = fittedFontSize + 'px';
                section.classList.toggle('presentation-slide-scaled', fittedFontSize < baseFontSize);
                section.classList.toggle('presentation-slide-overflow', isOverflowing());
            });

            fitPresentationTables(container);
            _echartsInstances.forEach(function(c) { try { c.resize(); } catch(e) {} });
        }

        function schedulePresentationFit(container) {
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    fitPresentationSlides(container);
                });
            });
        }

        function setupPresentationToolbar(container, reveal) {
            var isZh = APP_STATE.lang === 'zh-TW';
            var toolbar = document.createElement('div');
            toolbar.id = 'presentation-toolbar';
            toolbar.className = 'presentation-toolbar';
            toolbar.setAttribute('role', 'toolbar');
            toolbar.setAttribute('aria-label', 'Presentation Controls');
            toolbar.innerHTML = 
                '<div class="presentation-toolbar-group">' +
                    '<button type="button" class="presentation-tb-btn" id="ptb-prev" title="' + (isZh ? '上一頁 (Page Up / ←)' : 'Previous (Page Up / ←)') + '">◀</button>' +
                    '<div class="presentation-tb-page" id="ptb-page-indicator" title="' + (isZh ? '點擊輸入頁碼跳轉' : 'Click to jump to slide') + '">' +
                        '<span id="ptb-cur-slide">1</span> / <span id="ptb-total-slides">1</span>' +
                    '</div>' +
                    '<button type="button" class="presentation-tb-btn" id="ptb-next" title="' + (isZh ? '下一頁 (Space / →)' : 'Next (Space / →)') + '">▶</button>' +
                '</div>' +
                '<div class="presentation-toolbar-divider"></div>' +
                '<div class="presentation-toolbar-group">' +
                    '<button type="button" class="presentation-tb-btn" id="ptb-overview" title="' + (isZh ? '投影片總覽 (O / ESC)' : 'Slide Overview (O / ESC)') + '">🔲 ' + (isZh ? '大綱' : 'Overview') + '</button>' +
                    '<button type="button" class="presentation-tb-btn" id="ptb-laser" title="' + (isZh ? '雷射筆模式 (L)' : 'Laser Pointer (L)') + '">🔴 ' + (isZh ? '雷射筆' : 'Laser') + '</button>' +
                    '<button type="button" class="presentation-tb-btn" id="ptb-pause" title="' + (isZh ? '黑屏暫停 (B / .)' : 'Pause Blackout (B / .)') + '">⚫ ' + (isZh ? '暫停' : 'Pause') + '</button>' +
                    '<button type="button" class="presentation-tb-btn" id="ptb-fullscreen" title="' + (isZh ? '全螢幕 (F)' : 'Fullscreen (F)') + '">⛶ ' + (isZh ? '全螢幕' : 'Fullscreen') + '</button>' +
                '</div>' +
                '<div class="presentation-toolbar-divider"></div>' +
                '<div class="presentation-toolbar-group">' +
                    '<button type="button" class="presentation-tb-btn" id="ptb-export-btn" title="' + (isZh ? '導出簡報' : 'Export Slides') + '">⭳ ' + (isZh ? '導出' : 'Export') + ' ▾</button>' +
                    '<div id="ptb-export-menu" class="presentation-export-menu" hidden>' +
                        '<button type="button" class="presentation-export-item" id="ptb-export-pdf">📄 ' + (isZh ? '另存 PDF 簡報' : 'Print / Save as PDF') + '</button>' +
                        '<button type="button" class="presentation-export-item" id="ptb-export-slide-png">🖼️ ' + (isZh ? '導出當前頁圖片 (PNG)' : 'Export Current Slide (PNG)') + '</button>' +
                        '<button type="button" class="presentation-export-item" id="ptb-copy-present-link">🔗 ' + (isZh ? '複製目前投影片連結' : 'Copy Slide Link') + '</button>' +
                    '</div>' +
                    '<button type="button" class="presentation-tb-btn presentation-tb-exit" id="ptb-exit" title="' + (isZh ? '結束演示 (ESC)' : 'Exit Presentation (ESC)') + '">✕ ' + (isZh ? '退出' : 'Exit') + '</button>' +
                '</div>';
            container.appendChild(toolbar);

            var laserDot = document.createElement('div');
            laserDot.id = 'presentation-laser-dot';
            container.appendChild(laserDot);

            var curSlideEl = toolbar.querySelector('#ptb-cur-slide');
            var totalSlidesEl = toolbar.querySelector('#ptb-total-slides');
            var prevBtn = toolbar.querySelector('#ptb-prev');
            var nextBtn = toolbar.querySelector('#ptb-next');
            var overviewBtn = toolbar.querySelector('#ptb-overview');
            var laserBtn = toolbar.querySelector('#ptb-laser');
            var pauseBtn = toolbar.querySelector('#ptb-pause');
            var fsBtn = toolbar.querySelector('#ptb-fullscreen');
            var exportBtn = toolbar.querySelector('#ptb-export-btn');
            var exportMenu = toolbar.querySelector('#ptb-export-menu');
            var exportPdfBtn = toolbar.querySelector('#ptb-export-pdf');
            var exportPngBtn = toolbar.querySelector('#ptb-export-slide-png');
            var copyLinkBtn = toolbar.querySelector('#ptb-copy-present-link');
            var exitBtn = toolbar.querySelector('#ptb-exit');
            var pageIndicator = toolbar.querySelector('#ptb-page-indicator');

            var updateSlideCount = function() {
                var indices = reveal.getIndices ? reveal.getIndices() : { h: 0 };
                var total = (typeof reveal.getTotalSlides === 'function')
                    ? reveal.getTotalSlides()
                    : (reveal.getSlides ? reveal.getSlides().length : 1);
                if (curSlideEl) curSlideEl.textContent = (indices.h + 1);
                if (totalSlidesEl) totalSlidesEl.textContent = total;
            };
            updateSlideCount();
            reveal.on('slidechanged', updateSlideCount);

            prevBtn.onclick = function() { reveal.prev(); };
            nextBtn.onclick = function() { reveal.next(); };
            overviewBtn.onclick = function() { reveal.toggleOverview(); };
            pauseBtn.onclick = function() { reveal.togglePause(); };
            exitBtn.onclick = window.exitPresentation;

            fsBtn.onclick = function() {
                if (!document.fullscreenElement) {
                    if (container.requestFullscreen) container.requestFullscreen().catch(function() {});
                    else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
                } else {
                    if (document.exitFullscreen) document.exitFullscreen().catch(function() {});
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                }
            };

            pageIndicator.onclick = async function() {
                var total = (typeof reveal.getTotalSlides === 'function')
                    ? reveal.getTotalSlides()
                    : (reveal.getSlides ? reveal.getSlides().length : 1);
                var cur = (reveal.getIndices ? reveal.getIndices().h : 0) + 1;
                var target = typeof window.showAppPrompt === 'function'
                    ? await window.showAppPrompt({
                        title: APP_STATE.lang === 'zh-TW' ? '跳轉投影片' : 'Jump to Slide',
                        message: APP_STATE.lang === 'zh-TW' ? ('請輸入要跳轉的頁碼 (1 - ' + total + '):') : ('Jump to slide (1 - ' + total + '):'),
                        initialValue: String(cur),
                        inputType: 'text',
                        allowEmpty: false
                    })
                    : window.prompt(APP_STATE.lang === 'zh-TW' ? ('請輸入要跳轉的頁碼 (1 - ' + total + '):') : ('Jump to slide (1 - ' + total + '):'), cur);
                if (target !== null) {
                    var p = parseInt(target, 10);
                    if (Number.isInteger(p) && p >= 1 && p <= total) {
                        reveal.slide(p - 1);
                    }
                }
            };

            var laserActive = false;
            var toggleLaser = function() {
                laserActive = !laserActive;
                laserBtn.classList.toggle('active', laserActive);
                container.classList.toggle('laser-active', laserActive);
            };
            laserBtn.onclick = toggleLaser;

            var hideTimer = null;
            function showToolbarTemporarily() {
                toolbar.classList.remove('toolbar-hidden');
                if (hideTimer) clearTimeout(hideTimer);
                hideTimer = setTimeout(function() {
                    if (!exportMenu.hidden) return;
                    toolbar.classList.add('toolbar-hidden');
                }, 2800);
            }
            showToolbarTemporarily();

            container.addEventListener('mousemove', function(e) {
                if (laserActive) {
                    laserDot.style.left = e.clientX + 'px';
                    laserDot.style.top = e.clientY + 'px';
                }
                showToolbarTemporarily();
            });

            exportBtn.onclick = function(e) {
                e.stopPropagation();
                exportMenu.hidden = !exportMenu.hidden;
            };
            document.addEventListener('click', function(e) {
                if (!exportBtn.contains(e.target) && !exportMenu.contains(e.target)) {
                    exportMenu.hidden = true;
                }
            });

            exportPdfBtn.onclick = function() {
                exportMenu.hidden = true;
                window.print();
            };

            exportPngBtn.onclick = async function() {
                exportMenu.hidden = true;
                var curSection = container.querySelector('.reveal .slides section.present');
                if (!curSection) return;
                if (typeof window.showToast === 'function') {
                    window.showToast(APP_STATE.lang === 'zh-TW' ? '正在產生當前投影片圖片...' : 'Generating slide image...');
                }
                try {
                    if (!window.html2canvas) {
                        await new Promise(function(resolve, reject) {
                            var script = document.createElement('script');
                            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                            script.onload = resolve;
                            script.onerror = function() { reject(new Error('Failed to load html2canvas')); };
                            document.head.appendChild(script);
                        });
                    }
                    var canvas = await window.html2canvas(curSection, {
                        scale: 2,
                        useCORS: true,
                        logging: false
                    });
                    var curIndex = (reveal.getIndices ? reveal.getIndices().h : 0) + 1;
                    var a = document.createElement('a');
                    a.download = 'slide-' + curIndex + '.png';
                    a.href = canvas.toDataURL('image/png');
                    a.click();
                    if (typeof window.showToast === 'function') {
                        window.showToast(APP_STATE.lang === 'zh-TW' ? '投影片圖片導出成功' : 'Slide image exported');
                    }
                } catch (err) {
                    if (typeof window.showToast === 'function') {
                        window.showToast('Export failed: ' + err.message);
                    }
                }
            };

            copyLinkBtn.onclick = async function() {
                exportMenu.hidden = true;
                var curIndex = reveal.getIndices ? reveal.getIndices().h : 0;
                var slideUrl = (APP_STATE.presentationPath ? (window.location.origin + APP_STATE.presentationPath) : window.location.href.split('#')[0]) + '#/' + curIndex;
                try {
                    await navigator.clipboard.writeText(slideUrl);
                    if (typeof window.showToast === 'function') {
                        window.showToast(APP_STATE.lang === 'zh-TW' ? '已複製當前投影片連結' : 'Slide link copied');
                    }
                } catch (e) {
                    if (typeof window.showAppPrompt === 'function') {
                        await window.showAppPrompt({
                            title: APP_STATE.lang === 'zh-TW' ? '複製投影片連結' : 'Copy Slide Link',
                            message: APP_STATE.lang === 'zh-TW' ? '請複製投影片連結：' : 'Copy slide link:',
                            initialValue: slideUrl,
                            inputType: 'text',
                            allowEmpty: true
                        })
                    } else {
                        window.prompt(APP_STATE.lang === 'zh-TW' ? '請複製投影片連結：' : 'Copy slide link:', slideUrl);
                    }
                }
            };

            document.addEventListener('keydown', function(e) {
                if (!container.classList.contains('active')) return;
                if (e.key === 'l' || e.key === 'L') {
                    toggleLaser();
                } else if (e.key === 'f' || e.key === 'F') {
                    if (fsBtn) fsBtn.click();
                }
            });
        }

        window.initPresentation = async function() {
            if (window.self !== window.top || (typeof APP_STATE !== 'undefined' && (APP_STATE.isEmbed || APP_STATE.embed))) {
                return;
            }
            var content = '';
            var edit = document.getElementById('contents');
            var share = document.getElementById('bot-accessible-content');
            
            if (APP_STATE.isBlock) {
                content = APP_STATE.blockMarkdown || '';
            } else if (edit && edit.value && edit.value.trim()) {
                content = edit.value;
            } else if (share && (share.textContent || '').trim()) {
                content = share.textContent;
            }

            if (!content || !content.trim()) { window.showAppDialog({ title: getI18n('present'), message: getI18n('presentationUnavailable'), kind: 'error' }); return; }

            var container = document.getElementById('presentation-container');
            var orientationHint = APP_STATE.lang === 'zh-TW'
                ? '請將裝置旋轉為橫向，以清楚檢視 16:9 投影片'
                : 'Rotate your device to landscape to view the 16:9 slides';
            container.classList.toggle('presentation-authoring', !!(edit && !edit.classList.contains('hide')));
            
            var currentTheme = (typeof APP_STATE !== 'undefined' && APP_STATE.theme) ? APP_STATE.theme : 'tokyo-night';
            var customTransition = 'fade';

            // YAML Frontmatter detection (disambiguated from slide separators)
            var yamlMatch = content.match(new RegExp('^---\\\\r?\\\\n([\\\\s\\\\S]*?)\\\\r?\\\\n---\\\\r?\\\\n'));
            if (yamlMatch) {
                var yamlBlock = yamlMatch[1].trim();
                var hasYamlKeys = new RegExp('^[a-zA-Z0-9_-]+\\\\s*:\\\\s*.+', 'm').test(yamlBlock) && !yamlBlock.startsWith('#');
                if (hasYamlKeys) {
                    content = content.slice(yamlMatch[0].length);
                    var transMatch = yamlBlock.match(/transition:\s*([a-zA-Z0-9_-]+)/i);
                    if (transMatch) customTransition = transMatch[1].toLowerCase();
                    var themeMatch = yamlBlock.match(/theme:\s*([a-zA-Z0-9_-]+)/i);
                    if (themeMatch) currentTheme = themeMatch[1].toLowerCase();
                }
            }
            content = content.replace(new RegExp('^\\\\s*---\\\\s*\\\\r?\\\\n'), '');

            container.setAttribute('data-presentation-theme', currentTheme);

            container.innerHTML = '<button type="button" id="presentation-close-btn">✕ ' + getI18n('presentationClose') + '</button>' +
                                 '<div class="presentation-orientation-hint" role="status">' + orientationHint + '</div>' +
                                 '<div class="reveal"><div class="slides"></div></div>';
            
            var slidesDiv = container.querySelector('.slides');

            function processSlideChunk(c, chunkIndex, isVertical) {
                var processed = typeof window.expandMarkdownExtensions === 'function' ? window.expandMarkdownExtensions(c.trim()) : c.trim();
                var isCover = false;
                var slideBg = '';

                // 1. Cover layout
                var coverRe1 = new RegExp('<!--\\\\s*layout:\\\\s*cover\\\\s*-->', 'gi');
                var coverRe2 = new RegExp('<!--\\\\s*cover\\\\s*-->', 'gi');
                if (processed.includes('<!-- layout: cover -->') || processed.includes('<!-- cover -->') || (chunkIndex === 0 && !isVertical && processed.startsWith('# ') && !processed.includes('\\n## '))) {
                    isCover = true;
                    processed = processed.replace(coverRe1, '').replace(coverRe2, '');
                }

                // 2. Custom slide background
                var bgRe = new RegExp('<!--\\\\s*(?:bg|background):\\\\s*(.+?)\\\\s*-->', 'i');
                var bgMatch = processed.match(bgRe);
                if (bgMatch) {
                    slideBg = bgMatch[1].trim();
                    processed = processed.replace(bgMatch[0], '');
                }

                // 3. Layouts: Three Columns (::left:: / ::center:: / ::right::)
                if (processed.includes('::left::') && (processed.includes('::center::') || processed.includes('::middle::')) && processed.includes('::right::')) {
                    var tParts = processed.split(/::left::|::center::|::middle::|::right::/);
                    if (tParts.length >= 4) {
                        var before3 = tParts[0].trim();
                        var left3 = tParts[1].trim();
                        var center3 = tParts[2].trim();
                        var right3 = tParts[3].trim();
                        processed = (before3 ? before3 + '\\n\\n' : '') +
                            '<div class="slidev-layout-three-cols"><div class="col-left">\\n\\n' + left3 + '\\n\\n</div><div class="col-center">\\n\\n' + center3 + '\\n\\n</div><div class="col-right">\\n\\n' + right3 + '\\n\\n</div></div>';
                    }
                } else if (processed.includes('::left::') && processed.includes('::right::')) {
                    // Layouts: Two Columns (::left:: / ::right::)
                    var parts = processed.split(/::left::|::right::/);
                    if (parts.length >= 3) {
                        var before = parts[0].trim();
                        var left = parts[1].trim();
                        var right = parts[2].trim();
                        processed = (before ? before + '\\n\\n' : '') + 
                            '<div class="slidev-layout-two-cols"><div class="col-left">\\n\\n' + left + '\\n\\n</div><div class="col-right">\\n\\n' + right + '\\n\\n</div></div>';
                    }
                }

                // 4. Code Block line focus: code fences with line numbers
                var fencePattern = new RegExp('(?:' + String.fromCharCode(96) + '{3}|~{3})([a-zA-Z0-9_-]+)\\\\s*(?:\\\\[|\\\\{)([^\\\\]\\\\}]+)(?:\\\\]|\\\\})', 'g');
                processed = processed.replace(fencePattern, String.fromCharCode(96,96,96) + '$1 data-line-numbers="$2"');

                // 5. Click Animations: {v-click} -> Reveal fragments
                processed = processed.split('{v-click}').join('<!-- .element: class="fragment" -->');

                var sec = document.createElement('section');
                sec.setAttribute('data-markdown', '');
                if (isCover) {
                    sec.className = 'slidev-layout-cover';
                }
                if (slideBg) {
                    if (slideBg.startsWith('http') || slideBg.startsWith('/')) {
                        sec.setAttribute('data-background-image', slideBg);
                    } else if (slideBg.includes('gradient')) {
                        sec.setAttribute('data-background-gradient', slideBg);
                    } else {
                        sec.setAttribute('data-background-color', slideBg);
                    }
                }
                var script = document.createElement('script');
                script.type = 'text/template';
                script.textContent = processed;
                sec.appendChild(script);
                return sec;
            }

            var horizontalChunks = content.split(new RegExp('\\\\r?\\\\n\\\\s*---\\\\s*\\\\r?\\\\n'));

            horizontalChunks.forEach(function(hChunk, hIndex) {
                var verticalChunks = hChunk.split(new RegExp('\\\\r?\\\\n\\\\s*--\\\\s*\\\\r?\\\\n'));
                if (verticalChunks.length > 1) {
                    var outerSec = document.createElement('section');
                    verticalChunks.forEach(function(vChunk, vIndex) {
                        outerSec.appendChild(processSlideChunk(vChunk, hIndex, vIndex > 0));
                    });
                    slidesDiv.appendChild(outerSec);
                } else {
                    slidesDiv.appendChild(processSlideChunk(hChunk, hIndex, false));
                }
            });

            container.classList.add('active');
            document.body.style.overflow = 'hidden';

            try {
                await loadAssets();
                if (_reveal) { try { _reveal.destroy(); } catch(e) {} }
                var plugins = [];
                if (window.RevealMarkdown) plugins.push(window.RevealMarkdown);
                if (window.RevealHighlight) plugins.push(window.RevealHighlight);
                var RevealConstructor = window.Reveal || Reveal;
                _reveal = new RevealConstructor(container.querySelector('.reveal'), {
                    plugins: plugins,
                    center: false, hash: true, transition: customTransition,
                    width: 1280, height: 720, margin: 0.035,
                    minScale: 0.2, maxScale: 2,
                    controls: true, progress: true, slideNumber: true
                });
                if (_reveal.on) {
                    _reveal.on('ready', function() {
                        renderPresentationComponents(container);
                        schedulePresentationFit(container);
                    });
                    _reveal.on('slidechanged', function() {
                        schedulePresentationFit(container);
                    });
                    _reveal.on('resize', function() {
                        schedulePresentationFit(container);
                    });
                }
                await _reveal.initialize();
                setupPresentationToolbar(container, _reveal);
                await renderPresentationComponents(container);

                container.querySelectorAll('.slides img, .slides video, .slides iframe').forEach(function(media) {
                    if (media.tagName === 'IMG' && media.complete) return;
                    media.addEventListener('load', function() { schedulePresentationFit(container); }, { once: true });
                    media.addEventListener('error', function() { schedulePresentationFit(container); }, { once: true });
                });
                if (document.fonts && document.fonts.ready) {
                    document.fonts.ready.then(function() { schedulePresentationFit(container); });
                }
                if (_tableResizeHandler) window.removeEventListener('resize', _tableResizeHandler);
                _tableResizeHandler = function() { schedulePresentationFit(container); };
                window.addEventListener('resize', _tableResizeHandler);
                schedulePresentationFit(container);
            } catch(e) {
                console.error('Presentation error:', e);
                window.showAppDialog({ title: getI18n('present'), message: getI18n('presentationFailed') + e, kind: 'error' });
                window.exitPresentation();
            }
        };

        window.exitPresentation = function() {
            if (document.fullscreenElement) {
                try {
                    if (document.exitFullscreen) document.exitFullscreen().catch(function() {});
                    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                } catch(e) {}
            }
            var c = document.getElementById('presentation-container');
            if (c) {
                c.classList.remove('active');
                c.classList.remove('presentation-authoring');
                c.classList.remove('laser-active');
                c.innerHTML = '';
            }
            if (_reveal) { try { _reveal.destroy(); } catch(e) {} _reveal = null; }
            if (_tableResizeHandler) {
                window.removeEventListener('resize', _tableResizeHandler);
                _tableResizeHandler = null;
            }
            _echartsInstances.forEach(function(inst) { try { inst.dispose(); } catch(e) {} });
            _echartsInstances = [];
            document.body.style.overflow = '';

            var isDirectPresentUrl = window.location.pathname.endsWith('/present');
            var shouldReturnToShare = APP_STATE.autoPresent || isDirectPresentUrl;
            if (shouldReturnToShare) {
                var targetPath = APP_STATE.sharePath || window.location.pathname.replace(new RegExp('\\\\/present\\\\/?$'), '') || '/';
                window.location.replace(targetPath);
            }
        };

        window.initBookMode = function() {
            if (window.self !== window.top || (typeof APP_STATE !== 'undefined' && (APP_STATE.isEmbed || APP_STATE.embed))) {
                return;
            }
            var content = '';
            var edit = document.getElementById('contents');
            var share = document.getElementById('bot-accessible-content');
            
            if (APP_STATE.isBlock) {
                content = APP_STATE.blockMarkdown || '';
            } else if (edit && edit.value && edit.value.trim()) {
                content = edit.value;
            } else if (share && (share.textContent || '').trim()) {
                content = share.textContent;
            }

            if (!content || !content.trim()) return;

            function parseBookTocInternal(src) {
                if (!src) return { title: APP_STATE.title || 'Book', chapters: [], sections: [] };
                var lines = src.split(new RegExp('\\\\r?\\\\n'));
                var bookTitle = '';
                var currentSection = '';
                var chapters = [];
                var sections = [];

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    var h1Match = line.match(new RegExp('^#\\\\s+(.+)$'));
                    if (h1Match && !bookTitle) {
                        bookTitle = h1Match[1].trim();
                        continue;
                    }

                    var h2Match = line.match(new RegExp('^##\\\\s+(.+)$'));
                    var h3Match = line.match(new RegExp('^###\\\\s+(.+)$'));
                    if (h2Match || h3Match) {
                        var secTitle = (h2Match ? h2Match[1] : h3Match[1]).trim();
                        currentSection = secTitle;
                        sections.push({ title: secTitle, line: i });
                        continue;
                    }

                    var linkMatch = line.match(new RegExp('^(\\\\s*)(?:[-*+]|\\\\d+\\\\.)\\\\s+\\\\x5B(.*?)\\\\x5D\\\\((.*?)\\\\x29'));
                    if (linkMatch) {
                        var indent = linkMatch[1].length;
                        var title = linkMatch[2].trim();
                        var url = linkMatch[3].trim();
                        var level = Math.floor(indent / 2);
                        var isExternal = url.startsWith('http://') || url.startsWith('https://');

                        chapters.push({
                            index: chapters.length,
                            title: title,
                            url: url,
                            section: currentSection || (bookTitle || 'Chapters'),
                            level: level,
                            isExternal: isExternal
                        });
                    }
                }

                return {
                    title: bookTitle || APP_STATE.title || 'Book',
                    chapters: chapters,
                    sections: sections
                };
            }

            var tocFn = window.parseBookToc || parseBookTocInternal;
            var bookData = tocFn(content);

            var isZh = APP_STATE.lang === 'zh-TW';

            if (!bookData || !bookData.chapters || bookData.chapters.length === 0) {
                var cleanDefaultUrl = APP_STATE.sharePath || window.location.pathname.replace(new RegExp('\\\\/book\\\\/?$'), '') || '/';
                bookData = {
                    title: APP_STATE.title || (isZh ? '書本閱讀' : 'Book Reader'),
                    chapters: [{
                        index: 0,
                        title: APP_STATE.title || (isZh ? '本篇內容' : 'This Note'),
                        url: cleanDefaultUrl,
                        section: isZh ? '本文' : 'Content',
                        level: 0,
                        isExternal: false
                    }],
                    sections: []
                };
            }

            document.body.classList.add('book-mode-active');
            var container = document.getElementById('book-mode-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'book-mode-container';
                document.body.appendChild(container);
            }

            var isZh = APP_STATE.lang === 'zh-TW';
            var searchPlaceholder = isZh ? '搜尋章節...' : 'Search chapters...';
            var backToNormalText = isZh ? '退出書本' : 'Exit Book';
            var exitUrl = APP_STATE.sharePath || (APP_STATE.path ? '/' + APP_STATE.path : '/');

            var sectionMap = {};
            bookData.chapters.forEach(function(ch) {
                var sec = ch.section || (isZh ? '章節清單' : 'Chapters');
                if (!sectionMap[sec]) sectionMap[sec] = [];
                sectionMap[sec].push(ch);
            });

            var sidebarHtml = 
                '<div class="book-sidebar" id="book-sidebar">' +
                    '<div class="book-sidebar-header">' +
                        '<div class="book-top-actions">' +
                            '<a href="' + exitUrl + '" id="book-exit-btn" class="book-exit-link" title="' + (isZh ? '返回一般閱讀模式' : 'Back to Note') + '">' +
                                '<span>←</span> ' + backToNormalText +
                            '</a>' +
                        '</div>' +
                        '<a href="#" id="book-toc-home-link" class="book-brand-title" title="' + bookData.title + '">📖 ' + bookData.title + '</a>' +
                        '<input type="search" id="book-search-input" class="book-search-input" placeholder="' + searchPlaceholder + '" aria-label="' + searchPlaceholder + '">' +
                    '</div>' +
                    '<div class="book-toc-scroll" id="book-toc-scroll">';

            Object.keys(sectionMap).forEach(function(secTitle) {
                sidebarHtml += '<div class="book-section-group">' +
                    '<div class="book-section-title">' + secTitle + '</div>' +
                    '<ul class="book-toc-list">';
                sectionMap[secTitle].forEach(function(ch) {
                    sidebarHtml += '<li class="book-toc-item" data-chapter-index="' + ch.index + '">' +
                        '<a href="' + ch.url + '" class="book-toc-link" data-url="' + ch.url + '" data-chapter-index="' + ch.index + '" style="padding-left:' + (12 + ch.level * 14) + 'px;">' +
                            ch.title +
                        '</a>' +
                    '</li>';
                });
                sidebarHtml += '</ul></div>';
            });

            sidebarHtml += '</div></div><div class="book-sidebar-backdrop" id="book-sidebar-backdrop"></div>';

            var offlineBtnText = isZh ? '離線快取' : 'Offline Cache';
            var exportBtnText = isZh ? '匯出 ▾' : 'Export ▾';
            var exportMdText = isZh ? '合併 Markdown (.md)' : 'Combined Markdown (.md)';
            var exportHtmlText = isZh ? '單一離線 HTML (.html)' : 'Offline Standalone HTML (.html)';
            var exportPdfText = isZh ? '匯出 PDF / 列印 (.pdf)' : 'Print / Export PDF (.pdf)';

            var mainHtml = 
                '<div class="book-main">' +
                    '<div class="book-topbar">' +
                        '<div style="display:flex;align-items:center;gap:10px;min-width:0;">' +
                            '<button type="button" id="book-sidebar-toggle" class="toolbar-icon-button" aria-label="Toggle Sidebar" style="display:inline-flex;">☰</button>' +
                            '<div class="book-breadcrumbs" id="book-breadcrumbs">' +
                                '<span id="book-crumb-parent" style="cursor:pointer;">' + bookData.title + '</span>' +
                                '<span class="crumb-sep">/</span>' +
                                '<span class="crumb-current" id="book-crumb-current">載入中...</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="book-top-nav-group">' +
                            '<button type="button" id="book-offline-cache-btn" class="book-top-nav-btn" title="' + (isZh ? '📥 快取整本書至瀏覽器，離線或斷網時仍可流暢閱讀' : 'Cache entire book offline in browser') + '">' +
                                '<span>📥</span> <span class="cache-btn-text book-btn-label">' + offlineBtnText + '</span>' +
                            '</button>' +
                            '<div class="book-export-dropdown">' +
                                '<button type="button" id="book-export-toggle-btn" class="book-top-nav-btn" aria-haspopup="true" aria-expanded="false" title="' + (isZh ? '匯出電子書' : 'Export Book') + '">' +
                                    '<span>📤</span> <span class="book-btn-label">' + exportBtnText + '</span>' +
                                '</button>' +
                                '<div class="book-export-menu" id="book-export-menu" role="menu">' +
                                    '<button type="button" class="book-export-item" id="book-export-md-btn" role="menuitem">' +
                                        '<span>📄</span> <span>' + exportMdText + '</span>' +
                                    '</button>' +
                                    '<button type="button" class="book-export-item" id="book-export-html-btn" role="menuitem">' +
                                        '<span>🌐</span> <span>' + exportHtmlText + '</span>' +
                                    '</button>' +
                                    '<button type="button" class="book-export-item" id="book-export-pdf-btn" role="menuitem">' +
                                        '<span>🖨️</span> <span>' + exportPdfText + '</span>' +
                                    '</button>' +
                                '</div>' +
                            '</div>' +
                            '<button type="button" id="book-prev-btn" class="book-top-nav-btn" title="' + (isZh ? '上一章 ([)' : 'Previous ([)') + '"><span>←</span> <span class="book-btn-label">' + (isZh ? '上一章' : 'Prev') + '</span></button>' +
                            '<button type="button" id="book-next-btn" class="book-top-nav-btn" title="' + (isZh ? '下一章 (])' : 'Next (])') + '"><span class="book-btn-label">' + (isZh ? '下一章' : 'Next') + '</span> <span>→</span></button>' +
                            '<a href="#" id="book-open-tab-btn" class="book-top-nav-btn" target="_blank" rel="noopener noreferrer" title="' + (isZh ? '在新分頁開啟' : 'Open in tab') + '">↗</a>' +
                        '</div>' +
                    '</div>' +
                    '<div class="book-iframe-container">' +
                        '<iframe id="book-content-iframe" class="book-embed-frame" title="Book Chapter Content" src="about:blank"></iframe>' +
                    '</div>' +
                '</div>';

            var resizerHtml = '<div class="book-sidebar-resizer" id="book-sidebar-resizer" title="' + (isZh ? '拖拉調整側邊欄寬度 / 雙擊重設' : 'Drag to resize sidebar / Double click to reset') + '"></div>';

            container.innerHTML = sidebarHtml + resizerHtml + mainHtml;

            var currentChapterIndex = 0;
            var bookIdKey = APP_STATE.shareId || APP_STATE.path || 'book';
            var offlineStorageKey = 'cf-notepad:book-offline:' + bookIdKey;
            var readingProgressKey = 'cf-notepad:book-last-idx:' + bookIdKey;

            var searchInput = document.getElementById('book-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    var query = (this.value || '').toLowerCase().trim();
                    var items = container.querySelectorAll('.book-toc-item');
                    items.forEach(function(item) {
                        var text = (item.textContent || '').toLowerCase();
                        item.style.display = (!query || text.includes(query)) ? '' : 'none';
                    });
                });
            }

            var sidebar = document.getElementById('book-sidebar');
            var toggleBtn = document.getElementById('book-sidebar-toggle');
            var backdrop = document.getElementById('book-sidebar-backdrop');
            var resizer = document.getElementById('book-sidebar-resizer');
            var defaultSidebarWidth = 290;

            try {
                var savedSidebarWidth = localStorage.getItem('cf-notepad:book-sidebar-width');
                if (savedSidebarWidth && sidebar) {
                    var parsedW = parseInt(savedSidebarWidth, 10);
                    if (parsedW >= 180 && parsedW <= 800) {
                        sidebar.style.width = parsedW + 'px';
                    }
                }
            } catch (e) {}

            if (resizer && sidebar) {
                var isDragging = false;
                var startX = 0;
                var startWidth = 0;

                var getIframe = function() {
                    return document.getElementById('book-content-iframe');
                };

                var onPointerDown = function(clientX) {
                    isDragging = true;
                    startX = clientX;
                    startWidth = sidebar.getBoundingClientRect().width;
                    resizer.classList.add('is-resizing');
                    document.body.style.userSelect = 'none';
                    document.body.style.cursor = 'col-resize';
                    var ifr = getIframe();
                    if (ifr) ifr.style.pointerEvents = 'none';
                };

                var onPointerMove = function(clientX) {
                    if (!isDragging) return;
                    var dx = clientX - startX;
                    var maxAllowed = Math.round(window.innerWidth * 0.65);
                    var newWidth = Math.max(180, Math.min(maxAllowed, startWidth + dx));
                    sidebar.style.width = newWidth + 'px';
                };

                var onPointerUp = function() {
                    if (!isDragging) return;
                    isDragging = false;
                    resizer.classList.remove('is-resizing');
                    document.body.style.userSelect = '';
                    document.body.style.cursor = '';
                    var ifr = getIframe();
                    if (ifr) ifr.style.pointerEvents = '';
                    var finalWidth = Math.round(sidebar.getBoundingClientRect().width);
                    try {
                        localStorage.setItem('cf-notepad:book-sidebar-width', finalWidth + 'px');
                    } catch (e) {}
                };

                resizer.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    onPointerDown(e.clientX);
                    var onMouseMove = function(ev) { onPointerMove(ev.clientX); };
                    var onMouseUp = function() {
                        onPointerUp();
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                    };
                    window.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('mouseup', onMouseUp);
                });

                resizer.addEventListener('dblclick', function() {
                    sidebar.style.width = defaultSidebarWidth + 'px';
                    try {
                        localStorage.removeItem('cf-notepad:book-sidebar-width');
                    } catch (e) {}
                });

                resizer.addEventListener('touchstart', function(e) {
                    if (e.touches.length === 1) {
                        onPointerDown(e.touches[0].clientX);
                    }
                }, { passive: true });

                window.addEventListener('touchmove', function(e) {
                    if (isDragging && e.touches.length === 1) {
                        onPointerMove(e.touches[0].clientX);
                    }
                }, { passive: true });

                window.addEventListener('touchend', function() {
                    if (isDragging) onPointerUp();
                });
            }

            if (toggleBtn && sidebar) {
                toggleBtn.addEventListener('click', function() {
                    sidebar.classList.toggle('open');
                });
            }
            if (backdrop && sidebar) {
                backdrop.addEventListener('click', function() {
                    sidebar.classList.remove('open');
                });
            }

            var offlineBtn = document.getElementById('book-offline-cache-btn');
            if (offlineBtn) {
                try {
                    if (localStorage.getItem(offlineStorageKey)) {
                        offlineBtn.classList.add('cached');
                        var btnTxt = offlineBtn.querySelector('.cache-btn-text');
                        if (btnTxt) btnTxt.textContent = isZh ? '已離線快取' : 'Offline Cached';
                    }
                } catch(e) {}
            }

            async function cacheEntireBookOffline() {
                if (!offlineBtn) return;
                var btnTxt = offlineBtn.querySelector('.cache-btn-text');
                var total = bookData.chapters.length;
                if (btnTxt) btnTxt.textContent = (isZh ? '快取中 ' : 'Caching ') + '0/' + total;
                try {
                    var cache = ('caches' in window) ? await caches.open('david888-wiki-shell-v5') : null;
                    var imgCache = ('caches' in window) ? await caches.open('david888-wiki-images-v1') : null;
                    
                    if (cache) {
                        try { await cache.add(window.location.href); } catch(e) {}
                    }

                    for (var i = 0; i < bookData.chapters.length; i++) {
                        var ch = bookData.chapters[i];
                        if (btnTxt) btnTxt.textContent = (isZh ? '快取中 ' : 'Caching ') + (i + 1) + '/' + total;
                        var targetUrl = (ch.url || '').replace(new RegExp('\\\\/book\\\\/?(\\\\?.*)?$'), '$1').replace(new RegExp('\\\\/book\\\\/?$'), '');
                        if (!targetUrl) continue;
                        var embedUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + 'embed=1';

                        if (cache) {
                            try {
                                var resp = await fetch(embedUrl, { cache: 'reload' });
                                if (resp.ok) {
                                    await cache.put(embedUrl, resp.clone());
                                    var text = await resp.text();
                                    if (imgCache) {
                                        var imgMatches = text.match(new RegExp('https:\\\\/\\\\/s3\\\\.wiki\\\\.david888\\\\.com\\\\/[^"\\'\\\\s)]+', 'g')) || [];
                                        for (var j = 0; j < imgMatches.length; j++) {
                                            try {
                                                var imgResp = await fetch(imgMatches[j], { mode: 'no-cors' });
                                                if (imgResp) await imgCache.put(imgMatches[j], imgResp);
                                            } catch(e) {}
                                        }
                                    }
                                }
                            } catch(e) {}
                        }
                    }
                    try { localStorage.setItem(offlineStorageKey, '1'); } catch(e) {}
                    offlineBtn.classList.add('cached');
                    if (btnTxt) btnTxt.textContent = isZh ? '已離線快取' : 'Offline Cached';
                    if (typeof showToast === 'function') {
                        showToast(isZh ? ('✅ 全書 ' + total + ' 個章節已全數離線儲存！') : ('✅ All ' + total + ' chapters cached offline!'));
                    }
                } catch(err) {
                    if (btnTxt) btnTxt.textContent = isZh ? '快取失敗' : 'Cache Failed';
                }
            }

            var exportToggleBtn = document.getElementById('book-export-toggle-btn');
            var exportMenu = document.getElementById('book-export-menu');

            if (exportToggleBtn && exportMenu) {
                exportToggleBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var isShown = exportMenu.classList.toggle('show');
                    exportToggleBtn.setAttribute('aria-expanded', isShown ? 'true' : 'false');
                });
                var closeExportIfOutside = function(e) {
                    if (!exportMenu.contains(e.target) && e.target !== exportToggleBtn && !exportToggleBtn.contains(e.target)) {
                        exportMenu.classList.remove('show');
                        exportToggleBtn.setAttribute('aria-expanded', 'false');
                    }
                };
                document.addEventListener('click', closeExportIfOutside);
                document.addEventListener('touchstart', closeExportIfOutside, { passive: true });
            }

            async function exportCombinedMarkdown() {
                if (exportMenu) exportMenu.classList.remove('show');
                if (typeof showToast === 'function') {
                    showToast(isZh ? '⏳ 正在合併全書 Markdown...' : '⏳ Compiling Book Markdown...');
                }
                var mdParts = ['# ' + bookData.title + '\\n\\n' + (isZh ? '> 本書由 David888 Wiki 電子書模式自動整合匯出。\\n\\n' : '> Automatically exported from David888 Wiki Book Mode.\\n\\n') + '[TOC]\\n'];
                
                for (var i = 0; i < bookData.chapters.length; i++) {
                    var ch = bookData.chapters[i];
                    var chUrl = (ch.url || '').replace(new RegExp('\\\\/book\\\\/?(\\\\?.*)?$'), '$1').replace(new RegExp('\\\\/book\\\\/?$'), '');
                    var mdText = '';
                    try {
                        var resp = await fetch(chUrl, { headers: { 'Accept': 'text/markdown' } });
                        if (resp.ok) {
                            mdText = await resp.text();
                        }
                    } catch(e) {}
                    if (!mdText) mdText = '# ' + ch.title + '\\n\\n*(章節內容 / Content)*';
                    mdParts.push('\\n\\n---\\n\\n' + mdText);
                }

                var fullMd = mdParts.join('');
                var blob = new Blob([fullMd], { type: 'text/markdown;charset=utf-8' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                var cleanName = (bookData.title || 'book').replace(new RegExp('[^a-zA-Z0-9\\\\u4e00-\\\\u9fa5_-]', 'g'), '_');
                a.download = cleanName + '.full.md';
                a.click();
                URL.revokeObjectURL(a.href);
                if (typeof showToast === 'function') {
                    showToast(isZh ? '📄 已成功匯出合併 Markdown！' : '📄 Combined Markdown exported!');
                }
            }

            async function exportStandaloneHtml() {
                if (exportMenu) exportMenu.classList.remove('show');
                if (typeof showToast === 'function') {
                    showToast(isZh ? '⏳ 正在打包單一離線 HTML 電子書...' : '⏳ Packaging Standalone HTML eBook...');
                }
                var chapterData = [];
                for (var i = 0; i < bookData.chapters.length; i++) {
                    var ch = bookData.chapters[i];
                    var chUrl = (ch.url || '').replace(new RegExp('\\\\/book\\\\/?(\\\\?.*)?$'), '$1').replace(new RegExp('\\\\/book\\\\/?$'), '');
                    var chHtml = '';
                    try {
                        var embedUrl = chUrl + (chUrl.includes('?') ? '&' : '?') + 'embed=1';
                        var resp = await fetch(embedUrl);
                        if (resp.ok) {
                            var htmlText = await resp.text();
                            var parser = new DOMParser();
                            var doc = parser.parseFromString(htmlText, 'text/html');
                            var bodyEl = doc.querySelector('.markdown-body') || doc.body;
                            chHtml = bodyEl ? bodyEl.innerHTML : htmlText;
                        }
                    } catch(e) {}
                    if (!chHtml) chHtml = '<h1>' + ch.title + '</h1><p><em>(載入中 / Loading)</em></p>';
                    chapterData.push({
                        index: ch.index,
                        title: ch.title,
                        level: ch.level,
                        section: ch.section,
                        html: chHtml
                    });
                }

                var singleHtml = '<!DOCTYPE html>\\n<html lang="' + (isZh ? 'zh-TW' : 'en') + '">\\n<head>\\n<meta charset="utf-8">\\n<meta name="viewport" content="width=device-width, initial-scale=1">\\n<title>' + bookData.title + '</title>\\n<style>' +
                    'body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display:flex; height:100vh; overflow:hidden; background:#fff; color:#1f2328; }' +
                    '.book-sidebar { width:290px; border-right:1px solid #e1e4e8; background:#f6f8fa; display:flex; flex-direction:column; height:100%; flex-shrink:0; }' +
                    '.book-sidebar-header { padding:14px 16px; border-bottom:1px solid #e1e4e8; font-weight:700; font-size:15px; }' +
                    '.book-toc-scroll { flex:1; overflow-y:auto; padding:10px; }' +
                    '.book-toc-item { padding:8px 12px; margin:2px 0; border-radius:6px; cursor:pointer; font-size:13.5px; transition:0.15s; }' +
                    '.book-toc-item:hover { background:#e1e4e8; }' +
                    '.book-toc-item.active { background:#2563eb; color:#fff; font-weight:600; }' +
                    '.book-main { flex:1; display:flex; flex-direction:column; height:100%; overflow:hidden; }' +
                    '.book-topbar { padding:10px 20px; border-bottom:1px solid #e1e4e8; display:flex; justify-content:space-between; align-items:center; background:#fff; }' +
                    '.book-content { flex:1; overflow-y:auto; padding:32px 40px; max-width:860px; margin:0 auto; width:100%; box-sizing:border-box; line-height:1.6; }' +
                    '.btn { padding:5px 12px; border-radius:6px; border:1px solid #d1d5db; background:#fff; cursor:pointer; font-size:12.5px; }' +
                    '.btn:hover { background:#f3f4f6; }' +
                    '@media (max-width: 768px) { .book-sidebar { display:none; } }' +
                    '</style>\\n</head>\\n<body>\\n' +
                    '<div class="book-sidebar"><div class="book-sidebar-header">📖 ' + bookData.title + '</div><div class="book-toc-scroll" id="toc-list"></div></div>' +
                    '<div class="book-main"><div class="book-topbar"><strong id="crumb"></strong><div><button class="btn" id="prev-btn">← ' + (isZh ? '上一章' : 'Prev') + '</button> <button class="btn" id="next-btn">' + (isZh ? '下一章' : 'Next') + ' →</button></div></div><div class="book-content" id="content-body"></div></div>' +
                    '<script>' +
                    'var chapters = ' + JSON.stringify(chapterData) + ';' +
                    'var cur = 0;' +
                    'var toc = document.getElementById("toc-list");' +
                    'var crumb = document.getElementById("crumb");' +
                    'var body = document.getElementById("content-body");' +
                    'chapters.forEach(function(ch, idx) {' +
                    '  var el = document.createElement("div");' +
                    '  el.className = "book-toc-item" + (idx === 0 ? " active" : "");' +
                    '  el.style.paddingLeft = (12 + ch.level * 14) + "px";' +
                    '  el.textContent = ch.title;' +
                    '  el.onclick = function() { render(idx); };' +
                    '  toc.appendChild(el);' +
                    '});' +
                    'function render(idx) {' +
                    '  if (idx < 0 || idx >= chapters.length) return;' +
                    '  cur = idx;' +
                    '  Array.from(toc.children).forEach(function(c, i) { c.className = "book-toc-item" + (i === idx ? " active" : ""); });' +
                    '  crumb.textContent = chapters[idx].title;' +
                    '  body.innerHTML = "<h1>" + chapters[idx].title + "</h1>" + chapters[idx].html;' +
                    '  body.scrollTop = 0;' +
                    '}' +
                    'document.getElementById("prev-btn").onclick = function() { render(cur - 1); };' +
                    'document.getElementById("next-btn").onclick = function() { render(cur + 1); };' +
                    'render(0);' +
                    '<\\\\/script>\\n</body>\\n</html>';

                var blob = new Blob([singleHtml], { type: 'text/html;charset=utf-8' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                var cleanName = (bookData.title || 'book').replace(new RegExp('[^a-zA-Z0-9\\\\u4e00-\\\\u9fa5_-]', 'g'), '_');
                a.download = cleanName + '.html';
                a.click();
                URL.revokeObjectURL(a.href);
                if (typeof showToast === 'function') {
                    showToast(isZh ? '🌐 已成功匯出單一離線 HTML 電子書！' : '🌐 Standalone HTML eBook exported!');
                }
            }

            async function exportPdfPrint() {
                if (exportMenu) exportMenu.classList.remove('show');
                if (typeof showToast === 'function') {
                    showToast(isZh ? '🚀 正在編譯整本電子書 PDF...' : '🚀 Compiling eBook PDF...');
                }

                try {
                    var combinedMd = '# ' + bookData.title + '\\n\\n' + (bookData.summary ? '> ' + bookData.summary + '\\n\\n' : '');
                    for (var i = 0; i < bookData.chapters.length; i++) {
                        var ch = bookData.chapters[i];
                        var chUrl = (ch.url || '').replace(new RegExp('\\\\/book\\\\/?(\\\\?.*)?$'), '$1').replace(new RegExp('\\\\/book\\\\/?$'), '');
                        try {
                            var resp = await fetch(chUrl, { headers: { 'Accept': 'text/markdown' } });
                            if (resp.ok) {
                                var mdText = await resp.text();
                                combinedMd += '\\n\\n---\\n\\n# ' + ch.title + '\\n\\n' + mdText + '\\n';
                            } else {
                                combinedMd += '\\n\\n---\\n\\n# ' + ch.title + '\\n\\n*(' + ch.title + ')*\\n';
                            }
                        } catch(e) {
                            combinedMd += '\\n\\n---\\n\\n# ' + ch.title + '\\n\\n*(' + ch.title + ')*\\n';
                        }
                    }

                    var pdfResp = await fetch('/api/pdf/export', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            markdown: combinedMd,
                            title: bookData.title,
                            theme: 'claude-canvas'
                        })
                    });

                    if (!pdfResp.ok) {
                        throw new Error('PDF export server returned ' + pdfResp.status);
                    }

                    var pdfBlob = await pdfResp.blob();
                    var blobUrl = URL.createObjectURL(pdfBlob);
                    var a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = (bookData.title || 'eBook').replace(/[/\\\\:*?"<>|]/g, '_') + '.pdf';
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(function() { a.remove(); URL.revokeObjectURL(blobUrl); }, 2000);

                    if (typeof showToast === 'function') {
                        showToast(isZh ? '✅ 電子書 PDF 已成功下載！' : '✅ eBook PDF downloaded successfully!');
                    }
                    return;
                } catch(pdfErr) {
                    console.warn('Direct eBook export failed, falling back to print dialog:', pdfErr);
                    if (typeof showToast === 'function') {
                        showToast(isZh ? '⚠️ 雲端轉換未完成，切換至列印預覽...' : '⚠️ Opening browser print layout fallback...');
                    }
                }

                var printContainer = document.getElementById('book-print-container');
                if (!printContainer) {
                    printContainer = document.createElement('div');
                    printContainer.id = 'book-print-container';
                    document.body.appendChild(printContainer);
                }
                
                var htmlParts = [
                    '<div class="book-print-cover">' +
                        '<h1>' + bookData.title + '</h1>' +
                        '<p>' + (isZh ? 'David888 Wiki 電子書手冊' : 'David888 Wiki Book Edition') + '</p>' +
                    '</div>'
                ];

                for (var i = 0; i < bookData.chapters.length; i++) {
                    var ch = bookData.chapters[i];
                    var chUrl = (ch.url || '').replace(new RegExp('\\\\/book\\\\/?(\\\\?.*)?$'), '$1').replace(new RegExp('\\\\/book\\\\/?$'), '');
                    var chHtml = '';
                    try {
                        var embedUrl = chUrl + (chUrl.includes('?') ? '&' : '?') + 'embed=1';
                        var resp = await fetch(embedUrl);
                        if (resp.ok) {
                            var htmlText = await resp.text();
                            var parser = new DOMParser();
                            var doc = parser.parseFromString(htmlText, 'text/html');
                            var bodyEl = doc.querySelector('.markdown-body') || doc.body;
                            chHtml = bodyEl ? bodyEl.innerHTML : htmlText;
                        }
                    } catch(e) {}
                    if (!chHtml) chHtml = '<p><em>' + ch.title + '</em></p>';
                    htmlParts.push('<div class="book-print-chapter"><h2>' + ch.title + '</h2>' + chHtml + '</div>');
                }

                printContainer.innerHTML = htmlParts.join('');
                window.print();
            }

            function loadChapter(index) {
                var iframe = document.getElementById('book-content-iframe');
                var crumb = document.getElementById('book-crumb-current');
                var openTabBtn = document.getElementById('book-open-tab-btn');
                var prevBtn = document.getElementById('book-prev-btn');
                var nextBtn = document.getElementById('book-next-btn');

                if (index === -1) {
                    currentChapterIndex = -1;
                    container.querySelectorAll('.book-toc-item').forEach(function(el) {
                        el.classList.remove('active');
                    });
                    if (crumb) crumb.textContent = isZh ? '目錄總覽' : 'Table of Contents';
                    var homeUrl = (APP_STATE.sharePath || window.location.pathname.replace(new RegExp('\\\\/book\\\\/?$'), '') || '/');
                    if (openTabBtn) openTabBtn.href = homeUrl;
                    if (iframe) iframe.src = homeUrl + (homeUrl.includes('?') ? '&' : '?') + 'embed=1';
                    if (prevBtn) prevBtn.disabled = true;
                    if (nextBtn) nextBtn.disabled = bookData.chapters.length === 0;
                    if (sidebar) sidebar.classList.remove('open');
                    return;
                }

                if (index < 0 || index >= bookData.chapters.length) return;
                currentChapterIndex = index;
                try { localStorage.setItem(readingProgressKey, index); } catch(e) {}
                var chapter = bookData.chapters[index];

                container.querySelectorAll('.book-toc-item').forEach(function(el) {
                    el.classList.toggle('active', parseInt(el.getAttribute('data-chapter-index'), 10) === index);
                });

                if (crumb) crumb.textContent = chapter.title;
                if (openTabBtn) openTabBtn.href = chapter.url;

                if (prevBtn) prevBtn.disabled = index === 0;
                if (nextBtn) nextBtn.disabled = index >= bookData.chapters.length - 1;

                if (sidebar) sidebar.classList.remove('open');

                if (iframe) {
                    var targetUrl = (chapter.url || '').replace(new RegExp('\\\\/book\\\\/?(\\\\?.*)?$'), '$1').replace(new RegExp('\\\\/book\\\\/?$'), '');
                    if (!targetUrl) targetUrl = '/';
                    if (!chapter.isExternal && !targetUrl.includes('embed=1')) {
                        targetUrl += (targetUrl.includes('?') ? '&' : '?') + 'embed=1';
                    }
                    iframe.src = targetUrl;
                }
            }

            container.addEventListener('click', function(e) {
                var exitBtn = e.target.closest('#book-exit-btn');
                if (exitBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    document.body.classList.remove('book-mode-active');
                    if (container) container.remove();
                    window.location.href = exitUrl;
                    return;
                }

                var homeLink = e.target.closest('#book-toc-home-link, #book-crumb-parent');
                if (homeLink) {
                    e.preventDefault();
                    loadChapter(-1);
                    return;
                }

                var offlineAction = e.target.closest('#book-offline-cache-btn');
                if (offlineAction) {
                    e.preventDefault();
                    cacheEntireBookOffline();
                    return;
                }

                var mdBtn = e.target.closest('#book-export-md-btn');
                if (mdBtn) {
                    e.preventDefault();
                    exportCombinedMarkdown();
                    return;
                }

                var htmlBtn = e.target.closest('#book-export-html-btn');
                if (htmlBtn) {
                    e.preventDefault();
                    exportStandaloneHtml();
                    return;
                }

                var pdfBtn = e.target.closest('#book-export-pdf-btn');
                if (pdfBtn) {
                    e.preventDefault();
                    exportPdfPrint();
                    return;
                }

                var link = e.target.closest('.book-toc-link');
                if (link) {
                    var chIdx = parseInt(link.getAttribute('data-chapter-index'), 10);
                    if (!isNaN(chIdx)) {
                        e.preventDefault();
                        loadChapter(chIdx);
                        return;
                    }
                }

                var prevBtn = e.target.closest('#book-prev-btn');
                if (prevBtn) {
                    e.preventDefault();
                    if (currentChapterIndex > 0) loadChapter(currentChapterIndex - 1);
                    else if (currentChapterIndex === 0) loadChapter(-1);
                    return;
                }

                var nextBtn = e.target.closest('#book-next-btn');
                if (nextBtn) {
                    e.preventDefault();
                    if (currentChapterIndex < bookData.chapters.length - 1) loadChapter(currentChapterIndex + 1);
                    return;
                }
            });

            document.addEventListener('keydown', function(e) {
                if (!document.body.classList.contains('book-mode-active')) return;
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                if (e.key === '[') {
                    if (currentChapterIndex > 0) loadChapter(currentChapterIndex - 1);
                    else if (currentChapterIndex === 0) loadChapter(-1);
                } else if (e.key === ']') {
                    if (currentChapterIndex < bookData.chapters.length - 1) loadChapter(currentChapterIndex + 1);
                }
            });

            // Mobile touch swipe gestures for flip chapter
            var touchStartX = 0;
            var touchStartY = 0;
            container.addEventListener('touchstart', function(e) {
                if (e.touches.length === 1) {
                    touchStartX = e.touches[0].clientX;
                    touchStartY = e.touches[0].clientY;
                }
            }, { passive: true });

            container.addEventListener('touchend', function(e) {
                if (e.changedTouches.length === 1) {
                    var deltaX = e.changedTouches[0].clientX - touchStartX;
                    var deltaY = e.changedTouches[0].clientY - touchStartY;
                    if (Math.abs(deltaX) > 70 && Math.abs(deltaY) < 50) {
                        if (deltaX < 0 && currentChapterIndex < bookData.chapters.length - 1) {
                            loadChapter(currentChapterIndex + 1);
                        } else if (deltaX > 0 && currentChapterIndex > 0) {
                            loadChapter(currentChapterIndex - 1);
                        }
                    }
                }
            }, { passive: true });

            var initialIdx = 0;
            try {
                var savedIdx = parseInt(localStorage.getItem(readingProgressKey), 10);
                if (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < bookData.chapters.length) {
                    initialIdx = savedIdx;
                }
            } catch(e) {}

            loadChapter(initialIdx);
        };

        function maybeAutoStart() {
            if (window.self !== window.top || (typeof APP_STATE !== 'undefined' && (APP_STATE.isEmbed || APP_STATE.embed))) {
                return;
            }
            if (APP_STATE.autoBook) {
                window.initBookMode();
                return;
            }
            if (!APP_STATE.autoPresent || _autoStarted) return;
            _autoStarted = true;
            window.initPresentation();
        }

        // Bind present and exit buttons via event delegation
        document.addEventListener('click', function(e) {
            var exitBtn = e.target.closest('#ptb-exit, #presentation-close-btn, .presentation-tb-exit');
            if (exitBtn) {
                e.preventDefault();
                e.stopPropagation();
                window.exitPresentation();
                return;
            }
            var btn = e.target.closest('#present-btn, .publication-present-btn');
            if (btn) {
                e.preventDefault();
                window.initPresentation();
            }
            var bookBtn = e.target.closest('#editor-book-btn, .publication-book-btn');
            if (bookBtn) {
                e.preventDefault();
                window.initBookMode();
            }
        });
        maybeAutoStart();

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && document.getElementById('presentation-container') && document.getElementById('presentation-container').classList.contains('active')) {
                window.exitPresentation();
            }
        });
    })();
    \u003c/script\u003e
\u003c/body\u003e
\u003c/html\u003e
`
}
