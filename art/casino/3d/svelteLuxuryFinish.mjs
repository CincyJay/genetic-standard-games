/**
 * Optional original Svelte 01 luxury finish. Art-only overlay; never alters reel UVs,
 * gameplay or the existing cabinet's mesh hierarchy.
 * Call applySvelteLuxuryFinish(THREE, cabinet) after createSvelteSlotCabinet().
 */
export function applySvelteLuxuryFinish(THREE, cabinet, options = {}) {
  if (!cabinet?.isGroup) throw new TypeError('Expected Svelte cabinet Three.Group');
  const finish = new THREE.Group();
  finish.name = 'VA_SVELTE_LUXURY_FINISH';
  cabinet.add(finish);
  const gold = new THREE.MeshStandardMaterial({ color: 0xc4a46b, metalness: .8, roughness: .32 });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x321324, metalness: .04, roughness: .94 });
  const glowColor = options.ledColor ?? 0x6bdcf5;
  const light = new THREE.MeshStandardMaterial({
    color: glowColor, emissive: glowColor, emissiveIntensity: 2.1,
    metalness: .04, roughness: .42
  });
  const makeTube = (name, pts, radius, material, glow = false) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 56, radius, 6, false), material);
    mesh.name = name;
    if (glow) mesh.userData.glow = true;
    finish.add(mesh);
    return mesh;
  };
  // Rear shell centre follows the actual S-curve. Surface sits just behind hull,
  // without relying on external textures or obscuring the 5x5 screen.
  const profile = [
    [.13,-.13], [.27,-.11], [.43,-.055], [.64,0], [.85,.035],
    [1.12,.095], [1.42,.16], [1.72,.19], [1.95,.14], [2.09,.075]
  ];
  const forward = y => {
    for (let i = 1; i < profile.length; i++) if (y <= profile[i][0]) {
      const a = profile[i-1], b = profile[i], t = Math.max(0, Math.min(1,(y-a[0])/(b[0]-a[0])));
      const s = t*t*(3-2*t); return a[1]+(b[1]-a[1])*s;
    }
    return profile[profile.length-1][1];
  };
  const backZ = y => forward(y) - .15 - .19 - .006;
  // Slim, rear burgundy fabric panel with rounded elliptical cross-section.
  const positions = [], uvs = [], indices = [];
  const rows = 28, cols = 12, y0 = .28, y1 = 1.93;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, y = y0 + t * (y1-y0);
    for (let j = 0; j <= cols; j++) {
      const u = j / cols, x = (u*2-1)*.18;
      const z = backZ(y) + .10 * (1 - Math.sqrt(Math.max(0, 1-(x/.29)**2)));
      positions.push(x,y,z); uvs.push(u,t);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a=i*(cols+1)+j,b=a+cols+1;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);g.computeVertexNormals();
  const panel = new THREE.Mesh(g,velvet);
  panel.name='rear_burgundy_velvet_inset';panel.material.side=THREE.DoubleSide;
  finish.add(panel);
  for (const sign of [-1,1]) {
    const seam = [], led = [];
    for (let i=0;i<=40;i++) {
      const y=.25+i*(1.75/40);
      const z=forward(y);
      seam.push([sign*.185,y,backZ(y)+.025]);
      // Side light stays outside screen footprint; follows shell curve.
      led.push([sign*.285,y,z-.13]);
    }
    makeTube(sign<0?'rear_left_gold_pinstripe':'rear_right_gold_pinstripe',seam,.0035,gold);
    makeTube(sign<0?'led_left':'led_right',led,.0045,light,true);
  }
  // A restrained gold plinth line and illuminated underglow.
  const ring=(name,radius,y,z,material,glow=false)=>{
    const m=new THREE.Mesh(new THREE.TorusGeometry(radius,.006,6,48),material);
    m.name=name;m.rotation.x=Math.PI/2;m.scale.y=1.10;m.position.set(0,y,z);
    if(glow)m.userData.glow=true;
    finish.add(m);return m;
  };
  ring('gold_plinth_band',.235,.072,-.15,gold);
  ring('underglow',.225,.014,-.15,light,true);
  // Small gold medallion on rear velvet, visibly separate from reel-screen glass.
  const medallion=new THREE.Mesh(new THREE.CylinderGeometry(.073,.073,.008,32),gold);
  medallion.name='rear_ace_medallion';
  medallion.rotation.x=Math.PI/2;
  medallion.position.set(0,1.44,backZ(1.44)-.014);
  finish.add(medallion);
  finish.userData={artOnly:true,optional:true,finish:'burgundy-gold-cyan',
    note:'Procedural material pass, not photorealistic or device verified'};
  return finish;
}
