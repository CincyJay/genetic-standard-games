/**
 * Craps. Bets: Pass Line (with odds behind it once a point is set), Don't Pass,
 * Field, Place 4/5/6/8/9/10, the four Hardways, and the one-roll props
 * Any Seven, Any Craps and Yo (11). Place and hardway bets are off on the
 * come-out roll. Odds pay true odds (no house edge).
 */
export type CrapsBet =
  | 'pass' | 'passOdds' | 'dontPass' | 'field'
  | 'place4' | 'place5' | 'place6' | 'place8' | 'place9' | 'place10'
  | 'hard4' | 'hard6' | 'hard8' | 'hard10'
  | 'any7' | 'anyCraps' | 'yo';

export const POINTS = [4, 5, 6, 8, 9, 10] as const;

/** Winnings per unit staked (to 1). */
const PLACE_PAYS: Record<number, number> = { 4: 9 / 5, 5: 7 / 5, 6: 7 / 6, 8: 7 / 6, 9: 7 / 5, 10: 9 / 5 };
const ODDS_PAYS: Record<number, number> = { 4: 2, 5: 3 / 2, 6: 6 / 5, 8: 6 / 5, 9: 3 / 2, 10: 2 };
const HARD_PAYS: Record<number, number> = { 4: 7, 6: 9, 8: 9, 10: 7 };

export const PAYS_TEXT: Record<CrapsBet, string> = {
  pass: '1 to 1', passOdds: 'true odds', dontPass: '1 to 1', field: '2x on 2, 3x on 12',
  place4: '9 to 5', place5: '7 to 5', place6: '7 to 6', place8: '7 to 6', place9: '7 to 5', place10: '9 to 5',
  hard4: '7 to 1', hard6: '9 to 1', hard8: '9 to 1', hard10: '7 to 1',
  any7: '4 to 1', anyCraps: '7 to 1', yo: '15 to 1',
};

export interface RollResult {
  /** Coins returned per bet (stake included) for bets that won or pushed this roll. */
  paid: Partial<Record<CrapsBet, number>>;
  /** Bets that lost this roll. */
  lost: CrapsBet[];
  /** Bets that are finished (won, lost or pushed) and come off the table. */
  resolved: CrapsBet[];
  point: number | null;
  /** What happened, in words ("Point is 6", "Seven out", "Winner 7!"). */
  call: string;
}

const win = (amount: number, pays: number) => amount + Math.floor(amount * pays);

/** Applies one roll to the bets on the table. `point` is null on a come-out roll. */
export function resolveRoll(point: number | null, bets: Partial<Record<CrapsBet, number>>, d1: number, d2: number): RollResult {
  const sum = d1 + d2;
  const hard = d1 === d2;
  const paid: RollResult['paid'] = {};
  const lost: CrapsBet[] = [];
  const resolved: CrapsBet[] = [];
  const has = (b: CrapsBet) => (bets[b] ?? 0) > 0;
  const pay = (b: CrapsBet, pays: number, stays = false) => {
    paid[b] = win(bets[b]!, pays);
    if (!stays) resolved.push(b);
  };
  const lose = (b: CrapsBet) => {
    lost.push(b);
    resolved.push(b);
  };
  let next = point;
  let call = '';

  // one-roll bets
  if (has('field')) [2, 3, 4, 9, 10, 11, 12].includes(sum) ? pay('field', sum === 2 ? 2 : sum === 12 ? 3 : 1) : lose('field');
  if (has('any7')) sum === 7 ? pay('any7', 4) : lose('any7');
  if (has('anyCraps')) [2, 3, 12].includes(sum) ? pay('anyCraps', 7) : lose('anyCraps');
  if (has('yo')) sum === 11 ? pay('yo', 15) : lose('yo');

  if (point === null) {
    // come-out roll
    if (sum === 7 || sum === 11) {
      if (has('pass')) pay('pass', 1);
      if (has('dontPass')) lose('dontPass');
      call = `Winner ${sum}!`;
    } else if (sum === 2 || sum === 3 || sum === 12) {
      if (has('pass')) lose('pass');
      if (has('dontPass')) {
        if (sum === 12) {
          paid.dontPass = bets.dontPass!;
          resolved.push('dontPass');
        } else pay('dontPass', 1);
      }
      call = `Craps ${sum}`;
    } else {
      next = sum;
      call = `Point is ${sum}`;
    }
  } else {
    if (sum === point) {
      if (has('pass')) pay('pass', 1);
      if (has('passOdds')) pay('passOdds', ODDS_PAYS[point]!);
      if (has('dontPass')) lose('dontPass');
      next = null;
      call = `Winner! ${sum} hits the point`;
    } else if (sum === 7) {
      if (has('pass')) lose('pass');
      if (has('passOdds')) lose('passOdds');
      if (has('dontPass')) pay('dontPass', 1);
      next = null;
      call = 'Seven out';
    } else call = `${sum}${hard ? ' the hard way' : ''}`;
    // place bets work while a point is on
    for (const n of POINTS) {
      const b = `place${n}` as CrapsBet;
      if (!has(b)) continue;
      if (sum === n) pay(b, PLACE_PAYS[n]!, true);
      else if (sum === 7) lose(b);
    }
    for (const n of [4, 6, 8, 10]) {
      const b = `hard${n}` as CrapsBet;
      if (!has(b)) continue;
      if (sum === n && hard) pay(b, HARD_PAYS[n]!, true);
      else if (sum === 7 || sum === n) lose(b);
    }
  }
  return { paid, lost, resolved, point: next, call };
}

/** Bets you can make right now. Odds need a point and a pass line bet; place and hardways stay but are off on the come-out. */
export function canBet(b: CrapsBet, point: number | null, bets: Partial<Record<CrapsBet, number>>): boolean {
  if (b === 'passOdds') return point !== null && (bets.pass ?? 0) > 0;
  if ((b === 'pass' || b === 'dontPass') && point !== null) return false;
  return true;
}
