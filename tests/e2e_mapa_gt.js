const {chromium,devices}=require('playwright'),srv=require('./server.js'),path=require('path'),fs=require('fs'),assert=require('assert');
const OUT=path.join(__dirname,'tmp');
(async()=>{
 const s=await srv(path.join(__dirname,'../app'),8132),br=await chromium.launch();
 const ctx=await br.newContext({...devices['Pixel 7'],geolocation:{latitude:-18.12,longitude:-43.58,accuracy:6},permissions:['geolocation']});
 const pg=await ctx.newPage(),erros=[];pg.on('pageerror',e=>erros.push(e.message));pg.on('console',m=>m.type()==='error'&&erros.push(m.text()));
 await pg.goto('http://localhost:8132/');await pg.waitForSelector('.stat');
 await pg.click('nav.tabs >> text=Mapa');await pg.waitForSelector('.leaflet-container');await pg.waitForTimeout(800);
 console.log(await pg.locator('.dim').first().innerText());await pg.screenshot({path:OUT+'/52_gt_sem.png'});
 const [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('button:has-text("Importar mapa")')]);await fc.setFiles(OUT+'/gt_pebi.zip');
 await pg.waitForFunction(()=>document.querySelector('.leaflet-tile-container img, .leaflet-layer img'),{timeout:20000}).catch(()=>{});
 await pg.waitForTimeout(1500);console.log(await pg.locator('.dim').first().innerText());
 await pg.click('text=◎ Onde estou');await pg.waitForTimeout(1500);
 await ctx.setOffline(true);await pg.click('#btn-pebi');await pg.waitForTimeout(1500);
 const n=await pg.evaluate(()=>[...document.querySelectorAll('.leaflet-layer img')].filter(i=>i.complete&&i.naturalWidth>0).length);console.log('tiles desenhados offline:',n);assert(n>3);
 await pg.screenshot({path:OUT+'/53_gt_pacote.png'});
 console.log('erros',erros);await br.close();s.close();
})().catch(e=>{console.error('FALHOU',e.message);process.exit(1)});
