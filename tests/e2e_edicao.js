/* Correção em campo: dados do imóvel editáveis durante e depois da coleta; correção não é perdida ao reimportar a lista. */
const {chromium,devices}=require('playwright'),srv=require('./server.js'),path=require('path'),assert=require('assert'),fs=require('fs');
const E=require('../central/export.js'),OUT=path.join(__dirname,'tmp');
(async()=>{
 const s=await srv(path.join(__dirname,'../app'),8133),br=await chromium.launch();
 const ctx=await br.newContext({...devices['Pixel 7'],geolocation:{latitude:-18.24,longitude:-43.61,accuracy:4},permissions:['geolocation']});
 const pg=await ctx.newPage(),erros=[];pg.on('pageerror',e=>erros.push(e.message));
 await pg.goto('http://localhost:8133/');await pg.waitForSelector('.stat');
 let [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('text=Importar lista de imóveis')]);await fc.setFiles('../exemplos/imoveis_exemplo.csv');await pg.waitForSelector('.row-im');
 const nome0=await pg.locator('.row-im .t').first().innerText();
 await pg.locator('.row-im').first().click();await pg.waitForSelector('#btn-edit-imovel');
 // preenche algo no bloco 1 e corrige o imóvel no meio da coleta
 await pg.click('.vbody button.chip:has-text("Realizada, completa")');
 await pg.click('#btn-edit-imovel');await pg.fill('.sheet input[aria-label="Nome do imóvel"]','Fazenda Corrigida');await pg.fill('.sheet input[aria-label="Matrícula"]','12345');
 await pg.fill('.sheet input[aria-label="Nº do CAR"]','MG-XX');await pg.click('#ok-edit-imovel');
 assert(/fora do padrão/.test(await pg.locator('.sheet .aviso').innerText()));await pg.click('#ok-edit-imovel');await pg.waitForSelector('h1:has-text("Fazenda Corrigida")');
 // a escolha anterior da visita continua marcada
 assert.equal(await pg.locator('.vbody button.chip.on:has-text("Realizada, completa")').count(),1);
 // volta à lista, reimporta a lista original: correção permanece
 await pg.click('button[aria-label="Voltar à lista"]');await pg.waitForSelector('.row-im');
 assert(await pg.locator('.row-im:has-text("Fazenda Corrigida")').count()===1);
 await pg.click('nav.tabs >> text=Enviar');[fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('text=Importar lista')]);await fc.setFiles('../exemplos/imoveis_exemplo.csv');await pg.waitForTimeout(800);
 await pg.click('nav.tabs >> text=Imóveis');assert(await pg.locator('.row-im:has-text("Fazenda Corrigida")').count()===1,'reimportar não desfaz a correção');
 assert.equal(await pg.locator(`.row-im:has-text("${nome0}")`).count(),0);
 // central: lista antiga não desfaz a correção vinda de pacote
 const est=E.novoEstado();E.incorporarLista(est,[{id:'X1',parque:'PEBI',nome:'Antigo'}]);
 E.incorporar(est,{manifest:{aparelho:'c',parque:'PEBI'},imoveis:[{id:'X1',parque:'PEBI',nome:'Novo',corrigidoEm:'2026-10-26T10:00:00Z'}],visitas:[],fotos:[],dias:[],custos:[]},'p.zip');
 E.incorporarLista(est,[{id:'X1',parque:'PEBI',nome:'Antigo'}]);assert.equal(est.imoveis.X1.nome,'Novo');
 assert.deepEqual(erros,[],erros.join('\n'));console.log('E2E EDIÇÃO OK');await br.close();s.close&&s.close();
})().catch(e=>{console.error(e);process.exit(1)});
