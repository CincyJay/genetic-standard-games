import { describe, expect, it } from 'vitest';
import packed from '../src/levels/levels.json';
import { getLevel, PACKED_LEVEL_COUNT } from '../src/levels.ts';
import { generateLevel, starsFor } from '../src/logic/generator.ts';
import { applyMove, cloneBoard, isPotComplete, isSolved } from '../src/logic/rules.ts';
import { solve } from '../src/logic/solver.ts';

describe('level pack', () => {
  it('has at least 200 levels', () => {
    expect(PACKED_LEVEL_COUNT).toBeGreaterThanOrEqual(200);
  });

  it('every level is well formed, scrambled, and solvable by replaying a real solution', () => {
    for (let id = 1; id <= PACKED_LEVEL_COUNT; id++) {
      const level = getLevel(id);
      const counts = new Map<number, number>();
      for (const pot of level.pots) for (const s of pot) counts.set(s, (counts.get(s) ?? 0) + 1);
      for (const n of counts.values()) expect(n).toBe(level.capacity);
      expect(level.pots.some((p) => p.length === 0)).toBe(true);
      expect(level.pots.some((p) => p.length > 0 && isPotComplete(p, level.capacity))).toBe(false);

      const board = { pots: level.pots, capacity: level.capacity };
      const { solution } = solve(board);
      expect(solution, `level ${id} unsolvable`).not.toBeNull();
      const replay = cloneBoard(board);
      for (const m of solution!) expect(applyMove(replay, m.from, m.to)).toBeGreaterThan(0);
      expect(isSolved(replay)).toBe(true);
      expect(level.par).toBeGreaterThan(0);
    }
  });

  it('generation is deterministic (device-generated levels match the pack)', () => {
    for (const id of [2, 57, 150, 300]) {
      const fresh = generateLevel(id);
      expect(getLevel(id).pots).toEqual(fresh.pots);
    }
    expect((packed as unknown[]).length).toBe(PACKED_LEVEL_COUNT);
  });

  it('levels beyond the pack are generated on demand', () => {
    const l = getLevel(PACKED_LEVEL_COUNT + 1);
    expect(l.id).toBe(PACKED_LEVEL_COUNT + 1);
    expect(solve({ pots: l.pots, capacity: l.capacity }).solution).not.toBeNull();
  });

  it('awards stars against par', () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(13, 10)).toBe(2);
    expect(starsFor(20, 10)).toBe(1);
  });
});
