/**
 * Isolated close-up preview of ChatGPT's premium slot station pilot (VA-0073 / VA-0075).
 * Not part of the game: only `slot-pilot.html` (a dev-only page) uses it. The art module is used
 * unchanged; this file only works around a placement bug in it (see `seatCurvedScreens`).
 */
import type * as THREE_NS from 'three';
import { createPremiumSlotStation } from '../../../../art/casino/3d/premiumSlotStation.mjs';

type Three = typeof THREE_NS;

/** The two named display meshes the art module creates. */
export const PILOT_SCREENS = ['TOPPER', 'MAIN_REELS'] as const;
const SCREEN_SUFFIX = '-CURVED_SCREEN_SWAP_MATERIAL';
/** Gap between the curved glass's side edges and the front of its black gasket (m). */
const GLASS_CLEARANCE = 0.004;

/**
 * Engineering workaround for the art pilot's curved screens (reported on the board, VA-0076).
 * The art builds each screen as an open cylinder arc centred on theta = -PI/2 and turns it by
 * PI, which puts the arc 1.6 m to the station's +X side, facing sideways, while the solid black
 * gasket covers where the screen should be. Here each arc is re-aimed so its middle faces +Z
 * (the player) and moved just in front of its gasket. Geometry, radius, arc and size are
 * untouched; only the mesh's yaw and z position change.
 */
export function seatCurvedScreens(THREE: Three, station: THREE_NS.Object3D): void {
  station.updateMatrixWorld(true);
  for (const label of PILOT_SCREENS) {
    const glass = station.getObjectByName(label + SCREEN_SUFFIX) as THREE_NS.Mesh | undefined;
    const gasket = station.getObjectByName(label + '-black-gasket');
    if (!glass || !gasket) throw new Error('slot pilot: missing ' + label + ' display');
    const g = glass.geometry as THREE_NS.CylinderGeometry;
    const { radiusTop: radius, thetaStart, thetaLength } = g.parameters;
    const mid = thetaStart + thetaLength / 2;
    // a cylinder vertex at angle t sits at (r sin t, r cos t); turning by -mid brings the middle to +Z
    glass.rotation.set(0, -mid, 0);
    const gasketFront = new THREE.Box3().setFromObject(gasket).max.z;
    const edgeZ = radius * Math.cos(thetaLength / 2);
    glass.position.set(0, glass.position.y, gasketFront + GLASS_CLEARANCE - edgeZ);
    glass.updateMatrixWorld(true);
  }
}

/** The station, with the screens seated. Screen art is applied by the caller (needs a canvas). */
export function buildPremiumSlotPilot(THREE: Three, opts: { withChair?: boolean } = {}): THREE_NS.Group {
  const station = createPremiumSlotStation(THREE, { withChair: opts.withChair ?? true }) as THREE_NS.Group;
  seatCurvedScreens(THREE, station);
  return station;
}

/** Mesh and triangle counts, for the board's budget notes. */
export function pilotStats(root: THREE_NS.Object3D): { meshes: number; triangles: number } {
  let meshes = 0;
  let triangles = 0;
  root.traverse((o) => {
    const m = o as THREE_NS.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const geo = m.geometry;
    triangles += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
  });
  return { meshes, triangles };
}
