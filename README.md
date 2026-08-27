# Steppi's Beer Counter

Count your drinks. Works completely offline — no account, no ads, no tracking,
no network permission at all.

Available as a PWA and as a native Android app (Capacitor), from one codebase.

## Features

- **Tap to count.** The whole drink tile is the button; a smaller minus fixes a
  miscount, and long-pressing a drink opens its editor.
- **Time since the last one.** Each drink shows how long ago you had it, so you
  don't count the same round twice — once when ordering and again when it arrives.
- **Your drinks.** Ships with beer, small beer, wine and schnapps. Add your own
  permanently, or just for tonight; session drinks disappear on reset.
- **Optional prices.** Give a drink a price and the app totals the round.
  A total that includes unpriced drinks reports as "at least X" rather than
  pretending to be the bill.
- **15 languages**, picked up from the browser/system or chosen by hand.
- **Light, dark or system theme.**
- **Reset** to start the next round.

## Requirements

| Tool | Version | Needed for |
|------|---------|------------|
| Node | 20+ (22 recommended) | everything |
| Yarn | 4 (via corepack) | everything |
| ImageMagick | 7 (`magick`) | icons, feature graphics |
| JDK | 17 or 21 (**not** 25 — AGP 8.7 rejects it) | Android build |
| Android SDK | platform 35, build-tools 35 | Android build |
| rsync + ssh | any | deploying the PWA |

Noto Sans CJK must be installed for the Japanese and Chinese feature graphics;
without it those glyphs render blank.

## Getting started

```bash
yarn install
yarn assets        # render icons from assets/icon/icon.svg
yarn dev           # http://localhost:5173
```

`./scripts/dev.sh [port]` does the same but binds to all interfaces and prints
the LAN URL, so you can open the app on a phone and tap-test it for real.

## Everyday commands

| Command | What it does |
|---------|--------------|
| `yarn dev` / `yarn dev:host` | dev server (local / LAN) |
| `yarn build` | typecheck + production build into `dist/` |
| `yarn lint` | ESLint |
| `yarn check-locales` | every locale has strings, a listing and release notes |
| `yarn assets` | icons for PWA, Play and every Android density |
| `yarn feature-graphic` | 1024×500 Play feature graphic per language |
| `yarn screenshots` | Play screenshots per language (phone + 7" tablet) |
| `yarn store-listing` | validate + export listings to `store-listing/<lang>/` |
| `yarn release-notes` | rolling `<lang>` blocks for Play Console |
| `yarn version:bump [patch\|minor\|major]` | bump version + Android versionCode |

## Versioning

`package.json` is the single source of truth:

- `version` — semver, shown in the app and used as the Android `versionName`.
- `androidVersionCode` — monotonic integer; Play rejects anything not strictly
  greater than the last upload, so it only ever moves forward.

Gradle reads both at build time, so the web app and the `.aab` can't drift apart.
`yarn deploy` bumps automatically; pass `--no-bump` to ship the current version.

## Deploying the PWA

```bash
cp .env.example .env      # set DEPLOY_HOST and DEPLOY_PATH
yarn deploy --dry-run     # preview the transfer
yarn deploy               # bump, build, rsync, commit the bump
```

The script refuses to deploy a dirty working tree, so what is live always
corresponds to a commit.

### Updates

The service worker precaches everything, so the app runs with no network at
all. It checks for a new build on launch, whenever it returns to the
foreground, and hourly; when one is ready the app offers a **Reload** rather
than swapping itself out mid-round.

## Building the Android app

```bash
yarn android:build          # release .aab for Play Console
yarn android:build apk      # release .apk to sideload
yarn android:build debug    # debug .apk
```

Artefacts land in `build-output/`.

To sign a release, copy `android/keystore.properties.example` to
`android/keystore.properties` and fill it in — both it and the keystore are
gitignored. Without it the build still succeeds, unsigned.

The application id is `de.steppicrew.beercounter`, overridable with
`ANDROID_APP_ID` in `.env`. **It is permanent once published.**

## Publishing to Play Console

`.env.example` walks through creating the service account. Then:

```bash
yarn play:publish --dry-run                  # show exactly what would change
yarn play:publish --track internal           # upload + roll out
yarn play:publish --listings-only            # metadata and images only
yarn play:publish --track production --rollout 0.1
```

One command uploads the bundle, all 15 listings, icons, feature graphics,
screenshots and release notes. Everything happens inside a single Play "edit"
that is committed only at the end — a failure part-way abandons the edit and
leaves the live listing untouched.

### Release notes

Add an entry to the top of `release-notes/CHANGELOG.json` with one line per
language. Play caps release notes at 500 characters per language, so the
renderer keeps the newest entries and drops the oldest until every language
fits — no manual pruning.

## Adding a language

1. Add it to `src/i18n/locales.ts` **and** `scripts/locales.mjs` (both are
   checked against each other).
2. Add a catalogue to `src/i18n/strings.ts` — `Messages` is derived from the
   English one, so a missing key is a type error.
3. Add a `store-listing/LISTINGS.json` entry and a note for each release.
4. `yarn check-locales && yarn store-listing --check`.

## Project layout

```
src/
  components/     UI; BeverageRow is the counting tile
  store/          Zustand store, persisted to localStorage
  i18n/           locale table + message catalogues
  lib/            types, money, totals, long-press, update hook
scripts/          build, assets, screenshots, deploy, Play publishing
store-listing/    LISTINGS.json (source) + exported per-language files
release-notes/    CHANGELOG.json (source of the rolling notes)
assets/           icon master, generated Play graphics and screenshots
android/          Capacitor project (generated; icons are regenerated)
```

## Privacy

There is no analytics, no advertising SDK and no account. Counts live in the
browser's local storage on the device. The Android build removes the `INTERNET`
permission Capacitor declares by default, so the offline claim is enforced by
the platform rather than merely promised.

## Licence

MIT
