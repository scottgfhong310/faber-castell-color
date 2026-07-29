#!/usr/bin/env python3
"""make-icons — 由兩張母版 SVG 產出整套 icon（PNG / .ico / manifest）。

icon 的概念：**一張色卡（Farbtabelle）** —— 那正是本 app 的來源文件形制，
也與 caran-dache-color（色卡扇）、copic-color（三軸矩陣）、color-palette（金環放大鏡）區隔。
色帶分兩群（4 ＋ 1），對應本 app 特有的**兩個系列**（ag 141 ／ black-edition 118，色號範圍不重疊）。
**五條色帶全是真實 FC 色**，不自己配色。

⚠️ PyMuPDF 的兩個限制（copic-color 那支也踩過，見其 DESIGN.md §8.1）：
  ① **不渲染 linearGradient**，會整片退成黑色 → 母版一律純色底。
  ② **以 SVG 宣告的 width/height 為渲染基準、不是 viewBox** → 倍率要用
     「目標 ÷ 實際 page 寬」反推，寫死 size/100 會得到完全錯誤的尺寸。

用法：python3 scripts/make-icons.py
"""
import json
import os
import fitz
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..',
                   'public', 'apps', 'faber-castell-color', 'icons')

# 上 4 條＝ag（Art & Graphic），下 1 條＝black-edition；皆為真實 FC 色。
AG = ['#f7a71f',   # 109 dark chrome yellow
      '#e2413b',   # 118 scarlet red
      '#4eaf4d',   # 112 leaf green
      '#0078be']   # 110 phthalo blue
BE = '#768bc0'     # 800 Neon Purple（Black Edition 的招牌霓虹色，且與上列四色都不撞）

DARK_TILE, DARK_EDGE = '#151a24', '#10131a'
LIGHT_TILE, LIGHT_EDGE = '#f6f8fa', '#ffffff'


def bands(x, w, ys, h, rx, be_y, stroke, sw):
    r = ''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{c}"/>'
                for y, c in zip(ys, AG))
    r += f'<rect x="{x}" y="{be_y}" width="{w}" height="{h}" rx="{rx}" fill="{BE}"/>'
    return f'<g stroke="{stroke}" stroke-width="{sw}">{r}</g>'


def tile(size, inner, bg, hairline=False):
    hl = ('<rect x="0.6" y="0.6" width="98.8" height="98.8" rx="22" fill="none" '
          'stroke="#d4dae2" stroke-width="1.2"/>') if hairline else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" '
            f'width="{size}" height="{size}">'
            f'<rect width="100" height="100" rx="22.5" fill="{bg}"/>{hl}{inner}</svg>')


def build_svgs():
    # 母版：5 條色帶，4＋1 分群（群間距 7 > 帶間距 4，一眼看得出是兩群）
    m_d = bands(18, 64, [16, 30, 44, 58], 10, 3, 75, DARK_EDGE, 1.4)
    m_l = bands(18, 64, [16, 30, 44, 58], 10, 3, 75, LIGHT_EDGE, 1.4)
    # favicon：色帶放大、只留 3＋1（16px 下五條會糊成一片）
    f_d = bands(10, 80, [10, 30, 50], 15, 4, 73, DARK_EDGE, 2)
    f_l = bands(10, 80, [10, 30, 50], 15, 4, 73, LIGHT_EDGE, 2)
    files = {
        'faber-castell-color-icon.svg':       tile(512, m_d, DARK_TILE),
        'faber-castell-color-icon-light.svg': tile(512, m_l, LIGHT_TILE, True),
        'favicon.svg':                        tile(64, f_d, DARK_TILE),
        'favicon-light.svg':                  tile(64, f_l, LIGHT_TILE, True),
    }
    for name, svg in files.items():
        open(os.path.join(OUT, name), 'w').write(svg)
    return list(files)


def build_pngs():
    src = {16: 'favicon.svg', 32: 'favicon.svg', 48: 'favicon.svg'}
    for s in (64, 128, 180, 192, 256, 512):
        src[s] = 'faber-castell-color-icon.svg'
    for size, f in sorted(src.items()):
        page = fitz.open(os.path.join(OUT, f))[0]
        z = size / page.rect.width          # ⚠️ 由實際 page 寬反推，不可寫死 size/100
        pm = page.get_pixmap(alpha=True, matrix=fitz.Matrix(z, z))
        assert pm.width == size == pm.height, f'{size} → {pm.width}x{pm.height}'
        pm.save(os.path.join(OUT, f'icon-{size}.png'))
    Image.open(os.path.join(OUT, 'icon-48.png')).convert('RGBA').save(
        os.path.join(OUT, 'favicon.ico'), format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])


def build_manifest():
    m = {
        "name": "faber-castell-color",
        "short_name": "FC colour",
        "description": "Faber-Castell colour code → CSS reference (Art & Graphic + Black Edition).",
        "start_url": "/apps/faber-castell-color/",
        "scope": "/apps/faber-castell-color/",
        "display": "standalone",
        "background_color": "#0f1115",
        "theme_color": "#0f1115",
        "icons": [
            {"src": "icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png"},
            {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    }
    open(os.path.join(OUT, 'manifest.json'), 'w').write(
        json.dumps(m, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    print('SVG 母版 :', ', '.join(build_svgs()))
    build_pngs()
    build_manifest()
    print('產出       :', len(os.listdir(OUT)), '個檔於 icons/')
