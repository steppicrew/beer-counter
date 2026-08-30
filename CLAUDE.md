# Steppi's Beer Counter — working notes

Offline-first drink counter. One React/Vite codebase ships as a PWA and, via
Capacitor, as the Android app `de.steppicrew.beercounter`.

Live: https://beercounter.steppicrew.de/ · Repo: steppicrew/beer-counter

## Environment

Node 20 is the system default and **too old for Vite 7**. Every script does
`eval "$(fnm env)"; fnm use 22` first — do the same in ad-hoc commands.

Yarn 4 with **PnP, no `node_modules`**. Plain `node script.mjs` cannot resolve
dependencies: use `yarn node …`. Scripts under `/tmp` can't resolve either —
PnP only applies inside the project, so put throwaway scripts in the repo root
and delete them after.

Gradle 8.13 / AGP 8.13 **reject JDK 25**, which is the system default.
`build-android.sh` selects JDK 21 itself.

`magick`, `qrencode` and `zbarimg` are used by the asset scripts. Noto Sans CJK
lives in `~/.local/share/fonts` — without it the ja/zh feature graphics render
blank rather than failing loudly.

## Layout

```
src/components/   UI; BeverageRow is the counting tile
src/store/        Zustand, persisted to localStorage
src/i18n/         locale table + 15 message catalogues
src/lib/          types, money, totals, long-press, update + install hooks
src/generated/    storeQr.ts — generated, committed
scripts/          build, assets, screenshots, deploy, Play publishing
store-listing/    LISTINGS.json (source) → per-language export
release-notes/    CHANGELOG.json (source of the rolling notes)
privacy/          POLICY.json → public/privacy/ + public/impressum/
```

`public/icons/`, `public/privacy/`, `public/impressum/` and `assets/play/…` are
**generated** and gitignored. `src/generated/storeQr.ts` is generated but
committed, so a clone builds without qrencode.

## Conventions that bite

**Target SDK.** The app targets API 37, which needs **AGP 8.13 + Gradle 8.13**.
The SDK installs that platform as `platforms/android-37.0` (the `sdk_full`
extension naming): older AGP resolves neither `android-37` nor the literal
`"android-37.0"` and fails configuration outright, which reads as a missing SDK
but is a plugin limit. This is unrelated to Capacitor, which stays on 7 — a
Capacitor 8 bump is *not* a prerequisite and drags in a Kotlin stdlib
duplicate-class clash via Cordova 14.

**Versioning.** `package.json` owns both `version` and `androidVersionCode`;
Gradle reads them, so web and native cannot drift. `versionCode` only ever
increments — Play rejects anything not strictly greater. Use
`yarn version:bump`, never edit by hand.

**i18n.** All 15 catalogues must carry identical keys — `Messages` is derived
from the English one, so a gap is a type error. Adding a locale means touching
`src/i18n/locales.ts` *and* `scripts/locales.mjs` (duplicated on purpose: the
scripts can't import TS), plus a listing and a note per release.
`yarn check-locales` enforces all of it.

**Prices** are integer minor units (cents). Never floats — a long round
accumulates drift. `Intl` handles separators and zero-decimal currencies (JPY).

**The legal footer and install prompt are web-only**, gated on
`isNativeApp()`. That checks Capacitor's injected global, *not* the URL: its
Android scheme is `https://localhost`, indistinguishable from a dev server.

**Android has no INTERNET permission.** It is stripped in `AndroidManifest.xml`
with `tools:node="remove"`, so the offline claim is enforced by the platform.
Anything needing the network will fail silently there.

## Bugs already fixed — don't reintroduce

- **PWA update.** `registerType` is `'prompt'`, not `'autoUpdate'`: autoUpdate
  calls `skipWaiting()` and swaps assets under a page mid-round. The banner's
  button must call the function `registerSW()` *returns* — a plain
  `location.reload()` is served the old cached assets by the old worker and
  changes nothing.
- **Install prompt.** `beforeinstallprompt` fires once, before React mounts.
  It is captured at module load and shared; a per-component listener misses it.
- **Feature graphics.** With `-gravity NorthWest`, `-annotate +x+y` positions
  the text's **top edge**, not its baseline. Also: annotate in a *second* magick
  pass, after the resize, or the density factor scales the glyphs.
- **Icons.** Header/row icons are SVG. The `⚙`/`⟲`/`✎` glyphs carry uneven
  internal padding and sit visibly low in a round button.

## Verifying

Don't trust that something rendered — assert it. Use
`node ~/.claude/skills/browser-automation/browser.mjs <url> --script <file>`.

For a PWA update test, the two builds must genuinely differ: a comment-only
change is stripped by minification and produces an identical chunk hash, so the
service worker correctly sees no update and the test proves nothing.

## Publishing

```bash
yarn deploy                 # bump, build, rsync, commit; refuses a dirty tree
yarn android:build          # signed .aab (verifies signing)
yarn play:publish --dry-run # plan only, no auth
yarn play:publish --track internal
```

Config is in `.env` (gitignored) — see `.env.example`. It is **sourced by the
shell**, so values with spaces must be quoted.

The Play publisher skips anything Play already holds (images by sha256, text by
value), so a no-op run takes seconds. **While it runs, don't save anything in
Play Console** — an edit is optimistic-locked and even an autosaved draft in the
listing/release editor rejects the commit. Having the tab open is fine.

Signing key: `~/keys/beer-counter-upload.jks`, password in
`android/keystore.properties` (both gitignored). **Losing it means the app can
never be updated.**

## Still manual in Play Console

Privacy policy URL, data safety form, content rating, target audience — the API
doesn't expose them.
