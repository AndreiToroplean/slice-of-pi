import { BREAK_MODELS, breakModelKindById } from './break-models';

describe('the break models', () => {
  it('gives each one its own id, to find it by', () => {
    expect(new Set(BREAK_MODELS.map((kind) => kind.id)).size).toBe(BREAK_MODELS.length);
    for (const kind of BREAK_MODELS) {
      expect(breakModelKindById(kind.id)).toBe(kind);
    }
    expect(breakModelKindById('pluto')).toBeUndefined();
  });
});
