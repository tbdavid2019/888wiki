/**
 * Admin dashboard template.
 * The page is server-rendered so filters and pagination remain shareable URLs.
 */
import dayjs from 'dayjs'
import { getFlowTrackerScript } from '../constant.js'
import { getAdminCss } from '../styles/admin.css.js'
import { getAdminScript } from '../scripts/admin.js'

const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatDate = timestamp => Number(timestamp) > 0
    ? dayjs.unix(Number(timestamp)).format('YYYY-MM-DD HH:mm')
    : '—'

const noteHref = path => '/' + encodeURIComponent(String(path || ''))

const queryUrl = (adminPath, filters, overrides = {}) => {
    const params = new URLSearchParams()
    const next = { ...filters, ...overrides }

    for (const [key, value] of Object.entries(next)) {
        if (value !== undefined && value !== null && value !== '') {
            const paramKey = key === 'direction' ? 'dir' : key
            params.set(paramKey, String(value))
        }
    }

    const query = params.toString()
    return `${adminPath}${query ? `?${query}` : ''}`
}

const statCard = (label, value, detail = '') => `
    <article class="admin-stat-card">
        <span class="admin-stat-label">${escapeHtml(label)}</span>
        <strong class="admin-stat-value">${escapeHtml(value)}</strong>
        ${detail ? `<span class="admin-stat-detail">${escapeHtml(detail)}</span>` : ''}
    </article>
`

const sortOptions = filters => [
    ['updatedAt', '最後修改'],
    ['title', '標題'],
    ['path', 'URL'],
    ['views', '瀏覽數'],
    ['versionCount', '版本數'],
].map(([value, label]) => `<option value="${value}" ${filters.sort === value ? 'selected' : ''}>${label}</option>`).join('')

const sortLink = (adminPath, filters, value, label) => {
    const active = filters?.sort === value
    const nextDirection = active && filters?.direction === 'asc' ? 'desc' : 'asc'
    const href = queryUrl(adminPath, filters || {}, {
        page: 1,
        sort: value,
        direction: nextDirection,
    })
    const indicator = active ? (filters.direction === 'asc' ? '↑' : '↓') : '↕'

    return `<a class="sort-link${active ? ' active' : ''}" href="${escapeHtml(href)}" aria-label="以${escapeHtml(label)}排序">${escapeHtml(label)} <span aria-hidden="true">${indicator}</span></a>`
}

export const Admin = ({ lang, notes, stats, pagination, filters, historyEnabled, contentScanned, error, adminPath = '', fidoCredentials = [], fidoCredentialsCount = 0 }) => `
    <!DOCTYPE html>
    <html lang="${lang === 'en-US' ? 'en' : 'zh-Hant'}">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Admin — Cloud Notepad</title>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        ${getFlowTrackerScript()}
        <style>${getAdminCss()}</style>
    </head>
    <body>
        <main class="admin-shell">
            <header class="admin-header">
                <div>
                    <p class="admin-eyebrow">DAVID888 WIKI / CONTROL ROOM</p>
                    <h1>Cloud Notepad Admin</h1>
                    <p class="admin-subtitle">管理所有 URL、發佈狀態、搜尋與版本保留狀況。</p>
                </div>
                <div class="admin-header-actions" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                    ${notes !== undefined ? `
                        <button type="button" id="fido-manage-btn" class="btn btn-quiet" title="管理綁定的 Touch ID / 指紋裝置">🔑 指紋 / Passkey (${fidoCredentials ? fidoCredentials.length : 0})</button>
                        <button type="button" id="fido-register-btn" class="btn btn-primary">＋ 綁定 Touch ID</button>
                        <a class="admin-home-link" href="/" target="_blank" rel="noreferrer">開啟首頁 ↗</a>
                    ` : ''}
                </div>
            </header>
            ${error ? `<div class="admin-alert error" role="alert">${escapeHtml(error)}</div>` : ''}
            ${notes !== undefined ? `
                <section class="admin-stats" aria-label="後台摘要">
                    ${statCard('URL 總數', stats?.total ?? 0, 'KV 所有筆記')}
                    ${statCard('已發佈', stats?.shared ?? 0, '可產生分享 URL')}
                    ${statCard('已保護', stats?.protected ?? 0, '編輯鎖或閱讀鎖')}
                    ${statCard('Sitemap', stats?.indexed ?? 0, '已加入公開索引')}
                    ${statCard('瀏覽數', stats?.views ?? 0, '舊版 metadata 累計')}
                    ${statCard('版本數', stats?.versions ?? 0, historyEnabled ? 'D1 保留版本' : '版本功能未啟用')}
                </section>

                <section class="admin-panel admin-filters" aria-labelledby="filter-title">
                    <div class="panel-heading">
                        <div>
                            <h2 id="filter-title">尋找筆記</h2>
                            <p>條件會保留在網址列，可直接複製或返回。</p>
                        </div>
                        ${contentScanned ? '<span class="scan-badge">已掃描文章內容</span>' : ''}
                    </div>
                    <form method="GET" action="${escapeHtml(adminPath)}" class="filter-grid">
                        <label class="filter-field filter-field-wide">
                            <span>標題／URL</span>
                            <input type="search" name="title" value="${escapeHtml(filters?.title)}" placeholder="搜尋標題或 URL" />
                        </label>
                        <label class="filter-field filter-field-wide">
                            <span>全文搜尋</span>
                            <input type="search" name="text" value="${escapeHtml(filters?.text)}" placeholder="搜尋 Markdown 內容" />
                        </label>
                        <label class="filter-field">
                            <span>修改日期起</span>
                            <input type="date" name="from" value="${escapeHtml(filters?.from)}" />
                        </label>
                        <label class="filter-field">
                            <span>修改日期迄</span>
                            <input type="date" name="to" value="${escapeHtml(filters?.to)}" />
                        </label>
                        <label class="filter-field">
                            <span>排序</span>
                            <select name="sort">${sortOptions(filters || {})}</select>
                        </label>
                        <label class="filter-field">
                            <span>方向</span>
                            <select name="dir">
                                <option value="desc" ${filters?.direction !== 'asc' ? 'selected' : ''}>新到舊／大到小</option>
                                <option value="asc" ${filters?.direction === 'asc' ? 'selected' : ''}>舊到新／小到大</option>
                            </select>
                        </label>
                        <label class="filter-field">
                            <span>每頁</span>
                            <select name="pageSize">
                                ${[25, 50, 100].map(size => `<option value="${size}" ${Number(filters?.pageSize) === size ? 'selected' : ''}>${size} 筆</option>`).join('')}
                            </select>
                        </label>
                        <div class="filter-actions">
                            <button class="btn btn-primary" type="submit">套用篩選</button>
                            <a class="btn btn-quiet" href="${escapeHtml(adminPath)}">清除</a>
                        </div>
                    </form>
                </section>

                <section class="admin-panel admin-list-panel" aria-labelledby="list-title">
                    <div class="panel-heading list-heading">
                        <div>
                            <h2 id="list-title">URL 清單</h2>
                            <p>顯示 ${pagination?.totalItems ? ((pagination.page - 1) * pagination.pageSize + 1) : 0}–${Math.min(pagination?.page * pagination?.pageSize || 0, pagination?.totalItems || 0)} 筆，共 ${pagination?.totalItems || 0} 筆符合條件；全站共 ${stats?.total || 0} 筆。</p>
                        </div>
                        <div class="admin-actions">
                            <button id="batch-delete-btn" disabled class="btn btn-danger">刪除選取</button>
                            <button id="delete-empty-btn" class="btn btn-warning">清理空白頁</button>
                            <span id="selected-count" class="selection-count" aria-live="polite"></span>
                        </div>
                    </div>
                    <div class="table-wrap">
                        <table id="notesTable">
                            <thead>
                                <tr>
                                    <th class="check-cell"><input type="checkbox" id="select-all" aria-label="選取本頁全部"></th>
                                    <th>${sortLink(adminPath, filters, 'title', '標題／URL')}</th>
                                    <th>狀態</th>
                                    <th>${sortLink(adminPath, filters, 'views', '瀏覽數')}</th>
                                    <th>${sortLink(adminPath, filters, 'versionCount', '版本')}</th>
                                    <th>${sortLink(adminPath, filters, 'updatedAt', '最後修改')}</th>
                                    <th class="action-cell">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${notes.length ? notes.map(note => `
                                    <tr>
                                        <td class="check-cell"><input type="checkbox" class="note-checkbox" value="${escapeHtml(note.path)}" aria-label="選取 ${escapeHtml(note.title)}"></td>
                                        <td class="note-identity">
                                            <a href="${noteHref(note.path)}" target="_blank" rel="noreferrer">${escapeHtml(note.title)}</a>
                                            <code>/${escapeHtml(note.path)}</code>
                                        </td>
                                        <td class="status-cell">
                                            <span class="status-badge ${note.shared ? 'is-public' : 'is-private'}">${note.shared ? '已發佈' : '私人'}</span>
                                            ${note.indexed ? '<span class="sitemap-badge">Sitemap</span>' : ''}
                                            ${note.hasEditLock ? '<span class="lock-badge">編輯鎖</span>' : ''}
                                            ${note.hasViewLock ? '<span class="lock-badge">閱讀鎖</span>' : ''}
                                        </td>
                                        <td>${escapeHtml(note.views || 0)}</td>
                                        <td>${historyEnabled ? escapeHtml(note.versionCount || 0) : '<span class="muted">—</span>'}</td>
                                        <td class="date-cell">${escapeHtml(formatDate(note.updatedAt))}</td>
                                        <td class="action-cell">
                                            <form method="POST" onsubmit="return confirm('確定刪除此筆記？此操作無法復原。');">
                                                <input type="hidden" name="action" value="delete" />
                                                <input type="hidden" name="path" value="${escapeHtml(note.path)}" />
                                                <button type="submit" class="icon-delete" aria-label="刪除 ${escapeHtml(note.title)}" title="刪除">⌫</button>
                                            </form>
                                        </td>
                                    </tr>
                                `).join('') : `
                                    <tr><td colspan="7" class="empty-state"><strong>找不到符合條件的筆記</strong><span>試試清除篩選，或換一組關鍵字。</span></td></tr>
                                `}
                            </tbody>
                        </table>
                    </div>
                    <nav class="pagination" aria-label="筆記分頁">
                        <a class="pagination-button ${pagination?.page <= 1 ? 'is-disabled' : ''}" href="${escapeHtml(queryUrl(adminPath, filters || {}, { page: Math.max(1, (pagination?.page || 1) - 1) }))}" aria-label="上一頁">← 上一頁</a>
                        <span class="pagination-status">第 ${pagination?.page || 1} / ${pagination?.totalPages || 1} 頁</span>
                        <a class="pagination-button ${pagination?.page >= pagination?.totalPages ? 'is-disabled' : ''}" href="${escapeHtml(queryUrl(adminPath, filters || {}, { page: Math.min(pagination?.totalPages || 1, (pagination?.page || 1) + 1) }))}" aria-label="下一頁">下一頁 →</a>
                    </nav>
                </section>

                <div id="fido-modal" class="fido-modal" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="fido-modal-title">
                    <div class="fido-modal-backdrop" id="fido-modal-backdrop"></div>
                    <div class="fido-modal-card">
                        <header class="fido-modal-header">
                            <h2 id="fido-modal-title">🔑 Touch ID / FIDO2 裝置管理</h2>
                            <button type="button" class="fido-modal-close" id="fido-modal-close" aria-label="關閉">×</button>
                        </header>
                        <div class="fido-modal-body">
                            <div class="fido-device-list" id="fido-device-list">
                                ${fidoCredentials && fidoCredentials.length ? fidoCredentials.map(cred => `
                                    <div class="fido-device-item" data-id="${escapeHtml(cred.id)}">
                                        <div class="fido-device-info">
                                            <strong>${escapeHtml(cred.name || 'Touch ID 裝置')}</strong>
                                            <span>綁定時間：${escapeHtml(formatDate(Math.floor((cred.createdAt || Date.now()) / 1000)))}</span>
                                        </div>
                                        <button type="button" class="btn btn-danger btn-sm fido-delete-btn" data-id="${escapeHtml(cred.id)}">移除</button>
                                    </div>
                                `).join('') : `
                                    <p class="empty-muted">尚未綁定任何 Touch ID / 指紋裝置。點擊下方按鈕即可綁定此設備！</p>
                                `}
                            </div>
                        </div>
                        <footer class="fido-modal-footer">
                            <button type="button" class="btn btn-primary" id="fido-modal-add-btn">＋ 綁定此設備 Touch ID</button>
                            <button type="button" class="btn btn-quiet" id="fido-modal-cancel-btn">關閉</button>
                        </footer>
                    </div>
                </div>
            ` : `
                <section class="login-card">
                    <div class="login-mark">⌘</div>
                    <h2>管理員登入</h2>
                    <p>請使用 Touch ID 指紋或管理員密碼登入後台。</p>
                    <button id="fido-login-btn" type="button" class="btn btn-fido">
                        <span class="fido-btn-icon">🔑</span> 使用 Touch ID / 指紋一鍵登入
                    </button>
                    <div class="login-divider"><span>或使用管理員密碼</span></div>
                    <form method="POST" class="login-form">
                        <label for="admin-password">後台密碼</label>
                        <input id="admin-password" type="password" name="password" placeholder="Enter admin password" autocomplete="current-password" required />
                        <button class="btn btn-primary" type="submit">密碼登入</button>
                    </form>
                </section>
            `}
        </main>
        <script>${getAdminScript(adminPath, notes !== undefined)}</script>
    </body>
    </html>
`
