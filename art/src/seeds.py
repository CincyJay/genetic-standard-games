"""
Seed sprites for the conveyor game, plus weed, rock and golden seed.
Writes games/seed-sort/public/art/item-<id>.svg (160x120 each).
Lit from the upper right like every other scene.
"""
import os, random, math

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'games', 'seed-sort', 'public', 'art')

def svg(body, defs=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120"><defs>{defs}</defs>{body}</svg>'

def rg(id_, light, mid, dark, cx=0.62, cy=0.32):
    return (f'<radialGradient id="{id_}" cx="{cx}" cy="{cy}" r="0.75">'
            f'<stop offset="0" stop-color="{light}"/><stop offset="0.45" stop-color="{mid}"/><stop offset="1" stop-color="{dark}"/></radialGradient>')

SHADOW = '<ellipse cx="80" cy="102" rx="46" ry="8" fill="#000" opacity="0.18"/>'

def kidney(light, mid, dark, extra=''):
    d = 'M28,62 C26,30 62,22 80,36 C90,44 102,28 118,32 C140,40 138,86 104,94 C70,102 30,96 28,62 Z'
    return svg(SHADOW + f'<path d="{d}" fill="url(#g)"/>' + extra +
               '<ellipse cx="96" cy="44" rx="16" ry="6" fill="#fff" opacity="0.45" transform="rotate(-12 96 44)"/>'
               '<path d="M74,40 Q80,46 88,40" stroke="#fff" stroke-width="3" fill="none" opacity="0.55"/>',
               rg('g', light, mid, dark))

def oval(light, mid, dark, extra='', rx=50, ry=32):
    return svg(SHADOW + f'<ellipse cx="80" cy="62" rx="{rx}" ry="{ry}" fill="url(#g)"/>' + extra +
               f'<ellipse cx="{80 + rx*0.3:.0f}" cy="{62 - ry*0.5:.0f}" rx="{rx*0.32:.0f}" ry="{ry*0.18:.0f}" fill="#fff" opacity="0.4" transform="rotate(-10 {80 + rx*0.3:.0f} {62 - ry*0.5:.0f})"/>',
               rg('g', light, mid, dark))

def kernel(light, mid, dark):
    d = 'M50,28 Q80,16 110,28 Q116,52 104,86 Q80,104 56,86 Q44,52 50,28 Z'
    return svg(SHADOW + f'<path d="{d}" fill="url(#g)"/>'
               '<path d="M56,32 Q80,24 104,32 Q100,44 80,46 Q60,44 56,32 Z" fill="#fff" opacity="0.35"/>'
               '<path d="M80,50 L80,84" stroke="#000" stroke-width="3" opacity="0.12"/>'
               '<ellipse cx="96" cy="58" rx="6" ry="14" fill="#fff" opacity="0.3"/>',
               rg('g', light, mid, dark))

def speckles(color, n, seed, rx=46, ry=28, size=(3, 7), streaky=False):
    rr = random.Random(seed)
    out = ''
    for _ in range(n):
        a, d = rr.random() * math.tau, math.sqrt(rr.random()) * 0.85
        x, y = 80 + math.cos(a) * rx * d, 62 + math.sin(a) * ry * d
        s = rr.uniform(*size)
        if streaky:
            out += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{s*1.8:.1f}" ry="{s*0.6:.1f}" fill="{color}" opacity="0.8" transform="rotate({rr.uniform(-40,40):.0f} {x:.1f} {y:.1f})"/>'
        else:
            out += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{s/2:.1f}" fill="{color}" opacity="0.85"/>'
    return out

ITEMS = {
    # id: svg
    'redbean': kidney('#f0626a', '#c42a35', '#7c1620'),
    'corn': kernel('#fff1a0', '#f5c430', '#c98a10'),
    'pea': svg(SHADOW + '<circle cx="80" cy="60" r="38" fill="url(#g)"/><circle cx="94" cy="44" r="10" fill="#fff" opacity="0.45"/><path d="M58,72 Q64,80 72,82" stroke="#2f6b1f" stroke-width="3" fill="none" opacity="0.5"/>',
               rg('g', '#c7f08a', '#78c043', '#3c7a20')),
    'sunflower': svg(SHADOW + '<path d="M26,62 Q52,28 132,52 Q144,62 132,70 Q52,96 26,62 Z" fill="url(#g)"/>'
                     '<path d="M36,62 Q80,50 128,58 M38,68 Q80,64 126,66 M42,56 Q80,40 124,52" stroke="#e8e4d6" stroke-width="4" fill="none" opacity="0.85"/>'
                     '<ellipse cx="104" cy="50" rx="16" ry="4" fill="#fff" opacity="0.3" transform="rotate(8 104 50)"/>',
                     rg('g', '#6b6b70', '#3a3a40', '#18181c')),
    'pumpkin': svg(SHADOW + '<path d="M24,62 Q30,30 84,30 Q128,32 138,62 Q128,92 84,94 Q30,94 24,62 Z" fill="url(#g)"/>'
                   '<path d="M34,62 Q40,40 84,40 Q120,42 128,62 Q120,84 84,84 Q40,84 34,62 Z" fill="none" stroke="#c8b48a" stroke-width="3"/>'
                   '<ellipse cx="100" cy="46" rx="18" ry="5" fill="#fff" opacity="0.5"/>',
                   rg('g', '#fffaf0', '#efe2bf', '#c9b48a')),
    'blackbean': oval('#6a6a78', '#2c2c36', '#0e0e14', '<path d="M60,58 Q80,52 100,58" stroke="#f4f4f0" stroke-width="5" fill="none" stroke-linecap="round"/>', 46, 30),
    'lentil': svg(SHADOW + '<ellipse cx="80" cy="66" rx="46" ry="26" fill="#b8571a"/><ellipse cx="80" cy="60" rx="46" ry="26" fill="url(#g)"/><ellipse cx="96" cy="50" rx="14" ry="5" fill="#fff" opacity="0.4"/>',
                  rg('g', '#ffc08a', '#f2843a', '#c45a18')),
    'runner': kidney('#c99af0', '#8a4fc0', '#4f2478', speckles('#2a123e', 14, 3, 40, 24, (5, 11))),
    'pinto': oval('#f4e2c4', '#ddc196', '#a88a5c', speckles('#7a4a2a', 22, 5, 44, 26, (3, 8), streaky=True), 48, 30),
    'acorn': svg(SHADOW + '<path d="M44,54 Q46,96 80,100 Q114,96 116,54 Z" fill="url(#g)"/>'
                 '<ellipse cx="100" cy="72" rx="8" ry="16" fill="#fff" opacity="0.25"/>'
                 '<path d="M38,56 Q40,26 80,24 Q120,26 122,56 Q80,64 38,56 Z" fill="#7a5532"/>'
                 '<path d="M48,34 L112,50 M44,46 L116,40 M60,28 L66,58 M80,26 L80,60 M100,28 L94,58" stroke="#5b3d22" stroke-width="2.5" opacity="0.8"/>'
                 '<path d="M80,24 Q82,12 90,8" stroke="#5b3d22" stroke-width="5" fill="none" stroke-linecap="round"/>',
                 rg('g', '#e0a46a', '#b8743a', '#7a4620')),
    'cranberry': oval('#fff0ea', '#f2c9c4', '#c9908c', speckles('#c0283a', 16, 9, 44, 26, (4, 9), streaky=True), 48, 30),
    'bluecorn': kernel('#a8b8ff', '#4d5fc8', '#24307a'),
    # specials
    'golden': svg('<circle cx="80" cy="62" r="54" fill="url(#glow)"/>' + SHADOW +
                  '<ellipse cx="80" cy="62" rx="46" ry="32" fill="url(#g)"/><ellipse cx="96" cy="48" rx="16" ry="6" fill="#fff" opacity="0.7"/>'
                  '<path d="M124,26 L128,36 L138,40 L128,44 L124,54 L120,44 L110,40 L120,36 Z" fill="#fff"/>'
                  '<path d="M38,82 L40,87 L45,89 L40,91 L38,96 L36,91 L31,89 L36,87 Z" fill="#fff" opacity="0.9"/>',
                  rg('g', '#fff7c2', '#ffd23f', '#c98a10') +
                  '<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffe680" stop-opacity="0.7"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>'),
    'rock': svg(SHADOW + '<path d="M30,80 Q24,52 48,38 Q70,24 98,32 Q130,40 132,70 Q130,92 100,96 Q56,100 30,80 Z" fill="url(#g)"/>'
                '<path d="M60,46 Q74,40 90,44" stroke="#fff" stroke-width="4" opacity="0.35" fill="none"/>'
                '<path d="M92,60 L104,72 L98,84" stroke="#4a4e52" stroke-width="3" fill="none" opacity="0.6"/>',
                rg('g', '#c9cdd0', '#8e9499', '#55595d')),
    'weed': svg('<ellipse cx="80" cy="96" rx="40" ry="10" fill="#6b4a2e"/><ellipse cx="80" cy="92" rx="34" ry="8" fill="#8a6440"/>'
                '<path d="M80,92 Q76,60 80,22" stroke="#4f7f2a" stroke-width="5" fill="none"/>'
                '<path d="M80,70 Q50,64 40,44 Q66,46 80,66 Z" fill="#6aa83a"/>'
                '<path d="M80,56 Q110,52 122,30 Q96,32 80,52 Z" fill="#7cbc45"/>'
                '<path d="M80,40 Q60,30 58,12 Q76,20 80,36 Z" fill="#5c9a30"/>'
                '<path d="M76,96 L66,110 M84,96 L92,112 M80,98 L80,114" stroke="#c9a77a" stroke-width="2.5"/>'),
}

os.makedirs(OUT, exist_ok=True)
for k, v in ITEMS.items():
    # unique gradient ids per sprite, so sprites never share definitions when inlined together
    v = v.replace('id="g"', f'id="g-{k}"').replace('url(#g)', f'url(#g-{k})').replace('id="glow"', f'id="glow-{k}"').replace('url(#glow)', f'url(#glow-{k})')
    open(os.path.join(OUT, f'item-{k}.svg'), 'w').write(v)
print(len(ITEMS), 'items')
