/**
 * One close-up of ChatGPT's premium slot station pilot (VA-0073 `a11f487`, screen art VA-0075
 * `7760d59`), for visual review before any rollout. Prototype-only page (station.html); nothing
 * in the game uses it. Engineering only: the art modules are used as authored. The one host-side
 * change is optional placement: `placed` seats the two curved screens on the cabinet front
 * (slotPilot.ts), since as authored they sit 1.6 m to the cabinet's side. slot-pilot.html is the
 * routine's browser page for the same pilot; this one ships in the prototype APK for the phone.
 *
 * Lighting is the floor's Vegas rig (lighting.ts): dim room, image-based reflections, a warm
 * overhead lamp and a bloom that only HDR emissive light passes.
 *
 * Hooks for capture scripts: globalThis.__station = { view(name), placed(on), theme(name), report() }.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createPremiumSlotStation } from '../../../../art/casino/3d/premiumSlotStation.mjs';
import { applyVelvetAceScreenArt } from '../../../../art/casino/3d/slotScreenArt.mjs';
import { LIGHT_RIGS } from './lighting.ts';
import { seatCurvedScreens } from './slotPilot.ts';

const SCREENS = ['TOPPER-CURVED_SCREEN_SWAP_MATERIAL', 'MAIN_REELS-CURVED_SCREEN_SWAP_MATERIAL'];

/** Standing player eye level, 1.6 m; the seated view is a seated player's eye, over the seat. */
export const VIEWS: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  front: { pos: [0, 1.6, 3.1], target: [0, 1.5, 0] },
  three: { pos: [2.1, 1.6, 2.4], target: [0, 1.45, 0.1] },
  side: { pos: [3.0, 1.6, 0.3], target: [0, 1.45, 0.3] },
  seat: { pos: [0, 1.22, 1.02], target: [0, 1.4, 0] },
  wide: { pos: [3.6, 2.4, 4.6], target: [0, 1.2, 0.2] },
};

/**
 * Placed: the screens seated on the cabinet front by slotPilot.seatCurvedScreens (the routine's
 * tested workaround, VA-0076); as authored: their original yaw and z, kept from before seating.
 */
function placeScreens(station: THREE.Object3D, on: boolean): void {
  for (const n of SCREENS) {
    const m = station.getObjectByName(n)!;
    if (!m.userData.authored) m.userData.authored = { z: m.position.z, ry: m.rotation.y };
  }
  if (on) {
    seatCurvedScreens(THREE, station);
    return;
  }
  for (const n of SCREENS) {
    const m = station.getObjectByName(n)!;
    const a = m.userData.authored as { z: number; ry: number };
    m.rotation.set(0, a.ry, 0);
    m.position.z = a.z;
  }
}

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
  // a warm pool from above and in front, as a chandelier would give; it casts the shadows
  const lamp = new THREE.SpotLight(rig.lamp.color, rig.lamp.intensity * 1.2, 12, 0.7, 0.6, rig.lamp.decay);
  lamp.position.set(0.6, 4.2, 2.6);
  lamp.target.position.set(0, 0.9, 0.4);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(1024, 1024);
  scene.add(lamp, lamp.target);

  // a plain dark floor (no art: the carpet is being redone)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1218, roughness: 0.9 }));
  floor.receiveShadow = true;
  scene.add(floor);

  let station: THREE.Group | null = null;
  let isPlaced = params.get('placed') !== '0';
  let theme = params.get('theme') ?? 'royal';
  function build(): void {
    if (station) {
      scene.remove(station);
      station.userData.disposeScreenArt?.();
      station.userData.dispose?.();
    }
    station = createPremiumSlotStation(THREE, { withChair: true }) as THREE.Group;
    applyVelvetAceScreenArt(THREE, station, { theme });
    placeScreens(station, isPlaced);
    scene.add(station);
  }
  build();

  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), rig.bloom!.strength, rig.bloom!.radius, rig.bloom!.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);

  let current = params.get('view') ?? 'three';
  function view(name: string): void {
    const v = VIEWS[name] ?? VIEWS.three;
    current = name;
    camera.position.set(...v.pos);
    camera.lookAt(...v.target);
  }
  view(current);

  const label = document.createElement('div');
  Object.assign(label.style, { position: 'fixed', left: '12px', bottom: '10px', font: '600 13px system-ui', color: '#e9c86a', letterSpacing: '.06em', pointerEvents: 'none' });
  document.body.appendChild(label);
  const relabel = () => (label.textContent = `PROTOTYPE · SLOT STATION PILOT · ${theme} · screens ${isPlaced ? 'placed on front' : 'as authored'} · ${current}`);
  relabel();

  // tap to cycle the views (on the phone, without a script)
  const order = Object.keys(VIEWS);
  renderer.domElement.addEventListener('click', () => {
    view(order[(order.indexOf(current) + 1) % order.length]);
    relabel();
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });
  renderer.setAnimationLoop(() => composer.render());

  /** Facts for the review: where the screens are, which way they face, the chair, the size. */
  function report() {
    station!.updateMatrixWorld(true);
    const box = (o: THREE.Object3D) => {
      const b = new THREE.Box3().setFromObject(o);
      const r = (v: THREE.Vector3) => [v.x, v.y, v.z].map((n) => +n.toFixed(3));
      return { min: r(b.min), max: r(b.max) };
    };
    const screens = SCREENS.map((n) => {
      const m = station!.getObjectByName(n) as THREE.Mesh;
      const g = m.geometry as THREE.BufferGeometry;
      // the normal and texture u at the arc's middle and its two ends, in world space
      const pos = g.attributes.position;
      const nrm = g.attributes.normal;
      const uv = g.attributes.uv;
      const cols = 33; // 32 segments
      const sample = (i: number) => {
        const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const nn = new THREE.Vector3().fromBufferAttribute(nrm, i).transformDirection(m.matrixWorld);
        return { x: +p.x.toFixed(3), z: +p.z.toFixed(3), normal: [nn.x, nn.z].map((v) => +v.toFixed(2)), u: +uv.getX(i).toFixed(2) };
      };
      return { name: n, box: box(m), left: sample(0), mid: sample(16), right: sample(cols - 1) };
    });
    const parts = (re: RegExp) => {
      const b = new THREE.Box3();
      station!.traverse((o) => (o as THREE.Mesh).isMesh && re.test(o.name) && b.expandByObject(o));
      return { min: b.min.toArray().map((n) => +n.toFixed(3)), max: b.max.toArray().map((n) => +n.toFixed(3)) };
    };
    let meshes = 0;
    let tris = 0;
    station!.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      const g = m.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    return {
      placed: isPlaced,
      theme,
      station: box(station!),
      cabinet: parts(/^(?!.*chair|.*seat|.*cushion|.*arm|.*stitch|.*pedestal|.*leather)/),
      gaskets: parts(/black-gasket/),
      screens,
      chair: box(station!.getObjectByName('matching-padded-casino-chair')!),
      seatTop: parts(/deep-cushioned-seat/).max[1],
      meshes,
      tris: Math.round(tris),
      userData: { width: station!.userData.width, depth: station!.userData.depth, height: station!.userData.height },
    };
  }

  (globalThis as unknown as { __station: unknown }).__station = {
    view: (n: string) => {
      view(n);
      relabel();
    },
    placed: (on: boolean) => {
      isPlaced = on;
      placeScreens(station!, on);
      relabel();
    },
    theme: (t: string) => {
      theme = t;
      build();
      relabel();
    },
    report,
    calls: () => renderer.info.render.calls,
  };
}

start();
