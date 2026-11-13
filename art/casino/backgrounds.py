"""Full-screen casino backdrops (1080x1920 SVG) -> art/casino/out/*.svg, rendered to JPEG by art/casino/build.mjs"""
import os, random, math
OUT = os.path.join(os.path.dirname(__file__), 'out')
W, H = 1080, 1920
NOISE = '<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.09 0"/></filter>'

def lobby():
    rr = random.Random(5)
    bokeh = ''.join(f'<circle cx="{rr.uniform(0,W):.0f}" cy="{rr.uniform(0,H):.0f}" r="{rr.uniform(20,90):.0f}" fill="{rr.choice(["#ffcf6a","#ff7ab0","#b48cff"])}" opacity="{rr.uniform(0.04,0.12):.2f}"/>' for _ in range(40))
    lattice = ''.join(f'<path d="M{x},{y-40} L{x+40},{y} L{x},{y+40} L{x-40},{y} Z" fill="none" stroke="#e9c86a" stroke-width="1.2" opacity="0.07"/>' for x in range(0, W + 80, 80) for y in range(0, H + 80, 80))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><defs>
<radialGradient id="v" cx="0.5" cy="0.32" r="0.85"><stop offset="0" stop-color="#5a1f6e"/><stop offset="0.55" stop-color="#2e1040"/><stop offset="1" stop-color="#14071f"/></radialGradient>
<radialGradient id="spot" cx="0.5" cy="0" r="0.6"><stop offset="0" stop-color="#ffd98a" stop-opacity="0.35"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
<filter id="blur"><feGaussianBlur stdDeviation="8"/></filter>{NOISE}</defs>
<rect width="{W}" height="{H}" fill="url(#v)"/>{lattice}<g filter="url(#blur)">{bokeh}</g>
<ellipse cx="540" cy="0" rx="700" ry="760" fill="url(#spot)"/>
<rect width="{W}" height="{H}" filter="url(#noise)"/></svg>'''

def felt(c1, c2, c3):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><defs>
<radialGradient id="f" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="{c1}"/><stop offset="0.6" stop-color="{c2}"/><stop offset="1" stop-color="{c3}"/></radialGradient>
<radialGradient id="lamp" cx="0.5" cy="0.42" r="0.5"><stop offset="0" stop-color="#fff6d8" stop-opacity="0.16"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>
{NOISE}</defs><rect width="{W}" height="{H}" fill="url(#f)"/><rect width="{W}" height="{H}" filter="url(#noise)"/>
<ellipse cx="540" cy="820" rx="760" ry="900" fill="url(#lamp)"/></svg>'''

def slots_bg():
    bulbs = ''
    for k in range(0, 27):
        x = 40 + k * 38.5
        for y in (40, 1880):
            bulbs += f'<circle cx="{x:.0f}" cy="{y}" r="9" fill="#ffe08a"/><circle cx="{x:.0f}" cy="{y}" r="18" fill="#ffe08a" opacity="0.2"/>'
    for k in range(1, 49):
        y = 40 + k * 38.4
        for x in (40, 1040):
            bulbs += f'<circle cx="{x}" cy="{y:.0f}" r="9" fill="#ffe08a"/><circle cx="{x}" cy="{y:.0f}" r="18" fill="#ffe08a" opacity="0.2"/>'
    rays = ''.join(f'<path d="M540,700 L{540 + math.cos(a)*1600:.0f},{700 + math.sin(a)*1600:.0f} L{540 + math.cos(a+0.12)*1600:.0f},{700 + math.sin(a+0.12)*1600:.0f} Z" fill="#ff9ad5" opacity="0.06"/>'
                   for a in [i * math.tau / 24 for i in range(24)])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><defs>
<radialGradient id="s" cx="0.5" cy="0.36" r="0.8"><stop offset="0" stop-color="#7a2a8f"/><stop offset="0.6" stop-color="#3a1050"/><stop offset="1" stop-color="#16061f"/></radialGradient>{NOISE}</defs>
<rect width="{W}" height="{H}" fill="url(#s)"/>{rays}<rect x="20" y="20" width="1040" height="1880" rx="40" fill="none" stroke="#c9a03a" stroke-width="8"/>{bulbs}
<rect width="{W}" height="{H}" filter="url(#noise)"/></svg>'''

os.makedirs(OUT, exist_ok=True)
jobs = {'bg-lobby': lobby(), 'bg-felt': felt('#1f8a57', '#0f5a3a', '#06301e'), 'bg-felt-red': felt('#a3283f', '#6e1428', '#360812'), 'bg-slots': slots_bg()}
for k, v in jobs.items():
    open(os.path.join(OUT, f'{k}.svg'), 'w').write(v)
print('ok')
