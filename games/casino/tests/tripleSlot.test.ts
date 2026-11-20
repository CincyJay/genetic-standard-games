import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createVelvetTripleSlotCabinet } from '../../../art/casino/3d/velvetTripleScreenSlotStudy.mjs';
import { paintVelvetUpperScreen } from '../../../art/casino/3d/velvetUpperScreenPainter.mjs';
import { JackpotMeter, ScreenRepainter, TOP_LINE_MAX, TRIPLE_SCREENS, cabinetReport, fmtCoins, grandShare, fitScreenUvs, mountScreenTexture, paintScreenWith, screenAspect, topScreenCopy } from '../src/floor3d/tripleSlot.ts';
import { MACHINES, MAX_TOTAL_BET } from '../src/logic/slots.ts';

describe('triple-screen slot cabinet study (art 1670e35, VA-0256)', () => {
  const cab = createVelvetTripleSlotCabinet(THREE);
  const report = cabinetReport(THREE, cab);

  it('builds with three named screen surfaces whose front caps face +Z', () => {
    expect(cab.userData.front).toBe('+Z');
    expect(Object.keys(report.screensFacingFront).sort()).toEqual([...TRIPLE_SCREENS].sort());
    for (const s of TRIPLE_SCREENS) expect(report.screensFacingFront[s]).toBe(1);
  });

  it('stands on the floor at about 0.88 x 2.35 m (crown slimmed in 416f6c9) and fits a 0.45 m collision half-width', () => {
    // the plinth sat 5 mm above the floor in 1670e35; ff6752a seats it on y 0
    expect(report.bounds.min[1]).toBeGreaterThanOrEqual(0);
    expect(report.bounds.min[1]).toBeLessThan(0.001);
    expect(report.bounds.max[1]).toBeGreaterThan(2.3);
    expect(report.bounds.max[1]).toBeLessThan(2.45);
    expect(Math.max(-report.bounds.min[0], report.bounds.max[0])).toBeLessThan(0.45);
    // since ff6752a (VA-0258) the console deck projects forward to z 0.56; the rear stays at -0.39
    expect(-report.bounds.min[2]).toBeLessThan(0.45);
    expect(report.bounds.max[2]).toBeLessThan(0.6);
  });

  // 6b39809 (VA-0273) added a 7th material, sideInset, for the recessed tower side skins;
  // 2c4223f (VA-0279) added an 8th, channelRecess, for the dark backing behind the amber ribbons
  it('is cheap: under 6k triangles, 8 authored materials', () => {
    expect(report.triangles).toBeLessThan(6000);
    expect(report.materials).toBe(8);
  });

  it('glass is in front of its bezel, and both in front of the tower', () => {
    const z = (name: string) => new THREE.Box3().setFromObject(cab.getObjectByName(name)!).max.z;
    for (const s of TRIPLE_SCREENS) expect(z(`VA_${s}_glass`)).toBeGreaterThan(z(`VA_${s}_bezel`));
    // fb9008f (VA-0263) replaced the extruded slab 'VA_tapered_tower' with a swept body
    expect(z('VA_main_reels_5x5_bezel')).toBeGreaterThan(z('VA_curved_tapered_tower'));
  });

  // VA-0257 found the console and buttons buried inside the base; fixed in ff6752a (VA-0258)
  it('player console and buttons stand in front of and above the burgundy base', () => {
    const box = (name: string) => new THREE.Box3().setFromObject(cab.getObjectByName(name)!);
    const base = box('VA_burgundy_base');
    for (let i = 1; i <= 5; i++) {
      expect(box(`VA_player_button_${i}`).max.z).toBeGreaterThan(base.max.z + 0.005);
      // 4740660 (VA-0265) lowered the buttons to y 0.738, below the base top (0.741), but they sit
      // in front of the base (z >= 0.356 vs 0.297), so check they do not intersect it
      expect(box(`VA_player_button_${i}`).intersectsBox(base)).toBe(false);
    }
    expect(box('VA_console_ledge').max.z).toBeGreaterThan(base.max.z);
    // plinth and base now overlap instead of leaving a 12 mm gap
    expect(box('VA_weighted_plinth').max.y).toBeGreaterThanOrEqual(base.min.y);
  });

  // VA-0261 found the deck tilted away from the player; fb9008f (VA-0263) flipped it to +0.14 rad
  it('console deck top tilts toward the player', () => {
    const deck = cab.getObjectByName('VA_console_ledge')!;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(deck.getWorldQuaternion(new THREE.Quaternion()));
    expect(up.z).toBeGreaterThan(0.02);
  });

  // deck top surface height at a given z (deck is a rotated box)
  const deckTopAt = (z: number) => {
    const deck = cab.getObjectByName('VA_console_ledge') as THREE.Mesh;
    deck.updateWorldMatrix(true, false);
    deck.geometry.computeBoundingBox();
    const bb = deck.geometry.boundingBox!;
    const rear = new THREE.Vector3(0, bb.max.y, bb.min.z).applyMatrix4(deck.matrixWorld);
    const front = new THREE.Vector3(0, bb.max.y, bb.max.z).applyMatrix4(deck.matrixWorld);
    return { y: rear.y + ((z - rear.z) / (front.z - rear.z)) * (front.y - rear.y), rear };
  };

  // VA-0264: fb9008f left the buttons hovering 12-23 mm above the sloped deck; 4740660 (VA-0265) left
  // them 9.7 mm off along the deck normal. 0766a4e+d52172a (VA-0267/0269) seat them at y 0.7424,
  // z 0.3964: 0.4 mm off along the deck normal. Measured along the normal, because a tilted button's
  // axis-aligned box bottom is its front-lower edge, which sits below the deck top at the button centre.
  it('buttons rest on the deck top (gap along the deck normal under 4 mm)', () => {
    const deck = cab.getObjectByName('VA_console_ledge')!;
    const n = new THREE.Vector3(0, 1, 0).applyQuaternion(deck.getWorldQuaternion(new THREE.Quaternion()));
    const { rear } = deckTopAt(0);
    const v = new THREE.Vector3();
    for (let i = 1; i <= 5; i++) {
      const b = cab.getObjectByName(`VA_player_button_${i}`) as THREE.Mesh;
      b.updateWorldMatrix(true, false);
      const pos = b.geometry.getAttribute('position');
      let gap = Infinity;
      for (let k = 0; k < pos.count; k++) gap = Math.min(gap, v.fromBufferAttribute(pos, k).applyMatrix4(b.matrixWorld).sub(rear).dot(n));
      expect(Math.abs(gap)).toBeLessThan(0.004);
    }
  });

  // VA-0267/0269: arched crown embedded in the tower top, not floating. a9171b0 (VA-0271) moved it
  // forward 105 mm so its front (z 0.123) caps the marquee bezel (z 0.103-0.145) instead of sitting
  // 85 mm behind it; it must stay behind the marquee glass so it never hides the screen.
  it('has an arched marquee crown seated on the tower top, capping the marquee bezel', () => {
    const box = (name: string) => new THREE.Box3().setFromObject(cab.getObjectByName(name)!);
    const crown = box('VA_arched_marquee_crown');
    const tower = box('VA_curved_tapered_tower');
    expect(crown.min.y).toBeLessThan(tower.max.y);
    expect(crown.max.y).toBeGreaterThan(box('VA_top_marquee_bezel').max.y);
    const bezel = box('VA_top_marquee_bezel');
    expect(crown.max.z).toBeGreaterThan(bezel.min.z);
    expect(crown.max.z).toBeLessThan(bezel.max.z);
    expect(crown.max.z).toBeLessThan(box('VA_top_marquee_glass').min.z);
    // 6b39809 (VA-0273) extended the crown back to cap the tower top; 2c4223f (VA-0279) shortened
    // the gold crown to 0.30 m and caps the rear of the tower top with a separate dark box instead.
    expect(crown.max.x).toBeLessThan(tower.max.x + 0.01);
    const cap = box('VA_rear_tower_top_cap');
    expect(crown.min.z).toBeGreaterThan(-0.2); // no longer a full-depth slab
    // a369912 (VA-0281) trimmed the cap to end flush with the tower rear at the top (no 14 mm lip)
    const tp = (cab.getObjectByName('VA_curved_tapered_tower') as THREE.Mesh).geometry.getAttribute('position');
    let towerTopRear = Infinity;
    for (let i = 0; i < tp.count; i++) if (tp.getY(i) > tower.max.y - 0.03) towerTopRear = Math.min(towerTopRear, tp.getZ(i));
    expect(Math.abs(cap.min.z - towerTopRear)).toBeLessThan(0.003); // cap reaches the tower rear, no overhang
    expect(cap.max.z).toBeGreaterThan(crown.min.z); // and overlaps the crown: no gap on top
    expect(cap.min.y).toBeLessThan(tower.max.y); // seated into the tower top, not floating
    expect(cap.max.y).toBeGreaterThan(tower.max.y);
    expect(cap.max.y - tower.max.y).toBeLessThan(0.005);
    expect(cap.max.x).toBeLessThan(tower.max.x);
  });

  // 2c4223f (VA-0279): a dark backing sits 2 mm inboard of each 12 mm amber ribbon;
  // a369912 (VA-0281) widened it from 22 to 40 mm and toned the emitter down to avoid clipping
  it('dark ribbon backings are 40 mm wide, 2 mm inboard of the ribbon and wound outward', () => {
    cab.updateMatrixWorld(true);
    for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
      const back = cab.getObjectByName(`VA_recessed_light_backing_${side}`) as THREE.Mesh;
      const rib = cab.getObjectByName(`VA_inset_light_channel_${side}`) as THREE.Mesh;
      const skin = cab.getObjectByName(`VA_sculpted_side_inset_${side}`) as THREE.Mesh;
      const bp = back.geometry.getAttribute('position'), rp = rib.geometry.getAttribute('position');
      const sp = skin.geometry.getAttribute('position');
      expect(bp.count).toBe(rp.count);
      for (let i = 0; i < bp.count; i += 2) {
        expect(bp.getZ(i + 1) - bp.getZ(i)).toBeCloseTo(0.040, 4);
        // ribbon is 2 mm further out than the backing, and both are outside the skin
        expect((rp.getX(i) - bp.getX(i)) * sign).toBeCloseTo(0.002, 4);
        expect((bp.getX(i) - sp.getX(i)) * sign).toBeCloseTo(0.005, 4);
        // the ribbon lies within the backing in z
        expect(rp.getZ(i)).toBeGreaterThan(bp.getZ(i));
        expect(rp.getZ(i + 1)).toBeLessThan(bp.getZ(i + 1));
      }
      const m = back.material as THREE.MeshStandardMaterial;
      expect(m.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(0.1);
      const l = rib.material as THREE.MeshStandardMaterial;
      // saturated red-orange emissive that does not exceed 1.0 per channel before tone mapping
      expect(l.emissive.r * l.emissiveIntensity).toBeLessThanOrEqual(1);
      expect(l.emissive.r * l.emissiveIntensity).toBeGreaterThan(0.5);
      expect(l.emissive.g / l.emissive.r).toBeLessThan(0.3);
      expect(l.emissive.b).toBeLessThan(0.01);
      const idx = back.geometry.getIndex()!;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
      for (let i = 0; i < idx.count; i += 3) {
        a.fromBufferAttribute(bp, idx.getX(i)); b.fromBufferAttribute(bp, idx.getX(i + 1)); c.fromBufferAttribute(bp, idx.getX(i + 2));
        n.subVectors(c, b).cross(a.clone().sub(b));
        if (n.lengthSq() < 1e-12) continue;
        expect(Math.sign(n.x)).toBe(sign);
      }
    }
  });

  // 6b39809 (VA-0273): dark side skins 3 mm proud of each tower side, so they read as separate panels
  // without z-fighting the tower faces; they stay inside the cabinet's 0.45 m collision half-width.
  it('has a sculpted side inset on each tower side, just outside the tower face', () => {
    const tower = new THREE.Box3().setFromObject(cab.getObjectByName('VA_curved_tapered_tower')!);
    for (const side of ['left', 'right'] as const) {
      const skin = cab.getObjectByName(`VA_sculpted_side_inset_${side}`) as THREE.Mesh;
      expect(skin).toBeTruthy();
      expect((skin.material as THREE.Material).side).toBe(THREE.DoubleSide);
      const b = new THREE.Box3().setFromObject(skin);
      const outer = side === 'left' ? -b.min.x : b.max.x;
      expect(outer).toBeGreaterThan(0.34);
      expect(outer).toBeLessThan(0.45);
      expect(b.max.y - b.min.y).toBeGreaterThan(1.0);
      expect(b.min.z).toBeGreaterThan(tower.min.z);
      expect(b.max.z).toBeLessThan(tower.max.z);
    }
  });

  // 3f7c7bb (VA-0275): the right skin's winding was reversed so both skins face outward by geometry
  // alone, i.e. they would still shade correctly if sideInset became FrontSide.
  it('side inset face normals point outward on both sides (winding, not DoubleSide)', () => {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (const side of ['left', 'right'] as const) {
      const skin = cab.getObjectByName(`VA_sculpted_side_inset_${side}`) as THREE.Mesh;
      skin.updateWorldMatrix(true, false);
      const pos = skin.geometry.getAttribute('position');
      const idx = skin.geometry.getIndex()!;
      const sign = side === 'left' ? -1 : 1;
      let tris = 0;
      for (let i = 0; i < idx.count; i += 3) {
        a.fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(skin.matrixWorld);
        b.fromBufferAttribute(pos, idx.getX(i + 1)).applyMatrix4(skin.matrixWorld);
        c.fromBufferAttribute(pos, idx.getX(i + 2)).applyMatrix4(skin.matrixWorld);
        n.subVectors(c, b).cross(a.clone().sub(b));
        if (n.lengthSq() < 1e-12) continue;
        expect(Math.sign(n.x)).toBe(sign);
        tris++;
      }
      expect(tris).toBeGreaterThan(0);
    }
  });

  // 3f7c7bb (VA-0275): a thin emissive light channel along each inset's front edge, within the envelope
  it('has a front-edge light channel on each side inside the collision half-width', () => {
    const tower = new THREE.Box3().setFromObject(cab.getObjectByName('VA_curved_tapered_tower')!);
    for (const side of ['left', 'right'] as const) {
      const ch = cab.getObjectByName(`VA_inset_light_channel_${side}`) as THREE.Mesh;
      expect(ch).toBeTruthy();
      const b = new THREE.Box3().setFromObject(ch);
      const outer = side === 'left' ? -b.min.x : b.max.x;
      expect(outer).toBeLessThan(0.45);
      expect(b.max.z).toBeLessThan(tower.max.z);
      expect(b.max.y - b.min.y).toBeGreaterThan(1.0);
    }
  });

  // 416f6c9 (VA-0277): the channel is now a flat 12 mm ribbon (not a tube) facing outward, and the
  // crown crest dropped from ~2.43 m to ~2.365 m while still capping the marquee bezel.
  it('side light ribbons are flat 12 mm bands wound outward', () => {
    cab.updateMatrixWorld(true);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
      const ch = cab.getObjectByName(`VA_inset_light_channel_${side}`) as THREE.Mesh;
      expect(ch.geometry.type).toBe('BufferGeometry');
      const pos = ch.geometry.getAttribute('position');
      const idx = ch.geometry.getIndex()!;
      for (let i = 0; i < pos.count; i += 2) {
        expect(pos.getZ(i + 1) - pos.getZ(i)).toBeCloseTo(0.012, 4);
        expect(pos.getX(i + 1)).toBeCloseTo(pos.getX(i), 6);
      }
      let tris = 0;
      for (let i = 0; i < idx.count; i += 3) {
        a.fromBufferAttribute(pos, idx.getX(i)).applyMatrix4(ch.matrixWorld);
        b.fromBufferAttribute(pos, idx.getX(i + 1)).applyMatrix4(ch.matrixWorld);
        c.fromBufferAttribute(pos, idx.getX(i + 2)).applyMatrix4(ch.matrixWorld);
        n.subVectors(c, b).cross(a.clone().sub(b));
        if (n.lengthSq() < 1e-12) continue;
        expect(Math.sign(n.x)).toBe(sign);
        tris++;
      }
      expect(tris).toBeGreaterThan(0);
    }
  });

  it('slimmed crown crest stays under 2.38 m', () => {
    const crown = new THREE.Box3().setFromObject(cab.getObjectByName('VA_arched_marquee_crown')!);
    expect(crown.max.y).toBeLessThan(2.36); // bezier crest ~2.3375 + 9 mm bevel
    expect(crown.max.y).toBeGreaterThan(2.3);
  });

  // VA-0264: the deck's rear-top edge (y 0.809, z 0.159) sat inside the main glass slab (z 0.151-0.171,
  // bottom y 0.775). 4740660 (VA-0265) lowered it to y 0.766, 9 mm below the glass.
  it('deck rear edge stays below the main reel glass', () => {
    const glass = new THREE.Box3().setFromObject(cab.getObjectByName('VA_main_reels_5x5_glass')!);
    expect(deckTopAt(0).rear.y).toBeLessThanOrEqual(glass.min.y);
  });

  it('fitScreenUvs maps the cap UVs (authored in metres) to 0..1', () => {
    const c = createVelvetTripleSlotCabinet(THREE);
    const glass = c.getObjectByName('VA_main_reels_5x5_glass') as THREE.Mesh;
    const uv = glass.geometry.getAttribute('uv');
    const cap = glass.geometry.groups.find((g) => g.materialIndex === 0)!;
    let min = Infinity;
    for (let i = cap.start; i < cap.start + cap.count; i++) min = Math.min(min, uv.getX(i));
    expect(min).toBeLessThan(-0.3); // authored: shape units
    fitScreenUvs(glass.geometry);
    let lo = Infinity, hi = -Infinity;
    for (let i = cap.start; i < cap.start + cap.count; i++) for (const v of [uv.getX(i), uv.getY(i)]) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    expect(lo).toBeCloseTo(0, 5);
    expect(hi).toBeCloseTo(1, 5);
  });

  it('mountScreenTexture textures the caps and keeps the authored glass on the sides', () => {
    const c = createVelvetTripleSlotCabinet(THREE);
    const glass = c.getObjectByName('VA_main_reels_5x5_glass') as THREE.Mesh;
    const authored = glass.material;
    const tex = new THREE.Texture();
    mountScreenTexture(THREE, glass, tex);
    const mats = glass.material as THREE.Material[];
    expect((mats[0] as THREE.MeshBasicMaterial).map).toBe(tex);
    expect(mats[1]).toBe(authored);
  });
});

describe('triple-slot rails and upper-screen copy (671fd2e, VA-0283)', () => {
  const cab = createVelvetTripleSlotCabinet(THREE);
  it('front contour rails are non-emissive: the side ribbon is the only side light', () => {
    for (const side of [-1, 1]) {
      const rail = cab.getObjectByName(`VA_contoured_light_rail_${side}`) as THREE.Mesh;
      const rib = cab.getObjectByName(`VA_inset_light_channel_${side < 0 ? 'left' : 'right'}`) as THREE.Mesh;
      expect(rail.material).not.toBe(rib.material);
      const m = rail.material as THREE.MeshStandardMaterial;
      expect(m.emissive.r * m.emissiveIntensity).toBeLessThan(0.05);
    }
  });

  it('marquee and bonus copy come from the machine data', () => {
    const dragon = MACHINES.find((m) => m.id === 'dragon')!;
    const c = topScreenCopy(dragon);
    expect(c.marquee.title).toBe("DRAGON'S HOARD");
    expect(c.bonus.title).toBe('HOLD & SPIN');
    expect(c.bonus.lines).toEqual(['GRAND 2,000×', 'MAJOR 250×', 'MINOR 60×', 'MINI 20×']);
    for (const m of MACHINES) {
      const t = topScreenCopy(m);
      expect(t.marquee.title.length).toBeGreaterThan(0);
      expect(t.bonus.lines.length).toBeGreaterThan(0);
      expect(t.bonus.lines.length).toBeLessThanOrEqual(4);
    }
  });

  it('upper screens are landscape (aspect 1.5..1.9) so the copy canvas is sized to the cap', () => {
    for (const name of ['VA_top_marquee_glass', 'VA_bonus_display_glass']) {
      const a = screenAspect((cab.getObjectByName(name) as THREE.Mesh).geometry);
      expect(a).toBeGreaterThan(1.5);
      expect(a).toBeLessThan(1.9);
    }
  });
});

/** Minimal recording 2D canvas for node: measureText ~0.55 em per character. */
function stubCanvas() {
  const texts: { text: string; x: number; y: number; px: number; maxWidth?: number }[] = [];
  let font = '10px serif';
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, k) {
      if (k === 'measureText') return (t: string) => ({ width: t.length * 0.55 * parseFloat(/([\d.]+)px/.exec(font)![1]) });
      if (k === 'fillText') return (text: string, x: number, y: number, maxWidth?: number) => texts.push({ text, x, y, px: parseFloat(/([\d.]+)px/.exec(font)![1]), maxWidth });
      if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (k === 'font') return font;
      return () => {};
    },
    set(_t, k, v) { if (k === 'font') font = v; return true; },
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  return { canvas, texts };
}

describe('upper-screen painter integration (art d16bf75, VA-0285)', () => {
  const cab = createVelvetTripleSlotCabinet(THREE);
  const aspectOf = (n: string) => screenAspect((cab.getObjectByName(n) as THREE.Mesh).geometry);
  const withStubDocument = <T>(fn: (texts: ReturnType<typeof stubCanvas>['texts']) => T): T => {
    const stub = stubCanvas();
    const g = globalThis as Record<string, unknown>;
    const prev = g.document;
    g.document = { createElement: () => stub.canvas };
    try { return fn(stub.texts); } finally { g.document = prev; }
  };

  it('paints every machine\'s marquee and bonus copy inside the canvas at the cap aspect', () => {
    for (const m of MACHINES) {
      const copy = topScreenCopy(m);
      for (const [kind, c, name] of [['marquee', copy.marquee, 'VA_top_marquee_glass'], ['bonus', copy.bonus, 'VA_bonus_display_glass']] as const) {
        withStubDocument((texts) => {
          const canvas = paintScreenWith(paintVelvetUpperScreen as never, c, kind, aspectOf(name));
          expect(canvas.width).toBe(640);
          expect(Math.abs(canvas.width / canvas.height - aspectOf(name))).toBeLessThan(0.01);
          expect(texts.map((t) => t.text)).toEqual([c.title, ...(kind === 'bonus' ? c.lines : [])]);
          for (const t of texts) {
            expect(t.y).toBeGreaterThan(0);
            expect(t.y).toBeLessThan(canvas.height);
            expect(t.maxWidth).toBeLessThan(canvas.width);
          }
        });
      }
    }
  });

  it('bonus rows stay at least 13 canvas px (scaled) so the jackpot ladder remains legible', () => {
    const m = MACHINES.find((x) => x.holdSpin)!;
    withStubDocument((texts) => {
      const canvas = paintScreenWith(paintVelvetUpperScreen as never, topScreenCopy(m).bonus, 'bonus', aspectOf('VA_bonus_display_glass'));
      const scale = Math.min(canvas.width / 640, canvas.height / 360);
      for (const t of texts.slice(1)) expect(t.px).toBeGreaterThanOrEqual(13 * scale - 1e-6);
    });
  });
});

describe('enlarged bonus jackpot rows (art 9f3ceb5, VA-0287)', () => {
  const cab = createVelvetTripleSlotCabinet(THREE);
  const aspect = screenAspect((cab.getObjectByName('VA_bonus_display_glass') as THREE.Mesh).geometry);
  const paintBonus = (m: (typeof MACHINES)[number]) => {
    const stub = stubCanvas();
    const g = globalThis as Record<string, unknown>;
    const prev = g.document;
    g.document = { createElement: () => stub.canvas };
    try {
      const canvas = paintScreenWith(paintVelvetUpperScreen as never, topScreenCopy(m).bonus, 'bonus', aspect);
      return { canvas, texts: stub.texts };
    } finally { g.document = prev; }
  };

  it('every machine has at most 5 bonus lines (the painter shows only the first 5)', () => {
    for (const m of MACHINES) expect(topScreenCopy(m).bonus.lines.length).toBeLessThanOrEqual(5);
  });

  it(`bonus lines are short labels (<= ${TOP_LINE_MAX} chars), not paytable sentences`, () => {
    for (const m of MACHINES) for (const l of topScreenCopy(m).bonus.lines) expect(l.length).toBeLessThanOrEqual(TOP_LINE_MAX);
    const lucky = MACHINES.find((m) => m.freeSpins && !m.holdSpin)!;
    expect(topScreenCopy(lucky).bonus.lines[0]).toBe(`${lucky.freeSpins!.join(' · ')} SPINS`);
  });

  // b8ea9af (VA-0289) fits rows to 66% of row height (was 70%): four-row ladders paint ~33.8 px
  it('every bonus row glyph is at least 33 canvas px on a 640-px canvas (VA-0286 measured ~25 px)', () => {
    for (const m of MACHINES) {
      const { canvas, texts } = paintBonus(m);
      expect(canvas.width).toBe(640);
      for (const t of texts.slice(1)) expect(t.px).toBeGreaterThanOrEqual(33);
    }
  });

  it('sparse (one/two-row) bonus screens paint rows at >= 45 canvas px (b8ea9af raised the cap to 70)', () => {
    for (const m of MACHINES) {
      const { texts } = paintBonus(m);
      if (texts.length - 1 > 2) continue;
      for (const t of texts.slice(1)) expect(t.px).toBeGreaterThanOrEqual(45);
    }
  });

  it('rows sit below the title and inside the canvas without overlapping each other', () => {
    for (const m of MACHINES) {
      const { canvas, texts } = paintBonus(m);
      const [title, ...rows] = texts;
      if (!rows.length) continue;
      // centred (middle-baseline) text: half the glyph height above/below y
      expect(rows[0].y - rows[0].px / 2).toBeGreaterThan(title.y + title.px / 2);
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].y - rows[i].px / 2).toBeGreaterThan(rows[i - 1].y + rows[i - 1].px / 2);
      }
      const last = rows[rows.length - 1];
      expect(last.y + last.px / 2).toBeLessThan(canvas.height);
    }
  });
});

describe('live jackpot values on the bonus screen (VA-0288 next item)', () => {
  const cab = createVelvetTripleSlotCabinet(THREE);
  const aspect = screenAspect((cab.getObjectByName('VA_bonus_display_glass') as THREE.Mesh).geometry);

  it('fmtCoins keeps full digits to 9,999,999 and compacts above', () => {
    expect(fmtCoins(250_000)).toBe('250,000');
    expect(fmtCoins(9_999_999)).toBe('9,999,999');
    expect(fmtCoins(12_349_999)).toBe('12.3M');
    expect(fmtCoins(2_150_000_000)).toBe('2.1B');
    expect(fmtCoins(-5)).toBe('0');
  });

  it('grandShare matches the in-game rule: share of the pool, floor 1,000x bet', () => {
    expect(grandShare(250_000, 50, MAX_TOTAL_BET)).toBe(Math.max(50_000, Math.round(250_000 * Math.min(1, 50 / MAX_TOTAL_BET))));
    expect(grandShare(1_000_000, MAX_TOTAL_BET, MAX_TOTAL_BET)).toBe(Math.max(1000 * MAX_TOTAL_BET, 1_000_000));
    expect(grandShare(0, 10, MAX_TOTAL_BET)).toBe(10_000);
  });

  it('live copy: hold & spin shows its fixed ladder in coins, others lead with the progressive; all rows fit', () => {
    for (const grand of [250_000, 9_999_999, 3_456_789_012]) {
      for (const m of MACHINES) {
        const { bonus } = topScreenCopy(m, { bet: 250, grand });
        expect(bonus.lines[0]).toBe(`GRAND ${fmtCoins(m.holdSpin ? m.holdSpin.grand * 250 : grand)}`);
        expect(bonus.lines.length).toBeLessThanOrEqual(5);
        for (const l of bonus.lines) expect(l.length).toBeLessThanOrEqual(TOP_LINE_MAX);
        if (m.holdSpin) {
          const major = m.holdSpin.values.find((v) => v.lantern.label === 'MAJOR')!;
          expect(bonus.lines).toContain(`MAJOR ${fmtCoins(major.lantern.mult * 250)}`);
        }
      }
    }
    // without live data the copy is unchanged (multiplier ladder)
    const dragon = MACHINES.find((m) => m.id === 'dragon')!;
    expect(topScreenCopy(dragon).bonus.lines[0]).toBe(`GRAND ${dragon.holdSpin!.grand.toLocaleString('en-US')}×`);
  });

  it('live rows still paint at >= 33 canvas px for every machine', () => {
    for (const m of MACHINES) {
      const stub = stubCanvas();
      const g = globalThis as Record<string, unknown>;
      const prev = g.document;
      g.document = { createElement: () => stub.canvas };
      try {
        paintScreenWith(paintVelvetUpperScreen as never, topScreenCopy(m, { bet: 250, grand: 9_876_543 }).bonus, 'bonus', aspect);
      } finally { g.document = prev; }
      for (const t of stub.texts.slice(1)) expect(t.px).toBeGreaterThanOrEqual(33);
    }
  });

  it('JackpotMeter climbs, rolls to a raised target, clamps dt, snaps down on payout', () => {
    const j = new JackpotMeter(1000, 40, 1000);
    expect(j.tick(1000)).toBe(1040);
    expect(j.tick(60_000)).toBe(1080); // dt clamped to 1 s
    j.setTarget(2080);
    const mid = j.tick(500);
    expect(mid).toBeGreaterThan(1080);
    expect(mid).toBeLessThan(2080);
    expect(j.tick(500)).toBe(2080);
    let prev = j.value;
    for (let i = 0; i < 20; i++) { const v = j.tick(16); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    j.setTarget(500);
    expect(j.value).toBe(500);
  });

  it('ScreenRepainter skips unchanged copy and throttles to its interval', () => {
    const painted: string[] = [];
    const r = new ScreenRepainter((c) => painted.push(c.lines[0]), 250);
    const c = (n: number) => ({ title: 'T', lines: [`GRAND ${n}`] });
    expect(r.update(0, c(1))).toBe(true);
    expect(r.update(10, c(1))).toBe(false); // unchanged
    expect(r.update(100, c(2))).toBe(false); // too soon
    expect(r.update(260, c(2))).toBe(true);
    // a 60 fps loop for 2 s with a value changing every frame paints at most ~4 Hz
    for (let t = 300; t < 2300; t += 16) r.update(t, c(t));
    expect(r.paints).toBeLessThanOrEqual(2 + Math.ceil(2000 / 250));
    expect(painted[0]).toBe('GRAND 1');
  });
});
