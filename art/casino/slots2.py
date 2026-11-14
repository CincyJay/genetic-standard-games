"""
Symbols for the themed slot machines (200x200 SVG each) and their backdrops.
Writes games/casino/public/art/slots/<machine>/<symbol>.svg and art/casino/out/bg-slots-<machine>.svg.
Lucky Sevens symbols are produced by slots.py and copied into slots/sevens/.
"""
import os, math, shutil

HERE = os.path.dirname(__file__)
PUB = os.path.join(HERE, '..', '..', 'games', 'casino', 'public', 'art', 'slots')
OUT = os.path.join(HERE, 'out')
SH = '<ellipse cx="100" cy="184" rx="58" ry="8" fill="#000" opacity="0.28"/>'


def svg(body, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><defs>{defs}</defs>{body}</svg>'


def rg(i, a, b, c):
    return f'<radialGradient id="{i}" cx="0.38" cy="0.3" r="0.85"><stop offset="0" stop-color="{a}"/><stop offset="0.5" stop-color="{b}"/><stop offset="1" stop-color="{c}"/></radialGradient>'


def lg(i, a, b):
    return f'<linearGradient id="{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'


GOLD = lg('gold', '#fff1a8', '#c98a10')
GLOSS = '<ellipse cx="80" cy="60" rx="22" ry="11" fill="#fff" opacity="0.45" transform="rotate(-30 80 60)"/>'


def label_token(text, fill, ring, txt='#3a1a00', size=34):
    """Round token with a word on it (wild / scatter)."""
    return svg(SH + f'<circle cx="100" cy="96" r="80" fill="{ring}"/><circle cx="100" cy="92" r="72" fill="url(#t)"/>'
               f'<circle cx="100" cy="92" r="60" fill="none" stroke="{ring}" stroke-width="3" stroke-dasharray="5 6"/>'
               f'<text x="100" y="{92 + size * 0.36:.0f}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="{size}" fill="{txt}" text-anchor="middle">{text}</text>'
               '<ellipse cx="72" cy="52" rx="22" ry="10" fill="#fff" opacity="0.5" transform="rotate(-25 72 52)"/>',
               f'<radialGradient id="t" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff"/><stop offset="0.35" stop-color="{fill}"/><stop offset="1" stop-color="{ring}"/></radialGradient>')


# ------------------------------------------------------------------ Pharaoh's Gold
PHARAOH = {
    'ankh': svg(SH + '<g fill="url(#gold)" stroke="#8a5a0a" stroke-width="4"><ellipse cx="100" cy="58" rx="28" ry="36" fill="none" stroke="url(#gold)" stroke-width="18"/>'
                '<rect x="54" y="92" width="92" height="20" rx="6"/><rect x="90" y="96" width="20" height="82" rx="6"/></g>', GOLD),
    'eye': svg(SH + '<path d="M22,96 Q100,30 178,96 Q100,150 22,96 Z" fill="#f6efe0" stroke="#1d3a8a" stroke-width="8"/>'
               '<circle cx="100" cy="94" r="28" fill="#1d3a8a"/><circle cx="100" cy="94" r="12" fill="#0a0a14"/><circle cx="92" cy="86" r="5" fill="#fff"/>'
               '<path d="M86,124 L72,170 M104,124 Q120,160 150,150" stroke="#1d3a8a" stroke-width="8" fill="none" stroke-linecap="round"/>'
               '<path d="M30,60 Q100,20 170,60" stroke="#1d3a8a" stroke-width="10" fill="none" stroke-linecap="round"/>'),
    'scarab': svg(SH + '<ellipse cx="100" cy="112" rx="50" ry="58" fill="url(#sc)"/><path d="M100,58 L100,168" stroke="#062a1e" stroke-width="4"/>'
                  '<ellipse cx="100" cy="52" rx="28" ry="18" fill="#0f5a3a"/>'
                  '<path d="M52,96 L22,80 M50,120 L18,124 M54,146 L26,166 M148,96 L178,80 M150,120 L182,124 M146,146 L174,166" stroke="#0a3a26" stroke-width="7" stroke-linecap="round"/>'
                  '<ellipse cx="82" cy="92" rx="12" ry="20" fill="#fff" opacity="0.35"/>', rg('sc', '#7ff0b8', '#1f9a62', '#0a4a2e')),
    'cat': svg(SH + '<path d="M70,180 Q60,110 76,84 L68,30 L92,62 Q100,58 108,62 L132,30 L124,84 Q140,110 130,180 Z" fill="#1d1d24"/>'
               '<path d="M78,96 L122,96" stroke="#e9c86a" stroke-width="6"/><circle cx="88" cy="74" r="5" fill="#e9c86a"/><circle cx="112" cy="74" r="5" fill="#e9c86a"/>'
               '<circle cx="100" cy="112" r="6" fill="#e9c86a"/><path d="M84,40 L88,58 M116,40 L112,58" stroke="#e9c86a" stroke-width="3"/>'),
    'pyramid': svg(SH + '<path d="M100,24 L178,170 L22,170 Z" fill="url(#py)"/><path d="M100,24 L130,170 L178,170 Z" fill="#a8701c" opacity="0.6"/>'
                   + ''.join(f'<path d="M{100 - k * 13},{24 + k * 24} L{100 + k * 13},{24 + k * 24}" stroke="#8a5a0a" stroke-width="2" opacity="0.6"/>' for k in range(1, 7))
                   + '<path d="M100,24 L112,46 L88,46 Z" fill="#fff4b0"/>', lg('py', '#ffe08a', '#c98a10')),
    'mask': svg(SH + '<path d="M40,60 Q40,20 100,18 Q160,20 160,60 L168,150 Q140,184 100,186 Q60,184 32,150 Z" fill="url(#gold)" stroke="#8a5a0a" stroke-width="4"/>'
                + ''.join(f'<path d="M{36 + k * 4},{70 + k * 18} L{164 - k * 4},{70 + k * 18}" stroke="#1d3a8a" stroke-width="7" opacity="0.85"/>' for k in range(0, 4))
                + '<ellipse cx="100" cy="98" rx="38" ry="46" fill="#e9b949"/><path d="M76,88 Q84,80 92,88 M108,88 Q116,80 124,88" stroke="#1d1d24" stroke-width="5" fill="none"/>'
                '<path d="M100,96 L94,118 L106,118 Z" fill="#c98a10"/><path d="M88,130 Q100,136 112,130" stroke="#8a3a1a" stroke-width="4" fill="none"/>'
                '<rect x="92" y="144" width="16" height="34" rx="4" fill="#1d3a8a"/>', GOLD),
    'gem': svg(SH + '<path d="M100,176 L28,84 L58,38 L142,38 L172,84 Z" fill="url(#gm)" stroke="#0a5a2a" stroke-width="4" stroke-linejoin="round"/>'
               '<path d="M28,84 L172,84 M58,38 L80,84 L100,176 L120,84 L142,38 M80,84 L100,38 L120,84" stroke="#fff" stroke-width="3" opacity="0.55" fill="none"/>'
               '<path d="M58,38 L100,38 L80,84 L28,84 Z" fill="#fff" opacity="0.3"/>', lg('gm', '#b8ffd0', '#18a050')),
    'wild': label_token('WILD', '#ffd23f', '#a4700f', '#5a1a00'),
    'scatter': svg(SH + '<path d="M50,40 L150,40 L160,170 L40,170 Z" fill="url(#sar)" stroke="#5a3a0a" stroke-width="5"/>'
                   '<ellipse cx="100" cy="78" rx="30" ry="26" fill="#e9b949" stroke="#8a5a0a" stroke-width="3"/>'
                   '<path d="M86,74 L96,74 M104,74 L114,74" stroke="#1d1d24" stroke-width="4"/>'
                   + ''.join(f'<path d="M58,{112 + k * 16} L142,{112 + k * 16}" stroke="#1d3a8a" stroke-width="5"/>' for k in range(3))
                   + '<text x="100" y="195" font-family="Arial Black, Arial" font-weight="900" font-size="26" fill="#ffe08a" text-anchor="middle" stroke="#5a3a0a" stroke-width="1">BONUS</text>',
                   lg('sar', '#c98a10', '#6a3a08')),
}

# ------------------------------------------------------------------ Deep Blue
OCEAN = {
    'shell': svg(SH + '<path d="M100,40 Q170,50 176,130 Q140,176 100,178 Q60,176 24,130 Q30,50 100,40 Z" fill="url(#sh)"/>'
                 + ''.join(f'<path d="M100,170 L{100 + math.cos(a) * 80:.0f},{110 - math.sin(a) * 70:.0f}" stroke="#d97a8a" stroke-width="4" opacity="0.8"/>' for a in [i * math.pi / 8 + math.pi / 16 for i in range(8)])
                 + '<rect x="78" y="162" width="44" height="18" rx="6" fill="#e8a0aa"/>', rg('sh', '#ffe6ea', '#ffb6c2', '#d97a8a')),
    'starfish': svg(SH + '<path d="' + 'M' + ' L'.join(f'{100 + math.cos(a) * (80 if i % 2 == 0 else 32):.0f},{100 + math.sin(a) * (80 if i % 2 == 0 else 32):.0f}' for i, a in enumerate([j * math.pi / 5 - math.pi / 2 for j in range(10)])) + ' Z" fill="url(#st)" stroke="#b8501a" stroke-width="4" stroke-linejoin="round"/>'
                    + ''.join(f'<circle cx="{100 + math.cos(a) * r:.0f}" cy="{100 + math.sin(a) * r:.0f}" r="4" fill="#fff3d6" opacity="0.8"/>' for a in [j * 2 * math.pi / 5 - math.pi / 2 for j in range(5)] for r in (24, 44, 62)),
                    rg('st', '#ffc28a', '#ff8a3c', '#c8501a')),
    'fish': svg(SH + '<path d="M30,100 Q80,40 140,80 L178,52 L170,100 L178,148 L140,120 Q80,160 30,100 Z" fill="url(#fi)" stroke="#a4700f" stroke-width="4"/>'
                '<path d="M70,62 L70,138 M100,58 L100,142" stroke="#fff" stroke-width="10" opacity="0.85"/><circle cx="52" cy="94" r="7" fill="#1d1d24"/>', lg('fi', '#ffd23f', '#ff8a1a')),
    'turtle': svg(SH + '<ellipse cx="100" cy="104" rx="66" ry="54" fill="#4a9a3a"/><ellipse cx="100" cy="100" rx="60" ry="48" fill="url(#tu)"/>'
                  '<path d="M100,56 L100,148 M50,100 L150,100 M64,68 L136,132 M136,68 L64,132" stroke="#2f6a24" stroke-width="4" opacity="0.7"/>'
                  '<ellipse cx="172" cy="94" rx="20" ry="16" fill="#7cc46a"/><circle cx="178" cy="88" r="4" fill="#1d1d24"/>'
                  '<ellipse cx="44" cy="146" rx="18" ry="10" fill="#7cc46a"/><ellipse cx="150" cy="150" rx="18" ry="10" fill="#7cc46a"/><ellipse cx="44" cy="56" rx="18" ry="10" fill="#7cc46a"/>',
                  rg('tu', '#b8e88a', '#6aa84f', '#3a7a2a')),
    'octopus': svg(SH + ''.join(f'<path d="M{70 + k * 12},120 Q{50 + k * 18},{170 + (k % 2) * 10} {40 + k * 22},{178}" stroke="#b5468f" stroke-width="16" fill="none" stroke-linecap="round"/>' for k in range(6))
                   + '<ellipse cx="100" cy="80" rx="54" ry="58" fill="url(#oc)"/><circle cx="82" cy="84" r="10" fill="#fff"/><circle cx="118" cy="84" r="10" fill="#fff"/>'
                   '<circle cx="84" cy="86" r="5" fill="#1d1d24"/><circle cx="120" cy="86" r="5" fill="#1d1d24"/>' + GLOSS, rg('oc', '#ffb0e0', '#d65aa8', '#8a2a6a')),
    'shark': svg(SH + '<path d="M18,110 Q70,64 150,92 L184,70 L172,112 L186,150 L150,128 Q90,150 18,110 Z" fill="url(#sk)" stroke="#2a3a4a" stroke-width="4"/>'
                 '<path d="M90,74 L108,30 L122,84 Z" fill="#5a7a8f" stroke="#2a3a4a" stroke-width="4"/><path d="M24,112 Q80,132 140,124 Q90,150 24,112 Z" fill="#e6eef2"/>'
                 '<circle cx="48" cy="102" r="6" fill="#1d1d24"/><path d="M34,118 L40,124 L46,118 L52,124 L58,118" stroke="#fff" stroke-width="3" fill="none"/>', lg('sk', '#9ab4c4', '#4a6a80')),
    'pearl': svg(SH + '<path d="M30,120 Q100,190 170,120 Q160,170 100,176 Q40,170 30,120 Z" fill="#c9a0c4"/><path d="M30,118 Q100,40 170,118" fill="#e2c4df" stroke="#a4709f" stroke-width="4"/>'
                 '<circle cx="100" cy="112" r="36" fill="url(#pe)"/><ellipse cx="88" cy="98" rx="12" ry="8" fill="#fff" opacity="0.9"/>', rg('pe', '#ffffff', '#efe6f4', '#b8a8c8')),
    'wild': label_token('WILD', '#4fd1ff', '#1a5a8a', '#ffffff'),
    'scatter': svg(SH + '<rect x="34" y="78" width="132" height="92" rx="12" fill="url(#ch)" stroke="#3a2210" stroke-width="5"/>'
                   '<path d="M34,82 Q100,20 166,82 Z" fill="#8a5a32" stroke="#3a2210" stroke-width="5"/><rect x="34" y="96" width="132" height="12" fill="#e9c86a"/>'
                   '<rect x="88" y="100" width="24" height="30" rx="4" fill="#e9c86a" stroke="#8a5a0a" stroke-width="3"/>'
                   '<circle cx="62" cy="70" r="10" fill="#ffd23f"/><circle cx="138" cy="68" r="10" fill="#ffd23f"/><circle cx="100" cy="56" r="10" fill="#ffffff"/>'
                   '<text x="100" y="196" font-family="Arial Black, Arial" font-weight="900" font-size="24" fill="#fff" text-anchor="middle" stroke="#1a3a5a" stroke-width="1">FREE SPINS</text>',
                   lg('ch', '#b07a46', '#6a4422')),
}

# ------------------------------------------------------------------ Gold Rush
GOLDRUSH = {
    'pick': svg(SH + '<path d="M40,58 Q100,10 160,58 L150,66 Q100,32 50,66 Z" fill="#9aa4ac" stroke="#4a5258" stroke-width="4"/>'
                '<rect x="92" y="42" width="16" height="140" rx="6" fill="#8a5a32" stroke="#4a2a12" stroke-width="3"/>'),
    'lantern': svg(SH + '<path d="M70,40 Q100,10 130,40" stroke="#3a3a42" stroke-width="7" fill="none"/><rect x="66" y="40" width="68" height="16" rx="4" fill="#3a3a42"/>'
                   '<rect x="72" y="56" width="56" height="96" rx="10" fill="url(#ln)" stroke="#3a3a42" stroke-width="6"/>'
                   '<ellipse cx="100" cy="104" rx="14" ry="22" fill="#fff6b0"/><rect x="62" y="150" width="76" height="18" rx="4" fill="#3a3a42"/>',
                   rg('ln', '#fff6b0', '#ffb347', '#c86a1a')),
    'pan': svg(SH + '<ellipse cx="100" cy="112" rx="82" ry="40" fill="#5a5f66"/><ellipse cx="100" cy="104" rx="74" ry="32" fill="#8a9098"/>'
               '<ellipse cx="100" cy="104" rx="50" ry="18" fill="#6a5a44"/>' + ''.join(f'<circle cx="{78 + k * 11}" cy="{100 + (k % 2) * 6}" r="{5 + (k % 3)}" fill="#ffd23f"/>' for k in range(5))),
    'cart': svg(SH + '<path d="M30,70 L170,70 L156,150 L44,150 Z" fill="url(#ca)" stroke="#3a3a42" stroke-width="5"/>'
                + ''.join(f'<circle cx="{58 + k * 16}" cy="{66 - (k % 3) * 6}" r="{12 - (k % 2) * 2}" fill="#ffd23f" stroke="#a4700f" stroke-width="2"/>' for k in range(6))
                + '<circle cx="66" cy="160" r="16" fill="#2a2a30" stroke="#8a9098" stroke-width="5"/><circle cx="134" cy="160" r="16" fill="#2a2a30" stroke="#8a9098" stroke-width="5"/>',
                lg('ca', '#8a5a32', '#4a2a12')),
    'dynamite': svg(SH + ''.join(f'<rect x="{50 + k * 34}" y="62" width="30" height="110" rx="10" fill="url(#dy)" stroke="#7a0b19" stroke-width="3"/>' for k in range(3))
                    + '<rect x="44" y="104" width="112" height="18" fill="#3a2a1a"/><path d="M100,62 Q110,30 136,26" stroke="#3a3a42" stroke-width="5" fill="none"/>'
                    '<circle cx="138" cy="24" r="12" fill="#ffd23f"/><circle cx="138" cy="24" r="6" fill="#fff"/>', lg('dy', '#ff6b6b', '#b3101f')),
    'nugget': svg(SH + '<path d="M40,120 Q30,70 76,58 Q104,30 136,60 Q176,72 162,118 Q170,158 120,162 Q90,180 64,158 Q30,152 40,120 Z" fill="url(#nu)" stroke="#a4700f" stroke-width="4"/>'
                  '<ellipse cx="86" cy="84" rx="18" ry="10" fill="#fff" opacity="0.6"/><circle cx="128" cy="124" r="6" fill="#c98a10"/><circle cx="76" cy="130" r="5" fill="#c98a10"/>',
                  rg('nu', '#fff4b0', '#f5c842', '#b8860b')),
    'bar': svg(SH + '<path d="M30,140 L60,72 L140,72 L170,140 Z" fill="url(#gold)" stroke="#8a5a0a" stroke-width="4"/>'
               '<path d="M60,72 L140,72 L130,92 L70,92 Z" fill="#fff4b0" opacity="0.7"/><text x="100" y="128" font-family="Arial Black, Arial" font-weight="900" font-size="26" fill="#8a5a0a" text-anchor="middle">999.9</text>', GOLD),
    'wild': label_token('WILD', '#ffe08a', '#7a4a12', '#3a1a00'),
    'scatter': svg(SH + '<path d="M24,176 L24,96 Q100,10 176,96 L176,176 Z" fill="#5a3a22" stroke="#2a1a0e" stroke-width="5"/>'
                   '<path d="M50,176 L50,104 Q100,50 150,104 L150,176 Z" fill="#14100c"/>'
                   '<path d="M40,104 L160,104 M64,74 L64,176 M136,74 L136,176" stroke="#8a5a32" stroke-width="8"/>'
                   '<text x="100" y="146" font-family="Arial Black, Arial" font-weight="900" font-size="30" fill="#ffd23f" text-anchor="middle">BONUS</text>'),
}


def backdrop(name, top, mid, bottom, accent):
    rays = ''.join(f'<path d="M540,700 L{540 + math.cos(a) * 1600:.0f},{700 + math.sin(a) * 1600:.0f} L{540 + math.cos(a + 0.12) * 1600:.0f},{700 + math.sin(a + 0.12) * 1600:.0f} Z" fill="{accent}" opacity="0.07"/>'
                   for a in [i * math.tau / 24 for i in range(24)])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920"><defs>
<radialGradient id="s" cx="0.5" cy="0.36" r="0.8"><stop offset="0" stop-color="{top}"/><stop offset="0.6" stop-color="{mid}"/><stop offset="1" stop-color="{bottom}"/></radialGradient>
<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0"/></filter></defs>
<rect width="1080" height="1920" fill="url(#s)"/>{rays}<rect x="20" y="20" width="1040" height="1880" rx="40" fill="none" stroke="{accent}" stroke-width="6" opacity="0.6"/>
<rect width="1080" height="1920" filter="url(#noise)"/></svg>'''


def write_set(machine, syms):
    d = os.path.join(PUB, machine)
    os.makedirs(d, exist_ok=True)
    for k, v in syms.items():
        # unique gradient ids per file so symbols never share definitions
        for gid in ('gold', 'sc', 'py', 'gm', 'sar', 't', 'sh', 'st', 'fi', 'tu', 'oc', 'sk', 'pe', 'ch', 'ln', 'ca', 'dy', 'nu'):
            v = v.replace(f'id="{gid}"', f'id="{gid}-{machine}-{k}"').replace(f'url(#{gid})', f'url(#{gid}-{machine}-{k})')
        open(os.path.join(d, f'{k}.svg'), 'w').write(v)


write_set('pharaoh', PHARAOH)
write_set('ocean', OCEAN)
write_set('goldrush', GOLDRUSH)
# Lucky Sevens: move the original symbols into their own folder
os.makedirs(os.path.join(PUB, 'sevens'), exist_ok=True)
for f in os.listdir(PUB):
    if f.endswith('.svg'):
        shutil.move(os.path.join(PUB, f), os.path.join(PUB, 'sevens', f))
os.makedirs(OUT, exist_ok=True)
for name, cols in {'pharaoh': ('#c98a3a', '#6a3a14', '#1e0e04', '#ffd98a'), 'ocean': ('#1f7aa8', '#0b3a5c', '#04121e', '#7fe0ff'), 'goldrush': ('#8a5a2a', '#3e2412', '#120a04', '#ffc24a')}.items():
    open(os.path.join(OUT, f'bg-slots-{name}.svg'), 'w').write(backdrop(name, *cols))
print('themed slot art written')
