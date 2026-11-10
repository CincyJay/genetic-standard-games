# The Genetic Standard LLC: Mobile Game Technical Plan

**Prepared:** November 10, 2026 · **Status:** Draft for Joshua's approval · **Scope:** planning only. Nothing has been built, bought, deployed, or changed in PhenoGuild.

---

## 1. Development environment review

This session runs in a **temporary cloud container**. It is not Joshua's computer. The working folder was empty, so no PhenoGuild code is here and nothing in PhenoGuild was touched.

| Available here | Not available here |
|---|---|
| Node 22, npm, TypeScript tooling | Unity, Godot, Flutter |
| Java + Gradle (needed for Android builds) | Android SDK (it can be installed) |
| Docker, git, GitHub CLI | **Xcode / macOS (iOS builds need a Mac or a cloud Mac build service)** |
| Headless Chromium + Playwright (automated play-testing and screenshots) | Real phones |
| 4 CPUs, 15 GB RAM | Long-term storage. The container is deleted after the session. |

**What this means:**
- Work has to live in a **GitHub repository**. Before any code is written, a new private repo is needed (for example `genetic-standard/games`).
- Here I can write the code, run it in a browser, test it automatically, and build Android packages. **iOS builds have to run on a cloud Mac service** (GitHub Actions macOS runners or Codemagic) or on a Mac you own.
- You still need **one real Android phone and one real iPhone** to check feel, sound, haptics, and ads.

---

## 2. Recommended technology stack

### Options evaluated

| | Unity | Godot 4 | Flutter + Flame | **TypeScript + Phaser + Capacitor** |
|---|---|---|---|---|
| 2D puzzle quality | Excellent | Excellent | Very good | Very good |
| Physics (Wrecking Ball, Banana Ballistics) | Excellent | Excellent | Good (Forge2D) | Good (Matter.js / Box2D) |
| Ads and mediation SDKs | Best (official AdMob, AppLovin MAX, LevelPlay) | Weak (community plugins) | Good (official Google Mobile Ads) | Good (AdMob plugin); MAX needs a small native bridge |
| Works well with AI-written code | Poor (binary scenes, heavy editor) | Good (text scene files) | Very good | **Excellent (all plain text)** |
| Build and test in this cloud session | No | Partly | Partly | **Yes, fully, including automated play-tests** |
| Same build runs as a web game for free testing | Weak | Fair | Fair | **Native strength (itch.io, CrazyGames, Poki)** |
| Cost | Free under $200k revenue | Free | Free | Free |
| Low-end Android performance | Best | Very good | Very good | Good for 2D puzzles; weaker for heavy physics |

### Recommendation: **TypeScript + Phaser 3 + Capacitor**, with Firebase and AdMob

The deciding factor is the business model, which is many small games built quickly by a solo owner working with AI. With this stack:
1. **Everything is code.** I can build, run, test, and fix whole games without an editor GUI, so your time per game stays low.
2. **The same build ships to the web first.** Each game can soft-launch on web portals for free to measure retention before any store or ad spend (see section 9).
3. **Capacitor** wraps that build into real Android and iOS apps with access to native ad, purchase, and analytics SDKs.

**Supporting services:**
| Need | Choice | Cost |
|---|---|---|
| Analytics + A/B testing + live tuning | Firebase Analytics + Remote Config | Free |
| Crash reporting | Firebase Crashlytics | Free |
| Ads | Google AdMob first (rewarded + interstitial), with Google UMP consent. Add AppLovin MAX mediation once a game has traction. | Free (revenue share) |
| In-app purchases ("Remove Ads", cosmetics) | RevenueCat | Free under $2.5k/mo, then 1% |
| Leaderboards | Google Play Games / Apple Game Center via a Capacitor plugin, only where useful | Free |
| Builds and releases | GitHub Actions (Android) + Codemagic or GitHub macOS runners (iOS), fastlane for store uploads | Free tiers are enough to start |

**Known risks, stated up front:**
- **Heavy physics games** (Wrecking Ball Mayhem) may run poorly on cheap Android phones inside a WebView. We'll profile a prototype on a low-end phone before committing. If it struggles, that one game can move to Godot. The game design, levels, and business setup still carry over.
- **AppLovin MAX** has no well-maintained Capacitor plugin. Adding it later means about 2–3 days of native bridge work. AdMob alone is fine for launch.

---

## 3. How much can be reused across games

Plan for a shared **"studio kit"** package in one repository. Each game is a thin project on top of it.

| Shared kit (built once, about 60–70% of each game's code) | Per-game (about 30–40%) |
|---|---|
| Boot/splash, main menu, settings, pause, level select | Core mechanic and rules |
| Theme system (colors, fonts, button styles) | Level generator + solver |
| Tween/animation helpers, particle "juice" presets, screen shake | Art theme, icon, store art |
| Audio manager (music, SFX, mute, ducking during ads), haptics | Game-specific power-ups |
| Save system (local + cloud backup), versioned migrations | Tuning values |
| Ads service (rewarded/interstitial, frequency caps, cooldowns, no-ads flag) | |
| Consent (GDPR/UMP, Apple ATT), privacy links | |
| Analytics event schema (same events in every game, so games can be compared) | |
| Remote Config (live tuning of ad frequency and difficulty without an app update) | |
| IAP service ("Remove Ads", restore purchases) | |
| Daily reward, streaks, rate-this-app prompt, tutorial overlay | |
| Build/release pipeline, store-listing templates, privacy policy template | |

**Realistic speed:** game #1 takes about 4–6 weeks because the kit is being built alongside it. After that, a **simple puzzle game takes about 1–3 weeks** to reach testable. Physics games take longer.

---

## 4. Three sorting-puzzle concepts

> All three use common genre mechanics. None copies a specific existing game's name, art, or levels.

### Concept A: "Stack Sort" (classic tube sort, made more polished)
Colored blocks sit in tubes. Tap a tube, then tap another to move the top block, which can only land on the same color or in an empty tube. A level is solved when each tube holds one color.
- **Twists that unlock over time:** hidden "?" blocks that reveal when uncovered, locked tubes (opened by finishing another tube), move limits on challenge levels, ice blocks that need two moves.
- **Rewarded ads:** undo ×3, add an extra empty tube, hint.
- **Levels:** generated by computer and checked by a solver, so the supply is effectively unlimited and every level is guaranteed solvable.

### Concept B: "Seed Sort" (sorting with a garden that grows) ⭐
The same proven tube-sort core, but the pieces are **colorful seeds sorted into seed packets or pots**. Each solved level **grows a plant in your personal garden**: stems, leaves, blooms, rare color variants. Players collect varieties and fill a garden book.
- **Why it stands out:** the garden collection gives players a reason to return (completion, collecting rare varieties, a growing visual reward). Most sort games only offer "Level 247."
- **Brand fit:** a botanical, breeding-flavored theme that fits The Genetic Standard. It stays **completely generic (flowers, vegetables, fruit)**, so there are no app store or ad-network problems. Cannabis content would limit ad demand and store placement.
- **Rewarded ads:** same as A, plus "double garden growth" and "reveal rare seed."
- **Future upgrade path:** a light "cross two plants for a new color" breeding mini-feature, but only if retention data says players care about the garden.

### Concept C: "Hex Stack" (endless stacking, Block Blast style)
Place stacks of colored hex tiles on a honeycomb board. Matching top colors on neighboring stacks slide together, and 10 of one color clears with a satisfying burst. The game ends when the board fills. Endless and score-driven.
- **Why it's attractive:** the endless format suits Block Blast-style replay (no level design, "one more run"), and rewarded continues are very valuable here.
- **Downside:** a crowded genre, and the feel depends heavily on high-quality chain animations.

---

## 5. Ranking

Scores run 1–5. For development difficulty, 5 means easiest.

| | Ease of development | Differentiation | Monetization | Replayability | **Total** |
|---|---|---|---|---|---|
| A. Stack Sort | 5 | 2 | 3 | 3 | 13 |
| **B. Seed Sort** | 4 | 4 | 4 | 4 | **16** |
| C. Hex Stack | 3 | 2 | 4 | 5 | 14 |

## 6. Recommended first game: **Seed Sort (B)**

- It is A's core mechanic, the simplest and most proven, plus a cheap but distinctive theme and meta layer. Engineering risk stays low and there's still a real reason to choose it over the many plain sort games.
- **Built to be cut back if needed:** if time is short, ship the garden as a simple gallery and expand it after launch.
- It builds about 80% of the shared kit, and Concept C becomes a fast **game #2** on top of that kit.

---

## 7. 30-day roadmap (game #1)

| Week | Deliverables | How we verify it |
|---|---|---|
| **1: Core** | Repo + shared kit skeleton. Seed Sort mechanic. Level generator + solver with difficulty grading. Playable in a browser. | Automated tests confirm every generated level is solvable. You play it on your phone through a web link. |
| **2: Feel** | Animations (lift, arc, drop, squash), particles, sound effects, haptics. Tutorial for the first 3 levels. Save/progress. 200+ graded levels. Garden v1. | You and 3–5 friends play it. We watch where they hesitate or quit. |
| **3: Native + business plumbing** | Android and iOS builds via Capacitor. Firebase Analytics + Crashlytics. AdMob **test** ads + consent. "Remove Ads" purchase (sandbox). Remote Config for ad timing and difficulty. | Test builds on a real Android phone and iPhone. Analytics events visible in Firebase. |
| **4: Release prep** | Performance pass on a cheap Android phone. Store icon, screenshots, descriptions. Privacy policy + support page. Upload to Play internal testing and TestFlight. Web soft launch. | First real retention numbers from web players. Build accepted into both test tracks. |

**Honest caveat:** store **publishing** depends on developer accounts, and those depend on the LLC, EIN, and D-U-N-S number (section 8). The game itself can be ready in 30 days. Public store release will probably happen in **month 2**, which fits your Phase 2.

---

## 8. Costs, dependencies, and publishing requirements

### Business setup, in order (start the D-U-N-S request right away because it takes the longest)
1. Ohio LLC approval (pending).
2. **EIN** from the IRS: free, online, same day.
3. **Business bank account** under the LLC. Store and ad payouts go here.
4. **D-U-N-S number** for The Genetic Standard LLC: free from Dun & Bradstreet. **Both Apple and Google require it for organization accounts.** Allow 1–4 weeks.
5. **Domain + simple website** (for example `thegeneticstandard.com`) with a privacy policy, support contact, and an **`app-ads.txt`** file. AdMob checks `app-ads.txt` on the developer website, and missing it reduces ad revenue.
6. **Google Play Console, organization account.** It shows "The Genetic Standard LLC" as the publisher. *This is a new account, separate from PhenoGuild's existing account, which stays untouched.* Organization accounts skip the "12 testers for 14 days" closed-test rule that applies to new personal accounts.
7. **Apple Developer Program, organization.** Apple verifies the LLC by phone. Then enroll in the **App Store Small Business Program** (15% commission instead of 30%).
8. **AdMob account** under the LLC, with tax info (W-9) completed.
9. Tax and banking setup inside App Store Connect and Play Console.

### Costs (first year)
| Item | Cost | Required? |
|---|---|---|
| Apple Developer Program | $99/yr | Yes (iOS) |
| Google Play Console | $25 one-time | Yes |
| Domain | ~$12–20/yr | Yes |
| Website hosting (GitHub Pages / Cloudflare Pages) | $0 | Yes |
| Firebase, AdMob, RevenueCat, GitHub | $0 at this scale | Yes |
| iOS cloud builds (Codemagic / GitHub macOS) | $0 on free tiers; ~$0–50/mo if heavy | Yes, unless you own a Mac |
| Cheap Android test phone (low-end performance check) | ~$100–150 | Strongly recommended |
| iPhone for testing | $0 if you own one | Strongly recommended |
| Sound effects / fonts | $0 (CC0/free libraries) – $100 | Optional |
| Used Mac mini (M1 or newer) | ~$400–600 | Optional; makes iOS debugging much easier |
| Paid user-acquisition **tests** (section 9) | ~$300–750 per game, **only after** organic numbers pass | Later, with approval |
| **Minimum to launch on both stores** | **~$140** + test phone | |

### Compliance checklist (applies to every game)
- **Audience:** set the target age to 13+ or 18+ and **do not** opt into Google's "Designed for Families." Ads aimed at children carry strict rules (COPPA, certified ad networks only).
- **Consent:** Google UMP consent message (EU/UK), Apple App Tracking Transparency prompt.
- **Store forms:** Google Play Data Safety form, Apple privacy "nutrition label," content rating questionnaires.
- **Ad policy:** no ads placed near tap targets, no surprise interstitials during play, rewarded ads only when the player chooses them, clear "close" buttons. (You asked for this explicitly, and it also protects the AdMob account.)

---

## 9. Testing gameplay and retention before spending on ads

This is a **staged funnel with go/no-go gates**. Money is spent only after free signals are good.

| Stage | Cost | What we learn | Gate to continue |
|---|---|---|---|
| **1. Watch people play** (5–10 friends, family, coworkers, in person or on video) | $0 | Do they understand it without help? Where do they get stuck or bored? | Most players get through the tutorial unaided and want to keep playing |
| **2. Web soft launch** (itch.io + CrazyGames/Poki developer programs) | $0 | Real strangers: session length, levels per session, return visits | Average session ≥ 8–10 min, clear return visits |
| **3. Store test tracks** (Play open testing, TestFlight public link) | $0 | Crashes, device performance, ad and consent flow | Crash-free users ≥ 99.5% |
| **4. Small soft launch** (Play Store in 1–3 lower-cost countries, e.g. Philippines, Canada, Australia) | $0–$300 | D1/D7 retention, ad impressions per user, ARPDAU | **D1 ≥ 35%, D7 ≥ 10%** (rough casual-puzzle benchmarks) |
| **5. Paid install test** (Google App Campaigns or Meta, ~$300–750) | Needs your approval | Cost per install vs. revenue per user (LTV) | Projected LTV > CPI with margin → scale. Otherwise improve or stop. |

**Tuning tools:** Firebase Remote Config + A/B testing lets us change difficulty, ad frequency, and rewards **without shipping an update**, and compare versions on real players.

**Event schema (the same in every game, so games can be compared):** `level_start`, `level_complete`, `level_fail`, `session_start`, `ad_offer_shown`, `ad_rewarded_complete`, `ad_interstitial_shown`, `iap_purchase`, `tutorial_step`. These events supply every metric in your list: DAU, D1/D7/D30, session length, impressions per user, eCPM (from AdMob), ARPDAU, CPI, LTV, and crash rate.

---

## 10. Revenue reality check (so the targets stay grounded)

- Ad revenue per daily player (ARPDAU) for casual puzzle games roughly runs **$0.02–0.05 globally** and **$0.08–0.20 for US-heavy audiences**.
- **$15,000/month ≈ $500/day.** That takes roughly **3,000–6,000 daily players in strong-paying countries, or 10,000–25,000 globally**, across the whole portfolio.
- That is achievable for a small portfolio, but **most games will not get there on organic downloads alone**. The usual pattern is that most games stall, one or two hit, and those get improved and promoted. The plan is built around that pattern: cheap experiments, hard data gates, and investment only in winners.

---

## 11. Decisions needed from Joshua

1. **Approve the stack:** TypeScript + Phaser + Capacitor + Firebase + AdMob.
2. **Approve the first game:** Seed Sort (Concept B), with Hex Stack (C) as game #2.
3. **Create a private GitHub repo** for the games (or authorize me to create one under your account or a new org). Without it, work in this cloud session is lost when the session ends.
4. **Start the account chain now:** EIN → bank account → D-U-N-S → domain. All of these are your actions, and none of them depend on me.
5. **Testing hardware:** confirm you have an iPhone, and whether you'll get a low-cost Android phone.
6. **Mac question:** use cloud iOS builds (free, slower to debug) or buy a used Mac mini.

Once items 1–3 are approved, Week 1 of the roadmap can start immediately.

---

### Notes on the other two game ideas
- **Wrecking Ball Mayhem:** good game #3 or #4. Prototype the physics on a cheap Android phone first (see the risk in section 2).
- **Banana Ballistics:** the artillery genre is open to use, but give it **original characters, name, and art** rather than recreating Gorillas or Scorched Earth directly. Turn-based play vs. AI suits short sessions. Online multiplayer adds servers and maintenance, which works against the low-maintenance goal, so leave it until the game proves itself.
