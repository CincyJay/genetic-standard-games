/**
 * Velvet Ace | original lightweight adult guest silhouette.
 * Prototype replacement for the capsule placeholder, not a finished photoreal avatar.
 * Geometry-only, no remote assets or character identity. Y-up, facing +Z.
 * Keep all animation and collisions in engineering; this is a visual skin only.
 */
export function makeVelvetGuestAvatar(T,{jacket=0x292f48,trousers=0x171b27,skin=0xb98768,hair=0x211a19}={}){
 const g=new T.Group();g.name='VA_GuestAvatar_ArtOnly';
 const fabric=new T.MeshStandardMaterial({color:jacket,roughness:.91});
 const pants=new T.MeshStandardMaterial({color:trousers,roughness:.93});
 const face=new T.MeshStandardMaterial({color:skin,roughness:.94});
 const hairMat=new T.MeshStandardMaterial({color:hair,roughness:.96});
 const shoeMat=new T.MeshStandardMaterial({color:0x121216,roughness:.43});
 const shirt=new T.MeshStandardMaterial({color:0xe3d6c7,roughness:.95});
 const metal=new T.MeshStandardMaterial({color:0xb9a28c,metalness:.72,roughness:.28});
 function ell(name,x,y,z,sx,sy,sz,mat){
  const o=new T.Mesh(new T.SphereGeometry(1,12,10),mat);
  o.name=name;o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;g.add(o);return o;
 }
 function link(name,a,b,r,mat){
  const v=new T.Vector3(...a),w=new T.Vector3(...b),d=w.clone().sub(v);
  const o=new T.Mesh(new T.CylinderGeometry(r*.82,r,d.length(),9),mat);
  o.position.copy(v.add(w).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());
  o.name=name;o.castShadow=true;g.add(o);return o;
 }
 // Realistic relative adult proportions; articulation pivots are intentionally explicit.
 ell('hips',0,.94,0,.19,.14,.125,pants);
 ell('torso_jacket',0,1.31,0,.235,.34,.145,fabric);
 ell('shirt_front',0,1.37,.136,.105,.23,.018,shirt);
 ell('neck',0,1.65,.01,.065,.095,.065,face);
 ell('head',0,1.79,.01,.112,.145,.108,face);
 ell('hair_cap',0,1.89,-.024,.115,.065,.105,hairMat);
 for(const sign of [-1,1]){
  ell('ear',sign*.112,1.79,.008,.022,.039,.018,face);
  ell('shoulder',sign*.232,1.53,0,.09,.10,.10,fabric);
  link('upper_arm',[sign*.25,1.50,0],[sign*.285,1.22,.015],.068,fabric);
  ell('elbow',sign*.285,1.22,.015,.062,.06,.065,fabric);
  link('forearm',[sign*.285,1.20,.015],[sign*.26,1.02,.10],.053,fabric);
  ell('hand',sign*.26,1.00,.105,.048,.085,.042,face);
  link('thigh',[sign*.105,.89,0],[sign*.11,.52,.025],.092,pants);
  ell('knee',sign*.11,.52,.025,.09,.09,.085,pants);
  link('calf',[sign*.11,.49,.025],[sign*.11,.13,.015],.069,pants);
  ell('shoe',sign*.11,.075,.09,.102,.069,.17,shoeMat);
 }
 // Minimal jacket lapels read clearly in follow camera at 1-3 m.
 for(const sign of [-1,1]){
  const lapel=new T.Mesh(new T.BoxGeometry(.075,.23,.014),shirt);
  lapel.position.set(sign*.095,1.48,.16);lapel.rotation.z=sign*.35;
  lapel.name='shirt_lapel';g.add(lapel);
 }
 ell('jacket_button',0,1.27,.16,.013,.013,.01,metal);
 g.userData={artOnly:true,visualHeight:1.95,forward:'+Z',up:'Y',
  collisionRadiusSuggested:.30,animationContract:'root movement owned by engineering',
  warning:'Static first-pass adult avatar; no rig, facial animation, or clothing variants yet'};
 return g;
}
