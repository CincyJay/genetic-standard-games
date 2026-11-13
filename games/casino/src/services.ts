import { AdsService, DebugAnalytics, FakeAdsProvider, Haptics, SaveStore, DEFAULT_THEME, type Theme } from '@tgs/kit';
import { CasinoSound } from './sfx.ts';

/**
 * Play money only: coins can be earned free or bought, but never cashed out or
 * exchanged for anything of value.
 */
export interface SaveData {
  coins: number;
  /** When the free bonus was last collected (ms since epoch). */
  lastBonus: number;
  /** Consecutive bonus collections (bigger bonus each time, resets if missed for a day). */
  bonusStreak: number;
  biggestWin: number;
  handsPlayed: number;
  settings: { sound: boolean; haptics: boolean };
}

export const STARTING_COINS = 10_000;
export const BONUS_EVERY_MS = 2 * 60 * 60 * 1000;

export const save = new SaveStore<SaveData>({
  key: 'velvet-ace.save',
  version: 1,
  defaults: () => ({
    coins: STARTING_COINS,
    lastBonus: 0,
    bonusStreak: 0,
    biggestWin: 0,
    handsPlayed: 0,
    settings: { sound: true, haptics: true },
  }),
});

export const audio = new CasinoSound();
export const haptics = new Haptics();
export const analytics = new DebugAnalytics(import.meta.env.DEV);
// Replaced with AdMob on iOS/Android.
export const ads = new AdsService(new FakeAdsProvider());

export function applySettings(): void {
  const s = save.get().settings;
  audio.enabled = s.sound;
  haptics.enabled = s.haptics;
}

export const wallet = {
  get coins(): number {
    return save.get().coins;
  },
  canAfford(n: number): boolean {
    return save.get().coins >= n;
  },
  /** Takes `n` coins; returns false (and takes nothing) if the player can't afford it. */
  spend(n: number): boolean {
    if (n <= 0 || save.get().coins < n) return n <= 0;
    save.update((d) => {
      d.coins -= n;
      d.handsPlayed++;
    });
    return true;
  },
  add(n: number): void {
    if (n <= 0) return;
    save.update((d) => {
      d.coins += n;
    });
  },
  recordWin(n: number): void {
    save.update((d) => {
      d.biggestWin = Math.max(d.biggestWin, n);
    });
  },
};

export const bonus = {
  msUntilReady(now = Date.now()): number {
    return Math.max(0, save.get().lastBonus + BONUS_EVERY_MS - now);
  },
  /** Bonus grows with consecutive collections: 1,000 up to 5,000. */
  amount(): number {
    return Math.min(5000, 1000 + save.get().bonusStreak * 500);
  },
  collect(now = Date.now()): number {
    if (this.msUntilReady(now) > 0) return 0;
    const missedADay = save.get().lastBonus > 0 && now - save.get().lastBonus > 24 * 60 * 60 * 1000;
    const amount = missedADay ? 1000 : this.amount();
    save.update((d) => {
      d.coins += amount;
      d.lastBonus = now;
      d.bonusStreak = missedADay ? 1 : d.bonusStreak + 1;
    });
    return amount;
  },
};

/** 1,234 -> "1,234"; 12,345 -> "12.3K"; 1,234,567 -> "1.23M". */
export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2).replace(/\.0+$/, '')}M`;
  if (n >= 100_000) return `${Math.round(n / 1000)}K`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return n.toLocaleString('en-US');
}

/** Velvet Ace palette: plum velvet, gold, cream. */
export const THEME: Theme = {
  ...DEFAULT_THEME,
  bg: 0x1a0f24,
  ink: '#fff4dc',
  inkSoft: '#cbb6d6',
  primary: 0xe9b949,
  primaryDark: 0xa97a1c,
  onPrimary: '#3a1a00',
  surface: 0x3a1650,
  surfaceEdge: 0x14071f,
  icon: 0xfff4dc,
  accent: 0xff4f8b,
  font: '"Outfit", "Segoe UI", system-ui, sans-serif',
};
export const DISPLAY_FONT = '"Playfair Display", Georgia, serif';
export const GOLD = '#e9c86a';
/** Secondary (plum) button colors. */
export const SECONDARY = { color: 0x5a2470, shadow: 0x22082f, textColor: '#fff4dc' };
export const DANGER = { color: 0xc8102e, shadow: 0x6e0814, textColor: '#ffffff' };
