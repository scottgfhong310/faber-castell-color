"""Extract Black Edition colours + assortments from the official Faber-Castell chart PDF.

Usage (needs python3 + PyMuPDF):
    python3 data/source/extract_black_edition.py [path/to/chart.pdf]

Source : Colour-assortment-Black-Edition.pdf — the "Colour assortment: Black Edition"
         chart published by Faber-Castell USA
         (https://fabercastellusa.reamaze.com/kb/color-charts-and-lightfast-ratings/
          black-edition-colored-pencil-color-chart; the asset is served from their
          Salsify PIM under an image path but is actually a one-page A4 PDF).
         Not in this repo — kept beside Farbtabelle-AG-ENG-0214.pdf in the workspace.
Output : black_edition_colour_codes.csv  (118 colours, 701-818)
         black_edition_sets_long.csv     (assortment matrix, long format)

Two traps this file exists to encode:
  1. Swatches 701-806 are vector fills -> exact RGB straight from the PDF, but code 801
     has an #e3e3e3 PLACEHOLDER painted underneath the real swatch, so the fill must be
     taken in paint order (topmost wins), not "the first one found".
     Swatches 807-818 are gradient rasters (metallic) -> pixel-sampled mean, approximate.
  2. The three tables sit side by side at identical row heights, so every row lookup must
     match on x as well as y (701 / 751 / 801 share a y).

Self-checks (all 118 swatches are re-sampled from the rendered page and compared with
what we recorded). Reverse-validated: taking the bottom fill for 801 makes it FAIL.
"""
import csv
import os
import sys
import fitz

DEFAULT_PDF = [
    os.path.join(os.path.dirname(__file__), 'Colour-assortment-Black-Edition.pdf'),
    '/Users/Shared/nodeapp/Faber-Castell/Colour-assortment-Black-Edition.pdf',
    '/Users/Shared/nodeapp/My Files/Colors/Faber Castell/Colour-assortment-Black-Edition.pdf',
]


def find_pdf():
    if len(sys.argv) > 1:
        return sys.argv[1]
    for p in DEFAULT_PDF:
        if os.path.exists(p):
            return p
    raise SystemExit('找不到色卡 PDF，請把路徑當參數傳入。已試過：\n  ' + '\n  '.join(DEFAULT_PDF))


PDF = find_pdf()
OUT_DIR = os.path.dirname(os.path.abspath(__file__))
DPI = 300
GAP_MAX = 5.0          # pt between a swatch's right edge and its colour code
INSET = 2.0            # pt inset when pixel-sampling, to clear the cell border

# assortment -> the SKUs that ship it (packaging variants share an assortment)
LINES = {
    'Black Edition colour pencils':  ['116412', '116413', '116424', '116425',
                                      '116436', '116437', '116450', '116411', '116490'],
    'Black Edition skin tones':      ['116414'],
    'Black Edition neon + pastel':   ['116410'],
    'Black Edition metallic':        ['116415'],
}
SKU_LINE = {s: line for line, sk in LINES.items() for s in sk}

doc = fitz.open(PDF)
page = doc[0]
words = page.get_text('words')


def mid(r):
    return ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)


# ---------- rows: colour code + name -------------------------------------------------
codes = {}
for w in words:
    t = w[4].strip()
    if t.isdigit() and len(t) == 3 and 701 <= int(t) <= 818:
        codes[t] = fitz.Rect(w[:4])

names = {}
for c, cr in codes.items():
    row = [w for w in words
           if abs(mid(fitz.Rect(w[:4]))[1] - mid(cr)[1]) < 4
           and w[0] > cr.x1 and w[0] < cr.x1 + 90
           and w[4].strip() != '•'
           and not (w[4].strip().isdigit() and len(w[4].strip()) == 6)]
    names[c] = ' '.join(w[4] for w in sorted(row, key=lambda w: w[0])).strip()

assert len(codes) == 118, len(codes)

# ---------- swatches ------------------------------------------------------------------
vec = []
for i, dr in enumerate(page.get_drawings()):     # i = paint order; last one is on top
    r = dr['rect']
    if dr.get('fill') and 15 < r.width < 20 and 10 < r.height < 15:
        vec.append((i, r, dr['fill']))

pix = page.get_pixmap(dpi=DPI)
scale = DPI / 72.0
SWATCH_COLS = sorted({round(r.x0, 1) for _, r, _ in vec})   # 3 tables


def sample(rect):
    """mean RGB over a rect's interior on the rendered page"""
    x0 = int((rect.x0 + INSET) * scale); x1 = int((rect.x1 - INSET) * scale)
    y0 = int((rect.y0 + INSET) * scale); y1 = int((rect.y1 - INSET) * scale)
    tot = [0, 0, 0]; n = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = pix.pixel(x, y)
            tot[0] += p[0]; tot[1] += p[1]; tot[2] += p[2]; n += 1
    return tuple(round(v / n) for v in tot)


rows = []
crosscheck = []
for c in sorted(codes, key=int):
    cr = codes[c]
    cy = mid(cr)[1]
    hit = [(i, r, f) for i, r, f in vec
           if r.y0 - 2 <= cy <= r.y1 + 2 and 0 <= cr.x0 - r.x1 <= GAP_MAX]
    if hit:
        # a placeholder may sit under the real swatch (code 801) -> topmost wins
        i, rect, fill = max(hit, key=lambda t: t[0])
        rgb = tuple(round(v * 255) for v in fill)
        note = 'official vector fill (colour chart PDF)'
    else:
        # metallic: gradient raster in the third table -> sample it
        col = min(SWATCH_COLS, key=lambda x: abs(x - (cr.x0 - 18.7)))
        rect = fitz.Rect(col, cr.y0 - 1.5, col + 17.0, cr.y0 + 11.3)
        rgb = sample(rect)
        note = 'metallic – approximate (gradient swatch, no single true hex)'
    # reverse check: sample what is actually painted and compare with what we recorded
    crosscheck.append((c, rgb, sample(rect), bool(hit)))
    rows.append({
        'color_code': c,
        'colour_name': names[c],
        'hex': '#%02x%02x%02x' % rgb,
        'R': rgb[0], 'G': rgb[1], 'B': rgb[2],
        'css_variable': '--fc-' + c,
        'series': 'black-edition',
        'note': note,
    })

with open(os.path.join(OUT_DIR, 'black_edition_colour_codes.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader(); w.writerows(rows)
print('wrote black_edition_colour_codes.csv:', len(rows), 'colours |',
      sum(1 for r in rows if 'vector' in r['note']), 'vector,',
      sum(1 for r in rows if 'metallic' in r['note']), 'metallic')

# ---------- reverse validation: vector value vs. what is actually painted -------------
worst = 0
bad = []
for c, rec, samp, isvec in crosscheck:
    d = max(abs(a - b) for a, b in zip(rec, samp))
    worst = max(worst, d) if isvec else worst
    if isvec and d > 3:
        bad.append((c, '#%02x%02x%02x' % rec, '#%02x%02x%02x' % samp, d))
print('cross-check (vector vs pixel): worst per-channel delta = %d/255 over %d swatches'
      % (worst, sum(1 for x in crosscheck if x[3])))
if bad:
    print('  MISMATCH:', bad)
else:
    print('  all vector swatches agree with the rendered page')

# ---------- assortment matrix ---------------------------------------------------------
hdr = []
for w in words:
    t = w[4].strip()
    if t.isdigit() and len(t) == 6 and t.startswith('1164'):
        hdr.append((t, mid(fitz.Rect(w[:4]))[0]))

bullets = [mid(fitz.Rect(w[:4])) for w in words if w[4].strip() == '•']
xs = sorted(b[0] for b in bullets)
cols, cur = [], [xs[0]]
for x in xs[1:]:
    if x - cur[-1] < 5:
        cur.append(x)
    else:
        cols.append(sum(cur) / len(cur)); cur = [x]
cols.append(sum(cur) / len(cur))
col_sku = {c: sorted(t for t, hx in hdr if abs(hx - c) < 6) for c in cols}

pairs = set()          # (line, code)
sku_codes = {}
for bx, by in bullets:
    col = min(cols, key=lambda c: abs(c - bx))
    assert abs(col - bx) <= 5
    row = [(c, mid(cr)[0]) for c, cr in codes.items()
           if abs(mid(cr)[1] - by) < 4 and mid(cr)[0] < bx]
    code = max(row, key=lambda t: t[1])[0]
    for sku in col_sku[col]:
        sku_codes.setdefault(sku, set()).add(code)

set_rows = []
for sku, cs in sorted(sku_codes.items()):
    line = SKU_LINE[sku]
    size = len(cs)
    for code in sorted(cs, key=int):
        key = (line, size, code)
        if key in pairs:
            continue
        pairs.add(key)
        set_rows.append({'colour_code': code, 'colour_name': names[code],
                         'product_line': line, 'set_size_ct': size, 'included': 1})

set_rows.sort(key=lambda r: (r['product_line'], r['set_size_ct'], int(r['colour_code'])))
with open(os.path.join(OUT_DIR, 'black_edition_sets_long.csv'), 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(set_rows[0]))
    w.writeheader(); w.writerows(set_rows)

print('wrote black_edition_sets_long.csv:', len(set_rows), 'rows')
seen = {}
for r in set_rows:
    seen.setdefault((r['product_line'], r['set_size_ct']), 0)
    seen[(r['product_line'], r['set_size_ct'])] += 1
for k in sorted(seen):
    print('   %-32s %3d ct -> %d colours' % (k[0], k[1], seen[k]))
