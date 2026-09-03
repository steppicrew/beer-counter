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
 *
 * The ceiling is set by the floor, not by taste: the gutter beside the counter
 * is 30px wide and 26px tall, and the heap is drawn at a size that keeps its
 * crown clear of the counter's underside, so it reads as lying in front of the
 * bar rather than propped against it. Three courses of shards is what fits.
 */
export const MAX_SHARDS = 14;

/**
 * Headroom above the floor line, in the grid's own units — the space the upper
 * courses are allowed to occupy. It only has to clear the tallest shard's
 * crown; the pile's size in pixels is set by `PILE_SCALE`, not by this.
 */
export const PILE_HEIGHT = 7;

/**
 * How many pixels one grid unit is drawn at.
 *
 * The pile's real size lives here, and it is the one number that moves it.
 * Pixels-per-unit is pinned by the grid's *width* — however many units are
 * squeezed into the gutter — so making the viewBox taller only pads dead space
 * above the heap and leaves the shards exactly as small as they were. Raising
 * the scale narrows the grid instead, giving every unit more pixels, and the
 * whole pile grows with it.
 *
 * The gutter's 30px is the hard ceiling on the width, and the counter's 26px
 * on the crown.
 */
export const PILE_SCALE = 1.5;

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
  /**
   * How high this piece rests, in SVG units above the floor.
   *
   * A flat row can only get denser, never taller, so it stopped saying
   * anything after the first three glasses — the ones that set the pile's
   * outline. Letting later pieces ride up on the ones below is what makes a
   * long evening look like one.
   */
  y: number;
  /** Which of the drawn silhouettes to use. */
  shape: number;
  /** Degrees; small, since a shard lies where it fell. */
  rotate: number;
  scale: number;
}

/**
 * Shards lie flat rather than standing up, so each piece is wide and low.
 * Upright triangles read as bunting or arrowheads — the giveaway that the
 * first attempt looked like decoration rather than breakage.
 *
 * The pile is laid in courses, bottom-up, because that is the order the
 * glasses arrive in and the heap has to look right at every count, not just
 * when full:
 *
 * - **The floor course** (1-7) spreads the full width of the gutter. Its first
 *   three pieces set the pile's outline, which is why they are the biggest.
 * - **The second course** (8-11) rests in the dips between them, drawn in a
 *   little from either end — a heap narrows as it rises.
 * - **The cap** (12-14) is the few pieces that ended up on top, smaller still
 *   and clustered near the middle where the pile is deepest.
 *
 * Rotations stay small throughout: a shard lies where it fell. They grow a
 * degree or two with height only because a piece landing on an uneven bed
 * settles less flatly than one on the floor.
 */
const SHARD_LAYOUT: readonly Shard[] = [
  // Floor course — sets the width and the silhouette.
  { x: 0.46, y: 0, shape: 0, rotate: -4, scale: 1 },
  { x: 0.16, y: 0, shape: 1, rotate: 9, scale: 0.9 },
  { x: 0.74, y: 0, shape: 2, rotate: -11, scale: 0.95 },
  { x: 0.32, y: 0, shape: 2, rotate: 14, scale: 0.7 },
  { x: 0.6, y: 0, shape: 1, rotate: -7, scale: 0.78 },
  { x: 0.89, y: 0, shape: 0, rotate: 5, scale: 0.68 },
  { x: 0.03, y: 0, shape: 2, rotate: -15, scale: 0.6 },

  // Second course — in the dips, and pulled off the ends. The heights are
  // what the course below actually reaches, not an even step: a shape is
  // ~3 units tall before scaling, so a piece resting on one drawn at 0.7
  // sits lower than one bedded on the full-size shard in the middle.
  { x: 0.3, y: 2.0, shape: 0, rotate: -13, scale: 0.82 },
  { x: 0.62, y: 2.2, shape: 2, rotate: 16, scale: 0.76 },
  { x: 0.14, y: 1.6, shape: 1, rotate: 7, scale: 0.66 },
  { x: 0.8, y: 1.7, shape: 1, rotate: -18, scale: 0.7 },

  // The cap — what came to rest on top, over the deepest part of the heap.
  { x: 0.44, y: 4.1, shape: 1, rotate: -9, scale: 0.72 },
  { x: 0.6, y: 4.3, shape: 0, rotate: 19, scale: 0.6 },
  { x: 0.3, y: 4.5, shape: 2, rotate: -21, scale: 0.56 },
];

export function shardsFor(count: number): Shard[] {
  return SHARD_LAYOUT.slice(0, Math.min(count, MAX_SHARDS));
}
