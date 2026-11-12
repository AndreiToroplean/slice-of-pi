import { Digit } from '../../../game/pi/digit';
import { Joint } from './key-merges';
import { KeyAt, keyShapes } from './key-shapes';

describe('keyShapes', () => {
  // Keys 100 by 50, 10 apart, round by 20: 7 8 on the first row, 4 5 under them.
  const key = (name: Digit, row: number, column: number): KeyAt => ({
    key: name,
    row,
    column,
    box: { x: column * 110, y: row * 60, width: 100, height: 50 },
  });
  const square = [key('7', 0, 0), key('8', 0, 1), key('4', 1, 0), key('5', 1, 1)];
  const joints: Joint[] = [
    { id: '7-8', first: '7', second: '8', axis: 'row' },
    { id: '4-5', first: '4', second: '5', axis: 'row' },
    { id: '7|4', first: '7', second: '4', axis: 'column' },
    { id: '8|5', first: '8', second: '5', axis: 'column' },
  ];
  const shapes = (merges: Record<string, number>, keys = square) =>
    keyShapes(keys, joints, new Map(Object.entries(merges)), 20, 10, 10);
  const shape = (merges: Record<string, number>, name: Digit, keys = square) =>
    shapes(merges, keys).find((each) => each.key === name);

  it('leaves keys apart as they are', () => {
    expect(shape({}, '7')).toEqual({
      key: '7',
      box: { x: 0, y: 0, width: 100, height: 50 },
      joined: [false, false, false, false],
      across: { x: 0, y: 0, width: 100, height: 50 },
      along: { x: 0, y: 0, width: 100, height: 50 },
      radii: [20, 20, 20, 20],
      corner: undefined,
    });
  });

  it('brings two keys merging toward each other, half way each, their facing corners squaring', () => {
    const half = shape({ '7-8': 0.5 }, '7');
    expect(half?.across.width).toBeCloseTo(102.5);
    expect(half?.radii).toEqual([20, 10, 10, 20]);
    expect(shape({ '7-8': 0.5 }, '8')?.across.x).toBeCloseTo(107.5);
  });

  it('makes two keys merged one, reaching just past where they touch', () => {
    const left = shape({ '7-8': 1 }, '7');
    const right = shape({ '7-8': 1 }, '8');
    expect(left?.radii).toEqual([20, 0, 0, 20]);
    expect(left?.joined).toEqual([false, false, true, false]);
    expect((left?.across.x ?? 0) + (left?.across.width ?? 0)).toBeGreaterThan(right?.across.x ?? 0);
  });

  it('keeps the corner inside three keys merged square, unfilled', () => {
    const corner = shape({ '7-8': 1, '7|4': 1 }, '7');
    expect(corner?.radii[2]).toBe(0);
    // Stretched sideways only as high as itself, and up and down only as wide: not into the corner between.
    expect(corner?.across.height).toBe(50);
    expect(corner?.along.width).toBe(100);
    expect(shapes({ '7-8': 1, '7|4': 1, '8|5': 1 }).map((each) => each.corner)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('fills the square between four keys once they all touch, as part of the nearest, bottom right', () => {
    expect(shape({ '7-8': 1, '4-5': 1, '7|4': 1, '8|5': 0.9 }, '5')?.corner).toBeUndefined();
    const all = { '7-8': 1, '4-5': 1, '7|4': 1, '8|5': 1 };
    expect(shape(all, '5')?.corner).toEqual({ x: 99, y: 49, width: 12, height: 12 });
    expect(shape(all, '7')?.corner).toBeUndefined();
  });
});
