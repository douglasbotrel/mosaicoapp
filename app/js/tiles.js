/* Cobertura de tiles (XYZ / Web Mercator) para os polígonos dos parques. */
(function (root) {
  'use strict';
  var T = {};
  T.xy = function (lat, lon, z) { var n = Math.pow(2, z), x = Math.floor((lon + 180) / 360 * n), r = lat * Math.PI / 180, y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) }; };
  T.bounds = function (x, y, z) { var n = Math.pow(2, z), f = function (yy) { var a = Math.PI - 2 * Math.PI * yy / n; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(a) - Math.exp(-a))); }; return { n: f(y), s: f(y + 1), w: x / n * 360 - 180, e: (x + 1) / n * 360 - 180 }; };
  function pip(pt, ring) { var c = false; for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) { var a = ring[i], b = ring[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function distSeg(p, a, b, k) { var ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0; return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
  /* polys: [ring,...] (cada ring = [[lon,lat],...]); buffer em metros. Retorna lista de {z,x,y} dentro/perto dos polígonos */
  T.lista = function (polys, zmin, zmax, bufM) {
    var out = [], bm = bufM || 0;
    for (var z = zmin; z <= zmax; z++) {
      var seen = {};
      polys.forEach(function (ring) {
        var lo = ring.reduce(function (m, p) { return [Math.min(m[0], p[0]), Math.min(m[1], p[1]), Math.max(m[2], p[0]), Math.max(m[3], p[1])]; }, [999, 999, -999, -999]);
        var a = T.xy(lo[3], lo[0], z), b = T.xy(lo[1], lo[2], z), k = Math.cos((lo[1] + lo[3]) / 2 * Math.PI / 180);
        for (var x = a.x; x <= b.x; x++) for (var y = a.y; y <= b.y; y++) {
          var key = x + '/' + y; if (seen[key]) continue;
          var bd = T.bounds(x, y, z), c = [(bd.w + bd.e) / 2, (bd.n + bd.s) / 2], half = Math.hypot((bd.e - bd.w) * 111320 * k, (bd.n - bd.s) * 110574) / 2, hit = pip(c, ring);
          if (!hit) { var m = 1e18; for (var i = 1; i < ring.length; i++) { var d = distSeg(c, ring[i - 1], ring[i], k) * 111320; if (d < m) m = d; if (m <= half + bm) break; } hit = m <= half + bm; }
          if (hit) { seen[key] = 1; out.push({ z: z, x: x, y: y }); }
        }
      });
    }
    return out;
  };
  root.MOSAICO_TILES = T; if (typeof module !== 'undefined' && module.exports) module.exports = T;
})(typeof self !== 'undefined' ? self : this);
