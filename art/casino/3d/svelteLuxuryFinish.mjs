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
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0ac4e, metalness: .88, roughness: .21 });
  const velvet = new THREE.MeshStandardMaterial({ color: 0x451325, metalness: .08, roughness: .73 });
  const glowColor = options.ledColor ?? 0x9a43ff;
  const light = new THREE.MeshStandardMaterial({
    color: glowColor, emissive: glowColor, emissiveIntensity: 2.1,
    metalness: .04, roughness: .42
  });
  const makeTube = (name, pts, radius, material, glow = false) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 4, false), material);
    mesh.name = name;
    if (glow) mesh.userData.glow = true;
    finish.add(mesh);
    return mesh;
  };
  // Reference-inspired gold-and-violet front display bezel. A pair of thin
  // physical ribbons follows the actual front S-profile and portrait glass
  // bow; neither covers the active 5x5 reel area (|x| <= .244).
  const faceProfile = [
    [.13,-.105],[.27,-.095],[.43,-.075],[.64,-.045],
    [.85,-.020],[1.12,.015],[1.42,.055],[1.72,.070],
    [1.95,.055],[2.09,.025]
  ];
  const faceZ = y => {
    for (let i = 1; i < faceProfile.length; i++) {
      if (y <= faceProfile[i][0]) {
        const a = faceProfile[i-1], b = faceProfile[i];
        const t = Math.max(0, Math.min(1,(y-a[0])/(b[0]-a[0])));
        const q = t*t*(3-2*t);
        return a[1] + (b[1]-a[1])*q;
      }
    }
    return faceProfile.at(-1)[1];
  };
  for (const sign of [-1, 1]) {
    const goldPath = [], violetPath = [];
    for (let i = 0; i <= 36; i++) {
      const y = .76 + i * 1.20 / 36;
      goldPath.push([sign*.275,y,faceZ(y)+.082]);
      violetPath.push([sign*.266,y,faceZ(y)+.092]);
    }
    makeTube(sign < 0 ? 'photo_bezel_left_gold' : 'photo_bezel_right_gold',goldPath,.0055,gold);
    makeTube(sign < 0 ? 'photo_bezel_left_violet' : 'photo_bezel_right_violet',violetPath,.003,light,true);
  }
  // Curved header and sill close the continuous portrait frame.
  for (const [name,y] of [['photo_bezel_header',1.963],['photo_bezel_sill',.755]]) {
    const path=[];
    for (let j=0;j<=20;j++) {
      const x=-.275+j*.55/20, u=x/.275;
      path.push([x,y,faceZ(y)+.082+.018*(1-u*u)]);
    }
    makeTube(name,path,.0055,gold);
  }
  // Brushed-gold perimeter to the player-facing control shelf.
  // Preserve the existing buttons and deck for gameplay hit targets.
  const controlRim = new THREE.Mesh(
    new THREE.TorusGeometry(.287,.006,6,48),gold);
  controlRim.name='photo_control_deck_gold_perimeter';
  controlRim.rotation.x=Math.PI/2;
  controlRim.scale.y=.58;
  controlRim.position.set(0,.765,.245);
  finish.add(controlRim);
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
  // Sample the cabinet's actual rear hull surface (a ray from behind), so the finish stays seated when
  // the cabinet profile changes (VA-0145 flattened the back to rearZ = -0.305). The formula below is the
  // pre-VA-0145 profile, kept only as a fallback if the hull mesh is missing or the ray misses.
  const hullMesh = cabinet.getObjectByName('continuous_sculpted_S_curve_hull');
  const ray = new THREE.Raycaster();
  if (hullMesh) cabinet.updateMatrixWorld(true);
  const toLocal = hullMesh ? new THREE.Matrix4().copy(cabinet.matrixWorld).invert() : null;
  const hullBackZ = (y, x) => {
    if (!hullMesh) return null;
    const o = new THREE.Vector3(x, y, -5).applyMatrix4(cabinet.matrixWorld);
    const d = new THREE.Vector3(0, 0, 1).transformDirection(cabinet.matrixWorld);
    ray.set(o, d);
    const hit = ray.intersectObject(hullMesh, false)[0];
    return hit ? hit.point.clone().applyMatrix4(toLocal).z : null;
  };
  const backZ = (y, x = 0) => {
    const sampled = hullBackZ(y, x);
    if (sampled !== null) return sampled - .012;
    const flare = Math.max(0, 1 - y / .42);
    const halfWidth = .29 + .015 * flare;
    const depth = .19 + .035 * flare;
    const lateral = Math.min(.99, Math.abs(x) / halfWidth);
    return forward(y) - .15 - .07 * flare - depth * Math.sqrt(1 - lateral * lateral) - .012;
  };
  // Slim, rear burgundy fabric panel with rounded elliptical cross-section.
  const positions = [], uvs = [], indices = [];
  const rows = 28, cols = 12, y0 = .28, y1 = 1.93;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, y = y0 + t * (y1-y0);
    for (let j = 0; j <= cols; j++) {
      const u = j / cols, x = (u*2-1)*.18;
      const z = backZ(y, x);
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
    const seam = [];
    for (let i=0;i<=40;i++) {
      const y=.28+i*(1.65/40);
      seam.push([sign*.185,y,backZ(y)+.025]);
    }
    makeTube(sign<0?'rear_left_gold_pinstripe':'rear_right_gold_pinstripe',seam,.0035,gold);
    // Existing cabinet swept LEDs remain the single light line per flank.
  }
  // The cabinet already has a chrome shoe edge; avoid a detached second hoop.
  // Put the emissive lip just OUTSIDE the 0.27 m shoe, above the floor.
  const lip = new THREE.Mesh(new THREE.TorusGeometry(.278, .004, 4, 32), light);
  lip.name = 'underglow';
  lip.rotation.x = Math.PI / 2;
  // Match the island shoe's compressed Z footprint.
  lip.scale.y = 0.72;
  lip.position.set(0, .018, -.105);
  lip.userData.glow = true;
  finish.add(lip);
  // Small gold medallion on rear velvet, visibly separate from reel-screen glass.
  const medallion=new THREE.Mesh(new THREE.CylinderGeometry(.073,.073,.008,16),gold);
  medallion.name='rear_ace_medallion';
  medallion.rotation.x=Math.PI/2;
  medallion.position.set(0,1.44,backZ(1.44)-.018);
  finish.add(medallion);
  finish.userData={artOnly:true,optional:true,finish:'burgundy-polished-gold-violet',
    note:'Procedural material pass, not photorealistic or device verified'};
  return finish;
}
