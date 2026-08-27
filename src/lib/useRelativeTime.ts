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
    // Past an hour the label only changes hourly, so stop waking every 30s.
    const interval = age < 60_000 ? 1_000 : age < 3_600_000 ? 30_000 : 300_000;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [since, now]);

  if (since === null) return null;
  return Math.max(0, now - since);
}

/**
 * Relative for as long as that reads naturally, then an absolute date.
 *
 * Counts persist until the next reset, so a tab left open on Monday and
 * reopened on Friday used to render "96h ago" — technically right, useless at
 * a glance. Past a week even "12d ago" stops meaning anything, so it becomes
 * a short date instead.
 */
export function formatElapsed(ms: number | null, t: Translate, locale?: string): string {
  if (ms === null) return t('time.never');

  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return t('time.justNow');
  if (seconds < 60) return t('time.secondsAgo', { count: seconds });

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('time.minutesAgo', { count: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { count: hours });

  const days = Math.floor(hours / 24);
  if (days === 1) return t('time.daysAgoOne');
  if (days < 7) return t('time.daysAgo', { count: days });

  // Older than a week: the day and month say more than a running total.
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
    .format(new Date(Date.now() - ms));
}
