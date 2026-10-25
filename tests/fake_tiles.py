# servidor de tiles FALSOS (só para teste): gera JPEG verde com a grade z/x/y escrita. Porta 8140.
import http.server,io,re
from PIL import Image,ImageDraw
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(s):
        m=re.match(r'/t/(\d+)/(\d+)/(\d+)\.jpg',s.path)
        if not m: s.send_response(404);s.end_headers();return
        z,x,y=map(int,m.groups());im=Image.new('RGB',(256,256),(40+(x*7)%60,90+(y*5)%60,45+(z*9)%40));d=ImageDraw.Draw(im);d.rectangle([0,0,255,255],outline=(255,255,255));d.text((8,8),f'{z}/{x}/{y}',fill=(255,255,255))
        b=io.BytesIO();im.save(b,'JPEG',quality=70);b=b.getvalue()
        s.send_response(200);s.send_header('Content-Type','image/jpeg');s.send_header('Access-Control-Allow-Origin','*');s.send_header('Content-Length',str(len(b)));s.end_headers();s.wfile.write(b)
    def log_message(s,*a):pass
http.server.ThreadingHTTPServer(('127.0.0.1',8140),H).serve_forever()
