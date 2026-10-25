/* Banco local (IndexedDB). Stores: imoveis, visitas, fotos, meta. */
(function (root) {
  'use strict';
  var DB_NAME = 'mosaico', DB_VER = 3, dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('imoveis')) d.createObjectStore('imoveis', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('visitas')) d.createObjectStore('visitas', { keyPath: 'imovelId' });
        if (!d.objectStoreNames.contains('fotos')) { var f = d.createObjectStore('fotos', { keyPath: 'id' }); f.createIndex('imovelId', 'imovelId'); }
        if (!d.objectStoreNames.contains('dias')) d.createObjectStore('dias', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('custos')) { var c = d.createObjectStore('custos', { keyPath: 'id' }); c.createIndex('dia', 'dia'); }
        if (!d.objectStoreNames.contains('tiles')) d.createObjectStore('tiles', { keyPath: 'k' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.onblocked = function () { rej(new Error('Banco bloqueado por outra aba')); };
    });
    return dbp;
  }
  function tx(stores, mode, fn) {
    return open().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(stores, mode), out;
        t.oncomplete = function () { res(out); };
        t.onerror = t.onabort = function () { rej(t.error || new Error('Transação abortada')); };
        out = fn(t);
      });
    });
  }
  function req(r) { return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  var DB = {
    open: open,
    put: function (s, v) { return tx(s, 'readwrite', function (t) { t.objectStore(s).put(v); }); },
    putMany: function (s, arr) { return tx(s, 'readwrite', function (t) { var o = t.objectStore(s); arr.forEach(function (v) { o.put(v); }); }); },
    del: function (s, k) { return tx(s, 'readwrite', function (t) { t.objectStore(s).delete(k); }); },
    clear: function (s) { return tx(s, 'readwrite', function (t) { t.objectStore(s).clear(); }); },
    count: function (s) { return open().then(function (d) { return req(d.transaction(s).objectStore(s).count()); }); },
    all: function (s) { return open().then(function (d) { return req(d.transaction(s).objectStore(s).getAll()); }); },
    one: function (s, k) { return open().then(function (d) { return req(d.transaction(s).objectStore(s).get(k)); }); },
    fotosDe: function (imovelId) { return open().then(function (d) { return req(d.transaction('fotos').objectStore('fotos').index('imovelId').getAll(imovelId)); }); },
    /* metadados leves de fotos (sem blob) para contagens rápidas */
    fotosMeta: function () {
      return open().then(function (d) {
        return new Promise(function (res, rej) {
          var out = [], c = d.transaction('fotos').objectStore('fotos').openCursor();
          c.onsuccess = function () { var cur = c.result; if (cur) { var v = cur.value; out.push({ id: v.id, imovelId: v.imovelId, cat: v.cat, bytes: v.blob ? v.blob.size : 0 }); cur.continue(); } else res(out); };
          c.onerror = function () { rej(c.error); };
        });
      });
    },
    getMeta: function (k, def) { return DB.one('meta', k).then(function (r) { return r ? r.v : def; }); },
    setMeta: function (k, v) { return DB.put('meta', { k: k, v: v }); }
  };
  root.MOSAICO_DB = DB;
})(typeof self !== 'undefined' ? self : this);
