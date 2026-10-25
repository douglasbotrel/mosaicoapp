const {chromium}=require('playwright'),srv=require('./server.js'),path=require('path'),fs=require('fs'),assert=require('assert');
const OUT=path.join(__dirname,'tmp');
(async()=>{
 const s=await srv(path.join(__dirname,'../central'),8133),br=await chromium.launch(),ctx=await br.newContext({viewport:{width:1280,height:900},acceptDownloads:true}),pg=await ctx.newPage(),erros=[];
 pg.on('pageerror',e=>erros.push(e.message));pg.on('console',m=>m.type()==='error'&&erros.push(m.text()));
 await pg.goto('http://localhost:8133/central.html');
 let [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#btn-abrir')]);await fc.setFiles([OUT+'/pkg_dia.zip']);await pg.waitForSelector('.k');await pg.waitForTimeout(500);
 await pg.click('nav >> text=Custos e roteiro');await pg.waitForTimeout(300);await pg.screenshot({path:OUT+'/60_custos.png'});
 console.log((await pg.locator('.k').first().innerText()).replace(/\n+/g,' | '));
 const [d1]=await Promise.all([pg.waitForEvent('download'),pg.click('#btn-rota')]);await d1.saveAs(OUT+'/rota.geojson');
 await pg.click('nav >> text=Exportar');
 for(const [id,n] of [['x-xlsx','c2.xlsx'],['x-shp','c2_shp.zip']]){const [d]=await Promise.all([pg.waitForEvent('download'),pg.click('#'+id)]);await d.saveAs(OUT+'/'+n)}
 // mapa offline pelo navegador
 await pg.click('nav >> text=Mapa offline');await pg.selectOption('#mp-fonte','custom');await pg.fill('#mp-url','http://127.0.0.1:8140/t/{z}/{x}/{y}.jpg');await pg.fill('#mp-atrib','TESTE');await pg.fill('#mp-zmin','12');await pg.fill('#mp-zmax','14');
 await pg.dispatchEvent('#mp-zmax','input');console.log('estimativa:',await pg.locator('#mp-est').innerText());
 await pg.click('#mp-go');await pg.waitForTimeout(500);console.log('sem confirmar:',await pg.locator('#mp-prog').innerText());
 await pg.check('#mp-ok');const [dm]=await Promise.all([pg.waitForEvent('download',{timeout:60000}),pg.click('#mp-go')]);await dm.saveAs(OUT+'/mapa_central.zip');console.log('mapa',fs.statSync(OUT+'/mapa_central.zip').size,await pg.locator('#mp-prog').innerText());
 console.log('erros',erros);await br.close();s.close();
})().catch(e=>{console.error('FALHOU',e.message);process.exit(1)});
