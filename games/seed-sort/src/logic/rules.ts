/**
 * Seed Sort rules. Pure functions, no rendering: shared by the game, the
 * solver, the level generator and the tests.
 *
 * A board is a list of pots. Each pot holds seeds bottom -> top (index 0 is
 * the bottom). Seeds are color ids 0..n-1. Moving takes the run of same-colored
 * seeds on top of one pot and drops as many as fit onto another pot, which must
 * be empty or have the same color on top.
 */
export type Seed = number;
export type Pot = Seed[];

export interface Board {
  pots: Pot[];
  capacity: number;
}

export interface Move {
  from: number;
  to: number;
}

export function cloneBoard(b: Board): Board {
  return { capacity: b.capacity, pots: b.pots.map((p) => p.slice()) };
}

export function top(pot: Pot): Seed | undefined {
  return pot[pot.length - 1];
}

/** Number of same-colored seeds on top of the pot. */
export function topRunLength(pot: Pot): number {
  const t = top(pot);
  if (t === undefined) return 0;
  let n = 0;
  for (let i = pot.length - 1; i >= 0 && pot[i] === t; i--) n++;
  return n;
}

export function isPotComplete(pot: Pot, capacity: number): boolean {
  return pot.length === capacity && pot.every((s) => s === pot[0]);
}

export function canMove(b: Board, from: number, to: number): boolean {
  if (from === to) return false;
  const src = b.pots[from];
  const dst = b.pots[to];
  if (!src || !dst || src.length === 0) return false;
  if (dst.length >= b.capacity) return false;
  return dst.length === 0 || top(dst) === top(src);
}

/** How many seeds a move would transfer (0 if illegal). */
export function moveCount(b: Board, from: number, to: number): number {
  if (!canMove(b, from, to)) return 0;
  return Math.min(topRunLength(b.pots[from]!), b.capacity - b.pots[to]!.length);
}

/** Applies a move in place. Returns the number of seeds moved (0 if illegal). */
export function applyMove(b: Board, from: number, to: number): number {
  const n = moveCount(b, from, to);
  const src = b.pots[from]!;
  const dst = b.pots[to]!;
  for (let i = 0; i < n; i++) dst.push(src.pop()!);
  return n;
}

export function isSolved(b: Board): boolean {
  return b.pots.every((p) => p.length === 0 || isPotComplete(p, b.capacity));
}

/** All legal moves, with obviously useless ones pruned (used by solver and hints). */
export function usefulMoves(b: Board): Move[] {
  const moves: Move[] = [];
  let seenEmptyTarget = false;
  for (let to = 0; to < b.pots.length; to++) {
    const dst = b.pots[to]!;
    const isEmpty = dst.length === 0;
    if (isEmpty) {
      // All empty pots are equivalent: only consider the first one.
      if (seenEmptyTarget) continue;
      seenEmptyTarget = true;
    }
    for (let from = 0; from < b.pots.length; from++) {
      if (!canMove(b, from, to)) continue;
      const src = b.pots[from]!;
      if (isPotComplete(src, b.capacity)) continue;
      // Moving a single-color pot into an empty pot changes nothing.
      if (isEmpty && topRunLength(src) === src.length) continue;
      moves.push({ from, to });
    }
  }
  return moves;
}

/** Stable key for a position; pot order does not matter. */
export function boardKey(b: Board): string {
  return b.pots
    .map((p) => p.join(','))
    .sort()
    .join('|');
}
