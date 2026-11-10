import { describe, expect, it } from 'vitest';
import { CHAPTERS, beatsAfter, beatsBefore, chapterForLevel, midLevel, pendingBeats } from '../src/story.ts';

describe('story', () => {
  it('chapters cover consecutive levels starting at 1 with no gaps', () => {
    expect(CHAPTERS[0]!.firstLevel).toBe(1);
    for (let i = 1; i < CHAPTERS.length; i++) expect(CHAPTERS[i]!.firstLevel).toBe(CHAPTERS[i - 1]!.lastLevel + 1);
    for (const c of CHAPTERS) {
      expect(c.lastLevel).toBeGreaterThan(c.firstLevel);
      expect(c.intro.length + c.mid.length + c.outro.length).toBeGreaterThan(2);
    }
  });

  it('places intro before the first level, mid after the midpoint, outro after the last', () => {
    const c = CHAPTERS[1]!;
    expect(beatsBefore(c.firstLevel).map((b) => b.key)).toEqual([`c${c.id}-intro`]);
    expect(beatsAfter(midLevel(c)).map((b) => b.key)).toEqual([`c${c.id}-mid`]);
    expect(beatsAfter(c.lastLevel).map((b) => b.key)).toEqual([`c${c.id}-outro`]);
    expect(beatsBefore(c.firstLevel + 1)).toEqual([]);
  });

  it('between chapters, plays the outro then the next intro', () => {
    const next = CHAPTERS[1]!;
    expect(pendingBeats(next.firstLevel, []).map((b) => b.key)).toEqual(['c1-outro', 'c2-intro']);
  });

  it('plays the current chapter intro for a player who never saw it', () => {
    expect(pendingBeats(3, []).map((b) => b.key)).toEqual(['c1-intro']);
    expect(pendingBeats(3, ['c1-intro'])).toEqual([]);
    // intro comes before a midpoint that is also due
    expect(pendingBeats(5, []).map((b) => b.key)).toEqual(['c1-intro', 'c1-mid']);
  });

  it('never replays seen beats', () => {
    expect(pendingBeats(1, ['c1-intro'])).toEqual([]);
  });

  it('has no story after the last chapter', () => {
    const last = CHAPTERS[CHAPTERS.length - 1]!.lastLevel;
    expect(chapterForLevel(last + 1)).toBeNull();
    expect(pendingBeats(last + 2, [])).toEqual([]);
  });
});
