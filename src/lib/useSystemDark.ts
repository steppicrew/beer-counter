import { useEffect, useState } from 'react';

/**
 * Whether the OS is currently asking for a dark scheme.
 *
 * Only needed where the *resolved* theme matters rather than the setting: the
 * CSS handles `system` on its own through `prefers-color-scheme`, but the
 * system bars need a concrete colour, and with the setting on `system` that
 * colour has to change when the OS flips mid-session.
 */
export function useSystemDark(): boolean {
  const [dark, setDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return dark;
}
