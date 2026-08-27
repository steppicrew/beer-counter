#!/usr/bin/env node
/**
 * Renders the Play Console feature graphic (1024x500, no alpha) per language.
 * The tagline comes from the store listing so each locale gets its own.
 *
 *   yarn node scripts/gen-feature-graphic.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { LOCALES } = await import(resolve(root, 'scripts/locales.mjs'));

const { listings } = JSON.parse(
  readFileSync(resolve(root, 'store-listing/LISTINGS.json'), 'utf8'),
);
const iconSvg = readFileSync(resolve(root, 'assets/icon/icon.svg'), 'utf8');

// Strip the outer background rect: the graphic paints its own gradient.
const glyph = iconSvg
  .replace(/<rect width="512" height="512" fill="url\(#bg\)"\/>/, '')
  .replace(/^<\?xml[^>]*\?>\s*/, '');

const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FONT = 'DejaVu-Sans';

/**
 * DejaVu has no CJK coverage — Japanese and Chinese silently render as blanks
 * with it. Noto Sans CJK ships the glyphs; `-weight Bold` does not apply to
 * these faces, so the bold variant is named explicitly.
 */
const CJK_FONTS = {
  ja: { regular: 'Noto-Sans-CJK-JP', bold: 'Noto-Sans-CJK-JP-Bold' },
  zh: { regular: 'Noto-Sans-CJK-SC', bold: 'Noto-Sans-CJK-SC-Bold' },
};

function fontsFor(code) {
  return CJK_FONTS[code] ?? { regular: FONT, bold: FONT };
}
const TEXT_X = 470;
const MAX_TEXT_WIDTH = 1024 - TEXT_X - 56;


/**
 * Ask ImageMagick for the real rendered width — a character count badly
 * misjudges both German compounds and CJK, and an overflowing headline is
 * the one defect that makes the whole graphic unusable.
 */
function measure(text, fontSize, bold = false, fonts = fontsFor('en')) {
  const out = execFileSync('magick', [
    '-font', bold ? fonts.bold : fonts.regular,
    ...(bold && fonts.bold === FONT ? ['-weight', 'Bold'] : []),
    '-pointsize', String(fontSize),
    `label:${text}`,
    '-format', '%w',
    'info:',
  ]).toString();
  return Number(out.trim());
}

/** Largest size at or below `start` whose text fits the column. */
function fitSize(text, start, min, bold = false, fonts = fontsFor('en')) {
  for (let size = start; size > min; size -= 1) {
    if (measure(text, size, bold, fonts) <= MAX_TEXT_WIDTH) return size;
  }
  return min;
}

/**
 * Greedy wrap for CJK: break after the ideographic comma/full stop rather
 * than mid-word, keeping the punctuation at the end of the line.
 */
function wrapCjk(text, fontSize, maxLines, fonts) {
  const chunks = text.split(/(?<=[、，。；！？])/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const chunk of chunks) {
    const candidate = current + chunk;
    if (current && measure(candidate, fontSize, false, fonts) > MAX_TEXT_WIDTH) {
      lines.push(current);
      current = chunk;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

/** Greedy word wrap to at most `maxLines` lines that each fit the column. */
function wrap(text, fontSize, maxLines, fonts = fontsFor('en')) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measure(candidate, fontSize, false, fonts) > MAX_TEXT_WIDTH) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

for (const locale of LOCALES) {
  const entry = listings[locale.code];
  if (!entry) continue;

  const outDir = resolve(root, 'assets/play', locale.playStore);
  mkdirSync(outDir, { recursive: true });

  // CJK has no spaces to wrap on, so those taglines only shrink.
  const cjk = ['ja', 'zh'].includes(locale.code);
  const fonts = fontsFor(locale.code);

  const titleSize = fitSize(entry.title, 62, 30, true, fonts);
  // CJK has no spaces, but it does break after its punctuation — split there
  // so the tagline wraps instead of shrinking into illegibility.
  const taglineSize = cjk ? 32 : 34;
  const taglineLines = cjk
    ? wrapCjk(entry.short, taglineSize, 3, fonts)
    : wrap(entry.short, taglineSize, 3, fonts);

  const title = escapeXml(entry.title);
  const taglineTspans = taglineLines
    .map(
      (line, i) =>
        `<tspan x="${TEXT_X}" dy="${i === 0 ? 0 : taglineSize + 10}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  const lineStep = taglineSize + 10;

  // NOTE: with -gravity NorthWest, `-annotate +x+y` places the TOP edge of the
  // text at y — not its baseline. Every offset below is a top edge.
  const titleBlock = titleSize * 1.25;
  const taglineBlock = taglineLines.length * lineStep;
  const RULE_GAP = 14;
  const RULE_HEIGHT = 5;
  const blockHeight = titleBlock + 12 + taglineBlock + RULE_GAP + RULE_HEIGHT;

  const titleTop = Math.round((500 - blockHeight) / 2);
  const taglineTop = Math.round(titleTop + titleBlock + 12);
  const underlineY = Math.round(taglineTop + taglineBlock + RULE_GAP);
  void escapeXml;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="page" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2a2320"/>
      <stop offset="100%" stop-color="#0d0b0a"/>
    </linearGradient>
    ${glyph.match(/<defs>([\s\S]*?)<\/defs>/)?.[1] ?? ''}
  </defs>

  <rect width="1024" height="500" fill="url(#page)"/>

  <!-- soft amber glow behind the mug -->
  <circle cx="250" cy="250" r="190" fill="#f0a500" opacity="0.10"/>

  <g transform="translate(122, 66) scale(0.72)">
    ${glyph.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '').replace(/<defs>[\s\S]*?<\/defs>/, '')}
  </g>

</svg>`;

  const tmp = resolve(outDir, '_feature.svg');
  writeFileSync(tmp, svg);

  const annotate = [];
  annotate.push(
    '-font', fonts.bold, '-pointsize', String(titleSize), '-fill', '#f4ece0',
    ...(fonts.bold === FONT ? ['-weight', 'Bold'] : []),
    '-annotate', `+${TEXT_X}+${titleTop}`, entry.title,
  );
  taglineLines.forEach((line, i) => {
    annotate.push(
      '-font', fonts.regular, '-pointsize', String(taglineSize), '-fill', '#f0a500',
      '-weight', 'Normal',
      '-annotate', `+${TEXT_X}+${taglineTop + i * lineStep}`, line,
    );
  });

  const out = resolve(outDir, 'feature-graphic.png');

  // Two passes: the SVG background is rasterised at high density first, then
  // the text is drawn onto the finished 1024x500 canvas. Annotating in the
  // same pass would scale the glyphs by the density factor.
  execFileSync('magick', [
    '-background', '#12100e',
    '-density', '192',
    tmp,
    '-resize', '1024x500!',
    '-alpha', 'remove',
    '-alpha', 'off',
    out,
  ]);
  execFileSync('magick', [
    out,
    '-gravity', 'NorthWest',
    ...annotate,
    // Accent rule under the last tagline line, in final-canvas pixels.
    '-fill', '#f0a500',
    '-stroke', 'none',
    '-draw', `roundrectangle ${TEXT_X},${underlineY} ${TEXT_X + 86},${underlineY + RULE_HEIGHT} 2,2`,
    // Play Console rejects a feature graphic with an alpha channel, and the
    // annotate pass re-adds one — flatten onto the background to be sure.
    '-background', '#12100e',
    '-flatten',
    '-alpha', 'remove',
    '-alpha', 'off',
    '-define', 'png:color-type=2',
    out,
  ]);
  rmSync(tmp);

  console.log(`  ${locale.playStore}/feature-graphic.png`);
}

console.log(`\n${LOCALES.length} feature graphics in assets/play/<lang>/.`);
