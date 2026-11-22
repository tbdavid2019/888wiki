# 安裝 888wiki

[繁體中文專案首頁](../README.zh-TW.md) · [English](INSTALLATION.md) · [功能詳情](FEATURES.zh-TW.md) · [更新紀錄](../CHANGELOG.md)

## 一鍵部署（推薦）

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/888wiki)

1. 點擊 **Deploy to Cloudflare**，登入 GitHub 與 Cloudflare。
2. 選擇新 GitHub repository 與 Worker 名稱。
3. 在部署精靈或 Worker 的 **Settings → Variables and Secrets** 設定下方 3 個必填 Secrets。
4. 啟動部署。Cloudflare 會複製 repository、連接 Workers Builds，並依 `wrangler.toml` 建立 Cloudflare 資源。
5. 部署腳本會初始化已設定的 D1 結構，包括筆記登錄、帳號、歷史、統計與批註。既有站台恢復流量前，請先依下方程序完成遷移。

Cloudflare Deploy 會讀取 `wrangler.toml` 的資源綁定，以及 `.dev.vars.example` 的 Secret 名稱。大多數執行變數已有可用預設值，部署時不必逐項輸入。下方列出新部署會使用的完整設定。

## 必填 Secrets

| Secret | 用途 | 設定方式 |
| --- | --- | --- |
| `SCN_SALT` | 密碼雜湊用 salt | 為此安裝產生獨立的隨機值。 |
| `SCN_SECRET` | 簽署登入工作階段與認證權杖 | 另外產生一組獨立的隨機值。 |
| `SCN_ADMIN_PW` | 管理後台密碼 | 設定高強度密碼。管理後台預設路徑為 `/admin`。 |

可分別執行兩次 `openssl rand -hex 32`，產生 `SCN_SALT` 與 `SCN_SECRET` 的隨機值；`SCN_ADMIN_PW` 請自行設定高強度密碼。

請在 Cloudflare 部署精靈設定 Secrets；也可在部署後前往 **Worker → Settings → Variables and Secrets** 新增。使用 Wrangler 時，對每個 Secret 執行 `npx wrangler secret put <名稱>`。請勿將密鑰寫入 `wrangler.toml` 或提交至 Git。

## `wrangler.toml` 會建立的 Cloudflare 資源

| 綁定名稱 | 資源 | 用途 |
| --- | --- | --- |
| `NOTES` | KV Namespace | 筆記儲存與備援。 |
| `SHARE` | KV Namespace | 已發布筆記與分享中繼資料。 |
| `NOTE_HISTORY_DB` | D1 Database | 預設提供筆記登錄、帳號、歷史、統計與批註；也可使用其他 D1 綁定分離職責。 |
| `IMAGES` | R2 Bucket | 圖片上傳。未設定自訂網域時由 Worker 提供圖片。 |

Worker 也會從 `static/` 提供靜態檔案，並依設定每天於 UTC 01:00（台灣時間 09:00）執行清理 Cron。Cloudflare 會自動建立這些資源，並將 Wrangler 範本中的預設 ID 更新為新資源 ID。

## 執行變數與預設值

以下設定已寫在 `wrangler.toml`。若要調整，請修改 Cloudflare 複製到你 GitHub 帳戶的 repository；每次 push 都會觸發部署。

| 變數 | 預設值 | 作用 |
| --- | --- | --- |
| `SCN_STORAGE_DRIVER` | `auto` | 使用可用的 D1 筆記登錄；刻意設定 `kv` 時停用帳號。明確指定 D1 為權威資料庫時，資料庫失效會拒絕服務。 |
| `SCN_APP_NAME` | `888wiki` | 介面顯示的應用名稱。 |
| `SCN_ADMIN_PATH` | `/admin` | 管理後台路徑；可改成較難猜測的路徑。 |
| `SCN_SLUG_LENGTH` | `4` | 自動產生的筆記網址長度。 |
| `SCN_ENABLE_R2` | `1` | 啟用已建立的 R2 圖片上傳。 |
| `SCN_R2_DOMAIN` | 空白 | 選用的公開圖片網域；空白時透過 Worker 提供圖片。 |
| `SCN_GA_MEASUREMENT_ID` | 空白 | 提供自己的 Google Analytics Measurement ID 後才會啟用追蹤。 |
| `SCN_ENABLE_WEBTALK` | `0` | 預設關閉 WebTalk，設定好自己的服務後再開啟。 |
| `SCN_WEBTALK_SCRIPT_URL` | 空白 | 自有 WebTalk 用戶端 Script 網址。 |
| `SCN_WEBTALK_AI_ENDPOINT` | 空白 | 自有 WebTalk AI 端點。 |
| `SCN_WEBTALK_SCOPE` | `meta` | WebTalk Widget 範圍。 |
| `SCN_WEBTALK_SITE_ID` | 空白 | 在 WebTalk 服務登記的 Site ID。 |
| `SCN_ENABLE_NOTE_HISTORY` | `1` | 啟用 D1 歷史、統計與註解功能。 |
| `SCN_NOTE_HISTORY_LIMIT` | `10` | 每篇筆記保留的歷史版本數量。 |
| `SCN_NOTE_HISTORY_MIN_INTERVAL_SECONDS` | `300` | 自動建立歷史快照的最短間隔秒數。 |
| `SCN_NOTES_DB_BINDING` | 未設定 | 固定權威筆記 D1 綁定，例如 `NOTE_HISTORY_DB`；綁定遺失時回傳 `503 STORAGE_UNAVAILABLE`。 |
| `SCN_REQUIRE_NOTES_REGISTRY` | 未設定 | 驗證遷移完成後設為 `1`，要求使用筆記登錄。 |
| `SCN_LEGACY_HISTORY_RETENTION_DAYS` | `0` | 未標記舊歷史的保留天數；`0` 停用清理。登錄模式下，一般筆記歷史不顯示未標記紀錄。 |
| `SCN_ENABLE_TURNSTILE` | `0` | 明確關閉 Turnstile；只有網站金鑰與 Secret 均已設定時才設為 `1`。 |
| `SCN_TURNSTILE_SITE_KEY` | 空白 | 公開的 Turnstile 網站金鑰，須與 `SCN_TURNSTILE_SECRET` Secret 配對。 |
| `SCN_TURNSTILE_FAIL_OPEN` | `1` | 控制既有互動保護的降階行為；Passkey 註冊驗證仍嚴格拒絕失敗請求。 |

## 選填參數與整合服務

| 參數 | 預設值 | 需要設定的情況 |
| --- | --- | --- |
| `GROQ_API_KEY` Secret | 未設定 | 啟用 Groq AI 功能與主要音訊轉錄。未設定時，可由 Workers AI 提供支援的 AI 功能與轉錄備援。 |
| `SCN_R2_DOMAIN` | 空白 | 透過自己的公開網域提供上傳圖片，而非使用 Worker 網址。 |
| `SCN_GA_MEASUREMENT_ID` | 未設定 | 將流量資料送至自己的 Google Analytics 資源。 |
| `SCN_ENABLE_WEBTALK` | `0` | 完成下方 WebTalk 設定後才改為 `1`。 |
| `SCN_WEBTALK_SCRIPT_URL` | 空白 | 載入自有 WebTalk 用戶端 Script。 |
| `SCN_WEBTALK_AI_ENDPOINT` | 空白 | 連接自有 WebTalk AI 端點。 |
| `SCN_WEBTALK_SCOPE` | `meta` | 調整 WebTalk Widget 使用的 DOM 範圍。 |
| `SCN_WEBTALK_SITE_ID` | 空白 | 提供註冊於 WebTalk 服務的站台 ID。 |
| Workers AI 綁定 `AI` | 未設定 | 提供支援的 AI 寫作功能，並作為音訊轉錄備援。若已設定 `GROQ_API_KEY`，轉錄會先嘗試 Groq。請將綁定加入 `wrangler.toml`。 |
| Worker 自訂網域 | `workers.dev` 網址 | 使用自己的網域；部署後在 Cloudflare Dashboard 設定。 |

WebTalk 預設關閉，部署設定中的 Script 與 AI 端點也留空。請先填入自己管理的服務資訊，再開啟功能。

## 帳號與 D1 綁定

Passkey 帳號、個人空間與分享圈需要已初始化的筆記登錄及帳號資料庫。刻意使用純 KV（`SCN_STORAGE_DRIVER="kv"`，或全新 `auto` 且沒有 D1 或登錄要求）時，帳號控制項自動隱藏，匿名筆記仍可使用。筆記登錄正常但沒有帳號資料庫時，筆記完整性保護仍生效，只有帳號 API 停用。缺少必要資料表會回報 `503 D1_SCHEMA_MISSING`。請將穩定的 `SCN_SECRET` 設為 Secret；缺少時帳號操作會拒絕服務。

`wrangler.toml` 執行 `npm run db:init`，`wrangler.owner.toml` 則執行 `npm run db:init:owner`；部署指令也會執行對應初始化。預設單一 `NOTE_HISTORY_DB` 可承擔所有職責。若分離資料庫，可設定 `NOTES_DB` 儲存筆記、`APP_DB` 儲存帳號及批註，另以 `NOTE_HISTORY_DB` 儲存歷史；並用 `SCN_NOTES_DB_BINDING` 固定筆記綁定。未固定時筆記依序使用 `NOTES_DB`、`NOTE_HISTORY_DB`、`DB`；帳號與批註依序使用 `APP_DB`、`NOTE_HISTORY_DB`，且必須共用資料庫。初始化會針對每個實際資料庫執行。其他 Wrangler 設定請帶入對應的 `--config` 與 `--env`。

Passkey 綁定網站 WebAuthn relying-party 網域（`rpId`）；變更網域可能使既有憑證無法在新網域使用。請在失去存取前新增其他裝置的 Passkey；目前沒有電子郵件、電話或 SSO 復原方式。管理員 FIDO 憑證與使用者 Passkey 分開，其挑戰與憑證仍儲存於 KV，不具備 D1 帳號交易保證。

提供的設定預設關閉 Turnstile。啟用時，請同時設定 `SCN_ENABLE_TURNSTILE="1"`、`SCN_TURNSTILE_SITE_KEY`，並以 `npx wrangler secret put SCN_TURNSTILE_SECRET` 儲存 Secret。設定不完整或旗標值無法辨識會拒絕服務並回傳 `503`；明確設為 `0` 或 `false` 則停用。即使既有功能允許 fail-open，Passkey 註冊仍採嚴格單次驗證。

上線前請檢查未追蹤的 `wrangler.owner.toml` 等私人設定，將 `[vars]` 中明文 API 金鑰與憑證移至 `wrangler secret put <名稱> --config wrangler.owner.toml` 綁定，並輪替仍在使用的非工作階段憑證。只有 `SCN_SECRET` 本身外洩時才輪替它：輪替會刻意使先前匿名批註 `deleteToken` HMAC 與筆記／作者 Cookie 失效。

## 既有站台：必要的單向登錄遷移

啟用登錄後，不可退回未驗證的純路徑 KV 模式。請先備份資料並安排維護時段。KV 不提供跨多個鍵的原子快照或跨資料中心強一致性保證；僅靠分頁無法確認先前寫入均已穩定。

1. 先以 `SCN_MAINTENANCE_MODE="1"` 部署新的強制保護 Worker，封鎖 HTTP、API、MCP 與排程操作，並等待至少 60 秒讓進行中的請求結束。整個對帳期間維持維護模式。
2. 執行 `npm run db:init`（或 `npm run db:init:owner`）初始化資料庫。若設定檔未包含帳號 ID，透過 `CLOUDFLARE_ACCOUNT_ID` 提供，並透過 `CLOUDFLARE_API_TOKEN` 提供可讀取相關 KV 與 D1 的 Cloudflare API Token。執行 `npm run db:migrate-legacy -- --audit`（owner 設定另加 `--config wrangler.owner.toml`）。檢查連續兩次中央 KV 快照穩定性、數量、差異與衝突／提升報告；任何 API 錯誤、截斷游標或不穩定快照都必須停止。
3. 明確確認維護前的 KV 寫入已穩定並審閱報告後，才使用相同設定執行 `npm run db:migrate-legacy -- --confirm-quiesced-snapshot`。安全、發布、分享對應或相同時間戳內容的衝突須先審慎解決再重試；可視情況使用 `--prefer=kv`、`--prefer=d1` 或 `--resolve-stricter`。不可忽略未解決的衝突。
4. 驗證遷移筆記數量及有效／終止分享登錄的一致性。將 `SCN_NOTES_DB_BINDING` 設為正確的權威 D1 綁定，並設定 `SCN_REQUIRE_NOTES_REGISTRY="1"`；確認 `/api/health` 就緒後才解除維護模式。固定綁定遺失時會回傳 `503 STORAGE_UNAVAILABLE`，不會靜默回退至 KV 或其他 D1。

## 使用 Wrangler 部署

手動部署步驟如下：

1. 複製專案並安裝依賴套件：

   ```bash
   git clone https://github.com/tbdavid2019/888wiki.git
   cd 888wiki
   npm install
   npx wrangler login
   ```

2. 建立 KV Namespace，並將 Wrangler 回傳的 `demo` ID 填入 `wrangler.toml`：

   ```bash
   npx wrangler kv namespace create NOTES
   npx wrangler kv namespace create SHARE
   ```

3. 建立 `wrangler.toml` 設定的 D1 資料庫與 R2 Bucket，並將 D1 回傳的 ID 填入 `database_id`：

   ```bash
   npx wrangler d1 create 888wiki-history
   npx wrangler r2 bucket create 888wiki-images
   ```

4. 使用 `npx wrangler secret put <名稱>` 設定 `SCN_SALT`、`SCN_SECRET` 與 `SCN_ADMIN_PW`。需要 Groq AI 時，再設定 `GROQ_API_KEY`。
5. 建置、初始化 D1 資料表並部署：

   ```bash
   npm run deploy
   ```

每個安裝環境都應使用獨立的 Secrets。Cloudflare Deploy 的官方說明請參閱 [Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/)。
