/**
 * Velvet Ace original low-poly luxury swivel chair, isolated opt-in art prototype.
 * Coordinate system: Y up, front of seat toward +Z. Units are metres.
 * No physics, collisions, production assets, or engineering integration here.
 */
export function createVelvetLuxuryChairLOD(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.MeshStandardMaterial)
    throw new TypeError('Three.js geometry and materials required');
  const radial = options.radialSegments ?? 10;
  if (!Number.isInteger(radial) || radial < 8 || radial > 16)
    throw new RangeError('radialSegments must be an integer from 8 to 16');
  const root = new THREE.Group();
  root.name = 'VA_art_luxury_swivel_chair_LOD';
  const leather = new THREE.MeshStandardMaterial({ color: options.leatherColor ?? 0x54283b, roughness: 0.79, metalness: 0.02 });
  const leatherEdge = new THREE.MeshStandardMaterial({ color: 0x361c2a, roughness: 0.82 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb38b55, metalness: 0.78, roughness: 0.28 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xaaa9a8, metalness: 0.83, roughness: 0.23 });
  const add = (name, geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    root.add(mesh); return mesh;
  };
  // Upholstery silhouette: rounded, gently raked back and separate seat cushion.
  add('VA_seat_underpan', new THREE.BoxGeometry(.57, .105, .55), leatherEdge, 0, .57, 0);
  add('VA_seat_cushion', new THREE.SphereGeometry(1, radial + 2, 6), leather, 0, .655, .005).scale.set(.292, .092, .275);
  const back = add('VA_sculpted_back_lowpoly', new THREE.SphereGeometry(1, radial + 4, 8), leather, 0, .99, -.258, -.14);
  back.scale.set(.305, .405, .105);
  const backRim = add('VA_back_piping', new THREE.TorusGeometry(.296, .011, 4, 20, Math.PI), brass, 0, 1.015, -.342, 0, 0, 0);
  backRim.scale.y = 1.25;
  // Side bolsters give the padded wing silhouette without thousands of segments.
  for (const side of [-1, 1]) {
    const wing = add('VA_leather_wing_' + side, new THREE.SphereGeometry(1, 10, 6), leatherEdge, side * .257, .975, -.245, 0, 0, side * -.17);
    wing.scale.set(.061, .295, .12);
    const arm = add('VA_armrest_' + side, new THREE.CapsuleGeometry(.065, .32, 3, 6), leather, side * .315, .785, .02, Math.PI / 2);
    arm.scale.set(1, 1, 1);
    add('VA_arm_support_' + side, new THREE.CylinderGeometry(.018, .024, .20, 8), brass, side * .305, .665, -.09);
  }
  // Five-spoke star base: 5 tapered beams instead of high-segment sculpted legs.
  add('VA_swivel_column', new THREE.CylinderGeometry(.045, .058, .37, radial), chrome, 0, .34, 0);
  add('VA_hub', new THREE.CylinderGeometry(.085, .08, .055, radial), brass, 0, .16, 0);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const length = .31;
    const spoke = add('VA_five_spoke_' + i, new THREE.BoxGeometry(.065, .035, length), chrome,
      Math.sin(a) * length / 2, .148, Math.cos(a) * length / 2, 0, a);
    spoke.userData.lowPolySpoke = true;
    // Small glides remain visible at floor level, eight-sided, not toroidal wheels.
    add('VA_floor_glide_' + i, new THREE.CylinderGeometry(.045, .048, .045, 8), leatherEdge,
      Math.sin(a) * length, .08, Math.cos(a) * length);
  }
  root.userData.velvetArt = {
    type: 'original-luxury-chair-lod', visualOnly: true, prototype: true,
    orientation: 'front +Z', seatHeight: .655,
    integration: 'Opt-in replacement only. Align with existing chair transforms and compare silhouette before adoption.',
    validation: 'Not photorealistic; not integrated, rendered, collision-tested, or device-tested.'
  };
  return root;
}
