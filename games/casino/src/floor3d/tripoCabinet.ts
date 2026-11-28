/**
 * Joshua's own slot cabinets (2026-11-22): he generates them with Tripo on his phone, and Claude
 * bakes each into a floor-ready GLB with `art/casino/3d/models/bake/bakeCabinet.mjs`: front turned
 * to +Z, centred on x, standing on the floor with its back 0.34 m behind the origin (the islands'
 * twin spacing), and two levels sharing one PBR material:
 * - `tripo_cabinet_near`: about 6–8k triangles;
 * - `tripo_cabinet_far`: about 0.8–2.3k triangles.
 * The reels are painted into each texture, so every copy of one model shows the same screen.
 *
 * The floor mixes every model that loads: each bank row takes one model, in turn (`modelForRun`).
 * Each model brings its own bank pitch (wide cabinets stand fewer to a row), front depth and stool
 * distance. Prototype only: the default in proto/dev builds while the Svelte machines are on; ⚙
 * switches back to the Svelte cabinet. Loaded before the floor mounts (`preloadTripoCabinets`),
 * since the floor builds synchronously.
 *
 * To add a model: bake it, put the GLB in art/casino/3d/models/, and add a line to CABINET_MODELS
 * with the numbers the bake script prints (width → pitch, frontZ; stoolZ ≈ frontZ + 0.37).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import velvetBankUrl from '../../../../art/casino/3d/models/tripo_velvet_cabinet.glb?url';
import enchantedForestUrl from '../../../../art/casino/3d/models/tripo_enchanted_forest.glb?url';
import egyptianUrl from '../../../../art/casino/3d/models/tripo_egyptian.glb?url';
import deepSeaUrl from '../../../../art/casino/3d/models/tripo_deep_sea.glb?url';

export interface CabinetModelSpec {
  id: string;
  url: string;
  /** Centre-to-centre spacing in a bank (metres). */
  pitch: number;
  /** Half the width the bank box and the end caps allow for. */
  halfW: number;
  /** The cabinet's front (local z) and where its stool stands. */
  frontZ: number;
  stoolZ: number;
}

export const CABINET_MODELS: readonly CabinetModelSpec[] = [
  // cut from Joshua's generated bank of four: its sides are cut edges, so neighbours may overlap
  // them by a few cm (0.685 m wide at a 0.65 m pitch); 1.74 m tall, scale ×3.8 from his model's chair
  { id: 'velvet-bank', url: velvetBankUrl, pitch: 0.65, halfW: 0.325, frontZ: 0.075, stoolZ: 0.45 },
  // whole cabinets, baked with bakeCabinet.mjs (stand-alone units, so pitch = width + 2 cm and the
  // stool sits ~0.37 m in front of the cabinet face). Fit tweaks (Joshua's OK, 2026-11-22): heights
  // evened to ~1.6-1.7 m, wide ones narrowed (--squeeze) and thinned (--depth) a little.
  // "Enchanted Forest": carved side art; 0.76 wide × 1.66 tall × 0.59 deep (squeeze 0.9, depth 0.85)
  { id: 'enchanted-forest', url: enchantedForestUrl, pitch: 0.78, halfW: 0.39, frontZ: 0.246, stoolZ: 0.62 },
  // Egyptian theme with teal side light strips; 0.75 × 1.70 × 0.56 (depth 0.85)
  { id: 'egyptian', url: egyptianUrl, pitch: 0.77, halfW: 0.385, frontZ: 0.215, stoolZ: 0.59 },
  // "Deep Sea Expedition": curved cabinet with ocean side art; 0.85 × 1.60 × 0.61 (squeeze 0.8, depth 0.75)
  { id: 'deep-sea', url: deepSeaUrl, pitch: 0.86, halfW: 0.43, frontZ: 0.267, stoolZ: 0.64 },
];

export type CabinetModel = 'tripo' | 'svelte';
export const CABINET_STORAGE_KEY = 'va3d.cabinet';
export const NEXT_CABINET_MODEL: Record<CabinetModel, CabinetModel> = { tripo: 'svelte', svelte: 'tripo' };

/** `?cabinet=` first, then the stored pick; nothing stored means Joshua's cabinets. Proto/dev only. */
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

export interface LoadedCabinet extends CabinetModelSpec {
  near: THREE.Object3D;
  far: THREE.Object3D;
}

const loaded = new Map<string, { near: THREE.Object3D; far: THREE.Object3D }>();
let pending: Promise<void> | null = null;

/** Loads every model once; resolves either way (a model that fails is left out). */
export function preloadTripoCabinets(): Promise<void> {
  pending ??= Promise.all(
    CABINET_MODELS.map((m) =>
      new GLTFLoader()
        .loadAsync(m.url)
        .then((gltf) => {
          const near = gltf.scene.getObjectByName('tripo_cabinet_near'), far = gltf.scene.getObjectByName('tripo_cabinet_far');
          if (!near || !far) throw new Error(`${m.id}: cabinet levels missing`);
          for (const o of [near, far]) {
            o.removeFromParent();
            o.traverse((c) => {
              const mesh = c as THREE.Mesh;
              if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
            });
          }
          loaded.set(m.id, { near, far });
        })
        .catch((e) => console.warn(`Tripo cabinet ${m.id} failed to load`, e)),
    ),
  ).then(() => undefined);
  return pending;
}

/** Fresh copies of every model that loaded, in CABINET_MODELS order (materials and geometry shared). */
export function tripoCabinets(): LoadedCabinet[] {
  const out: LoadedCabinet[] = [];
  for (const m of CABINET_MODELS) {
    const l = loaded.get(m.id);
    if (!l) continue;
    const wrap = (o: THREE.Object3D, level: string) => {
      const g = new THREE.Group();
      g.name = `tripo_${m.id}_${level}_root`;
      g.add(o.clone(true));
      return g;
    };
    out.push({ ...m, near: wrap(l.near, 'near'), far: wrap(l.far, 'far') });
  }
  return out;
}

/** Which model a bank row takes: rows take the models in turn. */
export function modelForRun(run: number, models: number): number {
  return models > 0 ? run % models : 0;
}
