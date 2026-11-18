/**
 * Prototype floor switch "Machines: Svelte islands" (Joshua, 2026-11-17: "Yes, add it"). Swaps every
 * machine on the floor for ChatGPT's Svelte 01 cabinet and closes each row with Claude's marquee end
 * cap. Opt-in from the ⚙ menu (stored), prototype only; the classic machines stay the default.
 *
 * - Each slot position (1.22 m wide in the art) takes a pair of Svelte cabinets (0.612 m each) side
 *   by side, so the pair fills the old footprint and the old collision box still fits it.
 * - Each pair's screens show that machine's own symbols (the 2D slots' PNGs) in a static 5×5 grid
 *   on ChatGPT's reel-screen art. Not playable here; the floor's machines aren't yet.
 * - Rows: machines that face the same way on one line, less than 2.2 m apart. An end cap stands
 *   past each end of every row, unless it would hit another obstacle or leave the room.
 *
 * Engineering composition only; the art modules are used as authored.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createSvelteSlotCabinet } from '../../../../art/casino/3d/svelteSlotCabinet.mjs';
import { applySvelteLuxuryFinish } from '../../../../art/casino/3d/svelteLuxuryFinish.mjs';
import { createSvelteReelScreen } from '../../../../art/casino/3d/svelteReelScreen.mjs';
import { createSvelteSlotCabinetFarLOD } from '../../../../art/casino/3d/svelteSlotCabinetFarLOD.mjs';
import { createVelvetIslandEndCapMarquee } from '../../../../art/casino/3d/velvetIslandEndCapMarquee.mjs';
import { MACHINES, strips } from '../logic/slots.ts';
import type { Obstacle, RoomBounds, SlotPlacement } from './layout.ts';
import { buildSvelteLod, type CabinetSpot, type SvelteLod } from './svelteLod.ts';

/** `svelte-lod`: the Svelte islands with distance LOD (svelteLod.ts), only the nearest cabinets in full detail. */
export type MachineStyle = 'classic' | 'svelte' | 'svelte-lod';
/** The ⚙ button's cycle. */
export const NEXT_MACHINE_STYLE: Record<MachineStyle, MachineStyle> = { classic: 'svelte', svelte: 'svelte-lod', 'svelte-lod': 'classic' };
/** Cabinets drawn in full detail with distance LOD on (the rest draw ChatGPT's far LOD). */
export const SVELTE_NEAR_CABINETS = 6;
export const MACHINES_STORAGE_KEY = 'va3d.machines';

/** The stored machine style; anything unknown is the classic machines. */
export function readMachineStyle(): MachineStyle {
  try {
    const v = localStorage.getItem(MACHINES_STORAGE_KEY);
    return v === 'svelte' || v === 'svelte-lod' ? v : 'classic';
  } catch {
    return 'classic';
  }
}

/** The two cabinets of a pair stand this far either side of the slot's centre. */
export const SVELTE_PAIR_X = 0.32;
/** Half the Svelte cabinet's width (its bounds: x ±0.306). */
const CABINET_HALF_W = 0.306;
/**
 * End cap size and seat, in the slot's own frame (front +Z): it spans the cabinet from its back
 * (z −0.34, with ChatGPT's re-centred shoe, VA-0148) to the deck's front (z 0.35), plus 1.5 cm.
 */
export const CAP = { width: 0.09, depth: 0.72, height: 2.09, centreZ: 0.005, gap: 0.02 } as const;
/** Machines further apart than this along a line are separate rows. */
const ROW_BREAK = 2.2;

export interface CapPlacement {
  x: number;
  z: number;
  /** The cap's decorated face is its local +X, turned by this. */
  rotationY: number;
}

/** One end cap past each end of every row of machines. */
export function svelteRowCaps(slots: readonly SlotPlacement[]): CapPlacement[] {
  const rows = new Map<string, { s: SlotPlacement; t: number }[]>();
  for (const s of slots) {
    const nx = Math.sin(s.rotationY), nz = Math.cos(s.rotationY); // facing (local +Z)
    const lx = Math.cos(s.rotationY), lz = -Math.sin(s.rotationY); // along the row (local +X)
    const key = `${Math.round(Math.atan2(nx, nz) * 100)}|${Math.round((s.x * nx + s.z * nz) * 10)}`;
    let row = rows.get(key);
    if (!row) rows.set(key, (row = []));
    row.push({ s, t: s.x * lx + s.z * lz });
  }
  const caps: CapPlacement[] = [];
  const off = SVELTE_PAIR_X + CABINET_HALF_W + CAP.gap + CAP.width / 2;
  const capAt = (s: SlotPlacement, sign: number): CapPlacement => {
    const nx = Math.sin(s.rotationY), nz = Math.cos(s.rotationY);
    const lx = Math.cos(s.rotationY), lz = -Math.sin(s.rotationY);
    return {
      x: s.x + lx * sign * off + nx * CAP.centreZ,
      z: s.z + lz * sign * off + nz * CAP.centreZ,
      rotationY: s.rotationY + (sign > 0 ? 0 : Math.PI),
    };
  };
  for (const row of rows.values()) {
    row.sort((a, b) => a.t - b.t);
    let start = 0;
    for (let i = 1; i <= row.length; i++) {
      if (i < row.length && row[i].t - row[i - 1].t <= ROW_BREAK) continue;
      caps.push(capAt(row[start].s, -1), capAt(row[i - 1].s, 1));
      start = i;
    }
  }
  return caps;
}

/** The cap's floor footprint as an axis-aligned box obstacle. */
export function capObstacle(c: CapPlacement, i: number): Obstacle & { kind: 'box' } {
  const hw = CAP.width / 2 + 0.02, hd = CAP.depth / 2;
  const cs = Math.abs(Math.cos(c.rotationY)), sn = Math.abs(Math.sin(c.rotationY));
  const ex = hw * cs + hd * sn, ez = hw * sn + hd * cs;
  return { kind: 'box', id: `svelte-end-cap-${i + 1}`, x0: c.x - ex, z0: c.z - ez, x1: c.x + ex, z1: c.z + ez, h: CAP.height };
}

function overlaps(b: { x0: number; z0: number; x1: number; z1: number }, o: Obstacle): boolean {
  if (o.kind === 'box') return b.x0 < o.x1 && b.x1 > o.x0 && b.z0 < o.z1 && b.z1 > o.z0;
  const cx = Math.min(Math.max(o.x, b.x0), b.x1), cz = Math.min(Math.max(o.z, b.z0), b.z1);
  return Math.hypot(o.x - cx, o.z - cz) < o.r;
}

/**
 * The caps that fit: inside the room and clear of every other obstacle (columns, benches, tables,
 * other machines). Returns them with their obstacles, and how many were dropped.
 */
export function fitCaps(caps: readonly CapPlacement[], existing: readonly Obstacle[], room: Readonly<RoomBounds>): { caps: CapPlacement[]; obstacles: Obstacle[]; dropped: number } {
  const kept: CapPlacement[] = [];
  const obstacles: Obstacle[] = [];
  for (const c of caps) {
    const box = capObstacle(c, kept.length);
    const inRoom = box.x0 >= room.x0 && box.x1 <= room.x1 && box.z0 >= room.z0 && box.z1 <= room.z1;
    if (!inRoom || existing.some((o) => overlaps(box, o)) || obstacles.some((o) => overlaps(box, o))) continue;
    kept.push(c);
    obstacles.push(box);
  }
  return { caps: kept, obstacles, dropped: caps.length - kept.length };
}

/** A machine's static 5×5 screen: ChatGPT's reel-screen art with that machine's own symbols. */
function machineScreen(id: string, base: THREE.MeshStandardMaterial, textures: THREE.Texture[]): THREE.MeshStandardMaterial {
  const mat = base.clone();
  if (typeof document === 'undefined') return mat;
  const screen = createSvelteReelScreen(THREE, { width: 512, height: 1024 }) as {
    canvas: HTMLCanvasElement; texture: THREE.Texture; reelWindows: { x: number; y: number; w: number; h: number }[];
  };
  textures.push(screen.texture);
  mat.map = screen.texture;
  mat.emissiveMap = screen.texture;
  mat.color.set(0x000000);
  mat.emissive.set(0xffffff);
  mat.emissiveIntensity = 0.8;
  const machine = MACHINES.find((m) => m.id === id);
  if (!machine) return mat;
  const reels = strips(machine);
  const g = screen.canvas.getContext('2d')!;
  const cells: { img: HTMLImageElement; x: number; y: number; s: number }[] = [];
  screen.reelWindows.forEach((w, r) => {
    const strip = reels[r];
    if (!strip) return;
    const rowH = w.h / 5;
    // the art's own rail gradient, a symbol-free row 5 px into the window, clears the art's glyphs
    g.drawImage(screen.canvas, w.x, w.y + 5, w.w, 1, w.x, w.y, w.w, w.h);
    for (let row = 0; row < 5; row++) {
      const img = new Image();
      img.src = `./art/slots/${id}/${strip[(r * 7 + row) % strip.length]}.png`;
      const s = Math.min(rowH, w.w) * 0.86;
      cells.push({ img, x: w.x + (w.w - s) / 2, y: w.y + row * rowH + (rowH - s) / 2, s });
      g.fillStyle = 'rgba(28,41,59,.25)';
      if (row) g.fillRect(w.x + 3, w.y + row * rowH - 1, w.w - 6, 2);
    }
  });
  Promise.all(cells.map((c) => c.img.decode().then(() => c).catch(() => null))).then((loaded) => {
    for (const c of loaded) if (c) g.drawImage(c.img, c.x, c.y, c.s, c.s);
    screen.texture.needsUpdate = true;
  });
  return mat;
}

/**
 * Replaces the cabinets inside every `slot_<id>` and `slotcopy_<id>_<n>` group of the composed floor
 * with a Svelte pair, before batching. The pass-05 pilot's swivel chair stays. Returns the screen
 * textures (for disposal) and how many cabinets went in.
 */
export function applySvelteMachines(art: THREE.Group, slotIds: readonly string[], opts: { lod?: boolean } = {}): { textures: THREE.Texture[]; cabinets: number; lod: SvelteLod | null } {
  const proto = createSvelteSlotCabinet(THREE) as THREE.Group;
  try {
    applySvelteLuxuryFinish(THREE, proto);
  } catch (e) {
    console.warn('[floor3d] svelte luxury finish', e);
  }
  // the floor batches meshes of one material together, which needs the same attributes; since
  // fd81685 (VA-0151) every art mesh ships UVs, so this only guards against a future part without
  proto.traverse((o) => {
    const g = (o as THREE.Mesh).geometry;
    if ((o as THREE.Mesh).isMesh && g && !g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  });
  const screenName = proto.userData.screenMaterialName as string;
  let baseScreen: THREE.MeshStandardMaterial | null = null;
  proto.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.name === screenName) baseScreen = m;
  });
  const textures: THREE.Texture[] = [];
  const screens = new Map<string, THREE.MeshStandardMaterial>();
  const screenFor = (id: string) => {
    let m = screens.get(id);
    if (!m && baseScreen) screens.set(id, (m = machineScreen(id, baseScreen, textures)));
    return m;
  };
  const ids = new Set(slotIds);
  const groups: { g: THREE.Object3D; id: string }[] = [];
  art.traverse((o) => {
    if (o.name.startsWith('slot_') && ids.has(o.name.slice(5))) groups.push({ g: o, id: o.name.slice(5) });
    const copy = /^slotcopy_(.+)_\d+$/.exec(o.name);
    if (copy) groups.push({ g: o, id: copy[1] });
  });
  let cabinets = 0;
  const spots: CabinetSpot[] = [];
  if (opts.lod) art.updateMatrixWorld(true);
  for (const { g, id } of groups) {
    for (const c of [...g.children]) {
      if (c.name === 'pilot_luxury_chair') continue;
      c.removeFromParent();
    }
    for (const sx of [-1, 1]) {
      if (opts.lod) {
        // instanced outside the floor's static batches, so the near set can follow the camera
        spots.push({ id, matrix: g.matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(sx * SVELTE_PAIR_X, 0, 0)) });
        cabinets++;
        continue;
      }
      const cab = proto.clone(true);
      cab.name = `svelte_cabinet_${sx < 0 ? 'l' : 'r'}`;
      cab.position.x = sx * SVELTE_PAIR_X;
      const screen = screenFor(id);
      if (screen) cab.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).name === screenName) m.material = screen; });
      g.add(cab);
      cabinets++;
    }
  }
  if (!opts.lod) return { textures, cabinets, lod: null };
  for (const { id } of spots) screenFor(id);
  const lod = buildSvelteLod(spots, proto, createSvelteSlotCabinetFarLOD(THREE) as THREE.Group, (id) => screens.get(id), SVELTE_NEAR_CABINETS);
  return { textures, cabinets, lod };
}

/**
 * Builds the end caps from one authored cap, merged for the phone: its static parts become one mesh
 * per material across every cap, and all their bulbs one instanced mesh, so 20 caps cost the draw
 * calls (and the two face canvases) of one. Kept out of the floor's batches so the bulbs can chase:
 * the authored cap's own animation runs and its bulb colours are copied to every cap.
 */
export function buildSvelteCaps(caps: readonly CapPlacement[]): { root: THREE.Group; animate: (t: number) => void } {
  const root = new THREE.Group();
  root.name = 'svelte_end_caps';
  if (!caps.length) return { root, animate: () => {} };
  const cap = createVelvetIslandEndCapMarquee(THREE, { depth: CAP.depth, height: CAP.height, width: CAP.width }) as THREE.Group;
  cap.updateMatrixWorld(true);
  const placements = caps.map((c) => new THREE.Matrix4().compose(new THREE.Vector3(c.x, 0, c.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.rotationY), new THREE.Vector3(1, 1, 1)));
  const byMaterial = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; names: string[]; glow: boolean }>();
  let bulbs: THREE.InstancedMesh | null = null;
  cap.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if ((m as THREE.InstancedMesh).isInstancedMesh) {
      bulbs = m as THREE.InstancedMesh;
      return;
    }
    const base = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
    base.clearGroups();
    const material = m.material as THREE.Material;
    let b = byMaterial.get(material);
    if (!b) byMaterial.set(material, (b = { geos: [], names: [], glow: false }));
    b.names.push(m.name);
    b.glow ||= m.userData.glow === true;
    for (const p of placements) b.geos.push(base.clone().applyMatrix4(p));
    base.dispose();
  });
  for (const [material, b] of byMaterial) {
    const merged = mergeGeometries(b.geos);
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `svelte_end_caps:${b.names[0]}`;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.glow = b.glow;
    root.add(mesh);
  }
  const src = bulbs as THREE.InstancedMesh | null;
  let copyColours = () => {};
  if (src) {
    const n = src.count;
    const all = new THREE.InstancedMesh(src.geometry, src.material, n * placements.length);
    all.name = 'svelte_end_caps:marquee_chase_bulbs';
    all.userData.glow = true;
    const local = new THREE.Matrix4(), world = new THREE.Matrix4();
    placements.forEach((p, k) => {
      for (let i = 0; i < n; i++) {
        src.getMatrixAt(i, local);
        all.setMatrixAt(k * n + i, world.multiplyMatrices(p, src.matrixWorld).multiply(local));
      }
    });
    all.instanceMatrix.needsUpdate = true;
    all.computeBoundingSphere();
    all.setColorAt(0, new THREE.Color());
    const dst = all.instanceColor!.array as Float32Array;
    copyColours = () => {
      const c = src.instanceColor!.array as Float32Array;
      for (let k = 0; k < placements.length; k++) dst.set(c, k * c.length);
      all.instanceColor!.needsUpdate = true;
    };
    copyColours();
    root.add(all);
  }
  const animateCap = cap.userData.animate as ((t: number) => void) | undefined;
  return {
    root,
    animate: (t) => {
      animateCap?.(t);
      copyColours();
    },
  };
}
