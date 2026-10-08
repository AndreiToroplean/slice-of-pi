import { BUDGETS, findOverruns, findSlowTests, formatTimings } from './check-timing';

function report(...files: { fullName: unknown; duration: unknown }[][]): unknown {
  return { testResults: files.map((assertionResults) => ({ assertionResults })) };
}

describe('findSlowTests', () => {
  it('lists the tests over the threshold across files, slowest first', () => {
    const slow = findSlowTests(
      report(
        [
          { fullName: 'a fast', duration: 20 },
          { fullName: 'a slow', duration: 400 },
        ],
        [{ fullName: 'b slower', duration: 900 }],
      ),
      300,
    );

    expect(slow).toEqual([
      { name: 'b slower', ms: 900 },
      { name: 'a slow', ms: 400 },
    ]);
  });

  it('keeps a test that takes exactly the threshold', () => {
    expect(findSlowTests(report([{ fullName: 'just fits', duration: 300 }]), 300)).toEqual([]);
  });

  it.each([
    null,
    'report',
    {},
    { testResults: 'none' },
    { testResults: [null, { assertionResults: {} }] },
  ])('finds nothing in a malformed report: %j', (malformed) => {
    expect(findSlowTests(malformed, 300)).toEqual([]);
  });

  it('skips tests without a name or a duration, such as skipped ones', () => {
    const slow = findSlowTests(
      report([
        { fullName: 'skipped', duration: null },
        { fullName: undefined, duration: 500 },
      ]),
      300,
    );

    expect(slow).toEqual([]);
  });
});

describe('findOverruns', () => {
  it('is empty when everything fits its budget', () => {
    const steps = [
      { name: 'lint', ms: 7_000 },
      { name: 'test', ms: BUDGETS.steps['test'] ?? 0 },
    ];

    expect(findOverruns(steps, [])).toEqual([]);
  });

  it('flags a step over its own budget', () => {
    expect(findOverruns([{ name: 'test', ms: 12_340 }], [])).toEqual([
      'test took 12.3s, over its 10.0s budget',
    ]);
  });

  it('flags the total over its budget, even when no step has a budget of its own', () => {
    const steps = [
      { name: 'lint', ms: 20_000 },
      { name: 'build', ms: 11_000 },
    ];

    expect(findOverruns(steps, [])).toEqual(['the checks took 31.0s, over their 30.0s budget']);
  });

  it('flags each slow test', () => {
    expect(findOverruns([], [{ name: 'Tape scrolls', ms: 861.6 }])).toEqual([
      '"Tape scrolls" took 862ms, over the 300ms budget per test',
    ]);
  });
});

describe('formatTimings', () => {
  it('shows each step, the total and their budgets in aligned columns', () => {
    const table = formatTimings([
      { name: 'format', ms: 2_040 },
      { name: 'test', ms: 8_571 },
    ]);

    expect(table).toBe(
      ['format    2.0s', 'test      8.6s  (budget 10.0s)', 'total    10.6s  (budget 30.0s)'].join(
        '\n',
      ),
    );
  });
});
