/**
 * Velvet Ace optional end-cap chase-light LOD art prototype.
 * Keeps EVERY bulb at the authored positions: never change spacing, sequence,
 * emissive timing, or light behavior. Only swaps distant visual geometry.
 * Not connected to the game, and NOT an illumination/light source.
 *
 * 20-triangle icosahedron -> 8-triangle octahedron = 12 fewer per bulb.
 * At 1,224 instances, theoretical reduction is 14,688 triangles if ALL
 * instances switch. Host must verify actual LOD populations and screenshots.
 */
export function createVelvetChaseBulbGeometry(THREE, options = {}) {
  if (!THREE?.IcosahedronGeometry || !THREE?.OctahedronGeometry)
    throw new TypeError('Compatible Three.js namespace required');
  const level = options.level === 'far' ? 'far' : 'near';
  const radius = Number.isFinite(options.radius) && options.radius > 0
    ? Math.min(options.radius, 0.25) : 0.012;
  const geometry = level === 'far'
    ? new THREE.OctahedronGeometry(radius, 0)
    : new THREE.IcosahedronGeometry(radius, 0);
  geometry.userData.velvetArt = {
    type: 'endcap-chase-bulb', level, visualOnly: true,
    productionIntegrated: false, trianglesPerInstance: level === 'far' ? 8 : 20,
    preservesBulbCount: true,
    warning: 'Use only as geometry in existing host-owned instanced bulbs. Keep the existing materials, positions, chase animation and illumination; visually test specular sparkle and near/far transition.'
  };
  return geometry;
}

/**
 * Estimate geometric savings only; draw calls and GPU timings are NOT predicted.
 * Number is clamped to prevent negative/invalid reporting.
 */
export function estimateChaseBulbTriangleSavings(farInstanceCount) {
  if (!Number.isSafeInteger(farInstanceCount) || farInstanceCount < 0)
    throw new RangeError('farInstanceCount must be a nonnegative safe integer');
  return farInstanceCount * 12;
}
