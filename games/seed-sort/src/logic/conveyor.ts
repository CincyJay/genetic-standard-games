import { createRng, randInt, shuffle, type Rng } from '@tgs/kit/rng';

/**
 * Conveyor Sort rules. Pure logic, no rendering: shared by the game and tests.
 *
 * Seeds ride a belt left to right over a row of crates. Tapping an item drops
 * it straight down into the crate beneath it. Right crate: points and streak.
 * Wrong crate, or a seed that rolls off the end: lose a life. Golden seeds are
 * bonus points anywhere, weeds can be plucked for a bonus, and rocks must be
 * left alone (tapping one costs a life).
 */
export const SEED_TYPES = [
  'redbean',
  'corn',
  'pea',
  'sunflower',
  'lentil',
  'blackbean',
  'pumpkin',
  'runner',
  'pinto',
  'acorn',
  'cranberry',
  'bluecorn',
] as const;
export type SeedType = (typeof SEED_TYPES)[number];
export type Special = 'golden' | 'rock' | 'weed';
export type ItemKind = SeedType | Special;

export const SEED_NAMES: Record<SeedType, string> = {
  redbean: 'Red Bean',
  corn: 'Corn',
  pea: 'Pea',
  sunflower: 'Sunflower',
  lentil: 'Lentil',
  blackbean: 'Black Bean',
  pumpkin: 'Pumpkin',
  runner: 'Runner Bean',
  pinto: 'Pinto',
  acorn: 'Acorn',
  cranberry: 'Cranberry Bean',
  bluecorn: 'Blue Corn',
};

export function isSeed(kind: ItemKind): kind is SeedType {
  return (SEED_TYPES as readonly string[]).includes(kind);
}

export interface LevelConfig {
  level: number;
  /** Seed type for each crate, left to right. */
  bins: SeedType[];
  /** Seeds to sort to clear the level. */
  target: number;
  /** Belt speed in px/s at the start; rises up to 25% as the level progresses. */
  speed: number;
  /** Average gap between items, in ms. */
  spawnEvery: number;
  lives: number;
  goldenChance: number;
  rockChance: number;
  weedChance: number;
  /** Crates swap places this often (ms); 0 = never. */
  shuffleEvery: number;
}

export function configForLevel(level: number): LevelConfig {
  const rng = createRng(0xbe17 + level * 7919);
  const binCount = level <= 3 ? 3 : level <= 12 ? 4 : 5;
  const unlocked = SEED_TYPES.slice(0, Math.min(SEED_TYPES.length, 3 + Math.floor(level / 2)));
  const bins = level <= 2 ? [...SEED_TYPES.slice(0, 3)] : shuffle(rng, [...unlocked]).slice(0, binCount);
  return {
    level,
    bins,
    target: Math.min(10 + level * 2, 60),
    speed: level === 1 ? 140 : Math.min(160 + level * 9, 480),
    spawnEvery: level === 1 ? 1900 : Math.max(1600 - level * 35, 650),
    lives: 3,
    goldenChance: level >= 2 ? 0.05 : 0,
    rockChance: level >= 4 ? Math.min(0.05 + level * 0.004, 0.15) : 0,
    weedChance: level >= 6 ? 0.06 : 0,
    shuffleEvery: level >= 10 ? Math.max(14000 - level * 150, 7000) : 0,
  };
}

export interface Spawn {
  kind: ItemKind;
  /** Wait this long after the previous item. */
  delay: number;
}

/** Deterministic stream of items for a level (same level = same sequence). */
export function createSpawner(cfg: LevelConfig, seed = cfg.level): () => Spawn {
  const rng: Rng = createRng(0x5eed5 + seed * 104729);
  let lastSeed: SeedType | null = null;
  return () => {
    const delay = Math.round(cfg.spawnEvery * (0.75 + rng() * 0.5));
    const r = rng();
    if (r < cfg.goldenChance) return { kind: 'golden', delay };
    if (r < cfg.goldenChance + cfg.rockChance) return { kind: 'rock', delay };
    if (r < cfg.goldenChance + cfg.rockChance + cfg.weedChance) return { kind: 'weed', delay };
    // avoid long runs of the same seed
    let kind = cfg.bins[randInt(rng, 0, cfg.bins.length - 1)]!;
    if (kind === lastSeed && rng() < 0.6) kind = cfg.bins[randInt(rng, 0, cfg.bins.length - 1)]!;
    lastSeed = kind;
    return { kind, delay };
  };
}

/** Which crate is under horizontal position x, for crates evenly filling [left, right]. */
export function binAt(x: number, binCount: number, left: number, right: number): number {
  const i = Math.floor(((x - left) / (right - left)) * binCount);
  return Math.max(0, Math.min(binCount - 1, i));
}

export type Outcome =
  | { kind: 'sorted'; points: number; streak: number; multiplier: number }
  | { kind: 'golden'; points: number; streak: number; multiplier: number }
  | { kind: 'plucked'; points: number }
  | { kind: 'wrong' }
  | { kind: 'rock' }
  | { kind: 'missed' }
  | { kind: 'passed' };

export interface RunState {
  score: number;
  streak: number;
  bestStreak: number;
  sorted: number;
  lives: number;
  livesLost: number;
}

export function newRun(cfg: LevelConfig): RunState {
  return { score: 0, streak: 0, bestStreak: 0, sorted: 0, lives: cfg.lives, livesLost: 0 };
}

/** Streak multiplier: x1, then +1 for every 5 in a row, up to x5. */
export function multiplierFor(streak: number): number {
  return Math.min(5, 1 + Math.floor(streak / 5));
}

function loseLife(s: RunState): void {
  s.lives = Math.max(0, s.lives - 1);
  s.livesLost++;
  s.streak = 0;
}

/** The player tapped an item while it was over crate `bin`. Updates the run and returns what happened. */
export function tapItem(s: RunState, cfg: LevelConfig, kind: ItemKind, bin: number): Outcome {
  if (kind === 'rock') {
    loseLife(s);
    return { kind: 'rock' };
  }
  if (kind === 'weed') {
    s.score += 15;
    return { kind: 'plucked', points: 15 };
  }
  if (kind === 'golden') {
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    const multiplier = multiplierFor(s.streak);
    const points = 50 * multiplier;
    s.score += points;
    return { kind: 'golden', points, streak: s.streak, multiplier };
  }
  if (cfg.bins[bin] !== kind) {
    loseLife(s);
    return { kind: 'wrong' };
  }
  s.sorted++;
  s.streak++;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  const multiplier = multiplierFor(s.streak);
  const points = 10 * multiplier;
  s.score += points;
  return { kind: 'sorted', points, streak: s.streak, multiplier };
}

/** An item rolled off the end of the belt without being tapped. */
export function itemPassed(s: RunState, kind: ItemKind): Outcome {
  if (isSeed(kind)) {
    loseLife(s);
    return { kind: 'missed' };
  }
  return { kind: 'passed' };
}

export function isCleared(s: RunState, cfg: LevelConfig): boolean {
  return s.sorted >= cfg.target;
}

export function isFailed(s: RunState): boolean {
  return s.lives <= 0;
}

/** 3 stars for no lives lost, 2 for one, otherwise 1. */
export function starsFor(s: RunState): 1 | 2 | 3 {
  if (s.livesLost === 0) return 3;
  if (s.livesLost === 1) return 2;
  return 1;
}

/** Belt speed at a given progress through the level (0..1). */
export function speedAt(cfg: LevelConfig, progress: number): number {
  return cfg.speed * (1 + 0.25 * Math.max(0, Math.min(1, progress)));
}
