import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createGrandHallArchitecture } from '../../../art/casino/3d/grandHallArchitecture.mjs';
import { grandHallLayout, hallCameraClamp, hallColumns, obstacleOverlaps, resolveSpec } from '../src/floor3d/grandHall.ts';
import { NavGrid } from '../src/floor3d/nav.ts';

const layout = grandHallLayout();

function build(opts = {}) {
  const root = createGrandHallArchitecture(THREE, opts) as THREE.Group;
  root.updateMatrixWorld(true);
  return root;
}

describe('grand hall layout (opt-in preview, VA-0063/VA-0065)', () => {
  it('uses the art module\'s defaults and clamping', () => {
    const art = build().userData;
    expect([layout.spec.width, layout.spec.length, layout.spec.height, layout.spec.aisleWidth]).toEqual([art.width, art.length, art.height, art.aisleWidth]);
    const odd = { width: 10, length: 500, height: 3, aisleWidth: 30 };
    const a = build(odd).userData;
    const s = resolveSpec(odd);
    expect([s.width, s.length, s.height, s.aisleWidth]).toEqual([a.width, a.length, a.height, a.aisleWidth]);
  });

  it('agrees with the art on the clear aisle and the gaming zones', () => {
    const art = build().userData;
    expect(layout.aisle).toEqual({ x0: art.clearAisle.minX, x1: art.clearAisle.maxX });
    expect(layout.zones).toEqual([
      { x0: art.leftGamingZone.minX, x1: art.leftGamingZone.maxX },
      { x0: art.rightGamingZone.minX, x1: art.rightGamingZone.maxX },
    ]);
  });

  for (const opts of [{}, { width: 30, length: 48, bayLength: 5 }, { width: 20, length: 24, aisleWidth: 6 }]) {
    it(`blocks the art's columns where the art puts them (${JSON.stringify(opts)})`, () => {
      const plinths: { x: number; z: number }[] = [];
      build(opts).traverse((o) => {
        if (o.name === 'colonnade-plinth') plinths.push({ x: o.position.x, z: o.position.z });
      });
      const cols = hallColumns(resolveSpec(opts));
      expect(cols.length).toBe(plinths.length);
      cols.forEach((c, i) => {
        expect(c.x).toBeCloseTo(plinths[i].x, 6);
        expect(c.z).toBeCloseTo(plinths[i].z, 6);
      });
    });

    it(`keeps the promenade clear and everything inside the walls, and every seat and slot reachable (${JSON.stringify(opts)})`, () => {
      const l = grandHallLayout(opts);
      const lane = { x0: l.aisle.x0, x1: l.aisle.x1, z0: l.bounds.z0, z1: l.bounds.z1 };
      for (const o of l.obstacles) expect(obstacleOverlaps(o, lane), o.id).toBe(false);
      for (const t of l.tables) {
        const z = l.zones.find((q) => t.x > q.x0 && t.x < q.x1)!;
        // the hero table's rail reaches 1.9 m along X
        expect(t.x - 1.9, t.id).toBeGreaterThan(z.x0);
        expect(t.x + 1.9, t.id).toBeLessThan(z.x1);
      }
      for (const s of l.slots) expect(Math.abs(s.x) + 0.42, s.id).toBeLessThanOrEqual(l.bounds.x1);
      // no two obstacles of different furniture pieces overlap
      const nav = new NavGrid(l.bounds, l.obstacles);
      expect(nav.walkableAt(l.spawn), 'spawn').toBe(true);
      for (const s of l.seats) expect(nav.findPath(l.spawn, s.approach), s.id).not.toBeNull();
      for (const s of l.slots) expect(nav.findPath(l.spawn, s.front), s.id).not.toBeNull();
    });
  }

  it('fills the default 36 x 24 m hall with 4 blackjack tables and 28 slots', () => {
    expect(layout.tables).toHaveLength(4);
    expect(layout.seats).toHaveLength(8);
    expect(layout.seats.filter((s) => s.taken)).toHaveLength(1);
    expect(layout.slots).toHaveLength(28);
    // seats face their own table
    for (const s of layout.seats) {
      const t = layout.tables.find((q) => s.id.startsWith(q.id))!;
      const fx = Math.sin(s.facing);
      const fz = -Math.cos(s.facing);
      expect((fx * (t.x - s.x) + fz * (t.z - s.z)) / Math.hypot(t.x - s.x, t.z - s.z)).toBeGreaterThan(0.99);
    }
    // slot screens (local +Z) face into the hall
    for (const s of layout.slots) expect(Math.sign(Math.sin(s.rotationY))).toBe(-Math.sign(s.x));
  });

  it('keeps the follow camera under the coffer beams', () => {
    let beamBottom = Infinity;
    build().traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !/coffer-(cross|side)-beam/.test(m.name)) return;
      beamBottom = Math.min(beamBottom, new THREE.Box3().setFromObject(m).min.y);
    });
    expect(hallCameraClamp(layout).y1).toBeLessThan(beamBottom);
  });

  it('builds with the host three.js only, and leaves both ends of the hall open (host frames them)', () => {
    const root = build();
    let meshes = 0;
    const box = new THREE.Box3().setFromObject(root);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      expect(m.material).toBeInstanceOf(THREE.Material);
      expect(m.geometry).toBeInstanceOf(THREE.BufferGeometry);
    });
    expect(meshes).toBeGreaterThan(0);
    // no wall spans across X at either end: every wall piece runs the hall's length
    root.traverse((o) => {
      if (/^wall-/.test(o.name)) expect(Math.abs(o.position.x)).toBeGreaterThan(11);
    });
    expect(box.max.z).toBeCloseTo(18, 5);
  });
});
