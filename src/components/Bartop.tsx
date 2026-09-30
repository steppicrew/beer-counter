import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { GlassIcon } from './GlassIcon';
import { Barkeeper } from './Barkeeper';
import { TipJar } from './TipJar';
import { ShardPile } from './ShardPile';
import { useI18n } from '../i18n';
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
   * The tip jar at the end of an empty counter: silent, still, and gone with
   * the first drink. `coin` drops the thank-you coin into it.
   */
  tipJar?:
    | {
        coin: boolean;
        onOpen: () => void;
        /** The currency sign on the jar's front: what makes it a money jar in any language. */
        label: string;
      }
    | undefined;
}

/** Coin drop, matching `bartop-coin` in the stylesheet: the clink lands with it. */
const COIN_LANDS_MS = 380;

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
const MINUTE = 60_000;

export function Bartop({ beverages, tallies, now, hidden, onMoveGlass, onTipJar, tipJar }: Props) {
  const { t, locale } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  // Animating a counter nobody can see costs battery and buys nothing.
  const visible = usePageVisible();

  // The stage is as wide as the screen gives it, and that width *is* the
  // window: no fixed number of hours any more, so a tablet simply sees more of
  // the evening at once rather than the same hours stretched wider.
  const [width, setWidth] = useState(ASSUMED_WIDTH);

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

  // Where the bar sits when left alone: the present beside the barman, the
  // round drifting away to the left of it.
  const resting = restingWindow(now, spanMs);
  const bounds = scrollBounds(resting, glasses);
  const scroll = useBarScroll(bounds);
  const window: BarWindow = scrolledBy(resting, scroll.offset);

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
  // weekday prefix ("Mon 11 PM") wider still.
  const counterWidth = Math.max(1, width - BAR_INSET_PX);
  const twelveHour = hourLabel.format(new Date(now)).length > 2;
  const halfLabelPx = (twelveHour ? 18 : 9) + (marksAnotherDay(window.start, now) ? 17 : 0);
  const labelRoom = halfLabelPx / counterWidth;

  const nowAt = positionIn(window, now);
  const isEmpty = glasses.length === 0;
  const isWiping = wiping !== null;

  // The round has been left standing long enough for him to ask: the newest
  // drink has drifted from his side past the middle of the counter, so the
  // stretch between them is empty and waiting. Keyed on the last glass rather
  // than on wall-clock age so the question arrives at a distance you can see.
  //
  // Measured on the *resting* window rather than the one being looked at:
  // dragging back into the past also pushes the last drink leftward, and there
  // the barkeeper has nothing to be impatient about.
  const lastAt = glasses.at(-1)?.at;
  const isStale =
    !isEmpty && !isWiping && lastAt !== undefined && positionIn(resting, lastAt) < 0.5;

  // The clink belongs to the coin hitting the bottom of the jar, so it waits
  // for the drop; with reduced motion there is no drop to wait for.
  const coinShown = isEmpty && tipJar?.coin === true;
  // Set when the coin lands, and never reset: the coin shows once ever, so
  // there is no second landing to reset for.
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!coinShown) return;
    // `window` in this component is the bar's time window, hence globalThis.
    const still = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = globalThis.setTimeout(
      () => {
        playClink();
        setLanded(true);
      },
      still ? 0 : COIN_LANDS_MS,
    );
    return () => globalThis.clearTimeout(timer);
  }, [coinShown]);

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
            {nowAt >= 0 && nowAt <= 1 && !(isEmpty && tipJar) && (
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
            <span className={clsx('bartop__keeper', isStale && 'bartop__keeper--waiting')}>
              {isEmpty && onTipJar ? (
                // Only ever at the start of a round, before anything is
                // poured: never a request made to someone mid-evening.
                <button type="button" className="bartop__ask bartop__ask--tip" onClick={onTipJar}>
                  {t('bartop.tipJar')}
                </button>
              ) : isEmpty ? (
                // Thanks in words once the coin is in; until the next drink,
                // then back to taking orders.
                <span className="bartop__ask">
                  {coinShown && landed ? t('tip.thanks') : t('bartop.ask')}
                </span>
              ) : isStale ? (
                <span className="bartop__ask">{t('bartop.another')}</span>
              ) : null}
              <Barkeeper className="bartop__keeper-figure" />
            </span>

            {isEmpty && tipJar && (
              <button
                type="button"
                className="bartop__tip-jar"
                onClick={tipJar.onOpen}
                aria-label={t('tip.jar')}
              >
                <TipJar className="bartop__tip-jar-figure" coin={tipJar.coin} />
                {/* Text, not SVG: at jar size an SVG glyph scales into a blur,
                    while real text is hinted. Smaller the longer the sign, so
                    "zł" and even "CHF" stay on the jar's front. Off while the
                    coin is in — the jar has made its point. */}
                {!tipJar.coin && (
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
                {tipJar.coin && (
                  <svg className="bartop__heart" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M12 20.5s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.8a4.3 4.3 0 0 1 7.5 2.6c0 5.5-7.5 10.1-7.5 10.1Z"
                      fill="var(--heart)"
                    />
                  </svg>
                )}
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
                    <GlassIcon
                      icon={glass.icon}
                      className="bartop__glass-figure"
                      fill={glassFill(glass.at, now, glass.isCurrent)}
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
                <GlassIcon icon={glass.icon} className="bartop__glass-figure" fill="empty" />
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
