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
    button: new THREE.MeshStandardMaterial({ color: 0xe4c77e, metalness: 0.72, roughness: 0.22 }),
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
  // Bank pitch is 0.64 m: no rigid cabinet part may exceed 0.62 m in X.
  // Chamfered eight-point footprint reads rounder without expensive bevels.
  const contour = (name, w, h, depth, y, z, material) => {
    const shape = new THREE.Shape();
    const hw = w / 2, bevel = 0.055;
    shape.moveTo(-hw + bevel, -depth / 2);
    shape.lineTo(hw - bevel, -depth / 2);
    shape.lineTo(hw, -depth / 2 + bevel);
    shape.lineTo(hw, depth / 2 - bevel);
    shape.lineTo(hw - bevel, depth / 2);
    shape.lineTo(-hw + bevel, depth / 2);
    shape.lineTo(-hw, depth / 2 - bevel);
    shape.lineTo(-hw, -depth / 2 + bevel);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 1, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(0, y, z);
    root.add(mesh);
    return mesh;
  };
  // Chamfered physical shell with curved visual rhythm, not a flat stacked-box silhouette.
  contour('weighted_plinth', 0.60, 0.10, 0.62, 0, 0.03, mat.gold);
  contour('lower_body', 0.58, 0.73, 0.53, 0.10, 0.06, mat.shell);
  contour('waist_accent', 0.61, 0.07, 0.55, 0.83, 0.045, mat.gold);
  add('reel_backplane', 0.61, 0.78, 0.22, 0, 1.28, 0.16, mat.glass, -0.065);
  // Reel screen remains supplied by Claude's existing 5x5 canvas swap. Aperture between rail inner edges is ~0.58 x 0.69 m; the host supplies the actual reel canvas.
  // Claude must mount the actual 5x5 reels in the open area and check depth occlusion.
  add('reel_left_rail', 0.016, 0.71, 0.065, -0.298, 1.28, -0.005, mat.gold, -0.065);
  add('reel_right_rail', 0.016, 0.71, 0.065, 0.298, 1.28, -0.005, mat.gold, -0.065);
  add('reel_top_rail', 0.60, 0.020, 0.065, 0, 1.635, -0.005, mat.gold, -0.065);
  add('reel_bottom_rail', 0.60, 0.020, 0.065, 0, 0.925, -0.005, mat.gold, -0.065);
  // Two independent physical display housings, not just a single textured slab.
  add('upper_display_housing', 0.60, 0.34, 0.19, 0, 1.88, 0.11, mat.shell, -0.09);
  add('upper_display_face', 0.54, 0.25, 0.018, 0, 1.89, -0.003, mat.glass, -0.09);
  add('crown_trim', 0.61, 0.032, 0.21, 0, 2.06, 0.10, mat.gold);
  add('jackpot_header', 0.56, 0.09, 0.025, 0, 2.015, -0.025, mat.accent);
  add('angled_control_deck', 0.58, 0.13, 0.28, 0, 0.86, -0.23, mat.shell, -0.28);
  add('deck_gold_lip', 0.58, 0.018, 0.055, 0, 0.78, -0.365, mat.gold);
  add('side_gold_spine_left', 0.018, 1.10, 0.035, -0.300, 1.36, 0.09, mat.gold);
  add('side_gold_spine_right', 0.018, 1.10, 0.035, 0.300, 1.36, 0.09, mat.gold);
  // Accent inlays share the rail's centre/pivot and -0.065 rad tilt. In the rail's
  // local frame its front face is z=-0.0375; inlay back face is z=-0.040.
  // A 2.5 mm proud surface avoids the 32 mm bottom float / 10 mm top burial
  // measured by Claude in VA-0223. Non-emissive geometry; no bloom assumed.
  add('light_bar_left', 0.010, 0.65, 0.012, -0.299, 1.28, -0.046, mat.accent, -0.065);
  add('light_bar_right', 0.010, 0.65, 0.012, 0.299, 1.28, -0.046, mat.accent, -0.065);
  // Physical controls lowered 19 mm along the deck normal to eliminate the observed floating gap.
  // Physical controls on the angled deck, with shared materials.
  for (let i = 0; i < 5; i++) {
    const key = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 10), mat.button);
    key.name = 'deck_button_' + (i + 1);
    key.position.set((i - 2) * 0.105, 0.922, -0.272);
    key.rotation.x = -0.28;
    root.add(key);
  }
  // Public UV-ready surface: host can assign a unique theme/marquee material.
  const marquee = root.getObjectByName('upper_display_face');
  marquee.userData.textureSlot = 'upper-marquee';
  marquee.userData.uvRange = [0, 0, 1, 1];
  const triangles = root.children.reduce((n, mesh) => n + (mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3), 0);
  root.userData.velvetArt = {
    type: 'slim-multiscreen-slot-shell', visualOnly: true, productionIntegrated: false,
    triangles, meshCount: root.children.length, dimensionsM: { width: 0.62, height: 2.08, depth: 0.73 },
    front: '-Z', reelApertureM: { width: 0.58, height: 0.69, centerY: 1.28 },
    warning: 'Geometry-only prototype; host must resize/reposition its reel plane to 0.58 x 0.69, supply marquee texture, and verify bounds, LOD and visual quality.'
  };
  return root;
}
