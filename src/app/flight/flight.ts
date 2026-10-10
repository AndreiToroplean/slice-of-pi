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
}

/** How long each slot takes to fly into its tile, in ms. */
export const FLIGHT_DURATION = 480;
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

/**
 * The flight of a slot into its tile: it keeps its form and color, moving and shrinking onto the tile. Its radii undo
 * the scale, so that it lands with the tile's corners: rounded on the outside of the word, square inside it.
 */
export function flightKeyframes(
  from: Box,
  to: Box,
  slotRadius: number,
  corners: Corners,
): Keyframe[] {
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const radii = (scale: number): string => corners.map((c) => `${String(c / scale)}px`).join(' ');
  return [
    { transform: 'none', borderRadius: `${String(slotRadius)}px` },
    {
      transform: `translate(${String(dx)}px, ${String(dy)}px) scale(${String(sx)}, ${String(sy)})`,
      borderRadius: `${radii(sx)} / ${radii(sy)}`,
    },
  ];
}

/** Timing of the `index`-th slot's flight. */
export function flightTiming(index: number): KeyframeAnimationOptions {
  return {
    duration: FLIGHT_DURATION,
    delay: Math.min(index, MOST_STAGGERED) * FLIGHT_STAGGER,
    easing: FLIGHT_EASING,
    // Backwards too: a slot waiting for its turn to leave must already look like the slot, not like a bare copy.
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

/** Takes a snapshot of a filled slot before it flies, relative to `layer`. */
export function snapshotSlot(layer: Element, slot: Element): SlotSnapshot {
  const style = getComputedStyle(slot);
  return {
    box: boxIn(layer, slot),
    radius: parseFloat(style.borderTopLeftRadius) || 0,
    fontSize: parseFloat(style.fontSize) || 0,
  };
}

/**
 * Flies the slots that held a group into the tiles of its word: each slot is copied onto `layer` (which must be
 * positioned) and animated onto its tile. Each tile is hidden until its copy lands, and shows in the same frame as its
 * copy is removed, so that no digit is ever missing or shown twice. `rise` is how far the word has left to move up
 * before the first copy lands (scrolling to it), so that copies aim for where it will be. Returns the animations, which
 * land their copy the same way when they're cancelled.
 */
export function flyIntoWord(
  layer: HTMLElement,
  slots: readonly SlotSnapshot[],
  word: HTMLElement,
  rise = 0,
): Animation[] {
  const tiles = Array.from(word.children).filter((tile) => tile instanceof HTMLElement);
  const wordRadius = parseFloat(getComputedStyle(word).borderTopLeftRadius) || 0;
  const flights = slots.flatMap((slot, i) => {
    const tile = tiles[i];
    return tile === undefined ? [] : [{ slot, tile }];
  });
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
    const at = boxIn(layer, tile);
    const to = { ...at, top: at.top - rise };
    tile.style.visibility = 'hidden';
    layer.append(copy);
    const animation = copy.animate(
      flightKeyframes(slot.box, to, slot.radius, tileCorners(i, flights.length, wordRadius)),
      flightTiming(i),
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
