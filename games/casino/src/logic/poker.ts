import type { Card } from './cards.ts';

/** Poker hand categories, weakest to strongest. */
export const CATEGORY = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
] as const;
export type Category = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface HandValue {
  category: Category;
  /** Ranks that break ties, most important first. */
  kickers: number[];
  /** Single comparable number: higher is better. */
  score: number;
  name: string;
  /** The five cards that make the hand. */
  cards: Card[];
}

function scoreOf(category: number, kickers: number[]): number {
  let s = category;
  for (let i = 0; i < 5; i++) s = s * 15 + (kickers[i] ?? 0);
  return s;
}

/** Highest straight in a set of ranks (5 for the wheel A-2-3-4-5), or 0. */
function straightHigh(ranks: number[]): number {
  const set = new Set(ranks);
  if (set.has(14)) set.add(1);
  for (let hi = 14; hi >= 5; hi--) {
    let ok = true;
    for (let k = 0; k < 5; k++) if (!set.has(hi - k)) ok = false;
    if (ok) return hi;
  }
  return 0;
}

/** Evaluate exactly five cards. */
export function evaluate5(cs: Card[]): HandValue {
  const ranks = cs.map((c) => c.rank).sort((a, b) => b - a);
  const flush = cs.every((c) => c.suit === cs[0]!.suit);
  const sHigh = straightHigh(ranks);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // groups sorted by count, then rank
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const byGroup = groups.map((g) => g[0]);
  let category: Category;
  let kickers: number[];
  if (flush && sHigh) [category, kickers] = [8, [sHigh]];
  else if (groups[0]![1] === 4) [category, kickers] = [7, byGroup];
  else if (groups[0]![1] === 3 && groups[1]![1] === 2) [category, kickers] = [6, byGroup];
  else if (flush) [category, kickers] = [5, ranks];
  else if (sHigh) [category, kickers] = [4, [sHigh]];
  else if (groups[0]![1] === 3) [category, kickers] = [3, byGroup];
  else if (groups[0]![1] === 2 && groups[1]![1] === 2) [category, kickers] = [2, byGroup];
  else if (groups[0]![1] === 2) [category, kickers] = [1, byGroup];
  else [category, kickers] = [0, ranks];
  let name: string = CATEGORY[category];
  if (category === 8 && sHigh === 14) name = 'Royal Flush';
  return { category, kickers, score: scoreOf(category, kickers), name, cards: cs };
}

/** Best five-card hand from 5 to 7 cards. */
export function bestHand(cs: Card[]): HandValue {
  if (cs.length === 5) return evaluate5(cs);
  let best: HandValue | null = null;
  const n = cs.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const v = evaluate5([cs[a]!, cs[b]!, cs[c]!, cs[d]!, cs[e]!]);
            if (!best || v.score > best.score) best = v;
          }
  return best!;
}
