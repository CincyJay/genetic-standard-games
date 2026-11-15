/**
 * The 3D casino floor's gameplay layout: walls, seats, the spawn point and everything you
 * can't walk through. Everything is in metres, Y up, origin at the centre of the room's floor.
 * +Z points toward the open entrance (where the player starts), -Z toward the back wall.
 *
 * Positions come from ChatGPT's art composition (CASINO_WORLD in
 * art/casino/3d/worldComposition.mjs, PR #2), so the art and the gameplay always agree. What
 * the art doesn't say (collision shapes, which way seats face, where you stand to sit down) is
 * engineering's and is worked out here from the art's own dimensions.
 */
import { CASINO_WORLD } from '../../../../art/casino/3d/worldComposition.mjs';


export interface Vec2 {
  x: number;
  z: number;
}

/** A circle on the floor that nobody can walk through. */
export interface CircleObstacle {
  kind: 'circle';
  id: string;
  x: number;
  z: number;
  r: number;
  /** Height in metres (for the graybox and the follow camera's collision). */
  h: number;
}

/** An axis-aligned box on the floor that nobody can walk through. */
export interface BoxObstacle {
  kind: 'box';
  id: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
}

export type Obstacle = CircleObstacle | BoxObstacle;

export interface Seat {
  id: string;
  /** The game this seat opens. */
  game: 'blackjack';
  /** Where the avatar's hips sit (floor position; seat height is SEAT_HEIGHT). */
  x: number;
  z: number;
  /** Where the avatar stands before sitting down and after standing up. */
  approach: Vec2;
  /** Facing while seated, in radians (0 = facing -Z, positive turns toward +X). */
  facing: number;
  /** Stage 1 has no multiplayer: one seat is shown as taken by a computer player. */
  taken: boolean;
}

/**
 * The walkable room: inside faces of the side walls (art: 0.38 m thick at x ±8.8) and the back
 * wall (0.36 m at z -7.8). The entrance side (+Z) has wings either side of an open arch (see
 * OBSTACLES); the floor ends at z +8.
 */
export const ROOM = { x0: -8.61, x1: 8.61, z0: -7.62, z1: 7.8, wallHeight: 5.4 } as const;

/** The avatar is treated as a circle this wide for walking and collisions. */
export const AGENT_RADIUS = 0.3;
export const AVATAR_HEIGHT = 1.75;
/** Top of the art chair's cushion. */
export const SEAT_HEIGHT = 0.65;

export const TABLE = {
  id: 'blackjack',
  /** Centre of the round table (art: radius 1.57 to the brass rim, felt top at 1.17 m). */
  x: CASINO_WORLD.blackjack.x,
  z: CASINO_WORLD.blackjack.z,
  radius: 1.57,
  height: 1.19,
};

/** How far from a seat's chair you stand before sitting down (clear of the chair's back). */
const APPROACH_OUT = 0.85;

/**
 * Seats from the art. Each faces the table's centre; you walk up behind the chair. Stage 1 has
 * no multiplayer, so the second seat is shown as taken by a computer player.
 */
export const SEATS: Seat[] = CASINO_WORLD.seats.map((s, i) => {
  const dx = TABLE.x - s.x;
  const dz = TABLE.z - s.z;
  const len = Math.hypot(dx, dz);
  return {
    id: s.id,
    game: 'blackjack' as const,
    x: s.x,
    z: s.z,
    approach: { x: s.x - (dx / len) * APPROACH_OUT, z: s.z - (dz / len) * APPROACH_OUT },
    // heading h walks along (sin h, -cos h): face the table centre
    facing: Math.atan2(dx, -dz),
    taken: i === 1,
  };
});

/** Where the dealer stands: behind the table, on the shoe's side (an art socket; no dealer logic yet). */
export const DEALER_SPOT: Vec2 = { x: TABLE.x, z: TABLE.z - TABLE.radius - 0.4 };

/** Start on the red carpet, facing the table. */
export const SPAWN = { x: CASINO_WORLD.spawn.x, z: CASINO_WORLD.spawn.z, heading: 0 };

/** Slot cabinets from the art. Each is 1.22 m wide; its console reaches 0.6 m in front of its centre. */
export const SLOTS = CASINO_WORLD.slots.map((s) => ({ id: s.id, x: s.x, z: s.z, rotationY: s.rotationY }));

/** Columns from the art (radius 0.43 at the brass capitals). */
const COLUMNS: Vec2[] = [-7.5, 7.5].flatMap((x) => [-6.4, -2.6, 1.2, 5].map((z) => ({ x, z })));
/** Lounge benches from the art (pass 03): 1.78 m wide bases, backs on the entrance side. */
const BENCHES: Vec2[] = [-5.15, -2.75, 2.75, 5.15].map((x) => ({ x, z: 6.35 }));

export const OBSTACLES: Obstacle[] = [
  { kind: 'circle', id: 'table', x: TABLE.x, z: TABLE.z, r: TABLE.radius, h: TABLE.height },
  // the dealer's area behind the table
  { kind: 'box', id: 'dealer-area', x0: TABLE.x - 1.2, z0: TABLE.z - TABLE.radius - 0.8, x1: TABLE.x + 1.2, z1: TABLE.z, h: 1.0 },
  // chairs (0.69 m wide)
  ...SEATS.map((s): Obstacle => ({ kind: 'circle', id: `${s.id}-chair`, x: s.x, z: s.z, r: 0.38, h: 1.55 })),
  ...COLUMNS.map((c, i): Obstacle => ({ kind: 'circle', id: `column-${i + 1}`, x: c.x, z: c.z, r: 0.43, h: ROOM.wallHeight })),
  // the base reaches 0.42 m toward the room; the back cushion reaches 0.45 m toward the entrance
  ...BENCHES.map((b, i): Obstacle => ({ kind: 'box', id: `bench-${i + 1}`, x0: b.x - 0.89, z0: b.z - 0.42, x1: b.x + 0.89, z1: b.z + 0.45, h: 1.23 })),
  // the entrance wings either side of the open arch (art pass 03: 3.1 m wide, 0.28 m deep at z 7.65)
  ...[-1, 1].map((side): Obstacle => ({ kind: 'box', id: `entrance-wing-${side < 0 ? 'w' : 'e'}`, x0: Math.min(side * 5.4, side * 8.5), z0: 7.51, x1: Math.max(side * 5.4, side * 8.5), z1: 7.79, h: 5.1 })),
  // slots face the middle of the room: a box from the cabinet's back to its console
  ...SLOTS.map((s): Obstacle => {
    const inward = s.x < 0 ? 1 : -1;
    const xa = s.x - inward * 0.42;
    const xb = s.x + inward * 0.6;
    return { kind: 'box', id: `slot-${s.id}`, x0: Math.min(xa, xb), z0: s.z - 0.62, x1: Math.max(xa, xb), z1: s.z + 0.62, h: 2.4 };
  }),
];
