import { useEffect, useState } from 'react';

/**
 * Whether the app is actually on screen.
 *
 * Covers the screen being off, the app going to the background, and — on the
 * web — another tab coming to the front. Browsers throttle background timers
 * but do *not* reliably stop CSS animations, so anything that animates needs
 * to be told to stand down rather than assuming the platform will do it.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    // A webview can be resumed without firing visibilitychange in some
    // Android lifecycles; pageshow covers the bfcache path too.
    window.addEventListener('pageshow', onChange);
    return () => {
      document.removeEventListener('visibilitychange', onChange);
      window.removeEventListener('pageshow', onChange);
    };
  }, []);

  return visible;
}
