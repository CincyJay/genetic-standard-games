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
import { createSvelteSlotCabinetMidLOD } from '../../../../art/casino/3d/svelteSlotCabinetMidLOD.mjs';
import { createVelvetIslandEndCapMarquee } from '../../../../art/casino/3d/velvetIslandEndCapMarquee.mjs';
import { createVelvetChaseBulbGeometry } from '../../../../art/casino/3d/velvetChaseBulbLOD.mjs';
import { createVelvetIslandSeamTopper } from '../../../../art/casino/3d/velvetIslandSeamTopper.mjs';
import { createVelvetSlotStool } from '../../../../art/casino/3d/velvetSlotStool.mjs';
import { createVelvetFarStool } from '../../../../art/casino/3d/velvetFarStool.mjs';
import { createVelvetSlimCabinet } from '../../../../art/casino/3d/velvetSlimCabinet.mjs';
import { createVelvetSlimCabinetLOD } from '../../../../art/casino/3d/velvetSlimCabinetLOD.mjs';
import { MACHINES, strips } from '../logic/slots.ts';
import type { Obstacle, RoomBounds, SlotPlacement } from './layout.ts';
import { buildSvelteLod, type CabinetSpot, type SvelteLod } from './svelteLod.ts';

/** `svelte-lod`: the Svelte islands with distance LOD (svelteLod.ts), only the nearest cabinets in full detail. */
/** `svelte-lod-mid`: the same with ChatGPT's mid-LOD cabinet in between (VA-0174); about 14 more draw calls, so opt-in. */
export type MachineStyle = 'classic' | 'svelte' | 'svelte-lod' | 'svelte-lod-mid';
/** The ⚙ button's cycle. */
export const NEXT_MACHINE_STYLE: Record<MachineStyle, MachineStyle> = { classic: 'svelte', svelte: 'svelte-lod', 'svelte-lod': 'svelte-lod-mid', 'svelte-lod-mid': 'classic' };
/** Cabinets drawn in full detail with distance LOD on (the rest draw ChatGPT's far LOD). */
export const SVELTE_NEAR_CABINETS = 6;
/** Cabinets outside the near set but within this many metres draw ChatGPT's mid LOD (62d46bc, hint 6–15 m); the rest draw the far LOD. */
export const SVELTE_MID_RANGE_M = 15;
/** Bank stools drawn in full detail with distance LOD on; the rest draw `farStool` (VA-0203). */
export const SVELTE_NEAR_STOOLS = 10;
/**
 * Stool parts left out of the far stool (VA-0203, Claude-owned performance): the back buttons
 * (0.9 cm spheres), the foot ring and its spokes (under the seat, hidden by the cushion and the
 * cabinets from most floor views), the cushion piping (a 0.8 cm line on the seat's top edge) and
 * the base dome on the gold base. The silhouette parts (base, pedestal, seat, back, gold rims) stay.
 */
export const FAR_STOOL_DROP = /^stool_(back_button_\d+|gold_foot_spoke_\d+|gold_foot_ring|cushion_piping|gold_base_dome)$/;

/**
 * Segment counts for the far stool's round parts (VA-0230, Claude-owned performance). The far stool is
 * drawn ~100 times in a grand-hall view (every stool outside the nearest SVELTE_NEAR_STOOLS), so its
 * 626 triangles were ~71k of the follow view's ~227k. The two gold tori (1.2–1.6 cm tubes) go to a
 * 3-sided tube and the discs/cylinders to 14 sides (pedestal 8); every other parameter (radii, heights,
 * arcs, open ends) is copied from the authored geometry, and the mesh placement is untouched. The two
 * back shells keep the authored geometry (the inner one has its winding flipped by the art). The near
 * stool is unchanged.
 */
export const FAR_STOOL_SEGMENTS: Readonly<Record<string, { radial?: number; tubular?: number; width?: number }>> = {
  stool_gold_base: { radial: 14 },
  stool_gold_pedestal: { radial: 8 },
  stool_gold_seat_pan: { radial: 14 },
  stool_gold_seat_ring: { radial: 3, tubular: 14 },
  stool_leather_cushion: { radial: 14 },
  stool_leather_cushion_top: { width: 14 },
  stool_gold_back_rim: { radial: 3, tubular: 12 },
};

/** `g` rebuilt from its own parameters with `seg`'s segment counts, or a plain copy when it can't be. */
function fewerSegments(g: THREE.BufferGeometry, seg: { radial?: number; tubular?: number; width?: number } | undefined): THREE.BufferGeometry {
  if (!seg) return g.clone();
  if (g instanceof THREE.CylinderGeometry) {
    const p = g.parameters;
    return new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, seg.radial ?? p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength);
  }
  if (g instanceof THREE.TorusGeometry) {
    const p = g.parameters;
    return new THREE.TorusGeometry(p.radius, p.tube, seg.radial ?? p.radialSegments, seg.tubular ?? p.tubularSegments, p.arc);
  }
  if (g instanceof THREE.SphereGeometry) {
    const p = g.parameters;
    return new THREE.SphereGeometry(p.radius, seg.width ?? p.widthSegments, p.heightSegments, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
  }
  return g.clone();
}

/** The stool as authored minus FAR_STOOL_DROP, its round parts at FAR_STOOL_SEGMENTS (materials shared; geometry copied, since the LOD consumes each level's). */
export function farStool(stool: THREE.Object3D): THREE.Object3D {
  const far = stool.clone(true);
  const drop: THREE.Object3D[] = [];
  far.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (FAR_STOOL_DROP.test(m.name)) drop.push(m);
    else m.geometry = fewerSegments(m.geometry, FAR_STOOL_SEGMENTS[m.name]);
  });
  for (const o of drop) o.removeFromParent();
  return far;
}

/**
 * The authored stool's cushion top is ~0.675 m; ChatGPT's far stool takes `seatHeight` as its
 * cushion's centre (0.115 m tall), so this puts the two cushion tops level.
 */
export const ART_FAR_STOOL_SEAT_HEIGHT = 0.62;

/**
 * ChatGPT's purpose-built far stool (6f3d95e, VA-0205), opt-in `?farstool=art` instead of `farStool`.
 * Its art faces local -Z while the bank stool faces +Z before the host's turn, so it is turned half
 * a revolution inside a wrapper to face the cabinet like the near stool. Art values are as authored
 * apart from the seat height and width passed in to match the near stool.
 */
export function artFarStool(): THREE.Object3D {
  const wrap = new THREE.Group();
  wrap.name = 'velvet_far_stool_facing_plus_z';
  const art = createVelvetFarStool(THREE, { seatHeight: ART_FAR_STOOL_SEAT_HEIGHT, seatWidth: 0.48 }) as THREE.Object3D;
  art.rotation.y = Math.PI;
  wrap.add(art);
  return wrap;
}

/** Reel area of ChatGPT's reel-screen canvas (svelteReelScreen.mjs, 512×1024): the five rails span x 22–489, y 240–780 px. */
export const SLIM_SCREEN_UV = { u0: 22 / 512, u1: 489 / 512, v0: 1 - 780 / 1024, v1: 1 - 240 / 1024 } as const;
/**
 * The reel plane behind the slim shell's gold rails. Since 64d62ce (VA-0218) the rails' inner edges
 * are x ±0.290, y 0.935–1.625 m (a 0.58 × 0.69 m opening), front faces at art z −0.0375, backplane
 * face at +0.05. The plane tucks 1 cm under each rail; `open` is the visible opening the canvas's
 * reel area maps onto, so the hidden margins carry a little canvas past it rather than squeezing it.
 */
export const SLIM_SCREEN = { w: 0.6, h: 0.71, open: { w: 0.58, h: 0.69 }, y: 1.28, z: 0.02, tilt: -0.065 } as const;
/**
 * The marquee on the shell's `upper_display_face` (textureSlot 'upper-marquee', 0.54 × 0.25 m,
 * centre y 1.89, z −0.003, 1.8 cm thick, tilt −0.09): a plane 1.5 mm proud of its front face, inset
 * 1 cm, showing the same machine's screen canvas cropped to its header (title and the four jackpot
 * plaques). Same material as the reels, so it adds no draw call.
 */
export const SLIM_MARQUEE = { w: 0.52, h: 0.23, y: 1.89, z: -0.003, face: 0.009 + 0.0015, tilt: -0.09 } as const;
export const SLIM_MARQUEE_UV = { u0: 22 / 512, u1: 490 / 512, v0: 1 - 236 / 1024, v1: 1 - 30 / 1024 } as const;

/** A plane facing the art's −Z front, UVs spanning `uv` over `open` (centred) and extrapolated to the plane's edges. */
function slimPlane(w: number, h: number, open: { w: number; h: number }, uv: { u0: number; u1: number; v0: number; v1: number }): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const a = g.attributes.uv as THREE.BufferAttribute;
  const du = ((uv.u1 - uv.u0) / open.w) * (w - open.w) / 2;
  const dv = ((uv.v1 - uv.v0) / open.h) * (h - open.h) / 2;
  for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) ? uv.u1 + du : uv.u0 - du, a.getY(i) ? uv.v1 + dv : uv.v0 - dv);
  g.rotateY(Math.PI);
  return g;
}

/**
 * ChatGPT's slim near-cabinet shell (accd383 → 64d62ce, VA-0216/0218), opt-in `?nearcab=slim` with
 * `svelte-lod`: it replaces the full Svelte cabinet as the LOD's near level only (mid/far LODs,
 * hitboxes, the 10 themed machines and their screens unchanged). The shell's 5×5 aperture is empty by
 * design, so a plane with the reel screen material (`VA_SVELTE_REEL_SCREEN_SWAP`, so each machine's own
 * screen goes on it) sits behind its rails, UV-mapped to the canvas's reel area; a second plane on the
 * upper display shows the canvas header with that machine's name. The art faces local −Z and the
 * Svelte cabinet +Z, so it is turned half a revolution inside a wrapper. Art as authored.
 */
export function slimNearCabinet(screenW: number = SLIM_SCREEN.w): THREE.Object3D {
  return slimWithScreens(createVelvetSlimCabinet(THREE) as THREE.Object3D, 'velvet_slim_cabinet_facing_plus_z', screenW);
}

/**
 * ChatGPT's matching slim mid/far LOD (4530e71, VA-0226), opt-in `?slimlod=on` with `svelte-lod`:
 * same two-housing silhouette, same 0.58 × 0.69 m reel aperture (rails x ±0.288, y 0.935–1.625,
 * fronts at art z −0.0375, backplane face +0.05) and same 0.54 × 0.25 upper display face, so the
 * near's reel and marquee planes go on unchanged with the machine's own screen material. Art as authored.
 */
export function slimLodCabinet(level: 'mid' | 'far'): THREE.Object3D {
  return slimWithScreens(createVelvetSlimCabinetLOD(THREE, { level }) as THREE.Object3D, `velvet_slim_${level}_facing_plus_z`, SLIM_LOD_SCREEN_W);
}

/** The LOD's rails are 1.2 cm wide with outer edges at x ±0.300 (the near's are wider), so its reel plane is 1 cm narrower to stay under them. */
export const SLIM_LOD_SCREEN_W = 0.59;

function slimWithScreens(art: THREE.Object3D, name: string, screenW: number = SLIM_SCREEN.w): THREE.Object3D {
  const wrap = new THREE.Group();
  wrap.name = name;
  const mat = new THREE.MeshStandardMaterial({ color: 0x111725, roughness: 0.2 });
  mat.name = 'VA_SVELTE_REEL_SCREEN_SWAP';
  const g = slimPlane(screenW, SLIM_SCREEN.h, SLIM_SCREEN.open, SLIM_SCREEN_UV);
  g.rotateX(SLIM_SCREEN.tilt);
  g.translate(0, SLIM_SCREEN.y, SLIM_SCREEN.z);
  const screen = new THREE.Mesh(g, mat);
  screen.name = 'slim_reel_screen';
  art.add(screen);
  const mg = slimPlane(SLIM_MARQUEE.w, SLIM_MARQUEE.h, SLIM_MARQUEE, SLIM_MARQUEE_UV);
  mg.translate(0, 0, -SLIM_MARQUEE.face);
  mg.rotateX(SLIM_MARQUEE.tilt);
  mg.translate(0, SLIM_MARQUEE.y, SLIM_MARQUEE.z);
  const marquee = new THREE.Mesh(mg, mat);
  marquee.name = 'slim_marquee_screen';
  art.add(marquee);
  art.rotation.y = Math.PI;
  wrap.add(art);
  return wrap;
}

/** One LOD from several: the root holds every part's root; `near`/`mid` are the first part's (the cabinets'). */
export function combineLods(parts: readonly SvelteLod[]): SvelteLod {
  const root = new THREE.Group();
  root.name = 'svelte_lod_all';
  for (const p of parts) root.add(p.root);
  const [first] = parts;
  return {
    root,
    get near() { return first.near; },
    get mid() { return first.mid; },
    trianglesNear: first.trianglesNear,
    trianglesMid: first.trianglesMid,
    trianglesFar: first.trianglesFar,
    triangles: () => parts.reduce((t, p) => t + p.triangles(), 0),
    drawCalls: parts.reduce((n, p) => n + p.drawCalls, 0),
    update: (pos) => parts.map((p) => p.update(pos)).some(Boolean),
    dispose: () => parts.forEach((p) => p.dispose()),
  };
}
export const MACHINES_STORAGE_KEY = 'va3d.machines';

/** The stored machine style; anything unknown is the classic machines. */
export function readMachineStyle(): MachineStyle {
  try {
    const v = localStorage.getItem(MACHINES_STORAGE_KEY);
    return v === 'svelte' || v === 'svelte-lod' || v === 'svelte-lod-mid' ? v : 'classic';
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
  /** Stools that fit, as local X offsets (each at local z BankPlan.stoolZ, facing the cabinet). */
  stools: number[];
}
export interface BankPlan {
  slots: BankSlot[];
  caps: CapPlacement[];
  /** Collision: a box along each spot's cabinets, the stools, and the caps that fit. */
  obstacles: Obstacle[];
  stoolsDropped: number;
  capsDropped: number;
  /** How far in front of each cabinet its stool stands (BANK.stoolZ unless the cabinet asks otherwise). */
  stoolZ: number;
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
export function planBanks(slots: readonly SlotPlacement[], existing: readonly Obstacle[] = [], room?: Readonly<RoomBounds>, capRoom: Readonly<RoomBounds> | undefined = room, cabinet: { stoolZ?: number; frontZ?: number } = {}): BankPlan {
  // a shallower cabinet (Joshua's Tripo cabinet) brings its stools in and its collision front back
  const stoolZ = cabinet.stoolZ ?? BANK.stoolZ, frontZ = cabinet.frontZ ?? BANK.frontZ;
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
      bankBoxes.push(localBox(s, `svelte-bank-${s.id}-${out.length}`, offsets[0] - CABINET_HALF_W, offsets[k - 1] + CABINET_HALF_W, BANK.backZ, frontZ, CAP.height));
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
      const p = toWorld(b.slot, off, stoolZ);
      const c: Obstacle = { kind: 'circle', id: `svelte-stool-${b.slot.id}-${obstacles.length}`, x: p.x, z: p.z, r: BANK.stoolR, h: 0.95 };
      const box = { x0: p.x - c.r, z0: p.z - c.r, x1: p.x + c.r, z1: p.z + c.r };
      // stools may stand out to the caps' wall line too: the grand hall's end-wall row stands outside
      // the walkable room, and a shallow cabinet's stools stay in that strip with it
      const lim = capRoom ?? room;
      const inRoom = !lim || (box.x0 >= lim.x0 && box.x1 <= lim.x1 && box.z0 >= lim.z0 && box.z1 <= lim.z1);
      const hit = [...existing, ...obstacles].some((o) => o.kind === 'circle' ? Math.hypot(o.x - p.x, o.z - p.z) < o.r + c.r - 0.02 : overlaps(box, o) && !(o.id.startsWith('svelte-bank-') || /^slot[-_]/.test(o.id)));
      if (!inRoom || hit) {
        stoolsDropped++;
        continue;
      }
      b.stools.push(off);
      obstacles.push(c);
    }
  }
  return { slots: out, caps: fit.caps, obstacles, stoolsDropped, capsDropped: fit.dropped, stoolZ };
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
function machineScreen(id: string, base: THREE.MeshStandardMaterial, textures: THREE.Texture[], titled = false): THREE.MeshStandardMaterial {
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
  if (titled) {
    // slim near cabinet's marquee (VA-0218): the machine's name over the art's '♠ CASINO ♠' line
    g.fillStyle = '#25112b';
    g.fillRect(30, 117, 452, 38);
    g.textAlign = 'center';
    g.fillStyle = '#ffe0a0';
    g.font = 'bold 28px Georgia, serif';
    g.fillText(machine.name.toUpperCase(), 256, 147, 440);
  }
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
export function applySvelteMachines(art: THREE.Group, slotIds: readonly string[], opts: { lod?: boolean; midLod?: boolean; banks?: BankPlan; artFarStool?: boolean; slimNear?: boolean; slimLod?: boolean; tripo?: { near: THREE.Object3D; far: THREE.Object3D } } = {}): { textures: THREE.Texture[]; cabinets: number; stools: number; lod: SvelteLod | null } {
  const svelteProto = createSvelteSlotCabinet(THREE) as THREE.Group;
  // Joshua's Tripo cabinet (tripoCabinet.ts) stands in for the Svelte one at every distance; its
  // screen is painted into its texture, so the per-theme screens below go unused
  const proto = (opts.tripo?.near as THREE.Group | undefined) ?? svelteProto;
  try {
    applySvelteLuxuryFinish(THREE, svelteProto);
  } catch (e) {
    console.warn('[floor3d] svelte luxury finish', e);
  }
  // the floor batches meshes of one material together, which needs the same attributes; since
  // fd81685 (VA-0151) every art mesh ships UVs, so this only guards against a future part without
  proto.traverse((o) => {
    const g = (o as THREE.Mesh).geometry;
    if ((o as THREE.Mesh).isMesh && g && !g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  });
  const screenName = svelteProto.userData.screenMaterialName as string;
  let baseScreen: THREE.MeshStandardMaterial | null = null;
  svelteProto.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (m?.name === screenName) baseScreen = m;
  });
  const textures: THREE.Texture[] = [];
  const screens = new Map<string, THREE.MeshStandardMaterial>();
  const screenFor = (id: string) => {
    let m = screens.get(id);
    if (!m && baseScreen) screens.set(id, (m = machineScreen(id, baseScreen, textures, !!(opts.slimNear || opts.slimLod))));
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
  const stoolSpots: CabinetSpot[] = [];
  const turn = new THREE.Matrix4().makeRotationY(Math.PI);
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
        stools++;
        if (opts.lod) {
          // instanced with a distance LOD (VA-0203), its open front toward the cabinet
          stoolSpots.push({ id: 'stool', matrix: g.matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(off, 0, opts.banks!.stoolZ)).multiply(turn) });
          continue;
        }
        const st = stool.clone(true);
        st.name = 'svelte_bank_stool';
        st.position.set(off, 0, opts.banks!.stoolZ);
        st.rotation.y = Math.PI; // its open front toward the cabinet
        g.add(st);
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
      const screen = opts.tripo ? undefined : screenFor(id);
      if (screen) cab.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).name === screenName) m.material = screen; });
      g.add(cab);
      cabinets++;
    }
  }
  if (!opts.lod) return { textures, cabinets, stools, lod: null };
  if (!opts.tripo) for (const { id } of spots) screenFor(id);
  // `slimLod`: the whole slim family (near, mid within SVELTE_MID_RANGE_M, far), one machine look at every distance
  const lod = opts.tripo
    ? buildSvelteLod(spots, opts.tripo.near, opts.tripo.far, () => undefined, SVELTE_NEAR_CABINETS)
    : opts.slimLod
    // near takes the LOD's 0.59 m reel plane (still past the near's ±0.288 aperture, under its rails) so all
    // three levels share one screen geometry and each machine's screen is one draw call (VA-0229)
    ? buildSvelteLod(spots, slimNearCabinet(SLIM_LOD_SCREEN_W), slimLodCabinet('far'), (id) => screens.get(id), SVELTE_NEAR_CABINETS, { cabinet: slimLodCabinet('mid'), range: SVELTE_MID_RANGE_M }, { shareScreens: true })
    : buildSvelteLod(spots, opts.slimNear ? slimNearCabinet() : proto, createSvelteSlotCabinetFarLOD(THREE) as THREE.Group, (id) => screens.get(id), SVELTE_NEAR_CABINETS, opts.midLod ? {
      cabinet: createSvelteSlotCabinetMidLOD(THREE) as THREE.Group,
      range: SVELTE_MID_RANGE_M,
    } : undefined);
  if (!stool || !stoolSpots.length) return { textures, cabinets, stools, lod };
  const stoolLod = buildSvelteLod(stoolSpots, stool, opts.artFarStool ? artFarStool() : farStool(stool), () => undefined, SVELTE_NEAR_STOOLS);
  return { textures, cabinets, stools, lod: combineLods([lod, stoolLod]) };
}

/**
 * Floor-only bulb LOD (VA-0172, Claude-owned performance): the marquee cap's bulbs are 60 spheres of
 * 160 triangles each, about 9.5k of the cap's ~9.9k. On the floor every cap shares one instanced
 * mesh, so each bulb is redrawn as a 20-triangle icosahedron of the authored bulb's own radius
 * (same material, colours and chase). A 1.7 cm glowing bulb spans a few pixels at follow distance,
 * so the facets should not read; the authored cap itself is unchanged.
 */
export function floorBulbGeometry(authored: THREE.BufferGeometry): THREE.BufferGeometry {
  authored.computeBoundingSphere();
  const r = authored.boundingSphere?.radius ?? 0.017;
  return new THREE.IcosahedronGeometry(r, 0);
}

/** ChatGPT's far chase bulb (f61fe6e, VA-0232): 8 triangles at the floor bulb's own radius. */
export function farBulbGeometry(nearBulb: THREE.BufferGeometry): THREE.BufferGeometry {
  nearBulb.computeBoundingSphere();
  const radius = nearBulb.boundingSphere?.radius ?? 0.017;
  return createVelvetChaseBulbGeometry(THREE, { level: 'far', radius }) as THREE.BufferGeometry;
}

/**
 * Builds the end caps from one authored cap, merged for the phone: its static parts become one mesh
 * per material across every cap, and all their bulbs one instanced mesh, so 20 caps cost the draw
 * calls (and the two face canvases) of one. Kept out of the floor's batches so the bulbs can chase:
 * the authored cap's own animation runs and its bulb colours are copied to every cap.
 */
export interface SvelteCaps {
  root: THREE.Group;
  animate: (t: number) => void;
  /** With `bulbLod`: puts each cap's bulbs on the near or far geometry by the camera's distance to the cap. */
  update: (camera: THREE.Vector3) => void;
  /** Caps whose bulbs are currently drawn far (0 without `bulbLod`). */
  farCaps: () => number;
}

/** `?capbulbs=lod` (VA-0232): caps at least this far from the camera draw ChatGPT's 8-triangle far bulb. */
export const CAP_BULB_FAR_M = 15;
/** Hysteresis around CAP_BULB_FAR_M so a cap at the threshold doesn't flip every frame. */
export const CAP_BULB_HYSTERESIS_M = 0.5;

export function buildSvelteCaps(caps: readonly CapPlacement[], opts: { bulbLod?: number } = {}): SvelteCaps {
  const root = new THREE.Group();
  root.name = 'svelte_end_caps';
  if (!caps.length) return { root, animate: () => {}, update: () => {}, farCaps: () => 0 };
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
  let update: (camera: THREE.Vector3) => void = () => {};
  let farCaps = () => 0;
  if (src) {
    const n = src.count;
    // every bulb's world matrix, cap by cap, in the authored order
    const local = new THREE.Matrix4();
    const worlds = placements.map((p) => Array.from({ length: n }, (_, i) => {
      src.getMatrixAt(i, local);
      return new THREE.Matrix4().multiplyMatrices(p, src.matrixWorld).multiply(local);
    }));
    const near = new THREE.InstancedMesh(floorBulbGeometry(src.geometry), src.material, n * placements.length);
    near.name = 'svelte_end_caps:marquee_chase_bulbs';
    near.userData.glow = true;
    near.setColorAt(0, new THREE.Color());
    // ChatGPT's far bulb (f61fe6e): an octahedron at the same radius, same material, colours and chase
    const far = opts.bulbLod === undefined ? null : new THREE.InstancedMesh(farBulbGeometry(near.geometry), src.material, n * placements.length);
    if (far) {
      far.name = 'svelte_end_caps:marquee_chase_bulbs_far';
      far.userData.glow = true;
      far.setColorAt(0, new THREE.Color());
    }
    const isFar = placements.map(() => false);
    let nearCaps: number[] = [], farList: number[] = [];
    const fill = () => {
      nearCaps = []; farList = [];
      isFar.forEach((f, k) => (f ? farList : nearCaps).push(k));
      const put = (mesh: THREE.InstancedMesh, list: number[]) => {
        list.forEach((k, j) => worlds[k].forEach((m, i) => mesh.setMatrixAt(j * n + i, m)));
        mesh.count = list.length * n;
        mesh.visible = list.length > 0;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      };
      put(near, nearCaps);
      if (far) put(far, farList);
    };
    fill();
    copyColours = () => {
      const c = src.instanceColor!.array as Float32Array;
      const put = (mesh: THREE.InstancedMesh, list: number[]) => {
        if (!list.length) return;
        const dst = mesh.instanceColor!.array as Float32Array;
        for (let j = 0; j < list.length; j++) dst.set(c, j * c.length);
        mesh.instanceColor!.needsUpdate = true;
      };
      put(near, nearCaps);
      if (far) put(far, farList);
    };
    copyColours();
    root.add(near);
    if (far) {
      root.add(far);
      const centres = caps.map((c) => new THREE.Vector3(c.x, CAP.height / 2, c.z));
      const at = opts.bulbLod!;
      update = (camera) => {
        let changed = false;
        centres.forEach((c, k) => {
          const d = c.distanceTo(camera);
          const f = isFar[k] ? d >= at - CAP_BULB_HYSTERESIS_M : d >= at + CAP_BULB_HYSTERESIS_M;
          if (f !== isFar[k]) { isFar[k] = f; changed = true; }
        });
        if (changed) { fill(); copyColours(); }
      };
      farCaps = () => farList.length;
    }
  }
  const animateCap = cap.userData.animate as ((t: number) => void) | undefined;
  return {
    root,
    animate: (t) => {
      animateCap?.(t);
      copyColours();
    },
    update: (camera) => update(camera),
    farCaps: () => farCaps(),
  };
}

/**
 * ChatGPT's optional island seam topper (96e9670, VA-0201), prototype opt-in `?topper=on`.
 * One run per back-to-back island: along the shared centre line of an inner row (`…-wi3`) and its
 * twin outer row (`…-wo3`), from the first cabinet's outer edge to the last's, so it stops 2 cm
 * short of the double marquee caps. Visual only (no collision; the rows' boxes already meet there).
 */
export interface IslandSeam { x: number; z: number; length: number; rotationY: number }
/** The Svelte cabinet's back stands this high (measured, full and far LOD alike: 2.09 m). */
export const CABINET_TOP = 2.09;
/** The topper's `height` is its infill's centre; this sinks the 6.5 cm infill into the seam's top. */
export const TOPPER_HEIGHT = CABINET_TOP - 0.0325;

export function islandSeams(plan: BankPlan, twinGap = 0.72): IslandSeam[] {
  // a spot's twin stands twinGap behind it, facing the other way (the floor's ids are themes, so
  // islands are found by position); each pair is counted once, from the spot facing +X (or +Z)
  const runs = new Map<string, { t: number; c: { x: number; z: number }; ts: number[]; r: number }[]>();
  for (const b of plan.slots) {
    const nx = Math.sin(b.slot.rotationY), nz = Math.cos(b.slot.rotationY);
    if (!(nx > 1e-6 || (Math.abs(nx) <= 1e-6 && nz > 0))) continue;
    const twin = plan.slots.find((t) => Math.hypot(t.slot.x - (b.slot.x - nx * twinGap), t.slot.z - (b.slot.z - nz * twinGap)) < 0.02 && Math.cos(t.slot.rotationY - b.slot.rotationY) < -0.999);
    if (!twin) continue;
    const c = { x: (b.slot.x + twin.slot.x) / 2, z: (b.slot.z + twin.slot.z) / 2 };
    const lx = Math.cos(b.slot.rotationY), lz = -Math.sin(b.slot.rotationY); // along the row (local +X)
    const key = `${Math.round(b.slot.rotationY * 100)}|${Math.round((c.x * nx + c.z * nz) * 10)}`;
    let row = runs.get(key);
    if (!row) runs.set(key, (row = []));
    const ts = [...b.offsets, ...twin.offsets.map((o) => -o)].map((off) => { const p = toWorld(b.slot, off, 0); return p.x * lx + p.z * lz; });
    row.push({ t: c.x * lx + c.z * lz, c, ts, r: b.slot.rotationY });
  }
  const seams: IslandSeam[] = [];
  for (const row of runs.values()) {
    row.sort((p, q) => p.t - q.t);
    let start = 0;
    for (let i = 1; i <= row.length; i++) {
      if (i < row.length && row[i].t - row[i - 1].t <= ROW_BREAK) continue;
      const run = row.slice(start, i);
      start = i;
      const r = run[0].r, lx = Math.cos(r), lz = -Math.sin(r), nx = Math.sin(r), nz = Math.cos(r);
      const ts = run.flatMap((p) => p.ts);
      const lo = Math.min(...ts) - CABINET_HALF_W, hi = Math.max(...ts) + CABINET_HALF_W;
      const d = run[0].c.x * nx + run[0].c.z * nz; // the centre line's offset along the normal
      const tm = (lo + hi) / 2;
      // the topper's length runs along its local Z: turn local Z onto the row's direction
      seams.push({ x: nx * d + lx * tm, z: nz * d + lz * tm, length: hi - lo, rotationY: r + Math.PI / 2 });
    }
  }
  return seams;
}

/** Every island's topper, merged into one mesh per material (2 draw calls for the hall). */
export function buildIslandToppers(seams: readonly IslandSeam[], height = TOPPER_HEIGHT): { root: THREE.Group; triangles: number } {
  const root = new THREE.Group();
  root.name = 'svelte_island_toppers';
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const shared = new Map<string, THREE.Material>();
  for (const s of seams) {
    const t = createVelvetIslandSeamTopper(THREE, { length: s.length, height }) as THREE.Group;
    t.position.set(s.x, 0, s.z);
    t.rotation.y = s.rotationY;
    t.updateMatrixWorld(true);
    t.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      // each call makes its own two materials; key them by look so all islands share one
      const key = `${src.color.getHex()}|${src.metalness}|${src.roughness}`;
      let mat = shared.get(key);
      if (!mat) shared.set(key, (mat = src));
      else src.dispose();
      let list = byMaterial.get(mat);
      if (!list) byMaterial.set(mat, (list = []));
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
      g.clearGroups();
      list.push(g);
      m.geometry.dispose();
    });
  }
  let triangles = 0;
  for (const [mat, geos] of byMaterial) {
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    triangles += merged.attributes.position.count / 3;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = `svelte_island_toppers:${(mat as THREE.MeshStandardMaterial).metalness > 0.5 ? 'brass' : 'dark_seam_infill'}`;
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
  }
  return { root, triangles };
}
