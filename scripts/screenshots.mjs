#!/usr/bin/env node
/**
 * Captures Play Console screenshots for every supported language.
 *
 * Play Console wants 2–8 phone screenshots per language, 16:9 or 9:16,
 * each side between 320 and 3840 px. We render at 1080x1920 (9:16), which
 * satisfies phone, and also emit a 7-inch tablet set at 1200x1920.
 *
 *   node scripts/screenshots.mjs                 # all languages
 *   node scripts/screenshots.mjs --lang de,en    # a subset
 *   node scripts/screenshots.mjs --keep          # leave the preview server up
 *
 * Output: assets/screenshots/<play-tag>/01-counting.png …
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

const PORT = 4319;
const BASE = `http://127.0.0.1:${PORT}/`;

const DEVICE_PROFILES = [
  { name: 'phone', width: 1080, height: 1920, scale: 3 },
  { name: 'tablet7', width: 1200, height: 1920, scale: 2 },
];

const argLang = process.argv.indexOf('--lang');
const only =
  argLang !== -1 ? new Set(process.argv[argLang + 1].split(',').map((s) => s.trim())) : null;
const targets = only ? LOCALES.filter((l) => only.has(l.code)) : LOCALES;

/**
 * Each scene seeds localStorage directly, so a screenshot never depends on
 * click choreography that could break with a UI change.
 */
/**
 * A tally from minutes-ago offsets, newest last.
 *
 * The scenes used to carry the legacy `{ count, lastAt }` shape, which the
 * store migrates by stamping every drink of a kind with the same timestamp —
 * so on the bartop all four beers stood on one spot at the left edge instead
 * of across the evening.
 */
const at = (t, ...minutesAgo) => ({
  times: minutesAgo.map((m) => t - m * 60_000).sort((a, b) => a - b),
});

/**
 * The clock the scenes are staged at.
 *
 * Not `Date.now()`: that stamped every shot with whatever time the release
 * happened to be built at, so the bartop's hour marks read "12, 14" — a lunch
 * that nobody is counting rounds at. Pinned to a Friday night instead, which
 * is when the app is actually used and what the counter should be showing.
 *
 * Late enough that a four-hour evening is entirely after dark, and the marks
 * land on friendly whole hours.
 *
 * The page's clock is moved to match (see the init script below): the rows
 * show "12m ago" against `Date.now()`, so shifting only the stored timestamps
 * would stage a handsome bartop above a list claiming every drink was eight
 * hours ago.
 */
function stagedNow() {
  const d = new Date();
  d.setHours(23, 20, 0, 0);
  return d.getTime();
}

const SCENES = [
  {
    file: '01-counting',
    theme: 'dark',
    state: (t) => ({
      beverages: [
        { id: 'beer', nameKey: 'drink.beer', icon: 'beer-large', scope: 'default' },
        { id: 'beer-small', nameKey: 'drink.beerSmall', icon: 'beer-small', scope: 'default' },
        { id: 'wine', nameKey: 'drink.wine', icon: 'wine', scope: 'default' },
        { id: 'schnapps', nameKey: 'drink.schnapps', icon: 'schnapps', scope: 'default' },
      ],
      tallies: {
        beer: at(t, 196, 148, 74, 3),
        'beer-small': at(t, 26),
        wine: at(t, 121, 48),
      },
    }),
  },
  {
    file: '02-light',
    theme: 'light',
    state: (t) => ({
      beverages: [
        { id: 'beer', nameKey: 'drink.beer', icon: 'beer-large', scope: 'default' },
        { id: 'beer-small', nameKey: 'drink.beerSmall', icon: 'beer-small', scope: 'default' },
        { id: 'wine', nameKey: 'drink.wine', icon: 'wine', scope: 'default' },
        { id: 'schnapps', nameKey: 'drink.schnapps', icon: 'schnapps', scope: 'default' },
        { id: 'session-shot', name: 'Aperol', icon: 'cocktail', scope: 'session' },
      ],
      tallies: {
        beer: at(t, 205, 166, 128, 84, 39, 0.7),
        'beer-small': at(t, 143, 12),
        wine: at(t, 71),
        'session-shot': at(t, 96, 55, 5),
      },
    }),
  },
  {
    file: '03-add-drink',
    theme: 'dark',
    state: (t) => ({
      beverages: [
        { id: 'beer', nameKey: 'drink.beer', icon: 'beer-large', scope: 'default' },
        { id: 'beer-small', nameKey: 'drink.beerSmall', icon: 'beer-small', scope: 'default' },
        { id: 'wine', nameKey: 'drink.wine', icon: 'wine', scope: 'default' },
      ],
      tallies: { beer: at(t, 97, 51, 9) },
    }),
    async after(page) {
      await page.locator('.app__add').click();
      await page.waitForSelector('.sheet__panel');
      await page.waitForTimeout(400);
    },
  },
  {
    file: '04-settings',
    theme: 'light',
    state: (t) => ({
      beverages: [
        { id: 'beer', nameKey: 'drink.beer', icon: 'beer-large', scope: 'default' },
        { id: 'beer-small', nameKey: 'drink.beerSmall', icon: 'beer-small', scope: 'default' },
        { id: 'wine', nameKey: 'drink.wine', icon: 'wine', scope: 'default' },
        { id: 'schnapps', nameKey: 'drink.schnapps', icon: 'schnapps', scope: 'default' },
      ],
      tallies: {
        beer: at(t, 178, 132, 88, 41, 2),
        'beer-small': at(t, 154, 33),
        schnapps: at(t, 7),
      },
    }),
    async after(page) {
      await page.locator('.app__icon-btn').first().click();
      await page.waitForSelector('.sheet__panel');
      await page.waitForTimeout(400);
    },
  },
];

// --- preview server --------------------------------------------------------
console.log('Starting preview server…');
const server = spawn(
  'yarn',
  ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
  { cwd: root, stdio: 'ignore' },
);

const shutdown = () => server.kill('SIGTERM');
process.on('exit', shutdown);
process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});

// Wait for it to answer rather than sleeping a fixed amount.
const deadline = Date.now() + 30_000;
for (;;) {
  try {
    const res = await fetch(BASE);
    if (res.ok) break;
  } catch {
    /* not up yet */
  }
  if (Date.now() > deadline) {
    console.error('Preview server did not start. Run `yarn build` first.');
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 300));
}

// --- capture ---------------------------------------------------------------
const browser = await chromium.launch();
let count = 0;

for (const locale of targets) {
  const outDir = resolve(root, 'assets/screenshots', locale.playStore);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const profile of DEVICE_PROFILES) {
    const context = await browser.newContext({
      ...devices['Pixel 7'],
      viewport: { width: profile.width / profile.scale, height: profile.height / profile.scale },
      deviceScaleFactor: profile.scale,
      locale: locale.code,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'light',
    });

    for (const scene of SCENES) {
      const page = await context.newPage();

      // These images represent the packaged Android app, which never draws
      // the web-only legal footer ("Android app · Privacy · Legal notice").
      // The app gates that on `isNativeApp()`, which reads Capacitor's
      // injected global rather than the URL — deliberately, since Capacitor's
      // Android scheme is `https://localhost` and indistinguishable from this
      // preview server. So make the capture look native rather than weakening
      // the detection.
      //
      // Assigning `window.Capacitor` here does not work: the bundle carries
      // Capacitor's own runtime, which initialises afterwards and overwrites
      // `isNativePlatform` with its own `() => getPlatform() !== 'web'`. What
      // that reads is `window.androidBridge` — the object the real Android
      // WebView injects — so setting it is what actually makes the page
      // believe it is native, and it survives the runtime loading on top.
      await page.addInitScript(() => {
        window.androidBridge = { postMessage: () => {} };
      });

      // Move the page's clock to the staged evening, so the relative times in
      // the rows ("12m ago") agree with the timestamps on the counter. Only
      // `now` is shifted — real timers still fire normally, so the app runs.
      await page.addInitScript((fakeNow) => {
        const Real = Date;
        const delta = fakeNow - Real.now();
        const Faked = new Proxy(Real, {
          construct: (target, args) =>
            args.length === 0 ? new target(Real.now() + delta) : new target(...args),
          get: (target, prop) =>
            prop === 'now' ? () => Real.now() + delta : Reflect.get(target, prop),
        });
        window.Date = Faked;
      }, stagedNow());

      // Seed state before the app's first paint so nothing flashes empty.
      await page.addInitScript(
        ({ state, theme, code }) => {
          localStorage.setItem(
            'beer-counter-state',
            JSON.stringify({
              state: { ...state, sessionStartedAt: Date.now(), theme, locale: code },
              version: 1,
            }),
          );
        },
        { state: scene.state(stagedNow()), theme: scene.theme, code: locale.code },
      );

      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForSelector('.row');
      if (scene.after) await scene.after(page);
      await page.waitForTimeout(250);

      const suffix = profile.name === 'phone' ? '' : `-${profile.name}`;
      const file = resolve(outDir, `${scene.file}${suffix}.png`);
      await page.screenshot({ path: file });
      count += 1;
      await page.close();
    }

    await context.close();
  }

  console.log(`  ${locale.playStore}  ${SCENES.length * DEVICE_PROFILES.length} shots`);
}

await browser.close();
if (!process.argv.includes('--keep')) server.kill('SIGTERM');

console.log(`\n${count} screenshots in assets/screenshots/<lang>/.`);
