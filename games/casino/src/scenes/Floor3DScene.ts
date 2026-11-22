import Phaser from 'phaser';
import type { CamMode } from '../floor3d/camera.ts';
import { LIMITS } from '../floor3d/camera.ts';
import { readHall, SPAWN } from '../floor3d/layout.ts';
import { GRAND_SPAWN } from '../floor3d/grandHall.ts';
import { ROTATE_ORDER, applyFloorRotation, backToPortrait, type RotatePref } from '../floor3d/orientation.ts';
import type { FloorHandle, FloorState } from '../floor3d/world.ts';
import { VW, text } from '../ui/common.ts';

const PREFS_KEY = 'va3d.prefs';
const STATE_KEY = 'floor3d.state';

interface Prefs {
  mode: CamMode;
  reducedMotion: boolean;
  rotate: RotatePref;
}

function loadPrefs(): Prefs {
  let p: Partial<Prefs> = {};
  try {
    p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
  } catch {
    /* private mode or bad data: defaults */
  }
  const osReduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    mode: p.mode === 'overview' ? 'overview' : 'follow',
    reducedMotion: p.reducedMotion ?? osReduced,
    rotate: ROTATE_ORDER.includes(p.rotate as RotatePref) ? (p.rotate as RotatePref) : 'auto',
  };
}

function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* not critical */
  }
}

/**
 * Hosts the 3D casino floor prototype (VA-0016). The floor itself is a Three.js canvas
 * (floor3d/world.ts) laid over the game; this scene loads it, sleeps Phaser's loop while it
 * runs, and hands over to the existing Phaser blackjack scene when the player sits down.
 * The avatar's position and the camera are kept in the registry so coming back from the
 * table puts the player where they stood.
 */
export class Floor3DScene extends Phaser.Scene {
  private world: FloorHandle | null = null;
  private leaving = false;

  constructor() {
    super('floor3d');
  }

  create(): void {
    this.leaving = false;
    this.cameras.main.setBackgroundColor('#17111c');
    const loading = text(this, VW / 2, 960, 'Opening the 3D floor…', 40, '700', '#cbb6d6');
    const prefs = loadPrefs();
    const saved = this.registry.get(STATE_KEY) as FloorState | undefined;
    // the grand hall preview (VA-0064) starts at its own entrance
    const spawn = readHall() === 'grand' ? GRAND_SPAWN : SPAWN;
    const state: FloorState = saved ?? {
      pos: { x: spawn.x, z: spawn.z },
      heading: spawn.heading,
      mode: prefs.mode,
      dist: { follow: LIMITS.follow.initial, overview: LIMITS.overview.initial },
    };
    state.mode = prefs.mode;
    // Android back: leave for the lobby, remembering where the avatar stood
    const onBack = () => {
      const s = this.world?.debug.state();
      // mid sit-down the table is about to open; ignore Back for that moment
      if (s?.sitting) return;
      if (s) this.registry.set(STATE_KEY, { pos: s.pos, heading: s.heading, mode: s.mode, dist: s.dist });
      this.leave('lobby');
    };
    this.events.on('back', onBack);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('back', onBack);
      this.teardown();
    });
    void import('../floor3d/world.ts').then(async ({ mountFloor, preloadFloorAssets }) => {
      await preloadFloorAssets();
      if (this.leaving || !this.sys.isActive()) return;
      loading.destroy();
      this.world = mountFloor({
        state,
        reducedMotion: prefs.reducedMotion,
        rotate: prefs.rotate,
        onRotate: (rotate) => {
          prefs.rotate = rotate;
          savePrefs(prefs);
          void applyFloorRotation(rotate);
        },
        onSit: (_seat, s) => {
          this.registry.set(STATE_KEY, s);
          this.leave('blackjack', { from: 'floor3d' });
        },
        onBack: (s) => {
          this.registry.set(STATE_KEY, s);
          this.leave('lobby');
        },
        onPrefs: (mode, reducedMotion) => {
          prefs.mode = mode;
          prefs.reducedMotion = reducedMotion;
          savePrefs(prefs);
        },
      });
      Object.assign(globalThis, { __floor3d: this.world });
      // the 3D canvas covers the game: stop drawing Phaser underneath it
      this.game.loop.sleep();
      // the floor may turn sideways; every Phaser scene is portrait
      void applyFloorRotation(prefs.rotate);
    });
  }

  private leave(key: string, data?: object): void {
    if (this.leaving) return;
    this.leaving = true;
    // turn the phone back to portrait before the Phaser scene lays itself out
    void backToPortrait().then(() => {
      this.teardown();
      this.scene.start(key, data);
    });
  }

  private teardown(): void {
    this.world?.dispose();
    this.world = null;
    Object.assign(globalThis, { __floor3d: null });
    if (!this.game.loop.running) this.game.loop.wake();
  }
}
