/**
 * Rolling release-note rendering, shared by the CLI renderer and the Play
 * publisher so both produce byte-identical text.
 *
 * Play Console caps release notes at 500 characters PER LANGUAGE. The newest
 * release is always kept; older entries are dropped from the bottom until
 * every language fits.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

export const NOTE_LIMIT = 500;

const { releases } = JSON.parse(
  readFileSync(resolve(root, 'release-notes/CHANGELOG.json'), 'utf8'),
);

export { releases };

function render(code, count) {
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

/**
 * How many of the newest releases fit the cap in EVERY language. The block is
 * uploaded as a unit, so the tightest language decides for all of them.
 */
export function fittingCount() {
  let count = releases.length;
  while (count > 1) {
    if (LOCALES.every((l) => render(l.code, count).length <= NOTE_LIMIT)) break;
    count -= 1;
  }
  return count;
}

/** Final note text for one language, already truncated to the rolling window. */
export function renderNotes(code, count = fittingCount()) {
  return render(code, count);
}

/** Languages whose newest single entry still exceeds the cap — a content bug. */
export function overlongLocales(count = fittingCount()) {
  return LOCALES.filter((l) => render(l.code, count).length > NOTE_LIMIT).map((l) => ({
    ...l,
    length: render(l.code, count).length,
  }));
}
