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
export function ShardPile({ count, className }: Props) {
  const shards = shardsFor(count);
  if (shards.length === 0) return null;

  return (
    <svg
      className={className}
      viewBox="0 0 32 12"
      width="32"
      height="12"
      aria-hidden="true"
      focusable="false"
    >
      {shards.map((shard, i) => (
        <polygon
          key={i}
          // A sliver of glass: narrow, uneven, and catching the light on one
          // edge. Three points is enough at 6px — anything more detailed just
          // fills in to a blob.
          points="0,0 3.4,-5.2 5.6,0"
          fill="var(--shard)"
          stroke="var(--shard-edge)"
          strokeWidth="0.4"
          strokeLinejoin="round"
          transform={`translate(${shard.x * 26 + 1} ${11 - shard.y}) rotate(${shard.rotate}) scale(${shard.scale})`}
        />
      ))}
    </svg>
  );
}
