interface Props {
  className?: string;
}

/**
 * Stands behind an empty counter so the bar reads as furnished rather than
 * broken before the first drink.
 *
 * Head, shoulders and a moustache and nothing else: props (a glass, a cloth)
 * were tried and collapse into floating rectangles by ~22px, and folded arms
 * disappear into the shoulders. The moustache is the one feature that survives
 * at this size, and it is enough to read as a barkeeper.
 */
export function Barkeeper({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="7" r="4" fill="currentColor" />
      <path d="M5.5 21c0-3.9 2.9-6.6 6.5-6.6s6.5 2.7 6.5 6.6Z" fill="currentColor" />
      {/* Cut out of the face rather than drawn over it, so the moustache reads
          on any background the counter happens to sit on. */}
      <path
        d="M8.6 7.6c1.1-.9 2.3-.9 3.4 0 1.1-.9 2.3-.9 3.4 0"
        fill="none"
        stroke="var(--bg)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
