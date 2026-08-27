/** Icon keys map to the SVG glyph set in `components/BeverageIcon.tsx`. */
export const ICON_KEYS = [
  'beer-large',
  'beer-small',
  'wheat-beer',
  'wine',
  'schnapps',
  'cocktail',
  'coffee',
  'water',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

export interface Beverage {
  id: string;
  /** i18n key for the built-in defaults; free text for user-created ones. */
  nameKey?: string;
  name?: string;
  icon: IconKey;
  /** Built-ins persist across sessions; session drinks vanish on reset. */
  scope: 'default' | 'session';
  /**
   * Unit price in minor units (cents) — integers only, so summing a round
   * never accumulates the rounding error a float would. Undefined means the
   * user has not priced this drink; the total then reports as incomplete.
   */
  priceCents?: number;
}

/**
 * One entry per drink counted, oldest first (epoch ms).
 *
 * A stack rather than a count plus a single timestamp: undoing a mistaken tap
 * has to restore the *previous* drink's time, which a lone `lastAt` cannot do
 * — it would either keep the wrong time or blank it entirely.
 */
export interface Tally {
  times: number[];
}

/** Number of drinks counted. */
export function tallyCount(tally: Tally): number {
  return tally.times.length;
}

/** Epoch ms of the most recent drink; null when none are counted. */
export function tallyLastAt(tally: Tally): number | null {
  return tally.times.at(-1) ?? null;
}

export type ThemeMode = 'system' | 'light' | 'dark';

/** ISO 4217 code used to format every price; chosen once in settings. */
export type CurrencyCode = string;
