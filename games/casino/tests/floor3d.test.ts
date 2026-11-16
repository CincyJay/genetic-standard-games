import { describe, expect, it } from 'vitest';
import { AVATAR_FADE_MIN, LIMITS, LOOK_UP_MAX, avatarOpacity, blendPose, overviewFov, clampZoom, cutawayWalls, desiredPose, turnToward } from '../src/floor3d/camera.ts';
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
  it('the landscape follow view sits lower than portrait, so more of the ceiling shows', () => {
    const portrait = desiredPose('follow', { x: 0, z: 0 }, 0, 4.2, { aspect: 0.46 });
    const landscape = desiredPose('follow', { x: 0, z: 0 }, 0, 4.2, { aspect: 2.17 });
    expect(landscape.pos.y).toBeLessThan(portrait.pos.y);
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
  it('zoom stays within limits', () => {
    expect(clampZoom('follow', 100)).toBe(LIMITS.follow.max);
    expect(clampZoom('overview', 0)).toBe(LIMITS.overview.min);
  });
  it('turns the short way round', () => {
    expect(turnToward(3, -3, 0.1)).toBeCloseTo(3.1);
    expect(turnToward(0, 0.05, 0.1)).toBe(0.05);
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
    expect(a.batches).toBeLessThanOrEqual(115);
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
});
