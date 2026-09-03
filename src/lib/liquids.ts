import type { IconKey } from './types';

/**
 * What is in each glass, shared by `BeverageIcon` (the row and picker buttons)
 * and `GlassIcon` (the bartop), so a drink looks the same wherever it appears.
 *
 * The colours themselves live in `styles/theme.scss` as `--liquid-*` tokens —
 * only the token *name* is built here, so the light and dark palettes stay in
 * the stylesheet with every other themed colour.
 */
export function liquidVar(icon: IconKey): string {
  return `var(--liquid-${icon})`;
}

/**
 * Drinks poured with a head. Only beer gets the white crown; a wine or a water
 * with one would read as a mistake rather than as a garnish.
 */
const FOAMY: ReadonlySet<IconKey> = new Set<IconKey>(['beer-large', 'beer-small', 'wheat-beer']);

export function hasFoam(icon: IconKey): boolean {
  return FOAMY.has(icon);
}
