# Velvet Ace 3D art: original geometry production pass 01

**Artist / ownership:** ChatGPT. No paid or remotely hosted asset services. This is actual Three.js scene geometry, not static image mockups.

## Reproducible in-repo source
`art/casino/3d/velvetCasinoArt.mjs` exports four factories (pass the app's installed THREE namespace):
- `makeVelvetCasinoRoom(THREE)` forms an 18m × 16m room: marble floor, inlays, carpet, wood walls, decorative wall panels, columns, two suspended chandeliers, velvet benches.
- `makeVelvetBlackjackTable(THREE)`: green felt top, brass trim, betting circles, dealer shoe, chip tray; center origin.
- `makeVelvetSlotCabinet(THREE)`: actual 1.18m-wide upright cabinet body, front metallic rails, 5×5 independent screen cells, marquee, control console and spin button. Screen cells are named individually so the engineering layer can display animated reel surfaces.
- `makeVelvetChair(THREE)`: actual upholstery/metallic chair geometry. Engineering controls seat occupancy, interaction and placement.

## Immediate integration interface
- Y-up and meter scale; +Z faces camera/player for front-facing slot machine.
- Scene floor world y≈0.
- Recommended initial blackjack center `(0,0,-2)`, chairs near `(-.8,0,-.2)` and `(.8,0,-.2)`, rotated to face table. Exact collision/navmesh and seat positions are engineering-owned.
- These factories return a `THREE.Group`. Caller adds them to Three.js scene and supplies hemisphere/key lighting, shadow budget, collisions and gameplay.
- Reuse materials and geometries with instancing as appropriate to cut draw calls on Android. This v1 mesh is not GPU-optimized yet.

## Additional self-contained GLB package
ChatGPT also exported four actual glTF 2.0 binary asset files in `VelvetAce_3D_Art_Pack_01.zip` (conversation attachment):
`casino_lobby.glb`, `blackjack_table.glb`, `slot_machine.glb`, `casino_chair.glb`, with units, origins and placements in `manifest.json`. They are not committed in this branch; the in-repo factory is available immediately without exchanging a ZIP.

## Honest current limitations
This is an original mechanically modeled **initial 3D art pass**, not final film-quality casino visuals. Rigged realistic human, interchangeable hair/outfits/jewelry, polished character animation, optimized PBR texture sets and Android visual tests are **not completed**. Keep the live game unchanged and evaluate in Claude's separate dev-only 3D vertical slice.

## Collaboration
Claude owns Three.js setup, movement, two cameras, seat interaction, Phaser scene transition, dev harness and Android testing. ChatGPT alone authors production geometry/materials/character art. Technical suggestions and collision proxies from Claude are fine; original replacement graphics from Claude are not.
