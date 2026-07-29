# faber-castell-color — Session context

Faber-Castell 色號 → CSS（hex / `var(--fc-NNN)` / `rgb()` / `.fc-bg-NNN`）對照的**唯讀參考**單頁 WebApp：
259 色色票網格、搜尋、點擊看明細（含系列、耐光度與套組收錄）、一鍵複製四種格式、整份 `.css` 匯出／下載，
外加**獨立的「套組收錄對照」頁**（`sets.html`：色 × 套組矩陣，形制對齊官方色卡；
選一個套組就只留下它的顏色，再橫向看其他套組有沒有涵蓋）。
資料含兩個系列：**Art & Graphic 141 色**（101–480）＋ **Black Edition 118 色**（701–818）。

本 app 屬於 **nodeapp WebApp 家族**；共同規範與流程在
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md` 規範、`WORKFLOW.md` 流程）。**改動前請先讀那兩份，照其中 canon 做。**

## 結構

```
app.js                                  # Express 入口：port 3000；/ → 302 /apps/faber-castell-color/
                                        # 唯讀，無 API、無上傳（薄後端只做 static + 轉址 + JSON 404）
public/apps/faber-castell-color/        # 前端（服務於 /apps/faber-castell-color/）
├─ index.html · faber-castell-color.css · faber-castell-color.js · faber-castell-color-lib.js
├─ sets.html · sets.css · sets.js         # 第二頁：套組收錄對照（共用 lib / i18n / locales / side-tool）
├─ colour-detail.js                       # 兩頁共用的色票明細 Modal（碰 DOM，故不在 lib）
├─ verify-links.js                        # 契約檢查：側鍵入口、跨頁查詢參數、data-* 都要有人接
├─ data/fc-colors.js                    # 靜態資料 window.FC_COLORS（259 色，由兩份官方色卡 PDF 產生）
├─ data/fc-names-i18n.js                # 選用：FC 色名 zh/ja 在地化對照（generate.js 一併產生；供他 app 共用）
├─ materialize-dark.css · side-tool.css · side-tool.js · i18n.js · locales/{zh-Hant,en,ja}.js   # （樣式＋行為：check 微回饋、矮視窗溢出收納；權威版＝家族 repo，§5.5）
└─ icons/                                 # 中性「色卡（五條色帶）」標記，非 FC 品牌 logo
   ├─ faber-castell-color-icon(-light).svg  # 母版 tile（深/淺）
   ├─ favicon(.ico/.svg/-light.svg) · icon-{16..512}.png · manifest.json
scripts/make-icons.py                     # 由母版重出整套 icon（PNG/.ico/manifest），可重跑
scripts/sync-copies.sh · scripts/export-css.js
```

無 `routes/`、無 `public/upload/`——這是唯讀參考 app，資料是烘進前端的靜態 registry。

## 執行 / 驗證

```bash
npm install && node app.js              # → http://localhost:3000/apps/faber-castell-color/
node public/apps/faber-castell-color/verify-links.js   # 靜態契約檢查（markup ↔ handler）
python3 scripts/make-icons.py                         # 重產整套 App icon（改母版參數後跑）
```

> **`make-icons.py` 用 PyMuPDF 光柵化，有兩個限制**（`copic-color` 也踩過）：
> ① **不渲染 `linearGradient`**，會整片退成黑色 → 母版一律純色底；
> ② **以 SVG 宣告的 `width`/`height` 為基準、不是 `viewBox`** → 倍率要用
> 「目標 ÷ 實際 page 寬」反推。詳見 DESIGN.md §9.1。

驗證（preview 實跑）：`/` 302、資產 200、`fc-colors.js` 200、API 404 回 JSON、259 色票渲染、
搜尋過濾、點色票開明細（4 種複製格式 + 系列 + 耐光度 + 套組）、CSS 匯出/下載、i18n 三語、主題切換
（**色票保留真實顏色、只有外殼跟主題**）。

> **⚠️ 別用 `file://` 驗證**：這支 app 零後端、看似能直接開檔案跑，但 preview pane 的
> `file://` 會**快取子資源**——`index.html?v=N` 只換得掉 HTML，`.js` 仍是舊的，
> 於是「改了沒生效」會是快取的假象（2026-07-28 實際踩過，追了半天）。一律起 server 驗。

## 資料重新產生

**2026-07-29 起改由 `db_artcolor` 匯出**（見 DESIGN.md §3.1）：

```bash
# 在家族工作區（未納版控）：My Projects/Art Colour/export/
node a3-export.js --check    # 逐位元組比對本 repo 的 data/fc-colors.js 與 DB 重建結果
node a3-export.js --write    # 由 DB 重新產生
bash scripts/sync-copies.sh  # 匯出後務必同步 6 份複製（md5 驗證）
```

> **⚠️ 不要再跑 `data/source/generate.js`**——它會用凍結的 CSV 覆蓋掉 DB 側的任何修正。
> 下列抽取器保留為**沿革**（記錄資料當初怎麼來），不再是輸入端：
> `extract_black_edition.py`／`make_polychromos_120.js`／`generate.js`。

## 本 app 的 canon 重點

- **唯讀參考、無後端 API**：259 色資料是靜態 `data/fc-colors.js`（`window.FC_COLORS`），
  **由 `db_artcolor` 匯出**（見 DESIGN.md §3.1）；不需上傳/編輯，故 `app.js` 極簡。
  **app 本身不連任何資料庫**——資料檔進版控，clone 下來 `npm start` 就能跑。
- **兩個系列（`series` 欄位）**：`ag`（Art & Graphic，141 色）與 `black-edition`（118 色），
  各有自己的權威色卡、各自的抽取難度；色號範圍不重疊故 `--fc-NNN` 不撞名。
  **`nearestFC` 預設只比 `ag`**——見下。
- **可嵌入 lib** `faber-castell-color-lib.js`（`window.FaberCastellCssLib`）：`filter` / `sortColors`
  （`code`/`hue`/`lightness`/`family`/`hex`，無彩度殿後）/ `colorFamily`＋`FAMILY_ORDER`（9 色系分群）/
  `setIndex`／`colorsInSet`／`colorsWithoutSet`／`assortmentMatrix`／`columnGaps`
  （**套組↔顏色雙向**與「還缺幾色」，見 DESIGN.md §3.3）/
  `hexToRgb` / `rgbToHsl` / `pickTextColor`（WCAG 對比選黑白字）/ `copyValue` /
  **`buildCss`（產生整份 `:root`＋utility）**，**純邏輯不碰 DOM**；`faber-castell-color.js` 才是碰 DOM 的
  控制器（渲染、排序側鍵、色系分群 sticky 標頭、CSS 匯出、toast）。
- **明細 Modal 是兩頁共用模組** `colour-detail.js`（`window.FCDetail`）：注入 markup、
  渲染一個色、四格式複製。**碰 DOM 所以不進 lib**，但兩頁都要用所以也不留在任一控制器裡。
  「點了套組尺寸要做什麼」由呼叫端的 `onSetClick` 決定——index 是跳去 `sets.html?set=`，
  sets.html 是就地換篩選（不離開頁面，篩選與捲動位置都保住）。
- **`buildCss` 是 CSS 單一真相**：現產生 259 個 `--fc-NNN` 變數，標頭的來源／金屬色清單由資料算出。
  工作區的兩份 `faber_castell_colors.css` 已用它重新產生、三者 byte-identical
  （`node scripts/export-css.js` 可重跑；見 DESIGN.md §4）。
- **`nearestFC` 預設 `series:'ag'`**：Black Edition 是另一條產品線（SuperSoft、hobby），
  不能拿來回答「該拿哪支筆」。加入 118 色對 `color-palette`／`thangka-trace` 的比對結果
  **零影響**（4096 點 RGB 網格實測 0 差異）。要比 BE 得明示 `{ series:'black-edition' }`，
  `'*'` 為全收；**無 `series` 欄位的色一律當 `'ag'`**，故自備清單行為不變。
- **色票不隨主題重著色**（§4.7「內容本身即設計」）：色塊恆為 Faber-Castell 真實色，
  只有外殼（bg/文字/工具列）跟 light/dark；色塊上文字黑白由 `pickTextColor` 依對比自動選。
- **色名是資料、永不翻譯**（Faber-Castell 英文色名保留於 `FC_COLORS`）；UI 字串才三語。
  **但**產生器另出**選用**的 `data/fc-names-i18n.js`（`window.FC_NAMES_I18N`＝code→{zh,ja}，來源 `faber_castell_color_code_css_foreground_zh_ja.csv` 的 `colour_name_zh_tw`／`colour_name_ja`）——這是**給消費端 app 的共用對照**（如 `color-palette` 的色彩肖像依語言顯示焦點色名），不改動 `FC_COLORS` 的英文 canonical 名，本 app UI 也仍不翻譯色名。
- **主題**：CSS 變數 light/dark，預設 dark；切換時同步 toggle `dark-mode`/`light-mode` class（§5.1 坑）。
- **i18n**：`i18n.js` 引擎 + `locales/*.js`，`data-i18n` 屬性，預設 `zh-Hant`。
- **hex 是螢幕近似值**：非官方 RGB 規格。`ag` 為像素取樣自 PDF 色票；`black-edition` 的
  701–806 是 PDF 向量填色（精確值，但仍是印刷色表設定值、非筆芯實際上色）。
  金屬色（250/251/252/290/292/294 ＋ 807–818）為漸層色票、無單一真值，
  hex 僅為粗略近似（明細標「近似」、`note` 記錄）。

## 複製件登記（共用件改版時回來同步）

| 檔案 | 來源（以此為準） |
|---|---|
| `materialize-dark.css` | 家族 repo `nodeapp-webapp-family/materialize-dark.css` |
| `side-tool.css`（正統 flex 版）| 家族 §5.5 正統版（複製自 `color-palette`） |
| `filter-clear.css`、`filter-clear.js` | 家族 §5.12 篩選框「清除」× 鈕 utility（自 `local-reader` 複製、byte-identical） |
| `i18n.js` | 家族 repo `nodeapp-webapp-family/i18n.js`（權威版，byte-identical；`locales/*.js` 各 app 自維護） |
| `data/fc-colors.js` | **由 `db_artcolor` 匯出**（2026-07-29 起；家族美術色材領域庫＝ System of Record）。`data/source/*.csv` 已凍結為來源沿革，見 DESIGN.md §3.1 |

> **本 app 是 `faber-castell-color-lib.js` ＋ `data/fc-colors.js` 的權威版**，各有 6 份複製：
> 本尊、`color-palette`、`thangka-trace`，各含 InProgress 鏡像。
> 同步與驗證用 `bash scripts/sync-copies.sh`（會 md5 確認每份都是單一 hash）。

> 為什麼長這樣（唯讀決策、資料來源與驗證、CSS 單一真相、色票不著色）見 [DESIGN.md](DESIGN.md)。
