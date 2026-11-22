/**
 * src/templates/circle.js
 * Public Share Circle reading view (/c/:publicToken).
 * Strict noindex/nofollow, no-referrer, strict CSP, zero account_id/note_path leaks.
 */
import { DARK_PREVIEW_THEMES } from '../constant.js'
import { buildSpacesCirclesCsp, getAccountSpaceThemeCss, resolveAccountPageTheme } from './space.js'

const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const CIRCLE_SECURITY_HEADERS = Object.freeze({
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
})

export const CIRCLE_CSP = buildSpacesCirclesCsp({ allowTurnstile: false })
export const SPACES_CIRCLES_CSP = CIRCLE_CSP
export { buildSpacesCirclesCsp }

const FORMAT_LABELS = Object.freeze({
    markdown: 'Markdown',
    block: 'Block',
    canvas: 'Canvas',
    whiteboard: 'Whiteboard',
})

function formatTimestamp(ts, lang) {
    const num = Number(ts)
    if (!Number.isFinite(num) || num <= 0) return ''
    try {
        return new Date(num * 1000).toISOString().slice(0, 10)
    } catch {
        return ''
    }
}

function sanitizePublicCircleItem(item) {
    if (!item || typeof item !== 'object') return null
    const shareId = String(item.shareId || item.share_id || '').trim()
    if (!shareId || shareId.includes('/') || shareId.includes('..') || shareId.includes('?')) {
        return null
    }
    const rawFormat = String(item.editorFormat || item.editor_format || 'markdown').toLowerCase()
    const editorFormat = Object.prototype.hasOwnProperty.call(FORMAT_LABELS, rawFormat) ? rawFormat : 'markdown'
    const title = String(item.titleSummary || item.title_summary || item.title || '').trim() || 'Untitled Share'
    const updatedAt = Number(item.updatedAt || item.updated_at || item.lastActivityAt || item.addedAt || 0)
    return {
        shareId,
        title,
        editorFormat,
        updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
    }
}

export const Circle = (data = {}) => {
    const lang = data.lang === 'en-US' ? 'en-US' : 'zh-TW'
    const isZh = lang === 'zh-TW'
    const pageTheme = resolveAccountPageTheme(data.theme || data.ext?.theme)
    const isDarkTheme = DARK_PREVIEW_THEMES.includes(pageTheme)
    const uiThemeAttr = isDarkTheme ? 'dark' : 'auto'

    const circleName = String(data.circle?.name || (isZh ? '公開分享圈' : 'Share Circle')).trim()
    const isOwnerPreview = data.isOwnerPreview === true
    const isEnabled = data.circle?.isEnabled !== false && data.circle?.is_enabled !== 0
    const safeItems = Array.isArray(data.items)
        ? data.items.map(sanitizePublicCircleItem).filter(Boolean)
        : []

    const pageTitle = `${circleName} — DAVID888 WIKI`

    const itemCardsHtml = safeItems.length > 0
        ? safeItems.map(item => {
            const href = `/share/${encodeURIComponent(item.shareId)}`
            const dateStr = formatTimestamp(item.updatedAt, lang)
            const formatLabel = FORMAT_LABELS[item.editorFormat] || 'Markdown'
            return `
            <article class="sp-item-card cr-item-card">
                <div class="sp-item-main">
                    <h2 class="sp-item-title">
                        <a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
                    </h2>
                    <div class="sp-item-meta">
                        <span class="sp-badge">${escapeHtml(formatLabel)}</span>
                        ${dateStr ? `<span>${escapeHtml(dateStr)}</span>` : ''}
                    </div>
                </div>
                <div class="sp-item-actions">
                    <a class="sp-btn sp-btn-sm sp-btn-primary" href="${escapeHtml(href)}" rel="noopener noreferrer">${isZh ? '閱讀筆記' : 'Read Note'}</a>
                </div>
            </article>`
        }).join('')
        : `
        <div class="sp-card cr-empty-state" style="text-align:center;padding:36px 20px;">
            <p style="margin:0 0 6px;font-weight:700;font-size:16px;">${isZh ? '此分享圈目前沒有公開內容' : 'No public notes in this circle yet'}</p>
            <p class="sp-muted" style="margin:0;">${isZh ? '目前尚無符合公開條件的筆記可供瀏覽。' : 'There are currently no publicly readable notes in this collection.'}</p>
        </div>`

    return `<!DOCTYPE html>
<html lang="${isZh ? 'zh-Hant-TW' : 'en'}" data-preview-theme="${escapeHtml(pageTheme)}" data-ui-theme="${uiThemeAttr}">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="referrer" content="no-referrer" />
    <title>${escapeHtml(pageTitle)}</title>
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
    <style>${getAccountSpaceThemeCss()}
.cr-header-card { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.cr-title { margin: 0 0 4px; font-size: 24px; line-height: 1.3; }
.cr-item-card h2.sp-item-title { font-size: 16px; }
</style>
</head>
<body>
    <main class="sp-shell" id="circle-app">
        <header class="sp-topbar">
            <div class="sp-brand-wrap">
                <a class="sp-brand-link" href="/">DAVID888 WIKI</a>
                <span class="sp-badge sp-badge-accent">${isZh ? '公開分享圈 / Share Circle' : 'Share Circle'}</span>
            </div>
            <div class="sp-topbar-actions">
                <a class="sp-btn sp-btn-sm" href="/_space">${isZh ? '我的私人空間' : 'My Space'}</a>
            </div>
        </header>

        ${isOwnerPreview ? `
        <div class="sp-alert sp-alert-warn" role="status">
            <strong>${isZh ? '擁有者預覽模式：' : 'Owner Preview:'}</strong>
            <span>${isEnabled
                ? (isZh ? '此分享圈目前已開啟，下方顯示所有訪客目前可公開存取的筆記。' : 'This circle is ON. Below are the items currently visible to public visitors.')
                : (isZh ? '此分享圈目前為關閉 (OFF)，一般訪客造訪時將收到 404 回應。' : 'This circle is currently OFF. Visitors receive HTTP 404 until you enable it.')}</span>
        </div>
        ` : ''}

        <section class="sp-card cr-header-card">
            <div>
                <h1 class="cr-title">${escapeHtml(circleName)}</h1>
                <p class="sp-muted" style="margin:0;">${isZh ? `共 ${safeItems.length} 篇公開筆記` : `${safeItems.length} public note${safeItems.length === 1 ? '' : 's'}`}</p>
            </div>
        </section>

        <section class="sp-item-list" aria-label="${isZh ? '分享圈筆記列表' : 'Circle notes'}">
            ${itemCardsHtml}
        </section>
    </main>
</body>
</html>`
}
