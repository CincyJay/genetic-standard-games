# Re-cropped portraits (1.8)

Three portraits in the art pack were cut with part of the composite's card frame in them:
gold frame lines down the left edge, and for Natalie a sliver of the neighbouring card.
Mason's also had the frame's arched top. In 1.8 they were re-cropped **from the pack's own
192×240 WebP files** (the composite `assets/avatar-references/original_avatar_collection.png`
is about 10% lower resolution than the pack, so re-cutting from it would have meant a larger
upscale).

| Preset | Crop box in the 192×240 original (x0, y0, x1, y1) | Scale back to 192×240 |
|---|---|---|
| avatar_08 Natalie | 33, 1, 192, 200 | 1.21× |
| avatar_15 Mason | 18, 22, 176, 220 | 1.22× |
| avatar_16 Viktor | 33, 19, 192, 218 | 1.21× |

- The crop keeps the 4:5 portrait shape. It is scaled back to 192×240 with Lanczos
  resampling only: no sharpening, AI upscaling, retouching or colour change. The faces are
  unchanged, but these three are slightly softer than the other thirteen.
- The 96×120 thumbnails are the new portraits scaled down with Lanczos.
- The round crops come from `make_round.py`, which no longer needs a per-face shift.
- The other portraits still show a thin (1–3 px) frame line at an edge. It's barely visible at
  normal size and was left alone.
- Better long-term fix: higher-resolution individual portraits from the original art source,
  which would also allow a larger Dressing Room preview.
