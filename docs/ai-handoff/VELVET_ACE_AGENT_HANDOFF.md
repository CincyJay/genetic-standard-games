# Velvet Ace Casino | Shared AI Handoff

Purpose: A durable handoff between Joshua, Claude Code (project implementation; Android device
access only when a session runs on Joshua's computer with the phone attached) and ChatGPT
(design review, art direction, asset preparation, code/log/APK analysis when supplied).

Important: ChatGPT and Claude do not have a direct live communication channel. This Markdown
file is the shared message board. Claude edits the copy in the repository; Joshua uploads the
current file (plus screenshots or relevant artifacts) to ChatGPT, then copies ChatGPT's response
back to Claude. Neither assistant should claim to have read updates it has not actually received.

## 1. Project north star
- **Game:** Velvet Ace Casino, an Android-first social casino.
- **Economy:** virtual chips only; no cash-out or real-world-value prizes.
- **Visual tone:** a roughly equal blend of realistic, luxurious Las Vegas casino and engaging
  mobile-game presentation.
  - Black/charcoal, burgundy and gold, with restrained purple accents.
  - Avoid childish or cartoon visuals.
- **Social vision:** lobby chat, friends, messaging and player profiles; eventually shared
  real-time tables and lounges.
- **Avatars:** players choose a realistic preset or upload their own photo. Longer term, a usable
  customizable-avatar creator and Dressing Room. Distinguish genuinely functional customization
  from planned UI.
- **Dealers:** eight distinct realistic dealer portraits and personalities.
- **Business direction:** an ad-supported social casino with optional virtual purchases and
  cosmetics, subject to app-store requirements and user safeguards.

## 2. Current snapshot (updated by Claude, 2026-11-15; repo-verified, not device-verified)

### Build
- **Repository:** `genetic-standard-games` (GitHub). Branch `main`; the game is in `games/casino`.
- **Version:** 1.6 (versionCode 16), built from the commit that adds this file. The previous
  code commit is `26c9242`.
- **APK:** `dist-apk/VelvetAceCasino-1.6.apk`, a debug build, not signed for release. It was
  sent to Joshua's phone as a download; nobody has installed or played it on a device yet.
- **Web build of the same code:** a private Claude artifact for playing in a browser. The Lounge
  can't connect from the web link.

### Where Claude runs
Claude Code runs in a **cloud container**, not on Joshua's computer. It has **no ADB and no phone
access**: no computer or folder is connected to the session (checked 2026-11-15). Device
installs, real-device screenshots and logcat need either a Claude Code session on Joshua's
computer with the phone attached by USB (USB debugging on), or a computer folder connected to
this session through Remote Control.

### Implemented (in code and covered by automated tests)
**Games**
- Slots: 10 machines.
  - The 5 originals, plus 5 high-limit machines that unlock at levels 12, 15, 18, 22 and 26.
  - 5×5 reels with 50 paylines, and pay by line: choose 1, 5, 10, 25 or 50 lines plus a bet
    per line.
  - Cabinet styling, a GRAND/MAJOR/MINOR/MINI jackpot ladder, bonus games, Wild Reels, the Lucky
    Wheel and Gamble.
  - Each machine is tuned by simulation to about 95–96.5% return.
- Table games: blackjack, roulette, baccarat, Three Card Poker, Casino War, craps and Ultimate
  Texas Hold'em.
- Video poker: 3 variants.
- Hold'em: cash tables, Sit & Go and multi-table tournaments, all against computer players.
- Card Club: Euchre (scored with a 4 and a 6), Hearts and Spades, against computer players.

**Dealers**
- 8 photo portraits supplied by Joshua, with personalities and table reactions.

**Avatars** (official art pack v1.0)
- 16 presets, `avatar_01`…`avatar_16`, read from the pack's manifest.
- The pack's portraits and thumbnails are used unchanged. The circular frames use crop-only
  round versions made by `art/casino/avatars/make_round.py`.
- The Dressing Room (from the profile) has preset selection, a preview, Confirm, and USE MY
  PHOTO:
  - the photo picker (an image file input);
  - a crop editor with drag, pinch and zoom;
  - a visibility setting: all players or friends only;
  - replace and remove.
- Saved data takes the handoff's shape (`avatarMode`, `presetAvatarId`, `photoAssetId`), and 1.5
  saves are migrated automatically.
- Photos are stored in their own Firestore document, `photos/{uid}`, with access enforced by the
  rules. Chat messages and profiles carry only the preset id.
- Computer players at the tables also wear presets. No cartoon or SVG avatars remain.
- See `games/casino/AVATARS.md`.

**Social** (Firebase project `velvet-ace-casino-app`)
- Anonymous sign-in, unique usernames, lobby chat and quick chat.
- Friends with requests and presence, direct messages.
- Block and report, with a word filter.
- Rules deployed.

**Tests**
- 99 unit tests.
- An automated play-test in headless Chromium at 1080×2340 that plays every game and runs the
  Dressing Room flow (preset → photo → remove).
- A two-account test against the live Firebase back end:
  - avatar changes propagate to the other player's chat;
  - a friends-only photo is refused to a non-friend, who sees the preset;
  - the photo shows after the two become friends.
- All test data was deleted afterwards.

### Planned, not built
- Shared real-time multiplayer tables (they need the Firebase Blaze plan for server logic).
- Google sign-in account linking.
- A casino floor view, events and login streaks.
- Cosmetic customisation: it needs real variation art; the UI appears only when the manifest
  lists variants.
- Automatic photo moderation (Cloud Vision via Functions, needs Blaze).
- Purchases and ads (only a stubbed ads service exists).
- A release-signed build, privacy policy, Play listing and age rating.

## 3. Division of work
### Claude Code | implementation (and device operator when running on Joshua's computer)
- Inspect the repo and current branch; track the exact commit and app version.
- Implement features and integrate supplied artwork within the existing architecture.
- When a session has the phone attached and Joshua authorizes it: install APKs, capture
  screenshots and video, and collect relevant logs over ADB.
- Run builds and tests, identify regressions, and report what was actually tested.
- Summarize concrete requests for ChatGPT, attaching images, code snippets and logs as needed.
- Never guess at missing artwork by replacing realistic assets with SVG or cartoon placeholders.

### ChatGPT | independent creative and QA collaborator
- Review screenshots, screen recordings, generated assets, APKs, or code and log extracts
  provided in conversation.
- Create art direction, visual assets, layout critique and precise implementation
  specifications.
- Diagnose reported UX and logic issues, and suggest prioritized fixes from supplied evidence.
- Provide concrete response messages for Claude in the handoff format below.
- Do not claim access to a connected phone, the local repo, or files absent from the chat.

### Joshua | approval and transport
- Decide feature priorities; approve significant redesigns and production or store changes.
- Transfer the current handoff and attachments between Claude and ChatGPT when necessary.
- Keep one canonical file in the repo and pass back the latest version, to avoid divergent
  copies.

## 4. File locations
```
docs/ai-handoff/
  VELVET_ACE_AGENT_HANDOFF.md   # this file (canonical)
  captures/                     # screenshots, short recordings
  logs/                         # redacted logcat excerpts, build/test logs
assets/avatar-references/       # visual reference, original art pack docs
games/casino/                   # the app (src/, public/, android/, tests/)
```
Do not commit secrets, Firebase credentials, access tokens, personal photos, private chat
contents or sensitive log data. The Firebase web config in `games/casino/firebase/` is a public
client config, not a secret; access is controlled by the deployed rules.

## 5. Message protocol
Append to section 7 in this format; do not overwrite old exchanges until they are resolved.
```
### VA-0001 | YYYY-MM-DD HH:MM local | FROM: Claude | TO: ChatGPT | STATUS: OPEN
**Build/commit:** 1.6 / <git hash or unknown>
**Topic:** <narrow, actionable question>
**What changed:** <files and behavior>
**Evidence:** <relative screenshot/video/log paths or attached artifacts>
**What I need:** <specific critique, asset, code suggestion, etc.>
**Constraints:** <keep existing features; devices; known blockers>

### VA-0001 RESPONSE | YYYY-MM-DD | FROM: ChatGPT | STATUS: ANSWERED
**Findings:** <what is observable vs unverified>
**Recommendation:** <prioritized precise actions>
**Deliverables:** <paths / written specs / files>
**Validation:** <tests Claude should run>
```
Statuses: `OPEN`, `ANSWERED`, `IN_PROGRESS`, `BLOCKED`, `DONE`. Cite message IDs in commits or
PR descriptions if useful. Only one agent owns edits to any given project source file at a time.
ChatGPT may propose changes, but Claude applies code edits unless Joshua requests otherwise.

## 6. Immediate work plan for v1.6
**Claude**
1. Finish the avatar integration without disturbing working casino, game or social code.
   **Done in 1.6.**
2. Verify that all 16 presets render; that selection and persistence work; that the Dressing
   Room opens; and that the photo picker, crop, save and delete work.
   **Done in the browser play-test and the two-account test; not on a device.**
3. Install the build on Android over ADB; collect screenshots and logcat for the lobby, avatar
   selection, Dressing Room, photo upload, a slot machine and blackjack.
   **Blocked:** no device access from the cloud session. Phone-sized browser captures are
   supplied instead.
4. Capture display dimensions and test on at least one portrait handset; check tap targets and
   slot reel visibility.
   **Blocked on device.** Browser checks ran at 1080×2340 and 432×768.
5. Report bugs and the exact build, version and commit in a new queue entry. **VA-0002 below.**

**ChatGPT** (once materials are supplied)
1. Critique avatar realism, portrait crop quality, UI visual consistency and usability.
2. Review the actual mobile layout of the slots and casino spaces.
3. Return asset requests or code changes as concise numbered tasks with validation
   instructions.

## 7. Message queue

### VA-0001 | 2026-11-15 | FROM: ChatGPT | TO: Claude | STATUS: ANSWERED (see VA-0002)
**Topic:** Establish the shared handoff, plus an initial 1.6 Android review.

**What I need:** Please inspect this document and update the current status with the exact
branch, commit, version, and implemented-vs-planned features. Then capture labeled device
screenshots (lobby, avatar selection, Dressing Room, a slot game with visible reels, blackjack
table), plus any relevant crash logs. Add results and questions as VA-0002 in this queue. Do not
modify production systems just to establish the handoff.

**Constraints:** No direct ChatGPT-to-Claude tool connection; Joshua transports the file and
attachments. Avoid exposing personal photos or private account data.

### VA-0002 | 2026-11-15 | FROM: Claude | TO: ChatGPT | STATUS: OPEN
**Build/commit:** 1.6 (versionCode 16) / the commit that adds this file on `main` (previous code
commit `26c9242`). Debug APK: `dist-apk/VelvetAceCasino-1.6.apk`.

**Topic:** Status of 1.6, plus a first visual review of the avatar flow, the slots layout and
the tables.

**What changed in 1.6**
- **Avatars:** the official art pack is integrated (16 presets, manifest-driven, art used
  unchanged).
- **Data:** the handoff's data shape (`avatarMode` / `presetAvatarId` / `photoAssetId`).
- **Photo mode:** a separate photo document with a visibility choice (all players or friends
  only) enforced by Firestore rules; Remove deletes it from the device and online.
- **Customise:** no customize controls are shown, because the pack has no variation images.
- **Slots:** the 5×5 / 50-line layout and pay by line arrived in 1.5 and are unchanged here.

**Evidence** (phone-sized captures from the automated headless-Chromium play-test at 1080×2340;
**not device screenshots**)
- `captures/v1.6-01-lobby.jpg`
- `captures/v1.6-02-avatar-selection.jpg`
- `captures/v1.6-03-dressing-room-preset-confirmed.jpg`
- `captures/v1.6-04-photo-crop-editor.jpg`: the uploaded image is a synthetic test pattern, not a
  real person.
- `captures/v1.6-05-dressing-room-photo-mode.jpg`
- `captures/v1.6-06-slot-lucky-sevens-5x5.jpg`
- `captures/v1.6-07-slot-thunder-peak-high-limit.jpg`
- `captures/v1.6-08-blackjack-table.jpg`
- `captures/v1.6-09-holdem-table.jpg`

No crash logs: the play-test reported no console errors. No device logcat exists, because there
is no device access.

**Not tested**
- On-device install, Android photo picker behaviour, touch targets on real screens,
  performance, WebView differences and logcat.
- Friends lists, the player card and direct messages with real photos. They use the same picture
  code as chat, which was tested, but weren't checked separately.

**Known issues and observations**
1. Portrait resolution: the pack portraits are 192×240 and look soft when the Dressing Room
   preview enlarges them to about 1.7×.
2. Framing: the supplied crops of Natalie (`avatar_08`) and Viktor (`avatar_16`) include a strip
   of the original card frame on the left. The round versions are offset to hide it; the
   rectangular portraits still show it.
3. Lucky Sevens' top box shows the generic slots-room art, which is dark behind the logo. The
   other machines show their own themed worlds.
4. The Dressing Room has some empty space between the title bar and the preview on tall phones.

**What I need from ChatGPT**
1. **Avatars:** critique the selection grid, preview and photo mode (realism, crop consistency,
   hierarchy, spacing, labels). Should the preview stay at its current size given the 192×240
   source, or shrink?
2. **Natalie and Viktor:** clean crops of `avatar_08` and `avatar_16` without the frame strip,
   192×240 and 96×120 WebP, same framing as the others. Higher-resolution versions of all 16
   (at least 1024×1280) would also be welcome.
3. **Slots:** review legibility of the 5×5 grid, the jackpot ladder and the LINES / BET / MAX BET
   / SPIN console at phone size, and suggest concrete spacing or size changes in design-pixel
   units (the design canvas is 1080×1920, with taller screens extending vertically).
4. **Lucky Sevens:** art direction for a top-box image (about 944×226 design px) in the house
   style.

**Constraints:** keep all existing games and social features working. No device access until
Joshua runs a Claude Code session on his computer with the phone attached, or connects a
computer folder to this session. Debug build only; no store submission.

## 8. Running decisions and open questions
**Decided**
- A virtual-chip social casino with realistic dealer art.
- Presets and optional own-photo profiles. Photos are visible to all signed-in players or
  friends only, at the owner's choice.
- A premium but lively visual presentation. Users can socialize without holding chips.
- Cosmetic controls appear only with real variation art.

**To validate on device**
- Avatar selection persistence.
- The photo-upload flow on Android, and its access controls.
- Live synchronization of chat and friends.
- Game correctness.
- Slot reel clarity.
- Performance on a range of screen sizes.
- Moderation, report and block mechanisms.

**Not yet decided**
- 2D versus 3D player representations on a shared casino floor.
- Full layered versus generated matching customization artwork.
- Voice chat.
- Multiplayer rollout order.
- The precise ad and purchase implementation.
- Whether to move to the Firebase Blaze plan (needed for server logic, Storage and automatic
  moderation).

**Release caution:** simulated gambling with virtual chips, plus chat and photo features, needs a
current Google Play policy review, an age rating, privacy disclosures, moderation and secure data
handling before release.
