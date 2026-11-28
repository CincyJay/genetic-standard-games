/**
 * One texture and one draw call for every slot's reels (VA-0222, draw-call budget).
 *
 * The art draws one 5x5 reel atlas canvas per machine (reelDisplayArt.mjs), so each machine's
 * reels needed a material of their own: one draw call for the hero cabinet's reels and one more
 * for the grand hall's copies of that machine (about 20 calls in the grand hall). Once the
 * atlases are drawn, this copies them unchanged into one sheet canvas (tiles in a grid, same
 * pixel size), maps each reel mesh's UVs into its machine's tile and merges every reel mesh
 * into one. The per-machine meshes stay (hidden) as the cells' addressable parts.
 *
 * Engineering only: the atlas pixels are copied 1:1 (no scaling); no art value changes.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface SheetLayout {
  cols: number;
  rows: number;
  width: number;
  height: number;
}

/** The smallest near-square grid of `n` tiles of `tile` px that fits `maxSize`, or null. */
export function sheetLayout(n: number, tile: number, maxSize: number): SheetLayout | null {
  if (n < 1 || tile < 1) return null;
  for (let cols = Math.ceil(Math.sqrt(n)); cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const width = cols * tile;
    const height = rows * tile;
    if (width <= maxSize && height <= maxSize) return { cols, rows, width, height };
    if (width > maxSize) return null;
  }
  return null;
}

/**
 * Maps UVs already in a machine's own atlas (0..1) into tile `index` of the sheet. Canvas
 * textures use flipY, so canvas row 0 (the top) is the top of v: tile row r spans
 * v (rows-1-r)/rows .. (rows-r)/rows.
 */
export function remapUv(uv: THREE.BufferAttribute, index: number, layout: SheetLayout, start = 0, count = uv.count): void {
  const col = index % layout.cols;
  const row = Math.floor(index / layout.cols);
  const v0 = layout.rows - 1 - row;
  for (let i = start; i < start + count; i++) uv.setXY(i, (col + uv.getX(i)) / layout.cols, (v0 + uv.getY(i)) / layout.rows);
  uv.needsUpdate = true;
}

export interface ReelSource {
  id: string;
  /** The machine's atlas canvas, as reelDisplayArt drew it. */
  canvas: HTMLCanvasElement;
  /** Reel meshes already UV-mapped into that atlas (the hero cabinet's and its copies). */
  meshes: THREE.Mesh[];
}

export interface ReelSheet {
  mesh: THREE.Mesh;
  texture: THREE.CanvasTexture;
  layout: SheetLayout;
  /** Machine id -> tile index. */
  tiles: Map<string, number>;
  /** Copy a machine's atlas into the sheet again after it changed (its updateCell). */
  refresh(id: string): void;
  dispose(): void;
}

/**
 * Builds the sheet from the machines whose atlases are ready, or returns null when there are
 * fewer than two, the tiles differ in size, or the sheet would exceed `maxSize`. The source
 * meshes are hidden, not removed.
 */
export function buildReelSheet(sources: ReelSource[], maxSize: number, makeCanvas: (w: number, h: number) => HTMLCanvasElement): ReelSheet | null {
  const ready = sources.filter((s) => s.meshes.length > 0);
  if (ready.length < 2) return null;
  const tile = ready[0].canvas.width;
  if (ready.some((s) => s.canvas.width !== tile || s.canvas.height !== tile)) return null;
  const layout = sheetLayout(ready.length, tile, maxSize);
  if (!layout) return null;
  const canvas = makeCanvas(layout.width, layout.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  const tiles = new Map<string, number>();
  const draw = (s: ReelSource, i: number) => ctx.drawImage(s.canvas, (i % layout.cols) * tile, Math.floor(i / layout.cols) * tile);
  const geos: THREE.BufferGeometry[] = [];
  ready.forEach((s, i) => {
    tiles.set(s.id, i);
    draw(s, i);
    for (const m of s.meshes) {
      m.updateMatrixWorld();
      const g = m.geometry.clone();
      g.clearGroups();
      g.applyMatrix4(m.matrixWorld);
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      remapUv(g.getAttribute('uv') as THREE.BufferAttribute, i, layout);
      geos.push(g);
    }
  });
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) return null;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  // the same material the art's applyVelvetReelAtlas gives each machine's reels
  const material = new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff, toneMapped: false });
  const mesh = new THREE.Mesh(merged, material);
  mesh.name = 'reels:sheet';
  mesh.matrixAutoUpdate = false;
  for (const s of ready) for (const m of s.meshes) m.visible = false;
  return {
    mesh,
    texture,
    layout,
    tiles,
    refresh(id) {
      const i = tiles.get(id);
      const s = ready.find((r) => r.id === id);
      if (i === undefined || !s) return;
      draw(s, i);
      texture.needsUpdate = true;
    },
    dispose() {
      merged.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
