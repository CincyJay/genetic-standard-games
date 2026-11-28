/**
 * Distance LOD for the prototype Svelte islands (VA-0152/0153, Claude-owned engineering). With a
 * pair on every slot spot the full cabinet (~4.8k triangles with the finish) put the salon follow
 * view near 370k triangles against a 150k budget. Here only the `nearCount` cabinets closest to
 * the camera draw ChatGPT's full cabinet; the rest draw ChatGPT's far-LOD cabinet
 * (art/casino/3d/svelteSlotCabinetFarLOD.mjs, ~456 triangles). Optionally (VA-0174) the cabinets
 * not in the near set but within `mid.range` metres draw ChatGPT's mid-LOD cabinet
 * (svelteSlotCabinetMidLOD.mjs, ~1.6k triangles) in between. Both levels are InstancedMeshes,
 * one per material bucket (plus one screen mesh per machine), so draw calls stay fixed whatever
 * the cabinet count; `update` only rewrites instance matrices when the near set changes.
 *
 * Engineering only: reads the art's geometry and materials, never changes them.
 */
import * as THREE from 'three';
import { cabinetBuckets, triangles } from './svelteFloorBatch';

export interface CabinetSpot {
  /** Machine id, which picks the screen material. */
  id: string;
  /** Cabinet root to floor. */
  matrix: THREE.Matrix4;
}

/** Cabinets already near keep their detail until another is this much (m) closer, so a cabinet on the boundary doesn't flicker. */
export const LOD_HYSTERESIS = 0.75;

/**
 * Indices of the `k` spots nearest (x, z), favouring the `current` near set by LOD_HYSTERESIS.
 * Pure: exported for tests.
 */
export function pickNear(points: readonly { x: number; z: number }[], x: number, z: number, k: number, current: ReadonlySet<number> = new Set()): Set<number> {
  if (k >= points.length) return new Set(points.map((_, i) => i));
  const scored = points.map((p, i) => ({ i, d: Math.hypot(p.x - x, p.z - z) - (current.has(i) ? LOD_HYSTERESIS : 0) }));
  scored.sort((a, b) => a.d - b.d || a.i - b.i);
  return new Set(scored.slice(0, Math.max(0, k)).map((s) => s.i));
}

/**
 * Indices (outside `near`) within `range` m of (x, z): the mid-LOD set. A spot already in `current`
 * stays until it is LOD_HYSTERESIS past the range, so a cabinet on the edge doesn't flicker.
 * Pure: exported for tests.
 */
export function pickMid(points: readonly { x: number; z: number }[], x: number, z: number, range: number, near: ReadonlySet<number>, current: ReadonlySet<number> = new Set()): Set<number> {
  const out = new Set<number>();
  points.forEach((p, i) => {
    if (near.has(i)) return;
    if (Math.hypot(p.x - x, p.z - z) <= range + (current.has(i) ? LOD_HYSTERESIS : 0)) out.add(i);
  });
  return out;
}

interface LevelMesh { mesh: THREE.InstancedMesh; id: string | null; tris: number }

export interface SvelteLod {
  root: THREE.Group;
  /** Re-picks the near cabinets for a camera at `pos`; true when the near set changed. */
  update(pos: THREE.Vector3): boolean;
  /** The spots drawing the full cabinet. */
  readonly near: ReadonlySet<number>;
  /** The spots drawing the mid cabinet (empty without a mid level). */
  readonly mid: ReadonlySet<number>;
  trianglesNear: number;
  /** 0 without a mid level. */
  trianglesMid: number;
  trianglesFar: number;
  /** Triangles all cabinets draw now (before frustum culling, which is off for these meshes). */
  triangles(): number;
  /** Draw calls with every level in use. */
  drawCalls: number;
  dispose(): void;
}

/**
 * Builds both levels for `spots`. `near` and `far` are freshly built cabinets (consumed);
 * `screenFor` returns a machine's screen material (shared by both levels: the far screen keeps
 * the same UV layout, VA-0153) or undefined to keep the art's own.
 */
export function buildSvelteLod(
  spots: readonly CabinetSpot[],
  near: THREE.Object3D,
  far: THREE.Object3D,
  screenFor: (id: string) => THREE.Material | undefined,
  nearCount: number,
  mid?: { cabinet: THREE.Object3D; range: number },
  opts: { shareScreens?: boolean } = {},
): SvelteLod {
  const root = new THREE.Group();
  root.name = 'svelte_lod';
  const perId = new Map<string, number>();
  for (const s of spots) perId.set(s.id, (perId.get(s.id) ?? 0) + 1);
  const pos = spots.map((s) => new THREE.Vector3().setFromMatrixPosition(s.matrix));
  const k = Math.min(Math.max(0, nearCount), spots.length);

  const share = !!opts.shareScreens;
  const level = (cabinet: THREE.Object3D, name: string, cap: (n: number) => number, screens: 'own' | 'all' | 'none' = share ? 'none' : 'own') => {
    const out: LevelMesh[] = [];
    let tris = 0;
    for (const b of cabinetBuckets(cabinet).buckets) {
      if (b.screen && screens === 'none') { b.geometry.dispose(); b.material.dispose(); continue; }
      tris += triangles(b.geometry);
      const make = (material: THREE.Material, n: number, id: string | null) => {
        const mesh = new THREE.InstancedMesh(b.geometry, material, Math.max(1, n));
        mesh.name = `${name}_${out.length}${id ? `_${id}` : ''}`;
        mesh.count = 0;
        mesh.visible = false;
        // instances move between levels as the camera walks; their bounds would go stale
        mesh.frustumCulled = false;
        mesh.castShadow = true; mesh.receiveShadow = true;
        root.add(mesh);
        out.push({ mesh, id, tris: triangles(b.geometry) });
      };
      if (b.screen) for (const [id, n] of perId) make(screenFor(id) ?? b.material, screens === 'all' ? n : cap(n), id);
      else make(b.material, cap(spots.length), null);
    }
    return { meshes: out, tris };
  };
  // shareScreens (VA-0229): every level's screen bucket is the same plane, so each machine's screen
  // is one instanced mesh over all its spots, whatever their level, instead of one per level
  const nearLevel = level(near, 'svelte_lod_near', (n) => Math.min(n, k), share ? 'all' : 'own');
  const midLevel = mid ? level(mid.cabinet, 'svelte_lod_mid', (n) => n) : null;
  const farLevel = level(far, 'svelte_lod_far', (n) => n);
  const all = [...nearLevel.meshes, ...(midLevel?.meshes ?? []), ...farLevel.meshes];

  let nearSet = new Set<number>();
  let midSet = new Set<number>();
  let last: THREE.Vector3 | null = null;
  let filled = false;

  const fill = () => {
    for (const lm of all) lm.mesh.count = 0;
    spots.forEach((s, i) => {
      const lv = nearSet.has(i) ? nearLevel : midLevel && midSet.has(i) ? midLevel : farLevel;
      for (const lm of lv.meshes) {
        if (lm.id !== null && lm.id !== s.id) continue;
        lm.mesh.setMatrixAt(lm.mesh.count++, s.matrix);
      }
      if (share && lv !== nearLevel) for (const lm of nearLevel.meshes) if (lm.id === s.id) lm.mesh.setMatrixAt(lm.mesh.count++, s.matrix);
    });
    for (const lm of all) {
      lm.mesh.visible = lm.mesh.count > 0;
      lm.mesh.instanceMatrix.needsUpdate = true;
    }
  };

  const lod: SvelteLod = {
    root,
    get near() { return nearSet; },
    get mid() { return midSet; },
    trianglesNear: nearLevel.tris,
    trianglesMid: midLevel?.tris ?? 0,
    trianglesFar: farLevel.tris,
    triangles() {
      let t = 0;
      for (const lm of all) if (lm.mesh.visible) t += lm.tris * lm.mesh.count;
      return t;
    },
    drawCalls: all.length,
    update(p) {
      // re-pick only after the camera has moved a little
      if (last && last.distanceToSquared(p) < 0.04) return false;
      last = (last ?? new THREE.Vector3()).copy(p);
      const next = pickNear(pos, p.x, p.z, k, nearSet);
      const nextMid = mid ? pickMid(pos, p.x, p.z, mid.range, next, midSet) : midSet;
      const same = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((i) => b.has(i));
      if (filled && same(next, nearSet) && same(nextMid, midSet)) return false;
      nearSet = next;
      midSet = nextMid;
      fill();
      filled = true;
      return true;
    },
    dispose() {
      const mats = new Set<THREE.Material>();
      for (const lm of all) {
        lm.mesh.geometry.dispose();
        mats.add(lm.mesh.material as THREE.Material);
        lm.mesh.dispose();
      }
      for (const m of mats) m.dispose();
    },
  };
  return lod;
}
