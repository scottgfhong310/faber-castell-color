/**
 * faber-castell-color.js — 頁面控制器（碰 DOM）
 * 選元素、渲染色票網格、搜尋、點擊明細與複製、CSS 匯出、i18n 重繪、主題/語言切換。
 * 純邏輯（過濾 / 對比色 / 產生 CSS / 複製字串）在 FaberCastellCssLib。
 */
(function (window, $) {
  'use strict';

  var Lib = window.FaberCastellCssLib;
  var COLORS = window.FC_COLORS || [];
  var META = window.FC_META || {};
  var LS_THEME = 'faber-castell-color-theme';
  var LS_SORT = 'faber-castell-color-sort';

  var $grid, $noResult, $count, $search, cssModal, nearestPanel;
  var sortMode = 'code';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- 網格 ----------------------------------------------------------------
  function cellHtml(c) {
    var fg = Lib.pickTextColor(c);
    var badge = Lib.isMetallic(c) ? '<span class="badge" style="color:' + fg + '">&#8776;</span>' : '';
    return '<div class="fc-cell" data-code="' + esc(c.code) + '">' +
      '<div class="fc-swatch" style="background:' + esc(c.hex) + ';color:' + fg + '">' +
        '<span class="code">' + esc(c.code) + '</span>' + badge +
      '</div>' +
      '<div class="fc-meta">' +
        '<div class="name" title="' + esc(c.name) + '">' + esc(c.name) + '</div>' +
        '<div class="hex">' + esc(c.hex) + '</div>' +
      '</div>' +
    '</div>';
  }

  function groupedHtml(list) {
    var groups = [], cur = null;
    list.forEach(function (c) {
      var fam = Lib.colorFamily(c);
      if (!cur || cur.fam !== fam) { cur = { fam: fam, items: [] }; groups.push(cur); }
      cur.items.push(c);
    });
    return groups.map(function (g) {
      var label = window.I18n ? I18n.t('family.' + g.fam) : g.fam;
      return '<section class="fc-group">' +
        '<h2 class="fc-group-head">' + esc(label) + ' <span class="fc-group-n">' + g.items.length + '</span></h2>' +
        '<div class="fc-grid">' + g.items.map(cellHtml).join('') + '</div></section>';
    }).join('');
  }

  function render(list) {
    $grid.html(sortMode === 'family'
      ? groupedHtml(list)
      : '<div class="fc-grid">' + list.map(cellHtml).join('') + '</div>');
    $noResult.toggle(list.length === 0);
    $count.text(window.I18n ? I18n.t('count.showing', { n: list.length, total: COLORS.length })
                            : list.length + ' / ' + COLORS.length);
  }

  function applyFilter() {
    render(Lib.filter(Lib.sortColors(COLORS, sortMode), $search.val()));
  }

  function cycleSort() {
    var modes = Lib.SORT_MODES;
    sortMode = modes[(modes.indexOf(sortMode) + 1) % modes.length];
    try { localStorage.setItem(LS_SORT, sortMode); } catch (e) { }
    applyFilter();
    M.toast({ html: I18n.t('toast.sort', { m: I18n.t('sort.' + sortMode) }), classes: 'teal' });
  }

  // ---- 明細 Modal ----------------------------------------------------------
  // 渲染與複製都在共用模組 colour-detail.js（sets.html 也用同一支）。
  // 這裡只決定「點了套組尺寸要做什麼」：跳去對照頁並篩出該套組。
  function openDetail(code) { return window.FCDetail && FCDetail.open(code); }

  // ---- CSS 匯出 ------------------------------------------------------------
  function cssText() { return Lib.buildCss(COLORS); }

  function openCss() {
    $('#css-pre').text(cssText());
    cssModal.open();
  }

  function downloadCss() {
    var blob = new Blob([cssText()], { type: 'text/css' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = Lib.cssFilename();
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    M.toast({ html: I18n.t('toast.downloaded', { n: Lib.cssFilename() }), classes: 'green' });
  }

  // ---- 主題 / 語言 ---------------------------------------------------------
  function applyTheme(theme) {
    var r = document.documentElement;
    r.setAttribute('data-theme', theme);
    r.classList.toggle('dark-mode', theme === 'dark');
    r.classList.toggle('light-mode', theme === 'light');
    try { localStorage.setItem(LS_THEME, theme); } catch (e) { }
    $('#setting-mode i').text(theme === 'dark' ? 'dark_mode' : 'light_mode');
  }
  function toggleTheme() {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }

  // ---- i18n 重繪 -----------------------------------------------------------
  // CSS modal 的副標：色數由資料決定，含 <code> 標記故走 innerHTML
  function renderCssSub() {
    if (!window.I18n) return;
    $('#css-sub').html(I18n.t('css.sub', { n: COLORS.length }));
  }

  // ---- 最接近色側欄（nearestFC） --------------------------------------------
  //
  // 比對器一直在 lib 裡但沒有入口；做成側欄而不是 Modal，是因為比對是
  // 「查一次、逐一讀」的動作：Modal 一次只能站一個，點結果就得把查詢條件關掉。
  // 側欄常駐，明細 Modal 疊在它上面開，關掉即回到同一份清單並保留高亮。

  var NEAR_N = 12;
  var ALL_SERIES = '*';
  // ΔE 級距的說法（lib 的 deltaEBand 只回代號）；文案與 caran-dache-color／copic-color
  // 的 band.* 逐字相同——三支用同一把尺、同一組級距，讀法也該一樣。
  var BAND_FB = { very: '極接近', close: '接近', noticeable: '可辨差異', far: '差異大' };

  function T(key, fb) {
    if (!window.I18n || !I18n.t) return fb;
    var v = I18n.t(key);
    return (v && v !== key) ? v : fb;
  }

  // 選單上的數字要是**真的會被比到的色數**：nearestFC 排除金屬色（其 hex 是像素取樣的
  // 近似值），所以直接印 FC_META.series[].total（141／118）會與結果對不上。
  function poolCount(series) {
    return COLORS.filter(function (c) {
      return c.hex && !Lib.isMetallic(c) &&
             (series === ALL_SERIES || (c.series || 'ag') === series);
    }).length;
  }

  function fillSeriesSelect() {
    var $sel = $('#nearest-series');
    var keep = $sel.val();
    var html = (META.series || []).map(function (s) {
      return '<option value="' + esc(s.key) + '">' + esc(s.label) +
             '（' + poolCount(s.key) + '）</option>';
    }).join('');
    html += '<option value="' + ALL_SERIES + '">' +
            esc(T('nearest.allSeries', '全部系列')) + '（' + poolCount(ALL_SERIES) + '）</option>';
    $sel.html(html);
    if (keep) $sel.val(keep);      // 換語言重建選項時保住當下選擇
  }

  function renderNearest() {
    var rgb = Lib.hexToRgb($('#nearest-hex').val().trim());
    $('#nearest-hex').toggleClass('invalid', !rgb);
    if (!rgb) {
      $('#nearest-results').html('<div class="nearest-empty">' +
        esc(T('nearest.invalid', '請輸入有效的 #rrggbb')) + '</div>');
      return;
    }
    var rows = Lib.nearestFC(rgb, { n: NEAR_N, series: $('#nearest-series').val() || undefined, colors: COLORS });
    $('#nearest-results').html(rows.map(function (m) {
      var c = COLORS.filter(function (x) { return x.code === m.code; })[0] || m;
      var fg = Lib.pickTextColor(c);
      return '<div class="nearest-row" data-code="' + esc(m.code) + '">' +
        '<span class="nr-swatch" style="background:' + esc(m.hex) + ';color:' + fg + '">' +
          '<span class="nr-code">' + esc(m.code) + '</span></span>' +
        '<span class="nr-meta">' +
          '<span class="nr-name">' + esc(m.name) + '</span>' +
          '<span class="nr-sub"><span class="nr-hex">' + esc(m.hex) + '</span>' +
          '<span class="nr-de band-' + m.band + '">ΔE ' + m.deltaE.toFixed(1) + ' · ' +
          esc(T('band.' + m.band, BAND_FB[m.band])) + '</span></span>' +
        '</span>' +
      '</div>';
    }).join(''));
  }

  function onI18n() {
    applyFilter();                 // 重繪計數
    renderCssSub();
    if (window.FCDetail) FCDetail.refresh();
    // 側欄常駐、可能正開著：選單與分級標示都要跟著重建
    fillSeriesSelect();
    renderNearest();
  }

  // ---- 啟動 ----------------------------------------------------------------
  $(function () {
    $grid = $('#grid'); $noResult = $('#no-result'); $count = $('#count'); $search = $('#search');

    FCDetail.init({
      onSetClick: function (line, size) {
        // 另開分頁：色彩牆留在原分頁，方便兩邊對照。
        // 若被瀏覽器擋掉（window.open 回 null）就退回同分頁開，別讓點擊沒反應。
        // ⚠️ 不加 'noopener'：這是同源的自家頁，留著 opener，sets.html 的「回色票網格」
        // 才關得掉自己並回到**開啟它的那一個**色票牆（篩選與捲動位置都還在）。
        var url = './sets.html?set=' + encodeURIComponent(line + '|' + size);
        var w = window.open(url, '_blank');
        if (!w) window.location.href = url;
      }
    });
    cssModal = M.Modal.init(document.getElementById('css-modal'), { dismissible: true });

    try { var sv = localStorage.getItem(LS_SORT); if (sv && Lib.SORT_MODES.indexOf(sv) !== -1) sortMode = sv; } catch (e) { }

    if (window.I18n) { I18n.apply(document); }
    renderCssSub();
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    applyFilter();

    // 深連結 ?code=NNN：從套組收錄對照頁點色號回來時，直接打開該色明細
    var q = /[?&]code=([^&]+)/.exec(window.location.search);
    if (q) {
      var code = decodeURIComponent(q[1]);
      if (COLORS.some(function (c) { return c.code === code; })) openDetail(code);
    }

    $search.on('input', applyFilter);
    $('#setting-sort').on('click', cycleSort);
    $grid.on('click', '.fc-cell', function () { openDetail($(this).data('code') + ''); });

    // 最接近色側欄
    nearestPanel = M.Sidenav.init(document.getElementById('nearest-panel'), {
      edge: 'right',
      // 側欄開啟時把整排側鍵淡出（共用 side-tool.css 的 body.sidenav-open）
      onOpenStart: function () { document.body.classList.add('sidenav-open'); },
      onCloseEnd: function () { document.body.classList.remove('sidenav-open'); }
    });
    fillSeriesSelect();
    $('#setting-nearest').on('click', function () { renderNearest(); nearestPanel.open(); });
    $('#nearest-picker').on('input', function () { $('#nearest-hex').val(this.value); renderNearest(); });
    $('#nearest-hex').on('input', function () {
      var rgb = Lib.hexToRgb(this.value.trim());
      if (rgb) $('#nearest-picker').val('#' +
        ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1));
      renderNearest();
    });
    $('#nearest-series').on('change', renderNearest);
    // 側欄不關：明細看完退回來還在同一份結果上，並留著剛才點過那列的高亮
    $('#nearest-results').on('click', '.nearest-row', function () {
      var $row = $(this);
      $('#nearest-results .nearest-row').removeClass('active');
      $row.addClass('active');
      openDetail($row.attr('data-code'));
    });

    // 明細裡的尺寸可點 → 到套組收錄對照頁，並以該套組為基準
    $('#detail-sets').on('click', '.size-link', function () {
      window.location.href = './sets.html?set=' +
        encodeURIComponent($(this).data('line') + '|' + $(this).data('size'));
    });

    // 「套組收錄對照」另開分頁：用 window.open 而不是讓 anchor 自己開——anchor 的
    // target="_blank" 自 Chrome 88 起隱含 noopener，子頁拿不到 opener、關不掉自己，
    // 而 sets.html 的「回色票網格」要能回到**開啟它的這一個**分頁。
    $('#setting-sets').on('click', function (e) {
      e.preventDefault();
      var url = $(this).attr('href');
      if (!window.open(url, '_blank')) window.location.href = url;
    });

    $('#setting-css').on('click', openCss);
    $('#setting-download').on('click', downloadCss);
    $('#css-copy').on('click', function () {
      copyText(cssText()).then(function () { M.toast({ html: I18n.t('toast.cssCopied'), classes: 'teal' }); })
        .catch(function () { M.toast({ html: I18n.t('toast.copyFail'), classes: 'red' }); });
    });
    $('#css-download').on('click', downloadCss);

    $('#setting-mode').on('click', toggleTheme);
    $('#setting-lang').on('click', function () {
      var next = I18n.cycle();
      M.toast({ html: I18n.t('toast.lang', { name: I18n.name(next) }), classes: 'teal' });
    });

    document.addEventListener('i18n:changed', onI18n);
  });
})(window, jQuery);
