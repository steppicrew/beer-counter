import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

/** The launcher icon's mat: the shortcuts sit on the same cream. */
const MAT = '#f4ece0';

/**
 * An adaptive-icon bitmap: 108dp at 2x, full bleed. The launcher masks it
 * like the app icon and shows roughly the middle 72dp, so the drawing sits
 * well inside that.
 */
const SIZE = 216;
const GLYPH = 104;

/** Replaces every `var(--x)` with the value the element resolves it to. */
function resolveVars(markup: string, style: CSSStyleDeclaration): string {
  let out = markup;
  // Tokens may refer to other tokens; a few rounds settle any chain.
  for (let round = 0; round < 4 && out.includes('var(--'); round++) {
    out = out.replace(/var\((--[\w-]+)(?:,\s*([^)]*))?\)/g, (_, name: string, fallback?: string) => {
      const value = style.getPropertyValue(name).trim();
      return value || fallback?.trim() || 'transparent';
    });
  }
  return out;
}

/**
 * Draws one of the app's own icons onto the cream mat and returns it as a
 * base64 PNG for a launcher shortcut. The icons are styled with CSS tokens;
 * a bitmap knows none of them, so they are rendered inside `.tokens-light`
 * — the light values whatever the page's theme, since the dark theme's pale
 * ink would vanish on the cream — and written into the markup before drawing.
 */
export async function shortcutIcon(icon: ReactNode): Promise<string | null> {
  // Called from an effect: React refuses flushSync while it is still
  // committing, and the first icon came out empty. A macrotask later the
  // render is ours.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const host = document.createElement('div');
  host.className = 'tokens-light';
  host.style.cssText = 'position:fixed;left:-9999px;top:0;color:var(--text-muted)';
  document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(icon));
    const svg = host.querySelector('svg');
    if (!svg) return null;

    const style = getComputedStyle(host);
    svg.setAttribute('width', String(GLYPH));
    svg.setAttribute('height', String(GLYPH));
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // `currentColor` follows this attribute once the markup stands alone.
    svg.setAttribute('color', style.color);
    const markup = resolveVars(svg.outerHTML, style);

    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = MAT;
    context.fillRect(0, 0, SIZE, SIZE);
    const at = (SIZE - GLYPH) / 2;
    context.drawImage(image, at, at, GLYPH, GLYPH);
    return canvas.toDataURL('image/png').split(',')[1] ?? null;
  } catch {
    // No icon is better than no shortcut: the launcher falls back to the app's.
    return null;
  } finally {
    root.unmount();
    host.remove();
  }
}
