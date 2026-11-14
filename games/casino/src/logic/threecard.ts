import type { Card } from './cards.ts';

/**
 * Three Card Poker. Hand ranks, high to low: straight flush, three of a kind,
 * straight, flush, pair, high card (a straight beats a flush with three cards).
 * Ace plays high, or low in A-2-3. The dealer plays with queen high or better.
 */
export const CATEGORY = ['High card', 'Pair', 'Flush', 'Straight', 'Three of a kind', 'Straight flush'] as const;

export interface Rank3 {
  category: number;
  /** Tie-break ranks, high to low. */
  kickers: number[];
  name: string;
}

export function rank3(hand: Card[]): Rank3 {
  const r = hand.map((c) => c.rank).sort((a, b) => b - a);
  const flush = hand.every((c) => c.suit === hand[0]!.suit);
  const wheel = r[0] === 14 && r[1] === 3 && r[2] === 2;
  const straight = (r[0]! - r[1]! === 1 && r[1]! - r[2]! === 1) || wheel;
  const high = wheel ? [3, 2, 1] : r;
  let category = 0;
  let kickers: number[] = r;
  if (straight && flush) {
    category = 5;
    kickers = high;
  } else if (r[0] === r[2]) category = 4;
  else if (straight) {
    category = 3;
    kickers = high;
  } else if (flush) category = 2;
  else if (r[0] === r[1] || r[1] === r[2]) {
    category = 1;
    const pair = r[1]!;
    kickers = [pair, r[0] === pair ? r[2]! : r[0]!];
  }
  return { category, kickers, name: CATEGORY[category]! };
}

export function compare(a: Rank3, b: Rank3): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const d = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function dealerQualifies(r: Rank3): boolean {
  return r.category > 0 || r.kickers[0]! >= 12;
}

/** Pair Plus pays (to 1) by category; 0 = loses. */
export const PAIR_PLUS = [0, 1, 4, 6, 30, 40];
/** Ante bonus (to 1), paid on the ante whatever the dealer has. */
export const ANTE_BONUS = [0, 0, 0, 1, 4, 5];

export interface ThreeCardResult {
  /** Coins returned, stakes included. */
  back: number;
  outcome: 'fold' | 'no-qualify' | 'win' | 'lose' | 'push';
  player: Rank3;
  dealer: Rank3;
}

/** Settles a hand. `played` is false when the player folded. */
export function settleThreeCard(player: Card[], dealer: Card[], ante: number, pairPlus: number, played: boolean): ThreeCardResult {
  const p = rank3(player);
  const d = rank3(dealer);
  let back = 0;
  if (pairPlus && PAIR_PLUS[p.category]) back += pairPlus * (1 + PAIR_PLUS[p.category]!);
  if (!played) return { back, outcome: 'fold', player: p, dealer: d };
  const bonus = ante * ANTE_BONUS[p.category]!;
  back += bonus;
  if (!dealerQualifies(d)) return { back: back + ante * 2 + ante, outcome: 'no-qualify', player: p, dealer: d };
  const c = compare(p, d);
  if (c > 0) return { back: back + ante * 4, outcome: 'win', player: p, dealer: d };
  if (c === 0) return { back: back + ante * 2, outcome: 'push', player: p, dealer: d };
  return { back, outcome: 'lose', player: p, dealer: d };
}
