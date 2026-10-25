import { groupDigits, slotCount } from './groups';

describe('groupDigits', () => {
  it('has no words and an empty group before anything is typed', () => {
    expect(groupDigits('', [])).toEqual({ words: [], current: '' });
  });

  it('keeps every digit in the group being typed until a group is finished', () => {
    expect(groupDigits('1415926', [])).toEqual({ words: [], current: '1415926' });
  });

  it('cuts the finished groups at their sizes, and the rest is the group being typed', () => {
    expect(groupDigits('141592653', [3, 1, 4])).toEqual({
      words: [
        { firstPlace: 1, digits: '141' },
        { firstPlace: 4, digits: '5' },
        { firstPlace: 5, digits: '9265' },
      ],
      current: '3',
    });
  });

  it('has an empty group being typed right after a group is finished', () => {
    expect(groupDigits('14159', [5])).toEqual({
      words: [{ firstPlace: 1, digits: '14159' }],
      current: '',
    });
  });
});

describe('slotCount', () => {
  it.each([true, false])(
    'grows a group past its size with the digits typed, never ahead of them, trusted or not (%s)',
    (trusted) => {
      const plan = { size: 5, trusted };

      expect(slotCount(plan, 0)).toBe(5);
      expect(slotCount(plan, 4)).toBe(5);
      expect(slotCount(plan, 5)).toBe(5);
      expect(slotCount(plan, 6)).toBe(6);
      expect(slotCount(plan, 12)).toBe(12);
    },
  );
});
