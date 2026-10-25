/* Pasta do projeto: grava no computador, de forma organizada, o que a central recebe e gera.
   Usa a File System Access API (Chrome ou Edge no computador). Sem servidor; nada sai da máquina. */
(function (root) {
  'use strict';
  var P = { raiz: null, nome: '', ultimo: null, pendente: null };
  P.suportado = function () { return typeof root.showDirectoryPicker === 'function'; };
  function idb() { return new Promise(function (res, rej) { var r = indexedDB.open('mosaico-central', 1); r.onupgradeneeded = function () { r.result.createObjectStore('h'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); }
  function guardar(h) { return idb().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('h', 'readwrite'); t.objectStore('h').put(h, 'pasta'); t.oncomplete = function () { res(); }; t.onerror = function () { rej(t.error); }; }); }); }
  function lembrar() { return idb().then(function (d) { return new Promise(function (res, rej) { var q = d.transaction('h').objectStore('h').get('pasta'); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { rej(q.error); }; }); }); }
  /* ativa uma pasta (handle de diretório) e a lembra para a próxima abertura */
  P.usar = function (h) { P.raiz = h; P.nome = h.name || 'pasta'; P.pendente = null; return guardar(h).catch(function () {}); };
  P.escolher = function () { return root.showDirectoryPicker({ id: 'mosaico', mode: 'readwrite' }).then(function (h) { return P.usar(h); }); };
  /* ao abrir a central: reativa sozinha se o navegador ainda tem permissão; senão deixa "pendente" (precisa de um clique) */
  P.retomar = function () {
    return lembrar().then(function (h) {
      if (!h) return false;
      return Promise.resolve(h.queryPermission ? h.queryPermission({ mode: 'readwrite' }) : 'prompt').then(function (p) {
        if (p === 'granted') return P.usar(h).then(function () { return true; });
        P.pendente = h; return false;
      });
    }).catch(function () { return false; });
  };
  P.reconectar = function () {
    var h = P.pendente; if (!h) return Promise.reject(new Error('Nenhuma pasta lembrada'));
    return h.requestPermission({ mode: 'readwrite' }).then(function (p) { if (p !== 'granted') throw new Error('Permissão não concedida'); return P.usar(h); });
  };
  function dir(partes, criar) {
    var p = Promise.resolve(P.raiz);
    partes.forEach(function (n) { p = p.then(function (d) { return d.getDirectoryHandle(n, { create: !!criar }); }); });
    return p;
  }
  function escrever(d, nome, dados) {
    return d.getFileHandle(nome, { create: true }).then(function (fh) { return fh.createWritable(); }).then(function (w) { return Promise.resolve(w.write(dados)).then(function () { return w.close(); }); });
  }
  /* grava (substitui se existir). Devolve o caminho relativo gravado */
  P.gravar = function (partes, nome, dados) {
    if (!P.raiz) return Promise.resolve(null);
    return dir(partes, true).then(function (d) { return escrever(d, nome, dados); }).then(function () { P.ultimo = new Date().toISOString(); return partes.concat([nome]).join('/'); });
  };
  /* grava sem sobrescrever: se já existe um arquivo com esse nome, acrescenta -2, -3… */
  P.gravarUnico = function (partes, nome, dados) {
    if (!P.raiz) return Promise.resolve(null);
    return dir(partes, true).then(function (d) {
      var m = /^(.*?)(\.[^.]*)?$/.exec(nome), base = m[1], ext = m[2] || '', n = 1;
      function tenta() { var nm = n === 1 ? nome : base + '-' + n + ext; return d.getFileHandle(nm).then(function () { n++; return tenta(); }, function () { return nm; }); }
      return tenta().then(function (nm) { return escrever(d, nm, dados).then(function () { P.ultimo = new Date().toISOString(); return partes.concat([nm]).join('/'); }); });
    });
  };
  P.ler = function (partes, nome) {
    if (!P.raiz) return Promise.resolve(null);
    return dir(partes, false).then(function (d) { return d.getFileHandle(nome); }).then(function (fh) { return fh.getFile(); }).catch(function (e) { if (e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')) return null; throw e; });
  };
  /* lista recursivamente os arquivos (caminhos relativos) */
  P.listar = function () {
    var out = [];
    function rec(d, pre) {
      var itens = [], iter = d.values();
      function passo() { return iter.next().then(function (r) { if (r.done) return; itens.push(r.value); return passo(); }); }
      return passo().then(function () { return itens.reduce(function (p, e) { return p.then(function () { if (e.kind === 'directory') return rec(e, pre + e.name + '/'); out.push(pre + e.name); }); }, Promise.resolve()); });
    }
    if (!P.raiz) return Promise.resolve(out);
    return rec(P.raiz, '').then(function () { return out.sort(); });
  };
  root.MOSAICO_PASTA = P;
})(window);
