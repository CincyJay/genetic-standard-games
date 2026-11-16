/**
 * The grand hall preview (VA-0064): composes ChatGPT's art into the larger floor that
 * layout.ts describes, for artScene.ts to batch like the salon. Engineering only: art modules
 * are used as authored and only placed, turned and copied here.
 *
 * - ChatGPT's grand hall architecture (VA-0065, `8a874c9`): promenade, side walls, coffered
 *   ceiling, colonnade and ring chandeliers, built at the layout's size (grandHall.ts uses the
 *   same spec for collision).
 * - Blackjack hero tables (VA-0054), each with two of the pilot swivel chairs.
 * - One hero cabinet per theme on the far end wall: these are the interactive `slot_<id>`
 *   machines (reels, spin button, marquee). The side-wall banks are copies of them that share
 *   their geometry, materials and canvas textures, so they batch with them.
 * - ChatGPT's woven carpet over the whole floor (a plain floor in tests, where there is no canvas).
 *
 * The architecture has no end walls (VA-0065: the host frames them). The far end wall is a
 * PLACEHOLDER plain dark box, named like the salon's rear wall so the overview cuts it away; the
 * entrance end stays open, as in the salon.
 */
import * as THREE from 'three';
import { createGrandHallArchitecture } from '../../../../art/casino/3d/grandHallArchitecture.mjs';
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
  const spec = layout.hallSpec ?? { width: 24, length: 36, height: 7.2, aisleWidth: 7.5, bayLength: 4 };
  // the whole hall's floor, wall to wall and end to end (the walkable room is smaller)
  const w = spec.width;
  const d = spec.length;
  const cx = 0;
  const cz = 0;

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

  // ChatGPT's architecture at the layout's size
  root.add(createGrandHallArchitecture(THREE, spec) as THREE.Group);
  // PLACEHOLDER far end wall (the art leaves both ends open)
  const endWall = new THREE.Mesh(new THREE.BoxGeometry(w, spec.height, 0.36), new THREE.MeshStandardMaterial({ color: 0x1e1622, roughness: 0.85 }));
  endWall.name = 'rear_wall';
  endWall.position.set(0, spec.height / 2, -d / 2 - 0.18);
  root.add(endWall);

  // tables: the interactive one's chairs are the seats' (named like the salon's), the rest decor
  root.add(tableWithChairs(layout.table, ['blackjack_1_chair', 'blackjack_2_chair']));
  layout.decor.tables.forEach((t, i) => root.add(tableWithChairs(t, [`deco_${i + 1}a_chair`, `deco_${i + 1}b_chair`])));

  // machines: one hero per theme, interactive, on the end wall; then copies along the side walls
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
