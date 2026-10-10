import {
  FLIGHT_DURATION,
  PRESS_DURATION,
  SLOT_DEPTH,
  FLIGHT_STAGGER,
  flightKeyframes,
  flightTiming,
  flyIntoWord,
  tileCorners,
} from './flight';
import { installAnimations, uninstallAnimations } from '../../testing/fake-animations';

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
});

describe('flightTiming', () => {
  it('lets each slot leave a little after the one before it', () => {
    expect(flightTiming(0)).toMatchObject({
      duration: PRESS_DURATION + FLIGHT_DURATION,
      delay: 0,
      fill: 'both',
    });
    expect(flightTiming(3).delay).toBe(3 * FLIGHT_STAGGER);
  });

  it('stops staggering after 12 slots, so long groups land together', () => {
    expect(flightTiming(12).delay).toBe(12 * FLIGHT_STAGGER);
    expect(flightTiming(30).delay).toBe(12 * FLIGHT_STAGGER);
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
    const slot = { box: { left: 0, top: 0, width: 40, height: 60 }, radius: 14, fontSize: 34 };

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
