import { AdsService, DebugAnalytics, FakeAdsProvider, Haptics, SaveStore, DEFAULT_THEME, type Theme } from '@tgs/kit';
import { CasinoSound } from './sfx.ts';
import {
  XP_PER_COIN, dayKey, levelForXp, levelProgress, levelReward, missionsFor, spinWheel, vipTier, WHEEL_PRIZES, type GameEvent, type MissionDef,
} from './logic/progression.ts';

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
  settings: { sound: boolean; haptics: boolean; music?: boolean };
  /** Experience from wagering; sets the player's level. */
  xp: number;
  /** Levels reached but not yet celebrated on screen. */
  pendingLevelUps: number[];
  /** Mission progress for `missionDay` (resets daily). */
  missionDay: string;
  missionProgress: Record<string, number>;
  missionsClaimed: string[];
  /** Day the daily wheel was last spun. */
  wheelDay: string;
  /** Progressive jackpot shared by every slot machine. */
  jackpot: number;
}

export const JACKPOT_SEED = 250_000;

export const STARTING_COINS = 10_000;
export const BONUS_EVERY_MS = 60 * 60 * 1000;

const defaults = (): SaveData => ({
  coins: STARTING_COINS,
  lastBonus: 0,
  bonusStreak: 0,
  biggestWin: 0,
  handsPlayed: 0,
  settings: { sound: true, haptics: true },
  xp: 0,
  pendingLevelUps: [],
  missionDay: '',
  missionProgress: {},
  missionsClaimed: [],
  wheelDay: '',
  jackpot: JACKPOT_SEED,
});

export const save = new SaveStore<SaveData>({
  key: 'velvet-ace.save',
  version: 2,
  defaults,
  // v1 had no progression: keep coins and stats, start at level 1
  migrate: (data) => ({ ...defaults(), ...(data as Partial<SaveData>) }),
});

export const audio = new CasinoSound();
export const haptics = new Haptics();
export const analytics = new DebugAnalytics(import.meta.env.DEV);
// Replaced with AdMob on iOS/Android.
export const ads = new AdsService(new FakeAdsProvider());

export function applySettings(): void {
  const s = save.get().settings;
  audio.enabled = s.sound;
  audio.musicOn = s.music !== false;
  audio.syncMusic();
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

export interface MissionState extends MissionDef {
  progress: number;
  done: boolean;
  claimed: boolean;
}

/** Levels, XP, missions, the daily wheel and the jackpot. */
export const player = {
  get xp(): number {
    return save.get().xp;
  },
  get level(): number {
    return levelForXp(save.get().xp);
  },
  progress() {
    return levelProgress(save.get().xp);
  },
  vip() {
    return vipTier(this.level);
  },
  /**
   * Record a wager: earns XP (and funds the jackpot for slots). Level-ups pay
   * their reward immediately and are queued for the level-up celebration.
   */
  wager(coins: number, slots = false): void {
    const before = this.level;
    save.update((d) => {
      d.xp += Math.max(1, Math.round(coins * XP_PER_COIN));
      if (slots) d.jackpot += Math.round(coins * 0.02);
    });
    const after = this.level;
    if (after > before) {
      save.update((d) => {
        for (let l = before + 1; l <= after; l++) {
          d.coins += levelReward(l);
          d.pendingLevelUps.push(l);
        }
      });
    }
  },
  takeLevelUps(): number[] {
    const list = [...save.get().pendingLevelUps];
    if (list.length) save.update((d) => (d.pendingLevelUps = []));
    return list;
  },
  /** Reset mission progress when the day changes. */
  ensureDay(): string {
    const day = dayKey();
    if (save.get().missionDay !== day) {
      save.update((d) => {
        d.missionDay = day;
        d.missionProgress = {};
        d.missionsClaimed = [];
      });
    }
    return day;
  },
  /** A game reports something that happened (a spin, a win...). */
  event(e: GameEvent, n = 1): void {
    const day = this.ensureDay();
    const relevant = missionsFor(day).filter((m) => m.event === e);
    if (!relevant.length) return;
    save.update((d) => {
      for (const m of relevant) d.missionProgress[m.id] = Math.min(m.target, (d.missionProgress[m.id] ?? 0) + n);
    });
  },
  missions(): MissionState[] {
    const day = this.ensureDay();
    const st = save.get();
    return missionsFor(day).map((m) => {
      const progress = st.missionProgress[m.id] ?? 0;
      return { ...m, progress, done: progress >= m.target, claimed: st.missionsClaimed.includes(m.id) };
    });
  },
  unclaimedMissions(): number {
    return this.missions().filter((m) => m.done && !m.claimed).length;
  },
  claim(id: string): number {
    const m = this.missions().find((x) => x.id === id);
    if (!m || !m.done || m.claimed) return 0;
    save.update((d) => {
      d.missionsClaimed.push(id);
      d.coins += m.reward;
    });
    this.wager(m.reward * 0.5); // claiming also gives XP
    return m.reward;
  },
  wheelReady(): boolean {
    return save.get().wheelDay !== dayKey();
  },
  /** Spin the daily wheel: returns the wedge index and the coins won (VIP bonus applied). */
  spinDailyWheel(rnd: () => number = Math.random): { wedge: number; coins: number } {
    const wedge = spinWheel(rnd);
    const coins = Math.round(WHEEL_PRIZES[wedge]! * this.vip().bonus);
    save.update((d) => {
      d.wheelDay = dayKey();
      d.coins += coins;
    });
    return { wedge, coins };
  },
  get jackpot(): number {
    return save.get().jackpot;
  },
  /** Pay out `share` (0..1) of the jackpot and reseed it. */
  winJackpot(share: number): number {
    const amount = Math.round(save.get().jackpot * share);
    save.update((d) => {
      d.coins += amount;
      d.jackpot = Math.max(JACKPOT_SEED, d.jackpot - amount);
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
