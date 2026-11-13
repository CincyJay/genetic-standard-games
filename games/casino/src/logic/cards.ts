/** Cards, decks and fair shuffling. */
export type Suit = 's' | 'h' | 'd' | 'c';
/** 2..14, where 11=J, 12=Q, 13=K, 14=A. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const RANK_CHAR: Record<number, string> = { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

/** Short id like "As", "Td", "7c": also the texture key suffix for card art. */
export function cardId(c: Card): string {
  return `${RANK_CHAR[c.rank] ?? String(c.rank)}${c.suit}`;
}

export function parseCard(id: string): Card {
  const r = id[0]!;
  const map: Record<string, Rank> = { T: 10, J: 11, Q: 12, K: 13, A: 14 };
  return { rank: (map[r] ?? Number(r)) as Rank, suit: id[1] as Suit };
}

export const cards = (ids: string): Card[] => ids.trim().split(/\s+/).map(parseCard);

export function isRed(c: Card): boolean {
  return c.suit === 'h' || c.suit === 'd';
}

export function newDeck(decks = 1): Card[] {
  const out: Card[] = [];
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS) out.push({ rank, suit });
  return out;
}

export type Random = () => number;

/** Cryptographically strong random in [0, 1), used for all real play. */
export const secureRandom: Random = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0]! / 4294967296;
};

/** Unbiased Fisher-Yates shuffle (in place). */
export function shuffle<T>(arr: T[], rnd: Random = secureRandom): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
