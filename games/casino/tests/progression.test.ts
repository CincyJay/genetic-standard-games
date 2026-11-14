import { describe, expect, it } from 'vitest';
import { createRng } from '@tgs/kit/rng';
import {
  UNLOCKS, WHEEL_PRIZES, isUnlocked, levelForXp, levelProgress, levelReward, missionsFor, spinWheel, unlocksBetween, vipTier, xpForLevel,
} from '../src/logic/progression.ts';

describe('progression', () => {
  it('levels need more XP each time', () => {
    expect(xpForLevel(1)).toBe(0);
    for (let l = 2; l < 100; l++) expect(xpForLevel(l + 1) - xpForLevel(l)).toBeGreaterThan(xpForLevel(l) - xpForLevel(l - 1) - 1);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpForLevel(7))).toBe(7);
    expect(levelForXp(xpForLevel(7) - 1)).toBe(6);
    const p = levelProgress(xpForLevel(4) + 10);
    expect(p.level).toBe(4);
    expect(p.into).toBe(10);
  });

  it('rewards level-ups, with bigger rewards every 5 levels', () => {
    expect(levelReward(5)).toBeGreaterThan(levelReward(6));
    expect(levelReward(2)).toBeGreaterThan(0);
  });

  it('unlocks content by level', () => {
    expect(isUnlocked('slots-pharaoh', 2)).toBe(false);
    expect(isUnlocked('slots-pharaoh', 3)).toBe(true);
    expect(unlocksBetween(4, 6).map((u) => u.id)).toEqual(['holdem-highroller', 'slots-ocean']);
    expect(UNLOCKS.every((u) => u.level > 1)).toBe(true);
  });

  it('VIP tiers rise with level', () => {
    expect(vipTier(1).name).toBe('Bronze');
    expect(vipTier(12).name).toBe('Silver');
    expect(vipTier(100).name).toBe('Diamond');
  });

  it('gives three daily missions from different games, the same all day', () => {
    for (const day of ['2026-11-14', '2026-11-15', '2027-01-01', '2026-02-28']) {
      const ms = missionsFor(day);
      expect(ms).toHaveLength(3);
      expect(new Set(ms.map((m) => m.event.split('_')[0])).size).toBe(3);
      expect(missionsFor(day)).toEqual(ms);
    }
    expect(missionsFor('2026-11-14')).not.toEqual(missionsFor('2026-11-15'));
  });

  it('the daily wheel lands on every wedge, big prizes rarely', () => {
    const rnd = createRng(8);
    const counts = new Array(WHEEL_PRIZES.length).fill(0);
    for (let i = 0; i < 20000; i++) counts[spinWheel(rnd)]++;
    expect(counts.every((c) => c > 0)).toBe(true);
    const jackpotWedge = WHEEL_PRIZES.indexOf(25000);
    expect(counts[jackpotWedge] / 20000).toBeLessThan(0.01);
  });
});
