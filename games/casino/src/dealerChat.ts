/**
 * Live conversation with the dealer at your table. The words come from the
 * `dealerChat` Firebase function (firebase/functions), which holds the dealer's
 * personality and the AI key. Returns null when offline, signed out or the
 * function is not deployed, and the dealer then falls back to a scripted line.
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { online } from './online.ts';

export interface DealerTurn {
  role: 'player' | 'dealer';
  text: string;
}

let lastAsk = 0;

export async function askDealer(dealerKey: string, message: string, history: DealerTurn[], visits: number, coins: number): Promise<string | null> {
  const now = Date.now();
  if (!online.app || !online.ready || now - lastAsk < 1500) return null;
  lastAsk = now;
  try {
    const call = httpsCallable<unknown, { reply: string }>(getFunctions(online.app, 'us-central1'), 'dealerChat', { timeout: 20000 });
    const res = await call({ dealer: dealerKey, message, history: history.slice(-8), visits, coins });
    return typeof res.data.reply === 'string' ? res.data.reply : null;
  } catch {
    return null;
  }
}
