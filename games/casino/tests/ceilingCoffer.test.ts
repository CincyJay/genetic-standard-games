import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createVelvetCeilingCoffer } from '../../../art/casino/3d/velvetCeilingCoffer.mjs';
import { grandFloorLayout, hallCameraClamp, hallColumns, grandHallLayout, GRAND_SPEC } from '../src/floor3d/grandHall.ts';
import { composeGrandHall, NEXT_CEILING_STYLE, REPLACED_BY_VELVET_COFFERS, velvetCofferCeiling, velvetCofferLines, VELVET_COFFER_RELIEF } from '../src/floor3d/grandHallArt.ts';
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
    // 236 tris a tile
    expect(trisOf(grid)).toBe(236 * 63);
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
