/* CSV simples (aspas, ; , ou tab) e leitura da lista de imóveis. */
(function (root) {
  'use strict';
  var T = {};
  T.parse = function (txt) {
    txt = String(txt).replace(/^﻿/, '');
    var first = txt.split(/\r?\n/, 1)[0] || '', d = ';', best = 0;
    [';', ',', '\t'].forEach(function (c) { var n = first.split(c).length; if (n > best) { best = n; d = c; } });
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < txt.length; i++) {
      var c = txt[i];
      if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === d) { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (c !== '\r') cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  };
  T.stringify = function (rows, d) {
    d = d || ';';
    return '﻿' + rows.map(function (r) { return r.map(function (x) { x = x == null ? '' : String(x); return /[";\n\r,\t]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(d); }).join('\r\n') + '\r\n';
  };
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
  var ALIAS = { id: 'id', codigo: 'id', cod: 'id', parque: 'parque', uc: 'parque', unidade: 'parque', nome: 'nome', imovel: 'nome', denominacao: 'nome', nome_do_imovel: 'nome', car: 'car', n_car: 'car', numero_car: 'car', cod_car: 'car', num_car: 'car', sigef: 'sigef', parcela_sigef: 'sigef', matricula: 'matricula', ccir: 'ccir', area_car_ha: 'area_car_ha', area_ha: 'area_car_ha', area: 'area_car_ha', municipio: 'municipio', comunidade: 'comunidade', declarante: 'declarante', obs: 'obs', observacao: 'obs' };
  function parque(s) { var n = norm(s); if (/^pebi$|biribiri/.test(n)) return 'PEBI'; if (/^pesn$|serra_negra/.test(n)) return 'PESN'; return ''; }
  T.imoveisDeTabela = function (rows) {
    var avisos = [], out = [];
    if (rows.length < 2) return { imoveis: [], avisos: ['Arquivo sem linhas de dados'] };
    var cols = rows[0].map(function (h) { return ALIAS[norm(h)] || null; });
    if (cols.indexOf('parque') < 0) avisos.push('Coluna "parque" não encontrada (use PEBI ou PESN)');
    if (cols.indexOf('car') < 0 && cols.indexOf('id') < 0 && cols.indexOf('nome') < 0) return { imoveis: [], avisos: ['Nenhuma coluna reconhecida (id, parque, nome, car…)'] };
    var vistos = {};
    rows.slice(1).forEach(function (r, i) {
      var o = {}; cols.forEach(function (c, k) { if (c && r[k] != null && String(r[k]).trim() !== '') o[c] = String(r[k]).trim(); });
      o.parque = parque(o.parque); if (!o.parque) { avisos.push('Linha ' + (i + 2) + ': parque inválido, ignorada'); return; }
      if (o.car) o.car = o.car.toUpperCase();
      if (o.area_car_ha) { var a = parseFloat(String(o.area_car_ha).replace(/\./g, function (m, off, s) { return s.indexOf(',') >= 0 ? '' : '.'; }).replace(',', '.')); o.area_car_ha = isNaN(a) ? null : a; }
      if (!o.id) o.id = o.parque + '-' + (o.car ? o.car.replace(/[^A-Z0-9]/g, '').slice(-10) : ('000' + (i + 1)).slice(-4));
      if (!o.nome) o.nome = o.car ? 'CAR ' + o.car.slice(-9) : o.id;
      if (vistos[o.id]) { avisos.push('Linha ' + (i + 2) + ': id repetido (' + o.id + '), ignorada'); return; }
      vistos[o.id] = 1; out.push(o);
    });
    return { imoveis: out, avisos: avisos };
  };
  root.MOSAICO_CSV = T; if (typeof module !== 'undefined' && module.exports) module.exports = T;
})(typeof self !== 'undefined' ? self : this);
