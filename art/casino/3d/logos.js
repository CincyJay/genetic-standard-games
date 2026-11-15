// Machine title logos: gold-rimmed 3D lettering, one per machine.
import { M, THREE, rimText } from './kit.js';

const FACES = { sevens: 0xd0101a, lanterns: 0xc8102e, pharaoh: 0x1d4aa8, ocean: 0x0f7ab8, goldrush: 0x8a3a10, dragon: 0x9a0a14, empire: 0x2a4ab8, thunder: 0x1a4a9a, tiger: 0xc8601a, cosmic: 0x6a2ad8 };
const NAMES = { sevens: 'LUCKY SEVENS', lanterns: 'LUCKY LANTERNS', pharaoh: "PHARAOH'S GOLD", ocean: 'DEEP BLUE', goldrush: 'GOLD RUSH', dragon: "DRAGON'S HOARD", empire: 'DIAMOND EMPIRE', thunder: 'THUNDER PEAK', tiger: "TIGER'S TREASURE", cosmic: 'COSMIC FORTUNE' };

export const LOGOS = Object.fromEntries(
  Object.keys(NAMES).map((id) => [
    id,
    () => {
      const g = new THREE.Group();
      const t = rimText(NAMES[id], M.candy(FACES[id], 0.12), { font: 'serif', size: 1, depth: 0.3, bevel: 0.045 });
      g.add(t);
      return g;
    },
  ]),
);
