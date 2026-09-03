import type { Beverage, IconKey, Tally } from './types';

/** One drink on the counter: when it was tapped and what it looked like. */
export interface BarGlass {
  /** Epoch ms of the tap. */
  at: number;
  icon: IconKey;
  /** Beverage id, so a glass can point back at its row. */
  beverageId: string;
  /**
   * The newest glass of this beverage — the only one that can still hold
   * anything, since ordering the next one finishes the last.
   */
  isCurrent: boolean;
}

/**
 * The stretch of time the counter draws.
 *
 * `start` is pinned to the first drink of the round rather than to `now`, so
 * the evening fills the bar left to right and the glasses never slide around
 * under a tap. Before anything is counted there is no first drink to pin to,
 * and the window simply starts now.
 */
export interface BarWindow {
  start: number;
  end: number;
}

/** Hours of bar shown before it has to scroll. */
export const WINDOW_HOURS = 4;

const HOUR_MS = 3_600_000;
export const WINDOW_MS = WINDOW_HOURS * HOUR_MS;

/**
 * Counter drawn to the left of the first drink, so it has somewhere to stand.
 *
 * A glass is centred on its timestamp and is about 27px wide, which at the
 * counter's scale of 74px per hour is a shade over 11 minutes — so anything
 * less than that leaves the opening glass hanging over the left edge.
 */
const LEAD_IN_MS = 14 * 60_000;

/**
 * How much is left in a glass.
 *
 * Only the newest drink of each kind can still have anything in it — you
 * nurse one beer at a time, and ordering the next one means the last is
 * finished. Every earlier glass of that kind is empty regardless of age, so a
 * round of five beers is four empties and one you are still working on.
 *
 * The current glass then drains with age, on the app's existing sense of time:
 * an hour is where `useRelativeTime` stops counting in minutes, and by then
 * even a slow drinker has finished.
 */
export type GlassFill = 'full' | 'half' | 'empty';

const HALF_AFTER_MS = 20 * 60_000;
const EMPTY_AFTER_MS = HOUR_MS;

export function glassFill(at: number, now: number, isCurrent: boolean): GlassFill {
  if (!isCurrent) return 'empty';

  const age = now - at;
  if (age < HALF_AFTER_MS) return 'full';
  if (age < EMPTY_AFTER_MS) return 'half';
  return 'empty';
}

/** Flattens the per-beverage tallies into one chronological run of glasses. */
export function collectGlasses(beverages: Beverage[], tallies: Record<string, Tally>): BarGlass[] {
  const glasses: BarGlass[] = [];

  for (const beverage of beverages) {
    const times = tallies[beverage.id]?.times;
    if (!times) continue;
    // `times` is already oldest-first, so the last entry is the drink of this
    // kind still in hand.
    const currentAt = times.at(-1);
    for (const at of times) {
      glasses.push({
        at,
        icon: beverage.icon,
        beverageId: beverage.id,
        isCurrent: at === currentAt,
      });
    }
  }

  // Each beverage's own times are already ordered; interleaving them is not.
  return glasses.sort((a, b) => a.at - b.at);
}

/**
 * The window to draw for a given round.
 *
 * It always spans at least `WINDOW_HOURS` — early in the evening that means
 * most of the counter is still empty future, which is the point: the first
 * beer stands at the left and the night fills the bar as it goes. Once the
 * round outruns four hours the window keeps its left edge and grows rightward,
 * so the track scrolls instead of rescaling.
 */
export function barWindow(glasses: BarGlass[], now: number): BarWindow {
  // A few minutes of counter before the first drink. Without it the opening
  // glass sits exactly on the left edge and is drawn half outside the track —
  // and a first round is several taps in quick succession, so they pile up
  // there together.
  //
  // The empty counter uses the same offset, so the "now" marker already stands
  // where the first drink will land. Anchoring an empty bar at `now` itself put
  // the marker hard against the right edge, and the first tap then re-anchored
  // the window and threw it back to the left.
  const first = (glasses[0]?.at ?? now) - LEAD_IN_MS;
  // A clock correction (or an imported round) can leave a tap in the future;
  // the window must still contain `now` or the marker falls off the end.
  const last = Math.max(glasses.at(-1)?.at ?? now, now);

  return { start: first, end: Math.max(first + WINDOW_MS, last) };
}

/**
 * Position of an instant within the window, 0–1 from the left edge.
 *
 * Clamped because the clock and the taps are not read at the same moment: the
 * bar's `now` is sampled once a minute while a tap stamps `Date.now()`, so the
 * first glass of a round is usually a few milliseconds *after* the cached now.
 * Left unclamped that put the marker at a fractionally negative offset, far
 * enough outside the track to clip it.
 */
export function positionIn(window: BarWindow, at: number): number {
  const span = window.end - window.start;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (at - window.start) / span));
}

/**
 * Whole-hour marks inside the window, as epoch ms.
 *
 * The first mark is the hour boundary at or after `start`, so the labels read
 * as clock times ("21") rather than as offsets from an arbitrary first sip.
 *
 * The step widens with the span. A tab left open for days is a real state —
 * counts survive until the next reset — and marking every hour of it would
 * both crowd the counter and, when this was capped at a fixed number of marks,
 * simply stop drawing them partway along the bar.
 */
export function hourMarks(window: BarWindow): number[] {
  const span = window.end - window.start;
  const step = markStep(span);
  const marks: number[] = [];

  // Snap to a boundary of the step in *local* time, so a 3-hourly run lands on
  // 00:00, 03:00, 06:00 on the clock. Aligning on the epoch instead would drift
  // in any zone that is not a whole number of hours from UTC.
  const stepHours = step / HOUR_MS;
  const cursor = new Date(window.start);
  cursor.setMinutes(0, 0, 0);
  if (stepHours > 1) {
    cursor.setHours(Math.floor(cursor.getHours() / stepHours) * stepHours);
  }
  let at = cursor.getTime();
  while (at < window.start) at += step;

  while (at <= window.end) {
    marks.push(at);
    at += step;
  }

  return marks;
}

/** Hours between marks, chosen so a span never draws more than ~14 of them. */
function markStep(span: number): number {
  for (const hours of [1, 2, 3, 6, 12, 24, 48]) {
    if (span / (hours * HOUR_MS) <= 14) return hours * HOUR_MS;
  }
  return 7 * 24 * HOUR_MS;
}
