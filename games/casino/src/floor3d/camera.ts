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
/**
 * Over-the-shoulder offset (metres, to the avatar's right) for the follow camera, so the
 * placeholder avatar sits left of centre instead of covering the middle of the view.
 * Landscape is wider, so it can move further aside.
 */
export const FOLLOW_SHOULDER = { portrait: 0.32, landscape: 0.55 };
/**
 * Portrait only: the follow camera and its aim point both sit this much lower (a pure vertical
 * shift, same angle and distance). Without it the avatar's feet landed at ~81 % of the screen
 * height, inside the joystick ring on 360×780 and 384×832 phones (VA-0098); lowered, they sit
 * above it and more of the ceiling shows.
 */
export const FOLLOW_PORTRAIT_DROP = 0.3;
/** Within this distance of the avatar's middle the follow camera fades the avatar out. */
export const AVATAR_FADE_NEAR = 1.6;
export const AVATAR_FADE_MIN = 0.3;
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
  /** Follow view: a machine the avatar has walked up to (see machineFocus), framed beside the avatar. */
  focus?: MachineFocus;
}

/**
 * Machine framing (VA-0043): walking up to a slot used to leave the avatar dead centre, covering
 * the screen. Within FOCUS.range metres of a cabinet's front and roughly facing it, the follow
 * camera aims at the screen, swings round to the avatar's right (a front three-quarter view, like
 * the reference photo) and closes in, so the avatar sits to the left and the machine fills the view.
 */
export const FOCUS = {
  /** Fully framed within `near` metres of the cabinet front; no effect beyond `range`. */
  near: 1.6,
  range: 2.8,
  /** Facing within `cone` of the machine counts fully; beyond `coneMax` not at all. */
  cone: (25 * Math.PI) / 180,
  coneMax: (60 * Math.PI) / 180,
  /** Height of the aim point: about the middle of the hero's enlarged glass. */
  screenY: 1.45,
  /** How far the camera swings round the aim point to the avatar's right. */
  orbit: (24 * Math.PI) / 180,
  /** The follow distance closes in to at most this when fully framed. */
  dist: 3.0,
  /** The cabinet's screen face, metres in front of its centre. */
  faceOffset: 0.3,
} as const;

export interface MachineFocus {
  id: string;
  /** The aim point on the machine's screen. */
  point: Vec3;
  /** 0..1, how strongly to frame it. */
  weight: number;
}

/** The machine (if any) the avatar is walking up to, and how strongly to frame it. */
export function machineFocus(avatar: Vec2, heading: number, slots: readonly { id: string; x: number; z: number; rotationY: number }[]): MachineFocus | null {
  let best: MachineFocus | null = null;
  const fx = Math.sin(heading);
  const fz = -Math.cos(heading);
  for (const s of slots) {
    // a cabinet faces its local +Z, turned by rotationY
    const nx = Math.sin(s.rotationY);
    const nz = Math.cos(s.rotationY);
    const face = { x: s.x + nx * FOCUS.faceOffset, z: s.z + nz * FOCUS.faceOffset };
    const dx = face.x - avatar.x;
    const dz = face.z - avatar.z;
    // only from in front of the machine
    if (dx * nx + dz * nz > 0) continue;
    const dist = Math.hypot(dx, dz);
    if (dist >= FOCUS.range) continue;
    const angle = dist < 1e-6 ? 0 : Math.acos(Math.min(1, Math.max(-1, (dx * fx + dz * fz) / dist)));
    if (angle >= FOCUS.coneMax) continue;
    const wd = Math.min(1, (FOCUS.range - dist) / (FOCUS.range - FOCUS.near));
    const wa = Math.min(1, (FOCUS.coneMax - angle) / (FOCUS.coneMax - FOCUS.cone));
    const weight = wd * wa;
    if (weight > 0 && (!best || weight > best.weight)) best = { id: s.id, point: { x: face.x, y: FOCUS.screenY, z: face.z }, weight };
  }
  return best;
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
    // the shoulder offset moves camera and aim point together to the avatar's right (cos h, sin h)
    const landscape = !!opts.aspect && opts.aspect > 1;
    const shoulder = landscape ? FOLLOW_SHOULDER.landscape : FOLLOW_SHOULDER.portrait;
    const sx = Math.cos(heading) * shoulder;
    const drop = opts.aspect && opts.aspect < 1 ? FOLLOW_PORTRAIT_DROP : 0;
    const sz = Math.sin(heading) * shoulder;
    let target = { x: avatar.x + sx + Math.sin(heading) * FOLLOW_LOOK_AHEAD, y: AVATAR_HEIGHT * 0.7 - drop + lookUp * 1.1, z: avatar.z + sz - Math.cos(heading) * FOLLOW_LOOK_AHEAD };
    // framing a machine: aim at its screen, swing to the avatar's right and close in
    const w = opts.focus ? Math.min(1, Math.max(0, opts.focus.weight)) : 0;
    const yaw = heading - w * FOCUS.orbit;
    if (w > 0) target = lerp3(target, { ...opts.focus!.point, y: opts.focus!.point.y + lookUp * 1.1 }, w);
    const zoom = w > 0 ? lerp(dist, Math.min(dist, FOCUS.dist), w) : dist;
    const d = Math.min(zoom, Math.max(0.6, obstacleDist - 0.2));
    // pulled in by a wall or prop: rise and look down more, so the floor ahead stays in view
    const base = landscape ? FOLLOW_LANDSCAPE_PITCH : FOLLOW_PITCH;
    const pitch = Math.min(FOLLOW_MAX_PITCH, base - lookUp + (opts.extraPitch ?? 0) + Math.min(1, Math.max(0, (zoom - d) / zoom)) * BLOCKED_EXTRA_PITCH);
    // behind the avatar: opposite its walking direction (sin h, -cos h), swung by any framing
    let pos = {
      x: target.x - Math.sin(yaw) * d * Math.cos(pitch),
      y: target.y + d * Math.sin(pitch),
      z: target.z + Math.cos(yaw) * d * Math.cos(pitch),
    };
    pos = clampInsideRoom(pos);
    pos.y = Math.max(LOOK_UP_MIN_Y, pos.y);
    // sideways the screen is already wide: a narrower vertical view avoids a fish-eye look
    return { pos, target, fov: opts.aspect && opts.aspect > 1 ? FOLLOW_LANDSCAPE_FOV : FOV.follow };
  }
  // the overview frames the avatar (plus any drag) but never drifts far outside the room.
  // On a tall screen the aim moves ahead of the avatar (see overviewLift), so the avatar sits low
  // in the frame and the room, not the dark ground behind the camera, fills the bottom.
  const pan = opts.pan ?? { x: 0, z: 0 };
  const fov = opts.aspect ? overviewFov(opts.aspect) : FOV.overview;
  const lift = overviewLift(dist, fov);
  const target = {
    x: Math.min(ROOM.x1 - 3, Math.max(ROOM.x0 + 3, avatar.x + pan.x + OVERVIEW_AXES.forward.x * lift)),
    y: 0,
    z: Math.min(ROOM.z1 - 3, Math.max(ROOM.z0 + 3, avatar.z + pan.z + OVERVIEW_AXES.forward.z * lift)),
  };
  const pos = {
    x: target.x - Math.sin(OVERVIEW_YAW) * dist * Math.cos(OVERVIEW_PITCH),
    y: target.y + dist * Math.sin(OVERVIEW_PITCH),
    z: target.z + Math.cos(OVERVIEW_YAW) * dist * Math.cos(OVERVIEW_PITCH),
  };
  // a hall with side walls (the grand hall) keeps the camera between them: the whole view slides
  // sideways, at the same angle, so the side wall stays up and frames the floor instead of being
  // cut away onto the empty ground outside
  if (overviewSides) {
    const x = Math.min(overviewSides.x1, Math.max(overviewSides.x0, pos.x));
    target.x += x - pos.x;
    pos.x = x;
  }
  return { pos, target, fov };
}

let overviewSides: { x0: number; x1: number } | null = null;
/**
 * Where the overview camera may stand across the hall (x), or null for anywhere (the salon,
 * whose surroundings have the exterior backdrop). Keep the range inside ROOM's x so the side
 * walls aren't cut away.
 */
export function setOverviewSides(sides: { x0: number; x1: number } | null): void {
  overviewSides = sides;
}

/** On the tallest screens the overview puts the avatar this far below the middle (NDC, 0..1). */
export const OVERVIEW_PORTRAIT_DROP = 0.42;

/**
 * How far (metres, along OVERVIEW_AXES.forward) the overview aims ahead of the avatar (VA-0056).
 * A tall phone widens the overview's vertical view to ~80 degrees; at a 54 degree pitch its
 * bottom edge then looks past straight down, behind the camera, so in portrait the lower third
 * of the screen showed the dark ground outside the room. Aiming ahead moves the avatar down to
 * OVERVIEW_PORTRAIT_DROP of the half-height (scaled by how much wider than the landscape view
 * the screen made it) and fills that space with room. Landscape (50 degrees) is unchanged.
 */
export function overviewLift(dist: number, fov: number): number {
  const k = Math.min(1, Math.max(0, (fov - FOV.overview) / (OVERVIEW_MAX_FOV - FOV.overview)));
  if (k <= 0) return 0;
  const half = (fov * Math.PI) / 360;
  const below = OVERVIEW_PITCH + Math.atan(Math.tan(half) * OVERVIEW_PORTRAIT_DROP * k);
  const h = dist * Math.sin(OVERVIEW_PITCH);
  const back = dist * Math.cos(OVERVIEW_PITCH);
  // the avatar is seen `below` radians under the horizon, so it stands h / tan(below) from the camera
  return Math.max(0, back - h / Math.tan(below));
}

/**
 * The avatar's opacity for a camera this far (metres) from its middle: fully solid beyond
 * AVATAR_FADE_NEAR, fading linearly to AVATAR_FADE_MIN as the camera closes in (a wall or a
 * machine has pulled it in), so the avatar never fills the screen.
 */
export function avatarOpacity(camDist: number): number {
  if (!(camDist < AVATAR_FADE_NEAR)) return 1;
  const k = Math.max(0, camDist - 0.4) / (AVATAR_FADE_NEAR - 0.4);
  return AVATAR_FADE_MIN + (1 - AVATAR_FADE_MIN) * k;
}

/** How faded a machine's own seat gets while the follow camera frames that machine. */
export const PROP_FADE_MIN = 0.25;
/**
 * The opacity of the furniture beside a framed machine (the pilot's swivel chair, VA-0045):
 * the framing swings the camera to the avatar's right, where that chair stands between the
 * camera and the screen, so it fades with the framing weight and is solid again without it.
 */
export function propOpacity(focusWeight: number): number {
  const w = Math.min(1, Math.max(0, focusWeight || 0));
  return 1 - w * (1 - PROP_FADE_MIN);
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
