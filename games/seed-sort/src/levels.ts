import packed from './levels/levels.json';
import { generateLevel, type Level } from './logic/generator.ts';

interface Packed {
  id: number;
  c: number;
  p: string;
  par: number;
  d: number;
}

function unpack(l: Packed): Level {
  return {
    id: l.id,
    capacity: l.c,
    pots: l.p.split('|').map((pot) => (pot === '' ? [] : [...pot].map((ch) => parseInt(ch, 36)))),
    par: l.par,
    difficulty: l.d,
  };
}

const pack = packed as Packed[];
export const PACKED_LEVEL_COUNT = pack.length;

/** Levels beyond the pre-built pack are generated on the device (same algorithm, same results). */
export function getLevel(id: number): Level {
  const p = pack[id - 1];
  return p ? unpack(p) : generateLevel(id);
}
