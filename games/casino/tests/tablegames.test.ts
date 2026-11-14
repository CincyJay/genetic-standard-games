import { describe, expect, it } from 'vitest';
import { createRng } from '../../../packages/kit/src/rng.ts';
import { cards } from '../src/logic/cards.ts';
import { BaccaratShoe, bankerDraws, playCoup, settleBets, total } from '../src/logic/baccarat.ts';
import { compare, dealerQualifies, rank3, settleThreeCard } from '../src/logic/threecard.ts';
import { settleFirst, settleWar, surrender } from '../src/logic/war.ts';

describe('baccarat', () => {
  it('counts totals by the last digit', () => {
    expect(total(cards('9h 8s'))).toBe(7);
    expect(total(cards('Kh Qs'))).toBe(0);
    expect(total(cards('Ah 7s'))).toBe(8);
  });
  it('follows the banker third-card table', () => {
    expect(bankerDraws(3, cards('8h')[0]!)).toBe(false);
    expect(bankerDraws(3, cards('7h')[0]!)).toBe(true);
    expect(bankerDraws(6, cards('6h')[0]!)).toBe(true);
    expect(bankerDraws(6, null)).toBe(false);
    expect(bankerDraws(5, null)).toBe(true);
    expect(bankerDraws(7, cards('2h')[0]!)).toBe(false);
  });
  it('deals P B P B and stands on naturals', () => {
    // shoe pops from the end: P1=9s, B1=2h, P2=Ks, B2=3c -> player 9 natural
    const shoe = cards('5d 5c 3c Ks 2h 9s');
    const c = playCoup(shoe);
    expect(c.player.map((x) => x.rank)).toEqual([9, 13]);
    expect(c.banker.map((x) => x.rank)).toEqual([2, 3]);
    expect(c.natural).toBe(true);
    expect(c.winner).toBe('player');
  });
  it('pushes player/banker bets on a tie and pays tie 8 to 1', () => {
    const coup = { player: [], banker: [], winner: 'tie' as const, playerPair: false, bankerPair: false, natural: false };
    expect(settleBets(coup, { player: 100, tie: 10 })).toBe(100 + 90);
    const bw = { ...coup, winner: 'banker' as const };
    expect(settleBets(bw, { banker: 100 })).toBe(195);
  });
  it('has the usual house edges (banker ~1.06%, player ~1.24%)', () => {
    const shoe = new BaccaratShoe(createRng(3));
    let b = 0;
    let p = 0;
    const n = 300_000;
    for (let i = 0; i < n; i++) {
      const c = shoe.next();
      b += settleBets(c, { banker: 100 }) - 100;
      p += settleBets(c, { player: 100 }) - 100;
    }
    expect(-b / n / 100).toBeGreaterThan(0.005);
    expect(-b / n / 100).toBeLessThan(0.017);
    expect(-p / n / 100).toBeGreaterThan(0.006);
    expect(-p / n / 100).toBeLessThan(0.019);
  });
});

describe('three card poker', () => {
  it('ranks straights above flushes and handles A-2-3', () => {
    expect(rank3(cards('Ah 2s 3d')).name).toBe('Straight');
    expect(compare(rank3(cards('4h 5s 6d')), rank3(cards('2h 9h Kh')))).toBeGreaterThan(0);
    expect(rank3(cards('Qh Qs Qd')).name).toBe('Three of a kind');
    expect(compare(rank3(cards('Ah 2s 3d')), rank3(cards('2h 3s 4d')))).toBeLessThan(0);
  });
  it('dealer needs queen high', () => {
    expect(dealerQualifies(rank3(cards('Jh 9s 4d')))).toBe(false);
    expect(dealerQualifies(rank3(cards('Qh 9s 4d')))).toBe(true);
  });
  it('settles ante, play, bonus and pair plus', () => {
    // player straight vs non-qualifying dealer: ante 1:1, play pushes, ante bonus 1:1
    const r = settleThreeCard(cards('4h 5s 6d'), cards('Jh 9s 3d'), 100, 50, true);
    expect(r.outcome).toBe('no-qualify');
    expect(r.back).toBe(50 * 7 + 100 + 300);
    // fold: pair plus still settles
    expect(settleThreeCard(cards('4h 4s 9d'), cards('Ah Ks 3d'), 100, 50, false).back).toBe(100);
  });
});

describe('casino war', () => {
  it('pays even money and handles ties, surrender and war', () => {
    expect(settleFirst(cards('Kh')[0]!, cards('9s')[0]!, 100, 0).back).toBe(200);
    expect(settleFirst(cards('2h')[0]!, cards('9s')[0]!, 100, 0).back).toBe(0);
    const t = settleFirst(cards('9h')[0]!, cards('9s')[0]!, 100, 10);
    expect(t.tie).toBe(true);
    expect(t.back).toBe(110);
    expect(surrender(100)).toBe(50);
    expect(settleWar(cards('Ah')[0]!, cards('Ks')[0]!, 100)).toBe(300);
    expect(settleWar(cards('2h')[0]!, cards('Ks')[0]!, 100)).toBe(0);
  });
});

import { settleUth } from '../src/logic/uth.ts';
describe("ultimate texas hold'em", () => {
  it('pays ante, blind (straight or better) and play when you win', () => {
    // player flush beats dealer pair: play 1:1, ante 1:1, blind 3:2, trips 7:1
    const r = settleUth(cards('Ah Kh'), cards('Qs Qd'), cards('2h 7h 9h Jc 3s'), 100, 10, 400);
    expect(r.outcome).toBe('win');
    expect(r.back).toBe(800 + 200 + 250 + 80);
  });
  it('ante pushes when the dealer does not open', () => {
    const r = settleUth(cards('2c 3d'), cards('Ah Kd'), cards('7s 8h 9c Jd 4s'), 100, 0, 100);
    expect(r.dealerOpens).toBe(false);
    expect(r.outcome).toBe('lose');
    expect(r.back).toBe(100);
  });
  it('folding loses ante and blind but trips still pays', () => {
    const r = settleUth(cards('7c 7d'), cards('Ah Kd'), cards('7s 2h 9c Jd 4s'), 100, 10, 0);
    expect(r.outcome).toBe('fold');
    expect(r.back).toBe(40);
  });
});
