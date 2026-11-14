// Poker room art: the tournament table (top-down, 1:1 with the game's layout),
// 3D chips, dealer button, trophies and the poker series logo.
import { M, RoundedBoxGeometry, THREE, extrudeShape, lathe, renderer, rimText, roundedRectShape, starShape, studio, text3d } from './kit.js';

const mesh = (g, m) => new THREE.Mesh(g, m);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function ellipseShape(rx, ry, holeRx, holeRy) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false);
  if (holeRx) {
    const h = new THREE.Path();
    h.absellipse(0, 0, holeRx, holeRy, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}

/**
 * The table seen from straight above, in game pixels (1080x1920, centre 540,960):
 * padded leather rail (508x832), wood racetrack (428x742), felt (400x712).
 */
export function renderTable(feltColor = '#123a8a', W = 1080, H = 1920) {
  renderer.setSize(W, H);
  const scene = studio(0.45);
  scene.background = new THREE.Color(0x07050a);
  // the room floor: dark carpet with soft light pools
  const floorTex = canvasTex(512, 512, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, '#2a1a24');
    grd.addColorStop(1, '#08050a');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.08;
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = i % 2 ? '#c9962a' : '#7a1a3a';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  const floor = mesh(new THREE.PlaneGeometry(W * 1.4, H * 1.4), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -120;
  scene.add(floor);
  // soft shadow under the table
  const shadowTex = canvasTex(256, 256, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.9)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
  const shadow = mesh(new THREE.PlaneGeometry(1300, 2050), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -119;
  scene.add(shadow);

  // felt with printed logo and betting line
  const feltTex = canvasTex(1024, 1824, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h / 2, h * 0.6);
    const base = new THREE.Color(feltColor);
    const hi = base.clone().offsetHSL(0, 0, 0.12);
    const lo = base.clone().offsetHSL(0, 0, -0.1);
    grd.addColorStop(0, `#${hi.getHexString()}`);
    grd.addColorStop(0.6, feltColor);
    grd.addColorStop(1, `#${lo.getHexString()}`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    // felt fibres
    g.globalAlpha = 0.06;
    for (let i = 0; i < 40000; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#000000';
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    g.globalAlpha = 1;
    // betting line
    g.strokeStyle = 'rgba(233,200,106,0.55)';
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(w / 2, h / 2, w * 0.41, h * 0.42, 0, 0, Math.PI * 2);
    g.stroke();
    // logo: a spade emblem and the series name
    g.fillStyle = 'rgba(233,200,106,0.22)';
    g.font = '900 72px Georgia, serif';
    g.textAlign = 'center';
    g.fillText('VELVET ACE', w / 2, h * 0.7);
    g.font = '700 34px Georgia, serif';
    g.fillText('P O K E R   S E R I E S', w / 2, h * 0.7 + 52);
    g.font = '900 150px Georgia, serif';
    g.fillStyle = 'rgba(233,200,106,0.16)';
    g.fillText('♠', w / 2, h * 0.31);
  });
  feltTex.repeat.set(1 / 800, 1 / 1424);
  feltTex.offset.set(0.5, 0.5);
  const felt = mesh(new THREE.ShapeGeometry(ellipseShape(400, 712), 96), new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.95 }));
  felt.rotation.x = -Math.PI / 2;
  scene.add(felt);
  // wood racetrack with a brass inlay
  const woodTex = canvasTex(1024, 64, (g, w, h) => {
    g.fillStyle = '#5a2a12';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${120 + Math.random() * 60},${60 + Math.random() * 30},20,0.5)`;
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      const y = Math.random() * h;
      g.moveTo(0, y);
      g.bezierCurveTo(w / 3, y + 6, (2 * w) / 3, y - 6, w, y);
      g.stroke();
    }
  });
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(1 / 200, 1 / 200);
  const woodRing = mesh(extrudeShape(ellipseShape(432, 746, 400, 712), 8, 4, 96), new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.6 }));
  woodRing.rotation.x = -Math.PI / 2;
  woodRing.position.y = 2;
  scene.add(woodRing);
  const inlay = mesh(new THREE.TorusGeometry(1, 2.2, 8, 256), M.gold());
  inlay.scale.set(416, 729, 1);
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.y = 7;
  // a torus scaled non-uniformly: rebuild as a tube along an ellipse so the thickness stays even
  const ell = new THREE.EllipseCurve(0, 0, 416, 729, 0, Math.PI * 2);
  const pts3 = ell.getPoints(400).map((p) => new THREE.Vector3(p.x, 8, p.y));
  const inlayTube = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3, true), 400, 2.4, 8, true), M.gold());
  scene.add(inlayTube);
  void inlay;
  // padded leather rail: a fat tube around the table, with stitching
  const railCurve = new THREE.CatmullRomCurve3(new THREE.EllipseCurve(0, 0, 470, 788, 0, Math.PI * 2).getPoints(400).map((p) => new THREE.Vector3(p.x, 22, p.y)), true);
  const rail = mesh(new THREE.TubeGeometry(railCurve, 400, 42, 32, true), new THREE.MeshPhysicalMaterial({ color: 0x0c0a0e, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.4 }));
  rail.scale.y = 0.7;
  scene.add(rail);
  const stitchCurve = new THREE.CatmullRomCurve3(new THREE.EllipseCurve(0, 0, 470, 788, 0, Math.PI * 2).getPoints(400).map((p) => new THREE.Vector3(p.x, 52, p.y)), true);
  const stitch = mesh(new THREE.TubeGeometry(stitchCurve, 800, 1.4, 6, true), new THREE.MeshStandardMaterial({ color: 0xc9962a, roughness: 0.6 }));
  scene.add(stitch);
  // overhead lamp
  const lamp = new THREE.SpotLight(0xfff0d8, 2.0, 0, 0.75, 0.7, 0);
  lamp.position.set(0, 1600, 0);
  lamp.target.position.set(0, 0, 0);
  scene.add(lamp, lamp.target);
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 5000);
  cam.position.set(0, 2000, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/jpeg', 0.88);
}

// ------------------------------------------------------------------ chips
export const CHIP_COLORS = { 10: 0x2a6ad8, 50: 0xe07a1a, 100: 0x202024, 500: 0x7a2ab8, 1000: 0xd8a020, 5000: 0xc8102e };

function chipFaceTex(color, value) {
  const hex = `#${new THREE.Color(color).getHexString()}`;
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = hex;
    g.beginPath();
    g.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
    g.fill();
    // edge inserts
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      g.save();
      g.translate(w / 2, w / 2);
      g.rotate((i / 8) * Math.PI * 2);
      g.fillRect(-12, -w / 2, 24, 30);
      g.restore();
    }
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 5;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.arc(w / 2, w / 2, w * 0.33, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.arc(w / 2, w / 2, w * 0.3, 0, Math.PI * 2);
    g.fill();
    // cylinder caps map the texture turned a quarter, so the label is drawn turned back
    g.save();
    g.translate(w / 2, w / 2);
    g.rotate(-Math.PI / 2);
    g.fillStyle = '#ffffff';
    g.font = `900 ${value >= 1000 ? 64 : 76}px Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(value >= 1000 ? `${value / 1000}K` : String(value), 0, 4);
    g.restore();
  });
}

function chipSideTex(color) {
  const hex = `#${new THREE.Color(color).getHexString()}`;
  const t = canvasTex(256, 16, (g, w, h) => {
    g.fillStyle = hex;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) g.fillRect((i / 8) * w, 0, w / 32, h);
  });
  return t;
}

export function chip(value) {
  const color = CHIP_COLORS[value];
  const face = new THREE.MeshPhysicalMaterial({ map: chipFaceTex(color, value), roughness: 0.35, clearcoat: 0.6 });
  const side = new THREE.MeshPhysicalMaterial({ map: chipSideTex(color), roughness: 0.4, clearcoat: 0.5 });
  const geo = new THREE.CylinderGeometry(1, 1, 0.22, 64, 1);
  const m = mesh(geo, [side, face, face]);
  return m;
}

export function dealerButton() {
  const g = new THREE.Group();
  const face = canvasTex(256, 256, (c, w) => {
    c.fillStyle = '#f6f2e8';
    c.fillRect(0, 0, w, w);
    c.strokeStyle = '#c9962a';
    c.lineWidth = 10;
    c.beginPath();
    c.arc(w / 2, w / 2, w * 0.4, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#14101a';
    c.font = '900 92px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('D', w / 2, w / 2 + 6);
  });
  const mat = new THREE.MeshPhysicalMaterial({ map: face, roughness: 0.3, clearcoat: 1 });
  const side = new THREE.MeshPhysicalMaterial({ color: 0xe8e2d4, roughness: 0.35, clearcoat: 1 });
  g.add(mesh(new THREE.CylinderGeometry(1, 1, 0.32, 64), [side, mat, mat]));
  return g;
}

// ------------------------------------------------------------------ trophies
export function trophy(kind) {
  const mat = kind === 'gold' ? M.gold() : kind === 'silver' ? M.metal(0xe8ecf4, 0.18) : M.metal(0xc8743a, 0.22);
  const g = new THREE.Group();
  const cup = mesh(lathe([[0.0, 0.2], [0.35, 0.22], [0.75, 0.5], [0.95, 1.1], [1.0, 1.6], [0.92, 1.62], [0.88, 1.15], [0.7, 0.6], [0.3, 0.32], [0, 0.3]], 96), mat);
  const stem = mesh(lathe([[0.12, -0.6], [0.18, -0.2], [0.3, 0.22], [0, 0.22]], 48), mat);
  const base = mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.35, 64), M.candy(0x14101a, 0.2));
  base.position.y = -0.95;
  const plinth = mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.3, 64), mat);
  plinth.position.y = -0.63;
  for (const s of [-1, 1]) {
    const h = mesh(new THREE.TorusGeometry(0.42, 0.07, 16, 48, Math.PI * 1.2), mat);
    h.position.set(s * 1.05, 1.0, 0);
    h.rotation.z = s > 0 ? -Math.PI * 0.6 : Math.PI * 1.6;
    g.add(h);
  }
  const star = mesh(extrudeShape(starShape(5, 0.32, 0.14), 0.06, 0.02), M.candy(0xc8102e, 0.1));
  star.position.set(0, 1.0, 0.92);
  g.add(cup, stem, plinth, base, star);
  return g;
}

export function ring() {
  // champion's ring: gold band with a big cut stone
  const g = new THREE.Group();
  const band = mesh(new THREE.TorusGeometry(0.9, 0.22, 32, 96), M.gold());
  band.scale.set(1, 1, 0.8);
  const bezel = mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.35, 8), M.gold());
  bezel.rotation.x = Math.PI / 2;
  bezel.position.set(0, 0.95, 0.15);
  const stone = mesh(lathe([[0, 0.25], [0.35, 0.25], [0.52, 0.08], [0.52, 0.02], [0, -0.4]], 8), M.gem(0xd0102e));
  stone.rotation.x = Math.PI / 2;
  stone.position.set(0, 0.95, 0.42);
  g.add(band, bezel, stone);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const d = mesh(new THREE.OctahedronGeometry(0.07), M.chrome());
    d.position.set(Math.cos(a) * 0.62, 0.95 + Math.sin(a) * 0.62, 0.36);
    g.add(d);
  }
  g.rotation.x = -0.35;
  return g;
}

export function seriesLogo() {
  const g = new THREE.Group();
  const top = rimText('VELVET ACE', M.candy(0x14101a, 0.12), { font: 'serif', size: 0.62, depth: 0.2, bevel: 0.03 });
  top.position.y = 0.75;
  const main = rimText('POKER SERIES', M.candy(0xc8102e, 0.1), { font: 'serif', size: 1, depth: 0.3, bevel: 0.045 });
  main.position.y = -0.45;
  const spade = new THREE.Shape();
  spade.moveTo(0, 0.6);
  spade.bezierCurveTo(0.2, 0.3, 0.55, 0.15, 0.5, -0.1);
  spade.bezierCurveTo(0.45, -0.35, 0.15, -0.35, 0.05, -0.15);
  spade.lineTo(0.15, -0.5);
  spade.lineTo(-0.15, -0.5);
  spade.lineTo(-0.05, -0.15);
  spade.bezierCurveTo(-0.15, -0.35, -0.45, -0.35, -0.5, -0.1);
  spade.bezierCurveTo(-0.55, 0.15, -0.2, 0.3, 0, 0.6);
  for (const s of [-1, 1]) {
    const sp = mesh(extrudeShape(spade, 0.2, 0.04), M.gold());
    sp.position.set(s * 3.6, 0.75, 0);
    g.add(sp);
  }
  g.add(top, main);
  return g;
}

export function pill(color) {
  const g = new THREE.Group();
  const rim = mesh(extrudeShape(roundedRectShape(3.16, 1.16, 0.5), 0.16, 0.05), M.gold());
  const body = mesh(extrudeShape(roundedRectShape(3, 1, 0.42), 0.24, 0.07), M.candy(color, 0.1));
  body.position.z = 0.06;
  g.add(rim, body);
  return g;
}

export { text3d };

// ------------------------------------------------------------------ table games
/**
 * A casino table seen from above, 1080x2340 (the game's 1080x1920 layout sits in
 * the middle, 210px in from the top): felt with printed text, the dealer's chip
 * tray and card shoe on the straight top edge, and a padded rail curving across
 * the bottom with a dark ledge below it for the controls.
 */
export function renderCardTable(cfg) {
  const W = 1080;
  const H = 2340;
  const OY = 210; // game y = image y - OY
  renderer.setSize(W, H);
  const scene = studio(0.45);
  scene.background = new THREE.Color(0x0a0608);
  const P = (x, y) => [x - W / 2, y + OY - H / 2]; // game px -> world (x, z up the screen)
  const feltTex = canvasTex(1080, 2340, (g, w, h) => {
    const base = new THREE.Color(cfg.felt);
    const grd = g.createRadialGradient(w / 2, h * 0.42, 60, w / 2, h * 0.45, h * 0.62);
    grd.addColorStop(0, `#${base.clone().offsetHSL(0, 0, 0.1).getHexString()}`);
    grd.addColorStop(0.6, cfg.felt);
    grd.addColorStop(1, `#${base.clone().offsetHSL(0, 0, -0.12).getHexString()}`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.05;
    for (let i = 0; i < 70000; i++) {
      g.fillStyle = i % 2 ? '#ffffff' : '#000000';
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    g.globalAlpha = 1;
    g.textAlign = 'center';
    for (const t of cfg.prints ?? []) {
      g.fillStyle = t.color ?? 'rgba(233,200,106,0.75)';
      g.font = t.font;
      if (t.arc) {
        // text along an arc (centre cx, cy, radius r), like the printing on a real layout
        const chars = [...t.text];
        const spread = t.spread ?? 0.9;
        chars.forEach((ch, k) => {
          const a = -Math.PI / 2 + (k / (chars.length - 1) - 0.5) * spread;
          g.save();
          g.translate(t.x + Math.cos(a) * t.arc, t.y + OY + Math.sin(a) * t.arc);
          g.rotate(a + Math.PI / 2);
          g.fillText(ch, 0, 0);
          g.restore();
        });
      } else g.fillText(t.text, t.x, t.y + OY);
    }
    for (const l of cfg.lines ?? []) {
      g.strokeStyle = l.color ?? 'rgba(233,200,106,0.45)';
      g.lineWidth = l.width ?? 4;
      g.beginPath();
      g.arc(l.x, l.y + OY, l.r, l.a0, l.a1);
      g.stroke();
    }
  });
  const felt = mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.95 }));
  felt.rotation.x = -Math.PI / 2;
  scene.add(felt);
  // dealer side: wood strip across the top with a chip tray and a shoe
  const woodTex = canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = '#4a2210';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      g.strokeStyle = `rgba(${110 + Math.random() * 60},${50 + Math.random() * 30},18,0.5)`;
      g.lineWidth = 1 + Math.random() * 2;
      g.beginPath();
      const y = Math.random() * h;
      g.moveTo(0, y);
      g.bezierCurveTo(w / 3, y + 5, (2 * w) / 3, y - 5, w, y);
      g.stroke();
    }
  });
  const woodM = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.3, clearcoat: 1, envMapIntensity: 0.6 });
  const top = mesh(new THREE.BoxGeometry(W + 40, 30, 300), woodM);
  const [, tz] = P(0, -60);
  top.position.set(0, 15, tz);
  scene.add(top);
  if (cfg.tray) {
    const [tx, tz2] = P(540, 165);
    const tray = mesh(new THREE.BoxGeometry(520, 34, 110), new THREE.MeshPhysicalMaterial({ color: 0x1a1018, roughness: 0.4, clearcoat: 0.5 }));
    tray.position.set(tx, 18, tz2);
    scene.add(tray);
    const vals = [10, 50, 100, 500, 1000, 5000];
    // stacks of chips lying flat in two rows, tops showing
    vals.forEach((v, k) => {
      for (const row of [-1, 1]) {
        const stackH = 4 + ((k + row + 3) % 3);
        for (let h = 0; h < stackH; h++) {
          const ch = chip(v);
          ch.scale.set(34, 34, 34);
          ch.position.set(tx - 210 + k * 84 + (h % 2) * 1.5, 40 + h * 7.5, tz2 + row * 26);
          ch.rotation.y = h * 0.7;
          scene.add(ch);
        }
      }
    });
  }
  if (cfg.shoe) {
    const [sx, sz] = P(cfg.shoe.x, cfg.shoe.y);
    const shoe = mesh(new THREE.BoxGeometry(150, 110, 220), new THREE.MeshPhysicalMaterial({ color: 0x14100e, roughness: 0.35, clearcoat: 0.8 }));
    shoe.position.set(sx, 55, sz);
    shoe.rotation.y = -0.2;
    const lip = mesh(new THREE.BoxGeometry(150, 20, 40), M.gold());
    lip.position.set(sx - 10, 100, sz + 110);
    lip.rotation.y = -0.2;
    scene.add(shoe, lip);
  }
  // padded rail across the bottom (a long arc), dark ledge below it
  const railY = cfg.railY ?? 1530;
  const R = 2730;
  const cy = railY - R;
  const pts = [];
  for (let k = 0; k <= 120; k++) {
    const a = Math.PI / 2 + (k / 120 - 0.5) * 0.9;
    const gx = 540 + Math.cos(a) * R;
    const gy = cy + Math.sin(a) * R;
    const [wx, wz] = P(gx, gy);
    pts.push(new THREE.Vector3(wx, 30, wz));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const rail = mesh(new THREE.TubeGeometry(curve, 240, 46, 24), new THREE.MeshPhysicalMaterial({ color: 0x0c0a0e, roughness: 0.55, clearcoat: 0.35, envMapIntensity: 0.4 }));
  rail.scale.y = 0.7;
  const stitch = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 62, p.z))), 480, 1.5, 6), new THREE.MeshStandardMaterial({ color: 0xc9962a }));
  const inlay = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x, 6, p.z + 52))), 480, 3, 8), M.gold());
  scene.add(rail, stitch, inlay);
  // ledge: dark leather below the rail
  const ledgeShape = new THREE.Shape();
  // left to right along the rail, so the ledge outline doesn't cross itself
  const lp = pts.map((p) => [p.x, -p.z]).sort((u, v) => u[0] - v[0]);
  ledgeShape.moveTo(-W, -H);
  ledgeShape.lineTo(-W, lp[0][1]);
  lp.forEach(([x, y]) => ledgeShape.lineTo(x, y));
  ledgeShape.lineTo(W, lp[lp.length - 1][1]);
  ledgeShape.lineTo(W, -H);
  const ledge = mesh(new THREE.ShapeGeometry(ledgeShape, 64), new THREE.MeshPhysicalMaterial({ color: 0x120c14, roughness: 0.7, clearcoat: 0.2 }));
  ledge.rotation.x = -Math.PI / 2;
  ledge.position.y = 2;
  scene.add(ledge);
  const lamp = new THREE.SpotLight(0xfff0d8, 1.6, 0, 0.9, 0.8, 0);
  lamp.position.set(0, 2400, 200);
  lamp.target.position.set(0, 0, 0);
  scene.add(lamp, lamp.target);
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 6000);
  cam.position.set(0, 3000, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/jpeg', 0.88);
}

// ------------------------------------------------------------------ roulette wheel
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/** The spinning part of the wheel (numbers, pockets, cone, turret), seen from above, transparent outside. */
export function rouletteRotor(size = 920) {
  const R = size / 2.3; // same proportions as the game's painted wheel (pocket ring radius)
  const n = WHEEL_ORDER.length;
  const step = (Math.PI * 2) / n;
  const numTex = canvasTex(1024, 1024, (g, w) => {
    const c = w / 2;
    const r = w / 2;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * step - step / 2;
      const num = WHEEL_ORDER[i];
      g.fillStyle = num === 0 ? '#0f8a4a' : REDS.has(num) ? '#c8102e' : '#16161c';
      g.beginPath();
      g.moveTo(c, c);
      g.arc(c, c, r, a0, a0 + step);
      g.closePath();
      g.fill();
    }
    for (let i = 0; i < n; i++) {
      g.save();
      g.translate(c, c);
      g.rotate(i * step);
      g.font = '900 46px Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.fillText(String(WHEEL_ORDER[i]), 0, -r * 0.88);
      g.restore();
    }
  });
  const grp = new THREE.Group();
  // number ring (flat, slightly raised outer edge)
  const ring = mesh(new THREE.RingGeometry(R * 0.62, R, 148, 1), new THREE.MeshPhysicalMaterial({ map: numTex, roughness: 0.3, clearcoat: 1 }));
  // map the texture with planar uvs
  const uv = ring.geometry.attributes.uv;
  const pos = ring.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / (2 * R), 0.5 + pos.getY(i) / (2 * R));
  ring.rotation.x = -Math.PI / 2;
  grp.add(ring);
  // pocket frets (gold dividers) between number ring and cone
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step - step / 2;
    const fret = mesh(new THREE.BoxGeometry(R * 0.2, 14, 4), M.gold());
    const rr = R * 0.72;
    fret.position.set(Math.cos(a) * rr, 7, Math.sin(a) * rr);
    fret.rotation.y = -a;
    grp.add(fret);
  }
  const rim = mesh(new THREE.TorusGeometry(R, 7, 12, 148), M.gold());
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 4;
  const innerRim = mesh(new THREE.TorusGeometry(R * 0.62, 6, 12, 148), M.gold());
  innerRim.rotation.x = Math.PI / 2;
  innerRim.position.y = 6;
  grp.add(rim, innerRim);
  // wooden cone and gold turret
  const cone = mesh(lathe([[R * 0.62, 0], [R * 0.45, 30], [R * 0.16, 52], [0, 54]], 96), new THREE.MeshPhysicalMaterial({ color: 0x6a3414, roughness: 0.45, clearcoat: 0.25 }));
  const turretBase = mesh(lathe([[R * 0.16, 52], [R * 0.12, 70], [R * 0.05, 120], [R * 0.03, 160], [0, 170]], 64), M.gold());
  grp.add(cone, turretBase);
  for (let k = 0; k < 4; k++) {
    const arm = mesh(new THREE.CapsuleGeometry(7, R * 0.32, 6, 12), M.gold());
    const a = (k * Math.PI) / 2;
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = -a;
    arm.position.set(Math.cos(a) * R * 0.18, 96, Math.sin(a) * R * 0.18);
    const knob = mesh(new THREE.SphereGeometry(13, 16, 12), M.gold());
    knob.position.set(Math.cos(a) * R * 0.36, 96, Math.sin(a) * R * 0.36);
    grp.add(arm, knob);
  }
  return { grp, size };
}

/** The fixed outer bowl (wood with a ball track), drawn under the rotor. */
export function rouletteBowl(size = 920) {
  const R = size / 2.3;
  const grp = new THREE.Group();
  const wood = new THREE.MeshPhysicalMaterial({ color: 0x4a2210, roughness: 0.25, clearcoat: 1 });
  const bowl = mesh(lathe([[R * 1.15, 40], [R * 1.12, 46], [R * 1.04, 30], [R * 1.0, 0], [0, 0]], 128), wood);
  const track = mesh(new THREE.TorusGeometry(R * 1.04, 10, 12, 148), new THREE.MeshPhysicalMaterial({ color: 0x2a140a, roughness: 0.2, clearcoat: 1 }));
  track.rotation.x = Math.PI / 2;
  track.position.y = 30;
  const outer = mesh(new THREE.TorusGeometry(R * 1.14, 9, 12, 148), M.gold());
  outer.rotation.x = Math.PI / 2;
  outer.position.y = 44;
  grp.add(bowl, track, outer);
  // diamond deflectors on the track
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const d = mesh(new THREE.OctahedronGeometry(12), M.gold());
    d.position.set(Math.cos(a) * R * 1.07, 34, Math.sin(a) * R * 1.07);
    d.scale.set(1.6, 0.6, 0.8);
    d.rotation.y = -a;
    grp.add(d);
  }
  return { grp, size };
}

export function renderTopDown(obj, size) {
  renderer.setSize(size, size);
  const scene = studio(0.8);
  scene.add(obj);
  const cam = new THREE.OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 1, 4000);
  cam.position.set(0, 1500, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
}

export function ball() {
  const b = mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshPhysicalMaterial({ color: 0xf8f8f8, roughness: 0.08, clearcoat: 1 }));
  return b;
}

// ------------------------------------------------------------------ video poker cabinet
export function renderCabinet() {
  const W = 1080;
  const H = 2340;
  const OY = 210;
  renderer.setSize(W, H);
  const scene = studio(0.9);
  scene.background = new THREE.Color(0x07040c);
  const P = (x, y) => [x - W / 2, y + OY - H / 2];
  // cabinet body
  const body = mesh(new THREE.BoxGeometry(W - 10, 20, H), new THREE.MeshPhysicalMaterial({ color: 0x16101e, roughness: 0.35, metalness: 0.4, clearcoat: 0.6 }));
  scene.add(body);
  // screen bezel: chrome frame with a gold inner line around the game's screen rect (30,230)-(1050,1410)
  const [cx, cz] = P(540, 820);
  const outer = roundedRectShape(1060, 1230, 46);
  const hole = new THREE.Path();
  const iw = 1020;
  const ih = 1180;
  hole.moveTo(-iw / 2 + 30, -ih / 2);
  hole.lineTo(iw / 2 - 30, -ih / 2);
  hole.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + 30);
  hole.lineTo(iw / 2, ih / 2 - 30);
  hole.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - 30, ih / 2);
  hole.lineTo(-iw / 2 + 30, ih / 2);
  hole.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - 30);
  hole.lineTo(-iw / 2, -ih / 2 + 30);
  hole.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + 30, -ih / 2);
  outer.holes.push(hole);
  const bezel = mesh(extrudeShape(outer, 24, 8, 24), M.chrome());
  bezel.rotation.x = -Math.PI / 2;
  bezel.position.set(cx, 20, cz);
  scene.add(bezel);
  const screen = mesh(new THREE.PlaneGeometry(iw, ih), new THREE.MeshBasicMaterial({ color: 0x0b1a5c }));
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(cx, 12, cz);
  scene.add(screen);
  // topper: lit sign above the screen
  const [tx, tz] = P(540, 60);
  const topper = mesh(new RoundedBoxGeometry(980, 40, 220, 4, 18), new THREE.MeshPhysicalMaterial({ color: 0x2a0a40, roughness: 0.3, clearcoat: 1 }));
  topper.position.set(tx, 20, tz);
  const sign = mesh(text3d('VIDEO POKER', { font: 'serif', size: 96, depth: 20, bevel: 3 }), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffc040, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.3 }));
  sign.rotation.x = -Math.PI / 2;
  sign.position.set(tx, 50, tz);
  scene.add(topper, sign);
  for (let k = 0; k < 22; k++) {
    for (const dz of [-95, 95]) {
      const b = mesh(new THREE.SphereGeometry(8, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe0a0).multiplyScalar(2), toneMapped: false }));
      b.position.set(tx - 470 + k * 44.7, 45, tz + dz);
      scene.add(b);
    }
  }
  // button deck below the screen
  const [dx, dz] = P(540, 1640);
  const deck = mesh(new RoundedBoxGeometry(1040, 30, 480, 4, 20), new THREE.MeshPhysicalMaterial({ color: 0x241a2e, roughness: 0.3, metalness: 0.5, clearcoat: 0.8 }));
  deck.position.set(dx, 15, dz);
  const trim = mesh(new RoundedBoxGeometry(1050, 10, 8, 2, 3), M.gold());
  trim.position.set(dx, 32, dz - 240);
  scene.add(deck, trim);
  const cam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 1, 6000);
  cam.position.set(0, 3000, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/jpeg', 0.88);
}
