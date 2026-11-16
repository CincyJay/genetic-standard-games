/**
 * Velvet Ace 3D floor reel presentation, ORIGINAL graphics implementation.
 *
 * Uses the EXISTING licensed/in-repository Phaser slot symbols and themed logos.
 * In this first pass, cabinet reels are attractive static idle artwork only, not gameplay.
 * Engineering controls live spin outcomes and may call updateCell with the actual slot state.
 * Never invent wins, odds, scatter results, or player balances on decorative lobby cabinets.
 *
 * Canvas atlas: 5x5 cells x 160px = 800px; one GPU texture per machine instead of 25.
 * THREE is supplied by the app. No third-party hosted asset requests.
 */
export const REEL_ART_SIZE=160;
export const REEL_ART_COLUMNS=5;
export const REEL_ART_ROWS=5;
const CAPTIONS={sevens:'LUCKY SEVENS',lanterns:'LUCKY LANTERNS',pharaoh:"PHARAOH'S GOLD",ocean:'DEEP BLUE',goldrush:'GOLD RUSH',dragon:"DRAGON'S HOARD",empire:'DIAMOND EMPIRE',thunder:'THUNDER PEAK',tiger:"TIGER'S TREASURE",cosmic:'COSMIC FORTUNE'};
const ACCENTS={sevens:'#f7c56b',lanterns:'#ed997b',pharaoh:'#e2c97b',ocean:'#8be2f0',goldrush:'#f9bd69',dragon:'#f5ad68',empire:'#d7c9f7',thunder:'#8acbff',tiger:'#eac071',cosmic:'#e2a1fd'};
function loadImage(url){
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>reject(new Error('Failed to load slot art: '+url));
  image.src=url;
 });
}
export async function createVelvetReelArt(THREE,machineId,symbols,{base='/art'}={}){
 if(!CAPTIONS[machineId])throw Error('Unknown machine: '+machineId);
 if(!Array.isArray(symbols)||!symbols.length)throw Error('symbols must be from existing machine definition');
 const tile=REEL_ART_SIZE,canvas=document.createElement('canvas');
 canvas.width=tile*REEL_ART_COLUMNS;canvas.height=tile*REEL_ART_ROWS;
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)throw Error('Canvas 2D unsupported');
 const images=new Map();
 await Promise.all(symbols.map(async s=>{
  const image=await loadImage(`${base}/slots/${machineId}/${s}.png`);
  images.set(s,image);
 }));
 const dark='#0c0916',gold=ACCENTS[machineId];
 function drawCell(col,row,symbol){
  const x=col*tile,y=row*tile;
  ctx.fillStyle=dark;ctx.fillRect(x,y,tile,tile);
  const gradient=ctx.createLinearGradient(x,y,x,y+tile);
  gradient.addColorStop(0,'#393044');gradient.addColorStop(.48,'#0f0b18');gradient.addColorStop(1,'#281b36');
  ctx.fillStyle=gradient;ctx.fillRect(x+3,y+3,tile-6,tile-6);
  ctx.strokeStyle=gold;ctx.globalAlpha=.37;ctx.lineWidth=2;
  ctx.strokeRect(x+3,y+3,tile-6,tile-6);ctx.globalAlpha=1;
  const img=images.get(symbol);
  if(img){
   const r=Math.min(132/img.width,132/img.height);
   const w=img.width*r,h=img.height*r;
   ctx.drawImage(img,x+(tile-w)/2,y+(tile-h)/2,w,h);
  }
  // Reflection is restrained so the user can actually recognize the symbols.
  const shine=ctx.createLinearGradient(x,y,x,y+tile*.40);
  shine.addColorStop(0,'rgba(255,255,255,.20)');
  shine.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=shine;ctx.fillRect(x+4,y+4,tile-8,tile*.40);
 }
 const idleSymbols=symbols.filter(x=>x!=='scatter'&&x!=='wild');
 // A non-payout-looking idle board: adjacent symbols vary across rows AND columns.
// The old col*7 formula made every column identical when a machine had 7 symbols.
 if(!idleSymbols.length)throw Error('Machine has no non-special idle symbols');
 const board=Array.from({length:25},(_,idx)=>{
  const col=idx%5,row=Math.floor(idx/5);
  return idleSymbols[(col*3+row*2+Math.floor(col*row/2))%idleSymbols.length];
 });
 for(let row=0;row<5;row++)for(let col=0;col<5;col++)drawCell(col,row,board[row*5+col]);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=2;
 // Default flipY=true matches the atlas UV's bottom-origin row mapping.
 texture.flipY=true;
 texture.needsUpdate=true;
 return {
  caption:CAPTIONS[machineId],canvas,texture,board,
  updateCell(col,row,symbol){
   if(!Number.isInteger(col)||col<0||col>4||!Number.isInteger(row)||row<0||row>4)throw Error('Reel position out of range');
   if(!images.has(symbol))throw Error('Symbol not in '+machineId+': '+symbol);
   board[row*5+col]=symbol;drawCell(col,row,symbol);texture.needsUpdate=true;
  },
  dispose(){texture.dispose();}
 };
}
/**
 * Remap the batched reel mesh's 25 geometry groups to tiles in a single 5x5 atlas.
 * Claude's artScene.ts attaches the original part names to mesh.userData.parts.
 * We only map UVs of THREE.BufferGeometry; all original mesh positions are unchanged.
 * The input must be a *dedicated* reel mesh, not an entire batched floor.
 */
export function applyVelvetReelAtlas(THREE,reelMesh,art){
 const parts=reelMesh.userData?.parts;
 const groups=reelMesh.geometry?.groups;
 if(!Array.isArray(parts)||parts.length!==25||!Array.isArray(groups)||groups.length!==25)
  throw Error('Expected 25 independently grouped reel surfaces');
 const uv=reelMesh.geometry.getAttribute('uv');
 if(!uv)throw Error('Reel mesh lacks UVs');
 for(let i=0;i<parts.length;i++){
  const m=/^REEL_(\d)_(\d)_SWAP_TEXTURE$/.exec(parts[i]);
  if(!m)throw Error('Invalid reel identity: '+parts[i]);
  const col=Number(m[1]),row=Number(m[2]),group=groups[i];
  // Existing BoxGeometry front faces use 0..1 UV. Allow small inset to avoid atlas edge bleeding.
  const margin=.018,cell=1/5,inner=cell*(1-2*margin);
  for(let n=group.start;n<group.start+group.count;n++){
   const oldU=uv.getX(n),oldV=uv.getY(n);
   const u=col*cell+cell*margin+oldU*inner;
   const v=(4-row)*cell+cell*margin+oldV*inner;
   uv.setXY(n,u,v);
  }
 }
 uv.needsUpdate=true;
 const old=reelMesh.material;
 reelMesh.material=new THREE.MeshBasicMaterial({map:art.texture,color:0xffffff,toneMapped:false});
 // Caller controls material disposal, as artScene batches may share old material.
 reelMesh.userData.originalMaterial=old;
 return reelMesh;
}
