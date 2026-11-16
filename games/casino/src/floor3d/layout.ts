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
export interface RoomBounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  wallHeight: number;
}
export const SALON_ROOM: Readonly<RoomBounds> = { x0: -8.61, x1: 8.61, z0: -7.62, z1: 7.8, wallHeight: 5.4 };

/**
 * The room in use: the salon unless the floor is built as the grand hall preview (VA-0064).
 * world.ts calls useRoom() once per build; the cameras and nav read it at call time.
 */
export const ROOM: Readonly<RoomBounds> = { ...SALON_ROOM };
export function useRoom(r: Readonly<RoomBounds>): void {
  Object.assign(ROOM as RoomBounds, r);
}

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

/**
 * The hero table's own anchors (VA-0056, art `31367f5`, `userData.anchors`), in table-local
 * metres. The hero is not rotated, so world = table centre + local. A unit test checks these
 * still match what the art module exports.
 */
export const BLACKJACK_HERO_ANCHORS = {
  seats: { blackjack_1: { position: [-1.12, 1.53], approach: [-1.12, 2.3] }, blackjack_2: { position: [1.12, 1.53], approach: [1.12, 2.3] } } as Record<string, { position: [number, number]; approach: [number, number] }>,
  dealer: [0, -1.8] as [number, number],
};

/** The seats for the art in use: the hero table moves them to its own anchors; ids, order and taken flags stay. */
export function seatsFor(blackjackHero = false): Seat[] {
  if (!blackjackHero) return SEATS;
  return SEATS.map((s) => {
    const a = BLACKJACK_HERO_ANCHORS.seats[s.id];
    if (!a) return s;
    const x = TABLE.x + a.position[0];
    const z = TABLE.z + a.position[1];
    return { ...s, x, z, approach: { x: TABLE.x + a.approach[0], z: TABLE.z + a.approach[1] }, facing: Math.atan2(TABLE.x - x, -(TABLE.z - z)) };
  });
}

/** Where the placeholder dealer stands for the art in use. */
export function dealerSpotFor(blackjackHero = false): Vec2 {
  if (!blackjackHero) return DEALER_SPOT;
  const [x, z] = BLACKJACK_HERO_ANCHORS.dealer;
  return { x: TABLE.x + x, z: TABLE.z + z };
}

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
  // lounge planters (art pass 04: 0.25 m pots at x ±6.75, z 6.26, foliage to ~1.4 m)
  ...[-1, 1].map((side): Obstacle => ({ kind: 'circle', id: `planter-${side < 0 ? 'w' : 'e'}`, x: side * 6.75, z: 6.26, r: 0.27, h: 1.4 })),
  ...[-1, 1].map((side): Obstacle => ({ kind: 'box', id: `entrance-wing-${side < 0 ? 'w' : 'e'}`, x0: Math.min(side * 5.4, side * 8.5), z0: 7.51, x1: Math.max(side * 5.4, side * 8.5), z1: 7.79, h: 5.1 })),
  // slots face the middle of the room: a box from the cabinet's back to its console
  ...SLOTS.map((s): Obstacle => {
    const inward = s.x < 0 ? 1 : -1;
    const xa = s.x - inward * 0.42;
    const xb = s.x + inward * 0.6;
    return { kind: 'box', id: `slot-${s.id}`, x0: Math.min(xa, xb), z0: s.z - 0.62, x1: Math.max(xa, xb), z1: s.z + 0.62, h: 2.4 };
  }),
];

/** The pass-05 hero cabinet stands in for this machine (one hero first, per ART_PASS_05.md). */
export const PILOT_HERO_SLOT = 'sevens';

/**
 * The pass-05 pilot's swivel chair (VA-0029): where it stands in its slot's own frame, and its
 * footprint. The art chair spans about 0.89 x 0.86 m to the tips of its base and stands 1.45 m
 * tall; the round seat and base fit a 0.4 m circle, which keeps the slot's walk-up point free.
 *
 * It stands on the cabinet's local -X side (the left of a player facing the screen), as ChatGPT
 * asked in VA-0046: the walk-up framing swings the camera to the avatar's right, so a chair on
 * that side stood in the sightline (VA-0045). Turned toward the screen, mirroring the old pose.
 * At -0.78 rather than the asked -0.68, so the nav-grid cell 1 m in front of the screen stays
 * walkable: at -0.68 that cell's centre (0.2 m grid) sat 0.66 m from the chair, inside chair +
 * avatar radius (0.7 m), so you could not stand squarely in front of the machine.
 */
export const PILOT_CHAIR = { local: { x: -0.78, z: 0.78 }, rotationY: Math.PI - 0.7, r: 0.4, h: 1.45 } as const;

/** The pilot chair's floor position in the room (its slot's turn and position applied). */
export function pilotChairPosition(): Vec2 {
  const s = SLOTS.find((q) => q.id === PILOT_HERO_SLOT)!;
  const { x, z } = PILOT_CHAIR.local;
  const c = Math.cos(s.rotationY);
  const n = Math.sin(s.rotationY);
  return { x: s.x + x * c + z * n, z: s.z - x * n + z * c };
}

/** Obstacles for the art in use: the pass-05 pilot adds its swivel chair, which stands outside its slot's box. */
/**
 * The opt-in blackjack hero table (VA-0054) is an ellipse 1.9 m to the outside of its padded rail
 * along X and 1.18 m along Z, so it pokes 0.33 m past the round table's 1.57 m circle at both
 * ends. Two circles (reaching 1.85 m, plus the avatar's 0.3 m radius) cover those ends; the round circle still covers its guest and dealer sides.
 */
export const BLACKJACK_HERO_ENDS: Obstacle[] = [-1, 1].map((sx) => ({
  kind: 'circle',
  id: `blackjack-hero-end-${sx < 0 ? 'west' : 'east'}`,
  x: TABLE.x + sx * 1.2,
  z: TABLE.z,
  r: 0.65,
  h: TABLE.height,
}));

export function obstaclesFor(pilot05: boolean, blackjackHero = false): Obstacle[] {
  if (!pilot05 && !blackjackHero) return OBSTACLES;
  const out = [...OBSTACLES];
  if (pilot05) {
    const p = pilotChairPosition();
    out.push({ kind: 'circle', id: 'pilot-luxury-chair', x: p.x, z: p.z, r: PILOT_CHAIR.r, h: PILOT_CHAIR.h });
  }
  if (blackjackHero) {
    out.push(...BLACKJACK_HERO_ENDS);
    // the chairs move with the hero's seat anchors
    for (const seat of seatsFor(true)) {
      const i = out.findIndex((o) => o.id === `${seat.id}-chair`);
      if (i >= 0 && out[i].kind === 'circle') out[i] = { ...out[i], x: seat.x, z: seat.z } as Obstacle;
    }
  }
  return out;
}


// ------------------------------------------------------------------ grand hall preview (VA-0064)

/** Which floor: the current salon, or the opt-in larger grand hall preview. */
export type Hall = 'salon' | 'grand';
export const HALL_STORAGE_KEY = 'va3d.hall';

/** The stored hall choice; anything but "grand" is the salon. */
export function readHall(): Hall {
  try {
    return localStorage.getItem(HALL_STORAGE_KEY) === 'grand' ? 'grand' : 'salon';
  } catch {
    return 'salon';
  }
}

/** A slot machine on the floor; it faces local +Z turned by rotationY. */
export interface SlotPlacement {
  id: string;
  x: number;
  z: number;
  rotationY: number;
}

/** A table's position (the hero table, unrotated: guests on its +Z side, dealer on -Z). */
export interface TablePlacement {
  x: number;
  z: number;
}

/** Everything gameplay needs about one floor, from one description. */
export interface FloorLayout {
  hall: Hall;
  room: Readonly<RoomBounds>;
  /** The table the seats open (blackjack). */
  table: typeof TABLE;
  seats: Seat[];
  dealer: Vec2;
  spawn: { x: number; z: number; heading: number };
  /** Interactive machines (one per theme; their reels show the machine's symbols). */
  slots: SlotPlacement[];
  obstacles: Obstacle[];
  /** Warm point lights (the lighting rig sets their colour and strength). */
  lamps: { x: number; y: number; z: number }[];
  /** Grand hall only: scenery the art composer places (no interaction). */
  decor: { tables: TablePlacement[]; slots: SlotPlacement[]; dealers: Vec2[] };
  /** Grand hall only: the concourse's placement and size (art 1ad332e). */
  concourse: { z: number; length: number; width: number; ceilingHeight: number } | null;
}

/**
 * The grand hall: about 24 x 36 m, 7.6 m walls, entrance at +Z. ChatGPT's grand concourse
 * (VA-0062) runs down the middle; table banks either side of it; one interactive machine per
 * theme along the back wall at the concourse's end; decorative slot banks along both side walls.
 * Counts are here so the phone measurements can tune them.
 */
export const GRAND_ROOM: Readonly<RoomBounds> = { x0: -12, x1: 12, z0: -18, z1: 17.8, wallHeight: 7.6 };
export const GRAND = {
  concourse: { z: -1, length: 32, width: 6, ceilingHeight: 7.2 },
  /** The concourse's colonnade (its art: x = ±(width/2 + 1.25), every 6 m from 3 m in). */
  columnX: 6 / 2 + 1.25,
  tableX: 7.6,
  tableZ: [-11, -3.5, 4],
  /** The interactive table: west bank, middle. */
  liveTable: { side: -1, index: 1 },
  /** Hero cabinet: 1.14 m wide, its deck reaches 0.78 m in front and its back 0.48 m behind. */
  slotPitch: 1.3,
  backRowZ: -17.4,
  sideBankX: 11.4,
  /** Decorative machines per side wall. */
  sideBankCount: 14,
  sideBankZ0: -9,
  spawn: { x: 0, z: 15, heading: 0 },
} as const;

/** A slot machine's footprint: from 0.5 m behind its centre to its deck 0.8 m in front, 1.2 m wide. */
function slotBox(id: string, s: SlotPlacement): BoxObstacle {
  const fx = Math.round(Math.sin(s.rotationY));
  const fz = Math.round(Math.cos(s.rotationY));
  const [a, b] = [-0.5, 0.8];
  const xs = fx !== 0 ? [s.x + fx * a, s.x + fx * b] : [s.x - 0.6, s.x + 0.6];
  const zs = fz !== 0 ? [s.z + fz * a, s.z + fz * b] : [s.z - 0.6, s.z + 0.6];
  return { kind: 'box', id, x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs), h: 3.2 };
}

/** A hero table's furniture you can't walk through (the same shapes as the salon's hero table). */
function heroTableObstacles(t: TablePlacement, tableId: string, chairIds: [string, string]): Obstacle[] {
  const seats = Object.values(BLACKJACK_HERO_ANCHORS.seats);
  return [
    { kind: 'circle', id: tableId, x: t.x, z: t.z, r: TABLE.radius, h: TABLE.height },
    ...[-1, 1].map((sx): Obstacle => ({ kind: 'circle', id: `${tableId}-end-${sx < 0 ? 'west' : 'east'}`, x: t.x + sx * 1.2, z: t.z, r: 0.65, h: TABLE.height })),
    { kind: 'box', id: `${tableId}-dealer-area`, x0: t.x - 1.2, z0: t.z - TABLE.radius - 0.8, x1: t.x + 1.2, z1: t.z, h: 1.0 },
    ...seats.map((a, i): Obstacle => ({ kind: 'circle', id: chairIds[i], x: t.x + a.position[0], z: t.z + a.position[1], r: 0.38, h: 1.45 })),
  ];
}

export function grandLayout(): FloorLayout {
  const g = GRAND;
  const tables: TablePlacement[] = [-1, 1].flatMap((side) => g.tableZ.map((z) => ({ x: side * g.tableX, z })));
  const live = tables[(g.liveTable.side < 0 ? 0 : g.tableZ.length) + g.liveTable.index];
  const table = { ...TABLE, x: live.x, z: live.z };
  const anchors = BLACKJACK_HERO_ANCHORS.seats;
  const seats: Seat[] = SEATS.map((s) => {
    const a = anchors[s.id];
    const x = live.x + a.position[0];
    const z = live.z + a.position[1];
    return { ...s, x, z, approach: { x: live.x + a.approach[0], z: live.z + a.approach[1] }, facing: Math.atan2(live.x - x, -(live.z - z)) };
  });
  const ids = CASINO_WORLD.slots.map((s) => s.id);
  const slots: SlotPlacement[] = ids.map((id, i) => ({ id, x: (i - (ids.length - 1) / 2) * g.slotPitch, z: g.backRowZ, rotationY: 0 }));
  const decoSlots: SlotPlacement[] = [-1, 1].flatMap((side) =>
    Array.from({ length: g.sideBankCount }, (_, i) => ({
      id: ids[(i + (side > 0 ? 5 : 0)) % ids.length],
      x: side * g.sideBankX,
      z: g.sideBankZ0 + i * g.slotPitch,
      rotationY: side < 0 ? Math.PI / 2 : -Math.PI / 2,
    })),
  );
  const decoTables = tables.filter((t) => t !== live);
  const c = g.concourse;
  const columns: Vec2[] = [];
  for (let z = -c.length / 2 + 3; z < c.length / 2; z += 6) for (const x of [-g.columnX, g.columnX]) columns.push({ x, z: c.z + z });
  const obstacles: Obstacle[] = [
    ...heroTableObstacles(live, 'table', ['blackjack_1-chair', 'blackjack_2-chair']),
    ...decoTables.flatMap((t, i) => heroTableObstacles(t, `deco-table-${i + 1}`, [`deco-${i + 1}a-chair`, `deco-${i + 1}b-chair`])),
    // the column plinths are 0.95 m square
    ...columns.map((p, i): Obstacle => ({ kind: 'circle', id: `concourse-column-${i + 1}`, x: p.x, z: p.z, r: 0.55, h: c.ceilingHeight })),
    ...slots.map((s) => slotBox(`slot-${s.id}`, s)),
    ...decoSlots.map((s, i) => slotBox(`deco-slot-${i + 1}`, s)),
  ];
  return {
    hall: 'grand',
    room: GRAND_ROOM,
    table,
    seats,
    dealer: { x: live.x + BLACKJACK_HERO_ANCHORS.dealer[0], z: live.z + BLACKJACK_HERO_ANCHORS.dealer[1] },
    spawn: { ...g.spawn },
    slots,
    obstacles,
    lamps: [-9, 7].map((z) => ({ x: 0, y: 6, z: c.z + z + 1 })),
    decor: { tables: decoTables, slots: decoSlots, dealers: decoTables.map((t) => ({ x: t.x + BLACKJACK_HERO_ANCHORS.dealer[0], z: t.z + BLACKJACK_HERO_ANCHORS.dealer[1] })) },
    concourse: { ...c },
  };
}

/** The salon as it has always been, as a layout. */
export function salonLayout(pilot05: boolean, blackjackHero: boolean): FloorLayout {
  return {
    hall: 'salon',
    room: SALON_ROOM,
    table: TABLE,
    seats: seatsFor(blackjackHero),
    dealer: dealerSpotFor(blackjackHero),
    spawn: SPAWN,
    slots: SLOTS,
    obstacles: obstaclesFor(pilot05, blackjackHero),
    lamps: [-4, 2.6].map((z) => ({ x: 0, y: 3.9, z })),
    decor: { tables: [], slots: [], dealers: [] },
    concourse: null,
  };
}

export function layoutFor(hall: Hall, pilot05: boolean, blackjackHero: boolean): FloorLayout {
  return hall === 'grand' ? grandLayout() : salonLayout(pilot05, blackjackHero);
}
