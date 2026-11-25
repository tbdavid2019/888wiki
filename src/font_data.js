/**
 * src/font_data.js
 * Central font registry for preview/reader fonts:
 * - Local bundled fonts (JetBrains Mono, Maple Mono)
 * - On-demand Google Fonts CDN fonts (loaded lazily only when selected)
 */

export const DEFAULT_SHARE_FONT = 'jetbrains'

export const SHARE_FONTS = Object.freeze([
    {
        id: 'jetbrains',
        label: 'JetBrains Mono',
        shortLabel: 'JB',
        source: 'local',
        familyCss: '"GenJyuu Gothic CJK", "JetBrains Mono", "SF Mono", "Monaco", "Cascadia Code", "Fira Code", "JetBrains Mono NL", "Roboto Mono", "Consolas", "Menlo", monospace',
        googleFontsUrl: '',
    },
    {
        id: 'maple',
        label: 'Maple Mono',
        shortLabel: 'Maple',
        source: 'local',
        familyCss: '"GenJyuu Gothic CJK", "Maple Mono", "Menlo", "Monaco", "Courier New", monospace',
        googleFontsUrl: '',
    },
    {
        id: 'fira-code',
        label: 'Fira Code',
        shortLabel: 'Fira Code',
        source: 'google-fonts',
        familyCss: '"GenJyuu Gothic CJK", "Fira Code", "SF Mono", "Monaco", "Menlo", monospace',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap',
    },
    {
        id: 'google-sans-code',
        label: 'Google Sans Code',
        shortLabel: 'GS Code',
        source: 'google-fonts',
        familyCss: '"GenJyuu Gothic CJK", "Google Sans Code", "SF Mono", "Monaco", "Menlo", monospace',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Google+Sans+Code:wght@400;500;600;700&display=swap',
    },
    {
        id: 'geist-mono',
        label: 'Geist Mono',
        shortLabel: 'Geist Mono',
        source: 'google-fonts',
        familyCss: '"GenJyuu Gothic CJK", "Geist Mono", "SF Mono", "Monaco", "Menlo", monospace',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&display=swap',
    },
    {
        id: 'source-code-pro',
        label: 'Source Code Pro',
        shortLabel: 'Source Code',
        source: 'google-fonts',
        familyCss: '"GenJyuu Gothic CJK", "Source Code Pro", "SF Mono", "Monaco", "Menlo", monospace',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Source+Code+Pro:wght@400;500;600;700&display=swap',
    },
    {
        id: 'intel-one-mono',
        label: 'Intel One Mono',
        shortLabel: 'Intel One',
        source: 'google-fonts',
        familyCss: '"GenJyuu Gothic CJK", "Intel One Mono", "SF Mono", "Monaco", "Menlo", monospace',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Intel+One+Mono:wght@400;500;600;700&display=swap',
    },
    {
        id: 'lilex',
        label: 'Lilex',
        shortLabel: 'Lilex',
        source: 'google-fonts',
        familyCss: '"GenJyuu Gothic CJK", "Lilex", "SF Mono", "Monaco", "Menlo", monospace',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Lilex:wght@400;500;600;700&display=swap',
    },
    {
        id: 'atkinson-hyperlegible-mono',
        label: 'Atkinson Hyperlegible Mono',
        shortLabel: 'Atkinson Mono',
        source: 'google-fonts',
        familyCss: '"GenJyuu Gothic CJK", "Atkinson Hyperlegible Mono", "SF Mono", "Monaco", "Menlo", monospace',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400;500;600;700&display=swap',
    },
    {
        id: 'atkinson-hyperlegible',
        label: 'Atkinson Hyperlegible',
        shortLabel: 'Atkinson',
        source: 'google-fonts',
        familyCss: '"GenJyuu Gothic CJK", "Atkinson Hyperlegible", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap',
    },
    {
        id: 'anonymous-pro',
        label: 'Anonymous Pro',
        shortLabel: 'Anonymous Pro',
        source: 'google-fonts',
        familyCss: '"GenJyuu Gothic CJK", "Anonymous Pro", "SF Mono", "Monaco", "Menlo", monospace',
        googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Anonymous+Pro:wght@400;700&display=swap',
    },
])

export const SHARE_FONT_MAP = Object.freeze(
    Object.fromEntries(SHARE_FONTS.map(font => [font.id, font]))
)

export const SHARE_FONT_IDS = Object.freeze(SHARE_FONTS.map(font => font.id))

export const isValidShareFont = value => {
    if (typeof value !== 'string') return false
    const trimmed = value.trim()
    return trimmed === 'true' || Object.prototype.hasOwnProperty.call(SHARE_FONT_MAP, trimmed)
}

export const normalizeShareFont = value => {
    if (value === true || value === 'true') return 'maple'
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (Object.prototype.hasOwnProperty.call(SHARE_FONT_MAP, trimmed)) {
            return trimmed
        }
    }
    return DEFAULT_SHARE_FONT
}

export const getShareFontMeta = value => SHARE_FONT_MAP[normalizeShareFont(value)]

export const getShareFontCssVars = () => SHARE_FONTS
    .map(font => `    --share-font-${font.id}-family: ${font.familyCss};`)
    .join('\n')

export const getShareFontBodyCss = () => SHARE_FONTS
    .map(font => `        body[data-share-font="${font.id}"],\n        body.share-font-${font.id} {\n            --share-font-family: var(--share-font-${font.id}-family);\n        }`)
    .join('\n')
