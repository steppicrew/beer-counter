import { useEffect } from 'react';

/**
 * Publishes the on-screen keyboard's height as `--keyboard-inset` on <html>.
 *
 * The virtual keyboard shrinks the *visual* viewport but leaves the layout
 * viewport alone, so a bottom-anchored sheet keeps sizing itself to the full
 * window and its buttons end up underneath the keyboard. `dvh` units do not
 * help: they track the browser's own UI, not the IME.
 *
 * `visualViewport.height` plus its scroll offset is the only reliable measure
 * across Android WebView, Chrome and iOS Safari. On iOS the page also scrolls
 * itself when a field is focused, which `offsetTop` accounts for.
 */
export function useViewportInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;

    const apply = () => {
      // How much of the layout viewport the keyboard is covering.
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Sub-pixel jitter while the keyboard animates would thrash layout.
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
    };

    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);

    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      root.style.removeProperty('--keyboard-inset');
    };
  }, []);
}
