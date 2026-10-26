import nbformat as nbf
nb=nbf.v4.new_notebook();C=[]
def md(s):C.append(nbf.v4.new_markdown_cell(s))
def code(s):C.append(nbf.v4.new_code_cell(s))
md("""# Mosaico — recorte de satélite dos parques (PEBI e PESN) em GeoTIFF
Gera **um GeoTIFF por parque** (RGB 8 bits, SIRGAS 2000 / UTM 23S, EPSG:31983) para importar na **central do Mosaico** (aba *Mapa offline → Importar imagem GeoTIFF*).

**Caminho A — CBERS-4A WPM (melhor resolução gratuita, 2 m após fusão pan+cor).** Dados abertos no registro da AWS (`brazil-eosats`, STAC `https://stac.scitekno.com.br/v100`). Não precisa de conta.
**Caminho B — Sentinel-2 (10 m) pelo Google Earth Engine.** Precisa de projeto Earth Engine.

⚠️ **Licenças — confirmar antes de distribuir:** o registro da AWS indica CBERS como CC BY-SA 3.0; o INPE indica CC BY 4.0 para o produto WPM fusionado. Earth Engine gratuito é só para uso não comercial verificado. Mantenha a atribuição ("Imagem: CBERS-4A/WPM, INPE" ou "Contém dados Copernicus Sentinel modificados").

**Antes de rodar:** envie `parques_full.geojson` (pasta `tools/` do projeto) para o Colab (ícone de pasta à esquerda → upload).
> Este notebook não foi executado por mim com os servidores reais (o ambiente onde o escrevi não acessa a AWS). A célula 3 lista as coleções e os nomes de bandas reais para você conferir antes da geração.""")
code("""!pip -q install pystac-client rasterio pyproj shapely""")
code("""# 1) Parâmetros
import json, numpy as np, rasterio
from shapely.geometry import shape
from shapely.ops import transform as sh_transform
from pyproj import Transformer
GEOJSON = 'parques_full.geojson'
MARGEM_M = 300          # margem ao redor do polígono
RES = 2.0               # metros/pixel da saída (WPM fusionado = 2 m; use 10 para Sentinel-2)
CRS_SAIDA = 'EPSG:31983'  # SIRGAS 2000 / UTM 23S
G = json.load(open(GEOJSON))
to_utm = Transformer.from_crs('EPSG:4674', CRS_SAIDA, always_xy=True).transform
to_ll  = Transformer.from_crs(CRS_SAIDA, 'EPSG:4674', always_xy=True).transform
PARQUES = {}
for f in G['features']:
    g = sh_transform(to_utm, shape(f['geometry'])).buffer(MARGEM_M)
    x0,y0,x1,y1 = g.bounds
    x0,y0 = np.floor(x0/RES)*RES, np.floor(y0/RES)*RES; x1,y1 = np.ceil(x1/RES)*RES, np.ceil(y1/RES)*RES
    PARQUES[f['properties']['codigo']] = (x0,y0,x1,y1)
    print(f['properties']['codigo'], 'UTM:', (x0,y0,x1,y1), 'pixels:', int((x1-x0)/RES), 'x', int((y1-y0)/RES))""")
md("## Caminho A — CBERS-4A WPM (STAC aberto)")
code("""# 2) Diagnóstico rápido do servidor STAC (sem percorrer o catálogo)
import requests, json
RAIZ = 'https://stac.scitekno.com.br/v100'
r = requests.get(RAIZ, timeout=30); print('GET raiz ->', r.status_code)
try:
    j = r.json(); print('tipo:', j.get('type'), '| id:', j.get('id'), '| conformsTo:', len(j.get('conformsTo', [])))
    for l in j.get('links', [])[:15]: print('  link', l.get('rel'), l.get('href'))
except Exception as e: print('resposta não-JSON:', r.text[:300])""")
code("""# 3) Busca direta em /search por área e data (sem informar coleção) — mostra quais coleções respondem
PARQUE = 'PEBI'                 # PEBI ou PESN
DATAS  = '2022-06-01T00:00:00Z/2026-10-01T00:00:00Z'
x0,y0,x1,y1 = PARQUES[PARQUE]
lo0,la0 = to_ll(x0,y0); lo1,la1 = to_ll(x1,y1)
bbox = [min(lo0,lo1),min(la0,la1),max(lo0,lo1),max(la0,la1)]
corpo = {'bbox': bbox, 'datetime': DATAS, 'limit': 100}
r = requests.post(RAIZ+'/search', json=corpo, timeout=60); print('POST /search ->', r.status_code)
if r.status_code != 200: print(r.text[:500])
feats = r.json().get('features', []) if r.status_code == 200 else []
from collections import Counter
print('coleções encontradas:', Counter(f['collection'] for f in feats))""")
code("""# 3b) Filtrar WPM e listar cenas (rode depois de ver a lista acima; ajuste COLECAO)
COLECAO = next((c for c in {f['collection'] for f in feats} if 'WPM' in c.upper() and '4A' in c.upper()), None)
print('coleção escolhida:', COLECAO)
import types, datetime as dt
def item(f):
    return types.SimpleNamespace(id=f['id'], properties=f['properties'], datetime=dt.datetime.fromisoformat(f['properties']['datetime'].replace('Z','+00:00')),
                                 assets={k: types.SimpleNamespace(href=v['href']) for k,v in f['assets'].items()})
itens = sorted([item(f) for f in feats if f['collection']==COLECAO], key=lambda i: i.datetime)
for k,i in enumerate(itens): print(k, i.id, i.datetime.date(), 'nuvem:', i.properties.get('cloud_cover', '?'))
if itens: print('Assets do 1º item:', {a: itens[0].assets[a].href for a in itens[0].assets})""")
md("""Escolha as cenas **sem nuvem** (use o quicklook, `thumbnail`, para olhar) e informe os índices abaixo. Se o parque estiver em mais de uma cena, liste todas: a ordem define a prioridade no mosaico.
Informe também os nomes dos assets (impressos acima): normalmente a pancromática (`pan`/`B0`) e as cores (`red`, `green`, `blue` ou `B3`,`B2`,`B1`).""")
code("""# 4) Escolha das cenas e bandas
ESCOLHIDAS = [0]                       # <-- índices das cenas
BANDA_PAN  = 'pan'                     # <-- confira nos assets impressos
BANDAS_RGB = ['red','green','blue']    # <-- confira
for k in ESCOLHIDAS:
    for b in [BANDA_PAN]+BANDAS_RGB: assert b in itens[k].assets, (k, b, list(itens[k].assets))
print('ok')""")
code("""# 5) Gerar o GeoTIFF (processa em faixas para não estourar a memória do Colab)
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_origin
import os
os.environ['AWS_NO_SIGN_REQUEST'] = 'YES'
def le(href, tr, w, h):
    dst = np.zeros((h,w), 'float32')
    with rasterio.open(href) as s:
        reproject(rasterio.band(s,1), dst, dst_transform=tr, dst_crs=CRS_SAIDA, resampling=Resampling.bilinear, src_nodata=0, dst_nodata=0)
    return dst
def faixa(tr, w, h):
    pan = np.zeros((h,w),'float32'); rgb = np.zeros((3,h,w),'float32')
    for k in ESCOLHIDAS:
        it = itens[k]; p = le(it.assets[BANDA_PAN].href, tr, w, h); m = pan==0; pan[m] = p[m]
        for j,b in enumerate(BANDAS_RGB):
            c = le(it.assets[b].href, tr, w, h); m = rgb[j]==0; rgb[j][m] = c[m]
    # fusão (Brovey): cor * pan / média das cores
    med = rgb.mean(axis=0); med[med==0] = 1
    return rgb * (pan/med)[None], (pan>0)
x0,y0,x1,y1 = PARQUES[PARQUE]; W = int((x1-x0)/RES); H = int((y1-y0)/RES); F = 1024
# limites de contraste (percentis 2-98) numa visão grosseira de 20 m
wg,hg = max(1,int((x1-x0)/20)), max(1,int((y1-y0)/20)); trg = from_origin(x0,y1,20,20)
amostra,val = faixa(trg,wg,hg); lim = [np.percentile(amostra[j][val],[2,98]) for j in range(3)]; lim = [(a, max(b, a+1)) for a,b in lim]; print('limites', lim)
perfil = dict(driver='GTiff', width=W, height=H, count=3, dtype='uint8', crs=CRS_SAIDA, transform=from_origin(x0,y1,RES,RES), tiled=True, blockxsize=512, blockysize=512, compress='deflate', predictor=2, BIGTIFF='IF_SAFER')
SAIDA = f'recorte_{PARQUE}_{int(RES)}m_utm23s.tif'
with rasterio.open(SAIDA,'w',**perfil) as d:
    for r0 in range(0,H,F):
        h = min(F,H-r0); tr = from_origin(x0, y1-r0*RES, RES, RES)
        a,v = faixa(tr,W,h); out = np.zeros((3,h,W),'uint8')
        for j in range(3): out[j] = np.clip((a[j]-lim[j][0])/(lim[j][1]-lim[j][0])*255,0,255)
        out[:,~v] = 0
        d.write(out, window=rasterio.windows.Window(0,r0,W,h)); print(f'{r0+h}/{H}', end=' ')
print('\\nGerado:', SAIDA, round(os.path.getsize(SAIDA)/1e6,1),'MB')""")
code("""# 6) Baixar (repita as células 3-6 trocando PARQUE para o outro parque)
from google.colab import files
files.download(SAIDA)""")
md("""## Caminho B — Sentinel-2 (10 m) pelo Google Earth Engine
Coleção oficial do catálogo: `COPERNICUS/S2_SR_HARMONIZED` (bandas B4, B3, B2; fator 0,0001). Precisa de projeto Earth Engine habilitado; para uso gratuito o projeto precisa ser não comercial — confirme com Funbio/IEF antes.""")
code("""import ee
ee.Authenticate(); ee.Initialize(project='SEU-PROJETO-EE')   # <-- troque""")
code("""PARQUE_B = 'PEBI'
f = [x for x in G['features'] if x['properties']['codigo']==PARQUE_B][0]
reg = ee.Geometry(f['geometry']).buffer(MARGEM_M)
col = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(reg).filterDate('2025-05-01','2025-10-01')
       .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',20)))
print('cenas:', col.size().getInfo())
img = col.median().select(['B4','B3','B2']).multiply(0.0001)
vis = img.visualize(min=0.02, max=0.22).clip(reg)       # 8 bits RGB, estica fixa
task = ee.batch.Export.image.toDrive(image=vis, description=f'S2_{PARQUE_B}', folder='mosaico', fileNamePrefix=f'S2_{PARQUE_B}_10m',
        region=reg, scale=10, crs='EPSG:31983', maxPixels=1e9, fileFormat='GeoTIFF')
task.start(); print('Exportação iniciada: acompanhe em https://code.earthengine.google.com/tasks')""")
md("""## Depois
1. Central → *Mapa offline* → *Importar imagem GeoTIFF* → escolha o `.tif` de um parque → converter → gere o `.zip`. Repita para o outro parque.
2. Celular: *Mapa → Importar mapa* com cada `.zip` (os tiles se somam).
3. Preencha **fonte** e **atribuição** na central conforme a licença confirmada.""")
nb['cells']=C
nb.metadata['kernelspec']={'name':'python3','display_name':'Python 3'}
nbf.write(nb,'colab_recorte_satelite.ipynb')
