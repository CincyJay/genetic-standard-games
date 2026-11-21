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
import { makeVelvetHeroCabinet, HERO_THEMES } from '../../../../art/casino/3d/heroSlotCabinet.mjs';
import { makeVelvetLuxuryGamingChair } from '../../../../art/casino/3d/luxuryGamingChair.mjs';
import { createVelvetGamingChair } from '../../../../art/casino/3d/velvetGamingChair.mjs';
import { createVelvetGamingChairLod } from '../../../../art/casino/3d/velvetGamingChairLod.mjs';
import { createVelvetLuxuryChairLOD } from '../../../../art/casino/3d/velvetLuxuryChairLOD.mjs';
import { createVelvetTubChair } from '../../../../art/casino/3d/velvetTubChairPrototype.mjs';
import { createVelvetCasinoChair } from '../../../../art/casino/3d/velvetCasinoChair.mjs';
import { makeVelvetBlackjackHero } from '../../../../art/casino/3d/blackjackHero.mjs';
import { makeVelvetPatternCarpet } from '../../../../art/casino/3d/patternCarpet.mjs';
import { createVelvetCarpetTexture } from '../../../../art/casino/3d/velvetCarpetPattern.mjs';
import { createVelvetCofferedCeiling } from '../../../../art/casino/3d/velvetCofferedCeiling.mjs';
import { createVelvetCeilingCoffer } from '../../../../art/casino/3d/velvetCeilingCoffer.mjs';
import { createVelvetCofferBeamDiffuser } from '../../../../art/casino/3d/velvetCofferBeamDiffuser.mjs';
import { createVelvetHeroFarCabinet } from '../../../../art/casino/3d/velvetHeroFarCabinet.mjs';
import { BLACKJACK_HERO_ANCHORS, type FloorLayout, type TablePlacement } from './layout.ts';

/** How far each endcap sits outside the hall's ends, in metres. */
export const ENDCAP_RECESS = 0.15;

/**
 * The grand hall's ceiling: the architecture's own (VA-0065), ChatGPT's gold coffers and
 * chandeliers (VA-0175), or a grid of ChatGPT's dimensional coffer tiles (VA-0325, preview only).
 */
export type CeilingStyle = 'hall' | 'gold-coffers' | 'velvet-coffers';
export const CEILING_STORAGE_KEY = 'va3d.ceiling';
export const NEXT_CEILING_STYLE: Record<CeilingStyle, CeilingStyle> = { hall: 'gold-coffers', 'gold-coffers': 'velvet-coffers', 'velvet-coffers': 'hall' };
/** The stored ceiling style. Gold coffers are the default (Joshua, VA-0197); only a stored 'hall' or 'velvet-coffers' changes it. */
export function readCeilingStyle(): CeilingStyle {
  try {
    const v = localStorage.getItem(CEILING_STORAGE_KEY);
    return v === 'hall' || v === 'velvet-coffers' ? v : 'gold-coffers';
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
/**
 * The architecture pieces the coffer-tile ceiling (VA-0325) replaces: its own coffers, beams and
 * cove strips. Its slab (`ceiling-base`) stays as the backing the tiles are mounted against (5e2e896
 * closed the tile's own inset/frame slit, but the slab still backs the grid's outer edge); its ring
 * chandeliers stay too, hanging through the grid.
 */
export const REPLACED_BY_VELVET_COFFERS = /^(coffer-.*|warm-cove-strip)$/;
/** The coffer tile's nominal size (the art's default) and its height from mount point to the inset's top. */
export const VELVET_COFFER_TILE = 3.6;
export const VELVET_COFFER_RELIEF = 0.1375;
/** The architecture slab's half thickness: its underside is this far under the hall height. */
const SLAB_HALF = 0.09;

/** Split [a, b] into whole tiles of about VELVET_COFFER_TILE; returns the cut lines including a and b. */
function cuts(a: number, b: number): number[] {
  const n = Math.max(1, Math.round((b - a) / VELVET_COFFER_TILE));
  return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
}

/**
 * The coffer grid's frame lines (VA-0327 follow-up): in Z, one tile per colonnade bay, so every
 * column stands under a cross beam; in X, cut at the colonnade lines (aisle / 2 + 1.15, as the
 * art places its columns), so the columns land on frame intersections, not mid-panel. Without
 * aisle and bay it falls back to an even grid of about 3.6 m.
 */
export function velvetCofferLines(spec: { width: number; length: number; aisleWidth?: number; bayLength?: number }): { xs: number[]; zs: number[] } {
  const hw = spec.width / 2;
  const hl = spec.length / 2;
  let xs = cuts(-hw, hw);
  let zs = cuts(-hl, hl);
  if (spec.aisleWidth !== undefined && spec.bayLength !== undefined) {
    const cx = spec.aisleWidth / 2 + 1.15;
    if (cx > 1 && cx < hw - 1) xs = [...cuts(-hw, -cx), ...cuts(-cx, cx).slice(1), ...cuts(cx, hw).slice(1)];
    const bays = Math.ceil(spec.length / spec.bayLength);
    zs = Array.from({ length: bays + 1 }, (_, i) => -hl + (spec.length * i) / bays);
  }
  return { xs, zs };
}

/**
 * ChatGPT's dimensional coffer (193106d, rosettes 7945050, deeper beams 5e2e896) tiled across the
 * hall on velvetCofferLines(): 24 x 36 m with the default colonnade is 7 x 9 tiles, 3.27-3.55 m by
 * 4 m. Each tile's inset top touches the slab's underside; since 5e2e896 its frame hangs 0.47 m
 * under that (rosettes included), still above the follow camera's clamp (0.67 m under the hall
 * height). The art builds new materials per tile; artScene batches by material properties, so the
 * copies merge into one draw per material.
 */
/**
 * Diffuser edge ownership (VA-0331/0332): neighbouring tiles each lit their side of a shared beam,
 * drawing two parallel glow lines. With f88efe3's `diffuserEdges`, each tile owns its west (-x) and
 * north (-z) edges, and the last column / last row also own the hall's east / south edges, so every
 * beam (shared or perimeter) carries exactly one diffuser strip.
 */
export function cofferDiffuserEdges(i: number, j: number, tilesX: number, tilesZ: number): { n: boolean; s: boolean; e: boolean; w: boolean } {
  return { n: true, w: true, e: i === tilesX - 1, s: j === tilesZ - 1 };
}

/**
 * Coffer-tile diffuser modes: owned tile edges (default), the art's full ring, or beam-centred strips.
 * `beam` uses ChatGPT's createVelvetCofferBeamDiffuser at its own defaults (VA-0336: 0.045 m wide);
 * `beam65` is the same helper at the 0.065 m width of Claude's VA-0335 prototype, for comparison.
 */
export type CofferEdgeMode = 'owned' | 'ring' | 'beam' | 'beam65';

/** Width of the VA-0335 comparison strip (`beam65`): the two flanking tile strips (0.0325 m each) side by side. */
export const BEAM_DIFFUSER_WIDTH = 0.065;
/** Tile-local y span of a beam strip (the art helper's default: centre -0.306, 12 mm thick, 12 mm under the -0.30 soffit). */
export const BEAM_DIFFUSER_Y = { min: -0.312, max: -0.300 };
/** Perimeter beams are one tile frame wide (0.14 m); their strip is centred on that band, inboard of the wall. */
export const PERIMETER_BEAM_INSET = 0.07;

/** One strip from the art helper, taken out of its wrapper group so the engine can place and batch the mesh directly. */
function artBeamStrip(length: number, axis: 'x' | 'z', material: THREE.Material, width: number | undefined, x: number, z: number): THREE.Mesh {
  const g = createVelvetCofferBeamDiffuser(THREE, { length, axis, width, material }) as THREE.Group;
  const m = g.getObjectByName('coffer_light_diffuser_beam') as THREE.Mesh;
  g.remove(m);
  m.position.set(x, m.position.y, z);
  return m;
}

/** Strip width the art helper produces for a mode (its default when `width` is undefined). */
export function beamStripWidth(width?: number): number {
  return (createVelvetCofferBeamDiffuser(THREE, { length: 1, width }) as THREE.Group).userData.widthMetres as number;
}

/**
 * VA-0334/0336: one strip centred under each beam's soffit instead of a strip inside either tile.
 * The geometry is ChatGPT's createVelvetCofferBeamDiffuser (ad3d934); the engine owns placement and
 * trimming. Lines along Z run the whole hall (the colonnade columns stand on the intersections, so
 * the strip passes inside them); lines along X are cut into per-bay segments that stop at the Z
 * strips' edges, so intersections are never covered twice. Perimeter beams use the middle of their
 * single 0.14 m frame band. Material: one clone of the art's tile diffuser material, shared by every
 * strip, so they batch with it.
 */
export function cofferBeamStrips(xs: number[], zs: number[], material: THREE.Material, width?: number): THREE.Mesh[] {
  const w = beamStripWidth(width);
  const centre = (ls: number[], k: number) => (k === 0 ? ls[0] + PERIMETER_BEAM_INSET : k === ls.length - 1 ? ls[k] - PERIMETER_BEAM_INSET : ls[k]);
  const lx = xs.map((_, k) => centre(xs, k)), lz = zs.map((_, k) => centre(zs, k));
  const out: THREE.Mesh[] = [];
  const z0 = lz[0] - w / 2, z1 = lz[lz.length - 1] + w / 2;
  for (const x of lx) out.push(artBeamStrip(z1 - z0, 'z', material, width, x, (z0 + z1) / 2));
  for (const z of lz) for (let i = 0; i + 1 < lx.length; i++) {
    const a = lx[i] + w / 2, b = lx[i + 1] - w / 2;
    out.push(artBeamStrip(b - a, 'x', material, width, (a + b) / 2, z));
  }
  return out;
}

const NO_EDGES = { n: false, s: false, e: false, w: false };

export function velvetCofferCeiling(spec: { width: number; length: number; height: number; aisleWidth?: number; bayLength?: number }, mode: CofferEdgeMode | boolean = 'owned'): THREE.Group {
  const m: CofferEdgeMode = mode === true ? 'owned' : mode === false ? 'ring' : mode;
  const { xs, zs } = velvetCofferLines(spec);
  const root = new THREE.Group();
  root.name = 'velvet_coffer_grid';
  const y = spec.height - SLAB_HALF - VELVET_COFFER_RELIEF;
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const tw = xs[i + 1] - xs[i];
      const td = zs[j + 1] - zs[j];
      const diffuserEdges = m === 'owned' ? cofferDiffuserEdges(i, j, xs.length - 1, zs.length - 1) : m === 'beam' || m === 'beam65' ? NO_EDGES : undefined;
      const tile = createVelvetCeilingCoffer(THREE, { width: tw, depth: td, diffuserEdges }) as THREE.Group;
      tile.position.set((xs[i] + xs[i + 1]) / 2, y, (zs[j] + zs[j + 1]) / 2);
      root.add(tile);
    }
  }
  if (m === 'beam' || m === 'beam65') {
    // borrow the art's own diffuser material from a reference tile, so colour/emissive stay art-owned
    const ref = createVelvetCeilingCoffer(THREE, {}) as THREE.Group;
    const glow = ((ref.getObjectByName('coffer_light_diffuser') as THREE.Mesh).material as THREE.Material).clone();
    const beams = new THREE.Group();
    beams.name = 'coffer_beam_diffusers';
    beams.position.y = y;
    for (const s of cofferBeamStrips(xs, zs, glow, m === 'beam65' ? BEAM_DIFFUSER_WIDTH : undefined)) beams.add(s);
    root.add(beams);
  }
  root.userData = { tilesX: xs.length - 1, tilesZ: zs.length - 1, xs, zs, ownEdges: m === 'owned', edgeMode: m };
  return root;
}

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

/**
 * Coffer-tile diffuser edges (VA-0332/0334): one strip per beam (owned edges) is the default for the
 * coffer-tile preview. In a dev or prototype build `?cofferedges=ring` restores the art's full ring on
 * every tile (two parallel glow lines per shared beam), `?cofferedges=beam` draws one strip centred
 * under each beam with ChatGPT's beam diffuser helper at its 0.045 m default, and `?cofferedges=beam65`
 * the same at 0.065 m, for side-by-side comparison.
 */
export function cofferEdgeModeFrom(search: string): CofferEdgeMode {
  const v = new URLSearchParams(search).get('cofferedges');
  return v === 'ring' || v === 'beam' || v === 'beam65' ? v : 'owned';
}

/** True unless the ring is asked for (kept for older callers/tests). */
export function cofferEdgeOwnershipFrom(search: string): boolean {
  return cofferEdgeModeFrom(search) !== 'ring';
}

function readCofferEdgeMode(): CofferEdgeMode {
  if (typeof location === 'undefined') return 'owned';
  if (!(import.meta.env?.DEV || import.meta.env?.MODE === 'proto')) return 'owned';
  return cofferEdgeModeFrom(location.search);
}

/**
 * ChatGPT's woven medallion carpet texture (436ef01, VA-0234), opt-in for dev and prototype builds
 * with `?carpetart=on`. It only swaps the hall carpet's texture: same mesh, footprint, height and
 * material, so collisions and batching don't change. The default stays the damask carpet.
 */
export function carpetArtFrom(search: string): boolean {
  const v = new URLSearchParams(search).get('carpetart');
  return v === 'on' || v === 'vine' || v === 'damask2';
}

/**
 * Which motif `?carpetart` asks for. `on` keeps the original medallion texture (436ef01);
 * `vine` asks for the continuous woven-vine overlay (ca3a8ec, VA-0236) and `damask2` for the
 * interlaced damask without the medallion grid (5c65389, VA-0238), both for side-by-side comparison.
 */
export type CarpetMotif = 'medallion' | 'woven-vine' | 'interlaced-damask';
export function carpetMotifFrom(search: string): CarpetMotif {
  const v = new URLSearchParams(search).get('carpetart');
  return v === 'vine' ? 'woven-vine' : v === 'damask2' ? 'interlaced-damask' : 'medallion';
}

/** Art commit each opt-in carpet motif came from, recorded on the mesh for captures and tests. */
const CARPET_MOTIF_COMMIT: Record<CarpetMotif, string> = { medallion: '436ef01', 'woven-vine': 'ca3a8ec', 'interlaced-damask': '5c65389' };

function readCarpetMotif(): CarpetMotif {
  if (typeof location === 'undefined') return 'medallion';
  return carpetMotifFrom(location.search);
}

function readCarpetArt(): boolean {
  if (typeof location === 'undefined') return false;
  if (!(import.meta.env?.DEV || import.meta.env?.MODE === 'proto')) return false;
  return carpetArtFrom(location.search);
}

/** Texture size for `?carpetart=on`: 512² RGBA is ~1.4 MB on the GPU with mipmaps. */
export const CARPET_ART_SIZE = 512;

/**
 * Puts the woven medallion texture on an existing carpet mesh. One texture tile is 4×4 medallions;
 * the tile is kept square and the same size in metres as the damask's repeat (`userData.repeatMeters`),
 * so a medallion is a quarter of that. `makeCanvas` supplies a sized canvas (a browser's, or a test stub).
 */
export function applyCarpetArt(carpet: THREE.Mesh, width: number, depth: number, makeCanvas: (n: number) => unknown, motif: CarpetMotif = 'medallion'): boolean {
  const mat = carpet.material as THREE.MeshStandardMaterial;
  const repeatMeters = Number((carpet.userData as { repeatMeters?: number }).repeatMeters) || 3.5;
  let tex: THREE.Texture;
  try {
    tex = createVelvetCarpetTexture(THREE, { size: CARPET_ART_SIZE, createCanvas: makeCanvas, motif }) as THREE.Texture;
  } catch {
    return false;
  }
  tex.repeat.set(width / repeatMeters, depth / repeatMeters);
  mat.map?.dispose();
  mat.map = tex;
  mat.needsUpdate = true;
  carpet.userData.carpetArt = CARPET_MOTIF_COMMIT[motif];
  carpet.userData.carpetMotif = motif;
  return true;
}

export interface GrandHallArt {
  root: THREE.Group;
  heroes: THREE.Object3D[];
  heroTextures: THREE.Texture[];
  wovenCarpet: boolean;
  /** Whether `?carpetart=on` put ChatGPT's woven medallion texture (436ef01) on the hall carpet. */
  carpetArt: boolean;
  /** Which motif the opt-in texture used, when `carpetArt` is true. */
  carpetMotif: CarpetMotif | null;
}

export type ChairStyle = 'velvet' | 'luxury' | 'lod-mid' | 'lod-near' | 'swivel' | 'tub' | 'casino';

/**
 * Which chair the grand hall's tables get. The default stays the luxury study chair (about 10.3k
 * triangles each). ChatGPT's upholstered LOD chair (3540a74, VA-0185; rails and curved crest
 * revised in 38aba98, VA-0187; tube side rails in 336a41b, VA-0189: 732 triangles at 'mid', 984 at 'near') is opt-in for dev and prototype builds with `?chair=lod` (mid) or `?chair=lod-near`,
 * for comparison before anyone decides on it. ChatGPT's low-poly luxury swivel chair (31b9eb8,
 * VA-0240) is opt-in the same way with `?chair=swivel`, and its tub chair (d0c2607, VA-0246) with
 * `?chair=tub`; its upholstered office-style casino chair study (69db376, VA-0299) with `?chair=casino`.
 * Anything else is the default.
 */
export function chairStyleFrom(search: string): ChairStyle {
  const raw = new URLSearchParams(search).get('chair');
  if (raw === 'lod' || raw === 'lod-mid') return 'lod-mid';
  if (raw === 'lod-near') return 'lod-near';
  if (raw === 'velvet') return 'velvet';
  if (raw === 'swivel') return 'swivel';
  if (raw === 'tub') return 'tub';
  if (raw === 'casino') return 'casino';
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

/** The hero parts the game drives (artScene's interactive parts); a hero's far twin leaves them out. */
const HERO_DRIVEN_PART = /^(REEL_\d+_\d+_SWAP_TEXTURE|spin_button|marquee_world_texture_target)$/;

/** Within this horizontal distance (m) of any hero cabinet, the heroes draw in full detail (VA-0305). */
export const HERO_LOD_NEAR_M = 8;
/** Hysteresis so walking along the boundary doesn't flicker between the two (m). */
export const HERO_LOD_HYSTERESIS_M = 0.5;

/**
 * Whether the hero cabinets should be in full detail for a camera at (x, z): near any of the
 * `centres` (closer than HERO_LOD_NEAR_M, or a little farther if they already are).
 */
export function heroLodFull(prev: boolean, x: number, z: number, centres: readonly { x: number; z: number }[]): boolean {
  const limit = HERO_LOD_NEAR_M + (prev ? HERO_LOD_HYSTERESIS_M : -HERO_LOD_HYSTERESIS_M);
  return centres.some((c) => Math.hypot(c.x - x, c.z - z) < limit);
}

/** Beyond this distance (m) from every hero, a hero with a far twin draws it (VA-0328/0330, dev opt-in). */
export const HERO_LOD_FAR_M = 12;
export type HeroLodLevel = 'full' | 'lite' | 'far' | 'distant';

/**
 * The heroes' detail level for a camera at (x, z): 'full' within HERO_LOD_NEAR_M of any hero,
 * 'far' beyond HERO_LOD_FAR_M of all of them (only when `hasFar`), else 'lite'. Both edges have
 * HERO_LOD_HYSTERESIS_M of hysteresis around the level in `prev`.
 */
export function heroLodLevel(prev: HeroLodLevel, x: number, z: number, centres: readonly { x: number; z: number }[], hasFar: boolean, copyCentres: readonly { x: number; z: number }[] = []): HeroLodLevel {
  if (heroLodFull(prev === 'full', x, z, centres)) return 'full';
  if (!hasFar) return 'lite';
  const beyond = (cs: readonly { x: number; z: number }[], was: boolean) =>
    Math.min(...cs.map((c) => Math.hypot(c.x - x, c.z - z))) > HERO_LOD_FAR_M + (was ? -HERO_LOD_HYSTERESIS_M : HERO_LOD_HYSTERESIS_M);
  if (!beyond(centres, prev === 'far' || prev === 'distant')) return 'lite';
  // 'distant' (VA-0340, `?copyfar=on`): also beyond HERO_LOD_FAR_M of every north side-wall copy,
  // so those copies can draw the far cabinet too
  return copyCentres.length && beyond(copyCentres, prev === 'distant') ? 'distant' : 'far';
}

/**
 * ChatGPT's far hero cabinet (d48451f + d674037) fitted to a hero's envelope, minus the parts the
 * game drives. The study is 0.96 x 2.18 x 0.75 m and the hero about 1.14 x 3.17 x 1.27 m, so the
 * fit is a non-uniform placement scale (x 1.19, y 1.46, z 1.69): an engineering stand-in until the
 * art matches the hero's envelope, behind `?herofar=on` only. Its screens land on the reels' plane.
 * `accentColor` turns on the study's optional theme bands (e89e561/dcd561b, `?herofar=accent`);
 * `screenColors` + `glowAccents` are the study's per-screen palette and bloom-tagged bands
 * (908ec84/b30b85b, `?herofar=theme`); 9cf9505 makes `glowAccents` HDR (emissive 2.8) and adds
 * `screenBrightness` (0..1) to tone the palette down (`?herofar=theme&farscreen=0.55`).
 */
/** Options for the far cabinet's opt-in theme identity, passed through to ChatGPT's study unchanged. */
export interface FarHeroStyle { accentColor?: number; screenColors?: (number | null)[]; glowAccents?: boolean; screenBrightness?: number; accentGlowIntensity?: number; accentGlowTint?: number }
/** 09fbed8's artist HDR controls for the glowing accent bands; the study clamps both itself. */
export interface FarGlowTune { intensity?: number; tint?: number }

type HeroTheme = { accent: number; secondary: number };
/** The far study's theme options for one hero theme: none, accent bands, or bands + glow + screen palette. */
export function farHeroStyle(id: string, accent: boolean | undefined, theme: boolean | undefined, screenBrightness?: number, glow?: FarGlowTune): FarHeroStyle | undefined {
  const t = (HERO_THEMES as Record<string, HeroTheme | undefined>)[id];
  if (!t || (!accent && !theme)) return undefined;
  // `theme`: all three screens in the hero's secondary colour (one material per theme once batched)
  if (!theme) return { accentColor: t.accent };
  const style: FarHeroStyle = { accentColor: t.accent, screenColors: [t.secondary, t.secondary, t.secondary], glowAccents: true };
  // the study clamps to 0..1 itself; only pass a real number so its default (1) holds otherwise
  if (screenBrightness !== undefined && Number.isFinite(screenBrightness)) style.screenBrightness = screenBrightness;
  // 09fbed8: accentGlowIntensity (0..4, default 2.8) and accentGlowTint (0.1..1, default 1); unset keeps the study's defaults
  if (glow?.intensity !== undefined && Number.isFinite(glow.intensity)) style.accentGlowIntensity = glow.intensity;
  if (glow?.tint !== undefined && Number.isFinite(glow.tint)) style.accentGlowTint = glow.tint;
  return style;
}

export function fittedFarHero(hero: THREE.Object3D, style?: number | FarHeroStyle): THREE.Group {
  const st: FarHeroStyle = typeof style === 'number' ? { accentColor: style } : (style ?? {});
  const far = createVelvetHeroFarCabinet(THREE, {
    ...(st.accentColor === undefined ? {} : { accentColor: st.accentColor }),
    ...(st.screenColors ? { screenColors: st.screenColors } : {}),
    ...(st.glowAccents ? { glowAccents: true } : {}),
    ...(st.screenBrightness === undefined ? {} : { screenBrightness: st.screenBrightness }),
    ...(st.accentGlowIntensity === undefined ? {} : { accentGlowIntensity: st.accentGlowIntensity }),
    ...(st.accentGlowTint === undefined ? {} : { accentGlowTint: st.accentGlowTint }),
  }) as THREE.Group;
  const drop: THREE.Object3D[] = [];
  far.traverse((o) => { if ((o as THREE.Mesh).isMesh && HERO_DRIVEN_PART.test(o.name)) drop.push(o); });
  for (const o of drop) o.removeFromParent();
  hero.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(hero.matrixWorld).invert();
  const hb = new THREE.Box3();
  hero.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.computeBoundingBox();
    hb.union(m.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
  });
  far.updateMatrixWorld(true);
  const fb = new THREE.Box3().setFromObject(far);
  const fit = new THREE.Group();
  fit.name = 'hero_far_fit';
  fit.scale.set((hb.max.x - hb.min.x) / (fb.max.x - fb.min.x), (hb.max.y - hb.min.y) / (fb.max.y - fb.min.y), (hb.max.z - hb.min.z) / (fb.max.z - fb.min.z));
  fit.position.set((hb.min.x + hb.max.x) / 2 - ((fb.min.x + fb.max.x) / 2) * fit.scale.x, hb.min.y - fb.min.y * fit.scale.y, hb.min.z - fb.min.z * fit.scale.z);
  fit.add(far);
  return fit;
}

export const CHAIR_STORAGE_KEY = 'va3d.chair';
export const NEXT_CHAIR_STYLE: Record<ChairStyle, ChairStyle> = { velvet: 'luxury', luxury: 'lod-mid', 'lod-mid': 'lod-near', 'lod-near': 'swivel', swivel: 'tub', tub: 'casino', casino: 'velvet' };
/**
 * A `?chair=` parameter wins; otherwise the ⚙ button's stored choice (VA-0207), so a phone can compare.
 * With nothing stored, prototype builds get Claude's burgundy gaming chair (Joshua, VA-0210); the
 * real game keeps the luxury chair.
 */
export function readChairStyle(): ChairStyle {
  if (typeof location === 'undefined') return 'luxury';
  if (!(import.meta.env?.DEV || import.meta.env?.MODE === 'proto')) return 'luxury';
  if (new URLSearchParams(location.search).has('chair')) return chairStyleFrom(location.search);
  try {
    const stored = localStorage.getItem(CHAIR_STORAGE_KEY);
    return stored === null ? 'velvet' : chairStyleFrom(`?chair=${stored}`);
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
      tpl = (style === 'velvet' ? createVelvetGamingChair(THREE)
        : style === 'swivel' ? createVelvetLuxuryChairLOD(THREE)
          : style === 'tub' ? createVelvetTubChair(THREE)
          : style === 'casino' ? createVelvetCasinoChair(THREE)
          : createVelvetGamingChairLod(THREE, { detail: style === 'lod-near' ? 'near' : 'mid' })) as THREE.Group;
      // the swivel chair (31b9eb8) states its front only as userData.velvetArt.orientation
      // ('front +Z'); without this it would get the -Z half turn and face away from its table
      const orient = String(tpl.userData.velvetArt?.orientation ?? '');
      if (tpl.userData.forward === undefined && tpl.userData.front === undefined && /front \+Z/i.test(orient)) tpl.userData.forward = '+Z';
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
  opts: { liftSign: (hero: THREE.Object3D) => number; carpetCanvas?: unknown; carpetArt?: boolean; carpetMotif?: CarpetMotif; ceiling?: CeilingStyle; chairStyle?: ChairStyle; machineDetail?: MachineDetail; heroLod?: boolean; heroFar?: boolean; heroFarAccent?: boolean; heroFarTheme?: boolean; heroFarScreen?: number; heroFarGlow?: FarGlowTune; copyFar?: boolean },
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
  let carpetArt = false;
  let carpetMotif: CarpetMotif | null = null;
  if (opts.carpetCanvas || typeof document !== 'undefined') {
    // below the architecture's stone promenade (top at 0.0225), so the walkway shows through
    const carpet = makeVelvetPatternCarpet(THREE, { width: w, depth: d, x: cx, y: 0.012, z: cz, canvas: opts.carpetCanvas }) as THREE.Mesh;
    root.add(carpet);
    wovenCarpet = true;
    if (opts.carpetArt ?? readCarpetArt()) {
      const stub = opts.carpetCanvas as { width: number; height: number } | undefined;
      const make = (n: number): unknown => {
        const c = stub ? Object.create(stub) : document.createElement('canvas');
        c.width = n;
        c.height = n;
        return c;
      };
      const motif = opts.carpetMotif ?? readCarpetMotif();
      carpetArt = applyCarpetArt(carpet, w, d, make, motif);
      if (carpetArt) carpetMotif = motif;
    }
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
  } else if (opts.ceiling === 'velvet-coffers') {
    const drop: THREE.Object3D[] = [];
    architecture.traverse((o) => {
      if (o !== architecture && REPLACED_BY_VELVET_COFFERS.test(o.name)) drop.push(o);
    });
    for (const o of drop) o.removeFromParent();
    root.add(velvetCofferCeiling(spec, readCofferEdgeMode()));
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
  // (declared before the heroes: their far twins share the copies' lite geometry)
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
    if (opts.heroLod) {
      // its far twin (VA-0305): the same cabinet with the copies' lighter tessellation, minus the
      // parts the game drives (reels, spin button, marquee), which stay the hero's own at every
      // distance. artScene batches the two apart and world.ts shows one or the other by distance.
      slot.userData.heroLod = 'full';
      const twin = new THREE.Group();
      twin.name = `slotlod_${s.id}`;
      twin.userData.heroLod = 'lite';
      twin.position.copy(slot.position);
      twin.rotation.copy(slot.rotation);
      const lite = liteCabinet(hero, liteGeos);
      const drop: THREE.Object3D[] = [];
      lite.traverse((o) => { if ((o as THREE.Mesh).isMesh && HERO_DRIVEN_PART.test(o.name)) drop.push(o); });
      for (const o of drop) o.removeFromParent();
      twin.add(lite);
      root.add(twin);
      if (opts.heroFar) {
        const far = new THREE.Group();
        far.name = `slotfar_${s.id}`;
        far.userData.heroLod = 'far';
        far.position.copy(slot.position);
        far.rotation.copy(slot.rotation);
        // with heroFarAccent each theme's far twin carries that hero's own accent colour (one batch per theme)
        far.add(fittedFarHero(hero, farHeroStyle(s.id, opts.heroFarAccent, opts.heroFarTheme, opts.heroFarScreen, opts.heroFarGlow)));
        root.add(far);
      }
    }
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
    // `?copyfar=on` (VA-0340): a north copy (the half beside the heroes, batched with the hero
    // sets) also gets the far cabinet, drawn instead of it at the 'distant' level. Its reels,
    // spin button and marquee stay the copy's own, as for the heroes.
    if (opts.heroLod && opts.heroFar && opts.copyFar && s.z < 0) {
      const far = new THREE.Group();
      far.name = `slotcopyfar_${s.id}_${i + 1}`;
      far.userData.heroLod = 'distant';
      far.position.copy(copy.position);
      far.rotation.copy(copy.rotation);
      far.add(fittedFarHero(src, farHeroStyle(s.id, opts.heroFarAccent, opts.heroFarTheme, opts.heroFarScreen, opts.heroFarGlow)));
      root.add(far);
    }
  });
  return { root, heroes, heroTextures, wovenCarpet, carpetArt, carpetMotif };
}
