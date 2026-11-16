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
import { PILOT_CHAIR, PILOT_HERO_SLOT } from './layout.ts';

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
  /** Batches that merge several colours of one material through vertex colours. */
  colourBatches: number;
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

/**
 * Materials that differ only in base colour draw identically once that colour moves into the
 * vertices (three.js multiplies `color` by the vertex colour), so they share one batch: e.g. the
 * nine standard cabinets' bodies, trims and screens are 4 draw calls instead of 36. Every other
 * value has to match. A textured material keeps its colour in the key (it never merges with a
 * plain one of the same colour, e.g. the pass-05 carpet).
 */
function materialKey(m: THREE.Material): string {
  const s = m as THREE.MeshStandardMaterial;
  const colour = s.map || !s.color ? (s.color?.getHexString() ?? '') : '*';
  return [m.type, s.map?.uuid ?? '', colour, s.metalness, s.roughness, s.emissive?.getHexString(), s.emissiveIntensity, m.transparent, m.opacity, m.side, m.depthWrite, m.toneMapped].join('|');
}

/**
 * Builds the art world. `chairFacing` maps a seat id to the chair's turn about Y (radians);
 * the art composition places chairs but leaves facing to engineering.
 */
/** Pass-04 pieces the pass-05 pilot replaces (its carpet, aisle and ceiling sit in their place). */
const REPLACED_BY_PILOT = /^(red_carpet|carpet_gold_edge|floor_inlay|chandelier_(ceiling|coffer_.*|hub|ring|crystal|support_rod|canopy))$/;
export { PILOT_HERO_SLOT };

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
    // (layout.ts gives it a collision circle at the same spot)
    chair.position.set(PILOT_CHAIR.local.x, 0, PILOT_CHAIR.local.z);
    chair.rotation.y = PILOT_CHAIR.rotationY;
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

  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; colours: THREE.Color[]; names: string[]; side: Side; part: string | null; renderOrder: number }>();
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
      b = { material, geos: [], colours: [], names: [], side, part: part && cabinet ? part : null, renderOrder: 0 };
      buckets.set(key, b);
    }
    // merging needs one layout: unindexed, with position / normal / uv only
    const src = mesh.geometry;
    const g = src.index ? src.toNonIndexed() : src.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    g.applyMatrix4(mesh.matrixWorld);
    b.geos.push(g);
    b.colours.push((material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1));
    b.names.push(mesh.name);
    // e.g. the contact-shadow decals draw after the floor
    b.renderOrder = Math.max(b.renderOrder, mesh.renderOrder);
    src.dispose();
  });
  
  const root = new THREE.Group();
  root.name = 'VelvetAce_ArtBatched';
  const walls: Record<WallSide, THREE.Mesh[]> = { north: [], east: [], west: [] };
  const ceiling: Record<CeilingPart, THREE.Mesh[]> = { roof: [], fixtures: [], entrance: [] };
  const interactive = new Map<string, THREE.Mesh>();
  const exterior: THREE.Mesh[] = [];
  let colourBatches = 0;
  for (const [key, b] of buckets) {
    let material = b.material;
    if (!b.part && b.colours.some((c) => !c.equals(b.colours[0]))) {
      // several colours in one batch: each piece carries its material's (linear) colour per
      // vertex, and the shared material's own colour is white, so the product is unchanged
      b.geos.forEach((g, i) => {
        const c = b.colours[i];
        const n = g.attributes.position.count;
        const rgb = new Float32Array(n * 3);
        for (let v = 0; v < n; v++) rgb.set([c.r, c.g, c.b], v * 3);
        g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
      });
      material = b.material.clone();
      (material as THREE.MeshStandardMaterial).color.setRGB(1, 1, 1);
      material.vertexColors = true;
      colourBatches++;
    }
    // interactive parts keep a geometry group per original mesh (groups[i] is names[i])
    const merged = mergeGeometries(b.geos, !!b.part);
    for (const g of b.geos) g.dispose();
    if (!merged) throw new Error(`could not batch art group ${key}`);
    const mesh = new THREE.Mesh(merged, material);
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
  // materials no batch draws with (merged duplicates, and the originals of colour batches)
  const drawn = new Set(root.children.map((m) => (m as THREE.Mesh).material as THREE.Material));
  for (const m of allMaterials) if (!drawn.has(m)) m.dispose();
  return { root, walls, ceiling, interactive, exterior, meshesAuthored, batches: buckets.size, colourBatches };
}
