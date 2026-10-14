import { useRef } from 'react';

/** Sideways travel that makes a swipe, and how much more sideways than down. */
const SWIPE_PX = 60;
const SLOPE = 2;

/**
 * A horizontal swipe across the drink list: -1 for leftwards (the next
 * person), 1 for rightwards. Vertical drags stay the list's scroll.
 *
 * The swipe often starts on a "+" button, and the click that follows the
 * finger lifting would count a drink for whoever the swipe just switched
 * to; that one click is swallowed.
 */
export function useSwipe(onSwipe: (direction: -1 | 1) => void, enabled: boolean) {
  const start = useRef<{ id: number; x: number; y: number } | null>(null);
  const swallow = useRef(false);

  if (!enabled) return {};

  return {
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      start.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event: React.PointerEvent) => {
      const from = start.current;
      start.current = null;
      if (!from || from.id !== event.pointerId) return;
      const dx = event.clientX - from.x;
      const dy = event.clientY - from.y;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < SLOPE * Math.abs(dy)) return;
      swallow.current = true;
      // Should the browser send no click at all, the next real tap must not
      // be the one swallowed.
      window.setTimeout(() => (swallow.current = false), 400);
      onSwipe(dx < 0 ? -1 : 1);
    },
    onPointerCancel: () => (start.current = null),
    onClickCapture: (event: React.MouseEvent) => {
      if (!swallow.current) return;
      swallow.current = false;
      event.stopPropagation();
      event.preventDefault();
    },
  };
}
