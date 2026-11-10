import { describe, expect, it } from 'vitest';
import { RARITY_WEIGHT, VARIETIES, rollPack, stageFor } from '../src/varieties.ts';

describe('seed packs', () => {
  it('has unique ids and names', () => {
    expect(new Set(VARIETIES.map((v) => v.id)).size).toBe(VARIETIES.length);
    expect(new Set(VARIETIES.map((v) => v.name)).size).toBe(VARIETIES.length);
  });

  it('level 1 always gives the starter', () => {
    expect(rollPack(1, {}).id).toBe('sunflower');
  });

  it('is deterministic for the same level and collection', () => {
    for (const id of [2, 17, 99]) expect(rollPack(id, {}).id).toBe(rollPack(id, {}).id);
  });

  it('every 10th level is uncommon or better', () => {
    for (let id = 10; id <= 500; id += 10) expect(rollPack(id, {}).rarity).not.toBe('common');
  });

  it('rarity distribution roughly follows the weights', () => {
    const counts: Record<string, number> = {};
    for (let id = 2; id <= 3000; id++) {
      const r = rollPack(id, {}).rarity;
      counts[r] = (counts[r] ?? 0) + 1;
    }
    expect(counts.common! / 3000).toBeGreaterThan(0.55);
    expect(counts.legendary ?? 0).toBeGreaterThan(0);
    expect(RARITY_WEIGHT.legendary).toBeLessThan(RARITY_WEIGHT.rare);
  });

  it('a player who keeps playing discovers the whole catalog', () => {
    const owned: Record<string, number> = {};
    for (let id = 1; id <= 1500; id++) {
      const v = rollPack(id, owned);
      owned[v.id] = (owned[v.id] ?? 0) + 1;
    }
    expect(Object.keys(owned).length).toBe(VARIETIES.length);
  });

  it('plants grow with copies', () => {
    expect(stageFor(1)).toBe(0);
    expect(stageFor(3)).toBe(1);
    expect(stageFor(5)).toBe(2);
  });
});
