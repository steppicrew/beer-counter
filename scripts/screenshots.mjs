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
        beer: { count: 4, lastAt: t - 3 * 60_000 },
        'beer-small': { count: 1, lastAt: t - 26 * 60_000 },
        wine: { count: 2, lastAt: t - 48 * 60_000 },
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
        beer: { count: 6, lastAt: t - 42_000 },
        'beer-small': { count: 2, lastAt: t - 12 * 60_000 },
        wine: { count: 1, lastAt: t - 71 * 60_000 },
        'session-shot': { count: 3, lastAt: t - 5 * 60_000 },
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
      tallies: { beer: { count: 3, lastAt: t - 9 * 60_000 } },
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
        beer: { count: 5, lastAt: t - 2 * 60_000 },
        'beer-small': { count: 2, lastAt: t - 33 * 60_000 },
        schnapps: { count: 1, lastAt: t - 7 * 60_000 },
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
        { state: scene.state(Date.now()), theme: scene.theme, code: locale.code },
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
