import { newDeck, shuffle, secureRandom, type Card, type Random } from './cards.ts';

/**
 * Punto banco baccarat (8 decks). Card values: ace 1, 2-9 face value, tens and
 * pictures 0; a hand's total is the last digit of the sum. Naturals (8 or 9 on
 * two cards) stand; otherwise the Player draws on 0-5, and the Banker follows
 * the standard third-card table.
 */
export type Side = 'player' | 'banker' | 'tie';
export type BaccaratBet = Side | 'playerPair' | 'bankerPair';

export const PAYS: Record<BaccaratBet, number> = {
  player: 1,
  banker: 0.95,
  tie: 8,
  playerPair: 11,
  bankerPair: 11,
};

export function cardValue(c: Card): number {
  if (c.rank === 14) return 1;
  return c.rank >= 10 ? 0 : c.rank;
}

export function total(hand: Card[]): number {
  return hand.reduce((s, c) => s + cardValue(c), 0) % 10;
}

/** Does the Banker draw, given its total and the Player's third card (null if the Player stood)? */
export function bankerDraws(bankerTotal: number, playerThird: Card | null): boolean {
  if (playerThird === null) return bankerTotal <= 5;
  const p = cardValue(playerThird);
  switch (bankerTotal) {
    case 0:
    case 1:
    case 2:
      return true;
    case 3:
      return p !== 8;
    case 4:
      return p >= 2 && p <= 7;
    case 5:
      return p >= 4 && p <= 7;
    case 6:
      return p === 6 || p === 7;
    default:
      return false;
  }
}

export interface Coup {
  player: Card[];
  banker: Card[];
  winner: Side;
  playerPair: boolean;
  bankerPair: boolean;
  natural: boolean;
}

/** Plays one coup from the top of `shoe` (cards are removed from it). */
export function playCoup(shoe: Card[]): Coup {
  const player = [shoe.pop()!, shoe.pop()!];
  const banker = [shoe.pop()!, shoe.pop()!];
  // deal order is P B P B
  [player[1], banker[0]] = [banker[0]!, player[1]!];
  const natural = total(player) >= 8 || total(banker) >= 8;
  let playerThird: Card | null = null;
  if (!natural) {
    if (total(player) <= 5) {
      playerThird = shoe.pop()!;
      player.push(playerThird);
    }
    if (bankerDraws(total(banker), playerThird)) banker.push(shoe.pop()!);
  }
  const p = total(player);
  const b = total(banker);
  return {
    player,
    banker,
    winner: p > b ? 'player' : b > p ? 'banker' : 'tie',
    playerPair: player[0]!.rank === player[1]!.rank,
    bankerPair: banker[0]!.rank === banker[1]!.rank,
    natural,
  };
}

/** Coins returned (stake included) for each bet on a finished coup. */
export function settleBets(coup: Coup, bets: Partial<Record<BaccaratBet, number>>): number {
  let back = 0;
  for (const [k, amount] of Object.entries(bets) as [BaccaratBet, number][]) {
    if (!amount) continue;
    if (k === 'playerPair' || k === 'bankerPair') {
      if (coup[k]) back += amount * (1 + PAYS[k]);
    } else if (coup.winner === k) back += Math.floor(amount * (1 + PAYS[k]));
    else if (coup.winner === 'tie') back += amount; // player and banker bets push on a tie
  }
  return back;
}

export class BaccaratShoe {
  cards: Card[] = [];
  private readonly rnd: Random;
  constructor(rnd: Random = secureRandom) {
    this.rnd = rnd;
    this.refill();
  }
  refill(): void {
    this.cards = shuffle(newDeck(8), this.rnd);
  }
  /** Reshuffle when fewer than 20 cards are left. */
  next(): Coup {
    if (this.cards.length < 20) this.refill();
    return playCoup(this.cards);
  }
}
