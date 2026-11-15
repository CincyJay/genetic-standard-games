/**
 * Player avatars, driven by the official art pack's manifest
 * (src/data/avatar_manifest.json; artwork in public/assets/avatars/).
 *
 * A player's picture is one of two modes, as the art pack's handoff asks:
 *   preset: one of the 16 photorealistic portraits (avatar_01 ... avatar_16)
 *   photo:  the player's own photo (kept separate, with its own privacy setting)
 *
 * The portraits are flat photographs: nothing about a face, hair or outfit can
 * be changed by drawing over them. Cosmetic controls only appear for a preset
 * once the manifest lists real variation images for it (customizationVariants).
 */
import manifest from '../data/avatar_manifest.json';

export type Presentation = 'female' | 'male';
export type AvatarMode = 'preset' | 'photo';

export interface AvatarVariant {
  /** `${group}:${option}`, e.g. 'eyewear:sunglasses'. */
  key: string;
  label: string;
  portrait: string;
  thumbnail: string;
}

export interface AvatarPreset {
  /** Stable id from the manifest ('avatar_07'). Used in saves and online profiles. Never rename. */
  id: string;
  /** Preset label shown in the Dressing Room (players choose their own usernames). */
  name: string;
  presentation: Presentation;
  /** 192x240 portrait, for selection and the Dressing Room. */
  portrait: string;
  /** 96x120 thumbnail. */
  thumbnail: string;
  /** Round crops of the two (art/casino/avatars/make_round.py) for circular frames. */
  round: string;
  roundThumb: string;
  variants: AvatarVariant[];
}

interface ManifestEntry {
  id: string;
  name: string;
  portrait: string;
  thumbnail: string;
  customizationVariants?: AvatarVariant[];
}

const FEMALE = new Set(['Ava', 'Brooke', 'Carmen', 'Dakota', 'Elena', 'Fallon', 'Jasmine', 'Natalie']);

export const AVATAR_PRESETS: AvatarPreset[] = (manifest.avatars as ManifestEntry[]).map((a) => ({
  id: a.id,
  name: a.name,
  presentation: FEMALE.has(a.name) ? 'female' : 'male',
  portrait: a.portrait,
  thumbnail: a.thumbnail,
  round: a.portrait.replace('/portraits/', '/round/'),
  roundThumb: a.thumbnail.replace('/thumbnails/', '/round-thumbs/'),
  variants: a.customizationVariants ?? [],
}));

export const presetById = (id: string | null | undefined) => AVATAR_PRESETS.find((p) => p.id === id);
export const DEFAULT_PRESET = AVATAR_PRESETS[0]!.id;

/** Texture keys: round portrait (tables, profile), round thumbnail (chat, lists), full portrait. */
export const faceKey = (id: string) => `av-${id}`;
export const thumbKey = (id: string) => `avt-${id}`;
export const portraitKey = (id: string) => `portrait-${id}`;

/**
 * Picture values seen in saves, profiles and chat messages, old and new:
 * 'avatar_07' (now), 'av-avatar_07', and 'av-jasmine' (version 1.5, by name).
 * Returns the preset id, or null for anything else (photos, retired keys).
 */
export function presetOfValue(v: string | null | undefined): string | null {
  if (!v) return null;
  const bare = v.startsWith('av-') ? v.slice(3) : v;
  if (presetById(bare)) return bare;
  const byName = AVATAR_PRESETS.find((p) => p.name.toLowerCase() === bare.split('--')[0]);
  return byName?.id ?? null;
}

// ------------------------------------------------------------------ profile shape
/** What a profile says about its picture (the shape the art pack's handoff suggests). */
export interface AvatarProfile {
  avatarMode: AvatarMode;
  presetAvatarId: string;
  /** Set while a photo is worn: names the player's photo document ('photo-<hash>'). */
  photoAssetId: string | null;
}

/** Who may see a player's photo: every signed-in player, or friends only. Others see the preset. */
export type PhotoVisibility = 'everyone' | 'friends';

// ------------------------------------------------------------------ customisation (future)
export type CategoryId = 'face' | 'hair' | 'facialHair' | 'eyes' | 'clothing' | 'accessories';

/** The categories cosmetic variants will be grouped under, once real variation images exist. */
export const CUSTOM_CATEGORIES: { id: CategoryId; label: string; groups: string[] }[] = [
  { id: 'face', label: 'Face', groups: ['face-preset', 'skin-tone', 'expression'] },
  { id: 'hair', label: 'Hair', groups: ['hairstyle', 'hair-color', 'hair-length'] },
  { id: 'facialHair', label: 'Facial Hair', groups: ['facial-hair'] },
  { id: 'eyes', label: 'Eyes', groups: ['eye-color', 'eyebrows'] },
  { id: 'clothing', label: 'Outfits', groups: ['outfit'] },
  { id: 'accessories', label: 'Accessories', groups: ['eyewear', 'jewelry', 'hat'] },
];

/** True when the manifest has real variation images for this preset (only then is Customize shown). */
export const canCustomize = (presetId: string) => (presetById(presetId)?.variants.length ?? 0) > 0;

/** Computer players wear preset portraits too (no illustrated faces anywhere). */
export const BOT_FACES: Record<string, string> = {
  rosa: 'avatar_04', dmitri: 'avatar_16', kwame: 'avatar_13', lena: 'avatar_06', hector: 'avatar_11', priya: 'avatar_05', sam: 'avatar_10', yuki: 'avatar_08',
};
