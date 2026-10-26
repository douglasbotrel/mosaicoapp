import zipfile,json,io,sys,mercantile
import numpy as np
from PIL import Image
from pyproj import Transformer
def tile(z,x,y,zf):
    for ext in ('jpg','png'):
        n=f'{z}/{x}/{y}.{ext}'
        if n in zf.namelist(): return Image.open(io.BytesIO(zf.read(n))).convert('RGBA')
def pix(zf,z,lon,lat):
    t=mercantile.tile(lon,lat,z);b=mercantile.xy_bounds(t);x,y=mercantile.xy(lon,lat)
    im=tile(z,t.x,t.y,zf)
    if im is None: return None
    return im.getpixel((int((x-b.left)/(b.right-b.left)*256),int((b.top-y)/(b.top-b.bottom)*256)))
# PEBI utm
zf=zipfile.ZipFile('tmp/gt_pebi.zip');m=json.loads(zf.read('mapa.json'));print(m['origem'],m['nTiles'])
J=json.load(open('tmp/pebi_utm.json'));tr=Transformer.from_crs(4674,31983,always_xy=True)
G=json.load(open('../tools/parques_full.geojson'));ring=[f for f in G['features'] if f['properties']['codigo']=='PEBI'][0]['geometry']['coordinates'][0]
ok=0
for lon,lat in ring[::max(1,len(ring)//12)]:
    e,n=tr.transform(lon,lat);R=(e-J['E0'])/(J['E1']-J['E0'])*255;Gv=255-(J['N1']-n)/(J['N1']-J['N0'])*255
    p=pix(zf,15,lon,lat)
    assert p and p[3]==255,(lon,lat,p)
    assert abs(p[0]-R)<8 and abs(p[1]-Gv)<8 and abs(p[2]-90)<8,(p,R,Gv)
    ok+=1
print('PEBI UTM pixels ok',ok)
# PESN 16 bits, estica contraste -> R,G ~ lineares 0..255 por percentis; checa monotonia e cobertura
zf=zipfile.ZipFile('tmp/gt_pesn.zip');print(json.loads(zf.read('mapa.json'))['origem'])
J=json.load(open('tmp/pesn_geo16.json'))
ring=[f for f in G['features'] if f['properties']['codigo']=='PESN'][0]['geometry']['coordinates'][0]
pts=[(lon,lat,pix(zf,14,lon,lat)) for lon,lat in ring[::max(1,len(ring)//12)]]
assert all(p and p[3]==255 for _,_,p in pts),pts
# R cresce com a longitude, G cai com a latitude
a=sorted(pts,key=lambda t:t[0]);assert a[-1][2][0]>a[0][2][0]+30,(a[0],a[-1])
b=sorted(pts,key=lambda t:t[1]);assert b[-1][2][1]>b[0][2][1]+30,(b[0],b[-1])
print('PESN 16 bits ok')
