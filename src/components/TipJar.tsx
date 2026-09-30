interface Props {
  className?: string;
  /** Paid tips: one coin each, piled on the bottom. */
  coins?: number;
  /** The newest coin is falling in right now. */
  dropping?: boolean;
}

/**
 * Where each coin lies, in the order they arrive: a pile growing up from the
 * bottom, the first three in plain view below the label and the rest peeking
 * out behind it. Twelve is a full jar; more tips than that look the same.
 */
const PILE: readonly (readonly [number, number])[] = [
  [12, 19.1], [8.2, 19.2], [15.8, 19.2],
  [10.1, 16.2], [13.9, 16.2], [7.6, 16.6], [16.4, 16.6],
  [12, 13.4], [9.2, 13.5], [14.8, 13.5],
  [10.6, 10.8], [13.4, 10.8],
];
const COIN_R = 2.1;

export function TipJar({ className, coins = 0, dropping = false }: Props) {
  const shown = Math.min(coins, PILE.length);
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
      {PILE.slice(0, shown).map(([cx, cy], i) => (
        <g
          key={i}
          // The newest coin falls in; with a full jar it lands on the top.
          className={dropping && i === shown - 1 ? 'tip-jar__coin tip-jar__coin--dropping' : 'tip-jar__coin'}
        >
          <circle cx={cx} cy={cy} r={COIN_R} fill="var(--coin)" />
          <circle cx={cx} cy={cy} r={COIN_R * 0.64} fill="none" stroke="var(--coin-edge)" strokeWidth="0.6" />
        </g>
      ))}
      <path d={body} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      {/* A highlight down one side: what makes the tint read as glass. */}
      <path d="M7.6 11.2v6.6" stroke="var(--bg)" strokeOpacity="0.8" strokeWidth="1.1" strokeLinecap="round" />
      {/* The rim: a lip wider than the neck, the one detail that says jar
          rather than bottle at bar size. */}
      <rect x="7" y="3.6" width="10" height="2" rx="0.9" fill="currentColor" />
    </svg>
  );
}
