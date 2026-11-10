import { createRng } from '@tgs/kit/rng';

/**
 * The garden collection. Every finished level opens a seed pack containing one
 * strain; collecting copies grows that plant (seedling -> veg -> flowering).
 *
 * Theme rule (app-store policy): the game is about growing, breeding and
 * collecting genetics. No consumption, potency numbers or sales references.
 * Strain names are original to this game.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Lineage = 'Indica' | 'Sativa' | 'Hybrid';

export interface Strain {
  id: string;
  name: string;
  lineage: Lineage;
  rarity: Rarity;
  color: number;
  /** Dominant aroma, for flavor text. */
  terpene: string;
}

const S = (id: string, name: string, lineage: Lineage, rarity: Rarity, color: number, terpene: string): Strain => ({
  id,
  name,
  lineage,
  rarity,
  color,
  terpene,
});

export const STRAINS: Strain[] = [
  // common (16)
  S('emerald-drift', 'Emerald Drift', 'Hybrid', 'common', 0x3ddc84, 'Pine'),
  S('ohio-valley', 'Ohio Valley', 'Indica', 'common', 0x7bc96f, 'Earth'),
  S('citrus-comet', 'Citrus Comet', 'Sativa', 'common', 0xffc23d, 'Lemon'),
  S('mossback', 'Mossback', 'Indica', 'common', 0x6aa84f, 'Moss'),
  S('river-haze', 'River Haze', 'Sativa', 'common', 0x5ac8fa, 'Mint'),
  S('copper-kettle', 'Copper Kettle', 'Hybrid', 'common', 0xd98b4a, 'Spice'),
  S('meadowlark', 'Meadowlark', 'Sativa', 'common', 0xb5e35a, 'Herbal'),
  S('slate-ridge', 'Slate Ridge', 'Indica', 'common', 0x8fa3bf, 'Pepper'),
  S('honeycomb', 'Honeycomb', 'Hybrid', 'common', 0xffd84d, 'Sweet'),
  S('cedar-hollow', 'Cedar Hollow', 'Indica', 'common', 0xa0785a, 'Cedar'),
  S('tangerine-sky', 'Tangerine Sky', 'Sativa', 'common', 0xff9a3c, 'Orange'),
  S('blue-heron', 'Blue Heron', 'Hybrid', 'common', 0x4d8dff, 'Berry'),
  S('wild-clover', 'Wild Clover', 'Hybrid', 'common', 0x48c78e, 'Floral'),
  S('prairie-fire', 'Prairie Fire', 'Sativa', 'common', 0xff6b4a, 'Spice'),
  S('sage-moon', 'Sage Moon', 'Indica', 'common', 0x9cc5a1, 'Sage'),
  S('ember-root', 'Ember Root', 'Hybrid', 'common', 0xe8734a, 'Earth'),
  // uncommon (10)
  S('violet-vale', 'Violet Vale', 'Indica', 'uncommon', 0xa47bff, 'Grape'),
  S('glacier-mint', 'Glacier Mint', 'Hybrid', 'uncommon', 0x2fd6c3, 'Mint'),
  S('rose-quartz', 'Rose Quartz', 'Hybrid', 'uncommon', 0xff7ac8, 'Rose'),
  S('night-orchard', 'Night Orchard', 'Indica', 'uncommon', 0x6c5ce7, 'Plum'),
  S('sunpatch', 'Sunpatch', 'Sativa', 'uncommon', 0xffe066, 'Pineapple'),
  S('cobalt-creek', 'Cobalt Creek', 'Hybrid', 'uncommon', 0x3d7bd9, 'Blueberry'),
  S('frost-fern', 'Frost Fern', 'Indica', 'uncommon', 0xcfe8ff, 'Pine'),
  S('mango-tide', 'Mango Tide', 'Sativa', 'uncommon', 0xffad42, 'Mango'),
  S('crimson-loam', 'Crimson Loam', 'Indica', 'uncommon', 0xe0475b, 'Cherry'),
  S('jade-lantern', 'Jade Lantern', 'Hybrid', 'uncommon', 0x1fbf8f, 'Lime'),
  // rare (5)
  S('aurora-kush', 'Aurora Kush', 'Indica', 'rare', 0xc77dff, 'Lavender'),
  S('gilded-sativa', 'Gilded Harvest', 'Sativa', 'rare', 0xf5c542, 'Honey'),
  S('arctic-bloom', 'Arctic Bloom', 'Hybrid', 'rare', 0xe9edf5, 'Vanilla'),
  S('black-cherry-reserve', 'Black Cherry Reserve', 'Indica', 'rare', 0x9b2242, 'Cherry'),
  S('neon-canopy', 'Neon Canopy', 'Sativa', 'rare', 0x7cff6b, 'Lime'),
  // legendary (2)
  S('genetic-standard-og', 'Genetic Standard OG', 'Hybrid', 'legendary', 0x3ddc84, 'Diesel'),
  S('phantom-phenotype', 'Phantom Pheno', 'Indica', 'legendary', 0xb388ff, 'Incense'),
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

export function strainById(id: string): Strain | undefined {
  return STRAINS.find((s) => s.id === id);
}

/**
 * The pack for a level. Deterministic, so replaying a level or reinstalling gives
 * the same reward. Level 1 always gives a starter strain; every 10th level is
 * guaranteed uncommon or better; while a player still has strains to discover,
 * packs lean toward ones they don't own yet.
 */
export function rollPack(levelId: number, owned: Record<string, number>): Strain {
  if (levelId === 1) return STRAINS[1]!; // Ohio Valley
  const rng = createRng(0xc0ffee + levelId * 104729);
  const minRarity: Rarity[] = levelId % 10 === 0 ? ['uncommon', 'rare', 'legendary'] : ['common', 'uncommon', 'rare', 'legendary'];
  const total = minRarity.reduce((sum, r) => sum + RARITY_WEIGHT[r], 0);
  let pick = rng() * total;
  let rarity: Rarity = minRarity[0]!;
  for (const r of minRarity) {
    pick -= RARITY_WEIGHT[r];
    if (pick <= 0) {
      rarity = r;
      break;
    }
  }
  const pool = STRAINS.filter((s) => s.rarity === rarity);
  const unowned = pool.filter((s) => !owned[s.id]);
  const from = unowned.length > 0 && rng() < 0.75 ? unowned : pool;
  return from[Math.floor(rng() * from.length)]!;
}

export type GrowthStage = 0 | 1 | 2;
export const STAGE_LABEL = ['Seedling', 'Vegetative', 'Flowering'] as const;
/** Copies needed to reach each stage. */
export const STAGE_AT = [1, 3, 5] as const;

export function stageFor(copies: number): GrowthStage {
  if (copies >= STAGE_AT[2]) return 2;
  if (copies >= STAGE_AT[1]) return 1;
  return 0;
}
