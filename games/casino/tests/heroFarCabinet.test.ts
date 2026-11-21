import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createVelvetHeroFarCabinet } from '../../../art/casino/3d/velvetHeroFarCabinet.mjs';

// ChatGPT's far-LOD hero study (d48451f, VA-0328; foot and button revised in d674037, VA-0330).
describe('ChatGPT far-LOD hero cabinet (d48451f + d674037, VA-0328/VA-0330)', () => {
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
    // d674037: the foot box is centred at 0.06 and 0.12 tall, so it stands on the mount point
    expect(b.min.y).toBeCloseTo(0, 6);
  });
  it('names what the metadata promises; the screens face +Z', () => {
    for (const n of [...f.userData.interactiveNames, ...f.userData.screens]) expect(f.getObjectByName(n)).toBeTruthy();
    const rc = new THREE.Raycaster(new THREE.Vector3(0, 1.12, 3), new THREE.Vector3(0, 0, -1));
    expect(rc.intersectObject(f, true)[0]?.object.name).toBe('screen_1_display');
  });
  it('lays its spin button flat on the deck trim (d674037)', () => {
    const b = new THREE.Box3().setFromObject(f.getObjectByName('spin_button')!);
    // a 0.13 m disc, 0.024 m thick, lying on the deck
    expect(b.max.y - b.min.y).toBeCloseTo(0.024, 3);
    expect(b.max.x - b.min.x).toBeCloseTo(0.13, 2);
    expect(b.max.z - b.min.z).toBeCloseTo(0.13, 2);
    const deck = new THREE.Box3().setFromObject(f.getObjectByName('control_deck_trim')!);
    // underside 0.504 against the trim top 0.5025: a 1.5 mm air gap, not sunk in
    expect(b.min.y - deck.max.y).toBeCloseTo(0.0015, 4);
    expect(b.min.z).toBeGreaterThan(deck.min.z);
    expect(b.max.z).toBeLessThan(deck.max.z);
  });
});
