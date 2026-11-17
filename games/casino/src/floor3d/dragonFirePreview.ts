/**
 * Isolated preview of ChatGPT's **Dragon Fire** hero slot (VA-0090): the GLB that
 * `art/casino/3d/blender/dragon_fire_hero.py` (`d321c32`) exports, run unchanged in Blender 4.5.5 on
 * the local PC, with screen PNGs from `aurelia_screen_art.py` (run with a Windows symbol font added
 * locally; see VA-0091). Prototype-only page (dragon-fire.html); nothing in the game uses it.
 *
 * Engineering only: loaded with GLTFLoader exactly as exported, with its own materials and screen
 * textures. Framing only (chair toward +Z, centred, on the floor), same rig and views as the
 * Aurelia and Royal Crescent pages so they compare. Hooks: globalThis.__royal (same shape).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import modelUrl from '../../../../art/casino/3d/models/dragon_fire_hero.glb?url';
import { dragonReliefDataUrl } from '../../../../art/casino/3d/dragonReliefArt.mjs';
import { DRAGON_INSERT_ASPECT, dragonTallDataUrl } from '../../../../art/casino/3d/dragonTallInsertArt.mjs';
import { LIGHT_RIGS } from './lighting.ts';
import { decalArtFit, decalSafeSpans, insertFaceDecal, reliefInsertQuads } from './dragonRelief.ts';

/** Standing eye 1.6 m; seated eye 1.22 m over the chair (set once the chair is found). */
const VIEWS: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  front: { pos: [0, 1.6, 3.1], target: [0, 1.3, 0] },
  three: { pos: [2.1, 1.6, 2.4], target: [0, 1.2, 0.1] },
  side: { pos: [3.0, 1.5, 0.3], target: [0, 1.15, 0.3] },
  left: { pos: [-3.0, 1.5, 0.3], target: [0, 1.15, 0.3] },
  panel: { pos: [1.6, 1.2, 0.065], target: [0.56, 1.175, 0.065] },
  insert: { pos: [2.9, 1.18, 0.14], target: [0.56, 1.18, 0.14] },
  insertl: { pos: [-2.9, 1.18, 0.14], target: [-0.56, 1.18, 0.14] },
  seat: { pos: [0, 1.22, 1.0], target: [0, 1.25, 0] },
  wide: { pos: [3.4, 2.3, 4.4], target: [0, 1.0, 0.2] },
};

const insertSideIsPlus = (g: THREE.BufferGeometry) => (g.computeBoundingBox(), g.boundingBox!.min.x + g.boundingBox!.max.x >= 0);
const r3 = (v: THREE.Vector3) => [v.x, v.y, v.z].map((n) => +n.toFixed(3));
const boxOf = (objs: THREE.Object3D[]) => {
  const b = new THREE.Box3();
  for (const o of objs) b.expandByObject(o);
  return { min: r3(b.min), max: r3(b.max) };
};

function start(): void {
  const params = new URLSearchParams(location.search);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 60);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
  roomEnv.dispose();
  pmrem.dispose();

  const rig = LIGHT_RIGS.vegas;
  renderer.toneMappingExposure = rig.exposure;
  scene.environmentIntensity = rig.envIntensity;
  scene.add(new THREE.HemisphereLight(rig.hemi.sky, rig.hemi.ground, rig.hemi.intensity));
  const sun = new THREE.DirectionalLight(rig.sun.color, rig.sun.intensity);
  sun.position.set(4, 9, 6);
  scene.add(sun);
  const lamp = new THREE.SpotLight(rig.lamp.color, rig.lamp.intensity * 1.2, 12, 0.7, 0.6, rig.lamp.decay);
  lamp.position.set(0.6, 4.2, 2.6);
  lamp.target.position.set(0, 0.9, 0.4);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  scene.add(lamp, lamp.target);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1218, roughness: 0.9 }));
  floor.receiveShadow = true;
  scene.add(floor);

  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), rig.bloom!.strength, rig.bloom!.radius, rig.bloom!.threshold));
  composer.addPass(new OutputPass());
  composer.setPixelRatio(pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);

  const reliefMode = params.get('relief');
  const relief = reliefMode === 'svg' || reliefMode === 'fit';
  const fitBy: 'height' | 'width' = params.get('fit') === 'width' ? 'width' : 'height';
  const mirror = params.get('mirror') === '1';
  // VA-0103: `art=tall` swaps in ChatGPT's 704×2080 tall insert illustration; `tex=512` halves it
  const tall = params.get('art') === 'tall';
  const artAspect = tall ? DRAGON_INSERT_ASPECT : 0.5;
  const texSize = tall ? (params.get('tex') === '512' ? { width: 512, height: 1512 } : { width: 704, height: 2080 }) : { width: 1024, height: 2048 };
  const artUrl = () => (tall ? dragonTallDataUrl(texSize) : dragonReliefDataUrl(texSize));
  let current = params.get('view') ?? 'three';
  function view(name: string): void {
    const v = VIEWS[name] ?? VIEWS.three;
    current = name;
    camera.position.set(...v.pos);
    camera.lookAt(...v.target);
    label.textContent = `PROTOTYPE · DRAGON FIRE MODEL (Blender export)${relief ? ` + painted side art (${reliefMode === 'fit' ? `insert-shaped, ${tall ? 'tall art' : '1:2 art'}, fit ${fitBy}` : '1:2 card'})` : ''} · ${current}`;
  }
  const label = document.createElement('div');
  Object.assign(label.style, { position: 'fixed', left: '12px', bottom: '10px', font: '600 13px system-ui', color: '#e9c86a', letterSpacing: '.06em', pointerEvents: 'none' });
  document.body.appendChild(label);
  view(current);
  const order = Object.keys(VIEWS);
  renderer.domElement.addEventListener('click', () => view(order[(order.indexOf(current) + 1) % order.length]));
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });
  renderer.setAnimationLoop(() => composer.render());

  const api: { ready: boolean; view: typeof view; report: () => unknown; error?: string } = { ready: false, view, report: () => null };
  (globalThis as unknown as { __royal: unknown }).__royal = api;

  new GLTFLoader().load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;
      const meshes: THREE.Mesh[] = [];
      model.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = m.receiveShadow = true;
        meshes.push(m);
      });
      const named = (re: RegExp) => meshes.filter((m) => re.test(m.name) || re.test(m.parent?.name ?? ''));
      model.updateMatrixWorld(true);
      // as exported: the bounds, and which way the chair sits from the cabinet
      const raw = boxOf([model]);
      const centre = (objs: THREE.Object3D[]) => new THREE.Box3().setFromObject(objs.reduce((g, o) => (g.add(o.clone()), g), new THREE.Group())).getCenter(new THREE.Vector3());
      const chairParts = named(/chair|leather|upholstery|arm/);
      const cabinetParts = meshes.filter((m) => !chairParts.includes(m));
      const cc = centre(chairParts);
      const kc = centre(cabinetParts);
      const turn = chairParts.length ? -Math.atan2(cc.x - kc.x, cc.z - kc.z) : 0;
      // framing only: chair toward +Z, cabinet centred on x/z 0, standing on the floor
      const holder = new THREE.Group();
      holder.add(model);
      holder.rotation.y = turn;
      holder.updateMatrixWorld(true);
      const kc2 = kc.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
      holder.position.set(-kc2.x, -new THREE.Box3().setFromObject(model).min.y, -kc2.z);
      scene.add(holder);
      holder.updateMatrixWorld(true);

      // painted side art: one quad per ruby insert, placed in the model's own space
      let reliefInfo: unknown = null;
      if (relief && reliefMode === 'fit') {
        // VA-0101: the insert's own outer triangles, UV-mapped, instead of a 1:2 card
        const inserts = named(/dragon.side.lacquer/i);
        const toModel = new THREE.Matrix4().copy(model.matrixWorld).invert();
        const tex = new THREE.TextureLoader().load(artUrl());
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        const pos: number[] = [], nor: number[] = [], uv: number[] = [], ind: number[] = [];
        const decals = inserts.map((m) => {
          const g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(toModel, m.matrixWorld));
          const d = insertFaceDecal(g.attributes.position.array, g.index ? g.index.array : null, { aspect: artAspect, fit: fitBy, mirror: mirror && insertSideIsPlus(g) });
          const base = pos.length / 3;
          pos.push(...d.positions); nor.push(...d.normals); uv.push(...d.uvs); ind.push(...d.indices.map((k) => k + base));
          return { insert: m.name, side: d.side, face: d.face, art: d.art, safeSpans: decalSafeSpans(d, [0.95, 0.85, 0.75, 0.65, 0.5, 0.35, 0.2, 0.1, 0.03]), decal: d };
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(ind);
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.15, alphaTest: 0.5, name: 'VA0101 insert-shaped dragon side (preview)' });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'relief_svg_insert_decal';
        mesh.receiveShadow = true;
        model.add(mesh);
        meshes.push(mesh);
        const info = { mode: 'fit', art: tall ? 'tall (dragonTallInsertArt)' : '1:2 (dragonReliefArt)', aspect: +artAspect.toFixed(4), fit: fitBy, mirrorPlusX: mirror, decals: decals.map(({ decal: _d, ...rest }) => rest), texture: `${texSize.width}x${texSize.height} RGBA`, textureMB: +((texSize.width * texSize.height * 4 * 4) / 3 / 1048576).toFixed(1), draws: 1, triangles: ind.length / 3, artFit: null as unknown };
        reliefInfo = info;
        // how much opaque art the insert's outline clips, and how much of the face it fills (alpha ≥ 128, 176-wide mask)
        const img = new Image();
        img.onload = () => {
          const w = 176, h = Math.round(w / artAspect);
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          const cx = cv.getContext('2d')!;
          cx.drawImage(img, 0, 0, w, h);
          const px = cx.getImageData(0, 0, w, h).data;
          const a = new Uint8Array(w * h);
          for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3];
          info.artFit = decals.map((dd) => ({ insert: dd.insert, mask: `${w}x${h}`, ...decalArtFit(dd.decal, a, w, h) }));
        };
        img.src = artUrl();
      } else if (relief) {
        const inserts = named(/dragon.side.lacquer/i);
        const boxes = inserts.map((m) => new THREE.Box3().setFromObject(m).applyMatrix4(new THREE.Matrix4().copy(model.matrixWorld).invert()));
        // The insert is a slanted polygon, not a rectangle: its outer face (read from the GLB) runs
        // z −0.151…0.441 at y 0.77 but only −0.16…0.281 at y 1.47. Keep the art inside the
        // narrowest band so it never crosses the violet light-pipe.
        const INNER_Z: [number, number] = [-0.145, 0.275];
        const quads = reliefInsertQuads(
          boxes.map((b) => ({ min: [b.min.x, b.min.y, Math.max(b.min.z, INNER_Z[0])], max: [b.max.x, b.max.y, Math.min(b.max.z, INNER_Z[1])] })),
          { aspect: 0.5, mirrorPlusX: mirror, margin: 0 },
        );
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(quads.positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(quads.normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(quads.uvs, 2));
        geo.setIndex(quads.indices);
        const tex = new THREE.TextureLoader().load(dragonReliefDataUrl({ width: 1024, height: 2048 }));
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.15, alphaTest: 0.5, name: 'VA0100 painted dragon side (preview)' });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'relief_svg_quads';
        mesh.receiveShadow = true;
        model.add(mesh);
        meshes.push(mesh);
        reliefInfo = { inserts: inserts.map((m) => m.name), insertBoxes: boxes.map((b) => ({ min: r3(b.min), max: r3(b.max) })), quads: quads.placed, mirrorPlusX: mirror, texture: '1024x2048 RGBA', draws: 1, triangles: quads.indices.length / 3 };
      }

      api.report = () => {
        let tris = 0;
        const attrs = new Set<string>();
        const mats = new Set<string>();
        for (const m of meshes) {
          const g = m.geometry;
          tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
          Object.keys(g.attributes).forEach((a) => attrs.add(a));
          const mat = m.material as THREE.MeshStandardMaterial;
          mats.add(`${mat.name}: ${mat.type} metal ${mat.metalness} rough ${mat.roughness} vc ${mat.vertexColors} flat ${mat.flatShading}`);
        }
        // which way each display faces: its area-weighted face normal, in world space
        const facing = (m: THREE.Mesh) => {
          const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
          const p = g.attributes.position;
          const n = new THREE.Vector3();
          const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
          for (let i = 0; i < p.count; i += 3) {
            a.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
            b.fromBufferAttribute(p, i + 1).applyMatrix4(m.matrixWorld);
            c.fromBufferAttribute(p, i + 2).applyMatrix4(m.matrixWorld);
            n.add(b.clone().sub(a).cross(c.clone().sub(a)));
          }
          return r3(n.normalize());
        };
        const displays = named(/UV_screen/).map((m) => ({ name: m.name, box: boxOf([m]), facing: facing(m), tris: (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 }));
        return {
          exported: { box: raw, chairFromCabinet: r3(cc.clone().sub(kc)) },
          framing: { turnDeg: +((turn * 180) / Math.PI).toFixed(1) },
          placed: boxOf([holder]),
          meshes: meshes.length,
          triangles: Math.round(tris),
          attributes: [...attrs],
          materials: [...mats],
          textures: meshes.some((m) => !!(m.material as THREE.MeshStandardMaterial).map),
          displays,
          bezels: named(/sculpted_bezel/).map((m) => ({ name: m.name, box: boxOf([m]) })),
          belly: boxOf(named(/belly|control_panel/)),
          buttons: boxOf(named(/jewel_button/)),
          cardReader: boxOf(named(/card_reader/)),
          ticket: boxOf(named(/ticket/)),
          toeKick: boxOf(named(/foot_kick/)),
          chairSeat: boxOf(named(/leather_cushion/)),
          chairBack: boxOf(named(/leather_back/)),
          chairArms: boxOf(named(/padded_leather_arm/)),
          chairFoot: boxOf(named(/chair_base/)),
          chair: boxOf(chairParts),
          cabinet: boxOf(cabinetParts),
          relief: reliefInfo,
        };
      };
      api.ready = true;
    },
    undefined,
    (e) => {
      api.error = String(e);
      label.textContent = 'Dragon Fire model failed to load: ' + api.error;
    },
  );
}

start();
