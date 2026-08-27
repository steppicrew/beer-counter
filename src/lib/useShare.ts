import { useCallback, useEffect, useRef, useState } from 'react';
import { Share } from '@capacitor/share';

/** What the last share attempt did, so the UI can confirm it silently. */
export type ShareResult = 'idle' | 'shared' | 'copied' | 'failed';

interface UseShare {
  /** True when a share sheet is reachable — the OS picker, or Android's. */
  canShare: boolean;
  /** True when the clipboard is writable — the fallback on desktop Firefox. */
  canCopy: boolean;
  result: ShareResult;
  share: (payload: { title: string; text: string; url: string }) => Promise<void>;
  copy: (url: string) => Promise<void>;
}

/** A dismissed picker rejects; the wording differs per platform. */
function isDismissal(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  // The Android plugin rejects with a plain Error when the user backs out.
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('canceled') || message.includes('cancelled');
}

/**
 * Wraps sharing across the three places this app runs.
 *
 * Everything goes through Capacitor's Share plugin, which needs no branching:
 * on Android it bridges to `ACTION_SEND`, and its web implementation delegates
 * to `navigator.share`. Before it was added the packaged app had no share
 * button at all — the WebView does not implement the Web Share API, so the
 * app most likely to be handed round a table offered less than the browser.
 *
 * Sharing survives the INTERNET permission the app deliberately drops:
 * `ACTION_SEND` passes a string to another app through the OS, and the
 * receiving app does its own networking.
 *
 * Capability is resolved once on mount rather than at module load — Safari
 * exposes `navigator.share` only on a secure origin, so a dev server on plain
 * http legitimately has neither it nor the clipboard.
 */
export function useShare(): UseShare {
  const [result, setResult] = useState<ShareResult>('idle');
  const [shareable, setShareable] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Confirmations are transient; clear the timer if we unmount first, or the
  // sheet closing mid-countdown leaves a setState pointed at a dead component.
  useEffect(() => () => clearTimeout(timer.current), []);

  // canShare() is async on the bridge, so resolve it once and render from state.
  useEffect(() => {
    let live = true;
    void Share.canShare()
      .then(({ value }) => {
        if (live) setShareable(value);
      })
      .catch(() => {
        // No bridge and no Web Share API: the copy button carries it.
      });
    return () => {
      live = false;
    };
  }, []);

  const flash = useCallback((next: ShareResult) => {
    setResult(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult('idle'), 2000);
  }, []);

  const copy = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        flash('copied');
      } catch {
        flash('failed');
      }
    },
    [flash],
  );

  const share = useCallback(
    async (payload: { title: string; text: string; url: string }) => {
      if (!shareable) {
        await copy(payload.url);
        return;
      }
      try {
        // `text` and `url` stay separate fields: Android appends the URL for
        // targets that take plain text, and uses it directly for those that
        // understand links.
        await Share.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
          dialogTitle: payload.title,
        });
        flash('shared');
      } catch (error) {
        // Dismissing the picker is not an error — leave the sheet untouched.
        if (isDismissal(error)) return;
        await copy(payload.url);
      }
    },
    [copy, flash, shareable],
  );

  return {
    canShare: shareable,
    canCopy: typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function',
    result,
    share,
    copy,
  };
}
