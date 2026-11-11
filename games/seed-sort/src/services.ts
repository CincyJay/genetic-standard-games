import { AdsService, DebugAnalytics, FakeAdsProvider, Haptics, SaveStore, SynthAudio, DEFAULT_THEME, type Theme } from '@tgs/kit';

export interface SaveData {
  /** Next level the player will play (1-based). */
  level: number;
  /** Best stars per level id. */
  stars: Record<number, number>;
  levelsCompleted: number;
  /** Highest single-level score. */
  bestScore: number;
  /** Plant variety id -> copies collected from seed packs. */
  garden: Record<string, number>;
  settings: { sound: boolean; haptics: boolean };
}

const defaults = (): SaveData => ({
  level: 1,
  stars: {},
  levelsCompleted: 0,
  bestScore: 0,
  garden: {},
  settings: { sound: true, haptics: true },
});

export const save = new SaveStore<SaveData>({
  key: 'seed-sort.save',
  version: 2,
  defaults,
  // v1 was the old tube-sorting game: keep the garden and settings, restart levels.
  migrate: (data) => {
    const old = (data ?? {}) as Partial<SaveData>;
    return { ...defaults(), garden: old.garden ?? {}, settings: old.settings ?? defaults().settings };
  },
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

/** Warm garden palette: cream paper surfaces, leaf green actions, brown ink. */
export const THEME: Theme = {
  ...DEFAULT_THEME,
  bg: 0xf3ead8,
  ink: '#3d2e22',
  inkSoft: '#7a6a58',
  primary: 0x5aa845,
  primaryDark: 0x3e7f2f,
  onPrimary: '#ffffff',
  surface: 0xfffaf0,
  surfaceEdge: 0xd9c7a8,
  icon: 0x5a4634,
  accent: 0xf5b83d,
};

/** Secondary button colors (cream with a tan edge). */
export const SECONDARY = { color: 0xf4ead6, shadow: 0xcbb38f, textColor: '#5a4634' };

export const ITEM_TEX = (kind: string) => `item-${kind}`;
