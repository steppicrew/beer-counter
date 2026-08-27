#!/usr/bin/env node
/**
 * Publishes a release to Google Play with the Play Developer API: uploads the
 * .aab, all store listings, graphics and screenshots, and the release notes —
 * everything that is otherwise hand-entered per language in Play Console.
 *
 *   yarn play:publish --dry-run          # show what would change
 *   yarn play:publish --track internal   # upload + roll out to a track
 *   yarn play:publish --listings-only    # metadata/images, no binary
 *   yarn play:publish --track production --rollout 0.1   # staged rollout
 *
 * Auth: a Google Cloud service account with the "Release manager" role in
 * Play Console. Point PLAY_SERVICE_ACCOUNT_JSON at its key file (see .env).
 *
 * Everything happens inside ONE edit, which is committed at the very end, so
 * a failure part-way leaves the Play listing untouched rather than half
 * updated.
 */
import { readFileSync, existsSync, createReadStream, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

// --- options ---------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};

const dryRun = flag('dry-run');
const listingsOnly = flag('listings-only');
const track = value('track', 'internal');
const rollout = Number(value('rollout', '0'));

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const { listings } = JSON.parse(
  readFileSync(resolve(root, 'store-listing/LISTINGS.json'), 'utf8'),
);

const packageName = JSON.parse(
  readFileSync(resolve(root, 'capacitor.config.json'), 'utf8'),
).appId;

const aabPath = resolve(root, `build-output/beer-counter-${pkg.version}.aab`);

// Play's own naming for the image slots we manage.
const IMAGE_TYPES = {
  icon: () => [resolve(root, 'assets/play/icon-512.png')],
  featureGraphic: (tag) => [resolve(root, `assets/play/${tag}/feature-graphic.png`)],
  phoneScreenshots: (tag) => shots(tag, (f) => !f.includes('-tablet')),
  sevenInchScreenshots: (tag) => shots(tag, (f) => f.includes('-tablet7')),
};

function shots(tag, filter) {
  const dir = resolve(root, 'assets/screenshots', tag);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.png') && filter(f))
    .sort()
    .map((f) => resolve(dir, f));
}

/** Release notes for one language, reusing the rolling-window renderer. */
const { renderNotes } = await import(resolve(root, 'scripts/release-notes-lib.mjs'));


/**
 * Play's API throttles a burst of uploads and reports it as a generic
 * "Internal error encountered" (HTTP 500) rather than a 429, so a plain
 * sequential run of ~160 image uploads fails part-way. Retry those with
 * exponential backoff, and pace requests slightly between calls.
 */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** Small gap between uploads; cheaper than retrying after a throttle. */
const UPLOAD_PACING_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(label, fn, attempts = 5) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const status = error?.code ?? error?.response?.status;
      if (!RETRYABLE.has(status) || attempt >= attempts) throw error;
      const backoff = 2 ** attempt * 500 + Math.random() * 500;
      console.log(`    ${label}: ${status}, retrying in ${Math.round(backoff)}ms (${attempt}/${attempts - 1})`);
      await sleep(backoff);
    }
  }
}

// --- preflight -------------------------------------------------------------
const keyFile = process.env.PLAY_SERVICE_ACCOUNT_JSON;
if (!keyFile || !existsSync(keyFile)) {
  console.error(
    'PLAY_SERVICE_ACCOUNT_JSON is not set or the file is missing.\n' +
      'Create a service account with the Play Console "Release manager" role,\n' +
      'download its JSON key, and point PLAY_SERVICE_ACCOUNT_JSON at it (see .env.example).',
  );
  process.exit(1);
}

if (!listingsOnly && !existsSync(aabPath)) {
  console.error(`Missing ${aabPath.replace(`${root}/`, '')} — run \`yarn android:build\` first.`);
  process.exit(1);
}

console.log(`Package     ${packageName}`);
console.log(`Version     ${pkg.version} (versionCode ${pkg.androidVersionCode})`);
console.log(`Track       ${listingsOnly ? '(listings only)' : track}`);
console.log(`Languages   ${LOCALES.length}`);
if (dryRun) console.log('\nDRY RUN — nothing will be sent.\n');

// --- what will be uploaded -------------------------------------------------
const plan = [];
for (const locale of LOCALES) {
  const entry = listings[locale.code];
  if (!entry) continue;

  const images = {};
  for (const [type, finder] of Object.entries(IMAGE_TYPES)) {
    const files = finder(locale.playStore).filter((f) => existsSync(f));
    if (files.length > 0) images[type] = files;
  }
  plan.push({ locale, entry, images, notes: renderNotes(locale.code) });
}

for (const { locale, images, notes } of plan) {
  const counts = Object.entries(images)
    .map(([t, f]) => `${t}:${f.length}`)
    .join(' ');
  console.log(`  ${locale.playStore.padEnd(6)} listing + ${counts || 'no images'} + notes(${notes.length}c)`);
}

if (dryRun) {
  console.log('\nDry run complete.');
  process.exit(0);
}

// --- publish ---------------------------------------------------------------
const auth = new google.auth.GoogleAuth({
  keyFile,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const play = google.androidpublisher({ version: 'v3', auth });

/**
 * Play edits are optimistic-locked: any change made in Play Console (or by
 * another tool) while ours is open invalidates it at commit time. That is
 * cheap to lose on a small edit and expensive here, where ~160 uploads
 * precede the commit — so run the whole lifecycle again on a fresh edit.
 */
const CONFLICT = /A change was made to the application outside of this Edit/i;

async function publishOnce() {
const { data: edit } = await play.edits.insert({ packageName });
const editId = edit.id;
console.log(`\nEdit ${editId} opened.`);

try {
  let versionCode = pkg.androidVersionCode;

  if (!listingsOnly) {
    console.log('Uploading bundle…');
    const { data: bundle } = await withRetry('bundle upload', () =>
      play.edits.bundles.upload({
        packageName,
        editId,
        media: { mimeType: 'application/octet-stream', body: createReadStream(aabPath) },
      }),
    );
    versionCode = bundle.versionCode;
    console.log(`  versionCode ${versionCode} uploaded.`);
  }

  for (const { locale, entry, images } of plan) {
    const tag = locale.playStore;

    await withRetry(`${tag} listing`, () =>
      play.edits.listings.update({
        packageName,
        editId,
        language: tag,
        requestBody: {
          language: tag,
          title: entry.title,
          shortDescription: entry.short,
          fullDescription: entry.full,
        },
      }),
    );

    for (const [imageType, files] of Object.entries(images)) {
      // Replace the slot wholesale so removed screenshots actually disappear.
      await withRetry(`${tag} ${imageType} clear`, () =>
        play.edits.images.deleteall({ packageName, editId, language: tag, imageType }),
      );

      for (const file of files) {
        // A fresh stream per attempt: a consumed one cannot be replayed.
        await withRetry(`${tag} ${basename(file)}`, () =>
          play.edits.images.upload({
            packageName,
            editId,
            language: tag,
            imageType,
            media: { mimeType: 'image/png', body: createReadStream(file) },
          }),
        );
        await sleep(UPLOAD_PACING_MS);
      }
    }

    console.log(`  ${tag} listing + ${Object.values(images).flat().length} image(s)`);
  }

  if (!listingsOnly) {
    const releaseNotes = plan.map(({ locale, notes }) => ({
      language: locale.playStore,
      text: notes,
    }));

    const release = {
      versionCodes: [String(versionCode)],
      status: rollout > 0 && rollout < 1 ? 'inProgress' : 'completed',
      releaseNotes,
      ...(rollout > 0 && rollout < 1 ? { userFraction: rollout } : {}),
    };

    await withRetry(`track ${track}`, () =>
      play.edits.tracks.update({
        packageName,
        editId,
        track,
        requestBody: { track, releases: [release] },
      }),
    );
    console.log(`  track "${track}" set${rollout > 0 && rollout < 1 ? ` (${rollout * 100}% rollout)` : ''}.`);
  }

  const { data: committed } = await withRetry('commit', () =>
    play.edits.commit({ packageName, editId }),
  );
  console.log(`\nCommitted edit ${committed.id}.`);
  return true;
} catch (error) {
  // Abandon so a failed run does not leave a dangling edit blocking the next.
  await play.edits.delete({ packageName, editId }).catch(() => {});

  const detail = error?.errors?.[0]?.message ?? error?.message ?? '';
  if (CONFLICT.test(detail)) {
    console.error(`\nEdit ${editId} was invalidated by a change in Play Console.`);
    return false;
  }

  console.error(`\nFailed — edit ${editId} abandoned, nothing was published.`);
  console.error(error?.errors ?? error?.message ?? error);
  process.exit(1);
}
}

const MAX_EDIT_ATTEMPTS = 3;
for (let attempt = 1; attempt <= MAX_EDIT_ATTEMPTS; attempt += 1) {
  if (await publishOnce()) break;

  if (attempt === MAX_EDIT_ATTEMPTS) {
    console.error(
      `\nGave up after ${MAX_EDIT_ATTEMPTS} attempts — nothing was published.\n` +
        'Something keeps changing the app while the upload runs. Close the Play\n' +
        'Console tab (or finish what you are editing there) and run this again.',
    );
    process.exit(1);
  }

  console.error(`Retrying on a fresh edit (${attempt + 1}/${MAX_EDIT_ATTEMPTS})…\n`);
  await sleep(3000);
}
