import type { GlassFill } from '../lib/bartop';
import { hasFoam, liquidVar } from '../lib/liquids';
import type { IconKey } from '../lib/types';

interface Props {
  icon: IconKey;
  className?: string;
  /** How much is left in it; defaults to a full glass. */
  fill?: GlassFill;
}

/**
 * One drawing of each drink, used everywhere it appears: the counting rows,
 * the picker, the statistics and the glasses on the bar.
 *
 * Line art on a 24x24 grid. The glassware is always `--text-muted`, never the
 * colour of the text around it, so a beer on a row and the same beer on the
 * bar are one drawing. The drink's own `--liquid-*` token fills it, and a
 * beer wears a white head. The drink is masked to the inside of the glass,
 * so its surface can sit anywhere: a row shows the glass full, and on the bar
 * the same glass drains as it ages (see `glassFill`), the head riding down
 * on the beer. An emptied glass keeps a faint heel rather than vanishing — a
 * completely clear glass reads as "no drink here" instead of "you finished
 * this one".
 *
 * Bubbles sit at the foot of the head, bulging down into the beer.
 * Overlapping circles rather than a wavy edge: at 36px a shallow curve
 * flattens into a straight line, while the circles still read as foam
 * settling into the drink.
 */
interface Shape {
  /** The glass, stroked. Drawn last, over the drink. */
  outline: React.ReactNode;
  /** The inside of the glass: what the drink is masked to. */
  clip: string;
  /** Where the surface sits when full and where the volume ends, in grid units. */
  liquidY: number;
  floor: number;
  /** How deep the head is on a full beer; a lower surface carries a shallower one. */
  headDepth?: number;
  /** The head's bubbles, placed from the head's lower edge. */
  bubbles?: readonly { cx: number; r: number; dy?: number }[];
  /** Anything the drink does not cover: a garnish, steam. */
  extra?: React.ReactNode;
}

const STROKE = { fill: 'none', stroke: 'var(--text-muted)', strokeWidth: 1.6, strokeLinejoin: 'round' } as const;

const SHAPES: Record<IconKey, Shape> = {
  'beer-large': {
    outline: (
      <path
        d="M6 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm10 5h2a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2"
        {...STROKE}
      />
    ),
    clip: 'M6 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z',
    liquidY: 3.5,
    floor: 20.5,
    headDepth: 4.5,
    bubbles: [
      { cx: 6.8, r: 1.45 },
      { cx: 10.2, r: 1.75, dy: 0.35 },
      { cx: 13.8, r: 1.35 },
    ],
  },
  'beer-small': {
    outline: (
      <path
        d="M7.5 5h9l-.7 14a1.5 1.5 0 0 1-1.5 1.4H9.7a1.5 1.5 0 0 1-1.5-1.4L7.5 5Z"
        {...STROKE}
      />
    ),
    clip: 'M7.5 5h9l-.7 14a1.5 1.5 0 0 1-1.5 1.4H9.7a1.5 1.5 0 0 1-1.5-1.4L7.5 5Z',
    liquidY: 5.5,
    floor: 19.8,
    headDepth: 3.5,
    bubbles: [
      { cx: 9.2, r: 1.15 },
      { cx: 12, r: 1.45, dy: 0.35 },
      { cx: 14.8, r: 1.1 },
    ],
  },
  // The Weizen glass: flared bell, pinched waist, bulged body. The silhouette
  // is the whole point — it is what separates this from the straight-sided
  // glasses beside it. Poured full, the head is the whole bell down to the
  // waist, the way a wheat beer's is, and the beer fills the body below.
  'wheat-beer': {
    outline: (
      <path
        d="M8.9 3.4h6.2a.7.7 0 0 1 .7.8l-.9 4.6a3 3 0 0 0-.1 1.2l1 8.3a2.5 2.5 0 0 1-2.5 2.8h-2.6a2.5 2.5 0 0 1-2.5-2.8l1-8.3a3 3 0 0 0-.1-1.2l-.9-4.6a.7.7 0 0 1 .7-.8Z"
        {...STROKE}
        strokeWidth={1.5}
      />
    ),
    clip: 'M8.9 3.4h6.2a.7.7 0 0 1 .7.8l-.9 4.6a3 3 0 0 0-.1 1.2l1 8.3a2.5 2.5 0 0 1-2.5 2.8h-2.6a2.5 2.5 0 0 1-2.5-2.8l1-8.3a3 3 0 0 0-.1-1.2l-.9-4.6a.7.7 0 0 1 .7-.8Z',
    liquidY: 3.6,
    floor: 19.6,
    headDepth: 6.2,
    bubbles: [
      { cx: 10.2, r: 1.05 },
      { cx: 12.4, r: 1.3, dy: 0.3 },
      { cx: 14.5, r: 0.95 },
    ],
  },
  wine: {
    outline: (
      <path
        d="M7 3h10v2c0 3.6-2.2 6.2-5 6.2S7 8.6 7 5V3Zm5 8.2V19m-3.5 2h7"
        {...STROKE}
        strokeLinecap="round"
      />
    ),
    clip: 'M7 3h10v2c0 3.6-2.2 6.2-5 6.2S7 8.6 7 5V3Z',
    liquidY: 4,
    floor: 10.6,
  },
  schnapps: {
    outline: (
      <path
        d="M8.4 4h7.2l-1.2 15.1a1.5 1.5 0 0 1-1.5 1.4h-1.8a1.5 1.5 0 0 1-1.5-1.4L8.4 4Z"
        {...STROKE}
      />
    ),
    clip: 'M8.4 4h7.2l-1.2 15.1a1.5 1.5 0 0 1-1.5 1.4h-1.8a1.5 1.5 0 0 1-1.5-1.4L8.4 4Z',
    liquidY: 12,
    floor: 19.8,
  },
  cocktail: {
    outline: (
      <path d="M4 4h16l-8 8-8-8Zm8 8v8m-4 0h8" {...STROKE} strokeLinecap="round" />
    ),
    clip: 'M5 5h14l-7 7-7-7Z',
    liquidY: 5,
    floor: 11.6,
    extra: <circle cx="17" cy="6.5" r="1.6" fill="var(--text-muted)" />,
  },
  coffee: {
    outline: (
      <path
        d="M4 9h13v7a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 4 16V9Zm13 2h1.5a2.5 2.5 0 0 1 0 5H17"
        {...STROKE}
      />
    ),
    clip: 'M5 10h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-6Z',
    liquidY: 10,
    floor: 19.6,
    extra: (
      <path d="M8 3v2.5M12 3v2.5" {...STROKE} strokeWidth={1.5} strokeLinecap="round" />
    ),
  },
  water: {
    outline: (
      <path
        d="M12 3.2c3.7 4.6 5.5 7.8 5.5 10.2a5.5 5.5 0 1 1-11 0c0-2.4 1.8-5.6 5.5-10.2Z"
        {...STROKE}
      />
    ),
    clip: 'M12 3.2c3.7 4.6 5.5 7.8 5.5 10.2a5.5 5.5 0 1 1-11 0c0-2.4 1.8-5.6 5.5-10.2Z',
    liquidY: 5.6,
    floor: 18.6,
  },
};

/** A head on a beer that is no longer full: shallower than the one it was poured with. */
const SETTLED_HEAD_DEPTH = 2.6;

/**
 * SVG ids are document-global, so a mask shared by every glass on the page
 * would collide. `useId` is not needed here — the key is stable per icon and
 * the shapes are identical, so one mask per drink type is both correct and
 * fewer nodes than one per glass.
 */
export function BeverageIcon({ icon, className, fill = 'full' }: Props) {
  const shape = SHAPES[icon];
  const maskId = `glass-inside-${icon}`;

  // The surface line marks a full glass and `floor` the bottom of the volume,
  // so a partial fill is just that line slid down between the two.
  const drop = shape.floor - shape.liquidY;
  const surfaceY =
    fill === 'full'
      ? shape.liquidY
      : fill === 'half'
        ? shape.liquidY + drop * 0.55
        : shape.floor - 1.4;

  // A drained glass shows the counter through it rather than a pale version of
  // the drink — the drink is gone, and tinting the dregs would keep claiming
  // there is still something in it. The heel is the last smear, kept faint so
  // it reads as a used glass rather than as a dark measure still standing.
  const liquidColor = fill === 'empty' ? 'var(--glass-drained)' : liquidVar(icon);
  const liquidOpacity = fill === 'empty' ? 0.45 : 1;

  // The head rides on the surface, so it drops with the beer. It is only worth
  // drawing while there is beer under it: on the heel left in an empty glass
  // the head would be the whole remaining volume.
  const showHead = hasFoam(icon) && fill !== 'empty';
  const headDepth = fill === 'full' ? (shape.headDepth ?? SETTLED_HEAD_DEPTH) : SETTLED_HEAD_DEPTH;
  const headFoot = surfaceY + headDepth;

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
        {/* The drink fills the glass up to the *inside* of its rim: the
            glass's shape, minus the rim's stroke. A plain clip stops at the
            outer edge, and through the half-transparent rim the drink then
            showed right out to the border, as if spilling over it. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <path d={shape.clip} fill="#fff" stroke="#000" strokeWidth="1.5" strokeLinejoin="round" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <rect
          x="0"
          y={surfaceY}
          width="24"
          height={24 - surfaceY}
          fill={liquidColor}
          opacity={liquidOpacity}
        />
        {showHead && (
          <g fill="var(--liquid-head)">
            <rect x="0" y={surfaceY} width="24" height={headDepth} />
            {/* Bubbles breaking the head's lower edge. Masked to the glass
                like everything else, so they only show where there is foam. */}
            {shape.bubbles?.map((bubble, i) => (
              <circle key={i} cx={bubble.cx} cy={headFoot + (bubble.dy ?? 0)} r={bubble.r} />
            ))}
          </g>
        )}
        {/* The surface highlight: the one thing keeping a flat fill from
            reading as a coloured block. A beer does not get it — the head is
            already the light band at the surface, and a second white line
            over it just rules a hard edge across the foam. A drained glass
            gets none either. */}
        {fill !== 'empty' && !showHead && (
          <path
            d={`M0 ${surfaceY}h24`}
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.2"
            strokeOpacity="0.28"
          />
        )}
      </g>
      {shape.extra}
      {shape.outline}
    </svg>
  );
}
