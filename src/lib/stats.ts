import type { ArchivedDrink, Beverage, IconKey, Round, Tally } from './types';
import { ICON_KEYS } from './types';

export type StatsPeriod = 'week' | 'month' | 'year';

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

export interface PeriodStats {
  /** Local midnight at which the period begins, epoch ms. */
  start: number;
  /** Local midnight at which the next period begins, epoch ms. */
  end: number;
  drinks: number;
  rounds: number;
  /** Sum over priced drinks only, in minor units — see `computeTotals`. */
  cents: number;
  complete: boolean;
  anyPriced: boolean;
  /** Most drunk first. */
  lines: StatsLine[];
}

/** The round as it stands, or null when nothing was counted. */
export function archiveRound(beverages: Beverage[], tallies: Record<string, Tally>): Round | null {
  const drinks: ArchivedDrink[] = [];
  for (const b of beverages) {
    const times = tallies[b.id]?.times ?? [];
    if (times.length === 0) continue;
    drinks.push({
      ...(b.nameKey === undefined ? {} : { nameKey: b.nameKey }),
      ...(b.name === undefined ? {} : { name: b.name }),
      icon: b.icon,
      ...(b.priceCents === undefined ? {} : { priceCents: b.priceCents }),
      times,
    });
  }
  if (drinks.length === 0) return null;
  const all = drinks.flatMap((d) => d.times);
  return { startedAt: Math.min(...all), endedAt: Math.max(...all), drinks };
}

/**
 * First day of the week as a JS weekday (0 = Sunday). The app locale is only
 * a language ("en"), which would put every English speaker on the US Sunday
 * week, so the region comes from the browser's own preference list when it
 * names the same language. Engines without week info fall back to Monday.
 */
export function firstDayOfWeek(locale: string, preferred: readonly string[]): number {
  const tag = preferred.find((p) => p.toLowerCase().split('-')[0] === locale) ?? locale;
  try {
    const loc = new Intl.Locale(tag) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    // Intl reports 1 = Monday … 7 = Sunday; older Chromium exposed a getter.
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info) return info.firstDay % 7;
  } catch {
    // An unparseable browser tag is no reason to break the sheet.
  }
  return 1;
}

/** Local-time bounds of the period containing `at`. */
export function periodBounds(
  at: number,
  period: StatsPeriod,
  weekStart: number,
): { start: number; end: number } {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = d.getMonth();
  switch (period) {
    case 'year':
      return { start: new Date(y, 0, 1).getTime(), end: new Date(y + 1, 0, 1).getTime() };
    case 'month':
      return { start: new Date(y, m, 1).getTime(), end: new Date(y, m + 1, 1).getTime() };
    case 'week': {
      // Built from calendar fields rather than by subtracting 7 × 24h, which
      // would land an hour off across a DST change.
      const back = (d.getDay() - weekStart + 7) % 7;
      const day = d.getDate() - back;
      return {
        start: new Date(y, m, day).getTime(),
        end: new Date(y, m, day + 7).getTime(),
      };
    }
  }
}

function nameId(d: { nameKey?: string; name?: string }): string {
  // Free-text names group loosely, so "radler " and "Radler" are one drink.
  return d.nameKey !== undefined ? `k:${d.nameKey}` : `n:${(d.name ?? '').trim().toLowerCase()}`;
}

/**
 * Buckets rounds into periods, newest first. A round is filed whole under the
 * period its first drink falls in: a Saturday night that runs past midnight
 * into Sunday — or into a new month — stays one night rather than being split.
 */
export function computeStats(
  rounds: readonly Round[],
  period: StatsPeriod,
  weekStart: number,
): PeriodStats[] {
  const buckets = new Map<number, PeriodStats>();

  for (const round of rounds) {
    const { start, end } = periodBounds(round.startedAt, period, weekStart);
    let bucket = buckets.get(start);
    if (!bucket) {
      bucket = { start, end, drinks: 0, rounds: 0, cents: 0, complete: true, anyPriced: false, lines: [] };
      buckets.set(start, bucket);
    }
    bucket.rounds += 1;

    for (const drink of round.drinks) {
      const count = drink.times.length;
      if (count === 0) continue;
      bucket.drinks += count;

      if (drink.priceCents === undefined) {
        bucket.complete = false;
      } else {
        bucket.cents += drink.priceCents * count;
        bucket.anyPriced = true;
      }

      let line = bucket.lines.find((l) => l.icon === drink.icon);
      if (!line) {
        line = { icon: drink.icon, count: 0, names: [] };
        bucket.lines.push(line);
      }
      line.count += count;

      const id = nameId(drink);
      const entry = line.names.find((n) => nameId(n) === id);
      if (entry) {
        entry.count += count;
      } else {
        line.names.push({
          ...(drink.nameKey === undefined ? {} : { nameKey: drink.nameKey }),
          ...(drink.name === undefined ? {} : { name: drink.name }),
          count,
        });
      }
    }
  }

  const result = [...buckets.values()].sort((a, b) => b.start - a.start);
  for (const bucket of result) {
    // Ties fall back to the icon picker's order so the list does not shuffle.
    bucket.lines.sort(
      (a, b) => b.count - a.count || ICON_KEYS.indexOf(a.icon) - ICON_KEYS.indexOf(b.icon),
    );
    for (const line of bucket.lines) line.names.sort((a, b) => b.count - a.count);
  }
  return result;
}
