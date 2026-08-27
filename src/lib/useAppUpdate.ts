import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/** How often to re-check for a new build while the app stays open. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Keeps the installed app current.
 *
 * `registerType: 'autoUpdate'` activates a new service worker as soon as one
 * is found, but by itself it only looks during a navigation — and a PWA
 * launched from the home screen may not navigate for days. So we also check
 * at startup, whenever the app returns to the foreground, and on a slow timer.
 *
 * Returns true once a newer version has been installed and is waiting.
 */
export function useAppUpdate(): boolean {
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    registerSW({
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
        setUpdated(true);
      },

      onOfflineReady() {
        // Nothing to announce — running offline is the point of the app.
      },
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return updated;
}
