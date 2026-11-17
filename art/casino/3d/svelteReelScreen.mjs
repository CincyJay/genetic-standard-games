/**
 * Original, art-only reel-screen texture for the Svelte 01 isolated preview.
 * Browser Canvas2D required; no network, gambling logic, DOM insertion or saves.
 * Pass result.texture to the existing VA_SVELTE_REEL_SCREEN_SWAP integration.
 */
export function createSvelteReelScreen(THREE, { width = 512, height = 1024 } = {}) {
  if (typeof document === 'undefined') throw new Error('Canvas2D browser preview required');
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas2D unavailable');
  const sx = width / 512, sy = height / 1024;
  c.scale(sx, sy);
  const round = (x,y,w,h,r,fill,stroke) => {
    c.beginPath(); c.roundRect(x,y,w,h,r);
    if(fill){c.fillStyle=fill;c.fill();}
    if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}
  };
  const bg=c.createLinearGradient(0,0,512,1024);
  bg.addColorStop(0,'#07101c');bg.addColorStop(.55,'#172640');bg.addColorStop(1,'#080c15');
  c.fillStyle=bg;c.fillRect(0,0,512,1024);
  for(let i=0;i<26;i++){
    const x=22+(i*71)%470,y=(i*139)%1024;
    c.fillStyle='rgba(233,198,112,.16)';c.beginPath();c.arc(x,y,i%3+1,0,Math.PI*2);c.fill();
  }
  round(16,16,480,992,27,'#0c1220','#c6a765');
  round(29,29,454,966,20,'#111b2d','#6b8297');
  c.textAlign='center';
  c.shadowColor='#f4b957';c.shadowBlur=16;
  c.fillStyle='#f9d992';c.font='bold 54px Georgia,serif';c.fillText('VELVET',256,119);
  c.font='bold 62px Georgia,serif';c.fillText('ACE',256,177);
  c.shadowBlur=0;c.fillStyle='#b3c6db';c.font='18px sans-serif';c.fillText('MIDNIGHT REELS',256,214);
  // Three visibly separated mechanical-style reel windows with metal rails.
  const symbols=[
    ['7','◆','♛'],['♛','7','◆'],['◆','♛','7']
  ];
  for(let col=0;col<3;col++){
    const x=43+col*143;
    round(x,275,137,397,12,'#05070c','#c3a66a');
    const grad=c.createLinearGradient(x,280,x+137,280);
    grad.addColorStop(0,'#8b9cab');grad.addColorStop(.14,'#f5f7f6');
    grad.addColorStop(.5,'#fff7e6');grad.addColorStop(.85,'#a5b2bd');grad.addColorStop(1,'#576577');
    round(x+9,290,119,366,8,grad);
    for(let row=0;row<3;row++){
      const y=320+row*115;
      c.fillStyle=row===1?'#ab1733':'#1c3759';
      c.font='bold 68px Georgia,serif';c.fillText(symbols[col][row],x+68,y+52);
      c.fillStyle='rgba(28,41,59,.25)';c.fillRect(x+12,y+91,112,2);
    }
  }
  round(43,706,426,91,15,'#171d30','#c6a765');
  c.fillStyle='#eac977';c.font='bold 22px sans-serif';c.fillText('3 REELS  •  9 LINES',256,741);
  c.fillStyle='#e9f3fc';c.font='bold 29px sans-serif';c.fillText('WIN  2,450',256,779);
  round(42,829,428,112,17,'#091420','#b9a073');
  c.fillStyle='#8ed6f2';c.font='bold 23px sans-serif';c.fillText('CREDITS     BET      WIN',256,866);
  c.fillStyle='#fff3cc';c.font='bold 29px sans-serif';c.fillText('12,500      50      2,450',256,906);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  texture.needsUpdate=true;
  return {canvas,texture,dispose:()=>texture.dispose(),artOnly:true};
}
