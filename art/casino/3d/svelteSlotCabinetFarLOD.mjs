/**
 * Velvet Ace distant Svelte cabinet art LOD.
 * Simplified, original geometry for distant floor rendering only.
 * The host decides LOD distance, instancing and texture assignment.
 * No interaction, networking, game logic or production wiring.
 */
export function createSvelteSlotCabinetFarLOD(THREE, options = {}) {
  const group = new THREE.Group();
  group.name = 'VA_SVELTE_01_FAR_LOD';
  const mat = (color, metalness, roughness, emissive = 0, intensity = 0) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity: intensity });
  const lacquer = mat(0x090d15, .55, .17);
  const graphite = mat(0x252c36, .76, .28);
  const titanium = mat(0xabb8c3, .82, .23);
  const ledColor = options.ledColor ?? 0x70d8f9;
  const led = mat(ledColor, .1, .26, ledColor, 2.1);
  const glass = mat(0x121c2b, .3, .11, 0x102037, .22);
  glass.name = 'VA_SVELTE_REEL_SCREEN_SWAP';
  const black = mat(0x080a0d, .05, .8);
  const add = (name, geo, material) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = name; mesh.castShadow = false; mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  };
  // Six stepped cross-sections, twelve radial samples: 120 shell triangles.
  // The constant -0.305m rear datum lets opposing banks sit close together.
  const sections = [
    [.05, -.09, .295], [.42, -.07, .269], [.76, -.03, .256],
    [1.18, .024, .269], [1.66, .069, .285], [2.09, .025, .266]
  ];
  const rear = -.305, radial = 12, pos = [], uv = [], idx = [];
  for (let i = 0; i < sections.length; i++) {
    const [y, front, w] = sections[i];
    const centre = (front + .04 + rear) / 2, radius = (front + .04 - rear) / 2;
    for (let j = 0; j <= radial; j++) {
      const a = Math.PI * 2 * j / radial;
      pos.push(w * Math.cos(a), y, centre + radius * Math.sin(a));
      uv.push(j / radial, y / 2.09);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shell.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  shell.setIndex(idx); shell.computeVertexNormals();
  add('continuous_sculpted_S_curve_hull', shell, lacquer);
  // Full 5x5 source texture is retained on one broad portrait ribbon.
  // Five rows and eight columns give a gentle screen bow without close-up trim.
  const p = [], u = [], ids = [], rows = 5, cols = 8;
  const frontAt = y => {
    for (let i = 1; i < sections.length; i++) if (y <= sections[i][0]) {
      const a = sections[i - 1], b = sections[i];
      return a[1] + (b[1] - a[1]) * ((y - a[0]) / (b[0] - a[0]));
    }
    return sections.at(-1)[1];
  };
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, y = .78 + 1.16 * t;
    for (let j = 0; j <= cols; j++) {
      const x = 2 * j / cols - 1;
      p.push(.244 * x, y, frontAt(y) + .073 + .035 * (1 - x * x));
      u.push(j / cols, t);
    }
  }
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const a = i * (cols + 1) + j, b = a + cols + 1;
    ids.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const screen = new THREE.BufferGeometry();
  screen.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  screen.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  screen.setIndex(ids); screen.computeVertexNormals();
  add('portrait_glass_curved_49inch_visual_target', screen, glass);
  // A single thin surround and simple integrated control lip. No tubes or buttons.
  // Bend the low-cost screen surround into the cabinet's front profile.
  // The former fixed-z box was buried inside the hull at overview distance.
  // Keep the same 12 triangles so Claude's far-LOD triangle budget is stable.
  const surroundGeo = new THREE.BoxGeometry(.518, 1.185, .016);
  const surroundPositions = surroundGeo.getAttribute('position');
  for (let i = 0; i < surroundPositions.count; i++) {
    const x = surroundPositions.getX(i);
    const y = surroundPositions.getY(i) + 1.36;
    const localZ = surroundPositions.getZ(i);
    const bow = .035 * (1 - Math.min(1, (x / .244) ** 2));
    // 18 mm behind the active glass at the same x/y, but ahead of the hull.
    surroundPositions.setXYZ(i, x, y, frontAt(y) + .055 + bow + localZ);
  }
  surroundPositions.needsUpdate = true;
  surroundGeo.computeVertexNormals();
  const surround = add('distant_screen_shadow_surround', surroundGeo, black);
  const deck = add('floating_elliptical_button_deck',
    new THREE.CylinderGeometry(.27, .24, .045, 12), graphite);
  deck.scale.z = .58; deck.position.set(0, .75, .185);
  const shoe = add('continuous_floor_shoe',
    new THREE.CylinderGeometry(.22, .25, .055, 12), black);
  shoe.scale.z = .8; shoe.position.set(0, .03, -.1);
  // Low-cost silhouette highlight, two short bars instead of curved tubes.
  for (const sign of [-1, 1]) {
    const strip = add(sign < 0 ? 'left_swept_LED' : 'right_swept_LED',
      new THREE.BoxGeometry(.007, 1.1, .006), led);
    strip.position.set(sign * .259, 1.35, .064);
  }
  group.userData = {
    artOnly: true, prototype: 'Svelte 01 far LOD', units: 'metres',
    front: '+Z', up: '+Y', approximateHeightM: 2.09,
    screenMaterialName: glass.name, sourceTextureCompatible: true,
    expectedTriangles: 120 + 80 + 12 + 48 + 48 + 24,
    status: 'isolated unrendered far-distance art; not gameplay or production integrated'
  };
  return group;
}
