/**
 * Story mode: "Larkspur Gardens".
 *
 * You inherit your great-aunt Ivy's abandoned botanical garden. A storm knocked
 * over her seed vault and every seed is mixed up, so you sort them, and each
 * chapter of puzzles restores one area of the garden. The town will sell the
 * land to a developer unless the garden reopens for the Spring Festival.
 *
 * Each chapter has three story beats: an intro (before its first level), a
 * midpoint, and an outro (after its last level). Beats play once.
 */
export type Speaker = 'narrator' | 'ivy' | 'theo' | 'harlow' | 'mayor';

export interface Line {
  speaker: Speaker;
  text: string;
}

export interface Chapter {
  id: number;
  title: string;
  /** The garden area this chapter restores. */
  area: string;
  firstLevel: number;
  lastLevel: number;
  intro: Line[];
  mid: Line[];
  outro: Line[];
}

export const SPEAKERS: Record<Speaker, { name: string; color: number; initial: string }> = {
  narrator: { name: '', color: 0x8a97b1, initial: '' },
  ivy: { name: 'Aunt Ivy’s letter', color: 0xa47bff, initial: 'I' },
  theo: { name: 'Theo', color: 0x3ddc84, initial: 'T' },
  harlow: { name: 'Mr. Harlow', color: 0xff9a3c, initial: 'H' },
  mayor: { name: 'Mayor Bell', color: 0x4d8dff, initial: 'B' },
};

export const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: 'The Locked Gate',
    area: 'Front Beds',
    firstLevel: 1,
    lastLevel: 8,
    intro: [
      { speaker: 'narrator', text: 'The key came in an envelope with your name on it. Larkspur Gardens. You haven’t been here since you were small.' },
      { speaker: 'ivy', text: 'If you’re reading this, the garden is yours now. I’m sorry I left it in such a state. Start with the seed vault. You’ll see what I mean.' },
      { speaker: 'narrator', text: 'Inside, a storm has thrown every drawer to the floor. Thousands of seeds, all mixed together.' },
    ],
    mid: [
      { speaker: 'theo', text: 'Well, I’ll be. Someone finally opened that gate. I’m Theo. I kept the grounds for your aunt for thirty years.' },
      { speaker: 'theo', text: 'Sort the seeds by kind and I’ll get them in the ground. The front beds first. Folks should see color from the road.' },
    ],
    outro: [
      { speaker: 'narrator', text: 'By evening the front beds are planted in neat rows.' },
      { speaker: 'mayor', text: 'Ah, you must be Ivy’s heir. I wish I had better news. The town can’t keep paying taxes on a closed garden.' },
      { speaker: 'mayor', text: 'Unless Larkspur reopens for the Spring Festival, the council will sell the land. There’s already a buyer.' },
    ],
  },
  {
    id: 2,
    title: 'The Glass House',
    area: 'Greenhouse',
    firstLevel: 9,
    lastLevel: 18,
    intro: [
      { speaker: 'theo', text: 'The greenhouse was Ivy’s pride. Half the panes are cracked, but the bones are good.' },
      { speaker: 'theo', text: 'The tender seeds need warmth to start. Sort them and we’ll fill these benches again.' },
    ],
    mid: [
      { speaker: 'narrator', text: 'Behind a stack of clay pots you find a second envelope, sealed with green wax.' },
      { speaker: 'ivy', text: 'You found the greenhouse. Good. I kept something special in the vault, the rarest seed I ever grew. Keep sorting. You’ll know it when you see it.' },
    ],
    outro: [
      { speaker: 'narrator', text: 'Sunlight pours through the new glass. Seedlings crowd every bench.' },
      { speaker: 'harlow', text: 'Charming. I’m Harlow, of Harlow Development. I’ve made the council a generous offer for this land.' },
      { speaker: 'harlow', text: 'Do enjoy your little hobby while it lasts.' },
    ],
  },
  {
    id: 3,
    title: 'Roots and Branches',
    area: 'Orchard',
    firstLevel: 19,
    lastLevel: 30,
    intro: [
      { speaker: 'theo', text: 'Don’t let Harlow rattle you. The orchard’s next. Those trees have fed this town for a hundred years.' },
      { speaker: 'theo', text: 'We’ll need fruit seeds for the gaps where the old trees came down.' },
    ],
    mid: [
      { speaker: 'theo', text: 'Your aunt planted that pear tree the year I started. Said a garden is just patience you can see.' },
      { speaker: 'ivy', text: 'Theo will tell you I was stubborn. He’s right. Be stubborn too. Gardens reward it.' },
    ],
    outro: [
      { speaker: 'narrator', text: 'The orchard is pruned and planted. Neighbors start stopping at the gate to look.' },
      { speaker: 'mayor', text: 'People are talking about Larkspur again. I can’t promise anything, but I’ll tell the council what I’ve seen.' },
    ],
  },
  {
    id: 4,
    title: 'The Herb Spiral',
    area: 'Herb Garden',
    firstLevel: 31,
    lastLevel: 42,
    intro: [
      { speaker: 'narrator', text: 'A spiral of stone beds, buried under bindweed. Ivy’s notebook is tucked in the center stone.' },
      { speaker: 'ivy', text: 'Mint, sage, rosemary, thyme. Plant them from the top of the spiral down, dry-lovers above, thirsty ones below.' },
    ],
    mid: [
      { speaker: 'narrator', text: 'In the notebook’s margins, a sketch of a flower you don’t recognize, and two words: Midnight Lotus.' },
      { speaker: 'theo', text: 'The lotus? I thought that was a story she told the kids. She said it only blooms once the whole garden is alive again.' },
    ],
    outro: [
      { speaker: 'harlow', text: 'I hear you’re rebuilding the pond next. Water’s expensive. So are lawyers.' },
      { speaker: 'theo', text: 'He’s worried. That means we’re winning.' },
    ],
  },
  {
    id: 5,
    title: 'Still Water',
    area: 'Lily Pond',
    firstLevel: 43,
    lastLevel: 55,
    intro: [
      { speaker: 'theo', text: 'The pond’s the heart of Larkspur. Clear it, plant the edges, and the whole garden comes together.' },
    ],
    mid: [
      { speaker: 'ivy', text: 'The rarest seed isn’t in a drawer. It’s in the pond, waiting for clean water. If you’ve come this far, you’ll find it.' },
    ],
    outro: [
      { speaker: 'narrator', text: 'The water runs clear. At dusk, one pale bud rises above the lily pads.' },
      { speaker: 'mayor', text: 'The council has voted. Larkspur Gardens stays open for the Spring Festival. Ivy would be proud.' },
      { speaker: 'theo', text: 'Festival’s in a month. We’ve got a lot more garden to wake up. Ready?' },
      { speaker: 'narrator', text: 'Season 1 complete. New chapters are on their way. Keep sorting to grow your garden.' },
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

/** Every unseen beat between finishing `level - 1` and starting `level`. */
export function pendingBeats(level: number, seen: readonly string[]): Beat[] {
  return [...beatsAfter(level - 1), ...beatsBefore(level)].filter((b) => !seen.includes(b.key));
}

/** Progress within the current chapter, for the menu and HUD. */
export function chapterProgress(level: number): { chapter: Chapter; done: number; total: number } | null {
  const c = chapterForLevel(level);
  if (!c) return null;
  return { chapter: c, done: level - c.firstLevel, total: c.lastLevel - c.firstLevel + 1 };
}

export const STORY_LAST_LEVEL = CHAPTERS[CHAPTERS.length - 1]!.lastLevel;
