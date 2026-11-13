import { describe, expect, it } from 'vitest';
import { createRng } from '@tgs/kit/rng';
import { cards } from '../src/logic/cards.ts';
import { HoldemTable, decide, equity, preflopStrength } from '../src/logic/holdem.ts';

const seat = (name: string, stack: number, human = false) => ({ name, stack, human });

/** The button starts on seat 0, so dealing goes seat 1, 2, ..., 0 (twice), then flop, turn, river. */
function table(stacks: number[], deck?: string) {
  const t = new HoldemTable(stacks.map((s, i) => seat(`P${i}`, s, i === 0)), 5, 10, createRng(1));
  if (deck) t.presetDeck(cards(deck));
  t.startHand();
  return t;
}
const total = (t: HoldemTable) => t.seats.reduce((s, p) => s + p.stack, 0) + t.pot;

describe('hold\'em engine', () => {
  it('posts blinds and starts with the player after the big blind', () => {
    const t = table([1000, 1000, 1000, 1000]);
    // button moves to seat 0, so SB = 1, BB = 2, first to act = 3
    expect(t.button).toBe(0);
    expect(t.seats[1]!.bet).toBe(5);
    expect(t.seats[2]!.bet).toBe(10);
    expect(t.toAct).toBe(3);
    expect(t.seats.every((s) => s.cards.length === 2)).toBe(true);
  });

  it('heads-up: the button posts the small blind and acts first preflop', () => {
    const t = table([1000, 1000]);
    expect(t.seats[t.button]!.bet).toBe(5);
    expect(t.toAct).toBe(t.button);
  });

  it('everyone folding to a raise gives the raiser the pot, with the raise refunded', () => {
    const t = table([1000, 1000, 1000]);
    // seat 0 is the button and acts first (after BB at seat 2)
    t.act({ type: 'raise', to: 40 });
    t.act({ type: 'fold' });
    t.act({ type: 'fold' });
    expect(t.street).toBe('done');
    expect(t.seats[0]!.stack).toBe(1015); // won the blinds
    expect(total(t)).toBe(3000);
  });

  it('the big blind gets the option to raise after limps', () => {
    const t = table([1000, 1000, 1000]);
    t.act({ type: 'call' }); // button
    t.act({ type: 'call' }); // SB
    expect(t.street).toBe('preflop');
    expect(t.toAct).toBe(2); // BB still to act
    t.act({ type: 'check' });
    expect(t.street).toBe('flop');
    expect(t.board).toHaveLength(3);
  });

  it('builds side pots correctly in a three-way all-in', () => {
    // P0 holds AA, P1 KK, P2 QQ; board blanks. Stacks 100 / 300 / 500.
    const t = table([100, 300, 500], 'Kd Qc As Kh Qd Ah 2s 7c 9d 4h 3c');
    t.act({ type: 'allin' }); // P0 (button) 100
    t.act({ type: 'allin' }); // P1 300
    t.act({ type: 'call' }); // P2 calls 300
    expect(t.street).toBe('done');
    // main pot 300 -> P0 (AA); side pot 400 -> P1 (KK); P2 gets nothing back but kept 200
    expect(t.seats.map((s) => s.stack)).toEqual([300, 400, 200]);
    expect(t.results.map((r) => [r.amount, r.winners])).toEqual([
      [300, [0]],
      [400, [1]],
    ]);
  });

  it('splits a tied pot', () => {
    // both play the board straight
    const t = table([1000, 1000], '2c 3d 2h 3s 9c Tc Jd Qh Ks');
    t.act({ type: 'call' });
    t.act({ type: 'check' });
    for (let k = 0; k < 6; k++) t.act({ type: 'check' });
    expect(t.street).toBe('done');
    expect(t.seats[0]!.stack + t.seats[1]!.stack).toBe(2000);
    expect(t.seats[0]!.stack).toBe(1000);
  });

  it('never creates or loses chips over hundreds of bot hands', () => {
    const rnd = createRng(7);
    const t = new HoldemTable([0, 1, 2, 3, 4, 5].map((i) => seat(`B${i}`, 1000)), 5, 10, rnd);
    const personalities = [0.2, 0.5, 0.8, 0.3, 0.6, 0.4].map((a) => ({ aggression: a, bluff: 0.1 }));
    let hands = 0;
    while (hands < 300 && t.startHand()) {
      let guard = 0;
      while (t.street !== 'done' && guard++ < 200) t.act(decide(t, t.toAct, personalities[t.toAct]!, rnd));
      expect(t.street).toBe('done');
      expect(total(t)).toBe(6000);
      expect(t.seats.every((s) => s.stack >= 0)).toBe(true);
      hands++;
    }
    expect(hands).toBeGreaterThan(20);
  }, 60_000);

  it('rates hands sensibly', () => {
    expect(preflopStrength(cards('As Ad'))).toBeGreaterThan(preflopStrength(cards('Ks Qs')));
    expect(preflopStrength(cards('Ks Qs'))).toBeGreaterThan(preflopStrength(cards('7c 2d')));
    const rnd = createRng(3);
    expect(equity(cards('As Ad'), [], 1, 400, rnd)).toBeGreaterThan(0.75);
    expect(equity(cards('7c 2d'), [], 1, 400, rnd)).toBeLessThan(0.45);
  });
});
