import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildPlaceholderCrowd } from '../src/floor3d/placeholderCrowd.ts';

const H = 1.75;
const NPC = 0x6b5f78;

describe('placeholder people are one draw call (VA-0268)', () => {
  it('returns null with nobody to draw', () => {
    expect(buildPlaceholderCrowd([], H, NPC)).toBeNull();
  });

  it('merges every capsule and nose into one mesh with the old shapes, placement and colours', () => {
    const people = [
      { x: 0, z: 0, heading: 0, lift: 0 },
      { x: 5, z: -3, heading: Math.PI / 2, lift: 0.2 },
      { x: -4, z: 2, heading: Math.PI, lift: 0 },
    ];
    const mesh = buildPlaceholderCrowd(people, H, NPC)!;
    expect(mesh.isMesh).toBe(true);
    expect(Array.isArray(mesh.material)).toBe(false);
    expect((mesh.material as THREE.MeshLambertMaterial).vertexColors).toBe(true);
    // one group: a single draw call
    expect(mesh.geometry.groups.length).toBeLessThanOrEqual(1);
    const capsule = new THREE.CapsuleGeometry(0.27, H - 0.54, 6, 14);
    const box = new THREE.BoxGeometry(0.14, 0.1, 0.16);
    const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    expect(mesh.geometry.getAttribute('position').count / 3).toBe(people.length * (tris(capsule) + tris(box)));

    // each person's bounds match the old group: capsule of radius .27 from lift to lift + H
    const pos = mesh.geometry.getAttribute('position');
    const col = mesh.geometry.getAttribute('color');
    const body = new THREE.Color(NPC);
    const nose = new THREE.Color(0x403c44);
    for (const p of people) {
      const box3 = new THREE.Box3();
      const noseBox = new THREE.Box3();
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        if (Math.hypot(v.x - p.x, v.z - p.z) > 0.6) continue;
        box3.expandByPoint(v);
        if (Math.abs(col.getX(i) - nose.r) < 1e-6 && Math.abs(col.getY(i) - nose.g) < 1e-6) noseBox.expandByPoint(v);
        else expect([col.getX(i), col.getY(i), col.getZ(i)]).toEqual([body.r, body.g, body.b].map((c) => Math.fround(c)));
      }
      expect(box3.min.y).toBeCloseTo(p.lift, 5);
      expect(box3.max.y).toBeCloseTo(p.lift + H, 5);
      // the nose sits 0.28 m ahead along the facing (heading 0 faces -Z)
      const c = noseBox.getCenter(new THREE.Vector3());
      expect(c.x - p.x).toBeCloseTo(0.28 * Math.sin(p.heading), 5);
      expect(c.z - p.z).toBeCloseTo(-0.28 * Math.cos(p.heading), 5);
      expect(c.y).toBeCloseTo(p.lift + H - 0.22, 5);
    }
  });
});
