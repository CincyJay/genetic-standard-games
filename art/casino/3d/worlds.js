// Themed 3D worlds behind each slot machine (1080x1920 portrait backdrops).
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { M, RoundedBoxGeometry, THREE, renderer } from './kit.js';

let seed = 3;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const glowMat = (c, k = 3, fog = true) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false, fog });

function terrain(w, d, seg, amp, freq, color, rough = 0.9) {
  const g = new THREE.PlaneGeometry(w, d, seg, seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, amp * (Math.sin(x * freq) * Math.cos(y * freq * 0.7) + 0.5 * Math.sin(x * freq * 2.3 + y * freq * 1.7)));
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: rough }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

function sky(scene, top, bottom) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top);
  grd.addColorStop(1, bottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}

function torch(x, y, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.2, 12), M.darkGold());
  pole.position.y = 1.1;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.15, 0.25, 24), M.gold());
  bowl.position.y = 2.25;
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 16), glowMat(0xff8a20, 4));
  flame.position.y = 2.7;
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), glowMat(0xfff0a0, 6));
  core.position.y = 2.5;
  const l = new THREE.PointLight(0xff9a40, 18, 10, 1.6);
  l.position.y = 2.7;
  g.add(pole, bowl, flame, core, l);
  g.position.set(x, y, z);
  return g;
}

// ------------------------------------------------------------------ worlds
const WORLDS = {
  pharaoh(scene, cam) {
    sky(scene, '#0a0a2a', '#7a3a2a');
    scene.fog = new THREE.Fog(0x4a2a2a, 20, 90);
    scene.add(new THREE.HemisphereLight(0x8a9ad8, 0x6a3a1a, 0.7));
    const moon = new THREE.DirectionalLight(0xc8d8ff, 1.2);
    moon.position.set(-10, 20, -10);
    scene.add(moon);
    const sand = terrain(200, 200, 120, 0.8, 0.08, 0xc8955a);
    sand.position.z = -60;
    scene.add(sand);
    const stone = new THREE.MeshStandardMaterial({ color: 0xd8b070, roughness: 0.8, flatShading: true });
    for (const [x, z, s] of [[-14, -55, 22], [10, -70, 30], [30, -45, 14]]) {
      const p = new THREE.Mesh(new THREE.ConeGeometry(s, s * 0.95, 4), stone);
      p.position.set(x, s * 0.45, z);
      p.rotation.y = Math.PI / 4 + x * 0.01;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(s * 0.08, s * 0.08, 4), M.gold());
      cap.position.set(x, s * 0.92, z);
      cap.rotation.y = p.rotation.y;
      scene.add(p, cap);
    }
    // temple columns lining the way
    for (const side of [-1, 1])
      for (let k = 0; k < 6; k++) {
        const z = 2 - k * 7;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 9, 24), stone);
        col.position.set(side * 5.5, 4.5, z);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.8, 0.8, 24), M.gold());
        cap.position.set(side * 5.5, 9.2, z);
        scene.add(col, cap);
        if (k % 2 === 0) scene.add(torch(side * 3.8, 0, z - 1));
      }
    for (let i = 0; i < 400; i++) {
      const st = new THREE.Mesh(new THREE.SphereGeometry(0.15 + rnd() * 0.2, 6, 4), glowMat(0xffffff, 2 + rnd() * 2, false));
      const a = rnd() * Math.PI * 2;
      st.position.set(Math.cos(a) * 150 * rnd(), 40 + rnd() * 120, -150);
      scene.add(st);
    }
    const moonM = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16), glowMat(0xfff4d8, 1.6, false));
    moonM.position.set(-25, 70, -140);
    scene.add(moonM);
    cam.position.set(0, 2.2, 10);
    cam.lookAt(0, 6, -30);
  },

  ocean(scene, cam) {
    sky(scene, '#0aa8d8', '#02142a');
    scene.fog = new THREE.FogExp2(0x0a4a6a, 0.028);
    scene.add(new THREE.HemisphereLight(0x7ae0ff, 0x02203a, 1.2));
    const sun = new THREE.DirectionalLight(0xbff4ff, 1.4);
    sun.position.set(2, 20, 2);
    scene.add(sun);
    const bed = terrain(160, 160, 120, 0.6, 0.18, 0xf0d8a8);
    bed.position.z = -40;
    scene.add(bed);
    const coralCols = [0xff4f8b, 0xff8a3a, 0xc77dff, 0xffd23f, 0x3ae0c8];
    for (let i = 0; i < 70; i++) {
      const c = coralCols[Math.floor(rnd() * coralCols.length)];
      const x = (rnd() - 0.5) * 24;
      const z = -rnd() * 40 + 4;
      if (Math.abs(x) < 2 && z > -12) continue;
      const kind = rnd();
      let m;
      if (kind < 0.4) {
        m = new THREE.Group();
        for (let b = 0; b < 5; b++) {
          const br = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.8 + rnd(), 4, 8), M.candy(c, 0.4));
          br.position.set((rnd() - 0.5) * 0.5, 0.5, (rnd() - 0.5) * 0.5);
          br.rotation.set((rnd() - 0.5) * 0.8, 0, (rnd() - 0.5) * 0.8);
          m.add(br);
        }
      } else if (kind < 0.75) {
        m = new THREE.Mesh(new THREE.SphereGeometry(0.5 + rnd() * 0.6, 16, 12), M.candy(c, 0.5));
        m.scale.y = 0.6;
      } else {
        m = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2 + rnd() * 2, 8), M.candy(c, 0.4));
        m.position.y = 1;
      }
      m.position.x = x;
      m.position.z = z;
      scene.add(m);
    }
    // light shafts from the surface
    for (let i = 0; i < 9; i++) {
      const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.2 + rnd() * 2, 40), new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      shaft.position.set((rnd() - 0.5) * 20, 14, -rnd() * 25);
      shaft.rotation.set(0, rnd(), 0.2 + (rnd() - 0.5) * 0.2);
      scene.add(shaft);
    }
    for (let i = 0; i < 160; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.04 + rnd() * 0.08, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 0, clearcoat: 1 }));
      b.position.set((rnd() - 0.5) * 14, rnd() * 12, -rnd() * 20 + 4);
      scene.add(b);
    }
    // a school of fish
    const fishM = M.candy(0xffd23f, 0.3);
    for (let i = 0; i < 40; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), fishM);
      f.scale.set(1.8, 0.8, 0.5);
      f.position.set(-6 + rnd() * 6, 7 + rnd() * 3, -10 - rnd() * 6);
      scene.add(f);
    }
    cam.position.set(0, 2.5, 10);
    cam.lookAt(0, 4.5, -20);
  },

  goldrush(scene, cam) {
    scene.background = new THREE.Color(0x0a0604);
    scene.fog = new THREE.Fog(0x120a04, 8, 40);
    scene.add(new THREE.AmbientLight(0xffc080, 0.15));
    // tunnel: rough rock walls
    const rock = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.95, flatShading: true, side: THREE.BackSide });
    const geo = new THREE.CylinderGeometry(5, 5, 80, 40, 60, true);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      const n = 1 + 0.12 * Math.sin(v.y * 1.3 + v.x) * Math.cos(v.z * 1.7 + v.y * 0.4) + 0.06 * Math.sin(v.y * 4 + v.z * 3);
      p.setX(i, v.x * n);
      p.setZ(i, v.z * n);
    }
    geo.computeVertexNormals();
    const tunnel = new THREE.Mesh(geo, rock);
    tunnel.rotation.x = Math.PI / 2;
    tunnel.position.set(0, 3, -30);
    scene.add(tunnel);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 80), new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.8, -30);
    scene.add(floor);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4020, roughness: 0.8 });
    const iron = M.metal(0x8a8e98, 0.4);
    for (let k = 0; k < 10; k++) {
      const z = 4 - k * 5;
      for (const x of [-3.6, 3.6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.5, 0.4), wood);
        post.position.set(x, 2.4, z);
        scene.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.45, 0.45), wood);
      beam.position.set(0, 5.6, z);
      scene.add(beam);
      // hanging lantern
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), glowMat(0xffc860, 5));
      lamp.position.set(0, 5.0, z);
      const l = new THREE.PointLight(0xffa850, 14, 9, 1.6);
      l.position.set(0, 4.8, z);
      scene.add(lamp, l);
      // sleepers
      for (let s = 0; s < 4; s++) {
        const sl = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.3), wood);
        sl.position.set(0, -0.72, z - s * 1.25);
        scene.add(sl);
      }
    }
    for (const x of [-0.75, 0.75]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 80), iron);
      rail.position.set(x, -0.6, -30);
      scene.add(rail);
    }
    // gold veins glinting in the rock
    for (let i = 0; i < 160; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 4.6;
      const g = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08 + rnd() * 0.15, 0), M.gold());
      g.position.set(Math.cos(a) * r, 3 + Math.sin(a) * r, -rnd() * 45 + 4);
      if (g.position.y < -0.5) continue;
      scene.add(g);
    }
    cam.position.set(0, 1.6, 9);
    cam.lookAt(0, 2.8, -20);
  },

  lanterns(scene, cam) {
    sky(scene, '#0a0418', '#3a0a1a');
    scene.fog = new THREE.Fog(0x1a0612, 12, 60);
    scene.add(new THREE.HemisphereLight(0xff8a6a, 0x1a0610, 0.4));
    const street = new THREE.Mesh(new THREE.PlaneGeometry(14, 120), new THREE.MeshStandardMaterial({ color: 0x1a1218, roughness: 0.25, metalness: 0.3 }));
    street.rotation.x = -Math.PI / 2;
    street.position.z = -50;
    scene.add(street);
    const facade = [0x5a0a14, 0x3a0a10, 0x6a1a10, 0x2a0a18];
    for (const side of [-1, 1])
      for (let k = 0; k < 12; k++) {
        const z = 4 - k * 6;
        const h = 8 + rnd() * 6;
        const b = new THREE.Mesh(new THREE.BoxGeometry(4, h, 5.5), new THREE.MeshStandardMaterial({ color: facade[k % 4], roughness: 0.7 }));
        b.position.set(side * 7, h / 2, z);
        scene.add(b);
        // pagoda roof edge
        const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 6.2), M.candy(0x1a3a2a, 0.4));
        roof.position.set(side * 6.8, h, z);
        roof.rotation.z = side * 0.18;
        scene.add(roof);
        // lit windows
        for (let w = 0; w < 3; w++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), glowMat(rnd() < 0.5 ? 0xffb050 : 0xff6a3a, 1.4));
          win.position.set(side * 4.98, 2.5 + w * 2.4, z - 1.2 + (w % 2) * 1.8);
          win.rotation.y = -side * Math.PI / 2;
          scene.add(win);
        }
      }
    // strings of lanterns across the street
    const lanternM = new THREE.MeshStandardMaterial({ color: 0xff2a1a, emissive: 0xff3a10, emissiveIntensity: 2.2, roughness: 0.5 });
    for (let k = 0; k < 14; k++) {
      const z = 3 - k * 4.5;
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const x = -4.5 + t * 9;
        const y = 7.2 - Math.sin(Math.PI * t) * 1.2;
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), lanternM);
        l.scale.y = 1.25;
        l.position.set(x, y, z);
        scene.add(l);
      }
      const pl = new THREE.PointLight(0xff5a30, 14, 12, 1.5);
      pl.position.set(0, 4.5, z);
      scene.add(pl);
    }
    cam.position.set(0, 1.7, 9);
    cam.lookAt(0, 4.2, -20);
  },
};

export function renderWorld(id, W = 1080, H = 1920) {
  seed = 5;
  renderer.setSize(W, H);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 400);
  WORLDS[id](scene, cam);
  const composer = new EffectComposer(renderer);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, cam));
  composer.addPass(new BokehPass(scene, cam, { focus: 18, aperture: 0.0008, maxblur: 0.005 }));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.55, 0.8));
  composer.addPass(new OutputPass());
  composer.render();
  void RoundedBoxGeometry;
  return renderer.domElement.toDataURL('image/jpeg', 0.86);
}
