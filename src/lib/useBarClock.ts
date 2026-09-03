import { useEffect, useState } from 'react';

/**
 * A clock for the bartop, ticking once a minute while the app is on screen.
 *
 * Over the counter's window the "now" marker travels well under a pixel a
 * minute, so a faster tick would re-render the whole bar to move nothing.
 *
 * The timer stops entirely when the page is hidden — screen off, app in the
 * background, or another tab in front. A webview that keeps a timer running
 * there wakes the CPU every minute to redraw something nobody is looking at,
 * and on a phone that is measurable battery for no benefit. Coming back reads
 * the clock immediately, so the bar is already correct on the first frame
 * rather than showing a stale position until the next tick.
 */
export function useBarClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };

    const start = () => {
      stop();
      timer = setInterval(() => setNow(Date.now()), 60_000);
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // However long the app was away, the bar may have moved a long way —
        // catch up before restarting the tick.
        setNow(Date.now());
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return now;
}
