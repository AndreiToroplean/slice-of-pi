/** A rectangle on screen, in pixels. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Corner radii in pixels, clockwise from the top left, as in `border-radius`. */
export type Corners = readonly [
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
];

/** A filled slot about to fly into its tile: where it is and how it looks. */
export interface SlotSnapshot {
  readonly box: Box;
  readonly radius: number;
  readonly fontSize: number;
  /** Where it slides to before it flies: where it would be were its group's slots all the slots there are. */
  readonly slid: Box;
}

/**
 * How long the slots take to slide to their places, besides pressing in, before they fly on, when their group ends
 * before filling them all, in ms.
 */
export const SLIDE_DURATION = 120;

/** How long each slot takes to press in before it flies, in ms. */
export const PRESS_DURATION = 70;
/** How long each slot then takes to fly into its tile, in ms. */
export const FLIGHT_DURATION = 480;
/** When the first slot lands in its tile, in ms after it starts, unless the slots slide first. */
export const FIRST_LANDING = PRESS_DURATION + FLIGHT_DURATION;
/** The thickness of a filled slot: the dark band along its bottom (see `slots.css`), in pixels. */
export const SLOT_DEPTH = 4;
const SLOT_EDGE = `inset 0 -${String(SLOT_DEPTH)}px 0 rgb(0 0 0 / 14%)`;
const PRESS_EASING = 'cubic-bezier(0.3, 0, 0.5, 1)';
/** Each slot leaves this long after the one before it, in ms. */
export const FLIGHT_STAGGER = 28;
/** Slots past this many leave together with the last staggered one, so long groups don't trail on. */
const MOST_STAGGERED = 12;
const FLIGHT_EASING = 'cubic-bezier(0.5, 0, 0.2, 1)';

/** Corner radii of the `index`-th of `length` joined tiles: only the word's outer corners are rounded. */
export function tileCorners(index: number, length: number, radius: number): Corners {
  const left = index === 0 ? radius : 0;
  const right = index === length - 1 ? radius : 0;
  return [left, right, right, left];
}

/** How long the slots slide before they fly, in ms: only if any of them has somewhere to slide to. */
export function slideDuration(slots: readonly SlotSnapshot[]): number {
  return slots.some(
    ({ box, slid }) => Math.abs(slid.left - box.left) >= 0.5 || Math.abs(slid.top - box.top) >= 0.5,
  )
    ? SLIDE_DURATION
    : 0;
}

/** How long the `index`-th slot waits for its turn to press in and fly, after the one before it, in ms. */
export function flightStagger(index: number): number {
  return Math.min(index, MOST_STAGGERED) * FLIGHT_STAGGER;
}

/** When the digit of the `index`-th slot leaves it, pressed in, flying off, in ms after the slots start to slide. */
export function leavesAt(index: number, slide: number): number {
  return slide + flightStagger(index) + PRESS_DURATION;
}

/**
 * The flight of a slot, from `from`, into its tile, at `to`, once it has waited its turn, `wait` ms. First it presses in
 * like a button: its face, its digit in the middle of it, moves down over its thickness, the dark band along its bottom,
 * which it then no longer has.
 * Then it keeps its form and color, moving and shrinking onto the tile. Its radii undo the scale, so that it lands with
 * the tile's corners: rounded on the outside of the word, square inside it.
 *
 * When it slides to `slid` first, for `slide` ms, it sweeps there and on in one move instead (see {@link sweep}).
 */
export function flightKeyframes(
  from: Box,
  to: Box,
  slotRadius: number,
  corners: Corners,
  { slid = from, slide = 0, wait = 0 }: { slid?: Box; slide?: number; wait?: number } = {},
): Keyframe[] {
  if (slide > 0) {
    return sweep(from, slid, to, slotRadius, corners, { slide, wait });
  }
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const radii = (scale: number): string => corners.map((c) => `${String(c / scale)}px`).join(' ');
  // Pressed, its face covers the bottom of the slot, where the band was: as wide, as tall, and lower by the depth.
  const pressedScale = (from.height - SLOT_DEPTH) / from.height;
  const total = wait + PRESS_DURATION + FLIGHT_DURATION;
  const resting = {
    transform: 'none',
    borderRadius: `${String(slotRadius)}px`,
    boxShadow: SLOT_EDGE,
    paddingBottom: `${String(SLOT_DEPTH)}px`,
    easing: PRESS_EASING,
  };
  return [
    { offset: 0, ...resting },
    ...(wait > 0 ? [{ offset: wait / total, ...resting }] : []),
    {
      offset: (wait + PRESS_DURATION) / total,
      transform: `translate(0px, ${String(SLOT_DEPTH / 2)}px) scale(1, ${String(pressedScale)})`,
      borderRadius: `${String(slotRadius)}px / ${String(slotRadius / pressedScale)}px`,
      boxShadow: 'inset 0 0 0 rgb(0 0 0 / 0%)',
      paddingBottom: '0px',
      easing: FLIGHT_EASING,
    },
    {
      offset: 1,
      transform: `translate(${String(dx)}px, ${String(dy)}px) scale(${String(sx)}, ${String(sy)})`,
      borderRadius: `${radii(sx)} / ${radii(sy)}`,
      boxShadow: 'inset 0 0 0 rgb(0 0 0 / 0%)',
      paddingBottom: '0px',
    },
  ];
}

/** How often a sweep is sampled, in ms: about every frame. */
const SWEEP_SAMPLE = 16;

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The flight of a slot that slides to `slid` before it flies, as one smooth move: once it has waited its turn, `wait`
 * ms, it sweeps from its slot, through `slid`, pressed in there as it would have been, on to its tile, at the times it
 * would have pressed in and landed. Its path is a curve through the three, its position and speed never jumping: a
 * cubic for each part (Hermite), from rest, through `slid`, and to rest on the tile. Until `slid`, it only slides across,
 * pressing in, its face sinking over its thickness; only then does it lift off, keeping its speed across. It takes the
 * tile's size and corners on the way from `slid`, each change easing in and out. Sampled into keyframes about every frame, as keyframes alone would move in straight lines.
 */
function sweep(
  from: Box,
  slid: Box,
  to: Box,
  slotRadius: number,
  corners: Corners,
  { slide, wait }: { slide: number; wait: number },
): Keyframe[] {
  const through = wait + slide + PRESS_DURATION;
  const total = through + FLIGHT_DURATION;
  const pressedScale = (from.height - SLOT_DEPTH) / from.height;
  // Where it is, from where it starts, at each of the three.
  const start: Point = { x: 0, y: 0 };
  const middle: Point = { x: slid.left - from.left, y: slid.top - from.top + SLOT_DEPTH / 2 };
  const end: Point = {
    x: to.left + to.width / 2 - (from.left + from.width / 2),
    y: to.top + to.height / 2 - (from.top + from.height / 2),
  };
  const before = through - wait;
  const after = total - through;
  // Through `slid`, across at the speed of the parabola through the three, but at least at its mean speed there, so
  // that it never stops, arcing on to the tile rather, and at most three times as fast, so that it never overshoots
  // `slid` on the way; and not yet up or down, as it slides only across until it lifts off.
  const slideSpeed = (middle.x - start.x) / before;
  const parabola = (((end.x - middle.x) / after) * before + slideSpeed * after) / (before + after);
  const velocity: Point = {
    x:
      slideSpeed === 0
        ? 0
        : Math.sign(slideSpeed) *
          Math.min(
            Math.max(parabola * Math.sign(slideSpeed), Math.abs(slideSpeed)),
            3 * Math.abs(slideSpeed),
          ),
    y: 0,
  };
  const rest: Point = { x: 0, y: 0 };
  const times = [
    0,
    ...Array.from(
      { length: Math.ceil((total - wait) / SWEEP_SAMPLE) },
      (_, i) => wait + i * SWEEP_SAMPLE,
    ),
    through,
    total,
  ]
    .filter((time, i, all) => all.indexOf(time) === i && time <= total)
    .sort((a, b) => a - b);
  return times.map((time) => {
    const flying = time > through;
    const s = flying ? (time - through) / after : Math.max(0, time - wait) / before;
    const at = flying
      ? hermite(middle, velocity, end, rest, after, s)
      : hermite(start, rest, middle, velocity, before, s);
    const eased = s * s * (3 - 2 * s);
    const pressed = flying ? 1 : eased;
    const landed = flying ? eased : 0;
    const scaleX = 1 + (to.width / from.width - 1) * landed;
    const scaleY =
      1 + (pressedScale - 1) * pressed + (to.height / from.height - pressedScale) * landed;
    const radius = (corner: number): number => slotRadius + (corner - slotRadius) * landed;
    return {
      offset: time / total,
      transform: `translate(${String(at.x)}px, ${String(at.y)}px) scale(${String(scaleX)}, ${String(scaleY)})`,
      borderRadius: `${corners.map((c) => `${String(radius(c) / scaleX)}px`).join(' ')} / ${corners
        .map((c) => `${String(radius(c) / scaleY)}px`)
        .join(' ')}`,
      boxShadow: `inset 0 -${String(SLOT_DEPTH * (1 - pressed))}px 0 rgb(0 0 0 / ${String(14 * (1 - pressed))}%)`,
      paddingBottom: `${String(SLOT_DEPTH * (1 - pressed))}px`,
    };
  });
}

/** Where a cubic from `a`, going at `va`, to `b`, going at `vb`, over `duration` ms, is at `s`, from 0 to 1 (Hermite). */
function hermite(a: Point, va: Point, b: Point, vb: Point, duration: number, s: number): Point {
  const s2 = s * s;
  const s3 = s2 * s;
  const at = (axis: keyof Point): number =>
    (2 * s3 - 3 * s2 + 1) * a[axis] +
    (s3 - 2 * s2 + s) * duration * va[axis] +
    (3 * s2 - 2 * s3) * b[axis] +
    (s3 - s2) * duration * vb[axis];
  return { x: at('x'), y: at('y') };
}

/**
 * Timing of the `index`-th slot's flight, after the slots slide for `slide` ms, if they do: its wait for its turn is part
 * of it.
 */
export function flightTiming(index: number, slide = 0): KeyframeAnimationOptions {
  return {
    duration: slide + flightStagger(index) + PRESS_DURATION + FLIGHT_DURATION,
    // Shaped like its slot before it starts, and like its tile until removed, in the same frame as the tile shows.
    fill: 'both',
  };
}

/** Where `element` is, relative to `layer`. */
export function boxIn(layer: Element, element: Element): Box {
  const outer = layer.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  return {
    left: inner.left - outer.left,
    top: inner.top - outer.top,
    width: inner.width,
    height: inner.height,
  };
}

/**
 * Takes a snapshot of a filled slot before it flies, relative to `layer`: as it is once it has popped in, as the slot
 * of the digit typed last may still be doing, smaller, when its group ends at once, but wherever it's moving to, as
 * slots handing over do. It slides nowhere, unless told where (`slid`).
 */
export function snapshotSlot(layer: Element, slot: Element): SlotSnapshot {
  for (const animation of slot.getAnimations()) {
    // Its pop, a CSS animation, rather than its move, one of the script's.
    if ('animationName' in animation) {
      animation.finish();
    }
  }
  const style = getComputedStyle(slot);
  const box = boxIn(layer, slot);
  return {
    box,
    radius: parseFloat(style.borderTopLeftRadius) || 0,
    fontSize: parseFloat(style.fontSize) || 0,
    slid: box,
  };
}

/**
 * Flies the slots that held a group into the tiles of its word: each slot is copied onto `layer` (which must be
 * positioned) and animated onto its tile. Each tile is hidden until its copy lands, and shows in the same frame as its
 * copy is removed, so that no digit is ever missing or shown twice. Copies with somewhere to slide to sweep there and
 * on (see {@link slideDuration} and {@link flightKeyframes}). `shift` is how far the word has left to move left before
 * the first copy lands (scrolling to it), so that copies aim for where it will be. Returns the animations, which land
 * their copy the same way when they're cancelled.
 */
export function flyIntoWord(
  layer: HTMLElement,
  slots: readonly SlotSnapshot[],
  word: HTMLElement,
  shift = 0,
): Animation[] {
  const tiles = Array.from(word.children).filter((tile) => tile instanceof HTMLElement);
  const wordRadius = parseFloat(getComputedStyle(word).borderTopLeftRadius) || 0;
  const flights = slots.flatMap((slot, i) => {
    const tile = tiles[i];
    return tile === undefined ? [] : [{ slot, tile }];
  });
  const slide = slideDuration(slots);
  return flights.map(({ slot, tile }, i) => {
    const copy = document.createElement('div');
    copy.className = 'flying-slot';
    copy.textContent = tile.textContent.trim();
    copy.setAttribute('aria-hidden', 'true');
    Object.assign(copy.style, {
      left: `${String(slot.box.left)}px`,
      top: `${String(slot.box.top)}px`,
      width: `${String(slot.box.width)}px`,
      height: `${String(slot.box.height)}px`,
      borderRadius: `${String(slot.radius)}px`,
      fontSize: `${String(slot.fontSize)}px`,
    });
    // In its tile's colors: the slot of the digit typed last is snapshotted before that digit fills it.
    const colors = getComputedStyle(tile);
    copy.style.background = colors.backgroundColor;
    copy.style.color = colors.color;
    const at = boxIn(layer, tile);
    const to = { ...at, left: at.left - shift };
    tile.style.visibility = 'hidden';
    layer.append(copy);
    const animation = copy.animate(
      flightKeyframes(slot.box, to, slot.radius, tileCorners(i, flights.length, wordRadius), {
        slid: slot.slid,
        slide,
        wait: flightStagger(i),
      }),
      flightTiming(i, slide),
    );
    const land = (): void => {
      copy.remove();
      tile.style.visibility = '';
    };
    animation.onfinish = land;
    animation.oncancel = land;
    return animation;
  });
}
