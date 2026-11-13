import { describe, expect, it } from 'vitest';
import { WHEEL_ORDER, colorOf, payoutMultiple, settle, wins } from '../src/logic/roulette.ts';

describe('roulette (European)', () => {
  it('has 37 pockets, 18 red and 18 black', () => {
    expect(new Set(WHEEL_ORDER).size).toBe(37);
    const colors = WHEEL_ORDER.map(colorOf);
    expect(colors.filter((c) => c === 'red')).toHaveLength(18);
    expect(colors.filter((c) => c === 'black')).toHaveLength(18);
  });

  it('settles every bet type correctly', () => {
    expect(wins({ type: 'straight', n: 17 }, 17)).toBe(true);
    expect(wins({ type: 'red' }, 0)).toBe(false); // zero loses outside bets
    expect(wins({ type: 'dozen', n: 2 }, 24)).toBe(true);
    expect(wins({ type: 'column', n: 1 }, 34)).toBe(true);
    expect(wins({ type: 'high' }, 19)).toBe(true);
    expect(settle([{ spot: { type: 'straight', n: 7 }, amount: 10 }], 7)).toBe(360);
    expect(settle([{ spot: { type: 'black' }, amount: 50 }, { spot: { type: 'odd' }, amount: 50 }], 7)).toBe(100);
  });

  it('every bet has the same 2.7% house edge', () => {
    const spots = [
      { type: 'straight', n: 5 },
      { type: 'red' },
      { type: 'even' },
      { type: 'dozen', n: 3 },
      { type: 'column', n: 2 },
    ] as const;
    for (const s of spots) {
      let ret = 0;
      for (let n = 0; n <= 36; n++) ret += wins(s, n) ? payoutMultiple(s) + 1 : 0;
      expect(ret / 37).toBeCloseTo(36 / 37, 10);
    }
  });
});
