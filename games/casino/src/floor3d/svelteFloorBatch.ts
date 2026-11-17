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

function triangles(g: THREE.BufferGeometry): number {
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
}

/**
 * Batches `cabinet` (built at its own origin, front +Z) into instanced buckets placed at
 * `placements` (each a cabinet-root to floor matrix). The cabinet's own geometry is disposed;
 * its materials are reused (shared, so a pulsing LED or a reel texture on the screen material
 * shows on every copy).
 */
export function batchSvelteCabinet(cabinet: THREE.Object3D, placements: readonly THREE.Matrix4[]): SvelteFloorBatch {
  cabinet.updateMatrixWorld(true);
  const inverseRoot = cabinet.matrixWorld.clone().invert();
  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; colours: THREE.Color[] }>();
  let sourceMeshes = 0;
  cabinet.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    sourceMeshes++;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material;
    // the screen keeps its own bucket whatever its values, so a reel texture can be swapped in later
    const key = material.name === 'VA_SVELTE_REEL_SCREEN_SWAP' ? `screen|${material.uuid}` : materialKey(material);
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material, geos: [], colours: [] }));
    for (const g of bakedPieces(mesh)) {
      g.applyMatrix4(inverseRoot);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      b.geos.push(g);
      b.colours.push((material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1));
    }
  });
  const root = new THREE.Group();
  root.name = 'svelte_floor_batch';
  const meshes: THREE.InstancedMesh[] = [];
  let trianglesPerCabinet = 0;
  for (const b of buckets.values()) {
    const material = colourMerge(b.material, b.geos, b.colours);
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    if (!merged) throw new Error(`svelte batch: could not merge bucket ${b.material.name || b.material.type}`);
    trianglesPerCabinet += triangles(merged);
    const inst = new THREE.InstancedMesh(merged, material, placements.length);
    inst.name = `svelte_batch_${meshes.length}`;
    placements.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = true; inst.receiveShadow = true;
    root.add(inst);
    meshes.push(inst);
  }
  cabinet.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
  return { root, meshes, trianglesPerCabinet, sourceMeshes };
}
