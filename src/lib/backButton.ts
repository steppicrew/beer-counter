import { App } from '@capacitor/app';
import { isNativeApp } from './platform';

/**
 * Android's back button closes the sheet on top, the way Esc does in a
 * browser; with no sheet open it puts the app away, as Android does by
 * default.
 *
 * Without a listener Capacitor leaves back to the activity, which backgrounds
 * the app with any sheet still open — and the tip sheet has no Close button.
 * Registering one replaces that default entirely, hence the minimise.
 */
export function handleBackButton() {
  if (!isNativeApp()) return;

  void App.addListener('backButton', () => {
    // A nested sheet is rendered inside the one it was opened from, so the
    // last open dialog in document order is the one on top.
    const top = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (top) {
      // What Esc sends: each sheet closes itself on `cancel`.
      top.dispatchEvent(new Event('cancel', { cancelable: true }));
    } else {
      void App.minimizeApp();
    }
  });
}
