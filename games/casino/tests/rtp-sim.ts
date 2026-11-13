import { createRng } from '../../../packages/kit/src/rng.ts';
import { FREE_SPIN_MULTIPLIER, LINES, spin } from '../src/logic/slots.ts';
const rnd = createRng(987);
const N = 1_000_000;
let bet = 0, won = 0, hits = 0, fsTriggers = 0;
for (let i = 0; i < N; i++) {
  bet += LINES.length;
  let r = spin(1, rnd);
  won += r.total; if (r.total > 0) hits++;
  let fs = r.freeSpins; if (fs) fsTriggers++;
  while (fs > 0) { fs--; const f = spin(1, rnd); won += f.total * FREE_SPIN_MULTIPLIER; fs += f.freeSpins; }
}
console.log(JSON.stringify({ rtp: +(won / bet).toFixed(4), hitRate: +(hits / N).toFixed(3), fsEvery: Math.round(N / fsTriggers) }));
