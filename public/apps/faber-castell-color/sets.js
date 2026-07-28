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

  var LS_SERIES = 'faber-castell-color-sets-series';

  // 一次只顯示一個系列（跨系列比較無意義：色號範圍不重疊、產品族不同），
  // 由側鍵面板切換。
  var SERIES = ['ag', 'black-edition'];
  var matrices = {};        // series → matrix
  var series = 'ag';        // 目前顯示的系列
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

  // 基準在這張表裡是第幾欄；不屬於這張表（例如基準在另一個系列）就回 null
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
    var found = null;
    SERIES.forEach(function (k) {
      var m = matrices[k];
      if (m && m.columns.some(function (c) { return c.line === line && c.size === size; })) found = k;
    });
    return found ? { line: line, size: size, series: found } : null;
  }

  // ---- 側鍵面板：選系列 + 選「我已經有的」 --------------------------------
  function renderSeriesTabs() {
    $('#series-tabs').html(SERIES.map(function (k) {
      var m = matrices[k];
      return '<button class="series-tab' + (k === series ? ' is-on' : '') + '" data-series="' + esc(k) + '">' +
        esc(seriesLabel(k)) +
        '<span class="series-n">' + t('sets.tableN', { colours: m.rows.length, sets: m.columns.length }) + '</span>' +
        '</button>';
    }).join(''));
  }

  // 套組清單：一條產品線一列，尺寸做成 chip；只列出目前系列的套組
  function renderSetList() {
    var m = matrices[series];
    var lines = [];
    m.columns.forEach(function (col) {
      var L = lines[lines.length - 1];
      if (!L || L.line !== col.line) lines.push({ line: col.line, sizes: [col.size] });
      else L.sizes.push(col.size);
    });
    var none = !baseline;
    var html = '<button class="set-none' + (none ? ' is-on' : '') + '">' +
      esc(t('setlist.none')) + '</button>';
    html += lines.map(function (L) {
      var chips = L.sizes.map(function (sz) {
        var on = baseline && baseline.line === L.line && baseline.size === sz;
        return '<button class="size-chip' + (on ? ' is-on' : '') + '"' +
          ' data-line="' + esc(L.line) + '" data-size="' + sz + '">' + sz + '</button>';
      }).join('');
      return '<div class="set-item">' +
        '<div class="set-item-line">' + esc(L.line) + '</div>' +
        '<div class="set-item-sizes">' + chips + '</div></div>';
    }).join('');
    $('#setlist').html(html);
  }

  // topbar 只顯示目前選了什麼（改選在面板裡做）
  function renderOwned() {
    var txt = baseline
      ? baseline.line + ' · ' + baseline.size + ct()
      : t('setlist.none');
    $('#owned-wrap').html('<span class="owned-label">' + esc(t('sets.baseline')) + '</span>' +
      '<button class="owned-value' + (baseline ? ' is-set' : '') + '" id="owned-open">' +
      esc(txt) + '<i class="material-icons">expand_more</i></button>');
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
      // 上限＝該線佔幾個尺寸欄 × 34px；放在內層 span 上，auto layout 才會照它算欄寬
      lineCells += '<th class="c-line" colspan="' + span + '" title="' + esc(line) + '">' +
        // 用**明確寬度**而非 max-width：max-width 只能收窄、撐不寬，單一尺寸的線
        // （欄寬 34px）仍會被 line-clamp 截掉。給 block 一個實際寬度，欄寬才會照它算。
        // 下限 76px＝實測「Gift Set Art & Graphic」折成兩行所需的寬度（60–96px 都是兩行）。
        '<span style="width:' + Math.max(span * 34 - 12, 76) + 'px">' + esc(line) + '</span></th>';
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

  function renderMatrix() {
    var m = matrices[series];
    var $el = $('#matrix');
    // 目前系列也標在容器上：欄寬等樣式要能分系列給（AG 32 欄，第一欄要窄一點）
    $el.attr('data-series', series);
    if (!m || !m.rows.length) { $el.empty(); return; }
    var baseIdx = baseIndexIn(m);
    var adds = baseIdx != null ? Lib.columnAdditions(m, baseIdx) : null;
    var noSet = m.rows.filter(function (r) { return r.cells.every(function (x) { return !x; }); }).length;

    // 不再包捲動外框：表格直接接在頁面上往下延展，sticky 以視窗為基準
    $el.html('<h2 class="matrix-title">' + esc(seriesLabel(series)) +
        '<span class="matrix-n">' + t('sets.tableN', { colours: m.rows.length, sets: m.columns.length }) + '</span>' +
        (adds ? '<span class="matrix-base">' + esc(t('sets.baselineOn')) + '</span>' : '') +
      '</h2>' +
      (noSet ? '<p class="matrix-note">' + esc(t('sets.emptyRows', { n: noSet })) + '</p>' : '') +
      '<table class="assort' + (adds ? ' has-add' : '') + '">' +
        headerHtml(m, adds, baseIdx) + bodyHtml(m, baseIdx) + '</table>');
  }

  function renderLegend() {
    var active = matrices[series] && baseIndexIn(matrices[series]) != null;
    var items = active
      ? [['is-basecell', t('sets.legendBase')], ['is-owned', t('sets.legendOwned')], ['is-new', t('sets.legendNew')]]
      : [['is-in', t('sets.legendIn')]];
    $('#legend').html(items.map(function (x) {
      return '<span class="legend-item"><span class="cell ' + x[0] + '"><span class="dot"></span></span>' +
        esc(x[1]) + '</span>';
    }).join(''));
  }

  function renderAll() {
    renderMatrix();
    renderLegend();
    renderOwned();
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
    renderSeriesTabs();
    renderSetList();
    renderAll();
  }

  // ---- 啟動 ----------------------------------------------------------------
  $(function () {
    SERIES.forEach(function (k) {
      matrices[k] = Lib.assortmentMatrix(COLORS, { series: k });
    });
    var setlistModal = M.Modal.init(document.getElementById('setlist-modal'), { dismissible: true });

    // 還原上次的基準；深連結 ?base=<產品線>|<尺寸> 優先。認不得就當沒選（不報錯）
    var q = /[?&]base=([^&]*)/.exec(window.location.search);
    var saved = q ? decodeURIComponent(q[1].replace(/\+/g, ' ')) : null;
    if (saved == null) { try { saved = localStorage.getItem(LS_BASE); } catch (e) { } }
    baseline = parseBaseline(saved);

    // 目前系列：深連結帶的基準優先（顯示的就該是它所屬的系列），其次記憶，最後預設
    var qs = /[?&]series=([^&]*)/.exec(window.location.search);
    var wanted = qs ? decodeURIComponent(qs[1]) : (baseline ? baseline.series : null);
    if (!wanted) { try { wanted = localStorage.getItem(LS_SERIES); } catch (e) { } }
    if (SERIES.indexOf(wanted) !== -1) series = wanted;

    if (window.I18n) I18n.apply(document);
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    renderSeriesTabs();
    renderSetList();
    renderAll();

    function setBaseline(v) {
      baseline = parseBaseline(v);
      try { localStorage.setItem(LS_BASE, baseline ? colKey(baseline.line, baseline.size) : ''); } catch (e) { }
      renderSetList();
      renderAll();
    }
    function setSeries(k) {
      if (SERIES.indexOf(k) === -1 || k === series) return;
      series = k;
      try { localStorage.setItem(LS_SERIES, k); } catch (e) { }
      // 基準屬於某個系列。換系列後它既不適用，chip 也不在清單裡（＝沒得取消），
      // 留著會讓 topbar 顯示一個畫面上根本沒作用的套組，所以一併清掉。
      if (baseline && baseline.series !== k) {
        baseline = null;
        try { localStorage.setItem(LS_BASE, ''); } catch (e) { }
      }
      renderSeriesTabs();
      renderSetList();     // 清單只列目前系列的套組
      renderAll();
    }

    // 側鍵 / topbar 摘要都能開面板
    $('#setting-setlist').on('click', function () { setlistModal.open(); });
    $('#owned-wrap').on('click', '#owned-open', function () { setlistModal.open(); });

    $('#series-tabs').on('click', '.series-tab', function () { setSeries($(this).data('series') + ''); });
    $('#setlist').on('click', '.set-none', function () { setBaseline(''); });
    $('#setlist').on('click', '.size-chip', function () {
      var key = colKey($(this).data('line') + '', +$(this).data('size'));
      setBaseline(baseline && colKey(baseline.line, baseline.size) === key ? '' : key);
    });

    // 表頭的尺寸也能直接設為基準（再點一次取消）
    $('#matrix').on('click', '.c-size', function () {
      var col = matrices[series].columns[+$(this).data('col')];
      if (!col) return;
      var key = colKey(col.line, col.size);
      setBaseline(baseline && colKey(baseline.line, baseline.size) === key ? '' : key);
    });

    // 點色號回主網格並帶出該色
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
