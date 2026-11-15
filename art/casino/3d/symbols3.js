// 3D symbols for the high-limit machines: Dragon's Hoard, Diamond Empire,
// Thunder Peak, Tiger's Treasure and Cosmic Fortune. Each machine has its own
// royals (10 J Q K A in its colours) plus three premiums, a wild and a scatter.
import { M, RoundedBoxGeometry, THREE, extrudeShape, lathe, rimText, roundedRectShape, starShape, text3d, tube } from './kit.js';

const mesh = (g, m) => new THREE.Mesh(g, m);

function plaque(label, face, w = 2.5, h = 1.2, rim = M.gold()) {
  const g = new THREE.Group();
  const r = mesh(extrudeShape(roundedRectShape(w + 0.24, h + 0.24, 0.3), 0.24, 0.07), rim);
  const plate = mesh(extrudeShape(roundedRectShape(w, h, 0.24), 0.28, 0.04), face);
  plate.position.z = 0.05;
  const t = mesh(text3d(label, { font: 'serif', size: 0.66, depth: 0.14, bevel: 0.03 }), M.gold());
  t.position.z = 0.3;
  g.add(r, plate, t);
  return g;
}

function bonusLabel(g, y, size = 0.34, z = 0.6) {
  const t = mesh(text3d('BONUS', { font: 'sans', size, depth: 0.08, bevel: 0.015 }), M.gold());
  t.position.set(0, y, z);
  g.add(t);
}

/** Royals: one material per letter. */
function royalSet(mats) {
  const labels = { ten: '10', jack: 'J', queen: 'Q', king: 'K', ace: 'A' };
  return Object.fromEntries(
    Object.entries(labels).map(([id, label]) => [id, () => rimText(label, mats[id](), { font: 'serif', size: 1.7, depth: 0.32, bevel: 0.05 })]),
  );
}

function gemCut(color, r = 1, h = 1.3) {
  const prof = [[0.0, 0.42 * h], [0.62 * r, 0.42 * h], [r, 0.12 * h], [r, 0.04 * h], [0.0, -0.8 * h]];
  return mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 8), M.gem(color));
}

function crownMesh(band, gemColors = [0xc8102e, 0x2a6ae0, 0x18a050]) {
  const g = new THREE.Group();
  const ring = mesh(new THREE.CylinderGeometry(1.1, 1.0, 0.7, 48, 1, true), band);
  ring.material.side = THREE.DoubleSide;
  ring.position.y = -0.55;
  g.add(ring);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const spike = mesh(new THREE.ConeGeometry(0.22, 0.9, 16), band);
    spike.position.set(Math.cos(a) * 1.02, 0.15, Math.sin(a) * 1.02);
    const ball = mesh(new THREE.SphereGeometry(0.13, 16, 12), M.gold());
    ball.position.set(Math.cos(a) * 1.02, 0.66, Math.sin(a) * 1.02);
    g.add(spike, ball);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const gem = mesh(new THREE.SphereGeometry(0.15, 16, 12), M.gem(gemColors[i % gemColors.length]));
    gem.position.set(Math.cos(a) * 1.08, -0.55, Math.sin(a) * 1.08);
    g.add(gem);
  }
  g.rotation.x = 0.35;
  return g;
}

// ------------------------------------------------------------------ Dragon's Hoard
const DRAGON = {
  ...royalSet({
    ten: () => M.candy(0xb8101e), jack: () => M.candy(0xd8701a), queen: () => M.candy(0x8a1aa8),
    king: () => M.candy(0x18a050), ace: () => M.metal(0xffc02a, 0.2),
  }),
  chalice() {
    const prof = [[0.0, -1.3], [0.75, -1.3], [0.75, -1.15], [0.2, -1.0], [0.14, -0.3], [0.3, -0.1], [0.85, 0.35], [1.0, 1.05], [0.92, 1.1], [0.75, 0.45], [0.0, 0.2]];
    const g = new THREE.Group();
    g.add(mesh(lathe(prof), M.gold()));
    for (const [y, c] of [[-0.6, 0xc8102e], [0.65, 0x2a6ae0]]) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const r = y < 0 ? 0.18 : 0.92;
        const gem = mesh(new THREE.SphereGeometry(0.11, 16, 12), M.gem(c));
        gem.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        g.add(gem);
      }
    }
    g.rotation.x = 0.2;
    return g;
  },
  crown: () => crownMesh(M.gold()),
  chest() {
    const g = new THREE.Group();
    const wood = new THREE.MeshPhysicalMaterial({ color: 0x6a3a18, roughness: 0.55, clearcoat: 0.3 });
    const box = mesh(new RoundedBoxGeometry(2.4, 1.2, 1.4, 4, 0.08), wood);
    box.position.y = -0.5;
    const lid = mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 32, 1, false, 0, Math.PI), wood);
    lid.rotation.z = Math.PI / 2;
    lid.rotation.y = 0;
    lid.position.set(0, 0.1, -0.35);
    lid.rotation.x = -0.9;
    for (const x of [-0.9, 0, 0.9]) {
      const band = mesh(new RoundedBoxGeometry(0.16, 1.25, 1.45, 2, 0.04), M.gold());
      band.position.set(x, -0.5, 0);
      g.add(band);
    }
    // gold heaped inside
    for (let i = 0; i < 26; i++) {
      const c = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), M.gold());
      c.position.set((Math.random() - 0.5) * 2, 0.15 + Math.random() * 0.35, (Math.random() - 0.5) * 0.9);
      c.rotation.set(Math.random() * 1.5, Math.random() * 3, Math.random() * 1.5);
      g.add(c);
    }
    const ruby = gemCut(0xc8102e, 0.32, 0.5);
    ruby.position.set(0.2, 0.75, 0.2);
    g.add(box, lid, ruby);
    return g;
  },
  wild: () => plaque('WILD', M.candy(0x8a0a14, 0.12)),
  scatter() {
    // a dragon egg: scaled red shell with gold bands, glowing at the seams
    const g = new THREE.Group();
    const egg = mesh(new THREE.SphereGeometry(0.95, 64, 48), new THREE.MeshPhysicalMaterial({ color: 0xc8102e, metalness: 0.4, roughness: 0.25, clearcoat: 1, sheen: 0.8, sheenColor: 0xffaa33, emissive: 0x3a0400 }));
    egg.scale.set(0.85, 1.15, 0.85);
    g.add(egg);
    for (const y of [-0.45, 0.1, 0.62]) {
      const band = mesh(new THREE.TorusGeometry(0.85 * Math.sqrt(1 - (y / 1.1) ** 2), 0.05, 12, 64), M.gold());
      band.rotation.x = Math.PI / 2;
      band.position.y = y;
      g.add(band);
    }
    for (let i = 0; i < 14; i++) {
      const s = mesh(new THREE.ConeGeometry(0.1, 0.22, 8), M.gold());
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 1.6;
      const r = 0.82 * Math.sqrt(Math.max(0.05, 1 - (y / 1.1) ** 2));
      s.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      s.lookAt(s.position.clone().multiplyScalar(2));
      s.rotateX(Math.PI / 2);
      g.add(s);
    }
    bonusLabel(g, -0.15, 0.32, 0.95);
    return g;
  },
};

// ------------------------------------------------------------------ Diamond Empire
const EMPIRE = {
  ...royalSet({
    ten: () => M.metal(0x9fb4d8, 0.12), jack: () => M.candy(0x1a6ad8), queen: () => M.candy(0xc0207a),
    king: () => M.candy(0x5a2ad0), ace: () => M.chrome(),
  }),
  ring() {
    const g = new THREE.Group();
    const band = mesh(new THREE.TorusGeometry(0.85, 0.16, 32, 96), M.gold());
    band.position.y = -0.35;
    const setting = mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.3, 6), M.chrome());
    setting.position.y = 0.55;
    const stone = gemCut(0xd8f0ff, 0.55, 0.9);
    stone.position.y = 0.95;
    g.add(band, setting, stone);
    g.rotation.x = 0.25;
    return g;
  },
  goldbars() {
    const g = new THREE.Group();
    const bar = () => {
      const s = new THREE.Shape();
      s.moveTo(-0.95, -0.25);
      s.lineTo(0.95, -0.25);
      s.lineTo(0.75, 0.25);
      s.lineTo(-0.75, 0.25);
      s.closePath();
      const m = mesh(extrudeShape(s, 0.7, 0.05), M.gold());
      m.geometry.center();
      return m;
    };
    const spots = [[-0.98, -0.55, 0], [0.98, -0.55, 0], [0, -0.55, 0.05], [-0.5, 0.0, 0.1], [0.5, 0.0, 0.1], [0, 0.55, 0.15]];
    for (const [x, y, z] of spots) {
      const b = bar();
      b.position.set(x, y, z);
      g.add(b);
    }
    g.scale.setScalar(0.95);
    return g;
  },
  diamond() {
    const g = new THREE.Group();
    const d = gemCut(0xbfe8ff, 1.15, 1.45);
    d.rotation.x = 0.3;
    g.add(d);
    return g;
  },
  wild: () => plaque('WILD', M.candy(0x10203a, 0.12), 2.5, 1.2, M.chrome()),
  scatter() {
    const g = crownMesh(M.chrome(), [0xd8f0ff, 0xc0207a, 0x1a6ad8]);
    const velvet = mesh(new THREE.SphereGeometry(0.95, 48, 32, 0, Math.PI * 2, 0, Math.PI / 2), M.matte(0x5a0a8a, 0.5));
    velvet.position.y = -0.3;
    velvet.scale.y = 0.9;
    g.add(velvet);
    const outer = new THREE.Group();
    outer.add(g);
    bonusLabel(outer, -1.0, 0.34, 1.0);
    return outer;
  },
};

// ------------------------------------------------------------------ Thunder Peak
const THUNDER = {
  ...royalSet({
    ten: () => M.metal(0x3a6ab8, 0.2), jack: () => M.metal(0x2a9a8a, 0.2), queen: () => M.metal(0x8a4ad8, 0.2),
    king: () => M.metal(0xd84a2a, 0.2), ace: () => M.metal(0xffd23a, 0.15),
  }),
  horn() {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push([Math.cos(t * 2.4) * 1.1 - 0.3, Math.sin(t * 2.4) * 1.1 - 0.2, 0]);
    }
    const g = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const geo = new THREE.TubeGeometry(curve, 64, 0.3, 24, false);
    // taper toward the tip
    const p = geo.attributes.position;
    const center = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / 25) / 64;
      curve.getPointAt(Math.min(1, seg), center);
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).sub(center).multiplyScalar(1 - seg * 0.85).add(center);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    g.add(mesh(geo, M.candy(0xf2e6c8, 0.3)));
    for (const t of [0.12, 0.3, 0.5]) {
      const c = curve.getPointAt(t);
      const ring = mesh(new THREE.TorusGeometry(0.3 * (1 - t * 0.85) + 0.03, 0.05, 12, 32), M.gold());
      ring.position.copy(c);
      ring.lookAt(c.clone().add(curve.getTangentAt(t)));
      g.add(ring);
    }
    g.rotation.z = 0.2;
    return g;
  },
  hammer() {
    const g = new THREE.Group();
    const head = mesh(new RoundedBoxGeometry(1.9, 0.95, 0.95, 5, 0.12), M.metal(0x9aa4b8, 0.22));
    head.position.y = 0.75;
    const handle = mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.9, 24), new THREE.MeshPhysicalMaterial({ color: 0x5a3418, roughness: 0.5, clearcoat: 0.4 }));
    handle.position.y = -0.55;
    const wrap = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.6, 24), M.matte(0x2a1a10));
    wrap.position.y = -1.15;
    for (const x of [-0.7, 0.7]) {
      const band = mesh(new RoundedBoxGeometry(0.14, 1.0, 1.0, 2, 0.04), M.gold());
      band.position.set(x, 0.75, 0);
      g.add(band);
    }
    g.add(head, handle, wrap);
    g.rotation.z = -0.35;
    return g;
  },
  bolt() {
    const s = new THREE.Shape();
    s.moveTo(0.35, 1.5);
    s.lineTo(-0.75, -0.1);
    s.lineTo(-0.05, -0.1);
    s.lineTo(-0.45, -1.5);
    s.lineTo(0.8, 0.25);
    s.lineTo(0.08, 0.25);
    s.lineTo(0.55, 1.5);
    s.closePath();
    const g = new THREE.Group();
    const b = mesh(extrudeShape(s, 0.3, 0.06), new THREE.MeshPhysicalMaterial({ color: 0xffe14a, emissive: 0xffb000, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.2, clearcoat: 1 }));
    b.geometry.center();
    g.add(b);
    return g;
  },
  wild: () => plaque('WILD', M.candy(0x1a3a7a, 0.12), 2.5, 1.2, M.chrome()),
  scatter() {
    const g = new THREE.Group();
    const orb = mesh(new THREE.SphereGeometry(0.95, 64, 48), new THREE.MeshPhysicalMaterial({ color: 0x6ab8ff, transmission: 0.7, thickness: 1.2, roughness: 0.05, ior: 1.4, clearcoat: 1 }));
    const core = mesh(new THREE.SphereGeometry(0.45, 32, 24), M.glow(0x8ad8ff, 2.5));
    const s = new THREE.Shape();
    s.moveTo(0.18, 0.75);
    s.lineTo(-0.38, -0.05);
    s.lineTo(-0.02, -0.05);
    s.lineTo(-0.22, -0.75);
    s.lineTo(0.4, 0.12);
    s.lineTo(0.04, 0.12);
    s.lineTo(0.28, 0.75);
    s.closePath();
    const bolt = mesh(extrudeShape(s, 0.15, 0.03), M.glow(0xfff08a, 2));
    bolt.geometry.center();
    bolt.position.z = 0.3;
    const base = mesh(new THREE.CylinderGeometry(0.75, 0.95, 0.35, 48), M.metal(0x3a4458, 0.25));
    base.position.y = -1.0;
    g.add(orb, core, bolt, base);
    bonusLabel(g, -1.0, 0.3, 1.0);
    return g;
  },
};

// ------------------------------------------------------------------ Tiger's Treasure
const TIGER = {
  ...royalSet({
    ten: () => M.jade(0x18a868), jack: () => M.candy(0xd8701a), queen: () => M.candy(0xb8101e),
    king: () => M.candy(0x2a6ae0), ace: () => M.metal(0xffc02a, 0.2),
  }),
  emerald() {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.9, 0.9, 0.6, 8);
    const top = mesh(geo, M.gem(0x10c060));
    top.scale.set(1, 1, 1.35);
    const crown = mesh(new THREE.CylinderGeometry(0.55, 0.9, 0.35, 8), M.gem(0x10c060));
    crown.scale.set(1, 1, 1.35);
    crown.position.y = 0.47;
    const rim = mesh(new THREE.TorusGeometry(0.95, 0.07, 12, 8), M.gold());
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1, 1.35, 1);
    const grp = new THREE.Group();
    grp.add(top, crown, rim);
    grp.rotation.x = 1.15;
    g.add(grp);
    return g;
  },
  idol() {
    const g = new THREE.Group();
    const base = mesh(new RoundedBoxGeometry(1.4, 0.35, 0.9, 3, 0.06), M.darkGold());
    base.position.y = -1.2;
    const body = mesh(lathe([[0, -1.05], [0.6, -1.05], [0.5, -0.2], [0.62, 0.1], [0.35, 0.35], [0, 0.4]]), M.gold());
    const head = mesh(new THREE.SphereGeometry(0.48, 48, 32), M.gold());
    head.position.y = 0.8;
    head.scale.set(1, 1.05, 0.9);
    const hat = mesh(new THREE.ConeGeometry(0.42, 0.6, 32), M.gold());
    hat.position.y = 1.35;
    for (const s of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.09, 16, 12), M.gem(0x10c060));
      eye.position.set(s * 0.17, 0.85, 0.4);
      const ear = mesh(new THREE.SphereGeometry(0.14, 16, 12), M.gold());
      ear.position.set(s * 0.5, 0.8, 0);
      g.add(eye, ear);
    }
    const gem = mesh(new THREE.SphereGeometry(0.14, 16, 12), M.gem(0xc8102e));
    gem.position.set(0, -0.2, 0.55);
    g.add(base, body, head, hat, gem);
    return g;
  },
  tiger() {
    // a gold medallion struck with a tiger paw
    const g = new THREE.Group();
    const disc = mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.22, 64), M.gold());
    disc.rotation.x = Math.PI / 2;
    const inset = mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.24, 64), M.candy(0xd8701a, 0.2));
    inset.rotation.x = Math.PI / 2;
    const stripe = M.candy(0x1a0e06, 0.2);
    for (const [x, y, r, sx] of [[0, -0.22, 0.42, 1.25], [-0.5, 0.3, 0.17, 1], [-0.17, 0.52, 0.18, 1], [0.17, 0.52, 0.18, 1], [0.5, 0.3, 0.17, 1]]) {
      const pad = mesh(new THREE.SphereGeometry(r, 32, 24), stripe);
      pad.scale.set(sx, 1, 0.35);
      pad.position.set(x, y, 0.14);
      g.add(pad);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const stud = mesh(new THREE.SphereGeometry(0.06, 12, 8), M.gem(0x10c060));
      stud.position.set(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0.12);
      g.add(stud);
    }
    g.add(disc, inset);
    return g;
  },
  wild: () => plaque('WILD', M.jade(0x0f7a4a)),
  scatter() {
    // a golden sun disc from the temple gate
    const g = new THREE.Group();
    const sun = mesh(extrudeShape(starShape(16, 1.2, 0.95), 0.2, 0.04), M.gold());
    sun.geometry.center();
    const face = mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 64), M.candy(0xd8701a, 0.15));
    face.rotation.x = Math.PI / 2;
    const gem = gemCut(0x10c060, 0.32, 0.5);
    gem.rotation.x = -Math.PI / 2;
    gem.position.set(0, 0.25, 0.25);
    g.add(sun, face, gem);
    bonusLabel(g, -0.3, 0.3, 0.3);
    return g;
  },
};

// ------------------------------------------------------------------ Cosmic Fortune
const neon = (c) => new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.15, clearcoat: 1 });
const COSMIC = {
  ...royalSet({ ten: () => neon(0x2ad8ff), jack: () => neon(0x40e080), queen: () => neon(0xff40c0), king: () => neon(0x9a5aff), ace: () => neon(0xffd23a) }),
  rocket() {
    const g = new THREE.Group();
    const body = mesh(lathe([[0, -1.1], [0.42, -1.1], [0.5, -0.4], [0.5, 0.4], [0.35, 0.9], [0, 1.4]]), M.chrome());
    const tip = mesh(new THREE.ConeGeometry(0.2, 0.3, 32), M.candy(0xc8102e));
    tip.position.y = 1.3;
    const win = mesh(new THREE.SphereGeometry(0.2, 32, 16), M.gem(0x6ad8ff));
    win.position.set(0, 0.35, 0.42);
    win.scale.z = 0.5;
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(0.6, -0.45);
      s.lineTo(0.6, -0.8);
      s.lineTo(0, -0.5);
      s.closePath();
      const fin = mesh(extrudeShape(s, 0.08, 0.02), M.candy(0xc8102e));
      fin.position.set(0, -0.55, 0);
      fin.rotation.y = (i / 3) * Math.PI * 2;
      fin.translateX(0.42);
      g.add(fin);
    }
    const flame = mesh(new THREE.ConeGeometry(0.32, 0.9, 24), M.glow(0xff9a2a, 2.5));
    flame.rotation.x = Math.PI;
    flame.position.y = -1.5;
    g.add(body, tip, win, flame);
    g.rotation.z = -0.5;
    return g;
  },
  planet() {
    const g = new THREE.Group();
    const p = mesh(new THREE.SphereGeometry(0.85, 64, 48), new THREE.MeshPhysicalMaterial({ color: 0xd87a2a, roughness: 0.4, clearcoat: 0.6, sheen: 0.5, sheenColor: 0xffd0a0 }));
    const ring = mesh(new THREE.TorusGeometry(1.3, 0.12, 16, 96), neon(0x9a5aff));
    ring.scale.set(1, 1, 0.25);
    ring.rotation.x = 1.25;
    ring.rotation.y = 0.3;
    const moon = mesh(new THREE.SphereGeometry(0.18, 24, 16), M.chrome());
    moon.position.set(1.0, 0.85, 0.3);
    g.add(p, ring, moon);
    return g;
  },
  star() {
    const g = new THREE.Group();
    const s = mesh(extrudeShape(starShape(5, 1.35, 0.6), 0.4, 0.12), new THREE.MeshPhysicalMaterial({ color: 0xffe14a, emissive: 0xffb000, emissiveIntensity: 0.45, metalness: 0.5, roughness: 0.15, clearcoat: 1 }));
    s.geometry.center();
    g.add(s);
    return g;
  },
  wild: () => plaque('WILD', neon(0x4a1a8a), 2.5, 1.2, M.chrome()),
  scatter() {
    // a galaxy coin: a spiral of glowing arms on a dark disc
    const g = new THREE.Group();
    const disc = mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 64), M.chrome());
    disc.rotation.x = Math.PI / 2;
    const face = mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.22, 64), M.candy(0x12082a, 0.1));
    face.rotation.x = Math.PI / 2;
    g.add(disc, face);
    for (const [arm, c] of [[0, 0xff40c0], [Math.PI, 0x2ad8ff]]) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const a = arm + t * 3.6;
        pts.push([Math.cos(a) * (0.08 + t * 0.82), Math.sin(a) * (0.08 + t * 0.82), 0.14]);
      }
      g.add(mesh(tube(pts, 0.06), M.glow(c, 1.8)));
    }
    const core = mesh(new THREE.SphereGeometry(0.16, 24, 16), M.glow(0xffffff, 3));
    core.position.z = 0.15;
    g.add(core);
    bonusLabel(g, -0.62, 0.28, 0.3);
    return g;
  },
};

export const SETS3 = { dragon: DRAGON, empire: EMPIRE, thunder: THUNDER, tiger: TIGER, cosmic: COSMIC };
