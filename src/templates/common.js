/**
 * src/templates/common.js
 * Shared template components: SWITCHER, FOOTER, MODAL
 */
import dayjs from 'dayjs'
import { DEFAULT_PREVIEW_WIDTH, SUPPORTED_LANG, VAULT_QUICK_PRESETS } from '../constant.js'
import { THEMES } from '../theme_data.js'

const getLangText = lang => SUPPORTED_LANG[lang] || SUPPORTED_LANG['en-US']

const SECURITY_CONTROLS_RENDER = ({ lang, pw, vpw, suffix = '' }) => {
    const isZh = lang === 'zh-TW'
    const t = getLangText(lang)
    const pwStatus = pw ? (isZh ? '已設定 🔒' : 'Protected 🔒') : (isZh ? '未設定 ➔' : 'Unset ➔')
    const vpwStatus = vpw ? (isZh ? '已設定 🔒' : 'Protected 🔒') : (isZh ? '未設定 ➔' : 'Unset ➔')
    return `
        <div class="dropdown-menu-label">${isZh ? '安全與存取保護' : 'Security & Access'}</div>
        <div class="dropdown-group-card security-group-card">
            <div class="dropdown-item-control security-item-row">
                <button type="button" class="opt-button security-menu-btn opt-pw ${pw ? 'is-active' : ''}" data-type="edit" id="share-menu-edit-lock-btn${suffix}" title="${t.editLockTitle}">
                    <span class="security-menu-btn-left">
                        ${SVG_ICONS.editLock}
                        <strong>${t.editLockTitle}</strong>
                    </span>
                    <span class="security-status-pill ${pw ? 'is-active' : ''}">${pwStatus}</span>
                </button>
            </div>
            <div class="dropdown-item-control security-item-row">
                <button type="button" class="opt-button security-menu-btn opt-pw-view ${vpw ? 'is-active' : ''}" data-type="view" id="share-menu-view-lock-btn${suffix}" title="${t.readLockTitle}">
                    <span class="security-menu-btn-left">
                        ${SVG_ICONS.readLock}
                        <strong>${t.readLockTitle}</strong>
                    </span>
                    <span class="security-status-pill ${vpw ? 'is-active' : ''}">${vpwStatus}</span>
                </button>
            </div>
            <div class="dropdown-item-control vault-preset-menu-row">
                <button type="button" class="opt-button security-menu-btn open-vault-presets-modal-btn vault-presets-toolbar-btn seal-menu-trigger-btn" id="open-vault-presets-modal-btn${suffix}" title="${isZh ? 'Seal 存取控制' : 'Seal Access Control'}">
                    <span class="security-menu-btn-left">
                        ${SVG_ICONS.lock || SVG_ICONS.shieldCheck}
                        <strong>${isZh ? 'Seal 存取控制' : 'Seal Access'}</strong>
                    </span>
                    <span class="seal-status-pill share-menu-seal-status" id="share-menu-seal-status${suffix}">${isZh ? '未設定 ➔' : 'Unsealed ➔'}</span>
                </button>
            </div>
        </div>
    `
}

const VAULT_PRESETS_RENDER = (lang) => `
    <div class="dropdown-item-control vault-preset-menu-row">
        <button type="button" class="opt-button security-menu-btn open-vault-presets-modal-btn vault-presets-toolbar-btn seal-menu-trigger-btn" id="open-vault-presets-modal-btn" title="${lang === 'zh-TW' ? 'Seal 存取控制' : 'Seal Access Control'}">
            <span class="security-menu-btn-left">
                ${SVG_ICONS.lock || SVG_ICONS.shieldCheck}
                <strong>${lang === 'zh-TW' ? 'Seal 存取控制' : 'Seal Access'}</strong>
            </span>
            <span id="share-menu-seal-status" class="seal-status-pill share-menu-seal-status">${lang === 'zh-TW' ? '未設定 ➔' : 'Unsealed ➔'}</span>
        </button>
    </div>
`

const THEME_OPTION_LABELS = {
    'ayu-light': { 'zh-TW': '極簡溫暖', 'en-US': 'Minimal warmth' },
    'bauhaus': { 'zh-TW': '幾何藝術', 'en-US': 'Geometric art' },
    'botanical': { 'zh-TW': '植物圖鑑', 'en-US': 'Botanical field guide' },
    'catppuccin-latte': { 'zh-TW': '柔和亮色', 'en-US': 'Soft light' },
    'catppuccin-macchiato': { 'zh-TW': '柔和暗色', 'en-US': 'Soft dark' },
    'claude-canvas': { 'zh-TW': '人文溫暖', 'en-US': 'Warm humanist' },
    'green-simple': { 'zh-TW': '簡潔綠色', 'en-US': 'Clean green' },
    'kanagawa': { 'zh-TW': '日本墨水', 'en-US': 'Japanese ink' },
    'neo-brutalism': { 'zh-TW': '粗野主義', 'en-US': 'Neo-brutalist' },
    'newsprint': { 'zh-TW': '報紙印刷', 'en-US': 'Newsprint' },
    'notion-clean': { 'zh-TW': '極簡白板', 'en-US': 'Minimal whiteboard' },
    'organic': { 'zh-TW': '侘寂陶藝', 'en-US': 'Wabi-sabi ceramic' },
    'playful-geometric': { 'zh-TW': '活潑幾何', 'en-US': 'Playful geometry' },
    'professional': { 'zh-TW': '專業商務', 'en-US': 'Professional business' },
    'retro': { 'zh-TW': '90年代懷舊', 'en-US': '90s nostalgia' },
    'shopify-mint': { 'zh-TW': '清新薄荷', 'en-US': 'Fresh mint' },
    'sketch': { 'zh-TW': '手繪草圖', 'en-US': 'Hand-drawn sketch' },
    'terminal': { 'zh-TW': '終端暗色', 'en-US': 'Terminal dark' },
    'tokyo-night': { 'zh-TW': '東京夜景', 'en-US': 'Tokyo night' },
    'x-ai': { 'zh-TW': '科技深黑', 'en-US': 'Tech black' },
}

export const SVG_ICONS = {
    lock: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    lockOpen: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`,
    canvas: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="6" height="6" rx="1"></rect><rect x="2" y="16" width="6" height="6" rx="1"></rect><rect x="9" y="2" width="6" height="6" rx="1"></rect><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"></path><path d="M12 12V8"></path></svg>`,
    whiteboard: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h20"></path><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"></path><path d="m7 21 5-5 5 5"></path></svg>`,
    settings: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
    editLock: `<svg class="svg-icon lock-combo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="10" width="11" height="10" rx="2"></rect><path d="M6.5 10V7a3 3 0 0 1 5.5-1.7"></path><path d="m14 16 5-5a1.4 1.4 0 0 1 2 2l-5 5-2.8.8z"></path><path d="m17.5 12.5 1.5 1.5"></path></svg>`,
    readLock: `<svg class="svg-icon lock-combo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10" width="11" height="10" rx="2"></rect><path d="M6 10V7a3 3 0 0 1 5.5-1.7"></path><path d="M14.5 15s2-3 4.5-3 4.5 3 4.5 3-2 3-4.5 3-4.5-3-4.5-3z"></path><circle cx="19" cy="15" r="1.1"></circle></svg>`,
    link: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>`,
    copy: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    check: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"></path></svg>`,
    play: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>`,
    pause: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>`,
    stop: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"></rect></svg>`,
    close: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    import: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
    export: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    printer: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect width="12" height="8" x="6" y="14"></rect></svg>`,
    pdf: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>`,
    shareHistory: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`,
    history: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    more: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`,
    sparkles: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>`,
    magic: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"></path><path d="m14 7 3 3"></path><path d="M5 6v4"></path><path d="M19 14v4"></path><path d="M10 2v2"></path><path d="M7 8H3"></path><path d="M21 16h-4"></path><path d="M11 3H9"></path></svg>`,
    apiDocs: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13l3 3-3 3M16 19h-3"></path></svg>`,
    clock: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    undo: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"></path></svg>`,
    redo: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"></path><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13"></path></svg>`,
    quote: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"></path><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"></path></svg>`,
    bullet: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"></line><line x1="8" x2="21" y1="12" y2="12"></line><line x1="8" x2="21" y1="18" y2="18"></line><line x1="3" x2="3.01" y1="6" y2="6"></line><line x1="3" x2="3.01" y1="12" y2="12"></line><line x1="3" x2="3.01" y1="18" y2="18"></line></svg>`,
    task: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="m9 12 2 2 4-4"></path></svg>`,
    rule: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line></svg>`,
    table: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 9h18"></path><path d="M3 15h18"></path></svg>`,
    image: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>`,
    asset: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57a4 4 0 1 1 5.66 5.66l-8.59 8.58a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>`,
    fullscreen: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M21 8V5a2 2 0 0 0-2-2h-3"></path><path d="M3 16v3a2 2 0 0 0 2 2h3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path></svg>`,
    sun: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`,
    moon: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    eye: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    eyeOff: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"></path><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"></path><path d="M17.479 17.499A10.75 10.75 0 0 1 2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.168-4.49"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>`,
    columns: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M12 3v18"></path></svg>`,
    columns3: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18M15 3v18"></path></svg>`,
    rows: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 12h18"></path></svg>`,
    monitor: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
    mobile: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>`,
    globe: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>`,
    github: `<svg class="svg-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.48 0-.24-.01-1.02-.01-1.85-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.05A9.28 9.28 0 0 1 12 6.8c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.92.68 1.86 0 1.35-.01 2.43-.01 2.76 0 .27.18.59.69.48A10.23 10.23 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"></path></svg>`,
    save: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`,
    type: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>`,
    palette: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path></svg>`,
    width: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" y1="12" x2="3" y2="12"></line><path d="m18 15 3-3-3-3"></path><path d="m6 9-3 3 3 3"></path></svg>`,
    languages: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>`,
    install: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    bot: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>`,
    mic: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>`,
    search: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>`,
    highlighter: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h3l6-6"></path><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path></svg>`,
    alert: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    footnote: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"></path><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="14" y2="10"></line><path d="M12 18h4"></path></svg>`,
    book: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
    shieldCheck: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>`,
    shieldAlert: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>`,
    bitcoin: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042l-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893l-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042l.348-1.97M7.48 20.364l3.126-17.727"></path></svg>`,
    megaphone: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path></svg>`,
    rocket: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>`,
    gift: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"></rect><path d="M12 8v13"></path><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"></path><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 4.8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"></path></svg>`,
    scale: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"></path><path d="M7 21h10"></path><path d="M12 3v18"></path><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"></path></svg>`,
    target: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`,
    graduationCap: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"></path><path d="M22 10v6"></path><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path></svg>`,
    lifeBuoy: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"></line><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"></line></svg>`,
    key: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"></path><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"></circle></svg>`,
    math: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><path d="M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3"></path><path d="M9 11.2h5.7"></path></svg>`,
    pulse: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.48 12H2"></path></svg>`,
    plus: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`,
    chevronDown: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>`,
    chevronRight: `<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-9-6"></path></svg>`
}

const EDITOR_TOOLBAR_COMMANDS = [
    { command: 'undo', glyph: SVG_ICONS.undo, zh: '復原', en: 'Undo' },
    { command: 'redo', glyph: SVG_ICONS.redo, zh: '重做', en: 'Redo' },
    { command: 'record', glyph: SVG_ICONS.mic, zh: '開始錄音', en: 'Start recording' },
    { separator: true },
    { command: 'heading1', glyph: 'H1', zh: '一級標題', en: 'Heading 1' },
    { command: 'heading2', glyph: 'H2', zh: '二級標題', en: 'Heading 2' },
    { command: 'heading3', glyph: 'H3', zh: '三級標題', en: 'Heading 3' },
    { separator: true },
    { command: 'bold', glyph: 'B', glyphClass: 'is-bold', zh: '粗體', en: 'Bold' },
    { command: 'italic', glyph: 'I', glyphClass: 'is-italic', zh: '斜體', en: 'Italic' },
    { command: 'strike', glyph: 'S', glyphClass: 'is-strike', zh: '刪除線', en: 'Strikethrough' },
    { command: 'highlight', glyph: SVG_ICONS.highlighter, glyphClass: 'is-highlight', zh: '螢光筆高亮 (==)', en: 'Highlight (==)' },
    { command: 'color', glyph: SVG_ICONS.palette, glyphClass: 'is-color', zh: '自訂字體與背景顏色 ([color=...])', en: 'Custom Color ([color=...])' },
    { command: 'footnote', glyph: SVG_ICONS.footnote, glyphClass: 'is-footnote', zh: '插入註腳 ([^1])', en: 'Footnote ([^1])' },
    { command: 'link', glyph: SVG_ICONS.link, zh: '連結', en: 'Link' },
    { separator: true },
    { command: 'quote', glyph: SVG_ICONS.quote, zh: '引用', en: 'Quote' },
    { command: 'alert', glyph: SVG_ICONS.alert, glyphClass: 'is-alert', zh: 'GitHub 提示區塊 (> [!NOTE])', en: 'GitHub Alert (> [!NOTE])' },
    { command: 'toc', glyph: 'TOC', glyphClass: 'is-code', zh: '製作目錄', en: 'Insert table of contents' },
    { command: 'bullet', glyph: SVG_ICONS.bullet, zh: '無序清單', en: 'Bullet list' },
    { command: 'ordered', glyph: '1.', zh: '有序清單', en: 'Numbered list' },
    { command: 'task', glyph: SVG_ICONS.task, zh: '待辦清單', en: 'Task list' },
    { separator: true },
    { command: 'inlineCode', glyph: '&lt;/&gt;', glyphClass: 'is-code', zh: '行內程式碼', en: 'Inline code' },
    { command: 'codeBlock', glyph: '{ }', glyphClass: 'is-code', zh: '程式碼區塊', en: 'Code block' },
    { command: 'rule', glyph: SVG_ICONS.rule, zh: '分隔線', en: 'Horizontal rule' },
    { command: 'table', glyph: SVG_ICONS.table, glyphClass: 'is-table', zh: '插入表格', en: 'Insert table' },
    { command: 'twoColumns', glyph: SVG_ICONS.columns, zh: '二欄版面', en: 'Two-column layout' },
    { command: 'threeColumns', glyph: SVG_ICONS.columns3, zh: '三欄版面', en: 'Three-column layout' },
    { command: 'image', glyph: SVG_ICONS.image, glyphClass: 'is-image', zh: '上傳圖片', en: 'Upload image' },
    { command: 'asset', glyph: SVG_ICONS.asset, glyphClass: 'is-asset', zh: '上傳附件', en: 'Upload attachment' },
    { separator: true },
    { command: 'search', glyph: SVG_ICONS.search, glyphClass: 'is-search', zh: '搜尋與取代 (Cmd+F / Cmd+H)', en: 'Search & Replace (Cmd+F / Cmd+H)' },
    { command: 'fullscreen', glyph: SVG_ICONS.fullscreen, zh: '全螢幕編輯', en: 'Fullscreen editor' },
]

export const EDITOR_TOOLBAR = lang => {
    const isZh = lang === 'zh-TW'
    const label = isZh ? 'Markdown 編輯工具' : 'Markdown editing tools'
    return `
    <div class="markdown-editor-toolbar-wrap">
    <div class="markdown-editor-toolbar" data-markdown-toolbar data-language="${lang}" role="toolbar" aria-label="${label}">
        <button type="button" id="editor-ai-format-btn" class="markdown-toolbar-button" data-ai-action="format" data-tooltip="${isZh ? 'AI 格式化排版' : 'AI Format Document'}" title="${isZh ? 'AI 格式化排版' : 'AI Format Document'}" aria-label="${isZh ? 'AI 格式化排版' : 'AI Format Document'}"><span class="markdown-toolbar-glyph is-ai" aria-hidden="true">${SVG_ICONS.sparkles}</span></button>
        <button type="button" id="editor-ai-edit-btn" class="markdown-toolbar-button" data-ai-action="edit" data-tooltip="${isZh ? 'AI 輔助編輯' : 'AI Edit Document'}" title="${isZh ? 'AI 輔助編輯' : 'AI Edit Document'}" aria-label="${isZh ? 'AI 輔助編輯' : 'AI Edit Document'}"><span class="markdown-toolbar-glyph is-ai" aria-hidden="true">${SVG_ICONS.magic}</span></button>
        <button type="button" id="editor-ai-translate-btn" class="markdown-toolbar-button" data-ai-action="translate" data-tooltip="${isZh ? 'AI 翻譯／雙語' : 'AI Translate / Bilingual'}" title="${isZh ? 'AI 翻譯／雙語' : 'AI Translate / Bilingual'}" aria-label="${isZh ? 'AI 翻譯／雙語' : 'AI Translate / Bilingual'}"><span class="markdown-toolbar-glyph is-ai" aria-hidden="true">${SVG_ICONS.languages}</span></button>
        <span class="markdown-toolbar-separator" role="separator" aria-hidden="true"></span>
        ${EDITOR_TOOLBAR_COMMANDS.map(item => item.separator
            ? '<span class="markdown-toolbar-separator" role="separator" aria-hidden="true"></span>'
            : `<button type="button" class="markdown-toolbar-button" data-command="${item.command}" data-tooltip="${isZh ? item.zh : item.en}" title="${isZh ? item.zh : item.en}" aria-label="${isZh ? item.zh : item.en}"><span class="markdown-toolbar-glyph ${item.glyphClass || ''}" aria-hidden="true">${item.glyph}</span></button>`
        ).join('')}
    </div>
    <input id="markdown-toolbar-image-input" class="visually-hidden-file-input" type="file" accept="image/*" aria-label="${isZh ? '選擇要上傳的圖片' : 'Choose an image to upload'}">
    <input id="markdown-toolbar-asset-input" class="visually-hidden-file-input" type="file" accept="video/*,audio/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.zip,.rar,.7z" aria-label="${isZh ? '選擇要上傳的附件' : 'Choose an attachment to upload'}">
    </div>
    `
}

export const RAIL_SWITCH = ({ className = '', checked = false, checkedTitle = '', uncheckedTitle = '', checkedText, uncheckedText, ariaLabel, checkedValue, uncheckedValue, checkedIcon = '', uncheckedIcon = '', id = '', disabled = false }) => `
<button
  type="button"
  ${id ? `id="${id}"` : ''}
  class="footer-rail-switch ${className} ${checked ? 'is-checked' : ''}"
  aria-label="${ariaLabel}"
  aria-pressed="${checked ? 'true' : 'false'}"
  data-tooltip="${ariaLabel}"
  title="${ariaLabel}"
  ${checkedValue ? `data-rail-checked-value="${checkedValue}"` : ''}
  ${uncheckedValue ? `data-rail-unchecked-value="${uncheckedValue}"` : ''}
  ${disabled ? 'disabled' : ''}
>
  <span class="btn-flip-front" aria-hidden="true">
    ${uncheckedIcon ? `<span class="footer-rail-icon">${uncheckedIcon}</span>` : ''}
    <span class="footer-rail-value">${uncheckedText}</span>
  </span>
  <span class="btn-flip-back" aria-hidden="true">
    ${checkedIcon ? `<span class="footer-rail-icon">${checkedIcon}</span>` : ''}
    <span class="footer-rail-value">${checkedText}</span>
  </span>
</button>
`


// Keep the legacy export available for callers outside the footer template.
export const SWITCHER = (text, open, className = '') => `
<label class="opt-switcher ${className}">
  <input type="checkbox" ${open ? 'checked' : ''}>
  <span class="slider round"></span>
</label>
<span class="footer-control-label">${text}</span>
`

export const COPY_DROPDOWN_MENU = (lang) => {
    const isZh = lang === 'zh-TW'
    return `
        <div class="footer-control-group">
            <div class="dropdown-container copy-dropdown" id="copy-dropdown">
                <button type="button" id="copy-menu-btn" class="toolbar-icon-button dropdown-trigger copy-menu-trigger copy-md-button" data-tooltip="${isZh ? '複製內容' : 'Copy Content'}" title="${isZh ? '複製內容' : 'Copy Content'}" aria-label="${isZh ? '複製內容' : 'Copy Content'}" aria-haspopup="menu" aria-expanded="false">
                    <span class="copy-button-icon copy-button-icon-default">${SVG_ICONS.copy}</span>
                    <span class="copy-button-icon copy-button-icon-success" aria-hidden="true">${SVG_ICONS.check}</span>
                    <span class="toolbar-button-label">${isZh ? '複製' : 'Copy'}</span>
                    <span class="toolbar-button-caret" aria-hidden="true">▾</span>
                </button>
                <div class="dropdown-menu copy-dropdown-menu" role="menu">
                    <div class="dropdown-menu-label">${isZh ? '整篇內容複製到' : 'Copy Document To'}</div>
                    <button type="button" class="dropdown-item dropdown-item-rich" id="copy-all-richtext-btn" role="menuitem">
                        ${SVG_ICONS.magic}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? '一般富文字 (Rich Text)' : 'Rich Text (Formatted)'}</strong>
                            <small>${isZh ? '含樣式與表格 · 貼入 Word / Docs / Notes' : 'With styles · Paste to Word / Docs / Notes'}</small>
                        </span>
                    </button>
                    <button type="button" class="dropdown-item dropdown-item-rich" id="copy-all-md-btn" role="menuitem">
                        ${SVG_ICONS.copy}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? '純 Markdown' : 'Plain Markdown'}</strong>
                            <small>${isZh ? '乾淨原始碼 · 貼入 Obsidian / GitHub / AI' : 'Clean text · Paste to Obsidian / GitHub / AI'}</small>
                        </span>
                    </button>
                    <button type="button" class="dropdown-item dropdown-item-rich" id="copy-all-notion-btn" role="menuitem">
                        ${SVG_ICONS.task}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? 'Notion 相容格式' : 'Notion Format'}</strong>
                            <small>${isZh ? '公式相容 $$ · 自動轉換區塊與 Callout' : 'Formula $$ compatible · Paste as blocks'}</small>
                        </span>
                    </button>
                    <button type="button" class="dropdown-item dropdown-item-rich" id="copy-all-jira-btn" role="menuitem">
                        ${SVG_ICONS.rule}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? 'Jira / Confluence' : 'Jira / Confluence'}</strong>
                            <small>${isZh ? '轉換為 h1.、{code}、||標頭|| 標記' : 'Converts to h1., {code}, ||header|| markup'}</small>
                        </span>
                    </button>
                    <button type="button" class="dropdown-item dropdown-item-rich" id="copy-all-feishu-btn" role="menuitem">
                        ${SVG_ICONS.sparkles}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? '飛書 / Lark' : 'Feishu / Lark'}</strong>
                            <small>${isZh ? '相容飛書文檔結構 · 公式與表格不跑版' : 'Feishu Docs compatible · Intact formulas'}</small>
                        </span>
                    </button>
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-menu-label">${isZh ? '圖片複製' : 'Image Copy'}</div>
                    <button type="button" class="dropdown-item dropdown-item-rich" id="copy-image-btn" role="menuitem">
                        ${SVG_ICONS.image}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? '複製長圖 (Image)' : 'Copy Long Image'}</strong>
                            <small>${isZh ? '2x 高解析度複製至剪貼簿' : 'Copy 2x high-res image to clipboard'}</small>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    `
}

export const EXPORT_DROPDOWN_MENU = (lang, { includeMarkdown = true } = {}) => {
    const isZh = lang === 'zh-TW'
    return `
        <div class="footer-control-group">
            <div class="dropdown-container export-dropdown" id="export-dropdown">
                <button type="button" id="export-menu-btn" class="toolbar-icon-button dropdown-trigger export-menu-trigger" data-tooltip="${isZh ? '檔案導出' : 'File Export'}" title="${isZh ? '檔案導出' : 'File Export'}" aria-label="${isZh ? '檔案導出' : 'File Export'}" aria-haspopup="menu" aria-expanded="false">
                    ${SVG_ICONS.export}
                    <span class="toolbar-button-label">${isZh ? '匯出' : 'Export'}</span>
                    <span class="toolbar-button-caret" aria-hidden="true">▾</span>
                </button>
                <div class="dropdown-menu export-dropdown-menu" role="menu">
                    <div class="dropdown-menu-label">${isZh ? '檔案導出' : 'File Export'}</div>
                    <button type="button" class="dropdown-item dropdown-item-rich" id="export-image-btn" role="menuitem">
                        ${SVG_ICONS.image}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? '匯出長圖 (.png)' : 'Export Image (.png)'}</strong>
                            <small>${isZh ? '生成 2x 高解析度長圖' : 'Generate 2x retina long image'}</small>
                        </span>
                    </button>
                    ${includeMarkdown ? `<button type="button" class="dropdown-item dropdown-item-rich" id="export-md-btn" role="menuitem">
                        ${SVG_ICONS.editLock}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? '匯出 Markdown (.md)' : 'Export Markdown (.md)'}</strong>
                            <small>${isZh ? '下載原始 Markdown 檔案' : 'Download clean Markdown file'}</small>
                        </span>
                    </button>` : ''}
                    <button type="button" class="dropdown-item dropdown-item-rich" id="export-html-btn" role="menuitem">
                        ${SVG_ICONS.globe}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? '匯出 HTML 網頁 (.html)' : 'Export HTML (.html)'}</strong>
                            <small>${isZh ? '含排版與公式的單一離線網頁' : 'Standalone offline webpage with styles'}</small>
                        </span>
                    </button>
                    <div class="dropdown-divider"></div>
                    <div class="dropdown-menu-label">${isZh ? '列印與 PDF' : 'Print & PDF'}</div>
                    <button type="button" class="dropdown-item dropdown-item-rich" id="export-pdf-btn" role="menuitem">
                        ${SVG_ICONS.pdf}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? '直接導出 PDF (.pdf)' : 'Direct Export PDF (.pdf)'}</strong>
                            <small>${isZh ? '直接下載高解析度向量 PDF 檔案' : 'Directly download high-resolution vector PDF'}</small>
                        </span>
                    </button>
                    <button type="button" class="dropdown-item dropdown-item-rich" id="print-preview-btn" role="menuitem">
                        ${SVG_ICONS.printer}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? '瀏覽器列印預覽 (Print)' : 'Browser Print Preview'}</strong>
                            <small>${isZh ? '呼叫系統實體列印對話框' : 'Open system print dialog'}</small>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    `
}

export const THEME_DROPDOWN_MENU = (lang, currentTheme, getThemeLabel) => {
    const isZh = lang === 'zh-TW'
    const activeTheme = currentTheme || 'claude-canvas'
    return `
        <div class="footer-control-group">
            <div class="dropdown-container theme-dropdown" id="theme-dropdown">
                <button type="button" id="theme-menu-btn" class="toolbar-icon-button dropdown-trigger theme-menu-trigger" data-tooltip="${isZh ? '排版樣式' : 'Typography theme'}" title="${isZh ? '排版樣式' : 'Typography theme'}" aria-label="${isZh ? '排版樣式' : 'Typography theme'}" aria-haspopup="menu" aria-expanded="false">
                    ${SVG_ICONS.palette}
                    <span class="toolbar-button-label">${isZh ? '樣式' : 'Theme'}</span>
                </button>
                <div class="dropdown-menu theme-dropdown-menu" role="menu">
                    <div class="dropdown-menu-label">${isZh ? '排版樣式' : 'Theme Style'}</div>
                    ${Object.keys(THEMES).map(themeName => {
                        const isActive = themeName === activeTheme
                        const label = getThemeLabel(themeName)
                        return `
                            <button type="button" class="dropdown-item theme-item ${isActive ? 'is-active' : ''}" data-theme-name="${themeName}" role="menuitem">
                                <span class="theme-item-name">${label}</span>
                                ${isActive ? `<span class="theme-item-check" aria-hidden="true">✓</span>` : ''}
                            </button>
                        `
                    }).join('')}
                </div>
            </div>
        </div>
    `
}
export const WIDTH_DROPDOWN_MENU = (lang, currentWidth) => {
    const isZh = lang === 'zh-TW'
    const activeWidth = currentWidth || DEFAULT_PREVIEW_WIDTH
    const widthOptions = [
        { value: '100%', zh: '100% · 全寬', en: '100% · Full' },
        { value: '960px', zh: '960px · 緊湊', en: '960px · Compact' },
        { value: '1200px', zh: '1200px · 標準', en: '1200px · Standard' },
        { value: '1440px', zh: '1440px · 寬版', en: '1440px · Wide' },
    ]
    return `
        <div class="footer-control-group">
            <div class="dropdown-container width-dropdown" id="width-dropdown">
                <button type="button" id="width-menu-btn" class="toolbar-icon-button dropdown-trigger width-menu-trigger" data-tooltip="${isZh ? '預覽寬度' : 'Preview width'}" title="${isZh ? '預覽寬度' : 'Preview width'}" aria-label="${isZh ? '預覽寬度' : 'Preview width'}" aria-haspopup="menu" aria-expanded="false">
                    ${SVG_ICONS.width}
                    <span class="toolbar-button-label">${isZh ? '寬度' : 'Width'}</span>
                </button>
                <div class="dropdown-menu width-dropdown-menu" role="menu">
                    <div class="dropdown-menu-label">${isZh ? '預覽寬度' : 'Preview Width'}</div>
                    ${widthOptions.map(opt => {
                        const isActive = opt.value === activeWidth
                        const label = isZh ? opt.zh : opt.en
                        return `
                            <button type="button" class="dropdown-item width-item ${isActive ? 'is-active' : ''}" data-width-value="${opt.value}" role="menuitem">
                                <span class="width-item-name">${label}</span>
                                ${isActive ? `<span class="width-item-check" aria-hidden="true">✓</span>` : ''}
                            </button>
                        `
                    }).join('')}
                </div>
            </div>
        </div>
    `
}

export const TOOLBAR_PRINT_BUTTON = (lang) => {
    const isZh = lang === 'zh-TW'
    const printTitle = isZh ? '列印筆記 / 儲存 PDF (Print)' : 'Print note / Save PDF (Print)'
    return `
        <button type="button" id="toolbar-print-btn" class="toolbar-icon-button" data-tooltip="${printTitle}" title="${printTitle}" aria-label="${printTitle}">
            ${SVG_ICONS.printer}
            <span class="toolbar-button-label">${isZh ? '列印' : 'Print'}</span>
        </button>
    `
}

export const MORE_DROPDOWN_MENU = (lang, { isEdit = false } = {}) => {
    const isZh = lang === 'zh-TW'
    const moreToolsTitle = isZh ? '顯示更多工具' : 'Show more tools'
    return `
        <div class="dropdown-container more-dropdown" id="more-dropdown">
            <button type="button" class="toolbar-icon-button dropdown-trigger mobile-more-btn" id="mobile-more-btn" data-tooltip="${moreToolsTitle}" title="${moreToolsTitle}" aria-label="${moreToolsTitle}" aria-haspopup="menu" aria-expanded="false">
                ${SVG_ICONS.more}
                <span class="toolbar-button-label">${isZh ? '更多' : 'More'}</span>
                <span class="toolbar-button-caret" aria-hidden="true">▾</span>
            </button>
            <div class="dropdown-menu more-dropdown-menu" role="menu">
                <div class="dropdown-menu-label">${isZh ? '快捷工具' : 'Quick Tools'}</div>
                <button type="button" class="dropdown-item dropdown-item-rich" id="more-menu-print-btn" role="menuitem">
                    ${SVG_ICONS.printer}
                    <span class="dropdown-item-copy">
                        <strong>${isZh ? '列印筆記 / 儲存 PDF' : 'Print Note / Save PDF'}</strong>
                        <small>${isZh ? '呼叫系統列印或儲存為 PDF' : 'Print dialog or save to PDF'}</small>
                    </span>
                </button>
                <button type="button" class="dropdown-item dropdown-item-rich" id="more-menu-stats-btn" role="menuitem">
                    ${SVG_ICONS.pulse}
                    <span class="dropdown-item-copy">
                        <strong>${isZh ? '字數統計與閱讀時間' : 'Word Count & Reading Time'}</strong>
                        <small>${isZh ? '即時檢視字數、字元與段落數' : 'View words, characters, and reading time'}</small>
                    </span>
                </button>
                <div class="dropdown-divider"></div>
                <div class="dropdown-menu-label">${isZh ? '外觀與樣式' : 'Appearance & Styles'}</div>
                <button type="button" class="dropdown-item dropdown-item-rich" id="more-menu-theme-btn" role="menuitem">
                    ${SVG_ICONS.palette}
                    <span class="dropdown-item-copy">
                        <strong>${isZh ? '排版主題樣式' : 'Typography Theme'}</strong>
                        <small>${isZh ? '切換 20 種精緻排版風格' : 'Switch between 20 reading themes'}</small>
                    </span>
                </button>
                <button type="button" class="dropdown-item dropdown-item-rich" id="more-menu-font-btn" role="menuitem">
                    ${SVG_ICONS.type}
                    <span class="dropdown-item-copy">
                        <strong>${isZh ? '切換字型 (JetBrains / Maple)' : 'Switch Font'}</strong>
                        <small>${isZh ? '切換 Maple Mono 或 JetBrains Mono' : 'Toggle Maple Mono / JetBrains Mono'}</small>
                    </span>
                </button>
                <button type="button" class="dropdown-item dropdown-item-rich" id="more-menu-ui-theme-btn" role="menuitem">
                    ${SVG_ICONS.sun}
                    <span class="dropdown-item-copy">
                        <strong>${isZh ? '切換深淺外觀' : 'Toggle Dark / Light'}</strong>
                        <small>${isZh ? '切換日間明亮或夜間深色介面' : 'Switch dark or light interface mode'}</small>
                    </span>
                </button>
                ${isEdit ? `
                <button type="button" class="dropdown-item dropdown-item-rich" id="more-editor-preference-btn" role="menuitem">
                    ${SVG_ICONS.settings}
                    <span class="dropdown-item-copy">
                        <strong>${isZh ? '設定預設編輯器' : 'Set Default Editor'}</strong>
                        <small>${isZh ? '選擇 Markdown / Block / Canvas / 白板' : 'Choose Markdown / Block / Canvas / Whiteboard'}</small>
                    </span>
                </button>
                ` : ''}
                <div class="dropdown-divider"></div>
                <div class="dropdown-menu-label">${isZh ? '說明與開發者' : 'Help & Developers'}</div>
                <a class="dropdown-item dropdown-item-rich" href="/docs" target="_blank" rel="noreferrer" role="menuitem">
                    ${SVG_ICONS.book}
                    <span class="dropdown-item-copy">
                        <strong>${isZh ? '使用指南與說明' : 'User Guide & Docs'}</strong>
                        <small>${isZh ? '查閱快捷鍵、語法與進階技巧' : 'Shortcuts, syntax, and tips'}</small>
                    </span>
                </a>
                <a class="dropdown-item dropdown-item-rich" href="/docs/api" target="_blank" rel="noreferrer" role="menuitem">
                    ${SVG_ICONS.apiDocs}
                    <span class="dropdown-item-copy">
                        <strong>${isZh ? 'REST API / OpenAPI 文件' : 'REST API & OpenAPI Docs'}</strong>
                        <small>${isZh ? '開放端點規格與 Swagger 文件' : 'Endpoint specs & Swagger docs'}</small>
                    </span>
                </a>
                <a class="dropdown-item dropdown-item-rich" href="/.well-known/agent-skills/david888-wiki-publisher/SKILL.md" target="_blank" rel="noreferrer" role="menuitem">
                    ${SVG_ICONS.sparkles}
                    <span class="dropdown-item-copy">
                        <strong>Agent Skill (SKILL.md)</strong>
                        <small>${isZh ? 'AI 代理技能與發布工具規格' : 'AI Agent skill specification'}</small>
                    </span>
                </a>
                <a class="dropdown-item dropdown-item-rich" href="https://github.com/tbdavid2019/888wiki" target="_blank" rel="noreferrer" role="menuitem">
                    ${SVG_ICONS.github}
                    <span class="dropdown-item-copy">
                        <strong>GitHub 專案原始碼</strong>
                        <small>${isZh ? '開源社群與更新紀錄' : 'Open-source repository'}</small>
                    </span>
                </a>
            </div>
        </div>
    `
}

export const DEV_INFO_DROPDOWN_MENU = (lang, t = getLangText(lang)) => {
    const isZh = lang === 'zh-TW'
    const tooltipText = isZh ? '開發者與 Agent 資訊' : 'Developer & Agent info'
    return `
        <div class="dropdown-container dev-info-dropdown" id="dev-info-dropdown">
            <button type="button" id="dev-info-menu-btn" class="toolbar-icon-button dropdown-trigger dev-info-menu-trigger" data-tooltip="${tooltipText}" title="${tooltipText}" aria-label="${tooltipText}" aria-haspopup="menu" aria-expanded="false">
                ${SVG_ICONS.bot}
                <span class="toolbar-button-label">${isZh ? '開發' : 'Dev'}</span>
                <span class="toolbar-button-caret" aria-hidden="true">▾</span>
            </button>
            <div class="dropdown-menu dev-info-dropdown-menu" role="menu">
                <div class="dropdown-menu-label">${isZh ? '開發與 Agent' : 'Developer & Agent'}</div>
                <div class="dropdown-group-card">
                    <a class="dropdown-item dropdown-item-rich" target="_blank" href="https://github.com/tbdavid2019/888wiki" rel="noreferrer" role="menuitem">
                        ${SVG_ICONS.github}
                        <span class="dropdown-item-copy">
                            <strong>GitHub</strong>
                            <small>${isZh ? '開源專案原始碼與貢獻' : 'Open-source repository'}</small>
                        </span>
                    </a>
                    <a class="dropdown-item dropdown-item-rich" target="_blank" href="/.well-known/agent-skills/david888-wiki-publisher/SKILL.md" rel="noreferrer" role="menuitem">
                        ${SVG_ICONS.sparkles}
                        <span class="dropdown-item-copy">
                            <strong>${t?.skillTitle || 'Agent Skill'}</strong>
                            <small>${isZh ? 'AI 代理技能與發布工具規格' : 'AI Agent skill specification'}</small>
                        </span>
                    </a>
                    <a class="dropdown-item dropdown-item-rich" target="_blank" href="/docs/api" rel="noreferrer" role="menuitem">
                        ${SVG_ICONS.apiDocs}
                        <span class="dropdown-item-copy">
                            <strong>${t?.apiDocTitle || 'REST API / OpenAPI'}</strong>
                            <small>${isZh ? '端點規格與 Swagger 文件' : 'Endpoint specs & Swagger UI'}</small>
                        </span>
                    </a>
                </div>
                <div class="dropdown-menu-label">${isZh ? '應用程式' : 'Application'}</div>
                <div class="dropdown-group-card">
                    <button type="button" id="pwa-install-manual-btn" class="dropdown-item dropdown-item-rich pwa-install-manual-btn" onclick="window.__handlePwaInstall ? window.__handlePwaInstall(this) : (window.showToast ? window.showToast('${isZh ? 'App 安裝中...' : 'Installing App...'}') : alert('App'))" role="menuitem">
                        ${SVG_ICONS.install}
                        <span class="dropdown-item-copy">
                            <strong>${isZh ? '安裝 PWA 應用' : 'Install PWA App'}</strong>
                            <small>${isZh ? '離線可用之獨立應用' : 'Offline-ready standalone application'}</small>
                        </span>
                    </button>
                </div>
            </div>
        </div>
    `
}

export const FOOTER = ({ lang, isEdit, updateAt, pw, vpw, mode, share, shareId, path, theme, width, sharePath, noteHistoryEnabled, publicIndex, authPath, autosave, viewCount, annotationsEnabled, editorFormat = 'markdown', shareExpiresAt, shareExpiresIn = 'none', shareBurnAfterReading = false, shareMode = 'standard', shareUnlockIn = '1d', sharePulseInterval = 604800, sharePulseDueAt, sharePulseToken, shareMaxViews = 1 }) => {
    const t = getLangText(lang)
    const effectiveShareMode = (shareBurnAfterReading === true || shareMode === 'burn_after_reading' || shareMode === 'burn') ? 'burn' : (shareMode || 'standard')
    const effectiveWidth = width || DEFAULT_PREVIEW_WIDTH
    const showNoteHistory = noteHistoryEnabled === true && isEdit
    const shareFontAriaLabel = lang === 'zh-TW' ? '分享頁字型' : 'Share font'
    const jetbrainsTitle = lang === 'zh-TW' ? '切換為 JetBrains Mono' : 'Switch to JetBrains Mono'
    const mapleTitle = lang === 'zh-TW' ? '切換為 Maple Mono' : 'Switch to Maple Mono'
    const copyShareTitle = lang === 'zh-TW' ? '複製分享連結' : 'Copy share link'
    const copyPresentTitle = lang === 'zh-TW' ? '複製簡報連結' : 'Copy presentation link'
    const unpublishTitle = lang === 'zh-TW' ? '取消發布' : 'Unpublish'
    const publicIndexTitle = publicIndex === true ? t.publicIndexDisable : t.publicIndexEnable
    const isBlockEditor = isEdit && editorFormat === 'block'
    const newNoteTitle = lang === 'zh-TW' ? '新增筆記' : 'New note'
    const newMarkdownTitle = lang === 'zh-TW' ? 'Markdown 筆記' : 'Markdown note'
    const newMarkdownDescription = lang === 'zh-TW' ? '純文字編輯，適合匯入內容' : 'Plain-text editing for imported content'
    const newBlockTitle = lang === 'zh-TW' ? 'Block 筆記' : 'Block note'
    const newBlockDescription = lang === 'zh-TW' ? '拖拉區塊與 Slash 指令' : 'Drag blocks and use slash commands'
    const newCanvasTitle = lang === 'zh-TW' ? 'Canvas 畫布' : 'Canvas'
    const newCanvasDescription = lang === 'zh-TW' ? '視覺化 2D 卡片與關係線' : 'Visual 2D cards and connections'
    const newWhiteboardTitle = lang === 'zh-TW' ? 'Excalidraw 白板' : 'Whiteboard'
    const newWhiteboardDescription = lang === 'zh-TW' ? '自由手繪、線條塗鴉與便籤' : 'Freeform sketch and sticky notes'
    const createSectionTitle = lang === 'zh-TW' ? '建立筆記' : 'Create note'
    const importSectionTitle = isBlockEditor
        ? (lang === 'zh-TW' ? '匯入內容（轉成 Block）' : 'Import content (Blocks)')
        : (lang === 'zh-TW' ? '匯入內容' : 'Import content')
    const moreToolsTitle = lang === 'zh-TW' ? '顯示更多工具' : 'Show more tools'
    const safeViewCount = Number.isSafeInteger(viewCount) && viewCount >= 0 ? viewCount : null
    const formattedViewCount = safeViewCount === null ? '' : new Intl.NumberFormat(lang).format(safeViewCount)
    const viewCountText = safeViewCount === null
        ? ''
        : (lang === 'zh-TW' ? `${formattedViewCount} 次瀏覽` : `${formattedViewCount} views`)
    const getThemeLabel = themeName => {
        const description = THEME_OPTION_LABELS[themeName]?.[lang] || ''
        return description ? `${themeName} · ${description}` : themeName
    }
    return `
    <div class="footer">
        <div class="footer-sections">
            <div class="footer-section footer-section-create">
                <div class="footer-section-body">
                    <div class="footer-control-group">
                        ${!isEdit && path ? `
                            <div class="split-action-group">
                                ${authPath
                                    ? `<button type="button" id="readonly-edit-btn" class="toolbar-icon-button split-action-main" data-tooltip="${t.backToEdit}" title="${t.backToEdit}" aria-label="${t.backToEdit}">${SVG_ICONS.editLock}<span class="toolbar-button-label">${lang === 'zh-TW' ? '編輯' : 'Edit'}</span></button>`
                                    : `<a href="/${path}" class="toolbar-icon-button split-action-main readonly-edit-link" data-tooltip="${t.backToEdit}" title="${t.backToEdit}" aria-label="${t.backToEdit}">${SVG_ICONS.editLock}<span class="toolbar-button-label">${lang === 'zh-TW' ? '編輯' : 'Edit'}</span></a>`
                                }
                                <div class="dropdown-container new-note-dropdown" id="new-note-dropdown">
                                    <button type="button" id="new-note-menu-btn" class="toolbar-icon-button dropdown-trigger new-note-menu-trigger split-action-dropdown" data-tooltip="${newNoteTitle}" title="${newNoteTitle}" aria-label="${newNoteTitle}" aria-haspopup="menu" aria-expanded="false">
                                        <span class="new-note-plus" aria-hidden="true">＋</span>
                                        <span class="toolbar-button-caret" aria-hidden="true">▾</span>
                                    </button>
                                    <div class="dropdown-menu new-note-dropdown-menu" role="menu">
                                        <div class="dropdown-menu-label">${lang === 'zh-TW' ? '目前與新增' : 'Current & New'}</div>
                                        <a class="dropdown-item dropdown-item-rich" href="${authPath ? '#auth' : `/${path}`}" ${authPath ? 'onclick="document.getElementById(\'readonly-edit-btn\')?.click(); return false;"' : ''}>
                                            ${SVG_ICONS.editLock}
                                            <span class="dropdown-item-copy">
                                                <strong>${lang === 'zh-TW' ? '編輯目前這篇筆記' : 'Edit this note'}</strong>
                                                <small>${lang === 'zh-TW' ? '進入此文章的編輯模式' : 'Switch to editing mode'}</small>
                                            </span>
                                        </a>
                                        <div class="dropdown-divider"></div>
                                        <div class="dropdown-menu-label">${createSectionTitle}</div>
                                        <a id="new-markdown-note-link" class="dropdown-item dropdown-item-rich" href="/new/markdown">
                                            ${SVG_ICONS.editLock}
                                            <span class="dropdown-item-copy">
                                                <strong>${newMarkdownTitle}</strong>
                                                <small>${newMarkdownDescription}</small>
                                            </span>
                                        </a>
                                        <a id="new-block-note-link" class="dropdown-item dropdown-item-rich" href="/new/block">
                                            ${SVG_ICONS.sparkles}
                                            <span class="dropdown-item-copy">
                                                <strong>${newBlockTitle}</strong>
                                                <small>${newBlockDescription}</small>
                                            </span>
                                        </a>
                                        <a id="new-canvas-note-link" class="dropdown-item dropdown-item-rich" href="/new/canvas">
                                            ${SVG_ICONS.canvas}
                                            <span class="dropdown-item-copy">
                                                <strong>${newCanvasTitle}</strong>
                                                <small>${newCanvasDescription}</small>
                                            </span>
                                        </a>
                                        <a id="new-whiteboard-note-link" class="dropdown-item dropdown-item-rich" href="/new/whiteboard">
                                            ${SVG_ICONS.whiteboard}
                                            <span class="dropdown-item-copy">
                                                <strong>${newWhiteboardTitle}</strong>
                                                <small>${newWhiteboardDescription}</small>
                                            </span>
                                        </a>
                                        <div class="dropdown-divider"></div>
                                        <div class="dropdown-menu-label">${importSectionTitle}</div>
                                        <button type="button" id="dropdown-record-audio-btn" class="dropdown-item">${SVG_ICONS.mic}<span>${t.startRecording || (lang === 'zh-TW' ? '即時錄音' : 'Live voice recording')}</span></button>
                                        <button type="button" id="dropdown-import-audio-btn" class="dropdown-item">${SVG_ICONS.mic}<span>${t.importAudioMarkdown}</span></button>
                                        <button type="button" id="dropdown-import-audio-smart-format-btn" class="dropdown-item">${SVG_ICONS.sparkles}<span>${t.importAudioSmartFormatMarkdown}</span></button>
                                        <button type="button" id="dropdown-import-doc-btn" class="dropdown-item">${SVG_ICONS.import}<span>${t.importFileMarkdown}</span></button>
                                        <button type="button" id="dropdown-import-url-btn" class="dropdown-item">${SVG_ICONS.globe}<span>${t.importWebsiteMarkdown}</span></button>
                                        <div class="dropdown-divider"></div>
                                        <button type="button" id="editor-preference-btn" class="dropdown-item">${SVG_ICONS.settings}<span>${lang === 'zh-TW' ? '設定預設編輯器模式' : 'Set default editor mode'}</span></button>
                                    </div>
                                </div>
                            </div>
                        ` : `
                            <div class="dropdown-container new-note-dropdown" id="new-note-dropdown">
                                <button type="button" id="new-note-menu-btn" class="toolbar-icon-button dropdown-trigger new-note-menu-trigger" data-tooltip="${newNoteTitle}" title="${newNoteTitle}" aria-label="${newNoteTitle}" aria-haspopup="menu" aria-expanded="false">
                                    <span class="new-note-plus" aria-hidden="true">＋</span>
                                    <span class="toolbar-button-label">${lang === 'zh-TW' ? '新增' : 'New'}</span>
                                    <span class="toolbar-button-caret" aria-hidden="true">▾</span>
                                </button>
                                <div class="dropdown-menu new-note-dropdown-menu" role="menu">
                                    <div class="dropdown-menu-label">${createSectionTitle}</div>
                                    <a id="new-markdown-note-link" class="dropdown-item dropdown-item-rich" href="/new/markdown">
                                        ${SVG_ICONS.editLock}
                                        <span class="dropdown-item-copy">
                                            <strong>${newMarkdownTitle}</strong>
                                            <small>${newMarkdownDescription}</small>
                                        </span>
                                    </a>
                                    <a id="new-block-note-link" class="dropdown-item dropdown-item-rich" href="/new/block">
                                        ${SVG_ICONS.sparkles}
                                        <span class="dropdown-item-copy">
                                            <strong>${newBlockTitle}</strong>
                                            <small>${newBlockDescription}</small>
                                        </span>
                                    </a>
                                    <a id="new-canvas-note-link" class="dropdown-item dropdown-item-rich" href="/new/canvas">
                                        ${SVG_ICONS.canvas}
                                        <span class="dropdown-item-copy">
                                            <strong>${newCanvasTitle}</strong>
                                            <small>${newCanvasDescription}</small>
                                        </span>
                                    </a>
                                    <a id="new-whiteboard-note-link" class="dropdown-item dropdown-item-rich" href="/new/whiteboard">
                                        ${SVG_ICONS.whiteboard}
                                        <span class="dropdown-item-copy">
                                            <strong>${newWhiteboardTitle}</strong>
                                            <small>${newWhiteboardDescription}</small>
                                        </span>
                                    </a>
                                    ${!isBlockEditor ? `
                                    <div class="dropdown-divider"></div>
                                    <div class="dropdown-menu-label">${importSectionTitle}</div>
                                    <button type="button" id="dropdown-record-audio-btn" class="dropdown-item">${SVG_ICONS.mic}<span>${t.startRecording || (lang === 'zh-TW' ? '即時錄音' : 'Live voice recording')}</span></button>
                                    <button type="button" id="dropdown-import-audio-btn" class="dropdown-item">${SVG_ICONS.mic}<span>${t.importAudioMarkdown}</span></button>
                                    <button type="button" id="dropdown-import-audio-smart-format-btn" class="dropdown-item">${SVG_ICONS.sparkles}<span>${t.importAudioSmartFormatMarkdown}</span></button>
                                    <button type="button" id="dropdown-import-doc-btn" class="dropdown-item">${SVG_ICONS.import}<span>${t.importFileMarkdown}</span></button>
                                    <button type="button" id="dropdown-import-url-btn" class="dropdown-item">${SVG_ICONS.globe}<span>${t.importWebsiteMarkdown}</span></button>
                                    ` : ''}
                                    ${isBlockEditor ? `
                                    <div class="dropdown-divider"></div>
                                    <div class="dropdown-menu-label">${importSectionTitle}</div>
                                    <button type="button" id="dropdown-record-audio-btn" class="dropdown-item">${SVG_ICONS.mic}<span>${t.startRecording || (lang === 'zh-TW' ? '即時錄音' : 'Live voice recording')}</span></button>
                                    <button type="button" id="dropdown-import-audio-btn" class="dropdown-item">${SVG_ICONS.mic}<span>${t.importAudioBlock}</span></button>
                                    <button type="button" id="dropdown-import-audio-smart-format-btn" class="dropdown-item">${SVG_ICONS.sparkles}<span>${t.importAudioSmartFormatBlock}</span></button>
                                    <button type="button" id="dropdown-import-doc-btn" class="dropdown-item">${SVG_ICONS.import}<span>${t.importFileBlock}</span></button>
                                    <button type="button" id="dropdown-import-url-btn" class="dropdown-item">${SVG_ICONS.globe}<span>${t.importWebsiteBlock}</span></button>
                                    ` : ''}
                                    <div class="dropdown-divider"></div>
                                    <button type="button" id="editor-preference-btn" class="dropdown-item">${SVG_ICONS.settings}<span>${lang === 'zh-TW' ? '設定預設編輯器模式' : 'Set default editor mode'}</span></button>
                                </div>
                            </div>
                        `}
                        <input id="import-md-input" type="file" accept=".md,.markdown,text/markdown,text/plain,.doc,.docx,.docm,.odt,.rtf,.epub,.pdf,.ppt,.pps,.pot,.pptx,.pptm,.ppsx,.ppsm,.odp,.xls,.xlsx,.xlsm,.xlsb,.ods,.csv,audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac,.mp4,.opus" class="visually-hidden-file-input" aria-hidden="true">
                        <input id="import-audio-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac,.opus,.mp4,.m4v" class="visually-hidden-file-input" aria-hidden="true">
                        <input id="import-audio-smart-format-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac,.opus,.mp4,.m4v" class="visually-hidden-file-input" aria-hidden="true">
                    </div>
                </div>
            </div>
            <div class="footer-section footer-section-edit">
                <div class="footer-section-body">
                    ${isEdit ? `
                        <div class="footer-control-group">
                            <div class="dropdown-container share-dropdown" id="share-dropdown">
                                <button type="button" id="share-menu-btn" class="toolbar-icon-button dropdown-trigger share-menu-trigger opt-share ${share && shareId ? 'is-published' : ''}" data-tooltip="${lang === 'zh-TW' ? '發布與分享選項' : 'Publish & Share options'}" title="${lang === 'zh-TW' ? '發布與分享選項' : 'Publish & Share options'}" aria-label="${lang === 'zh-TW' ? '發布與分享選項' : 'Publish & Share options'}" aria-haspopup="menu" aria-expanded="false">
                                    <span class="share-button-icon">${SVG_ICONS.globe}</span>
                                    <span class="toolbar-button-label" id="share-btn-label">${share && shareId ? (lang === 'zh-TW' ? '已發布' : 'Live') : (lang === 'zh-TW' ? '發布' : 'Publish')}</span>
                                    <span class="toolbar-button-caret" aria-hidden="true">▾</span>
                                </button>
                                <div class="dropdown-menu share-dropdown-menu" role="menu">
                                    <div class="share-menu-published" ${share && shareId ? '' : 'hidden'}>
                                        <div class="dropdown-menu-label">${lang === 'zh-TW' ? '檢視閱讀模式' : 'View & Reader Modes'}</div>
                                        <div class="dropdown-group-card">
                                            <a id="share-open-link" class="dropdown-item dropdown-item-rich" href="${shareId ? '/share/' + encodeURIComponent(shareId) : '#'}" target="_blank" rel="noreferrer">
                                                ${SVG_ICONS.link}
                                                <span class="dropdown-item-copy">
                                                    <strong>${lang === 'zh-TW' ? '打開分享頁面' : 'Open Share Page'}</strong>
                                                    <small>${lang === 'zh-TW' ? '在獨立分頁檢視閱讀頁面' : 'View in new tab'}</small>
                                                </span>
                                            </a>
                                            <a id="share-present-open-link" class="dropdown-item dropdown-item-rich" href="${shareId ? '/share/' + encodeURIComponent(shareId) + '/present' : '#'}" target="_blank" rel="noreferrer">
                                                ${SVG_ICONS.play}
                                                <span class="dropdown-item-copy">
                                                    <strong>${lang === 'zh-TW' ? '打開簡報模式' : 'Open Presentation'}</strong>
                                                    <small>${lang === 'zh-TW' ? '全螢幕 Slidev 投影片' : 'Fullscreen presentation'}</small>
                                                </span>
                                            </a>
                                            <a id="share-book-open-link" class="dropdown-item dropdown-item-rich" href="${shareId ? '/share/' + encodeURIComponent(shareId) + '/book' : '#'}" target="_blank" rel="noreferrer">
                                                ${SVG_ICONS.book}
                                                <span class="dropdown-item-copy">
                                                    <strong>${lang === 'zh-TW' ? '打開書本模式' : 'Open Book Mode'}</strong>
                                                    <small>${lang === 'zh-TW' ? '章節目錄樹與翻書閱讀' : 'Sidebar TOC & Book reader'}</small>
                                                </span>
                                            </a>
                                        </div>
                                        <div class="dropdown-menu-label">${lang === 'zh-TW' ? '快速複製連結' : 'Quick Copy URLs'}</div>
                                        <div class="dropdown-group-card">
                                            <button type="button" id="copy-share-btn" class="dropdown-item dropdown-item-rich" title="${copyShareTitle}">
                                                ${SVG_ICONS.copy}
                                                <span class="dropdown-item-copy">
                                                    <strong>${copyShareTitle}</strong>
                                                    <small>${lang === 'zh-TW' ? '閱讀頁面網址' : 'Copy share URL'}</small>
                                                </span>
                                            </button>
                                            <button type="button" id="copy-present-share-btn" class="dropdown-item dropdown-item-rich" title="${copyPresentTitle}">
                                                ${SVG_ICONS.play}
                                                <span class="dropdown-item-copy">
                                                    <strong>${copyPresentTitle}</strong>
                                                    <small>${lang === 'zh-TW' ? '簡報播放網址' : 'Copy presentation URL'}</small>
                                                </span>
                                            </button>
                                            <button type="button" id="copy-book-share-btn" class="dropdown-item dropdown-item-rich" title="${lang === 'zh-TW' ? '複製書本連結' : 'Copy Book URL'}">
                                                ${SVG_ICONS.book}
                                                <span class="dropdown-item-copy">
                                                    <strong>${lang === 'zh-TW' ? '複製書本連結' : 'Copy Book URL'}</strong>
                                                    <small>${lang === 'zh-TW' ? '書本閱讀網址' : 'Copy book mode URL'}</small>
                                                </span>
                                            </button>
                                        </div>
                                        ${SECURITY_CONTROLS_RENDER({ lang, pw, vpw, suffix: '' })}
                                        <div class="dropdown-menu-label">${lang === 'zh-TW' ? '分享設定' : 'Share Settings'}</div>
                                        <div class="dropdown-group-card">
                                            <div class="dropdown-item-toggle">
                                                <span>${lang === 'zh-TW' ? '公開索引' : 'Public Index'}</span>
                                                <button type="button" id="public-index-btn" class="opt-button public-index-btn ${publicIndex === true ? 'opt-button-accent' : ''}" data-public-index="${publicIndex === true ? 'true' : 'false'}">${publicIndex === true ? t.publicIndexOn : t.publicIndexOff}</button>
                                            </div>
                                            <div class="dropdown-item-toggle">
                                                <span>${t.annotations}</span>
                                                <button
                                                    type="button"
                                                    id="annotations-enabled-btn"
                                                    class="opt-button annotations-enabled-btn ${annotationsEnabled === true ? 'opt-button-accent' : ''}"
                                                    data-annotations-enabled="${annotationsEnabled === true ? 'true' : 'false'}"
                                                    aria-pressed="${annotationsEnabled === true ? 'true' : 'false'}"
                                                    title="${annotationsEnabled === true ? t.annotationsDisable : t.annotationsEnable}"
                                                >${annotationsEnabled === true ? t.annotationsOn : t.annotationsOff}</button>
                                            </div>
                                        </div>
                                        <div class="dropdown-group-card dropdown-group-danger">
                                            <button type="button" class="dropdown-item dropdown-danger-item unpublish-btn" title="${unpublishTitle}">
                                                ${SVG_ICONS.close} <span>${unpublishTitle}</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="share-menu-unpublished" ${share && shareId ? 'hidden' : ''}>
                                        <div class="dropdown-menu-label">${lang === 'zh-TW' ? '發布選項' : 'Publish Options'}</div>
                                        <div class="dropdown-group-card">
                                            <button type="button" class="dropdown-item dropdown-item-rich share-publish-menu-btn" id="share-publish-menu-btn">
                                                ${SVG_ICONS.globe}
                                                <span class="dropdown-item-copy">
                                                    <strong>${lang === 'zh-TW' ? '發布此筆記' : 'Publish Note'}</strong>
                                                    <small>${lang === 'zh-TW' ? '產生公開閱讀與簡報連結' : 'Generate public share & presentation links'}</small>
                                                </span>
                                            </button>
                                        </div>
                                        ${SECURITY_CONTROLS_RENDER({ lang, pw, vpw, suffix: '-draft' })}
                                        <div class="dropdown-menu-label">${lang === 'zh-TW' ? '發布預設設定' : 'Publish Default Settings'}</div>
                                        <div class="dropdown-group-card">
                                            <div class="dropdown-item-toggle">
                                                <span>${lang === 'zh-TW' ? '公開索引' : 'Public Index'}</span>
                                                <button type="button" id="public-index-btn-draft" class="opt-button public-index-btn ${publicIndex === true ? 'opt-button-accent' : ''}" data-public-index="${publicIndex === true ? 'true' : 'false'}">${publicIndex === true ? t.publicIndexOn : t.publicIndexOff}</button>
                                            </div>
                                            <div class="dropdown-item-toggle">
                                                <span>${t.annotations}</span>
                                                <button
                                                    type="button"
                                                    id="annotations-enabled-btn-draft"
                                                    class="opt-button annotations-enabled-btn ${annotationsEnabled === true ? 'opt-button-accent' : ''}"
                                                    data-annotations-enabled="${annotationsEnabled === true ? 'true' : 'false'}"
                                                    aria-pressed="${annotationsEnabled === true ? 'true' : 'false'}"
                                                    title="${annotationsEnabled === true ? t.annotationsDisable : t.annotationsEnable}"
                                                >${annotationsEnabled === true ? t.annotationsOn : t.annotationsOff}</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="dropdown-container save-dropdown" id="save-dropdown">
                            <div class="save-control-group save-capsule-group" aria-label="${lang === 'zh-TW' ? '儲存設定' : 'Save settings'}">
                                <button type="button" id="sync-status-badge" class="sync-status-badge" data-status="local" data-tooltip="${lang === 'zh-TW' ? '本機已即時保存 (0ms)。點擊立即同步至雲端' : 'Saved locally (0ms). Click to sync to cloud'}" title="${lang === 'zh-TW' ? '本機已即時保存 (0ms)。點擊立即同步至雲端' : 'Saved locally (0ms). Click to sync to cloud'}" aria-label="${lang === 'zh-TW' ? '同步狀態' : 'Sync status'}">
                                    <span class="sync-status-dot"></span>
                                    <span class="sync-status-text">${lang === 'zh-TW' ? '本機已存' : 'Saved locally'}</span>
                                </button>
                                <button type="button" id="save-menu-trigger-btn" class="toolbar-icon-button dropdown-trigger save-menu-trigger" data-tooltip="${lang === 'zh-TW' ? '儲存與歷史選項' : 'Save & history options'}" title="${lang === 'zh-TW' ? '儲存與歷史選項' : 'Save & history options'}" aria-label="${lang === 'zh-TW' ? '儲存與歷史選項' : 'Save & history options'}" aria-haspopup="menu" aria-expanded="false">
                                    <span class="toolbar-button-caret" aria-hidden="true">▾</span>
                                </button>
                            </div>
                            <div class="dropdown-menu save-dropdown-menu" role="menu">
                                <div class="dropdown-menu-label">${lang === 'zh-TW' ? '儲存與同步' : 'Save & Sync'}</div>
                                <div class="dropdown-group-card">
                                    <button type="button" id="save-note-btn" class="dropdown-item dropdown-item-rich" data-tooltip="${lang === 'zh-TW' ? '儲存文章' : 'Save note'}" title="${lang === 'zh-TW' ? '儲存文章' : 'Save note'}" aria-label="${lang === 'zh-TW' ? '儲存文章' : 'Save note'}">
                                        ${SVG_ICONS.save}
                                        <span class="dropdown-item-copy">
                                            <strong>${lang === 'zh-TW' ? '立即同步至雲端' : 'Sync to Cloud Now'}</strong>
                                            <small>${lang === 'zh-TW' ? '儲存當前修改並寫入雲端' : 'Save current changes to cloud'}</small>
                                        </span>
                                        <span class="toolbar-button-label" style="display:none;">${lang === 'zh-TW' ? '儲存' : 'Save'}</span>
                                        <kbd class="dropdown-shortcut">⌘S</kbd>
                                    </button>
                                    <div class="dropdown-item-toggle">
                                        <span>${lang === 'zh-TW' ? '自動儲存 (10秒閒置)' : 'Autosave (10s idle)'}</span>
                                        ${RAIL_SWITCH({
                                            id: 'autosave-toggle', // id="autosave-toggle"
                                            className: 'autosave-rail-switch',
                                            checked: autosave !== false && share === true,
                                            disabled: share !== true,
                                            ariaLabel: lang === 'zh-TW' ? '啟用文章自動儲存' : 'Enable note autosave',
                                            checkedTitle: share ? (lang === 'zh-TW' ? '停止輸入 10 秒後自動儲存' : 'Save automatically after 10 seconds of inactivity') : (lang === 'zh-TW' ? '請先發布文章才能啟用 autosave' : 'Publish this note before enabling autosave'),
                                            uncheckedTitle: share ? (lang === 'zh-TW' ? '停止輸入 10 秒後自動儲存' : 'Save automatically after 10 seconds of inactivity') : (lang === 'zh-TW' ? '請先發布文章才能啟用 autosave' : 'Publish this note before enabling autosave'),
                                            checkedText: lang === 'zh-TW' ? '自動' : 'Auto',
                                            uncheckedText: lang === 'zh-TW' ? '手動' : 'Manual',
                                            checkedValue: 'true',
                                            uncheckedValue: 'false',
                                        })}
                                    </div>
                                </div>
                                <div class="dropdown-menu-label">${lang === 'zh-TW' ? '版本與紀錄' : 'History & Records'}</div>
                                <div class="dropdown-group-card">
                                    ${showNoteHistory ? `
                                        <button type="button" id="note-history-btn" class="toolbar-icon-button note-history-trigger dropdown-item dropdown-item-rich" data-tooltip="${t.historyTitle}" aria-haspopup="dialog" aria-expanded="false" title="${t.historyTitle}" aria-label="${t.historyTitle}">
                                            ${SVG_ICONS.history}
                                            <span class="dropdown-item-copy">
                                                <strong>${t.historyTitle}</strong>
                                                <small>${lang === 'zh-TW' ? '檢視歷史修訂版本與還原' : 'View past revisions & restore'}</small>
                                            </span>
                                            <span class="sr-only">${t.historyTitle}</span>
                                        </button>
                                    ` : ''}
                                    <button type="button" id="share-history-btn" class="toolbar-icon-button share-history-trigger dropdown-item dropdown-item-rich" data-tooltip="${t.recentSharesTitle}" title="${lang === 'zh-TW' ? '最近分享紀錄' : 'Recent shares'}" aria-label="${lang === 'zh-TW' ? '最近分享紀錄' : 'Recent shares'}" aria-haspopup="dialog" aria-expanded="false">
                                        ${SVG_ICONS.shareHistory}
                                        <span class="dropdown-item-copy">
                                            <strong>${t.recentSharesTitle}</strong>
                                            <small>${lang === 'zh-TW' ? '瀏覽本機建立過的所有發布連結' : 'Recent shares on this browser'}</small>
                                        </span>
                                        <span class="sr-only">${t.recentSharesTitle}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        ${isBlockEditor ? `
                        ${TOOLBAR_PRINT_BUTTON(lang)}
                        <button type="button" id="import-md-btn" class="toolbar-icon-button" data-tooltip="${t.importFileBlock}" title="${t.importFileBlock}" aria-label="${t.importFileBlock}">
                            ${SVG_ICONS.import}
                            <span class="toolbar-button-label">${lang === 'zh-TW' ? '匯入' : 'Import'}</span>
                        </button>
                        ${EXPORT_DROPDOWN_MENU(lang, { includeMarkdown: false })}
                        <button type="button" id="cite-edit-btn" class="toolbar-icon-button cite-edit-btn" data-tooltip="${lang === 'zh-TW' ? '引用此文章 (Cite)' : 'Cite this note'}" title="${lang === 'zh-TW' ? '引用此文章 (Cite)' : 'Cite this note'}" aria-label="${lang === 'zh-TW' ? '引用此文章 (Cite)' : 'Cite this note'}">
                            ${SVG_ICONS.quote}
                            <span class="toolbar-button-label">${lang === 'zh-TW' ? '引用' : 'Cite'}</span>
                        </button>
                        ` : ''}
                        ${!isBlockEditor ? `
                        ${TOOLBAR_PRINT_BUTTON(lang)}
                        <button type="button" id="import-md-btn" class="toolbar-icon-button" data-tooltip="${t.importMarkdown}" title="${t.importMarkdown}" aria-label="${t.importMarkdown}">
                            ${SVG_ICONS.import}
                            <span class="toolbar-button-label">${lang === 'zh-TW' ? '匯入' : 'Import'}</span>
                        </button>
                        ${EXPORT_DROPDOWN_MENU(lang)}
                        ${COPY_DROPDOWN_MENU(lang)}
                        <button type="button" id="cite-edit-btn" class="toolbar-icon-button cite-edit-btn" data-tooltip="${lang === 'zh-TW' ? '引用此文章 (Cite)' : 'Cite this note'}" title="${lang === 'zh-TW' ? '引用此文章 (Cite)' : 'Cite this note'}" aria-label="${lang === 'zh-TW' ? '引用此文章 (Cite)' : 'Cite this note'}">
                            ${SVG_ICONS.quote}
                            <span class="toolbar-button-label">${lang === 'zh-TW' ? '引用' : 'Cite'}</span>
                        </button>
                        <button type="button" id="math-format-btn" class="toolbar-icon-button math-format-trigger" data-tooltip="${lang === 'zh-TW' ? '公式複製格式' : 'Formula copy format'}" title="${lang === 'zh-TW' ? '公式複製格式' : 'Formula copy format'}" aria-label="${lang === 'zh-TW' ? '公式複製格式' : 'Formula copy format'}">
                            <span class="math-icon-badge" aria-hidden="true">${SVG_ICONS.math}</span>
                            <span class="toolbar-button-label">${lang === 'zh-TW' ? '公式' : 'Math'}</span>
                        </button>
                        <div class="footer-view-settings-group" aria-label="${lang === 'zh-TW' ? '編輯器視圖設定' : 'Editor view settings'}">
                            <div class="footer-preview-group footer-control-group">
                                ${RAIL_SWITCH({
                                    className: 'opt-mode',
                                    checked: mode === 'md',
                                    checkedTitle: lang === 'zh-TW' ? '預覽' : 'Preview',
                                    uncheckedTitle: lang === 'zh-TW' ? '預覽' : 'Preview',
                                    checkedText: lang === 'zh-TW' ? '開預覽' : 'On',
                                    uncheckedText: lang === 'zh-TW' ? '關預覽' : 'Off',
                                    ariaLabel: t.preview,
                                    checkedValue: 'md',
                                    uncheckedValue: 'plain',
                                    checkedIcon: SVG_ICONS.eye,
                                    uncheckedIcon: SVG_ICONS.eyeOff,
                                })}
                            </div>
                            ${mode === 'md' ? `
                                <div class="footer-control-group desktop-split-control">
                                    <div id="split-direction-selector">
                                        ${RAIL_SWITCH({
                                            checked: true,
                                            checkedTitle: 'Layout',
                                            uncheckedTitle: 'Layout',
                                            checkedText: lang === 'zh-TW' ? '左右' : 'Side',
                                            uncheckedText: lang === 'zh-TW' ? '上下' : 'Stack',
                                            ariaLabel: lang === 'zh-TW' ? '編輯預覽排列' : 'Editor preview layout',
                                            checkedValue: 'horizontal',
                                            uncheckedValue: 'vertical',
                                            checkedIcon: SVG_ICONS.columns,
                                            uncheckedIcon: SVG_ICONS.rows,
                                        })}
                                    </div>
                                </div>
                                <div class="footer-control-group">
                                    <div id="preview-device-selector">
                                        ${RAIL_SWITCH({
                                            className: 'preview-device-toggle',
                                            checked: true,
                                            checkedTitle: 'Device',
                                            uncheckedTitle: 'Device',
                                            checkedText: t.desktop,
                                            uncheckedText: t.mobile,
                                            ariaLabel: t.previewDevice,
                                            checkedValue: 'desktop',
                                            uncheckedValue: 'mobile',
                                            checkedIcon: SVG_ICONS.monitor,
                                            uncheckedIcon: SVG_ICONS.mobile,
                                        })}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        ` : ''}
                    ` : (path ? `
                        ${TOOLBAR_PRINT_BUTTON(lang)}
                        ${EXPORT_DROPDOWN_MENU(lang)}
                        ${COPY_DROPDOWN_MENU(lang)}
                        <button type="button" id="cite-share-btn" class="toolbar-icon-button cite-share-btn" data-tooltip="${lang === 'zh-TW' ? '引用此文章 (Cite)' : 'Cite this note'}" title="${lang === 'zh-TW' ? '引用此文章 (Cite)' : 'Cite this note'}" aria-label="${lang === 'zh-TW' ? '引用此文章 (Cite)' : 'Cite this note'}">
                            ${SVG_ICONS.quote}
                            <span class="toolbar-button-label">${lang === 'zh-TW' ? '引用' : 'Cite'}</span>
                        </button>
                        <button type="button" id="math-format-btn" class="toolbar-icon-button math-format-trigger" data-tooltip="${lang === 'zh-TW' ? '公式複製格式' : 'Formula copy format'}" title="${lang === 'zh-TW' ? '公式複製格式' : 'Formula copy format'}" aria-label="${lang === 'zh-TW' ? '公式複製格式' : 'Formula copy format'}">
                            <span class="math-icon-badge" aria-hidden="true">${SVG_ICONS.math}</span>
                            <span class="toolbar-button-label">${lang === 'zh-TW' ? '公式' : 'Math'}</span>
                        </button>
                        <button type="button" id="present-btn" class="toolbar-icon-button" data-tooltip="${t.presentTitle}" title="${t.presentTitle}" aria-label="${t.presentTitle}">
                            ${SVG_ICONS.play}
                            <span class="toolbar-button-label">${t.present}</span>
                        </button>
                        ${sharePath && shareId ? `
                        <a href="${'/share/' + encodeURIComponent(shareId) + '/book'}" id="book-mode-btn" class="toolbar-icon-button" data-tooltip="${lang === 'zh-TW' ? '書本模式' : 'Book mode'}" title="${lang === 'zh-TW' ? '書本模式' : 'Book mode'}" aria-label="${lang === 'zh-TW' ? '書本模式' : 'Book mode'}">
                            ${SVG_ICONS.book}
                            <span class="toolbar-button-label">${lang === 'zh-TW' ? '書本' : 'Book'}</span>
                        </a>
                        <button type="button" id="copy-embed-code-btn" class="toolbar-icon-button" data-tooltip="${lang === 'zh-TW' ? '嵌入分享頁' : 'Embed share page'}" title="${lang === 'zh-TW' ? '嵌入分享頁' : 'Embed share page'}" aria-label="${lang === 'zh-TW' ? '嵌入分享頁' : 'Embed share page'}">
                            ${SVG_ICONS.link}
                            <span class="toolbar-button-label">${lang === 'zh-TW' ? '嵌入' : 'Embed'}</span>
                        </button>
                        ` : ''}
                        <button type="button" id="share-history-btn" class="toolbar-icon-button share-history-trigger" data-tooltip="${t.recentSharesTitle}" title="${lang === 'zh-TW' ? '最近分享紀錄' : 'Recent shares'}" aria-label="${lang === 'zh-TW' ? '最近分享紀錄' : 'Recent shares'}" aria-haspopup="dialog" aria-expanded="false">
                            ${SVG_ICONS.shareHistory}
                            <span class="toolbar-button-label">${lang === 'zh-TW' ? '紀錄' : 'Recent'}</span>
                        </button>
                    ` : '')}
                    ${MORE_DROPDOWN_MENU(lang, { isEdit })}
                </div>
            </div>

            <div class="footer-section footer-section-appearance">
                <div class="footer-section-body">
                    ${(sharePath || isEdit) ? `
                        <div class="footer-control-group footer-toggle-control-group">
                            <div id="share-font-selector" class="share-font-toggle" role="group" aria-label="${shareFontAriaLabel}">
                                ${RAIL_SWITCH({
                                    className: 'share-font-switch',
                                    checked: true,
                                    checkedTitle: 'Font',
                                    uncheckedTitle: 'Font',
                                    checkedText: 'JB',
                                    uncheckedText: 'Maple',
                                    ariaLabel: shareFontAriaLabel,
                                    checkedValue: 'jetbrains',
                                    uncheckedValue: 'maple',
                                    checkedIcon: SVG_ICONS.type,
                                    uncheckedIcon: SVG_ICONS.type,
                                })}
                            </div>
                        </div>
                    ` : ''}
                    <div class="footer-control-group footer-toggle-control-group">
                        <div id="language-selector">
                            ${RAIL_SWITCH({
                                checked: lang === 'zh-TW',
                                checkedTitle: 'Lang',
                                uncheckedTitle: 'Lang',
                                checkedText: '中',
                                uncheckedText: 'En',
                                ariaLabel: t.language,
                                checkedValue: 'zh-TW',
                                uncheckedValue: 'en-US',
                                checkedIcon: SVG_ICONS.languages,
                                uncheckedIcon: SVG_ICONS.languages,
                            })}
                        </div>
                    </div>
                    ${!isEdit || mode === 'md' ? `
                        ${WIDTH_DROPDOWN_MENU(lang, effectiveWidth)}
                        ${THEME_DROPDOWN_MENU(lang, theme, getThemeLabel)}
                    ` : ''}
                    <button type="button" id="ui-theme-toggle-btn" class="toolbar-icon-button ui-theme-toggle-btn" data-tooltip="${lang === 'zh-TW' ? '切換介面深淺模式' : 'Toggle UI theme'}" title="${lang === 'zh-TW' ? '切換介面深淺模式' : 'Toggle UI theme'}" aria-label="${lang === 'zh-TW' ? '切換介面深淺模式' : 'Toggle UI theme'}">
                        <span class="ui-theme-icon-sun" aria-hidden="true">${SVG_ICONS.sun}</span>
                        <span class="ui-theme-icon-moon" aria-hidden="true">${SVG_ICONS.moon}</span>
                        <span class="toolbar-button-label">${lang === 'zh-TW' ? '深淺' : 'Theme'}</span>
                    </button>
                    ${sharePath ? `
                        <div id="share-analytics-hook">
                            ${safeViewCount === null ? '' : `
                                <span id="share-view-count" class="share-view-count" title="${viewCountText}" aria-label="${viewCountText}">
                                    ${SVG_ICONS.eye}
                                    <span>${viewCountText}</span>
                                </span>
                            `}
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="footer-section footer-section-info">
                <div class="footer-section-body">
                    ${DEV_INFO_DROPDOWN_MENU(lang, t)}
                </div>
            </div>
        </div>
    </div>

    <!-- 行動版 Bottom Sheet -->
    <div class="bottom-sheet" id="mobile-bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-bottom-sheet-title" aria-hidden="true">
        <div class="bottom-sheet-backdrop"></div>
        <div class="bottom-sheet-content">
            <div class="bottom-sheet-drag-handle"></div>
            <div class="bottom-sheet-header">
                <h3 id="mobile-bottom-sheet-title">${lang === 'zh-TW' ? '設定與工具' : 'Settings & Tools'}</h3>
                <button type="button" class="bottom-sheet-close-btn" aria-label="Close">
                    ${SVG_ICONS.close}
                </button>
            </div>
            <div class="bottom-sheet-body">
                <div class="bottom-sheet-section bottom-sheet-section-publish">
                    <h4 class="bottom-sheet-section-title">${lang === 'zh-TW' ? '發佈' : 'Publish'}</h4>
                    <div class="bottom-sheet-section-content"></div>
                </div>
                <div class="bottom-sheet-section bottom-sheet-section-appearance">
                    <h4 class="bottom-sheet-section-title">${lang === 'zh-TW' ? '外觀' : 'Appearance'}</h4>
                    <div class="bottom-sheet-section-content"></div>
                </div>
                <div class="bottom-sheet-section bottom-sheet-section-info">
                    <h4 class="bottom-sheet-section-title">${lang === 'zh-TW' ? '資訊' : 'Info'}</h4>
                    <div class="bottom-sheet-section-content"></div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Toast 通知容器 -->
    <div id="toast-container"></div>
`
}

export const EDITOR_PREFERENCE_MODAL = (lang, { autoOpen = false } = {}) => {
    const zh = lang === 'zh-TW'
    const title = zh ? '選擇你的編輯方式' : 'Choose your editor'
    const description = zh ? '這會決定新筆記的預設方式，隨時可於底欄設定中切換。' : 'This sets your default for new notes. You can change it anytime in settings.'
    const markdownTitle = zh ? 'Markdown 編輯器' : 'Markdown editor'
    const markdownBadge = zh ? '推薦預設' : 'Recommended'
    const markdownDescription = zh ? '純文字高效寫作，支援即時雙向預覽、數學公式與快捷語法。' : 'Fast plain-text writing with live side-by-side preview and math formulas.'
    const markdownAction = zh ? '以 Markdown 開始' : 'Start with Markdown'
    
    const blockTitle = zh ? '視覺化區塊 (Block)' : 'Visual Block editor'
    const blockBadge = zh ? 'Notion 風格' : 'Notion style'
    const blockDescription = zh ? '所見即所得排版、拖拉區塊與 Slash 斜線指令。' : 'What-you-see-is-what-you-get, drag handles, and slash commands.'
    const blockAction = zh ? '以 Block 開始' : 'Start with Block'

    const canvasTitle = zh ? 'Canvas 畫布' : 'Canvas workspace'
    const canvasBadge = zh ? '結構化圖譜' : 'Structured graph'
    const canvasDescription = zh ? '邏輯關聯圖、知識圖譜與可連線卡片。' : 'Connected cards for logic maps, knowledge graphs, and architecture diagrams.'
    const canvasAction = zh ? '以 Canvas 開始' : 'Start with Canvas'

    const whiteboardTitle = zh ? 'Whiteboard 白板' : 'Whiteboard'
    const whiteboardBadge = zh ? '自由手繪' : 'Freeform drawing'
    const whiteboardDescription = zh ? '自由畫筆、箭頭、便籤與 Excalidraw 相容白板。' : 'Freehand drawing, arrows, sticky notes, and Excalidraw compatibility.'
    const whiteboardAction = zh ? '以 Whiteboard 開始' : 'Start with Whiteboard'

    return `
<div class="modal editor-preference-modal" role="dialog" aria-modal="true" aria-labelledby="editor-preference-title" aria-describedby="editor-preference-description" aria-hidden="true" data-editor-preference-dialog${autoOpen ? ' data-editor-preference-auto-open="true"' : ''}>
    <div class="modal-mask" data-editor-preference-close></div>
    <form class="editor-preference-content" data-editor-preference-form>
        <div class="editor-preference-header-bar">
            <div class="editor-preference-lang-group" role="group" aria-label="${zh ? '切換語言 / Switch language' : 'Switch language / 切換語言'}">
                <button type="button" class="editor-pref-lang-btn ${zh ? 'is-active' : ''}" data-editor-pref-lang="zh-TW" title="繁體中文">中</button>
                <button type="button" class="editor-pref-lang-btn ${!zh ? 'is-active' : ''}" data-editor-pref-lang="en-US" title="English">En</button>
            </div>
            ${autoOpen ? '' : `<button type="button" class="close-btn editor-preference-close" data-editor-preference-close aria-label="${zh ? '關閉' : 'Close'}">×</button>`}
        </div>
        <h2 id="editor-preference-title" data-i18n-key="title">${title}</h2>
        <p id="editor-preference-description" data-i18n-key="description">${description}</p>
        <fieldset class="editor-preference-options editor-preference-grid">
            <legend class="sr-only" data-i18n-key="title">${title}</legend>
            <label class="editor-preference-option is-selected is-recommended" data-editor-card="markdown">
                <input type="radio" name="editor-format" value="markdown" checked>
                <span class="editor-preference-copy">
                    <span class="editor-preference-header">
                        <strong data-i18n-key="markdownTitle">${markdownTitle}</strong>
                        <span class="editor-preference-badge editor-preference-badge-accent" data-i18n-key="markdownBadge">${markdownBadge}</span>
                    </span>
                    <small data-i18n-key="markdownDescription">${markdownDescription}</small>
                    <button type="button" class="opt-button opt-button-accent editor-card-action" data-editor-format-choice="markdown" data-i18n-key="markdownAction">${markdownAction}</button>
                </span>
            </label>
            <label class="editor-preference-option" data-editor-card="block">
                <input type="radio" name="editor-format" value="block">
                <span class="editor-preference-copy">
                    <span class="editor-preference-header">
                        <strong data-i18n-key="blockTitle">${blockTitle}</strong>
                        <span class="editor-preference-badge" data-i18n-key="blockBadge">${blockBadge}</span>
                    </span>
                    <small data-i18n-key="blockDescription">${blockDescription}</small>
                    <button type="button" class="opt-button editor-card-action" data-editor-format-choice="block" data-i18n-key="blockAction">${blockAction}</button>
                </span>
            </label>
            <label class="editor-preference-option" data-editor-card="canvas">
                <input type="radio" name="editor-format" value="canvas">
                <span class="editor-preference-copy">
                    <span class="editor-preference-header">
                        <strong data-i18n-key="canvasTitle">${canvasTitle}</strong>
                        <span class="editor-preference-badge" data-i18n-key="canvasBadge">${canvasBadge}</span>
                    </span>
                    <small data-i18n-key="canvasDescription">${canvasDescription}</small>
                    <button type="button" class="opt-button editor-card-action" data-editor-format-choice="canvas" data-i18n-key="canvasAction">${canvasAction}</button>
                </span>
            </label>
            <label class="editor-preference-option" data-editor-card="whiteboard">
                <input type="radio" name="editor-format" value="whiteboard">
                <span class="editor-preference-copy">
                    <span class="editor-preference-header">
                        <strong data-i18n-key="whiteboardTitle">${whiteboardTitle}</strong>
                        <span class="editor-preference-badge" data-i18n-key="whiteboardBadge">${whiteboardBadge}</span>
                    </span>
                    <small data-i18n-key="whiteboardDescription">${whiteboardDescription}</small>
                    <button type="button" class="opt-button editor-card-action" data-editor-format-choice="whiteboard" data-i18n-key="whiteboardAction">${whiteboardAction}</button>
                </span>
            </label>
        </fieldset>
        <label class="editor-preference-remember"><input type="checkbox" data-editor-preference-remember><span data-i18n-key="remember">${zh ? '記住我的選擇' : 'Remember my choice'}</span></label>
        <div class="editor-preference-actions">
            ${autoOpen ? '' : `<button type="button" class="opt-button" data-editor-preference-close data-i18n-key="cancel">${zh ? '取消' : 'Cancel'}</button>`}
            <button type="submit" class="opt-button opt-button-accent" data-editor-preference-confirm data-i18n-key="confirm">${zh ? '確定' : 'Save'}</button>
        </div>
    </form>
</div>`
}

export const MATH_FORMAT_MODAL = (lang) => {
    const zh = lang === 'zh-TW'
    const title = zh ? '公式複製格式' : 'Formula Copy Format'
    const description = zh ? '選擇點擊 KaTeX 數學公式時預設複製的格式' : 'Choose default format when clicking a KaTeX formula'
    
    const autoTitle = zh ? '自動判斷' : 'Auto Detect'
    const autoDesc = zh ? '行內公式含 $，獨立區塊含 $$ · 智慧相容多數編輯器' : 'Inline with $, display with $$ · Universal compatibility'

    const latexTitle = 'LaTeX (含 $)'
    const latexDesc = zh ? '一律包含 $ 或 $$ · 適合 Markdown 筆記、論文寫作、LaTeX 編輯器' : 'Always with $ delimiters · For Markdown notes and LaTeX editors'

    const plainTitle = zh ? 'LaTeX 純文字' : 'LaTeX Plain'
    const plainDesc = zh ? '乾淨原始碼 (無 $) · 適合 Desmos、WolframAlpha 等計算工具' : 'Raw formula without $ · For Desmos, WolframAlpha, and math tools'

    const notionTitle = zh ? 'Notion (雙 $)' : 'Notion ($$)'
    const notionDesc = zh ? '一律使用 $$...$$ · 適合直接貼入 Notion 行內或區塊公式' : 'Always uses $$...$$ · For Notion inline or block equations'

    const mathmlTitle = 'MathML (Word)'
    const mathmlDesc = zh ? 'XML 結構 · 直接貼入 Microsoft Word 轉為原生公式物件' : 'XML format · Paste directly into Microsoft Word as native equation'

    const pngTitle = zh ? '圖片 PNG' : 'Image PNG'
    const pngDesc = zh ? '2x 高解析透明 PNG 圖片 · 貼入不支援 LaTeX 的通訊與辦公軟體' : '2x high-res PNG image · Paste into apps without LaTeX support'

    const svgTitle = zh ? 'SVG (進階)' : 'SVG Vector'
    const svgDesc = zh ? '乾淨向量 SVG 原始碼 · 適合 Illustrator、Figma 與網頁設計' : 'Clean vector SVG markup · For Illustrator, Figma, and web design'

    return `
<div id="math-format-modal" class="modal math-format-modal" role="dialog" aria-modal="true" aria-labelledby="math-format-title" aria-describedby="math-format-description" aria-hidden="true" style="display:none;">
    <div class="modal-mask" id="math-format-mask" data-modal-close></div>
    <form class="editor-preference-content math-format-content" id="math-format-form">
        <button type="button" class="close-btn editor-preference-close" id="math-format-close-btn" data-modal-close aria-label="${zh ? '關閉' : 'Close'}">×</button>
        <h2 id="math-format-title" style="display:flex; align-items:center; gap:8px;">
            <span class="math-icon-badge" aria-hidden="true" style="font-weight:700;font-style:italic;font-family:serif;font-size:18px;color:var(--toolbar-accent,#c8654b);">fx</span>
            <span>${title}</span>
        </h2>
        <p id="math-format-description">${description}</p>
        <fieldset class="editor-preference-options">
            <legend class="sr-only">${title}</legend>
            <label class="editor-preference-option is-selected" data-math-option="auto">
                <input type="radio" name="math-copy-format" value="auto" checked>
                <span><strong>${autoTitle}</strong><small>${autoDesc}</small></span>
            </label>
            <label class="editor-preference-option" data-math-option="latex">
                <input type="radio" name="math-copy-format" value="latex">
                <span><strong>${latexTitle}</strong><small>${latexDesc}</small></span>
            </label>
            <label class="editor-preference-option" data-math-option="latex-plain">
                <input type="radio" name="math-copy-format" value="latex-plain">
                <span><strong>${plainTitle}</strong><small>${plainDesc}</small></span>
            </label>
            <label class="editor-preference-option" data-math-option="notion">
                <input type="radio" name="math-copy-format" value="notion">
                <span><strong>${notionTitle}</strong><small>${notionDesc}</small></span>
            </label>
            <label class="editor-preference-option" data-math-option="mathml">
                <input type="radio" name="math-copy-format" value="mathml">
                <span><strong>${mathmlTitle}</strong><small>${mathmlDesc}</small></span>
            </label>
            <label class="editor-preference-option" data-math-option="png">
                <input type="radio" name="math-copy-format" value="png">
                <span><strong>${pngTitle}</strong><small>${pngDesc}</small></span>
            </label>
            <label class="editor-preference-option" data-math-option="svg">
                <input type="radio" name="math-copy-format" value="svg">
                <span><strong>${svgTitle}</strong><small>${svgDesc}</small></span>
            </label>
        </fieldset>
        <div class="editor-preference-actions">
            <button type="button" class="opt-button" id="math-format-cancel-btn" data-modal-close>${zh ? '取消' : 'Cancel'}</button>
            <button type="submit" class="opt-button opt-button-accent" id="math-format-confirm-btn">${zh ? '儲存設定' : 'Save'}</button>
        </div>
    </form>
</div>`
}

export const URL_IMPORT_MODAL = (lang) => {
    const zh = lang === 'zh-TW'
    const title = zh ? '從網址匯入筆記 (URL 轉 Markdown)' : 'Import Note from URL'
    const desc = zh ? '貼上任意網頁網址，系統將自動解析文章內容並轉換為乾淨的 Markdown 格式。' : 'Paste any web page URL to convert its content into clean Markdown format.'
    const placeholder = 'https://example.com/article'
    const cancelText = zh ? '取消' : 'Cancel'
    const submitText = zh ? '開始擷取' : 'Fetch & Convert'
    return `
<div id="url-import-modal" class="modal url-import-modal" role="dialog" aria-modal="true" aria-labelledby="url-import-title" aria-hidden="true" style="display:none;">
    <div class="modal-mask" id="url-import-mask" data-modal-close></div>
    <div class="url-import-modal-content">
        <button type="button" class="close-btn" id="url-import-close-btn" data-modal-close aria-label="${zh ? '關閉' : 'Close'}">×</button>
        <h3 id="url-import-title" class="url-import-modal-title">
            ${SVG_ICONS.globe} <span>${title}</span>
        </h3>
        <p class="url-import-modal-desc">${desc}</p>
        <form id="url-import-form">
            <div style="margin-bottom: 14px;">
                <input type="url" id="url-import-input" class="url-import-input-field" placeholder="${placeholder}" required />
            </div>
            <div id="url-import-status" style="margin-bottom: 14px; font-size: 0.88rem; display: none; padding: 8px 12px; border-radius: 6px;"></div>
            <div class="url-import-actions">
                <button type="button" class="opt-button" id="url-import-cancel-btn" data-modal-close>${cancelText}</button>
                <button type="submit" class="opt-button opt-button-accent" id="url-import-submit-btn">${submitText}</button>
            </div>
        </form>
    </div>
</div>`
}

export const MODAL = (lang, { noteHistoryEnabled = false } = {}) => {
    const t = getLangText(lang)
    const showNoteHistory = noteHistoryEnabled === true
    const closeLabel = lang === 'zh-TW' ? '關閉' : 'Close'
    return `
<div class="modal share-modal" role="dialog" aria-modal="true" aria-label="${lang === 'zh-TW' ? '分享連結' : 'Share link'}" aria-hidden="true">
    <div class="modal-mask" data-modal-close></div>
    <div class="modal-content">
        <button type="button" class="close-btn share-modal-close" data-modal-close aria-label="${closeLabel}">×</button>
        <div class="modal-body">
            <input type="text" readonly value="" />
            <button class="opt-button share-modal-copy-btn">${SVG_ICONS.copy} <span>${t.copy}</span></button>
        </div>
</div>
</div>
<div class="modal share-history-modal" role="dialog" aria-modal="true" aria-labelledby="share-history-title" aria-hidden="true">
    <div class="modal-mask" data-modal-close></div>
    <div class="share-history-content">
        <button type="button" class="close-btn share-history-close" data-modal-close aria-label="${closeLabel}">×</button>
        <h2 id="share-history-title">${lang === 'zh-TW' ? '最近分享紀錄' : 'Recent Share Links'}</h2>
        <div class="share-history-tabs" role="tablist">
            <button type="button" class="share-history-tab active" data-share-history-tab="created" aria-selected="true">${lang === 'zh-TW' ? '我分享的' : 'Created'}</button>
            <button type="button" class="share-history-tab" data-share-history-tab="viewed" aria-selected="false">${lang === 'zh-TW' ? '我看過的' : 'Viewed'}</button>
        </div>
        <div class="share-history-list" data-share-history-list></div>
</div>
</div>
<div class="modal embed-modal" role="dialog" aria-modal="true" aria-labelledby="embed-modal-title" aria-hidden="true">
    <div class="modal-mask" data-modal-close></div>
    <div class="embed-modal-content">
        <button type="button" class="close-btn embed-modal-close" data-modal-close aria-label="${closeLabel}">×</button>
        <h2 id="embed-modal-title">${lang === 'zh-TW' ? '嵌入分享頁' : 'Embed share page'}</h2>
        <p>${lang === 'zh-TW' ? '將以下 iframe 程式碼貼到你的網站即可嵌入此分享頁。' : 'Copy this iframe code into your website to embed this shared page.'}</p>
        <textarea class="embed-modal-code" readonly spellcheck="false" aria-label="${lang === 'zh-TW' ? '嵌入程式碼' : 'Embed code'}"></textarea>
        <button type="button" class="opt-button opt-button-accent embed-modal-copy-btn">${SVG_ICONS.copy} <span>${t.copy}</span></button>
    </div>
</div>
<div class="modal password-modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title" aria-hidden="true">
    <div class="modal-mask" data-modal-close></div>
    <div class="password-modal-content">
        <form class="password-modal-form" novalidate>
            <button type="button" class="close-btn password-modal-close" data-modal-close aria-label="${t.passwordCancel || closeLabel}">×</button>
            <h2 id="password-modal-title"></h2>
            <p class="password-modal-message"></p>
            <input type="password" class="password-modal-input" autocomplete="current-password" />
            <div class="password-modal-actions">
                <button type="button" class="opt-button password-modal-cancel">${t.passwordCancel}</button>
                <button type="submit" class="opt-button opt-button-accent password-modal-confirm">${t.passwordConfirm}</button>
            </div>
        </form>
    </div>
</div>
<div class="modal app-dialog-modal" role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message" aria-hidden="true">
    <div class="modal-mask" data-modal-close></div>
    <div class="app-dialog-content" data-dialog-kind="info">
        <div class="app-dialog-icon" aria-hidden="true">i</div>
        <div class="app-dialog-copy">
            <h2 id="app-dialog-title"></h2>
            <p id="app-dialog-message"></p>
        </div>
        <div class="app-dialog-actions">
            <button type="button" class="opt-button app-dialog-cancel">${t.passwordCancel}</button>
            <button type="button" class="opt-button opt-button-accent app-dialog-confirm">${t.passwordConfirm}</button>
        </div>
    </div>
</div>
<div class="modal import-options-modal" role="dialog" aria-modal="true" aria-labelledby="import-options-title" aria-describedby="import-options-message" aria-hidden="true">
    <div class="modal-mask" data-modal-close></div>
    <div class="app-dialog-content" data-dialog-kind="confirm">
        <div class="app-dialog-icon" aria-hidden="true">?</div>
        <div class="app-dialog-copy">
            <h2 id="import-options-title">${t.importOptionTitle}</h2>
            <p id="import-options-message">${t.importOptionMessage}</p>
        </div>
        <div class="app-dialog-actions import-options-actions">
            <button type="button" class="opt-button import-action-cancel">${t.importActionCancel}</button>
            <button type="button" class="opt-button import-action-insert">${t.importActionInsert}</button>
            <button type="button" class="opt-button opt-button-accent import-action-replace">${t.importActionReplace}</button>
        </div>
    </div>
</div>
<div class="modal file-drop-modal" role="dialog" aria-modal="true" aria-labelledby="file-drop-title" aria-describedby="file-drop-message" aria-hidden="true">
    <div class="modal-mask" data-modal-close></div>
    <div class="app-dialog-content file-drop-dialog-content" data-dialog-kind="confirm">
        <div class="app-dialog-icon file-drop-icon" aria-hidden="true">📄</div>
        <div class="app-dialog-copy">
            <h2 id="file-drop-title">${lang === 'zh-TW' ? '處理拖曳檔案' : 'Process Dropped File'}</h2>
            <p id="file-drop-message">${lang === 'zh-TW' ? '請選擇您希望如何處理此檔案：' : 'Please select how you would like to handle this file:'}</p>
        </div>
        <div class="file-drop-actions">
            <button type="button" class="btn file-drop-action-primary" id="file-drop-action-primary">📑 ${lang === 'zh-TW' ? '解析為 Markdown 內文' : 'Convert to Markdown'}</button>
            <button type="button" class="btn file-drop-action-tertiary" id="file-drop-action-tertiary" style="display: none;">✨ ${lang === 'zh-TW' ? '匯入音訊（智慧排版）' : 'Import audio (Smart format)'}</button>
            <button type="button" class="btn file-drop-action-secondary" id="file-drop-action-secondary">☁️ ${lang === 'zh-TW' ? '上傳至 888box 作為附件' : 'Upload to 888box'}</button>
            <button type="button" class="btn file-drop-action-cancel" id="file-drop-action-cancel">${lang === 'zh-TW' ? '取消' : 'Cancel'}</button>
        </div>
    </div>
</div>
<div id="ocr-status" class="ocr-status" role="status" aria-live="polite" aria-atomic="true" hidden>
    <span class="ocr-status-indicator" aria-hidden="true"></span>
    <span id="ocr-status-text"></span>
</div>
<div class="modal image-ocr-modal" role="dialog" aria-modal="true" aria-labelledby="image-ocr-title" aria-describedby="image-ocr-message" aria-hidden="true">
    <div class="modal-mask" data-modal-close></div>
    <div class="app-dialog-content image-ocr-dialog-content" data-dialog-kind="confirm">
        <div class="app-dialog-icon image-ocr-icon" aria-hidden="true">${SVG_ICONS.image}</div>
        <div class="app-dialog-copy">
            <h2 id="image-ocr-title">${lang === 'zh-TW' ? '處理圖片' : 'Process Image'}</h2>
            <p id="image-ocr-message">${lang === 'zh-TW' ? '請選擇要上傳圖片、在本機辨識文字，或使用本地優先的表格幾何重構。' : 'Choose image upload, local text OCR, or local-first table reconstruction.'}</p>
            <p class="image-ocr-privacy-note">${lang === 'zh-TW' ? '本機 OCR 不會上傳圖片；表格 OCR 優先本地幾何重構，若本機不支援，後端表格 OCR 會將圖片送至表格辨識服務。' : 'Local OCR does not upload the image; table OCR prioritizes local 2D reconstruction, with server table OCR fallback.'}</p>
        </div>
        <div class="image-ocr-actions">
            <button type="button" class="btn image-ocr-action-upload" id="image-ocr-action-upload">${lang === 'zh-TW' ? '上傳圖片' : 'Upload image'}</button>
            <button type="button" class="btn image-ocr-action-ocr" id="image-ocr-action-ocr">${lang === 'zh-TW' ? 'OCR 轉文字' : 'Run local OCR'}</button>
            <button type="button" class="btn image-ocr-action-table" id="image-ocr-action-table">${lang === 'zh-TW' ? '辨識表格' : 'Recognize table'}</button>
            <button type="button" class="btn image-ocr-action-cancel" id="image-ocr-action-cancel">${lang === 'zh-TW' ? '取消' : 'Cancel'}</button>
        </div>
    </div>
</div>
${showNoteHistory ? `
<div class="modal note-history-modal" role="dialog" aria-modal="true" aria-labelledby="note-history-title" aria-hidden="true">
    <div class="modal-mask" data-modal-close></div>
    <div class="note-history-content">
        <button type="button" class="close-btn note-history-close" data-modal-close aria-label="${closeLabel}">×</button>
        <h2 id="note-history-title">${t.history}</h2>
        <div class="note-history-toolbar">
            <div class="segmented-toggle note-history-render-toggle" role="group" aria-label="${t.history}">
                <button type="button" class="segmented-toggle-btn active" data-note-history-render-mode="preview" aria-pressed="true">${t.historyPreview}</button>
                <button type="button" class="segmented-toggle-btn" data-note-history-render-mode="raw" aria-pressed="false">${t.historyRaw}</button>
            </div>
            <button type="button" class="share-history-copy" data-note-history-refresh>${t.historyRefresh}</button>
            <button type="button" class="share-history-copy" data-note-history-copy disabled>${t.historyCopyContent}</button>
            <button type="button" class="opt-button" data-note-history-restore disabled>${t.historyRestore}</button>
        </div>
        <div class="note-history-layout">
            <div class="note-history-list" data-note-history-list></div>
            <section class="note-history-viewer">
                <header class="note-history-viewer-header">
                    <strong data-note-history-title>${t.historyNoSelection}</strong>
                    <span data-note-history-meta></span>
                </header>
                <div class="note-history-body" data-note-history-body>${t.historyNoSelection}</div>
            </section>
        </div>
    </div>
</div>
` : ''}
`
}

export const CITE_MODAL = (lang) => {
    const zh = lang === 'zh-TW'
    const closeLabel = zh ? '關閉' : 'Close'
    return `
<div id="cite-modal" class="modal cite-modal" role="dialog" aria-modal="true" aria-labelledby="cite-modal-title" aria-hidden="true" style="display:none;">
    <div class="modal-mask" id="cite-modal-mask" data-modal-close></div>
    <div class="cite-modal-content">
        <button type="button" class="close-btn" id="cite-modal-close-btn" data-modal-close aria-label="${closeLabel}">×</button>
        <h3 id="cite-modal-title" class="cite-modal-title">
            ${SVG_ICONS.quote} <span>${zh ? '引用此文章 (Cite this Note)' : 'Cite this Note'}</span>
        </h3>
        <p class="cite-modal-desc">${zh ? '選擇引用格式並複製代碼（適用於論文、技術報告與筆記系統）：' : 'Select citation format and copy citation text for papers, reports, or notes:'}</p>
        <div class="cite-tabs" role="tablist" aria-label="${zh ? '引用格式' : 'Citation formats'}">
            <button type="button" class="cite-tab-btn active" data-cite-format="apa" role="tab" aria-selected="true">APA (7th)</button>
            <button type="button" class="cite-tab-btn" data-cite-format="ieee" role="tab" aria-selected="false">IEEE</button>
            <button type="button" class="cite-tab-btn" data-cite-format="bibtex" role="tab" aria-selected="false">BibTeX</button>
            <button type="button" class="cite-tab-btn" data-cite-format="mla" role="tab" aria-selected="false">MLA (9th)</button>
            <button type="button" class="cite-tab-btn" data-cite-format="markdown" role="tab" aria-selected="false">Markdown</button>
            <button type="button" class="cite-tab-btn" data-cite-format="chicago" role="tab" aria-selected="false">Chicago</button>
        </div>
        <div class="cite-preview-container">
            <textarea id="cite-preview-text" class="cite-preview-text" readonly spellcheck="false" aria-label="${zh ? '引用預覽' : 'Citation preview'}"></textarea>
        </div>
        <div class="cite-modal-actions">
            <button type="button" class="opt-button" id="cite-modal-cancel-btn" data-modal-close>${closeLabel}</button>
            <button type="button" class="opt-button opt-button-accent" id="cite-modal-copy-btn">${SVG_ICONS.copy} <span>${zh ? '複製引用' : 'Copy Citation'}</span></button>
        </div>
    </div>
</div>`
}

export const VAULT_PRESETS_MODAL = (lang) => {
    const zh = lang === 'zh-TW'
    const closeLabel = zh ? '關閉' : 'Close'
    return `
<div id="vault-presets-modal" class="modal vault-presets-modal seal-modal" role="dialog" aria-modal="true" aria-labelledby="vault-presets-title" aria-hidden="true" style="display:none;">
    <div class="modal-mask" id="vault-presets-mask" data-modal-close></div>
    <div class="vault-presets-modal-content seal-modal-content">
        <div class="vault-presets-header-bar seal-modal-header-bar">
            <div class="seal-header-badge-wrap">
                <span id="seal-status-badge" class="seal-status-badge badge-unsealed" data-status="unsealed">${zh ? '未設定' : 'Unsealed'}</span>
            </div>
            <div class="seal-header-right-actions">
                <div class="vault-presets-lang-group" role="group" aria-label="${zh ? '切換語言 / Switch language' : 'Switch language / 切換語言'}">
                    <button type="button" class="vault-pref-lang-btn ${zh ? 'is-active' : ''}" data-vault-lang="zh-TW" title="繁體中文">中</button>
                    <button type="button" class="vault-pref-lang-btn ${!zh ? 'is-active' : ''}" data-vault-lang="en-US" title="English">En</button>
                </div>
                <button type="button" class="close-btn" id="vault-presets-close-btn" data-modal-close aria-label="${closeLabel}">×</button>
            </div>
        </div>
        <div class="vault-presets-header seal-modal-header">
            <h3 id="vault-presets-title" class="vault-presets-title seal-modal-title">
                ${SVG_ICONS.lock || SVG_ICONS.shieldCheck} <span data-i18n-key="title">${zh ? 'Seal 存取控制' : 'Seal Access Control'}</span>
            </h3>
            <p class="vault-presets-subtitle seal-modal-subtitle" data-i18n-key="subtitle">${zh ? 'Seal 與密碼同屬資產存取控制：密碼保護內容，Seal 控制何時或如何釋出。Seal 建立或解除會立即生效。' : 'Seal and password are asset access controls: password protects content, Seal controls when and how it is released. Changes take effect immediately.'}</p>
        </div>

        <div class="seal-modal-body-scroll" id="seal-modal-body-scroll">
            <div class="seal-config-section">
                <div class="seal-form-row">
                    <label for="seal-mode-select" class="seal-form-label" data-i18n-key="modeLabel">${zh ? '模式' : 'Mode'}</label>
                    <div class="seal-form-control">
                        <select id="seal-mode-select" class="opt-select seal-mode-select" aria-label="${zh ? 'Seal 模式' : 'Seal Mode'}">
                            <option value="none">${zh ? '無 (解除 Seal)' : 'None (Unsealed)'}</option>
                            <option value="timelock">${zh ? '定時解鎖 (Time Lock)' : 'Time Lock'}</option>
                            <option value="burn">${zh ? '閱後即焚 (Burn After Read)' : 'Burn After Read'}</option>
                            <option value="deadman">${zh ? "Dead Man's Switch (亡者開關)" : "Dead Man's Switch"}</option>
                            <option value="expires">${zh ? '保留期限 (Expiration)' : 'Expiration'}</option>
                        </select>
                    </div>
                </div>

                <!-- Timelock Parameter Row -->
                <div class="seal-param-panel" id="seal-param-panel-timelock" style="display:none;">
                    <div class="seal-form-row">
                        <label for="seal-unlock-at" class="seal-form-label" data-i18n-key="unlockTimeLabel">${zh ? '解鎖時間' : 'Unlock Time'}</label>
                        <div class="seal-form-control">
                            <div class="seal-input-composite">
                                <input type="datetime-local" id="seal-unlock-at" class="seal-input" step="1">
                                <div class="seal-quick-chips" role="group" aria-label="${zh ? '快速設定時間' : 'Quick time shortcuts'}">
                                    <button type="button" class="seal-chip-btn" data-time-add="1h">+1h</button>
                                    <button type="button" class="seal-chip-btn" data-time-add="1d">+1d</button>
                                    <button type="button" class="seal-chip-btn" data-time-add="3d">+3d</button>
                                    <button type="button" class="seal-chip-btn" data-time-add="7d">+7d</button>
                                    <button type="button" class="seal-chip-btn" data-time-add="30d">+30d</button>
                                </div>
                            </div>
                            <small class="seal-field-hint" data-i18n-key="timelockHint">${zh ? '解鎖時間到達前訪客只能查看倒數封印頁面，時間到達時自動公開內容。' : 'Visitors see a countdown lock page until unlock time arrives, then note is released.'}</small>
                        </div>
                    </div>
                </div>

                <!-- Burn Parameter Row -->
                <div class="seal-param-panel" id="seal-param-panel-burn" style="display:none;">
                    <div class="seal-form-row">
                        <label for="seal-max-views" class="seal-form-label" data-i18n-key="maxViewsLabel">${zh ? '最大瀏覽次數' : 'Max Views'}</label>
                        <div class="seal-form-control">
                            <div class="seal-input-composite">
                                <input type="number" id="seal-max-views" class="seal-input seal-number-input" min="1" max="999" value="1">
                                <span class="seal-input-addon" data-i18n-key="viewsUnit">${zh ? '次 (預設 1 次)' : 'views (Default 1)'}</span>
                            </div>
                            <small class="seal-field-hint" data-i18n-key="burnHint">${zh ? '分享連結達到瀏覽上限後會永久銷毀；作者原始筆記仍保留。' : 'The share is permanently destroyed at the view limit; the author’s original note remains in the wiki.'}</small>
                        </div>
                    </div>
                </div>

                <!-- Dead Man's Switch Parameter Row -->
                <div class="seal-param-panel" id="seal-param-panel-deadman" style="display:none;">
                    <div class="seal-form-row">
                        <label for="seal-pulse-minutes" class="seal-form-label" data-i18n-key="pulseIntervalLabel">${zh ? 'Pulse 間隔 (分鐘)' : 'Pulse Interval (Minutes)'}</label>
                        <div class="seal-form-control">
                            <div class="seal-input-composite">
                                <input type="number" id="seal-pulse-minutes" class="seal-input seal-number-input" min="5" value="10080">
                                <div class="seal-quick-chips" role="group" aria-label="${zh ? '快速間隔' : 'Quick intervals'}">
                                    <button type="button" class="seal-chip-btn" data-pulse-mins="1440">${zh ? '1天' : '1d'}</button>
                                    <button type="button" class="seal-chip-btn" data-pulse-mins="4320">${zh ? '3天' : '3d'}</button>
                                    <button type="button" class="seal-chip-btn" data-pulse-mins="10080">${zh ? '7天' : '7d'}</button>
                                    <button type="button" class="seal-chip-btn" data-pulse-mins="43200">${zh ? '30天' : '30d'}</button>
                                </div>
                            </div>
                            <div class="seal-deadman-live-box" id="seal-deadman-live-box" style="display:none;">
                                <span id="seal-deadman-live-text" class="seal-deadman-live-text"></span>
                                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                                    <button type="button" id="seal-modal-pulse-btn" class="opt-button seal-pulse-btn">${SVG_ICONS.pulse} <span>${zh ? '發送 Pulse 心跳' : 'Send Pulse Heartbeat'}</span></button>
                                    <button type="button" id="seal-modal-pulse-copy-btn" class="opt-button" style="font-size:11px;">${SVG_ICONS.copy} <span>${zh ? '複製心跳連結' : 'Copy Pulse URL'}</span></button>
                                </div>
                            </div>
                            <small class="seal-field-hint" data-i18n-key="deadmanHint">${zh ? '作者定時簽到保活；若失聯逾期未發送心跳，筆記將自動解鎖釋出。' : 'Author must check in regularly; if pulse heartbeat lapses, note is released.'}</small>
                        </div>
                    </div>
                </div>

                <!-- Expiration Parameter Row -->
                <div class="seal-param-panel" id="seal-param-panel-expires" style="display:none;">
                    <div class="seal-form-row">
                        <label for="seal-expires-select" class="seal-form-label" data-i18n-key="expirationLabel">${zh ? '保留期限' : 'Expiration'}</label>
                        <div class="seal-form-control">
                            <div class="seal-input-composite">
                                <select id="seal-expires-select" class="opt-select seal-input" aria-label="${zh ? '有效期限' : 'Expiration'}">
                                    <option value="10m">${zh ? '10 分鐘' : '10 minutes'}</option>
                                    <option value="1h">${zh ? '1 小時' : '1 hour'}</option>
                                    <option value="1d">${zh ? '1 天 (24小時)' : '1 day (24 hours)'}</option>
                                    <option value="7d">${zh ? '7 天 (1週)' : '7 days (1 week)'}</option>
                                    <option value="30d" selected>${zh ? '30 天 (1個月)' : '30 days (1 month)'}</option>
                                </select>
                                <div class="seal-quick-chips" role="group" aria-label="${zh ? '快速期限' : 'Quick expiration'}">
                                    <button type="button" class="seal-chip-btn" data-expire-val="1h">1h</button>
                                    <button type="button" class="seal-chip-btn" data-expire-val="1d">1d</button>
                                    <button type="button" class="seal-chip-btn" data-expire-val="7d">7d</button>
                                    <button type="button" class="seal-chip-btn" data-expire-val="30d">30d</button>
                                </div>
                            </div>
                            <small class="seal-field-hint" data-i18n-key="expirationHint">${zh ? '超過保留期限後分享連結將自動過期下架並顯示 410 墓碑頁面。' : 'Share link automatically expires with a friendly 410 tombstone after the retention period.'}</small>
                        </div>
                    </div>
                </div>
            </div>

            <div class="seal-presets-accordion">
                <div class="seal-presets-accordion-header">
                    <span class="seal-presets-accordion-title" data-i18n-key="presetsSectionTitle">⚡ ${zh ? '快速情境範本 (點選自動填入 Seal 參數)' : 'Quick Scenario Presets (Auto-fills parameters)'}</span>
                </div>
                <div class="vault-presets-body">
                    <div class="vault-presets-modal-grid" role="group" aria-label="${zh ? '安全情境範本' : 'Security Scenario Presets'}">
                        ${(VAULT_QUICK_PRESETS || []).map(p => {
                            const iconSvg = SVG_ICONS[p.iconName] || SVG_ICONS.shieldCheck
                            const badgeZh = p.mode === 'burn'
                                ? '🔥 閱後即焚'
                                : (p.mode === 'timelock'
                                    ? `🔒 定時解鎖 (${p.unlockIn})`
                                    : (p.mode === 'deadman'
                                        ? `💓 亡者開關 (${p.pulseInterval})`
                                        : `⏱️ 保留期限 (${p.expiresIn})`))
                            const badgeEn = p.mode === 'burn'
                                ? '🔥 Burn After Read'
                                : (p.mode === 'timelock'
                                    ? `🔒 Time-Locked (${p.unlockIn})`
                                    : (p.mode === 'deadman'
                                        ? `💓 Dead Man (${p.pulseInterval})`
                                        : `⏱️ Expiration (${p.expiresIn})`))
                            const titleText = zh ? p.labelZh : p.labelEn
                            const descText = zh ? p.descZh : p.descEn
                            return `
                            <div role="button" tabindex="0" class="vault-preset-card vault-preset-btn" data-preset-id="${p.id}" data-mode="${p.mode}" data-expires="${p.expiresIn || ''}" data-unlock="${p.unlockIn || ''}" data-pulse="${p.pulseInterval || ''}" data-title-zh="${p.labelZh}" data-title-en="${p.labelEn}" data-desc-zh="${p.descZh}" data-desc-en="${p.descEn}" data-badge-zh="${badgeZh}" data-badge-en="${badgeEn}">
                                <span class="preset-card-top">
                                    <span class="preset-card-icon mode-${p.mode}" aria-hidden="true">${iconSvg}</span>
                                </span>
                                <span class="preset-card-title">${titleText}</span>
                                <span class="preset-card-desc">${descText}</span>
                            </div>
                            `
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>

        <div class="vault-presets-footer seal-modal-footer">
            <div class="seal-footer-left">
                <button type="button" id="seal-remove-btn" class="opt-button opt-button-danger" style="display:none;" data-i18n-key="removeSeal">${zh ? '解除 Seal' : 'Remove Seal'}</button>
                <span class="vault-presets-tip" data-i18n-key="tip">${zh ? '💡 點選任一情境範本僅會自動填入 Seal 參數，不會影響現有筆記內容。' : '💡 Presets auto-fill Seal parameters only without affecting existing note content.'}</span>
            </div>
            <div class="seal-footer-right">
                <button type="button" class="opt-button" id="vault-presets-cancel-btn" data-modal-close data-i18n-key="cancel">${zh ? '取消' : 'Cancel'}</button>
                <button type="button" class="opt-button opt-button-accent" id="seal-save-btn" data-i18n-key="saveSeal">${zh ? '建立 Seal' : 'Create Seal'}</button>
            </div>
        </div>
    </div>
</div>`
}
