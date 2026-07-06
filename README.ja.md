# faber-castell-color

> 版本 v1.0｜最後更新 2026-07-06

[繁體中文](README.zh-Hant.md) ｜ [English](README.md) ｜ **日本語**

**Faber-Castell のカラー番号を CSS に対応づける**シングルページ参照 WebApp。141 色を色見本グリッドで
閲覧し、番号や色名で検索、色見本をクリックするとコピー用の値・耐光性・セット収録が見られ、全体を
`.css`（変数 + ユーティリティクラス）としてエクスポートできます。

hex 値は `Farbtabelle-AG-ENG-0214.pdf` の**印刷色見本から採取**（ピクセル採取＋クロス検証）した画面用の
近似値で、Faber-Castell **公式**の RGB/HEX 仕様ではありません。

## 特長

- **141 色の色見本グリッド** — 実際の色を表示。番号の文字色はコントラストで自動的に黒／白を選択。
- **検索** — 番号または色名で即時フィルタ。
- **並び替え** — サイドツールで 番号 / 色相スペクトル / 明度 / 色系グループ（9 色系 + 追従見出し、グレー・黒白は末尾）/ hex 生値 を循環切替。選択は保持。
- **4 形式でコピー** — `var(--fc-264)`、`#008b71`、`rgb(0, 139, 113)`、`.fc-bg-264`。
- **詳細** — 色ごとの耐光性（製品ラインごとの ★）とセット収録（pp.1–3 + Goldfaber）。
- **CSS エクスポート** — `faber_castell_colors.css` を表示 / コピー / ダウンロード（141 個の `--fc-NNN` 変数 + `.fc-color-NNN` / `.fc-bg-NNN`）。
- **読み取り専用** — アップロードなし、バックエンド API なし。データは PDF から生成した静的レジストリ。
- **light / dark テーマ**（既定 dark）と**3 言語**（zh-Hant / en / ja）。どちらのテーマでも**色見本は本来の色を保持**。

## インストールと実行

```bash
npm install
npm start          # → http://localhost:3000/apps/faber-castell-color/
```

他の家族アプリと同時に動かすときは `PORT` でずらす：`PORT=3007 npm start`。

フロントは絶対パスを使うため本 Node サーバーが必要——GitHub Pages 非対応。

## 構成

```
app.js                                  # Express：static + / → 302 + JSON 404（API・アップロードなし）
public/apps/faber-castell-color/
├─ index.html · faber-castell-color.css · faber-castell-color.js · faber-castell-color-lib.js
├─ data/fc-colors.js                    # window.FC_COLORS — 141 色（PDF から生成）
├─ materialize-dark.css · side-tool.css · i18n.js · locales/{zh-Hant,en,ja}.js
```

## コアライブラリ（`FaberCastellCssLib`）

純粋ロジック、DOM に触れない。どこにでも埋め込み可能：

| メソッド | 用途 |
|---|---|
| `filter(colors, query)` | 番号または色名でフィルタ（大文字小文字を区別せず、入力を変更しない）|
| `sortColors(colors, mode)` | `'code'` / `'hue'` / `'lightness'` で並び替え（入力を変更しない）|
| `hexToRgb(hex)` | `'#008b71'` → `{r,g,b}` |
| `rgbToHsl(r,g,b)` | `'#008b71'` → `{h,s,l}` |
| `pickTextColor(color)` | `'#000000'` / `'#ffffff'` — 色見本上でコントラストの高い文字色（WCAG）|
| `copyValue(color, fmt)` | `fmt`：`'var'` / `'hex'` / `'rgb'` / `'class'` → コピー文字列 |
| `buildCss(colors)` | CSS 全体（`:root` 変数 + ユーティリティクラス）を生成 |

## データ形状（`window.FC_COLORS`）

```jsonc
// 各要素
{
  "code": "264",                 // Faber-Castell カラー番号
  "name": "dark phthalo green",  // 公式色名（翻訳しない）
  "hex": "#008b71",              // ピクセル採取した色見本（近似値）
  "r": 0, "g": 139, "b": 113,
  "cssVar": "--fc-264",
  "page": 3,                     // PDF の出典ページ
  "note": "pixel-sampled",       // 由来。メタリックは "metallic – …"
  "lf":  { "polychromos": "***", "adWatercolour": "**" },   // ラインごとの耐光性（pp.1–3 のみ）
  "sets": { "Polychromos colour pencils": [24, 36, 60, 72] } // この色を含むセットのサイズ
}
```

`lf` / `sets` は PDF pp.1–3（＋Goldfaber p.7）に記載のある色番号のみに存在し、他は省略されます。

## 出典と精度

データは `Farbtabelle-AG-ENG-0214.pdf` に由来。141 色のうち **135 色**にピクセル採取 hex があり
（うち 108 色は独立したベクター抽出でクロス検証済み）、**6 色のメタリック**
（250/251/252/290/292/294）はグラデーション色見本で単一の真値がなく、値は概算です。
抽出方法と検証は [DESIGN.md](DESIGN.md) を参照。

## License

[MIT](LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
