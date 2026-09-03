import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { GlassIcon } from './GlassIcon';
import { Barkeeper } from './Barkeeper';
import { ShardPile } from './ShardPile';
import { useI18n } from '../i18n';
import {
  collectGlasses,
  glassFill,
  hourMarks,
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
}

/** How long the cloth takes to cross the counter, in ms. Matches the CSS. */
const WIPE_MS = 900;

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

const HOUR_MS = 3_600_000;

export function Bartop({ beverages, tallies, now, hidden }: Props) {
  const { t, locale } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);

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

  const spanMs = (width / PX_PER_HOUR) * HOUR_MS;

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

  // Where the bar sits when left alone: anchored to the opening drink until
  // the present would fall off the right end, and travelling from then on.
  const resting = restingWindow(glasses, now, spanMs);
  const bounds = scrollBounds(resting, glasses);
  const scroll = useBarScroll(bounds);
  const window: BarWindow = scrolledBy(resting, scroll.offset);

  // Everything to the left of the brink has gone over the edge. Counted rather
  // than filtered per-glass at draw time, since the pile only needs the total
  // and the standing glasses are the ones that survive the same test.
  const standing = glasses.filter((glass) => !hasFallen(glass, window));
  const fallen = glasses.length - standing.length;

  const nowAt = positionIn(window, now);
  const isEmpty = glasses.length === 0;
  const isWiping = wiping !== null;

  // Named days only appear once the round has run past midnight, so an
  // ordinary evening keeps bare hours on the counter.
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  return (
    <div
      className={clsx(
        'bartop',
        isEmpty && 'bartop--empty',
        isWiping && 'bartop--wiping',
        scroll.travelling && 'bartop--travelling',
        hidden && 'bartop--hidden',
      )}
    >
      <div
        className="bartop__stage"
        ref={stageRef}
        {...(isEmpty ? {} : scroll.handlers)}
      >
        <div className="bartop__track">
          <div className="bartop__counter" aria-hidden="true" />
          <div className="bartop__surface" aria-hidden="true">
            <span className="bartop__grain" />
          </div>
          <span className="bartop__lip" aria-hidden="true" />
          <span className="bartop__sheen" aria-hidden="true" />

          {hourMarks(window).map((at) => (
            <span
              key={at}
              className="bartop__hour"
              style={{ left: `${positionIn(window, at) * 100}%` }}
              aria-hidden="true"
            >
              <span className="bartop__hour-tick" />
              <span className="bartop__hour-label">
                {marksAnotherDay(at, now)
                  ? `${dayLabel.format(new Date(at))} ${new Date(at).getHours()}`
                  : new Date(at).getHours()}
              </span>
            </span>
          ))}

          {/* Early in a round this stands well inside the counter, with the
              evening still to come to the right of it; once the bar starts
              travelling it settles near the right edge. Drawn only while it is
              actually on stage — scrolled far enough back, the present is off
              the end and a marker pinned to the edge would be a lie. */}
          {nowAt >= 0 && nowAt <= 1 && (
            <span
              className="bartop__now"
              style={{ left: `${nowAt * 100}%` }}
              aria-hidden="true"
            />
          )}

          {isWiping && <span className="bartop__cloth" aria-hidden="true" />}

          <span className="bartop__glasses">
            {isEmpty ? (
              <span className="bartop__keeper">
                <span className="bartop__ask">{t('bartop.ask')}</span>
                <Barkeeper className="bartop__keeper-figure" />
              </span>
            ) : (
              standing.map((glass) => (
                <span
                  key={`${glass.beverageId}-${glass.at}`}
                  className="bartop__glass"
                  style={{
                    left: `${positionIn(window, glass.at) * 100}%`,
                    ...(isWiping
                      ? {
                          animationDelay: `${clothReaches(positionIn(window, glass.at))}ms`,
                        }
                      : {}),
                  }}
                >
                  <GlassIcon
                    icon={glass.icon}
                    className="bartop__glass-figure"
                    fill={glassFill(glass.at, now, glass.isCurrent)}
                  />
                </span>
              ))
            )}
          </span>

          {/* On the floor at the left end, under the brink the glasses go over.
              Hidden during a wipe: the cloth clears the counter, and a pile
              surviving it would say the round had not really been reset. */}
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
