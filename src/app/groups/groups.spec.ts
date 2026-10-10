import { DEFAULT_HINT, groupDigits } from './groups';

describe('groupDigits', () => {
  it('has no words and an empty group before anything is typed', () => {
    expect(groupDigits('')).toEqual({ words: [], current: '' });
  });

  it('expects groups of 5 by default', () => {
    expect(DEFAULT_HINT).toBe(5);
    expect(groupDigits('1415')).toEqual({ words: [], current: '1415' });
  });

  it('finishes a group as soon as its last digit is typed', () => {
    expect(groupDigits('14159')).toEqual({
      words: [{ firstPlace: 1, digits: '14159' }],
      current: '',
    });
  });

  it('starts the next group with the next digit', () => {
    expect(groupDigits('141592653589')).toEqual({
      words: [
        { firstPlace: 1, digits: '14159' },
        { firstPlace: 6, digits: '26535' },
      ],
      current: '89',
    });
  });

  it('takes other group sizes', () => {
    expect(groupDigits('1415926', 3)).toEqual({
      words: [
        { firstPlace: 1, digits: '141' },
        { firstPlace: 4, digits: '592' },
      ],
      current: '6',
    });
  });
});
