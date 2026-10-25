/* GPS: ponto com média, trilha de limite, última posição. Depende de MOSAICO_CORE. */
(function (root) {
  'use strict';
  var C = root.MOSAICO_CORE;
  var G = { ultima: null, _watch: null, _subs: [], _wake: null };
  function fixOf(p) { var c = p.coords; return { lat: c.latitude, lon: c.longitude, acc: c.accuracy, alt: c.altitude, t: p.timestamp }; }
  G.suportado = function () { return 'geolocation' in navigator; };
  G.erroTexto = function (e) {
    if (!e) return 'Erro de GPS';
    if (e.code === 1) return 'Permissão de localização negada. Ative a localização para este site nas configurações do navegador.';
    if (e.code === 2) return 'Sem sinal de GPS. Vá para um local aberto.';
    if (e.code === 3) return 'GPS demorou demais para responder.';
    return e.message || 'Erro de GPS';
  };
  G.assinar = function (fn) {
    G._subs.push(fn);
    if (G._watch == null && G.suportado()) {
      G._watch = navigator.geolocation.watchPosition(function (p) { var f = fixOf(p); G.ultima = f; G._subs.slice().forEach(function (s) { s(f, null); }); },
        function (e) { G._subs.slice().forEach(function (s) { s(null, e); }); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
      if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { G._wake = w; }).catch(function () {});
    }
    return function () {
      G._subs = G._subs.filter(function (s) { return s !== fn; });
      if (!G._subs.length && G._watch != null) { navigator.geolocation.clearWatch(G._watch); G._watch = null; if (G._wake) { try { G._wake.release(); } catch (e) {} G._wake = null; } }
    };
  };
  /* Captura de ponto: junta leituras até atingir (n>=nMin e acc<=accAlvo) ou tempo máximo. onProg(fix, n, tRestante). Retorna Promise<ponto médio> */
  G.capturarPonto = function (opt) {
    opt = opt || {};
    var cancelFn, nMin = opt.nMin || 6, accAlvo = opt.accAlvo || 5, tMax = (opt.tMax || 25) * 1000, fixes = [], t0 = Date.now(), cancelado = false;
    var p = new Promise(function (res, rej) {
      var fim = function (err) {
        off(); clearInterval(iv);
        if (cancelado) return rej(new Error('cancelado'));
        if (!fixes.length) return rej(err || new Error('Sem leituras de GPS'));
        var m = C.averageFixes(fixes); m.t = Date.now(); res(m);
      };
      var off = G.assinar(function (f, e) {
        if (e) { if (e.code === 1) fim(e); return; }
        if (f.acc != null && f.acc > 100) { opt.onProg && opt.onProg(f, fixes.length, Math.max(0, tMax - (Date.now() - t0))); return; }
        fixes.push(f); opt.onProg && opt.onProg(f, fixes.length, Math.max(0, tMax - (Date.now() - t0)));
        if (fixes.length >= nMin && C.averageFixes(fixes).acc <= accAlvo) fim();
      });
      var iv = setInterval(function () { if (Date.now() - t0 >= tMax) fim(new Error('Tempo esgotado sem leituras utilizáveis')); else if (opt.onProg) opt.onProg(null, fixes.length, tMax - (Date.now() - t0)); }, 500);
      cancelFn = function () { cancelado = true; fim(); };
    });
    p.cancelar = function () { if (cancelFn) cancelFn(); };
    return p;
  };
  /* Trilha: registra vértices por distância mínima e precisão máxima. */
  G.iniciarTrilha = function (opt) {
    opt = opt || {};
    var passo = opt.passo || 4, accMax = opt.accMax || 25, pts = (opt.pts || []).slice(), ativo = true, ult = pts.length ? pts[pts.length - 1] : null;
    var cb = opt.onFix;
    var off = G.assinar(function (f) {
      if (!f || !ativo) return;
      if (f.acc != null && f.acc > accMax) { cb && cb(f, false, pts); return; }
      var add = !ult || C.haversine(ult, f) >= Math.max(passo, (f.acc || 0) * 0.5);
      if (add) { var v = { lat: f.lat, lon: f.lon, acc: f.acc, t: f.t }; pts.push(v); ult = v; }
      cb && cb(f, add, pts);
    });
    return {
      pts: function () { return pts; },
      setOnFix: function (fn) { cb = fn; },
      addAgora: function () { var f = G.ultima; if (!f) return null; var v = { lat: f.lat, lon: f.lon, acc: f.acc, t: f.t, manual: true }; pts.push(v); ult = v; return v; },
      desfazer: function () { pts.pop(); ult = pts.length ? pts[pts.length - 1] : null; },
      parar: function () { ativo = false; off(); return pts; }
    };
  };
  G.resumoTrilha = function (pts, fechada) {
    var ok = pts.length >= 3;
    return { n: pts.length, perimM: C.perimeterM(pts, !!fechada), areaM2: ok ? C.polygonAreaM2(pts) : 0, areaHa: ok ? C.polygonAreaM2(pts) / 10000 : 0, fechada: !!fechada };
  };
  root.MOSAICO_GPS = G;
})(typeof self !== 'undefined' ? self : this);
