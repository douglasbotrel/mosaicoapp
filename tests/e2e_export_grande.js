const {chromium,devices}=require('playwright'),srv=require('./server.js'),path=require('path'),fs=require('fs'),assert=require('assert');
(async()=>{const s=await srv(path.join(__dirname,'../app'),8129),br=await chromium.launch(),ctx=await br.newContext({...devices['Pixel 7'],acceptDownloads:true}),pg=await ctx.newPage(),erros=[];pg.on('pageerror',e=>erros.push(e.message));
 await pg.goto('http://localhost:8129/');await pg.waitForSelector('.stat');
 const foto=fs.readFileSync(path.join(__dirname,'tmp/foto_real.jpg')).toString('base64');
 await pg.evaluate(async b64=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),DB=MOSAICO_DB,im=[],vs=[],fs=[];
  for(let i=0;i<285;i++){const id=(i<51?'PEBI-':'PESN-')+i;im.push({id,parque:i<51?'PEBI':'PESN',nome:'Im '+i});vs.push({imovelId:id,status:'concluida',criado:'2026-10-20T10:00:00Z',atualizado:'2026-10-20T10:00:00Z',aparelho:'t',schema:1,dados:{'b0.situacao_visita':'completa'},nd:{},auto:{}});fs.push({id:'f'+i,imovelId:id,cat:'limite',t:'2026-10-20T10:00:00Z',lat:-18.2,lon:-43.6,acc:5,blob:new Blob([bin],{type:'image/jpeg'})})}
  await DB.putMany('imoveis',im);await DB.putMany('visitas',vs);await DB.putMany('fotos',fs)},foto);
 await pg.reload();await pg.waitForSelector('.stat');await pg.click('nav.tabs >> text=Enviar');
 const t0=Date.now(),dls=[];pg.on('download',d=>dls.push(d));
 await pg.click('text=📦 Gerar pacote');await pg.waitForFunction(()=>document.querySelector('.toast.show'),{timeout:120000});await pg.waitForTimeout(2500);
 console.log('arquivos',dls.length,'tempo s',(Date.now()-t0)/1000);
 for(const [i,d] of dls.entries()){await d.saveAs(path.join(__dirname,'tmp/grande_'+i+'.zip'));console.log(d.suggestedFilename(),(fs.statSync(path.join(__dirname,'tmp/grande_'+i+'.zip')).size/1048576).toFixed(1)+' MB')}
 console.log('erros',erros);await br.close();s.close()})().catch(e=>{console.error('FALHOU',e.message);process.exit(1)});
