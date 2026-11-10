/**
 * Pre-generates the level pack so phones never run the heavy solver for level
 * creation. Usage: npm run levels -- [count]
 */
import { writeFileSync } from 'node:fs';
import { generateLevel, type Level } from '../src/logic/generator.ts';

const count = Number(process.argv[2] ?? 300);
const levels: Level[] = [];
const t0 = Date.now();
for (let id = 1; id <= count; id++) {
  levels.push(generateLevel(id));
  if (id % 25 === 0) console.log(`level ${id}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
const out = new URL('../src/levels/levels.json', import.meta.url);
// Compact format: each pot is a string of base-36 digits ("0123"), pots joined by "|".
const packed = levels.map((l) => ({
  id: l.id,
  c: l.capacity,
  p: l.pots.map((pot) => pot.map((s) => s.toString(36)).join('')).join('|'),
  par: l.par,
  d: l.difficulty,
}));
writeFileSync(out, JSON.stringify(packed));
console.log(`Wrote ${levels.length} levels in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
