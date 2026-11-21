import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createVelvetCeilingCoffer } from '../../../art/casino/3d/velvetCeilingCoffer.mjs';
import { grandFloorLayout } from '../src/floor3d/grandHall.ts';
import { composeGrandHall, NEXT_CEILING_STYLE, REPLACED_BY_VELVET_COFFERS, velvetCofferCeiling, VELVET_COFFER_RELIEF } from '../src/floor3d/grandHallArt.ts';
import { buildArtScene, wallSideOf } from '../src/floor3d/artScene.ts';

const trisOf = (root: THREE.Object3D) => {
  let n = 0;
  root.traverse((o) => {
    const g = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh).geometry : null;
    if (g) n += (g.index?.count ?? g.attributes.position.count) / 3;
  });
  return n;
};

describe('ChatGPT coffer tile (193106d + 7945050, VA-0325)', () => {
  const tile = createVelvetCeilingCoffer(THREE) as THREE.Group;
  tile.updateMatrixWorld(true);
  it('is 8 meshes, 300 triangles, 4 materials, all hanging above its mount point', () => {
    const meshes: THREE.Mesh[] = [];
    tile.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    expect(meshes).toHaveLength(8);
    expect(trisOf(tile)).toBe(300);
    expect(new Set(meshes.map((m) => m.material)).size).toBe(4);
    const box = new THREE.Box3().setFromObject(tile);
    expect(box.min.y).toBeGreaterThan(0);
    expect(box.max.y).toBeCloseTo(VELVET_COFFER_RELIEF, 4);
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
    // the art leaves a 1 cm slit between the inset (|x| 1.65) and the frame's opening (1.66):
    // nothing in the tile covers it, so the hall slab has to stay behind the grid
    expect(hit(1.655, 0)).toBeUndefined();
  });
});

describe('coffer-tile ceiling in the grand hall (VA-0325, preview only)', () => {
  const g = grandFloorLayout();
  const spec = g.hallSpec!;
  it('tiles the hall exactly, inset tops flush with the slab underside', () => {
    const grid = velvetCofferCeiling(spec);
    expect(grid.userData.tilesX * grid.userData.tileWidth).toBeCloseTo(spec.width, 6);
    expect(grid.userData.tilesZ * grid.userData.tileDepth).toBeCloseTo(spec.length, 6);
    expect(grid.userData.tileWidth).toBeGreaterThan(3);
    expect(grid.userData.tileWidth).toBeLessThan(4.2);
    grid.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(grid);
    expect(box.max.y).toBeCloseTo(spec.height - 0.09, 4);
    expect(box.min.x).toBeCloseTo(-spec.width / 2, 4);
    expect(box.max.z).toBeCloseTo(spec.length / 2, 4);
    // 300 tris a tile
    expect(trisOf(grid)).toBe(300 * grid.userData.tilesX * grid.userData.tilesZ);
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
    // 560 authored tile meshes collapse into one batch per material (4), minus the hall coffers' batches
    expect(tiles.meshesAuthored - hall.meshesAuthored).toBeGreaterThan(400);
    expect(tiles.batches - hall.batches).toBeLessThanOrEqual(4);
    const seen = new Set<string>();
    let s: keyof typeof NEXT_CEILING_STYLE = 'hall';
    for (let i = 0; i < 3; i++) { seen.add(s); s = NEXT_CEILING_STYLE[s]; }
    expect(seen.size).toBe(3);
    expect(s).toBe('hall');
  });
});
