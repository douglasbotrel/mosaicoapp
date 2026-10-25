/* Utilitários de interface */
(function (root) {
  'use strict';
  var U = {};
  U.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'value') el.value = v; else if (v === true) el.setAttribute(k, ''); else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) U.add(el, arguments[i]);
    return el;
  };
  U.add = function (el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(function (x) { U.add(el, x); }); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); };
  U.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  U.toast = function (msg, ms) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.className = 'toast show'; clearTimeout(U._tt); U._tt = setTimeout(function () { t.className = 'toast'; }, ms || 2600);
  };
  U.sheet = function (titulo, corpo, botoes) {
    var back = U.h('div', { class: 'sheet-back' }), sh = U.h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
    var close = function () { back.remove(); document.body.classList.remove('noscroll'); };
    sh.appendChild(U.h('div', { class: 'sheet-head' }, U.h('h2', { text: titulo }), U.h('button', { class: 'ico', 'aria-label': 'Fechar', text: '×', onclick: function () { close(); if (out.onclose) out.onclose(); } })));
    var bd = U.h('div', { class: 'sheet-body' }, corpo); sh.appendChild(bd);
    if (botoes) sh.appendChild(U.h('div', { class: 'sheet-foot' }, botoes));
    back.appendChild(sh); document.body.appendChild(back); document.body.classList.add('noscroll');
    var out = { el: sh, body: bd, close: close, onclose: null };
    return out;
  };
  U.confirmar = function (titulo, texto, rotOk, perigo) {
    return new Promise(function (res) {
      var s = U.sheet(titulo, U.h('p', { text: texto }), [
        U.h('button', { class: 'btn', text: 'Cancelar', onclick: function () { s.close(); res(false); } }),
        U.h('button', { class: 'btn ' + (perigo ? 'danger' : 'primary'), text: rotOk || 'Confirmar', onclick: function () { s.close(); res(true); } })]);
      s.onclose = function () { res(false); };
    });
  };
  U.fmtData = function (iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  U.fmtBytes = function (n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; };
  U.fmtNum = function (n, d) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d || 0, maximumFractionDigits: d == null ? 2 : d }); };
  U.baixar = function (nome, u8, tipo) {
    var blob = new Blob([u8], { type: tipo || 'application/octet-stream' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  };
  U.debounce = function (fn, ms) { var t; var f = function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; f.flush = function () { clearTimeout(t); }; return f; };
  root.MOSAICO_UI = U;
})(typeof self !== 'undefined' ? self : this);
