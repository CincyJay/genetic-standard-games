// Machine controls rendered in 3D: spin button, +/- bet buttons, auto pill, bet panel.
import { M, RoundedBoxGeometry, THREE, extrudeShape, roundedRectShape, text3d } from './kit.js';

const mesh = (g, m) => new THREE.Mesh(g, m);

function disc(r, face, label, labelSize) {
  const g = new THREE.Group();
  const rim = mesh(new THREE.TorusGeometry(r, r * 0.11, 24, 96), M.gold());
  const base = mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.05, r * 0.25, 96), M.darkGold());
  base.rotation.x = Math.PI / 2;
  base.position.z = -r * 0.12;
  // domed glossy face
  const dome = mesh(new THREE.SphereGeometry(r * 0.98, 96, 48, 0, Math.PI * 2, 0, Math.PI * 0.32), face);
  dome.rotation.x = Math.PI / 2;
  dome.scale.set(1, 0.35, 1);
  dome.position.z = -r * 0.05;
  g.add(base, rim, dome);
  if (label) {
    const t = mesh(text3d(label, { font: 'sans', size: labelSize, depth: r * 0.08, bevel: r * 0.015 }), M.candy(0xfff8ee, 0.1));
    t.position.z = r * 0.32;
    g.add(t);
  }
  return g;
}

function plusMinus(plus) {
  const g = disc(1, M.candy(0x5a1a8a, 0.12));
  const bar = (rot) => {
    const b = mesh(new RoundedBoxGeometry(1.0, 0.24, 0.16, 3, 0.07), M.candy(0xfff8ee, 0.1));
    b.position.z = 0.36;
    b.rotation.z = rot;
    return b;
  };
  g.add(bar(0));
  if (plus) g.add(bar(Math.PI / 2));
  return g;
}

function pill(w, h, face, label, size) {
  const g = new THREE.Group();
  const rim = mesh(extrudeShape(roundedRectShape(w + 0.16, h + 0.16, (h + 0.16) / 2), 0.16, 0.05), M.gold());
  const body = mesh(extrudeShape(roundedRectShape(w, h, h / 2), 0.22, 0.06), face);
  body.position.z = 0.06;
  g.add(rim, body);
  if (label) {
    const t = mesh(text3d(label, { font: 'sans', size, depth: 0.06, bevel: 0.012 }), M.candy(0xfff8ee, 0.1));
    t.position.z = 0.24;
    g.add(t);
  }
  return g;
}

function panel() {
  const g = new THREE.Group();
  const rim = mesh(extrudeShape(roundedRectShape(4.2, 1.0, 0.3), 0.12, 0.04), M.gold());
  const glass = mesh(extrudeShape(roundedRectShape(4.0, 0.82, 0.24), 0.14, 0.03), M.candy(0x120818, 0.08));
  glass.position.z = 0.04;
  g.add(rim, glass);
  return g;
}

function coin() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(1, 1, 0.22, 96), M.gold());
  body.rotation.x = Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(1, 0.08, 16, 96), M.gold());
  const inner = mesh(new THREE.TorusGeometry(0.78, 0.04, 12, 96), M.darkGold());
  inner.position.z = 0.12;
  const star = mesh(extrudeShape(starShapeLocal(), 0.08, 0.03), M.gold());
  star.position.z = 0.14;
  g.add(body, rim, inner, star);
  return g;
}

function starShapeLocal() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.24 : 0.55;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

export const UI = {
  coin: { build: coin, w: 128, h: 128, tilt: [0.25, -0.35] },
  'btn-spin': { build: () => disc(1.3, M.candy(0x14a050, 0.1), 'SPIN', 0.5), w: 420, h: 420, tilt: [0, 0] },
  'btn-stop': { build: () => disc(1.3, M.candy(0xc8102e, 0.1), 'STOP', 0.46), w: 420, h: 420, tilt: [0, 0] },
  'btn-plus': { build: () => plusMinus(true), w: 200, h: 200, tilt: [0, 0] },
  'btn-minus': { build: () => plusMinus(false), w: 200, h: 200, tilt: [0, 0] },
  'btn-auto': { build: () => pill(2.4, 0.8, M.candy(0x5a1a8a, 0.12), 'AUTO', 0.36), w: 400, h: 150, tilt: [0, 0] },
  'btn-auto-on': { build: () => pill(2.4, 0.8, M.candy(0xc8102e, 0.12), 'STOP', 0.36), w: 400, h: 150, tilt: [0, 0] },
  'panel-bet': { build: panel, w: 640, h: 170, tilt: [0, 0] },
};
