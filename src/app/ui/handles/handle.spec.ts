import { signal } from '@angular/core';
import { bind, dragged, Handle, stepped, UnitSizes } from './handle';

const SIZES: UnitSizes = { rem: 16, height: 8, column: 4 };

/** A value of no length, moving by one for each 100 pixels dragged right, in hundredths. */
const INTENSITY: Handle<{ intensity: number }> = {
  label: 'Intensity',
  axis: 'x',
  sign: 1,
  unit: 'px',
  scale: 100,
  get: (value) => value.intensity,
  set: (value, intensity) => ({ ...value, intensity: Math.max(0, intensity) }),
};

describe('handles', () => {
  it('moves a value of no length by so much for each pixel dragged, to its finest step', () => {
    expect(dragged(INTENSITY, { intensity: 0.5 }, 33.3, SIZES).intensity).toBe(0.83);
    expect(dragged(INTENSITY, { intensity: 0.5 }, -40, SIZES).intensity).toBe(0.1);
  });

  it('steps by a handle’s own step when it has one', () => {
    const count = { ...INTENSITY, step: 1 };

    expect(stepped(count, { intensity: 14 }, -3, SIZES).intensity).toBe(11);
    expect(stepped(INTENSITY, { intensity: 0.5 }, 10, SIZES).intensity).toBe(0.6);
  });

  it('measures a drag from where it started, however many moves it takes', () => {
    const value = signal({ intensity: 0.5 });
    const bound = bind(INTENSITY, value);

    bound.grab();
    bound.drag(10, SIZES);
    bound.drag(20, SIZES);
    expect(value().intensity).toBe(0.7);
    expect(bound.value()).toBe(0.7);

    bound.step(-1, SIZES);
    expect(value().intensity).toBe(0.69);
  });
});
