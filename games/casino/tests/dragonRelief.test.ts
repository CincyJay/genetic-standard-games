import { describe, expect, it } from 'vitest';
import { reliefInsertQuads } from '../src/floor3d/dragonRelief.ts';
import { dragonReliefSvg } from '../../../art/casino/3d/dragonReliefArt.mjs';

// the two ruby inserts of dragon_fire_hero.glb, glTF space (VA-0100)
const INSERTS = [
  { min: [-0.56, 0.27, -0.17], max: [-0.542, 2.079, 0.45] },
  { min: [0.542, 0.27, -0.17], max: [0.56, 2.079, 0.45] },
];

function faceNormals(q: ReturnType<typeof reliefInsertQuads>) {
  const p = (i: number) => q.positions.slice(i * 3, i * 3 + 3);
  const out: number[][] = [];
  for (let t = 0; t < q.indices.length; t += 3) {
    const [a, b, c] = [p(q.indices[t]), p(q.indices[t + 1]), p(q.indices[t + 2])];
    const u = b.map((v, i) => v - a[i]);
    const v = c.map((w, i) => w - a[i]);
    out.push([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
  }
  return out;
}

describe('dragon side-art quads (isolated preview)', () => {
  for (const mirrorPlusX of [false, true]) {
    it(`faces outward on both sides, inside the insert, aspect kept (mirror ${mirrorPlusX})`, () => {
      const q = reliefInsertQuads(INSERTS, { aspect: 0.5, mirrorPlusX });
      expect(q.indices.length).toBe(12);
      const n = faceNormals(q);
      // first quad is the −X insert, second the +X one; winding matches the stored normal
      n.slice(0, 2).forEach((f) => expect(Math.sign(f[0])).toBe(-1));
      n.slice(2).forEach((f) => expect(Math.sign(f[0])).toBe(1));
      for (const [i, pl] of q.placed.entries()) {
        const b = INSERTS[i];
        expect(pl.y[0]).toBeGreaterThanOrEqual(b.min[1]);
        expect(pl.y[1]).toBeLessThanOrEqual(b.max[1]);
        expect(pl.z[0]).toBeGreaterThanOrEqual(b.min[2]);
        expect(pl.z[1]).toBeLessThanOrEqual(b.max[2]);
        expect((pl.z[1] - pl.z[0]) / (pl.y[1] - pl.y[0])).toBeCloseTo(0.5, 2);
        expect(Math.abs(pl.x)).toBeGreaterThan(0.56);
      }
    });
  }
  it('u runs left-to-right as seen from outside unless mirrored', () => {
    const zAtU0 = (q: ReturnType<typeof reliefInsertQuads>, quad: number) => q.positions[quad * 12 + 2];
    const plain = reliefInsertQuads(INSERTS, { aspect: 0.5 });
    expect(zAtU0(plain, 1)).toBeGreaterThan(zAtU0(plain, 0)); // +X: left is +Z; −X: left is −Z
    const mir = reliefInsertQuads(INSERTS, { aspect: 0.5, mirrorPlusX: true });
    expect(zAtU0(mir, 1)).toBeLessThan(0.15);
  });
  it('the art module returns a self-contained SVG', () => {
    const svg = dragonReliefSvg();
    expect(svg).toMatch(/^<svg[^>]+viewBox="0 0 1024 2048"/);
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });
});
