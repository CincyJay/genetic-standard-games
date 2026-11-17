/**
 * Dev-only page (`/svelte-slot.html?view=front|three|side|top|seated|back|low`, optional `&reel=art` for ChatGPT's reel-screen texture (VA-0120), `&sides=double` / `&reel=checker` diagnostics): ChatGPT's slim S-curve
 * "Svelte 01" cabinet (VA-0110, art/casino/3d/svelteSlotCabinet.mjs) alone on a plain floor, with
 * a 1.75 m grey human-scale reference beside it. For review captures and measurements only; never
 * in the game. `__svelte.report()` gives the cabinet's bounds, per-part bounds and render cost.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createSvelteSlotCabinet } from '../../../../art/casino/3d/svelteSlotCabinet.mjs';
import { createSvelteReelScreen } from '../../../../art/casino/3d/svelteReelScreen.mjs';
import { auditMeshes, findShadingSeams } from './meshAudit';
import { safeArtBuild } from './safeArtBuild';

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
  back: { pos: [-1.6, 1.5, -2.4], look: [0, 1.0, -0.1] },
  low: { pos: [1.4, 0.25, 1.2], look: [0, 0.2, -0.1] },
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

// The art module can throw (VA-0119: a literal backslash-n in a comment swallowed `const deckLip`). Show the
// error on the page and in `report().buildError` instead of leaving a blank canvas.
const { group: cabinet, buildError } = safeArtBuild(() => createSvelteSlotCabinet(THREE) as THREE.Group);
if (buildError) {
  console.warn('[svelte-slot] art module failed to build:', buildError);
  const note = document.createElement('div');
  note.textContent = `Svelte 01 art module failed to build: ${buildError}`;
  note.style.cssText = 'position:fixed;left:8px;top:8px;right:8px;padding:8px;background:#600;color:#fff;font:14px sans-serif;z-index:9';
  document.body.appendChild(note);
}
scene.add(cabinet);
// Diagnostic only (`?sides=double`): render every cabinet material double-sided in this preview, to
// tell culled (wrong-winding) faces apart from missing geometry. Never changes the art module.
if (params.get('sides') === 'double') {
  cabinet.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) (m.material as THREE.Material).side = THREE.DoubleSide;
  });
}

/** Puts `tex` on every cabinet material named `userData.screenMaterialName` (VA-0114); returns how many. */
const swapScreen = (tex: THREE.Texture) => {
  const name = cabinet.userData.screenMaterialName;
  let found = 0;
  cabinet.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.isMesh ? (m.material as THREE.MeshStandardMaterial) : null;
    if (mat && mat.name === name) { mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true; found++; }
  });
  return { materialName: name as unknown, found };
};

// Diagnostic only (`?reel=checker`): put a labelled UV test card on the screen material, to check the
// lookup and the UV orientation. Not reel art.
let reelSwap: { materialName: unknown; found: number; source?: string; error?: string } | null = null;
if (params.get('reel') === 'art') {
  // ChatGPT's still reel-screen texture (VA-0120, art/casino/3d/svelteReelScreen.mjs), used unchanged.
  try {
    const screen = createSvelteReelScreen(THREE, { width: 512, height: 1024 }) as { texture: THREE.Texture };
    reelSwap = { ...swapScreen(screen.texture), source: 'svelteReelScreen.mjs' };
  } catch (e) {
    reelSwap = { materialName: cabinet.userData.screenMaterialName, found: 0, source: 'svelteReelScreen.mjs', error: String(e) };
  }
}
if (params.get('reel') === 'checker') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = (x + y) % 2 ? '#202020' : '#e0e0e0';
    g.fillRect(x * 64, y * 64, 64, 64);
  }
  g.font = 'bold 44px sans-serif';
  const corner = (t: string, x: number, y: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, 96, 56); g.fillStyle = '#fff'; g.fillText(t, x + 8, y + 44); };
  corner('TL', 0, 0, '#c00000'); corner('TR', 160, 0, '#00a000'); corner('BL', 0, 456, '#0000c0'); corner('BR', 160, 456, '#a0a000');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  reelSwap = swapScreen(tex);
}

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

/**
 * Area-weighted mean face normal from triangle winding (what FrontSide culling uses), in cabinet
 * space. A front-facing sheet such as the glass should have z > 0; a closed outward shell sums to ~0,
 * so `outward` also reports the share of hull faces whose winding normal points away from its axis.
 */
const windingFacing = (g: THREE.BufferGeometry) => {
  const pos = g.attributes.position;
  const idx = g.index;
  const n = idx ? idx.count : pos.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), sum = new THREE.Vector3();
  g.computeBoundingBox();
  const centre = g.boundingBox!.getCenter(new THREE.Vector3());
  let out = 0, total = 0, vert = 0, vertOut = 0;
  for (let i = 0; i < n; i += 3) {
    const [i0, i1, i2] = idx ? [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)] : [i, i + 1, i + 2];
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    const mid = a.clone().add(b).add(c).divideScalar(3).sub(centre);
    const fn = b.sub(a).cross(c.sub(a));
    if (fn.lengthSq() < 1e-14) continue;
    sum.add(fn);
    // cap-like faces (mostly vertical normal): outward means the normal's y sign matches the face's side of centre
    if (Math.abs(fn.y) > 0.9 * fn.length()) {
      vert++;
      if (Math.sign(fn.y) === Math.sign(mid.y)) vertOut++;
      continue;
    }
    total++;
    mid.y = 0; fn.y = 0;
    if (fn.dot(mid) > 0) out++;
  }
  const s = sum.normalize();
  return {
    mean: [r3(s.x), r3(s.y), r3(s.z)],
    outward: total ? r3(out / total) : null,
    caps: vert ? { faces: vert, outward: r3(vertOut / vert) } : null,
  };
};

(globalThis as Record<string, unknown>).__svelte = {
  ready: true,
  view,
  buildError,
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
      parts[m.name] = { ...box(m), tris: t, doubleSided: (m.material as THREE.Material).side === THREE.DoubleSide, facing: windingFacing(g), seams: findShadingSeams(g) };
    });
    return { buildError, bounds: box(cabinet), meshes, materials: materials.size, triangles: tris, sceneRender: before, cabinetRender: cabinetOnly, reelSwap, audit: auditMeshes(cabinet), parts, userData: cabinet.userData };
  },
};

// Phone review (opened from the floor's settings menu): tap anywhere to step through the views (each
// reloads the page with the next `view`), and a button back to the 3D floor.
if (params.get('from') === 'floor') {
  const order = Object.keys(VIEWS);
  const ui = document.createElement('div');
  ui.style.cssText = 'position:fixed;inset:0;pointer-events:none;font-family:Outfit,system-ui,sans-serif;z-index:5';
  const btn = 'pointer-events:auto;min-height:48px;border-radius:24px;border:2px solid #e9c86a;background:rgba(36,18,46,.88);color:#ffe9a8;font:800 15px Outfit,system-ui,sans-serif;padding:0 16px';
  ui.innerHTML = `<button type="button" style="${btn};position:absolute;top:calc(env(safe-area-inset-top) + 10px);left:calc(env(safe-area-inset-left) + 10px)">‹ Floor</button>
<div style="position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 10px);text-align:center;font:700 13px Outfit,sans-serif;color:#e9c86a;text-shadow:0 1px 3px #000">PROTOTYPE · SVELTE 01 · ${view} (${order.indexOf(view) + 1}/${order.length}) · tap for next view</div>`;
  document.body.appendChild(ui);
  ui.querySelector('button')!.addEventListener('click', () => (location.href = 'index.html?floor3d'));
  renderer.domElement.addEventListener('click', () => {
    params.set('view', order[(order.indexOf(view) + 1) % order.length]);
    location.search = params.toString();
  });
}
