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
 const motifContrast=Math.max(.45,Math.min(1.5,options.motifContrast??.84));
 const repeatMeters=Math.max(2,Math.min(9,options.repeatMeters??(Math.max(width,depth)>22?3.5:5.5)));
 c.fillStyle='#301b31';c.fillRect(0,0,512,512);
 // Dense, muted woven speckle. Deterministic; no noise textures or asset fetch.
 let seed=0xace2026;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 for(let i=0;i<18500;i++){
  const x=rand()*512,y=rand()*512;
  c.fillStyle=i%3===0?'rgba(155,105,125,.12)':'rgba(15,9,27,.18)';
  c.fillRect(x,y,.6+rand()*1.4,.6+rand()*1.4);
 }
 // Original mirrored damask medallions, not the old geometric diamonds.
 // Each 128px repeat contains a gold fleur-like arabesque, plum shadow
 // scrolls and a small centre rosette. Seamless edge motifs are deliberate.
 const stroke=(color,lineWidth)=>{c.strokeStyle=color;c.lineWidth=lineWidth;c.lineCap='round';c.lineJoin='round'};
 const petal=(sign)=>{
  c.save();c.scale(sign,1);
  c.beginPath();
  c.moveTo(0,-45);
  c.bezierCurveTo(9,-35,20,-36,24,-24);
  c.bezierCurveTo(28,-10,14,-5,13,5);
  c.bezierCurveTo(12,16,30,22,29,34);
  c.bezierCurveTo(21,30,13,27,8,18);
  c.bezierCurveTo(3,11,4,3,0,0);
  c.stroke();
  c.beginPath();
  c.moveTo(0,-31);
  c.bezierCurveTo(15,-24,17,-14,8,-7);
  c.bezierCurveTo(2,-3,9,4,15,3);
  c.stroke();
  c.restore();
 };
 for(let x=-128;x<=640;x+=128)for(let y=-128;y<=640;y+=128){
  c.save();c.translate(x,y);
  // Soft wine-coloured oval underlay helps the scrollwork survive minification.
  c.fillStyle='rgba(91,31,59,.29)';
  c.beginPath();c.ellipse(0,0,42,53,0,0,Math.PI*2);c.fill();
  stroke(`rgba(191,135,91,${(.50*motifContrast).toFixed(3)})`,4.2);
  petal(-1);petal(1);
  c.save();c.rotate(Math.PI);petal(-1);petal(1);c.restore();
  stroke(`rgba(173,99,124,${(.72*motifContrast).toFixed(3)})`,3.5);
  for(const sign of [-1,1]){
   c.beginPath();c.moveTo(sign*8,-18);
   c.bezierCurveTo(sign*40,-37,sign*43,-7,sign*28,0);
   c.bezierCurveTo(sign*43,7,sign*40,37,sign*8,18);c.stroke();
  }
  c.fillStyle=`rgba(198,139,91,${(.33*motifContrast).toFixed(3)})`;
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4;
   c.beginPath();c.ellipse(Math.cos(a)*8,Math.sin(a)*8,1.8,3.5,a,0,Math.PI*2);c.fill();
  }
  c.beginPath();c.arc(0,0,2.3,0,Math.PI*2);c.fill();
  // Tiny four-way buds bridge repeat edges without a visible tile seam.
  for(const [bx,by] of [[64,0],[0,64]]){
   c.beginPath();c.arc(bx,by,3.5,0,Math.PI*2);c.fill();
  }
  c.restore();
 }
 // Thin diagonal stitch is embedded in texture, not geometry.
 stroke('rgba(210,164,126,.075)',1);
 for(let k=-512;k<1024;k+=16){c.beginPath();c.moveTo(k,0);c.lineTo(k+512,512);c.stroke()}
 const texture=new T.CanvasTexture(canvas);
 texture.wrapS=T.RepeatWrapping;texture.wrapT=T.RepeatWrapping;
 texture.repeat.set(width/repeatMeters,depth/repeatMeters);
 texture.colorSpace=T.SRGBColorSpace;
 texture.anisotropy=Math.min(options.anisotropy??4,8);
 const mat=new T.MeshStandardMaterial({map:texture,color:'#ffffff',roughness:1,metalness:0});
 const mesh=new T.Mesh(new T.PlaneGeometry(width,depth),mat);
 mesh.rotation.x=-Math.PI/2;
 mesh.position.set(options.x??0,options.y??.024,options.z??0);
 mesh.receiveShadow=true;mesh.name='VA_opt_in_patterned_carpet';
 mesh.userData={artOnly:true,collision:false,textureOwned:true,
  motifContrast,repeatMeters, pattern:'original-burgundy-gold-damask',
  notes:'One mesh, one texture/material; avoid overlap with central runner and existing floor inlays. Validate mobile GPU and z-fighting.',
  dispose(){mesh.geometry.dispose();mat.dispose();texture.dispose()}};
 return mesh;
}
