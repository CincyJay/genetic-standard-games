# Velvet Ace avatars

## The art pack
`VelvetAce_Avatar_Art_Pack.zip` (v1.0), integrated as supplied:

| From the pack | In the project |
|---|---|
| `assets/avatars/portraits/NN_name.webp` (192x240) | `games/casino/public/assets/avatars/portraits/`, unchanged |
| `assets/avatars/thumbnails/NN_name.webp` (96x120) | `games/casino/public/assets/avatars/thumbnails/`, unchanged |
| `assets/avatars/avatar_manifest.json` | `games/casino/src/data/avatar_manifest.json`, unchanged (its paths are relative to the web root) |
| `reference/*`, `docs/CLAUDE_HANDOFF.md` | `assets/avatar-references/` |

Round frames (chat, lists, tables, profile) use round crops of the same files: `public/assets/avatars/round/`
(176px, from the portraits) and `round-thumbs/` (88px, from the thumbnails). They are made by
`art/casino/avatars/make_round.py`, which only crops and masks: no resizing up, no filters, no colour
changes. Natalie (`avatar_08`) and Viktor (`avatar_16`) are cropped off-centre there, because the
supplied portraits include a strip of the card frame on their left edge.

Where each image is used:
- Portraits: the avatar selection grid and the Dressing Room preview (loaded only when the
  Dressing Room opens).
- Round thumbnails: chat rows and player lists.
- Round portraits: the player's own picture, the tables, and the player card.

The presets are `avatar_01` … `avatar_16` from the manifest (Ava … Viktor). The names are preset
labels; players choose their own usernames. Computer players at the poker and Card Club tables
wear presets too (`BOT_FACES` in `src/logic/avatars.ts`).

## Data (the handoff's suggested shape, in the existing save and profile)
- Device save: `avatarMode` ('preset' or 'photo'), `presetAvatarId` ('avatar_07'), `photoAssetId`
  ('photo-<hash>' while a photo is worn, else null), `photo` (256px round PNG, on the device only)
  and `photoVisibility` ('everyone' or 'friends').
  Version 1.5 saves (`avatar: 'av-jasmine'` or a photo) are migrated at start-up.
- Firestore `profiles/{uid}` (the existing profile): `avatar` (the preset id: what everyone may see),
  `avatarMode`, `presetAvatarId` and `photoAssetId`.
- Firestore `photos/{uid}`: `{ data (96px round WebP), assetId, visibility, at }`.
  - It exists only while the photo is worn; removing the photo or switching to a preset deletes it.
  - The rules let the owner read it, plus every signed-in player when visibility is 'everyone', or
    only the owner's friends when it is 'friends'. Everyone else sees the preset.
  - Writes are limited to the owner, an image data URL of 40,000 characters or fewer, and a valid
    visibility.
- Chat and direct messages carry only the preset id, never a photo. Rows show the sender's current
  picture (re-read at most once a minute), and the rules refuse photos in message and profile
  `avatar` fields.

## Photo mode
USE MY PHOTO works like this:
- It opens the system photo picker (an image file input; Android shows its photo picker).
- Files over 20 MB and non-images are refused.
- The crop editor lets the player drag, pinch or use the slider to zoom. The image is only moved,
  scaled and cropped.
- The player chooses who can see it: all players or friends only.
- The photo can be replaced, and "Remove photo" deletes it from the device and online.
- Players can report ("Inappropriate photo or name") or block from any player card. Reports go to
  the `reports` collection for review in the Firebase console.

## Customisation
The pack has no variation images, so no cosmetic controls are shown: the Customize tab and button
appear only for a preset whose manifest entry lists `customizationVariants`. Each variant would be
`{ key: 'group:option', label, portrait, thumbnail }`, with groups under Face, Hair, Facial Hair,
Eyes, Outfits and Accessories (`CUSTOM_CATEGORIES`). Nothing is ever drawn over a portrait.

## Limitations and artwork needed
1. **Resolution:** the portraits are 192x240, cropped from one 1774x887 composite. They are fine at
   card and avatar sizes, but soft when enlarged (the Dressing Room shows them at about 1.7x).
   Full-resolution individual portraits (at least 1024x1280) would replace them with no code
   changes.
2. **Framing:** Natalie and Viktor include a frame strip on the left; a clean crop of those two
   would fix it.
3. **Customisation:** this needs aligned render variants of each character (or rigged 3D
   characters), listed per preset in `customizationVariants`.
4. **Moderation:** there is no automatic image screening. That needs a server function (Cloud
   Vision SafeSearch via Cloud Functions, which requires the Blaze plan). Photos are kept small
   (96px) because they live in Firestore rather than Storage, which also needs Blaze.
5. **Older clients:** version 1.5 clients write photos into the profile, which the rules now
   refuse, so they should update.
