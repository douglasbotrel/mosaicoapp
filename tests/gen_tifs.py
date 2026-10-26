import json,sys,numpy as np,rasterio
from rasterio.transform import from_origin
from rasterio.crs import CRS
from pyproj import Transformer
G=json.load(open('../tools/parques_full.geojson'))
def bbox(cod):
    xs=[];ys=[]
    for f in G['features']:
        if f['properties']['codigo']==cod:
            for x,y in f['geometry']['coordinates'][0]: xs.append(x);ys.append(y)
    return min(xs),min(ys),max(xs),max(ys)
# 1) PEBI em UTM 23S (EPSG:31983), 10 m, RGB 8 bits: R=leste, G=norte
x0,y0,x1,y1=bbox('PEBI');pad=0.02
t=Transformer.from_crs(4674,31983,always_xy=True)
xs=[];ys=[]
for lo,la in [(x0-pad,y0-pad),(x1+pad,y1+pad),(x0-pad,y1+pad),(x1+pad,y0-pad)]:
    e,n=t.transform(lo,la);xs.append(e);ys.append(n)
E0,E1,N0,N1=min(xs),max(xs),min(ys),max(ys);res=10
w=int((E1-E0)/res);h=int((N1-N0)/res)
e=np.linspace(0,255,w).astype('uint8');n=np.linspace(255,0,h).astype('uint8')
a=np.stack([np.tile(e,(h,1)),np.tile(n[:,None],(1,w)),np.full((h,w),90,'uint8')])
with rasterio.open('tmp/pebi_utm.tif','w',driver='GTiff',width=w,height=h,count=3,dtype='uint8',crs=CRS.from_epsg(31983),transform=from_origin(E0,N1,res,res),tiled=True,compress='deflate') as d: d.write(a)
json.dump({'E0':E0,'E1':E1,'N0':N0,'N1':N1,'w':w,'h':h},open('tmp/pebi_utm.json','w'))
# 2) PESN geográfico 4674, 16 bits, 0.0003 graus (~30 m)
x0,y0,x1,y1=bbox('PESN');r=0.0003
X0,Y1=x0-pad,y1+pad;w=int((x1+pad-X0)/r);h=int((Y1-(y0-pad))/r)
e=np.linspace(0,4000,w).astype('uint16');n=np.linspace(4000,0,h).astype('uint16')
a=np.stack([np.tile(e,(h,1)),np.tile(n[:,None],(1,w)),np.full((h,w),1000,'uint16')])
with rasterio.open('tmp/pesn_geo16.tif','w',driver='GTiff',width=w,height=h,count=3,dtype='uint16',crs=CRS.from_epsg(4674),transform=from_origin(X0,Y1,r,r),tiled=True,compress='deflate') as d: d.write(a)
json.dump({'X0':X0,'Y1':Y1,'r':r,'w':w,'h':h},open('tmp/pesn_geo16.json','w'))
print('ok',w,h)
