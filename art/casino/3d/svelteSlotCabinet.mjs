/**
 * Velvet Ace / Svelte 01: slim, curved portrait casino cabinet.
 * Standalone, art-only Three.js geometry. Y up; player faces +Z.
 * 1 unit = 1 metre. No game logic, assets, networking, or production wiring.
 */
export function createSvelteSlotCabinet(THREE, options = {}) {
  const group = new THREE.Group();
  group.name = 'VA_SVELTE_01_CURVED_CABINET';
  const mat = (color, metalness = 0, roughness = 0.35, emissive = 0x000000, emissiveIntensity = 0) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity, side: THREE.DoubleSide });
  const lacquer = mat(0x090d15, 0.55, 0.17);
  const graphite = mat(0x252c36, 0.76, 0.28);
  const titanium = mat(0xabb8c3, 0.82, 0.23);
  const led = mat(options.ledColor ?? 0x70d8f9, 0.1, 0.26, options.ledColor ?? 0x70d8f9, 2.1);
  const glass = mat(0x121c2b, 0.3, 0.11, 0x102037, 0.22);
  const black = mat(0x080a0d, 0.05, 0.8);
  const add = (geometry, material, name, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  // Vertical S profile: bowed display toward the player at eye level, swept-back crown.
  // Dimensions: 2.13m tall, 0.69m wide, ~0.74m deep including deck.
  const profile = [
    [0.13, -0.13, 0.29], [0.27, -0.11, 0.285],
    [0.43, -0.055, 0.268], [0.64, 0.00, 0.258],
    [0.85, 0.035, 0.255], [1.12, 0.095, 0.265],
    [1.42, 0.16, 0.28], [1.72, 0.19, 0.285],
    [1.95, 0.14, 0.282], [2.09, 0.075, 0.266]
  ]; // [height, forward Z, half-width]
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
      indices.push(a, b, a + 1, b, b + 1, a + 1);
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
  const rings = 60, sides = 24;
  for (let i = 0; i <= rings; i++) {
    const y = 0.13 + (2.09 - 0.13) * i / rings;
    const w = widthAt(y);
    for (let j = 0; j <= sides; j++) {
      const theta = 2 * Math.PI * j / sides;
      const x = w * Math.cos(theta);
      const z = frontZ(y) - 0.15 + 0.19 * Math.sin(theta);
      vertices.push(x, y, z);
    }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) {
    const a = i * (sides + 1) + j, b = a + sides + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  hull.setIndex(indices); hull.computeVertexNormals();
  add(hull, lacquer, 'continuous_sculpted_S_curve_hull');
  // Portrait curved screen: high screen-to-body ratio and genuine bent mesh.
  curvedRibbon('portrait_glass_curved_49inch_visual_target', 0.78, 1.94, 0.244, 0.072, glass, 64, 24, 0.035);
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
  tube('thin_screen_titanium_bezel', screenBorder, 0.007, titanium, 160);
  for (const sign of [-1, 1]) {
    const edge = [];
    for (let i = 0; i <= 40; i++) {
      const y = 0.33 + 1.73 * i / 40;
      edge.push([sign * (widthAt(y) - 0.012), y, frontZ(y) + 0.017]);
    }
    tube(sign < 0 ? 'left_swept_LED' : 'right_swept_LED', edge, 0.006, led);
  }
  // Floating, thin control deck, a tapered oval with the front lip toward player.
  const deck = add(new THREE.CylinderGeometry(0.295, 0.245, 0.055, 48), graphite, 'floating_elliptical_button_deck');
  deck.scale.z = 0.58; deck.position.set(0, 0.75, 0.245); deck.rotation.x = -0.08;
  const deckLip = add(new THREE.TorusGeometry(0.268, 0.007, 7, 60), titanium, 'deck_perimeter_trim');
  deckLip.scale.y = 0.58; deckLip.rotation.x = Math.PI / 2; deckLip.position.set(0, 0.786, 0.245);
  for (let i = -1; i <= 1; i++) {
    const button = add(new THREE.CylinderGeometry(0.032, 0.032, 0.009, 20), i === 0 ? led : titanium, 'physical_button_' + i);
    button.position.set(i * 0.086, 0.789, 0.272);
  }
  const foot = add(new THREE.CylinderGeometry(0.20, 0.245, 0.115, 48), black, 'low_flared_floor_plinth');
  foot.scale.z = 0.72; foot.position.y = 0.065;
  const footTrim = add(new THREE.TorusGeometry(0.217, 0.008, 8, 48), titanium, 'floor_plinth_chrome_foot');
  footTrim.rotation.x = Math.PI / 2; footTrim.scale.y = 0.72; footTrim.position.y = 0.023;
  group.userData = {
    artOnly: true, prototype: 'Svelte 01', units: 'metres',
    front: '+Z', up: '+Y', approximateHeightM: 2.13,
    approximateWidthM: 0.69, curvedScreen: true,
    status: 'unrendered isolated geometry; not production integrated'
  };
  return group;
}
