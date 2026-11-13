import { newDeck, shuffle, type Card, type Random, secureRandom } from './cards.ts';

/**
 * Blackjack: 6-deck shoe, dealer stands on soft 17, blackjack pays 3:2,
 * double on any first two cards, one split (split aces get one card each),
 * dealer peeks for blackjack.
 */
export function cardValue(c: Card): number {
  if (c.rank === 14) return 11;
  return Math.min(10, c.rank);
}

export function handTotal(cs: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cs) {
    total += cardValue(c);
    if (c.rank === 14) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isBlackjack(cs: Card[]): boolean {
  return cs.length === 2 && handTotal(cs).total === 21;
}

export type HandResult = 'blackjack' | 'win' | 'push' | 'lose';

export interface PlayerHand {
  cards: Card[];
  bet: number;
  done: boolean;
  doubled: boolean;
  fromSplit: boolean;
  result?: HandResult;
  /** Total returned to the player (stake + winnings), set at settlement. */
  payout?: number;
}

export type Phase = 'player' | 'dealer' | 'settled';

export class Shoe {
  private cards: Card[] = [];
  private readonly rnd: Random;
  private readonly decks: number;
  constructor(decks = 6, rnd: Random = secureRandom) {
    this.decks = decks;
    this.rnd = rnd;
    this.reshuffle();
  }
  reshuffle(): void {
    this.cards = shuffle(newDeck(this.decks), this.rnd);
  }
  /** Reshuffle when less than a quarter of the shoe is left. */
  get needsShuffle(): boolean {
    return this.cards.length < this.decks * 13;
  }
  draw(): Card {
    if (this.cards.length === 0) this.reshuffle();
    return this.cards.pop()!;
  }
  /** Test helper: put specific cards on top (first = next drawn). */
  stack(cs: Card[]): void {
    this.cards.push(...[...cs].reverse());
  }
}

export class BlackjackRound {
  readonly hands: PlayerHand[];
  readonly dealer: Card[] = [];
  phase: Phase = 'player';
  active = 0;
  private readonly shoe: Shoe;

  constructor(shoe: Shoe, bet: number) {
    this.shoe = shoe;
    this.hands = [{ cards: [], bet, done: false, doubled: false, fromSplit: false }];
    const h = this.hands[0]!;
    h.cards.push(shoe.draw());
    this.dealer.push(shoe.draw());
    h.cards.push(shoe.draw());
    this.dealer.push(shoe.draw());
    // dealer peek, or natural blackjack for the player
    if (isBlackjack(this.dealer) || isBlackjack(h.cards)) {
      h.done = true;
      this.settle();
    }
  }

  get hand(): PlayerHand {
    return this.hands[this.active]!;
  }

  canDouble(): boolean {
    return this.phase === 'player' && this.hand.cards.length === 2 && !this.hand.done;
  }

  canSplit(): boolean {
    const h = this.hand;
    return (
      this.phase === 'player' &&
      this.hands.length === 1 &&
      h.cards.length === 2 &&
      cardValue(h.cards[0]!) === cardValue(h.cards[1]!)
    );
  }

  hit(): void {
    if (this.phase !== 'player') return;
    const h = this.hand;
    h.cards.push(this.shoe.draw());
    if (handTotal(h.cards).total >= 21) this.finishHand();
  }

  stand(): void {
    if (this.phase !== 'player') return;
    this.finishHand();
  }

  /** Doubles the stake; the caller must have taken the extra bet from the wallet. */
  double(): void {
    if (!this.canDouble()) return;
    const h = this.hand;
    h.bet *= 2;
    h.doubled = true;
    h.cards.push(this.shoe.draw());
    this.finishHand();
  }

  /** Splits a pair into two hands; the caller must have taken the extra bet. */
  split(): void {
    if (!this.canSplit()) return;
    const h = this.hand;
    const second: PlayerHand = { cards: [h.cards.pop()!], bet: h.bet, done: false, doubled: false, fromSplit: true };
    h.fromSplit = true;
    this.hands.push(second);
    const aces = h.cards[0]!.rank === 14;
    h.cards.push(this.shoe.draw());
    second.cards.push(this.shoe.draw());
    if (aces) {
      h.done = true;
      second.done = true;
      this.toDealer();
    }
  }

  private finishHand(): void {
    this.hand.done = true;
    const next = this.hands.findIndex((x) => !x.done);
    if (next >= 0) this.active = next;
    else this.toDealer();
  }

  private toDealer(): void {
    this.phase = 'dealer';
    const anyLive = this.hands.some((h) => handTotal(h.cards).total <= 21);
    if (anyLive) {
      // stand on all 17s
      while (handTotal(this.dealer).total < 17) this.dealer.push(this.shoe.draw());
    }
    this.settle();
  }

  private settle(): void {
    this.phase = 'settled';
    const d = handTotal(this.dealer).total;
    const dealerBJ = isBlackjack(this.dealer);
    for (const h of this.hands) {
      const p = handTotal(h.cards).total;
      const playerBJ = isBlackjack(h.cards) && !h.fromSplit;
      if (playerBJ && dealerBJ) h.result = 'push';
      else if (playerBJ) h.result = 'blackjack';
      else if (dealerBJ) h.result = 'lose';
      else if (p > 21) h.result = 'lose';
      else if (d > 21 || p > d) h.result = 'win';
      else if (p === d) h.result = 'push';
      else h.result = 'lose';
      h.payout =
        h.result === 'blackjack' ? h.bet + Math.floor(h.bet * 1.5) : h.result === 'win' ? h.bet * 2 : h.result === 'push' ? h.bet : 0;
    }
  }

  get totalPayout(): number {
    return this.hands.reduce((s, h) => s + (h.payout ?? 0), 0);
  }
}
