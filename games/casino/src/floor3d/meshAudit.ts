import * as THREE from 'three';

/** One integrity problem found in a mesh's geometry. */
export interface MeshIssue {
  mesh: string;
  kind: 'index-out-of-range' | 'non-finite-position' | 'non-finite-normal';
  detail: string;
}

/**
 * Checks every mesh under `root` for geometry faults that render wrongly without any console error:
 * indices that point past the position buffer (WebGL silently drops or garbles those triangles),
 * and NaN/Infinity in positions or normals (black or flickering shading). Read-only: it never repairs
 * or changes the art, so the floor integration and the isolated previews can refuse or report it.
 */
export function auditMeshes(root: THREE.Object3D): MeshIssue[] {
  const issues: MeshIssue[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry as THREE.BufferGeometry;
    const name = m.name || '(unnamed)';
    const pos = g.attributes.position;
    if (!pos) return;
    if (g.index) {
      let bad = 0, max = -1;
      const idx = g.index.array as ArrayLike<number>;
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k];
        if (i >= pos.count) bad++;
        if (i > max) max = i;
      }
      if (bad) issues.push({ mesh: name, kind: 'index-out-of-range', detail: `${bad} indices ≥ vertex count ${pos.count} (max index ${max})` });
    }
    const countNonFinite = (arr: ArrayLike<number>) => {
      let n = 0;
      for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) n++;
      return n;
    };
    const badPos = countNonFinite(pos.array as ArrayLike<number>);
    if (badPos) issues.push({ mesh: name, kind: 'non-finite-position', detail: `${badPos} non-finite position components` });
    const nrm = g.attributes.normal;
    if (nrm) {
      const badN = countNonFinite(nrm.array as ArrayLike<number>);
      if (badN) issues.push({ mesh: name, kind: 'non-finite-normal', detail: `${badN} non-finite normal components (${badN / 3} vertices)` });
    }
  });
  return issues;
}
