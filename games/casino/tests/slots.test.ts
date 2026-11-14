import { describe, expect, it } from 'vitest';
import { createRng } from '@tgs/kit/rng';
import { DEEP_BLUE, GOLD_RUSH, LINES, LUCKY_SEVENS, MACHINES, PHARAOH, bonusEV, evaluate, pickBoard, simulateRtp, strips, type Grid } from '../src/logic/slots.ts';

/** Build a grid from rows (top to bottom). */
const grid = (rows: string[][]): Grid => [0, 1, 2, 3, 4].map((reel) => rows.map((r) => r[reel]!));

describe('slot engine', () => {
  it('every machine has 9 symbols ending in wild and scatter, 5 strips, and pays for each symbol', () => {
    expect(LINES).toHaveLength(20);
    for (const m of MACHINES) {
      expect(m.symbols).toHaveLength(9);
      expect(m.symbols.slice(-2)).toEqual(['wild', 'scatter']);
      expect(strips(m)).toHaveLength(5);
      for (const s of m.symbols.slice(0, -1)) expect(m.pays[s]).toHaveLength(3);
    }
  });

  it('pays a line with wild substitution', () => {
    const r = evaluate(LUCKY_SEVENS, grid([
      ['cherry', 'plum', 'bell', 'plum', 'cherry'],
      ['seven', 'wild', 'seven', 'seven', 'bar'],
      ['plum', 'cherry', 'plum', 'bell', 'plum'],
    ]), 1);
    expect(r.lineWins.find((w) => w.line === 0)).toMatchObject({ symbol: 'seven', count: 4, win: 115 });
  });

  it('scatters trigger each machine’s feature', () => {
    const rows = (m: string) => [
      ['scatter', m, m, m, 'scatter'],
      [m, m, 'scatter', m, m],
      [m, m, m, m, m],
    ];
    expect(evaluate(LUCKY_SEVENS, grid(rows('lemon').map((r) => r.map((x, i) => (x === 'lemon' ? ['lemon', 'cherry', 'plum', 'bell', 'bar'][i]! : x)))), 1).freeSpins).toBe(8);
    expect(evaluate(PHARAOH, grid(rows('ankh').map((r) => r.map((x, i) => (x === 'ankh' ? ['ankh', 'eye', 'scarab', 'cat', 'pyramid'][i]! : x)))), 1).bonus).toBe('pick');
    expect(evaluate(GOLD_RUSH, grid(rows('pick').map((r) => r.map((x, i) => (x === 'pick' ? ['pick', 'lantern', 'pan', 'cart', 'dynamite'][i]! : x)))), 1).bonus).toBe('wheel');
  });

  it('Deep Blue wilds on reels 2-4 expand to fill the reel', () => {
    const r = evaluate(DEEP_BLUE, grid([
      ['shark', 'fish', 'shell', 'turtle', 'pearl'],
      ['shark', 'wild', 'shark', 'fish', 'shell'],
      ['fish', 'turtle', 'octopus', 'shell', 'fish'],
    ]), 1);
    expect(r.expanded).toEqual([1]);
    expect(r.final[1]).toEqual(['wild', 'wild', 'wild']);
    // shark-wild-shark on the middle line now pays
    expect(r.lineWins.some((w) => w.symbol === 'shark' && w.count === 3)).toBe(true);
  });

  it('five wilds on a line hits the jackpot', () => {
    const r = evaluate(LUCKY_SEVENS, grid([
      ['cherry', 'plum', 'bell', 'plum', 'cherry'],
      ['wild', 'wild', 'wild', 'wild', 'wild'],
      ['plum', 'cherry', 'plum', 'bell', 'plum'],
    ]), 1);
    expect(r.jackpot).toBe(true);
  });

  it('pick bonus deals every prize once', () => {
    const b = pickBoard(PHARAOH, createRng(5));
    expect([...b].sort((a, c) => a - c)).toEqual([...PHARAOH.pickPrizes!].sort((a, c) => a - c));
    expect(bonusEV(PHARAOH)).toBeCloseTo(26, 0);
  });

  it('every machine returns about 95% over the long run', () => {
    for (const m of MACHINES) {
      const { rtp } = simulateRtp(m, 150_000, createRng(99));
      expect(rtp, m.name).toBeGreaterThan(0.9);
      expect(rtp, m.name).toBeLessThan(1.0);
    }
  }, 120_000);
});
