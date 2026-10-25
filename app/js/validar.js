/* Regras de visibilidade, preenchimento e validação (compartilhadas com a central). */
(function (root) {
  'use strict';
  var C = root.MOSAICO_CORE || require('./core.js'), S = root.MOSAICO_SCHEMA || require('./schema.js');
  var V = {};
  var NAO_VISITADA = ['nao_localizado', 'ausente', 'recusa', 'inviavel'];
  V.preenchido = function (v) {
    if (v == null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return (v.pts ? v.pts.length > 0 : v.lat != null);
    return true;
  };
  V.visivel = function (campo, dados) {
    var s = campo.show; if (!s) return true;
    var v = dados[s.f];
    if (s.eq !== undefined) return v === s.eq;
    if (s.in) return s.in.indexOf(v) >= 0;
    return true;
  };
  V.blocoAplica = function (bloco, imovel) { return !bloco.parque || (imovel && imovel.parque === bloco.parque); };
  V.blocoLiberado = function (bloco, dados) { return !bloco.needsConsent || dados['b3.consentimento'] !== 'nao'; };
  V.visitaRealizada = function (dados) { return NAO_VISITADA.indexOf(dados['b0.situacao_visita']) < 0; };
  V.blocosAtivos = function (imovel, dados) {
    var nv = !V.visitaRealizada(dados);
    return S.BLOCOS.filter(function (b) { return V.blocoAplica(b, imovel) && (!nv || b.id === 'b0'); });
  };
  /* estado do bloco: 'vazio' | 'parcial' | 'ok' | 'bloqueado' */
  V.estadoBloco = function (bloco, dados, nd) {
    nd = nd || {};
    if (!V.blocoLiberado(bloco, dados)) return 'bloqueado';
    var resp = 0, faltaReq = 0, total = 0;
    bloco.campos.forEach(function (c) {
      if (!V.visivel(c, dados)) return;
      var k = bloco.id + '.' + c.id, f = V.preenchido(dados[k]) || nd[k];
      if (c.auto && !c.req) { return; }
      total++; if (f) resp++; else if (c.req) faltaReq++;
    });
    if (!resp) return 'vazio';
    return faltaReq ? 'parcial' : 'ok';
  };
  V.validar = function (visita, imovel, fotos) {
    var d = visita.dados || {}, nd = visita.nd || {}, erros = [], avisos = [], hoje = C.hoje(), anoAtual = new Date().getFullYear();
    function E(k, b, m) { erros.push({ key: k, bloco: b, msg: m }); }
    function W(k, b, m) { avisos.push({ key: k, bloco: b, msg: m }); }
    S.BLOCOS.forEach(function (b) {
      if (!V.blocoAplica(b, imovel)) return;
      if (!V.visitaRealizada(d) && b.id !== 'b0') return;
      if (!V.blocoLiberado(b, d)) return;
      b.campos.forEach(function (c) {
        var k = b.id + '.' + c.id, v = d[k];
        if (!V.visivel(c, d)) return;
        if (c.req && !V.preenchido(v) && !nd[k]) E(k, b.id, 'Falta: ' + c.rot);
        if (!V.preenchido(v)) return;
        if (c.t === 'number') {
          var n = Number(v);
          if (isNaN(n)) E(k, b.id, c.rot + ': número inválido');
          else { if (c.min != null && n < c.min) E(k, b.id, c.rot + ': mínimo ' + c.min); if (c.max != null && n > c.max) E(k, b.id, c.rot + ': máximo ' + c.max); }
        }
        if (c.fmt === 'cpf' && !C.cpfValido(v)) E(k, b.id, 'CPF inválido');
        if (c.fmt === 'tel' && !C.telValido(v)) W(k, b.id, 'Telefone com número de dígitos estranho');
        if (c.fmt === 'car' && !C.carValido(v)) W(k, b.id, 'Nº do CAR fora do padrão (UF-IBGE-32 caracteres)');
        if (c.t === 'date' && v > hoje) E(k, b.id, 'Data no futuro');
        if (c.t === 'gps' && !C.coordValida(v.lat, v.lon)) W(k, b.id, c.rot + ': coordenada fora da região do projeto');
        if (c.t === 'gps' && v.acc > 30) W(k, b.id, c.rot + ': precisão ruim (' + Math.round(v.acc) + ' m)');
        if (c.t === 'track') {
          if (v.pts.length < 3) W(k, b.id, 'Limite com menos de 3 pontos: sem área');
          else v.pts.forEach(function (p, i) { if (!C.coordValida(p.lat, p.lon) && i === 0) W(k, b.id, 'Limite fora da região do projeto'); });
        }
        if (c.t === 'repeat') v.forEach(function (it, i) {
          c.campos.forEach(function (s) { if (s.req && !V.preenchido(it[s.id])) E(k, b.id, c.rot + ' ' + (i + 1) + ': falta ' + s.rot); });
          if (it.ano != null && it.ano !== '' && (it.ano < 1700 || it.ano > anoAtual)) E(k, b.id, c.rot + ' ' + (i + 1) + ': ano inválido');
        });
        if (c.id === 'ano_inicio' && Number(v) > anoAtual) E(k, b.id, 'Ano de início no futuro');
        if (c.t === 'multi' && v.length > 1) { var ex = v.filter(function (x) { return x === 'nenhum' || x === 'nenhuma'; }); if (ex.length && v.length > 1) W(k, b.id, c.rot + ': "nenhum" marcado junto com outras opções'); }
      });
    });
    if (V.visitaRealizada(d)) {
      var a = Number(d['b2.area_estimada_ha']), ac = Number(d['b2.area_car_ha']);
      if (a > 0 && ac > 0 && Math.abs(a - ac) / ac > 0.3) W('b2.area_estimada_ha', 'b2', 'Área estimada difere mais de 30% da área do CAR');
      var mor = Number(d['b6.n_moradores']), m60 = Number(d['b6.n_60mais']);
      if (m60 > mor) E('b6.n_60mais', 'b6', 'Moradores 60+ maior que total de moradores');
      var cats = {}; (fotos || []).forEach(function (f) { cats[f.cat] = (cats[f.cat] || 0) + 1; });
      if (!fotos || !fotos.length) W('fotos', 'b10', 'Nenhuma foto registrada');
      else if (d['b0.situacao_visita'] === 'completa') {
        if (!cats.limite) W('fotos', 'b10', 'Sem foto de limite');
        if ((d['b5.benfeitorias'] || []).length && !cats.benfeitoria) W('fotos', 'b10', 'Há benfeitorias sem foto de benfeitoria');
      }
      if (d['b3.consentimento'] === 'nao' && (V.preenchido(d['b6.n_moradores']) || V.preenchido(d['b3.cpf']))) W('b3.consentimento', 'b3', 'Há dados pessoais apesar de consentimento negado');
      var tip = d['b9.tipologia'] || []; if (tip.indexOf('nenhuma') >= 0 && tip.length > 1) W('b9.tipologia', 'b9', 'Tipologia "nenhuma" junto com outras');
    }
    return { erros: erros, avisos: avisos };
  };
  root.MOSAICO_VALIDAR = V; if (typeof module !== 'undefined' && module.exports) module.exports = V;
})(typeof self !== 'undefined' ? self : this);
