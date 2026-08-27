import { useCallback, useEffect, useRef, useState } from 'react';

/** What the last share attempt did, so the UI can confirm it silently. */
export type ShareResult = 'idle' | 'shared' | 'copied' | 'failed';

interface Share {
  /** True when the OS picker (WhatsApp, Signal, Mail, AirDrop…) is available. */
  canShare: boolean;
  /** True when the clipboard is writable — the fallback on desktop Firefox. */
  canCopy: boolean;
  result: ShareResult;
  share: (payload: { title: string; text: string; url: string }) => Promise<void>;
  copy: (url: string) => Promise<void>;
}

/**
 * Wraps the Web Share and Clipboard APIs.
 *
 * Both are feature-detected at call time rather than at module load: Safari
 * exposes `navigator.share` only on a secure origin, and the clipboard is
 * gated the same way, so a dev server on plain http legitimately has neither.
 *
 * A dismissed share picker rejects with `AbortError`. That is the user saying
 * "no", not a failure, so it must not surface as one.
 */
export function useShare(): Share {
  const [result, setResult] = useState<ShareResult>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Confirmations are transient; clear the timer if we unmount first, or the
  // sheet closing mid-countdown leaves a setState pointed at a dead component.
  useEffect(() => () => clearTimeout(timer.current), []);

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
      if (!navigator.share) {
        await copy(payload.url);
        return;
      }
      try {
        await navigator.share(payload);
        flash('shared');
      } catch (error) {
        // Dismissing the picker is not an error — leave the sheet untouched.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        await copy(payload.url);
      }
    },
    [copy, flash],
  );

  return {
    canShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    canCopy: typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function',
    result,
    share,
    copy,
  };
}
