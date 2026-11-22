/**
 * Velvet Ace optional sculpted chair, low-poly prototype. Never replaces default Velvet Ace chair.
 * Art-only, isolated Three.js geometry. Units are metres; floor at y=0.
 * No lights, textures, animation loops, or production dependencies.
 * Caller owns the returned Group and must dispose geometries/materials.
 */
export function createVelvetSculptedGamingChair(THREE, options = {}) {
  const upholstery = options.upholstery ?? 0x44202e;
  const piping = options.piping ?? 0xb89152;
  const metal = options.metal ?? 0x24272e;
  const chair = new THREE.Group();
  chair.name = 'VelvetAce_SculptedGamingChair_OptIn';
  const fabric = new THREE.MeshStandardMaterial({color: upholstery, roughness: 0.91, metalness: 0});
  const seam = new THREE.MeshStandardMaterial({color: piping, roughness: 0.34, metalness: 0.66});
  const frame = new THREE.MeshStandardMaterial({color: metal, roughness: 0.36, metalness: 0.68});
  const dark = new THREE.MeshStandardMaterial({color: 0x17141a, roughness: 0.79});
  const own = (geometry, material, name, position, rotation) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...position);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    chair.add(mesh);
    return mesh;
  };
  // Five slim cast-metal spokes and caster housings, rather than a solid pedestal.
  own(new THREE.CylinderGeometry(0.055, 0.075, 0.42, 12), frame, 'gas-lift', [0, 0.39, 0]);
  own(new THREE.CylinderGeometry(0.13, 0.13, 0.045, 16), frame, 'hub', [0, 0.17, 0]);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    const x = Math.sin(angle), z = Math.cos(angle);
    own(new THREE.BoxGeometry(0.055, 0.038, 0.38), frame, 'spoke-'+i,
      [x * 0.17, 0.155, z * 0.17], [0, angle, 0]);
    own(new THREE.CylinderGeometry(0.041, 0.041, 0.06, 12), dark, 'caster-'+i,
      [x * 0.36, 0.066, z * 0.36], [0, 0, Math.PI / 2]);
  }
  // Rounded upholstery over a visibly separate metal seat pan.
  own(new THREE.BoxGeometry(0.59, 0.065, 0.58), frame, 'seat-pan', [0, 0.47, 0.015]);
  const seat = own(new THREE.SphereGeometry(1, 16, 10), fabric, 'seat-cushion', [0, 0.545, 0.025]);
  seat.scale.set(0.305, 0.105, 0.285);
  const back = own(new THREE.SphereGeometry(1, 16, 12), fabric, 'sculpted-back', [0, 1.09, -0.255], [-0.11, 0, 0]);
  back.scale.set(0.305, 0.45, 0.095);
  const lumbar = own(new THREE.SphereGeometry(1, 12, 8), fabric, 'lumbar-bolster', [0, 0.88, -0.164]);
  lumbar.scale.set(0.265, 0.125, 0.082);
  const head = own(new THREE.SphereGeometry(1, 12, 8), fabric, 'headrest', [0, 1.43, -0.26]);
  head.scale.set(0.245, 0.125, 0.112);
  // Subtle gold edge piping follows the outside silhouette of the backrest.
  const outline = [];
  for (let i = 0; i <= 32; i++) {
    const t = i * Math.PI * 2 / 32;
    outline.push(new THREE.Vector3(0.299 * Math.cos(t), 1.09 + 0.44 * Math.sin(t), -0.265));
  }
  own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(outline, true), 32, 0.006, 4, true),
    seam, 'back-piping', [0, 0, 0]);
  for (const side of [-1, 1]) {
    const x = side * 0.295;
    own(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 10), frame,
      'arm-support-'+side, [x, 0.81, -0.01]);
    const pad = own(new THREE.SphereGeometry(1, 12, 8), fabric,
      'arm-pad-'+side, [x, 0.98, 0.065]);
    pad.scale.set(0.073, 0.042, 0.245);
    own(new THREE.BoxGeometry(0.012, 0.016, 0.34), seam,
      'arm-trim-'+side, [x + side * 0.061, 0.964, 0.065]);
  }
  chair.userData = {
    artOnly: true, version: 2, unit: 'metre', footprint: [0.77, 0.77], forward: [0, 0, 1], seatHeight: 0.65, lod: 'low',
    materials: [fabric, seam, frame, dark],
    dispose() {
      chair.traverse(node => { if (node.isMesh) node.geometry.dispose(); });
      [fabric, seam, frame, dark].forEach(m => m.dispose());
    }
  };
  return chair;
}
