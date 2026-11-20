/** Velvet Ace original character ANIMATION STAGING code.
 * Intended for ChatGPT-authored procedural GLB avatar body stand-ins.
 * These joint-pivot motions are not a substitute for professionally rigged animations.
 * Engineering calls update(elapsedSec, velocityMps, isSeated) from its loop.
 */
const pivotMap={
 upper_arm_left:{point:[-.31,1.55,0],name:'armL'},
 upper_arm_right:{point:[.31,1.55,0],name:'armR'},
 thigh_left:{point:[-.13,.96,0],name:'legL'},
 thigh_right:{point:[.13,.96,0],name:'legR'},
 forearm_left:{point:[-.34,1.22,0],name:'foreL'},
 forearm_right:{point:[.34,1.22,0],name:'foreR'},
 shin_left:{point:[-.13,.56,0],name:'shinL'},
 shin_right:{point:[.13,.56,0],name:'shinR'}
};
function matchMesh(node,name){
 return node.name?.toLowerCase().startsWith(name.toLowerCase()) && node.isMesh;
}
export class VelvetAvatarMotion {
  constructor(THREE,avatarModelRoot){
    this.THREE=THREE;
    this.base=avatarModelRoot;
    this.pivots={};
    this.hipY=avatarModelRoot.position.y;
    this.prev={walk:0,sit:0};
    // Group each mesh under a pivot, preserving its world transform.
    // Loader's GLB hierarchy may differ, so only attach found target meshes.
    for(const [prefix,spec] of Object.entries(pivotMap)){
      let target=null;
      avatarModelRoot.traverse(o=>{if(!target&&matchMesh(o,prefix))target=o;});
      if(!target)continue;
      const pivot=new THREE.Group();pivot.name='VA_'+spec.name;
      pivot.position.set(...spec.point);
      avatarModelRoot.add(pivot);
      pivot.attach(target);
      this.pivots[spec.name]=pivot;
    }
  }
  update(t,velocity=0,isSeated=false,dt=1/60){
    const a=Math.min(1,Math.max(0,dt*7));
    this.prev.walk+= (Math.min(1,velocity/1.5)-this.prev.walk)*a;
    this.prev.sit+=((isSeated?1:0)-this.prev.sit)*Math.min(1,dt*5);
    const w=this.prev.walk, s=this.prev.sit;
    const stride=Math.sin(t*7.6)*.48*w;
    const bob=Math.abs(Math.sin(t*7.6))*.025*w;
    const wave=Math.sin(t*2.5)*.024;
    // Arms and legs alternate; seated joints move smoothly to chair pose.
    const rot={
      armL:wave+stride*.8+s*.16,armR:-wave-stride*.8+s*.16,
      legL:-stride*(1-s)-1.10*s,legR:stride*(1-s)-1.10*s,
      foreL:.13+.06*w+1.0*s,foreR:.13+.06*w+1.0*s,
      shinL:.07+1.2*s,shinR:.07+1.2*s,
    };
    for(const [name,value] of Object.entries(rot)){
      const p=this.pivots[name];
      if(p)p.rotation.x+= (value-p.rotation.x)*Math.min(1,dt*10);
    }
    // Sitting drops the root while knees project forward.
    this.base.position.y=this.hipY+bob-.37*s;
    this.base.rotation.y=Math.sin(t*1.5)*.018*(1-w)*(1-s);
  }
  reset(){
    for(const p of Object.values(this.pivots))p.rotation.set(0,0,0);
    this.base.position.y=this.hipY;this.prev={walk:0,sit:0};
  }
}
