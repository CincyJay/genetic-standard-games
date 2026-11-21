import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { colourMerge, emissiveOf, materialKey } from '../src/floor3d/artScene.ts';

// VA-0220: materials that differ only in a non-black emissive colour share one batch.
describe('vertex emissive batching', () => {
  const neon = (hex: number) => new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.16, roughness: 0.19, emissive: hex, emissiveIntensity: 2.1 });

  it('keys theme-coloured emissives together, but never with black or mapped emissives', () => {
    expect(materialKey(neon(0xffbc52))).toBe(materialKey(neon(0x71e5ff)));
    expect(materialKey(neon(0xffbc52))).not.toBe(materialKey(neon(0x000000)));
    const mapped = neon(0xffbc52);
    mapped.emissiveMap = new THREE.Texture();
    expect(materialKey(mapped)).not.toBe(materialKey(neon(0x71e5ff)));
    expect(materialKey(new THREE.MeshBasicMaterial({ color: 0xff0000 }))).toBe(materialKey(new THREE.MeshBasicMaterial({ color: 0x00ff00 })));
  });

  it('moves each piece\'s emissive into an emissiveColor attribute and patches the shader', () => {
    const mats = [neon(0xffbc52), neon(0x71e5ff)];
    const geos = [new THREE.BoxGeometry().toNonIndexed(), new THREE.BoxGeometry().toNonIndexed()];
    const merged = colourMerge(mats[0], geos, mats.map((m) => m.color), mats.map(emissiveOf)) as THREE.MeshStandardMaterial;
    expect(merged).not.toBe(mats[0]);
    expect(merged.emissive.getHex()).toBe(0xffffff);
    expect(merged.emissiveIntensity).toBe(2.1);
    expect(merged.vertexColors).toBe(false); // same base colour: no colour attribute
    const attr = geos[1].getAttribute('emissiveColor');
    expect(attr.count).toBe(geos[1].attributes.position.count);
    expect([attr.getX(0), attr.getY(0), attr.getZ(0)]).toEqual([mats[1].emissive.r, mats[1].emissive.g, mats[1].emissive.b].map(Math.fround));
    expect(merged.customProgramCacheKey()).toBe('va-vertex-emissive');
    // clones (e.g. the overview's glass roof) keep the patch
    expect((merged.clone() as THREE.Material).customProgramCacheKey()).toBe('va-vertex-emissive');
    const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
    merged.onBeforeCompile(shader as never, null as never);
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance = emissive * vEmissiveColor;');
    expect(shader.vertexShader).toContain('vEmissiveColor = emissiveColor;');
  });

  it('finds the emissive line in every patchable material\'s shader', () => {
    for (const lib of ['standard', 'physical', 'lambert', 'phong'] as const) expect(THREE.ShaderLib[lib].fragmentShader).toContain('vec3 totalEmissiveRadiance = emissive;');
  });

  it('leaves single-colour buckets untouched', () => {
    const m = neon(0xffbc52);
    const geos = [new THREE.BoxGeometry().toNonIndexed(), new THREE.BoxGeometry().toNonIndexed()];
    expect(colourMerge(m, geos, [m.color, m.color], [m.emissive, m.emissive])).toBe(m);
  });
});
