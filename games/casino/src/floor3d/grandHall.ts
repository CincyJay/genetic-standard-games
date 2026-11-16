/**
 * The opt-in "Grand hall" preview's gameplay layout (VA-0063 plan, VA-0065 art): one parametric
 * description of a larger casino from which the walkable bounds, collision, table and slot
 * banks, seats, spawn and camera clamps all follow. Pure logic, no Three.js, so it is
 * unit-tested. grandFloorLayout() turns it into the floor's FloorLayout (VA-0069).
 *
 * The architecture is ChatGPT's `createGrandHallArchitecture` (art/casino/3d/
 * grandHallArchitecture.mjs, `8a874c9`). The column rhythm and the side walls are worked out
 * here from the same parameters with the same formulas, and a unit test checks they still match
 * the meshes the art module builds. Coordinates as in that module: X across the hall, Z down it
 * (+Z is the entrance end, where the player starts), Y up, origin at the centre of the floor.
 */
import { AGENT_RADIUS, BLACKJACK_HERO_ANCHORS, salonLayout, TABLE, type FloorLayout, type Hall, type Obstacle, type Seat, type SlotPlacement, type Vec2 } from './layout.ts';
import { CASINO_WORLD } from '../../../../art/casino/3d/worldComposition.mjs';

export interface GrandHallSpec {
  width: number;
  length: number;
  height: number;
  aisleWidth: number;
  bayLength: number;
}

/** The art module's defaults: the 36 x 24 m preview proposed in VA-0063. */
export const GRAND_HALL_DEFAULTS: GrandHallSpec = { width: 24, length: 36, height: 7.2, aisleWidth: 7.5, bayLength: 4 };

export interface HallTable {
  id: string;
  x: number;
  z: number;
}

export interface HallSlot {
  id: string;
  x: number;
  z: number;
  /** Turn about Y; the cabinet's screen faces local +Z, so this faces it into the hall. */
  rotationY: number;
  /** Where you stand to play it: 1 m in front of the screen. */
  front: Vec2;
}

export interface GrandHallLayout {
  spec: GrandHallSpec;
  /** The walkable area: wall faces along X, the hall's ends along Z. */
  bounds: { x0: number; x1: number; z0: number; z1: number; wallHeight: number };
  /** The centre promenade, kept clear of every obstacle (the art's `clearAisle`). */
  aisle: { x0: number; x1: number };
  /** The flanking gaming zones (the art's `leftGamingZone`/`rightGamingZone`), along X. */
  zones: { x0: number; x1: number }[];
  columns: Vec2[];
  tables: HallTable[];
  seats: Seat[];
  slots: HallSlot[];
  obstacles: Obstacle[];
  spawn: { x: number; z: number; heading: number };
  /** The opening the art leaves for the host to frame at the +Z end (the promenade's width). */
  entrance: { x0: number; x1: number; z: number };
}

const clamp = (v: number | undefined, fallback: number, lo: number, hi: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v as number)) : fallback;

/** The same clamping the art module applies, so both sides agree on the hall's real size. */
export function resolveSpec(opts: Partial<GrandHallSpec> = {}): GrandHallSpec {
  const width = clamp(opts.width, GRAND_HALL_DEFAULTS.width, 16, 80);
  return {
    width,
    length: clamp(opts.length, GRAND_HALL_DEFAULTS.length, 20, 120),
    height: clamp(opts.height, GRAND_HALL_DEFAULTS.height, 5.5, 14),
    aisleWidth: clamp(opts.aisleWidth, GRAND_HALL_DEFAULTS.aisleWidth, 4, Math.min(12, width - 8)),
    bayLength: clamp(opts.bayLength, GRAND_HALL_DEFAULTS.bayLength, 2.5, 8),
  };
}

/** Column centres, as the art places its colonnade: every other bay, just outside the aisle. */
export function hallColumns(spec: GrandHallSpec): Vec2[] {
  const { length, aisleWidth, bayLength } = spec;
  const bays = Math.ceil(length / bayLength);
  const step = length / bays;
  const out: Vec2[] = [];
  for (let z = -length / 2 + step; z < length / 2 - step / 2; z += step * 2)
    for (const side of [-1, 1]) out.push({ x: side * (aisleWidth / 2 + 1.15), z });
  return out;
}

/** The art's square column plinth is 0.9 m across. */
const PLINTH_HALF = 0.45;
/** Inside face of the side walls' brass chair rail, the part that reaches furthest into the hall. */
const WALL_REACH = 0.12 + 0.17;
/** Slot cabinet: 1.22 m wide; its back sits 0.42 m behind its centre, its console 0.6 m in front. */
const SLOT_HALF_W = 0.61;
const SLOT_BACK = 0.42;
const SLOT_FRONT = 0.6;
const SLOT_PITCH = 1.3;
/** The blackjack hero table (VA-0054): padded rail 1.9 m from centre along X, 1.18 m along Z. */
const TABLE_R = 1.57;
const TABLE_H = 1.19;
/** A table, its dealer area and its seat approaches span this much along Z. */
const TABLE_SPAN = { back: TABLE_R + 0.8, front: 2.3 + AGENT_RADIUS };

/** Obstacles for one blackjack hero table centred at (x, z), its two chairs and dealer area. */
function tableObstacles(t: HallTable): Obstacle[] {
  return [
    { kind: 'circle', id: `${t.id}-table`, x: t.x, z: t.z, r: TABLE_R, h: TABLE_H },
    ...[-1, 1].map((sx): Obstacle => ({ kind: 'circle', id: `${t.id}-end-${sx < 0 ? 'west' : 'east'}`, x: t.x + sx * 1.2, z: t.z, r: 0.65, h: TABLE_H })),
    { kind: 'box', id: `${t.id}-dealer-area`, x0: t.x - 1.2, z0: t.z - TABLE_R - 0.8, x1: t.x + 1.2, z1: t.z, h: 1.0 },
    ...Object.entries(BLACKJACK_HERO_ANCHORS.seats).map(([sid, a]): Obstacle => ({ kind: 'circle', id: `${t.id}-${sid}-chair`, x: t.x + a.position[0], z: t.z + a.position[1], r: 0.38, h: 1.55 })),
  ];
}

function tableSeats(t: HallTable, first: boolean): Seat[] {
  return Object.entries(BLACKJACK_HERO_ANCHORS.seats).map(([sid, a], i) => {
    const x = t.x + a.position[0];
    const z = t.z + a.position[1];
    return {
      id: `${t.id}-${sid}`,
      game: 'blackjack' as const,
      x,
      z,
      approach: { x: t.x + a.approach[0], z: t.z + a.approach[1] },
      facing: Math.atan2(t.x - x, -(t.z - z)),
      // Stage 1 has no multiplayer: the first table keeps one seat shown as taken
      taken: first && i === 1,
    };
  });
}

/**
 * Lays the hall out:
 * - blackjack hero tables in the middle of each gaming zone, as many as fit along the middle
 *   third of the hall;
 * - slot banks with their backs to the side walls in the back and front thirds, facing the hall;
 * - the spawn on the promenade near the entrance end, facing down the hall.
 */
export function grandHallLayout(opts: Partial<GrandHallSpec> & { backRow?: number } = {}): GrandHallLayout {
  const spec = resolveSpec(opts);
  const { width, length, height, aisleWidth } = spec;
  const wallX = width / 2 - WALL_REACH;
  // an optional row of machines against the far end wall, facing down the promenade (VA-0069):
  // the walkable area then starts at their consoles, so the row stands outside it, like a wall
  const backRow = Math.max(0, Math.floor(opts.backRow ?? 0));
  const backZ = -length / 2 + 0.2 + SLOT_BACK + 0.05;
  const z0 = backRow ? backZ + SLOT_FRONT : -length / 2 + 0.2;
  const bounds = { x0: -wallX, x1: wallX, z0, z1: length / 2 - 0.2, wallHeight: height };
  const aisle = { x0: -aisleWidth / 2 + 0.3, x1: aisleWidth / 2 - 0.3 };
  const zoneIn = aisleWidth / 2 + 1.7;
  const zoneOut = width / 2 - 0.5;
  const zones = [
    { x0: -zoneOut, x1: -zoneIn },
    { x0: zoneIn, x1: zoneOut },
  ];
  const columns = hallColumns(spec);

  // slots: backs at the zone's outer edge, in the back and front thirds
  const slotX = zoneOut - SLOT_BACK;
  const third = length / 3;
  const slots: HallSlot[] = [];
  const bank = (z0: number, z1: number, tag: string) => {
    const n = Math.max(0, Math.floor((z1 - z0 - 2 * SLOT_HALF_W) / SLOT_PITCH) + 1);
    const used = (n - 1) * SLOT_PITCH;
    for (const side of [-1, 1])
      for (let i = 0; i < n; i++) {
        const z = (z0 + z1) / 2 - used / 2 + i * SLOT_PITCH;
        const x = side * slotX;
        // screen faces local +Z; turn it to face -side along X
        const rotationY = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        slots.push({ id: `${tag}-${side < 0 ? 'w' : 'e'}${i + 1}`, x, z, rotationY, front: { x: x - side * (SLOT_FRONT + 0.4), z } });
      }
  };
  for (let i = 0; i < backRow; i++) {
    const x = (i - (backRow - 1) / 2) * SLOT_PITCH;
    slots.push({ id: `end-${i + 1}`, x, z: backZ, rotationY: 0, front: { x, z: backZ + SLOT_FRONT + 0.4 } });
  }
  bank(-length / 2 + 0.8, -length / 2 + third - 0.6, 'back');
  bank(length / 2 - third + 0.6, length / 2 - 2.4, 'front');

  // tables: centred across each zone, stacked along the middle third
  const tableX = (zoneIn + zoneOut) / 2;
  const tablePitch = TABLE_SPAN.back + TABLE_SPAN.front + 0.6;
  const nTables = Math.max(1, Math.floor((third + 1.2) / tablePitch));
  const tables: HallTable[] = [];
  for (const side of [-1, 1])
    for (let i = 0; i < nTables; i++) {
      // offset so each table's back-to-front span is centred in the middle third
      const z = -((nTables - 1) * tablePitch) / 2 + i * tablePitch + (TABLE_SPAN.back - TABLE_SPAN.front) / 2;
      tables.push({ id: `bj-${side < 0 ? 'w' : 'e'}${i + 1}`, x: side * tableX, z });
    }
  const seats = tables.flatMap((t, i) => tableSeats(t, i === 0));

  const obstacles: Obstacle[] = [
    ...columns.map((c, i): Obstacle => ({ kind: 'box', id: `hall-column-${i + 1}`, x0: c.x - PLINTH_HALF, z0: c.z - PLINTH_HALF, x1: c.x + PLINTH_HALF, z1: c.z + PLINTH_HALF, h: height })),
    ...tables.flatMap(tableObstacles),
    ...slots.filter((s) => !s.id.startsWith('end-')).map((s): Obstacle => {
      const inward = s.x < 0 ? 1 : -1;
      const xa = s.x - inward * SLOT_BACK;
      const xb = s.x + inward * SLOT_FRONT;
      return { kind: 'box', id: `slot-${s.id}`, x0: Math.min(xa, xb), z0: s.z - SLOT_HALF_W - 0.01, x1: Math.max(xa, xb), z1: s.z + SLOT_HALF_W + 0.01, h: 2.4 };
    }),
  ];

  return {
    spec,
    bounds,
    aisle,
    zones,
    columns,
    tables,
    seats,
    slots,
    obstacles,
    spawn: { x: 0, z: length / 2 - 2, heading: 0 },
    entrance: { x0: -aisleWidth / 2, x1: aisleWidth / 2, z: length / 2 },
  };
}

/** Does an obstacle's footprint overlap an axis-aligned X/Z rectangle? */
export function obstacleOverlaps(o: Obstacle, r: { x0: number; x1: number; z0: number; z1: number }): boolean {
  if (o.kind === 'box') return o.x0 < r.x1 && o.x1 > r.x0 && o.z0 < r.z1 && o.z1 > r.z0;
  const dx = Math.max(r.x0 - o.x, 0, o.x - r.x1);
  const dz = Math.max(r.z0 - o.z, 0, o.z - r.z1);
  return Math.hypot(dx, dz) < o.r;
}

/**
 * Where the follow camera may go in the hall: inside the walls and below the coffer beams (whose
 * undersides hang 0.32 m below the ceiling height).
 */
export function hallCameraClamp(l: GrandHallLayout, margin = 0.35): { x0: number; x1: number; z0: number; z1: number; y1: number } {
  return { x0: l.bounds.x0 + margin, x1: l.bounds.x1 - margin, z0: l.bounds.z0 + margin, z1: l.bounds.z1 - margin, y1: l.spec.height - 0.32 - margin };
}

// ------------------------------------------------------------------ the floor's layout (VA-0069)

/** The preview's hall: the art's default size, plus a row of the 10 machines on the far end wall. */
export const GRAND_SPEC: Partial<GrandHallSpec> & { backRow: number } = { ...GRAND_HALL_DEFAULTS, backRow: 10 };

/** Where the grand hall starts you (Floor3DScene uses it for a fresh visit). */
export const GRAND_SPAWN = grandHallLayout(GRAND_SPEC).spawn;

/**
 * The grand hall as the floor's layout: everything gameplay needs comes from the one
 * grandHallLayout() above, so the art (createGrandHallArchitecture, same spec) and the collision
 * agree.
 * - All four tables are live: each seat opens blackjack. The first table is the "table" the
 *   floor's label and dealer code knew; the others' dealers are listed in `decor`.
 * - The end-wall row holds one interactive machine per theme (reels, spin button, marquee).
 *   The side banks are decorative copies, themes in turn.
 */
export function grandFloorLayout(): FloorLayout {
  const l = grandHallLayout(GRAND_SPEC);
  const themes = CASINO_WORLD.slots.map((s: { id: string }) => s.id);
  const end = l.slots.filter((s) => s.id.startsWith('end-'));
  const side = l.slots.filter((s) => !s.id.startsWith('end-'));
  const slots: SlotPlacement[] = end.map((s, i) => ({ id: themes[i % themes.length], x: s.x, z: s.z, rotationY: s.rotationY }));
  const decorSlots: SlotPlacement[] = side.map((s, i) => ({ id: themes[i % themes.length], x: s.x, z: s.z, rotationY: s.rotationY }));
  const [first, ...others] = l.tables;
  const dealerOf = (t: { x: number; z: number }) => ({ x: t.x + BLACKJACK_HERO_ANCHORS.dealer[0], z: t.z + BLACKJACK_HERO_ANCHORS.dealer[1] });
  const { height, length } = l.spec;
  return {
    hall: 'grand',
    // the follow camera stays under the coffer beams (hallCameraClamp): the room's height is theirs
    room: { ...l.bounds, wallHeight: height - 0.32 },
    table: { ...TABLE, x: first.x, z: first.z },
    seats: l.seats,
    dealer: dealerOf(first),
    spawn: l.spawn,
    slots,
    obstacles: l.obstacles,
    // under the art's two ring chandeliers
    lamps: [-length / 4, length / 4].map((z) => ({ x: 0, y: height - 1.6, z })),
    decor: { tables: others.map((t) => ({ x: t.x, z: t.z })), slots: decorSlots, dealers: others.map(dealerOf) },
    hallSpec: l.spec,
  };
}

export function layoutFor(hall: Hall, pilot05: boolean, blackjackHero: boolean): FloorLayout {
  return hall === 'grand' ? grandFloorLayout() : salonLayout(pilot05, blackjackHero);
}
