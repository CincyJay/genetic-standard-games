import { newDeck, shuffle, type Card, type Random, secureRandom } from './cards.ts';
import { evaluate5 } from './poker.ts';

/** Jacks or Better, full-pay 9/6 table. Pays per coin bet; royal pays 800 at 5 coins. */
export const PAYTABLE = [
  { key: 'royal', name: 'Royal Flush', pays: [250, 500, 750, 1000, 4000] },
  { key: 'straightFlush', name: 'Straight Flush', pays: [50, 100, 150, 200, 250] },
  { key: 'quads', name: 'Four of a Kind', pays: [25, 50, 75, 100, 125] },
  { key: 'fullHouse', name: 'Full House', pays: [9, 18, 27, 36, 45] },
  { key: 'flush', name: 'Flush', pays: [6, 12, 18, 24, 30] },
  { key: 'straight', name: 'Straight', pays: [4, 8, 12, 16, 20] },
  { key: 'trips', name: 'Three of a Kind', pays: [3, 6, 9, 12, 15] },
  { key: 'twoPair', name: 'Two Pair', pays: [2, 4, 6, 8, 10] },
  { key: 'jacks', name: 'Jacks or Better', pays: [1, 2, 3, 4, 5] },
] as const;
export type PayKey = (typeof PAYTABLE)[number]['key'];

export function classify(hand: Card[]): PayKey | null {
  const v = evaluate5(hand);
  switch (v.category) {
    case 8:
      return v.kickers[0] === 14 ? 'royal' : 'straightFlush';
    case 7:
      return 'quads';
    case 6:
      return 'fullHouse';
    case 5:
      return 'flush';
    case 4:
      return 'straight';
    case 3:
      return 'trips';
    case 2:
      return 'twoPair';
    case 1:
      return v.kickers[0]! >= 11 ? 'jacks' : null;
    default:
      return null;
  }
}

/** Multiplier of the per-coin value for a hand at `coins` (1..5). */
export function payFor(key: PayKey | null, coins: number): number {
  if (!key) return 0;
  return PAYTABLE.find((p) => p.key === key)!.pays[coins - 1]!;
}

export class VideoPokerRound {
  readonly hand: Card[];
  readonly held = [false, false, false, false, false];
  drawn = false;
  private readonly deck: Card[];
  constructor(rnd: Random = secureRandom, deck?: Card[]) {
    this.deck = deck ?? shuffle(newDeck(), rnd);
    this.hand = this.deck.splice(0, 5);
  }
  toggle(i: number): void {
    if (!this.drawn) this.held[i] = !this.held[i];
  }
  draw(): void {
    if (this.drawn) return;
    for (let i = 0; i < 5; i++) if (!this.held[i]) this.hand[i] = this.deck.shift()!;
    this.drawn = true;
  }
}
