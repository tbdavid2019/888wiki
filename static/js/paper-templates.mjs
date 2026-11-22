/**
 * Kami-inspired print-ready paper & presentation templates (bilingual zh-TW / en-US).
 */

export const PAPER_TEMPLATES = {
    'one-pager': {
        'zh-TW': `# 專案單頁簡報（One-Pager）

> [!NOTE] 一句話定位
> 用 1～2 句話說明本專案解決的核心痛點、目標對象與量化價值。

---

:::left
## 🎯 核心問題與方案

- **現況痛點**：說明團隊或使用者目前面臨的瓶頸
- **關鍵解法**：我們如何透過系統設計或流程解決
- **差異化優勢**：為何這個方案比現有做法更快、更穩
:::

:::right
## 📊 關鍵指標與時程

| 里程碑 | 預計時間 | 驗收標準 |
| :--- | :--- | :--- |
| MVP 上線 | W1–W2 | 核心流程端對端打通 |
| 效能調優 | W3 | P95 回應 < 200ms |
| 正式推廣 | W4 | 完整文件與自動化監控 |
:::

<div class="page-break"></div>

## 🚀 下一步行動

- [ ] 確認技術架構與資源配置
- [ ] 完成第一階段原型驗證
- [ ] 排定跨團隊評審會議
`,
        'en-US': `# Project One-Pager

> [!NOTE] Executive Summary
> Summarize the core problem, target audience, and measurable impact in 1–2 concise sentences.

---

:::left
## 🎯 Problem & Solution

- **Current Bottleneck**: Describe the main friction or cost today
- **Proposed Approach**: Explain the core architectural or product solution
- **Key Advantage**: Why this approach is faster, safer, or simpler
:::

:::right
## 📊 Key Metrics & Timeline

| Milestone | Target | Success Criteria |
| :--- | :--- | :--- |
| MVP Launch | W1–W2 | End-to-end flow verified |
| Optimization | W3 | P95 latency < 200ms |
| Rollout | W4 | Docs & monitoring complete |
:::

<div class="page-break"></div>

## 🚀 Next Steps

- [ ] Confirm architecture & ownership
- [ ] Complete initial prototype validation
- [ ] Schedule stakeholder review
`,
    },
    'whitepaper': {
        'zh-TW': `# 技術架構白皮書

**版本**：v1.0 ｜ **日期**：2026-11-22 ｜ **作者**：團隊名稱

> [!IMPORTANT] 摘要
> 本文件說明系統的整體設計目標、核心架構選型、資料一致性保證與維運策略，適合直接列印或匯出為 PDF 存檔。

---

## 1. 背景與設計目標

1. **高可用性**：確保邊緣節點與持久化層在異常時可優雅降級。
2. **可觀測性**：所有關鍵路徑皆具備結構化追蹤與回歸測試。
3. **安全性**：最小權限原則、輸入驗證與密鑰隔離。

## 2. 系統架構圖

\`\`\`mermaid
flowchart LR
    Client[使用端 / Agent] --> Edge[Edge Worker]
    Edge --> DB[(D1 / KV 雙寫層)]
    Edge --> Storage[(R2 物件儲存)]
\`\`\`

<div class="page-break"></div>

## 3. 關鍵指標與風險對策

| 面向 | 設計策略 | 風險緩解 |
| :--- | :--- | :--- |
| 延遲控制 | 邊緣快取 + 預載字型 | 降級回退預設字型 |
| 資料安全 | 常數時間驗證與 CSP | 自動化資安測試覆蓋 |

## 4. 結論與參考資料

- 相關規格與 API 文件可進一步附上引用或附錄。
`,
        'en-US': `# Technical Architecture Whitepaper

**Version**: v1.0 | **Date**: 2026-11-22 | **Author**: Engineering Team

> [!IMPORTANT] Abstract
> This whitepaper outlines system goals, architectural choices, consistency guarantees, and operational safeguards—formatted for clean PDF and print export.

---

## 1. Background & Goals

1. **High Availability**: Graceful degradation across edge and persistence layers.
2. **Observability**: End-to-end metrics and automated regression checks.
3. **Security**: Least-privilege access, strict input validation, and secret isolation.

## 2. System Architecture

\`\`\`mermaid
flowchart LR
    Client[Client / Agent] --> Edge[Edge Worker]
    Edge --> DB[(D1 / KV Layer)]
    Edge --> Storage[(R2 Object Storage)]
\`\`\`

<div class="page-break"></div>

## 3. Benchmarks & Risk Mitigation

| Area | Strategy | Mitigation |
| :--- | :--- | :--- |
| Latency | Edge caching + preloaded assets | Graceful local fallback |
| Security | Constant-time auth & strict CSP | Automated security tests |

## 4. Conclusion

- Add references, citations, and appendix notes as needed.
`,
    },
    'resume': {
        'zh-TW': `# 姓名（Your Name）

**資深軟體工程師 / 系統架構師**  
Email: name@example.com ｜ GitHub: github.com/username ｜ 台北，台灣

---

## 💡 專業摘要

具備多年全端與雲端邊緣運算開發經驗，專精於高併發系統架構、效能調優與 AI Agent 工具鏈整合。

---

## 💼 工作經歷

### 資深工程師｜科技公司名稱（2023 – 至今）
- 主導核心雲端筆記與邊緣運算平台重構，P95 延遲降低 **45%**。
- 建立自動化 CI/CD 與多維度測試體系，線上事故率下降 **70%**。

### 軟體工程師｜網路公司名稱（2020 – 2023）
- 設計並實作即時協作與多格式文件匯出引擎（Markdown / PDF / PPTX）。

---

:::left
## 🛠️ 核心技能

- **語言**：TypeScript, Python, Go
- **平台**：Cloudflare Workers, D1, R2
- **前端**：HTML5 Canvas, WebAuthn
:::

:::right
## 🎓 學歷與證照

- **資訊工程碩士**｜大學名稱
- 開源專案貢獻者與技術講者
:::
`,
        'en-US': `# Your Name

**Senior Software Engineer / Systems Architect**  
Email: name@example.com | GitHub: github.com/username | Taipei, Taiwan

---

## 💡 Summary

Experienced full-stack and edge systems engineer specializing in low-latency web platforms, reliability engineering, and AI-assisted workflows.

---

## 💼 Experience

### Senior Software Engineer | Company Name (2023 – Present)
- Led edge platform architecture modernization, reducing P95 response latency by **45%**.
- Built automated test suites and release pipelines, cutting production incidents by **70%**.

### Software Engineer | Previous Company (2020 – 2023)
- Designed real-time collaborative editing and multi-format document export (Markdown / PDF / PPTX).

---

:::left
## 🛠️ Core Skills

- **Languages**: TypeScript, Python, Go
- **Cloud**: Cloudflare Workers, D1, R2
- **Frontend**: Canvas, WebAuthn, Accessibility
:::

:::right
## 🎓 Education

- **M.S. in Computer Science** | University Name
- Open-source maintainer & technical speaker
`,
    },
    'slides': {
        'zh-TW': `---
theme: tokyo-night
transition: fade
motionLoop: aurora
---

<!-- layout: cover -->
# 主題簡報名稱
## 副標題與報告人｜2026-11-22

---

## 📋 今日議程

- 核心問題與現況盤點 {v-click}
- 架構方案與關鍵突破 {v-click}
- 效能實測與下一步行動 {v-click}

---

## ⚖️ 方案對比

::left::
### 過去做法
- 手動整理耗時費力
- 格式分散難以維護
::right::
### 新架構方案
- Markdown 即寫即得
- 一鍵演示與匯出 \`.pptx\`

---

## 📈 系統流程

\`\`\`mermaid
flowchart LR
    A[撰寫 Markdown] --> B[即時簡報模式]
    B --> C[Motion Loops 背景]
    B --> D[匯出 PDF / PPTX]
\`\`\`

---

<!-- layout: cover -->
# Q & A
## 感謝聆聽！
`,
        'en-US': `---
theme: tokyo-night
transition: fade
motionLoop: aurora
---

<!-- layout: cover -->
# Presentation Title
## Subtitle & Speaker | 2026-11-22

---

## 📋 Agenda

- Problem Statement & Context {v-click}
- Architecture & Key Highlights {v-click}
- Benchmarks & Next Steps {v-click}

---

## ⚖️ Comparison

::left::
### Before
- Manual formatting overhead
- Fragmented export tools
::right::
### After
- Write once in Markdown
- Present live & export \`.pptx\`

---

## 📈 Workflow

\`\`\`mermaid
flowchart LR
    A[Write Markdown] --> B[Live Slides]
    B --> C[Motion Loops Backdrop]
    B --> D[Export PDF / PPTX]
\`\`\`

---

<!-- layout: cover -->
# Q & A
## Thank you!
`,
    },
    'meeting': {
        'zh-TW': `# 會議紀錄：專案進度與決策同步

**日期**：2026-11-22 ｜ **時間**：10:00 – 11:00 ｜ **記錄人**：主持人  
**與會人員**：產品、架構、前後端開發團隊

> [!IMPORTANT] 核心決議摘要
> 本次會議確認下一階段交付優先順序、效能指標與各模組負責人，所有待辦事項須於下週五前完成驗收。

---

## 1. 會議議程與討論重點

### 1.1 架構與效能檢視
- 檢視現有邊緣運算延遲與快取命中率，確認字型與靜態資源快取策略。
- 針對雙欄編輯器與目錄 \`[toc]\` 捲動同步進行體驗優化。

### 1.2 匯出與簡報工作流
- 支援簡報模式直接匯出為可編輯 \`.pptx\`，並強化 PDF 分頁與頁首頁尾頁碼排版。

---

## 2. 決議與行動項目（Action Items）

| 編號 | 待辦事項 | 負責人 | 預計完成日 | 狀態 |
| :--- | :--- | :--- | :--- | :--- |
| AI-01 | 完成編輯器捲動錨點對齊 | 前端組 | 2026-11-24 | 進行中 |
| AI-02 | 驗證 PPTX 與 PDF 分頁輸出 | QA 組 | 2026-11-25 | 待確認 |
| AI-03 | 更新團隊知識庫排版範本 | 文件組 | 2026-11-26 | 已完成 |

- [ ] 下次追蹤會議：2026-11-29 10:00（確認上線清單）
`,
        'en-US': `# Meeting Minutes: Project Sync & Decisions

**Date**: 2026-11-22 | **Time**: 10:00 – 11:00 | **Note Taker**: Facilitator  
**Attendees**: Product, Architecture, Frontend & Backend Engineering

> [!IMPORTANT] Key Decisions Summary
> Confirmed next-sprint delivery priorities, latency targets, and module owners. All action items are due by next Friday.

---

## 1. Agenda & Discussion Notes

### 1.1 Architecture & Performance Review
- Reviewed edge latency and font/asset cache hit rates.
- Prioritized editor/preview scroll alignment when \`[toc]\` blocks expand.

### 1.2 Export & Presentation Workflow
- Enabled direct editable \`.pptx\` export and hardened print/PDF page-break rules with running headers and page numbers.

---

## 2. Decisions & Action Items

| ID | Action Item | Owner | Due Date | Status |
| :--- | :--- | :--- | :--- | :--- |
| AI-01 | Ship anchor-based editor scroll sync | Frontend | 2026-11-24 | In Progress |
| AI-02 | Verify PPTX & PDF pagination output | QA | 2026-11-25 | Pending |
| AI-03 | Publish print-ready document templates | Docs | 2026-11-26 | Done |

- [ ] Next follow-up sync: 2026-11-29 10:00 (release readiness check)
`,
    },
}

export function getPaperTemplate(templateId, lang = 'zh-TW') {
    const entry = PAPER_TEMPLATES[templateId]
    if (!entry) return ''
    return entry[lang] || entry['en-US'] || entry['zh-TW'] || ''
}
