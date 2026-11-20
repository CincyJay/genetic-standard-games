import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { layoutFor } from '../src/floor3d/grandHall.ts';
import { obstaclesFor, SEATS, SPAWN, ROOM, SALON_ROOM, useRoom } from '../src/floor3d/layout.ts';
import { NavGrid } from '../src/floor3d/nav.ts';
import { buildArtScene } from '../src/floor3d/artScene.ts';
import { ART_FAR_STOOL_SEAT_HEIGHT, artFarStool, BANK, FAR_STOOL_DROP, FAR_STOOL_SEGMENTS, farStool, SVELTE_NEAR_STOOLS, buildIslandToppers, buildSvelteCaps, CAP_BULB_FAR_M, CABINET_TOP, islandSeams, CAP, capObstacle, planBanks, fitCaps, SVELTE_PAIR_X, svelteRowCaps, slimNearCabinet, slimLodCabinet, SLIM_SCREEN, SLIM_MARQUEE } from '../src/floor3d/svelteFloor.ts';

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

  it('?capbulbs=lod: far caps draw ChatGPT\'s 8-tri bulb, same count, radius, matrices and chase (VA-0232)', () => {
    const caps = [0, 1, 2, 3].map((i) => ({ x: i * 10, z: 0, rotationY: i }));
    const plain = buildSvelteCaps(caps);
    const lod = buildSvelteCaps(caps, { bulbLod: CAP_BULB_FAR_M });
    const inst = (r: THREE.Object3D) => r.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    const [ref] = inst(plain.root);
    const [near, far] = inst(lod.root);
    expect(far.name).toBe('svelte_end_caps:marquee_chase_bulbs_far');
    expect(far.geometry.attributes.position!.count / 3).toBe(8);
    far.geometry.computeBoundingSphere(); near.geometry.computeBoundingSphere();
    expect(far.geometry.boundingSphere!.radius).toBeCloseTo(near.geometry.boundingSphere!.radius, 5);
    expect(far.material).toBe(near.material);
    const n = ref.count / caps.length;
    // starts all near: identical to the default
    expect(near.count).toBe(ref.count);
    expect(far.visible).toBe(false);
    // camera at the first cap: caps at 10 m stay near, 20 m and 30 m go far; total bulbs unchanged
    lod.update(new THREE.Vector3(0, 1.6, 0));
    expect(lod.farCaps()).toBe(2);
    expect(near.count + far.count).toBe(ref.count);
    expect(far.count).toBe(2 * n);
    const a = new THREE.Matrix4(), b = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      far.getMatrixAt(i, a); ref.getMatrixAt(2 * n + i, b);
      expect(a.elements.every((e, j) => Math.abs(e - b.elements[j]) < 1e-9)).toBe(true);
    }
    // the far caps keep chasing with the authored colours
    lod.animate(0.7); plain.animate(0.7);
    const fc = far.instanceColor!.array, rc = ref.instanceColor!.array;
    for (let i = 0; i < n * 3; i++) expect(fc[i]).toBeCloseTo(rc[2 * n * 3 + i], 6);
    // hysteresis: just inside the threshold doesn't flip back; well inside does
    lod.update(new THREE.Vector3(20 - CAP_BULB_FAR_M + 0.2, 1.6, 0));
    expect(lod.farCaps()).toBe(2);
    // camera at x=12: the 20 m cap (8 m away) comes back near, the 30 m cap (18 m) stays far
    lod.update(new THREE.Vector3(12, 1.6, 0));
    expect(lod.farCaps()).toBe(1);
    expect(far.count).toBe(n);
    expect(near.count + far.count).toBe(ref.count);
    // default caps have no far mesh and ignore the camera
    plain.update(new THREE.Vector3(1000, 0, 0));
    expect(inst(plain.root)).toHaveLength(1);
    expect(plain.farCaps()).toBe(0);
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
    // VA-0230: fewer segments on the round parts (was 626 with the authored counts)
    expect(tris(far)).toBe(406);
    // same parts, same radii/heights/arcs, same placement: only the segment counts change
    const geo = (o: THREE.Object3D) => { const r = new Map<string, THREE.Mesh>(); o.traverse((m) => { if ((m as THREE.Mesh).isMesh) r.set(m.name, m as THREE.Mesh); }); return r; };
    const a = geo(stool), b = geo(far);
    const SEG = new Set(['radialSegments', 'tubularSegments', 'widthSegments']);
    for (const [name, mf] of b) {
      const ma = a.get(name)!;
      expect(mf.position.toArray()).toEqual(ma.position.toArray());
      expect(mf.quaternion.toArray()).toEqual(ma.quaternion.toArray());
      expect(mf.material).toBe(ma.material);
      const pa = (ma.geometry as unknown as { parameters: Record<string, unknown> }).parameters;
      const pf = (mf.geometry as unknown as { parameters: Record<string, unknown> }).parameters;
      for (const k of Object.keys(pa)) if (!SEG.has(k)) expect(pf[k], `${name}.${k}`).toBe(pa[k]);
      if (FAR_STOOL_SEGMENTS[name]) expect(mf.geometry.type).toBe(ma.geometry.type);
    }
    const boxA = new THREE.Box3().setFromObject(stool), boxB = new THREE.Box3().setFromObject(far);
    // within 1.5 cm of the authored stool's bounds (fewer sides cut the circles' extremes slightly)
    for (const k of ['min', 'max'] as const) for (const ax of ['x', 'y', 'z'] as const) expect(Math.abs(boxB[k][ax] - boxA[k][ax])).toBeLessThan(0.015);
    // the near stool is untouched
    expect(tris(createVelvetSlotStool(THREE) as THREE.Group)).toBe(1118);

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
    // stools add 406 triangles each, plus 712 more for each of the nearest
    const cabinetsOnly = lod.root.children[0];
    let cabTris = 0;
    cabinetsOnly.traverse((o) => { const im = o as THREE.InstancedMesh; if (im.isInstancedMesh && im.visible) cabTris += (im.geometry.index ? im.geometry.index.count : im.geometry.attributes.position!.count) / 3 * im.count; });
    expect(lod.triangles() - cabTris).toBe(n * 406 + Math.min(n, SVELTE_NEAR_STOOLS) * 712);
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

  it('slim near cabinet (VA-0216/0218, opt-in): faces +Z like the Svelte cabinet, reel plane behind the rails and in front of the backplane, one screen bucket', async () => {
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
    // fills the 0.58 × 0.69 m opening (64d62ce) and tucks under the rails, never past their outer edges
    const railBox = (n: string) => box(new RegExp(`^reel_${n}_rail$`));
    expect(screen.max.x).toBeLessThan(rails.max.x);
    expect(screen.max.x).toBeGreaterThan(railBox('left').max.x * -1);
    expect(screen.max.y).toBeLessThan(rails.max.y);
    expect(screen.max.y).toBeGreaterThan(railBox('top').min.y);
    expect(screen.min.y).toBeGreaterThan(rails.min.y);
    expect(screen.min.y).toBeLessThan(railBox('bottom').max.y);
    expect(screen.getCenter(new THREE.Vector3()).y).toBeCloseTo(SLIM_SCREEN.y, 2);
    // the reels are within 4 % of the canvas reel area's 467:540 aspect (VA-0217 measured ~10 % squeeze)
    expect((SLIM_SCREEN.open.w / SLIM_SCREEN.open.h) / (467 / 540)).toBeGreaterThan(0.96);
    // the screen plane faces the player (+Z)
    const n = new THREE.Vector3();
    cab.traverse((m) => { if (m.name === 'slim_reel_screen') n.fromBufferAttribute((m as THREE.Mesh).geometry.attributes.normal as THREE.BufferAttribute, 0).transformDirection(m.matrixWorld); });
    expect(n.z).toBeGreaterThan(0.99);
    // the marquee sits just proud of the upper display face, inside its outline, facing the player
    const upper = box(/^upper_display_face$/);
    const marquee = box(/^slim_marquee_screen$/);
    expect(marquee.max.z).toBeGreaterThan(upper.max.z);
    expect(marquee.max.z - upper.max.z).toBeLessThan(0.01);
    expect(marquee.min.x).toBeGreaterThan(upper.min.x);
    expect(marquee.max.x).toBeLessThan(upper.max.x);
    expect(marquee.min.y).toBeGreaterThan(upper.min.y);
    expect(marquee.max.y).toBeLessThan(upper.max.y);
    expect(marquee.getCenter(new THREE.Vector3()).y).toBeCloseTo(SLIM_MARQUEE.y, 2);
    const { buckets } = cabinetBuckets(cab);
    // reels and marquee share the machine's screen material: still one screen bucket
    expect(buckets.filter((b) => b.screen)).toHaveLength(1);
    // shell, gold, glass, accent, 64d62ce's button gold, screen: one more call than accd383 for all near cabinets
    expect(buckets.length).toBeLessThanOrEqual(6);
    // five deck buttons, on the player's side of the deck
    const buttons: THREE.Object3D[] = [];
    cab.traverse((m) => { if (/^deck_button_\d$/.test(m.name)) buttons.push(m); });
    expect(buttons).toHaveLength(5);
    // stands on the floor; since 5b2f151 (VA-0222) the light bars sit on the rail fronts (±0.304), so
    // the extremes are the mirrored spines (±0.309): 0.618 m, under the 0.64 m pitch, so neighbours do not overlap
    const all = new THREE.Box3().setFromObject(cab);
    expect(all.min.y).toBeCloseTo(0, 6);
    expect(all.max.x - all.min.x).toBeCloseTo(0.618, 3);
    expect(all.max.x - all.min.x).toBeLessThan(BANK.pitchMin);
    // inside the bank's collision depth (back -0.42, front 0.6)
    expect(all.min.z).toBeGreaterThan(BANK.backZ);
    expect(all.max.z).toBeLessThan(BANK.frontZ);
  });

  it.each(['mid', 'far'] as const)('slim %s LOD (4530e71, VA-0226, opt-in): same footprint and screens as the slim near cabinet, few buckets', async (level) => {
    const { cabinetBuckets } = await import('../src/floor3d/svelteFloorBatch.ts');
    const cab = slimLodCabinet(level);
    cab.updateMatrixWorld(true);
    const near = slimNearCabinet();
    near.updateMatrixWorld(true);
    const box = (o: THREE.Object3D, name: RegExp) => { const b = new THREE.Box3(); o.traverse((m) => { if ((m as THREE.Mesh).isMesh && name.test(m.name)) b.expandByObject(m); }); return b; };
    // deck on the player's side (+Z), like the near level
    expect(box(cab, /^angled_deck$/).getCenter(new THREE.Vector3()).z).toBeGreaterThan(0.15);
    // reel plane: behind the rails' fronts, in front of the backplane, inside the rails' outer edges
    const screen = box(cab, /^slim_reel_screen$/);
    const rails = box(cab, /^reel_(left|right|top|bottom)$/);
    const back = box(cab, /^reel_backplane$/);
    expect(screen.max.z).toBeLessThan(rails.max.z);
    expect(screen.min.z).toBeGreaterThan(back.max.z - 0.03);
    expect(screen.max.x).toBeLessThan(rails.max.x);
    expect(screen.min.x).toBeGreaterThan(rails.min.x);
    expect(screen.max.y).toBeLessThan(rails.max.y);
    expect(screen.min.y).toBeGreaterThan(rails.min.y);
    // the LOD's reel opening lines up with the near's within 1 cm (no shift at the switch)
    const nearRails = box(near, /^reel_(left|right|top|bottom)_rail$/);
    for (const k of ['min', 'max'] as const) for (const a of ['x', 'y'] as const) expect(Math.abs(rails[k][a] - nearRails[k][a])).toBeLessThan(0.01);
    // the marquee sits just proud of the upper display face, inside it
    const upper = box(cab, /^upper_display_face$/);
    const marquee = box(cab, /^slim_marquee_screen$/);
    expect(marquee.max.z).toBeGreaterThan(upper.max.z);
    expect(marquee.max.z - upper.max.z).toBeLessThan(0.01);
    expect(marquee.min.x).toBeGreaterThan(upper.min.x);
    expect(marquee.max.x).toBeLessThan(upper.max.x);
    // stands on the floor, under the bank pitch, inside the bank's collision depth
    const all = new THREE.Box3().setFromObject(cab);
    expect(all.min.y).toBeCloseTo(0, 6);
    expect(all.max.x - all.min.x).toBeLessThan(BANK.pitchMin);
    expect(all.min.z).toBeGreaterThan(BANK.backZ);
    expect(all.max.z).toBeLessThan(BANK.frontZ);
    // control deck and its gold lip (6b03953 + 71678c2, VA-0230): one of each, where the near's are to 1 mm, so no deck pop at the switch
    const count = (o: THREE.Object3D, name: RegExp) => { let n = 0; o.traverse((m) => { if ((m as THREE.Mesh).isMesh && name.test(m.name)) n++; }); return n; };
    expect(count(cab, /^angled_deck$/)).toBe(1);
    expect(count(cab, /^deck_lip$/)).toBe(1);
    for (const [lod, nr] of [[/^angled_deck$/, /^angled_control_deck$/], [/^deck_lip$/, /^deck_gold_lip$/]] as const) {
      const a = box(cab, lod), b = box(near, nr);
      for (const k of ['min', 'max'] as const) for (const ax of ['x', 'y', 'z'] as const) expect(Math.abs(a[k][ax] - b[k][ax])).toBeLessThan(0.001);
    }
    // mid: the five buttons where the near's are (to 1 mm); far: one strip
    expect(count(cab, /^deck_button_\d$/)).toBe(level === 'mid' ? 5 : 0);
    if (level === 'mid') for (let i = 1; i <= 5; i++) {
      const a = box(cab, new RegExp(`^deck_button_${i}$`)).getCenter(new THREE.Vector3()), b = box(near, new RegExp(`^deck_button_${i}$`)).getCenter(new THREE.Vector3());
      expect(a.distanceTo(b)).toBeLessThan(0.001);
    }
    const { buckets } = cabinetBuckets(cab);
    expect(buckets.filter((b) => b.screen)).toHaveLength(1);
    expect(buckets.length).toBeLessThanOrEqual(level === 'mid' ? 6 : 5);
  });

  it.each([
    ['along', 18, 0], // VA-0197: 4 islands × 2 rows × 2 ends, plus the end-wall row's 2
    ['across', 34, 1], // Joshua 2026-11-19 "Turn them crosswise": 8 islands × 2 rows × 2 ends, plus 2
  ] as const)('islands (%s): the grand hall side banks stand back to back, caps and stools all fit, every machine reachable', async (islandDir, capCount, rowAxisX) => {
    const { grandHallLayout, GRAND_SPEC, ISLAND_HALF, obstacleOverlaps } = await import('../src/floor3d/grandHall.ts');
    const g = layoutFor('grand', true, true, { islands: true, islandDir });
    const l = grandHallLayout({ ...GRAND_SPEC, islands: true, islandDir });
    const side = l.slots.filter((s) => !s.id.startsWith('end-'));
    const facing = (s: { rotationY: number }) => ({ x: Math.round(Math.sin(s.rotationY)), z: Math.round(Math.cos(s.rotationY)) });
    // every side spot has a twin 2 × ISLAND_HALF behind it facing the other way (a shared centre line)
    for (const s of side) {
      const f = facing(s);
      // rows run along X when crosswise (machines face up and down the hall), along Z otherwise
      expect(Math.abs(f.z), s.id).toBe(rowAxisX);
      const twin = side.find((t) => Math.hypot(t.x - (s.x - f.x * 2 * ISLAND_HALF), t.z - (s.z - f.z * 2 * ISLAND_HALF)) < 1e-6);
      expect(twin, s.id).toBeTruthy();
      expect(Math.cos(twin!.rotationY - s.rotationY)).toBeCloseTo(-1);
    }
    // the classic wall banks are unchanged without the option
    expect(layoutFor('grand', true, true).decor.slots.every((s) => Math.abs(s.x) > 11)).toBe(true);
    const wallLine = { ...g.room, z0: -g.hallSpec!.length / 2 + 0.2 };
    const plan = planBanks([...g.slots, ...g.decor.slots], g.obstacles, g.room, wallLine);
    expect(plan.capsDropped).toBe(0);
    expect(plan.caps).toHaveLength(capCount);
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
        const f = facing(s);
        for (const off of [-0.32, 0.32]) {
          const along = { x: f.z, z: f.x }; // across the facing: along the row
          expect(nav.walkableAt({ x: s.x + f.x * 1.55 + along.x * off, z: s.z + f.z * 1.55 + along.z * off }), s.id).toBe(true);
        }
      }
    } finally {
      useRoom(SALON_ROOM);
    }
  });

  it('island seam topper (96e9670, VA-0201): one run per island on the shared centre line, inside the caps, 2 draw calls', async () => {
    const { ISLAND_FROM_EDGE } = await import('../src/floor3d/grandHall.ts');
    // the topper study was made on the long VA-0197 islands; crosswise ones get one seam each too
    const cross = layoutFor('grand', true, true, { islands: true });
    const crossSeams = islandSeams(planBanks([...cross.slots, ...cross.decor.slots], cross.obstacles, cross.room, { ...cross.room, z0: -cross.hallSpec!.length / 2 + 0.2 }));
    expect(crossSeams).toHaveLength(8);
    for (const s of crossSeams) expect(Math.abs(Math.cos(s.rotationY))).toBeCloseTo(0, 5); // runs across the hall (X)
    const g = layoutFor('grand', true, true, { islands: true, islandDir: 'along' });
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
