import { useCallback, useEffect, useRef, useState } from 'react';
import { PX_PER_HOUR } from './bartop';

const HOUR_MS = 3_600_000;

/** Pixels dragged, converted to the time the stage travels. */
function pxToMs(px: number): number {
  return (px / PX_PER_HOUR) * HOUR_MS;
}

interface Bounds {
  min: number;
  max: number;
}

/**
 * Drag-to-scrub over the bartop, in milliseconds behind the present.
 *
 * Native overflow scrolling cannot do this any more: the stage is a fixed
 * window onto time rather than a strip whose width is the round, so there is
 * no content to scroll. Dragging moves *time* instead, which is also what lets
 * a fallen glass rise again — pull the window back and it is simply standing
 * on the counter once more.
 *
 * Pointer events rather than touch: one code path covers finger, mouse and
 * pen, and `setPointerCapture` keeps a drag alive when it leaves the counter,
 * which on a bar only ~57px tall is most of them.
 */
export function useBarScroll(bounds: Bounds) {
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ id: number; x: number; from: number } | null>(null);
  // The pointer handlers need the current offset at the moment the drag
  // starts, and they must not be rebuilt on every scrub frame — a mirror ref
  // written from an effect keeps them stable without reading state in render.
  const latest = useRef(0);

  // Clamped here rather than at the call sites so the offset can never sit
  // outside the round: drinks come and go, and a reset collapses the bounds to
  // zero while a drag may still be in flight.
  const clamp = useCallback(
    (value: number) => Math.min(bounds.max, Math.max(bounds.min, value)),
    [bounds.min, bounds.max],
  );

  // Derived during render rather than corrected in an effect. The bounds move
  // whenever a drink is added or the clock ticks, and re-clamping from an
  // effect would render one frame with the stale offset first — the counter
  // visibly jumping after it had already been drawn.
  const clamped = clamp(offset);

  useEffect(() => {
    latest.current = clamped;
  }, [clamped]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { id: event.pointerId, x: event.clientX, from: latest.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const state = drag.current;
      if (!state || state.id !== event.pointerId) return;
      // Dragging right pulls the counter into the past, the same direction the
      // glasses themselves travel.
      setOffset(clamp(state.from + pxToMs(event.clientX - state.x)));
    },
    [clamp],
  );

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const toPresent = useCallback(() => setOffset(clamp(0)), [clamp]);

  return {
    offset: clamped,
    /** True while the view is anywhere but the present. */
    travelling: clamped > bounds.min,
    toPresent,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
