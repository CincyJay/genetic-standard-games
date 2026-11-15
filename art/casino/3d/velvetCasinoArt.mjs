/**
 * Velvet Ace: ORIGINAL, locally built 3D environment art (v1).
 * No asset subscriptions, hosted avatar services or third-party models.
 * Pass the app's THREE namespace into these factories.
 * Coordinate contract: meters, Y up, +Z is the front of a cabinet.
 * Art geometry only: caller owns seating, navmesh, physics and game logic.
 */
export function velvetMaterials(T) {
 const m=(color,metalness=0,roughness=.6)=>new T.MeshStandardMaterial({color,metalness,roughness});
 return {
  brass:m('#d4aa64',.85,.23), lightGold:m('#f5dca2',.7,.18),
  black:m('#100e18',.15,.32), marble:m('#302c37',.22,.28),
  burgundy:m('#54142b',.03,.88), darkWood:m('#2c1722',.2,.44),
  ivory:m('#e0d7c0',.05,.58), felt:m('#155d4f',0,.9),
  glass:m('#385d7e',.25,.21), purple:m('#392054',.1,.45),
  amber:new T.MeshStandardMaterial({color:'#edab69',metalness:.1,roughness:.3,emissive:'#b15d19',emissiveIntensity:.35})
 };
}
const box=(T,g,mat,at,sz,tag)=>{
 const o=new T.Mesh(new T.BoxGeometry(...sz),mat);
 o.position.set(...at);o.name=tag;o.castShadow=true;o.receiveShadow=true;g.add(o);return o;
};
const cylinder=(T,g,mat,at,r,h,tag,seg=20)=>{
 const o=new T.Mesh(new T.CylinderGeometry(r,r,h,seg),mat);
 o.position.set(...at);o.name=tag;o.castShadow=true;o.receiveShadow=true;g.add(o);return o;
};
export function makeVelvetCasinoRoom(T) {
 const m=velvetMaterials(T), g=new T.Group();g.name='VelvetAce_LobbyArt';
 box(T,g,m.marble,[0,-.12,0],[18,.25,16],'floor_base');
 box(T,g,m.burgundy,[0,.035,-1.4],[3.1,.026,12.5],'red_carpet');
 for(const x of [-1.58,1.58])box(T,g,m.brass,[x,.053,-1.4],[.032,.01,12.5],'carpet_gold_edge');
 for(let x=-8;x<=8;x+=2)box(T,g,m.brass,[x,.013,0],[.013,.008,15.8],'floor_inlay');
 for(let z=-7;z<=7;z+=2)box(T,g,m.brass,[0,.014,z],[17.8,.009,.013],'floor_inlay');
 for(const x of [-8.8,8.8])box(T,g,m.darkWood,[x,2.7,0],[.38,5.4,15.9],'wall');
 box(T,g,m.darkWood,[0,2.7,-7.8],[17.8,5.4,.36],'rear_wall');
 for(const x of [-7.5,-5,-2.5,0,2.5,5,7.5]){
   box(T,g,m.marble,[x,2.8,-7.55],[2.04,4.5,.05],'wall_panel');
   box(T,g,m.brass,[x,4.98,-7.49],[2.16,.06,.09],'art_deco_panel_cap');
 }
 for(const x of [-7.5,7.5])for(const z of [-6.4,-2.6,1.2,5]){
   cylinder(T,g,m.ivory,[x,2.32,z],.30,4.6,'marble_column');
   // Eight subtle flutes give each column a classical profile at follow-camera distance.
   for(let i=0;i<8;i++){
     const a=i*Math.PI/4;
     cylinder(T,g,m.lightGold,[x+.298*Math.cos(a),2.31,z+.298*Math.sin(a)],.018,4.4,'column_flute',8);
   }
   for(const y of [.26,4.54])cylinder(T,g,m.brass,[x,y,z],.43,.16,'capital');
 }
 for(const z of [-4,2.6]){
   cylinder(T,g,m.brass,[0,5.0,z],.23,.18,'chandelier_hub');
   for(const [radius,height,count] of [[1.12,4.77,16],[.76,4.42,12],[.42,4.12,8]]){
     const ring=new T.Mesh(new T.TorusGeometry(radius,.045,8,32),m.lightGold);
     ring.rotation.x=Math.PI/2;ring.position.set(0,height,z);ring.name='chandelier_ring';g.add(ring);
     for(let i=0;i<count;i++){
       const a=i*Math.PI*2/count;
       const crystal=new T.Mesh(new T.IcosahedronGeometry(.065,0),m.ivory);
       crystal.position.set(Math.cos(a)*radius,height-.14,z+Math.sin(a)*radius);
       crystal.name='chandelier_crystal';g.add(crystal);
     }
   }
 }
 // Lounge benches are clustered near the entrance, well away from the four blocked slot fronts.
 // Keep four benches so the existing collision/visibility budget remains representative.
 for(const x of [-5.15,-2.75,2.75,5.15]){
   const z=6.35;
   box(T,g,m.burgundy,[x,.55,z],[1.70,.34,.78],'velvet_bench');
   box(T,g,m.brass,[x,.29,z],[1.78,.10,.84],'bench_base');
   box(T,g,m.burgundy,[x,.91,z+.31],[1.62,.64,.14],'bench_back_cushion');
 }
 // Decorative overhead architecture is named chandelier_* to follow the prototype cutaway convention:
 // engineering hides these along with light fixtures in the Sims-style overview.
 box(T,g,m.darkWood,[0,5.72,0],[17.5,.18,15.5],'chandelier_ceiling');
 box(T,g,m.brass,[0,5.61,0],[16.75,.028,14.8],'chandelier_coffer_frame');
 for(const x of [-6,-3,0,3,6]){
   box(T,g,m.ivory,[x,5.59,0],[.09,.035,13.8],'chandelier_coffer_rib');
 }
 for(const z of [-5,-2,1,4]){
   box(T,g,m.ivory,[0,5.58,z],[16,.035,.09],'chandelier_coffer_rib');
 }
 for(const z of [-4,2.6]){
   cylinder(T,g,m.brass,[0,5.43,z],.10,.62,'chandelier_support_rod');
   cylinder(T,g,m.brass,[0,5.65,z],.27,.07,'chandelier_canopy');
 }
 // Lobby front remains traversable through a broad center arch; the vestibule hides black void.
 for(const x of [-6.95,6.95]){
   box(T,g,m.darkWood,[x,2.55,7.65],[3.1,5.1,.28],'chandelier_entrance_wing');
   box(T,g,m.brass,[x>0?5.37:-5.37,2.58,7.47],[.11,4.98,.11],'chandelier_portal_edge');
 }
 box(T,g,m.darkWood,[0,4.94,7.65],[10.5,.45,.30],'chandelier_arch_lintel');
 box(T,g,m.brass,[0,4.70,7.46],[10.5,.065,.08],'chandelier_arch_trim');
 box(T,g,m.marble,[0,2.65,9.05],[10.8,5.15,.14],'chandelier_vestibule_backdrop');
 for(const x of [-4.65,4.65])box(T,g,m.brass,[x,2.55,9.0],[.09,4.85,.09],'chandelier_vestibule_trim');
 return g;
}
export function makeVelvetBlackjackTable(T) {
 const m=velvetMaterials(T),g=new T.Group();g.name='VelvetBlackjackTable';
 cylinder(T,g,m.darkWood,[0,.49,0],.36,.98,'turned_table_pedestal',24);
 cylinder(T,g,m.brass,[0,.13,0],.48,.10,'pedestal_base',24);
 cylinder(T,g,m.brass,[0,.94,0],.44,.09,'pedestal_cap',24);
 cylinder(T,g,m.darkWood,[0,1.03,0],1.55,.17,'mahogany_top',48);
 cylinder(T,g,m.brass,[0,1.13,0],1.57,.044,'gold_rim',48);
 cylinder(T,g,m.felt,[0,1.17,0],1.46,.024,'live_felt',48);
 for(let i=0;i<7;i++){
  const a=Math.PI*(.1+.8*i/6),x=Math.cos(a)*1.15,z=Math.sin(a)*1.15;
  cylinder(T,g,m.lightGold,[x,1.186,z],.105,.004,'betting_ring',20);
 }
 box(T,g,m.black,[.64,1.27,-.56],[.38,.14,.54],'dealer_card_shoe');
 for(let i=0;i<8;i++)box(T,g,m.black,[-.56+i*.16,1.25,-.52],[.12,.07,.19],'chip_rack');
 return g;
}
export function makeVelvetSlotCabinet(T) {
 const m=velvetMaterials(T),g=new T.Group();g.name='VelvetSlotMachine';
 box(T,g,m.black,[0,.11,0],[1.18,.22,.8],'physical_plinth');
 box(T,g,m.darkWood,[0,1.15,0],[1.16,1.95,.75],'steel_wood_cabinet');
 for(const x of [-.56,.56])box(T,g,m.brass,[x,1.18,.02],[.06,1.92,.75],'metal_rail');
 box(T,g,m.lightGold,[0,2.01,.398],[1.08,.39,.05],'marquee_frame');
 box(T,g,m.purple,[0,2.01,.433],[.98,.30,.01],'marquee_art_backplate');
 box(T,g,m.brass,[0,1.19,.396],[1.08,1.06,.06],'reel_screen_frame');
 box(T,g,m.black,[0,1.19,.432],[.99,.98,.012],'live_reel_window');
 // Separate screen surface is intentionally named for future canvas/video texture.
 for(let col=0;col<5;col++)for(let row=0;row<5;row++)
   box(T,g,m.glass,[-.388+col*.194,1.579-row*.194,.445],[.183,.183,.006],`reel_cell_${col}_${row}`);
 box(T,g,m.black,[0,.47,.45],[1.0,.25,.20],'control_console');
 for(let x of [-.36,-.16,.04,.22])cylinder(T,g,m.brass,[x,.60,.56],.052,.02,'metal_control',14);
 cylinder(T,g,m.amber,[.41,.60,.56],.086,.026,'spin_button',20);
 return g;
}
export function makeVelvetChair(T) {
 const m=velvetMaterials(T),g=new T.Group();g.name='VelvetCasinoChair';
 for(const x of [-.25,.25])for(const z of [-.22,.22])
   cylinder(T,g,m.brass,[x,.24,z],.035,.48,'brass_leg',12);
 // Sculpted upholstery instead of flat backed slabs.
 const shape=new T.Shape();
 shape.moveTo(-.33,.0);
 shape.quadraticCurveTo(-.42,.05,-.40,.22);
 shape.lineTo(-.36,.68);
 shape.quadraticCurveTo(-.28,.88,0,.90);
 shape.quadraticCurveTo(.28,.88,.36,.68);
 shape.lineTo(.40,.22);
 shape.quadraticCurveTo(.42,.05,.33,0);
 shape.closePath();
 const outer=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.095,bevelEnabled:true,bevelThickness:.027,bevelSize:.025,bevelSegments:2,curveSegments:8}),m.brass);
 outer.name='sculpted_chair_back_frame';outer.position.set(0,.74,.28);outer.castShadow=true;g.add(outer);
 const cushion=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.047,bevelEnabled:true,bevelThickness:.035,bevelSize:.030,bevelSegments:2,curveSegments:8}),m.burgundy);
 cushion.name='velvet_rounded_back_cushion';cushion.scale.set(.86,.90,1);cushion.position.set(0,.79,.39);cushion.castShadow=true;g.add(cushion);
 const seat=new T.Mesh(new T.SphereGeometry(1,16,10),m.burgundy);
 seat.name='velvet_sculpted_seat';seat.scale.set(.34,.105,.31);seat.position.set(0,.59,0);seat.castShadow=true;g.add(seat);
 box(T,g,m.brass,[0,.485,0],[.66,.035,.62],'seat_gilding');
 for(const px of [-.18,0,.18])for(const py of [1.05,1.31]){
  const stud=new T.Mesh(new T.SphereGeometry(.018,8,6),m.lightGold);
  stud.position.set(px,py,.482);stud.name='chair_tuft_button';g.add(stud);
 }
 return g;
}
