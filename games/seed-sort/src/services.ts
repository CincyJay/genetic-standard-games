import { AdsService, DebugAnalytics, FakeAdsProvider, Haptics, SaveStore, SynthAudio, DEFAULT_THEME, type Theme } from '@tgs/kit';

export interface SaveData {
  /** Next level the player will play (1-based). */
  level: number;
  /** Best stars per level id. */
  stars: Record<number, number>;
  levelsCompleted: number;
  /** Strain id -> copies collected from seed packs. */
  garden: Record<string, number>;
  settings: { sound: boolean; haptics: boolean };
}

export const save = new SaveStore<SaveData>({
  key: 'seed-sort.save',
  version: 1,
  defaults: () => ({ level: 1, stars: {}, levelsCompleted: 0, garden: {}, settings: { sound: true, haptics: true } }),
});

export const audio = new SynthAudio();
export const haptics = new Haptics();
export const analytics = new DebugAnalytics(import.meta.env.DEV);
// Week 3: replaced with the AdMob provider on iOS/Android.
export const ads = new AdsService(new FakeAdsProvider());

export function applySettings(): void {
  const s = save.get().settings;
  audio.enabled = s.sound;
  haptics.enabled = s.haptics;
}

export const THEME: Theme = { ...DEFAULT_THEME };

/**
 * Seed colors, tuned for a dark background: saturated but not neon, and spread
 * around the hue wheel (plus a light and a warm neutral) so neighbors never blur together.
 */
export const SEED_COLORS: number[] = [
  0xff5d5d, // red
  0xffd84d, // yellow
  0x3ddc84, // green
  0x4d8dff, // blue
  0xa47bff, // violet
  0xff7ac8, // pink
  0xff9a3c, // orange
  0x2fd6c3, // teal
  0xc08a5b, // brown
  0xe9edf5, // white
  0xb5e35a, // lime
  0x5ac8fa, // sky
];

export const SEED_TEX = (c: number) => `seed-${c}`;
