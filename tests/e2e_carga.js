const {chromium}=require('playwright'),srv=require('./server.js'),path=require('path'),fs=require('fs');
const OUT=path.join(__dirname,'tmp/carga');
(async()=>{const s=await srv(path.join(__dirname,'../central'),8128),br=await chromium.launch(),pg=await (await br.newContext({viewport:{width:1280,height:900},acceptDownloads:true})).newPage(),erros=[];
 pg.on('pageerror',e=>erros.push(e.message));
 await pg.goto('http://localhost:8128/central.html');
 let t0=Date.now();const [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#btn-abrir')]);await fc.setFiles([OUT+'/pkgA.zip',OUT+'/pkgB.zip',OUT+'/imoveis_todos.json']);
 await pg.waitForFunction(()=>document.getElementById('hdr').textContent.includes('600 visitas'),{timeout:120000});console.log('carregar 80 MB (s)',(Date.now()-t0)/1000,await pg.locator('#hdr').innerText());
 console.log((await pg.locator('.msg').allInnerTexts()).join(' || '));
 await pg.click('nav >> text=Exportar');
 for(const [id,nome] of [['x-xlsx','xlsx'],['x-shp','shp.zip'],['x-pdf','pdf'],['x-fotos','fotos.zip']]){t0=Date.now();const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:180000}),pg.click('#'+id)]);await dl.saveAs(OUT+'/c.'+nome);console.log(nome,(Date.now()-t0)/1000+'s',(fs.statSync(OUT+'/c.'+nome).size/1048576).toFixed(1)+' MB')}
 const m=await pg.evaluate(()=>performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null);console.log('heap MB',m,'erros',erros);await br.close();s.close()})().catch(e=>{console.error('FALHOU',e.message);process.exit(1)});
