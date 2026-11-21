/** Velvet Ace original art study: recessed casino ceiling coffers and luminous coves.
 * Isolated Three.js geometry. Not wired into production or gameplay.
 * Units metres. Caller positions the group at ceiling elevation and owns disposal.
 */
export function createVelvetCeilingCoffer(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.Shape || !THREE?.ExtrudeGeometry)
    throw new TypeError('Supply the Three.js namespace');
  const width = options.width ?? 3.6;
  const depth = options.depth ?? 3.6;
  if (!(width > 1 && depth > 1)) throw new RangeError('Ceiling coffer must exceed 1m in each direction');
  const root = new THREE.Group();
  root.name = 'VelvetCeilingCoffer_ArtStudy';
  const plaster = new THREE.MeshStandardMaterial({ color: options.plasterColor ?? 0x24202a, roughness: 0.88 });
  const bronze = new THREE.MeshStandardMaterial({ color: options.trimColor ?? 0x98754b, metalness: 0.78, roughness: 0.31 });
  const inset = new THREE.MeshStandardMaterial({ color: options.insetColor ?? 0x554638, roughness: 0.88, emissive: options.insetEmissiveColor ?? 0x251b13, emissiveIntensity: options.insetEmissiveIntensity ?? 0.16 });
  const glow = new THREE.MeshStandardMaterial({ color: options.lightColor ?? 0xffd49b, emissive: options.lightColor ?? 0xffd49b, emissiveIntensity: 0.24, roughness: 0.55 });
  const add = (name, geometry, material, x=0,y=0,z=0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(x,y,z);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  // Ceiling faces down (-Y); concentric rectangular rings produce actual relief.
  const ring = (outerW, outerD, innerW, innerD, thickness, name, material, y) => {
    const s = new THREE.Shape();
    s.moveTo(-outerW/2,-outerD/2);
    s.lineTo(outerW/2,-outerD/2);
    s.lineTo(outerW/2,outerD/2);
    s.lineTo(-outerW/2,outerD/2);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-innerW/2,-innerD/2);
    hole.lineTo(-innerW/2,innerD/2);
    hole.lineTo(innerW/2,innerD/2);
    hole.lineTo(innerW/2,-innerD/2);
    hole.closePath();
    s.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(s, {depth:thickness, bevelEnabled:false, steps:1, curveSegments:1});
    const mesh = add(name,geo,material,0,y,0);
    mesh.rotation.x = -Math.PI/2;
    return mesh;
  };
  add('coffer_inset',new THREE.BoxGeometry(width-0.24,0.035,depth-0.24),inset,0,0.12,0);
  ring(width,depth,width-0.28,depth-0.28,0.38,'coffer_plaster_frame',plaster,-0.30);
  // Overlap the structural frame by 1 cm instead of leaving a floating gap.
  ring(width-0.26,depth-0.26,width-0.42,depth-0.42,0.028,'coffer_bronze_bead',bronze,-0.315);
  // Diffuser overlaps the bead by 1 cm, eliminating the loose inner ring.
  // Optional per-tile ownership prevents adjacent coffers drawing duplicate light lines.
  // Missing option retains the original single-ring mesh and its geometry budget.
  const edges = options.diffuserEdges;
  if (edges === undefined) {
    ring(width-0.40,depth-0.40,width-0.465,depth-0.465,0.012,'coffer_light_diffuser',glow,-0.322);
  } else {
    if (!edges || typeof edges !== 'object' || ['n','s','e','w'].some(k => typeof edges[k] !== 'boolean'))
      throw new TypeError('diffuserEdges requires boolean n, s, e and w properties');
    const outerW = width - 0.40, outerD = depth - 0.40;
    const strip = 0.0325; // (outer - inner) / 2; same as the original ring.
    const halfW = outerW/2, halfD = outerD/2;
    // Match the original ring's -0.322..-0.310 vertical extent; no bead gap.
    const addStrip = (key,w,d,x,z) =>
      add('coffer_light_diffuser_' + key,new THREE.BoxGeometry(w,0.012,d),glow,x,-0.316,z);
    // East/west strips own their corners; north/south stop at their inner edges.
    // With all four enabled the visible footprint equals the original ring.
    if (edges.n) addStrip('n',outerW-2*strip,strip,0,-halfD+strip/2);
    if (edges.s) addStrip('s',outerW-2*strip,strip,0,halfD-strip/2);
    if (edges.e) addStrip('e',strip,outerD,halfW-strip/2,0);
    if (edges.w) addStrip('w',strip,outerD,-halfW+strip/2,0);
  }
  // Original fluted bronze corner medallions, with low-cost radial geometry.
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    add('corner_rosette',new THREE.CylinderGeometry(0.075,0.075,0.013,8),bronze,
      sx*(width/2-0.19),-0.33,sz*(depth/2-0.19));
  }
  // Emissive surfaces are decorative, not real light sources; engine owns lighting.
  root.userData = {
    artStudy:true, forward:'-Y', widthMetres:width, depthMetres:depth,
    lightImplementation:'emissive only; add engine-owned lighting if desired',
    revision:'VA-0334 edge diffuser height aligned to ring; default ring preserved',
    disclaimer:'Original stylized coffer geometry, not photorealistic or device-tested'
  };
  return root;
}
