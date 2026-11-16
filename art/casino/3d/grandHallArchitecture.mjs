// Velvet Ace grand hall architectural art kit (opt-in only).
// Host supplies its own THREE instance to prevent cross-version Three.js objects.
// Coordinate convention: X across hall, Z down hall, Y up; floor top at y=0.
export function createGrandHallArchitecture(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.MeshStandardMaterial) throw new Error('Pass the host THREE namespace');
  const clamp = (v, fallback, lo, hi) => Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  const width = clamp(options.width, 24, 16, 80);
  const length = clamp(options.length, 36, 20, 120);
  const height = clamp(options.height, 7.2, 5.5, 14);
  const aisle = clamp(options.aisleWidth, 7.5, 4, Math.min(12, width - 8));
  const bay = clamp(options.bayLength, 4, 2.5, 8);
  const root = new THREE.Group(); root.name = 'VA_GrandHall_Architecture_OptIn';
  const mats = {
    stone: new THREE.MeshStandardMaterial({color:0x80716c,metalness:0.12,roughness:0.27}),
    darkStone: new THREE.MeshStandardMaterial({color:0x29242b,metalness:0.12,roughness:0.45}),
    brass: new THREE.MeshStandardMaterial({color:0xa47a42,metalness:0.72,roughness:0.28}),
    ceiling: new THREE.MeshStandardMaterial({color:0x413540,roughness:0.76}),
    recess: new THREE.MeshStandardMaterial({color:0x201b27,roughness:0.82}),
    cove: new THREE.MeshStandardMaterial({color:0xf6c58a,emissive:0xff9d46,emissiveIntensity:1.2,roughness:0.42})
  };
  const box = (name,w,h,d,x,y,z,mat) => {
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.name=name; m.position.set(x,y,z); root.add(m); return m;
  };
  // Center aisle only. Gaming banks fit in the two flanking zones.
  box('promenade-stone',aisle,0.045,length,0,0,0,mats.stone);
  for(const side of [-1,1]) {
    box('promenade-brass-edge',0.055,0.012,length,side*(aisle/2-0.18),0.029,0,mats.brass);
    // Wall modules, with warm wainscot and narrow metallic pilasters.
    const x=side*(width/2-0.12);
    box('wall-plaster',0.24,height,length,x,height/2,0,mats.ceiling);
    box('wall-dark-wainscot',0.29,1.25,length,x,0.625,0,mats.darkStone);
    box('wall-chair-rail',0.34,0.085,length,x,1.28,0,mats.brass);
    box('wall-crown',0.38,0.15,length,x,height-0.3,0,mats.brass);
  }
  box('ceiling-base',width,0.18,length,0,height,0,mats.ceiling);
  const bays=Math.ceil(length/bay), step=length/bays;
  for(let i=0;i<bays;i++){
    const z=-length/2+(i+0.5)*step;
    // Recessed panels and exposed beams, no fake extra point lights.
    box('coffer-inset',width-1.2,0.015,step-0.35,0,height-0.106,z,mats.recess);
    box('coffer-cross-beam',width,0.19,0.23,0,height-0.22,z-step/2,mats.brass);
    for(const side of [-1,1]) {
      box('coffer-side-beam',0.22,0.2,step,side*(width/2-0.46),height-0.22,z,mats.brass);
      box('warm-cove-strip',0.06,0.022,step-0.42,side*(width/2-0.8),height-0.24,z,mats.cove);
    }
  }
  // Column rhythm stays outside the clear aisle.
  const shaftGeo=new THREE.CylinderGeometry(0.25,0.32,height-0.6,12);
  const capGeo=new THREE.CylinderGeometry(0.43,0.33,0.28,12);
  for(let z=-length/2+step;z<length/2-step/2;z+=step*2) {
    for(const side of [-1,1]){
      const x=side*(aisle/2+1.15);
      const shaft=new THREE.Mesh(shaftGeo,mats.stone);
      shaft.name='colonnade-shaft'; shaft.position.set(x,(height-0.6)/2,z);root.add(shaft);
      const cap=new THREE.Mesh(capGeo,mats.brass);
      cap.name='colonnade-capital';cap.position.set(x,height-0.44,z);root.add(cap);
      box('colonnade-plinth',0.9,0.2,0.9,x,0.1,z,mats.darkStone);
    }
  }
  const ringGeo=new THREE.TorusGeometry(0.95,0.045,8,40);
  for(const z of [-length/4,length/4]) {
    for(let j=0;j<3;j++) {
      const ring=new THREE.Mesh(ringGeo,j===1?mats.cove:mats.brass);
      ring.name='suspended-ring-chandelier';ring.position.set(0,height-1.2-j*0.18,z);
      ring.rotation.x=Math.PI/2+(j-1)*0.15;ring.scale.setScalar(1-j*0.15);root.add(ring);
    }
    box('chandelier-suspension',0.035,0.75,0.035,0,height-0.46,z,mats.brass);
  }
  root.userData = {
    prototypeOnly:true, units:'meters', width,length,height,aisleWidth:aisle,
    clearAisle:{minX:-aisle/2+0.3,maxX:aisle/2-0.3,minZ:-length/2,maxZ:length/2},
    leftGamingZone:{minX:-width/2+0.5,maxX:-aisle/2-1.7},
    rightGamingZone:{minX:aisle/2+1.7,maxX:width/2-0.5},
    notes:'Art only. Host controls collision, entrance openings, LOD, cameras and lighting. Walls are continuous: cut an entrance bay before integration.'
  };
  return root;
}
export const createGrandConcourse = (THREE, options={}) => createGrandHallArchitecture(THREE,options);
