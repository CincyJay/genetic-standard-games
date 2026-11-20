// Velvet Ace: opt-in grand concourse architectural kit. Original procedural Three.js art.
// Not wired into the production scene. Units are meters; floor at y=0.
import * as THREE from 'three';

export function createGrandConcourse({ length = 32, width = 8, ceilingHeight = 7.2 } = {}) {
  const root = new THREE.Group();
  root.name = 'VA_GrandConcourse_Prototype';
  const stone = new THREE.MeshStandardMaterial({ color: 0x76665f, roughness: 0.24, metalness: 0.12 });
  const inlay = new THREE.MeshStandardMaterial({ color: 0xb68a4c, metalness: 0.78, roughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x211b2a, roughness: 0.72 });
  const ceiling = new THREE.MeshStandardMaterial({ color: 0x3a3041, roughness: 0.64 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb852, emissiveIntensity: 1.4, roughness: 0.3 });
  const addBox = (name, w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.name=name; m.position.set(x,y,z); root.add(m); return m;
  };
  // Marble promenade with inset metal borders; keep carpets on either side in host scene.
  addBox('polished-stone-promenade',width,0.055,length,0,0.015,0,stone);
  for (const x of [-width/2+0.22,width/2-0.22]) addBox('brass-floor-inlay',0.045,0.006,length,x,0.047,0,inlay);
  // Recessed coffer ceiling, intentionally visible in look-up and long-axis cameras.
  addBox('continuous-ceiling-slab',width+5,0.22,length+2,0,ceilingHeight,0,ceiling);
  for (let z=-length/2+2;z<length/2;z+=4) {
    addBox('ceiling-crossbeam',width+5,0.23,0.24,0,ceilingHeight-0.24,z,inlay);
    addBox('coffer-dark-inset',width-0.8,0.015,3.15,0,ceilingHeight-0.125,z+1.9,dark);
    for(const x of [-width/2+0.5,width/2-0.5])
      addBox('coffer-warm-cove',0.07,0.04,3.15,x,ceilingHeight-0.31,z+1.9,lamp);
  }
  // Colonnade on both sides of the aisle, not in player navigation lane.
  const columnGeo = new THREE.CylinderGeometry(0.27,0.34,ceilingHeight-0.65,12);
  const capitalGeo = new THREE.CylinderGeometry(0.48,0.33,0.32,12);
  for(let z=-length/2+3;z<length/2;z+=6){
    for(const x of [-width/2-1.25,width/2+1.25]){
      const shaft = new THREE.Mesh(columnGeo,stone);
      shaft.position.set(x,(ceilingHeight-0.65)/2,z); shaft.name='stone-column';root.add(shaft);
      const cap = new THREE.Mesh(capitalGeo,inlay);
      cap.position.set(x,ceilingHeight-0.47,z);cap.name='brass-column-capital';root.add(cap);
      addBox('column-plinth',0.95,0.23,0.95,x,0.115,z,dark);
    }
  }
  // Suspended sculptural concentric rings. No dynamic lights: emissive art only.
  const ringGeo = new THREE.TorusGeometry(1.05,0.065,8,48);
  for (const z of [-length/4,length/4]) {
    for (let i=0;i<3;i++) {
      const ring=new THREE.Mesh(ringGeo,i===1?lamp:inlay);
      ring.name='sculptural-chandelier-ring';
      ring.rotation.x=Math.PI/2 + (i-1)*0.17;
      ring.position.set(0,ceilingHeight-1.35-i*0.22,z);
      ring.scale.setScalar(1-i*0.17);root.add(ring);
    }
    addBox('chandelier-stem',0.045,0.75,0.045,0,ceilingHeight-0.48,z,inlay);
  }
  root.userData = {
    prototypeOnly:true,
    floorY:0,
    aisleWidth:width,
    length,
    ceilingHeight,
    navigationKeepClear:{minX:-width/2+0.45,maxX:width/2-0.45,minZ:-length/2,maxZ:length/2},
    integration:'Place table banks and slot banks OUTSIDE aisle; host owns collision, navmesh, lights and LOD.',
    dispose(){root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});}
  };
  return root;
}
