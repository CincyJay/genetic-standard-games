import { describe, expect, it } from 'vitest';
import { reelPoses, stopTime, symbolAt, travelRows, type SpinPlan } from '../src/floor3d/reelSpin';

const plan: SpinPlan = { targets: [2, 0, 4], stripLength: 6, from: [5, 1, 4] };

describe('reelSpin', () => {
  it('lands every reel exactly on its target', () => {
    const end = reelPoses(plan, 99);
    end.forEach((p, i) => {
      expect(p.stopped).toBe(true);
      expect(Number.isInteger(p.pos)).toBe(true);
      expect(symbolAt(p.pos, 1, 3, 6)).toBe(plan.targets[i]);
    });
  });

  it('starts where each reel was', () => {
    expect(reelPoses(plan, 0).map((p) => p.pos)).toEqual([5, 1, 4]);
  });

  it('moves forward only and never overshoots', () => {
    const travel = travelRows(plan);
    let prev = reelPoses(plan, 0).map((p) => p.pos);
    for (let t = 0.02; t < 3; t += 0.02) {
      const now = reelPoses(plan, t).map((p) => p.pos);
      now.forEach((x, i) => {
        expect(x).toBeGreaterThanOrEqual(prev[i]! - 1e-9);
        expect(x).toBeLessThanOrEqual((plan.from?.[i] ?? 0) + travel[i]! + 1e-9);
      });
      prev = now;
    }
  });

  it('stops reels left to right', () => {
    expect(stopTime(plan, 0)).toBeLessThan(stopTime(plan, 1));
    expect(stopTime(plan, 1)).toBeLessThan(stopTime(plan, 2));
    const mid = reelPoses(plan, (stopTime(plan, 0) + stopTime(plan, 1)) / 2);
    expect(mid.map((p) => p.stopped)).toEqual([true, false, false]);
  });

  it('spins at least the minimum turns', () => {
    travelRows({ ...plan, minTurns: 3 }).forEach((r) => expect(r).toBeGreaterThanOrEqual(18));
  });

  it('wraps rows around the strip', () => {
    expect(symbolAt(0, 0, 3, 6)).toBe(5);
    expect(symbolAt(5.7, 2, 3, 6)).toBe(0);
  });
});

describe('slot-engine wiring (Svelte preview)', async () => {
  const { MACHINES, ROWS, LINES, strips, spinStops, gridFromStops, evaluate } = await import('../src/logic/slots');
  const { targetsFromStops, winningCells } = await import('../src/floor3d/reelSpin');
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  it('lands every reel showing exactly the engine grid, for every machine', () => {
    for (const m of MACHINES) {
      const st = strips(m);
      const lens = st.map((s) => s.length);
      for (let k = 0; k < 20; k++) {
        const stops = spinStops(m, rnd);
        const p: SpinPlan = { targets: targetsFromStops(stops, lens, ROWS), stripLength: lens[0]!, stripLengths: lens, from: lens.map((n) => Math.floor(rnd() * n)), minTurns: 1 };
        const landed = reelPoses(p, 99);
        const shown = landed.map((pose, r) => Array.from({ length: ROWS }, (_, row) => st[r]![symbolAt(pose.pos, row, ROWS, lens[r]!)]!));
        expect(shown).toEqual(gridFromStops(m, stops));
      }
    }
  });

  it('per-reel strip lengths drive travel', () => {
    const t = travelRows({ targets: [3, 3], stripLength: 0, stripLengths: [10, 20], from: [0, 0], minTurns: 1 });
    expect(t).toEqual([13, 43]);
  });

  it('winning cells follow each line for its count only', () => {
    const cells = winningCells([{ line: 0, count: 3 }], LINES, ROWS);
    expect([...cells].sort((a, b) => a - b)).toEqual([0, 5, 10].map((c) => c + LINES[0]![0]!));
    const m = MACHINES[0]!;
    const grid = Array.from({ length: 5 }, () => new Array(ROWS).fill(m.symbols[0]));
    const res = evaluate(m, grid, 1);
    expect(winningCells(res.lineWins, LINES, ROWS).size).toBe(25);
  });
});
