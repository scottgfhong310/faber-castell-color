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

  var $grid, $noResult, $count, $search, detailModal, cssModal, setsModal, current = null;
  var sortMode = 'code';
  var currentSet = null;          // 套組瀏覽選中的 { line, size }；null＝尚未選

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
    $('#detail-series').text(seriesLabel(c));
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

    // 套組（每個尺寸都可點 → 反方向開套組瀏覽）
    if (c.sets && Object.keys(c.sets).length) {
      $('#detail-sets').html(Object.keys(c.sets).map(function (line) {
        var sizes = c.sets[line].map(function (s) {
          return '<button class="size-link" data-line="' + esc(line) + '" data-size="' + s + '">' +
            s + (window.I18n ? I18n.t('sets.ct') : ' ct') + '</button>';
        }).join(' · ');
        return '<div class="set-line"><span class="line-name">' + esc(line) + '：</span>' +
               '<span class="sizes">' + sizes + '</span></div>';
      }).join(''));
      $('#detail-sets-sec').show();
    } else { $('#detail-sets-sec').hide(); }

    detailModal.open();
  }

  function noteLabel(c) {
    if (!window.I18n) return c.note || '';
    if (Lib.isMetallic(c)) return I18n.t('note.metallic');
    if (/vector/i.test(c.note)) return I18n.t('note.vector');
    if (/pixel/i.test(c.note)) return I18n.t('note.pixel');
    if (/cross/i.test(c.note)) return I18n.t('note.crossValidated');
    return c.note || '';
  }

  // 色票屬哪個系列（各有自己的權威色卡）；資料無 series 欄位時視為 'ag'
  function seriesLabel(c) {
    var key = c.series || 'ag';
    var s = (META.series || []).filter(function (x) { return x.key === key; })[0];
    if (!s) return '';
    return window.I18n ? I18n.t('series.' + key, { source: s.source }) : s.label;
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

  // ---- 套組瀏覽 Modal（套組 → 顏色）----------------------------------------
  // 明細 Modal 回答「這個色在哪些套組」，這裡回答反方向「這個套組收哪些色」。
  // 補集的偽 line 名。產品線都是人看的商品名（'Polychromos colour pencils'…），故不會撞名。
  // **別用開頭是空白的 sentinel**——寫進 data-* 再讀回來前導空白會被吃掉，比對就永遠不中。
  var NO_SET = '__none__';

  // 標題只印一次數字：一般套組的尺寸就是色數，補集則以實際筆數代之。
  function setLabel(line, size, n) {
    var ct = window.I18n ? I18n.t('sets.ct') : ' ct';
    // 補集的數字交給 i18n 字串自己排（'ct' 是套組尺寸的單位，用在這裡語意不對）。
    // n 有值＝明細標題（含筆數）；無值＝清單列的純標籤。
    if (line === NO_SET) {
      if (!window.I18n) return 'Not in any set';
      return n == null ? I18n.t('sets.none') : I18n.t('sets.noneHead', { n: n });
    }
    return line + ' · ' + size + ct;
  }

  function setsColors(sel) {
    return sel.line === NO_SET ? Lib.colorsWithoutSet(COLORS)
                               : Lib.colorsInSet(COLORS, sel.line, sel.size);
  }

  function renderSetsList() {
    var idx = Lib.setIndex(COLORS);
    var html = idx.map(function (L) {
      var chips = L.sizes.map(function (s) {
        var on = currentSet && currentSet.line === L.line && currentSet.size === s.size;
        // 尺寸就是色數（12 色套組收 12 色），所以平常只印尺寸；
        // 兩者不符代表資料壞了，這時才把實際色數顯出來，別讓它靜靜地錯。
        var n = s.count === s.size ? '' : '<span class="set-chip-n">' + s.count + '</span>';
        return '<button class="set-chip' + (on ? ' is-on' : '') + (n ? ' is-odd' : '') + '"' +
          ' data-line="' + esc(L.line) + '" data-size="' + s.size + '">' +
          s.size + n + '</button>';
      }).join('');
      return '<div class="set-line-row">' +
        '<div class="set-line-name">' + esc(L.line) + '</div>' +
        '<div class="set-chips">' + chips + '</div></div>';
    }).join('');

    // 補集：不屬於任何套組的色，讓各套組色數與總數對得起來
    var none = Lib.colorsWithoutSet(COLORS);
    if (none.length) {
      var onNone = currentSet && currentSet.line === NO_SET;
      html += '<div class="set-line-row is-none">' +
        '<div class="set-line-name">' + esc(setLabel(NO_SET)) + '</div>' +
        '<div class="set-chips"><button class="set-chip' + (onNone ? ' is-on' : '') + '"' +
        // 這裡的數字是正常的筆數，不是異常警訊，故**不能**用 .set-chip-n（那個帶 ≠ 前綴）
        ' data-line="' + esc(NO_SET) + '" data-size="0">' + none.length + '</button></div></div>';
    }
    $('#sets-list').html(html);

    $('#sets-sub').text(window.I18n
      ? I18n.t('sets.sub', { lines: idx.length, combos: idx.reduce(function (a, L) { return a + L.sizes.length; }, 0) })
      : idx.length + ' lines');
  }

  function renderSetsDetail() {
    var $d = $('#sets-detail');
    if (!currentSet) {
      $d.html('<div class="sets-hint">' +
        esc(window.I18n ? I18n.t('sets.pick') : 'Pick a set above') + '</div>');
      return;
    }
    var list = setsColors(currentSet);
    var swatches = list.map(function (c) {
      var fg = Lib.pickTextColor(c);
      var badge = Lib.isMetallic(c) ? '<span class="badge">&#8776;</span>' : '';
      return '<button class="set-swatch" data-code="' + esc(c.code) + '"' +
        ' title="' + esc(c.code + ' ' + c.name) + '"' +
        ' style="background:' + esc(c.hex) + ';color:' + fg + '">' +
        esc(c.code) + badge + '</button>';
    }).join('');
    // 與 chip 同一條規則：實際筆數與尺寸不符才把數字顯出來（資料異常的警訊）
    var odd = currentSet.line !== NO_SET && list.length !== currentSet.size
      ? '<span class="sets-detail-n">' + list.length + '</span>' : '';
    $d.html('<div class="sets-detail-head">' +
        esc(setLabel(currentSet.line, currentSet.size, list.length)) + odd + '</div>' +
      '<div class="set-swatches">' + swatches + '</div>');
  }

  function openSets(sel) {
    currentSet = sel || currentSet;
    renderSetsList();
    renderSetsDetail();
    setsModal.open();
  }

  // ---- i18n 重繪 -----------------------------------------------------------
  // CSS modal 的副標：色數由資料決定，含 <code> 標記故走 innerHTML
  function renderCssSub() {
    if (!window.I18n) return;
    $('#css-sub').html(I18n.t('css.sub', { n: COLORS.length }));
  }

  function onI18n() {
    applyFilter();                 // 重繪計數
    renderCssSub();
    if (setsModal && setsModal.isOpen) { renderSetsList(); renderSetsDetail(); }
    if (current && detailModal && detailModal.isOpen) openDetail(current.code);
  }

  // ---- 啟動 ----------------------------------------------------------------
  $(function () {
    $grid = $('#grid'); $noResult = $('#no-result'); $count = $('#count'); $search = $('#search');

    detailModal = M.Modal.init(document.getElementById('detail-modal'), { dismissible: true });
    cssModal = M.Modal.init(document.getElementById('css-modal'), { dismissible: true });
    setsModal = M.Modal.init(document.getElementById('sets-modal'), { dismissible: true });

    try { var sv = localStorage.getItem(LS_SORT); if (sv && Lib.SORT_MODES.indexOf(sv) !== -1) sortMode = sv; } catch (e) { }

    if (window.I18n) { I18n.apply(document); }
    renderCssSub();
    applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    applyFilter();

    $search.on('input', applyFilter);
    $('#setting-sort').on('click', cycleSort);
    $grid.on('click', '.fc-cell', function () { openDetail($(this).data('code') + ''); });
    $('#detail-copy').on('click', '.copy-btn', function () {
      if (current) flashCopied($(this), Lib.copyValue(current, $(this).data('fmt')));
    });

    // 套組瀏覽：側鍵開啟；點尺寸換套組；點色票跳去該色明細（同時只開一個 Modal）
    $('#setting-sets').on('click', function () { openSets(); });
    $('#sets-list').on('click', '.set-chip', function () {
      currentSet = { line: $(this).data('line') + '', size: +$(this).data('size') };
      renderSetsList();
      renderSetsDetail();
    });
    $('#sets-detail').on('click', '.set-swatch', function () {
      var code = $(this).data('code') + '';
      setsModal.close();
      openDetail(code);
    });
    // 反方向：明細裡的尺寸可點回套組瀏覽
    $('#detail-sets').on('click', '.size-link', function () {
      var sel = { line: $(this).data('line') + '', size: +$(this).data('size') };
      detailModal.close();
      openSets(sel);
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
