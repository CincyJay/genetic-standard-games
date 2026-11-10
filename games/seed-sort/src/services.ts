import { AdsService, DebugAnalytics, FakeAdsProvider, Haptics, SaveStore, SynthAudio, DEFAULT_THEME, type Theme } from '@tgs/kit';

export interface SaveData {
  /** Next level the player will play (1-based). */
  level: number;
  /** Best stars per level id. */
  stars: Record<number, number>;
  levelsCompleted: number;
  settings: { sound: boolean; haptics: boolean };
}

export const save = new SaveStore<SaveData>({
  key: 'seed-sort.save',
  version: 1,
  defaults: () => ({ level: 1, stars: {}, levelsCompleted: 0, settings: { sound: true, haptics: true } }),
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

export const THEME: Theme = {
  ...DEFAULT_THEME,
  bg: 0xfff7ec,
  primary: 0x5cc46a,
  primaryDark: 0x3f9a4c,
  font: '"Nunito", "Trebuchet MS", system-ui, sans-serif',
};

/** Seed colors: bright, warm, and chosen to stay distinct from each other. */
export const SEED_COLORS: number[] = [
  0xf25f5c, // tomato
  0xffc93c, // sunflower
  0x6bcb77, // leaf
  0x4d96ff, // sky
  0x9b5de5, // grape
  0xff8fc7, // blossom
  0xff8c42, // pumpkin
  0x2ec4b6, // teal
  0x8d6e63, // cocoa
  0x3d5a80, // indigo
  0xc5e063, // lime
  0x4a4a4a, // charcoal
];

export const SEED_TEX = (c: number) => `seed-${c}`;
