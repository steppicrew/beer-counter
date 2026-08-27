import type { IconKey } from '../lib/types';

interface Props {
  icon: IconKey;
  className?: string;
}

/**
 * Flat two-tone glyphs on a 24x24 grid. `currentColor` draws the glass, the
 * `--icon-fill` custom property the liquid, so a single icon adapts to both
 * themes and to the tile's accent state.
 */
const PATHS: Record<IconKey, React.ReactNode> = {
  'beer-large': (
    <>
      <path
        d="M6 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        fill="var(--icon-fill)"
      />
      <path d="M5 9h1v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z" fill="none" />
      <path
        d="M6 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm10 5h2a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M5 8h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  'beer-small': (
    <>
      <path d="M8 8h8v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8Z" fill="var(--icon-fill)" />
      <path
        d="M7.5 5h9l-.7 14a1.5 1.5 0 0 1-1.5 1.4H9.7a1.5 1.5 0 0 1-1.5-1.4L7.5 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7.7 9h8.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  'wheat-beer': (
    <>
      <path d="M8 10h9v9a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-9Z" fill="var(--icon-fill)" />
      <path
        d="M8.6 3h7.8l.6 16a2 2 0 0 1-2 2.1h-5A2 2 0 0 1 8 19L8.6 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 11h8.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="12.5" cy="6.5" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  wine: (
    <>
      <path d="M7 4h10c0 4-2 6.5-5 6.5S7 8 7 4Z" fill="var(--icon-fill)" />
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
      <path d="M9 12h6l-.6 7a1 1 0 0 1-1 .9h-2.8a1 1 0 0 1-1-.9L9 12Z" fill="var(--icon-fill)" />
      <path
        d="M8.4 4h7.2l-1.2 15.1a1.5 1.5 0 0 1-1.5 1.4h-1.8a1.5 1.5 0 0 1-1.5-1.4L8.4 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.7 12h6.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  cocktail: (
    <>
      <path d="M5 5h14l-7 7-7-7Z" fill="var(--icon-fill)" />
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
      <path d="M5 10h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-6Z" fill="var(--icon-fill)" />
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
      <path d="M12 6c3 3.8 4.5 6.4 4.5 8.4a4.5 4.5 0 1 1-9 0C7.5 12.4 9 9.8 12 6Z" fill="var(--icon-fill)" />
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
