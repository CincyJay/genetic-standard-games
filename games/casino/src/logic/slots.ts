import { secureRandom, type Random } from './cards.ts';

/**
 * Video slot engine: 5 reels x 3 rows, 20 paylines, left-to-right line wins.
 * Each machine defines its symbols, pays, reel weights and a bonus feature.
 * Wild ("W") substitutes for everything except the scatter ("S"). Three or
 * more scatters anywhere pay a multiple of the total bet and trigger the
 * machine's feature. Five wilds on a line wins the progressive jackpot share.
 * Pays are tuned by simulation (see tests) to return about 95%.
 */
export type Feature = 'freespins' | 'pick' | 'expanding' | 'wheel' | 'holdspin';

/** A lit lantern in Hold & Spin: worth a multiple of the total bet, or a named jackpot. */
export interface Lantern {
  mult: number;
  label?: 'MINI' | 'MINOR' | 'MAJOR';
}

export interface HoldSpinConfig {
  /** Lanterns (the machine's scatter symbol) needed on screen to start the feature. */
  trigger: number;
  /** Respins given at the start, and again each time a new lantern lands. */
  respins: number;
  /** Chance each empty cell lights a lantern on a respin. */
  landChance: number;
  values: { lantern: Lantern; weight: number }[];
  /** Filling every cell adds the Grand jackpot (multiple of total bet). */
  grand: number;
}

export interface Machine {
  id: string;
  name: string;
  /** Symbol ids low to high value; the last two are always the wild and the scatter. */
  symbols: string[];
  /** Pays per line bet for 3, 4, 5 in a row (wild included). */
  pays: Record<string, [number, number, number]>;
  /** Copies of each symbol on each of the 5 reel strips. */
  weights: Record<string, number[]>;
  scatterPays: [number, number, number];
  feature: Feature;
  /** Free spins awarded for 3/4/5 scatters (freespins and expanding machines). */
  freeSpins?: [number, number, number];
  freeSpinMultiplier?: number;
  /** Pick bonus: multiples of total bet hidden under the tiles; the player opens 3. */
  pickPrizes?: number[];
  /** Wheel bonus: multiples of total bet and their weights. */
  wheel?: { prizes: number[]; weights: number[] };
  /** Expanding wilds appear on these reels (0-based) and fill the whole reel. */
  expandReels?: number[];
  /** Line pays are multiplied by this (tuned so every machine returns about 95% with all features). */
  payScale?: number;
  /** Symbols placed on the strips in runs of this length (so several can show on one reel). */
  stacks?: Record<string, number>;
  /** Hold & Spin: lanterns lock in place while the rest respin. */
  holdSpin?: HoldSpinConfig;
  /** Line bets offered on this machine (high-limit machines go much higher). */
  lineBets?: number[];
  /** Free spins: the multiplier grows by this much after every free spin. */
  freeSpinRamp?: number;
  /** Every wild in a winning line multiplies it by this (capped at WILD_MULT_CAP). */
  wildMultiplier?: number;
  /** Pick bonus: how many tiles the player opens (default 3). */
  picks?: number;
  /** Return the pays are tuned to (default 95%). */
  targetRtp?: number;
  /** Non-scatter symbols are repeated this many times more on the strips (default STRIP_SCALE). */
  stripScale?: number;
  /** One-line description of the machine's feature for the cabinet and lobby. */
  blurb?: string;
}

export const STRIP_SCALE = 2;
/** Highest total multiplier wilds can put on one line. */
export const WILD_MULT_CAP = 8;
export const lineBetsOf = (m: Machine) => m.lineBets ?? LINE_BETS;
/** Free-spin multiplier for the `k`-th free spin of a feature (0-based). */
export const freeSpinMult = (m: Machine, k: number) => (m.freeSpinMultiplier ?? 1) + (m.freeSpinRamp ?? 0) * k;

/** Rows showing on each reel (a 5x5 video-slot grid). */
export const ROWS = 5;

/**
 * 50 paylines over the 5x5 grid: the five rows, then V, zigzag, step and
 * bump shapes started from every row where they fit.
 */
export const LINES: number[][] = (() => {
  const shapes = [
    [0, 1, 2, 1, 0], [0, -1, -2, -1, 0], [0, 1, 1, 1, 0], [0, -1, -1, -1, 0], [0, 1, 0, 1, 0], [0, -1, 0, -1, 0],
    [0, 0, 1, 0, 0], [0, 0, -1, 0, 0], [0, 1, 2, 3, 4], [0, -1, -2, -3, -4], [0, 0, 1, 2, 2], [0, 0, -1, -2, -2],
    [0, 1, 1, 1, 2], [0, -1, -1, -1, -2], [0, 2, 0, 2, 0], [0, -2, 0, -2, 0],
  ];
  const out: number[][] = [0, 1, 2, 3, 4].map((r) => [r, r, r, r, r]);
  const seen = new Set(out.map((l) => l.join()));
  for (const sh of shapes)
    for (const start of [2, 1, 3, 0, 4]) {
      const line = sh.map((d) => start + d);
      if (line.some((r) => r < 0 || r >= ROWS) || seen.has(line.join()) || out.length >= 50) continue;
      seen.add(line.join());
      out.push(line);
    }
  return out;
})();

/** How many lines the player can choose to play (pay by line: total bet = lines x bet per line). */
export const LINE_CHOICES = [1, 5, 10, 25, 50];
/** Bets per line offered on the regular machines. */
export const LINE_BETS = [1, 2, 4, 10, 20, 40, 100, 200];
/** The biggest total bet on a regular machine (all lines at the top line bet). */
export const MAX_TOTAL_BET = LINE_BETS[LINE_BETS.length - 1]! * LINES.length;

// ------------------------------------------------------------------ machines
export const LUCKY_SEVENS: Machine = {
  id: 'sevens',
  payScale: 0.575,
  name: 'Lucky Sevens',
  symbols: ['lemon', 'cherry', 'plum', 'bell', 'bar', 'seven', 'diamond', 'wild', 'scatter'],
  pays: {
    lemon: [6, 17, 55], cherry: [6, 17, 55], plum: [9, 23, 85], bell: [12, 35, 115], bar: [17, 58, 170],
    seven: [29, 115, 460], diamond: [58, 230, 1150], wild: [115, 575, 2900],
  },
  weights: {
    lemon: [7, 7, 7, 7, 7], cherry: [7, 7, 7, 7, 7], plum: [6, 6, 6, 6, 6], bell: [5, 5, 5, 5, 5], bar: [4, 4, 4, 4, 4],
    seven: [3, 3, 3, 3, 3], diamond: [2, 2, 2, 2, 2], wild: [1, 2, 2, 2, 1], scatter: [1, 1, 2, 1, 1],
  },
  scatterPays: [2, 10, 50],
  feature: 'freespins',
  freeSpins: [8, 12, 20],
  freeSpinMultiplier: 3,
};

export const PHARAOH: Machine = {
  id: 'pharaoh',
  payScale: 0.525,
  name: "Pharaoh's Gold",
  symbols: ['ankh', 'eye', 'scarab', 'cat', 'pyramid', 'mask', 'gem', 'wild', 'scatter'],
  pays: {
    ankh: [6, 16, 50], eye: [6, 16, 50], scarab: [8, 22, 80], cat: [11, 32, 110], pyramid: [16, 55, 160],
    mask: [27, 110, 440], gem: [55, 220, 1100], wild: [110, 550, 2750],
  },
  weights: {
    ankh: [7, 7, 7, 7, 7], eye: [7, 7, 7, 7, 7], scarab: [6, 6, 6, 6, 6], cat: [5, 5, 5, 5, 5], pyramid: [4, 4, 4, 4, 4],
    mask: [3, 3, 3, 3, 3], gem: [2, 2, 2, 2, 2], wild: [1, 2, 2, 2, 1], scatter: [1, 1, 2, 1, 1],
  },
  scatterPays: [2, 10, 50],
  feature: 'pick',
  pickPrizes: [2, 3, 4, 5, 6, 8, 10, 15, 25],
};

export const DEEP_BLUE: Machine = {
  id: 'ocean',
  payScale: 0.605,
  name: 'Deep Blue',
  symbols: ['shell', 'starfish', 'fish', 'turtle', 'octopus', 'shark', 'pearl', 'wild', 'scatter'],
  pays: {
    shell: [6, 17, 55], starfish: [6, 17, 55], fish: [9, 23, 86], turtle: [12, 34, 117], octopus: [17, 59, 172],
    shark: [30, 117, 467], pearl: [59, 234, 1170], wild: [117, 590, 2950],
  },
  weights: {
    shell: [7, 7, 7, 7, 7], starfish: [7, 7, 7, 7, 7], fish: [6, 6, 6, 6, 6], turtle: [5, 5, 5, 5, 5], octopus: [4, 4, 4, 4, 4],
    shark: [3, 3, 3, 3, 3], pearl: [2, 2, 2, 2, 2], wild: [0, 1, 1, 1, 0], scatter: [1, 1, 2, 1, 1],
  },
  scatterPays: [2, 10, 50],
  feature: 'expanding',
  expandReels: [1, 2, 3],
  freeSpins: [6, 10, 15],
  freeSpinMultiplier: 1,
};

export const GOLD_RUSH: Machine = {
  id: 'goldrush',
  payScale: 0.512,
  name: 'Gold Rush',
  symbols: ['pick', 'lantern', 'pan', 'cart', 'dynamite', 'nugget', 'bar', 'wild', 'scatter'],
  pays: {
    pick: [6, 16, 52], lantern: [6, 16, 52], pan: [8, 22, 80], cart: [11, 33, 110], dynamite: [16, 55, 160],
    nugget: [27, 110, 440], bar: [55, 220, 1100], wild: [110, 550, 2750],
  },
  weights: {
    pick: [7, 7, 7, 7, 7], lantern: [7, 7, 7, 7, 7], pan: [6, 6, 6, 6, 6], cart: [5, 5, 5, 5, 5], dynamite: [4, 4, 4, 4, 4],
    nugget: [3, 3, 3, 3, 3], bar: [2, 2, 2, 2, 2], wild: [1, 2, 2, 2, 1], scatter: [1, 1, 2, 1, 1],
  },
  scatterPays: [2, 10, 50],
  feature: 'wheel',
  wheel: { prizes: [10, 12, 16, 20, 30, 45, 80, 200], weights: [20, 18, 16, 14, 12, 9, 6, 2] },
};

export const LUCKY_LANTERNS: Machine = {
  id: 'lanterns',
  payScale: 0.45,
  name: 'Lucky Lanterns',
  symbols: ['ten', 'jack', 'queen', 'king', 'ace', 'koi', 'coin', 'ingot', 'wild', 'scatter'],
  pays: {
    ten: [8, 18, 60], jack: [8, 18, 60], queen: [9, 23, 75], king: [12, 30, 105], ace: [15, 38, 135],
    koi: [23, 75, 225], coin: [38, 135, 525], ingot: [75, 270, 1350], wild: [150, 675, 3300],
  },
  weights: {
    ten: [6, 6, 6, 6, 6], jack: [6, 6, 6, 6, 6], queen: [6, 6, 6, 6, 6], king: [5, 5, 5, 5, 5], ace: [5, 5, 5, 5, 5],
    koi: [4, 4, 4, 4, 4], coin: [3, 3, 3, 3, 3], ingot: [2, 2, 2, 2, 2], wild: [1, 2, 2, 2, 1], scatter: [3, 3, 3, 3, 3],
  },
  scatterPays: [0, 0, 0],
  stacks: { scatter: 3 },
  feature: 'holdspin',
  holdSpin: {
    trigger: 7,
    respins: 3,
    landChance: 0.05,
    values: [
      { lantern: { mult: 0.75 }, weight: 30 },
      { lantern: { mult: 1.5 }, weight: 26 },
      { lantern: { mult: 2 }, weight: 18 },
      { lantern: { mult: 3.5 }, weight: 10 },
      { lantern: { mult: 6 }, weight: 6 },
      { lantern: { mult: 15, label: 'MINI' }, weight: 2.4 },
      { lantern: { mult: 40, label: 'MINOR' }, weight: 0.8 },
      { lantern: { mult: 150, label: 'MAJOR' }, weight: 0.12 },
    ],
    grand: 1000,
  },
};

// ------------------------------------------------------------------ high-limit machines
// Bigger bets, richer features and a higher return (about 96.5%). They unlock as you level up.
const ROYAL_PAYS = { ten: [5, 15, 50], jack: [5, 15, 50], queen: [6, 18, 60], king: [8, 22, 80], ace: [10, 28, 100] } as const;
const ROYAL_WEIGHTS = { ten: [7, 7, 7, 7, 7], jack: [7, 7, 7, 7, 7], queen: [6, 6, 6, 6, 6], king: [6, 6, 6, 6, 6], ace: [5, 5, 5, 5, 5] };
const royals = (p1: string, p2: string, p3: string): Pick<Machine, 'symbols' | 'pays' | 'weights'> => ({
  symbols: ['ten', 'jack', 'queen', 'king', 'ace', p1, p2, p3, 'wild', 'scatter'],
  pays: {
    ...Object.fromEntries(Object.entries(ROYAL_PAYS).map(([k, v]) => [k, [...v] as [number, number, number]])),
    [p1]: [16, 55, 180], [p2]: [25, 100, 400], [p3]: [50, 200, 1000], wild: [100, 500, 2500],
  },
  weights: { ...ROYAL_WEIGHTS, [p1]: [4, 4, 4, 4, 4], [p2]: [3, 3, 3, 3, 3], [p3]: [2, 2, 2, 2, 2], wild: [1, 2, 2, 2, 1], scatter: [1, 1, 2, 1, 1] },
});
const HIGH_RTP = 0.965;

export const DRAGONS_HOARD: Machine = {
  id: 'dragon',
  name: "Dragon's Hoard",
  ...royals('chalice', 'crown', 'chest'),
  payScale: 0.457,
  targetRtp: HIGH_RTP,
  scatterPays: [0, 0, 0],
  stacks: { scatter: 3 },
  feature: 'holdspin',
  blurb: '7+ dragon eggs start Hold & Spin · Grand 2,000×',
  lineBets: [10, 20, 40, 100, 200, 400, 1000],
  holdSpin: {
    trigger: 7,
    respins: 3,
    landChance: 0.05,
    values: [
      { lantern: { mult: 1 }, weight: 30 },
      { lantern: { mult: 2 }, weight: 26 },
      { lantern: { mult: 3 }, weight: 18 },
      { lantern: { mult: 5 }, weight: 10 },
      { lantern: { mult: 8 }, weight: 6 },
      { lantern: { mult: 20, label: 'MINI' }, weight: 2.4 },
      { lantern: { mult: 60, label: 'MINOR' }, weight: 0.8 },
      { lantern: { mult: 250, label: 'MAJOR' }, weight: 0.12 },
    ],
    grand: 2000,
  },
};
DRAGONS_HOARD.weights.scatter = [3, 3, 3, 3, 3];

export const DIAMOND_EMPIRE: Machine = {
  id: 'empire',
  name: 'Diamond Empire',
  ...royals('ring', 'goldbars', 'diamond'),
  payScale: 0.829,
  targetRtp: HIGH_RTP,
  scatterPays: [2, 10, 50],
  feature: 'freespins',
  freeSpins: [10, 15, 25],
  freeSpinMultiplier: 2,
  freeSpinRamp: 1,
  blurb: 'Free spins: multiplier climbs ×2, ×3, ×4… every spin',
  lineBets: [20, 40, 100, 200, 400, 1000, 2000],
};

export const THUNDER_PEAK: Machine = {
  id: 'thunder',
  name: 'Thunder Peak',
  ...royals('horn', 'hammer', 'bolt'),
  payScale: 0.334,
  targetRtp: HIGH_RTP,
  scatterPays: [2, 10, 50],
  feature: 'freespins',
  freeSpins: [8, 12, 20],
  freeSpinMultiplier: 2,
  wildMultiplier: 2,
  blurb: 'Every wild doubles the line (up to ×8) · free spins pay ×2',
  lineBets: [40, 100, 200, 400, 1000, 2000, 4000],
};

THUNDER_PEAK.weights.wild = [0, 1, 2, 1, 0];

export const TIGERS_TREASURE: Machine = {
  id: 'tiger',
  name: "Tiger's Treasure",
  ...royals('emerald', 'idol', 'tiger'),
  payScale: 0.452,
  targetRtp: HIGH_RTP,
  scatterPays: [2, 10, 50],
  feature: 'pick',
  picks: 4,
  pickPrizes: [3, 5, 6, 8, 10, 15, 25, 40, 100],
  blurb: 'Temple pick bonus: open 4 of 9 for up to 100×',
  lineBets: [100, 200, 400, 1000, 2000, 4000, 10000],
};

export const COSMIC_FORTUNE: Machine = {
  id: 'cosmic',
  name: 'Cosmic Fortune',
  ...royals('rocket', 'planet', 'star'),
  payScale: 0.741,
  targetRtp: HIGH_RTP,
  scatterPays: [2, 10, 50],
  feature: 'wheel',
  wheel: { prizes: [15, 20, 25, 40, 60, 100, 200, 500, 1000], weights: [24, 20, 16, 12, 9, 6, 3, 1, 0.3] },
  blurb: 'Galaxy wheel bonus: up to 1,000×',
  lineBets: [200, 400, 1000, 2000, 4000, 10000, 20000],
};

export const HIGH_LIMIT = [DRAGONS_HOARD, DIAMOND_EMPIRE, THUNDER_PEAK, TIGERS_TREASURE, COSMIC_FORTUNE];
export const MACHINES = [LUCKY_SEVENS, LUCKY_LANTERNS, PHARAOH, DEEP_BLUE, GOLD_RUSH, ...HIGH_LIMIT];

// ------------------------------------------------------------------ strips
const stripCache = new Map<string, string[][]>();

/** Reel strips: each symbol repeated by weight, spread out along the strip. */
export function strips(m: Machine): string[][] {
  const cached = stripCache.get(m.id);
  if (cached) return cached;
  const out = [0, 1, 2, 3, 4].map((reel) => {
    const flat: string[] = [];
    const stacked = m.stacks ?? {};
    // with five rows showing, the strips are longer (scatters rarer per cell) so features land about as often as before
    const scale = (sym: string) => (sym === 'scatter' ? 1 : (m.stripScale ?? STRIP_SCALE));
    for (const s of m.symbols) if (!stacked[s]) for (let i = 0; i < (m.weights[s]?.[reel] ?? 0) * scale(s); i++) flat.push(s);
    const spread: string[] = [];
    const used = new Array(flat.length).fill(false);
    let idx = 0;
    for (let k = 0; k < flat.length; k++) {
      while (used[idx]) idx = (idx + 1) % flat.length;
      used[idx] = true;
      spread.push(flat[idx]!);
      idx = (idx + 7) % flat.length;
    }
    // stacked symbols go in as runs, spaced evenly along the strip
    for (const [sym, len] of Object.entries(stacked)) {
      const runs = Math.round((m.weights[sym]?.[reel] ?? 0) / len);
      for (let k = 0; k < runs; k++) {
        const at = Math.floor(((k + 0.5) * spread.length) / runs) + k * len;
        spread.splice(Math.min(at, spread.length), 0, ...new Array(len).fill(sym));
      }
    }
    return spread;
  });
  stripCache.set(m.id, out);
  return out;
}

/** grid[reel][row] */
export type Grid = string[][];

export function gridFromStops(m: Machine, stops: number[]): Grid {
  const st = strips(m);
  return stops.map((stop, r) => {
    const strip = st[r]!;
    return Array.from({ length: ROWS }, (_, row) => strip[(stop + row) % strip.length]!);
  });
}

export function spinStops(m: Machine, rnd: Random = secureRandom): number[] {
  return strips(m).map((s) => Math.floor(rnd() * s.length));
}

// ------------------------------------------------------------------ evaluation
export interface LineWin {
  line: number;
  symbol: string;
  count: number;
  win: number;
}

export interface SpinResult {
  /** The grid as landed. */
  grid: Grid;
  /** The grid after features (expanding wilds), used for line wins. */
  final: Grid;
  /** Reels whose wild expanded. */
  expanded: number[];
  /** Reels turned fully wild by the Wild Reels feature. */
  wildReels: number[];
  /** The Lucky Wheel side game was awarded. */
  luckyWheel: boolean;
  lineWins: LineWin[];
  scatters: number;
  scatterWin: number;
  /** Feature awarded: free spins count, or a bonus game to play. */
  freeSpins: number;
  bonus: 'pick' | 'wheel' | 'holdspin' | null;
  /** Lanterns (scatter symbols) on screen, uncapped. */
  coins: number;
  /** Five wilds on a line: wins the progressive jackpot (scaled by bet). */
  jackpot: boolean;
  total: number;
}

function lineWin(m: Machine, grid: Grid, line: number[], lineBet: number, idx: number): LineWin | null {
  const syms = line.map((row, reel) => grid[reel]![row]!);
  if (syms[0] === 'scatter') return null;
  let target = 'wild';
  for (const s of syms) {
    if (s === 'scatter') break;
    if (s !== 'wild') {
      target = s;
      break;
    }
  }
  const run = (t: string) => {
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
  const options: { symbol: string; count: number }[] = [];
  if (target !== 'wild') options.push({ symbol: target, count: run(target) });
  if (wildRun >= 3) options.push({ symbol: 'wild', count: wildRun });
  let best: LineWin | null = null;
  for (const o of options) {
    if (o.count < 3) continue;
    let mult = 1;
    if (m.wildMultiplier && o.symbol !== 'wild') {
      const wilds = syms.slice(0, o.count).filter((x) => x === 'wild').length;
      mult = Math.min(WILD_MULT_CAP, m.wildMultiplier ** wilds);
    }
    const win = Math.round(m.pays[o.symbol]![o.count - 3]! * (m.payScale ?? 1) * lineBet * mult);
    if (!best || win > best.win) best = { line: idx, symbol: o.symbol, count: o.count, win };
  }
  return best;
}

/** Line wins on the first `lines` paylines (pay by line); scatters pay on the total bet. */
export function evaluate(m: Machine, grid: Grid, lineBet: number, wildReels: number[] = [], lines = LINES.length): SpinResult {
  // expanding wilds: a wild on an expanding reel fills that reel; Wild Reels turn whole reels wild
  const expanded: number[] = [];
  const final = grid.map((col, reel) => {
    if (wildReels.includes(reel)) return new Array(ROWS).fill('wild');
    if (m.expandReels?.includes(reel) && col.includes('wild')) {
      expanded.push(reel);
      return new Array(ROWS).fill('wild');
    }
    return [...col];
  });
  const lineWins: LineWin[] = [];
  LINES.slice(0, lines).forEach((line, i) => {
    const w = lineWin(m, final, line, lineBet, i);
    if (w) lineWins.push(w);
  });
  const jackpot = lineWins.some((w) => w.symbol === 'wild' && w.count === 5) && expanded.length === 0 && wildReels.length === 0;
  const coins = grid.flat().filter((s) => s === 'scatter').length;
  const scatters = Math.min(5, coins);
  const k = scatters >= 3 ? scatters - 3 : -1;
  const scatterWin = k >= 0 ? m.scatterPays[k]! * lineBet * lines : 0;
  const freeSpins = k >= 0 && m.freeSpins ? m.freeSpins[k]! : 0;
  let bonus: SpinResult['bonus'] = k >= 0 && (m.feature === 'pick' || m.feature === 'wheel') ? m.feature : null;
  if (m.holdSpin && coins >= m.holdSpin.trigger) bonus = 'holdspin';
  const total = lineWins.reduce((s, w) => s + w.win, 0) + scatterWin;
  return { grid, final, expanded, wildReels, lineWins, scatters, scatterWin, freeSpins, bonus, luckyWheel: false, coins, jackpot, total };
}

// ------------------------------------------------------------------ extras on every machine
/** Chance per paid spin that 2 or 3 of the middle reels turn fully wild (a guaranteed big hit). */
export const WILD_REELS_CHANCE = 1 / 75;
/** Chance per paid spin of the Lucky Wheel side game. */
export const LUCKY_WHEEL_CHANCE = 1 / 140;
/** Lucky Wheel wedges: multiples of the total bet. */
export const LUCKY_WHEEL = { prizes: [5, 8, 10, 15, 20, 30, 50, 100, 250], weights: [22, 20, 18, 14, 10, 7, 5, 3, 1] };

export function luckyWheelEV(): number {
  const tw = LUCKY_WHEEL.weights.reduce((a, b) => a + b, 0);
  return LUCKY_WHEEL.prizes.reduce((s, p, i) => s + (p * LUCKY_WHEEL.weights[i]!) / tw, 0);
}

export function spinLuckyWheel(rnd: Random = secureRandom): number {
  const w = LUCKY_WHEEL.weights;
  let r = rnd() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    r -= w[i]!;
    if (r <= 0) return i;
  }
  return w.length - 1;
}

/** Which reels turn wild this spin (usually none). */
export function rollWildReels(rnd: Random = secureRandom): number[] {
  if (rnd() >= WILD_REELS_CHANCE) return [];
  const r = rnd();
  const n = r < 0.7 ? 2 : 3;
  const pool = [1, 2, 3];
  const out: number[] = [];
  while (out.length < n) {
    const k = pool.splice(Math.floor(rnd() * pool.length), 1)[0]!;
    out.push(k);
  }
  return out.sort();
}

/** A paid spin (with the random extras) or a free spin (`extras` false). */
export function spin(m: Machine, lineBet: number, rnd: Random = secureRandom, extras = false): SpinResult {
  const grid = gridFromStops(m, spinStops(m, rnd));
  if (!extras) return evaluate(m, grid, lineBet);
  const res = evaluate(m, grid, lineBet, rollWildReels(rnd));
  res.luckyWheel = rnd() < LUCKY_WHEEL_CHANCE;
  return res;
}

// ------------------------------------------------------------------ bonus games
/** Shuffled pick-bonus tiles (multiples of total bet). */
export function pickBoard(m: Machine, rnd: Random = secureRandom): number[] {
  const tiles = [...(m.pickPrizes ?? [])];
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
  }
  return tiles;
}

/** Index of the wheel wedge won. */
export function spinBonusWheel(m: Machine, rnd: Random = secureRandom): number {
  const w = m.wheel!.weights;
  const total = w.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < w.length; i++) {
    r -= w[i]!;
    if (r <= 0) return i;
  }
  return w.length - 1;
}

// ------------------------------------------------------------------ hold & spin
/** Cells are indexed reel * ROWS + row. */
export type LanternBoard = (Lantern | null)[];

export function lanternValue(m: Machine, rnd: Random = secureRandom): Lantern {
  const v = m.holdSpin!.values;
  const total = v.reduce((a, b) => a + b.weight, 0);
  let r = rnd() * total;
  for (const x of v) {
    r -= x.weight;
    if (r <= 0) return { ...x.lantern };
  }
  return { ...v[0]!.lantern };
}

/** Lights every lantern that triggered the feature. */
export function holdSpinStart(m: Machine, grid: Grid, rnd: Random = secureRandom): LanternBoard {
  const board: LanternBoard = [];
  grid.forEach((col) => col.forEach((s) => board.push(s === 'scatter' ? lanternValue(m, rnd) : null)));
  return board;
}

/** One respin: each empty cell may light a lantern. Returns the cells that landed. */
export function holdSpinRespin(m: Machine, board: LanternBoard, rnd: Random = secureRandom): number[] {
  const landed: number[] = [];
  board.forEach((c, i) => {
    if (c) return;
    if (rnd() < m.holdSpin!.landChance) {
      board[i] = lanternValue(m, rnd);
      landed.push(i);
    }
  });
  return landed;
}

/** Feature total in multiples of the total bet (Grand included when the board is full). */
export function holdSpinTotal(m: Machine, board: LanternBoard): { mult: number; grand: boolean } {
  const grand = board.every((c) => c !== null);
  const mult = board.reduce((s, c) => s + (c?.mult ?? 0), 0) + (grand ? m.holdSpin!.grand : 0);
  return { mult, grand };
}

/** Plays a whole Hold & Spin feature (used by the simulation; the scene plays it step by step). */
export function playHoldSpin(m: Machine, grid: Grid, rnd: Random = secureRandom): { mult: number; grand: boolean; board: LanternBoard } {
  const board = holdSpinStart(m, grid, rnd);
  let left = m.holdSpin!.respins;
  while (left > 0 && board.some((c) => c === null)) {
    left--;
    if (holdSpinRespin(m, board, rnd).length) left = m.holdSpin!.respins;
  }
  return { ...holdSpinTotal(m, board), board };
}

/** Expected value of a bonus game, in multiples of total bet. */
export function bonusEV(m: Machine): number {
  if (m.feature === 'pick') {
    const p = m.pickPrizes!;
    return ((m.picks ?? 3) * p.reduce((a, b) => a + b, 0)) / p.length;
  }
  if (m.feature === 'wheel') {
    const { prizes, weights } = m.wheel!;
    const tw = weights.reduce((a, b) => a + b, 0);
    return prizes.reduce((s, p, i) => s + (p * weights[i]!) / tw, 0);
  }
  return 0;
}

/**
 * Long-run return (won / wagered) by simulation, counting features: free spins
 * are played out, bonus games are valued at their expected value. Jackpots are
 * excluded (they're funded separately from a share of every bet).
 */
export function simulateRtp(m: Machine, spins: number, rnd: Random): { rtp: number; hitRate: number; featureEvery: number } {
  let bet = 0;
  let won = 0;
  let hits = 0;
  let features = 0;
  // high-limit machines are simulated at their smallest real line bet (no rounding drift)
  const lb = 10;
  const total = LINES.length * lb;
  for (let i = 0; i < spins; i++) {
    bet += total;
    const r = spin(m, lb, rnd, true);
    won += r.total;
    if (r.total > 0) hits++;
    if (r.luckyWheel) won += luckyWheelEV() * total;
    if (r.bonus === 'holdspin') {
      features++;
      won += playHoldSpin(m, r.grid, rnd).mult * total;
    } else if (r.bonus) {
      features++;
      won += bonusEV(m) * total;
    }
    let fs = r.freeSpins;
    if (fs) features++;
    let k = 0;
    while (fs > 0) {
      fs--;
      const f = spin(m, lb, rnd);
      won += f.total * freeSpinMult(m, k++);
      fs += f.freeSpins;
    }
  }
  return { rtp: won / bet, hitRate: hits / spins, featureEvery: Math.round(spins / Math.max(1, features)) };
}
