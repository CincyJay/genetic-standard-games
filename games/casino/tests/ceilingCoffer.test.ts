import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createVelvetCeilingCoffer } from '../../../art/casino/3d/velvetCeilingCoffer.mjs';
import { grandFloorLayout, hallCameraClamp, hallColumns, grandHallLayout, GRAND_SPEC } from '../src/floor3d/grandHall.ts';
import { cofferDiffuserEdges, cofferEdgeOwnershipFrom, composeGrandHall, NEXT_CEILING_STYLE, REPLACED_BY_VELVET_COFFERS, velvetCofferCeiling, velvetCofferLines, VELVET_COFFER_RELIEF } from '../src/floor3d/grandHallArt.ts';
import { buildArtScene, wallSideOf } from '../src/floor3d/artScene.ts';

const trisOf = (root: THREE.Object3D) => {
  let n = 0;
  root.traverse((o) => {
    const g = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry : null;
    if (g) n += (g.index?.count ?? g.attributes.position.count) / 3;
  });
  return n;
};

describe('ChatGPT coffer tile (193106d + 7945050 + 5e2e896 + 7a08320, VA-0325/VA-0327/VA-0330)', () => {
  const tile = createVelvetCeilingCoffer(THREE) as THREE.Group;
  tile.updateMatrixWorld(true);
  it('is 8 meshes, 236 triangles, 4 materials, hanging 0.474 m from the inset top (5e2e896 deeper beams)', () => {
    const meshes: THREE.Mesh[] = [];
    tile.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    expect(meshes).toHaveLength(8);
    expect(trisOf(tile)).toBe(236);
    expect(new Set(meshes.map((m) => m.material)).size).toBe(4);
    const box = new THREE.Box3().setFromObject(tile);
    // rosettes are the lowest pieces (-0.33 -/+ 0.0065); the frame's soffit is at -0.30
    expect(box.min.y).toBeCloseTo(-0.3365, 4);
    expect(box.max.y).toBeCloseTo(VELVET_COFFER_RELIEF, 4);
    const frame = new THREE.Box3().setFromObject(tile.getObjectByName('coffer_plaster_frame')!);
    expect(frame.min.y).toBeCloseTo(-0.3, 4);
    expect(frame.max.y).toBeCloseTo(0.08, 4);
  });
  it('shows downward-facing faces from below (extrude winding and rosette discs face the floor)', () => {
    const rc = new THREE.Raycaster();
    const hit = (x: number, z: number) => {
      rc.set(new THREE.Vector3(x, -3, z), new THREE.Vector3(0, 1, 0));
      return rc.intersectObject(tile, true)[0];
    };
    for (const [x, z, name] of [[0, 0, 'coffer_inset'], [1.575, 0, 'coffer_light_diffuser'], [1.63, 0, 'coffer_bronze_bead'], [1.7, 0, 'coffer_plaster_frame'], [1.61, 1.61, 'corner_rosette']] as const) {
      const h = hit(x, z);
      expect(h?.object.name).toBe(name);
      const n = h!.face!.normal.clone().transformDirection(h!.object.matrixWorld);
      expect(n.y).toBeLessThan(-0.99);
    }
    // 7a08320 widened the bead (to |x| 1.67) and diffuser (to 1.60): from below, nothing shows the
    // inset between the frame and the diffuser's inner edge (1.5675) any more
    for (let x = 1.57; x <= 1.8; x += 0.0025) expect(hit(x, 0.5)?.object.name).not.toBe('coffer_inset');
    expect(hit(1.655, 0)?.object.name).toBe('coffer_bronze_bead');
    expect(hit(1.5875, 0)?.object.name).toBe('coffer_light_diffuser');
    expect(hit(1.55, 0)?.object.name).toBe('coffer_inset');
  });
  it('touches: the bead overlaps the frame and the diffuser overlaps the bead (7a08320)', () => {
    const box = (n: string) => new THREE.Box3().setFromObject(tile.getObjectByName(n)!);
    const frame = box('coffer_plaster_frame'), bead = box('coffer_bronze_bead'), diff = box('coffer_light_diffuser');
    // vertical overlap: bead top -0.287 above the frame soffit -0.30; diffuser top -0.310 above bead bottom -0.315
    expect(bead.max.y - frame.min.y).toBeCloseTo(0.013, 4);
    expect(diff.max.y - bead.min.y).toBeCloseTo(0.005, 4);
    // horizontal overlap of 1 cm each: bead outer 1.67 past frame inner 1.66; diffuser outer 1.60 past bead inner 1.59
    expect(bead.max.x).toBeCloseTo(1.67, 4);
    expect(diff.max.x).toBeCloseTo(1.6, 4);
    const mat = (n: string) => (tile.getObjectByName(n) as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(mat('coffer_inset').emissiveIntensity).toBeCloseTo(0.16, 6);
    expect(mat('coffer_light_diffuser').emissiveIntensity).toBeCloseTo(0.24, 6);
  });
});

describe('ChatGPT diffuser edge option (f88efe3, VA-0332)', () => {
  const build = (diffuserEdges?: { n: boolean; s: boolean; e: boolean; w: boolean }) => {
    const t = createVelvetCeilingCoffer(THREE, diffuserEdges ? { diffuserEdges } : {}) as THREE.Group;
    t.updateMatrixWorld(true);
    return t;
  };
  const names = (t: THREE.Object3D) => { const a: string[] = []; t.traverse((o) => { if ((o as THREE.Mesh).isMesh) a.push(o.name); }); return a; };
  const all = { n: true, s: true, e: true, w: true };
  const none = { n: false, s: false, e: false, w: false };
  it('without the option keeps the single ring (8 meshes, 236 tris)', () => {
    const t = build();
    expect(names(t)).toContain('coffer_light_diffuser');
    expect(trisOf(t)).toBe(236);
  });
  it('builds one 12-tri box strip per selected edge; none leaves 7 meshes', () => {
    expect(names(build(all)).filter((n) => n.startsWith('coffer_light_diffuser'))).toEqual(['coffer_light_diffuser_n', 'coffer_light_diffuser_s', 'coffer_light_diffuser_e', 'coffer_light_diffuser_w']);
    const base = trisOf(build(none));
    expect(names(build(none))).toHaveLength(7);
    expect(trisOf(build(all)) - base).toBe(48);
    for (const k of ['n', 's', 'e', 'w'] as const) {
      const t = build({ ...none, [k]: true });
      expect(names(t).filter((n) => n.startsWith('coffer_light_diffuser'))).toEqual([`coffer_light_diffuser_${k}`]);
      expect(trisOf(t) - base).toBe(12);
    }
    expect(() => createVelvetCeilingCoffer(THREE, { diffuserEdges: { n: true } })).toThrow(TypeError);
  });
  it('all four strips cover the old ring footprint from below, without overlapping at the corners, faces down', () => {
    const ring = build(), strips = build(all);
    const rc = new THREE.Raycaster();
    const hitName = (t: THREE.Object3D, x: number, z: number) => {
      rc.set(new THREE.Vector3(x, -3, z), new THREE.Vector3(0, 1, 0));
      return rc.intersectObject(t, true)[0];
    };
    for (let x = -1.79; x <= 1.79; x += 0.0125) for (const z of [-1.585, -0.7, 0, 1.2, 1.585]) {
      const a = hitName(ring, x, z)!.object.name, b = hitName(strips, x, z)!;
      expect(b.object.name.startsWith('coffer_light_diffuser')).toBe(a === 'coffer_light_diffuser');
    }
    // corners belong to the east/west strips only
    const c = new THREE.Box3().setFromObject(strips.getObjectByName('coffer_light_diffuser_n')!);
    const e = new THREE.Box3().setFromObject(strips.getObjectByName('coffer_light_diffuser_e')!);
    expect(c.max.x).toBeCloseTo(e.min.x, 6);
    const h = hitName(strips, 0, -1.585)!;
    expect(h.object.name).toBe('coffer_light_diffuser_n');
    expect(h.face!.normal.clone().transformDirection(h.object.matrixWorld).y).toBeLessThan(-0.99);
  });
  it('measured: the strips hang 1.2 cm lower than the ring and leave a 7 mm vertical gap under the bead (reported, not changed)', () => {
    const t = build(all);
    const s = new THREE.Box3().setFromObject(t.getObjectByName('coffer_light_diffuser_e')!);
    const bead = new THREE.Box3().setFromObject(t.getObjectByName('coffer_bronze_bead')!);
    const ring = new THREE.Box3().setFromObject(build().getObjectByName('coffer_light_diffuser')!);
    expect(s.min.y).toBeCloseTo(-0.334, 4);
    expect(s.max.y).toBeCloseTo(-0.322, 4);
    expect(ring.min.y).toBeCloseTo(-0.322, 4);
    expect(bead.min.y - s.max.y).toBeCloseTo(0.007, 4);
    // horizontally the strip still reaches 1 cm under the bead
    expect(s.max.x - (bead.max.x - 0.08)).toBeCloseTo(0.01, 4);
  });
});

describe('coffer-tile ceiling in the grand hall (VA-0325, preview only)', () => {
  const g = grandFloorLayout();
  const spec = g.hallSpec!;
  it('tiles the hall exactly, inset tops flush with the slab underside, beams above the camera clamp', () => {
    const grid = velvetCofferCeiling(spec);
    const { xs, zs } = grid.userData as { xs: number[]; zs: number[] };
    expect(xs[0]).toBeCloseTo(-spec.width / 2, 6);
    expect(xs[xs.length - 1]).toBeCloseTo(spec.width / 2, 6);
    expect(zs[0]).toBeCloseTo(-spec.length / 2, 6);
    expect(zs[zs.length - 1]).toBeCloseTo(spec.length / 2, 6);
    for (const ls of [xs, zs]) for (let i = 1; i < ls.length; i++) {
      expect(ls[i] - ls[i - 1]).toBeGreaterThan(3);
      expect(ls[i] - ls[i - 1]).toBeLessThan(4.2);
    }
    // 24 x 36 m: 7 x 9 tiles
    expect([grid.userData.tilesX, grid.userData.tilesZ]).toEqual([7, 9]);
    grid.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(grid);
    expect(box.max.y).toBeCloseTo(spec.height - 0.09, 4);
    expect(box.min.y).toBeCloseTo(spec.height - 0.09 - VELVET_COFFER_RELIEF - 0.3365, 4);
    expect(box.min.y).toBeGreaterThan(hallCameraClamp(grandHallLayout(GRAND_SPEC)).y1);
    expect(box.min.x).toBeCloseTo(-spec.width / 2, 4);
    expect(box.max.z).toBeCloseTo(spec.length / 2, 4);
    // per tile 236 tris less the 32-tri ring; the 7 x 9 grid owns 7*9*2 + 7 + 9 = 142 strips of 12 tris
    expect(trisOf(grid)).toBe((236 - 32) * 63 + 142 * 12);
    expect(trisOf(velvetCofferCeiling(spec, false))).toBe(236 * 63);
  });
  it('lights every beam once: shared edges owned by exactly one neighbour, the hall perimeter too', () => {
    const X = 7, Z = 9;
    const vert = new Map<string, number>(), horiz = new Map<string, number>();
    const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
    for (let i = 0; i < X; i++) for (let j = 0; j < Z; j++) {
      const e = cofferDiffuserEdges(i, j, X, Z);
      if (e.w) bump(vert, `${i},${j}`);
      if (e.e) bump(vert, `${i + 1},${j}`);
      if (e.n) bump(horiz, `${i},${j}`);
      if (e.s) bump(horiz, `${i},${j + 1}`);
    }
    expect(cofferEdgeOwnershipFrom('?floor3d')).toBe(true);
    expect(cofferEdgeOwnershipFrom('?floor3d&cofferedges=ring')).toBe(false);
    expect(vert.size).toBe((X + 1) * Z);
    expect(horiz.size).toBe(X * (Z + 1));
    for (const v of [...vert.values(), ...horiz.values()]) expect(v).toBe(1);
  });
  it('puts every colonnade column on a frame intersection', () => {
    const { xs, zs } = velvetCofferLines(spec);
    const cols = hallColumns(spec);
    expect(cols.length).toBeGreaterThan(0);
    for (const c of cols) {
      expect(Math.min(...xs.map((x) => Math.abs(x - c.x)))).toBeLessThan(1e-6);
      expect(Math.min(...zs.map((z) => Math.abs(z - c.z)))).toBeLessThan(1e-6);
    }
    // without the colonnade it is an even ~3.6 m grid
    const even = velvetCofferLines({ width: spec.width, length: spec.length });
    expect([even.xs.length - 1, even.zs.length - 1]).toEqual([7, 10]);
  });
  it('keeps the slab and ring chandeliers, drops the hall coffers and cove strips', () => {
    const names: string[] = [];
    composeGrandHall(g, { liftSign: () => 0, ceiling: 'velvet-coffers' }).root.traverse((o) => names.push(o.name));
    expect(names).toContain('ceiling-base');
    expect(names).toContain('suspended-ring-chandelier');
    expect(names.some((n) => REPLACED_BY_VELVET_COFFERS.test(n))).toBe(false);
    expect(names.filter((n) => n === 'coffer_inset').length).toBeGreaterThan(50);
  });
  it('is all roof, batches to a handful of draws, and is in the prototype toggle cycle', () => {
    for (const n of ['coffer_inset', 'coffer_plaster_frame', 'coffer_bronze_bead', 'coffer_light_diffuser', 'corner_rosette']) expect(wallSideOf(n, 0)).toBe('roof');
    const hall = buildArtScene(new Map(), { layout: g, ceiling: 'hall' });
    const tiles = buildArtScene(new Map(), { layout: g, ceiling: 'velvet-coffers' });
    // 504 authored tile meshes collapse into one batch per material (4), minus the hall coffers' batches
    expect(tiles.meshesAuthored - hall.meshesAuthored).toBeGreaterThan(400);
    expect(tiles.batches - hall.batches).toBeLessThanOrEqual(4);
    const seen = new Set<string>();
    let s: keyof typeof NEXT_CEILING_STYLE = 'hall';
    for (let i = 0; i < 3; i++) { seen.add(s); s = NEXT_CEILING_STYLE[s]; }
    expect(seen.size).toBe(3);
    expect(s).toBe('hall');
  });
});
