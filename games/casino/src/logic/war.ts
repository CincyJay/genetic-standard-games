import type { Card } from './cards.ts';

/**
 * Casino War: one card each, aces high. Higher card wins even money. On a tie
 * the player can surrender (half the bet back) or go to war: match the bet,
 * the dealer burns three cards, and one more card each is dealt. Win or tie
 * the war and the raise wins even money while the original bet pushes; lose
 * it and both bets are lost. The optional Tie bet pays 10 to 1.
 */
export const TIE_PAYS = 10;

export function compareWar(player: Card, dealer: Card): number {
  return player.rank - dealer.rank;
}

/** Coins returned (stakes included) for the first card. Returns null when it's a tie (war decision needed). */
export function settleFirst(player: Card, dealer: Card, bet: number, tieBet: number): { back: number; tie: boolean } {
  const c = compareWar(player, dealer);
  const tieBack = c === 0 && tieBet ? tieBet * (1 + TIE_PAYS) : 0;
  if (c > 0) return { back: bet * 2, tie: false };
  if (c < 0) return { back: 0, tie: false };
  return { back: tieBack, tie: true };
}

export function surrender(bet: number): number {
  return Math.floor(bet / 2);
}

/** After going to war (the raise equals the bet). */
export function settleWar(player: Card, dealer: Card, bet: number): number {
  return compareWar(player, dealer) >= 0 ? bet + bet * 2 : 0;
}
