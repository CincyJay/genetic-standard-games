import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createPremiumSlotStation } from '../../../art/casino/3d/premiumSlotStation.mjs';
import { PILOT_SCREENS, buildPremiumSlotPilot, pilotStats, seatCurvedScreens } from '../src/floor3d/slotPilot.ts';

const box = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
const screen = (s: THREE.Object3D, l: string) => s.getObjectByName(l + '-CURVED_SCREEN_SWAP_MATERIAL') as THREE.Mesh;

describe('premium slot station pilot (VA-0073/0075)', () => {
  it('the revised art (VA-0077) faces its screens forward, so the workaround leaves them alone', () => {
    const raw = createPremiumSlotStation(THREE) as THREE.Object3D;
    const before = PILOT_SCREENS.map((l) => [screen(raw, l).position.z, screen(raw, l).rotation.y]);
    expect(seatCurvedScreens(THREE, raw)).toBe(0);
    expect(PILOT_SCREENS.map((l) => [screen(raw, l).position.z, screen(raw, l).rotation.y])).toEqual(before);
  });

  it('screens are centred on the cabinet, inside their frame rails, in front of the bezel', () => {
    const s = buildPremiumSlotPilot(THREE);
    s.updateMatrixWorld(true);
    for (const l of PILOT_SCREENS) {
      const b = box(screen(s, l));
      const rails = new THREE.Box3();
      s.traverse((o) => o.name === l + '-gasket-side' && rails.expandByObject(o));
      const bezel = box(s.getObjectByName(l + '-metal-bezel')!);
      expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(0.01);
      expect(b.max.x - b.min.x).toBeLessThan(rails.max.x - rails.min.x);
      expect(b.min.z).toBeGreaterThan(bezel.max.z);
      expect(b.max.z - b.min.z).toBeLessThan(0.1); // a gentle bow, not sideways
    }
  });

  it('the screens bow toward the player and read left-to-right (u grows with +x)', () => {
    const s = buildPremiumSlotPilot(THREE);
    const m = screen(s, 'MAIN_REELS');
    const pos = m.geometry.attributes.position;
    const uv = m.geometry.attributes.uv;
    const world = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < uv.count; i++) {
      if (uv.getX(i) < uv.getX(lo)) lo = i;
      if (uv.getX(i) > uv.getX(hi)) hi = i;
    }
    expect(world(lo).x).toBeLessThan(world(hi).x);
    // the outward normal of the middle column faces +Z
    const n = new THREE.Vector3();
    const mid = uv.count >> 2;
    n.fromBufferAttribute(m.geometry.attributes.normal, mid).transformDirection(m.matrixWorld);
    expect(n.z).toBeGreaterThan(0.9);
  });

  it('is a small isolated scene (one station, chair included)', () => {
    const { meshes, triangles } = pilotStats(buildPremiumSlotPilot(THREE));
    expect(meshes).toBeGreaterThan(30);
    expect(triangles).toBeLessThan(30000);
  });
});
