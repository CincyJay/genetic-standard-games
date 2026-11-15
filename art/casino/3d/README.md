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


## New in art pass 02 (2026-11-15)
- `slotThemes.mjs`: 10 original physically modeled slot cabinet variants with differentiated accent colors, crown motifs, 25 distinct `REEL_<col>_<row>_SWAP_TEXTURE` mesh planes, and interaction-friendly separate controls and marquee. Their 5×5 reel symbol content is NOT baked into the cabinet.
- `worldComposition.mjs`: assembles the lobby, table, two chairs and ten physical cabinets. Contains stable world positions for development-side seat and machine hotspots, in meters.
- `AvatarWardrobe.mjs`: draft-only loader for original modular GLB avatar variants. Hair colors swap via material, clothing and accessories via independent meshes. This is not wired to the existing Dressing Room and MUST NOT overwrite any player's photo/profile state.

### Assets generated outside GitHub
ChatGPT built a compressed art workspace `VelvetAce_3D_Art_Workspace_2026-11-15.zip` delivered as a ChatGPT conversation attachment, containing 31 GLB avatar pieces, 10 themed physical cabinet GLBs, seven tileable PBR material sets, a static batched casino GLB world, and source generation scripts. **Those binary files are not stored in GitHub**; PR #2 contains immediately consumable JavaScript geometry factories instead. Do not assume the binary packs are already available to Claude's filesystem.

### Quality and technical facts
- Static GLB world: 33 material-group meshes, 72,024 triangles, with exact seat and machine anchors in its JSON manifest. This is a **static** scenery/placeholder scene, not a navigable standalone app.
- Avatar part pack: 16 procedurally modeled simplified body/face proxies, 8 hair style/frame meshes, 4 outfits and 3 accessories; 6 adjustable hair colors via PBR material changes. It is **not photorealistic**, is not skinned or animated, and does NOT match source portrait identities.
- Slot pack: 10 original 3D upright cabinets with independent 5×5 reel material targets. They require live reel texture mapping, polish, mobile QA and colliders.
- Material pack: original 512×512 color, normal and ORM texture sets for velvet, marble, metal, felt, leather, wood and chrome. UV/texturing/lighting not integrated into every GLB.
- Nothing has been installed or Android-device tested from PR #2. Never release this art work in its current prototype state.

### Pipeline integration boundary
Claude may import the Three.js factories and provide exact screenshot/performance feedback, but must not replace graphics or assign the placeholder avatars as final characters. ChatGPT owns all subsequent artwork and final visual acceptance.
