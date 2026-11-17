import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { auditMeshes, findShadingSeams } from '../src/floor3d/meshAudit';

const tri = (indices: number[]) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g);
  m.name = 'tri';
  return m;
};

describe('auditMeshes', () => {
  it('passes clean geometry and three.js primitives', () => {
    const root = new THREE.Group();
    root.add(tri([0, 1, 2]), new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 5, 20)));
    expect(auditMeshes(root)).toEqual([]);
  });

  it('flags indices past the position buffer and the NaN normals they cause', () => {
    // the VA-0114 pattern: cap vertices pushed to the JS array after the attribute was created
    const issues = auditMeshes(tri([0, 1, 2, 0, 2, 3]));
    expect(issues.map((i) => i.kind)).toEqual(['index-out-of-range', 'non-finite-normal']);
    expect(issues[0].detail).toContain('vertex count 3');
  });

  it('flags non-finite positions', () => {
    const m = tri([0, 1, 2]);
    (m.geometry.attributes.position.array as Float32Array)[4] = NaN;
    expect(auditMeshes(m).some((i) => i.kind === 'non-finite-position')).toBe(true);
  });
});

describe('findShadingSeams', () => {
  /** A 16-sided open cylinder whose closing column duplicates the first (the Svelte hull pattern). */
  const ringShell = () => {
    const v: number[] = [], idx: number[] = [];
    const sides = 16;
    for (let i = 0; i <= 2; i++) for (let j = 0; j <= sides; j++) {
      const t = (2 * Math.PI * j) / sides;
      v.push(Math.cos(t), i, Math.sin(t));
    }
    for (let i = 0; i < 2; i++) for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j, b = a + sides + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  it('finds the split normals on a duplicated ring seam', () => {
    const s = findShadingSeams(ringShell());
    expect(s.pairs).toBe(3);
    expect(s.maxDeg).toBeGreaterThan(10);
    expect(s.y).toEqual([0, 2]);
  });

  it('ignores smooth primitives and deliberate hard box edges', () => {
    expect(findShadingSeams(new THREE.SphereGeometry(1, 16, 8)).pairs).toBe(0);
    expect(findShadingSeams(new THREE.BoxGeometry(1, 1, 1)).pairs).toBe(0);
  });
});
