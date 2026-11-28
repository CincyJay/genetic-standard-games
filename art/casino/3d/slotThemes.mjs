/** Velvet Ace: 10 original 3D physical slot machine sculptures.
 * Geometry owns the cabinet. Game logic, reels and payouts remain in existing Phaser code.
 * All 25 REEL_col_row_SWAP_TEXTURE planes can receive individual canvas textures.
 * Free original artwork; intentionally no dependencies beyond provided Three.js.
 */
export const SLOT_THEMES = Object.freeze({
 sevens:{body:0x5c1730,metal:0xe5b65f,glass:0x2a1638,light:0xf7cb77,crest:'jewels'},
 lanterns:{body:0x8b1e2e,metal:0xe4b458,glass:0x601828,light:0xfca767,crest:'lanterns'},
 pharaoh:{body:0x183b77,metal:0xe4bd62,glass:0x403323,light:0xf8d785,crest:'pillars'},
 ocean:{body:0x0a5b75,metal:0xc7dbe7,glass:0x163d52,light:0x99f4fb,crest:'pearls'},
 goldrush:{body:0x623b26,metal:0xd7a758,glass:0x3d291a,light:0xffcb75,crest:'nuggets'},
 dragon:{body:0x821723,metal:0xeab35d,glass:0x431822,light:0xff7048,crest:'horns'},
 empire:{body:0x676575,metal:0xf0d3a5,glass:0x2b224d,light:0xe1c4ff,crest:'pillars'},
 thunder:{body:0x234979,metal:0xbfcfe8,glass:0x152849,light:0x77caff,crest:'bolt'},
 tiger:{body:0x8b4c1c,metal:0xf0b85c,glass:0x234c30,light:0xffc06c,crest:'horns'},
 cosmic:{body:0x48266d,metal:0xdcb7e9,glass:0x281a53,light:0xfc91de,crest:'saturn'},
});
export function makeVelvetThemedSlot(THREE,id='sevens') {
 const t=SLOT_THEMES[id]||SLOT_THEMES.sevens,g=new THREE.Group();
 g.name='VelvetSlot_'+id;
 const material=(color,metalness,roughness)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const body=material(t.body,.36,.27),metal=material(t.metal,.88,.24),glass=material(t.glass,.1,.28),
 light=material(t.light,.12,.25),black=material(0x0d0d14,.15,.4);
 const box=(name,x,y,z,w,h,d,mat)=>{
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;
 };
 // Rounded and bevelled real 3D faces, rather than a stack of axis-aligned boxes.
 const rounded=(name,x,y,z,w,h,d,rad,mat)=>{
   const r=Math.min(rad,w*.45,h*.45),hw=w/2,hh=h/2;
   const s=new THREE.Shape();
   s.moveTo(-hw+r,-hh);
   s.lineTo(hw-r,-hh);s.quadraticCurveTo(hw,-hh,hw,-hh+r);
   s.lineTo(hw,hh-r);s.quadraticCurveTo(hw,hh,hw-r,hh);
   s.lineTo(-hw+r,hh);s.quadraticCurveTo(-hw,hh,-hw,hh-r);
   s.lineTo(-hw,-hh+r);s.quadraticCurveTo(-hw,-hh,-hw+r,-hh);
   const geo=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,curveSegments:5,steps:1});
   const o=new THREE.Mesh(geo,mat);
   o.name=name;o.position.set(x,y,z-d/2);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;
 };
 const orb=(name,x,y,z,r,mat)=>{
  const o=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),mat);
  o.name=name;o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;
 };
 const ring=(name,x,y,z,r,mat)=>{
  const o=new THREE.Mesh(new THREE.TorusGeometry(r,.027,8,32),mat);
  o.name=name;o.position.set(x,y,z);g.add(o);return o;
 };
 box('plinth',0,.1,0,1.18,.2,.78,black);
 box('gold_plinth_rail',0,.2,.03,1.22,.06,.8,metal);
 rounded('main_cabinet_housing',0,1.2,0,1.14,1.98,.74,.17,body);
 rounded('lacquered_side_face',0,1.2,.373,1.045,1.91,.045,.15,glass);
 rounded('rear_canopy',0,2.17,-.17,1.16,.24,.56,.08,body);
 for(const x of [-.53,.53]){
  rounded('side_pillar',x,1.22,.04,.075,1.94,.72,.03,metal);
  box('side_chrome_edge',x*1.06,1.23,.414,.02,1.87,.03,metal);
  for(let i=0;i<12;i++)orb('cabinet_light_'+i,x,.36+1.70*i/11,.446,.025,light);
 }
 rounded('marquee_metal_frame',0,2,.404,1.11,.4,.06,.085,metal);
 rounded('marquee_world_texture_target',0,2,.444,1.01,.32,.014,.045,glass);
 if(t.crest==='horns')for(const x of [-.35,.35])orb('crest_horn',x,2.27,.34,.10,metal);
 if(t.crest==='pillars')for(const x of [-.36,.36])box('crest_pilaster',x,2.25,.35,.09,.25,.09,metal);
 if(t.crest==='pearls')for(const x of [-.36,0,.36])orb('crest_pearl',x,2.26,.36,.084,light);
 if(t.crest==='jewels'||t.crest==='nuggets')for(const x of [-.36,0,.36])orb('crest_jewel',x,2.26,.35,.089,light);
 if(t.crest==='lanterns')for(const x of [-.30,.30])orb('crest_lantern',x,2.26,.36,.10,light);
 if(t.crest==='saturn')ring('crest_ring',0,2.28,.35,.25,metal);
 if(t.crest==='bolt')box('crest_bolt',0,2.27,.35,.35,.15,.08,light);
 rounded('screen_black_back',0,1.18,.410,1.045,1.05,.034,.085,black);
 rounded('reel_bezel_top',0,1.73,.45,1.10,.06,.045,.024,metal);
 rounded('reel_bezel_bottom',0,.62,.45,1.10,.06,.045,.024,metal);
 box('reel_bezel_left',-.545,1.18,.451,.056,1.15,.043,metal);
 box('reel_bezel_right',.545,1.18,.451,.056,1.15,.043,metal);
 const reelTargets=[];
 for(let col=0;col<5;col++)for(let row=0;row<5;row++){
  const x=-.407+col*.203,y=1.584-row*.201;
  const cell=box('REEL_'+col+'_'+row+'_SWAP_TEXTURE',x,y,.476,.193,.189,.009,black);
  reelTargets.push(cell);
 }
 rounded('player_control_shelf',0,.465,.455,1.04,.265,.245,.065,black);
 box('console_gold_stripe',0,.595,.49,1,.016,.22,metal);
 for(const x of [-.35,-.16,.03,.22])orb('console_switch',x,.624,.5,.042,metal);
 orb('spin_button',.417,.65,.53,.08,light);
 rounded('coin_tray',0,.25,.46,.76,.09,.21,.038,black);
 box('coin_tray_gold',0,.31,.48,.8,.020,.23,metal);
 // Stepped side trims and curved fascia give the hardware a dimensional arcade-machine silhouette.
 for(const z of [-.22,.22]){
   for(const x of [-.565,.565])rounded('cabinet_side_chrome',x,1.23,z,.037,1.82,.075,.016,metal);
 }
 rounded('screen_top_visor',0,1.795,.474,1.12,.08,.12,.04,body);
 rounded('screen_lower_chin',0,.555,.476,1.12,.09,.13,.04,body);
 // Little feet keep the glossy cabinet from floating over the showroom floor.
 for(const x of [-.39,.39]){
   rounded('machine_foot',x,.065,-.12,.19,.13,.45,.045,black);
 }
 g.userData={theme:id,units:'m',front:'+Z',reelTargets:reelTargets.map(x=>x.name),reelColumns:5,reelRows:5};
 return g;
}
