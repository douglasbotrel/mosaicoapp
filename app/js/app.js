/* Aplicativo: estado, lista de imóveis, envio/pacote, ajustes. */
(function (root) {
  'use strict';
  var DB = root.MOSAICO_DB, U = root.MOSAICO_UI, h = U.h, C = root.MOSAICO_CORE, S = root.MOSAICO_SCHEMA, V = root.MOSAICO_VALIDAR, T = root.MOSAICO_CSV, PK = root.MOSAICO_PACOTE;
  var VERSAO = '1.2.0';
  var A = { VERSAO: VERSAO, st: { aba: 'imoveis', filtro: 'todos', busca: '', pagina: 1, imoveis: [], visitas: {}, fotosN: {}, meta: { operador: '', equipe: 'A', aparelho: '' }, tela: 'lista' } };
  root.MOSAICO_APP = A;
  var $app = null, POR_PAGINA = 80;

  A.carregar = function () {
    return Promise.all([DB.all('imoveis'), DB.all('visitas'), DB.fotosMeta(), DB.getMeta('cfg', null), DB.getMeta('ultimoEnvio', null), DB.all('dias'), DB.all('custos'), DB.getMeta('situacao', {})]).then(function (r) {
      A.st.situacao = r[7] || {};
      A.st.dias = {}; r[5].forEach(function (d) { A.st.dias[d.id] = d; }); A.st.custos = r[6];
      A.st.imoveis = r[0]; A.st.visitas = {}; r[1].forEach(function (v) { A.st.visitas[v.imovelId] = v; });
      A.st.fotosN = {}; A.st.fotosBytes = 0; r[2].forEach(function (f) { A.st.fotosN[f.imovelId] = (A.st.fotosN[f.imovelId] || 0) + 1; A.st.fotosBytes += f.bytes; });
      A.st.nFotos = r[2].length;
      if (r[3]) A.st.meta = Object.assign(A.st.meta, r[3]);
      if (!A.st.meta.aparelho) { A.st.meta.aparelho = 'cel-' + C.uid('').slice(1, 7); DB.setMeta('cfg', A.st.meta); }
      A.st.ultimoEnvio = r[4];
    });
  };
  A.salvarCfg = function () { return DB.setMeta('cfg', A.st.meta); };

  function statusDe(imv) { var v = A.st.visitas[imv.id]; if (v) return v.status; var s = A.st.situacao[imv.id]; return s && s.status === 'concluida' ? 'central' : 'novo'; }
  function meus() { var p = A.st.meta.parque; return p ? A.st.imoveis.filter(function (i) { return i.parque === p; }) : A.st.imoveis; }
  var ROT = { central: 'Na central ✓', novo: 'Pendente', rascunho: 'Em andamento', pendente: 'Voltar', concluida: 'Concluído' };
  A.statusDe = statusDe;

  A.render = function () {
    U.clear($app);
    var t = A.st.tela;
    if (t === 'visita') return root.MOSAICO_VISITA.render($app);
    var shell = h('div', { class: 'shell' });
    var titulos = { imoveis: 'Imóveis', dia: 'Jornada e custos', mapa: 'Mapa', enviar: 'Enviar e salvar', ajustes: 'Ajustes' };
    shell.appendChild(h('header', { class: 'top' }, h('h1', {}, 'Mosaico', h('span', { class: 'sub', text: titulos[A.st.aba] + ' · ' + A.st.meta.aparelho }))));
    var main = h('main', { id: 'main' });
    if (A.st.aba === 'imoveis') telaLista(main); else if (A.st.aba === 'dia') root.MOSAICO_DIA.render(main); else if (A.st.aba === 'mapa' && root.MOSAICO_MAPA) root.MOSAICO_MAPA.render(main); else if (A.st.aba === 'enviar') telaEnviar(main); else telaAjustes(main);
    shell.appendChild(main);
    shell.appendChild(h('nav', { class: 'tabs', 'aria-label': 'Navegação' }, [['imoveis', '🏠', 'Imóveis'], ['dia', '🚙', 'Dia'], ['mapa', '🗺️', 'Mapa'], ['enviar', '📤', 'Enviar'], ['ajustes', '⚙️', 'Ajustes']].map(function (a) {
      return h('button', { class: A.st.aba === a[0] ? 'on' : '', 'aria-current': A.st.aba === a[0] ? 'page' : null, onclick: function () { A.st.aba = a[0]; A.render(); window.scrollTo(0, 0); } }, h('span', { class: 'i', text: a[1] }), a[2]);
    })));
    $app.appendChild(shell);
  };

  /* ---------- lista ---------- */
  function filtrar() {
    var q = String(A.st.busca || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''), f = A.st.filtro;
    return meus().filter(function (i) {
      var s = statusDe(i);
      if (f === 'PEBI' || f === 'PESN') { if (i.parque !== f) return false; }
      else if (f === 'pend') { if (s !== 'novo') return false; }
      else if (f === 'and') { if (s !== 'rascunho' && s !== 'pendente') return false; }
      else if (f === 'ok') { if (s !== 'concluida' && s !== 'central') return false; }
      else if (f === 'nenv') { var v = A.st.visitas[i.id]; if (!v || v.exp === v.atualizado) return false; }
      if (!q) return true;
      var hay = (i.nome + i.id + (i.car || '') + (i.comunidade || '') + (i.municipio || '') + (i.matricula || '')).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return hay.indexOf(q) >= 0;
    }).sort(function (a, b) { return a.parque === b.parque ? String(a.nome).localeCompare(b.nome, 'pt-BR', { numeric: true }) : a.parque < b.parque ? -1 : 1; });
  }
  function contagens() {
    var L = meus(), c = { total: L.length, ok: 0, and: 0, cen: 0, nenv: 0 };
    L.forEach(function (i) { var v = A.st.visitas[i.id]; if (!v) { if (statusDe(i) === 'central') c.cen++; return; } if (v.status === 'concluida') c.ok++; else c.and++; if (v.exp !== v.atualizado) c.nenv++; });
    c.pend = c.total - c.ok - c.and - c.cen; return c;
  }
  function telaLista(main) {
    var c = contagens();
    main.appendChild(h('div', { class: 'stat' }, [[c.total, 'imóveis'], [c.ok + c.cen, 'concluídos'], [c.and, 'em andamento'], [c.pend, 'pendentes']].map(function (x) { return h('div', {}, h('b', { text: x[0] }), h('span', { text: x[1] })); })));
    var ue = A.st.ultimoEnvio, horas = ue ? (Date.now() - new Date(ue).getTime()) / 36e5 : null;
    if (c.nenv > 0 && (horas == null || horas > 24 || c.nenv >= 10)) main.appendChild(h('div', { class: 'banner', role: 'alert', text: c.nenv + ' visita(s) ainda não enviadas ao computador. Gere o pacote na aba Enviar.' }));
    if (!c.total) {
      main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Nenhum imóvel na lista ainda' }), h('p', { class: 'dim', text: 'Importe a lista (CSV ou JSON gerado na central) ou cadastre um imóvel novo encontrado em campo.' }),
        h('button', { class: 'btn big primary', text: 'Importar lista de imóveis', onclick: importarLista }), h('div', { class: 'row' }, h('button', { class: 'btn big', text: '＋ Novo imóvel', onclick: novoImovel }))));
      return;
    }
    var busca = h('input', { type: 'search', class: 'search', placeholder: 'Buscar por nome, CAR, matrícula…', value: A.st.busca, 'aria-label': 'Buscar imóvel', autocomplete: 'off' });
    var lista = h('div', { id: 'lista' });
    busca.addEventListener('input', U.debounce(function () { A.st.busca = busca.value; A.st.pagina = 1; pintar(); }, 150));
    main.appendChild(busca);
    var F = [['todos', 'Todos']].concat(A.st.meta.parque ? [] : [['PEBI', 'Biribiri'], ['PESN', 'Serra Negra']]).concat([['pend', 'A fazer (' + c.pend + ')'], ['and', 'Andamento (' + c.and + ')'], ['ok', 'Concluídos (' + (c.ok + c.cen) + ')'], ['nenv', 'Não enviados (' + c.nenv + ')']]);
    var fl = h('div', { class: 'filtros', role: 'group', 'aria-label': 'Filtros' });
    F.forEach(function (f) { fl.appendChild(h('button', { class: 'chip' + (A.st.filtro === f[0] ? ' on' : ''), text: f[1], onclick: function () { A.st.filtro = f[0]; A.st.pagina = 1; A.render(); } })); });
    main.appendChild(fl); main.appendChild(lista);
    function pintar() {
      U.clear(lista); var arr = filtrar(), n = Math.min(arr.length, A.st.pagina * POR_PAGINA);
      lista.appendChild(h('div', { class: 'dim', text: arr.length + ' imóvel(is)' }));
      for (var k = 0; k < n; k++) lista.appendChild(linha(arr[k]));
      if (n < arr.length) lista.appendChild(h('button', { class: 'btn big', text: 'Mostrar mais (' + (arr.length - n) + ')', onclick: function () { A.st.pagina++; pintar(); } }));
      if (!arr.length) lista.appendChild(h('p', { class: 'aviso', text: 'Nada encontrado com esse filtro.' }));
    }
    pintar();
    main.appendChild(h('button', { class: 'fab list', 'aria-label': 'Novo imóvel', text: '＋', onclick: novoImovel }));
  }
  function linha(i) {
    var s = statusDe(i), v = A.st.visitas[i.id], nf = A.st.fotosN[i.id] || 0;
    return h('button', { class: 'row-im', onclick: function () {
      var sc = A.st.situacao[i.id];
      if (s === 'central') { U.confirmar('Já concluído na central', 'Este imóvel já foi concluído e enviado' + (sc && sc.aparelho ? ' (aparelho ' + sc.aparelho + ')' : '') + '. Abrir de novo cria uma nova versão que pode substituir a da central. Abrir mesmo assim?', 'Abrir').then(function (ok) { if (ok) A.abrirVisita(i.id); }); return; }
      A.abrirVisita(i.id); } },
      h('span', { class: 'pk', text: i.parque }),
      h('span', { class: 'grow' }, h('span', { class: 't', text: i.nome }), h('br'), h('span', { class: 's', text: [i.car ? i.car.slice(-9) : '', i.comunidade || i.municipio || '', nf ? nf + ' foto(s)' : ''].filter(Boolean).join(' · ') || i.id })),
      v && v.exp !== v.atualizado ? h('span', { class: 'badge', title: 'Não enviado', text: '⬆' }) : null,
      h('span', { class: 'badge ' + s, text: ROT[s] }));
  }
  function novoImovel() {
    var nome = h('input', { type: 'text', placeholder: 'Nome ou referência do imóvel', 'aria-label': 'Nome' }), car = h('input', { type: 'text', placeholder: 'Nº do CAR (se souber)', 'aria-label': 'CAR', autocapitalize: 'characters' }), par = A.st.meta.parque || 'PEBI';
    var chipsEl = h('div', { class: 'chips' });
    function pintaCh() { U.clear(chipsEl); S.PARQUES.filter(function (p) { return !A.st.meta.parque || p[0] === A.st.meta.parque; }).forEach(function (p) { chipsEl.appendChild(h('button', { class: 'chip' + (par === p[0] ? ' on' : ''), text: p[1], onclick: function () { par = p[0]; pintaCh(); } })); }); }
    pintaCh();
    var sh = U.sheet('Novo imóvel (achado em campo)', [h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Parque' }), chipsEl), h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Nome' }), nome), h('div', { class: 'field' }, h('div', { class: 'lab', text: 'CAR' }), car)],
      [h('button', { class: 'btn', text: 'Cancelar', onclick: function () { sh.close(); } }), h('button', { class: 'btn primary', text: 'Criar e abrir', onclick: function () {
        if (!nome.value.trim()) { U.toast('Informe um nome'); return; }
        var im = { id: par + '-C-' + C.uid('').slice(1, 8), parque: par, nome: nome.value.trim(), car: car.value.trim().toUpperCase() || undefined, origem: 'campo', criadoEm: new Date().toISOString(), aparelho: A.st.meta.aparelho };
        DB.put('imoveis', im).then(function () { A.st.imoveis.push(im); sh.close(); A.abrirVisita(im.id); });
      } })]);
  }
  function importarLista() {
    var inp = h('input', { type: 'file', accept: '.csv,.json,.txt,text/csv,application/json' });
    inp.addEventListener('change', function () {
      var f = inp.files[0]; if (!f) return;
      f.text().then(function (txt) {
        var arr, av = [];
        if (/^\s*[\[{]/.test(txt)) { var j = JSON.parse(txt); if (j && j.tipo === 'distribuicao') return importarDistribuicao(j); arr = Array.isArray(j) ? j : (j.imoveis || []); }
        else { var r = T.imoveisDeTabela(T.parse(txt)); arr = r.imoveis; av = r.avisos; }
        arr = arr.filter(function (i) { return i && i.id && (i.parque === 'PEBI' || i.parque === 'PESN') && (!A.st.meta.parque || i.parque === A.st.meta.parque); });
        if (!arr.length) { U.toast(av[0] || 'Nenhum imóvel válido no arquivo', 4000); return; }
        var existentes = {}; A.st.imoveis.forEach(function (i) { existentes[i.id] = i; });
        var novos = 0, atual = 0; arr.forEach(function (i) { if (existentes[i.id]) { atual++; arr[arr.indexOf(i)] = Object.assign({}, existentes[i.id], i); } else novos++; });
        return DB.putMany('imoveis', arr).then(A.carregar).then(function () { A.render(); U.toast(novos + ' novos, ' + atual + ' atualizados' + (av.length ? ' · ' + av.length + ' avisos' : ''), 4500); });
      }).catch(function (e) { U.toast('Erro: ' + e.message, 4500); });
    });
    inp.click();
  }
  /* arquivo de distribuição/continuação gerado pela central: imóveis do parque + situação já consolidada */
  function importarDistribuicao(j) {
    if (j.app !== 'mosaico' || (j.parque !== 'PEBI' && j.parque !== 'PESN')) throw new Error('Arquivo de distribuição inválido');
    if (j.formato > 1) throw new Error('Arquivo de versão mais nova; atualize o aplicativo');
    var m = A.st.meta;
    if (m.parque && m.parque !== j.parque) throw new Error('Este aparelho é da equipe ' + m.parque + ' e o arquivo é de ' + j.parque + '. Se mudou de equipe, troque em Ajustes.');
    var existentes = {}; A.st.imoveis.forEach(function (i) { existentes[i.id] = i; });
    var arr = (j.imoveis || []).filter(function (i) { return i && i.id && i.parque === j.parque; }).map(function (i) { return Object.assign({}, existentes[i.id] || {}, i); });
    var sit = Object.assign({}, A.st.situacao), feitos = 0;
    (j.situacao || []).forEach(function (x) { var a = sit[x.imovelId]; if (!a || String(x.atualizado) >= String(a.atualizado)) sit[x.imovelId] = x; });
    arr.forEach(function (i) { if (sit[i.id] && sit[i.id].status === 'concluida') feitos++; });
    m.parque = j.parque;
    return DB.putMany('imoveis', arr).then(function () { return DB.setMeta('situacao', sit); }).then(A.salvarCfg).then(A.carregar).then(function () { A.st.filtro = 'pend'; A.st.pagina = 1; A.render(); U.toast('Parque ' + j.parque + ': ' + arr.length + ' imóveis, ' + feitos + ' já concluídos na central, ' + (arr.length - feitos) + ' a fazer', 6000); });
  }
  A.importarLista = importarLista;

  /* ---------- enviar ---------- */
  function telaEnviar(main) {
    var c = contagens();
    main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Resumo neste aparelho' }), h('p', { class: 'dim', html: c.total + ' imóveis · ' + (c.ok + c.and) + ' visitas · ' + Object.keys(A.st.dias).length + ' jornadas · ' + A.st.nFotos + ' fotos (' + U.fmtBytes(A.st.fotosBytes || 0) + ')<br>Último envio: ' + (A.st.ultimoEnvio ? U.fmtData(A.st.ultimoEnvio) : 'nunca') + '<br>Não enviadas: ' + c.nenv })));
    var pp = h('select', { 'aria-label': 'Fotos por arquivo' }, [60, 100, 150, 300].map(function (n) { return h('option', { value: n, text: n + ' fotos por arquivo', selected: n === 100 }); }));
    var so = h('input', { type: 'checkbox', id: 'so-novos', style: 'width:24px;height:24px' });
    main.appendChild(h('div', { class: 'card' }, h('b', { text: '1. Gerar pacote para o computador' }), h('p', { class: 'dim', text: 'Cria um ou mais arquivos .zip com visitas, coordenadas e fotos georreferenciadas. Pode repetir à vontade: a central junta sem duplicar.' }),
      h('div', { class: 'field' }, pp), h('label', { class: 'row', style: 'align-items:center' }, so, h('span', { text: 'Somente o que mudou desde o último envio' })),
      h('button', { class: 'btn big primary', text: '📦 Gerar pacote', onclick: function () { gerarPacotes(+pp.value, so.checked, false); } }),
      h('div', { class: 'row' }, h('button', { class: 'btn', text: '↗ Compartilhar (WhatsApp, e-mail, Drive)', onclick: function () { gerarPacotes(+pp.value, so.checked, true); } }))));
    main.appendChild(h('div', { class: 'card' }, h('b', { text: '2. Restaurar de um pacote' }), h('p', { class: 'dim', text: 'Recupera visitas e fotos de um pacote (troca de aparelho ou recuperação).' }), h('button', { class: 'btn big', text: 'Restaurar pacote .zip', onclick: restaurar })));
    main.appendChild(h('div', { class: 'card' }, h('b', { text: '3. Lista de imóveis ou continuação' }), h('p', { class: 'dim', text: 'Importe o arquivo do parque gerado na central (.json): traz os imóveis e o que já está concluído. Também aceita CSV com imóveis (id, parque, nome, car, sigef, matrícula, ccir, area_car_ha).' }), h('button', { class: 'btn big', text: 'Importar lista', onclick: importarLista })));
    var cf = confirmados();
    main.appendChild(h('div', { class: 'card' }, h('b', { text: '4. Liberar espaço (já na central)' }), h('p', { class: 'dim', text: 'Depois que a central importar seus pacotes e você importar o arquivo de continuação, remova daqui as visitas e fotos que a central já tem, na mesma versão. O imóvel continua na lista como "Na central". Só entram aqui as que a central confirmou.' }),
      h('button', { class: 'btn big', id: 'btn-liberar', text: 'Liberar espaço (' + cf.length + ' visita' + (cf.length === 1 ? '' : 's') + ')', disabled: cf.length ? null : true, onclick: liberarEspaco })));
  }
  function confirmados() {
    return Object.keys(A.st.visitas).map(function (k) { return A.st.visitas[k]; }).filter(function (v) { var s = A.st.situacao[v.imovelId]; return v.status === 'concluida' && s && s.status === 'concluida' && s.atualizado === v.atualizado && (s.fotos || 0) >= (A.st.fotosN[v.imovelId] || 0); });
  }
  function liberarEspaco() {
    var cf = confirmados(); if (!cf.length) return;
    var nf = cf.reduce(function (n, v) { return n + (A.st.fotosN[v.imovelId] || 0); }, 0);
    U.confirmar('Liberar espaço?', 'Remove deste aparelho ' + cf.length + ' visita(s) e ' + nf + ' foto(s) que a central já recebeu. Não afeta os dados da central.', 'Remover daqui', true).then(function (ok) {
      if (!ok) return;
      cf.reduce(function (p, v) { return p.then(function () { return DB.fotosDe(v.imovelId).then(function (fs) { return fs.reduce(function (q, f) { return q.then(function () { return DB.del('fotos', f.id); }); }, Promise.resolve()); }).then(function () { return DB.del('visitas', v.imovelId); }); }); }, Promise.resolve())
        .then(A.carregar).then(function () { A.render(); U.toast(cf.length + ' visita(s) removidas deste aparelho', 4000); });
    });
  }
  function gerarPacotes(porArq, soNovos, compartilhar) {
    var visitas = Object.keys(A.st.visitas).map(function (k) { return A.st.visitas[k]; });
    if (soNovos) visitas = visitas.filter(function (v) { return v.exp !== v.atualizado; });
    var dias = Object.keys(A.st.dias).map(function (k) { return A.st.dias[k]; }), custos = A.st.custos.slice();
    if (soNovos && !visitas.length && !dias.length) { U.toast('Nada para enviar'); return; }
    if (!visitas.length && !dias.length && !custos.length) { U.toast('Nada para enviar'); return; }
    if (root.MOSAICO_DIA) root.MOSAICO_DIA.salvarAgora();
    var ids = {}; visitas.forEach(function (v) { ids[v.imovelId] = 1; });
    var imoveis = A.st.imoveis.filter(function (i) { return ids[i.id]; });
    var prog = U.sheet('Gerando pacote…', h('p', { id: 'pg', text: 'Preparando…' }), null);
    Promise.all(visitas.map(function (v) { return DB.fotosDe(v.imovelId); }).concat(A.st.custos.map(function (c) { return DB.fotosDe('custo-' + c.id); }))).then(function (ls) {
      var fotos = [].concat.apply([], ls), partes = Math.max(1, Math.ceil(fotos.length / porArq)), seq = Promise.resolve(), arquivos = [];
      for (var p = 0; p < partes; p++) (function (p) {
        seq = seq.then(function () {
          document.getElementById('pg').textContent = 'Parte ' + (p + 1) + ' de ' + partes + '…';
          return PK.montar({ imoveis: imoveis, visitas: visitas, fotos: fotos.slice(p * porArq, (p + 1) * porArq), dias: dias, custos: custos, aparelho: A.st.meta.aparelho, operador: A.st.meta.operador, parte: p + 1, partes: partes }).then(function (u8) {
            var nome = PK.nomePacote(A.st.meta.aparelho, p + 1, partes); arquivos.push({ nome: nome, u8: u8 });
          });
        });
      })(p);
      return seq.then(function () { return arquivos; });
    }).then(function (arquivos) {
      var marcar = function () {
        var agora = new Date().toISOString(); visitas.forEach(function (v) { v.exp = v.atualizado; });
        return DB.putMany('visitas', visitas).then(function () { return DB.setMeta('ultimoEnvio', agora); }).then(A.carregar).then(function () { prog.close(); A.render(); U.toast(arquivos.length + ' arquivo(s) gerado(s)', 3500); });
      };
      if (compartilhar && navigator.canShare) {
        var fs = arquivos.map(function (a) { return new File([a.u8], a.nome, { type: 'application/zip' }); });
        if (navigator.canShare({ files: fs })) return navigator.share({ files: fs, title: 'Pacote Mosaico' }).then(marcar, function (e) { prog.close(); if (e && e.name !== 'AbortError') U.toast('Não foi possível compartilhar; use "Gerar pacote"', 4500); });
        U.toast('Compartilhar não disponível aqui; baixando…', 3000);
      }
      arquivos.forEach(function (a, i) { setTimeout(function () { U.baixar(a.nome, a.u8, 'application/zip'); }, i * 700); });
      return marcar();
    }).catch(function (e) { prog.close(); U.toast('Erro ao gerar: ' + e.message, 5000); });
  }
  function restaurar() {
    var inp = h('input', { type: 'file', accept: '.zip,application/zip', multiple: true });
    inp.addEventListener('change', function () {
      var fs = Array.prototype.slice.call(inp.files); if (!fs.length) return;
      var tot = { im: 0, vi: 0, fo: 0, conf: 0 };
      fs.reduce(function (p, f) { return p.then(function () { return f.arrayBuffer().then(PK.ler).then(function (pk) {
        return DB.all('visitas').then(function (atuais) {
          var m = PK.mesclarVisitas(atuais, pk.visitas); tot.conf += m.conflitos.length;
          var mudou = m.visitas.filter(function (v) { var a = atuais.filter(function (x) { return x.imovelId === v.imovelId; })[0]; return !a || a.atualizado !== v.atualizado; });
          return DB.putMany('imoveis', pk.imoveis).then(function () { return DB.putMany('visitas', mudou); }).then(function () { return Promise.all([DB.all('dias'), DB.all('custos')]); }).then(function (dc) { return Promise.all([DB.putMany('dias', PK.mesclarPorId(dc[0], pk.dias || [])), DB.putMany('custos', PK.mesclarPorId(dc[1], pk.custos || []))]); }).then(function () {
            var fo = pk.fotos.map(function (m2) { var o = {}; Object.keys(m2).forEach(function (k) { if (k !== 'data' && k !== 'arquivo' && k !== 'bytes') o[k] = m2[k]; }); o.blob = new Blob([m2.data], { type: 'image/jpeg' }); return o; });
            return DB.putMany('fotos', fo).then(function () { tot.im += pk.imoveis.length; tot.vi += mudou.length; tot.fo += fo.length; });
          });
        }); }); }); }, Promise.resolve()).then(A.carregar).then(function () { A.render(); U.toast('Restaurado: ' + tot.vi + ' visitas, ' + tot.fo + ' fotos' + (tot.conf ? ', ' + tot.conf + ' conflito(s)' : ''), 5000); })
        .catch(function (e) { U.toast('Erro: ' + e.message, 5000); });
    });
    inp.click();
  }

  /* ---------- ajustes ---------- */
  function telaAjustes(main) {
    var m = A.st.meta;
    function campo(rot, k, ph) { var i = h('input', { type: 'text', value: m[k] || '', placeholder: ph || '' }); i.addEventListener('input', function () { m[k] = i.value.trim(); A.salvarCfg(); }); return h('div', { class: 'field' }, h('div', { class: 'lab', text: rot }), i); }
    main.appendChild(h('div', { class: 'card' }, campo('Nome deste aparelho', 'aparelho', 'Ex.: cel-Ana'), campo('Seu nome (operador)', 'operador', 'Entra em cada visita nova'),
      h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Parque desta equipe' }), h('div', { class: 'chips', id: 'chips-parque' }, [['', 'Ambos'], ['PEBI', 'Biribiri'], ['PESN', 'Serra Negra']].map(function (e) { return h('button', { class: 'chip' + ((m.parque || '') === e[0] ? ' on' : ''), text: e[1], onclick: function () { m.parque = e[0]; A.salvarCfg(); A.st.filtro = 'todos'; A.render(); } }); })), h('p', { class: 'dim', text: 'Mostra só os imóveis do parque da sua equipe. Importar o arquivo de distribuição da central já define isso.' })),
      h('div', { class: 'field' }, h('div', { class: 'lab', text: 'Equipe padrão' }), h('div', { class: 'chips' }, [['A', 'Equipe A'], ['B', 'Equipe B']].map(function (e) { return h('button', { class: 'chip' + (m.equipe === e[0] ? ' on' : ''), text: e[1], onclick: function () { m.equipe = e[0]; A.salvarCfg(); A.render(); } }); })))));
    main.appendChild(root.MOSAICO_DIA.cardAjustes());
    var arm = h('div', { class: 'dim', text: 'Calculando…' });
    main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Armazenamento' }), arm));
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (e) { arm.textContent = 'Usado: ' + U.fmtBytes(e.usage || 0) + ' de ' + U.fmtBytes(e.quota || 0) + '. Dados de fotos: ' + U.fmtBytes(A.st.fotosBytes || 0); });
      if (navigator.storage.persisted) navigator.storage.persisted().then(function (p) { arm.textContent += p ? ' · protegido contra limpeza automática' : ' · não protegido (envie pacotes com frequência)'; });
    } else arm.textContent = 'Indisponível neste navegador.';
    main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Sobre' }), h('p', { class: 'dim', text: 'Mosaico ' + VERSAO + ' · esquema v' + S.SCHEMA_VERSION + ' · funciona sem internet. Dados ficam só neste aparelho até você enviar o pacote.' })));
    main.appendChild(h('div', { class: 'card' }, h('b', { text: 'Apagar tudo' }), h('p', { class: 'dim', text: 'Remove imóveis, visitas e fotos deste aparelho. Gere o pacote antes.' }),
      h('button', { class: 'btn danger', text: 'Apagar todos os dados', onclick: function () {
        var c = contagens();
        var inp = h('input', { type: 'text', placeholder: 'Digite APAGAR', 'aria-label': 'Confirmação' });
        var sh = U.sheet('Apagar tudo?', [h('p', { text: c.nenv ? c.nenv + ' visita(s) NÃO foram enviadas. Os dados serão perdidos.' : 'Esta ação não pode ser desfeita.' }), inp], [h('button', { class: 'btn', text: 'Cancelar', onclick: function () { sh.close(); } }), h('button', { class: 'btn danger', text: 'Apagar', onclick: function () {
          if (inp.value.trim().toUpperCase() !== 'APAGAR') { U.toast('Digite APAGAR para confirmar'); return; }
          Promise.all(['imoveis', 'visitas', 'fotos'].map(function (s) { return DB.clear(s); }).concat([DB.setMeta('situacao', {})])).then(A.carregar).then(function () { sh.close(); A.render(); U.toast('Dados apagados'); });
        } })]);
      } })));
  }

  A.init = function () {
    $app = document.getElementById('app');
    return DB.open().then(A.carregar).then(function () {
      if (root.MOSAICO_DIA) root.MOSAICO_DIA.retomar();
      A.render();
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
    }).catch(function (e) { $app.textContent = 'Erro ao abrir o banco local: ' + e.message + '. Fora de aba anônima? Tente de novo.'; });
  };
  A.ir = function (tela) { A.st.tela = tela; A.render(); window.scrollTo(0, 0); };
  document.addEventListener('DOMContentLoaded', function () { if (!root.__MOSAICO_NO_INIT) A.init(); });
})(window);
