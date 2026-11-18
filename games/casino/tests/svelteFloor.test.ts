import { describe, expect, it } from 'vitest';
import { layoutFor } from '../src/floor3d/grandHall.ts';
import { obstaclesFor, SEATS, SPAWN, ROOM, SALON_ROOM, useRoom } from '../src/floor3d/layout.ts';
import { NavGrid } from '../src/floor3d/nav.ts';
import { buildArtScene } from '../src/floor3d/artScene.ts';
import { buildSvelteCaps, CAP, capObstacle, fitCaps, SVELTE_PAIR_X, svelteRowCaps } from '../src/floor3d/svelteFloor.ts';

describe('Svelte machines switch (prototype)', () => {
  it('puts one end cap past each end of a row, facing out', () => {
    const row = [0, 1.3, 2.6].map((x, i) => ({ id: `m${i}`, x, z: 0, rotationY: 0 }));
    const caps = svelteRowCaps(row);
    expect(caps).toHaveLength(2);
    const [lo, hi] = [...caps].sort((a, b) => a.x - b.x);
    expect(lo.x).toBeLessThan(-SVELTE_PAIR_X);
    expect(hi.x).toBeGreaterThan(2.6 + SVELTE_PAIR_X);
    expect(lo.z).toBeCloseTo(CAP.centreZ);
    // the decorated face (local +X) points away from the row
    expect(Math.cos(lo.rotationY)).toBeCloseTo(-1);
    expect(Math.cos(hi.rotationY)).toBeCloseTo(1);
  });

  it('splits rows at gaps and keeps facings apart', () => {
    const slots = [
      { id: 'a', x: 0, z: 0, rotationY: 0 },
      { id: 'b', x: 5, z: 0, rotationY: 0 },
      { id: 'c', x: 0, z: 0, rotationY: Math.PI },
    ];
    expect(svelteRowCaps(slots)).toHaveLength(6);
  });

  it('turned caps get a footprint that matches their turn', () => {
    const b = capObstacle({ x: 1, z: 2, rotationY: Math.PI / 2 }, 0);
    expect(b.x1 - b.x0).toBeCloseTo(CAP.depth);
    expect(b.z1 - b.z0).toBeCloseTo(CAP.width + 0.04);
  });

  it('drops caps that hit another obstacle or leave the room', () => {
    const caps = [{ x: 0, z: 0, rotationY: 0 }, { x: 10, z: 0, rotationY: 0 }];
    const fit = fitCaps(caps, [{ kind: 'circle', id: 'post', x: 0, z: 0.1, r: 0.2, h: 1 }], SALON_ROOM);
    expect(fit.caps).toHaveLength(0);
    expect(fit.dropped).toBe(2);
  });

  for (const hall of ['salon', 'grand'] as const) {
    it(`${hall}: caps fit and the floor stays walkable`, () => {
      const layout = layoutFor(hall, true, hall === 'grand');
      useRoom(layout.room);
      try {
        const base = hall === 'grand' ? layout.obstacles : obstaclesFor(true, false);
        const fit = fitCaps(svelteRowCaps([...layout.slots, ...layout.decor.slots]), base, ROOM);
        expect(fit.caps.length).toBeGreaterThan(0);
        const nav = new NavGrid(ROOM, [...base, ...fit.obstacles]);
        const seats = hall === 'grand' ? layout.seats : SEATS;
        if (hall === 'salon') expect(nav.walkableAt(SPAWN)).toBe(true);
        for (const s of seats) expect(nav.walkableAt(s.approach), s.id).toBe(true);
      } finally {
        useRoom(SALON_ROOM);
      }
    });
  }

  it('swaps every salon cabinet for a Svelte pair and keeps the pilot chair', () => {
    const layout = layoutFor('salon', true, false);
    const art = buildArtScene(new Map(), { pilot05: true, layout, svelteMachines: true });
    expect(art.svelteCabinets).toBe(layout.slots.length * 2);
    expect(art.fadeable.size).toBeGreaterThan(0);
    expect(buildArtScene(new Map(), { pilot05: true, layout }).svelteCabinets).toBe(0);
  });

  it('merges every end cap into a few draws, with all the bulbs chasing', () => {
    const caps = [0, 1, 2].map((i) => ({ x: i * 3, z: 0, rotationY: i }));
    const { root, animate } = buildSvelteCaps(caps);
    expect(root.children.length).toBeLessThanOrEqual(6);
    const bulbs = root.children.find((c) => (c as { isInstancedMesh?: boolean }).isInstancedMesh) as unknown as { count: number; instanceColor: { array: Float32Array } };
    expect(bulbs.count % 3).toBe(0);
    const before = [...bulbs.instanceColor.array];
    animate(0.3);
    expect([...bulbs.instanceColor.array]).not.toEqual(before);
    expect(buildSvelteCaps([]).root.children).toHaveLength(0);
  });
});
