const {chromium}=require('playwright'),srv=require('./server.js'),path=require('path'),fs=require('fs'),assert=require('assert');
const OUT=path.join(__dirname,'tmp');
(async()=>{
 const s=await srv(path.join(__dirname,'../central'),8126),br=await chromium.launch();
 const ctx=await br.newContext({viewport:{width:1280,height:900},acceptDownloads:true}),pg=await ctx.newPage(),erros=[];
 pg.on('pageerror',e=>erros.push(e.message));pg.on('console',m=>m.type()==='error'&&erros.push(m.text()));
 await pg.goto('http://localhost:8126/central.html');
 let [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('#btn-abrir')]);
 await fc.setFiles([OUT+'/pkgA.zip',OUT+'/pkgB.zip',OUT+'/imoveis_todos.json']);
 await pg.waitForSelector('.k');await pg.waitForTimeout(500);
 console.log(await pg.locator('#hdr').innerText());
 console.log((await pg.locator('.msg').allInnerTexts()).join(' || '));
 await pg.screenshot({path:OUT+'/20_central_resumo.png'});
 await pg.click('nav >> text=Qualidade');await pg.screenshot({path:OUT+'/21_central_qa.png'});
 await pg.click('nav >> text=Exportar');
 await pg.check('#ck-pess');
 for(const [id,nome] of [['x-xlsx','dados.xlsx'],['x-csv','visitas.csv'],['x-shp','shp.zip'],['x-gj','geo.geojson'],['x-pdf','fichas.pdf'],['x-fotos','fotos.zip'],['x-proj','proj.zip']]){
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:60000}),pg.click('#'+id)]);await dl.saveAs(OUT+'/central_'+nome);console.log(nome,fs.statSync(OUT+'/central_'+nome).size)}
 await pg.click('nav >> text=Distribuir aos celulares');await pg.screenshot({path:OUT+'/22_central_lista.png'});
 console.log('erros',erros);await br.close();s.close();
})().catch(e=>{console.error('FALHOU',e);process.exit(1)});
