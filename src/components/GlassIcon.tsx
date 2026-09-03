import type { GlassFill } from '../lib/bartop';
import type { IconKey } from '../lib/types';

interface Props {
  icon: IconKey;
  className?: string;
  /** How much is left in it; defaults to a full glass. */
  fill?: GlassFill;
}

/**
 * Filled silhouettes of the same drinks `BeverageIcon` draws as outlines.
 *
 * The row icons are stroked on a 24x24 grid and read well at 36px, but on the
 * bartop a glass is ~27px tall and a 1.6px stroke closes up into a blob: at
 * that size only a solid shape still says "glass". The liquid line is drawn in
 * the foam colour and clipped to the body so it reads as a fill level rather
 * than a stripe across the glass.
 */
const SHAPES: Record<
  IconKey,
  { body: React.ReactNode; liquid: string; liquidY: number; floor: number; clip: string }
> = {
  'beer-large': {
    body: (
      <>
        <path d="M6 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path
          d="M16 8h2a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </>
    ),
    liquid: 'M5.6 8h9.8',
    liquidY: 8,
    floor: 20.5,
    clip: 'M6 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
  },
  'beer-small': {
    body: <path d="M7.5 5h9l-.7 14a1.5 1.5 0 0 1-1.5 1.4H9.7a1.5 1.5 0 0 1-1.5-1.4L7.5 5Z" />,
    liquid: 'M7.8 9h8.4',
    liquidY: 9,
    floor: 19.8,
    clip: 'M7.5 5h9l-.7 14a1.5 1.5 0 0 1-1.5 1.4H9.7a1.5 1.5 0 0 1-1.5-1.4L7.5 5Z',
  },
  'wheat-beer': {
    body: <path d="M8.6 3h7.8l.6 16a2 2 0 0 1-2 2.1h-5A2 2 0 0 1 8 19L8.6 3Z" />,
    liquid: 'M8.3 8h8.4',
    liquidY: 8,
    floor: 20.6,
    clip: 'M8.6 3h7.8l.6 16a2 2 0 0 1-2 2.1h-5A2 2 0 0 1 8 19L8.6 3Z',
  },
  wine: {
    body: (
      <>
        <path d="M7 3h10v2c0 3.6-2.2 6.2-5 6.2S7 8.6 7 5V3Z" />
        <path
          d="M12 11.2V19m-3.5 2h7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    ),
    liquid: 'M7.3 5.4h9.4',
    liquidY: 5.4,
    floor: 10.6,
    clip: 'M7 3h10v2c0 3.6-2.2 6.2-5 6.2S7 8.6 7 5V3Z',
  },
  schnapps: {
    body: <path d="M8.4 4h7.2l-1.2 15.1a1.5 1.5 0 0 1-1.5 1.4h-1.8a1.5 1.5 0 0 1-1.5-1.4L8.4 4Z" />,
    liquid: 'M8.8 12h6.4',
    liquidY: 12,
    floor: 19.8,
    clip: 'M8.4 4h7.2l-1.2 15.1a1.5 1.5 0 0 1-1.5 1.4h-1.8a1.5 1.5 0 0 1-1.5-1.4L8.4 4Z',
  },
  cocktail: {
    body: (
      <>
        <path d="M5 5h14l-7 7-7-7Z" />
        <path
          d="M12 12v8m-3.5 1h7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </>
    ),
    liquid: 'M6.6 6.6h10.8',
    liquidY: 6.6,
    floor: 11.6,
    clip: 'M5 5h14l-7 7-7-7Z',
  },
  coffee: {
    body: (
      <>
        <path d="M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z" />
        <path
          d="M16 10h1.8a2.6 2.6 0 0 1 0 5.2H16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </>
    ),
    liquid: 'M5.6 10.4h9.8',
    liquidY: 10.4,
    floor: 19.6,
    clip: 'M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z',
  },
  water: {
    body: <path d="M12 3.2c3.7 4.6 5.5 7.8 5.5 10.2a5.5 5.5 0 1 1-11 0c0-2.4 1.8-5.6 5.5-10.2Z" />,
    liquid: 'M7.2 12.6h9.6',
    liquidY: 12.6,
    floor: 18.6,
    clip: 'M12 3.2c3.7 4.6 5.5 7.8 5.5 10.2a5.5 5.5 0 1 1-11 0c0-2.4 1.8-5.6 5.5-10.2Z',
  },
};

/**
 * SVG ids are document-global, so a clip path shared by every glass on the bar
 * would collide. `useId` is not needed here — the key is stable per icon and
 * the shapes are identical, so one clip per drink type is both correct and
 * fewer nodes than one per glass.
 */
export function GlassIcon({ icon, className, fill = 'full' }: Props) {
  const shape = SHAPES[icon];
  const clipId = `glass-clip-${icon}`;

  // The liquid line marks a full glass and `floor` the bottom of the volume,
  // so a partial fill is just that line slid down between the two. An emptied
  // glass keeps a thin heel rather than vanishing: a completely clear glass
  // reads as "no drink here" instead of "you finished this one".
  const drop = shape.floor - shape.liquidY;
  const surfaceY =
    fill === 'full'
      ? shape.liquidY
      : fill === 'half'
        ? shape.liquidY + drop * 0.55
        : shape.floor - 1.4;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={shape.clip} />
        </clipPath>
      </defs>
      {/* The empty part of the glass is drawn as an outline and the drink as
          a solid fill, so a drained glass still reads as glassware standing on
          the bar rather than as a blank gap. */}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.55"
      >
        {shape.body}
      </g>
      <g clipPath={`url(#${clipId})`}>
        <g fill="currentColor">
          <rect x="0" y={surfaceY} width="24" height={24 - surfaceY} />
        </g>
        {fill !== 'empty' && (
          <path
            d={shape.liquid}
            fill="none"
            stroke="var(--glass-foam)"
            strokeWidth="1.6"
            strokeLinecap="round"
            transform={`translate(0 ${surfaceY - shape.liquidY})`}
          />
        )}
      </g>
    </svg>
  );
}
