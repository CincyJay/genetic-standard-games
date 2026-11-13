"""
Hold'em table backdrop (art/casino/out/bg-poker.svg -> JPEG via build.mjs) and player
portraits (games/casino/public/art/avatars/<name>.svg).
Premium, muted look: dark room, leather rail, walnut trim, spotlit felt.
"""
import os, random

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, 'out')
AV = os.path.join(HERE, '..', '..', 'games', 'casino', 'public', 'art', 'avatars')
W, H = 1080, 1920
CX, CY = 540, 960


def table():
    rr = random.Random(2)
    stitches = ''.join(
        f'<ellipse cx="{CX}" cy="{CY + 4}" rx="{472}" ry="{790}" fill="none" stroke="#a88a5a" stroke-width="2.4" stroke-dasharray="10 9" opacity="0.55"/>'
        for _ in range(1))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs>
  <radialGradient id="room" cx="0.5" cy="0.45" r="0.8"><stop offset="0" stop-color="#2a2026"/><stop offset="0.6" stop-color="#140f13"/><stop offset="1" stop-color="#070507"/></radialGradient>
  <radialGradient id="felt" cx="0.5" cy="0.42" r="0.62"><stop offset="0" stop-color="#1d7a5a"/><stop offset="0.55" stop-color="#11533d"/><stop offset="1" stop-color="#082a1f"/></radialGradient>
  <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a22"/><stop offset="0.45" stop-color="#1c1411"/><stop offset="1" stop-color="#0c0807"/></linearGradient>
  <linearGradient id="railHi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.3" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5a32"/><stop offset="0.5" stop-color="#5e3a1e"/><stop offset="1" stop-color="#3a2210"/></linearGradient>
  <radialGradient id="spot" cx="0.5" cy="0.4" r="0.5"><stop offset="0" stop-color="#fff3d6" stop-opacity="0.22"/><stop offset="1" stop-color="#fff3d6" stop-opacity="0"/></radialGradient>
  <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0"/></filter>
  <filter id="soft"><feGaussianBlur stdDeviation="22"/></filter>
  <clipPath id="feltClip"><ellipse cx="{CX}" cy="{CY - 6}" rx="400" ry="712"/></clipPath>
</defs>
<rect width="{W}" height="{H}" fill="url(#room)"/>
<rect width="{W}" height="{H}" filter="url(#noise)" opacity="0.6"/>
<!-- shadow under the table -->
<ellipse cx="{CX}" cy="{CY + 60}" rx="540" ry="850" fill="#000" opacity="0.65" filter="url(#soft)"/>
<!-- padded leather rail (thicker toward the viewer) -->
<ellipse cx="{CX}" cy="{CY + 14}" rx="510" ry="842" fill="#050303"/>
<ellipse cx="{CX}" cy="{CY}" rx="508" ry="832" fill="url(#rail)"/>
<ellipse cx="{CX}" cy="{CY}" rx="508" ry="832" fill="url(#railHi)"/>
{stitches}
<!-- walnut racetrack -->
<ellipse cx="{CX}" cy="{CY - 4}" rx="428" ry="742" fill="url(#wood)"/>
<ellipse cx="{CX}" cy="{CY - 4}" rx="428" ry="742" fill="none" stroke="#c08a52" stroke-width="2" opacity="0.6"/>
<!-- felt -->
<ellipse cx="{CX}" cy="{CY - 6}" rx="400" ry="712" fill="url(#felt)"/>
<g clip-path="url(#feltClip)"><rect width="{W}" height="{H}" filter="url(#noise)"/></g>
<ellipse cx="{CX}" cy="{CY - 6}" rx="400" ry="712" fill="url(#spot)"/>
<ellipse cx="{CX}" cy="{CY - 6}" rx="330" ry="600" fill="none" stroke="#d9c38f" stroke-width="2" opacity="0.18"/>
<ellipse cx="{CX}" cy="{CY - 6}" rx="400" ry="712" fill="none" stroke="#000" stroke-width="10" opacity="0.35"/>
<text x="{CX}" y="{CY + 210}" font-family="Georgia, serif" font-size="44" letter-spacing="14" fill="#d9c38f" opacity="0.14" text-anchor="middle">VELVET ACE</text>
</svg>'''


# --------------------------------------------------------------- portraits
SKINS = {'light': ('#f1c7a8', '#d9a383'), 'tan': ('#d6a07a', '#b8825c'), 'brown': ('#a86a45', '#8a5234'), 'deep': ('#6e4129', '#56301d')}


def avatar(skin, hair_color, top, shirt, bg, extras=()):
    s, sd = SKINS[skin]
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">',
             f'<defs><clipPath id="c"><circle cx="120" cy="120" r="120"/></clipPath>'
             f'<radialGradient id="b" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="{bg[0]}"/><stop offset="1" stop-color="{bg[1]}"/></radialGradient></defs>',
             '<g clip-path="url(#c)">', '<rect width="240" height="240" fill="url(#b)"/>']
    # back hair (long styles)
    if top in ('long', 'bob', 'curly'):
        w = {'long': 92, 'bob': 80, 'curly': 96}[top]
        h = {'long': 150, 'bob': 100, 'curly': 120}[top]
        parts.append(f'<ellipse cx="120" cy="{100 + h / 3}" rx="{w}" ry="{h / 1.4}" fill="{hair_color}"/>')
    # shoulders / shirt
    parts.append(f'<path d="M20,240 C24,190 70,170 120,170 C170,170 216,190 220,240 Z" fill="{shirt[0]}"/>')
    parts.append(f'<path d="M95,172 L120,206 L145,172 Z" fill="{shirt[1]}"/>')
    parts.append(f'<rect x="102" y="140" width="36" height="40" rx="14" fill="{sd}"/>')
    # head
    parts.append(f'<ellipse cx="72" cy="112" rx="10" ry="15" fill="{sd}"/><ellipse cx="168" cy="112" rx="10" ry="15" fill="{sd}"/>')
    parts.append(f'<ellipse cx="120" cy="104" rx="48" ry="56" fill="{s}"/>')
    parts.append(f'<ellipse cx="138" cy="112" rx="26" ry="40" fill="{sd}" opacity="0.18"/>')
    # front hair
    if top == 'short':
        parts.append(f'<path d="M70,98 Q70,46 120,44 Q170,46 170,98 Q160,70 120,68 Q86,70 70,98 Z" fill="{hair_color}"/>')
    elif top == 'long':
        parts.append(f'<path d="M68,110 Q66,44 120,42 Q174,44 172,110 Q166,74 134,62 Q100,82 72,92 Z" fill="{hair_color}"/>')
    elif top == 'bob':
        parts.append(f'<path d="M66,120 Q62,42 120,40 Q178,42 174,120 L160,120 Q164,80 120,66 Q78,80 82,120 Z" fill="{hair_color}"/>')
    elif top == 'curly':
        for i in range(11):
            x = 70 + i * 10
            parts.append(f'<circle cx="{x}" cy="{58 + abs(5 - i) * 4}" r="16" fill="{hair_color}"/>')
    elif top == 'bald':
        parts.append(f'<ellipse cx="104" cy="66" rx="16" ry="8" fill="#fff" opacity="0.25"/>')
        parts.append(f'<path d="M72,100 Q72,86 78,80 L78,104 Z M168,100 Q168,86 162,80 L162,104 Z" fill="{hair_color}"/>')
    # face
    parts.append('<ellipse cx="102" cy="106" rx="5" ry="6" fill="#2a1d1a"/><ellipse cx="138" cy="106" rx="5" ry="6" fill="#2a1d1a"/>')
    parts.append(f'<path d="M92,94 L110,92 M130,92 L148,94" stroke="{hair_color if top != "bald" else "#5a4a40"}" stroke-width="4" stroke-linecap="round"/>')
    parts.append(f'<path d="M120,110 Q116,124 112,128 Q120,132 128,128" stroke="{sd}" stroke-width="3.5" fill="none"/>')
    parts.append('<path d="M106,140 Q120,146 134,140" stroke="#7a3f33" stroke-width="4" fill="none" stroke-linecap="round"/>')
    for e in extras:
        if e == 'glasses':
            parts.append('<g fill="none" stroke="#1d1d22" stroke-width="4"><rect x="86" y="96" width="30" height="22" rx="8"/><rect x="124" y="96" width="30" height="22" rx="8"/><path d="M116,104 L124,104"/></g>')
        elif e == 'beard':
            parts.append(f'<path d="M74,118 Q78,170 120,174 Q162,170 166,118 Q160,150 134,150 Q120,144 106,150 Q80,150 74,118 Z" fill="{hair_color}"/>')
        elif e == 'mustache':
            parts.append(f'<path d="M100,134 Q120,124 140,134 Q132,140 120,134 Q108,140 100,134 Z" fill="{hair_color}"/>')
        elif e == 'fedora':
            parts.append('<ellipse cx="120" cy="64" rx="84" ry="16" fill="#2b2b33"/><path d="M78,64 Q80,20 120,22 Q160,20 162,64 Z" fill="#33333d"/><rect x="80" y="50" width="80" height="10" fill="#7a1530"/>')
        elif e == 'cap':
            parts.append('<path d="M70,82 Q72,36 120,34 Q168,36 170,82 Z" fill="#c8102e"/><path d="M118,76 Q180,72 196,90 Q160,90 118,86 Z" fill="#a00d24"/>')
        elif e == 'earrings':
            parts.append('<circle cx="72" cy="130" r="7" fill="none" stroke="#e9c86a" stroke-width="3"/><circle cx="168" cy="130" r="7" fill="none" stroke="#e9c86a" stroke-width="3"/>')
        elif e == 'shades':
            parts.append('<path d="M84,66 Q120,54 156,66 L152,78 Q120,70 88,78 Z" fill="#1d1d22"/>')
        elif e == 'headphones':
            parts.append('<path d="M66,104 Q66,30 120,30 Q174,30 174,104" stroke="#1d1d22" stroke-width="9" fill="none"/><rect x="56" y="96" width="20" height="36" rx="8" fill="#2fd6c3"/><rect x="164" y="96" width="20" height="36" rx="8" fill="#2fd6c3"/>')
    parts.append('</g>')
    parts.append('<circle cx="120" cy="120" r="117" fill="none" stroke="#000" stroke-opacity="0.25" stroke-width="6"/>')
    parts.append('</svg>')
    return ''.join(parts)


AVATARS = {
    'rosa': avatar('tan', '#8a2a1a', 'curly', ('#7a1530', '#f2e6d8'), ('#5a3a48', '#2a1a22'), ('earrings',)),
    'dmitri': avatar('light', '#7a6a5a', 'bald', ('#2b3a55', '#e9e6df'), ('#3a4a5a', '#1a222a'), ('glasses', 'beard')),
    'kwame': avatar('deep', '#1a1210', 'short', ('#1f2a24', '#d9c38f'), ('#3a4a3a', '#1a221a'), ()),
    'lena': avatar('light', '#e3c27a', 'bob', ('#3a2a4a', '#f2f2f2'), ('#4a3a5a', '#221a2a'), ('shades',)),
    'hector': avatar('tan', '#c9c4bc', 'short', ('#4a3a2a', '#e9e6df'), ('#4a3a2a', '#221a12'), ('mustache', 'fedora')),
    'priya': avatar('brown', '#1a1210', 'long', ('#0f6a5a', '#e9e6df'), ('#2a4a4a', '#122222'), ('earrings',)),
    'sam': avatar('brown', '#2a1d1a', 'short', ('#3a3a42', '#55555f'), ('#3a3a42', '#1a1a20'), ('cap',)),
    'yuki': avatar('light', '#1a1416', 'bob', ('#5a1f2a', '#f2e6d8'), ('#4a2a32', '#22121a'), ('headphones',)),
    'you': avatar('tan', '#3a2a22', 'short', ('#1d1d22', '#c9a96a'), ('#5a4a2a', '#2a2012'), ()),
}

os.makedirs(OUT, exist_ok=True)
os.makedirs(AV, exist_ok=True)
open(os.path.join(OUT, 'bg-poker.svg'), 'w').write(table())
for k, v in AVATARS.items():
    open(os.path.join(AV, f'{k}.svg'), 'w').write(v.replace('id="c"', f'id="c-{k}"').replace('url(#c)', f'url(#c-{k})').replace('id="b"', f'id="b-{k}"').replace('url(#b)', f'url(#b-{k})'))
print('poker art written')
