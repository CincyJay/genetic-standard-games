import { newDeck, shuffle, type Card, type Random, secureRandom } from './cards.ts';
import { evaluate5 } from './poker.ts';

/**
 * Video poker: three classic games. Each paytable pays per coin bet for 1..5 coins
 * (the royal flush jumps at 5 coins). Variants:
 *  - Jacks or Better, full-pay 9/6
 *  - Deuces Wild ("Not So Ugly Ducks" table): every 2 is wild
 *  - Double Double Bonus 9/6: big bonuses for four of a kind, more with the right kicker
 */
export type Variant = 'jacks' | 'deuces' | 'ddb';

export interface PayRow {
  key: string;
  name: string;
  pays: number[];
}

const row = (key: string, name: string, one: number, max = one * 5): PayRow => ({ key, name, pays: [one, one * 2, one * 3, one * 4, max] });

export const PAYTABLES: Record<Variant, PayRow[]> = {
  jacks: [
    row('royal', 'Royal Flush', 250, 4000),
    row('straightFlush', 'Straight Flush', 50),
    row('quads', 'Four of a Kind', 25),
    row('fullHouse', 'Full House', 9),
    row('flush', 'Flush', 6),
    row('straight', 'Straight', 4),
    row('trips', 'Three of a Kind', 3),
    row('twoPair', 'Two Pair', 2),
    row('jacks', 'Jacks or Better', 1),
  ],
  deuces: [
    row('royal', 'Natural Royal', 250, 4000),
    row('fourDeuces', 'Four Deuces', 200),
    row('wildRoyal', 'Wild Royal', 25),
    row('fiveKind', 'Five of a Kind', 16),
    row('straightFlush', 'Straight Flush', 10),
    row('quads', 'Four of a Kind', 4),
    row('fullHouse', 'Full House', 4),
    row('flush', 'Flush', 3),
    row('straight', 'Straight', 2),
    row('trips', 'Three of a Kind', 1),
  ],
  ddb: [
    row('royal', 'Royal Flush', 250, 4000),
    row('acesKicker', 'Four Aces + 2-4', 400),
    row('lowKicker', 'Four 2-4 + A-4', 160),
    row('aces', 'Four Aces', 160),
    row('lowQuads', 'Four 2s-4s', 80),
    row('quads', 'Four 5s-Ks', 50),
    row('straightFlush', 'Straight Flush', 50),
    row('fullHouse', 'Full House', 9),
    row('flush', 'Flush', 6),
    row('straight', 'Straight', 4),
    row('trips', 'Three of a Kind', 3),
    row('twoPair', 'Two Pair', 1),
    row('jacks', 'Jacks or Better', 1),
  ],
};

export const VARIANT_NAMES: Record<Variant, string> = { jacks: 'Jacks or Better', deuces: 'Deuces Wild', ddb: 'Double Double Bonus' };

/** Kept for older callers: the Jacks or Better table. */
export const PAYTABLE = PAYTABLES.jacks;
export type PayKey = string;

/** Deuces Wild hand: the best category using 2s as wild. */
function classifyDeuces(hand: Card[]): string | null {
  const wild = hand.filter((c) => c.rank === 2).length;
  const rest = hand.filter((c) => c.rank !== 2);
  if (wild === 4) return 'fourDeuces';
  if (wild === 0) {
    const v = evaluate5(hand);
    if (v.category === 8) return v.kickers[0] === 14 ? 'royal' : 'straightFlush';
    return ({ 7: 'quads', 6: 'fullHouse', 5: 'flush', 4: 'straight', 3: 'trips' } as Record<number, string>)[v.category] ?? null;
  }
  const counts = new Map<number, number>();
  for (const c of rest) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const most = Math.max(...counts.values());
  const pairs = [...counts.values()].filter((n) => n === 2).length;
  const suited = rest.every((c) => c.suit === rest[0]!.suit);
  const ranks = rest.map((c) => c.rank);
  const distinct = new Set(ranks).size === ranks.length;
  // can the non-wild cards plus wilds make a straight? (ace high or low)
  const canStraight = (high: boolean) => {
    if (!distinct) return false;
    const rs = ranks.map((r) => (r === 14 && !high ? 1 : r));
    return Math.max(...rs) - Math.min(...rs) <= 4;
  };
  const straight = canStraight(true) || canStraight(false);
  const royalRanks = ranks.every((r) => r >= 10);
  if (straight && suited && royalRanks) return 'wildRoyal';
  if (most + wild >= 5) return 'fiveKind';
  if (straight && suited) return 'straightFlush';
  if (most + wild >= 4) return 'quads';
  if (wild === 1 && pairs === 2) return 'fullHouse';
  if (suited) return 'flush';
  if (straight) return 'straight';
  if (most + wild >= 3) return 'trips';
  return null;
}

function classifyDdb(hand: Card[]): string | null {
  const v = evaluate5(hand);
  if (v.category === 7) {
    const quad = v.kickers[0]!;
    const kicker = v.kickers[1]!;
    if (quad === 14) return kicker >= 2 && kicker <= 4 ? 'acesKicker' : 'aces';
    if (quad <= 4) return kicker === 14 || (kicker >= 2 && kicker <= 4) ? 'lowKicker' : 'lowQuads';
    return 'quads';
  }
  return classify(hand, 'jacks');
}

export function classify(hand: Card[], variant: Variant = 'jacks'): string | null {
  if (variant === 'deuces') return classifyDeuces(hand);
  if (variant === 'ddb') return classifyDdb(hand);
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
export function payFor(key: string | null, coins: number, variant: Variant = 'jacks'): number {
  if (!key) return 0;
  return PAYTABLES[variant].find((p) => p.key === key)?.pays[coins - 1] ?? 0;
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
