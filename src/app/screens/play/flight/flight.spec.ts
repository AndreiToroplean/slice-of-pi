import {
  FLIGHT_DURATION,
  PRESS_DURATION,
  SLOT_DEPTH,
  FLIGHT_STAGGER,
  flightKeyframes,
  flightStagger,
  flightTiming,
  SLIDE_DURATION,
  slideDuration,
  flyIntoWord,
  snapshotSlot,
  tileCorners,
} from './flight';
import { installAnimations, uninstallAnimations } from '../../../../testing/fake-animations';

describe('tileCorners', () => {
  it('rounds only the outer corners of a word', () => {
    expect(tileCorners(0, 3, 4)).toEqual([4, 0, 0, 4]);
    expect(tileCorners(1, 3, 4)).toEqual([0, 0, 0, 0]);
    expect(tileCorners(2, 3, 4)).toEqual([0, 4, 4, 0]);
  });

  it('rounds every corner of a word of one digit', () => {
    expect(tileCorners(0, 1, 4)).toEqual([4, 4, 4, 4]);
  });
});

describe('flightKeyframes', () => {
  const slot = { left: 100, top: 500, width: 40, height: 60 };
  const tile = { left: 20, top: 100, width: 20, height: 24 };

  it('starts on the slot, with its radius and its thickness', () => {
    expect(flightKeyframes(slot, tile, 14, [0, 0, 0, 0])[0]).toMatchObject({
      transform: 'none',
      borderRadius: '14px',
      boxShadow: `inset 0 -${String(SLOT_DEPTH)}px 0 rgb(0 0 0 / 14%)`,
    });
  });

  it('first presses in: its face moves down over its thickness, which is gone', () => {
    const [, pressed] = flightKeyframes(slot, tile, 14, [0, 0, 0, 0]);

    expect(SLOT_DEPTH).toBe(4);
    // The face covers the bottom 56 of the slot's 60 pixels: its center moves down by 2.
    expect(pressed).toMatchObject({
      offset: PRESS_DURATION / (PRESS_DURATION + FLIGHT_DURATION),
      transform: `translate(0px, 2px) scale(1, ${String(56 / 60)})`,
      borderRadius: `14px / ${String(14 / (56 / 60))}px`,
      boxShadow: 'inset 0 0 0 rgb(0 0 0 / 0%)',
    });
  });

  it('lands centered on the tile, scaled to its size', () => {
    const [, , end] = flightKeyframes(slot, tile, 14, [0, 0, 0, 0]);

    // Centers: the slot's at (120, 530), the tile's at (30, 112).
    expect(end?.['transform']).toBe('translate(-90px, -418px) scale(0.5, 0.4)');
  });

  it("lands with the tile's corners, undoing the scale", () => {
    const [, , end] = flightKeyframes(slot, tile, 14, [4, 0, 0, 4]);

    expect(end?.['borderRadius']).toBe('8px 0px 0px 8px / 10px 0px 0px 10px');
  });

  describe('sweeping through where it slides to', () => {
    const slid = { ...slot, left: 130 };
    const through = 56 + 120 + PRESS_DURATION;
    const total = through + FLIGHT_DURATION;
    const keyframes = flightKeyframes(slot, tile, 14, [4, 0, 0, 4], { slid, slide: 120, wait: 56 });

    /** Where a keyframe has the slot, from where it starts. */
    function at(keyframe: Keyframe | undefined): { x: number; y: number } {
      const [, x = '0', y = '0'] =
        /translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\)/.exec(String(keyframe?.['transform'])) ?? [];
      return { x: Number(x), y: Number(y) };
    }

    it('waits its turn on its slot, as it is', () => {
      expect(keyframes[0]?.offset).toBe(0);
      expect(keyframes[0]?.['boxShadow']).toContain('-4px');
      expect(at(keyframes[0])).toEqual({ x: 0, y: 0 });
      const waited = keyframes.find((keyframe) => keyframe.offset === 56 / total);
      expect(at(waited)).toEqual({ x: 0, y: 0 });
    });

    it('goes through where it slides to, pressed in, as it would have pressed in there, and lands on the tile', () => {
      const middle = keyframes.find((keyframe) => keyframe.offset === through / total);
      expect(at(middle)).toEqual({ x: 30, y: SLOT_DEPTH / 2 });
      expect(middle?.['transform']).toContain(`scale(1, ${String(56 / 60)})`);
      expect(keyframes.at(-1)).toMatchObject({
        offset: 1,
        transform: 'translate(-90px, -418px) scale(0.5, 0.4)',
        borderRadius: '8px 0px 0px 8px / 10px 0px 0px 10px',
      });
    });

    it('only slides across until it lifts off, but for its face sinking as it presses in, never going back', () => {
      const sliding = keyframes.filter((keyframe) => Number(keyframe.offset) <= through / total);
      expect(
        sliding.every((keyframe) => at(keyframe).y >= 0 && at(keyframe).y <= SLOT_DEPTH / 2),
      ).toBe(true);
      const across = sliding.map((keyframe) => at(keyframe).x);
      expect(across).toEqual([...across].sort((a, b) => a - b));
    });

    it('never jumps nor turns sharply: it keeps its speed through where it slides to', () => {
      const offsets = keyframes.map((keyframe) => Number(keyframe.offset));
      expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      const middle = keyframes.findIndex((keyframe) => keyframe.offset === through / total);
      const speed = (i: number): { x: number; y: number } => {
        const [a, b] = [keyframes[i], keyframes[i + 1]];
        const time = (Number(b?.offset) - Number(a?.offset)) * total;
        return { x: (at(b).x - at(a).x) / time, y: (at(b).y - at(a).y) / time };
      };
      const coming = speed(middle - 1);
      const going = speed(middle);
      expect(going.x).toBeCloseTo(coming.x, 1);
      expect(going.y).toBeCloseTo(coming.y, 1);
      expect(Math.hypot(going.x, going.y)).toBeGreaterThan(0.05);
    });
  });
});

describe('slideDuration', () => {
  const box = { left: 100, top: 500, width: 40, height: 60 };
  const slot = { box, radius: 14, fontSize: 34, slid: box };

  it('slides only when a slot has somewhere to slide to', () => {
    expect(slideDuration([slot, slot])).toBe(0);
    expect(slideDuration([slot, { ...slot, slid: { ...box, left: 130 } }])).toBe(SLIDE_DURATION);
  });
});

describe('flightTiming', () => {
  it('lets each slot leave a little after the one before it, after they all slide', () => {
    expect(flightTiming(0)).toMatchObject({
      duration: PRESS_DURATION + FLIGHT_DURATION,
      fill: 'both',
    });
    expect(flightTiming(3, 120).duration).toBe(
      120 + 3 * FLIGHT_STAGGER + PRESS_DURATION + FLIGHT_DURATION,
    );
    expect(flightStagger(3)).toBe(3 * FLIGHT_STAGGER);
  });

  it('stops staggering after 12 slots, so long groups land together', () => {
    expect(flightStagger(12)).toBe(12 * FLIGHT_STAGGER);
    expect(flightStagger(30)).toBe(12 * FLIGHT_STAGGER);
  });
});

describe('flyIntoWord', () => {
  afterEach(() => {
    uninstallAnimations();
    document.body.replaceChildren();
  });

  it("flies each slot in its tile's colors, even the slot of the digit just typed, still empty", () => {
    installAnimations();
    const word = document.createElement('span');
    for (const [digit, background] of [
      ['1', 'rgb(229, 72, 77)'],
      ['4', 'rgb(12, 148, 136)'],
    ] as const) {
      const tile = document.createElement('span');
      tile.textContent = digit;
      tile.style.backgroundColor = background;
      tile.style.color = 'rgb(255, 255, 255)';
      word.append(tile);
    }
    document.body.append(word);
    const box = { left: 0, top: 0, width: 40, height: 60 };
    const slot = { box, radius: 14, fontSize: 34, slid: box };

    flyIntoWord(document.body, [slot, slot], word);

    expect(
      Array.from(document.querySelectorAll<HTMLElement>('.flying-slot'), (copy) => [
        copy.style.backgroundColor,
        copy.style.color,
      ]),
    ).toEqual([
      ['rgb(229, 72, 77)', 'rgb(255, 255, 255)'],
      ['rgb(12, 148, 136)', 'rgb(255, 255, 255)'],
    ]);
  });
});

describe('snapshotSlot', () => {
  it('takes the slot as it is once it has popped in, its pop finished first, but not its move', () => {
    const slot = document.createElement('div');
    let popped = false;
    const pop = { animationName: 'pop', finish: () => (popped = true) } as unknown as Animation;
    const move = { finish: () => (moved = true) } as unknown as Animation;
    let moved = false;
    slot.getAnimations = () => [pop, move];
    vi.spyOn(slot, 'getBoundingClientRect').mockImplementation(
      () => ({ left: 0, top: 0, width: popped ? 40 : 28, height: popped ? 60 : 42 }) as DOMRect,
    );

    expect(snapshotSlot(document.body, slot).box).toMatchObject({ width: 40, height: 60 });
    expect(moved).toBe(false);
  });
});
