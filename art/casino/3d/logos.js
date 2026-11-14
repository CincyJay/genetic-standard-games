// Machine title logos: gold-rimmed 3D lettering, one per machine.
import { M, THREE, rimText } from './kit.js';

const FACES = { sevens: 0xd0101a, lanterns: 0xc8102e, pharaoh: 0x1d4aa8, ocean: 0x0f7ab8, goldrush: 0x8a3a10 };
const NAMES = { sevens: 'LUCKY SEVENS', lanterns: 'LUCKY LANTERNS', pharaoh: "PHARAOH'S GOLD", ocean: 'DEEP BLUE', goldrush: 'GOLD RUSH' };

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
