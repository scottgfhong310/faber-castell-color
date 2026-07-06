# faber-castell-color — Session context

Faber-Castell 色號 → CSS（hex / `var(--fc-NNN)` / `rgb()` / `.fc-bg-NNN`）對照的**唯讀參考**單頁 WebApp：
141 色色票網格、搜尋、點擊看明細（含耐光度與套組收錄）、一鍵複製四種格式、整份 `.css` 匯出／下載。

本 app 屬於 **nodeapp WebApp 家族**；共同規範與流程在
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md` 規範、`WORKFLOW.md` 流程）。**改動前請先讀那兩份，照其中 canon 做。**

## 結構

```
app.js                                  # Express 入口：port 3000；/ → 302 /apps/faber-castell-color/
                                        # 唯讀，無 API、無上傳（薄後端只做 static + 轉址 + JSON 404）
public/apps/faber-castell-color/        # 前端（服務於 /apps/faber-castell-color/）
├─ index.html · faber-castell-color.css · faber-castell-color.js · faber-castell-color-lib.js
├─ data/fc-colors.js                    # 靜態資料 window.FC_COLORS（141 色，由 PDF 產生）
├─ materialize-dark.css · side-tool.css · i18n.js · locales/{zh-Hant,en,ja}.js
```

無 `routes/`、無 `public/upload/`——這是唯讀參考 app，資料是烘進前端的靜態 registry。

## 執行 / 驗證

```bash
npm install && node app.js              # → http://localhost:3000/apps/faber-castell-color/
```

驗證（preview 實跑）：`/` 302、資產 200、`fc-colors.js` 200、API 404 回 JSON、141 色票渲染、
搜尋過濾、點色票開明細（4 種複製格式 + 耐光度 + 套組）、CSS 匯出/下載、i18n 三語、主題切換
（**色票保留真實顏色、只有外殼跟主題**）。

## 本 app 的 canon 重點

- **唯讀參考、無後端 API**：141 色資料是靜態 `data/fc-colors.js`（`window.FC_COLORS`），
  由 `Faber-Castell/*.csv` 產生（見 DESIGN.md §資料）；不需上傳/編輯，故 `app.js` 極簡。
- **可嵌入 lib** `faber-castell-color-lib.js`（`window.FaberCastellCssLib`）：`filter` / `sortColors`
  （`code`/`hue`/`lightness`/`family`，無彩度殿後）/ `colorFamily`＋`FAMILY_ORDER`（9 色系分群）/
  `hexToRgb` / `rgbToHsl` / `pickTextColor`（WCAG 對比選黑白字）/ `copyValue` /
  **`buildCss`（產生整份 `:root`＋utility）**，**純邏輯不碰 DOM**；`faber-castell-color.js` 才是碰 DOM 的
  控制器（渲染、排序側鍵、色系分群 sticky 標頭、Modal、clipboard、toast）。
- **`buildCss` 是 CSS 單一真相**：其輸出的變數＋class 區塊與家族 repo 的
  `Faber-Castell/faber_castell_colors.css` **逐字一致**（423 行），那份等於由本 app 生成。
- **色票不隨主題重著色**（§4.7「內容本身即設計」）：色塊恆為 Faber-Castell 真實色，
  只有外殼（bg/文字/工具列）跟 light/dark；色塊上文字黑白由 `pickTextColor` 依對比自動選。
- **色名是資料、永不翻譯**（Faber-Castell 英文色名保留）；UI 字串才三語。
- **主題**：CSS 變數 light/dark，預設 dark；切換時同步 toggle `dark-mode`/`light-mode` class（§5.1 坑）。
- **i18n**：`i18n.js` 引擎 + `locales/*.js`，`data-i18n` 屬性，預設 `zh-Hant`。
- **hex 是螢幕近似值**：像素取樣自 PDF 色票、非官方 RGB 規格；金屬色（250/251/252/290/292/294）
  為漸層色票、無單一真值，hex 僅為粗略近似（明細標「近似」、`note` 記錄）。

## 複製件登記（共用件改版時回來同步）

| 檔案 | 來源（以此為準） |
|---|---|
| `materialize-dark.css` | 家族 repo `nodeapp-webapp-family/materialize-dark.css` |
| `side-tool.css`（正統 flex 版）| 家族 §5.5 正統版（複製自 `color-palette`） |
| `i18n.js` | 家族共用（`markdown-reader` 等同款引擎） |
| `data/fc-colors.js` | 由 `Faber-Castell/*.csv` 產生器合併（來源 `Farbtabelle-AG-ENG-0214.pdf`）|

> 為什麼長這樣（唯讀決策、資料來源與驗證、CSS 單一真相、色票不著色）見 [DESIGN.md](DESIGN.md)。
