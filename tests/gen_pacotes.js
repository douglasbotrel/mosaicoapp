// gera pacotes sintéticos (dados fictícios) para testar a central. uso: node gen_pacotes.js N saida_dir
const fs=require('fs'),path=require('path');
const C=require('../app/js/core.js'),PK=require('../app/js/pacote.js'),T=require('../app/js/csv.js');
const N=+process.argv[2]||12,out=process.argv[3]||path.join(__dirname,'tmp'),foto=fs.readFileSync(process.env.FOTO||path.join(__dirname,'tmp/foto1.jpg'));
let seed=42;const rnd=()=>(seed=(seed*1664525+1013904223)%4294967296)/4294967296,pick=a=>a[Math.floor(rnd()*a.length)];
const imoveis=T.imoveisDeTabela(T.parse(fs.readFileSync(path.join(__dirname,'../exemplos/imoveis_exemplo.csv'),'utf8'))).imoveis;
for(let i=imoveis.length;i<N;i++){const pq=i%5<2?'PEBI':'PESN';const h=[...Array(32)].map(()=>'0123456789ABCDEF'[Math.floor(rnd()*16)]).join('');imoveis.push({id:`${pq}-${String(i+1).padStart(3,'0')}`,parque:pq,nome:'Imóvel '+(i+1),car:'MG-3121605-'+h.match(/.{4}/g).join('.'),area_car_ha:+(rnd()*100+2).toFixed(2),municipio:pq==='PEBI'?'Diamantina':'Itamarandiba'})}
function visita(im,ap,t){const lat=-18.24+rnd()*0.2,lon=-43.6+rnd()*0.1,L=0.0008+rnd()*0.002;
 const pts=[[lat,lon],[lat,lon+L],[lat+L,lon+L],[lat+L,lon]].map(([a,b],k)=>({lat:a,lon:b,acc:4,t:k}));const area=C.polygonAreaM2(pts);
 const d={'b0.situacao_visita':'completa','b0.equipe':'A','b0.data_visita':'2026-10-20','b0.responsavel_campo':'Equipe teste','b0.car_numero':im.car,'b2.area_car_ha':im.area_car_ha,
 'b1.ponto_acesso':{lat,lon,acc:3.5,n:8,t:1},'b2.limite':{pts,areaM2:area,perimM:C.perimeterM(pts,true),fechada:true},'b2.area_estimada_ha':+(area/1e4).toFixed(2),
 'b2.elementos_limite':['cerca_arame','estrada'],'b3.consentimento':'sim','b3.responsavel_nome':'Pessoa Fictícia '+im.id,'b3.cpf':'529.982.247-25','b3.telefone':'(38) 99999-8888','b3.vinculo':pick(['posseiro','proprietario','herdeiro']),
 'b5.usos':['pecuaria'],'b5.benfeitorias':[{tipo:'casa',ano:1990+Math.floor(rnd()*30),estado:'bom',ponto:{lat:lat+L/2,lon:lon+L/2,acc:4}}],
 'b6.n_moradores':3,'b6.n_60mais':1,'b8.impacto':'baixo','b9.consolidacao':'alto','b9.tipologia':['risco_juridico']};
 if(im.parque==='PESN'&&rnd()<0.2)d['b7.nome_comunidade']='Comunidade Exemplo';
 return {imovelId:im.id,status:'concluida',criado:t,atualizado:t,aparelho:ap,schema:1,dados:d,nd:{},auto:{}}}
async function pack(nome,ap,lista,t,nf){const vs=lista.map(im=>visita(im,ap,t));const fotos=[];vs.forEach(v=>{for(let k=0;k<nf;k++){const d=v.dados['b1.ponto_acesso'];fotos.push({id:`f-${v.imovelId.replace(/\W/g,'')}${k}${ap.slice(-2)}`.slice(0,24),imovelId:v.imovelId,cat:['limite','benfeitoria','acesso','area_interna'][k%4],legenda:'',t,lat:d.lat,lon:d.lon,acc:5,blob:new Blob([foto])});}});
 const u8=await PK.montar({imoveis:lista,visitas:vs,fotos,aparelho:ap,operador:'teste',parte:1,partes:1});fs.writeFileSync(path.join(out,nome),u8);return u8.length}
(async()=>{const a=imoveis.slice(0,Math.ceil(N*0.6)),b=imoveis.slice(Math.floor(N*0.5));
 const nf=+process.argv[4]||2;
 console.log('A',await pack('pkgA.zip','cel-A',a,'2026-10-20T12:00:00.000Z',nf));
 console.log('B',await pack('pkgB.zip','cel-B',b,'2026-10-21T12:00:00.000Z',nf));
 fs.writeFileSync(path.join(out,'imoveis_todos.json'),JSON.stringify(imoveis));})();
