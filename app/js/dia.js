/* Jornada do dia: deslocamento (GPS + hodômetro), paradas e custos de campo. */
(function (root) {
  'use strict';
  var A = root.MOSAICO_APP, DB = root.MOSAICO_DB, U = root.MOSAICO_UI, h = U.h, C = root.MOSAICO_CORE, G = root.MOSAICO_GPS;
  var D = {}; root.MOSAICO_DIA = D;
  var CATS = [['km_veiculo', 'Veículo (km)'], ['combustivel', 'Combustível'], ['diaria', 'Diárias'], ['alimentacao', 'Alimentação'], ['hospedagem', 'Hospedagem'], ['pedagio', 'Pedágio/balsa'], ['manutencao', 'Manutenção'], ['material', 'Material/EPI'], ['outros', 'Outros']];
  var VEIC = [['carro', 'Carro'], ['moto', 'Moto'], ['a_pe', 'A pé'], ['outro', 'Outro']];
  D.CATS = CATS; D.VEIC = VEIC;
  function brl(n) { return 'R$ ' + Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function localDate(iso) { var d = new Date(iso), p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  D.brl = brl; D.localDate = localDate;
  var off = null, timer = null, atual = null, salvarDeb = U.debounce(function () { if (atual) DB.put('dias', atual); }, 8000);

  D.diaId = function (data) { return data + '|' + A.st.meta.aparelho; };
  D.diaAberto = function () { var k = Object.keys(A.st.dias || {}).filter(function (i) { return A.st.dias[i].status === 'aberto' && A.st.dias[i].aparelho === A.st.meta.aparelho; }); return k.length ? A.st.dias[k.sort().pop()] : null; };
  D.kmGps = function (d) { return (d.distGpsM || 0) / 1000; };
  D.kmOdo = function (d) { return (d.odoIni != null && d.odoFim != null && d.odoFim >= d.odoIni) ? d.odoFim - d.odoIni : null; };
  D.kmUsado = function (d) { var o = D.kmOdo(d); return o != null ? o : D.kmGps(d); };
  D.visitasDoDia = function (data) { return Object.keys(A.st.visitas).filter(function (k) { return localDate(A.st.visitas[k].atualizado) === data; }).length; };
  D.custosDoDia = function (diaId) { return (A.st.custos || []).filter(function (c) { return c.dia === diaId; }); };
  D.totalDia = function (diaId) { return D.custosDoDia(diaId).reduce(function (s, c) { return s + (+c.valor || 0); }, 0); };

  /* ---- rastreio ---- */
  function aoFix(f) {
    var d = atual; if (!d || d.status !== 'aberto' || f == null) return;
    if (f.acc != null && f.acc > 40) return;
    var tr = d.trilha, ult = tr[tr.length - 1], p = { lat: f.lat, lon: f.lon, acc: f.acc, t: f.t };
    if (ult) {
      var dist = C.haversine(ult, p), dt = (p.t - ult.t) / 1000;
      if (dt > 0 && dist / dt > 60) return;                       /* salto impossível (>216 km/h): ignora */
      if (!(dist >= 25 || (dt >= 120 && dist >= 8))) return;      /* ainda parado/pouco deslocamento */
      if (dt > 300) d.lacunas = (d.lacunas || 0) + 1;             /* app ficou em segundo plano ou GPS sem sinal */
      d.distGpsM = (d.distGpsM || 0) + dist;
    }
    tr.push(p); d.atualizado = new Date().toISOString(); salvarDeb();
  }
  function ligar() { if (off) return; off = G.assinar(function (f) { aoFix(f); }); }
  function desligar() { if (off) { off(); off = null; } }
  D.retomar = function () { var d = D.diaAberto(); atual = d; if (d && G.suportado()) ligar(); };
  D.parada = function (tipo, ref) {
    var d = D.diaAberto(); if (!d || !G.ultima) return; atual = d;
    d.paradas.push({ t: Date.now(), lat: G.ultima.lat, lon: G.ultima.lon, tipo: tipo, ref: ref || '' }); d.atualizado = new Date().toISOString(); salvarDeb();
  };

  /* ---- jornada ---- */
  D.iniciar = function (o) {
    var data = C.hoje(), id = D.diaId(data), ex = A.st.dias[id];
    var d = ex || { id: id, data: data, aparelho: A.st.meta.aparelho, trilha: [], paradas: [], distGpsM: 0, lacunas: 0 };
    Object.assign(d, { status: 'aberto', veiculo: o.veiculo, pessoas: o.pessoas, equipe: o.equipe || A.st.meta.equipe, operador: A.st.meta.operador, odoIni: o.odoIni != null ? o.odoIni : d.odoIni, inicio: d.inicio || new Date().toISOString(), fim: null, atualizado: new Date().toISOString() });
    A.st.dias[id] = d; atual = d; if (G.ultima) aoFix(G.ultima);
    return DB.put('dias', d).then(function () { ligar(); });
  };
  D.encerrar = function (odoFim) {
    var d = D.diaAberto() || atual; if (!d) return Promise.resolve();
    desligar(); d.status = 'encerrado'; d.fim = new Date().toISOString(); if (odoFim != null) d.odoFim = odoFim; d.atualizado = d.fim;
    return DB.put('dias', d).then(function () { return D.lancarKm(d); }).then(function () { atual = null; });
  };
  D.reabrir = function (d) { d.status = 'aberto'; d.fim = null; d.atualizado = new Date().toISOString(); atual = d; return DB.put('dias', d).then(function () { ligar(); }); };
  D.rKm = function (veic) { var v = (A.st.meta.valorKm || {})[veic]; return v != null && v !== '' && !isNaN(v) ? +v : null; };
  D.lancarKm = function (d) {
    var km = D.kmUsado(d), r = D.rKm(d.veiculo), id = 'auto-km-' + d.id;
    if (d.veiculo === 'a_pe' || km <= 0) return D.delCusto(id);
    var c = { id: id, dia: d.id, cat: 'km_veiculo', desc: VEIC.filter(function (v) { return v[0] === d.veiculo; })[0][1] + ': ' + km.toFixed(1) + ' km' + (D.kmOdo(d) != null ? ' (hodômetro)' : ' (GPS)') + (r == null ? ' · defina R$/km em Ajustes' : ' × ' + brl(r) + '/km'), qtd: +km.toFixed(1), valor: r == null ? 0 : +(km * r).toFixed(2), origem: 'auto', aparelho: A.st.meta.aparelho, atualizado: new Date().toISOString() };
    return D.putCusto(c);
  };
  D.lancarDiaria = function (d) {
    var v = A.st.meta.valorDiaria; if (v == null || v === '' || isNaN(v)) { U.toast('Defina o valor da diária em Ajustes'); return Promise.resolve(); }
    return D.putCusto({ id: 'auto-diaria-' + d.id, dia: d.id, cat: 'diaria', desc: d.pessoas + ' pessoa(s) × ' + brl(v), qtd: d.pessoas, valor: +(d.pessoas * v).toFixed(2), origem: 'auto', aparelho: A.st.meta.aparelho, atualizado: new Date().toISOString() });
  };
  D.putCusto = function (c) { c.atualizado = new Date().toISOString(); return DB.put('custos', c).then(function () { var i = A.st.custos.findIndex(function (x) { return x.id === c.id; }); if (i >= 0) A.st.custos[i] = c; else A.st.custos.push(c); }); };
  D.delCusto = function (id) { return DB.del('custos', id).then(function () { A.st.custos = A.st.custos.filter(function (x) { return x.id !== id; }); }); };
  D.salvarAgora = function () { salvarDeb.flush(); return atual ? DB.put('dias', atual) : Promise.resolve(); };
  window.addEventListener('pagehide', function () { D.salvarAgora(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) D.salvarAgora(); });

  /* ---- telas ---- */
  function fmtHM(ms) { var m = Math.floor(ms / 60000); return Math.floor(m / 60) + ' h ' + ('0' + (m % 60)).slice(-2) + ' min'; }
  function chipsSel(opts, sel, on) { var w = h('div', { class: 'chips' }); function p() { U.clear(w); opts.forEach(function (o) { w.appendChild(h('button', { type: 'button', class: 'chip' + (sel() === o[0] ? ' on' : ''), text: o[1], onclick: function () { on(o[0]); p(); } })); }); } p(); return w; }
  function numInput(ph, v) { return h('input', { type: 'number', inputmode: 'decimal', step: 'any', placeholder: ph, value: v == null ? '' : v, 'aria-label': ph }); }
  function nv(i) { var x = parseFloat(String(i.value).replace(',', '.')); return isNaN(x) ? null : x; }

  D.render = function (main) {
    clearInterval(timer); var data = C.hoje(), id = D.diaId(data), d = A.st.dias[id], aberto = D.diaAberto();
    if (aberto && aberto.data !== data) {
      main.appendChild(h('div', { class: 'banner', role: 'alert' }, 'A jornada de ' + aberto.data.split('-').reverse().join('/') + ' ficou aberta. ', h('button', { class: 'btn', style: 'margin-left:.4rem', text: 'Encerrar', onclick: function () { abrirEncerrar(aberto); } })));
    }
    if (G.suportado() === false) main.appendChild(h('div', { class: 'aviso', text: 'Este aparelho não oferece GPS ao navegador. Use o hodômetro.' }));
    var card = h('div', { class: 'card' }); main.appendChild(card);
    function pintaCard() {
      U.clear(card);
      if (!d) {
        card.appendChild(h('b', { text: 'Jornada de hoje: não iniciada' }));
        card.appendChild(h('p', { class: 'dim', text: 'Ao iniciar, o app registra o trajeto enquanto estiver aberto e com a tela ligada, soma os km e marca uma parada a cada visita e foto.' }));
        card.appendChild(h('button', { class: 'btn big primary', id: 'btn-iniciar', text: '▶ Iniciar jornada', onclick: abrirIniciar }));
        return;
      }
      var km = D.kmGps(d), ko = D.kmOdo(d), ativo = d.status === 'aberto', fim = d.fim ? new Date(d.fim).getTime() : Date.now();
      card.appendChild(h('div', { class: 'row', style: 'align-items:center;margin:0' }, h('b', { text: ativo ? '● Jornada em andamento' : 'Jornada encerrada' }), h('span', { class: 'dim', text: VEIC.filter(function (v) { return v[0] === d.veiculo; })[0][1] + ' · ' + d.pessoas + ' pessoa(s) · equipe ' + d.equipe })));
      card.appendChild(h('div', { class: 'stat' }, [[fmtHM(fim - new Date(d.inicio).getTime()), 'tempo'], [km.toFixed(1), 'km GPS'], [ko != null ? ko.toFixed(1) : '—', 'km hodômetro'], [D.visitasDoDia(data), 'visitas hoje']].map(function (x) { return h('div', {}, h('b', { text: x[0] }), h('span', { text: x[1] })); })));
      if (d.lacunas) card.appendChild(h('div', { class: 'aviso', text: '⚠ ' + d.lacunas + ' lacuna(s) no trajeto (app em segundo plano ou sem sinal). O km por GPS pode estar menor que o real; use o hodômetro.' }));
      if (ko != null && km > 0 && Math.abs(ko - km) / ko > 0.25) card.appendChild(h('div', { class: 'aviso', text: 'Hodômetro e GPS diferem mais de 25%. O custo usa o hodômetro.' }));
      card.appendChild(h('div', { class: 'dim', text: d.trilha.length + ' pontos de trajeto · ' + d.paradas.length + ' paradas' }));
      card.appendChild(ativo ? h('button', { class: 'btn big danger', id: 'btn-encerrar', text: '■ Encerrar jornada', onclick: function () { abrirEncerrar(d); } }) : h('button', { class: 'btn', text: 'Reabrir jornada', onclick: function () { D.reabrir(d).then(A.render); } }));
    }
    pintaCard();
    if (d && d.status === 'aberto') timer = setInterval(function () { if (!document.getElementById('btn-encerrar')) return clearInterval(timer); pintaCard(); }, 5000);
    /* custos */
    if (d) {
      var cc = h('div', { class: 'card' }); main.appendChild(cc);
      var cs = D.custosDoDia(id), tot = D.totalDia(id), nv_ = D.visitasDoDia(data);
      cc.appendChild(h('div', { class: 'row', style: 'align-items:center;margin:0' }, h('b', { text: 'Custos do dia' }), h('b', { id: 'tot-dia', style: 'text-align:right', text: brl(tot) })));
      if (nv_ > 0 && tot > 0) cc.appendChild(h('div', { class: 'dim', text: brl(tot / nv_) + ' por visita trabalhada (' + nv_ + ')' }));
      if (d.veiculo !== 'a_pe' && D.rKm(d.veiculo) == null) cc.appendChild(h('div', { class: 'aviso', text: 'R$/km do veículo não definido em Ajustes: o custo de km entra zerado.' }));
      cs.forEach(function (c) {
        cc.appendChild(h('div', { class: 'card item', style: 'margin:.3rem 0' }, h('div', { class: 'grow' }, h('b', { text: CATS.filter(function (x) { return x[0] === c.cat; })[0][1] }), h('div', { class: 'dim', text: c.desc || '' })), h('div', { style: 'text-align:right' }, h('b', { text: brl(c.valor) }), h('br'), h('button', { class: 'btn', style: 'min-height:40px;padding:.2rem .7rem', text: 'Editar', onclick: function () { abrirCusto(d, c); } }))));
      });
      cc.appendChild(h('div', { class: 'row' }, h('button', { class: 'btn big primary', id: 'btn-gasto', text: '＋ Lançar gasto', onclick: function () { abrirCusto(d, null); } }), h('button', { class: 'btn', text: 'Lançar diárias', onclick: function () { D.lancarDiaria(d).then(A.render); } }), h('button', { class: 'btn', text: 'Recalcular km', onclick: function () { D.lancarKm(d).then(A.render); } })));
    }
    /* histórico */
    var hist = Object.keys(A.st.dias).filter(function (k) { return k !== id; }).sort().reverse();
    if (hist.length) {
      main.appendChild(h('h3', { class: 'sec', text: 'Dias anteriores' }));
      hist.slice(0, 30).forEach(function (k) { var x = A.st.dias[k]; main.appendChild(h('div', { class: 'card item' }, h('div', { class: 'grow' }, h('b', { text: x.data.split('-').reverse().join('/') }), h('div', { class: 'dim', text: D.kmUsado(x).toFixed(1) + ' km · ' + D.visitasDoDia(x.data) + ' visitas · ' + (x.status === 'aberto' ? 'ABERTA' : 'encerrada') })), h('b', { text: brl(D.totalDia(k)) }))); });
    }
  };
  function abrirIniciar() {
    var veic = 'carro', ped = numInput('Pessoas na equipe', 2), odo = numInput('Hodômetro inicial (km), se quiser'), eq = A.st.meta.equipe || 'A';
    var sh = U.sheet('Iniciar jornada', [h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Veículo' }), chipsSel(VEIC, function () { return veic; }, function (v) { veic = v; })), h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Pessoas na equipe hoje' }), ped), h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Hodômetro inicial (km)' }), odo), h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Equipe' }), chipsSel([['A', 'Equipe A'], ['B', 'Equipe B']], function () { return eq; }, function (v) { eq = v; }))],
      [h('button', { class: 'btn', text: 'Cancelar', onclick: function () { sh.close(); } }), h('button', { class: 'btn primary', id: 'ok-iniciar', text: 'Iniciar', onclick: function () { var n = nv(ped); if (!n || n < 1) { U.toast('Informe as pessoas'); return; } sh.close(); D.iniciar({ veiculo: veic, pessoas: n, odoIni: nv(odo), equipe: eq }).then(A.render); } })]);
  }
  function abrirEncerrar(d) {
    var odo = numInput('Hodômetro final (km)', d.odoFim), info = h('div', { class: 'dim', text: '' });
    function calc() { var x = JSON.parse(JSON.stringify({ odoIni: d.odoIni, odoFim: nv(odo), distGpsM: d.distGpsM })); var ko = D.kmOdo(x); info.textContent = 'GPS: ' + D.kmGps(d).toFixed(1) + ' km' + (ko != null ? ' · hodômetro: ' + ko.toFixed(1) + ' km (será usado)' : d.odoIni != null ? ' · informe o hodômetro final' : ' (sem hodômetro: usa GPS)'); }
    odo.addEventListener('input', calc); calc();
    var sh = U.sheet('Encerrar jornada', [h('p', { text: 'Ao encerrar, o app lança o custo do veículo (km × R$/km) nos custos do dia.' }), h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Hodômetro final (km)' }), odo), info],
      [h('button', { class: 'btn', text: 'Cancelar', onclick: function () { sh.close(); } }), h('button', { class: 'btn danger', id: 'ok-encerrar', text: 'Encerrar', onclick: function () { sh.close(); D.encerrar(nv(odo)).then(function () { return D.lancarDiaria(d); }).then(A.render); } })]);
  }
  function abrirCusto(d, c) {
    var cur = c ? Object.assign({}, c) : { id: C.uid('c'), dia: d.id, cat: 'combustivel', origem: 'manual', aparelho: A.st.meta.aparelho };
    var desc = h('input', { type: 'text', placeholder: 'Descrição (posto, restaurante, motivo…)', value: cur.desc || '', 'aria-label': 'Descrição' }), val = numInput('Valor total (R$)', cur.valor), foto = h('div', { class: 'dim', text: '' });
    var sh = U.sheet(c ? 'Editar gasto' : 'Lançar gasto', [h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Tipo' }), chipsSel(CATS, function () { return cur.cat; }, function (v) { cur.cat = v; })), h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Valor (R$)' }), val), h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Descrição' }), desc),
      h('div', { class: 'field' }, h('button', { class: 'btn', text: '📷 Foto do comprovante', onclick: function () { var i = h('input', { type: 'file', accept: 'image/*' }); i.setAttribute('capture', 'environment'); i.addEventListener('change', function () { var f = i.files[0]; if (!f) return; root.MOSAICO_PHOTO.reduzir(f).then(function (r) { return DB.put('fotos', { id: C.uid('f'), imovelId: 'custo-' + cur.id, cat: 'comprovante', legenda: cur.cat, t: new Date().toISOString(), w: r.w, h: r.h, blob: r.blob, aparelho: A.st.meta.aparelho }); }).then(function () { foto.textContent = '✔ comprovante salvo'; }); }); i.click(); } }), foto)],
      [c && c.origem !== 'auto' ? h('button', { class: 'btn danger', text: 'Excluir', onclick: function () { sh.close(); D.delCusto(c.id).then(A.render); } }) : null, h('button', { class: 'btn', text: 'Cancelar', onclick: function () { sh.close(); } }), h('button', { class: 'btn primary', id: 'ok-gasto', text: 'Salvar', onclick: function () { var v = nv(val); if (v == null || v < 0) { U.toast('Informe o valor'); return; } cur.valor = +v.toFixed(2); cur.desc = desc.value.trim(); if (cur.origem === 'auto') cur.origem = 'auto-editado'; sh.close(); D.putCusto(cur).then(A.render); } })]);
  }
  /* cartão de configuração (Ajustes) */
  D.cardAjustes = function () {
    var m = A.st.meta; m.valorKm = m.valorKm || {};
    function ci(rot, get, set) { var i = numInput(rot, get()); i.addEventListener('input', function () { set(nv(i)); A.salvarCfg(); }); return h('div', { class: 'field' }, h('div', { class: 'lab', text: rot }), i); }
    var kml = numInput('Consumo do carro (km/l)'), rl = numInput('Preço do combustível (R$/l)'), res = h('div', { class: 'dim', text: '' });
    function calc() { var a = nv(kml), b = nv(rl); res.textContent = a && b ? '= ' + brl(b / a) + ' por km (só combustível)' : ''; }
    kml.addEventListener('input', calc); rl.addEventListener('input', calc);
    return h('div', { class: 'card' }, h('b', { text: 'Custos de campo' }), h('p', { class: 'dim', text: 'Use os valores definidos pelo projeto. O app não tem valores padrão.' }),
      ci('R$ por km (carro)', function () { return m.valorKm.carro; }, function (v) { m.valorKm.carro = v; }), ci('R$ por km (moto)', function () { return m.valorKm.moto; }, function (v) { m.valorKm.moto = v; }),
      ci('Diária (R$ por pessoa por dia)', function () { return m.valorDiaria; }, function (v) { m.valorDiaria = v; }),
      h('div', { class: 'dim', text: 'Calculadora (opcional):' }), h('div', { class: 'row' }, kml, rl), res);
  };
  root.MOSAICO_DIA = D;
})(window);
