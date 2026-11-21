import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createPremiumSlotStation } from '../../../art/casino/3d/premiumSlotStation.mjs';
import { PILOT_SCREENS, buildPremiumSlotPilot, pilotStats, seatCurvedScreens } from '../src/floor3d/slotPilot.ts';

const box = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
const screen = (s: THREE.Object3D, l: string) => s.getObjectByName(l + '-CURVED_SCREEN_SWAP_MATERIAL') as THREE.Mesh;

describe('premium slot station pilot (VA-0073/0075)', () => {
  it('the revised art (7f4535f) authors its screens facing the player, so the workaround is a no-op', () => {
    const raw = createPremiumSlotStation(THREE) as THREE.Object3D;
    raw.updateMatrixWorld(true);
    const before = PILOT_SCREENS.map((l) => box(screen(raw, l)));
    expect(seatCurvedScreens(THREE, raw)).toBe(false);
    PILOT_SCREENS.forEach((l, i) => expect(box(screen(raw, l)).equals(before[i])).toBe(true));
  });

  it('still seats a sideways screen (the first pilot, a11f487) against its gasket', () => {
    const s = createPremiumSlotStation(THREE) as THREE.Group;
    const glass = screen(s, 'MAIN_REELS');
    const { radiusTop: r, thetaLength: t } = (glass.geometry as THREE.CylinderGeometry).parameters;
    // rebuild the first pilot's layout: arc centred on -PI/2, turned by PI, behind a solid gasket
    glass.geometry = new THREE.CylinderGeometry(r, r, 1.04, 32, 1, true, -Math.PI / 2 - t / 2, t);
    glass.rotation.y = Math.PI;
    const gasket = new THREE.Mesh(new THREE.BoxGeometry(0.864, 1.1, 0.194));
    gasket.name = 'MAIN_REELS-black-gasket';
    gasket.position.set(0, glass.position.y, 0.177);
    s.add(gasket);
    expect(seatCurvedScreens(THREE, s)).toBe(true);
    const b = box(glass);
    expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(0.01);
    expect(b.min.z).toBeGreaterThan(box(gasket).max.z);
  });

  it('both curved screens sit centred on the cabinet with a gentle bow, inside their frame rails', () => {
    const s = buildPremiumSlotPilot(THREE);
    for (const l of PILOT_SCREENS) {
      const b = box(screen(s, l));
      expect(Math.abs(b.min.x + b.max.x)).toBeLessThan(0.01);
      expect(b.max.z - b.min.z).toBeLessThan(0.1); // a gentle bow, not sideways
      let railX = 0;
      s.traverse((o) => { if (o.name === l + '-gasket-side') railX = Math.max(railX, box(o).max.x); });
      expect(b.max.x).toBeLessThan(railX);
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
