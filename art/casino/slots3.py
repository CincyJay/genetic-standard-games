"""
Lucky Lanterns: symbols (200x200 SVG) and backdrop.
Writes games/casino/public/art/slots/lanterns/<symbol>.svg and art/casino/out/bg-slots-lanterns.svg.
Usage: python3 art/casino/slots3.py && node art/casino/build.mjs
"""
import os, math

HERE = os.path.dirname(__file__)
PUB = os.path.join(HERE, '..', '..', 'games', 'casino', 'public', 'art', 'slots', 'lanterns')
OUT = os.path.join(HERE, 'out')
SH = '<ellipse cx="100" cy="186" rx="60" ry="8" fill="#000" opacity="0.3"/>'
FONT = "Georgia, 'Times New Roman', serif"


def svg(body, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><defs>{defs}</defs>{body}</svg>'


def lg(i, a, b, c=None):
    mid = f'<stop offset="0.5" stop-color="{b}"/>' if c else ''
    end = c or b
    return f'<linearGradient id="{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{a}"/>{mid}<stop offset="1" stop-color="{end}"/></linearGradient>'


def rg(i, a, b, c):
    return f'<radialGradient id="{i}" cx="0.4" cy="0.32" r="0.8"><stop offset="0" stop-color="{a}"/><stop offset="0.55" stop-color="{b}"/><stop offset="1" stop-color="{c}"/></radialGradient>'


def royal(letter, top, mid, bot, edge, size=150):
    """Card-rank symbol: a bevelled gemstone letter with a gold rim."""
    defs = lg('f', top, mid, bot) + lg('rim', '#fff3b0', '#d9a520', '#7a4a06')
    y = 100 + size * 0.36
    return svg(SH +
               f'<text x="100" y="{y + 6:.0f}" font-family="{FONT}" font-weight="900" font-size="{size}" fill="#000" opacity="0.35" text-anchor="middle">{letter}</text>'
               f'<text x="100" y="{y:.0f}" font-family="{FONT}" font-weight="900" font-size="{size}" fill="url(#f)" stroke="url(#rim)" stroke-width="7" paint-order="stroke" text-anchor="middle">{letter}</text>'
               f'<text x="100" y="{y:.0f}" font-family="{FONT}" font-weight="900" font-size="{size}" fill="none" stroke="{edge}" stroke-width="1.5" text-anchor="middle">{letter}</text>', defs)


def koi():
    scales = ''.join(f'<path d="M{70 + k * 16},{88 + (k % 2) * 4} q8,10 0,20" stroke="#b8300a" stroke-width="3" fill="none" opacity="0.55"/>' for k in range(5))
    return svg(SH +
               '<path d="M150,100 Q186,62 192,96 Q186,130 150,104 Z" fill="url(#tail)"/>'
               '<path d="M30,100 Q60,48 120,62 Q152,74 154,100 Q152,126 120,138 Q60,152 30,100 Z" fill="url(#body)" stroke="#8a2a06" stroke-width="3"/>'
               '<path d="M86,64 Q100,36 128,52 Q112,58 104,68 Z" fill="#ff8a3a" stroke="#8a2a06" stroke-width="2"/>'
               '<path d="M92,136 Q100,162 124,152 Q110,146 104,134 Z" fill="#ff8a3a" stroke="#8a2a06" stroke-width="2"/>'
               '<path d="M70,74 Q96,64 112,90 Q90,96 70,74 Z" fill="#fff6ea" opacity="0.9"/>'
               '<path d="M96,118 Q118,110 136,124 Q116,132 96,118 Z" fill="#fff6ea" opacity="0.9"/>'
               + scales +
               '<circle cx="50" cy="94" r="8" fill="#fff"/><circle cx="48" cy="93" r="5" fill="#120a04"/><circle cx="46" cy="91" r="1.8" fill="#fff"/>'
               '<path d="M32,104 Q22,112 18,124 M34,108 Q30,122 30,134" stroke="#e9a050" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
               '<ellipse cx="86" cy="76" rx="26" ry="7" fill="#fff" opacity="0.4" transform="rotate(-12 86 76)"/>',
               lg('body', '#ffb070', '#f05a14', '#a8280a') + lg('tail', '#ff9a50', '#c8360a'))


def fan():
    ribs = ''
    paper = ''
    n = 9
    for k in range(n):
        a0 = math.pi + (k / n) * math.pi
        a1 = math.pi + ((k + 1) / n) * math.pi
        x0, y0 = 100 + math.cos(a0) * 88, 150 + math.sin(a0) * 88
        x1, y1 = 100 + math.cos(a1) * 88, 150 + math.sin(a1) * 88
        col = '#c8102e' if k % 2 == 0 else '#e8283e'
        paper += f'<path d="M100,150 L{x0:.1f},{y0:.1f} A88,88 0 0 1 {x1:.1f},{y1:.1f} Z" fill="{col}"/>'
        ribs += f'<path d="M100,150 L{x0:.1f},{y0:.1f}" stroke="#5a1a06" stroke-width="2.5"/>'
    return svg(SH + paper +
               '<path d="M12,150 A88,88 0 0 1 188,150" fill="none" stroke="url(#gold)" stroke-width="8"/>'
               '<path d="M44,150 A56,56 0 0 1 156,150" fill="none" stroke="url(#gold)" stroke-width="4"/>'
               + ribs +
               '<circle cx="100" cy="112" r="20" fill="url(#gold)" stroke="#7a4a06" stroke-width="2"/>'
               '<path d="M92,112 L108,112 M100,104 L100,120" stroke="#8a1010" stroke-width="4"/>'
               '<circle cx="100" cy="150" r="10" fill="url(#gold)" stroke="#7a4a06" stroke-width="2"/>'
               '<path d="M100,160 Q96,176 104,190" stroke="#d9a520" stroke-width="4" fill="none"/>'
               '<path d="M30,120 Q60,80 110,72" stroke="#fff" stroke-width="5" fill="none" opacity="0.3" stroke-linecap="round"/>',
               lg('gold', '#fff3b0', '#d9a520', '#8a5a0a'))


def tiger():
    stripes = (
        '<path d="M100,40 L94,62 L100,58 L106,62 Z" fill="#1a0e06"/>'
        '<path d="M70,48 Q78,62 74,74 M130,48 Q122,62 126,74" stroke="#1a0e06" stroke-width="6" fill="none" stroke-linecap="round"/>'
        '<path d="M40,96 Q54,96 62,104 M38,116 Q52,112 62,118 M160,96 Q146,96 138,104 M162,116 Q148,112 138,118" stroke="#1a0e06" stroke-width="6" fill="none" stroke-linecap="round"/>'
        '<path d="M84,50 Q90,60 88,68 M116,50 Q110,60 112,68" stroke="#1a0e06" stroke-width="4" fill="none" stroke-linecap="round"/>'
    )
    return svg(SH +
               # ears
               '<path d="M44,62 Q36,24 72,38 Z" fill="url(#fur)" stroke="#5a2a06" stroke-width="3"/><path d="M50,56 Q48,36 66,44 Z" fill="#fff0dc"/>'
               '<path d="M156,62 Q164,24 128,38 Z" fill="url(#fur)" stroke="#5a2a06" stroke-width="3"/><path d="M150,56 Q152,36 134,44 Z" fill="#fff0dc"/>'
               # head
               '<path d="M100,30 Q160,30 172,86 Q178,128 150,152 Q126,176 100,178 Q74,176 50,152 Q22,128 28,86 Q40,30 100,30 Z" fill="url(#fur)" stroke="#5a2a06" stroke-width="3"/>'
               # cheeks / muzzle
               '<path d="M46,118 Q60,96 100,110 Q140,96 154,118 Q150,156 100,170 Q50,156 46,118 Z" fill="#fff6ea"/>'
               + stripes +
               # eyes
               '<path d="M60,84 Q74,72 90,84 Q74,94 60,84 Z" fill="#f4d03a" stroke="#1a0e06" stroke-width="3"/>'
               '<path d="M140,84 Q126,72 110,84 Q126,94 140,84 Z" fill="#f4d03a" stroke="#1a0e06" stroke-width="3"/>'
               '<ellipse cx="76" cy="84" rx="3.5" ry="8" fill="#1a0e06"/><ellipse cx="124" cy="84" rx="3.5" ry="8" fill="#1a0e06"/>'
               # nose and mouth
               '<path d="M88,112 L112,112 L100,126 Z" fill="#d86a6a" stroke="#5a1a1a" stroke-width="2.5" stroke-linejoin="round"/>'
               '<path d="M100,126 L100,136 M100,136 Q90,146 80,140 M100,136 Q110,146 120,140" stroke="#3a1a0a" stroke-width="3" fill="none" stroke-linecap="round"/>'
               '<g fill="#3a1a0a">' + ''.join(f'<circle cx="{x}" cy="{y}" r="2"/>' for x, y in [(76, 128), (70, 134), (80, 136), (124, 128), (130, 134), (120, 136)]) + '</g>'
               '<path d="M66,130 L28,124 M66,136 L30,140 M134,130 L172,124 M134,136 L170,140" stroke="#fff" stroke-width="2" opacity="0.9"/>'
               '<ellipse cx="72" cy="50" rx="22" ry="8" fill="#fff" opacity="0.3" transform="rotate(-20 72 50)"/>',
               rg('fur', '#ffc070', '#f08a1e', '#b0520a'))


def wild():
    return svg(SH +
               '<path d="M100,14 L184,60 L184,140 L100,186 L16,140 L16,60 Z" fill="url(#jade)" stroke="url(#gold)" stroke-width="9" stroke-linejoin="round"/>'
               '<path d="M100,30 L168,68 L168,132 L100,170 L32,132 L32,68 Z" fill="none" stroke="#fff3b0" stroke-width="2" opacity="0.6"/>'
               f'<text x="100" y="118" font-family="{FONT}" font-weight="900" font-size="56" fill="url(#gold)" stroke="#5a2a00" stroke-width="2.5" text-anchor="middle">WILD</text>'
               '<path d="M40,60 L100,28 L136,48" stroke="#fff" stroke-width="5" fill="none" opacity="0.4" stroke-linecap="round"/>',
               lg('jade', '#4fe0a0', '#0f8a5a', '#06402a') + lg('gold', '#fff3b0', '#e9b949', '#9a6a10'))


def lantern():
    ribs = ''.join(f'<path d="M{100 + dx},40 Q{100 + dx * 1.9},100 {100 + dx},160" stroke="#7a0a0a" stroke-width="3" fill="none" opacity="0.6"/>' for dx in (-36, -18, 0, 18, 36))
    return svg(SH +
               '<circle cx="100" cy="100" r="92" fill="url(#glow)"/>'
               '<path d="M100,4 L100,22" stroke="#d9a520" stroke-width="4"/>'
               '<rect x="72" y="20" width="56" height="18" rx="5" fill="url(#gold)" stroke="#7a4a06" stroke-width="2"/>'
               '<path d="M100,36 Q172,40 172,100 Q172,160 100,164 Q28,160 28,100 Q28,40 100,36 Z" fill="url(#paper)" stroke="#7a0a0a" stroke-width="3"/>'
               + ribs +
               '<rect x="72" y="160" width="56" height="16" rx="5" fill="url(#gold)" stroke="#7a4a06" stroke-width="2"/>'
               '<path d="M92,176 L92,194 M100,176 L100,196 M108,176 L108,194" stroke="#e9b949" stroke-width="3"/>'
               '<circle cx="100" cy="100" r="30" fill="url(#gold)" stroke="#7a4a06" stroke-width="2"/>'
               '<rect x="90" y="90" width="20" height="20" fill="#a8101e" transform="rotate(45 100 100)"/>'
               '<ellipse cx="70" cy="66" rx="18" ry="10" fill="#fff" opacity="0.4" transform="rotate(-30 70 66)"/>',
               rg('paper', '#ffd0a0', '#f03a2a', '#8a0a14')
               + '<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0.4" stop-color="#ffb040" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb040" stop-opacity="0"/></radialGradient>'
               + lg('gold', '#fff3b0', '#e9b949', '#9a6a10'))


SYMS = {
    'ten': royal('10', '#bfe8ff', '#3a8ad8', '#14306a', '#0a1a3a', size=118),
    'jack': royal('J', '#d8ffe0', '#2ab868', '#0a4a26', '#06301a'),
    'queen': royal('Q', '#ffd6f0', '#d83a9a', '#5a0a3a', '#3a0626'),
    'king': royal('K', '#e6d6ff', '#7a4ad8', '#2a0e6a', '#180a3a'),
    'ace': royal('A', '#ffe0c0', '#e8402a', '#6a0a0a', '#3a0606'),
    'koi': koi(),
    'fan': fan(),
    'tiger': tiger(),
    'wild': wild(),
    'scatter': lantern(),
}


def backdrop():
    W, H = 1080, 1920
    rays = ''.join(f'<path d="M540,760 L{540 + math.cos(a) * 1700:.0f},{760 + math.sin(a) * 1700:.0f} L{540 + math.cos(a + 0.11) * 1700:.0f},{760 + math.sin(a + 0.11) * 1700:.0f} Z" fill="#ffcf6a" opacity="0.06"/>'
                   for a in [i * math.tau / 26 for i in range(26)])
    # strings of small lanterns across the top
    lights = ''
    for row, (y0, sag) in enumerate([(120, 70), (250, 60)]):
        pts = []
        for k in range(0, 13):
            x = -20 + k * 93
            y = y0 + sag * math.sin(math.pi * (k / 12))
            pts.append((x, y))
        lights += '<path d="M' + ' L'.join(f'{x:.0f},{y:.0f}' for x, y in pts) + '" stroke="#3a0a06" stroke-width="3" fill="none"/>'
        for x, y in pts[1:-1]:
            lights += (f'<circle cx="{x:.0f}" cy="{y + 30:.0f}" r="44" fill="#ffb040" opacity="0.18"/>'
                       f'<ellipse cx="{x:.0f}" cy="{y + 30:.0f}" rx="20" ry="24" fill="#e8302a"/>'
                       f'<rect x="{x - 9:.0f}" y="{y + 2:.0f}" width="18" height="6" fill="#e9b949"/><rect x="{x - 9:.0f}" y="{y + 52:.0f}" width="18" height="6" fill="#e9b949"/>'
                       f'<ellipse cx="{x - 6:.0f}" cy="{y + 22:.0f}" rx="6" ry="9" fill="#ffd0a0" opacity="0.6"/>')
    clouds = ''
    for cx, cy, s in [(160, 1560, 1.0), (900, 1640, 1.2), (520, 1780, 0.9)]:
        clouds += (f'<g transform="translate({cx},{cy}) scale({s})" fill="none" stroke="#e9b949" stroke-width="5" opacity="0.35">'
                   '<path d="M-120,0 Q-120,-50 -70,-50 Q-60,-90 -10,-80 Q30,-110 70,-70 Q120,-70 120,-20 Q120,10 90,10 Z"/>'
                   '<path d="M-60,-20 Q-40,-40 -20,-20 Q0,0 20,-20"/></g>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><defs>
<radialGradient id="s" cx="0.5" cy="0.38" r="0.85"><stop offset="0" stop-color="#b8201e"/><stop offset="0.55" stop-color="#6a0a10"/><stop offset="1" stop-color="#22030a"/></radialGradient>
<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0"/></filter>
<filter id="b"><feGaussianBlur stdDeviation="3"/></filter></defs>
<rect width="{W}" height="{H}" fill="url(#s)"/>{rays}<g filter="url(#b)">{lights}</g>{clouds}
<rect x="20" y="20" width="1040" height="1880" rx="40" fill="none" stroke="#e9b949" stroke-width="6" opacity="0.7"/>
<rect width="{W}" height="{H}" filter="url(#noise)"/></svg>'''


os.makedirs(PUB, exist_ok=True)
for k, v in SYMS.items():
    # unique gradient ids per file
    for gid in ('f', 'rim', 'body', 'tail', 'gold', 'fur', 'jade', 'paper', 'glow'):
        v = v.replace(f'id="{gid}"', f'id="{gid}-ln-{k}"').replace(f'url(#{gid})', f'url(#{gid}-ln-{k})')
    open(os.path.join(PUB, f'{k}.svg'), 'w').write(v)
os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'bg-slots-lanterns.svg'), 'w').write(backdrop())
print('lucky lanterns art written')
