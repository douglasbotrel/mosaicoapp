const {chromium,devices}=require('playwright'),srv=require('./server.js'),path=require('path'),fs=require('fs'),assert=require('assert');
const OUT=path.join(__dirname,'tmp'),AXE=fs.readFileSync('/tmp/npmwork/node_modules/axe-core/axe.min.js','utf8');
const rel=[];const R=(k,v)=>{rel.push(k+': '+v);console.log(k+': '+v)};
(async()=>{
 const s=await srv(path.join(__dirname,'../app'),8127),br=await chromium.launch();
 const ctx=await br.newContext({...devices['Pixel 7'],geolocation:{latitude:-18.24,longitude:-43.61,accuracy:4},permissions:['geolocation']});
 const pg=await ctx.newPage(),erros=[];pg.on('pageerror',e=>erros.push(e.message));pg.on('console',m=>m.type()==='error'&&erros.push(m.text()));
 await pg.goto('http://localhost:8127/');await pg.waitForSelector('.stat');
 // SW + offline
 await pg.evaluate(()=>navigator.serviceWorker.ready);await pg.waitForTimeout(800);
 await ctx.setOffline(true);await pg.reload();await pg.waitForSelector('.stat');R('offline: recarrega sem rede','OK');
 // carga 600
 let [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('text=Importar lista de imóveis')]);
 let t0=Date.now();await fc.setFiles(OUT+'/imoveis_600.csv');await pg.waitForSelector('text=Mostrar mais');R('import 600 imóveis (ms)',Date.now()-t0);
 R('linhas renderizadas na 1ª página',await pg.locator('.row-im').count());
 t0=Date.now();await pg.fill('input[type=search]','teste 59');await pg.waitForFunction(()=>document.querySelectorAll('.row-im').length<20);R('busca filtrada (ms)',Date.now()-t0+' → '+await pg.locator('.row-im').count()+' resultados');
 await pg.fill('input[type=search]','');
 // layout em 360px
 await pg.setViewportSize({width:360,height:740});await pg.waitForTimeout(300);
 const over=async nome=>{const o=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);R('overflow horizontal '+nome+' (px)',o);assert(o<=1,'overflow em '+nome)};
 await over('lista');
 const alvos=async nome=>{const bad=await pg.evaluate(()=>{const out=[];document.querySelectorAll('button,input,select,textarea,a').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||getComputedStyle(e).visibility==='hidden'||e.type==='file'||e.type==='hidden')return;if(r.height<40||r.width<40)out.push((e.className||e.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height)+' '+(e.textContent||'').slice(0,20))});return out});R('alvos de toque <40px em '+nome,bad.length?bad.join(' | '):'nenhum')};
 await alvos('lista');
 // axe
 const axe=async nome=>{await pg.evaluate(AXE);const r=await pg.evaluate(()=>axe.run(document,{runOnly:['wcag2a','wcag2aa']}));const v=r.violations.map(x=>x.id+'('+x.nodes.length+')');R('axe '+nome,v.length?v.join(', '):'sem violações');return r.violations};
 await axe('lista');
 // percorre todos os blocos de um imóvel PESN
 await pg.click('.filtros >> text=Serra Negra');await pg.locator('.row-im').first().click();await pg.waitForSelector('.steps');
 await pg.click('.vbody button.chip:has-text("Realizada, completa")');
 const nb=await pg.locator('.step').count();R('blocos no PESN',nb);
 for(let i=1;i<=nb;i++){await pg.click(`.step:nth-child(${i})`);await pg.waitForTimeout(120);await over('bloco '+i);await alvos('bloco '+i);if(i===3||i===4)await pg.screenshot({path:OUT+`/30_bloco${i}.png`})}
 await pg.click('.step:nth-child(4)');await pg.click('.vbody button.chip:has-text("Aceitou responder")');await pg.click('.step:nth-child(7)');
 await pg.screenshot({path:OUT+'/31_socio.png'});await axe('bloco socioeconômico');

 await pg.click('button[aria-label="Voltar à lista"]');await pg.waitForSelector('.stat');
 for(const aba of ['Dia','Mapa','Enviar','Ajustes']){await pg.click('nav.tabs >> text='+aba);await pg.waitForTimeout(500);await over('aba '+aba);await alvos('aba '+aba);await axe('aba '+aba)}
 // modo escuro
 await pg.emulateMedia({colorScheme:'dark'});await pg.screenshot({path:OUT+'/32_escuro.png'});await pg.emulateMedia({colorScheme:'light'});
 // fonte mínima
 const fs_=await pg.evaluate(()=>{let m=99;document.querySelectorAll('.vbody *').forEach(e=>{if(e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())){const f=parseFloat(getComputedStyle(e).fontSize);if(f<m)m=f}});return m});R('menor fonte no formulário (px)',fs_);
 R('erros de console/página',erros.length?erros.join(' | '):'nenhum');
 fs.writeFileSync(OUT+'/auditoria_ui.txt',rel.join('\n'));await br.close();s.close();
})().catch(e=>{console.error('FALHOU',e.message);process.exit(1)});
