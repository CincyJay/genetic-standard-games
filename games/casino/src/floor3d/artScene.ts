/**
 * Puts ChatGPT's 3D art (PR #2, art/casino/3d/) on the floor. The art is used exactly as
 * authored: this file only places it (chairs turned to face the table) and then batches it for
 * phones. The factories build roughly a thousand small meshes; drawing each separately would
 * cost a thousand draw calls a frame, so static meshes that look identical (same material
 * values) are merged into one mesh per material. Walls stay in their own batches, so the
 * overview can still cut away the walls it looks through. Each slot cabinet's interactive parts
 * stay out of the shared batches (VA-0021): its 25 reel cells become one mesh with a geometry
 * group per cell (one draw call, each cell still addressable), and its spin button and marquee
 * screen stay meshes of their own.
 *
 * Engineering only: no geometry or material values are changed here.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeVelvetWorld } from '../../../../art/casino/3d/worldComposition.mjs';

export type WallSide = 'north' | 'east' | 'west';

export interface ArtScene {
  root: THREE.Group;
  /** Batches that belong to each wall, for the overview's cutaway. */
  walls: Record<WallSide, THREE.Mesh[]>;
  /** The chandeliers: hidden in the overview, which looks down through them. */
  ceiling: THREE.Mesh[];
  /** Each cabinet's interactive parts, by `slot_<theme>/<part>` (`reels`, `spin_button`, `marquee`). */
  interactive: Map<string, THREE.Mesh>;
  /** How many meshes the factories built, and how many draw batches they became. */
  meshesAuthored: number;
  batches: number;
}

/** The art names its walls; panels and caps on the back wall go with it. */
function wallSideOf(name: string, worldX: number): WallSide | 'ceiling' | null {
  if (name.startsWith('chandelier_')) return 'ceiling';
  if (name === 'rear_wall' || name === 'wall_panel' || name === 'art_deco_panel_cap') return 'north';
  if (name === 'wall') return worldX < 0 ? 'west' : 'east';
  return null;
}

/** Slot parts the game will drive later, which therefore stay out of the shared batches. */
function interactivePart(name: string): string | null {
  if (/^REEL_\d+_\d+_SWAP_TEXTURE$/.test(name)) return 'reels';
  if (name === 'spin_button') return 'spin_button';
  if (name === 'marquee_world_texture_target') return 'marquee';
  return null;
}
function cabinetOf(o: THREE.Object3D): string | null {
  for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) if (p.name.startsWith('slot_')) return p.name;
  return null;
}

/** Two materials with the same values draw identically, whichever factory made them. */
function materialKey(m: THREE.Material): string {
  const s = m as THREE.MeshStandardMaterial;
  return [m.type, s.color?.getHexString(), s.metalness, s.roughness, s.emissive?.getHexString(), s.emissiveIntensity, m.transparent, m.opacity].join('|');
}

/**
 * Builds the art world. `chairFacing` maps a seat id to the chair's turn about Y (radians);
 * the art composition places chairs but leaves facing to engineering.
 */
export function buildArtScene(chairFacing: Map<string, number>): ArtScene {
  const { root: art } = makeVelvetWorld(THREE) as { root: THREE.Group };
  for (const [id, rot] of chairFacing) {
    const chair = art.getObjectByName(`${id}_chair`);
    if (chair) chair.rotation.y = rot;
  }
  art.updateMatrixWorld(true);

  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; names: string[]; side: WallSide | 'ceiling' | null; part: string | null; renderOrder: number }>();
  const usedMaterials = new Set<THREE.Material>();
  const allMaterials = new Set<THREE.Material>();
  const wp = new THREE.Vector3();
  let meshesAuthored = 0;
  art.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshesAuthored++;
    const material = mesh.material as THREE.Material;
    allMaterials.add(material);
    mesh.getWorldPosition(wp);
    const side = wallSideOf(mesh.name, wp.x);
    const part = interactivePart(mesh.name);
    const cabinet = part ? cabinetOf(mesh) : null;
    const key = part && cabinet ? `${cabinet}/${part}` : `${side ?? ''}#${materialKey(material)}`;
    let b = buckets.get(key);
    if (!b) {
      b = { material, geos: [], names: [], side, part: part && cabinet ? part : null, renderOrder: 0 };
      buckets.set(key, b);
      usedMaterials.add(material);
    }
    // merging needs one layout: unindexed, with position / normal / uv only
    const src = mesh.geometry;
    const g = src.index ? src.toNonIndexed() : src.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    g.applyMatrix4(mesh.matrixWorld);
    b.geos.push(g);
    b.names.push(mesh.name);
    // e.g. the contact-shadow decals draw after the floor
    b.renderOrder = Math.max(b.renderOrder, mesh.renderOrder);
    src.dispose();
  });
  for (const m of allMaterials) if (!usedMaterials.has(m)) m.dispose();

  const root = new THREE.Group();
  root.name = 'VelvetAce_ArtBatched';
  const walls: Record<WallSide, THREE.Mesh[]> = { north: [], east: [], west: [] };
  const ceiling: THREE.Mesh[] = [];
  const interactive = new Map<string, THREE.Mesh>();
  for (const [key, b] of buckets) {
    // interactive parts keep a geometry group per original mesh (groups[i] is names[i])
    const merged = mergeGeometries(b.geos, !!b.part);
    for (const g of b.geos) g.dispose();
    if (!merged) throw new Error(`could not batch art group ${key}`);
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.name = b.part ? key : `art:${key}`;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = b.renderOrder;
    root.add(mesh);
    if (b.part) {
      mesh.userData.parts = b.names;
      interactive.set(key, mesh);
    }
    if (b.side === 'ceiling') ceiling.push(mesh);
    else if (b.side) walls[b.side].push(mesh);
  }
  return { root, walls, ceiling, interactive, meshesAuthored, batches: buckets.size };
}
