/**
 * Velvet Ace low-poly near-cabinet finish, original optional art prototype.
 * Physical 5x5 reel window is deliberately EMPTY: the game owns all reel imagery.
 * Y-up; front faces -Z. Units are metres. No gameplay, hitboxes or saves.
 */
export function createVelvetSlimCabinet(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.BoxGeometry || !THREE?.MeshStandardMaterial)
    throw new TypeError('Compatible Three.js namespace required');
  const root = new THREE.Group();
  root.name = 'velvet_slim_slot_cabinet';
  const mat = {
    shell: new THREE.MeshStandardMaterial({ color: options.shellColor ?? 0x18151d, metalness: 0.35, roughness: 0.37 }),
    gold: new THREE.MeshStandardMaterial({ color: options.trimColor ?? 0xc6a05b, metalness: 0.82, roughness: 0.24 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x111725, metalness: 0.15, roughness: 0.16 }),
    accent: new THREE.MeshStandardMaterial({ color: options.accentColor ?? 0x6e294e, metalness: 0.25, roughness: 0.4 }),
  };
  const add = (name, w, h, d, x, y, z, material, tilt = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.rotation.x = tilt;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    root.add(mesh);
    return mesh;
  };
  // Slim curved visual rhythm using faceted stepped surfaces; no heavy bevel geometry.
  add('weighted_plinth', 0.68, 0.10, 0.65, 0, 0.05, 0.03, mat.gold);
  add('lower_body', 0.60, 0.73, 0.53, 0, 0.46, 0.06, mat.shell);
  add('waist_accent', 0.63, 0.07, 0.55, 0, 0.85, 0.045, mat.gold);
  add('reel_backplane', 0.61, 0.82, 0.22, 0, 1.28, 0.16, mat.glass, -0.065);
  // The reel surface itself is NOT drawn. These four rails frame a 0.52 x 0.67 m aperture.
  // Claude must mount the actual 5x5 reels in the open area and check depth occlusion.
  add('reel_left_rail', 0.045, 0.77, 0.065, -0.286, 1.28, -0.005, mat.gold, -0.065);
  add('reel_right_rail', 0.045, 0.77, 0.065, 0.286, 1.28, -0.005, mat.gold, -0.065);
  add('reel_top_rail', 0.59, 0.045, 0.065, 0, 1.665, -0.005, mat.gold, -0.065);
  add('reel_bottom_rail', 0.59, 0.045, 0.065, 0, 0.895, -0.005, mat.gold, -0.065);
  // Two independent physical display housings, not just a single textured slab.
  add('upper_display_housing', 0.63, 0.34, 0.19, 0, 1.88, 0.11, mat.shell, -0.09);
  add('upper_display_face', 0.55, 0.25, 0.018, 0, 1.89, -0.003, mat.glass, -0.09);
  add('crown_trim', 0.65, 0.032, 0.21, 0, 2.06, 0.10, mat.gold);
  add('jackpot_header', 0.56, 0.09, 0.025, 0, 2.015, -0.025, mat.accent);
  add('angled_control_deck', 0.59, 0.13, 0.28, 0, 0.86, -0.23, mat.shell, -0.28);
  add('deck_gold_lip', 0.59, 0.018, 0.055, 0, 0.78, -0.365, mat.gold);
  add('side_gold_spine_left', 0.018, 1.10, 0.035, -0.315, 1.36, 0.09, mat.gold);
  add('side_gold_spine_right', 0.018, 1.10, 0.035, 0.315, 1.36, 0.09, mat.gold);
  // Optional LED strips are geometry only; no bloom, shaders or texture fetches.
  add('light_bar_left', 0.012, 0.65, 0.02, -0.321, 1.30, -0.02, mat.accent);
  add('light_bar_right', 0.012, 0.65, 0.02, 0.321, 1.30, -0.02, mat.accent);
  const triangles = root.children.reduce((n, mesh) => n + (mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3), 0);
  root.userData.velvetArt = {
    type: 'slim-multiscreen-slot-shell', visualOnly: true, productionIntegrated: false,
    triangles, meshCount: root.children.length, dimensionsM: { width: 0.68, height: 2.08, depth: 0.73 },
    front: '-Z', reelApertureM: { width: 0.52, height: 0.67, centerY: 1.28 },
    warning: 'Geometry-only prototype; no reel content, display UVs, animations or actual photoreal materials.'
  };
  return root;
}
