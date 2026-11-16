/**
 * Velvet Ace | Casino-hardware hero cabinet study, original geometry by ChatGPT.
 * Art-only THREE.Group factory. No gameplay, odds, winnings or player save changes.
 * Use as a one-machine visual pilot, not an automatic replacement for existing machines.
 *
 * Scale: meters, Y up, face +Z, footprint 1.10 x 0.95, height ~2.9.
 * 25 named REEL_col_row_SWAP_TEXTURE meshes stay independently discoverable.
 * No proprietary casino brands, titles from the existing Velvet Ace game only.
 */
export const HERO_THEMES=Object.freeze({
 sevens:{name:'LUCKY SEVENS',accent:0xffbc52,body:0x30101e,secondary:0x912f45},
 lanterns:{name:'LUCKY LANTERNS',accent:0xf6b661,body:0x44141d,secondary:0xb7352d},
 pharaoh:{name:"PHARAOH'S GOLD",accent:0xf1c969,body:0x14253e,secondary:0x2d6988},
 ocean:{name:'DEEP BLUE',accent:0x71e5ff,body:0x063846,secondary:0x0c80a4},
 goldrush:{name:'GOLD RUSH',accent:0xf3bc60,body:0x382519,secondary:0x81532b},
 dragon:{name:"DRAGON'S HOARD",accent:0xff785b,body:0x300c1d,secondary:0x8a2041},
 empire:{name:'DIAMOND EMPIRE',accent:0xd7b8ff,body:0x242242,secondary:0x574882},
 thunder:{name:'THUNDER PEAK',accent:0x83cfff,body:0x0b253d,secondary:0x296daa},
 tiger:{name:"TIGER'S TREASURE",accent:0xffc66a,body:0x31291d,secondary:0x947131},
 cosmic:{name:'COSMIC FORTUNE',accent:0xfb98fc,body:0x23103d,secondary:0x7048af},
});
const m=(T,color,metalness=0,roughness=.48,emissive=0,emissiveIntensity=0)=>
 new T.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity});
function cuboid(T,parent,name,pos,dim,mat){
 const mesh=new T.Mesh(new T.BoxGeometry(...dim),mat);
 mesh.position.set(...pos);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function sculpt(T,parent,name,at,dim,radius,material,depthBevel=.009){
 const [w,h,d]=dim,rx=Math.min(radius,w*.45,h*.45),x=w/2,y=h/2;
 const path=new T.Shape();
 path.moveTo(-x+rx,-y);path.lineTo(x-rx,-y);path.quadraticCurveTo(x,-y,x,-y+rx);
 path.lineTo(x,y-rx);path.quadraticCurveTo(x,y,x-rx,y);
 path.lineTo(-x+rx,y);path.quadraticCurveTo(-x,y,-x,y-rx);
 path.lineTo(-x,-y+rx);path.quadraticCurveTo(-x,-y,-x+rx,-y);
 const mesh=new T.Mesh(new T.ExtrudeGeometry(path,{
   depth:d,steps:1,curveSegments:7,bevelEnabled:true,bevelThickness:depthBevel,
   bevelSize:depthBevel,bevelSegments:2
 }),material);
 mesh.position.set(at[0],at[1],at[2]-d/2);
 mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function sphere(T,parent,name,pos,r,mat,scale){
 const mesh=new T.Mesh(new T.SphereGeometry(r,10,8),mat);
 mesh.position.set(...pos);if(scale)mesh.scale.set(...scale);mesh.name=name;parent.add(mesh);return mesh;
}
function tube(T,parent,name,path,r,mat){
 const curve=new T.CatmullRomCurve3(path.map(p=>new T.Vector3(...p)));
 const mesh=new T.Mesh(new T.TubeGeometry(curve,Math.max(10,path.length*6),r,6,false),mat);
 mesh.name=name;parent.add(mesh);return mesh;
}
function badgeTexture(T,title,accent){
 if(typeof document==='undefined')return null; // model is still viewable in headless tooling.
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=384;
 const c=canvas.getContext('2d');if(!c)return null;
 const hex='#'+accent.toString(16).padStart(6,'0');
 const bg=c.createLinearGradient(0,0,1024,384);
 bg.addColorStop(0,'#070a17');bg.addColorStop(.48,'#30203b');bg.addColorStop(1,'#070a17');
 c.fillStyle=bg;c.fillRect(0,0,1024,384);
 c.strokeStyle=hex;c.lineWidth=13;c.strokeRect(20,20,984,344);
 c.strokeStyle='#f9ecc9';c.lineWidth=3;c.strokeRect(37,37,950,310);
 for(let k=0;k<72;k++){
   const x=45+(k*139)%940,y=45+(k*103)%285;
   c.fillStyle=k%5?'rgba(255,238,194,.28)':hex;
   c.beginPath();c.arc(x,y,1.4+(k%3),0,Math.PI*2);c.fill();
 }
 c.fillStyle='#fbe8c5';c.textAlign='center';c.shadowColor=hex;c.shadowBlur=26;
 const fs=title.length>13?74:96;
 c.font='900 '+fs+'px Georgia, serif';
 c.fillText(title,512,206,930);
 c.shadowBlur=0;c.fillStyle=hex;c.font='700 26px sans-serif';
 c.fillText('VELVET ACE  •  VIRTUAL CHIP ENTERTAINMENT',512,286);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 texture.anisotropy=2;texture.needsUpdate=true;
 return texture;
}
function bonusSignTexture(T,accent){
 if(typeof document==='undefined')return null;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=160;
 const ctx=canvas.getContext('2d');if(!ctx)return null;
 const hex='#'+accent.toString(16).padStart(6,'0');
 const grad=ctx.createLinearGradient(0,0,0,160);
 grad.addColorStop(0,'#101024');grad.addColorStop(1,'#03050e');
 ctx.fillStyle=grad;ctx.fillRect(0,0,512,160);
 ctx.strokeStyle=hex;ctx.lineWidth=6;ctx.strokeRect(7,7,498,146);
 ctx.strokeStyle='#eeeeee';ctx.lineWidth=1.5;ctx.strokeRect(18,18,476,124);
 ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.font='900 90px Arial, sans-serif';
 ctx.shadowColor=hex;ctx.shadowBlur=12;ctx.fillStyle=hex;
 ctx.fillText('BONUS',256,84,450);
 ctx.shadowBlur=0;ctx.font='bold 18px Arial, sans-serif';
 ctx.fillStyle='#eee8e1';ctx.fillText('FEATURE GAME',256,136);
 const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.needsUpdate=true;
 return tex;
}
export function makeVelvetHeroCabinet(T,id='sevens'){
 const theme=HERO_THEMES[id];if(!theme)throw Error('Unknown hero theme: '+id);
 const g=new T.Group();g.name='VA_HeroSlot_'+id;
 const black=m(T,0x07090e,.20,.20),chassis=m(T,0x141921,.80,.23);
 const body=m(T,0x090b11,.56,.13),side=m(T,0x0b0c13,.62,.16);
 const chrome=m(T,0x9baac0,.95,.15),accent=m(T,theme.accent,.16,.19,theme.accent,2.1);
 // Pure theme-color HDR glow avoids the pale gold wash from strong specular reflection.
 const signGlow=new T.MeshBasicMaterial({color:theme.accent,toneMapped:false});
 const darkGlass=m(T,0x060811,.24,.10),screen=m(T,0x131225,.08,.24,0x17152a,1.8);
 const bronze=m(T,0x986b4d,.72,.26),button=m(T,0x6dffdb,.2,.23,0x18b488,2.6);
 // Physically heavy recessed base, kicked-back toe area, separate side shell.
 sculpt(T,g,'floor_plinth',[0,.105,-.045],[1.09,.21,.78],.09,black);
 sculpt(T,g,'toe_kick',[0,.27,.29],[.88,.18,.23],.06,chassis);
 sculpt(T,g,'upright_rear_housing',[0,1.30,-.08],[1.04,1.98,.71],.20,chassis);
 sculpt(T,g,'lacquered_side_panel',[0,1.35,.27],[.98,1.91,.11],.16,body);
 // Side caps give a proper physical depth silhouette in a three-quarter view.
 for(const x of [-.505,.505]){
   sculpt(T,g,'curved_side_pod',[x,1.38,.20],[.11,2.00,.51],.05,side);
   tube(T,g,'LED_side_light',[
    [x, .44,.45],[x, .63,.49],[x,1.50,.50],[x,2.22,.42],[x,2.36,.22]
   ],.0125,accent);
 }
 // Tall upper jackpot/top-box is its own deep mounted piece.
 sculpt(T,g,'topbox_spine',[0,2.43,-.19],[1.08,.81,.57],.15,chassis);
 sculpt(T,g,'topbox_illuminated_outer',[0,2.49,.18],[1.05,.68,.14],.13,accent);
 sculpt(T,g,'topbox_bezel',[0,2.49,.265],[.985,.60,.09],.11,chrome);
 sculpt(T,g,'topbox_glass',[0,2.49,.316],[.925,.545,.025],.09,darkGlass);
 const titleTexture=badgeTexture(T,theme.name,theme.accent);
 if(titleTexture){
   const screenMat=new T.MeshBasicMaterial({map:titleTexture,toneMapped:false});
   // The front face is the positive-Z side of this thin box.
   cuboid(T,g,'marquee_world_texture_target',[0,2.49,.343],[.89,.51,.007],screenMat);
 }
 for(const x of [-.39,.39])sphere(T,g,'topbox_lamp',[x,2.87,.19],.044,accent);
 // Curved portrait-screen assembly, canted backward by ~7 degrees.
 const display=new T.Group();display.name='angled_portrait_display';
 display.position.set(0,1.42,.38);display.rotation.x=-.115;g.add(display);
 sculpt(T,display,'display_gasket',[0,0,.015],[1.04,1.70,.13],.12,black);
 sculpt(T,display,'display_bright_bezel',[0,0,.087],[.985,1.65,.09],.105,accent);
 sculpt(T,display,'display_glass',[0,0,.143],[.925,1.59,.035],.085,darkGlass);
 // Art-only BONUS marquee: lifted away from row zero and kept out of reel atlas space.
 // Top row extends to y=.445; header ends at y=.480, leaving .035m physical clearance.
 // No emissive lower separator at the boundary: bloom must not wash out symbols.
 sculpt(T,display,'bonus_header_recess',[0,.647,.166],[.89,.334,.016],.043,black);
 sculpt(T,display,'bonus_header_illuminated_frame',[0,.647,.185],[.86,.314,.015],.039,accent);
 sculpt(T,display,'bonus_header_dark_screen',[0,.647,.199],[.806,.275,.012],.033,darkGlass);
 const bonusTexture=bonusSignTexture(T,theme.accent);
 if(bonusTexture){
   const sign=new T.MeshBasicMaterial({map:bonusTexture,toneMapped:false});
   const signFace=cuboid(T,display,'bonus_header_world_texture_target',[0,.647,.211],[.75,.246,.005],sign);
   // Texture itself contains readable theme-colour type. Do not mark the whole
   // rectangle HDR-glow: selective bloom would blur the lettering.
   signFace.userData={bonusSign:true,glow:false};
 }
 // Tiny isolated lamps are deliberately above the header, away from reel row 0.
 for(const [i,x] of [-.34,.34].entries()){
   const lamp=sphere(T,display,'bonus_side_lamp_'+i,[x,.762,.218],.014,signGlow,[1,1,.45]);
   lamp.userData={glow:true,glowRole:'bonus-sign'};
 }
 // Square 5x5 reel targets match the square symbol atlas without vertical stretching.
 // 5x5 live reel targets: do not bake symbols into cabinet geometry.
 // Names preserved exactly for engineering's cell-group batching and atlas mapping.
 const reelNames=[];
 for(let col=0;col<5;col++)for(let row=0;row<5;row++){
   const target=cuboid(T,display,`REEL_${col}_${row}_SWAP_TEXTURE`,
     [-.360+col*.18,.36-row*.18,.172],[.171,.171,.006],screen);
   target.userData={col,row,display:'reel-5x5'};
   reelNames.push(target.name);
 }
 // Curved glass silhouette edging and physical vent/speaker details.
 tube(T,display,'glass_outer_inlay',[
  [-.46,-.79,.158],[-.47,-.25,.17],[-.47,.34,.17],[-.43,.79,.162],
  [.43,.79,.162],[.47,.34,.17],[.47,-.25,.17],[.46,-.79,.158]
 ],.012,chrome);
 for(const sx of [-.405,.405])for(let i=0;i<6;i++)
    cuboid(T,g,'speaker_grille',[sx,.45+i*.028,.54],[.035,.007,.012],black);
 // Angled player console, with its own display surface and thick wrist-rest.
 const deck=new T.Group();deck.name='canted_control_deck';deck.position.set(0,.53,.525);
 deck.rotation.x=-.29;g.add(deck);
 sculpt(T,deck,'control_deck_shell',[0,0,0],[1.01,.32,.31],.08,chassis);
 sculpt(T,deck,'control_deck_trim',[0,.012,.158],[.92,.265,.036],.055,chrome);
 sculpt(T,deck,'control_touchscreen',[0,.015,.182],[.84,.22,.012],.05,darkGlass);
 for(const [i,x] of [-.31,-.13,.05].entries())
   sphere(T,deck,'physical_console_switch_'+i,[x,-.092,.205],.032,bronze,[1,.35,1]);
 sphere(T,deck,'spin_button',[.32,.07,.218],.068,button,[1,.35,1]);
 // Authentic cash/ticket port is a prop ONLY, no real-money feature.
 sculpt(T,g,'ticket_acceptor_housing',[-.27,.355,.458],[.34,.09,.052],.022,chrome);
 cuboid(T,g,'ticket_slot_opening',[-.27,.359,.496],[.22,.011,.006],black);
 sculpt(T,g,'service_panel',[0,.29,.384],[.67,.18,.05],.036,side);
 cuboid(T,g,'service_lock',[.32,.29,.416],[.032,.032,.016],bronze);
 // Side-view finishing / plinth illumination.
 for(const x of [-.47,.47])
   tube(T,g,'base_fibre_optic',[[x,.15,-.26],[x,.15,.11],[x,.20,.30]],.012,accent);

 // Independent stacked top sign and neon spine. Lighting is authored for Claude's bloom pass.
 sculpt(T,g,'stacked_jackpot_crown_housing',[0,3.015,-.18],[.94,.30,.38],.08,chassis);
 sculpt(T,g,'stacked_jackpot_crown_glow',[0,3.035,.041],[.87,.22,.035],.05,accent);
 sculpt(T,g,'stacked_jackpot_crown_dark_center',[0,3.035,.064],[.76,.14,.008],.025,darkGlass);
 // Three distinct bright lozenges replace the blank crown plaque with an illuminated sign.
 for(const [i,x] of [-.22,0,.22].entries()){
   const o=sphere(T,g,'crown_lit_gem_'+i,[x,3.036,.077],.049,signGlow,[1.25,.74,.24]);
   o.userData={glow:true,glowRole:'crown-sign'};
 }
 for(const x of [-.51,.51])
   tube(T,g,'neon_vertical_spine',[[x,.48,.47],[x,.80,.52],[x,1.65,.53],[x,2.20,.43],[x,2.80,.31]],.018,accent);
 g.traverse(obj=>{
   if(obj.isMesh && /LED_|neon_|fibre_optic|topbox_illuminated|topbox_lamp|jackpot_crown_glow|display_bright_bezel|spin_button|marquee_world_texture_target/.test(obj.name)){
     obj.userData.glow=true;obj.userData.glowRole='casino-hardware';
   }
 });
 g.userData={
   asset:'VA_HeroCabinet_Pilot',artOnly:true,theme:id,meters:true,
   upAxis:'Y',forward:'+Z',approxHeight:3.17,bonusHeader:'glow-tagged non-monetary bonus sign',footprint:{width:1.10,depth:.95},
   reelTargets:reelNames,reelRows:5,reelColumns:5,
   /* The title art texture is for artistic preview; dispose it with the scene. */
   createdTitleTexture:titleTexture,createdBonusTexture:bonusTexture,
 };
 return g;
}
