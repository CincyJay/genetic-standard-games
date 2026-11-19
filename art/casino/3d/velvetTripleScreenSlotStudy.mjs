/**
 * Velvet Ace | portrait triple-display slot cabinet study, v1.
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
  box('VA_weighted_plinth',0.82,0.12,0.78,0,0.065,0,black);
  roundedPanel('VA_burgundy_base',0.77,0.59,0.10,0.61,burgundy,0,0.44,-0.32);
  roundedPanel('VA_tapered_tower',0.70,1.71,0.13,0.35,metal,0,1.43,-0.25);
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
  roundedPanel('VA_console_ledge',0.76,0.19,0.075,0.39,black,0,0.657,-0.205);
  box('VA_console_gold_lip',0.71,0.022,0.035,0,0.735,0.197,brass);
  for(let i=0;i<5;i++){
    const button=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.038,0.018,20),i===4?light:brass);
    button.name='VA_player_button_'+(i+1);
    button.rotation.x=Math.PI/2;button.position.set((i-2)*0.115,0.664,0.209);root.add(button);
  }
  // Twin narrow light channels and recessed side cheeks.
  for(const side of [-1,1]){
    roundedPanel('VA_side_cheek_'+side,0.055,1.58,0.024,0.15,burgundy,side*0.36,1.43,-0.018);
    box('VA_vertical_light_'+side,0.014,1.37,0.012,side*0.336,1.43,0.162,light);
  }
  root.userData.screenSurfaces=surfaces;
  root.userData.materials={metal,black,brass,burgundy,glass,light};
  root.userData.integration='Prototype only: use opt-in flag, map game canvases to screenSurfaces, benchmark calls/tris and capture side/front views before approval.';
  return root;
}
