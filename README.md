# The Genetic Standard — Games

Mobile puzzle games by **The Genetic Standard LLC**, built on a shared "studio kit"
so each new game reuses menus, saving, sound, ads, analytics and build tooling.

| Path | What it is |
|---|---|
| `games/casino/` | **Velvet Ace Casino**: play-money slots, blackjack, Texas hold'em, video poker, roulette |
| `packages/kit/` | Shared studio kit (save, synthesized audio, haptics, analytics schema, ad policy, UI buttons) |
| `games/seed-sort/` | Seed Sort (shelved): conveyor sorting game |
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

## Velvet Ace Casino

Play-money social casino: **coins can never be cashed out or exchanged for anything of value.**
Players start with 10,000 coins, collect a free bonus every 2 hours (grows with daily streaks),
and can watch a rewarded video for 1,000 coins. Rated for adults (17+ / Mature) in the stores.

| Game | Rules (in `games/casino/src/logic/`, all unit-tested) |
|---|---|
| Slots "Lucky Sevens" | 5x3, 20 lines, wilds, scatter free spins with 3x wins; ~95% return verified by 1M-spin simulation (`tests/rtp-sim.ts`) |
| Blackjack | 6 decks, dealer stands on all 17s, 3:2 blackjack, double, split, dealer peek |
| Texas Hold'em | No-limit, 6 seats vs computer players with personalities; side pots, split pots; buy-in tables at 3 stakes |
| Video Poker | Jacks or Better, full-pay 9/6 table, 1-5 coins, 5 denominations |
| Roulette | European single zero: straight, red/black, odd/even, low/high, dozens, columns |

Shuffles use the browser's cryptographic random generator. Art (52-card deck, chips, slot
symbols, felts) is drawn in code: `python3 art/casino/cards.py && python3 art/casino/slots.py &&
python3 art/casino/backgrounds.py && node art/casino/build.mjs`.

```bash
npm run dev:casino                     # http://localhost:5174 (vite picks the port)
node games/casino/tests/e2e/playtest.mjs http://localhost:5174/   # plays every game
```

**Before launch:** a short consult with a gaming lawyer (social casino rules vary by state;
Washington in particular), store age ratings, and geo-restrictions where needed.

## Seed Sort (shelved): how it plays (Conveyor Sort)

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
