/**
 * Player avatars: the 16 photorealistic presets cut from the official
 * reference sheet (assets/avatar-references/), and the customisation
 * catalogue for the Dressing Room.
 *
 * The presets are flattened photographs, so a look (hair, outfit, beard...)
 * can only change when a matching realistic variant of that character exists.
 * Variants are registered in VARIANT_ART; until one is, its option is shown
 * but locked. Nothing is drawn over a photo to fake a change.
 */
export type Presentation = 'female' | 'male';

export interface AvatarPreset {
  /** Stable id: used in saves, online profiles and texture keys. Never rename. */
  id: string;
  /** Internal preset label shown in the Dressing Room (players pick their own username). */
  name: string;
  presentation: Presentation;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  ...['Ava', 'Brooke', 'Carmen', 'Dakota', 'Elena', 'Fallon', 'Jasmine', 'Natalie'].map((name) => ({ id: name.toLowerCase(), name, presentation: 'female' as const })),
  ...['Alex', 'Braden', 'Carlos', 'Derek', 'Jax', 'Luca', 'Mason', 'Viktor'].map((name) => ({ id: name.toLowerCase(), name, presentation: 'male' as const })),
];

export const presetById = (id: string) => AVATAR_PRESETS.find((p) => p.id === id);
/** Round head-and-shoulders portrait used wherever a player appears. */
export const faceKey = (id: string) => `av-${id}`;
/** Full 3:4 portrait used in the Dressing Room. */
export const portraitKey = (id: string) => `portrait-${id}`;
export const faceFile = (id: string) => `art/avatars/real/${id}-face.webp`;
export const portraitFile = (id: string) => `art/avatars/real/${id}.webp`;

// ------------------------------------------------------------------ customisation catalogue
export type CategoryId = 'face' | 'hair' | 'facialHair' | 'eyes' | 'clothing' | 'accessories';

export interface CustomOption {
  id: string;
  label: string;
}
export interface CustomGroup {
  id: string;
  label: string;
  options: CustomOption[];
  /** Only offered for these presentations (default: all). */
  for?: Presentation[];
}
export interface CustomCategory {
  id: CategoryId;
  label: string;
  groups: CustomGroup[];
}

/** Every group starts with 'As pictured': the preset exactly as photographed. */
export const AS_PICTURED = 'pictured';
const opts = (...labels: string[]): CustomOption[] => [
  { id: AS_PICTURED, label: 'As pictured' },
  ...labels.map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label })),
];

export const CUSTOM_CATEGORIES: CustomCategory[] = [
  {
    id: 'face',
    label: 'Face',
    groups: [
      { id: 'face-preset', label: 'Face', options: opts('Soft', 'Defined', 'Mature') },
      { id: 'skin-tone', label: 'Skin tone', options: opts('Fair', 'Light', 'Medium', 'Olive', 'Brown', 'Deep') },
      { id: 'expression', label: 'Expression', options: opts('Smile', 'Confident', 'Serious') },
    ],
  },
  {
    id: 'hair',
    label: 'Hair',
    groups: [
      { id: 'hairstyle', label: 'Style', options: opts('Waves', 'Curls', 'Straight', 'Updo', 'Slicked back', 'Short crop') },
      { id: 'hair-color', label: 'Colour', options: opts('Black', 'Brown', 'Auburn', 'Red', 'Blonde', 'Silver') },
      { id: 'hair-length', label: 'Length', options: opts('Short', 'Medium', 'Long') },
    ],
  },
  {
    id: 'facialHair',
    label: 'Facial Hair',
    groups: [{ id: 'facial-hair', label: 'Facial hair', options: opts('Clean-shaven', 'Stubble', 'Mustache', 'Short beard', 'Full beard'), for: ['male'] }],
  },
  {
    id: 'eyes',
    label: 'Eyes',
    groups: [
      { id: 'eye-color', label: 'Eye colour', options: opts('Brown', 'Hazel', 'Green', 'Blue', 'Grey') },
      { id: 'eyebrows', label: 'Eyebrows', options: opts('Natural', 'Groomed', 'Bold') },
    ],
  },
  {
    id: 'clothing',
    label: 'Outfits',
    groups: [
      {
        id: 'outfit',
        label: 'Outfit',
        options: opts('Casual casino', 'Formal suit', 'Tuxedo', 'Evening dress', 'Luxury fashion', 'VIP'),
      },
    ],
  },
  {
    id: 'accessories',
    label: 'Accessories',
    groups: [
      { id: 'eyewear', label: 'Eyewear', options: opts('Sunglasses', 'Eyeglasses') },
      { id: 'jewelry', label: 'Jewelry', options: opts('Necklace', 'Earrings', 'Watch') },
      { id: 'hat', label: 'Hat', options: opts('Fedora', 'Cowboy hat', 'Cap') },
    ],
  },
];

/**
 * Realistic variant artwork: preset id -> `${group}:${option}` -> asset file
 * (a full portrait of that same character with that change, photographed or
 * rendered to match). Empty until new artwork is delivered; add entries here
 * and the matching options unlock automatically.
 */
export const VARIANT_ART: Record<string, Record<string, string>> = {};

export const groupsFor = (presetId: string, cat: CustomCategory): CustomGroup[] => {
  const p = presetById(presetId);
  return cat.groups.filter((g) => !g.for || (p && g.for.includes(p.presentation)));
};

/** Can this option be chosen for this preset? 'As pictured' always can; others need variant art. */
export function optionAvailable(presetId: string, groupId: string, optionId: string): boolean {
  return optionId === AS_PICTURED || Boolean(VARIANT_ART[presetId]?.[`${groupId}:${optionId}`]);
}

/** A player's look: the preset plus a chosen option per group (missing = as pictured). */
export interface AvatarLook {
  preset: string;
  custom: Record<string, string>;
}

/** Drops choices the preset has no artwork for, so a saved look is always one we can show. */
export function sanitizeLook(look: AvatarLook): AvatarLook {
  const custom: Record<string, string> = {};
  for (const [g, o] of Object.entries(look.custom ?? {})) if (o !== AS_PICTURED && optionAvailable(look.preset, g, o)) custom[g] = o;
  return { preset: presetById(look.preset) ? look.preset : AVATAR_PRESETS[0]!.id, custom };
}

/**
 * The texture key for a look: the variant portrait when one is chosen and
 * registered (first matching group wins), else the preset's own face.
 */
export function lookFaceKey(look: AvatarLook): string {
  const s = sanitizeLook(look);
  const chosen = Object.entries(s.custom)[0];
  return chosen ? `av-${s.preset}--${chosen[0]}-${chosen[1]}` : faceKey(s.preset);
}

/** Saved `avatar` value for a preset look ('av-ava'), recognised by every client. */
export const avatarValue = (look: AvatarLook) => lookFaceKey(look);
/** The preset id behind a saved avatar value, if it is one. */
export function presetOfValue(v: string): string | null {
  const m = /^av-([a-z]+)/.exec(v ?? '');
  return m && presetById(m[1]!) ? m[1]! : null;
}

/** Computer players wear real portraits too (no illustrated faces anywhere). */
export const BOT_FACES: Record<string, string> = {
  rosa: 'dakota', dmitri: 'viktor', kwame: 'jax', lena: 'fallon', hector: 'carlos', priya: 'elena', sam: 'braden', yuki: 'natalie',
};
