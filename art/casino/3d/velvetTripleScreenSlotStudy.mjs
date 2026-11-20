/**
 * Velvet Ace | portrait triple-display slot cabinet study, v4.
 * Isolated original geometry. No production import, no gameplay or textures fetched.
 * Usage: const cabinet = createVelvetTripleSlotCabinet(THREE); scene.add(cabinet);
 * Origin: floor center. Front faces +Z. Dimensions approx 0.88 W x 2.42 H x 0.86 D (m).
 * Display surfaces are replaceable via userData.screenSurfaces; caller owns texture lifecycle.
 */
export function createVelvetTripleSlotCabinet(THREE, options = {}) {
  const root = new THREE.Group();
  root.name = 'VA_triple_portrait_slot_study';
  root.userData.prototypeOnly = true;
  root.userData.front = '+Z';
  const metal = new THREE.MeshStandardMaterial({color:0x24232a,metalness:0.72,roughness:0.28});
  const black = new THREE.MeshStandardMaterial({color:0x080b12,metalness:0.2,roughness:0.24});
  const brass = new THREE.MeshStandardMaterial({color:0xc6a365,metalness:0.84,roughness:0.22});
  const burgundy = new THREE.MeshStandardMaterial({color:0x371423,metalness:0.38,roughness:0.32});
  const glass = new THREE.MeshStandardMaterial({color:0x111d30,metalness:0.12,roughness:0.12,emissive:0x071326,emissiveIntensity:0.4});
  const light = new THREE.MeshStandardMaterial({color:0xf0c77c,emissive:0xe5a54c,emissiveIntensity:0.7,roughness:0.35});
  function box(name,w,h,d,x,y,z,mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.name=name;m.position.set(x,y,z);root.add(m);return m;
  }
  function roundedPanel(name,w,h,r,depth,mat,x,y,z) {
    const shape = new THREE.Shape();
    const a=-w/2,b=-h/2;
    shape.moveTo(a+r,b);shape.lineTo(a+w-r,b);
    shape.quadraticCurveTo(a+w,b,a+w,b+r);shape.lineTo(a+w,b+h-r);
    shape.quadraticCurveTo(a+w,b+h,a+w-r,b+h);shape.lineTo(a+r,b+h);
    shape.quadraticCurveTo(a,b+h,a,b+h-r);shape.lineTo(a,b+r);
    shape.quadraticCurveTo(a,b,a+r,b);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:0.008,bevelThickness:0.007,curveSegments:5});
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.name=name;mesh.position.set(x,y,z);root.add(mesh);return mesh;
  }
  // Sculpted silhouette: narrow upper tower, wider player console, deep weighted foot.
  box('VA_weighted_plinth',0.82,0.14,0.78,0,0.070,0,black);
  roundedPanel('VA_burgundy_base',0.77,0.59,0.10,0.61,burgundy,0,0.438,-0.32);
  // Continuous swept body: rounded shoulders and a subtle concave waist, not a flat slab.
  // Eight longitudinal sections, closed side walls; front remains behind all screen bezels.
  const sections=[
    [0.72,0.37,-0.33,0.040],[0.88,0.36,-0.33,0.065],
    [1.12,0.345,-0.30,0.085],[1.38,0.338,-0.285,0.100],
    [1.64,0.340,-0.28,0.102],[1.88,0.348,-0.285,0.095],
    [2.14,0.355,-0.30,0.090],[2.28,0.365,-0.32,0.075]
  ];
  const vertices=[], indices=[];
  for(const [y,halfWidth,rear,front] of sections){
    vertices.push(-halfWidth,y,front, halfWidth,y,front,
                  halfWidth,y,rear, -halfWidth,y,rear);
  }
  for(let j=0;j<sections.length-1;j++){
    const a=j*4,b=(j+1)*4;
    for(let k=0;k<4;k++){
      const next=(k+1)%4;
      indices.push(a+k,a+next,b+next,a+k,b+next,b+k);
    }
  }
  indices.push(0,3,2,0,2,1);
  const last=(sections.length-1)*4;
  indices.push(last,last+1,last+2,last,last+2,last+3);
  const bodyGeometry=new THREE.BufferGeometry();
  bodyGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  bodyGeometry.setIndex(indices);
  bodyGeometry.computeVertexNormals();
  const tower=new THREE.Mesh(bodyGeometry,metal);
  tower.name='VA_curved_tapered_tower';
  root.add(tower);
  roundedPanel('VA_upper_crown',0.78,0.21,0.10,0.37,brass,0,2.29,-0.26);
  // Two stacked upper displays plus main 5x5-style reel display; no fake game art.
  const surfaces=[];
  const screens=[
    {name:'top_marquee',w:0.60,h:0.34,y:2.065,z:0.133},
    {name:'bonus_display',w:0.60,h:0.37,y:1.687,z:0.135},
    {name:'main_reels_5x5',w:0.63,h:0.69,y:1.128,z:0.142}
  ];
  for (const s of screens) {
    roundedPanel('VA_'+s.name+'_bezel',s.w+0.075,s.h+0.066,0.045,0.028,brass,0,s.y,s.z-0.023);
    const display=roundedPanel('VA_'+s.name+'_glass',s.w,s.h,0.026,0.006,glass,0,s.y,s.z+0.016);
    display.userData.slotScreen=s.name;surfaces.push(display);
  }
  // Player console and physically separate buttons. A screen texture is not a cabinet.
  // Cantilevered physical button deck, placed ahead of the base front (z ~0.30).
  // The front edge is lower than the rear edge, inviting seated play.
  const deck=box('VA_console_ledge',0.72,0.055,0.39,0,0.712,0.348,burgundy);
  deck.rotation.x=0.14;
  box('VA_console_gold_lip',0.70,0.018,0.024,0,0.680,0.548,brass);
  for(const side of [-1,1]){
    const bracket=box('VA_console_support_'+side,0.035,0.14,0.23,side*0.28,0.675,0.315,metal);
    bracket.rotation.x=0.14;
  }
  for(let i=0;i<5;i++){
    const button=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.038,0.018,20),i===4?light:brass);
    button.name='VA_player_button_'+(i+1);
    button.rotation.x=deck.rotation.x;
    button.position.set((i-2)*0.115,0.752,0.395);root.add(button);
  }
  // Slim integrated illuminated edge rails follow the swept body, avoiding flat cheek boards.
  for(const side of [-1,1]){
    const points=sections.slice(1,-1).map(([y,halfWidth,rear,front])=>
      new THREE.Vector3(side*(halfWidth-0.009),y,front+0.008));
    const rail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,0.008,5,false),light);
    rail.name='VA_contoured_light_rail_'+side;root.add(rail);
  }
  root.userData.screenSurfaces=surfaces;
  root.userData.console={deck,buttonTopY:0.762,frontZ:0.548};
  root.userData.materials={metal,black,brass,burgundy,glass,light};
  root.userData.integration='Prototype only: use opt-in flag, map game canvases to screenSurfaces, benchmark calls/tris and capture side/front views before approval.';
  return root;
}
