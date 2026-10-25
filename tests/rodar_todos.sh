#!/bin/sh
# Executa toda a bateria de testes. Requer: node, playwright (npm i playwright), python3 com Pillow/pyshp/openpyxl.
cd "$(dirname "$0")" && mkdir -p tmp/carga
set -e
../tools/sync.sh
python3 -c "from PIL import Image,ImageDraw;im=Image.new('RGB',(3000,2000),(90,140,80));ImageDraw.Draw(im).rectangle([500,500,2500,1500],fill=(200,180,120));im.save('tmp/foto1.jpg',quality=85)"
python3 fake_tiles.py & TP=$!
trap "kill $TP 2>/dev/null" EXIT
sleep 1
node unit_core.js tmp/foto1.jpg
node unit_schema.js
node ../tools/baixar_mapa.js --url "http://127.0.0.1:8140/t/{z}/{x}/{y}.jpg" --atrib TESTE --fonte "Servidor de teste" --zmin 12 --zmax 15 --saida tmp/mapa_teste.zip --confirmo-licenca
node e2e_fluxo.js
node e2e_pacote.js
node e2e_dia.js
node e2e_mapa.js
node gen_pacotes.js 12 tmp
node e2e_central.js
node e2e_central2.js
python3 -c "
import random;random.seed(7);L=['id;parque;nome;car;area_car_ha;municipio']
for i in range(1,601):
    p='PEBI' if i<=200 else 'PESN';h=''.join(random.choice('0123456789ABCDEF') for _ in range(32))
    L.append(f'{p}-{i:04d};{p};Imóvel teste {i};MG-{3121605 if p==\"PEBI\" else 3132503}-{h};{random.uniform(1,200):.2f}'.replace('.',',')+';Teste')
open('tmp/imoveis_600.csv','w',encoding='utf-8').write(chr(10).join(L))"
node e2e_distribuicao.js
node e2e_audit.js
echo TODOS OS TESTES PASSARAM
