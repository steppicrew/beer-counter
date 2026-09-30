import { useEffect, useRef, useState } from 'react';
import { CONTENT, HAND_FRAMES, HAND_SIZE, HEAD_FRAMES } from '../generated/barman';
import { HAND_X, HAND_Y, HEAD_H, HEADROOM, makeBarman, NECK_X } from '../lib/barman';
import { usePageVisible } from '../lib/usePageVisible';
import './Barman.scss';

interface Props {
  className?: string;
}

/** The sprite strip cropped to him, in sprite px: what every frame's viewBox shows. */
const VIEW = {
  x: CONTENT.left - 2,
  y: -HEADROOM,
  w: CONTENT.right - CONTENT.left + 4,
  h: HAND_Y + HAND_SIZE.h + HEADROOM,
};
const VIEW_BOX = `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`;

/** A sprite-px offset as a share of the box, for CSS transforms that must scale with him. */
const pct = (spritePx: number, of: number) => `${(spritePx / of) * 100}%`;

/**
 * The added motion is written to the page only in steps this coarse: a fifth
 * of a sprite pixel, a fifth of a degree, half a percent of stretch. Finer
 * than the eye picks up at his size, and it means the breathing — a sine
 * wave that never quite repeats a value — produces a handful of writes a
 * second instead of one per display frame, so the compositor sleeps between
 * the frame swaps rather than composing sixty pictures a second of a man
 * moving a hundredth of a pixel.
 */
const quantise = (value: number, step: number) => Math.round(value / step) * step;

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
 * Built for the battery, not for the DOM's convenience. Every frame is its
 * own SVG on its own compositor layer, and the head and the body are boxes
 * moved with CSS transforms: the browser rasterises each frame once, and from
 * then on a frame swap is a visibility flip and the bob a GPU transform. The
 * first version moved SVG groups with the `transform` attribute, which
 * re-rasterised a few hundred curves every display frame — a fan heater in
 * the shape of a cartoon.
 *
 * The loop writes straight to the elements; React is not asked to re-render
 * sixty times a second for a figure in the corner. He stops when the page is
 * hidden — which is what the screen going dark, the app going to the
 * background or another tab coming to the front all amount to — and when
 * the system asks for reduced motion. While the screen is on and the app is
 * in front, he moves: an idle timer was tried and read as the app hanging.
 */
export default function BarmanFigure({ className }: Props) {
  const headRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const visible = usePageVisible();
  const still = usePrefersStill();

  useEffect(() => {
    const head = headRef.current;
    const body = bodyRef.current;
    if (!head || !body) return;
    const faces = Array.from(head.children) as HTMLElement[];
    const hands = Array.from(body.children) as HTMLElement[];

    const show = (frames: HTMLElement[], index: number) => {
      frames.forEach((frame, i) => {
        frame.style.visibility = i === index ? 'visible' : 'hidden';
      });
    };

    // Off screen or asked not to move: the neutral frame, at rest.
    if (!visible || still) {
      show(faces, 0);
      show(hands, 0);
      head.style.transform = '';
      body.style.transform = '';
      return;
    }

    const barman = makeBarman();
    let shownFace = -1;
    let shownHand = -1;
    let headTransform = '';
    let bodyTransform = '';
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
      const { y, angle, scaleX, scaleY } = pose.head;
      const nextHead = `translateY(${pct(quantise(y, 0.2), VIEW.h)}) rotate(${quantise(angle, 0.2)}deg) scale(${quantise(scaleX, 0.005)}, ${quantise(scaleY, 0.005)})`;
      if (nextHead !== headTransform) {
        head.style.transform = nextHead;
        headTransform = nextHead;
      }
      const nextBody = `translateY(${pct(quantise(pose.body.y, 0.2), VIEW.h)})`;
      if (nextBody !== bodyTransform) {
        body.style.transform = nextBody;
        bodyTransform = nextBody;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible, still]);

  return (
    <span
      className={['barman', className].filter(Boolean).join(' ')}
      style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}` }}
      aria-hidden="true"
    >
      {/* The head first and the hand over it, in BAR's blit order: the shaker crosses the chin. */}
      <span
        ref={headRef}
        className="barman__part"
        // Rotates and stretches about the top of the neck.
        style={{ transformOrigin: `${pct(NECK_X - VIEW.x, VIEW.w)} ${pct(HEAD_H - VIEW.y, VIEW.h)}` }}
      >
        {HEAD_FRAMES.map((frame, i) => (
          <svg
            key={i}
            className="barman__frame"
            viewBox={VIEW_BOX}
            style={{ visibility: i === 0 ? 'visible' : 'hidden' }}
          >
            <path fill="var(--bar-paper)" fillRule="evenodd" d={frame.paper} />
            <path fill="currentColor" fillRule="evenodd" d={frame.ink} />
          </svg>
        ))}
      </span>
      <span ref={bodyRef} className="barman__part">
        {HAND_FRAMES.map((frame, i) => (
          <svg
            key={i}
            className="barman__frame"
            viewBox={VIEW_BOX}
            style={{ visibility: i === 0 ? 'visible' : 'hidden' }}
          >
            <g transform={`translate(${HAND_X} ${HAND_Y})`}>
              <path fill="var(--bar-paper)" fillRule="evenodd" d={frame.paper} />
              <path fill="currentColor" fillRule="evenodd" d={frame.ink} />
            </g>
          </svg>
        ))}
      </span>
    </span>
  );
}
