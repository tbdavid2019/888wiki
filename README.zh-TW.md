# 888wiki

**從 Markdown 出發、可部署在自己 Cloudflare 帳戶中的知識工作區。** 先用純文字 Markdown 記錄，再匯入錄音、檔案與網頁；需要不同表達方式時，可切換 Block、Canvas 或 Whiteboard。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/888wiki)

[線上網站](https://wiki.david888.com) · [API](https://wiki.david888.com/api) · [Agent Skill](https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md)

## 一個選單，收進語音、檔案與網頁

**＋ 新增**選單可將不同來源的內容直接帶進筆記：

- **即時錄音：** 錄音與播放器先保存在 IndexedDB；連線後轉錄，發布／同步時再上傳至 888box 附件服務。
- **匯入音訊（逐字稿）：** 取得忠實原音、附時間標記的逐字稿。
- **匯入音訊（智慧排版）：** 使用 AI 將語音整理成段落與章節。
- **匯入檔案：** 將 Markdown、Office 文件、PDF、試算表等轉成筆記。支援的文件可在瀏覽器本機轉換；若想保留原始檔，可拖曳檔案並選擇上傳為附件。
- **匯入網站：** 擷取支援的公開網頁並轉成 Markdown；可插入／取代目前筆記，或在空白編輯器建立筆記。

同一套匯入功能可建立 Markdown 筆記，或將內容轉成可編輯的 Block 文件。

## 依想法選擇創作空間

| 模式 | 適合用途 | 主要特色 |
| --- | --- | --- |
| **Markdown** | 文章、研究與技術筆記 | 即時預覽、數學公式、圖表、引用、匯入、搜尋取代與彈性版面。 |
| **Block** | 結構化頁面與多媒體內容 | 可編輯內容區塊、Slash 指令、拖曳排序、可編輯嵌入內容與直接匯出。 |
| **Canvas** | 心智圖、計畫與關聯整理 | 八種思考卡片、關係連線、多媒體卡片、復原／重做，以及 `.canvas`／PNG／SVG 匯出。 |
| **Whiteboard** | 草圖與視覺說明 | Excalidraw 繪圖工具、唯讀分享，以及 PNG／SVG 匯出。 |

## Seal：預約發布，或讓規則決定釋出時機

Seal 將內容密碼與釋出時機分開設定。可預約時間解鎖、設定瀏覽次數後銷毀公開分享、作者漏掉簽到後自動釋出，或設定連結到期。10 種範本涵蓋單次瀏覽憑據分享（含「一次性密碼」範本；1 小時到期）、機密金鑰分享（1 天到期）、加密資產傳承、緊急災備、吹哨揭弊、產品發布、生日驚喜、司法保全、闖關線索與課程教材。「一次性密碼」範本控制分享連結，不會產生或驗證 OTP 驗證碼。範本不會改寫筆記內文；分享銷毀後，作者原始筆記仍保留。

## 寫作與發布工作區

- **AI 寫作：** 整理格式、改寫與翻譯草稿；音訊轉錄以 Groq 為主，失敗時可回退至 Workers AI，並產生含時間戳記的逐字稿。
- **發布與展示：** 以適合手機的版面公開或密碼保護分享，閱讀進度會標示目前章節；獨立專屬一鍵列印與向量 PDF 導出、工具列前排直覺匯入匯出操作、行動端快捷工具下拉選單，只輸出一份文章並隱藏浮動工具，也可還原 D1 版本、討論選取段落，並以書本或簡報展示內容。
- **離線工作與智慧同步：** 草稿即時保存於瀏覽器 IndexedDB，並透過精簡的「複合儲存膠囊」常駐掌握即時同步狀態（0ms 本機存檔／雲端已同步），提供一鍵強制同步、閒置自動儲存開關與快速調閱 D1 雲端版本及本機發布歷史。
- **自行管理技術堆疊：** 一鍵部署 Worker、KV／D1 筆記資料與 R2 圖片儲存至自己的 Cloudflare 帳戶。核心筆記與圖片留在自己的帳戶；錄音發布／同步及大型附件使用外部 888box 服務。

## Markdown 起家的寫作空間

Markdown 是 888wiki 的起點：以可攜的純文字撰寫，即時預覽數學公式、圖表、引用、註腳、提示區塊與擴充語法。全站介面全面採用精緻洗鍊的 Lucide 與 Tabler 向量圖示，在工具列、下拉選單與彈窗中實現像素級水平垂直置中。可選擇 20 款繽紛深淺主題、字體、預覽寬度與分割版面；同一份 Markdown 也能整理成書本或簡報。

## 為 Agents 與自動化而設

相容的 Agent／LLM 可透過原生 `/mcp`、瀏覽器 WebMCP 工具、REST API 與 OpenAPI 規格，或已發布的 [Agent Skill](https://wiki.david888.com/.well-known/agent-skills/david888-wiki-publisher/SKILL.md) 讀取、建立及發布內容，並依照文件定義的格式與權限操作。

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
