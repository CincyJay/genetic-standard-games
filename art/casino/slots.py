"""Slot machine symbols (200x200 SVG) -> games/casino/public/art/slots/<sym>.svg"""
import os
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'games', 'casino', 'public', 'art', 'slots', 'sevens')

def svg(body, defs):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><defs>{defs}</defs>{body}</svg>'

def rg(id_, a, b, c, cx=0.38, cy=0.32):
    return f'<radialGradient id="{id_}" cx="{cx}" cy="{cy}" r="0.8"><stop offset="0" stop-color="{a}"/><stop offset="0.5" stop-color="{b}"/><stop offset="1" stop-color="{c}"/></radialGradient>'

def lg(id_, a, b, vertical=True):
    x2, y2 = ('0', '1') if vertical else ('1', '0')
    return f'<linearGradient id="{id_}" x1="0" y1="0" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{a}"/><stop offset="1" stop-color="{b}"/></linearGradient>'

SH = '<ellipse cx="100" cy="182" rx="60" ry="9" fill="#000" opacity="0.25"/>'
GLOSS = '<ellipse cx="78" cy="62" rx="26" ry="14" fill="#fff" opacity="0.55" transform="rotate(-30 78 62)"/>'

SYMS = {
 'lemon': svg(SH + '<path d="M20,100 Q30,40 100,36 Q170,40 180,100 Q170,160 100,164 Q30,160 20,100 Z" fill="url(#lemon-g)"/>'
          '<path d="M14,100 Q18,94 24,96 M186,100 Q182,106 176,104" stroke="#d1a400" stroke-width="8" stroke-linecap="round"/>'
          + GLOSS + '<path d="M128,46 Q150,30 168,40 Q152,52 128,50 Z" fill="#5aa845"/>',
          rg('lemon-g', '#fff8a6', '#ffe14a', '#d9a800')),
 'cherry': svg(SH + '<path d="M70,110 Q90,50 128,30 M128,110 Q126,60 128,30" stroke="#4e7a2a" stroke-width="7" fill="none" stroke-linecap="round"/>'
           '<path d="M128,30 Q160,20 172,38 Q150,46 128,30 Z" fill="#5aa845"/>'
           '<circle cx="66" cy="132" r="40" fill="url(#cherry-g)"/><circle cx="130" cy="138" r="40" fill="url(#cherry-g)"/>'
           '<ellipse cx="54" cy="116" rx="12" ry="7" fill="#fff" opacity="0.6" transform="rotate(-30 54 116)"/>'
           '<ellipse cx="118" cy="122" rx="12" ry="7" fill="#fff" opacity="0.6" transform="rotate(-30 118 122)"/>',
           rg('cherry-g', '#ff7a8a', '#d6182f', '#7e0b19')),
 'plum': svg(SH + '<ellipse cx="100" cy="106" rx="66" ry="70" fill="url(#plum-g)"/>'
         '<path d="M100,40 Q92,90 100,170" stroke="#3d1a5c" stroke-width="4" fill="none" opacity="0.5"/>'
         '<path d="M100,38 Q104,22 112,16" stroke="#5a3a20" stroke-width="6" fill="none" stroke-linecap="round"/>'
         '<path d="M106,30 Q132,10 150,22 Q130,34 106,30 Z" fill="#5aa845"/>' + GLOSS,
         rg('plum-g', '#c79af0', '#7b3fc0', '#3d1a6c')),
 'bell': svg(SH + '<path d="M100,24 Q56,28 50,90 Q48,128 28,150 L172,150 Q152,128 150,90 Q144,28 100,24 Z" fill="url(#bell-g)"/>'
         '<rect x="22" y="146" width="156" height="16" rx="8" fill="#b88a12"/><circle cx="100" cy="170" r="14" fill="#b88a12"/>'
         '<circle cx="100" cy="20" r="9" fill="#b88a12"/>'
         '<path d="M74,60 Q68,100 60,132" stroke="#fff" stroke-width="10" opacity="0.5" fill="none" stroke-linecap="round"/>',
         rg('bell-g', '#fff4b0', '#ffd23f', '#c98a10')),
 'bar': svg(SH + '<rect x="16" y="62" width="168" height="76" rx="12" fill="url(#bar-g)" stroke="#1d1d22" stroke-width="6"/>'
        '<text x="100" y="122" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="56" fill="#fff" text-anchor="middle" letter-spacing="4">BAR</text>'
        '<rect x="22" y="68" width="156" height="16" rx="6" fill="#fff" opacity="0.25"/>',
        lg('bar-g', '#3d3d48', '#0e0e12')),
 'seven': svg(SH + '<path d="M40,30 L166,30 L166,56 Q116,104 102,172 L62,172 Q74,108 122,62 L40,62 Z" fill="url(#seven-g)" stroke="#7a0b19" stroke-width="7" stroke-linejoin="round"/>'
          '<path d="M50,38 L156,38 L156,48 L50,48 Z" fill="#fff" opacity="0.45"/>',
          lg('seven-g', '#ff5b6e', '#b3101f')),
 'diamond': svg(SH + '<path d="M100,170 L18,74 L52,32 L148,32 L182,74 Z" fill="url(#dia-g)" stroke="#1a6fa8" stroke-width="4" stroke-linejoin="round"/>'
            '<path d="M18,74 L182,74 M52,32 L76,74 L100,170 L124,74 L148,32 M76,74 L100,32 L124,74" stroke="#ffffff" stroke-width="3" opacity="0.6" fill="none"/>'
            '<path d="M52,32 L100,32 L76,74 L18,74 Z" fill="#fff" opacity="0.35"/>',
            lg('dia-g', '#bff0ff', '#2f9bd9')),
 'wild': svg('<circle cx="100" cy="100" r="92" fill="url(#wild-glow)"/>' + SH +
         '<path d="M100,14 L124,72 L186,76 L138,116 L154,178 L100,144 L46,178 L62,116 L14,76 L76,72 Z" fill="url(#wild-g)" stroke="#a4700f" stroke-width="5" stroke-linejoin="round"/>'
         '<text x="100" y="122" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="38" fill="#7a1530" text-anchor="middle">WILD</text>',
         lg('wild-g', '#fff4b0', '#e9a91c') + '<radialGradient id="wild-glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffe680" stop-opacity="0.8"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>'),
 'scatter': svg(SH + '<circle cx="100" cy="98" r="78" fill="#a4700f"/><circle cx="100" cy="94" r="78" fill="url(#coin-g)"/>'
            '<circle cx="100" cy="94" r="62" fill="none" stroke="#a4700f" stroke-width="4" stroke-dasharray="4 6"/>'
            '<text x="100" y="88" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="30" fill="#7a1530" text-anchor="middle">FREE</text>'
            '<text x="100" y="122" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="28" fill="#7a1530" text-anchor="middle">SPINS</text>'
            '<ellipse cx="72" cy="54" rx="22" ry="10" fill="#fff" opacity="0.6" transform="rotate(-25 72 54)"/>',
            rg('coin-g', '#fff4b0', '#f5c842', '#c98a10')),
}
os.makedirs(OUT, exist_ok=True)
for k, v in SYMS.items():
    open(os.path.join(OUT, f'{k}.svg'), 'w').write(v)
print(len(SYMS), 'symbols')
