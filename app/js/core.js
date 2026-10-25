/* Núcleo sem dependências: geodésia, validações, ZIP, EXIF GPS, shapefile.
   Usado pelo coletor (celular) e pela central (computador). */
(function (root) {
  'use strict';
  var A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), D2R = Math.PI / 180;

  /* ---------- geodésia ---------- */
  function haversine(a, b) {
    var R = 6371008.8, dLat = (b.lat - a.lat) * D2R, dLon = (b.lon - a.lon) * D2R;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function localXY(pts) {
    var lat0 = pts.reduce(function (s, p) { return s + p.lat; }, 0) / pts.length;
    var lon0 = pts.reduce(function (s, p) { return s + p.lon; }, 0) / pts.length;
    var sl = Math.sin(lat0 * D2R), w = 1 - E2 * sl * sl;
    var M = A * (1 - E2) / Math.pow(w, 1.5), N = A / Math.sqrt(w), c = Math.cos(lat0 * D2R);
    return pts.map(function (p) { return { x: (p.lon - lon0) * D2R * N * c, y: (p.lat - lat0) * D2R * M }; });
  }
  function polygonAreaM2(pts) {
    if (!pts || pts.length < 3) return 0;
    var q = localXY(pts), s = 0;
    for (var i = 0; i < q.length; i++) { var j = (i + 1) % q.length; s += q[i].x * q[j].y - q[j].x * q[i].y; }
    return Math.abs(s) / 2;
  }
  function perimeterM(pts, closed) {
    var s = 0;
    for (var i = 1; i < pts.length; i++) s += haversine(pts[i - 1], pts[i]);
    if (closed && pts.length > 2) s += haversine(pts[pts.length - 1], pts[0]);
    return s;
  }
  function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : null; }
  /* média de leituras ponderada pela precisão (1/acc²); descarta saltos > 3x a mediana das distâncias */
  function averageFixes(fixes) {
    if (!fixes.length) return null;
    var mLat = median(fixes.map(function (f) { return f.lat; })), mLon = median(fixes.map(function (f) { return f.lon; }));
    var c = { lat: mLat, lon: mLon };
    var d = fixes.map(function (f) { return haversine(c, f); });
    var lim = Math.max(10, 3 * median(d));
    var ok = fixes.filter(function (f, i) { return d[i] <= lim; });
    if (!ok.length) ok = fixes;
    var sw = 0, la = 0, lo = 0, alt = 0, na = 0;
    ok.forEach(function (f) { var w = 1 / Math.pow(Math.max(f.acc || 10, 1), 2); sw += w; la += f.lat * w; lo += f.lon * w; if (f.alt != null) { alt += f.alt; na++; } });
    var accs = ok.map(function (f) { return f.acc || 10; });
    return { lat: la / sw, lon: lo / sw, alt: na ? alt / na : null, acc: Math.min.apply(null, accs), accMed: median(accs), n: ok.length, nTotal: fixes.length };
  }
  /* Douglas-Peucker em metros */
  function simplify(pts, tolM) {
    if (pts.length < 3) return pts.slice();
    var q = localXY(pts), keep = new Array(pts.length).fill(false);
    keep[0] = keep[pts.length - 1] = true;
    (function rec(a, b) {
      var mx = 0, mi = -1;
      for (var i = a + 1; i < b; i++) {
        var dx = q[b].x - q[a].x, dy = q[b].y - q[a].y, L = dx * dx + dy * dy, t = L ? ((q[i].x - q[a].x) * dx + (q[i].y - q[a].y) * dy) / L : 0;
        t = Math.max(0, Math.min(1, t));
        var px = q[a].x + t * dx, py = q[a].y + t * dy, d = Math.hypot(q[i].x - px, q[i].y - py);
        if (d > mx) { mx = d; mi = i; }
      }
      if (mx > tolM) { keep[mi] = true; rec(a, mi); rec(mi, b); }
    })(0, pts.length - 1);
    return pts.filter(function (p, i) { return keep[i]; });
  }

  /* ---------- validações e formatos ---------- */
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
  function cpfValido(s) {
    var d = digits(s); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    for (var t = 9; t < 11; t++) { var sum = 0; for (var i = 0; i < t; i++) sum += +d[i] * (t + 1 - i); var r = (sum * 10) % 11 % 10; if (r !== +d[t]) return false; }
    return true;
  }
  function fmtCpf(s) { var d = digits(s).slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
  function fmtTel(s) { var d = digits(s).slice(0, 11); if (d.length > 10) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'); if (d.length > 6) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3'); if (d.length > 2) return d.replace(/(\d{2})(\d+)/, '($1) $2'); return d; }
  function telValido(s) { var d = digits(s); return d.length === 10 || d.length === 11; }
  /* CAR: UF-IBGE(7)-32 hex (agrupado de 4 em 4) ex.: MG-3121605-ABCD.1234... */
  function normCar(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function carValido(s) { var n = normCar(s); return /^[A-Z]{2}\d{7}[A-F0-9]{32}$/.test(n); }
  function coordValida(lat, lon) {
    return typeof lat === 'number' && typeof lon === 'number' && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
      lat <= -17.5 && lat >= -19.5 && lon <= -42 && lon >= -44.5;  /* caixa do Alto Jequitinhonha: pega vírgula/sinal trocado */
  }
  function uid(prefix) {
    var a = new Uint8Array(6); (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    return (prefix || 'id') + '-' + Date.now().toString(36) + Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  }
  function hoje() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'x'; }

  /* ---------- ZIP (sem compressão) ---------- */
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  /* files: [{name, data:Uint8Array|string, date?:Date}] */
  function makeZip(files) {
    var parts = [], cen = [], off = 0;
    files.forEach(function (f) {
      var nm = utf8(f.name), d = typeof f.data === 'string' ? utf8(f.data) : f.data, crc = crc32(d);
      var dt = f.date || new Date(), time = (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1);
      var date = ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true);
      h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nm, d);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true);
      c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      cen.push(new Uint8Array(c.buffer), nm);
      off += 30 + nm.length + d.length;
    });
    var cs = 0; cen.forEach(function (x) { cs += x.length; });
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, off, true);
    return concat(parts.concat(cen, [new Uint8Array(e.buffer)]));
  }
  function concat(arr) { var n = 0; arr.forEach(function (a) { n += a.length; }); var o = new Uint8Array(n), p = 0; arr.forEach(function (a) { o.set(a, p); p += a.length; }); return o; }
  /* lê ZIP (STORE ou DEFLATE via DecompressionStream quando disponível). Retorna Promise<[{name,data}]> */
  function readZip(buf) {
    var u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), i = u8.length - 22;
    while (i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
    if (i < 0) return Promise.reject(new Error('Arquivo ZIP inválido'));
    var n = dv.getUint16(i + 10, true), p = dv.getUint32(i + 16, true), jobs = [];
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) return Promise.reject(new Error('ZIP corrompido'));
      var meth = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true), cs = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      var name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
      var ln = dv.getUint16(lo + 26, true), lx = dv.getUint16(lo + 28, true), ds = lo + 30 + ln + lx;
      jobs.push((function (name, meth, crc, raw) {
        if (meth === 0) return Promise.resolve({ name: name, data: raw, crc: crc });
        if (meth === 8 && typeof DecompressionStream !== 'undefined') {
          var ds2 = new DecompressionStream('deflate-raw');
          return new Response(new Blob([raw]).stream().pipeThrough(ds2)).arrayBuffer().then(function (b) { return { name: name, data: new Uint8Array(b), crc: crc }; });
        }
        return Promise.reject(new Error('Compressão não suportada em ' + name));
      })(name, meth, crc, u8.subarray(ds, ds + cs)));
      p += 46 + nl + xl + cl;
    }
    return Promise.all(jobs).then(function (fs) { fs.forEach(function (f) { if (crc32(f.data) !== f.crc) throw new Error('CRC inválido em ' + f.name); }); return fs; });
  }

  /* ---------- EXIF GPS em JPEG ---------- */
  function exifGps(lat, lon, alt) {
    function dms(v) { v = Math.abs(v); var d = Math.floor(v), m = Math.floor((v - d) * 60), s = Math.round(((v - d) * 60 - m) * 60 * 10000); return [[d, 1], [m, 1], [s, 10000]]; }
    var hasAlt = alt != null && isFinite(alt), nEnt = hasAlt ? 7 : 5;
    var gpsLen = 2 + nEnt * 12 + 4, dataOff = 26 + gpsLen, size = dataOff + 48 + (hasAlt ? 8 : 0);
    var b = new DataView(new ArrayBuffer(size)), u = new Uint8Array(b.buffer);
    u[0] = 0x4D; u[1] = 0x4D; b.setUint16(2, 42); b.setUint32(4, 8);
    b.setUint16(8, 1); b.setUint16(10, 0x8825); b.setUint16(12, 4); b.setUint32(14, 1); b.setUint32(18, 26); b.setUint32(22, 0);
    var p = 26; b.setUint16(p, nEnt); p += 2;
    function ent(tag, type, cnt, val) { b.setUint16(p, tag); b.setUint16(p + 2, type); b.setUint32(p + 4, cnt); if (type === 2) { b.setUint8(p + 8, val.charCodeAt(0)); } else if (type === 1) { for (var i = 0; i < val.length; i++) b.setUint8(p + 8 + i, val[i]); } else b.setUint32(p + 8, val); p += 12; }
    var o = dataOff;
    ent(0, 1, 4, [2, 3, 0, 0]);
    ent(1, 2, 2, lat >= 0 ? 'N' : 'S');
    ent(2, 5, 3, o); dms(lat).forEach(function (r) { b.setUint32(o, r[0]); b.setUint32(o + 4, r[1]); o += 8; });
    ent(3, 2, 2, lon >= 0 ? 'E' : 'W');
    ent(4, 5, 3, o); dms(lon).forEach(function (r) { b.setUint32(o, r[0]); b.setUint32(o + 4, r[1]); o += 8; });
    if (hasAlt) { ent(5, 1, 1, [alt < 0 ? 1 : 0]); ent(6, 5, 1, o); b.setUint32(o, Math.round(Math.abs(alt) * 100)); b.setUint32(o + 4, 100); o += 8; }
    b.setUint32(p, 0);
    var seg = new Uint8Array(4 + 6 + size), sd = new DataView(seg.buffer);
    seg[0] = 0xFF; seg[1] = 0xE1; sd.setUint16(2, 2 + 6 + size); seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); seg.set(u, 10);
    return seg;
  }
  function jpegWithGps(jpeg, lat, lon, alt) {
    if (!(jpeg[0] === 0xFF && jpeg[1] === 0xD8)) throw new Error('Não é JPEG');
    var out = [jpeg.subarray(0, 2)], p = 2;
    while (p + 4 < jpeg.length && jpeg[p] === 0xFF && jpeg[p + 1] >= 0xE0 && jpeg[p + 1] <= 0xEF) { /* descarta Exif antigo, mantém demais APPn */
      var L = (jpeg[p + 2] << 8) | jpeg[p + 3], isExif = jpeg[p + 1] === 0xE1 && jpeg[p + 4] === 0x45 && jpeg[p + 5] === 0x78;
      if (!isExif) out.push(jpeg.subarray(p, p + 2 + L)); p += 2 + L;
    }
    out.splice(1, 0, exifGps(lat, lon, alt));
    out.push(jpeg.subarray(p));
    return concat(out);
  }

  /* ---------- Shapefile ---------- */
  /* Datum do projeto: SIRGAS 2000 (EPSG:4674). Coordenadas do GPS do celular (WGS 84) são tratadas como SIRGAS 2000: o IBGE informa que não há parâmetros de transformação entre os dois (praticamente idênticos). */
  var PRJ_SIRGAS2000 = 'GEOGCS["GCS_SIRGAS_2000",DATUM["D_SIRGAS_2000",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  var PRJ_WGS84 = PRJ_SIRGAS2000;
  /* geoms: tipo 'point': {lat,lon}; 'polygon': [[{lat,lon}...] anéis]. fields: [{n,t:'C'|'N',len,dec}]; rows: array de objetos */
  function ringArea(r) { var s = 0; for (var i = 0; i < r.length; i++) { var j = (i + 1) % r.length; s += r[i].lon * r[j].lat - r[j].lon * r[i].lat; } return s / 2; }
  function writeShapefile(kind, geoms, fields, rows) {
    var recs = [], i, bbox = [Infinity, Infinity, -Infinity, -Infinity];
    function grow(p) { bbox[0] = Math.min(bbox[0], p.lon); bbox[1] = Math.min(bbox[1], p.lat); bbox[2] = Math.max(bbox[2], p.lon); bbox[3] = Math.max(bbox[3], p.lat); }
    geoms.forEach(function (g) {
      var d, v;
      if (kind === 'point') { d = new DataView(new ArrayBuffer(20)); d.setInt32(0, 1, true); d.setFloat64(4, g.lon, true); d.setFloat64(12, g.lat, true); grow(g); }
      else {
        var rings = g.map(function (r) { var q = r.slice(); if (kind !== 'line' && q.length > 1 && q[0].lat === q[q.length - 1].lat && q[0].lon === q[q.length - 1].lon) q.pop(); return q; });
        if (kind !== 'line') rings = rings.map(function (r, k) { var cw = ringArea(r) < 0; if ((k === 0) !== cw) r = r.slice().reverse(); return r.concat([r[0]]); }); /* externo horário */
        var np = 0; rings.forEach(function (r) { np += r.length; r.forEach(grow); });
        var bb = [Infinity, Infinity, -Infinity, -Infinity]; rings.forEach(function (r) { r.forEach(function (p) { bb[0] = Math.min(bb[0], p.lon); bb[1] = Math.min(bb[1], p.lat); bb[2] = Math.max(bb[2], p.lon); bb[3] = Math.max(bb[3], p.lat); }); });
        d = new DataView(new ArrayBuffer(44 + 4 * rings.length + 16 * np)); d.setInt32(0, kind === 'line' ? 3 : 5, true);
        for (i = 0; i < 4; i++) d.setFloat64(4 + 8 * i, bb[i], true);
        d.setInt32(36, rings.length, true); d.setInt32(40, np, true);
        var pi = 0, q = 44 + 4 * rings.length; rings.forEach(function (r, k) { d.setInt32(44 + 4 * k, pi, true); pi += r.length; r.forEach(function (p) { d.setFloat64(q, p.lon, true); d.setFloat64(q + 8, p.lat, true); q += 16; }); });
      }
      recs.push(new Uint8Array(d.buffer));
    });
    if (!recs.length) bbox = [0, 0, 0, 0];
    var contentLen = 0; recs.forEach(function (r) { contentLen += 8 + r.length; });
    function head(len16) { var h = new DataView(new ArrayBuffer(100)); h.setInt32(0, 9994); h.setInt32(24, len16); h.setInt32(28, 1000, true); h.setInt32(32, kind === 'point' ? 1 : kind === 'line' ? 3 : 5, true); for (var k = 0; k < 4; k++) h.setFloat64(36 + 8 * k, bbox[k], true); return h; }
    var shp = new DataView(new ArrayBuffer(100 + contentLen)), shx = new DataView(new ArrayBuffer(100 + 8 * recs.length));
    new Uint8Array(shp.buffer).set(new Uint8Array(head((100 + contentLen) / 2).buffer));
    new Uint8Array(shx.buffer).set(new Uint8Array(head((100 + 8 * recs.length) / 2).buffer));
    var pos = 100;
    recs.forEach(function (r, k) {
      shp.setInt32(pos, k + 1); shp.setInt32(pos + 4, r.length / 2); new Uint8Array(shp.buffer).set(r, pos + 8);
      shx.setInt32(100 + 8 * k, pos / 2); shx.setInt32(104 + 8 * k, r.length / 2); pos += 8 + r.length;
    });
    /* dbf */
    var recLen = 1; fields.forEach(function (f) { recLen += f.len; });
    var hl = 33 + 32 * fields.length, dbf = new Uint8Array(hl + recLen * rows.length + 1), dd = new DataView(dbf.buffer);
    var now = new Date(); dbf[0] = 3; dbf[1] = now.getFullYear() - 1900; dbf[2] = now.getMonth() + 1; dbf[3] = now.getDate();
    dd.setUint32(4, rows.length, true); dd.setUint16(8, hl, true); dd.setUint16(10, recLen, true); dbf[29] = 0x57; /* LDID UTF-8 informal; .cpg também */
    fields.forEach(function (f, k) { var o = 32 + 32 * k, nm = utf8(f.n.slice(0, 10)); dbf.set(nm, o); dbf[o + 11] = f.t.charCodeAt(0); dbf[o + 16] = f.len; dbf[o + 17] = f.dec || 0; });
    dbf[32 + 32 * fields.length] = 0x0D;
    rows.forEach(function (row, r) {
      var o = hl + r * recLen; dbf[o] = 0x20; o++;
      fields.forEach(function (f) {
        var v = row[f.n], s;
        if (f.t === 'N') s = v == null || v === '' || isNaN(v) ? '' : Number(v).toFixed(f.dec || 0); else s = v == null ? '' : String(v);
        var bytes = utf8(s); if (bytes.length > f.len) { var cut = s; while (utf8(cut).length > f.len) cut = cut.slice(0, -1); bytes = utf8(cut); }
        var cell = new Uint8Array(f.len).fill(0x20);
        if (f.t === 'N') cell.set(bytes, f.len - bytes.length); else cell.set(bytes);
        dbf.set(cell, o); o += f.len;
      });
    });
    dbf[dbf.length - 1] = 0x1A;
    return { shp: new Uint8Array(shp.buffer), shx: new Uint8Array(shx.buffer), dbf: dbf, prj: PRJ_WGS84, cpg: 'UTF-8' };
  }

  var api = { haversine: haversine, polygonAreaM2: polygonAreaM2, perimeterM: perimeterM, averageFixes: averageFixes, simplify: simplify, median: median,
    digits: digits, cpfValido: cpfValido, fmtCpf: fmtCpf, fmtTel: fmtTel, telValido: telValido, normCar: normCar, carValido: carValido, coordValida: coordValida,
    uid: uid, hoje: hoje, slug: slug, crc32: crc32, utf8: utf8, makeZip: makeZip, readZip: readZip, concat: concat, exifGps: exifGps, jpegWithGps: jpegWithGps, writeShapefile: writeShapefile, PRJ_WGS84: PRJ_WGS84, PRJ_SIRGAS2000: PRJ_SIRGAS2000 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MOSAICO_CORE = api;
})(typeof self !== 'undefined' ? self : this);
