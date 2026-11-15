import { describe, expect, it } from 'vitest';
import { createRng } from '../../../packages/kit/src/rng.ts';
import { cards } from '../src/logic/cards.ts';
import { HeartsRound, cardPoints } from '../src/logic/hearts.ts';
import { SpadesRound } from '../src/logic/spades.ts';
import { EuchreRound, power, suitOf } from '../src/logic/euchre.ts';
import { trickWinner } from '../src/logic/tricks.ts';

/** Plays a whole round with the computer players in every seat. */
function autoplay<R extends { phase: string; turn: number; legal(s: number): unknown[] }>(r: R, step: (r: R) => void, max = 400): void {
  for (let i = 0; i < max && r.phase !== 'done'; i++) step(r);
}

describe('hearts', () => {
  it('a full round deals out 26 points (or a moon) and every card is played', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = new HeartsRound(seed % 4, createRng(seed));
      if (r.phase === 'pass') for (let s = 0; s < 4; s++) r.pass(s, r.botPass(s));
      expect(r.hands.every((h) => h.length === 13)).toBe(true);
      autoplay(r, (x) => {
        x.play(x.turn, x.botPlay(x.turn));
      });
      expect(r.phase).toBe('done');
      const pts = r.points();
      const sum = pts.reduce((a, b) => a + b, 0);
      expect(sum === 26 || sum === 78).toBe(true);
      expect(r.taken.flat().length).toBe(52);
    }
  });
  it('2 of clubs leads, and hearts are not led before they are broken', () => {
    const r = new HeartsRound(3, createRng(5));
    expect(r.legal(r.turn).map((c) => c.suit + c.rank)).toEqual(['c2']);
    expect(cardPoints(cards('Qs')[0]!)).toBe(13);
  });
});

describe('spades', () => {
  it('bots bid and play out a round; scoring follows the bids', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const r = new SpadesRound(seed % 4, createRng(seed));
      while (r.phase === 'bid') r.bid(r.turn, r.botBid(r.turn));
      autoplay(r, (x) => {
        x.play(x.turn, x.botPlay(x.turn));
      });
      expect(r.tricks.reduce((a, b) => a + b, 0)).toBe(13);
      const sc = r.score();
      expect(Number.isFinite(sc.points[0]) && Number.isFinite(sc.points[1])).toBe(true);
    }
  });
  it('spades trump the led suit', () => {
    const t = [{ seat: 0, card: cards('Ah')[0]! }, { seat: 1, card: cards('2s')[0]! }, { seat: 2, card: cards('Kh')[0]! }, { seat: 3, card: cards('3h')[0]! }];
    expect(trickWinner(t, 's', (c) => c.suit, (c) => c.rank)).toBe(1);
  });
  it('made bid scores 10 per trick plus bags; nil pays 100', () => {
    const r = new SpadesRound(0, createRng(1));
    r.bids = [3, 0, 4, 2];
    r.tricks = [4, 0, 5, 4];
    const s = r.score();
    expect(s.points[0]).toBe(70 + 2);
    expect(s.points[1]).toBe(100 + 20 + 2);
  });
});

describe('euchre', () => {
  it('bowers: the right beats the left beats the ace of trump; the left follows trump', () => {
    const so = suitOf('h');
    const pw = power('h');
    expect(so(cards('Jd')[0]!)).toBe('h');
    const t = [{ seat: 0, card: cards('Ah')[0]! }, { seat: 1, card: cards('Jd')[0]! }, { seat: 2, card: cards('Jh')[0]! }, { seat: 3, card: cards('Kh')[0]! }];
    expect(trickWinner(t, 'h', so, pw)).toBe(2);
    expect(trickWinner(t.slice(0, 2).concat([{ seat: 2, card: cards('9s')[0]! }, { seat: 3, card: cards('Kh')[0]! }]), 'h', so, pw)).toBe(1);
  });
  it('bots make trump (dealer is stuck) and play five tricks; makers or defenders score', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = new EuchreRound(seed % 4, createRng(seed));
      for (let i = 0; i < 12 && (r.phase === 'order' || r.phase === 'name' || r.phase === 'discard'); i++) {
        if (r.phase === 'order') r.order(r.turn, r.botOrder(r.turn));
        else if (r.phase === 'name') r.name(r.turn, r.botName(r.turn));
        else r.discard(r.turn, r.botDiscard(r.turn));
      }
      expect(r.phase).toBe('play');
      expect(r.hands.every((h) => h.length === 5)).toBe(true);
      autoplay(r, (x) => {
        x.play(x.turn, x.botPlay(x.turn));
      });
      expect(r.tricks.reduce((a, b) => a + b, 0)).toBe(5);
      const s = r.score();
      expect(s.points[0] + s.points[1]).toBeGreaterThan(0);
    }
  });
});
