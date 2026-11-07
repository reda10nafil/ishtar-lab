"""Esporta i tracciati vettoriali locali in PNG/ICO; non modifica le foto del brand."""
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parent
SCALE=4
def contour(data):
    tokens=re.findall(r'[A-Z]|[-+]?\d*\.?\d+',data)
    points=[];i=0;cmd=None;x=y=0
    def nums(n):
        nonlocal i
        v=list(map(float,tokens[i:i+n]));i+=n;return v
    while i<len(tokens):
        if tokens[i].isalpha():cmd=tokens[i];i+=1
        if cmd=='Z':points.append(points[0]);break
        if cmd in ('M','L'):
            x,y=nums(2);points.append((x,y));cmd='L'
        elif cmd=='H':x=nums(1)[0];points.append((x,y))
        elif cmd=='V':y=nums(1)[0];points.append((x,y))
        elif cmd=='C':
            a,b,c,d,e,f=nums(6);ox,oy=x,y
            for step in range(1,25):
                t=step/24;u=1-t
                points.append((u**3*ox+3*u*u*t*a+3*u*t*t*c+t**3*e,u**3*oy+3*u*u*t*b+3*u*t*t*d+t**3*f))
            x,y=e,f
        else:raise ValueError(cmd)
    return points

def main():
    im=Image.new('RGBA',(512*SCALE,512*SCALE));draw=ImageDraw.Draw(im)
    draw.rounded_rectangle((4*SCALE,4*SCALE,508*SCALE,508*SCALE),radius=116*SCALE,fill='#d6487a',outline='#f99dbb',width=7*SCALE)
    source=ET.parse(ROOT/'ishtar-mark.svg')
    for element in source.findall('.//{http://www.w3.org/2000/svg}path'):
        coords=[((102+.96*x)*SCALE,(56+.96*y)*SCALE) for x,y in contour(element.attrib['d'])]
        draw.polygon(coords,fill='#fff7f2')
    im=im.resize((512,512),Image.Resampling.LANCZOS)
    im.save(ROOT/'ishtar-icon.png')
    im.save(ROOT/'ishtar-icon.ico',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
if __name__=='__main__':main()
