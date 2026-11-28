// Velvet Ace original opt-in grand hall end-wall and entrance-frame art.
// Host provides THREE to avoid mixed-version meshes. No collision or scene mutation.
export function createGrandHallEndcaps(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.MeshStandardMaterial) throw new Error('Pass host THREE');
  const bounded = (v, fallback, lo, hi) => Number.isFinite(v) ? Math.min(hi,Math.max(lo,v)) : fallback;
  const width=bounded(options.width,24,16,80);
  const length=bounded(options.length,36,20,120);
  const height=bounded(options.height,7.2,5.5,14);
  const opening=bounded(options.entranceWidth,6,3,Math.min(12,width-4));
  const rearZ=options.rearZ==='negative'?-length/2:length/2;
  const entranceZ=-rearZ;
  const root=new THREE.Group();root.name='VA_GrandHall_Endcaps_OptIn';
  const mats={
    plaster:new THREE.MeshStandardMaterial({color:0x352c37,roughness:0.78}),
    panel:new THREE.MeshStandardMaterial({color:0x201b25,roughness:0.55}),
    stone:new THREE.MeshStandardMaterial({color:0x82716a,roughness:0.35}),
    brass:new THREE.MeshStandardMaterial({color:0xb38a50,metalness:0.8,roughness:0.23}),
    light:new THREE.MeshStandardMaterial({color:0xffdfab,emissive:0xffb35a,emissiveIntensity:1.25})
  };
  const box=(name,w,h,d,x,y,z,mat)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.name=name;mesh.position.set(x,y,z);root.add(mesh);return mesh;
  };
  // Far wall: pilasters, panel rhythm, dado and upper brass fascia.
  box('wall-rear-plaster',width,height,0.24,0,height/2,rearZ,mats.plaster);
  box('wall-rear-dado',width,1.35,0.29,0,0.675,rearZ-0.02*Math.sign(rearZ),mats.panel);
  box('wall-rear-chair-rail',width,0.08,0.32,0,1.39,rearZ-0.025*Math.sign(rearZ),mats.brass);
  box('wall-rear-crown',width,0.16,0.34,0,height-0.28,rearZ-0.025*Math.sign(rearZ),mats.brass);
  for(let x=-width/2+2;x<width/2-0.5;x+=3.2){
    box('wall-rear-pilaster',0.18,height-0.65,0.37,x,(height-0.65)/2,rearZ-0.09*Math.sign(rearZ),mats.stone);
    box('wall-rear-pilaster-cap',0.43,0.15,0.43,x,height-0.42,rearZ-0.09*Math.sign(rearZ),mats.brass);
  }
  // Entrance is genuinely open through the center; two piers and a high lintel.
  const wing=(width-opening)/2;
  for(const sign of [-1,1]){
    box('wall-entrance-wing',wing,height,0.26,sign*(opening+wing)/2,height/2,entranceZ,mats.plaster);
    box('wall-entrance-dado',wing,1.35,0.31,sign*(opening+wing)/2,0.675,entranceZ,mats.panel);
    box('entrance-stone-pier',0.5,height-0.55,0.6,sign*(opening/2+0.25),(height-0.55)/2,entranceZ,mats.stone);
    box('entrance-brass-jamb',0.07,height-1.0,0.65,sign*(opening/2-0.035),(height-1)/2,entranceZ,mats.brass);
    box('entrance-warm-edge',0.045,height-1.2,0.67,sign*(opening/2-0.12),(height-1.2)/2,entranceZ,mats.light);
  }
  box('entrance-lintel',opening,0.7,0.65,0,height-0.35,entranceZ,mats.stone);
  box('entrance-lintel-brass',opening+0.5,0.095,0.72,0,height-0.78,entranceZ,mats.brass);
  box('entrance-lintel-warm-inlay',opening-0.4,0.055,0.73,0,height-0.86,entranceZ,mats.light);
  root.userData={
    prototypeOnly:true,units:'meters',width,length,height,entranceWidth:opening,
    rearZ,entranceZ,
    entranceOpening:{minX:-opening/2,maxX:opening/2,minY:0,maxY:height-0.7},
    integration:'Remove host rear_wall placeholder; entrance opening remains collision-free. Host owns colliders and lighting.',
    dispose(){root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});Object.values(mats).forEach(m=>m.dispose());}
  };
  return root;
}
