/**
 * Velvet Ace / Svelte 01: slim, curved portrait casino cabinet.
 * Standalone, art-only Three.js geometry. Y up; player faces +Z.
 * 1 unit = 1 metre. No game logic, assets, networking, or production wiring.
 */
export function createSvelteSlotCabinet(THREE, options = {}) {
  const group = new THREE.Group();
  group.name = 'VA_SVELTE_01_CURVED_CABINET';
  const mat = (color, metalness = 0, roughness = 0.35, emissive = 0x000000, emissiveIntensity = 0) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity, side: THREE.FrontSide });
  const lacquer = mat(0x090d15, 0.55, 0.17);
  const graphite = mat(0x252c36, 0.76, 0.28);
  const titanium = mat(0xabb8c3, 0.82, 0.23);
  const led = mat(options.ledColor ?? 0x70d8f9, 0.1, 0.26, options.ledColor ?? 0x70d8f9, 2.1);
  const glass = mat(0x121c2b, 0.3, 0.11, 0x102037, 0.22);
  glass.name = 'VA_SVELTE_REEL_SCREEN_SWAP'; // UV-mapped screen, set .map to supplied reel texture
  const black = mat(0x080a0d, 0.05, 0.8);
  const add = (geometry, material, name, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  // Vertical S profile: bowed display toward the player at eye level, swept-back crown.
  // First-pass dimensions measured by Claude: 2.09m tall, 0.59m wide, ~0.89m deep.
  // Island revision: restrained front sweep and near-vertical back.
  // Retains the screen UVs and the existing 5x5 reel texture interface.
  const profile = [
    [0.13, -0.105, 0.29], [0.27, -0.095, 0.285],
    [0.43, -0.075, 0.268], [0.64, -0.045, 0.258],
    [0.85, -0.020, 0.255], [1.12, 0.015, 0.265],
    [1.42, 0.055, 0.28], [1.72, 0.070, 0.285],
    [1.95, 0.055, 0.282], [2.09, 0.025, 0.266]
  ];
  const rearZ = -0.305; // constant cabinet rear datum for back-to-back banks // [height, forward Z, half-width]
  const frontZ = (y) => {
    for (let i = 1; i < profile.length; i++) {
      if (y <= profile[i][0]) {
        const a = profile[i - 1], b = profile[i], t = (y - a[0]) / (b[0] - a[0]);
        const q = t * t * (3 - 2 * t);
        return a[1] + (b[1] - a[1]) * q;
      }
    }
    return profile.at(-1)[1];
  };
  const widthAt = (y) => {
    for (let i = 1; i < profile.length; i++) {
      if (y <= profile[i][0]) {
        const a = profile[i - 1], b = profile[i], t = (y - a[0]) / (b[0] - a[0]);
        return a[2] + (b[2] - a[2]) * t;
      }
    }
    return profile.at(-1)[2];
  };
  function curvedRibbon(name, y0, y1, halfWidth, zOffset, material, rows = 48, cols = 16, bow = 0.025) {
    const positions = [], uvs = [], indices = [];
    for (let i = 0; i <= rows; i++) {
      const t = i / rows, y = y0 + (y1 - y0) * t;
      for (let j = 0; j <= cols; j++) {
        const u = j / cols, x = (u * 2 - 1) * halfWidth;
        const z = frontZ(y) + zOffset + bow * (1 - (2 * u - 1) ** 2);
        positions.push(x, y, z); uvs.push(u, t);
      }
    }
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j, b = a + cols + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices); geo.computeVertexNormals();
    return add(geo, material, name);
  }
  function tube(name, points, radius, material, segments = 80) {
    return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 7, false), material, name);
  }
  // Shell: a continuous tapered hull, not stacked boxes.
  const vertices = [], indices = [];
  const rings = 32, sides = 16;
  for (let i = 0; i <= rings; i++) {
    const y = 0.045 + (2.09 - 0.045) * i / rings;
    const flare = Math.max(0, 1 - y / 0.42);
    const w = widthAt(y) + 0.015 * flare;
    for (let j = 0; j <= sides; j++) {
      const theta = 2 * Math.PI * j / sides;
      const x = w * Math.cos(theta);
      // Oval section with a fixed rear extremity. The old profile moved
      // the rear wall forward/back with height, creating a large V gap.
      const front = frontZ(y) + 0.040 + 0.010 * flare;
      const centre = (front + rearZ) / 2;
      const radius = (front - rearZ) / 2;
      const z = centre + radius * Math.sin(theta);
      vertices.push(x, y, z);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const hull = new THREE.BufferGeometry();
  // Add cap centres before copying vertices into the GPU position attribute.
  const bottomCentre = vertices.length / 3;
  vertices.push(0, 0.045, (frontZ(0.045) + 0.05 + rearZ) / 2);
  const topCentre = vertices.length / 3;
  vertices.push(0, 2.09, (frontZ(2.09) + 0.04 + rearZ) / 2);
  for (let j = 0; j < sides; j++) {
    indices.push(bottomCentre, j, j + 1);
    const a = rings * (sides + 1) + j;
    indices.push(topCentre, a + 1, a);
  }
  hull.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  hull.setIndex(indices); hull.computeVertexNormals();
  // The first and last vertex of each ring occupy the same point.
  // Average their normals to remove the dark 30-degree seam without
  // changing indexed topology, cap winding, or the screen's UVs.
  const normals = hull.getAttribute('normal');
  for (let ring = 0; ring <= rings; ring++) {
    const first = ring * (sides + 1), last = first + sides;
    const nx = normals.getX(first) + normals.getX(last);
    const ny = normals.getY(first) + normals.getY(last);
    const nz = normals.getZ(first) + normals.getZ(last);
    const len = Math.hypot(nx, ny, nz) || 1;
    normals.setXYZ(first, nx / len, ny / len, nz / len);
    normals.setXYZ(last, nx / len, ny / len, nz / len);
  }
  normals.needsUpdate = true;
  add(hull, lacquer, 'continuous_sculpted_S_curve_hull');
  // Portrait curved screen: high screen-to-body ratio and genuine bent mesh.
  curvedRibbon('portrait_glass_curved_49inch_visual_target', 0.78, 1.94, 0.244, 0.072, glass, 28, 12, 0.035);
  const screenBorder = [];
  for (let i = 0; i <= 40; i++) {
    const y = 0.77 + (1.95 - 0.77) * i / 40;
    screenBorder.push([-.257, y, frontZ(y) + .071]);
  }
  for (let i = 40; i >= 0; i--) {
    const y = 0.77 + (1.95 - 0.77) * i / 40;
    screenBorder.push([.257, y, frontZ(y) + .071]);
  }
  screenBorder.push(screenBorder[0]);
  tube('thin_screen_titanium_bezel', screenBorder, 0.007, titanium, 36);
  for (const sign of [-1, 1]) {
    const edge = [];
    for (let i = 0; i <= 40; i++) {
      const y = 0.79 + 1.17 * i / 40;
      edge.push([sign * (widthAt(y) - 0.019), y, frontZ(y) + 0.012]);
    }
    tube(sign < 0 ? 'left_swept_LED' : 'right_swept_LED', edge, 0.004, led, 24);
  }
  // Curved, opaque screen cradle: closes the floating-sheet gap with the hull.
  // Fairings trace the display edges and taper back into the shell, rather than
  // looking like a second rectangular cabinet bolted to the first.
  function screenFairing(sign) {
    const positions = [], indices = [], rows = 28;
    for (let i = 0; i <= rows; i++) {
      const y = 0.77 + 1.18 * i / rows;
      const zFront = frontZ(y) + 0.075;
      const zHull = frontZ(y) + 0.035;
      const w = 0.252 + 0.004 * Math.sin(Math.PI * i / rows);
      positions.push(sign * w, y, zFront, sign * (widthAt(y) - 0.017), y, zHull);
      if (i < rows) {
        const a = i * 2;
        if (sign < 0) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        else indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices); geo.computeVertexNormals();
    add(geo, graphite, sign < 0 ? 'left_screen_shell_fairing' : 'right_screen_shell_fairing');
  }
  screenFairing(-1); screenFairing(1);
  // Deep-black recessed screen backer bridges its centre to the body.
  curvedRibbon('integrated_screen_recess', 0.765, 1.955, 0.253, 0.047, black, 20, 8, 0.02);
  // Continuous inset frame: dark side walls and two curved header/sill bridges
  // conceal the exposed edges of the glass sheet. Keep the screen material/UVs intact.
  // These are real surfaces, not a decal; the lip sits 9 mm ahead of the glass.
  function frameBridge(name, y, height, material) {
    const positions = [], uvs = [], indices = [];
    const columns = 24;
    for (let side = 0; side < 2; side++) {
      const yy = y + side * height;
      for (let j = 0; j <= columns; j++) {
        const u = j / columns, x = (u * 2 - 1) * 0.258;
        const z = frontZ(yy) + 0.088 + 0.035 * (1 - (2 * u - 1) ** 2);
        positions.push(x, yy, z); uvs.push(u, side);
      }
    }
    for (let j = 0; j < columns; j++) {
      const a = j, b = columns + 1 + j;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return add(geometry, material, name);
  }
  frameBridge('recessed_screen_header_bridge', 1.94, 0.033, graphite);
  frameBridge('recessed_screen_lower_sill', 0.755, 0.025, graphite);
  // Narrow shadow-gasket strips mask the edge of the active display without
  // covering the middle of the 5x5 game. Unlike a floating wire, these
  // ribbon strips have visible width and follow the curved display.
  for (const sign of [-1, 1]) {
    const positions = [], indices = [], rows = 32;
    for (let i = 0; i <= rows; i++) {
      const y = 0.78 + 1.16 * i / rows;
      for (const x of [0.244, 0.258]) {
        const u = x / 0.244;
        positions.push(sign * x, y, frontZ(y) + 0.083 + 0.035 * (1 - u * u));
      }
      if (i < rows) {
        const a = i * 2;
        if (sign < 0) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        else indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    add(geometry, black, sign < 0 ? 'left_recess_shadow_gasket' : 'right_recess_shadow_gasket');
  }
  // Wider, sculpted side returns make the recess legible in a three-quarter view.
  // They connect the gasket's outer edge to the hull instead of leaving a
  // free-standing 14 mm glass sheet. Both sides are DoubleSide because their
  // outward surfaces must remain visible from front and oblique angles.
  const recessReturn = mat(0x151b26, 0.48, 0.39);
  recessReturn.side = THREE.DoubleSide;
  for (const sign of [-1, 1]) {
    const positions = [], uvs = [], indices = [], rows = 28;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows, y = 0.79 + 1.14 * t;
      const w = widthAt(y);
      // Front lip, bevel shoulder, and rear hull landing. The side
      // returns taper into the body at both ends.
      const taper = Math.sin(Math.PI * t);
      const edge = [
        [0.256, frontZ(y) + 0.092],
        [0.273 + 0.004 * taper, frontZ(y) + 0.066],
        [Math.min(w - 0.007, 0.290), frontZ(y) - 0.003]
      ];
      for (let j = 0; j < 3; j++) {
        positions.push(sign * edge[j][0], y, edge[j][1]);
        uvs.push(j / 2, t);
      }
      if (i < rows) for (let j = 0; j < 2; j++) {
        const a = i * 3 + j, b = a + 3;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices); geo.computeVertexNormals();
    add(geo, recessReturn, sign < 0 ? 'left_sculpted_recess_return' : 'right_sculpted_recess_return');
  }
  // A slim structural keel physically joins the long rear overhang to the floor.
  // Lower hull flares into shoe; no separate exposed keel puck.
  // A long, tapered oval floor shoe replaces the detached central puck.
  const shoe = add(new THREE.CylinderGeometry(0.235, 0.27, 0.060, 32), black, 'continuous_floor_shoe');
  shoe.scale.z = 0.74; shoe.position.set(0, 0.03, -0.105);
  // Physical shadow seam where shoe and lower shell overlap.
  const shoeTrim = add(new THREE.TorusGeometry(0.246, 0.007, 5, 20), titanium, 'floor_shoe_chrome_edge');
  shoeTrim.rotation.x = Math.PI / 2; shoeTrim.scale.y = 0.74; shoeTrim.position.set(0, 0.02, -0.105);
  // Floating, thin control deck, a tapered oval with the front lip toward player.
  // DECK_BACK (Claude, VA-0147): after VA-0145 moved the hull front back to z ~0 at deck height, the
  // deck's rear edge sat 7 cm in front of it and read as floating; shift deck, mount, trim and buttons
  // back so the deck's rear edge meets the hull.
  const DECK_BACK = 0.07;
  const deck = add(new THREE.CylinderGeometry(0.295, 0.245, 0.055, 32), graphite, 'floating_elliptical_button_deck');
  deck.scale.z = 0.58; deck.position.set(0, 0.75, 0.245 - DECK_BACK); deck.rotation.x = -0.08;
  // A swept web connects the deck to the hull, with its cap hidden below controls.
  // Short and rearward: no cylinder cap above the deck's button plane.
  const deckMount = add(new THREE.CylinderGeometry(0.085, 0.135, 0.12, 20), lacquer, 'sculpted_deck_mount');
  deckMount.scale.z = 1.25; deckMount.position.set(0, 0.665, 0.105 - DECK_BACK); deckMount.rotation.x = -0.12;
  const deckLip = add(new THREE.TorusGeometry(0.268, 0.007, 5, 32), titanium, 'deck_perimeter_trim');
  deckLip.scale.y = 0.58; deckLip.rotation.x = Math.PI / 2; deckLip.position.set(0, 0.786, 0.245 - DECK_BACK);
  for (let i = -1; i <= 1; i++) {
    const button = add(new THREE.CylinderGeometry(0.032, 0.032, 0.009, 12), i === 0 ? led : titanium, 'physical_button_' + i);
    button.position.set(i * 0.086, 0.789, 0.272 - DECK_BACK);
  }
  group.userData = {
    artOnly: true, prototype: 'Svelte 01', units: 'metres',
    front: '+Z', up: '+Y', approximateHeightM: 2.09,
    approximateWidthM: 0.612, curvedScreen: true, rearDatumM: rearZ,
    screenMaterialName: glass.name, status: 'isolated geometry revision; not production integrated'
  };
  return group;
}
