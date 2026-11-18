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
import { createVelvetSlotStool } from '../../../../art/casino/3d/velvetSlotStool.mjs';
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
/** Machines further apart than this along a line are separate rows (salon slots are 2.3 m apart). */
const ROW_BREAK = 2.6;
/**
 * Continuous banks (Joshua's reference room, VA-0160): cabinets side by side along each row at no
 * less than this pitch, a stool in front of each. A slot alone in its row keeps a pair.
 */
export const BANK = { pitchMin: 0.64, soloHalf: 0.65, stoolZ: 0.88, stoolR: 0.27, backZ: -0.42, frontZ: 0.6 } as const;

interface Placed { x: number; z: number; rotationY: number }
/** One slot spot's share of its bank: cabinet offsets along its local X, and its stools. */
export interface BankSlot {
  slot: SlotPlacement;
  offsets: number[];
  /** Stools that fit, as local X offsets (each at local z BANK.stoolZ, facing the cabinet). */
  stools: number[];
}
export interface BankPlan {
  slots: BankSlot[];
  caps: CapPlacement[];
  /** Collision: a box along each spot's cabinets, the stools, and the caps that fit. */
  obstacles: Obstacle[];
  stoolsDropped: number;
  capsDropped: number;
}

const toWorld = (s: SlotPlacement, lx: number, lz: number): { x: number; z: number } => ({
  x: s.x + Math.cos(s.rotationY) * lx + Math.sin(s.rotationY) * lz,
  z: s.z - Math.sin(s.rotationY) * lx + Math.cos(s.rotationY) * lz,
});

/** Machines that face the same way on one line, split where they are further apart than ROW_BREAK. */
function rowRuns(slots: readonly SlotPlacement[]): { s: SlotPlacement; t: number }[][] {
  const rows = new Map<string, { s: SlotPlacement; t: number }[]>();
  for (const s of slots) {
    const nx = Math.sin(s.rotationY), nz = Math.cos(s.rotationY); // facing (local +Z)
    const lx = Math.cos(s.rotationY), lz = -Math.sin(s.rotationY); // along the row (local +X)
    const key = `${Math.round(Math.atan2(nx, nz) * 100)}|${Math.round((s.x * nx + s.z * nz) * 10)}`;
    let row = rows.get(key);
    if (!row) rows.set(key, (row = []));
    row.push({ s, t: s.x * lx + s.z * lz });
  }
  const runs: { s: SlotPlacement; t: number }[][] = [];
  for (const row of rows.values()) {
    row.sort((a, b) => a.t - b.t);
    let start = 0;
    for (let i = 1; i <= row.length; i++) {
      if (i < row.length && row[i].t - row[i - 1].t <= ROW_BREAK) continue;
      runs.push(row.slice(start, i));
      start = i;
    }
  }
  return runs;
}

/** A local box (slot frame) as a world axis-aligned box. */
function localBox(s: SlotPlacement, id: string, x0: number, x1: number, z0: number, z1: number, h: number): Obstacle & { kind: 'box' } {
  const pts = [toWorld(s, x0, z0), toWorld(s, x1, z0), toWorld(s, x0, z1), toWorld(s, x1, z1)];
  return { kind: 'box', id, x0: Math.min(...pts.map((p) => p.x)), z0: Math.min(...pts.map((p) => p.z)), x1: Math.max(...pts.map((p) => p.x)), z1: Math.max(...pts.map((p) => p.z)), h };
}

/**
 * Lays every row out as one continuous bank: each slot spot takes the stretch of row halfway to its
 * neighbours and fills it with cabinets at even pitch (≥ BANK.pitchMin), so the pitch runs on
 * unbroken across spots. Caps close each bank's two ends; a stool stands at every cabinet. Caps and
 * stools that would hit `existing` obstacles or leave the room are dropped. `capRoom` (default `room`)
 * is where caps may stand: the grand hall's back row stands outside the walkable room, against the
 * end wall, so the caps closing it and the side banks' back ends need the wall line instead.
 */
export function planBanks(slots: readonly SlotPlacement[], existing: readonly Obstacle[] = [], room?: Readonly<RoomBounds>, capRoom: Readonly<RoomBounds> | undefined = room): BankPlan {
  const out: BankSlot[] = [];
  const caps: CapPlacement[] = [];
  const bankBoxes: Obstacle[] = [];
  for (const run of rowRuns(slots)) {
    run.forEach(({ s, t }, i) => {
      const lo = i > 0 ? (run[i - 1].t - t) / 2 : -(i < run.length - 1 ? (run[i + 1].t - t) / 2 : BANK.soloHalf);
      const hi = i < run.length - 1 ? (run[i + 1].t - t) / 2 : i > 0 ? (t - run[i - 1].t) / 2 : BANK.soloHalf;
      const k = Math.max(1, Math.floor((hi - lo) / BANK.pitchMin + 1e-6));
      const offsets = Array.from({ length: k }, (_, j) => lo + ((j + 0.5) * (hi - lo)) / k);
      out.push({ slot: s, offsets, stools: [] });
      bankBoxes.push(localBox(s, `svelte-bank-${s.id}-${out.length}`, offsets[0] - CABINET_HALF_W, offsets[k - 1] + CABINET_HALF_W, BANK.backZ, BANK.frontZ, CAP.height));
    });
    const first = out[out.length - run.length], last = out[out.length - 1];
    const capOff = CABINET_HALF_W + CAP.gap + CAP.width / 2;
    for (const [b, sign] of [[first, -1], [last, 1]] as const) {
      const lx = sign < 0 ? b.offsets[0] - capOff : b.offsets[b.offsets.length - 1] + capOff;
      const p = toWorld(b.slot, lx, CAP.centreZ);
      caps.push({ x: p.x, z: p.z, rotationY: b.slot.rotationY + (sign > 0 ? 0 : Math.PI) });
    }
  }
  const blockers = [...existing, ...bankBoxes];
  const fit = capRoom ? fitCaps(caps, blockers, capRoom) : { caps, obstacles: caps.map((c, i) => capObstacle(c, i)), dropped: 0 };
  const obstacles: Obstacle[] = [...bankBoxes, ...fit.obstacles];
  let stoolsDropped = 0;
  for (const b of out) {
    for (const off of b.offsets) {
      const p = toWorld(b.slot, off, BANK.stoolZ);
      const c: Obstacle = { kind: 'circle', id: `svelte-stool-${b.slot.id}-${obstacles.length}`, x: p.x, z: p.z, r: BANK.stoolR, h: 0.95 };
      const box = { x0: p.x - c.r, z0: p.z - c.r, x1: p.x + c.r, z1: p.z + c.r };
      const inRoom = !room || (box.x0 >= room.x0 && box.x1 <= room.x1 && box.z0 >= room.z0 && box.z1 <= room.z1);
      const hit = [...existing, ...obstacles].some((o) => o.kind === 'circle' ? Math.hypot(o.x - p.x, o.z - p.z) < o.r + c.r - 0.02 : overlaps(box, o) && !(o.id.startsWith('svelte-bank-') || /^slot[-_]/.test(o.id)));
      if (!inRoom || hit) {
        stoolsDropped++;
        continue;
      }
      b.stools.push(off);
      obstacles.push(c);
    }
  }
  return { slots: out, caps: fit.caps, obstacles, stoolsDropped, capsDropped: fit.dropped };
}

export interface CapPlacement {
  x: number;
  z: number;
  /** The cap's decorated face is its local +X, turned by this. */
  rotationY: number;
}

/** One end cap past each end of every row of machines (as continuous banks). */
export function svelteRowCaps(slots: readonly SlotPlacement[]): CapPlacement[] {
  return planBanks(slots).caps;
}

/** The cap's floor footprint as an axis-aligned box obstacle. */
export function capObstacle(c: CapPlacement, i: number): Obstacle & { kind: 'box' } {
  const hw = CAP.width / 2 + 0.02, hd = CAP.depth / 2;
  const cs = Math.abs(Math.cos(c.rotationY)), sn = Math.abs(Math.sin(c.rotationY));
  const ex = hw * cs + hd * sn, ez = hw * sn + hd * cs;
  return { kind: 'box', id: `svelte-end-cap-${i + 1}`, x0: c.x - ex, z0: c.z - ez, x1: c.x + ex, z1: c.z + ez, h: CAP.height };
}

/**
 * A cap sits CAP.gap off its bank's last cabinet and its obstacle is padded by the same 2 cm, so it
 * exactly touches its own bank's box; without this tolerance float noise made that count as a hit
 * and dropped 4 of the grand hall's caps.
 */
const CAP_FIT_EPS = 0.005;

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
    const probe = { x0: box.x0 + CAP_FIT_EPS, z0: box.z0 + CAP_FIT_EPS, x1: box.x1 - CAP_FIT_EPS, z1: box.z1 - CAP_FIT_EPS };
    if (!inRoom || existing.some((o) => overlaps(probe, o)) || obstacles.some((o) => overlaps(probe, o))) continue;
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
export function applySvelteMachines(art: THREE.Group, slotIds: readonly string[], opts: { lod?: boolean; banks?: BankPlan } = {}): { textures: THREE.Texture[]; cabinets: number; stools: number; lod: SvelteLod | null } {
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
  let stools = 0;
  const spots: CabinetSpot[] = [];
  art.updateMatrixWorld(true);
  const stool = opts.banks ? (createVelvetSlotStool(THREE) as THREE.Group) : null;
  const wp = new THREE.Vector3();
  for (const { g, id } of groups) {
    // the bank plan's share for this spot, matched by floor position
    g.getWorldPosition(wp);
    const bank = opts.banks?.slots.find((b) => Math.hypot(b.slot.x - wp.x, b.slot.z - wp.z) < 0.05);
    for (const c of [...g.children]) {
      // banks bring a stool to every machine, so the pilot's swivel chair goes too
      if (c.name === 'pilot_luxury_chair' && !bank) continue;
      c.removeFromParent();
    }
    if (bank && stool) {
      for (const off of bank.stools) {
        const st = stool.clone(true);
        st.name = 'svelte_bank_stool';
        st.position.set(off, 0, BANK.stoolZ);
        st.rotation.y = Math.PI; // its open front toward the cabinet
        g.add(st);
        stools++;
      }
    }
    for (const [n, x] of (bank?.offsets ?? [-SVELTE_PAIR_X, SVELTE_PAIR_X]).entries()) {
      if (opts.lod) {
        // instanced outside the floor's static batches, so the near set can follow the camera
        spots.push({ id, matrix: g.matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(x, 0, 0)) });
        cabinets++;
        continue;
      }
      const cab = proto.clone(true);
      cab.name = `svelte_cabinet_${n}`;
      cab.position.x = x;
      const screen = screenFor(id);
      if (screen) cab.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).name === screenName) m.material = screen; });
      g.add(cab);
      cabinets++;
    }
  }
  if (!opts.lod) return { textures, cabinets, stools, lod: null };
  for (const { id } of spots) screenFor(id);
  const lod = buildSvelteLod(spots, proto, createSvelteSlotCabinetFarLOD(THREE) as THREE.Group, (id) => screens.get(id), SVELTE_NEAR_CABINETS);
  return { textures, cabinets, stools, lod };
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
