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
 for(const x of [-5.2,5.2])for(const z of [-3.8,1.1]){
   box(T,g,m.burgundy,[x,.55,z],[2.1,.38,.9],'velvet_bench');
   box(T,g,m.brass,[x,.27,z],[2.2,.12,1.0],'bench_base');
 }
 return g;
}
export function makeVelvetBlackjackTable(T) {
 const m=velvetMaterials(T),g=new T.Group();g.name='VelvetBlackjackTable';
 box(T,g,m.black,[0,.49,0],[.56,.98,.6],'table_pedestal');
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
 box(T,g,m.burgundy,[0,.56,0],[.63,.18,.60],'tufted_seat');
 box(T,g,m.brass,[0,.49,0],[.65,.035,.62],'seat_gilding');
 box(T,g,m.brass,[0,1.12,.29],[.69,.86,.10],'back_frame');
 box(T,g,m.burgundy,[0,1.13,.36],[.60,.76,.05],'back_upholstery');
 return g;
}
