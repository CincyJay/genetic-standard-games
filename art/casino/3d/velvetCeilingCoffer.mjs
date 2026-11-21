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
  const inset = new THREE.MeshStandardMaterial({ color: options.insetColor ?? 0x14131c, roughness: 0.92 });
  const glow = new THREE.MeshStandardMaterial({ color: options.lightColor ?? 0xffd49b, emissive: options.lightColor ?? 0xffd49b, emissiveIntensity: 1.5, roughness: 0.55 });
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
  add('coffer_inset',new THREE.BoxGeometry(width-0.30,0.035,depth-0.30),inset,0,0.12,0);
  ring(width,depth,width-0.28,depth-0.28,0.07,'coffer_plaster_frame',plaster,0.05);
  ring(width-0.31,depth-0.31,width-0.38,depth-0.38,0.022,'coffer_bronze_bead',bronze,0.038);
  ring(width-0.42,depth-0.42,width-0.47,depth-0.47,0.012,'coffer_light_diffuser',glow,0.032);
  // Original fluted bronze corner medallions, with low-cost radial geometry.
  for (const sx of [-1,1]) for (const sz of [-1,1]) {
    add('corner_rosette',new THREE.CylinderGeometry(0.075,0.075,0.013,12),bronze,
      sx*(width/2-0.19),0.015,sz*(depth/2-0.19));
  }
  // Emissive surfaces are decorative, not real light sources; engine owns lighting.
  root.userData = {
    artStudy:true, forward:'-Y', widthMetres:width, depthMetres:depth,
    lightImplementation:'emissive only; add engine-owned lighting if desired',
    disclaimer:'Original stylized coffer geometry, not photorealistic or device-tested'
  };
  return root;
}
