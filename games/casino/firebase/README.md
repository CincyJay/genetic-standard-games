# Firebase (Velvet Ace online features)

Project: `velvet-ace-casino-app` (console: https://console.firebase.google.com/project/velvet-ace-casino-app)

- `web-config.json`: the app's public Firebase config (not a secret; access is controlled by the rules below).
- `firestore.rules`: profiles, friends, blocks, friend requests, chat rooms, direct messages, reports.
- `database.rules.json`: Realtime Database for online status and live table seats.
- Android: `../android/app/google-services.json`.

Deploy rules: `cd games/casino/firebase && firebase deploy --only firestore:rules,database`

## Dealer chat (live AI)

`functions/index.js` is the `dealerChat` callable: players tap **Talk** on the dealer at a table and chat with them in character.
The dealers' personalities live in the function; the Anthropic key is a Firebase secret and never ships in the app.

```bash
cd games/casino/firebase
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions
```

Needs the Blaze plan. Until it is deployed, the dealer answers with a scripted line instead.
