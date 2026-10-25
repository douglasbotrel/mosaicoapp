const {chromium,devices}=require('playwright'),srv=require('./server.js'),fs=require('fs'),path=require('path'),assert=require('assert');
const OUT=path.join(__dirname,'tmp');
(async()=>{
 const s=await srv(path.join(__dirname,'../app'),8125),br=await chromium.launch();
 const ctx=await br.newContext({...devices['Pixel 7'],geolocation:{latitude:-18.24,longitude:-43.61,accuracy:4},permissions:['geolocation'],acceptDownloads:true});
 const pg=await ctx.newPage(),erros=[];pg.on('pageerror',e=>erros.push(e.message));pg.on('console',m=>m.type()==='error'&&erros.push(m.text()));
 await pg.goto('http://localhost:8125/');await pg.waitForSelector('.stat');
 let [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('text=Importar lista de imóveis')]);await fc.setFiles('../exemplos/imoveis_exemplo.csv');await pg.waitForSelector('.row-im');
 await pg.locator('.row-im').first().click();await pg.waitForSelector('.steps');
 const chip=t=>pg.click(`.vbody button.chip:has-text("${t}")`),next=()=>pg.click('text=Próximo →');
 // concluir com erro
 for(let i=0;i<9;i++)await next();
 await pg.click('text=✔ Concluir');await pg.waitForSelector('.sheet');
 const txt=await pg.locator('.sheet').innerText();assert(/Falta: Situação da visita/.test(txt),txt);
 await pg.screenshot({path:OUT+'/10_revisao_erro.png'});
 await pg.click('text=Continuar editando');
 // preencher
 await pg.click('.step:nth-child(1)');await chip('Realizada, completa');await pg.fill('[data-key="b0.responsavel_campo"] input','Douglas');
 await pg.click('.step:nth-child(2)');await chip('Só a pé');await pg.fill('[data-key="b1.caminhada_min"] input','25');
 await pg.click('.step:nth-child(3)');await pg.fill('[data-key="b2.area_estimada_ha"] input','12.5');await chip('Cerca de arame');await chip('Confere em parte');
 await pg.click('.step:nth-child(4)');await chip('Aceitou responder');await pg.fill('[data-key="b3.responsavel_nome"] input','Maria Teste');
 await pg.fill('[data-key="b3.cpf"] input','52998224725');assert.equal(await pg.inputValue('[data-key="b3.cpf"] input'),'529.982.247-25');
 await pg.fill('[data-key="b3.telefone"] input','38999998888');
 await chip('Posseiro');
 await pg.click('.step:nth-child(6)');await pg.click('text=Adicionar benfeitoria');await pg.selectOption('.sheet select','casa');await pg.fill('.sheet input[type=number]','1998');await pg.click('.sheet-foot >> text=Salvar');
 await pg.click('.step:nth-child(7)');await pg.fill('[data-key="b6.n_moradores"] input','3');await pg.fill('[data-key="b6.n_60mais"] input','1');await pg.click('[data-key="b6.faixa_predominante"] .nd');
 await pg.click('.step:nth-child(8)');await chip('Médio').catch(()=>{});
 await pg.screenshot({path:OUT+'/11_bloco8.png'});
 // foto limite
 await pg.locator('#fab').click();await pg.click('.sheet button.chip:has-text("Limite")');
 [fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('text=Da galeria')]);await fc.setFiles(OUT+'/foto1.jpg');await pg.waitForSelector('text=1 foto(s) nesta sessão');await pg.click('.sheet-foot >> text=Fechar');
 await pg.click('.step:nth-child(10)');
 await pg.click('text=✔ Concluir');await pg.waitForSelector('.sheet');
 console.log('REVISÃO:',(await pg.locator('.sheet').innerText()).replace(/\n+/g,' | '));
 await pg.screenshot({path:OUT+'/12_revisao.png'});
 await pg.click('text=Concluir visita');await pg.waitForSelector('.stat');
 assert.equal(await pg.locator('.badge.concluida').count(),1);
 await pg.screenshot({path:OUT+'/13_lista_ok.png'});
 // enviar
 await pg.click('nav.tabs >> text=Enviar');
 const [dl]=await Promise.all([pg.waitForEvent('download'),pg.click('text=📦 Gerar pacote')]);
 const f=OUT+'/pacote_teste.zip';await dl.saveAs(f);console.log('pacote',dl.suggestedFilename(),fs.statSync(f).size);
 await pg.waitForTimeout(800);
 // recarregar página: dados persistem?
 await pg.reload();await pg.waitForSelector('.stat');assert.equal(await pg.locator('.badge.concluida').count(),1);
 // restaurar após apagar
 await pg.click('nav.tabs >> text=Ajustes');await pg.click('text=Apagar todos os dados');await pg.fill('.sheet input','APAGAR');await pg.click('.sheet-foot >> text=Apagar');await pg.waitForTimeout(600);
 await pg.click('nav.tabs >> text=Enviar');[fc]=await Promise.all([pg.waitForEvent('filechooser'),pg.click('text=Restaurar pacote .zip')]);await fc.setFiles(f);await pg.waitForSelector('.toast.show');
 console.log('restaurar:',await pg.locator('.toast').innerText());
 await pg.click('nav.tabs >> text=Imóveis');assert.equal(await pg.locator('.badge.concluida').count(),1);
 console.log('erros',erros);await br.close();s.close();
})().catch(e=>{console.error('FALHOU',e);process.exit(1)});
