import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AVATAR_PRESETS, BOT_FACES, CUSTOM_CATEGORIES, DEFAULT_PRESET, canCustomize, presetById, presetOfValue } from '../src/logic/avatars.ts';

const pub = (f: string) => new URL(`../public/${f}`, import.meta.url).pathname;
const webpSize = (f: string) => {
  // VP8 / VP8L / VP8X header -> width x height
  const b = readFileSync(pub(f));
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
};

describe('avatar art pack', () => {
  it('has the 16 presets from the manifest, avatar_01 to avatar_16, in order', () => {
    expect(AVATAR_PRESETS.map((p) => p.id)).toEqual(Array.from({ length: 16 }, (_, i) => `avatar_${String(i + 1).padStart(2, '0')}`));
    expect(AVATAR_PRESETS.map((p) => p.name)).toEqual([
      'Ava', 'Brooke', 'Carmen', 'Dakota', 'Elena', 'Fallon', 'Jasmine', 'Natalie',
      'Alex', 'Braden', 'Carlos', 'Derek', 'Jax', 'Luca', 'Mason', 'Viktor',
    ]);
    expect(DEFAULT_PRESET).toBe('avatar_01');
  });
  it('uses the supplied WebP portraits (192x240) and thumbnails (96x120), plus round crops of them', () => {
    for (const p of AVATAR_PRESETS) {
      for (const f of [p.portrait, p.thumbnail, p.round, p.roundThumb]) expect(existsSync(pub(f)), f).toBe(true);
      expect(webpSize(p.portrait), p.id).toEqual([192, 240]);
      expect(webpSize(p.thumbnail), p.id).toEqual([96, 120]);
    }
  });
  it('computer players wear presets', () => {
    for (const id of Object.values(BOT_FACES)) expect(presetById(id)).toBeTruthy();
  });
});

describe('avatar values', () => {
  it('recognises current ids and the version 1.5 keys', () => {
    expect(presetOfValue('avatar_07')).toBe('avatar_07');
    expect(presetOfValue('av-avatar_07')).toBe('avatar_07');
    expect(presetOfValue('av-jasmine')).toBe('avatar_07');
    expect(presetOfValue('jasmine')).toBe('avatar_07');
    expect(presetOfValue('av-viktor')).toBe('avatar_16');
  });
  it('rejects photos and retired illustrated keys', () => {
    expect(presetOfValue('data:image/png;base64,xx')).toBeNull();
    expect(presetOfValue('av-pick-ace')).toBeNull();
    expect(presetOfValue('')).toBeNull();
  });
});

describe('customisation', () => {
  it('is not offered: the art pack has no variation images', () => {
    for (const p of AVATAR_PRESETS) expect(canCustomize(p.id)).toBe(false);
    expect(CUSTOM_CATEGORIES.map((c) => c.label)).toEqual(['Face', 'Hair', 'Facial Hair', 'Eyes', 'Outfits', 'Accessories']);
  });
});
