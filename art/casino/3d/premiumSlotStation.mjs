/**
 * Velvet Ace / ORIGINAL premium dual-display slot station visual study.
 * Standalone, opt-in only. Uses host THREE; no game state or production changes.
 * +Z faces player. Units meters. Screens are named for future dynamic art mapping.
 * Not a photoreal model: procedural geometry with PBR materials, designed for
 * high-quality texture replacement and close-up visual review before integration.
 */
export function createPremiumSlotStation(THREE, {accent=0x08d6f0, secondary=0xf82b9a, withChair=true}={}) {
  const T=THREE, root=new T.Group(); root.name='VA_PremiumDualScreen_VisualPilot';
  const mat=(color,metalness=0,roughness=.38,emissive=0,intensity=0)=>new T.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity:intensity,side:T.DoubleSide});
  const black=mat(0x090d15,.38,.23), side=mat(0x1c2331,.72,.26), chrome=mat(0xa8aeb8,.95,.17),
    bronze=mat(0xa88556,.83,.26), glow=mat(accent,.16,.27,accent,2.4), glow2=mat(secondary,.1,.32,secondary,1.9),
    screen=mat(0x080b1d,.05,.11), leather=mat(0x281b2d,.04,.78), stitch=mat(0xc9a87c,.18,.6);
  const add=(name,geo,material,x,y,z,parent=root)=>{const o=new T.Mesh(geo,material);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const box=(n,w,h,d,x,y,z,m)=>add(n,new T.BoxGeometry(w,h,d),m,x,y,z);
  const cylinder=(n,rt,rb,h,x,y,z,m,s=20)=>add(n,new T.CylinderGeometry(rt,rb,h,s),m,x,y,z);
  const rounded=(n,w,h,depth,r,x,y,z,m)=>{
    const s=new T.Shape(), a=-w/2,b=-h/2;
    s.moveTo(a+r,b);s.lineTo(-a-r,b);s.quadraticCurveTo(-a,b,-a,b+r);
    s.lineTo(-a,-b-r);s.quadraticCurveTo(-a,-b,-a-r,-b);
    s.lineTo(a+r,-b);s.quadraticCurveTo(a,-b,a,-b-r);
    s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);
    return add(n,new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:3,curveSegments:9}),m,x,y,z-depth/2);
  };
  // Tall sculpted body, deep enough to read as actual casino hardware.
  box('heavy-pedestal',.82,.36,.84,0,.19,-.13,black);
  rounded('tapered-lower-cabinet',.86,1.16,.68,.15,0,.95,-.17,side);
  rounded('full-height-rear-shell',.94,2.38,.46,.18,0,1.63,-.32,black);
  for(const x of [-.47,.47]){
    rounded('continuous-polished-side-spine',.055,2.32,.50,.02,x,1.64,-.23,chrome);
    rounded('separated-neon-channel',.019,2.19,.055,.009,x,1.65,.045,x<0?glow:glow2);
  }
  // Two curved displays, each with physical depth, bezel and glass, rather than a flat painted box.
  const curvedDisplay=(label,cy,h)=>{
    rounded(label+'-metal-bezel',.89,h+.10,.19,.10,0,cy,.065,chrome);
    rounded(label+'-black-gasket',.84,h+.055,.17,.09,0,cy,.177,black);
    // Slight cylindrical bow across screen: segment geometry creates visible curved glass.
    const radius=1.65,theta=.49;
    const g=new T.CylinderGeometry(radius,radius,h,32,1,true,-Math.PI/2-theta/2,theta);
    const glass=add(label+'-CURVED_SCREEN_SWAP_MATERIAL',g,screen,0,cy,.16);
    glass.rotation.y=Math.PI;glass.userData={displayRole:label,replaceMaterial:true};
    rounded(label+'-top-LED',.82,.016,.018,.008,0,cy+h/2+.033,.202,glow2);
    rounded(label+'-bottom-LED',.82,.016,.018,.008,0,cy-h/2-.033,.202,glow);
  };
  curvedDisplay('TOPPER',2.33,.55);
  curvedDisplay('MAIN_REELS',1.44,1.04);
  // Physical control deck slants toward the player. Real buttons and player card reader.
  const deck=rounded('angled-control-deck',.84,.28,.45,.075,0,.77,.35,side);
  deck.rotation.x=-.48;
  const deckGlass=rounded('control-deck-glass',.76,.18,.025,.045,0,.79,.605,black);deckGlass.rotation.x=-.48;
  for(let i=0;i<5;i++){
    const x=(i-2)*.135;
    const btn=cylinder('physical-illuminated-button-'+(i+1),.043,.049,.022,x,.82,.64,i===4?glow2:glow,16);
    btn.rotation.x=Math.PI/2-.48;
    cylinder('button-metal-rim-'+(i+1),.051,.052,.012,x,.808,.632,chrome,16).rotation.x=Math.PI/2-.48;
  }
  box('ticket-printer-slot',.20,.016,.012,-.24,.60,.40,black);
  box('player-card-reader',.18,.055,.06,.27,.62,.45,chrome);
  rounded('cash-door',.36,.20,.015,.025,0,.35,.255,black);
  box('cash-door-handle',.13,.018,.03,0,.35,.285,chrome);
  // Small perforated speaker banks: distinct physical hardware.
  for(const x of [-.35,.35])for(let i=0;i<5;i++)
    cylinder('speaker-grille-hole',.007,.007,.003,x,2.72+i*.028,.005,black,8).rotation.x=Math.PI/2;
  // Upholstered adjustable chair, not a featureless cube.
  if(withChair){
    const chair=new T.Group();chair.name='matching-padded-casino-chair';chair.position.set(0,0,1.12);root.add(chair);
    const ch=(n,g,m,x,y,z)=>add(n,g,m,x,y,z,chair);
    ch('weighted-chrome-chair-base',new T.CylinderGeometry(.29,.33,.055,24),chrome,0,.07,0);
    ch('chair-pedestal',new T.CylinderGeometry(.055,.075,.52,16),chrome,0,.34,0);
    ch('seat-underpan',new T.CylinderGeometry(.31,.29,.07,24),black,0,.61,0);
    ch('deep-cushioned-seat',new T.SphereGeometry(.34,24,12),leather,0,.69,0).scale.set(1,.22,.83);
    ch('chair-back-frame',new T.BoxGeometry(.63,.68,.105),chrome,0,1.06,.25);
    ch('contoured-leather-back',new T.SphereGeometry(.34,24,16),leather,0,1.08,.34).scale.set(.94,1.07,.24);
    for(const x of [-.23,.23]){
      ch('padded-chair-arm',new T.BoxGeometry(.105,.08,.36),leather,x,.91,.06);
      ch('chrome-arm-support',new T.CylinderGeometry(.018,.018,.28,10),chrome,x,.76,.06);
      for(let i=0;i<5;i++)ch('chair-upholstery-stitch',new T.SphereGeometry(.005,6,4),stitch,x,1.0+i*.07,.41);
    }
  }
  root.userData={artPilot:true,front:'+Z',width:.98,depth:withChair?1.85:1.0,height:2.93,
    screenMeshNames:['TOPPER-CURVED_SCREEN_SWAP_MATERIAL','MAIN_REELS-CURVED_SCREEN_SWAP_MATERIAL'],
    note:'Visual quality pilot only. Replace screens with authored textures; confirm glass UV, clearance, camera and realistic render before using as default.',
    dispose(){root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});}};
  return root;
}
