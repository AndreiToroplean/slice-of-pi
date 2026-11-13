import { LIGHT_FIELDS, LightSettings } from '../../screens/menu/menu-look';
import { Handle } from './handle';

/** Where a light is, in CSS pixels from the top left corner of what it lights. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** How to read a light in what an editor edits, `T`, and to set one of its values. */
export interface LightOf<T> {
  readonly get: (value: T) => LightSettings;
  readonly set: (value: T, key: keyof LightSettings, to: number) => T;
}

/**
 * The core of a light, as a ring round where it is, `at`, as wide as the core, dragged out and in by its knob, on its
 * right. Its size, in hundredths of a height, as the core's, is that of the container the handles are in (`cqh`).
 */
export function lightCore<T>(light: LightOf<T>, at: Point, value: T): Handle<T> {
  const field = lightField('core');
  const core = String(light.get(value).core);
  return {
    label: 'Light core',
    text: 'Core',
    axis: 'x',
    sign: 1,
    unit: 'height',
    scale: 1,
    get: (edited) => light.get(edited).core,
    set: (edited, to) => light.set(edited, 'core', clamp(to, field.min, field.max)),
    ring: true,
    line: {
      left: `${String(at.x)}px`,
      top: `${String(at.y)}px`,
      width: `calc(2 * ${core}cqh)`,
      height: `calc(2 * ${core}cqh)`,
    },
  };
}

/** How far each of a light's values of no length moves for each CSS pixel dragged: one step for every few pixels. */
const PIXELS_PER_UNIT: Readonly<Partial<Record<keyof LightSettings, number>>> = {
  intensity: 100,
  falloff: 50,
  rays: 150,
  rayCount: 8,
  saturation: 100,
};

/** The values of a light but its core, each a knob dragged across, in a row. */
export function lightKnobs<T>(light: LightOf<T>): readonly Handle<T>[] {
  return LIGHT_FIELDS.filter(({ key }) => key !== 'core').map(
    ({ key, label, min, max, step }): Handle<T> => ({
      label,
      axis: 'x',
      sign: 1,
      ...(key === 'reach'
        ? { unit: 'height', scale: 1, step: 1 }
        : { unit: 'px', scale: PIXELS_PER_UNIT[key] ?? 100, step }),
      get: (value) => light.get(value)[key],
      set: (value, to) => light.set(value, key, clamp(to, min, max)),
    }),
  );
}

function lightField(key: keyof LightSettings): (typeof LIGHT_FIELDS)[number] {
  const field = LIGHT_FIELDS.find((each) => each.key === key);
  if (field === undefined) {
    throw new Error(`No light field ${key}`);
  }
  return field;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
