// 3D slot symbols. Each builder returns a THREE.Object3D centered near the origin.
import { M, THREE, extrudeShape, lathe, leafShape, rimText, roundedRectShape, starShape, text3d, tube } from './kit.js';

const mesh = (g, m) => new THREE.Mesh(g, m);

// ------------------------------------------------------------------ fruit and classics
function cherry() {
  const g = new THREE.Group();
  const red = M.candy(0xd0101c, 0.12);
  const b1 = mesh(new THREE.SphereGeometry(0.62, 64, 48), red);
  b1.position.set(-0.55, -0.55, 0.1);
  const b2 = mesh(new THREE.SphereGeometry(0.66, 64, 48), red);
  b2.position.set(0.6, -0.7, -0.1);
  // little dimples where the stems join
  const stemM = M.candy(0x2f8a1e, 0.35);
  const s1 = mesh(tube([[-0.5, -0.05, 0.1], [-0.3, 0.6, 0], [0.15, 1.15, 0], [0.3, 1.35, 0]], 0.06), stemM);
  const s2 = mesh(tube([[0.58, -0.1, -0.1], [0.55, 0.5, -0.05], [0.4, 1.1, 0], [0.3, 1.35, 0]], 0.06), stemM);
  const leaf = mesh(extrudeShape(leafShape(1.0, 0.42), 0.04, 0.03), M.candy(0x3fae2a, 0.3));
  leaf.position.set(0.75, 1.25, 0);
  leaf.rotation.set(0.3, 0, -1.1);
  g.add(b1, b2, s1, s2, leaf);
  return g;
}

function lemon() {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 72, 48);
  // pointed ends
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const tip = Math.pow(Math.abs(x), 6) * 0.35;
    p.setX(i, x * (1 + tip));
  }
  geo.computeVertexNormals();
  const body = mesh(geo, M.candy(0xffd21a, 0.28));
  body.scale.set(1.25, 0.88, 0.88);
  body.rotation.z = 0.35;
  const leaf = mesh(extrudeShape(leafShape(0.9, 0.38), 0.04, 0.03), M.candy(0x3fae2a, 0.3));
  leaf.position.set(-0.9, 0.55, 0.2);
  leaf.rotation.set(0.2, 0, 0.9);
  g.add(body, leaf);
  return g;
}

function plum() {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(1, 72, 48), M.candy(0x6a1aa8, 0.14));
  body.scale.set(1, 1.08, 0.95);
  // the seam
  const seam = mesh(new THREE.TorusGeometry(1.0, 0.03, 8, 64, Math.PI * 0.8), M.candy(0x4a0a80, 0.2));
  seam.rotation.set(0, Math.PI / 2 - 0.25, Math.PI / 2 + 0.1);
  const stem = mesh(tube([[0, 0.95, 0], [0.05, 1.25, 0], [0.18, 1.42, 0]], 0.06), M.candy(0x6a4a20, 0.5));
  const leaf = mesh(extrudeShape(leafShape(0.9, 0.36), 0.04, 0.03), M.candy(0x3fae2a, 0.3));
  leaf.position.set(0.55, 1.25, 0.1);
  leaf.rotation.set(0.3, 0, -1.2);
  g.add(body, seam, stem, leaf);
  return g;
}

function bell() {
  const g = new THREE.Group();
  const prof = [[0.0, 1.25], [0.25, 1.22], [0.42, 1.1], [0.52, 0.8], [0.58, 0.4], [0.68, 0.0], [0.86, -0.45], [1.08, -0.72], [1.15, -0.82], [1.12, -0.9], [0.0, -0.9]];
  const body = mesh(lathe(prof, 96), M.gold());
  const lip = mesh(new THREE.TorusGeometry(1.1, 0.07, 16, 96), M.gold());
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.86;
  const clapper = mesh(new THREE.SphereGeometry(0.24, 32, 24), M.darkGold());
  clapper.position.y = -1.05;
  const knob = mesh(new THREE.TorusGeometry(0.2, 0.07, 16, 48), M.gold());
  knob.position.y = 1.4;
  const band = mesh(new THREE.TorusGeometry(0.72, 0.05, 12, 96), M.candy(0xd0101c, 0.15));
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.1;
  g.add(body, lip, clapper, knob, band);
  g.rotation.set(-0.15, 0, -0.12);
  return g;
}

function bar() {
  const g = new THREE.Group();
  const plate = mesh(extrudeShape(roundedRectShape(2.6, 1.1, 0.22), 0.28, 0.06), M.candy(0x14141c, 0.25));
  const rim = mesh(extrudeShape(roundedRectShape(2.78, 1.28, 0.28), 0.18, 0.05), M.gold());
  rim.position.z = -0.08;
  const t = mesh(text3d('BAR', { font: 'sans', size: 0.62, depth: 0.12, bevel: 0.025 }), M.gold());
  t.position.z = 0.22;
  g.add(rim, plate, t);
  return g;
}

function seven() {
  const g = rimText('7', M.candy(0xe0101a, 0.12), { font: 'serif', size: 2, depth: 0.45, bevel: 0.06 });
  g.rotation.z = -0.05;
  return g;
}

function diamond() {
  // brilliant cut: table, crown and pavilion as a lathe with few segments (flat facets)
  const prof = [[0.0, 0.55], [0.55, 0.55], [1.0, 0.18], [1.0, 0.1], [0.0, -1.0]];
  const g = new THREE.Group();
  const gem = mesh(lathe(prof, 10), M.gem(0x4fb8ff));
  gem.rotation.x = 0.35;
  g.add(gem);
  return g;
}

function goldPlaque(label, { face = M.candy(0x7a0a14, 0.2), w = 2.6, h = 1.5 } = {}) {
  const g = new THREE.Group();
  const rim = mesh(extrudeShape(roundedRectShape(w + 0.22, h + 0.22, 0.32), 0.24, 0.07), M.gold());
  const plate = mesh(extrudeShape(roundedRectShape(w, h, 0.26), 0.28, 0.04), face);
  plate.position.z = 0.05;
  const t = mesh(text3d(label, { font: 'serif', size: 0.62, depth: 0.14, bevel: 0.03 }), M.gold());
  t.position.z = 0.3;
  g.add(rim, plate, t);
  return g;
}

function wildSevens() {
  const g = new THREE.Group();
  const star = mesh(extrudeShape(starShape(5, 1.35, 0.6), 0.3, 0.08), M.gold());
  star.position.z = -0.25;
  const p = goldPlaque('WILD', { w: 2.4, h: 0.95, face: M.candy(0x5a0a8a, 0.15) });
  p.position.z = 0.25;
  g.add(star, p);
  return g;
}

function scatterSevens() {
  const g = new THREE.Group();
  const coin = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.22, 96), M.gold());
  coin.rotation.x = Math.PI / 2;
  const ring = mesh(new THREE.TorusGeometry(1.3, 0.09, 16, 96), M.gold());
  const inner = mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.26, 96), M.candy(0xc8102e, 0.12));
  inner.rotation.x = Math.PI / 2;
  const star = mesh(extrudeShape(starShape(5, 0.7, 0.3), 0.12, 0.04), M.gold());
  star.position.set(0, 0.22, 0.2);
  const t = mesh(text3d('BONUS', { font: 'sans', size: 0.28, depth: 0.06, bevel: 0.012 }), M.gold());
  t.position.set(0, -0.55, 0.18);
  g.add(coin, ring, inner, star, t);
  return g;
}

// ------------------------------------------------------------------ lucky lanterns
const royalColors = { ten: 0x2f7ae0, jack: 0x18a050, queen: 0xd02a8a, king: 0x6a3ad8, ace: 0xe0281e };
function royal(id) {
  const label = { ten: '10', jack: 'J', queen: 'Q', king: 'K', ace: 'A' }[id];
  return rimText(label, M.candy(royalColors[id], 0.14), { font: 'serif', size: 1.7, depth: 0.32, bevel: 0.05 });
}

function koi() {
  const g = new THREE.Group();
  // spindle body
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    prof.push([Math.max(0.001, Math.sin(Math.PI * Math.pow(t, 0.8)) * 0.78 * (1 - t * 0.3)), -1.4 + t * 2.8]);
  }
  const bodyGeo = lathe(prof, 64);
  // orange body with white patches via vertex colors
  const pos = bodyGeo.attributes.position;
  const col = [];
  const c1 = new THREE.Color(0xff5a10);
  const c2 = new THREE.Color(0xfff4ea);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const patch = Math.sin(y * 3.1 + x * 2.0) + Math.cos(z * 4 + y * 1.3) > 0.9;
    const c = patch ? c2 : c1;
    col.push(c.r, c.g, c.b);
  }
  bodyGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = M.candy(0xffffff, 0.15);
  mat.vertexColors = true;
  const body = mesh(bodyGeo, mat);
  body.rotation.z = Math.PI / 2 + 0.25;
  body.scale.set(1, 1, 0.85);
  const finM = M.candy(0xff8a3a, 0.25);
  finM.transparent = true;
  finM.opacity = 0.92;
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.bezierCurveTo(0.6, 0.5, 1.1, 0.9, 1.2, 0.6);
  tailShape.bezierCurveTo(0.9, 0.2, 0.9, -0.2, 1.2, -0.6);
  tailShape.bezierCurveTo(1.1, -0.9, 0.6, -0.5, 0, 0);
  const tail = mesh(extrudeShape(tailShape, 0.04, 0.03), finM);
  tail.position.set(1.55, -0.32, 0);
  tail.scale.set(0.8, 0.8, 1);
  tail.rotation.z = -0.25;
  const fin = mesh(extrudeShape(leafShape(0.7, 0.35), 0.03, 0.02), finM);
  fin.position.set(0, 0.62, 0);
  fin.rotation.z = 0.6;
  const fin2 = mesh(extrudeShape(leafShape(0.55, 0.3), 0.03, 0.02), finM);
  fin2.position.set(-0.45, -0.45, 0.35);
  fin2.rotation.set(0.4, 0, 2.6);
  const eyeW = mesh(new THREE.SphereGeometry(0.12, 24, 16), M.candy(0xffffff, 0.1));
  eyeW.position.set(-0.98, 0.42, 0.45);
  const eye = mesh(new THREE.SphereGeometry(0.075, 24, 16), M.candy(0x101010, 0.05));
  eye.position.set(-1.02, 0.43, 0.55);
  const wh = M.candy(0xffb070, 0.3);
  const w1 = mesh(tube([[-1.32, 0.1, 0.2], [-1.55, -0.1, 0.3], [-1.7, -0.35, 0.3]], 0.025), wh);
  const w2 = mesh(tube([[-1.32, 0.1, -0.1], [-1.5, -0.15, -0.2], [-1.6, -0.45, -0.2]], 0.025), wh);
  g.add(body, tail, fin, fin2, eyeW, eye, w1, w2);
  return g;
}

function jadeCoin() {
  const g = new THREE.Group();
  const outer = new THREE.Shape();
  outer.absarc(0, 0, 1.3, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.moveTo(-0.32, -0.32);
  hole.lineTo(0.32, -0.32);
  hole.lineTo(0.32, 0.32);
  hole.lineTo(-0.32, 0.32);
  hole.lineTo(-0.32, -0.32);
  outer.holes.push(hole);
  const coin = mesh(extrudeShape(outer, 0.22, 0.08, 64), M.jade(0x14a060));
  const rim = mesh(new THREE.TorusGeometry(1.32, 0.07, 16, 96), M.gold());
  const inRim = mesh(new THREE.TorusGeometry(0.47, 0.05, 4, 4), M.gold());
  inRim.rotation.z = Math.PI / 4;
  inRim.position.z = 0.17;
  g.add(coin, rim, inRim);
  // four gold characters-like studs
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const s = mesh(new THREE.SphereGeometry(0.13, 24, 16), M.gold());
    s.position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0.16);
    s.scale.z = 0.5;
    g.add(s);
  }
  return g;
}

function ingot() {
  // a gold sycee: a boat with upturned ends and a dome in the middle, seen from the front
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 128, 64, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // ends sweep upward
    pos.setY(i, y + Math.pow(Math.abs(x), 2.2) * 0.75);
  }
  geo.computeVertexNormals();
  const base = mesh(geo, M.gold());
  base.scale.set(1.7, 0.9, 1.0);
  const lipGeo = new THREE.TorusGeometry(1, 0.1, 16, 128);
  const lp = lipGeo.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i);
    lp.setZ(i, lp.getZ(i) + Math.pow(Math.abs(x), 2.2) * 0.75);
  }
  lipGeo.computeVertexNormals();
  const lip = mesh(lipGeo, M.gold());
  lip.rotation.x = -Math.PI / 2;
  lip.scale.set(1.7, 1.0, 0.9);
  lip.position.y = 0.37;
  const dome = mesh(new THREE.SphereGeometry(0.7, 64, 32), M.gold());
  dome.scale.set(1, 0.85, 0.85);
  dome.position.y = 0.45;
  g.add(base, lip, dome);
  g.rotation.x = 0.35;
  return g;
}

function wildLanterns() {
  const g = new THREE.Group();
  const hex = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    i ? hex.lineTo(Math.cos(a) * 1.35, Math.sin(a) * 1.35) : hex.moveTo(Math.cos(a) * 1.35, Math.sin(a) * 1.35);
  }
  hex.closePath();
  const plate = mesh(extrudeShape(hex, 0.3, 0.06), M.jade(0x0f9a5a));
  const rimShape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    i ? rimShape.lineTo(Math.cos(a) * 1.55, Math.sin(a) * 1.55) : rimShape.moveTo(Math.cos(a) * 1.55, Math.sin(a) * 1.55);
  }
  rimShape.closePath();
  const rim = mesh(extrudeShape(rimShape, 0.2, 0.06), M.gold());
  rim.position.z = -0.08;
  const t = mesh(text3d('WILD', { font: 'serif', size: 0.6, depth: 0.14, bevel: 0.03 }), M.gold());
  t.position.z = 0.28;
  g.add(rim, plate, t);
  return g;
}

function lantern() {
  const g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    prof.push([0.35 + Math.sin(Math.PI * t) * 0.85, -1 + t * 2]);
  }
  const body = mesh(lathe(prof, 16), new THREE.MeshPhysicalMaterial({
    color: 0xe0201e, emissive: 0xff3a10, emissiveIntensity: 0.45, roughness: 0.35, clearcoat: 0.5, sheen: 0.6, sheenColor: 0xffaa66,
  }));
  // ribs
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const r = 0.36 + Math.sin(Math.PI * t) * 0.86;
      pts.push([Math.cos(a) * r, -1 + t * 2, Math.sin(a) * r]);
    }
    g.add(mesh(tube(pts, 0.025, 24), M.darkGold()));
  }
  const cap = (y, flip) => {
    const c = mesh(new THREE.CylinderGeometry(flip ? 0.42 : 0.55, flip ? 0.55 : 0.42, 0.22, 48), M.gold());
    c.position.y = y;
    return c;
  };
  const glow = mesh(new THREE.SphereGeometry(0.5, 32, 16), M.glow(0xffc040, 2.5));
  glow.scale.set(1, 1.3, 1);
  const tassel = mesh(new THREE.CylinderGeometry(0.06, 0.16, 0.6, 16), M.candy(0xffc040, 0.5));
  tassel.position.y = -1.45;
  const hook = mesh(new THREE.TorusGeometry(0.16, 0.05, 12, 32), M.gold());
  hook.position.y = 1.3;
  g.add(body, cap(1.08, false), cap(-1.08, true), tassel, hook);
  void glow;
  return g;
}

export const SETS = {
  sevens: { lemon, cherry, plum, bell, bar, seven, diamond, wild: wildSevens, scatter: scatterSevens },
  lanterns: {
    ten: () => royal('ten'), jack: () => royal('jack'), queen: () => royal('queen'), king: () => royal('king'), ace: () => royal('ace'),
    koi, coin: jadeCoin, ingot, wild: wildLanterns, scatter: lantern,
  },
};
