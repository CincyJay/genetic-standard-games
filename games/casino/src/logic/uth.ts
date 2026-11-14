import { bestHand, type HandValue } from './poker.ts';
import type { Card } from './cards.ts';

/**
 * Ultimate Texas Hold'em. Ante and Blind (equal) go down, optionally Trips.
 * Preflop you may Play 4x or 3x the ante, or check; on the flop Play 2x or
 * check; on the river Play 1x or fold. One Play bet per hand. The dealer opens
 * with a pair or better; if not, the Ante pushes. Blind pays only on a
 * straight or better when you win; Trips pays on your own hand whatever the
 * dealer has.
 */
/** Blind pays (to 1) by hand category, when the player wins. Categories: 0 high .. 8 straight flush. */
export const BLIND_PAYS: Record<number, number> = { 4: 1, 5: 1.5, 6: 3, 7: 10, 8: 50 };
export const ROYAL_BLIND = 500;
/** Trips side bet (to 1). */
export const TRIPS_PAYS: Record<number, number> = { 3: 3, 4: 4, 5: 7, 6: 8, 7: 30, 8: 40 };
export const ROYAL_TRIPS = 50;

const isRoyal = (h: HandValue) => h.category === 8 && h.kickers[0] === 14;

export interface UthResult {
  back: number;
  outcome: 'fold' | 'win' | 'lose' | 'push';
  player: HandValue;
  dealer: HandValue;
  dealerOpens: boolean;
  blindPaid: number;
  tripsPaid: number;
}

/**
 * Settles a hand. `play` is the Play bet (0 = folded on the river). Returns
 * coins back, stakes included.
 */
export function settleUth(hole: Card[], dealerHole: Card[], board: Card[], ante: number, trips: number, play: number): UthResult {
  const p = bestHand([...hole, ...board]);
  const d = bestHand([...dealerHole, ...board]);
  const dealerOpens = d.category >= 1;
  let back = 0;
  let tripsPaid = 0;
  if (trips) {
    const t = isRoyal(p) ? ROYAL_TRIPS : TRIPS_PAYS[p.category];
    if (t) {
      tripsPaid = trips + Math.floor(trips * t);
      back += tripsPaid;
    }
  }
  if (!play) return { back, outcome: 'fold', player: p, dealer: d, dealerOpens, blindPaid: 0, tripsPaid };
  const blind = ante;
  let blindPaid = 0;
  if (p.score > d.score) {
    back += play * 2;
    back += dealerOpens ? ante * 2 : ante;
    const bp = isRoyal(p) ? ROYAL_BLIND : BLIND_PAYS[p.category];
    blindPaid = blind + (bp ? Math.floor(blind * bp) : 0);
    back += blindPaid;
    return { back, outcome: 'win', player: p, dealer: d, dealerOpens, blindPaid, tripsPaid };
  }
  if (p.score === d.score) return { back: back + play + ante + blind, outcome: 'push', player: p, dealer: d, dealerOpens, blindPaid: 0, tripsPaid };
  // loss: ante pushes when the dealer doesn't open
  if (!dealerOpens) back += ante;
  return { back, outcome: 'lose', player: p, dealer: d, dealerOpens, blindPaid: 0, tripsPaid };
}
