import type { Beverage, Tally } from './types';

export interface Totals {
  /** Number of drinks counted, regardless of pricing. */
  drinks: number;
  /** Sum over priced drinks only, in minor units. */
  cents: number;
  /** True when every drink with a count > 0 has a price. */
  complete: boolean;
  /** True when at least one counted drink is priced. */
  anyPriced: boolean;
}

const EMPTY: Tally = { times: [] };

/**
 * A running total is only trustworthy if everything counted is priced —
 * otherwise the sum silently understates the bill. `complete` lets the UI
 * show the figure as provisional instead of pretending it is the total.
 */
export function computeTotals(
  beverages: Beverage[],
  tallies: Record<string, Tally>,
): Totals {
  let drinks = 0;
  let cents = 0;
  let complete = true;
  let anyPriced = false;

  for (const beverage of beverages) {
    const count = (tallies[beverage.id] ?? EMPTY).times.length;
    if (count === 0) continue;

    drinks += count;

    if (beverage.priceCents === undefined) {
      complete = false;
    } else {
      cents += beverage.priceCents * count;
      anyPriced = true;
    }
  }

  return { drinks, cents, complete, anyPriced };
}

/** Line total for a single drink, or null when it has no price. */
export function lineTotal(beverage: Beverage, tally: Tally): number | null {
  if (beverage.priceCents === undefined) return null;
  return beverage.priceCents * tally.times.length;
}
