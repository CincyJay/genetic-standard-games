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
