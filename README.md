# The Genetic Standard — Games

Mobile puzzle games by **The Genetic Standard LLC**, built on a shared "studio kit"
so each new game reuses menus, saving, sound, ads, analytics and build tooling.

| Path | What it is |
|---|---|
| `packages/kit/` | Shared studio kit (save, synthesized audio, haptics, analytics schema, ad policy, UI buttons) |
| `games/seed-sort/` | **Seed Sort**: game #1 |
| `docs/technical-plan.md` | Approved strategy and technical plan |

**Stack:** TypeScript · Phaser 4 · Vite · (Week 3: Capacitor for iOS/Android, Firebase, AdMob)

## Commands

```bash
npm install          # once
npm run dev          # play in the browser at http://localhost:5173 (add --host to test on a phone on the same Wi-Fi)
npm test             # unit tests: rules, solver, all levels solvable, ad-frequency policy
npm run typecheck
npm run levels       # regenerate the level pack (deterministic)
npm run build        # production web build -> games/seed-sort/dist
npm run playtest     # automated browser play-test (needs `npm run dev` running)
```

## Seed Sort: how it works

- **Rules** (`src/logic/rules.ts`): tap a jar to lift its top run of same-colored seeds, tap
  another jar that is empty or has the same color on top. Fill every jar with one color.
- **Levels** are generated, not hand-made: `generator.ts` scrambles seeds, the solver
  (`solver.ts`, weighted A*) proves each one is solvable and grades difficulty, and the
  candidate closest to the target difficulty curve is kept. 300 levels ship pre-built
  (`src/levels/levels.json`); later levels generate on the device with the same results.
- **Par / stars:** the solver's solution length is the "target"; meet it for 3 stars.
- **Hints** run the solver from the player's current position.

## Story, seed packs and garden

**Story mode, "Larkspur Gardens"** (`src/story.ts`): you inherit your great-aunt Ivy's abandoned
botanical garden. Her seed vault was scattered by a storm, so you sort the seeds, and each chapter
of levels restores one area (Front Beds, Greenhouse, Orchard, Herb Garden, Lily Pond). The town
will sell the land to a developer unless the garden reopens for the Spring Festival. Every chapter
has an intro, a midpoint and an outro scene (Ivy's letters, Theo the groundskeeper, Mayor Bell,
Mr. Harlow the developer). Season 1 = 5 chapters, levels 1–55; levels continue after it.

**Seed packs:** every newly cleared level opens a pack with one of 33 plant varieties (flowers,
fruit, vegetables, herbs; common / uncommon / rare / legendary). Packs are deterministic per
level, lean toward undiscovered varieties, and every 10th level is uncommon or better
(`src/varieties.ts`). Copies grow the plant in the **Garden**: seedling (1), growing (3), blooming (5).

Visual style: dark navy, flat shapes, Outfit typeface (all drawn in code, no image assets).
Audience: general (all ages content, targeting 13+ in the stores to keep ad options open).

## Week 1 status

- [x] Monorepo + shared studio kit
- [x] Core mechanic, animations, synthesized SFX, haptics, save/progress
- [x] Level generator + solver; 300 verified levels; difficulty curve with breathers/challenges
- [x] Tutorial (level 1), hint, undo, restart, stars, win celebration, sprout on finished jars
- [x] Ad-frequency policy (grace period, cooldown, Remove Ads) with tests; fake ad provider
- [x] Unit tests + automated browser play-test

**Next (Week 2):** garden meta (grown plants collection), more seed/jar polish, color-blind
patterns on seeds, settings screen, special seeds (hidden "?" seeds, locked jars), 3–5 person playtest.
