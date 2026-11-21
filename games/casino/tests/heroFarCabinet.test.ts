import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createVelvetHeroFarCabinet } from '../../../art/casino/3d/velvetHeroFarCabinet.mjs';

// ChatGPT's far-LOD hero study (d48451f, VA-0328): measured only, not yet swapped into the hall.
describe('ChatGPT far-LOD hero cabinet (d48451f, VA-0328)', () => {
  const f = createVelvetHeroFarCabinet(THREE) as THREE.Group;
  f.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  f.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  const tris = meshes.reduce((a, m) => a + (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3, 0);
  it('is 18 boxes and a button: 236 triangles, 5 materials, about 0.96 x 2.18 x 0.75 m', () => {
    expect(meshes).toHaveLength(18);
    expect(tris).toBe(236);
    expect(new Set(meshes.map((m) => m.material)).size).toBe(5);
    const b = new THREE.Box3().setFromObject(f);
    expect(b.max.y).toBeCloseTo(2.18, 3);
    expect(b.max.x - b.min.x).toBeCloseTo(0.96, 3);
    // the foot's underside is 3 cm above the mount point (foot box centred at 0.09, 0.12 tall)
    expect(b.min.y).toBeCloseTo(0.03, 3);
  });
  it('names what the metadata promises; the screens face +Z', () => {
    for (const n of [...f.userData.interactiveNames, ...f.userData.screens]) expect(f.getObjectByName(n)).toBeTruthy();
    const rc = new THREE.Raycaster(new THREE.Vector3(0, 1.12, 3), new THREE.Vector3(0, 0, -1));
    expect(rc.intersectObject(f, true)[0]?.object.name).toBe('screen_1_display');
  });
  it('stands its spin button on edge: the disc faces +Z, half sunk into the deck', () => {
    const b = new THREE.Box3().setFromObject(f.getObjectByName('spin_button')!);
    // 0.13 m tall and 0.024 m deep: an upright coin, not a button lying on the deck
    expect(b.max.y - b.min.y).toBeCloseTo(0.13, 3);
    expect(b.max.z - b.min.z).toBeCloseTo(0.024, 3);
    const deck = new THREE.Box3().setFromObject(f.getObjectByName('control_deck_trim')!);
    expect(b.min.y).toBeLessThan(deck.max.y);
  });
});
