/**
 * Velvet Ace Svelte mid-distance cabinet art (roughly 6–15 m).
 * Original physical trim layered onto the low-cost, curved far cabinet.
 * Preserves the UV-mapped 5x5 screen and material swap contract.
 * Host owns LOD selection, instancing, screen textures and gameplay.
 */
import { createSvelteSlotCabinetFarLOD } from './svelteSlotCabinetFarLOD.mjs';

export function createSvelteSlotCabinetMidLOD(THREE, options = {}) {
  const group = createSvelteSlotCabinetFarLOD(THREE, options);
  group.name = 'VA_SVELTE_01_MID_LOD';
  const gold = new THREE.MeshStandardMaterial({
    color: 0xc9a052, metalness: .82, roughness: .28
  });
  const violet = options.ledColor ?? 0x8f43f2;
  const glow = new THREE.MeshStandardMaterial({
    color: violet, emissive: violet, emissiveIntensity: 1.7,
    metalness: .08, roughness: .36
  });
  const frontProfile = [
    [.05,-.09],[.42,-.07],[.76,-.03],[1.18,.024],
    [1.66,.069],[2.09,.025]
  ];
  function frontAt(y) {
    for (let i=1;i<frontProfile.length;i++) {
      if (y <= frontProfile[i][0]) {
        const a=frontProfile[i-1], b=frontProfile[i];
        return a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0]);
      }
    }
    return frontProfile.at(-1)[1];
  }
  function strip(name, points, radius, material) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,20,radius,4,false),material);
    mesh.name=name; mesh.castShadow=false; mesh.receiveShadow=true;
    group.add(mesh);
  }
  // Physical gold side rails follow the cabinet's swept profile.
  // Outside the active screen: 0.244m half width.
  for (const sign of [-1,1]) {
    const rail=[], light=[];
    for (let i=0;i<=10;i++) {
      const y=.765+1.19*i/10;
      rail.push([sign*.266,y,frontAt(y)+.088]);
      light.push([sign*.278,y,frontAt(y)+.054]);
    }
    strip(sign<0?'mid_left_gold_rail':'mid_right_gold_rail',rail,.005,gold);
    strip(sign<0?'mid_left_violet_edge':'mid_right_violet_edge',light,.003,glow);
  }
  // Horizontal crown and sill close the portrait display frame.
  for (const [name,y] of [['mid_gold_header',1.955],['mid_gold_sill',.765]]) {
    const pts=[];
    for (let j=0;j<=10;j++) {
      const x=-.266+.532*j/10, u=x/.266;
      pts.push([x,y,frontAt(y)+.087+.03*(1-u*u)]);
    }
    strip(name,pts,.005,gold);
  }
  // Thin player-facing deck ring. No gameplay buttons or hitboxes added.
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.273,.006,4,20),gold);
  rim.name='mid_control_deck_gold_rim';
  rim.rotation.x=Math.PI/2; rim.scale.y=.58;
  rim.position.set(0,.775,.185);
  rim.castShadow=false; group.add(rim);
  group.userData={
    ...group.userData,
    prototype:'Svelte 01 mid LOD',
    approximateWidthM:.59,
    approximateHeightM:2.09,
    screenMaterialName:'VA_SVELTE_REEL_SCREEN_SWAP',
    artOnly:true,
    lodHintMeters:[6,15],
    status:'isolated geometry; not integrated, rendered or device tested'
  };
  return group;
}
