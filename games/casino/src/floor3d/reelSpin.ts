/**
 * Reel-strip motion for the Svelte 01 screen prototype (VA-0122): pure maths, no canvas, no gameplay.
 * A reel's position is measured in symbol rows along its strip. Each reel spins a whole number of
 * rows with a cubic ease-out and lands exactly on its target index, so the stopped reel shows
 * whole symbols. Reels stop left to right, `stagger` seconds apart.
 */
export interface SpinPlan {
  /** Strip index each reel must show on its middle row when it stops. */
  targets: number[];
  /** Symbols on the strip (the strip repeats). */
  stripLength: number;
  /** Per-reel strip lengths, when reels have different strips (the slot engine's do); overrides `stripLength`. */
  stripLengths?: number[];
  /** Strip position each reel starts from (rows); defaults to 0. */
  from?: number[];
  /** Seconds for the first reel. */
  duration?: number;
  /** Extra seconds per later reel. */
  stagger?: number;
  /** Minimum full strip turns before landing. */
  minTurns?: number;
}

export interface ReelPose {
  /** Strip position in rows; the middle row shows `floor(pos) mod stripLength` while moving. */
  pos: number;
  stopped: boolean;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Rows each reel travels: at least `minTurns` turns, then on to the target (plus a turn per later reel). */
export function travelRows(plan: SpinPlan): number[] {
  const turns = plan.minTurns ?? 2;
  return plan.targets.map((t, i) => {
    const n = plan.stripLengths?.[i] ?? plan.stripLength;
    const from = plan.from?.[i] ?? 0;
    return (turns + i) * n + mod(t - from, n);
  });
}

/** Seconds until reel `i` stops. */
export function stopTime(plan: SpinPlan, i: number): number {
  return (plan.duration ?? 1.1) + i * (plan.stagger ?? 0.35);
}

/** Poses of every reel `t` seconds after the spin started. */
export function reelPoses(plan: SpinPlan, t: number): ReelPose[] {
  const travel = travelRows(plan);
  return plan.targets.map((_, i) => {
    const from = plan.from?.[i] ?? 0;
    const T = stopTime(plan, i);
    if (t >= T) return { pos: from + travel[i]!, stopped: true };
    const u = Math.max(0, t) / T;
    const eased = 1 - (1 - u) ** 3;
    return { pos: from + travel[i]! * eased, stopped: false };
  });
}

/** Strip index shown on visible row `row` (0 = top) of a window `rows` tall, for strip position `pos`. */
export function symbolAt(pos: number, row: number, rows: number, stripLength: number): number {
  const mid = Math.floor(rows / 2);
  return mod(Math.floor(pos) + row - mid, stripLength);
}

/**
 * Middle-row strip targets that make a window `rows` tall show the slot engine's grid: the engine's
 * `gridFromStops` puts `strip[stop + row]` on row `row` (0 = top), and `symbolAt` puts
 * `pos + row - mid` there, so the reel must stop at `stop + mid`.
 */
export function targetsFromStops(stops: number[], stripLengths: number[], rows: number): number[] {
  const mid = Math.floor(rows / 2);
  return stops.map((s, i) => mod(s + mid, stripLengths[i]!));
}

/** Cells (`reel*rows + row`) on the winning stretch of each line win: the first `count` reels of that line. */
export function winningCells(wins: { line: number; count: number }[], lines: number[][], rows: number): Set<number> {
  const out = new Set<number>();
  for (const w of wins) lines[w.line]!.slice(0, w.count).forEach((row, reel) => out.add(reel * rows + row));
  return out;
}
