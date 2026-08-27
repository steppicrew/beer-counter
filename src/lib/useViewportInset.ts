import { useEffect } from 'react';

/**
 * Publishes the on-screen keyboard's height as `--keyboard-inset` on <html>.
 *
 * The virtual keyboard shrinks the *visual* viewport but leaves the layout
 * viewport alone, so a bottom-anchored sheet keeps sizing itself to the full
 * window and its buttons end up underneath the keyboard. `dvh` units do not
 * help: they track the browser's own UI, not the IME.
 *
 * Measured against the *document*, not `window.innerHeight`. In a phone
 * browser `innerHeight - visualViewport.height` counts the collapsible URL bar
 * as well as the keyboard, which lifted the sheet a URL bar's height too far
 * and left a visible gap above the keyboard. Comparing the visual viewport's
 * bottom edge with the layout viewport's own bottom isolates the keyboard.
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
      const inset = Math.max(0, layoutHeight - visibleBottom);
      // Ignore slivers: rounding and a collapsing URL bar produce a few
      // pixels that would otherwise shift the sheet for no reason.
      const settled = inset < 24 ? 0 : Math.round(inset);
      // Sub-pixel jitter while the keyboard animates would thrash layout.
      root.style.setProperty('--keyboard-inset', `${settled}px`);
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
