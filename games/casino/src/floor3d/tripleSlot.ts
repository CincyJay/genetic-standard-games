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
