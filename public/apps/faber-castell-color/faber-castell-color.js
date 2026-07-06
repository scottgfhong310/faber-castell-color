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

  var $grid, $noResult, $count, $search, detailModal, cssModal, current = null;
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
  var COPY_FORMATS = ['var', 'hex', 'rgb', 'class'];

  function openDetail(code) {
    var c = COLORS.filter(function (x) { return x.code === code; })[0];
    if (!c) return;
    current = c;
    var fg = Lib.pickTextColor(c);

    $('#detail-head').attr('style', 'background:' + c.hex + ';color:' + fg);
    $('#detail-code').text(c.code);
    $('#detail-approx').text(Lib.isMetallic(c) && window.I18n ? I18n.t('detail.approx') : '');
    $('#detail-name').text(c.name);
    $('#detail-note').text(noteLabel(c));

    // 複製鈕
    $('#detail-copy').html(COPY_FORMATS.map(function (fmt) {
      return '<button class="copy-btn" data-fmt="' + fmt + '">' +
        '<i class="material-icons">content_copy</i>' + esc(Lib.copyValue(c, fmt)) + '</button>';
    }).join(''));

    // 耐光度
    var lfRows = (META.lfLines || []).filter(function (l) { return c.lf && c.lf[l.key]; });
    if (lfRows.length) {
      $('#detail-lf').html(lfRows.map(function (l) {
        return '<tr><td>' + esc(l.label) + '</td><td class="lf-val">' + esc(c.lf[l.key]) + '</td></tr>';
      }).join(''));
      $('#detail-lf-sec').show();
    } else { $('#detail-lf-sec').hide(); }

    // 套組
    if (c.sets && Object.keys(c.sets).length) {
      $('#detail-sets').html(Object.keys(c.sets).map(function (line) {
        var sizes = c.sets[line].map(function (s) { return s + (window.I18n ? I18n.t('sets.ct') : ' ct'); }).join(' · ');
        return '<div class="set-line"><span class="line-name">' + esc(line) + '：</span>' +
               '<span class="sizes">' + esc(sizes) + '</span></div>';
      }).join(''));
      $('#detail-sets-sec').show();
    } else { $('#detail-sets-sec').hide(); }

    detailModal.open();
  }

  function noteLabel(c) {
    if (!window.I18n) return c.note || '';
    if (Lib.isMetallic(c)) return I18n.t('note.metallic');
    if (/pixel/i.test(c.note)) return I18n.t('note.pixel');
    if (/cross/i.test(c.note)) return I18n.t('note.crossValidated');
    return c.note || '';
  }

  // ---- 複製 ----------------------------------------------------------------
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy'); document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand'));
      } catch (e) { reject(e); }
    });
  }

  function flashCopied($btn, text) {
    copyText(text).then(function () {
      $btn.addClass('copied');
      setTimeout(function () { $btn.removeClass('copied'); }, 1200);
      M.toast({ html: I18n.t('toast.copied', { v: esc(text) }), classes: 'teal' });
    }).catch(function () {
      M.toast({ html: I18n.t('toast.copyFail'), classes: 'red' });
    });
  }

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
  function onI18n() {
    applyFilter();                 // 重繪計數
    if (current && detailModal && detailModal.isOpen) openDetail(current.code);
  }

  // ---- 啟動 ----------------------------------------------------------------
  $(function () {
    $grid = $('#grid'); $noResult = $('#no-result'); $count = $('#count'); $search = $('#search');

    detailModal = M.Modal.init(document.getElementById('detail-modal'), { dismissible: true });
    cssModal = M.Modal.init(document.getElementById('css-modal'), { dismissible: true });

    try { var sv = localStorage.getItem(LS_SORT); if (sv && Lib.SORT_MODES.indexOf(sv) !== -1) sortMode = sv; } catch (e) { }

    if (window.I18n) { I18n.apply(document); }
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    applyFilter();

    $search.on('input', applyFilter);
    $('#setting-sort').on('click', cycleSort);
    $grid.on('click', '.fc-cell', function () { openDetail($(this).data('code') + ''); });
    $('#detail-copy').on('click', '.copy-btn', function () {
      if (current) flashCopied($(this), Lib.copyValue(current, $(this).data('fmt')));
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
