import { useCallback, useEffect, useRef, useState } from 'react';
import { PX_PER_HOUR } from './bartop';

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** Held this long without moving, a press lifts the glass. */
const LIFT_MS = 400;
/** Movement before the lift that means "not a press on this glass". */
const MOVE_TOLERANCE_PX = 8;

/** Where a glass may go: after the one before it, before the one after it. */
export interface GlassRange {
  min: number;
  max: number;
}

interface Press {
  pointer: number;
  x: number;
  y: number;
  key: string;
  beverageId: string;
  from: number;
  range: GlassRange;
  lifted: boolean;
  timer: number;
}

export interface DraggedGlass {
  key: string;
  /** Where it would land if let go now. */
  at: number;
}

/**
 * Where a drag of `dx` pixels puts the glass: snapped to whole minutes and
 * kept inside its range. Less than half a minute of travel is no move at all,
 * so lifting a glass and setting it down again leaves its time exactly as it
 * was rather than rounding it to the minute.
 */
function place(from: number, dx: number, range: GlassRange): number {
  const ms = (dx / PX_PER_HOUR) * HOUR_MS;
  if (Math.abs(ms) < MINUTE_MS / 2) return from;
  const snapped = Math.round((from + ms) / MINUTE_MS) * MINUTE_MS;
  return Math.min(range.max, Math.max(range.min, snapped));
}

/**
 * Long-press a glass on the bar and slide it to when it was really drunk.
 *
 * A plain press or a swipe must stay what it was — the list scrolls under the
 * bar, and a glass is small — so nothing happens until the finger has been
 * held still for LIFT_MS. Vertical movement is left to the browser
 * (`touch-action: pan-y` on the glass), which cancels the press and scrolls
 * the list as before; only a horizontal drag after the lift moves the glass.
 */
export function useGlassDrag(onMove: (beverageId: string, from: number, to: number) => void) {
  const press = useRef<Press | null>(null);
  const [dragged, setDragged] = useState<DraggedGlass | null>(null);

  const cancel = useCallback(() => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setDragged(null);
  }, []);

  useEffect(() => cancel, [cancel]);

  const bind = useCallback(
    (key: string, beverageId: string, from: number, range: GlassRange) => ({
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (press.current) return;
        const target = event.currentTarget;
        const pointer = event.pointerId;
        const timer = window.setTimeout(() => {
          const state = press.current;
          if (!state || state.pointer !== pointer) return;
          state.lifted = true;
          // Captured only once lifted: before that the press may still turn
          // out to be a scroll, and a capture would steal it from the list.
          if (target.isConnected) target.setPointerCapture(pointer);
          setDragged({ key, at: from });
        }, LIFT_MS);
        press.current = {
          pointer,
          x: event.clientX,
          y: event.clientY,
          key,
          beverageId,
          from,
          range,
          lifted: false,
          timer,
        };
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        const state = press.current;
        if (!state || state.pointer !== event.pointerId) return;
        if (!state.lifted) {
          const moved = Math.hypot(event.clientX - state.x, event.clientY - state.y);
          if (moved > MOVE_TOLERANCE_PX) cancel();
          return;
        }
        setDragged({ key: state.key, at: place(state.from, event.clientX - state.x, state.range) });
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        const state = press.current;
        if (!state || state.pointer !== event.pointerId) return;
        if (state.lifted) {
          const to = place(state.from, event.clientX - state.x, state.range);
          if (to !== state.from) onMove(state.beverageId, state.from, to);
        }
        cancel();
      },
      onPointerCancel: cancel,
      // A long press would otherwise open the WebView's context menu.
      onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    }),
    [cancel, onMove],
  );

  return { dragged, bind };
}
