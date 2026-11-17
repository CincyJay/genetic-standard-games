import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { auditMeshes } from '../src/floor3d/meshAudit';

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
