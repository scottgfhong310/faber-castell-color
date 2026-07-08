/**
 * generate.js — 由 data/source/*.csv 合併產生 ../fc-colors.js（window.FC_COLORS）
 *
 * 用法（Node，零依賴）：
 *   node data/source/generate.js
 *
 * 來源 CSV（皆抽取自 Farbtabelle-AG-ENG-0214.pdf）：
 *   faber_castell_color_codes.csv        權威 hex（141）
 *   colours_lightfastness_p1-3.csv       耐光度（120）
 *   set_assortments_p1-3_long.csv        套組（pp.1-3）
 *   goldfaber_p7_long.csv                套組（Goldfaber p.7）
 *   faber_castell_color_code_css_foreground_zh_ja.csv  色名 zh/ja 在地化（選用）
 *
 * 輸出：../fc-colors.js（window.FC_COLORS，英文名為 canonical、不翻譯）
 *      ＋ ../fc-names-i18n.js（window.FC_NAMES_I18N＝code→{zh,ja}，選用對照，供消費端 app 顯示）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

// 極簡 CSV 解析（欄位無內嵌逗號/引號，符合本資料）
function readCsv(name) {
  const txt = fs.readFileSync(path.join(DIR, name), 'utf8').replace(/\r/g, '');
  return txt.split('\n').filter(Boolean).map(l => l.split(','));
}

const base = {}, order = [];
readCsv('faber_castell_color_codes.csv').slice(1).forEach(r => {
  const [code, name, hex, R, G, B, cssVar, page, note] = r;
  base[code] = { code, name, hex, r: +R, g: +G, b: +B, cssVar, page: +page, note };
  order.push(code);
});

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

const sets = {};
['set_assortments_p1-3_long.csv', 'goldfaber_p7_long.csv'].forEach(fn => {
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
  source: 'Farbtabelle-AG-ENG-0214.pdf',
  total: colors.length,
  withHex: colors.filter(c => c.hex).length
};

let out = '/* Faber-Castell colour data — generated from data/source/*.csv (do not hand-edit).\n' +
  ' * Source: Farbtabelle-AG-ENG-0214.pdf. Hex = pixel-sampled swatch, approximate (not official).\n' +
  ' * Fields: code, name, hex, r/g/b, cssVar, page, note, lf{line:rating}, sets{line:[sizes]}.\n' +
  ' * lf/sets only exist for colours present on pp.1-3 (+ Goldfaber p7); others omit them.\n */\n';
out += 'window.FC_META = ' + JSON.stringify(meta) + ';\n';
out += 'window.FC_COLORS = [\n' + colors.map(c => '  ' + JSON.stringify(c)).join(',\n') + '\n];\n';

const OUT = path.join(DIR, '..', '..', 'public', 'apps', 'faber-castell-color', 'data', 'fc-colors.js');
fs.writeFileSync(OUT, out);
console.log('wrote', colors.length, 'colours ->', path.relative(path.join(DIR, '..', '..'), OUT),
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
    ' * Optional companion to fc-colors.js; English name stays canonical in FC_COLORS. code -> {zh,ja}.\n */\n' +
    'window.FC_NAMES_I18N = ' + JSON.stringify(i18nNames) + ';\n';
  const OUT2 = path.join(DIR, '..', '..', 'public', 'apps', 'faber-castell-color', 'data', 'fc-names-i18n.js');
  fs.writeFileSync(OUT2, i18nOut);
  console.log('wrote', Object.keys(i18nNames).length, 'localised names ->', path.relative(path.join(DIR, '..', '..'), OUT2));
}
