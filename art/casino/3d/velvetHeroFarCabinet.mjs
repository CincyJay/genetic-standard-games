/** Original Velvet Ace far-distance cabinet art study. No gameplay or production wiring.
 * Units metres; front faces +Z. Engine owns placement, culling and disposal.
 * Use beyond ~12m only after checking the silhouette and interactive-name mapping.
 */
export function createVelvetHeroFarCabinet(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.BoxGeometry || !THREE?.MeshStandardMaterial)
    throw new TypeError('A Three.js namespace is required');
  const root = new THREE.Group();
  root.name = options.name ?? 'VelvetHeroFarCabinet';
  const shell = new THREE.MeshStandardMaterial({color: options.shellColor ?? 0x18151e, metalness: 0.38, roughness: 0.36});
  const bronze = new THREE.MeshStandardMaterial({color: options.trimColor ?? 0xb38a55, metalness: 0.78, roughness: 0.26});
  const glass = new THREE.MeshStandardMaterial({color: 0x101625, metalness: 0.24, roughness: 0.18});
  const light = new THREE.MeshStandardMaterial({color: 0xffd4a0, emissive: 0xffb76b, emissiveIntensity: 0.42});
  const panel = new THREE.MeshStandardMaterial({color: options.screenColor ?? 0x214b71, emissive: options.screenColor ?? 0x214b71, emissiveIntensity: 0.3, roughness: 0.42});
  // Optional theme identity for distant rows. Omitted to preserve existing LOD visuals.
  const accent = options.accentColor == null ? null : new THREE.MeshStandardMaterial({
    color: options.accentColor, emissive: options.accentColor, emissiveIntensity: 0.5,
    metalness: 0.28, roughness: 0.4
  });
  const add = (name, geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.position.set(x,y,z); root.add(mesh); return mesh;
  };
  const box = (name,w,h,d,mat,x,y,z) => add(name,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  // Slender physical silhouette with a stepped curved-profile crown (no expensive bevels).
  box('cabinet_body',0.86,1.63,0.54,shell,0,1.07,0);
  box('cabinet_lower_skirt',0.73,0.18,0.61,bronze,0,0.22,0.01);
  box('cabinet_foot',0.64,0.12,0.59,shell,0,0.06,0.015);
  box('cabinet_crown',0.96,0.19,0.57,bronze,0,2.00,-0.005);
  box('cabinet_crown_inset',0.83,0.13,0.59,shell,0,2.015,0.008);
  box('cabinet_top_cap',0.72,0.08,0.51,bronze,0,2.14,-0.015);
  if (accent) {
    // Three low-poly luminous accents retain theme recognition without lights or textures.
    box('theme_crown_band',0.81,0.026,0.016,accent,0,2.055,0.311);
    box('theme_left_rail',0.022,1.31,0.018,accent,-0.425,1.21,0.281);
    box('theme_right_rail',0.022,1.31,0.018,accent,0.425,1.21,0.281);
    box('theme_title_band',0.70,0.035,0.018,accent,0,1.91,0.312);
  }
  // Three independent screen silhouettes preserve the stacked cabinet reading at distance.
  for (const [i,y,h] of [[0,1.65,0.43],[1,1.12,0.52],[2,0.64,0.35]]) {
    box('screen_'+i+'_bezel',0.73,h+0.055,0.055,bronze,0,y,0.293);
    box('screen_'+i+'_glass',0.665,h,0.012,glass,0,y,0.328);
    box('screen_'+i+'_display',0.60,h-0.065,0.013,panel,0,y,0.337);
  }
  box('control_deck',0.82,0.13,0.69,shell,0,0.41,0.105);
  box('control_deck_trim',0.79,0.025,0.69,bronze,0,0.49,0.11);
  const spin = add('spin_button',new THREE.CylinderGeometry(0.065,0.065,0.024,8),light,0.23,0.516,0.26);
  // Cylinder axis is +Y by default: the button lies flat on the control deck.
  // Its underside is at y=0.504, just above the deck trim top (0.5025).
  // No dynamic lights, orbs, curves, texture allocations or per-frame work.
  root.userData = {artStudy:true,lod:'far',suggestedMinDistanceMetres:12,
    forward:'+Z', approximateHeightMetres:2.2, revision:'VA-0337 optional theme accent bands',
    interactiveNames:['spin_button'], screens:['screen_0_display','screen_1_display','screen_2_display'],
    note:'Silhouette proxy; engine must map names and preserve actual interactive targets when swapping LOD',
    disclaimer:'Original stylized geometry, not photorealistic, integrated or device-tested'};
  return root;
}
