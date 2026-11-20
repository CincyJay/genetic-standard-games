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

  it('stands on the floor at about 0.88 x 2.35 m (crown slimmed in 416f6c9) and fits a 0.45 m collision half-width', () => {
    // the plinth sat 5 mm above the floor in 1670e35; ff6752a seats it on y 0
    expect(report.bounds.min[1]).toBeGreaterThanOrEqual(0);
    expect(report.bounds.min[1]).toBeLessThan(0.001);
    expect(report.bounds.max[1]).toBeGreaterThan(2.3);
    expect(report.bounds.max[1]).toBeLessThan(2.45);
    expect(Math.max(-report.bounds.min[0], report.bounds.max[0])).toBeLessThan(0.45);
    // since ff6752a (VA-0258) the console deck projects forward to z 0.56; the rear stays at -0.39
    expect(-report.bounds.min[2]).toBeLessThan(0.45);
    expect(report.bounds.max[2]).toBeLessThan(0.6);
  });

  // 6b39809 (VA-0273) added a 7th material, sideInset, for the recessed tower side skins
  it('is cheap: under 6k triangles, 7 authored materials', () => {
    expect(report.triangles).toBeLessThan(6000);
    expect(report.materials).toBe(7);
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
      // 4740660 (VA-0265) lowered the buttons to y 0.738, below the base top (0.741), but they sit
      // in front of the base (z >= 0.356 vs 0.297), so check they do not intersect it
      expect(box(`VA_player_button_${i}`).intersectsBox(base)).toBe(false);
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

  // VA-0264: fb9008f left the buttons hovering 12-23 mm above the sloped deck; 4740660 (VA-0265) left
  // them 9.7 mm off along the deck normal. 0766a4e+d52172a (VA-0267/0269) seat them at y 0.7424,
  // z 0.3964: 0.4 mm off along the deck normal. Measured along the normal, because a tilted button's
  // axis-aligned box bottom is its front-lower edge, which sits below the deck top at the button centre.
  it('buttons rest on the deck top (gap along the deck normal under 4 mm)', () => {
    const deck = cab.getObjectByName('VA_console_ledge')!;
    const n = new THREE.Vector3(0, 1, 0).applyQuaternion(deck.getWorldQuaternion(new THREE.Quaternion()));
    const { rear } = deckTopAt(0);
    const v = new THREE.Vector3();
    for (let i = 1; i <= 5; i++) {
      const b = cab.getObjectByName(`VA_player_button_${i}`) as THREE.Mesh;
      b.updateWorldMatrix(true, false);
      const pos = b.geometry.getAttribute('position');
      let gap = Infinity;
      for (let k = 0; k < pos.count; k++) gap = Math.min(gap, v.fromBufferAttribute(pos, k).applyMatrix4(b.matrixWorld).sub(rear).dot(n));
      expect(Math.abs(gap)).toBeLessThan(0.004);
    }
  });

  // VA-0267/0269: arched crown embedded in the tower top, not floating. a9171b0 (VA-0271) moved it
  // forward 105 mm so its front (z 0.123) caps the marquee bezel (z 0.103-0.145) instead of sitting
  // 85 mm behind it; it must stay behind the marquee glass so it never hides the screen.
  it('has an arched marquee crown seated on the tower top, capping the marquee bezel', () => {
    const box = (name: string) => new THREE.Box3().setFromObject(cab.getObjectByName(name)!);
    const crown = box('VA_arched_marquee_crown');
    const tower = box('VA_curved_tapered_tower');
    expect(crown.min.y).toBeLessThan(tower.max.y);
    expect(crown.max.y).toBeGreaterThan(box('VA_top_marquee_bezel').max.y);
    const bezel = box('VA_top_marquee_bezel');
    expect(crown.max.z).toBeGreaterThan(bezel.min.z);
    expect(crown.max.z).toBeLessThan(bezel.max.z);
    expect(crown.max.z).toBeLessThan(box('VA_top_marquee_glass').min.z);
    // 6b39809 (VA-0273) extended the crown back to z -0.343 so the tower top (rear z -0.330) is capped,
    // and narrowed it to within 10 mm of the tower half-width
    expect(crown.min.z).toBeLessThanOrEqual(tower.min.z);
    expect(crown.max.x).toBeLessThan(tower.max.x + 0.01);
  });

  // 6b39809 (VA-0273): dark side skins 3 mm proud of each tower side, so they read as separate panels
  // without z-fighting the tower faces; they stay inside the cabinet's 0.45 m collision half-width.
  it('has a sculpted side inset on each tower side, just outside the tower face', () => {
    const tower = new THREE.Box3().setFromObject(cab.getObjectByName('VA_curved_tapered_tower')!);
    for (const side of ['left', 'right'] as const) {
      const skin = cab.getObjectByName(`VA_sculpted_side_inset_${side}`) as THREE.Mesh;
      expect(skin).toBeTruthy();
      expect((skin.material as THREE.Material).side).toBe(THREE.DoubleSide);
      const b = new THREE.Box3().setFromObject(skin);
      const outer = side === 'left' ? -b.min.x : b.max.x;
      expect(outer).toBeGreaterThan(0.34);
      expect(outer).toBeLessThan(0.45);
      expect(b.max.y - b.min.y).toBeGreaterThan(1.0);
      expect(b.min.z).toBeGreaterThan(tower.min.z);
      expect(b.max.z).toBeLessThan(tower.max.z);
    }
  });

  // 3f7c7bb (VA-0275): the right skin's winding was reversed so both skins face outward by geometry
  // alone, i.e. they would still shade correctly if sideInset became FrontSide.
  it('side inset face normals point outward on both sides (winding, not DoubleSide)', () => {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (const side of ['left', 'right'] as const) {
      const skin = cab.getObjectByName(`VA_sculpted_side_inset_${side}`) as THREE.Mesh;
      skin.updateWorldMatrix(true, false);
      const pos = skin.geometry.getAttribute('position');
      const idx = skin.geometry.getIndex()!;
      const sign = side === 'left' ? -1 : 1;
      let tris = 0;
      for (let i = 0; i < idx.count; i += 3) {
        a.fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(skin.matrixWorld);
        b.fromBufferAttribute(pos, idx.getX(i + 1)).applyMatrix4(skin.matrixWorld);
        c.fromBufferAttribute(pos, idx.getX(i + 2)).applyMatrix4(skin.matrixWorld);
        n.subVectors(c, b).cross(a.clone().sub(b));
        if (n.lengthSq() < 1e-12) continue;
        expect(Math.sign(n.x)).toBe(sign);
        tris++;
      }
      expect(tris).toBeGreaterThan(0);
    }
  });

  // 3f7c7bb (VA-0275): a thin emissive light channel along each inset's front edge, within the envelope
  it('has a front-edge light channel on each side inside the collision half-width', () => {
    const tower = new THREE.Box3().setFromObject(cab.getObjectByName('VA_curved_tapered_tower')!);
    for (const side of ['left', 'right'] as const) {
      const ch = cab.getObjectByName(`VA_inset_light_channel_${side}`) as THREE.Mesh;
      expect(ch).toBeTruthy();
      const b = new THREE.Box3().setFromObject(ch);
      const outer = side === 'left' ? -b.min.x : b.max.x;
      expect(outer).toBeLessThan(0.45);
      expect(b.max.z).toBeLessThan(tower.max.z);
      expect(b.max.y - b.min.y).toBeGreaterThan(1.0);
    }
  });

  // 416f6c9 (VA-0277): the channel is now a flat 12 mm ribbon (not a tube) facing outward, and the
  // crown crest dropped from ~2.43 m to ~2.365 m while still capping the marquee bezel.
  it('side light ribbons are flat 12 mm bands wound outward', () => {
    cab.updateMatrixWorld(true);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
      const ch = cab.getObjectByName(`VA_inset_light_channel_${side}`) as THREE.Mesh;
      expect(ch.geometry.type).toBe('BufferGeometry');
      const pos = ch.geometry.getAttribute('position');
      const idx = ch.geometry.getIndex()!;
      for (let i = 0; i < pos.count; i += 2) {
        expect(pos.getZ(i + 1) - pos.getZ(i)).toBeCloseTo(0.012, 4);
        expect(pos.getX(i + 1)).toBeCloseTo(pos.getX(i), 6);
      }
      let tris = 0;
      for (let i = 0; i < idx.count; i += 3) {
        a.fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(ch.matrixWorld);
        b.fromBufferAttribute(pos, idx.getX(i + 1)).applyMatrix4(ch.matrixWorld);
        c.fromBufferAttribute(pos, idx.getX(i + 2)).applyMatrix4(ch.matrixWorld);
        n.subVectors(c, b).cross(a.clone().sub(b));
        if (n.lengthSq() < 1e-12) continue;
        expect(Math.sign(n.x)).toBe(sign);
        tris++;
      }
      expect(tris).toBeGreaterThan(0);
    }
  });

  it('slimmed crown crest stays under 2.38 m', () => {
    const crown = new THREE.Box3().setFromObject(cab.getObjectByName('VA_arched_marquee_crown')!);
    expect(crown.max.y).toBeLessThan(2.36); // bezier crest ~2.3375 + 9 mm bevel
    expect(crown.max.y).toBeGreaterThan(2.3);
  });

  // VA-0264: the deck's rear-top edge (y 0.809, z 0.159) sat inside the main glass slab (z 0.151-0.171,
  // bottom y 0.775). 4740660 (VA-0265) lowered it to y 0.766, 9 mm below the glass.
  it('deck rear edge stays below the main reel glass', () => {
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
