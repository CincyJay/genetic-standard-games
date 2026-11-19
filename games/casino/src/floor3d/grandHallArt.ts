/**
 * The grand hall preview (VA-0064): composes ChatGPT's art into the larger floor that
 * layout.ts describes, for artScene.ts to batch like the salon. Engineering only: art modules
 * are used as authored and only placed, turned and copied here.
 *
 * - ChatGPT's grand hall architecture (VA-0065, `8a874c9`): promenade, side walls, coffered
 *   ceiling, colonnade and ring chandeliers, built at the layout's size (grandHall.ts uses the
 *   same spec for collision).
 * - Blackjack hero tables (VA-0054), each with two of the pilot swivel chairs.
 * - One hero cabinet per theme on the far end wall: these are the interactive `slot_<id>`
 *   machines (reels, spin button, marquee). The side-wall banks are copies of them that share
 *   their geometry, materials and canvas textures, so they batch with them.
 * - ChatGPT's woven carpet over the whole floor (a plain floor in tests, where there is no canvas).
 *
 * - ChatGPT's endcaps (VA-0071, `80928f5`): the far end wall behind the back row, and the entrance
 *   frame with an opening as wide as the promenade.
 */
import * as THREE from 'three';
import { createGrandHallArchitecture } from '../../../../art/casino/3d/grandHallArchitecture.mjs';
import { createGrandHallEndcaps } from '../../../../art/casino/3d/grandHallEndcaps.mjs';
import { makeVelvetHeroCabinet } from '../../../../art/casino/3d/heroSlotCabinet.mjs';
import { makeVelvetLuxuryGamingChair } from '../../../../art/casino/3d/luxuryGamingChair.mjs';
import { createVelvetGamingChairLod } from '../../../../art/casino/3d/velvetGamingChairLod.mjs';
import { makeVelvetBlackjackHero } from '../../../../art/casino/3d/blackjackHero.mjs';
import { makeVelvetPatternCarpet } from '../../../../art/casino/3d/patternCarpet.mjs';
import { createVelvetCofferedCeiling } from '../../../../art/casino/3d/velvetCofferedCeiling.mjs';
import { BLACKJACK_HERO_ANCHORS, type FloorLayout, type TablePlacement } from './layout.ts';

/** How far each endcap sits outside the hall's ends, in metres. */
export const ENDCAP_RECESS = 0.15;

/** The grand hall's ceiling: the architecture's own (VA-0065), or ChatGPT's gold coffers and chandeliers (VA-0175). */
export type CeilingStyle = 'hall' | 'gold-coffers';
export const CEILING_STORAGE_KEY = 'va3d.ceiling';
export const NEXT_CEILING_STYLE: Record<CeilingStyle, CeilingStyle> = { hall: 'gold-coffers', 'gold-coffers': 'hall' };
/** The stored ceiling style. Gold coffers are the default (Joshua, VA-0197); only a stored 'hall' keeps the hall's own. */
export function readCeilingStyle(): CeilingStyle {
  try {
    return localStorage.getItem(CEILING_STORAGE_KEY) === 'hall' ? 'hall' : 'gold-coffers';
  } catch {
    return 'gold-coffers';
  }
}
/**
 * The architecture pieces the gold-coffer ceiling replaces: its slab, coffers, beams and ring
 * chandeliers, plus the warm cove strips (VA-0179), which were mounted against that slab and hung
 * under the gold beams with nothing behind them once it was gone.
 */
export const REPLACED_BY_GOLD_COFFERS = /^(ceiling-base|coffer-.*|suspended-ring-chandelier|chandelier-suspension|warm-cove-strip)$/;
/** Chandeliers down the promenade (the art spaces them at most 5 m apart, centred). */
export const GOLD_COFFER_CHANDELIERS = 4;

/**
 * ChatGPT's coffered ceiling (c5650b9, axis option from 0df6da7) at the hall's size: hall-width
 * across X, hall-length along Z, with `axis: 'z'` so its chandeliers hang in a line down the
 * promenade without the old host quarter-turn. Built 0.1 m under the hall height, its overhead
 * plane sits where the architecture's slab was centred. The diffuser glow is the art's default.
 */
export function goldCofferCeiling(spec: { width: number; length: number; height: number }, sideTrimInset = readCofferSideInset()): THREE.Group {
  return createVelvetCofferedCeiling(THREE, {
    width: spec.width, depth: spec.length, height: spec.height - 0.1, chandeliers: GOLD_COFFER_CHANDELIERS, axis: 'z', sideTrimInset,
  }) as THREE.Group;
}

/**
 * The art's `sideTrimInset` (c98da18, VA-0183): how far the side rails of the perimeter frame
 * widen inboard from the coffer beam, in metres. ChatGPT asked not to enable it by default
 * without visual evidence, so it is 0 (the art's default) unless a dev or prototype build is
 * opened with `?coffertrim=<metres>` for a side-by-side comparison. Out-of-range values (the
 * art accepts 0 to 0.35) fall back to 0 rather than throwing.
 */
export function cofferSideInsetFrom(search: string): number {
  const raw = new URLSearchParams(search).get('coffertrim');
  if (raw === null || raw.trim() === '') return 0;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 0.35 ? v : 0;
}

function readCofferSideInset(): number {
  if (typeof location === 'undefined') return 0;
  if (!(import.meta.env?.DEV || import.meta.env?.MODE === 'proto')) return 0;
  return cofferSideInsetFrom(location.search);
}

export interface GrandHallArt {
  root: THREE.Group;
  heroes: THREE.Object3D[];
  heroTextures: THREE.Texture[];
  wovenCarpet: boolean;
}

export type ChairStyle = 'luxury' | 'lod-mid' | 'lod-near';

/**
 * Which chair the grand hall's tables get. The default stays the luxury study chair (about 10.3k
 * triangles each). ChatGPT's upholstered LOD chair (3540a74, VA-0185; rails and curved crest
 * revised in 38aba98, VA-0187; tube side rails in 336a41b, VA-0189: 732 triangles at 'mid', 984 at 'near') is opt-in for dev and prototype builds with `?chair=lod` (mid) or `?chair=lod-near`,
 * for comparison before anyone decides on it. Anything else is the default.
 */
export function chairStyleFrom(search: string): ChairStyle {
  const raw = new URLSearchParams(search).get('chair');
  if (raw === 'lod' || raw === 'lod-mid') return 'lod-mid';
  if (raw === 'lod-near') return 'lod-near';
  return 'luxury';
}

export type MachineDetail = 'lite' | 'full';

/**
 * How finely the grand hall's side-wall machine copies are tessellated (engineering LOD, not an art
 * change). ChatGPT's hero cabinet is about 13.6k triangles, mostly rounded-rect extrusions
 * (curveSegments 7, 2 bevel segments: 380 tris each), tubes and spheres; 28 copies of it were
 * ~380k of the hall's ~640k triangles (VA-0196). 'lite' (the default) rebuilds the copies'
 * extrusions, tubes and spheres from their own parameters with fewer segments: the same shapes,
 * sizes, positions and materials, rounder corners drawn with fewer facets. The ten interactive
 * heroes on the end wall and every box (reels included) are untouched. `?machines=full` keeps the
 * copies at full detail for comparison in dev and prototype builds.
 */
export function machineDetailFrom(search: string): MachineDetail {
  return new URLSearchParams(search).get('machines') === 'full' ? 'full' : 'lite';
}

function readMachineDetail(): MachineDetail {
  if (typeof location === 'undefined') return 'lite';
  if (!(import.meta.env?.DEV || import.meta.env?.MODE === 'proto')) return 'lite';
  return machineDetailFrom(location.search);
}

/** A lower-tessellation rebuild of one art geometry, or null to share the original (boxes, planes, reels). */
export function liteGeometry(g: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const p = (g as THREE.BufferGeometry & { parameters?: Record<string, unknown> }).parameters;
  if (!p) return null;
  if (g.type === 'ExtrudeGeometry') {
    const o = (p.options ?? {}) as THREE.ExtrudeGeometryOptions;
    if ((o.curveSegments ?? 12) <= 2 && (o.bevelSegments ?? 3) <= 1) return null;
    return new THREE.ExtrudeGeometry(p.shapes as THREE.Shape | THREE.Shape[], { ...o, curveSegments: Math.min(o.curveSegments ?? 12, 2), bevelSegments: Math.min(o.bevelSegments ?? 3, 1) });
  }
  if (g.type === 'TubeGeometry') {
    const t = p as { path: THREE.Curve<THREE.Vector3>; tubularSegments: number; radius: number; radialSegments: number; closed: boolean };
    return new THREE.TubeGeometry(t.path, Math.max(4, Math.ceil(t.tubularSegments / 2)), t.radius, Math.max(3, Math.min(t.radialSegments, 4)), t.closed);
  }
  if (g.type === 'SphereGeometry') {
    const s = p as { radius: number; widthSegments: number; heightSegments: number; phiStart: number; phiLength: number; thetaStart: number; thetaLength: number };
    if (s.widthSegments <= 6 && s.heightSegments <= 4) return null;
    return new THREE.SphereGeometry(s.radius, Math.min(s.widthSegments, 6), Math.min(s.heightSegments, 4), s.phiStart, s.phiLength, s.thetaStart, s.thetaLength);
  }
  return null;
}

/**
 * A clone of a hero cabinet for a far side-wall copy, its curved geometry rebuilt with fewer
 * segments. `cache` (by source geometry uuid) makes every copy of a theme share one set of lite
 * geometry, so they still batch together. Materials, textures and boxes are shared as in clone().
 */
export function liteCabinet(src: THREE.Object3D, cache: Map<string, THREE.BufferGeometry>): THREE.Object3D {
  const copy = src.clone();
  copy.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
    let lite = cache.get(m.geometry.uuid);
    if (!lite) {
      lite = liteGeometry(m.geometry) ?? m.geometry;
      cache.set(m.geometry.uuid, lite);
    }
    m.geometry = lite;
  });
  return copy;
}

export const CHAIR_STORAGE_KEY = 'va3d.chair';
export const NEXT_CHAIR_STYLE: Record<ChairStyle, ChairStyle> = { luxury: 'lod-mid', 'lod-mid': 'lod-near', 'lod-near': 'luxury' };
/** A `?chair=` parameter wins; otherwise the ⚙ button's stored choice (VA-0207), so a phone can compare. */
export function readChairStyle(): ChairStyle {
  if (typeof location === 'undefined') return 'luxury';
  if (!(import.meta.env?.DEV || import.meta.env?.MODE === 'proto')) return 'luxury';
  if (new URLSearchParams(location.search).has('chair')) return chairStyleFrom(location.search);
  try {
    return chairStyleFrom(`?chair=${localStorage.getItem(CHAIR_STORAGE_KEY) ?? ''}`);
  } catch {
    return 'luxury';
  }
}

/**
 * Turn a chair at (x, z) to face (tx, tz). Both chairs declare their front in userData.forward:
 * the luxury chair's is '-Z' (VA-0190: it was placed as if +Z, so every default grand-hall chair
 * faced away from its table), the LOD chair's is -Z too (userData.front). A -Z front gets a half
 * turn from the +Z heading. LOD chairs are clones of one template, sharing its geometries and
 * materials so they batch.
 */
export function chairAt(name: string, x: number, z: number, tx: number, tz: number, style: ChairStyle = 'luxury', lodTemplates?: Map<ChairStyle, THREE.Group>): THREE.Group {
  let chair: THREE.Group;
  if (style === 'luxury') {
    chair = makeVelvetLuxuryGamingChair(THREE) as THREE.Group;
  } else {
    let tpl = lodTemplates?.get(style);
    if (!tpl) {
      tpl = createVelvetGamingChairLod(THREE, { detail: style === 'lod-near' ? 'near' : 'mid' }) as THREE.Group;
      lodTemplates?.set(style, tpl);
    }
    chair = tpl.clone();
  }
  const fwd = String(chair.userData.forward ?? chair.userData.front ?? '-Z').toUpperCase();
  const turn = fwd === '+Z' || fwd === 'Z' ? 0 : Math.PI;
  chair.name = name;
  chair.position.set(x, 0, z);
  chair.rotation.y = Math.atan2(tx - x, tz - z) + turn;
  return chair;
}

function tableWithChairs(t: TablePlacement, chairNames: [string, string], style: ChairStyle, lodTemplates: Map<ChairStyle, THREE.Group>): THREE.Group {
  const g = new THREE.Group();
  const table = makeVelvetBlackjackHero(THREE) as THREE.Group;
  table.position.set(t.x, 0, t.z);
  g.add(table);
  Object.values(BLACKJACK_HERO_ANCHORS.seats).forEach((a, i) => g.add(chairAt(chairNames[i], t.x + a.position[0], t.z + a.position[1], t.x, t.z, style, lodTemplates)));
  return g;
}

export function composeGrandHall(
  layout: FloorLayout,
  opts: { liftSign: (hero: THREE.Object3D) => number; carpetCanvas?: unknown; ceiling?: CeilingStyle; chairStyle?: ChairStyle; machineDetail?: MachineDetail },
): GrandHallArt {
  const root = new THREE.Group();
  root.name = 'VelvetAce_GrandHallPreview';
  const spec = layout.hallSpec ?? { width: 24, length: 36, height: 7.2, aisleWidth: 7.5, bayLength: 4 };
  // the whole hall's floor, wall to wall and end to end (the walkable room is smaller)
  const w = spec.width;
  const d = spec.length;
  const cx = 0;
  const cz = 0;

  // floor: ChatGPT's woven carpet, sized to the hall
  let wovenCarpet = false;
  if (opts.carpetCanvas || typeof document !== 'undefined') {
    // below the architecture's stone promenade (top at 0.0225), so the walkway shows through
    root.add(makeVelvetPatternCarpet(THREE, { width: w, depth: d, x: cx, y: 0.012, z: cz, canvas: opts.carpetCanvas }) as THREE.Mesh);
    wovenCarpet = true;
  } else {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2b1b2c, roughness: 0.9 }));
    floor.name = 'grand_floor_placeholder';
    floor.position.set(cx, 0.012, cz);
    root.add(floor);
  }

  // ChatGPT's architecture at the layout's size
  const architecture = createGrandHallArchitecture(THREE, spec) as THREE.Group;
  if (opts.ceiling === 'gold-coffers') {
    // the architecture's ceiling and its cove strips give way to the gold coffers; walls, crown and colonnade stay
    const drop: THREE.Object3D[] = [];
    architecture.traverse((o) => {
      if (o !== architecture && REPLACED_BY_GOLD_COFFERS.test(o.name)) drop.push(o);
    });
    for (const o of drop) o.removeFromParent();
    root.add(goldCofferCeiling(spec));
  }
  root.add(architecture);
  // ChatGPT's end wall and entrance frame (VA-0071). The back row is at -Z, so rearZ is negative.
  // Given 0.3 m more length, both ends sit 0.15 m outside the hall: the rear pilasters clear the
  // back-row cabinets, and the entrance piers stay just past the walkable room's +Z edge. The
  // opening matches the promenade.
  root.add(createGrandHallEndcaps(THREE, {
    width: w, length: d + ENDCAP_RECESS * 2, height: spec.height, entranceWidth: spec.aisleWidth, rearZ: 'negative',
  }) as THREE.Group);

  // tables: the interactive one's chairs are the seats' (named like the salon's), the rest decor
  const chairStyle = opts.chairStyle ?? readChairStyle();
  const lodTemplates = new Map<ChairStyle, THREE.Group>();
  root.add(tableWithChairs(layout.table, ['blackjack_1_chair', 'blackjack_2_chair'], chairStyle, lodTemplates));
  layout.decor.tables.forEach((t, i) => root.add(tableWithChairs(t, [`deco_${i + 1}a_chair`, `deco_${i + 1}b_chair`], chairStyle, lodTemplates)));

  // machines: one hero per theme, interactive, on the end wall; then copies along the side walls
  const machineDetail = opts.machineDetail ?? readMachineDetail();
  const liteGeos = new Map<string, THREE.BufferGeometry>();
  const heroes: THREE.Object3D[] = [];
  const heroTextures: THREE.Texture[] = [];
  const byTheme = new Map<string, THREE.Group>();
  for (const s of layout.slots) {
    const slot = new THREE.Group();
    slot.name = `slot_${s.id}`;
    slot.position.set(s.x, 0, s.z);
    slot.rotation.y = s.rotationY;
    const hero = makeVelvetHeroCabinet(THREE, s.id) as THREE.Group;
    opts.liftSign(hero);
    heroTextures.push(...[hero.userData.createdTitleTexture, hero.userData.createdBonusTexture].filter((t): t is THREE.Texture => !!t?.isTexture));
    slot.add(hero);
    root.add(slot);
    heroes.push(hero);
    byTheme.set(s.id, hero);
  }
  layout.decor.slots.forEach((s, i) => {
    const src = byTheme.get(s.id);
    if (!src) return;
    // a clone shares the source's geometry, materials and textures, so it batches with it; not
    // named slot_*, so it isn't interactive (artScene gathers its reels per theme to show symbols)
    const copy = new THREE.Group();
    copy.name = `slotcopy_${s.id}_${i + 1}`;
    copy.position.set(s.x, 0, s.z);
    copy.rotation.y = s.rotationY;
    copy.add(machineDetail === 'lite' ? liteCabinet(src, liteGeos) : src.clone());
    root.add(copy);
  });
  return { root, heroes, heroTextures, wovenCarpet };
}
