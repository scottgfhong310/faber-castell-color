/**
 * generate.js — 由 data/source/*.csv 合併產生 ../fc-colors.js（window.FC_COLORS）
 *
 * 用法（Node，零依賴）：
 *   node data/source/generate.js
 *
 * 來源 CSV 分兩個系列（series），各有自己的權威文件：
 *
 *   series 'ag'（Art & Graphic，抽取自 Farbtabelle-AG-ENG-0214.pdf）
 *     faber_castell_color_codes.csv        權威 hex（141）
 *     colours_lightfastness_p1-3.csv       耐光度（120）
 *     set_assortments_p1-3_long.csv        套組（pp.1-3）
 *     goldfaber_p7_long.csv                套組（Goldfaber p.7）
 *     polychromos_120_web.csv              套組（Polychromos 120 ct；來源為產品頁，見該檔註記）
 *     faber_castell_color_code_css_foreground_zh_ja.csv  色名 zh/ja 在地化（選用）
 *
 *   series 'black-edition'（抽取自 Colour-assortment-Black-Edition.pdf）
 *     black_edition_colour_codes.csv       hex（118；701-806 向量填色、807-818 金屬近似）
 *     black_edition_sets_long.csv          套組（4 條線）
 *   兩支由 extract_black_edition.py 產生。
 *
 * 輸出：../fc-colors.js（window.FC_COLORS，英文名為 canonical、不翻譯）
 *      ＋ ../fc-names-i18n.js（window.FC_NAMES_I18N＝code→{zh,ja}，選用對照，供消費端 app 顯示）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

// CSV 解析：支援雙引號包住的欄位（note 內含逗號，如金屬色的 "…(gradient swatch, no single true hex)"）
function parseLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
function readCsv(name) {
  const txt = fs.readFileSync(path.join(DIR, name), 'utf8').replace(/\r/g, '').replace(/^﻿/, '');
  return txt.split('\n').filter(Boolean).map(parseLine);
}

const base = {}, order = [];

// ── series 'ag'：Art & Graphic 色卡 ────────────────────────────────────────────
readCsv('faber_castell_color_codes.csv').slice(1).forEach(r => {
  const [code, name, hex, R, G, B, cssVar, page, note] = r;
  base[code] = { code, name, hex, r: +R, g: +G, b: +B, cssVar, series: 'ag', page: +page, note };
  order.push(code);
});
const AG_TOTAL = order.length;

const LF = [['Polychromos colour pencils', 'polychromos'],
            ['Polychromos Pastels', 'polychromosPastel'],
            ['Albrecht Durer watercolour pencils', 'adWatercolour'],
            ['Albrecht Durer Magnus', 'adMagnus'],
            ['Pitt Pastel pencils', 'pittPastel']];
readCsv('colours_lightfastness_p1-3.csv').slice(1).forEach(r => {
  const c = base[r[0]]; if (!c) return;
  const lf = {};
  LF.forEach((p, i) => { const v = (r[2 + i] || '').trim(); if (v) lf[p[1]] = v; });
  if (Object.keys(lf).length) c.lf = lf;
});

// ── series 'black-edition'：Black Edition 色卡 ────────────────────────────────
readCsv('black_edition_colour_codes.csv').slice(1).forEach(r => {
  const [code, name, hex, R, G, B, cssVar, series, note] = r;
  base[code] = { code, name, hex, r: +R, g: +G, b: +B, cssVar, series, note };
  order.push(code);
});
const BE_TOTAL = order.length - AG_TOTAL;

// ── 套組（兩個系列共用同一組 long 格式 CSV） ─────────────────────────────────
const sets = {};
['set_assortments_p1-3_long.csv', 'goldfaber_p7_long.csv',
 'polychromos_120_web.csv', 'black_edition_sets_long.csv'].forEach(fn => {
  readCsv(fn).slice(1).forEach(r => {
    const [code, , line, size] = r; if (!base[code]) return;
    (sets[code] = sets[code] || {})[line] = (sets[code][line] || new Set()).add(+size);
  });
});
Object.keys(sets).forEach(code => {
  const o = {}; Object.keys(sets[code]).forEach(l => o[l] = [...sets[code][l]].sort((a, b) => a - b));
  base[code].sets = o;
});

const colors = order.map(c => base[c]);
const meta = {
  lfLines: LF.map(([label, key]) => ({ key, label })),
  series: [
    { key: 'ag', label: 'Art & Graphic', source: 'Farbtabelle-AG-ENG-0214.pdf', total: AG_TOTAL },
    { key: 'black-edition', label: 'Black Edition', source: 'Colour-assortment-Black-Edition.pdf', total: BE_TOTAL }
  ],
  source: 'Farbtabelle-AG-ENG-0214.pdf',   // 保留：'ag' 系列的來源（既有欄位）
  total: colors.length,
  withHex: colors.filter(c => c.hex).length
};

let out = '/* Faber-Castell colour data — generated from data/source/*.csv (do not hand-edit).\n' +
  ' * Two series, each with its own authoritative chart:\n' +
  ' *   ag            Art & Graphic — Farbtabelle-AG-ENG-0214.pdf; hex = pixel-sampled swatch.\n' +
  ' *   black-edition Black Edition — Colour-assortment-Black-Edition.pdf; hex = vector fill\n' +
  ' *                 (701-806, exact) or pixel-sampled gradient (807-818 metallic, approximate).\n' +
  ' * Hex is a screen approximation, not an official RGB specification.\n' +
  ' * Fields: code, name, hex, r/g/b, cssVar, series, page(ag), note, lf{line:rating}, sets{line:[sizes]}.\n' +
  ' * lf exists only for ag colours on pp.1-3; Black Edition publishes no lightfastness ratings.\n */\n';
out += 'window.FC_META = ' + JSON.stringify(meta) + ';\n';
out += 'window.FC_COLORS = [\n' + colors.map(c => '  ' + JSON.stringify(c)).join(',\n') + '\n];\n';

const OUT = path.join(DIR, '..', '..', 'public', 'apps', 'faber-castell-color', 'data', 'fc-colors.js');
fs.writeFileSync(OUT, out);
console.log('wrote', colors.length, 'colours ->', path.relative(path.join(DIR, '..', '..'), OUT),
  '| ag:', AG_TOTAL, '| black-edition:', BE_TOTAL,
  '| lf:', colors.filter(c => c.lf).length, '| sets:', colors.filter(c => c.sets).length);

// 色名在地化（選用對照）：不動 FC_COLORS 的英文名（色名是資料、不翻譯），另出 code→{zh,ja}
const i18nNames = {};
try {
  readCsv('faber_castell_color_code_css_foreground_zh_ja.csv').slice(1).forEach(r => {
    const code = (r[0] || '').trim(), zh = (r[2] || '').trim(), ja = (r[3] || '').trim();
    if (code && (zh || ja)) { const o = {}; if (zh) o.zh = zh; if (ja) o.ja = ja; i18nNames[code] = o; }
  });
} catch (e) { /* 對照 CSV 選用，缺檔則略過 */ }
if (Object.keys(i18nNames).length) {
  const i18nOut = '/* Faber-Castell colour names, localised (zh-Hant / ja) — generated (do not hand-edit).\n' +
    ' * Source: faber_castell_color_code_css_foreground_zh_ja.csv (colour_name_zh_tw / colour_name_ja).\n' +
    ' * Optional companion to fc-colors.js; English name stays canonical in FC_COLORS. code -> {zh,ja}.\n' +
    ' * Covers the ag series only — Black Edition has no localised name source.\n */\n' +
    'window.FC_NAMES_I18N = ' + JSON.stringify(i18nNames) + ';\n';
  const OUT2 = path.join(DIR, '..', '..', 'public', 'apps', 'faber-castell-color', 'data', 'fc-names-i18n.js');
  fs.writeFileSync(OUT2, i18nOut);
  console.log('wrote', Object.keys(i18nNames).length, 'localised names ->', path.relative(path.join(DIR, '..', '..'), OUT2));
}
