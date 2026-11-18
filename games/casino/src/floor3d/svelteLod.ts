/**
 * Distance LOD for the prototype Svelte islands (VA-0152/0153, Claude-owned engineering). With a
 * pair on every slot spot the full cabinet (~4.8k triangles with the finish) put the salon follow
 * view near 370k triangles against a 150k budget. Here only the `nearCount` cabinets closest to
 * the camera draw ChatGPT's full cabinet; the rest draw ChatGPT's far-LOD cabinet
 * (art/casino/3d/svelteSlotCabinetFarLOD.mjs, ~332 triangles). Both levels are InstancedMeshes,
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

interface LevelMesh { mesh: THREE.InstancedMesh; id: string | null; tris: number }

export interface SvelteLod {
  root: THREE.Group;
  /** Re-picks the near cabinets for a camera at `pos`; true when the near set changed. */
  update(pos: THREE.Vector3): boolean;
  /** The spots drawing the full cabinet. */
  readonly near: ReadonlySet<number>;
  trianglesNear: number;
  trianglesFar: number;
  /** Triangles all cabinets draw now (before frustum culling, which is off for these meshes). */
  triangles(): number;
  /** Draw calls with both levels in use. */
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
): SvelteLod {
  const root = new THREE.Group();
  root.name = 'svelte_lod';
  const perId = new Map<string, number>();
  for (const s of spots) perId.set(s.id, (perId.get(s.id) ?? 0) + 1);
  const pos = spots.map((s) => new THREE.Vector3().setFromMatrixPosition(s.matrix));
  const k = Math.min(Math.max(0, nearCount), spots.length);

  const level = (cabinet: THREE.Object3D, name: string, cap: (n: number) => number) => {
    const out: LevelMesh[] = [];
    let tris = 0;
    for (const b of cabinetBuckets(cabinet).buckets) {
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
      if (b.screen) for (const [id, n] of perId) make(screenFor(id) ?? b.material, cap(n), id);
      else make(b.material, cap(spots.length), null);
    }
    return { meshes: out, tris };
  };
  const nearLevel = level(near, 'svelte_lod_near', (n) => Math.min(n, k));
  const farLevel = level(far, 'svelte_lod_far', (n) => n);

  let nearSet = new Set<number>();
  let last: THREE.Vector3 | null = null;
  let filled = false;

  const fill = () => {
    for (const lm of [...nearLevel.meshes, ...farLevel.meshes]) lm.mesh.count = 0;
    spots.forEach((s, i) => {
      for (const lm of (nearSet.has(i) ? nearLevel : farLevel).meshes) {
        if (lm.id !== null && lm.id !== s.id) continue;
        lm.mesh.setMatrixAt(lm.mesh.count++, s.matrix);
      }
    });
    for (const lm of [...nearLevel.meshes, ...farLevel.meshes]) {
      lm.mesh.visible = lm.mesh.count > 0;
      lm.mesh.instanceMatrix.needsUpdate = true;
    }
  };

  const lod: SvelteLod = {
    root,
    get near() { return nearSet; },
    trianglesNear: nearLevel.tris,
    trianglesFar: farLevel.tris,
    triangles() {
      let t = 0;
      for (const lm of [...nearLevel.meshes, ...farLevel.meshes]) if (lm.mesh.visible) t += lm.tris * lm.mesh.count;
      return t;
    },
    drawCalls: nearLevel.meshes.length + farLevel.meshes.length,
    update(p) {
      // re-pick only after the camera has moved a little
      if (last && last.distanceToSquared(p) < 0.04) return false;
      last = (last ?? new THREE.Vector3()).copy(p);
      const next = pickNear(pos, p.x, p.z, k, nearSet);
      if (filled && next.size === nearSet.size && [...next].every((i) => nearSet.has(i))) return false;
      nearSet = next;
      fill();
      filled = true;
      return true;
    },
    dispose() {
      const mats = new Set<THREE.Material>();
      for (const lm of [...nearLevel.meshes, ...farLevel.meshes]) {
        lm.mesh.geometry.dispose();
        mats.add(lm.mesh.material as THREE.Material);
        lm.mesh.dispose();
      }
      for (const m of mats) m.dispose();
    },
  };
  return lod;
}
