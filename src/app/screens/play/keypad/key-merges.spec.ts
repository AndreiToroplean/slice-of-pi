import { Joint, jointsOf, KEY_MOTION, lingerSpread, moving, stepMerges } from './key-merges';

describe('jointsOf', () => {
  it('joins each digit key to those beside and below it, but not backspace', () => {
    expect(jointsOf('calculator').map((joint) => joint.id)).toEqual([
      '7-8',
      '8-9',
      '4-5',
      '5-6',
      '1-2',
      '2-3',
      '7|4',
      '8|5',
      '9|6',
      '4|1',
      '5|2',
      '6|3',
      '2|0',
    ]);
  });
});

describe('stepMerges', () => {
  const joint: Joint = { id: '7-8', first: '7', second: '8', axis: 'row' };
  const at = (progress: number) => new Map([[joint.id, progress]]);

  it('merges at its pace, faster when it takes less long', () => {
    expect(stepMerges(at(0), [joint], () => true, KEY_MOTION.merge / 4).get(joint.id)).toBeCloseTo(
      0.25,
    );
    expect(
      stepMerges(at(0), [joint], () => true, KEY_MOTION.merge / 4, KEY_MOTION.merge / 2).get(
        joint.id,
      ),
    ).toBeCloseTo(0.5);
  });

  it('splits back, and stops at either end', () => {
    expect(stepMerges(at(0.1), [joint], () => false, KEY_MOTION.merge).get(joint.id)).toBe(0);
    expect(stepMerges(at(0.9), [joint], () => true, KEY_MOTION.merge).get(joint.id)).toBe(1);
  });

  it('starts a joint first seen where it is headed, as the keypad shows', () => {
    expect(stepMerges(new Map(), [joint], () => true, 0).get(joint.id)).toBe(1);
  });

  it('tells whether a merge is under way', () => {
    expect(moving(at(0.5), [joint], () => true)).toBe(true);
    expect(moving(at(1), [joint], () => true)).toBe(false);
  });
});

describe('lingerSpread', () => {
  it('spreads from when the keys touch to the end of the linger, at once and slowing down', () => {
    expect(lingerSpread(100, 160, 1600)).toBe(0);
    expect(lingerSpread(160, 160, 1600)).toBe(0);
    const early = lingerSpread(160 + 144, 160, 1600);
    const late = lingerSpread(1600 - 144, 160, 1600) - lingerSpread(1600 - 288, 160, 1600);
    expect(early).toBeGreaterThan(0.25);
    expect(late).toBeLessThan(0.01);
    expect(lingerSpread(1600, 160, 1600)).toBe(1);
    expect(lingerSpread(5000, 160, 1600)).toBe(1);
  });

  it('spreads all at once with a linger no longer than the merge', () => {
    expect(lingerSpread(100, 160, 100)).toBe(0);
    expect(lingerSpread(160, 160, 100)).toBe(1);
  });
});
