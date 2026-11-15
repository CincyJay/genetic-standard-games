import type { Card, Random, Rank, Suit } from './cards.ts';
import { secureRandom } from './cards.ts';
import { deal, followSuit, next, removeCard, same, shuffled, sortHand, trickWinner, type Played } from './tricks.ts';

/**
 * Euchre: partners (0+2 vs 1+3), a 24-card deck (9 to ace), five cards each.
 * One card is turned up: in the first round players may order it up (the
 * dealer takes it and discards); in the second round they may name another
 * suit. The dealer must name one if everyone passes again ("stick the dealer").
 * Trump order: jack of trump (right bower), jack of the same colour (left
 * bower, which counts as trump), then A K Q 10 9. Makers who take 3-4 tricks
 * score 1, all 5 score 2; if they take fewer than 3 they're euchred and the
 * defenders score 2. First to 10 wins.
 */
export const EUCHRE_TARGET = 10;
export const team = (seat: number) => seat % 2;
const SAME_COLOUR: Record<Suit, Suit> = { s: 'c', c: 's', h: 'd', d: 'h' };
export const SUIT_NAMES: Record<Suit, string> = { s: 'Spades', h: 'Hearts', d: 'Diamonds', c: 'Clubs' };

export function euchreDeck(): Card[] {
  const out: Card[] = [];
  for (const suit of ['s', 'h', 'd', 'c'] as Suit[]) for (const rank of [9, 10, 11, 12, 13, 14] as Rank[]) out.push({ rank, suit });
  return out;
}

export const isRight = (c: Card, trump: Suit) => c.rank === 11 && c.suit === trump;
export const isLeft = (c: Card, trump: Suit) => c.rank === 11 && c.suit === SAME_COLOUR[trump];
export const suitOf = (trump: Suit | null) => (c: Card): Suit => (trump && isLeft(c, trump) ? trump : c.suit);
export const power = (trump: Suit | null) => (c: Card): number => (trump && isRight(c, trump) ? 30 : trump && isLeft(c, trump) ? 29 : c.rank);

export class EuchreRound {
  hands: Card[][];
  upcard: Card;
  dealer: number;
  phase: 'order' | 'name' | 'discard' | 'play' | 'done' = 'order';
  turn: number;
  trump: Suit | null = null;
  maker = -1;
  trick: Played[] = [];
  tricks = [0, 0, 0, 0];
  tricksPlayed = 0;
  lastTrick: { trick: Played[]; winner: number } | null = null;

  constructor(dealer: number, rnd: Random = secureRandom) {
    this.dealer = dealer;
    const d = deal(shuffled(euchreDeck(), rnd), 5);
    this.hands = d.hands.map((h) => sortHand(h));
    this.upcard = d.rest[0]!;
    this.turn = next(dealer);
  }

  /** First round: order the upcard's suit as trump, or pass. */
  order(seat: number, yes: boolean): void {
    if (this.phase !== 'order' || seat !== this.turn) return;
    if (yes) {
      this.trump = this.upcard.suit;
      this.maker = seat;
      this.hands[this.dealer]!.push(this.upcard);
      this.phase = 'discard';
      this.turn = this.dealer;
      return;
    }
    if (seat === this.dealer) {
      this.phase = 'name';
      this.turn = next(this.dealer);
    } else this.turn = next(seat);
  }

  /** The dealer, having picked up the upcard, throws one card away. */
  discard(seat: number, c: Card): void {
    if (this.phase !== 'discard' || seat !== this.dealer) return;
    removeCard(this.hands[seat]!, c);
    this.startPlay();
  }

  /** Second round: name a suit (not the upcard's) or pass; the dealer can't pass. */
  name(seat: number, suit: Suit | null): void {
    if (this.phase !== 'name' || seat !== this.turn) return;
    if (suit && suit !== this.upcard.suit) {
      this.trump = suit;
      this.maker = seat;
      this.startPlay();
      return;
    }
    if (seat !== this.dealer) this.turn = next(seat);
  }

  private startPlay(): void {
    this.phase = 'play';
    this.hands = this.hands.map((h) => sortHand(h, suitOf(this.trump), power(this.trump), this.trump));
    this.turn = next(this.dealer);
  }

  legal(seat: number): Card[] {
    if (seat !== this.turn) return [];
    if (this.phase === 'discard') return this.hands[seat]!;
    if (this.phase !== 'play') return [];
    return followSuit(this.hands[seat]!, this.trick, suitOf(this.trump));
  }

  play(seat: number, c: Card): number | null {
    if (this.phase !== 'play' || !this.legal(seat).some((x) => same(x, c))) return null;
    removeCard(this.hands[seat]!, c);
    this.trick.push({ seat, card: c });
    if (this.trick.length < 4) {
      this.turn = next(seat);
      return null;
    }
    const w = trickWinner(this.trick, this.trump, suitOf(this.trump), power(this.trump));
    this.tricks[w]!++;
    this.lastTrick = { trick: this.trick, winner: w };
    this.trick = [];
    this.tricksPlayed++;
    this.turn = w;
    if (this.tricksPlayed === 5) this.phase = 'done';
    return w;
  }

  /** Points for each team, and whether the makers were euchred. */
  score(): { points: [number, number]; euchred: boolean; march: boolean } {
    const mt = team(this.maker);
    const took = this.tricks[mt]! + this.tricks[mt + 2]!;
    const points: [number, number] = [0, 0];
    if (took >= 3) points[mt] = took === 5 ? 2 : 1;
    else points[1 - mt] = 2;
    return { points, euchred: took < 3, march: took === 5 };
  }

  // ---------------------------------------------------------------- computer players
  /** Hand strength if `trump` were trump (about 7+ is worth calling). */
  strength(seat: number, trump: Suit, withUpcard = false): number {
    const hand = [...this.hands[seat]!, ...(withUpcard ? [this.upcard] : [])];
    let s = 0;
    for (const c of hand) {
      if (isRight(c, trump)) s += 3.2;
      else if (isLeft(c, trump)) s += 2.6;
      else if (c.suit === trump) s += c.rank >= 13 ? 1.8 : 1.2;
      else if (c.rank === 14) s += 1;
    }
    return s;
  }

  botOrder(seat: number): boolean {
    const t = this.upcard.suit;
    const dealerTeam = team(seat) === team(this.dealer);
    return this.strength(seat, t, seat === this.dealer) + (dealerTeam ? 0.6 : -0.4) >= 6.5;
  }

  botName(seat: number): Suit | null {
    const options = (['s', 'h', 'd', 'c'] as Suit[]).filter((x) => x !== this.upcard.suit);
    const best = options.map((x) => ({ x, s: this.strength(seat, x) })).sort((a, b) => b.s - a.s)[0]!;
    if (seat === this.dealer) return best.x;
    return best.s >= 6.2 ? best.x : null;
  }

  botDiscard(seat: number): Card {
    const t = this.trump!;
    const hand = this.hands[seat]!;
    const non = hand.filter((c) => suitOf(t)(c) !== t).sort((a, b) => a.rank - b.rank);
    return non[0] ?? [...hand].sort((a, b) => power(t)(a) - power(t)(b))[0]!;
  }

  botPlay(seat: number): Card {
    const ok = this.legal(seat);
    const t = this.trump!;
    const pw = power(t);
    const so = suitOf(t);
    const strength = (c: Card) => (so(c) === t ? 100 + pw(c) : pw(c));
    if (!this.trick.length) {
      // makers lead their best trump; others lead an off-suit ace or a low card
      if (team(seat) === team(this.maker)) {
        const trumps = ok.filter((c) => so(c) === t).sort((a, b) => pw(b) - pw(a));
        if (trumps.length) return trumps[0]!;
      }
      const ace = ok.find((c) => so(c) !== t && c.rank === 14);
      return ace ?? [...ok].sort((a, b) => strength(a) - strength(b))[0]!;
    }
    const w = trickWinner(this.trick.concat([]), t, so, pw);
    const winsWith = (c: Card) => trickWinner([...this.trick, { seat, card: c }], t, so, pw) === seat;
    const winners = ok.filter(winsWith).sort((a, b) => strength(a) - strength(b));
    const low = [...ok].sort((a, b) => strength(a) - strength(b))[0]!;
    if (this.trick.length > 0 && team(w) === team(seat) && this.trick.length >= 2) return low;
    return winners[0] ?? low;
  }
}
