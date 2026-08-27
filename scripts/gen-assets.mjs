#!/usr/bin/env node
/**
 * Renders every icon size the PWA, Play Store and Android launcher need from
 * the single SVG master in assets/icon/icon.svg.
 *
 * Requires ImageMagick (`magick`) on PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const master = resolve(root, 'assets/icon/icon.svg');

function render(out, size, extra = []) {
  mkdirSync(dirname(out), { recursive: true });
  execFileSync('magick', [
    '-background', 'none',
    '-density', '384',
    master,
    '-resize', `${size}x${size}`,
    ...extra,
    out,
  ]);
  console.log(`  ${out.replace(`${root}/`, '')}  ${size}x${size}`);
}

console.log('PWA icons');
render(resolve(root, 'public/icons/icon-192.png'), 192);
render(resolve(root, 'public/icons/icon-512.png'), 512);

// Maskable: Android crops to a circle/squircle, so the glyph must sit inside
// the safe zone — render at 80% and pad back out to full size.
console.log('Maskable icon');
render(resolve(root, 'public/icons/icon-512-maskable.png'), 410, [
  '-background', '#12100e',
  '-gravity', 'center',
  '-extent', '512x512',
]);

console.log('Play Store icon (512, no alpha)');
render(resolve(root, 'assets/play/icon-512.png'), 512, [
  '-background', '#12100e',
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
console.log('Android launcher icons');
for (const [density, size] of DENSITIES) {
  render(resolve(androidRes, `mipmap-${density}/ic_launcher.png`), size);
  render(resolve(androidRes, `mipmap-${density}/ic_launcher_round.png`), size);
  // Adaptive-icon foreground is 108dp with an 18dp margin on each side.
  render(resolve(androidRes, `mipmap-${density}/ic_launcher_foreground.png`), Math.round(size * 0.66), [
    '-background', 'none',
    '-gravity', 'center',
    '-extent', `${size}x${size}`,
  ]);
}

// Solid background colour behind the adaptive foreground.
mkdirSync(resolve(androidRes, 'values'), { recursive: true });
writeFileSync(
  resolve(androidRes, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#12100E</color>
</resources>
`,
);

console.log('favicon');
copyFileSync(master, resolve(root, 'public/favicon.svg'));

console.log('\nDone.');
