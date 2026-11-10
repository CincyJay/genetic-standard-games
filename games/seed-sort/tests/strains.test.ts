import { describe, expect, it } from 'vitest';
import { RARITY_WEIGHT, STRAINS, rollPack, stageFor } from '../src/strains.ts';

describe('seed packs', () => {
  it('has unique strain ids and names', () => {
    expect(new Set(STRAINS.map((s) => s.id)).size).toBe(STRAINS.length);
    expect(new Set(STRAINS.map((s) => s.name)).size).toBe(STRAINS.length);
  });

  it('level 1 always gives the starter strain', () => {
    expect(rollPack(1, {}).id).toBe('ohio-valley');
  });

  it('is deterministic for the same level and collection', () => {
    for (const id of [2, 17, 99]) expect(rollPack(id, {}).id).toBe(rollPack(id, {}).id);
  });

  it('every 10th level is uncommon or better', () => {
    for (let id = 10; id <= 500; id += 10) expect(rollPack(id, {}).rarity).not.toBe('common');
  });

  it('rarity distribution roughly follows the weights over many levels', () => {
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
      const s = rollPack(id, owned);
      owned[s.id] = (owned[s.id] ?? 0) + 1;
    }
    expect(Object.keys(owned).length).toBe(STRAINS.length);
  });

  it('plants grow with copies', () => {
    expect(stageFor(1)).toBe(0);
    expect(stageFor(3)).toBe(1);
    expect(stageFor(5)).toBe(2);
  });
});
