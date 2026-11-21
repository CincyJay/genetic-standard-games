import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { safeArtBuild } from '../src/floor3d/safeArtBuild';

describe('safeArtBuild', () => {
  it('returns the built group untouched', () => {
    const g = new THREE.Group();
    g.userData.tag = 'x';
    const r = safeArtBuild(() => g);
    expect(r.group).toBe(g);
    expect(r.buildError).toBeNull();
  });

  it('wraps a non-group object in a group', () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const r = safeArtBuild(() => m);
    expect(r.group.children).toEqual([m]);
    expect(r.buildError).toBeNull();
  });

  it('turns a throwing builder into an empty group and an error string', () => {
    const r = safeArtBuild(() => {
      throw new ReferenceError('deckLip is not defined');
    });
    expect(r.group.children.length).toBe(0);
    expect(r.buildError).toBe('ReferenceError: deckLip is not defined');
  });
});
