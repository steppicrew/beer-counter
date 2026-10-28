import type { ArchivedDrink, Beverage, IconKey, Person, Round, Tally } from './types';
import { ICON_KEYS, ME } from './types';

/** One drink name within a type, e.g. "Radler" under the large-beer glass. */
export interface StatsName {
  nameKey?: string;
  name?: string;
  count: number;
}

/** All drinks sharing a glass, with the names that make them up. */
export interface StatsLine {
  icon: IconKey;
  count: number;
  /** Most drunk first. */
  names: StatsName[];
}

/** What a stretch of drinks adds up to. */
export interface StatsSummary {
  drinks: number;
  /** Sum over priced drinks only, in minor units — see `computeTotals`. */
  cents: number;
  complete: boolean;
  anyPriced: boolean;
  /** Most drunk first. */
  lines: StatsLine[];
}

/** A single drink, as it was counted: one per tap. */
export interface StatsDrink {
  at: number;
  icon: IconKey;
  nameKey?: string;
  name?: string;
  priceCents?: number;
  /** Absent for the phone's owner, as in {@link ArchivedDrink}. */
  person?: string;
  personName?: string;
}

/** A stretch of drinking with no long break in it, oldest drink first. */
export interface Night {
  /** First and last drink, epoch ms. */
  start: number;
  end: number;
  drinks: StatsDrink[];
}

/**
 * The break that ends a night. Long enough that dinner, a walk to the next
 * bar or a late lunch stay one evening; short enough that last night and
 * tonight do not run together even for someone who never resets.
 */
export const NIGHT_GAP = 6 * 60 * 60 * 1000;

/**
 * The round as it stands, or null when nothing was counted. Each person's
 * drinks are filed separately; mine carry no person, as before the table.
 */
export function archiveRound(
  beverages: Beverage[],
  tallies: Record<string, Record<string, Tally>>,
  people: Person[],
): Round | null {
  const drinks: ArchivedDrink[] = [];
  for (const person of people) {
    const own = tallies[person.id] ?? {};
    for (const b of beverages) {
      const times = own[b.id]?.times ?? [];
      if (times.length === 0) continue;
      drinks.push({
        ...(b.nameKey === undefined ? {} : { nameKey: b.nameKey }),
        ...(b.name === undefined ? {} : { name: b.name }),
        icon: b.icon,
        ...(b.priceCents === undefined ? {} : { priceCents: b.priceCents }),
        times,
        ...(person.id === ME ? {} : { person: person.id, personName: person.name ?? '' }),
      });
    }
  }
  if (drinks.length === 0) return null;
  const all = drinks.flatMap((d) => d.times);
  return { startedAt: Math.min(...all), endedAt: Math.max(...all), drinks };
}

/** Local midnight on which the month or year containing `at` begins. */
export function periodStart(at: number, period: 'month' | 'year'): number {
  const d = new Date(at);
  return period === 'year'
    ? new Date(d.getFullYear(), 0, 1).getTime()
    : new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function nameId(d: { nameKey?: string; name?: string }): string {
  // Free-text names group loosely, so "radler " and "Radler" are one drink.
  return d.nameKey !== undefined ? `k:${d.nameKey}` : `n:${(d.name ?? '').trim().toLowerCase()}`;
}

/** Who a stats view is about: one person by id, or the whole table. */
export type StatsWho = string | 'table';

/** Everyone other than Me who has drunk in these rounds, by id, newest name. */
export function othersIn(rounds: readonly Round[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const round of rounds) {
    for (const d of round.drinks) if (d.person !== undefined) names.set(d.person, d.personName ?? '');
  }
  return names;
}

function drinkOf(d: ArchivedDrink, at: number): StatsDrink {
  return {
    at,
    icon: d.icon,
    ...(d.nameKey === undefined ? {} : { nameKey: d.nameKey }),
    ...(d.name === undefined ? {} : { name: d.name }),
    ...(d.priceCents === undefined ? {} : { priceCents: d.priceCents }),
    ...(d.person === undefined ? {} : { person: d.person }),
    ...(d.personName === undefined ? {} : { personName: d.personName }),
  };
}

/**
 * Every drink in these rounds cut into nights, oldest first.
 *
 * Split on time alone, not on the rounds: someone who never resets still
 * gets one night per evening, and a round reset mid-evening does not cut it
 * in two. The breaks are the table's, so a night is the same night in
 * everyone's view; each person then sees only their own drinks in it, and
 * a night they had none of is not one of theirs.
 */
export function nightsOf(rounds: readonly Round[], who: StatsWho = 'table'): Night[] {
  const all = rounds
    .flatMap((round) => round.drinks.flatMap((d) => d.times.map((at) => drinkOf(d, at))))
    .sort((a, b) => a.at - b.at);

  const nights: Night[] = [];
  let night: Night | undefined;
  for (const drink of all) {
    if (!night || drink.at - night.end >= NIGHT_GAP) {
      night = { start: drink.at, end: drink.at, drinks: [] };
      nights.push(night);
    }
    night.end = drink.at;
    night.drinks.push(drink);
  }
  if (who === 'table') return nights;

  return nights.flatMap((n) => {
    const own = n.drinks.filter((d) => (d.person ?? ME) === who);
    const first = own[0];
    const last = own.at(-1);
    return first && last ? [{ start: first.at, end: last.at, drinks: own }] : [];
  });
}

/** Totals and per-glass lines for any set of drinks. */
export function summarize(drinks: readonly StatsDrink[]): StatsSummary {
  const summary: StatsSummary = { drinks: 0, cents: 0, complete: true, anyPriced: false, lines: [] };

  for (const drink of drinks) {
    summary.drinks += 1;
    if (drink.priceCents === undefined) {
      summary.complete = false;
    } else {
      summary.cents += drink.priceCents;
      summary.anyPriced = true;
    }

    let line = summary.lines.find((l) => l.icon === drink.icon);
    if (!line) {
      line = { icon: drink.icon, count: 0, names: [] };
      summary.lines.push(line);
    }
    line.count += 1;

    const id = nameId(drink);
    const entry = line.names.find((n) => nameId(n) === id);
    if (entry) {
      entry.count += 1;
    } else {
      line.names.push({
        ...(drink.nameKey === undefined ? {} : { nameKey: drink.nameKey }),
        ...(drink.name === undefined ? {} : { name: drink.name }),
        count: 1,
      });
    }
  }

  // Ties fall back to the icon picker's order so the list does not shuffle.
  summary.lines.sort(
    (a, b) => b.count - a.count || ICON_KEYS.indexOf(a.icon) - ICON_KEYS.indexOf(b.icon),
  );
  for (const line of summary.lines) line.names.sort((a, b) => b.count - a.count);
  return summary;
}
