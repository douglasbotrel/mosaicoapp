const {chromium,devices}=require('playwright'),srv=require('./server.js'),path=require('path');
(async()=>{const s=await srv(path.join(__dirname,'../app'),8132),br=await chromium.launch(),ctx=await br.newContext({...devices['Pixel 7']}),pg=await ctx.newPage();
pg.on('pageerror',e=>console.log('PE',e.message));pg.on('console',m=>console.log('C',m.text()));
await pg.goto('http://localhost:8132/');await pg.waitForSelector('.stat');await pg.click('nav.tabs >> text=Mapa');await pg.waitForTimeout(1200);
console.log(await pg.evaluate(()=>[typeof L,!!window.MOSAICO_PARQUES,document.querySelectorAll('path.leaflet-interactive').length]));await pg.screenshot({path:'tmp/dbg.png'});await br.close();s.close()})();
