"""
Velvet Ace card deck, chips and slot symbols as SVG.
Writes into games/casino/public/art/{cards,chips,slots}/.
"""
import os

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'games', 'casino', 'public', 'art')
SERIF = "Georgia, 'Times New Roman', serif"

SUIT_PATH = {
    'h': 'M50,92 C22,68 0,48 0,28 C0,12 12,0 27,0 C38,0 46,7 50,16 C54,7 62,0 73,0 C88,0 100,12 100,28 C100,48 78,68 50,92 Z',
    'd': 'M50,0 L86,50 L50,100 L14,50 Z',
    's': 'M50,0 C80,26 100,44 100,62 C100,78 88,88 74,88 C64,88 56,84 53,78 C55,88 60,95 66,100 L34,100 C40,95 45,88 47,78 C44,84 36,88 26,88 C12,88 0,78 0,62 C0,44 20,26 50,0 Z',
    'c': ('M50,2 C63,2 72,12 72,24 C72,32 68,38 63,42 C67,40 71,39 75,39 C88,39 98,49 98,62 C98,75 88,85 75,85 '
          'C65,85 57,80 53,72 C55,84 60,93 67,100 L33,100 C40,93 45,84 47,72 C43,80 35,85 25,85 C12,85 2,75 2,62 '
          'C2,49 12,39 25,39 C29,39 33,40 37,42 C32,38 28,32 28,24 C28,12 37,2 50,2 Z'),
}
RED = '#c8102e'
BLACK = '#1d1d22'
RANK_LABEL = {2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'}
RANK_ID = {10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'}

PIPS = {
    2: [(100, 62), (100, 218)],
    3: [(100, 62), (100, 140), (100, 218)],
    4: [(62, 62), (138, 62), (62, 218), (138, 218)],
    5: [(62, 62), (138, 62), (100, 140), (62, 218), (138, 218)],
    6: [(62, 62), (138, 62), (62, 140), (138, 140), (62, 218), (138, 218)],
    7: [(62, 62), (138, 62), (100, 101), (62, 140), (138, 140), (62, 218), (138, 218)],
    8: [(62, 62), (138, 62), (100, 101), (62, 140), (138, 140), (100, 179), (62, 218), (138, 218)],
    9: [(62, 62), (138, 62), (62, 114), (138, 114), (100, 140), (62, 166), (138, 166), (62, 218), (138, 218)],
    10: [(62, 62), (138, 62), (100, 88), (62, 114), (138, 114), (62, 166), (138, 166), (100, 192), (62, 218), (138, 218)],
}


def suit(s, x, y, size, color, flip=False):
    """A suit symbol centered at (x, y), `size` px tall; `flip` turns it upside down (bottom-half pips)."""
    k = size / 100
    path = f'<path d="{SUIT_PATH[s]}" fill="{color}" transform="translate({x - 50 * k:.1f},{y - 50 * k:.1f}) scale({k:.3f})"/>'
    return f'<g transform="rotate(180 {x} {y})">{path}</g>' if flip else path


def corner(rank, s, color):
    label = RANK_LABEL[rank]
    size = 38 if label != '10' else 32
    out = (f'<text x="22" y="46" font-family="{SERIF}" font-weight="700" font-size="{size}" fill="{color}" text-anchor="middle">{label}</text>'
           + suit(s, 22, 66, 22, color))
    return out + f'<g transform="rotate(180 100 140)">{out}</g>'


FACE_TINT = {'h': '#fbe3e3', 'd': '#fbe8dc', 's': '#e3e6f0', 'c': '#e2ecdf'}


def face(rank, s, color):
    """Face cards: framed panel, a big serif letter, the suit, and a simple crown/tiara/cap."""
    tint = FACE_TINT[s]
    out = (f'<rect x="40" y="40" width="120" height="200" rx="10" fill="{tint}" stroke="#c9a54a" stroke-width="4"/>'
           f'<rect x="48" y="48" width="104" height="184" rx="6" fill="none" stroke="#c9a54a" stroke-width="1.5" opacity="0.7"/>')
    # headwear above the letter
    if rank == 13:  # king: crown
        out += ('<path d="M66,96 L70,66 L84,82 L100,58 L116,82 L130,66 L134,96 Z" fill="#e2b64a" stroke="#a4801f" stroke-width="2.5"/>'
                '<rect x="66" y="94" width="68" height="10" rx="2" fill="#c9a03a"/>'
                f'<circle cx="100" cy="76" r="5" fill="{color}"/><circle cx="78" cy="86" r="3.5" fill="{color}"/><circle cx="122" cy="86" r="3.5" fill="{color}"/>')
    elif rank == 12:  # queen: tiara
        out += ('<path d="M70,100 Q100,60 130,100 Q100,88 70,100 Z" fill="#e2b64a" stroke="#a4801f" stroke-width="2.5"/>'
                f'<circle cx="100" cy="74" r="7" fill="{color}"/><circle cx="84" cy="84" r="4" fill="#fff"/><circle cx="116" cy="84" r="4" fill="#fff"/>')
    else:  # jack: cap with feather
        out += (f'<path d="M70,100 Q72,70 100,68 Q128,70 130,100 Z" fill="{color}"/>'
                '<rect x="68" y="96" width="64" height="8" rx="3" fill="#e2b64a"/>'
                '<path d="M118,72 Q140,52 150,60 Q138,66 124,82 Z" fill="#e2b64a" stroke="#a4801f" stroke-width="1.5"/>')
    out += (f'<text x="100" y="178" font-family="{SERIF}" font-weight="700" font-size="84" fill="{color}" text-anchor="middle">{RANK_LABEL[rank]}</text>'
            + suit(s, 100, 210, 30, color))
    return out


def card(rank, s):
    color = RED if s in 'hd' else BLACK
    out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" width="200" height="280">',
           '<rect x="1" y="1" width="198" height="278" rx="16" fill="#fffdf8" stroke="#d8d2c4" stroke-width="2"/>']
    if rank <= 10:
        for (x, y) in PIPS[rank]:
            out.append(suit(s, x, y, 34, color, flip=y > 140))
    elif rank == 14:
        out.append(suit(s, 100, 140, 96, color))
        if s == 's':
            out.append('<circle cx="100" cy="140" r="64" fill="none" stroke="#c9a54a" stroke-width="3"/>')
    else:
        out.append(face(rank, s, color))
    out.append(corner(rank, s, color))
    out.append('</svg>')
    return ''.join(out)


def back():
    lattice = ''.join(
        f'<path d="M{x},{y - 14} L{x + 14},{y} L{x},{y + 14} L{x - 14},{y} Z" fill="none" stroke="#d9b45a" stroke-width="1.6" opacity="0.55"/>'
        for x in range(28, 180, 24) for y in range(30, 260, 24))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 280" width="200" height="280">'
            '<defs><linearGradient id="bk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a1530"/><stop offset="1" stop-color="#4a0b1d"/></linearGradient></defs>'
            '<rect x="1" y="1" width="198" height="278" rx="16" fill="#fffdf8" stroke="#d8d2c4" stroke-width="2"/>'
            '<rect x="12" y="12" width="176" height="256" rx="10" fill="url(#bk)"/>'
            f'{lattice}'
            '<rect x="12" y="12" width="176" height="256" rx="10" fill="none" stroke="#d9b45a" stroke-width="3"/>'
            '<circle cx="100" cy="140" r="34" fill="#4a0b1d" stroke="#d9b45a" stroke-width="3"/>'
            f'<text x="100" y="153" font-family="{SERIF}" font-weight="700" font-size="36" fill="#e9c86a" text-anchor="middle">VA</text>'
            '</svg>')


CHIPS = {  # value: (base, stripe, text)
    10: ('#f2f0ea', '#2a5bd7', '#2a5bd7'),
    50: ('#c8102e', '#ffffff', '#ffffff'),
    100: ('#1d1d22', '#e9c86a', '#e9c86a'),
    500: ('#6b2fb3', '#ffffff', '#ffffff'),
    1000: ('#e2b64a', '#7a1530', '#5a3a00'),
    5000: ('#0f8a7a', '#ffffff', '#ffffff'),
}


def chip(value):
    base, stripe, text = CHIPS[value]
    label = f'{value // 1000}K' if value >= 1000 else str(value)
    stripes = ''.join(
        f'<rect x="54" y="2" width="12" height="20" rx="2" fill="{stripe}" transform="rotate({a} 60 60)"/>' for a in range(0, 360, 60))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">'
            f'<circle cx="60" cy="63" r="56" fill="#000" opacity="0.3"/>'
            f'<circle cx="60" cy="60" r="56" fill="{base}"/>{stripes}'
            f'<circle cx="60" cy="60" r="40" fill="none" stroke="{stripe}" stroke-width="3" stroke-dasharray="6 5"/>'
            f'<circle cx="60" cy="60" r="34" fill="{base}"/>'
            f'<circle cx="60" cy="60" r="34" fill="#fff" opacity="0.08"/>'
            f'<text x="60" y="{71 if len(label) < 3 else 69}" font-family="Arial, sans-serif" font-weight="900" font-size="{30 if len(label) < 3 else 26}" fill="{text}" text-anchor="middle">{label}</text>'
            '</svg>')


def write(path, body):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(body)


for s in 'shdc':
    for r in range(2, 15):
        write(os.path.join(ROOT, 'cards', f'{RANK_ID.get(r, str(r))}{s}.svg'), card(r, s))
write(os.path.join(ROOT, 'cards', 'back.svg'), back())
for v in CHIPS:
    write(os.path.join(ROOT, 'chips', f'{v}.svg'), chip(v))
print('cards + chips written')
