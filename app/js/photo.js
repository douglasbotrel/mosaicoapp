/* Fotos: reduz para JPEG (máx. 1600 px) e prepara registro com GPS. */
(function (root) {
  'use strict';
  var P = {};
  P.reduzir = function (file, maxLado, qual) {
    maxLado = maxLado || 1600; qual = qual || 0.8;
    function desenhar(src, w, h) {
      var k = Math.min(1, maxLado / Math.max(w, h)), W = Math.round(w * k), H = Math.round(h * k), c = document.createElement('canvas');
      c.width = W; c.height = H; c.getContext('2d').drawImage(src, 0, 0, W, H);
      return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res({ blob: b, w: W, h: H }) : rej(new Error('Falha ao gerar JPEG')); }, 'image/jpeg', qual); });
    }
    if (root.createImageBitmap) {
      return root.createImageBitmap(file, { imageOrientation: 'from-image' }).then(function (bm) { var r = desenhar(bm, bm.width, bm.height); if (bm.close) bm.close(); return r; });
    }
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { desenhar(im, im.naturalWidth, im.naturalHeight).then(function (r) { URL.revokeObjectURL(u); res(r); }, rej); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('Imagem inválida')); };
      im.src = u;
    });
  };
  /* posição para a foto: usa a última leitura se tiver até 45 s; senão tenta uma leitura rápida */
  P.posicao = function () {
    var G = root.MOSAICO_GPS;
    if (G.ultima && Date.now() - G.ultima.t < 45000) return Promise.resolve(G.ultima);
    return new Promise(function (res) {
      if (!G.suportado()) return res(null);
      navigator.geolocation.getCurrentPosition(function (p) { res({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, alt: p.coords.altitude, t: p.timestamp }); }, function () { res(null); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
    });
  };
  root.MOSAICO_PHOTO = P;
})(typeof self !== 'undefined' ? self : this);
