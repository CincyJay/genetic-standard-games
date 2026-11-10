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

## Week 1 status

- [x] Monorepo + shared studio kit
- [x] Core mechanic, animations, synthesized SFX, haptics, save/progress
- [x] Level generator + solver; 300 verified levels; difficulty curve with breathers/challenges
- [x] Tutorial (level 1), hint, undo, restart, stars, win celebration, sprout on finished jars
- [x] Ad-frequency policy (grace period, cooldown, Remove Ads) with tests; fake ad provider
- [x] Unit tests + automated browser play-test

**Next (Week 2):** garden meta (grown plants collection), more seed/jar polish, color-blind
patterns on seeds, settings screen, special seeds (hidden "?" seeds, locked jars), 3–5 person playtest.
