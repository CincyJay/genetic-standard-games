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
import { makeVelvetGuestAvatar } from '../../../../art/casino/3d/guestAvatar.mjs';
import { makeVelvetBlackjackHero } from '../../../../art/casino/3d/blackjackHero.mjs';
import { makeVelvetPatternCarpet } from '../../../../art/casino/3d/patternCarpet.mjs';
import { PILOT_CHAIR, PILOT_HERO_SLOT, type FloorLayout } from './layout.ts';
import { composeGrandHall } from './grandHallArt.ts';

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
  /**
   * How far (m) liftHeroSignClear had to move the BONUS sign forward; 0 once the art puts the
   * sign in front of its glass itself (b7609a7, VA-0050).
   */
  heroSignLift: number;
  /** Whether the opt-in blackjack hero table (VA-0054) replaced the round table's art. */
  blackjackHero: boolean;
  /** Whether ChatGPT's opt-in woven carpet (VA-0058) replaced the pass-05 pilot carpet. */
  wovenCarpet: boolean;
  /**
   * Batches for the view where nothing is cut away (the eye-level follow camera): each material
   * the walls or ceiling share with the rest of the room is drawn once, wall and ceiling pieces
   * included, instead of once per side (VA-0052). Show `combined` and hide `replaced` only while
   * every wall and the whole ceiling would be shown anyway; otherwise the reverse.
   */
  whole: { combined: THREE.Mesh[]; replaced: THREE.Mesh[] };
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
  // the grand concourse (VA-0062): its slab, beams and coffers are roof; its cove strips, rings
  // and stems hang below and stay as fixtures
  if (name === 'continuous-ceiling-slab' || name === 'ceiling-crossbeam' || name === 'coffer-dark-inset') return 'roof';
  if (name === 'coffer-warm-cove' || name === 'sculptural-chandelier-ring' || name === 'chandelier-stem') return 'fixtures';
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
 * Several colours in one batch: each piece carries its material's (linear) colour per vertex,
 * and the shared material's own colour is white, so the product is unchanged. Returns the
 * material to draw with (the original when every piece has the same colour).
 */
function colourMerge(material: THREE.Material, geos: THREE.BufferGeometry[], colours: THREE.Color[]): THREE.Material {
  if (colours.every((c) => c.equals(colours[0]))) return material;
  geos.forEach((g, i) => {
    const c = colours[i];
    const n = g.attributes.position.count;
    const rgb = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) rgb.set([c.r, c.g, c.b], v * 3);
    g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  });
  const merged = material.clone();
  (merged as THREE.MeshStandardMaterial).color.setRGB(1, 1, 1);
  merged.vertexColors = true;
  return merged;
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
  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; colours: THREE.Color[] }>();
  const all = new Set<THREE.Material>();
  art.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as THREE.Material;
    all.add(material);
    const key = materialKey(material);
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { material, geos: [], colours: [] }));
    b.geos.push(bakedGeometry(mesh));
    b.colours.push((material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1));
    mesh.geometry.dispose();
  });
  const box = new THREE.Box3().setFromObject(art);
  const body = new THREE.Group();
  body.name = 'guest_avatar_pilot';
  const used = new Set<THREE.Material>();
  for (const b of buckets.values()) {
    const material = colourMerge(b.material, b.geos, b.colours);
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
    const chair = makeVelvetLuxuryGamingChair(THREE) as THREE.Group;
    chair.name = 'pilot_luxury_chair';
    // (layout.ts gives it a collision circle at the same spot)
    chair.position.set(PILOT_CHAIR.local.x, 0, PILOT_CHAIR.local.z);
    chair.rotation.y = PILOT_CHAIR.rotationY;
    slot.add(chair);
  }
  return { heroTextures, heroSignLift };
}

export function buildArtScene(chairs: Map<string, { facing: number; x?: number; z?: number }>, opts: ArtOptions = {}): ArtScene {
  let art: THREE.Group;
  let heroTextures: THREE.Texture[] = [];
  let heroSignLift = 0;
  let blackjackHero = false;
  let wovenCarpet = false;
  if (opts.layout?.hall === 'grand') {
    const grand = composeGrandHall(opts.layout, { liftSign: (h) => (heroSignLift = Math.max(heroSignLift, liftHeroSignClear(h))), carpetCanvas: opts.carpetCanvas });
    art = grand.root;
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
  for (const [id, c] of chairs) {
    const chair = art.getObjectByName(`${id}_chair`);
    if (!chair) continue;
    chair.rotation.y = c.facing;
    // the hero table's seat anchors move the chair; the art's soft contact-shadow decal stays put
    if (c.x !== undefined && c.z !== undefined) chair.position.set(c.x, chair.position.y, c.z);
  }
  art.updateMatrixWorld(true);

  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[]; colours: THREE.Color[]; names: string[]; side: Side; part: string | null; renderOrder: number; glow: boolean; fade: string | null }>();
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
    const key = part && cabinet ? `${cabinet}/${part}` : `${fade ? `fade:${fade}` : (side ?? '')}#${glow ? 'glow#' : ''}${materialKey(material)}`;
    let b = buckets.get(key);
    if (!b) {
      b = { material, geos: [], colours: [], names: [], side, part: part && cabinet ? part : null, renderOrder: 0, glow: false, fade };
      buckets.set(key, b);
    }
    // merging needs one layout: unindexed, with position / normal / uv only
    const src = mesh.geometry;
    // an instanced mesh (the hero table's chip stacks) becomes one piece per instance
    for (const g of bakedPieces(mesh)) {
      b.geos.push(g);
      b.colours.push((material as THREE.MeshStandardMaterial).color ?? new THREE.Color(1, 1, 1));
      b.names.push(mesh.name);
    }
    if (glow) b.glow = true;
    // e.g. the contact-shadow decals draw after the floor
    b.renderOrder = Math.max(b.renderOrder, mesh.renderOrder);
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
  let colourBatches = 0;
  // whole-view batches (VA-0052): buckets that differ only by wall / ceiling side, per material
  const sideless = (key: string) => key.slice(key.indexOf('#'));
  const byMaterial = new Map<string, string[]>();
  for (const [key, b] of buckets) {
    if (b.part || b.fade || b.side === 'exterior') continue;
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
    const material = colourMerge(parts[0].material, geos, parts.flatMap((b) => b.colours));
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
    let material = b.part ? b.material : colourMerge(b.material, b.geos, b.colours);
    if (material !== b.material) colourBatches++;
    // a fading batch gets its own copy of the material (the same values), so its opacity is its own
    else if (b.fade) material = b.material.clone();
    // interactive parts keep a geometry group per original mesh (groups[i] is names[i])
    const merged = mergeGeometries(b.geos, !!b.part);
    for (const g of b.geos) g.dispose();
    if (!merged) throw new Error(`could not batch art group ${key}`);
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = b.part ? key : `art:${key}`;
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = b.renderOrder;
    root.add(mesh);
    if (replacedKeys.has(key)) whole.replaced.push(mesh);
    if (b.glow) mesh.userData.glow = true;
    if (b.part) {
      mesh.userData.parts = b.names;
      if (key.startsWith('slotcopy_')) reelCopies.set(key.slice('slotcopy_'.length, -'/reels'.length), mesh);
      else interactive.set(key, mesh);
    }
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
  return { root, walls, ceiling, interactive, reelCopies, exterior, fadeable, heroTextures, heroSignLift, blackjackHero, wovenCarpet, whole, meshesAuthored, batches: buckets.size, colourBatches };
}
