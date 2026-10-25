/* Tela da visita: formulário por blocos, fotos, conclusão. */
(function (root) {
  'use strict';
  var A = root.MOSAICO_APP, DB = root.MOSAICO_DB, U = root.MOSAICO_UI, h = U.h, C = root.MOSAICO_CORE, S = root.MOSAICO_SCHEMA, V = root.MOSAICO_VALIDAR, F = root.MOSAICO_FORM, PH = root.MOSAICO_PHOTO, G = root.MOSAICO_GPS;
  var VI = {}; root.MOSAICO_VISITA = VI;
  var cur = null; /* {imovel, visita, fotos, bloco, urls[]} */
  var salvarAgora = function (forca) {
    if (!cur || (!cur.dirty && forca !== true)) return Promise.resolve();
    cur.dirty = false;
    var v = cur.visita; v.atualizado = new Date().toISOString(); v.aparelho = A.st.meta.aparelho; v.schema = S.SCHEMA_VERSION;
    if (v.status === 'concluida') v.status = 'rascunho';
    A.st.visitas[v.imovelId] = v;
    return DB.put('visitas', v);
  };
  var salvarDeb = U.debounce(function () { salvarAgora(); }, 350);
  function sujar() { if (cur) cur.dirty = true; salvarDeb(); }
  VI.salvarAgora = salvarAgora;
  function flush() { salvarDeb.flush(); return salvarAgora(); }
  document.addEventListener('visibilitychange', function () { if (document.hidden && cur) flush(); });
  window.addEventListener('pagehide', function () { if (cur) flush(); });

  A.abrirVisita = function (imovelId) {
    var imv = A.st.imoveis.filter(function (i) { return i.id === imovelId; })[0]; if (!imv) return;
    var v = A.st.visitas[imovelId];
    DB.fotosDe(imovelId).then(function (fotos) {
      var novo = !v;
      if (!v) v = { imovelId: imovelId, status: 'rascunho', criado: new Date().toISOString(), atualizado: new Date().toISOString(), aparelho: A.st.meta.aparelho, schema: S.SCHEMA_VERSION, dados: {}, nd: {}, auto: {} };
      v.dados = v.dados || {}; v.nd = v.nd || {}; v.auto = v.auto || {};
      var d = v.dados;
      S.BLOCOS.forEach(function (b) { b.campos.forEach(function (c) {
        var k = b.id + '.' + c.id; if (d[k] != null && d[k] !== '') return;
        if (c.auto === 'hoje') d[k] = C.hoje(); else if (c.auto && c.auto.indexOf('imovel.') === 0) { var x = imv[c.auto.slice(7)]; if (x != null && x !== '') d[k] = x; }
      }); });
      if (novo) { if (!d['b0.responsavel_campo'] && A.st.meta.operador) d['b0.responsavel_campo'] = A.st.meta.operador; if (!d['b0.equipe']) d['b0.equipe'] = A.st.meta.equipe || ('Equipe ' + (imv.parque === 'PEBI' ? 'Biribiri' : 'Serra Negra')); }
      cur = { imovel: imv, visita: v, fotos: fotos, bloco: 0, urls: [], novo: novo };
      if (novo) { cur.dirty = true; salvarAgora(true); }
      if (root.MOSAICO_DIA) root.MOSAICO_DIA.parada('visita', imv.nome);
      A.ir('visita');
    });
  };

  function blocos() { return V.blocosAtivos(cur.imovel, cur.visita.dados); }
  function st(bloco) {
    var d = cur.visita.dados, nd = cur.visita.nd;
    return {
      pre: bloco.id + '.', vid: cur.visita.imovelId,
      get: function (id) { return d[bloco.id + '.' + id]; },
      getNd: function (id) { return !!nd[bloco.id + '.' + id]; },
      set: function (id, x, rer) {
        var k = bloco.id + '.' + id; if (x === null || x === '' || x === undefined) delete d[k]; else d[k] = x;
        if (x != null && x !== '') delete nd[k];
        var campo = bloco.campos.filter(function (c) { return c.id === id; })[0];
        if (campo && campo.t === 'track' && x) { /* área automática a partir do limite */
          var alvo = bloco.campos.filter(function (c) { return c.fromTrack === k; })[0];
          if (alvo) { var ak = bloco.id + '.' + alvo.id; if (d[ak] == null || d[ak] === '' || cur.visita.auto[ak]) { d[ak] = Math.round(x.areaM2 / 100) / 100; cur.visita.auto[ak] = true; if (rer) {} } }
        }
        if (campo && campo.fromTrack == null && cur.visita.auto[k]) delete cur.visita.auto[k];
        else if (campo && cur.visita.auto[k] && campo.t === 'number') delete cur.visita.auto[k];
        sujar();
        var ref = bloco.campos.some(function (c) { return c.show && c.show.f === k; }) || k === 'b0.situacao_visita' || k === 'b3.consentimento' || (campo && campo.t === 'track');
        if (rer || ref) { pintarBloco(); atualizarSteps(); }
      },
      setNd: function (id, on) { var k = bloco.id + '.' + id; if (on) { nd[k] = true; delete d[k]; } else delete nd[k]; sujar(); pintarBloco(); atualizarSteps(); }
    };
  }
  var $body, $steps, $nav;
  function atualizarSteps() {
    if (!$steps) return;
    var bs = blocos(); if (cur.bloco >= bs.length) cur.bloco = bs.length - 1;
    U.clear($steps);
    bs.forEach(function (b, i) {
      var e = V.estadoBloco(b, cur.visita.dados, cur.visita.nd);
      var btn = h('button', { class: 'step ' + e + (i === cur.bloco ? ' cur' : ''), 'aria-label': 'Bloco ' + (i + 1) + ': ' + b.titulo + (e === 'ok' ? ', completo' : e === 'parcial' ? ', parcial' : ''), 'aria-current': i === cur.bloco ? 'step' : null, text: String(i + 1), onclick: function () { irPara(i); } });
      $steps.appendChild(btn);
    });
    var c = $steps.querySelector('.cur'); if (c && c.scrollIntoView) c.scrollIntoView({ inline: 'center', block: 'nearest' });
    pintarNav();
  }
  function irPara(i) { flush(); cur.bloco = i; pintarBloco(); atualizarSteps(); window.scrollTo(0, 0); }
  function pintarNav() {
    if (!$nav) return; U.clear($nav); var bs = blocos(), ult = cur.bloco >= bs.length - 1;
    $nav.appendChild(h('button', { class: 'btn', text: '← Anterior', disabled: cur.bloco === 0, onclick: function () { irPara(cur.bloco - 1); } }));
    $nav.appendChild(ult ? h('button', { class: 'btn primary', text: '✔ Concluir', onclick: concluir }) : h('button', { class: 'btn primary', text: 'Próximo →', onclick: function () { irPara(cur.bloco + 1); } }));
  }
  function pintarBloco() {
    var bs = blocos(), b = bs[Math.min(cur.bloco, bs.length - 1)], y = window.scrollY; U.clear($body);
    $body.appendChild(h('div', { class: 'bloco-h' }, h('h2', { text: (bs.indexOf(b) + 1) + '. ' + b.titulo }), h('p', { text: b.ajuda })));
    var d = cur.visita.dados;
    if (!V.blocoLiberado(b, d)) { $body.appendChild(h('p', { class: 'aviso', text: 'O entrevistado não aceitou responder. Este bloco fica em branco. Se mudar de ideia, altere o consentimento no bloco 4.' })); return; }
    if (b.id === 'b3') { var cs = b.campos[0]; $body.appendChild(h('div', { class: 'consent', text: cs.texto })); }
    if (b.id === 'b0' && !V.visitaRealizada(d)) $body.appendChild(h('p', { class: 'aviso', text: 'Visita não realizada: só este bloco é necessário. Conclua para registrar o motivo.' }));
    var s = st(b);
    b.campos.forEach(function (c) { if (V.visivel(c, d)) $body.appendChild(F.renderCampo(c, s)); });
    if (b.id === 'b10') { $body.appendChild(h('h3', { class: 'sec', text: 'Fotos deste imóvel (' + cur.fotos.length + ')' })); $body.appendChild(galeria()); }
    window.scrollTo(0, y);
    mostrarMsgs();
  }
  function mostrarMsgs() {
    var r = V.validar(cur.visita, cur.imovel, cur.fotos), bs = blocos(), b = bs[cur.bloco];
    if (!b || !cur.tentou) return;
    var l = r.erros.concat(r.avisos).filter(function (x) { return x.bloco === b.id; }).map(function (x) { return { key: x.key, msg: x.msg, erro: r.erros.indexOf(x) >= 0 }; });
    F.marcarMsgs($body, l);
  }

  VI.render = function (app) {
    var im = cur.imovel;
    $body = h('div', { class: 'vbody' }); $steps = h('div', { class: 'steps', role: 'group', 'aria-label': 'Blocos do formulário' }); $nav = h('div', { class: 'nav2' });
    var top = h('header', { class: 'top' }, h('button', { 'aria-label': 'Voltar à lista', text: '‹', onclick: function () { F.pararTodos(); flush().then(function () { cur.urls.forEach(URL.revokeObjectURL); cur = null; $body = $steps = $nav = null; A.carregar().then(function () { A.st.aba = 'imoveis'; A.ir('lista'); }); }); } }),
      h('h1', {}, im.nome, h('span', { class: 'sub', text: im.parque + (im.car ? ' · ' + im.car.slice(-9) : '') })));
    var fab = h('button', { class: 'fab', id: 'fab', 'aria-label': 'Tirar foto', onclick: abrirCamera }, '📷', h('span', { class: 'n', id: 'fabn', text: String(cur.fotos.length) }));
    app.appendChild(h('div', { class: 'shell' }, top, h('main', {}, $steps, $body), $nav, fab));
    pintarBloco(); atualizarSteps();
  };
  function contFotos() { var n = document.getElementById('fabn'); if (n) n.textContent = String(cur.fotos.length); }

  /* ---------- fotos ---------- */
  var ultimaCat = 'area_interna';
  function abrirCamera() {
    var cat = ultimaCat, n0 = cur.fotos.length, info = h('div', { class: 'dim', 'aria-live': 'polite', text: '' }), chipsEl = h('div', { class: 'chips' });
    function pintaCh() { U.clear(chipsEl); S.FOTO_CATS.forEach(function (c) { chipsEl.appendChild(h('button', { class: 'chip' + (cat === c[0] ? ' on' : ''), text: c[1], onclick: function () { cat = c[0]; ultimaCat = cat; pintaCh(); } })); }); }
    pintaCh();
    function entrada(capture) {
      var inp = h('input', { type: 'file', accept: 'image/*', multiple: !capture }); if (capture) inp.setAttribute('capture', 'environment');
      inp.addEventListener('change', function () { var fs = Array.prototype.slice.call(inp.files); if (fs.length) processar(fs); });
      inp.click();
    }
    function processar(fs) {
      info.textContent = 'Salvando ' + fs.length + ' foto(s)…';
      PH.posicao().then(function (pos) {
        return fs.reduce(function (p, f) { return p.then(function () { return PH.reduzir(f).then(function (r) {
          var rec = { id: C.uid('f'), imovelId: cur.imovel.id, cat: cat, legenda: '', t: new Date().toISOString(), w: r.w, h: r.h, blob: r.blob, aparelho: A.st.meta.aparelho };
          if (pos) { rec.lat = pos.lat; rec.lon = pos.lon; rec.acc = pos.acc; rec.alt = pos.alt; }
          return DB.put('fotos', rec).then(function () { if (root.MOSAICO_DIA) root.MOSAICO_DIA.parada('foto', cur.imovel.nome); cur.fotos.push(rec); A.st.fotosN[cur.imovel.id] = cur.fotos.length; A.st.nFotos = (A.st.nFotos || 0) + 1; A.st.fotosBytes = (A.st.fotosBytes || 0) + rec.blob.size; });
        }); }); }, Promise.resolve()).then(function () {
          sujar(); contFotos(); info.textContent = '✔ ' + (cur.fotos.length - n0) + ' foto(s) nesta sessão · ' + (pos ? 'GPS ±' + Math.round(pos.acc) + ' m' : 'sem GPS'); if (document.querySelector('.grid')) pintarBloco();
        });
      }).catch(function (e) { info.textContent = 'Erro: ' + e.message; });
    }
    var sh = U.sheet('Foto · ' + cur.imovel.nome, [h('p', { class: 'dim', text: 'Escolha o tipo e tire quantas fotos quiser.' }), chipsEl, h('div', { class: 'row' }, h('button', { class: 'btn big primary', text: '📷 Tirar foto', onclick: function () { entrada(true); } }), h('button', { class: 'btn big', text: '🖼 Da galeria', onclick: function () { entrada(false); } })), info], [h('button', { class: 'btn', text: 'Fechar', onclick: function () { sh.close(); } })]);
  }
  function galeria() {
    var g = h('div', { class: 'grid' });
    if (!cur.fotos.length) return h('p', { class: 'aviso', text: 'Nenhuma foto ainda. Use o botão 📷.' });
    cur.urls.forEach(URL.revokeObjectURL); cur.urls = [];
    cur.fotos.forEach(function (f) {
      var u = URL.createObjectURL(f.blob); cur.urls.push(u);
      var cn = (S.FOTO_CATS.filter(function (c) { return c[0] === f.cat; })[0] || [0, f.cat])[1];
      g.appendChild(h('button', { class: 'th', 'aria-label': 'Foto ' + cn, onclick: function () { verFoto(f); } }, h('img', { src: u, alt: cn, loading: 'lazy' }), h('span', { class: 'tag', text: cn + (f.lat == null ? ' · sem GPS' : '') })));
    });
    return g;
  }
  function verFoto(f) {
    var u = URL.createObjectURL(f.blob), cat = f.cat, leg = h('input', { type: 'text', value: f.legenda || '', placeholder: 'Legenda (opcional)', 'aria-label': 'Legenda' }), ch = h('div', { class: 'chips' });
    function pintaCh() { U.clear(ch); S.FOTO_CATS.forEach(function (c) { ch.appendChild(h('button', { class: 'chip' + (cat === c[0] ? ' on' : ''), text: c[1], onclick: function () { cat = c[0]; pintaCh(); } })); }); } pintaCh();
    var sh = U.sheet('Foto', [h('img', { src: u, alt: 'Foto', style: 'width:100%;border-radius:10px' }), h('p', { class: 'dim', text: U.fmtData(f.t) + (f.lat != null ? ' · ' + f.lat.toFixed(6) + ', ' + f.lon.toFixed(6) + ' ±' + Math.round(f.acc || 0) + ' m' : ' · sem coordenadas') }), h('div', { class: 'field' }, leg), ch], [
      h('button', { class: 'btn danger', text: 'Excluir', onclick: function () { U.confirmar('Excluir foto', 'Excluir esta foto?', 'Excluir', true).then(function (ok) { if (!ok) return; DB.del('fotos', f.id).then(function () { cur.fotos = cur.fotos.filter(function (x) { return x.id !== f.id; }); A.st.fotosN[cur.imovel.id] = cur.fotos.length; sh.close(); URL.revokeObjectURL(u); contFotos(); pintarBloco(); sujar(); }); }); } }),
      h('button', { class: 'btn primary', text: 'Salvar', onclick: function () { f.cat = cat; f.legenda = leg.value; DB.put('fotos', f).then(function () { sh.close(); URL.revokeObjectURL(u); pintarBloco(); sujar(); }); } })]);
    sh.onclose = function () { URL.revokeObjectURL(u); };
  }

  /* ---------- conclusão ---------- */
  function concluir() {
    F.pararTodos(); cur.tentou = true;
    var r = V.validar(cur.visita, cur.imovel, cur.fotos), bs = blocos();
    function lista(arr, cls) { return arr.map(function (x) { var i = bs.map(function (b) { return b.id; }).indexOf(x.bloco); return h('button', { class: 'vl ' + cls, text: (i >= 0 ? (i + 1) + ' · ' : '') + x.msg, onclick: function () { sh.close(); if (i >= 0) irPara(i); } }); }); }
    var corpo = [];
    if (!r.erros.length && !r.avisos.length) corpo.push(h('p', { text: 'Tudo certo. Concluir a visita de ' + cur.imovel.nome + '?' }));
    if (r.erros.length) { corpo.push(h('h3', { class: 'sec err-line', text: 'Corrigir (' + r.erros.length + ')' })); corpo.push(lista(r.erros, 'err-line')); }
    if (r.avisos.length) { corpo.push(h('h3', { class: 'sec warn-line', text: 'Conferir (' + r.avisos.length + ')' })); corpo.push(lista(r.avisos, 'warn-line')); }
    var fim = function (status) { cur.visita.status = status; cur.visita.concluidaEm = new Date().toISOString(); salvarDeb.flush(); cur.dirty = false; var v = cur.visita; v.atualizado = new Date().toISOString(); v.aparelho = A.st.meta.aparelho; A.st.visitas[v.imovelId] = v; DB.put('visitas', v).then(function () { sh.close(); U.toast(status === 'concluida' ? 'Visita concluída' : 'Marcada para voltar'); document.querySelector('.top button').click(); }); };
    var botoes = [h('button', { class: 'btn', text: 'Continuar editando', onclick: function () { sh.close(); pintarBloco(); } })];
    botoes.push(r.erros.length ? h('button', { class: 'btn', text: 'Marcar "voltar depois"', onclick: function () { fim('pendente'); } }) : h('button', { class: 'btn primary', text: 'Concluir visita', onclick: function () { fim('concluida'); } }));
    var sh = U.sheet('Revisão antes de concluir', corpo, botoes);
    pintarBloco();
  }
  VI._dbg = function () { return cur; };
})(window);
