# 自然大叔 ∣ 訂單排程系統（888）

這是一套**純前端（Static / SPA）**的訂單排程與營運管理工具：以 `index.html` 作為唯一入口，透過多支 JavaScript 模組切換視圖並操作資料。  
資料預設儲存在瀏覽器 **localStorage**，可進行 **JSON/CSV/XLSX 匯出匯入**，並支援 **Google Drive 備份/還原** 與 **Google Calendar 建立行程**。

---

## 功能分頁（Tabs）

- **📋 排程**
  - 新增/編輯訂單、排程日期時間、技師/來源/狀態管理
  - 訂單列表搜尋（姓名/電話/地址）、多條件篩選
  - 30 天內到期提醒（due soon panel）
  - 金額自動計算、鎖定金額、備註與附件連結等

- **💸 花費**
  - 花費 CRUD、分類統計
  - CSV / JSON 匯出匯入

- **📊 報表 / 統計**
  - KPI、年度/月份統計、圖表（Chart.js）
  - **報表明細（訂單）支援年份 + 月份篩選**
  - **效能最佳化：不在進站時預先載入所有訂單明細，而是切到報表分頁時才初始化（lazy load）**

- **👥 客戶管理**
  - 由訂單彙整客戶資料（多電話/多地址）
  - 客戶搜尋、匯出、查看歷史紀錄

- **⏰ 提醒**
  - 依最後完成日期與提醒週期產生到期清單
  - 支援靜音/忽略名單（避免重複追蹤）

- **⚙️ 設定**
  - 價格規則設定（計價規則 / 門檻）
  - 全資料匯出/匯入（JSON）
  - Google Drive 備份/還原

---

## 專案檔案結構與角色

- `index.html`  
  單頁入口，包含所有分頁視圖（Panels）、表格、表單與各種 Modal。  
  透過 JS 動態切換顯示/隱藏。

- `styles.css`  
  全站樣式（RWD、表格、卡片、工具列、Modal、按鈕、提醒/狀態標籤等）。

- `app.core.js`（核心與資料層）
  - localStorage 讀寫封裝、初始化流程
  - staff/contact/客戶資料庫（contacts）等基礎資料處理
  - 共同工具函式（格式化、DOM helper、選項初始化等）

- `app.reminder.js`（提醒邏輯）
  - 依訂單完成日 + 週期計算到期日
  - 提醒狀態（已通知/靜音）相關工具

- `app.pricing.js`（計價規則）
  - `DEFAULT_PRICING` 與價格設定載入/保存
  - `calcTotal()`：依項目數量與門檻計算金額

- `app.form.js`（訂單表單）
  - 表單收集/回填：`gatherForm()` / `fillForm()`
  - 金額即時計算：`recalcTotals()`
  - 鎖定金額/欄位控制

- `app.table.js`（訂單列表表格）
  - `refreshTable()`：依月份/技師/狀態/搜尋條件渲染列表
  - 列表操作：狀態切換、確認切換、複製、附件提示等

- `app.expense.js`（花費）
  - 花費 CRUD、摘要統計
  - CSV/JSON 匯出匯入

- `app.views.js`（視圖層/事件綁定）
  - Tabs 切換、各分頁初始化入口
  - Header（工具列）手機布局編輯器
  - 主要互動事件綁定（按鈕、篩選、匯出匯入、Modal 開關等）

- `app.google.js`（Google 整合）
  - Drive：備份/還原（上傳 JSON 檔到雲端、輪替備份）
  - Calendar：由訂單建立行事曆事件（時間/地點/描述整合）

- `app.js`（主程式與報表/客戶彙整）
  - `boot()`：整體初始化、渲染與跨模組整合
  - 報表（KPI / 年度統計 / 圖表 / 明細表）
  - 客戶管理（彙整、歷史紀錄 Modal）
  - 忽略/靜音名單與額外 UI 工具

---

## 依賴（CDN）

此專案不使用打包工具，直接在 `index.html` 以 CDN 載入：
- SweetAlert2（對話框）
- SheetJS xlsx（Excel 匯出/匯入）
- Chart.js（圖表）
- Google API / Google Identity Services（Drive/Calendar）

---

## localStorage 資料 Key（重要）

主要資料儲存在瀏覽器 localStorage，常見 key：
- `yl_clean_orders_v1`：訂單
- `yl_clean_staff_v1`：技師/人員
- `yl_clean_contact_v1`：來源選項
- `yl_clean_contacts_v1`：客戶資料庫（多電話/多地址）
- `yl_clean_expenses_v1`：花費
- `yl_clean_expense_categories_v1`：花費分類
- `yl_clean_pricing_v1`：價格規則
- `headerLayoutMobile_v1`：手機工具列布局
- `orderFormLayout_v1`：訂單表單欄位布局（排序/顯示）
- `yl_clean_form_layout_v1`：訂單表單欄位寬度（grid column）
- `ignoredHistoryPairs_v1` / `ignoredHistoryIds`：忽略/靜音相關資料
- `backupIndex`：雲端備份輪替用索引

> 提醒：localStorage 以「同一台裝置同一個瀏覽器」為主。若要跨裝置同步，請使用 Google Drive 備份/還原。

---

## 使用方式

### 1) 直接使用（本機）
- 最簡單：雙擊 `index.html` 開啟即可使用（純 localStorage 功能可正常運作）
- **若要使用 Google Drive / Calendar**：建議用本機靜態伺服器開啟（避免某些瀏覽器限制 `file://`）
  - Windows / macOS / Linux：
    - 在專案資料夾內執行：`python -m http.server 8000`
    - 打開：`http://localhost:8000/`

### 2) 部署（Static Hosting）
可部署到任何靜態網站服務（例如 GitHub Pages、Cloudflare Pages、Nginx 靜態站點）。  
若要啟用 Google 功能，請確保網站是 **HTTPS** 且 OAuth 設定允許該網域。

---

## 報表明細（訂單）效能調整說明

為避免訂單資料逐年累積後，**進站即渲染全部明細**造成卡頓，已調整為：
- **切換到「📊 報表 / 統計」分頁時才初始化明細功能（lazy load）**
- 明細區新增 **年份** 下拉選單，與 **月份** 搭配篩選
- 月份預設優先選「本月」，若該年沒有本月資料則改選「該年最新月份」

---

## 維護備註（給之後擴充的人）

- 此專案採用「多檔案 + 全域共享狀態」的方式（例如 `orders`、`contacts` 等），**script 載入順序不可隨意調整**。
- 若要新增欄位：
  1) `index.html` 加欄位
  2) `app.form.js`：gather/fill + recalc
  3) `app.table.js`：列表欄位顯示/搜尋權重
  4) `app.js`：報表/客戶彙整（若該欄位會被統計）

---

## 版本資訊

- 此版本包含「報表明細（訂單）」lazy load + 年份選單的效能更新。
