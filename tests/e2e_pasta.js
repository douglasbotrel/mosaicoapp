/* Central com pasta do projeto: usa o sistema de arquivos privado do navegador (OPFS) no lugar da pasta escolhida. */
const {chromium}=require('playwright'),srv=require('./server.js'),path=require('path'),assert=require('assert');
const OUT=path.join(__dirname,'tmp');
(async()=>{
 const s=await srv(path.join(__dirname,'../central'),8132),br=await chromium.launch();
 const ctx=await br.newContext({viewport:{width:1280,height:900},acceptDownloads:true}),pg=await ctx.newPage(),erros=[];
 pg.on('pageerror',e=>erros.push(e.message));pg.on('console',m=>m.type()==='error'&&erros.push(m.text()));
 await pg.goto('http://localhost:8132/central.html');await pg.waitForSelector('#btn-ir-pasta');
 // ativa a "pasta" (OPFS) como se o usuário tivesse escolhido
 await pg.evaluate(async()=>{const r=await navigator.storage.getDirectory();for await(const n of r.keys())await r.removeEntry(n,{recursive:true});await MOSAICO_PASTA.usar(r);await MOSAICO_CENTRAL.abrirPasta();});
 const lista=()=>pg.evaluate(()=>MOSAICO_PASTA.listar());
 let [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#btn-abrir')]);
 await fc.setFiles([OUT+'/pkgA.zip',OUT+'/pkgB.zip',OUT+'/imoveis_todos.json']);
 await pg.waitForFunction(()=>/12 imóveis · 12 visitas/.test(document.getElementById('hdr').textContent));
 await pg.waitForFunction(()=>MOSAICO_PASTA.listar().then(l=>l.includes('projeto/registro.json')),null,{timeout:20000}).catch(()=>{});
 await pg.waitForTimeout(1500);
 let ls=await lista();console.log(ls.join('\n'));
 assert(ls.some(x=>/^recebidos\/(PEBI|PESN|misto)\/\d{4}-\d\d-\d\d\/pkgA\.zip$/.test(x)),'pkgA em recebidos');
 assert(ls.some(x=>/^recebidos\/.*\/pkgB\.zip$/.test(x)),'pkgB em recebidos');
 assert(ls.includes('lista/imoveis_todos.json'));assert(ls.includes('projeto/projeto_consolidado.zip'));assert(ls.includes('projeto/registro.json'));
 assert(ls.some(x=>/^projeto\/historico\/projeto_\d{4}-\d\d-\d\d\.zip$/.test(x)));
 // exportação vai para a pasta (não baixa)
 await pg.click('nav >> text=Exportar');let baixou=false;pg.once('download',()=>baixou=true);
 await pg.click('#x-xlsx');await pg.waitForFunction(()=>MOSAICO_PASTA.listar().then(l=>l.some(x=>/^exportacoes\/.*\.xlsx$/.test(x))),null,{timeout:20000}).catch(()=>{});await pg.waitForTimeout(800);
 ls=await lista();assert(ls.some(x=>/^exportacoes\/\d{4}-\d\d-\d\d\/mosaico_dados_.*\.xlsx$/.test(x)),'xlsx em exportacoes');assert(!baixou,'não deve baixar pelo navegador');
 // distribuição
 await pg.click('nav >> text=Distribuir aos celulares');await pg.click('#btn-dist-PEBI');await pg.waitForTimeout(800);
 ls=await lista();assert(ls.some(x=>/^distribuicao\/mosaico_distribuicao_PEBI_.*\.json$/.test(x)),'distribuição em distribuicao');
 // mesmo pacote de novo: não sobrescreve nem duplica visitas
 await pg.click('nav >> text=Resumo');[fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#btn-abrir')]);await fc.setFiles([OUT+'/pkgA.zip']);await pg.waitForTimeout(1500);
 ls=await lista();assert(ls.some(x=>/pkgA-2\.zip$/.test(x)),'cópia com sufixo, sem sobrescrever');
 assert(/12 imóveis · 12 visitas/.test(await pg.locator('#hdr').innerText()));
 const antes=await pg.locator('#hdr').innerText();
 // reabre a central: restaura sozinha da pasta
 await pg.reload();await pg.waitForFunction(()=>/12 imóveis · 12 visitas/.test(document.getElementById('hdr').textContent),null,{timeout:30000});
 console.log('restaurado:',await pg.locator('#hdr').innerText());
 await pg.click('nav >> text=Resumo');const tx=await pg.locator('main').innerText();assert(/Pacotes recebidos/.test(tx)&&/pkgA\.zip/.test(tx),'registro de pacotes restaurado');
 await pg.click('nav >> text=Pasta do projeto');assert(/gravação automática ligada/.test(await pg.locator('main').innerText()));
 await pg.screenshot({path:OUT+'/31_pasta.png'});
 assert.deepEqual(erros,[],erros.join('\n'));console.log('E2E PASTA OK');await br.close();s.close&&s.close();
})().catch(e=>{console.error(e);process.exit(1)});
