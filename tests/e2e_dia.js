const {chromium,devices}=require('playwright'),srv=require('./server.js'),path=require('path'),fs=require('fs'),assert=require('assert');
const OUT=path.join(__dirname,'tmp');
(async()=>{
 const s=await srv(path.join(__dirname,'../app'),8130),br=await chromium.launch();
 const ctx=await br.newContext({...devices['Pixel 7'],geolocation:{latitude:-18.2400,longitude:-43.6100,accuracy:5},permissions:['geolocation'],acceptDownloads:true});
 const pg=await ctx.newPage(),erros=[];pg.on('pageerror',e=>erros.push(e.message));pg.on('console',m=>m.type()==='error'&&erros.push(m.text()));
 await pg.goto('http://localhost:8130/');await pg.waitForSelector('.stat');
 // config
 await pg.click('nav.tabs >> text=Ajustes');
 await pg.fill('input[aria-label="R$ por km (carro)"]','1.5');await pg.fill('input[aria-label="Diária (R$ por pessoa por dia)"]','100');
 await pg.click('nav.tabs >> text=Dia');await pg.click('#btn-iniciar');await pg.fill('input[aria-label="Pessoas na equipe"]','2');await pg.fill('input[aria-label="Hodômetro inicial (km), se quiser"]','10000');await pg.click('#ok-iniciar');
 await pg.waitForSelector('#btn-encerrar');
 // dirige ~ 2,2 km para leste em passos de ~220 m
 let lon=-43.6100;for(let i=0;i<20;i++){lon+=0.001;await ctx.setGeolocation({latitude:-18.24,longitude:lon,accuracy:5});await pg.waitForTimeout(3000)}
 await pg.waitForTimeout(6000);
 const txt=await pg.locator('.card').first().innerText();console.log(txt.replace(/\n+/g,' | '));
 await pg.screenshot({path:OUT+'/40_dia.png'});
 // encerrar com hodômetro
 await pg.click('#btn-encerrar');await pg.fill('input[aria-label="Hodômetro final (km)"]','10003.4');await pg.click('#ok-encerrar');await pg.waitForTimeout(800);
 let tot=await pg.locator('#tot-dia').innerText();console.log('total dia',tot);
 // 3,4 km*1,5=5,10 + 2*100=200 => 205,10
 assert(/205,10/.test(tot),tot);
 // gasto manual
 await pg.click('#btn-gasto');await pg.click('.sheet button.chip:has-text("Alimentação")');await pg.fill('input[aria-label="Valor total (R$)"]','48.5');await pg.fill('input[aria-label="Descrição"]','Almoço');await pg.click('#ok-gasto');
 await pg.waitForTimeout(400);tot=await pg.locator('#tot-dia').innerText();console.log('total dia',tot);assert(/253,60/.test(tot),tot);
 await pg.screenshot({path:OUT+'/41_custos.png'});
 // pacote
 await pg.click('nav.tabs >> text=Enviar');const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('text=📦 Gerar pacote')]);await dl.saveAs(OUT+'/pkg_dia.zip');
 // restaurar após apagar
 await pg.click('nav.tabs >> text=Ajustes');await pg.click('text=Apagar todos os dados');await pg.fill('.sheet input','APAGAR');await pg.click('.sheet-foot >> text=Apagar');await pg.waitForTimeout(500);
 await pg.click('nav.tabs >> text=Enviar');const [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('text=Restaurar pacote .zip')]);await fc.setFiles(OUT+'/pkg_dia.zip');await pg.waitForSelector('.toast.show');
 await pg.click('nav.tabs >> text=Dia');await pg.waitForSelector('#tot-dia');console.log('após restaurar',await pg.locator('#tot-dia').innerText());
 console.log('erros',erros);await br.close();s.close();
})().catch(e=>{console.error('FALHOU',e.message);process.exit(1)});
