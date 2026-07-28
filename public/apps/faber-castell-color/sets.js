/**
 * sets.js — 套組收錄對照頁的控制器（碰 DOM）
 *
 * 一句話：選一個套組，只留下它收錄的顏色，再橫向看其他套組有沒有涵蓋。
 *   情境 A：從色彩牆找到一個色 → 明細看它在哪些套組 → 這裡看那個套組的完整色單。
 *   情境 B：想買 50 色，但需要 skin tones → 選 skin tones → 看 50 那一欄蓋掉幾格。
 *
 * 列＝顏色、欄＝套組（形制對齊官方色卡）。矩陣運算（assortmentMatrix）在
 * FaberCastellCssLib，不在這裡。
 */
(function (window, $) {
  'use strict';

  var Lib = window.FaberCastellCssLib;
  var COLORS = window.FC_COLORS || [];
  var META = window.FC_META || {};
  var LS_THEME = 'faber-castell-color-theme';
  var LS_SERIES = 'faber-castell-color-sets-series';
  var LS_PICK = 'faber-castell-color-sets-pick';

  // 一次只顯示一個系列（跨系列比較無意義：色號範圍不重疊、產品族不同）
  var SERIES = ['ag', 'black-edition'];
  var matrices = {};        // series → matrix
  var series = 'ag';
  // 選中的套組以「產品線＋尺寸」辨識，不用欄號——欄號會隨資料增減位移，
  // 存進 localStorage 或深連結就會指到別的套組。
  var picked = null;        // { line, size, series } 或 null

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function t(key, params) { return window.I18n ? I18n.t(key, params) : key; }
  function ct() { return t('sets.ct'); }

  function seriesLabel(key) {
    var s = (META.series || []).filter(function (x) { return x.key === key; })[0];
    return s ? s.label : key;
  }
  function setKey(line, size) { return line + '|' + size; }

  // 選中的套組在這張表裡是第幾欄；不屬於這張表就回 null
  function pickedIndexIn(m) {
    if (!picked) return null;
    for (var i = 0; i < m.columns.length; i++) {
      if (m.columns[i].line === picked.line && m.columns[i].size === picked.size) return i;
    }
    return null;
  }

  function parsePick(v) {
    if (!v) return null;
    var i = v.lastIndexOf('|');
    if (i < 1) return null;
    var line = v.slice(0, i), size = +v.slice(i + 1);
    var found = null;
    SERIES.forEach(function (k) {
      var m = matrices[k];
      if (m && m.columns.some(function (c) { return c.line === line && c.size === size; })) found = k;
    });
    return found ? { line: line, size: size, series: found } : null;
  }

  // ---- 固定 Header --------------------------------------------------------
  function renderSeriesTabs() {
    $('#series-tabs').html(SERIES.map(function (k) {
      var m = matrices[k];
      return '<button class="series-tab' + (k === series ? ' is-on' : '') + '" data-series="' + esc(k) + '">' +
        esc(seriesLabel(k)) +
        '<span class="series-n">' + t('sets.tableN', { colours: m.rows.length, sets: m.columns.length }) + '</span>' +
        '</button>';
    }).join(''));
  }

  // 目前篩選狀態：沒選就給提示，選了就顯示套組名＋筆數＋清除鈕
  function renderPicked() {
    if (!picked || picked.series !== series) {
      $('#picked').html('<span class="picked-hint">' + esc(t('sets.pickHint')) + '</span>');
      return;
    }
    var m = matrices[series];
    var i = pickedIndexIn(m);
    var n = m.rows.filter(function (r) { return r.cells[i]; }).length;
    $('#picked').html(
      '<span class="picked-chip">' +
        '<span class="picked-name">' + esc(picked.line + ' · ' + picked.size + ct()) + '</span>' +
        '<span class="picked-n">' + t('sets.showingN', { n: n, total: m.rows.length }) + '</span>' +
        '<button class="picked-clear" id="picked-clear" title="' + esc(t('sets.clear')) + '">' +
          '<i class="material-icons">close</i></button>' +
      '</span>');
  }

  // ---- 矩陣 ----------------------------------------------------------------
  function headerHtml(m, pickIdx, gaps) {
    var lineCells = '', sizeCells = '', gapCells = '';
    var i = 0;
    while (i < m.columns.length) {                       // 第 1 列：產品線（跨欄）
      var line = m.columns[i].line, span = 0;
      while (i + span < m.columns.length && m.columns[i + span].line === line) span++;
      lineCells += '<th class="c-line" colspan="' + span + '" title="' + esc(line) + '">' +
        // 用明確 width（max-width 只能收窄、撐不寬）；下限 76px 是「Gift Set Art & Graphic」
        // 折成兩行所需的寬度，否則單尺寸欄（34px）會被 line-clamp 截斷。
        '<span style="width:' + Math.max(span * 34 - 12, 76) + 'px">' + esc(line) + '</span></th>';
      i += span;
    }
    m.columns.forEach(function (col, ci) {               // 第 2 列：尺寸（點它＝選這個套組）
      sizeCells += '<th class="c-size' + (ci === pickIdx ? ' is-picked' : '') + '"' +
        ' data-col="' + ci + '" title="' + esc(col.line + ' · ' + col.size + ct()) + '">' +
        col.size + '</th>';
      if (gaps) {                                       // 第 3 列：相對選中套組還缺幾色
        var g = gaps[ci];
        var cls = ci === pickIdx ? ' is-picked' : (g === 0 ? ' is-full' : '');
        gapCells += '<td class="c-gap' + cls + '" title="' +
          esc(ci === pickIdx ? t('sets.gapSelf') : t('sets.gapTip', { n: g })) + '">' +
          (ci === pickIdx ? '—' : (g === 0 ? '0' : '−' + g)) + '</td>';
      }
    });
    return '<thead>' +
      '<tr class="r-line"><th class="c-color" rowspan="' + (gaps ? 3 : 2) + '">' +
        esc(t('sets.colColour')) + '</th>' + lineCells + '</tr>' +
      '<tr class="r-size">' + sizeCells + '</tr>' +
      (gaps ? '<tr class="r-gap">' + gapCells + '</tr>' : '') +
      '</thead>';
  }

  function bodyHtml(m, pickIdx) {
    return '<tbody>' + m.rows.map(function (r) {
      var c = r.color;
      var fg = Lib.pickTextColor(c);
      // 選了套組之後，該欄沒有收錄的列直接藏起來——這頁的核心動作
      var hidden = pickIdx != null && !r.cells[pickIdx];
      var cells = r.cells.map(function (on, ci) {
        if (!on) return '<td class="cell"></td>';
        return '<td class="cell is-in' + (ci === pickIdx ? ' is-pickedcell' : '') + '">' +
          '<span class="dot"></span></td>';
      }).join('');
      return '<tr data-code="' + esc(c.code) + '"' + (hidden ? ' class="is-hidden"' : '') + '>' +
        '<th class="c-color"><span class="ccell">' +
          '<span class="mini" style="background:' + esc(c.hex) + ';color:' + fg + '">' +
            esc(c.code) + (Lib.isMetallic(c) ? '<span class="badge">&#8776;</span>' : '') +
          '</span>' +
          '<span class="cname" title="' + esc(c.name) + '">' + esc(c.name) + '</span>' +
        '</span></th>' + cells + '</tr>';
    }).join('') + '</tbody>';
  }

  function renderMatrix() {
    var m = matrices[series];
    var $el = $('#matrix');
    // 目前系列也標在容器上：欄寬等樣式要能分系列給（AG 32 欄，第一欄要窄一點）
    $el.attr('data-series', series);
    if (!m || !m.rows.length) { $el.empty(); return; }
    var pickIdx = pickedIndexIn(m);
    var gaps = pickIdx != null ? Lib.columnGaps(m, pickIdx) : null;
    var noSet = m.rows.filter(function (r) { return r.cells.every(function (x) { return !x; }); }).length;

    // 不包捲動外框：表格直接接在頁面上往下延展，sticky 以視窗為基準
    $el.html(
      (noSet && pickIdx == null
        ? '<p class="matrix-note">' + esc(t('sets.emptyRows', { n: noSet })) + '</p>' : '') +
      '<table class="assort' + (gaps ? ' has-gap' : '') + '">' +
        headerHtml(m, pickIdx, gaps) + bodyHtml(m, pickIdx) + '</table>');
  }

  function renderAll() {
    renderMatrix();
    renderPicked();
    $('#matrix-foot').text(t('sets.foot'));
  }

  // ---- 主題（與 index.html 同一把 localStorage 鑰匙） ----------------------
  function applyTheme(theme) {
    var r = document.documentElement;
    r.setAttribute('data-theme', theme);
    r.classList.toggle('dark-mode', theme === 'dark');
    r.classList.toggle('light-mode', theme === 'light');
    try { localStorage.setItem(LS_THEME, theme); } catch (e) { }
    $('#setting-mode i').text(theme === 'dark' ? 'dark_mode' : 'light_mode');
  }

  // 固定 Header 的高度餵給表頭：thead 要黏在 Header 底下，不是視窗頂端。
  // 高度會隨語言／換行變動，所以量出來寫進 CSS 變數，不寫死。
  function syncHeadHeight() {
    var h = document.getElementById('page-head');
    document.documentElement.style.setProperty('--head-h', (h ? h.offsetHeight : 0) + 'px');
  }

  function onI18n() {
    renderSeriesTabs();
    renderAll();
    syncHeadHeight();
  }

  // ---- 啟動 ----------------------------------------------------------------
  $(function () {
    SERIES.forEach(function (k) {
      matrices[k] = Lib.assortmentMatrix(COLORS, { series: k });
    });

    // 深連結 ?set=<產品線>|<尺寸> 優先，其次記憶。認不得就當沒選（不報錯）
    var q = /[?&]set=([^&]*)/.exec(window.location.search);
    var saved = q ? decodeURIComponent(q[1].replace(/\+/g, ' ')) : null;
    if (saved == null) { try { saved = localStorage.getItem(LS_PICK); } catch (e) { } }
    picked = parsePick(saved);

    // 目前系列：選中的套組所屬系列優先（顯示的就該是它），其次記憶，最後預設
    var qs = /[?&]series=([^&]*)/.exec(window.location.search);
    var wanted = qs ? decodeURIComponent(qs[1]) : (picked ? picked.series : null);
    if (!wanted) { try { wanted = localStorage.getItem(LS_SERIES); } catch (e) { } }
    if (SERIES.indexOf(wanted) !== -1) series = wanted;

    if (window.I18n) I18n.apply(document);
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    renderSeriesTabs();
    renderAll();
    syncHeadHeight();
    $(window).on('resize', syncHeadHeight);

    function setPick(v) {
      picked = parsePick(v);
      try { localStorage.setItem(LS_PICK, picked ? setKey(picked.line, picked.size) : ''); } catch (e) { }
      renderAll();
      syncHeadHeight();
    }
    function setSeries(k) {
      if (SERIES.indexOf(k) === -1 || k === series) return;
      series = k;
      try { localStorage.setItem(LS_SERIES, k); } catch (e) { }
      // 選中的套組屬於某個系列；換系列後它既不適用、欄位也不在表上，一併清掉
      if (picked && picked.series !== k) {
        picked = null;
        try { localStorage.setItem(LS_PICK, ''); } catch (e) { }
      }
      renderSeriesTabs();
      renderAll();
      syncHeadHeight();
    }

    $('#series-tabs').on('click', '.series-tab', function () { setSeries($(this).data('series') + ''); });
    $('#picked').on('click', '#picked-clear', function () { setPick(''); });

    // 點欄位的尺寸＝選這個套組（再點一次取消）
    $('#matrix').on('click', '.c-size', function () {
      var col = matrices[series].columns[+$(this).data('col')];
      if (!col) return;
      var key = setKey(col.line, col.size);
      setPick(picked && setKey(picked.line, picked.size) === key ? '' : key);
    });

    // 點色號回主網格並帶出該色（情境 A 的回程）
    $('#matrix').on('click', 'tbody .c-color', function () {
      window.location.href = './?code=' + encodeURIComponent($(this).closest('tr').data('code'));
    });

    $('#setting-mode').on('click', function () {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
    $('#setting-lang').on('click', function () {
      var next = I18n.cycle();
      M.toast({ html: t('toast.lang', { name: I18n.name(next) }), classes: 'teal' });
    });

    document.addEventListener('i18n:changed', onI18n);
  });
})(window, jQuery);
