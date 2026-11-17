/**
 * Dev-only page (`/svelte-slot.html?view=front|three|side|top|seated`): ChatGPT's slim S-curve
 * "Svelte 01" cabinet (VA-0110, art/casino/3d/svelteSlotCabinet.mjs) alone on a plain floor, with
 * a 1.75 m grey human-scale reference beside it. For review captures and measurements only; never
 * in the game. `__svelte.report()` gives the cabinet's bounds, per-part bounds and render cost.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createSvelteSlotCabinet } from '../../../../art/casino/3d/svelteSlotCabinet.mjs';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'three';
const EYE = 1.6;
/** Cabinet at the origin facing +Z; the scale figure stands 0.75 m to its left (−x). */
const VIEWS: Record<string, { pos: [number, number, number]; look: [number, number, number] }> = {
  front: { pos: [0, EYE, 3.0], look: [0, 1.1, 0] },
  three: { pos: [1.9, EYE, 2.4], look: [0, 1.1, 0] },
  side: { pos: [3.0, 1.2, 0.05], look: [0, 1.1, 0.05] },
  top: { pos: [0.6, 3.6, 1.6], look: [0, 1.6, 0] },
  seated: { pos: [0, 1.22, 1.05], look: [0, 1.35, 0] },
};
const v = VIEWS[view] ?? VIEWS.three;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120a1a);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xfff0dd, 0x2a1830, 0.35));
const key = new THREE.SpotLight(0xffe6c4, 40, 12, 0.7, 0.5);
key.position.set(1.5, 4.2, 3.2);
key.castShadow = true;
scene.add(key, key.target);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x3a2030, roughness: 0.85 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// a plain 1.75 m capsule, engineering scale reference only
const human = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.35, 4, 12), new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.9 }));
human.position.set(-0.75, 0.875, 0.35);
scene.add(human);

const cabinet = createSvelteSlotCabinet(THREE) as THREE.Group;
scene.add(cabinet);

const camera = new THREE.PerspectiveCamera(innerWidth > innerHeight ? 45 : 60, innerWidth / innerHeight, 0.05, 50);
camera.position.set(...v.pos);
camera.lookAt(...v.look);

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const box = (o: THREE.Object3D) => {
  const b = new THREE.Box3().setFromObject(o);
  return { min: [r3(b.min.x), r3(b.min.y), r3(b.min.z)], max: [r3(b.max.x), r3(b.max.y), r3(b.max.z)] };
};

renderer.render(scene, camera);
const before = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
// cabinet-only cost: render it alone once (floor, figure hidden)
floor.visible = human.visible = false;
renderer.render(scene, camera);
const cabinetOnly = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
floor.visible = human.visible = true;
renderer.render(scene, camera);

(globalThis as Record<string, unknown>).__svelte = {
  ready: true,
  view,
  report: () => {
    const parts: Record<string, unknown> = {};
    const materials = new Set<THREE.Material>();
    let meshes = 0;
    let tris = 0;
    cabinet.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      materials.add(m.material as THREE.Material);
      const g = m.geometry;
      const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
      tris += t;
      parts[m.name] = { ...box(m), tris: t, doubleSided: (m.material as THREE.Material).side === THREE.DoubleSide };
    });
    return { bounds: box(cabinet), meshes, materials: materials.size, triangles: tris, sceneRender: before, cabinetRender: cabinetOnly, parts, userData: cabinet.userData };
  },
};
