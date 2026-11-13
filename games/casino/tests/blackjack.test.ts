import { describe, expect, it } from 'vitest';
import { cards } from '../src/logic/cards.ts';
import { BlackjackRound, Shoe, handTotal, isBlackjack } from '../src/logic/blackjack.ts';

/** Deal order: player, dealer, player, dealer, then hits. */
function round(order: string, bet = 100): BlackjackRound {
  const shoe = new Shoe(6, () => 0.5);
  shoe.stack(cards(order));
  return new BlackjackRound(shoe, bet);
}

describe('blackjack', () => {
  it('counts soft and hard totals', () => {
    expect(handTotal(cards('Ah 6d'))).toEqual({ total: 17, soft: true });
    expect(handTotal(cards('Ah 6d 9c'))).toEqual({ total: 16, soft: false });
    expect(handTotal(cards('Ah Ad 9c'))).toEqual({ total: 21, soft: true });
    expect(isBlackjack(cards('As Kd'))).toBe(true);
    expect(isBlackjack(cards('7s 7d 7c'))).toBe(false);
  });

  it('pays blackjack 3:2 immediately', () => {
    const r = round('As 9d Kh 7c');
    expect(r.phase).toBe('settled');
    expect(r.hands[0]!.result).toBe('blackjack');
    expect(r.totalPayout).toBe(250);
  });

  it('dealer blackjack beats everything but a player blackjack', () => {
    expect(round('Ts Ad 9h Kc').hands[0]!.result).toBe('lose');
    expect(round('As Ad Kh Kc').hands[0]!.result).toBe('push');
  });

  it('player busts and loses even if the dealer would bust', () => {
    const r = round('Ts 6d 5h Tc 9c');
    r.hit(); // 24
    expect(r.phase).toBe('settled');
    expect(r.hands[0]!.result).toBe('lose');
    expect(r.dealer).toHaveLength(2); // dealer does not draw when every hand is bust
  });

  it('dealer draws to 17 and stands on soft 17', () => {
    const r = round('Ts 6d 8h Ac'); // dealer A6 = soft 17
    r.stand();
    expect(r.dealer).toHaveLength(2);
    expect(r.hands[0]!.result).toBe('win'); // 18 vs 17
    const r2 = round('Ts 6d 8h 5c 4c 9s'); // dealer 11, draws 4 -> 15, draws 9 -> 24
    r2.stand();
    expect(handTotal(r2.dealer).total).toBe(24);
    expect(r2.hands[0]!.result).toBe('win');
    expect(r2.totalPayout).toBe(200);
  });

  it('doubles the bet and takes exactly one card', () => {
    const r = round('6s 9d 5h 7c Tc 8s'); // player 11, doubles into 21; dealer 16 draws 8
    r.double();
    expect(r.hands[0]!.cards).toHaveLength(3);
    expect(r.hands[0]!.bet).toBe(200);
    expect(r.hands[0]!.result).toBe('win');
    expect(r.totalPayout).toBe(400);
  });

  it('splits a pair into two hands played in turn', () => {
    const r = round('8s 9d 8h 7c 3c Tc Ts'); // 8,8 vs 16; split -> 8+3, 8+T; dealer draws T -> bust
    expect(r.canSplit()).toBe(true);
    r.split();
    expect(r.hands).toHaveLength(2);
    r.stand(); // 11
    r.stand(); // 18
    expect(r.phase).toBe('settled');
    expect(r.hands.map((h) => h.result)).toEqual(['win', 'win']);
    expect(r.totalPayout).toBe(400);
  });

  it('split aces get one card each, and 21 after a split is not a blackjack', () => {
    const r = round('As 9d Ah 7c Kc 5d');
    r.split();
    expect(r.phase).toBe('settled');
    expect(r.hands[0]!.result).toBe('win'); // 21, not blackjack
    expect(r.hands[0]!.payout).toBe(200);
  });
});
