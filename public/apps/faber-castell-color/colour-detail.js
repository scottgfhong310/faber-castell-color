/**
 * colour-detail.js — 色票明細 Modal（本 app 兩頁共用的 UI 模組）
 * =========================================================================
 * IIFE → window.FCDetail。碰 DOM，故不放進 lib（§4.1 的界線）；但兩頁都要用，
 * 所以也不該留在任一頁的控制器裡——`index.html` 與 `sets.html` 各自複製一份
 * 渲染邏輯是最糟的做法（改一次要記得改兩處）。
 *
 * 它負責：注入 Modal markup、把一個 Color 渲染進去、四種格式複製、開啟。
 * 它不負責：資料從哪來、點了套組尺寸要做什麼（由呼叫端以 onSetClick 決定
 * ——在 index 是跳去 sets.html，在 sets.html 是就地套用篩選）。
 *
 * 用法：
 *   FCDetail.init({ onSetClick: function (line, size) { … } });
 *   FCDetail.open('137');
 */
(function (window, $) {
  'use strict';

  var Lib = window.FaberCastellCssLib;
  var COPY_FORMATS = ['var', 'hex', 'rgb', 'class'];
  var modal = null, current = null, opts = {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function t(key, params) { return window.I18n ? I18n.t(key, params) : key; }

  var MARKUP =
    '<div id="detail-modal" class="modal detail-modal">' +
      '<div class="modal-content">' +
        '<div id="detail-head" class="detail-head">' +
          '<span class="d-code" id="detail-code"></span>' +
          '<span class="d-approx" id="detail-approx"></span>' +
        '</div>' +
        '<div class="detail-body">' +
          '<div class="d-name" id="detail-name"></div>' +
          '<div class="d-series" id="detail-series"></div>' +
          '<div class="d-note" id="detail-note"></div>' +
          '<div class="copy-row" id="detail-copy"></div>' +
          '<div class="d-section" id="detail-lf-sec">' +
            '<h6 data-i18n="detail.lightfastness">耐光度</h6>' +
            '<table class="lf-table"><tbody id="detail-lf"></tbody></table>' +
          '</div>' +
          '<div class="d-section" id="detail-sets-sec">' +
            '<h6 data-i18n="detail.sets">套組收錄</h6>' +
            '<div id="detail-sets"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<a href="#!" class="modal-close waves-effect btn-flat" data-i18n="detail.close">關閉</a>' +
      '</div>' +
    '</div>';

  // hex 是怎麼來的——把 note 對應到人話（三語）
  function noteLabel(c) {
    if (!window.I18n) return c.note || '';
    if (Lib.isMetallic(c)) return t('note.metallic');
    if (/vector/i.test(c.note)) return t('note.vector');
    if (/pixel/i.test(c.note)) return t('note.pixel');
    if (/cross/i.test(c.note)) return t('note.crossValidated');
    return c.note || '';
  }

  // 色票屬哪個系列（各有自己的權威色卡）；資料無 series 欄位時視為 'ag'
  function seriesLabel(c) {
    var META = window.FC_META || {};
    var key = c.series || 'ag';
    var s = (META.series || []).filter(function (x) { return x.key === key; })[0];
    if (!s) return '';
    return window.I18n ? t('series.' + key, { source: s.source }) : s.label;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {          // 非 HTTPS/localhost 的回退
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
      M.toast({ html: t('toast.copied', { v: esc(text) }), classes: 'teal' });
    }).catch(function () {
      M.toast({ html: t('toast.copyFail'), classes: 'red' });
    });
  }

  function render(c) {
    var META = window.FC_META || {};
    var fg = Lib.pickTextColor(c);

    $('#detail-head').attr('style', 'background:' + c.hex + ';color:' + fg);
    $('#detail-code').text(c.code);
    $('#detail-approx').text(Lib.isMetallic(c) && window.I18n ? t('detail.approx') : '');
    $('#detail-name').text(c.name);
    $('#detail-series').text(seriesLabel(c));
    $('#detail-note').text(noteLabel(c));

    $('#detail-copy').html(COPY_FORMATS.map(function (fmt) {
      return '<button class="copy-btn" data-fmt="' + fmt + '">' +
        '<i class="material-icons">content_copy</i>' + esc(Lib.copyValue(c, fmt)) + '</button>';
    }).join(''));

    var lfRows = (META.lfLines || []).filter(function (l) { return c.lf && c.lf[l.key]; });
    if (lfRows.length) {
      $('#detail-lf').html(lfRows.map(function (l) {
        return '<tr><td>' + esc(l.label) + '</td><td class="lf-val">' + esc(c.lf[l.key]) + '</td></tr>';
      }).join(''));
      $('#detail-lf-sec').show();
    } else { $('#detail-lf-sec').hide(); }

    if (c.sets && Object.keys(c.sets).length) {
      $('#detail-sets').html(Object.keys(c.sets).map(function (line) {
        var sizes = c.sets[line].map(function (s) {
          return '<button class="size-link" data-line="' + esc(line) + '" data-size="' + s + '">' +
            s + t('sets.ct') + '</button>';
        }).join(' · ');
        return '<div class="set-line"><span class="line-name">' + esc(line) + '：</span>' +
               '<span class="sizes">' + sizes + '</span></div>';
      }).join(''));
      $('#detail-sets-sec').show();
    } else { $('#detail-sets-sec').hide(); }
  }

  function init(o) {
    opts = o || {};
    if (!document.getElementById('detail-modal')) $('body').append(MARKUP);
    modal = M.Modal.init(document.getElementById('detail-modal'), { dismissible: true });

    $('#detail-copy').on('click', '.copy-btn', function () {
      if (current) flashCopied($(this), Lib.copyValue(current, $(this).data('fmt')));
    });
    $('#detail-sets').on('click', '.size-link', function () {
      if (!opts.onSetClick) return;
      var line = $(this).data('line') + '', size = +$(this).data('size');
      modal.close();
      opts.onSetClick(line, size);
    });
    return FCDetail;
  }

  function open(code) {
    var colors = window.FC_COLORS || [];
    var c = colors.filter(function (x) { return x.code === String(code); })[0];
    if (!c || !modal) return false;
    current = c;
    // 先套 i18n（只會動 modal 內的 data-i18n 標題），再填資料欄位
    if (window.I18n) I18n.apply(document.getElementById('detail-modal'));
    render(c);
    modal.open();
    return true;
  }

  // 語言切換時，若明細開著就重繪（色名是資料不翻譯，但註記與系列說明要跟著換）
  function refresh() { if (current && modal && modal.isOpen) open(current.code); }

  var FCDetail = { init: init, open: open, refresh: refresh,
    isOpen: function () { return !!(modal && modal.isOpen); },
    currentCode: function () { return current ? current.code : null; } };
  window.FCDetail = FCDetail;
})(window, jQuery);
