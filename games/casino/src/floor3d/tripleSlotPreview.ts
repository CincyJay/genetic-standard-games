/**
 * Dev-only page (`/triple-slot.html?view=front|three|side|seated&machine=dragon&screens=game|none`):
 * ChatGPT's triple-screen cabinet study (art 1670e35, VA-0256) exactly as authored, on a plain
 * floor, lit like slot-pilot.html. With `screens=game` (default) the main 5x5 screen shows the
 * machine's real reel atlas (reelDisplayArt.mjs, the same art the floor uses); the marquee and
 * bonus screens show copy from the machine data (topScreenCopy, VA-0282) painted by ChatGPT's
 * paintVelvetUpperScreen (art d16bf75, VA-0285); `&topart=flat` restores the flat placeholder.
 * For review captures only.
 * Hooks: globalThis.__tripleSlot = { ready, view, stats, rects }.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createVelvetTripleSlotCabinet } from '../../../../art/casino/3d/velvetTripleScreenSlotStudy.mjs';
import { createVelvetReelArt } from '../../../../art/casino/3d/reelDisplayArt.mjs';
import { MACHINES } from '../logic/slots.ts';
import { paintVelvetUpperScreen } from '../../../../art/casino/3d/velvetUpperScreenPainter.mjs';
import { cabinetReport, mountScreenTexture, paintScreenCanvas, paintScreenWith, screenAspect, topScreenCopy } from './tripleSlot.ts';

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'front';
const machineId = params.get('machine') ?? 'dragon';
const screens = params.get('screens') ?? 'game';
/** `topart=flat` shows the old engineering placeholder instead of ChatGPT's painter, for comparison. */
const topArt = params.get('topart') ?? 'velvet';
const EYE = 1.6;
/** Cabinet at the origin facing +Z; a seated player's eyes ~1.2 m, ~0.75 m from the screen. */
const VIEWS: Record<string, { pos: [number, number, number]; look: [number, number, number] }> = {
  front: { pos: [0, EYE, 3.0], look: [0, 1.3, 0] },
  three: { pos: [1.9, EYE, 2.3], look: [0, 1.25, 0] },
  side: { pos: [3.0, 1.5, 0.2], look: [0, 1.25, 0] },
  seated: { pos: [0, 1.22, 0.95], look: [0, 1.15, 0] },
};
const v = VIEWS[view] ?? VIEWS.front;

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

const cabinet: THREE.Group = createVelvetTripleSlotCabinet(THREE);
cabinet.traverse((o: THREE.Object3D) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
scene.add(cabinet);
const authoredReport = cabinetReport(THREE, cabinet);

const camera = new THREE.PerspectiveCamera(innerWidth > innerHeight ? 50 : 62, innerWidth / innerHeight, 0.05, 50);
camera.position.set(...v.pos);
camera.lookAt(...v.look);

const projectedRect = (name: string) => {
  const o = cabinet.getObjectByName(name);
  if (!o) return null;
  const b = new THREE.Box3().setFromObject(o);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
    const sx = ((p.x + 1) / 2) * innerWidth, sy = ((1 - p.y) / 2) * innerHeight;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
};

async function main(): Promise<void> {
  let mounted = 'none';
  if (screens === 'game') {
    const m = MACHINES.find((x) => x.id === machineId) ?? MACHINES[0];
    const reel = await createVelvetReelArt(THREE, m.id, m.symbols, { base: './art' });
    const glass = cabinet.getObjectByName('VA_main_reels_5x5_glass') as THREE.Mesh;
    mountScreenTexture(THREE, glass, reel.texture);
    const copy = topScreenCopy(m);
    for (const [name, c, kind] of [['VA_top_marquee_glass', copy.marquee, 'marquee'], ['VA_bonus_display_glass', copy.bonus, 'bonus']] as const) {
      const screen = cabinet.getObjectByName(name) as THREE.Mesh;
      const aspect = screenAspect(screen.geometry);
      const canvas = topArt === 'flat' ? paintScreenCanvas(c, aspect) : paintScreenWith(paintVelvetUpperScreen, c, kind, aspect);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      mountScreenTexture(THREE, screen, tex);
    }
    mounted = m.id;
  }
  renderer.render(scene, camera);
  const label = document.getElementById('label');
  if (label) label.textContent = `triple-screen cabinet study · ${view} · reels: ${mounted} · dev preview, not final art`;
  (globalThis as Record<string, unknown>).__tripleSlot = {
    ready: true,
    view,
    machine: mounted,
    stats: { ...authoredReport, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles },
    rects: {
      reels: projectedRect('VA_main_reels_5x5_glass'),
      bonus: projectedRect('VA_bonus_display_glass'),
      marquee: projectedRect('VA_top_marquee_glass'),
    },
  };
}
main().catch((e) => {
  (globalThis as Record<string, unknown>).__tripleSlot = { ready: true, error: String(e) };
  throw e;
});
