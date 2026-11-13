import { describe, expect, it } from 'vitest';
import { cards } from '../src/logic/cards.ts';
import { VideoPokerRound, classify, payFor } from '../src/logic/videopoker.ts';

describe('video poker (Jacks or Better 9/6)', () => {
  it('classifies paying hands', () => {
    expect(classify(cards('As Ks Qs Js Ts'))).toBe('royal');
    expect(classify(cards('Jc Jd 4h 9s 2d'))).toBe('jacks');
    expect(classify(cards('Tc Td 4h 9s 2d'))).toBe(null); // tens don't pay
    expect(classify(cards('2c 2d 2h 9s 9d'))).toBe('fullHouse');
  });

  it('pays the 9/6 table with the royal bonus at max bet', () => {
    expect(payFor('fullHouse', 1)).toBe(9);
    expect(payFor('flush', 1)).toBe(6);
    expect(payFor('royal', 4)).toBe(1000);
    expect(payFor('royal', 5)).toBe(4000); // 800 per coin
    expect(payFor(null, 5)).toBe(0);
  });

  it('keeps held cards and replaces the rest from the same deck', () => {
    const deck = cards('As Ad 7c 4h 2s Kc Qc Jc 9d 8d');
    const r = new VideoPokerRound(undefined, deck);
    r.toggle(0);
    r.toggle(1);
    r.draw();
    expect(r.hand.map((c) => c.rank)).toEqual([14, 14, 13, 12, 11]);
    expect(classify(r.hand)).toBe('jacks');
  });
});
