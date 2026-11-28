/**
 * Live conversation with the dealer at your table. The words come from the
 * `dealerChat` Firebase function (firebase/functions), which holds the dealer's
 * personality and the AI key. Returns null when offline, signed out or the
 * function is not deployed, and the dealer then falls back to a scripted line.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import config from '../firebase/web-config.json';
import { PROTO } from './floor3d/flags.ts';
import { online } from './online.ts';

export interface DealerTurn {
  role: 'player' | 'dealer';
  text: string;
}

let lastAsk = 0;
let chatOnly: FirebaseApp | null = null;

/**
 * The signed-in app to call the function with. The 3D prototype stays out of the
 * online features (no profile, presence or friends), so on the first message it
 * signs in anonymously on a Firebase app of its own, used for dealer chat only.
 */
async function chatApp(): Promise<FirebaseApp | null> {
  if (!PROTO) return online.ready ? online.app : null;
  chatOnly ??= initializeApp(config, 'dealer-chat');
  const auth = getAuth(chatOnly);
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  return chatOnly;
}

export async function askDealer(dealerKey: string, message: string, history: DealerTurn[], visits: number, coins: number): Promise<string | null> {
  const now = Date.now();
  if (now - lastAsk < 1500) return null;
  lastAsk = now;
  try {
    const app = await chatApp();
    if (!app) return null;
    const call = httpsCallable<unknown, { reply: string }>(getFunctions(app, 'us-central1'), 'dealerChat', { timeout: 20000 });
    const res = await call({ dealer: dealerKey, message, history: history.slice(-8), visits, coins });
    return typeof res.data.reply === 'string' ? res.data.reply : null;
  } catch {
    return null;
  }
}
