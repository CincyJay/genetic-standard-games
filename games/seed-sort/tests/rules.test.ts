import { describe, expect, it } from 'vitest';
import { applyMove, canMove, isSolved, moveCount, usefulMoves, type Board } from '../src/logic/rules.ts';

const b = (pots: number[][], capacity = 4): Board => ({ pots, capacity });

describe('rules', () => {
  it('allows moves onto an empty pot or a matching top', () => {
    const board = b([[0, 1], [1], [], [2]]);
    expect(canMove(board, 0, 1)).toBe(true);
    expect(canMove(board, 0, 2)).toBe(true);
    expect(canMove(board, 0, 3)).toBe(false);
    expect(canMove(board, 2, 0)).toBe(false); // empty source
    expect(canMove(board, 0, 0)).toBe(false);
  });

  it('refuses moves into a full pot', () => {
    expect(canMove(b([[1], [1, 1, 1, 1]]), 0, 1)).toBe(false);
  });

  it('moves the whole top run, limited by free space', () => {
    const board = b([[0, 2, 2, 2], [1, 1, 2], []]);
    expect(moveCount(board, 0, 1)).toBe(1);
    expect(applyMove(board, 0, 1)).toBe(1);
    expect(board.pots).toEqual([[0, 2, 2], [1, 1, 2, 2], []]);
    expect(applyMove(board, 0, 2)).toBe(2);
    expect(board.pots[2]).toEqual([2, 2]);
  });

  it('detects solved boards', () => {
    expect(isSolved(b([[0, 0, 0, 0], [], [1, 1, 1, 1]]))).toBe(true);
    expect(isSolved(b([[0, 0, 0], [0], [1, 1, 1, 1]]))).toBe(false);
  });

  it('prunes pointless moves', () => {
    // moving a single-color pot into an empty one is pointless; only one empty target is considered
    const moves = usefulMoves(b([[0, 0], [1, 0], [], []]));
    expect(moves).toContainEqual({ from: 1, to: 0 });
    expect(moves).not.toContainEqual({ from: 0, to: 2 });
    expect(moves.filter((m) => m.to === 3)).toHaveLength(0);
  });
});
