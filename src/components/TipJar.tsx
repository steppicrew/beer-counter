import type { TipProductId } from '../lib/tips';

interface Props {
  className?: string;
  /** Paid tips, oldest first: what has gone into the jar. */
  tipLog?: readonly TipProductId[];
  /** The newest tip is going in right now. */
  dropping?: boolean;
}

/** Coins a small-beer tip puts in; the larger tips go in as a note. */
export const COINS_PER_SMALL_TIP = 3;

/** Delay between the coins of one small tip falling in. Matches the clinks. */
export const COIN_STAGGER_MS = 140;

/**
 * Where each coin lies, in the order they arrive: a pile growing up from the
 * bottom, the first three in plain view below the label and the rest peeking
 * out behind it. Twelve is a full jar; more coins than that look the same.
 */
const PILE: readonly (readonly [number, number])[] = [
  [12, 19.1], [8.2, 19.2], [15.8, 19.2],
  [10.1, 16.2], [13.9, 16.2], [7.6, 16.6], [16.4, 16.6],
  [12, 13.4], [9.2, 13.5], [14.8, 13.5],
  [10.6, 10.8], [13.4, 10.8],
];
const COIN_R = 2.1;

/**
 * Folded notes standing up out of the jar's mouth, newest in front. Three
 * is as many as the mouth shows; older ones are simply further down.
 */
const NOTE_SLOTS: readonly { x: number; angle: number }[] = [
  { x: 12, angle: -8 },
  { x: 10.4, angle: 12 },
  { x: 13.6, angle: -18 },
];
const NOTES_SHOWN = NOTE_SLOTS.length;

/**
 * The tip jar on the counter. Unlike the drinks it is drawn as clear glass —
 * a tinted body under an outline — because a solid silhouette at bar size
 * reads as a jam jar or a tin, and the point is that you can see what is in
 * it: coins for a small beer, a folded note for a beer or a round, the way
 * money goes into a real bar's jar.
 */
export function TipJar({ className, tipLog = [], dropping = false }: Props) {
  const body =
    'M8.2 5.6h7.6v.9c0 .6.3 1 .8 1.3A4.2 4.2 0 0 1 19 11.6V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7.4a4.2 4.2 0 0 1 2.4-3.8c.5-.3.8-.7.8-1.3v-.9Z';

  const newest = dropping ? tipLog.at(-1) : undefined;
  const smallTips = tipLog.filter((tip) => tip === 'tip_small').length;
  const coins = Math.min(smallTips * COINS_PER_SMALL_TIP, PILE.length);
  // The coins of a small tip going in fall one after another; with a full
  // jar they land on top of the pile.
  const fallingCoins = newest === 'tip_small' ? Math.min(COINS_PER_SMALL_TIP, coins) : 0;

  const notes = tipLog.filter((tip) => tip !== 'tip_small').slice(-NOTES_SHOWN);
  const noteFalling = newest !== undefined && newest !== 'tip_small';

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

      {PILE.slice(0, coins).map(([cx, cy], i) => {
        const fall = i >= coins - fallingCoins ? i - (coins - fallingCoins) : -1;
        return (
          <g
            key={`coin-${i}`}
            className={fall >= 0 ? 'tip-jar__coin tip-jar__coin--dropping' : 'tip-jar__coin'}
            style={fall >= 0 ? { animationDelay: `${fall * COIN_STAGGER_MS}ms` } : undefined}
          >
            <circle cx={cx} cy={cy} r={COIN_R} fill="var(--coin)" />
            <circle cx={cx} cy={cy} r={COIN_R * 0.64} fill="none" stroke="var(--coin-edge)" strokeWidth="0.6" />
          </g>
        );
      })}

      {notes.map((tip, i) => {
        // Oldest of the shown notes in the back slot, the newest in front.
        const slot = NOTE_SLOTS[notes.length - 1 - i]!;
        const isNewest = i === notes.length - 1;
        return (
          // The tilt is an SVG attribute on the outer group and the fall a CSS
          // transform on the inner one: on the same element the CSS would
          // replace the tilt instead of adding to it.
          <g key={`note-${i}`} transform={`rotate(${slot.angle} ${slot.x} 9)`}>
            <g className={noteFalling && isNewest ? 'tip-jar__note tip-jar__note--dropping' : 'tip-jar__note'}>
            {/* A folded note: most of it inside the jar, the top standing out
                of the mouth, with a frame and a seal so it reads as money
                rather than a slip of paper. */}
            <rect
              x={slot.x - 3.1}
              y={0.4}
              width={6.2}
              height={11}
              rx={0.5}
              fill={tip === 'tip_round' ? 'var(--note-round)' : 'var(--note-large)'}
              stroke="var(--note-edge)"
              strokeWidth="0.45"
            />
            <rect
              x={slot.x - 2.2}
              y={1.3}
              width={4.4}
              height={9.2}
              rx={0.3}
              fill="none"
              stroke="var(--note-edge)"
              strokeWidth="0.3"
              opacity="0.7"
            />
            <circle cx={slot.x} cy={3.6} r={1.1} fill="none" stroke="var(--note-edge)" strokeWidth="0.35" />
            </g>
          </g>
        );
      })}

      <path d={body} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      {/* A highlight down one side: what makes the tint read as glass. */}
      <path d="M7.6 11.2v6.6" stroke="var(--bg)" strokeOpacity="0.8" strokeWidth="1.1" strokeLinecap="round" />
      {/* The rim: a lip wider than the neck, the one detail that says jar
          rather than bottle at bar size. Drawn over the notes, so they stand
          in the mouth rather than in front of it. */}
      <rect x="7" y="3.6" width="10" height="2" rx="0.9" fill="currentColor" />
    </svg>
  );
}
