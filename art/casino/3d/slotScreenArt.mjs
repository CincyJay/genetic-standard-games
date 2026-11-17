/**
 * Original Velvet Ace slot screen artwork for the isolated premium cabinet pilot.
 * Uses host THREE and browser Canvas. No assets, network, game logic or live saves.
 * Distinct 2D artwork is mapped onto actual curved screen meshes.
 */
export function applyVelvetAceScreenArt(THREE, station, { theme = 'royal' } = {}) {
  if (!THREE?.CanvasTexture || !station?.getObjectByName) throw new Error('THREE and slot station required');
  const palettes = {
    royal: { base:'#190923', glow:'#ff4eb9', gold:'#ffca67', blue:'#52a9ff', name:'VELVET ACE', subtitle:'ROYAL FORTUNE' },
    dragon: { base:'#210810', glow:'#ff693c', gold:'#ffd27b', blue:'#59e9e5', name:'DRAGON FIRE', subtitle:'LEGENDARY REELS' },
    ocean: { base:'#071b31', glow:'#16e6ed', gold:'#f6c46b', blue:'#a66aff', name:'DEEP TREASURE', subtitle:'OCEAN RICHES' }
  };
  const p = palettes[theme] || palettes.royal;
  const textures=[];
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')];};
  const round=(c,x,y,w,h,r,fill,stroke,line=2)=>{
    c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}
  };
  const text=(c,s,x,y,size,color,weight='700',align='center')=>{
    c.font=weight+' '+size+'px Georgia, serif';c.textAlign=align;c.fillStyle=color;c.fillText(s,x,y);
  };
  const background=(c,w,h)=>{
    const g=c.createRadialGradient(w*.5,h*.42,12,w*.5,h*.42,w*.8);
    g.addColorStop(0,p.base);g.addColorStop(.5,'#10091f');g.addColorStop(1,'#03040c');
    c.fillStyle=g;c.fillRect(0,0,w,h);
    for(let i=0;i<26;i++){
      const x=(i*193+43)%w,y=(i*157+83)%h;
      c.fillStyle=i%3?'#ffffff33':p.glow+'66';c.beginPath();c.arc(x,y,i%4+1,0,Math.PI*2);c.fill();
    }
    round(c,12,12,w-24,h-24,20,null,p.gold,7);
    round(c,25,25,w-50,h-50,16,null,p.glow,3);
  };
  const topper=()=>{
    const [cv,c]=canvas(1024,640);background(c,1024,640);
    c.shadowColor=p.glow;c.shadowBlur=35;
    text(c,'♠',512,154,110,p.gold);text(c,p.name,512,245,76,p.gold);
    c.shadowBlur=0;text(c,p.subtitle,512,302,30,'#fff2d7');
    round(c,140,339,744,132,24,'#380c2b',p.gold,7);
    text(c,'GRAND JACKPOT',512,383,34,p.gold);
    text(c,'$125,640.32',512,449,64,'#fff5ca');
    const awards=[['MAJOR','$18,750'],['MINOR','$2,500'],['MINI','$500']];
    awards.forEach(([name,value],i)=>{let x=115+i*275;round(c,x,498,245,94,14,'#11152c',i===0?p.gold:i===1?p.blue:p.glow,5);text(c,name,x+122,534,24,p.gold);text(c,value,x+122,570,34,'#ffffff');});
    return cv;
  };
  const reelSymbol=(c,x,y,w,h,id)=>{
    const colors=['#f04b60','#f5c857','#43d2f1','#a47cf7','#62e38c'];
    round(c,x,y,w,h,15,'#1a102d',p.gold,3);
    c.save();c.shadowColor=colors[id%5];c.shadowBlur=18;
    const symbol=['7','♛','♦','★','♣'][id%5];
    text(c,symbol,x+w/2,y+h*.69,Math.round(h*.67),colors[id%5]);
    c.restore();
  };
  const reels=()=>{
    const [cv,c]=canvas(1024,1200);background(c,1024,1200);
    text(c,p.subtitle,512,118,61,p.gold);
    text(c,'WIN UP TO 10,000×',512,171,30,'#ffffff');
    round(c,63,226,898,706,20,'#090b1d',p.gold,9);
    for(let row=0;row<3;row++)for(let col=0;col<5;col++)
      reelSymbol(c,86+col*173,249+row*220,160,202,(row*3+col*7+col*row)%5);
    round(c,108,972,808,135,20,'#270d36',p.glow,6);
    text(c,'CREDITS   10,000',320,1024,30,'#ffe4ab');
    text(c,'BET   100',745,1024,30,'#ffe4ab');
    text(c,'GOOD LUCK!',512,1080,42,p.gold);
    return cv;
  };
  for(const [name,draw] of [['TOPPER-CURVED_SCREEN_SWAP_MATERIAL',topper],['MAIN_REELS-CURVED_SCREEN_SWAP_MATERIAL',reels]]){
    const mesh=station.getObjectByName(name);
    if(!mesh)throw new Error('Missing slot display '+name);
    const texture=new THREE.CanvasTexture(draw());
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;
    texture.wrapS=THREE.ClampToEdgeWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;
    const old=mesh.material;
    mesh.material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false});
    if(old?.dispose)old.dispose();
    textures.push(texture);
  }
  station.userData.screenArtTheme=theme;
  station.userData.disposeScreenArt=()=>{for(const t of textures)t.dispose();};
  return station;
}
