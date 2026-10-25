/* Motor do formulário: gera os campos a partir do esquema. */
(function (root) {
  'use strict';
  var h = root.MOSAICO_UI.h, U = root.MOSAICO_UI, C = root.MOSAICO_CORE, V = root.MOSAICO_VALIDAR, G = root.MOSAICO_GPS;
  var F = {};

  function chips(opts, sel, multi, onPick) {
    var wrap = h('div', { class: 'chips', role: multi ? 'group' : 'radiogroup' });
    opts.forEach(function (o) {
      var on = multi ? (sel || []).indexOf(o[0]) >= 0 : sel === o[0];
      wrap.appendChild(h('button', { type: 'button', class: 'chip' + (on ? ' on' : ''), role: multi ? 'checkbox' : 'radio', 'aria-checked': on ? 'true' : 'false', text: o[1], 'data-v': o[0], onclick: function () { onPick(o[0]); } }));
    });
    return wrap;
  }
  function fmtGps(v) { return v.lat.toFixed(6) + ', ' + v.lon.toFixed(6) + '  (±' + Math.round(v.acc || 0) + ' m' + (v.n ? ', ' + v.n + ' leituras' : '') + ')'; }
  F.fmtGps = fmtGps;

  /* captura de ponto em folha */
  F.capturarPontoUI = function (titulo) {
    return new Promise(function (res) {
      var info = h('div', { class: 'gps-live', 'aria-live': 'polite', text: 'Aguardando sinal…' }), bar = h('div', { class: 'bar' }, h('i')), job, feito = false;
      var manual = h('div', { class: 'manual', hidden: true });
      var s = U.sheet(titulo, [h('p', { class: 'dim', text: 'Fique parado no ponto. O app junta várias leituras e calcula a média.' }), info, bar, manual], [
        h('button', { class: 'btn', text: 'Cancelar', onclick: function () { feito = true; if (job) job.cancelar(); s.close(); res(null); } }),
        h('button', { class: 'btn', text: 'Digitar coordenadas', onclick: function () { feito = true; if (job) job.cancelar(); abrirManual(); } }),
        h('button', { class: 'btn primary', text: 'Usar agora', onclick: function () { if (job) job.cancelar(); } })]);
      s.onclose = function () { if (!feito) { feito = true; if (job) job.cancelar(); res(null); } };
      function abrirManual() {
        U.clear(manual); manual.hidden = false;
        var la = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Latitude (-18.123456)', 'aria-label': 'Latitude' }), lo = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Longitude (-43.123456)', 'aria-label': 'Longitude' });
        manual.appendChild(h('div', { class: 'field' }, la)); manual.appendChild(h('div', { class: 'field' }, lo));
        manual.appendChild(h('button', { class: 'btn primary', text: 'Salvar coordenadas', onclick: function () {
          var a = parseFloat(String(la.value).replace(',', '.')), b = parseFloat(String(lo.value).replace(',', '.'));
          if (isNaN(a) || isNaN(b) || Math.abs(a) > 90 || Math.abs(b) > 180) { U.toast('Coordenadas inválidas'); return; }
          s.close(); res({ lat: a, lon: b, acc: 0, n: 0, manual: true, t: Date.now() });
        } }));
      }
      if (!G.suportado()) { info.textContent = 'Este aparelho não oferece GPS ao navegador.'; abrirManual(); return; }
      job = G.capturarPonto({ onProg: function (f, n, rest) {
        if (f) info.textContent = 'Precisão atual: ±' + Math.round(f.acc) + ' m · leituras: ' + n;
        bar.firstChild.style.width = Math.min(100, 100 - rest / 250) + '%';
      } });
      job.then(function (m) { if (feito) return; feito = true; s.close(); res(m); }, function (e) {
        if (feito) return; feito = true;
        info.textContent = e && e.code ? G.erroTexto(e) : (e && e.message === 'cancelado' ? 'Cancelado' : (e && e.message) || 'Falha no GPS');
        info.className = 'gps-live err'; manual.hidden = true; abrirManual();
      });
    });
  };

  F.renderCampo = function (campo, st, opts) {
    opts = opts || {};
    var key = st.pre + campo.id, v = st.get(campo.id), nd = st.getNd(campo.id);
    var wrap = h('div', { class: 'field f-' + campo.t, 'data-key': key });
    var forInput = ['text', 'number', 'date', 'textarea'].indexOf(campo.t) >= 0 || (campo.t === 'select' && campo.opts.length > 8);
    var lab = h(forInput ? 'label' : 'div', { class: 'lab', id: 'lab-' + key, 'for': forInput ? 'in-' + key : null }, campo.rot, campo.req ? h('span', { class: 'req', 'aria-label': 'obrigatório', text: ' *' }) : null, campo.un ? h('span', { class: 'un', text: ' (' + campo.un + ')' }) : null);
    var ctl;
    var set = function (x, rer) { st.set(campo.id, x, rer); };
    if (campo.t === 'text' || campo.t === 'number' || campo.t === 'date') {
      var inp = h('input', { id: 'in-' + key, type: campo.t === 'number' ? 'number' : (campo.t === 'date' ? 'date' : 'text'), value: v == null ? '' : v,
        inputmode: campo.inputmode || (campo.t === 'number' ? 'decimal' : null), step: campo.step || (campo.t === 'number' ? 'any' : null), min: campo.min, max: campo.max, placeholder: campo.ph || '',
        autocomplete: 'off', autocapitalize: campo.fmt ? 'characters' : 'sentences', enterkeyhint: 'next' });
      inp.addEventListener('input', function () {
        var x = inp.value;
        if (campo.fmt === 'cpf') { x = C.fmtCpf(x); inp.value = x; } else if (campo.fmt === 'tel') { x = C.fmtTel(x); inp.value = x; }
        else if (campo.fmt === 'car') { x = x.toUpperCase(); inp.value = x; }
        set(campo.t === 'number' ? (x === '' ? null : Number(x)) : x, false);
      });
      if (campo.t === 'number') inp.addEventListener('wheel', function () { inp.blur(); });
      ctl = h('div', { class: 'inwrap' }, inp);
      if (campo.fromTrack) { /* botão para recalcular a partir da trilha */ }
    } else if (campo.t === 'textarea') {
      var ta = h('textarea', { id: 'in-' + key, rows: 3, value: v == null ? '' : v, placeholder: campo.ph || '' });
      ta.addEventListener('input', function () { set(ta.value, false); }); ctl = ta;
    } else if (campo.t === 'select') {
      if (campo.opts.length <= 8) ctl = chips(campo.opts, v, false, function (x) { set(v === x ? null : x, true); });
      else { var sel = h('select', { id: 'in-' + key }, h('option', { value: '', text: 'Escolher…' }), campo.opts.map(function (o) { return h('option', { value: o[0], text: o[1], selected: v === o[0] }); })); sel.addEventListener('change', function () { set(sel.value || null, true); }); ctl = sel; }
    } else if (campo.t === 'multi') {
      ctl = chips(campo.opts, v || [], true, function (x) {
        var a = (v || []).slice(), i = a.indexOf(x), ex = x === 'nenhum' || x === 'nenhuma';
        if (i >= 0) a.splice(i, 1); else { if (ex) a = [x]; else { a = a.filter(function (y) { return y !== 'nenhum' && y !== 'nenhuma'; }); a.push(x); } }
        set(a, true);
      });
    } else if (campo.t === 'bool3') {
      ctl = chips([['sim', 'Sim'], ['nao', 'Não'], ['ns', 'Não sei']], v, false, function (x) { set(v === x ? null : x, true); });
    } else if (campo.t === 'gps') {
      ctl = h('div', { class: 'gpsbox' });
      if (v) {
        ctl.appendChild(h('div', { class: 'gpsval' + ((v.acc > 30) ? ' warn' : ''), text: fmtGps(v) }));
        ctl.appendChild(h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', text: 'Refazer', onclick: function () { F.capturarPontoUI(campo.rot).then(function (p) { if (p) set(p, true); }); } }),
          h('button', { type: 'button', class: 'btn', text: 'Apagar', onclick: function () { set(null, true); } })));
      } else ctl.appendChild(h('button', { type: 'button', class: 'btn big primary', text: '📍 Marcar ponto aqui', onclick: function () { F.capturarPontoUI(campo.rot).then(function (p) { if (p) set(p, true); }); } }));
    } else if (campo.t === 'track') {
      ctl = F.renderTrilha(campo, v, set, st);
    } else if (campo.t === 'repeat') {
      ctl = F.renderRepeat(campo, v || [], set, st);
    }
    if (ctl.classList && ctl.classList.contains('chips')) ctl.setAttribute('aria-labelledby', 'lab-' + key);
    wrap.appendChild(lab); wrap.appendChild(ctl);
    if (campo.sens && !opts.semNd) {
      wrap.appendChild(h('button', { type: 'button', class: 'nd' + (nd ? ' on' : ''), text: nd ? '✓ Prefere não informar' : 'Prefere não informar', onclick: function () { st.setNd(campo.id, !nd); } }));
    }
    wrap.appendChild(h('div', { class: 'msg', 'aria-live': 'polite' }));
    return wrap;
  };

  F.jobs = {};
  F.pararTodos = function () { Object.keys(F.jobs).forEach(function (k) { try { F.jobs[k].parar(); } catch (e) {} delete F.jobs[k]; }); };
  F.renderTrilha = function (campo, v, set, st) {
    var jkey = (st.vid || '') + '|' + st.pre + campo.id, job = F.jobs[jkey] || null;
    var box = h('div', { class: 'trilha' }), pts = job ? job.pts() : (v ? v.pts.slice() : []), live = h('div', { class: 'gps-live', text: job ? 'Gravando…' : '' }), resumo = h('div', { class: 'tres' });
    function valor() { var r = G.resumoTrilha(pts, true); return pts.length ? { pts: pts, areaM2: r.areaM2, perimM: r.perimM, fechada: true } : null; }
    function atualizar(salvar) {
      var r = G.resumoTrilha(pts, true);
      resumo.textContent = pts.length + ' pontos · perímetro ' + U.fmtNum(r.perimM, 0) + ' m · área ' + (pts.length >= 3 ? U.fmtNum(r.areaHa, 2) + ' ha' : '—');
      if (salvar) set(valor(), false);
    }
    function onFix(f, add) { live.textContent = 'Gravando · precisão ±' + Math.round(f.acc) + ' m' + (f.acc > 25 ? ' (ruim, ponto ignorado)' : ''); if (add) atualizar(true); }
    var btnIni = h('button', { type: 'button', class: 'btn big primary', hidden: !!job, text: pts.length ? '▶ Continuar caminhada' : '▶ Começar caminhada no limite', onclick: function () {
      if (F.jobs[jkey]) return;
      if (!G.suportado()) { U.toast('GPS indisponível'); return; }
      job = G.iniciarTrilha({ pts: pts, onFix: onFix }); F.jobs[jkey] = job; pts = job.pts();
      btnIni.hidden = true; btnPara.hidden = false; btnAdd.hidden = false; live.textContent = 'Gravando… aguardando sinal';
    } });
    var btnPara = h('button', { type: 'button', class: 'btn big danger', hidden: !job, text: '■ Parar e fechar limite', onclick: function () { if (job) { pts = job.parar(); delete F.jobs[jkey]; job = null; } set(valor(), true); } });
    var btnAdd = h('button', { type: 'button', class: 'btn', hidden: !job, text: '＋ Marcar vértice agora', onclick: function () { if (!job) return; var p = job.addAgora(); if (p) { atualizar(true); U.toast('Vértice marcado'); } else U.toast('Sem posição ainda'); } });
    var btnDes = h('button', { type: 'button', class: 'btn', text: '↶ Desfazer último', onclick: function () { if (job) { job.desfazer(); atualizar(true); } else { pts.pop(); set(valor(), true); } } });
    var btnApa = h('button', { type: 'button', class: 'btn', text: 'Apagar limite', onclick: function () { U.confirmar('Apagar limite', 'Apagar todos os ' + pts.length + ' pontos do limite?', 'Apagar', true).then(function (ok) { if (ok) { if (job) { job.parar(); delete F.jobs[jkey]; job = null; } pts.length = 0; set(null, true); } }); } });
    if (job) job.setOnFix(onFix);
    box.appendChild(resumo); box.appendChild(live); box.appendChild(btnIni); box.appendChild(btnPara);
    box.appendChild(h('div', { class: 'row' }, btnAdd, pts.length ? btnDes : null, pts.length ? btnApa : null));
    atualizar(false);
    return box;
  };

  F.renderRepeat = function (campo, itens, set, st) {
    var box = h('div', { class: 'repeat' });
    var nomeTipo = function (it) { var s = campo.campos[0].opts.filter(function (o) { return o[0] === it.tipo; })[0]; return s ? s[1] : 'Item'; };
    itens.forEach(function (it, i) {
      box.appendChild(h('div', { class: 'card item' }, h('div', { class: 'grow' }, h('b', { text: (i + 1) + '. ' + nomeTipo(it) }), h('div', { class: 'dim', text: [it.ano ? 'c. ' + it.ano : '', it.estado || '', it.ponto ? '📍' : '', it.obs || ''].filter(Boolean).join(' · ') })),
        h('button', { type: 'button', class: 'btn', text: 'Editar', onclick: function () { editar(i); } })));
    });
    box.appendChild(h('button', { type: 'button', class: 'btn big', text: '＋ Adicionar ' + campo.item, onclick: function () { editar(-1); } }));
    function editar(i) {
      var cur = i >= 0 ? JSON.parse(JSON.stringify(itens[i])) : {}, corpo = h('div'), sh;
      function pintar() {
        U.clear(corpo);
        var sub = { pre: campo.id + '_', get: function (id) { return cur[id]; }, getNd: function () { return false; }, set: function (id, x, rer) { cur[id] = x; if (rer) pintar(); }, setNd: function () {} };
        campo.campos.forEach(function (c) { corpo.appendChild(F.renderCampo(c, sub, { semNd: true })); });
      }
      pintar();
      sh = U.sheet((i >= 0 ? 'Editar ' : 'Nova ') + campo.item, corpo, [
        i >= 0 ? h('button', { class: 'btn danger', text: 'Excluir', onclick: function () { var a = itens.slice(); a.splice(i, 1); sh.close(); set(a.length ? a : null, true); } }) : null,
        h('button', { class: 'btn primary', text: 'Salvar', onclick: function () {
          if (!cur.tipo) { U.toast('Escolha o tipo'); return; }
          var a = itens.slice(); if (i >= 0) a[i] = cur; else a.push(cur); sh.close(); set(a, true);
        } })]);
    }
    return box;
  };

  /* mostra mensagens de validação dentro do bloco */
  F.marcarMsgs = function (root_, lista) {
    root_.querySelectorAll('.field .msg').forEach(function (m) { m.textContent = ''; m.parentNode.classList.remove('bad', 'warn'); });
    lista.forEach(function (it) {
      var f = root_.querySelector('[data-key="' + it.key + '"]'); if (!f) return;
      var m = f.querySelector('.msg'); if (m) m.textContent = (m.textContent ? m.textContent + ' · ' : '') + it.msg;
      f.classList.add(it.erro ? 'bad' : 'warn');
    });
  };
  root.MOSAICO_FORM = F;
})(typeof self !== 'undefined' ? self : this);
