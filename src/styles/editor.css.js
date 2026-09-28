/**
 * src/styles/editor.css.js
 * Editor-specific styles: textarea, preview areas, contents layout
 */
export const getEditorCss = () => `
/* Editor & Preview Areas */
.editor-pane {
    flex: 1;
    min-width: 0;
    min-height: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.editor-code-shell {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    position: relative;
    overflow: hidden;
    background: #282a36;
    --editor-font-size: 16px;
    --editor-line-height: 1.6;
    --editor-row-height: calc(var(--editor-font-size, 16px) * var(--editor-line-height, 1.6));
    --editor-gutter-digits: 2;
    --editor-gutter-width: clamp(26px, calc(var(--editor-gutter-digits, 2) * 8.5px + 12px), 72px);
}

.editor-code-shell > textarea.contents {
    width: 100%;
    min-height: 0;
    padding: 20px 24px 20px 14px;
}

.editor-welcome {
    position: absolute;
    inset: 0 0 0 var(--editor-gutter-width, 28px);
    z-index: 1;
    display: grid;
    place-content: center;
    width: auto;
    padding: clamp(28px, 8vh, 88px) clamp(32px, 8vw, 120px);
    color: #abb2c5;
    font-family: var(--editor-font-family);
    pointer-events: none;
    text-align: center;
}

.editor-welcome__section {
    width: min(100%, 44rem);
}

.editor-welcome__section--tip {
    margin-top: 24px;
    padding-top: 22px;
    border-top: 1px solid rgba(248, 248, 242, .16);
}

.editor-welcome__label {
    margin: 0 0 10px;
    color: #e4e7ef;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: .01em;
    line-height: 1.45;
}

.editor-welcome__copy {
    font-size: 15px;
    line-height: 1.82;
}

.editor-welcome__copy p {
    margin: 0;
}

.editor-welcome__copy p.is-typing::after {
    content: '▋';
    display: inline-block;
    margin-left: 2px;
    font-size: 0.85em;
    color: #38bdf8;
    animation: welcomeCaret 0.7s infinite;
}

@keyframes welcomeCaret {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}

@media (max-width: 640px) {
    .editor-welcome {
        inset: 0 0 0 var(--editor-gutter-width, 22px);
        padding: 28px 20px 72px;
    }

    .editor-welcome__section--tip {
        margin-top: 20px;
        padding-top: 18px;
    }

    .editor-welcome__label,
    .editor-welcome__copy {
        font-size: 14px;
    }
}

.preview-welcome {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    place-content: center;
    width: 100%;
    height: 100%;
    padding: clamp(28px, 8vh, 88px) clamp(32px, 8vw, 120px);
    color: var(--preview-muted, #64748b);
    font-family: var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
    pointer-events: none;
    text-align: center;
    box-sizing: border-box;
}

.preview-welcome .editor-welcome__section--tip {
    margin-top: 0;
    padding-top: 0;
    border-top: none;
}

.preview-welcome .editor-welcome__label {
    color: var(--text-color, #1e293b);
}

.preview-welcome .editor-welcome__copy {
    color: var(--preview-muted, #64748b);
}

.preview-welcome .editor-welcome__copy p.is-typing::after {
    color: var(--theme-accent, #0969da);
}

.david-blocknote-audio-wrap {
    width: 100%;
    max-width: 520px;
    padding: 10px 14px;
    border-radius: 8px;
    background: var(--editor-surface-muted, rgba(125, 125, 125, 0.08));
    border: 1px solid var(--toolbar-border, #e2e8f0);
}

.david-blocknote-audio-wrap audio {
    width: 100%;
    display: block;
}

.block-editor-pane {
    overflow: hidden;
    background: var(--editor-surface, #fff);
}

.block-editor {
    width: min(900px, 100%);
    height: 100%;
    margin: 0 auto;
    padding: 18px 22px 42px;
    overflow: auto;
    color: var(--text-color, #24292f);
}

.block-editor-toolbar,
.block-card-controls,
.block-body,
.block-field {
    display: flex;
    align-items: center;
    gap: 8px;
}

.block-editor-toolbar {
    position: sticky;
    top: -18px;
    z-index: 2;
    justify-content: space-between;
    margin: -18px -22px 16px;
    padding: 12px 22px;
    border-bottom: 1px solid var(--toolbar-border, #e2dacd);
    background: color-mix(in srgb, var(--editor-surface, #fff) 94%, transparent);
    backdrop-filter: blur(8px);
}

.block-add-select,
.block-type-select,
.block-heading-level,
.block-field-input,
.block-source-input,
.block-action {
    border: 1px solid var(--toolbar-border, #d0d7de);
    border-radius: 6px;
    background: var(--status-control-bg, #fff);
    color: inherit;
    font: inherit;
}

.block-add-select,
.block-type-select,
.block-heading-level,
.block-field-input {
    min-height: 32px;
    padding: 4px 8px;
}

.block-list { display: grid; gap: 10px; }

.block-card {
    padding: 10px 12px 12px;
    border: 1px solid transparent;
    border-radius: 8px;
}

.block-card:hover,
.block-card:focus-within {
    border-color: var(--toolbar-border, #d0d7de);
    background: color-mix(in srgb, var(--status-control-bg, #fff) 94%, #d0d7de);
}

.block-card-controls { justify-content: flex-end; min-height: 28px; }
.block-type-select { margin-right: auto; font-size: 13px; }
.block-action { width: 28px; height: 28px; cursor: pointer; }
.block-action:disabled { opacity: .35; cursor: default; }
.block-action-danger { color: #b42318; }

.block-body { align-items: flex-start; flex-wrap: wrap; }
.block-text-input {
    flex: 1 1 360px;
    min-height: 36px;
    padding: 6px 4px;
    outline: none;
    font-size: 17px;
    line-height: 1.65;
    white-space: pre-wrap;
}
.block-text-input:empty::before { content: attr(placeholder); color: #8c959f; pointer-events: none; }
.block-body-heading .block-text-input { font-size: 26px; font-weight: 700; }
.block-body-quote .block-text-input { padding-left: 14px; border-left: 3px solid var(--toolbar-accent, #c8654b); }
.block-body-bulletList .block-text-input::before { content: '• '; color: var(--toolbar-muted, #6e7781); }

.block-field { flex: 1 1 190px; flex-direction: column; align-items: stretch; font-size: 12px; color: var(--toolbar-muted, #57606a); }
.block-field-input { width: 100%; color: var(--text-color, #24292f); }
.block-source-field { flex-basis: 100%; }
.block-source-input { width: 100%; min-height: 110px; padding: 9px; resize: vertical; font: 13px/1.5 var(--editor-font-family); }
.block-static-help { margin: 4px 0; color: var(--toolbar-muted, #57606a); font-size: 13px; }
.block-upload-button { position: relative; overflow: hidden; display: inline-flex; align-items: center; min-height: 32px; padding: 4px 10px; border: 1px solid var(--toolbar-border, #d0d7de); border-radius: 6px; cursor: pointer; font-size: 13px; }
.block-file-picker { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

@media (max-width: 640px) {
    .block-editor { padding: 12px 12px 32px; }
    .block-editor-toolbar { top: -12px; margin: -12px -12px 12px; padding: 10px 12px; }
    .block-card { padding: 8px; }
    .block-card-controls { gap: 5px; }
    .block-type-select { max-width: 150px; }
}

/* Tiptap Block Editor */
.block-editor-pane { background: var(--editor-surface, #fff); }
.block-editor { width: 100%; max-width: none; padding: 0; }
.block-editor-pane .block-editor { overflow: auto; }
.david-blocknote-app { min-height: 100%; }
.david-blocknote-view.bn-mantine { min-height: 100%; padding: 34px clamp(20px, 6vw, 76px) 80px; background: var(--bn-colors-editor-background, var(--editor-surface, #fff)); color: var(--bn-colors-editor-text, var(--text-color, #24292f)); }
.david-blocknote-view .bn-editor { min-height: calc(100vh - 230px); padding: 0; font-family: var(--editor-font-family); font-size: 17px; line-height: 1.8; }
.david-blocknote-view .bn-side-menu { z-index: 12; }
.david-blocknote-view .bn-suggestion-menu { max-height: min(420px, calc(100dvh - 28px)); }
.david-blocknote-view .bn-formatting-toolbar { border-radius: 9px; box-shadow: 0 10px 28px rgba(15, 23, 42, .16); }
.david-blocknote-embed { width: 100%; margin: 10px 0; overflow: hidden; border: 1px solid var(--toolbar-border, #d0d7de); border-radius: 10px; background: color-mix(in srgb, var(--status-control-bg, #fff) 96%, #d0d7de); box-sizing: border-box; }
.david-blocknote-embed header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 10px; border-bottom: 1px solid color-mix(in srgb, var(--toolbar-border, #d0d7de) 75%, transparent); color: var(--toolbar-muted, #57606a); font-size: 12px; }
.david-blocknote-embed header button { min-height: 30px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: var(--toolbar-accent, #c8654b); cursor: pointer; font: inherit; }
.david-blocknote-embed header button:hover, .david-blocknote-embed header button:focus-visible { background: var(--toolbar-bg-hover, #f0f2f4); outline: none; }
.david-blocknote-embed-preview { display: grid; min-height: 54px; place-items: start; padding: 12px; color: var(--toolbar-muted, #57606a); font-size: 13px; }
.david-blocknote-embed-preview img { display: block; max-width: 100%; max-height: 360px; border-radius: 5px; }
.david-blocknote-view .bn-block-content[data-content-type="checkListItem"] { display: flex; align-items: baseline; gap: 8px; }
.david-blocknote-view .bn-block-content[data-content-type="checkListItem"][data-check-list-item-checked="true"] .bn-inline-content,
.david-blocknote-view .bn-block-content[data-content-type="checkListItem"][data-checked="true"] .bn-inline-content,
.david-blocknote-view .bn-block-content[data-content-type="checkListItem"]:has(input:checked) .bn-inline-content { text-decoration: line-through; opacity: 0.55; color: var(--toolbar-muted, #6e7781); transition: all 0.2s ease; }
.david-blocknote-view .bn-block-content[data-content-type="checkListItem"] input[type="checkbox"] { cursor: pointer; border-radius: 4px; accent-color: var(--toolbar-accent, #0969da); transition: transform 0.12s ease; }
.david-blocknote-view .bn-block-content[data-content-type="checkListItem"] input[type="checkbox"]:hover { transform: scale(1.1); }
.david-blocknote-menu-icon { display: inline-grid; width: 20px; place-items: center; color: var(--toolbar-accent, #c8654b); font-size: 12px; }
.david-blocknote-dialog { position: fixed; inset: 0; z-index: 1300; display: grid; place-items: center; padding: 16px; }
.david-blocknote-dialog-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, .48); backdrop-filter: blur(3px); }
.david-blocknote-dialog-card { position: relative; z-index: 1; display: grid; gap: 14px; width: min(560px, 100%); max-height: min(720px, calc(100dvh - 32px)); overflow: auto; padding: 20px; box-sizing: border-box; border: 1px solid var(--toolbar-border, #d0d7de); border-radius: 14px; background: var(--editor-surface, #fff); color: var(--text-color, #24292f); box-shadow: 0 24px 70px rgba(15, 23, 42, .3); }
.david-blocknote-dialog-card header, .david-blocknote-dialog-card footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.david-blocknote-dialog-card h2 { margin: 0; font-size: 18px; }
.david-blocknote-dialog-card label { display: grid; gap: 6px; font-size: 14px; font-weight: 650; }
.david-blocknote-dialog-card :is(input, textarea) { width: 100%; box-sizing: border-box; padding: 9px 10px; border: 1px solid var(--toolbar-border, #d0d7de); border-radius: 7px; background: var(--editor-surface, #fff); color: inherit; font: 400 14px/1.55 var(--editor-font-family); }
.david-blocknote-dialog-card textarea { min-height: 160px; resize: vertical; }
.david-blocknote-dialog-card button { min-height: 36px; padding: 0 14px; border: 1px solid var(--toolbar-border, #d0d7de); border-radius: 7px; background: var(--toolbar-bg, #fff); color: inherit; cursor: pointer; font: inherit; }
.david-blocknote-dialog-card footer button[type="submit"] { border-color: var(--toolbar-accent, #c8654b); background: var(--toolbar-accent, #c8654b); color: #fff; }
.david-blocknote-dialog-card :is(button, input, textarea):focus-visible { outline: 2px solid var(--toolbar-accent, #c8654b); outline-offset: 2px; }
.david-blocknote-dialog-error { min-height: 1.3em; margin: -4px 0 0; color: #b42318; font-size: 13px; }
.tiptap-editor-shell { position: relative; width: min(920px, 100%); min-height: 100%; margin: 0 auto; padding: 38px 28px 72px; }
.tiptap-editor-toolbar {
    position: absolute; top: 10px; right: 28px; z-index: 5; display: flex; align-items: center; gap: 2px;
    padding: 3px; border: 1px solid color-mix(in srgb, var(--toolbar-border, #d0d7de) 85%, transparent); border-radius: 9px;
    background: color-mix(in srgb, var(--editor-surface, #fff) 94%, transparent); box-shadow: 0 3px 14px rgba(15, 23, 42, .08);
    backdrop-filter: blur(14px); scrollbar-width: none;
}
.tiptap-editor-toolbar::-webkit-scrollbar { display: none; }
.tiptap-toolbar-button, .tiptap-insert-menu {
    flex: 0 0 auto; min-width: 36px; height: 36px; padding: 0 8px; border: 1px solid transparent; border-radius: 7px;
    background: transparent; color: var(--text-color, #24292f); font: 600 13px/1 var(--editor-font-family); cursor: pointer;
}
.tiptap-toolbar-button:hover, .tiptap-toolbar-button:focus-visible, .tiptap-toolbar-button.is-active,
.tiptap-insert-menu:hover, .tiptap-insert-menu:focus-visible { border-color: var(--toolbar-border, #d0d7de); background: var(--toolbar-bg-hover, #f0f2f4); color: var(--toolbar-accent, #c8654b); }
.tiptap-toolbar-button:focus-visible, .tiptap-insert-menu:focus-visible { outline: 2px solid var(--toolbar-accent, #c8654b); outline-offset: 1px; }
.tiptap-editor-toolbar [data-command="openBlockMenu"] { width: auto; min-width: 36px; padding: 0 10px; font-size: 20px; font-weight: 400; }
.tiptap-insert-menu { width: auto; min-width: 72px; font-weight: 500; }
.tiptap-editor-canvas { min-height: calc(100vh - 220px); cursor: text; }
.tiptap-editor-canvas .ProseMirror { min-height: inherit; outline: none; color: var(--text-color, #24292f); font: 17px/1.8 var(--editor-font-family); }
.tiptap-editor-canvas .ProseMirror > :first-child { margin-top: 0; }
.tiptap-editor-canvas .ProseMirror :is(h1, h2, h3) { margin: 1.25em 0 .48em; line-height: 1.28; letter-spacing: -.025em; }
.tiptap-editor-canvas .ProseMirror h1 { font-size: 2.15em; }
.tiptap-editor-canvas .ProseMirror h2 { font-size: 1.65em; }
.tiptap-editor-canvas .ProseMirror h3 { font-size: 1.34em; }
.tiptap-editor-canvas .ProseMirror p { margin: .62em 0; }
.tiptap-editor-canvas .ProseMirror :is(ul, ol) { padding-left: 1.55em; }

.tiptap-dialog {
    position: fixed;
    inset: 0;
    z-index: 1300;
    display: grid;
    place-items: center;
    padding: 16px;
}
.tiptap-dialog[hidden] { display: none; }
.tiptap-dialog-backdrop { position: absolute; inset: 0; background: rgba(15, 23, 42, .48); backdrop-filter: blur(3px); }
.tiptap-dialog-content {
    position: relative;
    z-index: 1;
    width: min(560px, 100%);
    max-height: min(720px, calc(100dvh - 32px));
    overflow: auto;
    display: grid;
    gap: 14px;
    padding: 20px;
    box-sizing: border-box;
    border: 1px solid var(--toolbar-border, #d0d7de);
    border-radius: 14px;
    background: var(--editor-surface, #fff);
    color: var(--text-color, #24292f);
    box-shadow: 0 24px 70px rgba(15, 23, 42, .3);
}
.tiptap-dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tiptap-dialog-header h2 { margin: 0; font-size: 18px; }
.tiptap-dialog-close, .tiptap-dialog-cancel, .tiptap-dialog-submit {
    min-height: 36px;
    border: 1px solid var(--toolbar-border, #d0d7de);
    border-radius: 7px;
    background: var(--toolbar-bg, #fff);
    color: inherit;
    font: inherit;
    cursor: pointer;
}
.tiptap-dialog-close { width: 36px; font-size: 22px; line-height: 1; }
.tiptap-dialog-submit { border-color: var(--toolbar-accent, #c8654b); background: var(--toolbar-accent, #c8654b); color: #fff; padding: 0 14px; }
.tiptap-dialog-cancel { padding: 0 14px; }
.tiptap-dialog :is(button, input, textarea):focus-visible { outline: 2px solid var(--toolbar-accent, #c8654b); outline-offset: 2px; }
.tiptap-dialog-help { margin: -4px 0 0; color: var(--toolbar-muted, #57606a); font-size: 13px; line-height: 1.55; }
.tiptap-dialog-field { display: grid; gap: 6px; font-size: 14px; font-weight: 650; }
.tiptap-dialog-field input, .tiptap-dialog-field textarea {
    width: 100%; box-sizing: border-box; border: 1px solid var(--toolbar-border, #d0d7de); border-radius: 7px;
    padding: 9px 10px; background: var(--editor-surface, #fff); color: inherit; font: 400 14px/1.55 var(--editor-font-family, inherit);
}
.tiptap-dialog-field textarea { resize: vertical; min-height: 150px; }
.tiptap-dialog-error { min-height: 1.3em; margin: -4px 0 0; color: #b42318; font-size: 13px; }
.tiptap-dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
.tiptap-embed-edit { margin-left: auto; }
.tiptap-embed-card-header .tiptap-toolbar-button { min-width: 32px; height: 32px; }
.tiptap-editor-canvas .ProseMirror li p { margin: .25em 0; }
.tiptap-editor-canvas .ProseMirror blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid var(--toolbar-accent, #c8654b); color: var(--toolbar-muted, #57606a); }
.tiptap-editor-canvas .ProseMirror pre { margin: 1em 0; padding: 14px 16px; overflow-x: auto; border-radius: 8px; background: #20212b; color: #eef0f3; font: 13px/1.65 var(--editor-font-family); }
.tiptap-editor-canvas .ProseMirror code { padding: .12em .28em; border-radius: 4px; background: color-mix(in srgb, var(--toolbar-border, #d0d7de) 35%, transparent); font: .88em var(--editor-font-family); }
.tiptap-editor-canvas .ProseMirror pre code { padding: 0; background: transparent; font-size: inherit; }
.tiptap-editor-canvas .ProseMirror hr { margin: 1.6em 0; border: 0; border-top: 1px solid var(--toolbar-border, #d0d7de); }
.tiptap-editor-canvas .ProseMirror .is-editor-empty:first-child::before { content: attr(data-placeholder); float: left; height: 0; color: #9aa1a9; pointer-events: none; }
.tiptap-embed-card { margin: 1.1em 0; overflow: hidden; border: 1px solid var(--toolbar-border, #d0d7de); border-radius: 10px; background: color-mix(in srgb, var(--status-control-bg, #fff) 97%, #d0d7de); box-shadow: 0 1px 2px rgba(0, 0, 0, .04); }
.tiptap-embed-card.ProseMirror-selectednode { outline: 2px solid var(--toolbar-accent, #c8654b); outline-offset: 2px; }
.tiptap-embed-card-header { display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; border-bottom: 1px solid color-mix(in srgb, var(--toolbar-border, #d0d7de) 75%, transparent); font-size: 12px; color: var(--toolbar-muted, #57606a); }
.tiptap-embed-delete { width: 24px; height: 24px; border: 0; border-radius: 5px; background: transparent; color: #b42318; cursor: pointer; font-size: 17px; }
.tiptap-embed-delete:hover { background: #fff0ef; }
.tiptap-embed-preview { display: grid; min-height: 52px; place-items: start; padding: 12px; color: var(--toolbar-muted, #57606a); font-size: 13px; }
.tiptap-embed-preview img { display: block; max-width: 100%; max-height: 360px; border-radius: 5px; }
.tiptap-embed-preview pre { width: 100%; margin: 0; white-space: pre-wrap; font: 12px/1.5 var(--editor-font-family); }
.tiptap-slash-menu, .tiptap-block-menu { position: fixed; z-index: 20; display: grid; width: min(340px, calc(100vw - 24px)); max-height: min(360px, calc(100dvh - 24px)); padding: 6px; overflow-y: auto; border: 1px solid var(--toolbar-border, #d0d7de); border-radius: 10px; background: var(--status-control-bg, #fff); box-shadow: 0 14px 35px rgba(0, 0, 0, .16); }
.tiptap-slash-menu[hidden], .tiptap-block-menu[hidden] { display: none; }
.tiptap-slash-item { display: grid; gap: 2px; padding: 9px 10px; border: 0; border-radius: 7px; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.tiptap-slash-item:hover, .tiptap-slash-item:focus-visible { background: var(--toolbar-bg-hover, #f0f2f4); outline: none; }
.tiptap-slash-item small { color: var(--toolbar-muted, #57606a); }
.tiptap-bubble-menu { display: flex; width: max-content; max-width: calc(100vw - 24px); gap: 3px; padding: 5px; border: 1px solid var(--toolbar-border, #d0d7de); border-radius: 8px; background: var(--status-control-bg, #fff); box-shadow: 0 8px 20px rgba(0, 0, 0, .15); white-space: nowrap; }
.tiptap-block-handle { display: flex; align-items: center; gap: 1px; padding: 2px; border-radius: 7px; background: var(--editor-surface, #fff); box-shadow: 0 2px 9px rgba(15, 23, 42, .12); }
.tiptap-add-block, .david888-drag-handle { display: grid; width: 26px; height: 28px; place-items: center; border: 0; border-radius: 5px; background: transparent; color: var(--toolbar-muted, #57606a); font-size: 19px; line-height: 1; }
.tiptap-add-block { cursor: pointer; font-size: 22px; font-weight: 300; }
.david888-drag-handle { cursor: grab; }
.tiptap-add-block:hover, .tiptap-add-block:focus-visible, .david888-drag-handle:hover { background: var(--toolbar-bg-hover, #f0f2f4); color: var(--toolbar-accent, #c8654b); outline: none; }
.david888-drag-handle:active { cursor: grabbing; }

@media (max-width: 640px) {
    .tiptap-toolbar-button, .tiptap-insert-menu { min-width: 40px; height: 40px; }
    .tiptap-dialog { padding: 12px; align-items: end; }
    .tiptap-dialog-content { width: 100%; max-height: min(82dvh, calc(100dvh - 24px)); border-radius: 16px; padding: 18px; }
    .tiptap-dialog-close, .tiptap-dialog-cancel, .tiptap-dialog-submit { min-height: 44px; }
    .tiptap-editor-shell { padding: 46px 16px 48px; }
    .tiptap-editor-toolbar { top: 8px; right: 16px; }
    .tiptap-editor-canvas .ProseMirror { font-size: 16px; }
    .tiptap-editor-canvas .ProseMirror h1 { font-size: 1.9em; }
    .tiptap-slash-menu, .tiptap-block-menu { right: 12px; left: 12px !important; width: auto; }
    .tiptap-block-handle { display: none !important; }
    .tiptap-bubble-menu { max-width: calc(100vw - 24px); overflow-x: auto; }
    .david-blocknote-view.bn-mantine { padding: 22px 16px 54px; }
    .david-blocknote-view .bn-editor { min-height: calc(100vh - 190px); font-size: 16px; }
    .david-blocknote-dialog { align-items: end; padding: 12px; }
    .david-blocknote-dialog-card { max-height: min(82dvh, calc(100dvh - 24px)); padding: 18px; border-radius: 16px; }
    .david-blocknote-dialog-card button { min-height: 44px; }
}

.editor-status {
    flex: 0 0 auto;
    min-height: 24px;
    padding: 4px 10px;
    overflow: hidden;
    border-top: 1px solid rgba(248, 248, 242, 0.12);
    background: #20212b;
    color: #a7a9bf;
    font-family: var(--editor-font-family);
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
}

.editor-line-numbers {
    flex: 0 0 var(--editor-gutter-width, 28px);
    min-width: var(--editor-gutter-width, 28px);
    width: var(--editor-gutter-width, 28px);
    box-sizing: border-box;
    padding: 20px 6px 20px 4px;
    overflow: hidden;
    border-right: 1px solid rgba(248, 248, 242, 0.08);
    background: #282a36;
    color: #6272a4;
    font-family: var(--editor-font-family);
    font-size: 13px;
    line-height: var(--editor-row-height, 25.6px);
    text-align: right;
    user-select: none;
    pointer-events: none;
    transition: width 0.12s ease, min-width 0.12s ease, flex-basis 0.12s ease;
}

.editor-line-number {
    display: block;
    box-sizing: border-box;
    min-height: var(--editor-row-height, 25.6px);
    line-height: var(--editor-row-height, 25.6px);
    text-align: right;
    overflow: hidden;
    white-space: nowrap;
}

.editor-line-mirror {
    position: absolute;
    top: 0;
    left: 0;
    visibility: hidden;
    pointer-events: none;
    z-index: -9999;
    white-space: pre-wrap;
    word-break: normal;
    overflow-wrap: break-word;
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    border: none;
}

.editor-line-mirror-row {
    display: block;
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    border: none;
    min-height: var(--editor-row-height, 25.6px);
    line-height: var(--editor-line-height, 1.6);
    word-break: normal;
    overflow-wrap: break-word;
    white-space: pre-wrap;
}

.markdown-editor-toolbar-wrap {
    flex: 0 0 auto;
    width: 100%;
    position: relative;
    z-index: 100;
}

.markdown-editor-toolbar {
    width: 100%;
    box-sizing: border-box;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 2px;
    min-height: 32px;
    padding: 3px 8px;
    position: relative;
    z-index: 100;
    overflow-x: auto;
    overflow-y: hidden;
    border-bottom: 1px solid var(--toolbar-border, #e2dacd);
    background: var(--toolbar-bg, #f4f0e8);
    color: var(--toolbar-text, #2c2a29);
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.markdown-editor-toolbar::-webkit-scrollbar {
    display: none;
}

.markdown-toolbar-button {
    flex: 0 0 24px;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--toolbar-radius, 4px);
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding: 0;
    transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease, transform 0.08s ease;
}

.markdown-toolbar-button:active {
    transform: scale(0.92);
}

.markdown-toolbar-button:hover,
.markdown-toolbar-button:focus-visible {
    border-color: var(--toolbar-border, #e2dacd);
    background: var(--toolbar-bg-hover, #eae3d5);
    color: var(--toolbar-accent, #c8654b);
}

.markdown-toolbar-button.is-active {
    border-color: var(--toolbar-border, #e2dacd);
    background: var(--toolbar-bg-active, #f0e6d8);
    color: var(--toolbar-accent, #c8654b);
}

.markdown-toolbar-button.is-recording {
    color: #ef4444 !important;
    border-color: rgba(239, 68, 68, 0.5) !important;
    background: rgba(239, 68, 68, 0.12) !important;
    animation: toolbar-recording-pulse 1.2s ease-in-out infinite;
}

.markdown-toolbar-button[data-command="recordPause"].is-paused {
    color: #f59e0b !important;
    border-color: rgba(245, 158, 11, 0.5) !important;
    background: rgba(245, 158, 11, 0.15) !important;
}

@keyframes toolbar-recording-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.55; transform: scale(0.96); }
}

/* --- Floating Recording HUD (Dynamic Island Glassmorphism) --- */
.editor-recording-hud {
    position: fixed;
    top: 22px;
    left: 50%;
    transform: translateX(-50%) translateY(0);
    z-index: 10000;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px 4px 14px;
    background: color-mix(in srgb, var(--editor-surface, #1e1e2e) 88%, #000000);
    color: var(--editor-text, #f8f8f2);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 9999px;
    box-shadow: 0 12px 36px -4px rgba(0, 0, 0, 0.45), 0 0 20px rgba(239, 68, 68, 0.25);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    user-select: none;
    pointer-events: auto;
    animation: recording-hud-appear 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
}

.editor-recording-hud.is-paused {
    border-color: rgba(245, 158, 11, 0.45);
    box-shadow: 0 12px 36px -4px rgba(0, 0, 0, 0.45), 0 0 20px rgba(245, 158, 11, 0.2);
}

.editor-recording-hud.is-leaving {
    animation: recording-hud-leave 0.2s ease forwards;
    pointer-events: none;
}

@keyframes recording-hud-appear {
    from { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.92); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

@keyframes recording-hud-leave {
    from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    to { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(0.92); }
}

.recording-hud-live-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.recording-hud-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 10px #ef4444;
    animation: recording-dot-pulse 1.2s ease-in-out infinite;
}

.editor-recording-hud.is-paused .recording-hud-dot {
    background: #f59e0b;
    box-shadow: 0 0 8px #f59e0b;
    animation: none;
}

@keyframes recording-dot-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.4; }
}

.recording-hud-waves {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 12px;
}

.recording-hud-waves span {
    display: inline-block;
    width: 2px;
    height: 12px;
    background: #ef4444;
    border-radius: 2px;
    animation: recording-wave-anim 0.9s ease-in-out infinite alternate;
}

.recording-hud-waves span:nth-child(1) { height: 5px; animation-delay: 0.1s; }
.recording-hud-waves span:nth-child(2) { height: 12px; animation-delay: 0.3s; }
.recording-hud-waves span:nth-child(3) { height: 8px; animation-delay: 0.2s; }
.recording-hud-waves span:nth-child(4) { height: 6px; animation-delay: 0.4s; }

.editor-recording-hud.is-paused .recording-hud-waves span {
    animation-play-state: paused;
    background: #f59e0b;
    height: 3px !important;
}

@keyframes recording-wave-anim {
    0% { transform: scaleY(0.25); }
    100% { transform: scaleY(1); }
}

.recording-hud-status {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.88);
    letter-spacing: 0.3px;
}

.recording-hud-timer {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12.5px;
    font-weight: 700;
    color: #ef4444;
    min-width: 40px;
    font-variant-numeric: tabular-nums;
}

.editor-recording-hud.is-paused .recording-hud-timer {
    color: #f59e0b;
}

.recording-hud-actions {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-left: 4px;
    padding-left: 8px;
    border-left: 1px solid rgba(255, 255, 255, 0.15);
}

.recording-hud-icon-btn,
.recording-hud-pill-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.14s ease;
    user-select: none;
    line-height: 1;
    color: inherit;
    background: transparent;
}

.recording-hud-icon-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    padding: 0;
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
}

.recording-hud-icon-btn:hover {
    background: rgba(255, 255, 255, 0.18);
    border-color: rgba(255, 255, 255, 0.25);
    transform: scale(1.05);
}

.recording-hud-icon-btn:active,
.recording-hud-pill-btn:active {
    transform: scale(0.92);
}

.recording-hud-icon-btn.hud-btn-cancel {
    color: rgba(255, 255, 255, 0.6);
    background: transparent;
    border-color: transparent;
}

.recording-hud-icon-btn.hud-btn-cancel:hover {
    background: rgba(239, 68, 68, 0.18);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
}

.editor-recording-hud.is-paused .recording-hud-icon-btn.hud-btn-pause {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.4);
    color: #f59e0b;
}

.recording-hud-pill-btn.hud-btn-stop {
    height: 28px;
    padding: 0 12px 0 10px;
    gap: 5px;
    border-radius: 9999px;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: #ffffff;
    font-size: 12px;
    font-weight: 600;
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 2px 10px rgba(239, 68, 68, 0.4);
}

.recording-hud-pill-btn.hud-btn-stop:hover {
    background: linear-gradient(135deg, #f87171, #ef4444);
    box-shadow: 0 3px 14px rgba(239, 68, 68, 0.6);
    transform: scale(1.02);
}

.hud-svg {
    display: block;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
}

.markdown-toolbar-button:focus-visible {
    outline: 2px solid var(--toolbar-accent, #c8654b);
    outline-offset: 1px;
}

.markdown-toolbar-button:disabled {
    opacity: 0.38;
    cursor: default;
}

.markdown-toolbar-button {
    position: relative;
}

.markdown-toolbar-button .svg-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    flex: 0 0 16px;
    width: 16px;
    height: 16px;
    stroke-width: 2.2;
}

.markdown-toolbar-glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 16px;
    min-height: 16px;
    font-size: 13px;
    line-height: 1;
    white-space: nowrap;
}

.markdown-toolbar-glyph.is-bold { font-weight: 800; }
.markdown-toolbar-glyph.is-italic { font-style: italic; font-family: Georgia, serif; }
.markdown-toolbar-glyph.is-strike { text-decoration: line-through; }
.markdown-toolbar-glyph.is-code { font-family: var(--editor-font-family); font-size: 11px; }
.markdown-toolbar-glyph.is-table,
.markdown-toolbar-glyph.is-image,
.markdown-toolbar-glyph.is-ai { font-size: 16px; }

.markdown-toolbar-separator {
    flex: 0 0 1px;
    width: 1px;
    height: 16px;
    margin: 0 1px;
    background: var(--toolbar-border, #e2dacd);
}

.editor-pane:fullscreen,
.editor-pane.toolbar-fullscreen {
    width: 100%;
    height: 100%;
    background: var(--editor-surface, #282a36);
}

.contents {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 20px 30px;
    border: none;
    outline: none;
    overflow-y: auto;
    font-size: 16px;
    line-height: 1.8;
    font-family: var(--editor-font-family);
}

/* Editor Specific (Dark Mode) */
textarea#contents {
    flex: 1;
    background-color: #282a36;
    color: #f8f8f2;
    resize: none;
    line-height: 1.6;
}

@media (min-width: 961px) {
    body.preview-split-vertical:not(.share-view) .editor-pane {
        width: 100%;
        height: 50%;
    }
}

@media (max-width: 960px) {
    body:not(.share-view) .editor-pane {
        width: 100%;
        height: 50%;
        min-height: 0;
    }

    .markdown-editor-toolbar {
        min-height: 34px;
        padding: 3px 5px;
    }
}

@media (max-width: 640px) {
    .markdown-editor-toolbar {
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        justify-content: flex-start !important;
        gap: 4px !important;
        padding: 4px 6px !important;
        min-height: 42px !important;
        scrollbar-width: none; /* Firefox */
        -webkit-overflow-scrolling: touch;
    }
    .markdown-editor-toolbar::-webkit-scrollbar {
        display: none; /* Safari and Chrome */
    }
    .markdown-toolbar-button {
        flex: 0 0 34px !important;
        width: 34px !important;
        height: 34px !important;
        border-radius: 6px !important;
    }
    .markdown-toolbar-button .svg-icon {
        width: 18px !important;
        height: 18px !important;
        flex: 0 0 18px !important;
    }
    .markdown-toolbar-separator {
        display: none;
    }
    .editor-line-numbers {
        flex-basis: var(--editor-gutter-width, 22px);
        min-width: var(--editor-gutter-width, 22px);
        width: var(--editor-gutter-width, 22px);
        padding: 20px 4px 20px 2px;
        font-size: 12px;
        line-height: var(--editor-row-height, 25.6px);
    }
}

/* Editor Search & Replace Bar */
.editor-search-bar {
    position: relative;
    z-index: 100;
    margin: 0 0 6px 0;
    padding: 8px 10px;
    background: var(--toolbar-bg, #ffffff);
    border: 1px solid var(--toolbar-border, rgba(0, 0, 0, 0.12));
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    transition: opacity 0.15s ease, transform 0.15s ease;
}
.editor-search-bar.hide {
    display: none !important;
}
.editor-search-row,
.editor-replace-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
}
.editor-search-input-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
}
.editor-search-input-wrap .search-icon {
    position: absolute;
    left: 8px;
    display: flex;
    align-items: center;
    color: var(--toolbar-muted, #888);
    pointer-events: none;
}
.editor-search-input-wrap .search-icon svg {
    width: 14px;
    height: 14px;
}
.editor-search-field {
    width: 100%;
    padding: 5px 60px 5px 28px;
    border: 1px solid var(--border-color, rgba(0, 0, 0, 0.15));
    border-radius: 6px;
    background: var(--input-bg, rgba(0, 0, 0, 0.02));
    color: var(--text-color, inherit);
    font-family: inherit;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
}
.editor-search-field:focus {
    border-color: var(--toolbar-accent, #2563eb);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--toolbar-accent, #2563eb) 20%, transparent);
}
.editor-search-count {
    position: absolute;
    right: 8px;
    font-size: 11.5px;
    color: var(--toolbar-muted, #777);
    font-family: var(--font-mono, monospace);
    pointer-events: none;
}
.editor-search-options,
.editor-search-nav,
.editor-replace-actions {
    display: flex;
    align-items: center;
    gap: 3px;
}
.search-opt-btn,
.search-nav-btn,
.search-close-btn,
.search-action-btn {
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--text-color, #444);
    font-size: 12px;
    padding: 3px 6px;
    cursor: pointer;
    line-height: 1.2;
    transition: background 0.12s, border-color 0.12s;
}
.search-opt-btn:hover,
.search-nav-btn:hover,
.search-close-btn:hover,
.search-action-btn:hover {
    background: var(--toolbar-bg-hover, rgba(0, 0, 0, 0.08));
}
.search-opt-btn.is-active {
    background: var(--toolbar-accent, #2563eb);
    color: #ffffff;
    font-weight: 600;
}
.search-action-btn {
    border: 1px solid var(--border-color, rgba(0, 0, 0, 0.15));
    background: var(--button-bg, rgba(0, 0, 0, 0.04));
    font-weight: 500;
}

/* Alert Autocomplete Dropdown */
.editor-alert-autocomplete {
    position: absolute;
    z-index: 1000;
    background: var(--toolbar-bg, #ffffff);
    border: 1px solid var(--border-color, rgba(0, 0, 0, 0.15));
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    padding: 4px;
    min-width: 240px;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12.5px;
}
.editor-alert-autocomplete.hide {
    display: none !important;
}
.alert-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 10px;
    border-radius: 5px;
    cursor: pointer;
    transition: background-color 0.12s;
}
.alert-option:hover,
.alert-option.is-selected {
    background-color: var(--toolbar-bg-hover, rgba(0, 0, 0, 0.08));
}
.alert-badge {
    font-weight: 600;
    font-size: 11.5px;
    display: flex;
    align-items: center;
    gap: 4px;
}
.alert-desc {
    font-size: 11px;
    color: var(--toolbar-muted, #777);
}

/* Preview Specific - background/color controlled by themes */
#preview-md, #preview-plain {
}

/* Infinite Canvas Mode (React Flow) */
.layer_2:has(.canvas-editor-pane) #editor-toolbar {
    display: none !important;
}

.canvas-editor-pane {
    flex: 1 1 auto;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--canvas-workspace, #f8fafc);
}

.canvas-editor {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
}

/* Whiteboard Mode (Excalidraw) */
.layer_2:has(.whiteboard-editor-pane) #editor-toolbar {
    display: none !important;
}

.whiteboard-editor-pane {
    flex: 1 1 auto;
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--body-bg, #ffffff);
}

.whiteboard-editor {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
}
`
