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

/** Duplicated-vertex shading creases in one geometry (see `findShadingSeams`). */
export interface ShadingSeams {
  /** coincident vertex pairs whose normals differ by an angle in [minDeg, maxDeg) */
  pairs: number;
  /** largest such angle, in degrees (0 when there are none) */
  maxDeg: number;
  /** y extent of the affected vertices, or null */
  y: [number, number] | null;
}

/**
 * Finds soft-surface shading creases: vertices at the same position (within `eps`) whose normals
 * differ by between `minDeg` and `maxDeg`. A lathe/ring shell whose closing column is a duplicate of
 * its first one gets split normals there from `computeVertexNormals()`, which shows as a dark
 * vertical line. Deliberate hard edges (box corners, caps meeting walls at ~90°) fall at or above
 * `maxDeg` and are ignored. Read-only diagnostic for the isolated previews; it repairs nothing.
 */
export function findShadingSeams(g: THREE.BufferGeometry, minDeg = 10, maxDeg = 60, eps = 1e-5): ShadingSeams {
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const out: ShadingSeams = { pairs: 0, maxDeg: 0, y: null };
  if (!pos || !nrm) return out;
  const buckets = new Map<string, number[]>();
  const key = (i: number) => `${Math.round(pos.getX(i) / eps)},${Math.round(pos.getY(i) / eps)},${Math.round(pos.getZ(i) / eps)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const list = buckets.get(k);
    if (list) list.push(i);
    else buckets.set(k, [i]);
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const list of buckets.values()) {
    for (let p = 0; p < list.length; p++) for (let q = p + 1; q < list.length; q++) {
      a.fromBufferAttribute(nrm, list[p]);
      b.fromBufferAttribute(nrm, list[q]);
      if (a.lengthSq() === 0 || b.lengthSq() === 0) continue;
      const deg = THREE.MathUtils.radToDeg(a.angleTo(b));
      if (!(deg >= minDeg && deg < maxDeg)) continue;
      out.pairs++;
      if (deg > out.maxDeg) out.maxDeg = Math.round(deg * 10) / 10;
      const y = pos.getY(list[p]);
      out.y = out.y ? [Math.min(out.y[0], y), Math.max(out.y[1], y)] : [y, y];
    }
  }
  return out;
}
