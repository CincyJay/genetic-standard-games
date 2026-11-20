import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createVelvetTripleSlotCabinet } from '../../../art/casino/3d/velvetTripleScreenSlotStudy.mjs';
import { TRIPLE_SCREENS, cabinetReport, fitScreenUvs, mountScreenTexture } from '../src/floor3d/tripleSlot.ts';

describe('triple-screen slot cabinet study (art 1670e35, VA-0256)', () => {
  const cab = createVelvetTripleSlotCabinet(THREE);
  const report = cabinetReport(THREE, cab);

  it('builds with three named screen surfaces whose front caps face +Z', () => {
    expect(cab.userData.front).toBe('+Z');
    expect(Object.keys(report.screensFacingFront).sort()).toEqual([...TRIPLE_SCREENS].sort());
    for (const s of TRIPLE_SCREENS) expect(report.screensFacingFront[s]).toBe(1);
  });

  it('stands on the floor at about 0.88 x 2.42 m and fits a 0.45 m collision half-width', () => {
    // the plinth sat 5 mm above the floor in 1670e35; ff6752a seats it on y 0
    expect(report.bounds.min[1]).toBeGreaterThanOrEqual(0);
    expect(report.bounds.min[1]).toBeLessThan(0.001);
    expect(report.bounds.max[1]).toBeGreaterThan(2.35);
    expect(report.bounds.max[1]).toBeLessThan(2.45);
    expect(Math.max(-report.bounds.min[0], report.bounds.max[0])).toBeLessThan(0.45);
    // since ff6752a (VA-0258) the console deck projects forward to z 0.56; the rear stays at -0.39
    expect(-report.bounds.min[2]).toBeLessThan(0.45);
    expect(report.bounds.max[2]).toBeLessThan(0.6);
  });

  it('is cheap: under 6k triangles, 6 authored materials', () => {
    expect(report.triangles).toBeLessThan(6000);
    expect(report.materials).toBe(6);
  });

  it('glass is in front of its bezel, and both in front of the tower', () => {
    const z = (name: string) => new THREE.Box3().setFromObject(cab.getObjectByName(name)!).max.z;
    for (const s of TRIPLE_SCREENS) expect(z(`VA_${s}_glass`)).toBeGreaterThan(z(`VA_${s}_bezel`));
    // fb9008f (VA-0263) replaced the extruded slab 'VA_tapered_tower' with a swept body
    expect(z('VA_main_reels_5x5_bezel')).toBeGreaterThan(z('VA_curved_tapered_tower'));
  });

  // VA-0257 found the console and buttons buried inside the base; fixed in ff6752a (VA-0258)
  it('player console and buttons stand in front of and above the burgundy base', () => {
    const box = (name: string) => new THREE.Box3().setFromObject(cab.getObjectByName(name)!);
    const base = box('VA_burgundy_base');
    for (let i = 1; i <= 5; i++) {
      expect(box(`VA_player_button_${i}`).max.z).toBeGreaterThan(base.max.z + 0.005);
      expect(box(`VA_player_button_${i}`).min.y).toBeGreaterThan(base.max.y);
    }
    expect(box('VA_console_ledge').max.z).toBeGreaterThan(base.max.z);
    // plinth and base now overlap instead of leaving a 12 mm gap
    expect(box('VA_weighted_plinth').max.y).toBeGreaterThanOrEqual(base.min.y);
  });

  // VA-0261 found the deck tilted away from the player; fb9008f (VA-0263) flipped it to +0.14 rad
  it('console deck top tilts toward the player', () => {
    const deck = cab.getObjectByName('VA_console_ledge')!;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(deck.getWorldQuaternion(new THREE.Quaternion()));
    expect(up.z).toBeGreaterThan(0.02);
  });

  // deck top surface height at a given z (deck is a rotated box)
  const deckTopAt = (z: number) => {
    const deck = cab.getObjectByName('VA_console_ledge') as THREE.Mesh;
    deck.updateWorldMatrix(true, false);
    deck.geometry.computeBoundingBox();
    const bb = deck.geometry.boundingBox!;
    const rear = new THREE.Vector3(0, bb.max.y, bb.min.z).applyMatrix4(deck.matrixWorld);
    const front = new THREE.Vector3(0, bb.max.y, bb.max.z).applyMatrix4(deck.matrixWorld);
    return { y: rear.y + ((z - rear.z) / (front.z - rear.z)) * (front.y - rear.y), rear };
  };

  // Known art defect (VA-0264): fb9008f lowered the deck but left the buttons at y 0.794, so they
  // hover 12-23 mm above the sloped deck top (about 0.776 under their centres).
  it.fails('buttons rest on the deck top (gap under 4 mm)', () => {
    for (let i = 1; i <= 5; i++) {
      const b = cab.getObjectByName(`VA_player_button_${i}`)!;
      const bottom = new THREE.Box3().setFromObject(b).min.y;
      expect(Math.abs(bottom - deckTopAt(b.position.z).y)).toBeLessThan(0.004);
    }
  });

  // Known art defect (VA-0264): the deck's rear-top edge (y 0.809, z 0.159) sits inside the main
  // glass slab (z 0.151-0.171, bottom y 0.775), covering the bottom ~34 mm of the reel window.
  it.fails('deck rear edge stays below the main reel glass', () => {
    const glass = new THREE.Box3().setFromObject(cab.getObjectByName('VA_main_reels_5x5_glass')!);
    expect(deckTopAt(0).rear.y).toBeLessThanOrEqual(glass.min.y);
  });

  it('fitScreenUvs maps the cap UVs (authored in metres) to 0..1', () => {
    const c = createVelvetTripleSlotCabinet(THREE);
    const glass = c.getObjectByName('VA_main_reels_5x5_glass') as THREE.Mesh;
    const uv = glass.geometry.getAttribute('uv');
    const cap = glass.geometry.groups.find((g) => g.materialIndex === 0)!;
    let min = Infinity;
    for (let i = cap.start; i < cap.start + cap.count; i++) min = Math.min(min, uv.getX(i));
    expect(min).toBeLessThan(-0.3); // authored: shape units
    fitScreenUvs(glass.geometry);
    let lo = Infinity, hi = -Infinity;
    for (let i = cap.start; i < cap.start + cap.count; i++) for (const v of [uv.getX(i), uv.getY(i)]) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    expect(lo).toBeCloseTo(0, 5);
    expect(hi).toBeCloseTo(1, 5);
  });

  it('mountScreenTexture textures the caps and keeps the authored glass on the sides', () => {
    const c = createVelvetTripleSlotCabinet(THREE);
    const glass = c.getObjectByName('VA_main_reels_5x5_glass') as THREE.Mesh;
    const authored = glass.material;
    const tex = new THREE.Texture();
    mountScreenTexture(THREE, glass, tex);
    const mats = glass.material as THREE.Material[];
    expect((mats[0] as THREE.MeshBasicMaterial).map).toBe(tex);
    expect(mats[1]).toBe(authored);
  });
});
