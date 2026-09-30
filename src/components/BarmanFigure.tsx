import { useEffect, useRef, useState } from 'react';
import { CONTENT, HAND_FRAMES, HAND_SIZE, HEAD_FRAMES } from '../generated/barman';
import {
  HAND_X,
  HAND_Y,
  HEAD_H,
  HEADROOM,
  makeBarman,
  NECK_X,
} from '../lib/barman';
import { usePageVisible } from '../lib/usePageVisible';

interface Props {
  className?: string;
}

/** The transform that puts the head on its neck for a given pose. */
function headTransform(y: number, angle: number, scaleX: number, scaleY: number): string {
  // Rotate and stretch about the top of the neck, then bob the whole head.
  return `translate(${NECK_X} ${HEAD_H + y}) rotate(${angle}) scale(${scaleX} ${scaleY}) translate(${-NECK_X} ${-HEAD_H})`;
}

/** Whether the system asks for no decorative motion; tracks the setting live. */
function usePrefersStill(): boolean {
  const [still, setStill] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setStill(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return still;
}

/**
 * The barman himself; `Barkeeper` is the door he comes in through.
 *
 * BAR's barman: a head sprite and a hand-and-body sprite, swapped at 20 Hz by
 * the original state machine (`lib/barman`), with springs and breathing on
 * top so the swaps read as one moving body. The sixteen frames are baked into
 * `generated/barman` from the graphics repo and drawn as inline paths: the
 * ink is `currentColor` and the paper `--bar-paper`, so he is line art in the
 * app's palette rather than a black-and-white bitmap pasted on.
 *
 * All sixteen frames are in the DOM from the start and the loop only flips
 * their visibility and two transforms, straight on the elements: React is not
 * asked to re-render sixty times a second for a figure in the corner.
 *
 * Drawn in full, down to the hem of his shirt. BAR clipped him to its 78-row
 * strip; here the counter is what he stands behind, so the sprite ends where
 * the wood begins.
 */
export default function BarmanFigure({ className }: Props) {
  const headRef = useRef<SVGGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const visible = usePageVisible();
  const still = usePrefersStill();

  useEffect(() => {
    const head = headRef.current;
    const body = bodyRef.current;
    if (!head || !body) return;
    const faces = Array.from(head.children) as SVGGElement[];
    const hands = Array.from(body.children) as SVGGElement[];

    const show = (frames: SVGGElement[], index: number) => {
      frames.forEach((frame, i) => frame.setAttribute('visibility', i === index ? 'visible' : 'hidden'));
    };

    // Off screen or asked not to move: the neutral frame, at rest.
    if (!visible || still) {
      show(faces, 0);
      show(hands, 0);
      head.setAttribute('transform', headTransform(0, 0, 1, 1));
      body.setAttribute('transform', `translate(${HAND_X} ${HAND_Y})`);
      return;
    }

    const barman = makeBarman();
    let shownFace = -1;
    let shownHand = -1;
    let raf = 0;
    const loop = (t: number) => {
      const pose = barman(t);
      if (pose.face !== shownFace) {
        show(faces, pose.face);
        shownFace = pose.face;
      }
      if (pose.hand !== shownHand) {
        show(hands, pose.hand);
        shownHand = pose.hand;
      }
      head.setAttribute(
        'transform',
        headTransform(pose.head.y, pose.head.angle, pose.head.scaleX, pose.head.scaleY),
      );
      body.setAttribute('transform', `translate(${HAND_X} ${HAND_Y + pose.body.y})`);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible, still]);

  return (
    <svg
      className={className}
      // Cropped to the columns he actually occupies, with a little air either
      // side for the tilt: BAR's strip is wider than him, and the empty part
      // would put him off-centre under his own speech bubble.
      viewBox={`${CONTENT.left - 2} ${-HEADROOM} ${CONTENT.right - CONTENT.left + 4} ${HAND_Y + HAND_SIZE.h + HEADROOM}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* The head first and the hand over it, in BAR's blit order: the shaker crosses the chin. */}
      <g ref={headRef} transform={headTransform(0, 0, 1, 1)}>
        {HEAD_FRAMES.map((frame, i) => (
          <g key={i} visibility={i === 0 ? 'visible' : 'hidden'}>
            <path fill="var(--bar-paper)" fillRule="evenodd" d={frame.paper} />
            <path fill="currentColor" fillRule="evenodd" d={frame.ink} />
          </g>
        ))}
      </g>
      <g ref={bodyRef} transform={`translate(${HAND_X} ${HAND_Y})`}>
        {HAND_FRAMES.map((frame, i) => (
          <g key={i} visibility={i === 0 ? 'visible' : 'hidden'}>
            <path fill="var(--bar-paper)" fillRule="evenodd" d={frame.paper} />
            <path fill="currentColor" fillRule="evenodd" d={frame.ink} />
          </g>
        ))}
      </g>
    </svg>
  );
}
