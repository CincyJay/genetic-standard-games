/**
 * Joshua's own table models (2026-11-22): generated with Tripo on his phone and baked by Claude
 * with `art/casino/3d/models/bake/bakeCabinet.mjs --table`: players' side turned to +Z (the hero
 * table's convention: guests on +Z, dealer on -Z), centred on the origin, standing on the floor,
 * about 2.5–2.9 m across. Only the GLB's `tripo_cabinet_near` level is used (four tables).
 *
 * In proto/dev builds, with Joshua's models on (the ⚙ "your Tripo models" switch, shared with the
 * slot cabinets), the grand hall's four tables become his: two blackjack, a roulette and a baccarat
 * table, and each table's seats open that game. Otherwise the hero blackjack tables stay.
 *
 * To add a table: bake it with --table, put the GLB in art/casino/3d/models/, and add it below.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { TableGame } from './layout.ts';
import blackjackGreenUrl from '../../../../art/casino/3d/models/tripo_table_blackjack_green.glb?url';
import blackjackBlueUrl from '../../../../art/casino/3d/models/tripo_table_blackjack_blue.glb?url';
import rouletteUrl from '../../../../art/casino/3d/models/tripo_table_roulette.glb?url';
import baccaratUrl from '../../../../art/casino/3d/models/tripo_table_baccarat.glb?url';

export interface TableModelSpec {
  id: string;
  url: string;
  game: TableGame;
}

/**
 * In the grand hall's table order (west near, west far, east near, east far): the two blackjack
 * tables face each other across the promenade, roulette and baccarat behind them.
 */
export const TABLE_MODELS: readonly TableModelSpec[] = [
  { id: 'blackjack-green', url: blackjackGreenUrl, game: 'blackjack' },
  { id: 'roulette', url: rouletteUrl, game: 'roulette' },
  { id: 'blackjack-blue', url: blackjackBlueUrl, game: 'blackjack' },
  { id: 'baccarat', url: baccaratUrl, game: 'baccarat' },
];

const loaded = new Map<string, THREE.Object3D>();
let pending: Promise<void> | null = null;

/** Loads every table once; resolves either way (a table that fails is left out). */
export function preloadTripoTables(): Promise<void> {
  pending ??= Promise.all(
    TABLE_MODELS.map((m) =>
      new GLTFLoader()
        .loadAsync(m.url)
        .then((gltf) => {
          const near = gltf.scene.getObjectByName('tripo_cabinet_near');
          if (!near) throw new Error(`${m.id}: table mesh missing`);
          near.removeFromParent();
          near.traverse((c) => {
            const mesh = c as THREE.Mesh;
            if (mesh.isMesh) mesh.castShadow = mesh.receiveShadow = true;
          });
          loaded.set(m.id, near);
        })
        .catch((e) => console.warn(`Tripo table ${m.id} failed to load`, e)),
    ),
  ).then(() => undefined);
  return pending;
}

export interface LoadedTable extends TableModelSpec {
  /** A fresh copy (geometry and material shared). */
  make: () => THREE.Group;
}

/** Every table that loaded, in TABLE_MODELS order; empty until preloadTripoTables resolves. */
export function tripoTables(): LoadedTable[] {
  return TABLE_MODELS.filter((m) => loaded.has(m.id)).map((m) => ({
    ...m,
    make: () => {
      const g = new THREE.Group();
      g.name = `tripo_table_${m.id}`;
      g.add(loaded.get(m.id)!.clone(true));
      return g;
    },
  }));
}

/** The floor's label over a table. */
export const TABLE_LABEL: Record<TableGame, string> = { blackjack: 'BLACKJACK', roulette: 'ROULETTE', baccarat: 'BACCARAT' };
