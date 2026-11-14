/** Finds each machine's payScale for a 95% return with all features. Usage: node tests/tune-pays.ts [spins] */
import { createRng } from '../../../packages/kit/src/rng.ts';
import { MACHINES, simulateRtp } from '../src/logic/slots.ts';
const n = Number(process.argv[2] ?? 300_000);
for (const m of MACHINES) {
  let lo = 0.3;
  let hi = 1.2;
  for (let k = 0; k < 14; k++) {
    m.payScale = (lo + hi) / 2;
    const { rtp } = simulateRtp(m, n, createRng(4242));
    if (rtp > 0.95) hi = m.payScale;
    else lo = m.payScale;
  }
  console.log(`${m.id}: payScale ${((lo + hi) / 2).toFixed(3)}`);
}
