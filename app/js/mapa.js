/* Mapa: limites dos parques, imóveis coletados, trajeto do dia e imagem de satélite offline (pacote de tiles). */
(function (root) {
  'use strict';
  var A = root.MOSAICO_APP, DB = root.MOSAICO_DB, U = root.MOSAICO_UI, h = U.h, C = root.MOSAICO_CORE, G = root.MOSAICO_GPS;
  var M = {}; root.MOSAICO_MAPA = M;
  var map = null, info = null, off = null, camadas = {};
  M.pack = null;
  M.carregarInfo = function () { return DB.getMeta('mapa', null).then(function (m) { M.pack = m; return m; }); };

  /* ---- leitura de ZIP em fatias (File.slice): não carrega o arquivo inteiro; aceita ZIP64, pasta interna e DEFLATE ---- */
  function u64(dv, o) { return Number(dv.getBigUint64(o, true)); }
  function inflar(raw) { return new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  async function diretorio(file) {
    var size = file.size, tail = await file.slice(Math.max(0, size - 65557), size).arrayBuffer(), dv = new DataView(tail), i = tail.byteLength - 22;
    while (i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
    if (i < 0) throw new Error('Arquivo ZIP inválido ou incompleto');
    var n = dv.getUint16(i + 10, true), cdSize = dv.getUint32(i + 12, true), cdOff = dv.getUint32(i + 16, true);
    if (n === 0xFFFF || cdSize === 0xFFFFFFFF || cdOff === 0xFFFFFFFF) {
      if (i < 20 || dv.getUint32(i - 20, true) !== 0x07064b50) throw new Error('ZIP64 não reconhecido');
      var o64 = u64(dv, i - 12), r = new DataView(await file.slice(o64, o64 + 56).arrayBuffer());
      if (r.getUint32(0, true) !== 0x06064b50) throw new Error('ZIP64 corrompido');
      n = u64(r, 32); cdSize = u64(r, 40); cdOff = u64(r, 48);
    }
    var cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()), u8 = new Uint8Array(cd.buffer), p = 0, ents = [];
    for (var k = 0; k < n; k++) {
      if (p + 46 > cd.byteLength || cd.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP corrompido (diretório)');
      var meth = cd.getUint16(p + 10, true), cs = cd.getUint32(p + 20, true), us = cd.getUint32(p + 24, true), nl = cd.getUint16(p + 28, true), xl = cd.getUint16(p + 30, true), cl = cd.getUint16(p + 32, true), lo = cd.getUint32(p + 42, true);
      var name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      if (us === 0xFFFFFFFF || cs === 0xFFFFFFFF || lo === 0xFFFFFFFF) {
        var q = p + 46 + nl, fim = q + xl;
        while (q + 4 <= fim) { var id = cd.getUint16(q, true), sz = cd.getUint16(q + 2, true), w = q + 4; if (id === 1) { if (us === 0xFFFFFFFF) { us = u64(cd, w); w += 8; } if (cs === 0xFFFFFFFF) { cs = u64(cd, w); w += 8; } if (lo === 0xFFFFFFFF) { lo = u64(cd, w); } } q += 4 + sz; }
      }
      if (name.slice(-1) !== '/') ents.push({ name: name, meth: meth, cs: cs, lo: lo, nl: nl });
      p += 46 + nl + xl + cl;
    }
    return ents;
  }
  /* lê as entradas (já ordenadas por offset) em lotes de ~24 MB e entrega cada uma ao callback */
  async function lerLotes(file, ents, aoLote) {
    ents = ents.slice().sort(function (a, b) { return a.lo - b.lo; });
    var i = 0, LIM = 24 * 1048576;
    while (i < ents.length) {
      var j = i, tot = 0; while (j < ents.length && (j === i || tot + ents[j].cs + 300 < LIM)) { tot += ents[j].cs + 300; j++; }
      var ini = ents[i].lo, fim = Math.min(file.size, ents[j - 1].lo + 30 + ents[j - 1].nl + 65536 + ents[j - 1].cs);
      var buf = new Uint8Array(await file.slice(ini, fim).arrayBuffer()), dv = new DataView(buf.buffer), out = [];
      for (var k = i; k < j; k++) {
        var e = ents[k], r = e.lo - ini; if (dv.getUint32(r, true) !== 0x04034b50) throw new Error('ZIP corrompido (entrada ' + e.name + ')');
        var ds = r + 30 + dv.getUint16(r + 26, true) + dv.getUint16(r + 28, true), raw = buf.subarray(ds, ds + e.cs);
        if (e.meth === 0) out.push({ name: e.name, data: raw }); else if (e.meth === 8 && typeof DecompressionStream !== 'undefined') out.push({ name: e.name, data: await inflar(raw) }); else throw new Error('Compressão não suportada em ' + e.name);
      }
      await aoLote(out, j); i = j;
    }
  }
  var RX = /(?:^|\/)(\d+)\/(\d+)\/(\d+)\.(jpg|jpeg|png|webp)$/i;
  /* importa pacote de mapa: zip com (opcional) mapa.json + z/x/y.(jpg|png|webp); lê por fatias, aceita pasta interna e ZIP64 */
  M.importar = function (file, onProg) {
    return (async function () {
      var ents = await diretorio(file), tiles = [], mj = null, tipo = function (n) { return /png$/i.test(n) ? 'image/png' : /webp$/i.test(n) ? 'image/webp' : 'image/jpeg'; };
      ents.forEach(function (e) { if (/(^|\/)mapa\.json$/.test(e.name)) mj = e; else { var m = RX.exec(e.name); if (m) { e.key = m[1] + '/' + m[2] + '/' + m[3]; e.z = +m[1]; tiles.push(e); } } });
      if (!tiles.length) throw new Error('Nenhum tile z/x/y encontrado no arquivo');
      var meta;
      if (mj) { var got = []; await lerLotes(file, [mj], async function (o) { got = o; }); meta = JSON.parse(new TextDecoder().decode(got[0].data)); }
      else { var zs = tiles.map(function (t) { return t.z; }); meta = { formato: 1, fonte: file.name.replace(/\.zip$/i, ''), atribuicao: '', zmin: Math.min.apply(null, zs), zmax: Math.max.apply(null, zs), parques: [], semMetadados: true }; }
      var byKey = {}; tiles.forEach(function (t) { byKey[t.name] = t; }); var feitos = 0;
      await lerLotes(file, tiles, async function (out) {
        var arr = out.map(function (f) { return { k: byKey[f.name].key, blob: new Blob([f.data], { type: tipo(f.name) }) }; });
        await DB.putMany('tiles', arr); feitos += arr.length; if (onProg) onProg(feitos, tiles.length);
      });
      var ant = await DB.getMeta('mapa', null);
      meta.importadoEm = new Date().toISOString();
      if (ant) { meta.zmin = Math.min(meta.zmin, ant.zmin); meta.zmax = Math.max(meta.zmax, ant.zmax); meta.parques = (ant.parques || []).concat((meta.parques || []).filter(function (p) { return (ant.parques || []).indexOf(p) < 0; })); }
      meta.nTiles = await DB.count('tiles'); await DB.setMeta('mapa', meta); M.pack = meta; return meta;
    })();
  };
  M.limpar = function () { return DB.clear('tiles').then(function () { return DB.setMeta('mapa', null); }).then(function () { M.pack = null; }); };

  function estilo(c, w, f) { return { color: c, weight: w, fillOpacity: f || 0, opacity: 0.95 }; }
  M.render = function (main) {
    if (off) { off(); off = null; }
    if (map) { map.remove(); map = null; }
    var corpo = h('div', { class: 'mapabox' }); var el = h('div', { id: 'map', style: 'height:calc(100dvh - 22rem);min-height:300px;border-radius:12px;overflow:hidden;background:#cfd8cf' });
    info = h('div', { class: 'dim', style: 'margin:.4rem 0' });
    main.appendChild(el); main.appendChild(info);
    var bar = h('div', { class: 'row' }, h('button', { class: 'btn', id: 'btn-centro', text: '◎ Onde estou', onclick: function () { if (G.ultima) map.setView([G.ultima.lat, G.ultima.lon], Math.max(map.getZoom(), 16)); else U.toast('Sem posição ainda'); } }),
      h('button', { class: 'btn', id: 'btn-pebi', text: '▣ Biribiri', onclick: function () { irParque('PEBI'); } }),
      h('button', { class: 'btn', id: 'btn-pesn', text: '▣ Serra Negra', onclick: function () { irParque('PESN'); } }),
      h('button', { class: 'btn', text: 'Importar mapa', onclick: importarUI }));
    main.appendChild(bar);
    if (!root.L) { info.textContent = 'Biblioteca de mapa não carregada.'; return; }
    var L = root.L; map = L.map(el, { zoomControl: true, maxZoom: 20, minZoom: 9, attributionControl: true });
    map.setView([-18.1, -43.2], 9); setTimeout(function () { if (map) { map.invalidateSize(); if (camadas.parques) map.fitBounds(camadas.parques.getBounds()); } }, 200);
    M.carregarInfo().then(function (pk) {
      if (pk) {
        var Off = L.GridLayer.extend({ createTile: function (c, done) {
          var t = document.createElement('img'); t.alt = '';
          DB.one('tiles', c.z + '/' + c.x + '/' + c.y).then(function (r) { if (!r) return done(null, t); var u = URL.createObjectURL(r.blob); t.onload = function () { URL.revokeObjectURL(u); done(null, t); }; t.onerror = function () { done(null, t); }; t.src = u; }).catch(function () { done(null, t); });
          return t;
        } });
        new Off({ tileSize: 256, minNativeZoom: pk.zmin, maxNativeZoom: pk.zmax, maxZoom: 20, attribution: pk.atribuicao || '' }).addTo(map);
        info.textContent = 'Imagem de fundo offline: ' + (pk.fonte || 'pacote') + ' · zoom ' + pk.zmin + '–' + pk.zmax + ' · ' + pk.nTiles + ' tiles (' + (pk.parques || []).join(', ') + ')';
      } else info.textContent = 'Sem imagem de satélite neste aparelho. Toque em "Importar mapa" e escolha o pacote de mapa gerado na central. Os limites dos parques e seus dados aparecem mesmo assim.';
    });
    /* camadas vetoriais */
    if (root.MOSAICO_PARQUES) { camadas.parques = L.geoJSON(root.MOSAICO_PARQUES, { style: function () { return estilo('#fbbf24', 3); } }).addTo(map); camadas.parques.eachLayer(function (l) { l.bindTooltip(l.feature.properties.nome); }); map.fitBounds(camadas.parques.getBounds()); }
    var gj = L.layerGroup().addTo(map);
    Object.keys(A.st.visitas).forEach(function (id) {
      var v = A.st.visitas[id], d = v.dados || {}, im = A.st.imoveis.filter(function (i) { return i.id === id; })[0] || { nome: id }, cor = v.status === 'concluida' ? '#22c55e' : '#f97316';
      var lim = d['b2.limite']; if (lim && lim.pts.length > 2) L.polygon(lim.pts.map(function (p) { return [p.lat, p.lon]; }), estilo(cor, 2, 0.2)).bindTooltip(im.nome).on('click', function () { A.abrirVisita(id); }).addTo(gj);
      var ac = d['b1.ponto_acesso']; if (ac) L.circleMarker([ac.lat, ac.lon], { radius: 6, color: '#fff', weight: 2, fillColor: cor, fillOpacity: 1 }).bindTooltip('Acesso · ' + im.nome).addTo(gj);
      (d['b5.benfeitorias'] || []).forEach(function (b) { if (b.ponto) L.circleMarker([b.ponto.lat, b.ponto.lon], { radius: 4, color: '#1e3a8a', weight: 1, fillColor: '#60a5fa', fillOpacity: 1 }).bindTooltip(b.tipo + ' · ' + im.nome).addTo(gj); });
    });
    var dia = root.MOSAICO_DIA && root.MOSAICO_DIA.diaAberto() || (A.st.dias && A.st.dias[root.MOSAICO_DIA.diaId(C.hoje())]);
    if (dia && dia.trilha.length > 1) { L.polyline(dia.trilha.map(function (p) { return [p.lat, p.lon]; }), { color: '#38bdf8', weight: 4, opacity: 0.9 }).addTo(map); dia.paradas.forEach(function (p) { L.circleMarker([p.lat, p.lon], { radius: 5, color: '#0c4a6e', fillColor: '#fff', fillOpacity: 1, weight: 2 }).bindTooltip(p.tipo + (p.ref ? ' · ' + p.ref : '')).addTo(map); }); }
    /* posição atual */
    var me = L.circleMarker([0, 0], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }), acc = L.circle([0, 0], { radius: 1, color: '#2563eb', weight: 1, fillOpacity: 0.1 }), vis = false;
    if (G.suportado()) off = G.assinar(function (f) { if (!f || !map) return; if (!vis) { me.addTo(map); acc.addTo(map); vis = true; } me.setLatLng([f.lat, f.lon]); acc.setLatLng([f.lat, f.lon]).setRadius(f.acc || 10); });
  };
  function irParque(cod) { if (!camadas.parques) return; camadas.parques.eachLayer(function (l) { if (l.feature.properties.codigo === cod) map.fitBounds(l.getBounds()); }); }
  function importarUI() {
    var inp = h('input', { type: 'file', accept: '.zip,application/zip', multiple: true });
    inp.addEventListener('change', function () {
      var fs = Array.prototype.slice.call(inp.files || []).sort(function (a, b) { return a.name < b.name ? -1 : 1; }); if (!fs.length) return;
      var pg = h('p', { text: 'Lendo arquivo…' }), sh = U.sheet('Importando mapa', pg, null), k = 0, ultimo = null;
      function um() {
        if (k >= fs.length) { sh.close(); U.toast('Mapa importado: ' + ultimo.nTiles + ' tiles no aparelho', 4000); return A.render(); }
        var f = fs[k++]; pg.textContent = 'Arquivo ' + k + ' de ' + fs.length + '…';
        return M.importar(f, function (i, n) { pg.textContent = 'Arquivo ' + k + ' de ' + fs.length + ': ' + i + ' de ' + n + ' tiles'; }).then(function (m) { ultimo = m; return um(); });
      }
      um().catch(function (e) { sh.close(); var m = String(e && e.message || e); U.toast('Erro em ' + (fs[k - 1] ? fs[k - 1].name : 'arquivo') + ': ' + (/could not be read|NotReadable/i.test(m) ? 'o aparelho não conseguiu ler o arquivo (grande demais ou em nuvem). Use partes menores e copie para o aparelho antes.' : m), 8000); });
    });
    inp.click();
  }
  M.importarUI = importarUI;
})(window);
