(function () {
  'use strict';
  var E = MOSAICO_EXPORT, C = MOSAICO_CORE, S = MOSAICO_SCHEMA, PK = MOSAICO_PACOTE, T = MOSAICO_CSV, V = MOSAICO_VALIDAR;
  var est = E.novoEstado(), aba = 'resumo', $main = document.getElementById('main'), $nav = document.getElementById('nav'), msgs = [];
  function h(tag, a) { var el = document.createElement(tag); if (a) Object.keys(a).forEach(function (k) { var v = a[k]; if (v == null || v === false) return; if (k === 'text') el.textContent = v; else if (k === 'html') el.innerHTML = v; else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (v === true) el.setAttribute(k, ''); else el.setAttribute(k, v); }); for (var i = 2; i < arguments.length; i++) add(el, arguments[i]); return el; }
  function add(el, c) { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(function (x) { add(el, x); }); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function baixar(nome, data, tipo) { var b = new Blob([data], { type: tipo || 'application/octet-stream' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000); }
  function msg(t) { msgs.unshift(t); msgs = msgs.slice(0, 6); render(); }
  function stamp() { var d = new Date(), p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }

  /* ---------- entrada de arquivos ---------- */
  function ler(files) {
    var fs = Array.prototype.slice.call(files);
    return fs.reduce(function (p, f) { return p.then(function () {
      if (/\.zip$/i.test(f.name)) return f.arrayBuffer().then(PK.ler).then(function (pk) { var r = E.incorporar(est, pk, f.name); msg(f.name + ': ' + r.visitas + ' visitas, ' + r.fotosNovas + ' fotos novas' + (r.conflitos ? ', ' + r.conflitos + ' conflito(s)' : '')); });
      return f.text().then(function (txt) {
        var arr; if (/^\s*[\[{]/.test(txt)) { var j = JSON.parse(txt); arr = Array.isArray(j) ? j : j.imoveis; } else { var r = T.imoveisDeTabela(T.parse(txt)); arr = r.imoveis; r.avisos.forEach(function (a) { msg('Lista: ' + a); }); }
        E.incorporarLista(est, arr || []); msg(f.name + ': ' + (arr || []).length + ' imóveis na lista');
      });
    }).catch(function (e) { msg('ERRO em ' + f.name + ': ' + e.message); }); }, Promise.resolve()).then(render);
  }
  function entrada(multi) { var i = h('input', { type: 'file', multiple: true, accept: '.zip,.csv,.json,.txt' }); i.addEventListener('change', function () { ler(i.files); }); i.click(); }
  window.addEventListener('dragover', function (e) { e.preventDefault(); }); window.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer.files.length) ler(e.dataTransfer.files); });

  /* ---------- exportações ---------- */
  function xlsx(opt) {
    var t = E.tabelas(est, opt), wb = XLSX.utils.book_new();
    function aba_(nome, rows) { var ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ aviso: 'sem registros' }]); XLSX.utils.book_append_sheet(wb, ws, nome); }
    aba_('Visitas', t.dados); aba_('Benfeitorias', t.benfeitorias); aba_('Pontos_GPS', t.pontos); aba_('Fotos', t.fotos);
    if (opt && opt.pessoais) aba_('Dados_pessoais', t.pessoais);
    aba_('Jornadas', E.jornadas(est)); aba_('Custos', E.custosLinhas(est)); aba_('Dicionario', t.dicionario); aba_('Qualidade', E.qa(est).itens);
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }
  function csv(opt) { var t = E.tabelas(est, opt), cols = []; t.dados.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); }); return T.stringify([cols].concat(t.dados.map(function (r) { return cols.map(function (c) { return r[c]; }); }))); }
  function latin(s) { return String(s == null ? '' : s).replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '?'); }
  function mini(f) {
    return createImageBitmap(new Blob([f.data], { type: 'image/jpeg' })).then(function (bm) {
      var k = Math.min(1, 480 / Math.max(bm.width, bm.height)), c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); bm.close && bm.close();
      return new Promise(function (res) { c.toBlob(function (b) { b.arrayBuffer().then(function (a) { res({ d: new Uint8Array(a), w: c.width, h: c.height }); }); }, 'image/jpeg', 0.7); });
    }).catch(function () { return null; });
  }
  function pdfAsync(ids, opt) {
    var lista = []; ids.forEach(function (id) { E.fotosDe(est, id).slice(0, 12).forEach(function (f) { lista.push(f); }); });
    var cache = {}; return lista.reduce(function (p, f) { return p.then(function () { return mini(f).then(function (m) { cache[f.id] = m; }); }); }, Promise.resolve()).then(function () { return pdf(ids, opt, cache); });
  }
  function pdf(ids, opt, cache) {
    cache = cache || {};
    var J = window.jspdf.jsPDF, doc = new J({ unit: 'mm', format: 'a4' }), first = true, W = 210, M = 14, y = 0;
    function pg() { doc.addPage(); y = M; }
    function linha(txt, sz, bold, cor) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(sz); if (cor) doc.setTextColor.apply(doc, cor); else doc.setTextColor(20, 30, 25); var ls = doc.splitTextToSize(latin(txt), W - 2 * M); ls.forEach(function (l) { if (y > 280) pg(); doc.text(l, M, y); y += sz * 0.45 + 1.2; }); }
    ids.forEach(function (id) {
      var v = est.visitas[id], im = est.imoveis[id] || { id: id, nome: id, parque: '' }, d = v.dados || {}, nd = v.nd || {}, fs = E.fotosDe(est, id), q = V.validar(v, im, fs);
      if (!first) pg(); else { y = M; first = false; }
      doc.setFillColor(20, 83, 45); doc.rect(0, 0, W, 16, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(latin('Ficha de campo · ' + im.nome), M, 10.5); y = 24;
      linha(im.parque + ' · ID ' + im.id + (im.car ? ' · CAR ' + im.car : '') + ' · status: ' + v.status, 9, false, [90, 107, 98]);
      linha('Atualizado em ' + new Date(v.atualizado).toLocaleString('pt-BR') + ' · aparelho ' + (v.aparelho || '-') + ' · ' + fs.length + ' foto(s) · ' + q.erros.length + ' erro(s), ' + q.avisos.length + ' aviso(s) de qualidade', 9, false, [90, 107, 98]); y += 2;
      V.blocosAtivos(im, d).forEach(function (b) {
        if (!V.blocoLiberado(b, d)) { linha(b.titulo, 11, true, [20, 83, 45]); linha('Entrevistado não aceitou responder.', 10); return; }
        var itens = [];
        b.campos.forEach(function (c) {
          if (!V.visivel(c, d)) return; var k = b.id + '.' + c.id, val = d[k];
          if (c.sens && !opt.pessoais) { if (V.preenchido(val) || nd[k]) itens.push([c.rot, '(dado pessoal omitido)']); return; }
          if (nd[k]) { itens.push([c.rot, '(prefere não informar)']); return; }
          if (!V.preenchido(val)) return;
          if (c.t === 'repeat') { val.forEach(function (it, i) { var sub = c.campos; itens.push([c.rot + ' ' + (i + 1), sub.map(function (s) { var x = E.rotulo(s, it[s.id]); return x ? s.rot + ': ' + x : ''; }).filter(Boolean).join(' · ')]); }); return; }
          itens.push([c.rot, String(E.rotulo(c, val)) + (c.un ? ' ' + c.un : '')]);
        });
        if (!itens.length) return; if (y > 262) pg();
        linha(b.titulo, 11, true, [20, 83, 45]);
        itens.forEach(function (it) { linha(it[0] + ': ' + it[1], 9.5); }); y += 1.5;
      });
      if (fs.length) {
        if (y > 220) pg(); linha('Fotos', 11, true, [20, 83, 45]);
        var x = M, w = 42, hgt = 32, n = 0;
        fs.slice(0, 12).forEach(function (f) { if (x + w > W - M + 1) { x = M; y += hgt + 8; } if (y + hgt > 285) { pg(); x = M; } var m = cache[f.id]; try { doc.addImage(m ? m.d : f.data, 'JPEG', x, y, w, hgt, undefined, 'FAST'); } catch (e) {} doc.setFontSize(7); doc.setTextColor(90, 107, 98); doc.text(latin(f.cat + (f.lat != null ? '' : ' (sem GPS)')), x, y + hgt + 3); x += w + 3; });
        y += hgt + 8;
      }
      if (q.erros.length || q.avisos.length) { if (y > 250) pg(); linha('Observações de qualidade', 11, true, [180, 83, 9]); q.erros.concat(q.avisos).forEach(function (e) { linha('• ' + e.msg, 9); }); }
    });
    var n = doc.getNumberOfPages(); for (var i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text('Mosaico · gerado em ' + new Date().toLocaleString('pt-BR') + ' · pág. ' + i + '/' + n, M, 291); }
    return doc.output('arraybuffer');
  }
  function zipArq(files) { return C.makeZip(files); }
  var ACOES = {
    xlsx: function (o) { baixar('mosaico_dados_' + stamp() + '.xlsx', xlsx(o), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); },
    csv: function (o) { baixar('mosaico_visitas_' + stamp() + '.csv', csv(o), 'text/csv'); },
    geojson: function () { baixar('mosaico_geo_' + stamp() + '.geojson', JSON.stringify(E.geojson(est)), 'application/geo+json'); },
    shp: function () { var f = E.shapefiles(est); if (!f.length) return msg('Sem geometrias para exportar'); baixar('mosaico_shapefiles_' + stamp() + '.zip', zipArq(f), 'application/zip'); },
    fotos: function () { var f = E.fotosArquivos(est); if (!f.length) return msg('Sem fotos'); baixar('mosaico_fotos_' + stamp() + '.zip', zipArq(f), 'application/zip'); },
    pdf: function (o) { var ids = Object.keys(est.visitas).sort(); if (!ids.length) return msg('Sem visitas'); msg('Gerando PDF…'); return pdfAsync(ids, o).then(function (b) { baixar('mosaico_fichas_' + stamp() + '.pdf', b, 'application/pdf'); }); },
    proj: function () { E.consolidado(est, 'central').then(function (u8) { baixar('mosaico_projeto_consolidado_' + stamp() + '.zip', u8, 'application/zip'); }); },
    qa: function () { var q = E.qa(est).itens; baixar('mosaico_qualidade_' + stamp() + '.csv', T.stringify([['imovel_id', 'imovel', 'nivel', 'campo', 'mensagem', 'status']].concat(q.map(function (r) { return [r.imovel_id, r.imovel, r.nivel, r.campo, r.mensagem, r.status]; }))), 'text/csv'); }
  };
  window.MOSAICO_CENTRAL = { est: function () { return est; }, ler: ler, xlsx: xlsx, csv: csv, pdf: pdfAsync, ACOES: ACOES };

  /* ---------- telas ---------- */
  function tabela(rows, cols) {
    var head = h('tr', {}, cols.map(function (c) { return h('th', { text: c[1] }); }));
    var body = rows.map(function (r) { return h('tr', {}, cols.map(function (c) { return h('td', { class: c[0] === 'nivel' ? r.nivel : '', text: r[c[0]] == null ? '' : String(r[c[0]]) }); })); });
    return h('div', { class: 'tw' }, h('table', {}, h('thead', {}, head), h('tbody', {}, body)));
  }
  function custos() {
    var j = E.jornadas(est), cats = Object.keys(E.CAT).map(function (k) { return E.CAT[k]; });
    var tot = { km: 0, custo: 0, visitas: 0, horas: 0 }; j.forEach(function (r) { tot.km += +r.km_usado || 0; tot.custo += +r.custo_total || 0; tot.visitas += +r.visitas_trabalhadas || 0; tot.horas += +r.horas || 0; });
    $main.appendChild(h('div', { class: 'k' }, [[j.length, 'jornadas'], [tot.km.toFixed(0), 'km rodados'], [tot.horas.toFixed(0), 'horas'], ['R$ ' + tot.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), 'custo de campo'], [tot.visitas ? 'R$ ' + (tot.custo / tot.visitas).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—', 'por visita'], [tot.km ? 'R$ ' + (tot.custo / tot.km).toFixed(2) : '—', 'por km']].map(function (x) { return h('div', {}, h('b', { text: x[0] }), h('span', { class: 'dim', text: x[1] })); })));
    var porCat = cats.map(function (c) { var v = j.reduce(function (s, r) { return s + (+r[c] || 0); }, 0); return { categoria: c, total: 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), pct: tot.custo ? (v / tot.custo * 100).toFixed(1) + '%' : '' }; });
    $main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Custo de campo por categoria' }), tabela(porCat, [['categoria', 'Categoria'], ['total', 'Total'], ['pct', '%']])));
    $main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Jornadas' }), j.length ? tabela(j, [['data', 'Data'], ['aparelho', 'Aparelho'], ['equipe', 'Eq.'], ['veiculo', 'Veículo'], ['pessoas', 'Pess.'], ['km_gps', 'km GPS'], ['km_hodometro', 'km hodôm.'], ['km_usado', 'km usado'], ['lacunas_gps', 'Lacunas'], ['visitas_trabalhadas', 'Visitas'], ['custo_total', 'Custo (R$)'], ['custo_por_visita', 'R$/visita']]) : h('p', { class: 'dim', text: 'Nenhuma jornada nos pacotes carregados.' })));
    $main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Roteiro de acesso' }), h('p', { class: 'dim', text: 'O trajeto de cada dia e as paradas (visitas e fotos) saem no GeoJSON e no shapefile (trajetos_dia, paradas_dia), em SIRGAS 2000. Abra no QGIS para ver os acessos até cada imóvel.' }), h('button', { class: 'b p', id: 'btn-rota', text: 'Baixar roteiros (GeoJSON)', onclick: function () { baixar('mosaico_roteiros_' + stamp() + '.geojson', JSON.stringify({ type: 'FeatureCollection', features: E.rota(est) }), 'application/geo+json'); } })));
  }
  function render() {
    document.getElementById('hdr').textContent = Object.keys(est.imoveis).length + ' imóveis · ' + Object.keys(est.visitas).length + ' visitas · ' + Object.keys(est.fotos).length + ' fotos';
    $nav.textContent = ''; [['resumo', 'Resumo'], ['visitas', 'Visitas'], ['qualidade', 'Qualidade'], ['custos', 'Custos e roteiro'], ['exportar', 'Exportar'], ['mapa', 'Mapa offline'], ['lista', 'Distribuir aos celulares']].forEach(function (a) { $nav.appendChild(h('button', { class: aba === a[0] ? 'on' : '', text: a[1], onclick: function () { aba = a[0]; render(); } })); });
    $main.textContent = '';
    var drop = h('div', { class: 'drop', id: 'drop' }, h('p', { html: '<b>Arraste aqui</b> os pacotes .zip dos celulares (e a lista de imóveis .csv/.json), ou ' }), h('button', { class: 'b p', id: 'btn-abrir', text: 'Escolher arquivos', onclick: entrada }));
    $main.appendChild(drop); msgs.forEach(function (m) { $main.appendChild(h('div', { class: 'msg', text: m })); });
    if (aba === 'resumo') resumo(); else if (aba === 'visitas') visitas(); else if (aba === 'qualidade') qualidade(); else if (aba === 'exportar') exportar(); else if (aba === 'custos') custos(); else if (aba === 'mapa') MOSAICO_MAPA_OFF.render($main, h, baixar, msg); else lista();
  }
  function resumo() {
    var ids = Object.keys(est.imoveis), vs = Object.keys(est.visitas).map(function (k) { return est.visitas[k]; });
    var por = { PEBI: { t: 0, c: 0, a: 0 }, PESN: { t: 0, c: 0, a: 0 } };
    ids.forEach(function (id) { var p = est.imoveis[id].parque; if (!por[p]) return; por[p].t++; var v = est.visitas[id]; if (v) { if (v.status === 'concluida') por[p].c++; else por[p].a++; } });
    var area = 0, nl = 0; vs.forEach(function (v) { var t = v.dados && v.dados['b2.limite']; if (t && t.pts.length > 2) { area += t.areaM2; nl++; } });
    var q = E.qa(est).total;
    $main.appendChild(h('div', { class: 'k' }, [[ids.length || vs.length, 'imóveis'], [vs.length, 'com visita'], [q.concluidas, 'concluídas'], [Object.keys(est.fotos).length, 'fotos'], [nl, 'limites GPS'], [(area / 10000).toFixed(1), 'ha mapeados'], [q.erros, 'erros QA'], [q.avisos, 'avisos QA']].map(function (x) { return h('div', {}, h('b', { text: x[0] }), h('span', { class: 'dim', text: x[1] })); })));
    $main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Por parque' }), tabela(['PEBI', 'PESN'].map(function (p) { return { parque: p === 'PEBI' ? 'PE do Biribiri' : 'PE da Serra Negra', total: por[p].t, concluidas: por[p].c, andamento: por[p].a, pendentes: por[p].t - por[p].c - por[p].a }; }), [['parque', 'Parque'], ['total', 'Lista'], ['concluidas', 'Concluídas'], ['andamento', 'Em andamento'], ['pendentes', 'Pendentes']])));
    $main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Pacotes recebidos' }), est.pacotes.length ? tabela(est.pacotes, [['nome', 'Arquivo'], ['aparelho', 'Aparelho'], ['operador', 'Operador'], ['criadoEm', 'Gerado em'], ['visitas', 'Visitas'], ['fotos', 'Fotos'], ['fotosNovas', 'Fotos novas']]) : h('p', { class: 'dim', text: 'Nenhum pacote ainda.' })));
  }
  function visitas() {
    var rows = Object.keys(est.visitas).sort().map(function (id) { var v = est.visitas[id], im = est.imoveis[id] || {}, q = V.validar(v, im, E.fotosDe(est, id)); return { id: id, parque: im.parque, nome: im.nome, status: v.status, sit: E.rotulo(S.BLOCOS[0].campos[0], v.dados['b0.situacao_visita']), area: v.dados['b2.area_estimada_ha'] || '', fotos: E.fotosDe(est, id).length, qa: q.erros.length + ' / ' + q.avisos.length, atual: new Date(v.atualizado).toLocaleString('pt-BR'), ap: v.aparelho }; });
    $main.appendChild(h('div', { class: 'card' }, rows.length ? tabela(rows, [['id', 'ID'], ['parque', 'Parque'], ['nome', 'Imóvel'], ['status', 'Status'], ['sit', 'Situação'], ['area', 'Área (ha)'], ['fotos', 'Fotos'], ['qa', 'Erros / avisos'], ['atual', 'Atualizado'], ['ap', 'Aparelho']]) : h('p', { class: 'dim', text: 'Carregue pacotes para ver as visitas.' })));
  }
  function qualidade() {
    var q = E.qa(est);
    $main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Controle de qualidade: ' + q.total.erros + ' erros, ' + q.total.avisos + ' avisos em ' + q.total.visitas + ' visitas' }), h('div', { style: 'margin:.5rem 0' }, h('button', { class: 'b', text: 'Baixar CSV', onclick: ACOES.qa })), q.itens.length ? tabela(q.itens, [['nivel', 'Nível'], ['imovel_id', 'ID'], ['imovel', 'Imóvel'], ['mensagem', 'Mensagem'], ['status', 'Status']]) : h('p', { class: 'dim', text: 'Sem pendências.' })));
  }
  function exportar() {
    var cp = h('input', { type: 'checkbox', id: 'ck-pess' });
    $main.appendChild(h('div', { class: 'card' }, h('label', { class: 'ck' }, cp, ' Incluir dados pessoais (nome, CPF, telefone, composição familiar, liderança) em uma aba/seção separada. ', h('span', { class: 'dim', text: 'Lei 13.709/2018: use só para quem tem base e necessidade.' }))));
    var o = function () { return { pessoais: cp.checked }; };
    var bt = function (id, rot, desc, fn) { return h('div', { class: 'card' }, h('button', { class: 'b p', id: id, text: rot, onclick: function () { try { fn(o()); } catch (e) { msg('ERRO: ' + e.message); } } }), ' ', h('span', { class: 'dim', text: desc })); };
    $main.appendChild(bt('x-xlsx', 'Planilha Excel (.xlsx)', 'Abas: Visitas, Benfeitorias, Pontos GPS, Fotos, Dicionário, Qualidade.', ACOES.xlsx));
    $main.appendChild(bt('x-csv', 'CSV', 'Visitas em uma tabela (UTF-8, separador ;).', ACOES.csv));
    $main.appendChild(bt('x-shp', 'Shapefiles (.zip)', 'Limites, uso de comunidade, acessos, benfeitorias, fotos. Coordenadas WGS 84.', ACOES.shp));
    $main.appendChild(bt('x-gj', 'GeoJSON', 'Todas as geometrias em um arquivo.', ACOES.geojson));
    $main.appendChild(bt('x-pdf', 'Fichas em PDF', 'Uma ficha por imóvel, com fotos.', ACOES.pdf));
    $main.appendChild(bt('x-fotos', 'Fotos organizadas (.zip)', 'Pasta por parque e imóvel, com coordenadas gravadas na imagem (EXIF).', ACOES.fotos));
    $main.appendChild(bt('x-proj', 'Projeto consolidado (.zip)', 'Guarda tudo em um arquivo; pode ser recarregado aqui ou restaurado num celular.', ACOES.proj));
  }
  function distribuicao() {
    var rows = ['PEBI', 'PESN'].map(function (p) { var d = E.distribuicao(est, p), c = d.situacao.filter(function (x) { return x.status === 'concluida'; }).length; return { parque: p === 'PEBI' ? 'PE do Biribiri' : 'PE da Serra Negra', imoveis: d.imoveis.length, concluidas: c, andamento: d.situacao.length - c, fazer: d.imoveis.length - c }; });
    $main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Pacote de distribuição e continuação, por parque' }),
      h('p', { class: 'dim', text: 'Cada equipe trabalha um parque. Depois de carregar aqui os pacotes dos celulares, gere o arquivo do parque e envie à equipe. No celular: Enviar → Importar lista. O app passa a mostrar o que já está na central e só o que falta fazer. Use o mesmo botão para a primeira distribuição (com a lista de imóveis carregada).' }),
      tabela(rows, [['parque', 'Parque'], ['imoveis', 'Imóveis'], ['concluidas', 'Concluídos na central'], ['andamento', 'Em andamento'], ['fazer', 'A fazer']]),
      h('div', { style: 'margin-top:.6rem;display:flex;gap:.5rem;flex-wrap:wrap' }, ['PEBI', 'PESN'].map(function (p) { return h('button', { class: 'b p', id: 'btn-dist-' + p, text: 'Gerar arquivo ' + (p === 'PEBI' ? 'Biribiri' : 'Serra Negra'), onclick: function () { var d = E.distribuicao(est, p); if (!d.imoveis.length) return msg('Sem imóveis de ' + p + ' carregados'); baixar('mosaico_distribuicao_' + p + '_' + stamp() + '.json', JSON.stringify(d), 'application/json'); } }); }))));
  }
  function lista() {
    distribuicao();
    $main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Lista de imóveis para os celulares' }),
      h('p', { class: 'dim', text: 'Prepare uma planilha com as colunas: id; parque (PEBI ou PESN); nome; car; sigef; matricula; ccir; area_car_ha; municipio; comunidade. Carregue aqui para conferir e gerar o arquivo que os celulares importam. A lista pode ter centenas de linhas.' }),
      h('button', { class: 'b', text: 'Baixar modelo CSV', onclick: function () { baixar('modelo_lista_imoveis.csv', T.stringify([['id', 'parque', 'nome', 'car', 'sigef', 'matricula', 'ccir', 'area_car_ha', 'municipio', 'comunidade'], ['PEBI-001', 'PEBI', 'Exemplo', 'MG-3121605-XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX.XXXX', '', '', '', '10,5', 'Diamantina', '']]), 'text/csv'); } }), ' ',
      h('button', { class: 'b p', id: 'btn-lista', text: 'Gerar lista (.json) com imóveis carregados', onclick: function () { var a = Object.keys(est.imoveis).map(function (k) { return est.imoveis[k]; }); if (!a.length) return msg('Carregue a lista antes'); baixar('imoveis_para_celular.json', JSON.stringify(a, null, 1), 'application/json'); } })));
    var porCar = {}, dup = []; Object.keys(est.imoveis).forEach(function (id) { var c = C.normCar(est.imoveis[id].car); if (c) (porCar[c] = porCar[c] || []).push(id); });
    Object.keys(porCar).forEach(function (c) { if (porCar[c].length > 1) dup.push({ car: c, ids: porCar[c].join(', ') }); });
    var invalidos = Object.keys(est.imoveis).filter(function (id) { var c = est.imoveis[id].car; return c && !C.carValido(c); }).map(function (id) { return { id: id, nome: est.imoveis[id].nome, car: est.imoveis[id].car }; });
    $main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Conferência da lista: ' + Object.keys(est.imoveis).length + ' imóveis, ' + dup.length + ' CAR repetido(s), ' + invalidos.length + ' CAR fora do padrão' }), dup.length ? tabela(dup, [['car', 'CAR'], ['ids', 'IDs']]) : null, invalidos.length ? tabela(invalidos, [['id', 'ID'], ['nome', 'Imóvel'], ['car', 'CAR']]) : null));
  }
  render();
})();
