/**
 * The floor's standing-in people (no rigged human art yet): dealers and the computer players in
 * taken seats. Each was a capsule body plus a "nose" box, two meshes and two draw calls apiece;
 * the grand hall's landscape follow view drew ten of them (VA-0268). None of them move, so they
 * are merged here into one mesh with per-vertex colours: one draw call, same shapes and colours.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface PlaceholderPerson {
  x: number;
  z: number;
  /** Facing, as the floor's headings: 0 faces -Z. */
  heading: number;
  /** Raised off the floor (a seated computer player). */
  lift: number;
}

const NOSE_COLOR = 0x403c44;

function painted(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const n = g.getAttribute('position').count;
  const rgb = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) rgb.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  // only what the lambert material reads, so every part merges
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  return g;
}

/** One merged mesh for every person (null when there are none). Same geometry as the old capsules. */
export function buildPlaceholderCrowd(people: PlaceholderPerson[], height: number, color: number): THREE.Mesh | null {
  if (!people.length) return null;
  // THREE.Color converts the hex into the working (linear) space, as the old material colour did
  const body = new THREE.Color(color);
  const nose = new THREE.Color(NOSE_COLOR);
  const parts: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  for (const p of people) {
    const place = new THREE.Matrix4().makeTranslation(p.x, p.lift, p.z).multiply(new THREE.Matrix4().makeRotationY(-p.heading));
    const b = painted(new THREE.CapsuleGeometry(0.27, height - 0.54, 6, 14), body);
    b.applyMatrix4(m.copy(place).multiply(new THREE.Matrix4().makeTranslation(0, height / 2, 0)));
    const n = painted(new THREE.BoxGeometry(0.14, 0.1, 0.16), nose);
    n.applyMatrix4(m.copy(place).multiply(new THREE.Matrix4().makeTranslation(0, height - 0.22, -0.28)));
    parts.push(b, n);
  }
  const merged = mergeGeometries(parts, false)!;
  for (const g of parts) g.dispose();
  const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }));
  mesh.name = 'placeholder-people';
  mesh.userData.people = people.length;
  return mesh;
}
