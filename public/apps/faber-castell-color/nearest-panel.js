/**
 * nearest-panel — 最接近色側欄（index.html 與 sets.html 兩頁共用）
 *
 * **碰 DOM，所以不進 lib**；但兩頁都要用，所以也不留在任一控制器裡
 * （DESIGN_GUIDELINES §4.1 的第三種：跨頁共用但碰 DOM 的模組，同 colour-detail.js）。
 *
 * 為什麼是側欄不是 Modal：比對是「查一次、逐一讀」的動作——輸入 hex 得到一串候選，
 * 然後要一支一支點開看系列、耐光度、收錄套組，再回頭比較第二名和第三名。
 * Modal 一次只能站一個，點結果就得把查詢條件關掉。側欄常駐、明細 Modal 疊在它上面開，
 * 關掉明細就回到同一份清單並保留高亮。形制沿用 markdown-reader 的檔案清單側欄，
 * 與 caran-dache-color／copic-color 兩支色彩 registry 逐條對齊。
 *
 * 差異行為（點了結果要做什麼）用 onPick callback 交給呼叫端，模組不判斷「我在哪一頁」。
 *
 * 用法：FCNearest.init({ onPick: function (code) { … } });
 *       側鍵的 click 由各頁控制器綁 → FCNearest.open()
 */
(function (global, $) {
  'use strict';

  var Lib = global.FaberCastellCssLib;
  var ID = 'nearest-panel';
  var NEAR_N = 12;
  var ALL_SERIES = '*';
  // ΔE 級距的說法（lib 的 deltaEBand 只回代號）；文案與 caran-dache-color／copic-color
  // 的 band.* 逐字相同——三支用同一把尺、同一組級距，讀法也該一樣。
  var BAND_FB = { very: '極接近', close: '接近', noticeable: '可辨差異', far: '差異大' };

  var inst = null, opts = {};

  function t(key, fb) {
    if (!global.I18n || !global.I18n.t) return fb;
    var v = global.I18n.t(key);
    return (v && v !== key) ? v : fb;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function colors() { return global.FC_COLORS || []; }

  var MARKUP =
    '<li><a class="subheader"><i class="material-icons">colorize</i>' +
      '<span data-i18n="nearest.title">找最接近的 Faber-Castell 色</span></a></li>' +
    '<li><div class="divider"></div></li>' +
    '<li>' +
      '<div class="nearest-input-row">' +
        '<input type="color" id="nearest-picker" value="#95bb52" />' +
        '<input type="text" id="nearest-hex" value="#95bb52" maxlength="7" spellcheck="false" ' +
               'autocomplete="false" data-i18n-placeholder="nearest.placeholder" placeholder="#RRGGBB" />' +
        '<select id="nearest-series" class="browser-default"></select>' +
      '</div>' +
      '<div class="nearest-sub" data-i18n="nearest.sub"></div>' +
    '</li>' +
    '<li><div class="divider"></div></li>' +
    '<div id="nearest-results" class="nearest-results"></div>';

  // 選單上的數字要是**真的會被比到的色數**：nearestFC 排除金屬色（其 hex 是像素取樣的
  // 近似值），所以直接印 FC_META.series[].total（141／118）會與結果對不上，而使用者數得出來。
  function poolCount(series) {
    return colors().filter(function (c) {
      return c.hex && !Lib.isMetallic(c) &&
             (series === ALL_SERIES || (c.series || 'ag') === series);
    }).length;
  }

  // ⚠️ **UI 預設是全部系列，不是 lib 的 `ag`**——兩者的脈絡不同，別把它們對齊：
  //   - `nearestFC` 預設 `ag` 是為了**消費端**（color-palette／thangka-trace 問的是
  //     「該拿哪支筆」，不該推薦另一條 hobby 線的筆）。那個預設不動，見 DESIGN.md §8。
  //   - 但**在本 app 自己的側欄裡**，259 色全都攤在色彩牆上。輸入 707 的 hex `#194e8a`
  //     卻查不到 707（它是 Black Edition），只會讓人以為比對器壞了——它其實是被過濾掉的。
  //     照這個預設，`caran-dache-color`／`copic-color` 兩支也都是「全部」起手。
  // 故「全部系列」排在第一個並成為預設；要限定系列是**明示**的動作。
  function fillSeriesSelect() {
    var $sel = $('#nearest-series');
    if (!$sel.length) return;
    var keep = $sel.val();
    var meta = global.FC_META || {};
    var html = '<option value="' + ALL_SERIES + '">' +
               esc(t('nearest.allSeries', '全部系列')) + '（' + poolCount(ALL_SERIES) + '）</option>';
    html += (meta.series || []).map(function (s) {
      return '<option value="' + esc(s.key) + '">' + esc(s.label) +
             '（' + poolCount(s.key) + '）</option>';
    }).join('');
    $sel.html(html);
    if (keep) $sel.val(keep);      // 換語言重建選項時保住當下選擇
  }

  function render() {
    var $out = $('#nearest-results');
    if (!$out.length) return;
    var rgb = Lib.hexToRgb($('#nearest-hex').val().trim());
    $('#nearest-hex').toggleClass('invalid', !rgb);
    if (!rgb) {
      $out.html('<div class="nearest-empty">' + esc(t('nearest.invalid', '請輸入有效的 #rrggbb')) + '</div>');
      return;
    }
    var rows = Lib.nearestFC(rgb, {
      n: NEAR_N, series: $('#nearest-series').val() || undefined, colors: colors()
    });
    $out.html(rows.map(function (m) {
      var c = colors().filter(function (x) { return x.code === m.code; })[0] || m;
      var fg = Lib.pickTextColor(c);
      return '<div class="nearest-row" data-code="' + esc(m.code) + '">' +
        '<span class="nr-swatch" style="background:' + esc(m.hex) + ';color:' + fg + '">' +
          '<span class="nr-code">' + esc(m.code) + '</span></span>' +
        '<span class="nr-meta">' +
          '<span class="nr-name">' + esc(m.name) + '</span>' +
          '<span class="nr-sub"><span class="nr-hex">' + esc(m.hex) + '</span>' +
          '<span class="nr-de band-' + m.band + '">ΔE ' + m.deltaE.toFixed(1) + ' · ' +
          esc(t('band.' + m.band, BAND_FB[m.band])) + '</span></span>' +
        '</span>' +
      '</div>';
    }).join(''));
  }

  function ensure() {
    if (document.getElementById(ID)) return;
    var el = document.createElement('ul');
    el.id = ID;
    el.className = 'sidenav nearest-panel';
    el.style.width = '360px';
    el.innerHTML = MARKUP;
    document.body.appendChild(el);

    inst = M.Sidenav.init(el, {
      edge: 'right',
      // 側欄開啟時把整排側鍵淡出（共用 side-tool.css 的 body.sidenav-open）
      onOpenStart: function () { document.body.classList.add('sidenav-open'); },
      onCloseEnd: function () { document.body.classList.remove('sidenav-open'); }
    });

    $('#nearest-picker').on('input', function () { $('#nearest-hex').val(this.value); render(); });
    $('#nearest-hex').on('input', function () {
      var rgb = Lib.hexToRgb(this.value.trim());
      if (rgb) $('#nearest-picker').val('#' +
        ((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1));
      render();
    });
    $('#nearest-series').on('change', render);
    // 側欄不關：明細看完退回來還在同一份結果上，並留著剛才點過那列的高亮
    $('#nearest-results').on('click', '.nearest-row', function () {
      var $row = $(this);
      $('#nearest-results .nearest-row').removeClass('active');
      $row.addClass('active');
      if (opts.onPick) opts.onPick($row.attr('data-code'));
    });

    if (global.I18n && global.I18n.apply) global.I18n.apply(el);
  }

  function init(o) {
    opts = o || {};
    ensure();
    fillSeriesSelect();
    render();
  }

  function open() {
    ensure();
    render();
    inst.open();
  }

  // 切語言時重建（選單文字、分級標示）；側欄常駐，可能正開著
  function refresh() {
    if (!document.getElementById(ID)) return;
    if (global.I18n && global.I18n.apply) global.I18n.apply(document.getElementById(ID));
    fillSeriesSelect();
    render();
  }

  global.FCNearest = { init: init, open: open, refresh: refresh };
})(window, jQuery);
