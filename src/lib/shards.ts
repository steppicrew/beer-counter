import type { BarGlass, BarWindow } from './bartop';
import { BRINK_MS } from './bartop';

/**
 * The floor under the left end of the counter.
 *
 * A glass falls when the present pushes it off the left brink, and what is
 * left of it piles up down there. The pile is the round's history made
 * physical: it says "this has been going on a while" at a glance, which the
 * counter alone cannot, since a glass at hour one and a glass at hour five
 * differ only in where they stand.
 */

/**
 * Most shard clusters drawn. Past this the pile stops growing and only the
 * count in the label moves — a heap that grew without limit would climb the
 * screen, and the difference between "a lot" and "rather more" is not worth
 * the pixels.
 */
export const MAX_SHARDS = 7;

/**
 * Whether a glass has dropped off the counter.
 *
 * Keyed on the *window*, not on wall-clock age: dragging the stage into the
 * past is time travel, and there the glass is simply standing on the counter
 * again. So this asks one thing — is it off the left brink of what is drawn —
 * and the answer changes as the view moves, which is exactly what makes a
 * fallen glass rise again when you scroll back to it.
 */
export function hasFallen(glass: BarGlass, window: BarWindow): boolean {
  return glass.at < window.start + BRINK_MS;
}

/**
 * How the pile is drawn for a given number of fallen glasses.
 *
 * Not a physics simulation: a handful of fixed shard shapes, deterministically
 * placed, read better at this size than anything tumbling would, and cost
 * nothing per frame. The seed is the glass's own index so the pile is stable
 * across re-renders — shards that jitter every minute would draw the eye to
 * the one part of the screen that is not news.
 */
export interface Shard {
  /** Fraction across the pile's own width. */
  x: number;
  /** Pixels above the floor line. */
  y: number;
  rotate: number;
  scale: number;
}

const SHARD_LAYOUT: readonly Shard[] = [
  { x: 0.5, y: 0, rotate: -8, scale: 1 },
  { x: 0.22, y: 1, rotate: 14, scale: 0.85 },
  { x: 0.78, y: 0.5, rotate: -22, scale: 0.9 },
  { x: 0.36, y: 4, rotate: 6, scale: 0.7 },
  { x: 0.64, y: 4.5, rotate: -14, scale: 0.75 },
  { x: 0.12, y: 5, rotate: 26, scale: 0.6 },
  { x: 0.88, y: 5.5, rotate: -30, scale: 0.62 },
];

export function shardsFor(count: number): Shard[] {
  return SHARD_LAYOUT.slice(0, Math.min(count, MAX_SHARDS));
}
