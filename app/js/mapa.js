/* Mapa: limites dos parques, imóveis coletados, trajeto do dia e imagem de satélite offline (pacote de tiles). */
(function (root) {
  'use strict';
  var A = root.MOSAICO_APP, DB = root.MOSAICO_DB, U = root.MOSAICO_UI, h = U.h, C = root.MOSAICO_CORE, G = root.MOSAICO_GPS;
  var M = {}; root.MOSAICO_MAPA = M;
  var map = null, info = null, off = null, camadas = {};
  M.pack = null;
  M.carregarInfo = function () { return DB.getMeta('mapa', null).then(function (m) { M.pack = m; return m; }); };

  /* importa pacote de mapa: zip com mapa.json + z/x/y.(jpg|png) */
  M.importar = function (file, onProg) {
    return file.arrayBuffer().then(function (buf) { return C.readZip(buf); }).then(function (fs) {
      var mj = fs.filter(function (f) { return f.name === 'mapa.json'; })[0]; if (!mj) throw new Error('Pacote de mapa sem mapa.json');
      var meta = JSON.parse(new TextDecoder().decode(mj.data)), tiles = fs.filter(function (f) { return /^\d+\/\d+\/\d+\.(jpg|jpeg|png|webp)$/i.test(f.name); }), i = 0;
      var tipo = function (n) { return /png$/i.test(n) ? 'image/png' : /webp$/i.test(n) ? 'image/webp' : 'image/jpeg'; };
      function lote() {
        if (i >= tiles.length) return Promise.resolve();
        var arr = tiles.slice(i, i + 400).map(function (f) { var p = f.name.replace(/\.\w+$/, ''); return { k: p, blob: new Blob([f.data], { type: tipo(f.name) }) }; });
        i += arr.length; if (onProg) onProg(i, tiles.length);
        return DB.putMany('tiles', arr).then(lote);
      }
      return lote().then(function () { meta.nTiles = tiles.length; meta.importadoEm = new Date().toISOString(); return DB.setMeta('mapa', meta).then(function () { M.pack = meta; return meta; }); });
    });
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
    var inp = h('input', { type: 'file', accept: '.zip,application/zip' });
    inp.addEventListener('change', function () {
      var f = inp.files[0]; if (!f) return; var pg = h('p', { text: 'Lendo arquivo…' }), sh = U.sheet('Importando mapa', pg, null);
      M.importar(f, function (i, n) { pg.textContent = i + ' de ' + n + ' tiles'; }).then(function (m) { sh.close(); U.toast('Mapa importado: ' + m.nTiles + ' tiles', 4000); A.render(); }).catch(function (e) { sh.close(); U.toast('Erro: ' + e.message, 6000); });
    });
    inp.click();
  }
  M.importarUI = importarUI;
})(window);
