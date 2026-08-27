#!/usr/bin/env node
/**
 * Renders release-notes/CHANGELOG.json into the block Play Console accepts:
 *
 *   <en-US>…</en-US>
 *   <de-DE>…</de-DE>
 *
 * Entries roll: the newest release is always kept, older ones are dropped
 * until every language fits the 500-character cap. `yarn play:publish` uploads
 * the same text through the API — see scripts/release-notes-lib.mjs.
 *
 *   yarn release-notes                 # print the block
 *   yarn release-notes --out FILE      # also write it to a file
 *   yarn release-notes --lang de       # one language, plain text
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));
const { renderNotes, fittingCount, overlongLocales, releases, NOTE_LIMIT } = await import(
  resolve(root, 'scripts/release-notes-lib.mjs')
);

if (releases.length === 0) {
  console.error('No releases in CHANGELOG.json');
  process.exit(1);
}

const count = fittingCount();

for (const locale of overlongLocales(count)) {
  console.error(
    `[warn] ${locale.playStore} is ${locale.length} chars — over the ${NOTE_LIMIT} limit. ` +
      'Shorten it in CHANGELOG.json.',
  );
}

const block = LOCALES.map(
  (l) => `<${l.playStore}>\n${renderNotes(l.code, count)}\n</${l.playStore}>`,
).join('\n');

const argv = process.argv.slice(2);
const langIndex = argv.indexOf('--lang');
const outIndex = argv.indexOf('--out');

console.log(langIndex !== -1 ? renderNotes(argv[langIndex + 1], count) : block);

if (outIndex !== -1) {
  const out = resolve(root, argv[outIndex + 1]);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${block}\n`);
  console.error(`\nWritten to ${out}`);
}

const longest = Math.max(...LOCALES.map((l) => renderNotes(l.code, count).length));
console.error(
  `\n${count} of ${releases.length} release(s) included; longest language ${longest}/${NOTE_LIMIT} chars.`,
);
