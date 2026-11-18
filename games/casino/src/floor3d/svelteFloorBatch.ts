/**
 * Floor groundwork for ChatGPT's Svelte 01 cabinet (VA-0135, Claude-owned): one built cabinet
 * (with or without the luxury finish) becomes a few InstancedMeshes, one per material bucket,
 * so N cabinets on the floor cost the same draw calls as one. Engineering only: it reads the
 * art's geometry and materials and never changes them. Not wired into the floor yet; that
 * waits for Joshua's phone sign-off (NEEDS JOSHUA on the board).
 *
 * Instancing cuts draw calls, not triangles: N cabinets still draw N × (per-cabinet triangles).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { bakedPieces, colourMerge, materialKey } from './artScene';

export interface SvelteFloorBatch {
  root: THREE.Group;
  /** One per material bucket: the draw calls for any number of cabinets. */
  meshes: THREE.InstancedMesh[];
  /** Triangles in one cabinet (after merging, the same as the source meshes). */
  trianglesPerCabinet: number;
  /** Source meshes merged away. */
  sourceMeshes: number;
}

/** Art meshes meant to face the player (+Z) from the front (VA-0136 recess gaskets). */
const FRONT_FACING = /_recess_shadow_gasket$/;

/**
 * Engineering workaround for VA-0136 (`553a1ef`): the left/right recess shadow gaskets are wound
 * so every triangle faces -Z, and with FrontSide they are culled from the player's side. Flips the
 * index order (and normals) of any FRONT_FACING mesh whose triangles mostly face away. The art
 * module is untouched; returns the names it flipped so the preview can report them.
 */
export function repairSvelteWinding(cabinet: THREE.Object3D): string[] {
  const flipped: string[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  cabinet.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !FRONT_FACING.test(mesh.name) || !mesh.geometry.index) return;
    const g = mesh.geometry, p = g.attributes.position, idx = g.index!;
    let away = 0;
    for (let i = 0; i < idx.count; i += 3) {
      a.fromBufferAttribute(p, idx.getX(i)); b.fromBufferAttribute(p, idx.getX(i + 1)); c.fromBufferAttribute(p, idx.getX(i + 2));
      if (b.sub(a).cross(c.sub(a)).z < 0) away++;
    }
    if (away * 2 <= idx.count / 3) return;
    for (let i = 0; i < idx.count; i += 3) { const t = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, t); }
    idx.needsUpdate = true;
    g.computeVertexNormals();
    flipped.push(mesh.name);
  });
  return flipped;
}

export function triangles(g: THREE.BufferGeometry): number {
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
}

/** One material bucket of a cabinet, merged in the cabinet's own space (front +Z). */
export interface CabinetBucket {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** The reel-screen bucket (material `VA_SVELTE_REEL_SCREEN_SWAP`), kept apart so a machine's own screen can go on it. */
  screen: boolean;
}

/**
 * Merges `cabinet` into one geometry per material bucket, in the cabinet root's own space. The
 * cabinet's geometry is disposed; its materials are reused (colour-merged where values differ only
 * by colour). Shared by the instanced batch below and the distance LOD (svelteLod.ts).
 */
export function cabinetBuckets(cabinet: THREE.Object3D): { buckets: CabinetBucket[]; sourceMeshes: number } {
  repairSvelteWinding(cabinet);
  cabinet.updateMatrixWorld(true);
  const inverseRoot = cabinet.matrixWorld.clone().invert();
  const raw = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; colours: THREE.Color[]; screen: boolean }>();
  let sourceMeshes = 0;
  cabinet.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    sourceMeshes++;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material;
    // the screen keeps its own bucket whatever its values, so a reel texture can be swapped in later
    const screen = material.name === 'VA_SVELTE_REEL_SCREEN_SWAP';
    const key = screen ? `screen|${material.uuid}` : materialKey(material);
    let b = raw.get(key);
    if (!b) raw.set(key, (b = { material, geos: [], colours: [], screen }));
    for (const g of bakedPieces(mesh)) {
      g.applyMatrix4(inverseRoot);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      b.geos.push(g);
      b.colours.push((material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1));
    }
  });
  const buckets: CabinetBucket[] = [];
  for (const b of raw.values()) {
    const material = colourMerge(b.material, b.geos, b.colours);
    const geometry = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!geometry) throw new Error(`svelte batch: could not merge bucket ${b.material.name || b.material.type}`);
    buckets.push({ geometry, material, screen: b.screen });
  }
  cabinet.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
  return { buckets, sourceMeshes };
}

/**
 * Batches `cabinet` (built at its own origin, front +Z) into instanced buckets placed at
 * `placements` (each a cabinet-root to floor matrix). The cabinet's own geometry is disposed;
 * its materials are reused (shared, so a pulsing LED or a reel texture on the screen material
 * shows on every copy).
 */
export function batchSvelteCabinet(cabinet: THREE.Object3D, placements: readonly THREE.Matrix4[]): SvelteFloorBatch {
  const { buckets, sourceMeshes } = cabinetBuckets(cabinet);
  const root = new THREE.Group();
  root.name = 'svelte_floor_batch';
  const meshes: THREE.InstancedMesh[] = [];
  let trianglesPerCabinet = 0;
  for (const { geometry, material } of buckets) {
    trianglesPerCabinet += triangles(geometry);
    const inst = new THREE.InstancedMesh(geometry, material, placements.length);
    inst.name = `svelte_batch_${meshes.length}`;
    placements.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = true; inst.receiveShadow = true;
    root.add(inst);
    meshes.push(inst);
  }
  return { root, meshes, trianglesPerCabinet, sourceMeshes };
}
