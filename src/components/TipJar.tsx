interface Props {
  className?: string;
  /** Draws the thank-you coin, dropping in from above the rim. */
  coin?: boolean;
}

/**
 * The tip jar on the counter. Unlike the drinks it is drawn as clear glass —
 * a tinted body under an outline — because a solid silhouette at bar size
 * reads as a jam jar or a tin, and the point is that you can see it is empty.
 * The coin is the one warm thing in it, which is what makes it read as money.
 */
export function TipJar({ className, coin = false }: Props) {
  const body =
    'M8.2 5.6h7.6v.9c0 .6.3 1 .8 1.3A4.2 4.2 0 0 1 19 11.6V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7.4a4.2 4.2 0 0 1 2.4-3.8c.5-.3.8-.7.8-1.3v-.9Z';
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      overflow="visible"
    >
      <path d={body} fill="currentColor" fillOpacity="0.16" />
      {coin && (
        <g className="tip-jar__coin">
          {/* Large for a coin: at bar size anything smaller is a speck. */}
          <circle cx="12" cy="16.8" r="3.7" fill="var(--coin)" />
          <circle cx="12" cy="16.8" r="2.4" fill="none" stroke="var(--coin-edge)" strokeWidth="0.9" />
        </g>
      )}
      <path d={body} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      {/* A highlight down one side: what makes the tint read as glass. */}
      <path d="M7.6 11.2v6.6" stroke="var(--bg)" strokeOpacity="0.8" strokeWidth="1.1" strokeLinecap="round" />
      {/* The rim: a lip wider than the neck, the one detail that says jar
          rather than bottle at bar size. */}
      <rect x="7" y="3.6" width="10" height="2" rx="0.9" fill="currentColor" />
    </svg>
  );
}
