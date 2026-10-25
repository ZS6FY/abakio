# Abakio – notes for Claude Code

Abakio is an offline maths practice PWA for primary school (Gr 1–7, South African CAPS curriculum). **Afrikaans first**, English second. Live at https://zs6fy.github.io/abakio/ (GitHub Pages, branch main, root folder).

The project owner designs and tests; you write the code. The owner knows programming logic (Pascal) but not modern JavaScript – explain changes in plain words, using Pascal comparisons where it helps. Design decisions are made in a separate claude.ai project (project overview, build document, parking list, curriculum map); the task you are given is the decision – don't redesign features on your own.

## Hard rules

- **Privacy:** no server, no accounts, no tracking, no network calls except the existing `version.json` update check. Store only what the app needs, in localStorage.
- **No build step, no frameworks, no external libraries or CDNs.** Plain HTML, CSS and JavaScript ES modules.
- **All visible text lives in `lang/af.json` and `lang/en.json`** (add every key to both). Use `t('key', {n})` or `data-i18n`. Never hard-code text in JS or HTML.
- **Afrikaans:** correct Afrikaans, never Dutch. "horlosie", never "klok"; "toep", never "app". Number words use AWS spelling.
- **No gating:** every module and option stays open to every learner; grade only sets starting defaults.
- **Mistakes are calm:** amber, not red; a pause; never flashing.
- Keep changes small and focused on the task. Ask before refactoring, renaming files or adding new folders.

## Layout

```
index.html, manifest.webmanifest, sw.js, version.json
css/style.css                 one stylesheet; new sections at the end, marked with the version
lang/af.json, lang/en.json
js/app.js                     start-up, language button, update banner
js/core/                      router.js (go, rerender, onLeave), i18n.js (t), storage.js (load, save, profiles, best, stats)
js/ui/                        screens: home, add/remove learner, learner menu, trophy room;
                              info.js (ⓘ cards), pause-bar.js ("Staan reg…"), dom.js (mount, esc, formatSeconds)
js/modules/practice/          shared engine for the table modules: setup, play + results, help page, badges
js/modules/tables/            Maaltafels – questions + module config
js/modules/missing/           Ontbrekende getalle – questions + module config
js/modules/make/              Maak 'n getal – own setup, play, questions, shapes (reuses results, badges, help)
```

Conventions:
- Storage keys start with `abakio.` (added by storage.js). **Every per-learner key ends with `.<learnerId>`** so removing a learner deletes it automatically.
- A module is a config object (`id`, `title`, …); modules with their own screens pass `setup`, `play`, `bestKey` and `helpSections` (see `js/modules/make/module.js`).
- New setup screens get ⓘ cards (`infoTag`, `infoCard`, `wireInfo`) and a "Hoe werk dit?" page from the start.
- Badges live in `js/modules/practice/badges.js`; ids of a new module start with `<module>.`. Streak badges are ∞-only on purpose.
- Comments in English, short, explaining *why*.

## Testing

The owner tests with VS Code's Live Server ("Go Live"). Before saying a change is done, check the JavaScript loads without errors and the changed screen works in both languages. Say what to click through to check it.

## Release checklist (every change that goes live)

1. Bump the version in **both** `version.json` and `sw.js` (`VERSION`) – keep them the same.
2. Add any new file to `APP_SHELL` in `sw.js`, or the app breaks offline.
3. When moving or deleting files, use `git mv` / `git rm`.
4. Commit with a short message (e.g. `v0.9.0: Maak 24 solo play`) and push only when the owner says so.

## Next work (details come in the task)

Maak 24 (24 card game, solo first, then multiplayer); Leer order more random; empty-records text mentioning Speel-modus; coin wallet (generic gold coin with the amount).