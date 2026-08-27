interface Props {
  name: 'settings' | 'reset' | 'edit';
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
      {/*
        Teeth generated as 8 rotationally-symmetric segments about (12,12) —
        a hand-drawn gear left the hub visibly off-centre inside the teeth.
      */}
      <path
        d="M9.94 2.73 L14.06 2.73 L14.40 5.21 L15.10 5.50 L17.10 3.99 L20.01 6.90 L18.50 8.90 L18.79 9.60 L21.27 9.94 L21.27 14.06 L18.79 14.40 L18.50 15.10 L20.01 17.10 L17.10 20.01 L15.10 18.50 L14.40 18.79 L14.06 21.27 L9.94 21.27 L9.60 18.79 L8.90 18.50 L6.90 20.01 L3.99 17.10 L5.50 15.10 L5.21 14.40 L2.73 14.06 L2.73 9.94 L5.21 9.60 L5.50 8.90 L3.99 6.90 L6.90 3.99 L8.90 5.50 L9.60 5.21 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </>
  ),
  edit: (
    <>
      <path
        d="M4 20.1l.9-4 11-11a2.1 2.1 0 0 1 3 0l.9.9a2.1 2.1 0 0 1 0 3l-11 11-4 .9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M14.4 6.6l3.4 3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
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
