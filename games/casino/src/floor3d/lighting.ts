/**
 * Floor lighting modes (VA-0040/VA-0043). "flat" is the original even lighting; "vegas" darkens the
 * room light so the art's emissive neon carries the scene, and adds a half-resolution bloom whose
 * threshold only lets HDR emissive light through (the art tags those meshes `userData.glow`, and
 * their emissiveIntensity of 2.6–3.0 lands well above 1.0 in the linear buffer). Reel screens are
 * unlit textures that top out at 1.0, so they stay under the threshold and remain sharp.
 *
 * Pure data and a parser here so the numbers are testable without WebGL; world.ts applies them.
 */
export type LightMode = 'vegas' | 'flat';
export const LIGHT_MODES: readonly LightMode[] = ['vegas', 'flat'];
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
    envIntensity: 0.4,
    hemi: { sky: 0xffe2c4, ground: 0x1a0e18, intensity: 0.38 },
    sun: { color: 0xffe8cc, intensity: 0.4 },
    lamp: { color: 0xffc27a, intensity: 22, distance: 12, decay: 1.7 },
    bloom: { strength: 0.75, radius: 0.45, threshold: 1.0 },
  },
};

/** The stored choice, defaulting to vegas; anything unknown also means vegas. */
export function parseLightMode(stored: string | null | undefined): LightMode {
  return stored === 'flat' ? 'flat' : 'vegas';
}

export function nextLightMode(m: LightMode): LightMode {
  return LIGHT_MODES[(LIGHT_MODES.indexOf(m) + 1) % LIGHT_MODES.length];
}
