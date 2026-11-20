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
    expect(z('VA_main_reels_5x5_bezel')).toBeGreaterThan(z('VA_tapered_tower'));
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

  // Known art defect (VA-0261): the deck is turned +0.14 rad about X, so its top face tilts toward
  // the screen (normal z about -0.14), away from the player; a slot button deck tilts toward the
  // player. Flips to a pass once the top normal leans toward +Z.
  it.fails('console deck top tilts toward the player', () => {
    const deck = cab.getObjectByName('VA_console_ledge')!;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(deck.getWorldQuaternion(new THREE.Quaternion()));
    expect(up.z).toBeGreaterThan(0.02);
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
