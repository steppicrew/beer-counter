#!/usr/bin/env node
/**
 * Renders every icon size the PWA, Play Store and Android launcher need from
 * the single SVG master in assets/icon/icon.svg.
 *
 * Requires ImageMagick (`magick`) on PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const master = resolve(root, 'assets/icon/icon.svg');

function render(out, size, extra = [], source = master) {
  mkdirSync(dirname(out), { recursive: true });
  execFileSync('magick', [
    '-background', 'none',
    '-density', '384',
    source,
    '-resize', `${size}x${size}`,
    ...extra,
    // Byte-for-byte reproducible output. Without these the PNG carries a
    // tIME chunk and ImageMagick's own date properties, so a rerun from an
    // unchanged master produced a file with identical pixels but a new
    // sha256 — which made every Play publish re-upload the icon in all
    // fifteen languages instead of skipping it.
    //
    // `-strip` drops the date properties; tIME survives it and needs naming
    // explicitly. Both are metadata only: the pixels are untouched.
    '-strip',
    '-define', 'png:exclude-chunk=time',
    out,
  ]);
  console.log(`  ${out.replace(`${root}/`, '')}  ${size}x${size}`);
}

// The master without its backdrop: the beer mat alone, on transparency, for
// the web icons and the pre-adaptive launcher PNGs. For the adaptive icon the
// mat itself is the background layer, so the foreground drops it too and
// keeps only what is printed on it. The preview build gets a blue mat and
// ring, so the debug app is told apart on the home screen.
// Written beside the master so relative references in the SVG still resolve.
const MAT = '#F4ECE0';
const PREVIEW_MAT = '#D6E4F5';
const svgSource = readFileSync(master, 'utf8');
const bare = svgSource.replace(/<rect id="backdrop"[^>]*\/>/, '');
const blue = (svg) =>
  svg
    .replace(/(id="mat"[^>]*fill=")[^"]*/, `$1${PREVIEW_MAT}`)
    .replace(/(id="ring"[^>]*stroke=")[^"]*/, '$1#1e5aa8');
const noMat = (svg) => svg.replace(/<circle id="mat"[^>]*\/>/, '');
const variants = {
  transparent: bare,
  preview: blue(bare),
  foreground: noMat(bare),
  previewForeground: noMat(blue(bare)),
};
const svgFile = {};
for (const [name, content] of Object.entries(variants)) {
  svgFile[name] = resolve(dirname(master), `.${name}.svg`);
  writeFileSync(svgFile[name], content);
}
process.on('exit', () => {
  for (const file of Object.values(svgFile)) rmSync(file, { force: true });
});
console.log('PWA icons');
render(resolve(root, 'public/icons/icon-192.png'), 192, [], svgFile.transparent);
render(resolve(root, 'public/icons/icon-512.png'), 512, [], svgFile.transparent);

// Maskable: Android crops to a circle/squircle, so the glyph must sit inside
// the safe zone — render at 80% and pad back out to full size.
console.log('Maskable icon');
render(resolve(root, 'public/icons/icon-512-maskable.png'), 410, [
  '-background', MAT,
  '-gravity', 'center',
  '-extent', '512x512',
]);

console.log('Play Store icon (512, no alpha)');
render(resolve(root, 'assets/play/icon-512.png'), 512, [
  '-background', MAT,
  '-alpha', 'remove',
  '-alpha', 'off',
]);

// Android launcher densities. Capacitor's project keeps them under
// android/app/src/main/res/mipmap-*.
const DENSITIES = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];

const androidRes = resolve(root, 'android/app/src/main/res');
const androidDebugRes = resolve(root, 'android/app/src/debug/res');

console.log('Android launcher icons');
for (const [res, legacy, foreground] of [
  [androidRes, svgFile.transparent, svgFile.foreground],
  [androidDebugRes, svgFile.preview, svgFile.previewForeground],
]) {
  for (const [density, size] of DENSITIES) {
    render(resolve(res, `mipmap-${density}/ic_launcher.png`), size, [], legacy);
    render(resolve(res, `mipmap-${density}/ic_launcher_round.png`), size, [], legacy);
    // Adaptive-icon foreground: the ring, mug and tally, sized so the ring
    // sits inside the launcher's 66dp safe circle.
    render(resolve(res, `mipmap-${density}/ic_launcher_foreground.png`), Math.round(size * 0.73), [
      '-background', 'none',
      '-gravity', 'center',
      '-extent', `${size}x${size}`,
    ], foreground);
  }
}

// The adaptive icon's background layer is the mat: solid, so the launcher's
// mask cuts it round on the home screen (a rounded square in recent apps,
// like some mats are) and nothing transparent is left for a launcher to fill
// black. The preview build's layer is blue; its file is tracked.
mkdirSync(resolve(androidRes, 'values'), { recursive: true });
writeFileSync(
  resolve(androidRes, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${MAT}</color>
</resources>
`,
);

// Localised launcher label. Android picks values-<lang>/ by the device
// language, so the home-screen name matches the app's own UI language.
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));
const { listings } = JSON.parse(
  readFileSync(resolve(root, 'store-listing/LISTINGS.json'), 'utf8'),
);

const xmlEscape = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, "\\'");

console.log('Localised app names');
for (const locale of LOCALES) {
  const title = listings[locale.code]?.title;
  if (!title) continue;

  // `en` is the default resource directory, not a qualified one.
  const dir =
    locale.code === 'en'
      ? resolve(androidRes, 'values')
      : resolve(androidRes, `values-${locale.code}`);
  mkdirSync(dir, { recursive: true });

  if (locale.code === 'en') {
    // Leave the generated values/strings.xml alone — it also carries the
    // package name and URL scheme that Capacitor writes.
    continue;
  }

  writeFileSync(
    resolve(dir, 'strings.xml'),
    `<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">${xmlEscape(title)}</string>
    <string name="title_activity_main">${xmlEscape(title)}</string>
</resources>
`,
  );
  console.log(`  values-${locale.code}/strings.xml  ${title}`);
}

console.log('favicon');
copyFileSync(svgFile.transparent, resolve(root, 'public/favicon.svg'));

console.log('\nDone.');
