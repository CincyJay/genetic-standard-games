"""Original Aurelia slot display artwork. Generates PNGs for Blender UV-mapped screens.
Run: python art/casino/3d/blender/aurelia_screen_art.py [output_dir]
Dependency: Pillow. No network, game state, or external assets.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import math,sys,random
OUT=Path(sys.argv[1] if len(sys.argv)>1 else Path(__file__).parent/'generated')
OUT.mkdir(parents=True,exist_ok=True)
PALETTES={
 'royal':dict(bg=(28,11,54),rim=(246,191,88),light=(255,233,164),name='ROYAL FORTUNE',motif='♠',symbols=['7','♛','♠','♦','★']),
 'dragon':dict(bg=(67,10,23),rim=(255,125,58),light=(255,211,114),name='DRAGON FIRE',motif='✦',symbols=['7','✦','♠','★','♦']),
 'ocean':dict(bg=(5,39,66),rim=(76,223,227),light=(179,247,246),name='DEEP TREASURE',motif='✧',symbols=['7','✧','★','♦','♠'])
}
def font(size,bold=False):
 candidates=['/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',
 '/usr/share/fonts/truetype/liberation2/LiberationSans'+('-Bold' if bold else '-Regular')+'.ttf']
 for p in candidates:
  try:return ImageFont.truetype(p,size)
  except OSError:pass
 return ImageFont.load_default()
def textcenter(d,xy,s,fill,size,bold=False,stroke=0):
 d.text(xy,s,font=font(size,bold),anchor='mm',fill=fill,stroke_width=stroke,stroke_fill=(25,12,18))
def base(w,h,p):
 im=Image.new('RGB',(w,h));px=im.load()
 for y in range(h):
  for x in range(w):
   glow=max(0,1-math.hypot((x-w*.5)/(w*.77),(y-h*.36)/(h*.83)))
   vignette=max(0,1-0.32*((x-w/2)/(w/2))**2-0.27*((y-h/2)/(h/2))**2)
   px[x,y]=tuple(int(min(255,(v*(.52+glow*.55)+12*glow)*vignette)) for v in p['bg'])
 return im
def frame(d,box,p,r=20,width=8):
 d.rounded_rectangle(box,radius=r,outline=p['rim'],width=width)
 d.rounded_rectangle((box[0]+11,box[1]+11,box[2]-11,box[3]-11),radius=max(2,r-9),outline=tuple(int(c*.52) for c in p['rim']),width=3)
def topper(p):
 w,h=1024,640;im=base(w,h,p);d=ImageDraw.Draw(im)
 frame(d,(18,18,w-19,h-19),p,36,10)
 for i in range(24):
  x=64+(i*173)%900;y=75+(i*107)%485
  d.ellipse((x-2,y-2,x+2,y+2),fill=p['light'])
 textcenter(d,(512,110),'VELVET ACE',p['rim'],59,True)
 textcenter(d,(512,236),p['name'],p['light'],75,True)
 d.line((160,310,864,310),fill=p['rim'],width=4)
 textcenter(d,(512,379),'GRAND JACKPOT',p['rim'],52,True)
 textcenter(d,(512,485),'$125,640.32',(255,246,208),84,True)
 textcenter(d,(512,571),'MAJOR  $8,500     MINOR  $500',p['light'],27,True)
 return im
def reels(p):
 w,h=1024,1100;im=base(w,h,p);d=ImageDraw.Draw(im)
 frame(d,(16,16,w-17,h-17),p,28,9)
 textcenter(d,(512,95),p['name'],p['light'],63,True)
 rng=random.Random(20261117)
 for r in range(3):
  for c in range(5):
   x=55+c*186;y=165+r*240
   d.rounded_rectangle((x,y,x+174,y+225),radius=17,fill=(12,17,37),outline=p['rim'],width=5)
   d.rounded_rectangle((x+9,y+9,x+165,y+216),radius=11,outline=(92,91,119),width=2)
   sym=p['symbols'][(c+r*3)%5]
   textcenter(d,(x+87,y+103),sym,p['light'],95,True,1)
   d.ellipse((x+62,y+167,x+112,y+181),fill=tuple(int(k*.72) for k in p['rim']))
 d.rounded_rectangle((45,915,979,1050),radius=19,fill=(8,12,29),outline=p['rim'],width=4)
 textcenter(d,(512,957),'CREDITS 12,500     BET 50     WIN 0',p['light'],33,True)
 textcenter(d,(512,1013),'GOOD LUCK  •  PLAY RESPONSIBLY',p['rim'],24,True)
 return im
for name,p in PALETTES.items():
 for label,fn in [('upper',topper),('main',reels)]:
  path=OUT/f'aurelia_{name}_{label}.png';fn(p).save(path,optimize=True)
  print(path)
