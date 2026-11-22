/**
 * Joshua's own slot cabinet (2026-11-22): he generated a bank of Velvet Ace machines with Tripo on
 * his phone. Claude cut one cabinet out of that model (no chair, no neighbours), turned it to face
 * +Z, scaled it ×3.8 so the model's own chair seat sits at the stools' 0.66 m, stood it on the floor
 * with its back 0.34 m behind the origin (the islands' twin spacing), and baked two levels into
 * `art/casino/3d/models/tripo_velvet_cabinet.glb`:
 * - `tripo_cabinet_near`: about 6.1k triangles;
 * - `tripo_cabinet_far`: about 0.8k triangles.
 * One PBR material for both (colour 2048², normal + ORM 1024²), so a hall of them is two draw calls.
 * The reels are painted into its texture, so every machine shows the same screen.
 *
 * Prototype only: the floor uses it in place of the Svelte cabinet when the cabinet model is 'tripo'
 * (the default in proto/dev builds while the Svelte machines are on; ⚙ switches back). It is
 * loaded before the floor mounts (`preloadTripoCabinet`), since the floor builds synchronously.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import modelUrl from '../../../../art/casino/3d/models/tripo_velvet_cabinet.glb?url';

export type CabinetModel = 'tripo' | 'svelte';
export const CABINET_STORAGE_KEY = 'va3d.cabinet';
export const NEXT_CABINET_MODEL: Record<CabinetModel, CabinetModel> = { tripo: 'svelte', svelte: 'tripo' };
/** The cabinet's front is only 7 cm ahead of its origin, so its stools come in from the banks' 0.88 m. */
export const TRIPO_STOOL_Z = 0.45;
/** The cabinet's footprint (local, after baking): x ±0.343, z −0.340 … +0.075, 1.74 m tall. */
export const TRIPO_CABINET = { halfW: 0.343, backZ: -0.34, frontZ: 0.075, height: 1.74 } as const;

/** `?cabinet=` first, then the stored pick; nothing stored means Joshua's cabinet. Proto/dev only. */
export function readCabinetModel(): CabinetModel {
  if (!(import.meta.env.MODE === 'proto' || import.meta.env.DEV)) return 'svelte';
  try {
    const q = new URLSearchParams(location.search).get('cabinet');
    if (q === 'tripo' || q === 'svelte') return q;
    return localStorage.getItem(CABINET_STORAGE_KEY) === 'svelte' ? 'svelte' : 'tripo';
  } catch {
    return 'tripo';
  }
}

let levels: { near: THREE.Object3D; far: THREE.Object3D } | null = null;
let pending: Promise<void> | null = null;

/** Loads the cabinet once (resolves either way; on failure the floor keeps the Svelte cabinet). */
export function preloadTripoCabinet(): Promise<void> {
  pending ??= new GLTFLoader()
    .loadAsync(modelUrl)
    .then((gltf) => {
      const find = (name: string) => gltf.scene.getObjectByName(name);
      const near = find('tripo_cabinet_near'), far = find('tripo_cabinet_far');
      if (!near || !far) throw new Error('tripo cabinet levels missing');
      for (const o of [near, far]) {
        o.removeFromParent();
        o.traverse((m) => {
          const mesh = m as THREE.Mesh;
          if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
        });
      }
      levels = { near, far };
    })
    .catch((e) => {
      console.warn('Tripo cabinet failed to load; keeping the Svelte cabinet', e);
    });
  return pending;
}

/** A fresh copy of one level (materials shared; geometry shared too: the LOD copies what it needs), or null if not loaded. */
export function tripoCabinet(level: 'near' | 'far'): THREE.Object3D | null {
  if (!levels) return null;
  const g = new THREE.Group();
  g.name = `tripo_cabinet_${level}_root`;
  g.add(levels[level].clone(true));
  return g;
}
