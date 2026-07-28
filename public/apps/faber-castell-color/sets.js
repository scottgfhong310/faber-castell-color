/**
 * sets.js — 套組收錄對照頁的控制器（碰 DOM）
 * 形制對齊官方色卡 PDF 的 assortment 表：列＝顏色、欄＝套組、格子＝收錄。
 * 矩陣與差額運算（assortmentMatrix / columnAdditions）在 FaberCastellCssLib，不在這裡。
 */
(function (window, $) {
  'use strict';

  var Lib = window.FaberCastellCssLib;
  var COLORS = window.FC_COLORS || [];
  var META = window.FC_META || {};
  var LS_THEME = 'faber-castell-color-theme';
  var LS_BASE = 'faber-castell-color-baseline';

  // 兩張表各自獨立（跨系列比較無意義：色號範圍不重疊、產品族不同）
  var SECTIONS = [
    { key: 'ag', el: '#matrix-ag' },
    { key: 'black-edition', el: '#matrix-be' }
  ];
  var matrices = {};        // series → matrix
  // 基準以「產品線＋尺寸」辨識，不用欄號——欄號會隨資料增減而位移，
  // 存進 localStorage 或深連結就會指到別的套組。
  var baseline = null;      // { line, size } 或 null

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
  function colKey(line, size) { return line + '|' + size; }

  // 基準在某張表裡是第幾欄；不屬於這張表就回 null
  function baseIndexIn(m) {
    if (!baseline) return null;
    for (var i = 0; i < m.columns.length; i++) {
      if (m.columns[i].line === baseline.line && m.columns[i].size === baseline.size) return i;
    }
    return null;
  }

  function parseBaseline(v) {
    if (!v) return null;
    var i = v.lastIndexOf('|');
    if (i < 1) return null;
    var line = v.slice(0, i), size = +v.slice(i + 1);
    var ok = SECTIONS.some(function (sec) {
      var m = matrices[sec.key];
      return m && m.columns.some(function (c) { return c.line === line && c.size === size; });
    });
    return ok ? { line: line, size: size } : null;
  }

  // ---- 基準選單 ------------------------------------------------------------
  function buildBaselineOptions() {
    var html = '<option value="">' + esc(t('sets.baselineNone')) + '</option>';
    SECTIONS.forEach(function (sec) {
      var m = matrices[sec.key];
      if (!m || !m.columns.length) return;
      html += '<optgroup label="' + esc(seriesLabel(sec.key)) + '">';
      m.columns.forEach(function (col) {
        html += '<option value="' + esc(colKey(col.line, col.size)) + '">' +
          esc(col.line + ' · ' + col.size + ct()) + '</option>';
      });
      html += '</optgroup>';
    });
    var $sel = $('#baseline');
    $sel.html(html).val(baseline ? colKey(baseline.line, baseline.size) : '');
    if (window.M && M.FormSelect) M.FormSelect.init($sel[0], {});
  }

  // ---- 矩陣 ----------------------------------------------------------------
  // baseIdx 只在「基準所屬的那張表」有意義——欄位索引是各表獨立的，
  // 拿 Black Edition 的欄號去索引 Art & Graphic 的 cells 會對到完全不相干的欄。
  function headerHtml(m, adds, baseIdx) {
    var lineCells = '', sizeCells = '', addCells = '';
    var i = 0;
    while (i < m.columns.length) {                       // 第 1 列：產品線（跨欄）
      var line = m.columns[i].line, span = 0;
      while (i + span < m.columns.length && m.columns[i + span].line === line) span++;
      lineCells += '<th class="c-line" colspan="' + span + '" title="' + esc(line) + '">' +
        esc(line) + '</th>';
      i += span;
    }
    m.columns.forEach(function (col, ci) {                // 第 2 列：尺寸（可點設為基準）
      var isBase = ci === baseIdx;
      sizeCells += '<th class="c-size' + (isBase ? ' is-base' : '') + '"' +
        ' data-col="' + ci + '" title="' + esc(col.line + ' · ' + col.size + ct()) + '">' +
        col.size + '</th>';
      if (adds) {                                        // 第 3 列：差額摘要
        addCells += '<td class="c-add' + (isBase ? ' is-base' : '') + '">' +
          (isBase ? '—' : (adds[ci] > 0 ? '+' + adds[ci] : '0')) + '</td>';
      }
    });
    // 第一欄的表頭以 rowspan 一路蓋住這 2～3 列，故後續列直接接資料格
    return '<thead>' +
      '<tr class="r-line"><th class="c-color" rowspan="' + (adds ? 3 : 2) + '">' +
        esc(t('sets.colColour')) + '</th>' + lineCells + '</tr>' +
      '<tr class="r-size">' + sizeCells + '</tr>' +
      (adds ? '<tr class="r-add">' + addCells + '</tr>' : '') +
      '</thead>';
  }

  function bodyHtml(m, baseIdx) {
    return '<tbody>' + m.rows.map(function (r) {
      var c = r.color;
      var fg = Lib.pickTextColor(c);
      var owned = baseIdx != null && r.cells[baseIdx];      // 這個色已被基準套組涵蓋
      var cells = r.cells.map(function (on, ci) {
        if (!on) return '<td class="cell"></td>';
        var cls = 'cell is-in';
        if (baseIdx != null) cls += ci === baseIdx ? ' is-basecell' : (owned ? ' is-owned' : ' is-new');
        return '<td class="' + cls + '"><span class="dot"></span></td>';
      }).join('');
      return '<tr data-code="' + esc(c.code) + '">' +
        '<th class="c-color"><span class="ccell">' +
          '<span class="mini" style="background:' + esc(c.hex) + ';color:' + fg + '">' +
            esc(c.code) + (Lib.isMetallic(c) ? '<span class="badge">&#8776;</span>' : '') +
          '</span>' +
          '<span class="cname" title="' + esc(c.name) + '">' + esc(c.name) + '</span>' +
        '</span></th>' + cells + '</tr>';
    }).join('') + '</tbody>';
  }

  function renderSection(sec) {
    var m = matrices[sec.key];
    var $el = $(sec.el);
    if (!m || !m.rows.length) { $el.empty(); return; }
    var baseIdx = baseIndexIn(m);
    var adds = baseIdx != null ? Lib.columnAdditions(m, baseIdx) : null;
    var noSet = m.rows.filter(function (r) { return r.cells.every(function (x) { return !x; }); }).length;

    $el.html('<h2 class="matrix-title">' + esc(seriesLabel(sec.key)) +
        '<span class="matrix-n">' + t('sets.tableN', { colours: m.rows.length, sets: m.columns.length }) + '</span>' +
        (adds ? '<span class="matrix-base">' + esc(t('sets.baselineOn')) + '</span>' : '') +
      '</h2>' +
      (noSet ? '<p class="matrix-note">' + esc(t('sets.emptyRows', { n: noSet })) + '</p>' : '') +
      '<div class="matrix-scroll"><table class="assort' + (adds ? ' has-add' : '') + '">' +
        headerHtml(m, adds, baseIdx) + bodyHtml(m, baseIdx) + '</table></div>');
  }

  function renderLegend() {
    var items = baseline
      ? [['is-basecell', t('sets.legendBase')], ['is-owned', t('sets.legendOwned')], ['is-new', t('sets.legendNew')]]
      : [['is-in', t('sets.legendIn')]];
    $('#legend').html(items.map(function (x) {
      return '<span class="legend-item"><span class="cell ' + x[0] + '"><span class="dot"></span></span>' +
        esc(x[1]) + '</span>';
    }).join(''));
  }

  function renderAll() {
    SECTIONS.forEach(renderSection);
    renderLegend();
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

  function onI18n() {
    buildBaselineOptions();
    renderAll();
  }

  // ---- 啟動 ----------------------------------------------------------------
  $(function () {
    SECTIONS.forEach(function (sec) {
      matrices[sec.key] = Lib.assortmentMatrix(COLORS, { series: sec.key });
    });

    // 還原上次的基準；深連結 ?base=<產品線>|<尺寸> 優先。認不得就當沒選（不報錯）
    var q = /[?&]base=([^&]*)/.exec(window.location.search);
    var saved = q ? decodeURIComponent(q[1].replace(/\+/g, ' ')) : null;
    if (saved == null) { try { saved = localStorage.getItem(LS_BASE); } catch (e) { } }
    baseline = parseBaseline(saved);

    if (window.I18n) I18n.apply(document);
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    buildBaselineOptions();
    renderAll();

    function setBaseline(v) {
      baseline = parseBaseline(v);
      try { localStorage.setItem(LS_BASE, baseline ? colKey(baseline.line, baseline.size) : ''); } catch (e) { }
      buildBaselineOptions();
      renderAll();
    }

    $('#baseline').on('change', function () { setBaseline(this.value); });

    // 點欄位的尺寸＝把該套組設為基準（再點一次取消）；比拉選單快
    $('.matrix-sec').on('click', '.c-size', function () {
      var sec = $(this).closest('.matrix-sec').attr('id') === 'matrix-ag' ? 'ag' : 'black-edition';
      var col = matrices[sec].columns[+$(this).data('col')];
      if (!col) return;
      var key = colKey(col.line, col.size);
      setBaseline(baseline && colKey(baseline.line, baseline.size) === key ? '' : key);
    });

    // 點色號回主網格並帶出該色
    $('.matrix-sec').on('click', 'tbody .c-color', function () {
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
