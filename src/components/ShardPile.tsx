import { PILE_HEIGHT, PILE_SCALE, shardsFor } from '../lib/shards';

interface Props {
  count: number;
  className?: string;
}

/**
 * What is left of the glasses that have gone over the left end of the counter.
 *
 * Drawn as one SVG rather than a node per shard: at this size the whole pile is
 * about 30px across, and a handful of triangles in one element keeps the DOM
 * flat however long the evening runs.
 */
/**
 * Three silhouettes, all wider than they are tall: a shard on a bar top lies
 * down. Drawn from the origin, which is the point it rests on.
 */
const SHAPES = [
  'M-4.2,0 L-2.9,-2.8 L0.9,-3.4 L4.1,0 Z',
  'M-3.4,0 L-1.2,-2.2 L2.6,-1.6 L3.4,0 Z',
  'M-2.8,0 L-0.6,-3.1 L2.2,-1.2 L3.0,0 Z',
];

/** The gutter beside the counter, from `$bar-inset` in Bartop.scss. */
const GUTTER_PX = 30;

/** Drawn a shade inside the gutter so the pile is not flush against the edge. */
const PILE_PX_W = GUTTER_PX - 2;

/** How many grid units fit across that width at the chosen scale. */
const GRID_W = PILE_PX_W / PILE_SCALE;

/** Margin kept clear at each end, so a rotated shard cannot hang off the grid. */
const EDGE = 4;

/** The floor the shards rest on, with `PILE_HEIGHT` of air above it. */
const FLOOR_Y = PILE_HEIGHT + 3.4;

export function ShardPile({ count, className }: Props) {
  const shards = shardsFor(count);
  if (shards.length === 0) return null;

  return (
    <svg
      className={className}
      // Wide and low, because the pieces lie flat — but with headroom now for
      // the heap to build up rather than only spread out.
      //
      // The box is derived, not typed in: `PILE_SCALE` says how big a unit is
      // drawn, and the grid is however many units fit the gutter at that size.
      // Scaling up therefore *narrows* the viewBox, which is what makes the
      // shards bigger — the width is what pins pixels-per-unit, so a taller box
      // alone would only add dead air above the pile.
      viewBox={`0 0 ${GRID_W} ${FLOOR_Y + 0.6}`}
      width={PILE_PX_W}
      height={Math.round((FLOOR_Y + 0.6) * PILE_SCALE)}
      aria-hidden="true"
      focusable="false"
    >
      {shards.map((shard, i) => (
        <path
          key={i}
          d={SHAPES[shard.shape]}
          fill="var(--shard)"
          // Lit along the top edge only, the way a chip of glass catches the
          // light from behind the bar. A full outline made them read as solid
          // objects rather than as something transparent.
          stroke="var(--shard-edge)"
          strokeWidth="0.3"
          strokeLinejoin="round"
          // Laid out across whatever width the grid ended up with, on a floor
          // line that leaves `PILE_HEIGHT` of headroom above it for the stack.
          transform={`translate(${shard.x * (GRID_W - 2 * EDGE) + EDGE} ${FLOOR_Y - shard.y}) rotate(${shard.rotate}) scale(${shard.scale})`}
        />
      ))}
    </svg>
  );
}
