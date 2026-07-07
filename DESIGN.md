# faber-castell-color — 設計決議（DESIGN）

> 版本 v1.1｜最後更新 2026-07-07

「怎麼用」歸 [README](README.md)、家族共同規範歸
[nodeapp-webapp-family](https://github.com/scottgfhong310/nodeapp-webapp-family)；本檔只記**為什麼長這樣**。

## 1. 為什麼是「唯讀、無後端 API」

家族標準骨架含 `/api/upload` + 列表（viewer 類）或 owner registry 回寫（策劃類）。本 app 兩者都不要：

- 資料是**固定的**——141 色由來源 PDF 一次性抽取產生，不會被使用者新增/編輯。
- 因此把資料**烘成靜態 registry** `data/fc-colors.js`（`window.FC_COLORS`），前端 `<script>` 直接載入，
  免 fetch、免 API。`app.js` 只剩 static + `/`→302 + JSON 404（連 `routes/`、`public/upload/` 都省）。

這是家族「薄後端」原則的極限案例：後端薄到只是個靜態檔伺服器。要更新資料時改的是**產生器**（見 §3），
不是 app。

## 2. 資料來源與準確度（hex 是怎麼來的）

來源：`Farbtabelle-AG-ENG-0214.pdf`（Faber-Castell Art & Graphic 色卡）。PDF 每個色號左側有一個**印刷色塊**。

- **抽取法＝點陣像素取樣**：把頁面用 PyMuPDF 算成點陣圖，取每個色塊中心的像素平均值 → sRGB hex。
  一開始試過讀向量 `rect` 填色，但部分特殊色（263/264/266…）的色塊是用 pdfplumber 讀不到的填色方式
  （pattern/overprint）繪製，向量層只看到灰色佔位——**像素取樣才是正解**。
- **交叉驗證**：另做一次獨立的向量抽取，兩者在 108 個實色上每通道平均差僅 ~1.3/255（互相印證）；
  9 個特殊色以像素法補上（Δ0 對齊）。
- **金屬色（250/251/252/290/292/294）**：色塊是漸層、無單一真值，hex 僅為粗略近似——UI 明細標「近似」、
  資料 `note` 記為 `metallic – approximate`。

因此文件一律聲明：**hex 為螢幕近似值、非官方 RGB 規格**。要精準對色請以 Faber-Castell 官方色票為準。

## 3. 資料產生管線（單一真相在 CSV）

`data/fc-colors.js` 由家族工作區的 `Faber-Castell/*.csv` 合併產生：

| 來源 CSV | 併入欄位 |
|---|---|
| `faber_castell_color_codes.csv` | code / name / hex / R,G,B / cssVar / page / note（141 色，權威 hex）|
| `colours_lightfastness_p1-3.csv` | `lf`：5 條產品線的耐光度（120 色）|
| `set_assortments_p1-3_long.csv` + `goldfaber_p7_long.csv` | `sets`：line → 尺寸陣列 |

`lf` / `sets` 只涵蓋 PDF 頁 1–3（＋Goldfaber 頁 7）——其餘分頁（麥克筆/Pitt Artist Pen/漫畫套組）
版面複雜（GTIN 欄、雙表重疊）未抽取，故粉彩 406–480、金屬 290+ 等只有 code/hex、無 lf/sets。這是**已知範圍**，非缺陷。

## 4. CSS 是由 app 生成的（單一真相）

`FaberCastellCssLib.buildCss(FC_COLORS)` 產生整份 `:root` 變數 + `.fc-color-NNN` / `.fc-bg-NNN` utility classes，
其變數＋class 區塊與家族 repo 的 `Faber-Castell/faber_castell_colors.css` **逐字一致（423 行）**。
意義：那份手裡的 `.css` 等於由本 app 生成——改資料只需重跑產生器，`buildCss` 輸出隨之更新，兩處不會分歧。

## 5. 色票不隨主題重著色

比照 DESIGN_GUIDELINES §4.7「內容本身即設計」（pptx-viewer 投影片維持作者原貌）：色塊呈現的是
**Faber-Castell 真實顏色**，若隨 dark 主題反白會失真。故色塊恆為原色，只有外殼（背景/文字/工具列）跟
light/dark；色塊上的**文字**黑白由 `pickTextColor`（WCAG 相對亮度對比）自動選，**固定於該色塊、與主題無關**，確保任何底色都可讀。

> **坑（materialize-dark 覆蓋）**：`materialize-dark.css` 有一條
> `body, p, span, li, … { color: var(--mz-text) }` 會命中**裸 `<span>`**，把號碼的 inline 前景蓋掉、
> 改成跟著主題的 `--mz-text`——結果 dark 模式下淺色塊上的號碼變淺、看不見。修法：以較高特異度
> `.fc-swatch .code, .fc-swatch .badge { color: inherit }` 讓它繼承色塊自身的 `pickTextColor` 前景
> （不需 `!important`）。任何「在彩色底上放裸 span 文字」的家族 app 都會踩到，值得回補 DESIGN_GUIDELINES §5.1。

## 6. lib ↔ 控制器邊界（§4.1）

- **lib（`FaberCastellCssLib`）純邏輯**：`filter` / `sortColors` / `colorFamily` / `hexToRgb` / `rgbToHsl` /
  `rgbToLab` / `deltaE` / `nearestFC` / `relLuminance` / `pickTextColor` / `copyValue` / `buildCss`——「離開這個畫面仍成立」的都在這，零依賴、不碰 DOM。
- **控制器（`faber-castell-color.js`）碰 DOM**：渲染網格與色系分群 sticky 標頭、排序側鍵、Materialize Modal、
  `navigator.clipboard`（含 `execCommand` 回退）、Blob 下載、toast、i18n 重繪、主題/語言切換。

## 7. 排序與「金屬即中性」

排序側鍵（`#setting-sort`）循環五模式、預設色號、存 `localStorage('faber-castell-color-sort')`：
`code`（廠商順序）→ `hue`（色相光譜）→ `lightness`（明度）→ `family`（9 色系分群 + sticky 標頭）→ `hex`（原始值）。

- **`hex` 模式屬「原始值 / 字典序」排序，非感知式**：固定 6 位小寫 `#rrggbb` 的字串序等同 `0xRRGGBB` 數值序，
  即 **R 主導 → G → B** 的巢狀排序。確定、可重現，但視覺不連貫（高紅色綁一起、相似色可能被拉遠），
  與 `hue`/`lightness`/`family` 的感知式排序刻意並列作對照。

- **無彩度統一判準 `isAchromatic(color)`**：`hue` 與 `family` 兩模式共用同一條界線——**金屬色**（`note` 含
  metallic）**或** HSL 飽和度 `s < 0.17`。彩色排色相／進對應色系，無彩度殿後／歸 `neutral` 群、依明度排。
- **為什麼是 0.17**：量測後 12 個灰系（warm/cold grey）飽和度最高 0.158，最低的「muted 真色」
  （olive 173、chromium 174、nougat 178）≥0.19，中間有乾淨間隙。取 0.17 讓所有灰歸中性，又不會誤抓帶灰的棕/橄欖色。
- **金屬即中性**：6 個金屬色（250/251/252、290/292/294）是近白漸層色票，HSL 在近白處會把微小色差**放大成高飽和度**
  （如 gold `#fffdf4` 算出 s≈1.0），若只看飽和度會被誤分進黃/藍/洋紅。故 `isAchromatic` **明確把金屬色一律當中性**，
  讓它們在色相與分群兩種瀏覽下都跟灰系待在一起（與 §2 「金屬色無單一真值、標近似」一致）。

## 8. 最接近 FC 色比對——這支 lib 對外的第二個身分

本 app 的 lib 不只服務「瀏覽這 141 色」，還是一個**比對器**：給任一顏色（相片、螢幕取色），找出最接近的
Faber-Castell 色號。這是把一個抽象、握不到的螢幕 hex（`#AA3F1C`），接到「畫桌上買得到、握得到的那支筆」的
**一座橋**。這座橋的兩端——141 色的參考庫、與感知色距——都在本 app，所以匹配邏輯理所當然長在這支 lib，
而非各消費端各自重造。

- **理念（與消費端 CONCEPT 對齊）**：`color-palette` 與 `thangka-trace` 從影像萃取/取色得到的是「螢幕上的色」；
  `nearestFC` 把它翻成「現實中的顏料」。前者的 CONCEPT.md 稱之為「朝外的橋」（色票 ↔ 買得到的筆），
  後者稱之為臨摹鏈路末端的「該拿哪支筆」。**呈現方式歸消費端**（A 徽章／B 前 3 名替代色／C 取色鏡即時讀值），
  本 app 只提供**資料 ＋ 比對**。
- **度量＝CIEDE2000（ΔE00）**：不是 RGB 歐氏、也不是 ΔE76。ΔE76 在藍區明顯高估（會把中藍配成靛藍而非鈷藍）；
  CIEDE2000 貼近人眼，且對標 Sharma et al. 參考資料集逐筆吻合。`nearestFC` 先 `rgbToLab` 再以 `deltaE`（ΔE00）排序。
- **排除金屬色**：金屬是漸層近似值（§2/§7），比中它會給出誤導的匹配，故 `nearestFC` 預設只比 135 個非金屬實色。
- **純函式、以複製件共用**：`nearestFC` / `rgbToLab` / `deltaE` / `deltaEBand` 皆不碰 DOM。比照 `materialize-dark.css`
  慣例，把整支 `faber-castell-color-lib.js` ＋ `data/fc-colors.js` **複製**進 `color-palette` / `thangka-trace`
  （各自 CLAUDE.md 登記複製點）；**單一真相在此**，度量或資料改版後重新複製、重跑產生器即可。
