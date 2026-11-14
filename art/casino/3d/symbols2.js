// 3D symbols for Pharaoh's Gold, Deep Blue and Gold Rush.
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, RoundedBoxGeometry, THREE, extrudeShape, lathe, leafShape, roundedRectShape, starShape, text3d, tube } from './kit.js';

const mesh = (g, m) => new THREE.Mesh(g, m);
const lapis = () => M.candy(0x1d3aa8, 0.12);
const wood = () => new THREE.MeshPhysicalMaterial({ color: 0x7a4a22, roughness: 0.55, clearcoat: 0.3 });
const iron = () => M.metal(0x6a6e78, 0.35);

function plaque(label, face, w = 2.5, h = 1.2) {
  const g = new THREE.Group();
  const rim = mesh(extrudeShape(roundedRectShape(w + 0.24, h + 0.24, 0.3), 0.24, 0.07), M.gold());
  const plate = mesh(extrudeShape(roundedRectShape(w, h, 0.24), 0.28, 0.04), face);
  plate.position.z = 0.05;
  const t = mesh(text3d(label, { font: 'serif', size: 0.66, depth: 0.14, bevel: 0.03 }), M.gold());
  t.position.z = 0.3;
  g.add(rim, plate, t);
  return g;
}

function bonusLabel(g, y, size = 0.34) {
  const t = mesh(text3d('BONUS', { font: 'sans', size, depth: 0.08, bevel: 0.015 }), M.gold());
  t.position.set(0, y, 0.5);
  g.add(t);
}

/** Vertex-coloured stripes along an axis. */
function stripe(geo, axis, fn) {
  const p = geo.attributes.position;
  const col = [];
  for (let i = 0; i < p.count; i++) {
    const c = new THREE.Color(fn(axis === 'x' ? p.getX(i) : axis === 'y' ? p.getY(i) : p.getZ(i), p.getX(i), p.getY(i), p.getZ(i)));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
const vc = (rough = 0.15) => {
  const m = M.candy(0xffffff, rough);
  m.vertexColors = true;
  return m;
};

// ------------------------------------------------------------------ Pharaoh's Gold
const PHARAOH = {
  ankh() {
    const g = new THREE.Group();
    const loop = mesh(new THREE.TorusGeometry(0.55, 0.17, 24, 64), M.gold());
    loop.scale.set(0.8, 1.05, 1);
    loop.position.y = 0.9;
    const bar = mesh(new RoundedBoxGeometry(1.9, 0.36, 0.34, 4, 0.1), M.gold());
    bar.position.y = 0.15;
    const stem = mesh(new RoundedBoxGeometry(0.4, 1.6, 0.34, 4, 0.1), M.gold());
    stem.position.y = -0.75;
    const gem = mesh(new THREE.SphereGeometry(0.16, 32, 16), lapis());
    gem.position.set(0, 0.15, 0.2);
    g.add(loop, bar, stem, gem);
    return g;
  },
  eye() {
    const g = new THREE.Group();
    const almond = new THREE.Shape();
    almond.moveTo(-1.3, 0);
    almond.quadraticCurveTo(0, 1.0, 1.3, 0);
    almond.quadraticCurveTo(0, -0.8, -1.3, 0);
    const rim = mesh(extrudeShape(almond, 0.18, 0.08), M.gold());
    const white = mesh(extrudeShape(almond, 0.2, 0.02), M.candy(0xf6efe0, 0.2));
    white.scale.set(0.86, 0.78, 1);
    white.position.z = 0.08;
    const iris = mesh(new THREE.SphereGeometry(0.38, 48, 32), lapis());
    iris.scale.z = 0.5;
    iris.position.set(0, 0.03, 0.18);
    const pupil = mesh(new THREE.SphereGeometry(0.17, 32, 16), M.candy(0x0a0a14, 0.05));
    pupil.position.set(0, 0.03, 0.34);
    const brow = mesh(tube([[-1.3, 0.75, 0], [0, 1.15, 0.05], [1.3, 0.75, 0]], 0.1), lapis());
    const tail1 = mesh(tube([[-0.2, -0.55, 0], [-0.35, -1.1, 0.05], [-0.5, -1.4, 0]], 0.09), lapis());
    const tail2 = mesh(tube([[0.3, -0.5, 0], [0.7, -1.0, 0.05], [1.2, -1.05, 0], [1.35, -0.75, 0]], 0.09), lapis());
    g.add(rim, white, iris, pupil, brow, tail1, tail2);
    return g;
  },
  scarab() {
    const g = new THREE.Group();
    const shell = M.metal(0x10a868, 0.15);
    for (const s of [-1, 1]) {
      const w = mesh(new THREE.SphereGeometry(0.6, 48, 32, 0, Math.PI), shell);
      w.scale.set(0.95, 1.35, 0.6);
      w.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      w.position.set(s * 0.02, -0.15, 0);
      g.add(w);
    }
    const head = mesh(new THREE.SphereGeometry(0.42, 32, 24), M.metal(0x0a6a40, 0.2));
    head.scale.set(1.1, 0.7, 0.55);
    head.position.y = 0.85;
    const sun = mesh(new THREE.SphereGeometry(0.32, 32, 24), M.gold());
    sun.position.y = 1.35;
    const legM = M.gold();
    for (const s of [-1, 1])
      for (const k of [0, 1, 2]) g.add(mesh(tube([[s * 0.5, 0.3 - k * 0.5, 0], [s * 0.95, 0.4 - k * 0.55, 0.05], [s * 1.25, 0.15 - k * 0.6, 0]], 0.06), legM));
    g.add(head, sun);
    return g;
  },
  cat() {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-0.55, -1.4);
    s.quadraticCurveTo(-0.75, -0.2, -0.35, 0.4);
    s.lineTo(-0.45, 1.25);
    s.lineTo(-0.15, 0.85);
    s.quadraticCurveTo(0, 0.9, 0.15, 0.85);
    s.lineTo(0.45, 1.25);
    s.lineTo(0.35, 0.4);
    s.quadraticCurveTo(0.75, -0.2, 0.55, -1.4);
    s.closePath();
    const body = mesh(extrudeShape(s, 0.45, 0.08), M.candy(0x14141c, 0.12));
    const collar = mesh(new THREE.TorusGeometry(0.33, 0.07, 12, 48), M.gold());
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1, 0.6, 1);
    collar.position.set(0, 0.32, 0.05);
    const ear = mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 24), M.gold());
    ear.position.set(-0.32, 0.85, 0.3);
    const e1 = mesh(new THREE.SphereGeometry(0.07, 16, 8), M.glow(0x40ff90, 1.2));
    e1.position.set(-0.14, 0.62, 0.3);
    const e2 = e1.clone();
    e2.position.x = 0.14;
    g.add(body, collar, ear, e1, e2);
    return g;
  },
  pyramid() {
    const g = new THREE.Group();
    const p = mesh(new THREE.ConeGeometry(1.4, 1.7, 4, 1), new THREE.MeshPhysicalMaterial({ color: 0xe8b860, roughness: 0.45, metalness: 0.3, clearcoat: 0.4, flatShading: true }));
    p.rotation.y = Math.PI / 4;
    const cap = mesh(new THREE.ConeGeometry(0.3, 0.36, 4), M.gold());
    cap.rotation.y = Math.PI / 4;
    cap.position.y = 0.72;
    const glow = mesh(new THREE.SphereGeometry(0.12, 16, 8), M.glow(0xfff0a0, 3));
    glow.position.y = 0.95;
    g.add(p, cap, glow);
    g.rotation.y = 0.35;
    // flatten depth so the framing fits the silhouette (the camera sees it face-on)
    const outer = new THREE.Group();
    outer.add(g);
    outer.scale.set(1, 1, 0.35);
    return outer;
  },
  mask() {
    const g = new THREE.Group();
    // nemes headdress: striped flared shape
    const hd = new THREE.Shape();
    hd.moveTo(-0.7, 1.3);
    hd.quadraticCurveTo(0, 1.65, 0.7, 1.3);
    hd.lineTo(1.35, -0.4);
    hd.lineTo(1.1, -1.4);
    hd.lineTo(-1.1, -1.4);
    hd.lineTo(-1.35, -0.4);
    hd.closePath();
    const hdGeo = stripe(extrudeShape(hd, 0.3, 0.06), 'y', (y) => (Math.floor((y + 3) * 4.2) % 2 ? 0x1d3aa8 : 0xf0c040));
    const head = mesh(hdGeo, vc(0.12));
    const face = mesh(new THREE.SphereGeometry(0.72, 64, 48), M.gold());
    face.scale.set(0.85, 1.05, 0.55);
    face.position.set(0, 0.1, 0.25);
    const eyeM = M.candy(0x0a0a14, 0.1);
    for (const s of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(0.1, 16, 12), eyeM);
      e.scale.set(1.6, 0.8, 0.6);
      e.position.set(s * 0.25, 0.3, 0.6);
      g.add(e);
    }
    const beard = mesh(new RoundedBoxGeometry(0.22, 0.7, 0.2, 3, 0.08), lapis());
    beard.position.set(0, -0.9, 0.42);
    const cobra = mesh(new THREE.SphereGeometry(0.12, 16, 12), M.gold());
    cobra.position.set(0, 1.18, 0.35);
    g.add(head, face, beard, cobra);
    return g;
  },
  gem() {
    const prof = [[0.0, 0.5], [0.6, 0.5], [1.0, 0.15], [1.0, 0.05], [0.0, -1.05]];
    const gem = mesh(new THREE.LatheGeometry(prof.map(([r, h]) => new THREE.Vector2(r, h)), 8), M.gem(0x20e070));
    gem.rotation.x = 0.35;
    const g = new THREE.Group();
    g.add(gem);
    return g;
  },
  wild: () => plaque('WILD', lapis()),
  scatter() {
    const g = new THREE.Group();
    const body = mesh(new RoundedBoxGeometry(1.5, 2.6, 0.7, 5, 0.3), M.gold());
    const face = mesh(new THREE.SphereGeometry(0.42, 48, 32), M.gold());
    face.scale.set(1, 1.15, 0.5);
    face.position.set(0, 0.7, 0.35);
    const band = mesh(new RoundedBoxGeometry(1.52, 0.9, 0.72, 3, 0.1), lapis());
    band.position.y = -0.25;
    for (const s of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(0.07, 16, 8), M.candy(0x0a0a14, 0.1));
      e.position.set(s * 0.15, 0.78, 0.55);
      g.add(e);
    }
    g.add(body, face, band);
    bonusLabel(g, -0.25, 0.3);
    return g;
  },
};

// ------------------------------------------------------------------ Deep Blue
const OCEAN = {
  shell() {
    const g = new THREE.Group();
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.08 + (i / (n - 1)) * 0.84);
      const rib = mesh(new THREE.CapsuleGeometry(0.17, 1.15, 8, 16), M.candy(i % 2 ? 0xffa0b0 : 0xff8a9e, 0.2));
      rib.position.set(Math.cos(a) * 0.72, Math.sin(a) * 0.72 - 0.5, 0);
      rib.rotation.z = a - Math.PI / 2;
      rib.scale.z = 0.6;
      g.add(rib);
    }
    const hinge = mesh(new RoundedBoxGeometry(0.7, 0.3, 0.3, 3, 0.1), M.candy(0xf07a90, 0.25));
    hinge.position.y = -0.6;
    g.add(hinge);
    return g;
  },
  starfish() {
    const g = new THREE.Group();
    const s = mesh(extrudeShape(starShape(5, 1.35, 0.5), 0.35, 0.18, 32), M.candy(0xff7a1a, 0.3));
    g.add(s);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + Math.PI / 2;
      for (const r of [0.35, 0.65, 0.95]) {
        const d = mesh(new THREE.SphereGeometry(0.07, 12, 8), M.candy(0xfff0d0, 0.3));
        d.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.3);
        g.add(d);
      }
    }
    return g;
  },
  fish() {
    const g = new THREE.Group();
    const geo = stripe(new THREE.SphereGeometry(1, 64, 48), 'x', (x) => (Math.abs(x) < 0.12 || Math.abs(x - 0.55) < 0.1 || Math.abs(x + 0.55) < 0.1 ? 0x101828 : 0xffc81a));
    const body = mesh(geo, vc(0.12));
    body.scale.set(1.15, 0.85, 0.42);
    const tailS = new THREE.Shape();
    tailS.moveTo(0, 0);
    tailS.lineTo(0.8, 0.65);
    tailS.quadraticCurveTo(0.6, 0, 0.8, -0.65);
    tailS.closePath();
    const tail = mesh(extrudeShape(tailS, 0.06, 0.04), M.candy(0x1a60e0, 0.2));
    tail.position.x = 1.1;
    const fin = mesh(extrudeShape(leafShape(0.8, 0.4), 0.05, 0.03), M.candy(0x1a60e0, 0.2));
    fin.position.set(0, 0.7, 0);
    fin.rotation.z = -0.5;
    const eye = mesh(new THREE.SphereGeometry(0.15, 24, 16), M.candy(0xffffff, 0.1));
    eye.position.set(-0.75, 0.2, 0.3);
    const pupil = mesh(new THREE.SphereGeometry(0.08, 16, 12), M.candy(0x050505, 0.05));
    pupil.position.set(-0.8, 0.2, 0.42);
    g.add(body, tail, fin, eye, pupil);
    return g;
  },
  turtle() {
    const g = new THREE.Group();
    const shellGeo = new THREE.IcosahedronGeometry(1, 2);
    const shell = mesh(shellGeo, new THREE.MeshPhysicalMaterial({ color: 0x2a8a3a, roughness: 0.3, clearcoat: 1, flatShading: true }));
    shell.scale.set(1.15, 0.95, 0.55);
    const rim = mesh(new THREE.TorusGeometry(1.1, 0.1, 12, 64), M.candy(0xc8a040, 0.3));
    rim.scale.set(1.05, 0.88, 1);
    const skin = M.candy(0x6ac08a, 0.3);
    const head = mesh(new THREE.SphereGeometry(0.38, 32, 24), skin);
    head.position.set(0, 1.1, 0.1);
    for (const [x, y, r] of [[-1.05, 0.55, 0.6], [1.05, 0.55, -0.6], [-0.9, -0.75, -0.5], [0.9, -0.75, 0.5]]) {
      const f = mesh(new THREE.SphereGeometry(0.4, 24, 16), skin);
      f.scale.set(1.3, 0.5, 0.25);
      f.position.set(x, y, 0);
      f.rotation.z = r;
      g.add(f);
    }
    for (const s of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(0.06, 12, 8), M.candy(0x050505, 0.05));
      e.position.set(s * 0.15, 1.2, 0.42);
      g.add(e);
    }
    g.add(shell, rim, head);
    return g;
  },
  octopus() {
    const g = new THREE.Group();
    const m = M.candy(0xb03ad8, 0.15);
    const head = mesh(new THREE.SphereGeometry(0.85, 48, 32), m);
    head.scale.set(1, 1.15, 0.9);
    head.position.y = 0.45;
    g.add(head);
    for (let k = 0; k < 6; k++) {
      const x0 = -0.75 + k * 0.3;
      const dir = x0 < 0 ? -1 : 1;
      g.add(mesh(tube([[x0, -0.2, 0.2], [x0 + dir * 0.15, -0.8, 0.35], [x0 + dir * 0.45, -1.2, 0.3], [x0 + dir * 0.75, -1.05, 0.25], [x0 + dir * 0.7, -0.85, 0.2]], 0.12), m));
    }
    for (const s of [-1, 1]) {
      const e = mesh(new THREE.SphereGeometry(0.2, 24, 16), M.candy(0xffffff, 0.1));
      e.position.set(s * 0.32, 0.45, 0.68);
      const p = mesh(new THREE.SphereGeometry(0.1, 16, 12), M.candy(0x050505, 0.05));
      p.position.set(s * 0.32, 0.45, 0.85);
      g.add(e, p);
    }
    return g;
  },
  shark() {
    const g = new THREE.Group();
    const prof = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      prof.push([Math.max(0.001, Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.6 * (1 - t * 0.45)), -1.6 + t * 3.2]);
    }
    const geo = stripe(lathe(prof, 48), 'z', (z) => (z > 0.18 ? 0xf2f4f6 : 0x6a7a8a));
    const body = mesh(geo, vc(0.2));
    body.rotation.z = Math.PI / 2;
    body.rotation.x = Math.PI / 2;
    const finM = M.candy(0x5a6a7a, 0.25);
    const dorsal = new THREE.Shape();
    dorsal.moveTo(0, 0);
    dorsal.lineTo(0.35, 0.9);
    dorsal.quadraticCurveTo(0.5, 0.3, 0.9, 0);
    dorsal.closePath();
    const d = mesh(extrudeShape(dorsal, 0.06, 0.03), finM);
    d.position.set(-0.1, 0.75, 0);
    const tailS = new THREE.Shape();
    tailS.moveTo(0, 0);
    tailS.lineTo(0.6, 0.9);
    tailS.quadraticCurveTo(0.4, 0, 0.5, -0.6);
    tailS.closePath();
    const tail = mesh(extrudeShape(tailS, 0.06, 0.03), finM);
    tail.position.set(1.55, 0.05, 0);
    const eye = mesh(new THREE.SphereGeometry(0.07, 12, 8), M.candy(0x050505, 0.05));
    eye.position.set(-1.05, 0.15, 0.32);
    const mouth = mesh(tube([[-1.35, -0.2, 0.2], [-1.15, -0.32, 0.3], [-0.95, -0.25, 0.32]], 0.03), M.candy(0x3a0a0a, 0.3));
    g.add(body, d, tail, eye, mouth);
    return g;
  },
  pearl() {
    const g = new THREE.Group();
    const half = (up) => {
      const mat = M.candy(0xff9ab0, 0.25);
      mat.side = THREE.DoubleSide;
      const m = mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, up ? 0 : Math.PI / 2, Math.PI / 2), mat);
      m.scale.set(1.25, 0.55, 1);
      return m;
    };
    const bottom = half(false);
    bottom.position.y = -0.3;
    const top = half(true);
    top.position.set(0, 0.05, -0.55);
    top.rotation.x = -1.15;
    const pearl = mesh(new THREE.SphereGeometry(0.48, 64, 48), new THREE.MeshPhysicalMaterial({ color: 0xfff8f4, roughness: 0.12, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, sheen: 1, sheenColor: 0xffd0f0 }));
    pearl.position.y = -0.05;
    g.add(bottom, top, pearl);
    return g;
  },
  wild: () => plaque('WILD', M.candy(0x0f8a9a, 0.12)),
  scatter() {
    const g = new THREE.Group();
    const box = mesh(new RoundedBoxGeometry(2.2, 1.2, 1.2, 4, 0.1), wood());
    box.position.y = -0.4;
    const lid = mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 32, 1, false, 0, Math.PI), wood());
    lid.rotation.z = Math.PI / 2;
    lid.rotation.x = -0.9;
    lid.position.set(0, 0.35, -0.55);
    const bandM = M.gold();
    for (const x of [-0.8, 0.8]) {
      const b = mesh(new RoundedBoxGeometry(0.14, 1.24, 1.24, 2, 0.04), bandM);
      b.position.set(x, -0.4, 0);
      g.add(b);
    }
    const glow = mesh(new THREE.SphereGeometry(0.75, 32, 16), M.glow(0xffd040, 1.8));
    glow.scale.set(1.3, 0.35, 0.65);
    glow.position.y = 0.22;
    for (let k = 0; k < 7; k++) {
      const c = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 24), M.gold());
      c.position.set(-0.6 + k * 0.2, 0.3 + (k % 2) * 0.08, 0.1 * (k % 3));
      c.rotation.x = 0.6 + k * 0.3;
      g.add(c);
    }
    g.add(box, lid, glow);
    bonusLabel(g, -0.4, 0.32);
    return g;
  },
};

// ------------------------------------------------------------------ Gold Rush
function nuggetGeo(r = 1, seed = 1) {
  let geo = new THREE.IcosahedronGeometry(r, 5);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const n = 1 + 0.18 * Math.sin(v.x * 5 + seed) * Math.cos(v.y * 4 + seed * 2) + 0.1 * Math.sin(v.z * 7 + seed * 3);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const GOLDRUSH = {
  pick() {
    const g = new THREE.Group();
    const handle = mesh(new THREE.CylinderGeometry(0.16, 0.19, 2.8, 16), wood());
    handle.rotation.z = -0.7;
    const head = mesh(tube([[-1.0, 0.55, 0], [-0.2, 1.05, 0], [0.6, 1.25, 0], [1.4, 1.0, 0]], 0.2), iron());
    head.position.set(-0.35, -0.05, 0);
    const tip1 = mesh(new THREE.ConeGeometry(0.13, 0.4, 16), iron());
    tip1.position.set(-1.42, 0.38, 0);
    tip1.rotation.z = 2.3;
    g.add(handle, head, tip1);
    return g;
  },
  lantern() {
    const g = new THREE.Group();
    const glass = mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 32), new THREE.MeshPhysicalMaterial({ color: 0xffd080, emissive: 0xffa020, emissiveIntensity: 1.4, roughness: 0.1, transmission: 0.3 }));
    const flame = mesh(new THREE.SphereGeometry(0.22, 16, 12), M.glow(0xfff0a0, 4));
    flame.scale.y = 1.6;
    const top = mesh(new THREE.ConeGeometry(0.75, 0.5, 32), iron());
    top.position.y = 0.85;
    const base = mesh(new THREE.CylinderGeometry(0.72, 0.75, 0.25, 32), iron());
    base.position.y = -0.72;
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      const bar = mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), iron());
      bar.position.set(Math.cos(a) * 0.58, 0, Math.sin(a) * 0.58);
      g.add(bar);
    }
    const handle = mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 32, Math.PI), iron());
    handle.position.y = 1.1;
    g.add(glass, flame, top, base, handle);
    return g;
  },
  pan() {
    const g = new THREE.Group();
    const dish = mesh(lathe([[0, -0.15], [0.9, -0.05], [1.3, 0.25], [1.38, 0.32], [1.3, 0.33], [0.9, 0.04], [0, -0.06]], 64), iron());
    dish.rotation.x = 1.0;
    g.add(dish);
    for (let k = 0; k < 6; k++) {
      const nug = mesh(nuggetGeo(0.17 + (k % 3) * 0.05, k), M.gold());
      nug.position.set(-0.45 + (k % 3) * 0.42, -0.25 + Math.floor(k / 3) * 0.32, 0.4);
      g.add(nug);
    }
    return g;
  },
  cart() {
    const g = new THREE.Group();
    const body = mesh(new THREE.CylinderGeometry(1.25, 0.95, 1.0, 4, 1), wood());
    body.rotation.y = Math.PI / 4;
    body.scale.set(1.2, 1, 0.6);
    const rim = mesh(new RoundedBoxGeometry(2.25, 0.12, 1.15, 2, 0.04), iron());
    rim.position.y = 0.5;
    for (const x of [-0.7, 0.7]) {
      const w = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.15, 24), iron());
      w.rotation.x = Math.PI / 2;
      w.position.set(x, -0.6, 0.45);
      g.add(w);
    }
    for (let k = 0; k < 7; k++) {
      const nug = mesh(nuggetGeo(0.28, k + 3), M.gold());
      nug.position.set(-0.75 + (k % 4) * 0.5, 0.65 + Math.floor(k / 4) * 0.25, 0.05);
      g.add(nug);
    }
    g.add(body, rim);
    return g;
  },
  dynamite() {
    const g = new THREE.Group();
    const red = M.candy(0xd0201a, 0.3);
    for (const [x, z] of [[-0.42, 0], [0.42, 0], [0, 0.3]]) {
      const s = mesh(new THREE.CylinderGeometry(0.38, 0.38, 2.2, 32), red);
      s.position.set(x, 0, z);
      g.add(s);
    }
    const band = mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.18, 32), M.matte(0x2a1a0a, 0.7));
    band.scale.z = 0.7;
    band.position.z = 0.1;
    const fuse = mesh(tube([[0, 1.1, 0.3], [0.2, 1.45, 0.3], [0.5, 1.6, 0.3]], 0.04), M.matte(0x3a2a1a, 0.8));
    const spark = mesh(new THREE.SphereGeometry(0.16, 16, 8), M.glow(0xffe060, 5));
    spark.position.set(0.52, 1.62, 0.3);
    g.add(band, fuse, spark);
    g.rotation.z = -0.25;
    return g;
  },
  nugget() {
    const g = new THREE.Group();
    g.add(mesh(nuggetGeo(1, 7), M.gold()));
    return g;
  },
  bar() {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.75, 1.0, 0.7, 4, 1);
    const b = mesh(geo, M.gold());
    b.rotation.y = Math.PI / 4;
    b.scale.set(1.7, 1, 0.75);
    const t = mesh(text3d('999', { font: 'sans', size: 0.32, depth: 0.03, bevel: 0.01 }), M.darkGold());
    t.position.set(0, 0.36, 0.1);
    t.rotation.x = -Math.PI / 2 + 0.05;
    g.add(b, t);
    g.rotation.x = 0.45;
    const outer = new THREE.Group();
    outer.add(g);
    outer.scale.set(1, 1, 0.5);
    return outer;
  },
  wild: () => plaque('WILD', M.candy(0x6a2a0a, 0.15)),
  scatter() {
    const g = new THREE.Group();
    const star = mesh(extrudeShape(starShape(6, 1.4, 0.8), 0.22, 0.06), M.gold());
    g.add(star);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 2;
      const b = mesh(new THREE.SphereGeometry(0.16, 24, 16), M.gold());
      b.position.set(Math.cos(a) * 1.45, Math.sin(a) * 1.45, 0);
      g.add(b);
    }
    const disc = mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.12, 48), M.candy(0x7a1a0a, 0.2));
    disc.rotation.x = Math.PI / 2;
    disc.position.z = 0.15;
    g.add(disc);
    bonusLabel(g, 0, 0.26);
    g.children[g.children.length - 1].position.z = 0.25;
    return g;
  },
};

export const SETS2 = { pharaoh: PHARAOH, ocean: OCEAN, goldrush: GOLDRUSH };
