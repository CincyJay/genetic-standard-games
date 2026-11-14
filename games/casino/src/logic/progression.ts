/**
 * Player progression: XP from wagering, levels with rewards and unlocks, VIP
 * tiers, daily missions and the daily bonus wheel. Pure logic, no rendering.
 */

// ---------------------------------------------------------------- levels
/** XP earned per coin wagered (1 XP per 10 coins). */
export const XP_PER_COIN = 0.1;

/** Total XP needed to reach `level` (level 1 = 0 XP). Grows a little faster each level. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(150 * Math.pow(level - 1, 1.6));
}

export function levelForXp(xp: number): number {
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

/** Progress through the current level, 0..1. */
export function levelProgress(xp: number): { level: number; into: number; needed: number; fraction: number } {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - base, needed: next - base, fraction: (xp - base) / (next - base) };
}

/** Coins awarded for reaching `level`. */
export function levelReward(level: number): number {
  return 500 + level * 250 + (level % 5 === 0 ? level * 500 : 0);
}

// ---------------------------------------------------------------- unlocks
export type UnlockId = 'slots-pharaoh' | 'slots-ocean' | 'slots-goldrush' | 'holdem-highroller' | 'holdem-vip';

export const UNLOCKS: { id: UnlockId; level: number; name: string }[] = [
  { id: 'slots-pharaoh', level: 3, name: "Pharaoh's Gold slot" },
  { id: 'holdem-highroller', level: 5, name: "High Roller hold'em table" },
  { id: 'slots-ocean', level: 6, name: 'Deep Blue slot' },
  { id: 'slots-goldrush', level: 10, name: 'Gold Rush slot' },
  { id: 'holdem-vip', level: 15, name: "VIP Room hold'em table" },
];

export function isUnlocked(id: UnlockId, level: number): boolean {
  return level >= UNLOCKS.find((u) => u.id === id)!.level;
}

/** Unlocks newly reached when going from `from` to `to` level. */
export function unlocksBetween(from: number, to: number): typeof UNLOCKS {
  return UNLOCKS.filter((u) => u.level > from && u.level <= to);
}

// ---------------------------------------------------------------- VIP
export const VIP_TIERS = [
  { name: 'Bronze', level: 1, bonus: 1, color: 0xcd8a4a },
  { name: 'Silver', level: 10, bonus: 1.25, color: 0xc9cdd6 },
  { name: 'Gold', level: 25, bonus: 1.5, color: 0xe9c86a },
  { name: 'Platinum', level: 50, bonus: 2, color: 0x9fe3e0 },
  { name: 'Diamond', level: 100, bonus: 3, color: 0xb9a4ff },
] as const;

export function vipTier(level: number): (typeof VIP_TIERS)[number] {
  let t: (typeof VIP_TIERS)[number] = VIP_TIERS[0];
  for (const v of VIP_TIERS) if (level >= v.level) t = v;
  return t;
}

// ---------------------------------------------------------------- missions
/** Events the games report. */
export type GameEvent =
  | 'slots_spin'
  | 'slots_bonus'
  | 'blackjack_hand'
  | 'blackjack_win'
  | 'blackjack_blackjack'
  | 'roulette_spin'
  | 'roulette_inside_win'
  | 'videopoker_hand'
  | 'videopoker_twopair'
  | 'holdem_hand'
  | 'holdem_pot'
  | 'coins_won';

export interface MissionDef {
  id: string;
  event: GameEvent;
  target: number;
  text: string;
  reward: number;
}

const POOL: MissionDef[] = [
  { id: 'spin30', event: 'slots_spin', target: 30, text: 'Spin any slot 30 times', reward: 2500 },
  { id: 'spin80', event: 'slots_spin', target: 80, text: 'Spin any slot 80 times', reward: 6000 },
  { id: 'slotbonus', event: 'slots_bonus', target: 1, text: 'Trigger a slot bonus feature', reward: 5000 },
  { id: 'bj10', event: 'blackjack_hand', target: 10, text: 'Play 10 hands of blackjack', reward: 2500 },
  { id: 'bjwin5', event: 'blackjack_win', target: 5, text: 'Win 5 blackjack hands', reward: 3500 },
  { id: 'bjbj', event: 'blackjack_blackjack', target: 1, text: 'Get a blackjack', reward: 3000 },
  { id: 'rl10', event: 'roulette_spin', target: 10, text: 'Spin the roulette wheel 10 times', reward: 2500 },
  { id: 'rlin', event: 'roulette_inside_win', target: 1, text: 'Win a roulette inside bet', reward: 4000 },
  { id: 'vp15', event: 'videopoker_hand', target: 15, text: 'Play 15 hands of video poker', reward: 2500 },
  { id: 'vp2p', event: 'videopoker_twopair', target: 3, text: 'Get two pair or better 3 times in video poker', reward: 4000 },
  { id: 'he10', event: 'holdem_hand', target: 10, text: "Play 10 hands of hold'em", reward: 3000 },
  { id: 'hepot', event: 'holdem_pot', target: 3, text: "Win 3 pots in hold'em", reward: 5000 },
  { id: 'win10k', event: 'coins_won', target: 10_000, text: 'Win 10,000 coins in any game', reward: 4000 },
];

/** Day key in the player's local time, e.g. "2026-11-14". */
export function dayKey(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** Three missions for a day, picked deterministically and from different games. */
export function missionsFor(day: string): MissionDef[] {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const picked: MissionDef[] = [];
  const games = new Set<string>();
  let i = h % POOL.length;
  while (picked.length < 3) {
    const m = POOL[i % POOL.length]!;
    const game = m.event.split('_')[0]!;
    if (!games.has(game)) {
      picked.push(m);
      games.add(game);
    }
    i += 1 + (h % 5);
  }
  return picked;
}

// ---------------------------------------------------------------- daily wheel
export const WHEEL_PRIZES = [1000, 2500, 1500, 5000, 2000, 10000, 1500, 3000, 1000, 25000, 2000, 4000];
/** Chance weight of each wedge (big prizes are rarer). */
export const WHEEL_WEIGHTS = [14, 9, 12, 5, 11, 2, 12, 7, 14, 0.6, 11, 6];

export function spinWheel(rnd: () => number): number {
  const total = WHEEL_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < WHEEL_WEIGHTS.length; i++) {
    r -= WHEEL_WEIGHTS[i]!;
    if (r <= 0) return i;
  }
  return WHEEL_WEIGHTS.length - 1;
}
