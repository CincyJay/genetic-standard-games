import { describe, expect, it } from 'vitest';
import { RULES } from '../src/data/rules.ts';
import { PAIR_PAYS, THREE_PAYS } from '../src/logic/sidebets.ts';
import { PAYS as BACCARAT } from '../src/logic/baccarat.ts';
import { ANTE_BONUS, PAIR_PLUS } from '../src/logic/threecard.ts';
import { BLIND_PAYS, ROYAL_BLIND, ROYAL_TRIPS, TRIPS_PAYS } from '../src/logic/uth.ts';
import { TIE_PAYS } from '../src/logic/war.ts';
import { PAYS_TEXT } from '../src/logic/craps.ts';

/** All the rules text for one game, as one string. */
const all = (k: keyof typeof RULES) => [RULES[k].intro, ...RULES[k].sections.flatMap((s) => [s.head, ...s.lines])].join('\n');
/** "x to 1" with fractions written the way the rules write them (1.5 -> "3 to 2"). */
const to1 = (n: number) => (n === 1.5 ? '3 to 2' : `${n} to 1`);

describe('rules sheet matches the game logic', () => {
  it('blackjack side bets', () => {
    const t = all('blackjack');
    for (const v of Object.values(THREE_PAYS)) expect(t).toContain(to1(v));
    for (const v of Object.values(PAIR_PAYS)) expect(t).toContain(to1(v));
    expect(t).toContain('3 to 2');
  });
  it('baccarat', () => {
    const t = all('baccarat');
    expect(t).toContain(`Player ${to1(BACCARAT.player)}`);
    expect(t).toContain(`Banker ${BACCARAT.banker} to 1`);
    expect(t).toContain(`Tie ${to1(BACCARAT.tie)}`);
    expect(t).toContain(`Pair ${to1(BACCARAT.playerPair)}`);
    expect(BACCARAT.bankerPair).toBe(BACCARAT.playerPair);
  });
  it('three card poker', () => {
    const t = all('threecard');
    const names = ['High card', 'Pair', 'Flush', 'Straight', 'Three of a kind', 'Straight flush'];
    PAIR_PLUS.forEach((v, i) => v && expect(t).toContain(`${names[i]} ${to1(v)}`));
    ANTE_BONUS.forEach((v, i) => v && expect(t).toContain(`${names[i]} ${to1(v)}`));
  });
  it("ultimate hold'em", () => {
    const t = all('uth');
    const names = ['', '', '', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
    const [blind, trips] = [RULES.uth.sections.find((s) => s.head === 'Blind pays')!.lines, RULES.uth.sections.find((s) => s.head.startsWith('Trips'))!.lines];
    for (const [k, v] of Object.entries(BLIND_PAYS)) expect(blind).toContain(`${names[+k]} ${to1(v)}`);
    for (const [k, v] of Object.entries(TRIPS_PAYS)) expect(trips).toContain(`${names[+k]} ${to1(v)}`);
    expect(blind).toContain(`Royal flush ${to1(ROYAL_BLIND)}`);
    expect(trips).toContain(`Royal flush ${to1(ROYAL_TRIPS)}`);
    expect(t).toContain('one Play bet');
  });
  it('casino war', () => {
    expect(all('war')).toContain(to1(TIE_PAYS));
  });
  it('craps', () => {
    const t = all('craps');
    for (const [bet, pays] of Object.entries(PAYS_TEXT)) {
      if (bet === 'passOdds' || bet === 'field') continue;
      expect(t, bet).toContain(pays);
    }
  });
});
