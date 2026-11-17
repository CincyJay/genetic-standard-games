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
  const seam = new T.MeshStandardMaterial({color:0x230612,roughness:.8,metalness:0});
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
    const mesh=new T.Mesh(new T.TubeGeometry(curve,Math.max(5,points.length*2),r,4,false),material);
    mesh.name=n;g.add(mesh);return mesh;
  };
  const crown=new T.Group();crown.name='DragonFire_Crown_Standalone';
  // Intended above a 2.30 m cabinet: height +0.12 m => total <= 2.45 m.
  // Origin is cabinet top, not world origin.
  addBox(crown,'black recessed crown bed',.94,.027,.13,0,.014,.39,black);
  addBox(crown,'polished gold crown lower lip',.97,.016,.14,0,.008,.386,gold);
  // Three-lobed fleur silhouette, <= 0.142 m from the crown origin.
  const tipShape=new T.Shape();
  tipShape.moveTo(-.045,0);tipShape.lineTo(-.038,.029);
  tipShape.bezierCurveTo(-.080,.035,-.074,.077,-.044,.081);
  tipShape.bezierCurveTo(-.024,.081,-.018,.065,-.017,.053);
  tipShape.bezierCurveTo(-.026,.090,-.014,.116,0,.128);
  tipShape.bezierCurveTo(.014,.116,.026,.090,.017,.053);
  tipShape.bezierCurveTo(.018,.065,.024,.081,.044,.081);
  tipShape.bezierCurveTo(.074,.077,.080,.035,.038,.029);
  tipShape.lineTo(.045,0);tipShape.closePath();
  const tipGeo=new T.ExtrudeGeometry(tipShape,{depth:.009,bevelEnabled:false,curveSegments:3,steps:1});
  for(let i=-2;i<=2;i++){
    const mesh=new T.Mesh(tipGeo,i%2?goldDark:gold);
    mesh.name='three-lobed cast fleur '+i;
    mesh.position.set(i*.184,.012,.32);
    mesh.scale.set(i===0?1:.88,i===0?1:.78,1);
    crown.add(mesh);
  }
  const jewel=new T.Mesh(new T.OctahedronGeometry(.024,0),ruby);
  jewel.name='ruby in central fleur';jewel.scale.set(.8,1,.45);
  jewel.position.set(0,.084,.303);crown.add(jewel);
  line(crown,'forward brass inlay',[[-.45,.024,.309],[0,.030,.309],[.45,.024,.309]],.005,gold);
  const chair=new T.Group();chair.name='DragonFire_Tufted_Chair_Standalone';
  // Chair origin at floor. The machine model's chair must be hidden in preview to avoid duplicates.
  const cyl=(name,rt,rb,h,y,material)=>{
    const mesh=new T.Mesh(new T.CylinderGeometry(rt,rb,h,12),material);
    mesh.name=name;mesh.position.y=y;chair.add(mesh);return mesh;
  };
  cyl('heavy brass pedestal base',.19,.25,.045,.023,gold);
  cyl('height adjustment spindle',.048,.048,.45,.27,goldDark);
  cyl('spindle collar',.09,.09,.035,.47,gold);
  const cushion=new T.Mesh(new T.SphereGeometry(1,14,8),velvet);
  cushion.name='rounded padded seat';cushion.scale.set(.34,.09,.30);cushion.position.set(0,.64,-.035);chair.add(cushion);
  // Contoured chair back with rounded silhouette. Three separate upholstered contours.
  const back=new T.Mesh(new T.SphereGeometry(1,16,10),velvet);
  back.name='deep sculpted high back';back.scale.set(.34,.32,.083);back.position.set(0,.98,.21);chair.add(back);
  line(chair,'gold seat welt',[[-.32,.63,-.07],[-.26,.62,-.25],[0,.62,-.32],[.26,.62,-.25],[.32,.63,-.07]],.006,seam);
  line(chair,'back left welt',[[-.31,.78,.17],[-.32,.98,.17],[-.24,1.22,.17],[0,1.29,.17],[.24,1.22,.17],[.32,.98,.17],[.31,.78,.17]],.006,seam);
  // Actual intersecting diagonal seams and buttons at each crossing on front of back.
  // Surface y/z coordinate tracks convex front of upholstered ellipsoid.
  const surface=(x,y)=>{
    const q=1-(x/.34)**2-((y-.98)/.32)**2;
    return -.0 + .21 - .083*Math.sqrt(Math.max(0,q))-.004;
  };
  // Diamond seams: sparse, dark recessed lines, low-segment tubes.
  // Buttons share ONE mesh through InstancedMesh, not dozens of draw calls.
  const buttonPositions=[];
  const rows=5,cols=5;
  for(let i=0;i<rows;i++){
    const y=.80+i*.087;
    for(let j=0;j<cols;j++){
      const x=(j-2)*.112+(i%2?.056:0);
      if((x/.34)**2+((y-.98)/.32)**2>.80)continue;
      buttonPositions.push([x,y,surface(x,y)-.012]);
      for(const dx of [-.056,.056]){
        const ex=x+dx,ey=y+.043;
        if((ex/.34)**2+((ey-.98)/.32)**2>.91)continue;
        line(chair,'dark inset diamond seam',[[x,y,surface(x,y)-.012],[ex,ey,surface(ex,ey)-.012]],.0035,seam);
      }
    }
  }
  const buttons=new T.InstancedMesh(new T.SphereGeometry(.0165,6,4),gold,buttonPositions.length);
  buttons.name='shared geometry upholstered tuft buttons';
  const dummy=new T.Object3D();
  buttonPositions.forEach((p,i)=>{dummy.position.set(...p);dummy.scale.set(1,1,.55);dummy.updateMatrix();buttons.setMatrixAt(i,dummy.matrix);});
  buttons.instanceMatrix.needsUpdate=true;chair.add(buttons);
  for(const sign of [-1,1]){
    const arm=new T.Mesh(new T.SphereGeometry(1,12,8),velvet);
    arm.name='rolled upholstered arm '+sign;arm.scale.set(.077,.055,.24);
    arm.position.set(sign*.30,.83,-.045);chair.add(arm);
    const support=new T.Mesh(new T.BoxGeometry(.065,.27,.09),gold);support.name='solid cast gold arm bracket '+sign;support.position.set(sign*.30,.72,.02);support.rotation.z=sign*.16;chair.add(support);
  }
  crown.userData={previewOnly:true,topAboveCabinet:.142,attachAtWorldY:2.30};
  chair.userData={previewOnly:true,chairHeight:1.30,seatHeight:.64,frontIsNegativeZ:true};
  return {crown,chair};
}
