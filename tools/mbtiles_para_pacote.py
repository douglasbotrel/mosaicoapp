#!/usr/bin/env python3
"""Converte um .mbtiles (ex.: gerado no QGIS com 'Gerar tiles XYZ (MBTiles)' a partir de ortomosaico/drone/imagem licenciada)
em pacote de mapa do Mosaico. uso: python3 tools/mbtiles_para_pacote.py entrada.mbtiles saida.zip "Fonte" "Atribuição" """
import sqlite3,sys,json,zipfile,datetime
src,out,fonte,atrib=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4] if len(sys.argv)>4 else ''
db=sqlite3.connect(src);rows=db.execute('select zoom_level,tile_column,tile_row,tile_data from tiles').fetchall()
z=zipfile.ZipFile(out,'w',zipfile.ZIP_STORED);zs=[]
for zl,x,y,d in rows:
    y2=(1<<zl)-1-y  # MBTiles usa TMS (y invertido)
    ext='png' if d[:4]==b'\x89PNG' else 'jpg';z.writestr(f'{zl}/{x}/{y2}.{ext}',d);zs.append(zl)
meta={'formato':1,'fonte':fonte,'atribuicao':atrib,'licencaConfirmada':True,'zmin':min(zs),'zmax':max(zs),'parques':['PEBI','PESN'],'geradoEm':datetime.datetime.now().isoformat(),'nTiles':len(rows)}
z.writestr('mapa.json',json.dumps(meta,ensure_ascii=False,indent=1));z.close();print(len(rows),'tiles ->',out)
