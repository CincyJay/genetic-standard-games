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
import { makeSeatedDealer, type SeatedDealer } from './dealerRig.ts';
import blackjackGreenUrl from '../../../../art/casino/3d/models/tripo_table_blackjack_green.glb?url';
import blackjackBlueUrl from '../../../../art/casino/3d/models/tripo_table_blackjack_blue.glb?url';
import rouletteUrl from '../../../../art/casino/3d/models/tripo_table_roulette.glb?url';
import baccaratUrl from '../../../../art/casino/3d/models/tripo_table_baccarat.glb?url';
import dealerWomanBlackSuitRigUrl from '../../../../art/casino/3d/models/tripo_dealer_woman_blacksuit_rig.glb?url';
import dealerWomanVestRigUrl from '../../../../art/casino/3d/models/tripo_dealer_woman_vest_rig.glb?url';
import dealerWomanGoldRigUrl from '../../../../art/casino/3d/models/tripo_dealer_woman_gold_rig.glb?url';
import dealerManSuitRigUrl from '../../../../art/casino/3d/models/tripo_dealer_man_suit_rig.glb?url';

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

/**
 * Joshua's dealers, one per table in table order (in turn when there are fewer dealers than
 * tables; Joshua is making one for every table). Rigged ones (Mixamo-named skeleton) sit on a stool
 * and idle (dealerRig.ts); static ones (baked with --table, 1.7–1.8 m) stand behind the table.
 * `rawHeight` is a rigged figure's height in its own units.
 */
export const DEALER_MODELS: readonly { id: string; url: string; rigged?: { rawHeight: number; height: number; tPose?: boolean } }[] = [
  // in table order: green blackjack, roulette, blue blackjack, baccarat
  { id: 'dealer-woman-black-suit', url: dealerWomanBlackSuitRigUrl, rigged: { rawHeight: 0.977, height: 1.7 } },
  { id: 'dealer-woman-gold', url: dealerWomanGoldRigUrl, rigged: { rawHeight: 0.975, height: 1.72 } },
  // rigged in a T-pose: the arms come down before he sits
  { id: 'dealer-man-suit', url: dealerManSuitRigUrl, rigged: { rawHeight: 0.979, height: 1.8, tPose: true } },
  { id: 'dealer-woman-vest', url: dealerWomanVestRigUrl, rigged: { rawHeight: 0.977, height: 1.7 } },
];
/** Standing dealers stand this much nearer the table than the placeholder's spot (the Tripo tables are 2 m deep). */
export const TRIPO_DEALER_STEP_IN = 0.3;
/** Seated dealers sit nearer still: knees under the table's back edge, hands on the felt. */
export const TRIPO_DEALER_SEATED_STEP_IN = 0.42;

const loaded = new Map<string, THREE.Object3D>();
let pending: Promise<void> | null = null;

/** Loads every table once; resolves either way (a table that fails is left out). */
export function preloadTripoTables(): Promise<void> {
  pending ??= Promise.all(
    [...TABLE_MODELS, ...DEALER_MODELS].map((m) =>
      new GLTFLoader()
        .loadAsync(m.url)
        .then((gltf) => {
          if ('rigged' in m && m.rigged) {
            loaded.set(m.id, gltf.scene);
            return;
          }
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

export type DealerMaker = { kind: 'static'; make: () => THREE.Group } | { kind: 'seated'; make: (opts: { stool: boolean; phase: number }) => SeatedDealer };

/** Each dealer that loaded, in DEALER_MODELS order; empty until preloaded. */
export function tripoDealers(): DealerMaker[] {
  return DEALER_MODELS.filter((m) => loaded.has(m.id)).map((m): DealerMaker => {
    const src = loaded.get(m.id)!;
    if (m.rigged) {
      const { rawHeight, height, tPose } = m.rigged;
      return { kind: 'seated', make: (o) => makeSeatedDealer(src, rawHeight, height, { ...o, tPose }) };
    }
    return {
      kind: 'static',
      make: () => {
        const g = new THREE.Group();
        g.name = `tripo_${m.id}`;
        g.add(src.clone(true));
        return g;
      },
    };
  });
}

/** The floor's label over a table. */
export const TABLE_LABEL: Record<TableGame, string> = { blackjack: 'BLACKJACK', roulette: 'ROULETTE', baccarat: 'BACCARAT' };
