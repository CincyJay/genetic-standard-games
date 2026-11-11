"""
Greenhouse interior backdrop for the conveyor game (1080x1920), plus the wooden crate sprite.
Back wall and outside greenery are blurred for depth so the belt and seeds stay in focus.
Writes art/out/greenhouse.svg and games/seed-sort/public/art/crate.svg.
"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(__file__))
from foliage import GREEN, foliage, bush, tree

W, H = 1080, 1920
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', 'out')
PUB = os.path.join(HERE, '..', '..', 'games', 'seed-sort', 'public', 'art')

def backdrop():
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
         '''<defs>
  <linearGradient id="out" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3ef"/><stop offset="1" stop-color="#e9f3df"/></linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8664a"/><stop offset="1" stop-color="#8f4a34"/></linearGradient>
  <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d8" stop-opacity="0.55"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></linearGradient>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8e2d2"/><stop offset="1" stop-color="#d6ccb6"/></linearGradient>
  <radialGradient id="vig" cx="0.5" cy="0.45" r="0.8"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1a10" stop-opacity="0.35"/></radialGradient>
  <filter id="dof" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>''']
    # --- blurred back: outside garden seen through glass
    back = [f'<rect width="{W}" height="1400" fill="url(#out)"/>']
    rr = random.Random(4)
    for i in range(10):
        x = i * 120 + rr.uniform(-30, 30)
        back.append(tree(x, 1080 + rr.uniform(-20, 20), rr.uniform(280, 420), rr.uniform(110, 160), GREEN, 50 + i))
    for i in range(14):
        back.append(bush(i * 85 + rr.uniform(-20, 20), 1150 + rr.uniform(-10, 10), rr.uniform(50, 80), GREEN, 80 + i))
    # glass frame: arched roof + mullions
    frame = '#f7f4ec'
    back.append(f'<path d="M0,0 L1080,0 L1080,240 Q540,40 0,240 Z" fill="#d9eef3" opacity="0.6"/>')
    back.append(f'<path d="M0,240 Q540,40 1080,240" stroke="{frame}" stroke-width="22" fill="none"/>')
    for k in range(1, 8):
        x = k * 1080 / 8
        y_top = 240 - math.sin(k / 8 * math.pi) * 200 + 10
        back.append(f'<line x1="{x:.0f}" y1="{y_top:.0f}" x2="{x:.0f}" y2="1250" stroke="{frame}" stroke-width="14"/>')
    for y in (520, 860):
        back.append(f'<line x1="0" y1="{y}" x2="1080" y2="{y}" stroke="{frame}" stroke-width="12"/>')
    back.append('<rect width="1080" height="1250" fill="#ffffff" opacity="0.12"/>')
    # low wall under the glass
    back.append(f'<rect x="0" y="1180" width="1080" height="200" fill="url(#wall)"/>')
    back.append(f'<rect x="0" y="1170" width="1080" height="22" fill="#cfc4ab"/>')
    o.append(f'<g filter="url(#dof)">{"".join(back)}</g>')
    # --- sun rays
    for x0, w0 in ((620, 140), (800, 110), (930, 90)):
        o.append(f'<path d="M{x0},0 L{x0 + w0},0 L{x0 - 300 + w0},1500 L{x0 - 420},1500 Z" fill="url(#ray)" opacity="0.6"/>')
    # --- floor tiles in perspective
    o.append(f'<path d="M0,1380 L1080,1380 L1080,{H} L0,{H} Z" fill="url(#floor)"/>')
    for k in range(0, 11):
        t = k / 10
        y = 1380 + (H - 1380) * (t ** 1.6)
        o.append(f'<line x1="0" y1="{y:.0f}" x2="1080" y2="{y:.0f}" stroke="#7a3e2b" stroke-width="{2 + t * 4:.1f}" opacity="0.6"/>')
    for k in range(-8, 9):
        o.append(f'<line x1="{540 + k * 70}" y1="1380" x2="{540 + k * 230}" y2="{H}" stroke="#7a3e2b" stroke-width="3" opacity="0.5"/>')
    # --- potted plants at the sides (in focus, frame the play area)
    for (x, s, sd) in ((70, 1.0, 1), (1010, 1.1, 2)):
        o.append(f'<g transform="translate({x},{1540}) scale({s})">'
                 f'<ellipse cx="0" cy="150" rx="90" ry="16" fill="#000" opacity="0.25"/>'
                 f'<path d="M-70,20 L70,20 L52,150 L-52,150 Z" fill="#c4683f"/><path d="M-78,0 L78,0 L78,26 L-78,26 Z" fill="#d98256"/>'
                 f'<path d="M20,26 L52,26 L40,150 L24,150 Z" fill="#e39466" opacity="0.5"/>'
                 f'{foliage(0, -60, 120, 100, GREEN, 300 + sd)}</g>')
    # --- hanging planters top corners
    for (x, sd) in ((150, 7), (930, 9)):
        o.append(f'<line x1="{x}" y1="0" x2="{x}" y2="170" stroke="#5a4634" stroke-width="4"/>'
                 f'<path d="M{x-60},170 Q{x},250 {x+60},170 Z" fill="#c4683f"/>'
                 f'{foliage(x, 165, 80, 40, GREEN, 400 + sd)}')
        rr2 = random.Random(sd)
        for v in range(6):
            vx = x + rr2.uniform(-60, 60)
            length = rr2.uniform(80, 220)
            o.append(f'<path d="M{vx:.0f},190 Q{vx + rr2.uniform(-20,20):.0f},{190 + length/2:.0f} {vx:.0f},{190 + length:.0f}" stroke="#3b7034" stroke-width="3" fill="none"/>')
            for l in range(int(length / 26)):
                ly = 200 + l * 26
                o.append(f'<ellipse cx="{vx + (8 if l % 2 else -8):.0f}" cy="{ly}" rx="11" ry="6" fill="{GREEN[3 + l % 2]}" transform="rotate({30 if l % 2 else -30} {vx:.0f} {ly})"/>')
    o.append(f'<rect width="{W}" height="{H}" fill="url(#vig)"/>')
    o.append('</svg>')
    return '\n'.join(o)

def crate():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 220" width="240" height="220">
<defs>
  <linearGradient id="cw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a8703f"/><stop offset="0.6" stop-color="#c58a50"/><stop offset="1" stop-color="#d9a066"/></linearGradient>
  <linearGradient id="ci" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d2616"/><stop offset="1" stop-color="#6b4528"/></linearGradient>
</defs>
<ellipse cx="120" cy="210" rx="118" ry="12" fill="#000" opacity="0.28"/>
<path d="M14,40 L226,40 L206,70 L34,70 Z" fill="url(#ci)"/>
<path d="M8,36 L232,36 L232,52 L8,52 Z" fill="#8a5a32"/>
<rect x="14" y="52" width="212" height="152" rx="6" fill="url(#cw)"/>
<g stroke="#8a5a32" stroke-width="3" opacity="0.8">
  <line x1="14" y1="102" x2="226" y2="102"/><line x1="14" y1="152" x2="226" y2="152"/>
</g>
<g stroke="#a06a3c" stroke-width="2" opacity="0.5" fill="none">
  <path d="M30,74 Q80,70 120,78 T210,74"/><path d="M26,126 Q90,120 150,128 T220,124"/><path d="M30,176 Q100,172 160,180 T214,176"/>
</g>
<rect x="14" y="52" width="20" height="152" fill="#8a5a32"/><rect x="206" y="52" width="20" height="152" fill="#b07a46"/>
<circle cx="24" cy="64" r="4" fill="#5a3a20"/><circle cx="216" cy="64" r="4" fill="#5a3a20"/><circle cx="24" cy="192" r="4" fill="#5a3a20"/><circle cx="216" cy="192" r="4" fill="#5a3a20"/>
<rect x="64" y="98" width="112" height="76" rx="12" fill="#f4ecd8" stroke="#d9c7a8" stroke-width="4"/>
</svg>'''

os.makedirs(OUT, exist_ok=True); os.makedirs(PUB, exist_ok=True)
open(os.path.join(OUT, 'greenhouse.svg'), 'w').write(backdrop())
open(os.path.join(PUB, 'crate.svg'), 'w').write(crate())
print('ok')
