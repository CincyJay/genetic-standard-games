/**
 * Velvet Ace contemporary casino interior art pilot.
 * Inspired by user's reference photos: patterned casino carpet, mixed-height luminous
 * ceiling coffers, sculptural warm-red chandelier clusters. Original code/texture.
 * Preview only: do not silently replace the current walkable floor until owner approves.
 */
const mat=(T,color,metalness=0,roughness=.7)=>new T.MeshStandardMaterial({color,metalness,roughness});
function block(T,g,name,x,y,z,w,h,d,m){
 const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);
 o.position.set(x,y,z);o.name=name;o.castShadow=true;o.receiveShadow=true;g.add(o);return o;
}
function glass(T,g,name,x,y,z,r,m){
 const o=new T.Mesh(new T.SphereGeometry(r,12,10),m);
 o.position.set(x,y,z);o.name=name;g.add(o);return o;
}
function makeCarpetTexture(T){
 if(typeof document==='undefined')return null;
 // One coherent, dense, high-contrast geometric casino textile tile. No copyrighted pattern.
 const c=document.createElement('canvas');c.width=1024;c.height=1024;
 const x=c.getContext('2d',{alpha:false});if(!x)return null;
 let seed=0xACED123;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 x.fillStyle='#302a36';x.fillRect(0,0,1024,1024);
 // Repeated terracotta/tan woven squares, dark burgundy corridors and brass inflections.
 for(let row=0;row<16;row++)for(let col=0;col<16;col++){
  const px=col*64,py=row*64,v=(row*17+col*31)%5;
  x.fillStyle=['#8b4e36','#a47854','#573944','#b28c5e','#695565'][v];
  x.fillRect(px+2,py+2,60,60);
  x.strokeStyle='#282333';x.lineWidth=6;x.strokeRect(px+5,py+5,54,54);
  x.strokeStyle='#dbab64';x.lineWidth=3;x.strokeRect(px+13,py+13,38,38);
  x.strokeStyle='#392939';x.lineWidth=6;x.beginPath();
  x.moveTo(px+8,py+8);x.lineTo(px+56,py+56);x.stroke();
  if((row+col)%3===0){
    x.strokeStyle='#db9d74';x.lineWidth=3;x.beginPath();
    x.moveTo(px+8,py+55);x.lineTo(px+55,py+8);x.stroke();
  }
  for(let k=0;k<14;k++){
    x.fillStyle=rnd()>.5?'rgba(247,184,109,.13)':'rgba(12,10,16,.16)';
    x.fillRect(px+rnd()*64,py+rnd()*64,1.5,1.5);
  }
 }
 // Woven fibers, fine enough to read as textile rather than a plastic decal.
 for(let i=0;i<4600;i++){
  const px=rnd()*1024,py=rnd()*1024;
  x.fillStyle=rnd()>.5?'rgba(241,207,156,.12)':'rgba(10,12,25,.18)';
  x.fillRect(px,py,.7+rnd()*2,.4);
 }
 const t=new T.CanvasTexture(c);
 t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(4.2,3.9);
 t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;t.needsUpdate=true;
 return t;
}
export function makeVelvetPatternedCarpet(T){
 const root=new T.Group();root.name='VA_ContemporaryCasinoCarpet';
 const texture=makeCarpetTexture(T);
 const material=new T.MeshStandardMaterial({color:0xffffff,map:texture,roughness:.96,metalness:0});
 // Main carpet is intentionally inside original walls; does not alter collisions.
 const carpet=new T.Mesh(new T.PlaneGeometry(17.2,14.7),material);
 carpet.rotation.x=-Math.PI/2;carpet.position.set(0,.024,-.12);
 carpet.name='gaming_floor_patterned_woven_carpet';
 carpet.receiveShadow=true;root.add(carpet);
 // Keep a navigable 2.7 m central aisle in contrasting deep wine.
 const wine=mat(T,0x4b2033,.03,.94),gold=mat(T,0xb99a68,.55,.43);
 block(T,root,'gaming_aisle_wine_textile',0,.031,-.8,2.7,.012,12.1,wine);
 for(const x of [-1.40,1.40])
  block(T,root,'gaming_aisle_brass_edge',x,.040,-.8,.032,.008,12.1,gold);
 root.userData={artist:'ChatGPT',purpose:'user-approval floor prototype',textures:texture?[texture]:[]};
 return root;
}
export function makeVelvetLuminousCeiling(T){
 const g=new T.Group();g.name='VA_ContemporaryCasinoCeiling';
 const dark=mat(T,0x15151c,.22,.5),bronze=mat(T,0x8c6243,.73,.26);
 const ivory=mat(T,0xeee8d8,.05,.57),red=mat(T,0xaf2a1e,.25,.25);
 const whiteGlow=new T.MeshBasicMaterial({color:0xffeaca,toneMapped:false});
 const redGlow=new T.MeshBasicMaterial({color:0xff5941,toneMapped:false});
 const glassMat=new T.MeshStandardMaterial({color:0xf8cfa6,metalness:.28,roughness:.10,transparent:true,opacity:.72});
 // Name every overhead object chandelier_* to preserve existing cutaway compatibility.
 block(T,g,'chandelier_dark_coffer_field',0,5.45,0,17.2,.12,15.5,dark);
 for(let x=-8;x<=8;x+=1.6)
  block(T,g,'chandelier_grid_rib_vertical',x,5.36,0,.075,.08,15.5,bronze);
 for(let z=-7.2;z<=7.2;z+=1.55)
  block(T,g,'chandelier_grid_rib_horizontal',0,5.35,z,17.2,.08,.075,bronze);
 // Large warm lit feature bays, all modeled as actual ceiling volume.
 for(const x of [-4.8,4.8])for(const z of [-4.4,1.0]){
  block(T,g,'chandelier_illuminated_panel_frame',x,5.27,z,3.45,.12,2.45,bronze);
  block(T,g,'chandelier_illuminated_panel_glow',x,5.18,z,3.19,.035,2.19,whiteGlow);
  for(let i=-1;i<=1;i++)
   block(T,g,'chandelier_panel_crossmember',x+i*1.0,5.14,z,.065,.06,2.19,dark);
 }
 // Contemporary glowing red ceiling sculptures with suspended glass globes.
 for(const z of [-2.2,3.55]){
  for(let i=0;i<3;i++){
   const x=(i-1)*1.05;
   block(T,g,'chandelier_red_canopy',x,5.11,z,.87,.48,1.8,red);
   block(T,g,'chandelier_red_light_face',x,4.85,z,.78,.029,1.66,redGlow);
   for(let j=0;j<4;j++){
    const px=x+(j-1.5)*.17,pz=z+((i+j)%2?-.48:.48);
    block(T,g,'chandelier_pendant_wire',px,4.64,pz,.014,.49,.014,bronze);
    glass(T,g,'chandelier_glass_globe',px,4.36,pz,.13,glassMat);
    glass(T,g,'chandelier_warm_bulb',px,4.36,pz,.047,whiteGlow);
   }
  }
 }
 // Practical lights and ceiling look are separate; integration can use a few low-cost points.
 g.userData={artOnly:true,up:'Y',units:'m',overheadCutaway:true,
  note:'Do not hide entire ceiling in third-person; overview needs selective roof cutaway.'};
 return g;
}
/**
 * A low-cost exterior apron and ambient backdrop for overhead camera framing.
 * Intentionally outside the casino's 18x16m walkable footprint: scenery only.
 * Do not add this geometry to collision/navmesh or infer accessible exterior areas.
 */
export function makeVelvetExteriorBackdrop(T){
 const root=new T.Group();root.name='VA_ExteriorBackdrop_ArtOnly';
 // Reuse exact interior palette values to permit value-keyed material batching.
 // No separate concrete material: tile joints use the existing dark floor material.
 const stone=mat(T,0x302c37,.22,.28);
 const edge=mat(T,0xd4aa64,.85,.23);
 const asphalt=mat(T,0x302c37,.22,.28);
 block(T,root,'exterior_ground_field',0,-.27,0,56,.18,52,asphalt);
 block(T,root,'entrance_forecourt_stone',0,-.145,10.75,11.2,.09,5.25,stone);
 for(const x of [-5.35,5.35])
   block(T,root,'forecourt_edge_inlay',x,-.092,10.75,.06,.014,5.25,edge);
 for(let z=8.4;z<13.2;z+=.85)
   block(T,root,'forecourt_tile_joint',0,-.090,z,10.6,.006,.017,asphalt);
 // Thresholds beyond the vestibule floor's far edge (z=9.26), visible in overview.
 for(const x of [-4.0,0,4.0])
   block(T,root,'forecourt_entrance_brass_threshold',x,-.086,9.42,2.75,.014,.07,edge);
 // Opaque outer field stops the overview from seeing pure black beyond the entrance.
 // No modeled road, street, vehicles or offsite interactive locations.
 root.userData={artOnly:true,collision:false,exterior:'visual backdrop only'};
 return root;
}

/** An intentionally opt-in demonstration layer for Claude's existing graybox scene. */
export function makeVelvetContemporaryInterior(T){
 const g=new T.Group();g.name='VA_ContemporaryDesign_Pilot';
 g.add(makeVelvetPatternedCarpet(T),makeVelvetLuminousCeiling(T));
 return g;
}
