/**
 * Velvet Ace: decorative terminal end panel for back-to-back Svelte islands.
 * Standalone art-only mesh, Y up. End panel faces +X; rotate Y by PI for -X.
 * Position at the terminal of a bank; no floor/gameplay integration.
 */
export function createSvelteIslandEndCap(THREE, { depth = 1.18, height = 2.08, width = 0.075, ledColor = 0x5acdea } = {}) {
  const group = new THREE.Group();
  group.name = 'VA_SVELTE_ISLAND_END_CAP';
  const material = (color, metalness, roughness, emissive = 0, emissiveIntensity = 0) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity });
  const velvet = material(0x44142b, 0.12, 0.86);
  const gold = material(0xc9a86a, 0.78, 0.25);
  const inset = material(0x140e19, 0.28, 0.5);
  const glow = material(ledColor, 0.05, 0.36, ledColor, 1.6);
  const mesh = (name, geometry, mat) => {
    const m = new THREE.Mesh(geometry, mat); m.name = name;
    m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
  };
  // Slightly tapered, bevelled monolithic side slab with a floor-height kick.
  // End plane is +X; the long Z direction closes the back-to-back V gap.
  const shape = new THREE.Shape();
  const half = depth / 2;
  shape.moveTo(-half + .09, .02);
  shape.lineTo(half - .09, .02);
  shape.quadraticCurveTo(half, .02, half, .13);
  shape.lineTo(half - .035, height - .14);
  shape.quadraticCurveTo(half - .04, height, half - .17, height);
  shape.lineTo(-half + .17, height);
  shape.quadraticCurveTo(-half + .04, height, -half + .035, height - .14);
  shape.lineTo(-half, .13);
  shape.quadraticCurveTo(-half, .02, -half + .09, .02);
  const body = mesh('end_cap_sculpted_slab', new THREE.ExtrudeGeometry(shape, {
    depth: width, steps: 1, bevelEnabled: true, bevelThickness: .012, bevelSize: .015, bevelSegments: 3,
    curveSegments: 10
  }), inset);
  // Shape local x=Z, local y=Y, extrusion local z=X.
  body.rotation.y = Math.PI / 2;
  body.position.x = -width / 2;
  // Velvet inlay follows the slab profile, positioned on the visible +X face.
  const inner = new THREE.Shape();
  const h = half - .095;
  inner.moveTo(-h + .06, .18);
  inner.lineTo(h - .06, .18);
  inner.quadraticCurveTo(h, .18, h, .28);
  inner.lineTo(h - .025, height - .23);
  inner.quadraticCurveTo(h - .03, height - .13, h - .13, height - .13);
  inner.lineTo(-h + .13, height - .13);
  inner.quadraticCurveTo(-h + .03, height - .13, -h + .025, height - .23);
  inner.lineTo(-h, .28);
  inner.quadraticCurveTo(-h, .18, -h + .06, .18);
  const panel = mesh('burgundy_velvet_inlay', new THREE.ShapeGeometry(inner, 14), velvet);
  panel.rotation.y = Math.PI / 2; panel.position.x = width / 2 + .016;
  // Gold perimeter and cyan inner accent: continuous lines, not dozens of boxes.
  const trace = (name, points, radius, mat) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([z, y]) =>
      new THREE.Vector3(width / 2 + .026, y, z)), true, 'centripetal');
    return mesh(name, new THREE.TubeGeometry(curve, 96, radius, 6, true), mat);
  };
  const outline = [
    [-h + .07, .20], [h - .07, .20], [h, .29],
    [h - .02, height - .24], [h - .12, height - .15],
    [-h + .12, height - .15], [-h + .02, height - .24], [-h, .29]
  ];
  trace('continuous_champagne_gold_border', outline, .009, gold);
  const light = outline.map(([z, y]) => [z * .88, (y - height / 2) * .88 + height / 2]);
  trace('cyan_inset_LED_outline', light, .005, glow);
  // Original geometric crest, formed from nested rings and an embossed VA monogram.
  const crest = new THREE.Group();
  crest.name = 'velvet_ace_terminal_crest';
  crest.position.set(width / 2 + .04, height * .59, 0);
  group.add(crest);
  for (const [r, thickness, m] of [[.225, .014, gold], [.193, .005, glow], [.16, .006, gold]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, thickness, 8, 64), m);
    ring.rotation.y = Math.PI / 2; crest.add(ring);
  }
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(.13, 0), gold);
  diamond.scale.set(.22, 1.2, .7); crest.add(diamond);
  // Diamond-stitched upholstered effect: restrained crossed piping, no per-button meshes.
  const stitches = material(0x8c3c50, .16, .76);
  for (const sign of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const y = .34 + i * (height - .78) / 14;
      const z = sign * (.18 + .05 * Math.sin(y * 7));
      pts.push(new THREE.Vector3(width / 2 + .021, y, z));
    }
    mesh(sign < 0 ? 'left_quilted_piping' : 'right_quilted_piping',
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, .0025, 4), stitches);
  }
  group.userData = {
    artOnly: true, terminalFace: '+X', units: 'metres', depth, height,
    installation: 'position at island terminal; rotate Y=PI for opposite end',
    status: 'unrendered isolated art; not integrated or approved'
  };
  return group;
}
