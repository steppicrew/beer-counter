import { shardsFor } from '../lib/shards';

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

export function ShardPile({ count, className }: Props) {
  const shards = shardsFor(count);
  if (shards.length === 0) return null;

  return (
    <svg
      className={className}
      // Drawn on a 34x8 grid: wide and low, because the pieces lie flat. It is
      // rendered larger than 1:1 — at native size a shard was a five-pixel
      // speck, and the pile has to be legible at a glance to say anything.
      viewBox="0 0 34 8"
      width="44"
      height="10"
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
          transform={`translate(${shard.x * 26 + 5} ${7.4}) rotate(${shard.rotate}) scale(${shard.scale})`}
        />
      ))}
    </svg>
  );
}
