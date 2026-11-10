/**
 * Story mode: "Vault 9".
 *
 * After the collapse, you are the night archivist in an underground seed vault.
 * A quake mixed every storage drawer; sorting restores the catalog, and each
 * chapter brings one vault sector back online. A surface colony, Haven, radios
 * down for food stock. The previous archivist, Reyes, went quiet a year ago,
 * and something is drawing power inside a sector that has been sealed since day 0.
 *
 * Tone: terse logs and radio traffic. Understated. No speeches.
 *
 * Each chapter has three beats: intro (before its first level), midpoint, and
 * outro (after its last level). Beats play once.
 */
export type Speaker = 'log' | 'vault' | 'haven' | 'reyes' | 'unknown';

export interface Line {
  speaker: Speaker;
  text: string;
}

export interface Chapter {
  id: number;
  /** Sector letter, e.g. "A". */
  sector: string;
  title: string;
  objective: string;
  firstLevel: number;
  lastLevel: number;
  /** Day count and vault power shown in the log header. */
  day: number;
  powerStart: number;
  powerEnd: number;
  intro: Line[];
  mid: Line[];
  outro: Line[];
}

/** Tag shown before each line and its color. `log` lines have no tag. */
export const SPEAKERS: Record<Speaker, { tag: string; color: number }> = {
  log: { tag: '', color: 0x8a97b1 },
  vault: { tag: 'VAULT', color: 0x3ddc84 },
  haven: { tag: 'HAVEN RELAY', color: 0x5ac8fa },
  reyes: { tag: 'ARCHIVE LOG / M. REYES', color: 0xffc23d },
  unknown: { tag: 'UNKNOWN SIGNAL', color: 0xff5d5d },
};

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    sector: 'A',
    title: 'Intake',
    objective: 'Restore the catalog',
    firstLevel: 1,
    lastLevel: 8,
    day: 112,
    powerStart: 12,
    powerEnd: 19,
    intro: [
      { speaker: 'log', text: 'Emergency lighting only. The aftershock knocked every drawer in Sector A to the floor.' },
      { speaker: 'vault', text: 'Archivist on duty. Storage contents mixed. Sort by strain to restore cataloguing.' },
      { speaker: 'haven', text: 'Vault, this is Haven. Planting starts in nine days. We need viable food stock. Anything you have.' },
    ],
    mid: [
      { speaker: 'vault', text: 'Catalog 40% restored. Rerouting reserve power to cold storage.' },
      { speaker: 'haven', text: 'Copy. Forty-one people up here. Beans and grain if you can.' },
    ],
    outro: [
      { speaker: 'haven', text: 'First crate arrived. Germination test came back clean.' },
      { speaker: 'vault', text: 'Warning: Sector B temperature rising. Viability at risk.' },
    ],
  },
  {
    id: 2,
    sector: 'B',
    title: 'Cold Storage',
    objective: 'Stabilize the freezers',
    firstLevel: 9,
    lastLevel: 18,
    day: 119,
    powerStart: 19,
    powerEnd: 27,
    intro: [
      { speaker: 'vault', text: 'Sector B at -4°C and climbing. Seeds above 5°C lose viability within days.' },
      { speaker: 'log', text: 'Frost on the drawer handles. Some of the labels are handwritten.' },
    ],
    mid: [
      { speaker: 'reyes', text: 'If someone finds this: the catalog in Sector D doesn’t match the manifest. I’m going to look.' },
      { speaker: 'log', text: 'Entry dated 340 days ago. No entries after it.' },
    ],
    outro: [
      { speaker: 'vault', text: 'Cold storage stable at -18°C.' },
      { speaker: 'haven', text: 'Vault, who is Reyes? Our records say your predecessor went quiet a year ago.' },
    ],
  },
  {
    id: 3,
    sector: 'C',
    title: 'Germination',
    objective: 'Test viability before shipment',
    firstLevel: 19,
    lastLevel: 30,
    day: 131,
    powerStart: 27,
    powerEnd: 34,
    intro: [
      { speaker: 'haven', text: 'Blight in the east field. We lost a third of the beans. Need resistant stock.' },
      { speaker: 'vault', text: 'Germination trays offline. Viability testing required before shipment.' },
    ],
    mid: [
      { speaker: 'log', text: 'Tray 7 sprouted overnight. Tray 8 didn’t.' },
      { speaker: 'vault', text: 'Viability 62%. Acceptable.' },
    ],
    outro: [
      { speaker: 'haven', text: 'East field replanted. Kids are eating twice a day again.' },
      { speaker: 'vault', text: 'Anomaly: power draw in Sector D. Sector D has been sealed since day 0.' },
    ],
  },
  {
    id: 4,
    sector: 'D',
    title: 'Sealed',
    objective: 'Override the seal',
    firstLevel: 31,
    lastLevel: 42,
    day: 140,
    powerStart: 34,
    powerEnd: 41,
    intro: [
      { speaker: 'vault', text: 'Seal override requires a complete catalog.' },
      { speaker: 'unknown', text: '...drawer nine... don’t trust the manifest...' },
    ],
    mid: [
      { speaker: 'reyes', text: 'The manifest lists 33 strains. The vault holds 34. One was never meant to be catalogued.' },
      { speaker: 'log', text: 'Signal source triangulated. It’s coming from inside Sector D.' },
    ],
    outro: [
      { speaker: 'vault', text: 'Seal released.' },
      { speaker: 'log', text: 'Sector D is warm. Grow lights on. Someone has been tending plants down here.' },
    ],
  },
  {
    id: 5,
    sector: 'E',
    title: 'Surface Lock',
    objective: 'Open the way up',
    firstLevel: 43,
    lastLevel: 55,
    day: 151,
    powerStart: 41,
    powerEnd: 58,
    intro: [
      { speaker: 'reyes', text: 'You found the garden. I couldn’t open the surface lock alone.' },
      { speaker: 'haven', text: 'Vault, your transmissions are coming from two places now. Explain.' },
    ],
    mid: [
      { speaker: 'reyes', text: 'The 34th strain grows in ash. That’s why I stayed. The surface isn’t dead.' },
    ],
    outro: [
      { speaker: 'vault', text: 'Surface lock open.' },
      { speaker: 'log', text: 'Daylight. Green at the edges of the crater.' },
      { speaker: 'haven', text: 'We see you, Vault. We see the green.' },
      { speaker: 'log', text: 'End of season one. Transmission continues.' },
    ],
  },
];

export type BeatKind = 'intro' | 'mid' | 'outro';

export interface Beat {
  key: string;
  chapter: Chapter;
  kind: BeatKind;
  lines: Line[];
}

export function chapterForLevel(level: number): Chapter | null {
  return CHAPTERS.find((c) => level >= c.firstLevel && level <= c.lastLevel) ?? null;
}

export function midLevel(c: Chapter): number {
  return c.firstLevel + Math.floor((c.lastLevel - c.firstLevel + 1) / 2) - 1;
}

function beat(chapter: Chapter, kind: BeatKind): Beat {
  return { key: `c${chapter.id}-${kind}`, chapter, kind, lines: chapter[kind] };
}

/** Beats due before starting `level`: the chapter intro, if it's the chapter's first level. */
export function beatsBefore(level: number): Beat[] {
  const c = chapterForLevel(level);
  return c && c.firstLevel === level ? [beat(c, 'intro')] : [];
}

/** Beats due after clearing `level`: the midpoint or the outro. */
export function beatsAfter(level: number): Beat[] {
  const c = chapterForLevel(level);
  if (!c) return [];
  if (level === c.lastLevel) return [beat(c, 'outro')];
  if (level === midLevel(c)) return [beat(c, 'mid')];
  return [];
}

/**
 * Every unseen beat between finishing `level - 1` and starting `level`. Also
 * includes the current chapter's intro if it was never shown (e.g. a player
 * who started before the story existed), so nobody lands mid-chapter cold.
 */
export function pendingBeats(level: number, seen: readonly string[]): Beat[] {
  const due = [...beatsAfter(level - 1), ...beatsBefore(level)];
  const c = chapterForLevel(level);
  if (c && !due.some((b) => b.key === `c${c.id}-intro`)) due.unshift(beat(c, 'intro'));
  return due.filter((b) => !seen.includes(b.key));
}

/** Progress within the current chapter, for the menu and HUD. */
export function chapterProgress(level: number): { chapter: Chapter; done: number; total: number } | null {
  const c = chapterForLevel(level);
  if (!c) return null;
  return { chapter: c, done: level - c.firstLevel, total: c.lastLevel - c.firstLevel + 1 };
}

export const STORY_LAST_LEVEL = CHAPTERS[CHAPTERS.length - 1]!.lastLevel;
