/**
 * The stage-1 3D casino floor: one room, one blackjack table with two seats, two pillars and a
 * bank of slot placeholders. Everything is in metres, Y up, origin at the centre of the room's
 * floor. +Z points toward the entrance (where the player starts), -Z toward the back wall.
 *
 * This file is the single source of truth for the graybox AND for ChatGPT's art contract
 * (docs/design/3d-casino-art-contract.md): real GLB art must line up with these positions.
 */

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

export const ROOM = { x0: -8, x1: 8, z0: -8, z1: 6, wallHeight: 3.2 } as const;

/** The avatar is treated as a circle this wide for walking and collisions. */
export const AGENT_RADIUS = 0.3;
export const AVATAR_HEIGHT = 1.75;
export const SEAT_HEIGHT = 0.72;

export const TABLE = {
  id: 'blackjack-1',
  /** Centre of the table's flat (dealer) edge. The curved player rail faces +Z. */
  x: 0,
  z: -3,
  radius: 1.3,
  height: 0.9,
};

const SEAT_RING = 1.8;
const APPROACH_RING = 2.45;
const seatAt = (id: string, deg: number, taken: boolean): Seat => {
  const a = (deg * Math.PI) / 180;
  return {
    id,
    game: 'blackjack',
    x: TABLE.x + SEAT_RING * Math.sin(a),
    z: TABLE.z + SEAT_RING * Math.cos(a),
    approach: { x: TABLE.x + APPROACH_RING * Math.sin(a), z: TABLE.z + APPROACH_RING * Math.cos(a) },
    // seated players face the table centre
    // (heading h walks along (sin h, -cos h), so facing back toward the centre is -a)
    facing: -a,
    taken,
  };
};

export const SEATS: Seat[] = [seatAt('blackjack-1-seat-1', -28, false), seatAt('blackjack-1-seat-2', 28, true)];

/** Where the dealer stands, behind the flat edge (an art socket; no dealer logic yet). */
export const DEALER_SPOT: Vec2 = { x: TABLE.x, z: TABLE.z - 0.75 };

export const SPAWN = { x: 0, z: 2.2, heading: 0 };

export const OBSTACLES: Obstacle[] = [
  // the table: a half disc on the +Z side of its flat edge, approximated by a circle
  { kind: 'circle', id: 'table', x: TABLE.x, z: TABLE.z + 0.15, r: TABLE.radius, h: TABLE.height },
  // the dealer's area behind the table
  { kind: 'box', id: 'dealer-area', x0: TABLE.x - 1.6, z0: TABLE.z - 1.5, x1: TABLE.x + 1.6, z1: TABLE.z, h: 1.0 },
  // stools
  ...SEATS.map((s): Obstacle => ({ kind: 'circle', id: `${s.id}-stool`, x: s.x, z: s.z, r: 0.25, h: SEAT_HEIGHT })),
  // pillars
  { kind: 'circle', id: 'pillar-w', x: -4.5, z: 0, r: 0.45, h: ROOM.wallHeight },
  { kind: 'circle', id: 'pillar-e', x: 4.5, z: 0, r: 0.45, h: ROOM.wallHeight },
  // a bank of four slot cabinets against the west wall (placeholders, not interactive yet)
  ...[-5.5, -4.5, -3.5, -2.5].map((z, i): Obstacle => ({ kind: 'box', id: `slot-${i + 1}`, x0: ROOM.x0, z0: z - 0.4, x1: ROOM.x0 + 0.85, z1: z + 0.4, h: 1.95 })),
];
