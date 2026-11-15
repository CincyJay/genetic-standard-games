# Firebase (Velvet Ace online features)

Project: `velvet-ace-casino-app` (console: https://console.firebase.google.com/project/velvet-ace-casino-app)

- `web-config.json`: the app's public Firebase config (not a secret; access is controlled by the rules below).
- `firestore.rules`: profiles, friends, blocks, friend requests, chat rooms, direct messages, reports.
- `database.rules.json`: Realtime Database for online status and live table seats.
- Android: `../android/app/google-services.json`.

Deploy rules: `cd games/casino/firebase && firebase deploy --only firestore:rules,database`
