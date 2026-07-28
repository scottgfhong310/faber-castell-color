/* verify-links.js — 靜態契約檢查：markup 的入口與控制器的 handler 必須對得上。
 *
 * 為什麼要有這支：PLAYBOOK §5「使用者路徑」記的三種 bug（死屬性、不命中的委派、
 * 靜態 markup 的連結沒人接）自動化檢查都看不到，因為它們各自單獨看都是對的。
 * 這支把「markup ↔ handler」寫成契約，比每次改版重點一輪可靠。
 *
 * 用法：node public/apps/faber-castell-color/verify-links.js
 * 反向驗證過：拿掉 index 的 ?code= 解析、或把側鍵 href 改成 '#!'，本檔都會 FAIL。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');

const PAGES = [
  { html: 'index.html', js: 'faber-castell-color.js' },
  { html: 'sets.html', js: 'sets.js' }
];

// 頁面之間用查詢參數溝通：送出的一方 → 解析的一方
const QUERY_CONTRACTS = [
  { param: 'code', from: 'sets.js', to: 'faber-castell-color.js' },
  { param: 'set', from: 'faber-castell-color.js', to: 'sets.js' }
];

const fails = [];

// 1) 每個側鍵：要嘛有真的 href，要嘛控制器裡有對應的 handler
PAGES.forEach(p => {
  const html = read(p.html), js = read(p.js);
  const re = /<(a|div)\s+id="(setting-[a-z-]+)"([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const id = m[2], attrs = m[3];
    const href = (/href="([^"]*)"/.exec(attrs) || [])[1];
    const realHref = href && href !== '#' && href !== '#!';
    const wired = js.includes(`'#${id}'`);
    if (!realHref && !wired) fails.push(`${p.html}: #${id} 既無有效 href 也無 handler（死鍵）`);
    if (realHref && !fs.existsSync(path.join(DIR, href.replace(/^\.\//, '').split('?')[0] || 'index.html'))) {
      fails.push(`${p.html}: #${id} 的 href 指向不存在的 ${href}`);
    }
  }
});

// 2) 查詢參數契約：一端送出，另一端必須真的解析（比對解析用的正則字面）
QUERY_CONTRACTS.forEach(c => {
  const from = read(c.from), to = read(c.to);
  const emits = new RegExp(`[?&]${c.param}=`).test(from) || from.includes(`?${c.param}=`);
  const parses = to.includes(`[?&]${c.param}=`);
  if (emits && !parses) {
    fails.push(`${c.from} 送出 ?${c.param}= 但 ${c.to} 沒有解析它（死參數）`);
  }
});

// 3) 控制器產生的 data-* 必須有人讀——JS 讀或 CSS 選它都算
//    （只給 CSS 用的狀態旗標是正當用法，例如 #matrix[data-series="ag"]）
const CSS = fs.readdirSync(DIR).filter(f => f.endsWith('.css'))
  .map(f => read(f)).join('\n');
PAGES.forEach(p => {
  const js = read(p.js);
  const emitted = new Set([
    ...[...js.matchAll(/data-([a-z]+)="/g)].map(m => m[1]),
    ...[...js.matchAll(/attr\('data-([a-z]+)'/g)].map(m => m[1])
  ]);
  emitted.forEach(a => {
    const readInJs = js.includes(`data('${a}')`) || js.includes(`dataset.${a}`) || js.includes(`attr('data-${a}')`);
    const readInCss = CSS.includes(`[data-${a}`);
    if (!readInJs && !readInCss) {
      fails.push(`${p.js}: 產生了 data-${a} 但 JS 與 CSS 都沒有用它（死屬性）`);
    }
  });
});

if (fails.length) {
  console.error('契約檢查 FAIL:');
  fails.forEach(f => console.error('  ✗ ' + f));
  process.exit(1);
}
console.log('契約檢查通過：側鍵入口、跨頁查詢參數、data-* 都有人接');
