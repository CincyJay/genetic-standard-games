import { describe, expect, it } from 'vitest';
import {
  SEED_TYPES,
  binAt,
  configForLevel,
  createSpawner,
  isCleared,
  isFailed,
  isSeed,
  itemPassed,
  multiplierFor,
  newRun,
  starsFor,
  tapItem,
} from '../src/logic/conveyor.ts';

describe('level config', () => {
  it('starts easy and ramps up', () => {
    const l1 = configForLevel(1);
    expect(l1.bins).toHaveLength(3);
    expect(l1.rockChance).toBe(0);
    expect(l1.weedChance).toBe(0);
    expect(l1.shuffleEvery).toBe(0);
    const l20 = configForLevel(20);
    expect(l20.bins).toHaveLength(5);
    expect(l20.speed).toBeGreaterThan(l1.speed);
    expect(l20.spawnEvery).toBeLessThan(l1.spawnEvery);
    expect(l20.shuffleEvery).toBeGreaterThan(0);
  });

  it('crates always hold distinct, valid seed types', () => {
    for (let lvl = 1; lvl <= 200; lvl++) {
      const { bins } = configForLevel(lvl);
      expect(new Set(bins).size).toBe(bins.length);
      for (const b of bins) expect(SEED_TYPES).toContain(b);
    }
  });

  it('caps speed and target', () => {
    const c = configForLevel(1000);
    expect(c.speed).toBeLessThanOrEqual(480);
    expect(c.target).toBeLessThanOrEqual(60);
    expect(c.spawnEvery).toBeGreaterThanOrEqual(650);
  });
});

describe('spawner', () => {
  it('is deterministic and only spawns seeds that have a crate', () => {
    const cfg = configForLevel(15);
    const a = createSpawner(cfg);
    const b = createSpawner(cfg);
    for (let i = 0; i < 300; i++) {
      const x = a();
      expect(x).toEqual(b());
      if (isSeed(x.kind)) expect(cfg.bins).toContain(x.kind);
      expect(x.delay).toBeGreaterThan(0);
    }
  });

  it('level 1 spawns only plain seeds', () => {
    const next = createSpawner(configForLevel(1));
    for (let i = 0; i < 100; i++) expect(isSeed(next().kind)).toBe(true);
  });
});

describe('scoring', () => {
  it('maps x positions to crates', () => {
    expect(binAt(0, 4, 0, 1000)).toBe(0);
    expect(binAt(260, 4, 0, 1000)).toBe(1);
    expect(binAt(999, 4, 0, 1000)).toBe(3);
    expect(binAt(-50, 4, 0, 1000)).toBe(0);
    expect(binAt(1200, 4, 0, 1000)).toBe(3);
  });

  it('rewards streaks with a growing multiplier', () => {
    expect(multiplierFor(0)).toBe(1);
    expect(multiplierFor(4)).toBe(1);
    expect(multiplierFor(5)).toBe(2);
    expect(multiplierFor(100)).toBe(5);
    const cfg = configForLevel(5);
    const s = newRun(cfg);
    for (let i = 0; i < 10; i++) tapItem(s, cfg, cfg.bins[0]!, 0);
    expect(s.sorted).toBe(10);
    expect(s.streak).toBe(10);
    // 4 at x1, 5 at x2, 1 at x3
    expect(s.score).toBe(4 * 10 + 5 * 20 + 30);
  });

  it('wrong crate, rock taps and missed seeds cost a life and reset the streak', () => {
    const cfg = configForLevel(5);
    const s = newRun(cfg);
    tapItem(s, cfg, cfg.bins[0]!, 0);
    expect(tapItem(s, cfg, cfg.bins[0]!, 1).kind).toBe('wrong');
    expect(s.lives).toBe(2);
    expect(s.streak).toBe(0);
    expect(tapItem(s, cfg, 'rock', 0).kind).toBe('rock');
    expect(itemPassed(s, cfg.bins[1]!).kind).toBe('missed');
    expect(isFailed(s)).toBe(true);
    expect(starsFor(s)).toBe(1);
  });

  it('rocks and weeds can roll off safely; weeds can be plucked', () => {
    const cfg = configForLevel(8);
    const s = newRun(cfg);
    expect(itemPassed(s, 'rock').kind).toBe('passed');
    expect(itemPassed(s, 'weed').kind).toBe('passed');
    expect(tapItem(s, cfg, 'weed', 2)).toEqual({ kind: 'plucked', points: 15 });
    expect(s.lives).toBe(3);
  });

  it('golden seeds score anywhere and keep the streak going', () => {
    const cfg = configForLevel(5);
    const s = newRun(cfg);
    const o = tapItem(s, cfg, 'golden', 3);
    expect(o.kind).toBe('golden');
    expect(s.score).toBe(50);
    expect(s.streak).toBe(1);
  });

  it('clears the level at the target and grades stars by lives lost', () => {
    const cfg = configForLevel(1);
    const s = newRun(cfg);
    for (let i = 0; i < cfg.target; i++) tapItem(s, cfg, cfg.bins[1]!, 1);
    expect(isCleared(s, cfg)).toBe(true);
    expect(starsFor(s)).toBe(3);
  });
});
