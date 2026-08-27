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
}

export interface Tally {
  count: number;
  /** Epoch ms of the most recent increment; null when count is 0. */
  lastAt: number | null;
}

export type ThemeMode = 'system' | 'light' | 'dark';
