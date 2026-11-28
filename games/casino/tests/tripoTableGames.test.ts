import { describe, expect, it } from 'vitest';
import { layoutFor } from '../src/floor3d/grandHall';

describe("Joshua's Tripo tables: each grand-hall table opens its own game", () => {
  it('seats and table placements carry the game given per table, blackjack when none is given', () => {
    const plain = layoutFor('grand', true, true, { islands: true });
    expect(new Set(plain.seats.map((s) => s.game))).toEqual(new Set(['blackjack']));
    const games = ['blackjack', 'roulette', 'blackjack', 'baccarat'] as const;
    const g = layoutFor('grand', true, true, { islands: true, tableGames: games });
    const tables = [g.table, ...g.decor.tables];
    expect(tables.map((t) => t.game)).toEqual([...games]);
    // two seats a table, each opening its table's game; the positions don't move
    for (const [i, t] of tables.entries()) {
      const seats = g.seats.filter((s) => Math.hypot(s.x - t.x, s.z - t.z) < 2.5);
      expect(seats).toHaveLength(2);
      for (const s of seats) expect(s.game).toBe(games[i]);
    }
    expect(g.seats.map((s) => [s.x, s.z])).toEqual(plain.seats.map((s) => [s.x, s.z]));
  });
});
