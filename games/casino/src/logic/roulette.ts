import { secureRandom, type Random } from './cards.ts';

/** European single-zero roulette. */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type BetSpot =
  | { type: 'straight'; n: number }
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
  return 'n' in s ? `${s.type}-${s.n}` : s.type;
}

export function wins(s: BetSpot, n: number): boolean {
  if (s.type === 'straight') return s.n === n;
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
  }
}

/** Winnings multiple (not counting the returned stake). */
export function payoutMultiple(s: BetSpot): number {
  if (s.type === 'straight') return 35;
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
