#!/usr/bin/env node
// Gera o pacote de mapa offline (tiles) só dentro dos limites dos parques. Roda no seu computador, com internet.
// uso: node tools/baixar_mapa.js --url "https://servidor/{z}/{y}/{x}.jpg" --atrib "Fonte da imagem" --zmin 12 --zmax 16 --parques PEBI,PESN --saida mapa.zip --confirmo-licenca
const fs=require('fs'),path=require('path');
const T=require('../app/js/tiles.js'),C=require('../app/js/core.js');
const a=process.argv.slice(2),get=(k,d)=>{const i=a.indexOf('--'+k);return i>=0?a[i+1]:d};
const url=get('url'),zmin=+get('zmin',12),zmax=+get('zmax',16),pq=get('parques','PEBI,PESN').split(','),saida=get('saida','mapa_offline.zip'),buf=+get('buffer',300),atrib=get('atrib',''),fonte=get('fonte','provedor informado');
if(!url||!/\{z\}/.test(url)||!/\{x\}/.test(url)||!/\{y\}/.test(url)){console.error('Informe --url com {z} {x} {y}');process.exit(1)}
if(!a.includes('--confirmo-licenca')){console.error('Confirme com --confirmo-licenca que o provedor permite guardar cópia offline para este uso.');process.exit(1)}
const g=JSON.parse(fs.readFileSync(path.join(__dirname,'parques_full.geojson')));
const polys=g.features.filter(f=>pq.includes(f.properties.codigo)).map(f=>f.geometry.coordinates[0]);
const lista=T.lista(polys,zmin,zmax,buf);console.log(lista.length,'tiles (~'+(lista.length*0.025).toFixed(0)+' MB)');
const files=[];let i=0,ok=0,vazio=0,falha=0;
async function um(){while(i<lista.length){const t=lista[i++];const u=url.replace('{z}',t.z).replace('{x}',t.x).replace('{y}',t.y);
 for(let n=0;n<3;n++){try{const r=await fetch(u);if(r.status===404||r.status===204){vazio++;break}if(!r.ok)throw new Error(r.status);const b=new Uint8Array(await r.arrayBuffer());if(b.length<200){vazio++;break}const ct=r.headers.get('content-type')||'';files.push({name:`${t.z}/${t.x}/${t.y}.${/png/.test(ct)?'png':/webp/.test(ct)?'webp':'jpg'}`,data:b});ok++;break}catch(e){if(n==2)falha++;else await new Promise(r=>setTimeout(r,500*(n+1)))}}
 if((ok+vazio+falha)%100===0)process.stdout.write(`\r${ok+vazio+falha}/${lista.length} falhas ${falha}`)}}
(async()=>{await Promise.all([...Array(6)].map(um));console.log(`\nbaixados ${ok}, sem imagem ${vazio}, falhas ${falha}`);if(!ok){console.error('Nada baixado');process.exit(1)}
 const meta={formato:1,fonte,atribuicao:atrib,licencaConfirmada:true,zmin,zmax,parques:pq,bufferM:buf,geradoEm:new Date().toISOString(),nTiles:ok};
 fs.writeFileSync(saida,C.makeZip([{name:'mapa.json',data:JSON.stringify(meta,null,1)},...files]));console.log('gerado',saida,(fs.statSync(saida).size/1048576).toFixed(1)+' MB')})();
