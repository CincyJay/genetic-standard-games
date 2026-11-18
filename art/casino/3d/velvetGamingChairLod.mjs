/**
 * Velvet Ace: lightweight, original physical casino gaming chair prototype.
 * Coordinates: +Y up, seat faces -Z. Metres. No textures or external assets.
 * Art-only, opt-in: host owns placement, collision, shadows and LOD switching.
 */
export function createVelvetGamingChairLod(THREE, options = {}) {
  const detail = options.detail ?? 'mid';
  const upholstery = options.upholstery ?? 0x572132;
  if (!['mid', 'near'].includes(detail) || !Number.isInteger(upholstery) ||
      upholstery < 0 || upholstery > 0xffffff)
    throw new RangeError('Invalid gaming chair art options');
  const root = new THREE.Group();
  root.name = 'VA_UPHOLSTERED_GAMING_CHAIR_LOD';
  const fabric = new THREE.MeshStandardMaterial({color:upholstery, roughness:.92});
  const piping = new THREE.MeshStandardMaterial({color:0xb88a4c, metalness:.65, roughness:.42});
  const frame = new THREE.MeshStandardMaterial({color:0x19191d, metalness:.42, roughness:.5});
  const add = (name, geometry, material, x,y,z) => {
    const mesh = new THREE.Mesh(geometry,material);
    mesh.name=name; mesh.position.set(x,y,z); root.add(mesh); return mesh;
  };
  // Cushioned seat with rounded edges; real thickness, not a flat plane.
  // Move the cushion's rear plane forward to meet the shell centre (z≈.185).\n  // Keep the front at z=-.24 so the existing front roll still covers the seam.\n  add('seat_cushion',new THREE.BoxGeometry(.53,.13,.43,1,1,1),fabric,0,.55,-.025);
  // Soft front roll projects past the box silhouette, without a costly subdivided seat.
  const seatRoll=add('seat_front_soft_roll',new THREE.CylinderGeometry(.062,.062,.50,detail==='near'?12:8),fabric,0,.555,-.218);
  seatRoll.rotation.z=Math.PI/2;
  add('seat_gold_front_piping',new THREE.BoxGeometry(.49,.012,.012),piping,0,.55,-.279);
  // Extend the curved shell down to the cushion: no separate protruding lumbar block.
  // The backrest is curved in plan and leans back; its two sides wrap the sitter.
  // A modest number of segments keeps distant banks affordable.
  const segments = detail === 'near' ? 12 : 6;
  const verts=[], normals=[], indices=[];
  for(let row=0;row<=5;row++){
    const t=row/5, y=.605+t*.705, half=.265+Math.sin(Math.PI*t)*.025;
    for(let i=0;i<=segments;i++){
      const u=i/segments*2-1;
      const z=.185 + .105*t + .075*u*u;
      verts.push(half*u,y,z);
    }
  }
  for(let row=0;row<5;row++)for(let i=0;i<segments;i++){
    const a=row*(segments+1)+i,b=a+segments+1;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const surface=new THREE.BufferGeometry();
  surface.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  surface.setIndex(indices); surface.computeVertexNormals();
  const backMaterial=fabric.clone();backMaterial.side=THREE.DoubleSide;
  add('sculpted_upholstered_backrest',surface,backMaterial,0,0,0);
  // Physical curved side rails and crown distinguish the chair at mid-distance.
  for(const sign of [-1,1]){
    // Follow the upholstered shell's changing width and backward lean exactly.
    // The previous straight cylinders floated at the corners and hid at mid-height.
    const edgePoints=[];
    for(let j=0;j<=8;j++){
      const t=j/8;
      edgePoints.push(new THREE.Vector3(
        sign*(.265+Math.sin(Math.PI*t)*.025),
        .605+.705*t,
        .185+.105*t+.075
      ));
    }
    const edgeCurve=new THREE.CatmullRomCurve3(edgePoints,false,'centripetal');
    add('back_gold_edge',new THREE.TubeGeometry(edgeCurve,detail==='near'?16:10,.012,5,false),piping,0,0,0);
    const arm=add('padded_armrest',new THREE.BoxGeometry(.09,.095,.32),fabric,sign*.315,.735,-.015);
    arm.rotation.x=-.08;
    // Rounded leading edge softens the rectangular arm silhouette.
    const armCap=add('armrest_front_roll',new THREE.CylinderGeometry(.047,.047,.09,detail==='near'?10:6),fabric,sign*.315,.722,-.175);
    armCap.rotation.z=Math.PI/2;
    add('armrest_support',new THREE.CylinderGeometry(.018,.024,.23,6),frame,sign*.315,.62,.07);
  }
  // The crest follows the shell's curved top edge, instead of floating across it.
  // Reuse the same quadratic z profile as the upholstered backrest.
  const crestPieces = detail === 'near' ? 12 : 6;
  for(let i=0;i<crestPieces;i++){
    const u0=-1+2*i/crestPieces, u1=-1+2*(i+1)/crestPieces;
    const um=(u0+u1)/2, x0=.265*u0, x1=.265*u1;
    const z0=.29+.075*u0*u0, z1=.29+.075*u1*u1;
    const piece=add('back_gold_top_crest',new THREE.BoxGeometry(
      Math.hypot(x1-x0,z1-z0)+.002,.025,.018),piping,
      (x0+x1)/2,1.315,(z0+z1)/2);
    piece.rotation.y=-Math.atan2(z1-z0,x1-x0);
  }
  // Five-point swivel base reads as casino furniture rather than dining chair.
  add('pedestal',new THREE.CylinderGeometry(.035,.045,.40,8),frame,0,.30,0);
  add('hub',new THREE.CylinderGeometry(.085,.085,.07,8),frame,0,.105,0);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5;
    const leg=add('swivel_spoke',new THREE.BoxGeometry(.035,.035,.32),frame,
      Math.sin(a)*.15,.085,Math.cos(a)*.15);
    leg.rotation.y=a;
    add('caster',new THREE.SphereGeometry(.036,6,4),frame,
      Math.sin(a)*.30,.055,Math.cos(a)*.30);
  }
  root.userData={artOnly:true,detail,seatHeight:.615,front:'-Z',units:'metres',
    integration:'Place as isolated prop; share geometries/materials across repeated chairs; do not mutate production scenes',
    verified:'source-only rear cushion ledge reduction; rendering and device fit unverified'};
  return root;
}
