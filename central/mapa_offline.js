/* Central: gera o pacote de mapa (tiles de satélite) só dentro dos limites dos parques. */
(function () {
  'use strict';
  var T = MOSAICO_TILES, C = MOSAICO_CORE, P = MOSAICO_PARQUES_FULL;
  var FONTES = [
    { id: 'custom', nome: 'Outro provedor (URL própria)', url: '', atrib: '', zmax: 17, aviso: 'Use a imagem que o IEF/Funbio licenciou, ou outra que permita guardar cópia offline.' },
    { id: 'esri', nome: 'Esri World Imagery', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', atrib: 'Esri, Maxar, Earthstar Geographics e a comunidade de usuários GIS', zmax: 17, aviso: 'Não consegui confirmar nos termos da Esri se cache offline é permitido para este uso. Confirme antes com a Esri/IEF.' },
    { id: 'eox', nome: 'Sentinel-2 cloudless (EOX), ~10 m', url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/{z}/{y}/{x}.jpg', atrib: 'Sentinel-2 cloudless, https://s2maps.eu, EOX IT Services GmbH (contém dados Copernicus Sentinel modificados)', zmax: 14, aviso: 'Licença CC BY-NC-SA 4.0 (uso não comercial). Uso comercial exige licença paga da EOX. Resolução de 10 m não mostra cercas nem construções pequenas.' }
  ];
  window.MOSAICO_MAPA_OFF = { FONTES: FONTES };
  function ring(cod) { return P.features.filter(function (f) { return f.properties.codigo === cod; }).map(function (f) { return f.geometry.coordinates[0]; }); }
  function estima(parques, zmin, zmax, buf) { var polys = []; parques.forEach(function (p) { polys = polys.concat(ring(p)); }); return T.lista(polys, zmin, zmax, buf); }
  function ext(blob, ct) { return /png/i.test(ct || '') ? 'png' : /webp/i.test(ct || '') ? 'webp' : 'jpg'; }
  window.MOSAICO_MAPA_OFF.render = function (box, h, baixar, msg) {
    var st = { fonte: FONTES[0], url: '', atrib: '', zmin: 12, zmax: 16, buf: 300, pq: { PEBI: true, PESN: true }, cancel: false };
    var sel = h('select', { id: 'mp-fonte' }, FONTES.map(function (f) { return h('option', { value: f.id, text: f.nome }); }));
    var url = h('input', { type: 'text', id: 'mp-url', placeholder: 'https://…/{z}/{x}/{y}.jpg   (use {z} {x} {y})', style: 'width:100%' });
    var atr = h('input', { type: 'text', id: 'mp-atrib', placeholder: 'Texto de atribuição exigido pelo provedor', style: 'width:100%' });
    var zmin = h('input', { type: 'number', id: 'mp-zmin', value: 12, min: 8, max: 18, style: 'width:5em' }), zmax = h('input', { type: 'number', id: 'mp-zmax', value: 16, min: 8, max: 19, style: 'width:5em' });
    var ck = h('input', { type: 'checkbox', id: 'mp-ok' }), est = h('div', { id: 'mp-est', class: 'msg' }), av = h('div', { class: 'dim' }), prog = h('div', { id: 'mp-prog', class: 'dim' });
    var pebi = h('input', { type: 'checkbox', id: 'mp-pebi', checked: true }), pesn = h('input', { type: 'checkbox', id: 'mp-pesn', checked: true });
    function say(t) { prog.textContent = t; prog.style.color = 'inherit'; }
    var btn = h('button', { class: 'b p', id: 'mp-go', text: 'Baixar e gerar pacote de mapa' }), btnC = h('button', { class: 'b', text: 'Cancelar', hidden: true });
    function parques() { return [pebi.checked ? 'PEBI' : null, pesn.checked ? 'PESN' : null].filter(Boolean); }
    function atual() { var n = estima(parques(), +zmin.value, +zmax.value, st.buf); var mb = n.length * 0.025; est.textContent = n.length.toLocaleString('pt-BR') + ' tiles · cerca de ' + mb.toFixed(0) + ' MB (estimativa de ~25 KB por tile de satélite)'; return n; }
    sel.addEventListener('change', function () { var f = FONTES.filter(function (x) { return x.id === sel.value; })[0]; st.fonte = f; url.value = f.url; atr.value = f.atrib; zmax.value = Math.min(f.zmax, +zmax.value); if (+zmin.value > +zmax.value) zmin.value = Math.max(8, +zmax.value - 4); av.textContent = f.aviso; atual(); });
    [zmin, zmax, pebi, pesn].forEach(function (e) { e.addEventListener('input', atual); e.addEventListener('change', atual); });
    btnC.onclick = function () { st.cancel = true; };
    btn.onclick = function () {
      if (!ck.checked) return say('Marque a confirmação de licença antes de baixar');
      var u = url.value.trim(); if (!/\{z\}/.test(u) || !/\{x\}/.test(u) || !/\{y\}/.test(u)) return say('A URL precisa conter {z}, {x} e {y}');
      var lista = atual(); if (!lista.length) return say('Nenhum tile selecionado');
      st.cancel = false; btn.disabled = true; btnC.hidden = false; var feitos = 0, falhas = 0, vazios = 0, files = [], i = 0, bytes = 0, tipo = 'jpg';
      function um() { if (st.cancel || i >= lista.length) return Promise.resolve(); var t = lista[i++]; var addr = u.replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y);
        function tenta(n) { return fetch(addr, { mode: 'cors' }).then(function (r) { if (r.status === 404 || r.status === 204) { vazios++; return; } if (!r.ok) throw new Error(r.status); return r.blob().then(function (b) { if (b.size < 200) { vazios++; return; } tipo = ext(b, b.type); return b.arrayBuffer().then(function (a) { files.push({ name: t.z + '/' + t.x + '/' + t.y + '.' + tipo, data: new Uint8Array(a) }); bytes += b.size; }); }); }).catch(function (e) { if (n < 2) return new Promise(function (ok) { setTimeout(ok, 600 * (n + 1)); }).then(function () { return tenta(n + 1); }); falhas++; }); }
        return tenta(0).then(function () { feitos++; if (feitos % 25 === 0) prog.textContent = feitos + ' / ' + lista.length + ' tiles · ' + (bytes / 1048576).toFixed(1) + ' MB · falhas ' + falhas; return um(); }); }
      var workers = []; for (var k = 0; k < 4; k++) workers.push(um());
      Promise.all(workers).then(function () {
        btn.disabled = false; btnC.hidden = true;
        if (st.cancel) { prog.textContent = 'Cancelado.'; return; }
        prog.textContent = feitos + ' tiles processados · ' + files.length + ' baixados · ' + vazios + ' sem imagem · ' + falhas + ' falhas';
        if (!files.length) return say('Nenhum tile baixado. Se o provedor bloqueia acesso pelo navegador (CORS), use: node tools/baixar_mapa.js');
        if (falhas > lista.length * 0.05) say('Atenção: ' + falhas + ' tiles falharam. O mapa terá buracos; tente de novo.');
        var meta = { formato: 1, fonte: sel.options[sel.selectedIndex].text, atribuicao: atr.value.trim(), licencaConfirmada: true, zmin: +zmin.value, zmax: +zmax.value, parques: parques(), bufferM: st.buf, datum: 'Web Mercator (tiles XYZ); limites em SIRGAS 2000', geradoEm: new Date().toISOString(), nTiles: files.length };
        files.unshift({ name: 'mapa.json', data: JSON.stringify(meta, null, 1) });
        baixar('mapa_offline_' + parques().join('-') + '_z' + zmin.value + '-' + zmax.value + '.zip', C.makeZip(files), 'application/zip'); say('Pacote de mapa gerado: ' + files.length + ' arquivos · ' + falhas + ' falhas · ' + vazios + ' sem imagem');
      });
    };
    box.appendChild(h('div', { class: 'card' }, h('b', { text: 'Mapa de satélite offline (limites dos parques)' }),
      h('p', { class: 'dim', text: 'Baixa as imagens só dentro dos polígonos do KMZ (mais uma margem), gera um .zip e você importa nos celulares (aba Mapa → Importar mapa). Precisa de internet neste computador.' }),
      h('div', { class: 'k' }, h('label', {}, pebi, ' PE do Biribiri'), h('label', {}, pesn, ' PE da Serra Negra'), h('label', {}, 'Zoom de ', zmin, ' a ', zmax)),
      h('p', {}, 'Fonte: ', sel), h('p', {}, url), h('p', {}, atr), av,
      h('p', { class: 'dim', text: 'Referência de tamanho (margem de 300 m): zoom 16 ≈ 1.700 tiles acumulados; zoom 17 ≈ 6.300; zoom 18 ≈ 23.600.' }), est,
      h('label', { class: 'ck' }, ck, ' Confirmo que o provedor desta imagem permite baixar e guardar cópia offline para este uso, e que a atribuição acima será mantida.'),
      h('p', {}, btn, ' ', btnC), prog));
    sel.value = 'custom'; atual();

    /* ---- Importar imagem GeoTIFF (recorte feito fora do app) ---- */
    (function () {
      var G = window.MOSAICO_GEOTIFF; if (!G) return;
      var f = h('input', { type: 'file', id: 'gt-file', accept: '.tif,.tiff,image/tiff' }), tfw = h('input', { type: 'file', id: 'gt-tfw', accept: '.tfw,.wld' }), crs = h('select', { id: 'gt-crs' }, [['31983', 'SIRGAS 2000 / UTM 23S (31983)'], ['32723', 'WGS 84 / UTM 23S (32723)'], ['4674', 'SIRGAS 2000 geográfico (4674)'], ['4326', 'WGS 84 geográfico (4326)']].map(function (c) { return h('option', { value: c[0], text: c[1] }); })), info = h('div', { id: 'gt-info', class: 'msg' }), pg = h('div', { id: 'gt-prog', class: 'dim' });
      var zmn = h('input', { type: 'number', id: 'gt-zmin', value: 12, min: 8, max: 19, style: 'width:5em' }), zmx = h('input', { type: 'number', id: 'gt-zmax', value: 17, min: 8, max: 20, style: 'width:5em' });
      var fonte = h('input', { type: 'text', id: 'gt-fonte', placeholder: 'Ex.: CBERS-4A WPM fusionada (INPE), 2 m', style: 'width:100%' }), atr = h('input', { type: 'text', id: 'gt-atrib', placeholder: 'Atribuição exigida pela licença (ex.: INPE/CBERS, CC BY 4.0)', style: 'width:100%' });
      var parte = h('input', { type: 'number', id: 'gt-parte', value: 150, min: 0.05, step: 'any', style: 'width:5em' }), ok = h('input', { type: 'checkbox', id: 'gt-ok' }), est = h('input', { type: 'checkbox', id: 'gt-estirar' });
      var pb = h('input', { type: 'checkbox', id: 'gt-pebi', checked: true }), ps = h('input', { type: 'checkbox', id: 'gt-pesn', checked: true });
      var go = h('button', { class: 'b p', id: 'gt-go', text: 'Converter em pacote de mapa', disabled: true }), cn = h('button', { class: 'b', text: 'Cancelar', hidden: true }), o = null, cancel = false;
      function qs() { return [pb.checked ? 'PEBI' : null, ps.checked ? 'PESN' : null].filter(Boolean); }
      function conta() { if (!o) return; var n = estima(qs(), +zmn.value, +zmx.value, 300).length; info.textContent = o.w + '×' + o.h + ' px · ' + o.ns + ' bandas · ' + o.bits + ' bits · ' + o.P.nome + ' · ' + o.gsd.toFixed(2) + ' m/pixel (zoom nativo ≈ ' + o.zNativo.toFixed(1) + ') · ' + n.toLocaleString('pt-BR') + ' tiles, ~' + (n * 0.025).toFixed(0) + ' MB' + (+zmx.value > Math.ceil(o.zNativo) + 1 ? ' · ATENÇÃO: zoom máximo acima da resolução da imagem só amplia, sem ganhar detalhe' : ''); }
      [zmn, zmx, pb, ps].forEach(function (e) { e.addEventListener('input', conta); e.addEventListener('change', conta); });
      function abrir() {
        o = null; go.disabled = true; if (!f.files[0]) return; info.textContent = 'Lendo cabeçalho…';
        (tfw.files[0] ? tfw.files[0].text() : Promise.resolve('')).then(function (tx) { return G.abrir(f.files[0], { tfw: tx, epsg: +crs.value }); }).then(function (r) { o = r; zmx.value = Math.min(19, Math.max(12, Math.round(r.zNativo))); zmn.value = Math.max(8, +zmx.value - 5); if (r.bits !== 8) est.checked = true; go.disabled = false; conta(); }).catch(function (e) { info.textContent = 'Erro: ' + e.message; });
      }
      f.addEventListener('change', abrir); tfw.addEventListener('change', abrir); crs.addEventListener('change', abrir);
      cn.onclick = function () { cancel = true; };
      go.onclick = function () {
        if (!o) return; if (!ok.checked) { pg.textContent = 'Marque a confirmação de licença antes de converter'; return; }
        var polys = []; qs().forEach(function (c) { polys = polys.concat(ring(c)); }); if (!polys.length) { pg.textContent = 'Selecione ao menos um parque'; return; }
        cancel = false; go.disabled = true; cn.hidden = false; pg.textContent = 'Convertendo… (mantenha esta aba aberta)';
        G.converter(o, { polys: polys, zmin: +zmn.value, zmax: +zmx.value, buf: 300, estirar: est.checked, parteMB: +parte.value || 150, aoParte: function (z, i, n) { var nome = 'mapa_offline_' + qs().join('-') + '_z' + zmn.value + '-' + zmx.value + '_parte' + ('0' + i).slice(-2) + '.zip'; pg.textContent = 'Parte ' + i + ' pronta (' + n + ' tiles)…'; return baixar(nome, z, 'application/zip'); }, parques: qs(), fonte: fonte.value.trim() || 'GeoTIFF próprio', atrib: atr.value.trim() }, function (i, n, t) { pg.textContent = i + ' / ' + n + ' tiles (' + t + ')'; }, function () { return cancel; }).then(function (r) {
          go.disabled = false; cn.hidden = true; if (!r) { pg.textContent = 'Cancelado.'; return; }
          if (!r.n) { pg.textContent = 'Nenhum tile caiu dentro da imagem. Confira se o recorte cobre o parque e se o sistema de coordenadas está correto.'; return; }
          pg.textContent = 'Pronto: ' + r.partes + ' arquivo(s) .zip, ' + r.n + ' tiles · ' + r.vazios + ' fora da imagem · ' + r.parciais + ' parciais (borda). No celular: Mapa → Importar mapa e selecione todas as partes de uma vez.';
        }).catch(function (e) { go.disabled = false; cn.hidden = true; pg.textContent = 'Erro: ' + e.message; });
      };
      box.appendChild(h('div', { class: 'card' }, h('b', { text: 'Importar imagem GeoTIFF dos parques' }),
        h('p', { class: 'dim', text: 'Use o recorte de satélite que você gerou fora do app (GeoTIFF RGB, de preferência 8 bits, em SIRGAS 2000 geográfico EPSG:4674 ou UTM 23S EPSG:31983). A central converte para o pacote de mapa dos celulares; a imagem não sai deste computador. O celular não lê o .tif diretamente.' }),
        h('p', {}, f), h('p', { class: 'dim' }, 'Só se o .tif não tiver coordenadas embutidas: arquivo .tfw ', tfw, ' e sistema de coordenadas ', crs), h('div', { class: 'k' }, h('label', {}, pb, ' PE do Biribiri'), h('label', {}, ps, ' PE da Serra Negra'), h('label', {}, 'Zoom de ', zmn, ' a ', zmx)),
        h('p', {}, h('label', {}, est, ' Esticar contraste (imagens de 16 bits ou sem ajuste de brilho)')), h('p', {}, fonte), h('p', {}, atr), h('p', {}, h('label', {}, 'Tamanho máximo de cada parte (MB) ', parte)), info,
        h('label', { class: 'ck' }, ok, ' Confirmo que a licença desta imagem permite uso e distribuição aos celulares da equipe, e que a atribuição acima será mantida.'),
        h('p', {}, go, ' ', cn), pg));
    })();
  };
})();
