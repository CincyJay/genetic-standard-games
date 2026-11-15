/** Velvet Ace original physical table game art: all seven non-blackjack table games.
 * Geometry only. Real wagering/table rules remain in existing Phaser game.
 * Three.js supplied by caller; meters, Y up. Betting labels are UI, not baked text.
 */
export const TABLE_GAMES={
 poker:{radius:1.85,felt:0x165b46,seats:8},
 baccarat:{radius:1.9,felt:0x0a4b3e,seats:8},
 roulette:{radius:1.72,felt:0x0c503d,seats:7},
 craps:{radius:1.88,felt:0x165b46,seats:8},
 threecard:{radius:1.55,felt:0x165b46,seats:6},
 ultimateholdem:{radius:1.65,felt:0x165b46,seats:7},
 war:{radius:1.48,felt:0x712639,seats:6}
};
export function makeVelvetTableGame(THREE,id){
 const p=TABLE_GAMES[id];if(!p)throw Error('Unknown Velvet Ace table: '+id);
 const g=new THREE.Group();g.name='VelvetTable_'+id;
 const mat=(color,metalness=0,roughness=.8)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const wood=mat(0x351c23,.16,.42),felt=mat(p.felt),gold=mat(0xd9b568,.85,.21),black=mat(0x16141b,.2,.48),ivory=mat(0xe0d9c5),maroon=mat(0x6c1a34);
 const box=(name,x,y,z,w,h,d,m)=>{
  const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;
 };
 const cylinder=(name,x,y,z,r,h,m,segments=48)=>{
  const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),m);
  o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;
 };
 box('structural_base',0,.15,0,1.3,.2,1.1,black);
 box('pedestal',0,.53,0,.7,1,.58,black);
 if(id==='craps'){
  box('long_table_mahogany',0,1.12,0,3.8,.3,1.62,wood);
  box('recessed_felt',0,1.29,0,3.45,.06,1.32,felt);
  for(const x of [-1.85,1.85])box('high_bumper',x,1.43,0,.12,.34,1.62,wood);
  for(const z of [-.75,.75])box('gold_padded_rail',0,1.43,z,3.8,.34,.12,gold);
  for(let i=-4;i<=4;i++)box('individual_betting_box',i*.3,1.33,-.1,.22,.009,.28,gold);
  for(const x of [-.12,.12])box('dice',x,1.38,.2,.14,.14,.14,ivory);
 }else{
  cylinder('solid_table_wood',0,1.11,0,p.radius,.21,wood);
  cylinder('perimeter_gold_rim',0,1.228,0,p.radius+.04,.06,gold);
  cylinder('felt_top',0,1.265,0,p.radius-.12,.02,felt);
  for(let i=0;i<p.seats;i++){
    const a=Math.PI*(.06+.88*i/Math.max(1,p.seats-1));
    const x=(p.radius-.4)*Math.cos(a),z=(p.radius-.4)*Math.sin(a);
    cylinder('betting_circle',x,1.291,z,.1,.008,gold,20);
    cylinder('betting_circle_center',x,1.298,z,.075,.008,felt,20);
  }
 }
 if(id==='roulette'){
  cylinder('roulette_wheel_bowl',-.87,1.36,-.4,.55,.16,wood);
  cylinder('roulette_rotor',-.87,1.49,-.4,.40,.036,black);
  for(let i=0;i<37;i++){
    const a=i*2*Math.PI/37;
    box('roulette_pocket_'+i,-.87+.445*Math.cos(a),1.515,-.4+.445*Math.sin(a),.06,.006,.055,i===0?felt:i%2?maroon:black);
  }
  const ball=new THREE.Mesh(new THREE.SphereGeometry(.032,12,8),ivory);
  ball.name='roulette_ball';ball.position.set(-.57,1.54,-.16);g.add(ball);
 }
 if(['poker','threecard','ultimateholdem'].includes(id)){
  box('dealer_shoe',0,1.38,-1.2,.46,.15,.27,black);
  for(let i=0;i<6;i++)cylinder('dealer_chip_stack',-.25+i*.10,1.34,-1.05,.043,.09,i%2?maroon:ivory,14);
 }
 if(id==='baccarat')for(const x of [-.7,0,.7])cylinder('baccarat_betting_field',x,1.313,-.3,.20,.006,gold,24);
 if(id==='war')for(const x of [-.32,.32])box('war_card',x,1.312,.3,.18,.012,.26,ivory);
 g.userData={game:id,seats:p.seats,units:'m',artOnly:true};
 return g;
}
