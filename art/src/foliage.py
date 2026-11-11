"""
Shared plant drawing for all garden scenes: trees, bushes, hedges, flowers, grass.

Everything is lit from the upper right (the scene's sun). Foliage is built from
many small leaf clusters shaded by how much they face the light, drawn dark to
light so the sunlit clusters sit on top. That layering is what makes it read as
leaves instead of a smooth blob.
"""
import math
import random

LIGHT = (0.62, -0.78)  # direction toward the sun (x right, y up is negative)

# Five-step palettes, dark -> light
GREEN = ['#24481f', '#33622c', '#447a38', '#5b9447', '#79b05a', '#9dcb73']
DRY = ['#3d4722', '#525d2b', '#687434', '#7e8a3f', '#97a14d', '#b1b562']
HEDGE = ['#1f4220', '#2c5a2a', '#3b7034', '#4f8742', '#68a052', '#86b862']
BARK = ('#4a3426', '#5f4431', '#7a5a40')


def _blob(cx, cy, r, n, jitter, squash, rr):
    pts = []
    for i in range(n):
        a = i / n * math.tau
        k = 1 + rr.uniform(-jitter, jitter)
        pts.append((cx + math.cos(a) * r * k, cy + math.sin(a) * r * k * squash))
    d = ''
    for i in range(n):
        p1, p2 = pts[(i + 1) % n], pts[(i + 2) % n]
        if i == 0:
            p0 = pts[0]
            d += f'M{(p0[0] + p1[0]) / 2:.1f},{(p0[1] + p1[1]) / 2:.1f} '
        d += f'Q{p1[0]:.1f},{p1[1]:.1f} {(p1[0] + p2[0]) / 2:.1f},{(p1[1] + p2[1]) / 2:.1f} '
    return d + 'Z'


def leafy(cx, cy, r, rr, squash=0.9):
    """A cluster outline with a ragged, leafy edge."""
    return _blob(cx, cy, r, 14, 0.3, squash, rr)


def foliage(cx, cy, rx, ry, pal, seed, density=1.0):
    """A mass of leaves: dark core, shaded clusters, sunlit leaf highlights."""
    rr = random.Random(seed)
    out = [f'<path d="{_blob(cx, cy + ry * 0.05, rx, 16, 0.12, ry / rx, rr)}" fill="{pal[0]}"/>']
    n = max(10, int(rx * ry / 260 * density))
    clusters = []
    for _ in range(n):
        a = rr.random() * math.tau
        d = math.sqrt(rr.random()) * 0.82
        ox, oy = math.cos(a) * d, math.sin(a) * d
        x, y = cx + ox * rx, cy + oy * ry
        # how much this cluster faces the sun, plus a little "top of crown" bias
        lit = ox * LIGHT[0] + oy * LIGHT[1] * 1.1 - oy * 0.25 + rr.uniform(-0.25, 0.25)
        r = rx * rr.uniform(0.15, 0.27)
        clusters.append((lit, x, y, r))
    clusters.sort()
    for lit, x, y, r in clusters:
        idx = max(1, min(4, int((lit + 1.1) / 2.2 * 4) + 1))
        out.append(f'<path d="{leafy(x, y, r, rr)}" fill="{pal[idx]}"/>')
    # individual sunlit leaves on the brightest side
    for lit, x, y, r in clusters[-max(4, n // 3):]:
        for _ in range(3):
            lx, ly = x + rr.uniform(-r, r) * 0.7, y + rr.uniform(-r, r) * 0.6
            ang = rr.uniform(-60, 20)
            out.append(f'<ellipse cx="{lx:.1f}" cy="{ly:.1f}" rx="{r * 0.28:.1f}" ry="{r * 0.13:.1f}" fill="{pal[5]}" opacity="0.85" transform="rotate({ang:.0f} {lx:.1f} {ly:.1f})"/>')
    # a few dark gaps between clusters for depth
    for lit, x, y, r in clusters[: max(2, n // 6)]:
        out.append(f'<ellipse cx="{x:.1f}" cy="{y + r * 0.3:.1f}" rx="{r * 0.35:.1f}" ry="{r * 0.2:.1f}" fill="{pal[0]}" opacity="0.8"/>')
    return ''.join(out)


def tree(x, ground, height, crown, pal=GREEN, seed=1):
    """Deciduous tree: tapered trunk, a few branches, crown of several foliage masses."""
    rr = random.Random(seed)
    tw = crown * 0.16
    top = ground - height
    out = [f'<ellipse cx="{x - crown * 0.35:.1f}" cy="{ground:.1f}" rx="{crown * 0.9:.1f}" ry="{crown * 0.16:.1f}" fill="#1d3a1a" opacity="0.28"/>']
    # trunk (lit on the right)
    out.append(f'<path d="M{x - tw:.1f},{ground} Q{x - tw * 0.6:.1f},{(ground + top) / 2:.1f} {x - tw * 0.4:.1f},{top + crown * 0.3:.1f} L{x + tw * 0.4:.1f},{top + crown * 0.3:.1f} Q{x + tw * 0.6:.1f},{(ground + top) / 2:.1f} {x + tw:.1f},{ground} Z" fill="{BARK[1]}"/>')
    out.append(f'<path d="M{x + tw * 0.1:.1f},{ground} Q{x + tw * 0.3:.1f},{(ground + top) / 2:.1f} {x + tw * 0.25:.1f},{top + crown * 0.3:.1f} L{x + tw * 0.4:.1f},{top + crown * 0.3:.1f} Q{x + tw * 0.6:.1f},{(ground + top) / 2:.1f} {x + tw:.1f},{ground} Z" fill="{BARK[2]}"/>')
    # root flare
    out.append(f'<path d="M{x - tw * 1.6:.1f},{ground} Q{x - tw:.1f},{ground - tw * 0.6:.1f} {x - tw * 0.8:.1f},{ground - tw * 1.4:.1f} L{x + tw * 0.8:.1f},{ground - tw * 1.4:.1f} Q{x + tw:.1f},{ground - tw * 0.6:.1f} {x + tw * 1.6:.1f},{ground} Z" fill="{BARK[1]}"/>')
    masses = [(0, -0.05, 0.62)]
    for k in range(4):
        side = -1 if k % 2 == 0 else 1
        masses.append((side * rr.uniform(0.35, 0.55), rr.uniform(-0.3, 0.25), rr.uniform(0.42, 0.55)))
    # branches to each mass
    for mx, my, _ in masses[1:]:
        bx, by = x + mx * crown * 0.8, top + crown * 0.55 + my * crown
        out.append(f'<path d="M{x:.1f},{top + crown * 0.9:.1f} Q{x + mx * crown * 0.3:.1f},{top + crown * 0.8:.1f} {bx:.1f},{by:.1f}" stroke="{BARK[0]}" stroke-width="{tw * 0.45:.1f}" fill="none" stroke-linecap="round"/>')
    # back masses first (darker), then front
    for i, (mx, my, s) in sorted(enumerate(masses), key=lambda t: -t[1][1]):
        cx, cy = x + mx * crown, top + crown * 0.45 + my * crown
        out.append(foliage(cx, cy, crown * s, crown * s * 0.82, pal, seed * 31 + i))
    return ''.join(out)


def bush(cx, cy, r, pal=GREEN, seed=1):
    out = f'<ellipse cx="{cx - r * 0.2:.1f}" cy="{cy + r * 0.62:.1f}" rx="{r * 1.1:.1f}" ry="{r * 0.2:.1f}" fill="#1d3a1a" opacity="0.3"/>'
    return out + foliage(cx, cy, r, r * 0.74, pal, seed)


def hedge_top(x0, y0, x1, y1, thick0, thick1, pal, seed):
    """Leafy bumps along the top edge of a receding hedge (from near end to far end)."""
    rr = random.Random(seed)
    out = []
    steps = int(abs(x1 - x0) / 16)
    for i in range(steps):
        t = i / steps
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        r = thick0 + (thick1 - thick0) * t
        out.append(f'<path d="{leafy(x, y, r, rr, 0.75)}" fill="{pal[rr.choice([3, 4, 4, 5])]}"/>')
    return ''.join(out)


def hedge_face_texture(poly_pts, pal, seed, n=140):
    """Scattered leaf specks across a hedge face, clipped roughly to its bounding polygon."""
    rr = random.Random(seed)
    xs = [p[0] for p in poly_pts]
    ys = [p[1] for p in poly_pts]
    out = []

    def inside(px, py):
        c = False
        j = len(poly_pts) - 1
        for i in range(len(poly_pts)):
            xi, yi = poly_pts[i]
            xj, yj = poly_pts[j]
            if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi:
                c = not c
            j = i
        return c

    tries = 0
    while len(out) < n and tries < n * 8:
        tries += 1
        px, py = rr.uniform(min(xs), max(xs)), rr.uniform(min(ys), max(ys))
        if not inside(px, py):
            continue
        s = 5 + (py - min(ys)) / (max(ys) - min(ys) + 1) * 9
        col = pal[rr.choice([1, 2, 4, 5])]
        out.append(f'<ellipse cx="{px:.1f}" cy="{py:.1f}" rx="{s:.1f}" ry="{s * 0.5:.1f}" fill="{col}" opacity="0.7" transform="rotate({rr.uniform(-50, 50):.0f} {px:.1f} {py:.1f})"/>')
    return ''.join(out)


def grass_tufts(region_fn, y0, y1, pal, seed, n=500):
    """Grass tufts across the lawn; bigger and denser toward the viewer."""
    rr = random.Random(seed)
    out = []
    for _ in range(n):
        t = rr.random() ** 0.7
        y = y0 + (y1 - y0) * t
        x = rr.uniform(0, 1080)
        if not region_fn(x, y):
            continue
        s = 3 + t * 13
        col = pal[rr.choice([1, 2, 4, 5])]
        blades = ''
        for b in range(3):
            lean = rr.uniform(-0.6, 0.6) * s
            hgt = s * rr.uniform(1.2, 2.0)
            bx = x + (b - 1) * s * 0.35
            blades += f'M{bx - s * 0.12:.1f},{y:.1f} Q{bx + lean * 0.3:.1f},{y - hgt * 0.6:.1f} {bx + lean:.1f},{y - hgt:.1f} Q{bx + lean * 0.2 + s * 0.12:.1f},{y - hgt * 0.5:.1f} {bx + s * 0.12:.1f},{y:.1f} Z '
        out.append(f'<path d="{blades}" fill="{col}" opacity="0.75"/>')
    return ''.join(out)


# ---------------------------------------------------------------- flowers

def _stem(x, y, length, s, rr, pal=GREEN):
    out = f'<path d="M{x:.1f},{y:.1f} Q{x + rr.uniform(-3, 3) * s:.1f},{y + length * 0.5:.1f} {x:.1f},{y + length:.1f}" stroke="{pal[2]}" stroke-width="{max(1.5, 2.2 * s):.1f}" fill="none"/>'
    for side in (-1, 1):
        if rr.random() < 0.7:
            ly = y + length * rr.uniform(0.45, 0.8)
            lx = x + side * 7 * s
            out += f'<ellipse cx="{lx:.1f}" cy="{ly:.1f}" rx="{7 * s:.1f}" ry="{2.8 * s:.1f}" fill="{pal[3]}" transform="rotate({side * -30} {lx:.1f} {ly:.1f})"/>'
    return out


def shade(hex_color, amt):
    c = hex_color.lstrip('#')
    r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
    f = (lambda v: v * (1 + amt)) if amt < 0 else (lambda v: v + (255 - v) * amt)
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(f(v)))) for v in (r, g, b))


def daisy(x, y, s, color='#ffffff', center='#f2b632'):
    out = ''
    for i in range(12):
        a = i / 12 * 360
        out += f'<ellipse cx="{x:.1f}" cy="{y - 7 * s:.1f}" rx="{2.2 * s:.1f}" ry="{6.5 * s:.1f}" fill="{color if i % 2 else shade(color, -0.08)}" transform="rotate({a:.0f} {x:.1f} {y:.1f})"/>'
    out += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{3.6 * s:.1f}" fill="{center}"/><circle cx="{x + s:.1f}" cy="{y - s:.1f}" r="{1.4 * s:.1f}" fill="{shade(center, 0.4)}"/>'
    return out


def tulip(x, y, s, color):
    dark, light = shade(color, -0.25), shade(color, 0.25)
    return (f'<path d="M{x - 7 * s:.1f},{y - 2 * s:.1f} Q{x - 9 * s:.1f},{y - 14 * s:.1f} {x - 4 * s:.1f},{y - 17 * s:.1f} L{x:.1f},{y - 11 * s:.1f} L{x + 4 * s:.1f},{y - 17 * s:.1f} Q{x + 9 * s:.1f},{y - 14 * s:.1f} {x + 7 * s:.1f},{y - 2 * s:.1f} Q{x:.1f},{y + 4 * s:.1f} {x - 7 * s:.1f},{y - 2 * s:.1f} Z" fill="{color}"/>'
            f'<path d="M{x - 2 * s:.1f},{y - 1 * s:.1f} Q{x - 3 * s:.1f},{y - 12 * s:.1f} {x:.1f},{y - 18 * s:.1f} Q{x + 3 * s:.1f},{y - 12 * s:.1f} {x + 2 * s:.1f},{y - 1 * s:.1f} Z" fill="{dark}"/>'
            f'<path d="M{x + 4 * s:.1f},{y - 13 * s:.1f} Q{x + 6 * s:.1f},{y - 8 * s:.1f} {x + 5 * s:.1f},{y - 3 * s:.1f}" stroke="{light}" stroke-width="{1.5 * s:.1f}" fill="none"/>')


def cosmos(x, y, s, color):
    out = ''
    for i in range(8):
        a = i / 8 * 360 + 10
        out += f'<ellipse cx="{x:.1f}" cy="{y - 6 * s:.1f}" rx="{3.6 * s:.1f}" ry="{6 * s:.1f}" fill="{color if i % 2 else shade(color, -0.12)}" transform="rotate({a:.0f} {x:.1f} {y:.1f})"/>'
    return out + f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{2.8 * s:.1f}" fill="#f5c63c"/>'


def rose(x, y, s, color):
    dark, light = shade(color, -0.3), shade(color, 0.2)
    out = f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{7.5 * s:.1f}" fill="{dark}"/><circle cx="{x - s * 0.5:.1f}" cy="{y - s * 0.6:.1f}" r="{6.6 * s:.1f}" fill="{color}"/>'
    for k, rad in enumerate((5.2, 3.6, 2.0)):
        out += f'<path d="M{x - rad * s:.1f},{y - s * 0.4:.1f} A{rad * s:.1f},{rad * s:.1f} 0 1,1 {x + rad * s * 0.6:.1f},{y + rad * s * 0.7:.1f}" stroke="{dark}" stroke-width="{1.4 * s:.1f}" fill="none"/>'
    return out + f'<circle cx="{x + 2 * s:.1f}" cy="{y - 3 * s:.1f}" r="{1.6 * s:.1f}" fill="{light}"/>'


FLOWER_KINDS = {'daisy': daisy, 'tulip': tulip, 'cosmos': cosmos, 'rose': rose}


def flower_planting(cx, cy, w, h, plan, seed, depth_scale=1.0):
    """
    Fill an oval bed: a low leafy base, then flowers on stems sorted back-to-front.
    plan: list of (kind, color) pairs to mix.
    """
    rr = random.Random(seed)
    out = [foliage(cx, cy - h * 0.08, w * 0.46, h * 0.36, GREEN, seed + 99, density=1.4)]
    items = []
    for _ in range(int(w * h / 520)):
        a = rr.random() * math.tau
        d = math.sqrt(rr.random()) * 0.85
        x, y = cx + math.cos(a) * w / 2 * d, cy - h * 0.12 + math.sin(a) * h / 2 * d
        items.append((y, x, rr.choice(plan)))
    items.sort()
    for y, x, (kind, color) in items:
        s = depth_scale * rr.uniform(0.95, 1.25) * (0.85 + 0.3 * (y - cy + h / 2) / h)
        stem_len = 14 * s
        out.append(_stem(x, y - stem_len, stem_len, s, rr))
        out.append(FLOWER_KINDS[kind](x, y - stem_len, s, color))
    return ''.join(out)
