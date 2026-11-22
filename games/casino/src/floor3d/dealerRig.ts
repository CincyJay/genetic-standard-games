/**
 * Joshua's rigged Tripo dealers (2026-11-22): figures with a Mixamo-named skeleton and no clips.
 * Joshua wants them sitting at the table, waiting for players, and moving rather than frozen, so the
 * game poses them itself:
 * - seated: thighs forward, shins down onto a stool's foot ring, forearms forward onto the table;
 * - idle: breathing (spine), slow glances (neck and head), a little hand movement;
 * - when the player's avatar is near and in front, the head turns to look at them.
 * Rotations are given about the figure's own axes (front +Z, up +Y) and turned into each bone's
 * local frame, so the bones' rest orientations don't matter. Pure procedural motion, no clips:
 * Mixamo clips can replace it later (the skeleton names match).
 */
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createVelvetSlotStool } from '../../../../art/casino/3d/velvetSlotStool.mjs';

const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** The seated pose: [bone, axis, angle] about the figure's axes, applied in order (parents first). */
const SEATED: [string, THREE.Vector3, number][] = [
  ['LeftUpLeg', X, -1.5],
  ['RightUpLeg', X, -1.5],
  ['LeftLeg', X, 1.45],
  ['RightLeg', X, 1.45],
  ['Spine', X, 0.08],
  ['LeftArm', X, -0.45],
  ['RightArm', X, -0.45],
  ['LeftForeArm', X, -1.05],
  ['RightForeArm', X, -1.05],
];

/** Seat top of the dealer's stool (the slot stool, raised for a table at ~0.95 m). */
const STOOL_SCALE_Y = 1.2;
export const DEALER_SEAT_Y = 0.66 * STOOL_SCALE_Y;

export interface SeatedDealer {
  root: THREE.Group;
  /** t in seconds; `look` is the avatar's floor position, or null. */
  update: (t: number, look: { x: number; z: number } | null) => void;
}

function bone(root: THREE.Object3D, name: string): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.Bone).isBone && (o.name === `mixamorig:${name}` || o.name === `mixamorig${name}` || o.name.endsWith(name))) found = o as THREE.Bone;
  });
  return found;
}

/** Rotates `b` by `angle` about `axis` given in `frame`'s space (bone's parent chain updated first). */
function rotateIn(frame: THREE.Object3D, b: THREE.Bone, axis: THREE.Vector3, angle: number): void {
  b.parent!.updateWorldMatrix(true, false);
  const parentQ = b.parent!.getWorldQuaternion(new THREE.Quaternion());
  const frameQ = frame.getWorldQuaternion(new THREE.Quaternion());
  // axis in world, then into the parent's frame
  const a = axis.clone().applyQuaternion(frameQ).applyQuaternion(parentQ.invert()).normalize();
  b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(a, angle));
  b.updateMatrixWorld(true);
}

/** A bone's local axis that matches `axis` in the figure's frame, at the current pose. */
function localAxis(frame: THREE.Object3D, b: THREE.Bone, axis: THREE.Vector3): THREE.Vector3 {
  b.updateWorldMatrix(true, false);
  const q = b.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(frame.getWorldQuaternion(new THREE.Quaternion()));
  return axis.clone().applyQuaternion(q).normalize();
}

/**
 * A seated, idling copy of a rigged figure standing `rawHeight` tall in its own units (feet at y 0,
 * facing +Z), scaled to `height` metres. The root's origin is the floor under the hips; place it
 * behind the table, facing the players. `stool: false` leaves out the stool (a table with its own
 * dealer chair).
 */
export function makeSeatedDealer(src: THREE.Object3D, rawHeight: number, height: number, opts: { stool?: boolean; phase?: number; tPose?: boolean } = {}): SeatedDealer {
  const root = new THREE.Group();
  root.name = 'tripo_seated_dealer';
  const fig = cloneSkinned(src) as THREE.Object3D;
  const s = height / rawHeight;
  fig.scale.setScalar(s);
  root.add(fig);
  fig.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isMesh) {
      // the bind pose's bounds don't cover the seated pose
      m.frustumCulled = false;
      m.castShadow = m.receiveShadow = true;
    }
  });
  root.updateMatrixWorld(true);
  // a figure rigged in a T-pose first lowers its arms to its sides
  const pose: [string, THREE.Vector3, number][] = opts.tPose ? [['LeftArm', Z, -1.45], ['RightArm', Z, 1.45], ...SEATED] : SEATED;
  for (const [name, axis, angle] of pose) {
    const b = bone(fig, name);
    if (b) rotateIn(fig, b, axis, angle);
  }
  // sit the hips on the seat: the hips stand at ~0.58 of the raw height; drop them to the seat top
  const hips = bone(fig, 'Hips');
  const hipsY = hips ? hips.getWorldPosition(new THREE.Vector3()).y : 0.58 * height;
  fig.position.y = DEALER_SEAT_Y + 0.07 - hipsY;
  if (opts.stool !== false) {
    const stool = createVelvetSlotStool(THREE) as THREE.Group;
    stool.scale.y = STOOL_SCALE_Y;
    stool.name = 'tripo_dealer_stool';
    root.add(stool);
  }
  root.updateMatrixWorld(true);

  // idle motion: each animated bone keeps its posed rotation and a local axis per motion
  const rig = (name: string, axis: THREE.Vector3) => {
    const b = bone(fig, name);
    return b ? { b, rest: b.quaternion.clone(), axis: localAxis(fig, b, axis) } : null;
  };
  const spine1 = rig('Spine1', X), spine2 = rig('Spine2', X);
  const neckY = rig('Neck', Y), headY = rig('Head', Y), headX = bone(fig, 'Head') ? localAxis(fig, bone(fig, 'Head')!, X) : null;
  const handL = rig('LeftForeArm', X), handR = rig('RightForeArm', X);
  const phase = opts.phase ?? 0;
  const q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  let lookYaw = 0;
  const world = new THREE.Vector3();
  const set = (r: ReturnType<typeof rig>, angle: number) => {
    if (r) r.b.quaternion.copy(r.rest).multiply(q.setFromAxisAngle(r.axis, angle));
  };
  return {
    root,
    update: (t, look) => {
      const tt = t + phase;
      const breath = Math.sin(tt * 1.6) * 0.022;
      set(spine1, breath);
      set(spine2, breath * 0.6);
      // glance about slowly; turn to the player when they're near and in front
      let want = Math.sin(tt * 0.23) * 0.35 + Math.sin(tt * 0.61) * 0.12;
      if (look) {
        root.getWorldPosition(world);
        const dx = look.x - world.x, dz = look.z - world.z, d = Math.hypot(dx, dz);
        const yaw = Math.atan2(dx, dz) - root.rotation.y;
        const rel = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        if (d < 6 && Math.abs(rel) < 1.4) want = THREE.MathUtils.clamp(rel, -0.9, 0.9);
      }
      lookYaw += (want - lookYaw) * 0.06;
      set(neckY, lookYaw * 0.4);
      if (headY) {
        headY.b.quaternion.copy(headY.rest).multiply(q.setFromAxisAngle(headY.axis, lookYaw * 0.6));
        // a slight nod now and then
        if (headX) headY.b.quaternion.multiply(q2.setFromAxisAngle(headX, Math.max(0, Math.sin(tt * 0.37)) ** 8 * 0.12));
      }
      set(handL, Math.sin(tt * 0.9) * 0.04);
      set(handR, Math.sin(tt * 0.7 + 1.3) * 0.05);
    },
  };
}
