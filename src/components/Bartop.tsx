import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { GlassIcon } from './GlassIcon';
import { Barkeeper } from './Barkeeper';
import { useI18n } from '../i18n';
import {
  barWindow,
  collectGlasses,
  glassFill,
  hourMarks,
  positionIn,
  WINDOW_HOURS,
} from '../lib/bartop';
import type { BarGlass } from '../lib/bartop';
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

/** Width given to one hour of bar. Four of these is the visible window. */
const PX_PER_HOUR = 74;

/** How long the cloth takes to cross the counter, in ms. Matches the CSS. */
const WIPE_MS = 900;

/**
 * The cloth starts just off the left edge and ends just past the right, so it
 * covers more than the track's own width — see the `bartop-cloth` keyframes.
 * A glass is therefore reached partway into that longer journey, not at its
 * own position along the track, and using the raw position tips the glasses
 * over before the cloth gets to them.
 */
const CLOTH_FROM = -0.06;
const CLOTH_TO = 1.06;

/** When the cloth arrives at a point on the track, in ms from the start. */
function clothReaches(position: number): number {
  return ((position - CLOTH_FROM) / (CLOTH_TO - CLOTH_FROM)) * WIPE_MS;
}

export function Bartop({ beverages, tallies, now, hidden }: Props) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(false);

  const live = collectGlasses(beverages, tallies);

  // A reset empties the store outright, so by the time this renders the
  // glasses are already gone and there is nothing left to wipe away. Holding
  // the last non-empty round for the length of the animation is what gives
  // the cloth something to clear.
  // Adjusting state from a prop change, rather than from an effect: the round
  // that was on the counter last render is state, so React re-renders straight
  // away and the bar never paints an empty frame before the cloth appears. A
  // ref would be read and written during render, which is exactly the pattern
  // that breaks under concurrent rendering.
  const [wiping, setWiping] = useState<BarGlass[] | null>(null);
  const [previous, setPrevious] = useState<BarGlass[]>(live);

  if (previous.length !== live.length) {
    if (previous.length > 0 && live.length === 0) setWiping(previous);
    setPrevious(live);
  }

  // Owned by the wipe itself, so the once-a-minute clock re-rendering the bar
  // does not cancel the pending timer and strand the cloth mid-counter.
  useEffect(() => {
    if (wiping === null) return;
    const timer = setTimeout(() => setWiping(null), WIPE_MS);
    return () => clearTimeout(timer);
  }, [wiping]);

  const glasses = wiping ?? live;
  const window = barWindow(glasses, now);
  const spanHours = (window.end - window.start) / 3_600_000;
  const trackWidth = Math.max(spanHours, WINDOW_HOURS) * PX_PER_HOUR;

  // The round starts pinned to its first drink, so the counter opens showing
  // hours that have not happened yet. Once the evening outruns the window the
  // track is wider than the viewport, and reopening the app should land on the
  // present rather than on a beer from four hours ago — but only once, or
  // every re-render would yank the bar back while it is being dragged.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || pinnedRef.current) return;
    if (el.scrollWidth <= el.clientWidth) return;

    el.scrollLeft = el.scrollWidth - el.clientWidth;
    pinnedRef.current = true;
  }, [trackWidth]);

  const isEmpty = glasses.length === 0;
  const isWiping = wiping !== null;

  return (
    <div
      className={clsx(
        'bartop',
        isEmpty && 'bartop--empty',
        isWiping && 'bartop--wiping',
        hidden && 'bartop--hidden',
      )}
    >
      <div className="bartop__scroll" ref={scrollRef}>
        <div className="bartop__track" style={{ width: `${trackWidth}px` }}>
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
              <span className="bartop__hour-label">{new Date(at).getHours()}</span>
            </span>
          ))}

          <span
            className="bartop__now"
            style={{ left: `${positionIn(window, now) * 100}%` }}
            aria-hidden="true"
          />

          {isWiping && <span className="bartop__cloth" aria-hidden="true" />}

          <span className="bartop__glasses">
            {isEmpty ? (
              <span className="bartop__keeper">
                <span className="bartop__ask">{t('bartop.ask')}</span>
                <Barkeeper className="bartop__keeper-figure" />
              </span>
            ) : (
              glasses.map((glass) => (
                <span
                  key={`${glass.beverageId}-${glass.at}`}
                  className="bartop__glass"
                  style={{
                    left: `${positionIn(window, glass.at) * 100}%`,
                    // Each glass leaves at the moment the cloth reaches it. A
                    // single clip across the whole layer cannot express this:
                    // it either erases glasses before the cloth arrives or
                    // leaves them standing behind it.
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
        </div>
      </div>

      {/* The counter is decorative; the round it represents is already read out
          by the totals and the per-drink rows. */}
      <span className="bartop__sr">
        {isEmpty ? t('bartop.empty') : t('bartop.summary', { count: String(glasses.length) })}
      </span>
    </div>
  );
}
