/** Finds each machine's payScale for its target return (95%, high limit 96.5%). Usage: node tests/tune-pays.ts [spins] [ids] */
import { createRng } from '../../../packages/kit/src/rng.ts';
import { MACHINES, simulateRtp } from '../src/logic/slots.ts';
const n = Number(process.argv[2] ?? 300_000);
const only = process.argv[3]?.split(',');
for (const m of MACHINES.filter((x) => !only || only.includes(x.id))) {
  let lo = 0.15;
  let hi = 1.2;
  for (let k = 0; k < 14; k++) {
    m.payScale = (lo + hi) / 2;
    const { rtp } = simulateRtp(m, n, createRng(4242));
    if (rtp > (m.targetRtp ?? 0.95)) hi = m.payScale;
    else lo = m.payScale;
  }
  console.log(`${m.id}: payScale ${((lo + hi) / 2).toFixed(3)}`);
}
