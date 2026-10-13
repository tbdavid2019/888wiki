/**
 * src/templates/pages.js
 * NeedPasswd and Page404 template functions
 */
import dayjs from 'dayjs'
import { SUPPORTED_LANG, getFlowTrackerScript } from '../constant.js'
import { HTML } from './base.js'
import { EDITOR_PREFERENCE_MODAL } from './common.js'

const escapeHtml = value => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const NeedPasswd = data => HTML({ tips: SUPPORTED_LANG[data.lang].tipEncrypt, showPwPrompt: true, ...data })
export const Page404 = data => HTML({ tips: SUPPORTED_LANG[data.lang].tip404, ...data })

export const ShareExpired = data => {
    const lang = data?.lang || 'zh-TW'
    const t = SUPPORTED_LANG[lang] || SUPPORTED_LANG['zh-TW']
    const isAuthor = data?.ext?.isAuthor === true
    const editUrl = data?.path ? `/${data.path}` : '/'
    const noteIdentifier = data?.title || data?.path || data?.shareId || (lang === 'zh-TW' ? '機密筆記' : 'Confidential Note')
    return HTML({
        ...data,
        title: t.shareExpiredTitle || 'Share Expired',
        tips: `
            <div class="share-status-page share-expired-page">
                <div class="seal-visitor-brand">David888 Wiki / Seal</div>
                <div class="share-status-icon">⏳</div>
                <h2>${escapeHtml(t.shareExpiredTitle || '分享已過期')}</h2>
                <p class="share-status-desc">${escapeHtml(t.shareExpiredDesc || '此分享連結的有效期限已截止，無法再進行存取。')}</p>
                <div class="seal-visitor-info-box">
                    <div class="seal-info-row">
                        <span class="seal-info-label">${lang === 'zh-TW' ? '筆記' : 'Note'}</span>
                        <span class="seal-info-value">#${escapeHtml(noteIdentifier)}</span>
                    </div>
                    <div class="seal-info-row">
                        <span class="seal-info-label">${lang === 'zh-TW' ? '狀態' : 'Status'}</span>
                        <span class="seal-info-value">${lang === 'zh-TW' ? '已過期 (Expired)' : 'Expired'}</span>
                    </div>
                </div>
                ${isAuthor ? `
                    <p class="share-status-author-hint">${lang === 'zh-TW' ? '您是此筆記的作者，可返回編輯頁面重新發布分享連結。' : 'You are the author of this note. You can return to the editor to republish.'}</p>
                    <div class="share-status-actions">
                        <a href="${escapeHtml(editUrl)}" class="opt-button opt-button-accent">${escapeHtml(t.backToEdit || '返回編輯')}</a>
                    </div>
                ` : `
                    <div class="share-status-actions">
                        <a href="/" class="opt-button">${lang === 'zh-TW' ? '返回 David888 Wiki' : 'Return to David888 Wiki'}</a>
                    </div>
                `}
            </div>
        `,
    })
}

export const ShareBurned = data => {
    const lang = data?.lang || 'zh-TW'
    const t = SUPPORTED_LANG[lang] || SUPPORTED_LANG['zh-TW']
    const isAuthor = data?.ext?.isAuthor === true
    const editUrl = data?.path ? `/${data.path}` : '/'
    const noteIdentifier = data?.title || data?.path || data?.shareId || (lang === 'zh-TW' ? '機密筆記' : 'Confidential Note')
    return HTML({
        ...data,
        title: t.shareBurnedTitle || 'Share Destroyed',
        tips: `
            <div class="share-status-page share-burned-page">
                <div class="seal-visitor-brand">David888 Wiki / Seal</div>
                <div class="share-status-icon">🔥</div>
                <h2>${escapeHtml(t.shareBurnedTitle || (lang === 'zh-TW' ? '分享已銷毀' : 'Share Destroyed'))}</h2>
                <p class="share-status-desc">${escapeHtml(t.shareBurnedDesc || (lang === 'zh-TW' ? '此分享為「閱後即焚」機密內容，已被他人讀取並永久銷毀。' : 'This share was set to burn after reading and has been permanently destroyed.'))}</p>
                <div class="seal-visitor-info-box">
                    <div class="seal-info-row">
                        <span class="seal-info-label">${lang === 'zh-TW' ? '筆記' : 'Note'}</span>
                        <span class="seal-info-value">#${escapeHtml(noteIdentifier)}</span>
                    </div>
                    <div class="seal-info-row">
                        <span class="seal-info-label">${lang === 'zh-TW' ? '狀態' : 'Status'}</span>
                        <span class="seal-info-value">${lang === 'zh-TW' ? '閱後即焚已銷毀' : 'Burned & Destroyed'}</span>
                    </div>
                </div>
                ${isAuthor ? `
                    <p class="share-status-author-hint">${lang === 'zh-TW' ? '您是此筆記的作者，該分享連結已按閱後即焚規則自動註銷，原始筆記仍安全保存在您的 Wiki 中。' : 'You are the author of this note. The share link was destroyed per burn-after-reading rules. The original note remains safe in your Wiki.'}</p>
                    <div class="share-status-actions">
                        <a href="${escapeHtml(editUrl)}" class="opt-button opt-button-accent">${escapeHtml(t.backToEdit || '返回編輯')}</a>
                    </div>
                ` : `
                    <div class="share-status-actions">
                        <a href="/" class="opt-button">${lang === 'zh-TW' ? '返回 David888 Wiki' : 'Return to David888 Wiki'}</a>
                    </div>
                `}
            </div>
        `,
    })
}

export const ShareTimeLocked = data => {
    const lang = data?.lang || 'zh-TW'
    const t = SUPPORTED_LANG[lang] || SUPPORTED_LANG['zh-TW']
    const isAuthor = data?.ext?.isAuthor === true
    const unlockAt = Number(data?.ext?.shareUnlockAt) || 0
    const editUrl = data?.path ? `/${data.path}` : '/'
    const formattedUnlockTime = unlockAt ? dayjs(unlockAt * 1000).format('YYYY-MM-DD HH:mm:ss') : ''
    const noteIdentifier = data?.title || data?.path || data?.shareId || (lang === 'zh-TW' ? '機密筆記' : 'Confidential Note')
    return HTML({
        ...data,
        title: t.shareTimeLockedTitle || 'Time-Locked Capsule',
        tips: `
            <div class="share-status-page share-timelock-page">
                <div class="seal-visitor-brand">David888 Wiki / Seal</div>
                <div class="share-status-icon">🔒</div>
                <h2>${escapeHtml(lang === 'zh-TW' ? 'Seal 尚未解鎖' : 'Seal Not Yet Released')}</h2>
                <p class="share-status-desc">${escapeHtml(t.shareTimeLockedDesc || (lang === 'zh-TW' ? '時間膠囊封印中：此筆記已封印鎖定，將於預定解鎖時間到達後自動公開。' : 'Time capsule sealed: this note is locked and will automatically unlock at scheduled time.'))}</p>

                <div class="seal-visitor-info-box">
                    <div class="seal-info-row">
                        <span class="seal-info-label">${lang === 'zh-TW' ? '筆記' : 'Note'}</span>
                        <span class="seal-info-value">#${escapeHtml(noteIdentifier)}</span>
                    </div>
                    <div class="seal-info-row">
                        <span class="seal-info-label">${lang === 'zh-TW' ? '模式' : 'Mode'}</span>
                        <span class="seal-info-value">${lang === 'zh-TW' ? '定時解鎖 (Time Lock)' : 'Time Lock'}</span>
                    </div>
                    ${formattedUnlockTime ? `
                    <div class="seal-info-row">
                        <span class="seal-info-label">${lang === 'zh-TW' ? '解鎖時間' : 'Unlock Time'}</span>
                        <span class="seal-info-value">${escapeHtml(formattedUnlockTime)}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="share-countdown-wrapper" data-target-timestamp="${unlockAt}">
                    <div class="countdown-card">
                        <span class="countdown-val" id="tl-days">00</span>
                        <span class="countdown-lbl">${lang === 'zh-TW' ? '天' : 'Days'}</span>
                    </div>
                    <div class="countdown-card">
                        <span class="countdown-val" id="tl-hours">00</span>
                        <span class="countdown-lbl">${lang === 'zh-TW' ? '時' : 'Hours'}</span>
                    </div>
                    <div class="countdown-card">
                        <span class="countdown-val" id="tl-mins">00</span>
                        <span class="countdown-lbl">${lang === 'zh-TW' ? '分' : 'Mins'}</span>
                    </div>
                    <div class="countdown-card">
                        <span class="countdown-val" id="tl-secs">00</span>
                        <span class="countdown-lbl">${lang === 'zh-TW' ? '秒' : 'Secs'}</span>
                    </div>
                </div>
                <div class="seal-countdown-sentence" id="tl-sentence"></div>
                <div class="share-countdown-notice">${lang === 'zh-TW' ? '倒數歸零時頁面將自動重整解鎖' : 'This page will automatically refresh and reveal when time is reached.'}</div>
                ${isAuthor ? `
                    <p class="share-status-author-hint">${lang === 'zh-TW' ? '您是此筆記的作者，可隨時返回編輯頁面調整解鎖時間或取消封印。' : 'You are the author of this note. You can return to editor to adjust unlock time.'}</p>
                    <div class="share-status-actions">
                        <a href="${escapeHtml(editUrl)}" class="opt-button opt-button-accent">${escapeHtml(t.backToEdit || '返回編輯')}</a>
                    </div>
                ` : `
                    <div class="share-status-actions">
                        <a href="/" class="opt-button">${lang === 'zh-TW' ? '返回 David888 Wiki' : 'Return to David888 Wiki'}</a>
                    </div>
                `}
            </div>
            <script>
                (function() {
                    var wrap = document.querySelector('.share-countdown-wrapper');
                    var target = wrap ? Number(wrap.getAttribute('data-target-timestamp')) : 0;
                    var isZh = ${lang === 'zh-TW' ? 'true' : 'false'};
                    function update() {
                        var now = Math.floor(Date.now() / 1000);
                        var diff = target - now;
                        if (diff <= 0) {
                            window.location.reload();
                            return;
                        }
                        var d = Math.floor(diff / 86400);
                        var h = Math.floor((diff % 86400) / 3600);
                        var m = Math.floor((diff % 3600) / 60);
                        var s = diff % 60;
                        var ed = document.getElementById('tl-days');
                        var eh = document.getElementById('tl-hours');
                        var em = document.getElementById('tl-mins');
                        var es = document.getElementById('tl-secs');
                        var sent = document.getElementById('tl-sentence');
                        if (ed) ed.textContent = d < 10 ? '0' + d : d;
                        if (eh) eh.textContent = h < 10 ? '0' + h : h;
                        if (em) em.textContent = m < 10 ? '0' + m : m;
                        if (es) es.textContent = s < 10 ? '0' + s : s;
                        if (sent) {
                            sent.textContent = isZh
                                ? (d + ' 天 ' + h + ' 小時 ' + m + ' 分 ' + s + ' 秒')
                                : (d + 'd ' + h + 'h ' + m + 'm ' + s + 's');
                        }
                    }
                    update();
                    setInterval(update, 1000);
                })();
            </script>
        `,
    })
}

export const ShareDeadmanLocked = data => {
    const lang = data?.lang || 'zh-TW'
    const t = SUPPORTED_LANG[lang] || SUPPORTED_LANG['zh-TW']
    const isAuthor = data?.ext?.isAuthor === true
    const pulseDueAt = Number(data?.ext?.sharePulseDueAt) || 0
    const editUrl = data?.path ? `/${data.path}` : '/'
    const shareId = data?.shareId
    const formattedPulseDue = pulseDueAt ? dayjs(pulseDueAt * 1000).format('YYYY-MM-DD HH:mm:ss') : ''
    const noteIdentifier = data?.title || data?.path || data?.shareId || (lang === 'zh-TW' ? '機密筆記' : 'Confidential Note')
    return HTML({
        ...data,
        title: t.shareDeadmanTitle || "Dead Man's Switch Active",
        tips: `
            <div class="share-status-page share-deadman-page">
                <div class="seal-visitor-brand">David888 Wiki / Seal</div>
                <div class="share-status-icon">🛡️</div>
                <h2>${escapeHtml(lang === 'zh-TW' ? "Dead Man's Switch 保活中" : "Dead Man's Switch Active")}</h2>
                <p class="share-status-desc">${escapeHtml(t.shareDeadmanDesc || (lang === 'zh-TW' ? '亡者開關保活中：作者心跳簽到正常，筆記持續處於 Seal 封印狀態。若作者失聯超期未簽到，將自動對外公開。' : 'Dead Man heartbeat active. Note remains sealed until author misses check-in.'))}</p>

                <div class="seal-visitor-info-box">
                    <div class="seal-info-row">
                        <span class="seal-info-label">${lang === 'zh-TW' ? '筆記' : 'Note'}</span>
                        <span class="seal-info-value">#${escapeHtml(noteIdentifier)}</span>
                    </div>
                    <div class="seal-info-row">
                        <span class="seal-info-label">${lang === 'zh-TW' ? '模式' : 'Mode'}</span>
                        <span class="seal-info-value">${lang === 'zh-TW' ? "Dead Man's Switch (亡者開關)" : "Dead Man's Switch"}</span>
                    </div>
                    ${formattedPulseDue ? `
                    <div class="seal-info-row">
                        <span class="seal-info-label">${lang === 'zh-TW' ? '下次簽到截止' : 'Pulse Deadline'}</span>
                        <span class="seal-info-value">${escapeHtml(formattedPulseDue)}</span>
                    </div>
                    ` : ''}
                </div>

                <div class="share-countdown-wrapper" data-target-timestamp="${pulseDueAt}">
                    <div class="countdown-card">
                        <span class="countdown-val" id="dm-days">00</span>
                        <span class="countdown-lbl">${lang === 'zh-TW' ? '天' : 'Days'}</span>
                    </div>
                    <div class="countdown-card">
                        <span class="countdown-val" id="dm-hours">00</span>
                        <span class="countdown-lbl">${lang === 'zh-TW' ? '時' : 'Hours'}</span>
                    </div>
                    <div class="countdown-card">
                        <span class="countdown-val" id="dm-mins">00</span>
                        <span class="countdown-lbl">${lang === 'zh-TW' ? '分' : 'Mins'}</span>
                    </div>
                    <div class="countdown-card">
                        <span class="countdown-val" id="dm-secs">00</span>
                        <span class="countdown-lbl">${lang === 'zh-TW' ? '秒' : 'Secs'}</span>
                    </div>
                </div>
                <div class="seal-countdown-sentence" id="dm-sentence"></div>
                <div class="share-countdown-notice">${lang === 'zh-TW' ? '距離下次簽到截止尚有如上時間；若逾期未簽到，內容將自動解鎖' : 'Next check-in deadline shown above. If the author misses check-in, content unlocks.'}</div>
                ${isAuthor ? `
                    <p class="share-status-author-hint">${lang === 'zh-TW' ? '您是此筆記的作者，保活狀態一切正常。您可點擊立即簽到以延長截止時間。' : 'You are the author. Heartbeat active. You can pulse now to extend deadline.'}</p>
                    <div class="share-status-actions">
                        <button type="button" id="deadman-pulse-btn" class="opt-button opt-button-accent" onclick="fetch('/api/shares/${escapeHtml(shareId)}/pulse', { method: 'POST' }).then(function() { window.location.reload(); })">${escapeHtml(t.pulseNowBtn || '立即簽到保活 (Pulse)')}</button>
                        <a href="${escapeHtml(editUrl)}" class="opt-button">${escapeHtml(t.backToEdit || '返回編輯')}</a>
                    </div>
                ` : `
                    <div class="share-status-actions">
                        <a href="/" class="opt-button">${lang === 'zh-TW' ? '返回 David888 Wiki' : 'Return to David888 Wiki'}</a>
                    </div>
                `}
            </div>
            <script>
                (function() {
                    var wrap = document.querySelector('.share-countdown-wrapper');
                    var target = wrap ? Number(wrap.getAttribute('data-target-timestamp')) : 0;
                    var isZh = ${lang === 'zh-TW' ? 'true' : 'false'};
                    function update() {
                        var now = Math.floor(Date.now() / 1000);
                        var diff = target - now;
                        if (diff <= 0) {
                            window.location.reload();
                            return;
                        }
                        var d = Math.floor(diff / 86400);
                        var h = Math.floor((diff % 86400) / 3600);
                        var m = Math.floor((diff % 3600) / 60);
                        var s = diff % 60;
                        var ed = document.getElementById('dm-days');
                        var eh = document.getElementById('dm-hours');
                        var em = document.getElementById('dm-mins');
                        var es = document.getElementById('dm-secs');
                        var sent = document.getElementById('dm-sentence');
                        if (ed) ed.textContent = d < 10 ? '0' + d : d;
                        if (eh) eh.textContent = h < 10 ? '0' + h : h;
                        if (em) em.textContent = m < 10 ? '0' + m : m;
                        if (es) es.textContent = s < 10 ? '0' + s : s;
                        if (sent) {
                            sent.textContent = isZh
                                ? (d + ' 天 ' + h + ' 小時 ' + m + ' 分 ' + s + ' 秒')
                                : (d + 'd ' + h + 'h ' + m + 'm ' + s + 's');
                        }
                    }
                    update();
                    setInterval(update, 1000);
                })();
            </script>
        `,
    })
}

export const Home = ({ lang = 'zh-TW', canonicalUrl, ogImageUrl }) => `
<!DOCTYPE html>
<html lang="${lang === 'zh-TW' ? 'zh-Hant-TW' : 'en'}">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DAVID888 WIKI - Markdown wiki for You</title>
    <meta name="description" content="DAVID888 WIKI is a fast Markdown wiki for writing, publishing, and sharing notes." />
    <meta name="robots" content="index,follow" />
    <meta name="theme-color" content="#0f172a" />
    <link rel="manifest" href="/app.webmanifest" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:site_name" content="DAVID888 WIKI" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="DAVID888 WIKI - Markdown wiki for You" />
    <meta property="og:description" content="DAVID888 WIKI is a fast Markdown wiki for writing, publishing, and sharing notes." />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(ogImageUrl)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="DAVID888 WIKI social card" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="DAVID888 WIKI - Markdown wiki for You" />
    <meta name="twitter:description" content="DAVID888 WIKI is a fast Markdown wiki for writing, publishing, and sharing notes." />
    <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
    <meta name="twitter:image:alt" content="DAVID888 WIKI social card" />
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"DAVID888 WIKI","description":"DAVID888 WIKI is a fast Markdown wiki for writing, publishing, and sharing notes.","url":"${escapeHtml(canonicalUrl)}","image":"${escapeHtml(ogImageUrl)}"}</script>
    ${getFlowTrackerScript()}
    <style>
        :root { color-scheme: light; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        body { min-height: 100vh; margin: 0; background: #f8f7f3; color: #2c2a29; }
        .home-shell { display: grid; min-height: 100vh; place-items: center; padding: 24px; box-sizing: border-box; }
        .home-brand { text-align: center; color: #716c65; font-size: 14px; letter-spacing: .04em; }
        .modal { display: none; }
        .modal-mask { position: fixed; inset: 0; z-index: 1000; background: rgba(37, 35, 32, .48); }
        .editor-preference-content { position: fixed; top: 50%; left: 50%; z-index: 1001; width: min(560px, calc(100vw - 32px)); box-sizing: border-box; padding: 26px; transform: translate(-50%, -50%); border: 1px solid #e2dacd; border-radius: 14px; background: #fff; box-shadow: 0 18px 48px rgba(37,35,32,.24); }
        .editor-preference-header-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .editor-preference-lang-group { display: inline-flex; align-items: center; background: #f5f0e8; border: 1px solid #e2dacd; border-radius: 999px; padding: 2px; gap: 2px; }
        .editor-pref-lang-btn { border: 0; background: transparent; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #6b6965; cursor: pointer; transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease; line-height: 1.2; }
        .editor-pref-lang-btn:hover { color: #24292f; }
        .editor-pref-lang-btn.is-active { background: #fff; color: #c8654b; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12); }
        .editor-preference-close { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 22px; line-height: 1; padding: 0 4px; }
        .editor-preference-content h2 { margin: 0 0 8px; font-size: 20px; }
        .editor-preference-content > p { margin: 0 0 18px; color: #6b6965; font-size: 14px; line-height: 1.55; }
        .editor-preference-options { display: grid; gap: 10px; margin: 0; padding: 0; border: 0; }
        .editor-preference-grid { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
        .editor-preference-option { display: flex; gap: 11px; align-items: flex-start; padding: 14px; border: 1.5px solid #e2dacd; border-radius: 12px; cursor: pointer; background: #fff; transition: border-color 0.16s ease, background 0.16s ease, transform 0.14s ease, box-shadow 0.14s ease; }
        .editor-preference-option:hover { border-color: #c8654b; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); }
        .editor-preference-option:has(input:checked), .editor-preference-option.is-selected { border-color: #c8654b; background: #faf2ed; }
        .editor-preference-option.is-recommended { border-color: #c8654b; }
        .editor-preference-option input { margin-top: 3px; accent-color: #c8654b; }
        .editor-preference-copy { display: flex !important; flex-direction: column; gap: 6px; width: 100%; }
        .editor-preference-header { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
        .editor-preference-badge { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 999px; background: rgba(0, 0, 0, 0.06); color: #6b6965; white-space: nowrap; }
        .editor-preference-badge-accent { background: #fae8e3; color: #c8654b; }
        .editor-card-action { margin-top: 6px; width: 100%; font-size: 13px; height: 32px; }
        .editor-preference-option span { display: grid; gap: 3px; }
        .editor-preference-option strong { font-size: 14px; }
        .editor-preference-option small { color: #6b6965; font-size: 12px; line-height: 1.45; }
        .editor-preference-remember { display: inline-flex; gap: 8px; align-items: center; margin-top: 16px; font-size: 13px; cursor: pointer; }
        .editor-preference-remember input { accent-color: #c8654b; }
        .editor-preference-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
        .opt-button { min-width: 76px; height: 36px; padding: 0 12px; border: 1px solid #d8d0c4; border-radius: 7px; background: #fff; color: #2c2a29; font-weight: 700; cursor: pointer; }
        .opt-button-accent { border-color: #c8654b; background: #c8654b; color: #fff; }
        .opt-button:focus-visible, .editor-preference-option:has(input:focus-visible) { outline: 2px solid #c8654b; outline-offset: 2px; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
        @media (max-width: 600px) {
            .editor-preference-content { width: calc(100vw - 24px); max-height: calc(100dvh - 24px); overflow-y: auto; padding: 18px; border-radius: 12px; }
            .editor-preference-content h2 { font-size: 18px; }
            .editor-preference-content > p { margin-bottom: 14px; font-size: 13px; }
            .editor-preference-grid { grid-template-columns: 1fr; gap: 9px; }
            .editor-preference-option { padding: 12px; gap: 9px; }
            .editor-preference-option strong { font-size: 14px; }
            .editor-preference-option small { font-size: 12px; }
            .editor-preference-actions { position: sticky; bottom: -18px; padding: 12px 0 0; background: #fff; }
        }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; } }
    </style>
</head>
<body>
    <main class="home-shell"><p class="home-brand">DAVID888 WIKI</p></main>
    ${EDITOR_PREFERENCE_MODAL(lang, { autoOpen: true })}
    <script type="module" src="/js/editor-preference.mjs"></script>
    <script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})</script>
</body>
</html>
`
