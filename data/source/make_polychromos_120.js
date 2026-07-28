/* make_polychromos_120.js — 產生 polychromos_120_web.csv
 *
 * 用法：
 *   node data/source/make_polychromos_120.js            # 線上抓產品頁
 *   node data/source/make_polychromos_120.js page.html  # 用本機存檔（離線）
 *
 * 為什麼不併進 set_assortments_p1-3_long.csv：
 *   色卡 Farbtabelle-AG-ENG-0214.pdf 頁 1–3 的套組表**只到 72 ct**，沒有 120 這一欄，
 *   但 Polychromos 的完整範圍就是 120 色。該尺寸的收錄清單來源是**產品頁**、不是那份 PDF，
 *   所以另開一支 CSV，別讓檔名綁 PDF 頁碼的那支混進非 PDF 來源（provenance）。
 *
 * 驗證（本檔自己跑，任一條不過就 throw）：
 *   - 產品頁必須恰好解析出 120 個色號
 *   - 這 120 個色號必須全部已存在於 FC_COLORS（此套組**不應**引入新色）
 *   - 既有 12/24/36/60/72 五個尺寸的成員必須全部包含在這 120 之內（兩份來源互相印證）
 *
 * 色名一律沿用 FC_COLORS 的 canonical 拼法，不採產品頁的
 * （兩者有 8 處排版差異，如 `burnt siena` vs `Burnt Sienna`；色名是資料，以色卡為準）。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const URL = 'https://fabercastell.com/products/polychromos-artists-color-pencils-wood-case-of-120-110013';
const DIR = __dirname;
const REPO = path.join(DIR, '..', '..');
const LINE = 'Polychromos colour pencils';
const SIZE = 120;

function parseContents(html) {
  const i = html.indexOf('Contents Include');
  if (i === -1) throw new Error('找不到 "Contents Include" 區塊——產品頁版型可能已改');
  const slab = html.slice(i, i + 9000).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  // 結尾三種收法：「, 」／「 and #NNN …」／「 in a <包裝> 」。
  // 必須用 lookahead——用消耗式的 (?:,|\s+and\s+#) 會把下一筆的 '#' 吃掉，導致最後一色漏掉。
  const re = /#(\d{3})\s+(.+?)(?=,|\s+and\s+#|\s+in\s+a\s)/g;
  const out = [];
  let m;
  while ((m = re.exec(slab))) out.push([m[1], m[2].trim()]);
  return out;
}

async function loadHtml() {
  const local = process.argv[2];
  if (local) return fs.readFileSync(local, 'utf8');
  const res = await fetch(URL, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error('抓取產品頁失敗：HTTP ' + res.status);
  return res.text();
}

(async function main() {
  const items = parseContents(await loadHtml());
  if (items.length !== SIZE) throw new Error('預期 ' + SIZE + ' 色，實得 ' + items.length);

  global.window = {};
  require(path.join(REPO, 'public/apps/faber-castell-color/data/fc-colors.js'));
  const canon = new Map(window.FC_COLORS.map(c => [c.code, c.name]));

  const unknown = items.filter(([c]) => !canon.has(c));
  if (unknown.length) throw new Error('這些色號不在 FC_COLORS：' + JSON.stringify(unknown));

  const out = ['colour_code,colour_name,product_line,set_size_ct,included'];
  items.forEach(([code]) => out.push([code, canon.get(code), LINE, SIZE, 1].join(',')));
  const dst = path.join(DIR, 'polychromos_120_web.csv');
  fs.writeFileSync(dst, out.join('\n') + '\n');
  console.log('wrote', items.length, 'rows ->', path.relative(REPO, dst));

  // 巢狀一致：既有每個尺寸都必須是這 120 的子集
  const have = new Set(items.map(x => x[0]));
  [12, 24, 36, 60, 72].forEach(size => {
    const inSize = window.FC_COLORS
      .filter(c => c.sets && c.sets[LINE] && c.sets[LINE].includes(size))
      .map(c => c.code);
    const missing = inSize.filter(c => !have.has(c));
    if (missing.length) throw new Error(size + ' ct 有色號不在 120 之內：' + missing.join(' '));
    console.log('  %d ct: %d colours, all contained in the %d', size, inSize.length, SIZE);
  });
})();
