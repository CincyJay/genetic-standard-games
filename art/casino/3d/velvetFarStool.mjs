/**
 * Velvet Ace: low-cost distant casino stool silhouette.
 * Original optional Three.js geometry; not connected to game runtime.
 * Coordinate system: Y up, floor at Y=0, chair faces local -Z.
 * Target: <250 triangles, excluding optional shadows or renderer effects.
 */
export function createVelvetFarStool(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.CylinderGeometry || !THREE?.BoxGeometry || !THREE?.BufferGeometry || !THREE?.Float32BufferAttribute || !THREE?.DoubleSide) {
    throw new TypeError('A compatible THREE namespace is required');
  }
  const clamp = (v, fallback, min, max) =>
    Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  const seatHeight = clamp(options.seatHeight, 0.72, 0.55, 0.95);
  const seatWidth = clamp(options.seatWidth, 0.48, 0.35, 0.65);
  const root = new THREE.Group();
  root.name = 'velvet_far_stool';
  const fabric = new THREE.MeshStandardMaterial({color: options.fabricColor ?? 0x84233d, roughness: 0.88, metalness: 0, side: THREE.DoubleSide});
  const metal = new THREE.MeshStandardMaterial({color: options.metalColor ?? 0x9c7840, roughness: 0.37, metalness: 0.72, side: THREE.DoubleSide});
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
  // The near stool is a low curved tub, not a tall flat dining-chair back.
  // Eight arc segments create a readable silhouette with just 32 triangles.
  add('seat_cushion', new THREE.CylinderGeometry(seatWidth * 0.50, seatWidth * 0.48, 0.115, 8), fabric, 0, seatHeight, 0);
  add('seat_underpan', new THREE.CylinderGeometry(seatWidth * 0.43, seatWidth * 0.43, 0.035, 8), shadow, 0, seatHeight - 0.075, 0);
  add('pedestal_stem', new THREE.CylinderGeometry(0.047, 0.062, seatHeight - 0.18, 8, 1, true), metal, 0, (seatHeight - 0.18) / 2 + 0.045, 0);
  add('weighted_foot', new THREE.CylinderGeometry(0.205, 0.225, 0.055, 8), metal, 0, 0.0275, 0);
  // Gold piping is a narrow shallow disc directly under the burgundy cushion.
  add('seat_gold_rim', new THREE.CylinderGeometry(seatWidth * 0.505, seatWidth * 0.505, 0.012, 8), metal, 0, seatHeight - 0.052, 0);
  const radius = seatWidth * 0.52;
  const vertices = [];
  const indices = [];
  // Open front (-Z), curved back (+Z); matches Claude's wrapper orientation.
  for (let i = 0; i <= 8; i++) {
    const angle = Math.PI * i / 8;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    vertices.push(x, seatHeight + 0.045, z, x, 0.92, z);
    if (i < 8) {
      const k = 2 * i;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const curvedBack = new THREE.BufferGeometry();
  curvedBack.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  curvedBack.setIndex(indices);
  curvedBack.computeVertexNormals();
  add('curved_tub_back', curvedBack, fabric, 0, 0, 0);
  // A 30 mm gold crest is legible at distance and shares the pedestal material.
  const trimVertices = [];
  const trimIndices = [];
  for (let i = 0; i <= 8; i++) {
    const angle = Math.PI * i / 8;
    const x = (radius + 0.002) * Math.cos(angle);
    const z = (radius + 0.002) * Math.sin(angle);
    trimVertices.push(x, 0.895, z, x, 0.925, z);
    if (i < 8) {
      const k = i * 2;
      trimIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const trimGeo = new THREE.BufferGeometry();
  trimGeo.setAttribute('position', new THREE.Float32BufferAttribute(trimVertices, 3));
  trimGeo.setIndex(trimIndices);
  trimGeo.computeVertexNormals();
  add('tub_gold_crest', trimGeo, metal, 0, 0, 0);
  // Approx. 176 triangles. Actual indexed count is recorded below.
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
