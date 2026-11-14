// Shared 3D helpers for the casino art renderer (runs in the browser, see render.mjs).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { THREE, RoundedBoxGeometry };

export const fonts = {};
export async function loadFonts() {
  const l = new FontLoader();
  const get = (f) => new Promise((res) => l.load(`/node_modules/three/examples/fonts/${f}.typeface.json`, res));
  fonts.serif = await get('gentilis_bold');
  fonts.sans = await get('helvetiker_bold');
  fonts.optimer = await get('optimer_bold');
}

// ------------------------------------------------------------------ materials
export const M = {
  gold: () => new THREE.MeshPhysicalMaterial({ color: 0xffd25a, metalness: 1, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.1 }),
  darkGold: () => new THREE.MeshPhysicalMaterial({ color: 0xd8a032, metalness: 1, roughness: 0.28 }),
  chrome: () => new THREE.MeshPhysicalMaterial({ color: 0xf2f4f8, metalness: 1, roughness: 0.08 }),
  candy: (c, rough = 0.18) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.15, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.05 }),
  metal: (c, rough = 0.25) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.85, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.08 }),
  gem: (c) =>
    new THREE.MeshPhysicalMaterial({ color: c, metalness: 0, roughness: 0.02, transmission: 0.55, thickness: 1.5, ior: 2.2, clearcoat: 1, flatShading: true, specularIntensity: 1, envMapIntensity: 2.4 }),
  jade: (c = 0x18a868) => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, sheenColor: 0xaaffdd }),
  matte: (c, rough = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 }),
  glow: (c, intensity = 1.5) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: intensity, roughness: 0.4 }),
};

// ------------------------------------------------------------------ geometry
/** Extruded, bevelled text centered at the origin. */
export function text3d(str, { font = 'serif', size = 1, depth = 0.25, bevel = 0.05, curve = 8 } = {}) {
  const g = new TextGeometry(str, {
    font: fonts[font], size, depth, curveSegments: curve, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 6,
  });
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2);
  return g;
}

/** Text with a gold rim: a fat gold copy behind a coloured face. */
export function rimText(str, face, opts = {}) {
  const grp = new THREE.Group();
  const front = new THREE.Mesh(text3d(str, opts), face);
  grp.add(front);
  const back = new THREE.Mesh(text3d(str, { ...opts, depth: (opts.depth ?? 0.25) * 0.6, bevel: (opts.bevel ?? 0.05) * 3.2 }), M.gold());
  back.position.z = -(opts.depth ?? 0.25) * 0.35;
  back.scale.set(1.04, 1.04, 1);
  grp.add(back);
  return grp;
}

export function extrudeShape(shape, depth = 0.2, bevel = 0.04, curve = 24) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 6, curveSegments: curve });
  g.center();
  return g;
}

export function starShape(points = 5, outer = 1, inner = 0.45) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  return s;
}

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Lathe from [radius, height] pairs. */
export function lathe(profile, segs = 64) {
  return new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), segs);
}

export function tube(points, radius, segs = 48) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.TubeGeometry(curve, segs, radius, 12, false);
}

export function leafShape(len = 1, wid = 0.45) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(wid, len * 0.45, 0, len);
  s.quadraticCurveTo(-wid, len * 0.45, 0, 0);
  return s;
}

// ------------------------------------------------------------------ rendering
let renderer;
let pmrem;
export function setupRenderer(w, h) {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);
  pmrem = new THREE.PMREMGenerator(renderer);
  return renderer;
}

/**
 * Product-shot reflections: a dark room with a few big softboxes, so metal and
 * gloss get crisp bright highlights against deep shadows (what makes gold look gold).
 */
let envTex = null;
function casinoEnv() {
  if (envTex) return envTex;
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x2a1c14);
  const box = (w, h, color, intensity, pos, look = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(...look);
    env.add(m);
  };
  box(8, 3, 0xffffff, 6, [0, 7, 3]); // big overhead softbox
  box(3, 6, 0xffe2b0, 4, [-7, 1, 4]); // warm key
  box(2, 6, 0xb8d4ff, 3.5, [7, 1, -2]); // cool rim
  box(10, 1, 0xffffff, 2.5, [0, -1, 8]); // front strip (catches bevels)
  box(4, 2, 0xff7ab0, 1.2, [0, -6, -3]); // magenta bounce from below
  box(5, 4, 0xffd890, 2.2, [-5, -4, 5]); // warm low fill, keeps gold from going black
  box(6, 3, 0xffffff, 2.0, [3, 4, -7]); // back top
  envTex = pmrem.fromScene(env, 0.02).texture;
  return envTex;
}

/** Studio scene: product-shot reflections plus a warm key light and a cool rim light. */
export function studio(envIntensity = 1) {
  const scene = new THREE.Scene();
  scene.environment = casinoEnv();
  void RoomEnvironment;
  scene.environmentIntensity = envIntensity;
  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(-3, 4, 5);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 2.0);
  rim.position.set(4, 2, -3);
  const fill = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(key, rim, fill);
  return scene;
}

/** Renders `obj` filling the frame (with `pad` margin) and returns a PNG data URL. */
export function snapshot(obj, { size = 320, width = size, height = size, pad = 0.1, tilt = [0.12, -0.18], envIntensity = 1, fov = 28 } = {}) {
  renderer.setSize(width, height);
  const scene = studio(envIntensity);
  const holder = new THREE.Group();
  holder.add(obj);
  holder.rotation.set(tilt[0], tilt[1], 0);
  scene.add(holder);
  const box = new THREE.Box3().setFromObject(holder);
  const center = box.getCenter(new THREE.Vector3());
  const dims = box.getSize(new THREE.Vector3());
  holder.position.sub(center);
  const aspect = width / height;
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100);
  const half = Math.max(dims.y / 2, dims.x / 2 / aspect);
  const dist = half / Math.tan(THREE.MathUtils.degToRad(fov / 2)) / (1 - pad) + dims.z / 2;
  cam.position.set(0, 0, dist);
  cam.lookAt(0, 0, 0);
  renderer.render(scene, cam);
  return renderer.domElement.toDataURL('image/png');
}

export { renderer };
