/**
 * Puts ChatGPT's 3D art (PR #2, art/casino/3d/) on the floor. The art is used exactly as
 * authored: this file only places it (chairs turned to face the table) and then batches it for
 * phones. The factories build roughly a thousand small meshes; drawing each separately would
 * cost a thousand draw calls a frame, so static meshes that look identical (same material
 * values) are merged into one mesh per material. Walls stay in their own batches, so the
 * overview can still cut away the walls it looks through. Each slot cabinet's interactive parts
 * stay out of the shared batches (VA-0021): its 25 reel cells become one mesh with a geometry
 * group per cell (one draw call, each cell still addressable), and its marquee screen stays a
 * mesh of its own. The spin buttons of all cabinets share one batch (VA-0327): each cabinet's
 * button is a vertex range of it (`userData.ranges`), so ten buttons cost one draw call.
 *
 * Engineering only: no geometry or material values are changed here.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeVelvetWorld } from '../../../../art/casino/3d/worldComposition.mjs';
import { makeVelvetContemporaryInterior, makeVelvetExteriorBackdrop } from '../../../../art/casino/3d/contemporaryInterior.mjs';
import { makeVelvetHeroCabinet } from '../../../../art/casino/3d/heroSlotCabinet.mjs';
import { makeVelvetLuxuryGamingChair } from '../../../../art/casino/3d/luxuryGamingChair.mjs';
import { createVelvetGamingChair } from '../../../../art/casino/3d/velvetGamingChair.mjs';
import { readChairStyle } from './grandHallArt.ts';
import { makeVelvetGuestAvatar } from '../../../../art/casino/3d/guestAvatar.mjs';
import { makeVelvetBlackjackHero } from '../../../../art/casino/3d/blackjackHero.mjs';
import { makeVelvetPatternCarpet } from '../../../../art/casino/3d/patternCarpet.mjs';
import { PILOT_CHAIR, PILOT_HERO_SLOT, TABLE, type FloorLayout } from './layout.ts';
import { composeGrandHall, type CeilingStyle } from './grandHallArt.ts';
import { applySvelteMachines } from './svelteFloor.ts';
import type { SvelteLod } from './svelteLod.ts';
import type { BankPlan } from './svelteFloor.ts';
import { MACHINES } from '../logic/slots.ts';

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
  /**
   * Each cabinet's interactive parts, by `slot_<theme>/<part>` (`reels`, `spin_button`, `marquee`).
   * Every cabinet's `spin_button` entry is the same shared batch (VA-0327); its button is the
   * vertex range `userData.ranges[<slot_theme>]` ([first vertex, vertex count]).
   */
  interactive: Map<string, THREE.Mesh>;
  /**
   * The grand hall's copied cabinets' reels, one batch per theme (25 geometry groups per copy, in
   * order), so they can show their theme's symbols too. Not interactive. Empty in the salon.
   */
  reelCopies: Map<string, THREE.Mesh>;
  /**
   * Art-only scenery outside the room (the pilot's forecourt and ground field, VA-0032). It only
   * shows in the overview: from the follow view the vestibule hides it, so it costs no draw calls there.
   */
  exterior: THREE.Mesh[];
  /**
   * Furniture the follow camera fades while it frames a machine, by slot id (the pilot's swivel
   * chair beside the hero, VA-0045). Batched apart, on materials of their own, so fading them
   * touches nothing else.
   */
  fadeable: Map<string, THREE.Mesh[]>;
  /**
   * Canvas textures the hero cabinet draws for itself (its title and BONUS sign, VA-0048), or
   * none outside a browser. Batching keys on the map, so each should still be drawn after it.
   */
  heroTextures: THREE.Texture[];
  /** Grand-hall chair poses recorded before batching merges them (debug.objectPose, VA-0190). */
  chairPoses: Map<string, { x: number; y: number; z: number; yaw: number }>;
  /**
   * How far (m) liftHeroSignClear had to move the BONUS sign forward; 0 once the art puts the
   * sign in front of its glass itself (b7609a7, VA-0050).
   */
  heroSignLift: number;
  /** Whether the opt-in blackjack hero table (VA-0054) replaced the round table's art. */
  blackjackHero: boolean;
  /** Whether ChatGPT's opt-in woven carpet (VA-0058) replaced the pass-05 pilot carpet. */
  wovenCarpet: boolean;
  /** How many Svelte cabinets the prototype machine switch put in (0 when it is off). */
  svelteCabinets: number;
  /** The Svelte islands' distance LOD (machine style `svelte-lod`); call `update` with the camera position each frame. */
  svelteLod: SvelteLod | null;
  /**
   * Batches for the view where nothing is cut away (the eye-level follow camera): each material
   * the walls or ceiling share with the rest of the room is drawn once, wall and ceiling pieces
   * included, instead of once per side (VA-0052). Show `combined` and hide `replaced` only while
   * every wall and the whole ceiling would be shown anyway; otherwise the reverse.
   */
  whole: { combined: THREE.Mesh[]; replaced: THREE.Mesh[] };
  /**
   * Grand hall hero LOD (VA-0305): the end-wall heroes' batches in full detail and their lighter
   * twins' (each set also carries the side-wall copies, so a set is one batch per material), and
   * where each hero stands. Show one set at a time (heroLodFull in grandHallArt.ts);
   * `lite` starts hidden. Null unless the hall was composed with `heroLod`. `far` (with `heroFar`,
   * VA-0330) is ChatGPT's far cabinet in place of each hero's lite twin, plus the north copies; hidden,
   * and empty without `heroFar`. `farAll` is to `far` what `liteAll` is to `lite`.
   */
  heroLod: { full: THREE.Mesh[]; lite: THREE.Mesh[]; south: THREE.Mesh[]; liteAll: THREE.Mesh[]; far: THREE.Mesh[]; farAll: THREE.Mesh[]; centres: { x: number; z: number }[] } | null;
  /**
   * Batches the renderer skips by world box instead of bounding sphere (boxCulled in world.ts,
   * VA-0316). With the hero LOD on, the side-wall copies split at the hall's middle: the north
   * ones stay in the hero sets (`full`, `lite`, z −17.8…−6.8) and the south ones batch on their
   * own (`south`, z 7.3…14.9). Each spans both side walls, so a sphere around it reaches past the
   * hall's middle and three.js never culls it; a box does once that end is behind the camera.
   * `liteAll` is the old lite set (twins and every copy, hidden): drawn in place of `lite` and
   * `south` when both are in view, so that view costs no more draw calls than before the split.
   */
  boxCull: { mesh: THREE.Mesh; box: THREE.Box3 }[];
  /** How many meshes the factories built, and how many draw batches they became. */
  meshesAuthored: number;
  batches: number;
  /** Batches that merge several colours of one material through vertex colours. */
  colourBatches: number;
}

/** The art names its walls; panels and caps on the back wall go with it. */
export function wallSideOf(name: string, worldX: number): Side {
  if (name.startsWith('chandelier_')) {
    if (name === 'chandelier_ceiling' || name.startsWith('chandelier_coffer')) return 'roof';
    // pass-05 pilot ceiling: the coffer field, grid, lit panels and the ceiling-mounted red light
    // boxes are roof (from above they would cover the table); the hanging globes are fixtures
    if (/^chandelier_(dark_coffer|grid_rib|illuminated_panel|panel_crossmember|red_canopy|red_light_face)/.test(name)) return 'roof';
    if (/^chandelier_(entrance|portal|arch|vestibule)/.test(name)) return 'entrance';
    return 'fixtures';
  }
  // the grand hall architecture (VA-0065): its ceiling, coffers and beams are roof; the cove
  // strips, ring chandeliers and their rods hang below and stay as fixtures; its side walls go
  // with the salon's east and west walls
  if (name === 'ceiling-base' || name.startsWith('coffer-')) return 'roof';
  // the gold-coffer ceiling (VA-0175): its plane, panels, beams and moldings are roof; its
  // chandeliers are named chandelier_* and so are fixtures above. Its perimeter rail (080197b) hangs
  // flush under the outer beams and goes with them (VA-0181)
  if (/^(burgundy_overhead|recessed_burgundy_coffer_panels|(longitudinal|transverse)_brushed_gold_coffer_beams|coffer_inner_gold_molding_[xz]|ceiling_attached_perimeter_gold_rail)$/.test(name)) return 'roof';
  // the coffer-tile ceiling (VA-0325): every piece is mounted flush to the slab, so all of it is roof
  if (/^(coffer_(inset|plaster_frame|bronze_bead|light_diffuser(_[nsew]|_beam)?)|corner_rosette)$/.test(name)) return 'roof';
  if (name === 'warm-cove-strip' || name === 'suspended-ring-chandelier' || name === 'chandelier-suspension') return 'fixtures';
  // the grand hall endcaps (VA-0071): the far wall goes with the salon's north wall; the entrance
  // wings, piers and lintel are the entrance front, hidden from above like the salon's portal
  if (name.startsWith('wall-rear-')) return 'north';
  if (name.startsWith('wall-entrance-') || name.startsWith('entrance-')) return 'entrance';
  if (name.startsWith('wall-')) return worldX < 0 ? 'west' : 'east';
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
/** The interactive part whose cabinets share one batch (VA-0327). */
const SHARED_PART = 'spin_button';
const EXTERIOR_GROUP = 'VA_ExteriorBackdrop_ArtOnly';
function isExterior(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) if (p.name === EXTERIOR_GROUP) return true;
  return false;
}
/** Groups whose meshes fade while their machine is framed, and the slot each belongs to. */
const FADEABLE_GROUPS = new Map<string, string>([['pilot_luxury_chair', PILOT_HERO_SLOT]]);
function fadeGroupOf(o: THREE.Object3D): string | null {
  for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) {
    const slot = FADEABLE_GROUPS.get(p.name);
    if (slot) return slot;
  }
  return null;
}
/** The grand hall's copied cabinets (`slotcopy_<theme>_<n>`): their theme's copies batch, by theme. */
function copyCabinetOf(o: THREE.Object3D): string | null {
  for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) {
    const m = /^slotcopy_(.+)_\d+$/.exec(p.name);
    if (m) return `slotcopy_${m[1]}`;
  }
  return null;
}
/** A grand-hall hero's detail level ('full' or 'lite', VA-0305), or null outside the hero LOD. */
function heroLodOf(o: THREE.Object3D): string | null {
  for (let p: THREE.Object3D | null = o.parent; p; p = p.parent) if (typeof p.userData.heroLod === 'string') return p.userData.heroLod;
  return null;
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
export function materialKey(m: THREE.Material): string {
  const s = m as THREE.MeshStandardMaterial;
  const colour = s.map || !s.color ? (s.color?.getHexString() ?? '') : '*';
  return [m.type, s.map?.uuid ?? '', colour, s.metalness, s.roughness, emissiveKey(m), s.emissiveIntensity, m.transparent, m.opacity, m.side, m.depthWrite, m.toneMapped].join('|');
}

/**
 * A lit, unmapped material's non-black emissive colour can move into the vertices too (VA-0220):
 * the ten hero slots' theme-coloured neon and trims (two materials per theme) then share two
 * batches instead of twenty. Black stays its own key, so unlit materials never take the shader patch.
 */
function emissiveKey(m: THREE.Material): string | undefined {
  const s = m as THREE.MeshStandardMaterial;
  if (!s.emissive) return undefined;
  const hex = s.emissive.getHexString();
  return hex === '000000' || s.emissiveMap || !EMISSIVE_PATCHABLE.has(m.type) ? hex : '*';
}
const EMISSIVE_PATCHABLE = new Set(['MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial']);

/** Multiplies the material's emissive by a per-vertex `emissiveColor` (survives clone()). */
function patchVertexEmissive<M extends THREE.Material>(m: M): M {
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 emissiveColor;\nvarying vec3 vEmissiveColor;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmissiveColor = emissiveColor;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEmissiveColor;')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vEmissiveColor;');
  };
  m.customProgramCacheKey = () => 'va-vertex-emissive';
  m.userData.vertexEmissive = true;
  const clone = m.clone.bind(m);
  m.clone = () => patchVertexEmissive(clone() as M);
  return m;
}

/**
 * Several colours in one batch: each piece carries its material's (linear) colour per vertex,
 * and the shared material's own colour is white, so the product is unchanged. Returns the
 * material to draw with (the original when every piece has the same colour).
 */
export function colourMerge(material: THREE.Material, geos: THREE.BufferGeometry[], colours: THREE.Color[], emissives?: THREE.Color[]): THREE.Material {
  const sameColour = colours.every((c) => c.equals(colours[0]));
  const sameEmissive = !emissives || emissives.every((c) => c.equals(emissives[0]));
  if (sameColour && sameEmissive) return material;
  const perVertex = (name: string, cs: THREE.Color[]) =>
    geos.forEach((g, i) => {
      const c = cs[i];
      const n = g.attributes.position.count;
      const rgb = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) rgb.set([c.r, c.g, c.b], v * 3);
      g.setAttribute(name, new THREE.BufferAttribute(rgb, 3));
    });
  const merged = material.clone();
  if (!sameColour) {
    perVertex('color', colours);
    (merged as THREE.MeshStandardMaterial).color.setRGB(1, 1, 1);
    merged.vertexColors = true;
  }
  if (!sameEmissive) {
    perVertex('emissiveColor', emissives!);
    (merged as THREE.MeshStandardMaterial).emissive.setRGB(1, 1, 1);
    patchVertexEmissive(merged);
  }
  return merged;
}

/** A material's emissive colour for colourMerge (black when it has none). */
export function emissiveOf(m: THREE.Material): THREE.Color {
  return (m as THREE.MeshStandardMaterial).emissive ?? new THREE.Color(0, 0, 0);
}

/** One mesh's geometry in its art root's space, in the one layout merging needs. */
function bakedGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const src = mesh.geometry;
  const g = src.index ? src.toNonIndexed() : src.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  g.applyMatrix4(mesh.matrixWorld);
  return g;
}

/**
 * A mesh's pieces for batching: its baked geometry, or for an InstancedMesh one baked copy per
 * instance (merging ignores instance matrices, so without this every chip would land at the
 * stack's origin).
 */
export function bakedPieces(mesh: THREE.Mesh): THREE.BufferGeometry[] {
  const inst = mesh as THREE.InstancedMesh;
  if (!inst.isInstancedMesh) return [bakedGeometry(mesh)];
  const base = bakedGeometry(Object.assign(new THREE.Mesh(mesh.geometry), { matrixWorld: new THREE.Matrix4() }));
  const m = new THREE.Matrix4();
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < inst.count; i++) {
    inst.getMatrixAt(i, m);
    out.push(base.clone().applyMatrix4(m.premultiply(mesh.matrixWorld)));
  }
  base.dispose();
  return out;
}

/**
 * ChatGPT's guest avatar pilot (VA-0035), as a visual skin for the player: batched by material
 * (about 30 meshes become a few draw calls), turned to face -Z like the capsule (the art faces
 * +Z) and scaled so its top meets `height`, the gameplay height the cameras frame. Collision,
 * movement and camera stay engineering's. Unrigged: it glides, it does not walk yet.
 */
export function buildGuestAvatar(height: number): THREE.Group {
  const art = makeVelvetGuestAvatar(THREE) as THREE.Group;
  art.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; colours: THREE.Color[]; emissives: THREE.Color[] }>();
  const all = new Set<THREE.Material>();
  art.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.Material;
    all.add(material);
    const key = materialKey(material);
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material, geos: [], colours: [], emissives: [] }));
    b.geos.push(bakedGeometry(mesh));
    b.colours.push((material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1));
    b.emissives.push(emissiveOf(material));
    mesh.geometry.dispose();
  });
  const box = new THREE.Box3().setFromObject(art);
  const body = new THREE.Group();
  body.name = 'guest_avatar_pilot';
  const used = new Set<THREE.Material>();
  for (const b of buckets.values()) {
    const material = colourMerge(b.material, b.geos, b.colours, b.emissives);
    const merged = mergeGeometries(b.geos, false)!;
    for (const g of b.geos) g.dispose();
    body.add(new THREE.Mesh(merged, material));
    used.add(material);
  }
  for (const m of all) if (!used.has(m)) m.dispose();
  body.rotation.y = Math.PI;
  body.scale.setScalar(height / box.max.y);
  const g = new THREE.Group();
  g.add(body);
  return g;
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
  /**
   * ChatGPT's opt-in blackjack table preview (VA-0054): the elliptical felt table with its chip
   * rack replaces the round table's art in the same place. Seats, dealer spot and table logic stay
   * as they are; layout.ts adds collision for its wider ends.
   */
  blackjackHero?: boolean;
  /**
   * ChatGPT's opt-in woven carpet preview (VA-0058). It takes the pass-05 pilot carpet's place
   * (same footprint and height) instead of lying over it: both sit at y 0.024, so an overlay
   * would z-fight. Needs the pilot, and a canvas (a browser's, or `carpetCanvas`).
   */
  wovenCarpet?: boolean;
  /** Canvas for the woven carpet's texture where there is no `document` (tests). */
  carpetCanvas?: unknown;
  /**
   * The floor to compose. The grand hall preview (VA-0064) is composed by grandHall.ts from its
   * layout instead of the salon's art world; the pass-05, hero-table and carpet swaps don't apply.
   */
  layout?: FloorLayout;
  /**
   * Prototype switch (Joshua, 2026-11-17): every machine becomes a pair of ChatGPT's Svelte 01
   * cabinets (svelteFloor.ts), before batching. The end caps are added by world.ts.
   */
  svelteMachines?: boolean;
  /** With svelteMachines: only the nearest cabinets in full detail, the rest ChatGPT's far LOD. */
  svelteLod?: boolean;
  /** With svelteLod: add ChatGPT's mid-LOD cabinet between near and far (VA-0174). */
  svelteMidLod?: boolean;
  /** With svelteMachines: continuous banks with a stool at every machine (VA-0160), planned by world.ts. */
  svelteBanks?: BankPlan;
  /** With svelteLod and banks: ChatGPT's far stool (VA-0205) instead of the trimmed authored one; dev opt-in. */
  artFarStool?: boolean;
  /** With svelteLod: ChatGPT's slim cabinet shell (VA-0216) as the near level instead of the full Svelte cabinet; dev opt-in. */
  slimNear?: boolean;
  /** With svelteLod: ChatGPT's slim family at every distance (near shell + 4530e71 mid/far LOD, VA-0226); dev opt-in. */
  slimLod?: boolean;
  /** Grand hall only: its own ceiling, or ChatGPT's gold coffers and chandeliers (VA-0175). */
  ceiling?: CeilingStyle;
  /** Grand hall only: give the end-wall heroes a lighter far twin (VA-0305; see ArtScene.heroLod). */
  heroLod?: boolean;
  /** With heroLod: ChatGPT's far hero cabinet as a third level beyond HERO_LOD_FAR_M (VA-0330); dev opt-in. */
  heroFar?: boolean;
  /** With `heroFar`: the far twins show the study's per-theme accent bands (`?herofar=accent`). */
  heroFarAccent?: boolean;
}

const PILOT_CARPET = 'gaming_floor_patterned_woven_carpet';

/** Swaps the pilot carpet for the woven carpet (VA-0058), before batching. */
function applyWovenCarpet(art: THREE.Group, canvas?: unknown): boolean {
  const old = art.getObjectByName(PILOT_CARPET) as THREE.Mesh | undefined;
  if (!old?.isMesh || !old.parent) return false;
  if (!canvas && typeof document === 'undefined') return false;
  const { width, height } = (old.geometry as THREE.PlaneGeometry).parameters;
  const carpet = makeVelvetPatternCarpet(THREE, { width, depth: height, x: old.position.x, y: old.position.y, z: old.position.z, canvas }) as THREE.Mesh;
  old.parent.add(carpet);
  old.removeFromParent();
  const m = old.material as THREE.MeshStandardMaterial;
  m.map?.dispose();
  m.dispose();
  old.geometry.dispose();
  return true;
}

/** Swaps the round blackjack table's art for the hero table (VA-0054), before batching. */
function applyBlackjackHero(art: THREE.Group): boolean {
  const old = art.getObjectByName('VelvetBlackjackTable');
  if (!old?.parent) return false;
  const hero = makeVelvetBlackjackHero(THREE) as THREE.Group;
  hero.position.copy(old.position);
  hero.rotation.copy(old.rotation);
  old.parent.add(hero);
  old.removeFromParent();
  old.traverse((q) => (q as THREE.Mesh).geometry?.dispose());
  return true;
}

/**
 * Workaround for an art bug (VA-0048, reported on the board): the hero's BONUS sign face sits
 * about 0.5 mm behind the front of the dark header glass it is mounted on (that glass's bevel
 * adds 9 mm), so the glass hides the sign. If the sign's front is not clear of the glass, move
 * the sign forward along the display's own normal until it stands 2 mm proud. Art files stay
 * unchanged; once the art puts the sign in front, this does nothing.
 */
export function liftHeroSignClear(hero: THREE.Object3D): number {
  const sign = hero.getObjectByName('bonus_header_world_texture_target') as THREE.Mesh | undefined;
  const glass = hero.getObjectByName('bonus_header_dark_screen') as THREE.Mesh | undefined;
  if (!sign?.isMesh || !glass?.isMesh || sign.parent !== glass.parent) return 0;
  const front = (m: THREE.Mesh) => {
    m.geometry.computeBoundingBox();
    return m.position.z + m.geometry.boundingBox!.max.z * m.scale.z;
  };
  const lift = front(glass) + 0.002 - front(sign);
  if (lift <= 0) return 0;
  sign.position.z += lift;
  return lift;
}

/** Swaps the pass-05 pilot into the composed world, before batching. */
function applyPilot05(art: THREE.Group): { heroTextures: THREE.Texture[]; heroSignLift: number } {
  const heroTextures: THREE.Texture[] = [];
  let heroSignLift = 0;
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
    const hero = makeVelvetHeroCabinet(THREE, PILOT_HERO_SLOT) as THREE.Group;
    slot.add(hero);
    heroSignLift = liftHeroSignClear(hero);
    heroTextures.push(...[hero.userData.createdTitleTexture, hero.userData.createdBonusTexture].filter((t): t is THREE.Texture => !!t?.isTexture));
    // the swivel chair sits beside the hero, turned toward its screen; it stays clear of the
    // walk-up point straight in front of the machine
    // prototype builds: the table-chair choice applies here too (VA-0210); the real game keeps the luxury chair
    const velvetChair = readChairStyle() === 'velvet';
    const chair = (velvetChair ? createVelvetGamingChair(THREE) : makeVelvetLuxuryGamingChair(THREE)) as THREE.Group;
    chair.name = 'pilot_luxury_chair';
    // (layout.ts gives it a collision circle at the same spot)
    chair.position.set(PILOT_CHAIR.local.x, 0, PILOT_CHAIR.local.z);
    // the luxury chair's front is -Z, the gaming chair's +Z
    chair.rotation.y = PILOT_CHAIR.rotationY + (velvetChair ? Math.PI : 0);
    slot.add(chair);
  }
  return { heroTextures, heroSignLift };
}

export function buildArtScene(chairs: Map<string, { facing: number; x?: number; z?: number }>, opts: ArtOptions = {}): ArtScene {
  let art: THREE.Group;
  let heroTextures: THREE.Texture[] = [];
  let heroSignLift = 0;
  const chairPoses: ArtScene['chairPoses'] = new Map();
  let blackjackHero = false;
  let wovenCarpet = false;
  if (opts.layout?.hall === 'grand') {
    const grand = composeGrandHall(opts.layout, { liftSign: (h) => (heroSignLift = Math.max(heroSignLift, liftHeroSignClear(h))), carpetCanvas: opts.carpetCanvas, ceiling: opts.ceiling, heroLod: opts.heroLod && !opts.svelteMachines, heroFar: opts.heroFar, heroFarAccent: opts.heroFarAccent });
    art = grand.root;
    art.updateMatrixWorld(true);
    art.traverse((o) => {
      if (!/_chair$/.test(o.name)) return;
      const p = new THREE.Vector3();
      const q = new THREE.Quaternion();
      o.matrixWorld.decompose(p, q, new THREE.Vector3());
      chairPoses.set(o.name, { x: p.x, y: p.y, z: p.z, yaw: new THREE.Euler().setFromQuaternion(q, 'YXZ').y });
    });
    heroTextures = grand.heroTextures;
    wovenCarpet = grand.wovenCarpet;
    blackjackHero = true;
    // the grand hall turns its own chairs
    chairs = new Map();
  } else {
    art = (makeVelvetWorld(THREE) as { root: THREE.Group }).root;
    ({ heroTextures, heroSignLift } = opts.pilot05 ? applyPilot05(art) : { heroTextures: [], heroSignLift: 0 });
    blackjackHero = opts.blackjackHero ? applyBlackjackHero(art) : false;
    wovenCarpet = opts.wovenCarpet ? applyWovenCarpet(art, opts.carpetCanvas) : false;
  }
  let svelteCabinets = 0;
  let svelteLod: SvelteLod | null = null;
  if (opts.svelteMachines) {
    const ids = opts.layout?.slots.map((s) => s.id) ?? MACHINES.map((m) => m.id);
    const svelte = applySvelteMachines(art, ids, { lod: opts.svelteLod, midLod: opts.svelteMidLod, banks: opts.svelteBanks, artFarStool: opts.artFarStool, slimNear: opts.slimNear, slimLod: opts.slimLod });
    svelteLod = svelte.lod;
    heroTextures = [...heroTextures, ...svelte.textures];
    svelteCabinets = svelte.cabinets;
  }
  // prototype builds: the salon's table chairs become Claude's gaming chair too (VA-0210), one shared
  // template; it faces the table centre (front +Z) instead of the old chair's facing convention
  const velvetTable = chairs.size > 0 && readChairStyle() === 'velvet' ? (createVelvetGamingChair(THREE) as THREE.Group) : null;
  for (const [id, c] of chairs) {
    let chair = art.getObjectByName(`${id}_chair`);
    if (!chair) continue;
    if (velvetTable && chair.parent) {
      const swap = velvetTable.clone();
      swap.name = chair.name;
      swap.position.copy(chair.position);
      chair.parent.add(swap);
      chair.removeFromParent();
      chair.traverse((q) => (q as THREE.Mesh).geometry?.dispose());
      chair = swap;
      const x = c.x ?? chair.position.x;
      const z = c.z ?? chair.position.z;
      chair.position.set(x, 0, z);
      chair.rotation.y = Math.atan2(TABLE.x - x, TABLE.z - z);
      chairPoses.set(chair.name, { x, y: 0, z, yaw: chair.rotation.y });
      continue;
    }
    chair.rotation.y = c.facing;
    // the hero table's seat anchors move the chair; the art's soft contact-shadow decal stays put
    if (c.x !== undefined && c.z !== undefined) chair.position.set(c.x, chair.position.y, c.z);
  }
  art.updateMatrixWorld(true);

  const wpLod = new THREE.Vector3();
  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; colours: THREE.Color[]; emissives: THREE.Color[]; names: string[]; cabinets: string[]; side: Side; part: string | null; shared: boolean; renderOrder: number; glow: boolean; fade: string | null; lod: string | null }>();
  const lodCentres: { x: number; z: number }[] = [];
  let hasFar = false;
  art.traverse((o) => {
    if (o.userData.heroLod === 'far') hasFar = true;
    if (o.userData.heroLod !== 'full') return;
    o.getWorldPosition(wpLod);
    lodCentres.push({ x: wpLod.x, z: wpLod.z });
  });
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
    const cabinet = part ? (cabinetOf(mesh) ?? (part === 'reels' ? copyCabinetOf(mesh) : null)) : null;
    // glow-tagged pieces (art's `userData.glow`, VA-0042) batch apart from unlit ones, so the
    // batched mesh can carry the tag for the bloom pass
    const glow = mesh.userData.glow === true;
    const fade = part ? null : fadeGroupOf(mesh);
    const lod = part || fade ? null : heroLodOf(mesh);
    // with the hero LOD on, the north side-wall copies (beside the heroes) go into both hero sets
    // (VA-0305), so each set stays one batch per material; the south copies batch on their own
    // (VA-0316) so the hero sets end mid-hall and either half can be culled when behind the camera
    const copyLod = lodCentres.length && !part && !fade && !side && copyCabinetOf(mesh);
    const farAll = hasFar ? ['farAll'] : [];
    const lods: (string | null)[] = lod ? (lod === 'lite' ? ['lite', 'liteAll'] : lod === 'far' ? ['far', 'farAll'] : [lod]) : copyLod ? (wp.z > 0 ? ['south', 'liteAll', ...farAll] : ['full', 'lite', 'liteAll', ...(hasFar ? ['far', 'farAll'] : [])]) : [null];
    // merging needs one layout: unindexed, with position / normal / uv only
    const src = mesh.geometry;
    // an instanced mesh (the hero table's chip stacks) becomes one piece per instance
    const pieces = bakedPieces(mesh);
    lods.forEach((l, li) => {
      // the cabinets' spin buttons share one batch per material (VA-0327); reels and marquees stay per cabinet
      const shared = !!cabinet && part === SHARED_PART;
      const key = shared ? `slots/${part}#${glow ? 'glow#' : ''}${materialKey(material)}` : part && cabinet ? `${cabinet}/${part}` : `${fade ? `fade:${fade}` : l ? `lod:${l}` : (side ?? '')}#${glow ? 'glow#' : ''}${materialKey(material)}`;
      let b = buckets.get(key);
      if (!b) {
        b = { material, geos: [], colours: [], emissives: [], names: [], cabinets: [], side, part: part && cabinet ? part : null, shared, renderOrder: 0, glow: false, fade, lod: l };
        buckets.set(key, b);
      }
      for (const g of pieces) {
        b.geos.push(li === 0 ? g : g.clone());
        b.colours.push((material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1));
        b.emissives.push(emissiveOf(material));
        b.names.push(mesh.name);
        b.cabinets.push(cabinet ?? '');
      }
      if (glow) b.glow = true;
      // e.g. the contact-shadow decals draw after the floor
      b.renderOrder = Math.max(b.renderOrder, mesh.renderOrder);
    });
    src.dispose();
  });
  
  const root = new THREE.Group();
  root.name = 'VelvetAce_ArtBatched';
  const walls: Record<WallSide, THREE.Mesh[]> = { north: [], east: [], west: [] };
  const ceiling: Record<CeilingPart, THREE.Mesh[]> = { roof: [], fixtures: [], entrance: [] };
  const interactive = new Map<string, THREE.Mesh>();
  const reelCopies = new Map<string, THREE.Mesh>();
  const exterior: THREE.Mesh[] = [];
  const fadeable = new Map<string, THREE.Mesh[]>();
  const heroLod: ArtScene['heroLod'] = lodCentres.length ? { full: [], lite: [], south: [], liteAll: [], far: [], farAll: [], centres: lodCentres } : null;
  const boxCull: ArtScene['boxCull'] = [];
  let colourBatches = 0;
  // whole-view batches (VA-0052): buckets that differ only by wall / ceiling side, per material
  const sideless = (key: string) => key.slice(key.indexOf('#'));
  const byMaterial = new Map<string, string[]>();
  for (const [key, b] of buckets) {
    if (b.part || b.fade || b.lod || b.side === 'exterior') continue;
    const list = byMaterial.get(sideless(key)) ?? [];
    list.push(key);
    byMaterial.set(sideless(key), list);
  }
  const whole: ArtScene['whole'] = { combined: [], replaced: [] };
  const replacedKeys = new Set<string>();
  for (const [mkey, keys] of byMaterial) {
    if (keys.length < 2 || !keys.some((k) => buckets.get(k)!.side)) continue;
    const parts = keys.map((k) => buckets.get(k)!);
    const geos = parts.flatMap((b) => b.geos.map((g) => g.clone()));
    const material = colourMerge(parts[0].material, geos, parts.flatMap((b) => b.colours), parts.flatMap((b) => b.emissives));
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) throw new Error(`could not batch art group ${mkey}`);
    const mesh = new THREE.Mesh(merged, material === parts[0].material ? material.clone() : material);
    mesh.name = `art:whole${mkey}`;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = Math.max(...parts.map((b) => b.renderOrder));
    if (parts.some((b) => b.glow)) mesh.userData.glow = true;
    mesh.visible = false;
    whole.combined.push(mesh);
    for (const k of keys) replacedKeys.add(k);
  }
  for (const [key, b] of buckets) {
    let material = b.part && !b.shared ? b.material : colourMerge(b.material, b.geos, b.colours, b.emissives);
    if (material !== b.material) colourBatches++;
    // a fading batch gets its own copy of the material (the same values), so its opacity is its own
    else if (b.fade) material = b.material.clone();
    // each cabinet's vertex range in a shared batch, before the pieces are merged and disposed
    const ranges: Record<string, [number, number]> = {};
    if (b.shared) {
      let first = 0;
      b.geos.forEach((g, i) => {
        const n = g.attributes.position.count;
        const r = ranges[b.cabinets[i]];
        if (r) r[1] = first + n - r[0];
        else ranges[b.cabinets[i]] = [first, n];
        first += n;
      });
    }
    // interactive parts keep a geometry group per original mesh (groups[i] is names[i]); a shared
    // batch has none (each group would be a draw call of its own)
    const merged = mergeGeometries(b.geos, !!b.part && !b.shared);
    for (const g of b.geos) g.dispose();
    if (!merged) throw new Error(`could not batch art group ${key}`);
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = b.part ? key : `art:${key}`;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = b.renderOrder;
    root.add(mesh);
    if (replacedKeys.has(key)) whole.replaced.push(mesh);
    if (b.glow) mesh.userData.glow = true;
    if (b.shared) {
      mesh.userData.parts = b.names;
      mesh.userData.ranges = ranges;
      for (const c of Object.keys(ranges)) interactive.set(`${c}/${b.part}`, mesh);
    } else if (b.part) {
      mesh.userData.parts = b.names;
      if (key.startsWith('slotcopy_')) reelCopies.set(key.slice('slotcopy_'.length, -'/reels'.length), mesh);
      else interactive.set(key, mesh);
    }
    if (b.lod && b.lod !== 'liteAll' && b.lod !== 'farAll') {
      // batches are baked in world space and never move
      merged.computeBoundingBox();
      boxCull.push({ mesh, box: merged.boundingBox!.clone() });
    }
    if (heroLod && b.lod === 'full') heroLod.full.push(mesh);
    else if (heroLod && (b.lod === 'lite' || b.lod === 'liteAll' || b.lod === 'far' || b.lod === 'farAll')) {
      mesh.visible = false;
      heroLod[b.lod].push(mesh);
    } else if (heroLod && b.lod === 'south') heroLod.south.push(mesh);
    if (b.fade) {
      const list = fadeable.get(b.fade) ?? [];
      list.push(mesh);
      fadeable.set(b.fade, list);
    }
    if (b.side === 'exterior') {
      mesh.visible = false;
      exterior.push(mesh);
    } else if (b.side && CEILING_PARTS.includes(b.side)) ceiling[b.side as CeilingPart].push(mesh);
    else if (b.side) walls[b.side as WallSide].push(mesh);
  }
  for (const m of whole.combined) root.add(m);
  // materials no batch draws with (merged duplicates, and the originals of colour batches)
  const drawn = new Set(root.children.map((m) => (m as THREE.Mesh).material as THREE.Material));
  for (const m of allMaterials) if (!drawn.has(m)) m.dispose();
  if (svelteLod) root.add(svelteLod.root);
  return { root, walls, ceiling, interactive, reelCopies, exterior, fadeable, heroTextures, chairPoses, heroSignLift, blackjackHero, wovenCarpet, svelteCabinets, svelteLod, whole, heroLod, boxCull, meshesAuthored, batches: buckets.size, colourBatches };
}
