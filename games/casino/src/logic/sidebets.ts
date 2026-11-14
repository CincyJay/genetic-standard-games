import type { Card } from './cards.ts';
import { isRed } from './cards.ts';

/**
 * Blackjack side bets, settled on the first two cards (plus the dealer's up card
 * for 21+3). Pays are "to 1"; the stake is returned with a win.
 */
export type PairResult = 'perfect' | 'colored' | 'mixed' | null;

/** Perfect Pairs: perfect (same suit) 25:1, colored (same color) 12:1, mixed 6:1. */
export const PAIR_PAYS: Record<Exclude<PairResult, null>, number> = { perfect: 25, colored: 12, mixed: 6 };

export function perfectPairs(a: Card, b: Card): PairResult {
  if (a.rank !== b.rank) return null;
  if (a.suit === b.suit) return 'perfect';
  if (isRed(a) === isRed(b)) return 'colored';
  return 'mixed';
}

export type ThreeResult = 'suitedTrips' | 'straightFlush' | 'trips' | 'straight' | 'flush' | null;

/** 21+3: your two cards and the dealer's up card as a three-card poker hand. */
export const THREE_PAYS: Record<Exclude<ThreeResult, null>, number> = {
  suitedTrips: 100,
  straightFlush: 40,
  trips: 30,
  straight: 10,
  flush: 5,
};

export const SIDE_NAMES: Record<string, string> = {
  perfect: 'Perfect Pair',
  colored: 'Colored Pair',
  mixed: 'Mixed Pair',
  suitedTrips: 'Suited Trips',
  straightFlush: 'Straight Flush',
  trips: 'Three of a Kind',
  straight: 'Straight',
  flush: 'Flush',
};

export function twentyOnePlusThree(a: Card, b: Card, up: Card): ThreeResult {
  const cs = [a, b, up];
  const flush = cs.every((c) => c.suit === a.suit);
  const ranks = cs.map((c) => c.rank).sort((x, y) => x - y);
  const trips = ranks[0] === ranks[2];
  const run = (r: number[]) => r[1] === r[0]! + 1 && r[2] === r[1]! + 1;
  // ace plays high (Q-K-A) or low (A-2-3)
  const straight = !trips && (run(ranks) || (ranks[2] === 14 && run([1, ranks[0]!, ranks[1]!])));
  if (trips && flush) return 'suitedTrips';
  if (straight && flush) return 'straightFlush';
  if (trips) return 'trips';
  if (straight) return 'straight';
  if (flush) return 'flush';
  return null;
}
