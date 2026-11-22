/**
 * src/templates/space.js
 * Private Personal Space template (/_space) for Passkey accounts,
 * indexed notes, local-only browser drafts, guest import, and Share Circles.
 */
import { DARK_PREVIEW_THEMES, ALL_PREVIEW_THEMES } from '../constant.js'
import { safeJsonForInlineScript } from '../note_meta.js'

const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const SPACE_SECURITY_HEADERS = Object.freeze({
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
})

export const buildSpacesCirclesCsp = ({ allowTurnstile = false } = {}) => {
    const scriptSrc = allowTurnstile
        ? "script-src 'self' https://challenges.cloudflare.com"
        : "script-src 'self'"
    const connectSrc = allowTurnstile
        ? "connect-src 'self' https://challenges.cloudflare.com"
        : "connect-src 'self'"
    const frameSrc = allowTurnstile
        ? 'frame-src https://challenges.cloudflare.com'
        : "frame-src 'none'"
    return [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        connectSrc,
        frameSrc,
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
    ].join('; ')
}

export const SPACE_CSP = buildSpacesCirclesCsp({ allowTurnstile: false })
export const SPACE_TURNSTILE_CSP = buildSpacesCirclesCsp({ allowTurnstile: true })
export const SPACES_CIRCLES_CSP = SPACE_CSP

export const THEME_COLOR_TOKENS = Object.freeze({
    'ayu-light': { bg: '#fcfcfc', surface: '#ffffff', mutedBg: '#f4f6f8', border: '#e5e7eb', text: '#5c6166', muted: '#787b80', accent: '#a05600', accentText: '#ffffff', dark: false },
    'claude-canvas': { bg: '#faf8f5', surface: '#ffffff', mutedBg: '#f3efe8', border: '#e2dacd', text: '#2c2a29', muted: '#6b6965', accent: '#c8654b', accentText: '#ffffff', dark: false },
    'catppuccin-latte': { bg: '#eff1f5', surface: '#ffffff', mutedBg: '#e6e9ef', border: '#ccd0da', text: '#4c4f69', muted: '#6c6f85', accent: '#1e66f5', accentText: '#ffffff', dark: false },
    'botanical': { bg: '#f4f6f0', surface: '#fcfdf9', mutedBg: '#eaece4', border: '#d4d9cb', text: '#2d382c', muted: '#5a6658', accent: '#4c7246', accentText: '#ffffff', dark: false },
    'shopify-mint': { bg: '#f3faf6', surface: '#ffffff', mutedBg: '#e6f4ec', border: '#cce5d8', text: '#1c352d', muted: '#4b665d', accent: '#008060', accentText: '#ffffff', dark: false },
    'newsprint': { bg: '#f7f4eb', surface: '#fdfcf8', mutedBg: '#eee9dc', border: '#d8d0bf', text: '#1e1e1e', muted: '#5c5850', accent: '#8b2635', accentText: '#ffffff', dark: false },
    'notion-clean': { bg: '#ffffff', surface: '#ffffff', mutedBg: '#f7f6f3', border: '#e5e4e0', text: '#37352f', muted: '#787774', accent: '#2383e2', accentText: '#ffffff', dark: false },
    'retro': { bg: '#f4efe0', surface: '#fbf8ef', mutedBg: '#eae3ce', border: '#c7bea2', text: '#1f2430', muted: '#5a5f6b', accent: '#000080', accentText: '#ffffff', dark: false },
    'organic': { bg: '#faf5ef', surface: '#fffcf8', mutedBg: '#f1e9df', border: '#dfd2c3', text: '#3d312a', muted: '#75655b', accent: '#b85d3b', accentText: '#ffffff', dark: false },
    'green-simple': { bg: '#f6faf7', surface: '#ffffff', mutedBg: '#ebf4ee', border: '#cfe3d6', text: '#243629', muted: '#55695b', accent: '#236b3e', accentText: '#ffffff', dark: false },
    'professional': { bg: '#f8fafc', surface: '#ffffff', mutedBg: '#f1f5f9', border: '#cbd5e1', text: '#1e293b', muted: '#64748b', accent: '#1d4ed8', accentText: '#ffffff', dark: false },
    'bauhaus': { bg: '#fbf8f1', surface: '#ffffff', mutedBg: '#f2ece0', border: '#121212', text: '#1b1b18', muted: '#52524c', accent: '#c93b2b', accentText: '#ffffff', dark: false },
    'neo-brutalism': { bg: '#fffdf5', surface: '#ffffff', mutedBg: '#f9f3dc', border: '#111111', text: '#111111', muted: '#4b4b4b', accent: '#d9480f', accentText: '#ffffff', dark: false },
    'playful-geometric': { bg: '#fdf8fc', surface: '#ffffff', mutedBg: '#f7ebf4', border: '#e5cde0', text: '#2f243a', muted: '#6e5e7c', accent: '#9d174d', accentText: '#ffffff', dark: false },
    'sketch': { bg: '#fdfcf7', surface: '#ffffff', mutedBg: '#f4f1e6', border: '#cfc8b4', text: '#2b2b2b', muted: '#616161', accent: '#495057', accentText: '#ffffff', dark: false },
    'tokyo-night': { bg: '#1a1b26', surface: '#24283b', mutedBg: '#1f2335', border: '#3b4261', text: '#c0caf5', muted: '#7aa2f7', accent: '#7aa2f7', accentText: '#1a1b26', dark: true },
    'catppuccin-macchiato': { bg: '#24273a', surface: '#1e2030', mutedBg: '#363a4f', border: '#494d64', text: '#cad3f5', muted: '#a5adcb', accent: '#8aadf4', accentText: '#1e2030', dark: true },
    'terminal': { bg: '#0d1117', surface: '#161b22', mutedBg: '#21262d', border: '#30363d', text: '#c9d1d9', muted: '#8b949e', accent: '#58a6ff', accentText: '#0d1117', dark: true },
    'kanagawa': { bg: '#1f1f28', surface: '#2a2a37', mutedBg: '#16161d', border: '#54546d', text: '#dcd7ba', muted: '#a6a69c', accent: '#7e9cd8', accentText: '#1f1f28', dark: true },
    'x-ai': { bg: '#0a0b0e', surface: '#12151c', mutedBg: '#1a1e28', border: '#2a303f', text: '#e6e8ec', muted: '#9aa3b2', accent: '#a0c3ec', accentText: '#0a0b0e', dark: true },
})

export function resolveAccountPageTheme(rawTheme) {
    const candidate = typeof rawTheme === 'string' ? rawTheme.trim() : ''
    return ALL_PREVIEW_THEMES.includes(candidate) ? candidate : 'claude-canvas'
}

export function getAccountSpaceThemeCss() {
    const themeRules = ALL_PREVIEW_THEMES.map(name => {
        const t = THEME_COLOR_TOKENS[name] || THEME_COLOR_TOKENS['claude-canvas']
        return `html[data-preview-theme="${name}"] {
    --sp-bg: ${t.bg};
    --sp-surface: ${t.surface};
    --sp-surface-muted: ${t.mutedBg};
    --sp-border: ${t.border};
    --sp-text: ${t.text};
    --sp-muted: ${t.muted};
    --sp-accent: ${t.accent};
    --sp-accent-text: ${t.accentText};
    color-scheme: ${t.dark ? 'dark' : 'light'};
}`
    }).join('\n')

    return `
:root {
    --sp-bg: #faf8f5;
    --sp-surface: #ffffff;
    --sp-surface-muted: #f3efe8;
    --sp-border: #e2dacd;
    --sp-text: #2c2a29;
    --sp-muted: #6b6965;
    --sp-accent: #c8654b;
    --sp-accent-text: #ffffff;
    --sp-danger: #b83232;
    --sp-danger-bg: rgba(184, 50, 50, 0.1);
    --sp-success: #226617;
    --sp-success-bg: rgba(43, 122, 30, 0.12);
    --sp-warning: #8f4f00;
    --sp-warning-bg: rgba(217, 119, 6, 0.14);
    --sp-radius: 12px;
    --sp-shadow: 0 10px 30px rgba(20, 20, 20, 0.06);
    --sp-font: "GenJyuu Gothic CJK", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang TC", "Noto Sans TC", sans-serif;
    --sp-mono: "JetBrains Mono", "SF Mono", Consolas, Menlo, monospace;
}
${themeRules}
html[data-ui-theme="dark"] {
    --sp-bg: #131b24;
    --sp-surface: #1a2430;
    --sp-surface-muted: #222f3e;
    --sp-border: #2e3d4e;
    --sp-text: #eef1f7;
    --sp-muted: #9aa6bc;
    --sp-accent: #ffb010;
    --sp-accent-text: #131b24;
    --sp-danger: #ff7b72;
    --sp-danger-bg: rgba(248, 81, 73, 0.18);
    --sp-success: #4ade80;
    --sp-success-bg: rgba(74, 222, 128, 0.16);
    --sp-warning: #fbbf24;
    --sp-warning-bg: rgba(251, 191, 36, 0.16);
    --sp-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
    html[data-ui-theme="auto"],
    html:not([data-ui-theme]) {
        --sp-bg: #131b24;
        --sp-surface: #1a2430;
        --sp-surface-muted: #222f3e;
        --sp-border: #2e3d4e;
        --sp-text: #eef1f7;
        --sp-muted: #9aa6bc;
        --sp-accent: #ffb010;
        --sp-accent-text: #131b24;
        --sp-danger: #ff7b72;
        --sp-danger-bg: rgba(248, 81, 73, 0.18);
        --sp-success: #4ade80;
        --sp-success-bg: rgba(74, 222, 128, 0.16);
        --sp-warning: #fbbf24;
        --sp-warning-bg: rgba(251, 191, 36, 0.16);
        --sp-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
        color-scheme: dark;
    }
}
* { box-sizing: border-box; }
body {
    margin: 0;
    min-height: 100vh;
    background: var(--sp-bg);
    color: var(--sp-text);
    font-family: var(--sp-font);
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
}
a { color: var(--sp-accent); text-decoration: none; }
a:hover { text-decoration: underline; }
[hidden] { display: none !important; }
.sp-shell {
    max-width: 1120px;
    margin: 0 auto;
    padding: 20px 18px 56px;
}
.sp-topbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 18px;
    margin-bottom: 20px;
    background: var(--sp-surface);
    border: 1px solid var(--sp-border);
    border-radius: var(--sp-radius);
    box-shadow: var(--sp-shadow);
}
.sp-brand-wrap { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sp-brand-link { font-weight: 800; font-size: 16px; letter-spacing: 0.04em; color: var(--sp-text); text-decoration: none; }
.sp-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: var(--sp-surface-muted);
    border: 1px solid var(--sp-border);
    color: var(--sp-muted);
}
.sp-badge-accent { background: color-mix(in srgb, var(--sp-accent) 14%, var(--sp-surface)); color: var(--sp-accent); border-color: color-mix(in srgb, var(--sp-accent) 35%, var(--sp-border)); }
.sp-badge-warn { background: var(--sp-warning-bg); color: var(--sp-warning); border-color: color-mix(in srgb, var(--sp-warning) 35%, transparent); }
.sp-badge-danger { background: var(--sp-danger-bg); color: var(--sp-danger); border-color: color-mix(in srgb, var(--sp-danger) 35%, transparent); }
.sp-badge-success { background: var(--sp-success-bg); color: var(--sp-success); border-color: color-mix(in srgb, var(--sp-success) 35%, transparent); }
.sp-topbar-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 13px;
    border-radius: 8px;
    border: 1px solid var(--sp-border);
    background: var(--sp-surface);
    color: var(--sp-text);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
}
.sp-btn:hover:not(:disabled) { border-color: var(--sp-accent); background: var(--sp-surface-muted); }
.sp-btn:disabled { opacity: 0.52; cursor: not-allowed; }
.sp-btn-primary { background: var(--sp-accent); color: var(--sp-accent-text); border-color: var(--sp-accent); }
.sp-btn-primary:hover:not(:disabled) { filter: brightness(1.06); background: var(--sp-accent); }
.sp-btn-danger { color: var(--sp-danger); border-color: color-mix(in srgb, var(--sp-danger) 40%, var(--sp-border)); }
.sp-btn-danger:hover:not(:disabled) { background: var(--sp-danger-bg); border-color: var(--sp-danger); }
.sp-btn-sm { min-height: 30px; padding: 0 10px; font-size: 12px; }
.sp-card {
    background: var(--sp-surface);
    border: 1px solid var(--sp-border);
    border-radius: var(--sp-radius);
    padding: 20px;
    box-shadow: var(--sp-shadow);
    margin-bottom: 18px;
}
.sp-card h2, .sp-card h3 { margin: 0 0 10px; }
.sp-muted { color: var(--sp-muted); font-size: 13px; }
.sp-alert {
    padding: 12px 14px;
    border-radius: 9px;
    border: 1px solid var(--sp-border);
    background: var(--sp-surface-muted);
    font-size: 13px;
    margin-bottom: 14px;
}
.sp-alert-warn { background: var(--sp-warning-bg); border-color: color-mix(in srgb, var(--sp-warning) 35%, var(--sp-border)); color: var(--sp-warning); }
.sp-alert-danger { background: var(--sp-danger-bg); border-color: color-mix(in srgb, var(--sp-danger) 35%, var(--sp-border)); color: var(--sp-danger); }
.sp-alert-success { background: var(--sp-success-bg); border-color: color-mix(in srgb, var(--sp-success) 35%, var(--sp-border)); color: var(--sp-success); }
.sp-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; }
.sp-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.sp-field label { font-size: 13px; font-weight: 600; }
.sp-input, .sp-select {
    width: 100%;
    min-height: 38px;
    padding: 7px 11px;
    border-radius: 8px;
    border: 1px solid var(--sp-border);
    background: var(--sp-bg);
    color: var(--sp-text);
    font: inherit;
    font-size: 14px;
}
.sp-input:focus, .sp-select:focus { outline: 2px solid color-mix(in srgb, var(--sp-accent) 45%, transparent); border-color: var(--sp-accent); }
.sp-chip-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.sp-chip {
    min-height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--sp-border);
    background: var(--sp-surface);
    color: var(--sp-text);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}
.sp-chip.is-active { background: var(--sp-accent); color: var(--sp-accent-text); border-color: var(--sp-accent); }
.sp-item-list { display: grid; gap: 12px; }
.sp-item-card {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 10px;
    border: 1px solid var(--sp-border);
    background: var(--sp-bg);
}
.sp-item-card.is-masked { opacity: 0.88; border-style: dashed; }
.sp-item-main { flex: 1 1 260px; min-width: 0; }
.sp-item-title { font-weight: 700; font-size: 15px; margin: 0 0 6px; word-break: break-word; }
.sp-item-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12px; color: var(--sp-muted); }
.sp-item-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.sp-tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--sp-border); padding-bottom: 12px; }
.sp-pagination { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
.sp-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(15, 23, 42, 0.52);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
}
.sp-modal-dialog {
    width: min(640px, 100%);
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    background: var(--sp-surface);
    color: var(--sp-text);
    border: 1px solid var(--sp-border);
    border-radius: var(--sp-radius);
    padding: 20px;
    box-shadow: var(--sp-shadow);
}
.sp-modal-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.sp-modal-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
.sp-switch { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
.sp-circle-items-drawer { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--sp-border); width: 100%; }
@media (max-width: 640px) {
    .sp-shell { padding: 12px 12px 44px; }
    .sp-card { padding: 15px; }
}
`
}

function sanitizeBootstrapSpaceItem(item) {
    if (!item || typeof item !== 'object') return null
    const isMasked = item.masked === true
    const accessLevel = item.accessLevel === 'edit' && !isMasked ? 'edit' : 'share_only'
    if (isMasked) {
        return {
            masked: true,
            itemKey: String(item.itemKey || ''),
            accessLevel: 'share_only',
            title: 'Unavailable or Protected Note',
            editorFormat: null,
            protectionBadge: null,
            actions: ['remove'],
        }
    }
    const base = {
        itemKey: String(item.itemKey || ''),
        accessLevel,
        facets: Array.isArray(item.facets) ? item.facets : [],
        editorFormat: item.editorFormat || 'markdown',
        titleSummary: String(item.titleSummary || item.title || ''),
        lastActivityAt: Number(item.lastActivityAt || 0),
        shareId: item.shareId ? String(item.shareId) : '',
        protectionBadge: item.protectionBadge || null,
        isBurnProtected: item.isBurnProtected === true,
    }
    if (accessLevel === 'edit') {
        base.notePath = String(item.notePath || '')
        base.noteUid = String(item.noteUid || '')
        if (item.id) base.id = String(item.id)
    }
    return base
}

function sanitizeBootstrapCircle(circle) {
    if (!circle || typeof circle !== 'object') return null
    return {
        id: String(circle.id || ''),
        name: String(circle.name || ''),
        publicToken: String(circle.publicToken || ''),
        isEnabled: Boolean(circle.isEnabled),
        itemCount: Number(circle.itemCount || 0),
        createdAt: Number(circle.createdAt || 0),
        updatedAt: Number(circle.updatedAt || 0),
    }
}

export const Space = (data = {}) => {
    const lang = data.lang === 'en-US' ? 'en-US' : 'zh-TW'
    const isZh = lang === 'zh-TW'
    const pageTheme = resolveAccountPageTheme(data.theme || data.ext?.theme)
    const isDarkTheme = DARK_PREVIEW_THEMES.includes(pageTheme)
    const uiThemeAttr = isDarkTheme ? 'dark' : 'auto'
    const accountEnabled = data.accountEnabled !== false
    const authenticated = Boolean(data.authenticated && data.account)
    const turnstileEnabled = Boolean(data.turnstileEnabled && data.turnstileSiteKey)
    const turnstileSiteKey = turnstileEnabled ? String(data.turnstileSiteKey || '').trim() : ''

    const sanitizedAccount = authenticated
        ? {
            nickname: String(data.account?.nickname || ''),
            createdAt: Number(data.account?.createdAt || 0),
            updatedAt: Number(data.account?.updatedAt || 0),
        }
        : null

    const sanitizedItems = Array.isArray(data.items)
        ? data.items.map(sanitizeBootstrapSpaceItem).filter(Boolean)
        : []

    const sanitizedPasskeys = Array.isArray(data.passkeys)
        ? data.passkeys.map(pk => ({
            credentialId: String(pk.credentialId || ''),
            deviceLabel: String(pk.deviceLabel || ''),
            backupEligible: Boolean(pk.backupEligible),
            backupState: Boolean(pk.backupState),
            createdAt: Number(pk.createdAt || 0),
            lastUsedAt: pk.lastUsedAt ? Number(pk.lastUsedAt) : null,
        }))
        : []

    const sanitizedCircles = Array.isArray(data.circles)
        ? data.circles.map(sanitizeBootstrapCircle).filter(Boolean)
        : []

    const bootstrapPayload = {
        lang,
        pageTheme,
        accountEnabled,
        authenticated,
        account: sanitizedAccount,
        passkeys: sanitizedPasskeys,
        items: sanitizedItems,
        pagination: data.pagination || { page: 1, pageSize: 50, total: sanitizedItems.length, totalPages: 1 },
        circles: sanitizedCircles,
        turnstileEnabled,
        turnstileSiteKey,
    }

    const pageTitle = isZh ? '私人空間 My Space — DAVID888 WIKI' : 'My Space — DAVID888 WIKI'

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
    <style>${getAccountSpaceThemeCss()}</style>
    ${turnstileEnabled ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>' : ''}
</head>
<body>
    <main class="sp-shell" id="space-app">
        <header class="sp-topbar">
            <div class="sp-brand-wrap">
                <a class="sp-brand-link" href="/">DAVID888 WIKI</a>
                <span class="sp-badge sp-badge-accent" data-i18n="spaceBadge">${isZh ? '私人空間 / My Space' : 'Private My Space'}</span>
                <span id="space-account-badge" class="sp-badge" ${authenticated ? '' : 'hidden'}>${authenticated ? escapeHtml(sanitizedAccount?.nickname || '') : ''}</span>
            </div>
            <div class="sp-topbar-actions">
                <select id="space-preview-theme-select" class="sp-select" style="width:auto;min-height:34px;font-size:12px;" aria-label="${isZh ? '切換頁面主題' : 'Theme'}">
                    ${ALL_PREVIEW_THEMES.map(themeName => `<option value="${escapeHtml(themeName)}" ${themeName === pageTheme ? 'selected' : ''}>${escapeHtml(themeName)}</option>`).join('')}
                </select>
                <button type="button" id="space-ui-theme-btn" class="sp-btn sp-btn-sm">${isZh ? '深淺外觀' : 'Light / Dark'}</button>
                <button type="button" id="space-lang-btn" class="sp-btn sp-btn-sm">${isZh ? 'EN' : '繁中'}</button>
                <button type="button" id="space-logout-btn" class="sp-btn sp-btn-sm sp-btn-danger" ${authenticated ? '' : 'hidden'}>${isZh ? '登出' : 'Sign out'}</button>
            </div>
        </header>

        <div id="webview-warning-banner" class="sp-alert sp-alert-warn" role="alert" hidden>
            <strong>${isZh ? '偵測到內嵌瀏覽器 (WebView)：' : 'Embedded WebView Detected:'}</strong>
            <span>${isZh ? 'LINE / Instagram / Facebook / WeChat 等內建瀏覽器常無法使用 Passkey 註冊或登入。請複製網址並改用 Safari / Chrome 系統瀏覽器開啟。' : 'In-app browsers (LINE / Instagram / Facebook / WeChat) often block Passkey registration and sign-in. Copy this URL and open it in Safari or Chrome.'}</span>
            <div style="margin-top:8px;">
                <button type="button" id="webview-copy-url-btn" class="sp-btn sp-btn-sm">${isZh ? '複製網址以在系統瀏覽器開啟' : 'Copy URL to open in system browser'}</button>
            </div>
        </div>

        ${!accountEnabled ? `
        <section class="sp-card" id="space-disabled-notice">
            <h2>${isZh ? '帳號與私人空間目前未啟用' : 'Accounts & Personal Space Unavailable'}</h2>
            <p class="sp-muted">${isZh ? '目前部署運行於純 KV 模式或尚未完成 D1 帳號資料庫綁定，匿名筆記與分享功能仍可正常使用。' : 'This deployment is running without account D1 bindings (e.g. pure KV mode). Anonymous notes and shares continue working normally.'}</p>
            <a href="/" class="sp-btn">${isZh ? '返回首頁' : 'Back to Home'}</a>
        </section>
        ` : `
        <section id="space-auth-section" class="sp-grid-2" ${authenticated ? 'hidden' : ''}>
            <article class="sp-card">
                <h2>${isZh ? '使用 Passkey 登入' : 'Sign in with Passkey'}</h2>
                <p class="sp-muted">${isZh ? '免密碼、免信箱，直接使用裝置生物辨識或硬體金鑰登入您的私人空間。' : 'Passwordless login using your device biometrics or security key.'}</p>
                <button type="button" id="passkey-login-btn" class="sp-btn sp-btn-primary">${isZh ? '使用現有 Passkey 登入' : 'Sign in with Passkey'}</button>
            </article>

            <article class="sp-card">
                <h2>${isZh ? '建立新 Passkey 帳號' : 'Create Passkey Account'}</h2>
                <div class="sp-alert sp-alert-warn passkey-nonrecovery-warning">
                    <strong>${isZh ? '重要提醒：v1 不支援帳號找回！' : 'Important: No Account Recovery in v1'}</strong>
                    <div>${isZh ? '本系統不收集 Email、手機或第三方登入。若遺失所有已綁定的 Passkey，將無法恢復帳號存取權。建立帳號後請務必於另一台裝置或雲端鑰匙圈新增備援 Passkey。' : 'We do not collect email, phone, or SSO. If you lose all registered Passkeys, your account cannot be recovered. Please add a backup Passkey on a second device or synced keychain.'}</div>
                </div>
                <form id="passkey-register-form">
                    <div class="sp-field">
                        <label for="register-nickname">${isZh ? '顯示暱稱 (1–40 字元)' : 'Display Nickname (1–40 chars)'}</label>
                        <input id="register-nickname" name="nickname" class="sp-input" type="text" minlength="1" maxlength="40" required autocomplete="nickname" placeholder="${isZh ? '例如：David' : 'e.g. David'}" />
                    </div>
                    <div class="sp-field">
                        <label for="register-device-label">${isZh ? '裝置標籤 (選填)' : 'Device Label (Optional)'}</label>
                        <input id="register-device-label" name="deviceLabel" class="sp-input" type="text" maxlength="40" placeholder="${isZh ? '例如：MacBook Touch ID' : 'e.g. MacBook Touch ID'}" />
                    </div>
                    ${turnstileEnabled ? `<div id="space-turnstile-container" data-sitekey="${escapeHtml(turnstileSiteKey)}" style="margin-bottom:12px;"></div>` : ''}
                    <button type="submit" id="passkey-register-btn" class="sp-btn sp-btn-primary">${isZh ? '建立帳號並綁定 Passkey' : 'Create Account & Passkey'}</button>
                </form>
            </article>
        </section>

        <div id="space-auth-status" class="sp-alert" role="status" aria-live="polite" hidden></div>

        <section id="space-workspace" ${authenticated ? '' : 'hidden'}>
            <div class="sp-tabs" role="tablist">
                <button type="button" class="sp-chip is-active" data-space-tab="notes" role="tab" aria-selected="true">${isZh ? '我的筆記索引' : 'Indexed Notes'}</button>
                <button type="button" class="sp-chip" data-space-tab="circles" role="tab" aria-selected="false">${isZh ? '公開分享圈' : 'Share Circles'}</button>
                <button type="button" class="sp-chip" data-space-tab="annotations" role="tab" aria-selected="false">${isZh ? '我的批註' : 'My Annotations'}</button>
                <button type="button" class="sp-chip" data-space-tab="drafts" role="tab" aria-selected="false">${isZh ? '本機草稿 (未同步)' : 'Local Drafts'}</button>
                <button type="button" class="sp-chip" data-space-tab="security" role="tab" aria-selected="false">${isZh ? '暱稱與多裝置 Passkey' : 'Profile & Passkeys'}</button>
            </div>

            <div id="space-panel-notes" data-space-panel="notes" class="sp-card">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                    <div>
                        <h2 style="margin-bottom:2px;">${isZh ? '跨裝置私人筆記索引' : 'Personal Note Index'}</h2>
                        <p class="sp-muted" style="margin:0;">${isZh ? '僅索引您建立、編輯、收藏或批註的項目；筆記本身的閱讀鎖與編輯鎖維持不變。' : 'Indexes notes you created, edited, bookmarked, or annotated without bypassing note passwords or Seals.'}</p>
                    </div>
                    <button type="button" id="open-guest-import-btn" class="sp-btn">${isZh ? '匯入訪客分享紀錄' : 'Import Guest History'}</button>
                </div>

                <div class="sp-chip-row" id="space-facet-filters" aria-label="${isZh ? '活動分類篩選' : 'Activity facet filter'}">
                    <button type="button" class="sp-chip is-active" data-facet="all">${isZh ? '全部 / All' : 'All'}</button>
                    <button type="button" class="sp-chip" data-facet="created">${isZh ? '我建立的 / Created' : 'Created'}</button>
                    <button type="button" class="sp-chip" data-facet="edited">${isZh ? '參與編輯 / Edited' : 'Edited'}</button>
                    <button type="button" class="sp-chip" data-facet="bookmarked">${isZh ? '收藏 / Bookmarked' : 'Bookmarked'}</button>
                    <button type="button" class="sp-chip" data-facet="annotated">${isZh ? '參與批註 / Annotated' : 'Annotated'}</button>
                </div>

                <div class="sp-chip-row" id="space-format-filters" aria-label="${isZh ? '格式篩選' : 'Format filter'}">
                    <button type="button" class="sp-chip is-active" data-format="all">${isZh ? '全部格式' : 'All Formats'}</button>
                    <button type="button" class="sp-chip" data-format="markdown">Markdown</button>
                    <button type="button" class="sp-chip" data-format="block">Block</button>
                    <button type="button" class="sp-chip" data-format="canvas">Canvas</button>
                    <button type="button" class="sp-chip" data-format="whiteboard">Whiteboard</button>
                </div>

                <div id="space-items-list" class="sp-item-list"></div>
                <div id="space-pagination" class="sp-pagination" hidden>
                    <button type="button" id="space-prev-page" class="sp-btn sp-btn-sm">${isZh ? '上一頁' : 'Previous'}</button>
                    <span id="space-page-info" class="sp-muted"></span>
                    <button type="button" id="space-next-page" class="sp-btn sp-btn-sm">${isZh ? '下一頁' : 'Next'}</button>
                </div>
            </div>

            <div id="space-panel-circles" data-space-panel="circles" class="sp-card" hidden>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
                    <div>
                        <h2 style="margin-bottom:2px;">${isZh ? '公開分享圈 (Share Circles)' : 'Public Share Circles'}</h2>
                        <p class="sp-muted" style="margin:0;">${isZh ? '建立主題分享集（最多 20 個、每個最多 200 篇）。預設為關閉 (OFF)，開啟後透過專屬 /c/ 連結公開且僅收錄合格公開筆記。' : 'Organize up to 20 topic collections (max 200 items each). Circles default to OFF and only expose live public CSPRNG shares.'}</p>
                    </div>
                    <span id="space-circles-quota" class="sp-badge">0 / 20</span>
                </div>

                <form id="create-circle-form" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:16px;">
                    <div class="sp-field" style="flex:1 1 240px;margin-bottom:0;">
                        <label for="create-circle-name">${isZh ? '新分享圈名稱 (<= 80 字元)' : 'New Circle Name (<= 80 chars)'}</label>
                        <input id="create-circle-name" class="sp-input" type="text" maxlength="80" required placeholder="${isZh ? '例如：AI 研究精選' : 'e.g. AI Research Notes'}" />
                    </div>
                    <label class="sp-switch" style="min-height:38px;">
                        <input type="checkbox" id="create-circle-enabled" />
                        <span>${isZh ? '建立後立即開啟 (ON)' : 'Enable immediately (ON)'}</span>
                    </label>
                    <button type="submit" class="sp-btn sp-btn-primary">${isZh ? '建立分享圈' : 'Create Circle'}</button>
                </form>

                <div id="space-circles-list" class="sp-item-list"></div>
            </div>

            <div id="space-panel-annotations" data-space-panel="annotations" class="sp-card" hidden>
                <h2>${isZh ? '我發表的具名批註' : 'My Signed Annotations'}</h2>
                <p class="sp-muted">${isZh ? '列出您以帳號身分發表的批註，支援跨裝置刪除自己發表的單則留言。' : 'Signed annotations posted with your account. You can delete your own individual messages across devices.'}</p>
                <div id="space-annotations-list" class="sp-item-list"></div>
            </div>

            <div id="space-panel-drafts" data-space-panel="drafts" class="sp-card" hidden>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
                    <h2 style="margin:0;">${isZh ? '本機瀏覽器草稿' : 'Local Browser Drafts'}</h2>
                    <span class="sp-badge sp-badge-warn">${isZh ? '僅存本機裝置，未同步雲端' : 'Device-local only, not synced to cloud'}</span>
                </div>
                <p class="sp-muted">${isZh ? '為節省資源與保護隱私，未發布的草稿只會保留在此裝置的 IndexedDB / localStorage，不會自動上傳至雲端私人空間。' : 'Unpublished drafts remain strictly in this browser (IndexedDB / localStorage) and are never uploaded to your cloud Space until published.'}</p>
                <div id="space-local-drafts-list" class="sp-item-list"></div>
            </div>

            <div id="space-panel-security" data-space-panel="security" class="sp-grid-2" hidden>
                <article class="sp-card">
                    <h3>${isZh ? '帳號顯示暱稱' : 'Display Nickname'}</h3>
                    <p class="sp-muted">${isZh ? '變更暱稱僅套用於未來新張貼的批註，既有歷史批註將保留發布當時的暱稱快照。' : 'Nickname updates apply only to future signed annotations; historical annotations retain the snapshot recorded when posted.'}</p>
                    <form id="nickname-form" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
                        <div class="sp-field" style="flex:1 1 200px;margin-bottom:0;">
                            <label for="account-nickname">${isZh ? '暱稱 (1–40 字元)' : 'Nickname (1–40 chars)'}</label>
                            <input id="account-nickname" class="sp-input" type="text" minlength="1" maxlength="40" required value="${escapeHtml(sanitizedAccount?.nickname || '')}" />
                        </div>
                        <button type="submit" class="sp-btn sp-btn-primary">${isZh ? '儲存暱稱' : 'Save Nickname'}</button>
                    </form>
                </article>

                <article class="sp-card">
                    <h3>${isZh ? '多裝置 Passkey 金鑰管理' : 'Multi-Device Passkey Management'}</h3>
                    <div class="sp-alert sp-alert-warn">
                        ${isZh ? '新增或移除 Passkey 均需先透過現有 Passkey 完成單次 Step-up 生物辨識確認；系統強制至少保留 1 組 Passkey 且不提供信箱/手機找回。' : 'Adding or removing a Passkey requires a single-use step-up assertion from an existing Passkey. At least 1 Passkey must remain; no email/phone recovery exists.'}
                    </div>
                    <div id="passkey-list" class="sp-item-list" style="margin-bottom:14px;"></div>
                    <form id="add-passkey-form" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
                        <div class="sp-field" style="flex:1 1 200px;margin-bottom:0;">
                            <label for="add-passkey-label">${isZh ? '新裝置標籤 (選填)' : 'New Device Label (Optional)'}</label>
                            <input id="add-passkey-label" class="sp-input" type="text" maxlength="40" placeholder="${isZh ? '例如：iPhone Passkey' : 'e.g. iPhone Passkey'}" />
                        </div>
                        <button type="submit" id="add-passkey-btn" class="sp-btn sp-btn-primary">${isZh ? '驗證並新增 Passkey' : 'Verify & Add Passkey'}</button>
                    </form>
                </article>
            </div>
        </section>
        `}
    </main>

    <div id="guest-import-modal" class="sp-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="guest-import-title" aria-hidden="true" hidden>
        <div class="sp-modal-dialog">
            <div class="sp-modal-header">
                <h2 id="guest-import-title" style="margin:0;">${isZh ? '確認匯入本機訪客分享紀錄' : 'Confirm Guest Share History Import'}</h2>
                <button type="button" id="guest-import-close" class="sp-btn sp-btn-sm" aria-label="${isZh ? '關閉' : 'Close'}">✕</button>
            </div>
            <p class="sp-muted" style="margin-top:0;">${isZh ? '此步驟僅從本機 cf-notepad:share-history 讀取最多 50 筆分享連結，絕不會靜默自動匯入或上傳未發布草稿。舊版建立紀錄與瀏覽紀錄將以唯讀 (share_only) 身分加入您的私人空間。' : 'Reads up to 50 share links from local cf-notepad:share-history for confirmation. Viewed links and legacy created records import as read-only (share_only). Unpublished drafts are never uploaded.'}</p>
            <div id="guest-import-status" class="sp-alert" hidden></div>
            <div id="guest-import-preview-list" class="sp-item-list"></div>
            <div class="sp-modal-footer">
                <button type="button" id="guest-import-select-all" class="sp-btn sp-btn-sm">${isZh ? '全選可匯入項目' : 'Select Eligible'}</button>
                <button type="button" id="guest-import-cancel" class="sp-btn">${isZh ? '取消' : 'Cancel'}</button>
                <button type="button" id="guest-import-confirm" class="sp-btn sp-btn-primary" disabled>${isZh ? '確認匯入選取項目' : 'Import Selected'}</button>
            </div>
        </div>
    </div>

    <script type="application/json" id="space-bootstrap">${safeJsonForInlineScript(bootstrapPayload)}</script>
    <script type="module" src="/js/account-space.mjs"></script>
</body>
</html>`
}
