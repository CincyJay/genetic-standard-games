import { describe, expect, it } from 'vitest';
import { createRng } from '../../../packages/kit/src/rng.ts';
import { MTT_EVENTS, MttField, mttBlinds, mttPrize, paidPlaces } from '../src/logic/tournament.ts';

describe('multi-table tournaments', () => {
  it('pays about 15% of the field and the whole prize pool', () => {
    for (const ev of MTT_EVENTS) {
      const paid = paidPlaces(ev.field);
      expect(paid).toBeGreaterThanOrEqual(3);
      let sum = 0;
      for (let p = 1; p <= paid; p++) sum += mttPrize(ev, p);
      expect(Math.abs(sum - ev.buyIn * ev.field)).toBeLessThan(paid);
      expect(mttPrize(ev, 1)).toBeGreaterThan(mttPrize(ev, 2));
      expect(mttPrize(ev, paid + 1)).toBe(0);
    }
  });

  it('blinds scale with the starting stack and rise on schedule', () => {
    const ev = MTT_EVENTS.find((e) => e.id === 'main')!;
    expect(mttBlinds(ev, 1).level).toBe(1);
    expect(mttBlinds(ev, ev.handsPerLevel + 1).level).toBe(2);
    expect(mttBlinds(ev, 1).bb).toBeGreaterThan(20);
  });

  it('the field shrinks to a final table in a playable number of hands', () => {
    for (const ev of MTT_EVENTS) {
      const lengths: number[] = [];
      for (let s = 0; s < 40; s++) {
        const rnd = createRng(100 + s);
        const f = new MttField(ev);
        let hand = 0;
        while (!f.finalTable && hand < 500) {
          hand++;
          // about one bust at your own table every ten hands
          if (rnd() < 0.1) f.bustAtTable();
          f.tickOthers(6, mttBlinds(ev, hand).level, rnd);
        }
        expect(f.remaining).toBeGreaterThanOrEqual(5);
        lengths.push(hand);
      }
      const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      expect(avg, ev.name).toBeGreaterThan(15);
      expect(avg, ev.name).toBeLessThan(90);
    }
  });
});
