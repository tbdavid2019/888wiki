import { APP_NAME, getFlowTrackerScript } from './constant.js'
import { getMarkdownCss } from './styles/markdown.css.js'

export const createOfflinePageResponse = () => {
    const appName = APP_NAME || 'david888 wiki'
    const html = `<!doctype html>
<html lang="zh-Hant-TW">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#0f172a">
    <link rel="manifest" href="/app.webmanifest">
    <link rel="icon" href="/notepad-icon-192.png">
    ${getFlowTrackerScript()}
    <title>離線工作區 · ${appName}</title>
    <style>
        :root {
            color-scheme: light dark;
            --editor-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            --bg-color: #0f172a;
            --surface-bg: #1e293b;
            --card-bg: #1e293b;
            --sidebar-bg: #0f172a;
            --text-color: #f8fafc;
            --text-muted: #94a3b8;
            --border-color: #334155;
            --primary-color: #3b82f6;
            --primary-hover: #60a5fa;
            --accent-bg: rgba(59, 130, 246, 0.15);
            --danger-color: #ef4444;
            --success-color: #10b981;
            --warning-color: #f59e0b;
            --editor-bg: #0b1120;
            --preview-bg: #0f172a;
            font-family: var(--editor-font-family);
        }

        body.theme-light {
            color-scheme: light;
            --bg-color: #f8fafc;
            --surface-bg: #ffffff;
            --card-bg: #ffffff;
            --sidebar-bg: #f1f5f9;
            --text-color: #0f172a;
            --text-muted: #64748b;
            --border-color: #e2e8f0;
            --primary-color: #2563eb;
            --primary-hover: #1d4ed8;
            --accent-bg: #eff6ff;
            --editor-bg: #ffffff;
            --preview-bg: #f8fafc;
        }

        body.theme-tokyo-night {
            color-scheme: dark;
            --bg-color: #1a1b26;
            --surface-bg: #24283b;
            --card-bg: #24283b;
            --sidebar-bg: #16161e;
            --text-color: #c0caf5;
            --text-muted: #7aa2f7;
            --border-color: #414868;
            --primary-color: #7aa2f7;
            --primary-hover: #bb9af7;
            --accent-bg: rgba(122, 162, 247, 0.2);
            --editor-bg: #1f2335;
            --preview-bg: #1a1b26;
        }

        body.theme-dracula {
            color-scheme: dark;
            --bg-color: #282a36;
            --surface-bg: #44475a;
            --card-bg: #44475a;
            --sidebar-bg: #21222c;
            --text-color: #f8f8f2;
            --text-muted: #6272a4;
            --border-color: #6272a4;
            --primary-color: #bd93f9;
            --primary-hover: #ff79c6;
            --accent-bg: rgba(189, 147, 249, 0.2);
            --editor-bg: #282a36;
            --preview-bg: #21222c;
        }

        body.theme-nord {
            color-scheme: dark;
            --bg-color: #2e3440;
            --surface-bg: #3b4252;
            --card-bg: #3b4252;
            --sidebar-bg: #242933;
            --text-color: #eceff4;
            --text-muted: #d8dee9;
            --border-color: #4c566a;
            --primary-color: #88c0d0;
            --primary-hover: #81a1c1;
            --accent-bg: rgba(136, 192, 208, 0.2);
            --editor-bg: #2e3440;
            --preview-bg: #242933;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: var(--bg-color);
            color: var(--text-color);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            background: var(--surface-bg);
            border-bottom: 1px solid var(--border-color);
            gap: 12px;
            flex-wrap: wrap;
            z-index: 10;
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .header-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            font-size: 15px;
        }

        .offline-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: rgba(245, 158, 11, 0.2);
            color: var(--warning-color);
            padding: 3px 8px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
            border: 1px solid rgba(245, 158, 11, 0.3);
            transition: all 0.3s ease;
        }
        .offline-badge.online {
            background: rgba(16, 185, 129, 0.2);
            color: var(--success-color);
            border-color: rgba(16, 185, 129, 0.3);
        }

        .header-controls {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }

        .btn-group {
            display: inline-flex;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            overflow: hidden;
            background: var(--card-bg);
        }

        .btn-group .btn {
            border: none;
            border-radius: 0;
            border-right: 1px solid var(--border-color);
        }
        .btn-group .btn:last-child {
            border-right: none;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 11px;
            border-radius: 6px;
            font-size: 12.5px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid var(--border-color);
            background: var(--card-bg);
            color: var(--text-color);
            transition: all 0.15s ease;
            white-space: nowrap;
        }
        .btn:hover {
            border-color: var(--primary-color);
            color: var(--primary-color);
        }
        .btn.active {
            background: var(--primary-color);
            color: #ffffff;
            border-color: var(--primary-color);
        }
        .btn-primary {
            background: var(--primary-color);
            border-color: var(--primary-color);
            color: #ffffff;
        }
        .btn-primary:hover {
            background: var(--primary-hover);
            color: #ffffff;
        }
        .btn-sm {
            padding: 3px 8px;
            font-size: 11px;
        }
        .btn-danger {
            color: var(--danger-color);
        }
        .btn-danger:hover {
            background: rgba(239, 68, 68, 0.15);
            border-color: var(--danger-color);
        }

        select.theme-select {
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid var(--border-color);
            background: var(--card-bg);
            color: var(--text-color);
            font-size: 12px;
            outline: none;
            cursor: pointer;
        }

        main {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        .sidebar {
            width: 290px;
            min-width: 240px;
            border-right: 1px solid var(--border-color);
            background: var(--sidebar-bg);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: transform 0.2s ease;
        }

        .sidebar-search {
            padding: 10px;
            border-bottom: 1px solid var(--border-color);
        }
        .search-input {
            width: 100%;
            padding: 6px 10px;
            border-radius: 6px;
            border: 1px solid var(--border-color);
            background: var(--card-bg);
            color: var(--text-color);
            font-size: 12.5px;
            outline: none;
        }
        .search-input:focus {
            border-color: var(--primary-color);
        }

        .sidebar-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid var(--border-color);
        }

        .note-list {
            list-style: none;
            flex: 1;
            overflow-y: auto;
        }

        .note-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            border-bottom: 1px solid var(--border-color);
            cursor: pointer;
            transition: background 0.12s;
            position: relative;
        }
        .note-item:hover, .note-item.active {
            background: var(--accent-bg);
        }
        .note-item.active {
            border-left: 3px solid var(--primary-color);
        }

        .note-item-info {
            flex: 1;
            min-width: 0;
        }

        .note-item-title {
            font-size: 13.5px;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 2px;
        }

        .note-item-meta {
            font-size: 11px;
            color: var(--text-muted);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .note-badge {
            font-size: 10px;
            padding: 1px 5px;
            border-radius: 4px;
            font-weight: 500;
        }
        .note-badge.pending {
            background: rgba(245, 158, 11, 0.2);
            color: var(--warning-color);
        }
        .note-badge.synced {
            background: rgba(16, 185, 129, 0.2);
            color: var(--success-color);
        }
        .note-badge.draft {
            background: rgba(148, 163, 184, 0.2);
            color: var(--text-muted);
        }

        .note-item-delete {
            opacity: 0;
            background: none;
            border: none;
            color: var(--danger-color);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: opacity 0.15s;
            font-size: 13px;
        }
        .note-item:hover .note-item-delete {
            opacity: 0.8;
        }
        .note-item-delete:hover {
            opacity: 1 !important;
            background: rgba(239, 68, 68, 0.15);
        }

        .sidebar-footer {
            padding: 10px;
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 6px;
            background: var(--surface-bg);
        }

        .workspace-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: var(--bg-color);
        }

        .editor-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 14px;
            background: var(--surface-bg);
            border-bottom: 1px solid var(--border-color);
            gap: 10px;
        }

        .editor-title {
            flex: 1;
            font-size: 16px;
            font-weight: 600;
            padding: 6px 10px;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            color: var(--text-color);
            outline: none;
        }
        .editor-title:focus {
            border-color: var(--primary-color);
        }

        .note-path-tag {
            font-size: 11px;
            color: var(--text-muted);
            font-family: monospace;
            background: var(--card-bg);
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid var(--border-color);
        }

        .content-split-container {
            flex: 1;
            display: flex;
            overflow: hidden;
        }

        .pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .editor-pane {
            border-right: 1px solid var(--border-color);
        }

        /* Offline Markdown Toolbar */
        .offline-markdown-toolbar {
            display: flex;
            align-items: center;
            gap: 2px;
            padding: 5px 8px;
            background: var(--surface-bg);
            border-bottom: 1px solid var(--border-color);
            overflow-x: auto;
            white-space: nowrap;
            scrollbar-width: none;
        }
        .offline-markdown-toolbar::-webkit-scrollbar {
            display: none;
        }
        .toolbar-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            height: 28px;
            padding: 0 6px;
            border-radius: 4px;
            border: 1px solid transparent;
            background: transparent;
            color: var(--text-color);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.12s;
            user-select: none;
        }
        .toolbar-btn:hover {
            background: var(--card-bg);
            border-color: var(--border-color);
            color: var(--primary-color);
        }
        .toolbar-btn:active {
            transform: scale(0.96);
        }
        .toolbar-sep {
            display: inline-block;
            width: 1px;
            height: 16px;
            background: var(--border-color);
            margin: 0 4px;
            flex-shrink: 0;
        }

        .toolbar-btn.is-recording {
            color: #ef4444 !important;
            border-color: rgba(239, 68, 68, 0.5) !important;
            background: rgba(239, 68, 68, 0.15) !important;
            animation: offline-rec-pulse 1.2s ease-in-out infinite;
        }
        @keyframes offline-rec-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.55; }
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
            background: color-mix(in srgb, var(--surface-bg, #1e1e2e) 88%, #000000);
            color: var(--text-color, #f8f8f2);
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

        .editor-textarea {
            flex: 1;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 14px;
            line-height: 1.65;
            padding: 16px;
            background: var(--editor-bg);
            border: none;
            color: var(--text-color);
            resize: none;
            outline: none;
            overflow-y: auto;
        }

        .preview-area {
            flex: 1;
            padding: 24px 28px;
            background: var(--preview-bg);
            overflow-y: auto;
            color: var(--text-color);
            line-height: 1.7;
        }

        /* View Mode Layouts */
        body.mode-edit .preview-area { display: none; }
        body.mode-edit .editor-pane { border-right: none; }
        body.mode-preview .editor-pane { display: none; }

        /* Full Markdown Typography Styles */
        ${getMarkdownCss()}

        /* Theme adjustments for preview */
        body.theme-light .markdown-body {
            color: #0f172a;
        }
        body:not(.theme-light) .markdown-body {
            color: #f8fafc;
        }
        body:not(.theme-light) .markdown-body table tr {
            border-top: 1px solid var(--border-color);
            background-color: var(--card-bg);
        }
        body:not(.theme-light) .markdown-body table th,
        body:not(.theme-light) .markdown-body table td {
            border: 1px solid var(--border-color);
        }
        body:not(.theme-light) .markdown-body table th {
            background-color: var(--surface-bg);
        }
        body:not(.theme-light) .markdown-body code {
            background-color: rgba(148, 163, 184, 0.2);
            color: #f8fafc;
        }
        body:not(.theme-light) .markdown-body pre {
            background-color: var(--surface-bg);
            border: 1px solid var(--border-color);
        }
        body:not(.theme-light) .markdown-body hr {
            background-color: var(--border-color);
        }

        .editor-statusbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 4px 12px;
            background: var(--surface-bg);
            border-top: 1px solid var(--border-color);
            font-size: 11.5px;
            color: var(--text-muted);
        }

        .status-left, .status-right {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: var(--surface-bg);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 13px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            opacity: 0;
            transform: translateY(12px);
            transition: all 0.25s ease;
            pointer-events: none;
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .toast.show {
            opacity: 1;
            transform: translateY(0);
        }

        @media (max-width: 768px) {
            header {
                padding: 8px 12px;
                gap: 8px;
            }
        }

        /* Conflict Diff Modal */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99990;
            padding: 16px;
        }
        .modal-card {
            background: var(--surface-bg);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            width: 100%;
            max-width: 800px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            overflow: hidden;
        }
        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
        }
        .modal-body {
            padding: 16px;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .modal-tip {
            font-size: 13px;
            color: var(--text-muted);
        }
        .diff-container {
            display: flex;
            gap: 12px;
            height: 300px;
        }
        .diff-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            overflow: hidden;
        }
        .diff-title {
            padding: 6px 10px;
            font-size: 12px;
            font-weight: 600;
            background: var(--card-bg);
            border-bottom: 1px solid var(--border-color);
        }
        .diff-textarea {
            flex: 1;
            padding: 10px;
            font-family: ui-monospace, monospace;
            font-size: 12.5px;
            line-height: 1.5;
            background: var(--editor-bg);
            color: var(--text-color);
            border: none;
            outline: none;
            resize: none;
        }
        .modal-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            padding: 12px 16px;
            border-top: 1px solid var(--border-color);
            flex-wrap: wrap;
        }
        @media (max-width: 640px) {
            .diff-container { flex-direction: column; height: 360px; }
            .modal-footer { justify-content: stretch; }
            .modal-footer .btn { flex: 1; min-width: 120px; justify-content: center; }
        }
    </style>
</head>
<body class="mode-split">
    <header>
        <div class="header-left">
            <div class="header-title">
                <span>📝 ${appName}</span>
                <span class="offline-badge" id="network-badge">⚡ 目前離線中 / You’re offline</span>
            </div>
        </div>

        <div class="header-controls">
            <!-- View Mode Selector -->
            <div class="btn-group">
                <button type="button" class="btn" id="mode-edit-btn" title="純編輯模式 (Ctrl/Cmd+E)">✏️ 編輯</button>
                <button type="button" class="btn active" id="mode-split-btn" title="雙欄對照 (Ctrl/Cmd+E)">🌗 雙欄</button>
                <button type="button" class="btn" id="mode-preview-btn" title="預覽模式 (Ctrl/Cmd+E)">👁️ 預覽</button>
            </div>

            <!-- Theme Selector -->
            <select class="theme-select" id="theme-selector">
                <option value="default">🎨 預設主題 (Dark)</option>
                <option value="light">☀️ 明亮白 (Light)</option>
                <option value="tokyo-night">🌃 東京之夜 (Tokyo Night)</option>
                <option value="dracula">🧛 德古拉 (Dracula)</option>
                <option value="nord">❄️ 極光北歐 (Nord)</option>
            </select>

            <button type="button" class="btn" id="new-note-btn">➕ 新增</button>
            <button type="button" class="btn" id="open-local-btn">📂 開啟本機 .md</button>
            <button type="button" class="btn" id="export-md-btn">⭳ 導出 Markdown</button>
            <button type="button" class="btn" id="export-html-btn" title="導出為獨立 HTML 網頁">⭳ 導出 HTML</button>
            <button type="button" class="btn" id="backup-btn" title="備份全部快取筆記">💾 備份 JSON</button>
            <button type="button" class="btn btn-primary" id="save-note-btn">💾 儲存</button>
        </div>
    </header>

    <main>
        <aside class="sidebar">
            <div class="sidebar-search">
                <input type="text" class="search-input" id="search-notes" placeholder="🔍 搜尋離線筆記 (Search)...">
            </div>
            <div class="sidebar-header">
                <span>本機快取筆記 (<span id="notes-count">0</span>)</span>
            </div>
            <ul class="note-list" id="note-list">
                <!-- Dynamic Note Items -->
            </ul>
            <div class="sidebar-footer">
                <button type="button" class="btn btn-sm" id="import-backup-btn" style="flex:1;">📥 匯入備份</button>
                <button type="button" class="btn btn-sm btn-danger" id="clear-all-btn" title="清空離線快取">🗑️ 清空</button>
            </div>
        </aside>

        <section class="workspace-area">
            <div class="editor-topbar">
                <input type="text" class="editor-title" id="note-title" placeholder="輸入標題 (Title)..." value="離線草稿">
                <span class="note-path-tag" id="note-path-display">local/draft</span>
            </div>

            <div class="content-split-container">
                <div class="editor-pane pane">
                    <div class="offline-markdown-toolbar" id="markdown-toolbar" role="toolbar" aria-label="Markdown 格式工具列">
                        <button type="button" class="toolbar-btn" data-cmd="bold" title="粗體 (**Bold**)"><b>B</b></button>
                        <button type="button" class="toolbar-btn" data-cmd="italic" title="斜體 (*Italic*)"><i>I</i></button>
                        <button type="button" class="toolbar-btn" data-cmd="strike" title="刪除線 (~~Strike~~)"><del>S</del></button>
                        <button type="button" class="toolbar-btn" data-cmd="highlight" title="重點螢光筆 (==Highlight==)"><mark style="background:#ffeb3b; color:#000; padding:0 2px; border-radius:2px;">H</mark></button>
                        <span class="toolbar-sep"></span>
                        <button type="button" class="toolbar-btn" data-cmd="heading1" title="大標題 (# H1)">H1</button>
                        <button type="button" class="toolbar-btn" data-cmd="heading2" title="中標題 (## H2)">H2</button>
                        <button type="button" class="toolbar-btn" data-cmd="heading3" title="小標題 (### H3)">H3</button>
                        <button type="button" class="toolbar-btn" data-cmd="quote" title="引用區塊 (> Quote)">❝</button>
                        <button type="button" class="toolbar-btn" data-cmd="inlineCode" title="行內代碼 (\`Code\`)">&lt;&gt;</button>
                        <button type="button" class="toolbar-btn" data-cmd="codeBlock" title="代碼區塊 (\`\`\`Code Block\`\`\`)">\`\`\`</button>
                        <span class="toolbar-sep"></span>
                        <button type="button" class="toolbar-btn" data-cmd="bullet" title="無序清單 (- List)">•≡</button>
                        <button type="button" class="toolbar-btn" data-cmd="ordered" title="數字清單 (1. List)">1.≡</button>
                        <button type="button" class="toolbar-btn" data-cmd="task" title="待辦清單 (- [ ] Task)">☑</button>
                        <button type="button" class="toolbar-btn" data-cmd="table" title="插入表格 (Table)">▦</button>
                        <span class="toolbar-sep"></span>
                        <button type="button" class="toolbar-btn" data-cmd="link" title="超連結 ([Link](url))">🔗</button>
                        <button type="button" class="toolbar-btn" data-cmd="image" title="圖片 (![alt](url))">🖼️</button>
                        <button type="button" class="toolbar-btn" data-cmd="alert" title="GitHub 提示框 (> [!NOTE])">💡</button>
                        <button type="button" class="toolbar-btn" data-cmd="twoColumns" title="雙欄佈局 (Two Columns)">🏛️</button>
                        <span class="toolbar-sep"></span>
                        <button type="button" class="toolbar-btn" id="offline-record-btn" title="離線錄音 (Local Recording)">🎙️</button>
                    </div>
                    <textarea class="editor-textarea" id="note-content" placeholder="在此輸入 Markdown 內容... (支援完整離線語法編輯與即時 HTML 預覽)"></textarea>
                </div>
                <div class="preview-area markdown-body" id="preview-area"></div>
            </div>

            <div class="editor-statusbar">
                <div class="status-left">
                    <span id="save-status">🟢 本機已存 (IndexedDB)</span>
                    <span id="sync-status">待同步</span>
                </div>
                <div class="status-right">
                    <span id="word-count">字數: 0</span>
                    <span id="reading-time">預估閱讀: 1 分鐘</span>
                </div>
            </div>
        </section>
    </main>

    <!-- Conflict Diff Modal -->
    <div id="conflict-modal" class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="conflict-dialog-title" style="display: none;">
        <div class="modal-card">
            <div class="modal-header">
                <h3 id="conflict-dialog-title"><span aria-hidden="true">⚠️ </span>雲端版本衝突 (Sync Conflict)</h3>
                <button type="button" class="btn btn-sm" id="conflict-close-btn" aria-label="關閉對話框 (Close)">✕</button>
            </div>
            <div class="modal-body">
                <p class="modal-tip">此筆記在雲端已被其他裝置修改，內容與您離線編輯的版本不同。請選擇處理方式：</p>
                <div class="diff-container">
                    <div class="diff-pane">
                        <div class="diff-title"><span aria-hidden="true">🖥️ </span>本機離線版本 (Local)</div>
                        <textarea class="diff-textarea" id="diff-local" readonly aria-label="本機離線版本內容"></textarea>
                    </div>
                    <div class="diff-pane">
                        <div class="diff-title"><span aria-hidden="true">☁️ </span>雲端最新版本 (Cloud Remote)</div>
                        <textarea class="diff-textarea" id="diff-remote" readonly aria-label="雲端最新版本內容"></textarea>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" id="conflict-keep-local"><span aria-hidden="true">💾 </span>保留本機版本並覆蓋雲端</button>
                <button type="button" class="btn btn-secondary" id="conflict-keep-remote"><span aria-hidden="true">☁️ </span>採用雲端最新版本</button>
                <button type="button" class="btn" id="conflict-save-copy"><span aria-hidden="true">📄 </span>另存本機為衝突複本</button>
            </div>
        </div>
    </div>

    <!-- Toast Notification -->
    <div id="toast" class="toast"></div>

    <script src="/js/marked.min.js"></script>
    <script src="/js/purify.min.js"></script>
    <script type="module">
        import { offlineStore, exportMarkdownFile, openLocalMarkdownFile } from '/js/offline-store.mjs'
        import {
            expandMarkdownExtensions,
            decorateColumnLayouts,
            decorateCodeBlocks,
            decorateFootnoteAndCitationPopovers,
            decorateHeadingAnchors
        } from '/js/markdown-extensions.mjs'
        import { applyMarkdownCommand } from '/js/markdown-toolbar.mjs'

        const $title = document.getElementById('note-title')
        const $content = document.getElementById('note-content')
        const $preview = document.getElementById('preview-area')
        const $pathDisplay = document.getElementById('note-path-display')
        const $saveBtn = document.getElementById('save-note-btn')
        const $exportBtn = document.getElementById('export-md-btn')
        const $exportHtmlBtn = document.getElementById('export-html-btn')
        const $backupBtn = document.getElementById('backup-btn')
        const $newBtn = document.getElementById('new-note-btn')
        const $openLocalBtn = document.getElementById('open-local-btn')
        const $importBackupBtn = document.getElementById('import-backup-btn')
        const $clearAllBtn = document.getElementById('clear-all-btn')
        const $noteList = document.getElementById('note-list')
        const $notesCount = document.getElementById('notes-count')
        const $searchInput = document.getElementById('search-notes')
        const $themeSelect = document.getElementById('theme-selector')
        const $badge = document.getElementById('network-badge')
        const $saveStatus = document.getElementById('save-status')
        const $syncStatus = document.getElementById('sync-status')
        const $wordCount = document.getElementById('word-count')
        const $readingTime = document.getElementById('reading-time')
        const $toast = document.getElementById('toast')
        const $toolbar = document.getElementById('markdown-toolbar')

        const $conflictModal = document.getElementById('conflict-modal')
        const $diffLocal = document.getElementById('diff-local')
        const $diffRemote = document.getElementById('diff-remote')
        const $conflictCloseBtn = document.getElementById('conflict-close-btn')
        const $conflictKeepLocal = document.getElementById('conflict-keep-local')
        const $conflictKeepRemote = document.getElementById('conflict-keep-remote')
        const $conflictSaveCopy = document.getElementById('conflict-save-copy')

        const $modeEdit = document.getElementById('mode-edit-btn')
        const $modeSplit = document.getElementById('mode-split-btn')
        const $modePreview = document.getElementById('mode-preview-btn')

        let currentPath = 'offline-draft'
        let currentSyncStatus = 'draft'
        let debounceTimer = null
        let activeConflictInfo = null

        // Configure marked parser options
        if (typeof marked !== 'undefined') {
            if (typeof marked.setOptions === 'function') {
                marked.setOptions({
                    gfm: true,
                    breaks: true,
                    pedantic: false,
                })
            }
        }

        function showToast(msg) {
            $toast.textContent = msg
            $toast.classList.add('show')
            setTimeout(() => $toast.classList.remove('show'), 3000)
        }

        function normalizeText(str) {
            return String(str || '').replace(/\\r\\n/g, '\\n').trim()
        }

        function showConflictModal(path, localText, remoteText) {
            activeConflictInfo = { path, localText, remoteText }
            $diffLocal.value = localText
            $diffRemote.value = remoteText
            $conflictModal.style.display = 'flex'
            $conflictKeepLocal.focus()
        }

        function closeConflictModal() {
            $conflictModal.style.display = 'none'
            activeConflictInfo = null
        }
        $conflictCloseBtn.onclick = closeConflictModal

        $conflictKeepLocal.onclick = async () => {
            if (!activeConflictInfo) return
            const { path, localText } = activeConflictInfo
            closeConflictModal()
            await syncNoteToServer(path, localText, { isForce: true })
            showToast('✅ 已保留本機版本並同步覆蓋雲端！')
        }

        $conflictKeepRemote.onclick = async () => {
            if (!activeConflictInfo) return
            const { path, remoteText } = activeConflictInfo
            closeConflictModal()
            $content.value = remoteText
            const title = String(remoteText || '').split('\\n')[0]?.replace(/^#*\\s*/, '').trim() || path
            $title.value = title
            currentSyncStatus = 'synced'
            await offlineStore.saveNote(path, {
                title,
                content: remoteText,
                syncStatus: 'synced',
            })
            renderPreview()
            await renderNoteList()
            showToast('✅ 已採用雲端最新版本！')
        }

        $conflictSaveCopy.onclick = async () => {
            if (!activeConflictInfo) return
            const { path, localText, remoteText } = activeConflictInfo
            closeConflictModal()
            const copyPath = path + '-conflict-' + Date.now().toString(36)
            await offlineStore.saveNote(copyPath, {
                title: ($title.value || path) + ' (本機衝突副本)',
                content: localText,
                syncStatus: 'draft',
            })
            $content.value = remoteText
            const title = String(remoteText || '').split('\\n')[0]?.replace(/^#*\\s*/, '').trim() || path
            $title.value = title
            currentSyncStatus = 'synced'
            await offlineStore.saveNote(path, {
                title,
                content: remoteText,
                syncStatus: 'synced',
            })
            renderPreview()
            await renderNoteList()
            showToast('📑 已另存本機副本為：' + copyPath)
        }

        function formatGithubAlerts(rootNode) {
            if (!rootNode?.querySelectorAll) return
            rootNode.querySelectorAll('blockquote').forEach(bq => {
                const firstP = bq.querySelector('p')
                if (!firstP) return
                const html = firstP.innerHTML.trim()
                const match = html.match(/^\\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\\](?:\\s*<br\\s*\\/?>|\\s*)/i)
                if (match) {
                    const type = match[1].toLowerCase()
                    bq.classList.add('markdown-alert', 'markdown-alert-' + type)
                    firstP.innerHTML = html.slice(match[0].length)
                    if (!firstP.innerHTML.trim()) {
                        firstP.remove()
                    }
                }
            })
        }

        function renderFallbackMarkdown(md) {
            let src = escapeHtml(md)
            src = src.replace(/\\x60{3}([a-zA-Z0-9_-]*)\\n([\\s\\S]*?)\\x60{3}/g, (match, lang, code) => {
                return '<pre><code class="language-' + lang + '">' + code + '</code></pre>'
            })
            src = src.replace(/\\x60([^\\x60\\n]+)\\x60/g, '<code>$1</code>')
            src = src.replace(/^######\\s+(.+)$/gm, '<h6>$1</h6>')
            src = src.replace(/^#####\\s+(.+)$/gm, '<h5>$1</h5>')
            src = src.replace(/^####\\s+(.+)$/gm, '<h4>$1</h4>')
            src = src.replace(/^###\\s+(.+)$/gm, '<h3>$1</h3>')
            src = src.replace(/^##\\s+(.+)$/gm, '<h2>$1</h2>')
            src = src.replace(/^#\\s+(.+)$/gm, '<h1>$1</h1>')
            src = src.replace(/\\*\\*\\*([^*]+)\\*\\*\\*/g, '<strong><em>$1</em></strong>')
            src = src.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
            src = src.replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
            src = src.replace(/~~([^~]+)~~/g, '<del>$1</del>')
            src = src.replace(/^>\\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>')
            src = src.replace(/^-\\s+\\[([ xX])\\]\\s+(.+)$/gm, (m, check, text) => {
                const checked = check.toLowerCase() === 'x' ? 'checked="" ' : ''
                return '<li><input type="checkbox" ' + checked + 'disabled=""> ' + text + '</li>'
            })
            src = src.replace(/^-\\s+(.+)$/gm, '<li>$1</li>')
            src = src.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<img src="$2" alt="$1">')
            src = src.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            src = src.replace(/^---$/gm, '<hr>')
            const paragraphs = src.split(/\\n{2,}/).map(p => {
                p = p.trim()
                if (!p) return ''
                if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<blockquote') || p.startsWith('<li') || p.startsWith('<hr')) {
                    return p
                }
                return '<p>' + p.replace(/\\n/g, '<br>') + '</p>'
            })
            return paragraphs.join('\\n')
        }

        // Render Markdown content to Preview pane
        function renderPreview() {
            const raw = $content.value || ''
            if (!raw.trim()) {
                $preview.innerHTML = '<p style="color:var(--text-muted); font-style:italic;">（預覽區域 / Preview Area）</p>'
                updateStats()
                return
            }

            try {
                // 1. Expand custom markdown extensions (Highlights, Colors, Citations, Inline footnotes, HackMD images)
                const expanded = typeof expandMarkdownExtensions === 'function'
                    ? expandMarkdownExtensions(raw)
                    : raw

                // 2. Parse Markdown to HTML via marked or fallback
                let html = ''
                const markedParser = typeof marked !== 'undefined'
                    ? (typeof marked.parse === 'function' ? marked.parse.bind(marked) : (typeof marked === 'function' ? marked : null))
                    : (window.marked && typeof window.marked.parse === 'function' ? window.marked.parse.bind(window.marked) : null)

                if (markedParser) {
                    html = markedParser(expanded)
                } else {
                    html = renderFallbackMarkdown(expanded)
                }

                // 3. Sanitize HTML via DOMPurify
                let clean = html
                const purifySanitizer = typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function'
                    ? DOMPurify.sanitize.bind(DOMPurify)
                    : (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function' ? window.DOMPurify.sanitize.bind(window.DOMPurify) : null)

                if (purifySanitizer) {
                    clean = purifySanitizer(html, {
                        ADD_TAGS: ['cite', 'mark', 'math', 'annotation', 'semantics', 'mtext', 'mn', 'mo', 'mi', 'sup', 'sub', 'mrow', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'input', 'div', 'svg', 'path', 'circle', 'rect', 'line', 'text', 'g', 'polygon', 'ellipse', 'span', 'section', 'button', 'audio', 'source'],
                        ADD_ATTR: ['class', 'style', 'aria-hidden', 'aria-label', 'role', 'viewBox', 'd', 'xmlns', 'type', 'checked', 'disabled', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'transform', 'font-family', 'font-size', 'text-anchor', 'id', 'data-processed', 'data-diagram-type', 'data-citation-key', 'data-locator', 'data-suppress-author', 'data-footnote-ref', 'data-footnote-backref', 'data-line-numbers', 'data-line-start', 'data-filename', 'title', 'target', 'rel', 'data-offline-audio-id', 'controls', 'autoplay', 'loop', 'muted', 'preload'],
                        WHOLE_DOCUMENT: false,
                        FORCE_BODY: true
                    })
                }

                $preview.innerHTML = clean

                // 4. Post-processing DOM enhancements
                formatGithubAlerts($preview)
                if (typeof decorateColumnLayouts === 'function') decorateColumnLayouts($preview)
                if (typeof decorateHeadingAnchors === 'function') decorateHeadingAnchors($preview)
                if (typeof decorateCodeBlocks === 'function') decorateCodeBlocks($preview)
                if (typeof decorateFootnoteAndCitationPopovers === 'function') decorateFootnoteAndCitationPopovers($preview)

            } catch (err) {
                console.error('Offline preview rendering error:', err)
                $preview.innerHTML = '<div style="color:var(--danger-color); padding:10px; border:1px solid var(--danger-color); border-radius:6px;">' +
                    '<strong>渲染錯誤 (Render Error):</strong> ' + escapeHtml(err.message) + '</div>'
            }

            updateStats()
        }

        function escapeHtml(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/\\x60/g, '&#96;')
        }

        function updateStats() {
            const text = $content.value || ''
            const charCount = text.length
            const wordCount = (text.match(/\\S+/g) || []).length
            const minutes = Math.max(1, Math.ceil(wordCount / 200))
            $wordCount.textContent = '字數: ' + charCount + ' (' + wordCount + ' 字詞)'
            $readingTime.textContent = '預估閱讀: ' + minutes + ' 分鐘'
        }

        function exportHtmlFile(filename, title, contentHtml) {
            const doc = '<!doctype html>\\n' +
'<html lang="zh-Hant-TW">\\n' +
'<head>\\n' +
'    <meta charset="utf-8">\\n' +
'    <meta name="viewport" content="width=device-width, initial-scale=1">\\n' +
'    <title>' + escapeHtml(title) + '</title>\\n' +
'    <style>\\n' +
'        :root { --editor-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }\\n' +
'        body { max-width: 880px; margin: 0 auto; padding: 40px 20px; font-family: var(--editor-font-family); color: #0f172a; background: #ffffff; line-height: 1.65; }\\n' +
'        ' + ${JSON.stringify(getMarkdownCss())} + '\\n' +
'    </style>\\n' +
'</head>\\n' +
'<body>\\n' +
'    <header style="margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">\\n' +
'        <h1 style="font-size: 2em; margin-bottom: 4px;">' + escapeHtml(title) + '</h1>\\n' +
'        <p style="color: #64748b; font-size: 12px;">匯出時間：' + new Date().toLocaleString() + ' · david888 wiki 離線工作區</p>\\n' +
'    </header>\\n' +
'    <main class="markdown-body">\\n' +
'        ' + contentHtml + '\\n' +
'    </main>\\n' +
'</body>\\n' +
'</html>'
            const blob = new Blob([doc], { type: 'text/html;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = (filename || 'note').replace(/\\.html$/i, '') + '.html'
            a.click()
            URL.revokeObjectURL(url)
        }

        async function saveCurrent(options = { showNotification: true, manualSync: false }) {
            const title = $title.value.trim() || '未命名筆記'
            const content = $content.value
            const isDraft = currentPath.startsWith('offline-draft') || currentPath.startsWith('local/')
            
            // Keystroke auto-save: always marks 'pending' (or 'draft') since it's saved locally to IDB first
            // Only upon successful server POST response does it transition to 'synced'
            currentSyncStatus = isDraft ? 'draft' : 'pending'

            await offlineStore.saveNote(currentPath, {
                title,
                content,
                theme: $themeSelect.value,
                syncStatus: currentSyncStatus
            })
            $pathDisplay.textContent = currentPath
            $syncStatus.textContent = currentSyncStatus === 'draft' ? '📝 本機草稿' : '🟡 待同步至雲端'
            $saveStatus.textContent = '🟢 已儲存至本地 IndexedDB (' + new Date().toLocaleTimeString() + ')'
            await renderNoteList()
            if (options.showNotification) {
                showToast('💾 已儲存至本地 IndexedDB')
            }
            if (navigator.onLine && options.manualSync) {
                if (isDraft) {
                    const defaultSlug = encodeURIComponent(title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, '-').replace(/^-+|-+$/g, '')) || 'note-' + Date.now().toString(36)
                    const targetSlug = prompt('此為本機草稿，請輸入要發布至雲端的 Wiki 路徑名稱 (Wiki Path)：', defaultSlug)
                    if (targetSlug && targetSlug.trim()) {
                        const cleanPath = targetSlug.trim().replace(/^\/+/, '')
                        await offlineStore.deleteNote(currentPath)
                        currentPath = cleanPath
                        $pathDisplay.textContent = currentPath
                        currentSyncStatus = 'pending'
                        await offlineStore.saveNote(currentPath, {
                            title,
                            content,
                            theme: $themeSelect.value,
                            syncStatus: 'pending'
                        })
                        await syncNoteToServer(currentPath, content, { checkConflict: true })
                    }
                } else {
                    syncNoteToServer(currentPath, content, { checkConflict: true })
                }
            }
        }

        async function syncNoteToServer(path, content, options = { checkConflict: false, isForce: false }) {
            if (!navigator.onLine) return
            try {
                const targetPath = path.startsWith('local/') ? path.replace('local/', '') : path
                if (!targetPath || targetPath.startsWith('offline-draft')) return

                let finalContent = content
                if (finalContent && finalContent.includes('data-offline-audio-id')) {
                    try {
                        const matches = [...finalContent.matchAll(/data-offline-audio-id="?([a-zA-Z0-9_-]+)"?/g)]
                        for (const match of matches) {
                            const audioId = match[1]
                            const record = await offlineStore.getOfflineAudio(audioId)
                            if (record && record.blob && record.syncStatus !== 'synced') {
                                const formData = new FormData()
                                formData.append('file', record.blob, record.name || 'recording.webm')
                                formData.append('title', record.name || 'attachment')
                                const upRes = await fetch('https://box.david888.com/api.php?action=upload', { method: 'POST', body: formData }).catch(() => null)
                                if (upRes && upRes.ok) {
                                    const payload = await upRes.json().catch(() => ({}))
                                    const url = payload?.data?.url || payload?.url
                                    if (url) {
                                        const regex = new RegExp('<audio[^>]*data-offline-audio-id="?' + audioId + '"?[^>]*><\\/audio>', 'g')
                                        const newTag = '<audio controls src="' + url + '"></audio>'
                                        finalContent = finalContent.replace(regex, newTag)
                                        await offlineStore.updateOfflineAudioStatus(audioId, 'synced', url)
                                    }
                                }
                            }
                        }
                        if (path === currentPath) {
                            $content.value = finalContent
                            renderPreview()
                        }
                    } catch (e) {
                        console.warn('Audio sync error in offline page:', e)
                    }
                }

                // Conflict check ONLY when syncing pending offline notes or manual sync
                if (options.checkConflict && !options.isForce) {
                    try {
                        const checkRes = await fetch('/' + encodeURIComponent(targetPath), {
                            headers: { 'Accept': 'text/plain' }
                        })
                        if (checkRes.ok && checkRes.status === 200) {
                            const serverRaw = await checkRes.text()
                            if (serverRaw && normalizeText(serverRaw) !== normalizeText(finalContent) && currentSyncStatus === 'pending') {
                                showConflictModal(path, finalContent, serverRaw)
                                return
                            }
                        }
                    } catch (checkErr) {}
                }

                const res = await fetch('/' + encodeURIComponent(targetPath), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ t: finalContent }),
                })
                const data = await res.json()
                if (data.err === 0) {
                    currentSyncStatus = 'synced'
                    await offlineStore.updateSyncStatus(path, 'synced')
                    $syncStatus.textContent = '🟢 雲端已同步'
                    await renderNoteList()
                }
            } catch (err) {
                console.warn('Sync failed:', err)
            }
        }

        async function loadNote(path) {
            // Cancel running debounce timer before switching notes
            if (debounceTimer) {
                clearTimeout(debounceTimer)
                debounceTimer = null
            }
            currentPath = path
            $pathDisplay.textContent = path
            const note = await offlineStore.getNote(path)
            if (note) {
                $title.value = note.title || ''
                $content.value = note.content || ''
                currentSyncStatus = note.syncStatus || 'draft'
                if (note.theme && $themeSelect.querySelector('option[value="' + note.theme + '"]')) {
                    setTheme(note.theme)
                }
            } else {
                $title.value = '未命名筆記'
                $content.value = ''
                currentSyncStatus = 'draft'
            }
            renderPreview()
            await renderNoteList()
        }

        async function renderNoteList(filterQuery = '') {
            const list = filterQuery ? await offlineStore.searchNotes(filterQuery) : offlineStore.getAllNotesMetadata()
            $notesCount.textContent = list.length
            $noteList.innerHTML = ''
            if (!list.length) {
                const li = document.createElement('li')
                li.className = 'note-item active'
                li.innerHTML = '<div class="note-item-info"><div class="note-item-title">' + escapeHtml($title.value || '離線草稿') + '</div><div class="note-item-meta">無搜尋結果或暫無快取</div></div>'
                $noteList.appendChild(li)
                return
            }
            list.forEach(meta => {
                const li = document.createElement('li')
                li.className = 'note-item' + (meta.path === currentPath ? ' active' : '')
                const dateStr = meta.updatedAt ? new Date(meta.updatedAt).toLocaleDateString() : ''
                const badgeClass = meta.syncStatus === 'synced' ? 'synced' : (meta.syncStatus === 'pending' ? 'pending' : 'draft')
                const badgeLabel = meta.syncStatus === 'synced' ? '已同步' : (meta.syncStatus === 'pending' ? '待同步' : '本機')

                li.innerHTML = \`
                    <div class="note-item-info">
                        <div class="note-item-title">\${escapeHtml(meta.title || meta.path)}</div>
                        <div class="note-item-meta">
                            <span>\${dateStr}</span>
                            <span>·</span>
                            <span>\${meta.size || 0} B</span>
                            <span class="note-badge \${badgeClass}">\${badgeLabel}</span>
                        </div>
                    </div>
                    <button type="button" class="note-item-delete" title="刪除本機快取" aria-label="刪除本機快取">🗑️</button>
                \`

                li.onclick = (e) => {
                    if (e.target.closest('.note-item-delete')) return
                    loadNote(meta.path)
                }

                const delBtn = li.querySelector('.note-item-delete')
                delBtn.onclick = async (e) => {
                    e.stopPropagation()
                    if (confirm('確定要刪除「' + (meta.title || meta.path) + '」的本機離線快取嗎？')) {
                        await offlineStore.deleteNote(meta.path)
                        showToast('🗑️ 已刪除本機快取筆記')
                        if (currentPath === meta.path) {
                            currentPath = 'offline-draft-' + Date.now().toString(36)
                            $title.value = '新離線筆記'
                            $content.value = ''
                            renderPreview()
                        }
                        await renderNoteList($searchInput.value)
                    }
                }

                $noteList.appendChild(li)
            })
        }

        // View Mode Switcher
        function setViewMode(mode) {
            document.body.classList.remove('mode-edit', 'mode-split', 'mode-preview')
            document.body.classList.add('mode-' + mode)
            $modeEdit.classList.toggle('active', mode === 'edit')
            $modeSplit.classList.toggle('active', mode === 'split')
            $modePreview.classList.toggle('active', mode === 'preview')
            if (mode !== 'edit') renderPreview()
        }
        $modeEdit.onclick = () => setViewMode('edit')
        $modeSplit.onclick = () => setViewMode('split')
        $modePreview.onclick = () => setViewMode('preview')

        // Theme Switcher
        function setTheme(theme) {
            document.body.classList.remove('theme-light', 'theme-tokyo-night', 'theme-dracula', 'theme-nord')
            if (theme !== 'default') {
                document.body.classList.add('theme-' + theme)
            }
            $themeSelect.value = theme
            localStorage.setItem('cf-notepad-offline-theme', theme)
        }
        $themeSelect.onchange = () => setTheme($themeSelect.value)

        // Event listeners
        $content.addEventListener('input', () => {
            renderPreview()
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                saveCurrent({ showNotification: false })
            }, 600)
        })

        $title.addEventListener('input', () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                saveCurrent({ showNotification: false })
            }, 600)
        })

        $searchInput.addEventListener('input', () => {
            renderNoteList($searchInput.value.trim())
        })

        // Markdown Toolbar Buttons
        if ($toolbar) {
            $toolbar.addEventListener('click', (e) => {
                const btn = e.target.closest('.toolbar-btn')
                if (!btn) return
                const cmd = btn.dataset.cmd
                if (!cmd) return

                const start = $content.selectionStart || 0
                const end = $content.selectionEnd || 0
                const updated = typeof applyMarkdownCommand === 'function'
                    ? applyMarkdownCommand($content.value, start, end, cmd, 'zh-TW')
                    : null

                if (updated) {
                    $content.value = updated.text
                    $content.setSelectionRange(updated.selectionStart, updated.selectionEnd)
                    $content.focus()
                    renderPreview()
                    if (debounceTimer) clearTimeout(debounceTimer)
                    debounceTimer = setTimeout(() => {
                        saveCurrent({ showNotification: false })
                    }, 600)
                }
            })
        }

        // Scroll Sync between Editor and Preview
        let isSyncingEditor = false
        let isSyncingPreview = false

        $content.addEventListener('scroll', () => {
            if (isSyncingPreview || document.body.classList.contains('mode-edit')) return
            isSyncingEditor = true
            const scrollRatio = $content.scrollTop / Math.max(1, $content.scrollHeight - $content.clientHeight)
            $preview.scrollTop = scrollRatio * ($preview.scrollHeight - $preview.clientHeight)
            setTimeout(() => { isSyncingEditor = false }, 50)
        })

        $preview.addEventListener('scroll', () => {
            if (isSyncingEditor || document.body.classList.contains('mode-preview')) return
            isSyncingPreview = true
            const scrollRatio = $preview.scrollTop / Math.max(1, $preview.scrollHeight - $preview.clientHeight)
            $content.scrollTop = scrollRatio * ($content.scrollHeight - $content.clientHeight)
            setTimeout(() => { isSyncingPreview = false }, 50)
        })

        $saveBtn.onclick = () => saveCurrent({ showNotification: true, manualSync: true })

        $newBtn.onclick = async () => {
            if (debounceTimer) clearTimeout(debounceTimer)
            currentPath = 'offline-draft-' + Date.now().toString(36)
            $title.value = '新離線筆記'
            $content.value = ''
            $pathDisplay.textContent = currentPath
            renderPreview()
            await saveCurrent({ showNotification: false })
            showToast('📄 已建立新離線草稿')
        }

        $exportBtn.onclick = () => {
            const title = $title.value.trim() || 'note'
            exportMarkdownFile(title + '.md', $content.value)
            showToast('📄 已匯出 Markdown 檔案')
        }

        $exportHtmlBtn.onclick = () => {
            const title = $title.value.trim() || 'note'
            renderPreview()
            exportHtmlFile(title + '.html', title, $preview.innerHTML)
            showToast('🌐 已匯出 HTML 網頁檔案')
        }

        $backupBtn.onclick = async () => {
            const json = await offlineStore.exportBackupJson()
            const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'david888-wiki-offline-backup-' + new Date().toISOString().slice(0,10) + '.json'
            a.click()
            URL.revokeObjectURL(url)
            showToast('💾 已下載離線快取 JSON 備份檔')
        }

        $openLocalBtn.onclick = async () => {
            const file = await openLocalMarkdownFile()
            if (file) {
                if (debounceTimer) clearTimeout(debounceTimer)
                $title.value = file.name.replace(/\\.md$/i, '')
                $content.value = file.text
                currentPath = 'local/' + file.name
                $pathDisplay.textContent = currentPath
                renderPreview()
                await saveCurrent({ showNotification: true })
                showToast('📂 已載入本地檔案：' + file.name)
            }
        }

        $importBackupBtn.onclick = () => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = async () => {
                if (input.files && input.files[0]) {
                    const text = await input.files[0].text()
                    const res = await offlineStore.importBackupJson(text)
                    if (res.success) {
                        showToast('📥 成功匯入 ' + res.count + ' 篇離線筆記！')
                        await renderNoteList()
                    } else {
                        showToast('❌ 匯入失敗：' + res.error)
                    }
                }
            }
            input.click()
        }

        $clearAllBtn.onclick = async () => {
            if (confirm('⚠️ 警告：確定要清空所有離線快取筆記嗎？此操作不可逆！')) {
                if (debounceTimer) clearTimeout(debounceTimer)
                await offlineStore.clearAllNotes()
                currentPath = 'offline-draft'
                $title.value = '離線筆記'
                $content.value = ''
                renderPreview()
                await renderNoteList()
                showToast('🗑️ 已清空全部離線快取')
            }
        }

        // Shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && $conflictModal.style.display === 'flex') {
                closeConflictModal()
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                e.preventDefault()
                saveCurrent({ showNotification: true, manualSync: true })
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
                e.preventDefault()
                $openLocalBtn.click()
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
                e.preventDefault()
                const modes = ['edit', 'split', 'preview']
                const cur = document.body.classList.contains('mode-edit') ? 0 : (document.body.classList.contains('mode-split') ? 1 : 2)
                setViewMode(modes[(cur + 1) % 3])
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault()
                const btn = $toolbar?.querySelector('[data-cmd="bold"]')
                if (btn) btn.click()
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
                e.preventDefault()
                const btn = $toolbar?.querySelector('[data-cmd="italic"]')
                if (btn) btn.click()
            } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()
                const btn = $toolbar?.querySelector('[data-cmd="link"]')
                if (btn) btn.click()
            }
        })

        // Tab indentation in textarea
        $content.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault()
                const start = $content.selectionStart
                const end = $content.selectionEnd
                const value = $content.value
                $content.value = value.substring(0, start) + '    ' + value.substring(end)
                $content.selectionStart = $content.selectionEnd = start + 4
                renderPreview()
            }
        })

        // Offline Audio Recording with HUD & Controls
        let offlineMediaRecorder = null
        let offlineRecordingStream = null
        let offlineRecordingChunks = []
        let offlineRecordingSeconds = 0
        let offlineRecordingTimer = null
        let offlineIsCanceled = false
        let offlineHud = null
        const $offlineRecordBtn = document.getElementById('offline-record-btn')

        const OFFLINE_PAUSE_SVG = '<svg class="hud-svg" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1.5"></rect><rect x="14" y="4" width="4" height="16" rx="1.5"></rect></svg>'
        const OFFLINE_RESUME_SVG = '<svg class="hud-svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>'
        const OFFLINE_DONE_SVG = '<svg class="hud-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        const OFFLINE_CANCEL_SVG = '<svg class="hud-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'

        function formatOfflineHudTime(sec) {
            const m = Math.floor(sec / 60).toString().padStart(2, '0')
            const s = (sec % 60).toString().padStart(2, '0')
            return m + ':' + s
        }

        function ensureOfflineRecordingHud() {
            if (offlineHud && document.body.contains(offlineHud)) return offlineHud
            const existing = document.getElementById('editor-recording-hud')
            if (existing) { offlineHud = existing; return offlineHud; }
            const hud = document.createElement('div')
            hud.className = 'editor-recording-hud'
            hud.id = 'editor-recording-hud'
            hud.setAttribute('role', 'region')
            hud.setAttribute('aria-label', '錄音控制列')
            hud.innerHTML = '<div class="recording-hud-live-pill">' +
                '<span class="recording-hud-dot"></span>' +
                '<div class="recording-hud-waves" aria-hidden="true">' +
                '<span></span><span></span><span></span><span></span>' +
                '</div>' +
                '<span class="recording-hud-status">錄音中</span>' +
                '<span class="recording-hud-timer">00:00</span>' +
                '</div>' +
                '<div class="recording-hud-actions">' +
                '<button type="button" class="recording-hud-icon-btn hud-btn-pause" data-recording-action="toggle-pause" title="暫停錄音 (Pause)" aria-label="暫停錄音">' +
                OFFLINE_PAUSE_SVG +
                '</button>' +
                '<button type="button" class="recording-hud-pill-btn hud-btn-stop" data-recording-action="stop" title="完成並插入逐字稿 (Done & Insert)" aria-label="完成">' +
                OFFLINE_DONE_SVG +
                '<span>完成</span>' +
                '</button>' +
                '<button type="button" class="recording-hud-icon-btn hud-btn-cancel" data-recording-action="cancel" title="放棄錄音 (Cancel & Discard)" aria-label="取消">' +
                OFFLINE_CANCEL_SVG +
                '</button>' +
                '</div>';
            hud.querySelector('[data-recording-action="toggle-pause"]')?.addEventListener('click', (e) => {
                e.preventDefault()
                toggleOfflinePause()
            })
            hud.querySelector('[data-recording-action="stop"]')?.addEventListener('click', (e) => {
                e.preventDefault()
                stopOfflineRecording()
            })
            hud.querySelector('[data-recording-action="cancel"]')?.addEventListener('click', (e) => {
                e.preventDefault()
                cancelOfflineRecording()
            })
            document.body.appendChild(hud)
            offlineHud = hud
            return offlineHud
        }

        function removeOfflineHud() {
            if (offlineRecordingTimer) {
                clearInterval(offlineRecordingTimer)
                offlineRecordingTimer = null
            }
            offlineRecordingSeconds = 0
            if (offlineHud) {
                offlineHud.classList.add('is-leaving')
                setTimeout(() => {
                    offlineHud?.remove()
                    offlineHud = null
                }, 220)
            }
        }

        function setOfflineRecordingUi(state) {
            const recording = state === 'recording'
            const paused = state === 'paused'
            const active = recording || paused

            if (active) {
                const hud = ensureOfflineRecordingHud()
                hud.classList.toggle('is-paused', paused)
                const statusEl = hud.querySelector('.recording-hud-status')
                const pauseBtn = hud.querySelector('.hud-btn-pause')
                if (statusEl) statusEl.textContent = paused ? '已暫停' : '錄音中'
                if (pauseBtn) {
                    pauseBtn.innerHTML = paused ? OFFLINE_RESUME_SVG : OFFLINE_PAUSE_SVG
                    pauseBtn.title = paused ? '繼續錄音 (Resume)' : '暫停錄音 (Pause)'
                    pauseBtn.setAttribute('aria-label', pauseBtn.title)
                }
            } else {
                removeOfflineHud()
            }

            if ($offlineRecordBtn) {
                $offlineRecordBtn.classList.toggle('is-recording', active)
                $offlineRecordBtn.textContent = active ? (paused ? '⏸️ 錄音暫停中' : '⏹️ 停止錄音') : '🎙️'
                $offlineRecordBtn.title = active ? '點擊停止錄音並插入' : '開始麥克風錄音'
            }
        }

        function stopOfflineRecording() {
            if (!offlineMediaRecorder) return
            if (offlineMediaRecorder.state === 'paused') {
                try { offlineMediaRecorder.resume() } catch (e) {}
            }
            if (offlineMediaRecorder.state === 'recording') {
                try { offlineMediaRecorder.requestData() } catch (e) {}
                try { offlineMediaRecorder.stop() } catch (e) {}
            }
        }

        function toggleOfflinePause() {
            if (!offlineMediaRecorder) return
            if (offlineMediaRecorder.state === 'recording') {
                try { offlineMediaRecorder.requestData() } catch (e) {}
                offlineMediaRecorder.pause()
                if (offlineRecordingTimer) {
                    clearInterval(offlineRecordingTimer)
                    offlineRecordingTimer = null
                }
                setOfflineRecordingUi('paused')
            } else if (offlineMediaRecorder.state === 'paused') {
                offlineMediaRecorder.resume()
                if (!offlineRecordingTimer) {
                    offlineRecordingTimer = setInterval(() => {
                        offlineRecordingSeconds += 1
                        if (offlineHud) {
                            const timerEl = offlineHud.querySelector('.recording-hud-timer')
                            if (timerEl) timerEl.textContent = formatOfflineHudTime(offlineRecordingSeconds)
                        }
                    }, 1000)
                }
                setOfflineRecordingUi('recording')
            }
        }

        function cancelOfflineRecording() {
            offlineIsCanceled = true
            offlineRecordingStream?.getTracks().forEach(t => t.stop())
            if (offlineMediaRecorder && (offlineMediaRecorder.state === 'recording' || offlineMediaRecorder.state === 'paused')) {
                try { offlineMediaRecorder.stop() } catch (e) {}
            }
            offlineRecordingStream = null
            offlineMediaRecorder = null
            offlineRecordingChunks = []
            setOfflineRecordingUi('idle')
            showToast('🗑️ 已取消錄音')
        }

        if ($offlineRecordBtn) {
            $offlineRecordBtn.onclick = async () => {
                if (offlineMediaRecorder?.state === 'recording' || offlineMediaRecorder?.state === 'paused') {
                    stopOfflineRecording()
                    return
                }
                if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
                    showToast('❌ 此瀏覽器不支援麥克風錄音')
                    return
                }
                if (!confirm('請確認參與者已同意錄音。要開始錄音嗎？')) return

                try {
                    offlineRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true })
                    const mimeType = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
                    offlineMediaRecorder = mimeType ? new MediaRecorder(offlineRecordingStream, { mimeType }) : new MediaRecorder(offlineRecordingStream)
                    offlineRecordingChunks = []
                    offlineRecordingSeconds = 0
                    offlineIsCanceled = false

                    offlineMediaRecorder.ondataavailable = e => {
                        if (e.data?.size) offlineRecordingChunks.push(e.data)
                    }

                    offlineMediaRecorder.onstop = async () => {
                        if (offlineIsCanceled) {
                            offlineIsCanceled = false
                            offlineRecordingStream?.getTracks().forEach(t => t.stop())
                            offlineRecordingStream = null
                            offlineMediaRecorder = null
                            offlineRecordingChunks = []
                            setOfflineRecordingUi('idle')
                            return
                        }
                        const audioType = offlineMediaRecorder?.mimeType || 'audio/webm'
                        const audioBlob = new Blob(offlineRecordingChunks, { type: audioType })
                        offlineRecordingStream?.getTracks().forEach(t => t.stop())
                        offlineRecordingStream = null
                        offlineMediaRecorder = null
                        offlineRecordingChunks = []

                        setOfflineRecordingUi('idle')

                        if (!audioBlob || audioBlob.size === 0) {
                            showToast('⚠️ 未錄到有效音訊')
                            return
                        }

                        if (audioBlob.size > 25 * 1024 * 1024) {
                            showToast('❌ 錄音超過 25 MB，請縮短後再試')
                            return
                        }

                        const audioId = 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
                        const blobUrl = URL.createObjectURL(audioBlob)

                        // Save to IndexedDB
                        await offlineStore.saveOfflineAudio(audioId, {
                            blob: audioBlob,
                            name: 'recording-' + Date.now() + '.webm',
                            type: audioType,
                            notePath: currentPath,
                            syncStatus: 'pending'
                        })

                        // Insert audio tag into textarea
                        const start = $content.selectionStart || 0
                        const end = $content.selectionEnd || 0
                        const source = $content.value
                        const tag = '<audio controls data-offline-audio-id="' + audioId + '" src="' + blobUrl + '"></audio>'
                        const prefix = start > 0 && !source.substring(0, start).endsWith('\\n') ? '\\n\\n' : ''
                        const suffix = end < source.length && !source.substring(end).startsWith('\\n') ? '\\n\\n' : ''
                        const insertion = prefix + tag + suffix
                        $content.value = source.substring(0, start) + insertion + source.substring(end)
                        $content.setSelectionRange(start + insertion.length, start + insertion.length)
                        renderPreview()
                        await saveCurrent({ showNotification: false })

                        showToast('🎙️ 錄音已存於本機 (IndexedDB)，發布／同步時會上傳至 888box 附件服務')

                        if (navigator.onLine) {
                            try {
                                showToast('🎙️ 正在使用 AI (Whisper) 轉錄音訊...')
                                const formData = new FormData()
                                formData.append('file', audioBlob)
                                const trRes = await fetch('/api/audio/transcribe', { method: 'POST', body: formData })
                                const trData = await trRes.json()
                                const transcript = trData?.data?.markdown || trData?.data?.text
                                if (transcript && $content.value.includes(audioId)) {
                                    const curVal = $content.value
                                    const idx = curVal.indexOf(audioId)
                                    const tagEndIdx = curVal.indexOf('</audio>', idx)
                                    if (tagEndIdx !== -1) {
                                        const insPos = tagEndIdx + '</audio>'.length
                                        $content.value = curVal.substring(0, insPos) + '\\n\\n' + transcript + '\\n\\n' + curVal.substring(insPos)
                                        renderPreview()
                                        await saveCurrent({ showNotification: false })
                                    }
                                }
                            } catch (e) {
                                console.warn('ASR transcribe error in offline page:', e)
                            }
                        }
                    }

                    offlineMediaRecorder.start(250)
                    setOfflineRecordingUi('recording')
                    offlineRecordingTimer = setInterval(() => {
                        offlineRecordingSeconds += 1
                        if (offlineHud) {
                            const timerEl = offlineHud.querySelector('.recording-hud-timer')
                            if (timerEl) timerEl.textContent = formatOfflineHudTime(offlineRecordingSeconds)
                        }
                    }, 1000)
                    showToast('🎙️ 正在錄音中...')
                } catch (err) {
                    offlineRecordingStream?.getTracks().forEach(t => t.stop())
                    offlineRecordingStream = null
                    offlineMediaRecorder = null
                    setOfflineRecordingUi('idle')
                    showToast('❌ 無法取得麥克風權限：' + err.message)
                }
            }
        }

        // Online & Offline State handling
        function updateNetworkState() {
            if (navigator.onLine) {
                $badge.textContent = '🟢 網路已連線 / Online'
                $badge.classList.add('online')
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(reg => {
                        if (reg && 'sync' in reg) {
                            reg.sync.register('sync-pending-notes').catch(() => {})
                        }
                    }).catch(() => {})
                }
                // Background sync all pending notes
                offlineStore.getPendingSyncNotes().then(pending => {
                    if (pending.length > 0) {
                        showToast('🔄 正在同步 ' + pending.length + ' 篇離線筆記至雲端...')
                        Promise.all(pending.map(p => syncNoteToServer(p.path, p.content, { checkConflict: true }))).then(() => {
                            showToast('☁️ 離線筆記已全數同步至雲端！')
                        })
                    }
                })
            } else {
                $badge.textContent = '⚡ 目前離線中 / You’re offline'
                $badge.classList.remove('online')
            }
        }
        window.addEventListener('online', updateNetworkState)
        window.addEventListener('offline', updateNetworkState)

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'BACKGROUND_SYNC_TRIGGER') {
                    updateNetworkState()
                }
            })
        }

        // Initialize from storage
        const savedTheme = localStorage.getItem('cf-notepad-offline-theme') || 'default'
        setTheme(savedTheme)

        offlineStore.init().then(async () => {
            updateNetworkState()
            const list = offlineStore.getAllNotesMetadata()
            
            // Check if URL specifies a target note to load
            const urlParams = new URLSearchParams(window.location.search)
            const targetNotePath = urlParams.get('note') || (window.location.pathname !== '/_pwa-offline' ? window.location.pathname.replace(/^\\//, '') : '')
            
            if (targetNotePath && (await offlineStore.getNote(targetNotePath))) {
                await loadNote(targetNotePath)
            } else if (list.length > 0) {
                await loadNote(list[0].path)
            } else {
                renderPreview()
                await renderNoteList()
            }
        })
    </script>
</body>
</html>`

    return new Response(html, {
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'Cache-Control': 'no-store',
        },
    })
}

