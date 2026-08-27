import { useRef } from 'react';

interface Options {
  onLongPress: () => void;
  onClick: () => void;
  /** How long the press must be held, in ms. */
  delay?: number;
  /** Movement beyond this many px counts as a scroll, not a press. */
  moveTolerance?: number;
}

/**
 * Long-press that coexists with a plain tap on the same element.
 *
 * Pointer events cover mouse, touch and pen in one path. A press that moves
 * (the user is scrolling the list) or that fires the long-press timer must
 * not also count the drink, so the click is suppressed in both cases.
 */
export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
  moveTolerance = 10,
}: Options) {
  const timer = useRef<number | null>(null);
  const firedLong = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: (event: React.PointerEvent) => {
      firedLong.current = false;
      origin.current = { x: event.clientX, y: event.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        firedLong.current = true;
        timer.current = null;
        // Haptic confirmation where the platform offers it: without it a long
        // press feels like the tap simply failed to register.
        navigator.vibrate?.(15);
        onLongPress();
      }, delay);
    },

    onPointerMove: (event: React.PointerEvent) => {
      if (timer.current === null || origin.current === null) return;
      const dx = Math.abs(event.clientX - origin.current.x);
      const dy = Math.abs(event.clientY - origin.current.y);
      if (dx > moveTolerance || dy > moveTolerance) clear();
    },

    onPointerUp: () => {
      clear();
      origin.current = null;
    },

    onPointerCancel: () => {
      clear();
      firedLong.current = false;
      origin.current = null;
    },

    onContextMenu: (event: React.MouseEvent) => {
      // Touch devices raise the context menu on long press; it would cover
      // the sheet we are about to open.
      if (firedLong.current) event.preventDefault();
    },

    onClick: () => {
      if (firedLong.current) {
        firedLong.current = false;
        return;
      }
      onClick();
    },
  };
}
