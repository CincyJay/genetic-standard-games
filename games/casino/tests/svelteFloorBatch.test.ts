import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSvelteSlotCabinet } from '../../../art/casino/3d/svelteSlotCabinet.mjs';
import { applySvelteLuxuryFinish } from '../../../art/casino/3d/svelteLuxuryFinish.mjs';
import { batchSvelteCabinet, repairSvelteWinding } from '../src/floor3d/svelteFloorBatch.ts';

function build(finish: boolean): THREE.Group {
  const c = createSvelteSlotCabinet(THREE) as THREE.Group;
  if (finish) applySvelteLuxuryFinish(THREE, c);
  c.updateMatrixWorld(true);
  return c;
}

function sourceStats(c: THREE.Object3D) {
  let tris = 0, meshes = 0;
  const box = new THREE.Box3();
  c.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  box.setFromObject(c, true);
  return { tris, meshes, box };
}

const placements = (n: number) => Array.from({ length: n }, (_, i) =>
  new THREE.Matrix4().compose(new THREE.Vector3((i % 10) * 1.2, 0, Math.floor(i / 10) * 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.3), new THREE.Vector3(1, 1, 1)));

describe('Svelte cabinet floor batching', () => {
  for (const finish of [false, true]) {
    it(`keeps every triangle and collapses draw calls (finish=${finish})`, () => {
      const c = build(finish);
      const src = sourceStats(c);
      const b = batchSvelteCabinet(c, placements(38));
      expect(b.sourceMeshes).toBe(src.meshes);
      expect(b.trianglesPerCabinet).toBe(src.tris);
      expect(b.meshes.length).toBeLessThan(src.meshes);
      expect(b.meshes.length).toBeLessThanOrEqual(10);
      for (const m of b.meshes) expect(m.count).toBe(38);
      // the screen stays its own bucket so a reel texture can go on it
      expect(b.meshes.filter((m) => (m.material as THREE.Material).name === 'VA_SVELTE_REEL_SCREEN_SWAP')).toHaveLength(1);
    });
  }

  it('places each copy where its matrix says, with the cabinet footprint unchanged', () => {
    const c = build(true);
    const { box } = sourceStats(c);
    const ps = placements(3);
    const b = batchSvelteCabinet(c, ps);
    const merged = new THREE.Box3();
    for (const m of b.meshes) { m.geometry.computeBoundingBox(); merged.union(m.geometry.boundingBox!); }
    expect(merged.min.distanceTo(box.min)).toBeLessThan(1e-4);
    expect(merged.max.distanceTo(box.max)).toBeLessThan(1e-4);
    const got = new THREE.Matrix4();
    b.meshes[0].getMatrixAt(2, got);
    got.elements.forEach((v, i) => expect(v).toBeCloseTo(ps[2].elements[i], 5));
  });
});

describe('Svelte winding repair (VA-0136 recess gaskets)', () => {
  it('leaves every recess gasket facing the player', () => {
    const c = build(false);
    const gaskets = ['left_recess_shadow_gasket', 'right_recess_shadow_gasket'].map((n) => c.getObjectByName(n) as THREE.Mesh | undefined).filter(Boolean) as THREE.Mesh[];
    repairSvelteWinding(c);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    for (const m of gaskets) {
      const g = m.geometry, p = g.attributes.position, idx = g.index!;
      for (let i = 0; i < idx.count; i += 3) {
        a.fromBufferAttribute(p, idx.getX(i)); b.fromBufferAttribute(p, idx.getX(i + 1)); d.fromBufferAttribute(p, idx.getX(i + 2));
        expect(b.sub(a).cross(d.sub(a)).z).toBeGreaterThan(0);
      }
    }
    // a second call changes nothing
    expect(repairSvelteWinding(c)).toEqual([]);
  });
});
