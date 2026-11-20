/**
 * Velvet Ace | original upholstered casino chair geometry study.
 * Isolated art module: no gameplay, asset loader, or production dependency.
 * Three.js is supplied by the caller so the prototype can share its renderer.
 *
 * Units are metres. Seat top ~0.49m, back top ~1.13m, front faces -Z.
 * Caller owns disposal and can inspect named parts for material replacement.
 */
export function createVelvetCasinoChair(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.Shape || !THREE?.ExtrudeGeometry)
    throw new TypeError('Supply the Three.js namespace');
  const upholstery = new THREE.MeshStandardMaterial({
    color: options.fabricColor ?? 0x55212f, roughness: 0.87, metalness: 0.0
  });
  const piping = new THREE.MeshStandardMaterial({
    color: options.pipingColor ?? 0xb18b50, roughness: 0.37, metalness: 0.65
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x28262a, roughness: 0.4, metalness: 0.75
  });
  const shadow = new THREE.MeshStandardMaterial({
    color: 0x28151e, roughness: 0.95, metalness: 0.0
  });
  const root = new THREE.Group();
  root.name = 'VelvetAceCasinoChair_ArtStudy';

  const add = (name, geometry, material, xyz, rotation) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.position.set(...xyz);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  // Rounded contour extruded along Z: bevels read as actual upholstery edges.
  const roundedContour = (width, height, radius) => {
    const x = -width/2, y = -height/2, r = Math.min(radius,width/2,height/2);
    const s = new THREE.Shape();
    s.moveTo(x+r,y); s.lineTo(x+width-r,y);
    s.quadraticCurveTo(x+width,y,x+width,y+r);
    s.lineTo(x+width,y+height-r);
    s.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
    s.lineTo(x+r,y+height);
    s.quadraticCurveTo(x,y+height,x,y+height-r);
    s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y);
    return s;
  };
  const cushion = (w,h,depth,r,bevel=0.025) =>
    new THREE.ExtrudeGeometry(roundedContour(w,h,r), {
      depth: Math.max(0.01,depth-2*bevel),
      bevelEnabled:true, bevelSegments:3, steps:1,
      bevelThickness:bevel, bevelSize:bevel*0.65, curveSegments:5
    });
  // Seat slopes subtly backwards; upholstered edge has physical thickness.
  add('seat_cushion',cushion(0.60,0.15,0.29,0.065),upholstery,[0,0.435,-0.275],[-0.055,0,0]);
  add('seat_underpan',new THREE.BoxGeometry(0.54,0.065,0.39),shadow,[0,0.355,-0.035]);
  // Tall curved silhouette uses three nested panels, not a single box slab.
  const back = add('back_outer',cushion(0.65,0.69,0.115,0.17),upholstery,[0,0.805,0.195],[-0.095,0,0]);
  add('back_inset',cushion(0.54,0.56,0.024,0.135,0.009),shadow,[0,0.815,0.075],[-0.095,0,0]);
  add('back_padded_insert',cushion(0.51,0.53,0.034,0.13,0.013),upholstery,[0,0.815,0.045],[-0.095,0,0]);
  // Small inset button-tuft details give scale cues without expensive tessellation.
  for(const y of [0.69,0.88,1.04]){
    for(const x of [-0.13,0.13]){
      const localY = y - 0.815;
      const tilt = -0.095;
      add('upholstery_button',new THREE.SphereGeometry(0.011,8,6),piping,
        [x,0.815+localY*Math.cos(tilt)-(-0.002)*Math.sin(tilt),0.045+localY*Math.sin(tilt)+(-0.002)*Math.cos(tilt)]);
    }
  }
  // Brass piping is physically raised around the inset's visible perimeter.
  const trim = (w,h,r,z,cy) => {
    const curve = roundedContour(w,h,r).getPoints(44);
    const points = curve.map(p=>new THREE.Vector3(p.x,p.y,z));
    points.push(points[0].clone());
    add('back_piping',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),72,0.0055,5,true),
      piping,[0,cy,0.045],[-0.095,0,0]);
  };
  trim(0.50,0.52,0.13,-0.027,0.815);
  // Sculpted armrests, front supports, five-spoke weighted base and gas lift.
  for(const side of [-1,1]){
    add('arm_pad',cushion(0.105,0.09,0.39,0.042,0.012),upholstery,
      [side*0.322,0.68,-0.205],[0,0,0]);
    // A continuous dark-metal cradle supports the upholstered pad at both ends.
    add('arm_cradle',new THREE.BoxGeometry(0.048,0.032,0.33),steel,
      [side*0.322,0.618,-0.047]);
    for (const z of [-0.17,0.08]) {
      add('arm_support',new THREE.CylinderGeometry(0.018,0.025,0.25,10),steel,
        [side*0.322,0.49,z]);
    }
  }
  add('gas_lift',new THREE.CylinderGeometry(0.033,0.043,0.29,12),steel,[0,0.24,0.02]);
  add('base_hub',new THREE.CylinderGeometry(0.087,0.08,0.065,16),steel,[0,0.11,0.02]);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5;
    const spoke=add('base_spoke',new THREE.BoxGeometry(0.065,0.038,0.34),steel,
      [Math.sin(a)*0.16,0.085,0.02+Math.cos(a)*0.16],[0,a,0]);
    add('caster',new THREE.SphereGeometry(0.038,10,8),shadow,
      [Math.sin(a)*0.32,0.052,0.02+Math.cos(a)*0.32]);
  }
  root.userData = { artStudy:true, seatHeightMetres:0.49, forward:'-Z',
    disclaimer:'Stylized original geometry; not photorealistic or device-tested' };
  return root;
}
