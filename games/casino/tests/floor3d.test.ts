import { describe, expect, it } from 'vitest';
import { AVATAR_FADE_MIN, LIMITS, LOOK_UP_MAX, avatarOpacity, blendPose, overviewFov, clampZoom, cutawayWalls, desiredPose, FOCUS, machineFocus, PROP_FADE_MIN, propOpacity, turnToward } from '../src/floor3d/camera.ts';
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
    // interactive parts are never colour-merged: each cabinet keeps its own reels, button and marquee
    for (const m of a.interactive.values()) expect(m.geometry.attributes.color).toBeUndefined();
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
    expect(nextLightMode(nextLightMode('vegas'))).toBe('vegas');
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
