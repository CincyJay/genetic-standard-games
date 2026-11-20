/** Velvet Ace blackjack furniture art pilot. Original, opt-in; no gameplay or collision.
 * THREE injected by caller; Y-up meters. Designed for shared-material batching.
 * Chip stacks use InstancedMesh, never one mesh per chip; integration may batch instances.
 */
export function makeVelvetBlackjackHero(T, options={}) {
 const root=new T.Group();root.name='VA_BlackjackHero_ArtOnly';
 // Exact velvetMaterials palette: same color, metalness and roughness for value batching.
 // Do not share material object ownership with the room: this group disposes its own instances.
 const material=(color,metalness=0,roughness=.6)=>new T.MeshStandardMaterial({color,metalness,roughness});
 const wood=material('#2c1722',.2,.44),felt=material('#155d4f',0,.9),
   rail=material('#54142b',.03,.88),brass=material('#d4aa64',.85,.23),
   ink=material('#100e18',.15,.32),ivory=material('#e0d7c0',.05,.58),
   red=rail,dark=ink;
 const mesh=(name,geometry,mat,x,y,z)=>{const o=new T.Mesh(geometry,mat);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o};
 // Elliptical top: broad guest edge, recessed dark-green textile, upholstered perimeter.
 const top=new T.CylinderGeometry(1,1,.14,64);top.scale(1.83,1,1.10);
 mesh('blackjack_mahogany_body',top,wood,0,1.02,0);
 const rim=new T.TorusGeometry(1,.065,8,64);rim.scale(1.78,1.11,1);
 const edge=mesh('blackjack_burgundy_padded_rail',rim,rail,0,1.13,0);edge.rotation.x=Math.PI/2;
 const line=new T.TorusGeometry(1,.012,5,64);line.scale(1.70,1.035,1);
 const trim=mesh('blackjack_brass_inner_piping',line,brass,0,1.145,0);trim.rotation.x=Math.PI/2;
 const surface=new T.CircleGeometry(1,64);surface.scale(1.68,1.01,1);
 const field=mesh('blackjack_recessed_felt',surface,felt,0,1.165,0);field.rotation.x=-Math.PI/2;
 // Dealer-side rail, shoe, discard holder, and low-profile recessed chip tray.
 mesh('dealer_shoe',new T.BoxGeometry(.38,.16,.22),dark,-.65,1.23,-.61);
 mesh('discard_tray',new T.BoxGeometry(.27,.055,.35),dark,.63,1.17,-.58);
 mesh('dealer_chip_rack',new T.BoxGeometry(1.0,.09,.22),wood,0,1.18,-.77);
 mesh('rack_brass_lip',new T.BoxGeometry(1.02,.018,.018),brass,0,1.235,-.65);
 // Five subtle felt wagering rings; markings are noninteractive scenery.
 const ringGeo=new T.TorusGeometry(.115,.006,4,32);
 for(let i=0;i<5;i++){
  const a=Math.PI*(.13+.74*i/4),x=1.18*Math.cos(a),z=.66*Math.sin(a)+.10;
  const ring=mesh('felt_bet_guide_'+i,ringGeo,brass,x,1.179,z);ring.rotation.x=-Math.PI/2;
 }
 // Card rectangles with shallow thickness, two original unbranded backs.
 const cardGeo=new T.BoxGeometry(.112,.004,.17);
 for(let i=0;i<2;i++){
  const card=mesh('dealer_card_back_'+i,cardGeo,ivory,-.08+i*.12,1.179,-.34);
  card.rotation.y=(i?-.11:.12);
 }
 // Each chip color is one InstancedMesh regardless of number of chips.
 const chipGeo=new T.CylinderGeometry(.043,.043,.012,12);
 const dummy=new T.Object3D();
 const stacks=[{mat:ivory,count:18,x:-.34},{mat:red,count:21,x:0},{mat:dark,count:15,x:.34}];
 stacks.forEach((stack,kind)=>{
  const chips=new T.InstancedMesh(chipGeo,stack.mat,stack.count);
  chips.name='dealer_rack_chips_'+kind;
  for(let j=0;j<stack.count;j++){
   const column=Math.floor(j/7),layer=j%7;
   dummy.position.set(stack.x+(column-1)*.09,1.245+layer*.012,-.77);
   dummy.rotation.set(0,0,0);dummy.updateMatrix();chips.setMatrixAt(j,dummy.matrix);
  }
  chips.instanceMatrix.needsUpdate=true;chips.castShadow=false;root.add(chips);
 });
 // Tapered support with brass kick ring; no mesh is used as a physics collider.
 mesh('table_pedestal',new T.CylinderGeometry(.39,.54,.77,24),wood,0,.56,0);
 mesh('pedestal_kick_ring',new T.CylinderGeometry(.55,.55,.055,24),brass,0,.20,0);
 root.userData={artOnly:true,collision:false,units:'m',up:'Y',table:'blackjack',
   integration:'opt-in preview only; do not replace gameplay or interaction anchors',
   anchors:{units:'m',localSpace:true,front:'-Z',guestSeats:[{id:'left',position:[-1.12,0,1.53],approach:[-1.12,0,2.30]},{id:'right',position:[1.12,0,1.53],approach:[1.12,0,2.30]}],dealer:{position:[0,0,-1.80],approach:[0,0,-2.30]}},
   disposal:'dispose geometries and unique materials owned by this group after removal'};
 return root;
}
