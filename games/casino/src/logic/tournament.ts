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

// ------------------------------------------------------------------ multi-table tournaments
/**
 * Multi-table tournaments: you play one six-seat table of a bigger field. The
 * rest of the field is simulated: players elsewhere bust at a rate that rises
 * with the blinds, and when someone at your table busts a player from another
 * table takes the seat. With six left everyone is at the final table.
 */
export interface MttEvent {
  id: string;
  name: string;
  buyIn: number;
  field: number;
  startChips: number;
  handsPerLevel: number;
  /** Player level needed to register. */
  level: number;
  tag: string;
}

export const MTT_EVENTS: MttEvent[] = [
  { id: 'daily', name: 'Daily Deepstack', buyIn: 2_000, field: 45, startChips: 3000, handsPerLevel: 6, level: 1, tag: 'Every day' },
  { id: 'turbo', name: 'Turbo Showdown', buyIn: 5_000, field: 27, startChips: 1500, handsPerLevel: 3, level: 3, tag: 'Fast blinds' },
  { id: 'highroller', name: 'High Roller', buyIn: 50_000, field: 36, startChips: 3000, handsPerLevel: 5, level: 8, tag: 'Big prize pool' },
  { id: 'main', name: 'Main Event', buyIn: 100_000, field: 90, startChips: 5000, handsPerLevel: 6, level: 12, tag: 'Champion ring to the winner' },
];

export function mttBlinds(ev: MttEvent, handNumber: number): { level: number; sb: number; bb: number } {
  const level = Math.min(BLIND_LEVELS.length - 1, Math.floor((handNumber - 1) / ev.handsPerLevel));
  const [sb, bb] = BLIND_LEVELS[level]!;
  const scale = ev.startChips / START_CHIPS;
  const big = niceChips(bb * scale);
  return { level: level + 1, sb: Math.max(1, Math.round(big / 2)), bb: big };
}

/** Rounds to a chip-friendly amount (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 x a power of ten). */
export function niceChips(n: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, n))));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  let best = steps[0]! * mag;
  for (const st of steps) if (Math.abs(st * mag - n) < Math.abs(best - n)) best = st * mag;
  return Math.round(best);
}

/** Places paid: about the top 15%, at least three. */
export function paidPlaces(field: number): number {
  return Math.max(3, Math.round(field * 0.15));
}

/** Prize for finishing in `place` (1-based); 0 outside the money. Shares fall off steeply toward the top. */
export function mttPrize(ev: MttEvent, place: number): number {
  const paid = paidPlaces(ev.field);
  if (place < 1 || place > paid) return 0;
  const weights = Array.from({ length: paid }, (_, i) => 1 / Math.pow(i + 1, 1.1));
  const total = weights.reduce((a, b) => a + b, 0);
  return Math.round((ev.buyIn * ev.field * weights[place - 1]!) / total);
}

export class MttField {
  /** Players still in, including everyone at your table. */
  readonly event: MttEvent;
  remaining: number;
  constructor(event: MttEvent) {
    this.event = event;
    this.remaining = event.field;
  }

  get totalChips(): number {
    return this.event.field * this.event.startChips;
  }

  get averageStack(): number {
    return Math.round(this.totalChips / Math.max(1, this.remaining));
  }

  get finalTable(): boolean {
    return this.remaining <= 6;
  }

  /** Players at other tables. */
  outside(atTable: number): number {
    return Math.max(0, this.remaining - atTable);
  }

  /** After a hand: players elsewhere who busted (they leave the field). */
  tickOthers(atTable: number, level: number, rnd: () => number): number {
    const out = this.outside(atTable);
    // never bust the outside field below the seats needed to reach the final table naturally
    const p = Math.min(0.3, 0.022 + level * 0.009);
    let busted = 0;
    for (let i = 0; i < out; i++) if (rnd() < p) busted++;
    busted = Math.min(busted, Math.max(0, this.remaining - 6));
    this.remaining -= busted;
    return busted;
  }

  /** A player at your table busted: returns their finishing place. */
  bustAtTable(): number {
    const place = this.remaining;
    this.remaining--;
    return place;
  }
}
