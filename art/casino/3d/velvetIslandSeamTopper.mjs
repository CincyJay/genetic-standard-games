/**
 * Velvet Ace: optional low-poly seam topper for back-to-back Svelte slot islands.
 * Art prototype only. Units: metres; X across the seam, Y up, Z along island.
 * Caller positions the group at the island centre and supplies length.
 * This is NOT a collision surface; never alter gameplay paths from this art.
 */
export function createVelvetIslandSeamTopper(THREE, options = {}) {
  const length = options.length ?? 3.6;
  const height = options.height ?? 2.0575;
  const width = options.width ?? 0.035;
  if (![length, height, width].every(Number.isFinite) ||
      length < 0.5 || length > 30 || height < 0.5 || height > 3 ||
      width < 0.01 || width > 0.11) {
    throw new RangeError('Invalid island topper dimensions');
  }
  const root = new THREE.Group();
  root.name = 'VA_ISLAND_BACK_SEAM_TOPPER_OPTIONAL';
  const brass = new THREE.MeshStandardMaterial({
    color: 0xb99a61, metalness: 0.72, roughness: 0.35
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x241b24, metalness: 0.22, roughness: 0.72
  });
  const add = (name, geometry, material, y, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(0, y, z);
    root.add(mesh);
    return mesh;
  };
  // The 35 mm default fits near cabinets' 40 mm gap. A caller may opt into
  // up to 110 mm for far-LOD backs, which Claude measured 110 mm apart.
  // Never widen without checking cabinet intersections and end-cap clearance.
  add('dark_seam_infill', new THREE.BoxGeometry(width, 0.065, length), dark, height);
  add('brushed_brass_crest', new THREE.BoxGeometry(width, 0.018, length), brass, height + 0.042);
  // Small capped ends, no tall divider to block sightlines or screen visibility.
  for (const sign of [-1, 1]) {
    add('brass_end_cap', new THREE.BoxGeometry(width, 0.095, 0.026),
      brass, height + 0.012, sign * (length / 2 - 0.013));
  }
  root.userData.velvetArt = {
    optional: true, collision: false, placement: 'centre of back-to-back island',
    triangleBudget: 48, maxWidthMeters: 0.11,
    caveat: 'Host must verify clearance against cabinet backs, marquee end caps and camera; 110 mm is optional for far LOD'
  };
  return root;
}
