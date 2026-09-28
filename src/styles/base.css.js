/**
 * src/styles/base.css.js
 * Base CSS styles: reset, layout, loading, footer, utilities
 * Returns CSS as a string for inlining in templates
 */
export const getBaseCss = () => `
@font-face {
    font-family: "Maple Mono";
    src: url("/fonts/MapleMonoNormal-Medium.woff2") format("woff2");
    font-style: normal;
    font-weight: 500;
    font-display: swap;
}

@font-face {
    font-family: "JetBrains Mono";
    src: url("/fonts/JetBrainsMono-Medium.woff2") format("woff2");
    font-style: normal;
    font-weight: 500;
    font-display: swap;
}

@font-face {
    font-family: "GenJyuu Gothic CJK";
    src: url("/fonts/GenJyuuGothic-Medium.woff2") format("woff2");
    font-style: normal;
    font-weight: 500;
    font-display: swap;
    unicode-range: U+3000-303F, U+3040-30FF, U+3100-312F, U+31A0-31BF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF, U+20000-2EBEF;
}

:root {
    --editor-font-family: "GenJyuu Gothic CJK", "Maple Mono", "Menlo", "Monaco", "Courier New", monospace;
    --share-font-jetbrains-family: "GenJyuu Gothic CJK", "JetBrains Mono", "SF Mono", "Monaco", "Cascadia Code", "Fira Code", "JetBrains Mono NL", "Roboto Mono", "Consolas", "Menlo", monospace;
    --share-font-maple-family: "GenJyuu Gothic CJK", "Maple Mono", "Menlo", "Monaco", "Courier New", monospace;
    --preview-max-width: 100%;
    --toolbar-height: 28px;
    --toolbar-radius: 4px;
    --toolbar-border: #e2dacd;
    --toolbar-bg: #f4f0e8;
    --toolbar-bg-hover: #eae3d5;
    --toolbar-bg-active: #f0e6d8;
    --toolbar-text: #2c2a29;
    --toolbar-muted: #706c66;
    --toolbar-accent: #c8654b;
    --toolbar-success: #5db8a6;
    --toolbar-publish-bg: #0f766e;
    --toolbar-layout-bg: #1d6fa8;
    --toolbar-appearance-bg: #5c5aab;
    --toolbar-language-bg: #7a5ba6;
    --toolbar-danger: #c64545;
    --toolbar-danger-bg-hover: #ffebe9;
    --footer-bg: #f4f0e8;
    --footer-border: #e2dacd;
    --footer-text: #4a4640;
    --toolbar-fg: #2c2a29;
    --modal-bg: #ffffff;
    --modal-border: #d0d7de;
    --modal-text: #24292f;
    --modal-muted: #6e7781;
    --modal-surface: #f6f8fa;
    --modal-surface-hover: #eef1f4;
    --modal-surface-active: #edf4ff;
    --modal-accent: #0969da;
    --status-bg: #f6f8fa;
    --status-border: #d8dee4;
    --status-text: #57606a;
    --status-muted: #6e7781;
    --status-strong: #24292f;
    --status-link: #0969da;
    --status-control-bg: #ffffff;
    --status-success-bg: #dafbe1;
    --status-success-border: #4ac26b;
    --status-success-text: #116329;
    --status-muted-bg: #afb8c1;
    --status-muted-text: #24292f;
}

html[data-ui-theme="dark"],
html[data-ui-theme="dark"] body {
    --toolbar-border: #165b99;
    --toolbar-bg: #0f4c81;
    --toolbar-bg-hover: #1a65a7;
    --toolbar-bg-active: #1d70b0;
    --toolbar-text: #ffffff;
    --toolbar-fg: #ffffff;
    --toolbar-muted: #93bde1;
    --toolbar-accent: #8bd5ff;
    --footer-bg: #0f4c81;
    --footer-border: #165b99;
    --footer-text: #ffffff;
    --modal-bg: #1e293b;
    --modal-border: #334155;
    --modal-text: #f1f5f9;
    --modal-muted: #94a3b8;
    --modal-surface: #0f172a;
    --modal-surface-hover: #334155;
    --modal-surface-active: #1e3a5f;
    --modal-accent: #38bdf8;
    --toolbar-success: #8bd5ff;
    --toolbar-publish-bg: #0f6f78;
    --toolbar-layout-bg: #1d70b0;
    --toolbar-appearance-bg: #5366b6;
    --toolbar-language-bg: #7058a4;
    --toolbar-danger: #ff7b72;
    --toolbar-danger-bg-hover: rgba(248, 81, 73, 0.2);
    --status-bg: #0c3b63;
    --status-border: #1b6399;
    --status-text: #d9efff;
    --status-muted: #a8d4f2;
    --status-strong: #ffffff;
    --status-link: #8bd5ff;
    --status-control-bg: #124d7e;
    --status-success-bg: #155d8f;
    --status-success-border: #4d9fd0;
    --status-success-text: #e1f4ff;
    --status-muted-bg: #1e5f91;
    --status-muted-text: #d9efff;
    color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
    html[data-ui-theme="auto"],
    html[data-ui-theme="auto"] body,
    html:not([data-ui-theme]),
    html:not([data-ui-theme]) body {
        --toolbar-border: #165b99;
        --toolbar-bg: #0f4c81;
        --toolbar-bg-hover: #1a65a7;
        --toolbar-bg-active: #1d70b0;
        --toolbar-text: #ffffff;
        --toolbar-fg: #ffffff;
        --toolbar-muted: #93bde1;
        --toolbar-accent: #8bd5ff;
        --footer-bg: #0f4c81;
        --footer-border: #165b99;
        --footer-text: #ffffff;
        --modal-bg: #1e293b;
        --modal-border: #334155;
        --modal-text: #f1f5f9;
        --modal-muted: #94a3b8;
        --modal-surface: #0f172a;
        --modal-surface-hover: #334155;
        --modal-surface-active: #1e3a5f;
        --modal-accent: #38bdf8;
        --toolbar-success: #8bd5ff;
        --toolbar-publish-bg: #0f6f78;
        --toolbar-layout-bg: #1d70b0;
        --toolbar-appearance-bg: #5366b6;
        --toolbar-language-bg: #7058a4;
        --toolbar-danger: #ff7b72;
        --toolbar-danger-bg-hover: rgba(248, 81, 73, 0.2);
        --status-bg: #0c3b63;
        --status-border: #1b6399;
        --status-text: #d9efff;
        --status-muted: #a8d4f2;
        --status-strong: #ffffff;
        --status-link: #8bd5ff;
        --status-control-bg: #124d7e;
        --status-success-bg: #155d8f;
        --status-success-border: #4d9fd0;
        --status-success-text: #e1f4ff;
        --status-muted-bg: #1e5f91;
        --status-muted-text: #d9efff;
        color-scheme: dark;
    }
}

/* Reset & Base */
body { padding: 0; margin: 0; background: #f9f6f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #333; height: 100vh; height: 100dvh; overflow: hidden; }
* { box-sizing: border-box; }

/* Scrollbar */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #bcc0c4; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #999; }

/* Layout */
.note-container { height: 100vh; height: 100dvh; display: flex; flex-direction: column; }
.stack { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; position: relative; }
.layer_1, .layer_2 { flex: 1; min-height: 0; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.layer_3 { flex: 1 1 auto; min-height: 0; height: 100%; display: flex; flex-direction: row; background: #fff; }

/* Utilities */
.hide { display: none !important; }
.divide-line {
    width: 8px;
    background-color: #f6f8fa;
    border-left: 1px solid #e1e4e8;
    border-right: 1px solid #e1e4e8;
    cursor: col-resize;
    z-index: 10;
    flex-shrink: 0;
    transition: background-color 0.2s;
}
.divide-line:hover { background-color: #e1e4e8; }

/* Loading spinner */
#loading { position: fixed; top: 10px; right: 10px; width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; display: none; z-index: 9999; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
    }
}

/* Tips / overlays */
.tips { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #ccc; font-size: 32px; pointer-events: none; }
.modal { display: none; }
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; }
.editor-preference-content {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 1001;
    width: min(560px, calc(100vw - 32px));
    box-sizing: border-box;
    padding: 26px;
    transform: translate(-50%, -50%);
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 14px;
    background: var(--modal-bg, #ffffff);
    color: var(--modal-text, #24292f);
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
}
.editor-preference-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}
.editor-preference-lang-group {
    display: inline-flex;
    align-items: center;
    background: var(--modal-surface, #f6f8fa);
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 999px;
    padding: 2px;
    gap: 2px;
}
.editor-pref-lang-btn {
    border: 0;
    background: transparent;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--modal-muted, #6e7781);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    line-height: 1.2;
}
.editor-pref-lang-btn:hover {
    color: var(--modal-text, #24292f);
}
.editor-pref-lang-btn.is-active {
    background: var(--modal-bg, #ffffff);
    color: var(--modal-accent, #0969da);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
html[data-ui-theme="dark"] .editor-pref-lang-btn.is-active {
    background: var(--modal-bg, #1e293b);
    color: var(--modal-accent, #38bdf8);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.editor-preference-content h2 { margin: 0 0 8px 0; font-size: 20px; color: var(--modal-text, #24292f); }
.editor-preference-content > p { margin: 0 0 18px; color: var(--modal-muted, #6e7781); font-size: 14px; line-height: 1.55; }
.editor-preference-close { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 22px; line-height: 1; padding: 0 4px; }
.editor-preference-close:focus-visible { outline: 2px solid var(--modal-accent, #0969da); outline-offset: 2px; }
.editor-preference-options { display: grid; gap: 10px; margin: 0; padding: 0; border: 0; }
.editor-preference-grid { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
.editor-preference-option {
    display: flex;
    gap: 11px;
    align-items: flex-start;
    padding: 14px;
    border: 1.5px solid var(--modal-border, #d0d7de);
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.16s ease, background 0.16s ease, transform 0.14s ease, box-shadow 0.14s ease;
    background: var(--modal-surface, #f6f8fa);
    color: var(--modal-text, #24292f);
}
.editor-preference-option:hover {
    border-color: var(--modal-accent, #0969da);
    background: var(--modal-surface-hover, #eef1f4);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.editor-preference-option:has(input:checked), .editor-preference-option.is-selected {
    border-color: var(--modal-accent, #0969da);
    background: var(--modal-surface-active, #edf4ff);
}
.editor-preference-option.is-recommended { border-color: var(--modal-accent, #0969da); }
.editor-preference-option input { margin: 3px 0 0; accent-color: var(--modal-accent, #0969da); }
.editor-preference-copy { display: flex !important; flex-direction: column; gap: 6px; width: 100%; }
.editor-preference-header { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.editor-preference-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--modal-surface-hover, rgba(0, 0, 0, 0.06));
    color: var(--modal-muted, #6e7781);
    white-space: nowrap;
}
.editor-preference-badge-accent {
    background: color-mix(in srgb, var(--modal-accent, #0969da) 18%, transparent);
    color: var(--modal-accent, #0969da);
}
.editor-card-action { margin-top: 6px; width: 100%; font-size: 13px; height: 32px; }
.editor-preference-option span { display: grid; gap: 3px; }
.editor-preference-option strong { font-size: 14px; }
.editor-preference-option small { color: var(--modal-muted, #6e7781); font-size: 12px; line-height: 1.45; }
.editor-preference-remember { display: inline-flex; align-items: center; gap: 8px; margin: 16px 0 0; font-size: 13px; cursor: pointer; color: var(--modal-text, #24292f); }
.editor-preference-remember input { accent-color: var(--modal-accent, #0969da); }
.editor-preference-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
.editor-preference-actions .opt-button { min-width: 76px; }
.katex, .katex-display {
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.16s ease, outline-color 0.16s ease, transform 0.1s ease;
}
.katex:hover {
    background-color: color-mix(in srgb, var(--toolbar-accent, #c8654b) 12%, transparent);
    outline: 1px dashed var(--toolbar-accent, #c8654b);
    outline-offset: 2px;
}
.katex-display:hover {
    background-color: color-mix(in srgb, var(--toolbar-accent, #c8654b) 8%, transparent);
    outline: 1px dashed var(--toolbar-accent, #c8654b);
    outline-offset: 4px;
}
.katex.katex-copied, .katex-display.katex-copied {
    background-color: rgba(46, 160, 67, 0.22) !important;
    outline: 2px solid #2ea043 !important;
    animation: katex-copied-pulse 0.45s ease-out;
}
@keyframes katex-copied-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.025); }
    100% { transform: scale(1); }
}
.math-icon-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    width: 14px;
    height: 14px;
    font-weight: 700;
    font-style: italic;
    font-family: "KaTeX_Math", "Times New Roman", Cambria, Georgia, serif;
}
.math-icon-badge .svg-icon {
    width: 14px;
    height: 14px;
}
.modal-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--modal-bg, #ffffff);
    color: var(--modal-text, #24292f);
    border: 1px solid var(--modal-border, #d0d7de);
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
    z-index: 1001;
    width: min(440px, calc(100vw - 32px));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.modal-content .modal-body {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
}
.modal-content input {
    flex: 1;
    padding: 10px 12px;
    border: 1px solid var(--modal-border, #d0d7de);
    background: var(--modal-surface, #fff);
    color: var(--modal-text, #24292f);
    border-radius: 6px;
    font-size: 14px;
    outline: none;
}
.modal-content input:focus-visible {
    outline: 2px solid var(--modal-accent, #0969da);
    outline-offset: 1px;
}
.modal .close-btn,
.modal-content .close-btn,
.embed-modal-content .close-btn,
.url-import-modal-content .close-btn,
.cite-modal-content .close-btn {
    position: absolute;
    top: 12px;
    right: 14px;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: var(--modal-muted, #6e7781);
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    border-radius: 8px;
    transition: background 0.15s ease, color 0.15s ease;
    z-index: 10;
}
.modal .close-btn:hover,
.modal-content .close-btn:hover,
.embed-modal-content .close-btn:hover,
.url-import-modal-content .close-btn:hover,
.cite-modal-content .close-btn:hover {
    background: var(--modal-surface-hover, rgba(0, 0, 0, 0.08));
    color: var(--modal-text, #24292f);
}
.modal .close-btn:focus-visible,
.modal-content .close-btn:focus-visible,
.embed-modal-content .close-btn:focus-visible,
.url-import-modal-content .close-btn:focus-visible,
.cite-modal-content .close-btn:focus-visible {
    outline: 2px solid var(--modal-accent, #0969da);
    outline-offset: 2px;
}
.embed-modal-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--modal-bg, #ffffff);
    color: var(--modal-text, #24292f);
    border: 1px solid var(--modal-border, #d0d7de);
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
    z-index: 1001;
    width: min(620px, calc(100vw - 32px));
    box-sizing: border-box;
}
.embed-modal-content h2 { margin: 0 0 8px; color: var(--modal-text, #24292f); }
.embed-modal-content p { margin: 0 0 14px; color: var(--modal-muted, #6e7781); }
.embed-modal-code {
    width: 100%;
    min-height: 110px;
    box-sizing: border-box;
    resize: vertical;
    margin-bottom: 14px;
    padding: 10px 12px;
    border: 1px solid var(--modal-border, #d0d7de);
    background: var(--modal-surface, #fff);
    color: var(--modal-text, #24292f);
    border-radius: 6px;
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
}
.url-import-modal-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--modal-bg, #ffffff);
    color: var(--modal-text, #24292f);
    border: 1px solid var(--modal-border, #d0d7de);
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
    z-index: 1001;
    width: min(520px, calc(100vw - 32px));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.url-import-modal-title {
    margin: 0 0 8px 0;
    font-size: 1.15rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--modal-text, #24292f);
}
.url-import-modal-desc {
    margin: 0 0 16px 0;
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--modal-muted, #6e7781);
}
.url-import-input-field {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 8px;
    font-size: 0.95rem;
    box-sizing: border-box;
    background: var(--modal-surface, #fff);
    color: var(--modal-text, #24292f);
    outline: none;
}
.url-import-input-field:focus {
    border-color: var(--modal-accent, #0969da);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--modal-accent, #0969da) 20%, transparent);
}
.url-import-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
.cite-modal-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--modal-bg, #ffffff);
    color: var(--modal-text, #24292f);
    border: 1px solid var(--modal-border, #d0d7de);
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
    z-index: 1001;
    width: min(580px, calc(100vw - 32px));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
}
.cite-modal-title {
    margin: 0 0 8px 0;
    font-size: 1.15rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--modal-text, #24292f);
}
.cite-modal-desc {
    margin: 0 0 14px 0;
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--modal-muted, #6e7781);
}
.cite-tabs { display: flex; gap: 6px; margin-bottom: 12px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
.cite-tab-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--modal-border, #d0d7de);
    background: var(--modal-surface, #f6f8fa);
    color: var(--modal-text, #24292f);
    cursor: pointer;
    font-size: 0.84rem;
    font-weight: 500;
    white-space: nowrap;
    transition: all 0.15s ease;
}
.cite-tab-btn:hover { background: var(--modal-surface-hover, #eef1f4); }
.cite-tab-btn.active {
    background: var(--modal-accent, #0969da);
    color: #ffffff;
    border-color: var(--modal-accent, #0969da);
    font-weight: 600;
}
.cite-preview-container { margin-bottom: 14px; }
.cite-preview-text {
    width: 100%;
    min-height: 105px;
    box-sizing: border-box;
    resize: vertical;
    padding: 10px 12px;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    font-size: 0.88rem;
    line-height: 1.55;
    border-radius: 8px;
    border: 1px solid var(--modal-border, #d0d7de);
    background: var(--modal-surface, #f6f8fa);
    color: var(--modal-text, #24292f);
    outline: none;
}
.cite-preview-text:focus {
    border-color: var(--modal-accent, #0969da);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--modal-accent, #0969da) 20%, transparent);
}
.cite-modal-actions { display: flex; justify-content: flex-end; gap: 10px; }
.share-index-prompt {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
}
.share-index-prompt strong {
    color: #24292f;
    font-size: 14px;
    line-height: 1.45;
}
.share-index-prompt p {
    margin: 0;
    color: #57606a;
    font-size: 12px;
    line-height: 1.55;
}
.share-index-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}
.publish-nudge-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--modal-bg, #ffffff);
    color: var(--modal-text, #24292f);
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 12px;
    box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
    z-index: 1001;
    width: min(420px, calc(100vw - 32px));
    padding: 22px;
}
.publish-nudge-content h2 {
    margin: 0 28px 8px 0;
    font-size: 18px;
    line-height: 1.35;
    color: var(--modal-text, #24292f);
}
.publish-nudge-content p {
    margin: 0 0 14px;
    color: var(--modal-muted, #6e7781);
    font-size: 14px;
    line-height: 1.6;
}
.publish-preferences {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
}
.publish-preference-row {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding: 10px 12px;
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 8px;
    background: var(--modal-surface, #f6f8fa);
    color: var(--modal-text, #24292f);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
}
.publish-preference-row:hover {
    background: var(--modal-surface-hover, #eef1f4);
    border-color: var(--modal-accent, #0969da);
}
.publish-preference-row:focus-within {
    border-color: var(--modal-accent, #0969da);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--modal-accent, #0969da) 25%, transparent);
}
.publish-preference-row input {
    width: 16px;
    height: 16px;
    margin: 2px 0 0;
    accent-color: var(--modal-accent, #0969da);
}
.publish-preference-row strong,
.publish-preference-row small {
    display: block;
}
.publish-preference-row strong {
    font-size: 14px;
    line-height: 1.35;
    color: var(--modal-text, #24292f);
}
.publish-preference-row small {
    margin-top: 2px;
    color: var(--modal-muted, #6e7781);
    font-size: 12px;
    line-height: 1.45;
}
.publish-preference-row.is-dependent-disabled {
    opacity: 0.52;
    cursor: not-allowed;
}
.publish-nudge-content .publish-preferences-note {
    margin: 10px 0 16px;
    color: var(--modal-muted, #6e7781);
    font-size: 12px;
}
.publish-nudge-content .close-btn {
    position: absolute;
    right: 12px;
    top: 10px;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: var(--modal-muted, #6e7781);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    border-radius: 4px;
}
.publish-nudge-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
.publish-nudge-later {
    background: var(--modal-surface, #f6f8fa);
    color: var(--modal-text, #24292f);
    border: 1px solid var(--modal-border, #d0d7de);
}
.publish-nudge-later:hover { background: var(--modal-surface-hover, #eef1f4); }
.publish-nudge-publish { background: #1f883d; color: #ffffff; border: 1px solid transparent; }
.publish-nudge-publish:hover { background: #1a7f37; }
.password-modal-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--modal-bg, #fff);
    color: var(--modal-text, #24292f);
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 8px;
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
    z-index: 1001;
    width: min(420px, calc(100vw - 32px));
    padding: 22px;
}
.password-modal-content h2 {
    margin: 0 28px 8px 0;
    font-size: 18px;
    line-height: 1.35;
    color: var(--modal-text, #24292f);
}
.password-modal-message {
    margin: 0 0 14px;
    color: var(--modal-muted, #57606a);
    font-size: 14px;
    line-height: 1.55;
}
.password-modal-input {
    width: 100%;
    height: 38px;
    padding: 0 12px;
    border: 1px solid var(--modal-border, #d0d7de);
    background: var(--modal-surface, #fff);
    color: var(--modal-text, #24292f);
    border-radius: 6px;
    font-size: 14px;
    margin-bottom: 16px;
}
.password-modal-input:focus-visible {
    outline: 2px solid var(--modal-accent, #0969da);
    outline-offset: 1px;
}
.password-modal-content .close-btn {
    position: absolute;
    right: 12px;
    top: 10px;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: var(--modal-muted, #6e7781);
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    border-radius: 6px;
    transition: color 0.15s ease, background 0.15s ease;
}
.password-modal-content .close-btn:hover {
    color: var(--modal-text, #24292f);
}
.password-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
.password-modal-cancel {
    background: var(--modal-surface, #f6f8fa);
    color: var(--modal-text, #24292f);
    border: 1px solid var(--modal-border, #d0d7de);
}
.password-modal-cancel:hover { background: var(--modal-surface-hover, #eef1f4); }
.app-dialog-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1001;
    width: min(440px, calc(100vw - 32px));
    display: grid;
    grid-template-columns: 34px 1fr;
    gap: 12px;
    padding: 22px;
    border: 1px solid var(--modal-border, #e6dfd8);
    border-radius: 10px;
    background: var(--modal-bg, #fff);
    color: var(--modal-text, #24292f);
    box-shadow: 0 18px 40px rgba(0, 0, 0, 0.3);
}
.app-dialog-icon {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--modal-surface, #f2f4f7);
    color: var(--modal-muted, #57606a);
    font-size: 16px;
    font-weight: 800;
}
.app-dialog-content[data-dialog-kind="error"] .app-dialog-icon {
    background: #fff1f0;
    color: #cf222e;
}
.app-dialog-content[data-dialog-kind="confirm"] .app-dialog-icon {
    background: #fff8c5;
    color: #9a6700;
}
.app-dialog-copy h2 {
    margin: 0 28px 6px 0;
    font-size: 17px;
    line-height: 1.35;
    color: var(--modal-text, #24292f);
}
.app-dialog-copy p {
    margin: 0;
    color: var(--modal-muted, #57606a);
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
}
.app-dialog-actions {
    grid-column: 2;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
}
.app-dialog-cancel { background: var(--modal-surface, #f6f8fa); color: var(--modal-text, #24292f); border: 1px solid var(--modal-border, #d0d7de); }
.app-dialog-cancel:hover { background: var(--modal-surface-hover, #eef1f4); }
.app-dialog-modal .modal-mask, .import-options-modal .modal-mask, .file-drop-modal .modal-mask, .image-ocr-modal .modal-mask { z-index: 1000; }
.import-action-cancel, .import-action-insert { background: var(--modal-surface, #f6f8fa); color: var(--modal-text, #24292f); border: 1px solid var(--modal-border, #d0d7de); }
.import-action-cancel:hover, .import-action-insert:hover { background: var(--modal-surface-hover, #eef1f4); }

.editor-code-shell.is-dragover {
    outline: 2px dashed var(--toolbar-accent, #cc785c) !important;
    outline-offset: -4px !important;
    background: color-mix(in srgb, var(--toolbar-bg, #faf9f5) 85%, var(--toolbar-accent, #cc785c)) !important;
}
.file-drop-dialog-content {
    width: min(480px, calc(100vw - 32px));
}
.file-drop-actions {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
}
.file-drop-actions .btn {
    width: 100%;
    min-height: 42px;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    border: 1px solid transparent;
}
.file-drop-action-primary {
    background: var(--toolbar-accent, #cc785c);
    color: #fff;
}
.file-drop-action-primary:hover {
    filter: brightness(1.08);
}
.file-drop-action-secondary, .file-drop-action-tertiary {
    background: var(--modal-surface, #f6f8fa);
    color: var(--modal-text, #24292f);
    border-color: var(--modal-border, #d0d7de) !important;
}
.file-drop-action-secondary:hover, .file-drop-action-tertiary:hover {
    background: var(--modal-surface-hover, #eef1f4);
}
.file-drop-action-cancel {
    background: transparent;
    color: var(--modal-muted, #6e7781);
    justify-content: center;
    text-align: center;
}
.file-drop-action-cancel:hover {
    color: var(--modal-text, #24292f);
}
.image-ocr-dialog-content {
    width: min(500px, calc(100vw - 32px));
}
.image-ocr-icon .svg-icon {
    width: 18px;
    height: 18px;
    margin: 0;
}
.image-ocr-privacy-note {
    margin-top: 8px !important;
    color: var(--modal-accent, #0969da) !important;
    font-size: 12px !important;
}
.image-ocr-actions {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
}
.image-ocr-actions .btn {
    min-height: 42px;
    padding: 10px 14px;
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 8px;
    color: var(--modal-text, #24292f);
    background: var(--modal-surface, #f6f8fa);
    font: inherit;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, filter 0.15s ease;
}
.image-ocr-actions .btn:hover {
    background: var(--modal-surface-hover, #eef1f4);
}
.image-ocr-actions .btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
}
.image-ocr-actions .btn:focus-visible {
    outline: 2px solid var(--modal-accent, #0969da);
    outline-offset: 2px;
}
.image-ocr-action-ocr {
    color: #fff !important;
    background: var(--toolbar-accent, #cc785c) !important;
    border-color: var(--toolbar-accent, #cc785c) !important;
}
.image-ocr-action-ocr:hover { filter: brightness(1.08); }
.image-ocr-action-table {
    grid-column: 1 / -1;
    color: var(--modal-accent, #0969da) !important;
    border-color: var(--modal-accent, #0969da) !important;
}
.image-ocr-action-table:hover {
    background: color-mix(in srgb, var(--modal-accent, #0969da) 10%, var(--modal-surface, #f6f8fa));
}
.image-ocr-action-cancel {
    grid-column: 1 / -1;
    border-color: transparent !important;
    background: transparent !important;
    color: var(--modal-muted, #6e7781) !important;
}
.image-ocr-action-cancel:hover { color: var(--modal-text, #24292f) !important; }
@media (max-width: 520px) {
    .image-ocr-actions { grid-template-columns: 1fr; }
    .image-ocr-action-cancel { grid-column: auto; }
}
.ocr-status {
    position: fixed;
    top: 18px;
    right: 18px;
    z-index: 20030;
    display: inline-flex;
    align-items: center;
    gap: 9px;
    max-width: min(420px, calc(100vw - 36px));
    padding: 10px 13px;
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 10px;
    background: var(--modal-bg, #fff);
    color: var(--modal-text, #24292f);
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.16);
    font-size: 13px;
    line-height: 1.4;
}
.ocr-status[hidden] { display: none; }
.ocr-status-indicator {
    width: 9px;
    height: 9px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--toolbar-accent, #cc785c);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--toolbar-accent, #cc785c) 18%, transparent);
    animation: ocrStatusPulse 1.2s ease-in-out infinite;
}
@keyframes ocrStatusPulse {
    0%, 100% { opacity: 0.45; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
    .ocr-status-indicator { animation: none; }
}

/* SVG Icon Utility */
.svg-icon {
    width: 14px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    stroke-width: 2px;
    flex-shrink: 0;
    line-height: 1;
    transition: transform 0.15s ease;
}
.lock-combo-icon {
    width: 18px;
    height: 18px;
}
.toolbar-icon-button .lock-combo-icon {
    margin: 0;
}
.opt-button .svg-icon,
.toolbar-icon-button .svg-icon,
.dropdown-item .svg-icon {
    margin: 0;
}

.share-button-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
}

.toolbar-icon-button.dropdown-trigger,
.dropdown-trigger {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    gap: 4px;
}
.btn-label {
    margin-left: 4px;
    display: inline;
}

/* Dropdown Menu */
.dropdown-container {
    position: relative;
    display: inline-block;
}
.dropdown-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    z-index: 1060;
    min-width: 180px;
    background: var(--modal-bg, #fff);
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 10px;
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.16), 0 3px 8px rgba(15, 23, 42, 0.08);
    padding: 10px 8px;
    display: none;
    flex-direction: column;
    animation: dropdownFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    box-sizing: border-box;
}
.share-menu-published,
.share-menu-unpublished {
    display: flex;
    flex-direction: column;
}
.share-menu-published[hidden],
.share-menu-unpublished[hidden] {
    display: none;
}
.dropdown-container.show .dropdown-menu {
    display: flex;
}
.dropdown-menu.floating-menu-open {
    display: flex;
    z-index: 20020;
}
.dropdown-group-card {
    background: var(--modal-surface, #f8fafc);
    border: 1px solid var(--modal-border, #e2e8f0);
    border-radius: 8px;
    padding: 0;
    margin: 4px 0 10px;
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow: hidden;
    box-sizing: border-box;
}
.dropdown-group-danger {
    background: transparent;
    border: 1px solid transparent;
    margin: 4px 0 0;
    padding: 0;
}
.dropdown-menu > *,
.dropdown-group-card > * {
    flex: 0 0 auto;
}
.dropdown-item {
    display: flex;
    align-items: center;
    justify-content: flex-start !important;
    width: 100%;
    height: auto;
    padding: 8px 10px;
    font-size: 13px;
    font-family: inherit;
    line-height: 1.4;
    color: var(--modal-text, #24292f);
    background: transparent;
    border: 0;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    text-decoration: none;
    box-sizing: border-box;
    gap: 10px;
    transition: background-color 0.12s ease, color 0.12s ease;
    -webkit-appearance: none;
    appearance: none;
}
.dropdown-item span {
    text-align: left;
    white-space: nowrap;
}
.dropdown-item svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
}
.dropdown-menu-label {
    padding: 5px 8px 4px;
    color: var(--toolbar-muted, #64748b);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}
.dropdown-item-rich {
    align-items: flex-start;
    padding: 9px 10px;
    border-radius: 8px;
}
.dropdown-item-rich svg {
    color: var(--modal-accent, #0969da);
    margin-top: 2px;
}
.dropdown-item-rich .dropdown-item-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
    text-align: left;
    white-space: normal;
}
.dropdown-item-copy strong,
.dropdown-item-copy small {
    display: block;
    white-space: nowrap;
}
.dropdown-item-copy strong {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.25;
    color: var(--modal-text, #24292f);
}
.dropdown-item-copy small {
    color: var(--toolbar-muted, #64748b);
    font-size: 11px;
    font-weight: 400;
    line-height: 1.3;
}
.dropdown-menu > .dropdown-item-rich,
.dropdown-group-card > .dropdown-item-rich {
    width: 100%;
    margin: 0;
    padding-inline: 10px;
}
.dropdown-item:hover,
.dropdown-item:focus-visible {
    background: var(--toolbar-bg-hover, #ebe6df);
}
.dropdown-item:focus-visible {
    outline: 2px solid var(--modal-accent, #0969da);
    outline-offset: -2px;
}
.dropdown-item:hover:not(.dropdown-danger-item) {
    color: var(--modal-accent, #0969da);
}
.dropdown-item:hover:not(.dropdown-danger-item) strong {
    color: var(--modal-accent, #0969da);
}
.dropdown-item-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--modal-text, #24292f);
}
.dropdown-item-toggle .opt-button {
    height: 26px;
    min-width: 60px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
}
.dropdown-divider {
    height: 1px;
    background-color: var(--modal-border, #d0d7de);
    margin: 8px 0;
}
.dropdown-danger-item {
    color: var(--toolbar-danger, #cf222e);
    font-weight: 600;
    border-radius: 6px;
    padding: 8px 10px;
}
.dropdown-danger-item:hover {
    background: var(--toolbar-danger-bg-hover, #ffebe9);
    color: var(--toolbar-danger, #cf222e);
}
@keyframes dropdownFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

.dropdown-item-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--modal-text, #24292f);
    gap: 8px;
}
.dropdown-item-control label {
    font-weight: 500;
}
.dropdown-item-label-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.dropdown-item-hint {
    font-size: 11px;
    color: var(--toolbar-muted, #64748b);
    line-height: 1.3;
}
.opt-select,
.share-vault-mode-select,
.share-expires-select,
.share-unlock-select,
.share-pulse-select {
    height: 28px;
    padding: 2px 8px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 6px;
    background: var(--modal-bg, #fff);
    color: var(--modal-text, #24292f);
    cursor: pointer;
    max-width: 170px;
    outline: none;
    box-sizing: border-box;
}
.opt-select:focus-visible,
.share-vault-mode-select:focus-visible,
.share-expires-select:focus-visible,
.share-unlock-select:focus-visible,
.share-pulse-select:focus-visible {
    border-color: var(--modal-accent, #0969da);
    outline: 2px solid var(--modal-accent, #0969da);
    outline-offset: 1px;
}
html[data-ui-theme="dark"] .opt-select,
html[data-ui-theme="dark"] .share-vault-mode-select,
html[data-ui-theme="dark"] .share-expires-select,
html[data-ui-theme="dark"] .share-unlock-select,
html[data-ui-theme="dark"] .share-pulse-select {
    background: var(--modal-bg, #1e293b);
    color: var(--modal-text, #f1f5f9);
    border-color: var(--modal-border, #334155);
}
html[data-ui-theme="dark"] .opt-select option,
html[data-ui-theme="dark"] .share-vault-mode-select option,
html[data-ui-theme="dark"] .share-expires-select option,
html[data-ui-theme="dark"] .share-unlock-select option,
html[data-ui-theme="dark"] .share-pulse-select option {
    background: #1e293b;
    color: #f1f5f9;
}
.share-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    margin: 4px 8px;
}
.share-status-badge-burning {
    background: rgba(225, 29, 72, 0.1);
    color: #e11d48;
    border: 1px solid rgba(225, 29, 72, 0.2);
}
.share-status-badge-expiring {
    background: rgba(234, 88, 12, 0.1);
    color: #ea580c;
    border: 1px solid rgba(234, 88, 12, 0.2);
}
.share-author-preview-banner {
    position: sticky;
    top: 0;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    background: #fffbeb;
    color: #92400e;
    border-bottom: 1px solid #fde68a;
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
/* Share notices and the reader occupy separate rows. Without this, the
   author notice becomes a full-height flex column beside the article and
   leaves mobile readers with a blank page. */
body.share-view .layer_3 {
    flex-direction: column;
}
body.share-view .share-author-preview-banner,
body.share-view .share-deadman-released-banner,
body.share-view .share-burn-active-banner {
    flex: 0 0 auto;
    width: 100%;
}
body.share-view #preview-md,
body.share-view #preview-plain {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    min-height: 0;
    height: 0;
}
body.share-view .canvas-editor-pane,
body.share-view .whiteboard-editor-pane {
    flex: 1 1 auto;
    min-height: 0;
    height: 0;
}
@media (prefers-color-scheme: dark) {
    .share-author-preview-banner {
        background: #2e2008;
        color: #fef08a;
        border-bottom-color: #78350f;
    }
}
.share-burn-active-banner {
    position: sticky;
    top: 0;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 16px;
    background: #fff1f2;
    color: #be123c;
    border-bottom: 1px solid #fecdd3;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
@media (prefers-color-scheme: dark) {
    .share-burn-active-banner {
        background: #3f0713;
        color: #fda4af;
        border-bottom-color: #9f1239;
    }
}
.share-burn-interstitial {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 60vh;
    padding: 32px 16px;
}
.burn-interstitial-card {
    max-width: 480px;
    width: 100%;
    background: var(--modal-bg, #ffffff);
    border: 1px solid var(--modal-border, #e2e8f0);
    border-radius: 16px;
    padding: 32px 24px;
    text-align: center;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
}
.burn-interstitial-icon {
    font-size: 48px;
    margin-bottom: 16px;
    line-height: 1;
}
.burn-interstitial-card h2 {
    margin: 0 0 12px;
    font-size: 20px;
    font-weight: 700;
    color: var(--modal-text, #1e293b);
}
.burn-interstitial-desc {
    margin: 0 0 20px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--toolbar-muted, #64748b);
}
.burn-interstitial-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(225, 29, 72, 0.08);
    border: 1px solid rgba(225, 29, 72, 0.2);
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 24px;
    font-size: 13px;
    color: #be123c;
    text-align: left;
}
.burn-reveal-btn {
    width: 100%;
    height: 44px;
    background: #e11d48;
    color: #ffffff;
    font-size: 15px;
    font-weight: 600;
    border: 0;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.1s ease;
}
.burn-reveal-btn:hover {
    background: #be123c;
    transform: translateY(-1px);
}
.burn-reveal-btn:active {
    transform: translateY(0);
}
.share-status-page {
    text-align: center;
    max-width: 440px;
    margin: 40px auto;
    padding: 32px 24px;
}
.share-status-icon {
    font-size: 48px;
    margin-bottom: 16px;
}
.share-status-page h2 {
    margin: 0 0 12px;
    font-size: 22px;
    font-weight: 700;
}
.share-status-desc {
    font-size: 14px;
    color: var(--toolbar-muted, #64748b);
    line-height: 1.6;
    margin: 0 0 20px;
}
.share-status-author-hint {
    font-size: 13px;
    color: var(--modal-accent, #0969da);
    background: rgba(9, 105, 218, 0.08);
    border: 1px solid rgba(9, 105, 218, 0.2);
    border-radius: 8px;
    padding: 10px 14px;
    margin: 0 0 20px;
}
.share-status-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
}
.share-countdown-wrapper {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin: 20px auto;
}
.countdown-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 58px;
    padding: 10px 8px;
    background: var(--toolbar-bg, #ffffff);
    border: 1px solid var(--modal-border, #e2dacd);
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.countdown-val {
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--modal-accent, #c8654b);
    line-height: 1.2;
}
.countdown-lbl {
    font-size: 11px;
    color: var(--toolbar-muted, #716c65);
    margin-top: 4px;
    text-transform: uppercase;
}
.share-countdown-notice {
    font-size: 12px;
    color: var(--toolbar-muted, #716c65);
    margin-bottom: 20px;
}
.share-deadman-released-banner {
    background: rgba(220, 38, 38, 0.08);
    border: 1px solid rgba(220, 38, 38, 0.3);
    color: #dc2626;
    padding: 10px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}
.share-vault-mode-select {
    max-width: 170px;
    flex-shrink: 0;
}
.vault-preset-menu-row {
    margin-bottom: 8px;
}
.vault-presets-toolbar-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
}
.vault-presets-modal-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--modal-bg, #ffffff);
    color: var(--modal-text, #2c2a29);
    border: 1px solid var(--modal-border, #e2dacd);
    padding: 20px 24px;
    border-radius: 14px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.32);
    z-index: 1001;
    width: min(860px, calc(100vw - 32px));
    max-height: min(88vh, 780px);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
html[data-ui-theme="dark"] .vault-presets-modal-content {
    background: var(--modal-bg, #1e293b);
    color: var(--modal-text, #f1f5f9);
    border-color: var(--modal-border, #334155);
}
.vault-presets-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    flex-shrink: 0;
}
.vault-presets-header-bar .close-btn {
    position: static;
}
.vault-presets-lang-group {
    display: inline-flex;
    align-items: center;
    background: var(--input-border, rgba(0, 0, 0, 0.08));
    padding: 2px;
    border-radius: 999px;
    gap: 2px;
}
.vault-pref-lang-btn {
    border: 0;
    background: transparent;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--modal-muted, #7c7670);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    line-height: 1.2;
}
.vault-pref-lang-btn:hover {
    color: var(--modal-text, #2c2a29);
}
.vault-pref-lang-btn.is-active {
    background: var(--modal-bg, #ffffff);
    color: var(--theme-accent, #c8654b);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
html[data-ui-theme="dark"] .vault-presets-lang-group {
    background: var(--modal-border, rgba(255, 255, 255, 0.1));
}
html[data-ui-theme="dark"] .vault-pref-lang-btn {
    color: var(--modal-muted, #94a3b8);
}
html[data-ui-theme="dark"] .vault-pref-lang-btn:hover {
    color: var(--modal-text, #f1f5f9);
}
html[data-ui-theme="dark"] .vault-pref-lang-btn.is-active {
    background: var(--modal-surface, #334155);
    color: var(--theme-accent, #f97316);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}
.vault-presets-modal-content .close-btn {
    position: static;
    top: auto;
    right: auto;
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: var(--modal-muted, #7c7670);
    cursor: pointer;
    font-size: 22px;
    line-height: 1;
    border-radius: 8px;
    transition: background 0.15s ease, color 0.15s ease;
    flex-shrink: 0;
}
.vault-presets-modal-content .close-btn:hover {
    background: var(--modal-surface-hover, rgba(0, 0, 0, 0.08));
    color: var(--modal-text, #2c2a29);
}
html[data-ui-theme="dark"] .vault-presets-modal-content .close-btn {
    color: var(--modal-muted, #94a3b8);
}
html[data-ui-theme="dark"] .vault-presets-modal-content .close-btn:hover {
    background: var(--modal-surface-hover, rgba(255, 255, 255, 0.1));
    color: var(--modal-text, #f1f5f9);
}
.vault-presets-header {
    margin-bottom: 12px;
    padding-right: 0;
    flex-shrink: 0;
}
.vault-presets-title {
    margin: 0 0 6px 0;
    font-size: 1.15rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--modal-text, #2c2a29);
}
.vault-presets-title svg {
    width: 22px;
    height: 22px;
    color: var(--modal-accent, #c8654b);
}
html[data-ui-theme="dark"] .vault-presets-title {
    color: var(--modal-text, #f1f5f9);
}
.vault-presets-subtitle {
    margin: 0;
    font-size: 0.86rem;
    color: var(--modal-muted, #7c7670);
    line-height: 1.45;
}
html[data-ui-theme="dark"] .vault-presets-subtitle {
    color: var(--modal-muted, #94a3b8);
}
.seal-modal-body-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 6px;
    margin-right: -4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-gutter: stable;
}
.seal-modal-body-scroll::-webkit-scrollbar {
    width: 6px;
}
.seal-modal-body-scroll::-webkit-scrollbar-track {
    background: transparent;
}
.seal-modal-body-scroll::-webkit-scrollbar-thumb {
    background: var(--modal-border, #cbd5e1);
    border-radius: 4px;
}
.seal-modal-body-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--modal-muted, #94a3b8);
}
html[data-ui-theme="dark"] .seal-modal-body-scroll::-webkit-scrollbar-thumb {
    background: #475569;
}
html[data-ui-theme="dark"] .seal-modal-body-scroll::-webkit-scrollbar-thumb:hover {
    background: #64748b;
}
.vault-presets-body {
    padding: 2px 2px 6px 2px;
}
.vault-presets-modal-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}
@media (max-width: 768px) {
    .vault-presets-modal-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
@media (max-width: 640px) {
    .vault-presets-modal-grid {
        grid-template-columns: 1fr;
    }
}
.vault-preset-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 15px;
    border-radius: 12px;
    border: 1px solid var(--modal-border, #e2dacd);
    background: var(--modal-surface, #f8fafc);
    color: var(--modal-text, #2c2a29);
    cursor: pointer;
    transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
    text-align: left;
    position: relative;
    outline: none;
    box-sizing: border-box;
}
html[data-ui-theme="dark"] .vault-preset-card {
    background: var(--modal-surface, #0f172a);
    color: var(--modal-text, #f1f5f9);
    border-color: var(--modal-border, #334155);
}
.vault-preset-card:hover {
    border-color: var(--modal-accent, #c8654b);
    background: var(--modal-surface-hover, rgba(200, 101, 75, 0.05));
    transform: translateY(-2px);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}
html[data-ui-theme="dark"] .vault-preset-card:hover {
    border-color: var(--modal-accent, #38bdf8);
    background: var(--modal-surface-hover, #1e293b);
}
.vault-preset-card:focus-visible {
    outline: 2px solid var(--modal-accent, #c8654b);
    outline-offset: 2px;
}
html[data-ui-theme="dark"] .vault-preset-card:focus-visible {
    outline-color: var(--modal-accent, #38bdf8);
}
.vault-preset-card.active {
    border-color: var(--modal-accent, #c8654b);
    background: rgba(200, 101, 75, 0.1);
}
html[data-ui-theme="dark"] .vault-preset-card.active {
    border-color: var(--modal-accent, #38bdf8);
    background: rgba(56, 189, 248, 0.15);
}
.preset-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.preset-card-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--modal-surface-hover, rgba(0, 0, 0, 0.05));
    color: var(--modal-accent, #c8654b);
    flex-shrink: 0;
}
.preset-card-icon svg {
    width: 18px;
    height: 18px;
}
.preset-card-icon.mode-burn {
    color: #ea580c;
    background: rgba(234, 88, 12, 0.12);
}
.preset-card-icon.mode-timelock {
    color: #6366f1;
    background: rgba(99, 102, 241, 0.12);
}
.preset-card-icon.mode-deadman {
    color: #e11d48;
    background: rgba(225, 29, 72, 0.12);
}
.preset-card-icon.mode-standard {
    color: #0284c7;
    background: rgba(2, 132, 199, 0.12);
}
.preset-card-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
    line-height: 1.3;
    white-space: nowrap;
}
.preset-card-badge.mode-burn {
    color: #c2410c;
    background: rgba(234, 88, 12, 0.12);
}
.preset-card-badge.mode-timelock {
    color: #4f46e5;
    background: rgba(99, 102, 241, 0.12);
}
.preset-card-badge.mode-deadman {
    color: #be123c;
    background: rgba(225, 29, 72, 0.12);
}
.preset-card-badge.mode-standard {
    color: #0369a1;
    background: rgba(2, 132, 199, 0.12);
}
html[data-ui-theme="dark"] .preset-card-badge.mode-burn {
    color: #fb923c;
    background: rgba(234, 88, 12, 0.22);
}
html[data-ui-theme="dark"] .preset-card-badge.mode-timelock {
    color: #818cf8;
    background: rgba(99, 102, 241, 0.22);
}
html[data-ui-theme="dark"] .preset-card-badge.mode-deadman {
    color: #f43f5e;
    background: rgba(225, 29, 72, 0.22);
}
html[data-ui-theme="dark"] .preset-card-badge.mode-standard {
    color: #38bdf8;
    background: rgba(2, 132, 199, 0.22);
}
.preset-card-title {
    display: block;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--modal-text, #2c2a29);
    line-height: 1.3;
}
html[data-ui-theme="dark"] .preset-card-title {
    color: var(--modal-text, #f1f5f9);
}
.preset-card-desc {
    display: block;
    font-size: 12px;
    color: var(--modal-muted, #7c7670);
    line-height: 1.4;
}
html[data-ui-theme="dark"] .preset-card-desc {
    color: var(--modal-muted, #94a3b8);
}
.vault-presets-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--modal-border, #e2dacd);
}
html[data-ui-theme="dark"] .vault-presets-footer {
    border-color: var(--modal-border, #334155);
}
.vault-presets-tip {
    font-size: 12px;
    color: var(--modal-muted, #7c7670);
}
html[data-ui-theme="dark"] .vault-presets-tip {
    color: var(--modal-muted, #94a3b8);
}

/* Seal Access Control Toolbar & Dropdown & Modal Styles */
.seal-toolbar-btn {
    position: relative;
}
.seal-dot-indicator {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 0 1.5px var(--toolbar-bg, #ffffff);
}
.seal-status-pill {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--input-border, rgba(0, 0, 0, 0.08));
    color: var(--modal-muted, #64748b);
    line-height: 1.2;
}
.seal-status-pill.is-sealed {
    background: rgba(16, 185, 129, 0.15);
    color: #059669;
}
html[data-ui-theme="dark"] .seal-status-pill.is-sealed {
    background: rgba(16, 185, 129, 0.25);
    color: #34d399;
}

.seal-modal-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}
.seal-header-badge-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}
.seal-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    line-height: 1.3;
}
.seal-status-badge.badge-unsealed {
    background: var(--input-border, rgba(0, 0, 0, 0.08));
    color: var(--modal-muted, #7c7670);
    border: 1px solid transparent;
}
html[data-ui-theme="dark"] .seal-status-badge.badge-unsealed {
    background: rgba(255, 255, 255, 0.08);
    color: var(--modal-muted, #94a3b8);
}
.seal-status-badge.badge-sealed {
    background: rgba(16, 185, 129, 0.12);
    color: #059669;
    border: 1px solid rgba(16, 185, 129, 0.3);
}
html[data-ui-theme="dark"] .seal-status-badge.badge-sealed {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border-color: rgba(16, 185, 129, 0.4);
}
.seal-header-right-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}
.seal-modal-header {
    margin-bottom: 14px;
}
.seal-modal-title {
    margin: 0 0 6px 0;
    font-size: 1.15rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--modal-text, #2c2a29);
}
.seal-modal-subtitle {
    margin: 0;
    font-size: 0.84rem;
    color: var(--modal-muted, #7c7670);
    line-height: 1.45;
}
html[data-ui-theme="dark"] .seal-modal-subtitle {
    color: var(--modal-muted, #94a3b8);
}

.seal-config-section {
    background: var(--modal-surface, #f8fafc);
    border: 1px solid var(--modal-border, #e2dacd);
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
html[data-ui-theme="dark"] .seal-config-section {
    background: var(--modal-surface, #0f172a);
    border-color: var(--modal-border, #334155);
}
.seal-form-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
}
@media (max-width: 640px) {
    .seal-form-row {
        flex-direction: column;
        gap: 6px;
    }
}
.seal-form-label {
    width: 140px;
    font-size: 13px;
    font-weight: 600;
    color: var(--modal-text, #2c2a29);
    padding-top: 7px;
    flex-shrink: 0;
}
html[data-ui-theme="dark"] .seal-form-label {
    color: var(--modal-text, #f1f5f9);
}
.seal-form-control {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
}
.seal-mode-select {
    max-width: 280px;
    width: 100%;
    height: 36px;
    font-size: 13px;
    font-weight: 500;
}
.seal-input-composite {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    width: 100%;
}
.seal-input {
    height: 36px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid var(--input-border, #cbd5e1);
    background: var(--input-bg, #ffffff);
    color: var(--modal-text, #1e293b);
    font-size: 13px;
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
html[data-ui-theme="dark"] .seal-input {
    background: var(--input-bg, #1e293b);
    border-color: var(--input-border, #475569);
    color: var(--modal-text, #f1f5f9);
}
.seal-input:focus {
    border-color: var(--modal-accent, #c8654b);
    box-shadow: 0 0 0 2px rgba(200, 101, 75, 0.15);
    outline: none;
}
html[data-ui-theme="dark"] .seal-input:focus {
    border-color: var(--modal-accent, #38bdf8);
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
}
.seal-number-input {
    width: 120px;
}
.seal-input-addon {
    font-size: 12.5px;
    color: var(--modal-muted, #64748b);
    white-space: nowrap;
}
.seal-quick-chips {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
}
.seal-chip-btn {
    border: 1px solid var(--modal-border, #cbd5e1);
    background: var(--modal-bg, #ffffff);
    color: var(--modal-text, #334155);
    padding: 4px 9px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    line-height: 1.3;
    transition: all 0.12s ease;
}
html[data-ui-theme="dark"] .seal-chip-btn {
    background: var(--modal-surface, #1e293b);
    border-color: var(--modal-border, #334155);
    color: var(--modal-text, #cbd5e1);
}
.seal-chip-btn:hover {
    border-color: var(--modal-accent, #c8654b);
    color: var(--modal-accent, #c8654b);
    background: var(--modal-surface-hover, rgba(0, 0, 0, 0.04));
}
html[data-ui-theme="dark"] .seal-chip-btn:hover {
    border-color: var(--modal-accent, #38bdf8);
    color: var(--modal-accent, #38bdf8);
    background: var(--modal-surface-hover, rgba(255, 255, 255, 0.06));
}
.seal-field-hint {
    font-size: 11.5px;
    color: var(--modal-muted, #7c7670);
    line-height: 1.4;
}
html[data-ui-theme="dark"] .seal-field-hint {
    color: var(--modal-muted, #94a3b8);
}
.seal-deadman-live-box {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(225, 29, 72, 0.08);
    border: 1px solid rgba(225, 29, 72, 0.2);
    margin-top: 4px;
}
.seal-deadman-live-text {
    font-size: 12px;
    font-weight: 500;
    color: #e11d48;
}
.seal-pulse-btn {
    padding: 4px 10px !important;
    font-size: 12px !important;
    height: 28px !important;
}
.seal-presets-accordion {
    margin-top: 4px;
}
.seal-presets-accordion-header {
    margin-bottom: 8px;
}
.seal-presets-accordion-title {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--modal-text, #2c2a29);
}
html[data-ui-theme="dark"] .seal-presets-accordion-title {
    color: var(--modal-text, #f1f5f9);
}
.seal-modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid var(--modal-border, #e2dacd);
    flex-shrink: 0;
}
html[data-ui-theme="dark"] .seal-modal-footer {
    border-color: var(--modal-border, #334155);
}
.seal-footer-left {
    display: flex;
    align-items: center;
    gap: 8px;
}
.seal-footer-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.opt-button-danger {
    background: #ef4444 !important;
    color: #ffffff !important;
    border-color: #dc2626 !important;
}
.opt-button-danger:hover {
    background: #dc2626 !important;
}

/* Seal Visitor Status Page Card */
.seal-visitor-brand {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--modal-muted, #64748b);
    margin-bottom: 12px;
}
.seal-visitor-info-box {
    background: var(--modal-surface, #f8fafc);
    border: 1px solid var(--modal-border, #e2dacd);
    border-radius: 12px;
    padding: 14px 18px;
    margin: 16px 0;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
}
html[data-ui-theme="dark"] .seal-visitor-info-box {
    background: var(--modal-surface, #0f172a);
    border-color: var(--modal-border, #334155);
}
.seal-info-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
}
.seal-info-label {
    color: var(--modal-muted, #64748b);
    font-weight: 500;
}
.seal-info-value {
    color: var(--modal-text, #1e293b);
    font-weight: 600;
}
html[data-ui-theme="dark"] .seal-info-value {
    color: var(--modal-text, #f1f5f9);
}
.seal-countdown-sentence {
    font-size: 18px;
    font-weight: 700;
    color: var(--modal-accent, #c8654b);
    margin: 10px 0 4px;
    font-variant-numeric: tabular-nums;
}
html[data-ui-theme="dark"] .seal-countdown-sentence {
    color: var(--modal-accent, #38bdf8);
}

/* Share, New note, Export, Copy & Theme dropdowns */
.share-dropdown .dropdown-menu,
.new-note-dropdown .dropdown-menu,
.export-dropdown .dropdown-menu,
.copy-dropdown .dropdown-menu {
    min-width: 250px;
    max-height: min(620px, calc(100dvh - 24px));
    overflow-y: auto;
    scrollbar-gutter: stable;
    border-radius: 12px;
}
.share-menu-trigger,
.new-note-menu-trigger,
.export-menu-trigger,
.copy-menu-trigger {
    width: auto;
    min-width: var(--toolbar-height);
    padding: 0 6px;
    gap: 4px;
}
.share-menu-trigger .toolbar-button-caret,
.new-note-menu-trigger .toolbar-button-caret,
.export-menu-trigger .toolbar-button-caret,
.copy-menu-trigger .toolbar-button-caret,
.toolbar-button-caret {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    line-height: 1;
    opacity: 0.7;
    flex-shrink: 0;
}
.share-menu-trigger.is-published {
    color: var(--toolbar-publish-active-color, #1a7f37);
    font-weight: 600;
}
html[data-ui-theme="dark"] .share-menu-trigger.is-published {
    color: #3fb950;
}
.new-note-plus {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    font-size: 15px;
    font-weight: 600;
    line-height: 1;
    text-align: center;
}

/* Split action capsule for Share mode (Edit + New dropdown) */
.split-action-group {
    display: inline-flex;
    align-items: stretch;
    background: var(--toolbar-bg);
    border: 1px solid var(--toolbar-border);
    border-radius: var(--toolbar-radius);
    height: var(--toolbar-height);
    box-sizing: border-box;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}
.split-action-group:hover {
    border-color: var(--toolbar-border-hover, var(--toolbar-accent));
}
.split-action-group .split-action-main {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 9px;
    height: 100%;
    border: 0;
    background: transparent;
    color: var(--toolbar-text);
    text-decoration: none;
    font-size: 13px;
    font-weight: 650;
    cursor: pointer;
    border-top-left-radius: calc(var(--toolbar-radius) - 1px);
    border-bottom-left-radius: calc(var(--toolbar-radius) - 1px);
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    transition: background-color 0.12s ease, color 0.12s ease;
}
.split-action-group .split-action-main:hover {
    background: var(--toolbar-bg-hover);
    color: var(--toolbar-accent);
}
.split-action-group .split-action-dropdown {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 0 7px;
    height: 100%;
    border: 0;
    border-left: 1px solid var(--toolbar-border);
    background: transparent;
    color: var(--toolbar-text);
    cursor: pointer;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-top-right-radius: calc(var(--toolbar-radius) - 1px);
    border-bottom-right-radius: calc(var(--toolbar-radius) - 1px);
    transition: background-color 0.12s ease, color 0.12s ease;
}
.split-action-group .split-action-dropdown:hover {
    background: var(--toolbar-bg-hover);
    color: var(--toolbar-accent);
}
.split-action-group .split-action-dropdown .new-note-plus {
    font-size: 13px;
    line-height: 1;
}
.split-action-group .split-action-dropdown .toolbar-button-caret {
    font-size: 10px;
    opacity: 0.75;
}

.theme-dropdown .dropdown-menu {
    min-width: 220px;
    max-height: 360px;
    overflow-y: auto;
    overscroll-behavior: contain;
}
.theme-item {
    display: flex;
    align-items: center;
    justify-content: space-between !important;
    padding: 8px 10px;
    font-size: 13px;
    cursor: pointer;
    border: 0;
    background: transparent;
    width: 100%;
    box-sizing: border-box;
    color: var(--toolbar-text, #24292f);
    border-radius: 8px;
    transition: background 0.1s ease, color 0.1s ease;
}
.theme-item:hover,
.theme-item:focus-visible,
.width-item:hover,
.width-item:focus-visible {
    background: var(--toolbar-bg-hover, #ebe6df);
}
.theme-item.is-active {
    font-weight: 600;
    color: var(--accent-color, #0969da);
}
.theme-item-name {
    text-align: left;
}
.theme-item-check {
    font-weight: bold;
    color: var(--accent-color, #0969da);
    margin-left: 8px;
}

.width-dropdown .dropdown-menu {
    min-width: 175px;
}
.width-item {
    display: flex;
    align-items: center;
    justify-content: space-between !important;
    padding: 8px 10px;
    font-size: 13px;
    cursor: pointer;
    border: 0;
    background: transparent;
    width: 100%;
    box-sizing: border-box;
    color: var(--toolbar-text, #24292f);
    border-radius: 8px;
    transition: background 0.1s ease, color 0.1s ease;
}
.width-item.is-active {
    font-weight: 600;
    color: var(--accent-color, #0969da);
}
.width-item-name {
    text-align: left;
}
.width-item-check {
    font-weight: bold;
    color: var(--accent-color, #0969da);
    margin-left: 8px;
}

/* Mobile more dropdown: hidden on desktop, shown on mobile */
.more-dropdown {
    display: none !important;
    position: relative;
}
.mobile-more-btn {
    display: none !important;
}
.more-dropdown-menu {
    min-width: 250px;
    max-width: 320px;
}

/* Shared state indicator: green dot on published state */
.share-dropdown .share-menu-trigger.is-published::after {
    content: '';
    position: absolute;
    top: 5px;
    right: 5px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #2da44e;
    border: 1px solid var(--toolbar-bg, #faf9f5);
}
.share-dropdown {
    position: relative;
}

.selection-ai-menu {
    position: fixed;
    z-index: 20010;
    display: none;
    align-items: center;
    gap: 5px;
    padding: 4px;
    border: 1px solid #b95f42;
    border-radius: 8px;
    background: #24221f;
    box-shadow: 0 8px 24px rgba(37, 35, 32, 0.24);
}
.selection-ai-menu.visible {
    display: inline-flex;
}
.selection-ai-button {
    appearance: none;
    border: 0;
    padding: 7px 11px;
    border-radius: 5px;
    background: transparent;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
}
.selection-ai-button:hover {
    background: #cc785c;
}

/* Bottom Sheet (Mobile) */
.bottom-sheet {
    position: fixed;
    inset: 0;
    z-index: 1050;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    pointer-events: none;
}
.bottom-sheet.show {
    pointer-events: auto;
}
.bottom-sheet-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(37, 35, 32, 0.4);
    backdrop-filter: blur(2px);
    opacity: 0;
    transition: opacity 0.25s ease;
    pointer-events: none;
}
.bottom-sheet.show .bottom-sheet-backdrop {
    opacity: 1;
    pointer-events: auto;
}
.bottom-sheet-content {
    position: relative;
    background: #faf9f5;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 30px rgba(108, 106, 100, 0.15);
    width: 100%;
    max-height: 80dvh;
    display: flex;
    flex-direction: column;
    transform: translateY(100%);
    transition: transform 0.28s cubic-bezier(0.32, 0.94, 0.6, 1);
    z-index: 1;
}
.bottom-sheet.show .bottom-sheet-content {
    transform: translateY(0);
}
.bottom-sheet-drag-handle {
    width: 36px;
    height: 4px;
    background: var(--toolbar-border, #d0d7de);
    border-radius: 2px;
    margin: 8px auto 0;
    cursor: grab;
}
.bottom-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 8px;
    border-bottom: 1px solid var(--toolbar-border, #d0d7de);
}
.bottom-sheet-header h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--toolbar-text, #24292f);
}
.bottom-sheet-close-btn {
    background: transparent;
    border: 0;
    color: var(--toolbar-muted, #57606a);
    padding: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
}
.bottom-sheet-body {
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    touch-action: pan-y;
}
.bottom-sheet-body .footer-section {
    width: 100%;
    flex-wrap: wrap;
    align-items: flex-start;
    border-right: 0;
    border-bottom: 1px solid var(--toolbar-border, #d8dee4);
    padding: 0 0 16px;
}
.bottom-sheet-body .footer-section:last-child {
    border-bottom: 0;
    padding-bottom: 0;
}
.bottom-sheet-body .footer-section-body {
    width: 100%;
    flex-wrap: wrap;
    gap: 10px;
}

/* Toast System */
#toast-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 20000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    width: min(520px, calc(100vw - 32px));
    align-items: center;
}
.toast {
    background: rgba(20, 20, 19, 0.95);
    border: 1px solid rgba(230, 223, 216, 0.15);
    backdrop-filter: blur(8px);
    color: #fff;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 8px 24px rgba(108, 106, 100, 0.15);
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    text-align: center;
    opacity: 0;
    transform: translateY(-8px);
    transition: opacity 0.22s ease, transform 0.22s ease;
}
.toast.show {
    opacity: 1;
    transform: translateY(0);
}
.toast-check {
    font-weight: bold;
    margin-right: 2px;
    color: #cc785c;
}

/* Footer */
.footer {
    font-weight: bold;
    min-height: 48px;
    background: var(--footer-bg, #faf9f5);
    border-top: 1px solid var(--footer-border, #e6dfd8);
    display: block;
    padding: 0 12px;
    font-size: 13px;
    color: var(--footer-text, #5c5a54);
    position: relative;
    z-index: 100;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    transition: transform 0.22s ease, opacity 0.22s ease, background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.footer::-webkit-scrollbar {
    display: none;
}
.footer-sections {
    min-height: 48px;
    display: flex;
    align-items: stretch;
    gap: 10px;
    flex-wrap: nowrap;
    white-space: nowrap;
    padding: 5px 0 6px;
}
.footer-section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px 4px 0;
    border-right: 1px solid var(--footer-border, #e6dfd8);
    background: transparent;
}
.footer-section:last-child {
    border-right: 0;
    padding-right: 0;
}
.footer-section-create {
    flex: 0 0 auto;
}
.footer-section-edit {
    flex: 0 0 auto;
}
.footer-section-publish {
    flex: 0 0 auto;
}
.footer-section-appearance {
    flex: 1 1 auto;
    min-width: max-content;
}
.footer-section-info {
    flex: 0 0 auto;
}
.footer-section-body {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
}
.footer-select {
    display: inline-block;
    width: auto;
    font-size: 12px;
    vertical-align: middle;
    --wa-input-border-radius: var(--toolbar-radius);
}
.footer-select::part(combobox) {
    height: var(--toolbar-height);
    min-height: var(--toolbar-height);
    border-color: var(--toolbar-border);
    border-radius: var(--toolbar-radius);
    background: var(--toolbar-bg);
    color: var(--toolbar-text);
    transition: border-color 0.15s ease, background-color 0.15s ease;
}
.footer-select::part(display-input) {
    font-size: 12px;
    color: var(--toolbar-text);
    font-weight: 700;
}
.footer-select::part(icon) {
    color: var(--toolbar-text);
}
.footer-select::part(listbox) {
    width: min(360px, calc(100vw - 16px));
    max-width: calc(100vw - 16px);
    overflow-x: hidden;
}
.footer-select::part(combobox):hover {
    background-color: var(--toolbar-bg-hover);
    border-color: var(--toolbar-accent);
}
#preview-width-selector {
    width: 112px;
    max-width: 112px;
}
#theme-selector {
    width: auto;
    min-width: 104px;
    max-width: 130px;
}
.footer-control-group {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
}
#share-analytics-hook {
    display: inline-flex;
    align-items: center;
}
.share-view-count {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: var(--toolbar-height);
    padding: 0 8px;
    color: var(--toolbar-text);
    font-size: 12px;
    white-space: nowrap;
}
.share-view-count .svg-icon {
    width: 15px;
    height: 15px;
}
.footer-toggle-control-group {
    height: var(--toolbar-height);
    justify-content: center;
}
#language-selector,
#share-font-selector {
    display: inline-flex;
    align-items: center;
    height: var(--toolbar-height);
    line-height: 0;
}
.footer-view-settings-group {
    display: inline-flex;
    align-items: center;
    gap: 0; /* Primer button group collapses gap */
    height: var(--toolbar-height);
    padding: 0;
    border: 0;
    background: transparent;
}
.footer-view-settings-group .footer-control-group {
    display: inline-flex;
    gap: 0;
}
.footer-view-settings-group .footer-rail-switch {
    border-radius: 0;
    margin-right: -1px;
}
.footer-view-settings-group > :first-child .footer-rail-switch {
    border-top-left-radius: 4px;
    border-bottom-left-radius: 4px;
}
.footer-view-settings-group > :last-child .footer-rail-switch {
    border-top-right-radius: 4px;
    border-bottom-right-radius: 4px;
    margin-right: 0;
}
.footer-view-settings-group .footer-rail-switch:hover,
.footer-view-settings-group .footer-rail-switch:focus-visible,
.footer-view-settings-group .footer-rail-switch.is-checked {
    z-index: 1;
}
.footer-control-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--toolbar-muted, #6c6a64);
    line-height: 1;
    pointer-events: none;
}
.sync-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--toolbar-border, #e6dfd8);
    border-radius: 9999px;
    background: var(--toolbar-bg, #faf9f5);
    color: var(--toolbar-fg, var(--toolbar-text, #2b2a27));
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    user-select: none;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.sync-status-badge:hover {
    border-color: var(--toolbar-accent, #cc785c);
    background: color-mix(in srgb, var(--toolbar-bg, #faf9f5) 90%, var(--toolbar-accent, #cc785c));
    transform: translateY(-0.5px);
}
.sync-status-badge:active {
    transform: scale(0.97);
}
.sync-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    display: inline-block;
    flex-shrink: 0;
    transition: background-color 0.25s ease, transform 0.25s ease;
}
.sync-status-badge[data-status="local"] .sync-status-dot {
    background: #10b981;
}
.sync-status-badge[data-status="cloud-synced"] .sync-status-dot {
    background: #3b82f6;
}
.sync-status-badge[data-status="syncing"] .sync-status-dot {
    background: #f59e0b;
    animation: sync-dot-pulse 1s infinite alternate;
}
.sync-status-badge[data-status="pending"] .sync-status-dot {
    background: #f97316;
}
.sync-status-badge[data-status="error"] .sync-status-dot {
    background: #ef4444;
}
@keyframes sync-dot-pulse {
    from { opacity: 0.4; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1.2); }
}
.save-control-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    border: 1px solid var(--toolbar-border, #e6dfd8);
    border-radius: var(--toolbar-radius, 6px);
    background: color-mix(in srgb, var(--toolbar-bg, #faf9f5) 92%, var(--toolbar-accent, #cc785c));
}
.autosave-toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-height: var(--toolbar-height);
    padding: 0 4px;
    color: var(--toolbar-muted, #6c6a64);
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
}
.autosave-toggle-label input {
    margin: 0;
    accent-color: var(--toolbar-accent, #cc785c);
}
.autosave-toggle-label input:disabled {
    cursor: not-allowed;
}

/* Thumb-free 3D Flip Card Toggle Switch */
.footer-rail-switch {
    perspective: 400px;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--toolbar-height);
    height: var(--toolbar-height);
    padding: 0;
    border: 1px solid var(--toolbar-border, #e2dacd);
    border-radius: 4px;
    background: transparent;
    color: var(--toolbar-text, #2c2a29);
    cursor: pointer;
    box-sizing: border-box;
}
.footer-rail-switch:focus-visible {
    outline: 2px solid var(--toolbar-accent, #c8654b);
    outline-offset: 1px;
}

.footer-rail-switch .btn-flip-front,
.footer-rail-switch .btn-flip-back {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
    border-radius: inherit;
    padding: 0 8px;
    gap: 4px;
    background: var(--toolbar-bg-hover, #eae3d5);
    box-sizing: border-box;
}

.footer-rail-switch .btn-flip-front {
    position: relative;
    transform: rotateY(0deg);
}

.footer-rail-switch .btn-flip-back {
    position: absolute;
    inset: 0;
    background: var(--rail-checked-bg, var(--toolbar-layout-bg));
    color: #ffffff;
    transform: rotateY(-180deg);
}

.footer-rail-switch.is-checked .btn-flip-front {
    transform: rotateY(180deg);
    opacity: 0;
}
.footer-rail-switch.is-checked .btn-flip-back {
    transform: rotateY(0deg);
    opacity: 1;
}

.footer-rail-switch .footer-rail-value {
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
}
.footer-rail-switch .footer-rail-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.footer-rail-switch .svg-icon {
    width: 13px;
    height: 13px;
    stroke-width: 2.2;
}


/* Body-level floating tooltip: remains visible outside horizontal scrollers. */
.floating-tooltip {
    position: fixed;
    z-index: 20030;
    max-width: calc(100vw - 16px);
    padding: 4px 8px;
    background: var(--tooltip-bg, #2c2a29);
    color: var(--tooltip-text, #f9f6f0);
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    border-radius: 5px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
    pointer-events: none;
    animation: floatingTooltipIn 0.1s ease-out;
}
.floating-tooltip[hidden] {
    display: none;
}
@keyframes floatingTooltipIn {
    from { opacity: 0; transform: translateY(3px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.share-font-toggle {
    display: inline-flex;
    align-items: center;
}
.share-font-switch {
    width: 62px;
}
#share-font-selector .footer-rail-switch {
    --rail-checked-bg: var(--toolbar-appearance-bg);
}
#language-selector .footer-rail-switch {
    --rail-checked-bg: var(--toolbar-language-bg);
}
.autosave-rail-switch {
    min-width: 48px;
    --rail-checked-bg: var(--toolbar-accent, #c8654b);
}
.autosave-rail-switch[disabled],
.autosave-rail-switch.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}
.share-font-switch.is-checked .footer-rail-thumb {
    transform: translateX(34px);
}
#split-direction-selector .footer-rail-switch {
    width: 58px;
    --rail-checked-bg: var(--toolbar-layout-bg);
}
#split-direction-selector .footer-rail-switch.is-checked .footer-rail-thumb {
    transform: translateX(30px);
}
.preview-device-toggle {
    width: 70px;
    --rail-checked-bg: var(--toolbar-layout-bg);
}
.preview-device-toggle.is-checked .footer-rail-thumb {
    transform: translateX(42px);
}
.footer-select:hover {
    cursor: pointer;
}
.footer-select:focus-visible {
    outline: 2px solid var(--toolbar-accent);
    outline-offset: 1px;
}
.segmented-toggle {
    display: inline-flex;
    align-items: center;
    height: var(--toolbar-height);
    border: 1px solid var(--toolbar-border);
    border-radius: var(--toolbar-radius);
    background: var(--toolbar-bg);
    overflow: hidden;
}
.segmented-toggle-btn {
    min-width: 34px;
    height: calc(var(--toolbar-height) - 2px);
    padding: 0 8px;
    border: 0;
    border-right: 1px solid var(--toolbar-border);
    background: transparent;
    color: var(--toolbar-muted);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    line-height: calc(var(--toolbar-height) - 2px);
    transition: background-color 0.15s ease, color 0.15s ease;
}
.segmented-toggle-btn:last-child {
    border-right: 0;
}
.segmented-toggle-btn:hover {
    background: var(--toolbar-bg-hover);
    color: var(--toolbar-text);
}
.segmented-toggle-btn.active {
    background: var(--toolbar-layout-bg);
    color: #fff;
}
.segmented-toggle-btn:focus-visible {
    position: relative;
    z-index: 1;
    outline: 2px solid #0969da;
    outline-offset: -2px;
}
.preview-device-toggle .segmented-toggle-btn {
    min-width: 48px;
}
.footer-label {
    font-size: 12px;
    color: var(--toolbar-muted);
    white-space: nowrap;
    margin-right: 4px;
}
.footer :is(button, a, label) {
    font-weight: 700;
}
.opt-button {
    height: var(--toolbar-height);
    min-width: var(--toolbar-height);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 0 10px;
    border: 1px solid var(--toolbar-border);
    border-radius: var(--toolbar-radius);
    background: var(--toolbar-bg);
    color: var(--toolbar-text);
    cursor: pointer;
    font-size: 12px;
    font-weight: 650;
    line-height: 1;
    text-decoration: none;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, transform 0.08s ease;
}
.opt-button:active,
.toolbar-icon-button:active {
    transform: scale(0.95);
}
.opt-button:hover,
.toolbar-icon-button:hover {
    background: var(--toolbar-bg-hover);
    border-color: var(--toolbar-accent);
}
.opt-button:focus-visible,
.toolbar-icon-button:focus-visible {
    outline: 2px solid var(--toolbar-accent);
    outline-offset: 1px;
}
.opt-button:disabled,
.toolbar-icon-button:disabled {
    cursor: not-allowed;
    color: var(--toolbar-muted);
    background: color-mix(in srgb, var(--toolbar-bg) 86%, var(--toolbar-text));
}
.opt-button-icon {
    width: var(--toolbar-height);
    padding: 0;
    font-size: 14px;
}
.toolbar-icon-button,
.toolbar-icon-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: var(--toolbar-height);
    width: var(--toolbar-height);
    min-width: var(--toolbar-height);
    padding: 0;
    font-size: 14px;
    box-sizing: border-box;
    border-radius: 4px;
    background: transparent;
    border: 1px solid var(--toolbar-border, #e2dacd);
    color: var(--toolbar-text, #2c2a29);
    transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.1s ease;
}
.toolbar-icon-button:hover,
.toolbar-icon-link:hover {
    background: var(--toolbar-bg-hover, #eae3d5);
    color: var(--toolbar-accent, #c8654b);
    border-color: var(--toolbar-accent, #c8654b);
}

.toolbar-button-label {
    display: none !important;
}

.copy-button-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 14px;
}
.copy-button-icon-success { display: none; }
.copy-md-button.copy-success {
    color: var(--toolbar-success, #1a7f37);
    border-color: var(--toolbar-success, #1a7f37);
    background: color-mix(in srgb, var(--toolbar-success, #1a7f37) 12%, var(--toolbar-bg, #fff));
}
.copy-md-button.copy-success .copy-button-icon-default { display: none; }
.copy-md-button.copy-success .copy-button-icon-success { display: inline-flex; }
.copy-md-button.copy-success .toolbar-button-label { color: var(--toolbar-success, #1a7f37); }
.copy-md-button.copy-success .copy-button-icon-success .svg-icon {
    animation: copy-check-pop 240ms ease-out;
}
@keyframes copy-check-pop {
    0% { transform: scale(0.55); opacity: 0.25; }
    70% { transform: scale(1.16); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
}
.opt-button-accent {
    color: var(--toolbar-accent);
}
.opt-button-accent:hover {
    border-color: #8cbbf7;
    background: #ddf4ff;
}
.toolbar-danger-button {
    color: var(--toolbar-danger);
}
.toolbar-danger-button:hover {
    border-color: #ffb3ad;
    background: #ffebe9;
}
.toolbar-active-button {
    border-color: var(--toolbar-layout-bg);
    background: var(--toolbar-layout-bg);
    color: #fff;
}
.opt-switcher {
    height: var(--toolbar-height);
    display: inline-flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    padding: 0 8px;
    border: 1px solid var(--toolbar-border);
    border-radius: var(--toolbar-radius);
    background: var(--toolbar-bg);
    color: var(--toolbar-muted);
    font-size: 12px;
    font-weight: 650;
}
.opt-switcher:hover {
    background: var(--toolbar-bg-hover);
}
.opt-switcher input { display: none; }
.opt-switcher .slider {
    width: 32px;
    height: 16px;
    background: #d8dee4;
    border-radius: 16px;
    position: relative;
    transition: background 0.16s ease;
}
.opt-switcher .slider:before {
    content: "";
    position: absolute;
    height: 12px;
    width: 12px;
    left: 2px;
    bottom: 2px;
    background: white;
    border-radius: 50%;
    transition: transform 0.16s ease;
    box-shadow: 0 1px 2px rgba(31, 35, 40, 0.25);
}
.opt-switcher input:checked + .slider { background: var(--toolbar-success); }
.opt-switcher input:checked + .slider:before { transform: translateX(16px); }
.opt-share-link {
    height: var(--toolbar-height);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px 0 8px;
    border: 1px solid #9be9a8;
    border-radius: var(--toolbar-radius);
    background: #dafbe1;
}
.publish-status {
    color: #116329;
    font-size: 12px;
    font-weight: 650;
    line-height: 1;
}
.share-url-link {
    min-width: 0;
    height: calc(var(--toolbar-height) - 2px);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 10px;
    border-radius: calc(var(--toolbar-radius) - 1px);
    background: rgba(255, 255, 255, 0.65);
    color: var(--toolbar-accent);
    font-size: 12px;
    font-weight: 650;
    text-decoration: none;
}
.share-url-link:hover {
    background: #fff;
    text-decoration: none;
}
.public-index-btn {
    min-width: 68px;
    padding: 0 8px;
    font-size: 11px;
}
.share-font-toggle .segmented-toggle-btn {
    min-width: 28px;
    padding: 0 7px;
}
.share-history-trigger,
.note-history-trigger {
    color: var(--toolbar-accent);
}
.share-history-trigger:hover,
.note-history-trigger:hover {
    border-color: #8cbbf7;
    background: #ddf4ff;
}
.toolbar-icon-link,
.github-link,
.doc-link {
    height: var(--toolbar-height);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: var(--toolbar-radius);
    color: var(--toolbar-text);
    text-decoration: none;
    font-size: 13px;
    font-weight: 650;
}
.toolbar-icon-link {
    width: auto;
    min-width: var(--toolbar-height);
    padding: 1px 7px;
    border: 1px solid transparent;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    font-size: 14px;
}
.toolbar-icon-link:hover {
    border-color: var(--toolbar-border);
    background: var(--toolbar-bg-hover);
}
.ui-theme-toggle-btn .ui-theme-icon-sun {
    display: none;
}
.ui-theme-toggle-btn .ui-theme-icon-moon {
    display: inline-flex;
}
.ui-theme-toggle-btn.is-dark .ui-theme-icon-sun {
    display: inline-flex;
}
.ui-theme-toggle-btn.is-dark .ui-theme-icon-moon {
    display: none;
}
.sr-only,
.visually-hidden-file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
.share-history-content {
    position: fixed;
    right: 24px;
    bottom: 76px;
    z-index: 1001;
    width: min(440px, calc(100vw - 32px));
    max-height: min(520px, calc(100dvh - 112px));
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 12px;
    background: var(--modal-bg, #fff);
    color: var(--modal-text, #24292f);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.25);
}
.share-history-content h2 {
    margin: 0 28px 0 0;
    font-size: 17px;
    line-height: 1.35;
    color: var(--modal-text, #24292f);
}
.share-history-close {
    position: absolute;
    top: 10px;
    right: 12px;
    border: 0;
    background: transparent;
    color: var(--modal-muted, #6e7781);
    cursor: pointer;
    font-size: 18px;
    transition: color 0.15s ease;
}
.share-history-close:hover {
    color: var(--modal-text, #24292f);
}
.share-history-tabs {
    display: flex;
    padding: 3px;
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 8px;
    background: var(--modal-surface, #f6f8fa);
}
.share-history-tab {
    flex: 1;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--modal-muted, #57606a);
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    padding: 7px 10px;
    transition: background 0.15s ease, color 0.15s ease;
}
.share-history-tab.active {
    background: var(--toolbar-layout-bg, #24292f);
    color: #fff;
}
.share-history-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
}
.share-history-empty {
    margin: 8px 0 4px;
    color: var(--modal-muted, #6e7781);
    font-size: 13px;
    line-height: 1.6;
}
.share-history-item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 10px;
    padding: 10px;
    border: 1px solid var(--modal-border, #d8dee4);
    border-radius: 8px;
    background: var(--modal-surface, #fff);
}
.share-history-link {
    min-width: 0;
    color: var(--modal-accent, #0969da);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.4;
    overflow: hidden;
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.share-history-link:hover {
    text-decoration: underline;
}
.share-history-meta {
    grid-column: 1 / -1;
    color: var(--modal-muted, #6e7781);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.share-history-copy {
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 6px;
    background: var(--modal-surface, #f6f8fa);
    color: var(--modal-text, #24292f);
    cursor: pointer;
    font-size: 12px;
    padding: 4px 8px;
    transition: background 0.15s ease, border-color 0.15s ease;
}
.share-history-copy:hover {
    background: var(--modal-surface-hover, #eef1f4);
}
.note-history-content {
    position: fixed;
    right: 24px;
    bottom: 76px;
    z-index: 1001;
    width: min(920px, calc(100vw - 32px));
    max-height: min(680px, calc(100dvh - 112px));
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    border: 1px solid var(--modal-border, #d0d7de);
    border-radius: 12px;
    background: var(--modal-bg, #fff);
    color: var(--modal-text, #24292f);
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.3);
}
.note-history-content h2 {
    margin: 0 28px 0 0;
    font-size: 17px;
    line-height: 1.35;
    color: var(--modal-text, #24292f);
}
.note-history-close {
    position: absolute;
    top: 10px;
    right: 12px;
    border: 0;
    background: transparent;
    color: var(--modal-muted, #6e7781);
    cursor: pointer;
    font-size: 18px;
    transition: color 0.15s ease;
}
.note-history-close:hover {
    color: var(--modal-text, #24292f);
}
.note-history-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
}
.note-history-render-toggle {
    margin-right: auto;
}
.note-history-layout {
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
    gap: 12px;
    flex: 1;
}
.note-history-list {
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
}
.note-history-entry {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 10px;
    border: 1px solid var(--modal-border, #d8dee4);
    border-radius: 8px;
    background: var(--modal-surface, #fff);
    color: var(--modal-text, #24292f);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, background 0.15s ease;
}
.note-history-entry:hover {
    border-color: var(--modal-accent, #0969da);
    background: var(--modal-surface-hover, #f6f8fa);
}
.note-history-entry.active {
    border-color: var(--modal-accent, #0969da);
    background: var(--modal-surface-active, #edf4ff);
}
.note-history-entry-title {
    color: var(--modal-accent, #0969da);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.45;
}
.note-history-entry-preview {
    color: var(--modal-muted, #57606a);
    font-size: 12px;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.note-history-entry-meta {
    color: var(--modal-muted, #6e7781);
    font-size: 11px;
    line-height: 1.4;
}
.note-history-viewer {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--modal-border, #d8dee4);
    border-radius: 10px;
    background: var(--modal-surface, #f6f8fa);
    overflow: hidden;
}
.note-history-viewer-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--modal-border, #d8dee4);
    background: var(--modal-surface, #fff);
}
.note-history-viewer-header strong {
    color: var(--modal-text, #24292f);
    font-size: 13px;
    line-height: 1.45;
}
.note-history-viewer-header span {
    color: var(--modal-muted, #6e7781);
    font-size: 11px;
    line-height: 1.4;
}
.note-history-body {
    min-height: 0;
    flex: 1;
    overflow: auto;
    padding: 14px;
    background: var(--modal-bg, #fff);
    color: var(--modal-text, #24292f);
    font-size: 13px;
    line-height: 1.65;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}
.note-history-body.markdown-body {
    white-space: normal;
}
html[data-ui-theme="dark"] .note-history-body.markdown-body,
[data-ui-theme="dark"] .note-history-body.markdown-body {
    background: #1e293b;
    color: #f1f5f9;
}
html[data-ui-theme="dark"] .note-history-body.markdown-body h1,
html[data-ui-theme="dark"] .note-history-body.markdown-body h2,
html[data-ui-theme="dark"] .note-history-body.markdown-body h3,
[data-ui-theme="dark"] .note-history-body.markdown-body h1,
[data-ui-theme="dark"] .note-history-body.markdown-body h2,
[data-ui-theme="dark"] .note-history-body.markdown-body h3 {
    color: #f1f5f9;
}
html[data-ui-theme="dark"] .note-history-body.markdown-body code,
[data-ui-theme="dark"] .note-history-body.markdown-body code {
    background: #0f172a;
    color: #f87171;
}
html[data-ui-theme="dark"] .note-history-body.markdown-body pre,
[data-ui-theme="dark"] .note-history-body.markdown-body pre {
    background: #0f172a;
    color: #f8fafc;
}
html[data-ui-theme="dark"] .note-history-body.markdown-body blockquote,
[data-ui-theme="dark"] .note-history-body.markdown-body blockquote {
    background: #0f172a;
    color: #94a3b8;
    border-left-color: #38bdf8;
}
.note-history-status {
    color: var(--modal-muted, #6e7781);
}
.note-history-status.error {
    color: #cf222e;
}
@media (max-width: 860px) {
    .note-history-layout {
        grid-template-columns: 1fr;
    }
    .note-history-list {
        max-height: 220px;
    }
}
@media (max-width: 640px) {
    .share-history-content,
    .note-history-content {
        right: 12px;
        left: 12px;
        bottom: 68px;
        width: auto;
        max-height: calc(100dvh - 92px);
        padding: 14px;
    }
    .note-history-toolbar > * {
        width: 100%;
    }
}
.share-back-to-top {
    position: fixed;
    right: 22px;
    bottom: 78px;
    z-index: 130;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(208, 215, 222, 0.92);
    border-radius: 999px;
    background: rgba(36, 41, 47, 0.86);
    color: #fff;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    opacity: 0;
    pointer-events: none;
    transform: translateY(8px);
    transition: opacity 0.18s ease, transform 0.18s ease, background 0.18s ease;
    box-shadow: 0 10px 24px rgba(31, 35, 40, 0.18);
}
.share-back-to-top:hover {
    background: rgba(9, 105, 218, 0.92);
}
.share-back-to-top.visible {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
}
.opt,
.share-footer-actions,
.footer-spacer,
.footer-controls {
    display: contents;
}

.preview-pane {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
}

.preview-pane > .contents {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
}

.editor-publication-status {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 32px;
    min-height: 32px;
    padding: 2px 8px;
    border-top: 1px solid var(--status-border);
    border-bottom: none;
    background: var(--status-bg);
    color: var(--status-text);
    font: 12px/1.35 var(--editor-font-family);
    white-space: nowrap;
    overflow: hidden;
    box-sizing: border-box;
}
.publication-status-main,
.publication-share-details,
.publication-metrics {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 8px;
}
.publication-status-main,
.publication-share-details {
    flex: 1 1 auto;
    overflow: hidden;
}
.publication-state {
    flex: 0 0 auto;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--status-muted-bg);
    color: var(--status-muted-text);
    font-weight: 700;
}
.publication-state.is-published {
    background: var(--status-success-bg);
    color: var(--status-success-text);
}
.publication-label { color: var(--status-muted); }
#publication-share-url {
    max-width: min(26vw, 300px);
    overflow: hidden;
    color: var(--status-link);
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
}
#publication-share-url:hover { text-decoration: underline; }
.publication-icon-button,
.publication-index-button,
.publication-present-btn {
    min-height: 24px;
    border: 1px solid var(--status-border);
    border-radius: 6px;
    background: var(--status-control-bg);
    color: var(--status-strong);
    cursor: pointer;
    font: inherit;
}
.publication-present-btn {
    height: 24px;
    padding: 0 8px;
    font-size: 11px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
    font-weight: 600;
}
.publication-present-btn:hover {
    background: var(--status-control-bg-hover, var(--status-muted-bg));
    color: var(--status-link, var(--toolbar-accent));
}
.publication-present-btn .svg-icon {
    width: 12px;
    height: 12px;
}
.publication-icon-button {
    width: 24px;
    height: 24px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: all 0.15s ease;
}
.publication-icon-button:hover {
    background: var(--status-control-bg-hover, var(--status-muted-bg));
    color: var(--status-link, var(--toolbar-accent));
}
.publication-icon-button:active {
    transform: scale(0.92);
}
.publication-icon-button .svg-icon {
    width: 13px;
    height: 13px;
    margin: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.publication-index-button { padding: 3px 8px; }
.publication-index-button.is-indexed {
    border-color: var(--status-success-border);
    background: var(--status-success-bg);
    color: var(--status-success-text);
}
.publication-icon-button:focus-visible,
.publication-index-button:focus-visible,
#publication-share-url:focus-visible {
    outline: 2px solid var(--status-link);
    outline-offset: 2px;
}
.publication-metrics {
    flex: 0 0 auto;
    color: var(--status-muted);
}
.publication-metrics span + span {
    padding-left: 8px;
    border-left: 1px solid var(--status-border);
}
.publication-metrics strong,
.publication-metrics time {
    color: var(--status-strong);
    font-weight: 700;
}
.publication-pending-hint {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
[hidden] { display: none !important; }

.reading-progress-host { position: relative; }
.reading-progress {
    position: absolute;
    top: 18px;
    left: 8px;
    z-index: 15;
    display: grid;
    justify-items: center;
    gap: 5px;
    color: rgba(87, 96, 106, 0.82);
    opacity: 0.72;
    transition: opacity 0.16s ease;
}
.reading-progress:hover,
.reading-progress:focus-within { opacity: 1; }
.reading-progress.is-hidden { display: none; }
.reading-progress-track {
    position: relative;
    width: 16px;
    height: 96px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: rgba(87, 96, 106, 0.16);
    cursor: pointer;
}
.reading-progress-track:focus-visible { outline: 2px solid #0969da; outline-offset: 2px; }
.reading-progress-indicator {
    position: absolute;
    top: var(--reading-progress, 0%);
    left: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
    transform: translate(-50%, -50%);
}
.reading-progress-markers {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.reading-progress-marker {
    position: absolute;
    left: 50%;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.55;
    transform: translate(-50%, -50%);
}
.reading-progress-marker.is-active {
    width: 6px;
    height: 6px;
    opacity: 1;
}
.reading-progress-value {
    min-width: 42px;
    color: inherit;
    font: 10px/1 var(--editor-font-family);
    text-align: center;
    white-space: nowrap;
}
body.share-view .reading-progress {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
}
body:not(.share-view) .preview-pane .reading-progress {
    top: 50%;
    transform: translateY(-50%);
}

@media (max-width: 640px) {
    .reading-progress { top: 10px; left: 4px; }
    .reading-progress-track { height: 72px; }
    .editor-publication-status {
        height: auto;
        min-height: 38px;
        align-items: center;
        padding: 5px 8px;
        gap: 6px;
    }
    .publication-status-main {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .publication-share-details {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .publication-present-btn {
        height: 30px;
        padding: 0 8px;
        font-size: 12px;
        gap: 4px;
    }
    .publication-present-btn .svg-icon {
        width: 14px;
        height: 14px;
    }
    .publication-book-btn {
        height: 30px;
        padding: 0 8px;
        font-size: 12px;
        gap: 4px;
    }
    .publication-book-btn .svg-icon {
        width: 14px;
        height: 14px;
    }
    .publication-icon-button {
        width: 30px;
        height: 30px;
        flex: 0 0 30px;
    }
    .publication-icon-button .svg-icon {
        width: 15px;
        height: 15px;
    }
    .publication-index-button {
        min-height: 30px;
        padding: 0 10px;
        font-size: 12px;
    }
    .publication-label,
    .publication-metrics { display: none; }
    #publication-share-url {
        flex: 1;
        max-width: none;
        font-size: 12px;
    }
    .publication-pending-hint { font-size: 11px; }

    /* Touch-friendly modal close button */
    .close-btn {
        width: 36px !important;
        height: 36px !important;
        font-size: 22px !important;
    }

    /* Touch-friendly dropdown items */
    .dropdown-item {
        min-height: 38px;
        padding: 8px 12px;
        font-size: 13px;
        gap: 8px;
    }
    .dropdown-item .svg-icon {
        width: 18px;
        height: 18px;
    }

    /* Touch-friendly floating back to top */
    .share-back-to-top {
        width: 44px;
        height: 44px;
        font-size: 22px;
    }

    /* Touch-friendly diagram action buttons */
    .diagram-btn {
        min-height: 28px;
        padding: 4px 8px;
        font-size: 12px;
    }
    .diagram-btn svg {
        width: 14px;
        height: 14px;
    }
}

@media (min-width: 961px) {
    body.preview-split-vertical:not(.share-view) .layer_3 {
        flex-direction: column;
    }
    body.preview-split-vertical:not(.share-view) .divide-line {
        width: 100%;
        height: 8px;
        min-height: 8px;
        cursor: row-resize;
        border-left: 0;
        border-right: 0;
        border-top: 1px solid #e1e4e8;
        border-bottom: 1px solid #e1e4e8;
    }
    body.preview-split-vertical:not(.share-view) textarea.contents,
    body.preview-split-vertical:not(.share-view) .preview-pane {
        width: 100%;
        height: 50%;
        min-height: 0;
    }
}

body.preview-device-mobile:not(.share-view) .preview-pane {
    align-items: center;
    justify-content: flex-start;
    padding: 16px;
    background: #161b22;
}

body.preview-device-mobile:not(.share-view) .editor-publication-status {
    align-self: stretch;
    width: 100%;
}

body.preview-device-mobile:not(.share-view) #preview-md.contents,
body.preview-device-mobile:not(.share-view) #preview-plain.contents {
    flex: 1 1 auto;
    width: min(390px, calc(100% - 32px));
    max-width: 390px;
    height: auto;
    min-height: 0;
    margin: 0;
    padding: 34px 18px 24px;
    border: 10px solid #24292f;
    border-radius: 34px;
    box-shadow: 0 16px 40px rgba(31, 35, 40, 0.28);
    overflow-y: auto;
}

body.preview-device-mobile:not(.share-view) #preview-md.contents::before,
body.preview-device-mobile:not(.share-view) #preview-plain.contents::before {
    content: "";
    position: sticky;
    top: -24px;
    display: block;
    width: 72px;
    height: 8px;
    margin: -18px auto 16px;
    border-radius: 999px;
    background: #24292f;
}

body.preview-device-mobile:not(.share-view) #preview-md.markdown-body,
body.preview-device-mobile:not(.share-view) #preview-plain.markdown-body {
    font-size: 15px;
    line-height: 1.72;
}

body.preview-device-mobile:not(.share-view) #preview-md.markdown-body h1,
body.preview-device-mobile:not(.share-view) #preview-plain.markdown-body h1 {
    font-size: 1.8em;
}

body.preview-device-mobile:not(.share-view) #preview-md.markdown-body table,
body.preview-device-mobile:not(.share-view) #preview-plain.markdown-body table {
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
    margin-left: 0 !important;
    margin-right: 0 !important;
    box-sizing: border-box !important;
    font-size: 12px !important;
}

body.preview-device-mobile:not(.share-view) #preview-md.markdown-body th,
body.preview-device-mobile:not(.share-view) #preview-md.markdown-body td,
body.preview-device-mobile:not(.share-view) #preview-plain.markdown-body th,
body.preview-device-mobile:not(.share-view) #preview-plain.markdown-body td {
    min-width: 0 !important;
    padding: 6px 6px !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
    box-sizing: border-box !important;
}

body.preview-device-mobile:not(.share-view) #preview-md.markdown-body td code,
body.preview-device-mobile:not(.share-view) #preview-md.markdown-body th code,
body.preview-device-mobile:not(.share-view) #preview-plain.markdown-body td code,
body.preview-device-mobile:not(.share-view) #preview-plain.markdown-body th code {
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
}

body.preview-device-mobile:not(.share-view) #preview-md.markdown-body > pre,
body.preview-device-mobile:not(.share-view) #preview-md.markdown-body > .media-preview {
    margin-left: -18px !important;
    margin-right: -18px !important;
    border-radius: 0 !important;
    width: calc(100% + 36px) !important;
    max-width: calc(100% + 36px) !important;
}

body.preview-device-mobile:not(.share-view) #preview-md.markdown-body > table {
    margin-left: 0 !important;
    margin-right: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
}

.mobile-ascii-diagram {
    width: 100%;
    overflow: hidden;
}

.mobile-ascii-diagram-inner {
    display: inline-block;
    transform-origin: top left;
    will-change: transform;
}

.mobile-ascii-diagram.is-scaled pre {
    overflow: visible !important;
}

/* Diagram Source - Hidden */
.diagram-source { display: none !important; }

/* Diagram Block Wrapper & Actions Toolbar */
.diagram-block-wrapper {
    position: relative;
    margin: 1.2em 0;
    padding: 16px 12px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: rgba(0, 0, 0, 0.015);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
[data-ui-theme="dark"] .diagram-block-wrapper {
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
}
.diagram-block-wrapper:hover {
    border-color: rgba(0, 0, 0, 0.16);
}
[data-ui-theme="dark"] .diagram-block-wrapper:hover {
    border-color: rgba(255, 255, 255, 0.16);
}
.diagram-toolbar {
    position: absolute;
    top: 8px;
    right: 8px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 4px;
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 6px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-2px);
    transition: opacity 0.2s ease, transform 0.2s ease;
    z-index: 10;
}
[data-ui-theme="dark"] .diagram-toolbar {
    background: rgba(26, 31, 44, 0.88);
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}
.diagram-block-wrapper:hover .diagram-toolbar,
.diagram-block-wrapper:focus-within .diagram-toolbar,
.diagram-toolbar:focus-within,
.diagram-toolbar.is-active {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
}
@media (hover: none) {
    .diagram-toolbar {
        opacity: 0.88;
        pointer-events: auto;
        transform: translateY(0);
    }
}
.diagram-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 3px 7px;
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    color: #4b5563;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    line-height: 1.2;
}
[data-ui-theme="dark"] .diagram-btn {
    color: #9ca3af;
}
.diagram-btn:hover {
    background: rgba(0, 0, 0, 0.08);
    color: #111827;
}
[data-ui-theme="dark"] .diagram-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f3f4f6;
}
.diagram-btn.is-copied {
    color: #16a34a !important;
    background: rgba(22, 163, 74, 0.12) !important;
}
.diagram-btn svg {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 12px;
    flex-shrink: 0;
}

/* Mermaid Renderer Specific Fixes */
.diagram-mermaid-render {
    line-height: normal;
    font-size: 14px;
    overflow-x: auto;
    overflow-y: visible;
}
.diagram-mermaid-render svg {
    display: block;
    max-width: 100%;
    height: auto;
    overflow: visible;
}
.diagram-mermaid-render text,
.diagram-mermaid-render tspan,
.diagram-mermaid-render .label {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "PingFang SC", "Hiragino Sans GB", "Microsoft JhengHei", "Microsoft YaHei", "Noto Sans CJK TC", "Noto Sans CJK SC", "Source Han Sans TC", "Source Han Sans SC", Helvetica, Arial, sans-serif;
}

/* Presentation Mode Overlay */
#presentation-container {
    --presentation-safe-inline: 76px;
    --presentation-safe-top: 64px;
    --presentation-safe-bottom: 72px;
    position: fixed;
    inset: 0;
    z-index: 10000;
    width: 100vw;
    height: 100dvh;
    background: #070b12;
    display: none;
}
#presentation-container.active {
    display: block;
}
#presentation-close-btn {
    position: fixed;
    top: max(14px, env(safe-area-inset-top));
    right: max(14px, env(safe-area-inset-right));
    z-index: 10001;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    background: rgba(7, 11, 18, 0.78);
    color: white;
    border: 1px solid rgba(226, 232, 240, 0.38);
    padding: 8px 14px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 14px;
    backdrop-filter: blur(10px);
    transition: all 0.2s;
}
#presentation-close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.05);
}
#presentation-container .reveal {
    width: 100%;
    height: 100%;
    font-size: 30px;
    color: #e2e8f0;
}

/* Slidev-Lite Theme Extensions */
#presentation-container.active {
    font-family: "GenJyuu Gothic CJK", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background:
        radial-gradient(circle at 50% 42%, rgba(30, 41, 59, 0.7) 0%, rgba(7, 11, 18, 0) 58%),
        #070b12;
}

#presentation-container .reveal .slides {
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.34);
    border-radius: 12px;
    background: linear-gradient(145deg, #172236 0%, #111a2c 100%);
    box-shadow:
        0 28px 70px rgba(0, 0, 0, 0.38),
        0 0 0 1px rgba(255, 255, 255, 0.025) inset;
}

#presentation-container .reveal .slides section {
    width: 100%;
    height: 100%;
    text-align: left;
    font-family: "GenJyuu Gothic CJK", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #e2e8f0;
    line-height: 1.45;
    box-sizing: border-box;
    padding:
        var(--presentation-safe-top)
        var(--presentation-safe-inline)
        var(--presentation-safe-bottom) !important;
    overflow: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(103, 232, 249, 0.6) transparent;
}

#presentation-container .reveal .slides section.presentation-slide-overflow {
    overflow-x: hidden;
    overflow-y: auto;
    padding-bottom: calc(var(--presentation-safe-bottom) + 36px) !important;
}

#presentation-container.presentation-authoring .reveal .slides section.presentation-slide-overflow::after {
    content: attr(data-overflow-label);
    position: sticky;
    left: 0;
    bottom: -24px;
    display: table;
    margin: 18px 0 0 auto;
    padding: 6px 10px;
    border: 1px solid rgba(251, 191, 36, 0.55);
    border-radius: 999px;
    background: rgba(120, 53, 15, 0.9);
    color: #fef3c7;
    font-size: 14px;
    line-height: 1.2;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
}

#presentation-container .reveal .slides section p,
#presentation-container .reveal .slides section li,
#presentation-container .reveal .slides section a,
#presentation-container .reveal .slides section code,
#presentation-container .reveal .slides section th,
#presentation-container .reveal .slides section td {
    overflow-wrap: anywhere;
    word-break: break-word;
}

#presentation-container .reveal blockquote {
    width: auto;
    margin: 0.6em 0 0.85em;
    padding: 0.7em 0.9em;
    border-left: 4px solid #67e8f9;
    border-radius: 0 8px 8px 0;
    background: rgba(148, 163, 184, 0.09);
    color: #dbe4f3;
    font-size: 0.78em;
    font-style: normal;
    line-height: 1.45;
}

#presentation-container .reveal blockquote p {
    margin: 0 0 0.35em;
}

#presentation-container .reveal blockquote p:last-child {
    margin-bottom: 0;
}

/* Custom Scrollbar for Code Blocks */
.reveal pre::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}
.reveal pre::-webkit-scrollbar-track {
    background: #0f172a;
}
.reveal pre::-webkit-scrollbar-thumb {
    background: #334155;
    border-radius: 4px;
}
.reveal pre::-webkit-scrollbar-thumb:hover {
    background: #475569;
}

#presentation-container .reveal h1,
#presentation-container .reveal h2,
#presentation-container .reveal h3 {
    color: #fff;
    text-transform: none;
    font-weight: 700;
    letter-spacing: 0;
    line-height: 1.18;
    overflow-wrap: anywhere;
}

#presentation-container .reveal h1 {
    margin: 0 0 0.55em;
    font-size: 1.65em;
}

#presentation-container .reveal h2 {
    margin: 0.75em 0 0.45em;
    font-size: 1.35em;
}

#presentation-container .reveal h3 {
    margin: 0.65em 0 0.4em;
    font-size: 1.12em;
}

#presentation-container .reveal pre {
    max-width: 100%;
    max-height: 330px;
    overflow: auto;
    white-space: pre-wrap;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    padding: 1em;
}

#presentation-container .reveal code {
    font-family: "JetBrains Mono", "Maple Mono", monospace;
    font-size: 0.85em;
    color: #94a3b8;
}

#presentation-container .reveal section img,
#presentation-container .reveal section video,
#presentation-container .reveal section iframe,
#presentation-container .reveal section svg:not(.controls-arrow) {
    display: block;
    max-width: 100%;
    max-height: 380px;
    margin-inline: auto;
    object-fit: contain;
}

#presentation-container .reveal table {
    width: max-content;
    max-width: none;
    border-collapse: collapse;
    font-size: 0.72em;
    line-height: 1.22;
}

#presentation-container .reveal table th,
#presentation-container .reveal table td {
    padding: 0.32em 0.5em;
    white-space: normal;
}

.presentation-table-fit {
    display: block;
    max-width: 100%;
    overflow: visible;
    transform-origin: top left;
}

.presentation-table-fit.presentation-table-overflow {
    overflow-x: auto;
    overflow-y: hidden;
}

.presentation-table-fit table {
    margin: 0;
    transform-origin: top left;
}

/* Diagram and ECharts Fitting in Presentation */
.presentation-diagram-fit {
    display: flex;
    justify-content: center;
    align-items: center;
    max-width: 100%;
    max-height: 380px;
    margin: 0.6em auto;
    overflow: hidden;
}
.presentation-diagram-fit svg {
    max-width: 100% !important;
    max-height: 380px !important;
    height: auto !important;
}
.presentation-echarts-chart {
    width: 100%;
    height: 360px;
    margin: 0.6em auto;
}

/* Theme Adaptations for Presentation */
#presentation-container[data-presentation-theme="retro"] .reveal .slides {
    background: #fbf7ee;
    border-color: #d6ccb8;
    box-shadow: 0 28px 70px rgba(78, 62, 42, 0.22);
}
#presentation-container[data-presentation-theme="retro"] .reveal .slides section {
    color: #2b251f;
}
#presentation-container[data-presentation-theme="retro"] .reveal h1,
#presentation-container[data-presentation-theme="retro"] .reveal h2,
#presentation-container[data-presentation-theme="retro"] .reveal h3 {
    color: #8b3a2b;
}
#presentation-container[data-presentation-theme="retro"] .reveal blockquote {
    border-left-color: #8b3a2b;
    background: rgba(139, 58, 43, 0.08);
    color: #4a3c31;
}

#presentation-container[data-presentation-theme="notion-clean"] .reveal .slides,
#presentation-container[data-presentation-theme="ayu-light"] .reveal .slides,
#presentation-container[data-presentation-theme="newsprint"] .reveal .slides {
    background: #ffffff;
    border-color: #e2e8f0;
    box-shadow: 0 28px 70px rgba(0, 0, 0, 0.12);
}
#presentation-container[data-presentation-theme="notion-clean"] .reveal .slides section,
#presentation-container[data-presentation-theme="ayu-light"] .reveal .slides section,
#presentation-container[data-presentation-theme="newsprint"] .reveal .slides section {
    color: #1e293b;
}
#presentation-container[data-presentation-theme="notion-clean"] .reveal h1,
#presentation-container[data-presentation-theme="notion-clean"] .reveal h2,
#presentation-container[data-presentation-theme="notion-clean"] .reveal h3 {
    color: #0f172a;
}

#presentation-container[data-presentation-theme="green-simple"] .reveal .slides {
    background: #f4fbf7;
    border-color: #c2e8d4;
}
#presentation-container[data-presentation-theme="green-simple"] .reveal .slides section {
    color: #1a3328;
}
#presentation-container[data-presentation-theme="green-simple"] .reveal h1,
#presentation-container[data-presentation-theme="green-simple"] .reveal h2,
#presentation-container[data-presentation-theme="green-simple"] .reveal h3 {
    color: #1b6848;
}

#presentation-container[data-presentation-theme="tokyo-night"] .reveal .slides {
    background: #1a1b26;
    border-color: #2f354f;
}
#presentation-container[data-presentation-theme="tokyo-night"] .reveal .slides section {
    color: #a9b1d6;
}
#presentation-container[data-presentation-theme="tokyo-night"] .reveal h1,
#presentation-container[data-presentation-theme="tokyo-night"] .reveal h2,
#presentation-container[data-presentation-theme="tokyo-night"] .reveal h3 {
    color: #7aa2f7;
}

/* Layouts: Two Columns, Three Columns, and Cover */
.slidev-layout-two-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2em;
    align-items: start;
    width: 100%;
}
.col-left, .col-right {
    min-width: 0;
    width: 100%;
}

.slidev-layout-three-cols {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1.5em;
    align-items: start;
    width: 100%;
}
.slidev-layout-three-cols .col-left,
.slidev-layout-three-cols .col-center,
.slidev-layout-three-cols .col-right {
    min-width: 0;
    width: 100%;
}

.slidev-layout-cover {
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    text-align: center !important;
    padding: 60px 80px !important;
}
.slidev-layout-cover h1 {
    font-size: 2.2em !important;
    margin-bottom: 0.3em !important;
    text-align: center !important;
}
.slidev-layout-cover h2,
.slidev-layout-cover h3 {
    font-weight: 400 !important;
    opacity: 0.88;
    text-align: center !important;
}
.slidev-layout-cover p {
    text-align: center !important;
}

/* Laser Pointer */
#presentation-laser-dot {
    position: fixed;
    width: 12px;
    height: 12px;
    background: #ef4444;
    border-radius: 50%;
    box-shadow: 0 0 10px #ef4444, 0 0 20px #f87171, 0 0 3px #fff;
    pointer-events: none;
    z-index: 10002;
    transform: translate(-50%, -50%);
    display: none;
    transition: opacity 80ms ease;
}
#presentation-container.laser-active {
    cursor: none !important;
}
#presentation-container.laser-active #presentation-laser-dot {
    display: block;
}

/* Presentation Bottom Floating Toolbar */
.presentation-toolbar {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10001;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 5px 8px;
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 999px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: opacity 300ms ease, transform 300ms ease;
    user-select: none;
}
.presentation-toolbar.toolbar-hidden {
    opacity: 0;
    pointer-events: none;
    transform: translateX(-50%) translateY(12px);
}
.presentation-toolbar:hover,
.presentation-toolbar:focus-within {
    opacity: 1 !important;
    pointer-events: auto !important;
    transform: translateX(-50%) translateY(0) !important;
}
.presentation-toolbar-group {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    position: relative;
}
.presentation-toolbar-divider {
    width: 1px;
    height: 18px;
    background: rgba(255, 255, 255, 0.18);
    margin: 0 4px;
}
.presentation-tb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    height: 32px;
    padding: 0 10px;
    background: transparent;
    color: #e2e8f0;
    border: 0;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 120ms ease;
    white-space: nowrap;
}
.presentation-tb-btn:hover {
    background: rgba(255, 255, 255, 0.16);
    color: #ffffff;
}
.presentation-tb-btn.active {
    background: rgba(239, 68, 68, 0.25);
    color: #fca5a5;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.3);
}
.presentation-tb-btn.presentation-tb-exit {
    color: #fca5a5;
}
.presentation-tb-btn.presentation-tb-exit:hover {
    background: rgba(239, 68, 68, 0.22);
    color: #fff;
}
.presentation-tb-page {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0 8px;
    color: #94a3b8;
    font-size: 13px;
    font-family: monospace;
    cursor: pointer;
    border-radius: 6px;
}
.presentation-tb-page:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e2e8f0;
}
.presentation-export-menu {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    min-width: 190px;
    background: rgba(20, 26, 40, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 12px;
    padding: 6px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    gap: 3px;
    z-index: 10005;
}
.presentation-export-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: 0;
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: all 120ms ease;
}
.presentation-export-item:hover {
    background: rgba(255, 255, 255, 0.14);
    color: #fff;
}

.presentation-orientation-hint {
    display: none;
}

.reveal .fragment.v-click {
    visibility: hidden;
}
.reveal .fragment.v-click.visible {
    visibility: visible;
}

@media (orientation: portrait) and (max-width: 720px) {
    #presentation-container .reveal {
        opacity: 0.08;
        pointer-events: none;
    }

    #presentation-container .presentation-orientation-hint {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 72px 28px;
        color: #f8fafc;
        font-size: 18px;
        line-height: 1.55;
        text-align: center;
    }
}

/* Tablets and smaller screens text labels hiding */
@media (max-width: 1024px) {
    .btn-label {
        display: none !important;
    }
    .opt-button .svg-icon,
    .toolbar-icon-button .svg-icon {
        margin-right: 0 !important;
    }
}

@media (max-width: 960px) {
    .desktop-split-control {
        display: none !important;
    }
    /* Show mobile more button and dropdown */
    .more-dropdown {
        display: inline-flex !important;
    }
    .mobile-more-btn {
        display: inline-flex !important;
    }
    body.keyboard-open:not(.share-view) .footer {
        display: none !important;
        pointer-events: none;
    }

    /* Mobile edit: stack editor + preview vertically */
    body:not(.share-view) .layer_3 {
        flex-direction: column !important;
    }
    body:not(.share-view) .divide-line {
        width: 100% !important;
        height: 8px !important;
        min-height: 8px !important;
        cursor: row-resize !important;
        border-left: 0 !important;
        border-right: 0 !important;
        border-top: 1px solid #e1e4e8 !important;
        border-bottom: 1px solid #e1e4e8 !important;
    }
    body:not(.share-view) .preview-pane {
        height: 50% !important;
        min-height: 0 !important;
    }

    /* Polaris Bleed-inspired full-width code blocks & media on mobile */
    body.share-view #preview-md.markdown-body > pre,
    body.share-view #preview-md.markdown-body > .media-preview,
    body:not(.share-view) #preview-md.markdown-body > pre,
    body:not(.share-view) #preview-md.markdown-body > .media-preview {
        margin-left: -30px !important;
        margin-right: -30px !important;
        border-radius: 0 !important;
        width: calc(100% + 60px) !important;
        max-width: calc(100% + 60px) !important;
    }

    body.share-view #preview-md.markdown-body > table,
    body:not(.share-view) #preview-md.markdown-body > table {
        margin-left: 0 !important;
        margin-right: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
    }

    .footer {
        --toolbar-height: 38px;
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 120;
        min-height: 56px !important;
        max-height: none !important;
        height: auto !important;
        border-top: 1px solid var(--toolbar-border) !important;
        border-left: 0 !important;
        border-right: 0 !important;
        border-bottom: 0 !important;
        border-radius: 0 !important;
        box-shadow: 0 -4px 20px rgba(108, 106, 100, 0.08) !important;
        background: var(--toolbar-bg, rgba(250, 249, 245, 0.95)) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
        padding: 8px 12px calc(8px + env(safe-area-inset-bottom)) !important;
        overflow-x: auto !important;
        scrollbar-width: none !important;
        display: block !important;
        transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease;
    }

    .footer .svg-icon {
        width: 18px !important;
        height: 18px !important;
    }

    .footer .lock-combo-icon {
        width: 20px !important;
        height: 20px !important;
    }

    .footer .opt-button,
    .footer .toolbar-icon-button {
        font-size: 13px !important;
    }

    .footer .new-note-plus {
        width: 16px;
        height: 16px;
        font-size: 16px;
    }

    .footer::-webkit-scrollbar {
        display: none !important;
    }

    .footer.footer-hidden {
        opacity: 0;
        pointer-events: none;
        transform: translateY(100%);
    }

    .footer-sections {
        width: max-content !important;
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        gap: 10px !important;
        align-items: center !important;
        min-height: 0 !important;
        padding: 0 !important;
    }

    .footer-section {
        border-right: 1px solid var(--footer-border, #e6dfd8) !important;
        border-bottom: 0 !important;
        padding: 4px 10px 4px 0 !important;
        margin: 0 !important;
        width: auto !important;
        display: flex !important;
        align-items: center !important;
        background: transparent !important;
    }
    .footer-section:last-child {
        border-right: 0 !important;
    }

    .footer-section-create,
    .footer-section-edit,
    .footer-section-appearance,
    .footer-section-info {
        flex: 0 0 auto !important;
        width: auto !important;
        display: flex !important;
    }

    .more-dropdown {
        display: inline-flex !important;
    }
    .mobile-more-btn {
        display: inline-flex !important;
    }

    .footer-section-create .toolbar-button-label {
        display: none !important;
    }
    .new-note-menu-trigger {
        width: var(--toolbar-height) !important;
        padding: 0 !important;
        justify-content: center;
    }

    .footer-section-edit .footer-section-body,
    .footer-section-appearance .footer-section-body,
    .footer-section-info .footer-section-body {
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 8px !important;
        justify-content: flex-start !important;
        align-items: center !important;
        width: auto !important;
    }

    body:not(.share-view) .footer-section-edit {
        min-width: 0 !important;
    }
    body:not(.share-view) .footer-section-edit .footer-section-body {
        flex-wrap: nowrap !important;
        justify-content: flex-start !important;
        gap: 6px !important;
        overflow: visible !important;
    }
    body:not(.share-view) .footer-section-edit .footer-section-body > * {
        display: inline-flex !important;
        flex: 0 0 auto !important;
    }
    body:not(.share-view) .footer-section-edit .footer-section-body > input.visually-hidden-file-input {
        display: none !important;
    }
    body:not(.share-view) .footer-section-edit .save-control-group {
        gap: 4px !important;
        padding: 2px 4px !important;
    }

    /* Padding for note container on mobile share/edit views */
    body.share-view #preview-md,
    body.share-view #preview-plain,
    .preview-pane,
    textarea.contents {
        padding-bottom: 72px !important;
        transition: padding-bottom 0.2s ease;
    }

    body.share-view .footer-select {
        max-width: none;
        flex: 1;
    }

    body.share-view .share-history-content,
    .share-history-content,
    .note-history-content {
        left: 8px;
        right: 8px;
        bottom: 64px;
        width: auto;
        max-height: 55dvh;
    }

    body.share-view .share-back-to-top {
        right: 14px;
        bottom: 64px;
        width: 36px;
        height: 36px;
        font-size: 18px;
    }

    body.share-view .markdown-body table {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
        margin-left: 0 !important;
        margin-right: 0 !important;
        box-sizing: border-box !important;
        font-size: 12px !important;
    }

    body.share-view .markdown-body th,
    body.share-view .markdown-body td {
        min-width: 0 !important;
        padding: 6px 5px !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
    }

    body.share-view .markdown-body th code,
    body.share-view .markdown-body td code {
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
    }

    body.share-view .mobile-ascii-diagram {
        margin-bottom: 16px;
    }
}

/* Scroll Indicator Arrow */
.scroll-indicator-arrow {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--toolbar-bg-hover, rgba(0, 0, 0, 0.08));
    color: var(--toolbar-accent, #cc785c);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.scroll-indicator-arrow.show:not(.user-scrolled) {
    opacity: 0.9;
}

.scroll-indicator-arrow-icon {
    display: flex;
    align-items: center;
    justify-content: center;
}

.scroll-indicator-arrow.show:not(.user-scrolled) .scroll-indicator-arrow-icon {
    animation: wiggle-right-icon 1.6s ease-in-out infinite;
}

.pwa-install-prompt {
    align-items: center;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 999px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.28);
    color: #fff;
    display: flex;
    gap: 8px;
    left: 50%;
    max-width: calc(100vw - 32px);
    padding: 8px 10px 8px 14px;
    position: fixed;
    transform: translateX(-50%);
    z-index: 1200;
}

.pwa-install-prompt[hidden],
.pwa-install-manual-btn[hidden] {
    display: none !important;
}

.pwa-install-title {
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
}

.pwa-install-button,
.pwa-install-dismiss {
    border: 0;
    cursor: pointer;
    font: inherit;
}

.pwa-install-button {
    background: #fff;
    border-radius: 999px;
    color: #0f172a;
    font-size: 13px;
    font-weight: 800;
    padding: 7px 11px;
}

.pwa-install-button:disabled { opacity: 0.65; cursor: wait; }

.pwa-install-dismiss {
    background: transparent;
    color: #cbd5e1;
    font-size: 20px;
    line-height: 1;
    min-height: 32px;
    min-width: 32px;
    padding: 2px 3px;
    touch-action: manipulation;
}

.pwa-install-button:focus-visible,
.pwa-install-dismiss:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
}

@media (display-mode: standalone) {
    .pwa-install-prompt {
        display: none !important;
    }
}

@keyframes wiggle-right-icon {
    0%, 100% { transform: translate3d(0, 0, 0); }
    50% { transform: translate3d(4px, 0, 0); }
}

@media print {
    @page {
        margin: 12mm 15mm;
    }

    body.print-export-active #preview-md,
    body.print-export-active #preview-plain {
        display: none !important;
    }

    /* Hide non-printable elements */
    .footer,
    .share-footer,
    .divide-line,
    textarea#contents,
    #loading,
    .pwa-install-prompt,
    .tips,
    .modal,
    .publish-nudge-modal,
    .publish-nudge-content,
    .editor-publication-status,
    #presentation-close-btn,
    #presentation-container,
    .editor-pane,
    .editor-code-shell,
    .editor-line-numbers,
    .editor-welcome,
    .editor-status,
    .toolbar-container,
    .toolbar,
    #toolbar,
    .markdown-editor-toolbar-wrap,
    .markdown-editor-toolbar,
    .bottom-sheet,
    #mobile-bottom-sheet,
    .bottom-sheet-backdrop,
    .bottom-sheet-content,
    .reader-controls,
    #reader-controls,
    .floating-tooltip,
    .share-back-to-top,
    #share-back-to-top,
    #toast-container,
    .dropdown-menu,
    .share-menu-dropdown,
    .reading-progress-container,
    .reading-progress-host,
    .reading-progress,
    #reading-progress-bar,
    .scroll-indicator-arrow,
    .annotation-rail-button,
    .annotation-selection-button,
    .annotation-sidebar,
    .annotation-popover,
    .annotation-card,
    .share-annotations-layer,
    #share-annotations-root,
    #share-annotation-root,
    .share-annotations-trigger,
    .share-annotations-popover,
    .footnote-popover,
    #footnote-popover,
    .tiptap-block-handle,
    .david888-drag-handle,
    .tiptap-add-block,
    .tiptap-editor-toolbar,
    .tiptap-slash-menu,
    .tiptap-block-menu,
    .tiptap-bubble-menu,
    .david-blocknote-view .bn-side-menu,
    .david-blocknote-view .bn-toolbar,
    webtalk-widget,
    [class*="webtalk"],
    [id*="webtalk"] {
        display: none !important;
    }

    /* Reset layouts for page flow */
    html, body {
        height: auto !important;
        min-height: 100% !important;
        overflow: visible !important;
        background: #fff !important;
        color: #000 !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }

    .note-container,
    .stack,
    .layer_1,
    .layer_2,
    .layer_3,
    .preview-pane,
    .tiptap-editor-shell,
    .david-blocknote-view,
    .print-export-content {
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        display: block !important;
        float: none !important;
        position: static !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
    }

    /* Print content page formatting */
    #preview-md,
    #preview-plain,
    .markdown-body,
    .print-export-content {
        height: auto !important;
        overflow: visible !important;
        padding: 0 !important;
        margin: 0 auto !important;
        background: transparent !important;
        color: #000 !important;
        max-width: 100% !important;
        width: 100% !important;
        font-size: 11pt !important;
        line-height: 1.5 !important;
    }

    .markdown-body {
        background-color: transparent !important;
        color: #000 !important;
    }

    /* High specificity reset to override body.share-view #preview-md.markdown-body > table negative margins */
    body #preview-md.markdown-body > pre,
    body #preview-md.markdown-body > table,
    body #preview-md.markdown-body > .media-preview,
    body.share-view #preview-md.markdown-body > pre,
    body.share-view #preview-md.markdown-body > table,
    body.share-view #preview-md.markdown-body > .media-preview,
    body.preview-device-mobile #preview-md.markdown-body > pre,
    body.preview-device-mobile #preview-md.markdown-body > table,
    body.preview-device-mobile #preview-md.markdown-body > .media-preview,
    .markdown-body > pre,
    .markdown-body > table,
    .markdown-body > .media-preview,
    .markdown-body table {
        margin-left: 0 !important;
        margin-right: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
    }

    .markdown-body table {
        display: table !important;
        table-layout: auto !important;
        border-collapse: collapse !important;
        word-break: break-word !important;
        overflow-wrap: anywhere !important;
        overflow: visible !important;
        box-shadow: none !important;
    }

    .markdown-body table th,
    .markdown-body table td {
        padding: 6px 8px !important;
        font-size: 10pt !important;
        line-height: 1.4 !important;
        word-break: break-word !important;
        overflow-wrap: anywhere !important;
        white-space: normal !important;
        box-sizing: border-box !important;
        max-width: none !important;
    }

    /* Keep page breaks clean */
    h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid !important;
        break-after: avoid !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }
    
    pre, blockquote, tr, img, figure {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }
    
    a {
        color: #000 !important;
        text-decoration: underline !important;
    }
}
`
