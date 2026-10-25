const {chromium,devices}=require('playwright'),srv=require('./server.js'),fs=require('fs'),path=require('path'),assert=require('assert');
const APP=path.join(__dirname,'../app'),OUT=path.join(__dirname,'tmp');
(async()=>{
 const s=await srv(APP,8123);
 const br=await chromium.launch();
 const ctx=await br.newContext({...devices['Pixel 7'],geolocation:{latitude:-18.2400,longitude:-43.6100,accuracy:4},permissions:['geolocation'],acceptDownloads:true,serviceWorkers:'allow'});
 const pg=await ctx.newPage();const erros=[];
 pg.on('pageerror',e=>erros.push('pageerror '+e.message));pg.on('console',m=>{if(m.type()==='error')erros.push('console '+m.text())});
 await pg.goto('http://localhost:8123/');await pg.waitForSelector('.stat');
 const shot=async n=>pg.screenshot({path:path.join(OUT,n+'.png')});
 await shot('01_vazio');
 // importar lista
 const [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('text=Importar lista de imóveis')]);
 await fc.setFiles(path.join(__dirname,'../exemplos/imoveis_exemplo.csv'));
 await pg.waitForSelector('.row-im');
 assert.equal(await pg.locator('.row-im').count(),12);await shot('02_lista');
 // buscar
 await pg.fill('input[type=search]','vereda');await pg.waitForTimeout(300);assert.equal(await pg.locator('.row-im').count(),1);
 await pg.fill('input[type=search]','');await pg.waitForTimeout(300);
 // abrir primeiro PEBI
 await pg.locator('.row-im').first().click();await pg.waitForSelector('.steps');await shot('03_b0');
 await pg.click('button.chip:has-text("Realizada, completa")');
 await pg.fill('[data-key="b0.responsavel_campo"] input','Douglas');
 await pg.click('text=Próximo →');await shot('04_b1');
 await pg.locator('[data-key="b1.ponto_acesso"] button').click();
 await pg.waitForSelector('.sheet');await pg.waitForSelector('.gpsval',{timeout:30000});await shot('05_gps');
 console.log('ponto:',await pg.locator('.gpsval').innerText());
 await pg.click('text=Próximo →');
 // trilha de limite
 await pg.click('text=Começar caminhada no limite');
 const quad=[[-18.2400,-43.6100],[-18.2400,-43.6090],[-18.2391,-43.6090],[-18.2391,-43.6100],[-18.2400,-43.6100]];
 for(const [la,lo] of quad){await ctx.setGeolocation({latitude:la,longitude:lo,accuracy:4});await pg.waitForTimeout(1200)}
 await pg.click('text=Parar e fechar limite');await pg.waitForTimeout(500);await shot('06_trilha');
 console.log('trilha:',await pg.locator('.tres').innerText());
 const area=await pg.inputValue('[data-key="b2.area_estimada_ha"] input');console.log('area auto',area);
 assert(Math.abs(parseFloat(area)-1.0)<0.15,'area ~1 ha: '+area);
 // foto
 await pg.locator('#fab').click();
 const [fc2]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('text=Da galeria')]);
 await fc2.setFiles(path.join(OUT,'foto1.jpg'));await pg.waitForSelector('text=1 foto(s) nesta sessão',{timeout:10000});
 await pg.click('.sheet-foot >> text=Fechar');
 assert.equal(await pg.locator('#fabn').innerText(),'1');
 await shot('07_foto');
 fs.writeFileSync(path.join(OUT,'erros.txt'),erros.join('\n'));
 console.log('erros:',erros);
 await br.close();s.close();
})().catch(e=>{console.error('FALHOU',e);process.exit(1)});
