"""
Hollow Brook: Entrance Path scene, as layered SVG.
Writes art/out/entrance-overgrown.svg and art/out/entrance-restored.svg.
Every element is a separate group so the game can swap broken/fixed states per task.
"""
import math, random, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from foliage import GREEN, DRY, HEDGE, tree, bush, foliage, hedge_top, hedge_face_texture, grass_tufts, flower_planting

W, H = 1080, 1920
OUT = os.path.join(os.path.dirname(__file__), '..', 'out')
rnd = random.Random(7)

def path_d(points, close=True):
    d = f"M{points[0][0]:.1f},{points[0][1]:.1f} " + " ".join(f"L{x:.1f},{y:.1f}" for x, y in points[1:])
    return d + (" Z" if close else "")

def blob(cx, cy, r, n=9, jitter=0.18, squash=1.0, seed=None):
    rr = random.Random(seed)
    pts = []
    for i in range(n):
        a = i / n * math.tau
        k = 1 + rr.uniform(-jitter, jitter)
        pts.append((cx + math.cos(a) * r * k, cy + math.sin(a) * r * k * squash))
    # smooth closed path via quadratic midpoints
    d = ""
    for i in range(n):
        p0, p1 = pts[i], pts[(i + 1) % n]
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        d += (f"M{mx:.1f},{my:.1f} " if i == 0 else "") + f"Q{p1[0]:.1f},{p1[1]:.1f} {((p1[0]+pts[(i+2)%n][0])/2):.1f},{((p1[1]+pts[(i+2)%n][1])/2):.1f} "
    return d + "Z"

DEFS = """
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#9fd3ea"/><stop offset="0.65" stop-color="#d9eef0"/><stop offset="1" stop-color="#fbe9c6"/>
  </linearGradient>
  <linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8fc46a"/><stop offset="0.5" stop-color="#6fae52"/><stop offset="1" stop-color="#4f8f3f"/>
  </linearGradient>
  <linearGradient id="lawnDry" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#a9b26a"/><stop offset="0.5" stop-color="#8f9a52"/><stop offset="1" stop-color="#6e7a3f"/>
  </linearGradient>
  <linearGradient id="pathG" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#d9c9a8"/><stop offset="1" stop-color="#c2ab84"/>
  </linearGradient>
  <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc7b4"/><stop offset="1" stop-color="#86b49f"/></linearGradient>
  <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#78ad83"/><stop offset="1" stop-color="#5f9a6c"/></linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#e8f6f7" stop-opacity="0.95"/><stop offset="1" stop-color="#a8d4dc" stop-opacity="0.9"/>
  </linearGradient>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7cc4d6"/><stop offset="1" stop-color="#4a98b0"/>
  </linearGradient>
  <linearGradient id="waterMurky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7d8f5a"/><stop offset="1" stop-color="#5d6e43"/>
  </linearGradient>
  <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#fff6d8" stop-opacity="0.95"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
    <stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#1b2a1a" stop-opacity="0.35"/>
  </radialGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="10"/></filter>
  <filter id="soft4" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
</defs>
"""

def cloud(x, y, s):
    return f'<g opacity="0.9" transform="translate({x},{y}) scale({s})"><ellipse cx="0" cy="0" rx="90" ry="34" fill="#fff"/><ellipse cx="-50" cy="8" rx="60" ry="26" fill="#fff"/><ellipse cx="55" cy="10" rx="70" ry="24" fill="#fff"/><ellipse cx="10" cy="-20" rx="55" ry="32" fill="#fff"/><ellipse cx="0" cy="22" rx="120" ry="12" fill="#e3eef2"/></g>'

def tree_canopy(cx, cy, r, base, light, dark, seed):
    s = f'<path d="{blob(cx, cy + r*0.15, r*1.02, 11, 0.15, 0.9, seed)}" fill="{dark}"/>'
    s += f'<path d="{blob(cx, cy, r, 11, 0.16, 0.88, seed+1)}" fill="{base}"/>'
    s += f'<path d="{blob(cx - r*0.25, cy - r*0.28, r*0.55, 9, 0.2, 0.85, seed+2)}" fill="{light}" opacity="0.9"/>'
    for k in range(6):
        a = k / 6 * math.tau + seed
        s += f'<circle cx="{cx + math.cos(a)*r*0.55:.1f}" cy="{cy + math.sin(a)*r*0.45:.1f}" r="{r*0.12:.1f}" fill="{light}" opacity="0.35"/>'
    return s

def shrub(cx, cy, r, base='#4f9a4a', light='#6fbf5c', dark='#3a7a3a', seed=1):
    s = f'<ellipse cx="{cx}" cy="{cy + r*0.75}" rx="{r*1.05}" ry="{r*0.22}" fill="#2f5a2a" opacity="0.35"/>'
    s += f'<path d="{blob(cx, cy, r, 10, 0.18, 0.78, seed)}" fill="{dark}"/>'
    s += f'<path d="{blob(cx, cy - r*0.08, r*0.92, 10, 0.18, 0.74, seed+3)}" fill="{base}"/>'
    s += f'<path d="{blob(cx - r*0.25, cy - r*0.32, r*0.45, 8, 0.2, 0.8, seed+5)}" fill="{light}"/>'
    return s

def flower(cx, cy, r, color, center='#fff1a8'):
    s = ''
    for i in range(5):
        a = i / 5 * math.tau - math.pi / 2
        s += f'<circle cx="{cx + math.cos(a)*r*0.62:.1f}" cy="{cy + math.sin(a)*r*0.62:.1f}" r="{r*0.5:.1f}" fill="{color}"/>'
    s += f'<circle cx="{cx}" cy="{cy}" r="{r*0.3:.1f}" fill="{center}"/>'
    return s

def flowerbed(cx, cy, w, h, colors, seed, planted=True):
    rr = random.Random(seed)
    s = f'<ellipse cx="{cx}" cy="{cy + h*0.12}" rx="{w/2 + 10}" ry="{h/2 + 8}" fill="#2f5a2a" opacity="0.25" filter="url(#soft4)"/>'
    s += f'<ellipse cx="{cx}" cy="{cy}" rx="{w/2}" ry="{h/2}" fill="#7a5a3c"/>'  # soil
    s += f'<ellipse cx="{cx}" cy="{cy - 4}" rx="{w/2 - 8}" ry="{h/2 - 8}" fill="#8b6845"/>'
    # stone edging
    for i in range(22):
        a = i / 22 * math.tau
        s += f'<ellipse cx="{cx + math.cos(a)*w/2:.1f}" cy="{cy + math.sin(a)*h/2:.1f}" rx="{w*0.05:.1f}" ry="{h*0.07:.1f}" fill="#d8cdb8" stroke="#b7a88e" stroke-width="2"/>'
    if planted == 'flowers':
        s += flower_planting(cx, cy, w, h, colors, seed)
    elif planted:
        items = []
        for i in range(int(w * h / 1800)):
            a = rr.random() * math.tau
            d = math.sqrt(rr.random()) * 0.82
            x, y = cx + math.cos(a) * w / 2 * d, cy + math.sin(a) * h / 2 * d
            items.append((y, x))
        items.sort()
        for y, x in items:
            s += f'<ellipse cx="{x:.1f}" cy="{y + 8:.1f}" rx="16" ry="10" fill="#3d7a37"/>'
            s += f'<ellipse cx="{x - 9:.1f}" cy="{y + 2:.1f}" rx="10" ry="6" fill="#5a9e4a" transform="rotate(-25 {x-9:.1f} {y+2:.1f})"/>'
            s += flower(x, y - 6, rr.uniform(11, 15), rr.choice(colors))
    return s

def weeds(cx, cy, s, seed):
    rr = random.Random(seed)
    out = f'<g transform="translate({cx},{cy}) scale({s})">'
    out += '<ellipse cx="0" cy="6" rx="60" ry="12" fill="#3b4a22" opacity="0.35"/>'
    for i in range(14):
        x = rr.uniform(-48, 48)
        hgt = rr.uniform(40, 95)
        lean = rr.uniform(-28, 28)
        col = rr.choice(['#6f8a3a', '#7f9a44', '#5d7a30', '#8fa252'])
        out += f'<path d="M{x-6:.1f},4 Q{x+lean*0.4:.1f},{-hgt*0.6:.1f} {x+lean:.1f},{-hgt:.1f} Q{x+lean*0.3+4:.1f},{-hgt*0.5:.1f} {x+6:.1f},4 Z" fill="{col}"/>'
    for i in range(3):
        x = rr.uniform(-30, 30)
        out += f'<circle cx="{x:.1f}" cy="{rr.uniform(-70,-40):.1f}" r="5" fill="#e8e3b0"/>'
    out += '</g>'
    return out

def lamp(x, y, lit=True, broken=False):
    s = f'<ellipse cx="{x}" cy="{y}" rx="34" ry="9" fill="#24361f" opacity="0.35"/>'
    tilt = ' transform="rotate(-9 %d %d)"' % (x, y) if broken else ''
    s += f'<g{tilt}>'
    s += f'<rect x="{x-9}" y="{y-260}" width="18" height="260" rx="6" fill="#2c3a3f"/>'
    s += f'<rect x="{x-20}" y="{y-24}" width="40" height="24" rx="6" fill="#36474d"/>'
    s += f'<path d="M{x-30},{y-262} L{x+30},{y-262} L{x+20},{y-320} L{x-20},{y-320} Z" fill="{"#ffe9a6" if lit else "#9aa8a0"}" stroke="#2c3a3f" stroke-width="7"/>'
    s += f'<path d="M{x-34},{y-320} L{x+34},{y-320} L{x},{y-350} Z" fill="#2c3a3f"/>'
    if lit:
        s += f'<circle cx="{x}" cy="{y-290}" r="70" fill="url(#sun)" opacity="0.7"/>'
    s += '</g>'
    return s

def bench(x, y, broken=False):
    s = f'<ellipse cx="{x}" cy="{y+8}" rx="150" ry="20" fill="#24361f" opacity="0.3" filter="url(#soft4)"/>'
    leg = '#3a2f2a'
    s += f'<rect x="{x-120}" y="{y-70}" width="14" height="78" rx="4" fill="{leg}"/><rect x="{x+106}" y="{y-70}" width="14" height="78" rx="4" fill="{leg}"/>'
    wood, woodDark = ('#8a6a4c', '#6e523a') if broken else ('#c0814a', '#9a6436')
    # seat
    s += f'<rect x="{x-140}" y="{y-78}" width="280" height="22" rx="6" fill="{woodDark}"/>'
    s += f'<rect x="{x-140}" y="{y-84}" width="280" height="18" rx="6" fill="{wood}"/>'
    # back slats
    for i, yy in enumerate([y-160, y-130]):
        if broken and i == 0:
            s += f'<rect x="{x-140}" y="{yy}" width="150" height="20" rx="6" fill="{wood}" transform="rotate(14 {x-140} {yy})"/>'
        else:
            s += f'<rect x="{x-140}" y="{yy}" width="280" height="20" rx="6" fill="{wood}"/>'
    s += f'<rect x="{x-128}" y="{y-170}" width="12" height="100" rx="4" fill="{leg}"/><rect x="{x+116}" y="{y-170}" width="12" height="100" rx="4" fill="{leg}"/>'
    return s

def gate(cx, y, open_=True, vines=False):
    s = ''
    # brick pillars
    for px in (cx - 150, cx + 110):
        s += f'<rect x="{px}" y="{y-250}" width="40" height="250" fill="#b5654a"/><rect x="{px}" y="{y-250}" width="40" height="250" fill="url(#pathG)" opacity="0.08"/>'
        for r in range(10):
            off = 0 if r % 2 == 0 else 10
            s += f'<line x1="{px}" y1="{y-25*r}" x2="{px+40}" y2="{y-25*r}" stroke="#94503a" stroke-width="2"/>'
            s += f'<line x1="{px+20+off-10}" y1="{y-25*r}" x2="{px+20+off-10}" y2="{y-25*r-25}" stroke="#94503a" stroke-width="2"/>'
        s += f'<rect x="{px-6}" y="{y-266}" width="52" height="18" rx="3" fill="#d8cdb8"/>'
        s += f'<circle cx="{px+20}" cy="{y-282}" r="14" fill="#d8cdb8"/>'
    # arch
    s += f'<path d="M{cx-110},{y-230} Q{cx},{y-330} {cx+110},{y-230}" fill="none" stroke="#2c3a3f" stroke-width="10"/>'
    s += f'<path d="M{cx-110},{y-210} Q{cx},{y-300} {cx+110},{y-210}" fill="none" stroke="#2c3a3f" stroke-width="5"/>'
    # gate leaves
    if open_:
        for side in (-1, 1):
            x0 = cx + side * 110
            x1 = cx + side * 160
            s += f'<path d="M{x0},{y} L{x1},{y+20} L{x1},{y-170} L{x0},{y-205} Z" fill="none" stroke="#2c3a3f" stroke-width="7"/>'
            for k in range(1, 4):
                xx = x0 + (x1 - x0) * k / 4
                s += f'<line x1="{xx}" y1="{y + 20*k/4}" x2="{xx}" y2="{y-205 + 35*k/4}" stroke="#2c3a3f" stroke-width="5"/>'
    else:
        s += f'<rect x="{cx-110}" y="{y-205}" width="220" height="205" fill="none" stroke="#2c3a3f" stroke-width="7"/>'
        for k in range(1, 9):
            xx = cx - 110 + 220 * k / 9
            s += f'<line x1="{xx}" y1="{y}" x2="{xx}" y2="{y-205}" stroke="#2c3a3f" stroke-width="5"/>'
        s += f'<line x1="{cx-110}" y1="{y-110}" x2="{cx+110}" y2="{y-110}" stroke="#2c3a3f" stroke-width="6"/>'
        s += f'<rect x="{cx-14}" y="{y-125}" width="28" height="30" rx="4" fill="#8a6d2f"/>'
    if vines:
        rr = random.Random(3)
        for k in range(40):
            t = k / 40
            x = cx - 130 + t * 260
            yy = y - 250 - math.sin(t * math.pi) * 70 + rr.uniform(-20, 40)
            s += f'<ellipse cx="{x:.1f}" cy="{yy:.1f}" rx="16" ry="10" fill="{rr.choice(["#5d7a30","#6f8a3a","#4a6a28"])}" transform="rotate({rr.uniform(-40,40):.0f} {x:.1f} {yy:.1f})"/>'
        for k in range(26):
            x = cx + rr.choice([-130, 130]) + rr.uniform(-20, 20)
            yy = y - rr.uniform(10, 240)
            s += f'<ellipse cx="{x:.1f}" cy="{yy:.1f}" rx="15" ry="9" fill="{rr.choice(["#5d7a30","#6f8a3a","#4a6a28"])}" transform="rotate({rr.uniform(-60,60):.0f} {x:.1f} {yy:.1f})"/>'
    return s

def greenhouse(cx, y, broken=False):
    s = f'<g opacity="0.95">'
    s += f'<rect x="{cx-170}" y="{y-150}" width="340" height="150" fill="url(#glass)" stroke="#f4f7f5" stroke-width="6"/>'
    s += f'<path d="M{cx-185},{y-150} L{cx},{y-250} L{cx+185},{y-150} Z" fill="url(#glass)" stroke="#f4f7f5" stroke-width="6"/>'
    for k in range(1, 6):
        xx = cx - 170 + 340 * k / 6
        s += f'<line x1="{xx}" y1="{y}" x2="{xx}" y2="{y-150}" stroke="#f4f7f5" stroke-width="4"/>'
    s += f'<line x1="{cx-170}" y1="{y-75}" x2="{cx+170}" y2="{y-75}" stroke="#f4f7f5" stroke-width="4"/>'
    if broken:
        s += f'<path d="M{cx+40},{y-150} L{cx+70},{y-110} L{cx+55},{y-90} L{cx+95},{y-60}" fill="none" stroke="#5f6f6a" stroke-width="3"/>'
        s += f'<rect x="{cx-110}" y="{y-140}" width="50" height="55" fill="#3f5550" opacity="0.6"/>'
    s += '</g>'
    return s

def goose(x, y, s=1.0, flip=False):
    sx = -s if flip else s
    return f'''<g transform="translate({x},{y}) scale({sx},{s})">
  <ellipse cx="0" cy="40" rx="60" ry="12" fill="#1d3a40" opacity="0.25"/>
  <path d="M-55,10 Q-60,-30 -10,-35 Q40,-38 55,0 Q50,30 0,32 Q-40,32 -55,10 Z" fill="#f4f4ef"/>
  <path d="M-50,8 Q-30,-12 10,-8 Q-10,10 -50,8 Z" fill="#dcdcd4"/>
  <path d="M30,-25 Q38,-70 30,-95 Q28,-110 40,-115 Q58,-118 58,-100 Q52,-80 50,-30 Z" fill="#f4f4ef"/>
  <path d="M55,-108 L82,-100 L56,-94 Z" fill="#f29a2e"/>
  <circle cx="47" cy="-105" r="4" fill="#1d1d1d"/>
  <path d="M40,-112 L54,-108" stroke="#1d1d1d" stroke-width="3"/>
  <path d="M-8,30 L-8,44 L-20,48 M10,30 L10,44 L-2,48" stroke="#f29a2e" stroke-width="5" fill="none" stroke-linecap="round"/>
</g>'''

def scene(restored: bool) -> str:
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">', DEFS]
    # sky
    o.append(f'<rect width="{W}" height="900" fill="url(#sky)"/>')
    o.append(f'<circle cx="820" cy="260" r="200" fill="url(#sun)"/>')
    o.append(cloud(230, 220, 1.1) + cloud(760, 140, 0.8) + cloud(560, 330, 0.6))
    # distant hills + treeline
    o.append(f'<path d="M0,700 Q180,560 380,640 Q560,700 720,610 Q900,520 1080,620 L1080,900 L0,900 Z" fill="url(#hill1)"/>')
    rr = random.Random(11)
    haze = ['#5f9277', '#6a9f80', '#76aa89', '#82b493', '#90bf9d', '#a2cba9']
    trees = ''
    for i in range(14):
        x = i * 82 + rr.uniform(-20, 20)
        r = rr.uniform(48, 72)
        trees += foliage(x, 700 + rr.uniform(-10, 20), r, r * 0.85, haze, 200 + i, density=0.6)
    o.append(f'<g opacity="0.9">{trees}</g>')
    o.append(f'<path d="M0,760 Q260,700 540,740 Q820,780 1080,720 L1080,900 L0,900 Z" fill="url(#hill2)"/>')
    # greenhouse in the distance
    o.append(greenhouse(800, 760, broken=not restored))
    # lawn
    o.append(f'<path d="M0,780 Q540,740 1080,780 L1080,{H} L0,{H} Z" fill="url(#{"lawn" if restored else "lawnDry"})"/>')
    if restored:  # faint mowing stripes, converging toward the gate
        for k in range(-6, 7):
            if k % 2:
                o.append(f'<path d="M{540 + k*30},{790} L{540 + (k+1)*30},{790} L{540 + (k+1)*260},{H} L{540 + k*260},{H} Z" fill="#ffffff" opacity="0.045"/>')
    o.append(grass_tufts(lambda x, y: y > 800, 800, H, GREEN if restored else DRY, 21, n=900 if restored else 650))
    # hedges receding (left/right walls)
    hp = HEDGE if restored else DRY
    leftH = [(0, 880), (330, 800), (330, 860), (0, 1080)]
    rightH = [(1080, 880), (750, 800), (750, 860), (1080, 1080)]
    for poly, sd in ((leftH, 1), (rightH, 2)):
        o.append(f'<path d="{path_d(poly)}" fill="{hp[2]}"/>')
        o.append(hedge_face_texture(poly, hp, 300 + sd, n=170))
    # left face is in shadow (sun is to the right)
    o.append(f'<path d="{path_d(leftH)}" fill="#0d2410" opacity="0.18"/>')
    o.append(hedge_top(0, 892, 330, 806, 30 if restored else 36, 10 if restored else 14, hp, 41))
    o.append(hedge_top(1080, 892, 750, 806, 30 if restored else 36, 10 if restored else 14, hp, 42))
    # trees behind the hedges, framing the gate
    for (tx, ground, th, cr, sd) in [(985, 880, 380, 190, 3), (95, 890, 340, 165, 8)]:
        o.append(tree(tx, ground, th, cr, GREEN if restored else DRY, sd))
    # gate at end of path
    o.append(f'<g id="gate">{gate(540, 870, open_=restored, vines=not restored)}</g>')
    # path (perspective)
    left = [(540 - 60 - (y - 860) * 0.34 - math.sin((y - 860) / 300) * 40, y) for y in range(860, H + 1, 20)]
    right = [(540 + 60 + (y - 860) * 0.34 - math.sin((y - 860) / 300) * 40, y) for y in range(H, 859, -20)]
    o.append(f'<path d="{path_d(left + right)}" fill="url(#pathG)"/>')
    # paving stones
    stones = ''
    sr = random.Random(5)
    y = 880
    row = 0
    while y < H:
        t = (y - 860) / (H - 860)
        width = 120 + (y - 860) * 0.68
        center = 540 - math.sin((y - 860) / 300) * 40
        sh = 18 + t * 60
        n = 3 if row % 2 == 0 else 4
        for k in range(n):
            x = center - width / 2 + width * (k + 0.5) / n + sr.uniform(-6, 6) * (1 + t)
            sw = width / n * 0.86
            col = sr.choice(['#e3d6bb', '#ddd0b2', '#e8dcc4', '#d6c8a8'])
            if not restored and sr.random() < 0.35:
                col = '#b9ab8b'
            stones += f'<rect x="{x - sw/2:.1f}" y="{y:.1f}" width="{sw:.1f}" height="{sh*0.8:.1f}" rx="{6+t*10:.1f}" fill="#b49f7c"/>'
            stones += f'<rect x="{x - sw/2:.1f}" y="{y - 3*(1+t):.1f}" width="{sw:.1f}" height="{sh*0.8:.1f}" rx="{6+t*10:.1f}" fill="{col}"/>'
            if not restored and sr.random() < 0.3:
                stones += f'<path d="M{x-sw*0.3:.1f},{y+2:.1f} L{x:.1f},{y+sh*0.35:.1f} L{x+sw*0.2:.1f},{y+sh*0.5:.1f}" stroke="#8f7c5c" stroke-width="{2+t*2:.1f}" fill="none"/>'
        y += sh
        row += 1
    o.append(f'<g id="path">{stones}</g>')
    # flowerbeds
    left_plan = [('tulip', '#e8475f'), ('tulip', '#f2b632'), ('daisy', '#ffffff'), ('cosmos', '#d36fd8'), ('daisy', '#ffffff')]
    right_plan = [('rose', '#e8475f'), ('cosmos', '#ff9a52'), ('tulip', '#ffd23f'), ('rose', '#f7a6c2')]
    o.append(f'<g id="bed-left">{flowerbed(210, 1180, 300, 150, left_plan, 1, planted="flowers" if restored else False)}</g>')
    o.append(f'<g id="bed-right">{flowerbed(890, 1120, 260, 130, right_plan, 2, planted="flowers" if restored else False)}</g>')
    # shrubs along the hedges
    for (x, yy, r, sd) in [(70, 1010, 70, 1), (1010, 1000, 75, 4), (330, 930, 45, 7), (760, 925, 45, 9)]:
        o.append(bush(x, yy, r, GREEN if restored else DRY, sd))
    # lamp post
    o.append(f'<g id="lamp">{lamp(1045, 1560, lit=restored, broken=not restored)}</g>')
    # bench
    o.append(f'<g id="bench">{bench(895, 1500, broken=not restored)}</g>')
    # pond bottom-left with goose
    o.append(f'<g id="pond">')
    o.append(f'<ellipse cx="170" cy="1760" rx="300" ry="130" fill="#3d6e4a"/>')
    o.append(f'<ellipse cx="170" cy="1752" rx="282" ry="116" fill="url(#{"water" if restored else "waterMurky"})"/>')
    if restored:
        for (x, yy) in [(90, 1730), (250, 1790), (330, 1720)]:
            o.append(f'<path d="M{x},{yy} m-34,0 a34,18 0 1,0 68,0 a34,18 0 1,0 -68,0 M{x},{yy} L{x+34},{yy-4}" fill="#5fae5a"/>')
        o.append(flower(250, 1782, 12, '#ff9ec7'))
        o.append('<path d="M60,1700 Q170,1690 280,1702" stroke="#ffffff" stroke-width="4" opacity="0.5" fill="none"/>')
    else:
        for (x, yy) in [(110, 1740), (260, 1770)]:
            o.append(f'<ellipse cx="{x}" cy="{yy}" rx="40" ry="10" fill="#6f7a3f" opacity="0.8"/>')
    o.append(goose(200, 1700, 1.0, flip=False))
    o.append('</g>')
    # overgrowth layer
    if not restored:
        wr = random.Random(9)
        spots = [(520, 1080, 0.8), (600, 1300, 1.0), (470, 1500, 1.2), (640, 1700, 1.4), (540, 1880, 1.5), (360, 1250, 0.9), (720, 1560, 1.1), (200, 1350, 1.0), (880, 1300, 1.0), (430, 960, 0.6)]
        o.append('<g id="weeds">' + ''.join(weeds(x, yy, s, i) for i, (x, yy, s) in enumerate(spots)) + '</g>')
        leaves = ''
        for i in range(60):
            x, yy = wr.uniform(0, W), wr.uniform(950, H)
            leaves += f'<ellipse cx="{x:.0f}" cy="{yy:.0f}" rx="9" ry="5" fill="{wr.choice(["#b5783a","#c98f45","#9a6a32"])}" transform="rotate({wr.uniform(0,180):.0f} {x:.0f} {yy:.0f})"/>'
        o.append(f'<g id="leaves">{leaves}</g>')
    # light + vignette
    o.append(f'<rect width="{W}" height="{H}" fill="url(#vignette)"/>')
    o.append('</svg>')
    return '\n'.join(o)

os.makedirs(OUT, exist_ok=True)
for restored in (False, True):
    name = 'entrance-restored.svg' if restored else 'entrance-overgrown.svg'
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(scene(restored))
print('ok')
