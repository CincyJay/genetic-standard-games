# Velvet Ace modern casino design pilot | Art Pass 05

**Status:** Committed ART SOURCE only. Three.js factories have **not yet been integrated into an APK, rendered for Joshua's approval, or measured for mobile performance**. Do not call them production quality or consider the visual direction approved. The previous owner-rejected art remains in place unless a developer *opt-in* previews these pieces.

## Art created for the user-provided references

- `heroSlotCabinet.mjs`: `makeVelvetHeroCabinet(THREE, 'sevens')` produces the first fully revised original 3D slot cabinet. Physical layered metal/recessed cabinet chassis, separate illuminated upper title/top box, deep front glass/bezel, independently angled portrait display with **25 named 5×5 reel target surfaces**, cantilevered angled control deck, tactile spin button, cosmetic ticket receiver, speaker grilles, thick sides and perimeter LED channels. `HERO_THEMES` contains all ten current machine names/themes. This is a **pilot for silhouette review**, not yet a hero machine with finished custom-screen graphics or animated reels. Generated title art includes no real-jackpot claim or third-party branding.
- `contemporaryInterior.mjs`: `makeVelvetPatternedCarpet(THREE)` uses a deterministic original dense casino-carpet texture, laid as **one single floor plane** with minimal draw calls. The patterned surface covers the existing plain marble-floor area and keeps a separate central burgundy circulation aisle. `makeVelvetLuminousCeiling(THREE)` assembles a real dark coffer field, repeated bright light-panels, contemporary amber/red rectangular ceiling fixtures and hanging glass-globe lighting, inspired by the user photos without copying them. It's explicitly visible from normal third-person walking angles. `makeVelvetContemporaryInterior(THREE)` combines them. The current camera deliberately hides all objects starting with `chandelier_` in overhead mode; Claude must evaluate selective-cutaway vs full roof visibility.
- `luxuryGamingChair.mjs`: `makeVelvetLuxuryGamingChair(THREE)` creates a new *recognizable* padded luxury casino swivel chair with a curved leather back, segmented upholstery, lumbar support, padded arms, piping/stitch detail, gas lift, radial chrome legs and floor glides. The old basic chair remains in the existing live scene until a test.
- Existing original modules and pass-04 asset improvements are preserved.

## Example art-only integration (engineering)

```js
import * as THREE from 'three';
import {makeVelvetHeroCabinet} from './heroSlotCabinet.mjs';
import {makeVelvetContemporaryInterior} from './contemporaryInterior.mjs';
import {makeVelvetLuxuryGamingChair} from './luxuryGamingChair.mjs';

const pilot = new THREE.Group();
pilot.add(makeVelvetContemporaryInterior(THREE));
const slot = makeVelvetHeroCabinet(THREE,'sevens');slot.position.set(-5.45,0,-5.6);
pilot.add(slot);
const chair = makeVelvetLuxuryGamingChair(THREE);
chair.position.set(-5.45,0,-4.5);
pilot.add(chair);
scene.add(pilot);
```

The existing `artScene.ts` batching keys meshes by material values, and reserves `REEL_<col>_<row>_SWAP_TEXTURE`, `marquee_world_texture_target`, `spin_button` as interactive. The new hero preserves those names, but **its angled nested reel screen requires grouping and UV validation**. Engineering must keep the physical canted mesh geometry and avoid flattening the display during batching. The textured marquee uses a CanvasTexture that engineering must dispose on scene teardown. The old binary GLB packs do not contain this hero design.

## Exact visual review requirements
1. First frame must be 3/4 perspective **close-up** on one physical slot cabinet, with readable marquee and its control deck. Do not judge solely from the far camera or overhead view.
2. Screenshot carpet from standing eye level and overview. The texture must read as dense actual woven gaming carpet, not a UI checkerboard.
3. Look up to see actual ceiling panels and red hanging light sculptures from walking mode. In overview, verify cutaway does not leave an empty black world.
4. Show chair directly from behind and seated beside a slot; chair must resemble a believable padded chair rather than a simple primitive.
5. Run on S25+ and report draw calls/triangles/FPS/JS heap. Flag any cases that breach existing 120-call budget.
6. Do not replace authentic gameplay reels with decorative results. The existing slot symbols and reel state remain under Phaser engineering control.

The final art quality decision belongs to Joshua after viewing prototype screenshots. Keep all work isolated from the live casino and save.
