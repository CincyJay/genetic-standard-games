# Velvet Ace avatars

## Source artwork
- Official reference: `assets/avatar-references/a_cinematic_high_detail_promotional_game_asset_sh.png`
  (a 1774x887 composite preview of the 16 characters, as supplied).
- Cut out without retouching, filters or upscaling into
  `games/casino/public/art/avatars/real/`:
  - `<id>.webp`: 190x236 portrait (inside the gold frame, above the nameplate).
  - `<id>-face.webp`: 170x170 round head-and-shoulders crop (transparent corners).
  - 32 files, about 300 KB in total. The faces are loaded at start-up (about 8 KB each); the portraits (about 11 KB each) load
    only when the Dressing Room opens.
- Presets (ids in brackets): Ava, Brooke, Carmen, Dakota, Elena, Fallon, Jasmine, Natalie,
  Alex, Braden, Carlos, Derek, Jax, Luca, Mason, Viktor (`ava` … `viktor`).
  The names are preset labels; players choose their own usernames in the Lounge.
- The computer players at the poker and Card Club tables wear preset faces too
  (`BOT_FACES` in `src/logic/avatars.ts`). No illustrated faces remain in the app.

## Data
- Device (`velvet-ace.save` in local storage):
  - `avatar`: `''` (Velvet Ace monogram), a preset key (`av-jasmine`), or the player's photo as
    a 256px round PNG data URL.
  - `avatarLook`: `{ preset, custom }`, the last preset look confirmed. It is kept while a photo is
    worn, so removing the photo restores it.
- Online (Firestore `profiles/{uid}.avatar`, the existing profile document, written by
  `online.publish()` whenever the avatar changes): the preset key, or the photo shrunk to a
  96px round WebP (about 3-6 KB). Chat and direct messages also carry the sender's picture,
  and chat rows swap in the sender's current one (re-read at most once a minute).
- Rules (`firebase/firestore.rules`, deployed): profiles and chat are readable only by signed-in
  players. Only the owner can write their own profile. An avatar value is limited to 20,000
  characters.

## Customisation
`CUSTOM_CATEGORIES` lists Face, Hair, Facial Hair, Eyes, Outfits and Accessories with all their
options. Every group's first option is "As pictured". Any other option unlocks only when
`VARIANT_ART[presetId]['group:option']` names a realistic portrait of that same character with
that change. The option then becomes selectable, and the look's texture key becomes
`av-<preset>--<group>-<option>`. No image is ever drawn over a photograph.

## Photo uploads
USE MY PHOTO works like this:
- It opens the system photo picker (an image file input; Android shows its photo picker).
- Files over 20 MB and non-images are refused.
- The crop editor lets the player drag, pinch or use the slider to zoom.
- It saves a round 256px PNG on the device and a 96px WebP online.
- The photo can be replaced or removed at any time. The image is only moved, scaled and
  cropped; the face is never altered.

## Limitations
- The supplied sheet is a 1774x887 preview, so each portrait is only about 190x236 pixels.
  That is fine for the round faces (shown at up to 190px), but soft when the Dressing Room
  preview enlarges it to 320px.
- No customisation option beyond "As pictured" is unlocked yet, because no variant artwork
  exists.
- Photo moderation is limited to:
  - visibility only to signed-in players;
  - the in-app Report button (reports go to the `reports` collection, reviewed in the Firebase
    console);
  - blocking.

  Automatic image screening needs a server function (Cloud Vision SafeSearch via Cloud
  Functions), which requires the Blaze plan.
- Photos are stored in the profile document, not Firebase Storage (Storage also needs Blaze),
  which is why they are small.

## Artwork needed
1. **Full-resolution originals of all 16 portraits:** at least 1024x1280 each, without the frame
   and nameplate, same framing.
2. **For each character, a portrait of that same person (same pose and lighting) for each look
   to unlock.** Possible variants:
   - Hair: style, colour and length.
   - Facial hair (men): clean-shaven, stubble, mustache, short beard, full beard.
   - Eyes: eye colours, brows.
   - Outfits: casual casino, formal suit, tuxedo, evening dress, luxury fashion, VIP.
   - Accessories: sunglasses, eyeglasses, jewelry, watch, earrings, hats.
   - Face: skin tone, expression.

   Add each as `public/art/avatars/real/variants/<id>-<group>-<option>.webp`, register it in
   `VARIANT_ART`, and load its face key.
3. **Any new base characters,** in the same style.
