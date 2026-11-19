import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { layoutFor } from '../src/floor3d/grandHall.ts';
import { obstaclesFor, SEATS, SPAWN, ROOM, SALON_ROOM, useRoom } from '../src/floor3d/layout.ts';
import { NavGrid } from '../src/floor3d/nav.ts';
import { buildArtScene } from '../src/floor3d/artScene.ts';
import { ART_FAR_STOOL_SEAT_HEIGHT, artFarStool, BANK, FAR_STOOL_DROP, farStool, SVELTE_NEAR_STOOLS, buildIslandToppers, buildSvelteCaps, CABINET_TOP, islandSeams, CAP, capObstacle, planBanks, fitCaps, SVELTE_PAIR_X, svelteRowCaps, slimNearCabinet, SLIM_SCREEN } from '../src/floor3d/svelteFloor.ts';

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

  it('draws the floor cap bulbs low-poly at the authored radius (VA-0172)', () => {
    const { root } = buildSvelteCaps([{ x: 0, z: 0, rotationY: 0 }]);
    let tris = 0;
    let bulbs: THREE.InstancedMesh | null = null;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const n = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position!.count) / 3;
      if ((m as THREE.InstancedMesh).isInstancedMesh) { bulbs = m as THREE.InstancedMesh; tris += n * bulbs.count; } else tris += n;
    });
    const b = bulbs as unknown as THREE.InstancedMesh;
    expect(b).toBeTruthy();
    expect(b.geometry.attributes.position!.count / 3).toBe(20);
    b.geometry.computeBoundingSphere();
    expect(b.geometry.boundingSphere!.radius).toBeCloseTo(0.017, 3);
    expect(tris).toBeLessThan(2500); // was ~9.9k per cap with 160-triangle bulbs
  });

  it('banks: the salon walls become two continuous banks of evenly spaced machines, a stool at each', () => {
    const layout = layoutFor('salon', true, false);
    const base = obstaclesFor(true, false).filter((o) => o.id !== 'pilot-luxury-chair');
    const plan = planBanks(layout.slots, base, layout.room);
    const cabs = plan.slots.reduce((n, b) => n + b.offsets.length, 0);
    expect(cabs).toBe(30); // 5 spots × 3 per wall
    expect(plan.caps.length + plan.capsDropped).toBe(4); // one bank per wall, capped both ends where it fits
    // the pitch runs on unbroken across spots
    const west = plan.slots.filter((b) => b.slot.x < 0).flatMap((b) => b.offsets.map((o) => b.slot.z - o)).sort((a, b) => a - b);
    const gaps = west.slice(1).map((z, i) => z - west[i]);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0], 5);
    expect(gaps[0]).toBeGreaterThanOrEqual(BANK.pitchMin);
    expect(plan.slots.reduce((n, b) => n + b.stools.length, 0) + plan.stoolsDropped).toBe(cabs);
    expect(plan.stoolsDropped).toBe(0);
    // walkable: spawn, the table seats, and a spot in front of every stool
    const nav = new NavGrid(ROOM, [...base, ...plan.obstacles]);
    expect(nav.walkableAt(SPAWN)).toBe(true);
    for (const s of SEATS) expect(nav.walkableAt(s.approach), s.id).toBe(true);
  });

  it('banks: every cap touching its own bank fits (no float-noise drops), in the salon and the grand hall', () => {
    const salon = layoutFor('salon', true, false);
    const sp = planBanks(salon.slots, obstaclesFor(true, false).filter((o) => o.id !== 'pilot-luxury-chair'), salon.room);
    expect(sp.capsDropped).toBe(0);
    expect(sp.caps).toHaveLength(4);
    const grand = layoutFor('grand', true, true);
    const wallLine = { ...grand.room, z0: -grand.hallSpec!.length / 2 + 0.2 };
    const gp = planBanks([...grand.slots, ...grand.decor.slots], grand.obstacles, grand.room, wallLine);
    expect(gp.caps.length + gp.capsDropped).toBe(10);
    expect(gp.capsDropped).toBe(0);
    // walkable-room only: the back row's caps and the side banks' back caps stand past it, by the wall
    const walkOnly = planBanks([...grand.slots, ...grand.decor.slots], grand.obstacles, grand.room);
    expect(walkOnly.capsDropped).toBe(4);
    for (const c of gp.caps) expect(c.z).toBeGreaterThan(wallLine.z0);
    // no two caps overlap, and none sits inside another bank's cabinets
    const boxes = gp.caps.map((c, i) => capObstacle(c, i));
    const banks = gp.obstacles.filter((o) => o.id.startsWith('svelte-bank-')) as { x0: number; z0: number; x1: number; z1: number }[];
    const cut = (a: { x0: number; z0: number; x1: number; z1: number }, b: typeof a) => a.x0 + 0.005 < b.x1 && a.x1 - 0.005 > b.x0 && a.z0 + 0.005 < b.z1 && a.z1 - 0.005 > b.z0;
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) expect(cut(a, b)).toBe(false);
      for (const b of banks) expect(cut(a, b), a.id).toBe(false);
    }
    useRoom(grand.room);
    try {
      const nav = new NavGrid(ROOM, [...grand.obstacles, ...gp.obstacles]);
      expect(nav.walkableAt(grand.spawn)).toBe(true);
      for (const s of grand.seats) expect(nav.walkableAt(s.approach), s.id).toBe(true);
    } finally {
      useRoom(SALON_ROOM);
    }
  });

  it('banks: the art gets the planned cabinets and stools, and loses the pilot chair', () => {
    const layout = layoutFor('salon', true, false);
    const plan = planBanks(layout.slots, obstaclesFor(true, false).filter((o) => o.id !== 'pilot-luxury-chair'), layout.room);
    const art = buildArtScene(new Map(), { pilot05: true, layout, svelteMachines: true, svelteBanks: plan });
    expect(art.svelteCabinets).toBe(30);
    expect(art.fadeable.size).toBe(0);
  });

  it('stool LOD (VA-0203): with distance LOD the bank stools are instanced, the nearest in full, the rest without the small parts', async () => {
    const { createVelvetSlotStool } = await import('../../../art/casino/3d/velvetSlotStool.mjs');
    const tris = (o: THREE.Object3D) => { let t = 0; o.traverse((m) => { const g = (m as THREE.Mesh).geometry; if ((m as THREE.Mesh).isMesh) t += (g.index ? g.index.count : g.attributes.position!.count) / 3; }); return t; };
    const stool = createVelvetSlotStool(THREE) as THREE.Group;
    const far = farStool(stool);
    const names = (o: THREE.Object3D) => { const n: string[] = []; o.traverse((m) => { if ((m as THREE.Mesh).isMesh) n.push(m.name); }); return n; };
    expect(names(far)).toEqual(names(stool).filter((n) => !FAR_STOOL_DROP.test(n)));
    expect(names(stool).filter((n) => FAR_STOOL_DROP.test(n))).toHaveLength(11); // 5 buttons, 3 spokes, foot ring, piping, base dome
    expect(tris(stool)).toBe(1118);
    expect(tris(far)).toBe(626);

    const layout = layoutFor('salon', true, false);
    const plan = planBanks(layout.slots, obstaclesFor(true, false).filter((o) => o.id !== 'pilot-luxury-chair'), layout.room);
    const n = plan.slots.reduce((k, b) => k + b.stools.length, 0);
    const key = (x: number, z: number) => `${x.toFixed(3)},${z.toFixed(3)}`;
    // the stools' collision circles are where the plan seats them
    const authored = plan.obstacles.filter((o) => o.id.startsWith('svelte-stool-')).map((o) => key((o as { x: number }).x, (o as { z: number }).z)).sort();
    expect(authored).toHaveLength(n);
    const art = buildArtScene(new Map(), { pilot05: true, layout, svelteMachines: true, svelteLod: true, svelteBanks: plan });
    const lod = art.svelteLod!;
    lod.update(new THREE.Vector3(0, 1.6, 0));
    // every stool lands where the static build put it, once
    const placed: string[] = [];
    const stoolRoot = lod.root.children[1];
    const m = new THREE.Matrix4(), v = new THREE.Vector3();
    for (const c of stoolRoot.children) {
      const im = c as THREE.InstancedMesh;
      if (!im.name.endsWith('_0')) continue; // the first bucket of each level: one instance per stool
      for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, m); v.setFromMatrixPosition(m); expect(v.y).toBeCloseTo(0, 5); placed.push(key(v.x, v.z)); }
    }
    expect(placed.sort()).toEqual(authored);
    // stools add 626 triangles each, plus 492 more for each of the nearest
    const cabinetsOnly = lod.root.children[0];
    let cabTris = 0;
    cabinetsOnly.traverse((o) => { const im = o as THREE.InstancedMesh; if (im.isInstancedMesh && im.visible) cabTris += (im.geometry.index ? im.geometry.index.count : im.geometry.attributes.position!.count) / 3 * im.count; });
    expect(lod.triangles() - cabTris).toBe(n * 626 + Math.min(n, SVELTE_NEAR_STOOLS) * 492);
  });

  it('art far stool (VA-0205/0209, opt-in): faces the cabinet like the near stool, cushion level with it, inside the stool circle, fewer triangles', async () => {
    const { createVelvetSlotStool } = await import('../../../art/casino/3d/velvetSlotStool.mjs');
    const tris = (o: THREE.Object3D) => { let t = 0; o.traverse((m) => { const g = (m as THREE.Mesh).geometry; if ((m as THREE.Mesh).isMesh) t += (g.index ? g.index.count : g.attributes.position!.count) / 3; }); return t; };
    const near = createVelvetSlotStool(THREE) as THREE.Group;
    const far = artFarStool();
    far.updateMatrixWorld(true);
    const art = far.children[0];
    expect(art.userData.velvetArt.seatHeight).toBe(ART_FAR_STOOL_SEAT_HEIGHT);
    expect(tris(far)).toBe(art.userData.velvetArt.triangles);
    expect(tris(far)).toBeLessThan(200);
    // the backrest sits behind the seat: at -Z in the host's frame, like the near stool's back shell
    const backZ = (o: THREE.Object3D, name: RegExp) => { const b = new THREE.Box3(); o.updateMatrixWorld(true); o.traverse((m) => { if ((m as THREE.Mesh).isMesh && name.test(m.name)) b.expandByObject(m); }); return b; };
    // 40d51af (VA-0209): the slab backrest became a curved open-front tub back, top 0.92 m like the near stool's rim
    const tub = backZ(far, /^curved_tub_back$/);
    expect(tub.getCenter(new THREE.Vector3()).z).toBeLessThan(-0.1);
    expect(tub.max.y).toBeCloseTo(0.92, 3);
    // ade019b (VA-0212): crest widened to 30 mm (0.895-0.925 m), still level with the near rim
    const crest = backZ(far, /^tub_gold_crest$/);
    expect(crest.max.y).toBeLessThan(0.93);
    expect(crest.max.y - crest.min.y).toBeGreaterThan(0.025);
    // dfb35d4 (VA-0214): crest pushed out to tub radius +8 mm; it must still read as attached (gap under 1 cm, outside the fabric)
    const crestOut = Math.max(crest.max.x, -crest.min.x, -crest.min.z);
    const tubOut = Math.max(tub.max.x, -tub.min.x, -tub.min.z);
    expect(crestOut - tubOut).toBeGreaterThanOrEqual(0);
    expect(crestOut - tubOut).toBeLessThan(0.01);
    // ade019b: the tub and crest reuse the cushion and pedestal materials (no DoubleSide clones)
    const mat = (name: RegExp) => { let m: unknown; far.traverse((o) => { if ((o as THREE.Mesh).isMesh && name.test(o.name)) m = (o as THREE.Mesh).material; }); return m; };
    expect(mat(/^curved_tub_back$/)).toBe(mat(/^seat_cushion$/));
    expect(backZ(near, /back|shell/).getCenter(new THREE.Vector3()).z).toBeLessThan(-0.05);
    // cushion tops level within 1 cm; the whole stool on the floor and inside its collision circle
    const cushion = backZ(far, /^seat_cushion$/);
    expect(Math.abs(cushion.max.y - 0.675)).toBeLessThan(0.01);
    const all = new THREE.Box3().setFromObject(far);
    // 40d51af puts the foot on the floor (centre 0.0275, 0.055 tall)
    expect(all.min.y).toBeCloseTo(0, 6);
    // the tub (r 0.2496) and crest (+8 mm since dfb35d4) stay inside the 0.27 m stool circle on every side
    expect(Math.max(all.max.z, -all.min.z, -all.min.x, all.max.x)).toBeLessThanOrEqual(BANK.stoolR);
  });

  it('slim near cabinet (VA-0216, opt-in): faces +Z like the Svelte cabinet, reel plane behind the rails and in front of the backplane, one screen bucket', async () => {
    const { cabinetBuckets } = await import('../src/floor3d/svelteFloorBatch.ts');
    const cab = slimNearCabinet();
    cab.updateMatrixWorld(true);
    const box = (name: RegExp) => { const b = new THREE.Box3(); cab.traverse((m) => { if ((m as THREE.Mesh).isMesh && name.test(m.name)) b.expandByObject(m); }); return b; };
    // the control deck is on the player's side, +Z in the host's frame
    expect(box(/^angled_control_deck$/).getCenter(new THREE.Vector3()).z).toBeGreaterThan(0.15);
    const screen = box(/^slim_reel_screen$/);
    const rails = box(/^reel_(left|right|top|bottom)_rail$/);
    const back = box(/^reel_backplane$/);
    // drawn behind the rails' front faces, in front of the backplane's face (no z-fighting, not hidden);
    // all three share the -0.065 rad tilt, so their face centres compare along one parallel stack
    const face = (name: string, depth: number) => { const p = new THREE.Vector3(); cab.traverse((m) => { if (m.name === name) p.set(0, 0, -depth / 2).applyMatrix4(m.matrixWorld); }); return p.z; };
    const screenZ = screen.getCenter(new THREE.Vector3()).z;
    expect(screenZ).toBeLessThan(face('reel_left_rail', 0.065) - 0.02);
    expect(screenZ).toBeGreaterThan(face('reel_backplane', 0.22) + 0.02);
    expect(back.max.z).toBeLessThan(rails.max.z);
    // fills the aperture and tucks under the rails, never past their outer edges
    expect(screen.max.x).toBeLessThan(rails.max.x);
    expect(screen.max.x).toBeGreaterThan(0.264);
    expect(screen.max.y).toBeLessThan(rails.max.y);
    expect(screen.min.y).toBeGreaterThan(rails.min.y);
    expect(screen.getCenter(new THREE.Vector3()).y).toBeCloseTo(SLIM_SCREEN.y, 2);
    // the screen plane faces the player (+Z)
    const n = new THREE.Vector3();
    cab.traverse((m) => { if (m.name === 'slim_reel_screen') n.fromBufferAttribute((m as THREE.Mesh).geometry.attributes.normal as THREE.BufferAttribute, 0).transformDirection(m.matrixWorld); });
    expect(n.z).toBeGreaterThan(0.99);
    const { buckets } = cabinetBuckets(cab);
    expect(buckets.filter((b) => b.screen)).toHaveLength(1);
    expect(buckets.length).toBeLessThanOrEqual(5);
    // stands on the floor; 0.68 m wide, so at the 0.64 m pair pitch neighbours overlap by 4 cm (reported on the board)
    const all = new THREE.Box3().setFromObject(cab);
    expect(all.min.y).toBeCloseTo(0, 6);
    expect(all.max.x - all.min.x).toBeCloseTo(0.68, 3);
    // inside the bank's collision depth (back -0.42, front 0.6)
    expect(all.min.z).toBeGreaterThan(BANK.backZ);
    expect(all.max.z).toBeLessThan(BANK.frontZ);
  });

  it('islands (VA-0197): the grand hall side banks stand back to back, caps and stools all fit, every machine reachable', async () => {
    const { grandHallLayout, GRAND_SPEC, ISLAND_HALF, obstacleOverlaps } = await import('../src/floor3d/grandHall.ts');
    const g = layoutFor('grand', true, true, { islands: true });
    const l = grandHallLayout({ ...GRAND_SPEC, islands: true });
    const side = l.slots.filter((s) => !s.id.startsWith('end-'));
    // every side spot has a twin on the same line facing the other way, backs ISLAND_HALF off a shared centre line
    for (const s of side) {
      const twin = side.find((t) => t !== s && Math.abs(t.z - s.z) < 1e-6 && Math.abs(Math.abs(t.x - s.x) - 2 * ISLAND_HALF) < 1e-6);
      expect(twin, s.id).toBeTruthy();
      expect(Math.cos(twin!.rotationY - s.rotationY)).toBeCloseTo(-1);
    }
    // the classic wall banks are unchanged without the option
    expect(layoutFor('grand', true, true).decor.slots.every((s) => Math.abs(s.x) > 11)).toBe(true);
    const wallLine = { ...g.room, z0: -g.hallSpec!.length / 2 + 0.2 };
    const plan = planBanks([...g.slots, ...g.decor.slots], g.obstacles, g.room, wallLine);
    expect(plan.capsDropped).toBe(0);
    expect(plan.caps).toHaveLength(18); // 4 islands × 2 rows × 2 ends, plus the end-wall row's 2
    expect(plan.stoolsDropped).toBe(0);
    // the promenade stays clear (past the end-wall row's own stools, which stand in it as before)
    const lane = { x0: l.aisle.x0, x1: l.aisle.x1, z0: l.bounds.z0 + 1, z1: l.bounds.z1 };
    for (const o of plan.obstacles) expect(obstacleOverlaps(o, lane), o.id).toBe(false);
    useRoom(g.room);
    try {
      const nav = new NavGrid(ROOM, [...g.obstacles, ...plan.obstacles]);
      expect(nav.walkableAt(g.spawn)).toBe(true);
      for (const s of g.seats) expect(nav.walkableAt(s.approach), s.id).toBe(true);
      // a player can stand behind every stool, on both faces of every island
      for (const s of side) {
        const face = Math.sign(Math.sin(s.rotationY));
        expect(nav.walkableAt({ x: s.x + face * 1.55, z: s.z }), s.id).toBe(true);
      }
    } finally {
      useRoom(SALON_ROOM);
    }
  });

  it('island seam topper (96e9670, VA-0201): one run per island on the shared centre line, inside the caps, 2 draw calls', async () => {
    const { ISLAND_FROM_EDGE } = await import('../src/floor3d/grandHall.ts');
    const g = layoutFor('grand', true, true, { islands: true });
    const plan = planBanks([...g.slots, ...g.decor.slots], g.obstacles, g.room, { ...g.room, z0: -g.hallSpec!.length / 2 + 0.2 });
    const seams = islandSeams(plan);
    expect(seams).toHaveLength(4);
    const lineX = g.hallSpec!.width / 2 - 0.5 - ISLAND_FROM_EDGE;
    for (const s of seams) {
      expect(Math.abs(s.x)).toBeCloseTo(lineX, 5);
      expect(Math.abs(Math.sin(s.rotationY))).toBeCloseTo(0, 5); // runs along the hall (Z)
      // the island's caps stand past both ends, clear of the topper
      const caps = plan.caps.filter((c) => Math.abs(c.x - s.x) < 0.5 && Math.abs(c.z - s.z) < s.length / 2 + 0.6);
      expect(caps).toHaveLength(4);
      for (const c of caps) expect(Math.abs(c.z - s.z) - CAP.width / 2).toBeGreaterThan(s.length / 2 + 0.015);
    }
    // without islands there is nothing to top
    const walls = layoutFor('grand', true, true);
    expect(islandSeams(planBanks([...walls.slots, ...walls.decor.slots], walls.obstacles, walls.room))).toHaveLength(0);
    const t = buildIslandToppers(seams);
    expect(t.root.children).toHaveLength(2);
    expect(t.triangles).toBe(4 * 48);
    const b = new THREE.Box3().setFromObject(t.root);
    expect(b.max.y).toBeGreaterThan(CABINET_TOP);
    expect(b.max.y).toBeLessThan(CABINET_TOP + 0.03);
    expect(b.max.x - b.min.x).toBeGreaterThan(2 * lineX); // both sides of the hall
  });
});
