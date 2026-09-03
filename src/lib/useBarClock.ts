import { useEffect, useState } from 'react';

/**
 * A clock for the bartop, ticking once a minute.
 *
 * Over a four-hour window the "now" marker travels well under a pixel a
 * minute, so a faster tick would re-render the whole counter to move nothing.
 */
export function useBarClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return now;
}
