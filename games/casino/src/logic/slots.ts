import { secureRandom, type Random } from './cards.ts';

/**
 * 5-reel, 3-row video slot with 20 paylines.
 * Wild substitutes for everything except the scatter. Three or more scatters
 * anywhere pay a multiple of the total bet and award free spins (which can retrigger).
 * Reel strips are tuned by simulation (see tests) to return roughly 96% over time.
 */
export const SYMBOLS = ['lemon', 'cherry', 'plum', 'bell', 'bar', 'seven', 'diamond', 'wild', 'scatter'] as const;
export type Sym = (typeof SYMBOLS)[number];

/** Pays per line bet for 3, 4, 5 in a row. */
export const PAYS: Record<Exclude<Sym, 'scatter'>, [number, number, number]> = {
  lemon: [6, 17, 55],
  cherry: [6, 17, 55],
  plum: [9, 23, 85],
  bell: [12, 35, 115],
  bar: [17, 58, 170],
  seven: [29, 115, 460],
  diamond: [58, 230, 1150],
  wild: [115, 575, 2900],
};
/** Scatter: multiple of the TOTAL bet, and free spins, for 3, 4, 5 anywhere. */
export const SCATTER_PAYS: [number, number, number] = [2, 10, 50];
export const FREE_SPINS: [number, number, number] = [8, 12, 20];
/** Every win during free spins is multiplied by this. */
export const FREE_SPIN_MULTIPLIER = 3;

export const LINES: number[][] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 2, 0, 2, 0], [2, 0, 2, 0, 2], [0, 0, 2, 0, 0],
];

/** How many of each symbol on each reel's strip. */
const WEIGHTS: Record<Sym, number[]> = {
  lemon: [7, 7, 7, 7, 7],
  cherry: [7, 7, 7, 7, 7],
  plum: [6, 6, 6, 6, 6],
  bell: [5, 5, 5, 5, 5],
  bar: [4, 4, 4, 4, 4],
  seven: [3, 3, 3, 3, 3],
  diamond: [2, 2, 2, 2, 2],
  wild: [1, 2, 2, 2, 1],
  scatter: [1, 1, 2, 1, 1],
};

function buildStrip(reel: number): Sym[] {
  const out: Sym[] = [];
  for (const s of SYMBOLS) for (let i = 0; i < WEIGHTS[s][reel]!; i++) out.push(s);
  // interleave deterministically so equal symbols are spread out along the strip
  const spread: Sym[] = [];
  const step = 7;
  const used = new Array(out.length).fill(false);
  let idx = 0;
  for (let k = 0; k < out.length; k++) {
    while (used[idx]) idx = (idx + 1) % out.length;
    used[idx] = true;
    spread.push(out[idx]!);
    idx = (idx + step) % out.length;
  }
  return spread;
}

export const STRIPS: Sym[][] = [0, 1, 2, 3, 4].map(buildStrip);

/** grid[reel][row] */
export type Grid = Sym[][];

export function gridFromStops(stops: number[]): Grid {
  return stops.map((stop, r) => {
    const strip = STRIPS[r]!;
    return [0, 1, 2].map((row) => strip[(stop + row) % strip.length]!);
  });
}

export function spinStops(rnd: Random = secureRandom): number[] {
  return STRIPS.map((s) => Math.floor(rnd() * s.length));
}

export interface LineWin {
  line: number;
  symbol: Exclude<Sym, 'scatter'>;
  count: number;
  /** Win in coins for this line. */
  win: number;
}

export interface SpinResult {
  grid: Grid;
  lineWins: LineWin[];
  scatters: number;
  scatterWin: number;
  freeSpins: number;
  total: number;
}

function lineWin(grid: Grid, line: number[], lineBet: number, idx: number): LineWin | null {
  const syms = line.map((row, reel) => grid[reel]![row]!);
  if (syms[0] === 'scatter') return null;
  // best of: treating leading wilds as wilds, or as the first real symbol
  let target: Sym = 'wild';
  for (const s of syms) {
    if (s === 'scatter') break;
    if (s !== 'wild') {
      target = s;
      break;
    }
  }
  const countFor = (t: Sym) => {
    let n = 0;
    for (const s of syms) {
      if (s === t || (s === 'wild' && t !== 'scatter')) n++;
      else break;
    }
    return n;
  };
  let wildRun = 0;
  for (const s of syms) {
    if (s === 'wild') wildRun++;
    else break;
  }
  const candidates: { symbol: Exclude<Sym, 'scatter'>; count: number }[] = [];
  if (target !== 'wild') candidates.push({ symbol: target, count: countFor(target) });
  if (wildRun >= 3) candidates.push({ symbol: 'wild', count: wildRun });
  let best: LineWin | null = null;
  for (const c of candidates) {
    if (c.count < 3) continue;
    const win = PAYS[c.symbol][c.count - 3]! * lineBet;
    if (!best || win > best.win) best = { line: idx, symbol: c.symbol, count: c.count, win };
  }
  return best;
}

/** Evaluate a grid for a bet of `lineBet` on each of the 20 lines. */
export function evaluate(grid: Grid, lineBet: number): SpinResult {
  const lineWins: LineWin[] = [];
  LINES.forEach((line, i) => {
    const w = lineWin(grid, line, lineBet, i);
    if (w) lineWins.push(w);
  });
  const scatters = grid.flat().filter((s) => s === 'scatter').length;
  const k = Math.min(scatters, 5);
  const scatterWin = k >= 3 ? SCATTER_PAYS[k - 3]! * lineBet * LINES.length : 0;
  const freeSpins = k >= 3 ? FREE_SPINS[k - 3]! : 0;
  const total = lineWins.reduce((s, w) => s + w.win, 0) + scatterWin;
  return { grid, lineWins, scatters, scatterWin, freeSpins, total };
}

export function spin(lineBet: number, rnd: Random = secureRandom): SpinResult {
  return evaluate(gridFromStops(spinStops(rnd)), lineBet);
}

/** Bet levels offered to the player (per line; total bet = x20). */
export const LINE_BETS = [1, 2, 5, 10, 25, 50, 100, 250, 500];
