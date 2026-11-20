/**
 * src/scripts/admin.js
 * Admin page client-side logic via AdminController class.
 * Handles: centralized state, event delegation, sorting, batch delete, delete empty pages, user feedback.
 * Returns the script as a string for inlining in the admin template.
 */
export const getAdminScript = (adminPath = '/admin', isLoggedIn = true) => `
(function() {
    'use strict';
    const ADMIN_PATH = ${JSON.stringify(adminPath)};
    const IS_LOGGED_IN = ${JSON.stringify(isLoggedIn)};

    function base64UrlToBuffer(base64url) {
        if (!base64url) return new Uint8Array(0).buffer;
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
        const binary = atob(base64 + pad);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }

    function bufferToBase64Url(buffer) {
        if (!buffer) return '';
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    }

    async function handleFidoLogin() {
        const btn = document.querySelector('#fido-login-btn');
        if (btn) btn.disabled = true;
        try {
            const chRes = await fetch(ADMIN_PATH + '/fido/login-challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const chData = await chRes.json().catch(() => ({ success: false, message: '無法解析伺服器回應' }));
            if (!chRes.ok || !chData.success) {
                alert(chData.message || '無法取得認證 Challenge');
                if (btn) btn.disabled = false;
                return;
            }

            const allowCredentials = (chData.allowCredentials || []).map(c => ({
                id: base64UrlToBuffer(c.id),
                type: c.type || 'public-key'
            }));

            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: base64UrlToBuffer(chData.challenge),
                    rpId: chData.rpId,
                    allowCredentials,
                    userVerification: 'preferred',
                    timeout: 60000
                }
            });

            if (!credential) throw new Error('未取得生物辨識憑證');

            const payload = {
                id: credential.id,
                authenticatorData: bufferToBase64Url(credential.response.authenticatorData),
                clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
                signature: bufferToBase64Url(credential.response.signature)
            };

            const loginRes = await fetch(ADMIN_PATH + '/fido/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const loginData = await loginRes.json().catch(() => ({ success: false, message: '無法解析伺服器回應' }));
            if (loginRes.ok && loginData.success) {
                window.location.href = loginData.redirect || ADMIN_PATH;
            } else {
                alert(loginData.message || 'Touch ID 登入失敗');
                if (btn) btn.disabled = false;
            }
        } catch (err) {
            console.error('FIDO Login Error:', err);
            if (btn) btn.disabled = false;
            if (err.name !== 'NotAllowedError') {
                alert('Touch ID 登入發生錯誤：' + (err.message || err));
            }
        }
    }

    async function handleFidoRegister() {
        try {
            const defaultName = navigator.userAgent.includes('Mac') ? 'Mac Touch ID' : (navigator.userAgent.includes('iPhone') ? 'iPhone Face ID' : 'Passkey Device');
            const deviceName = prompt('請為此 Touch ID / 指紋裝置輸入名稱：', defaultName);
            if (!deviceName) return;

            const chRes = await fetch(ADMIN_PATH + '/fido/register-challenge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const chData = await chRes.json().catch(() => ({ success: false, message: '無法解析伺服器回應' }));
            if (!chRes.ok || !chData.success) {
                alert(chData.message || '無法取得註冊 Challenge');
                return;
            }

            const userIdBuffer = base64UrlToBuffer(chData.user.id);
            const challengeBuffer = base64UrlToBuffer(chData.challenge);

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: challengeBuffer,
                    rp: chData.rp,
                    user: {
                        ...chData.user,
                        id: userIdBuffer
                    },
                    pubKeyCredParams: [
                        { alg: -7, type: 'public-key' }
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'preferred',
                        residentKey: 'preferred'
                    },
                    timeout: 60000
                }
            });

            if (!credential) throw new Error('使用者取消或裝置未回應');

            const payload = {
                name: deviceName,
                credential: {
                    id: credential.id,
                    rawId: bufferToBase64Url(credential.rawId),
                    response: {
                        attestationObject: bufferToBase64Url(credential.response.attestationObject),
                        clientDataJSON: bufferToBase64Url(credential.response.clientDataJSON),
                    }
                }
            };

            const regRes = await fetch(ADMIN_PATH + '/fido/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const regData = await regRes.json().catch(() => ({ success: false, message: '無法解析伺服器回應' }));
            if (regRes.ok && regData.success) {
                alert('🎉 成功！此裝置 Touch ID / 指紋已成功綁定，下次登入可直接一鍵刷指紋進入後台！');
                window.location.reload();
            } else {
                alert('綁定失敗：' + (regData.message || '未知錯誤'));
            }
        } catch (err) {
            console.error('FIDO Register Error:', err);
            if (err.name !== 'NotAllowedError') {
                alert('綁定過程發生錯誤：' + (err.message || err));
            }
        }
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    async function refreshFidoDevicesList() {
        try {
            const res = await fetch(ADMIN_PATH + '/fido/credentials');
            const data = await res.json().catch(() => ({ success: false }));
            if (data.success && Array.isArray(data.credentials)) {
                const listEl = document.querySelector('#fido-device-list');
                const manageBtn = document.querySelector('#fido-manage-btn');
                if (manageBtn) {
                    manageBtn.textContent = '🔑 指紋 / Passkey (' + data.credentials.length + ')';
                }
                if (listEl) {
                    if (data.credentials.length === 0) {
                        listEl.innerHTML = '<p class="empty-muted">尚未綁定任何 Touch ID / 指紋裝置。點擊下方按鈕即可綁定此設備！</p>';
                    } else {
                        listEl.innerHTML = data.credentials.map(c => {
                            const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
                            const safeName = escapeHtml(c.name || 'Touch ID 裝置');
                            const safeId = escapeHtml(c.id || '');
                            return '<div class="fido-device-item" data-id="' + safeId + '">' +
                                '<div class="fido-device-info">' +
                                    '<strong>' + safeName + '</strong>' +
                                    '<span>綁定時間：' + dateStr + '</span>' +
                                    '<span class="fido-device-id" style="font-family:monospace;font-size:11px;color:#9ca3af;display:block;">ID: ' + safeId.slice(0, 16) + '...</span>' +
                                '</div>' +
                                '<button type="button" class="btn btn-danger btn-sm fido-delete-btn" data-id="' + safeId + '">移除</button>' +
                            '</div>';
                        }).join('');
                    }
                }
            }
        } catch (e) {
            console.error('Failed to refresh FIDO list:', e);
        }
    }

    async function handleFidoDelete(credentialId) {
        if (!confirm('確定要移除此 Touch ID / 指紋裝置嗎？')) return;
        try {
            const res = await fetch(ADMIN_PATH + '/fido/credentials/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentialId })
            });
            const data = await res.json().catch(() => ({ success: false, message: '無法解析伺服器回應' }));
            if (res.ok && data.success) {
                const item = document.querySelector('.fido-device-item[data-id="' + credentialId + '"]');
                if (item) item.remove();
                alert('裝置已成功移除');
                refreshFidoDevicesList();
            } else {
                alert('移除失敗：' + (data.message || '未知錯誤'));
            }
        } catch (err) {
            alert('移除發生錯誤：' + err.message);
        }
    }

    const fidoLoginBtn = document.querySelector('#fido-login-btn');
    if (fidoLoginBtn) {
        fidoLoginBtn.addEventListener('click', handleFidoLogin);
    }

    if (!IS_LOGGED_IN) return;

    /**
     * AdminController - centralized state and event handling for the admin page.
     * All click/change events are handled through delegation from a single listener.
     */
    class AdminController {
        constructor() {
            // State: currently selected note paths
            this.selectedPaths = new Set();
            // State: current sort column and direction
            this.sortState = { column: null, ascending: true };
        }

        /**
         * Initialize the controller: set up event delegation and render initial state.
         */
        init() {
            this.setupEventDelegation();
            this.updateBatchDeleteButton();
            refreshFidoDevicesList();
        }

        /**
         * Set up centralized event delegation.
         * All click and change events flow through here to avoid duplicate handlers.
         */
        setupEventDelegation() {
            // Single click handler for the entire document
            document.addEventListener('click', (e) => this.handleClick(e));
            // Single change handler for the entire document
            document.addEventListener('change', (e) => this.handleChange(e));
        }

        /**
         * Centralized click handler.
         * Routes clicks to appropriate methods based on target.
         */
        handleClick(e) {
            // FIDO register buttons
            const fidoRegBtn = e.target.closest('#fido-register-btn') || e.target.closest('#fido-modal-add-btn');
            if (fidoRegBtn) {
                handleFidoRegister();
                return;
            }

            // FIDO manage modal open
            const fidoManageBtn = e.target.closest('#fido-manage-btn');
            if (fidoManageBtn) {
                const modal = document.querySelector('#fido-modal');
                if (modal) modal.style.display = 'flex';
                refreshFidoDevicesList();
                return;
            }

            // FIDO manage modal close
            const fidoCloseBtn = e.target.closest('#fido-modal-close') || e.target.closest('#fido-modal-cancel-btn') || e.target.closest('#fido-modal-backdrop');
            if (fidoCloseBtn) {
                const modal = document.querySelector('#fido-modal');
                if (modal) modal.style.display = 'none';
                return;
            }

            // FIDO delete device button
            const fidoDelBtn = e.target.closest('.fido-delete-btn');
            if (fidoDelBtn) {
                const id = fidoDelBtn.getAttribute('data-id');
                if (id) handleFidoDelete(id);
                return;
            }

            // Batch delete button
            const batchBtn = e.target.closest('#batch-delete-btn');
            if (batchBtn && !batchBtn.disabled) {
                this.batchDelete();
                return;
            }

            // Delete empty pages button
            const deleteEmptyBtn = e.target.closest('#delete-empty-btn');
            if (deleteEmptyBtn && !deleteEmptyBtn.disabled) {
                this.deleteEmptyPages();
                return;
            }
        }

        /**
         * Centralized change handler.
         * Routes change events for select-all and individual checkboxes.
         */
        handleChange(e) {
            // Select-all checkbox
            if (e.target && e.target.id === 'select-all') {
                const checkboxes = document.querySelectorAll('.note-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    if (e.target.checked) {
                        this.selectedPaths.add(cb.value);
                    } else {
                        this.selectedPaths.delete(cb.value);
                    }
                });
                this.updateBatchDeleteButton();
                return;
            }

            // Individual note checkbox
            if (e.target && e.target.classList.contains('note-checkbox')) {
                if (e.target.checked) {
                    this.selectedPaths.add(e.target.value);
                } else {
                    this.selectedPaths.delete(e.target.value);
                }
                this.updateBatchDeleteButton();
                return;
            }
        }

        /**
         * Update the batch delete button state based on current selection.
         * Also updates the selection count badge and select-all indeterminate state.
         */
        updateBatchDeleteButton() {
            const selected = document.querySelectorAll('.note-checkbox:checked');
            const total = document.querySelectorAll('.note-checkbox');
            const btn = document.getElementById('batch-delete-btn');
            const count = document.getElementById('selected-count');
            const selectAll = document.getElementById('select-all');

            if (!btn) return;

            if (selected.length > 0) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                if (count) count.textContent = '已選中 ' + selected.length + ' 項';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
                if (count) count.textContent = '';
            }

            // Sync select-all checkbox state
            if (selectAll) {
                selectAll.indeterminate = selected.length > 0 && selected.length < total.length;
                selectAll.checked = total.length > 0 && selected.length === total.length;
            }
        }

        /**
         * Show a temporary success notification banner.
         * @param {string} message - The success message to display
         */
        showSuccess(message) {
            this._showNotice(message, 'success');
        }

        /**
         * Show a temporary error notification banner.
         * @param {string} message - The error message to display
         */
        showError(message) {
            console.error('[Admin] Error:', message);
            this._showNotice(message, 'error');
        }

        /**
         * Internal: create and display a notification banner.
         * Auto-dismisses after 3 seconds.
         */
        _showNotice(message, type) {
            // Remove any existing notice
            const existing = document.querySelector('.admin-notice');
            if (existing) existing.remove();

            const notice = document.createElement('div');
            notice.className = 'admin-notice ' + type;
            notice.textContent = message;
            document.body.appendChild(notice);

            setTimeout(() => {
                notice.style.opacity = '0';
                setTimeout(() => notice.remove(), 300);
            }, 3000);
        }

        /**
         * Set loading state on a button element.
         * @param {HTMLElement} btn - The button to update
         * @param {boolean} loading - Whether to show loading state
         * @param {string} loadingText - Text to show during loading
         * @param {string} originalText - Text to restore after loading
         */
        setButtonLoading(btn, loading, loadingText, originalText) {
            if (!btn) return;
            if (loading) {
                btn._originalText = originalText || btn.innerHTML;
                btn.innerHTML = loadingText;
                btn.disabled = true;
                btn.style.opacity = '0.7';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.innerHTML = btn._originalText || originalText || btn.innerHTML;
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
        }

        /**
         * Perform async batch delete of selected notes.
         * Shows loading state, confirmation dialog, success/error feedback.
         */
        async batchDelete() {
            const selected = document.querySelectorAll('.note-checkbox:checked');

            if (selected.length === 0) {
                alert('請先選擇要刪除的項目');
                return;
            }

            if (!confirm('確定要刪除這 ' + selected.length + ' 個筆記嗎？此操作無法撤銷！')) return;

            const paths = Array.from(selected).map(cb => cb.value);

            const btn = document.getElementById('batch-delete-btn');
            this.setButtonLoading(btn, true, '⏳ 刪除中...', '🗑 刪除選中項');

            try {
                const response = await fetch(window.location.pathname, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'batch-delete', paths })
                });

                const result = await response.json();

                if (result.success) {
                    this.showSuccess('✅ 成功刪除 ' + paths.length + ' 個筆記！');
                    setTimeout(() => location.reload(), 1200);
                } else {
                    this.showError('❌ 刪除失敗: ' + (result.message || '未知錯誤'));
                    this.setButtonLoading(btn, false);
                }
            } catch (e) {
                console.error('[Admin] batchDelete error:', e);
                this.showError('❌ 請求錯誤: ' + e.message);
                this.setButtonLoading(btn, false);
            }
        }

        /**
         * Perform async deletion of all truly empty pages (empty content and no passwords).
         * Shows loading state, confirmation dialog, success/error feedback.
         */
        async deleteEmptyPages() {
            if (!confirm('確定要刪除所有空白頁面嗎？此操作無法撤銷！\\n\\n空白頁面定義：內容為空且未設定密碼保護')) {
                return;
            }

            const btn = document.getElementById('delete-empty-btn');
            this.setButtonLoading(btn, true, '⏳ 清理中...', '🧹 刪除所有空白頁面');

            try {
                const response = await fetch(window.location.pathname, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete-empty' })
                });

                const result = await response.json();

                if (result.success) {
                    if (result.deleted > 0) {
                        this.showSuccess('✅ 成功刪除 ' + result.deleted + ' 個空白頁面！');
                        if (result.errors && result.errors.length > 0) {
                            console.warn('[Admin] 部分頁面刪除失敗:', result.errors);
                        }
                        setTimeout(() => location.reload(), 1200);
                    } else {
                        this.showSuccess('ℹ️ 沒有發現空白頁面。');
                        this.setButtonLoading(btn, false);
                    }
                } else {
                    this.showError('❌ 刪除失敗: ' + (result.message || '未知錯誤'));
                    this.setButtonLoading(btn, false);
                }
            } catch (error) {
                console.error('[Admin] deleteEmptyPages error:', error);
                this.showError('❌ 刪除過程中發生錯誤: ' + error.message);
                this.setButtonLoading(btn, false);
            }
        }
    }

    // Bootstrap the controller when DOM is ready
    window.adminController = new AdminController();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.adminController.init());
    } else {
        window.adminController.init();
    }

})();
`
