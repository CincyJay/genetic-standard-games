/**
 * The 3D casino floor (stage 1, VA-0016): a Three.js canvas over the Phaser canvas with
 * ChatGPT's room, table, chairs and slot art (PR #2, see artScene.ts), placeholder capsule
 * people, tap-to-walk, an optional joystick, the two cameras and seat selection.
 *
 * Loaded with a dynamic import, so Three.js is its own chunk and costs nothing until the
 * floor opens. `dispose()` frees every GPU resource and the WebGL context before a Phaser
 * game takes over.
 */
import * as THREE from 'three';
import { LIMITS, LOOK_UP_MAX, OVERVIEW_AXES, TRANSITION_MS, avatarOpacity, propOpacity, blendPose, clampZoom, cutawayWalls, desiredPose, machineFocus, setOverviewSides, turnToward, type CamMode, type CamPose, type MachineFocus } from './camera.ts';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LIGHT_RIGS, LIGHT_STORAGE_KEY, nextLightMode, parseLightMode, type LightMode } from './lighting.ts';
import { buildArtScene, buildGuestAvatar } from './artScene.ts';
import { applyVelvetReelAtlas, createVelvetReelArt } from '../../../../art/casino/3d/reelDisplayArt.mjs';
import { MACHINES } from '../logic/slots.ts';
import { AVATAR_HEIGHT, HALL_STORAGE_KEY, readHall, ROOM, SALON_ROOM, obstaclesFor, SEAT_HEIGHT, useRoom, type Seat, type Vec2 } from './layout.ts';
import { lampsForCeiling, layoutFor } from './grandHall.ts';
import { CEILING_STORAGE_KEY, CHAIR_STORAGE_KEY, NEXT_CEILING_STYLE, NEXT_CHAIR_STYLE, heroLodLevel, readCeilingStyle, type HeroLodLevel, readChairStyle } from './grandHallArt.ts';
import { CAP_BULB_FAR_M, MACHINES_STORAGE_KEY, NEXT_MACHINE_STYLE, buildIslandToppers, buildSvelteCaps, islandSeams, planBanks, readMachineStyle } from './svelteFloor.ts';
import { NavGrid } from './nav.ts';
import { buildPlaceholderCrowd, type PlaceholderPerson } from './placeholderCrowd.ts';
import { buildReelSheet, type ReelSheet, type ReelSource } from './reelSheet.ts';
import { perfText, protoBadge } from './badge.ts';
import { ROTATE_ORDER, type RotatePref } from './orientation.ts';

export interface FloorState {
  pos: Vec2;
  heading: number;
  mode: CamMode;
  dist: Record<CamMode, number>;
}

export interface FloorOptions {
  state: FloorState;
  reducedMotion: boolean;
  /** The screen-rotation choice shown on the Rotate button. */
  rotate: RotatePref;
  /** The player picked a new rotation choice. */
  onRotate: (pref: RotatePref) => void;
  /** The avatar has sat down at a seat: open its game. */
  onSit: (seat: Seat, state: FloorState) => void;
  /** The player tapped Back. */
  onBack: (state: FloorState) => void;
  /** Camera and motion preferences changed (stored locally by the caller). */
  onPrefs: (mode: CamMode, reducedMotion: boolean) => void;
}

export interface FloorStats {
  frames: number;
  fps: number;
  intervalAvgMs: number;
  intervalP95Ms: number;
  intervalMaxMs: number;
  cpuAvgMs: number;
  cpuP95Ms: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  pixelRatio: number;
  canvas: [number, number];
  heapMB: number | null;
  /** ChatGPT's art: meshes as authored, and the draw batches they were merged into. */
  artMeshes: number;
  artBatches: number;
  /** Slot parts kept out of the batches (reels, spin buttons, marquees) and their reel cells. */
  artInteractive: number;
  reelCells: number;
  /** Machines whose reels show their symbol atlas (loads after the floor opens). */
  reelTextures: number;
  /** Every machine's reel atlas has loaded or failed (and the shared sheet, if any, is built).
   *  Until then each machine's reels draw on their own, ~19 extra calls in the grand hall (VA-0349):
   *  read draw calls after this. */
  reelsSettled: boolean;
  /** The shared reel sheet (VA-0222), once built: machines tiled, sheet px, reel meshes merged, triangles. */
  reelSheet: { machines: number; size: [number, number]; meshes: number; triangles: number } | null;
  /** Showing the art pass 05 pilot (carpet, ceiling, hero cabinet, chair). */
  pilot05: boolean;
  /** Which floor was built: the salon or the grand hall preview (VA-0064). */
  hall: 'salon' | 'grand';
  /** The opt-in blackjack hero table (VA-0054) is on. */
  blackjackHero: boolean;
  /** ChatGPT's opt-in woven carpet (VA-0058, `?carpet`) replaced the pilot carpet. */
  wovenCarpet: boolean;
  /** The prototype Svelte machine switch: cabinets put in, end caps placed and caps dropped (no room). */
  svelteMachines: { cabinets: number; caps: number; capsDropped: number; stools: number; stoolsDropped: number; lod: { near: number; mid: number; triangles: number; drawCalls: number } | null; capBulbsFar: number };
  /** The player is drawn with ChatGPT's guest avatar pilot (VA-0035) rather than the capsule. */
  guestAvatar: boolean;
  /** The hero cabinet's canvas textures (title, BONUS sign): built, and still drawn after batching. */
  heroTextures: [number, number];
  /** Metres the BONUS-sign depth workaround moved the sign (0 = the art is already clear). */
  heroSignLift: number;
  /** Lighting mode (lighting.ts); vegas adds the bloom passes to drawCalls. */
  lightMode: LightMode;
  /** Grand hall hero LOD (VA-0305): which detail the end-wall heroes are drawn in now, or null when it is off. */
  heroLod: HeroLodLevel | null;
  /** Art batches hidden by their world box in the last frame (VA-0316), of how many are box-tested. */
  boxCull: { culled: number; of: number; liteAll: boolean };
}

export interface FloorHandle {
  dispose: () => void;
  stats: () => FloorStats;
  /** Test hooks: state, and screen points of things to tap. */
  debug: {
    state: () => FloorState & { walking: boolean; sitting: boolean; seat: string | null; transitioning: boolean; camYaw: number; lookUp: number; roof: string; cam: CamPose; focus: { id: string; weight: number } | null; propAlpha: Record<string, number> };
    screenOf: (x: number, y: number, z: number) => { x: number; y: number };
    seatScreen: (id: string) => { x: number; y: number };
    /** What the camera draws this frame, mesh by mesh (VA-0052). */
    drawList: () => { name: string; tris: number; glow: boolean; instances: number }[];
    tap: (sx: number, sy: number) => void;
    /** The visible meshes under a screen point (CSS pixels), nearest first. */
    pick: (sx: number, sy: number) => { name: string; dist: number; material: string }[];
    toggleCamera: () => void;
    /** Stand the avatar at (x, z) facing `heading`, with the follow camera behind it. */
    place: (x: number, z: number, heading: number) => void;
    /** Tilt the follow view up (radians, as a vertical drag does). */
    look: (up: number) => void;
    /**
     * Test/capture hook (VA-0190): hold the camera at a fixed eye and target (and fov, degrees) so
     * close-ups of one piece of art are repeatable whatever the avatar is doing; null releases it.
     * Nothing in the game calls this.
     */
    pinCamera: (pin: { pos: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov?: number } | null) => void;
    /** World position and yaw of the first object with this name, or null (for aiming pinCamera). */
    objectPose: (name: string) => { x: number; y: number; z: number; yaw: number } | null;
  };
}

/**
 * Fading pieces (the avatar, a framed machine's chair) are put in the transparent pass once, at
 * build time. three.js compiles opaque materials with an OPAQUE define that forces alpha to 1,
 * so flipping `transparent` while playing would rebuild their shaders (a hitch on a phone each
 * time the fade starts or ends); kept transparent, a fade only changes uniforms and depthWrite.
 * At opacity 1 with depthWrite on they draw as before.
 */
/** A `?name=value` URL switch, read only in dev/proto builds (prototype opt-ins until Joshua has seen them). */
function devFlag(name: string): string | null {
  if (!(import.meta.env.MODE === 'proto' || import.meta.env.DEV)) return null;
  return new URLSearchParams(location.search).get(name);
}

function makeFadeable(m: THREE.Material): void {
  m.transparent = true;
  m.depthWrite = true;
  m.needsUpdate = true;
}
function setFade(m: THREE.Material, alpha: number): void {
  m.opacity = alpha;
  m.depthWrite = alpha >= 1;
}

const WALK_SPEED = 2.6; // m/s
const TURN_SPEED = 10; // rad/s
const CAM_FOLLOW_TURN = 2.2; // rad/s: how fast the follow camera swings behind a walking avatar
const SIT_MS = 450;
/** Tilts the follow camera tries, in order, to see the avatar over a chair back. */
const LOOK_OVER_TILTS = [0, 10, 20, 30, 40, 50].map((d) => (d * Math.PI) / 180);

const C = {
  bg: 0x120c16,
  avatar: 0xe3ded6,
  npc: 0x8796a8,
  free: 0x37c76a,
  taken: 0xdf4b4b,
  mine: 0xf1c550,
};

export function mountFloor(opts: FloorOptions): FloorHandle {
  const st: FloorState = { pos: { ...opts.state.pos }, heading: opts.state.heading, mode: opts.state.mode, dist: { ...opts.state.dist } };
  let reduced = opts.reducedMotion;
  // ------------------------------------------------------------------ renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(C.bg);
  const canvas = renderer.domElement;
  canvas.id = 'va3d-canvas';
  Object.assign(canvas.style, { position: 'fixed', inset: '0', zIndex: '20', touchAction: 'none', display: 'block' });
  document.body.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 80);
  // ChatGPT's art uses physically based materials: they need tone mapping, an environment to
  // reflect (metals look black without one) and warm key lights under the chandeliers
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // draw calls are counted across every pass of a frame (scene + bloom), reset in frame()
  renderer.info.autoReset = false;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envMap = pmrem.fromScene(roomEnv, 0.04).texture;
  roomEnv.dispose();
  pmrem.dispose();
  scene.environment = envMap;
  const hemi = new THREE.HemisphereLight();
  scene.add(hemi);
  const sun = new THREE.DirectionalLight();
  sun.position.set(4, 9, 6);
  scene.add(sun);
  const lamps = [-4, 2.6].map((z) => {
    const lamp = new THREE.PointLight();
    lamp.position.set(0, 3.9, z);
    scene.add(lamp);
    return lamp;
  });
  // lighting mode (lighting.ts): "vegas" (dim room, neon bloom) by default, "flat" as before
  let lightMode: LightMode = 'vegas';
  try {
    // the Svelte machines (prototype) default to the warm reference-room light (VA-0160)
    const svelteStyle = (import.meta.env.MODE === 'proto' || import.meta.env.DEV) && readMachineStyle() !== 'classic';
    lightMode = parseLightMode(localStorage.getItem(LIGHT_STORAGE_KEY), svelteStyle ? 'warm' : 'vegas');
  } catch {
    /* storage unavailable: vegas */
  }
  // the gold-coffer ceiling lowers and dims the warm lamps (grandHall.ts lampsForCeiling)
  let lampScale = 1;
  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  function applyLighting(): void {
    const rig = LIGHT_RIGS[lightMode];
    renderer.toneMappingExposure = rig.exposure;
    scene.environmentIntensity = rig.envIntensity;
    hemi.color.setHex(rig.hemi.sky);
    hemi.groundColor.setHex(rig.hemi.ground);
    hemi.intensity = rig.hemi.intensity;
    sun.color.setHex(rig.sun.color);
    sun.intensity = rig.sun.intensity;
    for (const l of lamps) {
      l.color.setHex(rig.lamp.color);
      l.intensity = rig.lamp.intensity * lampScale;
      l.distance = rig.lamp.distance;
      l.decay = rig.lamp.decay;
    }
    if (!rig.bloom) {
      composer?.dispose();
      bloomPass?.dispose();
      composer = bloomPass = null;
      return;
    }
    if (!composer) {
      // HalfFloat keeps the emissive >1.0 values for the threshold; MSAA keeps the edges the
      // canvas antialias would have given (cheap on the phone's tiled GPU)
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      composer = new EffectComposer(renderer, target);
      composer.addPass(new RenderPass(scene, camera));
      // UnrealBloomPass blurs from half the size it's given down: a cheap, mobile-sized chain
      bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0, 0, 0);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
      composer.setPixelRatio(pixelRatio);
      composer.setSize(window.innerWidth, window.innerHeight);
    }
    bloomPass!.strength = rig.bloom.strength;
    bloomPass!.radius = rig.bloom.radius;
    bloomPass!.threshold = rig.bloom.threshold;
  }
  applyLighting();

  const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
  const pickables: THREE.Object3D[] = [];
  /** Meshes the follow camera must not pass through. */
  const camBlockers: THREE.Object3D[] = [];
  /** Low furniture (chairs): the follow camera looks over these instead of pulling in. */
  const lowBlockers: THREE.Object3D[] = [];

  // ------------------------------------------------------------------ art (ChatGPT, PR #2)
  // chairs face the table: a heading h faces (sin h, -cos h); an object turned by -h faces it
  // which art: the pass-05 pilot (ChatGPT, VA-0029) unless the player switched back to pass 04
  // the art button cycles pass 04 → pass 05 pilot → pass 05 with ChatGPT's opt-in blackjack
  // hero table (VA-0054); `?bjhero` in the dev server also turns the hero table on
  let pilot05 = true;
  let blackjackHero = false;
  try {
    const mode = localStorage.getItem('va3d.art');
    pilot05 = mode !== 'pass04';
    blackjackHero = mode === 'pilot05-bj';
  } catch {
    /* storage unavailable: show the pilot */
  }
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('bjhero')) blackjackHero = pilot05;
  // ChatGPT's woven carpet in place of the pilot carpet (VA-0058): `?carpet` in the dev server, or
  // the ⚙ carpet button (stored, so it also works in the APK where there is no query string)
  let carpetPref = false;
  try {
    carpetPref = localStorage.getItem('va3d.carpet') === 'woven';
  } catch {
    /* storage unavailable: pilot carpet */
  }
  const wovenCarpet =
    pilot05 && (carpetPref || (typeof location !== 'undefined' && new URLSearchParams(location.search).has('carpet')));
  // the player's look: ChatGPT's guest avatar pilot (VA-0035) unless switched back to the capsule
  let guestAvatar = true;
  try {
    guestAvatar = localStorage.getItem('va3d.avatar') !== 'capsule';
  } catch {
    /* storage unavailable: show the pilot */
  }
  // which floor: the salon, or the opt-in grand hall preview (VA-0064); one layout describes it
  const hall = readHall();
  // prototype switch: Svelte 01 cabinets in place of every machine, rows closed by marquee end caps;
  // in the grand hall they stand in back-to-back islands (Joshua, VA-0197)
  const machineStyle = import.meta.env.MODE === 'proto' || import.meta.env.DEV ? readMachineStyle() : 'classic';
  const svelteMachines = machineStyle !== 'classic';
  // crosswise since Joshua's 2026-11-19 "Turn them crosswise"; `?islands=along` keeps the VA-0197 long islands
  const islandsParam = new URLSearchParams(location.search).get('islands');
  const layout = layoutFor(hall, pilot05, blackjackHero, { islands: svelteMachines && islandsParam !== 'off', islandDir: islandsParam === 'along' ? 'along' : 'across' });
  useRoom(layout.room);
  // the grand hall has no exterior yet: its overview stays between the side walls, and the
  // ground beyond the hall is dark rather than the salon's purple
  setOverviewSides(hall === 'grand' ? { x0: ROOM.x0 + 0.2, x1: ROOM.x1 - 0.2 } : null);
  if (hall === 'grand') renderer.setClearColor(0x000000);
  const TABLE = layout.table;
  // the hero table brings its own seat and dealer anchors (VA-0056); the round table keeps the art's
  const SEATS = layout.seats;
  const DEALER_SPOT = layout.dealer;
  // Svelte machines stand in continuous banks with a stool at each (Joshua's reference room, VA-0160);
  // the stools replace the pilot's swivel chair
  const baseObstacles = (hall === 'grand' ? layout.obstacles : obstaclesFor(pilot05, blackjackHero)).filter((o) => !(svelteMachines && o.id === 'pilot-luxury-chair'));
  // the grand hall's back row stands outside the walkable room, against the end wall; its caps (and
  // the side banks' back caps) may stand out to that wall line, 0.2 m off the wall like the room
  const capRoom = layout.hallSpec ? { ...ROOM, z0: -layout.hallSpec.length / 2 + 0.2 } : ROOM;
  const svelteBanks = svelteMachines ? planBanks([...layout.slots, ...layout.decor.slots], baseObstacles, ROOM, capRoom) : null;
  // prototype switch (VA-0175): the grand hall's own ceiling, or ChatGPT's gold coffers and chandeliers
  const ceilingStyle = (import.meta.env.MODE === 'proto' || import.meta.env.DEV) && hall === 'grand' ? readCeilingStyle() : 'hall';
  const lampPlan = lampsForCeiling(layout.lamps, ceilingStyle);
  lampPlan.lamps.forEach((p, i) => lamps[i]?.position.set(p.x, p.y, p.z));
  lampScale = lampPlan.intensityScale;
  applyLighting();
  const art = buildArtScene(new Map(SEATS.map((s) => [s.id, { facing: -s.facing, x: s.x, z: s.z }])), { pilot05, blackjackHero, wovenCarpet, layout, ceiling: ceilingStyle, svelteMachines, svelteLod: machineStyle === 'svelte-lod' || machineStyle === 'svelte-lod-mid', svelteMidLod: machineStyle === 'svelte-lod-mid', svelteBanks: svelteBanks ?? undefined, artFarStool: devFlag('farstool') === 'art', slimNear: devFlag('nearcab') === 'slim', slimLod: devFlag('slimlod') === 'on', heroLod: devFlag('herolod') !== 'off', heroFar: ['on', 'accent', 'theme'].includes(devFlag('herofar') ?? ''), heroFarAccent: devFlag('herofar') === 'accent', heroFarTheme: devFlag('herofar') === 'theme', heroFarScreen: devFlag('farscreen') === null ? undefined : Number(devFlag('farscreen')), heroFarGlow: { intensity: devFlag('farglow') === null ? undefined : Number(devFlag('farglow')), tint: devFlag('fartint') === null ? undefined : Number(devFlag('fartint')) }, copyFar: devFlag('copyfar') === 'on', heroFarScreenTex: devFlag('farscreentex') === 'atlas' ? 'atlas' : devFlag('farscreentex') === 'on' });
  // the end-wall heroes start in full detail (art.heroLod.lite starts hidden); frame() switches them by distance
  let heroLevel: HeroLodLevel = 'full';
  const heroHasFar = !!art.heroLod?.far.length;
  // the pilot's swivel chair and the hero table's wider ends are furniture you can't walk through
  const obstacles = [...(hall === 'grand' ? layout.obstacles : obstaclesFor(pilot05, art.blackjackHero))].filter((o) => !(svelteMachines && o.id === 'pilot-luxury-chair'));
  // ChatGPT's far chase bulb (VA-0232), dev opt-in `?capbulbs=lod`; default keeps every bulb on the 20-tri icosahedron
  const capScene = svelteBanks ? buildSvelteCaps(svelteBanks.caps, devFlag('capbulbs') === 'lod' ? { bulbLod: CAP_BULB_FAR_M } : {}) : null;
  if (svelteBanks && capScene) {
    obstacles.push(...svelteBanks.obstacles);
    scene.add(capScene.root);
  }
  // ChatGPT's optional island seam topper (VA-0201), dev/proto opt-in until Joshua has seen it
  const toppers = svelteBanks && devFlag('topper') === 'on' ? buildIslandToppers(islandSeams(svelteBanks)) : null;
  if (toppers) scene.add(toppers.root);
  const nav = new NavGrid(ROOM, obstacles);
  scene.add(art.root);
  const walls = art.walls;
  /** Batches the cutaway shows and hides per wall or ceiling part (the rest always draw, VA-0052). */
  const sidedBatches = new Set<THREE.Object3D>([...Object.values(art.walls), ...Object.values(art.ceiling)].flat());
  // the hero's own canvas textures (title, BONUS sign) must survive batching as maps (VA-0048)
  const heroMaps = new Set<THREE.Texture>();
  art.root.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
    if (mat?.map && art.heroTextures.includes(mat.map)) heroMaps.add(mat.map);
  });

  // ------------------------------------------------------------------ roof in the overview
  type RoofMode = 'lights' | 'glass' | 'off';
  const ROOF_MODES: RoofMode[] = ['lights', 'glass', 'off'];
  let roofMode: RoofMode = 'lights';
  try {
    const saved = localStorage.getItem('va3d.roof') as RoofMode | null;
    if (saved && ROOF_MODES.includes(saved)) roofMode = saved;
  } catch {
    /* storage unavailable: keep the default */
  }
  const roofSolid = art.ceiling.roof.map((m) => m.material as THREE.Material);
  const roofGlass = roofSolid.map((mat) => {
    const g = mat.clone();
    g.transparent = true;
    g.opacity = 0.22;
    g.depthWrite = false;
    return g;
  });

  // ------------------------------------------------------------------ slot reels (art pass 04)
  // Each cabinet's 25 reel cells show its machine's real symbols (the same PNGs the 2D slots use),
  // as one 5x5 canvas atlas per machine. Static idle boards only: no spins, wins or balances.
  let reelTextures = 0;
  // once every machine's atlas is drawn, all reels share one sheet texture and one draw call
  // (VA-0222); `?reelsheet=off` keeps one material per machine for comparison
  const reelSources: ReelSource[] = [];
  const reelLoads: Promise<unknown>[] = [];
  let reelSheet: ReelSheet | null = null;
  let reelsSettled = false;
  for (const m of MACHINES) {
    const mesh = art.interactive.get(`slot_${m.id}/reels`);
    if (!mesh) continue;
    const load = createVelvetReelArt(THREE, m.id, m.symbols, { base: './art' })
      .then((reel: { texture: THREE.Texture; canvas: HTMLCanvasElement; dispose: () => void }) => {
        if (disposed) return reel.dispose();
        reelSources.push({ id: m.id, canvas: reel.canvas, meshes: [mesh] });
        applyVelvetReelAtlas(THREE, mesh, reel);
        // the grand hall's copies of this machine: the same atlas, mapped 25 cells at a time
        const copies = art.reelCopies.get(m.id);
        if (copies) {
          const parts = copies.userData.parts as string[];
          const uv = copies.geometry.getAttribute('uv');
          for (let i = 0; i + 25 <= parts.length; i += 25) {
            const chunk = { userData: { parts: parts.slice(i, i + 25) }, geometry: { groups: copies.geometry.groups.slice(i, i + 25), getAttribute: () => uv }, material: null };
            applyVelvetReelAtlas(THREE, chunk, reel);
            (chunk.material as unknown as THREE.Material | null)?.dispose();
          }
          copies.material = mesh.material;
          reelSources[reelSources.length - 1].meshes.push(copies);
        }
        // the old reel material may be shared with other batches; dispose() frees it with the scene
        delete mesh.userData.originalMaterial;
        reelTextures++;
      })
      .catch((err: unknown) => console.warn('[floor3d] reel art', m.id, err));
    reelLoads.push(load);
  }
  if (reelLoads.length > 1 && devFlag('reelsheet') !== 'off') {
    void Promise.allSettled(reelLoads).then(() => {
      if (disposed) return;
      // a stable tile order whatever order the atlases finished in
      reelSources.sort((a, b) => MACHINES.findIndex((x) => x.id === a.id) - MACHINES.findIndex((x) => x.id === b.id));
      reelSheet = buildReelSheet(reelSources, Math.min(4096, renderer.capabilities.maxTextureSize), (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }));
      if (!reelSheet) return;
      art.root.add(reelSheet.mesh);
      // the hidden per-machine reels keep their canvases (refresh redraws from them); their GPU
      // copies are freed and would be uploaded again only if they were shown
      for (const s of reelSources) for (const r of s.meshes) ((r.material as THREE.MeshBasicMaterial).map as THREE.Texture | null)?.dispose();
    });
  }
  // registered after the sheet's own handler, so the sheet is in the scene when this flips
  void Promise.allSettled(reelLoads).then(() => {
    reelsSettled = true;
  });

  // ------------------------------------------------------------------ gameplay proxies
  // Taps and the follow camera's collision use simple invisible shapes, not the detailed art.
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const proxy = (geo: THREE.BufferGeometry, x: number, y: number, z: number, data: Record<string, unknown>, blocksCamera: boolean) => {
    const m = new THREE.Mesh(geo, hidden);
    m.position.set(x, y, z);
    Object.assign(m.userData, data);
    scene.add(m);
    pickables.push(m);
    if (blocksCamera) camBlockers.push(m);
    return m;
  };
  const w = ROOM.x1 - ROOM.x0;
  const d = ROOM.z1 - ROOM.z0;
  proxy(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), (ROOM.x0 + ROOM.x1) / 2, 0, (ROOM.z0 + ROOM.z1) / 2, { floor: true }, false);
  proxy(new THREE.BoxGeometry(w, ROOM.wallHeight, 0.2), (ROOM.x0 + ROOM.x1) / 2, ROOM.wallHeight / 2, ROOM.z0 - 0.1, { obstacle: 'wall' }, true);
  for (const x of [ROOM.x0 - 0.1, ROOM.x1 + 0.1]) proxy(new THREE.BoxGeometry(0.2, ROOM.wallHeight, d), x, ROOM.wallHeight / 2, (ROOM.z0 + ROOM.z1) / 2, { obstacle: 'wall' }, true);
  for (const o of obstacles) {
    if (o.id.endsWith('-chair')) {
      // seats have their own tap volumes (below); this one is the chair back's height, so the
      // follow camera can tilt up and look over it instead of filling the screen with it
      if (o.kind === 'circle') {
        const h = 1.75;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, h, 12), hidden);
        m.position.set(o.x, h / 2, o.z);
        scene.add(m);
        lowBlockers.push(m);
      }
      continue;
    }
    // the salon's table is `table`; the grand hall's are `<id>-table`
    const data = o.id === 'table' || o.id.endsWith('-table') ? { table: true } : { obstacle: o.id };
    if (o.kind === 'circle') proxy(new THREE.CylinderGeometry(o.r, o.r, o.h, 16), o.x, o.h / 2, o.z, data, true);
    else proxy(new THREE.BoxGeometry(o.x1 - o.x0, o.h, o.z1 - o.z0), (o.x0 + o.x1) / 2, o.h / 2, (o.z0 + o.z1) / 2, data, true);
  }
  // placeholder people (no rigged human art yet): the dealer; the grand hall's other tables have
  // placeholder dealers too, and taken seats a computer player (below). None move, so they are
  // drawn as one merged mesh (placeholderCrowd.ts, VA-0268) instead of two draw calls each.
  const people: PlaceholderPerson[] = [{ x: DEALER_SPOT.x, z: DEALER_SPOT.z, heading: 0, lift: 0 }];
  for (const p of layout.decor.dealers) people.push({ x: p.x, z: p.z, heading: 0, lift: 0 });
  const labels = [TABLE, ...layout.decor.tables].map((t) => label('BLACKJACK', t.x, 2.6, t.z - 0.6, 1.6));
  scene.add(...labels);

  // seats: a state ring on the floor, a tap volume and a bobbing marker over free seats
  const seatViews = new Map<string, { ring: THREE.Mesh; marker: THREE.Mesh | null }>();
  for (const s of SEATS) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 40), new THREE.MeshBasicMaterial({ color: s.taken ? C.taken : C.free, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    // above the art's contact-shadow decals (y 0.069), so the ring's colour isn't dimmed
    ring.position.set(s.x, 0.08, s.z);
    ring.userData.seat = s.id;
    // a generous invisible tap target around the chair
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 12), hidden);
    hit.position.set(s.x, 0.8, s.z);
    hit.userData.seat = s.id;
    let marker: THREE.Mesh | null = null;
    if (!s.taken) {
      // drawn over everything (VA-0109): from the landscape spawn the avatar's head covered the
      // free seat's marker, the one cue that says where to go. Transparent so it sorts after the
      // avatar (which fades through the transparent pass); same single draw call.
      marker = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.36, 4), new THREE.MeshBasicMaterial({ color: C.free, transparent: true, depthTest: false, depthWrite: false }));
      marker.renderOrder = 11;
      marker.name = `seat-marker:${s.id}`;
      marker.rotation.x = Math.PI;
      marker.position.set(s.x, 2.1, s.z);
      scene.add(marker);
    } else {
      // stage 1 has no multiplayer: a computer player shows what "taken" looks like
      people.push({ x: s.x, z: s.z, heading: s.facing, lift: SEAT_HEIGHT - 0.45 });
    }
    scene.add(ring, hit);
    pickables.push(hit, ring);
    seatViews.set(s.id, { ring, marker });
  }
  const crowd = buildPlaceholderCrowd(people, AVATAR_HEIGHT, C.npc);
  if (crowd) scene.add(crowd);

  // ------------------------------------------------------------------ avatar
  // a visual skin only: collision radius, movement and the cameras are the same either way
  const avatar = guestAvatar ? buildGuestAvatar(AVATAR_HEIGHT) : capsule(C.avatar, st.pos.x, st.pos.z, st.heading, 0);
  avatar.position.set(st.pos.x, 0, st.pos.z);
  avatar.rotation.y = -st.heading;
  scene.add(avatar);
  /** The player's own avatar materials: faded when the follow camera is pulled in close. */
  const avatarMats: THREE.Material[] = [];
  avatar.traverse((o) => {
    if (o instanceof THREE.Mesh) avatarMats.push(o.material as THREE.Material);
  });
  for (const m of avatarMats) makeFadeable(m);
  for (const meshes of art.fadeable.values()) for (const m of meshes) makeFadeable(m.material as THREE.Material);
  let avatarAlpha = 1;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  const tapMarker = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 32), new THREE.MeshBasicMaterial({ color: C.mine, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  tapMarker.rotation.x = -Math.PI / 2;
  scene.add(tapMarker);

  /** A capsule person facing `heading` (0 = -Z), raised by `lift` (for sitting). */
  function capsule(color: number, x: number, z: number, heading: number, lift: number): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, AVATAR_HEIGHT - 0.54, 6, 14), lambert(color));
    body.position.y = AVATAR_HEIGHT / 2;
    // a "nose" so the facing direction reads from any camera
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.16), lambert(0x403c44));
    nose.position.set(0, AVATAR_HEIGHT - 0.22, -0.28);
    g.add(body, nose);
    g.position.set(x, lift, z);
    g.rotation.y = -heading;
    return g;
  }

  function label(textStr: string, x: number, y: number, z: number, width: number): THREE.Sprite {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 128;
    const g = cv.getContext('2d')!;
    g.fillStyle = 'rgba(20,14,26,0.82)';
    g.beginPath();
    g.roundRect(4, 4, 504, 120, 28);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = '800 64px Outfit, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(textStr, 256, 68);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(width, width / 4, 1);
    sp.position.set(x, y, z);
    sp.renderOrder = 10;
    return sp;
  }

  // ------------------------------------------------------------------ HUD
  const hud = document.createElement('div');
  hud.id = 'va3d-hud';
  hud.innerHTML = `
<style>
#va3d-hud{position:fixed;inset:0;z-index:21;pointer-events:none;font-family:Outfit,system-ui,sans-serif;color:#fff;
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
#va3d-hud button{pointer-events:auto;min-width:48px;min-height:48px;border-radius:24px;border:2px solid #e9c86a;background:rgba(36,18,46,.88);
  color:#ffe9a8;font:800 15px Outfit,system-ui,sans-serif;padding:0 16px}
#va3d-hud .head{position:absolute;top:calc(env(safe-area-inset-top) + 10px);left:calc(env(safe-area-inset-left) + 10px);right:calc(env(safe-area-inset-right) + 10px)}
#va3d-hud .top{display:flex;gap:8px;align-items:center;justify-content:flex-end}
#va3d-hud .top .back{margin-right:auto}
#va3d-hud .gear{padding:0;width:48px;font-size:22px}
#va3d-hud .gear[aria-expanded=true]{background:#e9c86a;color:#24122e}
#va3d-hud .menu{position:absolute;right:0;top:56px;display:none;flex-direction:column;gap:8px;align-items:stretch;
  padding:10px;border-radius:20px;background:rgba(20,12,26,.92);border:1px solid rgba(233,200,106,.5)}
#va3d-hud .menu.open{display:flex}
#va3d-hud .menu button{text-align:left;line-height:1.2;padding:6px 16px}
/* long labels (e.g. the table-chair cycle) wrap instead of widening the menu across a portrait phone,
   so floor to the menu's left stays tappable to close it */
#va3d-hud .menu{max-width:min(300px,78vw);box-sizing:border-box}
/* seven 48 dp buttons stacked are ~404 px: too tall under the top bar on a 384 px landscape phone */
/* eleven buttons (with the table-chair cycle) need three columns to fit under the bar at 384 px */
@media (max-height:520px){#va3d-hud .menu{max-width:calc(100vw - 20px)}#va3d-hud .menu.open{display:grid;grid-template-columns:repeat(3,auto);gap:8px}}
#va3d-hud .badge{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 4px);text-align:center;font:700 10px Outfit,sans-serif;
  letter-spacing:1px;color:#e9c86a;opacity:.85;text-shadow:0 1px 3px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8px}
/* the hint sits just under the top bar: lower down it ran across the avatar in the follow view (VA-0057) */
#va3d-hud .toast{position:absolute;left:16px;right:16px;top:calc(env(safe-area-inset-top) + 68px);text-align:center;font:700 16px Outfit,sans-serif;
  opacity:0;transition:opacity .25s;text-shadow:0 1px 4px #000,0 0 10px rgba(0,0,0,.6)}
#va3d-hud .head{z-index:1}
#va3d-hud .joy{pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 24px);bottom:calc(env(safe-area-inset-bottom) + 40px);width:132px;height:132px;border-radius:50%;
  background:rgba(20,12,26,.45);border:2px solid rgba(233,200,106,.7);touch-action:none}
#va3d-hud .knob{position:absolute;left:41px;top:41px;width:50px;height:50px;border-radius:50%;background:rgba(233,200,106,.85)}
/* two short right-aligned lines kept right of the joystick (24 + 132 px): one long line ran under it on 360 px phones */
#va3d-hud .perf{position:absolute;left:calc(env(safe-area-inset-left) + 172px);right:calc(env(safe-area-inset-right) + 10px);bottom:calc(env(safe-area-inset-bottom) + 22px);
  text-align:right;white-space:pre-line;line-height:1.25;font:600 11px ui-monospace,monospace;color:#cbb6d6;text-shadow:0 1px 2px #000}
</style>
<div class="head">
  <div class="top">
    <button type="button" class="back" aria-label="Back to the lobby">‹ Lobby</button>
    <button type="button" class="cam"></button>
    <button type="button" class="gear" aria-label="View settings" aria-expanded="false" aria-controls="va3d-menu">⚙</button>
  </div>
  <div class="menu" id="va3d-menu">
    <button type="button" class="rotate"></button>
    <button type="button" class="motion" aria-pressed="false"></button>
    <button type="button" class="roof"></button>
    <button type="button" class="artpass"></button>
    <button type="button" class="avatarart"></button>
    <button type="button" class="carpetart"></button>
    <button type="button" class="hall"></button>
    <button type="button" class="lightmode"></button>
    <button type="button" class="sveltemachines" hidden></button>
    <button type="button" class="ceilingstyle" hidden></button>
    <button type="button" class="chairstyle" hidden></button>
    <button type="button" class="sveltepreview" hidden>Preview: Svelte 01 slot</button>
  </div>
</div>
<div class="badge"></div>
<div class="toast" role="status" aria-live="polite"></div>
<div class="joy" aria-label="Walk joystick"><div class="knob"></div></div>
<div class="perf"></div>`;
  document.body.appendChild(hud);
  const $ = <T extends HTMLElement>(s: string) => hud.querySelector(s) as T;
  const camBtn = $<HTMLButtonElement>('.cam');
  const motionBtn = $<HTMLButtonElement>('.motion');
  const rotateBtn = $<HTMLButtonElement>('.rotate');
  const roofBtn = $<HTMLButtonElement>('.roof');
  const artBtn = $<HTMLButtonElement>('.artpass');
  const artLabel = !pilot05 ? 'pass 04' : art.blackjackHero ? 'pass 05 + BJ table' : 'pass 05 pilot';
  $<HTMLDivElement>('.badge').textContent =
    hall === 'grand' ? 'PROTOTYPE · GRAND HALL PREVIEW' : protoBadge({ pilot05, blackjackHero: art.blackjackHero, wovenCarpet: art.wovenCarpet });
  const hallBtn = $<HTMLButtonElement>('.hall');
  hallBtn.textContent = hall === 'grand' ? 'Hall: grand (preview)' : 'Hall: salon';
  hallBtn.setAttribute('aria-label', `Hall: ${hall === 'grand' ? 'grand hall preview' : 'salon'}. Tap to switch (reloads the floor).`);
  // the grand hall composes its own art: the salon's art and carpet switches don't apply there
  if (hall === 'grand') $<HTMLButtonElement>('.artpass').hidden = true;
  artBtn.textContent = `Art: ${artLabel}`;
  artBtn.setAttribute('aria-label', `Art: ${artLabel}. Tap to switch (reloads the floor).`);
  const avatarBtn = $<HTMLButtonElement>('.avatarart');
  avatarBtn.textContent = guestAvatar ? 'Avatar: guest pilot' : 'Avatar: capsule';
  avatarBtn.setAttribute('aria-label', `Avatar: ${guestAvatar ? 'guest pilot' : 'capsule'}. Tap to switch (reloads the floor).`);
  const carpetBtn = $<HTMLButtonElement>('.carpetart');
  carpetBtn.hidden = !pilot05 || hall === 'grand';
  carpetBtn.textContent = wovenCarpet ? 'Carpet: woven' : 'Carpet: pilot';
  carpetBtn.setAttribute('aria-label', `Carpet: ${wovenCarpet ? 'woven' : 'pilot'}. Tap to switch (reloads the floor).`);
  const lightBtn = $<HTMLButtonElement>('.lightmode');
  const gearBtn = $<HTMLButtonElement>('.gear');
  const menuEl = $<HTMLDivElement>('.menu');
  const setMenu = (open: boolean) => {
    menuEl.classList.toggle('open', open);
    gearBtn.setAttribute('aria-expanded', String(open));
  };
  let rotate = opts.rotate;
  const joy = $<HTMLDivElement>('.joy');
  const knob = $<HTMLDivElement>('.knob');
  const toastEl = $<HTMLDivElement>('.toast');
  const perfEl = $<HTMLDivElement>('.perf');
  let toastTimer = 0;
  const toast = (msg: string, ms = 1800) => {
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toastEl.style.opacity = '0'), ms);
  };
  const syncHud = () => {
    // the button names the view you'll switch TO
    camBtn.textContent = st.mode === 'follow' ? '⤢ Overview' : '⤡ Follow';
    camBtn.setAttribute('aria-label', st.mode === 'follow' ? 'Switch to the overview camera' : 'Switch to the follow camera');
    motionBtn.textContent = reduced ? 'Motion: reduced' : 'Motion: full';
    rotateBtn.textContent = `⟳ Rotate: ${rotate === 'auto' ? 'auto' : rotate === 'landscape' ? 'landscape' : 'portrait'}`;
    rotateBtn.setAttribute('aria-label', `Screen rotation: ${rotate}. Tap to change.`);
    motionBtn.setAttribute('aria-pressed', String(reduced));
    roofBtn.textContent = `Roof from above: ${roofMode === 'lights' ? 'lights only' : roofMode === 'glass' ? 'see-through' : 'off'}`;
    roofBtn.setAttribute('aria-label', `Overview roof: ${roofMode}. Tap to change.`);
    const lightName = { vegas: 'Vegas + glow', warm: 'warm gold + glow', flat: 'flat' }[lightMode];
    lightBtn.textContent = `Lighting: ${lightName}`;
    lightBtn.setAttribute('aria-label', `Lighting: ${lightName}. Tap to switch.`);
    joy.style.display = st.mode === 'follow' ? 'block' : 'none';
  };
  syncHud();
  window.setTimeout(() => toast('Tap the floor to walk · tap a green seat to sit', 4000), 400);

  // ------------------------------------------------------------------ state
  let path: Vec2[] = [];
  let pendingSeat: Seat | null = null;
  let sitting: { seat: Seat; t0: number; from: Vec2; fromHeading: number } | null = null;
  let seated: Seat | null = null;
  let camYaw = st.heading;
  let transition: { from: CamPose; t0: number } | null = null;
  let pinned: { pos: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov?: number } | null = null;
  let lastPose: CamPose = desiredPose(st.mode, st.pos, camYaw, st.dist[st.mode], { aspect: window.innerWidth / window.innerHeight });
  /** Overview drag offset from the avatar (metres on the floor). */
  let pan = { x: 0, z: 0 };
  let joyVec = { x: 0, y: 0 };
  let tapFade = 0;
  /** Extra follow-camera tilt (radians) for looking over a chair back, eased. */
  let lookOver = 0;
  /** The machine the follow camera is framing (VA-0043), with its weight and aim point eased. */
  let focus: MachineFocus | null = null;
  /** Current opacity of each machine's fadeable furniture (see art.fadeable). */
  const propAlpha = new Map<string, number>();
  let disposed = false;

  function setMode(mode: CamMode): void {
    if (mode === st.mode) return;
    transition = reduced ? null : { from: lastPose, t0: performance.now() };
    st.mode = mode;
    if (mode === 'follow') camYaw = st.heading;
    pan = { x: 0, z: 0 };
    joyVec = { x: 0, y: 0 };
    syncHud();
    opts.onPrefs(st.mode, reduced);
  }
  camBtn.addEventListener('click', () => setMode(st.mode === 'follow' ? 'overview' : 'follow'));
  rotateBtn.addEventListener('click', () => {
    rotate = ROTATE_ORDER[(ROTATE_ORDER.indexOf(rotate) + 1) % ROTATE_ORDER.length];
    syncHud();
    opts.onRotate(rotate);
  });
  motionBtn.addEventListener('click', () => {
    reduced = !reduced;
    syncHud();
    opts.onPrefs(st.mode, reduced);
  });
  roofBtn.addEventListener('click', () => {
    roofMode = ROOF_MODES[(ROOF_MODES.indexOf(roofMode) + 1) % ROOF_MODES.length];
    try {
      localStorage.setItem('va3d.roof', roofMode);
    } catch {
      /* not remembered: fine */
    }
    syncHud();
  });
  artBtn.addEventListener('click', () => {
    try {
      localStorage.setItem('va3d.art', !pilot05 ? 'pilot05' : art.blackjackHero ? 'pass04' : 'pilot05-bj');
    } catch {
      return toast('Can’t switch art: storage is unavailable');
    }
    location.reload();
  });
  avatarBtn.addEventListener('click', () => {
    try {
      localStorage.setItem('va3d.avatar', guestAvatar ? 'capsule' : 'guest');
    } catch {
      return toast('Can’t switch the avatar: storage is unavailable');
    }
    location.reload();
  });
  hallBtn.addEventListener('click', () => {
    try {
      localStorage.setItem(HALL_STORAGE_KEY, hall === 'grand' ? 'salon' : 'grand');
    } catch {
      return toast('Can’t switch the hall: storage is unavailable');
    }
    location.reload();
  });
  carpetBtn.addEventListener('click', () => {
    try {
      localStorage.setItem('va3d.carpet', wovenCarpet ? 'pilot' : 'woven');
    } catch {
      return toast('Can’t switch the carpet: storage is unavailable');
    }
    location.reload();
  });
  lightBtn.addEventListener('click', () => {
    lightMode = nextLightMode(lightMode);
    try {
      localStorage.setItem(LIGHT_STORAGE_KEY, lightMode);
    } catch {
      /* not remembered: fine */
    }
    applyLighting();
    syncHud();
  });
  gearBtn.addEventListener('click', () => setMenu(!menuEl.classList.contains('open')));
  // prototype builds only: open ChatGPT's Svelte 01 close-up page so Joshua can review it on the phone (VA-0121)
  const svelteBtn = $<HTMLButtonElement>('.sveltepreview');
  svelteBtn.hidden = !(import.meta.env.MODE === 'proto' || import.meta.env.DEV);
  // prototype builds only: swap the floor's machines for Svelte islands (stored; reloads the floor)
  const machinesBtn = $<HTMLButtonElement>('.sveltemachines');
  machinesBtn.hidden = svelteBtn.hidden;
  machinesBtn.textContent = { classic: 'Machines: classic', svelte: 'Machines: Svelte islands (preview)', 'svelte-lod': 'Machines: Svelte islands + far LOD (preview)', 'svelte-lod-mid': 'Machines: Svelte islands + mid/far LOD (preview)' }[machineStyle];
  machinesBtn.setAttribute('aria-label', `${machinesBtn.textContent}. Tap to switch (reloads the floor).`);
  machinesBtn.addEventListener('click', () => {
    try {
      localStorage.setItem(MACHINES_STORAGE_KEY, NEXT_MACHINE_STYLE[machineStyle]);
    } catch {
      return toast('Can’t switch the machines: storage is unavailable');
    }
    location.reload();
  });
  // prototype builds, grand hall only: swap its ceiling for the gold coffers (stored; reloads the floor)
  const ceilingBtn = $<HTMLButtonElement>('.ceilingstyle');
  ceilingBtn.hidden = svelteBtn.hidden || hall !== 'grand';
  ceilingBtn.textContent = { hall: 'Ceiling: hall', 'gold-coffers': 'Ceiling: gold coffers + chandeliers (preview)', 'velvet-coffers': 'Ceiling: coffer tiles (preview)' }[ceilingStyle];
  ceilingBtn.setAttribute('aria-label', `${ceilingBtn.textContent}. Tap to switch (reloads the floor).`);
  ceilingBtn.addEventListener('click', () => {
    try {
      localStorage.setItem(CEILING_STORAGE_KEY, NEXT_CEILING_STYLE[ceilingStyle]);
    } catch {
      return toast('Can’t switch the ceiling: storage is unavailable');
    }
    location.reload();
  });
  // prototype builds, grand hall only: the table chairs, luxury or ChatGPT's LOD chair (stored; reloads the floor)
  const chairBtn = $<HTMLButtonElement>('.chairstyle');
  const chairStyle = readChairStyle();
  chairBtn.hidden = svelteBtn.hidden;
  chairBtn.textContent = { velvet: 'Table chairs: burgundy + gold, Velvet Ace back (preview)', luxury: 'Table chairs: cream luxury', 'lod-mid': 'Table chairs: burgundy (preview)', 'lod-near': 'Table chairs: burgundy, finer (preview)', swivel: 'Table chairs: leather swivel (preview)', tub: 'Table chairs: burgundy tub (preview)', casino: 'Table chairs: upholstered casino study (preview)', sculpted: 'Table chairs: sculpted gaming chair (preview)' }[chairStyle];
  chairBtn.setAttribute('aria-label', `${chairBtn.textContent}. Tap to switch (reloads the floor).`);
  chairBtn.addEventListener('click', () => {
    try {
      localStorage.setItem(CHAIR_STORAGE_KEY, NEXT_CHAIR_STYLE[chairStyle]);
    } catch {
      return toast('Can’t switch the chairs: storage is unavailable');
    }
    const url = new URL(location.href);
    url.searchParams.delete('chair');
    location.replace(url.toString());
  });
  svelteBtn.addEventListener('click', () => {
    if (!sitting && !seated) location.href = 'svelte-slot.html?view=front&reel=art&spin=loop&engine=sevens&finish=luxury&look=vegas&from=floor';
  });
  $<HTMLButtonElement>('.back').addEventListener('click', () => {
    if (!sitting && !seated) opts.onBack(snapshot());
  });

  const snapshot = (): FloorState => ({ pos: { ...st.pos }, heading: st.heading, mode: st.mode, dist: { ...st.dist } });

  function walkTo(p: Vec2): void {
    const route = nav.findPath(st.pos, p);
    if (!route || !route.length) {
      toast("Can't walk there");
      return;
    }
    path = route;
    const end = route[route.length - 1];
    tapMarker.position.set(end.x, 0.03, end.z);
    tapFade = 1;
  }

  function requestSeat(seat: Seat): void {
    if (seat.taken) {
      toast('That seat is taken');
      return;
    }
    pendingSeat = seat;
    walkTo(seat.approach);
    (seatViews.get(seat.id)!.ring.material as THREE.MeshBasicMaterial).color.setHex(C.mine);
    toast('Walking to your seat…', 1200);
  }

  function cancelSeat(): void {
    if (!pendingSeat) return;
    (seatViews.get(pendingSeat.id)!.ring.material as THREE.MeshBasicMaterial).color.setHex(C.free);
    pendingSeat = null;
  }

  // ------------------------------------------------------------------ input
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function tap(sx: number, sy: number): void {
    if (sitting || seated) return;
    ndc.set((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    // a seat's generous tap volume wins over the table or floor behind it
    const hit = hits.find((h) => h.object.userData.seat) ?? hits[0];
    if (!hit) return;
    const u = hit.object.userData;
    if (u.seat) {
      requestSeat(SEATS.find((s) => s.id === u.seat)!);
      return;
    }
    if (u.table) {
      // the nearest free seat to where the player stands
      const free = SEATS.filter((s) => !s.taken).sort((a, b) => Math.hypot(a.x - st.pos.x, a.z - st.pos.z) - Math.hypot(b.x - st.pos.x, b.z - st.pos.z))[0];
      if (free) requestSeat(free);
      else toast('This table is full');
      return;
    }
    cancelSeat();
    if (typeof u.obstacle === 'string' && u.obstacle.startsWith('slot')) toast('Slot machines come in a later stage');
    walkTo({ x: hit.point.x, z: hit.point.z });
  }

  const pointers = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
  let pinch: { d0: number; dist0: number } | null = null;
  let dragYaw: { x: number; y: number; yaw: number; look: number } | null = null;
  /** Follow view: how far a vertical drag has tilted the view up toward the ceiling. */
  let lookUp = 0;
  let dragPan: { x: number; y: number; pan: Vec2 } | null = null;
  const pinchDist = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const onDown = (e: PointerEvent) => {
    // a touch on the floor while the ⚙ menu is open only closes the menu: it must not also walk
    // the avatar, sit, or start a drag (the finger was aimed at "close", not at that spot)
    if (menuEl.classList.contains('open') && pointers.size === 0) {
      setMenu(false);
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    // event timestamps (when the finger touched), not handling time: while the first frames are
    // still compiling shaders, a quick tap's down and up can be handled far apart
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: e.timeStamp });
    if (pointers.size === 2) {
      pinch = { d0: pinchDist(), dist0: st.dist[st.mode] };
      dragYaw = null;
      dragPan = null;
    } else if (st.mode === 'follow') dragYaw = { x: e.clientX, y: e.clientY, yaw: camYaw, look: lookUp };
    else dragPan = { x: e.clientX, y: e.clientY, pan: { ...pan } };
  };
  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pinch && pointers.size === 2) {
      st.dist[st.mode] = clampZoom(st.mode, (pinch.dist0 * pinch.d0) / Math.max(20, pinchDist()));
    } else if (dragPan && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 12) {
      // one-finger drag in the overview slides the view across the floor (the floor follows the finger)
      const k = (st.dist.overview * 1.6) / window.innerHeight;
      const dx = (e.clientX - dragPan.x) * k;
      const dy = (e.clientY - dragPan.y) * k * 1.4;
      pan = {
        x: dragPan.pan.x - dx * OVERVIEW_AXES.right.x + dy * OVERVIEW_AXES.forward.x,
        z: dragPan.pan.z - dx * OVERVIEW_AXES.right.z + dy * OVERVIEW_AXES.forward.z,
      };
    } else if (dragYaw && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 12) {
      // one-finger drag: sideways swings the follow camera around the avatar, down tilts the
      // view up toward the ceiling (and back up levels it again)
      lookUp = Math.min(LOOK_UP_MAX, Math.max(0, dragYaw.look + ((e.clientY - dragYaw.y) / window.innerHeight) * LOOK_UP_MAX * 2.5));
      const before = camYaw;
      camYaw = dragYaw.yaw + ((e.clientX - dragYaw.x) / window.innerWidth) * Math.PI * 1.5;
      // turning the view by hand while walking turns the walk with it
      if (joyYaw !== null) joyYaw += camYaw - before;
    }
  };
  const onUp = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!p) return;
    const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
    if (pointers.size === 0 && moved < 12 && e.timeStamp - p.t0 < 600 && !pinch) tap(e.clientX, e.clientY);
    if (pointers.size === 0) {
      dragYaw = null;
      dragPan = null;
    }
  };
  const onWheel = (e: WheelEvent) => {
    st.dist[st.mode] = clampZoom(st.mode, st.dist[st.mode] * (1 + Math.sign(e.deltaY) * 0.1));
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });

  // joystick (follow view only): walks relative to the camera
  let joyId: number | null = null;
  /** The camera's facing when the stick was pressed: the frame this push walks in. */
  let joyYaw: number | null = null;
  const joyMove = (e: PointerEvent) => {
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let x = (e.clientX - cx) / (r.width / 2);
    let y = (e.clientY - cy) / (r.height / 2);
    const m = Math.hypot(x, y);
    if (m > 1) [x, y] = [x / m, y / m];
    joyVec = { x, y };
    knob.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
  };
  const joyEnd = () => {
    joyId = null;
    joyYaw = null;
    joyVec = { x: 0, y: 0 };
    knob.style.transform = '';
  };
  joy.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    joyId = e.pointerId;
    joyYaw = camYaw;
    joy.setPointerCapture(e.pointerId);
    path = [];
    cancelSeat();
    joyMove(e);
  });
  joy.addEventListener('pointermove', (e) => e.pointerId === joyId && joyMove(e));
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);

  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer?.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  // ------------------------------------------------------------------ loop
  const intervals: number[] = [];
  const cpu: number[] = [];
  let frames = 0;
  let last = performance.now();
  let perfShown = 0;
  const camRay = new THREE.Raycaster();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  let raf = 0;

  // VA-0316: for this frame's render only, hide the long art batches whose world box is out of
  // view (three.js culls by bounding sphere, which for these reaches past the hall's middle), and
  // draw the combined lite set in place of the lite and south sets when both ends are in view
  const cullFrustum = new THREE.Frustum();
  const cullMatrix = new THREE.Matrix4();
  const culledNow: THREE.Mesh[] = [];
  const shownNow: THREE.Mesh[] = [];
  let lastBoxCulled = 0;
  let lastLiteAll = false;
  const unionBox = (meshes: THREE.Mesh[]) => {
    const box = new THREE.Box3();
    for (const e of art.boxCull) if (meshes.includes(e.mesh)) box.union(e.box);
    return box;
  };
  const liteBox = art.heroLod ? unionBox(art.heroLod.lite) : null;
  const southBox = art.heroLod ? unionBox(art.heroLod.south) : null;
  const farBox = art.heroLod?.far.length ? unionBox(art.heroLod.far) : null;
  const distantBox = art.heroLod?.distant.length ? unionBox(art.heroLod.distant) : null;
  function boxCulled(): void {
    culledNow.length = 0;
    shownNow.length = 0;
    lastLiteAll = false;
    if (!art.boxCull.length) return;
    camera.updateMatrixWorld();
    cullFrustum.setFromProjectionMatrix(cullMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const lod = art.heroLod;
    // the lite (or far, VA-0330) hero set and the south copies both in view: their combined set instead
    const far = !!lod?.far[0]?.visible;
    const distant = !!lod?.distant[0]?.visible;
    const [set, all, setBox] = distant ? [lod!.distant, lod!.distantAll, distantBox] : far ? [lod!.far, lod!.farAll, farBox] : [lod?.lite ?? [], lod?.liteAll ?? [], liteBox];
    if (lod && setBox && southBox && all.length && set[0]?.visible && lod.south[0]?.visible && cullFrustum.intersectsBox(setBox) && cullFrustum.intersectsBox(southBox)) {
      lastLiteAll = true;
      for (const m of [...set, ...lod.south]) if (m.visible) {
        m.visible = false;
        culledNow.push(m);
      }
      for (const m of all) {
        m.visible = true;
        shownNow.push(m);
      }
      return;
    }
    for (const { mesh, box } of art.boxCull) {
      if (!mesh.visible || cullFrustum.intersectsBox(box)) continue;
      mesh.visible = false;
      culledNow.push(mesh);
    }
  }
  function boxRestore(): void {
    lastBoxCulled = lastLiteAll ? 0 : culledNow.length;
    for (const m of culledNow) m.visible = true;
    for (const m of shownNow) m.visible = false;
  }

  function frame(now: number): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dtMs = Math.min(100, now - last);
    last = now;
    const t0 = performance.now();
    const dt = dtMs / 1000;
    update(dt, now);
    capScene?.animate(now / 1000);
    renderer.info.reset();
    boxCulled();
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);
    boxRestore();
    const cost = performance.now() - t0;
    if (frames > 0) {
      intervals.push(dtMs);
      cpu.push(cost);
      if (intervals.length > 600) {
        intervals.shift();
        cpu.shift();
      }
    }
    frames++;
    if (now - perfShown > 500) {
      perfShown = now;
      const s = stats();
      perfEl.textContent = perfText(s);
    }
  }

  function update(dt: number, now: number): void {
    // ---- walking
    if (sitting) {
      const k = reduced ? 1 : Math.min(1, (now - sitting.t0) / SIT_MS);
      const s = sitting.seat;
      avatar.position.set(sitting.from.x + (s.x - sitting.from.x) * k, (SEAT_HEIGHT - 0.45) * k, sitting.from.z + (s.z - sitting.from.z) * k);
      st.heading = turnToward(sitting.fromHeading, s.facing, Math.PI * k + 0.001);
      if (k >= 1) {
        seated = s;
        sitting = null;
        toast('Seated · opening Blackjack…', 2000);
        // on the way back you stand behind the chair facing the table, so the follow camera sits
        // behind you (not between you and the table, where the chair back would fill the view)
        window.setTimeout(() => !disposed && opts.onSit(s, { ...snapshot(), pos: { ...s.approach }, heading: s.facing }), reduced ? 250 : 650);
      }
    } else if (!seated) {
      let moving = false;
      // the camera swings round behind the avatar on tap-walks and forward pushes
      let swing = false;
      if (joyVec.x || joyVec.y) {
        // camera-relative, measured from where the camera faced when the stick was pressed: the
        // camera swinging round during the walk must not turn the walk, or any push a little
        // off straight-up curls into a circle (only a drag of the view turns it, see onMove)
        const yaw = joyYaw ?? camYaw;
        const fx = Math.sin(yaw);
        const fz = -Math.cos(yaw);
        const mx = fx * -joyVec.y + -fz * joyVec.x;
        const mz = fz * -joyVec.y + fx * joyVec.x;
        const m = Math.hypot(mx, mz);
        if (m > 0.05) {
          const next = nav.slide(st.pos, mx * WALK_SPEED * dt, mz * WALK_SPEED * dt);
          st.pos = next;
          st.heading = turnToward(st.heading, Math.atan2(mx, -mz), reduced ? 99 : TURN_SPEED * dt);
          moving = true;
          swing = -joyVec.y > 0.7 * Math.abs(joyVec.x);
        }
      } else if (path.length) {
        const tgt = path[0];
        const dx = tgt.x - st.pos.x;
        const dz = tgt.z - st.pos.z;
        const dist = Math.hypot(dx, dz);
        const step = WALK_SPEED * dt;
        st.heading = turnToward(st.heading, Math.atan2(dx, -dz), reduced ? 99 : TURN_SPEED * dt);
        if (dist <= step) {
          st.pos = { ...tgt };
          path.shift();
        } else st.pos = { x: st.pos.x + (dx / dist) * step, z: st.pos.z + (dz / dist) * step };
        moving = true;
        swing = true;
        if (!path.length && pendingSeat) {
          sitting = { seat: pendingSeat, t0: now, from: { ...st.pos }, fromHeading: st.heading };
          pendingSeat = null;
        }
      }
      // the follow camera swings in behind a walking avatar
      if (moving && swing && st.mode === 'follow' && !dragYaw) camYaw = turnToward(camYaw, st.heading, reduced ? 99 : CAM_FOLLOW_TURN * dt);
      avatar.position.set(st.pos.x, 0, st.pos.z);
    }
    avatar.rotation.y = -st.heading;
    shadow.position.set(avatar.position.x, 0.015, avatar.position.z);
    if (tapFade > 0) {
      tapFade = Math.max(0, tapFade - dt * 0.8);
      (tapMarker.material as THREE.MeshBasicMaterial).opacity = tapFade;
    }
    for (const v of seatViews.values())
      if (v.marker) {
        v.marker.position.y = 2.1 + (reduced ? 0 : Math.sin(now / 300) * 0.08);
        // hidden once you're beside the seat, where it would fill the follow view
        const near = Math.hypot(v.marker.position.x - st.pos.x, v.marker.position.z - st.pos.z) < 1.6;
        v.marker.visible = !seated && !sitting && !near;
      }

    // ---- camera
    let obstacleDist = Infinity;
    if (st.mode === 'follow') {
      // walking up to a slot: ease into framing its screen beside the avatar
      const want = seated || sitting ? null : machineFocus(st.pos, camYaw, layout.slots);
      const ke = reduced ? 1 : 1 - Math.exp(-dt * 3);
      if (want) {
        const from = focus ?? { ...want, weight: 0 };
        focus = {
          id: want.id,
          weight: from.weight + (want.weight - from.weight) * ke,
          point: { x: from.point.x + (want.point.x - from.point.x) * ke, y: want.point.y, z: from.point.z + (want.point.z - from.point.z) * ke },
        };
      } else if (focus) {
        focus = { ...focus, weight: focus.weight * (1 - ke) };
        if (focus.weight < 0.01) focus = null;
      }
    } else focus = null;
    const focusOpt = focus ?? undefined;
    if (st.mode === 'follow') {
      // a chair back between the avatar and the camera: tilt up until the camera sees over it
      let needTilt = 0;
      for (const tilt of LOOK_OVER_TILTS) {
        const p = desiredPose('follow', st.pos, camYaw, st.dist.follow, { aspect: camera.aspect, extraPitch: tilt, lookUp, focus: focusOpt }).pos;
        tmpA.set(st.pos.x, AVATAR_HEIGHT * 0.75, st.pos.z);
        tmpB.set(p.x, p.y, p.z).sub(tmpA);
        camRay.set(tmpA, tmpB.clone().normalize());
        camRay.far = tmpB.length();
        needTilt = tilt;
        if (!camRay.intersectObjects(lowBlockers, false).length) break;
      }
      lookOver += (needTilt - lookOver) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
      const want = desiredPose('follow', st.pos, camYaw, st.dist.follow, { aspect: camera.aspect, extraPitch: lookOver, lookUp, focus: focusOpt });
      tmpA.set(want.target.x, want.target.y, want.target.z);
      tmpB.set(want.pos.x, want.pos.y, want.pos.z).sub(tmpA);
      const len = tmpB.length();
      camRay.set(tmpA, tmpB.normalize());
      camRay.far = len;
      const hit = camRay.intersectObjects(camBlockers, false)[0];
      if (hit) obstacleDist = hit.distance;
    }
    // a walk eases a dragged overview back onto the avatar
    if (path.length && !dragPan && (pan.x || pan.z)) {
      const k = Math.exp(-dt * 1.5);
      pan = { x: pan.x * k, z: pan.z * k };
    }
    let pose = desiredPose(st.mode, st.pos, camYaw, st.dist[st.mode], { obstacleDist, aspect: camera.aspect, pan, extraPitch: st.mode === 'follow' ? lookOver : 0, lookUp, focus: focusOpt });
    if (transition) {
      const t = (now - transition.t0) / TRANSITION_MS;
      if (t >= 1) transition = null;
      else pose = blendPose(transition.from, pose, t);
    }
    if (pinned) pose = { ...pose, pos: { ...pinned.pos }, target: { ...pinned.target }, fov: pinned.fov ?? pose.fov };
    lastPose = pose;
    // a camera pulled in close (by a wall or a machine) fades the avatar so it can't fill the view
    const alpha = st.mode === 'follow' ? avatarOpacity(Math.hypot(pose.pos.x - avatar.position.x, pose.pos.y - (avatar.position.y + AVATAR_HEIGHT / 2), pose.pos.z - avatar.position.z)) : 1;
    if (Math.abs(alpha - avatarAlpha) > 0.01) {
      avatarAlpha = alpha;
      for (const m of avatarMats) setFade(m, alpha);
    }
    // the framed machine's own chair fades with the framing, so it can't cover the screen (VA-0045)
    for (const [id, meshes] of art.fadeable) {
      const a = focus && focus.id === id ? propOpacity(focus.weight) : 1;
      const prev = propAlpha.get(id) ?? 1;
      if (a === prev) continue;
      propAlpha.set(id, a);
      for (const m of meshes) setFade(m.material as THREE.Material, a);
    }
    camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    art.svelteLod?.update(camera.position);
    if (art.heroLod) {
      const level = heroLodLevel(heroLevel, camera.position.x, camera.position.z, art.heroLod.centres, heroHasFar, art.heroLod.copyCentres);
      if (level !== heroLevel) {
        heroLevel = level;
        for (const m of art.heroLod.full) m.visible = level === 'full';
        for (const m of art.heroLod.lite) m.visible = level === 'lite';
        for (const m of art.heroLod.far) m.visible = level === 'far';
        for (const m of art.heroLod.distant) m.visible = level === 'distant';
      }
    }
    capScene?.update(camera.position);
    if (Math.abs(camera.fov - pose.fov) > 0.01) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    // a sign right next to the camera would fill the screen: hide it up close
    for (const l of labels) l.visible = camera.position.distanceTo(l.position) > 3;
    const cut = cutawayWalls(pose.pos);
    for (const [side, meshes] of Object.entries(walls)) for (const m of meshes) m.visible = !cut.has(side as keyof typeof walls);
    // from above (the overview) the roof is cut away or see-through, per the Roof setting; the
    // chandeliers stay unless the roof is off, and the entrance front never blocks the view
    const above = pose.pos.y >= 4;
    for (const m of art.ceiling.entrance) m.visible = !above;
    for (const m of art.exterior) m.visible = above;
    for (const m of art.ceiling.fixtures) m.visible = !above || roofMode !== 'off';
    art.ceiling.roof.forEach((m, i) => {
      m.visible = !above || roofMode === 'glass';
      m.material = above ? roofGlass[i] : roofSolid[i];
    });
    // nothing cut away (the eye-level views): draw the walls' and ceiling's shared materials
    // once each, in the room's own batches, not once per side (VA-0052)
    const whole = !above && !cut.has('north') && !cut.has('east') && !cut.has('west');
    for (const m of art.whole.combined) m.visible = whole;
    for (const m of art.whole.replaced) if (whole || !sidedBatches.has(m)) m.visible = !whole;
  }

  const pct = (xs: number[], p: number) => {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * p))];
  };
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  function stats(): FloorStats {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const ia = avg(intervals);
    return {
      frames,
      fps: ia ? 1000 / ia : 0,
      intervalAvgMs: ia,
      intervalP95Ms: pct(intervals, 0.95),
      intervalMaxMs: intervals.length ? Math.max(...intervals) : 0,
      cpuAvgMs: avg(cpu),
      cpuP95Ms: pct(cpu, 0.95),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      pixelRatio,
      canvas: [canvas.width, canvas.height],
      heapMB: mem ? Math.round(mem.usedJSHeapSize / 1e5) / 10 : null,
      artMeshes: art.meshesAuthored,
      artBatches: art.batches,
      artInteractive: art.interactive.size,
      reelTextures,
      reelsSettled,
      reelSheet: reelSheet ? { machines: reelSheet.tiles.size, size: [reelSheet.layout.width, reelSheet.layout.height], meshes: reelSources.reduce((n, r) => n + r.meshes.length, 0), triangles: (reelSheet.mesh.geometry.getAttribute('position').count / 3) | 0 } : null,
      heroTextures: [art.heroTextures.length, heroMaps.size],
      heroSignLift: art.heroSignLift,
      pilot05,
      hall,
      blackjackHero: art.blackjackHero,
      wovenCarpet: art.wovenCarpet,
      svelteMachines: {
        cabinets: art.svelteCabinets, caps: svelteBanks?.caps.length ?? 0, capsDropped: svelteBanks?.capsDropped ?? 0,
        stools: svelteBanks?.slots.reduce((n, b) => n + b.stools.length, 0) ?? 0, stoolsDropped: svelteBanks?.stoolsDropped ?? 0,
        lod: art.svelteLod ? { near: art.svelteLod.near.size, mid: art.svelteLod.mid.size, triangles: art.svelteLod.triangles(), drawCalls: art.svelteLod.drawCalls } : null,
        capBulbsFar: capScene?.farCaps() ?? 0,
      },
      guestAvatar,
      lightMode,
      heroLod: art.heroLod ? heroLevel : null,
      boxCull: { culled: lastBoxCulled, of: art.boxCull.length, liteAll: lastLiteAll },
      reelCells: [...art.interactive.entries()].filter(([k]) => k.endsWith('/reels')).reduce((n, [, m]) => n + m.geometry.groups.length, 0),
    };
  }

  raf = requestAnimationFrame(frame);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    useRoom(SALON_ROOM);
    setOverviewSides(null);
    cancelAnimationFrame(raf);
    clearTimeout(toastTimer);
    window.removeEventListener('resize', onResize);
    envMap.dispose();
    composer?.dispose();
    bloomPass?.dispose();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        (mat as THREE.SpriteMaterial).map?.dispose();
        mat.dispose();
      }
    });
    for (const mat of [...roofSolid, ...roofGlass]) mat.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    hud.remove();
  }

  const screenOf = (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z).project(camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  };

  return {
    dispose,
    stats,
    debug: {
      state: () => ({ ...snapshot(), walking: path.length > 0, sitting: !!sitting, seat: seated?.id ?? pendingSeat?.id ?? null, transitioning: !!transition, camYaw, lookUp, roof: roofMode, cam: lastPose, focus: focus ? { id: focus.id, weight: focus.weight } : null, propAlpha: Object.fromEntries(propAlpha) }),
      screenOf,
      /** Meshes the camera can see this frame, by name: about one draw call each (a two-sided transparent one draws twice), for trimming the budget. */
      drawList: () => {
        const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const out: { name: string; tris: number; glow: boolean; instances: number }[] = [];
        scene.traverseVisible((o) => {
          const m = o as THREE.Mesh;
          if (!(m.isMesh || (o as THREE.Sprite).isSprite) || (m.material as THREE.Material).visible === false || (m.frustumCulled && !frustum.intersectsObject(m))) return;
          const g = m.geometry;
          const tris = g ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0;
          out.push({ name: m.name || (m.parent?.name ? `${m.parent.name}>` : '') + `${m.type}:${(m.material as THREE.Material)?.type ?? ''}:${o.position.x.toFixed(1)},${o.position.y.toFixed(1)},${o.position.z.toFixed(1)}`, tris: Math.round(tris), glow: m.userData.glow === true, instances: (m as THREE.InstancedMesh).isInstancedMesh ? (m as THREE.InstancedMesh).count : 1 });
        });
        return out;
      },
      seatScreen: (id: string) => {
        const s = SEATS.find((q) => q.id === id)!;
        return screenOf(s.x, 0.4, s.z);
      },
      tap,
      pick: (sx: number, sy: number) => {
        const r = renderer.domElement.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1), camera);
        const vis = (o: THREE.Object3D | null): boolean => !o || (o.visible && vis(o.parent));
        return ray
          .intersectObject(scene, true)
          .filter((h) => vis(h.object) && ((h.object as THREE.Mesh).material as THREE.Material)?.visible !== false)
          .slice(0, 6)
          .map((h) => ({ name: h.object.name || h.object.type, dist: +h.distance.toFixed(2), material: `${((h.object as THREE.Mesh).material as THREE.Material)?.name ?? ''}#${(((h.object as THREE.Mesh).material as THREE.MeshStandardMaterial)?.color?.getHexString?.() ?? '')}` }));
      },
      toggleCamera: () => setMode(st.mode === 'follow' ? 'overview' : 'follow'),
      look: (up: number) => {
        lookUp = Math.min(LOOK_UP_MAX, Math.max(0, up));
      },
      place: (x: number, z: number, heading: number) => {
        path = [];
        cancelSeat();
        st.pos = { x, z };
        st.heading = heading;
        camYaw = heading;
      },
      pinCamera: (pin) => {
        pinned = pin ? { pos: { ...pin.pos }, target: { ...pin.target }, fov: pin.fov } : null;
        transition = null;
      },
      objectPose: (name: string) => {
        const o = scene.getObjectByName(name);
        // batching merges the grand hall's chairs away; their poses were recorded before that
        if (!o) return art.chairPoses.get(name) ?? null;
        o.updateWorldMatrix(true, false);
        const p = new THREE.Vector3();
        const q = new THREE.Quaternion();
        o.matrixWorld.decompose(p, q, new THREE.Vector3());
        const yaw = new THREE.Euler().setFromQuaternion(q, 'YXZ').y;
        return { x: p.x, y: p.y, z: p.z, yaw };
      },
    },
  };
}

export const DEFAULT_DIST: Record<CamMode, number> = { follow: LIMITS.follow.initial, overview: LIMITS.overview.initial };
