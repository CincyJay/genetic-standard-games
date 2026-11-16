/**
 * The grand hall preview (VA-0064): composes ChatGPT's art into the larger floor that
 * layout.ts describes, for artScene.ts to batch like the salon. Engineering only: art modules
 * are used as authored and only placed, turned and copied here.
 *
 * - ChatGPT's grand concourse (VA-0062, `1ad332e`) down the middle.
 * - Blackjack hero tables (VA-0054) in two banks, each with two of the pilot swivel chairs.
 * - One hero cabinet per theme along the back wall: these are the interactive `slot_<id>`
 *   machines (reels, spin button, marquee). The side-wall banks are copies of them that share
 *   their geometry, materials and canvas textures, so they batch with them.
 * - ChatGPT's woven carpet over the whole floor (a plain floor in tests, where there is no canvas).
 *
 * The walls and the ceiling outside the concourse are PLACEHOLDERS: plain dark boxes, named like
 * the salon's walls and roof so the overview's cutaway works. The art has no shell at this size
 * yet; it was asked for on the board (VA-0063).
 */
import * as THREE from 'three';
import { createGrandConcourse } from '../../../../art/src/grandConcourse.mjs';
import { makeVelvetHeroCabinet } from '../../../../art/casino/3d/heroSlotCabinet.mjs';
import { makeVelvetLuxuryGamingChair } from '../../../../art/casino/3d/luxuryGamingChair.mjs';
import { makeVelvetBlackjackHero } from '../../../../art/casino/3d/blackjackHero.mjs';
import { makeVelvetPatternCarpet } from '../../../../art/casino/3d/patternCarpet.mjs';
import { BLACKJACK_HERO_ANCHORS, type FloorLayout, type TablePlacement } from './layout.ts';

export interface GrandHallArt {
  root: THREE.Group;
  heroes: THREE.Object3D[];
  heroTextures: THREE.Texture[];
  wovenCarpet: boolean;
}

/** The swivel chair's front is its local +Z; turn it to face from (x, z) toward (tx, tz). */
function chairAt(name: string, x: number, z: number, tx: number, tz: number): THREE.Group {
  const chair = makeVelvetLuxuryGamingChair(THREE) as THREE.Group;
  chair.name = name;
  chair.position.set(x, 0, z);
  chair.rotation.y = Math.atan2(tx - x, tz - z);
  return chair;
}

function tableWithChairs(t: TablePlacement, chairNames: [string, string]): THREE.Group {
  const g = new THREE.Group();
  const table = makeVelvetBlackjackHero(THREE) as THREE.Group;
  table.position.set(t.x, 0, t.z);
  g.add(table);
  Object.values(BLACKJACK_HERO_ANCHORS.seats).forEach((a, i) => g.add(chairAt(chairNames[i], t.x + a.position[0], t.z + a.position[1], t.x, t.z)));
  return g;
}

export function composeGrandHall(
  layout: FloorLayout,
  opts: { liftSign: (hero: THREE.Object3D) => number; carpetCanvas?: unknown },
): GrandHallArt {
  const root = new THREE.Group();
  root.name = 'VelvetAce_GrandHallPreview';
  const { room } = layout;
  const w = room.x1 - room.x0;
  const d = room.z1 - room.z0;
  const cx = (room.x0 + room.x1) / 2;
  const cz = (room.z0 + room.z1) / 2;

  // floor: ChatGPT's woven carpet, sized to the hall
  let wovenCarpet = false;
  if (opts.carpetCanvas || typeof document !== 'undefined') {
    root.add(makeVelvetPatternCarpet(THREE, { width: w, depth: d, x: cx, y: 0.024, z: cz, canvas: opts.carpetCanvas }) as THREE.Mesh);
    wovenCarpet = true;
  } else {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2b1b2c, roughness: 0.9 }));
    floor.name = 'grand_floor_placeholder';
    floor.position.set(cx, 0.024, cz);
    root.add(floor);
  }

  // PLACEHOLDER shell (no art at this size yet): walls named like the salon's, so the cutaway sorts them
  const shell = new THREE.MeshStandardMaterial({ color: 0x1e1622, roughness: 0.85 });
  const box = (name: string, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), shell);
    m.name = name;
    m.position.set(x, y, z);
    root.add(m);
  };
  const h = room.wallHeight;
  box('rear_wall', w + 0.8, h, 0.36, cx, h / 2, room.z0 - 0.18);
  box('wall', 0.38, h, d + 0.4, room.x0 - 0.19, h / 2, cz);
  box('wall', 0.38, h, d + 0.4, room.x1 + 0.19, h / 2, cz);
  box('chandelier_ceiling', w + 0.8, 0.2, d + 0.4, cx, h - 0.1, cz);

  // ChatGPT's concourse down the middle
  const c = layout.concourse;
  if (c) {
    const concourse = createGrandConcourse({ length: c.length, width: c.width, ceilingHeight: c.ceilingHeight }) as THREE.Group;
    concourse.position.z = c.z;
    root.add(concourse);
  }

  // tables: the interactive one's chairs are the seats' (named like the salon's), the rest decor
  root.add(tableWithChairs(layout.table, ['blackjack_1_chair', 'blackjack_2_chair']));
  layout.decor.tables.forEach((t, i) => root.add(tableWithChairs(t, [`deco_${i + 1}a_chair`, `deco_${i + 1}b_chair`])));

  // machines: one hero per theme, interactive, then copies along the side walls
  const heroes: THREE.Object3D[] = [];
  const heroTextures: THREE.Texture[] = [];
  const byTheme = new Map<string, THREE.Group>();
  for (const s of layout.slots) {
    const slot = new THREE.Group();
    slot.name = `slot_${s.id}`;
    slot.position.set(s.x, 0, s.z);
    slot.rotation.y = s.rotationY;
    const hero = makeVelvetHeroCabinet(THREE, s.id) as THREE.Group;
    opts.liftSign(hero);
    heroTextures.push(...[hero.userData.createdTitleTexture, hero.userData.createdBonusTexture].filter((t): t is THREE.Texture => !!t?.isTexture));
    slot.add(hero);
    root.add(slot);
    heroes.push(hero);
    byTheme.set(s.id, hero);
  }
  layout.decor.slots.forEach((s, i) => {
    const src = byTheme.get(s.id);
    if (!src) return;
    // a clone shares the source's geometry, materials and textures, so it batches with it; not
    // named slot_*, so it isn't interactive (artScene gathers its reels per theme to show symbols)
    const copy = new THREE.Group();
    copy.name = `slotcopy_${s.id}_${i + 1}`;
    copy.position.set(s.x, 0, s.z);
    copy.rotation.y = s.rotationY;
    copy.add(src.clone());
    root.add(copy);
  });
  return { root, heroes, heroTextures, wovenCarpet };
}
