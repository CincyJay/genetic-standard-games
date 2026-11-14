import { describe, expect, it } from 'vitest';
import { createRng } from '../../../packages/kit/src/rng.ts';
import { resolveRoll, type CrapsBet } from '../src/logic/craps.ts';

describe('craps', () => {
  it("come-out: 7/11 win the pass line, 2/3/12 lose, 12 pushes don't pass", () => {
    expect(resolveRoll(null, { pass: 10 }, 3, 4).paid.pass).toBe(20);
    expect(resolveRoll(null, { pass: 10 }, 1, 1).lost).toContain('pass');
    const r = resolveRoll(null, { dontPass: 10 }, 6, 6);
    expect(r.paid.dontPass).toBe(10);
    expect(resolveRoll(null, { pass: 10 }, 2, 2).point).toBe(4);
  });
  it('point: making it pays pass and true odds; seven out loses them', () => {
    const r = resolveRoll(6, { pass: 10, passOdds: 50 }, 2, 4);
    expect(r.paid.pass).toBe(20);
    expect(r.paid.passOdds).toBe(110);
    expect(r.point).toBeNull();
    const s = resolveRoll(6, { pass: 10, passOdds: 50, dontPass: 10 }, 3, 4);
    expect(s.lost).toEqual(expect.arrayContaining(['pass', 'passOdds']));
    expect(s.paid.dontPass).toBe(20);
  });
  it('place bets stay up and pay; hardways lose on the easy way', () => {
    const r = resolveRoll(5, { place6: 60, hard6: 10 }, 2, 4);
    expect(r.paid.place6).toBe(130);
    expect(r.resolved).not.toContain('place6');
    expect(r.lost).toContain('hard6');
    expect(resolveRoll(5, { hard8: 10 }, 4, 4).paid.hard8).toBe(100);
    // off on the come-out
    expect(resolveRoll(null, { place6: 60 }, 3, 4).lost).not.toContain('place6');
  });
  it('field and props', () => {
    expect(resolveRoll(null, { field: 10 }, 6, 6).paid.field).toBe(40);
    expect(resolveRoll(null, { field: 10 }, 3, 4).lost).toContain('field');
    expect(resolveRoll(null, { yo: 10 }, 5, 6).paid.yo).toBe(160);
    expect(resolveRoll(null, { any7: 10 }, 1, 6).paid.any7).toBe(50);
  });
  it('pass line returns about 98.6% over the long run', () => {
    const rnd = createRng(8);
    const die = () => 1 + Math.floor(rnd() * 6);
    let staked = 0;
    let back = 0;
    let point: number | null = null;
    let bets: Partial<Record<CrapsBet, number>> = {};
    for (let i = 0; i < 400_000; i++) {
      if (point === null && !bets.pass) {
        bets.pass = 10;
        staked += 10;
      }
      const r = resolveRoll(point, bets, die(), die());
      for (const v of Object.values(r.paid)) back += v!;
      for (const b of r.resolved) delete bets[b];
      point = r.point;
    }
    const rtp = back / staked;
    expect(rtp).toBeGreaterThan(0.975);
    expect(rtp).toBeLessThan(0.997);
    bets = {};
  });
});
