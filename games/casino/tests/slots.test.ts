import { describe, expect, it } from 'vitest';
import { createRng } from '@tgs/kit/rng';
import {
  DEEP_BLUE, GOLD_RUSH, LINES, LUCKY_WHEEL, luckyWheelEV, rollWildReels, spinLuckyWheel, LUCKY_LANTERNS, LUCKY_SEVENS, MACHINES, PHARAOH, bonusEV, evaluate, holdSpinRespin, holdSpinStart, holdSpinTotal, pickBoard, playHoldSpin,
  simulateRtp, strips, type Grid, type Machine,
  ROWS, HIGH_LIMIT, DIAMOND_EMPIRE, THUNDER_PEAK, TIGERS_TREASURE, MAX_TOTAL_BET, freeSpinMult, lineBetsOf,
} from '../src/logic/slots.ts';

/**
 * Build a grid from rows (top to bottom). Rows not given are padded with a
 * pattern of the machine's low symbols that never lines up three in a row.
 */
const grid = (rows: string[][], m: Machine = LUCKY_SEVENS): Grid => {
  const s = m.symbols;
  const pads = [[s[0], s[1], s[2], s[0], s[1]], [s[2], s[0], s[1], s[2], s[0]]] as string[][];
  const all = [...rows];
  while (all.length < ROWS) all.push(pads[(all.length - rows.length) % 2]!);
  return [0, 1, 2, 3, 4].map((reel) => all.map((r) => r[reel]!));
};

describe('slot engine', () => {
  it('every machine has its symbols ending in wild and scatter, 5 strips, and pays for each symbol', () => {
    expect(LINES).toHaveLength(50);
    expect(new Set(LINES.map((l) => l.join()))).toHaveProperty('size', 50);
    for (const l of LINES) l.forEach((row) => expect(row).toBeLessThan(ROWS));
    for (const m of MACHINES) {
      expect(m.symbols.length).toBeGreaterThanOrEqual(9);
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
    expect(r.lineWins.find((w) => w.line === 1)).toMatchObject({ symbol: 'seven', count: 4, win: Math.round(115 * LUCKY_SEVENS.payScale!) });
  });

  it('scatters trigger each machine’s feature', () => {
    const rows = (m: string) => [
      ['scatter', m, m, m, 'scatter'],
      [m, m, 'scatter', m, m],
      [m, m, m, m, m],
    ];
    expect(evaluate(LUCKY_SEVENS, grid(rows('lemon').map((r) => r.map((x, i) => (x === 'lemon' ? ['lemon', 'cherry', 'plum', 'bell', 'bar'][i]! : x)))), 1).freeSpins).toBe(8);
    expect(evaluate(PHARAOH, grid(rows('ankh').map((r) => r.map((x, i) => (x === 'ankh' ? ['ankh', 'eye', 'scarab', 'cat', 'pyramid'][i]! : x))), PHARAOH), 1).bonus).toBe('pick');
    expect(evaluate(GOLD_RUSH, grid(rows('pick').map((r) => r.map((x, i) => (x === 'pick' ? ['pick', 'lantern', 'pan', 'cart', 'dynamite'][i]! : x))), GOLD_RUSH), 1).bonus).toBe('wheel');
  });

  it('Deep Blue wilds on reels 2-4 expand to fill the reel', () => {
    const r = evaluate(DEEP_BLUE, grid([
      ['shark', 'fish', 'shell', 'turtle', 'pearl'],
      ['shark', 'wild', 'shark', 'fish', 'shell'],
      ['fish', 'turtle', 'octopus', 'shell', 'fish'],
    ], DEEP_BLUE), 1);
    expect(r.expanded).toEqual([1]);
    expect(r.final[1]).toEqual(new Array(ROWS).fill('wild'));
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
      // big-hit features (Wild Reels, Hold & Spin Grand) make short samples noisy, so the band is wide
      const { rtp } = simulateRtp(m, 400_000, createRng(99));
      expect(rtp, m.name).toBeGreaterThan(0.88);
      expect(rtp, m.name).toBeLessThan(1.02);
    }
  }, 120_000);

  describe('Hold & Spin (Lucky Lanterns)', () => {
    // the first seven cells (reel by reel) hold lanterns
    const six: Grid = [0, 1, 2, 3, 4].map((r) => Array.from({ length: ROWS }, (_, row) => (r * ROWS + row < 7 ? 'scatter' : 'ten')));

    it('lanterns stack on the strips so six or more can land', () => {
      const s0 = strips(LUCKY_LANTERNS)[0]!;
      const runs = s0.filter((s, i) => s === 'scatter' && s0[(i + 1) % s0.length] === 'scatter' && s0[(i + 2) % s0.length] === 'scatter');
      expect(runs.length).toBeGreaterThan(0);
    });

    it('seven lanterns start the feature; six do not', () => {
      expect(evaluate(LUCKY_LANTERNS, six, 1).bonus).toBe('holdspin');
      const five = six.map((col, r) => col.map((s, row) => (r === 1 && row === 1 ? 'ten' : s)));
      expect(evaluate(LUCKY_LANTERNS, five, 1).bonus).toBeNull();
      expect(evaluate(LUCKY_LANTERNS, five, 1).coins).toBe(6);
    });

    it('locks the triggering lanterns and only fills empty cells', () => {
      const rnd = createRng(3);
      const board = holdSpinStart(LUCKY_LANTERNS, six, rnd);
      expect(board.filter(Boolean)).toHaveLength(7);
      const before = board.map((c) => c);
      const landed = holdSpinRespin(LUCKY_LANTERNS, board, () => 0); // every empty cell lands
      expect(landed).toHaveLength(5 * ROWS - 7);
      before.forEach((c, i) => c && expect(board[i]).toBe(c));
    });

    it('a full board adds the Grand jackpot', () => {
      const board = Array.from({ length: 5 * ROWS }, () => ({ mult: 1 }));
      expect(holdSpinTotal(LUCKY_LANTERNS, board)).toEqual({ mult: 5 * ROWS + LUCKY_LANTERNS.holdSpin!.grand, grand: true });
      board[3] = null as never;
      expect(holdSpinTotal(LUCKY_LANTERNS, board).grand).toBe(false);
    });

    it('the feature ends after three respins with no new lantern', () => {
      let calls = 0;
      const r = playHoldSpin(LUCKY_LANTERNS, six, () => (calls++ < 7 ? 0.5 : 0.99)); // values, then nothing lands
      expect(r.board.filter(Boolean)).toHaveLength(7);
      expect(r.grand).toBe(false);
    });
  });

  describe('extras on every machine', () => {
    it('Wild Reels turns 2 or 3 of the middle reels fully wild', () => {
      let seen = 0;
      const rnd = createRng(12);
      for (let i = 0; i < 20000; i++) {
        const w = rollWildReels(rnd);
        if (!w.length) continue;
        seen++;
        expect(w.length === 2 || w.length === 3).toBe(true);
        w.forEach((r) => expect([1, 2, 3]).toContain(r));
      }
      expect(seen).toBeGreaterThan(150);
      expect(seen).toBeLessThan(400);
      const r = evaluate(LUCKY_SEVENS, grid([
        ['cherry', 'plum', 'bell', 'plum', 'cherry'],
        ['seven', 'bar', 'lemon', 'seven', 'bar'],
        ['plum', 'cherry', 'plum', 'bell', 'plum'],
      ]), 1, [1, 2]);
      expect(r.final[1]).toEqual(new Array(ROWS).fill('wild'));
      expect(r.lineWins.some((w) => w.symbol === 'seven' && w.count === 4)).toBe(true);
      expect(r.jackpot).toBe(false);
    });

    it('the Lucky Wheel lands on every wedge and pays at least 5x', () => {
      const rnd = createRng(4);
      const hits = new Set<number>();
      for (let i = 0; i < 5000; i++) hits.add(spinLuckyWheel(rnd));
      expect(hits.size).toBe(LUCKY_WHEEL.prizes.length);
      expect(Math.min(...LUCKY_WHEEL.prizes)).toBe(5);
      expect(luckyWheelEV()).toBeGreaterThan(10);
    });
  });
});

describe('high-limit machines', () => {
  it('have their own, much bigger bets', () => {
    for (const m of HIGH_LIMIT) {
      expect(lineBetsOf(m)[0]!).toBeGreaterThanOrEqual(10);
      expect(lineBetsOf(m).at(-1)! * LINES.length).toBeGreaterThan(MAX_TOTAL_BET);
    }
  });
  it('Diamond Empire free spins climb x2, x3, x4…', () => {
    expect([0, 1, 2, 5].map((k) => freeSpinMult(DIAMOND_EMPIRE, k))).toEqual([2, 3, 4, 7]);
  });
  it('Thunder Peak wilds double a line, up to x8', () => {
    const m = THUNDER_PEAK;
    const rowsOf = (syms: string[]) => [syms, ['ten', 'ten', 'ten', 'ten', 'ten'], ['jack', 'jack', 'jack', 'jack', 'jack']];
    const g = (syms: string[]) => grid(rowsOf(syms), m);
    const plain = evaluate(m, g(['bolt', 'bolt', 'bolt', 'queen', 'king']), 100).lineWins.find((w) => w.line === 0)!.win;
    const one = evaluate(m, g(['bolt', 'wild', 'bolt', 'queen', 'king']), 100).lineWins.find((w) => w.line === 0)!.win;
    const four = evaluate(m, g(['bolt', 'wild', 'wild', 'wild', 'wild']), 100).lineWins.find((w) => w.line === 0)!;
    expect(one).toBe(plain * 2);
    expect(four.symbol).toBe('bolt');
    expect(four.win).toBe(Math.round(m.pays.bolt![2]! * m.payScale! * 100 * 8));
  });
  it('pay by line: only the chosen lines pay, scatters pay on the total bet', () => {
    const rows = [['seven', 'seven', 'seven', 'plum', 'bell'], ['bar', 'bar', 'bar', 'plum', 'bell'], ['scatter', 'lemon', 'scatter', 'cherry', 'scatter']];
    const all = evaluate(LUCKY_SEVENS, grid(rows), 10);
    const one = evaluate(LUCKY_SEVENS, grid(rows), 10, [], 1);
    expect(all.lineWins.some((w) => w.line === 1)).toBe(true);
    expect(one.lineWins.every((w) => w.line === 0)).toBe(true);
    expect(one.scatterWin).toBe(LUCKY_SEVENS.scatterPays[0] * 10);
    expect(all.scatterWin).toBe(LUCKY_SEVENS.scatterPays[0] * 10 * LINES.length);
  });
  it("Tiger's Treasure opens 4 tiles", () => {
    const p = TIGERS_TREASURE.pickPrizes!;
    expect(bonusEV(TIGERS_TREASURE)).toBeCloseTo((4 * p.reduce((a, b) => a + b, 0)) / p.length);
  });
  it('each returns roughly 96% over many spins', () => {
    for (const m of HIGH_LIMIT) {
      const { rtp } = simulateRtp(m, 200_000, createRng(99));
      expect(rtp).toBeGreaterThan(0.85);
      expect(rtp).toBeLessThan(1.05);
    }
  }, 120_000);
});
