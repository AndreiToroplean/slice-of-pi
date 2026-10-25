import { hadWork, isolateStorage, lastPublishTime, publishTimes, wipDate } from './wip';

const utc = (time: string): Date => new Date(`${time}Z`);

describe('lastPublishTime', () => {
  it('is the same Monday from 04:00 UTC on', () => {
    expect(lastPublishTime(utc('2026-10-26T04:00:00'))).toEqual(utc('2026-10-26T04:00:00'));
    expect(lastPublishTime(utc('2026-10-26T04:25:00'))).toEqual(utc('2026-10-26T04:00:00'));
  });

  it('is the Monday before until then', () => {
    expect(lastPublishTime(utc('2026-10-26T03:59:59'))).toEqual(utc('2026-10-19T04:00:00'));
  });

  it.each(['2026-10-20T12:00:00', '2026-10-25T23:59:59', '2026-10-22T00:00:00'])(
    'is the last Monday on %s',
    (now) => {
      expect(lastPublishTime(utc(now))).toEqual(utc('2026-10-19T04:00:00'));
    },
  );

  it('crosses months and years', () => {
    expect(lastPublishTime(utc('2027-01-03T10:00:00'))).toEqual(utc('2026-12-28T04:00:00'));
  });
});

describe('publishTimes', () => {
  it('lists every Monday after the first commit, oldest first', () => {
    expect(publishTimes(utc('2026-10-04T21:50:59'), utc('2026-10-25T02:00:00'))).toEqual([
      utc('2026-10-05T04:00:00'),
      utc('2026-10-12T04:00:00'),
      utc('2026-10-19T04:00:00'),
    ]);
  });

  it('lists nothing before the first Monday', () => {
    expect(publishTimes(utc('2026-10-19T05:00:00'), utc('2026-10-25T02:00:00'))).toEqual([]);
  });
});

describe('hadWork', () => {
  const at = utc('2026-10-19T04:00:00');

  it('counts commits in the 7 days up to the publish time', () => {
    expect(hadWork([utc('2026-10-12T04:00:01')], at)).toBe(true);
    expect(hadWork([utc('2026-10-19T04:00:00')], at)).toBe(true);
  });

  it('ignores commits from before the week or after the publish time', () => {
    expect(hadWork([utc('2026-10-12T04:00:00'), utc('2026-10-19T04:00:01')], at)).toBe(false);
    expect(hadWork([], at)).toBe(false);
  });
});

describe('wipDate', () => {
  it("names a build after its Monday's date", () => {
    expect(wipDate(utc('2026-10-05T04:00:00'))).toBe('2026-10-05');
  });
});

describe('isolateStorage', () => {
  const page =
    '<!doctype html>\n<html lang="en">\n  <head>\n    <title>Slice of Pi</title>\n  </head>\n</html>\n';

  /** Runs the page's storage script on a stand-in for the browser's IndexedDB, returning the names it was called with. */
  function namesOpened(html: string): string[] {
    const names: string[] = [];
    class Factory {
      open(name: string, version?: number): string {
        names.push(`open ${name} ${String(version)}`);
        return name;
      }
      deleteDatabase(name: string): string {
        names.push(`delete ${name}`);
        return name;
      }
    }
    const script = /<script>(.*)<\/script>/.exec(html)?.[1] ?? '';
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the script is what the test is about
    (new Function('IDBFactory', script) as (factory: typeof Factory) => void)(Factory);
    const factory = new Factory();
    factory.open('slice-of-pi', 3);
    factory.deleteDatabase('slice-of-pi-format-2');
    return names;
  }

  it("prefixes the build's databases with its date", () => {
    expect(namesOpened(isolateStorage(page, '2026-10-12'))).toEqual([
      'open wip-2026-10-12:slice-of-pi 3',
      'delete wip-2026-10-12:slice-of-pi-format-2',
    ]);
  });

  it('runs before anything else on the page', () => {
    expect(isolateStorage(page, '2026-10-12')).toMatch(/<head><script>.*<\/script>\n {4}<title>/);
  });

  it('refuses a page without a head', () => {
    expect(() => isolateStorage('<html></html>', '2026-10-12')).toThrow(/head/);
  });
});
