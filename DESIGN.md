# faber-castell-color — 設計決議（DESIGN）

> 版本 v1.3｜最後更新 2026-07-28

「怎麼用」歸 [README](README.md)、家族共同規範歸
[nodeapp-webapp-family](https://github.com/scottgfhong310/nodeapp-webapp-family)；本檔只記**為什麼長這樣**。

## 1. 為什麼是「唯讀、無後端 API」

家族標準骨架含 `/api/upload` + 列表（viewer 類）或 owner registry 回寫（策劃類）。本 app 兩者都不要：

- 資料是**固定的**——259 色由來源 PDF 一次性抽取產生，不會被使用者新增/編輯。
- 因此把資料**烘成靜態 registry** `data/fc-colors.js`（`window.FC_COLORS`），前端 `<script>` 直接載入，
  免 fetch、免 API。`app.js` 只剩 static + `/`→302 + JSON 404（連 `routes/`、`public/upload/` 都省）。

這是家族「薄後端」原則的極限案例：後端薄到只是個靜態檔伺服器。要更新資料時改的是**產生器**（見 §3），
不是 app。

### 1.1 為什麼也不用資料庫——與重新評估的觸發條件

2026-07-28 覆核（起因：與 `caran-dache-color` 一併評估「色號資料改用 DB 整理」）。
按 DATABASE_GUIDELINES §0 決策階梯爬完，**結論是維持第 0/1 層**，理由四條、由強到弱：

- **repo 是 public**——判準二直接排除本機 PostgreSQL（層 3）：clone 下來 `npm start` 就要能動，
  不該依賴一台在你機器上的 DB（`.env` ＋ `DATABASE_URL` ＋ schema）。真要在公開 repo 帶結構化資料，
  canon 的答案是 **SQLite（層 2）**，不是 PG。
- **量級與查詢型態不需要**——259 筆、`data/fc-colors.js` 約 100KB；所有操作是記憶體內 filter/sort ＋
  ΔE00 最近色比對。而 `nearestFC`（§8）被 `color-palette` / `thangka-trace` 逐像素呼叫，
  **本來就必須跑在前端**——這一段 DB 不但幫不上忙，每次輸入往返一次只會更慢。
- **沒有寫入端**——資料由來源 PDF 一次性抽取後即凍結（§1 上半、§2），使用者不新增不編輯。
- **單一真相與單向維護迴路已經有了**——CSV →`generate.js`→ 靜態 JS（§3），與 `db_vkb` V8.0d
  收斂出的形狀同構。此時進 DB 不是「補上治理」，是**多開一個 System of Record**。

**不是資料庫問題的那一項**：`data/fc-colors.js` 與 `faber-castell-color-lib.js` 各有三份複製
（本尊＋`color-palette`＋`thangka-trace`，§8）。就算資料進了 DB，消費端逐像素比對仍需本地副本——
這是**共用件同步**問題（A 類慣例，SHARED_LIBRARY_GUIDELINES），不是資料庫問題，別用 DB 去解。

> **2026-07-28 二度覆核（加入 Black Edition 之後）**：結論不變，維持第 0/1 層。
> 加入 118 色讓筆數翻近一倍、並讓資料**首次出現「多系列」維度**——但那個維度用一個
> `series` 字串欄位就表達完了（§2、§8），沒有需要 join 的第二個實體。
> 產生器仍是單向迴路（色卡 → 抽取器 → CSV → `generate.js` → 靜態 JS），寫入端依然不存在。
> **反而是「第 1 條觸發條件」離得更近了一點**：現在庫裡有兩條產品線，若再收第三、第四個
> **品牌**（非同品牌的第二條線），就該重讀下面那三條。

**觸發條件（滿足任一才重新評估）**：

1. **跨品牌對照升格成第一級資料**——收進第三、第四個品牌，且要的是**人工策劃的對應關係**，
   而非 ΔE 算出來的最近色。特別是**顏料索引**這條軸（Caran d’Ache 總表已有 `PW6`／`PR101`／
   `PB15/PBk6`，本 app 未抽；`db_vkb.tb_pigment` 有 `fd_color_index` 可當接點）。
2. **出現寫入端**——庫存／願望清單／**實際上色掃描樣本**（相對於 PDF 取樣的近似 hex），
   且要與 `color-palette`／`thangka-trace` 共享 → 判準一直接指向層 3。
3. **校正需要 audit trail**——目前校正只落在產生檔的 `note` 字串（金屬色近似，§2）；
   要記「誰在何時把哪個 hex 從什麼改成什麼、依據是什麼」，才輪到 OPERATION_DATA_GUIDELINES 第二層。

**真要做的話形狀長這樣**（先寫在這，免得那天重推一次）：開自己的應用領域庫 **`db_artcolor`**
（別名 `artcolor`），**不塞進 `db_vkb`**——那邊 `meta_brand` 是相機／鏡頭／底片廠、`tb_color` 是
CSS4／SEMANTIC／PIGMENT 的攝影視覺知識域，彩色鉛筆的「系列 × 色號 × 耐光度標準 × 套裝尺寸」是
另一個領域；接點只有顏料，用 `fd_uidx` 跨庫軟連結（DATABASE_GUIDELINES §2.4），不搬資料。
DB 成為 SoR 之後，**產生器反向成匯出器**（DB → `data/*.js`，進版控當建置產物），
本 app 的形狀一個字都不用改：照樣零後端、公開、自包含。維護介面放 InProgress 的私有 app，
公開 app 永不連 DB。開庫照 `db_vkb` 先例（開庫 SOP → 治理文件 → `.env` 別名 → 單向維護迴路）。

## 2. 資料來源與準確度（hex 是怎麼來的）

資料分**兩個系列**（`series` 欄位），各有自己的官方色卡；兩份都是 Faber-Castell 的
「Colour assortment」印刷色表，形制相同，但抽取難度不同。

| series | 色卡 | 色數 | hex 來源 |
|---|---|---|---|
| `ag` | `Farbtabelle-AG-ENG-0214.pdf`（Art & Graphic）| 141（101–480）| 點陣像素取樣 |
| `black-edition` | `Colour-assortment-Black-Edition.pdf` | 118（701–818）| **向量填色 106 筆（精確）** ＋ 金屬 12 筆像素取樣 |

兩個系列的色號範圍不重疊，故 `--fc-NNN` 變數不會撞名。

### 2.1 `ag`（Art & Graphic）

PDF 每個色號左側有一個**印刷色塊**。

- **抽取法＝點陣像素取樣**：把頁面用 PyMuPDF 算成點陣圖，取每個色塊中心的像素平均值 → sRGB hex。
  一開始試過讀向量 `rect` 填色，但部分特殊色（263/264/266…）的色塊是用 pdfplumber 讀不到的填色方式
  （pattern/overprint）繪製，向量層只看到灰色佔位——**像素取樣才是正解**。
- **交叉驗證**：另做一次獨立的向量抽取，兩者在 108 個實色上每通道平均差僅 ~1.3/255（互相印證）；
  9 個特殊色以像素法補上（Δ0 對齊）。
- **金屬色（250/251/252/290/292/294）**：色塊是漸層、無單一真值，hex 僅為粗略近似——UI 明細標「近似」、
  資料 `note` 記為 `metallic – approximate`。

### 2.2 `black-edition`

2026-07-28 加入。色卡來自 **Faber-Castell USA 官方知識庫**的
[Black Edition Colored Pencil Color Chart](https://fabercastellusa.reamaze.com/kb/color-charts-and-lightfast-ratings/black-edition-colored-pencil-color-chart)
（資產掛在官方 PIM，副檔名雖是圖片路徑但**實體是 PDF**）。與 `ag` 的差別有三：

- **色塊是向量填色，讀得到精確 RGB**——118 色中的 106 色（701–806）不必取樣，
  直接由 PDF 的 fill 值而來，比 `ag` 的像素取樣**更準**。
  - **坑**：色號 801 的色塊底下疊了一層 `#e3e3e3` **灰色佔位**（就是 §2.1 提到的同一種現象，
    只是這次向量層兩層都在）。取值必須依**繪製順序取最上層**，否則會拿到灰色。
  - 因此抽取器 `data/source/extract_black_edition.py` 內建**反向驗證**：
    118 色全部再獨立像素取樣一次與向量值比對（實測最大單通道差 **1/255**，純四捨五入）。
    刻意改取底層灰時該檢查會 FAIL（801 差 48/255）——證明它不是空跑的假檢查。
- **12 個金屬色（807–818）是漸層點陣圖**，與 `ag` 的 250/251/252/290/292/294 同一種情況，
  照同一套處方：像素取樣取平均、`note` 記 `metallic – approximate`、UI 標「近似」。
- **沒有耐光度**——Black Edition 是 hobby 線，原廠不發佈 lightfastness，故無 `lf` 欄。

**三張表並排的陷阱**：色卡是三張表左右並排、**列高完全對齊**，所以 701 / 751 / 801 的
y 座標相同。任何「同一列」的比對（色塊↔色號、• ↔ 色號）都**必須同時比對 x**，
只看 y 會把第二、三張表的資料錯配到第一張表上。

因此文件一律聲明：**hex 為螢幕近似值、非官方 RGB 規格**。要精準對色請以 Faber-Castell 官方色票為準。
（`black-edition` 的 106 個向量值雖是廠方定義的精確數字，但那是**印刷色表的設定值**，
仍不等於筆芯實際上色的顏色，故一樣不宣稱為官方 RGB 規格。）

## 3. 資料產生管線（單一真相在 CSV）

`data/fc-colors.js` 由 `data/source/*.csv` 合併產生（`node data/source/generate.js`）：

| 來源 CSV | series | 併入欄位 |
|---|---|---|
| `faber_castell_color_codes.csv` | ag | code / name / hex / R,G,B / cssVar / page / note（141 色，權威 hex）|
| `colours_lightfastness_p1-3.csv` | ag | `lf`：5 條產品線的耐光度（120 色）|
| `set_assortments_p1-3_long.csv` + `goldfaber_p7_long.csv` | ag | `sets`：line → 尺寸陣列 |
| `polychromos_120_web.csv` | ag | `sets`：Polychromos 120 ct（見下）|
| `black_edition_colour_codes.csv` | black-edition | code / name / hex / R,G,B / cssVar / series / note（118 色）|
| `black_edition_sets_long.csv` | black-edition | `sets`：4 條線 |

後兩支由 `extract_black_edition.py` 從官方色卡產生；`polychromos_120_web.csv` 由
`make_polychromos_120.js` 產生。**兩支抽取器都進版控**，資料要更新就重跑它們、再跑 `generate.js`。

**`ag` 的 `lf` / `sets` 只涵蓋 PDF 頁 1–3（＋Goldfaber 頁 7）**——其餘分頁（麥克筆/Pitt Artist Pen/漫畫套組）
版面複雜（GTIN 欄、雙表重疊）未抽取，故粉彩 406–480、金屬 290+ 等只有 code/hex、無 lf/sets。這是**已知範圍**，非缺陷。

### 3.1 為什麼 Polychromos 120 另開一支 CSV

色卡頁 1–3 的套組表**只到 72 ct**，沒有 120 這一欄——但 Polychromos 的完整範圍就是 120 色。
該尺寸的收錄清單改抓自產品頁（[FC110013](https://fabercastell.com/products/polychromos-artists-color-pencils-wood-case-of-120-110013)，
2026-07-28 取），**來源不是那份 PDF**，所以不併進檔名綁 PDF 頁碼的 `set_assortments_p1-3_long.csv`，
避免混淆 provenance。

這 120 個色號**全部早已在 141 色裡**（零新色），且現有 12/24/36/60/72 五個尺寸的成員
**全部包含在這 120 之內**——兩份來源互相印證，故採信。色名一律沿用色卡的 canonical 拼法，
不採產品頁的（產品頁與色卡有 8 處排版差異，如 `burnt siena` vs `Burnt Sienna`）。

### 3.2 套組以「收錄組合」為鍵，不是 SKU

Black Edition 的官方色卡把套組列成 12 個 SKU 欄，但其中成對的 SKU
（`116412`/`116413`、`116424`/`116425`、`116436`/`116437`、`116411`/`116490`）
**差別純粹是紙盒 vs 鐵盒，收錄色號完全相同**。故 `sets` 收斂成 4 條線、包裝不入資料：

| 產品線 | 尺寸 | SKU |
|---|---|---|
| `Black Edition colour pencils` | 12 / 24 / 36 / 50 / 100 | 116412·13 / 116424·25 / 116436·37 / 116450 / 116411·**116490** |
| `Black Edition skin tones` | 12 | 116414（783–788 ＋ 801–806）|
| `Black Edition neon + pastel` | 12 | 116410（789–800）|
| `Black Edition metallic` | 12 | 116415（807–818）|

**為什麼不能只收 701–800 那 100 色**：`skin tones` 橫跨 783–788 ＋ 801–806、
`metallic` 是 807–818——801–818 只存在於這兩個套組，砍掉就有兩條線表達不完整。故收滿 118。

四條線都叫「12 色」但內容互不相同，這正是**不能以尺寸當唯一鍵**、要拆線名的原因
（沿用 `Goldfaber` / `Goldfaber Aqua` 的既有做法，schema 不必改）。

## 4. CSS 是由 app 生成的（單一真相）

`FaberCastellCssLib.buildCss(FC_COLORS)` 產生整份 `:root` 變數 + `.fc-color-NNN` / `.fc-bg-NNN` utility classes，
現為 **259 個變數**（141 ag ＋ 118 black-edition）。標頭的來源清單與金屬色清單**由資料算出**，
不寫死——加系列或改金屬色判定，標頭自動跟上。

工作區的 `Faber-Castell/faber_castell_colors.css` 是 **Black Edition 加入前的 141 色快照**；
其 141 行變數與 `buildCss` 輸出的前 141 行**仍逐字相同**（2026-07-28 實測 diff 為 0 行差異，
只有新增的 118 行）。要讓它重新覆蓋全量，重跑 `buildCss` 覆寫即可——但注意工作區另有一份
`My Files/Colors/Faber Castell/faber_castell_colors.css`，**兩份早已不同步**，
故本 app 不主動改寫任一份：**單一真相是 `buildCss`，那兩份是各自時點的快照。**

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
- **也排除 Black Edition（2026-07-28 起）**：`nearestFC` 的參考池預設是 **`series:'ag'`**，
  即原本那 135 色，加入 118 個 Black Edition 色**完全不影響**它。理由與作法：
  - **理由**：Black Edition 是**另一條產品線**（SuperSoft、hobby 線），與 Polychromos／Albrecht Dürer
    不同筆種、不能互換。消費端 `color-palette`／`thangka-trace` 問的是「該拿哪支筆」，
    默默把答案換成一支使用者手邊沒有、且不同質地的筆，是**回歸**而非升級。
  - **作法**：色物件帶 `series` 欄位，`nearestFC` 接受 `opts.series`（`'ag'` 預設／`'black-edition'`／`'*'` 全收）。
    **無 `series` 欄位的色一律視為 `'ag'`**，所以自備參考清單與舊資料的行為不變。
  - **驗證**：以 4096 點的 RGB 立方體網格（每軸每 17 階）比對「加入前的 141 色資料 ＋ 舊 lib」
    與「259 色資料 ＋ 新 lib」在消費端實際用的呼叫形狀 `nearestFC(rgb,{n:3})` 下的結果，
    **0 筆差異**（含 ΔE 到小數 6 位）。拿掉 series 過濾則 4096 點中 3646 點改變——反向驗證過，不是空跑。
  - 要對 Black Edition 比色是**明示才給**：`nearestFC(rgb, { series: 'black-edition' })`。
- **純函式、以複製件共用**：`nearestFC` / `rgbToLab` / `deltaE` / `deltaEBand` 皆不碰 DOM。比照 `materialize-dark.css`
  慣例，把整支 `faber-castell-color-lib.js` ＋ `data/fc-colors.js` **複製**進 `color-palette` / `thangka-trace`
  （各自 CLAUDE.md 登記複製點）；**單一真相在此**，度量或資料改版後重新複製、重跑產生器即可。
  兩支各 **6 份複製**（本尊＋2 消費端，各含 InProgress 鏡像），改版後以 md5 確認為單一 hash。
