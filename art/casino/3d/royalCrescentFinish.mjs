/**
 * Royal Crescent v2 material and display pass for the clean-sheet GLB.
 * Opt-in art adapter only; never touches game state or the 38 live cabinets.
 * Usage: applyRoyalCrescentFinish(THREE, loadedGltf.scene, {theme:'royal'});
 * Dispose returned textures/materials when discarding preview.
 */
export function applyRoyalCrescentFinish(THREE, root, {theme='royal'}={}) {
  if (!root?.traverse) throw new TypeError('Expected a loaded glTF scene');
  const owned=[];
  const palette={
    royal:{title:'ROYAL FORTUNE',subtitle:'VELVET ACE',symbols:['♠','7','♛','♦','★'],bg:'#251036',light:'#ffc66e'},
    dragon:{title:'DRAGON FIRE',subtitle:'LEGENDARY REELS',symbols:['🐉','7','🔥','♦','★'],bg:'#3b101b',light:'#ffaf5e'},
    ocean:{title:'DEEP TREASURE',subtitle:'OCEAN RICHES',symbols:['⚓','7','🐚','💎','★'],bg:'#092c48',light:'#65e5ef'}
  };
  const p=palette[theme]||palette.royal;
  const material=(color,metalness,roughness,extra={})=>{
    const m=new THREE.MeshStandardMaterial({color,metalness,roughness,...extra});owned.push(m);return m;
  };
  const lacquer=material('#090e18',.42,.19);
  const shadowMetal=material('#252d38',.68,.34);
  const brass=material('#d9aa58',.88,.22);
  const gold=material('#f1c77c',.75,.25);
  const leather=material('#542039',.06,.8,{side:THREE.DoubleSide});
  const welt=material('#a45a65',.12,.69);
  const glass=material('#071522',.16,.12,{side:THREE.DoubleSide});
  const led=material('#47bbef',.08,.33,{emissive:'#1578c2',emissiveIntensity:.65});
  const dark=material('#080a0d',.15,.68);
  const screenMeshes=[];
  root.traverse(o=>{
    if(!o.isMesh)return;
    // Exported source geometry lacks normals; generate them for correct PBR response.
    if(!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    const n=o.name.toLowerCase();
    if(n.includes('curved_display')) {screenMeshes.push(o);return;}
    if(n.includes('upholstery')||n.includes('tufted')||n.includes('padded_arm'))o.material=leather;
    else if(n.includes('welt'))o.material=welt;
    else if(n.includes('diffused_accent')||n.includes('button_lens'))o.material=led;
    else if(n.includes('black_glass')||n.includes('ticket_exit')||n.includes('inner_gasket'))o.material=glass;
    else if(n.includes('speaker_port'))o.material=dark;
    else if(n.includes('brass')||n.includes('champagne')||n.includes('bezel')||n.includes('trim')||n.includes('inlay')||n.includes('badge')||n.includes('toe')||n.includes('button_'))o.material=brass;
    else if(n.includes('deck')||n.includes('pedestal')||n.includes('support')||n.includes('core')||n.includes('underframe'))o.material=shadowMetal;
    else o.material=lacquer;
    o.castShadow=true;o.receiveShadow=true;
  });
  // The original GLB exports POSITION + COLOR_0 but no UV. Project each curved
  // display's local XY coordinates to UV. Screen is physically bowed in Z.
  const makeScreen=(upper)=>{
    if(typeof document==='undefined')return null;
    const c=document.createElement('canvas');c.width=1024;c.height=upper?640:1100;
    const x=c.getContext('2d');if(!x)return null;
    const g=x.createLinearGradient(0,0,1024,c.height);
    g.addColorStop(0,'#070c18');g.addColorStop(.5,p.bg);g.addColorStop(1,'#080916');
    x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
    x.strokeStyle=p.light;x.lineWidth=13;x.strokeRect(20,20,984,c.height-40);
    x.textAlign='center';x.shadowColor=p.light;x.shadowBlur=24;
    x.fillStyle=p.light;x.font='bold 72px Georgia,serif';
    x.fillText(upper?'VELVET ACE':p.title,512,upper?130:105);
    x.shadowBlur=0;x.fillStyle='#f7e9bd';
    if(upper){
      x.font='bold 92px Georgia,serif';x.fillText(p.title,512,285);
      x.fillStyle=p.light;x.font='bold 42px Arial';x.fillText('GRAND JACKPOT',512,390);
      x.font='bold 76px Arial';x.fillText('$125,640.32',512,500);
    }else{
      const rows=3,cols=5,left=57,top=180,cw=182,ch=235;
      for(let r=0;r<rows;r++)for(let j=0;j<cols;j++){
        const bx=left+j*cw,by=top+r*ch;
        x.fillStyle='#10152c';x.fillRect(bx,by,cw-10,ch-12);
        x.strokeStyle=p.light;x.lineWidth=4;x.strokeRect(bx,by,cw-10,ch-12);
        x.fillStyle=r===1?'#ffd58c':'#f6f0d9';x.font='bold 105px Georgia,serif';
        x.fillText(p.symbols[(j+r*2)%p.symbols.length],bx+(cw-10)/2,by+147);
      }
      x.fillStyle=p.light;x.font='bold 35px Arial';
      x.fillText('CREDITS  12,500        BET  50        GOOD LUCK',512,1010);
    }
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=4;owned.push(t);return t;
  };
  for(const mesh of screenMeshes){
    const pos=mesh.geometry.getAttribute('position');
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    const uv=new Float32Array(pos.count*2);
    for(let i=0;i<pos.count;i++){uv[2*i]=(pos.getX(i)-minX)/(maxX-minX||1);uv[2*i+1]=(pos.getY(i)-minY)/(maxY-minY||1);}
    mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const texture=makeScreen(mesh.name.toLowerCase().includes('upper'));
    mesh.material=texture?new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false}):glass;
    if(texture)owned.push(mesh.material);
  }
  return {screens:screenMeshes.length,dispose(){for(const x of owned)x.dispose();}};
}
