/* export-css.js — 把 buildCss(FC_COLORS) 的輸出寫進工作區的 faber_castell_colors.css
 *
 * `buildCss` 是那份 .css 的單一真相（DESIGN.md §4）：改資料 → 重跑 generate.js →
 * 再跑這支，落地檔就跟著更新，兩處不會分歧。
 *
 * 目標檔在**工作區**、不在本 repo（repo 是公開的，那些是本機素材），
 * 所以路徑寫死在下面；不存在的就略過，不當成錯誤。
 *
 * 用法：node scripts/export-css.js [--check]
 *   --check 只比對不寫入，不一致回非 0（可放進驗收）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', 'public', 'apps', 'faber-castell-color');
const TARGETS = [
  '/Users/Shared/nodeapp/Faber-Castell/faber_castell_colors.css',
  '/Users/Shared/nodeapp/My Files/Colors/Faber Castell/faber_castell_colors.css'
];

const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(APP, 'data', 'fc-colors.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(APP, 'faber-castell-color-lib.js'), 'utf8'), sandbox);

const css = sandbox.window.FaberCastellCssLib.buildCss(sandbox.window.FC_COLORS);
const vars = (css.match(/^ {2}--fc-/gm) || []).length;
const check = process.argv.includes('--check');
let bad = 0;

TARGETS.forEach(t => {
  if (!fs.existsSync(path.dirname(t))) { console.log('skip (資料夾不存在)', t); return; }
  const same = fs.existsSync(t) && fs.readFileSync(t, 'utf8') === css;
  if (check) {
    console.log((same ? 'OK   ' : 'STALE') + '  ' + t);
    if (!same) bad++;
  } else {
    if (same) { console.log('unchanged', t); return; }
    fs.writeFileSync(t, css);
    console.log('wrote    ', t);
  }
});

console.log(`${check ? 'checked' : 'exported'} ${vars} vars / ${css.split('\n').length} lines`);
if (bad) process.exit(1);
