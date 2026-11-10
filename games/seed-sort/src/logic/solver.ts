import { applyMove, boardKey, cloneBoard, isSolved, usefulMoves, type Board, type Move } from './rules.ts';

export interface SolveResult {
  solution: Move[] | null;
  /** Positions examined: a rough measure of how "tangled" the level is. */
  explored: number;
}

/**
 * Estimate of remaining work: seeds sitting above the bottom run of each pot
 * must move at least once, and each color split across several pots needs merging.
 */
export function heuristic(b: Board): number {
  let misplaced = 0;
  const bottoms = new Map<number, number>();
  for (const pot of b.pots) {
    if (pot.length === 0) continue;
    let run = 1;
    while (run < pot.length && pot[run] === pot[0]) run++;
    misplaced += pot.length - run;
    bottoms.set(pot[0]!, (bottoms.get(pot[0]!) ?? 0) + 1);
  }
  let splits = 0;
  for (const count of bottoms.values()) splits += count - 1;
  return misplaced + splits;
}

/** Binary min-heap keyed on priority. */
class Heap<T> {
  private items: { p: number; v: T }[] = [];
  get size(): number {
    return this.items.length;
  }
  push(p: number, v: T): void {
    const a = this.items;
    a.push({ p, v });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent]!.p <= a[i]!.p) break;
      [a[parent], a[i]] = [a[i]!, a[parent]!];
      i = parent;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0]!.v;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.p < a[m]!.p) m = l;
        if (r < a.length && a[r]!.p < a[m]!.p) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

interface Node {
  board: Board;
  path: Move[];
}

/**
 * Weighted A* search. Not guaranteed to find the very shortest solution, but
 * finds a good one quickly, which is what hints and level grading need.
 */
export function solve(start: Board, maxExplored = 60_000, weight = 2): SolveResult {
  if (isSolved(start)) return { solution: [], explored: 0 };
  const open = new Heap<Node>();
  const seen = new Set<string>([boardKey(start)]);
  open.push(heuristic(start) * weight, { board: cloneBoard(start), path: [] });
  let explored = 0;

  while (open.size > 0 && explored < maxExplored) {
    const node = open.pop()!;
    explored++;
    for (const m of usefulMoves(node.board)) {
      const next = cloneBoard(node.board);
      applyMove(next, m.from, m.to);
      const key = boardKey(next);
      if (seen.has(key)) continue;
      seen.add(key);
      const path = [...node.path, m];
      if (isSolved(next)) return { solution: path, explored };
      open.push(path.length + heuristic(next) * weight, { board: next, path });
    }
  }
  return { solution: null, explored };
}

/** Best next move from the current position, or null if stuck / too complex. */
export function hint(b: Board, maxExplored = 20_000): Move | null {
  const r = solve(b, maxExplored);
  return r.solution?.[0] ?? null;
}
