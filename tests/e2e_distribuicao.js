/* Etapa 1: distribuição por parque, continuação, "Na central", liberar espaço, troca de parque recusada. */
const {chromium,devices}=require('playwright'),srv=require('./server.js'),fs=require('fs'),path=require('path'),assert=require('assert');
const E=require('../central/export.js'),OUT=path.join(__dirname,'tmp');fs.mkdirSync(OUT,{recursive:true});
// --- central (node): monta estado e gera arquivos por parque
const est=E.novoEstado();
const ims=[];for(let i=1;i<=4;i++)ims.push({id:'PEBI-0'+i,parque:'PEBI',nome:'Imóvel B'+i,car:''});for(let i=1;i<=2;i++)ims.push({id:'PESN-0'+i,parque:'PESN',nome:'Imóvel S'+i,car:''});
E.incorporarLista(est,ims);
const T1='2026-10-26T10:00:00.000Z';
est.visitas['PEBI-01']={imovelId:'PEBI-01',status:'concluida',atualizado:T1,aparelho:'cel-A',dados:{}};
est.visitas['PEBI-02']={imovelId:'PEBI-02',status:'rascunho',atualizado:T1,aparelho:'cel-A',dados:{}};
const dB=E.distribuicao(est,'PEBI'),dS=E.distribuicao(est,'PESN');
assert.equal(dB.imoveis.length,4);assert.equal(dS.imoveis.length,2);assert.equal(dB.situacao.length,2);assert.equal(dS.situacao.length,0);
assert(dB.imoveis.every(i=>i.parque==='PEBI'));
fs.writeFileSync(OUT+'/dist_PEBI.json',JSON.stringify(dB));fs.writeFileSync(OUT+'/dist_PESN.json',JSON.stringify(dS));
(async()=>{
 const s=await srv(path.join(__dirname,'../app'),8131),br=await chromium.launch();
 const ctx=await br.newContext({...devices['Pixel 7']});const pg=await ctx.newPage(),erros=[];pg.on('pageerror',e=>erros.push(e.message));
 await pg.goto('http://localhost:8131/');await pg.waitForSelector('.stat');
 const imp=async f=>{await pg.click('nav.tabs >> text=Enviar');const [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('text=Importar lista')]);await fc.setFiles(f);await pg.waitForSelector('.toast.show');const t=await pg.locator('.toast').innerText();await pg.waitForTimeout(300);return t;};
 // 1) primeira distribuição PEBI
 let t=await imp(OUT+'/dist_PEBI.json');console.log('import:',t);assert(/PEBI: 4 imóveis, 1 já concluídos na central, 3 a fazer/.test(t),t);
 await pg.click('nav.tabs >> text=Imóveis');
 assert.equal(await pg.locator('.row-im').count(),3,'filtro A fazer: 3 (concluído fica de fora)');
 assert.equal(await pg.locator('button.chip:has-text("Biribiri")').count(),0,'sem chips de parque');
 await pg.click('button.chip:has-text("Concluídos")');assert.equal(await pg.locator('.row-im .badge.central').count(),1);
 // abrir imóvel "Na central" pede confirmação
 await pg.locator('.row-im').first().click();await pg.waitForSelector('.sheet');assert(/Já concluído na central/.test(await pg.locator('.sheet').innerText()));await pg.click('.sheet-foot >> text=Cancelar');
 // 2) parque errado é recusado
 t=await imp(OUT+'/dist_PESN.json');console.log('recusa:',t);assert(/equipe PEBI/.test(t),t);
 // 3) visita local concluída (injetada) e central com a mesma versão -> liberar espaço
 const T2='2026-10-26T12:00:00.000Z';
 await pg.evaluate(async T2=>{await window.MOSAICO_DB.put('visitas',{imovelId:'PEBI-03',status:'concluida',atualizado:T2,dados:{},nd:{},aparelho:'cel-X'});await window.MOSAICO_APP.carregar();},T2);
 await pg.click('nav.tabs >> text=Enviar');assert(/Liberar espaço \(0 visitas\)/.test(await pg.locator('#btn-liberar').innerText()),'sem confirmação da central: 0');
 est.visitas['PEBI-03']={imovelId:'PEBI-03',status:'concluida',atualizado:'2026-10-26T11:00:00.000Z',aparelho:'cel-X',dados:{}}; // versão diferente
 fs.writeFileSync(OUT+'/dist_PEBI_b.json',JSON.stringify(E.distribuicao(est,'PEBI')));
 await imp(OUT+'/dist_PEBI_b.json');await pg.click('nav.tabs >> text=Enviar');
 assert(/Liberar espaço \(0 visitas\)/.test(await pg.locator('#btn-liberar').innerText()),'versão diferente não libera');
 est.visitas['PEBI-03'].atualizado=T2;fs.writeFileSync(OUT+'/dist_PEBI_c.json',JSON.stringify(E.distribuicao(est,'PEBI')));
 await imp(OUT+'/dist_PEBI_c.json');await pg.click('nav.tabs >> text=Enviar');
 assert(/Liberar espaço \(1 visita\)/.test(await pg.locator('#btn-liberar').innerText()),await pg.locator('#btn-liberar').innerText());
 await pg.click('#btn-liberar');await pg.click('.sheet-foot >> text=Remover daqui');await pg.waitForFunction(()=>/\(0 visitas\)/.test(document.querySelector('#btn-liberar').innerText));
 assert(/Liberar espaço \(0 visitas\)/.test(await pg.locator('#btn-liberar').innerText()));
 assert.equal(await pg.evaluate(()=>window.MOSAICO_DB.count('visitas')),0);
 await pg.click('nav.tabs >> text=Imóveis');await pg.click('button.chip:has-text("Concluídos")');assert.equal(await pg.locator('.row-im .badge.central').count(),2,'PEBI-01 e PEBI-03 na central');
 // 4) persiste ao recarregar
 await pg.reload();await pg.waitForSelector('.stat');assert.equal(await pg.locator('.stat div:first-child b').innerText(),'4');
 await pg.screenshot({path:OUT+'/30_distribuicao.png'});
 assert.deepEqual(erros,[],erros.join('\n'));
 console.log('E2E DISTRIBUIÇÃO OK');await br.close();s.close&&s.close();
})().catch(e=>{console.error(e);process.exit(1)});
