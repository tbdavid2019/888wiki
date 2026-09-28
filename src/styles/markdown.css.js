/**
 * src/styles/markdown.css.js
 * Markdown rendering styles: typography, tables, code, alerts, GitHub-style
 */
export const getMarkdownCss = () => `
.markdown-body {
    font-family: var(--editor-font-family);
    font-size: 16px;
    line-height: 1.5;
    word-wrap: break-word;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4, .markdown-body h5, .markdown-body h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
.markdown-body h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #eaecef; }
.markdown-body h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #eaecef; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1em; }
.markdown-body p { margin-top: 0; margin-bottom: 16px; }
.markdown-body blockquote { margin: 0; padding: 0 1em; color: #6a737d; border-left: 0.25em solid #dfe2e5; }
.markdown-body .markdown-toc { margin: 0 0 24px; }
.markdown-body .markdown-toc-list { margin: 0; padding-left: 1.5em; }
.markdown-body .markdown-toc-list .markdown-toc-list { margin: 4px 0; }
.markdown-body .markdown-toc-link { color: inherit; }
.markdown-body ul, .markdown-body ol { padding-left: 2em; margin-top: 0; margin-bottom: 16px; }
.markdown-body table { display: block; width: 100%; overflow: auto; margin-top: 0; margin-bottom: 16px; border-spacing: 0; border-collapse: collapse; }
.markdown-body table tr { border-top: 1px solid #c6cbd1; }
.markdown-body table th, .markdown-body table td { padding: 6px 13px; border: 1px solid #dfe2e5; }
.markdown-body table th { font-weight: 600; }
.markdown-body code { padding: 0.2em 0.4em; margin: 0; font-size: 85%; border-radius: 3px; font-family: var(--editor-font-family); }
.markdown-body pre { padding: 16px; overflow: auto; font-size: 85%; line-height: 1.45; border-radius: 3px; }
.markdown-body pre code { display: inline; padding: 0; margin: 0; overflow: visible; line-height: inherit; word-wrap: normal; background-color: transparent; border: 0; }
.markdown-body hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: #e1e4e8; border: 0; }
.markdown-body a { color: #0366d6; text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body img { max-width: 100%; box-sizing: content-box; }
.markdown-body .two-column-layout,
.markdown-body .three-column-layout {
    display: grid;
    gap: clamp(20px, 3vw, 40px);
    align-items: start;
    margin: 20px 0;
}
.markdown-body .two-column-layout {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}
.markdown-body .three-column-layout {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}
.markdown-body .column-layout-item {
    min-width: 0;
}
.markdown-body .column-layout-item > :first-child {
    margin-top: 0;
}
.markdown-body .column-layout-item > :last-child {
    margin-bottom: 0;
}
@media (max-width: 720px) {
    .markdown-body .two-column-layout,
    .markdown-body .three-column-layout {
        grid-template-columns: minmax(0, 1fr);
    }
}
.markdown-body .media-preview { margin: 20px 0; padding: 12px; border: 1px solid rgba(127, 127, 127, 0.28); border-radius: 8px; background: rgba(127, 127, 127, 0.06); }
.markdown-body .media-preview-player { display: block; width: 100%; max-width: 100%; border: 0; border-radius: 4px; }
.markdown-body .media-preview-youtube { padding: 0; overflow: hidden; }
.markdown-body .media-preview-youtube .media-preview-player { aspect-ratio: 16 / 9; width: 100%; height: auto; min-height: 0; background: #000; }
.markdown-body .media-preview-pdf .media-preview-player { min-height: min(75vh, 760px); background: #fff; }
.markdown-body .media-preview-video .media-preview-player { max-height: min(75vh, 720px); background: #000; }
.markdown-body .media-preview-audio .media-preview-player { min-height: 42px; }
.markdown-body .media-preview figcaption { margin-top: 8px; font-size: 0.82em; overflow-wrap: anywhere; }
.markdown-body .media-preview-fallback { color: inherit; }

/* Apache ECharts code fences */
.diagram-echarts-render {
    width: 100%;
    min-height: 360px;
    margin: 20px 0;
    overflow: hidden;
    border-radius: 6px;
}
.diagram-echarts-render canvas {
    max-width: 100%;
}
.diagram-render-error {
    min-height: 0;
    padding: 12px 16px;
    overflow-x: auto;
    border: 1px solid #f1aeb5;
    border-radius: 6px;
    background: #fff5f5;
    color: #842029;
    font-family: var(--editor-font-family);
    font-size: 13px;
    white-space: pre-wrap;
}

/* GitHub Alerts */
.markdown-alert { padding: 8px 16px; margin-bottom: 16px; border-left: 0.25em solid; border-radius: 6px; }
.markdown-alert > :first-child { margin-top: 0; }
.markdown-alert > :last-child { margin-bottom: 0; }
.markdown-alert-note { border-color: #0969da; background-color: #f1f8ff; color: #0d1117; }
.markdown-alert-note::before { content: "ℹ️ Note"; font-weight: 600; display: block; margin-bottom: 4px; color: #0969da; }
.markdown-alert-tip { border-color: #1a7f37; background-color: #f0fdf4; color: #0d1117; }
.markdown-alert-tip::before { content: "💡 Tip"; font-weight: 600; display: block; margin-bottom: 4px; color: #1a7f37; }
.markdown-alert-important { border-color: #8250df; background-color: #f6f0ff; color: #0d1117; }
.markdown-alert-important::before { content: "💬 Important"; font-weight: 600; display: block; margin-bottom: 4px; color: #8250df; }
.markdown-alert-warning { border-color: #9a6700; background-color: #fff8c5; color: #0d1117; }
.markdown-alert-warning::before { content: "⚠️ Warning"; font-weight: 600; display: block; margin-bottom: 4px; color: #9a6700; }
.markdown-alert-caution { border-color: #cf222e; background-color: #ffebe9; color: #0d1117; }
.markdown-alert-caution::before { content: "🛑 Caution"; font-weight: 600; display: block; margin-bottom: 4px; color: #cf222e; }

/* Pandoc Academic Citations & Footnotes */
.markdown-body .pandoc-citation,
.pandoc-citation {
    font-style: normal;
    display: inline;
}
.markdown-body .citation-ref,
.citation-ref {
    color: var(--theme-accent, #0969da);
    text-decoration: none;
    font-weight: 500;
    padding: 1px 5px;
    border-radius: 4px;
    background-color: rgba(9, 105, 218, 0.08);
    transition: background-color 0.15s ease, color 0.15s ease;
    cursor: pointer;
    white-space: nowrap;
}
.markdown-body .citation-ref:hover,
.citation-ref:hover {
    background-color: rgba(9, 105, 218, 0.18);
    color: var(--theme-accent-hover, #0550ae);
    text-decoration: none;
}
.markdown-body .footnote-ref a,
.footnote-ref a,
[data-footnote-ref] {
    cursor: pointer;
    padding: 1px 4px;
    border-radius: 3px;
    transition: background-color 0.15s ease;
}
.markdown-body .footnote-ref a:hover,
.footnote-ref a:hover,
[data-footnote-ref]:hover {
    background-color: rgba(9, 105, 218, 0.15);
}

/* Footnote & Citation Hover Popover */
.footnote-popover {
    position: fixed;
    z-index: 10050;
    max-width: 420px;
    min-width: 240px;
    max-height: 280px;
    background: rgba(255, 255, 255, 0.96);
    color: #1e293b;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 12px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    padding: 12px 14px;
    font-size: 13.5px;
    line-height: 1.55;
    opacity: 0;
    visibility: hidden;
    transform: translateY(4px);
    transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.18s;
    pointer-events: none;
    overflow-y: auto;
}
.footnote-popover.visible,
.footnote-popover[data-active="true"] {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    pointer-events: auto;
}
.footnote-popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.footnote-popover-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
.footnote-popover-badge svg {
    color: #0969da;
}
.footnote-popover-close {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    color: #94a3b8;
    padding: 2px 6px;
    border-radius: 4px;
    transition: color 0.15s, background-color 0.15s;
}
.footnote-popover-close:hover {
    color: #1e293b;
    background-color: rgba(0, 0, 0, 0.06);
}
.footnote-popover-body {
    word-break: break-word;
    color: #334155;
}
.footnote-popover-body p {
    margin: 0 0 6px;
}
.footnote-popover-body p:last-child {
    margin-bottom: 0;
}
.footnote-popover-body code {
    font-size: 12px;
    padding: 2px 5px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.06);
}
.footnote-popover-body a {
    color: #0969da;
    text-decoration: underline;
    text-underline-offset: 2px;
}

/* Footnote Target Highlight Pulse */
@keyframes footnoteHighlightPulse {
    0% {
        background-color: rgba(234, 179, 8, 0.45);
        box-shadow: 0 0 0 6px rgba(234, 179, 8, 0.25);
    }
    100% {
        background-color: transparent;
        box-shadow: 0 0 0 0 transparent;
    }
}

.footnote-target-highlight {
    animation: footnoteHighlightPulse 1.8s cubic-bezier(0.16, 1, 0.3, 1) !important;
    border-radius: 6px;
}

/* Footnotes Section & Jump Targets */
.footnotes,
[data-footnotes] {
    margin-top: 2.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border-color, #e1e4e8);
    font-size: 0.9em;
    position: relative;
    scroll-margin-top: 24px;
}

.footnotes ol,
[data-footnotes] ol {
    padding-left: 1.5rem;
    margin: 0;
}

.footnotes li,
[data-footnotes] li {
    margin-bottom: 0.5rem;
    scroll-margin-top: 24px;
}

.footnotes li:target,
[data-footnotes] li:target,
[id^="fn-"],
[id^="user-content-fn-"],
[id^="fnref-"],
[id^="user-content-fnref-"] {
    scroll-margin-top: 24px;
}

[data-ui-theme="dark"] .footnotes,
[data-ui-theme="dark"] [data-footnotes] {
    border-top-color: var(--border-color, #334155);
}

/* Markdown Text Highlight */
.markdown-body mark,
.markdown-highlight {
    background-color: rgba(254, 240, 138, 0.75);
    color: inherit;
    padding: 1px 5px;
    border-radius: 4px;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
}
[data-ui-theme="dark"] .markdown-body mark,
[data-ui-theme="dark"] .markdown-highlight {
    background-color: rgba(234, 179, 8, 0.32);
    color: #fef08a;
}

/* Code Block Enhancements (Line numbers, Header, Filename, Copy button) */
.code-block-wrapper {
    position: relative;
    margin: 1.2em 0;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    background: rgba(0, 0, 0, 0.02);
    overflow: hidden;
}
[data-ui-theme="dark"] .code-block-wrapper {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.2);
}
.code-block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.05);
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    font-size: 12px;
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
    color: #555;
}
[data-ui-theme="dark"] .code-block-header {
    background: rgba(255, 255, 255, 0.05);
    border-bottom-color: rgba(255, 255, 255, 0.08);
    color: #aaa;
}
.code-block-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    font-size: 11.5px;
    letter-spacing: 0.04em;
}
.code-file-icon {
    font-size: 13px;
}
.code-copy-btn {
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 5px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 500;
    color: #444;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.15s ease;
}
[data-ui-theme="dark"] .code-copy-btn {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.18);
    color: #ddd;
}
.code-copy-btn:hover {
    background: var(--toolbar-accent, #2563eb);
    color: #ffffff;
    border-color: var(--toolbar-accent, #2563eb);
}
.code-copy-btn.copied {
    background: #16a34a;
    color: #ffffff;
    border-color: #16a34a;
}
.code-block-wrapper pre {
    margin: 0 !important;
    border: none !important;
    border-radius: 0 !important;
}
pre.has-line-numbers {
    display: flex !important;
    padding-left: 0 !important;
}
.code-line-numbers {
    flex: 0 0 auto;
    padding: 12px 10px 12px 14px;
    text-align: right;
    user-select: none;
    color: rgba(0, 0, 0, 0.35);
    border-right: 1px solid rgba(0, 0, 0, 0.08);
    font-family: var(--font-mono, monospace);
    font-size: inherit;
    line-height: inherit;
}
[data-ui-theme="dark"] .code-line-numbers {
    color: rgba(255, 255, 255, 0.3);
    border-right-color: rgba(255, 255, 255, 0.08);
}
.code-line-numbers .line-number {
    display: block;
}

/* ==========================================================================
   Book Mode Styles
   ========================================================================== */
.book-mode-active .note-container,
.book-mode-active .footer,
.book-mode-active #share-root,
.book-mode-active #main-app {
    display: none !important;
}

#book-mode-container {
    display: flex;
    min-height: 100vh;
    background: var(--bg-color, #ffffff);
    color: var(--text-color, #1f2328);
    position: relative;
}

.book-sidebar {
    width: 290px;
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.02);
    border-right: 1px solid rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    height: 100vh;
    position: sticky;
    top: 0;
    z-index: 100;
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

[data-ui-theme="dark"] .book-sidebar {
    background: rgba(255, 255, 255, 0.03);
    border-right-color: rgba(255, 255, 255, 0.08);
}

.book-sidebar-resizer {
    width: 6px;
    flex-shrink: 0;
    cursor: col-resize;
    position: relative;
    z-index: 101;
    background: transparent;
    transition: background 0.15s ease;
    margin-left: -3px;
    margin-right: -3px;
}

.book-sidebar-resizer:hover,
.book-sidebar-resizer.is-resizing {
    background: var(--toolbar-accent, #2563eb);
}

.book-sidebar-resizer::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    right: -3px;
}

@media (max-width: 768px) {
    .book-sidebar-resizer {
        display: none !important;
    }
}

.book-sidebar-header {
    padding: 14px 16px 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

[data-ui-theme="dark"] .book-sidebar-header {
    border-bottom-color: rgba(255, 255, 255, 0.06);
}

.book-top-actions {
    display: flex;
    align-items: center;
    justify-content: flex-start;
}

.book-exit-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted, rgba(0, 0, 0, 0.6));
    text-decoration: none;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: rgba(0, 0, 0, 0.02);
    transition: all 0.15s ease;
    cursor: pointer;
    line-height: 1.4;
}

[data-ui-theme="dark"] .book-exit-link {
    color: rgba(255, 255, 255, 0.7);
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
}

.book-exit-link:hover {
    color: var(--accent-color, #2563eb);
    border-color: var(--accent-color, #2563eb);
    background: rgba(37, 99, 235, 0.08);
}

.book-brand-title {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.4;
    margin: 2px 0 0 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
    border-radius: 6px;
    padding: 3px 6px;
    margin-left: -6px;
    transition: background 0.15s ease;
}

.book-brand-title:hover {
    background: rgba(0, 0, 0, 0.04);
}

[data-ui-theme="dark"] .book-brand-title:hover {
    background: rgba(255, 255, 255, 0.06);
}

.book-search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    background: rgba(255, 255, 255, 0.8);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s ease;
}

[data-ui-theme="dark"] .book-search-input {
    background: rgba(0, 0, 0, 0.25);
    border-color: rgba(255, 255, 255, 0.15);
    color: #fff;
}

.book-search-input:focus {
    border-color: var(--toolbar-accent, #2563eb);
}

.book-toc-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 12px 10px 24px;
}

.book-section-group {
    margin-bottom: 16px;
}

.book-section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(0, 0, 0, 0.45);
    padding: 4px 10px;
    margin: 0 0 4px;
}

[data-ui-theme="dark"] .book-section-title {
    color: rgba(255, 255, 255, 0.4);
}

.book-toc-list {
    list-style: none;
    margin: 0;
    padding: 0;
}

.book-toc-item {
    margin-bottom: 2px;
}

.book-toc-link {
    display: flex;
    align-items: center;
    padding: 7px 12px;
    border-radius: 6px;
    font-size: 13.5px;
    color: inherit;
    text-decoration: none;
    transition: all 0.15s ease;
    line-height: 1.4;
}

.book-toc-link:hover {
    background: rgba(0, 0, 0, 0.04);
    text-decoration: none;
}

[data-ui-theme="dark"] .book-toc-link:hover {
    background: rgba(255, 255, 255, 0.06);
}

.book-toc-item.active .book-toc-link {
    background: var(--toolbar-accent, #2563eb);
    color: #ffffff !important;
    font-weight: 600;
}

.book-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

.book-topbar {
    position: sticky;
    top: 0;
    z-index: 90;
    background: var(--bg-color, #ffffff);
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 24px;
    gap: 16px;
}

[data-ui-theme="dark"] .book-topbar {
    border-bottom-color: rgba(255, 255, 255, 0.08);
}

.book-progress-track {
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background: transparent;
}

.book-progress-fill {
    height: 100%;
    width: 0%;
    background: var(--toolbar-accent, #2563eb);
    transition: width 0.1s linear;
}

.book-breadcrumbs {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(0, 0, 0, 0.55);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

[data-ui-theme="dark"] .book-breadcrumbs {
    color: rgba(255, 255, 255, 0.55);
}

.book-breadcrumbs .crumb-current {
    font-weight: 600;
    color: var(--text-color, #1f2328);
}

.book-iframe-container {
    flex: 1;
    width: 100%;
    height: calc(100vh - 49px);
    display: flex;
    flex-direction: column;
    position: relative;
    background: transparent;
}

.book-embed-frame {
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
    flex: 1;
}

.book-top-nav-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.book-top-nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted, rgba(0, 0, 0, 0.6));
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: rgba(0, 0, 0, 0.02);
    text-decoration: none;
    cursor: pointer;
    transition: all 0.15s ease;
}

[data-ui-theme="dark"] .book-top-nav-btn {
    color: rgba(255, 255, 255, 0.7);
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
}

.book-top-nav-btn:hover {
    color: var(--accent-color, #2563eb);
    border-color: var(--accent-color, #2563eb);
    background: rgba(37, 99, 235, 0.08);
}

.book-top-nav-btn[disabled] {
    opacity: 0.35;
    pointer-events: none;
}

.book-content-wrap {
    flex: 1;
    max-width: 860px;
    width: 100%;
    margin: 0 auto;
    padding: 32px 24px 64px;
    box-sizing: border-box;
}

.book-chapter-nav {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
}

[data-ui-theme="dark"] .book-chapter-nav {
    border-top-color: rgba(255, 255, 255, 0.08);
}

.book-nav-card {
    display: flex;
    flex-direction: column;
    padding: 14px 16px;
    border-radius: 8px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    background: rgba(0, 0, 0, 0.015);
    color: inherit;
    text-decoration: none;
    transition: all 0.15s ease;
    cursor: pointer;
}

[data-ui-theme="dark"] .book-nav-card {
    border-color: rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
}

.book-nav-card:hover {
    border-color: var(--toolbar-accent, #2563eb);
    transform: translateY(-1px);
    text-decoration: none;
}

.book-nav-card.next {
    text-align: right;
    grid-column: 2;
}

.book-nav-card.prev {
    grid-column: 1;
}

.book-nav-hint {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--toolbar-accent, #2563eb);
    margin-bottom: 4px;
}

.book-nav-title {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.book-sidebar-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 95;
}

@media (max-width: 860px) {
    .book-sidebar {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        transform: translateX(-100%);
        box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
    }
    .book-sidebar.open {
        transform: translateX(0);
    }
    .book-sidebar.open ~ .book-sidebar-backdrop {
        display: block;
    }
    .book-chapter-nav {
        grid-template-columns: 1fr;
    }
    .book-nav-card.next {
        grid-column: 1;
    }
    .book-topbar {
        padding: 8px 12px;
        gap: 8px;
    }
    .book-top-nav-group {
        gap: 4px;
    }
    .book-top-nav-btn {
        font-size: 11.5px;
        padding: 4px 8px;
    }
}

@media (max-width: 640px) {
    .book-topbar {
        padding: 6px 10px;
        gap: 6px;
    }
    .book-breadcrumbs {
        max-width: 120px;
        font-size: 12px;
    }
    .book-btn-label {
        display: none !important;
    }
    .book-top-nav-btn {
        min-height: 34px;
        padding: 4px 10px;
        font-size: 13px;
    }
    .book-top-nav-btn .svg-icon {
        width: 16px;
        height: 16px;
    }
    .code-copy-btn {
        min-height: 28px;
        padding: 4px 8px;
        font-size: 11px;
    }
    .code-copy-btn svg {
        width: 14px;
        height: 14px;
    }
    .book-export-menu {
        position: fixed;
        top: 48px;
        left: 12px;
        right: 12px;
        min-width: unset;
        max-width: calc(100vw - 24px);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
    }
}

/* Book Mode Export Dropdown & Offline Cache Badge */
.book-export-dropdown {
    position: relative;
    display: inline-block;
}

.book-export-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: var(--surface-bg, #ffffff);
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    padding: 6px;
    display: none;
    flex-direction: column;
    gap: 2px;
    z-index: 1000;
}

[data-ui-theme="dark"] .book-export-menu {
    background: #1e222b;
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
}

.book-export-menu.show {
    display: flex;
}

.book-export-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-color, #1f2328);
    text-decoration: none;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
    box-sizing: border-box;
    transition: background 0.15s ease;
}

[data-ui-theme="dark"] .book-export-item {
    color: #e6edf3;
}

.book-export-item:hover {
    background: rgba(37, 99, 235, 0.08);
    color: var(--toolbar-accent, #2563eb);
}

.book-top-nav-btn.cached {
    color: #10b981;
    border-color: rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.08);
}

/* Multi-chapter Print Layout */
#book-print-container {
    display: none;
}

@media print {
    body.book-mode-active {
        overflow: visible !important;
        background: #ffffff !important;
        color: #000000 !important;
    }
    body.book-mode-active #book-mode-container,
    body.book-mode-active .book-sidebar,
    body.book-mode-active .book-topbar,
    body.book-mode-active .book-sidebar-resizer,
    body.book-mode-active .book-sidebar-backdrop {
        display: none !important;
    }
    body.book-mode-active #book-print-container {
        display: block !important;
        padding: 0 !important;
        margin: 0 !important;
    }
    .book-print-cover {
        text-align: center;
        padding: 120px 40px 80px;
        page-break-after: always;
    }
    .book-print-cover h1 {
        font-size: 32px;
        margin-bottom: 20px;
    }
    .book-print-chapter {
        page-break-after: always;
        padding: 20px 0;
    }
    .book-print-chapter:last-child {
        page-break-after: auto;
    }
}
`


