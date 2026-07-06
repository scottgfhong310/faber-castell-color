# faber-castell-color

> 版本 v1.0｜最後更新 2026-07-06

**繁體中文** ｜ [English](README.md) ｜ [日本語](README.ja.md)

把 **Faber-Castell 色號對應到 CSS** 的單頁參考 WebApp。141 色以色票網格瀏覽、可依色號或色名搜尋、
點任一色票看可複製的值與耐光度、套組收錄，並可把整份對照匯出成一份 `.css`（變數 + utility classes）。

hex 是從 `Farbtabelle-AG-ENG-0214.pdf` 內**印刷色票取樣**（像素取樣＋交叉驗證）而來，屬螢幕近似值，
**非** Faber-Castell 官方 RGB/HEX 規格。

## 功能

- **141 色色票網格** — 呈現真實色；色號文字依對比自動選黑或白。
- **搜尋** — 依色號或色名即時過濾。
- **排序** — 側鍵在 色號 / 色相光譜 / 明度 間循環切換（黑白灰與近白金屬色殿後）；記憶選擇。
- **四種格式複製** — `var(--fc-264)`、`#008b71`、`rgb(0, 139, 113)`、`.fc-bg-264`。
- **明細** — 每色的耐光度（各產品線 ★）與套組收錄（頁 1–3 + Goldfaber）。
- **CSS 匯出** — 檢視 / 複製 / 下載 `faber_castell_colors.css`（141 個 `--fc-NNN` 變數 + `.fc-color-NNN` / `.fc-bg-NNN`）。
- **唯讀** — 無上傳、無後端 API；資料是由 PDF 產生的靜態 registry。
- **light / dark 主題**（預設 dark）與**三語**（zh-Hant / en / ja）。兩種主題下**色票都保留真實顏色**。

## 安裝與執行

```bash
npm install
npm start          # → http://localhost:3000/apps/faber-castell-color/
```

要與其他家族 app 併跑時以 `PORT` 錯開：`PORT=3007 npm start`。

前端走絕對路徑，需由本 Node 伺服器提供——**不相容** GitHub Pages。

## 結構

```
app.js                                  # Express：static + / → 302 + JSON 404（無 API、無上傳）
public/apps/faber-castell-color/
├─ index.html · faber-castell-color.css · faber-castell-color.js · faber-castell-color-lib.js
├─ data/fc-colors.js                    # window.FC_COLORS — 141 色（由 PDF 產生）
├─ materialize-dark.css · side-tool.css · i18n.js · locales/{zh-Hant,en,ja}.js
```

## 核心 library（`FaberCastellCssLib`）

純邏輯、不碰 DOM，可嵌入任何地方：

| 方法 | 用途 |
|---|---|
| `filter(colors, query)` | 依色號或色名過濾（不分大小寫、不改輸入）|
| `sortColors(colors, mode)` | 依 `'code'` / `'hue'` / `'lightness'` 排序（不改輸入）|
| `hexToRgb(hex)` | `'#008b71'` → `{r,g,b}` |
| `rgbToHsl(r,g,b)` | `'#008b71'` → `{h,s,l}` |
| `pickTextColor(color)` | `'#000000'` / `'#ffffff'` — 色塊上對比較高的文字色（WCAG）|
| `copyValue(color, fmt)` | `fmt`：`'var'` / `'hex'` / `'rgb'` / `'class'` → 複製字串 |
| `buildCss(colors)` | 產生整份 CSS（`:root` 變數 + utility classes）|

## 資料形狀（`window.FC_COLORS`）

```jsonc
// 每筆
{
  "code": "264",                 // Faber-Castell 色號
  "name": "dark phthalo green",  // 官方色名（永不翻譯）
  "hex": "#008b71",              // 像素取樣的色票（近似值）
  "r": 0, "g": 139, "b": 113,
  "cssVar": "--fc-264",
  "page": 3,                     // PDF 來源頁
  "note": "pixel-sampled",       // 來源註記；金屬色為 "metallic – …"
  "lf":  { "polychromos": "***", "adWatercolour": "**" },   // 各產品線耐光度（僅 pp.1–3）
  "sets": { "Polychromos colour pencils": [24, 36, 60, 72] } // 含此色的套組尺寸
}
```

`lf` / `sets` 只有 PDF 頁 1–3（＋Goldfaber 頁 7）記載的色號才有，其餘省略。

## 來源與準確度

資料來自 `Farbtabelle-AG-ENG-0214.pdf`。141 色中 **135 個**有像素取樣 hex（其中 108 個另經獨立向量抽取
交叉驗證），**6 個金屬色**（250/251/252/290/292/294）為漸層色票、無單一真值，其值為粗略近似。
抽取方法與驗證見 [DESIGN.md](DESIGN.md)。

## License

[MIT](LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
