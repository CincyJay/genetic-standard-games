import type { Card, Random } from './cards.ts';
import { secureRandom } from './cards.ts';
import { deal, followSuit, next, removeCard, same, shuffled, sortHand, trickWinner, type Played } from './tricks.ts';

/**
 * Hearts: four players, no partners. Pass three cards (left, right, across,
 * then a hold round), the 2 of clubs leads, follow suit, no trump. Each heart
 * is a point and the queen of spades is 13; hearts can't be led until one has
 * been played, and no points on the first trick. Take all 26 and you shoot
 * the moon: everyone else gets 26. Lowest score wins when someone reaches the target.
 */
export const HEARTS_TARGET = 50;
export const PASS_NAMES = ['left', 'right', 'across', 'none'] as const;

const isQS = (c: Card) => c.suit === 's' && c.rank === 12;
export const cardPoints = (c: Card) => (c.suit === 'h' ? 1 : isQS(c) ? 13 : 0);

export class HeartsRound {
  hands: Card[][];
  phase: 'pass' | 'play' | 'done' = 'pass';
  /** 0 left, 1 right, 2 across, 3 no pass. */
  passDir: number;
  passes: (Card[] | null)[] = [null, null, null, null];
  trick: Played[] = [];
  turn = 0;
  tricksPlayed = 0;
  heartsBroken = false;
  taken: Card[][] = [[], [], [], []];
  lastTrick: { trick: Played[]; winner: number } | null = null;
  private rnd: Random;

  constructor(roundNo: number, rnd: Random = secureRandom) {
    this.rnd = rnd;
    this.hands = deal(shuffled(undefined, rnd), 13).hands.map((h) => sortHand(h));
    this.passDir = roundNo % 4;
    if (this.passDir === 3) this.startPlay();
  }

  get passTo(): (seat: number) => number {
    const by = [1, 3, 2, 0][this.passDir]!;
    return (seat) => next(seat, by);
  }

  /** A seat chooses three cards to pass; once all four have, cards move and play starts. */
  pass(seat: number, cards: Card[]): void {
    if (this.phase !== 'pass' || cards.length !== 3) return;
    this.passes[seat] = cards;
    if (this.passes.every(Boolean)) {
      this.passes.forEach((cs, s) => cs!.forEach((c) => removeCard(this.hands[s]!, c)));
      this.passes.forEach((cs, s) => this.hands[this.passTo(s)]!.push(...cs!));
      this.hands = this.hands.map((h) => sortHand(h));
      this.startPlay();
    }
  }

  private startPlay(): void {
    this.phase = 'play';
    this.turn = this.hands.findIndex((h) => h.some((c) => c.suit === 'c' && c.rank === 2));
  }

  legal(seat: number): Card[] {
    const hand = this.hands[seat]!;
    if (this.phase !== 'play' || seat !== this.turn) return [];
    if (this.tricksPlayed === 0 && !this.trick.length) return hand.filter((c) => c.suit === 'c' && c.rank === 2);
    let ok = followSuit(hand, this.trick, (c) => c.suit);
    if (!this.trick.length && !this.heartsBroken) {
      const nonHearts = ok.filter((c) => c.suit !== 'h');
      if (nonHearts.length) ok = nonHearts;
    }
    // no points on the first trick unless that's all you have
    if (this.tricksPlayed === 0) {
      const clean = ok.filter((c) => cardPoints(c) === 0);
      if (clean.length) ok = clean;
    }
    return ok;
  }

  play(seat: number, c: Card): number | null {
    if (!this.legal(seat).some((x) => same(x, c))) return null;
    removeCard(this.hands[seat]!, c);
    this.trick.push({ seat, card: c });
    if (c.suit === 'h') this.heartsBroken = true;
    if (this.trick.length < 4) {
      this.turn = next(seat);
      return null;
    }
    const w = trickWinner(this.trick, null, (x) => x.suit, (x) => x.rank);
    this.taken[w]!.push(...this.trick.map((p) => p.card));
    this.lastTrick = { trick: this.trick, winner: w };
    this.trick = [];
    this.tricksPlayed++;
    this.turn = w;
    if (this.tricksPlayed === 13) this.phase = 'done';
    return w;
  }

  /** Points each seat takes this round (after shooting the moon). */
  points(): number[] {
    const raw = this.taken.map((cs) => cs.reduce((s, c) => s + cardPoints(c), 0));
    const moon = raw.indexOf(26);
    return moon >= 0 ? raw.map((_, i) => (i === moon ? 0 : 26)) : raw;
  }

  // ---------------------------------------------------------------- computer players
  botPass(seat: number): Card[] {
    // get rid of the dangerous cards: queen, king, ace of spades and high hearts, then the highest cards
    const hand = this.hands[seat]!;
    const danger = (c: Card) => (c.suit === 's' && c.rank >= 12 ? 100 + c.rank : c.suit === 'h' ? 50 + c.rank : c.rank);
    return [...hand].sort((a, b) => danger(b) - danger(a)).slice(0, 3);
  }

  botPlay(seat: number): Card {
    const ok = this.legal(seat);
    const trick = this.trick;
    if (!trick.length) {
      // lead low, preferring short suits; avoid leading spades high
      return [...ok].sort((a, b) => a.rank - b.rank)[0]!;
    }
    const led = trick[0]!.card.suit;
    const following = ok[0]!.suit === led;
    const pts = trick.reduce((s, p) => s + cardPoints(p.card), 0);
    if (following) {
      const high = Math.max(...trick.filter((p) => p.card.suit === led).map((p) => p.card.rank));
      const under = ok.filter((c) => c.rank < high).sort((a, b) => b.rank - a.rank);
      // duck under the winner if possible; last to play on a clean trick can win cheaply with a high card
      if (under.length) return under[0]!;
      if (trick.length === 3 && pts === 0) return [...ok].sort((a, b) => b.rank - a.rank).find((c) => !isQS(c)) ?? ok[0]!;
      return [...ok].sort((a, b) => a.rank - b.rank)[0]!;
    }
    // void: dump the queen of spades, then high hearts, then the highest card
    const qs = ok.find(isQS);
    if (qs) return qs;
    const hearts = ok.filter((c) => c.suit === 'h').sort((a, b) => b.rank - a.rank);
    if (hearts.length) return hearts[0]!;
    return [...ok].sort((a, b) => b.rank - a.rank)[0]!;
  }
}
