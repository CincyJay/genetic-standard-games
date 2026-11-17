/**
 * Isolated preview of ChatGPT's clean-sheet Blender slot model, **Aurelia** (VA-0086): the GLB that
 * `art/casino/3d/blender/aurelia_hero.blend.py` (`c2e6af6`) exports, produced by running that
 * script unchanged in Blender 4.5.5 LTS on the local PC (`art/casino/3d/models/aurelia_hero.glb`).
 * Prototype-only page (aurelia.html); nothing in the game uses it. The 38 floor slots, tables and
 * gameplay are untouched. Royal Crescent (royal-crescent.html) stays as historical comparison.
 *
 * Engineering only: loaded with GLTFLoader exactly as exported, with its own PBR materials. The one
 * host-side step is framing (chair toward +Z, centred, lowest point on the floor), as on the Royal
 * Crescent page, under the same Vegas rig and views so the two compare.
 *
 * Hooks for capture scripts: globalThis.__royal = { view(name), report(), ready } (same shape as the
 * Royal Crescent page, so one capture script drives both).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import modelUrl from '../../../../art/casino/3d/models/aurelia_hero.glb?url';
import { LIGHT_RIGS } from './lighting.ts';

/** Standing eye 1.6 m; seated eye 1.22 m over the chair (set once the chair is found). */
const VIEWS: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  front: { pos: [0, 1.6, 3.1], target: [0, 1.3, 0] },
  three: { pos: [2.1, 1.6, 2.4], target: [0, 1.2, 0.1] },
  side: { pos: [3.0, 1.5, 0.3], target: [0, 1.15, 0.3] },
  seat: { pos: [0, 1.22, 1.0], target: [0, 1.25, 0] },
  wide: { pos: [3.4, 2.3, 4.4], target: [0, 1.0, 0.2] },
};

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

  let current = params.get('view') ?? 'three';
  function view(name: string): void {
    const v = VIEWS[name] ?? VIEWS.three;
    current = name;
    camera.position.set(...v.pos);
    camera.lookAt(...v.target);
    label.textContent = `PROTOTYPE · AURELIA MODEL (Blender export) · ${current}`;
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
      const chairParts = named(/chair|leather_seat|armrest/);
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
        const displays = named(/glass_display/).map((m) => ({ name: m.name, box: boxOf([m]), facing: facing(m), tris: (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 }));
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
          bezels: named(/champagne_bezel/).map((m) => ({ name: m.name, box: boxOf([m]) })),
          belly: boxOf(named(/belly|control_deck/)),
          buttons: boxOf(named(/illuminated_button/)),
          cardReader: boxOf(named(/card_reader/)),
          ticket: boxOf(named(/ticket/)),
          toeKick: boxOf(named(/toe_kick/)),
          chairSeat: boxOf(named(/leather_seat/)),
          chairBack: boxOf(named(/chair_back/)),
          chairArms: boxOf(named(/armrest/)),
          chairFoot: boxOf(named(/chair_polished_circular_foot/)),
          chair: boxOf(chairParts),
          cabinet: boxOf(cabinetParts),
        };
      };
      api.ready = true;
    },
    undefined,
    (e) => {
      api.error = String(e);
      label.textContent = 'Aurelia model failed to load: ' + api.error;
    },
  );
}

start();
