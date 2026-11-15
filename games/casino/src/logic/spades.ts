import type { Card, Random } from './cards.ts';
import { secureRandom } from './cards.ts';
import { deal, followSuit, next, removeCard, same, shuffled, sortHand, trickWinner, type Played } from './tricks.ts';

/**
 * Spades: partners (seats 0+2 against 1+3), spades are always trump and can't
 * be led until broken. Everyone bids the tricks they expect to take (0 = Nil).
 * A team that makes its combined bid scores 10 per trick bid plus 1 per extra
 * trick (a "bag"); every 10 bags costs 100. Missing the bid loses 10 per trick
 * bid. Nil scores 100 if the bidder takes no tricks, else -100.
 */
export const SPADES_TARGET = 250;
export const team = (seat: number) => seat % 2;

export class SpadesRound {
  hands: Card[][];
  phase: 'bid' | 'play' | 'done' = 'bid';
  bids: (number | null)[] = [null, null, null, null];
  dealer: number;
  turn: number;
  trick: Played[] = [];
  tricks = [0, 0, 0, 0];
  tricksPlayed = 0;
  broken = false;
  lastTrick: { trick: Played[]; winner: number } | null = null;

  constructor(dealer: number, rnd: Random = secureRandom) {
    this.dealer = dealer;
    this.hands = deal(shuffled(undefined, rnd), 13).hands.map((h) => sortHand(h, undefined, undefined, 's'));
    this.turn = next(dealer);
  }

  bid(seat: number, n: number): void {
    if (this.phase !== 'bid' || seat !== this.turn) return;
    this.bids[seat] = Math.max(0, Math.min(13, n));
    this.turn = next(seat);
    if (this.bids.every((b) => b !== null)) {
      this.phase = 'play';
      this.turn = next(this.dealer);
    }
  }

  legal(seat: number): Card[] {
    if (this.phase !== 'play' || seat !== this.turn) return [];
    const hand = this.hands[seat]!;
    if (!this.trick.length && !this.broken) {
      const other = hand.filter((c) => c.suit !== 's');
      if (other.length) return other;
    }
    return followSuit(hand, this.trick, (c) => c.suit);
  }

  play(seat: number, c: Card): number | null {
    if (!this.legal(seat).some((x) => same(x, c))) return null;
    removeCard(this.hands[seat]!, c);
    this.trick.push({ seat, card: c });
    if (c.suit === 's') this.broken = true;
    if (this.trick.length < 4) {
      this.turn = next(seat);
      return null;
    }
    const w = trickWinner(this.trick, 's', (x) => x.suit, (x) => x.rank);
    this.tricks[w]!++;
    this.lastTrick = { trick: this.trick, winner: w };
    this.trick = [];
    this.tricksPlayed++;
    this.turn = w;
    if (this.tricksPlayed === 13) this.phase = 'done';
    return w;
  }

  /** Points and bags for each team this round. */
  score(): { points: [number, number]; bags: [number, number] } {
    const points: [number, number] = [0, 0];
    const bags: [number, number] = [0, 0];
    for (const t of [0, 1]) {
      const seats = [t, t + 2];
      let bid = 0;
      let took = 0;
      for (const s of seats) {
        const b = this.bids[s]!;
        if (b === 0) points[t] += this.tricks[s] === 0 ? 100 : -100;
        else bid += b;
        took += this.tricks[s]!;
      }
      // tricks taken by a nil bidder still count toward the partner's bid
      if (bid > 0) {
        if (took >= bid) {
          points[t] += bid * 10 + (took - bid);
          bags[t] = took - bid;
        } else points[t] -= bid * 10;
      }
    }
    return { points, bags };
  }

  // ---------------------------------------------------------------- computer players
  botBid(seat: number): number {
    const hand = this.hands[seat]!;
    let est = 0;
    for (const suit of ['c', 'd', 'h'] as const) {
      const cs = hand.filter((c) => c.suit === suit);
      if (cs.some((c) => c.rank === 14)) est += 1;
      if (cs.some((c) => c.rank === 13) && cs.length >= 2 && cs.length <= 5) est += 0.8;
      if (cs.length <= 1) est += 0.4;
    }
    const spades = hand.filter((c) => c.suit === 's');
    est += spades.filter((c) => c.rank >= 12).length + Math.max(0, spades.length - 3) * 0.7;
    const n = Math.round(est);
    if (n === 0 && spades.length <= 2 && !hand.some((c) => c.rank >= 13)) return 0;
    return Math.max(1, n);
  }

  botPlay(seat: number): Card {
    const ok = this.legal(seat);
    const byRank = (a: Card, b: Card) => a.rank - b.rank;
    const nil = this.bids[seat] === 0;
    if (!this.trick.length) {
      if (nil) return [...ok].sort(byRank)[0]!;
      const aces = ok.filter((c) => c.rank === 14 && c.suit !== 's');
      return aces[0] ?? [...ok].sort(byRank)[0]!;
    }
    // who is winning the trick so far
    const w = trickWinner(this.trick, 's', (x) => x.suit, (x) => x.rank);
    const partnerWinning = team(w) === team(seat);
    const wins = (c: Card) => trickWinner([...this.trick, { seat, card: c }], 's', (x) => x.suit, (x) => x.rank) === seat;
    const winners = ok.filter(wins).sort(byRank);
    const losers = ok.filter((c) => !wins(c)).sort(byRank);
    const teamTook = this.tricks[team(seat)]! + this.tricks[team(seat) + 2]!;
    const teamBid = (this.bids[team(seat)] ?? 0) + (this.bids[team(seat) + 2] ?? 0);
    if (nil || partnerWinning || teamTook >= teamBid) return losers[0] ?? winners[0]!;
    return winners[0] ?? losers[0]!;
  }
}

/** Applies a round's score to running totals, with the 10-bag penalty. */
export function addSpadesScore(totals: [number, number], bags: [number, number], round: ReturnType<SpadesRound['score']>): void {
  for (const t of [0, 1]) {
    totals[t] += round.points[t]!;
    bags[t] += round.bags[t]!;
    if (bags[t]! >= 10) {
      totals[t] -= 100;
      bags[t] -= 10;
    }
  }
}
