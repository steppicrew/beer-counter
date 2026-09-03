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

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** Width given to one hour of counter. The stage is however many fit. */
export const PX_PER_HOUR = 74;

/** Marks every two hours, always — the stage is a fixed width, so a fixed
 *  step keeps their spacing constant instead of rescaling under the glasses. */
export const MARK_STEP_MS = 2 * HOUR_MS;

/**
 * Counter kept clear at each end, in ms.
 *
 * A glass is centred on its timestamp and is ~27px wide, which at 74px/hour is
 * a shade over 11 minutes — so half a glass is ~5.5 minutes and a margin of
 * merely that leaves it flush with the edge. This is a full glass plus a
 * little air, so the drink standing at the newest end is completely on the
 * counter rather than clipped by it, and the opening drink has the same
 * clearance at the other end.
 *
 * It is also the line a glass falls over: once its centre is inside the left
 * margin it is hanging off the end of the bar.
 */
export const BRINK_MS = 16 * MINUTE_MS;

/**
 * The stretch of time the counter currently shows.
 *
 * Unlike the scrolling strip this replaced, the stage is a fixed width and
 * time moves through it: the scale never changes, so a glass never resizes or
 * respaces under a drag.
 *
 * The round still *starts* at the left, exactly as before — the first drink
 * stands just inside the left brink and the evening fills the counter
 * rightward. The window only begins to travel once `now` would fall off the
 * right end: from then on the bar cannot show both the first drink and the
 * present, and the present wins. The run slides left, and what crosses the
 * left brink goes over the edge.
 */
export interface BarWindow {
  start: number;
  end: number;
}

/**
 * The window at rest, before any scrolling back.
 *
 * `offsetMs` drags it further into the past; zero is wherever the bar sits on
 * its own, which is *not* necessarily the present — early in a round it is
 * still anchored to the first drink, with the future spread out to the right.
 */
export function restingWindow(glasses: BarGlass[], now: number, spanMs: number): BarWindow {
  const first = glasses[0]?.at;
  // Nothing counted yet: the counter opens at the present, ready to be filled.
  if (first === undefined) return { start: now - BRINK_MS, end: now - BRINK_MS + spanMs };

  // Anchored to the first drink for as long as the present still fits on the
  // stage. `- BRINK_MS` puts that drink just inside the left edge rather than
  // hanging over it.
  const anchored = first - BRINK_MS;
  if (now <= anchored + spanMs - BRINK_MS) return { start: anchored, end: anchored + spanMs };

  // The evening has outrun the counter, so the right edge takes over and holds
  // the present, keeping it the same distance inside the edge that the first
  // drink had.
  const end = now + BRINK_MS;
  return { start: end - spanMs, end };
}

/** Slides a window further into the past by `offsetMs`. */
export function scrolledBy(window: BarWindow, offsetMs: number): BarWindow {
  return { start: window.start - offsetMs, end: window.end - offsetMs };
}

/**
 * How much is left in a glass.
 *
 * Only the newest drink of each kind can still have anything in it — you
 * nurse one beer at a time, and ordering the next one means the last is
 * finished. Every earlier glass of that kind is empty regardless of age.
 *
 * The current glass then drains with age, on the app's existing sense of time:
 * an hour is where `useRelativeTime` stops counting in minutes, and by then
 * even a slow drinker has finished.
 */
export type GlassFill = 'full' | 'half' | 'empty';

const HALF_AFTER_MS = 20 * MINUTE_MS;
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
 * How far back the stage may be dragged, in ms behind where it rests.
 *
 * Both ends are pinned to something real rather than to open time, so the bar
 * can never be dragged into a void:
 *
 * - `0` is the resting view — the newest end of the round.
 * - `max` puts the *first* drink of the round back at the left brink, which is
 *   the oldest arrangement that still shows it standing.
 *
 * While the round still fits on the counter the two coincide and there is
 * nothing to scroll: everything is already on screen.
 */
export interface ScrollBounds {
  min: number;
  max: number;
}

export function scrollBounds(resting: BarWindow, glasses: BarGlass[]): ScrollBounds {
  const first = glasses[0]?.at;
  if (first === undefined) return { min: 0, max: 0 };

  // How far the resting window has already travelled past the opening drink.
  const anchored = first - BRINK_MS;
  return { min: 0, max: Math.max(0, resting.start - anchored) };
}

/**
 * Position of an instant within the window, 0–1 from the left edge.
 *
 * Deliberately *not* clamped: the stage is a fixed window onto a longer
 * evening, so a glass outside it is genuinely off-stage and the caller decides
 * whether that means "fallen", "not yet poured" or simply "don't draw it".
 * Clamping would stack every past glass on the left edge instead.
 */
export function positionIn(window: BarWindow, at: number): number {
  const span = window.end - window.start;
  if (span <= 0) return 0;
  return (at - window.start) / span;
}

/**
 * Two-hourly marks inside the window, as epoch ms.
 *
 * Only the marks actually on stage are returned. The old adaptive step existed
 * because a strip that grew for days drew marks until it hit a cap and then
 * silently stopped; a fixed-width stage has no such span to cover, so the step
 * can stay constant and the count stays small no matter how old the round is.
 */
export function hourMarks(window: BarWindow): number[] {
  const marks: number[] = [];

  // Snap to a 2-hour boundary in *local* time, so marks land on even hours of
  // the clock. Aligning on the epoch would drift in any zone that is not a
  // whole number of hours from UTC.
  const cursor = new Date(window.start);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(Math.floor(cursor.getHours() / 2) * 2);

  let at = cursor.getTime();
  while (at < window.start) at += MARK_STEP_MS;

  // A DST jump makes the local step briefly 1h or 3h; recomputing from the
  // Date rather than adding a constant keeps the marks on even local hours.
  while (at <= window.end) {
    marks.push(at);
    const next = new Date(at);
    next.setHours(next.getHours() + 2, 0, 0, 0);
    at = next.getTime();
  }

  return marks;
}

/**
 * Whether a mark needs a date rather than just an hour.
 *
 * Scrolled back far enough, "22" alone is ambiguous — it could be tonight or
 * three nights ago. The day only gets named when the mark is not on the same
 * calendar day as the round's present.
 */
export function marksAnotherDay(at: number, now: number): boolean {
  const a = new Date(at);
  const b = new Date(now);
  return (
    a.getDate() !== b.getDate() ||
    a.getMonth() !== b.getMonth() ||
    a.getFullYear() !== b.getFullYear()
  );
}
