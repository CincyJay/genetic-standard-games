import { describe, expect, it } from 'vitest';
import { insertFaceDecal, reliefInsertQuads } from '../src/floor3d/dragonRelief.ts';
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

// a slanted slab like the ruby insert: wide at the bottom, narrow at the top, 18 mm thick
function slab(x0: number, x1: number, reverseWinding = false) {
  const outline = [[0.77, -0.151], [0.77, 0.441], [1.47, 0.281], [1.47, -0.16]]; // [y, z]
  const pos: number[] = [];
  for (const x of [x0, x1]) for (const [y, z] of outline) pos.push(x, y, z);
  // two skins (quads 0-1-2-3 and 4-5-6-7) plus the four edge walls
  const quad = (a: number, b: number, c: number, d: number) => (reverseWinding ? [a, c, b, a, d, c] : [a, b, c, a, c, d]);
  const idx = [...quad(0, 1, 2, 3), ...quad(7, 6, 5, 4), ...quad(0, 4, 5, 1), ...quad(1, 5, 6, 2), ...quad(2, 6, 7, 3), ...quad(3, 7, 4, 0)];
  return { pos, idx };
}

describe('insert-shaped decal (VA-0101)', () => {
  const faceN = (d: ReturnType<typeof insertFaceDecal>) => faceNormals(d as unknown as ReturnType<typeof reliefInsertQuads>);
  for (const [name, x0, x1, side] of [['+X', 0.542, 0.56, 1], ['−X', -0.56, -0.542, -1]] as const) {
    for (const rev of [false, true]) {
      it(`keeps only the outer skin of the ${name} insert, facing outward (reversed winding ${rev})`, () => {
        const { pos, idx } = slab(x0, x1, rev);
        const d = insertFaceDecal(pos, idx, { aspect: 0.5 });
        expect(d.side).toBe(side);
        expect(d.face.triangles).toBe(2);
        for (const f of faceN(d)) expect(Math.sign(f[0])).toBe(side);
        const outer = side > 0 ? x1 : x0;
        for (let i = 0; i < d.positions.length; i += 3) expect(d.positions[i]).toBeCloseTo(outer + side * 0.0015, 6);
        // the whole slanted outline, not a card: area of the trapezoid
        expect(d.face.area).toBeCloseTo(0.7 * (0.592 + 0.441) / 2, 3);
      });
    }
  }
  it('keeps the texture aspect and centres it on the face (height fit)', () => {
    const { pos, idx } = slab(0.542, 0.56);
    const d = insertFaceDecal(pos, idx, { aspect: 0.5 });
    const vs = d.uvs.filter((_, i) => i % 2 === 1);
    expect(Math.min(...vs)).toBeCloseTo(0, 6);
    expect(Math.max(...vs)).toBeCloseTo(1, 6);
    expect((d.art.z[1] - d.art.z[0]) / (d.art.y[1] - d.art.y[0])).toBeCloseTo(0.5, 2);
    // u = 0.5 at the face's z centre; on +X the viewer's left is +Z, so u falls as z rises
    const at = (z: number) => d.uvs[(2 * (d.positions.findIndex((p, i) => i % 3 === 2 && Math.abs(p - z) < 1e-6) - 2)) / 3];
    expect(at(0.441)).toBeLessThan(at(-0.16));
    const m = insertFaceDecal(pos, idx, { aspect: 0.5, mirror: true });
    const atM = (z: number) => m.uvs[(2 * (m.positions.findIndex((p, i) => i % 3 === 2 && Math.abs(p - z) < 1e-6) - 2)) / 3];
    expect(atM(0.441)).toBeGreaterThan(atM(-0.16));
  });
  it('width fit spans the widest depth exactly', () => {
    const { pos, idx } = slab(-0.56, -0.542);
    const d = insertFaceDecal(pos, idx, { aspect: 0.5, fit: 'width' });
    const us = d.uvs.filter((_, i) => i % 2 === 0);
    expect(Math.min(...us)).toBeCloseTo(0, 6);
    expect(Math.max(...us)).toBeCloseTo(1, 6);
    expect(d.art.z).toEqual(d.face.z);
  });
  it('the art module now has no <use>, no text and an explicit scales fill', () => {
    const svg = dragonReliefSvg();
    expect(svg).not.toMatch(/<use\b/);
    expect(svg).not.toMatch(/<text\b/);
    expect(svg).toMatch(/fill="url\(#scales\)"/);
  });
});
