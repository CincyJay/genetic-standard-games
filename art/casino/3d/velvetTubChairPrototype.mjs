/**
 * Velvet Ace: original low-triangle casino tub chair, optional art prototype.
 * Y-up, seat front +Z, metres. Geometry only: no scene, physics or live assets.
 * Unlike the rejected swivel, this has one continuous upholstered back shell,
 * a lower/wider silhouette and a concealed pedestal rather than office spokes.
 */
export function createVelvetTubChair(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.BufferGeometry || !THREE?.MeshStandardMaterial || !THREE?.Vector3 || !THREE?.TubeGeometry || !THREE?.CatmullRomCurve3)
    throw new TypeError('A Three.js instance is required');
  const segments = options.segments ?? 18;
  if (!Number.isInteger(segments) || segments < 12 || segments > 32)
    throw new RangeError('segments must be an integer from 12 to 32');
  const root = new THREE.Group();
  root.name = 'VA_art_tub_chair';
  root.userData.forward = '+Z';
  const upholstery = new THREE.MeshStandardMaterial({ color: options.leatherColor ?? 0x512438, roughness: .83 });
  const shadowLeather = new THREE.MeshStandardMaterial({ color: 0x321a27, roughness: .87 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb58a52, metalness: .72, roughness: .32 });
  const mesh = (name, geometry, material, x=0, y=0, z=0) => {
    const m = new THREE.Mesh(geometry, material);
    m.name = name; m.position.set(x,y,z);
    m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
  };
  // Upholstered seat at exactly 0.65m, front is +Z.
  mesh('VA_tub_seat_plinth', new THREE.CylinderGeometry(.325,.29,.065,segments), shadowLeather,0,.487,.035);
  const cushion = mesh('VA_tub_cushion', new THREE.SphereGeometry(1,segments,10),upholstery,0,.574,.065);
  cushion.scale.set(.334,.076,.315); // top .650
  // Continuous curved back and arms: single indexed quad strip, open at front.
  // The two side ends are integral with the back, not disconnected wing slabs.
  const positions=[], indices=[], uvs=[];
  const start=Math.PI*.12, end=Math.PI*1.88;
  const rings=[
    {y:.525,r:.310,depth:.225},
    {y:.67,r:.330,depth:.245},
    {y:.83,r:.342,depth:.260},
    {y:.955,r:.330,depth:.250},
    {y:1.015,r:.306,depth:.238}
  ];
  // theta=pi is rear (-Z), ends bend forward as low integrated arms.
  // Angles traverse from the +Z front-right arm, around the -Z back, to the +Z front-left arm.
  for(let j=0;j<rings.length;j++){
    const ring=rings[j];
    for(let i=0;i<=segments;i++){
      const t=start+(end-start)*i/segments;
      const edge=Math.abs(i/segments-.5)*2;
      const armStraighten=Math.pow(edge, 8);
      const x=Math.sin(t)*ring.r + (i < segments/2 ? 1 : -1)*.142*armStraighten;
      const z=Math.cos(t)*ring.depth - .105;
      // lower the arm ends progressively; keep back highest at the centre.
      const endFactor=Math.pow(Math.abs(i/segments-.5)*2,2);
      const y=ring.y-(j>=2 ? endFactor*(ring.y-.79) : 0);
      positions.push(x,y,z); uvs.push(i/segments,j/(rings.length-1));
    }
  }
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
    const a=j*(segments+1)+i,b=a+segments+1;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const shellGeo=new THREE.BufferGeometry();
  shellGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  shellGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  shellGeo.setIndex(indices); shellGeo.computeVertexNormals();
  const shellMat=upholstery.clone(); shellMat.side=THREE.DoubleSide; shellMat.flatShading=false;
  mesh('VA_integrated_tub_shell',shellGeo,shellMat);
  // A continuous, fine brass rim traces the actual upper shell ring, not a floating hoop.\n  const rimPoints=[];\n  const topRing=rings.length-1;\n  for(let i=0;i<=segments;i++){\n    const k=(topRing*(segments+1)+i)*3;\n    rimPoints.push(new THREE.Vector3(positions[k],positions[k+1]+.004,positions[k+2]));\n  }\n  const rimCurve=new THREE.CatmullRomCurve3(rimPoints,false,'centripetal');\n  mesh('VA_tub_shell_brass_rim',new THREE.TubeGeometry(rimCurve,segments*3,.006,5,false),brass);\n  // Inner padded back is integrated visually, without freestanding wing lobes.
  const inner=mesh('VA_tub_back_cushion',new THREE.SphereGeometry(1,segments,10),upholstery,0,.83,-.272);
  inner.scale.set(.275,.16,.075);
  // Low casino pedestal: floor-contacting weighted circular foot, not office star.
  mesh('VA_pedestal_foot',new THREE.CylinderGeometry(.225,.245,.055,segments),brass,0,.0275,0);
  mesh('VA_pedestal_column',new THREE.CylinderGeometry(.07,.10,.38,segments),shadowLeather,0,.245,0);
  mesh('VA_pedestal_cap',new THREE.CylinderGeometry(.16,.12,.045,segments),brass,0,.454,0);
  root.userData.velvetArt={
    type:'original-tub-chair-v3',visualOnly:true,prototype:true,
    orientation:'front +Z',seatHeight:.65,
    integration:'Opt-in chair comparison only; do not replace defaults. Compare against velvet/luxury from all camera angles.',
    validation:'Source-only; not rendered, not photorealistic, not device-tested. Verify normals, seated camera and collision.'
  };
  return root;
}
