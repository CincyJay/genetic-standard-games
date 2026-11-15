import { cardId, newDeck, secureRandom, shuffle, type Card, type Random, type Suit } from './cards.ts';

/**
 * Shared pieces for the trick-taking games (Hearts, Spades, Euchre): seats
 * 0-3 clockwise with the player at 0, follow-suit rules, trick winners and
 * card sorting. Each game supplies its own effective suit (Euchre's left
 * bower plays as trump) and card power.
 */
export interface Played {
  seat: number;
  card: Card;
}

export type SuitOf = (c: Card) => Suit;
export type Power = (c: Card) => number;

export const next = (seat: number, by = 1) => (seat + by) % 4;
export const same = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;

/** Cards in `hand` that may be played: follow the led suit when you can. */
export function followSuit(hand: Card[], trick: Played[], suitOf: SuitOf): Card[] {
  if (!trick.length) return hand;
  const led = suitOf(trick[0]!.card);
  const follow = hand.filter((c) => suitOf(c) === led);
  return follow.length ? follow : hand;
}

/** Seat that wins a complete trick: highest trump, else highest card of the led suit. */
export function trickWinner(trick: Played[], trump: Suit | null, suitOf: SuitOf, power: Power): number {
  const led = suitOf(trick[0]!.card);
  let best = trick[0]!;
  const score = (p: Played) => {
    const s = suitOf(p.card);
    if (trump && s === trump) return 1000 + power(p.card);
    if (s === led) return power(p.card);
    return -1;
  };
  for (const p of trick) if (score(p) > score(best)) best = p;
  return best.seat;
}

/** Deals `per` cards to each of four seats (from a shuffled deck); returns hands and the rest. */
export function deal(deck: Card[], per: number): { hands: Card[][]; rest: Card[] } {
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < per * 4; i++) hands[i % 4]!.push(deck[i]!);
  return { hands, rest: deck.slice(per * 4) };
}

export function shuffled(cards: Card[] = newDeck(1), rnd: Random = secureRandom): Card[] {
  return shuffle([...cards], rnd);
}

const SUIT_ORDER: Record<Suit, number> = { c: 0, d: 1, s: 2, h: 3 };

/** Sorts a hand by suit (alternating colours) then rank; `suitOf`/`power` for game-specific order. */
export function sortHand(hand: Card[], suitOf: SuitOf = (c) => c.suit, power: Power = (c) => c.rank, trump: Suit | null = null): Card[] {
  const order = (s: Suit) => (s === trump ? 9 : SUIT_ORDER[s]);
  return [...hand].sort((a, b) => order(suitOf(a)) - order(suitOf(b)) || power(a) - power(b));
}

export function removeCard(hand: Card[], c: Card): void {
  const i = hand.findIndex((x) => same(x, c));
  if (i >= 0) hand.splice(i, 1);
}

export const ids = (cs: Card[]) => cs.map(cardId).join(' ');
