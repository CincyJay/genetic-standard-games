// Casino interiors rendered as full-screen backdrops (1080x1920): carpet, rows of
// lit slot cabinets or gaming tables, ceiling downlights and a glowing room sign,
// with bloom and depth of field so they read as a photo and stay behind the UI.
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { M, RoundedBoxGeometry, THREE, renderer, text3d } from './kit.js';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

/** Classic casino carpet: deep base, gold and jewel-tone motifs. */
function carpet(base, a, b, c) {
  return canvasTex(512, 512, (g, w) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, w);
    const motif = (x, y, s) => {
      g.strokeStyle = a;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = b;
      for (let k = 0; k < 8; k++) {
        const an = (k / 8) * Math.PI * 2;
        g.beginPath();
        g.ellipse(x + Math.cos(an) * s * 0.62, y + Math.sin(an) * s * 0.62, s * 0.22, s * 0.1, an, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, s * 0.25, 0, Math.PI * 2);
      g.fill();
    };
    for (const [x, y] of [[0, 0], [256, 256], [512, 0], [0, 512], [512, 512]]) motif(x, y, 110);
    for (const [x, y] of [[256, 0], [0, 256], [512, 256], [256, 512]]) {
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.strokeStyle = c;
      g.lineWidth = 4;
      g.strokeRect(-40, -40, 80, 80);
      g.restore();
    }
  }, 46);
}

/** A slot machine screen: colourful reels-ish glow. */
function screenTex(hue) {
  return canvasTex(128, 192, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, `hsl(${hue},90%,55%)`);
    grd.addColorStop(1, `hsl(${(hue + 40) % 360},90%,25%)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        g.fillStyle = `hsl(${(hue + 120 + (r * 3 + c) * 40) % 360},95%,70%)`;
        g.beginPath();
        g.arc(22 + c * 42, 70 + r * 36, 13, 0, Math.PI * 2);
        g.fill();
      }
    g.fillStyle = `hsl(${(hue + 180) % 360},100%,75%)`;
    g.fillRect(8, 8, w - 16, 34);
  });
}

function cabinet(hue) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.0, 1.9, 0.8, 4, 0.08), M.metal(0x1a1420, 0.35));
  body.position.y = 0.95;
  const trim = new THREE.Mesh(new RoundedBoxGeometry(1.04, 0.08, 0.84, 2, 0.03), M.gold());
  trim.position.y = 1.0;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshBasicMaterial({ map: screenTex(hue), toneMapped: false }));
  screen.position.set(0, 1.45, 0.41);
  screen.material.color.multiplyScalar(1.6);
  const topper = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.45, 0.5, 3, 0.15), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.9, 0.5), emissive: new THREE.Color().setHSL(hue / 360, 0.95, 0.55), emissiveIntensity: 2.2 }));
  topper.position.y = 2.15;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: 0x18121c, emissive: 0x3a2a60, emissiveIntensity: 0.5, roughness: 0.4 }));
  deck.position.set(0, 0.92, 0.52);
  deck.rotation.x = 0.35;
  const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.12, 24), M.candy(0x6a0a18, 0.3));
  stool.position.set(0, 0.7, 1.1);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 12), M.chrome());
  pole.position.set(0, 0.35, 1.1);
  g.add(body, trim, screen, topper, deck, stool, pole);
  return g;
}

function table(kind) {
  const g = new THREE.Group();
  const felt = kind === 'roulette' ? 0x0f6a3a : kind === 'poker' ? 0x0f6a3a : 0x0f5a32;
  if (kind === 'blackjack') {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1.4, 0, Math.PI, true);
    shape.lineTo(-1.4, 0);
    const top = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.08, bevelSegments: 4 }), M.matte(felt, 0.9));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.9;
    g.add(top);
  } else {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 64), M.matte(felt, 0.9));
    top.scale.z = kind === 'poker' ? 0.6 : 1;
    top.position.y = 0.92;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 16, 64), M.candy(0x4a1e0a, 0.3));
    rim.rotation.x = Math.PI / 2;
    rim.scale.y = kind === 'poker' ? 0.6 : 1;
    rim.position.y = 0.98;
    g.add(top, rim);
    if (kind === 'roulette') {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.15, 37), M.gold());
      wheel.position.set(0.6, 1.05, 0);
      g.add(wheel);
    }
  }
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 0.9, 24), M.metal(0x1a1010, 0.4));
  leg.position.y = 0.45;
  g.add(leg);
  // pendant lamp above
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a1a0a, emissive: 0xffb050, emissiveIntensity: 0.4, side: THREE.DoubleSide }));
  shade.position.y = 3.0;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd890).multiplyScalar(6), toneMapped: false }));
  bulb.position.y = 2.85;
  const light = new THREE.PointLight(0xffc070, 6, 5, 1.5);
  light.position.y = 2.7;
  g.add(shade, bulb, light);
  // chairs
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.15 + (i / 4) * 0.7);
    const ch = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.7, 0.42, 2, 0.1), M.candy(0x5a0a20, 0.35));
    ch.position.set(Math.cos(a) * 1.9, 0.4, Math.sin(a) * 1.9 * (kind === 'poker' ? 0.75 : 1));
    ch.lookAt(0, 0.5, 0);
    g.add(ch);
  }
  return g;
}

function sign(label, color) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(text3d(label, { font: 'serif', size: 0.9, depth: 0.15, bevel: 0.03 }), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), toneMapped: false }));
  const back = new THREE.Mesh(new RoundedBoxGeometry(label.length * 0.75 + 1.2, 1.7, 0.2, 3, 0.2), M.metal(0x140a18, 0.3));
  back.position.z = -0.2;
  g.add(back, t);
  // bulbs around the sign
  const w = label.length * 0.75 + 1.0;
  for (let i = 0; i <= 18; i++) {
    for (const y of [0.72, -0.72]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe0a0).multiplyScalar(5), toneMapped: false }));
      b.position.set(-w / 2 + (i / 18) * w, y, 0);
      g.add(b);
    }
  }
  return g;
}

const ROOMS = {
  lobby: { sign: 'VELVET ACE', signColor: 0xffc860, carpet: ['#2a0718', '#c9962a', '#7a1a5a', '#1d6a8a'], kind: 'mixed', fog: 0x1a0612, hues: [300, 40, 330, 200, 280] },
  slots: { sign: 'SLOTS', signColor: 0xff5ab0, carpet: ['#1a0624', '#c9962a', '#5a1a8a', '#c8102e'], kind: 'cabinets', fog: 0x14051c, hues: [320, 280, 200, 40, 0, 180] },
  poker: { sign: 'POKER ROOM', signColor: 0x7affb0, carpet: ['#081a12', '#c9962a', '#0f5a3a', '#7a1a1a'], kind: 'poker', fog: 0x06120c, hues: [140] },
  tables: { sign: 'TABLE GAMES', signColor: 0xffd060, carpet: ['#200808', '#c9962a', '#8a1a1a', '#0f5a3a'], kind: 'tables', fog: 0x160606, hues: [30] },
};

export function renderRoom(id, W = 1080, H = 1920) {
  seed = 11;
  const cfg = ROOMS[id];
  renderer.setSize(W, H);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cfg.fog);
  scene.fog = new THREE.Fog(cfg.fog, 14, 42);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const hemi = new THREE.HemisphereLight(0xffd8a0, 0x200a20, 0.6);
  scene.add(hemi);
  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 80), new THREE.MeshStandardMaterial({ map: carpet(...cfg.carpet), roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -20;
  scene.add(floor);
  // ceiling with downlights
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(60, 80), M.matte(0x0c0608, 0.9));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 5.2, -20);
  scene.add(ceil);
  for (let z = 4; z > -40; z -= 3)
    for (const x of [-6, -2, 2, 6]) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0d0).multiplyScalar(2.2), toneMapped: false }));
      d.rotation.x = Math.PI / 2;
      d.position.set(x, 5.18, z);
      scene.add(d);
    }
  // contents
  const place = (obj, x, z, ry) => {
    obj.position.set(x, 0, z);
    obj.rotation.y = ry;
    scene.add(obj);
  };
  const cabRow = (x, ry, z0, z1) => {
    for (let z = z0; z > z1; z -= 1.15) place(cabinet(cfg.hues[Math.floor(rnd() * cfg.hues.length)]), x, z, ry);
  };
  if (cfg.kind === 'cabinets' || cfg.kind === 'mixed') {
    cabRow(-1.9, Math.PI / 2, 3, -26);
    cabRow(1.9, -Math.PI / 2, 3, -26);
    cabRow(-3.7, -Math.PI / 2, 3, -26);
    cabRow(3.7, Math.PI / 2, 3, -26);
  }
  if (cfg.kind === 'mixed') {
    // chandeliers over the aisle
    for (const z of [-4, -12, -20]) {
      const ch = new THREE.Group();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe8c0).multiplyScalar(4), toneMapped: false }));
        crystal.position.set(Math.cos(a) * 0.9, -0.3 - (i % 3) * 0.15, Math.sin(a) * 0.9);
        ch.add(crystal);
      }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 8, 48), M.gold());
      ring.rotation.x = Math.PI / 2;
      ch.add(ring);
      ch.position.set(0, 4.4, z);
      const l = new THREE.PointLight(0xffd090, 10, 9, 1.5);
      l.position.set(0, 3.8, z);
      scene.add(ch, l);
    }
  }
  if (cfg.kind === 'poker' || cfg.kind === 'tables') {
    const kinds = cfg.kind === 'poker' ? ['poker'] : ['blackjack', 'roulette'];
    let k = 0;
    for (let z = -1; z > -30; z -= 5.5)
      for (const x of [-2.4, 2.4]) place(table(kinds[k++ % kinds.length]), x, z + (x > 0 ? 2.5 : 0), x > 0 ? -0.4 : 0.4);
    // slot cabinets lining the far walls for depth
    cabRow(-5.5, Math.PI / 2, 2, -30);
    cabRow(5.5, -Math.PI / 2, 2, -30);
  }
  const s = sign(cfg.sign, cfg.signColor);
  s.position.set(0, cfg.kind === 'poker' || cfg.kind === 'tables' ? 3.9 : 3.4, -15);
  s.scale.setScalar(0.9);
  scene.add(s);
  // camera low in the aisle, looking down the room
  const cam = new THREE.PerspectiveCamera(62, W / H, 0.1, 120);
  const tablesRoom = cfg.kind === 'poker' || cfg.kind === 'tables';
  cam.position.set(0, tablesRoom ? 3.1 : 1.55, 7);
  cam.lookAt(0, tablesRoom ? 1.2 : 1.9, -12);
  const composer = new EffectComposer(renderer);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new BokehPass(scene, cam, { focus: 15, aperture: 0.0012, maxblur: 0.006 }));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.5, 0.85));
  composer.addPass(new OutputPass());
  composer.render();
  return renderer.domElement.toDataURL('image/jpeg', 0.86);
}
