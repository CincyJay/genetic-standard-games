/** Prints each machine's long-run return. Usage: node tests/rtp-sim.ts [spins] */
import { createRng } from '../../../packages/kit/src/rng.ts';
import { MACHINES, bonusEV, simulateRtp } from '../src/logic/slots.ts';
const n = Number(process.argv[2] ?? 500_000);
for (const m of MACHINES) {
  const r = simulateRtp(m, n, createRng(777));
  console.log(`${m.name.padEnd(16)} rtp ${(r.rtp * 100).toFixed(1)}%  hit ${(r.hitRate * 100).toFixed(0)}%  feature every ${r.featureEvery} spins  bonusEV ${bonusEV(m).toFixed(1)}x`);
}
