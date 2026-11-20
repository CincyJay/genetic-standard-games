/**
 * Velvet Ace modern padded swivel gaming chair.
 * Real 3D silhouette: wraparound back, cushioned upholstery, upholstered armrests,
 * chrome swivel pedestal and four radial legs. Art only, no seating mechanics.
 * Player seat anchor y~0.56 m; forward direction -Z toward the gaming table.
 */
export function makeVelvetLuxuryGamingChair(T,{upholstery=0xbca27b,frame=0x382b29}={}){
 const root=new T.Group();root.name='VA_LuxuryGamingChair_Study';
 const fabric=new T.MeshStandardMaterial({color:upholstery,roughness:.93,metalness:0});
 const trim=new T.MeshStandardMaterial({color:frame,roughness:.48,metalness:.14});
 const chrome=new T.MeshStandardMaterial({color:0xb0a7a2,roughness:.2,metalness:.9});
 const stitch=new T.MeshStandardMaterial({color:0xe1d3b8,roughness:.99,metalness:0});
 const dark=new T.MeshStandardMaterial({color:0x191c20,roughness:.52,metalness:.2});
 const push=(o,name)=>{o.name=name;o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 function tube(name,pts,r,m){
  const curve=new T.CatmullRomCurve3(pts.map(p=>new T.Vector3(...p)));
  return push(new T.Mesh(new T.TubeGeometry(curve,24,r,8),m),name);
 }
 function round(name,pos,scale,mat,segments=20){
  const o=new T.Mesh(new T.SphereGeometry(1,segments,12),mat);
  o.position.set(...pos);o.scale.set(...scale);return push(o,name);
 }
 function cylinder(name,pos,rTop,rBottom,h,mat,seg=18){
  const o=new T.Mesh(new T.CylinderGeometry(rTop,rBottom,h,seg),mat);
  o.position.set(...pos);return push(o,name);
 }
 // Realistic adjustable gas-lift stool, with a broad weighted star base.
 cylinder('swivel_gas_lift',[0,.29,0],.052,.063,.48,chrome);
 cylinder('swivel_base_hub',[0,.10,0],.14,.17,.13,dark);
 for(let i=0;i<5;i++){
  const a=2*Math.PI*i/5,x=Math.sin(a),z=Math.cos(a);
  tube('swivel_chrome_star_leg',[[0,.13,0],[x*.16,.09,z*.16],[x*.37,.08,z*.37]],.038,chrome);
  round('swivel_floor_glide',[x*.39,.068,z*.39],[.075,.035,.075],dark,12);
 }
 // Low sculpted bucket with visible piping and curved ergonomic cushion.
 round('seat_deep_upholstered_bucket',[0,.59,-.015],[.39,.133,.37],trim);
 round('seat_leather_cushion',[0,.64,-.04],[.353,.104,.326],fabric);
 for(const z of [-.32,.29])
  tube('seat_edge_piping',[[-.28,.63,z],[0,.65,z+(.02*Math.sign(z))],[.28,.63,z]],.010,stitch);
 // Rounded, upholstered back formed from multiple curved pads rather than a flat billboard.
 const arc=[];
 for(let i=0;i<=12;i++){
  const a=Math.PI*(1-i/12);
  arc.push([Math.cos(a)*.345,1.13,.19+Math.sin(a)*.07]);
 }
 tube('wraparound_back_structural_top',arc,.075,trim);
 for(let i=0;i<7;i++){
  const u=i/6,theta=Math.PI*(1-u);
  round('sculpted_back_leather_segment',[
   .307*Math.cos(theta),1.045,.255+Math.sin(theta)*.04
  ],[.118,.40,.10],fabric,14);
 }
 round('lumbar_support',[0,.945,.255],[.29,.22,.09],fabric,18);
 tube('top_cream_piping',arc.map(p=>[p[0],p[1]+.04,p[2]+.062]),.009,stitch);
 // Side armrests attach to the same shell, and are padded for real elbows.
 for(const sign of [-1,1]){
  const x=sign*.345;
  tube('curved_arm_support',[[x,.66,.10],[x,.76,.12],[x,.87,-.03],[x,.87,-.20]],.043,chrome);
  round('upholstered_armrest',[x,.87,-.145],[.075,.057,.25],fabric,14);
  round('side_back_bolster',[x*.89,.99,.242],[.1,.28,.10],trim,12);
 }
 root.userData={
  artOnly:true,units:'meters',up:'Y',forward:'-Z',seatHeight:.64,
  approximateFootprint:{width:.88,depth:.90},contactBaseRadius:.47,
  note:'Prototype chair. Engineering must preserve independent seat approach/collider.'
 };
 return root;
}
