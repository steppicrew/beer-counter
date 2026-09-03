import type { IconKey } from '../lib/types';

interface Props {
  icon: IconKey;
  className?: string;
}

/**
 * Two-tone glyphs on a 24x24 grid. `currentColor` draws the glassware and the
 * drink's own `--liquid-*` token the contents, so a beer is golden under a
 * white head, a wine is red and a water is blue wherever the icon appears.
 *
 * The liquid colours are named literally here rather than composed at runtime:
 * each drink's body is a different shape anyway, so there is no single fill to
 * parameterise. Callers that need an icon to recede — the picker's unselected
 * options — dim the whole glyph instead, which keeps the drink identifiable.
 */
const PATHS: Record<IconKey, React.ReactNode> = {
  'beer-large': (
    <>
      <path
        d="M6 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        fill="var(--liquid-beer-large)"
      />
      {/* The head, with bubbles bulging down into the beer — the same foam
          the bartop glasses carry. Overlapping circles rather than a wavy
          edge: at 36px a shallow curve flattens into a straight line, while
          the circles still read as foam settling into the drink. */}
      <g fill="var(--liquid-head)">
        <path d="M6 3h9a1 1 0 0 1 1 1v4H5V4a1 1 0 0 1 1-1Z" />
        <circle cx="6.8" cy="8" r="1.45" />
        <circle cx="10.2" cy="8.35" r="1.75" />
        <circle cx="13.8" cy="8" r="1.35" />
      </g>
      <path d="M5 9h1v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z" fill="none" />
      <path
        d="M6 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm10 5h2a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </>
  ),
  'beer-small': (
    <>
      <path d="M8 8h8v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8Z" fill="var(--liquid-beer-small)" />
      <g fill="var(--liquid-head)">
        <path d="M7.6 5h8.8l-.15 4H7.75L7.6 5Z" />
        <circle cx="9.2" cy="9" r="1.15" />
        <circle cx="12" cy="9.35" r="1.45" />
        <circle cx="14.8" cy="9" r="1.1" />
      </g>
      <path
        d="M7.5 5h9l-.7 14a1.5 1.5 0 0 1-1.5 1.4H9.7a1.5 1.5 0 0 1-1.5-1.4L7.5 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </>
  ),
  'wheat-beer': (
    <>
      {/* The beer: it fills the bulged lower body, below the pinched waist. */}
      <path
        d="M9.35 9.8h5.3l.95 7.9a2.3 2.3 0 0 1-2.3 2.6h-2.6a2.3 2.3 0 0 1-2.3-2.6l.95-7.9Z"
        fill="var(--liquid-wheat-beer)"
      />
      {/* The head, doming over the rim the way a wheat beer's actually does —
          the flared bell is there to hold it, so it has to sit proud. */}
      <path
        d="M8.7 6.4c0-1.6 1.5-2.8 3.3-2.8s3.3 1.2 3.3 2.8l-.5 3.4H9.2L8.7 6.4Z"
        fill="var(--liquid-head)"
      />
      {/* Bubbles bulging into the beer, as on the bartop glasses. */}
      <g fill="var(--liquid-head)">
        <circle cx="10.2" cy="9.8" r="1.05" />
        <circle cx="12.4" cy="10.1" r="1.3" />
        <circle cx="14.5" cy="9.8" r="0.95" />
      </g>
      {/* The Weizen outline in one stroke: flared bell, pinched waist, bulged
          body. The silhouette is the whole point — it is what separates this
          from the straight-sided glasses above it. */}
      <path
        d="M8.9 3.4h6.2a.7.7 0 0 1 .7.8l-.9 4.6a3 3 0 0 0-.1 1.2l1 8.3a2.5 2.5 0 0 1-2.5 2.8h-2.6a2.5 2.5 0 0 1-2.5-2.8l1-8.3a3 3 0 0 0-.1-1.2l-.9-4.6a.7.7 0 0 1 .7-.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </>
  ),
  wine: (
    <>
      <path d="M7 4h10c0 4-2 6.5-5 6.5S7 8 7 4Z" fill="var(--liquid-wine)" />
      <path
        d="M7 3h10v2c0 3.6-2.2 6.2-5 6.2S7 8.6 7 5V3Zm5 8.2V19m-3.5 2h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  schnapps: (
    <>
      <path d="M9 12h6l-.6 7a1 1 0 0 1-1 .9h-2.8a1 1 0 0 1-1-.9L9 12Z" fill="var(--liquid-schnapps)" />
      {/* The surface. A clear spirit needs a line to show where the fill sits,
          but the full-weight rule the other drinks used read as a divider
          cutting the glass in two — this is thin and faint enough to be the
          liquid's own edge. */}
      <path
        d="M9 12h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeOpacity="0.45"
        strokeLinecap="round"
      />
      <path
        d="M8.4 4h7.2l-1.2 15.1a1.5 1.5 0 0 1-1.5 1.4h-1.8a1.5 1.5 0 0 1-1.5-1.4L8.4 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </>
  ),
  cocktail: (
    <>
      <path d="M5 5h14l-7 7-7-7Z" fill="var(--liquid-cocktail)" />
      <path
        d="M4 4h16l-8 8-8-8Zm8 8v8m-4 0h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17" cy="6.5" r="1.6" fill="currentColor" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 10h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-6Z" fill="var(--liquid-coffee)" />
      <path
        d="M4 9h13v7a4.5 4.5 0 0 1-4.5 4.5h-4A4.5 4.5 0 0 1 4 16V9Zm13 2h1.5a2.5 2.5 0 0 1 0 5H17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 3v2.5M12 3v2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  ),
  water: (
    <>
      <path
        d="M12 6c3 3.8 4.5 6.4 4.5 8.4a4.5 4.5 0 1 1-9 0C7.5 12.4 9 9.8 12 6Z"
        fill="var(--liquid-water)"
      />
      <path
        d="M12 3.2c3.7 4.6 5.5 7.8 5.5 10.2a5.5 5.5 0 1 1-11 0c0-2.4 1.8-5.6 5.5-10.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </>
  ),
};

export function BeverageIcon({ icon, className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[icon]}
    </svg>
  );
}
