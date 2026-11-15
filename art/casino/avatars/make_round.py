"""Round crops of the supplied avatar art for circular frames (chat, lists, tables).

Pure crop + circular alpha mask of the pack's own WebP files: no resizing up,
no filters, no colour changes. Run from the repo root:
    python3 art/casino/avatars/make_round.py
"""
import json
import os

from PIL import Image, ImageDraw

ROOT = 'games/casino/public'
manifest = json.load(open('games/casino/src/data/avatar_manifest.json'))


# per-portrait horizontal shift of the circle (fraction of the image width). Natalie,
# Mason and Viktor used to need one for a strip of the card frame; since 1.8 their
# portraits are re-cropped without it (see art/casino/avatars/recrop.md).
SHIFT = {}


def round_crop(src, size, top, shift=0.0):
    im = Image.open(os.path.join(ROOT, src)).convert('RGB')
    x0 = min(im.width - size, (im.width - size) // 2 + round(shift * im.width))
    face = im.crop((x0, top, x0 + size, top + size)).convert('RGBA')
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    face.putalpha(mask.resize((size, size), Image.LANCZOS))
    return face


for a in manifest['avatars']:
    name = os.path.basename(a['portrait'])
    for kind, src, size, top in (('round', a['portrait'], 176, 6), ('round-thumbs', a['thumbnail'], 88, 3)):
        out = os.path.join(ROOT, 'assets/avatars', kind, name)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        round_crop(src, size, top, SHIFT.get(a['id'], 0.0)).save(out, 'WEBP', quality=90, method=6)
print('ok', len(manifest['avatars']))
