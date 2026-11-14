import { secureRandom, type Random } from './cards.ts';

/** European single-zero roulette. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type BetSpot =
  | { type: 'straight'; n: number }
  /** Inside bets on 2 (split), 3 (street/trio), 4 (corner/first four) or 6 (six line) numbers. */
  | { type: 'inside'; numbers: number[]; name: string }
  | { type: 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' }
  | { type: 'dozen' | 'column'; n: 1 | 2 | 3 };

export interface Bet {
  spot: BetSpot;
  amount: number;
}

export function colorOf(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

export function spotKey(s: BetSpot): string {
  if (s.type === 'inside') return `inside-${[...s.numbers].sort((a, b) => a - b).join('-')}`;
  return 'n' in s ? `${s.type}-${s.n}` : s.type;
}

export function wins(s: BetSpot, n: number): boolean {
  if (s.type === 'straight') return s.n === n;
  if (s.type === 'inside') return s.numbers.includes(n);
  if (n === 0) return false;
  switch (s.type) {
    case 'red':
      return RED.has(n);
    case 'black':
      return !RED.has(n);
    case 'odd':
      return n % 2 === 1;
    case 'even':
      return n % 2 === 0;
    case 'low':
      return n <= 18;
    case 'high':
      return n >= 19;
    case 'dozen':
      return Math.ceil(n / 12) === s.n;
    case 'column':
      return ((n - 1) % 3) + 1 === s.n;
    default:
      return false;
  }
}

/** Winnings multiple (not counting the returned stake). */
export function payoutMultiple(s: BetSpot): number {
  if (s.type === 'straight') return 35;
  // split 17:1, street 11:1, corner 8:1, six line 5:1
  if (s.type === 'inside') return 36 / s.numbers.length - 1;
  if (s.type === 'dozen' || s.type === 'column') return 2;
  return 1;
}

/** Total returned to the player (winning stakes plus winnings). */
export function settle(bets: Bet[], n: number): number {
  return bets.reduce((sum, b) => sum + (wins(b.spot, n) ? b.amount * (payoutMultiple(b.spot) + 1) : 0), 0);
}

export function spin(rnd: Random = secureRandom): number {
  return Math.floor(rnd() * 37);
}

/** Every legal inside bet on the standard layout (numbers 1-36 in 12 rows of 3, zero on top). */
export function insideBets(): BetSpot[] {
  const out: BetSpot[] = [];
  const at = (row: number, col: number) => row * 3 + col + 1;
  for (let r = 0; r < 12; r++) {
    for (let c = 0; c < 3; c++) {
      if (c < 2) out.push({ type: 'inside', numbers: [at(r, c), at(r, c + 1)], name: 'Split' });
      if (r < 11) out.push({ type: 'inside', numbers: [at(r, c), at(r + 1, c)], name: 'Split' });
      if (c < 2 && r < 11) out.push({ type: 'inside', numbers: [at(r, c), at(r, c + 1), at(r + 1, c), at(r + 1, c + 1)], name: 'Corner' });
    }
    out.push({ type: 'inside', numbers: [at(r, 0), at(r, 1), at(r, 2)], name: 'Street' });
    if (r < 11) out.push({ type: 'inside', numbers: [0, 1, 2, 3, 4, 5].map((k) => at(r, 0) + k), name: 'Six line' });
  }
  out.push({ type: 'inside', numbers: [0, 1], name: 'Split' });
  out.push({ type: 'inside', numbers: [0, 2], name: 'Split' });
  out.push({ type: 'inside', numbers: [0, 3], name: 'Split' });
  out.push({ type: 'inside', numbers: [0, 1, 2], name: 'Trio' });
  out.push({ type: 'inside', numbers: [0, 2, 3], name: 'Trio' });
  out.push({ type: 'inside', numbers: [0, 1, 2, 3], name: 'First four' });
  return out;
}

// ------------------------------------------------------------------ racetrack
const inside = (name: string, ...numbers: number[]): BetSpot => ({ type: 'inside', numbers, name });
const straight = (n: number): BetSpot => ({ type: 'straight', n });

export interface CalledBet {
  id: 'voisins' | 'tiers' | 'orphelins' | 'zero';
  name: string;
  /** The standard bets it places, each with how many chips. */
  parts: { spot: BetSpot; chips: number }[];
}

/** The classic French "called" bets on the racetrack. */
export const CALLED_BETS: CalledBet[] = [
  {
    id: 'voisins',
    name: 'Voisins du Zéro',
    parts: [
      { spot: inside('Trio', 0, 2, 3), chips: 2 },
      { spot: inside('Split', 4, 7), chips: 1 },
      { spot: inside('Split', 12, 15), chips: 1 },
      { spot: inside('Split', 18, 21), chips: 1 },
      { spot: inside('Split', 19, 22), chips: 1 },
      { spot: inside('Split', 32, 35), chips: 1 },
      { spot: inside('Corner', 25, 26, 28, 29), chips: 2 },
    ],
  },
  {
    id: 'tiers',
    name: 'Tiers du Cylindre',
    parts: [
      { spot: inside('Split', 5, 8), chips: 1 },
      { spot: inside('Split', 10, 11), chips: 1 },
      { spot: inside('Split', 13, 16), chips: 1 },
      { spot: inside('Split', 23, 24), chips: 1 },
      { spot: inside('Split', 27, 30), chips: 1 },
      { spot: inside('Split', 33, 36), chips: 1 },
    ],
  },
  {
    id: 'orphelins',
    name: 'Orphelins',
    parts: [
      { spot: straight(1), chips: 1 },
      { spot: inside('Split', 6, 9), chips: 1 },
      { spot: inside('Split', 14, 17), chips: 1 },
      { spot: inside('Split', 17, 20), chips: 1 },
      { spot: inside('Split', 31, 34), chips: 1 },
    ],
  },
  {
    id: 'zero',
    name: 'Jeu Zéro',
    parts: [
      { spot: inside('Split', 0, 3), chips: 1 },
      { spot: inside('Split', 12, 15), chips: 1 },
      { spot: straight(26), chips: 1 },
      { spot: inside('Split', 32, 35), chips: 1 },
    ],
  },
];

/** "Neighbors" bet: the number and `k` on each side of it on the wheel, one chip each. */
export function neighbors(n: number, k = 2): number[] {
  const i = WHEEL_ORDER.indexOf(n);
  const len = WHEEL_ORDER.length;
  const out: number[] = [];
  for (let d = -k; d <= k; d++) out.push(WHEEL_ORDER[(i + d + len) % len]!);
  return out;
}

/** Numbers each called bet covers (for highlighting on the racetrack). */
export function coveredBy(bet: CalledBet): number[] {
  const set = new Set<number>();
  for (const p of bet.parts) {
    if (p.spot.type === 'straight') set.add(p.spot.n);
    else if (p.spot.type === 'inside') p.spot.numbers.forEach((x) => set.add(x));
  }
  return [...set].sort((a, b) => a - b);
}
