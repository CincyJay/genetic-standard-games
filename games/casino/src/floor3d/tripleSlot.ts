/**
 * Engineering adapter for ChatGPT's triple-screen slot cabinet study (art commit 1670e35, VA-0256):
 * `art/casino/3d/velvetTripleScreenSlotStudy.mjs`, used exactly as authored. Prototype only:
 * mounted on the isolated page triple-slot.html; nothing on the casino floor uses it.
 *
 * What engineering adds (no art values change):
 *  - `fitScreenUvs`: the screens are ExtrudeGeometry, whose caps get UVs in shape units
 *    (metres, e.g. -0.315..0.315), so a game texture would tile/clamp. This rescales the cap UVs
 *    (geometry group 0) to 0..1 over the caps' own x/y bounds. Side walls (group 1) are untouched.
 *  - `mountScreenTexture`: puts a game texture on the front cap only; the bevel sides keep the
 *    authored glass material.
 *  - `cabinetReport`: triangles, meshes, materials, bounds, and whether each screen's front cap
 *    faces +Z, for tests and the capture page.
 */
import type * as THREE_NS from 'three';
import type { Machine } from '../logic/slots.ts';

type Three = typeof THREE_NS;

export const TRIPLE_SCREENS = ['top_marquee', 'bonus_display', 'main_reels_5x5'] as const;

/** Rescale ExtrudeGeometry cap UVs (group 0) to 0..1 over the flat caps' x/y extent. */
export function fitScreenUvs(geometry: THREE_NS.BufferGeometry): void {
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  if (!pos || !uv) throw new Error('screen geometry lacks position/uv');
  const caps = geometry.groups.find((g) => g.materialIndex === 0) ?? { start: 0, count: uv.count };
  const index = geometry.getIndex();
  const end = caps.start + caps.count;
  // bounds of the flat caps only: the bevel ring lies outside them, so the whole image lands on the face
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = caps.start; i < end; i++) {
    const n = index ? index.getX(i) : i;
    x0 = Math.min(x0, pos.getX(n)); x1 = Math.max(x1, pos.getX(n));
    y0 = Math.min(y0, pos.getY(n)); y1 = Math.max(y1, pos.getY(n));
  }
  const b = { min: { x: x0, y: y0 } };
  const w = x1 - x0 || 1;
  const h = y1 - y0 || 1;
  for (let i = caps.start; i < end; i++) {
    const n = index ? index.getX(i) : i;
    uv.setXY(n, (pos.getX(n) - b.min.x) / w, (pos.getY(n) - b.min.y) / h);
  }
  uv.needsUpdate = true;
}

/** Map `texture` onto a screen's caps; sides keep the authored material. */
export function mountScreenTexture(THREE: Three, screen: THREE_NS.Mesh, texture: THREE_NS.Texture): THREE_NS.Material {
  fitScreenUvs(screen.geometry);
  const authored = Array.isArray(screen.material) ? screen.material[0] : screen.material;
  const face = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  face.name = `${screen.name}_game_texture`;
  screen.material = [face, authored];
  return face;
}

export interface CabinetReport {
  meshes: number;
  triangles: number;
  materials: number;
  bounds: { min: number[]; max: number[] };
  /** Per screen: share of cap triangles at the panel's front (max z) whose normal points +Z. */
  screensFacingFront: Record<string, number>;
}

const r3 = (v: THREE_NS.Vector3) => [v.x, v.y, v.z].map((n) => +n.toFixed(3));

export function cabinetReport(THREE: Three, root: THREE_NS.Object3D): CabinetReport {
  root.updateMatrixWorld(true);
  let meshes = 0;
  let triangles = 0;
  const mats = new Set<THREE_NS.Material>();
  root.traverse((o) => {
    const m = o as THREE_NS.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const g = m.geometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat);
  });
  const screensFacingFront: Record<string, number> = {};
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (const s of (root.userData.screenSurfaces ?? []) as THREE_NS.Mesh[]) {
    const g = s.geometry;
    g.computeBoundingBox();
    const zFront = g.boundingBox!.max.z;
    const pos = g.getAttribute('position');
    const idx = g.getIndex();
    const caps = g.groups.find((gr) => gr.materialIndex === 0) ?? { start: 0, count: idx ? idx.count : pos.count };
    let front = 0, good = 0;
    for (let i = caps.start; i < caps.start + caps.count; i += 3) {
      const at = (k: number) => (idx ? idx.getX(k) : k);
      a.fromBufferAttribute(pos, at(i)); b.fromBufferAttribute(pos, at(i + 1)); c.fromBufferAttribute(pos, at(i + 2));
      if (Math.abs(a.z - zFront) > 1e-4 || Math.abs(b.z - zFront) > 1e-4 || Math.abs(c.z - zFront) > 1e-4) continue;
      front++;
      n.subVectors(c, b).cross(a.clone().sub(b));
      if (n.z > 0) good++;
    }
    screensFacingFront[String(s.userData.slotScreen ?? s.name)] = front ? good / front : 0;
  }
  const box = new THREE.Box3().setFromObject(root);
  return { meshes, triangles, materials: mats.size, bounds: { min: r3(box.min), max: r3(box.max) }, screensFacingFront };
}

/**
 * Upper-screen content (VA-0282: the marquee and bonus screens were blank navy glass in every capture).
 * Engineering placeholder copy taken from the machine's own data (name, feature, jackpot ladder); the
 * styling in `paintScreenCanvas` is a flat, readable placeholder for ChatGPT to replace, not final art.
 */
export interface ScreenCopy { title: string; lines: string[] }

const FEATURE_LABEL: Record<Machine['feature'], string> = {
  freespins: 'FREE SPINS',
  pick: 'PICK BONUS',
  expanding: 'EXPANDING WILDS',
  wheel: 'WHEEL BONUS',
  holdspin: 'HOLD & SPIN',
};

const fmt = (n: number) => n.toLocaleString('en-US');

export function topScreenCopy(m: Machine): { marquee: ScreenCopy; bonus: ScreenCopy } {
  // the feature name is the bonus screen's title, so the marquee carries the machine name alone
  const marquee = { title: m.name.toUpperCase(), lines: [] as string[] };
  const lines: string[] = [];
  if (m.holdSpin) {
    const named = m.holdSpin.values.filter((v) => v.lantern.label).sort((a, b) => b.lantern.mult - a.lantern.mult);
    lines.push(`GRAND ${fmt(m.holdSpin.grand)}×`, ...named.map((v) => `${v.lantern.label} ${fmt(v.lantern.mult)}×`));
  } else if (m.freeSpins) {
    lines.push(`3 / 4 / 5 SCATTERS = ${m.freeSpins.join(' / ')} SPINS`);
  } else if (m.wheel) {
    lines.push(`TOP PRIZE ${fmt(Math.max(...m.wheel.prizes))}× BET`);
  } else if (m.pickPrizes) {
    lines.push(`PICK ${m.picks ?? 3} · UP TO ${fmt(Math.max(...m.pickPrizes))}× BET`);
  }
  if (m.blurb) lines.push(m.blurb);
  return { marquee, bonus: { title: FEATURE_LABEL[m.feature], lines: lines.slice(0, 4) } };
}

/** Cap width/height of an extruded screen (front face only), for sizing its canvas. */
export function screenAspect(geometry: THREE_NS.BufferGeometry): number {
  const pos = geometry.getAttribute('position');
  const idx = geometry.getIndex();
  const caps = geometry.groups.find((g) => g.materialIndex === 0) ?? { start: 0, count: idx ? idx.count : pos.count };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = caps.start; i < caps.start + caps.count; i++) {
    const n = idx ? idx.getX(i) : i;
    x0 = Math.min(x0, pos.getX(n)); x1 = Math.max(x1, pos.getX(n));
    y0 = Math.min(y0, pos.getY(n)); y1 = Math.max(y1, pos.getY(n));
  }
  return (x1 - x0) / (y1 - y0 || 1);
}

/**
 * Canvas sized to a screen cap (`width` px wide, height from `aspect`) with `copy` drawn by an
 * external painter such as ChatGPT's `paintVelvetUpperScreen` (art d16bf75, VA-0285). The copy
 * stays engineering data (`topScreenCopy`); the look is the painter's. Browser only.
 */
export type ScreenPainter = (canvas: HTMLCanvasElement, copy: ScreenCopy, options: { kind: 'marquee' | 'bonus' }) => unknown;
export function paintScreenWith(
  painter: ScreenPainter, copy: ScreenCopy, kind: 'marquee' | 'bonus', aspect: number, width = 640,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(1, Math.round(width / aspect));
  painter(canvas, copy, { kind });
  return canvas;
}

/** Fallback flat placeholder: draw `copy` centred on a canvas `aspect` wide per unit tall. Browser only. */
export function paintScreenCanvas(copy: ScreenCopy, aspect: number, width = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(width / aspect);
  const g = canvas.getContext('2d')!;
  const { width: w, height: h } = canvas;
  g.fillStyle = '#14081c';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9a24a';
  g.lineWidth = Math.max(2, w * 0.01);
  g.strokeRect(g.lineWidth, g.lineWidth, w - 2 * g.lineWidth, h - 2 * g.lineWidth);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const fit = (text: string, px: number, weight: string) => {
    let size = px;
    do { g.font = `${weight} ${size}px sans-serif`; size -= 2; } while (g.measureText(text).width > w * 0.88 && size > 10);
  };
  const rows = 1 + copy.lines.length;
  const titleY = copy.lines.length > 1 ? h * 0.24 : copy.lines.length ? h * 0.38 : h / 2;
  fit(copy.title, Math.round(h * (rows > 2 ? 0.2 : 0.26)), 'bold');
  g.fillStyle = '#f2d27a';
  g.fillText(copy.title, w / 2, titleY);
  g.fillStyle = '#efe6f4';
  // body lines share the band 0.42h..0.94h (one line sits at 0.68h)
  const step = (h * 0.52) / Math.max(1, copy.lines.length);
  copy.lines.forEach((line, i) => {
    fit(line, Math.round(Math.min(step * 0.62, h * 0.14)), '600');
    g.fillText(line, w / 2, h * 0.42 + step * (i + 0.5));
  });
  return canvas;
}
