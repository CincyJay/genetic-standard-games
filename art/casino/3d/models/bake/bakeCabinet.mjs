/**
 * Bakes one of Joshua's AI-generated slot cabinets (Tripo GLB export) into a floor-ready GLB
 * (Claude, 2026-11-22). Not part of the game build; run by hand when a new model arrives.
 *
 * Needs (installed anywhere on NODE_PATH or next to this file, not in the game's package.json):
 *   npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer sharp
 *
 * Usage:
 *   node bakeCabinet.mjs <in.glb> <out.glb> --front=+X|-X|+Z|-Z [--crop=x0,x1,z0,z1] [--scale=S | --height=H]
 *        [--squeeze=1] [--depth=1] [--maxWidth=0.70] [--near=6000] [--far=800] [--farError=0.02] [--colour=2048] [--maps=1024]
 *
 * - `--crop` keeps only triangles whose centroid lies in that model-space X/Z box (for a model that
 *   is a whole bank or scene); omit it for a single cabinet.
 * - The cabinet is turned so its front faces +Z, centred on X, stood on the floor (y 0) with its
 *   back 0.34 m behind the origin (the islands' back-to-back spacing), and scaled by `--scale`, or to
 *   `--height` metres, then shrunk if needed so it is no wider than `--maxWidth` (bank pitch 0.65 m;
 *   neighbours may overlap a few cm where their sides meet).
 * - `--squeeze` / `--depth` narrow / thin the cabinet by that factor after scaling (Joshua's OK,
 *   2026-11-22: tweak a model to fit the bank, keep its design), so a squat, wide model can stand
 *   tall without taking two bank spots. Normals are corrected for the stretch.
 * - Two meshes in one GLB sharing one material: `tripo_cabinet_near` (~`--near` triangles) and
 *   `tripo_cabinet_far` (~`--far`). Colour texture `--colour`², normal and ORM `--maps`².
 * - Prints the cabinet's size and its front's z, which the floor's model list needs (frontZ).
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, prune, dedup, mergeDocuments, unpartition, dequantize, textureCompress, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [inp, out, ...rest] = process.argv.slice(2);
const arg = (k, d) => rest.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const front = arg('front', '+Z');
const crop = arg('crop', null)?.split(',').map(Number);
const maxWidth = +arg('maxWidth', 0.7);
const nearTris = +arg('near', 6000), farTris = +arg('far', 800);
const BACK_Z = -0.34;
if (!inp || !out || !['+X', '-X', '+Z', '-Z'].includes(front)) {
  console.error('usage: node bakeCabinet.mjs in.glb out.glb --front=+X|-X|+Z|-Z [--crop=x0,x1,z0,z1] [--scale=S|--height=H]');
  process.exit(1);
}
await MeshoptSimplifier.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

// turn model (x, z) so `front` points to +Z
const turn = { '+Z': (x, z) => [x, z], '-Z': (x, z) => [-x, -z], '+X': (x, z) => [-z, x], '-X': (x, z) => [z, -x] }[front];

async function level(name, targetTris) {
  const doc = await io.read(inp);
  // Tripo exports are meshopt-compressed and quantized: decode on read, write plain floats
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'EXT_meshopt_compression') e.dispose();
  await doc.transform(dequantize());
  const mesh = doc.getRoot().listMeshes()[0], prim = mesh.listPrimitives()[0];
  const pos = prim.getAttribute('POSITION'), nor = prim.getAttribute('NORMAL');
  const P = pos.getArray(), N = nor.getArray(), I = prim.getIndices().getArray();
  // crop by centroid in model space
  let keep = I;
  if (crop) {
    const k = [];
    for (let t = 0; t < I.length; t += 3) {
      let x = 0, z = 0;
      for (const v of [I[t], I[t + 1], I[t + 2]]) { x += P[v * 3] / 3; z += P[v * 3 + 2] / 3; }
      if (x >= crop[0] && x <= crop[1] && z >= crop[2] && z <= crop[3]) k.push(I[t], I[t + 1], I[t + 2]);
    }
    keep = new Uint32Array(k);
    prim.getIndices().setArray(keep);
  }
  await doc.transform(prune({ keepAttributes: true }), weld());
  const P2 = prim.getAttribute('POSITION').getArray().slice(), N2 = prim.getAttribute('NORMAL').getArray().slice();
  // turn, then measure
  for (let i = 0; i < P2.length; i += 3) {
    [P2[i], P2[i + 2]] = turn(P2[i], P2[i + 2]);
    [N2[i], N2[i + 2]] = turn(N2[i], N2[i + 2]);
  }
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < P2.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], P2[i + c]); mx[c] = Math.max(mx[c], P2[i + c]); }
  const size = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  let s = arg('scale', null) ? +arg('scale') : arg('height', null) ? +arg('height') / size[1] : 1.74 / size[1];
  const sq = +arg('squeeze', 1), dp = +arg('depth', 1);
  if (size[0] * s * sq > maxWidth) s = maxWidth / (size[0] * sq);
  const sx = s * sq, sz = s * dp;
  const cx = (mn[0] + mx[0]) / 2;
  for (let i = 0; i < P2.length; i += 3) {
    P2[i] = (P2[i] - cx) * sx;
    P2[i + 1] = (P2[i + 1] - mn[1]) * s;
    P2[i + 2] = (P2[i + 2] - mn[2]) * sz + BACK_Z; // back (min z after the turn) at BACK_Z
    // a stretch scales normals by its inverse
    const nx = N2[i] / sq, ny = N2[i + 1], nz = N2[i + 2] / dp, l = Math.hypot(nx, ny, nz) || 1;
    N2[i] = nx / l; N2[i + 1] = ny / l; N2[i + 2] = nz / l;
  }
  prim.getAttribute('POSITION').setArray(P2);
  prim.getAttribute('NORMAL').setArray(N2);
  mesh.setName(name);
  doc.getRoot().listNodes()[0].setName(name).setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  const have = prim.getIndices().getCount() / 3;
  const ratio = Math.min(1, targetTris / have);
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: name.endsWith('far') ? +arg('farError', 0.02) : 0.002 }), prune());
  // Tripo's UV seams pin the attribute-aware simplifier well above a far target: the far level
  // (only ever seen across the hall) takes meshopt's sloppy pass to get there
  if (name.endsWith('far') && prim.getIndices().getCount() / 3 > targetTris * 1.2) {
    const ix = prim.getIndices().getArray(), px = prim.getAttribute('POSITION').getArray();
    const [sl] = MeshoptSimplifier.simplifySloppy(new Uint32Array(ix), px, 3, null, targetTris * 3, 1);
    prim.getIndices().setArray(ix instanceof Uint16Array ? new Uint16Array(sl) : sl);
    compactPrimitive(prim);
  }
  const tris = prim.getIndices().getCount() / 3;
  return { doc, tris, size: [size[0] * sx, size[1] * s, size[2] * sz].map((v) => +v.toFixed(3)), scale: +s.toFixed(4), frontZ: +(size[2] * sz + BACK_Z).toFixed(3) };
}

const near = await level('tripo_cabinet_near', nearTris);
const far = await level('tripo_cabinet_far', farTris);
mergeDocuments(near.doc, far.doc);
const root = near.doc.getRoot();
const [scene, ...others] = root.listScenes();
for (const s of others) { for (const n of s.listChildren()) scene.addChild(n); s.dispose(); }
const colour = +arg('colour', 2048), maps = +arg('maps', 1024);
await near.doc.transform(
  dedup(), prune(), unpartition(),
  textureCompress({ encoder: sharp, slots: /^baseColor/, resize: [colour, colour], targetFormat: 'jpeg', quality: 88 }),
  textureCompress({ encoder: sharp, slots: /^(normal|metallicRoughness|occlusion)/, resize: [maps, maps] }),
);
root.getAsset().generator = 'Velvet Ace bakeCabinet.mjs (Claude) from a Tripo model by Joshua';
await io.write(out, near.doc);
console.log(JSON.stringify({ out, near: near.tris, far: far.tris, size: near.size, scale: near.scale, frontZ: near.frontZ }));
