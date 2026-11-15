# Claude → Claude handoff: moving Velvet Ace from the cloud session to Joshua's computer

Written 2026-11-15 by the cloud Claude Code session that built versions 1.0–1.6. You are taking
over on Joshua's own computer, with his Android phone attached over USB. Read this file first,
then `docs/ai-handoff/VELVET_ACE_AGENT_HANDOFF.md` (the shared board with ChatGPT; VA-0002 is the
open item).

## 1. Who and what
- **Owner:** Joshua (The Genetic Standard LLC).
- **Product:** **Velvet Ace Casino**, an Android-first, play-money social casino. Coins can never
  be cashed out.
- **Owner's standing rules:**
  - Don't modify PhenoGuild (his other app) or its Play developer account.
  - Don't purchase services or deploy to stores without his approval.
  - No ad dark patterns.
- **Art direction:**
  - Realistic, upscale Vegas: black/charcoal, burgundy, gold and restrained purple.
  - **No cartoon or SVG faces.** He rejected cartoon dealers and "lego" 3D busts.
  - Dealers are photo portraits he supplied, and player avatars come from his official art pack.
- **"Mimic, don't copy":** the slots take inspiration from big social casinos, but never use
  their names, machines or art.

## 2. Repository and state
- **Repo:** GitHub `genetic-standard-games`, branch `main`. Clean at commit `8732029` (1.6) or
  later; run `git pull` first.
- **Monorepo layout:**
  - `games/casino/`: the app. It also holds `games/seed-sort/` (an older, shelved puzzle game).
  - `packages/kit/`: shared helpers (`@tgs/kit`: rng, haptics, ads stub, save store, sound).
  - `art/casino/3d/`: the three.js renderer for slot symbols, worlds, logos, tables and chips.
    `node art/casino/3d/render.mjs <sets>` writes into `games/casino/public/art/`.
  - `art/casino/avatars/make_round.py`: makes the round crops of the avatar pack.
  - `assets/avatar-references/`: Joshua's art pack reference and its `CLAUDE_HANDOFF.md`.
  - `dist-apk/`: built APKs (gitignored).
- **App version:** 1.6, `versionCode 16`, in `games/casino/android/app/build.gradle`. Bump both on
  every APK you hand Joshua.

## 3. Stack
- Phaser 4.2.1, TypeScript, Vite (dev server on port 5174), Vitest and Playwright (headless
  Chromium play-test).
- Android: Capacitor 8.
  - App id: `com.thegeneticstandard.velvetace`.
  - minSdk 24, compile/target SDK 36, build-tools 35/36.
  - Built in the cloud with JDK 21 and Node 22.
- Firebase project **`velvet-ace-casino-app`**:
  - Anonymous and Google sign-in.
  - Firestore in nam5 and a Realtime Database for presence.
  - Web config in `games/casino/firebase/web-config.json`. It's public; access is controlled by
    the rules.
  - Android `google-services.json` in `games/casino/android/app/`.
  - Rules in `games/casino/firebase/` (`firestore.rules`, `database.rules.json`). Deploy with:
    ```
    cd games/casino/firebase && firebase deploy --only firestore:rules,database
    ```
  - The Firebase CLI needs `firebase login` on this computer. The cloud login doesn't carry over.
  - The duplicate project `velvet-ace-tgs` was deleted on 2026-11-15 at Joshua's request. Don't
    recreate it.

## 4. First-time setup on this computer
1. Node 22+ and Git, then `git pull` (or clone) and `npm install` at the repo root.
2. JDK 21 and the Android SDK (Android Studio, or command-line tools with platform 36 and
   build-tools 35+).
   - Set `ANDROID_HOME`.
   - `games/casino/android/local.properties` may need `sdk.dir=...` (it's not committed).
3. **ADB:** `adb devices` should list the phone. If not, the phone needs Developer options →
   USB debugging, and Joshua must accept "Allow USB debugging?" on the phone.
4. Playwright: `npx playwright install chromium`, if the play-test can't find a browser. The
   cloud image had one preinstalled.

## 5. Everyday commands (from `games/casino/` unless noted)
- **Dev server:** `npx vite --port 5174 --strictPort`. Dev hooks on `globalThis`:
  - `__go(scene, data)`, `__scene()` and `__online`;
  - per-scene hooks such as `__slots`, `__dressing`, `__cards`, `__lounge`, `__bj` and
    `__lobby`.
- **Type-check:** `npx tsc --noEmit -p .`
- **Unit tests:** `npx vitest run`. Currently 99 tests, all passing; they include slot RTP
  simulations and take about a minute.
- **Full play-test:** `node tests/e2e/playtest.mjs`. It needs the dev server running, takes
  20–30 minutes, plays every game, saves screenshots to `games/casino/screenshots/`
  (gitignored), and fails on any console error.
  - **Don't edit `src/` while it runs:** Vite reloads the page and breaks the test.
- **Build the APK:**
  ```
  rm -rf dist && npx vite build && npx cap sync android && cd android && ./gradlew assembleDebug
  ```
  Then copy `app/build/outputs/apk/debug/app-debug.apk` to `../../dist-apk/VelvetAceCasino-<ver>.apk`.
- **Install on the phone:** `adb install -r dist-apk/VelvetAceCasino-<ver>.apk`
- **Real-device evidence:**
  ```
  adb exec-out screencap -p > docs/ai-handoff/captures/<name>.png
  adb logcat -d | grep -iE "velvetace|capacitor|chromium|AndroidRuntime" > docs/ai-handoff/logs/<name>.txt
  ```
  Redact anything personal before committing.
- **Slot tuning:** `node tests/tune-pays.ts <spins> [ids]` finds `payScale` per machine (targets:
  95%, high limit 96.5%). `node tests/rtp-sim.ts` reports returns.
- **Commits:** end commit messages with the attribution lines Claude Code tells you to use, and
  push to `main`. Commit and push before you finish.

## 6. Code map (`games/casino/src/`)
- `main.ts`: game config, the scene list, the sit-down transition, dev hooks, `online.start()`
  and `migrateAvatar()`.
- `services.ts`: the save (`velvet-ace.save` in localStorage, the `SaveData` type), wallet,
  player (XP/levels/VIP), jackpot, trophies, `fmt()` and the theme.
- `online.ts`: Firebase covering profiles, usernames, presence, chat, friends, blocks, reports,
  DMs and the `photos/{uid}` avatar photo.
- `logic/`: pure, unit-tested game rules. Covers `slots.ts`, `tournament.ts`, `tricks.ts` (plus
  hearts, spades and euchre), `baccarat.ts`, `threecard.ts`, `war.ts`, `craps.ts`, `uth.ts`,
  `progression.ts` and `avatars.ts`, among others.
- `scenes/`:
  - Navigation: `Boot`, `Lobby` (four room doors plus the bottom bar) and `Room` (game tiles).
  - Games: `Slots` (cabinet layout, 5×5, pay by line, features), `Blackjack`, `Roulette`,
    `Baccarat`, `ThreeCard`, `War`, `Craps`, `Uth`, `VideoPoker`, `PokerLobby` + `Holdem` (cash,
    Sit & Go, MTT) and `CardGame` (Euchre/Hearts/Spades).
  - Social: `Lounge` (chat, friends, DMs, player card) and `DressingRoom` (avatars).
- `ui/`:
  - Shared UI: `common.ts` (`frame`/`backdrop`/`makeButton`/`text`/`coinBar`…) and `tiles.ts`
    (room tiles).
  - Avatars: `avatar.ts` (picture modes, migration, photo crop editor, texture resolver).
  - Tables: `dealer.ts` (photo dealers with personality lines) and `tablekit.ts` (bet board,
    chips).
  - Effects and panels: `bigwin.ts`, `progress.ts` (profile and missions panels) and `fourSix.ts`
    (Euchre's 4-and-6 score).
- `data/avatar_manifest.json`: the art pack's manifest (presets `avatar_01`–`avatar_16`).
- Docs: `games/casino/AVATARS.md` (the avatar system) and the root `README.md` (the game rules
  table).

## 7. Things learned the hard way
- **The design world is 1080×1920** (`Scale.EXPAND`), and taller phones extend vertically. Use
  `frame(scene)` for `top`/`bottom`.
- **`backdrop()` must use the `'__BASE'` frame**, because cropped frames change a texture's
  default frame.
- **Phaser 4 quirks:**
  - A tween on a Graphics layer's `alpha` hid it at once (the slot line flash); use a timer
    instead.
  - `strokePoints` dropped runs of straight collinear points, so draw paylines segment by segment.
  - Creating canvas or base64 textures mid-game corrupted other textures (Euchre's 4-and-6 cards),
    so draw those as vector Graphics. The `av-you` canvas texture is redrawn in place and is fine.
- **File pickers only open from a real tap.** `photoInputOver()` puts a transparent
  `<input type=file>` over the button. Playwright can't click it, so tests use `setInputFiles`.
- **Don't return Phaser objects from `page.evaluate`.** `__go` returns void because Playwright
  once tried to serialise the whole scene plugin and crashed (over 512 MB).
- **Scripted slot spins in tests must be rigged** with `__slots.rig(__slots.plainRows())`,
  otherwise a natural bonus game waits for taps and the test times out.
- **Avatar values:**
  - Profiles and chat messages carry only a preset id; photos live in `photos/{uid}` behind the
    rules (visibility `everyone` or `friends`).
  - `presetOfValue()` also accepts the 1.5 keys (`av-jasmine`).
  - Version 1.5 clients' profile writes are refused by the new rules, so everyone should update.
- **Firestore test data:** when testing online, use names starting with `AvTest` and delete them
  afterwards: profiles, usernames, friends, photos, messages, friend requests and RTDB
  `status/{uid}`. Only Joshua's own profile (Jay420) should remain.

## 8. Open work, in Joshua's priority order as last discussed
1. **Device verification of 1.6** (VA-0001/VA-0002):
   - Install over ADB.
   - Capture real screenshots (lobby, avatar selection, Dressing Room, photo upload, a slot,
     blackjack) and logcat.
   - Check tap targets and slot reel legibility on his phone.
   - Record results as a new queue entry in `VELVET_ACE_AGENT_HANDOFF.md`, marking what was
     actually device-tested.
2. **Act on ChatGPT's reply to VA-0002** when Joshua brings it. Likely asks:
   - avatar UI critique;
   - clean crops of Natalie and Viktor (their pack portraits include a frame strip);
   - slot layout tweaks;
   - a Lucky Sevens top-box image.
3. **Ideas raised but not started** (ask Joshua before starting):
   - Google sign-in linking.
   - Shared real-time multiplayer tables (needs the Blaze plan for server logic; ask before
     enabling billing).
   - Casino floor view, daily streaks and events.
   - Cosmetic avatar variants, only with real variation art in the manifest.
   - Automatic photo moderation (Cloud Vision, needs Blaze).
   - A release-signed build, privacy policy, Play age rating and the gambling-simulation policy
     review.

## 9. Known limitations to keep honest about
- The avatar portraits are 192×240, so they're soft when enlarged.
- There is no automatic photo screening; moderation is reports and blocks.
- All opponents are computer players. There are no shared tables yet.
- The web build can't reach Firebase from inside the Claude artifact (sandbox CSP).
- Nothing had been tested on a real phone before this session.
