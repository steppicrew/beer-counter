/**
 * The barman as a function of time.
 *
 *   const barman = makeBarman();   // options below
 *   const pose = barman(t);        // t in ms (performance.now()); call once per display frame
 *
 * A port of `tools/vec/barman.js` in beer-counter-graphics, kept in step with
 * it by hand; the frames it indexes are baked by `scripts/import-barman.mjs`.
 *
 * The state machine is BAR's `Barmann` (BAR.LST lines 437-487, from the
 * recovered pseudo code) without mood 3, the speech-bubble gag: one head frame
 * per 50 ms slot, the hand on its own slot, no catching up after a stall. The
 * added motion: on the slow beats (a new way of shaking, a new swing, a new
 * mood) soft springs bob the body and tilt and stretch the head, and he
 * breathes.
 *
 * One departure from BAR: now and then the hands come to rest, folded in
 * front of him, for a few seconds. BAR shook without pause, which on a screen
 * you look at for an evening rather than a title picture you look at for a
 * moment is unnerving.
 */

/** The head turns and stretches about the top of the neck: (NECK_X, HEAD_H) in head-sprite px. */
export const NECK_X = 126;
export const HEAD_H = 59;

/** Where the hand sprite is blitted, relative to the head's top-left corner. */
export const HAND_X = 72;
export const HAND_Y = 38;

/** The hand frame with the shaker held low at the chest: where the hands rest. */
const REST_HAND = 6;
/** The frame a notch above it; resting hands sway slowly between the two. */
const REST_SWAY_HAND = 7;
/** How long each of the two rest frames holds before the sway, in hand slots (~55 ms each): about 1.5 s. */
const REST_SWAY = 28;
/** One chance in this per hand slot of coming to rest: about four seconds of shaking between rests on average. */
const REST_CHANCE = 70;
/** How long a rest lasts, in hand slots (~55 ms each): between about 2.5 and 7.5 s, so he rests more than he shakes. */
const REST_MIN = 45;
const REST_SPAN = 90;

/** Rows of air above the head so a bobbing head is not cut. */
export const HEADROOM = 8;

export interface BarmanOptions {
  /** Overall tempo; 1 is BAR's. */
  speed: number;
  /** The shake's tempo relative to the head's; 0.9 puts it at 90% of BAR's rate. */
  handPace: number;
  /** How much of the added motion; 0 leaves BAR's frame swaps alone. */
  magic: number;
  /** Source of randomness, in [0, 1). */
  random: () => number;
}

export interface Pose {
  /** Which head frame to draw, 0..6. */
  face: number;
  /** Which hand frame to draw, 0..8. */
  hand: number;
  /** The head's transform: y in sprite px (down), angle in degrees, about (NECK_X, HEAD_H). */
  head: { y: number; angle: number; scaleX: number; scaleY: number };
  /** The hand sprite (the body) moves down by y px. */
  body: { y: number };
}

export interface Barman {
  (t: number): Pose;
  options: BarmanOptions;
  /** Holds everything (BAR does this while the pointer is over him). */
  frozen: boolean;
}

interface Spring {
  x: number;
  v: number;
}

export function makeBarman(opts: Partial<BarmanOptions> = {}): Barman {
  const o: BarmanOptions = { speed: 1, handPace: 0.9, magic: 1, random: Math.random, ...opts };
  const random = (n: number) => Math.floor(o.random() * n); // Omikron RND(n): 0 .. n-1

  // BAR's state, as initialised at start-up
  let shakeGroup = random(3);
  let swing = random(3);
  let shakeFrame = 0;
  let shakeStep = 1;
  let mood = 1;
  let face = 0;
  let run = 0;
  let rest = 0; // hand slots left before the hands move again
  let restLength = 0;

  // the added motion: damped springs, kicked on the slow beats only
  const spring = (s: Spring, k: number, c: number, dt: number) => {
    s.v += (-k * s.x - c * s.v) * dt;
    s.x += s.v * dt;
  };
  const bob: Spring = { x: 0, v: 0 };
  const tilt: Spring = { x: 0, v: 0 };
  let pop = 0;

  const pose: Pose = { face: 0, hand: 0, head: { y: 0, angle: 0, scaleX: 1, scaleY: 1 }, body: { y: 0 } };

  function stepHead() {
    // BAR: draw the current state, then advance
    pose.face = face;
    if (random(40) === 0) {
      // a new mood: the head pops
      mood = random(3);
      run = 0;
      pop = 1;
    }
    switch (mood) {
      case 0: // neutral
        face = 0;
        break;
      case 1: // looking around: a random walk
        if (random(3) !== 0) {
          const step = random(2) !== 0 ? -1 : 1;
          run = Math.max(0, Math.min(2, run + step));
        }
        face = run + 1;
        break;
      case 2: // the slow gesture, 48-frame cycle
        run++;
        face = 4;
        if (run > 14) face = 5;
        if (run > 18) face = 6;
        if (run > 28) face = 5;
        if (run > 32) run = -15;
        break;
    }
  }

  function stepHand() {
    if (rest > 0) {
      // a slow sway between the two low frames, starting and ending low
      const elapsed = restLength - rest;
      pose.hand = Math.floor(elapsed / REST_SWAY) % 2 === 0 ? REST_HAND : REST_SWAY_HAND;
      rest--;
      return;
    }
    pose.hand = shakeGroup * 3 + shakeFrame;
    if (random(REST_CHANCE) === 0) {
      // the hands come to rest: he settles a little, and when they move again
      // it is from that pose, in that way of shaking
      rest = REST_MIN + random(REST_SPAN);
      restLength = rest;
      shakeGroup = Math.floor(REST_HAND / 3);
      shakeFrame = REST_HAND % 3;
      bob.v -= 6 * o.magic;
      return;
    }
    if (random(30) === 0) {
      // a new way of shaking
      shakeGroup = random(3);
      bob.v -= 15 * o.magic;
      tilt.v += (random(2) ? -1 : 1) * 11 * o.magic;
    }
    if (random(10) === 0) {
      // a new swing range: a nudge
      swing = random(3);
      bob.v -= 6 * o.magic;
    }
    const [lo, hi] = ([[0, 2], [1, 2], [0, 1]] as const)[swing] ?? [0, 2];
    shakeFrame += shakeStep;
    if (shakeFrame < lo) {
      shakeStep = -shakeStep;
      shakeFrame += shakeStep;
    }
    if (shakeFrame > hi) {
      shakeStep = -shakeStep;
      shakeFrame += shakeStep;
    }
  }

  function settle(t: number, dt: number) {
    // t in s: the springs and the breathing
    spring(bob, 60, 8, dt); // soft: about a second to settle
    spring(tilt, 50, 7, dt);
    pop *= Math.exp(-dt / 0.5);
    const m = o.magic;
    const y = bob.x + Math.sin(t * 2 * Math.PI * 0.23) * 0.5 * m;
    const stretch = Math.max(0.965, Math.min(1.035, 1 - bob.x * 0.012));
    const s = 1 + 0.03 * pop;
    pose.head.y = y;
    pose.head.angle = tilt.x + Math.sin(t * 2 * Math.PI * 0.14) * 0.3 * m;
    pose.head.scaleX = s / stretch; // volume kept
    pose.head.scaleY = s * stretch;
    pose.body.y = y; // the neck stays joined
  }

  // slots: the next one is booked from the previous, so the display's frame
  // grid does not stretch the average; after a stall it is booked from now,
  // like BAR (no catching up)
  const slot = (was: number, t: number, len: number) => (t - was > len ? t : was) + len;
  let next = -Infinity;
  let handNext = -Infinity;
  let last: number | null = null;

  const barman = ((t: number): Pose => {
    if (last === null) last = t;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (barman.frozen) return pose;
    if (t >= next) {
      stepHead();
      next = slot(next, t, 50 / o.speed);
    }
    if (t >= handNext) {
      stepHand();
      handNext = slot(handNext, t, 50 / (o.speed * o.handPace));
    }
    settle(t / 1000, dt * o.speed);
    return pose;
  }) as Barman;
  barman.options = o;
  barman.frozen = false;
  return barman;
}
