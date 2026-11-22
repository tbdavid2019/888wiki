# Lightweight Passkey Account, Personal Main Space & Toggleable Public Share Circles（簡易 Passkey 帳號、個人主空間與公開小圈圈）

* **Author:** David (tbdavid2019) & EGM Brainstorm Session
* **Date:** 2026-11-22

## Overview

在 `cf-notepad`（`wiki.david888.com`，Cloudflare Workers + KV + R2 + D1）中新增一層「零權限的個人索引與跨裝置同步層」，目標是讓使用者不破壞原有匿名免登入編輯與筆記層級 `pw`/`vpw` 密碼鎖流程的前提下，以 Passkey 建立與登入個人帳號，將跨格式（Markdown、Block、Canvas、Whiteboard）的個人筆記、收藏、具名站內劃線批註彙整至私有主空間，並可自行建立多個可隨時開關的公開小圈圈（僅對外呈現已發布且非機密 Seal 的 `/share/:shareId` 連結）。

本 brief 綜合了 6 位獨立零脈絡 Goldfish 審查代理（`egm-design`、`egm-codebase-details`、`egm-zoom-out`、`egm-comprehension`、`egm-implementation-readiness`、`egm-structural`）直接核對原始碼後的壓力測試結果。

## Analysis

### 審查參與狀態（6/6 完成）

| Goldfish 審查視角 | 狀態 | 核心焦點 |
| :--- | :--- | :--- |
| `egm-design` | completed | WebAuthn 密碼學／DoS、能力越權、XSS 升級、Login CSRF、D1 寫入與配額 |
| `egm-codebase-details` | completed | 原始碼逐行核對、既有機制 Bug、路由碰撞、`db:init` 冪等性、維運可觀測性 |
| `egm-zoom-out` | completed | YAGNI、v1 範圍精簡、長期維護債與現有功能複用（Book Mode、`#share-history-btn`） |
| `egm-comprehension` | completed | 使用者心智模型衝突、零權限反直覺事故、術語重疊與錯誤體驗 |
| `egm-implementation-readiness` | completed | Schema 遷移安全、混合儲存驅動相容、狀態轉移契約與實作前置定案清單 |
| `egm-structural` | completed | 命名體系凍結、URL 命名空間隔離、資料表職責分離與單體檔案拆分 |

---

### 一、🔴 Blocker 級發現（進入 `/egm-draft` 前必須明確拍板或修正）

#### B1. 訪客匯入「未分享本機草稿路徑」與現行 `save_policy.mjs`、`deleteEmptyPages()` 及 4 碼 Slug 重用衝突
* **現有程式碼事實**：
  * `src/save_policy.mjs:3` 強制 `canPersistNoteContent = metadata => metadata?.share === true`，`POST /:path`（`src/index.js:4349-4351`）拒絕將未發布草稿內文寫入雲端；未發布草稿只存在原瀏覽器的 IndexedDB（`CloudNotepadOfflineDB`，`static/js/offline-store.mjs:9-140`）與 `localStorage['cf-notepad:notes-metadata']`。
  * 伺服器對 `/new/:format`（`src/index.js:616-621`）僅建立空白殼，每日 01:00 UTC 的 `deleteEmptyPages()` Cron（`src/index.js:4472-4486`、`src/helper.js:219-304`）會永久刪除所有內文為空且無密碼的筆記。
  * `wrangler.toml:18` 設 `SCN_SLUG_LENGTH = "4"`（28 字元集，總空間 614,656）。空草稿被 Cron 清理或管理員刪除後，同 slug 會回到隨機池並可能分配給陌生人；若主空間只存 `path`，原帳號日後點擊會直接開啟陌生人的編輯頁（跨帳號劫持）。
  * `src/templates/base.js:4369`（`buildOfflineDraftRecord`）直接拿內容第一行當標題，導致 Block / Canvas / Whiteboard 本機草稿標題全是 `"{"`。
* **必要修正方向**：
  * 不得承諾未發布草稿可跨裝置同步內文。未發布草稿應留在裝置本機區塊（直接讀 `offlineStore` 並標註「僅此瀏覽器本機，未發布前不會同步雲端」），或若寫入索引須顯式標記 `local_only_draft` 且禁止視為雲端內容。
  * 在 `notes.metadata` 建立不可變的 16-byte CSPRNG `noteUid`；所有帳號索引與小圈圈項目綁定 `note_uid`，讀取時核對不相符即隱藏（阻斷 4 碼 slug 重用劫持）。
  * 不在空 `GET /new/:format` 寫入主空間索引（避免造訪 `/` 自動跳轉 `/new/:format` 製造大量空白垃圾），改於首次實質發布／存檔時記錄。

#### B2. 能力邊界破口：書籤、訪客匯入與具名註解可能洩漏他人筆記的秘密編輯網址 `/:path`
* **現有程式碼事實**：
  * 本站對未設 `pw` 的筆記而言，知道 `/:path` 即具完整覆寫權；分享頁刻意對非作者隱藏 `APP_STATE.path`（`src/templates/base.js:1427`）。
  * **既有程式碼 Bug**：`src/templates/base.js:5767` 的 `if (initialShareUrl) recordShareHistory('created', ...)` 漏檢查 `APP_STATE.isEdit`，導致使用者每次瀏覽別人的 `/share/:shareId` 都會同時寫入 `cf-notepad:share-history:viewed` 與 `created`。
  * `schema/note_annotations.sql:3` 的 `annotation_threads.path` 儲存的是內部編輯 `path` 而非 `shareId`。
* **必要修正方向**：
  * 先修復 `src/templates/base.js:5767`（加上 `APP_STATE.isEdit` 判斷）。
  * 個人索引強制區分能力等級（`access_level IN ('edit', 'share_only')`）：從 `/share/:shareId` 收藏、匯入 `viewed` 或來自他人文章的具名註解，API 與 DOM **嚴禁輸出 `note_path` 或編輯連結**，只能輸出即時解析的 `/share/:shareId`。
  * Guest Import 收到純 `/share/:shareId`（無對應有效 `cn_author_*`／edit `auth` Cookie 或本機已知 `path` 佐證）時，一律降級為 `share_only`，不得藉反查把編輯路徑回傳給呼叫端。

#### B3. 既有 `src/fido_auth.mjs` 存在 DoS／密碼學驗證缺口、同步 Passkey 相容缺陷與 Admin FIDO 撞鍵
* **現有程式碼事實**：
  * **DoS 與解析漏洞**：`decodeCbor`（`src/fido_auth.mjs:83-152`）無遞迴深度上限、無緩衝區邊界檢查、無陣列／Map 長度上限，數十 bytes 畸形 `attestationObject` 即可打爆 Worker 記憶體／CPU；`derToP1363`（L49-78）跳過 64-byte DER 驗證且未檢查 `r`/`s` 長度；`verifyFidoAssertion`（L318）讀取 `authDataBytes[32]` 前未驗長度 `>= 37`。
  * **驗證不足**：`verifyFidoRegistration` / `verifyFidoAssertion` 僅查 `UP (0x01)` 未查 `UV (0x04)`、未拒絕 `clientData.crossOrigin === true`、當預期參數為 falsy 會跳過驗證；`src/index.js:1083` 誤存未簽章的 `body.credential.id` 而非 `parsed.credentialId`。
  * **同步 Passkey 與演算法限制**：`signCount` 嚴格遞增檢查（L326-329）未判讀 WebAuthn `BE (0x08)` / `BS (0x10)` 旗標，會誤鎖同步型 Passkey；COSE 僅支援 `ES256 (-7)`，不支援部分 Windows Hello TPM 的 `RS256 (-257)`；未核對 Discoverable Credentials 回傳的 `response.userHandle`。
  * **Admin FIDO 共用 `rpId` 衝突與 KV Challenge 缺陷**：Admin FIDO（`src/index.js:1048-1056`、`src/scripts/admin.js:123-125`）在同網域用 `residentKey: 'preferred'` 註冊 `user.name = 'admin'`，會與一般用戶 Passkey 同時出現在系統選擇器中；且 Challenge 存於 `NOTES` KV（`get -> delete` 非原子有重放視窗、在 D1-only 模式不可用、且會污染 `driverListNotes` / `deleteEmptyPages` 的 `kv.list()`）。
* **必要修正方向**：
  * 抽出加固版純密碼學模組 `src/webauthn_core.mjs`：CBOR 強制深度／元素／邊界上限、嚴格 DER 與 `authData` 長度檢查、強制驗證 `UV`／`crossOrigin !== true`／固定 `rpId` 與 `origin` 白名單／`parsed.credentialId`／`response.userHandle`，依 `BE`/`BS` 調整 `signCount` 規則，評估補齊 `RS256 (-257)` 並於 `account_passkeys` 儲存 `cose_alg`、`backup_eligible`、`backup_state`。
  * 註冊參數省略 `authenticatorAttachment`（避免阻斷跨裝置 QR/Hybrid 與第三方密碼管理器），`user.name` 採用與 `'admin'` 明顯區隔的格式（如 `<nickname> · #<shortId>`）。
  * User Passkey Challenge 改存 D1 `auth_challenges` 表，以原子 SQL `DELETE ... WHERE challenge = ? AND purpose = ? AND expires_at > ?`（驗 `meta.changes === 1`）消耗，並由每日 Cron 清除過期列。

#### B4. 訪客歷史靜默自動匯入造成 Login CSRF、共用電腦汙染、標題 Oracle 與 D1 全表掃描 DoS
* **現有程式碼事實**：
  * 若既有帳號跨瀏覽器登入時靜默吸收本機 `localStorage`，在共用電腦登入會吸走前一位使用者的私密草稿與閱讀紀錄；若在雲端刪除某項目，下次登入舊瀏覽器還會重新復活。
  * 若 `/api/auth/login` 未以 `SameSite=Strict` Cookie 綁定 Challenge 與嚴格驗證 `Origin`/`Sec-Fetch-Site`，攻擊者可發動 Login CSRF 讓受害者登入攻擊者帳號並藉自動匯入偷取本機歷史。
  * `driverQueryShare`（`src/storage_driver.mjs:225-264`）在 `shares` 表未命中時會退回 `json_extract(metadata, ...)` 全表掃描甚至逐筆 MD5；批次匯入假 `shareId` 會觸發全表掃描 DoS。若匯入 API 對未授權 `vpw`/Vault 筆記回填標題或暴露存在性，還會形成全站標題探測 Oracle。
* **必要修正方向**：
  * 取消無聲自動匯入：無論首次建帳或新瀏覽器登入，一律彈出**可分類勾選的匯入預覽確認視窗**（帶 per-account 去重，預設不自動勾選高雜訊的 `viewed` 與未發布草稿）。
  * 所有認證與寫入端點強制驗證 `Origin === requestOrigin`、`Sec-Fetch-Site: same-origin`、`Content-Type: application/json`，並以 `HttpOnly; Secure; SameSite=Strict` 短期 Cookie 綁定 WebAuthn Challenge 防 Login CSRF。
  * 匯入與收藏查詢 `shareId` 僅查 `shares` 主鍵（禁止呼叫 `driverQueryShare` 全表掃描回退），且絕不對無權限的 `vpw`/Vault 筆記擷取標題或回傳存在性差異。

#### B5. 公開小圈圈的隱私破口（`vpw`、惰性過期、預設勾選公開）、`auto` 混合儲存與 `SELECT content` OOM 風險
* **現有程式碼事實**：
  * 因 `save_policy.mjs` 強制雲端存檔需設 `share: true`，`share: true + vpw` 是本站存私人筆記的常見模式；且 `shareExpiresAt <= now` 採訪客造訪時才惰性改寫 `share: false`（`src/index.js:2035-2042`），Seal 模式同時存在 `'burn'` 與 `'burn_after_reading'`（`src/constant.js:97`、`src/index.js:4033`），以及 `timelock`、`deadman`、`expires`。
  * `renderSharePage`（`src/index.js:2049`）對 `vpw` 筆記刻意隱藏真實標題；若公開小圈圈未排除 `vpw` 或直接讀 `content` 擷取標題，會洩漏受保護標題。
  * **預設勾選公開風險**：手動收藏別人私下分享的未索引連結（`publicIndex: false`）時，若介面預設勾選一個已開啟的公開小圈圈，使用者順手確認即公開外洩該連結。
  * **混合儲存與效能**：預設 `SCN_STORAGE_DRIVER = "auto"`（`wrangler.toml:15`）下，未重新存檔的舊筆記僅存在 KV 而不在 D1 `notes` 表，故**嚴禁對 `notes(path)` 建 SQL Foreign Key 或硬性 `INNER JOIN notes`**；同時 Canvas / Whiteboard 的 `content` JSON 可達數 MB，列表頁**嚴禁 `SELECT content`**（會導致 128MB Worker OOM）。
* **必要修正方向**：
  * 私有主空間（`account_space_items`）與公開小圈圈（`share_circles` / `share_circle_items`）嚴格拆表，公開讀取時**每次即時驗證 live metadata**：`share === true && !vpw && !isShareExpired && !isShareBurned && !shareBurnAfterReading && shareMode === 'standard' && !shareUnlockAt && !sharePulseDueAt && noteUidMatches`（並明確拍板未過期的 `shareExpiresAt` 是否排除）。
  * 在筆記寫入時將正規化 `title`（`<= 70` 字）與 `editorFormat` 存入 `notes.metadata`，列表僅讀 `path, metadata, updated_at` 並強制分頁（`<= 50` 筆）與分批 `IN (...)`（`<= 50` 參數）；加入收藏／匯入命中 KV-only 舊筆記時可一次性回補至 D1 `notes`（或分頁有限並發回退 KV）。
  * 小圈圈公開 URL 使用至少 16-byte CSPRNG `circleId`（不可列舉、支援重設連結），回應帶 `Cache-Control: no-store` 與 `X-Robots-Tag: noindex, nofollow` 確保「隨時關閉」即時生效。
  * 重新檢視收藏預設勾選公開圈的規則（建議預設僅存私密主空間，或至少對「公開中」小圈圈加顯眼警示且僅於單圈時明確提示，多圈不盲目預選）。

#### B6. `annotation_messages` 直接加欄位會破壞 `npm run deploy`（`db:init`）與 `deploy:owner`
* **現有程式碼事實**：
  * `package.json:86-88` 每次 `npm run deploy` 都重跑所有 `schema/*.sql`（仰賴 `CREATE TABLE IF NOT EXISTS` 冪等）；`deploy:owner` 則完全沒跑 `db:init`；SQLite / D1 不支援 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`。
  * `test/annotation-data.test.mjs:214, 253` 直接斷言既有 `annotation_messages` SQL 結構。
* **必要修正方向**：
  * 採用獨立加法關聯表 `CREATE TABLE IF NOT EXISTS account_annotation_links (message_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, thread_id TEXT NOT NULL, share_id TEXT NOT NULL, created_at INTEGER NOT NULL)`（附 `(account_id, created_at DESC)` 索引），完全不動 `annotation_messages`、與 `db:init` 冪等部署完全相容且可零風險 rollback，並同步解決 B2 不暴露 `annotation_threads.path` 的問題。

#### B7. 既有同源 XSS 破口將在導入 `Path=/` 帳號 Cookie 後升級為全帳號外洩
* **現有程式碼事實**：
  * `src/templates/base.js:8709, 8732, 8750`（簡報 Mermaid `securityLevel: 'loose'` 且未經 DOMPurify 直接寫入 `wrap.innerHTML`）、`src/templates/base.js:10036, 10057`（書本列印未跳脫標題）、`static/js/share-annotations.mjs:1289`（錯誤訊息寫入 `innerHTML`）、以及 `src/templates/base.js:192-198`（忽略 `SCN_ENABLE_WEBTALK="0"` 無條件載入外部 `webtalk.js`）。
* **必要修正方向**：
  * 在發放全站 `Path=/` 帳號 Session Cookie 之前，必須先修補上述既有 XSS 與無條件載入外部腳本問題；帳號頁與小圈圈頁施加嚴格 CSP，Session Cookie 設 `HttpOnly; Secure; SameSite=Lax`。

#### B8. 零門檻註冊洗爆 D1 配額與 `itty-router` 路由命名空間衝突
* **現有程式碼事實**：
  * `src/turnstile.mjs` 採 `SCN_TURNSTILE_FAIL_OPEN = "1"` 且單次通過即核發 2 小時不限次複用的 `cf_turnstile_cleared` Cookie；攻擊者過關一次即可於 2 小時內狂建假 Passkey 帳號灌爆 D1 Free 每日 10 萬寫入配額。
  * `src/index.js:3141, 3256, 3403, 3869` 註冊了萬用路由 `/api/:path/history`、`/api/:path`、`/:path`，且 `createNewNote`／`/api/new-note` 無保留字黑名單。
* **必要修正方向**：
  * Passkey 註冊端點要求**單次新鮮 Turnstile Token**（停用 `cf_turnstile_cleared` 複用，啟用時 fail-closed）＋ IP 雜湊限流 ＋ 每帳號配額上限（例如小圈圈 `<= 20`、單圈 `<= 200` 筆、主空間 `<= 2,000` 筆、單次匯入 `<= 50` 筆）。
  * 路由採非衝突前綴：私有主空間 `/_space`（對齊 `/_pwa-offline`）、公開小圈圈 `/c/:circleId`、API 全採多段前綴 `/api/auth/passkey/*`、`/api/account/*`、`/api/space/*`、`/api/circles/*` 並註冊於 `src/index.js:3141` 之前；建立集中式 `RESERVED_SLUGS` 清單。

---

### 二、🟡 Major 級發現（架構決策、UX 摩擦力與長期維護）

1. **零權限與使用者直覺的反差（Burn Vault 誤燒與跨裝置無法刪自己留言）**：
   * 在裝置 B 登入帳號後點擊主空間中的閱後即焚筆記，因缺少裝置 A 的 `cn_author_*` Cookie，會直接導向 `/share/:shareId` 並可能誤燒自己的筆記，故主空間需對 `pw`/`vpw`/Seal 項目加顯眼狀態標記與 Burn 警告。
   * **〔已拍板〕** 不碰筆記 `pw`/`vpw`/`cn_author_*` 零權限邊界，但針對「使用帳號身分發布的內建段落註解」，允許同一帳號跨裝置刪除自己具名發布的留言（透過 `account_annotation_links` 驗證 `session.account_id`，不暴露原始 `account_id` 給公開端，匿名留言仍維持原 `deleteToken` 機制）。
2. **Passkey 多裝置綁定與無復原的單點鎖死（`egm-zoom-out`、`egm-comprehension`）**：
   * **〔已拍板〕** 因底層本就採 1:N `account_passkeys`，v1 納入極簡的「已登入狀態下新增／移除裝置 Passkey」管理 UI，避免跨生態系鎖死與公開小圈圈成為永久無法關閉的孤兒頁；但仍不提供 Email／簡訊復原，若該帳號底下**所有** Passkey 皆遺失仍無法取回。
3. **v1 範圍與實作前置門檻（`egm-zoom-out`）**：
   * **〔已拍板〕** 維持單一 v1 一次上線完整功能（Passkey 認證與多憑證管理 + 私有主空間 + 多公開小圈圈 + 內建註解身分綁定與跨裝置刪自身留言 + 確認式訪客匯入）；同時將「加固版 `src/webauthn_core.mjs`」與「修補簡報 Mermaid / 書本列印 / `share-annotations.mjs` 既有同源 XSS 及 `webtalk.js` 無條件載入」列為發放全站 `Path=/` Session Cookie 前的強制門檻。
4. **命名體系與 UI 入口碎片化**：
   * 淘汰易誤導的 `Main Circle` 與 `Persona`（1:1 僅存暱稱），統一改稱 `我的空間 / My Space`、`公開小圈圈 / Share Circle`（明確無成員社交）、`帳號暱稱 / Nickname`（上限 40 字對齊 `MAX_ANNOTATION_AUTHOR_LENGTH`，過濾零寬與 BiDi 控制字元，且公開 API 嚴禁回傳 `account_id`）。UI 全站統一稱 `Seal`（不對使用者露出 `Vault`）。
   * 首頁 `/` 記憶偏好後會立即轉址 `/new/:format`（`editor-preference.mjs:238`），入口必須整合進既有共用 Footer 的 `#share-history-btn`（登入前看本機紀錄、登入後看主空間，避免「最近分享紀錄 / 離線工作區 / 個人主空間」三套清單並存），並在 `/` 偏好彈窗補次要入口。
   * 嚴格模組拆分：不得再把程式碼塞入 4,487 行的 `src/index.js` 與 10,276 行的 `src/templates/base.js`；後端拆 `src/webauthn_core.mjs`、`src/account_data.mjs`、`src/account_routes.mjs`、`src/circle_routes.mjs`，模板拆 `src/templates/space.js`、`src/templates/circle.js`，前端拆獨立 `static/js/account-*.mjs`（避開 `test/share-presentation-ui.test.mjs` inline script 風險）。
5. **D1 寫入放大、Binding 統一與維運可觀測性**：
   * `POST /:path` 每 10 秒自動儲存（`AUTOSAVE_IDLE_MS = 10000`）：僅於首次 `(account_id, path)` 建立關聯時 `INSERT OR IGNORE`，不隨每次 autosave 更新時間戳；無 session Cookie 的匿名流量維持 0 次額外 D1 查詢。
   * 統一 D1 存取器 `getAccountDb()`（`APP_DB || NOTE_HISTORY_DB`），明確區分 `D1_UNBOUND`（依規則自動隱藏停用帳號功能，條件為 `!db || getStorageDriverName() === 'kv'`）與 `D1_SCHEMA_MISSING`（已綁 D1 但忘跑 `db:init` 時回傳可診斷 `503` 與結構化日誌，並於 `/api/health` 揭露非敏感 schema 就緒狀態）。
   * 帳號 Session 禁止退回 `EPHEMERAL_AUTHOR_SECRET`，缺 `SCN_SECRET` 時 fail-closed；採簽章 Cookie + D1 `account_sessions`（或 `accounts.session_version`）支援即時登出撤銷，並擴充每日 Cron 清理過期 `auth_challenges` 與 `account_sessions`。
   * WebAuthn 驗證失敗時記錄結構化非 PII 日誌（`cfRay`、`errorCode`、`aaguid`、`flags`、`alg`、`signCount`、雜湊後 `credentialId`）以利跨裝置除錯；於 `README.md` / `wrangler.toml.example` 註明 Passkey 綁定網域（`rpId`）及 D1 需求。
   * 具名註解限制明確標註：現有內建劃線批註僅支援 Markdown / Block（Canvas / Whiteboard 分享頁無 `#preview-md` 容器）；切至匿名留言時不得沿用 `localStorage['cf-notepad:annotation-author']` 預填帳號暱稱；Session 過期送出具名註解時須保留草稿並提示重驗證，禁止靜默降級匿名。

## Goals vs. Non-Goals

### In-Scope Goals（v1 一次完整上線）
* **零權限個人索引層**：提供跨裝置同步與個人歸納，完全不更動既有匿名免登入編輯、分享與 `pw`/`vpw` 密碼鎖流程，亦不取代 `cn_author_*` Cookie。
* **Passkey-Only 認證與多裝置管理**：透過加固後的 WebAuthn Discoverable Credentials（`src/webauthn_core.mjs` + D1 `auth_challenges`）建立與登入帳號；底層採 `accounts` + `account_passkeys`（1:N，含 `cose_alg` / `BE` / `BS`）結構，v1 包含「已登入狀態下新增／移除裝置 Passkey」管理 UI，並為未來加法擴充 `account_identities`（Email/電話/SSO）預留結構（不先放空置欄位）。
* **私有個人主空間（My Space）**：以 `(account_id, canonical_key)` 多面向索引整合跨 4 種格式（Markdown / Block / Canvas / Whiteboard）的創作、編輯、手動收藏與具名站內劃線批註；支援確認式訪客已發布／瀏覽紀錄匯入（不把未發布草稿同步進雲端）。
* **未發布草稿維持純本機**：遵守 `save_policy.mjs`，未發布草稿不寫入雲端與 R2，亦不寫入跨裝置 D1 索引（僅可於本機瀏覽器區域讀取 `offlineStore` 顯示）。
* **可隨時開關的公開小圈圈（Share Circles）**：獨立不可列舉網址、即時開關、嚴格即時過濾僅輸出 `share === true` 且非 `vpw`/Seal（`burn`/`timelock`/`deadman`）/已過期/已焚毀的 `/share/:shareId` 唯讀連結；手動收藏預設僅存私密主空間，不預設勾選任何公開小圈圈。
* **單一帳號暱稱（Nickname）與具名註解**：上限 40 字元、改名不回溯既有註解快照；登入狀態下可選擇以帳號暱稱留言（關聯 `account_annotation_links`、出現於主空間且支援同帳號跨裝置刪除自身留言，但不於公開 API 暴露 `account_id`）或選擇完全不綁定帳號的真匿名批註。
* **前置安全修復與 D1 必要條件**：在啟用全域 Session Cookie 前先修補既有分享頁 XSS 與 `base.js:5767` `share-history:created` 污染 Bug；無 D1（或純 KV 模式）自動隱藏停用帳號功能，並於中英文 README 與安裝文件寫明。

### Out-of-Scope Non-Goals（v1 明確不做）
* 不做 Email / 電話 / OAuth / SSO 登入，且當該帳號下所有 Passkey 皆遺失時不提供復原機制。
* 不讓帳號接管筆記擁有權、編輯鎖（`pw`）、閱讀鎖（`vpw`）或取代 `cn_author_*` Vault 預覽豁免權。
* 不做未發布本機草稿的雲端內文／R2 同步（不改動 `save_policy.mjs` 的發布即上雲規則）。
* 不做多 Persona 分身切換、頭像上傳或個人簡介。
* 不整合外部 WebTalk（`webtalk.david888.com`）留言與暱稱。
* 不做 REST API / MCP 個人歸類 Token（`X-Account-Token` 等，延後至 v2）。
* 不做好友追蹤、成員協作權限、私訊或全站動態牆等社交功能。
* 不在無 D1 的純 KV 環境支援帳號與空間功能。

## Alternatives Weighed

| 被評估／排除方案 | 排除理由 |
| :--- | :--- |
| **拆成兩階段上線（先主空間、v2 再上公開小圈圈與註解）** | Owner 拍板一次於 v1 完整交付，以提供完整的個人作品集與公開小圈圈閉環體驗；同時將 XSS 與 WebAuthn 加固列為同批必解前置條件。 |
| **帳號接管筆記 ACL（取代 `pw`/`vpw` 與 `cn_author_*`）** | 破壞本站匿名免登入 URL 優先模型，大幅增加分享與協作權限複雜度；決定維持零權限索引層，僅對帳號自身具名註解開放跨裝置自刪。 |
| **將未發布草稿路徑匯入雲端主空間／同步草稿至雲端** | 與 `save_policy.mjs`、`deleteEmptyPages()` Cron 及 4 碼 slug 重用衝突，且會增加無謂雲端與 R2 寫入；決定維持未發布草稿純本機化。 |
| **單一預設公開小圈圈或手動收藏預設勾選公開小圈圈** | 違反 Private-First 原則，會曝光未公開草稿、未索引連結與 `vpw`/Seal 機密；改為私密主空間預設，公開小圈圈採明確 opt-in。 |
| **v1 只綁單一 Passkey、不做新增／移除裝置管理 UI** | 跨生態系裝置無法同步且遺失單一憑證會使公開小圈圈成為永久孤兒頁；因資料表本為 1:N，決定於 v1 順手納入多憑證管理 UI。 |
| **多 Persona 分身與頭像／簡介欄位** | 增加身分管理與 R2 頭像儲存負擔，v1 簡化為單一帳號暱稱（改名不回溯舊批註）加可選真匿名留言。 |
| **修改 `annotation_messages` 原表加 `account_id` 欄位** | SQLite/D1 不支援 `ADD COLUMN IF NOT EXISTS`，會破壞 `npm run deploy` 的冪等 `db:init` 與現有測試；改以獨立加法表 `account_annotation_links`。 |
| **於 `accounts` / `account_credentials` 預塞空置 Email/SSO 欄位** | 多型單表會產生大量 nullable 欄位，違反 YAGNI；改用精簡 `accounts` + `account_passkeys`（1:N），未來直接新增 `account_identities` 表。 |
| **複用 `NOTES` KV 儲存 User Passkey 與 Challenge** | KV `get -> delete` 非原子有重放風險、會污染全站 `kv.list()` 並於 D1-only 模式失效；改存 D1 專屬表並以單句 SQL 原子消耗。 |
| **於 v1 引入 REST API / MCP 個人歸類 Token** | 擴大憑證管理與外洩安全面且需避開現有 `Authorization: Bearer <pw>`；延後至 v2。 |
| **在純 KV 模式（無 D1）支援帳號系統** | 關聯索引、去重查詢與小圈圈過濾不適合 KV；無 D1 時直接隱藏停用並記載於 README。 |

## Key Decisions & Staging for Next Steps

以下 5 項關鍵設計取捨已於 Brainstorm 階段全數拍板，將直接作為下一階段 `/egm-draft` 撰寫正式設計規格的輸入契約：

1. **v1 交付範圍**：**單一版本一次完整上線**（Passkey 認證與多憑證管理 + 私有主空間 + 確認式訪客匯入 + 多公開小圈圈 + 內建註解帳號綁定與跨裝置自刪），並將既有同源 XSS 修復、`base.js:5767` Bug 修復與 `src/webauthn_core.mjs` 加固納入同一批前置交付。
2. **未發布本機草稿與訪客匯入**：**未發布草稿維持純本機（不進雲端與 R2、不寫入跨裝置 D1 索引）**；Guest Import 僅處理可驗證／已發布或瀏覽紀錄，並於註冊與新瀏覽器登入時一律採**確認式預覽勾選**（防共用電腦汙染與 Login CSRF）。
3. **公開小圈圈預設與安全過濾**：手動收藏**預設僅存私密主空間（不預設勾選公開小圈圈）**；公開小圈圈嚴格排除未發布（`share !== true`）、`vpw`（閱讀鎖）、所有 Seal（`burn`/`burn_after_reading`/`timelock`/`deadman`）及已過期／已焚毀筆記，且對外永不輸出 `note_path`（`/egm-draft` 階段再明確拍板未過期 `shareExpiresAt` 是否視同一般公開項目允許展示至到期為止）。
4. **多裝置 Passkey 管理**：**納入 v1**，允許已登入使用者新增另一台裝置的 Passkey 或移除舊憑證（底層採 `account_passkeys` 1:N 結構，仍無 Email/SSO 復原）。
5. **跨裝置刪除自己的具名段落註解**：**允許**同一帳號透過 `account_annotation_links` 跨裝置刪除自己具名發布的段落註解（公開 GET 僅對本人回傳 `canDelete`，嚴禁暴露 `account_id`；匿名留言維持原本機 `deleteToken` 機制，且筆記本體仍嚴格維持零權限不改動 `pw`/`vpw`/`cn_author_*`）。
