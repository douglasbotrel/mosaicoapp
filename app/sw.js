/* Service worker: guarda o aplicativo para funcionar sem internet. */
var VERSAO = 'mosaico-v1.2.0';
var ARQUIVOS = ['./', 'index.html', 'manifest.json', 'css/app.css', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'js/schema.js', 'js/core.js', 'js/validar.js', 'js/csv.js', 'js/db.js', 'js/ui.js', 'js/gps.js', 'js/photo.js', 'js/pacote.js', 'js/form.js', 'js/app.js', 'js/visita.js', 'js/dia.js', 'js/mapa.js', 'vendor/leaflet.js', 'vendor/leaflet.css', 'data/parques.js'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url); if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    return fetch(e.request).then(function (r) { if (r.ok) { var cp = r.clone(); caches.open(VERSAO).then(function (c) { c.put(e.request, cp); }); } return r; })
      .catch(function () { return e.request.mode === 'navigate' ? caches.match('index.html') : Response.error(); });
  }));
});
