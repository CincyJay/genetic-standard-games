/**
 * Velvet Ace slot stool (Claude, 2026-11-18, at Joshua's request to match his reference room):
 * a burgundy leather tub seat with a low rounded back, a gold ring under the cushion, a gold
 * pedestal with a foot ring, and a round gold base. Light enough to stand at every machine
 * (about 1.2k triangles); preview art, not a final asset.
 *
 * Origin at the floor under the pedestal; the seat's open front faces +Z (toward the machine
 * once the host turns it). Height 0.92 m at the back rim, seat top at 0.66 m.
 */
export function createVelvetSlotStool(THREE, { seatRadius = 0.24 } = {}) {
  const group = new THREE.Group();
  group.name = 'VA_SLOT_STOOL';
  const leather = new THREE.MeshStandardMaterial({ name: 'VA_STOOL_BURGUNDY_LEATHER', color: 0x5c0f1f, roughness: 0.42, metalness: 0.05 });
  const gold = new THREE.MeshStandardMaterial({ name: 'VA_STOOL_GOLD', color: 0xd4ad62, roughness: 0.24, metalness: 0.9 });
  const piping = new THREE.MeshStandardMaterial({ name: 'VA_STOOL_DARK_PIPING', color: 0x2a0710, roughness: 0.6, metalness: 0.05 });
  const add = (name, geometry, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const r = seatRadius;

  // round gold base with a softened edge, and the pedestal
  add('stool_gold_base', new THREE.CylinderGeometry(0.2, 0.23, 0.035, 18), gold, 0, 0.0175, 0);
  add('stool_gold_base_dome', new THREE.CylinderGeometry(0.06, 0.16, 0.04, 14), gold, 0, 0.055, 0);
  add('stool_gold_pedestal', new THREE.CylinderGeometry(0.032, 0.038, 0.5, 10), gold, 0, 0.32, 0);
  const foot = add('stool_gold_foot_ring', new THREE.TorusGeometry(0.17, 0.011, 4, 18), gold, 0, 0.3, 0);
  foot.rotation.x = Math.PI / 2;
  // foot-ring spokes
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const s = add(`stool_gold_foot_spoke_${i}`, new THREE.CylinderGeometry(0.008, 0.008, 0.17, 6), gold, Math.sin(a) * 0.085, 0.3, Math.cos(a) * 0.085);
    s.rotation.order = 'YXZ';
    s.rotation.set(Math.PI / 2, a, 0);
  }

  // seat: gold ring under a domed leather cushion with dark piping
  add('stool_gold_seat_pan', new THREE.CylinderGeometry(r * 0.95, r * 0.7, 0.05, 18, 1, true), gold, 0, 0.585, 0);
  const ring = add('stool_gold_seat_ring', new THREE.TorusGeometry(r + 0.004, 0.012, 4, 20), gold, 0, 0.6, 0);
  ring.rotation.x = Math.PI / 2;
  add('stool_leather_cushion', new THREE.CylinderGeometry(r * 0.97, r, 0.07, 20, 1, true), leather, 0, 0.64, 0);
  add('stool_leather_cushion_top', new THREE.SphereGeometry(r * 0.97, 18, 2, 0, Math.PI * 2, 0, 0.42), leather, 0, 0.675 - r * 0.97 * Math.cos(0.42), 0);
  const pipe = add('stool_cushion_piping', new THREE.TorusGeometry(r * 0.985, 0.008, 3, 20), piping, 0, 0.676, 0);
  pipe.rotation.x = Math.PI / 2;

  // low rounded tub back: an open shell around the rear ~210°, padded, with a gold top rim
  const arc = Math.PI * 1.17;
  // three's cylinders put angle 0 at +Z, so centre the arc on the back (-Z, angle PI)
  const start = Math.PI - arc / 2;
  const shell = new THREE.CylinderGeometry(r + 0.025, r + 0.005, 0.26, 16, 1, true, start, arc);
  add('stool_leather_back_outer', shell, leather, 0, 0.81, 0);
  const inner = new THREE.CylinderGeometry(r - 0.005, r - 0.02, 0.24, 16, 1, true, start, arc);
  // inner face: flip winding so it faces the sitter
  const idx = inner.index.array;
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  inner.computeVertexNormals();
  const n = inner.attributes.normal.array;
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  add('stool_leather_back_inner', inner, leather, 0, 0.8, 0);
  // the rim's arc runs in the torus' XY plane; laid flat it follows the same back arc
  const rim = add('stool_gold_back_rim', new THREE.TorusGeometry(r + 0.012, 0.016, 5, 16, arc), gold, 0, 0.94, 0);
  // laid flat (X), torus angle phi lands at cylinder angle phi + PI/2; then turned (Y) onto the shell
  rim.rotation.order = 'YXZ';
  rim.rotation.set(-Math.PI / 2, start - Math.PI / 2, 0);
  // tufting buttons across the inner back
  for (let i = 0; i < 5; i++) {
    const a = start + arc * (0.2 + 0.15 * i);
    add(`stool_back_button_${i}`, new THREE.SphereGeometry(0.009, 5, 3), gold, Math.sin(a) * (r - 0.02), 0.82, Math.cos(a) * (r - 0.02));
  }

  group.userData = { author: 'Claude', artOnly: true, note: 'preview slot stool for the reference room; front +Z', seatHeight: 0.66, footprintRadius: 0.27 };
  return group;
}
