import { useEffect, useState } from 'react';
import { isNativeApp } from './platform';

/**
 * The event Chromium fires when the PWA is installable. Not in lib.dom yet.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'beer-counter-install-dismissed';

/**
 * `beforeinstallprompt` fires once, early — often before React has mounted,
 * and certainly before a sheet opened later. Capture it at module load and
 * share it, so every consumer of this hook agrees on whether install is
 * available rather than racing the event.
 */
const store = {
  event: null as BeforeInstallPromptEvent | null,
  subscribers: new Set<() => void>(),

  set(event: BeforeInstallPromptEvent | null) {
    this.event = event;
    for (const fn of this.subscribers) fn();
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    store.set(event as BeforeInstallPromptEvent);
  });

  window.addEventListener('appinstalled', () => {
    store.set(null);
  });
}

/** True when the page is already running as an installed app. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    // iOS Safari predates display-mode and uses its own flag.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * iOS Safari never fires beforeinstallprompt and has no programmatic install,
 * so those users need written instructions instead of a button.
 */
function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && webkit;
}

export interface InstallState {
  /** Show the install affordance at all. */
  available: boolean;
  /** No prompt API — show manual instructions instead of a button. */
  manualOnly: boolean;
  /** Whether the dismissable banner should be rendered. */
  bannerVisible: boolean;
  install: () => Promise<void>;
  dismissBanner: () => void;
}

export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(() => store.event);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      // Private mode or blocked storage: treat as not dismissed.
      return false;
    }
  });

  useEffect(() => {
    // Nothing to install in the packaged app, or if we are already the app.
    if (isNativeApp() || isStandalone()) return;

    const sync = () => {
      setDeferred(store.event);
      setInstalled(isStandalone());
    };

    store.subscribers.add(sync);

    // Chrome reflects standalone mode in a media query rather than firing an
    // event when the app is launched installed.
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    standaloneQuery.addEventListener('change', sync);

    sync();

    return () => {
      store.subscribers.delete(sync);
      standaloneQuery.removeEventListener('change', sync);
    };
  }, []);

  const native = isNativeApp();
  const manualOnly = !native && !installed && !deferred && isIosSafari();
  const available = !native && !installed && (deferred !== null || manualOnly);

  const install = async () => {
    const event = deferred ?? store.event;
    if (!event) return;

    await event.prompt();
    const { outcome } = await event.userChoice;

    // The event is single-use whichever way it went.
    store.set(null);
    if (outcome === 'dismissed') dismissBanner();
  };

  const dismissBanner = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Non-persistent dismissal is still better than none.
    }
  };

  return {
    available,
    manualOnly,
    bannerVisible: available && !dismissed,
    install,
    dismissBanner,
  };
}
