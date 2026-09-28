# Changelog

## [2026-09-28]

- **🖨️ 修正分享頁列印時進度條與 WebTalk 浮動元件仍出現**：補齊列印樣式對 `.reading-progress` 與 WebTalk Shadow DOM 宿主 `<webtalk-widget>` 的隱藏規則，並加入回歸測試；列印文件只保留文章內容。
- **📱 修正手機分享頁作者提示列擠掉文章內容 (Mobile Share Preview Layout)**：分享頁改用直向排列作者預覽、Seal 狀態提示與文章區，避免 flex 橫向排列在手機上將文章擠到畫面外；Markdown、Canvas 與 Whiteboard 分享檢視都保留完整可用高度。

## [2026-09-23]

- **📸 將實際產品截圖放入對應指南 (Product Screenshots in Context)**：中英文使用指南在 Markdown 撰寫／搜尋取代、音訊與檔案匯入、Seal 情境範本段落旁加入介面截圖；功能詳情在 Markdown 編輯、簡報及段落註解段落旁加入截圖。首頁定位明確改為 Markdown-first，並補充 20 款繽紛主題，以及 MCP、WebMCP、REST/OpenAPI 和 Agent Skill 整合入口。
- **🔒 修正封存筆記按編輯時的 Worker Error (Seal Edit Route Template Mapping)**：一般筆記路由在 Time Lock／Dead Man’s Switch 狀態誤呼叫不存在的 `ShareLocked` 模板，導致 `template_exports[type] is not a function`。現在分別使用已匯出的 `ShareTimeLocked` 與 `ShareDeadmanLocked` 訪客頁，並新增路由模板對應回歸測試。
- **🔎 修正審查發現的錄音、Seal 與 AI 敘述邊界 (Reviewed Audio, Seal & AI Claims)**：雙語文件現在說明錄音先存於 IndexedDB、連線後將音訊副本送往 Groq-first／Workers AI-fallback 轉錄，發布／同步時再上傳 888box 外部附件服務；閱後即焚只銷毀公開分享，保留作者原文；「一次性密碼」明確標示為單次憑據分享，不產生 OTP 驗證碼。
- **🚀 投稿導向首頁與特色呈現 (Submission-Ready Product Positioning)**：首頁改以「擷取 → 整理 → 釋出」呈現價值，直接列出即時錄音、逐字稿／智慧排版、檔案／網頁匯入、四種編輯模式及 Seal 十種安全釋出情境；中英文使用指南補齊每個選單項目與情境範本的實際效果。
- **🔒 修正閱後即焚 Seal 範本未套用到期時間**：一次性密碼與機密金鑰範本現在會同時保存瀏覽上限與各自到期時間（1 小時／1 天），避免範本顯示期限卻只套用閱後即焚規則；新增回歸測試覆蓋 preset 設定與儲存流程。
- **📜 修正公開授權標示**：README 與 npm 專案中繼資料統一標示 LICENSE 實際使用的 `AGPL-3.0`，供收錄清單自動稽核讀取正確資訊。
- **📚 補齊模式操作、Seal 與完整部署參數文件 (Editor Guides, Seal Workflow & Full Deployment Configuration)**：首頁新增 Markdown、Block、Canvas、Whiteboard 與 Seal 的產品特色；加入中英文逐步使用指南，說明四種編輯模式、發布及 Seal 釋出流程。安裝文件完整列出所有 Wrangler 預設變數、KV/D1/R2 綁定與選填整合參數，並補上必填 Secrets 的安全產生方式；公開部署預設關閉 WebTalk，避免新站沿用其他站台的服務設定。
- **📚 重整中英文專案文件並移除舊產品名稱 (English-First Documentation & Brand Cleanup)**：將根目錄 `README.md` 改為英文優先的精簡推廣頁，新增獨立繁中首頁 `README.zh-TW.md`、中英文安裝指南與完整功能詳情文件；更新紀錄維持獨立於 README。移除首頁與安裝文件中的舊產品名稱，並保留原有中英文功能說明於獨立文件。
- **🚀 新增 Cloudflare 一鍵部署並更新專案名稱 (Cloudflare One-Click Deploy & Repository Rename)**：將 GitHub repository 更名為 `tbdavid2019/888wiki`，README 中英文部署章節新增 Cloudflare 官方 Deploy Button；Cloudflare 可依 `wrangler.toml` 自動建立 KV、D1、R2，並於部署時初始化 D1 歷史、統計與註解資料表。加入部署機密欄位說明，移除 Wrangler 設定內的帳號資源 ID 與明文機密預設值，並為複製部署提供安全通用的資源範本。

## [2026-09-22]

- **🎨 Seal 存取控制彈窗排版與體驗優化 (Seal Modal UX Optimization: No Close Overlap, 3-Column Grid, Clean Cards & Dedicated Scroll)**：
  - **右上角關閉鈕與雙語切換分離**：修正關閉鈕原先使用絕對定位造成與中／英切換選單重疊之問題，將關閉鈕納入頂部工具列標準彈性盒佈局（`position: static`），維持 8px 橫向間距，徹底消除遮蔽衝突。
  - **移除卡片右上角重複贅詞**：全面移除情境卡片右上角模式徽章（如「🔥 閱後即焚」、「💓 亡者開關 (30d)」），由於卡片說明文字已清晰標註，移除後消除贅詞冗餘，卡片更清爽緊湊。
  - **全面重構為三欄式網格排版 (3-Column Grid Layout)**：擴展彈窗最大寬度至 860px，將原本浪費縱向空間的雙欄排版改為電腦版三欄網格（`repeat(3, 1fr)`）、平板雙欄、手機單欄自適應，10 款情境範本垂直高度大幅縮減逾 40%。
  - **獨立內部捲軸與置底固定按鈕 (Dedicated Scroll Body & Pinned Footer)**：將參數配置與情境範本收斂至 `.seal-modal-body-scroll` 容器（支援 `scrollbar-gutter: stable` 與自訂捲軸），確保任何解析度下底部操作按鈕（解除 Seal、取消、建立 Seal）均牢牢鎖定於可見範圍，所有情境卡片均可平順捲動檢視，徹底解決下方內容遭截斷無法檢視之問題。

- **🔒 888box 同源「Seal 存取控制」獨立正交架構重構與舊版保險庫選單徹底清理 (Seal Access Control Architecture & Complete Elimination of Legacy Vault Dropdowns)**：
  - **資產存取控制核心哲學 (Orthogonal Access Control Philosophy)**：徹底將存取控制與內容保護職責解耦——「**密碼保護內容，Seal 控制何時或如何釋出**」。借鑒 888box (`box.david888.com/seal/`) 正交架構，無論筆記是否已設定編輯密碼或分享密碼，均可獨立加蓋或解除 Seal。建立或解除立即生效。
  - **極簡分享選單與徹底清除舊版「保險庫」冗餘 (Clean Share Menu & Legacy Vault Dropdown Removal)**：
    - 徹底移除分享下拉選單（包含已發布與未發布草稿）中遺留的舊版「保險庫安全模式 (`#share-vault-mode-select`)」、「有效期限 (`#share-expires-select`)」、「閱後即焚開關 (`#burn-after-reading-btn`)」、「定時解鎖時間 (`#share-unlock-select`)」與「亡者開關週期 (`#share-pulse-select`)」冗餘選單。
    - 分享設定選單極簡回歸專注：僅保留「公開索引」、「段落註解」與單一正交入口「🔒 Seal 存取控制（動態狀態：未設定 ➔ / 定時解鎖 ➔ / 閱後即焚 ➔ / 亡者開關 ➔ / 保留期限 ➔）」。
    - 全面清查並正名專案所有「保險庫」用詞為「Seal 存取控制」與「Seal 封印狀態」。
  - **獨立 Seal 存取控制工作台 (Dedicated Seal Modal Workbench)**：
    - 將舊版範本彈窗升級為獨立的 Seal 存取控制工作台（`#vault-presets-modal` / `.seal-modal`），頂部即時展示當前筆記 Seal 狀態徽章（未設定、定時解鎖倒數中、閱後即焚觀看上限、亡者開關保活中、保留期限計時中）。
    - 提供模式切換（`none` / `timelock` / `burn` / `deadman` / `expires`），動態展開專屬參數控制面板：
      - **定時解鎖 (Timelock)**：日期時間選擇器搭配快捷晶片按鈕（`+1h`、`+1d`、`+3d`、`+7d`、`+30d`），支援秒級與本地時間雙向同步。
      - **閱後即焚 (Burn-After-Reading)**：支援自訂觀看次數上限（`maxViews`，預設 1 次），達成閾值即永久銷毀。
      - **亡者開關 (Dead Man's Switch)**：保活心跳週期輸入（以分鐘計）搭配快捷晶片（`1h`、`1d`、`3d`、`7d`、`30d`），內建「⚡ 立即簽到保活 (Pulse)」與「📋 複製心跳連結 (Copy Pulse URL)」一鍵 Webhook 複製。
      - **保留期限 (Expiration)**：下拉選單（`10m`, `1h`, `1d`, `7d`, `30d`）搭配快捷晶片（`1h`, `1d`, `7d`, `30d`），逾期自動下架顯示友善 410 墓碑頁面。
    - **10 款快速情境範本 (10 Quick Scenario Presets)**：在彈窗內提供 10 款快速情境卡片，點選即自動填入模式與最佳釋出參數，**嚴格不改寫、不注入任何筆記內文**（`#contents`）。
    - **操作按鈕**：提供一鍵「解除 Seal (Remove Seal)」與「建立 Seal (Create Seal)」，支援即時向後端 `/setting` 保存並更新狀態。
  - **底部工具列與選單獨立入口 (Dedicated Toolbar Button & Menu Entry)**：
    - 底欄工具列配置專屬「🔒 Seal」獨立按鈕（`.seal-toolbar-btn`），若當前筆記已加蓋 Seal 則點亮青色小圓點指示燈（`.seal-dot-indicator`）。
    - 分享下拉選單中以單行展示當前狀態「🔒 Seal 存取控制：未設定 ➔」或「已啟用 ➔」，點擊即直達 Seal 彈窗。
  - **訪客封印鎖定頁面視覺品牌重構 (Visitor Lock Page Branding & Live Countdown)**：
    - 全面重構 `ShareTimeLocked`、`ShareDeadmanLocked`、`ShareBurned`、`ShareExpired` 頁面，採用深石板色高質感卡片，頂部顯著展示 `David888 Wiki / Seal` 與當前封印狀態徽章。
    - 清楚標記受保護筆記標題、檔案大小與解封條件；定時解鎖提供即時跳動的日、時、分、秒倒數計時器（`#tl-days`, `#tl-hours`, `#tl-mins`, `#tl-secs`）與文字敘述（`#tl-sentence`）。
  - **響應式排版與 20 款深淺主題適配 (RWD & Full Theme Compatibility)**：
    - 電腦版採用兩欄網格、手機版 (`<= 640px`) 自動切換為單欄垂直佈局。
    - 彈窗與卡片採用非透明實心材質，100% 適配 20 種 CSS 主題之深色與淺色模式，高對比度且消除文字重疊。
  - **Codex 專案代碼審查核准 (Codex Code Review Approved)**：
    - 通過獨立 Codex 子代理人在架構正交性、內文保護零覆蓋、雙語動態支援、RWD/CSS 與客戶端腳本跳脫等 5 大維度的嚴格審查與核准。

## [2026-09-21]

- **🛡️ 安全情境範本庫深度修復：純安全發布參數配置、動態雙語切換與下拉選單原生互動修正 (Vault Presets Pure Security Config, Bilingual Switcher & Select Fix)**：
  - **嚴禁覆蓋筆記內文 (Zero Note Content Overwrite)**：徹底刪除套用情境範本時改寫或注入 `#contents` 的代碼；情境範本僅專注配置保險庫發布安全參數（安全模式、有效期限、定時解鎖倒數、亡者開關保活週期），絕不修改、覆蓋或破壞使用者現有的筆記內容。更新彈窗提示為「💡 點選任一情境即可即時配置安全發布參數，不會影響現有筆記內容。」
  - **草稿與發布參數雙向完整同步 (Draft & Published Parameter Synchronization)**：修復點選情境範本時僅尋址已發布選單而忽略草稿選單的缺陷；現在點選範本會同時更新草稿發布（`#share-vault-mode-select-draft`, `#share-expires-select-draft`, `#share-unlock-select-draft`, `#share-pulse-select-draft`, `#burn-after-reading-btn-draft`）與已發布選單（`#share-vault-mode-select` 等），同步刷新 UI 面板並在筆記已發布時即時調用 `/setting` 持久化。
  - **情境範本彈窗內建動態雙語切換 (In-Modal Bilingual Switcher & i18n Sync)**：借鑒預設編輯器彈窗設計，在「安全情境範本庫」頂部新增雙語切換群組（`中` / `En`），支援在彈窗內無重整即時切換標題、副標題、底部提示與所有卡片名稱、說明及模式標籤（`data-title-zh/en`, `data-desc-zh/en`, `data-badge-zh/en`），並依當前語系提供「已套用情境範本：... / Preset applied: ...」雙語 Toast 提示。
  - **徹底排除標準發布等下拉選單完全無法點開之衝突 (Native Select Interaction Fix in Floating Menus)**：移除 `static/js/floating-controls.mjs` 中對 `pointerdown` 與 `mousedown` 的攔截與 `stopPropagation` 調用，消除造成 macOS / Safari / Chromium 原生 `<select>` 選單彈出被取消的事件衝突；同時免除 click 的 `stopPropagation`，使選單內的按鈕（如開啟範本庫按鈕）能順利冒泡觸發全域代理處理器。

- **🐛 修復分享選單中「保險庫安全模式（標準發布）」等下拉選單點擊即關閉無法開啟問題 (Fix Dropdown Select Premature Closure)**：
  - **根因修復**：全域浮動控制腳本 `static/js/floating-controls.mjs` 中 `documentRef` 監聽之全域 click 事件未防護選單內部控件，導致點擊 `<select>`（標準發布／閱後即焚／定時解鎖／亡者開關）時冒泡觸發 `closeAll()` 將選單強制移回 DOM 並關閉，使瀏覽器原生選項視窗被強制取消。現於選單內部阻斷表單控件的 `click`, `pointerdown`, `mousedown` 冒泡，點擊外部時才關閉。
  - **鍵盤方向鍵放行**：當焦點在 `<select>` 或 `<input>` 上時放行原生方向鍵與 Home/End 鍵切換選項，不再被選單焦點跳轉攔截。
  - **樣式整合與深淺主題**：統一補齊 `.opt-select`, `.share-vault-mode-select`, `.share-expires-select`, `.share-unlock-select`, `.share-pulse-select` 的 28px 高度、圓角與深淺模式色彩，移除衝突的 `width: 100%`，讓標籤與選單左右橫向平順對齊。
  - **回歸測試保護**：於 `test/floating-controls-ui.test.mjs` 新增點擊 select、label、toggle 不關閉與方向鍵不被攔截之完整回歸測試。

- **🎨 底部工具列單列排版與情境範本彈窗網格重構 (Footer Single-Line Toolbar & Presets Modal Layout Fixes)**：
  - **徹底根除 WebKit / Safari `<button>` 佈局引擎缺陷 (WebKit Bug 137351 Fix)**：在 macOS / iOS Safari 及 WebKit 內核中，`<button>` 採用原生 `RenderButton` 控件，會忽略內部垂直彈性盒模型 (`display: flex; flex-direction: column`)，導致卡片頂部圖標徽章與底部說明被擠出按鈕外層造成文字混亂重疊。全面重構為 `<div role="button" tabindex="0">`，100% 依循標準 CSS 盒子模型封裝，完美相容所有瀏覽器。
  - **完美參照 fx 公式複製格式架構 (Matching Math Format Modal Architecture)**：全面借鑒成熟的 `MATH_FORMAT_MODAL`（fx 公式複製格式）架構與色彩系統，彈窗開窗時自動聚焦於第一張卡片，消除右上角關閉鈕初次開啟時的藍色焦點外框；支援鍵盤 Tab、Enter 與 Space 快速鍵選取。
  - **修復底欄按鈕雙層堆疊 (Bug 1 Fix)**：修正原本 `#vault-presets-toolbar-btn` 與 `#share-dropdown` 共同置於 `.footer-control-group` (`flex-direction: column`) 導致在編輯器底欄垂直折行成雙層的問題；將「範本」按鈕移出控制組並置於右側操作按鈕列中（緊鄰公式按鈕 `#math-format-btn` 與引用按鈕旁），高度固定 28px 並嚴格維持單列水平均勻對齊。
  - **修復範本卡片重疊與彈窗深淺主題相容性 (Bug 2 Fix)**：補全實心不透明背景（淺色 `#f8fafc`、深色 `#0f172a`），支援深淺主題自適應；將彈窗網格改為電腦雙欄、手機 (`<= 640px`) 單欄響應式排版。

- **✨ 快速情境範本獨立工具列按鈕與 Lucide 向量圖標彈窗庫 (Independent Presets Toolbar Button & Lucide Modal)**：
  - **工具列獨立入口**：將原本擠在分享選單內的 10 款範本分離，在編輯器底部控制列新增獨立「範本 (Presets)」按鈕（`#vault-presets-toolbar-btn`），並在分享下拉選單內提供乾淨單列快捷鍵「✨ 瀏覽 10 款安全情境範本」，徹底消除擁擠雜亂。
  - **精美卡片式彈窗庫 (Scenario Presets Modal)**：點擊開啟專屬的「安全情境範本庫」彈窗（`#vault-presets-modal`），以響應式卡片網格完整呈現各情境的官方 Lucide 圖標、模式標籤（閱後即焚／定時解鎖／亡者開關／保留期限）、標題與詳細說明；點擊任何卡片即刻套用保險庫設定，並自動關閉彈窗。
  - **100% 採用 Lucide SVG 向量圖標**：全數淘汰 Emoji 表情符號，統一採用官方 Lucide 向量圖標（`shieldAlert`, `bitcoin`, `megaphone`, `rocket`, `gift`, `scale`, `target`, `graduationCap`, `lifeBuoy`, `key`），支援 20 款深淺主題色彩自動調適與高解析度視網膜螢幕抗鋸齒。

- **🔐 分享保險庫安全模式與快速情境範本 (Share Vault Security Modes, 10 Quick Start Presets & Security Hardening)**：
  - **4 種進階發布與生命週期管理模式**：
    - **標準公開與有效期限 (Standard & Expiration)**：支援為任何公開分享設定到期時間（`10m`, `1h`, `1d`, `7d`, `30d` 或永久有效）。整合 Cloudflare KV 原生 TTL 與 Worker 雙層檢查，到期自動下架並顯示友善的 410 墓碑頁面。
    - **閱後即焚 (Burn-After-Reading / Single-Use Ephemeral)**：單次讀取即從伺服器永久銷毀。內建兩階段確認揭示卡（防止 LINE、Discord、Telegram、Twitter 等爬蟲機器人抓取摘要時意外焚毀）；**嚴格實作作者存取豁免（作者編輯或檢視不計次、不觸發焚毀）**；銷毀後永久返回 410 墓碑頁。
    - **定時解鎖／時間膠囊 (Time-Locked Capsule)**：封印機密內容直至指定時間解鎖（`1h`, `1d`, `3d`, `7d`, `30d` 後）。外部訪客返回 423 Locked 狀態碼並顯示動態倒數計時卡（日、時、分、秒），倒數歸零自動重整公開；作者在封印期間具備專屬預覽橫幅與提前解封設定。
    - **亡者開關／保活心跳 (Dead Man's Switch)**：保險庫在作者定期打卡保活期間持續維持機密封印（`3d`, `7d`, `14d`, `30d` 簽到週期）。作者編輯筆記、點擊「立即簽到保活 (Pulse)」或透過專屬 Webhook (`/api/shares/:id/pulse?token=...`) 刷新心跳；若作者超期失聯，保險庫自動對外公開並顯示解封說明。
  - **⚡ 10 款一鍵快速情境範本 (10 Quick Start Presets)**：
    - 在分享選單中內建 10 款快速情境按鈕，點擊即自動套用最佳保險庫模式、倒數／簽到週期，並在空白筆記中預填專業排版範本：
      1. 🛡️ **一次性密碼 (One-Time Password)**：閱後即焚 (`burn`)，有效 1 小時，適合傳遞臨時金鑰。
      2. ₿ **加密資產傳承 (Crypto Inheritance)**：亡者開關 (`deadman`)，30 天保活心跳，預填冷錢包與繼承指引。
      3. 📢 **吹哨揭弊保護 (Whistleblower)**：亡者開關 (`deadman`)，7 天心跳，失聯即釋出公共利益事證。
      4. 🚀 **產品發布解鎖 (Product Launch)**：時間膠囊 (`timelock`)，7 天後解鎖正式公告與促銷代碼。
      5. 🎁 **生日驚喜禮物 (Birthday Gift)**：時間膠囊 (`timelock`)，1 天後 (生日當天) 揭曉驚喜兌換券。
      6. ⚖️ **司法保全留存 (Legal Hold)**：標準分享 (`standard`)，30 天後自動過期下架。
      7. 🎯 **闖關尋寶線索 (Scavenger Hunt)**：時間膠囊 (`timelock`)，1 小時後解密下一道謎題。
      8. 📅 **課程定時教材 (Course Content)**：時間膠囊 (`timelock`)，7 天後隨課堂進度定時解鎖講義與作業解答。
      9. 🛟 **緊急災備通道 (Emergency Backup)**：亡者開關 (`deadman`)，14 天無簽到自動釋出應急救援 SSH 與主控台存取。
      10. 🔑 **機密金鑰分享 (Shared Secret)**：閱後即焚 (`burn`)，適合安全傳送 `.env` API Key 與連線密鑰。
  - **🛡️ Codex 安全代碼審查與深度防護 (Security Hardening & Review Fixes)**：
    - **原子化銷毀 (Atomic Tombstone Claiming)**：實作 `driverClaimBurnShare`，在 D1 與 KV 層以條件更新原子化註記墓碑，消除高併發雙重揭示 (double-read race condition) 漏洞。
    - **授權優先驗證 (Authenticate Before Burn)**：PDF 匯出與揭示端點均在執行焚毀前強制校驗密碼 (`vpw` / `pw`)，避免未授權請求藉由 `burn_confirm=true` 惡意觸發非預期銷毀。
    - **路徑 API 保險庫聯防 (Vault Enforced on Path APIs)**：在 `GET /api/:path` 與筆記直接 PDF 匯出端點針對非作者請求強制套用過期 (410)、銷毀 (410)、時間膠囊 (423) 與亡者開關 (423) 防護；閱後即焚禁止透過 path 直讀。
    - **分享頁隱蔽路徑 (Mask Internal Path in Client State)**：公開分享頁針對外部訪客屏蔽 `APP_STATE.path` 與 `settingPath`，杜絕透過客戶端狀態探知內部私有 pad 路徑。
    - **重新發布自動換址 (Rotate Burned Share Slugs)**：重新公開已焚毀的筆記時自動清空舊的 `shareSlug` 與 `shareId` 並重新派發新網址，確保持有舊連結的訪客持續收到 410 墓碑。
    - **修正 D1 欄位對應**：修復 `driverFindNoteByShareId` 之 SQL 查詢欄位為 `content`（原誤填 `value`），確保 D1 模式下正確檢索筆記內文。
    - **切換模式自動重置焚毀狀態**：由閱後即焚切換至其他保險庫模式時，自動重置 `shareBurnAfterReading = false` 並刪除 `shareBurnedAt`。
    - **未發布範本選單綁定修正**：修正草稿分享選單點擊情境按鈕時正確尋址 `#share-unlock-select-draft` 與 `#share-pulse-select-draft`。
    - **消弭預覽洩漏**：閱後即焚過渡確認頁面徹底清空隱藏 `<article id="bot-accessible-content">` 與 client state，杜絕爬蟲抓取。
    - **密鑰動態隔離**：移除靜態 fallback 字串，採用執行時期 `crypto.randomUUID()` 隔離作者 token；Pulse 週期支援數值秒數與文字縮寫防呆。
  - **全格式通用支援 (Universal Format Compatibility)**：支援 Markdown 筆記、BlockNote 塊編輯器、Ameliorate JSON Canvas 知識圖譜、Excalidraw 自由白板與簡報／PDF 匯出，全格式均受保險庫生命週期管線防護。
  - **原生 WebMCP 與 REST API 擴充**：`write_note`、`write_canvas`、`write_whiteboard` 支援 `share_mode`、`expires_in`、`burn_after_reading`、`unlock_in`、`pulse_interval` 參數，自動生成 pulse webhook 與到期資訊。
  - **🌐 對外文檔自動全面同步 (External LLMs, Skills & OpenAPI Sync)**：
    - `LLM_API_DOCS.md`：新增第 7 章專節說明 4 種保險庫模式、10 款情境範本、Pulse 心跳 Webhook 與 Reveal API。
    - `skills/SKILL.md` & `.agent/skills/`：同步包含保險庫模式、REST 呼叫規範與 WebMCP 參數。
    - `static/llms.txt` & `static/llms-full.txt`：同步更新 Share Vault、Excalidraw Whiteboard、生命週期端點與安全模型。
    - `src/discovery.mjs`：動態更新 `/llms.txt`、`/llms-full.txt`、OpenAPI 3.1.0 綱要 (`NoteWriteRequest` 與 `/api/shares/{shareId}/pulse`、`/api/shares/{shareId}/reveal` 路由)。
  - **完整測試與雙語支援**：擴充 `test/share-vault-modes.test.mjs`，測試套件 494/494 100% 通過；介面與文檔完整支援繁體中文 (`zh-TW`) 與英文 (`en-US`)。

## [2026-09-18]

- **🧭 新筆記模式選擇器補全 (Four-Format Editor Preference Modal)**：首次建立筆記與「設定預設編輯器模式」現在完整提供 Markdown、Block、Canvas、Whiteboard 四種選項，支援繁中／英文、推薦標籤、記住選擇與正確路由導向。

- **🏷️ Whiteboard JSON 頁籤標題修正 (Readable Whiteboard Titles)**：Excalidraw JSON 會先解析文字元素標題，空白白板使用 note path 作為 fallback；頁籤與公開 metadata 不再顯示原始 `{"type":"excalidraw"...}` 內容。
- **🧩 Whiteboard 白屏修正 (Normalize Excalidraw Elements)**：Whiteboard mount 前使用 Excalidraw 官方 `convertToExcalidrawElements` 正規化簡化 JSON，補齊 renderer 所需 element 欄位，保留 Obsidian／Excalidraw JSON 輸入相容性。
- **🖥️ Whiteboard runtime exception 修正 (Excalidraw UIOptions)**：將 `canvasActions.export` 從布林值改為 Excalidraw 0.18.1 要求的 `{ saveFileToDisk: true }` 物件，修正 mount 階段白屏。
- **🧹 Whiteboard Console 清理**：將 Excalidraw 內部 `unload` cleanup listener 改為 `pagehide`，保留離頁清理並符合瀏覽器 Permissions Policy；Whiteboard 靜態資產版本升至 `v=1.1`，確保瀏覽器取得修正版 bundle。
- **📚 Whiteboard Library 套件安裝修正 (Library Install & Persistence)**：接入 `libraryReturnUrl`、`onLibraryChange` 與 `libraryItems` JSON round-trip，外部 Excalidraw Libraries 的 `Add to Excalidraw` 現在會回到當前 Whiteboard 並保存到 note；資產版本升至 `v=1.2`。

- **🎨 Excalidraw 自由手繪白板模式 (Excalidraw Freeform Whiteboard Editor & Agent Tools)**：
  - **雙軌畫布分流 (/new/whiteboard)**：引入 Excalidraw 官方 React 組件 (`@excalidraw/excalidraw@0.18.1`)，作為與 Canvas 邏輯卡片圖並行的第四種原生筆記格式 (`editorFormat: 'whiteboard'`)。Canvas 專注節點關聯與架構圖，Whiteboard 專注自由手繪塗鴉、箭頭、色鉛筆筆觸與便籤。
  - **100% 官方標準封裝**：零發明客製畫布組件，直接採用 Excalidraw 官方生態，本機 esbuild 打包至 `static/js/whiteboard-editor.bundle.mjs` (ESM) 與 `bundle.css`，字型支援透過 unpkg CDN 動態載入，維持靜態資源輕量。
  - **無縫資料儲存與唯讀分享**：狀態透過 `#contents.value` 防抖同步，完整保留 Excalidraw JSON (`elements` 與 `appState`) 於 D1/KV 資料庫，無需修改資料庫 schema；支援 `/share/:id` 唯讀分享 (`viewModeEnabled: true`)、自動跟隨 20 款深淺主題色彩切換。
  - **原生 WebMCP 與 REST API 契約**：WebMCP 支援 `validate_whiteboard`、`write_whiteboard`、`read_whiteboard`；REST API `POST /api/:path` 支援 `editorFormat: "whiteboard"`，並於 `whiteboardToMarkdown` 自動提取文字內容供搜尋引擎與 headless 讀取。
  - **發現與文檔同步**：更新 OpenAPI 3.1.0、`llms.txt`、`llms-full.txt`、`LLM_API_DOCS.md`、`skills/SKILL.md`、`.agent/skills/` 與雙語 `README.md`。

- **🔐 Whiteboard 供應商 bundle 秘密掃描修正 (Whiteboard Bundle Secret Scan Fix)**：Whiteboard build 流程會移除 Excalidraw upstream Firebase client config 後才寫入 `static/js/whiteboard-editor.bundle.mjs`；目前產物與線上資產均保留空設定，不再攜帶第三方 Google API key。

- **✏️ Canvas 標題可直接編輯 (Editable Canvas Title)**：Canvas 左上方新增標題編輯器，支援人員直接修改頁籤標題；標題透過 `/setting` 寫入 note metadata，並同步更新瀏覽器頁籤、編輯頁、公開分享頁與重新整理後的 Canvas 標題。明確設定的 metadata title 具備最高頁面標題優先級。

- **🚀 Canvas P1／P2 互動與知識圖譜功能完成 (Canvas Multi-select, Export, Search, WikiLink Graph & Camera Tour)**：
  - **框選多選**：支援滑鼠框選、Cmd／Ctrl 多選、多卡片拖曳、批次換色與批次刪除；手機保留獨立畫布操作區與觸控適配。
  - **圖片匯出**：File Menu 新增 SVG、PNG 匯出，依節點 bounds 自動計算畫布尺寸並以 2x pixel ratio 產生檔案。
  - **畫布搜尋**：支援 Cmd／Ctrl+F，搜尋卡片文字、標籤、Wiki path、URL 與資源檔名，點擊結果自動導航至卡片。
  - **WikiLink 關聯圖**：File Menu 可輸入 Markdown 筆記路徑，解析 `[[WikiLink]]`、建立 Wiki file nodes 與帶箭頭關係線；WebMCP 新增 `generate_canvas_from_wikilinks`。
  - **Camera Tour**：右上角新增畫布導覽控制，依節點座標或 `david888.cameraTour.order` 逐張平移／縮放播放。
  - **依賴維護**：升級 `cookie@2.0.1`、BlockNote `0.54.2`、Wrangler `4.134.0`，加入 Cookie v2 相容層與邊界測試；加入 `html-to-image@1.11.13` 支援圖片匯出。

- **📐 Canvas 新增選單左側基準線修正 (Canvas Add Menu Alignment)**：統一 Thought Nodes 與 Extensions 的 row 寬度、左對齊規則與 28px icon 欄位，六個擴充項目的文字現在共享同一條起始基準線；Canvas bundle cache version 更新至 `v=3.7`。

- **🤖 Canvas Agent Contract 與 Book 模式整合 (WebMCP, REST API, Skill & LLM Discovery)**：
  - **原生 WebMCP 工具**：新增 `validate_canvas`、`write_canvas`、`read_canvas`，LLM agent 可驗證節點與關係線、建立完整 JSON Canvas、讀回 edge 數量與公開 `shareUrl`。
  - **REST／OpenAPI 對應**：`POST /api/{path}` 支援 `editorFormat: "canvas"` 與完整 JSON Canvas 文件；`/openapi.json`、`LLM_API_DOCS.md` 與動態 API 說明同步列出 Canvas 契約。
  - **Agent 發現文件同步**：更新 `skills/SKILL.md`、`.agent/skills/`、`llms.txt`、`llms-full.txt` 與 README 中英雙語說明，明確提示 agent 在關係圖、架構圖、概念圖或卡片關聯需求下可建立 Canvas。
  - **Book Mode 相容**：Markdown 章節清單可加入 Canvas path 或 Share URL，`/book` 會載入唯讀互動 Canvas 章節。

- **🛡️ 彈性 AI 服務容錯層與全面汰換棄用模型 (Resilient AI Provider Adapter & Purge Deprecated Llama Models)**：
  - **根本原因診斷 (Root Cause Discovered)**：經跨 4 組 Cloudflare 帳號實測驗證，Cloudflare 控制平面在特定帳號（如 `379570860738dd1757ba7f67ef2bdffe`）上發生 Worker Metadata 綁定生成器內部異常，上傳驗證時報錯 `10021: binding AI of type ai failed to generate: internal error`（直接 REST API 推論則正常）。
  - **全面清理廢棄模型 (Purge Legacy Llama Models)**：徹底從專案程式碼中移除所有已廢棄或停止維護的 Meta/Llama 模型（如 `llama-3.1-8b-instruct`, `llama-3.3-70b-instruct`），統一收斂至 `@cf/openai/gpt-oss-120b` 與 `@cf/openai/gpt-oss-20b`。
  - **雙軌容錯架構 (`resolveAiBinding`)**：在 `src/index.js` 實作 `resolveAiBinding(env)` 統一介面，優先使用 `env.AI`；若未配置或處於控制平面異常期，自動平滑降級調用 `env.GROQ_API_KEY`（採用 `openai/gpt-oss-20b` 與 `openai/gpt-oss-120b` 生產級模型），確保音訊智慧排版、劃線讀者助理與 `/:path/ai-format` 功能 100% 正常運作，零中斷。
  - **生產環境驗證**：成功部署至 Cloudflare Workers，經端對端實機測試 `POST /test-ai-note/ai-format` 確認排版推論功能秒級響應並格式化成功。

- **📦 Canvas 圖片／檔案資源節點 (Canvas Resource & Asset Nodes with R2 & 888box)**：
  - **新增擴充入口**：在 Canvas 工具列「新增」選單中加入「圖片／檔案資源」入口，並支援直接拖曳任意檔案至畫布表面自動建立資源節點並在座標處上傳。
  - **雙軌儲存管線**：圖片檔案（`image/*`）自動導流至既有 R2 儲存服務；文件、音訊、影片與壓縮檔自動經由多層容錯的 888box API（`box.david888.com` / `box.aiurl.tw` / `box.glsoft.ai`）完成上傳。
  - **標準 JSON Canvas 1.0 相容**：嚴格保存為標準 `type: 'file'`，並將檔案元資料完整記錄於 `david888.asset`（檔名、MIME 類型、檔案大小與儲存服務商 `r2` / `888box`）。
  - **MIME 智慧渲染**：
    - **圖片**：呈現等比縮放預覽圖與漸層資訊遮罩（檔名、大小與儲存商）。
    - **音訊**：呈現專屬音訊圖示、檔名、大小標籤與原生 `<audio controls>` 播放器。
    - **影片**：內嵌原生 `<video controls>` 播放器與多媒體元資料。
    - **文件／檔案**：顯示專業檔案卡片、檔名、大小與一鍵「下載檔案 ↗」按鈕。
  - **完整節點生命週期操作**：保留四邊雙向關係錨點 (`NodeHandles`)、角落 `NodeResizer` 縮放、右上角「替換檔案」重新上傳、開新視窗檢視、節點複製與刪除。
  - **靜態資產版本**：Canvas bundle 與樣式版本號遞增至 `v=3.6`。

- **🔗 外部連結 OG 預覽 API**：新增 `/api/url-meta`，安全驗證公開 HTTP(S) URL 與 redirect，讀取 `og:title`、`og:description`、`og:image`、`og:site_name` 與 canonical URL，Link node 會快取預覽資料到 `david888.ogPreview`。

## [2026-09-17]

- **🧩 修復 Wiki、外部連結與群組卡片操作 (Wiki, Link & Group Node Fixes)**：Wiki 節點支援站內路徑與 share URL 預覽，外部連結與 Wiki 表單改為完整寬度排版；file/link 卡片提高預設高度；群組標題恢復拖曳，編輯 input 保留 `nodrag`，NodeResizer 可正常調整尺寸。
- **📐 修復舊 Wiki／Link 節點表單尺寸遷移**：載入過小的既有 file/link 節點時自動提升至可容納表單的高度，並強制表單輸入框滿寬，避免 placeholder、按鈕與捲軸錯位。
- **⛶ 編輯中的 Canvas 節點顯示 resize handles**：NodeResizer 現在在節點選取或內容編輯狀態都顯示，Wiki、Link、Group 與一般卡片可直接拖曳邊角調整大小。
- **⌨️ Wiki／外部連結欄位改為失焦自動儲存**：移除多餘的「儲存」按鈕，Enter 儲存、失焦儲存、Escape 取消，縮短表單高度並避免卡片排版溢出。
- **🎯 擴大 Canvas resize 感應區**：resize handles 擴大至 `20px`、邊界感應線加寬至 `4px`；resize 啟動後暫時停用 relation handles，避免拖曳調整大小時被連線操作搶走。

- **📱 修復手機 Canvas 右上角三個浮動按鈕 (Mobile Canvas Floating Actions)**：修正全局 SVG cascade 將 Lucide 圖示縮成 `3px` 的問題；手機按鈕採 `44px` 觸控區、圖示 `20px`，並加入 safe-area 間距與 `v=3.0` 快取版本。

- **🐛 修復 Canvas 關係線、草稿恢復與底部空白區 (Canvas Connection, Draft Recovery & Layout Fixes)**：
  - 恢復 `.canvas-handle` 的 pointer events，四邊 source／target handle 現在可以實際拖曳建立關係線，`onConnect` 會正常寫入 JSON Canvas edge；`CanvasEdge` 會保留 React Flow 解析後的 marker URL，避免 SVG 收到 `[object Object]`。
  - 恢復 `persistence.mjs` 的 `restoreLocalDraft`，重新整理後會從 IndexedDB 載回 `draft`／`pending` Canvas 內容並重新適應視口；若畫面載入後已有新編輯，保留目前編輯狀態。
  - 草稿恢復改走 store subscription 的單一 `input` 儲存路徑，避免重複觸發本機／雲端同步事件。
  - Canvas 靜態 bundle 快取版本升至 `v=2.8`，並固定 React Flow edge layer／SVG drawing surface 為可用 viewport 尺寸；修正 edge path 寬高為 `0px` 導致資料存在但畫面無線的根因。
  - 手機版 fit view 設定最低初始縮放 `0.85x`，保留畫布平移空間並避免卡片角標文字縮小到不可讀。
  - 將 `.canvas-editor-pane` 改為跟隨外層 flex 可用高度（`flex: 1 1 auto; height: 100%; min-height: 0`），移除固定 viewport 高度計算，消除畫布與 Footer 之間的空白區。
  - 新增關係線互動、草稿恢復與畫布高度的回歸測試。

- **🔥 徹底拔除舊版 Canvas 遺留代碼與本機降級開關（Total Elimination of Legacy Canvas Fallback & State Serialization Hardening）**：
  - 徹底刪除 `static/js/canvas-legacy/` 全部目錄與代碼，不再保留任何降級分支或舊架構包袱。
  - 在 `static/js/canvas-editor.jsx` 移除 `mountLegacy`，自動清除瀏覽器殘留之 `CANVAS_EDITOR_VERSION` 本機 localStorage 標記，強制所有存取一律直接進入 Canvas v2，杜絕用戶瀏覽器因舊快取跳回舊架構。
  - 在 `jsonCanvasAdapter.mjs` 修復思考節點類型（`nodeType`）在 JSON Canvas 序列化／反序列化中的遺漏問題，確保 `Detriment`、`Problem`、`Solution` 等思考節點在存檔與重新載入後 100% 維持對應的角標淺底深字高對比樣式，不再誤退回預設或自訂混色。
  - 靜態資產快取穿透版本號全面遞增至 `v=2.3`（`/js/canvas-editor.bundle.mjs?v=2.3` 與 `bundle.css?v=2.3`），確保客戶端即刻載入最新編譯檔案。

- **🐛 修復建立新筆記路由報錯 `Worker Error: initialContent is not defined`（Fixed createNewNote ReferenceError）**：
  - 修復 `src/index.js` 中 `createNewNote(request, editorFormat)` 存取 `/new/canvas`、`/new/block`、`/new/markdown` 時，因未事先宣告 `let initialContent = ''` 導致嚴格模式拋出 uncaught `ReferenceError: initialContent is not defined` 造成 Worker 500 錯誤之重大問題。
  - 為 `/new/canvas`、`/new/block`、`/new/markdown` 與帶有 share 參數的建立流程補齊完整的自動化單元測試（`test/new-note-entry.test.mjs`），確保新建重定向與預設筆記儲存 100% 穩定無誤。

- **👀 徹底修復節點角標文字背景零對比重大瑕疵（Fixed Low-Contrast / Unreadable Node Badges）**：
  - 徹底解決 `FlowNode.jsx` 誤將卡片主色（`colorHex`）賦予 `badgeBg`，導致 `Detriment` 深紅底疊加深紅文字、`Problem` 深紫底疊加深紫文字而無法閱讀之嚴重問題。
  - 重構為預設思考節點一律採用典雅淺色底（`badgeBg` 如 `#ffe4e6`、`#f3e8ff`、`#dcfce7`）搭配深色墨水文字（`textColor` 如 `#9f1239`、`#581c87`、`#14532d`），文字對比度高達 7.4:1～14.2:1（全面通過 WCAG AAA 標準）。
  - 卡片本體預設保持純白（`#ffffff`）搭配 Slate-900 深灰文字（`#0f172a`），徹底杜絕刺眼過飽和與無法閱讀的色彩搭配。

- **🛑 徹底剷除本機草稿覆蓋與髒範本（Clean Document Load & Zero Auto-Overwrite）**：
  - 徹底移除 `canvas-v2/store/persistence.mjs` 與 `canvas-legacy` 中的 `restoreLocalDraft` / `offlineStore` 本機草稿異步覆蓋邏輯。
  - 畫布載入 100% 嚴格以伺服器端 `#contents` 內容為唯一真理（Single Source of Truth），杜絕開啟筆記後被本機 IndexedDB 快取的舊測試卡片（如 `node-welcome`, `node-sticky`）強制覆蓋與跳出「已恢復本機 Canvas 草稿」之問題。
  - `/new/canvas` 堅持純淨空白 `{ nodes: [], edges: [] }`，絕不擅自塞入任何範本。

- **🎯 修復按鈕全黑問題與節點工具列視覺規範化（Fixed Solid Black Buttons in NodeToolbar）**：
  - 解決 `<button>` 在 macOS / 系統深色模式下預設未重設 background/color 導致渲染為實心黑塊遮蔽圖示之問題。
  - 為 `.canvas-btn-icon` 顯式定義 `background: transparent !important`、`color: #64748b !important`，搭配優雅的懸停狀態（`#f1f5f9` / danger `#fee2e2`），在所有系統外觀與主題下保持極致精緻乾淨。

- **🔗 連線實體線條與箭頭完全顯性化（High-Contrast Edge Lines & Dynamic Arrowheads）**：
  - 連線預設筆觸色彩全面提升為高對比深石板灰（`#475569`，2px 寬度，選取時高亮為 2.5px 寶藍 `#2563eb`），在任何畫布底圖上均清晰可見。
  - 解決 `<BaseEdge>` 遺漏 `markerEnd` 導致連線末端箭頭消失之問題；在 `CanvasEdge.jsx`、`jsonCanvasAdapter.mjs` 與 `canvasCommands.mjs` 全面補齊動態 `markerEnd`（`arrowclosed` 封閉式箭頭）。
  - 徹底清除 `DEFAULT_EDGE_LABEL` 的假預設文字（設為空字串 `''`），未輸入標籤且未選取時隱藏中段膠囊，杜絕半空中漂浮無意義膠囊的視覺干擾。

- **🌐 公開分享頁面（Public Share）與格式自動探測修復（Public Share Auto-Detection & Cache Busting）**：
  - 強化 `src/note_meta.js` 與 `src/index.js` 的 `resolveEditorFormat(metadata, content)`，即便 metadata 缺少 `editorFormat` 標記，只要內容為 JSON Canvas（包含 `nodes` 結構），系統即能 100% 精準識別為 `canvas` 格式。
  - `src/templates/base.js` 全面整合 `resolveEditorFormat`，使公開分享路由 `/share/:shareId` 精準掛載唯讀 Canvas 畫布，徹底解決分享頁面掉回原始 Markdown JSON 字串的問題。
  - 為 `/js/canvas-editor.bundle.mjs?v=2.2` 與 `/js/canvas-editor.bundle.css?v=2.2` 加入版本快取穿透參數，確保瀏覽器立即載入最新畫布腳本。
  - 支援 Canvas 的 PDF 向量匯出（`/share/:shareId/export/pdf` 與 `/:path/pdf`），自動轉為結構化 Markdown 進行 Takumi-PDF 高品質排版。

- **🎨 精緻低飽和專業配色全面升級（告別過飽和熒光色，依據 Frontend Design & Impeccable 準則重構）**：
  - **低彩度語意色票 (Low-Chroma Palette)**：全面重構 8 種思考節點（Problem、Benefit、Solution、Cause、Criterion、Detriment、Question、Note）與便籤調色盤，捨棄刺眼高飽和度熒光粉彩，改採低彩度（Low-Chroma）底色搭配深色高對比文字（文字對比度均 ≥ 5.5:1～8:1，徹底通過 WCAG AA/AAA 標準）。
  - **純白雅緻卡片本體 (Refined Card Surface)**：卡片本體預設採用純淨白底與細緻 1px 邊框（`#e2e8f0`），搭配柔和微立體陰影，讓左上角內嵌型角標自然凸顯節點語意，杜絕滿版大面積飽和色彩產生的視覺疲勞。

- **✨ 全面導入 Lucide 向量圖示庫（告別系統 Emoji 與方塊亂碼）**：
  - 整合 `lucide-react`，節點角標（`Puzzle`, `TrendingUp`, `Lightbulb`, `GitFork`, `CheckSquare`, `AlertTriangle`, `HelpCircle`, `FileText`）、卡片頂部工具列（`Copy`, `Trash2`, `Palette`）、置底主工具列（`Plus`, `Undo2`, `Redo2`, `Maximize2`, `FolderDown`）、右上懸浮膠囊（`Languages`, `Volume2`, `BookOpen`）與連線工具列（`Tag`, `SlidersHorizontal`, `Trash2`）全面改採洗鍊的 Lucide SVG 向量圖示。

- **🔌 連線完全可見與雙向四向錨點修復 (Dual Source/Target Handles & Edge Visibility)**：
  - 修復 `NodeHandle.jsx` 先前僅宣告 `type="source"` 導致 React Flow 無法辨識 `target` 錨點座標而產生 `NaN` 路徑使連線隱形的嚴重問題；重構為上、右、下、左四邊均同時掛載相應之 `target` 與 `source` 雙向 Handles，貝茲曲線路徑 100% 穩定呈現。

- **🖱️ 平移拖曳、縮放與編輯行為正常化 (Reliable Drag, Resize & Double-Click Editing)**：
  - 解決卡片單擊時直接觸發 `nodrag textarea` 導致整張卡片無法移動或縮放的嚴重操作問題。單擊卡片立即選取卡片並可任意拖曳、邊緣 8 點可任意縮放；雙擊（或點選編輯按鈕）才進入行內編輯模式，按 Esc 或 Cmd+Enter 即刻儲存。

- **🚫 徹底移除伺服器端強制模板 (Clean Blank Canvas Default)**：
  - 修正 `src/index.js`，新建畫布 `/new/canvas` 一律初始化為純淨空白畫布 (`{ nodes: [], edges: [] }`)，杜絕任何強制注入的歡迎模板或便籤。

- **🛠️ Canvas v2 審查修復與操作性全面強化 (Canvas v2 Code Review Resolution & Usability Hardening)**：
  - **資料同步安全 (Critical 1)**：Store 變更時立即同步寫入 `#contents.value`，消除 300ms 防抖儲存與發布／離頁（`pagehide`、`beforeunload`、`visibilitychange`）競態；Bridge 新增 `flush()` 並與發布、手動儲存全面串接。
  - **100% 格式保真 (Critical 2)**：Adapter 保留未識別之 Root Metadata、Node 自訂屬性、Edge 自訂屬性與完整 `david888` 擴充，round-trip 匯出時精準保留第三方 `.canvas` 資料。
  - **徹底消除強制模板 (User Directive)**：新筆記與空白畫布開啟時一律呈現純淨空白畫布 (`{ nodes: [], edges: [] }`)，不再強制載入歡迎卡片與便籤。
  - **卡片移動與縮放操作修復 (Drag & Resize Fix)**：
    - 移除卡片標題列之 `nodrag` 阻擋，卡片 Header 與邊框即為順暢拖曳移動之把手。
    - 點擊卡片任何區域立即獲得焦點選取，即時喚起 8 方位縮放把手。
    - 拖曳縮放時同步更新卡片 `style.width` 與 `style.height`，不再受靜態尺寸束縛。
    - 縮放納入交易歷史（Undo/Redo），調整卡片尺寸後可無損復原。
  - **清空畫布可復原 (High 6)**：清空畫布改為交易式指令 `clearDocument`，清空後可隨時 Undo 還原全部卡片與連線。
  - **視口中心建立卡片 (High 3)**：由置底工具列新增卡片時，自動計算當前視口中心座標並加入碰撞避讓位移，避免平移視角後卡片落在畫面之外。
  - **連線工具列視口避讓與門戶 (High 2)**：接入 React Flow 原生 `EdgeToolbar` 門戶，並透過 `computeEdgeToolbarPosition` 進行視口邊界與窄螢幕 (320px) 碰撞避讓。
  - **雙向選取單一來源 (Medium 4)**：接入 React Flow `onSelectionChange`，全面統一 Store 與畫布選取狀態。
  - **WCAG 色彩對比度計算 (Medium 5)**：建立 `computeContrastTheme`，依背景相對亮度自動為自訂底色卡片選配高對比文字與次要色彩。
  - **選單無障礙與自動收合 (Medium 6)**：新增選單、檔案選單、連線樣式彈窗皆支援 `role="menu"`／`role="dialog"`、Escape 鍵關閉與點擊外部區域自動收合。
  - **安全性強化 (Medium 7)**：Markdown 預覽 fallback 嚴格經 `DOMPurify.sanitize` 淨化，防止非受信任 HTML 渲染。
  - **依賴規格化 (Medium 2)**：將 `zustand` 提升為 `package.json` 的直接依賴。
  - **平滑回退切換入口 (High 4)**：提供 `?v=legacy` 或 `CANVAS_EDITOR_VERSION=legacy` 運行時降級開關，保留舊版備用。
  - **畫布導航組件 (High 5)**：加入 React Flow `Controls` 與 `MiniMap`，支援鍵盤 Backspace/Delete 刪除選取項目。

- **🚀 Canvas v2 整體架構升級 (Canvas v2 Complete Architecture & Ameliorate Port)**：
  - **開源架構整體替換**：以成熟開源工具思考專案 **Ameliorate** (`0cacee5577438979b651dd808793c4cbd13864ee`，MIT License，作者 Joel Keyser) 為基準，整體替換 Canvas UI 與互動層，新增 `THIRD_PARTY_NOTICES.md` 完整保留版權與許可聲明。
  - **模組化目錄分層 (`static/js/canvas-v2/`)**：
    - `model/`：`jsonCanvasAdapter.mjs` 提供與 JSON Canvas 1.0 的嚴格資料邊界轉換，支援所有節點與連線樣式 round-trip；`canvasCommands.mjs`、`canvasHistory.mjs` 提供交易式 command 與單步 Undo/Redo 歷史機制；`canvasTypes.mjs` 規範標準尺寸與調色盤。
    - `store/`：`createCanvasStore.mjs` 基於 Zustand 建構分離的 document、selection、viewport、history 與 persistence slices；`selectors.mjs` 實現極簡選擇器；`persistence.mjs` 串接 `#contents`、離線草稿自動恢復與自動防抖儲存。
    - `components/Node/`：`FlowNode.jsx` 作為通用節點外殼（Handles、縮放邊框、選取狀態），專門子組件負責各類型內容：`MarkdownNode`、`StickyNode`、`WikiNode`、`LinkNode`、`GroupNode`；選取時顯示緊湊垂直/水平動作工具列 `NodeToolbar`。
    - `components/Edge/`：`CanvasEdge.jsx` 提供 smoothstep 路徑與 20px 隱形感應軌道；`EdgeLabel.jsx` 支援原地行內文字編輯；選取時呈現 `EdgeToolbar` 與彈出式線條設定面板 `EdgeStylePopover`（實線/虛線/點線、細/中/粗、箭頭方向與顏色）。
    - `components/Toolbar/`：`MainToolbar.jsx` 提供置底緊湊工具列，包含新增選單 (`AddMenu`)、復原/重做、視圖置中 (`fitView`) 與檔案選單 (`FileMenu`，支援 `.canvas` 匯入、匯出與清空畫布)。
  - **樣式完全隔離 (Isolated Stylesheet)**：從全域 `editor.css.js` 中抽離近千行畫布樣式，集中維護於 `static/js/canvas-v2/canvas-v2.css` 與語意化 `tokens.css`，隨 bundle 自動打包為 `canvas-editor.bundle.css`，零污染核心筆記佈局並完備深淺色主題適配。

- **🧭 Canvas 對齊 React Flow Showcase 互動基準 (Showcase-Aligned Canvas Surface)**：採用官方 Feature Overview 的水平 Controls、25px dotted Background、MiniMap 圓角、snap-to-grid、fitView padding、無限 zoom 與右上 attribution 設定；Canvas toolbar、工作區、暗色配色、focus state 與 EdgeToolbar 改成低干擾的官方範例風格。

- **🧱 Canvas 改用 React Flow UI anatomy 與可見連線點 (React Flow UI Anatomy & Visible Handles)**：Canvas 節點改採共用 `BaseNode`、`BaseNodeHeader`、`BaseNodeHeaderTitle`、`BaseNodeContent`、`BaseNodeFooter` 與 `BaseHandle` 結構；關係線工具列接入 React Flow 原生 `EdgeToolbar`。四邊連接點恢復為可見 12px handles，保留 Loose connection 與 JSON Canvas `fromSide`／`toSide` 資料格式；未引入 Tailwind／shadcn 全域依賴，避免影響既有編輯器。

- **🎨 Canvas 畫布視覺架構全面現代化與發布同步修復 (Canvas Card Modernization, Zero-Chrome Polish & Robust Publish Sync)**：
  - **徹底移除卡片擬窗頂欄 (Zero Header Blank Space)**：消除卡片頂部「📄 筆記卡片」與「📌」視窗標題列及分割線，釋放 100% 空間給筆記正文；操作統一集中於選取時的浮動工具列（NodeToolbar）與卡片右上角懸停無佔位按鈕（`canvas-card-hover-actions`），零留白浪費，全面對齊 React Flow、Obsidian Canvas、Miro 與 FigJam 的簡約現代風格。
  - **真正實心色塊填滿 (Solid Card Color Blocks)**：解決點擊色彩只改框線的痛點，調色盤現在會直接為卡片鋪設舒適飽滿的實心色塊（紅、橙、黃、綠、藍、紫及自訂色彩），並自動計算深淺色主題對應的高對比文字與邊框色。
  - **統一遍歷卡片字體與縮距 (Harmonized Scoped Typography)**：卡片內 `.markdown-body` 標題重構為精緻的 15.5px / 14.5px / 14px，徹底移除厚重的底部分割線與大邊距，將段落與清單外距緊縮至 6px，編輯框與預覽模式具備完全相同的 13.5px 與 1.45 行距，根除文字忽大忽小與卡片非必要捲軸。
  - **四邊連線錨點智能淡入 (Subtle Connection Handles)**：靜態時四邊錨點維持隱形或極致低調，滑鼠靠近卡片或選取時平滑淡入並放大，大幅降低畫布視覺雜訊。
  - **修復發布分享頁內容遺失 Bug (Publish Desynchronization Fix)**：放寬 Wiki 筆記與外部連結節點在尚未填寫時的空白校驗，前端載入時加入安全降級恢復機制（Relaxed Recovery），徹底解決因單一節點暫無內容導致分享頁 (`/share/...`) 拋錯並回退為 2 張預設歡迎卡片的問題。

- **🧭 Canvas 儲存、發布、復原與視覺一致性修正 (Canvas Persistence, Publish, Undo & Visual Consistency)**：修正本機草稿重新整理後回到預設模板，以及發布頁沒有使用目前畫布內容的問題；Canvas 現在會恢復 `draft`／`pending` 本機 JSON、發布前驗證完整 JSON Canvas，並在設定路由再次驗證 Canvas 文件。新增 Undo／Redo 歷史控制，補齊暗色節點與工具列樣式，統一卡片字級與間距、提高自訂色彩底色可見度，並讓英文入口使用英文預設模板。

- **🛠️ Canvas 編輯控制補全與複製卡片修正 (Complete Canvas Editing Controls & Duplicate Fix)**：EdgeToolbar 改為獨立的箭頭方向、線條樣式、線寬、色彩與文字控制；NodeToolbar 擴充至連結／群組節點並加入原生自訂色彩選擇器；複製卡片改用可保留 callback 的資料複製方式，修正 `structuredClone` 造成的 `DataCloneError`。

- **🎨 Canvas 畫布完整互動升級：NodeToolbar、EdgeToolbar、調色盤與雙向箭頭樣式控制 (Full Interactive Toolbars, Palettes & Edge Styling)**：
  - **節點浮動工具列 (`NodeToolbar`)**：
    - 選取 Markdown 卡片、便籤或 Wiki 引用時自動在節點上方彈出浮動工具列。
    - **Obsidian 規範色彩調色盤**：提供 6 款 Obsidian Canvas 標準色票（紅、橙、黃、綠、藍、紫）與預設色，卡片支援即時色彩更換並於 JSON Canvas 雙向儲存。
    - **便籤調色盤**：支援鵝黃、薄荷綠、天空藍、櫻花粉、淺紫、蜜橙 6 款便籤即時切換。
    - **卡片快捷操作**：新增一鍵「📋 複製卡片 (Duplicate)」與「✕ 刪除卡片 (Delete)」。
  - **關係線浮動工具列 (`CanvasCustomEdge` & `EdgeLabelRenderer`)**：
    - **關係文字編輯**：點擊關係線或標籤即可原地開啟輸入框編輯、修改或清除 Label，支援 Enter 儲存與 Esc 取消。
    - **箭頭方向 4 態循環切換**：無箭頭 (`none`)、終點箭頭 (`──►`)、起點箭頭 (`◄──`)、雙向箭頭 (`◄─►`)，不再寫死終點箭頭，完整保留 `fromEnd` 與 `toEnd`。
    - **線條樣式切換**：支援實線 (Solid)、虛線 (Dashed)、點線 (Dotted) (`strokeDasharray`)。
    - **線條粗細切換**：細 (1.5px)、中 (2.5px)、粗 (4px) 快速循環切換。
    - **線條顏色調色盤**：提供 6 款主題色彩（經典藍、石板灰、翡翠綠、琥珀黃、玫瑰紅、神秘紫）即時染色。
    - **刪除關係線**：工具列提供一鍵刪除連線按鈕。
  - **JSON Canvas 格式保真**：
    - 完整讀取並儲存 `fromEnd`、`toEnd`、`color`、`label`，擴充樣式（線條樣式、線寬）保存於 `david888` 擴充物件，絕不硬編碼 `toEnd: 'arrow'`。

- **🐛 Canvas 畫布資料安全、互通性與連線修正 (Canvas Data Safety, Interoperability & Connection Fixes)**：
  - 將建立選單名稱統一為「Canvas 畫布」／`Canvas`；Canvas 工具列處理 `.canvas` 匯入與匯出，底欄「匯入內容」則保留 Markdown、音訊、網址與 Office 文件匯入，並沿用既有 Markdown 筆記匯入流程。
  - 修正空畫布保存後重新開啟會回填歡迎卡片的資料遺失問題；顯式 `{ "nodes": [], "edges": [] }` 現在會完整保留。
  - 改用 JSON Canvas 1.0 的標準 text、file、link、group 與 edge 核心；便籤使用可忽略的 `david888.cardType` extension，舊版 `sticky` 節點會自動遷移。匯入時驗證節點／edge ID、座標、尺寸、關聯、URL 與數量上限，拒絕無效或危險資料。
  - React Flow 改為四邊皆可起訖的 Loose handles，強化關係線與連接中的顏色、粗細與可點擊範圍；重複關係線會顯示提示。外部連結與群組節點可安全顯示並 round-trip 保存。
  - Canvas 的一般瀏覽器儲存路徑、API 路徑與離線快取均正確驗證／標記 `canvas` 格式；Canvas 頁不再載入 Markdown toolbar，修正 `setRecordingUi is not defined` console error；bot-accessible content 改提供 Markdown 文字投影而非原始 JSON。
  - 同步更新 README 雙語、編輯器提示、`llms.txt`、`llms-full.txt` 與 Agent Skill，並新增 Canvas 回歸測試。

- **🎨 全新無限畫布編輯模式 (Infinite Canvas Editor Mode with JSON Canvas & React Flow)**：
  - **第三種原生筆記模式 (`editorFormat: 'canvas'`)**：與現有的 Markdown 模式、Block 筆記模式並列，專為 2D 空間思維、卡片盒筆記（Zettelkasten）與視覺化知識庫設計。在底欄「＋ 新增」選單點擊「Canvas 畫布」或存取 `/new/canvas` 即可立刻建立。
  - **開源 JSON Canvas 規範 (`jsoncanvas.org`) 核心相容**：
    - 底層儲存採用開放標準 JSON Canvas 核心結構；DAVID888 視覺語意以可忽略的 extension 保存。
    - 支援一鍵匯出 `.canvas` 檔案供 Obsidian 或其它相容畫布工具開啟，亦支援由瀏覽器本機直接匯入 `.canvas` 檔案並自動轉換為畫布節點。
  - **輕量高效的 React Flow 畫布內核**：
    - 基於 `@xyflow/react`，以純 HTML/DOM 與 SVG 渲染，獨立代碼分割打包為 `canvas-editor.bundle.mjs` (僅 ~380 KB)，零干擾既有 Markdown / BlockNote 載入效能。
    - **Markdown 卡片節點 (Note Card)**：雙擊原地切換為 Markdown 編輯框，失焦或按 `Cmd+Enter` 立即渲染為美觀排版，支援調整卡片寬高、刪除與四邊錨點連線。
    - **彩色靈感便籤節點 (Sticky Note)**：提供黃、綠、藍、粉、紫五種經典配色，支援縮放與隨手雙擊記事。
    - **Wiki 筆記引用節點 (Wiki Note Link)**：可快速連結本站現有筆記路徑（如 `/note/...`）並一鍵跳轉。
    - **平滑連線與箭頭 (Smoothstep Edges with Markers)**：拖曳卡片四邊圓點即可拉出帶有箭頭的關係線，卡片移動時連線自動即時重算路徑。
  - **編輯模式與唯讀瀏覽模式分離 (`isEdit`)**：
    - 編輯模式 (`/edit/:note`) 提供浮動工具列（新增卡片、靈感便籤、Wiki 引用、匯出/匯入），節點位置拖曳與邊緣連線即時自動儲存 (Autosave) 至 Cloudflare D1/KV。
    - 唯讀分享模式 (`/share/...` 或檢視模式) 鎖定節點位置防止手滑誤觸，隱藏編輯按鈕，同時保留自由平移（Pan）、縮放（Zoom）與卡片超連結點擊跳轉。

## [2026-09-16]

- **💵 智慧貨幣金額符號保護與 KaTeX 數學公式衝突防護 (Smart Currency Dollar Protection & KaTeX Math Collision Prevention)**：
  - **根除金額誤判為公式問題**：解決在筆記或帳單中出現多個美元／貨幣符號（如 `- **8 月帳單 ($10.00)** ：為 8 月份滿 31 天的用量結算 (每日 $0.32 × 31天)。`）時，因 `remark-math` / KaTeX 單字元 `$` 匹配導致兩個金額符號之間的文字被誤判為 LaTeX 數學公式、進而吞掉 `**` 粗體閉合標記並彈出「已複製公式（自動判斷）」的長期痛點。
  - **智慧貨幣偵測演算法 (`protectCurrencyDollarSigns`)**：
    - 自動辨識以單 `$` 開頭之金額、千分位、小數、單位（如 `$10.00`、`$3.87`、`$0.32`、`$1,000`、`$50/mo`、`$10 - $20`、`NT$100`、`US$50`、`約 $500 萬`）。
    - 依據 Pandoc / CommonMark 規範嚴格校驗：若閉合 `$` 後緊跟數字（如 `$0.32`），或公式內容包含 CJK 中文字元、Markdown 語法（`**`、`__`）與行末空白，一律精準辨識為貨幣文字而非數學公式。
    - 在 Markdown 渲染前自動施加標準轉義（`\$`），由 CommonMark 乾淨輸出原生文字與完整保留粗體 `<strong>`。
  - **嚴格保留真實 LaTeX 數學公式與程式碼區塊**：
    - 真實行內公式（如 `$E = mc^2$`、`$10$`、`$1 + 1 = 2$`、`$10 < x < 20$`、`$10 \le x$`）與區塊公式（`$$...$$`）100% 完整保留。
    - 行內程式碼（`` `$10.00` ``）與 Fenced Code Blocks 內部一律不予更動。
  - **全鏈路同步支援**：
    - 前端預覽與分享頁（`markdown-extensions.mjs` -> `window.renderMarkdown`）
    - 簡報模式（`base.js` Slidev 簡報引擎）
    - 離線工作台（`offline_page.js` PWA 模式）
    - 邊緣端無狀態處理器與 PDF 導出服務（`markdown-processor.mjs` -> `renderMarkdownToHtml`）

## [2026-09-14]

- **🛡️ OCR 客戶端動態載入防護與錯誤提示修正 (Dynamic OCR Import Fallback & Error Dialog Fix)**：在編輯器執行圖片文字辨識或表格辨識時，加入 `ensureOcrClient` 動態載入防護，若 `<script type="module">` 尚未執行完畢，自動即時補齊載入 `/js/ocr-client.mjs`，根除「OCR 模組尚未載入」的時序競爭錯誤；同時修正錯誤對話框，非上傳之辨識錯誤正確顯示「辨識失敗」而非「上傳失敗」。
- **📐 純前端二維幾何表格重構演算法與後端平滑容錯 (Local-First 2D Geometric Table Reconstruction with Server Fallback)**：
  - **純前端本地優先**：移植 2D 幾何拓撲重構演算法（`reconstructTableFromOcrBoxes`），利用 PP-OCRv6 檢測出的邊界框座標，於瀏覽器端本地透過垂直行分群（Row Clustering）、行內字塊微距融合（Inline Merging）與欄邊界中心線投影聚類（Column Clustering），直接計算二維矩陣並即時輸出標準 GFM Markdown Table。
  - **零伺服器成本與隱私保障**：桌面端或支援 WebGPU 的瀏覽器辨識表格時，100% 於本機 Web Worker 幾毫秒內運算完成，無需上傳圖片至任何外部伺服器。
  - **後端安全 Fallback**：若處於手機端、瀏覽器 WebGPU/WASM 記憶體限制、模型載入失敗或未偵測出二維網格結構，自動平滑降級至後端表格 OCR 端點（`TABLE_OCR_ENDPOINTS`），兼顧極致效能與跨設備穩定兜底。
- **⏳ OCR 模型下載狀態提示 (OCR Model Loading Status)**：首次選擇本機 OCR 時，畫面會顯示「正在下載 OCR 模型與執行元件（首次使用）」的持續狀態提示；模型已初始化後則改顯示本機辨識中，避免使用者誤以為貼圖流程沒有反應。
- **🐛 修正 OCR Worker 執行檔遺漏導致辨識失敗 (Fix Missing OCR Worker Asset)**：部署 bundle 時同步發佈官方 PaddleOCR.js 的版本化 `worker-entry-*.js` runtime，修復選擇「OCR 轉文字」後顯示泛化錯誤的問題；另外將 Worker、WebGPU 與模型下載失敗分類為可操作的錯誤提示。
- **📊 圖片後端表格 OCR 與 BlockNote 表格插入 (Server Table OCR & BlockNote Table Import)**：圖片處理選單新增「辨識表格（後端）」；前端以 `?mode=table` 呼叫三層 OCR fallback，優先採用 `data.tableMarkdown`，只保留連續 GFM table 後插入 Markdown 或 BlockNote，避免圖片網址與編輯器 Footer 雜訊進入文章。此選項會將圖片送至後端表格辨識服務，與不上傳圖片的本機 OCR 明確區分。
- **🤖 LLM Discovery 同步 OCR 能力 (LLM Discovery OCR Documentation)**：`/llms.txt`、`/llms-full.txt` 與靜態 fallback 文件同步列出圖片貼上後的本機 PP-OCRv6、WebGPU 優先／WASM fallback 與圖片留在裝置上的隱私行為。
- **🖼️ 貼圖後 Upload / 本地 OCR 選擇與 PP-OCRv6 WebGPU 加速 (Paste Image Actions & Local OCR)**：Markdown 與 Block 編輯器貼上圖片或拖曳圖片時，新增雙語處理視窗，可選擇上傳至 R2、使用瀏覽器本地 OCR 或取消；本地 OCR 使用官方 `@paddleocr/paddleocr-js` 的 PP-OCRv6 中文模型，透過 ONNX Runtime Web 自動優先 WebGPU，無法使用時回退 WASM，辨識結果依圖片幾何座標排序後插入文字區塊，圖片不會因選擇 OCR 而上傳。
  - OCR runtime 採延遲載入，模型只在第一次選擇「OCR 轉文字」時載入；圖片輸入沿用 10MB 限制，Upload 與 OCR 均不信任副檔名並保留既有 MIME 驗證。
  - Block 編輯器支援將 OCR 文字插入目前游標區塊，或將上傳後圖片插入 `davidEmbed` 圖片區塊；所有選項支援繁體中文／英文、Escape、Tab focus trap、深色／淺色主題與行動版排版。
- **🐛 修復剪貼簿表格貼上 ReferenceError (Fix Clipboard Table Paste ReferenceError)**：補上選取範圍後半段 `after` 文字的計算，Excel、Google Sheets 與網頁表格貼上流程不再因未宣告變數而中斷。

## [2026-09-02]

- **🛡️ 系統全方位安全弱點修補與全面架構強化 (Comprehensive Full-Repo Security Hardening & Vulnerability Remediation)**：
  - **Stored & DOM XSS 徹底防堵 (VULN-01 & VULN-02)**：
    - 伺服端範本全面轉義：在 `src/templates/base.js` 中對 `<article id="bot-accessible-content">`、`<textarea id="contents">` 以及 `APP_STATE` 內嵌 JSON 實施全域 HTML/Unicode 轉義（包含 `<` 轉為 `\u003c`），杜絕 Textarea 與 Script 標籤逃逸。
    - 客戶端圖表嚴格模式與 DOMPurify 淨化：將 Mermaid 圖表初始化 `securityLevel` 鎖定為 `'strict'`，並對 Mermaid 與 Graphviz (`@hpcc-js/wasm`) 渲染後輸出的所有動態 SVG 元素套用 `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })`，徹底消除圖表層級之 DOM XSS。
  - **密碼授權與存取控制修復 (VULN-03)**：
    - 修正 `src/password_policy.mjs` 中的 `resolvePasswordRole` 提權漏洞，確保在僅設置閱讀鎖（`vpw`）時驗證通過一律授予唯讀 `'view'` 角色，不再錯誤提升為編輯者（`'edit'`）。
  - **MCP 本地工具安全防護 (VULN-04 & VULN-14)**：
    - `mcp/server.py` 限制 `upload_image` 僅允許標準圖片副檔名（`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.avif`）並強制 10MB 檔案大小上限，防止本機敏感檔案任意讀取外洩。
    - `src/mcp_server.mjs` 加入 JSON-RPC 2.0 Batch 請求數量限制（最多 20 筆），防範 Worker 記憶體與 CPU 耗盡 DoS。
  - **後台管理者 Session 與 Token 密碼學強化 (VULN-06, VULN-09 & VULN-10)**：
    - 廢止 `admin_session` 明文密碼 Cookie，全面改用密碼學簽署之 Admin JWT，並配置 `HttpOnly`、`Secure` 與 `SameSite=Strict` 標籤。
    - 筆記存取 JWT 權杖全面加入標準 `exp` 過期宣告（預設 7 天），防止權杖無限期重放。
    - 密碼驗證實作常數時間字串比對 (`constantTimeStringCompare`)，杜絕時序側信道攻擊。
  - **D1 SQLite 自我修復與排程 Cron 資料一致性 (VULN-07 & VULN-08)**：
    - 修復 `src/storage_driver.mjs` 中 `driverQueryShare` 欄位名稱錯誤（`notes.name` 修正為 `notes.path`），恢復 D1 分享記錄自動修復能力。
    - 重構 `deleteEmptyPages()` 清理邏輯：改調用 `driverDeleteNote()` 同步刪除 D1 與 KV 資料，並加入密碼保護檢查，僅刪除字元數為 0 且無密碼保護之空白頁，杜絕正當簡短筆記遭誤刪。
  - **R2 上傳與 PDF 匯出深度防禦 (VULN-11, VULN-12, VULN-13 & VULN-15)**：
    - `/upload` 與 `/api/upload` 新增 MIME 白名單與 10MB 上限校驗；隨機字串生成升級為 CSPRNG (`crypto.getRandomValues`)。
    - `src/pdf_service.mjs` 轉義 PDF 標題與網站 URL，並過濾 `Content-Disposition` 標頭換行與引號注入。
    - 支援透過 API 明確傳送 `share: false` 進行文章下架，並修復後台儲存未發布文章時暫存內容保留邏輯。
    - 全新增加 `test/security-fixes.test.mjs` 涵蓋全部 15 項安全回歸測試，全套 402 項自動化測試通過率 100%。

- **🔢 Markdown 編輯器行號支援超長段落自動折行高度精準同步 (Dynamic Line Numbers Alignment for Soft-Wrapped Lines in Markdown Editor)**：
  - **自動折行高度鏡像計算 (DOM Mirror Line Height Measurement)**：徹底解決長文字或中英文段落因寬度不足而在 `<textarea>` 中自動折行時，行號欄（Line Numbers Gutter）僅按邏輯行單行固定高度排列導致行號與內容錯位、以及超出邏輯行數後下方行號空白的問題。
  - **鏡像元素動態排版 (Offscreen Typography Mirror)**：透過同步字型（`--editor-font-family`、`font-size`、`line-height`、`word-break`、`overflow-wrap`）與可用寬度（`clientWidth - padding`）的鏡像元素，即時精準量測每個段落折行後的實際像素高度，為每一邏輯行號設置自適應高度區塊，使行號永遠與段落第一行精準水平對齊。
  - **全場景響應式同步與滾動對齊 (Responsive Resize & Scroll Sync)**：整合 `ResizeObserver`、視窗縮放 (`resize`)、字型載入 (`document.fonts.ready`)、主題切換及雙欄拖曳分割線事件，在任何寬度變化時瞬間重算行高；垂直滾動時保持 1:1 像素級精準同步，完美契合底欄游標行號指示。

## [2026-08-31]

- **🎨 下拉選單間距與互動表面視覺精修 (Dropdown Rhythm & Full-Row Interaction Polish)**：重新調整雙行選單項目的上下節奏與標題／副標間距，並讓 hover 與鍵盤 focus 高亮完整覆蓋整列，修復匯出選單上下擁擠及背景留白不一致的問題；維持現有主題變數、操作結構與無障礙焦點狀態。
- **🧭 全面盤點 Edit / Share / Block Edit 下拉選單 (Dropdown Surface Audit)**：修正 Web Awesome 原生按鈕固定高度與 flex shrink 把雙行 rich item 壓扁、裁切副標的根因；統一 New、Share、Export、Copy、Theme、Width 的 spacing、group card 邊界、hover/focus 表面與長選單 viewport 滾動行為。
- **🐛 清理分享選單副標贅詞 (Remove Redundant Share Menu Subtitles)**：保留「複製分享連結」、「複製簡報連結」與「複製書本連結」標題，將副標改為單純說明「閱讀頁面網址」、「簡報播放網址」與「書本閱讀網址」，避免同一個「複製」動作在兩行重複出現；英文文案與操作行為維持不變。

## [2026-08-30]

- **🎨 Block 區塊模式預設純白極簡 Ayu Light 主題 (Default Clean White 'ayu-light' Theme for Block Editor)**：
  - **白底極簡視覺一致性**：由於 Block 區塊編輯器為單欄 WYSIWYG 結構化編輯器，將 Block 筆記預設樣式鎖定為乾淨溫暖的白色 `ayu-light`（Ayu Light）。
  - **全鏈路預設對齊**：新建立 Block 筆記（`/new/block`）、閱讀分享頁（`/share/:id`）、PDF 向量匯出與 2x 高畫質長圖生成時，Block 格式均預設採用極簡純白 `ayu-light` 排版，免除隨機深色樣式與區塊畫布不協調的問題。

- **🌐 Block 區塊編輯器繁體中文／英文雙語全面在地化 (Full Bilingual zh-TW / en-US for Block Editor)**：
  - **動態語系偵測與字典切換 (Dynamic BlockNote Dictionary)**：根據全站語言設定（`zh-TW` 或 `en-US`）自動注入完整繁體中文字典 `ZH_TW_DICTIONARY`，支援即時切換。
  - **繁體中文斜線指令選單 (Localized Slash Menu)**：斜線選單全面在地化，包括「一級標題 (Heading 1)」、「二級標題」、「三級標題」、「引用」、「摺疊清單 (Toggle List)」、「編號清單」、「項目清單 (圓點)」、「待辦清單 (Checklist)」、「段落內文」、「程式碼區塊」、「表格」、「圖片」、「影片」、「音訊」、「檔案附件」與「表情符號 (Emoji)」等，並支援中文／英文關鍵字快速搜尋與別名匹配。
  - **嵌入設定視窗與工具列在地化 (Localized Embed Dialog & Formatting Toolbars)**：YouTube、PDF 文件、附件連結、Mermaid 流程圖、ECharts 圖表、HTML 原始碼之設定視窗與格式化工具列提示文字全面支援繁體中文與英文雙語切換。

- **☑️ Block 區塊編輯器待辦清單與大綱模式強化 (Enhanced Checklist & Outliner for Block Editor)**：
  - **中英雙語斜線指令 (Bilingual Slash Commands)**：在 Block 編輯器中輸入 `/todo`、`/task`、`/checklist`、`/check`、`/待辦`、`/清單`、`/核取方塊` 或 `/勾選`，可秒速插入或轉換為待辦清單區塊；亦同步強化 `/bullet`、`/大綱`、`/項目清單` 與 `/number`、`/編號清單`。
  - **精緻互動樣式 (Interactive Checklist Aesthetics)**：勾選完成時提供平滑刪除線、文字淡化（`opacity: 0.55`）與主題強調色方塊，支援 `Tab` / `Shift+Tab` 無限層級縮排，完美呈現 Workflowy / Notion 風格大綱待辦體驗。

- **🐛 修復 Block 編輯器錄音完成插入雙重音訊播放器問題 (Fix Duplicate Audio Player Insertion in Block Editor)**：
  - 移除 `insertLocalRecordedAudio` 中重複調用的 `__insertBlockEditorMarkdown`，確保 Block 模式錄音完成後精準插入單一音訊播放卡片，並依序追加 Whisper 轉錄段落區塊。

- **💡 小訣竅雙欄平行展示至右側預覽區 (Move Editor Tips to Right Preview Pane & Parallel Typewriter Welcome)**：
  - **右側預覽獨立展示小訣竅 (`#preview-welcome`)**：在 Markdown 模式建立新筆記或空白筆記時，左側編輯區專注展示《飛鳥集》詩句（`#editor-welcome`），右側預覽區則獨立呈現隨機精選實用技巧（`#preview-welcome`）。
  - **平行打字機動畫 (Parallel Typewriter Effect)**：詩句與小訣竅在各自的窗格中平行展開打字機流暢動畫，充份利用寬螢幕雙欄空間，視覺清爽平衡。
  - **智慧同步隱藏**：作者在左側編輯區輸入任何字元時，左右兩側的歡迎區塊立即同步淡出隱藏，無縫切換至即時 Markdown 預覽。

- **🎙️ Block 區塊編輯器即時錄音與語音轉逐字稿 (Live Voice Recording & Transcription for Block Editor)**：
  - **斜線指令 (`/`) 整合**：在 Block 區塊編輯器輸入 `/record`、`/voice`、`/audio`、`/mic`、`/錄音`、`/語音` 或 `/即時錄音`，可一鍵開啟麥克風即時錄音。
  - **底欄「＋ 新增」選單直覺操作**：在 Block 模式的底欄「＋ 新增」選單中新增「🎙️ 即時錄音」項目，點擊即可開啟錄音控制列。
  - **靈動島懸浮錄音控制器 (Dynamic Island HUD)**：錄音時展開沉浸式懸浮控制列，提供即時計時、音波動畫、隨時暫停／繼續、完成插入與取消放棄功能，支援全域快捷鍵 `Cmd+Shift+R` / `Ctrl+Shift+R`。
  - **自動轉錄與區塊插入 (Whisper AI Transcription & Audio Block)**：錄音完成後自動於游標處插入音訊播放卡片（`davidEmbed` kind `audio` / `<audio controls>`），並透過後端 Whisper AI 自動將語音轉錄為結構化區塊內容，追加於音訊區塊下方。
  - **完整生命週期與渲染支援**：在 `block_document.mjs`、`blocknote_document.mjs`、`block_renderer.mjs` 與 `blocknote-editor.jsx` 中全線支援 `audio` 區塊之 Tiptap 互轉、HTML 渲染與 Markdown 導出。

## [2026-08-28]

- **👑 AI Agent Skill 大標題強制規範與強健標題解析 (Mandatory `# Title` Rule & Robust Title Extraction)**：
  - **Skill 規格全面升級**：於 `skills/SKILL.md` 與 `.agent/skills/david888-wiki-publisher/SKILL.md` 新增核心規則，強制要求所有 AI Agent 與 LLM 生成 Markdown 文檔時，**第一行必須直接以一級標題 `# Document Title` 開始**。
  - **嚴禁前置廢話與小作文**：明文規範 AI 禁止在 `# Title` 前輸出寒暄招呼、前言說明（如「好的，這是為您整理的...」、「Certainly! Here is...」），亦不可將 `[TOC]` 或提示區塊置於 `# Title` 之前，避免文章 HTML `<title>`、Open Graph 社交預覽卡片與 Sitemap 標題損毀。
  - **強健標題提取器 (`extractContentTitle`)**：後端與客戶端全面升級標題提取邏輯，自動略過 `[TOC]`、`> [!NOTE]` 警示區塊、分隔線與常見寒暄前綴，永遠優先匹配最高權重的 `# Heading` (H1/H2) 作為文章標題。

- **⚡ 編輯器即時動態標題同步 (Real-time Dynamic Document Title Synchronization)**：
  - 在編輯器中實裝 `syncRealtimeDocumentTitle`，作者於 Textarea 或區塊編輯器輸入或修改 `# 標題` 時，瀏覽器分頁標籤（`<title>`）與全域應用程式狀態（`APP_STATE.title`）**在每次輸入瞬間即時同步更新**，徹底告別必須重新整理頁面（Reload）標題才會生效的問題。

## [2026-08-27]

- **🎨 分享與發布選單介面卡片化分組重構 (Card-Grouped Share & Publish Dropdown Redesign)**：
  - **清晰分格與卡片底色 (Card Grouping & Surface Separation)**：
    - 將發布選單全面重構為清晰的卡片分組結構（`.dropdown-group-card`），明確劃分「檢視閱讀模式」、「快速複製連結」、「分享設定」與「危險操作」四大區塊。
    - 採用獨立表面底色（`var(--modal-surface)`）與高對比圓角外框（`border-radius: 8px`），各區塊一目了然，徹底解決以往條目擠成一團、界線模糊的問題。
  - **解決行高與排版擁擠痛點 (Eliminate Cramped Vertical Spacing)**：
    - 徹底重構 `<button>` 與 `<a>` 項目之彈性盒排版（Flexbox）、邊距與行高（`line-height: 1.35`），給予圖示、標題與副標題充裕的間距（Padding & Gap）。
    - 懸停（Hover）背景與文字高亮平滑過渡，全面適配 20 款深淺主題（Dark Mode 下使用深 slate 表面底色與高對比文字）。

- **✨ 全站彈出視窗架構標準化與生命週期統一 (Unified Modal Dialog Architecture & Design System)**：
  - **CSS 變數與卡片風格完全統一 (Design System & Theme Convergence)**：
    - 全面收斂所有彈窗（`.share-modal`, `.embed-modal`, `.url-import-modal`, `#cite-modal`, `#math-format-modal`, `.password-modal`, `.note-history-modal`, `.app-dialog-modal`, `.file-drop-modal`）之卡片與遮罩樣式。
    - 徹底移除舊版寫死白色 `#ffffff` 的硬編碼樣式，全面採用 `--modal-bg`, `--modal-border`, `--modal-text`, `--modal-surface`, `--modal-accent` 等標準色彩變數族，100% 完美適配全站 20 款深淺主題（Tokyo Night, Dracula, Claude Canvas 等）。
    - 遮罩層全面引入現代毛玻璃質感（`backdrop-filter: blur(4px)`），卡片邊角統一為 12px 圓角與立體陰影。
  - **淘汰原生對話框，收斂至網頁標準彈窗 (Eliminate Native `window.confirm` & `window.prompt`)**：
    - 將錄音轉錄授權確認（`markdown-toolbar.mjs`）、AI 翻譯目標語言與雙語對照確認（`base.js`）、註釋留言刪除確認（`share-annotations.mjs`）、簡報跳轉頁碼等原先調用原生瀏覽器白色對話框的孤島，全面升級為統一非阻塞的 `window.showAppDialog` 與 `window.showAppPrompt` 網頁風格彈窗，支援深色背景與鍵盤無障礙操作。
  - **生命週期與事件委派統一 (`openModal` / `closeModal` & Data Attributes)**：
    - 將各功能獨立修改 `style.display = 'flex'` / `'block'` 的孤島開關收斂至全域 `openModal(modal, { initialFocus, trigger, onEscape })` 與 `closeModal(modal)` 管理。
    - 內建**全域 Escape 鍵快速關閉**、**Tab / Shift+Tab 雙向焦點循環鎖定 (Focus Trap)**、**點擊遮罩關閉** 與 **關閉後原觸發元件焦點復原 (Focus Restoration)**。
    - 支援 `data-modal-close` 統一屬性，點擊遮罩或任何帶有此屬性的關閉按鈕皆能自動執行關閉與狀態清理。
  - **無障礙關閉按鈕與符號標準化 (Accessible Close Buttons & ARIA)**：
    - 統一採用具備 `aria-label` 的標準 `<button type="button" class="close-btn ...">×</button>`，替換舊版英文字母 `x` 與純文字 `<span>`。
    - 健全所有彈窗之 `role="dialog"` / `role="alertdialog"`、`aria-modal="true"` 與 `aria-hidden` 動態同步。

## [2026-08-26]

- **🐛 修復 AI 編輯與整理時 ReferenceError: normalizeTranslationTargetLanguage 異常 (Fix AI Assistant Policy Module Imports in Worker Entry)**：
  - 修復 `src/index.js` 缺少 `ai_assistant_policy.mjs` 模組引入，導致在編輯器中選取文字調用「AI 編輯」（如「要求整理成表格」）或「排版」時擲出 `Worker Error: normalizeTranslationTargetLanguage is not defined (HTTP 500)` 的問題。
  - 補齊 `src/index.js` 完整引入 `normalizeTranslationTargetLanguage`、`AI_FORMAT_SYSTEM_PROMPT`、`buildAiUserPrompt`、`buildTranslationSystemPrompt`、`preservesFormatLanguage` 等模組，並健全 Node.js ESM 相對路徑與新增完整端點單元測試。

- **📄 Takumi-PDF 原生向量 PDF 直接導出引擎 (Native Vector PDF Export via Takumi-PDF WebAssembly)**：
  - **Chromium-Free 原生向量排版**：全面整合 Rust/Wasm 驅動的 `takumi-pdf` 向量渲染引擎，無須啟動肥大耗能的 Chromium / Puppeteer，在 Cloudflare Workers 邊緣運算環境即可以毫秒級高速將 Markdown/HTML 直接編譯為高解析度、可全選複製 (Selectable & Searchable) 的多頁向量 PDF。
  - **一鍵直接下載免預覽列印 (Direct Download without Print Dialog)**：
    - 編輯模式匯出選單中，原先需跳出瀏覽器列印視窗的「另存 PDF」正式升級為「🚀 直接導出 PDF (.pdf)」，點擊直接串流下載 `.pdf` 檔案。
    - 保留「🖨️ 瀏覽器列印預覽 (Print)」作為雙軌備援選項，滿足實體紙本列印需求。
  - **自動字型子集與 Emoji 支援 (Google Fonts Subset & Twemoji)**：
    - 整合 `@takumi-rs/helpers` 自動載入 `Noto Sans TC`（繁體中文）、`JetBrains Mono`（程式碼等寬字型）與 `Inter` 字型子集，完美支援繁簡中文、日韓文及特殊符號。
    - 內建 `twemoji` 向量圖示轉譯，文章中所有 Emoji（🎉🚀✅ 等）皆能清晰向量化輸出，零亂碼零破圖。
  - **智慧頁首頁尾與分頁控制 (Headers, Footers & Page Counters)**：
    - 自動注入文檔標題與品牌頁首，以及包含頁碼計數器（`<span class="pageNumber"></span> / <span class="totalPages"></span>`）的頁尾。
  - **Mermaid 向量架構圖與流程圖完美轉譯 (Mermaid Diagram Vector Rendering via SVG)**：
    - **雙軌向量編譯**：編輯器匯出時主動擷取客戶端渲染之向量 Mermaid `<svg>`；若為無狀態 API / Headless / 後端調用，系統自動透過 `convertMermaidBlocksToSvg` 異步將 Mermaid 代碼區塊（`<pre><code class="language-mermaid">`）轉譯為原生向量 `<svg>` 嵌入 PDF，徹底解決 Mermaid 只顯示原始文字碼的問題。
    - **向量圖形與排版保護**：Mermaid 向量圖形居中展示，並預設套用 `break-inside: avoid` 防止跨頁截斷。
  - **電子書手冊 (Book Mode) 全書 PDF 編譯**：Book Mode (`/share/:shareId/book`) 匯出選單支援直接將全書所有章節編譯為一本完整的 PDF 電子書手冊。
  - **REST API 與 MCP Server 工具端點支援**：
    - `POST /api/pdf/export` 與 `POST /api/markdown/pdf`：無狀態 Markdown / HTML 轉 PDF 導出端點（支援 `html` 與 `markdown` 雙模式）。
    - `GET /:path/export/pdf` 與 `GET /share/:shareId/export/pdf`：筆記與分享連結專屬直接下載端點（支援 View Lock 密碼驗證）。
    - MCP Server 工具 `export_pdf`：AI Agent 可直接調用產出 PDF 檔案與下載連結。

- **🎙️ 錄音即時狀態提醒懸浮膠囊 (Dynamic Island Recording HUD) 旗艦視覺重構 ＆ 頂部工具列極簡淨化**：
  - **Dynamic Island 旗艦懸浮膠囊 (`.editor-recording-hud`)**：
    - 採用現代毛玻璃（`backdrop-filter: blur(20px) saturate(180%)`）與動態島微互動設計，錄音時從頂部優雅滑下。
    - **左側狀態指示**：具備呼吸脈衝光暈紅點、4 柱均衡聲波動畫、狀態標籤（`錄音中` / `已暫停`）與等寬計時器（`00:00`）。
    - **右側現代 SVG 設計按鈕**：
      - **⏸️ / ▶️ 圓形懸浮控制鈕 (`.hud-btn-pause`)**：內嵌純向量 SVG 圖示，暫停時切換為琥珀色光暈與繼續圖示。
      - **⏹️ 「完成」膠囊主按鈕 (`.hud-btn-stop`)**：高對比漸層紅色膠囊（`linear-gradient`）搭配向量勾選圖示，一鍵結束並插入筆記。
      - **✕ 圓形幽靈取消鈕 (`.hud-btn-cancel`)**：懸停淡紅警示，一鍵乾淨釋放麥克風並丟棄音訊。
  - **頂部 Markdown 工具列極簡化**：移除工具列多餘的常駐暫停按鈕，只保留最純粹的 `🎙️` 錄音按鈕；所有暫停、繼續、停止與取消操作一律收斂至頂部 Dynamic Island 懸浮膠囊。
  - **音訊切片與停止可靠度優化 (250ms Chunking & Reliable Audio Finalization)**：
    - 將 MediaRecorder 時間切片由 1000ms 精密提升至 250ms，並在調用 `stop()` 前主動執行 `requestData()`，徹底解決短時間錄音停止後音訊 buffer 未 flush 導致 IndexedDB 無法寫入與 ASR 轉錄中斷的問題。
    - 支援 Safari (`audio/mp4`) 與 Chrome/Firefox (`audio/webm`) 自動副檔名相容。
  - **離線工作站完全同步**：離線雙欄工作區 (`/_pwa-offline`) 同步升級至 Dynamic Island Recording HUD 與 250ms 精準切片。
- **🎙️ Local-First 本機離線錄音、連線即時 ASR 辨識與發布延遲 S3 雲端同步架構 (Local-First Offline Recording, Online ASR & Deferred S3 Upload upon Publish)**：
  - **二階段完全解耦架構 (Decoupled ASR Transcription & S3 Cloud Upload)**：
    - **第一階段（錄音與 ASR 轉錄）**：錄音結束後音訊 Blob **僅保存於本機 IndexedDB (`CloudNotepadOfflineDB` -> `audios`)**，游標處插入本機播放器 `<audio data-offline-audio-id="rec_..." src="blob:..."></audio>`。有網路時立即發起 Whisper ASR 轉錄將逐字稿補插入播放器下方，**完全不上傳音檔至 S3 / 888box**，避免浪費雲端儲存空間與頻寬。
    - **第二階段（發布 / 儲存雲端時才上傳 S3）**：只有在使用者點擊「發布筆記 (`publishCurrentNote`)」或「儲存至雲端 (`saveCurrentNote`)」時，系統才會自動提取 IndexedDB 音訊 Blob 上傳至 888box / S3 取得永久 HTTPS 網址，並將文章中的本機標籤精確替換為正式 S3 網址後送出，狀態列切換為 `☁️ 雲端已同步`。
  - **本機播放器自動重載復原 (`restoreLocalAudioBlobs`)**：未發布前若重新整理頁面，系統自動依 `data-offline-audio-id` 從 IndexedDB 動態重建本機 Object URL，確保離線草稿隨時皆能即時播放。
  - **離線工作站 (`/_pwa-offline`) 錄音工具列支援**：離線雙欄工作站頂部工具列同步新增 `🎙️` 錄音按鈕，支援完整離線麥克風錄音、即時 ASR 逐字稿與筆記同步時 S3 自動補推。
- **🔀 Share 分享模式「編輯此篇 / 新增筆記」分割複合膠囊鈕 (Share Mode Split Action Capsule)**：
  - **複合操作膠囊 (`.split-action-group`)**：在 Share 閱讀模式底欄左側，將原先孤立分散的「返回編輯」按鈕與「＋ 新增選單」合併為現代化的分割膠囊按鈕（Split Pill Button）。
  - **直覺左側主動作 (`.split-action-main`)**：左側為「`✏️ 編輯`」主按鈕，具備密碼鎖自動鑑權相容，一鍵快速進入或解鎖編輯模式。
  - **右側展開延伸選單 (`.split-action-dropdown`)**：右側為精緻的「`＋ ▾`」下拉觸發鈕，點擊展開選單並於首項提供「`✏️ 編輯目前這篇筆記`」，並完整保留新增 Markdown、新增 Block、語音轉文字、文件匯入等強大擴充功能，大幅精簡底欄橫向版面空間。
- **🌐 編輯器偏好選擇彈窗「即時雙語切換」支援 (Interactive En/中 Language Switcher in Editor Preference Modal)**：
  - **彈窗頂部語言切換膠囊 (`.editor-preference-lang-group`)**：在「選擇你的編輯方式 (`EDITOR_PREFERENCE_MODAL`)」彈窗右上角新增「`中 / En`」即時語系切換按鈕。
  - **零跳轉即時多語系渲染**：無論設備或瀏覽器語系自動偵測為何，外籍使用者可在彈窗內一鍵切換至英文，標題、說明文案、Markdown/Block 卡片介紹、徽章、按鈕與確認勾選框即刻動態轉為流暢英文，並同步持久化使用者語系偏好至 `localStorage`。

## [2026-08-25]

- **🎙️ Markdown 工具列錄音、音檔保存與時間戳逐字稿 (Toolbar Recording, Audio Retention & Timestamped Transcript)**：在 Markdown Edit 模式頂部新增麥克風控制，可開始、暫停、繼續與停止錄音；停止後會將 WebM 音檔上傳至 888box、插入原生 `<audio>` 播放器並沿用既有 Whisper 多層備援產生時間戳逐字稿。錄音前要求確認參與者同意，且前後端均限制音檔為 25 MB。

- **📱 書本模式行動版離線 HTML 匯出修復 (Mobile Book Standalone HTML Export Fix)**：修正單一離線 HTML 電子書的內嵌 `</script>` 未正確跳脫，造成瀏覽器提早結束書本頁面的用戶端腳本、將後續 JavaScript 顯示成本文文字的問題；行動版匯出選單現在可正常下載 `.html` 電子書。

- **🧭 Share 分享模式「最近分享紀錄」功能支援與底欄暗黑模式按鈕歸類整合 (Share Mode Recent Shares Access & Appearance Bar Dark Mode Realignment)**：
  - **Share 模式開放「最近分享紀錄」(`share-history-btn`)**：將過往僅限於 Edit 模式編輯器底欄的「最近分享紀錄」按鈕同步開放至 Share 公開分享頁面底欄工具列。讀者與作者可隨時於分享頁面一鍵喚起彈窗，在「我分享的 (Created)」與「我看過的 (Viewed)」切換瀏覽並快速複製跳轉其他筆記，提升閱讀流暢度。
  - **暗黑深淺切換按鈕回歸「外觀設定區」 (`footer-section-appearance`)**：將原先置於底欄資訊區 (`footer-section-info`) 中間、混雜於 App 安裝與 Skill/API 開發者連結間的「深淺模式切換按鈕 (`ui-theme-toggle-btn`)」移至「外觀設定區」，與 Markdown 20 種主題下拉選單、字體切換與語系按鈕緊密歸類，徹底釐清資訊架構。
- **💬 劃線註解視覺層次重構與卡片化關係連結 (Annotation Card Hierarchy & Quoted Passage UI Redesign)**：
  - **討論串卡片化獨立容器 (Independent Thread Card Container)**：將每個段落討論串重構為具備獨立圓角外框（`border-radius: 14px`）、陰影層次（`box-shadow`）與微浮 Hover 效果的獨立卡片容器，解決過往多則討論串僅以一條淡線分隔、界線模糊鬆散的問題。
  - **「📌 圈選原文」引用專區與快捷膠囊 (Quoted Passage Callout Box & Pill Actions)**：卡片頂部明確劃分「📌 圈選原文」標籤，內嵌高亮引用盒（`border-left: 3.5px solid var(--annotation-accent)`），並將「🎯 定位原文」與「🔗 複製連結」重構為精緻的 Pill 膠囊按鈕，讓讀者一眼明瞭留言所對應的內文摘錄。
  - **討論留言分隔與頭像識別 (Discussion Divider & Author Avatars)**：原文與留言之間引入「💬 討論留言 (N)」視覺分隔軸線，每則留言卡片化並附帶作者縮寫圓形頭像徽章（Avatar Badge）、發布時間與獨立刪除管理按鈕，清晰建立「圈選原文 ➔ 討論串」的上下游歸屬關係。
  - **多主題無縫適配 (Full Theme Adaptive CSS Variables)**：支援全部 20 種明暗主題，深色模式（Dark / Tokyo Night / Dracula 等）自動切換最適文字對比、卡片底色與柔和外框。
  - **連續劃線與平滑捲動健全 (Consecutive Annotations & Smooth Scroll)**：修復連續劃線後按鈕隱藏失效問題，圈選新段落隨選隨標，留言編輯框自動平滑捲動至視窗範圍內。
- **⚡ PWA 離線模式即時 Markdown-to-HTML 預覽、格式工具列與樣式健全 (Offline PWA Markdown-to-HTML Live Preview, Toolbar & Typography Hardening)**：
  - **修復離線預覽無法渲染問題 (UMD Script Loading & DOMPurify Sanitization)**：修復過往在離線工作區 (`/_pwa-offline`) 中以 `<script type="module">` 載入 `marked.min.js` 與 `purify.min.js` 導致全域物件在部分瀏覽器環境下未綁定至 `window` 的問題。改採正規同步腳本載入，並配置 `marked.setOptions({ gfm: true, breaks: true })` 與 `DOMPurify` 安全白名單防禦 XSS。
  - **完整 Markdown CSS 排版注入 (`getMarkdownCss`)**：離線頁面樣式表整合注入 `${getMarkdownCss()}` 與 `--editor-font-family`，預覽容器配置 `.markdown-body`，確保 GitHub Alerts (`[!NOTE]`, `[!WARNING]`)、多欄版面配置 (`:::columns`)、行內螢光筆 (`==mark==`)、自訂顏色文字 (`{red}(text)`)、Pandoc 引用文獻 (`[@key]`)、代碼區塊高亮與自適應表格在離線環境下排版與線上 100% 一致。
  - **離線 Markdown 格式工具列 (Offline Markdown Toolbar)**：在離線編輯器頂部新增格式工具列，支援粗體、斜體、刪除線、螢光筆、H1-H3 標題、引用區塊、行內/區塊代碼、清單、待辦項目、表格、超連結、圖片、GitHub Alert 提示框與雙欄佈局快捷按鈕，並支援鍵盤快捷鍵（`Cmd+B`、`Cmd+I`、`Cmd+K`、`Tab` 4 格縮排）。
  - **雙向捲動同步 (Scroll Synchronization)**：在雙欄對照模式（`mode-split`）下，編輯器輸入區與即時預覽區域實現即時等比例捲動同步。
  - **獨立 HTML 網頁單鍵匯出 (`⭳ 導出 HTML`)**：頂部控制列新增「⭳ 導出 HTML」按鈕，可將目前離線筆記內容連同完整內嵌 CSS 樣式封裝為獨立 `.html` 檔案下載，收件者免連網用任何瀏覽器即可直接閱讀。
  - **Service Worker CDN 智慧快取 (Dynamic CDN Cache Intercept)**：升級 `static/sw.js` 至 `v6`，並為外部 CDN 依賴（`esm.sh`、`cdn.jsdelivr.net`、`cdnjs.cloudflare.com`）配置 Stale-While-Revalidate 動態快取層，確保線上使用過的 Unified / KaTeX / Mermaid / ECharts 組件在斷網後可持續離線運作。
  - **線上編輯器離線備援 (Online Editor Offline Resiliency)**：在 `base.js` 的 `window.renderMarkdown` 加入 Unified processor 例外捕捉與 marked 自動備援降級機制。

## [2026-08-24]

- **📖 書本模式 (Book Mode) 全面升級：PWA 一鍵離線整本預抓與多格式匯出 (Book Mode PWA Offline Pre-caching & Multi-Format Export)**：
  - **📥 一鍵離線下載整本書 (Offline Book Pre-caching)**：在 `/share/:id/book` 頂部新增「📥 離線快取」按鈕，一鍵並行預抓目錄中所有章節的 HTML/Markdown 內文與 R2 圖片至 Cache Storage，並即時顯示快取進度（`快取中 3/12...` ➔ `🟢 已離線快取`），在飛行模式或斷網環境下依然能流暢切換整本手冊。
  - **📤 三合一電子書匯出選單 (Multi-Format Book Export Menu)**：
    1. **📄 合併 Markdown (.md)**：自動聚合全書目錄、前言與所有章節為單一完整的 `.full.md` 檔案，最適合知識庫備份與餵給 LLM 分析。
    2. **🌐 單一離線 HTML 電子書 (.html)**：將整本書的雙欄樹狀目錄結構、全章節內文與 CSS 樣式封裝為單一 HTML 檔案，收件者無需安裝任何軟體或連網，用任何瀏覽器雙擊即可開啟 0 秒切換章節的完整電子書。
    3. **🖨️ 全書整合式列印 / 匯出 PDF (.pdf)**：將所有章節依序排版並加入 `@media print` 分頁中斷符號（`page-break-after: always`），一鍵呼叫列印生成精美 PDF 手冊。
  - **📱 閱讀進度記憶與行動端滑動手勢 (Reading State & Touch Gestures)**：透過 `localStorage` 自動記憶讀者上次閱讀的章節索引，重新開啟書本時自動回到該章；在行動裝置上支援左右滑動手勢（Swipe Left / Right）快速翻章。
- **⚡ PWA 離線模式、衝突可視化比對、效能與無障礙全面健全 (Full-Featured PWA Offline Workstation, Conflict Diff & Code Review Hardening)**：
  - **Service Worker v5 智慧快取與 LRU 圖片庫 (Stale-While-Revalidate & Image Cache Eviction)**：全面升級 static/sw.js 至 v5，新增 david888-wiki-images-v1 專屬圖片快取庫，具備 LRU 60 項上限自動淘汰與精確子域名驗證，自動快取 R2 圖床（s3.wiki.david888.com）與外鏈多媒體；核心 Markdown 渲染管道（marked、purify、toolbar、extensions）預先快取，斷網環境下圖文筆記零破圖。
  - **精確版本衝突比對與無障礙 Diff 彈窗 (Exact Diff & Accessible Conflict Modal)**：
    - **精確正規化比對 (Exact Line-Normalized Diff)**：取代寬鬆的 trim() 比較，精確比對段落結構、縮排與換行。
    - **請求量最佳化 (Zero Redundant GET)**：一般打字自動存檔直發 POST，僅在同步離線 pending 草稿、手動同步或連線重連時進行衝突檢查，大幅節省雲端請求。
    - **健全無障礙與鍵盤導航 (ARIA & Keyboard Nav)**：配置 role="dialog"、aria-modal="true"、aria-labelledby、圖示 aria-hidden 與 Escape 鍵快速關閉。
    - **切換筆記防競態 (Debounce Cleanup)**：在切換載入筆記時即刻清理計時器，杜絕跨筆記覆蓋風險。
  - **Background Sync 雙向完整整合 (Service Worker SyncManager Registration)**：在離線儲存與網路重連時主動向瀏覽器註冊 sync-pending-notes 標籤，確保即使關閉分頁也能在恢復連線時由系統背景自動完成同步。
  - **高效單次交易批次讀取 (store.getAll())**：重構 offline-store.mjs 中的 getAllNotes()，由過去 N+1 逐筆查詢改採原生 IndexedDB store.getAll() 單次交易，大幅提升大筆記量下的搜尋與備份效能。
  - **全新雙欄 Markdown 離線工作站 (/_pwa-offline)**：提供「✏️ 編輯 / 🌗 雙欄 / 👁️ 預覽」模式切換、Dark/Light/Tokyo Night/Dracula/Nord 主題切換、即時搜尋過濾、筆記管理與一鍵 JSON 備份/匯入。
  - **PWA Manifest 現代能力擴充與跨裝置檔案關聯 (File Handling API & Android WebAPK Intent)**：支援桌面與 Android 將 .md, .markdown, .mdown, .mkd, .txt 檔案直接關聯至 david888 wiki 開啟編輯；整合 Web Share Target 與桌面 Window Controls Overlay。
  - **完整 HTML 轉義安全性 (XSS Hardening)**：完善 escapeHtml 包含單引號與反引號轉義，確保範本字串與屬性值安全。
  - **混合儲存庫模組 (offline-store.mjs) 能力擴充**：新增 searchNotes、getAllNotes、getPendingSyncNotes、clearAllNotes、exportBackupJson 與 importBackupJson，並健全 Node.js / 無存儲私密瀏覽下的 Memory Fallback 備援。

## [2026-08-23]

- **🎙️ 語音辨識升級：原生時間戳記標記 (`[mm:ss]`) 與自動段落排版 (Whisper Timestamps & Paragraph Segmentation)**：
  - **原生時間標記分段 (Native Timestamp Parsing & Segmentation)**：升級 Groq STT 請求格式為 `verbose_json`，並全面解析 Cloudflare Workers AI Whisper (`@cf/openai/whisper-large-v3-turbo`) 回傳之 WebVTT 字幕流，提取精確至毫秒的語音時間區間與文字片段。
  - **結構化 Markdown 段落排版 (Timestamped Paragraph Formatting)**：解決過往純逐字稿字元全部黏在一起、難以閱讀的痛點。現在「匯入音訊（逐字稿）」會依據 Whisper 語音停頓與時間戳記自動分段，輸出格式如 `**[00:15]** 段落文字內容`，每段獨立換行，兼顧 Markdown 預覽與 BlockNote 區塊編輯器的完美排版。
  - **智慧排版同步受惠 (Smart Layout Timestamps Optimization)**：「匯入音訊（智慧排版）」亦獲得時間結構化的分段輸入，讓 LLM（`gpt-oss-120b` / `gpt-oss-20b`）在整理摘要、行動清單與主題標題時更能精確定位時間脈絡。
  - **模組化架構與完整測試 (Modular Audio Transcribe & Test Coverage)**：獨立抽離 `src/audio_transcribe.mjs` 工具模組，完整覆蓋 WebVTT 解析、標籤清理、秒數時間戳轉換與超長音訊（`[hh:mm:ss]`）單元測試。
- **📂 編輯器音訊檔案拖曳三合一分流彈窗 (Audio Drag & Drop Tri-Action Modal with Verbatim Default)**：
  - **補齊純逐字稿選項並設為預設 (Default Verbatim Transcript Option)**：拖曳音訊進編輯器時，彈窗與左下角選單用語 100% 嚴格一致，提供三合一選項：
    1. **🎙️ 匯入音訊（逐字稿）**（**高亮焦點預設**）：直接轉錄為帶有 `[mm:ss]` 時間戳記的純逐字稿段落。
    2. **✨ 匯入音訊（智慧排版）**：轉錄後由 LLM 整理大綱、重點與 Markdown 結構。
    3. **☁️ 上傳至 888box 嵌入播放器**：直傳 888box 並在游標處插入 `<audio controls>`。
- **🔌 WebMCP 瀏覽器端標準化升級 (Chrome 150+ WebMCP Standard Support)**：
  - **支援 `document.modelContext.registerTool`**：對齊 Google Chrome 官方 WebMCP Imperative API 標準，改用 `document.modelContext.registerTool` 逐一註冊網頁工具（`read-current-markdown`, `copy-share-link`, `open-presentation`），並向下相容早期草案 `navigator.modelContext.provideContext`。
  - **相容 Model Context Tool Inspector 擴充功能**：完美相容 Chrome 官方 Inspector 擴充功能，在開啟 `chrome://flags/#enable-webmcp-testing` 後可即時偵測、手動執行並透過 Gemini 呼叫瀏覽器網頁工具。
- **🔗 MCP / WebMCP 文章發布與分享映射自動修復 (MCP Share Mapping & Self-Healing Query)**：
  - **跨模組 ShareSlug / ShareId 雙向對齊**：解決過去透過 MCP / WebMCP (`write_note` / `append_note`) 建立或寫入文章時，因 `shareSlug` 與 `shareId` 鍵值不同步導致編輯頁面分享連結點擊 404 的問題。現在 MCP 伺服器會自動同步註冊 `shareSlug`、`shareId` 以及 `MD5(path)` 多重路由別名至資料庫。
  - **D1 分享查詢自我修復 (Self-Healing Share Query Fallback)**：`driverQueryShare` 於 `shares` 表未命中時，會自動比對 `notes` 表的 `shareSlug` / `shareId` / `path`，並在查詢成功的同時即時自動補齊寫入 `shares` 表，徹底杜絕任何分享頁面 404 斷鏈情況。
- **📚 AI Agent 多文章串聯電子書工作流升級 (Multi-Article Book Orchestration SOP for LLMs)**：
  - **系統化 4 步驟電子書編排 SOP (Standard 4-Step Book SOP)**：在 `SKILL.md`（Section G）與 `LLM_API_DOCS.md`（Section 3.2）中新增完整的多篇串書 SOP 指南，指導 LLM 遵循「1. 章節規劃大綱 ➔ 2. 獨立撰寫發布各章篇章取得 `shareUrl` ➔ 3. 建立總目錄 Manifest 文章 ➔ 4. 交付 `/book` 電子書閱讀連結給使用者」。
  - **支援巢狀章節與簡報混排 (Nested Chapters & Presentation Mixing)**：完整說明二格縮排的子章節語法（`- [子章節](/share/id)`），以及在電子書章節中混排 2D 簡報（`/share/id/present`）的無縫內嵌閱讀支援。
  - **自動化代碼與技能文檔同步**：執行 `generate-agent-skill.mjs`，同步更新 `src/generated/agent-skill.generated.mjs`、`src/generated/api-docs.generated.mjs` 與 `.agent/skills/` 目錄。
- **🤖 WebMCP 與 MCP 原生技能引導升級 (Native MCP Skill Guide Tool & Prompt Discovery)**：
  - **新增 `get_authoring_skill_guide` 工具**：於原生 Worker MCP 服務器新增 `get_authoring_skill_guide` 端點，LLM 在進行多文章編排、簡報撰寫或排版時可直接一鍵取得完整的 `SKILL.md` 規範與 SOP，無須額外發起 Shell / cURL 查詢。
  - **WebMCP 瀏覽器端工具擴充**：於前台 `document.modelContext` 擴充註冊 `get-authoring-skill-guide` 與 `open-book` 瀏覽器工具，主動向 Chrome 150+ Inspector 與 AI Agent 暴露正規的 Skill 存取指引。
  - **Tool 描述主動提示 SOP 查閱**：在 `write_note` 工具描述與服務器 Description 中明確提示：「如需進行多章節串書 (Book Orchestration SOP)、2D 簡報 (---/--) 或 KaTeX/主題排版，請呼叫 `get_authoring_skill_guide` 或讀取 `SKILL.md`」。

## [2026-08-21]

- **📝 註腳跳轉修復、目錄過濾與 Skill 註腳功能全面推廣 (Footnote Navigation Fix, TOC Filter & Academic Footnotes Promotion)**：
  - **修復註腳跳轉致頁面空白 Bug (Footnote Anchor & Blank Page Fix)**：修復點擊註腳或錨點時，因 `scrollToLocationHash` 抓取到 remark-gfm 自動產生的隱藏 `h2.sr-only#footnote-label` 且計算 viewport 捲動偏移量重複相加，導致視窗捲動超出範圍變為一片空白的嚴重問題。現在自動解包 `.sr-only` 元素指向可見的 `.footnotes` 容器，並優化 `parentRect` 捲動偏移計算。
  - **目錄樹剔除輔助無障礙標題 (TOC Hidden Heading Filtering)**：`renderTableOfContents` 與 `decorateHeadingAnchors` 全面過濾 `.sr-only`、`.visually-hidden`、`aria-hidden="true"` 以及 `.footnotes` 內部的隱藏標題，確保自動目錄 (`[TOC]`) 不再被 remark 隱藏標題污染。
  - **註腳容器樣式與錨點邊距 (Footnotes CSS & Target Scroll-Margin)**：為 `.footnotes` 與 `[data-footnotes]` 補齊現代化頂部分隔線、內邊距與文字尺寸，並為 `li:target`、`[id^="fn-"]`、`[id^="fnref-"]` 統一配置 `scroll-margin-top: 24px`，確保平滑跳轉定位精準不遮擋。
  - **Skill 與 API 文檔鼓勵 LLM 積極使用註腳 (Promote Academic Footnotes in Skills & Docs)**：於 `SKILL.md`、`LLM_API_DOCS.md` 與 `README.md` 中新增專屬章節「H.3 學術參考文獻與註腳指南 (`[^1]` 與 `^[inline]`)」，明確指導並鼓勵 AI Agent / LLM 在引用外部倉庫、論文、工具連結或附加說明時，積極採用標準註腳與 Pandoc 行內註腳，搭配前端毛玻璃懸浮卡片與雙向平滑跳轉。
- **📂 Markdown 編輯器多格式拖曳上傳與轉檔分流彈窗 (Drag & Drop File Import with Smart Action Modal)**：
  - **PDF 文件拖曳 (PDF Drag & Drop)**：拖曳 PDF 檔案進 Markdown 編輯區時，跳出智慧處理彈窗，提供 **📑 AnyDocs 本地轉檔為 Markdown 內文** 與 **☁️ 上傳至 888box (`box.david888.com`) 作為附件連結** 雙選項，滿足深度內文解析或檔案下載分享的不同需求。
  - **音訊檔案拖曳 (Audio Drag & Drop)**：拖曳 MP3/WAV/M4A/AAC/FLAC 音訊進編輯器時，彈窗提供 **✨ AI (Whisper) 智慧轉錄逐字稿與排版** 與 **☁️ 上傳至 888box 嵌入 `<audio controls>` 播放器** 雙選項。
  - **圖片直接上傳 (Image Direct Upload)**：拖曳 PNG/JPG/WebP/GIF/SVG 圖片直傳 Cloudflare R2，自動在游標處插入 `![alt](url)`。
  - **Office 文件拖曳 (Office Docs Drag & Drop)**：拖曳 Word (DOCX)、PowerPoint (PPTX)、Excel (XLSX)、EPUB 等文件時，提供 AnyDocs 本地 WASM 解析轉為 Markdown 內文或上傳至 888box 附件。
  - **純文字 / Markdown 拖曳 (.md / .txt)**：拖曳 Markdown 或文字檔案自動讀取並提示插入於游標處或整篇替換。
  - **視覺化拖曳回饋 (Dropzone Overlay)**：編輯器外框加入拖曳懸浮時的虛線高亮邊框與自適應毛玻璃背景反饋 (`.is-dragover`)。
- **🔑 管理員 Touch ID / FIDO2 指紋生物辨識一鍵登入 (Admin Touch ID & WebAuthn / FIDO2 Passkey Login)**：
  - **一鍵指紋登入 (Touch ID Quick Login)**：登入頁面新增「🔑 使用 Touch ID / 指紋一鍵登入」按鈕，透過 WebAuthn / FIDO2 ECDSA P-256 現代非對稱加密簽名進行無密碼身分驗證，登入秒速完成。
  - **後台裝置綁定與管理 (Passkey Device Management)**：管理員登入後台後可隨時為當前設備（MacBook Touch ID、iPhone Face ID、Windows Hello 或 FIDO2 安全金鑰）命名並綁定，支援隨時查看已綁定設備清單與一鍵移除。
  - **全原生 Web Crypto 驗證 (Native Zero-Dependency Workers Crypto)**：後端完全基於 Cloudflare Workers 原生 Web Crypto API (`crypto.subtle`) 與 DER/P1363 簽名轉碼器，具備抗重放 Challenge 與防篡改驗證機制，並保留傳統密碼登入作為安全備援。
- **🎨 全面深色模式適配：版本紀錄、最近分享彈窗與本機已存狀態標籤 (Comprehensive Dark Mode for Note History, Recent Shares & Autosave Badge)**：
  - **本機已存文字對比修正 (Autosave Badge High Contrast)**：修復深色模式下 Footer 工具列「本機已存 / Saved locally」狀態文字因遺漏 `--toolbar-fg` 變數而回退至黑色字體的問題，現在統一綁定 `--toolbar-fg: #ffffff`，提供清晰舒適的高對比辨識度。
  - **版本紀錄視窗深色主題 (Version History Modal Dark Mode)**：完整重構 `.note-history-content`、版本清單 (`.note-history-entry`)、預覽面板 (`.note-history-viewer`)、渲染切換按鈕與 Markdown 歷史差異比對區塊，深色模式下採用現代 Slate 深藍冷色系背景 (`#1e293b` / `#0f172a`) 與高對比字體、邊框與代碼塊樣式，徹底揮別刺眼白底。
  - **最近分享彈窗深色主題 (Recent Shares Modal Dark Mode)**：為「最近分享紀錄」彈窗（包含「我分享的 / 我看過的」切換頁籤、分享連結清單與複製按鈕）全面適配深色模式與自適應主題變數。
- **📐 編輯器行號區塊緊湊化與自適應寬度重構 (Adaptive & Compact Editor Line Number Gutter)**：
  - **動態位數自適應 (Dynamic Digits Auto-Sizing)**：取消過去固定 42px 寬度導致 1~99 行短篇筆記左側空白過大、喧賓奪主的問題；改採動態位數計算（`--editor-gutter-digits`），1~99 行超緊湊縮減至 ~26px–28px，隨著文章行數突破百行、千行、萬行平滑動態擴展寬度，完美兼顧簡潔與大篇幅擴充性。
  - **細緻化字體與視覺層級 (Subtle & Clean Typography)**：行號字體大小微調為 13px 輔助字號（色彩改採柔和的 `#6272a4`），行高精確綁定編輯器行高（`25.6px`），確保每一行行號與 Textarea 內容 100% 垂直像素對齊，不再搶奪文章內文視覺焦點。
  - **編輯區邊距最佳化 (Optimized Textarea Padding)**：Textarea 左側內距從 30px 收縮至 14px，大幅節省左側非必要邊距（總體左邊距從 72px 縮減至 42px），提供更加寬闊通透的寫作體驗；`editor-welcome` 歡迎畫面亦自動對齊動態 Gutter 寬度保持完美置中。

## [2026-08-20]

- **⚡ Skill 文檔強化即時更新提醒 (Mandatory Freshness & Continuous Feature Evolution)**：
  - 在 `SKILL.md` 頂部新增重要提示區塊（`[!IMPORTANT]`），明確提醒所有調用此 Skill 的 LLM / AI Agent 由於系統持續高速迭代並加入各類新功能（如多欄位排版、`[TOC]`、簡報 2D 矩陣、Mermaid 複製列等），**每次任務執行前務必先重新拉取最新的線上 `SKILL.md`**，以獲取最新語法支援與最佳實踐。
- **📖 Skill 文檔全面擴充：二欄/三欄論文式版面與 `[TOC]` 自動目錄指南 (Skill Docs Multi-Column & [TOC] Support)**：
  - **二欄／三欄論文版面指南 (Multi-Column Layout Guide)**：在 `SKILL.md` 與 `LLM_API_DOCS.md` 中詳細補充 `<div class="two-column-layout">` 與 `<div class="three-column-layout">` 語法規範與範例，指導 AI Agent 在產出學術論文、架構比較、特色摘要或雙語對照時優先採用多欄位橫向排版（行動端自動轉單欄）。
  - **自動目錄語法推廣 (`[TOC]` Table of Contents Directive)**：於 Skill 文檔中明確鼓勵 LLM 在長篇分析報告、技術規範與章節文章的大標題下方主動插入 `[TOC]`，自動生成深層巢狀平滑跳轉目錄，提升閱讀體驗。
- **🖥️ 編輯器預覽裝置預設固定為桌面視圖 (Default Desktop Preview)**：
  - 取消新筆記隨機挑選桌面或手機預覽的機制，全域預設固定以 PC 桌面視圖（100% 全寬度）開啟編輯器，免除每次開新筆記隨機跳至手機窄版的困擾，仍可透過 Footer 控制列隨時自由手動切換。
- **📊 Mermaid 與圖表懸浮工具列與一鍵複製/下載 (Mermaid & Diagram Copy Actions Toolbar)**：
  - **四合一懸浮快捷操作列 (Four-in-One Floating Toolbar)**：所有渲染後的 Mermaid 流程圖、循序圖、架構圖以及 Flowchart、Sequence、Graphviz、ABC 樂譜、ECharts 圖表容器右上角自動掛載毛玻璃懸浮工具列，支援滑鼠懸停與觸控裝置自適應。
  - **🖼️ 一鍵複製 PNG 圖片 (Copy PNG Image)**：使用 2x 超高解析度 Canvas/SVG 點陣化技術，一鍵將 Mermaid 圖表轉為清晰透明背景 PNG 並直接寫入系統剪貼簿（支援 `navigator.clipboard.write([new ClipboardItem])`），可直接貼入 Slack、Notion、PowerPoint、Word 或各類通訊軟體；在剪貼簿不支援直接寫入圖片的環境下自動安全回退為一鍵下載 PNG。
  - **📋 一鍵複製原始碼 (Copy Source Text)**：秒速複製 Mermaid 原始 Markdown 語法代碼。
  - **📐 一鍵複製 SVG 向量圖 (Copy SVG Vector)**：一鍵複製乾淨的向量 XML 原始碼，可直接貼入 Figma、Illustrator 或前端代碼庫。
  - **💾 一鍵下載 PNG (Download PNG)**：提供快速下載高解析圖檔按鈕，並附帶觸覺複製動畫反饋與雙語 Toast 提示。
- **🖥️ 全寬頂部工具列與底部預覽狀態列重構 (Full-Width Top Header Toolbar & Bottom Preview Status Bar)**：
  - **全寬頂部工具列 (Full-Width Header Toolbar)**：將編輯工具列移出左側單欄，提升為橫跨整個視窗（100% 寬度）的全寬頂部工具列，彻底解決 25+ 個格式按鈕（Undo/Redo、H1~H3、粗斜體、螢光筆、顏色、註腳、Quote、Alert、TOC、清單、Code、表格、分欄、圖片、附件、搜尋、全螢幕）在雙欄模式下被中間分割線截斷或擠壓的問題。
  - **預覽區底部狀態列 (Bottom Preview Status Bar)**：將預覽區頂部的發布狀態列（`尚未發布/已發布`、分享連結、`▷ 簡報`、`📖 書本`、版本與觀看數）移至預覽區的最底部，預覽區頂部與編輯區文字頂部完美水平齊平，閱讀視線通透無干擾，並與左側底部的游標行列字數狀態列整齊呼應。
- **📖 書本模式進入按鈕與複製連結全面整合 (Book Mode Direct Triggers & Link Matrix)**：
  - **編輯器預覽區發布狀態列**：新增「📖 書本」按鈕，點擊可直接進入書本模式進行即時預覽。
  - **底部分享選單 (`🌐`)**：在已發布選單中新增「📖 複製書本連結」按鈕，一鍵複製 `/share/:id/book` 網址至剪貼簿。
  - **頂部工具列擴充 (Toolbar Palette Color Tool)**：頂部工具列新增「🎨 自訂顏色 (`[color=...]`)」按鈕，選取文字後一鍵插入文字與背景顏色標籤。
- **🔌 MCP 伺服器與簡報解析防護優化 (MCP & Presentation Parsing Hardening)**：
  - **MCP 智慧結構偵測回傳網址 (Conditional Book/Presentation URL Emission)**：`write_note` 僅在筆記包含章節連結清單時回傳 `/book` 網址，僅在包含 `---`/`--` 分頁符號時回傳 `/present` 網址，避免一般普通文章誤導 AI Agent。
  - **MCP 工具描述輕量化 (Concise MCP Tool Description)**：將 `write_note` 工具描述精簡為核心語意，避免客戶端 UI 截斷與 Token 浪費；完整排版語法移至 `SKILL.md` 與 API 文檔維護。
  - **YAML Frontmatter 與簡報分隔線消歧義 (YAML vs. Slide Divider Disambiguation)**：強化簡報解析邏輯，精確驗證 YAML Key-Value 結構，防止文首以 `---` 開頭的簡報誤將第一張投影片當作 Frontmatter 剔除。
- **🛡️ 書本與簡報模式防無限套娃防呆機制 (Anti-Nesting Iframe & Embed Guard)**：
  - **遞迴內嵌硬防護 (Hard Frame Isolation)**：`initBookMode`、`initPresentation` 與 `maybeAutoStart` 全面加入 `window.self !== window.top` 與 `isEmbed` 雙重判斷，嚴禁在 `<iframe>` 或 `?embed=1` 嵌入情境下重複觸發書本/簡報外框。
  - **章節嵌入網址過濾 (Chapter URL Sanitization)**：章節載入與目錄回溯自動剝除結尾的 `/book` 路徑，防止將書本容器載入右側 iframe；未包含章節連結的普通筆記安全回退至單篇本文純淨嵌入。
  - **編輯路由內嵌支援 (`/:path?embed=1`)**：未設定讀取鎖的編輯路由在帶有 `?embed=1` 時自動以乾淨 Share 閱讀視圖呈現，避免編輯器工具列與側邊欄被內嵌。

## [2026-08-19]

- **📖 書本模式 (Book Mode - `/share/:id/book`)**：
  - **雙欄目錄樹結構與可拖拉調整側邊欄 (Draggable Dual-Pane Shell)**：左側固定目錄導覽欄，支援章節搜尋過濾、層級展開、當前章節高亮標記；新增**側邊欄拖拉調整把手（Splitter Resizer）**，支援滑鼠與觸控拖拉調整寬度（180px～視窗 65%）、`localStorage` 記憶偏好寬度，雙擊把手一鍵重設為預設 290px；手機版自動轉為抽屜式 Drawer 選單。
  - **極速原生嵌入渲染 (Native Embed Architecture `?embed=1`)**：右側閱讀區採用成熟的原生嵌入渲染核心，零秒呈現完美 KaTeX 公式、程式碼高亮、一鍵複製、Alert 提示框、Mermaid 圖表與主題樣式。
  - **智慧翻書控制列與頂部導覽列 (Chapter Navigation Header & Footer)**：頂部提供「← 上一章」與「下一章 →」快速切換、麵包屑路徑、在新分頁開啟按鈕（`↗`），並支援鍵盤快速鍵 `[`（上一章）與 `]`（下一章）。
- **📽️ 簡報模式 2D 矩陣升級 (Vertical Sub-Slides `--` & YAML Frontmatter)**：
  - **垂直子投影片 (`--`)**：支援橫向投影片（`---`）與縱向子投影片（`--`）二維矩陣排版，使用方向鍵上下左右（`↑` `↓` `←` `→`）導覽，大綱總覽（`O`）支援 2D 矩陣縮圖導覽。
  - **YAML Frontmatter 宣告**：筆記文首支援 `---` YAML 宣告自訂 `transition` 轉場動畫（`fade`, `slide`, `convex`, `concave`, `zoom`）與主題覆寫。
- **📊 Excel / Google Sheets 複製貼上自動轉 Markdown 表格**：
  - 在編輯器貼上（`Cmd+V` / `Ctrl+V`）來自 Excel、Google Sheets、Numbers 或網頁選取的表格時，自動偵測 `text/html` 與 TSV 格式並秒轉為標準對齊的 Markdown 表格語法（`| ... |`）。
- **📝 行內註腳與工具列擴充 (Inline Footnotes `^[...]` & Footnote Toolbar)**：
  - 支援 Pandoc / HackMD 行內註腳語法 `^[行內註腳說明]`，自動進行數字編號並在文末掛載對應說明。
  - 工具列新增「插入註腳 ([^1])」快捷按鈕，自動遞增編號。
  - **雙模閱讀體驗 (Hover Card & Click Jump)**：滑鼠懸停（Hover）即時就地顯示毛玻璃懸浮卡片，讀者無須跳開即可原地閱讀註腳；點擊註腳數字或文末 `↩` 返回符號時，則平滑滾動（Smooth Scroll）跳轉至目標並附帶呼吸高亮閃爍（Highlight Pulse Animation）。



- **🖍️ 編輯器與 Markdown 進階排版擴充套件 (Phase 1 Markdown Extended Writing Kit)**
  - **🔍 編輯器全功能搜尋與取代 (Search & Replace Bar - Cmd+F / Cmd+H)**：
    - 支援 `Cmd+F`（Ctrl+F）即時開啟懸浮搜尋列，`Cmd+H`（Ctrl+H）展開取代列，工具列亦新增「🔍 搜尋與取代」按鈕。
    - 具備即時匹配計數器（如 `3 / 15`）、快速導覽（`Enter` 下一個、`Shift+Enter` 上一個）、三合一進階比對選項（`Aa` 區分大小寫、`\\b` 全字匹配、`.*` 正規表達式）以及「單處取代」與「全部取代」操作。
  - **🖍️ 螢光筆文字高亮語法 (`==text==`)**：
    - 支援 HackMD 標準 `==螢光筆文字==` 語法，渲染為 `<mark class="markdown-highlight">` 標籤，在淺色與 20 款深色主題中呈現高對比且護眼的柔和黃色高光；工具列同步提供「🖍️ 螢光筆 (HL)」快捷按鈕。
  - **🎨 自訂文字與背景顏色語法 (`[color=...]`, `[bg=...]`)**：
    - 支援 `[color=red]文字[/color]`、`[bg=yellow]文字[/bg]` 以及複合標籤 `[color=#3b82f6 bg=#eff6ff]文字[/color]`。
    - 支援 Hex、RGB、HSL 與 CSS Named Color，嚴格遵循安全過濾機制，程式碼區塊外可靈活強調重點。
  - **🔢 程式碼區塊行號與檔名標籤 (Code Block Line Numbers & Title Tabs)**：
    - 支援行號起始語法：```` ```js= ````（從第 1 行開始）與 ```` ```js=10 ````（從指定行號開始），左側自動生成等寬且防選取的獨立行號槽（Gutter）。
    - 支援檔案名稱標籤：```` ```js [app.js] ```` 或 ```` ```js=1 [server.mjs] ````，自動於頂部渲染檔名 Header 與語言徽章。
  - **📋 程式碼區塊一鍵複製按鈕 (Code Block One-Click Copy)**：
    - 所有渲染後的程式碼區塊頂部自動掛載輕量複製按鈕，點擊一鍵複製原始程式碼（排除行號與檔名），並附帶綠色成功狀態。
  - **💬 GitHub Alert 提示區塊自動補完與工具列支援**：
    - 在編輯器行首鍵入 `> [!` 時自動彈出 GitHub Alert 快速下拉選單（NOTE、TIP、IMPORTANT、WARNING、CAUTION），支援方向鍵選取、`Enter` / `Tab` 插入。
    - 工具列新增「⚠️ GitHub 提示區塊」按鈕，快速建立標準 Alert 語法。

- **📖 維基百科式腳註懸停預覽 (Footnote Hover Tooltip / Popover) 與 Pandoc 學術引用語法支援**
  - **維基百科式懸停浮層 (Footnote & Citation Popover)**：
    - 正文內的腳註標號 `[^1]`、`[^key]` 或學術引用標籤 `[@key]`，滑鼠懸停時即時就地彈出毛玻璃懸浮小卡（Tooltip Popover），自動抓取文末腳註或 BibTeX 條目內容，免去跳至文末閱讀再尋找回溯點的繁瑣操作。
    - 支援滑鼠移入浮層操作（複製內文、點擊連結）、深淺色自適應、視窗邊界自我調節，以及觸控螢幕點擊開啟與獨立 `×` 關閉按鈕。
  - **Pandoc 學術引用語法 (`[@citationKey]`)**：
    - 支援標準括號引用 `[@key]`、帶頁碼定位 `[@key, pp. 42-45]`、多文獻並列 `[@smith04; @doe2023]`、作者抑制 `[-@key]` 與行內引用 `@key [p. 10]`。
    - 自動關聯文末同名腳註 `[^key]: ...`、BibTeX 程式碼區塊 `@misc{key, ...}` 或 References 列表，並渲染為現代化的學術 Citation Badge。

- **📜 Share 頁面學術與技術文獻引用產生器 (Academic & Technical Citation Generator - Cite Modal)**
  - **支援六大引用標準**：
    1. **BibTeX**：電腦科學、物理、數學與 LaTeX / Overleaf / Zotero 最普遍使用的程式碼格式。
    2. **APA 格式 (7th Edition)**：全球最廣泛通用的社會科學與商學文獻標準。
    3. **IEEE 格式**：電機、資工與科技論文標準格式（含數字標號 `[1]` 與線上存取日期）。
    4. **MLA 格式 (9th Edition)**：人文、藝術與語文領域專用標準。
    5. **Markdown 超連結與腳註**：一鍵產生 `[標題 - David888 Wiki](URL)` 與 `[^1]`，方便貼入 Obsidian、Notion 與 GitHub。
    6. **Chicago 格式 (17th Edition)**：出版業與歷史學標準格式。
  - **精美互動彈窗 (Cite Modal)**：在分享頁底部工具列（「引用」按鈕）及「複製」選單中新增「引用此文章 (Cite)」；彈窗支援即時切換 Tabs、點擊自動全選代碼、一鍵複製並提供流暢 Toast 提示。

- **🌐 原生 Cloudflare WebMCP 與 HTTP JSON-RPC 2.0 端點支援 (`/mcp`)**
  - **原生 Worker MCP 服務**：在 Cloudflare Worker 原生實作標準 Model Context Protocol (MCP) JSON-RPC 2.0 伺服器端點（`POST /mcp`、`GET /mcp`、`OPTIONS /mcp`），無須本機 Python 執行環境。
  - **Cloudflare WebMCP 1-Click 零設定橋接**：當使用者在 Cloudflare Dashboard 開啟 WebMCP 時，Edge 注入的 `/.webmcp/bridge.js` 會自動請求同網域的 `/mcp` 端點，將 Wiki 核心工具即時註冊至瀏覽器 `document.modelContext`（Chrome 146+），供 Browser AI Agent 與 BrowserRun 免爬蟲呼叫。
  - **完整 MCP 工具集 (Built-in Tools)**：
    - `read_note`：讀取文章 Markdown 內文、密碼檢查與元數據。
    - `write_note`：建立/覆寫文章並回傳 Share URL 與 Edit URL。
    - `append_note`：追加 Markdown 內容至指定文章末尾。
    - `render_markdown`：渲染 Markdown 為包含主題樣式的 HTML。
    - `lint_markdown`：檢驗並自動修復 Markdown 語法問題。
    - `extract_markdown_meta`：提取文章標題、大綱目錄、超連結與字數統計。
    - `get_view_stats`：查詢文章不重複訪客閱讀統計。
    - `get_api_catalog`：獲取所有機器可讀 discovery 端點目錄。
  - **全域 CORS 與相容性測試**：提供全域 CORS Preflight 支援與 8 項自動化單元測試，全面覆蓋協議初始化、工具清單與所有調用流程。

## [2026-08-18]

- **🗑️ 劃線註解與留言自行刪除支援 (Self-Deletion with HMAC Token & Author Moderation)**
  - **訪客本人安全刪除 (Author Self-Deletion)**：建立註解或回覆時自動生成並簽署無狀態 HMAC 刪除憑證（`deleteToken`）儲存於本地端，側邊欄僅對自己發布的留言呈現「🗑️ 刪除」按鈕與二次確認，杜絕誤刪或越權操作。
  - **筆記作者管理特權 (Author Moderation)**：持有文章編輯權限（`role: edit`）的筆記擁有者具備全域管理刪除權限，可直接刪除任何不當或惡意留言。
  - **後端安全驗證與自動清理 (RESTful DELETE API)**：提供 `DELETE /api/shares/:shareId/annotations/:threadId/messages/:messageId` 與 `DELETE /api/shares/:shareId/annotations/:threadId` 端點；當劃線討論串的所有留言皆被刪除時，自動從側邊欄與內文劃線高亮中清除。
- **💬 劃線註解 Hover / Tap 迷你浮動預覽卡片 (Inline Popover)**
  - **桌機版懸停即時預覽 (Desktop Hover Tooltip)**：滑鼠懸停於文章劃線註解範圍時，就地在文字上方/下方彈出迷你浮層卡片，顯示最新留言者、時間、留言內容摘要與總則數；滑鼠移入卡片維持顯示，移開自動延遲淡出。
  - **手機與觸控輕點喚起 (Mobile Tap)**：在行動裝置或觸控螢幕上，輕點劃線文字即可就地彈出迷你預覽卡片；再次點擊或點擊「查看完整討論」即可直接展開底部抽屜（Bottom Sheet）並平滑滾動至對應留言卡片。
  - **劃線點擊聯動側邊欄與高亮聚焦 (Click to Focus & Flash)**：點擊劃線文字或迷你預覽卡片，直接開啟側邊欄並聚焦到該討論串，附帶柔和的卡片高亮閃爍動畫（`.annotation-thread-flash`）。
  - **高效無損命中測試 (Range ClientRects Hit Testing)**：在 CSS Custom Highlight API 基礎上，利用 `Range.getClientRects()` 進行無 DOM 污染的多行坐標命中檢測與視窗邊界自我調節。

## [2026-08-17]

- **Block 編輯模式補齊檔案導出**：編輯頁重新提供 PNG 長圖、獨立 HTML、PDF／列印預覽；Block 編輯器會直接使用目前畫布內容產生導出結果，Markdown 導出則維持隱藏。
- **列印內容隔離編輯介面**：PDF／列印預覽改用乾淨的文章內容快照，不再把深色編輯器面板、工具列或 BlockNote 操作介面印入文件。

## [2026-08-16]

- **🎙️ 音訊匯入、語音轉逐字稿與 Groq 高速主力管線 (`Groq whisper-large-v3` + `Workers AI Fallback`)**
  - **極速多層級 STT 引擎**：
    1. **主力模型**：Groq `whisper-large-v3`（超高速推論、高準確率）。
    2. **第一備援**：Groq `whisper-large-v3-turbo`。
    3. **第二備援**：Cloudflare Workers AI `@cf/openai/whisper-large-v3-turbo`。
    4. **第三備援**：Cloudflare Workers AI `@cf/openai/whisper`。
  - **純淨無干擾的 UI 選項與直覺佈局**：
    - 將音訊匯入按鈕移至「＋ 新增」選單內「匯入內容」區塊的最上方，優先展示。
    - 去除「Whisper」或「AI」等技術贅字與雜訊，提供乾淨純粹的介面：
      - **`🎙️ 匯入音訊（逐字稿）`**（預設推薦）：100% 原音忠實轉錄，無任何加工或幻覺。
      - **`✨ 匯入音訊（智慧排版）`**（可選）：Whisper 產出逐字稿後，由 LLM 釐清語句、整理內容與 Markdown 排版。
  - **多格式音訊支援**：支援上傳常見音訊檔案（`.mp3`, `.m4a`, `.wav`, `.aac`, `.ogg`, `.webm`, `.flac`, `.opus`, `.mp4` 等）。
  - **REST API 端點**：提供 `POST /api/audio/transcribe` 與 `POST /:path/transcribe`，支援 `multipart/form-data`、二進位串流與 JSON Base64，支援以 `?format=smart` 參數開啟 Whisper 後的 LLM 智慧整理排版。
  - **金鑰配置與安全隔離**：支援透過 `wrangler secret put GROQ_API_KEY` 設定加密金鑰，享有每分鐘數百次免費超高速轉錄額度。
  - **流暢編輯整合**：支援「取代全文」或「插入游標處」，並提供即時 Toast 轉錄進度與完成提示。

- **📱 PWA 常駐主動安裝按鈕與跨平台體驗**
  - 於右下角 GitHub 連結旁新增常駐「安裝 App」按鈕（`#pwa-install-manual-btn`）。
  - 移除桌面與手機端隨機自動彈出的提示橫幅，改為主動安裝機制。
  - 在 HTML `<head>` 最前端即時捕獲 `beforeinstallprompt` 事件，並支援 macOS Safari / iOS Safari 精確 Toast 指引，提升 Service Worker 快取版本至 `v4`。

- **⚡ Local-First 本地優先儲存架構與智慧雲端同步**
  - **0ms 本地即時存檔**：編輯打字時以 300ms 防抖即時寫入客戶端 **IndexedDB (`CloudNotepadOfflineDB`)**，狀態顯示 `🟢 本機已存`，享受原生桌面級流暢體驗。
  - **智慧節流雲端同步**：停止輸入 3.5 秒、定期週期性間隔、或關閉/切換分頁（透過 `visibilitychange` / `keepalive` / `sendBeacon`）時自動向雲端同步，節省 90% 以上寫入請求，徹底解決 Cloudflare KV 1,000 次/天寫入上限。
  - **斷網離線與自動恢復**：離線草稿標記為 `pending`，網路恢復時（`online` 事件）自動背景同步至雲端。
- **🔌 可插拔後端儲存驅動 (`src/storage_driver.mjs`) 與 D1 相容遷移支援**
  - 提供統一儲存介面，透過 `SCN_STORAGE_DRIVER` 支援 `auto`（預設）、`kv`、`d1` 三種模式。
  - **`auto` 雙寫與相容模式**：優先讀寫 D1，若舊文章未在 D1 則自動 Fallback 讀取 KV，並於編輯儲存時自動雙寫同步至 D1，保證歷史 KV 文章 100% 平滑遷移與零停機。
  - 提供 `schema/notes_d1.sql` 資料庫遷移 Schema。
- **🛠️ Markdown 轉換與無狀態分析工具 API**
  - **`POST /api/markdown/render`**：支援 Markdown 渲染為 HTML，支援指定 20 款 CSS 主題、整頁 HTML 包裝與自訂標題。
  - **`POST /api/markdown/parse`**：支援 HTML 字串或網頁 URL 解析轉換為乾淨 Markdown。
  - **`POST /api/markdown/extract`**：提取 Markdown 純文字、文章標題、大綱目錄 (Headings)、超連結、圖片與精準字數/預估閱讀時間統計。
  - **`POST /api/markdown/lint`**：自動檢查 Markdown 語法問題（未閉合程式碼區塊、標題缺少空格、空連結、未加引號 Mermaid 節點）並輸出自動修復的 Markdown。
- **💬 劃線註解與討論串 REST API (D1 持久化)**
  - `GET /api/shares/:shareId/annotations`：獲取公開分享頁面的所有劃線註解與討論串。
  - `POST /api/shares/:shareId/annotations`：傳入段落錨點（`selectedText`、`prefix`、`suffix`）建立劃線註解討論串。
  - `POST /api/shares/:shareId/annotations/:threadId/messages`：回覆特定討論串。
  - `POST /api/shares/:shareId/ai-assistant`：針對文章或劃線段落進行 AI 概念解釋與問答。
- **🤖 LLM 標準索引 (`/llms.txt` & `/llms-full.txt`)**
  - 符合 llmstxt.org 標準，提供面向 AI Agent 與 LLM 的精簡與完整架構索引、OpenAPI 規格與 Skill 文檔指引。
- **📱 PWA 支援、檔案關聯 (File Handling API) 與離線工作區 (Offline Workspace)**
  - **📂 檔案關聯 (File Handling API)**：
    - 在 `app.webmanifest` 與 Worker 路由中註冊 `file_handlers`（關聯 `.md`、`.markdown`、`.txt` 檔案）。
    - 支援透過 PWA Launch Queue 在作業系統（macOS Finder 或 Windows 檔案總管）中右鍵點擊 `.md` 檔案直接使用 `wiki.david888.com` 開啟並載入編輯器。
  - **⚡ 離線工作區 (Offline Workspace)**：
    - 全面升級 `/_pwa-offline`，在無網路環境下提供完整的本機 Markdown 編輯器介面。
    - 支援離線瀏覽與編輯所有本機快取筆記、建立新離線草稿、開啟本機檔案與即時匯出 `.md` 檔案。
  - **💾 混合本機存儲架構 (`static/js/offline-store.mjs`)**：
    - **LocalStorage**：同步儲存輕量元數據（`path`、`title`、`updatedAt`、`size`、`theme`、`syncStatus`），提供快速即時索引。
    - **IndexedDB (`CloudNotepadOfflineDB`)**：非同步儲存完整 Markdown 內文與歷史草稿，徹底突破 LocalStorage 5MB 上限。
    - **記憶體自動降級 (Memory Fallback)**：於無痕模式或不支援 IndexedDB 的極端環境下自動無縫降級為記憶體快取。
  - **⌨️ 快捷鍵支援 (`Cmd/Ctrl + S` & `Cmd/Ctrl + O`)**：
    - `Cmd/Ctrl + S`：於編輯模式即時將文章儲存至本機 IndexedDB 與雲端（若已發布）；於檢視/分享模式觸發 Markdown 檔案下載。
    - `Cmd/Ctrl + O`：於編輯模式快速喚起系統檔案選擇器，載入本地 Markdown 檔案。
  - **📱 常駐 PWA 主動安裝按鈕 (`#pwa-install-manual-btn`)**：
    - 於頁面右下角工具列（GitHub 按鈕旁）新增常駐「安裝 App」按鈕。
    - 支援主動呼叫瀏覽器原生安裝確認彈窗（`deferredInstallPrompt`），即使先前已關閉頂部提示橫幅亦可隨時手動安裝。
    - 針對 Safari / iOS 提供安裝指引提示（「分享 ➔ 加入主畫面」），並於獨立 App 模式（Standalone）下自動隱藏。
  - **🌐 連線狀態即時感應**：監聽 `online` 與 `offline` 事件，斷網時自動進入離線本地保護模式，聯網恢復時自動提示並增量同步修改。

## [2026-08-15]

### Added

- **簡報模式全面升級 (Slidev-Lite 2.0: KaTeX / Mermaid / ECharts / 懸浮工具列 / 主題綁定 / 現代版型 / 導出)**
  - **📊 豐富組件繪製**：簡報中全面支援 KaTeX 數學方程式即時渲染、Mermaid 流程圖轉 SVG 自動適配、ECharts 動態圖表初始化與自動縮放，確保在 16:9 投影片中等比例縮放且不破版。
  - **🎛️ 底部簡報快捷懸浮工具列 (`#presentation-toolbar`)**：
    - 半透明毛玻璃膠囊導覽列，閒置 2.8 秒自動平滑淡出，滑鼠移動即時喚醒。
    - **◀ / ▶ 翻頁與頁碼跳轉**：即時顯示目前頁碼與總頁數，點擊頁碼可直接輸入跳轉。
    - **🔲 大綱總覽 (Overview)**：按鍵 `O` 或點擊按鈕，展開全 slide 網格縮圖快速導覽。
    - **🔴 數位雷射筆 (Laser Pointer)**：按鍵 `L` 或點擊按鈕，滑鼠化身為帶有光暈的紅色雷射亮點。
    - **⚫ 黑屏暫停 (Pause Blackout)**：按鍵 `B` 或 `.` 進入演講暫停黑屏。
    - **⛶ 全螢幕切換**：按鍵 `F` 或點擊按鈕切換全螢幕簡報。
  - **🎨 筆記主題與字型深度同步 (`data-presentation-theme`)**：
    - 自動繼承當前筆記所選定的 20 款 Markdown 主題色調（如 `retro`、`tokyo-night`、`notion-clean`、`green-simple`、`ayu-light` 等）與字型，大幅提升演講視覺質感。
  - **📑 擴充 Slidev 現代語法**：
    - **封面頁 (Cover Layout)**：支援 `<!-- layout: cover -->` 或 `<!-- cover -->`（或首頁單一 H1 自動識別），套用大標題置中封面設計。
    - **多欄排版**：支援雙欄 `::left::` + `::right::` 與三欄 `::left::` + `::center::` + `::right::`。
    - **自訂背景**：支援 `<!-- bg: #color -->`、`<!-- bg: url(...) -->`、`<!-- bg: linear-gradient(...) -->`。
    - **程式碼逐行高亮**：支援 ````lang [1-2|4-6]```` 或 ````lang {1-2|4-6}```` 逐行聚焦點亮動畫。
  - **📄 簡報導出功能**：
    - **另存 PDF 簡報**：直接觸發最佳化投影片列印引擎。
    - **導出當前頁圖片 (PNG)**：以 2x Retina 解析度將當前投影片繪製為獨立 PNG 檔案並自動下載。
    - **複製投影片連結**：一鍵複製包含當前頁碼 Hash 的精準簡報分享連結。

- **Share 模式「圈選文字浮動工具列（📋 複製 / 🌐 翻譯 / ✨ 詢問 AI / 💬 註解）」與原位小卡 (Inline Popover)**
  - 將分享頁原本單一的劃線註解按鈕升級為現代化多功能膠囊浮動工具列（`.selection-action-toolbar`），具備毛玻璃磨砂質感、高對比陰影與流暢彈出動畫。
  - **📋 複製 (Copy)**：一鍵複製選取文字至剪貼簿並彈出 Toast 提示。
  - **🌐 翻譯 (Translate)**：自動判定中英雙向翻譯（含中文字自動翻為 English，其他翻為繁體中文），無縫呼叫後端 `/api/shares/:shareId/ai-assistant`，並在原位小卡中顯示譯文與一鍵複製譯文。
  - **✨ 詢問 AI (Ask AI)**：提供 4 組快捷預設晶片（`🔍 解釋概念`、`💡 重點摘要`、`📐 公式推導`、`💻 程式碼解析`）與自訂問題輸入框，即時解答讀者提問。
  - **💬 註解 (Annotate)**：保留原有強大的段落錨點討論功能，無縫展開側邊註解欄。
  - **智慧定位與點擊穿透保護**：浮動工具列與 AI 小卡依據選取區塊（`Range.getBoundingClientRect()`）智慧偵測上方/下方視窗可用空間進行自動翻轉與水平居中；支援點擊外部自動收合與 Escape 快速鍵。

- **獨立「複製內容」與「匯出」下拉選單 (`[ 📋 複製 ▾ ]` & `[ ⭳ 匯出 ▾ ]`)**
  - 將原本塞在匯出選單中的「整篇內容複製」獨立為專屬的 **`[ 📋 複製 ▾ ]`** 下拉選單（富文字、純 Markdown、Notion、Jira/Confluence、飛書、長圖）。
  - **`[ ⭳ 匯出 ▾ ]`** 專注於檔案下載與列印（長圖 .png、Markdown .md、離線 HTML .html、另存 PDF / 列印）。
  - Consolidated export, document copying, and print controls in Edit and Share modes into a single, cohesive **`[ ⭳ 匯出 ▾ ]`** dropdown menu.
  - **長圖導出 (.png)**: Integrated dynamic on-demand loading of `html2canvas` in an isolated rendering sandbox with 2x Retina pixel ratio for full-height, unclipped image exports of Markdown and mathematical equations.
  - **複製圖片 (Copy Image)**: One-click copy of the rendered 2x long image directly to system clipboard (`image/png`).
  - **整篇內容複製到 (Copy Document To)**:
    - **一般富文字 (Rich Text)**: Inlines full typography theme styles to paste directly into Microsoft Word, Google Docs, Apple Notes, and Email.
    - **純 Markdown**: Clean raw Markdown copy for Obsidian, VS Code, GitHub, and ChatGPT.
    - **Notion 相容格式**: Auto-formats equation delimiters (`$$...$$`) and blocks for instant Notion block creation.
    - **Jira / Confluence**: Converts Markdown headings (`h1.`), code blocks (`{code}`), quotes (`{quote}`), tables, and bold/italic into native Jira Wiki Markup.
    - **飛書 / Lark**: Inlines clean document structures and formula notations for seamless pasting into Feishu Cloud Docs.
  - **匯出 Markdown (.md)**: Clean, instant download of note source Markdown.
  - **匯出 HTML 網頁 (.html)**: Self-contained, standalone offline webpage export containing the active typography theme CSS and KaTeX math fonts.
  - **另存 PDF / 列印預覽**: Direct shortcut to browser print engine with A4 print-optimized styling.

- **Theme Palette & Preview Width Dropdown Menus (`[ 🎨 主題 ▾ ]` & `[ ⬌ 寬度 ▾ ]`)**
  - Replaced native select controls with sleek, unified dropdown menus (`#theme-dropdown` and `#width-dropdown`) in the appearance toolbar section.
  - **Width Dropdown**: Provides instant selection between 100% (全寬), 960px (緊湊), 1200px (標準), and 1440px (寬版) with active checkmark indicators (`✓`) and instant layout adjustments.
  - **Theme Dropdown**: Displays all 20 curated Markdown typography styles in a scrollable menu with active checkmark indicators (`✓`) and live CSS switching.

- **Math Formula Click-to-Copy & 7 Output Formats (Share & Preview Modes)**
  - Clicking any rendered KaTeX formula in Share mode or Editor Preview instantly copies the equation with toast feedback and visual highlight animation.
  - Added **Formula Copy Format (`公式複製格式`)** configuration modal (`#math-format-btn` in footer toolbar and settings), supporting 7 versatile output formats:
    1. **自動判斷 (Auto)**: Inline with `$...$`, display blocks with `$$...$$`.
    2. **LaTeX (含 $)**: Always with `$` or `$$` delimiters.
    3. **LaTeX 純文字**: Raw formula syntax without `$` (ideal for Desmos, WolframAlpha).
    4. **Notion (雙 $)**: Always with `$$...$$` delimiters for Notion equations.
    5. **MathML (Word)**: Native XML math structure written to clipboard as HTML/text.
    6. **圖片 PNG**: 2x high-resolution transparent PNG image blob copied to clipboard.
    7. **SVG (進階)**: Clean vector SVG markup for Illustrator, Figma, and web design.
  - User format selection is persisted to `localStorage` (`cf-notepad:math-copy-format`, defaulting to `auto`).

- **Wikipedia-Inspired Dual-Card Editor Onboarding & Markdown Default**
  - Redesigned editor preference modal (`EDITOR_PREFERENCE_MODAL`) into side-by-side interactive cards with zero-friction one-click action buttons (`以 Markdown 開始` / `以 Block 開始`).
  - Set **Markdown 編輯器** as the recommended default format (`DEFAULT_EDITOR_FORMAT = 'markdown'`) with prominent badge highlighting.
  - Fixed preference session persistence: when "記住我的選擇" is not checked, every click on the "＋" New Note button reliably prompts the format selection modal.

### Changed

- **Streamlined Footer Toolbar & Natural Math Button Placement**
  - Moved the **`fx 公式`** (Math Formula Copy Format) button directly next to the **`複製 (Copy)`** button in both Edit and Share modes for cohesive content action grouping.
  - Simplified the **`＋`** New Note button into a balanced, compact icon button by removing the redundant text label, creating a clean split button alongside the `▾` creation menu.
- **Clean Git Working Tree for Screenshot Paste Files**
  - Added `orca-paste-*` pattern to `.gitignore` to prevent chat screenshot artifacts from cluttering source control.

## [2026-08-10]

### Added

- **llms.txt Standard Integration & Extended Documentation (`llms-full.txt`)**
  - Updated `/llms.txt` according to `llmstxt.org` specification, organizing core pages, agent skills, API discovery, development team info, and extended documentation links.
  - Added `/llms-full.txt` dynamic worker endpoint and static fallback file (`static/llms-full.txt`) providing comprehensive system architecture, route indexes, REST API contracts, and security policies.
  - Updated discovery headers to inject `Link: </llms.txt>; rel="llms-txt"; type="text/markdown"`.
  - Added dynamic origin resolution for `/llms.txt` and `/llms-full.txt` worker responses.
  - Updated `robots.txt` crawler policies and documented `/llms-full.txt` in project `README.md`.

### Fixed

- **Mobile RWD Table Border Clipping & Print Formatting Reset**
  - Resolved table clipping in mobile responsive view by removing negative margins (`margin-left: -30px`) and setting container-bound width (`100%`) with responsive horizontal overflow (`overflow-x: auto`).
  - Fixed print mechanism (`@media print`) by adding standard `@page` margins (`12mm 15mm`), hiding block editor drag handles (`.david888-drag-handle`, `.tiptap-block-handle`), resetting table box shadows, and preventing right-edge text clipping in PDF exports and printed pages.

## [2026-08-09]

### Added

- **URL to Markdown Web Clipper Import**
  - Added `🌐 從網址匯入 (URL 轉 Markdown)` entry to the `＋ 新增` / `+ New` dropdown menu.
  - Implemented high-availability 3-tier backend proxy (`/api/url2md`): Primary (`http://2md.aiurl.tw/`) with automatic Failover to Backup 1 (`https://2md.glsoft.ai/`) and Backup 2 (`https://create360.ai/`).
  - Supports extracting article title and clean Markdown from any public web page, inserting or replacing into current editor or automatically creating a new note via `/api/new-note`.
- **LLM Website Entry Point**
  - Added `https://wiki.david888.com/llms.txt`, a concise, canonical Markdown index for LLMs and agents.
  - Links only to public, stable discovery resources: Agent Skill, API documentation, OpenAPI, authentication guidance, API catalog, skill index, robots policy, and public sitemap.
- **New-note Editor Preference**
  - First-time visitors choose Block or Markdown for new notes, with Block selected by default.
  - The choice can be remembered across visits or retained only for the current browser session.
  - The footer `＋ 新增` action now creates a note with the preferred editor, while its adjacent menu keeps explicit format choices and a preference setting.

- **Notion-like Block Editor Dialogs**
  - Replaced browser prompt dialogs with an in-editor, keyboard-accessible block dialog for links, image URLs, YouTube, PDFs, files, Mermaid, ECharts, and raw HTML.
  - Added an Edit action to every embedded block, so existing media and structured blocks can be changed without deleting and recreating them.
  - Validates HTTP(S) URLs and ECharts JSON before a block is inserted or updated.

### Fixed

- **Default Editor Preference Menu Icon & Label**
  - Fixed missing `SVG_ICONS.settings` definition which caused `undefined 編輯預設編輯器` string rendering in the dropdown menu.
  - Clarified confusing label to **`⚙️ 設定預設編輯器模式`** (`Set Default Editor Mode`) for choosing default format (Block or Markdown).

### Changed

- **BlockNote Editor Migration**
  - Replaced the hand-built Block editor UI with BlockNote's ready-made Notion-style React interface: side `+` menu, drag-and-drop controls, slash commands, floating formatting toolbar, and responsive mobile UI.
  - Kept the persisted Tiptap block-document format as a compatibility boundary, so existing notes, Share rendering, and APIs continue to work without a data migration.
- **Block Editor Touch Targets**
  - Enlarged mobile editor controls and dialog actions for more reliable touch interaction.
- **Notion-style Block Controls**
  - Replaced the wide, always-visible formatting toolbar with a compact add/undo/redo control and a cursor-side `+` block menu.
  - Moved slash commands next to the caret and constrained the selected-text formatting menu to its content width.

### Fixed

- **BlockNote Dark-mode Synchronization**
  - BlockNote now follows the site’s light, dark, and automatic theme settings immediately, including system theme changes.
  - Removed the forced light theme and the editor surface override that prevented BlockNote’s native dark palette from rendering.

- **Modal Keyboard and Motion Accessibility**
  - Standardized dialog semantics and hidden state across editor modals, including the mobile bottom sheet.
  - Added focus trapping while a modal is open and returns focus to the initiating control after it closes.
  - Added a reduced-motion mode for people who enable `prefers-reduced-motion` in their operating system or browser.

## [2026-08-06]

### Added

- **AnyDoc WebAssembly Multi-Format Document Import**
  - Integrated `@firecrawl/anydoc-wasm` for client-side WebAssembly document-to-Markdown conversion directly inside the browser tab.
  - Expanded editor file import (`#import-md-input`) to support Word (`.doc`, `.docx`, `.docm`), PowerPoint (`.ppt`, `.pptx`, `.pps`, `.pot`), Excel (`.xls`, `.xlsx`, `.xlsm`, `.csv`), PDF, EPUB, ODT, ODS, ODP, and RTF.
  - Self-hosted WebAssembly assets under `/wasm/anydoc_wasm.js` and `/wasm/anydoc_wasm_bg.wasm` with lockfile-guaranteed versioning and CDN fallback.
  - Added an import document action (`#dropdown-import-doc-btn`) to the `＋ 新增` / `+ New` dropdown menu for quick access.
- **Pre-Conversion Import Options Modal**
  - Added `.import-options-modal` dialog prompting users BEFORE file reading or WASM conversion when the editor has existing content.
  - Supports **Replace All (`取代全文`)**, **Insert at Cursor (`插入游標處`)**, or **Cancel (`取消`)**.
  - Cancelling immediately aborts execution without loading WASM or consuming mobile CPU/RAM.
- **Stray Birds & Startup Tips Typewriter Animation**
  - Re-implemented smooth character-by-character typewriter animation (`typeText`) for Tagore poem quotes and startup tips when creating new notes.
  - Added blinking caret cursor (`▋`) styling and instant hide behavior upon user typing.
  - Added a new bilingual startup tip for multi-format document conversion in `static/data/editor-tips.json`.
- **CLI Document Publishing Helper (`scripts/doc2wiki.sh`)**
  - Added executable helper script to convert local office/PDF files via `@firecrawl/anydoc` CLI and publish directly to `wiki.david888.com` API with theme and share link extraction.

## [2026-08-04]

### Added

- **Block Editor Architecture & Dedicated Creation Routes**
  - Added support for `editorFormat: "block"` immutable note format in metadata, enabling single-column WYSIWYG block-based notes alongside standard Markdown notes.
  - Registered `/new/block` and `/new/markdown` creation endpoints that allocate unique note slugs with locked format metadata.
  - Added the leftmost Footer `＋ 新增` / `+ New` menu: desktop exposes its label, mobile keeps a compact plus button, and both formats are available from its dropdown.
  - Implemented `src/block_renderer.mjs` supporting JSON document parsing, safe HTML rendering for all core blocks (`heading`, `paragraph`, `bulletList`, `taskList`, `code`, `quote`, `divider`, `slideBreak`, `image`, `youtube`, `pdf`, `mermaid`, `echarts`, `file`, `raw`), and Markdown export.
  - Updated title and description extraction in `src/note_meta.js` to parse block JSON documents seamlessly.
- **Vanilla Block Editing and Rich Block Rendering**
  - Added a single-column Block editor canvas with structural controls, mobile-friendly move buttons, and no persistent Markdown preview.
  - Connected image upload to the existing R2 endpoint and file upload to the existing 888box fallback endpoints.
  - Added safe Mermaid and ECharts enhancement on rendered Block pages; `slideBreak` blocks become Reveal.js slide separators.
- **Unified Publish Choices**
  - Consolidated Publish, Autosave, and Public Index into one checkbox dialog instead of asking three consecutive questions.
  - All three choices default to enabled. Confirmed choices are remembered in localStorage and restored the next time the dialog opens on the same device.
  - The first publish writes content, share state, Autosave, and Public Index together in one settings request.
- **Editor Preview Publication Status**
  - Added a compact status strip above the Edit preview with the Share URL, copy/open controls, Public Index state, retained D1 version count, unique D1 view count, and last-saved time.
  - Draft notes show a short publish hint; desktop shows the full status while narrow and phone previews use a compact layout.

### Changed

- **Save Control Group & History Button Placement**
  - Moved `Recent Shares` (`#share-history-btn`) and `Version History` (`#note-history-btn`) buttons inside the footer `.save-control-group` before the `Save` button, grouping all save and history operations together.
- **Autosave Rail Switch UI**
  - Replaced the standard checkbox UI for `Autosave` with a 3D flip-card `RAIL_SWITCH` button matching the `Zh / En` language toggle style (`Auto` / `Manual` / `自動` / `手動`).
- **Fullscreen Presentation Mode Relocation**
  - Relocated the `Fullscreen Presentation Mode` button (`#present-btn`) from the editor footer toolbar to the preview header status bar right before the publication state badge (`Live` / `Draft`).
- **Random New-Note Preview Device**
  - Brand-new editor notes now start with either desktop or mobile preview at random, giving authors an early chance to check narrow-screen layout.
  - Existing notes keep their saved editor preview preference, and Share pages remain responsive to each reader's actual viewport.
- **Publish Follow-up Flow**
  - Removed the separate post-publish Autosave and Public Index questions. Public Index remains enabled by default in the unified dialog to support sitemap discovery.

### Fixed

- **Block Format Integrity and Rendering Safety**
  - `/new/block` and `/new/markdown` now persist a locked format before redirecting; API, publish, and form saves reject invalid Block JSON and format changes.
  - Block renderers now validate every block, accept only HTTP(S) or same-origin media URLs, and display `raw` content as escaped source code rather than executable HTML.
  - Block Share pages render server-side HTML rather than treating JSON as Markdown; explicit Markdown responses use the documented best-effort export.

- **Dark Mode Dropdown Danger Item Contrast**
  - Updated `--toolbar-danger` (`#ff7b72`) and `--toolbar-danger-bg-hover` (`rgba(248, 81, 73, 0.2)`) in dark theme palettes.
  - Ensured the "Unpublish" (`取消發布`) action text in the share dropdown menu remains high-contrast, clearly legible, and stylishly highlighted in dark mode.
- **Edit Preview Rendering and Alignment**
  - Fixed publication-status initialization errors that stopped the Markdown renderer before it could populate the preview.
  - Matched the publication status strip to the editor toolbar's 32px height so both content panes and their scroll origins align vertically.
  - Centered the Edit preview reading-progress rail vertically, matching its Share-page position.
- **Dark Editor Chrome Consistency**
  - Made the Edit preview publication strip inherit the dark UI palette instead of retaining its light background.
  - Changed published/indexed states to the same blue color family in dark mode, and strengthened footer control labels to bold high-contrast text.
  - Gave active footer controls distinct cool-tone roles: teal-blue for publishing, blue for preview/layout, indigo for font, and violet-blue for language.

### Documentation

- **Mermaid Render Error Safeguards in Skill Docs**
  - Updated both `skills/SKILL.md` (canonical site documentation) and `.agent/skills/david888-wiki-publisher/SKILL.md` (local agent skill) with critical safeguards against Mermaid lexical syntax errors.
  - Required LLMs to enclose node labels in double quotes `"..."` to prevent unquoted slashes (e.g. `[/api/proxy]`) from triggering Mermaid parallelogram token (`[/.../]`) parsing failures.
  - Re-generated `src/generated/agent-skill.generated.mjs` so `https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md` serves the updated instructions.

### Removed

- **Editor View Shortcuts**
  - Removed the non-functional `⌘-⌥-7` / `Ctrl-Alt-7`, `⌘-⌥-8` / `Ctrl-Alt-8`, and `⌘-⌥-9` / `Ctrl-Alt-9` shortcuts, including their startup tip and documentation.
## [2026-08-01]

### Fixed

- **Print & PDF Export Layout Cleanliness**
  - Updated `@media print` CSS rules in `base.css.js` and `share-annotations.css` to hide all non-content floating UI overlays during print or PDF export, including mobile bottom sheets (`.bottom-sheet`), floating tooltips (`.floating-tooltip`), toolbars (`.toolbar`), reader controls (`#reader-controls`), and annotation rail buttons (`.annotation-rail-button`).
  - Overrode mobile negative bleed margins (`margin-left: -30px` / `-18px`) during print for `.markdown-body > table`, `.markdown-body > pre`, and `.markdown-body > .media-preview` with `margin-left: 0 !important; width: 100% !important;`, preventing left/right text clipping on printed paper and PDF exports.
  - Added compact cell padding (`5px 6px`), reduced font sizing (`9.5pt`), and automatic word wrapping (`overflow-wrap: anywhere; word-break: break-word`) for print table cells (`th, td`), preventing multi-column tables from overflowing the right printable boundary.

- **Annotation Rail Button Positioning**
  - Repositioned the default initial placement of `.annotation-rail-button` to the top-right corner (`top: 16px; right: 14px`), preventing it from obscuring the mobile back-to-top button.

## [2026-07-31]

### Added

- **Share Annotation Navigation and Deep Links**
  - Moved the Share-page reading-progress rail to the vertical center on desktop while retaining the compact top placement on mobile.
  - Moved the paragraph-annotation launcher below the right-side controls; readers can drag it to any viewport position, which is remembered separately for each Share page.
  - Added `複製連結` / Copy link beside `定位原文` / Locate in article. Opening the copied annotation URL expands the annotation sidebar, centers the cited text, and flashes its source. Password query values are intentionally excluded from copied URLs.

- **Installable PWA Shell**
  - Added a Web App Manifest, 192px/512px app icons, and Service Worker registration so the notepad can be installed as a standalone app.
  - Added an in-app `安裝 App` / Install app prompt for Android Chromium browsers after they report that the PWA is installable; clicking it opens the browser's native install confirmation.
  - Kept the cross-platform installation flow with a 24-hour renewal cycle: `×` closes the promotion for 24 hours. If the app remains uninstalled, the prompt will ask again after 24 hours have elapsed.
  - Added a bilingual offline page that appears when navigation is attempted without a network connection.
  - The Service Worker precaches only the PWA shell, manifest, and icons. It never caches notes, Share pages, or API responses, so protected content is not persisted in browser cache.

### Fixed

- **PWA Install Prompt Dismissal**
  - Added `.pwa-install-prompt[hidden]` CSS rule to ensure setting `prompt.hidden = true` immediately hides the PWA install prompt on screen when the `×` button is clicked.
- **PWA Manifest App Name**
  - Updated Web App Manifest (`app.webmanifest`) and added a dynamic route handler to serve the configured application name (`david888 wiki` / `SCN_APP_NAME`) instead of default `Cloud Notepad`.

### Documentation

- Documented PWA installation and the intentionally limited offline behavior in both README language sections.

## [2026-07-30]

### Added

- **HackMD Image Size Compatibility**
  - Markdown images now accept HackMD-style `=600x`, `=600x400`, and `=x400` dimensions while retaining responsive maximum width.
- **Two- and Three-Column Content Layouts**
  - Added Edit toolbar actions that wrap selected Markdown in `two-column-layout` or `three-column-layout` containers.
  - Column sections are grouped by headings and collapse to one column on narrow screens.

### Changed

- **Initial-Only Random Theme**
  - Random Theme selection now runs only for a brand-new note created from the site root; reopening an existing author Edit restores its persisted Theme.
  - The initial Theme is written to Server metadata immediately and is included again in the first publish request.
- **Human New-Note Titles**
  - Empty new notes use a localized Taiwan-time title such as `新筆記 · 07/30 09:05` or `New note · 07/30 09:05` instead of displaying the random note path.

### Fixed

- **Annotation Source Navigation**
  - `定位原文` / `Locate in article` now scrolls the actual nested article container and centers the exact annotated range before flashing its source element.

### Documentation

- Added a README storage inventory covering Server KV, D1, R2, external services, localStorage, sessionStorage, and Cookies.
- Clarified that Markdown Themes are Server metadata, while editor chrome and layout preferences use browser storage.

## [2026-07-29]
### Added
- **D1 Share View Counter**
  - Added a per-note D1 view counter to normal HTML Share pages and displayed the total in the Share footer.
  - Excluded HEAD requests, Markdown responses, embeds, and presentation pages from view counting.
  - Kept article delivery resilient: missing or unavailable D1 stats do not block a Share page from loading.
- **Per-Note Paragraph Annotation Control**
  - Added an author-only `段落註解` / Paragraph annotations switch to the published Share menu.
  - Published notes default to open; an author's explicit choice is persisted in KV note metadata and restored on reload.
  - Unpublishing closes annotations without deleting any annotation records.
- **D1 Annotation Read Model**
  - Added independent D1 thread and message tables that retain the selected quote, surrounding context, source offsets, and source revision even when the article changes.
  - Added a paginated Share annotation read API with opaque cursors and bounded thread/message results.
  - When an author closes annotations, retained discussions are hidden rather than deleted.
- **Paragraph Annotation Write API**
  - Added same-origin Share APIs for creating a text-anchored discussion and replying to an existing thread.
  - Enforced author, comment, quote, context, offset, and source-revision validation before writing parameterized D1 transactions.
  - Preserved Share view-password checks and rejected new threads when the article changed after text selection.
- **Share Text Selection Annotations**
  - Enabled readers to select rendered Share text and open a nearby annotation action that carries the quote into a discussion composer.
  - Added a responsive annotation sidebar with thread history, replies, source highlighting, source navigation, loading/error/empty states, and keyboard focus treatment.
  - Reattaches discussions with exact quote plus surrounding context after article edits; when the quoted text is gone, the retained thread is labeled `原文已移除`.
- **Dedicated AI Translation and Bilingual Output**
  - Added a separate top-toolbar `AI 翻譯` / AI Translate action. It asks for the target language and lets the author choose translation-only output or a bilingual document that keeps each original Markdown block.

### Changed
- **Random Theme on Every Edit**
  - Each Edit page render now picks one theme at random from the complete bundled theme registry and keeps the selector synchronized with the preview.
  - The random preview does not write KV merely by opening the editor; Share pages retain their persisted article theme until the author explicitly chooses another theme.
- **Annotations Enabled by Default**
  - Existing published notes without an annotation preference now expose paragraph annotations automatically, without a KV migration.
  - New and republished notes start with annotations enabled, while notes explicitly disabled by their authors remain closed.
- **Format-Only AI Formatting**
  - AI formatting now has an explicit format-only policy: it may improve Markdown structure, whitespace, headings, and lists, but must preserve the source language, prose, links, code, and meaning.
  - Pure-English documents reject a formatting response that introduces Chinese characters, keeping the original text unchanged instead of applying an unintended translation.
  - Fixed an editor-script syntax error that had stopped Markdown previews from rendering. The three AI controls are now adjacent icon-only buttons, and formatting or translation applies only to a selected fragment when one is selected.
  - The selection shortcut now exposes `排版` / Format, `AI 編輯` / AI Edit, and `翻譯` / Translate, all scoped to the selected fragment. Removed a stale wide-button style so the three toolbar icons use consistent sizing and spacing.
- **Edit Preview Typography and Icon Safety**
  - The edit preview reapplies the CJK-aware GenJyuu/Maple font stack after a theme stylesheet loads, so Chinese preview text no longer falls back to a theme font.
  - Replaced the invalid footer GitHub SVG path with a browser-safe 24px icon, removed the presentation engine's production debug log, and placed the password input in a proper submit form.

### Fixed
- **Unique Share Views Per Device**
  - Share view totals now increase only once per browser/device for each article; reloading the same Share page no longer increases the count.
  - Added a one-year, secure, HTTP-only anonymous device cookie and stores only its SHA-256 hash in D1.
  - Preserved existing view totals while applying the new unique-view rule to future visits.
- **Selection-Only AI Translation**
  - The floating selection toolbar now snapshots the textarea range before its button receives focus, so Format, AI Edit, and Translate keep the intended fragment.
  - Selection translation sends only the highlighted Markdown to Workers AI; surrounding paragraphs are no longer included as model context and cannot be translated accidentally.

### Documentation
- Updated the Traditional Chinese and English README descriptions for the separated formatting and translation workflows.

## [2026-07-28]
### Changed
- **Bounded 16:9 Presentation Canvas**
  - Replaced the 1000×700 presentation stage with a bordered 1280×720 canvas and consistent internal safe areas.
  - Preserved a readable 22px authoring minimum; slides that still overflow become scrollable and show an editor-only split-slide warning instead of silently clipping content.
  - Added wrapping for long URLs and code, readable table overflow, media height constraints, and a portrait-phone prompt to rotate into landscape.

### Fixed
- **Fullscreen Presentation Mode Entry Restored in Share Views**
  - Added `打開簡報頁面` (Open Presentation Page: `/share/:shareId/present`) back to the published Share Dropdown Menu in the editor.
  - Restored the `演示` (Present) button to the read-only Share Page (`/share/:shareId`) footer controls, allowing readers to launch full-screen Reveal.js/Slidev presentations directly.
  - Synchronized `share-present-open-link` dynamically upon publishing or share state updates.
  - Added unit test coverage in `test/share-presentation-ui.test.mjs`.

## [2026-07-24]
### Added
- **Reading Progress and Editor Status**
  - Added a compact, clickable vertical reading-progress rail to the left edge of Preview and Share pages. It reports reading percentage and lets readers jump through long articles.
  - Added an editor status bar at bottom left that updates the current line, column, and total document length as the cursor moves.
- **Markdown Navigation and Editing Helpers**
  - Added standalone `[TOC]` rendering. It creates a linked, nested table of contents from Markdown headings, including `#`, `##`, `###`, and deeper levels.
  - Added a `製作目錄` / Table of Contents toolbar button immediately after Quote; it inserts `[TOC]` at the cursor.
  - Added a three-column Markdown table template and editor line numbers.

### Changed
- **Chinese Typography**
  - Bundled `GenJyuuGothic-Medium.woff2` and made it the default for Chinese glyphs in the editor, preview, and share views.
  - Preserved the existing Maple Mono and JetBrains Mono font choices for Latin text and code.

### Removed
- Removed the source-citation toolbar action after confirming that it did not match the desired Table of Contents workflow.

### Documentation
- Updated the README in Traditional Chinese and English with the reading-progress rail, editor status, `[TOC]` usage, table template, and Chinese font behavior.

## [2026-07-23]
### Fixed
- **Mobile Publish, Share Link, and Autosave State Synchronization**
  - Fixed a page-startup `ReferenceError` caused by initializing the shared URL helper after the first UI synchronization. The failure had stopped both Markdown-to-HTML rendering and mobile share-action event binding on published Edit pages.
  - Fixed `複製分享連結` returning `/share/null` after publishing from mobile Edit mode. Open Share, Copy Share Link, and Copy Presentation Link now derive their URL from the current live `shareId` at click time instead of retaining the draft page's initial link.
  - Added a guard that rejects a publish response without a valid share ID, preventing the editor from displaying a false published state or exposing invalid share actions.
  - Fixed the post-publish `開啟自動儲存` confirmation appearing to do nothing. The choice is now persisted in note metadata before the toggle, autosave timer, and success message are updated.
  - Restored saved autosave state when reopening a published Edit page and removed the page-load logic that silently reset autosave depending on navigation history.
  - Sequenced the autosave confirmation before the share modal so overlapping dialogs cannot swallow mobile input.
  - Unified PC and mobile published actions around the same `APP_STATE.shareId`, publication state, and autosave metadata instead of mixing live state with page-load DOM values and browser-only storage.
  - Added regression coverage for draft-to-published menu synchronization, null/stale share URLs, presentation URLs, autosave persistence, and mobile floating share controls.
- **Complete Floating Tooltips Across Editor and Share Views**
  - Added localized floating tooltip text to every icon-only Share action on desktop and mobile, including Edit, Export, Copy, Embed, Print, More, and the editor Share options trigger.
  - Replaced container-bound pseudo-element tooltips with a shared body-level floating layer so tooltips remain visible outside horizontally scrollable toolbars and footers.
  - Added touch, pointer, and keyboard-focus support while retaining instant display and viewport-edge positioning.
- **Mobile Published Share Menu**
  - Fixed the `...` button beside the published state in mobile Edit mode opening its menu outside the visible viewport.
  - The share dropdown is now portaled to the document body while open, avoiding clipping and incorrect fixed positioning caused by the mobile footer's scrolling and backdrop filter.
  - Restored horizontal scrolling for the Markdown toolbar and footer without sacrificing tooltip or dropdown visibility.

## [2026-07-22]
### Added / Improved
- **Instant 0ms Floating Tooltip Badge System (Zero-Lag Hover Text Labels)**
  - Replaced native delayed `title` hover tooltips and experimental layout-shifting flip cards with a **Custom 0ms Instant Floating Tooltip Badge** (`[data-tooltip]`).
  - Dark floating badges (`#2c2a29`) with crisp white text instantly appear on hover/focus across both top Markdown editor toolbar and bottom footer controls without any JavaScript `setTimeout` lag.
  - Implemented directional popups: Top toolbar buttons pop DOWN (`top: calc(100% + 6px)`), and Footer buttons pop UP (`bottom: calc(100% + 7px)`), ensuring badges are never clipped by screen edges.
- **Full Container Unclipping (`overflow: visible` & Elevated `z-index`)**
  - Resolved container clipping issues by setting `overflow: visible` and `z-index: 100` on `.footer` and `.markdown-editor-toolbar`.
  - Floating tooltip badges now float freely over the editor and preview panes without being cut off by W3C CSS `overflow-x: auto` computed boundary rules.
- **Enhanced Light Mode Icon Contrast**
  - Updated single-icon buttons (`.toolbar-icon-button`, `.toolbar-icon-link`) in Light Mode to use dark charcoal strokes (`#2c2a29`) and crisp borders (`#e2dacd`).
  - Added terracotta hover states (`#c8654b`) for visual feedback.
- **Thumb-Free 3D Flip Card Toggle Switch (Segmented Control Fix)**
  - Transformed legacy sliding rail switches (Publish/Draft, Font, Language, Device) into **Thumb-Free 3D Flip Card Toggles**.
  - Enabled auto-resizing text containers (`position: relative` on front face) to prevent long text labels from being obscured by sliding thumbs.

## [2026-07-21]
### Added
- **Single-Row Horizontal Scrollable Toolbar & Footer with Visual Wiggle Indicators (PC & Mobile)**
  - Replaced editor toolbar buttons wrapping with a clean, single-row horizontally scrollable layout (`overflow-x: auto; flex-wrap: nowrap;`) on both PC and mobile viewports.
  - Implemented the same horizontal touch-scroll behavior (`overflow-x: auto; flex-wrap: nowrap;`) for the bottom footer on all viewport sizes, including mobile and desktop, showing all edit, appearance, and sitemap/info elements inline.
  - Added dynamically positioned, floating wiggling scroll indicators (arrow icons with `wiggle-right-icon` CSS animation) to prompt the user that horizontal scrolling is available. The indicators auto-fade out immediately once the user starts scrolling.
  - Positioned footer dropdowns using fixed positioning (`position: fixed`) relative to their triggers to prevent clipping inside the scrollable footer.
  - Added micro-interaction tactile feedback with a scale-down effect (`transform: scale(...)`) on active states (`:active`) for all toolbar buttons and footer switches.
  - Retained the classic box-style 4px border-radius switches as requested.
- **UI Dark Mode (Toolbars & Footer)**
  - Added a dark mode toggle button (`ui-theme-toggle-btn`) in the footer info bar next to the GitHub link, with Sun/Moon SVG icons.
  - Automatically detects system OS dark mode preference (`prefers-color-scheme: dark`) and persists user preference to `localStorage`.
  - Added zero-FOUC inline script in `<head>` and dark mode theme variables for `.markdown-editor-toolbar`, `.footer`, `.footer-select`, `.footer-rail-switch`, `.dropdown-menu`, and `.bottom-sheet`.

### Fixed
- **Critical Template Syntax Error**
  - Fixed an orphaned `catch` block in the autosave initialization logic that caused a syntax error in the generated client-side script, breaking Markdown rendering, share mode, and UI interactions.
- **Dark Mode UI Adjustments**
  - Updated the default dark mode palette to use Pantone 19-4052 Classic Blue (`#0f4c81`) as requested.
  - Set the footer text to `font-weight: bold` by default to improve readability.
  - Fixed Web Awesome `wa-select` components (Width and Theme dropdowns) being unreadable in dark mode by explicitly passing `--toolbar-text` color to the `display-input` and `icon` parts.
  - Automatically toggles the `wa-theme-dark` class on the root element so Web Awesome components properly match the UI dark mode preference.
- **Default Theme Correction**
  - Fixed an issue where the frontend UI components would incorrectly fall back to `catppuccin-macchiato` instead of `claude-canvas` when no theme was saved.
- **Preview Width Persistence & Cloudflare KV Quota Optimization**
  - Included `width` in the publish payload (`publishCurrentNote()`) so published/shared notes reliably keep the editor's selected preview width (1200px / 960px / 1440px / 100%).
  - Removed automatic page-load KV write requests when initializing 1200px width in memory, eliminating redundant KV write calls and protecting Cloudflare Free Tier quota.
  - Refactored local editor preferences (`splitDirection`, `previewDevice`, `mode`, `autosave`) to be managed entirely via browser `localStorage` without sending KV API writes.
  - Pre-selected the `value="${effectiveWidth}"` attribute on `<wa-select id="preview-width-selector">` in SSR HTML.
  - Supported `width` parameter in Headless API (`POST /api/:path`) via query parameters, JSON body, and multipart form-data.

## [2026-07-17]
### Fixed
- **Compact Editor Toolbar and Plain Edit Mode**
  - Compressed toolbar button sizes, spacing, and padding after responsive wrapping.
  - The Markdown toolbar now remains available when preview mode is turned off; only the preview pane and splitter are removed.
- **Responsive Markdown Toolbar**
  - Narrow editor widths now wrap toolbar buttons onto additional rows instead of showing a horizontal scrollbar.
  - Very small screens use compact toolbar buttons and remove separators to keep the layout readable.
- **Web Awesome Appearance Selectors**
  - Replaced the footer's native width and theme selectors with Web Awesome `wa-select` and `wa-option` components.
  - Pinned Web Awesome to 3.10.0 and styled its exposed CSS parts to match the existing toolbar.
  - Re-applies the edit preview width after the custom element finishes loading, preserving the 1200px default.
- **Publish Menu State Sync**
  - The share menu now switches from `發布並建立分享連結` to the published share actions immediately after publishing, without requiring a page reload.
  - The newly returned share ID is applied to the open, copy, and presentation share actions in the live editor.
  - Added keyboard navigation, Escape-to-close behavior, and expanded-state ARIA attributes to the share dropdown.
- **Editor Preview Width**
  - New edit pages now default to a 1200px preview width when no note-specific or browser-saved width preference exists.

## [2026-07-15]
### Added
- **Media URL Previews**
  - Added safe preview detection for PDF, YouTube, video, and audio links in editor and share previews.
  - YouTube links use `youtube-nocookie.com` embeds; native media previews retain a fallback link.
  - Set YouTube previews to a responsive 16:9 player instead of the browser's default short iframe height.
  - Removed the fixed minimum height so the player scales correctly on narrow mobile layouts.
  - Copying rendered content now uses the sanitized HTML snapshot from before media preview decoration, keeping iframe previews out of Jira, Confluence, and similar editors.
  - Kept the Markdown parser unchanged and apply preview decoration after DOMPurify sanitization.
- **WebTalk Page Identity**
  - Added `meta[name="webtalk-page-id"]` to share and password-protected share pages using the existing share ID.

### Fixed
- **Share Embed and Viewer Settings**
  - Restored the share-page Embed button, iframe code modal, `?embed=1` route, and iframe height messaging.
  - Share-only theme, width, and font changes now stay local to the current viewer; edit pages remain persistent.
- **Attachment Upload Fallbacks**
  - Uploads now prefer `box.david888.com`, followed by `box.aiurl.tw` and `box.glsoft.ai`.

## [2026-07-14]
### Changed
- **Editor Layout and Save Prompts**
  - Fixed the draggable editor/preview divider so horizontal resizing changes pane width without leaving blank space below the editor; stacked layouts now resize the complete editor pane as well.
  - Unpublished notes now show a save-and-publish prompt after 10 seconds of stopped input, with explicit publish/save or later choices.
  - Newly published notes ask whether to enable per-note autosave.
  - Markdown downloads now prefer the note title for the filename, falling back to the note path when needed.
  - Shared-note Open Graph metadata now uses `DAVID888 WIKI` as the site name.
- **Open Graph Branding and Homepage Metadata**
  - Replaced the social-card image branding with `DAVID888 WIKI`.
  - Added a stable, indexable homepage OG payload with title, description, canonical URL, image dimensions, and large-image Twitter metadata.
  - Versioned the OG image URL so social crawlers do not keep serving the previous immutable image cache.
  - Added OG image alt text, locale, theme color, JSON-LD, an HTML language attribute, and a crawlable share-page H1.
  - Kept the root new-note workflow: browsers still open a fresh editor slug automatically, while crawlers can read the homepage metadata.
- **Runtime Slug Length Configuration**
  - Fixed the homepage's random editor URL generator so `SCN_SLUG_LENGTH` is read after Cloudflare Worker runtime bindings are injected.
  - Added a regression test covering a runtime-configured four-character slug length.
- **Public-Gated Note Saving**
  - Unpublished notes no longer persist editor content to KV.
  - Publishing saves the current editor content and publishes the note in one operation.
  - Published notes provide a manual Save button and a per-note Autosave option, disabled by default; enabled autosave waits 10 seconds after typing stops before saving.
  - Leaving a page with unsaved published content triggers the browser's native leave-page warning.
  - The UI explains that a published note can still use the View Lock when public reading should remain restricted.
- **Unified Editor Feedback and Lock Controls**
  - Centered toast messages and standardized editor alerts and confirmations with the same in-app dialog treatment.
  - Moved Save beside Publish and labeled the lock controls explicitly as Edit Lock / View Lock.
  - Replaced the standalone pencil and eye symbols with combined lock-plus-pencil and lock-plus-eye icons.

## [2026-07-13]
### Added
- **Markdown Editor Toolbar**
  - Added a localized toolbar above editable Markdown notes.
  - Added headings, emphasis, strikethrough, links, quotes, lists, task lists, inline code, code blocks, horizontal rules, tables, image insertion, and fullscreen editing.
  - Added Undo / Redo buttons and `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, and `Ctrl/Cmd+Y` shortcuts with selection-aware editor history.
  - Added the existing AI formatting workflow to the editor toolbar while retaining the footer button.
- **Image Insertion**
  - Added file selection from the editor toolbar.
  - When R2 is enabled, selected images upload through `/upload` and are inserted as Markdown image links using the uploaded file name as the alt text.
  - When R2 is disabled, the toolbar inserts a Markdown image placeholder for manual URL editing.
- **888box Attachment Uploads**
  - Added a toolbar attachment button for video, audio, document, archive, and generic file uploads.
  - Attachments upload directly to `https://box.glsoft.ai/api.php?action=upload` and insert media-aware Markdown or HTML snippets.
  - Image uploads remain unchanged and continue to use the built-in R2 image flow.
- **ECharts Code Blocks**
  - Added support for fenced `echarts` blocks containing JSON chart options.
  - Charts load ECharts on demand, resize with the editor layout, expose an accessible label, and dispose old instances before re-rendering.
- **Editor View Shortcuts**
  - Added `⌘-⌥-7` / `Ctrl-Alt-7` for side-by-side WYSIWYG, `⌘-⌥-8` / `Ctrl-Alt-8` for pure Markdown, and `⌘-⌥-9` / `Ctrl-Alt-9` for stacked WYSIWYG.
- **Localized Startup Tips**
  - Added `static/data/editor-tips.json` as the bilingual source of editor usage tips.
  - The editor now chooses one tip at random on each load and types it below the Stray Birds placeholder in the same animation.
- **Footer Copy**
  - Added Copy beside Markdown Export in the Footer.
  - Copies rich HTML plus Markdown/plain-text fallback for Notion, Jira, and similar editors.
  - Shows a localized check animation and copied status after success.
- **Admin Dashboard**
  - Added URL totals, published/protected/Sitemap counts, legacy view totals, and retained version totals.
  - Added title/URL search, Markdown full-text search, modified-date range filters, sorting, and server-side pagination.
  - Added clickable column sorting and per-note publish, Sitemap, lock, view, version, and last-modified status columns.

### Fixed
- **Pasted Image Upload Persistence**
  - Fixed pasted images reverting to `![Uploading...]()` after reload even though the image had uploaded successfully to R2.
  - The uploaded image URL now triggers the editor auto-save flow immediately after the upload completes.
- **Password Lock Consistency**
  - Fixed share-page authentication rejecting a correct Edit Lock when no View Lock was configured.
  - Unified direct-note and share authentication for Edit Lock, View Lock, and both-lock combinations.
  - Prevented view-only sessions from saving notes, changing settings, changing locks, or invoking AI editing endpoints.
  - A View Lock without a separate Edit Lock now acts as the sole owner credential, so the note remains recoverable after enabling it.
- **Admin Route Runtime Configuration**
  - Fixed `SCN_ADMIN_PATH` and `SCN_ADMIN_PW` being read before Cloudflare Worker bindings were available.
  - The configured god-mode backend route, such as `/admin333`, is now resolved per request before the dynamic note route.
- **Toolbar Localization**
  - Inline code and other inserted placeholders now follow the current English or Traditional Chinese editor language instead of always using Chinese text.
- **Inline Code Icon**
  - Escaped the `</>` glyph so it renders correctly in the HTML toolbar.
- **Footer View Settings Grouping**
  - Grouped Preview, Layout, and Device controls together as one editor view-settings group.
- **Share Link Navigation**
  - Markdown links rendered inside share URLs now open in a new tab with `noopener noreferrer`.

### Changed
- **Compact Footer Controls**
  - Reduced the desktop footer height to reclaim vertical workspace while keeping two-line labels readable.
  - Standardized preview, publishing, font, language, layout, and device controls as square-corner rail switches.
  - Moved control names and current values inside the rails, such as `Layout / Side` and `Device / Desktop`.
  - Removed redundant `Width` and `Theme` footer labels; width context now appears in each select option.
- **Theme Selector Descriptions**
  - Restored full theme names and added localized Traditional Chinese and English style descriptions.
  - Added a tooltip for the selected theme so the full description remains discoverable without widening the footer.
- **Lock Labels**
  - Changed the English lock labels to `Edit` and `View`, with `Edit lock` and `View lock` tooltips for clarity.

### Documentation
- Future user-facing changes must update `README.md`, `CHANGELOG.md`, and `static/data/editor-tips.json` when a startup tip is appropriate.
- Synchronized `skills/SKILL.md`, `LLM_API_DOCS.md`, and MCP guidance with the current editor features, ECharts authoring, bilingual tips, and `pw` / `vpw` lock policy.
- Added a mandatory pre-invocation freshness check: agents must fetch the canonical website-hosted `SKILL.md` before using the skill.

## [2026-07-12]
### Fixed
- **Theme CSS Specificity Override**
  - Changed `bundle_themes.js` selector replacement from `.markdown-body` to `#preview-md.markdown-body, #preview-plain.markdown-body`, giving theme CSS specificity (1,1,0) that beats `editor.css.js` `#preview-md` (1,0,0).
  - This fixes all dark themes (xAI, Tokyo Night, Kanagawa, Terminal, Catppuccin Macchiato) whose background and text colors were silently overridden by the base white canvas.
  - Removed hardcoded `background-color` from `markdown.css.js` for `table tr`, `code`, `pre`, and `img`, allowing themes full control over element backgrounds.
- **xAI Theme Colors**
  - Fixed heading colors for dark background: H2 `#ffffff`, H3 `#ff7a17` (sunset orange), H4 `#dadbdf`, H5-H6 `#9aa0a6`.
  - Body text changed to pure white `#ffffff` for maximum readability on `#0a0a0a` background.

### Added
- **Dynamic Stray Birds (Tagore) Placeholder**
  - Added dynamic fetching of a random Stray Birds poem from `https://answerbook.david888.com/StrayBirds` on page load.
  - The poem is appended to the editor's empty placeholder to keep the starting page engaging.
- **Desktop Preview Split Direction**
  - Added a persisted `Layout` control that lets desktop editors switch between side-by-side and stacked editor/preview panes.
  - Mobile editing remains stacked automatically.
- **Selection AI Edit Shortcut**
  - Show a contextual AI Edit button after text is selected in the editor and reuse the existing GPT-OSS 120B selection replacement flow.
- **GPT-OSS 120B AI Editing**
  - Added a separate AI editing button powered by `@cf/openai/gpt-oss-120b` for instruction-based passage insertion, partial editing, or full-note refinement.
  - Capture textarea selections before prompting and splice the model's replacement text into the exact selection range, guaranteeing that unselected content remains unchanged.
  - Require an explicit editing instruction and return the complete edited Markdown, including untouched content, while keeping the existing GLM formatting action unchanged.

### Fixed
- **Share Toggle and Editor Preview Regression**
  - Restored the published/unpublished share toggle and its options menu after a share toolbar rewrite disconnected the published control from its click handler.
  - Hoisted share-state initialization so it no longer throws before Markdown rendering, which had left the editor preview pane blank.
  - Reused the Preview toggle geometry for the share toggle instead of applying a conflicting smaller set of slider dimensions.
  - Moved the published/unpublished label below the toggle row to match the footer's two-line icon/control-over-label layout.
- **xAI Theme Heading Contrast**
  - Added explicit dark heading colors for the app's white preview canvas while retaining the black H1 panel, so every title level remains visible.
  - Ensure heading links inherit the heading color instead of being obscured by generic link styles.
- **AI Format Response Handling**
  - Fixed successful Workers AI output being passed to `returnJSON()` as HTTP headers, which caused `Invalid header value` for Chinese or multiline Markdown.
  - Return the formatted Markdown in the JSON response body and read it from `data.result` before replacing the full editor content.
  - Reduced unnecessary model reasoning, capped completion output, and extended the AI request timeout to tolerate Workers AI latency spikes.
  - Verified the production `@cf/zai-org/glm-4.7-flash` flow with Traditional Chinese input and output.
- **Present Button Infinite Retry**
  - Removed the broken `bind()` retry loop that spammed console with "Present button not found" every 500ms in edit/write mode.
  - Present button now binds once at DOM ready — only exists when mode is `md` or in share view.
- **Share Button Click Handler**
  - Fixed share button not responding to clicks. JS was selecting `.opt-share > input` (checkbox) but HTML is a plain `<button>`.
  - Changed selector to `.opt-share` and updated handler to use `APP_STATE.isPublished` instead of `e.target.checked`.
- **Share Button Visibility on Mobile**
  - Share button label (`toolbar-button-label`) now always shows even on mobile (≤960px), overriding the global hide rule.
  - Added green dot indicator on share dropdown when note is published, so users can see shared status at a glance.
- **Mobile Edit Layout**
  - Changed editor+preview from side-by-side to vertical (top-bottom) stack on mobile (≤960px).
  - Each pane takes 50% height; divider line switches from vertical to horizontal.
- **Theme Completeness**
  - Added missing CSS selectors to ALL 20 themes for complete markdown rendering.
  - Added: `thead`, `tbody tr:hover`, `figure`, `figcaption`, `kbd`, `dt`, `dd`, `dl`, `li::marker`.
  - All themes now have balanced braces and complete selector coverage.

### Changed
- **Unified Mobile Footer & Collapse Toggle**
  - Redesigned the mobile footer to match the PC version's two-line layout: icon on top, label description below.
  - Hides the developer/info section (GitHub, Skill, API) on mobile entirely.
  - Displays only the first row (edit actions) by default, and reveals the second row (appearance, language switcher, theme settings) when clicking the `...` (More) button.
  - Leverages smooth CSS transitions to expand the footer and adjust body padding from 72px to 180px, avoiding viewport overlapping.
  - Resolves the missing language switcher bug on mobile share views by rendering the "More" button outside the edit conditional.
- **AI Formatting Model**
  - Switched the focused formatting action from GLM 4.7 Flash to `@cf/openai/gpt-oss-20b` for lower-latency formatting with behavior consistent with the GPT-OSS 120B editing assistant.
- **Theme Selector Enhancement**
  - Added visual indicators (☀️/🌙) and descriptive labels to theme selector for better UX.
  - Themes now show: `ayu ☀️ 極簡温暖`, `bauhaus ☀️ 幾何藝術`, `botanical ☀️ 植物圖鑑`, etc.
  - Dark themes marked with 🌙: `cp-macchiato 🌙 柔和暗色`, `kanagawa 🌙 日本墨水`, etc.
- **Default Theme Changed**
  - Switched the default preview theme from `catppuccin-macchiato` to `claude-canvas` (warm humanist editorial style).
- **Footer Tools - Direct Buttons**
  - Removed dropdown menu for Import/Export/PDF buttons.
  - All three buttons now appear directly in the footer: 匯入 (Import), 匯出 (Export), 列印 (Print).
  - Share mode shows Export and Print buttons directly (no Import since it's read-only).
- **Footer Controls - Two-Line Layout**
  - All footer controls now use consistent two-line layout (control on top, label below).
  - Font selector, Language toggle, Preview switcher, Width selector, Theme selector all show labels below controls.
  - Added text labels: "Font", "Lang", "Device", "Width", "Theme" below each control.
- **Footer Info Section - Two-Line Buttons**
  - Changed GitHub, Skill, and API Doc links to two-line style (icon on top, text on bottom).
  - Added text labels: "GitHub", "Skill", "API" below each icon.
- **Share Button Layout**
  - Changed share button to icon+text two-line layout (icon on top, text on bottom) for consistency with other footer buttons.
- **Wrangler Updated**
  - Updated wrangler from v3 to v4.86.0.
  - Updated compatibility_date to 2024-12-01.

## [2026-07-11 23:30 CST]
### Changed
- **Footer Four-Section Reorganization**
  - Reorganized the footer from three sections (`Actions` / `Appearance` / `Meta`) into four logically-grouped columns: **Edit** / **Publish** / **Appearance** / **Info**.
  - **Edit** section: Lock buttons, Preview switcher, File & Export dropdown, Version History dropdown.
  - **Publish** section: Share dropdown/toggle, Present button, Recent Shares dropdown.
  - **Appearance** section: Font selector, Language toggle, Preview device, Width, Theme.
  - **Info** section: GitHub, Skill docs, API docs, Saved time.
  - This separation ensures editing tools never mix with publishing controls, and version history (D1-based) is clearly distinct from share history (localStorage-based).
- **Mobile Bottom Sheet Card Layout**
  - The mobile Bottom Sheet now displays Publish, Appearance, and Info sections as individual cards with section titles, improving scannability.
  - Removed the legacy `⋯` more button; the footer itself now triggers the Bottom Sheet on mobile tap (outside the Edit section).

## [2026-07-11 22:30 CST]
### Changed
- **Claude Canvas Style Theme**: Added a new humanist editorial theme inspired by Anthropic's Claude website design, featuring a warm cream canvas background (`#faf9f5`), coral active highlightings (`#cc785c`), a humanist sans-serif body layout with serif headers, dark-surface code blocks, and custom styled alert blocks. Integrated it fully with the Vite/Wrangler theme bundling process and API lists.
- **Footer UI/UX Redesign & Optimization**
  - **SVG Icon Conversion**: Replaced all abstract Unicode symbols (`✎`, `◌`, `↗`, `▶`, `⧉`, `×`, `⤴`, `⤵`, `▣`, `◷`, `⋯`, `◇`, `◫`) with a unified, lightweight SVG icon system.
  - **Secondary Actions Dropdown Grouping**:
    - Grouped the cluttered 5 share-related actions into a clean "Share ▾" dropdown, moving `Unpublish` to the bottom as a styled warning item to prevent misclicks.
    - Moved Markdown Import, Export, and PDF generation into a unified "File & Export" dropdown.
    - Grouped Recent Shares and Version History into a unified "History" dropdown.
    - This reduces actions list buttons from 10+ down to 4-5 neat sections, reducing visual noise.
  - **Mobile Pill Bar & Bottom Sheet**:
    - Converted the mobile footer layout into a modern floating Pill bar (`48px` height).
    - Shuffled appearance/meta sections into a custom sliding **BottomSheet** drawer on mobile screen widths (under 960px).
    - Equipped the mobile drawer with a fuzzy glass backdrop, swipe-down to dismiss gesture support, and scroll-bubbling prevention.
  - **Directional Scroll Hiding**: Refined the share-view mobile auto-hide logic to hide on page scroll-down and show on scroll-up (directional sensing) with near-edge sticky logic, removing the abrupt 900ms timer showing.
  - **Select & Segmented Toggle Enhancements**:
    - Custom styled theme & width dropdowns by eliminating native `<select>` arrows and using CSS-driven SVG arrows.
    - Added CSS transitions for `segmented-toggle-btn` to make state switching smoother.
    - Improved the font switcher label to a clear `Font: JB Mono / Maple` instead of the cryptic J / M toggle.
  - **Mobile Keyboard Avoidance**: Automatically hid the mobile footer Pill bar when the virtual keyboard is active (via `visualViewport` height resize tracking).
  - **Toast Notifications**: Replaced intrusive browser alerts and raw button label mutations with clear, smooth, frosted-glass toast notifications for copy actions.
  - **Edge Cases & Stack Level Fixes**:
    - **Dynamic Dropdown Boundary Sensing**: Added viewport boundary detection on dropdown trigger clicks to automatically flip the dropdown downward (`top: 100%`) when it risks overflowing the top edge of the viewport.
    - **Z-Index Fine-tuning**: Increased `.dropdown-menu` z-index to `1060` to prevent conflicts with `.bottom-sheet` (z-index `1050`) and boosted toast notifications to `20000` to keep them visible over presentation mode's slides.

## [2026-07-11 16:20 CST]
### Changed
- **Footer File Tools**
  - Added compact footer icon tools for `Import Markdown`, `Export Markdown`, and `Print / Export PDF` without changing the existing preview/edit interaction model.
  - Added a direct footer `API` documentation link next to the built-in `Skill` link, both with explicit tooltip / aria labels.
  - Kept the controls text-light so the footer remains narrow on constrained widths.
- **Footer Share / Lock Cleanup**
  - Replaced the raw published share URL field with a compact `Share / 分享頁` button that opens the shared page in a new tab, while keeping dedicated copy buttons for share and presentation URLs.
  - Converted `Edit Lock / Read Lock` into icon controls with active visual state to reduce footer width.
  - Reduced saved-time chrome further from `Saved ◷` / `保存 ◷` to a single `◷` icon with the absolute timestamp kept in the tooltip.
- **Short Share Slug Compatibility**
  - New shared notes now prefer a short `shareSlug` while preserving the legacy `md5(path)` share key for backward compatibility.
  - Existing long share URLs remain valid because the Worker now accepts both short slugs and legacy MD5-based share ids.
- **Footer Icon Consistency**
  - Converted `Recent Shares / History / Skill / API` into icon-first footer controls with tooltip and aria-label coverage, keeping the footer visually tighter without dropping discoverability.
### Documentation
- Updated `README.md` to describe the new footer file tools and compact API / Skill doc entry points.

## [2026-07-11 15:55 CST]
### Changed
- **Footer Width Tuning**
  - Kept the stable footer interaction model intact, but reduced visual width usage by changing saved-time display to a compact `Saved ◷` label with the absolute timestamp in a tooltip.
  - Shortened theme selector labels such as `catppuccin-macchiato` to compact forms like `cp-macchiato` and reduced the selector width to better fit narrow footer layouts.
### Documentation
- Updated `README.md` to describe the compact saved-time display and shortened theme labels.

## [2026-07-08 12:40 CST]
### Fixed
- **Share Page Edit Link Regression**
  - Fixed shared-note footer `edit` behavior so unlocked share pages link directly back to the note path instead of incorrectly opening the password prompt flow.
  - Limited share-page `authPath` injection to actually locked notes only, preventing public shares from being treated like password-protected edit entries.

## [2026-07-08 10:50 CST]
### Changed
- **Agent Skill Single Source**
  - Made `skills/SKILL.md` the only human-edited source for the published agent skill document.
  - Added `scripts/generate-agent-skill.mjs` plus npm pre-hooks so test/dev/deploy regenerate the bundled Worker skill artifact before use.
  - Updated the built-in footer skill link to point at the site-local `/.well-known/agent-skills/david888-wiki-publisher/SKILL.md` endpoint instead of the GitHub blob URL.
- **LLM Docs Coverage**
  - Expanded `LLM_API_DOCS.md` to document markdown negotiation, `publicIndex`, lock semantics (`pw` vs `vpw`), persisted appearance values, slide authoring syntax, and the editor-session routes `/:path/setting` and `/:path/pw`.

### Fixed
- **Skill Drift Risk**
  - Added test coverage that fails when the generated Worker skill markdown diverges from `skills/SKILL.md`.

## [2026-07-07 13:30 CST]
### Fixed
- **Edit Lock vs Read Lock Semantics**
  - Corrected direct note route behavior so `編輯鎖 / Edit Lock` only blocks editing and no longer blocks normal reading.
  - Kept `閱讀鎖 / Read Lock` as the stronger mode that blocks both reading and editing until authentication succeeds.
- **Readonly-to-Edit Upgrade Flow**
  - Changed the readonly note footer `edit` control from a plain link into an auth-triggering action, so locked notes can prompt for the edit password and upgrade into the editor correctly.
- **Password Auth Reliability**
  - Moved secret/salt reads to runtime instead of module-load time, preventing worker failures such as `secret must be a string`.
  - Added compatibility for legacy password hashes created during the broken runtime-config window, so existing edit locks continue to work.
- **Password Entry UX**
  - Replaced plaintext browser `prompt()` password entry with a masked in-page password modal for both unlock and password-setting flows.
- **Client Error Handling**
  - Hardened frontend JSON API parsing so non-JSON Worker error pages surface as readable errors instead of crashing with `Unexpected token 'W'`.
- **New Note Creation Flow**
  - Restored the root-to-random-slug workflow so `https://wiki.david888.com/` redirects to a fresh slug that opens the editor directly instead of falling into a 404-like blocked state.

## [2026-07-07 00:00 CST]
### Added
- **Well-Known API Discovery**
  - Added `/.well-known/api-catalog` and return an RFC 9727-compatible Linkset document as `application/linkset+json`.
  - Added `/docs/api`, `/openapi.json`, and `/api/health` so the API catalog can point to real machine-readable and human-readable API resources.
- **Agent Skills Discovery Index**
  - Added `/.well-known/agent-skills/index.json` using the Agent Skills Discovery v0.2.0 schema.
  - Added a published skill artifact at `/.well-known/agent-skills/david888-wiki-publisher/SKILL.md`.
- **Agent-Oriented Markdown Discovery**
  - Added `/auth.md` as a markdown agent-auth guidance document.
  - Added markdown content negotiation for note/share pages that already have raw markdown sources, returning `text/markdown` when `Accept: text/markdown` is sent.
  - Added guarded browser-side WebMCP tool registration for reading the current markdown, copying share links, and opening presentation mode.
  - Added a note-level `publicIndex` metadata flag for future sitemap inclusion decisions.

### Changed
- **Homepage Discovery Headers**
  - Added `Link` response headers on `/` advertising `api-catalog`, `service-doc`, and `service-desc` resources for automated agent discovery.
- **Share Publishing UI**
  - Removed the redundant `Published:` prefix from the published share URL area.
  - Reused the published-toolbar space for a sitemap opt-in control that toggles whether a shared note should join the future public index.
  - Added a post-publish prompt asking whether the new share link should be added to the public index, with a default private state and an explicit approval action.

### Fixed
- **robots.txt Coverage**
  - Added a plain-text `/robots.txt` route served by the Worker.
  - Published explicit `User-agent` rules for `GPTBot`, `OAI-SearchBot`, `Claude-Web`, and `Google-Extended`, alongside default crawler rules for key public and private paths.
  - Added `Content-Signal: ai-train=no, search=yes, ai-input=no` directives to declare AI content preferences.

## [2026-07-02 00:00 CST]
### Fixed
- **Share Appearance Settings Now Persist Per Note**
  - Persisted `Width`, `J / M` share font, and editor `Desktop / Mobile` preview device into note metadata instead of leaving them only in browser localStorage.
  - Shared notes now initialize width and font from the note's saved metadata, so other viewers see the same appearance choices.
  - Added metadata-aware fallback logic so older notes can still fall back to existing browser localStorage values until they are re-saved.

### Changed
- **Appearance Controls Save Through Canonical Note Settings**
  - Share/footer appearance controls now save through the note's canonical `/:path/setting` route when a backing note path is available.
  - Exposed the `J / M` share-font selector in the editor footer as well, so editors can set the shared reader font before distributing the share URL.

## [2026-06-26 00:00 CST]
### Added
- **Independent Note History UI**
  - Added a separate editor footer "版本 / History" entry when D1 note history is enabled.
  - Added a dedicated history modal for listing saved versions, viewing preview/raw content, copying an old version, and restoring it into the current editor.
  - Kept the existing "最近分享 / Recent shares" modal independent so share-link history remains unchanged.

### Changed
- **Footer Toolbar Refresh**
  - Reworked footer controls into a flatter, more consistent toolbar style with unified button height, radius, border, hover, and focus states.
  - Removed legacy inline footer styles from publish, copy, presentation, edit-back, and skill controls.
  - Normalized icon-like actions with stable Unicode glyphs so toolbar controls no longer vary heavily by emoji sizing.

## [2026-06-25 12:30 CST]
### Added
- **Optional D1 Note History**
  - Added an opt-in D1-backed note history system controlled by `SCN_ENABLE_NOTE_HISTORY` and `NOTE_HISTORY_DB`.
  - Added history API endpoints: `GET /api/:path/history`, `GET /api/:path/history/:versionId`, and `POST /api/:path/history/:versionId/restore`.
  - Added `schema/note_history.sql` for initializing the D1 history table.

### Changed
- **History Retention Defaults**
  - History retention now defaults to `10` versions per note via `SCN_NOTE_HISTORY_LIMIT`.
  - Added `SCN_NOTE_HISTORY_MIN_INTERVAL_SECONDS` with a default of `300` seconds so editor autosave does not create a history row on every keystroke.
- **Note Deletion Cleanup**
  - Admin deletes and empty-note cleanup now remove matching history rows from D1 when note history is enabled.

### Fixed
- **Emergency Rollback for Editor UI Regression**
  - Rolled back the new history-tab editor UI after it caused a client-side regression in the shared editor flow.
  - Restored the previous `Recent shares` modal while keeping the D1 history backend and APIs in place.
  - Fixed `checkAuth()` caller regressions where some routes still treated the returned object as a boolean.

## [2026-06-18 11:30 CST]
### Added
- **Raw Markdown API Uploads**
  - Added `POST /api/:path` support for `Content-Type: text/markdown` and `text/plain`.
  - Agents and shell scripts can now upload a local `.md` file with `--data-binary @file.md` instead of JSON-escaping the entire document.
- **Multipart Markdown API Uploads**
  - Added `POST /api/:path` support for `multipart/form-data` markdown uploads.
  - Accepts form fields such as `file`, `markdown`, or `text`, plus `append`, `public`, `share`, `theme`, `pw`, and `vpw`.

### Changed
- **LLM / curl API Guidance**
  - Updated `README.md`, `LLM_API_DOCS.md`, and `skills/SKILL.md` to recommend direct markdown/file upload for long documents.
  - Kept the existing guidance to prefer a concise summary plus source path/URL for very large reference files that do not need full mirroring.

## [2026-06-17 15:10 CST]
### Added
- **Browser-Local Share History**
  - Added a footer "Recent shares" entry that stores share links in browser localStorage.
  - Tracks "Created" share URLs when a note is published or an already-published editor page is opened.
  - Tracks "Viewed" share URLs when a browser opens a shared note, keeping the feature client-side without adding KV writes.
  - Moved the "Recent shares" entry into the footer `Actions` group because it behaves like a navigation/action utility.
- **Share Page Back-to-Top Control**
  - Added a compact `＾` button on shared-note pages for long articles.
  - Shows only after the reader scrolls down, then smoothly returns the article container to the top.

### Fixed
- **Share Page Anchor Links**
  - Added stable heading IDs after client-side Markdown rendering so shared-note hash links can jump to headings.
  - Re-runs hash scrolling after Markdown hydration and on `hashchange`, fixing links that previously failed because the browser handled the hash before the rendered heading existed.
  - Uses a GitHub-style slug compatible with Chinese/English mixed headings, including links like `#主題二輸入bd-轉接之甲方需求與變更申請自動化-client-demand-to-backlog-engine`.
  - Added compact heading aliases for existing TOC links that omit punctuation between Chinese labels and English terms.

### Changed
- **Mobile Share Footer**
  - Mobile share pages now keep the footer compact by showing only `Actions` by default.
  - Added a `...` control to expand appearance/meta tools only when needed.

## [2026-06-16 00:00 CST]
### Fixed
- **Share Metadata Title Extraction**
  - Updated shared-note title extraction to ignore weak short slug-like metadata titles such as `gkfp` when the note body contains a stronger human-readable title.
  - Keeps explicit descriptive metadata titles as the first choice, while falling back to the first meaningful content title for Open Graph, Twitter, and browser titles.
  - Deployed the fix with Wrangler and verified the live share page now emits the full `og:title`.
- **Share Card Branding Weight**
  - Stopped emitting `og:site_name` on shared-note pages so IM/social previews emphasize the note title instead of the `david888 wiki` app name.

## [2026-06-15 15:20 CST]
### Fixed
- **Mermaid CJK Text Clipping**
  - Updated Mermaid initialization to wait for browser font readiness before rendering diagrams, reducing incorrect text measurements during first paint.
  - Switched Mermaid flowcharts to SVG text labels instead of HTML labels, avoiding truncated mixed Chinese/English node text in shared diagrams.
  - Added Mermaid-specific SVG overflow and font-family guards so long node titles and top-aligned labels are less likely to be clipped.

## [2026-06-13 18:30 CST]
### Fixed
- **Print & PDF Layout Stylesheet**
  - Added dedicated `@media print` layout styles in `base.css.js` to ensure the document paginates correctly when printed or exported using the browser's "Save as PDF" feature.
  - Hid non-printable UI elements such as footers, split dividers, edit panels, modals, and loading icons.
  - Removed view-port constraints (`height: 100vh`, `overflow: hidden`) on all layout levels (`html`, `body`, `.note-container`, `.stack`, `.layer_3`, and `.preview-pane`) to allow full multi-page flow.
  - Configured `-webkit-print-color-adjust: exact` to retain themes' premium visual features like table borders, blockquote decorations, and alert block background tints.
  - Prevented orphan headers and mid-element page-splits on code pre blocks, quotes, tables, and images.

## [2026-06-10 10:40 CST]
### Fixed
- **Share Font Assets on Cloudflare**
  - Configured Wrangler static asset serving for the `static/` directory so bundled share-page fonts are delivered correctly in browsers, including Android.
  - Switched the bundled font URLs from `/static/fonts/...` to `/fonts/...` and verified both `JetBrainsMono-Medium.woff2` and `MapleMonoNormal-Medium.woff2` return `font/woff2`.

### Changed
- **Share Footer Font Switcher**
  - Replaced the old share-page `Maple Mono` on/off toggle with compact `J / M` buttons for `JetBrains Mono` and `Maple Mono`.
  - Set `JetBrains Mono` as the default share-page reader font, while keeping `Maple Mono` as the alternate option saved in localStorage.
  - Added native hover tooltips to the `J`, `M`, and edit buttons so the compact footer controls remain self-explanatory.
- **Footer Information Architecture**
  - Reorganized the editor and share footers into grouped `Actions`, `Appearance`, and `Meta` sections.
  - Moved appearance-related controls such as `J / M`, `Zh / En`, width, theme, and preview device into the same visual group for faster scanning.

## [2026-06-09 15:00 CST]
### Added
- **Share-Page Google Analytics Config**
  - Added `SCN_GA_MEASUREMENT_ID` support for loading Google Analytics on shared-note and shared-presentation pages.
  - Documented the Cloudflare / Wrangler setup in `README.md` and `wrangler.toml.example`.

### Changed
- **Site-Wide Google Analytics Loading**
  - Expanded `SCN_GA_MEASUREMENT_ID` loading from share pages to editor pages as well, so `wiki.david888.com` traffic is tracked without extra footer code.
- **Built-In Icon Routes**
  - Replaced the old external icon URL with Worker-served `/icon.svg`, `/icon.png`, and `/favicon.ico`.
  - Updated OG / Twitter preview images to use the built-in icon asset.
- **Social Card Branding**
  - Updated the social card title to `Notepad 888` and subtitle to `Markdown wiki for You`.
  - Switched `/og-image.png` to a dedicated 1200x630 social card instead of the plain icon image.

## [2026-06-09 14:47 CST]
### Changed
- **Share View Tracking Disabled**
  - Removed footer view-count display from the editor/share UI.
  - Stopped writing per-visitor share view counters into Cloudflare KV to avoid ongoing free-plan write usage.

## [2026-06-09 14:36 CST]
### Fixed
- **Centered Editor Split**
  - Resets the editor and preview panes to an exact 50/50 split when switching between desktop and mobile preview modes.
  - Added double-click reset behavior to the draggable divider.

## [2026-06-09 14:31 CST]
### Fixed
- **Responsive Mobile Tables**
  - Added fixed-layout table fitting for the editor mobile simulator and real mobile share pages.
  - Allows long cell text, inline code, parameters, and URLs to wrap instead of overflowing the mobile viewport.

## [2026-06-09 14:25 CST]
### Fixed
- **Presentation Bottom Safe Area**
  - Reserved a 56px bottom safe area above Reveal.js progress, slide number, and navigation controls.
  - Updated slide fitting to account for the smaller usable height so long slides do not stick to the bottom edge.

## [2026-06-09 14:22 CST]
### Fixed
- **Presentation Quote and Slide Fit**
  - Reduced presentation body and blockquote typography so quoted metadata remains compact.
  - Added per-slide font fitting when content exceeds the presentation viewport, followed by a second table-fit pass.

## [2026-06-09 14:18 CST]
### Fixed
- **Presentation Heading Scale**
  - Reduced presentation-mode `h1`, `h2`, and `h3` sizes and spacing so long Chinese headings no longer dominate the slide.

## [2026-06-09 14:13 CST]
### Fixed
- **Editor Footer and Mobile Preview Layout**
  - Prevented the editor footer controls from wrapping into a second row.
  - Kept the editor/preview divider near its existing split position when mobile simulation is enabled by placing the phone frame inside a full-width preview pane.

### Changed
- **Preview Toggle Label**
  - Renamed the `Markdown` switch to `預覽` / `Preview`.
  - Preview-only controls are hidden when preview mode is disabled.

## [2026-06-09 14:00 CST]
### Added
- **Desktop / Mobile Preview Toggle**
  - Added an editor footer segmented toggle for switching the right-side Markdown preview between desktop and mobile simulation modes.
  - Saves the selected preview device mode in localStorage.

### Changed
- **Compact Footer Lock Labels**
  - Shortened password control labels to `編輯鎖` / `閱讀鎖` and `Edit Lock` / `Read Lock`.

## [2026-06-09 13:45 CST]
### Changed
- **Footer Compact Controls**
  - Shortened the last-saved footer text to compact relative time, such as `保存 5h前` and `Saved 5h ago`.
  - Replaced the language dropdown with a front-positioned `Zh / En` segmented toggle.

## [2026-06-09 13:42 CST]
### Fixed
- **Presentation Table Fit**
  - Added presentation-mode table auto-fitting so wide or tall Markdown tables are scaled to remain on the same slide.
  - Re-runs table fitting after Reveal.js initialization, slide changes, and viewport resize events.

## [2026-06-09 13:38 CST]
### Added
- **Publish Nudge + Language / Share Footer UX**
  - Added an editor-side publish nudge that appears after the user stays focused in the input area for 3 minutes with non-empty unpublished content.
  - Consolidated UI localization to maintained `en-US` and `zh-TW` strings, with Chinese browser languages mapped to `zh-TW` and all other browser languages mapped to `en-US`.
  - Added an `En / Zh` footer selector backed by a `lang` cookie so users can override automatic language detection.
  - Added mobile share-page footer auto-hide behavior while scrolling, with the footer reappearing when scrolling up or after scrolling pauses.
  - Added a `#share-analytics-hook` placeholder in the share footer for future GA / analytics injection without adding KV-backed share view writes.

### Changed
- **Wrangler Script Cleanup**
  - Updated npm scripts to use `wrangler deploy` instead of the deprecated `wrangler publish` command.

## [2026-05 之前]
### Added
- **Default Theme Refresh + Documentation Cleanup**
  - Switched the default preview theme fallback from `tokyo-night` to `catppuccin-macchiato` for newly created or unthemed notes.
  - Added `catppuccin-macchiato` and `catppuccin-latte` to the TypeScript theme registry so the theme selector and bundled preview metadata stay aligned.
  - Moved the legacy `20251229 開發日誌` section out of `README.md` into this changelog and left a direct changelog link in the README.

- **Share Metadata + Site Icon Polish**
  - Added server-rendered Open Graph and Twitter card metadata for shared notes so Slack and other unfurlers can read stable titles and descriptions without relying on client-side rendering.
  - Switched page head metadata to use the repo-provided notepad icon as the favicon and social preview image for shared notes.
  - Added note-title and note-description extraction helpers so shared-note metadata is generated consistently from note content on the server side.

- **Share Theme Consistency + Font Toggle**
  - Added a share-page `Maple Mono` on/off toggle next to the `返回編輯` button, backed by localStorage so each browser can keep its own preference.
  - Reused the bundled `static/fonts/MapleMonoNormal-Medium.woff2` asset as the optional share font instead of duplicating another copy.
  - Standardized share-page body typography to the `tokyo-night` baseline (`16px` body size, `1.8` line-height) so theme switches no longer visibly shrink or enlarge paragraph text.
  - Standardized share-page heading and inline-code sizing to the `tokyo-night` scale so themes like `newsprint` no longer render noticeably smaller than dark themes.

- **Theme Table Color Fixes**
  - Fixed dark-theme table body colors in `tokyo-night` so rows no longer fall back to white backgrounds.
  - Fixed dark-theme table body colors in `kanagawa` so rows no longer fall back to white backgrounds.
  - Fixed `terminal` table body rows and cells so the terminal theme keeps a dark background instead of leaking the base markdown table white fill.
  - Fixed table header backgrounds for `playful-geometric`, `organic`, `retro`, `botanical`, `bauhaus`, `maximalism`, and `terminal`/other affected themes by explicitly styling `thead th`.

- **Theme Table Header Contrast Refresh**
  - Strengthened table header contrast for the `tokyo-night` and `kanagawa` preview themes with clearer header backgrounds, brighter label color, and stronger separation from table rows.
  - Added a small shared table-header emphasis layer in the base template so low-contrast headers remain more legible across themes.

- **Editor Font + Dark Preview Themes**
  - Added bundled `Maple Mono` as the default font for both the editor pane and preview pane.
  - Added two new preview themes inspired by popular Neovim colorschemes: `tokyo-night` and `kanagawa`.
  - Switched the default preview theme fallback from `github-light` to `tokyo-night` for newly created or unthemed notes.
  - Removed fixed preview content widths from bundled themes so split-view previews can fully use available space.
  - Added a footer `Width` selector with persistent browser-side preference (`Full`, `960`, `1200`, `1440`) for quick preview width control.

- **Dedicated Presentation Share Entry**
  - Added a dedicated presentation route at `/share/:md5/present` so shared notes can open directly in slideshow mode.
  - Presentation links now preserve Reveal slide hash deep-links, allowing links such as `/share/<id>/present#/24` to open a targeted slide.
  - Password-protected shared notes preserve the requested presentation destination and return to the same slide after successful authentication.
  - Added a presentation-link copy action alongside the existing shared-link copy action in the editor footer.
  - Updated Skill and MCP guidance so AI clients can surface presentation links derived from `shareUrl`.

- **LLM/Crawler Support (Share URL Optimization)**
  - Intercepts `HEAD` HTTP requests globally to safely return HTTP 200 (with an empty body), preventing Cloudflare Workers from throwing `500 Internal Server Errors` when bots probe the site.
  - Injects a visually hidden, SEO-friendly `<article>` element containing raw markdown content into the base template. This resolves the issue where Client-Side Rendered (CSR) markdown inside `<textarea>` is completely ignored by bots (like ChatGPT-User, ClaudeBot, and generic URL unfurlers) that do not execute JavaScript.

- **Slidev-style Presentation Mode (Reveal.js Integration)** 📽️
  - Added a "Present" button to enter a fullscreen, interactive slideshow mode.
  - Supports Markdown slide splitting using the standard `---` separator (Slidev/Marp style).
  - Powered by Reveal.js with smart lazy loading (loads assets only on demand).
  - Seamlessly works in both Edit mode and Share mode.

- **Slidev-Lite Enhancement (Version 2.0)** 🚀
  - **Layouts**: Added support for `::left::` and `::right::` split-screen layouts.
  - **Click Animations**: Support for `{v-click}` syntax for interactive slide elements.
  - **Premium Aesthetics**: Integrated Inter font, dark theme optimization, and enhanced code block styling.
  - **UX Polish**: Switched to fade transitions and top-left alignment for a more professional feel.

## [2025-12-29]
### Changed
- **核心穩定性修復 (v2.0)**
  - 環境變數在模組載入時無法訪問，改用 getter 函數在運行時讀取。
  - `enableR2` 資料結構不匹配，已合併回 `ext` 物件以統一頁面渲染上下文。
  - 修復資料覆寫風險：將瀏覽計數自筆記正文讀寫流程中拆離，改存於 `SHARE` KV 的 `views::{path}` 鍵，避免 GET 與 POST 並發時舊內容覆蓋新內容。
  - 修復權限判斷：編輯頁面只接受編輯密碼，分享頁則接受查看密碼或編輯密碼，區分 `edit` / `view` 權限。
  - 修復分享頁渲染：確保 Share 模式下正確載入 `marked.js` 與 `DOMPurify`，避免頁面空白。
  - 導入 `visitor_id` Cookie 做獨立訪客計數，避免重複刷新灌水。

### Added
- **高級圖表支援 (Advanced Diagrams)**
  - 新增 Mermaid (` ```mermaid `)、Flowchart.js (` ```flow `)、JS Sequence Diagrams (` ```sequence `)、Graphviz / Viz.js (` ```graphviz `) 與 ABC.js (` ```abc `) 支援。
  - 圖表引擎採用智慧懶加載，只在頁面偵測到對應程式碼區塊時才載入外部函式庫。

- **其他增強**
  - 新增可拖曳的編輯器 / 預覽分隔欄，支援調整左右面板寬度。
