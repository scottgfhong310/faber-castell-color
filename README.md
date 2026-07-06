# faber-castell-color

> 版本 v1.0｜最後更新 2026-07-06

[繁體中文](README.zh-Hant.md) ｜ **English** ｜ [日本語](README.ja.md)

A single-page reference WebApp mapping **Faber-Castell colour codes → CSS**. Browse 141 colours as a swatch
grid, search by code or name, click any swatch to see its copy-ready values, lightfastness and set assortments,
and export the whole thing as a `.css` file of variables and utility classes.

Hex values are **sampled from the printed swatches** in `Farbtabelle-AG-ENG-0214.pdf` (pixel-sampled, then
cross-validated) — screen approximations, **not** official Faber-Castell RGB/HEX specs.

## Features

- **141-colour swatch grid** — real Faber-Castell colours; code text auto-picks black/white for contrast.
- **Search** — filter instantly by colour code or name.
- **Sort** — a side-tool cycles the swatch order between colour code / hue spectrum / lightness / colour-family groups (nine wheel families with sticky group headers; greys tail the order); persisted.
- **Copy in four formats** — `var(--fc-264)`, `#008b71`, `rgb(0, 139, 113)`, `.fc-bg-264`.
- **Detail view** — per-colour lightfastness (★ per product line) and set-assortment membership (pp. 1–3 + Goldfaber).
- **CSS export** — view / copy / download `faber_castell_colors.css` (141 `--fc-NNN` vars + `.fc-color-NNN` / `.fc-bg-NNN`).
- **Read-only** — no upload, no backend API; data is a static registry generated from the PDF.
- **light / dark theme** (default dark) and **three languages** (zh-Hant / en / ja). Swatches keep their true colour in both themes.

## Install & run

```bash
npm install
npm start          # → http://localhost:3000/apps/faber-castell-color/
```

Set `PORT` to run alongside other family apps: `PORT=3007 npm start`.

Needs the Node server (front-end uses absolute paths) — **not** GitHub Pages compatible.

## Structure

```
app.js                                  # Express: static + / → 302 + JSON 404 (no API, no upload)
public/apps/faber-castell-color/
├─ index.html · faber-castell-color.css · faber-castell-color.js · faber-castell-color-lib.js
├─ data/fc-colors.js                    # window.FC_COLORS — 141 colours (generated from the PDF)
├─ materialize-dark.css · side-tool.css · i18n.js · locales/{zh-Hant,en,ja}.js
```

## Core library (`FaberCastellCssLib`)

Pure logic, no DOM — embeddable anywhere:

| Method | Purpose |
|---|---|
| `filter(colors, query)` | filter by code or name (case-insensitive, does not mutate) |
| `sortColors(colors, mode)` | sort by `'code'` / `'hue'` / `'lightness'` (does not mutate) |
| `hexToRgb(hex)` | `'#008b71'` → `{r,g,b}` |
| `rgbToHsl(r,g,b)` | `'#008b71'` → `{h,s,l}` |
| `pickTextColor(color)` | `'#000000'` / `'#ffffff'` — higher-contrast text for a swatch (WCAG) |
| `copyValue(color, fmt)` | `fmt`: `'var'` / `'hex'` / `'rgb'` / `'class'` → copy string |
| `buildCss(colors)` | full CSS text (`:root` vars + utility classes) |

## Data shape (`window.FC_COLORS`)

```jsonc
// each colour
{
  "code": "264",                 // Faber-Castell colour code
  "name": "dark phthalo green",  // official colour name (never translated)
  "hex": "#008b71",              // pixel-sampled swatch (approximate)
  "r": 0, "g": 139, "b": 113,
  "cssVar": "--fc-264",
  "page": 3,                     // source page in the PDF
  "note": "pixel-sampled",       // provenance; "metallic – …" for approximate metallics
  "lf":  { "polychromos": "***", "adWatercolour": "**" },   // lightfastness per line (pp.1–3 only)
  "sets": { "Polychromos colour pencils": [24, 36, 60, 72] } // set sizes containing this colour
}
```

`lf` and `sets` exist only for colours documented on pp. 1–3 (+ Goldfaber p. 7); others omit them.

## Source & accuracy

Data derived from `Farbtabelle-AG-ENG-0214.pdf`. The 141 colours: **135** have pixel-sampled hex
(108 also cross-validated by an independent vector extraction), and **6 metallics**
(250/251/252/290/292/294) are gradient swatches with no single true hex — their value is a rough
approximation. See [DESIGN.md](DESIGN.md) for the extraction method and validation.

## License

[MIT](LICENSE) © 2026 [Scott G.F. Hong](https://github.com/scottgfhong310)
