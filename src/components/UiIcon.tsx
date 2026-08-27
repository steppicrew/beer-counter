interface Props {
  name: 'settings' | 'reset';
  className?: string;
}

/**
 * Header icons as SVG rather than text glyphs. The ⚙/⟲ characters carry
 * uneven internal padding, which left them optically low inside a round
 * button no matter how the box was centred.
 */
const PATHS: Record<Props['name'], React.ReactNode> = {
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2.6a1 1 0 0 1 1 .8l.25 1.6a7.4 7.4 0 0 1 1.72.72l1.32-.94a1 1 0 0 1 1.29.1l1.54 1.54a1 1 0 0 1 .1 1.29l-.94 1.32c.3.54.54 1.12.72 1.72l1.6.25a1 1 0 0 1 .8 1v2.18a1 1 0 0 1-.8 1l-1.6.25a7.4 7.4 0 0 1-.72 1.72l.94 1.32a1 1 0 0 1-.1 1.29l-1.54 1.54a1 1 0 0 1-1.29.1l-1.32-.94a7.4 7.4 0 0 1-1.72.72l-.25 1.6a1 1 0 0 1-1 .8h-2.18a1 1 0 0 1-1-.8l-.25-1.6a7.4 7.4 0 0 1-1.72-.72l-1.32.94a1 1 0 0 1-1.29-.1L4.2 19.05a1 1 0 0 1-.1-1.29l.94-1.32a7.4 7.4 0 0 1-.72-1.72l-1.6-.25a1 1 0 0 1-.8-1v-2.18a1 1 0 0 1 .8-1l1.6-.25c.18-.6.42-1.18.72-1.72l-.94-1.32a1 1 0 0 1 .1-1.29L5.74 4.9a1 1 0 0 1 1.29-.1l1.32.94a7.4 7.4 0 0 1 1.72-.72l.25-1.6a1 1 0 0 1 1-.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </>
  ),
  reset: (
    <>
      <path
        d="M4.4 12a7.6 7.6 0 1 1 2.3 5.44"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M3.1 7.3v4.9h4.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
};

export function UiIcon({ name, className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
