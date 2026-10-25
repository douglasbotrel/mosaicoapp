/* Central: consolidação, controle de qualidade e exportações (XLSX/CSV/GeoJSON/Shapefile/fotos). */
(function (root) {
  'use strict';
  var req = typeof require !== 'undefined' ? require : null;
  var C = root.MOSAICO_CORE || req('../app/js/core.js'), S = root.MOSAICO_SCHEMA || req('../app/js/schema.js'), V = root.MOSAICO_VALIDAR || req('../app/js/validar.js'), PK = root.MOSAICO_PACOTE || req('../app/js/pacote.js');
  var E = {};
  E.novoEstado = function () { return { imoveis: {}, visitas: {}, fotos: {}, dias: {}, custos: {}, pacotes: [], conflitos: [], alertas: [] }; };
  /* incorpora um pacote já lido (PK.ler). Idempotente. */
  E.incorporar = function (est, pk, nome) {
    pk.imoveis.forEach(function (i) { est.imoveis[i.id] = Object.assign(est.imoveis[i.id] || {}, i); });
    var m = PK.mesclarVisitas(Object.keys(est.visitas).map(function (k) { return est.visitas[k]; }), pk.visitas);
    est.visitas = {}; m.visitas.forEach(function (v) { est.visitas[v.imovelId] = v; });
    m.conflitos.forEach(function (c) { est.conflitos.push(c); });
    (pk.dias || []).forEach(function (d) { var a = est.dias[d.id]; if (!a || String(d.atualizado) > String(a.atualizado)) est.dias[d.id] = d; });
    (pk.custos || []).forEach(function (c) { var a = est.custos[c.id]; if (!a || String(c.atualizado) > String(a.atualizado)) est.custos[c.id] = c; });
    var novas = 0; pk.fotos.forEach(function (f) { if (!est.fotos[f.id]) novas++; est.fotos[f.id] = f; });
    var outroP = pk.manifest.parque ? pk.imoveis.filter(function (i) { return i.parque && i.parque !== pk.manifest.parque; }).length : 0;
    if (outroP) est.alertas.push({ pacote: nome || '', aparelho: pk.manifest.aparelho, parque: pk.manifest.parque, n: outroP, msg: 'Pacote do aparelho ' + (pk.manifest.aparelho || '?') + ' (parque ' + pk.manifest.parque + ') traz ' + outroP + ' imóvel(is) de outro parque' });
    est.pacotes.push({ nome: nome || '', parque: pk.manifest.parque || '', equipe: pk.manifest.equipe || '', aparelho: pk.manifest.aparelho, operador: pk.manifest.operador, criadoEm: pk.manifest.criadoEm, parte: pk.manifest.parte, partes: pk.manifest.partes, visitas: pk.visitas.length, fotos: pk.fotos.length, fotosNovas: novas });
    return { visitas: pk.visitas.length, fotosNovas: novas, conflitos: m.conflitos.length };
  };
  E.incorporarLista = function (est, imoveis) { imoveis.forEach(function (i) { est.imoveis[i.id] = Object.assign(est.imoveis[i.id] || {}, i); }); };
  /* Pacote de distribuição/continuação de um parque: lista de imóveis + situação já consolidada na central. */
  E.distribuicao = function (est, parque) {
    var ims = Object.keys(est.imoveis).map(function (k) { return est.imoveis[k]; }).filter(function (i) { return i.parque === parque; });
    var nf = {}; Object.keys(est.fotos).forEach(function (k) { var id = est.fotos[k].imovelId; nf[id] = (nf[id] || 0) + 1; });
    var sit = []; ims.forEach(function (i) { var v = est.visitas[i.id]; if (v) sit.push({ imovelId: i.id, status: v.status, atualizado: v.atualizado, aparelho: v.aparelho || '', operador: v.operador || '', fotos: nf[i.id] || 0 }); });
    return { app: 'mosaico', tipo: 'distribuicao', formato: 1, parque: parque, geradoEm: new Date().toISOString(), datum: 'SIRGAS 2000 (EPSG:4674)', imoveis: ims, situacao: sit };
  };
  E.fotosDe = function (est, id) { return Object.keys(est.fotos).map(function (k) { return est.fotos[k]; }).filter(function (f) { return f.imovelId === id; }).sort(function (a, b) { return a.t < b.t ? -1 : 1; }); };
  E.rotulo = function (campo, v) {
    if (v == null || v === '') return '';
    if (campo.opts) { var L = function (x) { var o = campo.opts.filter(function (p) { return p[0] === x; })[0]; return o ? o[1] : x; }; return Array.isArray(v) ? v.map(L).join('; ') : L(v); }
    if (campo.t === 'gps') return v.lat.toFixed(6) + ', ' + v.lon.toFixed(6);
    if (campo.t === 'track') return v.pts.length + ' pontos; ' + (v.areaM2 / 10000).toFixed(2) + ' ha';
    if (campo.t === 'repeat') return v.length + ' item(ns)';
    return v;
  };
  function colKey(b, c) { return b.id + '_' + c.id; }
  E.dicionario = function () {
    var rows = [];
    S.BLOCOS.forEach(function (b) { b.campos.forEach(function (c) { rows.push({ coluna: colKey(b, c), bloco: b.titulo, campo: c.rot, tipo: c.t, unidade: c.un || '', obrigatorio: c.req ? 'sim' : '', pessoal: c.sens ? 'sim' : '', opcoes: c.opts ? c.opts.map(function (o) { return o[0] + '=' + o[1]; }).join(' | ') : '' }); }); });
    return rows;
  };
  E.tabelas = function (est, opt) {
    opt = opt || {};
    var dados = [], pess = [], benf = [], fotos = [], pontos = [], cab = {};
    Object.keys(est.visitas).sort().forEach(function (id) {
      var v = est.visitas[id], im = est.imoveis[id] || { id: id, parque: '', nome: id }, d = v.dados || {}, nd = v.nd || {};
      var fs = E.fotosDe(est, id), q = V.validar(v, im, fs);
      var row = { imovel_id: id, parque: im.parque, imovel: im.nome, car_lista: im.car || '', municipio: im.municipio || '', status: v.status, atualizado: v.atualizado, aparelho: v.aparelho || '', n_fotos: fs.length, qa_erros: q.erros.length, qa_avisos: q.avisos.length };
      var pr = { imovel_id: id, parque: im.parque, imovel: im.nome };
      S.BLOCOS.forEach(function (b) { b.campos.forEach(function (c) {
        if (c.t === 'repeat') return;
        var k = b.id + '.' + c.id, val = d[k], tgt = (c.sens && !opt.pessoaisJuntos) ? pr : row;
        if (c.t === 'track') { tgt[colKey(b, c) + '_n'] = val ? val.pts.length : ''; tgt[colKey(b, c) + '_area_ha'] = val ? +(val.areaM2 / 10000).toFixed(4) : ''; tgt[colKey(b, c) + '_perim_m'] = val ? +val.perimM.toFixed(1) : ''; return; }
        if (c.t === 'gps') { tgt[colKey(b, c) + '_lat'] = val ? +val.lat.toFixed(7) : ''; tgt[colKey(b, c) + '_lon'] = val ? +val.lon.toFixed(7) : ''; tgt[colKey(b, c) + '_prec_m'] = val && val.acc != null ? +(+val.acc).toFixed(1) : ''; return; }
        tgt[colKey(b, c)] = nd[k] ? '(prefere não informar)' : E.rotulo(c, val);
      }); });
      dados.push(row); if (Object.keys(pr).length > 3) pess.push(pr);
      (d['b5.benfeitorias'] || []).forEach(function (it, i) {
        var tp = S.BLOCOS[5].campos.filter(function (c) { return c.id === 'benfeitorias'; })[0].campos;
        benf.push({ imovel_id: id, parque: im.parque, imovel: im.nome, n: i + 1, tipo: E.rotulo(tp[0], it.tipo), ano_estimado: it.ano || '', estado: E.rotulo(tp[2], it.estado), lat: it.ponto ? +it.ponto.lat.toFixed(7) : '', lon: it.ponto ? +it.ponto.lon.toFixed(7) : '', obs: it.obs || '' });
      });
      fs.forEach(function (f, i) { fotos.push({ imovel_id: id, parque: im.parque, imovel: im.nome, foto_id: f.id, categoria: (S.FOTO_CATS.filter(function (c) { return c[0] === f.cat; })[0] || [0, f.cat])[1], legenda: f.legenda || '', data_hora: f.t, lat: f.lat != null ? +f.lat.toFixed(7) : '', lon: f.lon != null ? +f.lon.toFixed(7) : '', prec_m: f.acc != null ? +(+f.acc).toFixed(1) : '', arquivo: E.nomeFoto(im, f, i) }); });
      S.BLOCOS.forEach(function (b) { b.campos.forEach(function (c) { if (c.t === 'gps' && d[b.id + '.' + c.id]) { var g = d[b.id + '.' + c.id]; pontos.push({ imovel_id: id, parque: im.parque, imovel: im.nome, ponto: c.rot, lat: g.lat, lon: g.lon, prec_m: g.acc, leituras: g.n || '' }); } }); });
    });
    return { dados: dados, pessoais: pess, benfeitorias: benf, fotos: fotos, pontos: pontos, dicionario: E.dicionario() };
  };
  E.nomeFoto = function (im, f, i) { return C.slug(im.parque) + '/' + C.slug(im.id) + '_' + C.slug(im.nome) + '/' + C.slug(f.cat) + '_' + ('0' + (i + 1)).slice(-2) + '_' + f.id.slice(-6) + '.jpg'; };
  E.qa = function (est) {
    var out = [], tot = { visitas: 0, concluidas: 0, erros: 0, avisos: 0 };
    Object.keys(est.visitas).sort().forEach(function (id) {
      var v = est.visitas[id], im = est.imoveis[id] || { id: id, nome: id }, q = V.validar(v, im, E.fotosDe(est, id));
      tot.visitas++; if (v.status === 'concluida') tot.concluidas++; tot.erros += q.erros.length; tot.avisos += q.avisos.length;
      q.erros.forEach(function (e) { out.push({ imovel_id: id, imovel: im.nome, nivel: 'ERRO', campo: e.key, mensagem: e.msg, status: v.status }); });
      q.avisos.forEach(function (e) { out.push({ imovel_id: id, imovel: im.nome, nivel: 'AVISO', campo: e.key, mensagem: e.msg, status: v.status }); });
      if (v.status === 'concluida' && q.erros.length) out.push({ imovel_id: id, imovel: im.nome, nivel: 'ERRO', campo: 'status', mensagem: 'Concluída com erros de validação (esquema ou regras mudaram?)', status: v.status });
    });
    /* duplicidades de CAR entre imóveis */
    var porCar = {}; Object.keys(est.imoveis).forEach(function (id) { var c = C.normCar(est.imoveis[id].car); if (c) (porCar[c] = porCar[c] || []).push(id); });
    Object.keys(porCar).forEach(function (c) { if (porCar[c].length > 1) out.push({ imovel_id: porCar[c].join(','), imovel: '', nivel: 'AVISO', campo: 'car', mensagem: 'Mesmo CAR em mais de um imóvel', status: '' }); });
    /* fotos órfãs */
    Object.keys(est.fotos).forEach(function (k) { var f = est.fotos[k]; if (/^custo-/.test(f.imovelId)) return; if (!est.visitas[f.imovelId]) out.push({ imovel_id: f.imovelId, imovel: '', nivel: 'AVISO', campo: 'foto', mensagem: 'Foto sem visita correspondente', status: '' }); });
    est.conflitos.forEach(function (c) { out.push({ imovel_id: c.imovelId, imovel: '', nivel: 'AVISO', campo: 'conflito', mensagem: 'Edições em aparelhos diferentes: mantido ' + c.mantido + ', descartado ' + c.descartado, status: '' }); });
    return { itens: out, total: tot };
  };
  E.geojson = function (est) {
    var fe = [];
    Object.keys(est.visitas).forEach(function (id) {
      var v = est.visitas[id], im = est.imoveis[id] || {}, d = v.dados || {}, prop = { imovel_id: id, parque: im.parque, imovel: im.nome, status: v.status };
      var tr = d['b2.limite']; if (tr && tr.pts.length >= 3) { var r = tr.pts.map(function (p) { return [p.lon, p.lat]; }); r.push(r[0]); fe.push({ type: 'Feature', properties: Object.assign({ camada: 'limite', area_ha: +(tr.areaM2 / 10000).toFixed(4), perim_m: +tr.perimM.toFixed(1) }, prop), geometry: { type: 'Polygon', coordinates: [r] } }); }
      var tu = d['b7.limite_uso']; if (tu && tu.pts.length >= 3) { var r2 = tu.pts.map(function (p) { return [p.lon, p.lat]; }); r2.push(r2[0]); fe.push({ type: 'Feature', properties: Object.assign({ camada: 'uso_comunidade', area_ha: +(tu.areaM2 / 10000).toFixed(4) }, prop), geometry: { type: 'Polygon', coordinates: [r2] } }); }
      var ac = d['b1.ponto_acesso']; if (ac) fe.push({ type: 'Feature', properties: Object.assign({ camada: 'acesso', prec_m: ac.acc }, prop), geometry: { type: 'Point', coordinates: [ac.lon, ac.lat] } });
      (d['b5.benfeitorias'] || []).forEach(function (b, i) { if (b.ponto) fe.push({ type: 'Feature', properties: Object.assign({ camada: 'benfeitoria', tipo: b.tipo, ano: b.ano || null, n: i + 1 }, prop), geometry: { type: 'Point', coordinates: [b.ponto.lon, b.ponto.lat] } }); });
    });
    Object.keys(est.fotos).forEach(function (k) { var f = est.fotos[k]; if (/^custo-/.test(f.imovelId)) return; if (f.lat != null) { var im = est.imoveis[f.imovelId] || {}; fe.push({ type: 'Feature', properties: { camada: 'foto', imovel_id: f.imovelId, parque: im.parque, categoria: f.cat, foto_id: f.id, data_hora: f.t }, geometry: { type: 'Point', coordinates: [f.lon, f.lat] } }); } });
    fe = fe.concat(E.rota(est));
    return { type: 'FeatureCollection', name: 'mosaico', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } }, features: fe };
  };
  /* shapefiles: limites (polígono), pontos (acesso, benfeitorias), fotos (pontos). Retorna [{name,data}] */
  E.shapefiles = function (est) {
    var gj = E.geojson(est), files = [];
    function grupo(nome, tipo, filtro, campos, mk) {
      var fs = gj.features.filter(filtro); if (!fs.length) return;
      var geoms = fs.map(function (f) { if (tipo === 'point') return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }; return [f.geometry.coordinates[0].map(function (c) { return { lon: c[0], lat: c[1] }; })]; });
      var s = C.writeShapefile(tipo, geoms, campos, fs.map(function (f) { return mk(f.properties); }));
      files.push({ name: nome + '.shp', data: s.shp }, { name: nome + '.shx', data: s.shx }, { name: nome + '.dbf', data: s.dbf }, { name: nome + '.prj', data: s.prj }, { name: nome + '.cpg', data: s.cpg });
    }
    var base = [{ n: 'imovel_id', t: 'C', len: 24 }, { n: 'parque', t: 'C', len: 6 }, { n: 'imovel', t: 'C', len: 60 }, { n: 'status', t: 'C', len: 12 }];
    var pb = function (p) { return { imovel_id: p.imovel_id, parque: p.parque, imovel: p.imovel, status: p.status }; };
    grupo('limites_imoveis', 'polygon', function (f) { return f.properties.camada === 'limite'; }, base.concat([{ n: 'area_ha', t: 'N', len: 14, dec: 4 }, { n: 'perim_m', t: 'N', len: 12, dec: 1 }]), function (p) { return Object.assign(pb(p), { area_ha: p.area_ha, perim_m: p.perim_m }); });
    grupo('uso_comunidade', 'polygon', function (f) { return f.properties.camada === 'uso_comunidade'; }, base.concat([{ n: 'area_ha', t: 'N', len: 14, dec: 4 }]), function (p) { return Object.assign(pb(p), { area_ha: p.area_ha }); });
    grupo('acessos', 'point', function (f) { return f.properties.camada === 'acesso'; }, base.concat([{ n: 'prec_m', t: 'N', len: 8, dec: 1 }]), function (p) { return Object.assign(pb(p), { prec_m: p.prec_m }); });
    grupo('benfeitorias', 'point', function (f) { return f.properties.camada === 'benfeitoria'; }, base.concat([{ n: 'tipo', t: 'C', len: 16 }, { n: 'ano', t: 'N', len: 6, dec: 0 }, { n: 'n', t: 'N', len: 4, dec: 0 }]), function (p) { return Object.assign(pb(p), { tipo: p.tipo, ano: p.ano, n: p.n }); });
    grupo('fotos', 'point', function (f) { return f.properties.camada === 'foto'; }, [{ n: 'imovel_id', t: 'C', len: 24 }, { n: 'parque', t: 'C', len: 6 }, { n: 'categoria', t: 'C', len: 16 }, { n: 'foto_id', t: 'C', len: 30 }, { n: 'data_hora', t: 'C', len: 28 }], function (p) { return p; });
    var tr = gj.features.filter(function (f) { return f.properties.camada === 'trajeto'; });
    if (tr.length) { var sl = C.writeShapefile('line', tr.map(function (f) { return [f.geometry.coordinates.map(function (c) { return { lon: c[0], lat: c[1] }; })]; }), [{ n: 'data', t: 'C', len: 10 }, { n: 'aparelho', t: 'C', len: 24 }, { n: 'equipe', t: 'C', len: 4 }, { n: 'veiculo', t: 'C', len: 8 }, { n: 'km_gps', t: 'N', len: 10, dec: 1 }, { n: 'km_usado', t: 'N', len: 10, dec: 1 }], tr.map(function (f) { return f.properties; })); ['shp', 'shx', 'dbf'].forEach(function (x) { files.push({ name: 'trajetos_dia.' + x, data: sl[x] }); }); files.push({ name: 'trajetos_dia.prj', data: sl.prj }, { name: 'trajetos_dia.cpg', data: sl.cpg }); }
    grupo('paradas_dia', 'point', function (f) { return f.properties.camada === 'parada'; }, [{ n: 'data', t: 'C', len: 10 }, { n: 'aparelho', t: 'C', len: 24 }, { n: 'tipo', t: 'C', len: 10 }, { n: 'ref', t: 'C', len: 60 }, { n: 'hora', t: 'C', len: 24 }], function (p) { return p; });
    return files;
  };
  E.fotosArquivos = function (est) {
    var files = []; Object.keys(est.visitas).forEach(function (id) { var im = est.imoveis[id] || { id: id, parque: 'X', nome: id }; E.fotosDe(est, id).forEach(function (f, i) { files.push({ name: E.nomeFoto(im, f, i), data: f.data }); }); });
    Object.keys(est.fotos).forEach(function (k) { var f = est.fotos[k]; if (/^custo-/.test(f.imovelId)) { var c = est.custos[f.imovelId.slice(6)] || {}; var d = est.dias[c.dia] || {}; files.push({ name: 'comprovantes/' + (d.data || 'sem_data') + '_' + C.slug(f.legenda || 'gasto') + '_' + f.id.slice(-6) + '.jpg', data: f.data }); } });
    return files;
  };
  var VEIC = { carro: 'Carro', moto: 'Moto', a_pe: 'A pé', outro: 'Outro' }, CAT = { km_veiculo: 'Veículo (km)', combustivel: 'Combustível', diaria: 'Diárias', alimentacao: 'Alimentação', hospedagem: 'Hospedagem', pedagio: 'Pedágio/balsa', manutencao: 'Manutenção', material: 'Material/EPI', outros: 'Outros' };
  E.CAT = CAT;
  function ldate(iso) { var d = new Date(iso), p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  E.kmDia = function (d) { var g = (d.distGpsM || 0) / 1000, o = (d.odoIni != null && d.odoFim != null && d.odoFim >= d.odoIni) ? d.odoFim - d.odoIni : null; return { gps: g, odo: o, usado: o != null ? o : g }; };
  /* uma linha por jornada, com custos por categoria e custo por visita */
  E.jornadas = function (est) {
    return Object.keys(est.dias).sort().map(function (id) {
      var d = est.dias[id], km = E.kmDia(d), cs = Object.keys(est.custos).map(function (k) { return est.custos[k]; }).filter(function (c) { return c.dia === id; });
      var nv = Object.keys(est.visitas).filter(function (k) { var v = est.visitas[k]; return ldate(v.atualizado) === d.data && (!v.aparelho || v.aparelho === d.aparelho); }).length;
      var ncl = Object.keys(est.visitas).filter(function (k) { var v = est.visitas[k]; return v.status === 'concluida' && v.concluidaEm && ldate(v.concluidaEm) === d.data && (!v.aparelho || v.aparelho === d.aparelho); }).length;
      var row = { data: d.data, aparelho: d.aparelho, equipe: d.equipe || '', operador: d.operador || '', veiculo: VEIC[d.veiculo] || d.veiculo, pessoas: d.pessoas, status: d.status, horas: d.inicio ? +(((d.fim ? new Date(d.fim) : new Date(d.atualizado)) - new Date(d.inicio)) / 3600000).toFixed(2) : '', km_gps: +km.gps.toFixed(1), km_hodometro: km.odo != null ? +km.odo.toFixed(1) : '', km_usado: +km.usado.toFixed(1), lacunas_gps: d.lacunas || 0, visitas_trabalhadas: nv, visitas_concluidas: ncl };
      var tot = 0; Object.keys(CAT).forEach(function (c) { var v = cs.filter(function (x) { return x.cat === c; }).reduce(function (s, x) { return s + (+x.valor || 0); }, 0); row[CAT[c]] = +v.toFixed(2); tot += v; });
      row.custo_total = +tot.toFixed(2); row.custo_por_visita = nv ? +(tot / nv).toFixed(2) : ''; row.custo_por_km = km.usado ? +(tot / km.usado).toFixed(2) : '';
      return row;
    });
  };
  E.custosLinhas = function (est) {
    return Object.keys(est.custos).map(function (k) { return est.custos[k]; }).sort(function (a, b) { return a.dia < b.dia ? -1 : 1; }).map(function (c) { var d = est.dias[c.dia] || {}; var comp = Object.keys(est.fotos).filter(function (f) { return est.fotos[f].imovelId === 'custo-' + c.id; }).length; return { data: d.data || '', aparelho: d.aparelho || c.aparelho || '', categoria: CAT[c.cat] || c.cat, descricao: c.desc || '', quantidade: c.qtd != null ? c.qtd : '', valor: +(+c.valor).toFixed(2), origem: c.origem, comprovantes: comp }; });
  };
  E.rota = function (est) {
    var fe = []; Object.keys(est.dias).sort().forEach(function (id) { var d = est.dias[id], km = E.kmDia(d), prop = { data: d.data, aparelho: d.aparelho, equipe: d.equipe, veiculo: VEIC[d.veiculo] || d.veiculo, km_gps: +km.gps.toFixed(1), km_usado: +km.usado.toFixed(1) };
      if (d.trilha && d.trilha.length > 1) fe.push({ type: 'Feature', properties: Object.assign({ camada: 'trajeto' }, prop), geometry: { type: 'LineString', coordinates: d.trilha.map(function (p) { return [p.lon, p.lat]; }) } });
      (d.paradas || []).forEach(function (p) { fe.push({ type: 'Feature', properties: { camada: 'parada', data: d.data, aparelho: d.aparelho, tipo: p.tipo, ref: p.ref || '', hora: new Date(p.t).toISOString() }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } }); }); });
    return fe;
  };
  /* pacote consolidado (mesmo formato do celular) para guardar o projeto */
  E.consolidado = function (est, aparelho) {
    var fotos = Object.keys(est.fotos).map(function (k) { var f = est.fotos[k], o = {}; Object.keys(f).forEach(function (x) { if (x !== 'data' && x !== 'arquivo' && x !== 'bytes') o[x] = f[x]; }); o.blob = new Blob([f.data]); return o; });
    return PK.montar({ imoveis: Object.keys(est.imoveis).map(function (k) { return est.imoveis[k]; }), visitas: Object.keys(est.visitas).map(function (k) { return est.visitas[k]; }), fotos: fotos, dias: Object.keys(est.dias).map(function (k) { return est.dias[k]; }), custos: Object.keys(est.custos).map(function (k) { return est.custos[k]; }), aparelho: aparelho || 'central', operador: 'central' });
  };
  root.MOSAICO_EXPORT = E; if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof self !== 'undefined' ? self : this);
