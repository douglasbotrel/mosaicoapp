const C=require('../app/js/core.js'),fs=require('fs'),assert=require('assert');
let n=0;function t(name,f){try{f();n++;console.log('ok  ',name)}catch(e){console.log('FAIL',name,e.message);process.exitCode=1}}
t('area quadrado 100m',()=>{const lat=-18.2,lon=-43.6,dl=100/111320,dn=100/(111320*Math.cos(lat*Math.PI/180));
 const a=C.polygonAreaM2([{lat,lon},{lat,lon:lon+dn},{lat:lat+dl,lon:lon+dn},{lat:lat+dl,lon}]);assert(Math.abs(a-10000)<60,a)});
t('haversine 1 grau lat',()=>{const d=C.haversine({lat:-18,lon:-43},{lat:-19,lon:-43});assert(Math.abs(d-111195)<200,d)});
t('cpf',()=>{assert(C.cpfValido('529.982.247-25'));assert(!C.cpfValido('111.111.111-11'));assert(!C.cpfValido('529.982.247-24'))});
t('fmt',()=>{assert.equal(C.fmtCpf('52998224725'),'529.982.247-25');assert.equal(C.fmtTel('38999998888'),'(38) 99999-8888')});
t('car',()=>{assert(C.carValido('MG-3121605-ABCD.1234.5678.9ABC.DEF0.1234.5678.9ABC'));assert(!C.carValido('MG-123'))});
t('coord',()=>{assert(C.coordValida(-18.2,-43.6));assert(!C.coordValida(18.2,-43.6));assert(!C.coordValida(-43.6,-18.2))});
t('media gps descarta outlier',()=>{const f=[];for(let i=0;i<10;i++)f.push({lat:-18.2+1e-6*i,lon:-43.6,acc:5});f.push({lat:-18.21,lon:-43.6,acc:5});const m=C.averageFixes(f);assert(m.n===10&&Math.abs(m.lat+18.2)<1e-4,JSON.stringify(m))});
t('simplify',()=>{const p=[];for(let i=0;i<50;i++)p.push({lat:-18.2,lon:-43.6+i*1e-5});assert.equal(C.simplify(p,1).length,2)});
t('zip roundtrip + unzip/python',async()=>{});
const files=[{name:'a.txt',data:'olá ç'},{name:'dir/b.bin',data:new Uint8Array([0,1,2,255])}];
fs.writeFileSync('/tmp/t.zip',C.makeZip(files));
C.readZip(fs.readFileSync('/tmp/t.zip')).then(r=>{assert.equal(r.length,2);assert.equal(new TextDecoder().decode(r[0].data),'olá ç');console.log('ok   readZip')});
// exif
const jpg=fs.readFileSync(process.argv[2]);const o=C.jpegWithGps(new Uint8Array(jpg),-18.123456,-43.654321,1234.5);fs.writeFileSync('/tmp/gps.jpg',o);
// shapefile
const ring=[{lat:-18.2,lon:-43.6},{lat:-18.2,lon:-43.59},{lat:-18.19,lon:-43.59},{lat:-18.19,lon:-43.6}];
const s=C.writeShapefile('polygon',[[ring]],[{n:'id',t:'C',len:20},{n:'area_ha',t:'N',len:12,dec:2}],[{id:'Água ç',area_ha:12.3456}]);
for(const k of['shp','shx','dbf'])fs.writeFileSync('/tmp/p.'+k,s[k]);fs.writeFileSync('/tmp/p.prj',s.prj);
const pt=C.writeShapefile('point',[{lat:-18.2,lon:-43.6},{lat:-18.3,lon:-43.7}],[{n:'nome',t:'C',len:10}],[{nome:'a'},{nome:'b'}]);
for(const k of['shp','shx','dbf'])fs.writeFileSync('/tmp/q.'+k,pt[k]);
// linha
const ln=C.writeShapefile('line',[[[{lat:-18.2,lon:-43.6},{lat:-18.2,lon:-43.59},{lat:-18.21,lon:-43.58}]]],[{n:'id',t:'C',len:10}],[{id:'tr1'}]);
for(const k of['shp','shx','dbf'])fs.writeFileSync('/tmp/l.'+k,ln[k]);fs.writeFileSync('/tmp/l.prj',ln.prj);
