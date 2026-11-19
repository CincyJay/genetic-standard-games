import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildReelSheet, remapUv, sheetLayout, type ReelSource } from '../src/floor3d/reelSheet.ts';

// VA-0222: every machine's reels share one sheet texture and one draw call.
describe('reel sheet', () => {
  it('lays ten 800 px atlases out as 4 x 3 within 4096, and refuses what does not fit', () => {
    expect(sheetLayout(10, 800, 4096)).toEqual({ cols: 4, rows: 3, width: 3200, height: 2400 });
    expect(sheetLayout(2, 800, 4096)).toEqual({ cols: 2, rows: 1, width: 1600, height: 800 });
    expect(sheetLayout(10, 800, 2048)).toBeNull();
    expect(sheetLayout(0, 800, 4096)).toBeNull();
  });

  it('maps atlas UVs into the machine tile, top-left tile first (flipY)', () => {
    const layout = { cols: 4, rows: 3, width: 3200, height: 2400 };
    const uv = new THREE.BufferAttribute(new Float32Array([0, 0, 1, 1, 0.5, 0.25]), 2);
    remapUv(uv, 0, layout);
    expect([uv.getX(0), uv.getY(0), uv.getX(1), uv.getY(1)]).toEqual([0, 2 / 3, 0.25, 1].map((n) => Math.fround(n)));
    const uv2 = new THREE.BufferAttribute(new Float32Array([0, 0, 1, 1]), 2);
    remapUv(uv2, 9, layout); // col 1, row 2 (bottom)
    expect(uv2.getX(0)).toBeCloseTo(0.25);
    expect(uv2.getY(0)).toBeCloseTo(0);
    expect(uv2.getX(1)).toBeCloseTo(0.5);
    expect(uv2.getY(1)).toBeCloseTo(1 / 3);
  });

  const fakeCanvas = (w: number, h: number, draws: number[][] = []) =>
    ({ width: w, height: h, getContext: () => ({ drawImage: (_c: unknown, x: number, y: number) => draws.push([x, y]) }) }) as unknown as HTMLCanvasElement;
  const reelMesh = (x: number) => {
    const g = new THREE.PlaneGeometry(1, 1).toNonIndexed();
    g.addGroup(0, 3, 0);
    g.addGroup(3, 3, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    m.position.x = x;
    return m;
  };

  it('merges every reel mesh into one, copies atlases 1:1 into their tiles and hides the sources', () => {
    const draws: number[][] = [];
    const sources: ReelSource[] = ['a', 'b', 'c'].map((id, i) => ({ id, canvas: fakeCanvas(800, 800), meshes: [reelMesh(i), reelMesh(i + 10)] }));
    const sheet = buildReelSheet(sources, 4096, (w, h) => fakeCanvas(w, h, draws))!;
    expect(sheet).not.toBeNull();
    expect(sheet.layout).toMatchObject({ cols: 2, rows: 2 });
    expect(draws).toEqual([[0, 0], [800, 0], [0, 800]]);
    expect(sheet.mesh.geometry.getAttribute('position').count).toBe(6 * 6);
    expect(sheet.mesh.geometry.groups.length).toBe(0);
    expect(sources.every((s) => s.meshes.every((m) => !m.visible))).toBe(true);
    // the source meshes keep their own UVs; positions are baked to world
    const pos = sheet.mesh.geometry.getAttribute('position');
    expect(Math.max(...Array.from({ length: pos.count }, (_, i) => pos.getX(i)))).toBeCloseTo(12.5);
    const uv = sheet.mesh.geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) expect(uv.getX(i)).toBeLessThanOrEqual(1);
    expect((sheet.mesh.material as THREE.MeshBasicMaterial).map).toBe(sheet.texture);
    sheet.refresh('b');
    expect(draws.at(-1)).toEqual([800, 0]);
  });

  it('keeps per-machine reels when there is one machine, or the atlases differ in size', () => {
    expect(buildReelSheet([{ id: 'a', canvas: fakeCanvas(800, 800), meshes: [reelMesh(0)] }], 4096, fakeCanvas)).toBeNull();
    const mixed: ReelSource[] = [
      { id: 'a', canvas: fakeCanvas(800, 800), meshes: [reelMesh(0)] },
      { id: 'b', canvas: fakeCanvas(640, 640), meshes: [reelMesh(1)] },
    ];
    expect(buildReelSheet(mixed, 4096, fakeCanvas)).toBeNull();
    expect(mixed.every((s) => s.meshes[0].visible)).toBe(true);
  });
});
