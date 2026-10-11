import {
  CREEP,
  LIMITS,
  SLOWEST,
  SUITE,
  TESTS,
  findCreep,
  findOverLimits,
  readDurations,
  readHistory,
  toBenchmarks,
} from './test-durations';

const report = {
  startTime: 1_000,
  testResults: [
    {
      endTime: 3_000,
      assertionResults: [
        { fullName: 'Keypad renders', duration: 120 },
        { fullName: 'Keypad types', duration: 80 },
      ],
    },
    {
      endTime: 4_500,
      assertionResults: [
        { fullName: 'Play flies slots', duration: 300.4 },
        { fullName: 'Play skipped', status: 'skipped' },
      ],
    },
  ],
};

describe('readDurations', () => {
  it('measures the whole run, all tests added up and the slowest test', () => {
    expect(readDurations(report)).toEqual({
      suite: 3_500,
      tests: 500.4,
      slowest: { name: 'Play flies slots', ms: 300.4 },
    });
  });

  it('reads an empty or malformed report as nothing', () => {
    expect(readDurations({})).toEqual({ suite: 0, tests: 0, slowest: undefined });
    expect(readDurations('nonsense')).toEqual({ suite: 0, tests: 0, slowest: undefined });
  });
});

describe('toBenchmarks', () => {
  it('records whole milliseconds, naming the slowest test', () => {
    expect(toBenchmarks(readDurations(report))).toEqual([
      { name: SUITE, unit: 'ms', value: 3_500 },
      { name: TESTS, unit: 'ms', value: 500 },
      { name: SLOWEST, unit: 'ms', value: 300, extra: 'Play flies slots' },
    ]);
  });

  it('leaves out the slowest test when there are no tests', () => {
    expect(toBenchmarks({ suite: 10, tests: 0, slowest: undefined })).toEqual([
      { name: SUITE, unit: 'ms', value: 10 },
      { name: TESTS, unit: 'ms', value: 0 },
    ]);
  });
});

describe('findOverLimits', () => {
  it('is empty at the limits', () => {
    expect(
      findOverLimits({ suite: LIMITS.suite, tests: 0, slowest: { name: 'a', ms: LIMITS.test } }),
    ).toEqual([]);
  });

  it('flags a run and a test over their limits', () => {
    expect(
      findOverLimits({ suite: 61_000, tests: 0, slowest: { name: 'Play flies', ms: 2_345 } }),
    ).toEqual([
      'The unit tests took 61.0s, over the 60.0s limit.',
      '"Play flies" took 2.3s, over the 2.0s limit per test.',
    ]);
  });
});

describe('readHistory', () => {
  it("reads each benchmark's values, oldest first, from github-action-benchmark's data.js", () => {
    const data = {
      lastUpdate: 0,
      repoUrl: '',
      entries: {
        'Unit tests': [
          { commit: {}, benches: [{ name: SUITE, value: 1, unit: 'ms' }] },
          {
            commit: {},
            benches: [
              { name: SUITE, value: 2, unit: 'ms' },
              { name: TESTS, value: 3, unit: 'ms' },
            ],
          },
        ],
      },
    };
    expect(readHistory(`window.BENCHMARK_DATA = ${JSON.stringify(data)}`)).toEqual(
      new Map([
        [SUITE, [1, 2]],
        [TESTS, [3]],
      ]),
    );
  });

  it('reads data without entries as no history', () => {
    expect(readHistory('window.BENCHMARK_DATA = {}')).toEqual(new Map());
  });
});

describe('findCreep', () => {
  const steady = (runs: number, ms: number): number[] => Array.from({ length: runs }, () => ms);

  it('waits for two of the smallest windows of runs', () => {
    const values = [...steady(CREEP.minWindow, 1_000), ...steady(CREEP.minWindow - 1, 9_000)];
    expect(findCreep(new Map([[SUITE, values]]))).toEqual([]);
  });

  it('splits a short history in half, comparing its latest runs with its first ones', () => {
    const values = [...steady(3, 10_000), 99_000, ...steady(3, 13_000)];
    expect(findCreep(new Map([[SUITE, values]]))).toEqual([
      `${SUITE}: 13.0s over the last 3 runs, up 30% from 10.0s.`,
    ]);
  });

  it('compares the latest runs with the first ones while the history is too short for a gap', () => {
    const values = [...steady(CREEP.window, 10_000), ...steady(CREEP.window, 13_000)];
    expect(findCreep(new Map([[SUITE, values]]))).toEqual([
      `${SUITE}: 13.0s over the last 10 runs, up 30% from 10.0s.`,
    ]);
  });

  it('compares the latest runs with the ones before a gap, catching a slow creep', () => {
    // Each run 1% slower than the one before: no two neighboring windows differ by much.
    const values = Array.from({ length: 100 }, (_, run) => 1_000 * 1.01 ** run);
    expect(findCreep(new Map([[TESTS, values]]))).toEqual([
      `${TESTS}: 2.6s over the last 10 runs, up 49% from 1.7s.`,
    ]);
  });

  it('ignores a few slow runs and creep within the threshold', () => {
    const latest = [...steady(CREEP.window - 4, 1_200), ...steady(4, 5_000)];
    const values = [...steady(CREEP.window + CREEP.gap, 1_000), ...latest];
    expect(findCreep(new Map([[SUITE, values]]))).toEqual([]);
  });

  it('only watches the whole run and all tests added up', () => {
    const values = [...steady(CREEP.window, 100), ...steady(CREEP.window, 900)];
    expect(findCreep(new Map([[SLOWEST, values]]))).toEqual([]);
  });
});
