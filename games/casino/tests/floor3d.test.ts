import { describe, expect, it } from 'vitest';
import { AVATAR_FADE_MIN, LIMITS, overviewLift, LOOK_UP_MAX, avatarOpacity, blendPose, overviewFov, clampZoom, cutawayWalls, desiredPose, FOCUS, setOverviewSides, machineFocus, PROP_FADE_MIN, propOpacity, turnToward } from '../src/floor3d/camera.ts';
import { AGENT_RADIUS, BLACKJACK_HERO_ANCHORS, DEALER_SPOT, dealerSpotFor, OBSTACLES, ROOM, SALON_ROOM, SEATS, seatsFor, SLOTS, SPAWN, TABLE } from '../src/floor3d/layout.ts';
import { CASINO_WORLD } from '../../../art/casino/3d/worldComposition.mjs';
import { NavGrid } from '../src/floor3d/nav.ts';

const nav = new NavGrid();
const len = (from: { x: number; z: number }, path: { x: number; z: number }[]) => {
  let d = 0;
  let a = from;
  for (const p of path) {
    d += Math.hypot(p.x - a.x, p.z - a.z);
    a = p;
  }
  return d;
};

describe('3D floor layout', () => {
  it('spawn and every seat approach point are walkable', () => {
    expect(nav.walkableAt(SPAWN)).toBe(true);
    for (const s of SEATS) expect(nav.walkableAt(s.approach), s.id).toBe(true);
  });
  it('seated players face the table', () => {
    for (const s of SEATS) {
      // heading h faces (sin h, -cos h)
      const fx = Math.sin(s.facing);
      const fz = -Math.cos(s.facing);
      const tx = TABLE.x - s.x;
      const tz = TABLE.z - s.z;
      expect((fx * tx + fz * tz) / Math.hypot(tx, tz)).toBeGreaterThan(0.99);
    }
  });
  it('takes its seats, table, spawn and slots from ChatGPT’s art composition', () => {
    expect(SEATS.map((s) => [s.id, s.x, s.z])).toEqual(CASINO_WORLD.seats.map((s) => [s.id, s.x, s.z]));
    expect([TABLE.x, TABLE.z]).toEqual([CASINO_WORLD.blackjack.x, CASINO_WORLD.blackjack.z]);
    expect([SPAWN.x, SPAWN.z]).toEqual([CASINO_WORLD.spawn.x, CASINO_WORLD.spawn.z]);
    expect(SLOTS).toHaveLength(10);
    // the room fits on the art's 18 x 16 m floor
    expect(ROOM.x1 - ROOM.x0).toBeLessThanOrEqual(CASINO_WORLD.lobbyWidth);
    expect(ROOM.z1 - ROOM.z0).toBeLessThanOrEqual(CASINO_WORLD.lobbyDepth);
  });
  it('every slot cabinet can be walked up to', () => {
    // art pass 02 had benches across four cabinet fronts; pass 03 moved them to the entrance
    for (const s of SLOTS) {
      const front = { x: s.x + (s.x < 0 ? 1 : -1) * 1.0, z: s.z };
      expect(nav.walkableAt(front), s.id).toBe(true);
      const path = nav.findPath(SPAWN, front);
      expect(path, s.id).not.toBeNull();
      const end = path!.at(-1)!;
      expect(Math.hypot(end.x - front.x, end.z - front.z), s.id).toBeLessThan(1e-6);
    }
  });
  it('both blackjack chairs can be reached from the spawn', () => {
    for (const s of SEATS) {
      const end = nav.findPath(SPAWN, s.approach)!.at(-1)!;
      expect(Math.hypot(end.x - s.approach.x, end.z - s.approach.z), s.id).toBeLessThan(1e-6);
    }
  });
  it('the entrance wings block walking, the arch between them does not', () => {
    expect(nav.pointFree({ x: -7, z: 7.5 })).toBe(false);
    expect(nav.pointFree({ x: 7, z: 7.5 })).toBe(false);
    expect(nav.pointFree({ x: 0, z: 7.4 })).toBe(true);
  });
  it('the lounge planters (art pass 04) block walking', () => {
    for (const x of [-6.75, 6.75]) expect(nav.pointFree({ x, z: 6.26 })).toBe(false);
    expect(nav.walkableAt(SPAWN)).toBe(true);
  });
  it('has one free and one taken seat for stage 1', () => {
    expect(SEATS.filter((s) => !s.taken)).toHaveLength(1);
    expect(SEATS.filter((s) => s.taken)).toHaveLength(1);
  });
});

describe('walking', () => {
  it('finds a path from the spawn to every free seat, and it never touches an obstacle', () => {
    for (const s of SEATS) {
      const path = nav.findPath(SPAWN, s.approach)!;
      expect(path, s.id).not.toBeNull();
      const end = path[path.length - 1];
      expect(Math.hypot(end.x - s.approach.x, end.z - s.approach.z)).toBeLessThan(1e-6);
      let a = { x: SPAWN.x, z: SPAWN.z };
      for (const p of path) {
        expect(nav.lineClear(a, p)).toBe(true);
        a = p;
      }
    }
  });
  it('walks around the table instead of through it', () => {
    const from = { x: 0, z: 0.4 }; // in front of the table
    const to = { x: 0, z: -6.8 }; // behind the dealer's area
    const path = nav.findPath(from, to)!;
    expect(path.length).toBeGreaterThan(1);
    expect(len(from, path)).toBeGreaterThan(6);
  });
  it('a tap on an obstacle walks to the nearest free spot', () => {
    const path = nav.findPath(SPAWN, { x: -7.5, z: 1.2 })!; // a west column's centre
    const end = path[path.length - 1];
    expect(nav.pointFree(end)).toBe(true);
    expect(Math.hypot(end.x + 7.5, end.z - 1.2)).toBeLessThan(0.43 + AGENT_RADIUS + 0.35);
  });
  it('a tap outside the room ends inside it', () => {
    const end = nav.findPath(SPAWN, { x: 30, z: 30 })!.at(-1)!;
    expect(end.x).toBeLessThan(ROOM.x1);
    expect(end.z).toBeLessThan(ROOM.z1);
  });
  it('joystick walking glides round a chair instead of stopping dead against it', () => {
    const chair = OBSTACLES.find((o) => o.id === 'blackjack_1-chair')!;
    if (chair.kind !== 'circle') throw new Error('chair is a circle');
    const R = chair.r + AGENT_RADIUS;
    // touching the chair on its open side, pushing into it at an angle: both axis-only moves
    // are blocked, so this used to stop dead
    const start = { x: chair.x - (R + 0.01) * Math.SQRT1_2, z: chair.z + (R + 0.01) * Math.SQRT1_2 };
    let p = start;
    for (let i = 0; i < 20; i++) p = nav.slide(p, 0.05 * Math.cos(-0.4), 0.05 * Math.sin(-0.4));
    expect(Math.hypot(p.x - start.x, p.z - start.z)).toBeGreaterThan(0.3);
    expect(nav.pointFree(p)).toBe(true);
  });
  it('joystick walking slides along walls and never enters obstacles', () => {
    let p = { x: ROOM.x1 - 1, z: 2 };
    for (let i = 0; i < 100; i++) p = nav.slide(p, 0.1, 0.05);
    expect(p.x).toBeLessThanOrEqual(ROOM.x1 - AGENT_RADIUS);
    expect(p.z).toBeGreaterThan(2); // slid along the wall instead of stopping
    let q = { x: -7.5, z: 4 };
    for (let i = 0; i < 100; i++) q = nav.slide(q, 0, -0.05); // straight at a column
    expect(nav.pointFree(q)).toBe(true);
    expect(OBSTACLES.some((o) => o.kind === 'circle' && Math.hypot(q.x - o.x, q.z - o.z) < o.r)).toBe(false);
  });
});

describe('cameras', () => {
  it('the follow camera sits behind the avatar and inside the walls', () => {
    const pose = desiredPose('follow', { x: 0, z: 0 }, 0, 4);
    expect(pose.pos.z).toBeGreaterThan(0); // facing -Z, so the camera is at +Z
    const nearWall = desiredPose('follow', { x: 0, z: ROOM.z1 - 0.5 }, 0, 7);
    expect(nearWall.pos.z).toBeLessThan(ROOM.z1);
    expect(nearWall.pos.y).toBeLessThan(ROOM.wallHeight);
  });
  it('the follow camera stops short of an obstacle', () => {
    const pose = desiredPose('follow', { x: 0, z: 0 }, 0, 6, { obstacleDist: 2 });
    const d = Math.hypot(pose.pos.x - pose.target.x, pose.pos.y - pose.target.y, pose.pos.z - pose.target.z);
    expect(d).toBeLessThanOrEqual(1.8 + 1e-9);
  });
  it('the overview looks down from above and cuts away the walls it looks through', () => {
    const pose = desiredPose('overview', { x: 0, z: 0 }, 0, LIMITS.overview.initial);
    expect(pose.pos.y).toBeGreaterThan(8);
    const cut = cutawayWalls(pose.pos);
    expect(cut.size).toBeGreaterThan(0);
    expect(cut.has('north')).toBe(false);
  });
  it('the follow camera can tilt up to look over low furniture, within a limit', () => {
    const flat = desiredPose('follow', { x: 0, z: 0 }, 0, 4);
    const tilted = desiredPose('follow', { x: 0, z: 0 }, 0, 4, { extraPitch: (30 * Math.PI) / 180 });
    expect(tilted.pos.y).toBeGreaterThan(flat.pos.y + 1);
    const max = desiredPose('follow', { x: 0, z: 0 }, 0, 4, { extraPitch: 10 });
    const pitch = Math.asin((max.pos.y - max.target.y) / 4);
    expect(pitch).toBeLessThanOrEqual((70 * Math.PI) / 180 + 1e-9);
  });
  it('a vertical drag tilts the follow view up at the ceiling, keeping the avatar ahead and the camera off the floor', () => {
    const avatar = { x: 0, z: 0 };
    const level = desiredPose('follow', avatar, 0, 4.2);
    const up = desiredPose('follow', avatar, 0, 4.2, { lookUp: LOOK_UP_MAX });
    const aim = (p: typeof level) => Math.atan2(p.target.y - p.pos.y, Math.hypot(p.target.x - p.pos.x, p.target.z - p.pos.z));
    expect(aim(level)).toBeLessThan(0); // looks down at the avatar
    expect(aim(up)).toBeGreaterThan(0); // looks up past it
    expect(up.pos.y).toBeGreaterThanOrEqual(0.45);
    expect(up.pos.z).toBeGreaterThan(avatar.z); // still behind the avatar (heading 0 walks to -Z)
    const over = desiredPose('follow', avatar, 0, 4.2, { lookUp: 5 });
    expect(over).toEqual(up); // clamped to LOOK_UP_MAX
  });
  /** Pinhole projection of a world point into screen pixels from the top (matches debug.screenOf to the pixel). */
  const screenRow = (p: ReturnType<typeof desiredPose>, pt: { x: number; y: number; z: number }, h: number): number => {
    const f = { x: p.target.x - p.pos.x, y: p.target.y - p.pos.y, z: p.target.z - p.pos.z };
    const fl = Math.hypot(f.x, f.y, f.z);
    const fw = { x: f.x / fl, y: f.y / fl, z: f.z / fl };
    const r0 = { x: -fw.z, y: 0, z: fw.x }; // forward × up
    const rl = Math.hypot(r0.x, r0.z);
    const rt = { x: r0.x / rl, y: 0, z: r0.z / rl };
    const up = { x: rt.y * fw.z - rt.z * fw.y, y: rt.z * fw.x - rt.x * fw.z, z: rt.x * fw.y - rt.y * fw.x };
    const v = { x: pt.x - p.pos.x, y: pt.y - p.pos.y, z: pt.z - p.pos.z };
    const depth = v.x * fw.x + v.y * fw.y + v.z * fw.z;
    const ndcY = (v.x * up.x + v.y * up.y + v.z * up.z) / depth / Math.tan(((p.fov / 2) * Math.PI) / 180);
    return ((1 - ndcY) / 2) * h;
  };
  it('landscape follow from the spawn shows a real band of ceiling and still the avatar\'s feet (VA-0107)', () => {
    for (const [w, h] of [[915, 412], [844, 390]]) {
      const avatar = SPAWN;
      const p = desiredPose('follow', avatar, 0, LIMITS.follow.initial, { aspect: w / h });
      // where the ceiling meets the back wall, straight ahead: everything above it is ceiling
      const ceilingEdge = screenRow(p, { x: p.pos.x, y: SALON_ROOM.wallHeight, z: SALON_ROOM.z0 }, h);
      expect(ceilingEdge / h).toBeGreaterThan(0.095); // was 0.06 (~25 px of 412) at 9° pitch, no drop
      const feet = screenRow(p, { x: avatar.x, y: 0, z: avatar.z }, h);
      expect(feet).toBeLessThan(h - 24); // above the bottom "PROTOTYPE" label
    }
  });
  it('the landscape follow view sits lower than portrait, so more of the ceiling shows', () => {
    const portrait = desiredPose('follow', { x: 0, z: 0 }, 0, 4.2, { aspect: 0.46 });
    const landscape = desiredPose('follow', { x: 0, z: 0 }, 0, 4.2, { aspect: 2.17 });
    expect(landscape.pos.y).toBeLessThan(portrait.pos.y);
  });
  it('portrait follow keeps the avatar\'s feet above the joystick ring on 360×780 and 384×832 (VA-0098)', () => {
    for (const [w, h] of [[360, 780], [384, 832], [412, 915]]) {
      const p = desiredPose('follow', { x: 0, z: 0 }, 0, LIMITS.follow.initial, { aspect: w / h });
      const feetY = screenRow(p, { x: 0, y: 0, z: 0 }, h);
      const joyTop = h - 40 - 136; // .joy: bottom 40 px, 132 px + 2 px border each side
      expect(feetY).toBeLessThan(joyTop - 8);
    }
  });
  it('the follow view sits over the right shoulder, so the avatar is off-centre, wider in landscape', () => {
    const avatar = { x: 0, z: 0 };
    for (const heading of [0, Math.PI / 2, 2.4]) {
      const right = { x: Math.cos(heading), z: Math.sin(heading) };
      const side = (p: { x: number; z: number }) => (p.x - avatar.x) * right.x + (p.z - avatar.z) * right.z;
      const portrait = desiredPose('follow', avatar, heading, 4.2, { aspect: 0.46 });
      const landscape = desiredPose('follow', avatar, heading, 4.2, { aspect: 2.17 });
      expect(side(portrait.pos)).toBeCloseTo(side(portrait.target));
      expect(side(portrait.pos)).toBeGreaterThan(0.2);
      expect(side(landscape.pos)).toBeGreaterThan(side(portrait.pos));
    }
  });
  it('the avatar fades as the follow camera closes in, and is solid at normal range', () => {
    expect(avatarOpacity(4)).toBe(1);
    expect(avatarOpacity(Infinity)).toBe(1);
    expect(avatarOpacity(1)).toBeLessThan(1);
    expect(avatarOpacity(1)).toBeGreaterThan(AVATAR_FADE_MIN);
    expect(avatarOpacity(0.2)).toBe(AVATAR_FADE_MIN);
    const d = (p: ReturnType<typeof desiredPose>) => Math.hypot(p.pos.x, p.pos.y - 0.85, p.pos.z);
    expect(avatarOpacity(d(desiredPose('follow', { x: 0, z: 0 }, 0, 4.2, { aspect: 0.46 })))).toBe(1);
  });
  it('switching views blends smoothly from one pose to the other', () => {
    const a = desiredPose('follow', { x: 0, z: 0 }, 0, 4);
    const b = desiredPose('overview', { x: 0, z: 0 }, 0, 14);
    expect(blendPose(a, b, 0)).toEqual(a);
    expect(blendPose(a, b, 1)).toEqual(b);
    const mid = blendPose(a, b, 0.5);
    expect(mid.pos.y).toBeGreaterThan(a.pos.y);
    expect(mid.pos.y).toBeLessThan(b.pos.y);
  });
  it('the overview widens on tall screens so it still sees across the room', () => {
    const tall = overviewFov(384 / 832);
    const hFov = (2 * Math.atan(Math.tan((tall * Math.PI) / 360) * (384 / 832)) * 180) / Math.PI;
    expect(hFov).toBeGreaterThan(41);
    expect(overviewFov(16 / 9)).toBe(50);
    expect(desiredPose('overview', { x: 0, z: 0 }, 0, 14, { pan: { x: -3, z: 0 } }).target.x).toBe(-3);
  });
  it('the portrait overview aims ahead so the avatar sits low and the room fills the bottom (VA-0056)', () => {
    // vertical angle (radians) of a point below the camera's view axis
    const below = (pose: ReturnType<typeof desiredPose>, p: { x: number; y: number; z: number }) => {
      const d = { x: pose.target.x - pose.pos.x, y: pose.target.y - pose.pos.y, z: pose.target.z - pose.pos.z };
      const v = { x: p.x - pose.pos.x, y: p.y - pose.pos.y, z: p.z - pose.pos.z };
      const pitch = (o: typeof d) => Math.atan2(-o.y, Math.hypot(o.x, o.z));
      return pitch(v) - pitch(d);
    };
    const avatar = { x: 0, z: 0 };
    const aspect = 384 / 832;
    const tall = desiredPose('overview', avatar, 0, LIMITS.overview.initial, { aspect });
    const ndc = Math.tan(below(tall, { x: 0, y: 0, z: 0 })) / Math.tan((tall.fov * Math.PI) / 360);
    expect(ndc).toBeGreaterThan(0.3);
    expect(ndc).toBeLessThan(0.5);
    // the aim moved toward the back of the room (forward is north-west)
    expect(tall.target.z).toBeLessThan(0);
    expect(tall.target.x).toBeLessThan(0);
    // from the spawn, the bottom edge of the screen meets the floor within 1 m of the room's
    // entrance edge (it used to look ~5.4 m past it, into the dark outside the room)
    const bottomEdge = (p: ReturnType<typeof desiredPose>) => {
      const dx = p.target.x - p.pos.x;
      const dz = p.target.z - p.pos.z;
      const hl = Math.hypot(dx, dz);
      const s = p.pos.y / Math.tan(Math.atan2(p.pos.y, hl) + (p.fov * Math.PI) / 360);
      return { x: p.pos.x + (dx / hl) * s, z: p.pos.z + (dz / hl) * s };
    };
    const atSpawn = desiredPose('overview', SPAWN, 0, LIMITS.overview.initial, { aspect });
    expect(bottomEdge(atSpawn).z).toBeLessThan(ROOM.z1 + 1);
    expect(overviewLift(LIMITS.overview.initial, 50)).toBe(0);
    expect(desiredPose('overview', avatar, 0, 14, { aspect: 16 / 9 }).target).toEqual({ x: 0, y: 0, z: 0 });
    // never aims outside the room's 3 m margin, wherever the avatar stands
    const back = desiredPose('overview', { x: -8, z: -7 }, 0, LIMITS.overview.max, { aspect });
    expect(back.target.x).toBeGreaterThanOrEqual(ROOM.x0 + 3);
    expect(back.target.z).toBeGreaterThanOrEqual(ROOM.z0 + 3);
  });
  it('walking up to a slot frames its screen beside the avatar instead of behind it (VA-0043)', () => {
    const hero = SLOTS.find((s) => s.id === 'sevens')!;
    // the hero faces +X; stand 1.5 m in front of its screen, facing it (heading -PI/2 walks to -X)
    const avatar = { x: hero.x + FOCUS.faceOffset + 1.5, z: hero.z };
    const heading = -Math.PI / 2;
    const f = machineFocus(avatar, heading, SLOTS)!;
    expect(f.id).toBe('sevens');
    expect(f.weight).toBe(1);
    // how far the avatar's middle sits from the camera's line of sight to the machine screen
    const offLine = (p: ReturnType<typeof desiredPose>) => {
      const a = { x: avatar.x - p.pos.x, y: 0.9 - p.pos.y, z: avatar.z - p.pos.z };
      const v = { x: f.point.x - p.pos.x, y: f.point.y - p.pos.y, z: f.point.z - p.pos.z };
      const vl = Math.hypot(v.x, v.y, v.z);
      const t = (a.x * v.x + a.y * v.y + a.z * v.z) / vl;
      return Math.sqrt(Math.max(0, a.x * a.x + a.y * a.y + a.z * a.z - t * t));
    };
    for (const aspect of [0.46, 2.17]) {
      const plain = desiredPose('follow', avatar, heading, 4.2, { aspect });
      const framed = desiredPose('follow', avatar, heading, 4.2, { aspect, focus: f });
      expect(offLine(framed)).toBeGreaterThan(0.6); // avatar clear of the screen (body radius ~0.3)
      expect(offLine(framed)).toBeGreaterThan(offLine(plain) + 0.2);
      expect(framed.target.y).toBeCloseTo(FOCUS.screenY);
      expect(Math.hypot(framed.pos.x - framed.target.x, framed.pos.z - framed.target.z)).toBeLessThan(FOCUS.dist + 1e-9);
      // the camera stays in front of the machine, on the avatar's right, inside the room
      expect(framed.pos.x).toBeGreaterThan(avatar.x);
      expect(framed.pos.z).toBeLessThan(avatar.z); // right of a -X walker is -Z
      expect(framed.pos.z).toBeGreaterThan(ROOM.z0);
    }
  });
  it('machine framing fades with distance and angle, and ignores the backs of machines', () => {
    const hero = SLOTS.find((s) => s.id === 'sevens')!;
    const front = hero.x + FOCUS.faceOffset;
    const at = (dx: number, heading: number) => machineFocus({ x: front + dx, z: hero.z }, heading, SLOTS);
    const w2 = at(2.2, -Math.PI / 2)!.weight;
    expect(w2).toBeGreaterThan(0);
    expect(w2).toBeLessThan(1);
    expect(at(3, -Math.PI / 2)).toBeNull(); // too far
    expect(at(1.5, Math.PI / 2)).toBeNull(); // facing away
    expect(at(1.5, 0)).toBeNull(); // looking along the row, 90 degrees off
    expect(machineFocus({ x: hero.x - 1, z: hero.z }, Math.PI / 2, SLOTS)).toBeNull(); // behind it
    // between two machines it picks the one ahead
    expect(machineFocus({ x: front + 1.5, z: hero.z + 0.3 }, -Math.PI / 2, SLOTS)!.id).toBe('sevens');
    // no focus: the follow pose is exactly as before
    expect(desiredPose('follow', { x: 0, z: 0 }, 0, 4.2, { focus: undefined })).toEqual(desiredPose('follow', { x: 0, z: 0 }, 0, 4.2));
  });
  it('the framed machine\'s chair fades with the framing weight (VA-0045)', () => {
    expect(propOpacity(0)).toBe(1);
    expect(propOpacity(NaN)).toBe(1);
    expect(propOpacity(0.5)).toBeGreaterThan(PROP_FADE_MIN);
    expect(propOpacity(0.5)).toBeLessThan(1);
    expect(propOpacity(1)).toBeCloseTo(PROP_FADE_MIN);
    expect(propOpacity(3)).toBeCloseTo(PROP_FADE_MIN);
  });
  it('zoom stays within limits', () => {
    expect(clampZoom('follow', 100)).toBe(LIMITS.follow.max);
    expect(clampZoom('overview', 0)).toBe(LIMITS.overview.min);
  });
  it('turns the short way round', () => {
    expect(turnToward(3, -3, 0.1)).toBeCloseTo(3.1);
    expect(turnToward(0, 0.05, 0.1)).toBe(0.05);
  });
});

describe('woven carpet preview (VA-0058, opt-in)', () => {
  // a do-nothing 2D context: the art draws its texture into it, which needs no browser here
  const stubCanvas = () => {
    const ctx = new Proxy({} as Record<string, unknown>, { get: (t, k) => (k in t ? t[k as string] : () => {}), set: (t, k, v) => ((t[k as string] = v), true) });
    return { width: 0, height: 0, getContext: () => ctx };
  };
  it('takes the pilot carpet’s place, footprint and height, at no extra batch, and is off by default', async () => {
    const THREE = await import('three');
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    const canvas = stubCanvas();
    const off = buildArtScene(new Map(), { pilot05: true });
    const on = buildArtScene(new Map(), { pilot05: true, wovenCarpet: true, carpetCanvas: canvas });
    expect(off.wovenCarpet).toBe(false);
    expect(on.wovenCarpet).toBe(true);
    // without the pilot there is no pilot carpet to replace; without a canvas it stays off
    expect(buildArtScene(new Map(), { pilot05: false, wovenCarpet: true, carpetCanvas: canvas }).wovenCarpet).toBe(false);
    expect(buildArtScene(new Map(), { pilot05: true, wovenCarpet: true }).wovenCarpet).toBe(false);
    expect(on.batches).toBe(off.batches);
    const carpets: InstanceType<typeof THREE.Mesh>[] = [];
    on.root.traverse((o) => {
      const m = o as InstanceType<typeof THREE.Mesh>;
      if (m.isMesh && (m.material as InstanceType<typeof THREE.MeshStandardMaterial>).map?.image === canvas) carpets.push(m);
    });
    expect(carpets).toHaveLength(1);
    carpets[0].geometry.computeBoundingBox();
    const b = carpets[0].geometry.boundingBox!;
    expect(b.max.x - b.min.x).toBeCloseTo(17.2, 3);
    expect(b.max.z - b.min.z).toBeCloseTo(14.7, 3);
    expect((b.max.z + b.min.z) / 2).toBeCloseTo(-0.12, 3);
    expect(b.min.y).toBeCloseTo(0.024, 4);
    expect(b.max.y).toBeCloseTo(0.024, 4);
    // the pilot carpet itself is gone, so nothing else lies flat at its height across the room
    let wide = 0;
    on.root.traverse((o) => {
      const m = o as InstanceType<typeof THREE.Mesh>;
      if (!m.isMesh || m === carpets[0]) return;
      const pos = m.geometry.attributes.position;
      let n = 0;
      for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getY(i) - 0.024) < 1e-4 && Math.abs(pos.getX(i)) > 8.5) n++;
      wide += n;
    });
    expect(wide).toBe(0);
  });
});

describe('blackjack hero table (VA-0054, opt-in)', () => {
  it('replaces the round table art in place, expands its instanced chips, and leaves it off by default', async () => {
    const THREE = await import('three');
    const { buildArtScene, bakedPieces } = await import('../src/floor3d/artScene.ts');
    const off = buildArtScene(new Map(), { pilot05: true });
    const on = buildArtScene(new Map(), { pilot05: true, blackjackHero: true });
    expect(off.blackjackHero).toBe(false);
    expect(on.blackjackHero).toBe(true);
    expect(buildArtScene(new Map(), { pilot05: false, blackjackHero: true }).blackjackHero).toBe(true);
    // the table is centred where the round one was: the batched geometry's rail-height slice
    // around the table spans the padded rail's 1.9 m half-width along X
    const box = new THREE.Box3();
    const p = new THREE.Vector3();
    on.root.traverse((o) => {
      const m = o as InstanceType<typeof THREE.Mesh>;
      if (!m.isMesh) return;
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i);
        if (p.y > 1.12 && p.y < 1.2 && Math.abs(p.x - TABLE.x) < 2.2 && Math.abs(p.z - TABLE.z) < 1.4) box.expandByPoint(p);
      }
    });
    expect(box.min.x).toBeCloseTo(TABLE.x - 1.896, 2);
    expect(box.max.x).toBeCloseTo(TABLE.x + 1.896, 2);
    // instanced chips become one piece per chip, each at its own matrix
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 0.01, 8);
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial(), 3);
    for (let i = 0; i < 3; i++) inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i, 2, 0));
    inst.position.set(10, 0, 0);
    inst.updateMatrixWorld(true);
    const pieces = bakedPieces(inst);
    expect(pieces.length).toBe(3);
    pieces.forEach((g, i) => {
      g.computeBoundingBox();
      const c = g.boundingBox!.getCenter(new THREE.Vector3());
      expect(c.x).toBeCloseTo(10 + i, 5);
      expect(c.y).toBeCloseTo(2, 5);
    });
  });

  it('blocks the hero table\'s wider ends but keeps both seats and the dealer reachable', async () => {
    const { obstaclesFor } = await import('../src/floor3d/layout.ts');
    const roundNav = new NavGrid(ROOM, obstaclesFor(true));
    const heroNav = new NavGrid(ROOM, obstaclesFor(true, true));
    // an avatar 2.0 m from the centre clears the round table (1.57 + 0.3) but would overlap the
    // hero's rail ends (1.9 m)
    for (const sx of [-1, 1]) {
      const end = { x: TABLE.x + sx * 2.0, z: TABLE.z };
      expect(roundNav.pointFree(end)).toBe(true);
      expect(heroNav.pointFree(end)).toBe(false);
    }
    for (const s of seatsFor(true)) {
      expect(heroNav.walkableAt(s.approach)).toBe(true);
      const end = heroNav.findPath(SPAWN, s.approach)!.at(-1)!;
      expect(Math.hypot(end.x - s.approach.x, end.z - s.approach.z)).toBeLessThan(1e-6);
    }
  });

  it('moves the seats, chairs and dealer to the hero table\'s own anchors (VA-0056)', async () => {
    const THREE = await import('three');
    const { makeVelvetBlackjackHero } = await import('../../../art/casino/3d/blackjackHero.mjs');
    const { obstaclesFor } = await import('../src/floor3d/layout.ts');
    const a = (makeVelvetBlackjackHero(THREE) as InstanceType<typeof THREE.Group>).userData.anchors;
    // layout.ts mirrors the art's anchors (table-local metres, x and z)
    for (const g of a.guestSeats) {
      const id = g.id === 'left' ? 'blackjack_1' : 'blackjack_2';
      expect(BLACKJACK_HERO_ANCHORS.seats[id].position).toEqual([g.position[0], g.position[2]]);
      expect(BLACKJACK_HERO_ANCHORS.seats[id].approach).toEqual([g.approach[0], g.approach[2]]);
    }
    expect(BLACKJACK_HERO_ANCHORS.dealer).toEqual([a.dealer.position[0], a.dealer.position[2]]);
    // off by default; on, the same seats (ids, order, taken) move and still face the table centre
    expect(seatsFor(false)).toBe(SEATS);
    expect(dealerSpotFor(false)).toEqual(DEALER_SPOT);
    const hero = seatsFor(true);
    expect(hero.map((s) => [s.id, s.taken])).toEqual(SEATS.map((s) => [s.id, s.taken]));
    expect(hero[0].x).toBeCloseTo(TABLE.x - 1.12, 6);
    expect(hero[0].z).toBeCloseTo(TABLE.z + 1.53, 6);
    expect(dealerSpotFor(true)).toEqual({ x: TABLE.x, z: TABLE.z - 1.8 });
    const obs = obstaclesFor(true, true);
    const heroNav = new NavGrid(ROOM, obs);
    for (const s of hero) {
      const toCentre = { x: TABLE.x - s.x, z: TABLE.z - s.z };
      expect(Math.sin(s.facing) * toCentre.x - Math.cos(s.facing) * toCentre.z).toBeCloseTo(Math.hypot(toCentre.x, toCentre.z), 6);
      // the chair's collision circle follows it
      const chair = obs.find((o) => o.id === `${s.id}-chair`)!;
      expect(chair).toMatchObject({ x: s.x, z: s.z });
      // and its approach is walkable, clear of the chair and the table
      expect(heroNav.walkableAt(s.approach)).toBe(true);
    }
  });
});

describe('art pass 05 pilot', () => {
  it('swaps in the hero cabinet with its 25 reel cells, the new ceiling and carpet, and drops the old chandeliers', async () => {
    const THREE = await import('three');
    const { buildArtScene, PILOT_HERO_SLOT } = await import('../src/floor3d/artScene.ts');
    const a = buildArtScene(new Map(), { pilot05: true });
    const reels = a.interactive.get(`slot_${PILOT_HERO_SLOT}/reels`)!;
    expect(reels.geometry.groups.length).toBe(25);
    expect(a.interactive.has(`slot_${PILOT_HERO_SLOT}/spin_button`)).toBe(true);
    const names: string[] = [];
    a.root.traverse((o) => { if ((o as InstanceType<typeof THREE.Mesh>).isMesh) names.push(o.name); });
    expect(a.ceiling.roof.length).toBeGreaterThan(0);
    expect(a.ceiling.fixtures.length).toBeGreaterThan(0);
    // (the hero's marquee is a canvas texture, so it only exists in a browser; e2e checks all 30 parts)
    expect(a.interactive.size).toBe(29);
    expect(a.batches).toBeLessThanOrEqual(85);
  });

  it('draws the walls\' and ceiling\'s shared materials once each in the uncut view, with the same triangles (VA-0052)', async () => {
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    for (const pilot05 of [true, false]) {
      const a = buildArtScene(new Map(), { pilot05 });
      const { combined, replaced } = a.whole;
      expect(combined.length).toBeGreaterThan(0);
      // fewer batches to draw, hidden until the eye-level view shows them
      expect(combined.length).toBeLessThan(replaced.length);
      expect(combined.every((m) => !m.visible && m.parent === a.root)).toBe(true);
      const tris = (ms: typeof combined) => ms.reduce((n, m) => n + m.geometry.attributes.position.count / 3, 0);
      expect(tris(combined)).toBe(tris(replaced));
      // only room batches: never the interactive slot parts, the fading chair or the exterior
      const kept = new Set<unknown>([...a.interactive.values(), ...[...a.fadeable.values()].flat(), ...a.exterior]);
      expect(replaced.some((m) => kept.has(m))).toBe(false);
      // every wall and ceiling part folded in is one the cutaway toggles
      const sided = new Set<unknown>([...Object.values(a.walls), ...Object.values(a.ceiling)].flat());
      expect(replaced.some((m) => sided.has(m))).toBe(true);
    }
  });

  it('batches the pilot chair apart, on its own materials, so it can fade without touching anything else (VA-0045)', async () => {
    const THREE = await import('three');
    const { buildArtScene, PILOT_HERO_SLOT } = await import('../src/floor3d/artScene.ts');
    const a = buildArtScene(new Map(), { pilot05: true });
    const chair = a.fadeable.get(PILOT_HERO_SLOT)!;
    expect(chair.length).toBeGreaterThan(0);
    const chairMats = new Set(chair.map((m) => m.material));
    let shared = 0;
    let tris = 0;
    a.root.traverse((o) => {
      const m = o as InstanceType<typeof THREE.Mesh>;
      if (m.isMesh && !chair.includes(m) && chairMats.has(m.material as never)) shared++;
    });
    for (const m of chair) tris += m.geometry.attributes.position.count / 3;
    expect(shared).toBe(0);
    expect(tris).toBeGreaterThan(50);
    expect(buildArtScene(new Map(), { pilot05: false }).fadeable.size).toBe(0);
  });

  it('keeps the art\'s glow tags through batching and the hero\'s stacked topper clears the ceiling fixtures (VA-0042)', async () => {
    const THREE = await import('three');
    const { buildArtScene, PILOT_HERO_SLOT } = await import('../src/floor3d/artScene.ts');
    const { makeVelvetHeroCabinet } = await import('../../../art/casino/3d/heroSlotCabinet.mjs');
    const hero = makeVelvetHeroCabinet(THREE, PILOT_HERO_SLOT) as InstanceType<typeof THREE.Group>;
    const glowNames = new Set<string>();
    hero.traverse((o) => { if ((o as InstanceType<typeof THREE.Mesh>).isMesh && o.userData.glow) glowNames.add(o.name); });
    expect(glowNames.size).toBeGreaterThan(0);
    const a = buildArtScene(new Map(), { pilot05: true });
    const glowBatches: InstanceType<typeof THREE.Mesh>[] = [];
    a.root.traverse((o) => { if ((o as InstanceType<typeof THREE.Mesh>).isMesh && o.userData.glow) glowBatches.push(o as InstanceType<typeof THREE.Mesh>); });
    expect(glowBatches.length).toBeGreaterThan(0);
    // the interactive spin button is glow-tagged art and stays tagged as its own part
    expect(a.interactive.get(`slot_${PILOT_HERO_SLOT}/spin_button`)!.userData.glow).toBe(true);
    // the hero (now ~3.17 m tall) stays below every overhead piece above its footprint
    const reels = a.interactive.get(`slot_${PILOT_HERO_SLOT}/reels`)!;
    reels.geometry.computeBoundingBox();
    const c = reels.geometry.boundingBox!.getCenter(new THREE.Vector3());
    let overhead = 0;
    for (const m of [...a.ceiling.roof, ...a.ceiling.fixtures]) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (Math.abs(x - c.x) < 0.6 && Math.abs(z - c.z) < 0.6) {
          overhead++;
          expect(y).toBeGreaterThan(3.25);
        }
      }
    }
    expect(overhead).toBeGreaterThan(0);
  });

  it('batches materials that differ only in colour through vertex colours, without changing the colours', async () => {
    const THREE = await import('three');
    const { makeVelvetWorld } = await import('../../../art/casino/3d/worldComposition.mjs');
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    // every colour the art authors on an untextured material, in three.js's linear values
    const { root: raw } = makeVelvetWorld(THREE) as { root: InstanceType<typeof THREE.Group> };
    const authored = new Set<string>();
    raw.traverse((o) => {
      const m = (o as InstanceType<typeof THREE.Mesh>).material as InstanceType<typeof THREE.MeshStandardMaterial> | undefined;
      if (m?.color && !m.map) authored.add([m.color.r, m.color.g, m.color.b].map((v) => Math.fround(v)).join(','));
    });
    const a = buildArtScene(new Map(), { pilot05: false });
    expect(a.colourBatches).toBeGreaterThan(0);
    // pass 04: 10 cabinets with their own colours used to be about 40 batches on their own
    expect(a.batches).toBeLessThanOrEqual(70);
    let checked = 0;
    for (const o of a.root.children) {
      const mesh = o as InstanceType<typeof THREE.Mesh>;
      const col = mesh.geometry.attributes.color;
      const mat = mesh.material as InstanceType<typeof THREE.MeshStandardMaterial>;
      if (!col) continue;
      expect(mat.vertexColors).toBe(true);
      expect(mat.color.getHex()).toBe(0xffffff);
      for (let v = 0; v < col.count; v += 3) {
        expect(authored.has([col.getX(v), col.getY(v), col.getZ(v)].join(','))).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
    // reels and marquees are never colour-merged: each cabinet keeps its own; the spin buttons
    // share one batch (VA-0327), each cabinet a vertex range of it
    for (const [k, m] of a.interactive) if (!k.endsWith('/spin_button')) expect(m.geometry.attributes.color).toBeUndefined();
  });

  it('the guest avatar pilot is a few batches, stands on the floor at the gameplay height and faces -Z like the capsule (VA-0035)', async () => {
    const THREE = await import('three');
    const { buildGuestAvatar } = await import('../src/floor3d/artScene.ts');
    const { AVATAR_HEIGHT } = await import('../src/floor3d/layout.ts');
    const g = buildGuestAvatar(AVATAR_HEIGHT);
    g.updateMatrixWorld(true);
    const meshes: InstanceType<typeof THREE.Mesh>[] = [];
    g.traverse((o) => { if ((o as InstanceType<typeof THREE.Mesh>).isMesh) meshes.push(o as InstanceType<typeof THREE.Mesh>); });
    expect(meshes.length).toBeLessThanOrEqual(7);
    const box = new THREE.Box3().setFromObject(g);
    expect(box.max.y).toBeCloseTo(AVATAR_HEIGHT, 5);
    expect(box.min.y).toBeGreaterThanOrEqual(0);
    expect(box.min.y).toBeLessThan(0.02);
    // the body fits inside the 0.3 m collision radius the nav grid uses for the player
    expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThan(0.33);
    // the shoes (the art's toes point +Z) now point -Z: more of the feet's volume lies at z < 0
    const shoes = new THREE.Box3();
    for (const m of meshes) {
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld);
      if (b.max.y < 0.2) shoes.union(b);
    }
    expect(-shoes.min.z).toBeGreaterThan(shoes.max.z);
  });

  it('adds the art-only exterior backdrop outside the room without new obstacles (VA-0032)', async () => {
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    const { OBSTACLES, ROOM } = await import('../src/floor3d/layout.ts');
    const a = buildArtScene(new Map(), { pilot05: true });
    process.stdout.write(`[floor3d] pilot05 art batches: ${a.batches}\n`);
    const THREE = await import('three');
    const box = new THREE.Box3().setFromObject(a.root);
    // the ground field reaches well past the entrance, and it sits below the room's floor
    expect(box.max.z).toBeGreaterThan(ROOM.z1 + 10);
    expect(box.min.y).toBeLessThan(-0.3);
    // it is its own batches, hidden until the overview shows them
    expect(a.exterior.length).toBeGreaterThan(0);
    expect(a.exterior.every((m) => !m.visible)).toBe(true);
    for (const m of a.exterior) {
      m.geometry.computeBoundingBox();
      expect(m.geometry.boundingBox!.max.y).toBeLessThan(0);
    }
    // every obstacle stays inside the room: the forecourt is scenery, not playable floor
    for (const o of OBSTACLES) {
      if (o.kind === 'box') expect(o.z1).toBeLessThanOrEqual(ROOM.z1 + 0.01);
      else expect(o.z - o.r).toBeLessThanOrEqual(ROOM.z1);
    }
  });

  it('lifts the hero BONUS sign clear of the header glass that hides it, and only then (VA-0048)', async () => {
    const THREE = await import('three');
    const { liftHeroSignClear } = await import('../src/floor3d/artScene.ts');
    const make = (signZ: number) => {
      const hero = new THREE.Group();
      const display = new THREE.Group();
      hero.add(display);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.27, 0.03));
      glass.name = 'bonus_header_dark_screen';
      glass.position.z = 0.2; // front at 0.215
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.246, 0.005));
      sign.name = 'bonus_header_world_texture_target';
      sign.position.z = signZ;
      display.add(glass, sign);
      return { hero, sign };
    };
    const hidden = make(0.211); // front 0.2135, behind the glass front
    expect(liftHeroSignClear(hidden.hero)).toBeCloseTo(0.0035, 6);
    expect(hidden.sign.position.z + 0.0025).toBeCloseTo(0.217, 6);
    expect(liftHeroSignClear(hidden.hero)).toBe(0);
    const clear = make(0.22);
    expect(liftHeroSignClear(clear.hero)).toBe(0);
    expect(clear.sign.position.z).toBe(0.22);
    expect(liftHeroSignClear(new THREE.Group())).toBe(0);
  });

  it('the pilot swivel chair blocks walking where the art puts it, and the hero stays reachable', async () => {
    const THREE = await import('three');
    const { PILOT_CHAIR, PILOT_HERO_SLOT, obstaclesFor, pilotChairPosition } = await import('../src/floor3d/layout.ts');
    // the same placement artScene gives the chair: inside its slot's group, which the art turns and moves
    const s = SLOTS.find((q) => q.id === PILOT_HERO_SLOT)!;
    const slot = new THREE.Group();
    slot.position.set(s.x, 0, s.z);
    slot.rotation.y = s.rotationY;
    const chair = new THREE.Object3D();
    chair.position.set(PILOT_CHAIR.local.x, 0, PILOT_CHAIR.local.z);
    slot.add(chair);
    slot.updateMatrixWorld(true);
    const w = chair.getWorldPosition(new THREE.Vector3());
    const p = pilotChairPosition();
    expect(Math.hypot(p.x - w.x, p.z - w.z)).toBeLessThan(1e-9);
    // the chair's room side stands outside the hero's slot box, so without its own obstacle you
    // could walk through it
    const roomSide = { x: p.x + (s.x < 0 ? 0.25 : -0.25), z: p.z - 0.1 };
    expect(nav.pointFree(roomSide)).toBe(true);
    const pilotNav = new NavGrid(ROOM, obstaclesFor(true));
    expect(pilotNav.pointFree(p)).toBe(false);
    expect(pilotNav.pointFree(roomSide)).toBe(false);
    expect(obstaclesFor(false)).toBe(OBSTACLES);
    const front = { x: s.x + (s.x < 0 ? 1 : -1) * 1.0, z: s.z };
    expect(pilotNav.walkableAt(front)).toBe(true);
    const end = pilotNav.findPath(SPAWN, front)!.at(-1)!;
    expect(Math.hypot(end.x - front.x, end.z - front.z)).toBeLessThan(1e-6);
    // VA-0046: the chair stands on a player's left (facing the screen), out of the framing swing,
    // and the neighbouring machine's front stays reachable
    const facing = Math.atan2(s.x - front.x, -(s.z - front.z)); // heading toward the hero
    const left = { x: -Math.cos(facing), z: -Math.sin(facing) };
    expect((p.x - s.x) * left.x + (p.z - s.z) * left.z).toBeGreaterThan(0.5);
    for (const n of SLOTS.filter((q) => q.id !== PILOT_HERO_SLOT && Math.hypot(q.x - s.x, q.z - s.z) < 3)) {
      const nf = { x: n.x + (n.x < 0 ? 1 : -1) * 1.0, z: n.z };
      const ne = pilotNav.findPath(SPAWN, nf)!.at(-1)!;
      expect(Math.hypot(ne.x - nf.x, ne.z - nf.z)).toBeLessThan(1e-6);
    }
  });
});

describe('floor lighting modes (VA-0043)', async () => {
  const { LIGHT_RIGS, nextLightMode, parseLightMode } = await import('../src/floor3d/lighting.ts');
  it('defaults to vegas and only "flat" selects flat', () => {
    expect(parseLightMode(null)).toBe('vegas');
    expect(parseLightMode('junk')).toBe('vegas');
    expect(parseLightMode('flat')).toBe('flat');
    expect(parseLightMode('warm')).toBe('warm');
    expect(parseLightMode(null, 'warm')).toBe('warm');
    expect(nextLightMode('vegas')).toBe('warm');
    expect(nextLightMode(nextLightMode(nextLightMode('vegas')))).toBe('vegas');
  });
  it('flat keeps the original rig and has no post-processing', () => {
    const f = LIGHT_RIGS.flat;
    expect(f.bloom).toBeNull();
    expect([f.exposure, f.envIntensity, f.hemi.intensity, f.sun.intensity, f.lamp.intensity]).toEqual([1.05, 0.55, 0.9, 1.1, 14]);
  });
  it('vegas dims the room light and blooms only HDR emissive (reels top out at 1.0)', () => {
    const v = LIGHT_RIGS.vegas;
    const f = LIGHT_RIGS.flat;
    expect(v.hemi.intensity).toBeLessThan(f.hemi.intensity);
    expect(v.sun.intensity).toBeLessThan(f.sun.intensity);
    expect(v.envIntensity).toBeLessThan(f.envIntensity);
    expect(v.bloom).not.toBeNull();
    expect(v.bloom!.threshold).toBeGreaterThanOrEqual(1.0);
    expect(v.bloom!.strength).toBeLessThanOrEqual(1);
  });
});

describe('grand hall preview (VA-0064/VA-0069, opt-in)', async () => {
  const { salonLayout, SALON_ROOM, useRoom, ROOM: room } = await import('../src/floor3d/layout.ts');
  const { grandFloorLayout, grandHallLayout, GRAND_SPEC } = await import('../src/floor3d/grandHall.ts');
  const g = grandFloorLayout();
  const grandNav = new NavGrid(g.room, g.obstacles);
  it('the salon layout is the floor as it was', () => {
    const s = salonLayout(true, false);
    expect(s.room).toEqual(SALON_ROOM);
    expect(s.seats).toEqual(seatsFor(false));
    expect(s.slots).toBe(SLOTS);
    expect(s.spawn).toBe(SPAWN);
    expect(room).toEqual(SALON_ROOM);
  });
  it('useRoom switches the room the cameras read, and back', () => {
    useRoom(g.room);
    expect(ROOM.x1).toBeCloseTo(11.71);
    expect(cutawayWalls({ x: 0, y: 5, z: 10 }).size).toBe(0);
    useRoom(SALON_ROOM);
    expect(ROOM.x1).toBe(8.61);
  });
  it('the overview stays between the grand hall side walls, at the same angle', () => {
    useRoom(g.room);
    const free = desiredPose('overview', { x: 7.5, z: 12 }, 0, 17);
    expect(free.pos.x).toBeGreaterThan(ROOM.x1); // outside the east wall, which would be cut away
    setOverviewSides({ x0: ROOM.x0 + 0.2, x1: ROOM.x1 - 0.2 });
    const kept = desiredPose('overview', { x: 7.5, z: 12 }, 0, 17);
    expect(kept.pos.x).toBeCloseTo(ROOM.x1 - 0.2);
    expect(cutawayWalls(kept.pos).has('east')).toBe(false);
    // slid sideways: same offset from target to camera, so the same angle
    expect(kept.pos.x - kept.target.x).toBeCloseTo(free.pos.x - free.target.x);
    expect(kept.pos.z - kept.target.z).toBeCloseTo(free.pos.z - free.target.z);
    setOverviewSides(null);
    useRoom(SALON_ROOM);
  });
  it('comes from the one grand hall spec: same tables, seats, columns and side banks', () => {
    const l = grandHallLayout(GRAND_SPEC);
    expect(g.obstacles).toBe(g.obstacles);
    expect(g.seats).toEqual(l.seats);
    expect([g.table, ...g.decor.tables].map((t) => [t.x, t.z])).toEqual(l.tables.map((t) => [t.x, t.z]));
    expect(g.slots).toHaveLength(10);
    expect(g.decor.slots).toHaveLength(28);
    expect(new Set(g.slots.map((s) => s.id)).size).toBe(10);
    // the end-wall row stands outside the walkable room, facing down the hall
    for (const s of g.slots) {
      expect(s.rotationY).toBe(0);
      expect(s.z + 0.6).toBeLessThanOrEqual(g.room.z0 + 1e-9);
    }
    // the follow camera stays under the coffer beams
    expect(g.room.wallHeight).toBeCloseTo(7.2 - 0.32);
  });
  it('the follow camera starts unclamped at the grand hall spawn (VA-0261)', () => {
    useRoom(g.room);
    for (const aspect of [384 / 832, 832 / 384]) {
      const p = desiredPose('follow', g.spawn, g.spawn.heading, LIMITS.follow.initial, { aspect });
      // the same pose with no walls: it only matches if the room clamp did not move the camera
      useRoom({ ...g.room, z1: 1e3 });
      const free = desiredPose('follow', g.spawn, g.spawn.heading, LIMITS.follow.initial, { aspect });
      useRoom(g.room);
      expect(p.pos.z, `aspect ${aspect}`).toBeCloseTo(free.pos.z, 6);
      expect(p.pos.z).toBeLessThan(ROOM.z1);
    }
    useRoom(SALON_ROOM);
  });
  it('walks from the spawn to every seat and every machine, and keeps the promenade clear', () => {
    expect(grandNav.walkableAt(g.spawn)).toBe(true);
    expect(g.seats).toHaveLength(8);
    for (const s of g.seats) expect(grandNav.findPath(g.spawn, s.approach), s.id).not.toBeNull();
    for (const s of [...g.slots, ...g.decor.slots]) {
      const front = { x: s.x + Math.sin(s.rotationY) * 1.0, z: s.z + Math.cos(s.rotationY) * 1.0 };
      expect(grandNav.findPath(g.spawn, front), `${s.id} ${s.x},${s.z}`).not.toBeNull();
    }
    for (let z = g.room.z0 + 0.3; z <= g.room.z1 - 0.3; z += 0.5) expect(grandNav.walkableAt({ x: 0, z }), `z ${z}`).toBe(true);
  });
  it('composes the art: the architecture, one interactive hero per theme, reel copies, sides sorted', async () => {
    const THREE = await import('three');
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    const a = buildArtScene(new Map(), { pilot05: true, layout: g });
    for (const s of g.slots) expect(a.interactive.get(`slot_${s.id}/reels`)?.geometry.groups.length, s.id).toBe(25);
    // (reels and spin buttons here; the marquees need a browser canvas)
    expect([...a.interactive.keys()].every((k) => k.startsWith('slot_'))).toBe(true);
    expect(a.interactive.size).toBe(20);
    const copies = [...a.reelCopies.values()].reduce((n, m) => n + m.geometry.groups.length, 0);
    expect(copies).toBe(g.decor.slots.length * 25);
    expect(a.walls.north.length).toBeGreaterThan(0);
    expect(a.walls.east.length).toBeGreaterThan(0);
    expect(a.walls.west.length).toBeGreaterThan(0);
    expect(a.ceiling.roof.length).toBeGreaterThan(0);
    expect(a.ceiling.fixtures.length).toBeGreaterThan(0);
    // the endcaps (VA-0071): its entrance frame is the entrance front, hidden from above
    expect(a.ceiling.entrance.length).toBeGreaterThan(0);
    let foreign = 0;
    a.root.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh && !(o instanceof THREE.Mesh)) foreign++;
    });
    expect(foreign).toBe(0);
    let glow = 0;
    a.root.traverse((o) => {
      if (o.userData.glow) glow++;
    });
    expect(glow).toBeGreaterThan(0);
  });
  it('draws the ten heroes\' spin buttons as one batch, each hero a vertex range at its own machine (VA-0327)', async () => {
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    const a = buildArtScene(new Map(), { pilot05: true, layout: g });
    const buttons = new Set(g.slots.map((s) => a.interactive.get(`slot_${s.id}/spin_button`)));
    expect(buttons.size).toBe(1);
    const mesh = [...buttons][0]!;
    expect(mesh.parent).toBe(a.root);
    expect(mesh.userData.glow).toBe(true);
    // no geometry groups: one draw call, not one per button
    expect(mesh.geometry.groups.length).toBe(0);
    const pos = mesh.geometry.attributes.position;
    const ranges = mesh.userData.ranges as Record<string, [number, number]>;
    expect(Object.keys(ranges).sort()).toEqual(g.slots.map((s) => `slot_${s.id}`).sort());
    // the ranges tile the batch with no gap or overlap
    const sorted = Object.values(ranges).sort((p, q) => p[0] - q[0]);
    let next = 0;
    for (const [first, count] of sorted) {
      expect(first).toBe(next);
      expect(count).toBeGreaterThan(0);
      next = first + count;
    }
    expect(next).toBe(pos.count);
    // each range sits at its own machine: within a metre of its placement on the floor
    for (const s of g.slots) {
      const [first, count] = ranges[`slot_${s.id}`];
      let x = 0, z = 0;
      for (let v = first; v < first + count; v++) { x += pos.getX(v); z += pos.getZ(v); }
      expect(Math.hypot(x / count - s.x, z / count - s.z), s.id).toBeLessThan(1);
    }
  });
  it('frames both ends with the endcaps, clear of the back row and the walkable room (VA-0071)', async () => {
    const THREE = await import('three');
    const { createGrandHallEndcaps } = await import('../../../art/casino/3d/grandHallEndcaps.mjs');
    const { ENDCAP_RECESS } = await import('../src/floor3d/grandHallArt.ts');
    const spec = grandHallLayout(GRAND_SPEC).spec;
    const caps = createGrandHallEndcaps(THREE, {
      width: spec.width, length: spec.length + ENDCAP_RECESS * 2, height: spec.height, entranceWidth: spec.aisleWidth, rearZ: 'negative',
    }) as import('three').Group;
    caps.updateMatrixWorld(true);
    // the back of the end-wall row (the cabinets' backs are 0.42 m behind their origin)
    const slotBack = Math.min(...g.slots.map((s) => s.z)) - 0.42;
    let rearFront = -Infinity;
    let entranceBack = Infinity;
    caps.traverse((o) => {
      if (!(o as import('three').Mesh).isMesh) return;
      const b = new THREE.Box3().setFromObject(o);
      if (o.name.startsWith('wall-rear-')) rearFront = Math.max(rearFront, b.max.z);
      // at body height (the lintel's inlay, 6 m up, reaches 1.5 cm past the walk edge)
      else if (b.min.y < 2.5) entranceBack = Math.min(entranceBack, b.min.z);
    });
    expect(rearFront).toBeLessThan(slotBack);
    expect(entranceBack).toBeGreaterThan(g.room.z1);
    // the opening is the promenade, so the spawn walk-in isn't framed by a narrower door
    expect(caps.userData.entranceOpening.maxX - caps.userData.entranceOpening.minX).toBeCloseTo(spec.aisleWidth);
    let placeholder = false;
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    buildArtScene(new Map(), { pilot05: true, layout: g }).root.traverse((o) => {
      if (o.name === 'rear_wall') placeholder = true;
    });
    expect(placeholder).toBe(false);
  });
  it('swaps in the gold-coffer ceiling at hall size, chandeliers over the promenade, as roof and fixtures (VA-0175)', async () => {
    const THREE = await import('three');
    const { goldCofferCeiling, GOLD_COFFER_CHANDELIERS, REPLACED_BY_GOLD_COFFERS } = await import('../src/floor3d/grandHallArt.ts');
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    const spec = grandHallLayout(GRAND_SPEC).spec;
    const ceil = goldCofferCeiling(spec);
    ceil.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ceil);
    // hall-width across X, hall-length along Z (art axis 'z', no host turn), within 6 cm of the walls and ends
    expect(ceil.rotation.y).toBe(0);
    expect(ceil.userData.axis).toBe('z');
    expect(box.max.x - box.min.x).toBeGreaterThan(spec.width - 0.01);
    expect(box.max.x - box.min.x).toBeLessThan(spec.width + 0.12);
    expect(box.max.z - box.min.z).toBeGreaterThan(spec.length - 0.01);
    expect(box.max.z - box.min.z).toBeLessThan(spec.length + 0.12);
    expect(box.max.y).toBeCloseTo(spec.height, 1);
    // the chandeliers hang over the promenade, well above head height and clear of the avatar
    const rings: number[] = [];
    const along: number[] = [];
    let lowest = Infinity;
    ceil.traverse((o) => {
      if (!(o as import('three').Mesh).isMesh) return;
      if (o.name.startsWith('chandelier_')) lowest = Math.min(lowest, new THREE.Box3().setFromObject(o).min.y);
      if (/^chandelier_\d+_suspension$/.test(o.name)) { const p = o.getWorldPosition(new THREE.Vector3()); rings.push(p.x); along.push(p.z); }
    });
    expect(rings).toHaveLength(GOLD_COFFER_CHANDELIERS);
    for (const x of rings) expect(Math.abs(x)).toBeLessThan(spec.aisleWidth / 2);
    // spread down the promenade, not stacked
    expect(Math.max(...along) - Math.min(...along)).toBeGreaterThan(spec.length / 3);
    expect(lowest).toBeGreaterThan(5);
    // in the scene: the hall's own slab, coffers and rings are gone, the new pieces are roof / fixtures
    const names = (style?: 'hall' | 'gold-coffers') => {
      const seen = new Set<string>();
      const a = buildArtScene(new Map(), { pilot05: true, layout: g, ceiling: style });
      a.root.traverse((o) => seen.add(o.name));
      return { seen, a };
    };
    const own = names('hall');
    const gold = names('gold-coffers');
    expect([...own.seen].some((n) => REPLACED_BY_GOLD_COFFERS.test(n)) || own.a.ceiling.roof.length > 0).toBe(true);
    expect(gold.a.ceiling.roof.length).toBeGreaterThan(0);
    expect(gold.a.ceiling.fixtures.length).toBeGreaterThan(0);
    // the coffers batch: the new ceiling adds a handful of batches, not one per coffer
    expect(gold.a.batches - own.a.batches).toBeLessThanOrEqual(6);
  });
  it('cuts the gold coffers\' perimeter rail away with the roof, and builds it hall-sized (VA-0181)', async () => {
    const THREE = await import('three');
    const { goldCofferCeiling } = await import('../src/floor3d/grandHallArt.ts');
    const { wallSideOf } = await import('../src/floor3d/artScene.ts');
    expect(wallSideOf('ceiling_attached_perimeter_gold_rail', 0)).toBe('roof');
    const spec = grandHallLayout(GRAND_SPEC).spec;
    const ceil = goldCofferCeiling(spec);
    ceil.updateMatrixWorld(true);
    const rail = ceil.getObjectByName('ceiling_attached_perimeter_gold_rail') as import('three').InstancedMesh;
    expect(rail?.isInstancedMesh).toBe(true);
    expect(rail.count).toBe(4);
    const box = new THREE.Box3();
    const m = new THREE.Matrix4();
    rail.geometry.computeBoundingBox();
    for (let i = 0; i < rail.count; i++) { rail.getMatrixAt(i, m); box.union(rail.geometry.boundingBox!.clone().applyMatrix4(m)); }
    // within 5 cm outside the hall's walls and ends, below the beams, above every chandelier
    expect(box.max.x).toBeLessThan(spec.width / 2 + 0.05);
    expect(box.max.z).toBeLessThan(spec.length / 2 + 0.05);
    expect(box.max.y).toBeLessThan(spec.height);
    expect(box.min.y).toBeGreaterThan(6.5);
  });
  it('keeps the side-rail inset at the art default unless ?coffertrim asks, and .28 meets the crown face (VA-0183)', async () => {
    const THREE = await import('three');
    const { goldCofferCeiling, cofferSideInsetFrom } = await import('../src/floor3d/grandHallArt.ts');
    expect(cofferSideInsetFrom('')).toBe(0);
    expect(cofferSideInsetFrom('?floor3d&coffertrim=0.28')).toBe(0.28);
    expect(cofferSideInsetFrom('?coffertrim=0.5')).toBe(0);
    expect(cofferSideInsetFrom('?coffertrim=-1')).toBe(0);
    expect(cofferSideInsetFrom('?coffertrim=abc')).toBe(0);
    const spec = grandHallLayout(GRAND_SPEC).spec;
    const innerX = (inset: number) => {
      const rail = goldCofferCeiling(spec, inset).getObjectByName('ceiling_attached_perimeter_gold_rail') as import('three').InstancedMesh;
      rail.geometry.computeBoundingBox();
      const m = new THREE.Matrix4();
      rail.getMatrixAt(1, m); // the +X side rail
      return rail.geometry.boundingBox!.clone().applyMatrix4(m).min.x;
    };
    // default: the side rail sits in the wall (inner face ~11.97); .28 brings it to the crown's
    // inner face (x 11.69) without going proud of it; the outer edge stays put
    expect(innerX(0)).toBeGreaterThan(spec.width / 2 - 0.05);
    expect(innerX(0.28)).toBeGreaterThan(spec.width / 2 - 0.31);
    expect(innerX(0.28)).toBeLessThan(spec.width / 2 - 0.27);
  });
  it('keeps the luxury chair by default; ?chair=lod swaps in the shared LOD chair, turned to face its table (VA-0185)', async () => {
    const THREE = await import('three');
    const { chairStyleFrom, chairAt, composeGrandHall } = await import('../src/floor3d/grandHallArt.ts');
    expect(chairStyleFrom('')).toBe('luxury');
    expect(chairStyleFrom('?floor3d&chair=lod')).toBe('lod-mid');
    expect(chairStyleFrom('?chair=lod-near')).toBe('lod-near');
    expect(chairStyleFrom('?chair=gold')).toBe('luxury');
    // a chair at the origin facing a table at -X: its backrest must end up on the far side (+X)
    const chair = chairAt('c', 0, 0, -3, 0, 'lod-mid');
    chair.updateMatrixWorld(true);
    const back = new THREE.Box3().setFromObject(chair.getObjectByName('sculpted_upholstered_backrest')!);
    expect((back.min.x + back.max.x) / 2).toBeGreaterThan(0.15);
    // the default luxury chair too (its userData.forward is -Z; VA-0190 found it facing away)
    const luxChair = chairAt('l', 0, 0, -3, 0, 'luxury');
    luxChair.updateMatrixWorld(true);
    const bolsters = new THREE.Box3();
    luxChair.traverse((o) => { if (o.name === 'side_back_bolster') bolsters.expandByObject(o); });
    expect(bolsters.isEmpty()).toBe(false);
    expect((bolsters.min.x + bolsters.max.x) / 2).toBeGreaterThan(0.15);
    const tris = (style: 'luxury' | 'lod-mid') => {
      const root = composeGrandHall(g, { liftSign: () => 0, chairStyle: style }).root;
      let n = 0;
      const geos = new Set<string>();
      root.traverse((o) => {
        if (!/_chair$/.test(o.name)) return;
        o.traverse((m) => {
          const mesh = m as import('three').Mesh;
          if (!mesh.isMesh) return;
          geos.add(mesh.geometry.uuid);
          n += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
        });
      });
      return { n, geos: geos.size };
    };
    const lux = tris('luxury');
    const lod = tris('lod-mid');
    // every chair the same count; LOD is ~14x cheaper after 336a41b's tube rails (8 x 732 vs 82,112 tris),
    // and its clones share one set of geometry
    expect(lod.n * 10).toBeLessThan(lux.n);
    let perChair = 0;
    chair.traverse((m) => { if ((m as import('three').Mesh).isMesh) perChair++; });
    expect(lod.geos).toBe(perChair);
  });
  it("Claude's burgundy gaming chair: faces its table, seat at SEAT_HEIGHT, light, clones share geometry (VA-0210)", async () => {
    const THREE = await import('three');
    const { chairStyleFrom, chairAt, NEXT_CHAIR_STYLE } = await import('../src/floor3d/grandHallArt.ts');
    const { createVelvetGamingChair } = await import('../../../art/casino/3d/velvetGamingChair.mjs');
    const { SEAT_HEIGHT } = await import('../src/floor3d/layout.ts');
    expect(chairStyleFrom('?chair=velvet')).toBe('velvet');
    // the ⚙ cycle visits every style once
    const seen = new Set<string>();
    let s: keyof typeof NEXT_CHAIR_STYLE = 'velvet';
    for (let i = 0; i < 7; i++) { seen.add(s); s = NEXT_CHAIR_STYLE[s]; }
    expect(s).toBe('velvet');
    expect(seen.size).toBe(7);
    const tpl = createVelvetGamingChair(THREE);
    tpl.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(tpl.getObjectByName('chair_seat_cushion')!).max.y).toBeCloseTo(SEAT_HEIGHT, 2);
    const all = new THREE.Box3().setFromObject(tpl);
    expect(Math.max(-all.min.x, all.max.x, -all.min.z, all.max.z)).toBeLessThan(0.38); // inside the seat collision circle
    let tris = 0;
    tpl.traverse((m: import('three').Object3D) => { const g = (m as import('three').Mesh).geometry; if (g) tris += (g.index?.count ?? g.attributes.position.count) / 3; });
    expect(tris).toBeLessThan(5000); // the luxury chair is ~10.3k
    // facing a table at -X: the back ends up on the far side (+X)
    const templates = new Map();
    const chair = chairAt('c', 0, 0, -3, 0, 'velvet', templates);
    const twin = chairAt('d', 2, 0, -3, 0, 'velvet', templates);
    chair.updateMatrixWorld(true);
    const back = new THREE.Box3().setFromObject(chair.getObjectByName('chair_back')!);
    expect((back.min.x + back.max.x) / 2).toBeGreaterThan(0.15);
    expect((twin.getObjectByName('chair_back_pad') as import('three').Mesh).geometry).toBe((chair.getObjectByName('chair_back_pad') as import('three').Mesh).geometry);
  });
  it("ChatGPT's swivel chair (31b9eb8) is opt-in with ?chair=swivel, faces its table and clones share geometry (VA-0240)", async () => {
    const THREE = await import('three');
    const { chairStyleFrom, chairAt } = await import('../src/floor3d/grandHallArt.ts');
    const { createVelvetLuxuryChairLOD } = await import('../../../art/casino/3d/velvetLuxuryChairLOD.mjs');
    expect(chairStyleFrom('?chair=swivel')).toBe('swivel');
    expect(chairStyleFrom('')).toBe('luxury');
    const tpl = createVelvetLuxuryChairLOD(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    let tris = 0;
    tpl.traverse((m) => { const g = (m as import('three').Mesh).geometry; if (g) tris += (g.index?.count ?? g.attributes.position.count) / 3; });
    expect(tris).toBeLessThan(3000); // the luxury chair is ~10.3k
    // its raked back reaches 0.416 m behind the column, past the 0.38 m seat collision circle; the
    // default luxury chair already reaches 0.465 m, so it is no worse than what ships (VA-0241)
    const all = new THREE.Box3().setFromObject(tpl);
    expect(Math.max(-all.min.x, all.max.x, -all.min.z, all.max.z)).toBeLessThan(0.465);
    // facing a table at -X: the back ends up on the far side (+X), seat cushion toward the table
    const templates = new Map();
    const chair = chairAt('c', 0, 0, -3, 0, 'swivel', templates);
    const twin = chairAt('d', 2, 0, -3, 0, 'swivel', templates);
    chair.updateMatrixWorld(true);
    const back = new THREE.Box3().setFromObject(chair.getObjectByName('VA_sculpted_back_lowpoly')!);
    expect((back.min.x + back.max.x) / 2).toBeGreaterThan(0.15);
    expect((twin.getObjectByName('VA_seat_cushion') as import('three').Mesh).geometry).toBe((chair.getObjectByName('VA_seat_cushion') as import('three').Mesh).geometry);
  });
  it("swivel chair revision (c05c46c) rests on the floor, cushion top at SEAT_HEIGHT, declares its +Z front (VA-0242, read-only check)", async () => {
    const THREE = await import('three');
    const { createVelvetLuxuryChairLOD } = await import('../../../art/casino/3d/velvetLuxuryChairLOD.mjs');
    const tpl = createVelvetLuxuryChairLOD(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    expect(tpl.userData.forward).toBe('+Z');
    expect(new THREE.Box3().setFromObject(tpl).min.y).toBeCloseTo(0, 3);
    expect(new THREE.Box3().setFromObject(tpl.getObjectByName('VA_seat_cushion')!).max.y).toBeCloseTo(0.65, 3);
    const glide = new THREE.Box3().setFromObject(tpl.getObjectByName('VA_floor_glide_0')!);
    const drop = new THREE.Box3().setFromObject(tpl.getObjectByName('VA_glide_drop_0')!);
    const spoke = new THREE.Box3().setFromObject(tpl.getObjectByName('VA_five_spoke_0')!);
    expect(drop.min.y).toBeLessThanOrEqual(glide.max.y);
    expect(drop.max.y).toBeGreaterThanOrEqual(spoke.min.y);
  });
  it('swivel chair revision (47dad4b/e07c1e2): no floating piping, column meets hub, arm braces reach underpan (VA-0244, read-only check)', async () => {
    const THREE = await import('three');
    const { createVelvetLuxuryChairLOD } = await import('../../../art/casino/3d/velvetLuxuryChairLOD.mjs');
    const tpl = createVelvetLuxuryChairLOD(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    const box = (n: string) => new THREE.Box3().setFromObject(tpl.getObjectByName(n)!);
    expect(tpl.getObjectByName('VA_back_piping')).toBeUndefined();
    // column bottom within 2 mm of the hub top (nominal 1 mm gap)
    expect(box('VA_swivel_column').min.y - box('VA_hub').max.y).toBeLessThan(0.002);
    const pan = box('VA_seat_underpan');
    for (const side of [-1, 1]) {
      const brace = box('VA_arm_support_brace_' + side);
      const support = box('VA_arm_support_' + side);
      // brace lies along X: wider than tall
      expect(brace.max.x - brace.min.x).toBeGreaterThan(brace.max.y - brace.min.y);
      // overlaps the support bottom and reaches inside the underpan's x extent
      expect(brace.max.y).toBeGreaterThanOrEqual(support.min.y);
      expect(side > 0 ? brace.min.x < pan.max.x : brace.max.x > pan.min.x).toBe(true);
      expect(brace.min.y).toBeLessThanOrEqual(pan.max.y);
    }
  });
  it("ChatGPT's tub chair (d0c2607) is opt-in with ?chair=tub, rests on the floor, faces its table, clones share geometry (VA-0246)", async () => {
    const THREE = await import('three');
    const { chairStyleFrom, chairAt, NEXT_CHAIR_STYLE } = await import('../src/floor3d/grandHallArt.ts');
    const { createVelvetTubChair } = await import('../../../art/casino/3d/velvetTubChairPrototype.mjs');
    expect(chairStyleFrom('?chair=tub')).toBe('tub');
    expect(NEXT_CHAIR_STYLE.swivel).toBe('tub');
    expect(NEXT_CHAIR_STYLE.tub).toBe('casino');
    const tpl = createVelvetTubChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    expect(tpl.userData.forward).toBe('+Z');
    let tris = 0;
    tpl.traverse((m) => { const g = (m as import('three').Mesh).geometry; if (g) tris += (g.index?.count ?? g.attributes.position.count) / 3; });
    expect(tris).toBe(1620);
    const all = new THREE.Box3().setFromObject(tpl);
    expect(all.min.y).toBeCloseTo(0, 3);
    expect(new THREE.Box3().setFromObject(tpl.getObjectByName('VA_tub_cushion')!).max.y).toBeCloseTo(0.65, 3);
    // inside the 0.38 m seat collision circle the other chairs use
    expect(Math.max(-all.min.x, all.max.x, -all.min.z, all.max.z)).toBeLessThan(0.38);
    // facing a table at -X: the back cushion ends up on the far side (+X)
    const templates = new Map();
    const chair = chairAt('c', 0, 0, -3, 0, 'tub', templates);
    const twin = chairAt('d', 2, 0, -3, 0, 'tub', templates);
    chair.updateMatrixWorld(true);
    const back = new THREE.Box3().setFromObject(chair.getObjectByName('VA_tub_back_cushion')!);
    expect((back.min.x + back.max.x) / 2).toBeGreaterThan(0.15);
    expect((twin.getObjectByName('VA_tub_cushion') as import('three').Mesh).geometry).toBe((chair.getObjectByName('VA_tub_cushion') as import('three').Mesh).geometry);
  });
  // 69db376 (VA-0299), measured with three's Box3 on the template (front -Z, metres): 28 meshes, 4 materials,
  // 4,444 triangles; whole chair x +-0.405, y 0.011..1.173, z -0.275..0.376. Three parts come out in the wrong place:
  // seat_cushion is rotated PI/2 - 0.055 about X, so its 0.49 m extrusion runs DOWN: y 0.011..0.510, z -0.137..0.072
  // (a 0.5 m tall, 0.21 m deep slab, not a seat); each arm_pad (rotated PI/2) is a 0.39 m post, y 0.302..0.692;
  // back_piping is rotated -0.095 about the origin instead of the back's centre, so it sits at z -0.092..-0.026,
  // 3-10 cm in front of back_padded_insert (z 0.006..0.094). Pinned as expected failures until the art moves.
  it("ChatGPT's casino chair study (69db376) is opt-in with ?chair=casino, faces its table, clones share geometry (VA-0299)", async () => {
    const THREE = await import('three');
    const { chairStyleFrom, chairAt, NEXT_CHAIR_STYLE } = await import('../src/floor3d/grandHallArt.ts');
    const { createVelvetCasinoChair } = await import('../../../art/casino/3d/velvetCasinoChair.mjs');
    expect(chairStyleFrom('?chair=casino')).toBe('casino');
    expect(NEXT_CHAIR_STYLE.casino).toBe('velvet');
    const tpl = createVelvetCasinoChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    expect(tpl.userData.forward).toBe('-Z');
    let tris = 0;
    const mats = new Set<string>();
    tpl.traverse((o) => { const m = o as import('three').Mesh; if (!m.isMesh) return; tris += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; mats.add((m.material as import('three').Material).uuid); });
    // eb42846 (VA-0303) adds an arm cradle and a second post per side: 28 -> 32 meshes, 4,444 -> 4,548 tris
    // bebd39b (VA-0305) adds a lower rail and a cross brace per side: 32 -> 36 meshes, 4,596 tris
    // b1703cf (VA-0309) adds two side wraps, a top wrap and a bronze post material: 39 meshes, 4,664 tris, 5 materials
    // 9381875 (VA-0311) rebuilds the three wraps as rounded cushion() extrusions: still 39 meshes, 5,768 tris (+1,104)
    // 4f5a3d5 (VA-0315) gives the three wraps a lower tessellation (376 -> 188 tris each): 5,192 tris (-576)
    // 0b98f52 (VA-0317) replaces the three wraps (564 tris) with one back_contoured_rim (1,392): 37 meshes, 6,020 tris
    // 108f001 (VA-0319) halves the rim's hole sampling and bevel segments: rim 1,392 -> 544, chair 5,172 tris (-848)
    expect(tris).toBe(5172);
    expect(mats.size).toBe(5);
    const all = new THREE.Box3().setFromObject(tpl);
    expect(all.min.y).toBeGreaterThan(0);
    expect(all.min.y).toBeLessThan(0.02);
    // 33aa2b9 (VA-0301) brought the arm pads in: they reach 0.382 m sideways (was 0.405), ~2 mm past the 0.38 m
    // seat collision circle the other chairs use
    expect(all.max.x).toBeCloseTo(0.382, 3);
    // facing a table at -X (front -Z, so a half turn): the back ends up on the far side (+X)
    const templates = new Map();
    const chair = chairAt('c', 0, 0, -3, 0, 'casino', templates);
    const twin = chairAt('d', 2, 0, -3, 0, 'casino', templates);
    chair.updateMatrixWorld(true);
    const back = new THREE.Box3().setFromObject(chair.getObjectByName('back_outer')!);
    expect((back.min.x + back.max.x) / 2).toBeGreaterThan(0.15);
    expect((twin.getObjectByName('back_outer') as import('three').Mesh).geometry).toBe((chair.getObjectByName('back_outer') as import('three').Mesh).geometry);
  });
  it('casino chair (33aa2b9): seat cushion lies flat, top near 0.49 m (VA-0299)', async () => {
    const THREE = await import('three');
    const { createVelvetCasinoChair } = await import('../../../art/casino/3d/velvetCasinoChair.mjs');
    const tpl = createVelvetCasinoChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    const seat = new THREE.Box3().setFromObject(tpl.getObjectByName('seat_cushion')!);
    expect(seat.max.y - seat.min.y).toBeLessThan(0.22);
    // eb42846 (VA-0303) shortened the extrusion 0.49 -> 0.29 so it stops at the back: measured depth 0.30 m
    expect(seat.max.z - seat.min.z).toBeGreaterThan(0.25);
  });
  it('casino chair (33aa2b9): arm pads are horizontal, not 0.39 m posts (VA-0299)', async () => {
    const THREE = await import('three');
    const { createVelvetCasinoChair } = await import('../../../art/casino/3d/velvetCasinoChair.mjs');
    const tpl = createVelvetCasinoChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    const arm = new THREE.Box3().setFromObject(tpl.getObjectByName('arm_pad')!);
    expect(arm.max.y - arm.min.y).toBeLessThan(0.15);
    expect(arm.max.z - arm.min.z).toBeGreaterThan(0.3);
  });
  it('casino chair (33aa2b9): back piping sits on the padded insert, within 2 cm (VA-0299)', async () => {
    const THREE = await import('three');
    const { createVelvetCasinoChair } = await import('../../../art/casino/3d/velvetCasinoChair.mjs');
    const tpl = createVelvetCasinoChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    const pipe = new THREE.Box3().setFromObject(tpl.getObjectByName('back_piping')!);
    const insert = new THREE.Box3().setFromObject(tpl.getObjectByName('back_padded_insert')!);
    expect(Math.abs(pipe.min.z - insert.min.z)).toBeLessThan(0.02);
  });
  // 33aa2b9 measured seat_cushion z -0.275..0.224 against the insert face at z 0.006 (pinned as it.fails in VA-0302).
  // eb42846 (VA-0303) measured: seat_cushion z -0.305..-0.005, 1.1 cm in front of the insert face. Now a normal test.
  it('casino chair (eb42846): seat cushion stops at the back insert face, within 3 cm (VA-0301, VA-0303)', async () => {
    const THREE = await import('three');
    const { createVelvetCasinoChair } = await import('../../../art/casino/3d/velvetCasinoChair.mjs');
    const tpl = createVelvetCasinoChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    const seat = new THREE.Box3().setFromObject(tpl.getObjectByName('seat_cushion')!);
    const insert = new THREE.Box3().setFromObject(tpl.getObjectByName('back_padded_insert')!);
    expect(seat.max.z - insert.min.z).toBeLessThan(0.03);
  });
  // eb42846 (VA-0303): each arm pad (y 0.627..0.733, z -0.217..0.173) now rests on a steel cradle (y 0.602..0.634,
  // z -0.212..0.118) carried by two posts (y 0.365..0.615 at z ~-0.17 and ~0.08). The posts' feet (y 0.365) stop
  // in mid-air: the underpan is only x +-0.270, the posts are at |x| 0.298..0.346.
  it('casino chair (eb42846): arm pads rest on a cradle that spans most of their length (VA-0303)', async () => {
    const THREE = await import('three');
    const { createVelvetCasinoChair } = await import('../../../art/casino/3d/velvetCasinoChair.mjs');
    const tpl = createVelvetCasinoChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    const pad = new THREE.Box3().setFromObject(tpl.getObjectByName('arm_pad')!);
    const cradle = new THREE.Box3().setFromObject(tpl.getObjectByName('arm_cradle')!);
    expect(cradle.max.y).toBeGreaterThanOrEqual(pad.min.y);
    expect(cradle.max.y - pad.min.y).toBeLessThan(0.02);
    expect(cradle.max.z - cradle.min.z).toBeGreaterThan(0.75 * (pad.max.z - pad.min.z));
  });
  it('casino chair (bebd39b): arm posts stand on rails braced to the centre; underpan and pads stop before the shell (VA-0305)', async () => {
    const THREE = await import('three');
    const { createVelvetCasinoChair } = await import('../../../art/casino/3d/velvetCasinoChair.mjs');
    const tpl = createVelvetCasinoChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    const boxes = (name: string) => { const r: import('three').Box3[] = []; tpl.traverse((o) => { if (o.name === name) r.push(new THREE.Box3().setFromObject(o)); }); return r; };
    const rails = boxes('arm_lower_rail'), braces = boxes('arm_cross_brace'), posts = boxes('arm_support');
    expect(rails.length).toBe(2);
    expect(braces.length).toBe(2);
    // every post's foot lands on a rail under it (within 1 cm vertically, overlapping in plan)
    for (const p of posts) expect(rails.some((r) => p.min.y >= r.min.y - 0.01 && p.min.y <= r.max.y + 0.01 && p.min.x < r.max.x && p.max.x > r.min.x && p.min.z < r.max.z && p.max.z > r.min.z)).toBe(true);
    // each brace runs from its rail into the seat underpan (it ends at x 0, ~9 mm in front of the gas lift)
    const pan = new THREE.Box3().setFromObject(tpl.getObjectByName('seat_underpan')!);
    for (const b of braces) {
      expect(rails.some((r) => r.intersectsBox(b))).toBe(true);
      expect(b.intersectsBox(pan)).toBe(true);
    }
    // nothing upholstered or structural pokes into the back shell any more
    const shellFront = new THREE.Box3().setFromObject(tpl.getObjectByName('back_outer')!).min.z;
    expect(new THREE.Box3().setFromObject(tpl.getObjectByName('seat_underpan')!).max.z).toBeLessThan(shellFront);
    for (const pad of boxes('arm_pad')) expect(pad.max.z).toBeLessThan(shellFront);
  });
  // measured on bebd39b: the lower rails (y 0.335-0.373, |x| 0.298-0.346) and braces (y 0.336-0.372) rise ~3 cm
  // into the seat cushion's underside (y from 0.343, |x| <= 0.316); hidden from most angles, pinned here
  // f385e1b lowered rails (top y 0.341) and braces (top 0.340) below the cushion underside (y 0.343); posts
  // now y 0.335..0.625, still landing on the rails and reaching the arm cradle (0.602..0.634) (VA-0307).
  it('casino chair (f385e1b): lower rails and braces stay below the seat cushion (VA-0305, VA-0307)', async () => {
    const THREE = await import('three');
    const { createVelvetCasinoChair } = await import('../../../art/casino/3d/velvetCasinoChair.mjs');
    const tpl = createVelvetCasinoChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    const seat = new THREE.Box3().setFromObject(tpl.getObjectByName('seat_cushion')!);
    tpl.traverse((o) => {
      if (o.name !== 'arm_lower_rail' && o.name !== 'arm_cross_brace') return;
      const b = new THREE.Box3().setFromObject(o);
      if (b.min.x < seat.max.x && b.max.x > seat.min.x && b.min.z < seat.max.z && b.max.z > seat.min.z) expect(b.max.y).toBeLessThanOrEqual(seat.min.y + 0.005);
    });
  });
  // 0b98f52 (VA-0317) replaces back_side_wrap x2 + back_top_wrap with one back_contoured_rim: an ExtrudeGeometry
  // rounded frame with a hole, 1,392 tris. Measured (AABB after rotation, metres): rim x +-0.321, y 0.489..1.157,
  // z 0.017..0.219 (back_outer |x| <= 0.341 starts z 0.136; back_piping |x| <= 0.257, z 0.000..0.063; insert |x| <=
  // 0.2634). Rays along +Z: x 0 and 0.2 at y 0.817 pass the hole and hit back_padded_insert (z 0.032); x 0.27 and 0.29
  // hit the rim front at z 0.048, ~5 cm behind the piping front, so the piping stands proud. All 116 front-cap
  // triangles face -Z (no inverted winding).
  it('casino chair (0b98f52): one contoured rim with an open hole bridges the insert to the shell (VA-0317)', async () => {
    const THREE = await import('three');
    const { createVelvetCasinoChair } = await import('../../../art/casino/3d/velvetCasinoChair.mjs');
    const tpl = createVelvetCasinoChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    expect(tpl.getObjectByName('back_side_wrap')).toBeUndefined();
    expect(tpl.getObjectByName('back_top_wrap')).toBeUndefined();
    const box = (n: string) => new THREE.Box3().setFromObject(tpl.getObjectByName(n)!);
    const rim = box('back_contoured_rim');
    const shell = box('back_outer');
    const insert = box('back_padded_insert');
    const piping = box('back_piping');
    expect(rim.max.z).toBeGreaterThan(shell.min.z); // reaches into the shell
    expect(rim.max.x).toBeLessThan(shell.max.x); // and stays inside its outline
    // 108f001 (VA-0319) widens the rim to the shell outline: x +-0.340 vs +-0.341, top y 1.169 vs 1.173
    expect(shell.max.x - rim.max.x).toBeLessThan(0.003);
    expect(shell.max.y - rim.max.y).toBeLessThan(0.006);
    expect(rim.max.y).toBeGreaterThan(insert.max.y);
    const rc = new THREE.Raycaster();
    const first = (x: number, y: number) => {
      rc.set(new THREE.Vector3(x, y, -1), new THREE.Vector3(0, 0, 1));
      return rc.intersectObject(tpl, true)[0];
    };
    for (const x of [0, 0.2, -0.2]) expect(first(x, 0.817).object.name).toBe('back_padded_insert'); // hole is open
    // 5478b9f+75f2fe4 (VA-0321/VA-0323) move the piping out to |x| 0.268..0.282 (tube centre 0.275), past the insert
    // edge 0.2634: rays at x +-0.275 now hit back_piping at z ~0.019; the 4.6 mm strip between insert and piping
    // (x 0.264..0.267) and everything outboard of it (0.284..0.335) still lands on the rim front at z 0.050.
    for (const x of [0.275, -0.275]) expect(first(x, 0.817).object.name).toBe('back_piping');
    expect(piping.max.x).toBeGreaterThan(insert.max.x);
    expect(piping.max.x).toBeLessThan(rim.max.x);
    for (const x of [0.266, -0.266, 0.29, -0.29, 0.335]) {
      const h = first(x, 0.817);
      expect(h.object.name).toBe('back_contoured_rim'); // no gap onto the dark inset between insert and rim
      expect(h.point.z).toBeGreaterThan(piping.min.z + 0.01); // rim face sits behind the piping front
    }
  });
  it('casino chair (0b98f52): all posts stay bronze metal (VA-0309)', async () => {
    const THREE = await import('three');
    const { createVelvetCasinoChair } = await import('../../../art/casino/3d/velvetCasinoChair.mjs');
    const tpl = createVelvetCasinoChair(THREE) as import('three').Group;
    const posts: import('three').Mesh[] = [];
    tpl.traverse((o) => { if (o.name === 'arm_support') posts.push(o as import('three').Mesh); });
    expect(posts).toHaveLength(4);
    for (const p of posts) expect((p.material as import('three').MeshStandardMaterial).metalness).toBeGreaterThan(0.5);
  });
  // 1961cbf (v3) adds a tapered sideways push (+-0.142 m * edge^8) at both ends of the sweep to open the mouth.
  // Measured (18 segments): arm tips |x| 0.255..0.268 (was 0.113..0.126); nearest shell point in front of the back
  // cushion |x| 0.249, so the mouth is ~0.50 m wide; max plan radius still 0.378 (collision circle 0.38); shell box
  // unchanged (x +-0.343, y 0.525..1.015, z -0.365..+0.137). The push is not monotonic: on every ring x goes
  // 0.278 -> 0.251 -> 0.256 over the last two segments, so the upper rings fold back on themselves (adjacent vertex
  // normals differ by up to 55 deg at i = 1 / 17 on rings 3-4: a visible crease at each arm end).
  it('tub chair shell v3/v4: symmetric, open ~0.50 m mouth, footprint inside 0.38 m (VA-0252, VA-0254)', async () => {
    const THREE = await import('three');
    const { createVelvetTubChair } = await import('../../../art/casino/3d/velvetTubChairPrototype.mjs');
    const tpl = createVelvetTubChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    const p = (tpl.getObjectByName('VA_integrated_tub_shell') as import('three').Mesh).geometry.attributes.position;
    const back = new THREE.Box3().setFromObject(tpl.getObjectByName('VA_tub_back_cushion')!);
    let mouth = Infinity, radius = 0;
    for (let k = 0; k < p.count; k++) {
      if (p.getZ(k) > back.max.z) mouth = Math.min(mouth, Math.abs(p.getX(k)));
      radius = Math.max(radius, Math.hypot(p.getX(k), p.getZ(k)));
    }
    expect(mouth).toBeGreaterThan(0.24);
    expect(radius).toBeLessThanOrEqual(0.38);
    const seg = p.count / 5 - 1;
    for (let j = 0; j < 5; j++) {
      expect(Math.abs(p.getX(j * (seg + 1)))).toBeGreaterThan(0.25);
      expect(p.getX(j * (seg + 1)) + p.getX(j * (seg + 1) + seg)).toBeCloseTo(0, 3);
    }
    const shell = new THREE.Box3().setFromObject(tpl.getObjectByName('VA_integrated_tub_shell')!);
    expect(shell.max.x + shell.min.x).toBeCloseTo(0, 2);
    expect(shell.min.z).toBeLessThanOrEqual(back.min.z);
    expect(shell.max.z).toBeGreaterThanOrEqual(0.1);
    expect(shell.max.y).toBeCloseTo(1.015, 3);
  });
  // 4aad5c9 (v4) commits real newlines: the traced rim is built (540 tris, chair 1,080 -> 1,620), uses the shared
  // brass material and sits on the shell's top ring (rim max y 1.025 = top ring 1.015 + 0.004 lift + 0.006 radius).
  it('tub chair v4 (4aad5c9) builds the traced brass shell rim on the top ring (VA-0254)', async () => {
    const THREE = await import('three');
    const { createVelvetTubChair } = await import('../../../art/casino/3d/velvetTubChairPrototype.mjs');
    const tpl = createVelvetTubChair(THREE) as import('three').Group;
    tpl.updateMatrixWorld(true);
    const rim = tpl.getObjectByName('VA_tub_shell_brass_rim') as import('three').Mesh;
    expect(rim).toBeTruthy();
    expect(rim.material).toBe((tpl.getObjectByName('VA_pedestal_foot') as import('three').Mesh).material);
    const box = new THREE.Box3().setFromObject(rim);
    expect(box.max.y).toBeCloseTo(1.025, 3);
    expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThanOrEqual(0.38);
  });
  // v4 makes |x| monotonic over the last two segments (0.255 -> 0.257..0.271 -> 0.256..0.286), but it pins every ring's
  // tip to x 0.255 and (rings 2-4) y 0.790, so the three upper tip vertices sit within 0.021 m of each other in z only.
  // The tip quads of rings 3-4 are near-degenerate slivers: computeVertexNormals gives inward / asymmetric normals there
  // (adjacent-normal jump 83 deg ring 3, 87 deg ring 4 at i = 17; 32 / 56 deg at i = 0), worse than v3's 55 deg.
  // Kept as an expected failure until the art fixes the tip; work in engineering code would mean changing art values.
  it.fails('tub chair v4 arm tips have no near-degenerate faces (adjacent normals within 45 deg) (VA-0254)', async () => {
    const THREE = await import('three');
    const { createVelvetTubChair } = await import('../../../art/casino/3d/velvetTubChairPrototype.mjs');
    const tpl = createVelvetTubChair(THREE) as import('three').Group;
    const g = (tpl.getObjectByName('VA_integrated_tub_shell') as import('three').Mesh).geometry;
    const n = g.attributes.normal, seg = n.count / 5 - 1;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    let worst = 0;
    for (let j = 0; j < 5; j++) for (let i = 0; i < seg; i++) {
      const k = j * (seg + 1) + i;
      a.fromBufferAttribute(n, k); b.fromBufferAttribute(n, k + 1);
      worst = Math.max(worst, a.angleTo(b) * 180 / Math.PI);
    }
    expect(worst).toBeLessThan(45);
  });
  it('LOD chair keeps its seat cushion, its back meeting the shell centre (VA-0198/VA-0199, read-only check)', async () => {
    const THREE = await import('three');
    const { createVelvetGamingChairLod } = await import('../../../art/casino/3d/velvetGamingChairLod.mjs');
    for (const [detail, meshes] of [['mid', 30], ['near', 36]] as const) {
      const root = createVelvetGamingChairLod(THREE, { detail }) as import('three').Group;
      let n = 0;
      root.traverse((o) => { if ((o as import('three').Mesh).isMesh) n++; });
      expect(n, detail).toBe(meshes);
      const seat = root.getObjectByName('seat_cushion') as import('three').Mesh;
      expect(seat, detail).toBeTruthy();
      seat.geometry.computeBoundingBox();
      const bb = seat.geometry.boundingBox!;
      expect(seat.position.z + bb.max.z).toBeCloseTo(0.19, 3); // rear face
      expect(seat.position.z + bb.min.z).toBeCloseTo(-0.24, 3); // front face, under the roll
    }
  });
  it('LOD chair rails and crest sit on the curved backrest shell (VA-0187/VA-0189 art fit, read-only check)', async () => {
    const THREE = await import('three');
    const { createVelvetGamingChairLod } = await import('../../../art/casino/3d/velvetGamingChairLod.mjs');
    for (const detail of ['mid', 'near'] as const) {
      const root = createVelvetGamingChairLod(THREE, { detail }) as import('three').Group;
      root.updateMatrixWorld(true);
      const shell = root.getObjectByName('sculpted_upholstered_backrest') as import('three').Mesh;
      const pos = shell.geometry.attributes.position;
      const shellPts: import('three').Vector3[] = [];
      for (let i = 0; i < pos.count; i++) shellPts.push(new THREE.Vector3().fromBufferAttribute(pos, i));
      const nearest = (p: import('three').Vector3) => Math.min(...shellPts.map((v) => v.distanceTo(p)));
      const crest: import('three').Mesh[] = [];
      const rails: import('three').Mesh[] = [];
      root.traverse((o) => {
        if (o.name === 'back_gold_top_crest') crest.push(o as import('three').Mesh);
        if (o.name === 'back_gold_edge') rails.push(o as import('three').Mesh);
      });
      expect(crest.length).toBe(detail === 'near' ? 12 : 6);
      // each crest piece's two chord ends land within 1 cm of a top-row shell vertex
      for (const c of crest) {
        c.geometry.computeBoundingBox();
        const hx = c.geometry.boundingBox!.max.x;
        for (const sx of [-hx + 0.001, hx - 0.001]) {
          expect(nearest(new THREE.Vector3(sx, 0, 0).applyMatrix4(c.matrixWorld))).toBeLessThan(0.01);
        }
      }
      // 336a41b: each rail is a tube whose centreline follows the shell's side edge. The rendered edge is the
      // polyline through each row's outermost vertex; the centreline must stay within 5 mm of it, with exact ends.
      expect(rails.length).toBe(2);
      for (const r of rails) {
        const path = (r.geometry as unknown as { parameters: { path: import('three').Curve<import('three').Vector3> } }).parameters.path;
        const side = Math.sign(path.getPoint(0.5).x);
        const rows = new Map<string, import('three').Vector3>();
        for (const v of shellPts) {
          const k = v.y.toFixed(3);
          const cur = rows.get(k);
          if (!cur || v.x * side > cur.x * side) rows.set(k, v.clone().applyMatrix4(shell.matrixWorld));
        }
        const edge = [...rows.values()].sort((a, b) => a.y - b.y);
        const seg = new THREE.Line3();
        const tmp = new THREE.Vector3();
        const toEdge = (c: import('three').Vector3) => Math.min(...edge.slice(1).map((b, i) => {
          seg.set(edge[i], b);
          return seg.closestPointToPoint(c, true, tmp).distanceTo(c);
        }));
        for (let k = 0; k <= 40; k++) {
          const c = path.getPoint(k / 40).applyMatrix4(r.matrixWorld);
          expect(toEdge(c)).toBeLessThan(0.005);
        }
        expect(nearest(path.getPoint(0).applyMatrix4(r.matrixWorld))).toBeLessThan(0.001);
        expect(nearest(path.getPoint(1).applyMatrix4(r.matrixWorld))).toBeLessThan(0.001);
      }
      expect(root.userData.seatHeight).toBeCloseTo(0.615, 3);
    }
  });
  it('tessellates the side-wall machine copies lighter by default, heroes and reels untouched (VA-0196)', async () => {
    const THREE = await import('three');
    const { composeGrandHall, machineDetailFrom } = await import('../src/floor3d/grandHallArt.ts');
    expect(machineDetailFrom('')).toBe('lite');
    expect(machineDetailFrom('?floor3d&machines=full')).toBe('full');
    const measure = (machineDetail: 'lite' | 'full') => {
      const root = composeGrandHall(g, { liftSign: () => 0, ceiling: 'gold-coffers', machineDetail }).root;
      root.updateMatrixWorld(true);
      let copies = 0, heroes = 0;
      const copyGeos = new Set<string>();
      const meshes: string[] = [];
      const box = new THREE.Box3();
      for (const c of root.children) {
        const isCopy = c.name.startsWith('slotcopy_');
        if (!isCopy && !c.name.startsWith('slot_')) continue;
        if (c.name === 'slotcopy_sevens_1') box.setFromObject(c);
        c.traverse((o) => {
          const m = o as import('three').Mesh;
          if (!m.isMesh) return;
          const t = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
          if (isCopy) { copies += t; copyGeos.add(m.geometry.uuid); meshes.push(`${c.name}/${m.name}:${(m.material as import('three').Material).uuid}`); } else heroes += t;
        });
      }
      return { copies, heroes, copyGeos: copyGeos.size, meshes, box };
    };
    const full = measure('full');
    const lite = measure('lite');
    // the interactive heroes keep full detail; the copies lose well over half their triangles
    expect(lite.heroes).toBe(full.heroes);
    expect(lite.copies).toBeLessThan(full.copies * 0.45);
    // same meshes in the same order (names; materials are fresh per build, so only the count)
    expect(lite.meshes.map((k) => k.split(':')[0])).toEqual(full.meshes.map((k) => k.split(':')[0]));
    // a copy's footprint is unchanged to the millimetre (fewer facets, same shapes and sizes)
    for (const k of ['min', 'max'] as const) for (const a of ['x', 'y', 'z'] as const) expect(Math.abs(lite.box[k][a] - full.box[k][a])).toBeLessThan(0.01);
    // copies of a theme share their lite geometry, so batching still merges them
    expect(lite.copyGeos).toBeLessThanOrEqual(full.copyGeos + 10 * 45);
    // reels stay boxes, shared with the hero (artScene swaps their textures per theme)
    const root = composeGrandHall(g, { liftSign: () => 0, machineDetail: 'lite' }).root;
    const hero = root.getObjectByName('slot_sevens')!.getObjectByName('REEL_0_0_SWAP_TEXTURE') as import('three').Mesh;
    const copyReel = root.getObjectByName('slotcopy_sevens_1')!.getObjectByName('REEL_0_0_SWAP_TEXTURE') as import('three').Mesh;
    expect(copyReel.geometry).toBe(hero.geometry);
  });
  it('gives the end-wall heroes a lighter far twin, batched apart, driven parts untouched (VA-0305)', async () => {
    const THREE = await import('three');
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    const { heroLodFull, HERO_LOD_NEAR_M, HERO_LOD_HYSTERESIS_M } = await import('../src/floor3d/grandHallArt.ts');
    const tris = (ms: import('three').Mesh[]) => ms.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
    const off = buildArtScene(new Map(), { layout: g, ceiling: 'gold-coffers' });
    const on = buildArtScene(new Map(), { layout: g, ceiling: 'gold-coffers', heroLod: true });
    expect(off.heroLod).toBeNull();
    const lod = on.heroLod!;
    // one centre per hero, where the layout puts it
    expect(lod.centres.map((c) => [+c.x.toFixed(2), +c.z.toFixed(2)])).toEqual(g.slots.map((s) => [+s.x.toFixed(2), +s.z.toFixed(2)]));
    // the far twins start hidden; the full set is what was drawn before
    expect(lod.lite.length).toBeGreaterThan(0);
    expect(lod.lite.every((m) => !m.visible)).toBe(true);
    expect(lod.full.every((m) => m.visible)).toBe(true);
    // both sets carry the north side-wall copies (the south ones batch apart, VA-0316); the far
    // set saves the heroes' detail (~95k triangles)
    const full = tris(lod.full), lite = tris(lod.lite);
    expect(full).toBeGreaterThan(180_000);
    expect(full - lite).toBeGreaterThan(90_000);
    // the whole batched scene: the same triangles as without the LOD when the full set shows
    const visible = (a: typeof on) => tris(a.root.children.filter((m) => m.visible && !a.whole.combined.includes(m as import('three').Mesh)) as import('three').Mesh[]);
    expect(Math.abs(visible(on) - visible(off))).toBeLessThan(1);
    // reels, spin buttons and marquees: the hero's own, once, at every distance
    expect([...on.interactive.keys()].sort()).toEqual([...off.interactive.keys()].sort());
    expect([...on.reelCopies.keys()].sort()).toEqual([...off.reelCopies.keys()].sort());
    for (const m of [...lod.full, ...lod.lite, ...lod.south, ...lod.liteAll]) expect(m.name).toMatch(/^art:lod:(full|lite|south|liteAll)#/);
    // no lights or other non-mesh extras came along with the twins
    let lightsOn = 0, lightsOff = 0;
    on.root.traverse((o) => { if ((o as import('three').Light).isLight) lightsOn++; });
    off.root.traverse((o) => { if ((o as import('three').Light).isLight) lightsOff++; });
    expect(lightsOn).toBe(lightsOff);
    // draw cost: either set is as many batches as the heroes and copies shared before, plus the
    // south copies' batches (box-culled when behind the camera; world.ts draws liteAll, one batch
    // per material, in place of lite + south when both are in view)
    const shown = (a: typeof on) => a.root.children.filter((m) => m.visible).length;
    expect(shown(on)).toBe(shown(off) + lod.south.length);
    expect(lod.lite.length).toBe(lod.full.length);
    expect(lod.liteAll.length).toBe(lod.full.length);
    // distance switch with hysteresis: full detail near any hero, lite from the far end of the hall
    const c = lod.centres[0];
    expect(heroLodFull(false, c.x, c.z + HERO_LOD_NEAR_M - 1, lod.centres)).toBe(true);
    expect(heroLodFull(true, 0, g.spawn.z, lod.centres)).toBe(false);
    const edge = HERO_LOD_NEAR_M + HERO_LOD_HYSTERESIS_M / 2;
    expect(heroLodFull(true, c.x, c.z + edge, [c])).toBe(true);
    expect(heroLodFull(false, c.x, c.z + edge, [c])).toBe(false);
    void THREE;
  });

  it('splits the side-wall copies at mid-hall so either end can be box-culled (VA-0316)', async () => {
    const THREE = await import('three');
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    const tris = (ms: import('three').Mesh[]) => ms.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
    const off = buildArtScene(new Map(), { layout: g, ceiling: 'gold-coffers' });
    expect(off.boxCull).toEqual([]);
    const on = buildArtScene(new Map(), { layout: g, ceiling: 'gold-coffers', heroLod: true });
    const lod = on.heroLod!;
    // box-tested: the hero sets and the south copies, not the combined set
    expect(on.boxCull.map((e) => e.mesh).sort((a, b) => a.id - b.id)).toEqual([...lod.full, ...lod.lite, ...lod.south].sort((a, b) => a.id - b.id));
    const union = (ms: import('three').Mesh[]) => on.boxCull.filter((e) => ms.includes(e.mesh)).reduce((b, e) => b.union(e.box), new THREE.Box3());
    const north = union(lod.full), south = union(lod.south);
    // the two ends don't overlap: the hero sets stop before mid-hall, the south copies start after it
    expect(north.max.z).toBeLessThan(-5);
    expect(south.min.z).toBeGreaterThan(5);
    // every box holds its batch
    for (const { mesh, box } of on.boxCull) {
      mesh.geometry.computeBoundingBox();
      expect(box.containsBox(mesh.geometry.boundingBox!)).toBe(true);
    }
    // the combined lite set is the twins plus every copy: what lite + south draw, hidden until needed
    expect(lod.liteAll.every((m) => !m.visible)).toBe(true);
    expect(Math.abs(tris(lod.liteAll) - tris(lod.lite) - tris(lod.south))).toBeLessThan(1);
    expect(tris(lod.south)).toBeGreaterThan(30_000);
    // a camera mid-hall looking at the heroes: the south copies' box is behind it, the heroes' isn't
    const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 100);
    cam.position.set(0, 1.7, 6);
    cam.lookAt(0, 1.6, -17);
    cam.updateMatrixWorld();
    const f = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    expect(f.intersectsBox(south)).toBe(false);
    expect(f.intersectsBox(north)).toBe(true);
    // ...where three.js's own sphere test would still draw every south batch
    expect(lod.south.every((m) => f.intersectsObject(m))).toBe(true);
  });
  it('adds ChatGPT\'s far cabinet as a third hero level behind ?herofar=on, fitted to the hero (VA-0330)', async () => {
    const THREE = await import('three');
    const { buildArtScene } = await import('../src/floor3d/artScene.ts');
    const { composeGrandHall, fittedFarHero, heroLodLevel, HERO_LOD_NEAR_M, HERO_LOD_FAR_M, HERO_LOD_HYSTERESIS_M } = await import('../src/floor3d/grandHallArt.ts');
    const tris = (ms: import('three').Mesh[]) => ms.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
    const base = buildArtScene(new Map(), { layout: g, ceiling: 'gold-coffers', heroLod: true });
    const on = buildArtScene(new Map(), { layout: g, ceiling: 'gold-coffers', heroLod: true, heroFar: true });
    expect(base.heroLod!.far).toEqual([]);
    const lod = on.heroLod!;
    // hidden until the camera is far; the other sets are what they were without it
    expect(lod.far.length).toBeGreaterThan(0);
    expect(lod.far.every((m) => !m.visible)).toBe(true);
    for (const k of ['full', 'lite', 'south', 'liteAll'] as const) expect(Math.abs(tris(lod[k]) - tris(base.heroLod![k]))).toBeLessThan(1);
    expect(base.heroLod!.farAll).toEqual([]);
    // the far set is the north copies (in every hero set) plus ten 204-tri cabinets (236 minus the
    // 32-tri button; the hero keeps its own); it saves the lite twins' triangles
    const grand = composeGrandHall(g, { liftSign: () => 0, heroLod: true, heroFar: true }).root;
    const groupTris = (prefix: string) => {
      const ms: import('three').Mesh[] = [];
      for (const o of grand.children) if (o.name.startsWith(prefix)) o.traverse((m) => { if ((m as import('three').Mesh).isMesh) ms.push(m as import('three').Mesh); });
      return tris(ms);
    };
    expect(groupTris('slotfar_')).toBe(10 * 204);
    expect(Math.abs(tris(lod.far) - (tris(lod.lite) - groupTris('slotlod_') + 10 * 204))).toBeLessThan(1);
    expect(tris(lod.lite) - tris(lod.far)).toBeGreaterThan(30_000);
    console.log(`hero LOD tris: full ${tris(lod.full)} lite ${tris(lod.lite)} far ${tris(lod.far)} south ${tris(lod.south)}; batches full ${lod.full.length} lite ${lod.lite.length} far ${lod.far.length}`);
    // farAll is far + south in one batch per material, hidden; box-tested sets are full, lite, far, south
    expect(lod.farAll.every((m) => !m.visible)).toBe(true);
    expect(Math.abs(tris(lod.farAll) - tris(lod.far) - tris(lod.south))).toBeLessThan(1);
    expect(lod.farAll.length).toBe(lod.far.length);
    expect(on.boxCull.map((e) => e.mesh).sort((x, y) => x.id - y.id)).toEqual([...lod.full, ...lod.lite, ...lod.far, ...lod.south].sort((x, y) => x.id - y.id));
    // a handful of extra batches at most (the far cabinet's 5 materials)
    expect(lod.far.length - lod.lite.length).toBeLessThanOrEqual(5);
    // driven parts stay the hero's own
    expect([...on.interactive.keys()].sort()).toEqual([...base.interactive.keys()].sort());
    for (const m of lod.far) expect(m.name).toMatch(/^art:lod:far#/);
    // fitted to the hero's envelope (to the millimetre), standing on the floor
    const root = composeGrandHall(g, { liftSign: () => 0, heroLod: true, heroFar: true }).root;
    root.updateMatrixWorld(true);
    const hero = root.getObjectByName('slot_sevens')!.children[0];
    const far = root.getObjectByName('slotfar_sevens')!;
    const hb = new THREE.Box3().setFromObject(hero), fb = new THREE.Box3().setFromObject(far);
    for (const k of ['min', 'max'] as const) for (const a of ['x', 'y', 'z'] as const) expect(Math.abs(fb[k][a] - hb[k][a])).toBeLessThan(0.002);
    expect(far.getObjectByName('spin_button')).toBeUndefined();
    expect(fittedFarHero(hero).getObjectByName('screen_1_display')).toBeTruthy();
    // three levels with hysteresis at both edges; without a far set it never says 'far'
    const c = { x: 0, z: 0 };
    const at = (prev: 'full' | 'lite' | 'far', d: number, hasFar = true) => heroLodLevel(prev, 0, d, [c], hasFar);
    expect(at('lite', HERO_LOD_NEAR_M - 1)).toBe('full');
    expect(at('full', HERO_LOD_NEAR_M + HERO_LOD_HYSTERESIS_M / 2)).toBe('full');
    expect(at('lite', HERO_LOD_NEAR_M + HERO_LOD_HYSTERESIS_M / 2)).toBe('lite');
    expect(at('lite', HERO_LOD_FAR_M + HERO_LOD_HYSTERESIS_M / 2)).toBe('lite');
    expect(at('far', HERO_LOD_FAR_M + HERO_LOD_HYSTERESIS_M / 2)).toBe('far');
    expect(at('far', HERO_LOD_FAR_M - HERO_LOD_HYSTERESIS_M * 2)).toBe('lite');
    expect(at('full', 30)).toBe('far');
    expect(at('full', 30, false)).toBe('lite');
    // the spawn (z 14.5) is far from every hero
    expect(heroLodLevel('full', g.spawn.x, g.spawn.z, lod.centres, true)).toBe('far');
  });
  it('drops the floating cove strips with the hall slab when the gold coffers are on (VA-0179)', async () => {
    const { composeGrandHall } = await import('../src/floor3d/grandHallArt.ts');
    const count = (ceiling: 'hall' | 'gold-coffers', re: RegExp) => {
      let n = 0;
      composeGrandHall(g, { liftSign: () => 0, ceiling }).root.traverse((o) => { if (re.test(o.name)) n++; });
      return n;
    };
    expect(count('hall', /^warm-cove-strip$/)).toBeGreaterThan(0);
    expect(count('gold-coffers', /^warm-cove-strip$/)).toBe(0);
    // walls, crown and colonnade are not part of the swap
    expect(count('gold-coffers', /^(?!warm-cove-strip$|ceiling-base$|coffer-)/)).toBeGreaterThan(0);
  });
});

describe('prototype badge', () => {
  it('stays one short line on a 360 px phone for every art combination', async () => {
    const { protoBadge } = await import('../src/floor3d/badge.ts');
    for (const pilot05 of [false, true]) for (const blackjackHero of [false, true]) for (const wovenCarpet of [false, true]) {
      expect(protoBadge({ pilot05, blackjackHero, wovenCarpet }).length).toBeLessThanOrEqual(49);
    }
    expect(protoBadge({ pilot05: true, blackjackHero: true, wovenCarpet: true })).toBe('PROTOTYPE · ART 05+BJ+CARPET · PLACEHOLDER PEOPLE');
    expect(protoBadge({ pilot05: false, blackjackHero: true, wovenCarpet: true })).toBe('PROTOTYPE · ART 04 · PLACEHOLDER PEOPLE');
  });
});

describe('fps readout', () => {
  it('is two lines short enough for the strip beside the joystick on a 360 px phone', async () => {
    const { perfText } = await import('../src/floor3d/badge.ts');
    // 360 − 172 (joystick + gap) − 10 px margin = 178 px; 11 px monospace is about 6.6 px a character
    const worst = perfText({ fps: 120, intervalP95Ms: 1000, cpuAvgMs: 100, drawCalls: 999 }).split('\n');
    expect(worst).toHaveLength(2);
    for (const line of worst) expect(line.length).toBeLessThanOrEqual(26);
    expect(perfText({ fps: 59.6, intervalP95Ms: 17.04, cpuAvgMs: 3.25, drawCalls: 92 })).toBe('60 fps · p95 17.0 ms\ncpu 3.3 ms · 92 calls');
  });
});

describe('woven medallion carpet texture (436ef01, VA-0234, ?carpetart=on)', () => {
  const stubCanvas = () => {
    const ctx = new Proxy({} as Record<string, unknown>, { get: (t, k) => (k in t ? t[k as string] : () => {}), set: (t, k, v) => ((t[k as string] = v), true) });
    return { width: 0, height: 0, getContext: () => ctx };
  };
  it('is off by default and only swaps the hall carpet texture: same mesh, footprint and square repeat', async () => {
    const THREE = await import('three');
    const { carpetArtFrom, composeGrandHall, CARPET_ART_SIZE } = await import('../src/floor3d/grandHallArt.ts');
    const { grandHallLayout, GRAND_SPEC } = await import('../src/floor3d/grandHall.ts');
    expect(carpetArtFrom('')).toBe(false);
    expect(carpetArtFrom('?floor3d&carpetart=on')).toBe(true);
    expect(carpetArtFrom('?carpetart=1')).toBe(false);
    const { grandFloorLayout } = await import('../src/floor3d/grandHall.ts');
    const g = grandFloorLayout();
    type Plane = InstanceType<typeof THREE.Mesh<InstanceType<typeof THREE.PlaneGeometry>>>;
    const carpetOf = (root: InstanceType<typeof THREE.Group>) => root.getObjectByName('VA_opt_in_patterned_carpet') as Plane;
    const off = composeGrandHall(g, { liftSign: () => 0, carpetCanvas: stubCanvas() });
    const on = composeGrandHall(g, { liftSign: () => 0, carpetCanvas: stubCanvas(), carpetArt: true });
    expect(off.carpetArt).toBe(false);
    expect(on.carpetArt).toBe(true);
    const a = carpetOf(off.root), b = carpetOf(on.root);
    expect(b.userData.carpetArt).toBe('436ef01');
    expect(a.userData.carpetArt).toBeUndefined();
    expect(b.position.toArray()).toEqual(a.position.toArray());
    expect(b.geometry.parameters).toEqual(a.geometry.parameters);
    const map = (b.material as InstanceType<typeof THREE.MeshStandardMaterial>).map!;
    expect(map.userData.velvetArt.textureSize).toBe(CARPET_ART_SIZE);
    const { width, height } = b.geometry.parameters;
    // square tiles: metres per repeat equal on both axes, and the same as the damask's
    expect(width / map.repeat.x).toBeCloseTo(height / map.repeat.y, 6);
    expect(width / map.repeat.x).toBeCloseTo(b.userData.repeatMeters, 6);
    // still exactly one carpet mesh
    let n = 0;
    on.root.traverse((o) => { if (o.name === 'VA_opt_in_patterned_carpet') n++; });
    expect(n).toBe(1);
    // no canvas, no texture: the placeholder floor stays and nothing throws
    expect(composeGrandHall(g, { liftSign: () => 0, carpetArt: true }).carpetArt).toBe(false);
  });
  it('?carpetart=vine selects the woven-vine overlay (ca3a8ec, VA-0236) on the same mesh and square repeat', async () => {
    const THREE = await import('three');
    const { carpetArtFrom, carpetMotifFrom, composeGrandHall } = await import('../src/floor3d/grandHallArt.ts');
    const { grandFloorLayout } = await import('../src/floor3d/grandHall.ts');
    expect(carpetArtFrom('?carpetart=vine')).toBe(true);
    expect(carpetMotifFrom('?carpetart=vine')).toBe('woven-vine');
    expect(carpetMotifFrom('?carpetart=on')).toBe('medallion');
    expect(carpetMotifFrom('')).toBe('medallion');
    const g = grandFloorLayout();
    type Plane = InstanceType<typeof THREE.Mesh<InstanceType<typeof THREE.PlaneGeometry>>>;
    const med = composeGrandHall(g, { liftSign: () => 0, carpetCanvas: stubCanvas(), carpetArt: true, carpetMotif: 'medallion' });
    const vine = composeGrandHall(g, { liftSign: () => 0, carpetCanvas: stubCanvas(), carpetArt: true, carpetMotif: 'woven-vine' });
    expect(med.carpetMotif).toBe('medallion');
    expect(vine.carpetMotif).toBe('woven-vine');
    const a = med.root.getObjectByName('VA_opt_in_patterned_carpet') as Plane;
    const b = vine.root.getObjectByName('VA_opt_in_patterned_carpet') as Plane;
    expect(a.userData.carpetArt).toBe('436ef01');
    expect(b.userData.carpetArt).toBe('ca3a8ec');
    const ma = (a.material as InstanceType<typeof THREE.MeshStandardMaterial>).map!;
    const mb = (b.material as InstanceType<typeof THREE.MeshStandardMaterial>).map!;
    expect(mb.userData.velvetArt.motif).toBe('woven-vine');
    expect(ma.userData.velvetArt.motif).toBe('medallion');
    expect(mb.repeat.toArray()).toEqual(ma.repeat.toArray());
    expect(b.position.toArray()).toEqual(a.position.toArray());
    expect(b.geometry.parameters).toEqual(a.geometry.parameters);
  });
  it('?carpetart=damask2 selects the interlaced damask (5c65389, VA-0238) on the same mesh and square repeat', async () => {
    const THREE = await import('three');
    const { carpetArtFrom, carpetMotifFrom, composeGrandHall } = await import('../src/floor3d/grandHallArt.ts');
    const { grandFloorLayout } = await import('../src/floor3d/grandHall.ts');
    expect(carpetArtFrom('?carpetart=damask2')).toBe(true);
    expect(carpetMotifFrom('?carpetart=damask2')).toBe('interlaced-damask');
    expect(carpetMotifFrom('?carpetart=vine')).toBe('woven-vine');
    const g = grandFloorLayout();
    type Plane = InstanceType<typeof THREE.Mesh<InstanceType<typeof THREE.PlaneGeometry>>>;
    const med = composeGrandHall(g, { liftSign: () => 0, carpetCanvas: stubCanvas(), carpetArt: true, carpetMotif: 'medallion' });
    const d2 = composeGrandHall(g, { liftSign: () => 0, carpetCanvas: stubCanvas(), carpetArt: true, carpetMotif: 'interlaced-damask' });
    expect(d2.carpetMotif).toBe('interlaced-damask');
    const a = med.root.getObjectByName('VA_opt_in_patterned_carpet') as Plane;
    const b = d2.root.getObjectByName('VA_opt_in_patterned_carpet') as Plane;
    expect(b.userData.carpetArt).toBe('5c65389');
    const ma = (a.material as InstanceType<typeof THREE.MeshStandardMaterial>).map!;
    const mb = (b.material as InstanceType<typeof THREE.MeshStandardMaterial>).map!;
    expect(mb.userData.velvetArt.motif).toBe('interlaced-damask');
    expect(mb.repeat.toArray()).toEqual(ma.repeat.toArray());
    expect(b.position.toArray()).toEqual(a.position.toArray());
    expect(b.geometry.parameters).toEqual(a.geometry.parameters);
  });
});
