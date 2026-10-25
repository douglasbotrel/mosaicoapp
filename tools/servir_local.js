// Servidor local para uso/teste no computador: node tools/servir_local.js  → http://localhost:8080/app/  e /central/central.html
const http=require('http'),fs=require('fs'),path=require('path'),root=path.join(__dirname,'..');
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/app/';if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);
 if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('nao encontrado')}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r)}).listen(8080,'127.0.0.1',()=>console.log('Mosaico em http://localhost:8080/app/  e  http://localhost:8080/central/central.html'));
