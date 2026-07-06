/**
 * FaberCastellCssLib — faber-castell-color 前端核心 library（純邏輯，不碰 DOM）
 * =========================================================================
 * IIFE → window.FaberCastellCssLib。零依賴、不用 fetch（資料是靜態 registry）。
 *
 * 這支 app 是唯讀參考工具：資料 window.FC_COLORS（data/fc-colors.js）由 PDF 產生、
 * 不需上傳/編輯，故無後端 API。lib 只做「資料 → 呈現字串 / CSS」的純運算。
 *
 * 資料形狀（window.FC_COLORS 每筆）：
 *   Color = {
 *     code:'264', name:'dark phthalo green', hex:'#008b71',
 *     r:0, g:139, b:113, cssVar:'--fc-264', page:3, note:'…',
 *     lf?:  { polychromos:'***', adWatercolour:'**', … },   // 只有 pp.1-3 色號有
 *     sets?:{ 'Polychromos colour pencils':[12,24,36,60,72], … }
 *   }
 *
 * Public API：
 *   FaberCastellCssLib.FOLDER · SORT_MODES（['code','hue','lightness','family']）· FAMILY_ORDER
 *   filter(colors, query) → Color[]              依色號或色名過濾（不改輸入、不分大小寫）
 *   sortColors(colors, mode) → Color[]           依 mode 排序（不改輸入）：色號 / 色相光譜 / 明度 / 色系分群
 *   colorFamily(color) → 'red'|…|'neutral'       某色屬哪個色系（s<0.17 → neutral）
 *   rgbToHsl(r,g,b) → {h,s,l}
 *   hexToRgb(hex) → {r,g,b} | null
 *   relLuminance(r,g,b) → 0..1                    sRGB 相對亮度（WCAG）
 *   pickTextColor(color) → '#000000' | '#ffffff' 色塊上文字該用黑或白（對比取勝者）
 *   isMetallic(color) → boolean                  hex 為近似值（金屬色）
 *   formatRgb(color) → 'rgb(0, 139, 113)'
 *   copyValue(color, fmt) → string               fmt: 'hex' | 'var' | 'rgb' | 'class'
 *   buildCss(colors) → string                    產生 :root 變數 + utility classes 整份 .css
 *   cssFilename() → 'faber_castell_colors.css'
 */
(function (window) {
  'use strict';

  var FOLDER = 'faber-castell-color';
  var CSS_FILENAME = 'faber_castell_colors.css';

  // ---- 過濾（純函式，不改輸入） --------------------------------------------
  function filter(colors, query) {
    var q = String(query == null ? '' : query).trim().toLowerCase();
    if (!q) return colors.slice();
    return colors.filter(function (c) {
      return c.code.toLowerCase().indexOf(q) !== -1 ||
             c.name.toLowerCase().indexOf(q) !== -1;
    });
  }

  // ---- 顏色運算 ------------------------------------------------------------
  function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    var m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function _chan(v) {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function relLuminance(r, g, b) {
    return 0.2126 * _chan(r) + 0.7152 * _chan(g) + 0.0722 * _chan(b);
  }

  // 白字與黑字誰的對比高就用誰（含 1:1 邊界，避免中間灰模糊）
  function pickTextColor(color) {
    var L = relLuminance(color.r, color.g, color.b);
    var contrastWhite = 1.05 / (L + 0.05);
    var contrastBlack = (L + 0.05) / 0.05;
    return contrastWhite >= contrastBlack ? '#ffffff' : '#000000';
  }

  function isMetallic(color) {
    return /metallic/i.test(color.note || '');
  }

  // sRGB → HSL（h:0..360, s/l:0..1）——移植自 color-palette-lib.rgbToHsl
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      switch (mx) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }

  // 色系分群（沿色相環）；'neutral'＝黑/白/灰。移植自 color-palette-lib 的 hueFamily/FAMILY_ORDER。
  var FAMILY_ORDER = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'neutral'];
  function hueFamily(hue) {
    var h = ((hue % 360) + 360) % 360;
    if (h >= 345 || h < 15) return 'red';
    if (h < 45) return 'orange';
    if (h < 70) return 'yellow';
    if (h < 165) return 'green';
    if (h < 195) return 'cyan';
    if (h < 255) return 'blue';
    if (h < 290) return 'purple';
    return 'magenta';
  }
  // 某色屬哪個色系：飽和度 <0.17（黑/白/灰、近白金屬）→ 'neutral'，否則依色相分。
  function colorFamily(color) {
    var x = rgbToHsl(color.r, color.g, color.b);
    return x.s < 0.17 ? 'neutral' : hueFamily(x.h);
  }

  var SORT_MODES = ['code', 'hue', 'lightness', 'family'];

  // 依 mode 排序（純函式、不改輸入）：
  //   'code'      — 依色號（廠商原始順序）
  //   'hue'       — 依色相排成光譜；無彩度（s<0.12：黑/白/灰/近白金屬）殿後、依明度亮→暗
  //   'lightness' — 依相對亮度亮→暗
  function sortColors(colors, mode) {
    var arr = colors.slice();
    if (mode === 'lightness') {
      return arr.sort(function (a, b) { return relLuminance(b.r, b.g, b.b) - relLuminance(a.r, a.g, a.b); });
    }
    if (mode === 'hue') {
      // s < 0.17：黑/白/灰（含帶微暖冷調的 warm/cold grey，飽和度 ≤0.16）與近白金屬 → 視為無彩度、殿後
      var dec = arr.map(function (c) { var x = rgbToHsl(c.r, c.g, c.b); return { c: c, h: x.h, s: x.s, l: x.l }; });
      var chroma = dec.filter(function (d) { return d.s >= 0.17; });
      var achr = dec.filter(function (d) { return d.s < 0.17; });
      chroma.sort(function (a, b) { return (a.h - b.h) || (b.l - a.l); });
      achr.sort(function (a, b) { return b.l - a.l; });
      return chroma.concat(achr).map(function (d) { return d.c; });
    }
    if (mode === 'family') {
      // 依 FAMILY_ORDER 分群排列；群內彩色依色相→明度，neutral 群依明度亮→暗。
      var fi = {}; FAMILY_ORDER.forEach(function (f, i) { fi[f] = i; });
      var d2 = arr.map(function (c) { var x = rgbToHsl(c.r, c.g, c.b); return { c: c, fam: colorFamily(c), h: x.h, l: x.l }; });
      return d2.sort(function (a, b) {
        return (fi[a.fam] - fi[b.fam]) ||
               (a.fam === 'neutral' ? (b.l - a.l) : ((a.h - b.h) || (b.l - a.l)));
      }).map(function (d) { return d.c; });
    }
    return arr.sort(function (a, b) { return (parseInt(a.code, 10) || 0) - (parseInt(b.code, 10) || 0); });
  }

  function formatRgb(color) {
    return 'rgb(' + color.r + ', ' + color.g + ', ' + color.b + ')';
  }

  // ---- 可複製字串 ----------------------------------------------------------
  function copyValue(color, fmt) {
    switch (fmt) {
      case 'hex':   return color.hex;
      case 'var':   return 'var(' + color.cssVar + ')';
      case 'rgb':   return formatRgb(color);
      case 'class': return '.fc-bg-' + color.code;
      default:      return color.hex;
    }
  }

  // ---- 產生整份 CSS（:root 變數 + utility classes） ------------------------
  // 逐字對齊家族 repo 的 Faber-Castell/faber_castell_colors.css，讓那份由此生成、單一真相。
  function buildCss(colors) {
    var out = [];
    out.push('/* Faber-Castell colour code -> CSS hex');
    out.push('   Generated by faber-castell-color (FaberCastellCssLib.buildCss).');
    out.push('   Source: Farbtabelle-AG-ENG-0214.pdf');
    out.push('   Note: hex values are sampled from PDF swatches and are approximate, not official RGB/HEX specifications.');
    out.push('   Metallics (--fc-250/251/252/290/292/294) are gradient swatches with no single true hex — the value is a rough approximation.');
    out.push('*/');
    out.push('');
    out.push(':root {');
    colors.forEach(function (c) {
      out.push('  ' + c.cssVar + ': ' + c.hex + '; /* ' + c.name + ' */');
    });
    out.push('}');
    out.push('');
    colors.forEach(function (c) {
      out.push('.fc-color-' + c.code + ' { color: var(' + c.cssVar + '); }');
      out.push('.fc-bg-' + c.code + ' { background-color: var(' + c.cssVar + '); }');
    });
    out.push('');
    return out.join('\n');
  }

  function cssFilename() { return CSS_FILENAME; }

  window.FaberCastellCssLib = {
    FOLDER: FOLDER,
    SORT_MODES: SORT_MODES,
    FAMILY_ORDER: FAMILY_ORDER,
    filter: filter,
    sortColors: sortColors,
    colorFamily: colorFamily,
    hexToRgb: hexToRgb,
    rgbToHsl: rgbToHsl,
    relLuminance: relLuminance,
    pickTextColor: pickTextColor,
    isMetallic: isMetallic,
    formatRgb: formatRgb,
    copyValue: copyValue,
    buildCss: buildCss,
    cssFilename: cssFilename
  };
})(window);
