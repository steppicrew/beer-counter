import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { isNativeApp } from './platform';

/** How often to re-check for a new build while the app stays open. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export interface AppUpdate {
  /** A newer build is installed and waiting to take over. */
  ready: boolean;
  /**
   * Activate the waiting worker and reload. A plain location.reload() is not
   * enough: the old worker still controls the page and would serve the old
   * cached assets straight back.
   */
  apply: () => void;
}

/**
 * Keeps the installed app current.
 *
 * The plugin runs in 'prompt' mode, so a new worker installs and then waits
 * rather than swapping assets under a page that is mid-round. Finding it is
 * on us: a PWA launched from the home screen may not navigate for days, so we
 * check at startup, whenever the app returns to the foreground, and hourly.
 *
 * Inert in the packaged Android app: its assets come from the APK and are
 * updated through Play, so there is no origin to poll — and with no INTERNET
 * permission the check could not run anyway.
 */
export function useAppUpdate(): AppUpdate {
  const [ready, setReady] = useState(false);
  // registerSW's return value is the "activate the waiting worker" trigger.
  const updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const applying = useRef(false);

  useEffect(() => {
    if (isNativeApp()) return;

    const cleanups: (() => void)[] = [];

    updateSW.current = registerSW({
      immediate: true,

      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;

        const check = () => {
          // Offline the request just fails; don't wake the radio for nothing.
          if (navigator.onLine) void registration.update();
        };

        check();

        const timer = window.setInterval(check, CHECK_INTERVAL_MS);
        const onVisible = () => {
          if (document.visibilityState === 'visible') check();
        };

        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', check);

        cleanups.push(() => {
          window.clearInterval(timer);
          document.removeEventListener('visibilitychange', onVisible);
          window.removeEventListener('online', check);
        });
      },

      onNeedRefresh() {
        setReady(true);
      },

      onOfflineReady() {
        // Nothing to announce — running offline is the point of the app.
      },
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  const apply = () => {
    if (applying.current) return;
    applying.current = true;

    const trigger = updateSW.current;
    if (!trigger) {
      window.location.reload();
      return;
    }

    // The plugin reloads once the new worker takes control. If it does not —
    // no waiting worker, a failed message, an unsupported browser — fall back
    // rather than leaving the button visibly dead.
    const fallback = window.setTimeout(() => window.location.reload(), 3000);

    void trigger(true).catch(() => {
      window.clearTimeout(fallback);
      window.location.reload();
    });
  };

  return { ready, apply };
}
