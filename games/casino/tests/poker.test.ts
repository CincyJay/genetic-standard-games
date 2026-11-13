import { describe, expect, it } from 'vitest';
import { cards, newDeck, shuffle } from '../src/logic/cards.ts';
import { bestHand, evaluate5 } from '../src/logic/poker.ts';

const name = (s: string) => evaluate5(cards(s)).name;
const score = (s: string) => bestHand(cards(s)).score;

describe('poker hand ranking', () => {
  it('names every category', () => {
    expect(name('As Ks Qs Js Ts')).toBe('Royal Flush');
    expect(name('9h 8h 7h 6h 5h')).toBe('Straight Flush');
    expect(name('7c 7d 7h 7s 2d')).toBe('Four of a Kind');
    expect(name('Kc Kd Kh 4s 4d')).toBe('Full House');
    expect(name('2d 8d Td Jd 4d')).toBe('Flush');
    expect(name('9c Td Jh Qs Kd')).toBe('Straight');
    expect(name('Ac 2d 3h 4s 5d')).toBe('Straight'); // the wheel
    expect(name('5c 5d 5h Ks 2d')).toBe('Three of a Kind');
    expect(name('Jc Jd 4h 4s Ad')).toBe('Two Pair');
    expect(name('Qc Qd 9h 4s 2d')).toBe('Pair');
    expect(name('Ac Jd 9h 4s 2d')).toBe('High Card');
  });

  it('orders hands correctly, including kickers', () => {
    expect(score('As Ad Kc 7h 2s')).toBeGreaterThan(score('As Ad Qc 7h 2s'));
    expect(score('6c 7d 8h 9s Td')).toBeGreaterThan(score('Ac 2d 3h 4s 5d')); // wheel is the lowest straight
    expect(score('Kc Kd Kh 2s 2d')).toBeGreaterThan(score('Qc Qd Qh As Ad'));
    expect(score('2d 3d 4d 5d 7d')).toBeGreaterThan(score('Ac Kd Qh Js Td'));
    expect(score('Jc Jd 4h 4s Ad')).toBeGreaterThan(score('Jc Jd 4h 4s Kd'));
    expect(score('Ah Kh 2c 2d 3s')).toBe(score('As Kd 2h 2s 3c')); // exact tie
  });

  it('finds the best five of seven', () => {
    const v = bestHand(cards('Ah Kh Qh Jh 2c 3d Th'));
    expect(v.name).toBe('Royal Flush');
    expect(bestHand(cards('2c 2d 2h 9s 9d 9c Ks')).name).toBe('Full House');
    expect(bestHand(cards('2c 2d 2h 9s 9d 9c Ks')).kickers.slice(0, 2)).toEqual([9, 2]);
  });

  it('shuffle keeps all 52 unique cards', () => {
    const d = shuffle(newDeck());
    expect(new Set(d.map((c) => `${c.rank}${c.suit}`)).size).toBe(52);
  });
});
