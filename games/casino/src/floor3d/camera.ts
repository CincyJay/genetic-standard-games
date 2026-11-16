/**
 * The two approved floor cameras (VA-0015) as pure math, so they're unit-tested:
 * - follow: behind and slightly above the avatar, turning with it;
 * - overview: a high angled view of the room, Sims-style, for finding seats and tap-walking.
 * Switching blends position, target and field of view over TRANSITION_MS (instant with reduced
 * motion). Pinch zoom changes the distance within each mode's limits.
 */
import { AVATAR_HEIGHT, ROOM, type Vec2 } from './layout.ts';

export type CamMode = 'follow' | 'overview';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CamPose {
  pos: Vec3;
  target: Vec3;
  fov: number;
}

export const TRANSITION_MS = 500;

export const LIMITS: Record<CamMode, { min: number; max: number; initial: number }> = {
  follow: { min: 2.4, max: 7, initial: 4.2 },
  overview: { min: 10, max: 24, initial: 17 },
};

const FOLLOW_PITCH = (16 * Math.PI) / 180;
const OVERVIEW_PITCH = (54 * Math.PI) / 180;
const FOLLOW_LOOK_AHEAD = 1.2;
const BLOCKED_EXTRA_PITCH = (34 * Math.PI) / 180;
const FOLLOW_MAX_PITCH = (70 * Math.PI) / 180;
/** Sideways the view is shorter, so the follow camera sits lower to keep the ceiling in frame. */
const FOLLOW_LANDSCAPE_PITCH = (9 * Math.PI) / 180;
/** How far a vertical drag can tilt the follow view up (the camera drops behind the avatar). */
export const LOOK_UP_MAX = (26 * Math.PI) / 180;
/** The lowest the follow camera goes while looking up. */
const LOOK_UP_MIN_Y = 0.45;
/** The overview looks from the entrance's south-east corner toward the back of the room. */
export const OVERVIEW_YAW = (-35 * Math.PI) / 180;
/** Vertical field of view. Phones are tall, so these are wider than a landscape game's. */
const FOV: Record<CamMode, number> = { follow: 72, overview: 50 };
/**
 * The overview keeps at least this much horizontal view, so a tall phone still sees across
 * the room: its vertical field of view widens as the screen narrows (up to OVERVIEW_MAX_FOV).
 */
const OVERVIEW_H_FOV = 42;
const FOLLOW_LANDSCAPE_FOV = 50;
const OVERVIEW_MAX_FOV = 80;

/** The overview's vertical field of view for a screen of this aspect (width / height). */
export function overviewFov(aspect: number): number {
  const v = (2 * Math.atan(Math.tan((OVERVIEW_H_FOV * Math.PI) / 360) / aspect) * 180) / Math.PI;
  return Math.min(OVERVIEW_MAX_FOV, Math.max(FOV.overview, v));
}

/** The overview's camera-relative ground axes, for turning a screen drag into a pan. */
export const OVERVIEW_AXES = {
  right: { x: Math.cos(OVERVIEW_YAW), z: Math.sin(OVERVIEW_YAW) },
  forward: { x: Math.sin(OVERVIEW_YAW), z: -Math.cos(OVERVIEW_YAW) },
};

export interface PoseOptions {
  /** Follow view: how far the camera can back away before hitting something (a ray cast). */
  obstacleDist?: number;
  /** Screen width / height. */
  aspect?: number;
  /** Overview: how far the player has dragged the view away from the avatar, in metres. */
  pan?: Vec2;
  /** Follow view: extra tilt (radians) to look over low furniture such as a chair back. */
  extraPitch?: number;
  /** Follow view: how far (radians, 0..LOOK_UP_MAX) the player has tilted the view up. */
  lookUp?: number;
}
/** How close the follow camera may get to a wall, and how far below the wall tops it stays. */
const WALL_MARGIN = 0.25;

export const clampZoom = (mode: CamMode, d: number): number => Math.min(LIMITS[mode].max, Math.max(LIMITS[mode].min, d));

/** Where the camera wants to be. `heading` is the avatar's (0 faces -Z), `dist` the current zoom. */
export function desiredPose(mode: CamMode, avatar: Vec2, heading: number, dist: number, opts: PoseOptions = {}): CamPose {
  const obstacleDist = opts.obstacleDist ?? Infinity;
  if (mode === 'follow') {
    // aim a little ahead of the avatar, so it sits low in the frame and the way ahead shows
    // looking up: the camera swings down behind the avatar and aims a little higher, so the
    // ceiling and chandeliers fill the top of the screen while the avatar stays in frame
    const lookUp = Math.min(LOOK_UP_MAX, Math.max(0, opts.lookUp ?? 0));
    const target = { x: avatar.x + Math.sin(heading) * FOLLOW_LOOK_AHEAD, y: AVATAR_HEIGHT * 0.7 + lookUp * 1.1, z: avatar.z - Math.cos(heading) * FOLLOW_LOOK_AHEAD };
    const d = Math.min(dist, Math.max(0.6, obstacleDist - 0.2));
    // pulled in by a wall or prop: rise and look down more, so the floor ahead stays in view
    const base = opts.aspect && opts.aspect > 1 ? FOLLOW_LANDSCAPE_PITCH : FOLLOW_PITCH;
    const pitch = Math.min(FOLLOW_MAX_PITCH, base - lookUp + (opts.extraPitch ?? 0) + Math.min(1, Math.max(0, (dist - d) / dist)) * BLOCKED_EXTRA_PITCH);
    // behind the avatar: opposite its walking direction (sin h, -cos h)
    let pos = {
      x: target.x - Math.sin(heading) * d * Math.cos(pitch),
      y: target.y + d * Math.sin(pitch),
      z: target.z + Math.cos(heading) * d * Math.cos(pitch),
    };
    pos = clampInsideRoom(pos);
    pos.y = Math.max(LOOK_UP_MIN_Y, pos.y);
    // sideways the screen is already wide: a narrower vertical view avoids a fish-eye look
    return { pos, target, fov: opts.aspect && opts.aspect > 1 ? FOLLOW_LANDSCAPE_FOV : FOV.follow };
  }
  // the overview frames the avatar (plus any drag) but never drifts far outside the room
  const pan = opts.pan ?? { x: 0, z: 0 };
  const target = {
    x: Math.min(ROOM.x1 - 3, Math.max(ROOM.x0 + 3, avatar.x + pan.x)),
    y: 0,
    z: Math.min(ROOM.z1 - 3, Math.max(ROOM.z0 + 3, avatar.z + pan.z)),
  };
  const pos = {
    x: target.x - Math.sin(OVERVIEW_YAW) * dist * Math.cos(OVERVIEW_PITCH),
    y: target.y + dist * Math.sin(OVERVIEW_PITCH),
    z: target.z + Math.cos(OVERVIEW_YAW) * dist * Math.cos(OVERVIEW_PITCH),
  };
  return { pos, target, fov: opts.aspect ? overviewFov(opts.aspect) : FOV.overview };
}

/** Keeps the follow camera inside the walls and under their tops, so it never clips through. */
export function clampInsideRoom(p: Vec3): Vec3 {
  return {
    x: Math.min(ROOM.x1 - WALL_MARGIN, Math.max(ROOM.x0 + WALL_MARGIN, p.x)),
    y: Math.min(ROOM.wallHeight - WALL_MARGIN, Math.max(0.4, p.y)),
    z: Math.min(ROOM.z1 - WALL_MARGIN, Math.max(ROOM.z0 + WALL_MARGIN, p.z)),
  };
}

export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });

/** Blends from a snapshot pose toward the (possibly moving) desired pose; t runs 0..1. */
export function blendPose(from: CamPose, to: CamPose, t: number): CamPose {
  const k = easeInOutCubic(Math.min(1, Math.max(0, t)));
  return { pos: lerp3(from.pos, to.pos, k), target: lerp3(from.target, to.target, k), fov: lerp(from.fov, to.fov, k) };
}

/**
 * Which walls the overview camera looks through. They're hidden (a cutaway) so the room
 * stays visible from above. Walls are named by the side of the room they're on.
 */
export function cutawayWalls(pos: Vec3): Set<'north' | 'south' | 'east' | 'west'> {
  const s = new Set<'north' | 'south' | 'east' | 'west'>();
  if (pos.z > ROOM.z1) s.add('south');
  if (pos.z < ROOM.z0) s.add('north');
  if (pos.x > ROOM.x1) s.add('east');
  if (pos.x < ROOM.x0) s.add('west');
  return s;
}

/** Turns the shortest way from angle a toward b by at most `step` radians. */
export function turnToward(a: number, b: number, step: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) <= step ? b : a + Math.sign(d) * step;
}
