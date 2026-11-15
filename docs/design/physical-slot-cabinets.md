# Physical slot cabinet graphics, v1

These ten independently themed SVG sprites are production game assets authored by ChatGPT, not mockup screenshots. Each is 1080×1920 with transparent openings precisely aligned to the 5×5 reel window (x135–945, y768–1586) and upper logo world box (x116–964, y260–468). Existing animated reel symbols, feature games, jackpot labels and buttons remain live Phaser layers, not baked pictures.

The design is a first mechanical metallic pass, NOT a photorealistic 3D cabinet render. It is intended for visual testing and review on actual Android devices before further finish passes.

Source: `games/casino/public/art/cabinet/cabinet-*.svg`. BootScene preloads as rasterized 1080×1920 SVG textures; SlotsScene adds the physical art above the older cabinet backgrounds and below moving reel/console/label elements.

Validation: run TypeScript/build/unit suite; install via a separate test save rather than live player's balance; compare all ten, especially on 360×640 dp, large tall phones, and reduced motion; inspect any misalignment of reel cutout or top box and of graphic depth. Do not merge to main without visual acceptance.

The full wardrobe/hair/jewelry creator is separate work and NOT implemented by this PR. Flattened portraits do not support arbitrary real hairstyles or clothing edits. Do not claim that they do.
