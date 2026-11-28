/**
 * Shrinks one of Joshua's rigged Tripo people (GLB with a Mixamo-named skeleton) for the floor
 * (Claude, 2026-11-22): geometry, skin and bones untouched; colour texture to `--colour`² JPEG,
 * normal / roughness-metal maps to `--maps`². Scale, pose and motion are the game's job.
 *
 * Needs @gltf-transform/core@4, /extensions@4, /functions@4 and sharp (not in the game's package.json).
 *   node bakeRigged.mjs <in.glb> <out.glb> [--colour=1024] [--maps=512]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const [inp, out, ...rest] = process.argv.slice(2);
const arg = (k, d) => rest.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const colour = +arg('colour', 1024), maps = +arg('maps', 512);
await doc.transform(
  dedup(), prune(),
  textureCompress({ encoder: sharp, slots: /^baseColor/, resize: [colour, colour], targetFormat: 'jpeg', quality: 85 }),
  textureCompress({ encoder: sharp, slots: /^(normal|metallicRoughness|occlusion)/, resize: [maps, maps], targetFormat: 'jpeg', quality: 90 }),
);
doc.getRoot().getAsset().generator = 'Velvet Ace bakeRigged.mjs (Claude) from a rigged Tripo model by Joshua';
await io.write(out, doc);
console.log(JSON.stringify({ out, skins: doc.getRoot().listSkins().map((s) => s.listJoints().length) }));
