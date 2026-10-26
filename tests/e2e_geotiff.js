const {chromium}=require('playwright'),srv=require('./server.js'),path=require('path'),fs=require('fs'),assert=require('assert');
const OUT=path.join(__dirname,'tmp');
(async()=>{
 const s=await srv(path.join(__dirname,'../central'),8127),br=await chromium.launch();
 const ctx=await br.newContext({viewport:{width:1280,height:900},acceptDownloads:true}),pg=await ctx.newPage(),erros=[];
 pg.on('pageerror',e=>erros.push(e.message));pg.on('console',m=>m.type()==='error'&&erros.push(m.text()));
 await pg.goto('http://localhost:8127/central.html');
 await pg.click('nav >> text=Mapa offline');
 for(const [arq,pq,zmn,zmx,saida,must] of [['pebi_utm.tif','pebi',13,15,'gt_pebi.zip',false],['pesn_geo16.tif','pesn',13,15,'gt_pesn.zip',true]]){
  await pg.setInputFiles('#gt-file',OUT+'/'+arq);
  await pg.waitForFunction(()=>/m\/pixel|Erro/.test(document.querySelector('#gt-info').innerText),{timeout:20000});
  console.log(await pg.locator('#gt-info').innerText());
  await pg.setChecked('#gt-pebi',pq==='pebi');await pg.setChecked('#gt-pesn',pq==='pesn');
  await pg.fill('#gt-zmin',String(zmn));await pg.fill('#gt-zmax',String(zmx));
  // sem licença: deve recusar
  await pg.uncheck('#gt-ok');await pg.click('#gt-go');assert(/licença/.test(await pg.locator('#gt-prog').innerText()));
  await pg.check('#gt-ok');await pg.fill('#gt-fonte','TESTE sintético');await pg.fill('#gt-atrib','teste');
  await pg.fill('#gt-parte',pq==='pebi'?'0.12':'150');const dls=[];const h=d=>dls.push(d);pg.on('download',h);
  await pg.click('#gt-go');await pg.waitForFunction(()=>/Pronto|Erro/.test(document.querySelector('#gt-prog').innerText),{timeout:120000});await pg.waitForTimeout(800);pg.off('download',h);
  let i=0;for(const d of dls){i++;await d.saveAs(OUT+'/'+saida.replace('.zip','_p'+i+'.zip'))}
  console.log(saida,'partes:',dls.length,await pg.locator('#gt-prog').innerText());assert(pq==='pesn'?dls.length===1:dls.length>=2);
 }
 // arquivo inválido
 fs.writeFileSync(OUT+'/lixo.tif','nao sou tiff');await pg.setInputFiles('#gt-file',OUT+'/lixo.tif');
 await pg.waitForFunction(()=>/Erro/.test(document.querySelector('#gt-info').innerText));console.log(await pg.locator('#gt-info').innerText());
 console.log('erros',erros);await br.close();s.close();assert(!erros.length);
})().catch(e=>{console.error('FALHOU',e.message);process.exit(1)});
