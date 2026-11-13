import { newDeck, shuffle, secureRandom, type Card, type Random } from './cards.ts';
import { bestHand, type HandValue } from './poker.ts';

/**
 * No-limit Texas Hold'em table: blinds, four betting rounds, all-ins with
 * correct side pots, uncalled-bet refunds, split pots. Pure logic; the scene
 * drives it and asks `decide()` for the computer players' actions.
 */
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'done';

export interface Seat {
  name: string;
  stack: number;
  cards: Card[];
  /** Chips put in on the current street. */
  bet: number;
  /** Chips put in this hand. */
  totalIn: number;
  folded: boolean;
  allIn: boolean;
  human: boolean;
  /** Out of chips: skipped until they leave. */
  out: boolean;
  lastAction?: string;
}

export type Action = { type: 'fold' } | { type: 'check' } | { type: 'call' } | { type: 'raise'; to: number } | { type: 'allin' };

export interface PotResult {
  amount: number;
  winners: number[];
  hand?: string;
}

export class HoldemTable {
  seats: Seat[];
  board: Card[] = [];
  button = 0;
  street: Street = 'done';
  toAct = -1;
  currentBet = 0;
  minRaise = 0;
  results: PotResult[] = [];
  handNumber = 0;
  readonly sb: number;
  readonly bb: number;
  private deck: Card[] = [];
  private deckPreset = false;
  private acted = new Set<number>();
  private readonly rnd: Random;

  constructor(seats: Omit<Seat, 'cards' | 'bet' | 'totalIn' | 'folded' | 'allIn' | 'out'>[], sb: number, bb: number, rnd: Random = secureRandom) {
    this.seats = seats.map((s) => ({ ...s, cards: [], bet: 0, totalIn: 0, folded: false, allIn: false, out: s.stack <= 0 }));
    this.sb = sb;
    this.bb = bb;
    this.rnd = rnd;
    this.button = seats.length - 1;
  }

  get pot(): number {
    return this.seats.reduce((s, p) => s + p.totalIn, 0);
  }

  private live(i: number): boolean {
    const s = this.seats[i]!;
    return !s.out && !s.folded;
  }

  /** Next seat index after `from` matching `pred`. */
  private next(from: number, pred: (i: number) => boolean): number {
    const n = this.seats.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n;
      if (pred(i)) return i;
    }
    return -1;
  }

  /** Players still in chips. */
  get playersWithChips(): number {
    return this.seats.filter((s) => !s.out).length;
  }

  /** Test helper: preset the deck (first = next dealt). */
  presetDeck(cs: Card[]): void {
    this.deck = [...cs];
    this.deckPreset = true;
  }

  startHand(): boolean {
    for (const s of this.seats) if (s.stack <= 0) s.out = true;
    if (this.playersWithChips < 2) return false;
    this.handNumber++;
    this.board = [];
    this.results = [];
    for (const s of this.seats) Object.assign(s, { cards: [], bet: 0, totalIn: 0, folded: false, allIn: false, lastAction: undefined });
    if (!this.deckPreset) this.deck = shuffle(newDeck(), this.rnd);
    this.deckPreset = false;
    const active = (i: number) => !this.seats[i]!.out;
    this.button = this.next(this.button, active);
    const headsUp = this.playersWithChips === 2;
    const sbSeat = headsUp ? this.button : this.next(this.button, active);
    const bbSeat = this.next(sbSeat, active);
    this.post(sbSeat, this.sb, 'SB');
    this.post(bbSeat, this.bb, 'BB');
    // deal two cards each, starting left of the button
    for (let r = 0; r < 2; r++) {
      let i = this.button;
      for (let k = 0; k < this.playersWithChips; k++) {
        i = this.next(i, active);
        this.seats[i]!.cards.push(this.deck.shift()!);
      }
    }
    this.street = 'preflop';
    this.currentBet = this.bb;
    this.minRaise = this.bb;
    this.acted.clear();
    this.toAct = this.next(bbSeat, (i) => this.live(i) && !this.seats[i]!.allIn);
    this.checkRoundOver();
    return true;
  }

  private post(i: number, amount: number, label: string): void {
    const s = this.seats[i]!;
    const a = Math.min(amount, s.stack);
    s.stack -= a;
    s.bet += a;
    s.totalIn += a;
    if (s.stack === 0) s.allIn = true;
    s.lastAction = label;
  }

  /** What the seat to act may do right now. */
  legal(i = this.toAct): { canCheck: boolean; toCall: number; minRaiseTo: number; maxRaiseTo: number; canRaise: boolean } {
    const s = this.seats[i]!;
    const toCall = Math.min(this.currentBet - s.bet, s.stack);
    const maxRaiseTo = s.bet + s.stack;
    const minRaiseTo = Math.min(this.currentBet + this.minRaise, maxRaiseTo);
    return { canCheck: toCall === 0, toCall, minRaiseTo, maxRaiseTo, canRaise: maxRaiseTo > this.currentBet };
  }

  act(a: Action): void {
    if (this.street === 'done' || this.street === 'showdown' || this.toAct < 0) return;
    const i = this.toAct;
    const s = this.seats[i]!;
    const L = this.legal(i);
    const putTo = (to: number) => {
      const add = Math.min(to - s.bet, s.stack);
      s.stack -= add;
      s.bet += add;
      s.totalIn += add;
      if (s.stack === 0) s.allIn = true;
    };
    switch (a.type) {
      case 'fold':
        s.folded = true;
        s.lastAction = 'Fold';
        break;
      case 'check':
        if (!L.canCheck) return this.act({ type: 'call' });
        s.lastAction = 'Check';
        break;
      case 'call':
        putTo(s.bet + L.toCall);
        s.lastAction = s.allIn ? 'All in' : L.toCall === 0 ? 'Check' : 'Call';
        break;
      case 'allin':
      case 'raise': {
        const target = a.type === 'allin' ? L.maxRaiseTo : Math.max(L.minRaiseTo, Math.min(a.to, L.maxRaiseTo));
        if (target <= this.currentBet) return this.act({ type: 'call' });
        const raiseBy = target - this.currentBet;
        const wasBet = this.currentBet === 0;
        // a full raise reopens the betting; a short all-in does not change the minimum raise
        if (raiseBy >= this.minRaise) {
          this.minRaise = raiseBy;
          this.acted.clear();
        }
        this.currentBet = target;
        putTo(target);
        s.lastAction = s.allIn ? 'All in' : wasBet ? 'Bet' : 'Raise';
        break;
      }
    }
    this.acted.add(i);
    if (this.seats.filter((x, k) => this.live(k)).length === 1) return this.awardUncontested();
    this.toAct = this.next(i, (k) => this.live(k) && !this.seats[k]!.allIn);
    this.checkRoundOver();
  }

  private checkRoundOver(): void {
    const canAct = this.seats.map((_, k) => k).filter((k) => this.live(k) && !this.seats[k]!.allIn);
    const settled = canAct.every((k) => this.acted.has(k) && this.seats[k]!.bet === this.currentBet);
    // also over if nobody (or only one player facing no bet) can still act
    const onlyOneCanAct = canAct.length <= 1 && canAct.every((k) => this.seats[k]!.bet >= this.currentBet);
    if (settled || onlyOneCanAct || canAct.length === 0) this.endStreet();
  }

  private refundUncalled(): void {
    const live = this.seats.filter((_, k) => !this.seats[k]!.out);
    const bets = live.map((s) => s.bet).sort((a, b) => b - a);
    const top = bets[0] ?? 0;
    const second = bets[1] ?? 0;
    if (top > second) {
      const s = live.find((x) => x.bet === top)!;
      const back = top - second;
      s.stack += back;
      s.bet -= back;
      s.totalIn -= back;
      if (s.stack > 0) s.allIn = false;
    }
  }

  private endStreet(): void {
    this.refundUncalled();
    for (const s of this.seats) s.bet = 0;
    this.currentBet = 0;
    this.minRaise = this.bb;
    this.acted.clear();
    const order: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
    this.street = order[order.indexOf(this.street) + 1]!;
    if (this.street === 'flop') this.board.push(...this.deck.splice(0, 3));
    else if (this.street === 'turn' || this.street === 'river') this.board.push(this.deck.shift()!);
    if (this.street === 'showdown') return this.showdown();
    const canAct = this.seats.map((_, k) => k).filter((k) => this.live(k) && !this.seats[k]!.allIn);
    if (canAct.length <= 1) {
      // nobody left to bet against: run out the board
      this.toAct = -1;
      return this.endStreet();
    }
    this.toAct = this.next(this.button, (k) => this.live(k) && !this.seats[k]!.allIn);
  }

  private awardUncontested(): void {
    this.refundUncalled();
    const w = this.seats.findIndex((_, k) => this.live(k));
    const amount = this.pot;
    this.seats[w]!.stack += amount;
    this.results = [{ amount, winners: [w] }];
    for (const s of this.seats) {
      s.bet = 0;
      s.totalIn = 0;
    }
    this.street = 'done';
    this.toAct = -1;
  }

  private showdown(): void {
    const contenders = this.seats.map((_, k) => k).filter((k) => this.live(k));
    const values = new Map<number, HandValue>();
    for (const k of contenders) values.set(k, bestHand([...this.seats[k]!.cards, ...this.board]));
    const levels = [...new Set(contenders.map((k) => this.seats[k]!.totalIn))].sort((a, b) => a - b);
    let prev = 0;
    const results: PotResult[] = [];
    levels.forEach((level, li) => {
      let amount = 0;
      for (const s of this.seats) amount += Math.max(0, Math.min(s.totalIn, level) - prev);
      // anything above the top live level (folded overbets) goes into the last pot
      if (li === levels.length - 1) for (const s of this.seats) amount += Math.max(0, s.totalIn - level);
      const eligible = contenders.filter((k) => this.seats[k]!.totalIn >= level);
      const best = Math.max(...eligible.map((k) => values.get(k)!.score));
      const winners = eligible.filter((k) => values.get(k)!.score === best);
      // split evenly; odd chips go to the first winners left of the button
      const ordered = [...winners].sort(
        (a, b) => ((a - this.button + this.seats.length) % this.seats.length) - ((b - this.button + this.seats.length) % this.seats.length),
      );
      const share = Math.floor(amount / winners.length);
      let rem = amount - share * winners.length;
      for (const w of ordered) {
        this.seats[w]!.stack += share + (rem > 0 ? 1 : 0);
        if (rem > 0) rem--;
      }
      if (amount > 0) {
        const last = results[results.length - 1];
        if (last && last.winners.join() === winners.join()) last.amount += amount;
        else results.push({ amount, winners, hand: values.get(winners[0]!)!.name });
      }
      prev = level;
    });
    this.results = results;
    for (const s of this.seats) {
      s.bet = 0;
      s.totalIn = 0;
    }
    this.street = 'done';
    this.toAct = -1;
  }

  /** Best hand name for a seat at showdown (or so far). */
  handName(i: number): string {
    const s = this.seats[i]!;
    if (s.cards.length < 2 || this.board.length < 3) return '';
    return bestHand([...s.cards, ...this.board]).name;
  }
}

// ------------------------------------------------------------------ AI

/** Rough preflop strength 0..1 from the two hole cards. */
export function preflopStrength(cs: Card[]): number {
  const [a, b] = [...cs].sort((x, y) => y.rank - x.rank) as [Card, Card];
  let score = a.rank * 2 + b.rank; // high cards matter most
  if (a.rank === b.rank) score += 22 + a.rank; // pairs
  if (a.suit === b.suit) score += 4;
  const gap = a.rank - b.rank;
  if (gap === 1) score += 3;
  else if (gap === 2) score += 1;
  else if (gap >= 4) score -= gap - 3;
  return Math.max(0, Math.min(1, (score - 10) / 58));
}

/** Monte Carlo chance of winning against `opponents` random hands. */
export function equity(hole: Card[], board: Card[], opponents: number, sims = 160, rnd: Random = Math.random): number {
  const known = new Set([...hole, ...board].map((c) => `${c.rank}${c.suit}`));
  const rest = newDeck().filter((c) => !known.has(`${c.rank}${c.suit}`));
  let wins = 0;
  for (let s = 0; s < sims; s++) {
    const d = shuffle([...rest], rnd);
    const fullBoard = [...board, ...d.splice(0, 5 - board.length)];
    const me = bestHand([...hole, ...fullBoard]).score;
    let best = true;
    let tie = false;
    for (let o = 0; o < opponents; o++) {
      const v = bestHand([d.pop()!, d.pop()!, ...fullBoard]).score;
      if (v > me) best = false;
      else if (v === me) tie = true;
    }
    if (best) wins += tie ? 0.5 : 1;
  }
  return wins / sims;
}

export interface Personality {
  /** 0 = timid, 1 = maniac. */
  aggression: number;
  /** Chance to bluff when weak. */
  bluff: number;
}

/** A computer player's decision. Simple, readable, and beatable but not stupid. */
export function decide(t: HoldemTable, i: number, p: Personality, rnd: Random = Math.random): Action {
  const s = t.seats[i]!;
  const L = t.legal(i);
  const opponents = t.seats.filter((x, k) => k !== i && !x.out && !x.folded).length;
  const strength = t.board.length === 0 ? preflopStrength(s.cards) : equity(s.cards, t.board, opponents, 120, rnd);
  // what fraction of the final pot we'd be paying
  const potOdds = L.toCall / (t.pot + L.toCall || 1);
  // in multi-way pots, a hand needs to be stronger
  const needed = t.board.length === 0 ? 0.32 + opponents * 0.03 : 1 / (opponents + 1);
  const edge = strength - Math.max(potOdds, needed * 0.85);
  const r = rnd();

  const raiseTo = (fraction: number) => {
    const size = Math.max(L.minRaiseTo, t.currentBet + Math.round((t.pot * fraction) / t.bb) * t.bb);
    return Math.min(size, L.maxRaiseTo);
  };

  if (edge > 0.25 && L.canRaise && r < 0.5 + p.aggression * 0.4) {
    if (strength > 0.85 && r < 0.15) return { type: 'allin' };
    return { type: 'raise', to: raiseTo(0.6 + p.aggression * 0.6) };
  }
  if (edge > 0.05) {
    if (L.canRaise && r < p.aggression * 0.35) return { type: 'raise', to: raiseTo(0.5) };
    return L.canCheck ? { type: 'check' } : { type: 'call' };
  }
  if (L.canCheck) {
    if (L.canRaise && r < p.bluff) return { type: 'raise', to: raiseTo(0.5) };
    return { type: 'check' };
  }
  // facing a bet with a weak hand: mostly fold, sometimes float a cheap call or bluff-raise
  if (potOdds < 0.15 && r < 0.4) return { type: 'call' };
  if (L.canRaise && r < p.bluff * 0.5) return { type: 'raise', to: raiseTo(0.8) };
  return { type: 'fold' };
}
