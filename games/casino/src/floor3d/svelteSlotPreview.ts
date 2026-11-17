/**
 * Dev-only page (`/svelte-slot.html?view=front|three|side|top|seated|back|low`, optional `&reel=art` for ChatGPT's reel-screen texture (VA-0120), `&sides=double` / `&reel=checker` diagnostics): ChatGPT's slim S-curve
 * "Svelte 01" cabinet (VA-0110, art/casino/3d/svelteSlotCabinet.mjs) alone on a plain floor, with
 * a 1.75 m grey human-scale reference beside it. For review captures and measurements only; never
 * in the game. `&reel=art&spin=loop` scrolls symbol strips inside the art's `reelWindows` (VA-0122);
 * `&spin=<seconds>` freezes one spin at that time, for captures. Add `&engine=<machine id>` (e.g. `sevens`) to
 * run the real slot engine instead: its reel strips, stops, 5x5 grid and 50-line wins, drawn with the
 * machine's own symbol PNGs (the ones the 2D slots use). Preview-only: no chips, bets or saves.
 * `&finish=luxury` applies ChatGPT's optional luxury finish (VA-0129).
 * `__svelte.report()` gives the cabinet's bounds, per-part bounds and render cost.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createSvelteSlotCabinet } from '../../../../art/casino/3d/svelteSlotCabinet.mjs';
import { createSvelteReelScreen } from '../../../../art/casino/3d/svelteReelScreen.mjs';
import { applySvelteLuxuryFinish } from '../../../../art/casino/3d/svelteLuxuryFinish.mjs';
import { auditMeshes, findShadingSeams } from './meshAudit';
import { safeArtBuild } from './safeArtBuild';
import { ROWS as GAME_ROWS, LINES, MACHINES, strips, spinStops, gridFromStops, evaluate } from '../logic/slots';
import { reelPoses, stopTime, symbolAt, targetsFromStops, winningCells, type SpinPlan } from './reelSpin';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LIGHT_RIGS } from './lighting';

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
// `&finish=luxury`: ChatGPT's optional luxury finish (VA-0129, art/casino/3d/svelteLuxuryFinish.mjs),
// called unchanged on the built cabinet. Its HDR lights join the Vegas LED pulse below.
let finishError: string | null = null;
if (params.get('finish') === 'luxury' && !buildError) {
  try { applySvelteLuxuryFinish(THREE, cabinet); } catch (e) { finishError = String(e); console.warn('[svelte-slot] luxury finish failed:', e); }
}
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

type Win = { x: number; y: number; w: number; h: number };
type ArtScreen = { canvas: HTMLCanvasElement; texture: THREE.Texture; reelWindows?: Win[] };
/**
 * Scrolls symbol strips inside the art's `reelWindows` on its own canvas (VA-0122 request). The art
 * module and its values are unchanged: each window is first cleared with a 1-px row of the art's own
 * rail gradient taken above the symbols, then strip symbols are drawn in the art's font and colours,
 * clipped to the window. Outcomes are preview-only pseudo-random picks, not the slot engine.
 */
function makeReelAnim(screen: ArtScreen, mode: string, engineId: string | null) {
  const wins = screen.reelWindows ?? [];
  // the art's own symbol set (VA-0126)
  const STRIP = ['7', '◆', '♛', '★', '♥', '♠', '✦'];
  // `&engine=<id>`: the slot engine's machine, its per-reel strips and its symbol images
  const machine = engineId ? MACHINES.find((m) => m.id === engineId) ?? null : null;
  const engStrips = machine && wins.length === 5 ? strips(machine) : null;
  const lens = engStrips ? engStrips.map((st) => st.length) : wins.map(() => STRIP.length);
  const icons = new Map<string, HTMLImageElement>();
  if (engStrips) for (const sym of machine!.symbols) {
    const img = new Image();
    img.src = `./art/slots/${machine!.id}/${sym}.png`;
    icons.set(sym, img);
  }
  const iconsReady = Promise.all([...icons.values()].map((im) => im.decode().catch(() => undefined)));
  let result: ReturnType<typeof evaluate> | null = null;
  let winSet = new Set<number>();
  // rows per reel: the game's 5x5 grid (logic/slots.ts ROWS), which the art draws since VA-0126
  const ROWS = GAME_ROWS;
  const MID = Math.floor(ROWS / 2);
  const g = screen.canvas.getContext('2d')!;
  const base = document.createElement('canvas');
  base.width = screen.canvas.width; base.height = screen.canvas.height;
  base.getContext('2d')!.drawImage(screen.canvas, 0, 0);
  const sy = screen.canvas.height / 1024;
  // `&seed=<n>` picks the preview's (non-secure, preview-only) random sequence, for repeatable captures
  let seed = Number(params.get('seed') ?? 7) || 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let plan: SpinPlan = { targets: wins.map(() => 0), stripLength: STRIP.length, from: wins.map((_, i) => i * 2) };
  const newPlan = (from: number[]) => {
    if (!engStrips) { plan = { targets: wins.map(() => Math.floor(rnd() * STRIP.length)), stripLength: STRIP.length, from }; return; }
    // the real engine: random stops on its strips, the landed grid, and its 50-line evaluation (line bet 1)
    const stops = spinStops(machine!, rnd);
    result = evaluate(machine!, gridFromStops(machine!, stops), 1);
    winSet = winningCells(result.lineWins, LINES, ROWS);
    // the engine's strips are long (60-plus symbols): one extra turn per later reel is plenty
    plan = { targets: targetsFromStops(stops, lens, ROWS), stripLength: lens[0]!, stripLengths: lens, from, minTurns: 1 };
  };
  newPlan(plan.from!);
  let started = performance.now();
  const frozen = Number(mode);
  let spins = 1;
  let last = reelPoses(plan, 0);
  let prev: number[] | null = null;
  let lastT = 0;
  const draw = (t: number) => {
    last = reelPoses(plan, t);
    lastT = t;
    // rows moved since the last frame (or over 1/60 s when frozen for a capture): drives the blur
    const ahead = reelPoses(plan, t + 1 / 60);
    const speed = last.map((p, i) => Math.abs((prev && !Number.isFinite(frozen) ? p.pos - prev[i]! : ahead[i]!.pos - p.pos)));
    prev = last.map((p) => p.pos);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    wins.forEach((w, i) => {
      const pose = last[i]!;
      // clear the window with the art's own rail gradient (a symbol-free row 5 px below the window top)
      g.drawImage(base, w.x, w.y + Math.round(5 * sy), w.w, 1, w.x, w.y, w.w, w.h);
      g.save();
      g.beginPath(); g.rect(w.x, w.y, w.w, w.h); g.clip();
      const rowH = w.h / ROWS;
      // symbol size from the cell, so five narrow reels' symbols fit their windows
      g.font = `bold ${Math.round(Math.min(rowH * 0.62, w.w * 0.62))}px Georgia,serif`;
      const frac = pose.pos - Math.floor(pose.pos);
      // a small settle when the reel lands: it runs on a little past the stop and eases back
      const since = t - stopTime(plan, i);
      const settle = pose.stopped && since < 0.28 ? Math.sin((since / 0.28) * Math.PI) * (1 - since / 0.28) * 0.14 * rowH : 0;
      // motion blur while fast: fading trailing copies along the travel, scaled by speed
      const blur = Math.min(speed[i]! * 1.6, 1);
      for (let row = -1; row <= ROWS; row++) {
        const cy = w.y + (row + 0.5 + frac) * rowH + settle;
        const idx = symbolAt(pose.pos, row, ROWS, lens[i]!);
        if (engStrips) {
          const img = icons.get(engStrips[i]![idx]!);
          const sz = Math.min(rowH, w.w) * 0.86;
          const x0 = w.x + (w.w - sz) / 2;
          if (img?.complete && img.naturalWidth) {
            if (blur > 0.08) for (let k = 1; k <= 3; k++) {
              g.globalAlpha = 0.28 * blur * (1 - k / 4);
              g.drawImage(img, x0, cy - sz / 2 - k * blur * rowH * 0.16, sz, sz);
            }
            g.globalAlpha = blur > 0.08 ? 1 - 0.45 * blur : 1;
            g.drawImage(img, x0, cy - sz / 2, sz, sz);
            g.globalAlpha = 1;
          }
          // winning cells, once every reel has landed: an outline in the preview's existing red
          if (row >= 0 && row < ROWS && last.every((p) => p.stopped) && winSet.has(i * ROWS + row)) {
            g.strokeStyle = '#ab1733'; g.lineWidth = 3;
            g.strokeRect(w.x + 2, cy - rowH / 2 + 2, w.w - 4, rowH - 4);
          }
          continue;
        }
        g.fillStyle = pose.stopped && row === MID ? '#ab1733' : '#1c3759';
        if (blur > 0.08) {
          for (let k = 1; k <= 3; k++) {
            g.globalAlpha = 0.28 * blur * (1 - k / 4);
            g.fillText(STRIP[idx]!, w.x + w.w / 2, cy - k * blur * rowH * 0.16);
          }
          g.globalAlpha = 1 - 0.45 * blur;
        }
        g.fillText(STRIP[idx]!, w.x + w.w / 2, cy);
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(28,41,59,.25)';
        g.fillRect(w.x + 3, cy + rowH / 2 - 1, w.w - 6, 2);
      }
      g.restore();
    });
    g.restore();
    screen.texture.needsUpdate = true;
  };
  return {
    windows: wins,
    frozen: Number.isFinite(frozen) ? frozen : null,
    iconsReady,
    tick(now: number) {
      if (Number.isFinite(frozen)) { draw(frozen); return; }
      let t = (now - started) / 1000;
      if (t > 4) { newPlan(last.map((p, i) => p.pos % lens[i]!)); started = now; t = 0; spins++; }
      draw(t);
    },
    /** Seconds since the last reel landed (negative while any reel still spins). */
    landedFor: () => lastT - stopTime(plan, wins.length - 1),
    state: () => ({
      windows: wins, spins,
      engine: engStrips ? {
        machine: machine!.id, stripLengths: lens, total: result?.total ?? 0, lineWins: result?.lineWins.length ?? 0,
        grid: result?.grid ?? null,
        // what the window shows now, read back from the poses: equals `grid` once every reel has landed
        shown: last.map((p, r) => Array.from({ length: ROWS }, (_, row) => engStrips[r]![symbolAt(p.pos, row, ROWS, lens[r]!)])),
        iconsLoaded: [...icons.values()].filter((im) => im.complete && im.naturalWidth > 0).length,
      } : null,
      targets: engStrips ? plan.targets : plan.targets.map((i) => STRIP[i]), poses: last.map((p) => ({ pos: Math.round(p.pos * 100) / 100, stopped: p.stopped })) }),
  };
}
let reelAnim: ReturnType<typeof makeReelAnim> | null = null;
if (params.get('reel') === 'art') {
  // ChatGPT's still reel-screen texture (VA-0120, art/casino/3d/svelteReelScreen.mjs), used unchanged.
  try {
    const screen = createSvelteReelScreen(THREE, { width: 512, height: 1024 }) as ArtScreen;
    reelSwap = { ...swapScreen(screen.texture), source: 'svelteReelScreen.mjs' };
    if (params.has('spin')) reelAnim = makeReelAnim(screen, params.get('spin')!, params.get('engine'));
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

// `&look=vegas` (the phone review page): the floor's Vegas rig (lighting.ts), a darker room, the
// screen lit as a display (its own texture as emissive) and the floor's HDR-only bloom, so the LED
// lines glow as they would on the floor. Host-side lighting and material setup only; the art is unchanged.
let draw = () => renderer.render(scene, camera);
let ledPulse: ((now: number) => void) | null = null;
if (params.get('look') === 'vegas') {
  const rig = LIGHT_RIGS.vegas;
  renderer.toneMappingExposure = rig.exposure;
  scene.environmentIntensity = rig.envIntensity;
  scene.background = new THREE.Color(0x07040a);
  scene.traverse((o) => { const l = o as THREE.HemisphereLight; if (l.isHemisphereLight) { l.color.set(rig.hemi.sky); l.groundColor.set(rig.hemi.ground); l.intensity = rig.hemi.intensity; } });
  key.color.set(rig.lamp.color);
  key.intensity = rig.lamp.intensity * 1.2;
  key.decay = rig.lamp.decay;
  // higher and further back, so its highlight on the glass falls above the screen in the front view (VA-0125 glare)
  key.position.set(0.9, 4.6, 1.4);
  key.target.position.set(0, 0.9, 0.3);
  (floor.material as THREE.MeshStandardMaterial).color.set(0x1a1218);
  human.visible = false;
  cabinet.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.isMesh ? (m.material as THREE.MeshStandardMaterial) : null;
    if (mat && mat.name === cabinet.userData.screenMaterialName && mat.map) { mat.emissiveMap = mat.map; mat.emissive.set(0xffffff); mat.emissiveIntensity = 0.8; mat.color.set(0x000000); mat.needsUpdate = true; }
  });
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), rig.bloom!.strength, rig.bloom!.radius, rig.bloom!.threshold));
  composer.addPass(new OutputPass());
  composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  composer.setSize(innerWidth, innerHeight);
  draw = () => composer.render();
  // the art's LED lines (its HDR emissive material) breathe slowly, and flash as the last reel lands
  const leds: { mat: THREE.MeshStandardMaterial; base: number }[] = [];
  cabinet.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.isMesh ? (m.material as THREE.MeshStandardMaterial) : null;
    if (mat && mat.emissiveIntensity > 1 && !leds.some((l) => l.mat === mat)) leds.push({ mat, base: mat.emissiveIntensity });
  });
  ledPulse = (now) => {
    const landed = reelAnim?.landedFor() ?? -1;
    const flash = landed >= 0 && landed < 0.9 ? 0.9 * Math.abs(Math.sin(landed * Math.PI * 3.3)) * (1 - landed / 0.9) : 0;
    for (const l of leds) l.mat.emissiveIntensity = l.base * (0.82 + 0.18 * Math.sin(now * 0.0025) + flash);
  };
}

reelAnim?.tick(performance.now());
renderer.render(scene, camera);
const before = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
// cabinet-only cost: render it alone once (floor, figure hidden)
floor.visible = human.visible = false;
renderer.render(scene, camera);
const cabinetOnly = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
floor.visible = true;
human.visible = params.get('look') !== 'vegas';
draw();
if (reelAnim && reelAnim.frozen === null) {
  renderer.setAnimationLoop((now) => { reelAnim!.tick(now); ledPulse?.(now); draw(); });
}
// a frozen capture draws once, so redraw it when the engine's symbol images finish loading
if (reelAnim && reelAnim.frozen !== null) void reelAnim.iconsReady.then(() => { reelAnim!.tick(performance.now()); draw(); });

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
    return { buildError, finishError, bounds: box(cabinet), meshes, materials: materials.size, triangles: tris, sceneRender: before, cabinetRender: cabinetOnly, reelSwap, reelSpin: reelAnim?.state() ?? null, audit: auditMeshes(cabinet), parts, userData: cabinet.userData };
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
