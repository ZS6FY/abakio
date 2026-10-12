# Abakio

A small offline maths practice app (PWA) for primary school learners, following the South African CAPS curriculum. Afrikaans first; English to follow.

## Principles

- Runs fully offline once installed.
- No accounts, no server, no tracking. All progress stays on the device.
- Stores only what the app needs to work (a learner's first name and grade).

## Running locally

Open the folder in VS Code and click **Go Live** (Live Server extension) in the status bar.

## Releasing an update

1. Bump the version number in both `version.json` and `sw.js` (keep them the same).
2. If you added new files, add them to the `APP_SHELL` list in `sw.js`.
3. Commit and push.
