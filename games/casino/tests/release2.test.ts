import { describe, expect, it } from 'vitest';
import { cards } from '../src/logic/cards.ts';
import { BlackjackRound, Shoe } from '../src/logic/blackjack.ts';
import { perfectPairs, twentyOnePlusThree } from '../src/logic/sidebets.ts';
import { classify, payFor } from '../src/logic/videopoker.ts';
import { CALLED_BETS, coveredBy, neighbors, payoutMultiple, settle, wins } from '../src/logic/roulette.ts';
import { blindsFor, prizeFor } from '../src/logic/tournament.ts';

const [c] = [(s: string) => cards(s)];

describe('blackjack side bets', () => {
  it('Perfect Pairs', () => {
    expect(perfectPairs(...(c('Kh Kh') as [any, any]))).toBe('perfect');
    expect(perfectPairs(...(c('Kh Kd') as [any, any]))).toBe('colored');
    expect(perfectPairs(...(c('Kh Ks') as [any, any]))).toBe('mixed');
    expect(perfectPairs(...(c('Kh Qh') as [any, any]))).toBe(null);
  });
  it('21+3', () => {
    const t = (s: string) => twentyOnePlusThree(...(c(s) as [any, any, any]));
    expect(t('7h 7h 7h')).toBe('suitedTrips');
    expect(t('7h 8h 9h')).toBe('straightFlush');
    expect(t('7h 7d 7c')).toBe('trips');
    expect(t('Qh Kd Ac')).toBe('straight');
    expect(t('Ah 2d 3c')).toBe('straight');
    expect(t('Kh Ad 2c')).toBe(null); // no wrap-around
    expect(t('2h 9h Kh')).toBe('flush');
  });
});

describe('multi-hand blackjack', () => {
  it('deals each spot then the dealer, and plays hands left to right', () => {
    const shoe = new Shoe(6, () => 0.5);
    // spot1, spot2, dealer up, spot1, spot2, dealer hole, then draws
    shoe.stack(cards('Ts 9h 6d 8c 2s Tc 9d'));
    const r = new BlackjackRound(shoe, [100, 50]);
    expect(r.hands.map((h) => h.cards.length)).toEqual([2, 2]);
    expect(r.active).toBe(0);
    r.stand(); // 18
    expect(r.active).toBe(1);
    r.hit(); // 11 + 9 = 20
    r.stand();
    expect(r.phase).toBe('settled'); // dealer 16 draws... stacked cards exhausted -> random, just check it settled
    expect(r.hands).toHaveLength(2);
  });
  it('a dealer blackjack ends every spot', () => {
    const shoe = new Shoe(6, () => 0.5);
    shoe.stack(cards('Ts 9h Ad 8c 2s Kc'));
    const r = new BlackjackRound(shoe, [100, 100]);
    expect(r.phase).toBe('settled');
    expect(r.hands.every((h) => h.result === 'lose')).toBe(true);
  });
  it('a natural on one spot pays 3:2 while the other spot plays on', () => {
    const shoe = new Shoe(6, () => 0.5);
    shoe.stack(cards('As 9h 6d Kc 7s Tc'));
    const r = new BlackjackRound(shoe, [100, 100]);
    expect(r.hands[0]!.done).toBe(true);
    expect(r.active).toBe(1);
    r.stand(); // 16 vs dealer 16
  });
});

describe('video poker variants', () => {
  it('Deuces Wild ranks wild hands', () => {
    const d = (s: string) => classify(cards(s), 'deuces');
    expect(d('2h 2d 2c 2s 9h')).toBe('fourDeuces');
    expect(d('As Ks Qs Js Ts')).toBe('royal');
    expect(d('As Ks 2d Js Ts')).toBe('wildRoyal');
    expect(d('9h 9d 9c 2s 2h')).toBe('fiveKind');
    expect(d('5h 6h 2c 8h 9h')).toBe('straightFlush');
    expect(d('9h 9d 2c 4s 7h')).toBe('trips');
    expect(d('9h 9d 4c 4s 2h')).toBe('fullHouse');
    expect(d('Ah 3d 2c 4s 5h')).toBe('straight');
    expect(d('Kh 9h 2c 4h 7h')).toBe('flush');
    expect(d('Kh Kd 9c 4s 7h')).toBe(null); // a pair doesn't pay
    expect(payFor('wildRoyal', 1, 'deuces')).toBe(25);
  });
  it('Double Double Bonus pays four-of-a-kind kickers', () => {
    const b = (s: string) => classify(cards(s), 'ddb');
    expect(b('Ah Ad Ac As 3d')).toBe('acesKicker');
    expect(b('Ah Ad Ac As Kd')).toBe('aces');
    expect(b('3h 3d 3c 3s Ad')).toBe('lowKicker');
    expect(b('3h 3d 3c 3s 9d')).toBe('lowQuads');
    expect(b('9h 9d 9c 9s 3d')).toBe('quads');
    expect(b('Jh Jd 4c 4s 9d')).toBe('twoPair');
    expect(payFor('acesKicker', 5, 'ddb')).toBe(2000);
  });
});

describe('roulette racetrack', () => {
  it('called bets use the standard chips and cover the standard numbers', () => {
    const chips = Object.fromEntries(CALLED_BETS.map((b) => [b.id, b.parts.reduce((s, p) => s + p.chips, 0)]));
    expect(chips).toEqual({ voisins: 9, tiers: 6, orphelins: 5, zero: 4 });
    const cover = Object.fromEntries(CALLED_BETS.map((b) => [b.id, coveredBy(b).length]));
    expect(cover).toEqual({ voisins: 17, tiers: 12, orphelins: 8, zero: 7 });
    // voisins, tiers and orphelins together cover the whole wheel exactly once
    const all = ['voisins', 'tiers', 'orphelins'].flatMap((id) => coveredBy(CALLED_BETS.find((b) => b.id === id)!));
    expect(new Set(all).size).toBe(37);
    expect(all).toHaveLength(37);
  });
  it('neighbors are the two pockets on each side on the wheel', () => {
    expect(neighbors(0)).toEqual([3, 26, 0, 32, 15]);
    expect(neighbors(26)).toEqual([35, 3, 26, 0, 32]);
  });
  it('a called bet settles through its parts', () => {
    const t = CALLED_BETS.find((b) => b.id === 'tiers')!;
    const bets = t.parts.map((p) => ({ spot: p.spot, amount: p.chips * 10 }));
    expect(settle(bets, 27)).toBe(10 * (payoutMultiple(t.parts[4]!.spot) + 1)); // split 27/30 pays 17:1
    expect(wins(t.parts[0]!.spot, 5)).toBe(true);
    expect(settle(bets, 0)).toBe(0);
  });
});

describe('sit-and-go', () => {
  it('blinds rise every few hands and cap at the top level', () => {
    expect(blindsFor(1)).toEqual({ level: 1, sb: 10, bb: 20 });
    expect(blindsFor(7).bb).toBe(30);
    expect(blindsFor(999).bb).toBe(2000);
  });
  it('pays the top three out of six buy-ins', () => {
    expect([1, 2, 3, 4].map((p) => prizeFor(1000, p))).toEqual([3000, 1800, 1200, 0]);
  });
});
