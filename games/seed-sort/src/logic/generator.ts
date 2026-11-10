import { createRng, shuffle, type Rng } from '@tgs/kit/rng';
import { isPotComplete, type Board } from './rules.ts';
import { solve } from './solver.ts';

export interface LevelSpec {
  colors: number;
  capacity: number;
  emptyPots: number;
}

export interface Level {
  id: number;
  capacity: number;
  pots: number[][];
  /** Target move count (solver's solution length). Beat it for 3 stars. */
  par: number;
  /** 0-100 difficulty score used to shape the curve. */
  difficulty: number;
}

/**
 * Difficulty curve. Colors ramp up slowly; every 5th level is a breather and
 * every 10th is a tougher "challenge". Tuned by playtesting + analytics later
 * (Week 3 moves these numbers to Remote Config).
 */
export function specForLevel(id: number): LevelSpec {
  if (id <= 2) return { colors: 3, capacity: 4, emptyPots: 2 };
  if (id <= 5) return { colors: 4, capacity: 4, emptyPots: 2 };
  const base = Math.min(5 + Math.floor((id - 6) / 8), 11);
  let colors = base;
  if (id % 5 === 0) colors = Math.max(4, base - 2); // breather
  if (id % 10 === 0) colors = Math.min(12, base + 1); // challenge
  return { colors, capacity: 4, emptyPots: 2 };
}

/** Target difficulty 0-100 for a level, rising with a gentle sawtooth. */
export function targetDifficulty(id: number): number {
  const ramp = Math.min(85, 10 + id * 0.6);
  if (id % 10 === 0) return Math.min(100, ramp + 12);
  if (id % 5 === 0) return Math.max(5, ramp - 15);
  return ramp;
}

/** Hand-made first level: 2 colors, solvable in 3 moves, teaches the core rule. */
export const TUTORIAL_LEVEL: Level = {
  id: 1,
  capacity: 4,
  pots: [[0, 0, 0, 1], [1, 1, 1, 0], []],
  par: 3,
  difficulty: 0,
};

function randomBoard(rng: Rng, spec: LevelSpec): Board {
  const seeds: number[] = [];
  for (let c = 0; c < spec.colors; c++) for (let i = 0; i < spec.capacity; i++) seeds.push(c);
  shuffle(rng, seeds);
  const pots: number[][] = [];
  for (let p = 0; p < spec.colors; p++) pots.push(seeds.slice(p * spec.capacity, (p + 1) * spec.capacity));
  for (let e = 0; e < spec.emptyPots; e++) pots.push([]);
  return { pots, capacity: spec.capacity };
}

/** Reject boards that start too easy: finished pots or lots of seeds already together. */
function looksScrambled(b: Board): boolean {
  let adjacentSame = 0;
  for (const pot of b.pots) {
    if (pot.length > 0 && isPotComplete(pot, b.capacity)) return false;
    for (let i = 1; i < pot.length; i++) if (pot[i] === pot[i - 1]) adjacentSame++;
    if (pot.length >= 3 && pot.slice(0, 3).every((s) => s === pot[0])) return false;
  }
  const filled = b.pots.filter((p) => p.length > 0).length;
  return adjacentSame <= Math.ceil(filled * 0.5);
}

/** Map solver output to a 0-100 score. */
export function scoreDifficulty(solutionLength: number, explored: number, colors: number): number {
  const lengthPart = Math.min(50, (solutionLength / (colors * 3)) * 35);
  const searchPart = Math.min(50, Math.log10(Math.max(1, explored)) * 12);
  return Math.round(lengthPart + searchPart);
}

/**
 * Deterministically generate level `id`: try several scrambles, keep only
 * solvable ones, and pick the one closest to the target difficulty.
 */
export function generateLevel(id: number, candidates = 8): Level {
  if (id === 1) return TUTORIAL_LEVEL;
  const spec = specForLevel(id);
  const rng = createRng(0x5eed + id * 7919);
  const target = targetDifficulty(id);
  let best: Level | null = null;
  let attempts = 0;

  while ((best === null || attempts < candidates) && attempts < 200) {
    attempts++;
    const board = randomBoard(rng, spec);
    if (!looksScrambled(board)) continue;
    const { solution, explored } = solve(board);
    if (!solution) continue;
    const difficulty = scoreDifficulty(solution.length, explored, spec.colors);
    const level: Level = { id, capacity: spec.capacity, pots: board.pots, par: solution.length, difficulty };
    if (!best || Math.abs(difficulty - target) < Math.abs(best.difficulty - target)) best = level;
  }
  if (!best) throw new Error(`Could not generate a solvable level ${id}`);
  // Tighten par with a slower, closer-to-optimal search where the board is small enough.
  const exact = solve({ pots: best.pots, capacity: best.capacity }, 150_000, 1).solution;
  if (exact && exact.length < best.par) best.par = exact.length;
  return best;
}

/** 3 stars at or under par, 2 stars within 35% over, otherwise 1. */
export function starsFor(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.35)) return 2;
  return 1;
}
