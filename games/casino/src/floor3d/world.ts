/**
 * The 3D casino floor (stage 1, VA-0016): a Three.js canvas over the Phaser canvas with a
 * graybox room, a placeholder avatar, tap-to-walk, an optional joystick, the two cameras and
 * seat selection. Everything visible here is a TEMPORARY placeholder for ChatGPT's real GLB
 * art (see docs/design/3d-casino-art-contract.md); the mechanics are what this stage proves.
 *
 * Loaded with a dynamic import, so Three.js is its own chunk and costs nothing until the
 * floor opens. `dispose()` frees every GPU resource and the WebGL context before a Phaser
 * game takes over.
 */
import * as THREE from 'three';
import { LIMITS, OVERVIEW_AXES, TRANSITION_MS, blendPose, clampZoom, cutawayWalls, desiredPose, turnToward, type CamMode, type CamPose } from './camera.ts';
import { AVATAR_HEIGHT, DEALER_SPOT, OBSTACLES, ROOM, SEATS, SEAT_HEIGHT, TABLE, type Seat, type Vec2 } from './layout.ts';
import { NavGrid } from './nav.ts';
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
}

export interface FloorHandle {
  dispose: () => void;
  stats: () => FloorStats;
  /** Test hooks: state, and screen points of things to tap. */
  debug: {
    state: () => FloorState & { walking: boolean; sitting: boolean; seat: string | null; transitioning: boolean; camYaw: number; cam: CamPose };
    screenOf: (x: number, y: number, z: number) => { x: number; y: number };
    seatScreen: (id: string) => { x: number; y: number };
    tap: (sx: number, sy: number) => void;
    toggleCamera: () => void;
  };
}

const WALK_SPEED = 2.6; // m/s
const TURN_SPEED = 10; // rad/s
const CAM_FOLLOW_TURN = 2.2; // rad/s: how fast the follow camera swings behind a walking avatar
const SIT_MS = 450;

const C = {
  bg: 0x17111c,
  floor: 0x7d7a82,
  wall: 0xa9a5ae,
  prop: 0x938f98,
  dark: 0x5f5b64,
  avatar: 0xe3ded6,
  npc: 0x8796a8,
  free: 0x37c76a,
  taken: 0xdf4b4b,
  mine: 0xf1c550,
};

export function mountFloor(opts: FloorOptions): FloorHandle {
  const st: FloorState = { pos: { ...opts.state.pos }, heading: opts.state.heading, mode: opts.state.mode, dist: { ...opts.state.dist } };
  let reduced = opts.reducedMotion;
  const nav = new NavGrid();
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
  scene.add(new THREE.HemisphereLight(0xfff3e6, 0x2c2232, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.3);
  sun.position.set(4, 9, 6);
  scene.add(sun);

  const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });
  const pickables: THREE.Object3D[] = [];
  /** Meshes the follow camera must not pass through. */
  const camBlockers: THREE.Object3D[] = [];

  // ------------------------------------------------------------------ room
  const w = ROOM.x1 - ROOM.x0;
  const d = ROOM.z1 - ROOM.z0;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lambert(C.floor));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((ROOM.x0 + ROOM.x1) / 2, 0, (ROOM.z0 + ROOM.z1) / 2);
  floor.userData.floor = true;
  scene.add(floor);
  pickables.push(floor);
  // a 1 m grid so the scale reads in a graybox
  const grid = new THREE.GridHelper(Math.max(w, d), Math.max(w, d), 0x9b98a1, 0x8b8891);
  grid.position.set(floor.position.x, 0.005, floor.position.z);
  scene.add(grid);

  const walls: Record<'north' | 'south' | 'east' | 'west', THREE.Mesh> = {
    north: wallMesh(w, ROOM.x0 + w / 2, ROOM.z0, 0),
    south: wallMesh(w, ROOM.x0 + w / 2, ROOM.z1, 0),
    west: wallMesh(d, ROOM.x0, ROOM.z0 + d / 2, Math.PI / 2),
    east: wallMesh(d, ROOM.x1, ROOM.z0 + d / 2, Math.PI / 2),
  };
  function wallMesh(len: number, x: number, z: number, rot: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, ROOM.wallHeight, 0.2), lambert(C.wall));
    m.position.set(x, ROOM.wallHeight / 2, z);
    m.rotation.y = rot;
    m.userData.obstacle = true;
    scene.add(m);
    pickables.push(m);
    camBlockers.push(m);
    return m;
  }

  // ------------------------------------------------------------------ props
  for (const o of OBSTACLES) {
    if (o.id === 'table' || o.id === 'dealer-area' || o.id.endsWith('-stool')) continue;
    const mesh =
      o.kind === 'circle'
        ? new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, o.h, 20), lambert(C.prop))
        : new THREE.Mesh(new THREE.BoxGeometry(o.x1 - o.x0, o.h, o.z1 - o.z0), lambert(o.id.startsWith('slot') ? C.dark : C.prop));
    if (o.kind === 'circle') mesh.position.set(o.x, o.h / 2, o.z);
    else mesh.position.set((o.x0 + o.x1) / 2, o.h / 2, (o.z0 + o.z1) / 2);
    mesh.userData.obstacle = o.id;
    scene.add(mesh);
    pickables.push(mesh);
    camBlockers.push(mesh);
  }
  // the blackjack table: a half disc whose curved rail faces the players (+Z)
  const table = new THREE.Mesh(new THREE.CylinderGeometry(TABLE.radius, TABLE.radius, TABLE.height, 32, 1, false, -Math.PI / 2, Math.PI), lambert(C.prop));
  table.position.set(TABLE.x, TABLE.height / 2, TABLE.z);
  table.userData.table = true;
  scene.add(table);
  pickables.push(table);
  camBlockers.push(table);
  // the dealer's area and a placeholder dealer
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.5), lambert(C.dark));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(TABLE.x, 0.01, TABLE.z - 0.75);
  scene.add(rug);
  scene.add(capsule(C.npc, DEALER_SPOT.x, DEALER_SPOT.z, 0, 0));
  const labels = [label('BLACKJACK', TABLE.x, 2.3, TABLE.z - 0.3, 1.6)];
  scene.add(...labels);

  // seats: stool, a state ring on the floor, and a bobbing marker over free seats
  const seatViews = new Map<string, { ring: THREE.Mesh; marker: THREE.Mesh | null; stool: THREE.Mesh }>();
  for (const s of SEATS) {
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, SEAT_HEIGHT, 16), lambert(C.dark));
    stool.position.set(s.x, SEAT_HEIGHT / 2, s.z);
    stool.userData.seat = s.id;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.54, 40), new THREE.MeshBasicMaterial({ color: s.taken ? C.taken : C.free, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(s.x, 0.02, s.z);
    ring.userData.seat = s.id;
    // a generous invisible tap target around the seat (bigger than the stool)
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(s.x, 0.8, s.z);
    hit.userData.seat = s.id;
    let marker: THREE.Mesh | null = null;
    if (!s.taken) {
      marker = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.36, 4), new THREE.MeshBasicMaterial({ color: C.free }));
      marker.rotation.x = Math.PI;
      marker.position.set(s.x, 2.1, s.z);
      scene.add(marker);
    } else {
      // stage 1 has no multiplayer: a computer player shows what "taken" looks like
      scene.add(capsule(C.npc, s.x, s.z, s.facing, SEAT_HEIGHT - 0.45));
    }
    scene.add(stool, ring, hit);
    pickables.push(hit, stool, ring);
    seatViews.set(s.id, { ring, marker, stool });
  }

  // ------------------------------------------------------------------ avatar
  const avatar = capsule(C.avatar, st.pos.x, st.pos.z, st.heading, 0);
  scene.add(avatar);
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
#va3d-hud .head{position:absolute;top:calc(env(safe-area-inset-top) + 10px);left:calc(env(safe-area-inset-left) + 10px);right:calc(env(safe-area-inset-right) + 10px);display:flex;flex-direction:column;gap:8px}
#va3d-hud .top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
#va3d-hud .top .back{margin-right:auto}
#va3d-hud .badge{text-align:center;font:700 12px Outfit,sans-serif;
  letter-spacing:1px;color:#e9c86a;text-shadow:0 1px 3px #000}
#va3d-hud .toast{position:absolute;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom) + min(190px, 26vh));text-align:center;font:700 17px Outfit,sans-serif;
  opacity:0;transition:opacity .25s;text-shadow:0 1px 4px #000}
#va3d-hud .joy{pointer-events:auto;position:absolute;left:calc(env(safe-area-inset-left) + 24px);bottom:calc(env(safe-area-inset-bottom) + 28px);width:132px;height:132px;border-radius:50%;
  background:rgba(20,12,26,.45);border:2px solid rgba(233,200,106,.7);touch-action:none}
#va3d-hud .knob{position:absolute;left:41px;top:41px;width:50px;height:50px;border-radius:50%;background:rgba(233,200,106,.85)}
#va3d-hud .perf{position:absolute;right:calc(env(safe-area-inset-right) + 10px);bottom:calc(env(safe-area-inset-bottom) + 8px);font:600 11px ui-monospace,monospace;color:#cbb6d6;text-shadow:0 1px 2px #000}
</style>
<div class="head">
  <div class="top">
    <button type="button" class="back" aria-label="Back to the lobby">‹ Lobby</button>
    <button type="button" class="cam"></button>
    <button type="button" class="rotate"></button>
    <button type="button" class="motion" aria-pressed="false"></button>
  </div>
  <div class="badge">PROTOTYPE · GRAYBOX PLACEHOLDERS</div>
</div>
<div class="toast" role="status" aria-live="polite"></div>
<div class="joy" aria-label="Walk joystick"><div class="knob"></div></div>
<div class="perf"></div>`;
  document.body.appendChild(hud);
  const $ = <T extends HTMLElement>(s: string) => hud.querySelector(s) as T;
  const camBtn = $<HTMLButtonElement>('.cam');
  const motionBtn = $<HTMLButtonElement>('.motion');
  const rotateBtn = $<HTMLButtonElement>('.rotate');
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
    rotateBtn.textContent = `⟳ ${rotate === 'auto' ? 'Auto' : rotate === 'landscape' ? 'Landscape' : 'Portrait'}`;
    rotateBtn.setAttribute('aria-label', `Screen rotation: ${rotate}. Tap to change.`);
    motionBtn.setAttribute('aria-pressed', String(reduced));
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
  let lastPose: CamPose = desiredPose(st.mode, st.pos, camYaw, st.dist[st.mode], { aspect: window.innerWidth / window.innerHeight });
  /** Overview drag offset from the avatar (metres on the floor). */
  let pan = { x: 0, z: 0 };
  let joyVec = { x: 0, y: 0 };
  let tapFade = 0;
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
  let dragYaw: { x: number; yaw: number } | null = null;
  let dragPan: { x: number; y: number; pan: Vec2 } | null = null;
  const pinchDist = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    if (pointers.size === 2) {
      pinch = { d0: pinchDist(), dist0: st.dist[st.mode] };
      dragYaw = null;
      dragPan = null;
    } else if (st.mode === 'follow') dragYaw = { x: e.clientX, yaw: camYaw };
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
    } else if (dragYaw && Math.abs(e.clientX - p.x0) > 12) {
      // one-finger horizontal drag swings the follow camera around the avatar
      camYaw = dragYaw.yaw + ((e.clientX - dragYaw.x) / window.innerWidth) * Math.PI * 1.5;
    }
  };
  const onUp = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!p) return;
    const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
    if (pointers.size === 0 && moved < 12 && performance.now() - p.t0 < 600 && !pinch) tap(e.clientX, e.clientY);
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
    joyVec = { x: 0, y: 0 };
    knob.style.transform = '';
  };
  joy.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    joyId = e.pointerId;
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

  function frame(now: number): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dtMs = Math.min(100, now - last);
    last = now;
    const t0 = performance.now();
    const dt = dtMs / 1000;
    update(dt, now);
    renderer.render(scene, camera);
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
      perfEl.textContent = `${s.fps.toFixed(0)} fps · p95 ${s.intervalP95Ms.toFixed(1)} ms · cpu ${s.cpuAvgMs.toFixed(1)} ms · ${s.drawCalls} calls`;
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
        window.setTimeout(() => !disposed && opts.onSit(s, { ...snapshot(), pos: { ...s.approach }, heading: s.facing + Math.PI }), reduced ? 250 : 650);
      }
    } else if (!seated) {
      let moving = false;
      // the camera swings round behind the avatar on tap-walks and forward pushes only: on a
      // sideways or backward push it holds still, or the walk would curl into a circle
      let swing = false;
      if (joyVec.x || joyVec.y) {
        // camera-relative: up on the stick walks away from the camera
        const fx = Math.sin(camYaw);
        const fz = -Math.cos(camYaw);
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
      const want = desiredPose('follow', st.pos, camYaw, st.dist.follow, { aspect: camera.aspect });
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
    let pose = desiredPose(st.mode, st.pos, camYaw, st.dist[st.mode], { obstacleDist, aspect: camera.aspect, pan });
    if (transition) {
      const t = (now - transition.t0) / TRANSITION_MS;
      if (t >= 1) transition = null;
      else pose = blendPose(transition.from, pose, t);
    }
    lastPose = pose;
    camera.position.set(pose.pos.x, pose.pos.y, pose.pos.z);
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
    if (Math.abs(camera.fov - pose.fov) > 0.01) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    // a sign right next to the camera would fill the screen: hide it up close
    for (const l of labels) l.visible = camera.position.distanceTo(l.position) > 3;
    const cut = cutawayWalls(pose.pos);
    for (const [name, m] of Object.entries(walls)) m.visible = !cut.has(name as keyof typeof walls);
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
    };
  }

  raf = requestAnimationFrame(frame);

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    clearTimeout(toastTimer);
    window.removeEventListener('resize', onResize);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        (mat as THREE.SpriteMaterial).map?.dispose();
        mat.dispose();
      }
    });
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
      state: () => ({ ...snapshot(), walking: path.length > 0, sitting: !!sitting, seat: seated?.id ?? pendingSeat?.id ?? null, transitioning: !!transition, camYaw, cam: lastPose }),
      screenOf,
      seatScreen: (id: string) => {
        const s = SEATS.find((q) => q.id === id)!;
        return screenOf(s.x, 0.4, s.z);
      },
      tap,
      toggleCamera: () => setMode(st.mode === 'follow' ? 'overview' : 'follow'),
    },
  };
}

export const DEFAULT_DIST: Record<CamMode, number> = { follow: LIMITS.follow.initial, overview: LIMITS.overview.initial };
