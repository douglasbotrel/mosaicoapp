const S=require('../app/js/schema.js'),V=require('../app/js/validar.js'),assert=require('assert');let n=0;
function t(nm,f){try{f();n++;console.log('ok  ',nm)}catch(e){console.log('FAIL',nm,e.message);process.exitCode=1}}
const keys=new Set(),all=[];
S.BLOCOS.forEach(b=>b.campos.forEach(c=>{all.push([b,c]);const k=b.id+'.'+c.id;assert(!keys.has(k),'dup '+k);keys.add(k)}));
t('chaves únicas',()=>{assert(all.length>70)});
t('ids de bloco únicos e em ordem',()=>{assert.deepEqual(S.BLOCOS.map(b=>b.id),['b0','b1','b2','b3','b4','b5','b6','b7','b8','b9','b10'])});
t('opções sem valor duplicado e com rótulo',()=>{all.forEach(([b,c])=>{if(!c.opts)return;const v=c.opts.map(o=>o[0]);assert.equal(new Set(v).size,v.length,b.id+c.id);c.opts.forEach(o=>assert(o[0]&&o[1],b.id+c.id))})});
t('show e fromTrack apontam para campos existentes',()=>{all.forEach(([b,c])=>{if(c.show)assert(keys.has(c.show.f),c.show.f);if(c.fromTrack)assert(keys.has(c.fromTrack),c.fromTrack)})});
t('tipos conhecidos',()=>{const ok=['text','textarea','number','select','multi','bool3','date','time','gps','track','repeat'];all.forEach(([b,c])=>assert(ok.includes(c.t),c.t))});
t('limites numéricos coerentes',()=>{all.forEach(([b,c])=>{if(c.min!=null&&c.max!=null)assert(c.min<c.max,b.id+c.id)})});
t('select/multi com opts; show.in/eq dentro das opts do campo referido',()=>{all.forEach(([b,c])=>{if(['select','multi'].includes(c.t))assert(c.opts&&c.opts.length>1);if(c.show){const [bb,ref]=all.find(([x,y])=>x.id+'.'+y.id===c.show.f);const vs=ref.opts.map(o=>o[0]);(c.show.in||[c.show.eq]).forEach(v=>assert(vs.includes(v),c.show.f+' '+v))}})});
t('PEBI não tem bloco de comunidade',()=>{const bs=V.blocosAtivos({parque:'PEBI'},{});assert(!bs.find(b=>b.id==='b7'));assert(V.blocosAtivos({parque:'PESN'},{}).find(b=>b.id==='b7'))});
t('visita não realizada só exige b0',()=>{const bs=V.blocosAtivos({parque:'PESN'},{'b0.situacao_visita':'recusa'});assert.deepEqual(bs.map(b=>b.id),['b0']);const r=V.validar({dados:{'b0.situacao_visita':'recusa','b0.equipe':'A','b0.data_visita':'2026-01-01','b0.responsavel_campo':'x'},nd:{}},{parque:'PESN'},[]);assert.equal(r.erros.length,0,JSON.stringify(r.erros))});
t('consentimento negado libera sem b6',()=>{const d={'b0.situacao_visita':'completa','b0.equipe':'A','b0.data_visita':'2026-01-01','b0.responsavel_campo':'x','b2.area_estimada_ha':3,'b3.consentimento':'nao'};assert.equal(V.validar({dados:d,nd:{}},{parque:'PEBI'},[{cat:'limite'}]).erros.length,0)});
t('data futura é erro',()=>{const r=V.validar({dados:{'b0.situacao_visita':'completa','b0.data_visita':'2099-01-01'},nd:{}},{parque:'PEBI'},[]);assert(r.erros.some(e=>/futuro/.test(e.msg)))});
t('limites min/max numéricos',()=>{const r=V.validar({dados:{'b0.situacao_visita':'completa','b2.area_estimada_ha':-3},nd:{}},{parque:'PEBI'},[]);assert(r.erros.some(e=>/mínimo/.test(e.msg)))});
console.log(n,'ok; campos',all.length);
