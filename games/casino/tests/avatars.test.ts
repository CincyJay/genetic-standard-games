import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AS_PICTURED, AVATAR_PRESETS, BOT_FACES, CUSTOM_CATEGORIES, VARIANT_ART, avatarValue, faceFile, groupsFor, lookFaceKey, optionAvailable,
  portraitFile, presetById, presetOfValue, sanitizeLook,
} from '../src/logic/avatars.ts';

const pub = (f: string) => new URL(`../public/${f}`, import.meta.url).pathname;

describe('avatar presets', () => {
  it('are the 16 characters from the reference sheet, with unique ids', () => {
    expect(AVATAR_PRESETS.map((p) => p.name)).toEqual([
      'Ava', 'Brooke', 'Carmen', 'Dakota', 'Elena', 'Fallon', 'Jasmine', 'Natalie',
      'Alex', 'Braden', 'Carlos', 'Derek', 'Jax', 'Luca', 'Mason', 'Viktor',
    ]);
    expect(new Set(AVATAR_PRESETS.map((p) => p.id)).size).toBe(16);
    expect(AVATAR_PRESETS.filter((p) => p.presentation === 'female')).toHaveLength(8);
  });
  it('every preset has its portrait and round face as WebP', () => {
    for (const p of AVATAR_PRESETS) {
      expect(existsSync(pub(portraitFile(p.id))), p.id).toBe(true);
      expect(existsSync(pub(faceFile(p.id))), p.id).toBe(true);
    }
  });
  it('computer players wear preset faces', () => {
    for (const preset of Object.values(BOT_FACES)) expect(presetById(preset)).toBeTruthy();
  });
});

describe('customisation', () => {
  it('has the six categories with "As pictured" first in every group', () => {
    expect(CUSTOM_CATEGORIES.map((c) => c.label)).toEqual(['Face', 'Hair', 'Facial Hair', 'Eyes', 'Outfits', 'Accessories']);
    for (const c of CUSTOM_CATEGORIES) for (const g of c.groups) expect(g.options[0]!.id).toBe(AS_PICTURED);
  });
  it('facial hair is only offered where it applies', () => {
    const fh = CUSTOM_CATEGORIES.find((c) => c.id === 'facialHair')!;
    expect(groupsFor('alex', fh)).toHaveLength(1);
    expect(groupsFor('ava', fh)).toHaveLength(0);
  });
  it('locks every option without realistic variant art, and unlocks it when art is registered', () => {
    expect(optionAvailable('ava', 'hairstyle', 'curls')).toBe(false);
    expect(optionAvailable('ava', 'hairstyle', AS_PICTURED)).toBe(true);
    VARIANT_ART.ava = { 'hairstyle:curls': 'art/avatars/real/variants/ava-curls.webp' };
    try {
      expect(optionAvailable('ava', 'hairstyle', 'curls')).toBe(true);
      expect(lookFaceKey({ preset: 'ava', custom: { hairstyle: 'curls' } })).toBe('av-ava--hairstyle-curls');
    } finally {
      delete VARIANT_ART.ava;
    }
  });
  it('a saved look never keeps an option it cannot show', () => {
    expect(sanitizeLook({ preset: 'ava', custom: { hairstyle: 'curls', outfit: AS_PICTURED } })).toEqual({ preset: 'ava', custom: {} });
    expect(sanitizeLook({ preset: 'nobody', custom: {} }).preset).toBe('ava');
  });
  it('saved avatar values map back to their preset', () => {
    const v = avatarValue({ preset: 'jax', custom: {} });
    expect(v).toBe('av-jax');
    expect(presetOfValue(v)).toBe('jax');
    expect(presetOfValue('av-jax--hairstyle-curls')).toBe('jax');
    expect(presetOfValue('data:image/png;base64,xx')).toBeNull();
    expect(presetOfValue('av-pick-ace')).toBeNull();
  });
});
