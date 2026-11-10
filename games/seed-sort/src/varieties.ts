import { createRng } from '@tgs/kit/rng';

/**
 * The garden collection. Every newly cleared level opens a seed pack holding one
 * plant variety; collecting copies grows that plant (seedling -> growing -> blooming).
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Category = 'Flower' | 'Fruit' | 'Vegetable' | 'Herb';

export interface Variety {
  id: string;
  name: string;
  category: Category;
  rarity: Rarity;
  /** Color of its flowers or fruit. */
  color: number;
}

const V = (id: string, name: string, category: Category, rarity: Rarity, color: number): Variety => ({
  id,
  name,
  category,
  rarity,
  color,
});

export const VARIETIES: Variety[] = [
  // common (16)
  V('sunflower', 'Sunflower', 'Flower', 'common', 0xffc93c),
  V('tulip', 'Tulip', 'Flower', 'common', 0xff5d5d),
  V('daisy', 'Daisy', 'Flower', 'common', 0xe9edf5),
  V('marigold', 'Marigold', 'Flower', 'common', 0xff9a3c),
  V('cornflower', 'Cornflower', 'Flower', 'common', 0x4d8dff),
  V('sweet-pea', 'Sweet Pea', 'Flower', 'common', 0xff7ac8),
  V('poppy', 'Poppy', 'Flower', 'common', 0xff6b4a),
  V('zinnia', 'Zinnia', 'Flower', 'common', 0xe8478f),
  V('tomato', 'Tomato', 'Vegetable', 'common', 0xf2453d),
  V('carrot', 'Carrot', 'Vegetable', 'common', 0xff8c2e),
  V('pea', 'Garden Pea', 'Vegetable', 'common', 0xb5e35a),
  V('pumpkin', 'Pumpkin', 'Vegetable', 'common', 0xf58b2a),
  V('strawberry', 'Strawberry', 'Fruit', 'common', 0xff4d6a),
  V('basil', 'Basil', 'Herb', 'common', 0x3ddc84),
  V('mint', 'Mint', 'Herb', 'common', 0x2fd6c3),
  V('lavender', 'Lavender', 'Herb', 'common', 0xa47bff),
  // uncommon (10)
  V('iris', 'Iris', 'Flower', 'uncommon', 0x7b6cff),
  V('peony', 'Peony', 'Flower', 'uncommon', 0xff9ec7),
  V('dahlia', 'Dahlia', 'Flower', 'uncommon', 0xd6304f),
  V('snapdragon', 'Snapdragon', 'Flower', 'uncommon', 0xffe066),
  V('foxglove', 'Foxglove', 'Flower', 'uncommon', 0xc77dff),
  V('blueberry', 'Blueberry', 'Fruit', 'uncommon', 0x3d6fd9),
  V('watermelon', 'Watermelon', 'Fruit', 'uncommon', 0x3fbf74),
  V('eggplant', 'Eggplant', 'Vegetable', 'uncommon', 0x7a4bc2),
  V('chili', 'Chili Pepper', 'Vegetable', 'uncommon', 0xe8352f),
  V('rosemary', 'Rosemary', 'Herb', 'uncommon', 0x9cc5a1),
  // rare (5)
  V('blue-orchid', 'Blue Orchid', 'Flower', 'rare', 0x5ac8fa),
  V('black-tulip', 'Black Tulip', 'Flower', 'rare', 0x6b2d5c),
  V('bird-of-paradise', 'Bird of Paradise', 'Flower', 'rare', 0xff8a1f),
  V('golden-rose', 'Golden Rose', 'Flower', 'rare', 0xf5c542),
  V('dragon-fruit', 'Dragon Fruit', 'Fruit', 'rare', 0xff3d9a),
  // legendary (2)
  V('moonflower', 'Moonflower', 'Flower', 'legendary', 0xdfe8ff),
  V('midnight-lotus', 'Midnight Lotus', 'Flower', 'legendary', 0x8f7bff),
];

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 70, uncommon: 22, rare: 7, legendary: 1 };
export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};
export const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x8a97b1,
  uncommon: 0x3ddc84,
  rare: 0x4d8dff,
  legendary: 0xffd84d,
};

export function varietyById(id: string): Variety | undefined {
  return VARIETIES.find((v) => v.id === id);
}

/**
 * The pack for a level. Deterministic, so replaying or reinstalling gives the
 * same reward. Level 1 always gives the starter (Sunflower); every 10th level is
 * guaranteed uncommon or better; while varieties remain undiscovered, packs lean
 * toward ones the player doesn't own yet.
 */
export function rollPack(levelId: number, owned: Record<string, number>): Variety {
  if (levelId === 1) return VARIETIES[0]!;
  const rng = createRng(0xc0ffee + levelId * 104729);
  const tiers: Rarity[] = levelId % 10 === 0 ? ['uncommon', 'rare', 'legendary'] : ['common', 'uncommon', 'rare', 'legendary'];
  const total = tiers.reduce((sum, r) => sum + RARITY_WEIGHT[r], 0);
  let pick = rng() * total;
  let rarity: Rarity = tiers[0]!;
  for (const r of tiers) {
    pick -= RARITY_WEIGHT[r];
    if (pick <= 0) {
      rarity = r;
      break;
    }
  }
  const pool = VARIETIES.filter((v) => v.rarity === rarity);
  const unowned = pool.filter((v) => !owned[v.id]);
  const from = unowned.length > 0 && rng() < 0.75 ? unowned : pool;
  return from[Math.floor(rng() * from.length)]!;
}

export type GrowthStage = 0 | 1 | 2;
export const STAGE_LABEL = ['Seedling', 'Growing', 'Blooming'] as const;
/** Copies needed to reach each stage. */
export const STAGE_AT = [1, 3, 5] as const;

export function stageFor(copies: number): GrowthStage {
  if (copies >= STAGE_AT[2]) return 2;
  if (copies >= STAGE_AT[1]) return 1;
  return 0;
}
