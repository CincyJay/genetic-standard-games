/**
 * Sit-and-go tournaments: six players start with equal chips; blinds rise on a
 * schedule; the last player standing wins. Prizes come from the buy-ins.
 */
export const START_CHIPS = 1500;
/** Blinds rise every this many hands. */
export const HANDS_PER_LEVEL = 6;
export const BLIND_LEVELS: [number, number][] = [
  [10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [500, 1000], [1000, 2000],
];

export function blindsFor(handNumber: number): { level: number; sb: number; bb: number } {
  const level = Math.min(BLIND_LEVELS.length - 1, Math.floor((handNumber - 1) / HANDS_PER_LEVEL));
  const [sb, bb] = BLIND_LEVELS[level]!;
  return { level: level + 1, sb, bb };
}

export const SNG_BUYINS = [
  { name: 'Bronze Sit & Go', buyIn: 1_000 },
  { name: 'Silver Sit & Go', buyIn: 5_000 },
  { name: 'Gold Sit & Go', buyIn: 25_000 },
];

/** Share of the prize pool for 1st, 2nd, 3rd (6 players). */
export const PAYOUT_SHARES = [0.5, 0.3, 0.2];

/** Coins paid for finishing in `place` (1-based) of a 6-player sit-and-go. */
export function prizeFor(buyIn: number, place: number): number {
  const pool = buyIn * 6;
  return Math.round(pool * (PAYOUT_SHARES[place - 1] ?? 0));
}
