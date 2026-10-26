/* Converte um GeoTIFF (recorte da imagem de satélite dos parques) em pacote de mapa offline do Mosaico (tiles XYZ).
   Roda no navegador do computador; a imagem não sai da máquina. Usa geotiff.js (MIT) para ler o arquivo. */
(function (root) {
  'use strict';
  var G = {}, req = typeof require !== 'undefined' ? require : null;
  var T = root.MOSAICO_TILES || (req && req('../app/js/tiles.js')), C = root.MOSAICO_CORE || (req && req('../app/js/core.js'));
  var R = Math.PI / 180, A_ = 6378137, N_ = (1 / 298.257222101) / (2 - 1 / 298.257222101);
  var AA = A_ / (1 + N_) * (1 + N_ * N_ / 4 + Math.pow(N_, 4) / 64);
  var AL = [N_ / 2 - 2 * N_ * N_ / 3 + 5 * Math.pow(N_, 3) / 16, 13 * N_ * N_ / 48 - 3 * Math.pow(N_, 3) / 5, 61 * Math.pow(N_, 3) / 240];
  /* UTM (Transverse Mercator, série de Krüger): lon/lat em graus -> [E, N] em metros */
  function tm(lon, lat, zona, sul) {
    var dl = lon * R - (zona * 6 - 183) * R, sp = Math.sin(lat * R), k = 2 * Math.sqrt(N_) / (1 + N_);
    var t = Math.sinh(Math.atanh(sp) - k * Math.atanh(k * sp));
    var xi0 = Math.atan2(t, Math.cos(dl)), eta0 = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t)), xi = xi0, eta = eta0;
    for (var j = 1; j <= 3; j++) { xi += AL[j - 1] * Math.sin(2 * j * xi0) * Math.cosh(2 * j * eta0); eta += AL[j - 1] * Math.cos(2 * j * xi0) * Math.sinh(2 * j * eta0); }
    return [500000 + 0.9996 * AA * eta, (sul ? 1e7 : 0) + 0.9996 * AA * xi];
  }
  /* sistemas aceitos. SIRGAS 2000 e WGS 84 são tratados como iguais (IBGE: sem parâmetros de transformação) */
  G.proj = function (epsg) {
    if (epsg === 4326 || epsg === 4674) return { nome: 'EPSG:' + epsg, graus: true, fwd: function (lon, lat) { return [lon, lat]; } };
    if (epsg === 3857) return { nome: 'EPSG:3857', fwd: function (lon, lat) { return [lon * R * A_, A_ * Math.log(Math.tan(Math.PI / 4 + lat * R / 2))]; } };
    var z, sul;
    if (epsg >= 32601 && epsg <= 32660) { z = epsg - 32600; sul = false; } else if (epsg >= 32701 && epsg <= 32760) { z = epsg - 32700; sul = true; } else if (epsg >= 31978 && epsg <= 31985) { z = epsg - 31960; sul = true; } else return null;
    return { nome: 'EPSG:' + epsg, fwd: function (lon, lat) { return tm(lon, lat, z, sul); } };
  };
  G.tm = tm;
  function zNativo(gsd, lat) { return Math.log(156543.03392 * Math.cos(lat * R) / gsd) / Math.LN2; }

  /* abre o arquivo e devolve o que a tela precisa mostrar */
  G.abrir = function (file) {
    var GT = root.GeoTIFF; if (!GT) return Promise.reject(new Error('Leitor de GeoTIFF não carregado'));
    return GT.fromBlob(file).then(function (tiff) { return tiff.getImage().then(function (img) {
      var fd = img.getFileDirectory(), keys = img.getGeoKeys() || {}, o = {};
      o.tiff = tiff; o.img = img; o.w = img.getWidth(); o.h = img.getHeight(); o.ns = img.getSamplesPerPixel();
      var pr = keys.ProjectedCSTypeGeoKey, gg = keys.GeographicTypeGeoKey;
      o.epsg = pr && pr !== 32767 ? pr : gg;
      o.P = G.proj(o.epsg);
      if (!o.P) throw new Error('Sistema de coordenadas ' + (o.epsg ? 'EPSG:' + o.epsg : 'não identificado') + ' não suportado. Reprojete a imagem para SIRGAS 2000 (EPSG:4674) ou SIRGAS 2000 / UTM (EPSG:31983 para os dois parques) e tente de novo.');
      var mt = fd.ModelTransformation; if (mt && (Math.abs(mt[1]) > 1e-12 || Math.abs(mt[4]) > 1e-12)) throw new Error('A imagem está rotacionada; reprojete para a grade norte-sul.');
      var org, res; try { org = img.getOrigin(); res = img.getResolution(); } catch (e) { throw new Error('O arquivo não tem georreferenciamento (GeoTIFF). Exporte de novo como GeoTIFF.'); }
      o.x0 = org[0]; o.y0 = org[1]; o.rx = res[0]; o.ry = res[1]; if (!(o.ry < 0)) o.ry = -Math.abs(o.ry);
      if (keys.GTRasterTypeGeoKey === 2) { o.x0 -= o.rx / 2; o.y0 -= o.ry / 2; }
      if (fd.PhotometricInterpretation === 3) throw new Error('Imagem com paleta de cores não é suportada; exporte em RGB.');
      o.bits = img.getBitsPerSample(0); o.fmt = img.getSampleFormat(0); o.nodata = img.getGDALNoData();
      var ex = fd.ExtraSamples; ex = ex ? (ex.length != null ? Array.prototype.slice.call(ex) : [ex]) : [];
      o.alpha = (o.ns === 4 || o.ns === 2) && ex.length && (ex[ex.length - 1] === 1 || ex[ex.length - 1] === 2) ? o.ns - 1 : -1;
      o.cor = o.ns >= 3 ? [0, 1, 2] : [0];
      var lat0 = o.P.graus ? o.y0 + o.ry * o.h / 2 : -18.1;
      o.gsd = o.P.graus ? Math.abs(o.rx) * 111320 * Math.cos(lat0 * R) : (o.P.nome === 'EPSG:3857' ? Math.abs(o.rx) * Math.cos(lat0 * R) : Math.abs(o.rx));
      o.zNativo = zNativo(o.gsd, lat0);
      o.mb = o.w * o.h * o.ns * (o.bits / 8) / 1048576;
      return tiff.getImageCount().then(function (n) { o.nImg = n; return o; });
    }); });
  };

  /* contraste: imagens de 8 bits passam direto; as demais (16 bits, float) são esticadas pelos percentis 2 e 98 de uma visão reduzida */
  G.limites = function (o, estirar) {
    var id = o.cor.map(function () { return [0, 255]; });
    if (!estirar && o.bits === 8 && o.fmt !== 3) return Promise.resolve(id);
    function menor(i, best) { if (i >= o.nImg) return Promise.resolve(best); return o.tiff.getImage(i).then(function (im) { var ok = im.getWidth() >= 400 || !best; return menor(i + 1, ok && (!best || im.getWidth() < best.getWidth()) ? im : best); }); }
    return menor(0, null).then(function (im) {
      var w = im.getWidth(), h = im.getHeight(), k = Math.min(1, 1200 / w);
      return im.readRasters({ samples: o.cor, width: Math.round(w * k), height: Math.round(h * k), resampleMethod: 'nearest', interleave: false });
    }).then(function (bs) {
      return bs.map(function (b) {
        var v = [], step = Math.max(1, Math.floor(b.length / 200000));
        for (var i = 0; i < b.length; i += step) { var x = b[i]; if (x === o.nodata || x !== x || x === 0) continue; v.push(x); }
        if (v.length < 10) return [0, o.bits === 8 ? 255 : 1];
        v.sort(function (a, c) { return a - c; }); var lo = v[Math.floor(v.length * 0.02)], hi = v[Math.min(v.length - 1, Math.floor(v.length * 0.98))];
        return [lo, hi > lo ? hi : lo + 1];
      });
    });
  };

  /* coordenadas de origem (em pixels do GeoTIFF) para a grade 17x17 de um tile */
  function controle(o, t) {
    var n = Math.pow(2, t.z), g = new Float64Array(17 * 17 * 2), minx = 1e18, miny = 1e18, maxx = -1e18, maxy = -1e18;
    for (var gy = 0; gy < 17; gy++) for (var gx = 0; gx < 17; gx++) {
      var lon = (t.x + gx / 16) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (t.y + gy / 16) / n))) / R;
      var xy = o.P.fwd(lon, lat), px = (xy[0] - o.x0) / o.rx, py = (xy[1] - o.y0) / o.ry, k = (gy * 17 + gx) * 2;
      g[k] = px; g[k + 1] = py; if (px < minx) minx = px; if (px > maxx) maxx = px; if (py < miny) miny = py; if (py > maxy) maxy = py;
    }
    return { g: g, box: [minx, miny, maxx, maxy] };
  }
  /* desenha um tile 256x256 RGBA a partir da janela lida */
  function desenhar(o, ctl, win, bandas, lim) {
    var out = new Uint8ClampedArray(256 * 256 * 4), g = ctl.g, ww = win.w, wh = win.h, nb = bandas.length, validos = 0, temNd = o.nodata != null && o.nodata === o.nodata;
    var esc = lim.map(function (l) { return 255 / (l[1] - l[0]); }), alf = win.alpha;
    for (var j = 0; j < 256; j++) {
      var cy = Math.min(15, j >> 4), vy = (j + 0.5) / 16 - cy;
      for (var i = 0; i < 256; i++) {
        var cx = Math.min(15, i >> 4), ux = (i + 0.5) / 16 - cx, k00 = (cy * 17 + cx) * 2, k10 = k00 + 2, k01 = k00 + 34, k11 = k01 + 2;
        var px = (g[k00] * (1 - ux) + g[k10] * ux) * (1 - vy) + (g[k01] * (1 - ux) + g[k11] * ux) * vy;
        var py = (g[k00 + 1] * (1 - ux) + g[k10 + 1] * ux) * (1 - vy) + (g[k01 + 1] * (1 - ux) + g[k11 + 1] * ux) * vy;
        var o4 = (j * 256 + i) * 4;
        if (px < 0 || py < 0 || px >= o.w || py >= o.h) continue;
        var sx = px - 0.5 - win.x, sy = py - 0.5 - win.y, ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
        var x0 = Math.max(0, Math.min(ww - 1, ix)), x1 = Math.max(0, Math.min(ww - 1, ix + 1)), y0 = Math.max(0, Math.min(wh - 1, iy)), y1 = Math.max(0, Math.min(wh - 1, iy + 1));
        var a00 = y0 * ww + x0, a10 = y0 * ww + x1, a01 = y1 * ww + x0, a11 = y1 * ww + x1, nn = (fx < 0.5 ? a00 : a10), nm = (fy < 0.5 ? (fx < 0.5 ? a00 : a10) : (fx < 0.5 ? a01 : a11));
        if (alf && alf[nm] === 0) continue;
        if (temNd) { var todo = true; for (var b = 0; b < nb; b++) if (bandas[b][nm] !== o.nodata) { todo = false; break; } if (todo) continue; }
        var c = [0, 0, 0];
        for (var b2 = 0; b2 < nb; b2++) {
          var B = bandas[b2], v = (B[a00] * (1 - fx) + B[a10] * fx) * (1 - fy) + (B[a01] * (1 - fx) + B[a11] * fx) * fy;
          v = (v - lim[b2][0]) * esc[b2]; c[b2] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
        out[o4] = c[0]; out[o4 + 1] = nb > 1 ? c[1] : c[0]; out[o4 + 2] = nb > 1 ? c[2] : c[0]; out[o4 + 3] = 255; validos++;
      }
    }
    return { px: out, validos: validos };
  }
  function blobDe(canvas, tipo, q) { return new Promise(function (res) { canvas.toBlob(res, tipo, q); }); }
  function pausa() { return new Promise(function (r) { setTimeout(r, 0); }); }

  /* o: resultado de G.abrir; opt: {polys, zmin, zmax, buf, qualidade, estirar, parques, fonte, atrib}; prog(i,n,txt); cancelado() */
  G.converter = function (o, opt, prog, cancelado) {
    var lista = T.lista(opt.polys, opt.zmin, opt.zmax, opt.buf), canvas = root.document.createElement('canvas'), ctx = canvas.getContext('2d');
    canvas.width = canvas.height = 256;
    var files = [], bytes = 0, partes = 0, nTot = 0, vazios = 0, parciais = 0, feitos = 0, LIM = 40e6, q = opt.qualidade || 0.88, maxB = (opt.parteMB || 150) * 1048576;
    lista.sort(function (a, b) { return a.z - b.z || a.y - b.y || a.x - b.x; });
    /* grupos: mesma linha de tiles, janela de leitura limitada */
    var grupos = [], atual = null;
    lista.forEach(function (t) {
      var c = controle(o, t), b = c.box;
      if (b[2] < 0 || b[3] < 0 || b[0] >= o.w || b[1] >= o.h) { vazios++; return; }
      var w = [Math.max(0, Math.floor(b[0]) - 2), Math.max(0, Math.floor(b[1]) - 2), Math.min(o.w, Math.ceil(b[2]) + 2), Math.min(o.h, Math.ceil(b[3]) + 2)];
      if (atual && atual.z === t.z && atual.y === t.y) {
        var u = [Math.min(atual.w[0], w[0]), Math.min(atual.w[1], w[1]), Math.max(atual.w[2], w[2]), Math.max(atual.w[3], w[3])];
        if ((u[2] - u[0]) * (u[3] - u[1]) <= LIM) { atual.w = u; atual.t.push({ t: t, c: c }); return; }
      }
      atual = { z: t.z, y: t.y, w: w, t: [{ t: t, c: c }] }; grupos.push(atual);
    });
    var total = lista.length;
    function metaDe() { return { formato: 1, fonte: opt.fonte || 'GeoTIFF próprio', atribuicao: opt.atrib || '', licencaConfirmada: true, zmin: opt.zmin, zmax: opt.zmax, parques: opt.parques, bufferM: opt.buf,
      origem: 'GeoTIFF ' + o.P.nome + ', ' + o.gsd.toFixed(2) + ' m/pixel', datum: 'Web Mercator (tiles XYZ); imagem de origem ' + o.P.nome + ' (SIRGAS 2000 e WGS 84 tratados como iguais)', geradoEm: new Date().toISOString() }; }
    function fecha() {
      if (!files.length) return Promise.resolve();
      var m = metaDe(); partes++; m.parte = partes; m.nTiles = files.length; nTot += files.length;
      var z = C.makeZip([{ name: 'mapa.json', data: JSON.stringify(m, null, 1) }].concat(files)); files = []; bytes = 0;
      return Promise.resolve(opt.aoParte(z, partes, m.nTiles));
    }
    return G.limites(o, opt.estirar).then(function (lim) {
      return grupos.reduce(function (p, gr) { return p.then(function () {
        if (cancelado && cancelado()) return;
        var idx = o.cor.slice(); if (o.alpha >= 0) idx.push(o.alpha);
        return o.img.readRasters({ window: gr.w, samples: idx, interleave: false }).then(function (rs) {
          var win = { x: gr.w[0], y: gr.w[1], w: gr.w[2] - gr.w[0], h: gr.w[3] - gr.w[1], alpha: o.alpha >= 0 ? rs[rs.length - 1] : null }, bandas = o.alpha >= 0 ? rs.slice(0, rs.length - 1) : rs;
          return gr.t.reduce(function (pp, it) { return pp.then(function () {
            if (cancelado && cancelado()) return;
            var d = desenhar(o, it.c, win, bandas, lim); feitos++;
            if (prog && feitos % 8 === 0) prog(feitos, total, 'z' + it.t.z);
            if (!d.validos) { vazios++; return pausa(); }
            var cheio = d.validos === 65536; if (!cheio) parciais++;
            ctx.putImageData(new root.ImageData(d.px, 256, 256), 0, 0);
            return blobDe(canvas, cheio ? 'image/jpeg' : 'image/png', q).then(function (b) { return b.arrayBuffer(); }).then(function (ab) {
              files.push({ name: it.t.z + '/' + it.t.x + '/' + it.t.y + (cheio ? '.jpg' : '.png'), data: new Uint8Array(ab) }); bytes += ab.byteLength;
              return bytes >= maxB ? fecha().then(pausa) : pausa();
            });
          }); }, Promise.resolve());
        });
      }); }, Promise.resolve()).then(function () {
        if (cancelado && cancelado()) return null;
        return fecha().then(function () { return { n: nTot, partes: partes, vazios: vazios, parciais: parciais, total: total }; });
      });
    });
  };
  root.MOSAICO_GEOTIFF = G; if (typeof module !== 'undefined' && module.exports) module.exports = G;
})(typeof self !== 'undefined' ? self : this);
