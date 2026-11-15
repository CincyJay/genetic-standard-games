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

  dragon(scene, cam) {
    // a treasure cave: heaps of gold, red crystals, ember glow
    sky(scene, '#120204', '#3a0806');
    scene.fog = new THREE.Fog(0x2a0604, 10, 55);
    scene.add(new THREE.HemisphereLight(0xff7a3a, 0x1a0402, 0.5));
    const rock = new THREE.MeshStandardMaterial({ color: 0x3a1a12, roughness: 0.95, flatShading: true, side: THREE.BackSide });
    const geo = new THREE.SphereGeometry(30, 48, 32);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      const n = 1 + 0.08 * Math.sin(v.y * 0.5 + v.x * 0.3) * Math.cos(v.z * 0.4) + 0.04 * Math.sin(v.x * 1.3);
      p.setXYZ(i, v.x * n, v.y * n, v.z * n);
    }
    geo.computeVertexNormals();
    const cave = new THREE.Mesh(geo, rock);
    cave.position.set(0, 8, -20);
    scene.add(cave);
    // heaps of coins
    for (const [x, z, r] of [[-7, -14, 6], [8, -18, 7], [0, -26, 9], [-12, -28, 6], [13, -8, 4]]) {
      const heap = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.gold());
      heap.scale.y = 0.45;
      heap.position.set(x, -1, z);
      scene.add(heap);
      for (let i = 0; i < 40; i++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16), M.gold());
        const a = rnd() * Math.PI * 2;
        const rr = rnd() * r;
        c.position.set(x + Math.cos(a) * rr, -1 + Math.sqrt(Math.max(0, r * r - rr * rr)) * 0.45 + 0.05, z + Math.sin(a) * rr);
        c.rotation.set(rnd() * 1.4, rnd() * 3, rnd() * 1.4);
        scene.add(c);
      }
    }
    // red crystals growing from the walls
    for (let i = 0; i < 40; i++) {
      const cr = new THREE.Mesh(new THREE.ConeGeometry(0.4 + rnd() * 0.5, 2 + rnd() * 3, 6), new THREE.MeshPhysicalMaterial({ color: 0xff2030, emissive: 0x8a0008, emissiveIntensity: 1.2, roughness: 0.1, clearcoat: 1 }));
      const a = rnd() * Math.PI - Math.PI;
      cr.position.set(Math.cos(a) * (14 + rnd() * 6), rnd() * 14, -10 + Math.sin(a) * 20);
      cr.rotation.set(rnd() - 0.5, 0, rnd() - 0.5);
      scene.add(cr);
    }
    for (const [x, z] of [[-6, -6], [6, -6], [-9, -20], [9, -22]]) scene.add(torch(x, -1, z));
    for (let i = 0; i < 120; i++) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05 + rnd() * 0.06, 6, 4), glowMat(0xff8a2a, 4));
      e.position.set((rnd() - 0.5) * 30, rnd() * 16, -rnd() * 30);
      scene.add(e);
    }
    const glow = new THREE.PointLight(0xffb040, 60, 40, 1.4);
    glow.position.set(0, 6, -18);
    scene.add(glow);
    cam.position.set(0, 3, 10);
    cam.lookAt(0, 3, -20);
  },

  empire(scene, cam) {
    // a marble palace hall in white, gold and royal purple
    sky(scene, '#1a0a2a', '#3a1a4a');
    scene.fog = new THREE.Fog(0x2a1838, 20, 80);
    scene.add(new THREE.HemisphereLight(0xfff0e0, 0x3a2040, 0.9));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 120), new THREE.MeshPhysicalMaterial({ color: 0xf0ece8, roughness: 0.08, metalness: 0.1, clearcoat: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -40;
    scene.add(floor);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(4, 120), M.matte(0x6a0a8a, 0.7));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.02, -40);
    scene.add(carpet);
    const marble = new THREE.MeshPhysicalMaterial({ color: 0xf6f2ee, roughness: 0.2, clearcoat: 0.8 });
    for (const side of [-1, 1])
      for (let k = 0; k < 8; k++) {
        const z = 2 - k * 8;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 14, 32), marble);
        col.position.set(side * 7, 7, z);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 2.6), M.gold());
        cap.position.set(side * 7, 14.2, z);
        const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 2.4), M.gold());
        base.position.set(side * 7, 0.3, z);
        const drape = new THREE.Mesh(new THREE.PlaneGeometry(5, 10), new THREE.MeshStandardMaterial({ color: 0x5a0a7a, roughness: 0.6, side: THREE.DoubleSide }));
        drape.position.set(side * 9.5, 8, z - 4);
        drape.rotation.y = side * Math.PI / 2;
        scene.add(col, cap, base, drape);
      }
    // chandeliers of light
    for (let k = 0; k < 6; k++) {
      const z = -2 - k * 10;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.08, 8, 48), M.gold());
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 12, z);
      scene.add(ring);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), glowMat(0xfff0c0, 5));
        b.position.set(Math.cos(a) * 1.6, 12.2, z + Math.sin(a) * 1.6);
        scene.add(b);
      }
      const l = new THREE.PointLight(0xfff0d0, 30, 20, 1.5);
      l.position.set(0, 11, z);
      scene.add(l);
    }
    // a giant diamond at the end of the hall
    const prof = [[0.0, 2.4], [3.6, 2.4], [6, 0.7], [6, 0.2], [0.0, -5.5]];
    const gem = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 8), M.gem(0xcfefff));
    gem.position.set(0, 10, -60);
    scene.add(gem);
    const gl = new THREE.PointLight(0xbfe8ff, 80, 40, 1.4);
    gl.position.set(0, 10, -52);
    scene.add(gl);
    cam.position.set(0, 3, 10);
    cam.lookAt(0, 7, -30);
  },

  thunder(scene, cam) {
    // storm over the mountain peaks
    sky(scene, '#05081a', '#3a4a7a');
    scene.fog = new THREE.Fog(0x1a2240, 30, 160);
    scene.add(new THREE.HemisphereLight(0x8aa8ff, 0x0a0a14, 0.7));
    const flash = new THREE.DirectionalLight(0xcfe0ff, 2.2);
    flash.position.set(10, 30, -10);
    scene.add(flash);
    const ground = terrain(300, 300, 120, 2.5, 0.06, 0x3a4250);
    ground.position.z = -80;
    scene.add(ground);
    const rock = new THREE.MeshStandardMaterial({ color: 0x4a5266, roughness: 0.9, flatShading: true });
    const snow = new THREE.MeshStandardMaterial({ color: 0xf0f4ff, roughness: 0.6, flatShading: true });
    for (const [x, z, h] of [[-30, -90, 55], [0, -120, 75], [32, -95, 60], [-60, -110, 45], [60, -120, 50], [-14, -60, 30], [18, -55, 26]]) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(h * 0.55, h, 7), rock);
      m.position.set(x, h / 2 - 2, z);
      m.rotation.y = rnd() * 3;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.17, h * 0.3, 7), snow);
      cap.position.set(x, h - 2 - h * 0.15, z);
      cap.rotation.y = m.rotation.y;
      scene.add(m, cap);
    }
    // storm clouds
    for (let i = 0; i < 60; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(6 + rnd() * 8, 16, 12), new THREE.MeshStandardMaterial({ color: 0x2a3050, roughness: 1, transparent: true, opacity: 0.85 }));
      c.position.set((rnd() - 0.5) * 220, 60 + rnd() * 25, -60 - rnd() * 100);
      c.scale.y = 0.45;
      scene.add(c);
    }
    // lightning
    const boltM = glowMat(0xcfe8ff, 6, false);
    for (const [x0, z0] of [[-20, -100], [14, -110], [40, -90]]) {
      let x = x0;
      let y = 70;
      const pts = [];
      while (y > 15) {
        pts.push(new THREE.Vector3(x, y, z0));
        x += (rnd() - 0.5) * 8;
        y -= 4 + rnd() * 4;
      }
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 64, 0.35, 6), boltM));
    }
    cam.position.set(0, 6, 20);
    cam.lookAt(0, 30, -80);
  },

  tiger(scene, cam) {
    // a jungle temple at dusk
    sky(scene, '#0a1a10', '#d88a3a');
    scene.fog = new THREE.Fog(0x2a3a1a, 18, 90);
    scene.add(new THREE.HemisphereLight(0xffd0a0, 0x0a200a, 0.8));
    const sun = new THREE.DirectionalLight(0xffb070, 1.4);
    sun.position.set(-20, 15, -40);
    scene.add(sun);
    const ground = terrain(200, 200, 100, 0.6, 0.12, 0x2a4a1a);
    ground.position.z = -50;
    scene.add(ground);
    const stone = new THREE.MeshStandardMaterial({ color: 0x8a8a6a, roughness: 0.9, flatShading: true });
    for (let k = 0; k < 7; k++) {
      const w = 26 - k * 3.4;
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, 3, w), stone);
      step.position.set(0, 1.5 + k * 3, -55);
      scene.add(step);
    }
    const shrine = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 4), stone);
    shrine.position.set(0, 23.5, -55);
    const gold = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4, 4), M.gold());
    gold.position.set(0, 28, -55);
    gold.rotation.y = Math.PI / 4;
    scene.add(shrine, gold);
    const leaf = new THREE.MeshStandardMaterial({ color: 0x1a6a2a, roughness: 0.7, side: THREE.DoubleSide });
    const trunk = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 });
    for (let i = 0; i < 36; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (8 + rnd() * 18);
      const z = 4 - rnd() * 60;
      const h = 8 + rnd() * 8;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 8), trunk);
      t.position.set(x, h / 2, z);
      t.rotation.z = (rnd() - 0.5) * 0.3;
      scene.add(t);
      for (let f = 0; f < 7; f++) {
        const fr = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5, 4), leaf);
        const a = (f / 7) * Math.PI * 2;
        fr.position.set(x + Math.cos(a) * 2, h, z + Math.sin(a) * 2);
        fr.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
        scene.add(fr);
      }
    }
    for (const [x, z] of [[-5, -10], [5, -10], [-6, -30], [6, -30]]) scene.add(torch(x, 0, z));
    for (let i = 0; i < 80; i++) {
      const fly = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), glowMat(0xd8ff6a, 4));
      fly.position.set((rnd() - 0.5) * 30, 1 + rnd() * 10, -rnd() * 40);
      scene.add(fly);
    }
    cam.position.set(0, 3, 12);
    cam.lookAt(0, 12, -50);
  },

  cosmic(scene, cam) {
    // deep space: a nebula, a ringed planet and a field of stars
    sky(scene, '#02010a', '#2a0a4a');
    scene.add(new THREE.AmbientLight(0x6a4aff, 0.3));
    const sun = new THREE.DirectionalLight(0xffe0c0, 2);
    sun.position.set(-30, 20, 10);
    scene.add(sun);
    for (let i = 0; i < 900; i++) {
      const st = new THREE.Mesh(new THREE.SphereGeometry(0.1 + rnd() * 0.25, 6, 4), glowMat([0xffffff, 0xbfd8ff, 0xffd8f0][i % 3], 2 + rnd() * 3, false));
      st.position.set((rnd() - 0.5) * 300, (rnd() - 0.5) * 300, -60 - rnd() * 140);
      scene.add(st);
    }
    // nebula: soft glowing clouds
    for (let i = 0; i < 26; i++) {
      const c = [0xff40c0, 0x6a4aff, 0x2ad8ff][i % 3];
      const n = new THREE.Mesh(new THREE.SphereGeometry(14 + rnd() * 16, 16, 12), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.06, depthWrite: false, fog: false }));
      n.position.set((rnd() - 0.5) * 140, 20 + (rnd() - 0.5) * 80, -140);
      scene.add(n);
    }
    const planet = new THREE.Mesh(new THREE.SphereGeometry(18, 64, 48), new THREE.MeshPhysicalMaterial({ color: 0xd87a2a, roughness: 0.5, sheen: 0.6, sheenColor: 0xffc080 }));
    planet.position.set(18, 22, -90);
    const ring = new THREE.Mesh(new THREE.RingGeometry(24, 34, 96), new THREE.MeshStandardMaterial({ color: 0xc8a0ff, emissive: 0x6a3aff, emissiveIntensity: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    ring.position.copy(planet.position);
    ring.rotation.set(1.2, 0.3, 0.2);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 24), M.matte(0xb8b8c8, 0.8));
    moon.position.set(-22, 8, -60);
    scene.add(planet, ring, moon);
    cam.position.set(0, 0, 20);
    cam.lookAt(0, 12, -80);
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
