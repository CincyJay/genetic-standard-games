/** Velvet Ace first walkable 3D casino ART composition.
 * All meshes authored by ChatGPT, with no external/paid model packs.
 * Camera, movement, seating interaction, collision and mobile QA belong to engineering.
 */
import { makeVelvetCasinoRoom, makeVelvetBlackjackTable, makeVelvetChair } from './velvetCasinoArt.mjs';
import { makeVelvetThemedSlot } from './slotThemes.mjs';

const LEFT_SLOTS=['sevens','lanterns','pharaoh','ocean','goldrush'];
const RIGHT_SLOTS=['dragon','empire','thunder','tiger','cosmic'];
export const CASINO_WORLD = Object.freeze({
 units:'meters',up:'Y',lobbyWidth:18,lobbyDepth:16,
 spawn:{x:0,y:0,z:4.3},
 blackjack:{x:0,y:0,z:-2},
 seats:[
  {id:'blackjack_1',x:-1.02,y:0,z:-.35,game:'blackjack'},
  {id:'blackjack_2',x:1.02,y:0,z:-.35,game:'blackjack'},
 ],
 slots:[
  ...LEFT_SLOTS.map((id,i)=>({id,x:-5.45,y:0,z:-5.6+i*2.3,rotationY:Math.PI/2})),
  ...RIGHT_SLOTS.map((id,i)=>({id,x:5.45,y:0,z:-5.6+i*2.3,rotationY:-Math.PI/2})),
 ],
});
export function makeVelvetWorld(THREE,{includeSlots=true,includeTable=true}={}) {
 const root=new THREE.Group();root.name='VelvetAce_CasinoWorld_Art';
 root.add(makeVelvetCasinoRoom(THREE));
 const interactiveAnchors={seats:[],slots:[]};
 if(includeTable){
  const table=makeVelvetBlackjackTable(THREE);
  table.position.set(CASINO_WORLD.blackjack.x,CASINO_WORLD.blackjack.y,CASINO_WORLD.blackjack.z);
  root.add(table);
  for(const data of CASINO_WORLD.seats){
   const chair=makeVelvetChair(THREE);
   chair.name=data.id+'_chair';chair.position.set(data.x,data.y,data.z);
   root.add(chair);
   interactiveAnchors.seats.push({...data,object:chair,occupied:false});
  }
 }
 if(includeSlots){
  for(const data of CASINO_WORLD.slots){
   const machine=makeVelvetThemedSlot(THREE,data.id);
   machine.name='slot_'+data.id;machine.position.set(data.x,data.y,data.z);
   machine.rotation.y=data.rotationY;
   root.add(machine);
   interactiveAnchors.slots.push({...data,object:machine,occupied:false});
  }
 }
 return {root,spawn:{...CASINO_WORLD.spawn},anchors:interactiveAnchors};
}
