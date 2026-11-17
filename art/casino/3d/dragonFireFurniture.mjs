/**
 * Velvet Ace: isolated, original sculpted Dragon Fire crown + chair accents.
 * Three.js scene additions for art preview ONLY. No game, save, or floor wiring.
 * Both groups use metres, Y up, player/front at negative Z.
 * Import createDragonFireFurniture(THREE) from an isolated preview and inspect.
 */
export function createDragonFireFurniture(T) {
  const gold = new T.MeshStandardMaterial({color:0xc89a4d,metalness:.85,roughness:.23});
  const goldDark = new T.MeshStandardMaterial({color:0x69401f,metalness:.75,roughness:.34});
  const velvet = new T.MeshStandardMaterial({color:0x480b21,roughness:.69,metalness:0});
  const seam = new T.MeshStandardMaterial({color:0xb68451,roughness:.49,metalness:.25});
  const ruby = new T.MeshPhysicalMaterial({color:0x980d28,metalness:.3,roughness:.17,clearcoat:1,clearcoatRoughness:.12});
  const black = new T.MeshStandardMaterial({color:0x100d14,roughness:.34,metalness:.25});
  const addBox=(g,n,w,h,d,x,y,z,mat,r=.025)=>{
    const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);
    mesh.name=n;mesh.position.set(x,y,z);
    if(r>0) {
      // Three core has no bevel-box primitive; layered gold edge piping handles silhouette.
    }
    g.add(mesh);return mesh;
  };
  const line=(g,n,points,r,material)=>{
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    const mesh=new T.Mesh(new T.TubeGeometry(curve,Math.max(8,points.length*5),r,6,false),material);
    mesh.name=n;g.add(mesh);return mesh;
  };
  const crown=new T.Group();crown.name='DragonFire_Crown_Standalone';
  // Intended above a 2.30 m cabinet: height +0.12 m => total <= 2.45 m.
  // Origin is cabinet top, not world origin.
  addBox(crown,'black recessed crown bed',.94,.042,.13,0,.022,0,black);
  addBox(crown,'polished gold crown lower lip',.97,.025,.14,0,.011,-.007,gold);
  const tipShape=new T.Shape();
  tipShape.moveTo(-.058,0);tipShape.lineTo(-.052,.046);
  tipShape.quadraticCurveTo(-.035,.064,-.022,.066);
  tipShape.lineTo(0,.128);tipShape.lineTo(.022,.066);
  tipShape.quadraticCurveTo(.035,.064,.052,.046);
  tipShape.lineTo(.058,0);tipShape.closePath();
  const tipGeo=new T.ExtrudeGeometry(tipShape,{depth:.016,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.005,bevelThickness:.004});
  for(let i=-2;i<=2;i++){
    const mesh=new T.Mesh(tipGeo,i%2?goldDark:gold);
    mesh.name='cast fleur crown tip '+i;
    mesh.position.set(i*.184,.026,-.015);
    mesh.scale.set(i===0?1.1:.92,i===0?1:.77,1);
    crown.add(mesh);
  }
  const jewel=new T.Mesh(new T.OctahedronGeometry(.027,1),ruby);
  jewel.name='ruby cabochon in central fleur';jewel.scale.set(.8,1.2,.42);
  jewel.position.set(0,.103,-.024);crown.add(jewel);
  line(crown,'lower crown brass inlay',[[-.45,.037,-.085],[-.2,.049,-.09],[0,.051,-.09],[.2,.049,-.09],[.45,.037,-.085]],.005,gold);
  const chair=new T.Group();chair.name='DragonFire_Tufted_Chair_Standalone';
  // Chair origin at floor. The machine model's chair must be hidden in preview to avoid duplicates.
  const cyl=(name,rt,rb,h,y,material)=>{
    const mesh=new T.Mesh(new T.CylinderGeometry(rt,rb,h,40),material);
    mesh.name=name;mesh.position.y=y;chair.add(mesh);return mesh;
  };
  cyl('heavy brass pedestal base',.19,.25,.045,.023,gold);
  cyl('height adjustment spindle',.048,.048,.45,.27,goldDark);
  cyl('spindle collar',.09,.09,.035,.47,gold);
  const cushion=new T.Mesh(new T.SphereGeometry(1,28,16),velvet);
  cushion.name='rounded padded seat';cushion.scale.set(.34,.09,.30);cushion.position.set(0,.64,-.035);chair.add(cushion);
  // Contoured chair back with rounded silhouette. Three separate upholstered contours.
  const back=new T.Mesh(new T.SphereGeometry(1,32,24),velvet);
  back.name='deep sculpted high back';back.scale.set(.34,.32,.083);back.position.set(0,.98,.21);chair.add(back);
  line(chair,'gold seat welt',[[-.32,.63,-.07],[-.26,.62,-.25],[0,.62,-.32],[.26,.62,-.25],[.32,.63,-.07]],.006,seam);
  line(chair,'back left welt',[[-.31,.78,.17],[-.32,.98,.17],[-.24,1.22,.17],[0,1.29,.17],[.24,1.22,.17],[.32,.98,.17],[.31,.78,.17]],.006,seam);
  // Actual intersecting diagonal seams and buttons at each crossing on front of back.
  // Surface y/z coordinate tracks convex front of upholstered ellipsoid.
  const surface=(x,y)=>{
    const q=1-(x/.34)**2-((y-.98)/.32)**2;
    return -.0 + .21 - .083*Math.sqrt(Math.max(0,q))-.004;
  };
  const rows=5, cols=5;
  for(let i=0;i<rows;i++){
    const y=.80+i*.087;
    for(let j=0;j<cols;j++){
      const x=(j-2)*.112+(i%2?.056:0);
      if((x/.34)**2+((y-.98)/.32)**2>.80)continue;
      const button=new T.Mesh(new T.SphereGeometry(.011,10,8),gold);
      button.name='tuft button at diamond lattice crossing '+i+'-'+j;
      button.position.set(x,y,surface(x,y)-.009);button.scale.z=.45;chair.add(button);
      for(const dx of [-.056,.056]){
        const endX=x+dx,endY=y+.043;
        if((endX/.34)**2+((endY-.98)/.32)**2>.91)continue;
        line(chair,'stitched diamond seam',[[x,y,surface(x,y)-.011],[(x+endX)/2,(y+endY)/2,surface((x+endX)/2,(y+endY)/2)-.01],[endX,endY,surface(endX,endY)-.01]],.0024,seam);
      }
    }
  }
  for(const sign of [-1,1]){
    const arm=new T.Mesh(new T.SphereGeometry(1,20,12),velvet);
    arm.name='rolled upholstered arm '+sign;arm.scale.set(.077,.055,.24);
    arm.position.set(sign*.30,.83,-.045);chair.add(arm);
    line(chair,'swept cast brass arm support '+sign,[[sign*.29,.60,.11],[sign*.31,.70,.08],[sign*.30,.81,-.02]],.017,gold);
  }
  crown.userData={previewOnly:true,topAboveCabinet:.135,attachAtWorldY:2.30};
  chair.userData={previewOnly:true,chairHeight:1.30,seatHeight:.64,frontIsNegativeZ:true};
  return {crown,chair};
}
