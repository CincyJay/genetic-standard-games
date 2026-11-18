/**
 * Floor lighting modes (VA-0040/VA-0043). "flat" is the original even lighting; "vegas" darkens the
 * room light so the art's emissive neon carries the scene, and adds a half-resolution bloom whose
 * threshold only lets HDR emissive light through (the art tags those meshes `userData.glow`, and
 * their emissiveIntensity of 2.6–3.0 lands well above 1.0 in the linear buffer). Reel screens are
 * unlit textures that top out at 1.0, so they stay under the threshold and remain sharp.
 *
 * Pure data and a parser here so the numbers are testable without WebGL; world.ts applies them.
 */
export type LightMode = 'vegas' | 'warm' | 'flat';
export const LIGHT_MODES: readonly LightMode[] = ['vegas', 'warm', 'flat'];
export const LIGHT_STORAGE_KEY = 'va3d.light';

export interface LightRig {
  exposure: number;
  envIntensity: number;
  hemi: { sky: number; ground: number; intensity: number };
  sun: { color: number; intensity: number };
  /** Warm pools under the two chandeliers. */
  lamp: { color: number; intensity: number; distance: number; decay: number };
  /** null: render straight to the screen, no post-processing. */
  bloom: { strength: number; radius: number; threshold: number } | null;
}

export const LIGHT_RIGS: Record<LightMode, LightRig> = {
  flat: {
    exposure: 1.05,
    envIntensity: 0.55,
    hemi: { sky: 0xfff0dc, ground: 0x2a1a24, intensity: 0.9 },
    sun: { color: 0xfff4e6, intensity: 1.1 },
    lamp: { color: 0xffd59a, intensity: 14, distance: 13, decay: 1.6 },
    bloom: null,
  },
  vegas: {
    exposure: 1.0,
    // phone check (VA-0060): at 0.38/0.4 the room still read evenly lit next to flat, and the
    // wide bloom washed the hero's neon into a white halo; darker room, tighter glow
    envIntensity: 0.25,
    hemi: { sky: 0xffe2c4, ground: 0x1a0e18, intensity: 0.2 },
    sun: { color: 0xffe8cc, intensity: 0.15 },
    lamp: { color: 0xffc27a, intensity: 26, distance: 11, decay: 1.7 },
    bloom: { strength: 0.55, radius: 0.2, threshold: 1.0 },
  },
  // Joshua's reference room (VA-0160): a warm, gold-lit hall rather than a dark one, with violet in
  // the shadows; the machines' neon and the end caps' bulbs still bloom
  warm: {
    exposure: 1.12,
    envIntensity: 0.45,
    hemi: { sky: 0xffd49a, ground: 0x2a1236, intensity: 0.6 },
    sun: { color: 0xffd6a0, intensity: 0.45 },
    lamp: { color: 0xffbf6a, intensity: 34, distance: 14, decay: 1.6 },
    bloom: { strength: 0.5, radius: 0.28, threshold: 1.0 },
  },
};

/** The stored choice; nothing stored or anything unknown means the fallback (vegas). */
export function parseLightMode(stored: string | null | undefined, fallback: LightMode = 'vegas'): LightMode {
  return stored === 'flat' || stored === 'warm' || stored === 'vegas' ? stored : fallback;
}

export function nextLightMode(m: LightMode): LightMode {
  return LIGHT_MODES[(LIGHT_MODES.indexOf(m) + 1) % LIGHT_MODES.length];
}
