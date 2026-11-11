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
npm test             # unit tests: conveyor rules, seed packs, ad-frequency policy
npm run typecheck
npm run build        # production web build -> games/seed-sort/dist
npm run playtest     # automated browser play-test (needs `npm run dev` running)
```

## Seed Sort: how it plays (Conveyor Sort)

Seeds roll along a greenhouse conveyor belt over a row of wooden crates. **Tap a seed when it's
over the crate with its picture** and it drops in. Wrong crate, or a seed that rolls off the end,
costs a leaf (3 per level). Streaks multiply points (x2 at 5 in a row, up to x5).

- **Specials:** golden seeds score big anywhere; weeds can be plucked for a bonus; rocks must be
  left alone (tapping one costs a leaf).
- **Ramp:** 3 crates → 4 (level 4) → 5 (level 13); belt speed and spawn rate rise; rocks from
  level 4, weeds from 6, crates that move around from level 10. Crates glow under a matching seed
  for the first 5 levels.
- **Rewards:** 1–3 stars by leaves lost; every newly cleared level opens a seed pack for the
  garden (33 plant varieties that grow as you collect copies).
- **Rewarded ad placement:** "Keep going (+1 leaf)" when you run out, once per level.

Code: rules in `src/logic/conveyor.ts` (pure, unit-tested), screen in `src/scenes/PlayScene.ts`.
Art is vector illustration drawn in code under `art/` (seeds, crate, greenhouse, garden scenes,
characters) and rendered with `node art/build.mjs`.

**Next:** the garden game (spend stars on tasks in the entrance garden, with characters), endless
mode, power-ups, then native app builds with real ads and analytics. See `docs/garden-game-design.md`.
