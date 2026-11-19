/**
 * Velvet Ace optional slim cabinet mid/far visual LOD.
 * Original geometry only; no gameplay, reels, textures, Firebase or hitboxes.
 * Matches createVelvetSlimCabinet: Y up, -Z front, 0.64 m bank pitch.
 * Intended to be positioned at the SAME root origin as the near shell.
 */
export function createVelvetSlimCabinetLOD(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.BoxGeometry || !THREE?.MeshStandardMaterial)
    throw new TypeError('Compatible Three.js namespace required');
  const level = options.level === 'far' ? 'far' : 'mid';
  const root = new THREE.Group();
  root.name = 'velvet_slim_slot_' + level;
  const shell = new THREE.MeshStandardMaterial({color: options.shellColor ?? 0x18151d, metalness: .35, roughness: .37});
  const gold = new THREE.MeshStandardMaterial({color: options.trimColor ?? 0xc6a05b, metalness: .82, roughness: .24});
  const glass = new THREE.MeshStandardMaterial({color: 0x111725, metalness: .15, roughness: .16});
  const accent = new THREE.MeshStandardMaterial({color: options.accentColor ?? 0x6e294e, metalness: .25, roughness: .4});
  const add = (name, w, h, d, x, y, z, material, tilt = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.name = name; mesh.position.set(x,y,z); mesh.rotation.x = tilt;
    mesh.castShadow = false; mesh.receiveShadow = false;
    root.add(mesh); return mesh;
  };
  // Keep the distinctive two-screen silhouette at EVERY distance.
  // Slim silhouette and heights follow the near prototype, not Svelte towers.
  add('plinth', .60, .10, .60, 0, .05, .03, gold);
  add('body', .58, .75, .53, 0, .47, .06, shell);
  add('waist', .60, .055, .55, 0, .845, .045, gold);
  add('reel_backplane', .60, .78, .22, 0, 1.28, .16, glass, -.065);
  // Preserve 0.58 x 0.69 m reel opening; do not draw dummy symbols.
  add('reel_left', .012, .71, .065, -.294, 1.28, -.005, gold, -.065);
  add('reel_right', .012, .71, .065, .294, 1.28, -.005, gold, -.065);
  add('reel_top', .60, .018, .065, 0, 1.635, -.005, gold, -.065);
  add('reel_bottom', .60, .018, .065, 0, .925, -.005, gold, -.065);
  add('marquee_housing', .60, .34, .19, 0, 1.88, .11, shell, -.09);
  const marquee = add('upper_display_face', .54, .25, .018, 0, 1.89, -.003, glass, -.09);
  marquee.userData.textureSlot = 'upper-marquee';
  marquee.userData.uvRange = [0,0,1,1];
  add('crown', .60, .032, .21, 0, 2.06, .10, gold);
  add('jackpot_band', .56, .09, .025, 0, 2.015, -.025, accent);
  // Match near-level deck geometry exactly to avoid a silhouette pop at 15 m.
  add('angled_deck', .58, .13, .28, 0, .86, -.23, shell, -.28);
  add('deck_lip', .58, .018, .055, 0, .78, -.365, gold);
  if (level === 'mid') {
    add('left_spine', .018, 1.10, .035, -.300, 1.36, .09, gold);
    add('right_spine', .018, 1.10, .035, .300, 1.36, .09, gold);
    // At medium distance five separate buttons retain the physical controls.
    // Same finish and button geometry as near shell; material sharing is host-owned.
    const button = new THREE.MeshStandardMaterial({color: 0xe4c77e, metalness: .72, roughness: .22});
    for (let i=0; i<5; i++) {
      const key = new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,.012,10), button);
      key.name = 'deck_button_' + (i+1);
      key.position.set((i-2)*.105,.922,-.272); key.rotation.x = -.28;
      root.add(key);
    }
  } else {
    // Far LOD: one low-cost gold strip signals five buttons without five meshes.
    add('button_strip', .47, .012, .025, 0, .922, -.272, gold, -.28);
  }
  const triangles = root.children.reduce((sum, mesh) =>
    sum + (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count)/3, 0);
  root.userData.velvetArt = {
    type:'slim-multiscreen-slot-lod', level, visualOnly:true,
    productionIntegrated:false, triangles, meshCount:root.children.length,
    dimensionsM:{width:.618,height:2.08,depth:.73}, front:'-Z',
    reelApertureM:{width:.58,height:.69,centerY:1.28},
    warning:'Optional source prototype. Host must mount its own 5x5 reel plane and marquee, check occlusion and LOD switching, and capture device screenshots.'
  };
  return root;
}
