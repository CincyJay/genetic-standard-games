# Velvet Ace Casino | Avatar Art Pack for Claude Code

## Contents
- `assets/avatars/portraits/`: 16 optimized WebP portraits, 192 × 240 pixels.
- `assets/avatars/thumbnails/`: 16 thumbnails, 96 × 120 pixels.
- `assets/avatars/avatar_manifest.json`: stable IDs, display names, relative asset paths.
- `reference/original_avatar_collection.png`: source art and visual style reference.
- `reference/avatar_contact_sheet.jpg`: quick QA overview.

## Integration instructions
1. Copy `assets/avatars/` into the project assets directory, keeping paths consistent or updating the manifest.
2. Wire the 16 `avatar_XX` IDs into the EXISTING player-profile system. Do not create duplicate auth/profile storage.
3. Show portraits in the Avatar Selection and Dressing Room screens. Use thumbnails in chat and player lists.
4. Keep photo upload as a SEPARATE profile image mode; implement Android photo picker, cropping, secure upload, deletion, report/block/moderation and privacy controls.
5. Only expose cosmetic controls if actual compatible variation images or a true 3D model with material/mesh controls exist. These flat portraits CANNOT independently change eyes, skin tone, hairstyles, clothes, body types or accessories. Do not overlay crude SVG hair or paint recolors onto faces.
6. Do not treat the single composite as original high-resolution individual character photography. The separated portraits are limited to their source resolution and may need future replacement for large fullscreen panels.
7. Honor existing navigation, games, chat and multiplayer. Test with two accounts and Android when available.

## Suggested data shape
`{ avatarMode: "preset" | "photo", presetAvatarId: "avatar_01" | ... | "avatar_16", photoAssetId: string | null }`

## Important limits
This is a complete **base preset art pack**, not a fully layered custom avatar construction kit. Full per-feature customization would require commissioned, aligned render variants or rigged 3D characters. Some source portraits have slightly different background composition or camera framing.
