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
import { makeVelvetContemporaryInterior, makeVelvetExteriorBackdrop } from '../../../../art/casino/3d/contemporaryInterior.mjs';
import { makeVelvetHeroCabinet } from '../../../../art/casino/3d/heroSlotCabinet.mjs';
import { makeVelvetLuxuryGamingChair } from '../../../../art/casino/3d/luxuryGamingChair.mjs';

export type WallSide = 'north' | 'east' | 'west';
export type CeilingPart = 'roof' | 'fixtures' | 'entrance';
type Side = WallSide | CeilingPart | 'exterior' | null;
const CEILING_PARTS: readonly string[] = ['roof', 'fixtures', 'entrance'];

export interface ArtScene {
  root: THREE.Group;
  /** Batches that belong to each wall, for the overview's cutaway. */
  walls: Record<WallSide, THREE.Mesh[]>;
  /**
   * Overhead architecture (the art names it all `chandelier_*`), split so the overview can cut
   * away the roof but keep the hanging lights: `roof` is the ceiling slab and coffers,
   * `fixtures` the chandeliers, rods and canopies, `entrance` the wings, arch and vestibule.
   */
  ceiling: Record<CeilingPart, THREE.Mesh[]>;
  /** Each cabinet's interactive parts, by `slot_<theme>/<part>` (`reels`, `spin_button`, `marquee`). */
  interactive: Map<string, THREE.Mesh>;
  /**
   * Art-only scenery outside the room (the pilot's forecourt and ground field, VA-0032). It only
   * shows in the overview: from the follow view the vestibule hides it, so it costs no draw calls there.
   */
  exterior: THREE.Mesh[];
  /** How many meshes the factories built, and how many draw batches they became. */
  meshesAuthored: number;
  batches: number;
}

/** The art names its walls; panels and caps on the back wall go with it. */
function wallSideOf(name: string, worldX: number): Side {
  if (name.startsWith('chandelier_')) {
    if (name === 'chandelier_ceiling' || name.startsWith('chandelier_coffer')) return 'roof';
    // pass-05 pilot ceiling: the coffer field, grid, lit panels and the ceiling-mounted red light
    // boxes are roof (from above they would cover the table); the hanging globes are fixtures
    if (/^chandelier_(dark_coffer|grid_rib|illuminated_panel|panel_crossmember|red_canopy|red_light_face)/.test(name)) return 'roof';
    if (/^chandelier_(entrance|portal|arch|vestibule)/.test(name)) return 'entrance';
    return 'fixtures';
  }
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
const EXTERIOR_GROUP = 'VA_ExteriorBackdrop_ArtOnly';
function isExterior(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) if (p.name === EXTERIOR_GROUP) return true;
  return false;
}
function cabinetOf(o: THREE.Object3D): string | null {
  for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) if (p.name.startsWith('slot_')) return p.name;
  return null;
}

/** Two materials with the same values draw identically, whichever factory made them. */
function materialKey(m: THREE.Material): string {
  const s = m as THREE.MeshStandardMaterial;
  // a textured material (the pass-05 carpet) must never merge with a plain one of the same colour
  return [m.type, s.map?.uuid ?? '', s.color?.getHexString(), s.metalness, s.roughness, s.emissive?.getHexString(), s.emissiveIntensity, m.transparent, m.opacity].join('|');
}

/**
 * Builds the art world. `chairFacing` maps a seat id to the chair's turn about Y (radians);
 * the art composition places chairs but leaves facing to engineering.
 */
/** Pass-04 pieces the pass-05 pilot replaces (its carpet, aisle and ceiling sit in their place). */
const REPLACED_BY_PILOT = /^(red_carpet|carpet_gold_edge|floor_inlay|chandelier_(ceiling|coffer_.*|hub|ring|crystal|support_rod|canopy))$/;
/** The pass-05 hero cabinet stands in for this machine (one hero first, per ART_PASS_05.md). */
export const PILOT_HERO_SLOT = 'sevens';

export interface ArtOptions {
  /** Art pass 05 pilot (ChatGPT, VA-0029): patterned carpet, lit ceiling, one hero cabinet, one swivel chair. */
  pilot05?: boolean;
}

/** Swaps the pass-05 pilot into the composed world, before batching. */
function applyPilot05(art: THREE.Group): void {
  const drop: THREE.Object3D[] = [];
  art.traverse((o) => {
    if (REPLACED_BY_PILOT.test(o.name)) drop.push(o);
  });
  for (const o of drop) {
    o.removeFromParent();
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  }
  art.add(makeVelvetContemporaryInterior(THREE) as THREE.Group);
  // scenery outside the room so the overview no longer looks into black past the entrance
  // (VA-0032); art-only: it gets no obstacles, nav or camera blockers
  art.add(makeVelvetExteriorBackdrop(THREE) as THREE.Group);
  // the hero replaces the old cabinet inside the same slot_<id> group, so its reels, spin button
  // and marquee stay interactive parts of that slot
  const slot = art.getObjectByName(`slot_${PILOT_HERO_SLOT}`);
  if (slot) {
    for (const c of [...slot.children]) {
      c.removeFromParent();
      c.traverse((q) => (q as THREE.Mesh).geometry?.dispose());
    }
    slot.add(makeVelvetHeroCabinet(THREE, PILOT_HERO_SLOT) as THREE.Group);
    // the swivel chair sits beside the hero, turned toward its screen; it stays clear of the
    // walk-up point straight in front of the machine
    const chair = makeVelvetLuxuryGamingChair(THREE) as THREE.Group;
    chair.name = 'pilot_luxury_chair';
    chair.position.set(0.68, 0, 0.78);
    chair.rotation.y = Math.PI + 0.7;
    slot.add(chair);
  }
}

export function buildArtScene(chairFacing: Map<string, number>, opts: ArtOptions = {}): ArtScene {
  const { root: art } = makeVelvetWorld(THREE) as { root: THREE.Group };
  if (opts.pilot05) applyPilot05(art);
  for (const [id, rot] of chairFacing) {
    const chair = art.getObjectByName(`${id}_chair`);
    if (chair) chair.rotation.y = rot;
  }
  art.updateMatrixWorld(true);

  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; names: string[]; side: Side; part: string | null; renderOrder: number }>();
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
    const side: Side = isExterior(mesh) ? 'exterior' : wallSideOf(mesh.name, wp.x);
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
  const ceiling: Record<CeilingPart, THREE.Mesh[]> = { roof: [], fixtures: [], entrance: [] };
  const interactive = new Map<string, THREE.Mesh>();
  const exterior: THREE.Mesh[] = [];
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
    if (b.side === 'exterior') {
      mesh.visible = false;
      exterior.push(mesh);
    } else if (b.side && CEILING_PARTS.includes(b.side)) ceiling[b.side as CeilingPart].push(mesh);
    else if (b.side) walls[b.side as WallSide].push(mesh);
  }
  return { root, walls, ceiling, interactive, exterior, meshesAuthored, batches: buckets.size };
}
