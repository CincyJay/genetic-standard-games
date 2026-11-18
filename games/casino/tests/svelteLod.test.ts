import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSvelteSlotCabinet } from '../../../art/casino/3d/svelteSlotCabinet.mjs';
import { applySvelteLuxuryFinish } from '../../../art/casino/3d/svelteLuxuryFinish.mjs';
import { createSvelteSlotCabinetFarLOD } from '../../../art/casino/3d/svelteSlotCabinetFarLOD.mjs';
import { buildSvelteLod, pickNear, type CabinetSpot } from '../src/floor3d/svelteLod.ts';

const far = () => createSvelteSlotCabinetFarLOD(THREE) as THREE.Group;
const near = () => {
  const c = createSvelteSlotCabinet(THREE) as THREE.Group;
  applySvelteLuxuryFinish(THREE, c);
  return c;
};
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.attributes.position.count) / 3;

describe('ChatGPT far-LOD Svelte cabinet (VA-0153, 149af09)', () => {
  it('builds with the triangles it declares, under the 1.5k ask', () => {
    const c = far();
    let t = 0;
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh) t += tris((o as THREE.Mesh).geometry); });
    expect(t).toBe(c.userData.expectedTriangles);
    expect(t).toBeLessThanOrEqual(1500);
  });

  it('has a finite UV per vertex on every mesh', () => {
    far().traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const uv = m.geometry.attributes.uv;
      expect(uv, m.name).toBeDefined();
      expect(uv.count, m.name).toBe(m.geometry.attributes.position.count);
      for (const v of uv.array as Float32Array) expect(Number.isFinite(v), m.name).toBe(true);
    });
  });

  it('keeps the screen material name and faces the screen +Z, in front of the hull', () => {
    const c = far();
    const screen = c.getObjectByName('portrait_glass_curved_49inch_visual_target') as THREE.Mesh;
    expect((screen.material as THREE.Material).name).toBe('VA_SVELTE_REEL_SCREEN_SWAP');
    const g = screen.geometry, p = g.attributes.position, idx = g.index!;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    let forward = 0;
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(p, idx.getX(i)); b.fromBufferAttribute(p, idx.getX(i + 1)); d.fromBufferAttribute(p, idx.getX(i + 2));
      if (b.sub(a).cross(d.sub(a)).z > 0) forward++;
    }
    expect(forward).toBe(idx.count / 3);
    // the screen sits in front of the hull at its height band
    const hull = new THREE.Box3().setFromObject(c.getObjectByName('continuous_sculpted_S_curve_hull')!);
    const sb = new THREE.Box3().setFromObject(screen);
    expect(sb.max.z).toBeGreaterThan(hull.max.z);
    // same footprint as the full cabinet within 5 cm, so the pair spacing and collisions still fit
    const full = new THREE.Box3().setFromObject(near(), true), lo = new THREE.Box3().setFromObject(c, true);
    expect(Math.abs((lo.max.x - lo.min.x) - (full.max.x - full.min.x))).toBeLessThan(0.05);
    expect(lo.max.y).toBeCloseTo(full.max.y, 1);
  });

  it('shows the shadow surround as a border ring in front of the hull (VA-0155, 5f59369)', () => {
    const c = far();
    c.updateMatrixWorld(true);
    const meshes: THREE.Object3D[] = [];
    c.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.name !== 'floating_elliptical_button_deck') meshes.push(o); });
    const rc = new THREE.Raycaster();
    const first = (x: number, y: number) => {
      rc.set(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
      return rc.intersectObjects(meshes, false)[0]?.object.name;
    };
    // screen centre: the glass, not the surround
    expect(first(0, 1.3)).toBe('portrait_glass_curved_49inch_visual_target');
    // side, top and bottom border, just outside the glass: the surround, not the hull
    for (const [x, y] of [[0.252, 0.9], [0.252, 1.3], [0.252, 1.66], [-0.252, 1.9], [0, 1.947], [0.15, 0.772]])
      expect(first(x, y), `${x},${y}`).toBe('distant_screen_shadow_surround');
  });
});

describe('pickNear', () => {
  const pts = Array.from({ length: 10 }, (_, i) => ({ x: i, z: 0 }));
  it('picks the k nearest', () => {
    expect([...pickNear(pts, 0, 0, 3)].sort()).toEqual([0, 1, 2]);
    expect(pickNear(pts, 0, 0, 20).size).toBe(10);
    expect(pickNear(pts, 0, 0, 0).size).toBe(0);
  });
  it('holds the current set against a slightly closer cabinet (hysteresis)', () => {
    // at x=1.6 spots 2 (0.4 m) and 1 (0.6 m) are nearest and stay so
    expect([...pickNear(pts, 1.6, 0, 2, new Set([1, 2]))].sort()).toEqual([1, 2]);
    // at x=2.1 spot 3 (0.9) is closer than spot 1 (1.1) but not by 0.75: the current {1,2} holds
    expect([...pickNear(pts, 2.1, 0, 2, new Set([1, 2]))].sort()).toEqual([1, 2]);
    expect([...pickNear(pts, 2.1, 0, 2)].sort()).toEqual([2, 3]);
  });
});

describe('Svelte islands distance LOD', () => {
  // 78 cabinets: 39 pairs over a 13 x 6 grid, two machine ids
  const spots: CabinetSpot[] = Array.from({ length: 78 }, (_, i) => ({
    id: i % 4 < 2 ? 'sevens' : 'lanterns',
    matrix: new THREE.Matrix4().makeTranslation((i % 13) * 1.2, 0, Math.floor(i / 13) * 2.4),
  }));
  const screens = new Map(['sevens', 'lanterns'].map((id) => [id, new THREE.MeshStandardMaterial({ name: `screen_${id}` })]));

  it('draws the nearest 16 in full and the rest at far LOD, within the triangle budget', () => {
    const lod = buildSvelteLod(spots, near(), far(), (id) => screens.get(id), 16);
    expect(lod.update(new THREE.Vector3(0, 1.6, 0))).toBe(true);
    expect(lod.near.size).toBe(16);
    expect(lod.near.has(0)).toBe(true);
    const meshes = lod.root.children as THREE.InstancedMesh[];
    const count = (prefix: string) => meshes.filter((m) => m.name.startsWith(prefix) && m.material === screens.get('sevens')).reduce((n, m) => n + m.count, 0)
      + meshes.filter((m) => m.name.startsWith(prefix) && m.material === screens.get('lanterns')).reduce((n, m) => n + m.count, 0);
    expect(count('svelte_lod_near')).toBe(16);
    expect(count('svelte_lod_far')).toBe(62);
    expect(lod.triangles()).toBe(16 * lod.trianglesNear + 62 * lod.trianglesFar);
    expect(lod.triangles()).toBeLessThan(150_000);
    // all-full would be well over it
    expect(78 * lod.trianglesNear).toBeGreaterThan(300_000);
    expect(lod.drawCalls).toBeLessThanOrEqual(30);
    console.info(`[svelte lod] near ${lod.trianglesNear} tris, far ${lod.trianglesFar} tris, 78 cabinets -> ${lod.triangles()} tris, ${lod.drawCalls} calls max`);
  });

  it('moves detail with the camera and ignores tiny moves', () => {
    const lod = buildSvelteLod(spots, near(), far(), (id) => screens.get(id), 16);
    lod.update(new THREE.Vector3(0, 1.6, 0));
    expect(lod.update(new THREE.Vector3(0.1, 1.6, 0))).toBe(false);
    expect(lod.update(new THREE.Vector3(14.4, 1.6, 12))).toBe(true);
    expect(lod.near.has(77)).toBe(true);
    expect(lod.near.has(0)).toBe(false);
    // per-machine screens: every near spot's instance went on its own machine's screen mesh
    const nearScreens = (lod.root.children as THREE.InstancedMesh[]).filter((m) => m.name.startsWith('svelte_lod_near') && [...screens.values()].includes(m.material as THREE.MeshStandardMaterial));
    const want = { sevens: 0, lanterns: 0 } as Record<string, number>;
    for (const i of lod.near) want[spots[i].id]++;
    for (const m of nearScreens) expect(m.count).toBe(want[m.name.endsWith('sevens') ? 'sevens' : 'lanterns']);
  });
});
