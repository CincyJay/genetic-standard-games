/**
 * Velvet Ace: low-cost distant casino stool silhouette.
 * Original optional Three.js geometry; not connected to game runtime.
 * Coordinate system: Y up, floor at Y=0, chair faces local -Z.
 * Target: <300 triangles, excluding optional shadows or renderer effects.
 */
export function createVelvetFarStool(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.CylinderGeometry || !THREE?.BoxGeometry) {
    throw new TypeError('A compatible THREE namespace is required');
  }
  const clamp = (v, fallback, min, max) =>
    Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  const seatHeight = clamp(options.seatHeight, 0.72, 0.55, 0.95);
  const seatWidth = clamp(options.seatWidth, 0.48, 0.35, 0.65);
  const root = new THREE.Group();
  root.name = 'velvet_far_stool';
  const fabric = new THREE.MeshStandardMaterial({color: options.fabricColor ?? 0x531b32, roughness: 0.88, metalness: 0});
  const metal = new THREE.MeshStandardMaterial({color: options.metalColor ?? 0x9c7840, roughness: 0.37, metalness: 0.72});
  const shadow = new THREE.MeshStandardMaterial({color: 0x211b21, roughness: 0.95});
  const add = (name, geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    root.add(mesh);
    return mesh;
  };
  // 8 radial segments: cushion 32 tris, base 32, stem 16, rear back 32.
  add('seat_cushion', new THREE.CylinderGeometry(seatWidth * 0.50, seatWidth * 0.48, 0.115, 8), fabric, 0, seatHeight, 0);
  add('seat_underpan', new THREE.CylinderGeometry(seatWidth * 0.43, seatWidth * 0.43, 0.035, 8), shadow, 0, seatHeight - 0.075, 0);
  add('pedestal_stem', new THREE.CylinderGeometry(0.047, 0.062, seatHeight - 0.18, 8, 1, true), metal, 0, (seatHeight - 0.18) / 2 + 0.045, 0);
  add('weighted_foot', new THREE.CylinderGeometry(0.19, 0.23, 0.055, 8), metal, 0, 0.028, 0);
  // Shallow back silhouette and two dark side supports. No protruding decorative rails.
  const back = add('backrest', new THREE.BoxGeometry(seatWidth * 0.83, 0.42, 0.09), fabric, 0, seatHeight + 0.29, seatWidth * 0.43);
  back.rotation.x = -0.12;
  for (const side of [-1, 1]) {
    const support = add('back_support', new THREE.BoxGeometry(0.035, 0.36, 0.045), metal,
      side * seatWidth * 0.34, seatHeight + 0.13, seatWidth * 0.39);
    support.rotation.x = -0.12;
  }
  // 32*4 + 16 + 12*3 = 180 triangles; explicit budget uses actual geometry counts.
  const triangles = root.children.reduce((sum, mesh) => {
    const g = mesh.geometry;
    return sum + (g.index ? g.index.count / 3 : g.attributes.position.count / 3);
  }, 0);
  root.userData.velvetArt = {
    type: 'far-stool', triangles, visualOnly: true, lodOnly: true,
    seatHeight, seatWidth, forward: '-Z', productionIntegrated: false
  };
  return root;
}
