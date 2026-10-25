/* Pacote de transferência (.zip): celular -> computador, e restauração. */
(function (root) {
  'use strict';
  var C = root.MOSAICO_CORE || require('./core.js'), S = root.MOSAICO_SCHEMA || require('./schema.js');
  var P = {};
  function json(o) { return JSON.stringify(o, null, 1); }
  function blobToU8(b) { return b.arrayBuffer().then(function (a) { return new Uint8Array(a); }); }
  P.nomePacote = function (aparelho, parte, partes) {
    var d = new Date(), p2 = function (n) { return ('0' + n).slice(-2); };
    return 'mosaico_' + C.slug(aparelho || 'aparelho') + '_' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + (partes > 1 ? '_p' + parte + 'de' + partes : '') + '.zip';
  };
  /* in: {imoveis, visitas, fotos:[{...meta, blob}], aparelho, operador, parte, partes} */
  P.montar = function (inp) {
    var imoveis = inp.imoveis || [], visitas = inp.visitas || [], fotos = inp.fotos || [], dias = inp.dias || [], custos = inp.custos || [];
    return Promise.all(fotos.map(function (f) { return blobToU8(f.blob); })).then(function (bufs) {
      var files = [], metas = [];
      fotos.forEach(function (f, i) {
        var u8 = bufs[i], nome = 'fotos/' + f.id + '.jpg';
        if (f.lat != null && f.lon != null) { try { u8 = C.jpegWithGps(u8, f.lat, f.lon, f.alt); } catch (e) {} }
        files.push({ name: nome, data: u8 });
        var m = {}; Object.keys(f).forEach(function (k) { if (k !== 'blob') m[k] = f[k]; }); m.arquivo = nome; m.bytes = u8.length; metas.push(m);
      });
      var manifest = { app: 'mosaico', formato: 1, schema: S.SCHEMA_VERSION, criadoEm: new Date().toISOString(), aparelho: inp.aparelho || '', operador: inp.operador || '',
        parte: inp.parte || 1, partes: inp.partes || 1, datum: 'SIRGAS 2000 (EPSG:4674)', n: { imoveis: imoveis.length, visitas: visitas.length, fotos: fotos.length, dias: dias.length, custos: custos.length } };
      var head = [{ name: 'manifest.json', data: json(manifest) }, { name: 'imoveis.json', data: json(imoveis) }, { name: 'visitas.json', data: json(visitas) }, { name: 'fotos.json', data: json(metas) }, { name: 'dias.json', data: JSON.stringify(dias) }, { name: 'custos.json', data: json(custos) }];
      return C.makeZip(head.concat(files));
    });
  };
  P.ler = function (buf) {
    return C.readZip(buf).then(function (fs) {
      var by = {}; fs.forEach(function (f) { by[f.name] = f.data; });
      function J(n) { if (!by[n]) throw new Error('Pacote sem ' + n); return JSON.parse(new TextDecoder().decode(by[n])); }
      var manifest = J('manifest.json');
      if (manifest.app !== 'mosaico') throw new Error('Este arquivo não é um pacote do Mosaico');
      if (manifest.formato > 1) throw new Error('Pacote de versão mais nova; atualize o aplicativo');
      var fotos = J('fotos.json').map(function (m) { var d = by[m.arquivo]; if (!d) throw new Error('Foto ausente: ' + m.arquivo); m.data = d; return m; });
      return { manifest: manifest, imoveis: J('imoveis.json'), visitas: J('visitas.json'), fotos: fotos, dias: by['dias.json'] ? J('dias.json') : [], custos: by['custos.json'] ? J('custos.json') : [] };
    });
  };
  /* mescla visitas: vence a mais recente (campo "atualizado"); registra conflito quando aparelhos diferentes editaram o mesmo imóvel */
  P.mesclarVisitas = function (atuais, novas) {
    var m = {}, conflitos = [];
    atuais.forEach(function (v) { m[v.imovelId] = v; });
    novas.forEach(function (v) {
      var a = m[v.imovelId];
      if (!a) { m[v.imovelId] = v; return; }
      if (a.atualizado === v.atualizado) return;
      if (a.aparelho && v.aparelho && a.aparelho !== v.aparelho) conflitos.push({ imovelId: v.imovelId, mantido: a.atualizado >= v.atualizado ? a.aparelho : v.aparelho, descartado: a.atualizado >= v.atualizado ? v.aparelho : a.aparelho });
      if (v.atualizado > a.atualizado) m[v.imovelId] = v;
    });
    return { visitas: Object.keys(m).map(function (k) { return m[k]; }), conflitos: conflitos };
  };
  /* mescla genérica por id: vence o de "atualizado" mais recente */
  P.mesclarPorId = function (atuais, novos) {
    var m = {}; atuais.concat(novos).forEach(function (x) { var a = m[x.id]; if (!a || String(x.atualizado) > String(a.atualizado)) m[x.id] = x; });
    return Object.keys(m).map(function (k) { return m[k]; });
  };
  root.MOSAICO_PACOTE = P; if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof self !== 'undefined' ? self : this);
