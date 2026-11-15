# 3D casino floor: art handoff contract (stage 1)

This is what ChatGPT's 3D art has to match so Claude can drop it into the 3D floor prototype
(VA-0016) without moving anything by hand. The numbers come from
`games/casino/src/floor3d/layout.ts` (positions) and `src/floor3d/camera.ts` (cameras). If
art needs a number changed, say so on the board and Claude changes the code to match; don't
work around it in the model.

Everything in the prototype today is a grey placeholder. None of it is art to keep.

## 1. Units, axes and origins
- **Units:** 1 unit = 1 metre. Model at real-world scale.
- **Axes:** glTF standard, which is right-handed with **+Y up**.
  - In the room, **+Z points to the entrance** (the south wall) and **−Z to the back wall**
    (the north wall). +X is east.
- **Facing:**
  - Characters and seated props face **+Z inside the file**. That's the glTF default, and what
    Blender's glTF exporter writes for a model that faces Blender's front view (−Y).
  - The game rotates them as needed: an avatar with heading 0 walks toward −Z.
- **Origins (pivot points):**

| Asset | Origin |
|---|---|
| Room shell | Centre of the room's floor at floor level: (0, 0, 0) in the plan below. Export the room in place. |
| Avatar, hair, outfits, accessories | On the floor, between the feet. |
| Blackjack table | Floor level, at the centre of the straight dealer edge. The curved player rail bulges toward +Z. |
| Stool | Floor level, at the centre of the stool. |
| Slot cabinet | Floor level, at the centre of the cabinet's footprint. The screen faces +Z in the file. |

## 2. Floor plan (metres)

| Item | Position / size |
|---|---|
| Room interior | x −8 to 8, z −8 to 6, so 16 × 14 m. Walls 3.2 m high. A ceiling is optional and must be a separate node named `ceiling`, so the overview camera can hide it. |
| Player spawn | (0, 2.2), facing −Z |
| Blackjack table | Dealer edge centred at (0, −3). Radius 1.3 m, height 0.9 m. Half-disc toward +Z. |
| Dealer spot | (0, −3.75), standing, facing +Z |
| Seat 1 (free in stage 1) | Stool at (−0.845, −1.411). Stand-up / approach point (−1.150, −0.837). |
| Seat 2 (taken by a computer player) | Stool at (0.845, −1.411). Approach point (1.150, −0.837). |
| Seat facing | Toward the table centre |
| Seat height | 0.72 m (top of the cushion) |
| Approach distance | 0.65 m outward from the stool centre |
| Pillars | Radius 0.45 m, full wall height, at (−4.5, 0) and (4.5, 0) |
| Slot bank | Four cabinets against the west wall. Each footprint is 0.85 m deep (x −8 to −7.15) × 0.8 m wide, centred at z = −5.5, −4.5, −3.5 and −2.5. Height is up to 1.95 m. |

Collision is computed from these shapes, not from the meshes:
- Keep the walkable space as it is. Decoration may overhang it only above 2.2 m.
- Don't add anything on the floor without asking first.

Room for more tables and seats will come in later stages. Additional seat positions follow the
same pattern: a stool plus an approach point 0.65 m outward.

## 3. File format and delivery
- **glTF 2.0 binary (`.glb`)**, one file per asset, metallic-roughness PBR materials.
  - Deliver the files uncompressed. Claude compresses them, using meshopt geometry and WebP or
    KTX2 textures with the free, MIT-licensed `gltf-transform`, and checks every file.
- **Naming:**
  - files: `games/casino/public/3d/<name>.glb`, in lower-case kebab-case;
  - nodes and materials: in the file, PascalCase or `snake_case`, with no spaces.
- **Planned files:**
  - `room-main.glb`
  - `table-blackjack.glb`
  - `stool.glb`
  - `slot-cabinet-<theme>.glb`, using the existing theme ids: `sevens`, `pharaoh`, `ocean`,
    `goldrush`, `lanterns`, `dragon`, `empire`, `thunder`, `tiger`, `cosmic`
  - `avatar-base.glb`
  - `hair-<id>.glb`, `outfit-<id>.glb`, `acc-<id>.glb`
  - `anim-avatar.glb`
  - `dealer.glb`
- **Manifest:** `games/casino/public/3d/manifest.json` lists each file with:
  - its role;
  - a licence note: original work, or a CC0 base model with the source named;
  - for hair, its colour variants.
- **Licensing:** original work, or MakeHuman/MPFB CC0 base meshes and outputs.
  - No AGPL code.
  - No downloaded third-party models.
  - No paid packs (VA-0012).
- **Text:** don't bake readable text into textures. Signs and labels are drawn by the game so
  they stay sharp and accurate.

## 4. Performance budget (starting point)
These limits are for the whole view on a mid-range Android phone. Claude will tighten or relax
them from measurements on the Galaxy S25+ and a cheaper phone.

| Item | Triangles | Materials | Textures |
|---|---|---|---|
| Whole visible scene | ≤ 150,000 | — | ≤ 96 MB GPU memory after compression |
| Draw calls | ≤ 120 total | | |
| Room shell | ≤ 40,000 | ≤ 8 | Baked lightmap on a second UV set (TEXCOORD_1), ≤ 2048² |
| Blackjack table | ≤ 15,000 | ≤ 3 | ≤ 1024² each |
| Stool | ≤ 2,000 | 1–2 | ≤ 512² |
| Slot cabinet (each) | ≤ 12,000 | ≤ 3 (one emissive screen) | ≤ 1024² |
| Avatar body (LOD0) | ≤ 25,000 | ≤ 3 | Body ≤ 2048², others ≤ 1024² |
| Each hair or outfit mesh | ≤ 8,000 | 1 | ≤ 1024² |
| Each accessory | ≤ 2,000 | 1 | ≤ 512² |

- Provide **LOD1 at about 50%** for the avatar and cabinets, with node names ending in `_LOD1`.
- **Transparency:** opaque or alpha-mask (cutout) only, except real glass, which uses alpha blend.
  Keep blended surfaces few and small; they're expensive on phones.

## 5. Lighting
- **Bake the room's lighting** into a lightmap. It's the cheapest way to make a mobile scene look
  real.
- At run time the game adds:
  - one directional key light;
  - a hemisphere fill;
  - an environment map for reflections on metal and lacquer. Supply `env-casino.hdr`,
    equirectangular, 1024×512, or Claude makes one from the room.
- Light fixtures, cabinet screens and signs use **emissive** materials. There are no real-time
  point lights.
- **Palette** (from VA-0008): warm gold, burgundy, plum and charcoal.

## 6. Avatar rig and customisation sockets
- **Skeleton:**
  - one humanoid skeleton, used for the base body and every hair and outfit file;
  - the same bone names and the same bind pose in each;
  - **at most 65 bones** (fingers optional).
  - The MPFB "game engine" rig is fine. Name the root bone `root`.
- **Outfits:** skinned meshes on that skeleton. Each outfit replaces the body parts it covers.
  Body parts hidden under clothing should be separate mesh nodes (`body_torso`, `body_arms`,
  `body_legs`, `body_feet`) so the game can hide them.
- **Hair:** a mesh skinned to the head bone (or rigidly parented), using material name `hair`.
  - For colour options, make the base-colour texture **light neutral grey**. The game tints it.
  - If a tint can't look right, supply one texture per colour as a variant in the manifest.
- **Accessory sockets:** empty nodes parented to bones. Accessories attach at the socket's
  origin, with no offset.

| Socket | Parent bone | For |
|---|---|---|
| `socket_head_top` | head | hats |
| `socket_ear_L`, `socket_ear_R` | head | earrings |
| `socket_neck` | neck | necklaces |
| `socket_wrist_L`, `socket_wrist_R` | hands | watches, bracelets |
| `socket_hand_R` | right hand | chips and cards (later) |

- **Animation clips** go in `anim-avatar.glb`. Use these exact names:

| Clip | What it is |
|---|---|
| `idle` | Loop, about 4 s |
| `walk` | Loop, in place, matched to **1.4 m/s** (the game plays it faster for its 2.6 m/s pace, or tell us the speed it's made for) |
| `sit_down` | Ends seated, about 0.9 s (see below) |
| `sit_idle` | Loop |
| `stand_up` | About 0.9 s, ending back at the approach point |
| `wave` | Optional |
| `turn_L`, `turn_R` | Optional |

- **`sit_down` placement:** starts standing at the approach point, facing the table. It ends
  seated with the hips 0.65 m forward and the seat contact at 0.72 m. Bake that movement into
  the root bone, or keep it in place and note it; the game can move the model instead.
- **The dealer** uses the same skeleton, with clips `dealer_idle` and `dealer_deal`.

## 7. Cameras (for preview renders)
Render previews from these two cameras so they match what players will see. The screen is
portrait at about 9:19.5.

| Camera | Vertical field of view | Placement |
|---|---|---|
| Follow | 72° | Behind the avatar at 2.4–7 m (default 4.2), 16° above level. It aims 1.2 m ahead of the avatar, at 1.2 m height. Near walls it moves closer and tilts down. |
| Overview | 50° | 9–20 m away (default 14), 54° above level, looking from the south-east (from +X, +Z toward −X, −Z). Walls between the camera and the room are hidden, so their outer faces don't need detail. |

- **Suggested preview angles:**
  - follow, from the spawn point;
  - follow, seated at seat 1;
  - overview, centred on the table.

## 8. Handover process
1. ChatGPT adds the `.glb` files and `manifest.json` in a PR, or as files Joshua passes on.
2. Claude checks each file against this contract and posts the results on the board:
   triangle and draw-call counts, bones, texture sizes, sockets and clip names.
3. Claude compresses, integrates and tests the files on the phone, with screenshots and frame
   timings, on a separate branch.
4. Joshua approves before anything reaches the live app.
