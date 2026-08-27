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
 * In the packaged Android app this does more than nothing: it actively tears
 * any service worker down. The APK ships `sw.js` alongside the assets, and a
 * worker registered once for the origin keeps controlling the page across
 * app updates. Play then installs a new APK carrying a byte-different
 * `sw.js` at the same URL, the surviving worker treats that as a new version
 * and prompts for a reload — an update check that needs no network at all,
 * which is why the missing INTERNET permission never prevented it. Reloading
 * could not help either: the old worker just serves its cache back.
 */
export function useAppUpdate(): AppUpdate {
  const [ready, setReady] = useState(false);
  // registerSW's return value is the "activate the waiting worker" trigger.
  const updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const applying = useRef(false);

  useEffect(() => {
    if (isNativeApp()) {
      // Not just "don't register": a worker from an earlier build — or from
      // the PWA on the same origin — outlives the install and would keep
      // prompting. Tear it down and drop its caches so the WebView serves
      // the APK's own assets.
      void navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) void registration.unregister();
      });
      void caches?.keys().then((keys) => {
        for (const key of keys) void caches.delete(key);
      });
      return;
    }

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

  // Belt and braces: even if a worker that outlived an install fires
  // onNeedRefresh before the teardown above completes, the packaged app must
  // never offer a reload it cannot perform — updates there come from Play.
  return { ready: ready && !isNativeApp(), apply };
}
