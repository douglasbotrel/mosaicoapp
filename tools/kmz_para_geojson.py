#!/usr/bin/env python3
"""Converte o KMZ dos parques em GeoJSON (SIRGAS 2000/WGS 84, graus).
uso: python3 tools/kmz_para_geojson.py arquivo.kmz
Gera: tools/parques_full.geojson (geometria completa) e app/data/parques.js (simplificada, para exibir no mapa).
Identificação por localização: polígono ao sul/oeste de lon -43,3 = PE do Biribiri (PEBI); a leste = PE da Serra Negra (PESN)."""
import sys,re,json,zipfile,math
kmz=sys.argv[1];z=zipfile.ZipFile(kmz);kml=[n for n in z.namelist() if n.endswith('.kml')][0];s=z.read(kml).decode('utf-8')
def dp(pts,tol):
    if len(pts)<3:return pts
    lat0=sum(p[1] for p in pts)/len(pts);k=math.cos(math.radians(lat0))
    xy=[(p[0]*111320*k,p[1]*110574) for p in pts];keep=[False]*len(pts);keep[0]=keep[-1]=True
    st=[(0,len(pts)-1)]
    while st:
        a,b=st.pop();mx=0;mi=-1;ax,ay=xy[a];bx,by=xy[b];dx,dy=bx-ax,by-ay;L=dx*dx+dy*dy
        for i in range(a+1,b):
            t=max(0,min(1,((xy[i][0]-ax)*dx+(xy[i][1]-ay)*dy)/L)) if L else 0
            d=math.hypot(xy[i][0]-(ax+t*dx),xy[i][1]-(ay+t*dy))
            if d>mx:mx,mi=d,i
        if mx>tol:keep[mi]=True;st+=[(a,mi),(mi,b)]
    return [p for p,k in zip(pts,keep) if k]
def area_ha(pts):
    lat0=sum(p[1] for p in pts)/len(pts);k=math.cos(math.radians(lat0))
    xy=[(p[0]*111320*k,p[1]*110574) for p in pts];a=0
    for i in range(len(xy)):
        j=(i+1)%len(xy);a+=xy[i][0]*xy[j][1]-xy[j][0]*xy[i][1]
    return abs(a)/2/10000
feats=[];simp=[]
for m in re.finditer(r'<coordinates>(.*?)</coordinates>',s,re.S):
    pts=[tuple(map(float,p.split(',')[:2])) for p in m.group(1).split()]
    cx=sum(p[0] for p in pts)/len(pts);cod='PEBI' if cx<-43.3 else 'PESN';nome='PE do Biribiri' if cod=='PEBI' else 'PE da Serra Negra'
    props={'codigo':cod,'nome':nome,'area_ha':round(area_ha(pts),1),'fonte':'KMZ fornecido (IDE-Sisema, unidades de conservação estaduais)'}
    feats.append({'type':'Feature','properties':props,'geometry':{'type':'Polygon','coordinates':[[list(p) for p in pts]]}})
    sp=dp(pts,3.0);simp.append({'type':'Feature','properties':props,'geometry':{'type':'Polygon','coordinates':[[[round(p[0],6),round(p[1],6)] for p in sp]]}})
    print(cod,len(pts),'->',len(sp),'pontos; área ~',props['area_ha'],'ha')
json.dump({'type':'FeatureCollection','features':feats},open('tools/parques_full.geojson','w'))
open('app/data/parques.js','w').write('/* Limites dos parques (gerado por tools/kmz_para_geojson.py) */\nwindow.MOSAICO_PARQUES='+json.dumps({'type':'FeatureCollection','features':simp},separators=(',',':'))+';\n')
