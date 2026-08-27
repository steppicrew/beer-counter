import { useEffect, useState } from 'react';
import type { Translate } from '../i18n';

/**
 * Re-renders on a cadence matched to the age of the timestamp: every second
 * for the first minute (when the "did I already tap this?" question matters),
 * then every 30s. A single shared tick would either burn battery or lag.
 */
export function useElapsed(since: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (since === null) return;
    const age = now - since;
    const interval = age < 60_000 ? 1_000 : 30_000;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [since, now]);

  if (since === null) return null;
  return Math.max(0, now - since);
}

export function formatElapsed(ms: number | null, t: Translate): string {
  if (ms === null) return t('time.never');

  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return t('time.justNow');
  if (seconds < 60) return t('time.secondsAgo', { count: seconds });

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });

  return t('time.hoursAgo', { count: Math.floor(minutes / 60) });
}
