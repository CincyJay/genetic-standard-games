/** Velvet Ace original art: restrained beam-centred ceiling diffuser.
 * Art-only geometry, not a light source. Metres; Y points up.
 * Engine owns placement, batching, materials and disposal.
 */
export function createVelvetCofferBeamDiffuser(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh || !THREE?.BoxGeometry || !THREE?.MeshStandardMaterial)
    throw new TypeError('Supply the Three.js namespace');
  const length = options.length;
  const axis = options.axis ?? 'z';
  const width = options.width ?? 0.045;
  const thickness = options.thickness ?? 0.012;
  const centreY = options.centreY ?? -0.306;
  if (!Number.isFinite(length) || length <= 0 || length > 200)
    throw new RangeError('length must be a positive finite metre value <= 200');
  if (!['x','z'].includes(axis)) throw new RangeError('axis must be x or z');
  if (!Number.isFinite(width) || width <= 0 || width > 0.14)
    throw new RangeError('width must be > 0 and <= 0.14 metres');
  if (!Number.isFinite(thickness) || thickness <= 0 || thickness > 0.03)
    throw new RangeError('thickness must be > 0 and <= 0.03 metres');
  if (!Number.isFinite(centreY)) throw new RangeError('centreY must be finite');
  const group = new THREE.Group();
  group.name = 'VelvetCofferBeamDiffuser_ArtStudy';
  const geometry = new THREE.BoxGeometry(axis === 'x' ? length : width,
    thickness, axis === 'z' ? length : width);
  const material = options.material ?? new THREE.MeshStandardMaterial({
    color: 0xffd49b, emissive: 0xffd49b, emissiveIntensity: 0.24, roughness: 0.55
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'coffer_light_diffuser_beam';
  mesh.position.y = centreY;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);
  group.userData = {
    artStudy: true, axis, lengthMetres: length, widthMetres: width,
    thicknessMetres: thickness, centreYMetres: centreY,
    materialOwnedByCaller: Boolean(options.material),
    revision: 'VA-0336: slim symmetric beam-centred diffuser',
    disclaimer: 'Stylized art prototype, not integrated, photorealistic or device-tested'
  };
  return group;
}
