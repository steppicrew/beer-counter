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

const { data: edit } = await play.edits.insert({ packageName });
const editId = edit.id;
console.log(`\nEdit ${editId} opened.`);

try {
  let versionCode = pkg.androidVersionCode;

  if (!listingsOnly) {
    console.log('Uploading bundle…');
    const { data: bundle } = await play.edits.bundles.upload({
      packageName,
      editId,
      media: { mimeType: 'application/octet-stream', body: createReadStream(aabPath) },
    });
    versionCode = bundle.versionCode;
    console.log(`  versionCode ${versionCode} uploaded.`);
  }

  for (const { locale, entry, images } of plan) {
    const tag = locale.playStore;

    await play.edits.listings.update({
      packageName,
      editId,
      language: tag,
      requestBody: {
        language: tag,
        title: entry.title,
        shortDescription: entry.short,
        fullDescription: entry.full,
      },
    });

    for (const [imageType, files] of Object.entries(images)) {
      // Replace the slot wholesale so removed screenshots actually disappear.
      await play.edits.images.deleteall({ packageName, editId, language: tag, imageType });
      for (const file of files) {
        await play.edits.images.upload({
          packageName,
          editId,
          language: tag,
          imageType,
          media: { mimeType: 'image/png', body: createReadStream(file) },
        });
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

    await play.edits.tracks.update({
      packageName,
      editId,
      track,
      requestBody: { track, releases: [release] },
    });
    console.log(`  track "${track}" set${rollout > 0 && rollout < 1 ? ` (${rollout * 100}% rollout)` : ''}.`);
  }

  const { data: committed } = await play.edits.commit({ packageName, editId });
  console.log(`\nCommitted edit ${committed.id}.`);
} catch (error) {
  // Abandon so a failed run does not leave a dangling edit blocking the next.
  await play.edits.delete({ packageName, editId }).catch(() => {});
  console.error(`\nFailed — edit ${editId} abandoned, nothing was published.`);
  console.error(error?.errors ?? error?.message ?? error);
  process.exit(1);
}
