/**
 * Geometry for the isolated Dragon Fire preview's painted side art (VA-0099/VA-0100): one flat quad
 * per side insert, just proud of the insert's outer face, sized to the texture's aspect inside the
 * insert (contain, with a small margin), front-facing outward. Engineering only; no art values.
 *
 * Model space is glTF: +Y up, the chair toward +Z. Seen from outside the cabinet, the viewer's
 * right is −Z on the +X side and +Z on the −X side, so the texture reads left-to-right on both
 * sides unless `mirrorPlusX` flips the +X side (then the head faces the same way on both sides,
 * and any baked lettering reads backwards there).
 */
export interface Box {
  min: number[];
  max: number[];
}

export interface ReliefQuads {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  placed: { side: 1 | -1; x: number; y: [number, number]; z: [number, number]; fill: number }[];
}

export function reliefInsertQuads(boxes: Box[], opts: { aspect: number; mirrorPlusX?: boolean; margin?: number; lift?: number }): ReliefQuads {
  const margin = opts.margin ?? 0.04;
  const lift = opts.lift ?? 0.0015;
  const out: ReliefQuads = { positions: [], normals: [], uvs: [], indices: [], placed: [] };
  for (const b of boxes) {
    const side: 1 | -1 = b.min[0] + b.max[0] >= 0 ? 1 : -1;
    const x = side > 0 ? b.max[0] + lift : b.min[0] - lift;
    const depth = b.max[2] - b.min[2];
    const height = b.max[1] - b.min[1];
    // contain: the largest aspect-correct rectangle inside the insert, less the margin
    let w = depth * (1 - margin);
    let h = w / opts.aspect;
    if (h > height * (1 - margin)) {
      h = height * (1 - margin);
      w = h * opts.aspect;
    }
    const cy = (b.min[1] + b.max[1]) / 2;
    const cz = (b.min[2] + b.max[2]) / 2;
    const y0 = cy - h / 2, y1 = cy + h / 2;
    // u = 0 at the viewer's left: +Z on the +X side, −Z on the −X side
    const flip = side > 0 && opts.mirrorPlusX;
    const zLeft = (side > 0) !== !!flip ? cz + w / 2 : cz - w / 2;
    const zRight = 2 * cz - zLeft;
    const base = out.positions.length / 3;
    // bottom-left, bottom-right, top-right, top-left (as seen from outside)
    out.positions.push(x, y0, zLeft, x, y0, zRight, x, y1, zRight, x, y1, zLeft);
    for (let i = 0; i < 4; i++) out.normals.push(side, 0, 0);
    out.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    // counter-clockwise as seen from outside, unless the mirror reversed the left-right order
    out.indices.push(...(flip ? [base, base + 2, base + 1, base, base + 3, base + 2] : [base, base + 1, base + 2, base, base + 2, base + 3]));
    out.placed.push({ side, x: +x.toFixed(4), y: [+y0.toFixed(3), +y1.toFixed(3)], z: [+Math.min(zLeft, zRight).toFixed(3), +Math.max(zLeft, zRight).toFixed(3)], fill: +((w * h) / (depth * height)).toFixed(3) });
  }
  return out;
}

/**
 * VA-0101: instead of a 1:2 card, copy the insert's own outward-facing triangles (its real slanted
 * outline), lift them a hair off the lacquer and give them planar UVs, so the transparent art can
 * spread over the whole insert and the insert's edge clips it. The texture keeps its aspect: it is
 * scaled to the face's height (`fit: 'height'`) or to its widest depth (`fit: 'width'`), centred on
 * the face, and anything outside 0…1 falls on the texture's transparent clamp edge.
 *
 * `positions`/`indices` are one insert mesh already in model space (glTF: +Y up, chair toward +Z).
 */
export interface FaceDecal {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  side: 1 | -1;
  face: { y: [number, number]; z: [number, number]; area: number; triangles: number };
  art: { y: [number, number]; z: [number, number] };
}

export function insertFaceDecal(
  positions: ArrayLike<number>,
  indices: ArrayLike<number> | null,
  opts: { aspect: number; fit?: 'height' | 'width'; mirror?: boolean; lift?: number; minDot?: number },
): FaceDecal {
  const lift = opts.lift ?? 0.0015;
  const minDot = opts.minDot ?? 0.9;
  const count = indices ? indices.length : positions.length / 3;
  const idx = (i: number) => (indices ? indices[i] : i);
  const P = (i: number) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
  let cx = 0;
  for (let i = 0; i < positions.length; i += 3) cx += positions[i];
  const side: 1 | -1 = cx >= 0 ? 1 : -1;
  // outward faces: geometric normal along ±X (the side the insert sits on), whatever the file's winding
  const tris: number[][][] = [];
  for (let t = 0; t + 2 < count; t += 3) {
    const a = P(idx(t)), b = P(idx(t + 1)), c = P(idx(t + 2));
    const u = b.map((v, k) => v - a[k]);
    const v = c.map((w, k) => w - a[k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-12) continue;
    if (Math.abs(n[0] / len) < minDot) continue;
    tris.push(Math.sign(n[0]) === side ? [a, b, c] : [a, c, b]);
  }
  // a thin slab has two ±X skins; keep the outermost one
  const outerX = Math.max(...tris.flat().map((p) => p[0] * side));
  const outer = tris.filter((t) => t.every((p) => Math.abs(p[0] * side - outerX) < 0.004));
  let area = 0;
  let y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const t of outer) for (const p of t) {
    y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
  }
  const H = y1 - y0, D = z1 - z0;
  // world size of the full texture
  let th = H, tw = H * opts.aspect;
  if (opts.fit === 'width') { tw = D; th = D / opts.aspect; }
  const cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
  // u = 0 at the viewer's left: +Z on the +X side, −Z on the −X side; `mirror` flips it
  const dir = (side > 0) !== !!opts.mirror ? -1 : 1;
  const out: FaceDecal = { positions: [], normals: [], uvs: [], indices: [], side, face: { y: [+y0.toFixed(3), +y1.toFixed(3)], z: [+z0.toFixed(3), +z1.toFixed(3)], area: 0, triangles: outer.length }, art: { y: [+(cy - th / 2).toFixed(3), +(cy + th / 2).toFixed(3)], z: [+(cz - tw / 2).toFixed(3), +(cz + tw / 2).toFixed(3)] } };
  for (const t of outer) {
    const base = out.positions.length / 3;
    for (const p of t) {
      out.positions.push(p[0] + side * lift, p[1], p[2]);
      out.normals.push(side, 0, 0);
      out.uvs.push(0.5 + (dir * (p[2] - cz)) / tw, 0.5 + (p[1] - cy) / th);
    }
    out.indices.push(base, base + 1, base + 2);
    const u = t[1].map((v, k) => v - t[0][k]);
    const v = t[2].map((w, k) => w - t[0][k]);
    area += Math.abs(u[1] * v[2] - u[2] * v[1]) / 2;
  }
  out.face.area = +area.toFixed(4);
  return out;
}
