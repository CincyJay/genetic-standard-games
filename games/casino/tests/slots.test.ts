import { describe, expect, it } from 'vitest';
import { createRng } from '@tgs/kit/rng';
import { FREE_SPIN_MULTIPLIER, LINES, STRIPS, evaluate, spin, type Grid, type Sym } from '../src/logic/slots.ts';

/** Build a grid from rows of symbol names (rows top to bottom). */
function grid(rows: Sym[][]): Grid {
  return [0, 1, 2, 3, 4].map((reel) => rows.map((r) => r[reel]!));
}
const X: Sym = 'lemon';

describe('slots', () => {
  it('has 20 lines and five strips', () => {
    expect(LINES).toHaveLength(20);
    expect(STRIPS).toHaveLength(5);
  });

  it('pays a line of five, with wilds substituting', () => {
    const r = evaluate(
      grid([
        ['cherry', 'plum', 'bell', 'plum', 'cherry'],
        ['seven', 'wild', 'seven', 'seven', 'bar'],
        ['plum', 'cherry', 'plum', 'bell', 'plum'],
      ]),
      1,
    );
    const middle = r.lineWins.find((w) => w.line === 0)!;
    expect(middle).toMatchObject({ symbol: 'seven', count: 4, win: 115 });
  });

  it('pays scatters anywhere on the total bet and awards free spins', () => {
    const r = evaluate(
      grid([
        ['scatter', X, 'plum', X, 'scatter'],
        ['bell', 'cherry', 'scatter', 'bar', 'plum'],
        ['plum', 'bell', 'cherry', 'plum', 'bell'],
      ]),
      2,
    );
    expect(r.scatters).toBe(3);
    expect(r.scatterWin).toBe(2 * 2 * 20);
    expect(r.freeSpins).toBe(8);
  });

  it('returns about 95% over many spins, with free spins included', () => {
    const rnd = createRng(42);
    let bet = 0;
    let won = 0;
    for (let i = 0; i < 300_000; i++) {
      bet += 20;
      const r = spin(1, rnd);
      won += r.total;
      let fs = r.freeSpins;
      while (fs > 0) {
        fs--;
        const f = spin(1, rnd);
        won += f.total * FREE_SPIN_MULTIPLIER;
        fs += f.freeSpins;
      }
    }
    const rtp = won / bet;
    expect(rtp).toBeGreaterThan(0.9);
    expect(rtp).toBeLessThan(1.0);
  });
});
