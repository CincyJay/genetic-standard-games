/** Velvet Ace original woven carpet pilot. Opt-in art only, not a collision floor.
 * Browser Canvas 2D is required; no external imagery, downloads or production assets.
 * Y-up metres. One horizontal mesh; caller controls cutaway, lifecycle and placement.
 */
export function makeVelvetPatternCarpet(T, options={}) {
 const width=options.width??13.8, depth=options.depth??11.8;
 const canvas=options.canvas ?? (typeof document!=='undefined'?document.createElement('canvas'):null);
 if(!canvas) throw new Error('Velvet carpet requires a browser canvas or options.canvas');
 canvas.width=512;canvas.height=512;
 const c=canvas.getContext('2d');
 if(!c) throw new Error('Canvas 2D context unavailable');
 c.fillStyle='#301b31';c.fillRect(0,0,512,512);
 // Dense, muted woven speckle. Deterministic; no noise textures or asset fetch.
 let seed=0xace2026;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<18500;i++){
  const x=rand()*512,y=rand()*512;
  c.fillStyle=i%3===0?'rgba(155,105,125,.12)':'rgba(15,9,27,.18)';
  c.fillRect(x,y,.6+rand()*1.4,.6+rand()*1.4);
 }
 // Repeating interlocking lozenges: restrained hotel-casino motif, not loud checkerboard.
 const stroke=(color,lineWidth)=>{c.strokeStyle=color;c.lineWidth=lineWidth};
 for(let x=-128;x<=640;x+=128)for(let y=-128;y<=640;y+=128){
  c.save();c.translate(x,y);
  stroke('rgba(174,120,91,.30)',3);
  c.beginPath();c.moveTo(0,-48);c.lineTo(48,0);c.lineTo(0,48);c.lineTo(-48,0);c.closePath();c.stroke();
  stroke('rgba(92,68,108,.48)',2);
  c.beginPath();c.moveTo(0,-35);c.lineTo(35,0);c.lineTo(0,35);c.lineTo(-35,0);c.closePath();c.stroke();
  c.fillStyle='rgba(183,128,90,.23)';
  c.beginPath();c.arc(0,0,3,0,Math.PI*2);c.fill();
  c.restore();
 }
 // Thin diagonal stitch is embedded in texture, not geometry.
 stroke('rgba(210,164,126,.075)',1);
 for(let k=-512;k<1024;k+=16){c.beginPath();c.moveTo(k,0);c.lineTo(k+512,512);c.stroke()}
 const texture=new T.CanvasTexture(canvas);
 texture.wrapS=T.RepeatWrapping;texture.wrapT=T.RepeatWrapping;
 texture.repeat.set(width/6,depth/6);
 texture.colorSpace=T.SRGBColorSpace;
 texture.anisotropy=Math.min(options.anisotropy??4,8);
 const mat=new T.MeshStandardMaterial({map:texture,color:'#ffffff',roughness:1,metalness:0});
 const mesh=new T.Mesh(new T.PlaneGeometry(width,depth),mat);
 mesh.rotation.x=-Math.PI/2;
 mesh.position.set(options.x??0,options.y??.024,options.z??0);
 mesh.receiveShadow=true;mesh.name='VA_opt_in_patterned_carpet';
 mesh.userData={artOnly:true,collision:false,textureOwned:true,
  notes:'One mesh, one texture/material; avoid overlap with central runner and existing floor inlays. Validate mobile GPU and z-fighting.',
  dispose(){mesh.geometry.dispose();mat.dispose();texture.dispose()}};
 return mesh;
}
