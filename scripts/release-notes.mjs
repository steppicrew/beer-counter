#!/usr/bin/env node
/**
 * Renders release-notes/CHANGELOG.json into the block Play Console accepts:
 *
 *   <en-US>…</en-US>
 *   <de-DE>…</de-DE>
 *
 * Play Console caps release notes at 500 characters PER LANGUAGE. Entries are
 * rolling: the newest release is always kept, and older ones are dropped from
 * the bottom until every language fits.
 *
 *   node scripts/release-notes.mjs              # print to stdout
 *   node scripts/release-notes.mjs --out FILE   # also write a file
 *   node scripts/release-notes.mjs --lang de    # single language, plain text
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIMIT = 500;

const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

const changelog = JSON.parse(
  readFileSync(resolve(root, 'release-notes/CHANGELOG.json'), 'utf8'),
);
const releases = changelog.releases;
if (releases.length === 0) {
  console.error('No releases in CHANGELOG.json');
  process.exit(1);
}

/** One language's text for the newest `count` releases. */
function renderLang(code, count) {
  return releases
    .slice(0, count)
    .map((release) => {
      const note = release.notes[code] ?? release.notes.en;
      // Only label the version once there is more than one entry to tell apart.
      return count === 1 ? note : `v${release.version}\n${note}`;
    })
    .join('\n\n')
    .trim();
}

// Find the largest number of releases that fits within the cap in EVERY
// language — the block is uploaded as a unit, so the tightest language wins.
let count = releases.length;
while (count > 1) {
  const fits = LOCALES.every((l) => renderLang(l.code, count).length <= LIMIT);
  if (fits) break;
  count -= 1;
}

const overflow = LOCALES.filter((l) => renderLang(l.code, count).length > LIMIT);
if (overflow.length > 0) {
  // Even a single entry is too long: that is a content bug, not a rolling one.
  for (const l of overflow) {
    console.error(
      `[warn] ${l.playStore} is ${renderLang(l.code, count).length} chars — over the ${LIMIT} limit. Shorten it in CHANGELOG.json.`,
    );
  }
}

const block = LOCALES.map(
  (l) => `<${l.playStore}>\n${renderLang(l.code, count)}\n</${l.playStore}>`,
).join('\n');

const outIndex = process.argv.indexOf('--out');
const langIndex = process.argv.indexOf('--lang');

if (langIndex !== -1) {
  const code = process.argv[langIndex + 1];
  console.log(renderLang(code, count));
} else {
  console.log(block);
}

if (outIndex !== -1) {
  const out = resolve(root, process.argv[outIndex + 1]);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${block}\n`);
  console.error(`\nWritten to ${out}`);
}

console.error(
  `\n${count} of ${releases.length} release(s) included; longest language ${Math.max(
    ...LOCALES.map((l) => renderLang(l.code, count).length),
  )}/${LIMIT} chars.`,
);
