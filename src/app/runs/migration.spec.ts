import { isOlderFormat, migrate, Migration } from './migration';

describe('migration', () => {
  const steps: Migration[] = [
    (record) => ({ ...record, steps: [...(record['steps'] as string[]), '1 → 2'] }),
    (record) => ({ ...record, steps: [...(record['steps'] as string[]), '2 → 3'] }),
    (record) => ({ ...record, steps: [...(record['steps'] as string[]), '3 → 4'] }),
  ];

  it('runs every step from the format of a record up to the current one, in order', () => {
    expect(migrate({ format: 1, steps: [] }, steps)).toEqual({
      format: 4,
      steps: ['1 → 2', '2 → 3', '3 → 4'],
    });
    expect(migrate({ format: 3, steps: [] }, steps)).toEqual({ format: 4, steps: ['3 → 4'] });
  });

  it('leaves a record in the current format, or in one it does not know, as it is', () => {
    for (const format of [4, 5, 0, 1.5, '1']) {
      expect(migrate({ format, steps: [] }, steps)).toEqual({ format, steps: [] });
    }
  });

  it('tells the records in older formats, to be migrated', () => {
    expect(isOlderFormat({ format: 1 }, 2)).toBe(true);
    expect(isOlderFormat({ format: 2 }, 2)).toBe(false);
    expect(isOlderFormat({ format: 3 }, 2)).toBe(false);
    expect(isOlderFormat({ format: '1' }, 2)).toBe(false);
    expect(isOlderFormat(null, 2)).toBe(false);
  });
});
