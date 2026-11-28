/**
 * Calls an art-module builder (ChatGPT owns art/casino/3d/) and never lets it take a dev page down.
 * If the builder throws, the page gets an empty group plus the error text, so `report()` can say
 * what broke instead of the page hanging on a blank canvas. Engineering code only; it never
 * changes art values.
 */
import * as THREE from 'three';

export interface SafeArtBuild {
  group: THREE.Group;
  buildError: string | null;
}

export function safeArtBuild(build: () => THREE.Object3D): SafeArtBuild {
  try {
    const built = build();
    if (built instanceof THREE.Group) return { group: built, buildError: null };
    const group = new THREE.Group();
    group.add(built);
    return { group, buildError: null };
  } catch (e) {
    const err = e as Error;
    return { group: new THREE.Group(), buildError: `${err?.name ?? 'Error'}: ${err?.message ?? String(e)}` };
  }
}
