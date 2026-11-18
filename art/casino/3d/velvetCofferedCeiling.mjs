/**
 * Velvet Ace: original, modular gold-coffered casino ceiling art.
 * Isolated optional Three.js geometry, not a replacement for world.ts.
 * Y up, metres. Host supplies room dimensions and mounting height.
 * Uses InstancedMesh to avoid a draw call per coffer or chandelier crystal.
 * Ceiling faces downward. No lights are added by default.
 */
export function createVelvetCofferedCeiling(THREE, options = {}) {
  const width = options.width ?? 18;
  const depth = options.depth ?? 22;
  const height = options.height ?? 4.6;
  const cellSize = options.cellSize ?? 2.25;
  const chandeliers = options.chandeliers ?? 2;
  if (![width,depth,height,cellSize].every(Number.isFinite) ||
      width <= 0 || depth <= 0 || cellSize <= 0 || height < 2.5 ||
      !Number.isInteger(chandeliers) || chandeliers < 0 || chandeliers > 12)
    throw new RangeError('Invalid ceiling dimensions or chandelier count');
  const group = new THREE.Group();
  group.name = 'VA_GOLD_COFFERED_CEILING';
  const nx = Math.max(1, Math.ceil(width/cellSize));
  const nz = Math.max(1, Math.ceil(depth/cellSize));
  const cw = width/nx, cd = depth/nz;
  const dark = new THREE.MeshStandardMaterial({color:0x25131b,roughness:.87,side:THREE.DoubleSide});
  const gold = new THREE.MeshStandardMaterial({color:0xb78a40,metalness:.82,roughness:.27});
  const inset = new THREE.MeshStandardMaterial({color:0x532637,roughness:.75,side:THREE.DoubleSide});
  const pearl = new THREE.MeshStandardMaterial({color:0xffdf9c,metalness:.18,roughness:.24,emissive:0xffa83e,emissiveIntensity:.32});
  const crystal = new THREE.MeshStandardMaterial({color:0xf4d8a5,metalness:.16,roughness:.14,transparent:true,opacity:.86,depthWrite:false});
  const add=(name,geometry,material,x,y,z)=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name=name;mesh.position.set(x,y,z);mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  // Main overhead plane and inset panels. Recesses sit above the perimeter trim.
  add('burgundy_overhead',new THREE.PlaneGeometry(width,depth),dark,0,height+.10,0).rotation.x=Math.PI/2;
  const panelGeo=new THREE.PlaneGeometry(cw*.83,cd*.83);
  panelGeo.rotateX(Math.PI/2);
  const panels=new THREE.InstancedMesh(panelGeo,inset,nx*nz);
  panels.name='recessed_burgundy_coffer_panels';
  const dummy=new THREE.Object3D();let k=0;
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    dummy.position.set(-width/2+(i+.5)*cw,height+.065,-depth/2+(j+.5)*cd);
    dummy.updateMatrix();panels.setMatrixAt(k++,dummy.matrix);
  }
  panels.instanceMatrix.needsUpdate=true;group.add(panels);
  // Beams below panels: actual thickness gives grazing-angle silhouette.
  const beamH=.13, beamW=Math.min(.105,Math.min(cw,cd)*.095);
  const beamsX=new THREE.InstancedMesh(new THREE.BoxGeometry(beamW,beamH,depth),gold,nx+1);
  beamsX.name='longitudinal_brushed_gold_coffer_beams';
  for(let i=0;i<=nx;i++){
    dummy.position.set(-width/2+i*cw,height,0);dummy.updateMatrix();
    beamsX.setMatrixAt(i,dummy.matrix);
  }
  beamsX.instanceMatrix.needsUpdate=true;group.add(beamsX);
  const beamsZ=new THREE.InstancedMesh(new THREE.BoxGeometry(width,beamH,beamW),gold,nz+1);
  beamsZ.name='transverse_brushed_gold_coffer_beams';
  for(let j=0;j<=nz;j++){
    dummy.position.set(0,height,-depth/2+j*cd);dummy.updateMatrix();
    beamsZ.setMatrixAt(j,dummy.matrix);
  }
  beamsZ.instanceMatrix.needsUpdate=true;group.add(beamsZ);
  // Subtle raised inner molding, four edges per cell. Instanced across the room.
  const count=nx*nz;
  const innerX=new THREE.InstancedMesh(new THREE.BoxGeometry(cw*.76,.025,.025),gold,count*2);
  const innerZ=new THREE.InstancedMesh(new THREE.BoxGeometry(.025,.025,cd*.76),gold,count*2);
  innerX.name='coffer_inner_gold_molding_x';innerZ.name='coffer_inner_gold_molding_z';
  k=0;
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    const x=-width/2+(i+.5)*cw,z=-depth/2+(j+.5)*cd;
    for(const sign of [-1,1]){
      dummy.position.set(x,height+.048,z+sign*cd*.40);dummy.updateMatrix();innerX.setMatrixAt(k,dummy.matrix);
      dummy.position.set(x+sign*cw*.40,height+.048,z);dummy.updateMatrix();innerZ.setMatrixAt(k,dummy.matrix);
      k++;
    }
  }
  innerX.instanceMatrix.needsUpdate=true;innerZ.instanceMatrix.needsUpdate=true;
  group.add(innerX,innerZ);
  // Chandelier modules: suspended gold spindle, two concentric rings,
  // faceted crystal drops. All drops share one InstancedMesh/material.
  const dropCount=chandeliers*24;
  const drops=new THREE.InstancedMesh(new THREE.ConeGeometry(.034,.25,5),crystal,Math.max(1,dropCount));
  drops.name='chandelier_faceted_crystal_pendants';
  let dropIndex=0;
  for(let n=0;n<chandeliers;n++){
    const x=chandeliers===1?0:(n-(chandeliers-1)/2)*Math.min(5.0,width/(chandeliers+1));
    const z=0;
    const stem=add('chandelier_'+n+'_suspension',new THREE.CylinderGeometry(.018,.018,.56,8),gold,x,height-.36,z);
    stem.castShadow=false;
    for(const [r,y] of [[.57,height-.68],[.37,height-.89]]){
      const hoop=add('chandelier_'+n+'_gold_ring',new THREE.TorusGeometry(r,.025,6,32),gold,x,y,z);
      hoop.rotation.x=Math.PI/2;
    }
    add('chandelier_'+n+'_warm_diffuser',new THREE.SphereGeometry(.14,10,8),pearl,x,height-.77,z);
    for(let p=0;p<24;p++){
      const a=2*Math.PI*p/24,r=p%2===0?.56:.36;
      dummy.position.set(x+r*Math.cos(a),height-(p%2===0?.91:1.12),z+r*Math.sin(a));
      dummy.rotation.set(0,a,0);dummy.updateMatrix();drops.setMatrixAt(dropIndex++,dummy.matrix);
    }
  }
  if(dropIndex) {drops.count=dropIndex;drops.instanceMatrix.needsUpdate=true;group.add(drops);}
  else drops.dispose();
  group.userData={artOnly:true,units:'metres',up:'+Y',width,depth,height,
    cofferColumns:nx,cofferRows:nz,chandeliers,
    integration:'Add group to room scene; supply room width/depth/height; optional host-owned lighting',
    status:'isolated source geometry, not integrated or visually/device tested'};
  return group;
}
