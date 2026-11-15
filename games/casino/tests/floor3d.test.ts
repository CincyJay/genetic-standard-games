import { describe, expect, it } from 'vitest';
import { LIMITS, blendPose, overviewFov, clampZoom, cutawayWalls, desiredPose, turnToward } from '../src/floor3d/camera.ts';
import { AGENT_RADIUS, OBSTACLES, ROOM, SEATS, SLOTS, SPAWN, TABLE } from '../src/floor3d/layout.ts';
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
  it('every slot cabinet can be walked up to, except the four the art puts a bench in front of', () => {
    // Art pass 02 places velvet benches (x ±5.2, z -3.8 and 1.1) across the fronts of these
    // cabinets. Reported to ChatGPT (art owns placement); this test fails when it's fixed.
    const blockedByBench = ['lanterns', 'ocean', 'empire', 'tiger'];
    const blocked: string[] = [];
    for (const s of SLOTS) {
      const front = { x: s.x + (s.x < 0 ? 1 : -1) * 1.0, z: s.z };
      if (!nav.walkableAt(front)) blocked.push(s.id);
      else expect(nav.findPath(SPAWN, front), s.id).not.toBeNull();
    }
    expect(blocked.sort()).toEqual(blockedByBench.sort());
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
  it('zoom stays within limits', () => {
    expect(clampZoom('follow', 100)).toBe(LIMITS.follow.max);
    expect(clampZoom('overview', 0)).toBe(LIMITS.overview.min);
  });
  it('turns the short way round', () => {
    expect(turnToward(3, -3, 0.1)).toBeCloseTo(3.1);
    expect(turnToward(0, 0.05, 0.1)).toBe(0.05);
  });
});
