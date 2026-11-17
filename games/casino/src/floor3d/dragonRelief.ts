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
