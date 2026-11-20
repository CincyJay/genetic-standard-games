/**
 * Velvet Ace gaming chair (Claude, 2026-11-18, at Joshua's request after he turned down the cream
 * luxury chair and the LOD chair: a casino gaming stool "but burgundy with gold trim and it has the
 * games name on the backs"). Original geometry; preview art, not a final asset.
 *
 * - shield-shaped padded back (narrow waist, flared shoulders, rounded top) in burgundy leather,
 *   framed by a gold rolled edge, leaning back slightly; "Velvet Ace" script logo with a spade
 *   on its rear face (canvas texture; skipped where there is no DOM)
 * - square cushioned seat with soft rounded edges and stitched seams, on a gold trim band and a
 *   dark plinth
 * - four splayed dark legs with gold feet, and a gold foot ring
 *
 * Origin at the floor under the seat centre; the sitter faces +Z (userData.forward). Cushion top at
 * 0.65 m (the engine's SEAT_HEIGHT), back top about 1.12 m, footprint radius about 0.37 m.
 */
export function createVelvetGamingChair(THREE, { logoText = 'Velvet Ace' } = {}) {
  const group = new THREE.Group();
  group.name = 'VA_GAMING_CHAIR';
  const leather = new THREE.MeshStandardMaterial({ name: 'VA_CHAIR_BURGUNDY_LEATHER', color: 0x6a1124, roughness: 0.46, metalness: 0.04 });
  const gold = new THREE.MeshStandardMaterial({ name: 'VA_CHAIR_GOLD', color: 0xd4ad62, roughness: 0.26, metalness: 0.9 });
  const lacquer = new THREE.MeshStandardMaterial({ name: 'VA_CHAIR_DARK_LACQUER', color: 0x1c0a10, roughness: 0.32, metalness: 0.45 });
  const seam = new THREE.MeshStandardMaterial({ name: 'VA_CHAIR_WELT', color: 0x4a0b19, roughness: 0.5, metalness: 0.04 });
  const add = (parent, name, geometry, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.name = name;
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const roundedSquare = (side, radius) => {
    const h = side / 2;
    const s = new THREE.Shape();
    s.moveTo(-h + radius, -h);
    s.lineTo(h - radius, -h);
    s.quadraticCurveTo(h, -h, h, -h + radius);
    s.lineTo(h, h - radius);
    s.quadraticCurveTo(h, h, h - radius, h);
    s.lineTo(-h + radius, h);
    s.quadraticCurveTo(-h, h, -h, h - radius);
    s.lineTo(-h, -h + radius);
    s.quadraticCurveTo(-h, -h, -h + radius, -h);
    return s;
  };
  // lay an XY extrusion flat so its depth runs up +Y
  const layFlat = (geo) => geo.rotateX(-Math.PI / 2);

  // ---- seat: cushion (top at 0.65), gold band, dark plinth
  const SEAT_TOP = 0.65;
  // plump cushion: deep rounded edges that overhang the band
  const C_DEPTH = 0.03, C_BEVEL = 0.045, C_HALF = 0.19;
  const cushion = layFlat(new THREE.ExtrudeGeometry(roundedSquare(C_HALF * 2, 0.1), { depth: C_DEPTH, bevelEnabled: true, bevelThickness: C_BEVEL, bevelSize: C_BEVEL, bevelSegments: 5, curveSegments: 6 }));
  const cushionBase = SEAT_TOP - C_DEPTH - C_BEVEL;
  add(group, 'chair_seat_cushion', cushion, leather, 0, cushionBase, 0);
  // a soft welt round the top edge, in a slightly darker leather (reads as stitching, not lines)
  const weltPts = roundedSquare(C_HALF * 2 + C_BEVEL * 1.3, 0.12).getSpacedPoints(48);
  weltPts.pop();
  const welt = new THREE.CatmullRomCurve3(weltPts.map((p) => new THREE.Vector3(p.x, 0, -p.y)), true);
  add(group, 'chair_seat_welt', new THREE.TubeGeometry(welt, 64, 0.007, 5, true), seam, 0, cushionBase + C_DEPTH + C_BEVEL * 0.55, 0);
  const bandShape = roundedSquare(0.45, 0.08);
  bandShape.holes.push(roundedSquare(0.41, 0.06));
  add(group, 'chair_gold_seat_band', layFlat(new THREE.ExtrudeGeometry(bandShape, { depth: 0.026, bevelEnabled: false, curveSegments: 4 })), gold, 0, 0.505, 0);
  add(group, 'chair_seat_plinth', new THREE.BoxGeometry(0.4, 0.05, 0.4), lacquer, 0, 0.5, 0);

  // ---- legs: from under the plinth corners, splayed out to the floor, with gold feet
  const TOP = 0.16, FOOT = 0.26, LEG_TOP_Y = 0.475;
  const up = new THREE.Vector3(0, 1, 0);
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const a = new THREE.Vector3(sx * TOP, LEG_TOP_Y, sz * TOP);
    const b = new THREE.Vector3(sx * FOOT, 0.03, sz * FOOT);
    const dir = b.clone().sub(a);
    const leg = add(group, 'chair_leg', new THREE.CylinderGeometry(0.025, 0.02, dir.length(), 10), lacquer);
    leg.position.copy(a).add(b).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(up, dir.clone().normalize().negate());
    add(group, 'chair_gold_foot', new THREE.CylinderGeometry(0.03, 0.036, 0.04, 10), gold, b.x, 0.02, b.z);
  }
  // gold foot ring where it meets the legs
  const RING_Y = 0.26;
  const t = (LEG_TOP_Y - RING_Y) / (LEG_TOP_Y - 0.03);
  const legXZ = TOP + (FOOT - TOP) * t;
  const ring = add(group, 'chair_gold_foot_ring', new THREE.TorusGeometry(legXZ * Math.SQRT2, 0.014, 6, 32), gold, 0, RING_Y, 0);
  ring.rotation.x = Math.PI / 2;

  // ---- back: shield outline in its own XY plane (y up from the waist, padded face toward +Z)
  const shield = new THREE.Shape();
  shield.moveTo(-0.12, 0);
  shield.bezierCurveTo(-0.13, 0.12, -0.225, 0.17, -0.215, 0.32);
  shield.bezierCurveTo(-0.205, 0.47, 0.205, 0.47, 0.215, 0.32);
  shield.bezierCurveTo(0.225, 0.17, 0.13, 0.12, 0.12, 0);
  shield.quadraticCurveTo(0, -0.03, -0.12, 0);
  const BACK_DEPTH = 0.07, BEVEL = 0.024;

  const backGeo = new THREE.ExtrudeGeometry(shield, { depth: BACK_DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: 0.016, bevelSegments: 4, curveSegments: 12 });
  backGeo.translate(0, 0, -BACK_DEPTH / 2);
  const back = new THREE.Group();
  back.name = 'chair_back';
  back.position.set(0, 0.68, -0.235);
  back.rotation.x = -0.13; // leans back
  group.add(back);
  add(back, 'chair_back_pad', backGeo, leather);

  // gold rolled frame: the outline pushed out past the bevel, as one closed tube
  const pts = shield.getSpacedPoints(64);
  pts.pop(); // closed shape repeats its start
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    area += p.x * q.y - q.x * p.y;
  }
  const outward = area > 0 ? 1 : -1; // counter-clockwise: outward normal is (dy, -dx)
  const frame = pts.map((p, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length], next = pts[(i + 1) % pts.length];
    const d = new THREE.Vector2(next.x - prev.x, next.y - prev.y).normalize();
    const x = p.x + outward * d.y * 0.014;
    return new THREE.Vector3(x, p.y - outward * d.x * 0.014, 0);
  });
  const frameCurve = new THREE.CatmullRomCurve3(frame, true);
  add(back, 'chair_gold_back_frame', new THREE.TubeGeometry(frameCurve, 80, 0.024, 8, true), gold);

  // bracket from the seat's rear up into the back
  const bracket = add(group, 'chair_back_bracket', new THREE.BoxGeometry(0.05, 0.16, 0.022), gold, 0, 0.6, -0.235);
  bracket.rotation.x = -0.13;

  // ---- the game's name on the back's rear face
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 640;
    const g = c.getContext('2d');
    if (g) {
      // drawn in a 512x320 design space at 2x; a dark outline under heavy gold so it reads from
      // walking distance against the burgundy leather (Joshua: bigger logo, 2026-11-19)
      g.scale(2, 2);
      const grad = g.createLinearGradient(0, 30, 0, 270);
      grad.addColorStop(0, '#fff0b8');
      grad.addColorStop(0.5, '#e2bd6c');
      grad.addColorStop(1, '#a87c36');
      const ink = '#24050d';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      // spade
      g.save();
      g.translate(256, 62);
      g.scale(1.15, 1.15);
      g.beginPath();
      g.moveTo(0, -38);
      g.bezierCurveTo(30, -10, 44, 8, 26, 24);
      g.bezierCurveTo(14, 34, 4, 26, 3, 18);
      g.lineTo(10, 40);
      g.lineTo(-10, 40);
      g.lineTo(-3, 18);
      g.bezierCurveTo(-4, 26, -14, 34, -26, 24);
      g.bezierCurveTo(-44, 8, -30, -10, 0, -38);
      g.closePath();
      g.strokeStyle = ink;
      g.lineWidth = 8;
      g.stroke();
      g.fillStyle = grad;
      g.fill();
      g.restore();
      const heavy = (text, y, maxW, outline, thicken) => {
        g.strokeStyle = ink;
        g.lineWidth = outline;
        g.strokeText(text, 256, y, maxW);
        g.fillStyle = grad;
        g.fillText(text, 256, y, maxW);
        g.strokeStyle = grad;
        g.lineWidth = thicken;
        g.strokeText(text, 256, y, maxW);
      };
      g.font = 'italic 700 112px "Brush Script MT", "Segoe Script", cursive, Georgia, serif';
      heavy(logoText, 168, 496, 12, 3.5);
      g.font = '700 40px Georgia, "Times New Roman", serif';
      heavy('C A S I N O', 252, 320, 8, 1.5);
      g.strokeStyle = ink;
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(116, 290);
      g.lineTo(396, 290);
      g.stroke();
      g.fillStyle = grad;
      g.fillRect(116, 288, 280, 4);
      const map = new THREE.CanvasTexture(c);
      map.colorSpace = THREE.SRGBColorSpace ?? map.colorSpace;
      map.anisotropy = 8;
      const logoMat = new THREE.MeshStandardMaterial({ name: 'VA_CHAIR_BACK_LOGO', map, transparent: true, alphaTest: 0.08, roughness: 0.3, metalness: 0.75, depthWrite: false });
      const logo = add(back, 'chair_back_logo', new THREE.PlaneGeometry(0.38, 0.2375), logoMat, 0, 0.235, -(BACK_DEPTH / 2 + BEVEL + 0.002));
      logo.rotation.y = Math.PI; // faces out of the back (-Z)
      logo.castShadow = false;
      group.userData.createdTexture = map;
    }
  }

  group.userData = { ...group.userData, author: 'Claude', artOnly: true, forward: '+Z', seatHeight: SEAT_TOP, footprintRadius: 0.37, note: 'preview gaming chair: burgundy, gold trim, Velvet Ace on the back' };
  return group;
}
