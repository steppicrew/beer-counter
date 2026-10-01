import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { BeverageIcon } from './BeverageIcon';
import { Barkeeper } from './Barkeeper';
import { COIN_STAGGER_MS, COINS_PER_SMALL_TIP, TipJar } from './TipJar';
import type { TipProductId } from '../lib/tips';
import { ShardPile } from './ShardPile';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n';
import {
  BRINK_MS,
  collectGlasses,
  glassFill,
  hourMarks,
  markFits,
  marksAnotherDay,
  positionIn,
  PX_PER_HOUR,
  restingWindow,
  scrolledBy,
  scrollBounds,
} from '../lib/bartop';
import type { BarGlass, BarWindow } from '../lib/bartop';
import { hasFallen } from '../lib/shards';
import { useBarScroll } from '../lib/useBarScroll';
import { usePageVisible } from '../lib/usePageVisible';
import { playClink } from '../lib/clink';
import { useGlassDrag } from '../lib/useGlassDrag';
import type { GlassRange } from '../lib/useGlassDrag';
import type { Beverage, Tally } from '../lib/types';
import './Bartop.scss';

interface Props {
  beverages: Beverage[];
  tallies: Record<string, Tally>;
  /** Re-rendered on a timer by the caller, so the "now" mark keeps up. */
  now: number;
  /**
   * Hidden while a sheet is open: those are the only screens with a text
   * field, so this is also when the keyboard is up and the bottom of the
   * screen is spoken for.
   */
  hidden: boolean;
  /** A glass held and slid to another time: the tap was really made then. */
  onMoveGlass: (beverageId: string, from: number, to: number) => void;
  /**
   * When set, the barkeeper on an empty bar points at the tip jar instead of
   * asking for an order; tapping his line calls this.
   */
  onTipJar?: (() => void) | undefined;
  /**
   * The tip jar at the right end of the counter: silent and still, always
   * there wherever a tip is possible, holding what has been tipped.
   */
  tipJar?:
    | {
        /** Paid tips, oldest first, by level: coins and notes in the jar. */
        tipLog: readonly TipProductId[];
        /** The newest tip is going in: clinks, hearts and thanks. */
        dropping: boolean;
        onOpen: () => void;
        /** The currency sign on the jar's front: what makes it a money jar in any language. */
        label: string;
      }
    | undefined;
}

/** Coin drop, matching `bartop-coin` in the stylesheet: the clink lands with it. */
const COIN_LANDS_MS = 380;
/** Note slide, matching `bartop-note`: the thanks follow once it is in. */
const NOTE_LANDS_MS = 460;

/**
 * Where each heart starts, left or right of the jar's middle, in launch
 * order. Alternating sides: launched in sequence from a steady sweep they
 * lined up into a diagonal streak.
 */
const HEART_SPREAD_PX = [0, -14, 12, -6, 18, -20, 6, -12, 22, -2];

/** The thanks grow with the tip: hearts, and the barman's words. */
const THANKS: Record<TipProductId, { hearts: number; words: MessageKey }> = {
  tip_small: { hearts: 3, words: 'tip.thanks' },
  tip_large: { hearts: 5, words: 'tip.thanksLarge' },
  tip_round: { hearts: 10, words: 'tip.thanksRound' },
};

/** How long the cloth takes to cross the counter, in ms. Matches the CSS. */
const WIPE_MS = 900;

/** How long a glass takes to go over the end and out of sight. Matches the CSS. */
const FALL_MS = 420;

/**
 * The cloth starts just off the left edge and ends just past the right, so it
 * covers more than the stage's own width — see the `bartop-cloth` keyframes.
 */
const CLOTH_FROM = -0.06;
const CLOTH_TO = 1.06;

/** When the cloth arrives at a point on the counter, in ms from the start. */
function clothReaches(position: number): number {
  return ((position - CLOTH_FROM) / (CLOTH_TO - CLOTH_FROM)) * WIPE_MS;
}

/** Until the stage has been measured, assume a typical phone's width. */
const ASSUMED_WIDTH = 360;

/** Where the counter starts. Matches `$bar-inset` in the stylesheet. */
const BAR_INSET_PX = 30;

const HOUR_MS = 3_600_000;
/** The barman's width until he has been measured, at $keeper-height. */
const ASSUMED_KEEPER_PX = 139;
/** The tip jar's box and its gap from the right end: $tap-min and `right: 6px`. */
const JAR_BOX_PX = 48;
const JAR_RIGHT_PX = 6;
/**
 * How far he stands over the jar: his right side may pass behind it — he is
 * no tap target, and the jar is drawn in front — which gives the present and
 * the evening to its left that much more of the counter.
 */
const KEEPER_OVER_JAR_PX = 26;
/** How far the present reaches into his width: the newest glass at his elbow. */
const NOW_INTO_KEEPER_PX = 40;
const MINUTE = 60_000;

/** How long the bar takes to run forward to the present. */
const SWEEP_MS = 1100;
/** Shorter jumps than this are the clock's own steps, not a held bar catching up. */
const SWEEP_FROM_MS = 10 * 60_000;

/**
 * The window's start while the bar runs forward after a drink was added to
 * a held bar, or null when it is simply at rest. Started only by a new
 * glass: the clock's ticks and a reset move the resting window too, and
 * neither should send the bar racing.
 */
function useSweep(restingStart: number, glassCount: number): number | null {
  const [sweep, setSweep] = useState<{ from: number; to: number } | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [seen, setSeen] = useState({ start: restingStart, count: glassCount });

  // Detected while rendering, not in an effect: the render that brings the
  // new glass already draws the bar where it was, so it never flashes at the
  // present for a frame and lets the old glasses fall a step early.
  if (seen.start !== restingStart || seen.count !== glassCount) {
    if (
      glassCount > seen.count &&
      restingStart - seen.start >= SWEEP_FROM_MS &&
      !globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setSweep({ from: seen.start, to: restingStart });
      setCurrent(seen.start);
    }
    setSeen({ start: restingStart, count: glassCount });
  }

  useEffect(() => {
    if (!sweep) return;
    const began = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - began) / SWEEP_MS);
      // Eased both ends: it sets off, runs, and settles at the present.
      const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      if (k < 1) {
        setCurrent(sweep.from + (sweep.to - sweep.from) * eased);
        frame = requestAnimationFrame(step);
      } else {
        setCurrent(null);
        setSweep(null);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [sweep]);

  return sweep ? current : null;
}

export function Bartop({ beverages, tallies, now, hidden, onMoveGlass, onTipJar, tipJar }: Props) {
  const { t, locale } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  // Animating a counter nobody can see costs battery and buys nothing.
  const visible = usePageVisible();

  // The stage is as wide as the screen gives it, and that width *is* the
  // window: no fixed number of hours any more, so a tablet simply sees more of
  // the evening at once rather than the same hours stretched wider.
  const [width, setWidth] = useState(ASSUMED_WIDTH);

  // His width sets where the present goes, and he is drawn from a lazily
  // loaded sprite whose box is not known up front — so measured, like the
  // stage, and re-measured if the artwork ever changes.
  const keeperRef = useRef<HTMLSpanElement>(null);
  const [keeperWidth, setKeeperWidth] = useState(ASSUMED_KEEPER_PX);
  useLayoutEffect(() => {
    const el = keeperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.width ?? 0;
      if (next > 0) setKeeperWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The counter is narrower than the stage by the gap it leaves for the drop,
  // and it is the counter that carries the time axis.
  const spanMs = (Math.max(0, width - BAR_INSET_PX) / PX_PER_HOUR) * HOUR_MS;

  const live = collectGlasses(beverages, tallies);

  // A reset empties the store outright, so by the time this renders the
  // glasses are already gone and there is nothing left to wipe away. Holding
  // the last non-empty round for the length of the animation is what gives the
  // cloth something to clear. Adjusting state from a prop change rather than
  // from an effect: React re-renders straight away and the bar never paints an
  // empty frame before the cloth appears.
  const [wiping, setWiping] = useState<BarGlass[] | null>(null);
  const [previous, setPrevious] = useState<BarGlass[]>(live);

  if (previous.length !== live.length) {
    if (previous.length > 0 && live.length === 0) setWiping(previous);
    setPrevious(live);
  }

  useEffect(() => {
    if (wiping === null) return;
    const timer = setTimeout(() => setWiping(null), WIPE_MS);
    return () => clearTimeout(timer);
  }, [wiping]);

  const glasses = wiping ?? live;

  // From the right end leftwards: the tip jar (when there is one), the
  // barman, the present. The present is where the newest glass is poured, a
  // little into his width so it stands at his elbow, in front of him. Its
  // place on the counter therefore follows from his measured width and the
  // screen's: far left on a narrow phone, further right on a tablet.
  const counterPx = Math.max(1, width - BAR_INSET_PX);
  const jarShown = tipJar !== undefined;
  const jarRightPx = JAR_RIGHT_PX;
  const keeperRightPx = jarShown ? jarRightPx + JAR_BOX_PX - KEEPER_OVER_JAR_PX : jarRightPx;
  const nowPx = counterPx - keeperRightPx - keeperWidth - 4 - 13.5 + NOW_INTO_KEEPER_PX;
  const nowAtFraction = Math.min(0.9, Math.max(0.1, nowPx / counterPx));

  // Where the bar sits when left alone: the present beside the barman, the
  // round drifting away to the left of it — held once the newest glass
  // reaches the far end, so a round left standing stays on the bar.
  const resting = restingWindow(now, spanMs, nowAtFraction, glasses.at(-1)?.at);
  const bounds = scrollBounds(resting, glasses);
  const scroll = useBarScroll(bounds);

  // A drink counted on a held bar brings it back to the present. Not in one
  // jump: the bar runs forward for a moment, the old glasses sliding off the
  // far end one after another, until the new one stands at his elbow.
  const sweepStart = useSweep(resting.start, live.length);
  const window: BarWindow =
    sweepStart === null
      ? scrolledBy(resting, scroll.offset)
      : { start: sweepStart, end: sweepStart + spanMs };

  // Everything to the left of the brink has gone over the edge. Counted rather
  // than filtered per-glass at draw time, since the pile only needs the total
  // and the standing glasses are the ones that survive the same test.
  const standing = glasses.filter((glass) => !hasFallen(glass, window));
  const fallen = glasses.length - standing.length;

  // The glasses that went over the edge since the last render, kept just long
  // enough to draw the drop. Without this a glass simply stops being rendered
  // the minute it crosses the brink and the fall is something you infer from
  // a missing glass rather than something you see.
  const [dropping, setDropping] = useState<BarGlass[]>([]);
  const [wasStanding, setWasStanding] = useState<BarGlass[]>(standing);

  if (wasStanding.length !== standing.length || wasStanding[0]?.at !== standing[0]?.at) {
    const now2 = new Set(standing.map((g) => `${g.beverageId}-${g.at}`));
    // Only glasses that left by going over the left end — a reset removes them
    // all at once and the cloth is already telling that story.
    const gone = wasStanding.filter(
      (g) => !now2.has(`${g.beverageId}-${g.at}`) && g.at < window.start + BRINK_MS,
    );
    if (gone.length > 0) setDropping(gone);
    setWasStanding(standing);
  }

  useEffect(() => {
    if (dropping.length === 0) return;
    const timer = setTimeout(() => setDropping([]), FALL_MS);
    return () => clearTimeout(timer);
  }, [dropping]);

  // Sliding a glass back to when it was really drunk. It stays in order —
  // after the glass before it, before the one after it, never in the future —
  // and on the visible counter, so it cannot be dragged over the brink and
  // fall while held.
  const glassDrag = useGlassDrag(onMoveGlass);
  const rangeOf = (glass: BarGlass): GlassRange => {
    const index = glasses.indexOf(glass);
    const before = glasses[index - 1];
    const after = glasses[index + 1];
    const min = Math.max(before ? before.at + MINUTE : -Infinity, window.start + BRINK_MS);
    const max = Math.min(after ? after.at - MINUTE : Infinity, now);
    return { min: Math.min(min, glass.at), max: Math.max(max, glass.at) };
  };
  const clockLabel = new Intl.DateTimeFormat(locale, { timeStyle: 'short' });

  // Named days only appear once the round has run past midnight, so an
  // ordinary evening keeps bare hours on the counter.
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  // The hour as the locale writes it: "22" in de, "10 PM" in en-US, "22時" in
  // ja. Reading getHours() and printing the number was correct only for
  // 24-hour locales, and the app ships in fifteen.
  //
  // `formatToParts` rather than `format`: several locales append a literal
  // unit ("22 Uhr", "22 h") that is fine in prose but is noise on a tick a few
  // pixels wide. The day period of a 12-hour locale is kept — "10" alone would
  // be ambiguous — and so is a suffix that is part of the number's own script,
  // like Japanese 時, which reads as the unit rather than a word.
  const hourParts = new Intl.DateTimeFormat(locale, { hour: 'numeric' });
  const hourLabel = {
    format: (date: Date) =>
      hourParts
        .formatToParts(date)
        .filter((part) => part.type !== 'literal' || !/\p{L}{2,}/u.test(part.value))
        .map((part) => part.value)
        .join('')
        .trim(),
  };

  // Half a label's width as a share of the counter, so a mark whose digits
  // would hang off either end can be dropped. The widest form in play sets the
  // margin: a 12-hour label ("11 PM") is roughly twice a bare "23", and a
  // weekday prefix ("Mon 11 PM") wider still. Sized for $font-sm (13px), the
  // labels' size since they match a row's "5 min ago".
  const counterWidth = Math.max(1, width - BAR_INSET_PX);
  const twelveHour = hourLabel.format(new Date(now)).length > 2;
  const halfLabelPx = (twelveHour ? 23 : 12) + (marksAnotherDay(window.start, now) ? 22 : 0);
  const labelRoom = halfLabelPx / counterWidth;

  const nowAt = positionIn(window, now);
  const isEmpty = glasses.length === 0;
  const isWiping = wiping !== null;

  // The round has been left standing long enough for him to ask: the newest
  // drink has drifted from his side halfway to the far end, so the stretch
  // between them is empty and waiting. Halfway along the past, not the middle
  // of the counter: the present now sits left of the middle on a phone, where
  // "past the middle" held for a glass poured that very moment. Keyed on the last glass rather
  // than on wall-clock age so the question arrives at a distance you can see.
  //
  // Measured on the *resting* window rather than the one being looked at:
  // dragging back into the past also pushes the last drink leftward, and there
  // the barkeeper has nothing to be impatient about.
  const lastAt = glasses.at(-1)?.at;
  const isStale =
    !isEmpty && !isWiping && lastAt !== undefined && positionIn(resting, lastAt) < nowAtFraction / 2;

  // The clink belongs to the coin hitting the bottom of the jar, so it waits
  // for the drop; with reduced motion there is no drop to wait for.
  const coinShown = tipJar?.dropping === true;
  const tipping = coinShown ? tipJar.tipLog.at(-1) : undefined;
  // Set when the tip has landed, and never reset: each tip goes in once, and
  // this component sees one at a time.
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!tipping) return;
    // `window` in this component is the bar's time window, hence globalThis.
    const still = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers: number[] = [];
    if (tipping === 'tip_small') {
      // One clink for each coin, as each lands.
      for (let i = 0; i < COINS_PER_SMALL_TIP; i++) {
        timers.push(globalThis.setTimeout(playClink, still ? i * 60 : COIN_LANDS_MS + i * COIN_STAGGER_MS));
      }
    }
    const settled = tipping === 'tip_small'
      ? COIN_LANDS_MS + (COINS_PER_SMALL_TIP - 1) * COIN_STAGGER_MS
      : NOTE_LANDS_MS;
    timers.push(globalThis.setTimeout(() => setLanded(true), still ? 0 : settled));
    return () => timers.forEach((timer) => globalThis.clearTimeout(timer));
  }, [tipping]);

  return (
    <div
      className={clsx(
        'bartop',
        isEmpty && 'bartop--empty',
        isEmpty && onTipJar && 'bartop--tip',
        isWiping && 'bartop--wiping',
        scroll.travelling && 'bartop--travelling',
        !visible && 'bartop--asleep',
        hidden && 'bartop--hidden',
      )}
    >
      <div className="bartop__stage" ref={stageRef}>
        <div className="bartop__track">
          <div className="bartop__counter" aria-hidden="true" />
          <div className="bartop__surface" aria-hidden="true" />
          <span className="bartop__lip" aria-hidden="true" />

          {/* Takes the drag. Covers the counter only: the rest of the bar's
              height is air the drink list shows through, and swallowing
              events there would break tapping the rows underneath. */}
          {!isEmpty && <span className="bartop__grip" {...scroll.handlers} />}

          {/* Everything below is placed by timestamp, so it lives in a layer
              that starts where the wood does — a percentage then maps across
              the counter rather than across the floor beside it. */}
          <span className="bartop__over-counter">
            {hourMarks(window)
              .filter((at) => markFits(positionIn(window, at), labelRoom))
              .map((at) => (
              <span
                key={at}
                className="bartop__hour"
                style={{ left: `${positionIn(window, at) * 100}%` }}
                aria-hidden="true"
              >
                <span className="bartop__hour-tick" />
                <span className="bartop__hour-label">
                  {marksAnotherDay(at, now)
                    ? `${dayLabel.format(new Date(at))} ${hourLabel.format(new Date(at))}`
                    : hourLabel.format(new Date(at))}
                </span>
              </span>
            ))}

            {/* Beside the barman, where the next glass goes. Drawn only while
                it is actually on stage — scrolled far enough back, the present
                is off the end and a marker pinned to the edge would be a lie.
                Not under the tip jar either: that stands on the same spot of
                an empty counter, and a line poking out beneath it is noise. */}
            {nowAt >= 0 && nowAt <= 1 && (
              <span
                className="bartop__now"
                style={{ left: `${nowAt * 100}%` }}
                aria-hidden="true"
              />
            )}

            {isWiping && <span className="bartop__cloth" aria-hidden="true" />}

            {/* Always behind the counter, at its newest end — where the next
                glass would be poured. He speaks only when there is something
                to say: on an empty bar, and when a round is left standing. */}
            <span
              ref={keeperRef}
              className={clsx('bartop__keeper', isStale && 'bartop__keeper--waiting')}
              style={
                {
                  right: `${keeperRightPx}px`,
                  // The room left of him, which every bubble must fit in: they
                  // speak towards the glasses, and on a phone that side is
                  // narrow — a longer phrase wraps rather than leaving the screen.
                  '--bubble-room': `${Math.max(90, BAR_INSET_PX + counterPx - keeperRightPx - keeperWidth - 14)}px`,
                } as React.CSSProperties
              }
            >
              {isEmpty && onTipJar ? (
                // Only ever at the start of a round, before anything is
                // poured: never a request made to someone mid-evening.
                <button
                  type="button"
                  className="bartop__ask bartop__ask--tip"
                  onClick={onTipJar}
                >
                  {t('bartop.tipJar')}
                </button>
              ) : coinShown && landed ? (
                // Thanks in words once the coin is in, whether the bar is empty
                // or not; until the next drink, then back to taking orders.
                <span className="bartop__ask">{t(THANKS[tipping ?? 'tip_small'].words)}</span>
              ) : isEmpty ? (
                <span className="bartop__ask">{t('bartop.ask')}</span>
              ) : isStale ? (
                <span className="bartop__ask">{t('bartop.another')}</span>
              ) : null}
              <Barkeeper className="bartop__keeper-figure" />
            </span>

            {tipJar && (
              <button
                type="button"
                className="bartop__tip-jar"
                onClick={tipJar.onOpen}
                aria-label={t('tip.jar')}
              >
                <TipJar className="bartop__tip-jar-figure" tipLog={tipJar.tipLog} dropping={tipJar.dropping} />
                {/* Text, not SVG: at jar size an SVG glyph scales into a blur,
                    while real text is hinted. Smaller the longer the sign, so
                    "zł" and even "CHF" stay on the jar's front. Off only while
                    a tip is falling in, so the drop is not hidden — back the
                    moment it has landed. */}
                {!(tipJar.dropping && !landed) && (
                  <span
                    className={clsx(
                      'bartop__tip-jar-label',
                      `bartop__tip-jar-label--len${Math.min([...tipJar.label].length, 3)}`,
                    )}
                    aria-hidden="true"
                  >
                    {tipJar.label}
                  </span>
                )}
                {tipping &&
                  Array.from({ length: THANKS[tipping].hearts }, (_, i) => (
                    // Let go one after another from places that jump left and
                    // right, so ten rise as a flurry rather than a line.
                    <svg
                      key={i}
                      className="bartop__heart"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                      style={{
                        translate: `${HEART_SPREAD_PX[i % HEART_SPREAD_PX.length]}px 0`,
                        animationDelay: `${(tipping === 'tip_small' ? COIN_LANDS_MS : NOTE_LANDS_MS) + i * 110}ms`,
                      }}
                    >
                      <path
                        d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.6c0 5.5-7.5 10.1-7.5 10.1Z"
                        fill="var(--heart)"
                      />
                    </svg>
                  ))}
              </button>
            )}

            <span className="bartop__glasses">
              {standing.map((glass) => {
                const key = `${glass.beverageId}-${glass.at}`;
                const held = glassDrag.dragged?.key === key ? glassDrag.dragged : null;
                const at = held?.at ?? glass.at;
                return (
                  <span
                    key={key}
                    className={clsx('bartop__glass', !isWiping && 'bartop__glass--movable', held && 'bartop__glass--held')}
                    style={{
                      left: `${positionIn(window, at) * 100}%`,
                      ...(isWiping
                        ? {
                            animationDelay: `${clothReaches(positionIn(window, glass.at))}ms`,
                          }
                        : {}),
                    }}
                    {...(isWiping ? {} : glassDrag.bind(key, glass.beverageId, glass.at, rangeOf(glass)))}
                  >
                    {held && (
                      <>
                        <span className="bartop__glass-thread" />
                        {/* Slid along its own width by where the glass
                            stands, so near either end of the bar it opens
                            inwards instead of running off the screen. */}
                        <span
                          className="bartop__glass-time"
                          style={{
                            transform: `translateX(-${Math.min(1, Math.max(0, positionIn(window, at))) * 100}%)`,
                          }}
                        >
                          {clockLabel.format(at)}
                        </span>
                      </>
                    )}
                    <BeverageIcon
                      icon={glass.icon}
                      className="bartop__glass-figure"
                      // From where it is being held, so dragging a full glass
                      // back drains it as it goes, not only once it is set down.
                      fill={glassFill(at, now, glass.isCurrent)}
                    />
                  </span>
                );
              })}
            </span>
          </span>

          {/* Mid-drop, in the gap beside the counter. Outside the layer above,
              since it is falling past the counter's left end rather than
              standing anywhere on it. */}
          {!isWiping &&
            dropping.map((glass) => (
              <span
                key={`fall-${glass.beverageId}-${glass.at}`}
                className="bartop__falling"
                style={{ left: `${BAR_INSET_PX}px` }}
              >
                <BeverageIcon icon={glass.icon} className="bartop__glass-figure" fill="empty" />
              </span>
            ))}

          {/* On the floor in that gap: where a glass that went over the end
              actually lands. Hidden during a wipe — the cloth clears the
              counter, and a pile surviving it would say the round had not
              really been reset. */}
          {fallen > 0 && !isWiping && (
            <span className="bartop__shards">
              <ShardPile count={fallen} className="bartop__shard-figure" />
            </span>
          )}
        </div>
      </div>

      {/* Getting home from a long scroll back. Only offered when there is a
          back to come from — at the present it would do nothing. */}
      {scroll.travelling && !isEmpty && (
        <button
          type="button"
          className="bartop__present"
          onClick={scroll.toPresent}
          aria-label={t('bartop.toPresent')}
        >
          ›
        </button>
      )}

      {/* The counter is decorative; the round it represents is already read out
          by the totals and the per-drink rows. */}
      <span className="bartop__sr">
        {isEmpty ? t('bartop.empty') : t('bartop.summary', { count: String(glasses.length) })}
      </span>
    </div>
  );
}
