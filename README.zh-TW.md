# 888wiki

**從 Markdown 出發、可部署在自己 Cloudflare 帳戶中的知識工作區。** 先用純文字 Markdown 記錄，再匯入錄音、檔案與網頁；需要不同表達方式時，可切換 Block、Canvas 或 Whiteboard。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/888wiki)

[線上網站](https://wiki.david888.com) · [API](https://wiki.david888.com/api) · [Agent Skill](https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md)

## 一個選單，收進語音、檔案與網頁

**＋ 新增**選單可將不同來源的內容直接帶進筆記：

- **即時語音聽打：** 透過 Web Audio 16kHz PCM 與 WebSocket 串流直連 Confucius4-R2T2 引擎（`asr.5gao.ai`），以低於 200ms 的極速延遲將說話即時化為繁體文字流暢注入游標處；全面支援 Markdown 工具列與 Block 區塊模式。Markdown 工具列的聽打按鈕移至最左側，方便快速啟動；亦可使用 Slash 指令 `/dictate` 或快速鍵 `Cmd/Ctrl + Shift + D`，並由智慧在線偵測於服務在線時顯示、離線時隱藏按鈕。
- **即時錄音：** 錄音與播放器先保存在 IndexedDB；連線後轉錄，發布／同步時再上傳至 888box 附件服務。
- **匯入音訊（逐字稿）：** 取得忠實原音、附時間標記的逐字稿。
- **匯入音訊（智慧排版）：** 使用 AI 將語音整理成段落與章節。
- **匯入檔案：** 將 Markdown、Office 文件、PDF、試算表等轉成筆記。支援的文件可在瀏覽器本機轉換；若想保留原始檔，可拖曳檔案並選擇上傳為附件。
- **匯入網站：** 擷取支援的公開網頁並轉成 Markdown；可插入／取代目前筆記，或在空白編輯器建立筆記。

同一套匯入功能可建立 Markdown 筆記，或將內容轉成可編輯的 Block 文件。

## AI 代理與 LLM 整合（Skill 安裝／更新）

一鍵為本機 Claude Code、Codex、Antigravity、Gemini、Cursor、OpenCode 安裝或更新官方 **David888 Wiki Skill**（涵蓋 Markdown、Block、JSON Canvas 1.0、Excalidraw 白板、Share Vault 與原生 `/mcp`）。

> **建議習慣**：由於本站語法與 MCP 工具持續演進，建議每次讓 AI 使用前先執行一次以下指令，確保本機 Skill 永遠是線上最新版：

```bash
# 一鍵從線上拉取最新 SKILL.md 並更新本機全域各 Agent 目錄（推薦每次使用前執行）
npx --yes 888wiki-skill update --global -y

# 或直接透過 Agent Skills CLI 從 GitHub 安裝
npx --yes skills add tbdavid2019/888wiki -g -y
```

## 依想法選擇創作空間

| 模式 | 適合用途 | 主要特色 |
| --- | --- | --- |
| **Markdown** | 文章、研究與技術筆記 | 即時預覽、即時語音聽打、數學公式、Pele/Mermaid 極速向量圖表（0.2ms 渲染與主題自適應 PNG/SVG 匯出）、引用、匯入、搜尋取代與彈性版面。 |
| **Block** | 結構化頁面與多媒體內容 | 可編輯內容區塊，完整支援深／淺雙模式、預覽欄寬調整與 20 套主題配色、即時語音聽打（`/dictate`）、Slash 指令、浮動格式化工具列、拖曳排序、可編輯嵌入內容與直接匯出。 |
| **Canvas** | 心智圖、計畫與關聯整理 | 八種思考卡片、關係連線、多媒體卡片、復原／重做，以及 `.canvas`／PNG／SVG 匯出。 |
| **Whiteboard** | 草圖與視覺說明 | Excalidraw 繪圖工具、唯讀分享，以及 PNG／SVG 匯出。 |

## Seal：預約發布，或讓規則決定釋出時機

Seal 將內容密碼與釋出時機分開設定。可預約時間解鎖、設定瀏覽次數後銷毀公開分享、作者漏掉簽到後自動釋出，或設定連結到期。10 種範本涵蓋單次瀏覽憑據分享（含「一次性密碼」範本；1 小時到期）、機密金鑰分享（1 天到期）、加密資產傳承、緊急災備、吹哨揭弊、產品發布、生日驚喜、司法保全、闖關線索與課程教材。「一次性密碼」範本控制分享連結，不會產生或驗證 OTP 驗證碼。範本不會改寫筆記內文；分享銷毀後，作者原始筆記仍保留。

## 寫作與發布工作區

- **AI 寫作與智慧助手：** 整理格式、校稿改寫與翻譯草稿；閱讀頁隨選「詢問 AI」即時解答；全站 AI 運算全面升級為三層高可用容錯管線（Tier 1 `llm.aiurl.tw` 旗艦模型 `group/talk` 開啟 Fast 優先加速模式、Tier 2 Groq `openai/gpt-oss-120b` 與 Tier 3 Workers AI 原生運算），內建分層熔斷器、隨機退避抖動與單飛請求合併（Single-Flight），全面防止驚群效應。音訊轉錄以 Groq 為主並以 Workers AI 為備援，產生含時間戳記與智慧章節之逐字稿。
- **發布與展示：** 編輯模式升級為 **單層 IDE 底部工作列**，整合明確文字標籤按鈕（`[ ＋ 新增 ▾ ]`、`[ 📄 草稿／🌐 已發布 ▾ ]`）與專為寫作中急需分享設計的 **一鍵 `[ 發布並複製連結 ／ 複製連結 ]`**（草稿可一鍵發布並複製網址、已發布可立即複製並於背景靜默同步最新內容，完全不中斷編輯）、行數／字元狀態顯示、平面分段視圖切換（`預覽`、`左右／上下`、`桌面／手機`）、獨立一體化的 **`[ 🎨 主題 ▾ ]`** 選單（集中整合深淺外觀、預覽字體 `JetBrains Mono / Maple Mono`、預覽寬度與 20 套排版主題——切換東京夜景／`catppuccin-macchiato` 等深色主題立即同步暗化左側編輯區）、複製／匯出選單、精簡零重複的 **`Cmd/Ctrl + Shift + P` 工具與文件面板**（字數統計、引用 `Cite`、公式複製格式、`/docs` / `API` / `SKILL.md` / `GitHub` 與 PWA 安裝）以及頂層常駐 **`[ 文A 中 / EN ]`** 雙語一鍵切換。閱讀檢視配備層級里程碑圓點導軌與推擠式全高目錄抽屜（`?toc=1` 同步）、Flow 流量統計（`flow.aiurl.tw`）、D1 歷史還原、劃線批註，並可一鍵切換書本或簡報模式。
- **離線工作與智慧同步：** 草稿即時保存於瀏覽器 IndexedDB，並透過單一按鈕上的「雲端狀態徽章」（`[ ☁️🟢 已發布 ▾ ]` 或草稿時 `[ ☁️⚪ 發布 ▾ ]`，無文字佔位且防版面跳動）常駐掌握即時同步狀態（0ms 本機存檔／雲端已同步），並根據草稿與已發布動態切換文案（未發布顯示「發布並同步至雲端」，已發布顯示「立即同步至雲端」），提供一鍵強制同步、閒置自動儲存開關與快速調閱 D1 雲端歷史修訂版本（可由儲存選單或發布狀態列之保留版本指標一鍵開啟）及本機發布歷史。
- **防刷與帳單防護：** 支援 Cloudflare Turnstile 機器人防禦，為筆記保存、發布、檔案上傳與 AI 運算建立邊緣防線。配備專屬「🛡️ 安全驗證」對話框與完成後自動接續重試機制，具備全方位**降階可用（Fail-Open Fallback）**容錯能力，遇 Cloudflare 服務異常或客戶端廣告攔截器時自動放行不中斷編輯；背景自動存檔智慧防打擾，搭配智慧 Clearance Cookie 確保日常編輯零打擾，同時豁免 REST 與 MCP API 確保自動化生態無縫運作。
- **自行管理技術堆疊：** 一鍵部署 Worker、KV／D1 筆記資料與 R2 圖片儲存至自己的 Cloudflare 帳戶。核心筆記與圖片留在自己的帳戶；錄音發布／同步及大型附件使用外部 888box 服務。

## Markdown 起家的寫作空間

Markdown 是 888wiki 的起點：以可攜的純文字撰寫，即時預覽數學公式、圖表（導入 Obsidian 次世代 Pele 極速向量引擎，實現 0.2ms 超快渲染、20 款主題色彩自適應與原生 Mermaid 雙引擎優雅降級）、引用、註腳、提示區塊與擴充語法。全站介面全面採用精緻洗鍊的 Lucide 與 Tabler 向量圖示，在工具列、下拉選單與彈窗中實現像素級水平垂直置中。編輯器外殼（App Shell、工具列、發布狀態列、底欄與彈窗系統）全面導入 `2md.aiurl.tw` 旗艦配色系統（亮色 Saffron Warm Cream `#fff9e8` 搭配番紅赤褐重點色，深色 Saffron Midnight `#131b24` 搭配曜金琥珀，且嚴格符合 WCAG AA/AAA 高對比度標準），依據費茨法則最佳化高頻視覺動線，儲存狀態升級為極簡雲端圖標微型膠囊，以克制的色彩呈現目前選取狀態；控制群組也改為一致的方角矩形。空白筆記隨機呈現泰戈爾《飛鳥集》詩句與雙語小訣竅，陪伴寫作靈感。可選擇 20 款繽紛深淺主題（全數通過 WCAG 2.1 AA 對比度校準，正文／連結 >= 4.5:1，包含 Retro 主題之經典 Win95 內凹白底文件視窗）、字體、預覽寬度與分割版面；Mermaid 與 ECharts 亦全面支援深淺環境動態配色適配。同一份 Markdown 也能整理成書本或簡報。

## 為 Agents 與自動化而設

相容的 Agent／LLM 可透過原生 `/mcp`、瀏覽器 WebMCP 工具、REST API 與 OpenAPI 規格、`/llms.txt` 或已發布的 [Agent Skill](https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md) 讀取、建立及發布 Markdown、Block、Canvas 與 Excalidraw 內容（隨時執行 `npx --yes 888wiki-skill update --global -y` 即可保持同步），並依照文件定義的格式與權限操作。

## 開始使用

- [部署與設定 888wiki](docs/INSTALLATION.zh-TW.md) · [English installation guide](docs/INSTALLATION.md)
- [從擷取、撰寫到發布與 Seal](docs/USAGE.zh-TW.md) · [English usage guide](docs/USAGE.md)
- [完整功能詳情](docs/FEATURES.zh-TW.md) · [English feature guide](docs/FEATURES.md)
- [English project homepage](README.md) · [更新紀錄](CHANGELOG.md)

安裝指南列出必填 Secrets、所有選填參數，以及部署設定中已提供的預設值。

## 專案連結

- [原始碼](https://github.com/tbdavid2019/888wiki)
- [回報問題](https://github.com/tbdavid2019/888wiki/issues)
- 授權：AGPL-3.0
