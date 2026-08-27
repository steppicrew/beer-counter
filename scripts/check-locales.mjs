#!/usr/bin/env node
/**
 * Guards the duplication between src/i18n/locales.ts (used by the app) and
 * scripts/locales.mjs (used by the build/publish scripts), and verifies every
 * locale has a full message catalogue, a store listing and release notes.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

let failed = false;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failed = true;
};

// 1. The two locale tables must agree.
const tsSource = readFileSync(resolve(root, 'src/i18n/locales.ts'), 'utf8');
const tsPairs = [...tsSource.matchAll(/code: '([\w-]+)', playStore: '([\w-]+)'/g)].map(
  (m) => `${m[1]}:${m[2]}`,
);
const jsPairs = LOCALES.map((l) => `${l.code}:${l.playStore}`);

if (tsPairs.join(',') !== jsPairs.join(',')) {
  fail('src/i18n/locales.ts and scripts/locales.mjs disagree.');
  console.error(`   ts: ${tsPairs.join(' ')}`);
  console.error(`   js: ${jsPairs.join(' ')}`);
}

// 2. Every locale needs a catalogue exported from strings.ts.
const strings = readFileSync(resolve(root, 'src/i18n/strings.ts'), 'utf8');
const englishKeys = [...strings.matchAll(/^  '([\w.]+)':/gm)].map((m) => m[1]);
const keyCount = new Set(englishKeys).size;

for (const { code } of LOCALES) {
  const pattern =
    code === 'en'
      ? new RegExp(`export const en = \\{`)
      : new RegExp(`export const ${code}: Messages = \\{`);
  if (!pattern.test(strings)) fail(`strings.ts has no catalogue for "${code}".`);
}

// 3. Store listings and release notes must cover every locale.
const { listings } = JSON.parse(
  readFileSync(resolve(root, 'store-listing/LISTINGS.json'), 'utf8'),
);
const { releases } = JSON.parse(
  readFileSync(resolve(root, 'release-notes/CHANGELOG.json'), 'utf8'),
);

for (const { code } of LOCALES) {
  if (!listings[code]) fail(`store-listing/LISTINGS.json has no "${code}" entry.`);
  for (const release of releases) {
    if (!release.notes[code]) {
      fail(`release ${release.version} has no "${code}" note.`);
    }
  }
}

if (failed) process.exit(1);

console.log(
  `✓ ${LOCALES.length} locales consistent across app, store listings and ` +
    `${releases.length} release(s); ${keyCount} message keys.`,
);
