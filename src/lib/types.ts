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

/** The phone's owner. Always at the table, never renamed or deleted. */
export const ME = 'me';

/** How many colours a person can be told apart by; see `--person-*` in the theme. */
export const PERSON_COLOURS = 8;

/**
 * Someone at the table. Regulars are kept like built-in drinks; a guest is
 * for tonight only and leaves with the reset, as session drinks do.
 */
export interface Person {
  id: string;
  /** Absent only for {@link ME}, whose name follows the language. */
  name?: string;
  scope: 'default' | 'session';
  /** Index into the person colours, fixed at creation so nobody changes colour. */
  colour: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';

/** ISO 4217 code used to format every price; chosen once in settings. */
export type CurrencyCode = string;

/**
 * A drink as it stood when its round was archived. Name, icon and price are
 * copied rather than referenced by id: a later rename, reprice or delete must
 * not rewrite what was actually drunk, and session drinks do not survive the
 * reset that archives them.
 */
export interface ArchivedDrink {
  /** Kept instead of the resolved name so built-ins follow the language. */
  nameKey?: string;
  name?: string;
  icon: IconKey;
  priceCents?: number;
  times: number[];
  /**
   * Who drank it. Absent means the phone's owner: that is every drink from
   * before the table existed, so old history needs no migration.
   */
  person?: string;
  /** The name as it stood, for a guest who is gone after the reset. */
  personName?: string;
}

/** One finished round, written to the history when it is reset. */
export interface Round {
  /**
   * First and last drink, not the reset times: a round reset on Monday and
   * drunk on Saturday belongs to Saturday.
   */
  startedAt: number;
  endedAt: number;
  drinks: ArchivedDrink[];
}
