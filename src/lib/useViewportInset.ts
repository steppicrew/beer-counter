import { useEffect } from 'react';

/** Below this, an inset is rounding noise rather than a keyboard. */
const MIN_INSET = 24;

/**
 * Publishes the on-screen keyboard's height as `--keyboard-inset` on <html>.
 *
 * The virtual keyboard shrinks the *visual* viewport but leaves the layout
 * viewport alone, so a bottom-anchored sheet keeps sizing itself to the full
 * window and its buttons end up underneath the keyboard. `dvh` units do not
 * help: they track the browser's own UI, not the IME.
 *
 * Known limitation: a browser that keeps its own toolbar between the page and
 * the keyboard (Brave on Android) reports a `visualViewport.height` that stops
 * above that toolbar, and no viewport API exposes its size. The sheet is then
 * positioned correctly against everything the page can observe, but still sits
 * a toolbar's height above the keyboard itself.
 */
export function useViewportInset(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;

    const apply = () => {
      // The layout viewport's height in CSS pixels — unlike innerHeight this
      // excludes browser chrome, so what remains really is just the keyboard.
      const layoutHeight = root.clientHeight;
      const visibleBottom = vv.offsetTop + vv.height;
      const raw = Math.max(0, layoutHeight - visibleBottom);

      // Ignore slivers: rounding and a collapsing URL bar produce a few
      // pixels that would otherwise shift the sheet for no reason.
      const inset = raw < MIN_INSET ? 0 : Math.round(raw);

      // Sub-pixel jitter while the keyboard animates would thrash layout.
      root.style.setProperty('--keyboard-inset', `${inset}px`);
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
